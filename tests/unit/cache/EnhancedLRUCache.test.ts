/**
 * Enhanced LRU Cache Unit Tests
 * Comprehensive testing with performance optimization focus
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { LRUCache, LRUCacheConfig, LRUCacheStats } from '../../../src/services/cache/LRUCache';

// Performance monitoring utilities
const PerformanceMonitor = {
  startTimer: (): [number, number] => process.hrtime(),
  endTimer: (start: [number, number]): number => {
    const [seconds, nanoseconds] = process.hrtime(start);
    return seconds * 1000 + nanoseconds / 1000000; // milliseconds
  },
  measureMemory: (): NodeJS.MemoryUsage => process.memoryUsage()
};

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn();
global.performance = { now: mockPerformanceNow } as any;

describe('Enhanced LRU Cache Tests', () => {
  let cache: LRUCache<any>;
  let config: Partial<LRUCacheConfig>;
  let timeCounter: number;

  beforeEach(() => {
    timeCounter = 1000;
    mockPerformanceNow.mockImplementation(() => timeCounter++);
    
    config = {
      maxSize: 100,
      maxMemoryMB: 10,
      defaultTTL: 5000,
      evictionPolicy: 'ADAPTIVE',
      enableStats: true,
      cleanupInterval: 0,
      memoryPressureThreshold: 0.8
    };
    
    cache = new LRUCache<any>(config);
  });

  afterEach(() => {
    cache.destroy();
    jest.clearAllMocks();
  });

  describe('Performance Benchmarks', () => {
    it('should maintain O(1) performance for gets under load', () => {
      // Populate cache
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      const iterations = 10000;
      const start = PerformanceMonitor.startTimer();
      
      for (let i = 0; i < iterations; i++) {
        cache.get(`key${i % 100}`);
      }
      
      const duration = PerformanceMonitor.endTimer(start);
      const avgTimePerOp = duration / iterations;
      
      // Should be under 0.01ms per operation
      expect(avgTimePerOp).toBeLessThan(0.01);
      console.log(`Average get time: ${avgTimePerOp.toFixed(4)}ms`);
    });

    it('should maintain O(1) performance for sets under load', () => {
      const iterations = 10000;
      const start = PerformanceMonitor.startTimer();
      
      for (let i = 0; i < iterations; i++) {
        cache.set(`perf${i}`, `value${i}`);
      }
      
      const duration = PerformanceMonitor.endTimer(start);
      const avgTimePerOp = duration / iterations;
      
      // Should be under 0.02ms per operation (sets are slightly more expensive)
      expect(avgTimePerOp).toBeLessThan(0.02);
      console.log(`Average set time: ${avgTimePerOp.toFixed(4)}ms`);
    });

    it('should handle mixed operations efficiently', () => {
      const operations = 5000;
      const start = PerformanceMonitor.startTimer();
      
      for (let i = 0; i < operations; i++) {
        if (i % 3 === 0) {
          cache.set(`mix${i}`, { data: `value${i}`, timestamp: Date.now() });
        } else if (i % 3 === 1) {
          cache.get(`mix${i - 1}`);
        } else {
          cache.has(`mix${i - 2}`);
        }
      }
      
      const duration = PerformanceMonitor.endTimer(start);
      const avgTimePerOp = duration / operations;
      
      expect(avgTimePerOp).toBeLessThan(0.015);
      console.log(`Average mixed operation time: ${avgTimePerOp.toFixed(4)}ms`);
    });
  });

  describe('Memory Management Tests', () => {
    it('should manage memory efficiently under pressure', () => {
      const memoryCache = new LRUCache<string>({
        maxSize: 1000,
        maxMemoryMB: 5,
        evictionPolicy: 'ADAPTIVE',
        memoryPressureThreshold: 0.7
      });
      
      const initialMemory = PerformanceMonitor.measureMemory();
      
      // Add large objects to trigger memory management
      for (let i = 0; i < 500; i++) {
        const largeValue = 'x'.repeat(10000); // 10KB strings
        memoryCache.set(`large${i}`, largeValue);
      }
      
      const stats = memoryCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeLessThan(5 * 1024 * 1024); // Under 5MB
      
      const finalMemory = PerformanceMonitor.measureMemory();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Under 10MB
      
      memoryCache.destroy();
    });

    it('should detect and handle memory leaks', () => {
      const memoryCache = new LRUCache<{ data: string; refs: any[] }>({
        maxSize: 100,
        maxMemoryMB: 2
      });
      
      const initialMemory = PerformanceMonitor.measureMemory();
      
      // Create objects with potential circular references
      for (let i = 0; i < 50; i++) {
        const obj = {
          data: `object${i}`,
          refs: [] as any[]
        };
        obj.refs.push(obj); // Circular reference
        
        memoryCache.set(`leak${i}`, obj);
      }
      
      // Clear cache
      memoryCache.clear();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = PerformanceMonitor.measureMemory();
      const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Should not have significant memory leaks
      expect(memoryDiff).toBeLessThan(5 * 1024 * 1024); // Under 5MB
      
      memoryCache.destroy();
    });
  });

  describe('Eviction Algorithm Tests', () => {
    it('should test LRU eviction accuracy', () => {
      const lruCache = new LRUCache<string>({
        maxSize: 5,
        evictionPolicy: 'LRU'
      });
      
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        lruCache.set(`key${i}`, `value${i}`);
      }
      
      // Access pattern: key1 (oldest), key3, key5
      lruCache.get('key1');
      lruCache.get('key3');
      lruCache.get('key5');
      
      // Add new item - should evict key2 (least recently used)
      lruCache.set('key6', 'value6');
      
      expect(lruCache.has('key2')).toBe(false);
      expect(lruCache.has('key4')).toBe(false); // Also evicted
      expect(lruCache.has('key1')).toBe(true); // Recently accessed
      expect(lruCache.has('key6')).toBe(true); // New item
      
      lruCache.destroy();
    });

    it('should test LFU eviction accuracy', () => {
      const lfuCache = new LRUCache<string>({
        maxSize: 5,
        evictionPolicy: 'LFU'
      });
      
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        lfuCache.set(`key${i}`, `value${i}`);
      }
      
      // Create frequency pattern
      for (let i = 0; i < 10; i++) lfuCache.get('key1'); // Very frequent
      for (let i = 0; i < 5; i++) lfuCache.get('key2');   // Frequent
      for (let i = 0; i < 2; i++) lfuCache.get('key3');   // Moderate
      lfuCache.get('key4'); // Low frequency
      // key5 not accessed - lowest frequency
      
      // Add new item - should evict key5 (least frequent)
      lfuCache.set('key6', 'value6');
      
      expect(lfuCache.has('key5')).toBe(false); // Evicted
      expect(lfuCache.has('key1')).toBe(true);  // Most frequent
      expect(lfuCache.has('key6')).toBe(true);  // New item
      
      lfuCache.destroy();
    });

    it('should test adaptive eviction intelligence', () => {
      const adaptiveCache = new LRUCache<string>({
        maxSize: 10,
        evictionPolicy: 'ADAPTIVE'
      });
      
      // Create mixed access patterns
      for (let i = 1; i <= 10; i++) {
        adaptiveCache.set(`key${i}`, `value${i}`);
      }
      
      // Hot keys (frequent access)
      for (let i = 0; i < 20; i++) {
        adaptiveCache.get('key1');
        adaptiveCache.get('key2');
      }
      
      // Warm keys (moderate access)
      for (let i = 0; i < 5; i++) {
        adaptiveCache.get('key3');
        adaptiveCache.get('key4');
      }
      
      // Cold keys (rare access)
      adaptiveCache.get('key5');
      
      // Add new items to trigger evictions
      for (let i = 11; i <= 15; i++) {
        adaptiveCache.set(`key${i}`, `value${i}`);
      }
      
      // Hot keys should survive
      expect(adaptiveCache.has('key1')).toBe(true);
      expect(adaptiveCache.has('key2')).toBe(true);
      
      // Some cold keys should be evicted
      const coldKeysRemaining = ['key6', 'key7', 'key8', 'key9', 'key10']
        .filter(key => adaptiveCache.has(key)).length;
      
      expect(coldKeysRemaining).toBeLessThan(5);
      
      adaptiveCache.destroy();
    });
  });

  describe('Concurrent Access Tests', () => {
    it('should handle concurrent reads safely', async () => {
      // Populate cache
      for (let i = 0; i < 50; i++) {
        cache.set(`concurrent${i}`, `value${i}`);
      }
      
      const concurrentReads = 100;
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < concurrentReads; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              const key = `concurrent${i % 50}`;
              const value = cache.get(key);
              resolve({ key, value, success: value !== null });
            }, Math.random() * 10);
          })
        );
      }
      
      const results = await Promise.all(promises);
      const successfulReads = results.filter(r => r.success).length;
      
      // Most reads should succeed
      expect(successfulReads).toBeGreaterThan(concurrentReads * 0.8);
    });

    it('should handle concurrent writes safely', async () => {
      const concurrentWrites = 100;
      const promises: Promise<boolean>[] = [];
      
      for (let i = 0; i < concurrentWrites; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              const result = cache.set(`write${i}`, `value${i}`);
              resolve(result);
            }, Math.random() * 10);
          })
        );
      }
      
      const results = await Promise.all(promises);
      const successfulWrites = results.filter(r => r).length;
      
      // Most writes should succeed
      expect(successfulWrites).toBeGreaterThan(concurrentWrites * 0.8);
      
      // Verify cache state is consistent
      const stats = cache.getStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(config.maxSize!);
    });

    it('should handle mixed concurrent operations', async () => {
      // Pre-populate
      for (let i = 0; i < 30; i++) {
        cache.set(`mixed${i}`, `value${i}`);
      }
      
      const operations = 200;
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < operations; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              const operation = i % 4;
              const key = `mixed${i % 30}`;
              
              let result;
              switch (operation) {
                case 0: // Get
                  result = { type: 'get', success: cache.get(key) !== null };
                  break;
                case 1: // Set
                  result = { type: 'set', success: cache.set(`new${i}`, `value${i}`) };
                  break;
                case 2: // Has
                  result = { type: 'has', success: cache.has(key) };
                  break;
                case 3: // Delete
                  result = { type: 'delete', success: cache.delete(key) };
                  break;
              }
              
              resolve(result);
            }, Math.random() * 20);
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // Verify operations completed
      expect(results.length).toBe(operations);
      
      // Cache should still be functional
      cache.set('test-final', 'final-value');
      expect(cache.get('test-final')).toBe('final-value');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely large values', () => {
      const hugeValue = 'x'.repeat(1024 * 1024); // 1MB string
      
      const result = cache.set('huge', hugeValue);
      expect(result).toBe(true);
      
      const retrieved = cache.get('huge');
      expect(retrieved).toBe(hugeValue);
      
      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(1024 * 1024);
    });

    it('should handle null and undefined values', () => {
      cache.set('null-value', null);
      cache.set('undefined-value', undefined);
      
      expect(cache.get('null-value')).toBe(null);
      expect(cache.get('undefined-value')).toBe(undefined);
      expect(cache.has('null-value')).toBe(true);
      expect(cache.has('undefined-value')).toBe(true);
    });

    it('should handle complex object structures', () => {
      const complexObj = {
        id: 123,
        name: 'test',
        data: {
          nested: {
            deep: {
              array: [1, 2, 3, { key: 'value' }],
              map: new Map([['a', 1], ['b', 2]]),
              set: new Set([1, 2, 3])
            }
          }
        },
        timestamp: new Date(),
        buffer: Buffer.from('test-buffer')
      };
      
      cache.set('complex', complexObj);
      const retrieved = cache.get('complex');
      
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(123);
      expect(retrieved.name).toBe('test');
    });

    it('should handle rapid evictions gracefully', () => {
      const smallCache = new LRUCache<string>({
        maxSize: 3,
        evictionPolicy: 'LRU'
      });
      
      // Rapid additions should trigger many evictions
      for (let i = 0; i < 100; i++) {
        smallCache.set(`rapid${i}`, `value${i}`);
      }
      
      const stats = smallCache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.evictions).toBe(97); // 100 - 3
      
      // Cache should still work
      smallCache.set('final', 'final-value');
      expect(smallCache.get('final')).toBe('final-value');
      
      smallCache.destroy();
    });
  });

  describe('TTL and Expiration Tests', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle cascading expirations', () => {
      // Set items with different TTLs
      cache.set('short', 'value1', 100);
      cache.set('medium', 'value2', 500);
      cache.set('long', 'value3', 1000);
      
      expect(cache.keys().length).toBe(3);
      
      // Expire short TTL
      jest.advanceTimersByTime(200);
      expect(cache.get('short')).toBe(null);
      expect(cache.keys().length).toBe(2);
      
      // Expire medium TTL
      jest.advanceTimersByTime(400);
      expect(cache.get('medium')).toBe(null);
      expect(cache.keys().length).toBe(1);
      
      // Long TTL should still exist
      expect(cache.get('long')).toBe('value3');
      
      // Expire long TTL
      jest.advanceTimersByTime(500);
      expect(cache.get('long')).toBe(null);
      expect(cache.keys().length).toBe(0);
    });

    it('should handle TTL updates correctly', () => {
      cache.set('ttl-test', 'original', 500);
      expect(cache.get('ttl-test')).toBe('original');
      
      // Update with new TTL
      cache.set('ttl-test', 'updated', 1000);
      
      // Should survive original TTL
      jest.advanceTimersByTime(600);
      expect(cache.get('ttl-test')).toBe('updated');
      
      // Should expire at new TTL
      jest.advanceTimersByTime(500);
      expect(cache.get('ttl-test')).toBe(null);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track detailed performance metrics', () => {
      // Generate activity
      for (let i = 0; i < 50; i++) {
        cache.set(`metric${i}`, `value${i}`);
      }
      
      // Generate hits and misses
      for (let i = 0; i < 30; i++) {
        cache.get(`metric${i}`);
      }
      
      for (let i = 0; i < 20; i++) {
        cache.get(`nonexistent${i}`);
      }
      
      const stats = cache.getStats();
      
      expect(stats.hitCount).toBe(30);
      expect(stats.missCount).toBe(20);
      expect(stats.hitRate).toBeCloseTo(0.6, 2);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.averageAccessTime).toBeGreaterThan(0);
    });

    it('should identify hot keys accurately', () => {
      // Create access pattern
      cache.set('hot1', 'value1');
      cache.set('hot2', 'value2');
      cache.set('cold1', 'value3');
      cache.set('cold2', 'value4');
      
      // Access hot keys frequently
      for (let i = 0; i < 20; i++) {
        cache.get('hot1');
      }
      
      for (let i = 0; i < 15; i++) {
        cache.get('hot2');
      }
      
      // Access cold keys rarely
      cache.get('cold1');
      cache.get('cold2');
      
      const hotKeys = cache.getHotKeys(3);
      
      expect(hotKeys.length).toBeGreaterThanOrEqual(2);
      expect(hotKeys[0].key).toBe('hot1');
      expect(hotKeys[1].key).toBe('hot2');
      expect(hotKeys[0].frequency).toBeGreaterThan(hotKeys[1].frequency);
    });
  });

  describe('Optimization Tests', () => {
    it('should optimize performance automatically', () => {
      // Create suboptimal state
      for (let i = 0; i < 50; i++) {
        cache.set(`opt${i}`, `value${i}`, 100); // Short TTL
      }
      
      // Wait for expiration
      jest.useFakeTimers();
      jest.advanceTimersByTime(200);
      jest.useRealTimers();
      
      const statsBefore = cache.getStats();
      
      // Run optimization
      cache.optimize();
      
      const statsAfter = cache.getStats();
      
      // Should clean up expired entries
      expect(statsAfter.size).toBeLessThanOrEqual(statsBefore.size);
    });

    it('should balance performance vs memory usage', () => {
      const balancedCache = new LRUCache<any>({
        maxSize: 100,
        maxMemoryMB: 5,
        evictionPolicy: 'ADAPTIVE',
        memoryPressureThreshold: 0.7
      });
      
      // Add varied size objects
      for (let i = 0; i < 50; i++) {
        const size = Math.floor(Math.random() * 10000) + 1000; // 1KB - 10KB
        balancedCache.set(`balanced${i}`, 'x'.repeat(size));
      }
      
      const stats = balancedCache.getStats();
      
      // Should maintain reasonable memory usage
      expect(stats.memoryUsage).toBeLessThan(5 * 1024 * 1024);
      expect(stats.size).toBeGreaterThan(0);
      
      balancedCache.destroy();
    });
  });
});
