/**
 * Database Query Integration Tests
 * Tests actual database performance, complex queries, and optimization
 */

import Database from 'better-sqlite3';
import { createTestDatabase, seedRealisticData, clearTestData, getDatabaseStats } from '../helpers/test-database';
import { generateMockKBEntries, generatePerformanceDataset } from '../helpers/mock-data-generator';
import { KBListingService } from '../../../src/services/KBListingService';
import { QueryBuilder } from '../../../src/services/QueryBuilder';

describe('Database Query Integration Tests', () => {
  let db: Database.Database;
  let kbService: KBListingService;
  let queryBuilder: QueryBuilder;

  beforeAll(async () => {
    db = createTestDatabase({ memory: true, verbose: false });
    await seedRealisticData(db);

    kbService = new KBListingService(db);
    queryBuilder = new QueryBuilder();
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Clear any cached data
    kbService.clearCache?.();
  });

  describe('Query Performance Tests', () => {
    test('should execute basic query within performance threshold', async () => {
      const startTime = performance.now();

      const result = await kbService.getEntries({
        page: 1,
        pageSize: 20,
        sortBy: 'updated_at',
        sortOrder: 'desc'
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(100); // Should complete in <100ms
    });

    test('should handle complex filtering query efficiently', async () => {
      const startTime = performance.now();

      const result = await kbService.getEntries({
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
        search: 'database connection',
        sortBy: 'relevance',
        sortOrder: 'desc'
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.data).toBeDefined();
      expect(executionTime).toBeLessThan(200); // Complex query <200ms
    });

    test('should optimize query with proper indexing', async () => {
      // Test that indexes are being used
      const query = queryBuilder.buildQuery({
        filters: {
          categories: ['VSAM'],
          severities: ['high']
        },
        sortBy: 'updated_at'
      });

      const explainQuery = `EXPLAIN QUERY PLAN ${query.sql}`;
      const plan = db.prepare(explainQuery).all(...query.params);

      // Should use index for category and updated_at
      const planText = plan.map(p => p.detail).join(' ');
      expect(planText).toMatch(/USING INDEX.*idx_kb_category|idx_kb_updated_at/);
    });

    test('should handle full-text search efficiently', async () => {
      const startTime = performance.now();

      const result = await kbService.getEntries({
        page: 1,
        pageSize: 10,
        search: 'VSAM status code error file not found',
        searchMode: 'semantic'
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(300); // FTS query <300ms

      // Verify FTS is being used
      expect(result.metadata?.searchMethod).toBe('fts');
    });
  });

  describe('Large Dataset Performance', () => {
    let largeDb: Database.Database;

    beforeAll(async () => {
      largeDb = createTestDatabase({ memory: true });

      // Seed with large dataset
      const largeDataset = generatePerformanceDataset({
        entryCount: 1000,
        includeVariations: true,
        includeLargeSolutions: true
      });

      const insertStmt = largeDb.prepare(`
        INSERT INTO kb_entries (
          id, title, problem, solution, category, severity,
          created_at, updated_at, usage_count, success_count, failure_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = largeDb.transaction(() => {
        largeDataset.forEach(entry => {
          insertStmt.run(
            entry.id, entry.title, entry.problem, entry.solution,
            entry.category, entry.severity, entry.created_at,
            entry.updated_at, entry.usage_count, entry.success_count,
            entry.failure_count
          );
        });
      });

      transaction();
    });

    afterAll(() => {
      largeDb.close();
    });

    test('should handle pagination with large dataset', async () => {
      const service = new KBListingService(largeDb);
      const startTime = performance.now();

      // Test deep pagination
      const result = await service.getEntries({
        page: 20, // Deep page
        pageSize: 50,
        sortBy: 'created_at',
        sortOrder: 'desc'
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.data).toHaveLength(50);
      expect(result.pagination.totalPages).toBeGreaterThan(20);
      expect(executionTime).toBeLessThan(150); // Even deep pagination <150ms
    });

    test('should handle complex aggregations efficiently', async () => {
      const service = new KBListingService(largeDb);
      const startTime = performance.now();

      const aggregations = await service.getAggregations({
        includeCategories: true,
        includeSeverities: true,
        includeTags: true,
        includeUsageStats: true
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(aggregations.categories).toBeDefined();
      expect(aggregations.severities).toBeDefined();
      expect(aggregations.tags).toBeDefined();
      expect(aggregations.usageStats).toBeDefined();
      expect(executionTime).toBeLessThan(200); // Aggregations <200ms
    });

    test('should maintain performance under concurrent load', async () => {
      const service = new KBListingService(largeDb);
      const concurrentQueries = 10;
      const queries = [];

      const startTime = performance.now();

      // Simulate concurrent requests
      for (let i = 0; i < concurrentQueries; i++) {
        queries.push(service.getEntries({
          page: Math.floor(Math.random() * 10) + 1,
          pageSize: 20,
          filters: {
            categories: Math.random() > 0.5 ? ['VSAM'] : ['JCL'],
            severities: Math.random() > 0.5 ? ['high'] : ['medium']
          }
        }));
      }

      const results = await Promise.all(queries);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All queries should succeed
      results.forEach(result => {
        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThanOrEqual(0);
      });

      // Total time should be reasonable for concurrent execution
      expect(totalTime).toBeLessThan(1000); // 10 concurrent queries <1s

      // Average per query should still be fast
      const avgTime = totalTime / concurrentQueries;
      expect(avgTime).toBeLessThan(300);
    });
  });

  describe('Query Optimization Tests', () => {
    test('should use appropriate indexes for different query types', async () => {
      const testCases = [
        {
          name: 'Category filter',
          options: { filters: { categories: ['VSAM'] } },
          expectedIndex: 'idx_kb_category'
        },
        {
          name: 'Date range',
          options: {
            filters: {
              dateRange: { start: '2024-01-01', end: '2024-12-31' }
            }
          },
          expectedIndex: 'idx_kb_created_at'
        },
        {
          name: 'Usage sorting',
          options: { sortBy: 'usage_count', sortOrder: 'desc' },
          expectedIndex: 'idx_kb_usage_count'
        },
        {
          name: 'Success rate',
          options: { sortBy: 'success_rate', sortOrder: 'desc' },
          expectedIndex: 'idx_kb_success_rate'
        }
      ];

      for (const testCase of testCases) {
        const query = queryBuilder.buildQuery(testCase.options);
        const explainQuery = `EXPLAIN QUERY PLAN ${query.sql}`;
        const plan = db.prepare(explainQuery).all(...query.params);

        const planText = plan.map(p => p.detail).join(' ');
        expect(planText).toMatch(new RegExp(testCase.expectedIndex),
          `${testCase.name} should use ${testCase.expectedIndex}`);
      }
    });

    test('should avoid table scans for filtered queries', async () => {
      const query = queryBuilder.buildQuery({
        filters: {
          categories: ['VSAM', 'JCL'],
          severities: ['high']
        },
        search: 'error'
      });

      const explainQuery = `EXPLAIN QUERY PLAN ${query.sql}`;
      const plan = db.prepare(explainQuery).all(...query.params);

      // Should not contain "SCAN TABLE" for main queries
      const planText = plan.map(p => p.detail).join(' ');
      expect(planText).not.toMatch(/SCAN TABLE kb_entries/);
    });

    test('should optimize JOIN queries properly', async () => {
      const query = queryBuilder.buildQuery({
        filters: {
          tags: ['error', 'critical'],
          categories: ['VSAM']
        },
        includeTags: true
      });

      const result = db.prepare(query.sql).all(...query.params);
      expect(result).toBeDefined();

      // Verify the JOIN is using appropriate indexes
      const explainQuery = `EXPLAIN QUERY PLAN ${query.sql}`;
      const plan = db.prepare(explainQuery).all(...query.params);

      const planText = plan.map(p => p.detail).join(' ');
      expect(planText).toMatch(/USING INDEX.*idx_tags_entry_id|idx_tags_tag/);
    });
  });

  describe('Database Integrity Tests', () => {
    test('should maintain referential integrity', async () => {
      // Check foreign key constraints
      const integrityCheck = db.pragma('foreign_key_check');
      expect(integrityCheck).toHaveLength(0);

      // Test cascade delete
      const testEntry = generateMockKBEntries(1)[0];
      const entryId = await kbService.createEntry(testEntry);

      // Add tags
      db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)')
        .run(entryId, 'test-tag');

      // Delete entry should cascade to tags
      await kbService.deleteEntry(entryId);

      const remainingTags = db.prepare('SELECT * FROM kb_tags WHERE entry_id = ?')
        .all(entryId);
      expect(remainingTags).toHaveLength(0);
    });

    test('should handle concurrent modifications safely', async () => {
      const testEntry = generateMockKBEntries(1)[0];
      const entryId = await kbService.createEntry(testEntry);

      // Simulate concurrent updates
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(
          kbService.updateEntry(entryId, {
            ...testEntry,
            title: `Updated Title ${i}`
          })
        );
      }

      // All updates should complete without error
      const results = await Promise.allSettled(updates);
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalEntry = await kbService.getEntry(entryId);
      expect(finalEntry).toBeDefined();
      expect(finalEntry.title).toMatch(/Updated Title \d/);
    });

    test('should handle database constraints properly', async () => {
      // Test NOT NULL constraints
      await expect(kbService.createEntry({
        id: 'test-constraint-1',
        title: '', // Should fail - empty title
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Other'
      })).rejects.toThrow();

      // Test CHECK constraints for category
      await expect(kbService.createEntry({
        id: 'test-constraint-2',
        title: 'Test Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'INVALID_CATEGORY' // Should fail
      })).rejects.toThrow();
    });
  });

  describe('Query Result Accuracy Tests', () => {
    test('should return accurate counts and pagination', async () => {
      const totalEntries = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get().count;

      const result = await kbService.getEntries({
        page: 1,
        pageSize: 10
      });

      expect(result.pagination.totalItems).toBe(totalEntries);
      expect(result.pagination.totalPages).toBe(Math.ceil(totalEntries / 10));
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasNext).toBe(totalEntries > 10);
    });

    test('should filter results accurately', async () => {
      const vsam_count = db.prepare('SELECT COUNT(*) as count FROM kb_entries WHERE category = ?')
        .get('VSAM').count;

      const result = await kbService.getEntries({
        filters: { categories: ['VSAM'] },
        page: 1,
        pageSize: 100 // Large page size to get all
      });

      expect(result.data.every(entry => entry.category === 'VSAM')).toBe(true);
      expect(result.pagination.totalItems).toBe(vsam_count);
    });

    test('should sort results correctly', async () => {
      const result = await kbService.getEntries({
        sortBy: 'usage_count',
        sortOrder: 'desc',
        page: 1,
        pageSize: 20
      });

      // Check sorting is correct
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].usage_count).toBeLessThanOrEqual(
          result.data[i - 1].usage_count
        );
      }
    });

    test('should handle complex filter combinations accurately', async () => {
      const filters = {
        categories: ['VSAM', 'JCL'],
        severities: ['high', 'critical'],
        tags: ['error'],
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        }
      };

      const result = await kbService.getEntries({
        filters,
        page: 1,
        pageSize: 100
      });

      // Verify each entry matches all criteria
      result.data.forEach(entry => {
        expect(['VSAM', 'JCL']).toContain(entry.category);
        expect(['high', 'critical']).toContain(entry.severity);
        expect(entry.tags?.some(tag => tag === 'error')).toBe(true);

        const entryDate = new Date(entry.created_at);
        expect(entryDate >= new Date('2024-01-01')).toBe(true);
        expect(entryDate <= new Date('2024-12-31')).toBe(true);
      });
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain consistent query performance', async () => {
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        await kbService.getEntries({
          page: 1,
          pageSize: 20,
          filters: { categories: ['VSAM'] },
          sortBy: 'updated_at'
        });

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const stdDev = Math.sqrt(
        times.reduce((sq, time) => sq + Math.pow(time - avgTime, 2), 0) / times.length
      );

      // Performance should be consistent
      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(200);
      expect(stdDev).toBeLessThan(50); // Low variance
    });
  });

  describe('Database Connection Management', () => {
    test('should handle connection pooling properly', async () => {
      // Simulate multiple services using same database
      const services = Array(5).fill(null).map(() => new KBListingService(db));

      const queries = services.map((service, index) =>
        service.getEntries({
          page: index + 1,
          pageSize: 10
        })
      );

      const results = await Promise.all(queries);

      // All queries should succeed
      results.forEach(result => {
        expect(result.data).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    test('should recover from database errors gracefully', async () => {
      // Test with invalid query (simulated database error)
      const invalidQuery = 'SELECT * FROM non_existent_table';

      expect(() => {
        db.prepare(invalidQuery).all();
      }).toThrow();

      // Service should still work after error
      const result = await kbService.getEntries({
        page: 1,
        pageSize: 10
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});