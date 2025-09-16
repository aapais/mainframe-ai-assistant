/**
 * Unit Tests for State Management Utilities and Helpers
 * 
 * Tests for utility functions including:
 * - Cache manager with LRU eviction and TTL support
 * - Debouncing and throttling functions
 * - Performance monitoring utilities
 * - State management helpers
 * - Data normalization functions
 * - Memory optimization utilities
 * - Retry mechanisms and batch processing
 * - Edge cases and error handling
 * 
 * @author Test Engineer
 * @version 1.0.0
 */

import {
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
  CacheOptions,
  CacheManager,
  PerformanceMetrics,
} from '../stateHelpers';

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn();
global.performance.now = mockPerformanceNow;

describe('Cache Manager', () => {
  let cache: CacheManager<string>;
  let onEvictSpy: jest.Mock;
  let onHitSpy: jest.Mock;
  let onMissSpy: jest.Mock;

  beforeEach(() => {
    onEvictSpy = jest.fn();
    onHitSpy = jest.fn();
    onMissSpy = jest.fn();
    
    cache = createCacheManager<string>({
      maxSize: 3,
      ttl: 1000, // 1 second
      onEvict: onEvictSpy,
      onHit: onHitSpy,
      onMiss: onMissSpy,
    });

    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.size()).toBe(1);
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.has('key1')).toBe(false);
      expect(cache.size()).toBe(0);
    });

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL (Time To Live) Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockPerformanceNow.mockImplementation(() => Date.now());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire entries based on TTL', () => {
      cache.set('key1', 'value1');
      
      expect(cache.get('key1')).toBe('value1');
      
      // Fast-forward time past TTL
      jest.advanceTimersByTime(1500);
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.has('key1')).toBe(false);
    });

    it('should call onEvict when entries expire', () => {
      cache.set('key1', 'value1');
      
      // Fast-forward time past TTL
      jest.advanceTimersByTime(1500);
      cache.get('key1'); // This should trigger expiration
      
      expect(onEvictSpy).toHaveBeenCalledWith('key1', 'value1');
    });

    it('should support custom TTL per entry', () => {
      cache.set('key1', 'value1', 500); // Custom TTL of 500ms
      
      jest.advanceTimersByTime(600);
      
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('LRU (Least Recently Used) Eviction', () => {
    it('should evict least recently used item when cache is full', () => {
      // Fill cache to capacity
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 to make it more recently used
      cache.get('key1');
      
      // Add another item - should evict key2 (least recently used)
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBe('value1'); // Still exists
      expect(cache.get('key2')).toBeNull(); // Evicted
      expect(cache.get('key3')).toBe('value3'); // Still exists
      expect(cache.get('key4')).toBe('value4'); // Newly added
      expect(cache.size()).toBe(3);
      expect(onEvictSpy).toHaveBeenCalledWith('key2', 'value2');
    });

    it('should not evict when cache is not full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      expect(onEvictSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cache Statistics and Callbacks', () => {
    it('should call hit callback on cache hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      
      expect(onHitSpy).toHaveBeenCalledWith('key1');
    });

    it('should call miss callback on cache misses', () => {
      cache.get('nonexistent');
      
      expect(onMissSpy).toHaveBeenCalledWith('nonexistent');
    });

    it('should provide accurate cache statistics', () => {
      // Hit
      cache.set('key1', 'value1');
      cache.get('key1');
      
      // Miss
      cache.get('nonexistent');
      
      // Another hit
      cache.get('key1');
      
      const stats = cache.stats();
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3, 2);
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(3);
    });

    it('should handle zero operations in statistics', () => {
      const stats = cache.stats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.totalOperations).toBe(0);
    });
  });

  describe('Collection Methods', () => {
    beforeEach(() => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
    });

    it('should return all keys', () => {
      const keys = cache.keys();
      expect(keys.sort()).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return all values', () => {
      const values = cache.values();
      expect(values.sort()).toEqual(['value1', 'value2', 'value3']);
    });

    it('should return all entries', () => {
      const entries = cache.entries();
      expect(entries.sort()).toEqual([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
      ].sort());
    });
  });

  describe('Memory Management', () => {
    it('should periodically clean expired entries during get operations', () => {
      jest.useFakeTimers();
      mockPerformanceNow.mockImplementation(() => Date.now());
      
      cache.set('key1', 'value1');
      
      // Advance time past TTL
      jest.advanceTimersByTime(1500);
      
      // Mock Math.random to always trigger cleanup (10% chance)
      const originalRandom = Math.random;
      Math.random = () => 0.05; // Less than 0.1
      
      // This should trigger cleanup
      cache.get('key2'); // Non-existent key, but should trigger cleanup
      
      expect(cache.size()).toBe(0); // Expired entry should be cleaned up
      
      Math.random = originalRandom;
      jest.useRealTimers();
    });

    it('should handle large number of operations efficiently', () => {
      const largeCache = createCacheManager<number>({ maxSize: 1000, ttl: 5000 });
      
      const startTime = performance.now();
      
      // Add many entries
      for (let i = 0; i < 500; i++) {
        largeCache.set(`key${i}`, i);
      }
      
      // Read many entries
      for (let i = 0; i < 500; i++) {
        largeCache.get(`key${i}`);
      }
      
      const endTime = performance.now();
      const operationTime = endTime - startTime;
      
      expect(operationTime).toBeLessThan(100); // Should complete in under 100ms
      expect(largeCache.size()).toBe(500);
    });
  });
});

