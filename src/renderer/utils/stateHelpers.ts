/**
 * State Management Utilities and Helpers
 * 
 * This module provides utility functions for state management including:
 * - State update utilities for performance optimization
 * - Cache management functions with TTL and LRU eviction
 * - Debouncing and throttling for API calls
 * - Performance monitoring helpers
 * - State normalization and transformation utilities
 * - Memory optimization functions
 * 
 * @author State Management Architect
 * @version 1.0.0
 */

// =====================
// Types and Interfaces
// =====================

export interface CacheOptions {
  maxSize: number;
  ttl: number;
  onEvict?: (key: string, value: any) => void;
  onHit?: (key: string) => void;
  onMiss?: (key: string) => void;
}

export interface CacheItem<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheManager<T> {
  get: (key: string) => T | null;
  set: (key: string, value: T, ttl?: number) => void;
  has: (key: string) => boolean;
  delete: (key: string) => boolean;
  clear: () => void;
  size: () => number;
  keys: () => string[];
  values: () => T[];
  entries: () => Array<[string, T]>;
  stats: () => CacheStats;
}

export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictionCount: number;
  totalOperations: number;
}

export interface PerformanceMetrics {
  operationCount: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastOperation: number;
}

export interface StateHelpers<T> {
  withRecentOperation: (
    state: T, 
    type: string, 
    entryId: string, 
    success: boolean
  ) => T;
  removePendingOperation: (operationId: string) => Set<string>;
  updateMetrics: (state: T, metric: string, value: number) => T;
}

// =====================
// Cache Manager Implementation
// =====================

/**
 * Creates a high-performance cache manager with LRU eviction and TTL support
 * @param options Cache configuration options
 * @returns Cache manager instance
 */
export function createCacheManager<T>(options: CacheOptions): CacheManager<T> {
  const { maxSize, ttl, onEvict, onHit, onMiss } = options;
  
  const cache = new Map<string, CacheItem<T>>();
  const stats = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
    totalOperations: 0,
  };
  
  /**
   * Checks if an item is expired based on TTL
   */
  const isExpired = (item: CacheItem<T>, customTtl?: number): boolean => {
    const itemTtl = customTtl || ttl;
    return Date.now() - item.timestamp > itemTtl;
  };
  
  /**
   * Evicts expired items from cache
   */
  const evictExpired = (): void => {
    for (const [key, item] of cache.entries()) {
      if (isExpired(item)) {
        cache.delete(key);
        stats.evictionCount++;
        onEvict?.(key, item.value);
      }
    }
  };
  
  /**
   * Evicts least recently used items when cache is full
   */
  const evictLRU = (): void => {
    if (cache.size < maxSize) return;
    
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, item] of cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const evictedItem = cache.get(oldestKey);
      cache.delete(oldestKey);
      stats.evictionCount++;
      onEvict?.(oldestKey, evictedItem?.value);
    }
  };
  
  /**
   * Updates access statistics for an item
   */
  const updateAccess = (key: string, item: CacheItem<T>): void => {
    item.accessCount++;
    item.lastAccessed = Date.now();
  };
  
  return {
    get: (key: string): T | null => {
      stats.totalOperations++;
      
      // Clean up expired items periodically
      if (Math.random() < 0.1) { // 10% chance
        evictExpired();
      }
      
      const item = cache.get(key);
      
      if (!item) {
        stats.missCount++;
        onMiss?.(key);
        return null;
      }
      
      if (isExpired(item)) {
        cache.delete(key);
        stats.missCount++;
        stats.evictionCount++;
        onEvict?.(key, item.value);
        onMiss?.(key);
        return null;
      }
      
      updateAccess(key, item);
      stats.hitCount++;
      onHit?.(key);
      return item.value;
    },
    
    set: (key: string, value: T, customTtl?: number): void => {
      stats.totalOperations++;
      
      // Evict LRU items if cache is full
      evictLRU();
      
      const now = Date.now();
      const item: CacheItem<T> = {
        value,
        timestamp: now,
        accessCount: 0,
        lastAccessed: now,
      };
      
      cache.set(key, item);
    },
    
    has: (key: string): boolean => {
      const item = cache.get(key);
      return item ? !isExpired(item) : false;
    },
    
    delete: (key: string): boolean => {
      const existed = cache.has(key);
      if (existed) {
        const item = cache.get(key);
        cache.delete(key);
        onEvict?.(key, item?.value);
      }
      return existed;
    },
    
    clear: (): void => {
      for (const [key, item] of cache.entries()) {
        onEvict?.(key, item.value);
      }
      cache.clear();
      stats.evictionCount += cache.size;
    },
    
    size: (): number => cache.size,
    
    keys: (): string[] => Array.from(cache.keys()),
    
    values: (): T[] => {
      evictExpired();
      return Array.from(cache.values()).map(item => item.value);
    },
    
    entries: (): Array<[string, T]> => {
      evictExpired();
      return Array.from(cache.entries()).map(([key, item]) => [key, item.value]);
    },
    
    stats: (): CacheStats => {
      const totalRequests = stats.hitCount + stats.missCount;
      return {
        ...stats,
        hitRate: totalRequests > 0 ? stats.hitCount / totalRequests : 0,
        size: cache.size,
        maxSize,
      };
    },
  };
}

