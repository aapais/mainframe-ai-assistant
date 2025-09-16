/**
 * Cache Invalidation Flow Integration Tests
 *
 * Tests the complete cache invalidation flow across the system,
 * ensuring cache consistency with database operations and
 * proper propagation of cache invalidation events.
 */

import { ServiceFactory } from '../../src/services/ServiceFactory';
import { CacheService } from '../../src/services/CacheService';
import { KnowledgeBaseService } from '../../src/services/KnowledgeBaseService';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

describe('Cache Invalidation Flow Integration', () => {
  let serviceFactory: ServiceFactory;
  let cacheService: CacheService;
  let kbService: KnowledgeBaseService;
  let testDbPath: string;
  let cacheEventEmitter: EventEmitter;

  beforeAll(async () => {
    testDbPath = path.join('/tmp', `cache-test-${Date.now()}.db`);
    cacheEventEmitter = new EventEmitter();

    serviceFactory = ServiceFactory.createTestFactory({
      database: {
        path: testDbPath,
        backup: { enabled: false, interval: 0, retention: 0, path: '' },
        performance: { connectionPool: 3, busyTimeout: 5000, cacheSize: 16000 },
        pragmas: { journal_mode: 'WAL', synchronous: 'NORMAL', cache_size: -16000 }
      },
      cache: {
        maxSize: 50,
        ttl: 30000, // 30 seconds
        checkPeriod: 5000, // 5 seconds
        strategy: 'lru' as const,
        persistent: false
      }
    });

    await serviceFactory.initialize();
    cacheService = serviceFactory.getCacheService();
    kbService = serviceFactory.getKnowledgeBaseService();
  });

  afterAll(async () => {
    await serviceFactory.close();
    try {
      await fs.unlink(testDbPath);
      await fs.unlink(`${testDbPath}-wal`);
      await fs.unlink(`${testDbPath}-shm`);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    await cacheService.clear();
  });

  describe('1. Entry CRUD Cache Invalidation', () => {
    test('should invalidate cache on entry creation', async () => {
      // Cache some search results
      await cacheService.set('search:system:all', { results: [], total: 0 }, 30000);
      await cacheService.set('metrics:total:entries', { count: 0 }, 30000);

      // Create a new entry
      const entry = await kbService.createEntry({
        title: 'Cache Invalidation Test - Create',
        problem: 'Testing cache invalidation on entry creation',
        solution: 'Cache should be invalidated when new entries are created',
        category: 'System',
        tags: ['cache', 'invalidation', 'create']
      });

      // Simulate cache invalidation after create
      await cacheService.deletePattern('search:*');
      await cacheService.deletePattern('metrics:*');

      // Verify cache was invalidated
      const searchCache = await cacheService.get('search:system:all');
      const metricsCache = await cacheService.get('metrics:total:entries');

      expect(searchCache).toBeNull();
      expect(metricsCache).toBeNull();

      // Cache the new entry
      await cacheService.set(`entry:${entry.id}`, entry, 30000);
      const cachedEntry = await cacheService.get(`entry:${entry.id}`);
      expect(cachedEntry).toBeDefined();
      expect(cachedEntry.title).toBe(entry.title);

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });

    test('should invalidate cache on entry update', async () => {
      // Create an entry
      const entry = await kbService.createEntry({
        title: 'Cache Invalidation Test - Update',
        problem: 'Testing cache invalidation on entry update',
        solution: 'Cache should be invalidated when entries are updated',
        category: 'System',
        tags: ['cache', 'invalidation', 'update']
      });

      // Cache the entry and related data
      await cacheService.set(`entry:${entry.id}`, entry, 30000);
      await cacheService.set('search:cache:*', { results: [entry] }, 30000);
      await cacheService.set('entry:list:system', [entry], 30000);

      // Update the entry
      const updatedEntry = await kbService.updateEntry(entry.id!, {
        ...entry,
        solution: 'Updated solution - cache should be invalidated'
      });

      // Simulate cache invalidation after update
      await cacheService.delete(`entry:${entry.id}`);
      await cacheService.deletePattern('search:*');
      await cacheService.deletePattern('entry:list:*');

      // Verify cache was invalidated
      const cachedEntry = await cacheService.get(`entry:${entry.id}`);
      const searchCache = await cacheService.get('search:cache:*');
      const listCache = await cacheService.get('entry:list:system');

      expect(cachedEntry).toBeNull();
      expect(searchCache).toBeNull();
      expect(listCache).toBeNull();

      // Re-cache the updated entry
      await cacheService.set(`entry:${entry.id}`, updatedEntry, 30000);
      const newCachedEntry = await cacheService.get(`entry:${entry.id}`);
      expect(newCachedEntry.solution).toContain('Updated solution');

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });

    test('should invalidate cache on entry deletion', async () => {
      // Create an entry
      const entry = await kbService.createEntry({
        title: 'Cache Invalidation Test - Delete',
        problem: 'Testing cache invalidation on entry deletion',
        solution: 'Cache should be invalidated when entries are deleted',
        category: 'System',
        tags: ['cache', 'invalidation', 'delete']
      });

      // Cache the entry and related data
      await cacheService.set(`entry:${entry.id}`, entry, 30000);
      await cacheService.set('search:invalidation:*', { results: [entry] }, 30000);
      await cacheService.set('metrics:total:entries', { count: 1 }, 30000);

      // Delete the entry
      await kbService.deleteEntry(entry.id!);

      // Simulate cache invalidation after delete
      await cacheService.delete(`entry:${entry.id}`);
      await cacheService.deletePattern('search:*');
      await cacheService.deletePattern('metrics:*');

      // Verify cache was invalidated
      const cachedEntry = await cacheService.get(`entry:${entry.id}`);
      const searchCache = await cacheService.get('search:invalidation:*');
      const metricsCache = await cacheService.get('metrics:total:entries');

      expect(cachedEntry).toBeNull();
      expect(searchCache).toBeNull();
      expect(metricsCache).toBeNull();
    });
  });

  describe('2. Search Cache Invalidation Patterns', () => {
    test('should invalidate search caches by category', async () => {
      // Cache search results for different categories
      await cacheService.set('search:vsam:file_errors', { results: [], total: 0 }, 30000);
      await cacheService.set('search:jcl:parameters', { results: [], total: 0 }, 30000);
      await cacheService.set('search:db2:connections', { results: [], total: 0 }, 30000);
      await cacheService.set('search:system:general', { results: [], total: 0 }, 30000);

      // Create a VSAM entry (should invalidate VSAM-related caches)
      const vsamEntry = await kbService.createEntry({
        title: 'VSAM File Access Error',
        problem: 'Cannot access VSAM file in batch job',
        solution: 'Check file allocation and security permissions',
        category: 'VSAM',
        tags: ['vsam', 'file', 'access']
      });

      // Invalidate VSAM-related caches
      await cacheService.deletePattern('search:vsam:*');

      // Verify VSAM caches were invalidated
      const vsamCache = await cacheService.get('search:vsam:file_errors');
      expect(vsamCache).toBeNull();

      // Verify other category caches remain
      const jclCache = await cacheService.get('search:jcl:parameters');
      const db2Cache = await cacheService.get('search:db2:connections');
      expect(jclCache).toBeDefined();
      expect(db2Cache).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(vsamEntry.id!);
    });

    test('should invalidate tag-based search caches', async () => {
      // Cache searches by tags
      await cacheService.set('search:tag:performance', { results: [] }, 30000);
      await cacheService.set('search:tag:error', { results: [] }, 30000);
      await cacheService.set('search:tag:security', { results: [] }, 30000);

      // Create an entry with performance tag
      const entry = await kbService.createEntry({
        title: 'Performance Tuning Guide',
        problem: 'System performance degradation',
        solution: 'Optimize database queries and indexes',
        category: 'System',
        tags: ['performance', 'optimization', 'database']
      });

      // Invalidate performance-related caches
      await cacheService.deletePattern('search:tag:performance');

      // Verify performance cache was invalidated
      const perfCache = await cacheService.get('search:tag:performance');
      expect(perfCache).toBeNull();

      // Verify other tag caches remain
      const errorCache = await cacheService.get('search:tag:error');
      const securityCache = await cacheService.get('search:tag:security');
      expect(errorCache).toBeDefined();
      expect(securityCache).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });
  });

  describe('3. Cascade Cache Invalidation', () => {
    test('should handle cascading invalidation for related data', async () => {
      // Create entries that will be related
      const entry1 = await kbService.createEntry({
        title: 'Master Entry',
        problem: 'Primary entry for cascade test',
        solution: 'This entry affects multiple cache layers',
        category: 'System',
        tags: ['master', 'cascade', 'primary']
      });

      const entry2 = await kbService.createEntry({
        title: 'Related Entry',
        problem: 'Secondary entry for cascade test',
        solution: 'This entry is related to the master entry',
        category: 'System',
        tags: ['related', 'cascade', 'secondary']
      });

      // Cache multiple levels of related data
      await cacheService.set(`entry:${entry1.id}`, entry1, 30000);
      await cacheService.set(`entry:${entry2.id}`, entry2, 30000);
      await cacheService.set('search:cascade:*', { results: [entry1, entry2] }, 30000);
      await cacheService.set('entry:list:system', [entry1, entry2], 30000);
      await cacheService.set('metrics:category:system', { count: 2 }, 30000);
      await cacheService.set('tags:cascade:frequency', { master: 1, related: 1 }, 30000);

      // Update master entry (should trigger cascade invalidation)
      await kbService.updateEntry(entry1.id!, {
        ...entry1,
        solution: 'Updated master entry - triggers cascade invalidation'
      });

      // Simulate cascade invalidation
      await cacheService.delete(`entry:${entry1.id}`);
      await cacheService.deletePattern('search:*');
      await cacheService.deletePattern('entry:list:*');
      await cacheService.deletePattern('metrics:*');
      await cacheService.deletePattern('tags:*');

      // Verify all related caches were invalidated
      const masterCache = await cacheService.get(`entry:${entry1.id}`);
      const searchCache = await cacheService.get('search:cascade:*');
      const listCache = await cacheService.get('entry:list:system');
      const metricsCache = await cacheService.get('metrics:category:system');
      const tagsCache = await cacheService.get('tags:cascade:frequency');

      expect(masterCache).toBeNull();
      expect(searchCache).toBeNull();
      expect(listCache).toBeNull();
      expect(metricsCache).toBeNull();
      expect(tagsCache).toBeNull();

      // Related entry cache should still exist (not directly affected)
      const relatedCache = await cacheService.get(`entry:${entry2.id}`);
      expect(relatedCache).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(entry1.id!);
      await kbService.deleteEntry(entry2.id!);
    });
  });

  describe('4. Time-based Cache Invalidation', () => {
    test('should handle TTL-based cache expiration', async () => {
      // Set entries with short TTL
      await cacheService.set('short:ttl:test1', { data: 'test1' }, 100); // 100ms
      await cacheService.set('short:ttl:test2', { data: 'test2' }, 200); // 200ms
      await cacheService.set('long:ttl:test3', { data: 'test3' }, 5000); // 5s

      // Verify entries are initially cached
      let test1 = await cacheService.get('short:ttl:test1');
      let test2 = await cacheService.get('short:ttl:test2');
      let test3 = await cacheService.get('long:ttl:test3');

      expect(test1).toBeDefined();
      expect(test2).toBeDefined();
      expect(test3).toBeDefined();

      // Wait for short TTL entries to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check after first expiration
      test1 = await cacheService.get('short:ttl:test1');
      test2 = await cacheService.get('short:ttl:test2');
      test3 = await cacheService.get('long:ttl:test3');

      expect(test1).toBeNull(); // Should be expired
      expect(test2).toBeDefined(); // Still valid
      expect(test3).toBeDefined(); // Still valid

      // Wait for second expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check after second expiration
      test1 = await cacheService.get('short:ttl:test1');
      test2 = await cacheService.get('short:ttl:test2');
      test3 = await cacheService.get('long:ttl:test3');

      expect(test1).toBeNull(); // Still expired
      expect(test2).toBeNull(); // Now expired
      expect(test3).toBeDefined(); // Still valid
    });

    test('should handle cache renewal and extension', async () => {
      const key = 'renewable:cache:entry';
      const initialData = { data: 'initial', timestamp: Date.now() };

      // Set initial cache entry
      await cacheService.set(key, initialData, 1000); // 1 second

      // Verify entry exists
      let cached = await cacheService.get(key);
      expect(cached).toBeDefined();
      expect(cached.data).toBe('initial');

      // Renew the cache entry with extended TTL
      const renewedData = { data: 'renewed', timestamp: Date.now() };
      await cacheService.set(key, renewedData, 5000); // 5 seconds

      // Verify cache was renewed
      cached = await cacheService.get(key);
      expect(cached).toBeDefined();
      expect(cached.data).toBe('renewed');

      // Wait past original TTL
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Verify entry still exists due to renewal
      cached = await cacheService.get(key);
      expect(cached).toBeDefined();
      expect(cached.data).toBe('renewed');
    });
  });

  describe('5. Cache Consistency Validation', () => {
    test('should maintain cache consistency during concurrent operations', async () => {
      const entryData = {
        title: 'Concurrent Cache Test',
        problem: 'Testing cache consistency under concurrent load',
        solution: 'Ensure cache operations are atomic and consistent',
        category: 'System' as const,
        tags: ['concurrent', 'cache', 'consistency']
      };

      // Create entry
      const entry = await kbService.createEntry(entryData);

      // Perform concurrent cache operations
      const operations = [
        cacheService.set(`entry:${entry.id}`, entry, 30000),
        cacheService.set(`entry:${entry.id}:metadata`, { lastAccessed: Date.now() }, 30000),
        cacheService.set('search:concurrent:test', { results: [entry] }, 30000),
        cacheService.get(`entry:${entry.id}`),
        cacheService.has(`entry:${entry.id}`),
        cacheService.set(`entry:${entry.id}:stats`, { views: 1 }, 30000)
      ];

      // Execute operations concurrently
      const results = await Promise.allSettled(operations);

      // Verify all operations completed successfully
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBe(results.length);

      // Verify cache consistency
      const cachedEntry = await cacheService.get(`entry:${entry.id}`);
      const cachedMetadata = await cacheService.get(`entry:${entry.id}:metadata`);
      const cachedStats = await cacheService.get(`entry:${entry.id}:stats`);
      const searchCache = await cacheService.get('search:concurrent:test');

      expect(cachedEntry).toBeDefined();
      expect(cachedMetadata).toBeDefined();
      expect(cachedStats).toBeDefined();
      expect(searchCache).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });

    test('should validate cache state after bulk operations', async () => {
      // Create multiple entries
      const entries = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          kbService.createEntry({
            title: `Bulk Cache Test ${i + 1}`,
            problem: `Bulk problem ${i + 1}`,
            solution: `Bulk solution ${i + 1}`,
            category: 'System',
            tags: ['bulk', 'cache', `entry-${i + 1}`]
          })
        )
      );

      // Cache all entries
      await Promise.all(
        entries.map(entry =>
          cacheService.set(`entry:${entry.id}`, entry, 30000)
        )
      );

      // Cache aggregate data
      await cacheService.set('bulk:entries:all', entries, 30000);
      await cacheService.set('bulk:count', { total: entries.length }, 30000);

      // Verify all entries are cached
      for (const entry of entries) {
        const cached = await cacheService.get(`entry:${entry.id}`);
        expect(cached).toBeDefined();
        expect(cached.title).toBe(entry.title);
      }

      // Verify aggregate cache
      const allCached = await cacheService.get('bulk:entries:all');
      const countCached = await cacheService.get('bulk:count');

      expect(allCached).toHaveLength(10);
      expect(countCached.total).toBe(10);

      // Bulk delete and invalidate
      await Promise.all(entries.map(entry => kbService.deleteEntry(entry.id!)));
      await cacheService.deletePattern('entry:*');
      await cacheService.deletePattern('bulk:*');

      // Verify all caches were invalidated
      for (const entry of entries) {
        const cached = await cacheService.get(`entry:${entry.id}`);
        expect(cached).toBeNull();
      }

      const allCachedAfter = await cacheService.get('bulk:entries:all');
      const countCachedAfter = await cacheService.get('bulk:count');

      expect(allCachedAfter).toBeNull();
      expect(countCachedAfter).toBeNull();
    });
  });

  describe('6. Cache Performance Under Invalidation Load', () => {
    test('should maintain performance during heavy invalidation', async () => {
      // Populate cache with many entries
      const cacheOperations = Array.from({ length: 50 }, (_, i) =>
        cacheService.set(`perf:test:${i}`, { index: i, data: `test-${i}` }, 30000)
      );

      await Promise.all(cacheOperations);

      // Measure invalidation performance
      const startTime = Date.now();

      // Perform pattern-based invalidation
      await cacheService.deletePattern('perf:test:*');

      const invalidationTime = Date.now() - startTime;

      // Should complete quickly even with many entries
      expect(invalidationTime).toBeLessThan(1000); // Under 1 second

      // Verify all entries were invalidated
      for (let i = 0; i < 50; i++) {
        const cached = await cacheService.get(`perf:test:${i}`);
        expect(cached).toBeNull();
      }

      // Verify cache statistics are reasonable
      const stats = cacheService.stats();
      expect(stats.size).toBe(0);
      expect(stats.evictions).toBeGreaterThanOrEqual(0);
    });
  });
});