describe('Debounce Function', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should delay function execution', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 300);
    
    debouncedFn('arg1');
    
    expect(mockFn).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(300);
    
    expect(mockFn).toHaveBeenCalledWith('arg1');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls when called again', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 300);
    
    debouncedFn('arg1');
    jest.advanceTimersByTime(200);
    
    debouncedFn('arg2'); // This should cancel the previous call
    jest.advanceTimersByTime(300);
    
    expect(mockFn).toHaveBeenCalledWith('arg2');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple arguments', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);
    
    debouncedFn('arg1', 'arg2', 'arg3');
    jest.advanceTimersByTime(100);
    
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('should work with different delay values', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 500);
    
    debouncedFn();
    jest.advanceTimersByTime(400); // Less than delay
    
    expect(mockFn).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(100); // Now total is 500
    
    expect(mockFn).toHaveBeenCalled();
  });
});

describe('Throttle Function', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should limit function execution frequency', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 300);
    
    throttledFn('call1');
    throttledFn('call2');
    throttledFn('call3');
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call1');
  });

  it('should allow execution after throttle period', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 300);
    
    throttledFn('call1');
    jest.advanceTimersByTime(300);
    throttledFn('call2');
    
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenNthCalledWith(1, 'call1');
    expect(mockFn).toHaveBeenNthCalledWith(2, 'call2');
  });

  it('should handle rapid successive calls', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);
    
    for (let i = 0; i < 10; i++) {
      throttledFn(`call${i}`);
    }
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call0');
  });
});

