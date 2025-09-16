/**
 * Performance Tests for Storage Service
 * Benchmarks and stress tests for storage operations
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { StorageService } from '../../../src/services/storage/StorageService';
import { SQLiteAdapter } from '../../../src/services/storage/adapters/SQLiteAdapter';
import { createMockConfig, createTestKBEntry, TestData } from '../fixtures/testData';
import { StorageConfig } from '../../../src/services/storage/IStorageService';
import * as fs from 'fs';
import * as path from 'path';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  SMALL_DATASET: 100,
  MEDIUM_DATASET: 1000,
  LARGE_DATASET: 5000,
  CONCURRENT_OPERATIONS: 50,
  SEARCH_ITERATIONS: 100,
  TIMEOUT_MS: 30000,
  ACCEPTABLE_RESPONSE_TIME: 1000, // 1 second
  BATCH_SIZE: 100
};

interface PerformanceMetrics {
  operation: string;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // operations per second
  memoryUsage: NodeJS.MemoryUsage;
  errors: number;
}

describe('Storage Performance Tests', () => {
  let storageService: StorageService;
  let config: StorageConfig;
  let testDir: string;
  let dbPath: string;

  beforeAll(() => {
    testDir = path.join(__dirname, '..', 'temp', 'performance');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    dbPath = path.join(testDir, `perf-test-${Date.now()}.db`);
    
    config = createMockConfig({
      database: {
        type: 'sqlite',
        path: dbPath,
        pragmas: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          foreign_keys: 'ON',
          cache_size: -64000, // 64MB cache
          temp_store: 'MEMORY'
        }
      },
      performance: {
        caching: {
          enabled: true,
          maxSize: 10000,
          ttl: 300000
        },
        indexing: {
          fullTextSearch: true,
          customIndexes: ['category', 'created_at', 'usage_count']
        },
        maintenance: {
          autoVacuum: true,
          analyzeFrequency: 86400000 // 1 day
        },
        monitoring: {
          enabled: true,
          slowQueryThreshold: 100,
          performanceWarningThreshold: 500
        }
      }
    });

    storageService = new StorageService(config);
    await storageService.initialize();
  });

  afterEach(async () => {
    await storageService.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  // Utility function to measure performance
  async function measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    iterations: number = 1
  ): Promise<PerformanceMetrics> {
    const times: number[] = [];
    let errors = 0;
    const startMemory = process.memoryUsage();

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      try {
        await fn();
      } catch (error) {
        errors++;
      }
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to milliseconds
    }

    const endMemory = process.memoryUsage();
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = (iterations / totalTime) * 1000; // ops per second

    return {
      operation,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      throughput,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
      },
      errors
    };
  }

  function logPerformanceMetrics(metrics: PerformanceMetrics): void {
    console.log(`
Performance Metrics for ${metrics.operation}:
  Total Time: ${metrics.totalTime.toFixed(2)}ms
  Average Time: ${metrics.averageTime.toFixed(2)}ms
  Min/Max Time: ${metrics.minTime.toFixed(2)}ms / ${metrics.maxTime.toFixed(2)}ms
  Throughput: ${metrics.throughput.toFixed(2)} ops/sec
  Memory Usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB
  Errors: ${metrics.errors}
    `);
  }

  describe('Single Operation Performance', () => {
    it('should perform single insert within acceptable time', async () => {
      const metrics = await measurePerformance(
        'Single Insert',
        () => storageService.addEntry(createTestKBEntry()),
        50
      );

      logPerformanceMetrics(metrics);

      expect(metrics.averageTime).toBeLessThan(100); // Less than 100ms per insert
      expect(metrics.errors).toBe(0);
      expect(metrics.throughput).toBeGreaterThan(10); // At least 10 ops/sec
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform single search within acceptable time', async () => {
      // Prepare data
      const entries = TestData.createBatchKBEntries(PERFORMANCE_CONFIG.SMALL_DATASET);
      await storageService.batchInsert(entries);

      const metrics = await measurePerformance(
        'Single Search',
        () => storageService.search('Batch Entry'),
        PERFORMANCE_CONFIG.SEARCH_ITERATIONS
      );

      logPerformanceMetrics(metrics);

      expect(metrics.averageTime).toBeLessThan(50); // Less than 50ms per search
      expect(metrics.errors).toBe(0);
      expect(metrics.throughput).toBeGreaterThan(20); // At least 20 searches/sec
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform single update within acceptable time', async () => {
      // Prepare data
      const entry = await storageService.addEntry(createTestKBEntry());

      const metrics = await measurePerformance(
        'Single Update',
        () => storageService.updateEntry(entry.id!, { 
          title: `Updated ${Date.now()}` 
        }),
        50
      );

      logPerformanceMetrics(metrics);

      expect(metrics.averageTime).toBeLessThan(100); // Less than 100ms per update
      expect(metrics.errors).toBe(0);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform single delete within acceptable time', async () => {
      // Prepare data - create multiple entries to delete
      const entries = TestData.createBatchKBEntries(50);
      const insertedEntries = await storageService.batchInsert(entries);

      const metrics = await measurePerformance(
        'Single Delete',
        async () => {
          const entryToDelete = insertedEntries.pop();
          if (entryToDelete) {
            await storageService.deleteEntry(entryToDelete.id!);
          }
        },
        insertedEntries.length
      );

      logPerformanceMetrics(metrics);

      expect(metrics.averageTime).toBeLessThan(50); // Less than 50ms per delete
      expect(metrics.errors).toBe(0);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);
  });

  describe('Batch Operation Performance', () => {
    it('should perform batch insert efficiently', async () => {
      const batchSizes = [10, 50, 100, 500];

      for (const batchSize of batchSizes) {
        const entries = TestData.createBatchKBEntries(batchSize);

        const metrics = await measurePerformance(
          `Batch Insert (${batchSize} entries)`,
          () => storageService.batchInsert(entries),
          5
        );

        logPerformanceMetrics(metrics);

        // Performance should scale reasonably
        const timePerEntry = metrics.averageTime / batchSize;
        expect(timePerEntry).toBeLessThan(10); // Less than 10ms per entry in batch
        expect(metrics.errors).toBe(0);
      }
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform batch update efficiently', async () => {
      // Prepare data
      const entries = TestData.createBatchKBEntries(PERFORMANCE_CONFIG.BATCH_SIZE);
      const insertedEntries = await storageService.batchInsert(entries);

      const updates = insertedEntries.map((entry, index) => ({
        id: entry.id!,
        data: { title: `Batch Updated ${index}` }
      }));

      const metrics = await measurePerformance(
        `Batch Update (${PERFORMANCE_CONFIG.BATCH_SIZE} entries)`,
        () => storageService.batchUpdate(updates),
        10
      );

      logPerformanceMetrics(metrics);

      const timePerUpdate = metrics.averageTime / PERFORMANCE_CONFIG.BATCH_SIZE;
      expect(timePerUpdate).toBeLessThan(5); // Less than 5ms per update in batch
      expect(metrics.errors).toBe(0);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform batch delete efficiently', async () => {
      // Prepare multiple batches to delete
      const batches = [];
      for (let i = 0; i < 10; i++) {
        const entries = TestData.createBatchKBEntries(PERFORMANCE_CONFIG.BATCH_SIZE);
        const inserted = await storageService.batchInsert(entries);
        batches.push(inserted.map(e => e.id!));
      }

      const metrics = await measurePerformance(
        `Batch Delete (${PERFORMANCE_CONFIG.BATCH_SIZE} entries)`,
        async () => {
          const batch = batches.pop();
          if (batch) {
            await storageService.batchDelete(batch);
          }
        },
        batches.length
      );

      logPerformanceMetrics(metrics);

      const timePerDelete = metrics.averageTime / PERFORMANCE_CONFIG.BATCH_SIZE;
      expect(timePerDelete).toBeLessThan(2); // Less than 2ms per delete in batch
      expect(metrics.errors).toBe(0);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);
  });

  describe('Search Performance', () => {
    beforeEach(async () => {
      // Prepare large dataset for search tests
      const entries = TestData.createPerformanceTestData(PERFORMANCE_CONFIG.MEDIUM_DATASET);
      
      // Insert in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        await storageService.batchInsert(batch);
      }
    });

    it('should perform full-text search efficiently', async () => {
      const searchQueries = [
        'Performance Test',
        'System experiencing',
        'Database connection',
        'File processing',
        'Network timeout'
      ];

      for (const query of searchQueries) {
        const metrics = await measurePerformance(
          `Full-text Search: "${query}"`,
          () => storageService.search(query),
          20
        );

        logPerformanceMetrics(metrics);

        expect(metrics.averageTime).toBeLessThan(PERFORMANCE_CONFIG.ACCEPTABLE_RESPONSE_TIME);
        expect(metrics.errors).toBe(0);
      }
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform filtered search efficiently', async () => {
      const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'];

      for (const category of categories) {
        const metrics = await measurePerformance(
          `Filtered Search: category=${category}`,
          () => storageService.search('', {
            filters: { category },
            limit: 50
          }),
          20
        );

        logPerformanceMetrics(metrics);

        expect(metrics.averageTime).toBeLessThan(500); // Should be faster than full-text
        expect(metrics.errors).toBe(0);
      }
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform paginated search efficiently', async () => {
      const pageSize = 20;
      const pages = 10;

      const metrics = await measurePerformance(
        `Paginated Search (${pageSize} per page)`,
        async () => {
          const randomOffset = Math.floor(Math.random() * (PERFORMANCE_CONFIG.MEDIUM_DATASET - pageSize));
          await storageService.search('', {
            limit: pageSize,
            offset: randomOffset
          });
        },
        pages
      );

      logPerformanceMetrics(metrics);

      expect(metrics.averageTime).toBeLessThan(200); // Pagination should be fast
      expect(metrics.errors).toBe(0);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should perform similarity search efficiently', async () => {
      // Get a sample entry to find similar ones
      const sampleResults = await storageService.search('Performance Test', { limit: 1 });
      const sampleEntry = sampleResults[0]?.entry;

      if (sampleEntry) {
        const metrics = await measurePerformance(
          'Similarity Search',
          () => storageService.searchSimilar(sampleEntry.id!),
          20
        );

        logPerformanceMetrics(metrics);

        expect(metrics.averageTime).toBeLessThan(1000); // Similarity search can be slower
        expect(metrics.errors).toBe(0);
      }
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);
  });

  describe('Concurrent Operation Performance', () => {
    it('should handle concurrent reads efficiently', async () => {
      // Prepare data
      const entries = TestData.createBatchKBEntries(PERFORMANCE_CONFIG.SMALL_DATASET);
      await storageService.batchInsert(entries);

      const concurrentReads = PERFORMANCE_CONFIG.CONCURRENT_OPERATIONS;
      const operations = Array.from({ length: concurrentReads }, (_, i) => 
        () => storageService.search(`Batch Entry ${(i % 10) + 1}`)
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(
        operations.map(op => op())
      );
      const totalTime = Date.now() - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Concurrent Reads Performance:
        Operations: ${concurrentReads}
        Total Time: ${totalTime}ms
        Average Time: ${(totalTime / concurrentReads).toFixed(2)}ms
        Successful: ${successful}
        Failed: ${failed}
        Throughput: ${((concurrentReads / totalTime) * 1000).toFixed(2)} ops/sec`);

      expect(successful).toBeGreaterThan(concurrentReads * 0.9); // 90% success rate
      expect(totalTime).toBeLessThan(PERFORMANCE_CONFIG.TIMEOUT_MS);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should handle mixed concurrent operations', async () => {
      // Prepare initial data
      const initialEntries = TestData.createBatchKBEntries(50);
      await storageService.batchInsert(initialEntries);

      const operationsCount = PERFORMANCE_CONFIG.CONCURRENT_OPERATIONS;
      const operations = [];

      // Mix of different operations
      for (let i = 0; i < operationsCount; i++) {
        const operationType = i % 4;
        
        switch (operationType) {
          case 0: // Search
            operations.push(() => storageService.search('Batch Entry'));
            break;
          case 1: // Add
            operations.push(() => storageService.addEntry(createTestKBEntry({
              title: `Concurrent Entry ${i}`
            })));
            break;
          case 2: // Update (if entries exist)
            operations.push(async () => {
              const results = await storageService.search('Batch Entry', { limit: 1 });
              if (results.length > 0) {
                await storageService.updateEntry(results[0].entry.id!, {
                  title: `Updated Concurrent ${i}`
                });
              }
            });
            break;
          case 3: // Get by ID
            operations.push(async () => {
              const results = await storageService.search('', { limit: 1 });
              if (results.length > 0) {
                await storageService.getEntry(results[0].entry.id!);
              }
            });
            break;
        }
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations.map(op => op()));
      const totalTime = Date.now() - startTime;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Mixed Concurrent Operations Performance:
        Operations: ${operationsCount}
        Total Time: ${totalTime}ms
        Successful: ${successful}
        Failed: ${failed}
        Success Rate: ${((successful / operationsCount) * 100).toFixed(2)}%
        Throughput: ${((operationsCount / totalTime) * 1000).toFixed(2)} ops/sec`);

      expect(successful).toBeGreaterThan(operationsCount * 0.8); // 80% success rate
      expect(totalTime).toBeLessThan(PERFORMANCE_CONFIG.TIMEOUT_MS);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);
  });

  describe('Memory Performance', () => {
    it('should handle large dataset without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Insert large dataset
      const largeDataset = TestData.createPerformanceTestData(PERFORMANCE_CONFIG.LARGE_DATASET);
      const batchSize = 100;
      
      for (let i = 0; i < largeDataset.length; i += batchSize) {
        const batch = largeDataset.slice(i, i + batchSize);
        await storageService.batchInsert(batch);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const afterInsertMemory = process.memoryUsage();
      
      // Perform searches
      for (let i = 0; i < 100; i++) {
        await storageService.search('Performance Test', { limit: 20 });
      }

      const finalMemory = process.memoryUsage();

      const insertMemoryIncrease = afterInsertMemory.heapUsed - initialMemory.heapUsed;
      const searchMemoryIncrease = finalMemory.heapUsed - afterInsertMemory.heapUsed;

      console.log(`Memory Usage Analysis:
        Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        After Insert: ${(afterInsertMemory.heapUsed / 1024 / 1024).toFixed(2)}MB (+${(insertMemoryIncrease / 1024 / 1024).toFixed(2)}MB)
        After Search: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB (+${(searchMemoryIncrease / 1024 / 1024).toFixed(2)}MB)
        Memory per Entry: ${(insertMemoryIncrease / PERFORMANCE_CONFIG.LARGE_DATASET / 1024).toFixed(2)}KB`);

      // Memory usage should be reasonable
      const memoryPerEntry = insertMemoryIncrease / PERFORMANCE_CONFIG.LARGE_DATASET;
      expect(memoryPerEntry).toBeLessThan(5000); // Less than 5KB per entry

      // Search operations shouldn't cause significant memory leaks
      expect(searchMemoryIncrease).toBeLessThan(insertMemoryIncrease * 0.1); // Less than 10% of insert increase
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);

    it('should cleanup memory after operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const entry = await storageService.addEntry(createTestKBEntry());
        await storageService.search('test');
        await storageService.updateEntry(entry.id!, { title: `Updated ${i}` });
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory Cleanup Analysis:
        Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable for 100 operations
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);
  });

  describe('Database Performance', () => {
    it('should maintain performance as database grows', async () => {
      const testSizes = [100, 500, 1000, 2000];
      const searchTimes: number[] = [];

      for (const size of testSizes) {
        // Add data to reach target size
        const currentCount = await storageService.getTotalCount();
        const entriesToAdd = size - currentCount;
        
        if (entriesToAdd > 0) {
          const entries = TestData.createPerformanceTestData(entriesToAdd);
          const batchSize = 100;
          
          for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            await storageService.batchInsert(batch);
          }
        }

        // Measure search performance
        const searchStart = Date.now();
        await storageService.search('Performance Test', { limit: 10 });
        const searchTime = Date.now() - searchStart;
        searchTimes.push(searchTime);

        console.log(`Database size: ${size} entries, Search time: ${searchTime}ms`);
      }

      // Search times shouldn't degrade significantly
      const maxTime = Math.max(...searchTimes);
      const minTime = Math.min(...searchTimes);
      const degradationRatio = maxTime / minTime;

      expect(degradationRatio).toBeLessThan(3); // Performance shouldn't degrade more than 3x
      expect(maxTime).toBeLessThan(PERFORMANCE_CONFIG.ACCEPTABLE_RESPONSE_TIME);
    }, PERFORMANCE_CONFIG.TIMEOUT_MS * 2);

    it('should handle database maintenance efficiently', async () => {
      // Add data
      const entries = TestData.createPerformanceTestData(PERFORMANCE_CONFIG.MEDIUM_DATASET);
      await storageService.batchInsert(entries);

      // Measure vacuum performance
      const vacuumStart = Date.now();
      await storageService.vacuum();
      const vacuumTime = Date.now() - vacuumStart;

      // Measure analyze performance
      const analyzeStart = Date.now();
      await storageService.analyze();
      const analyzeTime = Date.now() - analyzeStart;

      console.log(`Database Maintenance Performance:
        Vacuum Time: ${vacuumTime}ms
        Analyze Time: ${analyzeTime}ms
        Dataset Size: ${PERFORMANCE_CONFIG.MEDIUM_DATASET} entries`);

      expect(vacuumTime).toBeLessThan(10000); // Less than 10 seconds
      expect(analyzeTime).toBeLessThan(5000); // Less than 5 seconds
    }, PERFORMANCE_CONFIG.TIMEOUT_MS);
  });
});