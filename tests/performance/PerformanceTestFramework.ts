/**
 * Performance Testing Framework
 * Comprehensive performance testing for search, database operations, UI rendering, and system resources
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { PerformanceMeasurement, MemoryMonitor, TestDataGenerator, AssertionHelpers } from '../utils/TestingUtilities';
import { SearchService } from '../../src/services/SearchService';
import { KnowledgeBaseService } from '../../src/services/KnowledgeBaseService';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KBEntry, SearchOptions } from '../../src/types';

/**
 * Performance Benchmark Configuration
 */
interface PerformanceBenchmarkConfig {
  searchResponseTime: number; // milliseconds
  databaseQueryTime: number;
  memoryUsageLimit: number; // MB
  concurrentOperations: number;
  largeDatasetSize: number;
  stressTestDuration: number; // seconds
}

const DEFAULT_PERFORMANCE_CONFIG: PerformanceBenchmarkConfig = {
  searchResponseTime: 1000, // <1s for search
  databaseQueryTime: 500,   // <500ms for DB queries
  memoryUsageLimit: 200,    // <200MB memory usage
  concurrentOperations: 50, // Handle 50 concurrent ops
  largeDatasetSize: 10000,  // 10k entries for large dataset tests
  stressTestDuration: 30    // 30 second stress tests
};

/**
 * Performance Metrics Collection
 */
interface PerformanceMetrics {
  searchMetrics: {
    averageTime: number;
    p95Time: number;
    p99Time: number;
    throughput: number;
    cacheHitRate: number;
  };
  databaseMetrics: {
    queryTime: number;
    insertTime: number;
    updateTime: number;
    indexEfficiency: number;
  };
  memoryMetrics: {
    peakUsage: number;
    averageUsage: number;
    leakDetection: boolean;
  };
  concurrencyMetrics: {
    maxConcurrentOps: number;
    deadlockCount: number;
    timeoutCount: number;
  };
}

/**
 * Base Performance Test Class
 */
export abstract class BasePerformanceTest {
  protected config: PerformanceBenchmarkConfig;
  protected metrics: PerformanceMetrics;
  protected database: DatabaseManager;
  protected kbService: KnowledgeBaseService;
  protected searchService: SearchService;
  protected testData: KBEntry[];