describe('Performance Monitor', () => {
  beforeEach(() => {
    mockPerformanceNow.mockClear();
  });

  it('should create performance monitor with correct initial state', () => {
    const monitor = createPerformanceMonitor('test-operation');
    const metrics = monitor.getMetrics();
    
    expect(metrics.operationCount).toBe(0);
    expect(metrics.totalTime).toBe(0);
    expect(metrics.averageTime).toBe(0);
    expect(metrics.minTime).toBe(Infinity);
    expect(metrics.maxTime).toBe(0);
  });

  it('should track operation timing', () => {
    const monitor = createPerformanceMonitor('test-operation');
    
    mockPerformanceNow
      .mockReturnValueOnce(0)    // startTime
      .mockReturnValueOnce(100); // endTime
    
    const start = monitor.startTime();
    monitor.endTime(start);
    
    const metrics = monitor.getMetrics();
    expect(metrics.operationCount).toBe(1);
    expect(metrics.totalTime).toBe(100);
    expect(metrics.averageTime).toBe(100);
    expect(metrics.minTime).toBe(100);
    expect(metrics.maxTime).toBe(100);
  });

  it('should calculate correct averages over multiple operations', () => {
    const monitor = createPerformanceMonitor('test-operation');
    
    // First operation: 100ms
    mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100);
    monitor.endTime(monitor.startTime());
    
    // Second operation: 200ms
    mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(200);
    monitor.endTime(monitor.startTime());
    
    const metrics = monitor.getMetrics();
    expect(metrics.operationCount).toBe(2);
    expect(metrics.totalTime).toBe(300);
    expect(metrics.averageTime).toBe(150);
    expect(metrics.minTime).toBe(100);
    expect(metrics.maxTime).toBe(200);
  });

  it('should warn about slow operations', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const monitor = createPerformanceMonitor('slow-operation');
    
    mockPerformanceNow
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2000); // 2 seconds
    
    monitor.endTime(monitor.startTime());
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Slow operation detected in slow-operation: 2000.00ms'
    );
    
    consoleSpy.mockRestore();
  });

  it('should reset metrics correctly', () => {
    const monitor = createPerformanceMonitor('test-operation');
    
    mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100);
    monitor.endTime(monitor.startTime());
    
    monitor.reset();
    
    const metrics = monitor.getMetrics();
    expect(metrics.operationCount).toBe(0);
    expect(metrics.totalTime).toBe(0);
    expect(metrics.averageTime).toBe(0);
    expect(metrics.minTime).toBe(Infinity);
    expect(metrics.maxTime).toBe(0);
  });
});

describe('Performance Monitoring HOF', () => {
  beforeEach(() => {
    mockPerformanceNow.mockClear();
  });

  it('should monitor synchronous functions', () => {
    const originalFn = jest.fn((x: number) => x * 2);
    
    mockPerformanceNow
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(50);
    
    const monitoredFn = withPerformanceMonitoring(originalFn, 'sync-function');
    
    const result = monitoredFn(5);
    
    expect(result).toBe(10);
    expect(originalFn).toHaveBeenCalledWith(5);
    
    const metrics = monitoredFn.getMetrics();
    expect(metrics.operationCount).toBe(1);
    expect(metrics.totalTime).toBe(50);
  });

  it('should monitor asynchronous functions', async () => {
    const originalFn = jest.fn(async (x: number) => {
      await new Promise(resolve => setTimeout(resolve, 0));
      return x * 2;
    });
    
    mockPerformanceNow
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100);
    
    const monitoredFn = withPerformanceMonitoring(originalFn, 'async-function');
    
    const result = await monitoredFn(5);
    
    expect(result).toBe(10);
    expect(originalFn).toHaveBeenCalledWith(5);
    
    const metrics = monitoredFn.getMetrics();
    expect(metrics.operationCount).toBe(1);
    expect(metrics.totalTime).toBe(100);
  });

  it('should handle errors in synchronous functions', () => {
    const originalFn = jest.fn(() => {
      throw new Error('Test error');
    });
    
    mockPerformanceNow
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(25);
    
    const monitoredFn = withPerformanceMonitoring(originalFn, 'error-function');
    
    expect(() => monitoredFn()).toThrow('Test error');
    
    const metrics = monitoredFn.getMetrics();
    expect(metrics.operationCount).toBe(1);
    expect(metrics.totalTime).toBe(25);
  });

  it('should handle errors in asynchronous functions', async () => {
    const originalFn = jest.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      throw new Error('Async test error');
    });
    
    mockPerformanceNow
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(75);
    
    const monitoredFn = withPerformanceMonitoring(originalFn, 'async-error-function');
    
    await expect(monitoredFn()).rejects.toThrow('Async test error');
    
    const metrics = monitoredFn.getMetrics();
    expect(metrics.operationCount).toBe(1);
    expect(metrics.totalTime).toBe(75);
  });
});

