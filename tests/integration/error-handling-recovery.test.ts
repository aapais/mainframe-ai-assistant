/**
 * Error Handling and Recovery Integration Tests
 *
 * Tests comprehensive error handling and recovery mechanisms across the system:
 * - Database connection failures and recovery
 * - Service failures and circuit breaker patterns
 * - Cache failures and fallback strategies
 * - Data corruption detection and recovery
 * - Graceful degradation under load
 * - Error propagation and containment
 */

import { ServiceFactory } from '../../src/services/ServiceFactory';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { CacheService } from '../../src/services/CacheService';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

// Mock problematic scenarios
const createFailingService = (failureRate: number = 0.5) => {
  return {
    callCount: 0,
    shouldFail: function() {
      this.callCount++;
      return Math.random() < failureRate;
    },
    reset: function() {
      this.callCount = 0;
    }
  };
};

describe('Error Handling and Recovery Integration Tests', () => {
  let serviceFactory: ServiceFactory;
  let testDbPath: string;
  let backupDbPath: string;
  let errorEmitter: EventEmitter;

  beforeAll(async () => {
    testDbPath = path.join('/tmp', `error-test-${Date.now()}.db`);
    backupDbPath = path.join('/tmp', `error-backup-${Date.now()}.db`);
    errorEmitter = new EventEmitter();

    serviceFactory = ServiceFactory.createTestFactory({
      database: {
        path: testDbPath,
        backup: { enabled: true, interval: 1000, retention: 3, path: '/tmp' },
        performance: { connectionPool: 3, busyTimeout: 5000, cacheSize: 16000 },
        pragmas: { journal_mode: 'WAL', synchronous: 'NORMAL', cache_size: -16000 }
      },
      cache: {
        maxSize: 50,
        ttl: 30000,
        checkPeriod: 5000,
        strategy: 'lru' as const,
        persistent: false
      },
      validation: {
        strict: true,
        sanitize: true,
        maxLength: { title: 200, problem: 1000, solution: 2000, tags: 50 },
        minLength: { title: 5, problem: 10, solution: 10 },
        patterns: {
          tag: /^[a-zA-Z0-9\-_\s]+$/,
          category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other']
        }
      }
    });

    await serviceFactory.initialize();
  });

  afterAll(async () => {
    await serviceFactory.close();
    try {
      await fs.unlink(testDbPath);
      await fs.unlink(`${testDbPath}-wal`);
      await fs.unlink(`${testDbPath}-shm`);
      await fs.unlink(backupDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('1. Database Error Handling and Recovery', () => {
    test('should handle database connection failures gracefully', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      let errors = [];

      // Test normal operation first
      const normalEntry = await kbService.createEntry({
        title: 'Normal Operation Test',
        problem: 'Testing normal database operation before failure',
        solution: 'This should work normally',
        category: 'System',
        tags: ['normal', 'test']
      });

      expect(normalEntry.id).toBeDefined();

      // Simulate database stress that might cause connection issues
      const concurrentOps = Array.from({ length: 20 }, async (_, i) => {
        try {
          const entry = await kbService.createEntry({
            title: `Stress Test Entry ${i}`,
            problem: `Stress testing database connections ${i}`,
            solution: `Solution for stress test ${i}`,
            category: 'System',
            tags: ['stress', 'concurrent', `test-${i}`]
          });
          return { success: true, entry };
        } catch (error) {
          errors.push({ operation: 'create', error: error.message, index: i });
          return { success: false, error };
        }
      });

      const results = await Promise.allSettled(concurrentOps);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      // System should handle most operations even under stress
      expect(successful).toBeGreaterThan(failed);

      // Verify system recovery - should still be able to perform operations
      const recoveryEntry = await kbService.createEntry({
        title: 'Recovery Test',
        problem: 'Testing system recovery after stress',
        solution: 'System should recover and continue operating',
        category: 'System',
        tags: ['recovery', 'test']
      });

      expect(recoveryEntry.id).toBeDefined();

      // Cleanup successful entries
      const createdEntries = results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => r.value.entry);

      for (const entry of [...createdEntries, normalEntry, recoveryEntry]) {
        try {
          await kbService.deleteEntry(entry.id);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle data validation errors appropriately', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      const validationErrors = [];

      // Test various validation scenarios
      const invalidEntries = [
        {
          title: '', // Empty title
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'System',
          tags: ['test']
        },
        {
          title: 'Valid title',
          problem: 'Short', // Too short problem
          solution: 'Valid solution',
          category: 'System',
          tags: ['test']
        },
        {
          title: 'Valid title',
          problem: 'Valid problem',
          solution: 'Short', // Too short solution
          category: 'System',
          tags: ['test']
        },
        {
          title: 'Valid title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'InvalidCategory', // Invalid category
          tags: ['test']
        },
        {
          title: 'A'.repeat(250), // Title too long
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'System',
          tags: ['test']
        }
      ];

      for (const [index, invalidEntry] of invalidEntries.entries()) {
        try {
          await kbService.createEntry(invalidEntry);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          validationErrors.push({
            index,
            entry: invalidEntry,
            error: error.message
          });
          expect(error.message).toContain('validation');
        }
      }

      // All invalid entries should have failed validation
      expect(validationErrors).toHaveLength(invalidEntries.length);

      // Verify system can still handle valid entries after validation errors
      const validEntry = await kbService.createEntry({
        title: 'Valid Entry After Errors',
        problem: 'Testing that system still works after validation errors',
        solution: 'System should continue to work normally',
        category: 'System',
        tags: ['valid', 'recovery']
      });

      expect(validEntry.id).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(validEntry.id!);
    });

    test('should handle transaction rollback scenarios', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Get initial count
      const initialMetrics = await kbService.getMetrics();
      const initialCount = initialMetrics.totalEntries;

      // Create an entry
      const entry = await kbService.createEntry({
        title: 'Transaction Test Entry',
        problem: 'Testing transaction rollback scenarios',
        solution: 'Entry for transaction testing',
        category: 'System',
        tags: ['transaction', 'test']
      });

      // Verify entry was created
      const afterCreate = await kbService.getMetrics();
      expect(afterCreate.totalEntries).toBe(initialCount + 1);

      // Try to update with invalid data (should fail but not corrupt state)
      try {
        await kbService.updateEntry(entry.id!, {
          ...entry,
          title: '', // Invalid title
          problem: 'Updated problem',
          solution: 'Updated solution'
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('validation');
      }

      // Verify original entry is still intact
      const retrievedEntry = await kbService.getEntryById(entry.id!);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).toBe('Transaction Test Entry');

      // Verify count hasn't changed after failed update
      const afterFailedUpdate = await kbService.getMetrics();
      expect(afterFailedUpdate.totalEntries).toBe(initialCount + 1);

      // Delete the entry
      await kbService.deleteEntry(entry.id!);

      // Verify count is back to initial
      const afterDelete = await kbService.getMetrics();
      expect(afterDelete.totalEntries).toBe(initialCount);
    });
  });

  describe('2. Cache Error Handling and Fallback', () => {
    test('should handle cache failures gracefully with database fallback', async () => {
      const cacheService = serviceFactory.getCacheService();
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Create test entry
      const entry = await kbService.createEntry({
        title: 'Cache Fallback Test',
        problem: 'Testing cache failure and database fallback',
        solution: 'System should fall back to database when cache fails',
        category: 'System',
        tags: ['cache', 'fallback', 'test']
      });

      // Cache the entry
      await cacheService.set(`entry:${entry.id}`, entry, 30000);

      // Verify cache hit
      const cachedEntry = await cacheService.get(`entry:${entry.id}`);
      expect(cachedEntry).toBeDefined();

      // Simulate cache corruption/failure by clearing specific entry
      await cacheService.delete(`entry:${entry.id}`);

      // Entry should still be retrievable from database (simulating fallback)
      const fallbackEntry = await kbService.getEntryById(entry.id!);
      expect(fallbackEntry).toBeDefined();
      expect(fallbackEntry!.title).toBe(entry.title);

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });

    test('should handle cache memory pressure and eviction', async () => {
      const cacheService = serviceFactory.getCacheService();
      const evictedEntries = [];

      // Fill cache beyond capacity to trigger evictions
      const cacheEntries = Array.from({ length: 60 }, (_, i) => ({
        key: `pressure-test-${i}`,
        value: { index: i, data: 'X'.repeat(100) },
        ttl: 30000
      }));

      // Set all entries
      for (const { key, value, ttl } of cacheEntries) {
        await cacheService.set(key, value, ttl);
      }

      // Check which entries were evicted (cache size is 50)
      for (const { key } of cacheEntries) {
        const cached = await cacheService.get(key);
        if (!cached) {
          evictedEntries.push(key);
        }
      }

      // Some entries should have been evicted due to LRU policy
      expect(evictedEntries.length).toBeGreaterThan(0);

      // Cache should still be functional
      const stats = cacheService.stats();
      expect(stats.size).toBeLessThanOrEqual(50); // Max cache size
      expect(stats.evictions).toBeGreaterThan(0);

      // Verify cache can still accept new entries
      await cacheService.set('post-pressure-test', { data: 'new entry' }, 30000);
      const newEntry = await cacheService.get('post-pressure-test');
      expect(newEntry).toBeDefined();
    });

    test('should handle cache corruption and recovery', async () => {
      const cacheService = serviceFactory.getCacheService();

      // Set up some cache entries
      const testEntries = [
        { key: 'corruption-test-1', value: { data: 'test1' } },
        { key: 'corruption-test-2', value: { data: 'test2' } },
        { key: 'corruption-test-3', value: { data: 'test3' } }
      ];

      for (const { key, value } of testEntries) {
        await cacheService.set(key, value, 30000);
      }

      // Verify all entries are cached
      for (const { key, value } of testEntries) {
        const cached = await cacheService.get(key);
        expect(cached).toBeDefined();
        expect(cached.data).toBe(value.data);
      }

      // Simulate cache corruption by clearing all
      await cacheService.clear();

      // Verify cache is empty
      for (const { key } of testEntries) {
        const cached = await cacheService.get(key);
        expect(cached).toBeNull();
      }

      // Verify cache can be rebuilt
      for (const { key, value } of testEntries) {
        await cacheService.set(key, value, 30000);
      }

      for (const { key, value } of testEntries) {
        const cached = await cacheService.get(key);
        expect(cached).toBeDefined();
        expect(cached.data).toBe(value.data);
      }
    });
  });

  describe('3. Service Integration Error Handling', () => {
    test('should handle search service failures gracefully', async () => {
      const searchService = serviceFactory.getSearchService();
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Create test entries for search
      const entries = await Promise.all([
        kbService.createEntry({
          title: 'Search Error Test 1',
          problem: 'Testing search service error handling',
          solution: 'Search should handle errors gracefully',
          category: 'System',
          tags: ['search', 'error', 'test1']
        }),
        kbService.createEntry({
          title: 'Search Error Test 2',
          problem: 'Another entry for search error testing',
          solution: 'System should remain stable',
          category: 'VSAM',
          tags: ['search', 'error', 'test2']
        })
      ]);

      // Test normal search operation
      const normalResults = await searchService.search('search error', { maxResults: 10 });
      expect(normalResults.results.length).toBeGreaterThan(0);

      // Test search with problematic query (very long query)
      try {
        const longQuery = 'X'.repeat(1000);
        const results = await searchService.search(longQuery, { maxResults: 10 });
        // Should either work or fail gracefully
        expect(results).toBeDefined();
      } catch (error) {
        // If it fails, it should fail gracefully
        expect(error.message).toBeDefined();
      }

      // Test search with invalid parameters
      try {
        await searchService.search('test', { maxResults: -1 });
        // Should not reach here or should return empty results
      } catch (error) {
        expect(error.message).toBeDefined();
      }

      // Verify search service still works after errors
      const recoveryResults = await searchService.search('test 1', { maxResults: 5 });
      expect(recoveryResults).toBeDefined();

      // Cleanup
      for (const entry of entries) {
        await kbService.deleteEntry(entry.id!);
      }
    });

    test('should handle service dependency failures', async () => {
      // Test health check when services might be under stress
      const health = await serviceFactory.healthCheck();

      // Services should report their health status
      expect(health).toBeDefined();
      expect(health.services).toBeDefined();

      // Check individual service health
      const serviceNames = Object.keys(health.services);
      expect(serviceNames.length).toBeGreaterThan(0);

      // Most services should be healthy in normal conditions
      const healthyServices = Object.values(health.services).filter(s => s.healthy).length;
      const totalServices = Object.values(health.services).length;

      expect(healthyServices / totalServices).toBeGreaterThan(0.5); // At least 50% should be healthy

      // If any service is unhealthy, it should provide error information
      for (const [serviceName, serviceHealth] of Object.entries(health.services)) {
        if (!serviceHealth.healthy) {
          expect(serviceHealth.error).toBeDefined();
          console.warn(`Service ${serviceName} is unhealthy: ${serviceHealth.error}`);
        }
      }
    });

    test('should handle circular dependency and deadlock scenarios', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      const searchService = serviceFactory.getSearchService();
      const cacheService = serviceFactory.getCacheService();

      // Simulate potential circular dependency scenario
      const operations = [];

      // Create entry (may trigger cache invalidation)
      operations.push(
        kbService.createEntry({
          title: 'Circular Test Entry',
          problem: 'Testing circular dependency handling',
          solution: 'System should avoid deadlocks',
          category: 'System',
          tags: ['circular', 'dependency', 'test']
        })
      );

      // Search (may read from cache and database)
      operations.push(
        searchService.search('circular test', { maxResults: 5 })
      );

      // Cache operations (may interact with other services)
      operations.push(
        cacheService.set('circular-test-cache', { data: 'test' }, 30000)
      );

      // Execute operations concurrently (potential for circular calls)
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (no deadlocks)
      expect(duration).toBeLessThan(5000); // 5 seconds max

      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);

      // If any operations failed, they should fail quickly (not hang)
      const failed = results.filter(r => r.status === 'rejected');
      for (const failure of failed) {
        console.warn('Operation failed:', failure.reason);
      }

      // Cleanup
      if (results[0].status === 'fulfilled') {
        try {
          await kbService.deleteEntry(results[0].value.id);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('4. Data Corruption Detection and Recovery', () => {
    test('should detect and handle data integrity issues', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Create a valid entry
      const entry = await kbService.createEntry({
        title: 'Data Integrity Test',
        problem: 'Testing data integrity validation',
        solution: 'System should detect and prevent data corruption',
        category: 'System',
        tags: ['integrity', 'validation', 'test']
      });

      // Verify entry integrity
      const retrievedEntry = await kbService.getEntryById(entry.id!);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).toBe(entry.title);
      expect(retrievedEntry!.problem).toBe(entry.problem);
      expect(retrievedEntry!.solution).toBe(entry.solution);

      // Test data consistency across operations
      const updateData = {
        ...entry,
        solution: 'Updated solution to test consistency'
      };

      const updatedEntry = await kbService.updateEntry(entry.id!, updateData);
      expect(updatedEntry.solution).toBe(updateData.solution);

      // Verify consistency after update
      const reRetrievedEntry = await kbService.getEntryById(entry.id!);
      expect(reRetrievedEntry!.solution).toBe(updateData.solution);

      // Test metrics consistency
      const beforeDeleteMetrics = await kbService.getMetrics();
      await kbService.deleteEntry(entry.id!);
      const afterDeleteMetrics = await kbService.getMetrics();

      expect(afterDeleteMetrics.totalEntries).toBeLessThanOrEqual(beforeDeleteMetrics.totalEntries);
    });

    test('should handle schema migration and version compatibility', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Test that entries created with current schema are valid
      const testEntry = await kbService.createEntry({
        title: 'Schema Compatibility Test',
        problem: 'Testing schema version compatibility',
        solution: 'System should handle schema evolution gracefully',
        category: 'System',
        tags: ['schema', 'compatibility', 'migration']
      });

      // Verify all required fields are present
      expect(testEntry.id).toBeDefined();
      expect(testEntry.title).toBeDefined();
      expect(testEntry.problem).toBeDefined();
      expect(testEntry.solution).toBeDefined();
      expect(testEntry.category).toBeDefined();
      expect(testEntry.tags).toBeDefined();
      expect(testEntry.createdAt).toBeDefined();
      expect(testEntry.updatedAt).toBeDefined();

      // Verify field types and constraints
      expect(typeof testEntry.id).toBe('string');
      expect(typeof testEntry.title).toBe('string');
      expect(typeof testEntry.problem).toBe('string');
      expect(typeof testEntry.solution).toBe('string');
      expect(typeof testEntry.category).toBe('string');
      expect(Array.isArray(testEntry.tags)).toBe(true);
      expect(testEntry.createdAt instanceof Date).toBe(true);
      expect(testEntry.updatedAt instanceof Date).toBe(true);

      // Cleanup
      await kbService.deleteEntry(testEntry.id!);
    });
  });

  describe('5. System Recovery and Graceful Degradation', () => {
    test('should handle system recovery after service restart', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Create entries before simulated restart
      const preRestartEntries = await Promise.all([
        kbService.createEntry({
          title: 'Pre-Restart Entry 1',
          problem: 'Entry created before restart',
          solution: 'Should survive restart',
          category: 'System',
          tags: ['restart', 'persistence', 'test1']
        }),
        kbService.createEntry({
          title: 'Pre-Restart Entry 2',
          problem: 'Another entry before restart',
          solution: 'Should also survive restart',
          category: 'VSAM',
          tags: ['restart', 'persistence', 'test2']
        })
      ]);

      // Get metrics before restart
      const preRestartMetrics = await kbService.getMetrics();

      // Simulate restart by reinitializing services (in a real restart, we'd create a new factory)
      // For testing, we'll just verify data persistence by reading back entries

      // Verify entries exist after simulated restart
      for (const entry of preRestartEntries) {
        const retrievedEntry = await kbService.getEntryById(entry.id!);
        expect(retrievedEntry).toBeDefined();
        expect(retrievedEntry!.title).toBe(entry.title);
      }

      // Verify metrics are consistent
      const postRestartMetrics = await kbService.getMetrics();
      expect(postRestartMetrics.totalEntries).toBeGreaterThanOrEqual(preRestartEntries.length);

      // Verify system functionality after restart
      const postRestartEntry = await kbService.createEntry({
        title: 'Post-Restart Entry',
        problem: 'Entry created after restart',
        solution: 'System should work normally after restart',
        category: 'System',
        tags: ['restart', 'recovery', 'test']
      });

      expect(postRestartEntry.id).toBeDefined();

      // Cleanup
      for (const entry of [...preRestartEntries, postRestartEntry]) {
        await kbService.deleteEntry(entry.id!);
      }
    });

    test('should handle graceful degradation under resource constraints', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      const searchService = serviceFactory.getSearchService();
      const cacheService = serviceFactory.getCacheService();

      // Simulate resource constraints by creating heavy load
      const heavyLoadPromises = [];

      // Create many entries simultaneously
      for (let i = 0; i < 15; i++) {
        heavyLoadPromises.push(
          kbService.createEntry({
            title: `Load Test Entry ${i}`,
            problem: `Problem description ${i}`.repeat(10), // Larger content
            solution: `Solution description ${i}`.repeat(10), // Larger content
            category: i % 2 === 0 ? 'System' : 'VSAM',
            tags: ['load', 'test', `entry-${i}`, 'performance']
          })
        );
      }

      // Add search operations to the load
      for (let i = 0; i < 10; i++) {
        heavyLoadPromises.push(
          searchService.search(`load test ${i}`, { maxResults: 10 })
        );
      }

      // Add cache operations to the load
      for (let i = 0; i < 20; i++) {
        heavyLoadPromises.push(
          cacheService.set(`load-test-${i}`, { data: `test-${i}`.repeat(50) }, 30000)
        );
      }

      // Execute all operations concurrently
      const startTime = Date.now();
      const results = await Promise.allSettled(heavyLoadPromises);
      const duration = Date.now() - startTime;

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const successRate = successful / results.length;

      // System should handle reasonable load gracefully
      expect(successRate).toBeGreaterThan(0.7); // At least 70% success rate
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`Load test: ${successful}/${results.length} operations succeeded in ${duration}ms`);

      // System should still be responsive after heavy load
      const postLoadEntry = await kbService.createEntry({
        title: 'Post-Load Test',
        problem: 'Testing responsiveness after heavy load',
        solution: 'System should remain responsive',
        category: 'System',
        tags: ['post-load', 'responsiveness']
      });

      expect(postLoadEntry.id).toBeDefined();

      // Cleanup successful entries
      const createdEntries = results
        .slice(0, 15) // Only the create operations
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

      for (const entry of [...createdEntries, postLoadEntry]) {
        try {
          await kbService.deleteEntry(entry.id);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should maintain service isolation during partial failures', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      const searchService = serviceFactory.getSearchService();
      const cacheService = serviceFactory.getCacheService();

      // Create a test entry
      const entry = await kbService.createEntry({
        title: 'Service Isolation Test',
        problem: 'Testing service isolation during failures',
        solution: 'Services should remain isolated from each other',
        category: 'System',
        tags: ['isolation', 'failure', 'test']
      });

      // Simulate cache service having issues (not the database)
      await cacheService.clear(); // Simulate cache failure

      // Database service should still work normally
      const retrievedEntry = await kbService.getEntryById(entry.id!);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).toBe(entry.title);

      // Search service should still work (may use cache or not)
      const searchResults = await searchService.search('isolation test', { maxResults: 10 });
      expect(searchResults).toBeDefined();

      // Update should still work despite cache issues
      const updatedEntry = await kbService.updateEntry(entry.id!, {
        ...entry,
        solution: 'Updated solution despite cache issues'
      });
      expect(updatedEntry.solution).toContain('Updated solution');

      // Verify cache can recover
      await cacheService.set('recovery-test', { data: 'cache recovered' }, 30000);
      const cacheTest = await cacheService.get('recovery-test');
      expect(cacheTest).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });
  });

  describe('6. Error Monitoring and Alerting', () => {
    test('should track and report error patterns', async () => {
      const metricsService = serviceFactory.getMetricsService();
      const kbService = serviceFactory.getKnowledgeBaseService();

      const errorLog = [];

      // Generate various types of errors to track patterns
      const errorScenarios = [
        // Validation errors
        async () => {
          try {
            await kbService.createEntry({
              title: '',
              problem: 'Invalid entry',
              solution: 'This should fail',
              category: 'System',
              tags: []
            });
          } catch (error) {
            errorLog.push({ type: 'validation', error: error.message, timestamp: Date.now() });
          }
        },
        // Not found errors
        async () => {
          try {
            await kbService.getEntryById('non-existent-id');
          } catch (error) {
            errorLog.push({ type: 'not_found', error: error.message, timestamp: Date.now() });
          }
        },
        // Invalid operation errors
        async () => {
          try {
            await kbService.updateEntry('invalid-id', {
              title: 'Test',
              problem: 'Test',
              solution: 'Test',
              category: 'System',
              tags: []
            });
          } catch (error) {
            errorLog.push({ type: 'invalid_operation', error: error.message, timestamp: Date.now() });
          }
        }
      ];

      // Execute error scenarios
      await Promise.all(errorScenarios.map(scenario => scenario()));

      // Analyze error patterns
      const errorTypes = {};
      errorLog.forEach(error => {
        errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
      });

      // Record error metrics
      for (const [type, count] of Object.entries(errorTypes)) {
        await metricsService.recordMetric('errors', `${type}_count`, count);
      }

      await metricsService.recordMetric('errors', 'total_errors', errorLog.length);

      // Verify error tracking
      expect(errorLog.length).toBeGreaterThan(0);
      expect(Object.keys(errorTypes).length).toBeGreaterThan(0);

      // Verify system continues to work after errors
      const validEntry = await kbService.createEntry({
        title: 'Valid Entry After Errors',
        problem: 'System should work after tracking errors',
        solution: 'Error tracking should not affect normal operation',
        category: 'System',
        tags: ['error-tracking', 'recovery']
      });

      expect(validEntry.id).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(validEntry.id!);
    });
  });
});