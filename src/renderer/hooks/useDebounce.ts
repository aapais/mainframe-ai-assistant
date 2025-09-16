/**
 * useDebounce Hook
 *
 * A React hook that debounces a value by delaying its update until after a specified delay.
 * Useful for search inputs, API calls, and other scenarios where you want to limit
 * the frequency of updates.
 *
 * Features:
 * - Configurable delay with reasonable default
 * - TypeScript support for any value type
 * - Cleanup handling for unmounted components
 * - Performance optimized with useCallback and useRef
 * - Optional immediate execution for first call
 * - Cancel functionality for pending debounced calls
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// =====================
// Types & Interfaces
// =====================

export interface UseDebounceOptions {
  /** Delay in milliseconds before the value is updated */
  delay?: number;
  /** Whether to execute immediately on first call */
  immediate?: boolean;
  /** Maximum delay before forcing an update (prevents infinite delays) */
  maxDelay?: number;
  /** Whether to update on leading edge (immediately) or trailing edge (after delay) */
  leading?: boolean;
  /** Whether to update on trailing edge (after delay) */
  trailing?: boolean;
}

export interface UseDebounceReturn<T> {
  /** The debounced value */
  debouncedValue: T;
  /** Whether a debounced update is pending */
  isPending: boolean;
  /** Cancel any pending debounced update */
  cancel: () => void;
  /** Force immediate update of debounced value */
  flush: () => void;
  /** Update the value immediately (bypasses debounce) */
  updateImmediate: (newValue: T) => void;
}

// =====================
// Main Hook
// =====================

/**
 * Debounces a value, delaying its update until after the specified delay
 *
 * @param value The value to debounce
 * @param delay Delay in milliseconds (default: 300)
 * @param options Additional options for debouncing behavior
 * @returns Object with debounced value and control methods
 */
export function useDebounce<T>(
  value: T,
  delay: number = 300,
  options: UseDebounceOptions = {}
): T;

export function useDebounce<T>(
  value: T,
  options: UseDebounceOptions
): T;

export function useDebounce<T>(
  value: T,
  delayOrOptions: number | UseDebounceOptions = 300,
  optionsParam: UseDebounceOptions = {}
): T {
  // Handle overloaded parameters
  const delay = typeof delayOrOptions === 'number' ? delayOrOptions : delayOrOptions.delay || 300;
  const options = typeof delayOrOptions === 'number' ? optionsParam : delayOrOptions;

  const {
    immediate = false,
    maxDelay,
    leading = false,
    trailing = true
  } = options;

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isPending, setIsPending] = useState(false);

  // Refs for managing timers and state
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef<T>(value);
  const mountedRef = useRef(true);
  const immediateExecutedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }
    };
  }, []);

  // Cancel any pending updates
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    setIsPending(false);
  }, []);

  // Force immediate update
  const flush = useCallback(() => {
    cancel();
    if (mountedRef.current) {
      setDebouncedValue(previousValueRef.current);
      setIsPending(false);
    }
  }, [cancel]);

  // Update immediately (bypass debounce)
  const updateImmediate = useCallback((newValue: T) => {
    cancel();
    previousValueRef.current = newValue;
    if (mountedRef.current) {
      setDebouncedValue(newValue);
      setIsPending(false);
    }
  }, [cancel]);

  // Main debounce effect
  useEffect(() => {
    // Skip if value hasn't changed
    if (value === previousValueRef.current) {
      return;
    }

    previousValueRef.current = value;

    // Handle immediate execution on first call
    if (immediate && !immediateExecutedRef.current) {
      immediateExecutedRef.current = true;
      setDebouncedValue(value);
      return;
    }

    // Handle leading edge execution
    if (leading && !timeoutRef.current) {
      setDebouncedValue(value);
      if (!trailing) {
        return; // Don't set up trailing timeout if trailing is false
      }
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set pending state
    setIsPending(true);

    // Set up main debounce timeout
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current && trailing) {
        setDebouncedValue(previousValueRef.current);
        setIsPending(false);
      }
      timeoutRef.current = null;
    }, delay);

    // Set up max delay timeout (prevents infinite delays)
    if (maxDelay && maxDelay > delay) {
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }

      maxTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setDebouncedValue(previousValueRef.current);
          setIsPending(false);
          cancel();
        }
        maxTimeoutRef.current = null;
      }, maxDelay);
    }

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay, immediate, maxDelay, leading, trailing, cancel]);

  return debouncedValue;
}

// =====================
// Advanced Debounce Hook
// =====================

