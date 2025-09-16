/**
 * React Hook for Debounced IPC Operations
 *
 * Provides debounced IPC calls to prevent excessive main process communication
 * from rapid user interactions and state changes. Includes configurable delays,
 * leading/trailing edge options, and operation-specific optimization.
 *
 * @author Frontend Optimization Specialist
 * @version 1.0.0
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { ipcBridge } from '../ipc/IPCBridge';
import type { SearchQuery, KBEntryInput, KBEntryUpdate, DatabaseMetrics, SearchResult } from '../../types';

// =====================
// Types & Interfaces
// =====================

export type DebounceMode = 'trailing' | 'leading' | 'both';
export type IPCOperation = 'search' | 'metrics' | 'validation' | 'autocomplete' | 'rating' | 'entry-crud';

export interface DebounceConfig {
  delay: number;
  mode: DebounceMode;
  maxWait?: number;
  immediate?: boolean; // Execute immediately on first call
  leading?: boolean;   // Execute on leading edge
  trailing?: boolean;  // Execute on trailing edge
}

export interface DebounceOptions {
  /**
   * Operation type for predefined configurations
   */
  operation?: IPCOperation;

  /**
   * Custom debounce delay in milliseconds
   */
  delay?: number;

  /**
   * Debounce mode: when to execute the function
   */
  mode?: DebounceMode;

  /**
   * Maximum time to wait before forcing execution
   */
  maxWait?: number;

  /**
   * Execute immediately on first call
   */
  immediate?: boolean;

  /**
   * Unique key for operation grouping
   */
  key?: string;

  /**
   * Cancel previous calls when new ones are made
   */
  cancelPrevious?: boolean;
}

export interface DebouncedFunction<T extends (...args: any[]) => Promise<any>> {
  (...args: Parameters<T>): Promise<ReturnType<T>>;
  cancel(): void;
  flush(): Promise<ReturnType<T> | undefined>;
  pending(): boolean;
  callCount(): number;
}

// =====================
// Default Configurations
// =====================

const DEFAULT_CONFIGS: Record<IPCOperation, DebounceConfig> = {
  search: {
    delay: 300,
    mode: 'trailing',
    maxWait: 1000,
    leading: false,
    trailing: true,
  },
  metrics: {
    delay: 1000,
    mode: 'trailing',
    maxWait: 5000,
    leading: false,
    trailing: true,
  },
  validation: {
    delay: 500,
    mode: 'trailing',
    maxWait: 2000,
    leading: false,
    trailing: true,
  },
  autocomplete: {
    delay: 200,
    mode: 'trailing',
    maxWait: 800,
    leading: false,
    trailing: true,
  },
  rating: {
    delay: 100,
    mode: 'leading',
    leading: true,
    trailing: false,
  },
  'entry-crud': {
    delay: 0, // No debounce for critical operations
    mode: 'leading',
    immediate: true,
    leading: true,
    trailing: false,
  }
};

// =====================
// Debounce Utilities
// =====================

/**
 * Creates a debounced async function with advanced configuration
 */
