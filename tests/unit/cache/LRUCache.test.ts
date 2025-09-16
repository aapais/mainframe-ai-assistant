/**
 * LRU Cache Unit Tests
 * Comprehensive testing of the high-performance LRU cache implementation
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { LRUCache, LRUCacheConfig, LRUCacheStats } from '../../../src/services/cache/LRUCache';

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn();
global.performance = { now: mockPerformanceNow } as any;

describe('LRUCache', () => {
  let cache: LRUCache<string>;
  let config: Partial<LRUCacheConfig>;
  let timeCounter: number;

  beforeEach(() => {
    timeCounter = 1000;
    mockPerformanceNow.mockImplementation(() => timeCounter++);
    
    config = {
      maxSize: 5,
      maxMemoryMB: 1,
      defaultTTL: 1000,
      evictionPolicy: 'LRU',
      enableStats: true,
      cleanupInterval: 0, // Disable automatic cleanup for testing
      memoryPressureThreshold: 0.8
    };
    
    cache = new LRUCache<string>(config);
  });

  afterEach(() => {
    cache.destroy();
    jest.clearAllMocks();
  });

  describe('Basic Operations', () => {
    it('should set and get values correctly', () => {
      const result = cache.set('key1', 'value1');
      expect(result).toBe(true);
      
      const value = cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const value = cache.get('nonexistent');
      expect(value).toBe(null);
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete keys correctly', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
      
      // Delete non-existent key
      const deletedNonExistent = cache.delete('nonexistent');
      expect(deletedNonExistent).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      expect(cache.keys().length).toBe(3);
      
      cache.clear();
      expect(cache.keys().length).toBe(0);
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('LRU Eviction Policy', () => {
    it('should evict least recently used items when at capacity', () => {
      // Fill cache to capacity
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      expect(cache.keys().length).toBe(5);
      expect(cache.has('key1')).toBe(true);
      
      // Add one more item - should evict key1 (least recently used)
      cache.set('key6', 'value6');
      
      expect(cache.keys().length).toBe(5);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key6')).toBe(true);
    });

    it('should update access order when getting items', () => {
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Access key1 to make it most recently used
      cache.get('key1');
      
      // Add new item - should evict key2 now (least recently used)
      cache.set('key6', 'value6');
      
      expect(cache.has('key1')).toBe(true); // Should still exist
      expect(cache.has('key2')).toBe(false); // Should be evicted
      expect(cache.has('key6')).toBe(true);
    });

    it('should update access order when setting existing items', () => {
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Update key1 to make it most recently used
      cache.set('key1', 'new_value1');
      
      // Add new item - should evict key2 now
      cache.set('key6', 'value6');
      
      expect(cache.get('key1')).toBe('new_value1'); // Should still exist with new value
      expect(cache.has('key2')).toBe(false); // Should be evicted
    });
  });

  describe('TTL (Time To Live)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should respect default TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      // Advance time beyond default TTL
      jest.advanceTimersByTime(2000);
      
      expect(cache.get('key1')).toBe(null);
      expect(cache.has('key1')).toBe(false);
    });

    it('should respect custom TTL', () => {
      cache.set('key1', 'value1', 500); // 500ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      // Advance time to just before expiry
      jest.advanceTimersByTime(400);
      expect(cache.get('key1')).toBe('value1');
      
      // Advance time beyond TTL
      jest.advanceTimersByTime(200);
      expect(cache.get('key1')).toBe(null);
    });

    it('should remove expired items from keys list', () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 1500);
      
      expect(cache.keys()).toHaveLength(2);
      
      // Expire first key
      jest.advanceTimersByTime(1000);
      
      const keys = cache.keys();
      expect(keys).toHaveLength(1);
      expect(keys).toContain('key2');
      expect(keys).not.toContain('key1');
    });
  });

  describe('Memory Management', () => {
    it('should estimate memory usage correctly', () => {
      cache.set('key1', 'small');
      cache.set('key2', 'this is a much longer string that should use more memory');
      
      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should evict based on memory pressure', () => {
      const largeCache = new LRUCache<string>({
        maxSize: 10,
        maxMemoryMB: 0.001, // Very small memory limit
        evictionPolicy: 'LRU',
        enableStats: true
      });
      
      // Add items that should exceed memory limit
      largeCache.set('key1', 'x'.repeat(1000));
      largeCache.set('key2', 'y'.repeat(1000));
      
      const stats = largeCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      
      largeCache.destroy();
    });
  });

  describe('Statistics', () => {
    it('should track hit and miss counts', () => {
      cache.set('key1', 'value1');
      
      // Hit
      cache.get('key1');
      cache.get('key1');
      
      // Miss
      cache.get('nonexistent');
      
      const stats = cache.getStats();
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2/3);
    });

    it('should track cache size', () => {
      expect(cache.getStats().size).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.getStats().size).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.getStats().size).toBe(2);
      
      cache.delete('key1');
      expect(cache.getStats().size).toBe(1);
    });

    it('should track eviction count', () => {
      // Fill beyond capacity to trigger evictions
      for (let i = 1; i <= 7; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(2); // Should have evicted 2 items
    });

    it('should calculate average access time', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      
      const stats = cache.getStats();
      expect(stats.averageAccessTime).toBeGreaterThan(0);
    });
  });

  describe('Hot Keys', () => {
    it('should identify hot keys based on frequency', () => {
      cache.set('hot1', 'value1');
      cache.set('hot2', 'value2');
      cache.set('cold1', 'value3');
      
      // Access hot keys multiple times
      for (let i = 0; i < 10; i++) {
        cache.get('hot1');
      }
      
      for (let i = 0; i < 5; i++) {
        cache.get('hot2');
      }
      
      // Access cold key once
      cache.get('cold1');
      
      const hotKeys = cache.getHotKeys(2);
      expect(hotKeys).toHaveLength(2);
      expect(hotKeys[0].key).toBe('hot1');
      expect(hotKeys[1].key).toBe('hot2');
      expect(hotKeys[0].frequency).toBeGreaterThan(hotKeys[1].frequency);
    });
  });

  describe('Advanced Eviction Policies', () => {
    it('should handle LFU eviction policy', () => {
      const lfuCache = new LRUCache<string>({
        ...config,
        evictionPolicy: 'LFU'
      });
      
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        lfuCache.set(`key${i}`, `value${i}`);
      }
      
      // Make key1 most frequent
      for (let i = 0; i < 5; i++) {
        lfuCache.get('key1');
      }
      
      // Make key2 second most frequent
      for (let i = 0; i < 3; i++) {
        lfuCache.get('key2');
      }
      
      // Add new item - should evict least frequent
      lfuCache.set('key6', 'value6');
      
      expect(lfuCache.has('key1')).toBe(true); // Most frequent
      expect(lfuCache.has('key2')).toBe(true); // Second most frequent
      expect(lfuCache.has('key6')).toBe(true); // New item
      
      lfuCache.destroy();
    });

    it('should handle ARC eviction policy', () => {
      const arcCache = new LRUCache<string>({
        ...config,
        evictionPolicy: 'ARC'
      });
      
      // Fill cache
      for (let i = 1; i <= 5; i++) {
        arcCache.set(`key${i}`, `value${i}`);
      }
      
      // Access pattern to test ARC behavior
      arcCache.get('key1');
      arcCache.get('key1'); // Make it frequent
      
      // Add new item
      arcCache.set('key6', 'value6');
      
      expect(arcCache.has('key6')).toBe(true);
      
      arcCache.destroy();
    });

    it('should handle adaptive eviction policy', () => {
      const adaptiveCache = new LRUCache<string>({
        ...config,
        evictionPolicy: 'ADAPTIVE'
      });
      
      // Test adaptive behavior
      for (let i = 1; i <= 5; i++) {
        adaptiveCache.set(`key${i}`, `value${i}`);
      }
      
      // Create hot and cold access patterns
      for (let i = 0; i < 10; i++) {
        adaptiveCache.get('key1'); // Hot key
      }
      
      adaptiveCache.get('key2'); // Cold key
      
      adaptiveCache.set('key6', 'value6');
      
      expect(adaptiveCache.has('key1')).toBe(true); // Hot key should stay
      expect(adaptiveCache.has('key6')).toBe(true);
      
      adaptiveCache.destroy();
    });
  });

  describe('Optimization', () => {
    it('should optimize cache performance', () => {
      // Add some data with varying access patterns
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Create access patterns
      cache.get('key1');
      cache.get('key1');
      cache.get('key2');
      
      // Run optimization
      cache.optimize();
      
      // Verify cache is still functional
      expect(cache.get('key1')).toBe('value1');
      expect(cache.keys().length).toBeGreaterThan(0);
    });

    it('should cleanup expired entries during optimization', () => {
      jest.useFakeTimers();
      
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 1000);
      
      expect(cache.keys().length).toBe(2);
      
      // Expire first key
      jest.advanceTimersByTime(500);
      
      // Run optimization to clean up
      cache.optimize();
      
      const keys = cache.keys();
      expect(keys.length).toBe(1);
      expect(keys).toContain('key2');
      
      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid keys gracefully', () => {
      expect(() => cache.get('')).not.toThrow();
      expect(() => cache.set('', 'value')).not.toThrow();
      expect(() => cache.delete('')).not.toThrow();
    });

    it('should handle serialization errors gracefully', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj; // Create circular reference
      
      // Should not throw error
      const result = cache.set('circular', circularObj as any);
      expect(result).toBe(true);
    });

    it('should continue functioning after errors', () => {
      // Cause an error
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      cache.set('circular', circularObj as any);
      
      // Normal operations should still work
      cache.set('normal', 'value');
      expect(cache.get('normal')).toBe('value');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
        cache.get(`key${i}`);
      }
      
      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(5); // Should respect max size
      expect(stats.hitCount).toBeGreaterThan(0);
    });

    it('should handle zero TTL correctly', () => {
      cache.set('key1', 'value1', 0);
      
      // Should be immediately expired
      expect(cache.get('key1')).toBe(null);
    });

    it('should handle negative TTL correctly', () => {
      cache.set('key1', 'value1', -100);
      
      // Should be immediately expired
      expect(cache.get('key1')).toBe(null);
    });

    it('should handle very large values', () => {
      const largeValue = 'x'.repeat(10000);
      const result = cache.set('large', largeValue);
      
      expect(result).toBe(true);
      expect(cache.get('large')).toBe(largeValue);
    });

    it('should handle many small values', () => {
      for (let i = 0; i < 1000; i++) {
        cache.set(`small${i}`, 'x');
      }
      
      const stats = cache.getStats();
      expect(stats.size).toBe(5); // Should respect max size
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain O(1) performance for get operations', () => {
      // Fill cache to capacity
      for (let i = 1; i <= 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      const startTime = performance.now();
      
      // Perform many get operations
      for (let i = 0; i < 1000; i++) {
        cache.get('key1');
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 1000;
      
      // Should be very fast (less than 1ms per operation on average)
      expect(avgTime).toBeLessThan(1);
    });

    it('should maintain O(1) performance for set operations', () => {
      const startTime = performance.now();
      
      // Perform many set operations
      for (let i = 0; i < 1000; i++) {
        cache.set(`perf${i}`, `value${i}`);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 1000;
      
      // Should be very fast
      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimal configuration', () => {
      const minimalCache = new LRUCache();
      
      minimalCache.set('key1', 'value1');
      expect(minimalCache.get('key1')).toBe('value1');
      
      minimalCache.destroy();
    });

    it('should respect custom configuration', () => {
      const customCache = new LRUCache({
        maxSize: 3,
        defaultTTL: 500,
        enableStats: false
      });
      
      // Fill beyond capacity
      customCache.set('key1', 'value1');
      customCache.set('key2', 'value2');
      customCache.set('key3', 'value3');
      customCache.set('key4', 'value4'); // Should evict key1
      
      expect(customCache.has('key1')).toBe(false);
      expect(customCache.has('key4')).toBe(true);
      
      customCache.destroy();
    });
  });

  describe('Concurrent Access Simulation', () => {
    it('should handle simulated concurrent access', async () => {
      const promises: Promise<any>[] = [];
      
      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              cache.set(`concurrent${i}`, `value${i}`);
              const value = cache.get(`concurrent${i}`);
              resolve(value);
            }, Math.random() * 10);
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // Some operations should succeed
      const successfulOps = results.filter(r => r !== null).length;
      expect(successfulOps).toBeGreaterThan(0);
    });
  });
});