/**
 * Advanced debounce hook that returns additional control methods
 *
 * @param value The value to debounce
 * @param delay Delay in milliseconds
 * @param options Additional options
 * @returns Object with debounced value and control methods
 */
export function useAdvancedDebounce<T>(
  value: T,
  delay: number = 300,
  options: UseDebounceOptions = {}
): UseDebounceReturn<T> {
  const debouncedValue = useDebounce(value, delay, options);
  const [isPending, setIsPending] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef<T>(value);
  const [internalValue, setInternalValue] = useState<T>(value);

  // Update refs when value changes
  useEffect(() => {
    valueRef.current = value;

    // Set pending state if value changed
    if (value !== internalValue) {
      setIsPending(true);
    }
  }, [value, internalValue]);

  // Update internal value when debounced value changes
  useEffect(() => {
    setInternalValue(debouncedValue);
    setIsPending(false);
  }, [debouncedValue]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPending(false);
  }, []);

  const flush = useCallback(() => {
    cancel();
    setInternalValue(valueRef.current);
    setIsPending(false);
  }, [cancel]);

  const updateImmediate = useCallback((newValue: T) => {
    cancel();
    valueRef.current = newValue;
    setInternalValue(newValue);
    setIsPending(false);
  }, [cancel]);

  return {
    debouncedValue,
    isPending,
    cancel,
    flush,
    updateImmediate
  };
}

// =====================
// Specialized Hooks
// =====================

/**
 * Debounced search hook optimized for search inputs
 *
 * @param searchQuery The search query to debounce
 * @param delay Delay in milliseconds (default: 300)
 * @returns The debounced search query
 */
export function useDebouncedSearch(
  searchQuery: string,
  delay: number = 300
): string {
  return useDebounce(searchQuery, {
    delay,
    leading: false,
    trailing: true,
    maxDelay: delay * 3 // Prevent searches from being delayed too long
  });
}

/**
 * Debounced API call hook with loading state
 *
 * @param query The query to debounce
 * @param delay Delay in milliseconds (default: 500)
 * @returns Object with debounced query and loading state
 */
export function useDebouncedAPI<T>(
  query: T,
  delay: number = 500
): { debouncedQuery: T; isDebouncing: boolean } {
  const { debouncedValue, isPending } = useAdvancedDebounce(query, delay, {
    leading: false,
    trailing: true,
    maxDelay: delay * 2
  });

  return {
    debouncedQuery: debouncedValue,
    isDebouncing: isPending
  };
}

/**
 * Debounced form validation hook
 *
 * @param formData Form data to validate
 * @param delay Delay in milliseconds (default: 200)
 * @returns Debounced form data for validation
 */
export function useDebouncedValidation<T>(
  formData: T,
  delay: number = 200
): T {
  return useDebounce(formData, {
    delay,
    leading: false,
    trailing: true,
    immediate: false
  });
}

// =====================
// Utility Functions
// =====================

/**
 * Creates a debounced callback function
 *
 * @param callback The callback to debounce
 * @param delay Delay in milliseconds
 * @param options Debounce options
 * @returns Debounced callback function
 */
export function createDebouncedCallback<TArgs extends any[], TReturn>(
  callback: (...args: TArgs) => TReturn,
  delay: number = 300,
  options: UseDebounceOptions = {}
): {
  debouncedCallback: (...args: TArgs) => void;
  cancel: () => void;
  flush: (...args: TArgs) => TReturn;
} {
  const { leading = false, trailing = true, maxDelay } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let maxTimeoutId: NodeJS.Timeout | null = null;
  let lastArgs: TArgs | null = null;

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
    lastArgs = null;
  };

  const flush = (...args: TArgs): TReturn => {
    cancel();
    return callback(...args);
  };

  const debouncedCallback = (...args: TArgs) => {
    lastArgs = args;

    // Handle leading edge
    if (leading && !timeoutId) {
      callback(...args);
      if (!trailing) return;
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set main timeout
    timeoutId = setTimeout(() => {
      if (trailing && lastArgs) {
        callback(...lastArgs);
      }
      timeoutId = null;
      lastArgs = null;
    }, delay);

    // Set max delay timeout
    if (maxDelay && maxDelay > delay && !maxTimeoutId) {
      maxTimeoutId = setTimeout(() => {
        if (lastArgs) {
          callback(...lastArgs);
          cancel();
        }
      }, maxDelay);
    }
  };

  return {
    debouncedCallback,
    cancel,
    flush
  };
}

export default useDebounce;