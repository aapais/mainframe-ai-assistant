/**
 * Query Performance Benchmark Tests
 * Measures and validates database query performance under various conditions
 */

import Database from 'better-sqlite3';
import { createPerformanceTestDatabase, seedRealisticData } from '../helpers/test-database';
import { generatePerformanceDataset } from '../helpers/mock-data-generator';
import { KBListingService } from '../../../src/services/KBListingService';
import { QueryBuilder } from '../../../src/services/QueryBuilder';
import { CacheService } from '../../../src/services/CacheService';

describe('Query Performance Benchmarks', () => {
  let db: Database.Database;
  let kbService: KBListingService;
  let queryBuilder: QueryBuilder;
  let cacheService: CacheService;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    simpleQuery: 50,
    complexQuery: 150,
    aggregationQuery: 200,
    fullTextSearch: 300,
    deepPagination: 100,
    concurrentQueries: 500,
    cacheHit: 10,
    cacheMiss: 100
  };

  beforeAll(async () => {
    console.log('Setting up performance test database...');

    // Create optimized database for performance testing
    db = createPerformanceTestDatabase();

    // Seed with large realistic dataset
    const performanceDataset = generatePerformanceDataset({
      entryCount: 5000,
      includeVariations: true,
      includeLargeSolutions: true,
      includeComplexTags: true
    });

    console.log(`Seeding database with ${performanceDataset.length} entries...`);

    // Use batch insert for performance
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
      performanceDataset.forEach(entry => {
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

    // Initialize services
    cacheService = new CacheService();
    kbService = new KBListingService(db, { cacheService });
    queryBuilder = new QueryBuilder();

    console.log('Performance test setup complete');
  });

  afterAll(() => {
    db?.close();
  });

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();
  });

  const measureQueryTime = async (queryFn: () => Promise<any>): Promise<{ result: any, time: number }> => {
    const startTime = performance.now();
    const result = await queryFn();
    const endTime = performance.now();

    return {
      result,
      time: endTime - startTime
    };
  };

  describe('Basic Query Performance', () => {
    test('simple listing query should meet performance threshold', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 20,
          sortBy: 'updated_at',
          sortOrder: 'desc'
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(20);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleQuery);

      console.log(`Simple query time: ${time.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.simpleQuery}ms)`);
    });

    test('category filtering should be fast', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 20,
          filters: {
            categories: ['VSAM']
          }
        })
      );

      expect(result.success).toBe(true);
      expect(result.data.every((entry: any) => entry.category === 'VSAM')).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleQuery);

      console.log(`Category filter time: ${time.toFixed(2)}ms`);
    });

    test('sorting by different fields should be efficient', async () => {
      const sortFields = ['title', 'updated_at', 'usage_count', 'created_at'];
      const results = [];

      for (const sortBy of sortFields) {
        const { result, time } = await measureQueryTime(() =>
          kbService.getEntries({
            page: 1,
            pageSize: 20,
            sortBy,
            sortOrder: 'desc'
          })
        );

        expect(result.success).toBe(true);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleQuery);

        results.push({ field: sortBy, time: time.toFixed(2) });
      }

      console.log('Sorting performance:', results);
    });
  });

  describe('Complex Query Performance', () => {
    test('multi-filter query should meet performance threshold', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 20,
          filters: {
            categories: ['VSAM', 'JCL'],
            severities: ['high', 'critical'],
            tags: ['error', 'abend'],
            dateRange: {
              start: '2024-01-01',
              end: '2024-12-31'
            }
          },
          sortBy: 'relevance',
          sortOrder: 'desc'
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);

      console.log(`Complex filter time: ${time.toFixed(2)}ms (threshold: ${PERFORMANCE_THRESHOLDS.complexQuery}ms)`);
    });

    test('tag-based filtering should be optimized', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 20,
          filters: {
            tags: ['database', 'connection', 'error']
          }
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);

      // Verify results actually match tag criteria
      result.data.forEach((entry: any) => {
        const hasMatchingTag = ['database', 'connection', 'error'].some(tag =>
          entry.tags?.includes(tag)
        );
        expect(hasMatchingTag).toBe(true);
      });

      console.log(`Tag filter time: ${time.toFixed(2)}ms`);
    });

    test('date range queries should be efficient', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 50,
          filters: {
            dateRange: {
              start: '2024-06-01',
              end: '2024-12-31'
            }
          },
          sortBy: 'created_at',
          sortOrder: 'desc'
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);

      // Verify date filtering is correct
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-12-31');

      result.data.forEach((entry: any) => {
        const entryDate = new Date(entry.created_at);
        expect(entryDate >= startDate).toBe(true);
        expect(entryDate <= endDate).toBe(true);
      });

      console.log(`Date range filter time: ${time.toFixed(2)}ms`);
    });
  });

  describe('Full-Text Search Performance', () => {
    test('simple text search should meet threshold', async () => {
      const searchQueries = [
        'VSAM error',
        'database connection',
        'S0C7 abend',
        'file not found'
      ];

      for (const query of searchQueries) {
        const { result, time } = await measureQueryTime(() =>
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

    test('complex search queries should be optimized', async () => {
      const complexSearches = [
        'VSAM status code 35 file catalog',
        'S0C7 data exception numeric field',
        'JCL dataset allocation error IEF212I',
        'DB2 SQLCODE resource unavailable'
      ];

      for (const query of complexSearches) {
        const { result, time } = await measureQueryTime(() =>
          kbService.getEntries({
            page: 1,
            pageSize: 10,
            search: query,
            searchMode: 'fts',
            filters: {
              categories: ['VSAM', 'JCL', 'DB2', 'Batch']
            }
          })
        );

        expect(result.success).toBe(true);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.fullTextSearch);

        console.log(`Complex FTS "${query}": ${time.toFixed(2)}ms`);
      }
    });

    test('search with filters should combine efficiently', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 20,
          search: 'error database',
          filters: {
            categories: ['VSAM', 'DB2'],
            severities: ['high', 'critical']
          },
          sortBy: 'relevance'
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.fullTextSearch);

      console.log(`Search + filter time: ${time.toFixed(2)}ms`);
    });
  });

  describe('Aggregation Performance', () => {
    test('basic aggregations should be fast', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getAggregations({
          includeCategories: true,
          includeSeverities: true,
          includeUsageStats: true
        })
      );

      expect(result.success).toBe(true);
      expect(result.data.categories).toBeDefined();
      expect(result.data.severities).toBeDefined();
      expect(result.data.usageStats).toBeDefined();
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.aggregationQuery);

      console.log(`Basic aggregations time: ${time.toFixed(2)}ms`);
    });

    test('tag aggregations should be optimized', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getAggregations({
          includeTags: true,
          tagLimit: 50
        })
      );

      expect(result.success).toBe(true);
      expect(result.data.tags).toBeDefined();
      expect(Object.keys(result.data.tags)).toHaveLength(50);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.aggregationQuery);

      console.log(`Tag aggregations time: ${time.toFixed(2)}ms`);
    });

    test('filtered aggregations should maintain performance', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getAggregations({
          includeCategories: true,
          includeSeverities: true,
          includeTags: true,
          filters: {
            dateRange: {
              start: '2024-01-01',
              end: '2024-12-31'
            }
          }
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.aggregationQuery);

      console.log(`Filtered aggregations time: ${time.toFixed(2)}ms`);
    });
  });

  describe('Pagination Performance', () => {
    test('deep pagination should remain efficient', async () => {
      const pages = [1, 10, 50, 100];
      const results = [];

      for (const page of pages) {
        const { result, time } = await measureQueryTime(() =>
          kbService.getEntries({
            page,
            pageSize: 20,
            sortBy: 'created_at',
            sortOrder: 'desc'
          })
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(20);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.deepPagination);

        results.push({ page, time: time.toFixed(2) });
      }

      console.log('Deep pagination performance:', results);

      // Deep pages should not be significantly slower
      const firstPageTime = parseFloat(results[0].time);
      const deepPageTime = parseFloat(results[results.length - 1].time);
      expect(deepPageTime).toBeLessThan(firstPageTime * 3); // Max 3x slower
    });

    test('different page sizes should scale appropriately', async () => {
      const pageSizes = [10, 20, 50, 100];
      const results = [];

      for (const pageSize of pageSizes) {
        const { result, time } = await measureQueryTime(() =>
          kbService.getEntries({
            page: 1,
            pageSize,
            sortBy: 'updated_at'
          })
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(pageSize);

        results.push({ pageSize, time: time.toFixed(2) });
      }

      console.log('Page size scaling:', results);

      // Larger pages should not be exponentially slower
      const small = parseFloat(results[0].time);
      const large = parseFloat(results[results.length - 1].time);
      expect(large).toBeLessThan(small * 5); // Max 5x slower for 10x data
    });
  });

  describe('Concurrent Query Performance', () => {
    test('concurrent queries should not degrade significantly', async () => {
      const concurrentCount = 10;
      const queries = Array.from({ length: concurrentCount }, (_, i) =>
        () => kbService.getEntries({
          page: Math.floor(i / 2) + 1,
          pageSize: 20,
          filters: {
            categories: i % 2 === 0 ? ['VSAM'] : ['JCL']
          }
        })
      );

      const startTime = performance.now();

      const results = await Promise.all(
        queries.map(query => measureQueryTime(query))
      );

      const totalTime = performance.now() - startTime;

      // All queries should succeed
      results.forEach(({ result }) => {
        expect(result.success).toBe(true);
      });

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentQueries);

      // Individual queries should not be too slow
      const avgQueryTime = results.reduce((sum, { time }) => sum + time, 0) / results.length;
      expect(avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery * 2);

      console.log(`Concurrent queries: total ${totalTime.toFixed(2)}ms, avg ${avgQueryTime.toFixed(2)}ms`);
    });

    test('mixed query types should handle concurrency well', async () => {
      const mixedQueries = [
        () => kbService.getEntries({ page: 1, pageSize: 20 }),
        () => kbService.getEntries({ search: 'error', page: 1, pageSize: 10 }),
        () => kbService.getAggregations({ includeCategories: true }),
        () => kbService.getEntries({ filters: { categories: ['VSAM'] }, page: 1, pageSize: 15 }),
        () => kbService.getEntries({ sortBy: 'usage_count', page: 2, pageSize: 20 })
      ];

      const startTime = performance.now();

      const results = await Promise.all(
        mixedQueries.map(query => measureQueryTime(query))
      );

      const totalTime = performance.now() - startTime;

      // All should succeed
      results.forEach(({ result }) => {
        expect(result.success).toBe(true);
      });

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentQueries);

      console.log(`Mixed concurrent queries: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Cache Performance', () => {
    test('cache hits should be extremely fast', async () => {
      const queryOptions = {
        page: 1,
        pageSize: 20,
        sortBy: 'updated_at' as const
      };

      // First query (cache miss)
      const { result: firstResult, time: missTime } = await measureQueryTime(() =>
        kbService.getEntries(queryOptions)
      );

      expect(firstResult.success).toBe(true);

      // Second query (cache hit)
      const { result: secondResult, time: hitTime } = await measureQueryTime(() =>
        kbService.getEntries(queryOptions)
      );

      expect(secondResult.success).toBe(true);
      expect(hitTime).toBeLessThan(PERFORMANCE_THRESHOLDS.cacheHit);

      // Cache hit should be much faster than miss
      expect(hitTime).toBeLessThan(missTime * 0.2); // At least 5x faster

      console.log(`Cache miss: ${missTime.toFixed(2)}ms, hit: ${hitTime.toFixed(2)}ms`);
    });

    test('cache invalidation should work correctly', async () => {
      const queryOptions = {
        page: 1,
        pageSize: 20,
        filters: { categories: ['VSAM'] }
      };

      // Prime cache
      await kbService.getEntries(queryOptions);

      // Verify cache hit
      const { time: hitTime } = await measureQueryTime(() =>
        kbService.getEntries(queryOptions)
      );

      expect(hitTime).toBeLessThan(PERFORMANCE_THRESHOLDS.cacheHit);

      // Invalidate cache (simulate data change)
      cacheService.invalidate('kb-entries');

      // Next query should be cache miss but still fast
      const { result, time: missTime } = await measureQueryTime(() =>
        kbService.getEntries(queryOptions)
      );

      expect(result.success).toBe(true);
      expect(missTime).toBeLessThan(PERFORMANCE_THRESHOLDS.cacheMiss);
      expect(missTime).toBeGreaterThan(hitTime * 2); // Should be noticeably slower

      console.log(`Cache invalidation - hit: ${hitTime.toFixed(2)}ms, miss: ${missTime.toFixed(2)}ms`);
    });

    test('cache should handle different query patterns efficiently', async () => {
      const queryPatterns = [
        { page: 1, pageSize: 20, sortBy: 'title' },
        { page: 1, pageSize: 20, filters: { categories: ['VSAM'] } },
        { page: 2, pageSize: 20, sortBy: 'title' }, // Different page
        { page: 1, pageSize: 30, sortBy: 'title' }, // Different page size
        { search: 'error', page: 1, pageSize: 20 }
      ];

      // Prime all caches
      for (const pattern of queryPatterns) {
        await kbService.getEntries(pattern);
      }

      // Measure cache hits
      const hitTimes = [];
      for (const pattern of queryPatterns) {
        const { time } = await measureQueryTime(() =>
          kbService.getEntries(pattern)
        );
        hitTimes.push(time);
      }

      // All cache hits should be fast
      hitTimes.forEach((time, index) => {
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.cacheHit);
        console.log(`Cache hit ${index + 1}: ${time.toFixed(2)}ms`);
      });

      const avgHitTime = hitTimes.reduce((sum, time) => sum + time, 0) / hitTimes.length;
      console.log(`Average cache hit time: ${avgHitTime.toFixed(2)}ms`);
    });
  });

  describe('Large Dataset Performance', () => {
    test('should maintain performance with large result sets', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 100, // Large page
          sortBy: 'created_at'
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(100);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);

      console.log(`Large page (100 items): ${time.toFixed(2)}ms`);
    });

    test('should handle broad filters efficiently', async () => {
      const { result, time } = await measureQueryTime(() =>
        kbService.getEntries({
          page: 1,
          pageSize: 50,
          filters: {
            categories: ['VSAM', 'JCL', 'DB2', 'Batch'], // Most categories
            severities: ['medium', 'high', 'critical'] // Most severities
          }
        })
      );

      expect(result.success).toBe(true);
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);

      console.log(`Broad filters: ${time.toFixed(2)}ms, ${result.data.length} results`);
    });

    test('should scale with database size', async () => {
      // Test query performance doesn't degrade significantly with data size
      const queries = [
        { description: 'Simple listing', options: { page: 1, pageSize: 20 } },
        { description: 'Category filter', options: { page: 1, pageSize: 20, filters: { categories: ['VSAM'] } } },
        { description: 'Text search', options: { page: 1, pageSize: 20, search: 'error' } },
        { description: 'Complex filter', options: {
          page: 1, pageSize: 20,
          filters: { categories: ['VSAM'], severities: ['high'] },
          search: 'database'
        }}
      ];

      const results = [];
      for (const { description, options } of queries) {
        const { result, time } = await measureQueryTime(() =>
          kbService.getEntries(options)
        );

        expect(result.success).toBe(true);
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);

        results.push({ description, time: time.toFixed(2), count: result.data.length });
      }

      console.log('Large dataset performance:', results);
    });
  });

  describe('Memory Usage Performance', () => {
    test('should not leak memory during repeated queries', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many queries
      for (let i = 0; i < 100; i++) {
        await kbService.getEntries({
          page: (i % 10) + 1,
          pageSize: 20,
          filters: {
            categories: i % 2 === 0 ? ['VSAM'] : ['JCL']
          }
        });
      }

      const finalMemory = process.memoryUsage();

      // Memory growth should be reasonable (less than 50MB)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB

      console.log(`Memory growth after 100 queries: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should handle garbage collection efficiently', async () => {
      const performGCTest = async () => {
        // Perform memory-intensive operations
        const largeResults = [];
        for (let i = 0; i < 10; i++) {
          const result = await kbService.getEntries({
            page: 1,
            pageSize: 100,
            search: 'test query with large results'
          });
          largeResults.push(result);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        return largeResults.length;
      };

      const startTime = performance.now();
      const resultCount = await performGCTest();
      const endTime = performance.now();

      expect(resultCount).toBe(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in <1s

      console.log(`GC test completed in: ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Query Plan Analysis', () => {
    test('should use proper indexes for common queries', async () => {
      const testQueries = [
        {
          name: 'Category filter',
          options: { filters: { categories: ['VSAM'] } },
          expectedIndex: 'idx_kb_category'
        },
        {
          name: 'Date sorting',
          options: { sortBy: 'created_at' },
          expectedIndex: 'idx_kb_created_at'
        },
        {
          name: 'Usage sorting',
          options: { sortBy: 'usage_count' },
          expectedIndex: 'idx_kb_usage_count'
        }
      ];

      for (const { name, options, expectedIndex } of testQueries) {
        const query = queryBuilder.buildQuery(options);
        const explainQuery = `EXPLAIN QUERY PLAN ${query.sql}`;
        const plan = db.prepare(explainQuery).all(...query.params);

        const planText = plan.map(p => p.detail).join(' ');
        expect(planText).toMatch(new RegExp(expectedIndex),
          `${name} should use ${expectedIndex}`);

        console.log(`${name} query plan: ${planText}`);
      }
    });

    test('should avoid table scans for filtered queries', async () => {
      const filteredQuery = queryBuilder.buildQuery({
        filters: {
          categories: ['VSAM', 'JCL'],
          severities: ['high']
        }
      });

      const explainQuery = `EXPLAIN QUERY PLAN ${filteredQuery.sql}`;
      const plan = db.prepare(explainQuery).all(...filteredQuery.params);

      const planText = plan.map(p => p.detail).join(' ');

      // Should not contain table scan
      expect(planText).not.toMatch(/SCAN TABLE kb_entries/);

      console.log('Filtered query plan:', planText);
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain performance baselines', async () => {
      const baselines = {
        simpleQuery: PERFORMANCE_THRESHOLDS.simpleQuery,
        complexQuery: PERFORMANCE_THRESHOLDS.complexQuery,
        fullTextSearch: PERFORMANCE_THRESHOLDS.fullTextSearch,
        aggregations: PERFORMANCE_THRESHOLDS.aggregationQuery
      };

      const testCases = [
        {
          name: 'simpleQuery',
          test: () => kbService.getEntries({ page: 1, pageSize: 20 })
        },
        {
          name: 'complexQuery',
          test: () => kbService.getEntries({
            page: 1, pageSize: 20,
            filters: { categories: ['VSAM'], severities: ['high'] },
            search: 'error'
          })
        },
        {
          name: 'fullTextSearch',
          test: () => kbService.getEntries({
            page: 1, pageSize: 20,
            search: 'VSAM status code error file'
          })
        },
        {
          name: 'aggregations',
          test: () => kbService.getAggregations({
            includeCategories: true,
            includeSeverities: true,
            includeTags: true
          })
        }
      ];

      const results = [];
      for (const { name, test } of testCases) {
        const { time } = await measureQueryTime(test);
        const baseline = baselines[name];

        expect(time).toBeLessThan(baseline);

        results.push({
          test: name,
          time: time.toFixed(2),
          baseline,
          margin: ((time / baseline) * 100).toFixed(1) + '%'
        });
      }

      console.log('Performance regression test results:', results);
    });
  });
});