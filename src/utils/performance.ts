/**
 * Performance Utilities
 *
 * Collection of utilities for performance optimization:
 * - React.memo wrappers
 * - Debouncing and throttling
 * - RAF scheduling
 * - Memory management
 * - Bundle size optimization
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';

// ========================
// Performance Timing
// ========================

// Import from centralized types
import type { PerformanceMetrics } from '../types/shared/performance';

/**
 * Performance timing utility
 */
export class PerformanceTimer {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  start(label: string): void {
    const startTime = performance.now();
    this.metrics.set(label, {
      startTime,
      memory: this.getMemoryUsage()
    });

    if (typeof performance.mark === 'function') {
      performance.mark(`${label}-start`);
    }
  }

  end(label: string): PerformanceMetrics | null {
    const endTime = performance.now();
    const metric = this.metrics.get(label);

    if (!metric) {
      console.warn(`Performance timer '${label}' was not started`);
      return null;
    }

    const duration = endTime - metric.startTime;
    const updatedMetric: PerformanceMetrics = {
      ...metric,
      endTime,
      duration,
      memory: this.getMemoryUsage()
    };

    this.metrics.set(label, updatedMetric);

    if (typeof performance.mark === 'function' && typeof performance.measure === 'function') {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
    }

    return updatedMetric;
  }

  get(label: string): PerformanceMetrics | undefined {
    return this.metrics.get(label);
  }

  clear(label?: string): void {
    if (label) {
      this.metrics.delete(label);
    } else {
      this.metrics.clear();
    }
  }

  private getMemoryUsage(): { used: number; total: number } {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize
      };
    }
    return { used: 0, total: 0 };
  }
}

export const performanceTimer = new PerformanceTimer();

// ========================
// React Performance Utilities
// ========================

/**
 * Deep equality check for React.memo
 */
export function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
    return a === b;
  }

  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }

  if (a.constructor !== b.constructor) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as any)[key], (b as any)[key])) return false;
  }

  return true;
}

/**
 * Shallow equality check for props
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || (a as any)[key] !== (b as any)[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Create a memoized component with custom comparison
 */
export function createMemoComponent<P>(
  component: React.ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  return React.memo(component, areEqual || shallowEqual);
}

// ========================
// RAF Scheduling
// ========================

export interface RAFCallback {
  (): void;
}

export interface RAFOptions {
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
}

class RAFScheduler {
  private queues = {
    high: [] as RAFCallback[],
    normal: [] as RAFCallback[],
    low: [] as RAFCallback[]
  };
  private isRunning = false;
  private frameId: number | null = null;

  schedule(callback: RAFCallback, options: RAFOptions = {}): () => void {
    const { priority = 'normal' } = options;

    this.queues[priority].push(callback);

    if (!this.isRunning) {
      this.startFrame();
    }

    // Return cancel function
    return () => {
      const queue = this.queues[priority];
      const index = queue.indexOf(callback);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    };
  }

  private startFrame(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.frameId = requestAnimationFrame(() => {
      this.runFrame();
    });
  }

  private runFrame(): void {
    const startTime = performance.now();
    const frameTimeout = 16; // ~16ms for 60fps

    // Process queues by priority
    const queues = ['high', 'normal', 'low'] as const;

    for (const priority of queues) {
      const queue = this.queues[priority];

      while (queue.length > 0 && (performance.now() - startTime) < frameTimeout) {
        const callback = queue.shift();
        if (callback) {
          try {
            callback();
          } catch (error) {
            console.error('RAF callback error:', error);
          }
        }
      }

      // If we're running out of time, stop and schedule next frame
      if ((performance.now() - startTime) >= frameTimeout) {
        break;
      }
    }

    // Check if there are more tasks
    const hasMoreTasks = Object.values(this.queues).some(queue => queue.length > 0);

    if (hasMoreTasks) {
      // Schedule next frame
      this.frameId = requestAnimationFrame(() => {
        this.runFrame();
      });
    } else {
      this.isRunning = false;
      this.frameId = null;
    }
  }

  cancel(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.isRunning = false;

    // Clear all queues
    Object.values(this.queues).forEach(queue => queue.length = 0);
  }
}

export const rafScheduler = new RAFScheduler();

// ========================
// React RAF Hook
// ========================

export function useRAF(callback: RAFCallback, options?: RAFOptions) {
  const callbackRef = useRef(callback);
  const cancelRef = useRef<(() => void) | null>(null);

  // Keep callback current
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Schedule callback
  const schedule = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
    }

    cancelRef.current = rafScheduler.schedule(() => {
      callbackRef.current();
    }, options);
  }, [options]);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current();
      }
    };
  }, []);

  return schedule;
}

// ========================
// Throttling Utilities
// ========================

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;

  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
    return lastResult;
  };
}

export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let frameId: number | null = null;

  return function(this: any, ...args: Parameters<T>) {
    if (frameId) return;

    frameId = requestAnimationFrame(() => {
      func.apply(this, args);
      frameId = null;
    });
  };
}

// ========================
// Memory Management
// ========================

export class MemoryManager {
  private cleanupCallbacks = new Set<() => void>();

  addCleanup(callback: () => void): () => void {
    this.cleanupCallbacks.add(callback);

    return () => {
      this.cleanupCallbacks.delete(callback);
    };
  }

  cleanup(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Cleanup callback error:', error);
      }
    });
    this.cleanupCallbacks.clear();
  }

  getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  forceGC(): void {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }
}

export const memoryManager = new MemoryManager();

// ========================
// Bundle Size Optimization
// ========================

/**
 * Lazy load component with loading state
 */
export function lazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(factory);
}

/**
 * Preload component for better UX
 */
export function preloadComponent<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): Promise<{ default: T }> {
  return factory();
}

// ========================
// Performance Hooks
// ========================

/**
 * Hook for measuring render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current += 1;
  });

  useEffect(() => {
    startTime.current = performance.now();
  });

  useEffect(() => {
    const endTime = performance.now();
    const duration = endTime - startTime.current;

    if (duration > 16) { // Log slow renders (>16ms)
      console.warn(
        `Slow render detected in ${componentName}: ${duration.toFixed(2)}ms (render #${renderCount.current})`
      );
    }
  });

  return {
    renderCount: renderCount.current,
    getDuration: () => performance.now() - startTime.current
  };
}

/**
 * Hook for expensive computations
 */
export function useExpensiveComputation<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(() => {
    const label = `expensive-computation-${Math.random().toString(36).substr(2, 9)}`;
    performanceTimer.start(label);

    try {
      const result = factory();
      const metrics = performanceTimer.end(label);

      if (metrics && metrics.duration && metrics.duration > 5) {
        console.warn(`Expensive computation took ${metrics.duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      performanceTimer.end(label);
      throw error;
    }
  }, deps);
}

// ========================
// Image Loading Optimization
// ========================

export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

export function preloadImages(sources: string[]): Promise<void[]> {
  return Promise.all(sources.map(preloadImage));
}

// ========================
// Network Optimization
// ========================

export function prefetchRoute(route: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = route;
  document.head.appendChild(link);
}

export function preconnect(origin: string): void {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  document.head.appendChild(link);
}

// ========================
// Bundle Analysis
// ========================

export function getBundleSize(): Promise<number> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    return navigator.storage.estimate().then(estimate => estimate.usage || 0);
  }
  return Promise.resolve(0);
}

export function reportWebVitals(metric: any): void {
  console.log('Web Vital:', metric);

  // Send to analytics if available
  if ('gtag' in window) {
    (window as any).gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.value),
      non_interaction: true
    });
  }
}