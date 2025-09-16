/**
 * Cache Performance and Effectiveness Tests
 * Measures cache hit rates, memory usage, and optimization strategies
 */

import { CacheService } from '../../../src/services/CacheService';
import { KBListingService } from '../../../src/services/KBListingService';
import { createTestDatabase, seedRealisticData } from '../helpers/test-database';
import { generateMockKBEntries, generatePerformanceDataset } from '../helpers/mock-data-generator';
import Database from 'better-sqlite3';

describe('Cache Performance Tests', () => {
  let cacheService: CacheService;
  let kbService: KBListingService;
  let db: Database.Database;

  // Cache performance thresholds
  const CACHE_THRESHOLDS = {
    hitTime: 5,        // Cache hit should be <5ms
    missTime: 100,     // Cache miss should be <100ms
    setTime: 10,       // Cache set should be <10ms
    clearTime: 20,     // Cache clear should be <20ms
    memoryGrowth: 50,  // Memory growth <50MB during test
    hitRate: 0.7,      // Cache hit rate should be >70%
    evictionTime: 30   // Cache eviction should be <30ms
  };

  beforeAll(async () => {
    // Setup test database
    db = createTestDatabase({ memory: true });
    await seedRealisticData(db);

    // Initialize services
    cacheService = new CacheService({
      maxSize: 100,
      ttl: 60000, // 60 seconds
      checkInterval: 5000
    });

    kbService = new KBListingService(db, { cacheService });
  });

  afterAll(() => {
    db?.close();
    cacheService?.shutdown();
  });

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();
  });

  const measureCacheOperation = async (operation: () => Promise<any>): Promise<{
    result: any;
    time: number;
    cacheStats: any;
  }> => {
    const startStats = cacheService.getStats();
    const startTime = performance.now();

    const result = await operation();

    const endTime = performance.now();
    const endStats = cacheService.getStats();

    return {
      result,
      time: endTime - startTime,
      cacheStats: {
        before: startStats,
        after: endStats,
        hits: endStats.hits - startStats.hits,
        misses: endStats.misses - startStats.misses
      }
    };
  };

  describe('Cache Hit Performance', () => {
    test('cache hits should be extremely fast', async () => {
      const queryOptions = {
        page: 1,
        pageSize: 20,
        sortBy: 'updated_at' as const
      };

      // Prime cache (first call - cache miss)
      const { time: missTime } = await measureCacheOperation(async () =>
        kbService.getEntries(queryOptions)
      );

      expect(missTime).toBeLessThan(CACHE_THRESHOLDS.missTime);

      // Second call - should be cache hit
      const { time: hitTime, cacheStats } = await measureCacheOperation(async () =>
        kbService.getEntries(queryOptions)
      );

      expect(hitTime).toBeLessThan(CACHE_THRESHOLDS.hitTime);
      expect(cacheStats.hits).toBe(1);
      expect(cacheStats.misses).toBe(0);

      console.log(`Cache miss: ${missTime.toFixed(2)}ms, hit: ${hitTime.toFixed(2)}ms`);
    });

    test('multiple cache hits should maintain performance', async () => {
      const queryOptions = {
        page: 1,
        pageSize: 20,
        filters: { categories: ['VSAM'] }
      };

      // Prime cache
      await kbService.getEntries(queryOptions);

      // Measure multiple cache hits
      const hitTimes = [];
      for (let i = 0; i < 10; i++) {
        const { time } = await measureCacheOperation(async () =>
          kbService.getEntries(queryOptions)
        );
        hitTimes.push(time);
      }

      // All hits should be fast
      hitTimes.forEach((time, index) => {
        expect(time).toBeLessThan(CACHE_THRESHOLDS.hitTime);
      });

      const avgHitTime = hitTimes.reduce((sum, time) => sum + time, 0) / hitTimes.length;
      const maxHitTime = Math.max(...hitTimes);

      console.log(`Average hit time: ${avgHitTime.toFixed(2)}ms, max: ${maxHitTime.toFixed(2)}ms`);
    });

    test('concurrent cache hits should not degrade performance', async () => {
      const queryOptions = {
        page: 1,
        pageSize: 20,
        sortBy: 'title' as const
      };

      // Prime cache
      await kbService.getEntries(queryOptions);

      // Concurrent cache hits
      const concurrentRequests = Array(10).fill(null).map(() =>
        measureCacheOperation(async () => kbService.getEntries(queryOptions))
      );

      const results = await Promise.all(concurrentRequests);

      // All should be cache hits and fast
      results.forEach(({ time, cacheStats }, index) => {
        expect(time).toBeLessThan(CACHE_THRESHOLDS.hitTime * 2); // Allow some contention
        expect(cacheStats.hits).toBe(1);
        expect(cacheStats.misses).toBe(0);
      });

      const times = results.map(r => r.time);
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;

      console.log(`Concurrent cache hits - avg: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Cache Miss and Set Performance', () => {
    test('cache misses should complete within threshold', async () => {
      const differentQueries = [
        { page: 1, pageSize: 20, sortBy: 'title' as const },
        { page: 1, pageSize: 20, filters: { categories: ['VSAM'] } },
        { page: 2, pageSize: 20, sortBy: 'title' as const },
        { page: 1, pageSize: 30, sortBy: 'title' as const },
        { search: 'error', page: 1, pageSize: 20 }
      ];

      for (const query of differentQueries) {
        const { time, cacheStats } = await measureCacheOperation(async () =>
          kbService.getEntries(query)
        );

        expect(time).toBeLessThan(CACHE_THRESHOLDS.missTime);
        expect(cacheStats.misses).toBe(1);
        expect(cacheStats.hits).toBe(0);

        console.log(`Cache miss time: ${time.toFixed(2)}ms for query:`, JSON.stringify(query));
      }
    });

    test('cache set operations should be fast', async () => {
      const testData = generateMockKBEntries(1)[0];
      const cacheKey = 'test-key';

      const startTime = performance.now();
      cacheService.set(cacheKey, testData);
      const setTime = performance.now() - startTime;

      expect(setTime).toBeLessThan(CACHE_THRESHOLDS.setTime);

      // Verify data was cached
      const cached = cacheService.get(cacheKey);
      expect(cached).toEqual(testData);

      console.log(`Cache set time: ${setTime.toFixed(2)}ms`);
    });

    test('large object caching should be efficient', async () => {
      const largeData = {
        entries: generateMockKBEntries(100),
        metadata: {
          totalCount: 100,
          processingTime: 50,
          timestamp: Date.now()
        }
      };

      const startTime = performance.now();
      cacheService.set('large-data', largeData);
      const setTime = performance.now() - startTime;

      expect(setTime).toBeLessThan(CACHE_THRESHOLDS.setTime * 3); // Allow more time for large objects

      // Verify retrieval is still fast
      const getStartTime = performance.now();
      const retrieved = cacheService.get('large-data');
      const getTime = performance.now() - getStartTime;

      expect(getTime).toBeLessThan(CACHE_THRESHOLDS.hitTime);
      expect(retrieved).toEqual(largeData);

      console.log(`Large object - set: ${setTime.toFixed(2)}ms, get: ${getTime.toFixed(2)}ms`);
    });
  });

  describe('Cache Effectiveness and Hit Rates', () => {
    test('should achieve high hit rates with typical usage patterns', async () => {
      const commonQueries = [
        { page: 1, pageSize: 20, sortBy: 'updated_at' as const },
        { page: 1, pageSize: 20, filters: { categories: ['VSAM'] } },
        { page: 1, pageSize: 20, filters: { categories: ['JCL'] } },
        { page: 2, pageSize: 20, sortBy: 'updated_at' as const },
        { search: 'error', page: 1, pageSize: 20 }
      ];

      // Simulate typical usage pattern with repeated queries
      const querySequence = [];

      // Each query appears multiple times (simulating real usage)
      for (let i = 0; i < 20; i++) {
        const query = commonQueries[Math.floor(Math.random() * commonQueries.length)];
        querySequence.push(query);
      }

      // Execute queries
      for (const query of querySequence) {
        await kbService.getEntries(query);
      }

      const stats = cacheService.getStats();
      const hitRate = stats.hits / (stats.hits + stats.misses);

      expect(hitRate).toBeGreaterThan(CACHE_THRESHOLDS.hitRate);

      console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}% (${stats.hits} hits, ${stats.misses} misses)`);
    });

    test('should handle filter variations efficiently', async () => {
      const baseQuery = { page: 1, pageSize: 20 };
      const filterVariations = [
        { categories: ['VSAM'] },
        { categories: ['JCL'] },
        { categories: ['VSAM', 'JCL'] },
        { severities: ['high'] },
        { severities: ['critical'] },
        { categories: ['VSAM'], severities: ['high'] }
      ];

      // Prime cache with all variations
      for (const filters of filterVariations) {
        await kbService.getEntries({ ...baseQuery, filters });
      }

      // Repeat queries (should be cache hits)
      const initialStats = cacheService.getStats();

      for (const filters of filterVariations) {
        await kbService.getEntries({ ...baseQuery, filters });
      }

      const finalStats = cacheService.getStats();
      const hits = finalStats.hits - initialStats.hits;
      const misses = finalStats.misses - initialStats.misses;

      expect(hits).toBe(filterVariations.length);
      expect(misses).toBe(0);

      console.log(`Filter variations - all ${hits} requests were cache hits`);
    });

    test('should optimize memory usage with smart eviction', async () => {
      // Fill cache to near capacity
      const cacheCapacity = cacheService.getMaxSize();
      const queries = [];

      for (let i = 0; i < cacheCapacity + 10; i++) {
        const query = {
          page: i % 5 + 1,
          pageSize: 20,
          sortBy: 'title' as const,
          uniqueId: i // Make each query unique
        };
        queries.push(query);
        await kbService.getEntries(query);
      }

      const stats = cacheService.getStats();

      // Should have evicted some entries
      expect(stats.evictions).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(cacheCapacity);

      console.log(`Cache evictions: ${stats.evictions}, final size: ${stats.size}/${cacheCapacity}`);
    });
  });

  describe('TTL and Expiration Performance', () => {
    test('should handle TTL expiration efficiently', async () => {
      const shortTTLCache = new CacheService({
        maxSize: 50,
        ttl: 100, // Very short TTL for testing
        checkInterval: 50
      });

      const query = { page: 1, pageSize: 20, sortBy: 'title' as const };

      // Set data with short TTL
      const startTime = performance.now();
      shortTTLCache.set('test-ttl', { data: 'test' });
      const setTime = performance.now() - startTime;

      expect(setTime).toBeLessThan(CACHE_THRESHOLDS.setTime);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      const expired = shortTTLCache.get('test-ttl');
      expect(expired).toBeNull();

      shortTTLCache.shutdown();
    });

    test('should clean up expired entries efficiently', async () => {
      const cleanupCache = new CacheService({
        maxSize: 100,
        ttl: 200,
        checkInterval: 100
      });

      // Add multiple entries
      for (let i = 0; i < 20; i++) {
        cleanupCache.set(`key-${i}`, { data: `value-${i}` });
      }

      const beforeCleanup = cleanupCache.getStats();
      expect(beforeCleanup.size).toBe(20);

      // Wait for cleanup cycle
      await new Promise(resolve => setTimeout(resolve, 250));

      const afterCleanup = cleanupCache.getStats();

      // Should have cleaned up expired entries
      expect(afterCleanup.size).toBeLessThan(beforeCleanup.size);

      console.log(`Cleanup: ${beforeCleanup.size} -> ${afterCleanup.size} entries`);

      cleanupCache.shutdown();
    });
  });

  describe('Cache Memory Management', () => {
    test('should not cause memory leaks', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many cache operations
      for (let i = 0; i < 1000; i++) {
        const query = {
          page: (i % 10) + 1,
          pageSize: 20,
          sortBy: 'title' as const,
          iteration: i
        };

        await kbService.getEntries(query);

        // Clear cache periodically to test cleanup
        if (i % 100 === 0) {
          const clearStartTime = performance.now();
          cacheService.clear();
          const clearTime = performance.now() - clearStartTime;

          expect(clearTime).toBeLessThan(CACHE_THRESHOLDS.clearTime);
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryGrowth).toBeLessThan(CACHE_THRESHOLDS.memoryGrowth * 1024 * 1024);

      console.log(`Memory growth after 1000 operations: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should handle large cache sizes efficiently', async () => {
      const largeCacheService = new CacheService({
        maxSize: 500,
        ttl: 300000 // 5 minutes
      });

      const startTime = performance.now();

      // Fill cache with large dataset
      const largeDataset = generatePerformanceDataset({
        entryCount: 100,
        includeVariations: true
      });

      for (let i = 0; i < 500; i++) {
        largeCacheService.set(`large-key-${i}`, {
          entries: largeDataset,
          metadata: { id: i, timestamp: Date.now() }
        });
      }

      const fillTime = performance.now() - startTime;

      // Test retrieval performance
      const retrievalStartTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const key = `large-key-${Math.floor(Math.random() * 500)}`;
        const data = largeCacheService.get(key);
        expect(data).toBeDefined();
      }

      const retrievalTime = performance.now() - retrievalStartTime;

      expect(fillTime).toBeLessThan(5000); // Should fill in <5s
      expect(retrievalTime).toBeLessThan(100); // Should retrieve in <100ms

      console.log(`Large cache - fill: ${fillTime.toFixed(2)}ms, retrieval: ${retrievalTime.toFixed(2)}ms`);

      largeCacheService.shutdown();
    });
  });

  describe('Cache Strategy Optimization', () => {
    test('should optimize for query patterns', async () => {
      // Simulate different access patterns
      const patterns = {
        hotQueries: [
          { page: 1, pageSize: 20, sortBy: 'updated_at' as const },
          { page: 1, pageSize: 20, filters: { categories: ['VSAM'] } }
        ],
        warmQueries: [
          { page: 2, pageSize: 20, sortBy: 'updated_at' as const },
          { page: 1, pageSize: 20, filters: { categories: ['JCL'] } }
        ],
        coldQueries: [
          { page: 10, pageSize: 20, sortBy: 'created_at' as const },
          { search: 'rare error', page: 1, pageSize: 20 }
        ]
      };

      // Simulate access frequency
      const accessSequence = [];

      // Hot queries - 60% of accesses
      for (let i = 0; i < 60; i++) {
        const query = patterns.hotQueries[i % patterns.hotQueries.length];
        accessSequence.push(query);
      }

      // Warm queries - 30% of accesses
      for (let i = 0; i < 30; i++) {
        const query = patterns.warmQueries[i % patterns.warmQueries.length];
        accessSequence.push(query);
      }

      // Cold queries - 10% of accesses
      for (let i = 0; i < 10; i++) {
        const query = patterns.coldQueries[i % patterns.coldQueries.length];
        accessSequence.push(query);
      }

      // Shuffle to simulate real usage
      for (let i = accessSequence.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [accessSequence[i], accessSequence[j]] = [accessSequence[j], accessSequence[i]];
      }

      // Execute access pattern
      for (const query of accessSequence) {
        await kbService.getEntries(query);
      }

      const stats = cacheService.getStats();
      const hitRate = stats.hits / (stats.hits + stats.misses);

      // Should achieve high hit rate with this pattern
      expect(hitRate).toBeGreaterThan(0.8);

      console.log(`Pattern optimization - hit rate: ${(hitRate * 100).toFixed(1)}%`);
    });

    test('should handle cache invalidation patterns efficiently', async () => {
      const query = { page: 1, pageSize: 20, sortBy: 'title' as const };

      // Prime cache
      await kbService.getEntries(query);

      // Measure cache hit
      const { time: hitTime } = await measureCacheOperation(async () =>
        kbService.getEntries(query)
      );

      expect(hitTime).toBeLessThan(CACHE_THRESHOLDS.hitTime);

      // Invalidate cache (simulate data change)
      const invalidateStartTime = performance.now();
      cacheService.invalidate('kb-entries');
      const invalidateTime = performance.now() - invalidateStartTime;

      expect(invalidateTime).toBeLessThan(CACHE_THRESHOLDS.clearTime);

      // Next access should be cache miss
      const { time: missTime, cacheStats } = await measureCacheOperation(async () =>
        kbService.getEntries(query)
      );

      expect(missTime).toBeLessThan(CACHE_THRESHOLDS.missTime);
      expect(cacheStats.misses).toBe(1);

      console.log(`Cache invalidation: ${invalidateTime.toFixed(2)}ms, subsequent miss: ${missTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Cache Operations', () => {
    test('should handle concurrent reads and writes safely', async () => {
      const concurrentOperations = [];

      // Mix of reads and writes
      for (let i = 0; i < 50; i++) {
        if (i % 3 === 0) {
          // Write operation
          concurrentOperations.push(
            measureCacheOperation(async () => {
              const query = {
                page: (i % 5) + 1,
                pageSize: 20,
                sortBy: 'title' as const,
                concurrent: i
              };
              return kbService.getEntries(query);
            })
          );
        } else {
          // Read operation
          concurrentOperations.push(
            measureCacheOperation(async () => {
              const query = {
                page: Math.floor(i / 3) + 1,
                pageSize: 20,
                sortBy: 'title' as const
              };
              return kbService.getEntries(query);
            })
          );
        }
      }

      const startTime = performance.now();
      const results = await Promise.all(concurrentOperations);
      const totalTime = performance.now() - startTime;

      // All operations should succeed
      results.forEach(({ result }) => {
        expect(result.success).toBe(true);
      });

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(1000);

      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      console.log(`Concurrent ops - total: ${totalTime.toFixed(2)}ms, avg: ${avgTime.toFixed(2)}ms`);
    });

    test('should maintain consistency under concurrent access', async () => {
      const sharedQuery = { page: 1, pageSize: 20, sortBy: 'updated_at' as const };

      // Multiple concurrent requests for same data
      const concurrentRequests = Array(20).fill(null).map(() =>
        kbService.getEntries(sharedQuery)
      );

      const results = await Promise.all(concurrentRequests);

      // All should return the same data
      const firstResult = results[0];
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.length).toBe(firstResult.data.length);
        expect(result.pagination.totalItems).toBe(firstResult.pagination.totalItems);
      });

      console.log(`Concurrent consistency test: ${results.length} identical results`);
    });
  });

  describe('Cache Performance Monitoring', () => {
    test('should provide accurate performance metrics', async () => {
      cacheService.clear(); // Reset stats

      const queries = [
        { page: 1, pageSize: 20, sortBy: 'title' as const },
        { page: 1, pageSize: 20, filters: { categories: ['VSAM'] } },
        { page: 1, pageSize: 20, sortBy: 'title' as const }, // Repeat - should be hit
        { page: 2, pageSize: 20, sortBy: 'title' as const },
        { page: 1, pageSize: 20, filters: { categories: ['VSAM'] } } // Repeat - should be hit
      ];

      for (const query of queries) {
        await kbService.getEntries(query);
      }

      const stats = cacheService.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);
      expect(stats.size).toBe(3);
      expect(stats.hitRate).toBeCloseTo(0.4, 1);

      console.log('Cache metrics:', {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
        size: stats.size,
        evictions: stats.evictions
      });
    });

    test('should track cache performance over time', async () => {
      const performanceLog = [];

      // Simulate extended usage
      for (let batch = 0; batch < 10; batch++) {
        const batchStartTime = performance.now();

        // Each batch has some repeated and some new queries
        for (let i = 0; i < 10; i++) {
          const query = {
            page: (batch % 3) + 1, // Some repetition across batches
            pageSize: 20,
            sortBy: 'title' as const,
            batchId: batch,
            queryId: i % 5 // Some repetition within batch
          };

          await kbService.getEntries(query);
        }

        const batchTime = performance.now() - batchStartTime;
        const stats = cacheService.getStats();

        performanceLog.push({
          batch,
          time: batchTime,
          hitRate: stats.hitRate,
          size: stats.size
        });
      }

      // Performance should stabilize as cache warms up
      const earlyBatches = performanceLog.slice(0, 3);
      const laterBatches = performanceLog.slice(7, 10);

      const earlyHitRate = earlyBatches.reduce((sum, b) => sum + b.hitRate, 0) / earlyBatches.length;
      const laterHitRate = laterBatches.reduce((sum, b) => sum + b.hitRate, 0) / laterBatches.length;

      expect(laterHitRate).toBeGreaterThan(earlyHitRate);

      console.log(`Hit rate improvement: ${(earlyHitRate * 100).toFixed(1)}% -> ${(laterHitRate * 100).toFixed(1)}%`);
    });
  });
});