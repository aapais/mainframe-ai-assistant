/**
 * useResizeObserver Hook
 *
 * Element resize detection with performance optimizations
 * Provides React-friendly wrapper around ResizeObserver API
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// =========================
// TYPE DEFINITIONS
// =========================

export interface ResizeObserverEntry {
  /** The element being observed */
  target: Element;
  /** Content rect (content-box) */
  contentRect: DOMRectReadOnly;
  /** Border box size */
  borderBoxSize?: ResizeObserverSize[];
  /** Content box size */
  contentBoxSize?: ResizeObserverSize[];
  /** Device pixel content box size */
  devicePixelContentBoxSize?: ResizeObserverSize[];
}

export interface ElementSize {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Top position */
  top: number;
  /** Left position */
  left: number;
  /** Bottom position */
  bottom: number;
  /** Right position */
  right: number;
}

export interface UseResizeObserverOptions {
  /** Box model to observe ('border-box' | 'content-box' | 'device-pixel-content-box') */
  box?: ResizeObserverBoxOptions;
  /** Debounce resize events in milliseconds */
  debounceMs?: number;
  /** Callback when resize occurs */
  onResize?: (entry: ResizeObserverEntry) => void;
  /** Enable/disable observation */
  enabled?: boolean;
  /** Initial size for SSR */
  initialSize?: Partial<ElementSize>;
  /** Enable performance monitoring */
  monitor?: boolean;
}

export interface UseResizeObserverReturn {
  /** Current element size */
  size: ElementSize | null;
  /** Ref to attach to element */
  ref: React.RefCallback<Element>;
  /** Manual refresh function */
  refresh: () => void;
  /** Whether ResizeObserver is supported */
  isSupported: boolean;
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Check if ResizeObserver is supported
 */
const isResizeObserverSupported = (): boolean => {
  return typeof window !== 'undefined' && 'ResizeObserver' in window;
};

/**
 * Extract size information from ResizeObserverEntry
 */
const extractSizeFromEntry = (entry: globalThis.ResizeObserverEntry): ElementSize => {
  const { contentRect } = entry;

  return {
    width: contentRect.width,
    height: contentRect.height,
    top: contentRect.top,
    left: contentRect.left,
    bottom: contentRect.bottom,
    right: contentRect.right,
  };
};

/**
 * Debounce function for performance optimization
 */
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Get element size using getBoundingClientRect (fallback)
 */
const getElementSize = (element: Element): ElementSize => {
  const rect = element.getBoundingClientRect();

  return {
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
  };
};

// =========================
// MAIN HOOK
// =========================

/**
 * useResizeObserver Hook
 *
 * Observes element resize events with performance optimizations
 *
 * @param options - Configuration options
 * @returns Resize observer utilities and current size
 *
 * @example
 * ```tsx
 * const { ref, size } = useResizeObserver({
 *   debounceMs: 100,
 *   onResize: (entry) => console.log('Resized:', entry),
 *   box: 'border-box'
 * });
 *
 * return (
 *   <div ref={ref}>
 *     Size: {size?.width} x {size?.height}
 *   </div>
 * );
 * ```
 */
export const useResizeObserver = (
  options: UseResizeObserverOptions = {}
): UseResizeObserverReturn => {
  const {
    box = 'content-box',
    debounceMs = 0,
    onResize,
    enabled = true,
    initialSize,
    monitor = false,
  } = options;

  // State
  const [size, setSize] = useState<ElementSize | null>(() => {
    if (initialSize) {
      return {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        ...initialSize,
      };
    }
    return null;
  });

  // Refs
  const elementRef = useRef<Element | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const callbackRef = useRef(onResize);

  // Update callback ref
  callbackRef.current = onResize;

  // Check support
  const isSupported = useMemo(() => isResizeObserverSupported(), []);

  // Debounced resize handler
  const handleResize = useMemo(() => {
    const handler = (entries: globalThis.ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      if (monitor) {
        console.log('ResizeObserver triggered:', {
          target: entry.target,
          size: extractSizeFromEntry(entry),
          timestamp: Date.now(),
        });
      }

      const newSize = extractSizeFromEntry(entry);
      setSize(newSize);

      // Call user callback
      if (callbackRef.current) {
        callbackRef.current(entry);
      }
    };

    return debounceMs > 0 ? debounce(handler, debounceMs) : handler;
  }, [debounceMs, monitor]);

  // Manual refresh function
  const refresh = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    if (isSupported && observerRef.current) {
      // Trigger ResizeObserver manually
      observerRef.current.disconnect();
      observerRef.current.observe(element, { box });
    } else {
      // Fallback: manual size calculation
      const newSize = getElementSize(element);
      setSize(newSize);

      if (monitor) {
        console.log('Manual refresh (fallback):', {
          element,
          size: newSize,
          timestamp: Date.now(),
        });
      }
    }
  }, [isSupported, box, monitor]);

  // Ref callback to attach observer
  const ref = useCallback((element: Element | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    elementRef.current = element;

    if (!element || !enabled) {
      setSize(null);
      return;
    }

    if (isSupported) {
      // Use ResizeObserver
      try {
        const observer = new ResizeObserver(handleResize);
        observer.observe(element, { box });
        observerRef.current = observer;

        if (monitor) {
          console.log('ResizeObserver attached:', {
            element,
            box,
            enabled,
          });
        }
      } catch (error) {
        console.warn('Failed to create ResizeObserver:', error);

        // Fallback to initial size calculation
        const initialSize = getElementSize(element);
        setSize(initialSize);
      }
    } else {
      // Fallback: use manual size calculation and window resize
      const updateSize = () => {
        const newSize = getElementSize(element);
        setSize(newSize);
      };

      // Initial size
      updateSize();

      // Listen to window resize as fallback
      const handleWindowResize = debounceMs > 0
        ? debounce(updateSize, debounceMs)
        : updateSize;

      window.addEventListener('resize', handleWindowResize, { passive: true });

      // Store cleanup function
      const cleanup = () => {
        window.removeEventListener('resize', handleWindowResize);
      };

      // We can't return cleanup from useCallback, so store it
      (elementRef as any).cleanup = cleanup;

      if (monitor) {
        console.log('Fallback resize listener attached:', {
          element,
          enabled,
        });
      }
    }
  }, [enabled, isSupported, handleResize, box, debounceMs, monitor]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;

        if (monitor) {
          console.log('ResizeObserver cleaned up');
        }
      }

      // Cleanup fallback listener if exists
      const cleanup = (elementRef as any).cleanup;
      if (cleanup) {
        cleanup();
        delete (elementRef as any).cleanup;
      }
    };
  }, [monitor]);

  // Effect for enabled state changes
  useEffect(() => {
    if (!enabled && observerRef.current) {
      observerRef.current.disconnect();
      setSize(null);

      if (monitor) {
        console.log('ResizeObserver disabled');
      }
    } else if (enabled && elementRef.current && !observerRef.current && isSupported) {
      // Re-attach observer if enabled and element exists
      ref(elementRef.current);
    }
  }, [enabled, ref, isSupported, monitor]);

  return {
    size,
    ref,
    refresh,
    isSupported,
  };
};