describe('State Helpers', () => {
  it('should create state helpers with generic implementation', () => {
    const state = { counter: 0, pendingOperations: new Set(['op1', 'op2']) };
    const helpers = createStateHelpers(state);
    
    expect(helpers).toBeDefined();
    expect(typeof helpers.withRecentOperation).toBe('function');
    expect(typeof helpers.removePendingOperation).toBe('function');
    expect(typeof helpers.updateMetrics).toBe('function');
  });

  it('should remove pending operations correctly', () => {
    const state = { pendingOperations: new Set(['op1', 'op2', 'op3']) };
    const helpers = createStateHelpers(state);
    
    const newSet = helpers.removePendingOperation('op2');
    
    expect(newSet.has('op1')).toBe(true);
    expect(newSet.has('op2')).toBe(false);
    expect(newSet.has('op3')).toBe(true);
    expect(newSet.size).toBe(2);
  });

  it('should handle missing pendingOperations gracefully', () => {
    const state = { counter: 0 };
    const helpers = createStateHelpers(state);
    
    const newSet = helpers.removePendingOperation('op1');
    
    expect(newSet instanceof Set).toBe(true);
    expect(newSet.size).toBe(0);
  });
});

describe('Data Normalization', () => {
  const testData = [
    { id: '1', name: 'Item 1', value: 100 },
    { id: '2', name: 'Item 2', value: 200 },
    { id: '3', name: 'Item 3', value: 300 },
  ];

  it('should normalize array to Map', () => {
    const normalized = normalizeArray(testData, 'id');
    
    expect(normalized instanceof Map).toBe(true);
    expect(normalized.size).toBe(3);
    expect(normalized.get('1')).toEqual(testData[0]);
    expect(normalized.get('2')).toEqual(testData[1]);
    expect(normalized.get('3')).toEqual(testData[2]);
  });

  it('should handle empty arrays', () => {
    const normalized = normalizeArray([], 'id');
    
    expect(normalized instanceof Map).toBe(true);
    expect(normalized.size).toBe(0);
  });

  it('should denormalize Map to array', () => {
    const map = new Map([
      ['1', testData[0]],
      ['2', testData[1]],
      ['3', testData[2]],
    ]);
    
    const denormalized = denormalizeMap(map);
    
    expect(Array.isArray(denormalized)).toBe(true);
    expect(denormalized).toHaveLength(3);
    expect(denormalized).toEqual(expect.arrayContaining(testData));
  });

  it('should handle empty Maps', () => {
    const denormalized = denormalizeMap(new Map());
    
    expect(Array.isArray(denormalized)).toBe(true);
    expect(denormalized).toHaveLength(0);
  });
});

