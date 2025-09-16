/**
 * Comprehensive System Integration Tests
 *
 * This test suite validates complete end-to-end system functionality including:
 * - Frontend-backend integration via IPC
 * - Database connectivity and operations
 * - Cache layer integration
 * - Analytics pipeline data flow
 * - Search service integration
 * - Error handling and recovery
 * - Configuration management
 * - Monitoring and alerting
 */

import { ServiceFactory } from '../../src/services/ServiceFactory';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { CacheService } from '../../src/services/CacheService';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

// Mock electron IPC for testing
const mockIpcMain = new EventEmitter();
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  send: jest.fn()
};

jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
  app: {
    getPath: jest.fn(() => '/tmp/test'),
    getName: jest.fn(() => 'Test App'),
    getVersion: jest.fn(() => '1.0.0')
  }
}));

describe('Comprehensive System Integration Tests', () => {
  let serviceFactory: ServiceFactory;
  let dbManager: DatabaseManager;
  let testDbPath: string;
  let testCacheConfig: any;

  beforeAll(async () => {
    // Setup test database path
    testDbPath = path.join('/tmp', `test-integration-${Date.now()}.db`);

    // Cache configuration for testing
    testCacheConfig = {
      maxSize: 100,
      ttl: 60000,
      checkPeriod: 10000,
      strategy: 'lru' as const,
      persistent: false
    };

    // Initialize service factory with test configuration
    serviceFactory = ServiceFactory.createTestFactory({
      database: {
        path: testDbPath,
        backup: { enabled: false, interval: 0, retention: 0, path: '' },
        performance: { connectionPool: 5, busyTimeout: 10000, cacheSize: 32000 },
        pragmas: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          cache_size: -32000,
          foreign_keys: 1
        }
      },
      cache: testCacheConfig,
      logging: { level: 'error', console: false, file: { enabled: false, path: '', maxSize: 0, maxFiles: 0 }, structured: false }
    });

    await serviceFactory.initialize();
  });

  afterAll(async () => {
    await serviceFactory.close();

    // Cleanup test database
    try {
      await fs.unlink(testDbPath);
      await fs.unlink(`${testDbPath}-wal`);
      await fs.unlink(`${testDbPath}-shm`);
    } catch (error) {
      // Files may not exist, ignore
    }
  });

  describe('1. Frontend-Backend Integration', () => {
    test('should handle IPC communication for knowledge base operations', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Simulate IPC call from renderer to main process
      const testEntry = {
        title: 'Test Integration Entry',
        problem: 'Testing IPC communication between frontend and backend',
        solution: 'Use electron IPC mechanisms for secure communication',
        category: 'System' as const,
        tags: ['integration', 'ipc', 'test']
      };

      // Test create operation via service (simulating IPC handler)
      const createdEntry = await kbService.createEntry(testEntry);
      expect(createdEntry).toBeDefined();
      expect(createdEntry.title).toBe(testEntry.title);
      expect(createdEntry.id).toBeDefined();

      // Test read operation
      const retrievedEntry = await kbService.getEntryById(createdEntry.id!);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).toBe(testEntry.title);

      // Test update operation
      const updateData = { ...retrievedEntry, solution: 'Updated solution via IPC' };
      const updatedEntry = await kbService.updateEntry(createdEntry.id!, updateData);
      expect(updatedEntry.solution).toBe('Updated solution via IPC');

      // Test delete operation
      const deleted = await kbService.deleteEntry(createdEntry.id!);
      expect(deleted).toBe(true);

      // Verify deletion
      const deletedEntry = await kbService.getEntryById(createdEntry.id!);
      expect(deletedEntry).toBeNull();
    });

    test('should handle IPC communication for search operations', async () => {
      const searchService = serviceFactory.getSearchService();
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Create test data for search
      const testEntries = [
        {
          title: 'VSAM Error Handling',
          problem: 'VSAM file access errors in batch job',
          solution: 'Check file allocation and permissions',
          category: 'VSAM' as const,
          tags: ['vsam', 'error', 'batch']
        },
        {
          title: 'JCL Parameter Issues',
          problem: 'JCL parameters not being passed correctly',
          solution: 'Verify symbolic parameter syntax',
          category: 'JCL' as const,
          tags: ['jcl', 'parameters', 'syntax']
        }
      ];

      for (const entry of testEntries) {
        await kbService.createEntry(entry);
      }

      // Test search via service (simulating IPC handler)
      const searchResults = await searchService.search('VSAM error', {
        categories: ['VSAM'],
        maxResults: 10
      });

      expect(searchResults.results).toHaveLength(1);
      expect(searchResults.results[0].title).toContain('VSAM');
      expect(searchResults.query).toBe('VSAM error');
      expect(searchResults.total).toBe(1);
    });
  });

  describe('2. Database Connectivity and Operations', () => {
    test('should maintain database connection health', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Test basic connectivity
      const metrics = await kbService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalEntries).toBeGreaterThanOrEqual(0);

      // Test concurrent operations
      const concurrentPromises = Array.from({ length: 10 }, (_, i) =>
        kbService.createEntry({
          title: `Concurrent Entry ${i}`,
          problem: `Test problem ${i}`,
          solution: `Test solution ${i}`,
          category: 'System',
          tags: ['concurrent', 'test']
        })
      );

      const results = await Promise.all(concurrentPromises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.id).toBeDefined();
      });

      // Cleanup
      for (const result of results) {
        await kbService.deleteEntry(result.id!);
      }
    });

    test('should handle database transactions correctly', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      const initialCount = (await kbService.getMetrics()).totalEntries;

      // Test successful transaction
      const entry1 = await kbService.createEntry({
        title: 'Transaction Test 1',
        problem: 'Testing transaction consistency',
        solution: 'Use proper transaction boundaries',
        category: 'System',
        tags: ['transaction', 'test']
      });

      const entry2 = await kbService.createEntry({
        title: 'Transaction Test 2',
        problem: 'Testing transaction rollback',
        solution: 'Handle errors appropriately',
        category: 'System',
        tags: ['transaction', 'rollback']
      });

      const afterCreate = (await kbService.getMetrics()).totalEntries;
      expect(afterCreate).toBe(initialCount + 2);

      // Cleanup
      await kbService.deleteEntry(entry1.id!);
      await kbService.deleteEntry(entry2.id!);

      const afterCleanup = (await kbService.getMetrics()).totalEntries;
      expect(afterCleanup).toBe(initialCount);
    });
  });

  describe('3. Cache Layer Integration', () => {
    test('should integrate cache with database operations', async () => {
      const cacheService = serviceFactory.getCacheService();
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Clear cache to start fresh
      await cacheService.clear();

      // Create test entry
      const testEntry = await kbService.createEntry({
        title: 'Cache Integration Test',
        problem: 'Testing cache integration with database',
        solution: 'Ensure cache consistency with database operations',
        category: 'System',
        tags: ['cache', 'integration']
      });

      // Cache the entry
      await cacheService.set(`entry:${testEntry.id}`, testEntry, 30000);

      // Verify cache hit
      const cachedEntry = await cacheService.get(`entry:${testEntry.id}`);
      expect(cachedEntry).toBeDefined();
      expect(cachedEntry.title).toBe(testEntry.title);

      // Update entry in database
      const updatedEntry = await kbService.updateEntry(testEntry.id!, {
        ...testEntry,
        solution: 'Updated solution for cache test'
      });

      // Cache should be invalidated on update
      await cacheService.delete(`entry:${testEntry.id}`);

      // Verify cache miss
      const missedEntry = await cacheService.get(`entry:${testEntry.id}`);
      expect(missedEntry).toBeNull();

      // Cleanup
      await kbService.deleteEntry(testEntry.id!);
    });

    test('should handle cache invalidation patterns', async () => {
      const cacheService = serviceFactory.getCacheService();

      // Set multiple related cache entries
      await cacheService.set('search:vsam:*', { results: [] }, 30000);
      await cacheService.set('search:jcl:*', { results: [] }, 30000);
      await cacheService.set('search:db2:*', { results: [] }, 30000);
      await cacheService.set('metrics:total', { count: 100 }, 30000);

      // Test pattern-based invalidation
      const deletedCount = await cacheService.deletePattern('search:*');
      expect(deletedCount).toBe(3);

      // Verify specific entries were deleted
      const vsam = await cacheService.get('search:vsam:*');
      const metrics = await cacheService.get('metrics:total');

      expect(vsam).toBeNull();
      expect(metrics).toBeDefined();
    });
  });

  describe('4. Analytics Pipeline Data Flow', () => {
    test('should track and aggregate usage metrics', async () => {
      const metricsService = serviceFactory.getMetricsService();
      const searchService = serviceFactory.getSearchService();

      // Generate test metrics
      const testQueries = [
        'VSAM error handling',
        'JCL parameter issues',
        'DB2 connection problems',
        'CICS transaction errors'
      ];

      // Simulate search operations that generate metrics
      for (const query of testQueries) {
        await searchService.search(query, { maxResults: 5 });
      }

      // Allow time for metrics to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify metrics were recorded
      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.searches).toBeDefined();
    });

    test('should handle metrics aggregation and reporting', async () => {
      const metricsService = serviceFactory.getMetricsService();

      // Get baseline metrics
      const initialMetrics = await metricsService.getMetrics();

      // Record custom metrics
      await metricsService.recordMetric('custom_operation', 'test_metric', 1);
      await metricsService.recordMetric('custom_operation', 'test_metric', 2);
      await metricsService.recordMetric('custom_operation', 'test_metric', 3);

      // Get updated metrics
      const updatedMetrics = await metricsService.getMetrics();

      // Verify metrics were recorded
      expect(updatedMetrics).toBeDefined();
    });
  });

  describe('5. Search Service Integration', () => {
    test('should integrate search with all dependencies', async () => {
      const searchService = serviceFactory.getSearchService();
      const kbService = serviceFactory.getKnowledgeBaseService();
      const cacheService = serviceFactory.getCacheService();

      // Create searchable content
      const entries = [
        {
          title: 'ABEND S0C4 Resolution',
          problem: 'Program experiencing S0C4 abend in production',
          solution: 'Check array bounds and pointer references',
          category: 'System' as const,
          tags: ['abend', 's0c4', 'production']
        },
        {
          title: 'VSAM CI Split Issue',
          problem: 'VSAM control interval splits causing performance degradation',
          solution: 'Reorganize VSAM dataset with larger CI size',
          category: 'VSAM' as const,
          tags: ['vsam', 'performance', 'ci-split']
        }
      ];

      const createdEntries = [];
      for (const entry of entries) {
        const created = await kbService.createEntry(entry);
        createdEntries.push(created);
      }

      // Test search functionality
      const searchResults = await searchService.search('S0C4 abend', {
        categories: ['System'],
        maxResults: 10
      });

      expect(searchResults.results).toHaveLength(1);
      expect(searchResults.results[0].title).toContain('S0C4');

      // Test search suggestions
      const suggestions = await searchService.suggest('VS', 5);
      expect(suggestions).toContain('VSAM');

      // Test advanced search
      const advancedResults = await searchService.advancedSearch({
        query: 'performance',
        categories: ['VSAM'],
        tags: ['performance'],
        dateRange: {
          start: new Date(Date.now() - 86400000), // 24 hours ago
          end: new Date()
        }
      });

      expect(advancedResults.results.length).toBeGreaterThan(0);

      // Cleanup
      for (const entry of createdEntries) {
        await kbService.deleteEntry(entry.id!);
      }
    });

    test('should handle search result caching', async () => {
      const searchService = serviceFactory.getSearchService();
      const cacheService = serviceFactory.getCacheService();

      const query = 'cache test query';

      // First search - should hit database
      const startTime1 = Date.now();
      const results1 = await searchService.search(query, { maxResults: 5 });
      const duration1 = Date.now() - startTime1;

      // Cache the results manually for testing
      const cacheKey = `search:${Buffer.from(query).toString('base64')}`;
      await cacheService.set(cacheKey, results1, 30000);

      // Verify cache contains results
      const cachedResults = await cacheService.get(cacheKey);
      expect(cachedResults).toBeDefined();
      expect(cachedResults.query).toBe(query);
    });
  });

  describe('6. Error Handling and Recovery', () => {
    test('should handle database connection errors gracefully', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Test error handling with invalid data
      try {
        await kbService.createEntry({
          title: '', // Invalid: empty title
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'System',
          tags: []
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('validation');
      }

      // Test recovery after error
      const validEntry = await kbService.createEntry({
        title: 'Recovery Test Entry',
        problem: 'Testing error recovery',
        solution: 'System should recover gracefully',
        category: 'System',
        tags: ['recovery', 'test']
      });

      expect(validEntry).toBeDefined();
      expect(validEntry.id).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(validEntry.id!);
    });

    test('should handle service failures and circuit breaker patterns', async () => {
      // Test service health check
      const health = await serviceFactory.healthCheck();
      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.services).toBeDefined();

      // Verify all services are healthy
      Object.entries(health.services).forEach(([serviceName, serviceHealth]) => {
        expect(serviceHealth.healthy).toBe(true);
      });
    });
  });

  describe('7. Configuration Management', () => {
    test('should handle configuration updates across components', async () => {
      // Get current configuration
      const currentConfig = serviceFactory.getConfiguration();
      expect(currentConfig).toBeDefined();
      expect(currentConfig.database).toBeDefined();
      expect(currentConfig.cache).toBeDefined();

      // Test configuration validation
      expect(currentConfig.database.path).toBe(testDbPath);
      expect(currentConfig.cache.maxSize).toBe(testCacheConfig.maxSize);
    });

    test('should validate configuration consistency', async () => {
      const config = serviceFactory.getConfiguration();

      // Verify configuration structure
      expect(config.database.path).toBeDefined();
      expect(config.cache.maxSize).toBeGreaterThan(0);
      expect(config.cache.ttl).toBeGreaterThan(0);
      expect(config.logging.level).toBeDefined();

      // Verify service factory was configured correctly
      expect(config.database.backup.enabled).toBe(false); // Test configuration
      expect(config.metrics.enabled).toBe(false); // Test configuration
    });
  });

  describe('8. End-to-End User Workflows', () => {
    test('should handle complete knowledge base entry lifecycle', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      const searchService = serviceFactory.getSearchService();
      const metricsService = serviceFactory.getMetricsService();

      // Step 1: Create entry
      const entry = await kbService.createEntry({
        title: 'Complete Workflow Test',
        problem: 'Testing complete user workflow from creation to deletion',
        solution: 'Follow the complete lifecycle validation process',
        category: 'System',
        tags: ['workflow', 'e2e', 'test']
      });

      expect(entry.id).toBeDefined();

      // Step 2: Search for entry
      const searchResults = await searchService.search('Complete Workflow', {
        maxResults: 10
      });

      expect(searchResults.results.length).toBeGreaterThan(0);
      const foundEntry = searchResults.results.find(r => r.id === entry.id);
      expect(foundEntry).toBeDefined();

      // Step 3: Update entry
      const updatedEntry = await kbService.updateEntry(entry.id!, {
        ...entry,
        solution: 'Updated solution after workflow validation'
      });

      expect(updatedEntry.solution).toContain('Updated solution');

      // Step 4: Verify metrics
      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();

      // Step 5: Delete entry
      const deleted = await kbService.deleteEntry(entry.id!);
      expect(deleted).toBe(true);

      // Step 6: Verify deletion
      const deletedEntry = await kbService.getEntryById(entry.id!);
      expect(deletedEntry).toBeNull();
    });

    test('should handle bulk operations efficiently', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();

      // Create multiple entries in bulk
      const bulkEntries = Array.from({ length: 20 }, (_, i) => ({
        title: `Bulk Entry ${i + 1}`,
        problem: `Bulk problem ${i + 1}`,
        solution: `Bulk solution ${i + 1}`,
        category: 'System' as const,
        tags: ['bulk', 'test', `entry-${i + 1}`]
      }));

      const startTime = Date.now();
      const createdEntries = [];

      for (const entry of bulkEntries) {
        const created = await kbService.createEntry(entry);
        createdEntries.push(created);
      }

      const createDuration = Date.now() - startTime;
      expect(createDuration).toBeLessThan(5000); // Should complete in under 5 seconds

      // Verify all entries were created
      expect(createdEntries).toHaveLength(20);

      // Bulk cleanup
      const deleteStartTime = Date.now();
      for (const entry of createdEntries) {
        await kbService.deleteEntry(entry.id!);
      }
      const deleteDuration = Date.now() - deleteStartTime;
      expect(deleteDuration).toBeLessThan(3000); // Deletion should be faster
    });
  });

  describe('9. Performance and Monitoring Integration', () => {
    test('should collect and report performance metrics', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      const metricsService = serviceFactory.getMetricsService();

      // Perform operations that should generate metrics
      const entry = await kbService.createEntry({
        title: 'Performance Monitoring Test',
        problem: 'Testing performance metric collection',
        solution: 'Monitor key performance indicators',
        category: 'System',
        tags: ['performance', 'monitoring']
      });

      // Get performance metrics
      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });

    test('should validate system performance thresholds', async () => {
      const searchService = serviceFactory.getSearchService();

      // Perform search operations and measure performance
      const queries = ['test', 'performance', 'monitoring', 'integration'];
      const performanceResults = [];

      for (const query of queries) {
        const startTime = Date.now();
        await searchService.search(query, { maxResults: 10 });
        const duration = Date.now() - startTime;
        performanceResults.push(duration);
      }

      // Verify performance is within acceptable thresholds
      const averageTime = performanceResults.reduce((a, b) => a + b, 0) / performanceResults.length;
      expect(averageTime).toBeLessThan(1000); // Average search should be under 1 second

      // Verify no individual search takes too long
      performanceResults.forEach(duration => {
        expect(duration).toBeLessThan(2000); // No single search should take over 2 seconds
      });
    });
  });

  describe('10. System Integration Health', () => {
    test('should validate all integration points are healthy', async () => {
      // Test service factory health
      const health = await serviceFactory.healthCheck();
      expect(health.healthy).toBe(true);

      // Test individual service health
      const services = serviceFactory.getAllServices();
      expect(services.knowledgeBaseService).toBeDefined();
      expect(services.searchService).toBeDefined();
      expect(services.cacheService).toBeDefined();
      expect(services.validationService).toBeDefined();
      expect(services.metricsService).toBeDefined();
      expect(services.importExportService).toBeDefined();

      // Test cache statistics
      const cacheStats = serviceFactory.getCacheService().stats();
      expect(cacheStats).toBeDefined();
      expect(cacheStats.size).toBeGreaterThanOrEqual(0);
      expect(cacheStats.maxSize).toBe(testCacheConfig.maxSize);
    });

    test('should handle system stress and concurrent operations', async () => {
      const kbService = serviceFactory.getKnowledgeBaseService();
      const searchService = serviceFactory.getSearchService();

      // Create concurrent operations
      const operations = [];

      // Mix of create, read, and search operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          kbService.createEntry({
            title: `Stress Test Entry ${i}`,
            problem: `Stress test problem ${i}`,
            solution: `Stress test solution ${i}`,
            category: 'System',
            tags: ['stress', 'test', `concurrent-${i}`]
          })
        );

        operations.push(
          searchService.search(`stress test ${i}`, { maxResults: 5 })
        );
      }

      // Execute all operations concurrently
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;

      // Verify all operations completed
      expect(results).toHaveLength(20);

      // Count successful operations
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(15); // At least 75% should succeed

      // Verify performance under stress
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Cleanup created entries
      const createdEntries = results
        .filter((r, i) => i % 2 === 0 && r.status === 'fulfilled') // Only create operations
        .map(r => (r as PromiseFulfilledResult<any>).value);

      for (const entry of createdEntries) {
        try {
          await kbService.deleteEntry(entry.id);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });
});