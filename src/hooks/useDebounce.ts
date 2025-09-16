/**
 * useDebounce Hook
 *
 * Optimized debounce hook for search input performance.
 * Prevents excessive API calls and improves user experience.
 *
 * Performance targets:
 * - Zero unnecessary re-renders
 * - Automatic cleanup on unmount
 * - Configurable delay with smart defaults
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface DebounceOptions {
  /** Delay in milliseconds (default: 300ms) */
  delay?: number;
  /** Maximum delay before forcing execution (default: 1000ms) */
  maxWait?: number;
  /** Execute immediately on first call (default: false) */
  leading?: boolean;
  /** Execute on trailing edge (default: true) */
  trailing?: boolean;
}

/**
 * Hook for debouncing values with advanced options
 */
export function useDebounce<T>(
  value: T,
  options: DebounceOptions = {}
): [T, boolean] {
  const {
    delay = 300,
    maxWait = 1000,
    leading = false,
    trailing = true
  } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCallTime = useRef<number>(0);
  const lastArgs = useRef<T>(value);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = undefined;
    }
  }, []);

  // Execute the debounced action
  const execute = useCallback(() => {
    setDebouncedValue(lastArgs.current);
    setIsDebouncing(false);
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    lastArgs.current = value;
    const now = Date.now();

    // Handle leading edge execution
    if (leading && lastCallTime.current === 0) {
      setDebouncedValue(value);
      lastCallTime.current = now;
      return;
    }

    // Set debouncing state
    setIsDebouncing(true);

    // Setup maxWait timeout if specified
    if (maxWait > 0 && !maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        execute();
      }, maxWait);
    }

    // Setup main debounce timeout
    cleanup();

    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        execute();
      }, delay);
    }

    lastCallTime.current = now;

    return cleanup;
  }, [value, delay, maxWait, leading, trailing, execute, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return [debouncedValue, isDebouncing];
}

/**
 * Hook for debouncing callback functions
 */
export function useDebouncedCallback<TArgs extends any[]>(
  callback: (...args: TArgs) => void,
  options: DebounceOptions = {}
): [(...args: TArgs) => void, () => void, boolean] {
  const {
    delay = 300,
    maxWait = 1000,
    leading = false,
    trailing = true
  } = options;

  const [isDebouncing, setIsDebouncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);
  const lastArgs = useRef<TArgs>();

  // Keep callback reference current
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = undefined;
    }
    setIsDebouncing(false);
  }, []);

  // Execute the callback
  const execute = useCallback(() => {
    if (lastArgs.current) {
      callbackRef.current(...lastArgs.current);
    }
    cleanup();
  }, [cleanup]);

  // Cancel any pending execution
  const cancel = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Debounced function
  const debouncedCallback = useCallback((...args: TArgs) => {
    lastArgs.current = args;

    // Handle leading edge execution
    if (leading && !timeoutRef.current && !maxTimeoutRef.current) {
      callbackRef.current(...args);
      setIsDebouncing(true);
    } else {
      setIsDebouncing(true);
    }

    // Setup maxWait timeout if specified
    if (maxWait > 0 && !maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        execute();
      }, maxWait);
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Setup new timeout
    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        execute();
      }, delay);
    }
  }, [delay, maxWait, leading, trailing, execute]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return [debouncedCallback, cancel, isDebouncing];
}

/**
 * Hook for debouncing async operations
 */
export function useDebouncedAsync<T, TArgs extends any[]>(
  asyncFn: (...args: TArgs) => Promise<T>,
  options: DebounceOptions = {}
): {
  execute: (...args: TArgs) => Promise<T>;
  cancel: () => void;
  isLoading: boolean;
  error: Error | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortController = useRef<AbortController>();

  const [debouncedExecute, cancel] = useDebouncedCallback(
    async (...args: TArgs) => {
      // Cancel previous request if still pending
      if (abortController.current) {
        abortController.current.abort();
      }

      // Create new abort controller
      abortController.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        const result = await asyncFn(...args);

        // Check if request was aborted
        if (!abortController.current?.signal.aborted) {
          return result;
        }
      } catch (err) {
        if (!abortController.current?.signal.aborted) {
          const error = err instanceof Error ? err : new Error('Unknown error');
          setError(error);
          throw error;
        }
      } finally {
        if (!abortController.current?.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    options
  );

  const cancelAll = useCallback(() => {
    cancel();
    if (abortController.current) {
      abortController.current.abort();
    }
    setIsLoading(false);
    setError(null);
  }, [cancel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return {
    execute: debouncedExecute,
    cancel: cancelAll,
    isLoading,
    error
  };
}