// =====================
// Debouncing and Throttling
// =====================

/**
 * Creates a debounced version of a function that delays execution
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Creates a throttled version of a function that limits execution frequency
 * @param func Function to throttle
 * @param limit Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// =====================
// Performance Monitoring
// =====================

/**
 * Creates a performance monitor for tracking operation metrics
 * @param name Operation name for identification
 * @returns Performance monitor functions
 */
export function createPerformanceMonitor(name: string) {
  const metrics: PerformanceMetrics = {
    operationCount: 0,
    totalTime: 0,
    averageTime: 0,
    minTime: Infinity,
    maxTime: 0,
    lastOperation: 0,
  };
  
  const startTime = (): number => performance.now();
  
  const endTime = (start: number): void => {
    const duration = performance.now() - start;
    metrics.operationCount++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.operationCount;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    metrics.lastOperation = Date.now();
    
    // Log slow operations
    if (duration > 1000) { // 1 second
      console.warn(`Slow operation detected in ${name}: ${duration.toFixed(2)}ms`);
    }
  };
  
  const getMetrics = (): PerformanceMetrics => ({ ...metrics });
  
  const reset = (): void => {
    metrics.operationCount = 0;
    metrics.totalTime = 0;
    metrics.averageTime = 0;
    metrics.minTime = Infinity;
    metrics.maxTime = 0;
    metrics.lastOperation = 0;
  };
  
  return {
    startTime,
    endTime,
    getMetrics,
    reset,
  };
}

/**
 * Higher-order function to add performance monitoring to any function
 * @param func Function to monitor
 * @param name Operation name
 * @returns Monitored function
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  func: T,
  name: string
): T & { getMetrics: () => PerformanceMetrics } {
  const monitor = createPerformanceMonitor(name);
  
  const wrappedFunc = ((...args: Parameters<T>) => {
    const start = monitor.startTime();
    try {
      const result = func(...args);
      
      // Handle both sync and async functions
      if (result instanceof Promise) {
        return result.finally(() => monitor.endTime(start));
      } else {
        monitor.endTime(start);
        return result;
      }
    } catch (error) {
      monitor.endTime(start);
      throw error;
    }
  }) as T & { getMetrics: () => PerformanceMetrics };
  
  wrappedFunc.getMetrics = monitor.getMetrics;
  
  return wrappedFunc;
}

// =====================
// State Management Helpers
// =====================

/**
 * Creates helper functions for state management operations
 * @param state Current state
 * @returns Helper functions
 */
