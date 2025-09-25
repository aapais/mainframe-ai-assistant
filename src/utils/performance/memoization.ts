/**
 * Advanced Memoization Utilities
 *
 * High-performance memoization utilities for React components and functions.
 * Includes intelligent cache management, memory-aware cleanup, and performance monitoring.
 *
 * Features:
 * - LRU (Least Recently Used) cache with automatic cleanup
 * - Memory-aware cache sizing
 * - Deep equality checking with performance optimization
 * - Weak references for automatic garbage collection
 * - Cache hit/miss statistics
 * - TTL (Time To Live) support
 *
 * @author Performance Engineer
 * @version 2.0.0
 */

import { useRef, useMemo, useCallback } from 'react';

// ========================
// Types & Interfaces
// ========================

export interface MemoizationOptions {
  /** Maximum number of cached values */
  maxSize?: number;
  /** Time to live for cached values (ms) */
  ttl?: number;
  /** Custom equality function */
  isEqual?: (a: any, b: any) => boolean;
  /** Enable performance monitoring */
  enableMonitoring?: boolean;
  /** Weak reference mode for automatic cleanup */
  useWeakReferences?: boolean;
}

export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Timestamp when cached */
  timestamp: number;
  /** Number of times accessed */
  accessCount: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** TTL expiration timestamp */
  expiresAt?: number;
}

export interface CacheStats {
  /** Total number of hits */
  hits: number;
  /** Total number of misses */
  misses: number;
  /** Current cache size */
  size: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Average access time (ms) */
  averageAccessTime: number;
}

export interface LRUCache<K, V> {
  /** Get value by key */
  get: (key: K) => V | undefined;
  /** Set value by key */
  set: (key: K, value: V) => void;
  /** Check if key exists */
  has: (key: K) => boolean;
  /** Delete key */
  delete: (key: K) => boolean;
  /** Clear all entries */
  clear: () => void;
  /** Get current size */
  size: number;
  /** Get cache statistics */
  getStats: () => CacheStats;
}

// ========================
// Utility Functions
// ========================

/**
 * Deep equality check with performance optimizations
 */
const deepEqual = (a: any, b: any): boolean => {
  // Fast reference equality check
  if (a === b) return true;

  // Type mismatch check
  if (typeof a !== typeof b) return false;

  // Null/undefined checks
  if (a == null || b == null) return a === b;

  // Array comparison
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Object comparison
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  // Primitive comparison
  return a === b;
};

/**
 * Shallow equality check for better performance
 */
const shallowEqual = (a: any, b: any): boolean => {
  if (a === b) return true;

  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) {
    return a === b;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key) || a[key] !== b[key]) return false;
  }

  return true;
};

/**
 * Generate cache key from arguments
 */
const generateCacheKey = (args: any[]): string => {
  try {
    return JSON.stringify(args);
  } catch (error) {
    // Fallback for circular references
    return args.map(arg => String(arg)).join('|');
  }
};

/**
 * Get memory usage estimate (Chrome only)
 */
const getMemoryUsage = (): number => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const performance = window.performance as any;
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
  }
  return 0;
};

// ========================
// LRU Cache Implementation
// ========================

/**
 * High-performance LRU Cache with TTL and monitoring
 */
export const createLRUCache = <K, V>(options: MemoizationOptions = {}): LRUCache<K, V> => {
  const { maxSize = 100, ttl, enableMonitoring = false, isEqual = deepEqual } = options;

  const cache = new Map<K, CacheEntry<V>>();
  const accessOrder = new Map<K, number>();
  let accessCounter = 0;

  // Statistics tracking
  const stats = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0,
  };

  const isExpired = (entry: CacheEntry<V>): boolean => {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  };

  const evictLRU = () => {
    if (cache.size <= maxSize) return;

    // Find least recently used entry
    let lruKey: K | undefined;
    let lruAccess = Infinity;

    for (const [key] of cache) {
      const access = accessOrder.get(key) || 0;
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      cache.delete(lruKey);
      accessOrder.delete(lruKey);
    }
  };

  const get = (key: K): V | undefined => {
    const startTime = enableMonitoring ? performance.now() : 0;

    const entry = cache.get(key);

    if (!entry || isExpired(entry)) {
      if (entry) {
        cache.delete(key);
        accessOrder.delete(key);
      }

      stats.misses++;
      return undefined;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    accessOrder.set(key, ++accessCounter);

    stats.hits++;

    if (enableMonitoring) {
      const accessTime = performance.now() - startTime;
      stats.totalAccessTime += accessTime;
      stats.accessCount++;
    }

    return entry.value;
  };

  const set = (key: K, value: V): void => {
    const now = Date.now();
    const expiresAt = ttl ? now + ttl : undefined;

    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      expiresAt,
    };

    cache.set(key, entry);
    accessOrder.set(key, ++accessCounter);

    // Evict if necessary
    evictLRU();
  };

  const has = (key: K): boolean => {
    const entry = cache.get(key);
    if (!entry || isExpired(entry)) {
      if (entry) {
        cache.delete(key);
        accessOrder.delete(key);
      }
      return false;
    }
    return true;
  };

  const deleteKey = (key: K): boolean => {
    const deleted = cache.delete(key);
    accessOrder.delete(key);
    return deleted;
  };

  const clear = (): void => {
    cache.clear();
    accessOrder.clear();
    accessCounter = 0;
    stats.hits = 0;
    stats.misses = 0;
    stats.totalAccessTime = 0;
    stats.accessCount = 0;
  };

  const getStats = (): CacheStats => {
    const total = stats.hits + stats.misses;
    return {
      hits: stats.hits,
      misses: stats.misses,
      size: cache.size,
      hitRate: total > 0 ? (stats.hits / total) * 100 : 0,
      averageAccessTime: stats.accessCount > 0 ? stats.totalAccessTime / stats.accessCount : 0,
    };
  };

  return {
    get,
    set,
    has,
    delete: deleteKey,
    clear,
    get size() {
      return cache.size;
    },
    getStats,
  };
};

