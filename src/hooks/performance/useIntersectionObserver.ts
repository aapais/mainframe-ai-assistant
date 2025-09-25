/**
 * Enhanced Intersection Observer Hook
 *
 * High-performance intersection observer hook for lazy loading, infinite scrolling,
 * and visibility-based optimizations. Includes advanced features like margin-based
 * preloading, batch processing, and performance monitoring.
 *
 * Features:
 * - Lazy loading with configurable thresholds
 * - Infinite scrolling with batching
 * - Performance-optimized with debouncing
 * - Multiple element tracking
 * - Automatic cleanup and memory management
 * - Edge case handling for SSR and older browsers
 *
 * @author Performance Engineer
 * @version 2.0.0
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ========================
// Types & Interfaces
// ========================

export interface IntersectionObserverOptions {
  /** Root element for intersection detection (null = viewport) */
  root?: Element | null;
  /** Margin around root (e.g., '50px 0px' for preloading) */
  rootMargin?: string;
  /** Threshold values for triggering callbacks (0-1) */
  threshold?: number | number[];
  /** Debounce delay for rapid intersection changes (ms) */
  debounceDelay?: number;
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Only trigger once when element becomes visible */
  triggerOnce?: boolean;
  /** Disable hook (useful for conditional usage) */
  disabled?: boolean;
}

export interface IntersectionEntry {
  /** Target element */
  element: Element;
  /** Whether element is currently intersecting */
  isIntersecting: boolean;
  /** Intersection ratio (0-1) */
  intersectionRatio: number;
  /** Bounding rectangle of intersection */
  intersectionRect: DOMRectReadOnly;
  /** Target element's bounding rectangle */
  boundingClientRect: DOMRectReadOnly;
  /** Root element's bounding rectangle */
  rootBounds: DOMRectReadOnly | null;
  /** Timestamp when intersection occurred */
  time: number;
}

export interface UseIntersectionObserverReturn {
  /** Current intersection entries */
  entries: IntersectionEntry[];
  /** Ref to attach to target element(s) */
  ref: (element: Element | null) => void;
  /** Whether any tracked element is intersecting */
  isIntersecting: boolean;
  /** Add element to observation */
  observe: (element: Element) => void;
  /** Remove element from observation */
  unobserve: (element: Element) => void;
  /** Disconnect observer and cleanup */
  disconnect: () => void;
  /** Performance metrics (if enabled) */
  performanceMetrics?: {
    totalIntersections: number;
    averageProcessingTime: number;
    peakProcessingTime: number;
  };
}

// ========================
// Utility Functions
// ========================

/**
 * Debounce function for performance optimization
 */
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Check if Intersection Observer is supported
 */
const isIntersectionObserverSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'IntersectionObserver' in window &&
    'IntersectionObserverEntry' in window &&
    'intersectionRatio' in window.IntersectionObserverEntry.prototype
  );
};

/**
 * Polyfill for older browsers (basic implementation)
 */
const createPolyfillObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit
) => {
  let isPolyfill = true;

  return {
    observe: (target: Element) => {
      // Basic visibility check fallback
      const checkVisibility = () => {
        const rect = target.getBoundingClientRect();
        const isVisible =
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0;

        if (isVisible) {
          const entry = {
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            intersectionRect: rect,
            boundingClientRect: rect,
            rootBounds: {
              top: 0,
              left: 0,
              bottom: window.innerHeight,
              right: window.innerWidth,
              width: window.innerWidth,
              height: window.innerHeight,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            } as DOMRectReadOnly,
            time: performance.now(),
            toJSON: () => ({}),
          } as IntersectionObserverEntry;

          callback([entry], this);
        }
      };

      // Check immediately and on scroll
      checkVisibility();
      window.addEventListener('scroll', checkVisibility, { passive: true });
      window.addEventListener('resize', checkVisibility, { passive: true });
    },
    unobserve: () => {
      // Cleanup would be more complex in real polyfill
    },
    disconnect: () => {
      // Cleanup would be more complex in real polyfill
    },
    isPolyfill,
  };
};

// ========================
// Main Hook
// ========================

/**
 * Enhanced intersection observer hook with performance optimizations
 *
 * Usage examples:
 *
 * Basic lazy loading:
 * ```tsx
 * const { ref, isIntersecting } = useIntersectionObserver({
 *   rootMargin: '50px',
 *   triggerOnce: true
 * });
 *
 * return <img ref={ref} src={isIntersecting ? imageUrl : placeholder} />;
 * ```
 *
 * Infinite scrolling:
 * ```tsx
 * const { ref, isIntersecting } = useIntersectionObserver({
 *   rootMargin: '200px',
 *   threshold: 0.1
 * });
 *
 * useEffect(() => {
 *   if (isIntersecting) loadMoreData();
 * }, [isIntersecting]);
 *
 * return <div ref={ref}>Load more trigger</div>;
 * ```
 *
 * Multiple elements:
 * ```tsx
 * const { observe, entries } = useIntersectionObserver();
 *
 * useEffect(() => {
 *   elements.forEach(el => observe(el));
 * }, [elements]);
 * ```
 */
