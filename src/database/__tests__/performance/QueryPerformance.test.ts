import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DatabaseManager } from '../../DatabaseManager';
import { KnowledgeDB } from '../../KnowledgeDB';
import { TestDatabaseFactory } from '../test-utils/TestDatabaseFactory';
import { PerformanceTestHelper } from '../test-utils/PerformanceTestHelper';
import path from 'path';
import fs from 'fs';

describe('Query Performance Tests', () => {
  let dbManager: DatabaseManager;
  let kb: KnowledgeDB;
  let performanceHelper: PerformanceTestHelper;
  let testDbPath: string;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'performance-test.db');
  });

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    dbManager = await TestDatabaseFactory.createTestDatabaseManager({
      path: testDbPath,
      enableWAL: true,
      cacheSize: 100, // MB
      maxConnections: 10,
      queryCache: {
        enabled: true,
        maxSize: 1000,
        ttlMs: 300000, // 5 minutes
      },
    });

    kb = new KnowledgeDB(testDbPath);
  });

  afterEach(async () => {
    if (kb) {
      kb.close();
    }
    if (dbManager) {
      await dbManager.shutdown();
    }
  });

  afterAll(() => {
    performanceHelper.clearResults();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Basic Query Performance', () => {
    it('should execute simple queries efficiently', async () => {
      const result = await performanceHelper.measureOperation(
        'simple-select-query',
        () => dbManager.execute('SELECT 1 as test'),
        1000
      );

      expect(result.success).toBe(true);
      expect(result.metrics.operationsPerSecond).toBeGreaterThan(1000);
      expect(result.metrics.executionTime / 1000).toHaveExecutedWithin(0.5); // Per operation
    });

    it('should handle parameterized queries efficiently', async () => {
      await dbManager.execute(`
        CREATE TABLE perf_test (
          id INTEGER PRIMARY KEY,
          value TEXT,
          number INTEGER
        )
      `);

      // Insert test data
      const insertData = Array(1000)
        .fill(0)
        .map((_, i) => [`value_${i}`, i]);

      const insertResult = await performanceHelper.measureOperation(
        'parameterized-inserts',
        async () => {
          await dbManager.transaction(async () => {
            for (const [value, number] of insertData) {
              await dbManager.execute('INSERT INTO perf_test (value, number) VALUES (?, ?)', [
                value,
                number,
              ]);
            }
          });
        }
      );

      expect(insertResult.success).toBe(true);
      expect(insertResult.metrics.executionTime).toHaveExecutedWithin(2000);

      // Test parameterized selects
      const selectResult = await performanceHelper.measureOperation(
        'parameterized-selects',
        () =>
          dbManager.execute('SELECT * FROM perf_test WHERE number > ? AND number < ?', [250, 750]),
        100
      );

      expect(selectResult.success).toBe(true);
      expect(selectResult.metrics.operationsPerSecond).toBeGreaterThan(200);
    });

    it('should optimize JOIN queries', async () => {
      // Create related tables
      await dbManager.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);

      await dbManager.execute(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          title TEXT NOT NULL,
          content TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      // Add indexes for better JOIN performance
      await dbManager.execute('CREATE INDEX idx_posts_user_id ON posts(user_id)');

      // Insert test data
      const userInserts = Array(100)
        .fill(0)
        .map((_, i) => dbManager.execute('INSERT INTO users (name) VALUES (?)', [`user_${i}`]));
      await Promise.all(userInserts);

      const postInserts = Array(1000)
        .fill(0)
        .map((_, i) =>
          dbManager.execute('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [
            Math.floor(Math.random() * 100) + 1,
            `Post ${i}`,
            `Content for post ${i}`,
          ])
        );
      await Promise.all(postInserts);

      // Test JOIN performance
      const joinResult = await performanceHelper.measureOperation(
        'join-query-performance',
        () =>
          dbManager.execute(`
          SELECT u.name, COUNT(p.id) as post_count
          FROM users u
          LEFT JOIN posts p ON u.id = p.user_id
          GROUP BY u.id, u.name
          ORDER BY post_count DESC
          LIMIT 20
        `),
        50
      );

      expect(joinResult.success).toBe(true);
      expect(joinResult.metrics.operationsPerSecond).toBeGreaterThan(20);
    });

    it('should handle aggregation queries efficiently', async () => {
      // Setup test table with aggregation data
      await dbManager.execute(`
        CREATE TABLE sales (
          id INTEGER PRIMARY KEY,
          product_id INTEGER,
          category TEXT,
          amount DECIMAL(10,2),
          sale_date DATE
        )
      `);

      await dbManager.execute('CREATE INDEX idx_sales_category ON sales(category)');
      await dbManager.execute('CREATE INDEX idx_sales_date ON sales(sale_date)');

      // Insert test data
      const categories = ['Electronics', 'Books', 'Clothing', 'Food', 'Sports'];
      const salesData = Array(5000)
        .fill(0)
        .map((_, i) => [
          Math.floor(Math.random() * 1000) + 1, // product_id
          categories[Math.floor(Math.random() * categories.length)],
          Math.random() * 1000, // amount
          new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
            .toISOString()
            .split('T')[0],
        ]);

      await dbManager.transaction(async () => {
        for (const [product_id, category, amount, sale_date] of salesData) {
          await dbManager.execute(
            'INSERT INTO sales (product_id, category, amount, sale_date) VALUES (?, ?, ?, ?)',
            [product_id, category, amount, sale_date]
          );
        }
      });

      // Test aggregation performance
      const aggregationQueries = [
        'SELECT category, COUNT(*), SUM(amount), AVG(amount) FROM sales GROUP BY category',
        'SELECT strftime("%Y-%m", sale_date) as month, SUM(amount) FROM sales GROUP BY month ORDER BY month',
        'SELECT category, MAX(amount), MIN(amount) FROM sales WHERE amount > 500 GROUP BY category',
      ];

      const aggregationResults = await performanceHelper.compareImplementations(
        aggregationQueries.map((query, i) => ({
          name: `aggregation-query-${i + 1}`,
          fn: () => dbManager.execute(query),
        })),
        20
      );

      Object.values(aggregationResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(10);
      });
    });
  });

  describe('Knowledge Base Query Performance', () => {
    beforeEach(async () => {
      // Populate with varying sizes of test data
      const smallDataset = TestDatabaseFactory.createLargeTestDataset(500);
      for (const entry of smallDataset) {
        await kb.addEntry(entry, 'test-user');
      }
    });

    it('should perform full-text search efficiently', async () => {
      const searchQueries = [
        'error',
        'VSAM status',
        'data exception',
        'JCL dataset not found',
        'DB2 resource unavailable',
      ];

      const searchResults = await performanceHelper.compareImplementations(
        searchQueries.map(query => ({
          name: `search-${query.replace(/\s+/g, '-')}`,
          fn: () => kb.search(query),
        })),
        50
      );

      Object.values(searchResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(100);
      });
    });

    it('should scale search performance with dataset size', async () => {
      const sizes = [100, 500, 1000, 2000];
      const scalingResults: any[] = [];

      for (const targetSize of sizes) {
        const currentSize = await kb.getEntryCount();

        if (currentSize < targetSize) {
          const additionalEntries = TestDatabaseFactory.createLargeTestDataset(
            targetSize - currentSize
          );
          for (const entry of additionalEntries) {
            await kb.addEntry(entry, 'test-user');
          }
        }

        const searchResult = await performanceHelper.measureOperation(
          `search-scaling-${targetSize}`,
          () => kb.search('error system'),
          10
        );

        scalingResults.push({
          size: targetSize,
          avgTime: searchResult.metrics.executionTime,
          opsPerSec: searchResult.metrics.operationsPerSecond,
        });
      }

      // Performance degradation should be sub-linear with dataset growth
      const firstResult = scalingResults[0];
      const lastResult = scalingResults[scalingResults.length - 1];

      // Allow up to 4x time increase for 20x data increase
      expect(lastResult.avgTime).toBeLessThan(firstResult.avgTime * 4);

      // Operations per second should remain reasonably high
      expect(lastResult.opsPerSec).toBeGreaterThan(20);
    });

    it('should optimize category and tag filtering', async () => {
      const filterQueries = [
        () => kb.searchByCategory('VSAM'),
        () => kb.searchByCategory('JCL'),
        () => kb.searchByTag('error'),
        () => kb.searchByTag('abend'),
      ];

      const filterResults = await performanceHelper.compareImplementations(
        filterQueries.map((query, i) => ({
          name: `filter-query-${i + 1}`,
          fn: query,
        })),
        100
      );

      Object.values(filterResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(200);
      });
    });

    it('should handle complex search queries efficiently', async () => {
      const complexQueries = [
        () =>
          kb.search('VSAM error status', {
            limit: 10,
            includeUsageStats: true,
            sortBy: 'usage_count',
          }),
        () =>
          kb.search('data exception COBOL', {
            limit: 5,
            sortBy: 'success_rate',
            sortOrder: 'DESC',
          }),
        () =>
          kb.search('JCL dataset', {
            limit: 20,
            includeUsageStats: true,
          }),
      ];

      const complexResults = await performanceHelper.compareImplementations(
        complexQueries.map((query, i) => ({
          name: `complex-search-${i + 1}`,
          fn: query,
        })),
        30
      );

      Object.values(complexResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(50);
      });
    });
  });

  describe('Bulk Operation Performance', () => {
    it('should handle batch inserts efficiently', async () => {
      const batchSizes = [100, 500, 1000, 2000];
      const batchResults: any[] = [];

      for (const batchSize of batchSizes) {
        const entries = TestDatabaseFactory.createLargeTestDataset(batchSize);

        const batchResult = await performanceHelper.measureOperation(
          `batch-insert-${batchSize}`,
          async () => {
            await dbManager.transaction(async () => {
              for (const entry of entries) {
                await kb.addEntry(entry, 'test-user');
              }
            });
          }
        );

        batchResults.push({
          batchSize,
          totalTime: batchResult.metrics.executionTime,
          avgTimePerRecord: batchResult.metrics.executionTime / batchSize,
        });
      }

      // Average time per record should not increase dramatically with batch size
      const firstAvg = batchResults[0].avgTimePerRecord;
      const lastAvg = batchResults[batchResults.length - 1].avgTimePerRecord;

      expect(lastAvg).toBeLessThan(firstAvg * 2); // Allow up to 2x increase
    });

    it('should handle bulk updates efficiently', async () => {
      // Create test data
      const entries = TestDatabaseFactory.createLargeTestDataset(1000);
      const entryIds: string[] = [];

      for (const entry of entries) {
        const id = await kb.addEntry(entry, 'test-user');
        entryIds.push(id);
      }

      // Test bulk updates
      const updateResult = await performanceHelper.measureOperation('bulk-updates', async () => {
        await dbManager.transaction(async () => {
          for (let i = 0; i < entryIds.length; i += 10) {
            const id = entryIds[i];
            await kb.updateEntry(
              id,
              {
                ...entries[i],
                solution: `Updated solution ${i}`,
              },
              'test-user'
            );
          }
        });
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.metrics.executionTime).toHaveExecutedWithin(5000);
    });

    it('should handle bulk deletes efficiently', async () => {
      // Create test data
      const entries = TestDatabaseFactory.createLargeTestDataset(500);
      const entryIds: string[] = [];

      for (const entry of entries) {
        const id = await kb.addEntry(entry, 'test-user');
        entryIds.push(id);
      }

      // Test bulk deletes
      const deleteResult = await performanceHelper.measureOperation('bulk-deletes', async () => {
        await dbManager.transaction(async () => {
          for (let i = 0; i < entryIds.length; i += 2) {
            await kb.deleteEntry(entryIds[i]);
          }
        });
      });

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.metrics.executionTime).toHaveExecutedWithin(3000);

      // Verify correct number of entries remain
      const remainingCount = await kb.getEntryCount();
      expect(remainingCount).toBe(Math.ceil(entries.length / 2));
    });
  });

  describe('Index Effectiveness', () => {
    it('should benefit from proper indexing', async () => {
      // Create table without indexes
      await dbManager.execute(`
        CREATE TABLE perf_no_index (
          id INTEGER PRIMARY KEY,
          category TEXT,
          search_text TEXT,
          number_value INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create table with indexes
      await dbManager.execute(`
        CREATE TABLE perf_with_index (
          id INTEGER PRIMARY KEY,
          category TEXT,
          search_text TEXT,
          number_value INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbManager.execute('CREATE INDEX idx_category ON perf_with_index(category)');
      await dbManager.execute('CREATE INDEX idx_number_value ON perf_with_index(number_value)');
      await dbManager.execute('CREATE INDEX idx_created_at ON perf_with_index(created_at)');

      // Insert identical data into both tables
      const testData = Array(5000)
        .fill(0)
        .map((_, i) => [
          `category_${i % 10}`,
          `search text ${i}`,
          Math.floor(Math.random() * 1000),
        ]);

      // Insert data without transaction for realistic scenario
      for (const [category, search_text, number_value] of testData) {
        await dbManager.execute(
          'INSERT INTO perf_no_index (category, search_text, number_value) VALUES (?, ?, ?)',
          [category, search_text, number_value]
        );
        await dbManager.execute(
          'INSERT INTO perf_with_index (category, search_text, number_value) VALUES (?, ?, ?)',
          [category, search_text, number_value]
        );
      }

      // Compare query performance
      const queries = [
        'SELECT * FROM {} WHERE category = "category_5"',
        'SELECT * FROM {} WHERE number_value BETWEEN 100 AND 200',
        'SELECT COUNT(*) FROM {} GROUP BY category',
      ];

      for (const queryTemplate of queries) {
        const noIndexQuery = queryTemplate.replace('{}', 'perf_no_index');
        const withIndexQuery = queryTemplate.replace('{}', 'perf_with_index');

        const noIndexResult = await performanceHelper.measureOperation(
          'query-without-index',
          () => dbManager.execute(noIndexQuery),
          20
        );

        const withIndexResult = await performanceHelper.measureOperation(
          'query-with-index',
          () => dbManager.execute(withIndexQuery),
          20
        );

        expect(noIndexResult.success).toBe(true);
        expect(withIndexResult.success).toBe(true);

        // Indexed queries should be faster
        expect(withIndexResult.metrics.executionTime).toBeLessThan(
          noIndexResult.metrics.executionTime
        );
      }
    });

    it('should utilize composite indexes effectively', async () => {
      await dbManager.execute(`
        CREATE TABLE composite_test (
          id INTEGER PRIMARY KEY,
          status TEXT,
          category TEXT,
          priority INTEGER,
          created_at DATETIME
        )
      `);

      // Create composite index
      await dbManager.execute(
        'CREATE INDEX idx_status_category_priority ON composite_test(status, category, priority)'
      );

      // Insert test data
      const statuses = ['active', 'inactive', 'pending'];
      const categories = ['A', 'B', 'C', 'D', 'E'];
      const priorities = [1, 2, 3, 4, 5];

      const compositeData = Array(2000)
        .fill(0)
        .map(() => [
          statuses[Math.floor(Math.random() * statuses.length)],
          categories[Math.floor(Math.random() * categories.length)],
          priorities[Math.floor(Math.random() * priorities.length)],
          new Date().toISOString(),
        ]);

      await dbManager.transaction(async () => {
        for (const [status, category, priority, created_at] of compositeData) {
          await dbManager.execute(
            'INSERT INTO composite_test (status, category, priority, created_at) VALUES (?, ?, ?, ?)',
            [status, category, priority, created_at]
          );
        }
      });

      // Test queries that should benefit from composite index
      const compositeQueries = [
        'SELECT * FROM composite_test WHERE status = "active"',
        'SELECT * FROM composite_test WHERE status = "active" AND category = "A"',
        'SELECT * FROM composite_test WHERE status = "active" AND category = "A" AND priority = 1',
        'SELECT COUNT(*) FROM composite_test WHERE status = "active" GROUP BY category',
      ];

      const compositeResults = await performanceHelper.compareImplementations(
        compositeQueries.map((query, i) => ({
          name: `composite-index-query-${i + 1}`,
          fn: () => dbManager.execute(query),
        })),
        50
      );

      Object.values(compositeResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(50);
      });
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache hit performance improvements', async () => {
      // Create test data
      const entries = TestDatabaseFactory.createTestKBEntries();
      for (const entry of entries) {
        await kb.addEntry(entry, 'test-user');
      }

      const query = 'VSAM status error';

      // First query (cache miss)
      const missResult = await performanceHelper.measureOperation(
        'cache-miss-query',
        () => kb.search(query),
        10
      );

      // Subsequent queries (cache hits)
      const hitResult = await performanceHelper.measureOperation(
        'cache-hit-query',
        () => kb.search(query),
        100
      );

      expect(missResult.success).toBe(true);
      expect(hitResult.success).toBe(true);

      // Cache hits should be significantly faster
      expect(hitResult.metrics.operationsPerSecond).toBeGreaterThan(
        missResult.metrics.operationsPerSecond! * 2
      );
    });

    it('should handle cache eviction gracefully', async () => {
      // Fill cache beyond capacity
      const manyQueries = Array(1500)
        .fill(0)
        .map((_, i) => `query ${i} unique search`);

      // Execute queries to fill cache
      for (let i = 0; i < manyQueries.length; i += 100) {
        const batchQueries = manyQueries.slice(i, i + 100);
        await Promise.all(batchQueries.map(query => kb.search(query)));
      }

      // Test that recent queries are still cached
      const recentQuery = manyQueries[manyQueries.length - 1];
      const recentResult = await performanceHelper.measureOperation(
        'recent-cached-query',
        () => kb.search(recentQuery),
        50
      );

      expect(recentResult.success).toBe(true);
      expect(recentResult.metrics.operationsPerSecond).toBeGreaterThan(100);
    });

    it('should maintain performance under cache pressure', async () => {
      // Create mixed workload with repeated and unique queries
      const repeatedQueries = ['error', 'VSAM', 'JCL', 'DB2', 'abend'];
      const uniqueQueries = Array(500)
        .fill(0)
        .map((_, i) => `unique query ${i}`);

      const mixedWorkload = Array(1000)
        .fill(0)
        .map(() => {
          return Math.random() < 0.3
            ? repeatedQueries[Math.floor(Math.random() * repeatedQueries.length)]
            : uniqueQueries[Math.floor(Math.random() * uniqueQueries.length)];
        });

      const workloadResult = await performanceHelper.measureOperation(
        'mixed-cache-workload',
        async () => {
          for (const query of mixedWorkload) {
            await kb.search(query);
          }
        }
      );

      expect(workloadResult.success).toBe(true);
      expect(workloadResult.metrics.executionTime).toHaveExecutedWithin(10000);
    });
  });

  describe('Connection Pool Performance', () => {
    it('should handle concurrent queries efficiently', async () => {
      // Create test data
      await dbManager.execute(`
        CREATE TABLE concurrent_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `);

      const testData = Array(1000)
        .fill(0)
        .map((_, i) => `data_${i}`);
      await dbManager.transaction(async () => {
        for (const data of testData) {
          await dbManager.execute('INSERT INTO concurrent_test (data) VALUES (?)', [data]);
        }
      });

      // Test concurrent read operations
      const concurrentReads = Array(50)
        .fill(0)
        .map(
          () => () => dbManager.execute('SELECT * FROM concurrent_test ORDER BY RANDOM() LIMIT 10')
        );

      const concurrentResult = await performanceHelper.runLoadTest({
        concurrentUsers: 10,
        duration: 5,
        rampUpTime: 1,
        operations: concurrentReads,
      });

      const successRate = concurrentResult.filter(r => r.success).length / concurrentResult.length;
      expect(successRate).toBeGreaterThan(0.95);

      // Average response time should be reasonable
      const avgTime =
        concurrentResult
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.metrics.executionTime, 0) /
        concurrentResult.filter(r => r.success).length;

      expect(avgTime).toHaveExecutedWithin(100);
    });

    it('should scale with connection pool size', async () => {
      // This test would compare different pool sizes
      // For now, verify that current pool configuration handles load
      const poolStressTest = Array(20)
        .fill(0)
        .map(() => () => dbManager.execute('SELECT COUNT(*) FROM sqlite_master'));

      const poolResult = await performanceHelper.runLoadTest({
        concurrentUsers: 15,
        duration: 3,
        rampUpTime: 1,
        operations: poolStressTest,
      });

      const successRate = poolResult.filter(r => r.success).length / poolResult.length;
      expect(successRate).toBeGreaterThan(0.9);

      // Verify pool health after stress test
      const health = await dbManager.getHealth();
      expect(health.status).toMatch(/healthy|degraded/);
      expect(health.connections.active).toBeLessThanOrEqual(health.connections.maxConnections);
    });
  });
});