describe('Memory Optimization', () => {
  describe('Limited Set', () => {
    it('should create a set with size limit', () => {
      const limitedSet = createLimitedSet<number>(3);
      
      limitedSet.add(1);
      limitedSet.add(2);
      limitedSet.add(3);
      
      expect(limitedSet.size).toBe(3);
      expect(limitedSet.has(1)).toBe(true);
      expect(limitedSet.has(2)).toBe(true);
      expect(limitedSet.has(3)).toBe(true);
    });

    it('should evict oldest item when limit exceeded', () => {
      const limitedSet = createLimitedSet<number>(2);
      
      limitedSet.add(1);
      limitedSet.add(2);
      limitedSet.add(3); // Should evict 1
      
      expect(limitedSet.size).toBe(2);
      expect(limitedSet.has(1)).toBe(false);
      expect(limitedSet.has(2)).toBe(true);
      expect(limitedSet.has(3)).toBe(true);
    });

    it('should support standard Set operations', () => {
      const limitedSet = createLimitedSet<string>(5);
      
      limitedSet.add('a');
      limitedSet.add('b');
      
      expect(limitedSet.has('a')).toBe(true);
      expect(limitedSet.delete('a')).toBe(true);
      expect(limitedSet.has('a')).toBe(false);
      expect(limitedSet.size).toBe(1);
    });
  });

  describe('Deep Clone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(5)).toBe(5);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('should clone Date objects', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);
      
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
      expect(cloned instanceof Date).toBe(true);
    });

    it('should clone arrays recursively', () => {
      const array = [1, [2, 3], { a: 4 }];
      const cloned = deepClone(array);
      
      expect(cloned).toEqual(array);
      expect(cloned).not.toBe(array);
      expect(cloned[1]).not.toBe(array[1]);
      expect(cloned[2]).not.toBe(array[2]);
    });

    it('should clone objects recursively', () => {
      const obj = {
        a: 1,
        b: { c: 2, d: [3, 4] },
        e: new Date('2024-01-01'),
      };
      const cloned = deepClone(obj);
      
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
      expect(cloned.b.d).not.toBe(obj.b.d);
      expect(cloned.e).not.toBe(obj.e);
    });

    it('should clone Maps', () => {
      const map = new Map([
        ['key1', { value: 1 }],
        ['key2', { value: 2 }],
      ]);
      const cloned = deepClone(map);
      
      expect(cloned).toEqual(map);
      expect(cloned).not.toBe(map);
      expect(cloned.get('key1')).toEqual(map.get('key1'));
      expect(cloned.get('key1')).not.toBe(map.get('key1'));
    });

    it('should clone Sets', () => {
      const set = new Set([{ value: 1 }, { value: 2 }]);
      const cloned = deepClone(set);
      
      expect(cloned.size).toBe(set.size);
      expect(cloned).not.toBe(set);
      // Note: Since Set values are objects, we can't directly compare them
      // but we can verify the structure is preserved
      expect(cloned instanceof Set).toBe(true);
    });
  });
});

