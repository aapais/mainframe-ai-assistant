/**
 * Smart Debounce Hook for Enhanced Search Experience
 *
 * Implements intelligent debouncing with different timing for:
 * - Autocomplete suggestions (150ms)
 * - Full search execution (300ms)
 * - API calls cancellation
 * - Immediate execution on Enter key
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SmartDebounceOptions {
  /** Delay for autocomplete suggestions (default: 150ms) */
  autocompleteDelay?: number;
  /** Delay for full search execution (default: 300ms) */
  searchDelay?: number;
  /** Minimum query length for autocomplete (default: 2) */
  minQueryLength?: number;
  /** Minimum query length for search (default: 1) */
  minSearchLength?: number;
  /** Whether to enable immediate execution on certain triggers */
  enableImmediateExecution?: boolean;
  /** Whether to debounce on leading edge */
  leading?: boolean;
  /** Whether to debounce on trailing edge */
  trailing?: boolean;
  /** Maximum delay before forcing execution */
  maxDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface SmartDebounceReturn<T> {
  /** The current debounced value */
  debouncedValue: T;
  /** The autocomplete debounced value (faster) */
  autocompleteValue: T;
  /** Whether autocomplete debounce is pending */
  isAutocompletePending: boolean;
  /** Whether search debounce is pending */
  isSearchPending: boolean;
  /** Whether any debounce is pending */
  isPending: boolean;
  /** Cancel all pending debounced calls */
  cancel: () => void;
  /** Force immediate execution of search */
  flush: () => void;
  /** Execute autocomplete immediately */
  flushAutocomplete: () => void;
  /** Update value immediately (bypass all debouncing) */
  updateImmediate: (newValue: T) => void;
  /** Manually trigger search debounce */
  triggerSearch: () => void;
  /** Manually trigger autocomplete debounce */
  triggerAutocomplete: () => void;
}

/**
 * Smart debounce hook that provides different timing for autocomplete and search
 */