export function createStateHelpers<T extends any>(state: T): StateHelpers<T> {
  return {
    withRecentOperation: (
      currentState: T,
      type: string,
      entryId: string,
      success: boolean
    ): T => {
      // This is a generic implementation - specific contexts should override
      return currentState;
    },
    
    removePendingOperation: (operationId: string): Set<string> => {
      if ('pendingOperations' in state && state.pendingOperations instanceof Set) {
        const newSet = new Set(state.pendingOperations);
        newSet.delete(operationId);
        return newSet;
      }
      return new Set();
    },
    
    updateMetrics: (currentState: T, metric: string, value: number): T => {
      // Generic metrics update - can be customized per context
      return currentState;
    },
  };
}

// =====================
// Data Normalization
// =====================

/**
 * Normalizes an array of objects by a key field into a Map
 * @param array Array of objects
 * @param keyField Field to use as key
 * @returns Normalized Map
 */
export function normalizeArray<T extends Record<string, any>>(
  array: T[],
  keyField: keyof T
): Map<string, T> {
  return new Map(array.map(item => [String(item[keyField]), item]));
}

/**
 * Denormalizes a Map back to an array
 * @param map Normalized Map
 * @returns Array of values
 */
export function denormalizeMap<T>(map: Map<string, T>): T[] {
  return Array.from(map.values());
}

// =====================
// Memory Optimization
// =====================

/**
 * Creates a memory-efficient Set that automatically limits size
 * @param maxSize Maximum number of items
 * @returns Limited Set
 */
export function createLimitedSet<T>(maxSize: number): Set<T> {
  const set = new Set<T>();
  
  return new Proxy(set, {
    get(target, prop) {
      if (prop === 'add') {
        return (value: T) => {
          if (target.size >= maxSize) {
            // Remove the first (oldest) item
            const firstItem = target.values().next().value;
            target.delete(firstItem);
          }
          return target.add(value);
        };
      }
      return target[prop as keyof Set<T>];
    }
  });
}

/**
 * Deep clones an object with performance optimizations
 * @param obj Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  if (obj instanceof Map) {
    const clonedMap = new Map();
    obj.forEach((value, key) => {
      clonedMap.set(key, deepClone(value));
    });
    return clonedMap as T;
  }
  
  if (obj instanceof Set) {
    const clonedSet = new Set();
    obj.forEach(value => {
      clonedSet.add(deepClone(value));
    });
    return clonedSet as T;
  }
  
  if (typeof obj === 'object') {
    const clonedObj: any = {};
    Object.keys(obj).forEach(key => {
      clonedObj[key] = deepClone((obj as any)[key]);
    });
    return clonedObj;
  }
  
  return obj;
}

// =====================
// Utility Functions
// =====================

/**
 * Batches array operations for better performance
 * @param array Array to process
 * @param batchSize Size of each batch
 * @param processor Function to process each batch
 * @returns Promise that resolves when all batches are processed
 */
export async function processBatches<T, R>(
  array: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Creates a retry mechanism with exponential backoff
 * @param func Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 * @returns Function that retries on failure
 */
export function createRetryMechanism<T extends (...args: any[]) => Promise<any>>(
  func: T,
  maxRetries: number = 3,
  baseDelay: number = 1000
): T {
  return (async (...args: Parameters<T>) => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await func(...args);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }) as T;
}

/**
 * Memoizes function results with TTL support
 * @param func Function to memoize
 * @param keyGenerator Function to generate cache key
 * @param ttl Time to live in milliseconds
 * @returns Memoized function
 */
export function memoizeWithTTL<T extends (...args: any[]) => any>(
  func: T,
  keyGenerator: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args),
  ttl: number = 5 * 60 * 1000 // 5 minutes
): T {
  const cache = createCacheManager<ReturnType<T>>({ maxSize: 100, ttl });
  
  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);
    
    if (cached !== null) {
      return cached;
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// =====================
// Export all utilities
// =====================

export default {
  createCacheManager,
  debounce,
  throttle,
  createPerformanceMonitor,
  withPerformanceMonitoring,
  createStateHelpers,
  normalizeArray,
  denormalizeMap,
  createLimitedSet,
  deepClone,
  processBatches,
  createRetryMechanism,
  memoizeWithTTL,
};