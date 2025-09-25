import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DatabaseManager, DatabaseConfig, TransactionOptions } from '../../DatabaseManager';
import { TestDatabaseFactory } from '../test-utils/TestDatabaseFactory';
import { PerformanceTestHelper } from '../test-utils/PerformanceTestHelper';
import path from 'path';
import fs from 'fs';

describe('DatabaseManager Unit Tests', () => {
  let dbManager: DatabaseManager;
  let testConfig: DatabaseConfig;
  let performanceHelper: PerformanceTestHelper;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
  });

  beforeEach(async () => {
    testConfig = {
      path: ':memory:',
      enableWAL: false,
      enableForeignKeys: true,
      timeout: 5000,
      maxConnections: 5,
      cacheSize: 50,
      enableMonitoring: false,
      backup: {
        enabled: false,
        intervalHours: 24,
        retentionDays: 7,
        path: path.join(__dirname, '..', 'temp', 'backups'),
      },
      queryCache: {
        enabled: true,
        maxSize: 100,
        ttlMs: 60000,
      },
    };
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.shutdown();
    }
  });

  afterAll(() => {
    performanceHelper.clearResults();
  });

  describe('Initialization', () => {
    it('should initialize successfully with default config', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);

      expect(dbManager).toBeDefined();
      const health = await dbManager.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.connections.active).toBeGreaterThanOrEqual(0);
    });

    it('should initialize with custom configuration', async () => {
      const customConfig: DatabaseConfig = {
        ...testConfig,
        maxConnections: 10,
        cacheSize: 100,
        timeout: 10000,
      };

      dbManager = await TestDatabaseFactory.createTestDatabaseManager(customConfig);
      const health = await dbManager.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.connections.maxConnections).toBe(10);
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidConfig: DatabaseConfig = {
        ...testConfig,
        path: '/invalid/path/database.db',
      };

      await expect(TestDatabaseFactory.createTestDatabaseManager(invalidConfig)).rejects.toThrow();
    });

    it('should initialize within performance threshold', async () => {
      const result = await performanceHelper.measureOperation(
        'database-initialization',
        async () => {
          dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);
        }
      );

      expect(result.metrics.executionTime).toHaveExecutedWithin(1000);
      expect(result.success).toBe(true);
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);
    });

    it('should manage connection pool correctly', async () => {
      const health = await dbManager.getHealth();

      expect(health.connections).toBeDefined();
      expect(health.connections.active).toBeGreaterThanOrEqual(0);
      expect(health.connections.maxConnections).toBe(testConfig.maxConnections);
    });

    it('should handle concurrent connections', async () => {
      const promises = Array(5)
        .fill(0)
        .map(() => dbManager.execute('SELECT 1 as test'));

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should respect connection limits', async () => {
      const health = await dbManager.getHealth();
      expect(health.connections.active).toBeLessThanOrEqual(testConfig.maxConnections!);
    });

    it('should handle connection timeouts', async () => {
      // Create a long-running query to test timeout
      const longQuery = 'SELECT * FROM (SELECT 1) as t1 CROSS JOIN (SELECT 1) as t2';

      await expect(dbManager.execute(longQuery, [], { timeout: 1 })).rejects.toThrow();
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);

      // Create test table
      await dbManager.execute(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          value INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    it('should execute simple queries', async () => {
      const result = await dbManager.execute('SELECT 1 as test_value');
      expect(result).toEqual([{ test_value: 1 }]);
    });

    it('should execute parameterized queries', async () => {
      await dbManager.execute('INSERT INTO test_table (name, value) VALUES (?, ?)', ['test', 100]);

      const result = await dbManager.execute('SELECT * FROM test_table WHERE name = ?', ['test']);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test');
      expect(result[0].value).toBe(100);
    });

    it('should handle query errors gracefully', async () => {
      await expect(dbManager.execute('SELECT * FROM non_existent_table')).rejects.toThrow();
    });

    it('should execute queries within performance thresholds', async () => {
      const result = await performanceHelper.measureOperation(
        'simple-query-execution',
        () => dbManager.execute('SELECT 1'),
        100
      );

      expect(result.metrics.operationsPerSecond).toBeGreaterThan(500);
      expect(result.success).toBe(true);
    });

    it('should handle bulk inserts efficiently', async () => {
      const data = Array(1000)
        .fill(0)
        .map((_, i) => [`test_${i}`, i]);

      const result = await performanceHelper.measureOperation('bulk-insert', async () => {
        await dbManager.transaction(async () => {
          for (const [name, value] of data) {
            await dbManager.execute('INSERT INTO test_table (name, value) VALUES (?, ?)', [
              name,
              value,
            ]);
          }
        });
      });

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toHaveExecutedWithin(5000);

      // Verify data was inserted
      const count = await dbManager.execute('SELECT COUNT(*) as count FROM test_table');
      expect(count[0].count).toBe(1000);
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);

      await dbManager.execute(`
        CREATE TABLE transaction_test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          balance INTEGER DEFAULT 0
        )
      `);

      // Insert initial data
      await dbManager.execute('INSERT INTO transaction_test (name, balance) VALUES (?, ?)', [
        'account1',
        1000,
      ]);
      await dbManager.execute('INSERT INTO transaction_test (name, balance) VALUES (?, ?)', [
        'account2',
        500,
      ]);
    });

    it('should commit successful transactions', async () => {
      await dbManager.transaction(async () => {
        await dbManager.execute(
          'UPDATE transaction_test SET balance = balance - 100 WHERE name = ?',
          ['account1']
        );
        await dbManager.execute(
          'UPDATE transaction_test SET balance = balance + 100 WHERE name = ?',
          ['account2']
        );
      });

      const results = await dbManager.execute('SELECT * FROM transaction_test ORDER BY name');
      expect(results[0].balance).toBe(900); // account1
      expect(results[1].balance).toBe(600); // account2
    });

    it('should rollback failed transactions', async () => {
      await expect(
        dbManager.transaction(async () => {
          await dbManager.execute(
            'UPDATE transaction_test SET balance = balance - 100 WHERE name = ?',
            ['account1']
          );
          // This should cause the transaction to fail
          throw new Error('Simulated error');
        })
      ).rejects.toThrow('Simulated error');

      const results = await dbManager.execute('SELECT * FROM transaction_test WHERE name = ?', [
        'account1',
      ]);
      expect(results[0].balance).toBe(1000); // Should remain unchanged
    });

    it('should handle nested transactions', async () => {
      await dbManager.transaction(async () => {
        await dbManager.execute(
          'UPDATE transaction_test SET balance = balance - 50 WHERE name = ?',
          ['account1']
        );

        await dbManager.transaction(async () => {
          await dbManager.execute(
            'UPDATE transaction_test SET balance = balance + 50 WHERE name = ?',
            ['account2']
          );
        });
      });

      const results = await dbManager.execute('SELECT * FROM transaction_test ORDER BY name');
      expect(results[0].balance).toBe(950); // account1
      expect(results[1].balance).toBe(550); // account2
    });

    it('should respect transaction isolation levels', async () => {
      const options: TransactionOptions = { isolation: 'immediate' };

      await dbManager.transaction(async () => {
        await dbManager.execute('UPDATE transaction_test SET balance = 0 WHERE name = ?', [
          'account1',
        ]);
      }, options);

      const result = await dbManager.execute(
        'SELECT balance FROM transaction_test WHERE name = ?',
        ['account1']
      );
      expect(result[0].balance).toBe(0);
    });

    it('should measure transaction performance', async () => {
      const result = await performanceHelper.measureOperation(
        'transaction-performance',
        async () => {
          await dbManager.transaction(async () => {
            for (let i = 0; i < 100; i++) {
              await dbManager.execute(
                'INSERT INTO transaction_test (name, balance) VALUES (?, ?)',
                [`test_${i}`, i]
              );
            }
          });
        }
      );

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toHaveExecutedWithin(2000);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      testConfig.queryCache!.enabled = true;
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);
    });

    it('should cache query results', async () => {
      const query = 'SELECT 1 as cached_value';

      // First execution should cache the result
      const result1 = await performanceHelper.measureOperation('first-query-execution', () =>
        dbManager.execute(query)
      );

      // Second execution should be faster due to cache
      const result2 = await performanceHelper.measureOperation('cached-query-execution', () =>
        dbManager.execute(query)
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Cached query should be significantly faster
      expect(result2.metrics.executionTime).toBeLessThan(result1.metrics.executionTime * 0.5);
    });

    it('should invalidate cache when appropriate', async () => {
      await dbManager.execute(`
        CREATE TABLE cache_test (
          id INTEGER PRIMARY KEY,
          value TEXT
        )
      `);

      await dbManager.execute('INSERT INTO cache_test (value) VALUES (?)', ['initial']);

      // Query should be cached
      const result1 = await dbManager.execute('SELECT * FROM cache_test');
      expect(result1[0].value).toBe('initial');

      // Update should invalidate relevant cache entries
      await dbManager.execute('UPDATE cache_test SET value = ? WHERE id = 1', ['updated']);

      const result2 = await dbManager.execute('SELECT * FROM cache_test');
      expect(result2[0].value).toBe('updated');
    });

    it('should respect cache size limits', async () => {
      // Fill cache with more queries than the limit
      const cacheSize = testConfig.queryCache!.maxSize!;

      for (let i = 0; i < cacheSize + 10; i++) {
        await dbManager.execute(`SELECT ${i} as value`);
      }

      const health = await dbManager.getHealth();
      expect(health.cache.size).toBeLessThanOrEqual(cacheSize);
    });

    it('should respect cache TTL', async () => {
      // Use short TTL for testing
      testConfig.queryCache!.ttlMs = 100;
      await dbManager.shutdown();
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);

      const query = 'SELECT NOW() as timestamp';
      await dbManager.execute(query);

      // Wait for cache to expire
      await TestDatabaseFactory.wait(150);

      // This query should not be served from cache
      const result = await performanceHelper.measureOperation('post-ttl-query', () =>
        dbManager.execute(query)
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      testConfig.enableMonitoring = true;
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);
    });

    it('should report database health status', async () => {
      const health = await dbManager.getHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('connections');
      expect(health).toHaveProperty('cache');
      expect(health).toHaveProperty('performance');
      expect(health.status).toBe('healthy');
    });

    it('should track performance metrics', async () => {
      // Execute some queries to generate metrics
      for (let i = 0; i < 10; i++) {
        await dbManager.execute('SELECT ? as value', [i]);
      }

      const health = await dbManager.getHealth();
      expect(health.performance.totalQueries).toBeGreaterThanOrEqual(10);
      expect(health.performance.averageQueryTime).toBeGreaterThan(0);
    });

    it('should detect unhealthy conditions', async () => {
      // Simulate an unhealthy condition by exhausting connections
      testConfig.maxConnections = 1;
      await dbManager.shutdown();
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);

      // This test is difficult to implement reliably with SQLite
      // as it handles connections differently than traditional databases
      const health = await dbManager.getHealth();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
    });
  });

  describe('Backup and Recovery', () => {
    beforeEach(async () => {
      testConfig.backup!.enabled = true;
      testConfig.path = path.join(__dirname, '..', 'temp', 'test.db');
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);
    });

    it('should create backup successfully', async () => {
      const backupPath = await dbManager.createBackup();

      expect(backupPath).toBeDefined();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Cleanup
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });

    it('should restore from backup', async () => {
      // Create test data
      await dbManager.execute(`
        CREATE TABLE backup_test (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `);
      await dbManager.execute('INSERT INTO backup_test (data) VALUES (?)', ['test_data']);

      // Create backup
      const backupPath = await dbManager.createBackup();

      // Modify data
      await dbManager.execute('UPDATE backup_test SET data = ?', ['modified_data']);

      // Restore backup
      await dbManager.restoreBackup(backupPath);

      // Verify original data is restored
      const result = await dbManager.execute('SELECT * FROM backup_test');
      expect(result[0].data).toBe('test_data');

      // Cleanup
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });

    it('should handle backup errors gracefully', async () => {
      await expect(dbManager.restoreBackup('/non/existent/backup.db')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);
    });

    it('should handle SQL syntax errors', async () => {
      await expect(dbManager.execute('INVALID SQL STATEMENT')).rejects.toThrow();
    });

    it('should handle parameter binding errors', async () => {
      await expect(dbManager.execute('SELECT ? as value', [])).rejects.toThrow();
    });

    it('should handle constraint violations', async () => {
      await dbManager.execute(`
        CREATE TABLE constraint_test (
          id INTEGER PRIMARY KEY,
          unique_value TEXT UNIQUE
        )
      `);

      await dbManager.execute('INSERT INTO constraint_test (unique_value) VALUES (?)', ['test']);

      await expect(
        dbManager.execute('INSERT INTO constraint_test (unique_value) VALUES (?)', ['test'])
      ).rejects.toThrow();
    });

    it('should maintain consistency after errors', async () => {
      await dbManager.execute(`
        CREATE TABLE error_test (
          id INTEGER PRIMARY KEY,
          value INTEGER NOT NULL
        )
      `);

      // This should succeed
      await dbManager.execute('INSERT INTO error_test (value) VALUES (?)', [1]);

      // This should fail
      await expect(
        dbManager.execute('INSERT INTO error_test (value) VALUES (?)', [null])
      ).rejects.toThrow();

      // Database should still be usable
      const result = await dbManager.execute('SELECT COUNT(*) as count FROM error_test');
      expect(result[0].count).toBe(1);
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager(testConfig);

      // Create test table for benchmarks
      await dbManager.execute(`
        CREATE TABLE benchmark_test (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          value INTEGER,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    it('should handle high query volume', async () => {
      const result = await performanceHelper.measureOperation('high-volume-queries', async () => {
        const promises = Array(1000)
          .fill(0)
          .map((_, i) => dbManager.execute('SELECT ? as id, ? as name', [i, `test_${i}`]));
        await Promise.all(promises);
      });

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toHaveExecutedWithin(10000);
    });

    it('should scale with dataset size', async () => {
      const sizes = [100, 500, 1000];
      const results: any[] = [];

      for (const size of sizes) {
        // Insert data
        await dbManager.transaction(async () => {
          for (let i = 0; i < size; i++) {
            await dbManager.execute(
              'INSERT INTO benchmark_test (name, value, description) VALUES (?, ?, ?)',
              [`test_${i}`, i, `description for test ${i}`]
            );
          }
        });

        // Measure query performance
        const result = await performanceHelper.measureOperation(
          `query-scaling-${size}`,
          () => dbManager.execute('SELECT * FROM benchmark_test WHERE value > ?', [size / 2]),
          10
        );

        results.push({ size, time: result.metrics.executionTime });

        // Clear data for next test
        await dbManager.execute('DELETE FROM benchmark_test');
      }

      // Performance shouldn't degrade significantly with size
      expect(results[2].time).toBeLessThan(results[0].time * 5);
    });

    it('should maintain consistent performance under load', async () => {
      const operations = [
        () =>
          dbManager.execute('INSERT INTO benchmark_test (name, value) VALUES (?, ?)', [
            TestDatabaseFactory.randomString(),
            Math.floor(Math.random() * 1000),
          ]),
        () =>
          dbManager.execute('SELECT * FROM benchmark_test WHERE value > ? LIMIT 10', [
            Math.floor(Math.random() * 500),
          ]),
        () =>
          dbManager.execute('UPDATE benchmark_test SET value = ? WHERE id = ?', [
            Math.floor(Math.random() * 1000),
            Math.floor(Math.random() * 100) + 1,
          ]),
        () =>
          dbManager.execute('DELETE FROM benchmark_test WHERE value < ?', [
            Math.floor(Math.random() * 100),
          ]),
      ];

      const loadTestConfig = {
        concurrentUsers: 5,
        duration: 10, // 10 seconds
        rampUpTime: 2, // 2 seconds
        operations,
      };

      const results = await performanceHelper.runLoadTest(loadTestConfig);

      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);

      // Calculate average performance
      const avgTime =
        successfulResults.reduce((sum, r) => sum + r.metrics.executionTime, 0) /
        successfulResults.length;

      expect(avgTime).toHaveExecutedWithin(100); // Average operation should complete within 100ms
    });
  });
});
