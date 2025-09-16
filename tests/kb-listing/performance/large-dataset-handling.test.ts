/**
 * Large Dataset Handling Performance Tests
 * Tests system performance with large volumes of data
 */

import Database from 'better-sqlite3';
import { createPerformanceTestDatabase, clearTestData } from '../helpers/test-database';
import { generatePerformanceDataset } from '../helpers/mock-data-generator';
import { KBListingService } from '../../../src/services/KBListingService';
import { QueryBuilder } from '../../../src/services/QueryBuilder';
import { CacheService } from '../../../src/services/CacheService';

describe('Large Dataset Handling Performance', () => {
  let db: Database.Database;
  let kbService: KBListingService;
  let queryBuilder: QueryBuilder;
  let cacheService: CacheService;

  // Dataset sizes for testing
  const DATASET_SIZES = {
    small: 1000,
    medium: 5000,
    large: 10000,
    xlarge: 25000
  };

  // Performance thresholds for large datasets
  const PERFORMANCE_THRESHOLDS = {
    dataLoad: 30000,        // Initial data load <30s
    querySmall: 100,        // Queries on small dataset <100ms
    queryMedium: 200,       // Queries on medium dataset <200ms
    queryLarge: 500,        // Queries on large dataset <500ms
    queryXLarge: 1000,      // Queries on XL dataset <1s
    aggregation: 2000,      // Aggregations <2s
    fullTextSearch: 1500,   // FTS on large dataset <1.5s
    batchOperation: 5000,   // Batch operations <5s
    memoryUsage: 200        // Memory usage <200MB
  };

  beforeAll(async () => {
    console.log('Setting up large dataset performance tests...');

    // Create optimized database
    db = createPerformanceTestDatabase();
    cacheService = new CacheService({ maxSize: 1000, ttl: 300000 });
    kbService = new KBListingService(db, { cacheService });
    queryBuilder = new QueryBuilder();
  });

  afterAll(() => {
    db?.close();
    cacheService?.shutdown();
  });

  const loadDataset = async (size: number): Promise<void> => {
    console.log(`Loading dataset of ${size} entries...`);

    const startTime = performance.now();

    // Generate realistic dataset
    const dataset = generatePerformanceDataset({
      entryCount: size,
      includeVariations: true,
      includeLargeSolutions: true,
      includeComplexTags: true
    });

    // Batch insert for performance
    const insertStmt = db.prepare(`
      INSERT INTO kb_entries (
        id, title, problem, solution, category, severity,
        created_at, updated_at, created_by,
        usage_count, success_count, failure_count, last_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTagStmt = db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
    const insertFTSStmt = db.prepare(`
      INSERT INTO kb_fts (id, title, problem, solution, tags, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      dataset.forEach(entry => {
        insertStmt.run(
          entry.id, entry.title, entry.problem, entry.solution,
          entry.category, entry.severity, entry.created_at,
          entry.updated_at, entry.created_by,
          entry.usage_count, entry.success_count, entry.failure_count,
          entry.last_used
        );

        // Insert tags
        if (entry.tags?.length) {
          entry.tags.forEach(tag => {
            insertTagStmt.run(entry.id, tag);
          });
        }

        // Insert FTS entry
        insertFTSStmt.run(
          entry.id, entry.title, entry.problem, entry.solution,
          entry.tags?.join(' ') || '', entry.category
        );
      });
    });

    transaction();

    const loadTime = performance.now() - startTime;
    console.log(`Dataset loaded in ${loadTime.toFixed(2)}ms`);

    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.dataLoad);
  };

  const measureOperation = async (operation: () => Promise<any>): Promise<{
    result: any;
    time: number;
    memoryBefore: NodeJS.MemoryUsage;
    memoryAfter: NodeJS.MemoryUsage;
  }> => {
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();

    const result = await operation();

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();

    return {
      result,
      time: endTime - startTime,
      memoryBefore,
      memoryAfter
    };
  };

  describe('Dataset Size Scaling', () => {
    test('small dataset (1K entries) performance baseline', async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.small);

      const { result, time } = await measureOperation(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 50,
          sortBy: 'updated_at',
          sortOrder: 'desc'
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(50);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.querySmall);

      console.log(`Small dataset query: ${time.toFixed(2)}ms`);
    });

    test('medium dataset (5K entries) performance', async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.medium);

      const { result, time } = await measureOperation(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 50,
          sortBy: 'updated_at',
          sortOrder: 'desc'
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(50);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.queryMedium);

      console.log(`Medium dataset query: ${time.toFixed(2)}ms`);
    });

    test('large dataset (10K entries) performance', async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.large);

      const { result, time } = await measureOperation(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 50,
          sortBy: 'updated_at',
          sortOrder: 'desc'
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(50);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.queryLarge);

      console.log(`Large dataset query: ${time.toFixed(2)}ms`);
    });

    test('extra large dataset (25K entries) performance', async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.xlarge);

      const { result, time } = await measureOperation(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 50,
          sortBy: 'updated_at',
          sortOrder: 'desc'
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(50);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.queryXLarge);

      console.log(`XL dataset query: ${time.toFixed(2)}ms`);
    });
  });

  describe('Query Performance with Large Datasets', () => {
    beforeAll(async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.large);
    });

    test('filtering should maintain performance with large datasets', async () => {
      const filterTests = [
        {
          name: 'Single category filter',
          options: { filters: { categories: ['VSAM'] } }
        },
        {
          name: 'Multiple category filter',
          options: { filters: { categories: ['VSAM', 'JCL', 'DB2'] } }
        },
        {
          name: 'Severity filter',
          options: { filters: { severities: ['critical', 'high'] } }
        },
        {
          name: 'Date range filter',
          options: {
            filters: {
              dateRange: {
                start: '2024-01-01',
                end: '2024-12-31'
              }
            }
          }
        },
        {
          name: 'Complex combined filters',
          options: {
            filters: {
              categories: ['VSAM', 'JCL'],
              severities: ['high', 'critical'],
              tags: ['error', 'critical']
            }
          }
        }
      ];

      for (const test of filterTests) {
        const { result, time } = await measureOperation(() =>
          kbService.getEntries({
            page: 1,
            pageSize: 50,
            ...test.options
          })
        );

        expect(result.success).toBe(true);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.queryLarge);

        console.log(`${test.name}: ${time.toFixed(2)}ms, ${result.data.length} results`);
      }
    });

    test('sorting should be efficient with large datasets', async () => {
      const sortTests = [
        { field: 'title', order: 'asc' as const },
        { field: 'updated_at', order: 'desc' as const },
        { field: 'usage_count', order: 'desc' as const },
        { field: 'created_at', order: 'desc' as const },
        { field: 'success_rate', order: 'desc' as const }
      ];

      for (const { field, order } of sortTests) {
        const { result, time } = await measureOperation(() =>
          kbService.getEntries({
            page: 1,
            pageSize: 50,
            sortBy: field,
            sortOrder: order
          })
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(50);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.queryLarge);

        // Verify sorting is correct
        if (result.data.length > 1) {
          const sorted = [...result.data].sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            return order === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
          });

          expect(result.data[0][field]).toEqual(sorted[0][field]);
          expect(result.data[result.data.length - 1][field]).toEqual(
            sorted[sorted.length - 1][field]
          );
        }

        console.log(`Sort by ${field} ${order}: ${time.toFixed(2)}ms`);
      }
    });

    test('deep pagination should remain efficient', async () => {
      const pages = [1, 50, 100, 200];
      const pageSize = 50;

      for (const page of pages) {
        const { result, time } = await measureOperation(() =>
          kbService.getEntries({
            page,
            pageSize,
            sortBy: 'created_at',
            sortOrder: 'desc'
          })
        );

        expect(result.success).toBe(true);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.queryLarge);

        console.log(`Page ${page}: ${time.toFixed(2)}ms`);
      }

      // Performance should not degrade significantly for deep pages
      const firstPageTime = (await measureOperation(() =>
        kbService.getEntries({ page: 1, pageSize: 50 })
      )).time;

      const deepPageTime = (await measureOperation(() =>
        kbService.getEntries({ page: 200, pageSize: 50 })
      )).time;

      expect(deepPageTime).toBeLessThan(firstPageTime * 3); // Max 3x slower
    });
  });

  describe('Full-Text Search Performance', () => {
    beforeAll(async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.large);
    });

    test('full-text search should handle large datasets efficiently', async () => {
      const searchQueries = [
        'VSAM status error',
        'database connection failed',
        'S0C7 data exception',
        'file not found catalog',
        'JCL syntax error allocation'
      ];

      for (const query of searchQueries) {
        const { result, time } = await measureOperation(() =>
          kbService.getEntries({
            page: 1,
            pageSize: 20,
            search: query,
            searchMode: 'fts'
          })
        );

        expect(result.success).toBe(true);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.fullTextSearch);

        console.log(`FTS "${query}": ${time.toFixed(2)}ms, ${result.data.length} results`);
      }
    });

    test('search with filters should combine efficiently on large dataset', async () => {
      const { result, time } = await measureOperation(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 30,
          search: 'error critical database',
          filters: {
            categories: ['VSAM', 'DB2'],
            severities: ['high', 'critical']
          },
          sortBy: 'relevance'
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.fullTextSearch);

      console.log(`Search + filter on large dataset: ${time.toFixed(2)}ms`);
    });

    test('complex search queries should be optimized', async () => {
      const complexQueries = [
        'VSAM status code 35 file catalog error',
        'S0C7 data exception numeric field COBOL',
        'JCL dataset allocation IEF212I not found',
        'DB2 SQLCODE resource unavailable lock timeout'
      ];

      for (const query of complexQueries) {
        const { result, time } = await measureOperation(() =>
          kbService.getEntries({
            page: 1,
            pageSize: 25,
            search: query,
            searchMode: 'fts'
          })
        );

        expect(result.success).toBe(true);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.fullTextSearch);

        console.log(`Complex search "${query}": ${time.toFixed(2)}ms`);
      }
    });
  });

  describe('Aggregation Performance', () => {
    beforeAll(async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.large);
    });

    test('category aggregations should be efficient on large datasets', async () => {
      const { result, time } = await measureOperation(() =>
        kbService.getAggregations({
          includeCategories: true,
          includeSeverities: true
        })
      );

      expect(result.success).toBe(true);
      expect(result.data.categories).toBeDefined();
      expect(result.data.severities).toBeDefined();
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.aggregation);

      console.log(`Category/Severity aggregation: ${time.toFixed(2)}ms`);
    });

    test('tag aggregations should handle large tag volumes', async () => {
      const { result, time } = await measureOperation(() =>
        kbService.getAggregations({
          includeTags: true,
          tagLimit: 100
        })
      );

      expect(result.success).toBe(true);
      expect(result.data.tags).toBeDefined();
      expect(Object.keys(result.data.tags)).toHaveLength(100);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.aggregation);

      console.log(`Tag aggregation (top 100): ${time.toFixed(2)}ms`);
    });

    test('usage statistics should scale with dataset size', async () => {
      const { result, time } = await measureOperation(() =>
        kbService.getAggregations({
          includeUsageStats: true,
          includeTimeSeriesData: true
        })
      );

      expect(result.success).toBe(true);
      expect(result.data.usageStats).toBeDefined();
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.aggregation);

      console.log(`Usage statistics: ${time.toFixed(2)}ms`);
    });

    test('filtered aggregations should maintain performance', async () => {
      const { result, time } = await measureOperation(() =>
        kbService.getAggregations({
          includeCategories: true,
          includeSeverities: true,
          includeTags: true,
          filters: {
            dateRange: {
              start: '2024-01-01',
              end: '2024-12-31'
            },
            categories: ['VSAM', 'JCL', 'DB2']
          }
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.aggregation);

      console.log(`Filtered aggregations: ${time.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Operations on Large Datasets', () => {
    beforeAll(async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.large);
    });

    test('concurrent queries should not degrade performance significantly', async () => {
      const concurrentCount = 20;
      const queries = Array.from({ length: concurrentCount }, (_, i) => () =>
        kbService.getEntries({
          page: (i % 10) + 1,
          pageSize: 25,
          filters: {
            categories: i % 2 === 0 ? ['VSAM'] : ['JCL'],
            severities: i % 3 === 0 ? ['critical'] : ['high']
          }
        })
      );

      const startTime = performance.now();

      const results = await Promise.all(
        queries.map(query => measureOperation(query))
      );

      const totalTime = performance.now() - startTime;

      // All queries should succeed
      results.forEach(({ result }) => {
        expect(result.success).toBe(true);
      });

      // Individual queries should not be too slow
      const avgQueryTime = results.reduce((sum, { time }) => sum + time, 0) / results.length;
      expect(avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.queryLarge * 2);

      console.log(`${concurrentCount} concurrent queries: total ${totalTime.toFixed(2)}ms, avg ${avgQueryTime.toFixed(2)}ms`);
    });

    test('mixed operation types should handle concurrency well', async () => {
      const mixedOperations = [
        // Regular queries
        () => kbService.getEntries({ page: 1, pageSize: 30 }),
        () => kbService.getEntries({ page: 2, pageSize: 30 }),

        // Filtered queries
        () => kbService.getEntries({
          filters: { categories: ['VSAM'] },
          page: 1,
          pageSize: 20
        }),

        // Search queries
        () => kbService.getEntries({
          search: 'database error',
          page: 1,
          pageSize: 15
        }),

        // Aggregations
        () => kbService.getAggregations({
          includeCategories: true,
          includeSeverities: true
        }),

        // Sorted queries
        () => kbService.getEntries({
          sortBy: 'usage_count',
          sortOrder: 'desc',
          page: 1,
          pageSize: 25
        })
      ];

      const startTime = performance.now();

      const results = await Promise.all(
        mixedOperations.map(op => measureOperation(op))
      );

      const totalTime = performance.now() - startTime;

      // All should succeed
      results.forEach(({ result }) => {
        expect(result.success).toBe(true);
      });

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.queryLarge * 3);

      console.log(`Mixed concurrent operations: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage with Large Datasets', () => {
    test('memory usage should remain reasonable during large operations', async () => {
      clearTestData(db);
      const initialMemory = process.memoryUsage();

      await loadDataset(DATASET_SIZES.large);

      // Perform various operations that could consume memory
      const operations = [
        () => kbService.getEntries({ page: 1, pageSize: 100 }),
        () => kbService.getEntries({ search: 'comprehensive search query', page: 1, pageSize: 50 }),
        () => kbService.getAggregations({ includeCategories: true, includeTags: true }),
        () => kbService.getEntries({
          filters: {
            categories: ['VSAM', 'JCL', 'DB2', 'Batch'],
            severities: ['medium', 'high', 'critical']
          },
          page: 1,
          pageSize: 75
        })
      ];

      for (const operation of operations) {
        await operation();
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage * 1024 * 1024);

      console.log(`Memory growth during large dataset operations: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should handle garbage collection efficiently with large datasets', async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.medium);

      const performGCTest = async () => {
        const operations = [];

        // Generate memory pressure
        for (let i = 0; i < 100; i++) {
          operations.push(
            kbService.getEntries({
              page: (i % 20) + 1,
              pageSize: 50,
              search: `test query ${i}`,
              filters: {
                categories: ['VSAM', 'JCL', 'DB2'][i % 3] ? [['VSAM', 'JCL', 'DB2'][i % 3]] : undefined
              }
            })
          );

          // Process in batches to avoid overwhelming
          if (operations.length >= 10) {
            await Promise.all(operations);
            operations.length = 0; // Clear array

            // Force GC if available
            if (global.gc) {
              global.gc();
            }
          }
        }

        // Process remaining operations
        if (operations.length > 0) {
          await Promise.all(operations);
        }

        return true;
      };

      const startTime = performance.now();
      const completed = await performGCTest();
      const endTime = performance.now();

      expect(completed).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete in <10s

      console.log(`GC test with large dataset completed in: ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Batch Operations Performance', () => {
    test('batch inserts should be efficient', async () => {
      clearTestData(db);

      const batchSize = 1000;
      const batchData = generatePerformanceDataset({
        entryCount: batchSize,
        includeVariations: true
      });

      const { time } = await measureOperation(async () => {
        const insertStmt = db.prepare(`
          INSERT INTO kb_entries (
            id, title, problem, solution, category, severity,
            created_at, updated_at, usage_count, success_count, failure_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction(() => {
          batchData.forEach(entry => {
            insertStmt.run(
              entry.id, entry.title, entry.problem, entry.solution,
              entry.category, entry.severity, entry.created_at,
              entry.updated_at, entry.usage_count,
              entry.success_count, entry.failure_count
            );
          });
        });

        transaction();
        return { inserted: batchSize };
      });

      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.batchOperation);

      console.log(`Batch insert of ${batchSize} entries: ${time.toFixed(2)}ms`);
    });

    test('batch updates should maintain performance', async () => {
      clearTestData(db);
      await loadDataset(1000);

      const updateCount = 500;

      const { result, time } = await measureOperation(async () => {
        const updateStmt = db.prepare(`
          UPDATE kb_entries
          SET usage_count = usage_count + 1,
              success_count = success_count + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

        // Get some entry IDs
        const entries = db.prepare('SELECT id FROM kb_entries LIMIT ?').all(updateCount);

        const transaction = db.transaction(() => {
          entries.forEach(entry => {
            updateStmt.run(1, entry.id);
          });
        });

        transaction();
        return { updated: entries.length };
      });

      expect(result.updated).toBe(updateCount);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.batchOperation);

      console.log(`Batch update of ${updateCount} entries: ${time.toFixed(2)}ms`);
    });

    test('bulk delete operations should be efficient', async () => {
      clearTestData(db);
      await loadDataset(2000);

      const deleteCount = 500;

      const { result, time } = await measureOperation(async () => {
        // Delete oldest entries
        const deleteStmt = db.prepare(`
          DELETE FROM kb_entries
          WHERE id IN (
            SELECT id FROM kb_entries
            ORDER BY created_at ASC
            LIMIT ?
          )
        `);

        const deleted = deleteStmt.run(deleteCount);
        return { deleted: deleted.changes };
      });

      expect(result.deleted).toBe(deleteCount);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.batchOperation);

      console.log(`Bulk delete of ${deleteCount} entries: ${time.toFixed(2)}ms`);
    });
  });

  describe('Scalability Analysis', () => {
    test('should demonstrate linear scaling characteristics', async () => {
      const sizes = [1000, 2000, 4000];
      const results = [];

      for (const size of sizes) {
        clearTestData(db);
        await loadDataset(size);

        const { time } = await measureOperation(() =>
          kbService.getEntries({
            page: 1,
            pageSize: 50,
            filters: { categories: ['VSAM', 'JCL'] },
            sortBy: 'updated_at'
          })
        );

        results.push({ size, time });
        console.log(`${size} entries: ${time.toFixed(2)}ms`);
      }

      // Performance should not grow exponentially
      const firstTime = results[0].time;
      const lastTime = results[results.length - 1].time;
      const sizeRatio = sizes[sizes.length - 1] / sizes[0];

      // Time growth should be less than size growth squared
      expect(lastTime).toBeLessThan(firstTime * sizeRatio * sizeRatio);

      console.log(`Scalability test - size ratio: ${sizeRatio}x, time ratio: ${(lastTime / firstTime).toFixed(2)}x`);
    });

    test('should identify performance bottlenecks at scale', async () => {
      clearTestData(db);
      await loadDataset(DATASET_SIZES.xlarge);

      const bottleneckTests = [
        {
          name: 'Large result set',
          operation: () => kbService.getEntries({ page: 1, pageSize: 200 })
        },
        {
          name: 'Complex filter combination',
          operation: () => kbService.getEntries({
            filters: {
              categories: ['VSAM', 'JCL', 'DB2', 'Batch'],
              severities: ['medium', 'high', 'critical'],
              tags: ['error', 'critical', 'database']
            },
            page: 1,
            pageSize: 50
          })
        },
        {
          name: 'Deep pagination',
          operation: () => kbService.getEntries({
            page: 100,
            pageSize: 50,
            sortBy: 'title'
          })
        },
        {
          name: 'Full aggregation',
          operation: () => kbService.getAggregations({
            includeCategories: true,
            includeSeverities: true,
            includeTags: true,
            includeUsageStats: true,
            tagLimit: 200
          })
        }
      ];

      for (const test of bottleneckTests) {
        const { result, time } = await measureOperation(test.operation);

        expect(result.success).toBe(true);

        console.log(`${test.name}: ${time.toFixed(2)}ms`);

        // Identify potential bottlenecks (>1s response time)
        if (time > 1000) {
          console.warn(`⚠️  Potential bottleneck detected: ${test.name} took ${time.toFixed(2)}ms`);
        }
      }
    });
  });
});