// =========================
// CONVENIENCE HOOKS
// =========================

/**
 * Hook for observing only width changes
 */
export const useWidthObserver = (options: Omit<UseResizeObserverOptions, 'onResize'> & {
  onWidthChange?: (width: number) => void;
} = {}) => {
  const { onWidthChange, ...restOptions } = options;
  const prevWidthRef = useRef<number>(0);

  const { size, ref, refresh, isSupported } = useResizeObserver({
    ...restOptions,
    onResize: useCallback((entry) => {
      const newWidth = entry.contentRect.width;

      if (newWidth !== prevWidthRef.current) {
        prevWidthRef.current = newWidth;
        onWidthChange?.(newWidth);
      }
    }, [onWidthChange]),
  });

  return {
    width: size?.width ?? 0,
    ref,
    refresh,
    isSupported,
  };
};

/**
 * Hook for observing only height changes
 */
export const useHeightObserver = (options: Omit<UseResizeObserverOptions, 'onResize'> & {
  onHeightChange?: (height: number) => void;
} = {}) => {
  const { onHeightChange, ...restOptions } = options;
  const prevHeightRef = useRef<number>(0);

  const { size, ref, refresh, isSupported } = useResizeObserver({
    ...restOptions,
    onResize: useCallback((entry) => {
      const newHeight = entry.contentRect.height;

      if (newHeight !== prevHeightRef.current) {
        prevHeightRef.current = newHeight;
        onHeightChange?.(newHeight);
      }
    }, [onHeightChange]),
  });

  return {
    height: size?.height ?? 0,
    ref,
    refresh,
    isSupported,
  };
};

/**
 * Hook for observing element bounds (position + size)
 */
export const useBoundsObserver = (options: UseResizeObserverOptions = {}) => {
  const { size, ref, refresh, isSupported } = useResizeObserver({
    ...options,
    box: 'border-box', // Use border-box for accurate bounds
  });

  const bounds = useMemo(() => {
    if (!size) return null;

    return {
      x: size.left,
      y: size.top,
      width: size.width,
      height: size.height,
      left: size.left,
      top: size.top,
      right: size.right,
      bottom: size.bottom,
      centerX: size.left + size.width / 2,
      centerY: size.top + size.height / 2,
    };
  }, [size]);

  return {
    bounds,
    size,
    ref,
    refresh,
    isSupported,
  };
};

/**
 * Hook for detecting significant size changes (useful for performance)
 */
export const useSignificantResize = (options: UseResizeObserverOptions & {
  /** Minimum change threshold in pixels */
  threshold?: number;
} = {}) => {
  const { threshold = 10, onResize, ...restOptions } = options;
  const [significantSize, setSignificantSize] = useState<ElementSize | null>(null);
  const lastSignificantSizeRef = useRef<ElementSize | null>(null);

  const { size, ref, refresh, isSupported } = useResizeObserver({
    ...restOptions,
    onResize: useCallback((entry) => {
      const currentSize = extractSizeFromEntry(entry);
      const lastSize = lastSignificantSizeRef.current;

      if (!lastSize) {
        // First measurement
        setSignificantSize(currentSize);
        lastSignificantSizeRef.current = currentSize;
        onResize?.(entry);
        return;
      }

      // Check if change is significant
      const widthChange = Math.abs(currentSize.width - lastSize.width);
      const heightChange = Math.abs(currentSize.height - lastSize.height);

      if (widthChange >= threshold || heightChange >= threshold) {
        setSignificantSize(currentSize);
        lastSignificantSizeRef.current = currentSize;
        onResize?.(entry);
      }
    }, [threshold, onResize]),
  });

  return {
    size: significantSize,
    rawSize: size, // Provide access to raw size for debugging
    ref,
    refresh,
    isSupported,
  };
};

export default useResizeObserver;