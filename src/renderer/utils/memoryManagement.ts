/**
 * Memory Management and Leak Prevention Utilities
 *
 * Comprehensive memory management for React components:
 * - Automatic cleanup of event listeners
 * - Timer and interval cleanup
 * - Memory leak detection
 * - WeakMap-based caching
 * - Resource pooling
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

import React, { useEffect, useRef, useCallback } from 'react';

// ===========================================
// Types and Interfaces
// ===========================================

export interface MemoryUsageStats {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  memoryPressure: 'low' | 'medium' | 'high';
}

export interface CleanupFunction {
  (): void;
}

export interface ResourcePool<T> {
  acquire(): T | null;
  release(resource: T): void;
  size(): number;
  clear(): void;
}

// ===========================================
// Memory Utilities
// ===========================================

export class MemoryUtils {
  static getMemoryUsage(): MemoryUsageStats | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      let memoryPressure: 'low' | 'medium' | 'high' = 'low';
      if (usageRatio > 0.8) memoryPressure = 'high';
      else if (usageRatio > 0.6) memoryPressure = 'medium';

      return {
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
        memoryPressure,
      };
    }
    return null;
  }

  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  static triggerGarbageCollection(): void {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  static isMemoryPressureHigh(): boolean {
    const stats = this.getMemoryUsage();
    return stats?.memoryPressure === 'high' || false;
  }
}

// ===========================================
// Cleanup Manager
// ===========================================

export class CleanupManager {
  private cleanupFunctions = new Set<CleanupFunction>();
  private timers = new Set<NodeJS.Timeout | number>();
  private intervals = new Set<NodeJS.Timeout | number>();
  private eventListeners = new Map<EventTarget, Map<string, EventListener>>();

  // Timer management
  setTimeout(callback: Function, delay: number): NodeJS.Timeout {
    const timerId = setTimeout(() => {
      this.timers.delete(timerId);
      callback();
    }, delay);

    this.timers.add(timerId);
    return timerId;
  }

  setInterval(callback: Function, delay: number): NodeJS.Timeout {
    const intervalId = setInterval(callback, delay);
    this.intervals.add(intervalId);
    return intervalId;
  }

  clearTimeout(timerId: NodeJS.Timeout): void {
    clearTimeout(timerId);
    this.timers.delete(timerId);
  }

  clearInterval(intervalId: NodeJS.Timeout): void {
    clearInterval(intervalId);
    this.intervals.delete(intervalId);
  }

  // Event listener management
  addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);

    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, new Map());
    }

    this.eventListeners.get(target)!.set(type, listener);
  }

  removeEventListener(target: EventTarget, type: string): void {
    const listeners = this.eventListeners.get(target);
    if (listeners) {
      const listener = listeners.get(type);
      if (listener) {
        target.removeEventListener(type, listener);
        listeners.delete(type);

        if (listeners.size === 0) {
          this.eventListeners.delete(target);
        }
      }
    }
  }

  // Generic cleanup function registration
  addCleanup(cleanupFn: CleanupFunction): void {
    this.cleanupFunctions.add(cleanupFn);
  }

  removeCleanup(cleanupFn: CleanupFunction): void {
    this.cleanupFunctions.delete(cleanupFn);
  }

  // Cleanup all resources
  cleanup(): void {
    // Clear all timers
    this.timers.forEach(timerId => clearTimeout(timerId));
    this.timers.clear();

    // Clear all intervals
    this.intervals.forEach(intervalId => clearInterval(intervalId));
    this.intervals.clear();

    // Remove all event listeners
    this.eventListeners.forEach((listeners, target) => {
      listeners.forEach((listener, type) => {
        target.removeEventListener(type, listener);
      });
    });
    this.eventListeners.clear();

    // Execute custom cleanup functions
    this.cleanupFunctions.forEach(cleanupFn => {
      try {
        cleanupFn();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    });
    this.cleanupFunctions.clear();
  }
}

// ===========================================
// Memory Leak Detector
// ===========================================

export class MemoryLeakDetector {
  private snapshots: MemoryUsageStats[] = [];
  private maxSnapshots = 20;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  private takeSnapshot(): void {
    const stats = MemoryUtils.getMemoryUsage();
    if (stats) {
      this.snapshots.push(stats);

      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots.shift();
      }
    }
  }

  detectLeaks(): {
    hasLeak: boolean;
    trend: 'increasing' | 'stable' | 'decreasing';
    growthRate: number;
    recommendations: string[];
  } {
    if (this.snapshots.length < 5) {
      return {
        hasLeak: false,
        trend: 'stable',
        growthRate: 0,
        recommendations: ['Insufficient data for leak detection'],
      };
    }

    // Calculate memory growth trend
    const recent = this.snapshots.slice(-5);
    const older = this.snapshots.slice(-10, -5);

    const recentAvg = recent.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / older.length;

    const growthRate = ((recentAvg - olderAvg) / olderAvg) * 100;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (growthRate > 5) trend = 'increasing';
    else if (growthRate < -5) trend = 'decreasing';

    const hasLeak = trend === 'increasing' && growthRate > 10;

    const recommendations: string[] = [];
    if (hasLeak) {
      recommendations.push('Check for uncleaned event listeners');
      recommendations.push('Verify timer and interval cleanup');
      recommendations.push('Review component unmounting logic');
      recommendations.push('Check for circular references');
      recommendations.push('Review global variable usage');
    }

    return {
      hasLeak,
      trend,
      growthRate,
      recommendations,
    };
  }

  getMemoryTrend(): Array<{ timestamp: number; usage: number }> {
    return this.snapshots.map((snapshot, index) => ({
      timestamp: Date.now() - (this.snapshots.length - index - 1) * 5000,
      usage: snapshot.usedJSHeapSize,
    }));
  }

  reset(): void {
    this.snapshots = [];
  }
}

// ===========================================
// Resource Pool
// ===========================================

export class GenericResourcePool<T> implements ResourcePool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  private factory: () => T;
  private resetFunction?: (resource: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    maxSize: number = 10,
    resetFunction?: (resource: T) => void
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.resetFunction = resetFunction;
  }

  acquire(): T | null {
    let resource: T;

    if (this.available.length > 0) {
      resource = this.available.pop()!;
    } else if (this.size() < this.maxSize) {
      resource = this.factory();
    } else {
      return null; // Pool exhausted
    }

    this.inUse.add(resource);
    return resource;
  }

  release(resource: T): void {
    if (this.inUse.has(resource)) {
      this.inUse.delete(resource);

      // Reset resource state if reset function provided
      if (this.resetFunction) {
        this.resetFunction(resource);
      }

      this.available.push(resource);
    }
  }

  size(): number {
    return this.available.length + this.inUse.size;
  }

  clear(): void {
    this.available = [];
    this.inUse.clear();
  }
}

// ===========================================
// WeakMap Cache
// ===========================================

export class WeakMapCache<K extends object, V> {
  private cache = new WeakMap<K, V>();
  private hitCount = 0;
  private missCount = 0;

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hitCount++;
      return value;
    }
    this.missCount++;
    return undefined;
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  getStats(): { hitRate: number; totalAccesses: number } {
    const totalAccesses = this.hitCount + this.missCount;
    const hitRate = totalAccesses > 0 ? (this.hitCount / totalAccesses) * 100 : 0;

    return { hitRate, totalAccesses };
  }

  reset(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// ===========================================
// React Hooks
// ===========================================

export function useCleanup(): CleanupManager {
  const cleanupManagerRef = useRef<CleanupManager>();

  if (!cleanupManagerRef.current) {
    cleanupManagerRef.current = new CleanupManager();
  }

  useEffect(() => {
    return () => {
      cleanupManagerRef.current?.cleanup();
    };
  }, []);

  return cleanupManagerRef.current;
}

export function useMemoryLeakDetector(intervalMs: number = 5000) {
  const detectorRef = useRef<MemoryLeakDetector>();

  if (!detectorRef.current) {
    detectorRef.current = new MemoryLeakDetector();
  }

  useEffect(() => {
    const detector = detectorRef.current!;
    detector.startMonitoring(intervalMs);

    return () => {
      detector.stopMonitoring();
    };
  }, [intervalMs]);

  const detectLeaks = useCallback(() => {
    return detectorRef.current?.detectLeaks() || {
      hasLeak: false,
      trend: 'stable' as const,
      growthRate: 0,
      recommendations: [],
    };
  }, []);

  const getMemoryTrend = useCallback(() => {
    return detectorRef.current?.getMemoryTrend() || [];
  }, []);

  return { detectLeaks, getMemoryTrend };
}

export function useResourcePool<T>(
  factory: () => T,
  maxSize: number = 10,
  resetFunction?: (resource: T) => void
): ResourcePool<T> {
  const poolRef = useRef<GenericResourcePool<T>>();

  if (!poolRef.current) {
    poolRef.current = new GenericResourcePool(factory, maxSize, resetFunction);
  }

  useEffect(() => {
    return () => {
      poolRef.current?.clear();
    };
  }, []);

  return poolRef.current;
}

export function useWeakMapCache<K extends object, V>(): WeakMapCache<K, V> {
  const cacheRef = useRef<WeakMapCache<K, V>>();

  if (!cacheRef.current) {
    cacheRef.current = new WeakMapCache<K, V>();
  }

  return cacheRef.current;
}

export function useMemoryPressureMonitor(
  onPressureHigh: () => void,
  checkInterval: number = 2000
) {
  const onPressureHighRef = useRef(onPressureHigh);
  onPressureHighRef.current = onPressureHigh;

  useEffect(() => {
    const interval = setInterval(() => {
      if (MemoryUtils.isMemoryPressureHigh()) {
        onPressureHighRef.current();
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }, [checkInterval]);
}

// ===========================================
// Auto-cleanup Component Wrapper
// ===========================================

export function withAutoCleanup<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AutoCleanupComponent(props: P) {
    const cleanup = useCleanup();

    // Add the cleanup manager to props if the component expects it
    const enhancedProps = {
      ...props,
      cleanup,
    } as P;

    return React.createElement(Component, enhancedProps);
  };
}

// ===========================================
// Global Memory Manager
// ===========================================

class GlobalMemoryManager {
  private static instance: GlobalMemoryManager;
  private leakDetector: MemoryLeakDetector;
  private cleanupManagers = new Set<CleanupManager>();

  private constructor() {
    this.leakDetector = new MemoryLeakDetector();
    this.leakDetector.startMonitoring();

    // Global cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Memory pressure monitoring
    setInterval(() => {
      if (MemoryUtils.isMemoryPressureHigh()) {
        this.handleMemoryPressure();
      }
    }, 5000);
  }

  static getInstance(): GlobalMemoryManager {
    if (!GlobalMemoryManager.instance) {
      GlobalMemoryManager.instance = new GlobalMemoryManager();
    }
    return GlobalMemoryManager.instance;
  }

  registerCleanupManager(manager: CleanupManager): void {
    this.cleanupManagers.add(manager);
  }

  unregisterCleanupManager(manager: CleanupManager): void {
    this.cleanupManagers.delete(manager);
  }

  private handleMemoryPressure(): void {
    console.warn('High memory pressure detected, triggering cleanup');

    // Trigger garbage collection if available
    MemoryUtils.triggerGarbageCollection();

    // Emit memory pressure event
    window.dispatchEvent(new CustomEvent('memoryPressure', {
      detail: { level: 'high' }
    }));
  }

  cleanup(): void {
    // Cleanup all registered managers
    this.cleanupManagers.forEach(manager => {
      try {
        manager.cleanup();
      } catch (error) {
        console.warn('Cleanup manager failed:', error);
      }
    });

    this.leakDetector.stopMonitoring();
  }

  getMemoryStats() {
    return {
      usage: MemoryUtils.getMemoryUsage(),
      leakDetection: this.leakDetector.detectLeaks(),
      trend: this.leakDetector.getMemoryTrend(),
    };
  }
}

// Initialize global memory manager
export const globalMemoryManager = GlobalMemoryManager.getInstance();

// ===========================================
// Memory-Optimized Component Helpers
// ===========================================

export function createMemoizedComponent<P extends object>(
  Component: React.ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean
) {
  return React.memo(Component, areEqual);
}

export function createMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

export function createMemoizedValue<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

// Export memory utilities
export { MemoryUtils };
export default globalMemoryManager;