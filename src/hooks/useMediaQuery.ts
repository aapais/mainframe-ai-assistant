/**
 * useMediaQuery Hook
 *
 * Custom media query hook with SSR support and performance optimizations
 * Optimized for Electron environment
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// =========================
// TYPE DEFINITIONS
// =========================

export interface MediaQueryOptions {
  /** Initial value for SSR */
  defaultValue?: boolean;
  /** Initialize immediately on mount */
  initializeOnMount?: boolean;
  /** Custom MediaQueryList for testing */
  query?: string;
  /** Enable console debugging */
  debug?: boolean;
}

export interface MediaQueryResult {
  /** Whether the media query matches */
  matches: boolean;
  /** Media query string */
  query: string;
  /** Whether the query is supported */
  isSupported: boolean;
  /** Force a re-evaluation of the query */
  refetch: () => void;
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Check if window is available (SSR safety)
 */
const isClient = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * Check if MediaQueryList is supported
 */
const isMediaQuerySupported = (): boolean => {
  return isClient() && typeof window.matchMedia === 'function';
};

/**
 * Get MediaQueryList safely
 */
const getMediaQueryList = (query: string): MediaQueryList | null => {
  if (!isMediaQuerySupported()) return null;

  try {
    return window.matchMedia(query);
  } catch (error) {
    console.warn(`Invalid media query: ${query}`, error);
    return null;
  }
};

// =========================
// MAIN HOOK
// =========================

/**
 * useMediaQuery Hook
 *
 * Provides reactive media query functionality with SSR support
 *
 * @param query - CSS media query string
 * @param options - Configuration options
 * @returns MediaQueryResult with current match state
 *
 * @example
 * ```tsx
 * const { matches } = useMediaQuery('(min-width: 768px)');
 *
 * const { matches: isDark } = useMediaQuery(
 *   '(prefers-color-scheme: dark)',
 *   { defaultValue: false }
 * );
 *
 * const { matches: isLarge, refetch } = useMediaQuery('(min-width: 1024px)', {
 *   initializeOnMount: false
 * });
 * ```
 */
export const useMediaQuery = (
  query: string,
  options: MediaQueryOptions = {}
): MediaQueryResult => {
  const {
    defaultValue = false,
    initializeOnMount = true,
    debug = false,
  } = options;

  // Refs for cleanup
  const mediaQueryListRef = useRef<MediaQueryList | null>(null);
  const listenerRef = useRef<((e: MediaQueryListEvent) => void) | null>(null);

  // Initialize state with SSR-safe default
  const [matches, setMatches] = useState(() => {
    if (!isClient() || !initializeOnMount) {
      return defaultValue;
    }

    const mql = getMediaQueryList(query);
    return mql?.matches ?? defaultValue;
  });

  const [isSupported, setIsSupported] = useState(() => {
    return isMediaQuerySupported();
  });

  // Memoized listener function
  const handleChange = useCallback((event: MediaQueryListEvent) => {
    if (debug) {
      console.log(`Media query "${query}" changed:`, {
        matches: event.matches,
        query: query,
        timestamp: new Date().toISOString(),
      });
    }

    setMatches(event.matches);
  }, [query, debug]);

  // Manual refetch function
  const refetch = useCallback(() => {
    if (!isMediaQuerySupported()) return;

    const mql = getMediaQueryList(query);
    if (mql) {
      setMatches(mql.matches);

      if (debug) {
        console.log(`Media query "${query}" refetched:`, {
          matches: mql.matches,
          query: query,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [query, debug]);

  // Effect for setting up and cleaning up media query listener
  useEffect(() => {
    if (!isClient()) return;

    // Check if media query is supported
    const supported = isMediaQuerySupported();
    setIsSupported(supported);

    if (!supported) {
      if (debug) {
        console.warn(`MediaQuery not supported, using default value: ${defaultValue}`);
      }
      setMatches(defaultValue);
      return;
    }

    // Get MediaQueryList
    const mql = getMediaQueryList(query);
    if (!mql) {
      setMatches(defaultValue);
      return;
    }

    // Store reference for cleanup
    mediaQueryListRef.current = mql;

    // Set initial value
    setMatches(mql.matches);

    if (debug) {
      console.log(`Media query "${query}" initialized:`, {
        matches: mql.matches,
        query: query,
        timestamp: new Date().toISOString(),
      });
    }

    // Set up listener
    const listener = (event: MediaQueryListEvent) => handleChange(event);
    listenerRef.current = listener;

    // Add listener with proper method detection
    if (mql.addEventListener) {
      mql.addEventListener('change', listener);
    } else {
      // Fallback for older browsers
      (mql as any).addListener(listener);
    }

    // Cleanup function
    return () => {
      const currentMql = mediaQueryListRef.current;
      const currentListener = listenerRef.current;

      if (currentMql && currentListener) {
        if (currentMql.removeEventListener) {
          currentMql.removeEventListener('change', currentListener);
        } else {
          // Fallback for older browsers
          (currentMql as any).removeListener(currentListener);
        }
      }

      // Clear references
      mediaQueryListRef.current = null;
      listenerRef.current = null;

      if (debug) {
        console.log(`Media query "${query}" cleaned up`);
      }
    };
  }, [query, defaultValue, handleChange, debug]);

  // Effect for handling window load (for Electron)
  useEffect(() => {
    if (!isClient()) return;

    const handleLoad = () => {
      // Refetch on window load to ensure accurate initial values
      refetch();
    };

    if (document.readyState === 'loading') {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    } else {
      // Document already loaded, refetch immediately
      refetch();
    }
  }, [refetch]);

  return {
    matches,
    query,
    isSupported,
    refetch,
  };
};

// =========================
// CONVENIENCE HOOKS
// =========================

/**
 * Hook for dark mode preference
 */
export const useDarkMode = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(prefers-color-scheme: dark)', {
    defaultValue: false,
    ...options,
  });
};

/**
 * Hook for reduced motion preference
 */
export const useReducedMotion = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(prefers-reduced-motion: reduce)', {
    defaultValue: false,
    ...options,
  });
};