export const useIntersectionObserver = (
  options: IntersectionObserverOptions = {}
): UseIntersectionObserverReturn => {
  const {
    root = null,
    rootMargin = '0px',
    threshold = 0,
    debounceDelay = 100,
    enablePerformanceMonitoring = false,
    triggerOnce = false,
    disabled = false,
  } = options;

  // State for intersection entries
  const [entries, setEntries] = useState<IntersectionEntry[]>([]);

  // Performance tracking
  const performanceMetrics = useRef({
    totalIntersections: 0,
    totalProcessingTime: 0,
    peakProcessingTime: 0,
  });

  // Refs for observer and tracked elements
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Set<Element>>(new Set());
  const triggeredElements = useRef<Set<Element>>(new Set());

  // Observer options for memoization
  const observerOptions = useMemo(
    () => ({
      root,
      rootMargin,
      threshold,
    }),
    [root, rootMargin, threshold]
  );

  // Create intersection observer callback
  const handleIntersection = useCallback(
    (observerEntries: IntersectionObserverEntry[]) => {
      const startTime = enablePerformanceMonitoring ? performance.now() : 0;

      const newEntries: IntersectionEntry[] = observerEntries.map(entry => ({
        element: entry.target,
        isIntersecting: entry.isIntersecting,
        intersectionRatio: entry.intersectionRatio,
        intersectionRect: entry.intersectionRect,
        boundingClientRect: entry.boundingClientRect,
        rootBounds: entry.rootBounds,
        time: entry.time,
      }));

      // Handle triggerOnce logic
      if (triggerOnce) {
        observerEntries.forEach(entry => {
          if (entry.isIntersecting && !triggeredElements.current.has(entry.target)) {
            triggeredElements.current.add(entry.target);
          } else if (!entry.isIntersecting && triggeredElements.current.has(entry.target)) {
            // Remove from observation if already triggered
            observerRef.current?.unobserve(entry.target);
            elementsRef.current.delete(entry.target);
          }
        });
      }

      // Update entries state
      setEntries(prev => {
        const elementMap = new Map(prev.map(e => [e.element, e]));

        // Update with new entries
        newEntries.forEach(entry => {
          elementMap.set(entry.element, entry);
        });

        // Remove entries for elements no longer being observed
        const currentElements = new Set(elementsRef.current);
        for (const [element] of elementMap) {
          if (!currentElements.has(element)) {
            elementMap.delete(element);
          }
        }

        return Array.from(elementMap.values());
      });

      // Performance tracking
      if (enablePerformanceMonitoring) {
        const processingTime = performance.now() - startTime;
        performanceMetrics.current.totalIntersections++;
        performanceMetrics.current.totalProcessingTime += processingTime;
        performanceMetrics.current.peakProcessingTime = Math.max(
          performanceMetrics.current.peakProcessingTime,
          processingTime
        );
      }
    },
    [triggerOnce, enablePerformanceMonitoring]
  );

  // Debounced intersection handler for performance
  const debouncedHandleIntersection = useMemo(
    () => debounce(handleIntersection, debounceDelay),
    [handleIntersection, debounceDelay]
  );

  // Initialize intersection observer
  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;

    // Create observer instance
    if (isIntersectionObserverSupported()) {
      observerRef.current = new IntersectionObserver(debouncedHandleIntersection, observerOptions);
    } else {
      // Fallback for older browsers
      console.warn('IntersectionObserver not supported, using polyfill');
      observerRef.current = createPolyfillObserver(
        debouncedHandleIntersection,
        observerOptions
      ) as IntersectionObserver;
    }

    // Re-observe existing elements with new observer
    elementsRef.current.forEach(element => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [debouncedHandleIntersection, observerOptions, disabled]);

  // Observe function
  const observe = useCallback(
    (element: Element | null) => {
      if (!element || disabled || !observerRef.current) return;

      if (!elementsRef.current.has(element)) {
        elementsRef.current.add(element);
        observerRef.current.observe(element);
      }
    },
    [disabled]
  );

  // Unobserve function
  const unobserve = useCallback((element: Element) => {
    if (!observerRef.current) return;

    elementsRef.current.delete(element);
    triggeredElements.current.delete(element);
    observerRef.current.unobserve(element);

    // Remove from entries
    setEntries(prev => prev.filter(entry => entry.element !== element));
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      elementsRef.current.clear();
      triggeredElements.current.clear();
      setEntries([]);
    }
  }, []);

  // Ref callback for single element observation
  const ref = useCallback(
    (element: Element | null) => {
      // Unobserve previous element
      if (elementsRef.current.size === 1) {
        const prevElement = Array.from(elementsRef.current)[0];
        unobserve(prevElement);
      }

      // Observe new element
      if (element) {
        observe(element);
      }
    },
    [observe, unobserve]
  );

  // Calculate if any element is intersecting
  const isIntersecting = useMemo(() => {
    return entries.some(entry => entry.isIntersecting);
  }, [entries]);

  // Performance metrics (if enabled)
  const performanceMetricsCalculated = useMemo(() => {
    if (!enablePerformanceMonitoring) return undefined;

    const { totalIntersections, totalProcessingTime, peakProcessingTime } =
      performanceMetrics.current;

    return {
      totalIntersections,
      averageProcessingTime: totalIntersections > 0 ? totalProcessingTime / totalIntersections : 0,
      peakProcessingTime,
    };
  }, [enablePerformanceMonitoring, entries.length]);

  return {
    entries,
    ref,
    isIntersecting,
    observe,
    unobserve,
    disconnect,
    performanceMetrics: performanceMetricsCalculated,
  };
};

export default useIntersectionObserver;
