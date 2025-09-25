// Performance optimization utilities for the component library
import React, { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';

/**
 * Lazy loading utility for components
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
): React.LazyExoticComponent<T> {
  const LazyComponent = React.lazy(importFn);

  if (fallback) {
    return memo(props =>
      React.createElement(
        React.Suspense,
        { fallback: React.createElement(fallback) },
        React.createElement(LazyComponent, props)
      )
    ) as React.LazyExoticComponent<T>;
  }

  return LazyComponent;
}

/**
 * Memoization hook for expensive calculations
 */
export function useExpensiveComputation<T>(computeFn: () => T, deps: React.DependencyList): T {
  return useMemo(computeFn, deps);
}

/**
 * Callback memoization with dependencies
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

/**
 * Debounced value hook for performance optimization
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttled callback hook
 */
export function useThrottle<T extends (...args: any[]) => any>(callback: T, delay: number): T {
  const lastCallTime = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime.current;

      if (timeSinceLastCall >= delay) {
        lastCallTime.current = now;
        return callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          lastCallTime.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay]
  ) as T;
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScrolling({
  itemCount,
  itemHeight,
  containerHeight,
  buffer = 5,
}: {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  buffer?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    itemCount - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight)
  );

  const startIndex = Math.max(0, visibleStart - buffer);
  const endIndex = Math.min(itemCount - 1, visibleEnd + buffer);

  const offsetY = startIndex * itemHeight;
  const totalHeight = itemCount * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
    handleScroll,
  };
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, options]);

  return isIntersecting;
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef<number>(0);

  useEffect(() => {
    renderCountRef.current += 1;
    const currentTime = performance.now();
    const renderTime = currentTime - lastRenderTime.current;

    if (renderCountRef.current > 1) {
      console.log(`${componentName} render #${renderCountRef.current}: ${renderTime.toFixed(2)}ms`);
    }

    lastRenderTime.current = currentTime;
  });

  useEffect(() => {
    return () => {
      console.log(`${componentName} total renders: ${renderCountRef.current}`);
    };
  }, [componentName]);
}

/**
 * Memory usage monitoring
 */
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo({
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

/**
 * Bundle size analyzer
 */
export class BundleAnalyzer {
  private static componentSizes = new Map<string, number>();

  static trackComponent(name: string, size: number) {
    this.componentSizes.set(name, size);
  }

  static getReport(): { name: string; size: number }[] {
    return Array.from(this.componentSizes.entries())
      .map(([name, size]) => ({
        name,
        size,
      }))
      .sort((a, b) => b.size - a.size);
  }

  static getTotalSize(): number {
    return Array.from(this.componentSizes.values()).reduce((sum, size) => sum + size, 0);
  }
}

/**
 * Image optimization utilities
 */
export function useImageOptimization() {
  const [supportedFormats, setSupportedFormats] = useState<{
    webp: boolean;
    avif: boolean;
  }>({ webp: false, avif: false });

  useEffect(() => {
    const checkWebP = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    };

    const checkAVIF = async () => {
      try {
        const avifData =
          'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
        const img = new Image();
        return new Promise<boolean>(resolve => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = avifData;
        });
      } catch {
        return false;
      }
    };

    setSupportedFormats({
      webp: checkWebP(),
      avif: false, // Will be set asynchronously
    });

    checkAVIF().then(avif => {
      setSupportedFormats(prev => ({ ...prev, avif }));
    });
  }, []);

  const getOptimalImageSrc = useCallback(
    (baseSrc: string, sizes?: { webp?: string; avif?: string }) => {
      if (sizes?.avif && supportedFormats.avif) {
        return sizes.avif;
      }
      if (sizes?.webp && supportedFormats.webp) {
        return sizes.webp;
      }
      return baseSrc;
    },
    [supportedFormats]
  );

  return { supportedFormats, getOptimalImageSrc };
}

/**
 * Preload resources utility
 */
export function preloadResource(
  href: string,
  type: 'script' | 'style' | 'font' | 'image' = 'script'
): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;

  switch (type) {
    case 'script':
      link.as = 'script';
      break;
    case 'style':
      link.as = 'style';
      break;
    case 'font':
      link.as = 'font';
      link.crossOrigin = 'anonymous';
      break;
    case 'image':
      link.as = 'image';
      break;
  }

  document.head.appendChild(link);
}

/**
 * Component performance wrapper
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  const MemoizedComponent = memo(Component);

  return memo((props: P) => {
    const renderStartTime = useRef<number>(0);

    useEffect(() => {
      renderStartTime.current = performance.now();
    });

    useEffect(() => {
      const renderTime = performance.now() - renderStartTime.current;
      console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
    });

    return React.createElement(MemoizedComponent, props);
  });
}

/**
 * Code splitting utilities
 */
export const loadComponent = (componentPath: string): Promise<React.ComponentType<any>> => {
  return import(/* webpackChunkName: "[request]" */ componentPath).then(module => module.default);
};

/**
 * Resource hints for better performance
 */
export function addResourceHints() {
  // Preconnect to Google Fonts
  const preconnectGoogle = document.createElement('link');
  preconnectGoogle.rel = 'preconnect';
  preconnectGoogle.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnectGoogle);

  const preconnectGstatic = document.createElement('link');
  preconnectGstatic.rel = 'preconnect';
  preconnectGstatic.href = 'https://fonts.gstatic.com';
  preconnectGstatic.crossOrigin = 'anonymous';
  document.head.appendChild(preconnectGstatic);
}

// Initialize resource hints
if (typeof window !== 'undefined') {
  addResourceHints();
}

export default {
  createLazyComponent,
  useExpensiveComputation,
  useStableCallback,
  useDebounce,
  useThrottle,
  useVirtualScrolling,
  useIntersectionObserver,
  usePerformanceMonitor,
  useMemoryMonitor,
  useImageOptimization,
  preloadResource,
  withPerformanceMonitoring,
  loadComponent,
  BundleAnalyzer,
};