export function useSmartDebounce<T>(
  value: T,
  options: SmartDebounceOptions = {}
): SmartDebounceReturn<T> {
  const {
    autocompleteDelay = 150,
    searchDelay = 300,
    minQueryLength = 2,
    minSearchLength = 1,
    enableImmediateExecution = true,
    leading = false,
    trailing = true,
    maxDelay,
    debug = false
  } = options;

  // State
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [autocompleteValue, setAutocompleteValue] = useState<T>(value);
  const [isAutocompletePending, setIsAutocompletePending] = useState(false);
  const [isSearchPending, setIsSearchPending] = useState(false);

  // Refs for managing timers and state
  const autocompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousValueRef = useRef<T>(value);
  const mountedRef = useRef(true);
  const immediateExecutedRef = useRef(false);

  // Logging helper
  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[SmartDebounce] ${message}`, ...args);
    }
  }, [debug]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }
    };
  }, []);

  // Safe state update helper
  const safeSetState = useCallback((
    setter: React.Dispatch<React.SetStateAction<any>>,
    value: any
  ) => {
    if (mountedRef.current) {
      setter(value);
    }
  }, []);

  // Cancel all pending operations
  const cancel = useCallback(() => {
    log('Cancelling all pending operations');

    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
      autocompleteTimeoutRef.current = null;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }

    safeSetState(setIsAutocompletePending, false);
    safeSetState(setIsSearchPending, false);
  }, [log, safeSetState]);

  // Force immediate execution of search
  const flush = useCallback(() => {
    log('Flushing search immediately');
    cancel();
    if (mountedRef.current) {
      setDebouncedValue(previousValueRef.current);
      setIsSearchPending(false);
    }
  }, [cancel, log]);

  // Force immediate execution of autocomplete
  const flushAutocomplete = useCallback(() => {
    log('Flushing autocomplete immediately');
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
      autocompleteTimeoutRef.current = null;
    }
    if (mountedRef.current) {
      setAutocompleteValue(previousValueRef.current);
      setIsAutocompletePending(false);
    }
  }, [log]);

  // Update immediately (bypass all debouncing)
  const updateImmediate = useCallback((newValue: T) => {
    log('Updating immediately:', newValue);
    cancel();
    previousValueRef.current = newValue;
    if (mountedRef.current) {
      setDebouncedValue(newValue);
      setAutocompleteValue(newValue);
      setIsAutocompletePending(false);
      setIsSearchPending(false);
    }
  }, [cancel, log]);

  // Trigger search debounce manually
  const triggerSearch = useCallback(() => {
    log('Manually triggering search debounce');

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    safeSetState(setIsSearchPending, true);

    searchTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && trailing) {
        log('Search debounce completed');
        setDebouncedValue(previousValueRef.current);
        setIsSearchPending(false);
      }
      searchTimeoutRef.current = null;
    }, searchDelay);
  }, [searchDelay, trailing, log, safeSetState]);

  // Trigger autocomplete debounce manually
  const triggerAutocomplete = useCallback(() => {
    log('Manually triggering autocomplete debounce');

    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }

    safeSetState(setIsAutocompletePending, true);

    autocompleteTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && trailing) {
        log('Autocomplete debounce completed');
        setAutocompleteValue(previousValueRef.current);
        setIsAutocompletePending(false);
      }
      autocompleteTimeoutRef.current = null;
    }, autocompleteDelay);
  }, [autocompleteDelay, trailing, log, safeSetState]);

  // Check if value meets minimum length requirements
  const getValueLength = useCallback((val: T): number => {
    if (typeof val === 'string') {
      return val.trim().length;
    }
    return 0;
  }, []);

  // Main debounce effect
  useEffect(() => {
    // Skip if value hasn't changed
    if (value === previousValueRef.current) {
      return;
    }

    const valueLength = getValueLength(value);
    log('Value changed:', { value, length: valueLength });

    previousValueRef.current = value;

    // Handle immediate execution on first call
    if (enableImmediateExecution && !immediateExecutedRef.current) {
      immediateExecutedRef.current = true;
      log('Immediate execution on first call');
      setDebouncedValue(value);
      setAutocompleteValue(value);
      return;
    }

    // Handle leading edge execution
    if (leading && !autocompleteTimeoutRef.current && !searchTimeoutRef.current) {
      log('Leading edge execution');
      if (valueLength >= minQueryLength) {
        setAutocompleteValue(value);
      }
      if (valueLength >= minSearchLength) {
        setDebouncedValue(value);
      }
      if (!trailing) {
        return;
      }
    }

    // Clear existing timeouts
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set up autocomplete debounce if value meets minimum length
    if (valueLength >= minQueryLength) {
      log('Setting up autocomplete debounce');
      safeSetState(setIsAutocompletePending, true);

      autocompleteTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && trailing) {
          log('Autocomplete debounce triggered');
          setAutocompleteValue(previousValueRef.current);
          setIsAutocompletePending(false);
        }
        autocompleteTimeoutRef.current = null;
      }, autocompleteDelay);
    } else {
      // Clear autocomplete value if below minimum length
      if (valueLength === 0) {
        log('Clearing autocomplete value');
        setAutocompleteValue(value);
      }
    }

    // Set up search debounce if value meets minimum length
    if (valueLength >= minSearchLength) {
      log('Setting up search debounce');
      safeSetState(setIsSearchPending, true);

      searchTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && trailing) {
          log('Search debounce triggered');
          setDebouncedValue(previousValueRef.current);
          setIsSearchPending(false);
        }
        searchTimeoutRef.current = null;
      }, searchDelay);
    } else {
      // Clear search value if below minimum length
      if (valueLength === 0) {
        log('Clearing search value');
        setDebouncedValue(value);
      }
    }

    // Set up max delay timeout (prevents infinite delays)
    if (maxDelay && maxDelay > Math.max(autocompleteDelay, searchDelay)) {
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }

      maxTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          log('Max delay reached, forcing update');
          setDebouncedValue(previousValueRef.current);
          setAutocompleteValue(previousValueRef.current);
          setIsAutocompletePending(false);
          setIsSearchPending(false);
          cancel();
        }
        maxTimeoutRef.current = null;
      }, maxDelay);
    }

    // Cleanup function
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
        autocompleteTimeoutRef.current = null;
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [
    value,
    autocompleteDelay,
    searchDelay,
    minQueryLength,
    minSearchLength,
    enableImmediateExecution,
    leading,
    trailing,
    maxDelay,
    cancel,
    getValueLength,
    log,
    safeSetState
  ]);

  return {
    debouncedValue,
    autocompleteValue,
    isAutocompletePending,
    isSearchPending,
    isPending: isAutocompletePending || isSearchPending,
    cancel,
    flush,
    flushAutocomplete,
    updateImmediate,
    triggerSearch,
    triggerAutocomplete
  };
}

/**
 * Specialized hook for search inputs with smart debouncing
 */
export function useSearchDebounce(
  query: string,
  options: Omit<SmartDebounceOptions, 'minQueryLength' | 'minSearchLength'> & {
    minQueryLength?: number;
    minSearchLength?: number;
  } = {}
) {
  return useSmartDebounce(query, {
    autocompleteDelay: 150,
    searchDelay: 300,
    minQueryLength: 2,
    minSearchLength: 1,
    enableImmediateExecution: true,
    ...options
  });
}

export default useSmartDebounce;