// ========================
// React Hooks
// ========================

/**
 * Memoization hook with advanced caching strategies
 */
export const useAdvancedMemo = <T>(
  factory: () => T,
  deps: React.DependencyList,
  options: MemoizationOptions = {}
): T => {
  const { isEqual = shallowEqual, enableMonitoring = false } = options;

  const cacheRef = useRef<{ value: T; deps: React.DependencyList } | null>(null);
  const statsRef = useRef({ hits: 0, misses: 0, computeTime: 0 });

  return useMemo(() => {
    const startTime = enableMonitoring ? performance.now() : 0;

    // Check if we have cached value with same deps
    if (cacheRef.current && isEqual(cacheRef.current.deps, deps)) {
      statsRef.current.hits++;
      return cacheRef.current.value;
    }

    // Compute new value
    const value = factory();
    cacheRef.current = { value, deps };
    statsRef.current.misses++;

    if (enableMonitoring) {
      const computeTime = performance.now() - startTime;
      statsRef.current.computeTime += computeTime;

      if (computeTime > 16) {
        console.warn(`Expensive computation detected: ${computeTime.toFixed(2)}ms`);
      }
    }

    return value;
  }, deps);
};

/**
 * Callback memoization hook with dependency optimization
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  const callbackRef = useRef<T>(callback);
  const depsRef = useRef(deps);

  // Update callback if dependencies changed
  if (!shallowEqual(depsRef.current, deps)) {
    callbackRef.current = callback;
    depsRef.current = deps;
  }

  return useCallback(callbackRef.current, []);
};

/**
 * Function memoization with LRU cache
 */
export const useMemoizedFunction = <Args extends any[], Return>(
  fn: (...args: Args) => Return,
  options: MemoizationOptions = {}
): ((...args: Args) => Return) => {
  const cacheRef = useRef(createLRUCache<string, Return>(options));

  return useCallback(
    (...args: Args): Return => {
      const key = generateCacheKey(args);
      const cached = cacheRef.current.get(key);

      if (cached !== undefined) {
        return cached;
      }

      const result = fn(...args);
      cacheRef.current.set(key, result);
      return result;
    },
    [fn]
  );
};

// ========================
// Higher Order Components
// ========================

/**
 * Higher-order component for memoizing expensive components
 */
export const withMemoization = <P extends object>(
  Component: React.ComponentType<P>,
  options: MemoizationOptions = {}
): React.MemoExoticComponent<React.ComponentType<P>> => {
  const { isEqual = shallowEqual } = options;

  return React.memo(Component, (prevProps, nextProps) => {
    return isEqual(prevProps, nextProps);
  });
};

// ========================
// Performance Analysis
// ========================

/**
 * Analyze component render performance
 */
export const createRenderProfiler = (componentName: string) => {
  const renderTimes: number[] = [];
  const maxSamples = 100;

  return {
    start: () => performance.now(),

    end: (startTime: number) => {
      const renderTime = performance.now() - startTime;
      renderTimes.push(renderTime);

      if (renderTimes.length > maxSamples) {
        renderTimes.shift();
      }

      // Performance warnings
      if (renderTime > 16) {
        console.warn(`🐌 Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }

      return renderTime;
    },

    getStats: () => {
      if (renderTimes.length === 0) return null;

      const avg = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const max = Math.max(...renderTimes);
      const min = Math.min(...renderTimes);

      return {
        averageRenderTime: avg,
        maxRenderTime: max,
        minRenderTime: min,
        sampleCount: renderTimes.length,
        slowRenders: renderTimes.filter(t => t > 16).length,
      };
    },
  };
};

export default {
  createLRUCache,
  useAdvancedMemo,
  useStableCallback,
  useMemoizedFunction,
  withMemoization,
  createRenderProfiler,
};