function createDebouncedFunction<T extends (...args: any[]) => Promise<any>>(
  func: T,
  config: DebounceConfig
): DebouncedFunction<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let maxTimeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let leadingInvoked = false;
  let result: ReturnType<T> | undefined;
  let callCount = 0;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  let pendingResolve: ((value: ReturnType<T>) => void) | null = null;
  let pendingReject: ((error: any) => void) | null = null;

  const { delay, mode, maxWait, immediate, leading = false, trailing = true } = config;

  const invokeFunc = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    lastInvokeTime = Date.now();
    callCount++;

    try {
      result = await func(...args);
      if (pendingResolve) {
        pendingResolve(result);
        pendingPromise = null;
        pendingResolve = null;
        pendingReject = null;
      }
      return result;
    } catch (error) {
      if (pendingReject) {
        pendingReject(error);
        pendingPromise = null;
        pendingResolve = null;
        pendingReject = null;
      }
      throw error;
    }
  };

  const leadingEdge = (...args: Parameters<T>): Promise<ReturnType<T>> => {
    lastInvokeTime = Date.now();
    leadingInvoked = true;
    return invokeFunc(...args);
  };

  const trailingEdge = (...args: Parameters<T>): Promise<ReturnType<T>> => {
    timeoutId = null;
    if (!leadingInvoked || trailing) {
      return invokeFunc(...args);
    }
    return Promise.resolve(result as ReturnType<T>);
  };

  const cancelTimer = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const cancelMaxTimer = (): void => {
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  };

  const debouncedFunc = (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastCallTime = time;

    // Create or reuse pending promise
    if (!pendingPromise) {
      pendingPromise = new Promise<ReturnType<T>>((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    }

    // Handle immediate execution (first call only)
    if (immediate && lastInvokeTime === 0) {
      return invokeFunc(...args);
    }

    if (isInvoking) {
      if (timeoutId === null) {
        if (leading) {
          leadingEdge(...args);
        } else if (!trailing) {
          // If not trailing and not leading, execute now
          return invokeFunc(...args);
        }
      }

      // Handle max wait
      if (maxWait !== undefined) {
        if (maxTimeoutId === null) {
          maxTimeoutId = setTimeout(() => {
            cancelTimer();
            trailingEdge(...args);
            cancelMaxTimer();
          }, maxWait);
        }
      }
    }

    cancelTimer();
    timeoutId = setTimeout(() => {
      trailingEdge(...args);
      cancelMaxTimer();
    }, delay);

    leadingInvoked = false;
    return pendingPromise;
  };

  // Attach utility methods
  debouncedFunc.cancel = (): void => {
    cancelTimer();
    cancelMaxTimer();
    lastCallTime = 0;
    lastInvokeTime = 0;
    leadingInvoked = false;

    if (pendingReject) {
      pendingReject(new Error('Debounced function cancelled'));
      pendingPromise = null;
      pendingResolve = null;
      pendingReject = null;
    }
  };

  debouncedFunc.flush = async (): Promise<ReturnType<T> | undefined> => {
    if (timeoutId !== null || maxTimeoutId !== null) {
      cancelTimer();
      cancelMaxTimer();
      return invokeFunc();
    }
    return result;
  };

  debouncedFunc.pending = (): boolean => {
    return timeoutId !== null || maxTimeoutId !== null;
  };

  debouncedFunc.callCount = (): number => {
    return callCount;
  };

  return debouncedFunc;
}

// =====================
// Main Hook
// =====================

/**
 * Hook for creating debounced IPC operations
 *
 * @example
 * ```tsx
 * const { debouncedSearch, cancelSearch, searchPending } = useDebounceIPC({
 *   operation: 'search',
 *   delay: 300
 * });
 *
 * // Usage in component
 * const handleSearch = useCallback(async (query: string) => {
 *   const results = await debouncedSearch(query);
 *   setSearchResults(results);
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounceIPC(options: DebounceOptions = {}) {
  const {
    operation = 'search',
    delay,
    mode,
    maxWait,
    immediate,
    key,
    cancelPrevious = true
  } = options;

  // Get configuration
  const config = useMemo(() => {
    const baseConfig = DEFAULT_CONFIGS[operation];
    return {
      ...baseConfig,
      ...(delay !== undefined && { delay }),
      ...(mode !== undefined && { mode }),
      ...(maxWait !== undefined && { maxWait }),
      ...(immediate !== undefined && { immediate }),
    };
  }, [operation, delay, mode, maxWait, immediate]);

  // Store active operations
  const activeOperations = useRef(new Map<string, DebouncedFunction<any>>());

  // Helper to get or create debounced function
  const getDebouncedFunction = useCallback(<T extends (...args: any[]) => Promise<any>>(
    func: T,
    operationKey: string = 'default'
  ): DebouncedFunction<T> => {
    const fullKey = key ? `${key}-${operationKey}` : operationKey;

    if (cancelPrevious && activeOperations.current.has(fullKey)) {
      activeOperations.current.get(fullKey)?.cancel();
    }

    const debouncedFunc = createDebouncedFunction(func, config);
    activeOperations.current.set(fullKey, debouncedFunc);

    return debouncedFunc;
  }, [config, key, cancelPrevious]);

  // =====================
  // Search Operations
  // =====================

  const debouncedSearchLocal = useMemo(() =>
    getDebouncedFunction(
      (query: string, searchOptions?: SearchQuery) =>
        ipcBridge.searchLocal(query, searchOptions),
      'searchLocal'
    ), [getDebouncedFunction]
  );

  const debouncedSearchAI = useMemo(() =>
    getDebouncedFunction(
      (query: string, searchOptions?: SearchQuery) =>
        ipcBridge.searchWithAI(query, searchOptions),
      'searchAI'
    ), [getDebouncedFunction]
  );

  // =====================
  // Entry Operations
  // =====================

  const debouncedAddEntry = useMemo(() =>
    getDebouncedFunction(
      (entry: KBEntryInput) => ipcBridge.addKBEntry(entry),
      'addEntry'
    ), [getDebouncedFunction]
  );

  const debouncedUpdateEntry = useMemo(() =>
    getDebouncedFunction(
      (id: string, updates: KBEntryUpdate) => ipcBridge.updateKBEntry(id, updates),
      'updateEntry'
    ), [getDebouncedFunction]
  );

  const debouncedRateEntry = useMemo(() =>
    getDebouncedFunction(
      (id: string, successful: boolean, comment?: string) =>
        ipcBridge.rateEntry(id, successful, comment),
      'rateEntry'
    ), [getDebouncedFunction]
  );

  // =====================
  // System Operations
  // =====================

  const debouncedGetMetrics = useMemo(() =>
    getDebouncedFunction(
      () => ipcBridge.getMetrics(),
      'metrics'
    ), [getDebouncedFunction]
  );

  // =====================
  // Generic Operations
  // =====================

  const createDebouncedOperation = useCallback(<T extends (...args: any[]) => Promise<any>>(
    func: T,
    operationKey?: string
  ): DebouncedFunction<T> => {
    return getDebouncedFunction(func, operationKey);
  }, [getDebouncedFunction]);

  // =====================
  // Control Functions
  // =====================

  const cancelOperation = useCallback((operationKey: string = 'default') => {
    const fullKey = key ? `${key}-${operationKey}` : operationKey;
    const operation = activeOperations.current.get(fullKey);
    if (operation) {
      operation.cancel();
      activeOperations.current.delete(fullKey);
    }
  }, [key]);

  const cancelAllOperations = useCallback(() => {
    activeOperations.current.forEach((operation) => {
      operation.cancel();
    });
    activeOperations.current.clear();
  }, []);

  const flushOperation = useCallback(async (operationKey: string = 'default') => {
    const fullKey = key ? `${key}-${operationKey}` : operationKey;
    const operation = activeOperations.current.get(fullKey);
    return operation?.flush();
  }, [key]);

  const isOperationPending = useCallback((operationKey: string = 'default') => {
    const fullKey = key ? `${key}-${operationKey}` : operationKey;
    const operation = activeOperations.current.get(fullKey);
    return operation?.pending() || false;
  }, [key]);

  const getOperationStats = useCallback(() => {
    const stats = new Map<string, { callCount: number; pending: boolean }>();
    activeOperations.current.forEach((operation, key) => {
      stats.set(key, {
        callCount: operation.callCount(),
        pending: operation.pending()
      });
    });
    return stats;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllOperations();
    };
  }, [cancelAllOperations]);

  return {
    // Pre-configured operations
    debouncedSearchLocal,
    debouncedSearchAI,
    debouncedAddEntry,
    debouncedUpdateEntry,
    debouncedRateEntry,
    debouncedGetMetrics,

    // Generic operation creator
    createDebouncedOperation,

    // Control functions
    cancelOperation,
    cancelAllOperations,
    flushOperation,
    isOperationPending,
    getOperationStats,

    // Configuration
    config,

    // Utility checks
    searchPending: isOperationPending('searchLocal') || isOperationPending('searchAI'),
    metricsPending: isOperationPending('metrics'),
    entryOpsPending: isOperationPending('addEntry') ||
                     isOperationPending('updateEntry') ||
                     isOperationPending('rateEntry')
  };
}

export default useDebounceIPC;