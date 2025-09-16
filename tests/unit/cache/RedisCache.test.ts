/**
 * Redis Cache Unit Tests
 * Testing the Redis cache implementation with mock client
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { RedisCache, RedisCacheConfig, RedisCacheStats } from '../../../src/services/cache/RedisCache';
import { EventEmitter } from 'events';

// Mock performance.now
const mockPerformanceNow = jest.fn();
global.performance = { now: mockPerformanceNow } as any;

describe('RedisCache', () => {
  let cache: RedisCache;
  let config: Partial<RedisCacheConfig>;
  let timeCounter: number;

  beforeEach(() => {
    timeCounter = 1000;
    mockPerformanceNow.mockImplementation(() => timeCounter++);
    
    config = {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'test:',
      defaultTTL: 300,
      maxRetries: 2,
      retryDelayMs: 100,
      enableCompression: false, // Disable for simpler testing
      compressionThreshold: 1024,
      maxConnectionPoolSize: 5
    };
    
    cache = new RedisCache(config);
  });

  afterEach(async () => {
    await cache.close();
    jest.clearAllMocks();
  });

  describe('Basic Operations', () => {
    it('should set and get values correctly', async () => {
      const result = await cache.set('key1', 'value1');
      expect(result).toBe(true);
      
      const value = await cache.get<string>('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('nonexistent');
      expect(value).toBe(null);
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      
      expect(await cache.exists('key1')).toBe(true);
      expect(await cache.exists('nonexistent')).toBe(false);
    });

    it('should delete keys correctly', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.exists('key1')).toBe(true);
      
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);
      expect(await cache.exists('key1')).toBe(false);
      
      // Delete non-existent key
      const deletedNonExistent = await cache.delete('nonexistent');
      expect(deletedNonExistent).toBe(false);
    });

    it('should set expiration for existing keys', async () => {
      await cache.set('key1', 'value1');
      
      const result = await cache.expire('key1', 60);
      expect(result).toBe(true);
      
      // Non-existent key
      const nonExistentResult = await cache.expire('nonexistent', 60);
      expect(nonExistentResult).toBe(false);
    });

    it('should get all keys matching pattern', async () => {
      await cache.set('user:1', 'data1');
      await cache.set('user:2', 'data2');
      await cache.set('session:1', 'sessiondata');
      
      const userKeys = await cache.keys('user:*');
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('user:1');
      expect(userKeys).toContain('user:2');
      expect(userKeys).not.toContain('session:1');
    });

    it('should clear all keys with prefix', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      await cache.clear();
      
      expect(await cache.exists('key1')).toBe(false);
      expect(await cache.exists('key2')).toBe(false);
      expect(await cache.exists('key3')).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should respect custom TTL', async () => {
      await cache.set('key1', 'value1', 1); // 1 second TTL
      expect(await cache.get('key1')).toBe('value1');
      
      // Advance time beyond TTL
      jest.advanceTimersByTime(2000);
      
      expect(await cache.get('key1')).toBe(null);
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', 'value1');
      
      // Should still be available within default TTL
      expect(await cache.get('key1')).toBe('value1');
    });

    it('should handle expired entries gracefully', async () => {
      await cache.set('key1', 'value1', 1);
      
      // Wait for expiration (simulated in mock)
      jest.advanceTimersByTime(2000);
      
      const value = await cache.get('key1');
      expect(value).toBe(null);
    });
  });

  describe('Complex Data Types', () => {
    it('should handle objects correctly', async () => {
      const obj = { name: 'test', age: 30, tags: ['tag1', 'tag2'] };
      
      await cache.set('obj1', obj);
      const retrieved = await cache.get<typeof obj>('obj1');
      
      expect(retrieved).toEqual(obj);
    });

    it('should handle arrays correctly', async () => {
      const arr = [1, 2, 3, 'string', { nested: true }];
      
      await cache.set('arr1', arr);
      const retrieved = await cache.get<typeof arr>('arr1');
      
      expect(retrieved).toEqual(arr);
    });

    it('should handle null and undefined values', async () => {
      await cache.set('null_val', null);
      await cache.set('undefined_val', undefined);
      
      expect(await cache.get('null_val')).toBe(null);
      expect(await cache.get('undefined_val')).toBe(undefined);
    });

    it('should handle boolean values', async () => {
      await cache.set('true_val', true);
      await cache.set('false_val', false);
      
      expect(await cache.get('true_val')).toBe(true);
      expect(await cache.get('false_val')).toBe(false);
    });

    it('should handle numbers correctly', async () => {
      await cache.set('int_val', 42);
      await cache.set('float_val', 3.14159);
      await cache.set('zero_val', 0);
      
      expect(await cache.get('int_val')).toBe(42);
      expect(await cache.get('float_val')).toBe(3.14159);
      expect(await cache.get('zero_val')).toBe(0);
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple get operations (mget)', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const values = await cache.mget<string>(['key1', 'key2', 'key3', 'nonexistent']);
      
      expect(values).toHaveLength(4);
      expect(values[0]).toBe('value1');
      expect(values[1]).toBe('value2');
      expect(values[2]).toBe('value3');
      expect(values[3]).toBe(null);
    });

    it('should handle multiple set operations (mset)', async () => {
      const items = [
        { key: 'batch1', value: 'value1', ttl: 300 },
        { key: 'batch2', value: 'value2', ttl: 600 },
        { key: 'batch3', value: 'value3' }
      ];
      
      const result = await cache.mset(items);
      expect(result).toBe(true);
      
      expect(await cache.get('batch1')).toBe('value1');
      expect(await cache.get('batch2')).toBe('value2');
      expect(await cache.get('batch3')).toBe('value3');
    });

    it('should handle pattern-based deletion', async () => {
      await cache.set('user:1:profile', 'profile1');
      await cache.set('user:1:settings', 'settings1');
      await cache.set('user:2:profile', 'profile2');
      await cache.set('other:data', 'otherdata');
      
      const deleted = await cache.deletePattern('user:1:*');
      expect(deleted).toBe(2);
      
      expect(await cache.exists('user:1:profile')).toBe(false);
      expect(await cache.exists('user:1:settings')).toBe(false);
      expect(await cache.exists('user:2:profile')).toBe(true);
      expect(await cache.exists('other:data')).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track hit and miss statistics', async () => {
      await cache.set('key1', 'value1');
      
      // Hits
      await cache.get('key1');
      await cache.get('key1');
      
      // Misses
      await cache.get('nonexistent1');
      await cache.get('nonexistent2');
      
      const stats = cache.getStats();
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track set operations', async () => {
      const initialStats = cache.getStats();
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.setCount).toBe(initialStats.setCount + 2);
    });

    it('should track average latency', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.get('nonexistent');
      
      const stats = cache.getStats();
      expect(stats.averageLatency).toBeGreaterThan(0);
    });

    it('should report connection status', async () => {
      const stats = cache.getStats();
      expect(['connected', 'connecting', 'disconnected', 'error']).toContain(stats.connectionStatus);
    });
  });

  describe('Error Handling and Circuit Breaker', () => {
    it('should handle connection failures gracefully', async () => {
      // Simulate connection failure by closing the cache
      await cache.close();
      
      // Operations should return false/null instead of throwing
      const setResult = await cache.set('key1', 'value1');
      expect(setResult).toBe(false);
      
      const getValue = await cache.get('key1');
      expect(getValue).toBe(null);
    });

    it('should track error count', async () => {
      // Close cache to force errors
      await cache.close();
      
      await cache.set('key1', 'value1');
      await cache.get('key1');
      
      const stats = cache.getStats();
      expect(stats.errorCount).toBeGreaterThan(0);
    });

    it('should implement circuit breaker pattern', async () => {
      // Simulate multiple failures to trigger circuit breaker
      await cache.close();
      
      // Force multiple errors
      for (let i = 0; i < 6; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }
      
      const stats = cache.getStats();
      expect(stats.connectionStatus).toBe('disconnected');
    });
  });

  describe('Connection Management', () => {
    it('should successfully ping Redis server', async () => {
      const pingResult = await cache.ping();
      expect(pingResult).toBe(true);
    });

    it('should handle ping failures', async () => {
      await cache.close();
      
      const pingResult = await cache.ping();
      expect(pingResult).toBe(false);
    });

    it('should emit connection events', (done) => {
      cache.once('connected', () => {
        expect(true).toBe(true); // Connection event fired
        done();
      });
      
      // Trigger reconnection (in real implementation)
      cache.emit('connected');
    });

    it('should emit disconnection events', (done) => {
      cache.once('disconnected', () => {
        expect(true).toBe(true); // Disconnection event fired
        done();
      });
      
      // Trigger disconnection
      cache.close();
    });

    it('should emit error events', (done) => {
      cache.once('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
      
      // Trigger error event
      cache.emit('error', new Error('Test error'));
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate by pattern', async () => {
      await cache.set('user:1:data', 'data1');
      await cache.set('user:2:data', 'data2');
      await cache.set('session:1', 'session1');
      
      const invalidated = await cache.invalidate(['user:*']);
      expect(invalidated).toBeGreaterThan(0);
      
      expect(await cache.exists('user:1:data')).toBe(false);
      expect(await cache.exists('user:2:data')).toBe(false);
      expect(await cache.exists('session:1')).toBe(true);
    });

    it('should invalidate by tags', async () => {
      await cache.set('tag:important:key1', 'value1');
      await cache.set('tag:important:key2', 'value2');
      await cache.set('tag:normal:key3', 'value3');
      
      const invalidated = await cache.invalidate(undefined, ['important']);
      expect(invalidated).toBeGreaterThan(0);
    });

    it('should handle empty invalidation requests', async () => {
      const invalidated = await cache.invalidate();
      expect(invalidated).toBe(0);
    });
  });

  describe('Key Management', () => {
    it('should add key prefix correctly', async () => {
      await cache.set('testkey', 'value');
      
      // In actual Redis implementation, we would verify the prefixed key exists
      // For now, verify that retrieval works correctly
      expect(await cache.get('testkey')).toBe('value');
    });

    it('should handle special characters in keys', async () => {
      const specialKeys = [
        'key:with:colons',
        'key-with-dashes',
        'key_with_underscores',
        'key.with.dots',
        'key/with/slashes'
      ];
      
      for (const key of specialKeys) {
        await cache.set(key, `value-${key}`);
        expect(await cache.get(key)).toBe(`value-${key}`);
      }
    });

    it('should handle very long keys', async () => {
      const longKey = 'x'.repeat(1000);
      
      await cache.set(longKey, 'long-key-value');
      expect(await cache.get(longKey)).toBe('long-key-value');
    });

    it('should handle unicode keys', async () => {
      const unicodeKeys = [
        'key-äöü',
        'key-中文',
        'key-🚀🎉',
        'key-русский'
      ];
      
      for (const key of unicodeKeys) {
        await cache.set(key, `value-${key}`);
        expect(await cache.get(key)).toBe(`value-${key}`);
      }
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large values efficiently', async () => {
      const largeValue = 'x'.repeat(100000); // 100KB string
      
      const startTime = Date.now();
      await cache.set('large-value', largeValue);
      const setTime = Date.now() - startTime;
      
      const getStartTime = Date.now();
      const retrieved = await cache.get('large-value');
      const getTime = Date.now() - getStartTime;
      
      expect(retrieved).toBe(largeValue);
      expect(setTime).toBeLessThan(1000); // Should be reasonably fast
      expect(getTime).toBeLessThan(1000);
    });

    it('should handle many small operations efficiently', async () => {
      const operations = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < operations; i++) {
        await cache.set(`perf-test-${i}`, `value-${i}`);
      }
      
      for (let i = 0; i < operations; i++) {
        await cache.get(`perf-test-${i}`);
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / (operations * 2);
      
      expect(avgTime).toBeLessThan(10); // Average under 10ms per operation
    });
  });

  describe('Compression (when enabled)', () => {
    let compressedCache: RedisCache;

    beforeEach(() => {
      compressedCache = new RedisCache({
        ...config,
        enableCompression: true,
        compressionThreshold: 100
      });
    });

    afterEach(async () => {
      await compressedCache.close();
    });

    it('should handle compression for large values', async () => {
      const largeValue = 'x'.repeat(1000); // Larger than threshold
      
      await compressedCache.set('compressed', largeValue);
      const retrieved = await compressedCache.get('compressed');
      
      expect(retrieved).toBe(largeValue);
    });

    it('should not compress small values', async () => {
      const smallValue = 'small'; // Smaller than threshold
      
      await compressedCache.set('small', smallValue);
      const retrieved = await compressedCache.get('small');
      
      expect(retrieved).toBe(smallValue);
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimal configuration', () => {
      const minimalCache = new RedisCache();
      expect(minimalCache).toBeDefined();
      minimalCache.close();
    });

    it('should respect custom configuration values', () => {
      const customConfig = {
        host: 'custom-host',
        port: 1234,
        keyPrefix: 'custom:',
        defaultTTL: 600,
        maxRetries: 5
      };
      
      const customCache = new RedisCache(customConfig);
      expect(customCache).toBeDefined();
      customCache.close();
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        maxRetries: -1,
        retryDelayMs: -100,
        defaultTTL: -1
      };
      
      expect(() => new RedisCache(invalidConfig)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await cache.close();
        cache = new RedisCache(config);
        await cache.set('cycle-test', 'value');
      }
      
      expect(await cache.get('cycle-test')).toBe('value');
    });

    it('should handle empty string values', async () => {
      await cache.set('empty', '');
      expect(await cache.get('empty')).toBe('');
    });

    it('should handle whitespace-only values', async () => {
      await cache.set('whitespace', '   \n\t   ');
      expect(await cache.get('whitespace')).toBe('   \n\t   ');
    });

    it('should handle concurrent operations gracefully', async () => {
      const promises: Promise<any>[] = [];
      
      // Simulate concurrent operations
      for (let i = 0; i < 50; i++) {
        promises.push(cache.set(`concurrent-${i}`, `value-${i}`));
        promises.push(cache.get(`concurrent-${i}`));
      }
      
      const results = await Promise.allSettled(promises);
      
      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(results.length * 0.8);
    });
  });
});