/**
 * Hook for high contrast preference
 */
export const useHighContrast = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(prefers-contrast: high)', {
    defaultValue: false,
    ...options,
  });
};

/**
 * Hook for hover capability
 */
export const useHover = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(hover: hover)', {
    defaultValue: true, // Default to true for desktop-first approach
    ...options,
  });
};

/**
 * Hook for pointer precision
 */
export const useFinePointer = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(pointer: fine)', {
    defaultValue: true,
    ...options,
  });
};

/**
 * Hook for landscape orientation
 */
export const useLandscape = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(orientation: landscape)', {
    defaultValue: true,
    ...options,
  });
};

/**
 * Hook for portrait orientation
 */
export const usePortrait = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(orientation: portrait)', {
    defaultValue: false,
    ...options,
  });
};

// =========================
// BREAKPOINT HOOKS
// =========================

/**
 * Standard breakpoint hooks
 */
export const useSmallScreen = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(max-width: 639px)', options);
};

export const useMediumScreen = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(min-width: 640px) and (max-width: 767px)', options);
};

export const useLargeScreen = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(min-width: 768px)', options);
};

export const useExtraLargeScreen = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(min-width: 1024px)', options);
};

// =========================
// UTILITY HOOKS
// =========================

/**
 * Hook for multiple media queries
 */
export const useMediaQueries = (queries: Record<string, string>, options?: MediaQueryOptions) => {
  const results: Record<string, MediaQueryResult> = {};

  Object.entries(queries).forEach(([key, query]) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[key] = useMediaQuery(query, options);
  });

  return results;
};

/**
 * Hook to detect print media
 */
export const usePrint = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('print', {
    defaultValue: false,
    ...options,
  });
};

/**
 * Hook for screen readers or accessibility tools
 */
export const useScreenReader = (options?: Omit<MediaQueryOptions, 'query'>) => {
  return useMediaQuery('(speech)', {
    defaultValue: false,
    ...options,
  });
};

export default useMediaQuery;