  constructor(config: Partial<PerformanceBenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      searchMetrics: {
        averageTime: 0,
        p95Time: 0,
        p99Time: 0,
        throughput: 0,
        cacheHitRate: 0
      },
      databaseMetrics: {
        queryTime: 0,
        insertTime: 0,
        updateTime: 0,
        indexEfficiency: 0
      },
      memoryMetrics: {
        peakUsage: 0,
        averageUsage: 0,
        leakDetection: false
      },
      concurrencyMetrics: {
        maxConcurrentOps: 0,
        deadlockCount: 0,
        timeoutCount: 0
      }
    };
  }

  protected async setup(): Promise<void> {
    // Initialize services with performance optimization
    this.database = await this.createOptimizedDatabase();
    this.kbService = new KnowledgeBaseService(this.database);
    this.searchService = new SearchService();

    // Generate performance test data
    this.testData = TestDataGenerator.createLargeDataset(this.config.largeDatasetSize);

    // Seed database with test data
    await this.seedPerformanceData();
  }

  protected async cleanup(): Promise<void> {
    if (this.database) {
      await this.database.close();
    }
  }

  private async createOptimizedDatabase(): Promise<DatabaseManager> {
    return new DatabaseManager({
      path: ':memory:',
      enableWAL: true,
      cacheSize: 10000,
      enableForeignKeys: true,
      timeout: 30000,
      maxConnections: 10,
      enableMonitoring: true
    });
  }

  private async seedPerformanceData(): Promise<void> {
    console.log(`Seeding ${this.testData.length} entries for performance testing...`);

    const startTime = performance.now();

    // Batch insert for better performance
    const batchSize = 100;
    for (let i = 0; i < this.testData.length; i += batchSize) {
      const batch = this.testData.slice(i, i + batchSize);
      await this.insertBatch(batch);
    }

    const seedTime = performance.now() - startTime;
    console.log(`Data seeding completed in ${seedTime.toFixed(2)}ms`);
  }

  private async insertBatch(entries: KBEntry[]): Promise<void> {
    const transaction = this.database.transaction();

    try {
      for (const entry of entries) {
        await this.kbService.addEntry(entry, 'performance-test');
      }
      transaction.commit();
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

  protected async measureOperation<T>(
    operation: () => Promise<T>,
    label: string
  ): Promise<{ result: T; time: number; memory: number }> {
    const perf = new PerformanceMeasurement();
    const memory = new MemoryMonitor();

    memory.start();
    perf.start();

    const result = await operation();

    const time = perf.measure(label);
    const memoryUsage = memory.measure();

    return { result, time, memory: memoryUsage };
  }

  protected calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

/**
 * Search Performance Tests
 */
export class SearchPerformanceTest extends BasePerformanceTest {
  testSearchPerformance(): void {
    describe('Search Performance Tests', () => {
      beforeAll(async () => {
        await this.setup();
        await this.searchService.buildIndex(this.testData);
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('meets search response time requirements', async () => {
        const searchQueries = [
          'VSAM Status 35',
          'S0C7 abend',
          'JCL dataset not found',
          'DB2 SQLCODE -904',
          'COBOL compile error'
        ];

        const searchTimes: number[] = [];

        for (const query of searchQueries) {
          const { time } = await this.measureOperation(async () => {
            return this.searchService.search(query, this.testData, {
              limit: 20,
              useAI: false,
              userId: 'perf-test',
              sessionId: 'perf-session'
            });
          }, `Search: ${query}`);

          searchTimes.push(time);
        }

        // Calculate performance metrics
        const averageTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
        const p95Time = this.calculatePercentile(searchTimes, 95);
        const p99Time = this.calculatePercentile(searchTimes, 99);

        // Update metrics
        this.metrics.searchMetrics.averageTime = averageTime;
        this.metrics.searchMetrics.p95Time = p95Time;
        this.metrics.searchMetrics.p99Time = p99Time;

        // Assert performance requirements
        expect(averageTime).toBeLessThan(this.config.searchResponseTime);
        expect(p95Time).toBeLessThan(this.config.searchResponseTime * 1.5);
        expect(p99Time).toBeLessThan(this.config.searchResponseTime * 2);

        console.log(`Search Performance:
          Average: ${averageTime.toFixed(2)}ms
          P95: ${p95Time.toFixed(2)}ms
          P99: ${p99Time.toFixed(2)}ms`);
      });

      it('handles large result sets efficiently', async () => {
        await AssertionHelpers.assertPerformance(async () => {
          const results = await this.searchService.search('test', this.testData, {
            limit: 1000,
            useAI: false,
            userId: 'perf-test',
            sessionId: 'perf-session'
          });

          expect(results).toBeDefined();
          expect(results.length).toBeGreaterThan(0);
        }, this.config.searchResponseTime * 2, 'Large result set search');
      });

      it('maintains performance under concurrent load', async () => {
        const concurrentSearches = Array.from(
          { length: this.config.concurrentOperations },
          (_, index) => async () => {
            const query = `concurrent search ${index}`;
            return this.searchService.search(query, this.testData.slice(0, 100), {
              limit: 10,
              useAI: false,
              userId: `user-${index}`,
              sessionId: `session-${index}`
            });
          }
        );

        const startTime = performance.now();

        await Promise.all(concurrentSearches.map(search => search()));

        const totalTime = performance.now() - startTime;
        const averageTimePerSearch = totalTime / this.config.concurrentOperations;

        expect(averageTimePerSearch).toBeLessThan(this.config.searchResponseTime * 2);

        console.log(`Concurrent Search Performance:
          Total time: ${totalTime.toFixed(2)}ms
          Average per search: ${averageTimePerSearch.toFixed(2)}ms
          Throughput: ${(this.config.concurrentOperations / (totalTime / 1000)).toFixed(2)} searches/sec`);
      });

      it('optimizes memory usage for large datasets', async () => {
        await AssertionHelpers.assertMemoryUsage(async () => {
          // Process large dataset in chunks
          const chunkSize = 1000;
          for (let i = 0; i < this.testData.length; i += chunkSize) {
            const chunk = this.testData.slice(i, i + chunkSize);
            await this.searchService.search('memory test', chunk, {
              limit: 50,
              useAI: false,
              userId: 'memory-test',
              sessionId: 'memory-session'
            });
          }
        }, this.config.memoryUsageLimit, 'Large dataset search');
      });

      it('demonstrates cache effectiveness', async () => {
        const testQuery = 'cache effectiveness test';
        const options: SearchOptions = {
          limit: 20,
          useAI: false,
          userId: 'cache-test',
          sessionId: 'cache-session'
        };

        // First search (cache miss)
        const { time: firstSearchTime } = await this.measureOperation(async () => {
          return this.searchService.search(testQuery, this.testData.slice(0, 1000), options);
        }, 'First search (cache miss)');

        // Second search (cache hit)
        const { time: secondSearchTime } = await this.measureOperation(async () => {
          return this.searchService.search(testQuery, this.testData.slice(0, 1000), options);
        }, 'Second search (cache hit)');

        // Cache hit should be significantly faster
        const improvement = (firstSearchTime - secondSearchTime) / firstSearchTime;
        expect(improvement).toBeGreaterThan(0.2); // At least 20% improvement

        console.log(`Cache Performance:
          First search: ${firstSearchTime.toFixed(2)}ms
          Cached search: ${secondSearchTime.toFixed(2)}ms
          Improvement: ${(improvement * 100).toFixed(1)}%`);
      });
    });
  }
}

/**
 * Database Performance Tests
 */
export class DatabasePerformanceTest extends BasePerformanceTest {
  testDatabasePerformance(): void {
    describe('Database Performance Tests', () => {
      beforeAll(async () => {
        await this.setup();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('optimizes insert operations', async () => {
        const entries = TestDataGenerator.createLargeDataset(100);
        const insertTimes: number[] = [];

        for (const entry of entries) {
          const { time } = await this.measureOperation(async () => {
            return this.kbService.addEntry(entry, 'perf-test');
          }, 'Insert entry');

          insertTimes.push(time);
        }

        const averageInsertTime = insertTimes.reduce((sum, time) => sum + time, 0) / insertTimes.length;
        this.metrics.databaseMetrics.insertTime = averageInsertTime;

        expect(averageInsertTime).toBeLessThan(this.config.databaseQueryTime / 2);

        console.log(`Insert Performance: Average ${averageInsertTime.toFixed(2)}ms per entry`);
      });

      it('optimizes batch operations', async () => {
        const batchEntries = TestDataGenerator.createLargeDataset(1000);

        const { time: batchTime } = await this.measureOperation(async () => {
          // Simulate batch insert
          const transaction = this.database.transaction();
          try {
            for (const entry of batchEntries) {
              await this.kbService.addEntry(entry, 'batch-test');
            }
            transaction.commit();
          } catch (error) {
            transaction.rollback();
            throw error;
          }
        }, 'Batch insert');

        const avgTimePerEntry = batchTime / batchEntries.length;
        expect(avgTimePerEntry).toBeLessThan(10); // Should be <10ms per entry in batch

        console.log(`Batch Insert Performance:
          Total time: ${batchTime.toFixed(2)}ms
          Per entry: ${avgTimePerEntry.toFixed(2)}ms`);
      });

      it('validates query optimization', async () => {
        const complexQueries = [
          // Full-text search query
          `SELECT * FROM kb_fts WHERE kb_fts MATCH ? ORDER BY bm25(kb_fts) LIMIT 20`,

          // Join query with aggregation
          `SELECT e.category, COUNT(*) as count, AVG(e.usage_count) as avg_usage
           FROM kb_entries e
           LEFT JOIN kb_tags t ON e.id = t.entry_id
           GROUP BY e.category
           ORDER BY count DESC`,

          // Complex filtering query
          `SELECT e.*, GROUP_CONCAT(t.tag) as tags
           FROM kb_entries e
           LEFT JOIN kb_tags t ON e.id = t.entry_id
           WHERE e.success_count > e.failure_count
             AND e.created_at > datetime('now', '-30 days')
           GROUP BY e.id
           ORDER BY (e.success_count * 1.0 / e.usage_count) DESC
           LIMIT 50`
        ];

        for (const query of complexQueries) {
          const { time } = await this.measureOperation(async () => {
            return this.database.all(query, ['test']);
          }, `Complex query`);

          expect(time).toBeLessThan(this.config.databaseQueryTime);
        }
      });

      it('measures index efficiency', async () => {
        // Test queries with and without indexes
        const testQuery = `
          SELECT * FROM kb_entries
          WHERE category = ? AND usage_count > ?
          ORDER BY created_at DESC
          LIMIT 100
        `;

        const { time: indexedQueryTime } = await this.measureOperation(async () => {
          return this.database.all(testQuery, ['VSAM', 5]);
        }, 'Indexed query');

        // Drop indexes temporarily
        await this.database.run('DROP INDEX IF EXISTS idx_category');
        await this.database.run('DROP INDEX IF EXISTS idx_usage');

        const { time: unindexedQueryTime } = await this.measureOperation(async () => {
          return this.database.all(testQuery, ['VSAM', 5]);
        }, 'Unindexed query');

        // Recreate indexes
        await this.database.run('CREATE INDEX idx_category ON kb_entries(category)');
        await this.database.run('CREATE INDEX idx_usage ON kb_entries(usage_count DESC)');

        const indexEfficiency = (unindexedQueryTime - indexedQueryTime) / unindexedQueryTime;
        this.metrics.databaseMetrics.indexEfficiency = indexEfficiency;

        expect(indexEfficiency).toBeGreaterThan(0.3); // At least 30% improvement

        console.log(`Index Efficiency:
          Indexed query: ${indexedQueryTime.toFixed(2)}ms
          Unindexed query: ${unindexedQueryTime.toFixed(2)}ms
          Efficiency gain: ${(indexEfficiency * 100).toFixed(1)}%`);
      });

      it('handles concurrent database operations', async () => {
        const concurrentOps = Array.from(
          { length: this.config.concurrentOperations },
          (_, index) => async () => {
            if (index % 3 === 0) {
              // Read operation
              return this.kbService.getEntry(this.testData[index % this.testData.length].id!);
            } else if (index % 3 === 1) {
              // Write operation
              const entry = TestDataGenerator.createKBEntry({ title: `Concurrent ${index}` });
              return this.kbService.addEntry(entry, `user-${index}`);
            } else {
              // Update operation
              const existingEntry = this.testData[index % this.testData.length];
              return this.kbService.recordUsage(existingEntry.id!, true, `user-${index}`);
            }
          }
        );

        let deadlockCount = 0;
        let timeoutCount = 0;

        const results = await Promise.allSettled(concurrentOps.map(op => op()));

        results.forEach(result => {
          if (result.status === 'rejected') {
            const error = result.reason.message;
            if (error.includes('deadlock')) deadlockCount++;
            if (error.includes('timeout')) timeoutCount++;
          }
        });

        this.metrics.concurrencyMetrics.deadlockCount = deadlockCount;
        this.metrics.concurrencyMetrics.timeoutCount = timeoutCount;

        // Should handle most operations successfully
        const successRate = results.filter(r => r.status === 'fulfilled').length / results.length;
        expect(successRate).toBeGreaterThan(0.9); // >90% success rate

        console.log(`Concurrency Performance:
          Success rate: ${(successRate * 100).toFixed(1)}%
          Deadlocks: ${deadlockCount}
          Timeouts: ${timeoutCount}`);
      });
    });
  }
}

/**
 * Memory Performance Tests
 */
export class MemoryPerformanceTest extends BasePerformanceTest {
  private memorySnapshots: number[] = [];

  testMemoryPerformance(): void {
    describe('Memory Performance Tests', () => {
      beforeAll(async () => {
        await this.setup();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('monitors memory usage during operations', async () => {
        const monitor = new MemoryMonitor();
        monitor.start();

        // Perform memory-intensive operations
        const largeDataset = TestDataGenerator.createLargeDataset(5000);
        await this.searchService.buildIndex(largeDataset);

        // Multiple search operations
        for (let i = 0; i < 100; i++) {
          await this.searchService.search(`memory test ${i}`, largeDataset.slice(0, 1000), {
            limit: 50,
            useAI: false,
            userId: 'memory-test',
            sessionId: 'memory-session'
          });

          if (i % 10 === 0) {
            this.memorySnapshots.push(monitor.measure());
          }
        }

        const peakUsageMB = monitor.getPeakUsage() / (1024 * 1024);
        const averageUsageMB = monitor.getAverageUsage() / (1024 * 1024);

        this.metrics.memoryMetrics.peakUsage = peakUsageMB;
        this.metrics.memoryMetrics.averageUsage = averageUsageMB;

        expect(peakUsageMB).toBeLessThan(this.config.memoryUsageLimit);

        console.log(`Memory Usage:
          Peak: ${peakUsageMB.toFixed(2)}MB
          Average: ${averageUsageMB.toFixed(2)}MB`);
      });

      it('detects memory leaks', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Perform operations that could leak memory
        for (let i = 0; i < 1000; i++) {
          const entries = TestDataGenerator.createLargeDataset(10);
          await this.searchService.buildIndex(entries);

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);

        // Memory growth should be minimal after operations
        expect(memoryGrowth).toBeLessThan(50); // <50MB growth

        this.metrics.memoryMetrics.leakDetection = memoryGrowth > 50;

        console.log(`Memory Leak Test:
          Initial: ${(initialMemory / (1024 * 1024)).toFixed(2)}MB
          Final: ${(finalMemory / (1024 * 1024)).toFixed(2)}MB
          Growth: ${memoryGrowth.toFixed(2)}MB`);
      });

      it('optimizes garbage collection', async () => {
        if (!global.gc) {
          console.log('Skipping GC test - garbage collection not available');
          return;
        }

        const gcTimes: number[] = [];

        for (let i = 0; i < 10; i++) {
          // Create memory pressure
          const largeArray = new Array(1000000).fill({
            data: 'memory pressure test data'
          });

          const startTime = performance.now();
          global.gc();
          const gcTime = performance.now() - startTime;

          gcTimes.push(gcTime);

          // Release reference
          (largeArray as any) = null;
        }

        const averageGCTime = gcTimes.reduce((sum, time) => sum + time, 0) / gcTimes.length;
        expect(averageGCTime).toBeLessThan(100); // GC should complete in <100ms

        console.log(`GC Performance: Average ${averageGCTime.toFixed(2)}ms`);
      });
    });
  }
}

/**
 * Stress Test Framework
 */
export class StressTest extends BasePerformanceTest {
  testSystemStress(): void {
    describe('System Stress Tests', () => {
      beforeAll(async () => {
        await this.setup();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('handles sustained load', async () => {
        const testDurationMs = this.config.stressTestDuration * 1000;
        const startTime = Date.now();
        let operationCount = 0;
        let errorCount = 0;

        console.log(`Starting ${this.config.stressTestDuration}s stress test...`);

        while (Date.now() - startTime < testDurationMs) {
          try {
            // Mix of operations
            const operations = [
              () => this.performSearchOperation(),
              () => this.performDatabaseOperation(),
              () => this.performMemoryOperation()
            ];

            const randomOp = operations[Math.floor(Math.random() * operations.length)];
            await randomOp();
            operationCount++;

          } catch (error) {
            errorCount++;
          }

          // Brief pause to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const errorRate = errorCount / operationCount;
        const throughput = operationCount / this.config.stressTestDuration;

        expect(errorRate).toBeLessThan(0.01); // <1% error rate
        expect(throughput).toBeGreaterThan(10); // >10 ops/second

        console.log(`Stress Test Results:
          Operations: ${operationCount}
          Errors: ${errorCount}
          Error rate: ${(errorRate * 100).toFixed(2)}%
          Throughput: ${throughput.toFixed(2)} ops/sec`);
      });

      private async performSearchOperation(): Promise<void> {
        const queries = ['VSAM', 'S0C7', 'JCL', 'DB2', 'error'];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];

        await this.searchService.search(randomQuery, this.testData.slice(0, 100), {
          limit: 10,
          useAI: false,
          userId: 'stress-test',
          sessionId: 'stress-session'
        });
      }

      private async performDatabaseOperation(): Promise<void> {
        const operations = [
          async () => {
            const entry = TestDataGenerator.createKBEntry();
            return this.kbService.addEntry(entry, 'stress-test');
          },
          async () => {
            const randomEntry = this.testData[Math.floor(Math.random() * this.testData.length)];
            return this.kbService.getEntry(randomEntry.id!);
          },
          async () => {
            const randomEntry = this.testData[Math.floor(Math.random() * this.testData.length)];
            return this.kbService.recordUsage(randomEntry.id!, Math.random() > 0.5, 'stress-test');
          }
        ];

        const randomOp = operations[Math.floor(Math.random() * operations.length)];
        await randomOp();
      }

      private async performMemoryOperation(): Promise<void> {
        // Create temporary memory pressure
        const tempData = TestDataGenerator.createLargeDataset(100);
        await this.searchService.buildIndex(tempData);

        // Release reference
        (tempData as any) = null;
      }
    });
  }
}

// Export performance test classes
export {
  BasePerformanceTest,
  SearchPerformanceTest,
  DatabasePerformanceTest,
  MemoryPerformanceTest,
  StressTest,
  type PerformanceBenchmarkConfig,
  type PerformanceMetrics,
  DEFAULT_PERFORMANCE_CONFIG
};