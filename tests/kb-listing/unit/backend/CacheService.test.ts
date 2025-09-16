/**
 * Unit tests for Cache Service functionality
 * Tests caching strategies, TTL management, and cache performance
 */

import { CacheService } from '../../../../src/main/services/CacheService';
import { ListingOptions } from '../../../../src/main/services/KBListingService';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService({
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      cleanupInterval: 60 * 1000 // 1 minute
    });
  });

  afterEach(() => {
    cacheService.clear();
    cacheService.destroy();
  });

  // =========================
  // BASIC CACHE OPERATIONS
  // =========================

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { data: 'test-data', count: 42 };

      cacheService.set(key, value);
      const retrieved = cacheService.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', () => {
      const result = cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      const key = 'exists-key';
      const value = { test: true };

      expect(cacheService.has(key)).toBe(false);

      cacheService.set(key, value);
      expect(cacheService.has(key)).toBe(true);
    });

    it('should delete specific keys', () => {
      const key = 'delete-key';
      const value = { data: 'to-delete' };

      cacheService.set(key, value);
      expect(cacheService.has(key)).toBe(true);

      cacheService.delete(key);
      expect(cacheService.has(key)).toBe(false);
      expect(cacheService.get(key)).toBeNull();
    });

    it('should clear all cache entries', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');

      expect(cacheService.size()).toBe(3);

      cacheService.clear();
      expect(cacheService.size()).toBe(0);
      expect(cacheService.get('key1')).toBeNull();
    });

    it('should report cache size correctly', () => {
      expect(cacheService.size()).toBe(0);

      cacheService.set('key1', 'value1');
      expect(cacheService.size()).toBe(1);

      cacheService.set('key2', 'value2');
      expect(cacheService.size()).toBe(2);

      cacheService.delete('key1');
      expect(cacheService.size()).toBe(1);
    });
  });

  // =========================
  // TTL (TIME TO LIVE) TESTS
  // =========================

  describe('TTL Management', () => {
    it('should expire entries after default TTL', (done) => {
      const shortTTLCache = new CacheService({
        defaultTTL: 100, // 100ms
        maxSize: 10,
        cleanupInterval: 50
      });

      const key = 'ttl-key';
      const value = { data: 'expires-soon' };

      shortTTLCache.set(key, value);
      expect(shortTTLCache.get(key)).toEqual(value);

      setTimeout(() => {
        expect(shortTTLCache.get(key)).toBeNull();
        shortTTLCache.destroy();
        done();
      }, 150);
    });

    it('should allow custom TTL per entry', (done) => {
      const key1 = 'short-ttl';
      const key2 = 'long-ttl';
      const value = { test: true };

      cacheService.set(key1, value, 50); // 50ms TTL
      cacheService.set(key2, value, 200); // 200ms TTL

      setTimeout(() => {
        expect(cacheService.get(key1)).toBeNull();
        expect(cacheService.get(key2)).toEqual(value);
        done();
      }, 100);
    });

    it('should update TTL when accessing entries', (done) => {
      const slidingTTLCache = new CacheService({
        defaultTTL: 100,
        maxSize: 10,
        cleanupInterval: 30,
        slidingExpiration: true
      });

      const key = 'sliding-key';
      const value = { data: 'sliding-test' };

      slidingTTLCache.set(key, value);

      // Access the key multiple times to extend TTL
      setTimeout(() => {
        expect(slidingTTLCache.get(key)).toEqual(value);
      }, 50);

      setTimeout(() => {
        expect(slidingTTLCache.get(key)).toEqual(value);
      }, 80);

      // Should still exist after original TTL due to sliding expiration
      setTimeout(() => {
        expect(slidingTTLCache.get(key)).toEqual(value);
      }, 120);

      // Should expire after extended TTL
      setTimeout(() => {
        expect(slidingTTLCache.get(key)).toBeNull();
        slidingTTLCache.destroy();
        done();
      }, 200);
    });

    it('should not expire entries with infinite TTL', (done) => {
      const key = 'infinite-key';
      const value = { data: 'never-expires' };

      cacheService.set(key, value, Infinity);

      setTimeout(() => {
        expect(cacheService.get(key)).toEqual(value);
        done();
      }, 100);
    });

    it('should handle zero TTL as immediate expiration', () => {
      const key = 'zero-ttl';
      const value = { data: 'expires-immediately' };

      cacheService.set(key, value, 0);
      expect(cacheService.get(key)).toBeNull();
    });
  });

  // =========================
  // CACHE KEY GENERATION
  // =========================

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for identical options', () => {
      const options1: ListingOptions = {
        page: 1,
        pageSize: 20,
        sortBy: 'title',
        filters: [{ field: 'category', operator: 'eq', value: 'VSAM' }]
      };

      const options2: ListingOptions = {
        page: 1,
        pageSize: 20,
        sortBy: 'title',
        filters: [{ field: 'category', operator: 'eq', value: 'VSAM' }]
      };

      const key1 = cacheService.generateKey('entries', options1);
      const key2 = cacheService.generateKey('entries', options2);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different options', () => {
      const options1: ListingOptions = {
        page: 1,
        pageSize: 20,
        sortBy: 'title'
      };

      const options2: ListingOptions = {
        page: 2,
        pageSize: 20,
        sortBy: 'title'
      };

      const key1 = cacheService.generateKey('entries', options1);
      const key2 = cacheService.generateKey('entries', options2);

      expect(key1).not.toBe(key2);
    });

    it('should generate stable keys regardless of property order', () => {
      const options1 = {
        page: 1,
        sortBy: 'title',
        pageSize: 20,
        filters: []
      };

      const options2 = {
        pageSize: 20,
        page: 1,
        filters: [],
        sortBy: 'title'
      };

      const key1 = cacheService.generateKey('entries', options1);
      const key2 = cacheService.generateKey('entries', options2);

      expect(key1).toBe(key2);
    });

    it('should include prefix in key generation', () => {
      const options = { page: 1 };

      const key1 = cacheService.generateKey('entries', options);
      const key2 = cacheService.generateKey('filters', options);

      expect(key1).toContain('entries');
      expect(key2).toContain('filters');
      expect(key1).not.toBe(key2);
    });

    it('should handle complex nested objects in keys', () => {
      const complexOptions = {
        filters: [
          {
            field: 'category',
            operator: 'in',
            value: ['VSAM', 'JCL', 'DB2'],
            metadata: { source: 'user', priority: 1 }
          }
        ],
        multiSort: ['title', 'created_at'],
        searchQuery: 'complex test query'
      };

      const key = cacheService.generateKey('complex', complexOptions);

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  // =========================
  // CACHE SIZE MANAGEMENT
  // =========================

  describe('Size Management', () => {
    it('should enforce maximum cache size with LRU eviction', () => {
      const smallCache = new CacheService({
        defaultTTL: 60000,
        maxSize: 3,
        cleanupInterval: 1000
      });

      // Fill cache to capacity
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      expect(smallCache.size()).toBe(3);

      // Access key1 to make it most recently used
      smallCache.get('key1');

      // Add another key, should evict key2 (least recently used)
      smallCache.set('key4', 'value4');

      expect(smallCache.size()).toBe(3);
      expect(smallCache.has('key1')).toBe(true); // Recently accessed
      expect(smallCache.has('key2')).toBe(false); // Should be evicted
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.has('key4')).toBe(true); // Newly added

      smallCache.destroy();
    });

    it('should handle cache size of 1 correctly', () => {
      const singleCache = new CacheService({
        defaultTTL: 60000,
        maxSize: 1,
        cleanupInterval: 1000
      });

      singleCache.set('key1', 'value1');
      expect(singleCache.size()).toBe(1);
      expect(singleCache.get('key1')).toBe('value1');

      singleCache.set('key2', 'value2');
      expect(singleCache.size()).toBe(1);
      expect(singleCache.get('key1')).toBeNull();
      expect(singleCache.get('key2')).toBe('value2');

      singleCache.destroy();
    });

    it('should allow unlimited size when maxSize is 0', () => {
      const unlimitedCache = new CacheService({
        defaultTTL: 60000,
        maxSize: 0, // Unlimited
        cleanupInterval: 1000
      });

      // Add many entries
      for (let i = 0; i < 1000; i++) {
        unlimitedCache.set(`key${i}`, `value${i}`);
      }

      expect(unlimitedCache.size()).toBe(1000);
      expect(unlimitedCache.get('key0')).toBe('value0');
      expect(unlimitedCache.get('key999')).toBe('value999');

      unlimitedCache.destroy();
    });
  });

  // =========================
  // PATTERN-BASED INVALIDATION
  // =========================

  describe('Pattern-based Invalidation', () => {
    beforeEach(() => {
      // Set up test data
      cacheService.set('entries:page1:VSAM', { data: 'vsam-page1' });
      cacheService.set('entries:page2:VSAM', { data: 'vsam-page2' });
      cacheService.set('entries:page1:JCL', { data: 'jcl-page1' });
      cacheService.set('filters:categories', { categories: ['VSAM', 'JCL'] });
      cacheService.set('quick-filters', { recent: 10, popular: 20 });
    });

    it('should invalidate entries by exact pattern match', () => {
      expect(cacheService.size()).toBe(5);

      cacheService.invalidatePattern('entries:page1:VSAM');

      expect(cacheService.get('entries:page1:VSAM')).toBeNull();
      expect(cacheService.get('entries:page2:VSAM')).not.toBeNull();
      expect(cacheService.size()).toBe(4);
    });

    it('should invalidate entries by prefix pattern', () => {
      expect(cacheService.size()).toBe(5);

      cacheService.invalidatePattern('entries:*');

      expect(cacheService.get('entries:page1:VSAM')).toBeNull();
      expect(cacheService.get('entries:page2:VSAM')).toBeNull();
      expect(cacheService.get('entries:page1:JCL')).toBeNull();
      expect(cacheService.get('filters:categories')).not.toBeNull();
      expect(cacheService.size()).toBe(2);
    });

    it('should invalidate entries by wildcard patterns', () => {
      cacheService.invalidatePattern('*:page1:*');

      expect(cacheService.get('entries:page1:VSAM')).toBeNull();
      expect(cacheService.get('entries:page1:JCL')).toBeNull();
      expect(cacheService.get('entries:page2:VSAM')).not.toBeNull();
      expect(cacheService.size()).toBe(3);
    });

    it('should handle complex pattern matching', () => {
      cacheService.set('user:123:profile', { name: 'John' });
      cacheService.set('user:123:settings', { theme: 'dark' });
      cacheService.set('user:456:profile', { name: 'Jane' });

      cacheService.invalidatePattern('user:123:*');

      expect(cacheService.get('user:123:profile')).toBeNull();
      expect(cacheService.get('user:123:settings')).toBeNull();
      expect(cacheService.get('user:456:profile')).not.toBeNull();
    });

    it('should support regex patterns for advanced matching', () => {
      cacheService.set('api:v1:users:list', { users: [] });
      cacheService.set('api:v1:users:details', { user: {} });
      cacheService.set('api:v2:users:list', { users: [] });

      cacheService.invalidatePattern(/^api:v1:users:/);

      expect(cacheService.get('api:v1:users:list')).toBeNull();
      expect(cacheService.get('api:v1:users:details')).toBeNull();
      expect(cacheService.get('api:v2:users:list')).not.toBeNull();
    });
  });

  // =========================
  // CACHE STATISTICS
  // =========================

  describe('Cache Statistics', () => {
    beforeEach(() => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');

      // Simulate some hits and misses
      cacheService.get('key1'); // hit
      cacheService.get('key1'); // hit
      cacheService.get('key2'); // hit
      cacheService.get('nonexistent'); // miss
      cacheService.get('nonexistent2'); // miss
    });

    it('should track cache hits and misses', () => {
      const stats = cacheService.getStatistics();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.6); // 3/5 = 0.6
    });

    it('should track cache size and memory usage', () => {
      const stats = cacheService.getStatistics();

      expect(stats.size).toBe(3);
      expect(stats.maxSize).toBe(100);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track cache performance metrics', () => {
      const stats = cacheService.getStatistics();

      expect(stats.operations).toMatchObject({
        gets: expect.any(Number),
        sets: expect.any(Number),
        deletes: expect.any(Number),
        clears: expect.any(Number)
      });

      expect(stats.averageGetTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageSetTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics when requested', () => {
      let stats = cacheService.getStatistics();
      expect(stats.hits).toBeGreaterThan(0);

      cacheService.resetStatistics();

      stats = cacheService.getStatistics();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.operations.gets).toBe(0);
    });
  });

  // =========================
  // AUTOMATIC CLEANUP
  // =========================

  describe('Automatic Cleanup', () => {
    it('should automatically clean expired entries', (done) => {
      const autoCleanCache = new CacheService({
        defaultTTL: 50, // 50ms
        maxSize: 100,
        cleanupInterval: 30 // Clean every 30ms
      });

      autoCleanCache.set('temp1', 'value1');
      autoCleanCache.set('temp2', 'value2');
      autoCleanCache.set('permanent', 'value3', Infinity);

      expect(autoCleanCache.size()).toBe(3);

      setTimeout(() => {
        // Expired entries should be cleaned up automatically
        expect(autoCleanCache.size()).toBe(1);
        expect(autoCleanCache.get('temp1')).toBeNull();
        expect(autoCleanCache.get('temp2')).toBeNull();
        expect(autoCleanCache.get('permanent')).toBe('value3');

        autoCleanCache.destroy();
        done();
      }, 100);
    });

    it('should handle cleanup interval changes', (done) => {
      const cache = new CacheService({
        defaultTTL: 50,
        maxSize: 100,
        cleanupInterval: 1000 // 1 second initially
      });

      cache.set('key1', 'value1');

      // Change cleanup interval to be faster
      cache.setCleanupInterval(20);

      setTimeout(() => {
        // Should be cleaned up due to faster interval
        expect(cache.get('key1')).toBeNull();
        cache.destroy();
        done();
      }, 100);
    });

    it('should stop cleanup when cache is destroyed', (done) => {
      const cache = new CacheService({
        defaultTTL: 1000,
        maxSize: 100,
        cleanupInterval: 10
      });

      cache.set('key1', 'value1');
      cache.destroy();

      // Wait longer than cleanup interval
      setTimeout(() => {
        // Cache should be destroyed and no longer functioning
        expect(() => cache.get('key1')).toThrow();
        done();
      }, 50);
    });
  });

  // =========================
  // PERFORMANCE TESTS
  // =========================

  describe('Performance', () => {
    it('should handle rapid sequential operations efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        cacheService.set(`rapid-${i}`, { data: `value-${i}`, index: i });
      }

      for (let i = 0; i < iterations; i++) {
        const value = cacheService.get(`rapid-${i}`);
        expect(value).toMatchObject({ data: `value-${i}`, index: i });
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should maintain performance with large datasets', () => {
      const largeData = {
        entries: Array(1000).fill(null).map((_, i) => ({
          id: i,
          title: `Entry ${i}`,
          content: 'Large content string '.repeat(10)
        })),
        metadata: {
          total: 1000,
          generated: new Date().toISOString()
        }
      };

      const startTime = performance.now();

      cacheService.set('large-dataset', largeData);
      const retrieved = cacheService.get('large-dataset');

      const duration = performance.now() - startTime;

      expect(retrieved).toEqual(largeData);
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should handle concurrent operations safely', async () => {
      const promises = Array(100).fill(null).map(async (_, i) => {
        const key = `concurrent-${i}`;
        const value = { id: i, data: `value-${i}` };

        cacheService.set(key, value);

        // Small random delay to create more realistic concurrent scenario
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        return cacheService.get(key);
      });

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result).toMatchObject({
          id: i,
          data: `value-${i}`
        });
      });
    });

    it('should optimize memory usage with large number of small entries', () => {
      const entryCount = 10000;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < entryCount; i++) {
        cacheService.set(`small-${i}`, { id: i });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerEntry = memoryIncrease / entryCount;

      // Each small entry should use reasonable amount of memory
      expect(memoryPerEntry).toBeLessThan(1000); // Less than 1KB per entry
    });
  });

  // =========================
  // ERROR HANDLING
  // =========================

  describe('Error Handling', () => {
    it('should handle null and undefined values gracefully', () => {
      expect(() => cacheService.set('null-key', null)).not.toThrow();
      expect(() => cacheService.set('undefined-key', undefined)).not.toThrow();

      expect(cacheService.get('null-key')).toBeNull();
      expect(cacheService.get('undefined-key')).toBeUndefined();
    });

    it('should handle circular references in cached objects', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => cacheService.set('circular', circular)).not.toThrow();

      const retrieved = cacheService.get('circular');
      expect(retrieved.name).toBe('test');
      expect(retrieved.self).toBe(retrieved);
    });

    it('should handle very long cache keys', () => {
      const longKey = 'very-long-key-'.repeat(100); // 1400+ characters
      const value = { data: 'long-key-test' };

      expect(() => cacheService.set(longKey, value)).not.toThrow();
      expect(cacheService.get(longKey)).toEqual(value);
    });

    it('should handle negative TTL values', () => {
      const key = 'negative-ttl';
      const value = { data: 'should-expire-immediately' };

      cacheService.set(key, value, -1000);
      expect(cacheService.get(key)).toBeNull();
    });

    it('should recover from corrupted cache state', () => {
      // Simulate corruption by directly manipulating internal state
      cacheService['cache'].set('corrupted', {
        value: 'test',
        timestamp: 'invalid-timestamp', // This should be a number
        ttl: 5000
      });

      // Should handle corruption gracefully
      expect(() => cacheService.get('corrupted')).not.toThrow();
      expect(cacheService.get('corrupted')).toBeNull();
    });
  });
});