describe('Batch Processing', () => {
  it('should process arrays in batches', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const processor = jest.fn(async (batch: number[]) => 
      batch.map(x => x * 2)
    );
    
    const results = await processBatches(items, 3, processor);
    
    expect(processor).toHaveBeenCalledTimes(3);
    expect(processor).toHaveBeenNthCalledWith(1, [1, 2, 3]);
    expect(processor).toHaveBeenNthCalledWith(2, [4, 5, 6]);
    expect(processor).toHaveBeenNthCalledWith(3, [7]);
    
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it('should handle empty arrays', async () => {
    const processor = jest.fn(async (batch: any[]) => batch);
    
    const results = await processBatches([], 5, processor);
    
    expect(processor).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it('should handle single batch', async () => {
    const items = [1, 2];
    const processor = jest.fn(async (batch: number[]) => batch);
    
    const results = await processBatches(items, 5, processor);
    
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith([1, 2]);
    expect(results).toEqual([1, 2]);
  });
});

describe('Retry Mechanism', () => {
  it('should succeed on first attempt', async () => {
    const successFn = jest.fn(async () => 'success');
    const retryFn = createRetryMechanism(successFn, 3, 100);
    
    const result = await retryFn();
    
    expect(result).toBe('success');
    expect(successFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const retryFn = jest.fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockResolvedValueOnce('success');
    
    const wrappedFn = createRetryMechanism(retryFn, 3, 50);
    
    jest.useFakeTimers();
    const resultPromise = wrappedFn();
    
    // Fast-forward through retry delays
    await jest.runAllTimersAsync();
    
    const result = await resultPromise;
    
    expect(result).toBe('success');
    expect(retryFn).toHaveBeenCalledTimes(3);
    
    jest.useRealTimers();
  });

  it('should throw after max retries exceeded', async () => {
    const failFn = jest.fn(async () => {
      throw new Error('Always fails');
    });
    
    const retryFn = createRetryMechanism(failFn, 2, 50);
    
    jest.useFakeTimers();
    const resultPromise = retryFn();
    
    // Fast-forward through retry delays
    await jest.runAllTimersAsync();
    
    await expect(resultPromise).rejects.toThrow('Always fails');
    expect(failFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    
    jest.useRealTimers();
  });

  it('should use exponential backoff', async () => {
    const failFn = jest.fn(async () => {
      throw new Error('Always fails');
    });
    
    const retryFn = createRetryMechanism(failFn, 3, 100);
    
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    
    const resultPromise = retryFn();
    
    // Fast-forward through all timers
    await jest.runAllTimersAsync();
    
    await expect(resultPromise).rejects.toThrow('Always fails');
    
    // Verify exponential backoff delays: 100ms, 200ms, 400ms
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 400);
    
    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });
});

describe('Memoization with TTL', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should memoize function results', () => {
    const expensiveFn = jest.fn((x: number) => x * 2);
    const memoized = memoizeWithTTL(expensiveFn, undefined, 1000);
    
    expect(memoized(5)).toBe(10);
    expect(memoized(5)).toBe(10); // Should use cached result
    
    expect(expensiveFn).toHaveBeenCalledTimes(1);
  });

  it('should use custom key generator', () => {
    const fn = jest.fn((obj: { x: number, y: number }) => obj.x + obj.y);
    const keyGen = (obj: { x: number, y: number }) => `${obj.x}-${obj.y}`;
    const memoized = memoizeWithTTL(fn, keyGen, 1000);
    
    expect(memoized({ x: 1, y: 2 })).toBe(3);
    expect(memoized({ x: 1, y: 2 })).toBe(3); // Should use cached result
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should expire cached results after TTL', () => {
    const fn = jest.fn((x: number) => x * 3);
    const memoized = memoizeWithTTL(fn, undefined, 1000);
    
    expect(memoized(5)).toBe(15);
    
    // Advance time past TTL
    jest.advanceTimersByTime(1500);
    
    expect(memoized(5)).toBe(15); // Should call function again
    
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle different arguments separately', () => {
    const fn = jest.fn((x: number) => x * 4);
    const memoized = memoizeWithTTL(fn, undefined, 1000);
    
    expect(memoized(2)).toBe(8);
    expect(memoized(3)).toBe(12);
    expect(memoized(2)).toBe(8); // Cached
    expect(memoized(3)).toBe(12); // Cached
    
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('Error Handling and Edge Cases', () => {
  it('should handle cache operations with undefined values', () => {
    const cache = createCacheManager<undefined>({ maxSize: 5, ttl: 1000 });
    
    cache.set('key1', undefined);
    
    expect(cache.get('key1')).toBe(undefined);
    expect(cache.has('key1')).toBe(true);
  });

  it('should handle very small cache sizes', () => {
    const cache = createCacheManager<string>({ maxSize: 1, ttl: 1000 });
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2'); // Should evict key1
    
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.size()).toBe(1);
  });

  it('should handle zero TTL values', () => {
    const cache = createCacheManager<string>({ maxSize: 5, ttl: 0 });
    
    cache.set('key1', 'value1');
    
    // With 0 TTL, items should expire immediately
    expect(cache.get('key1')).toBeNull();
  });

  it('should handle debounce with zero delay', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 0);
    
    debouncedFn('test');
    
    // With 0 delay, function should execute in next tick
    jest.runAllTimers();
    
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should handle throttle with zero limit', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 0);
    
    throttledFn('test');
    throttledFn('test2');
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should handle deep clone of circular references', () => {
    const obj: any = { a: 1 };
    obj.self = obj; // Create circular reference
    
    // Deep clone should handle this gracefully (though it might not preserve circularity)
    // The important thing is it doesn't crash
    expect(() => deepClone(obj)).not.toThrow();
  });
});