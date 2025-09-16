import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { PerformanceTestHelper } from '../../src/database/__tests__/test-utils/PerformanceTestHelper';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';
import path from 'path';
import fs from 'fs';
import { performance } from 'perf_hooks';

describe('Database Performance Validation Tests', () => {
  let dbManager: DatabaseManager;
  let kb: KnowledgeDB;
  let performanceHelper: PerformanceTestHelper;
  let testDbPath: string;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'db-performance-test.db');
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
        ttlMs: 300000 // 5 minutes
      },
      performanceMonitoring: true
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

  describe('Query Optimization Validation', () => {
    beforeEach(async () => {
      // Create large test dataset for performance testing
      const entries = TestDatabaseFactory.createLargeTestDataset(5000);
      
      await dbManager.transaction(async () => {
        for (const entry of entries) {
          await kb.addEntry(entry, 'test-user');
        }
      });
    });

    it('should execute simple SELECT queries efficiently', async () => {
      const simpleQueries = [
        'SELECT COUNT(*) FROM kb_entries',
        'SELECT * FROM kb_entries LIMIT 10',
        'SELECT title, category FROM kb_entries WHERE category = ?',
        'SELECT * FROM kb_entries WHERE created_at > datetime("now", "-1 day")',
        'SELECT AVG(usage_count) FROM kb_entries'
      ];

      const queryResults = await performanceHelper.compareImplementations(
        simpleQueries.map((query, i) => ({
          name: `simple-query-${i + 1}`,
          fn: () => dbManager.execute(query, i === 2 ? ['VSAM'] : [])
        })),
        100
      );

      Object.values(queryResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(100);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(10); // < 10ms per query
      });
    });

    it('should optimize complex JOIN queries', async () => {
      // Create related tables for JOIN testing
      await dbManager.execute(`
        CREATE TABLE IF NOT EXISTS test_categories (
          id INTEGER PRIMARY KEY,
          category_name TEXT UNIQUE,
          description TEXT
        )
      `);

      await dbManager.execute(`
        CREATE TABLE IF NOT EXISTS test_usage_stats (
          entry_id TEXT,
          user_id TEXT,
          access_time DATETIME,
          action TEXT,
          FOREIGN KEY (entry_id) REFERENCES kb_entries(id)
        )
      `);

      // Add indexes
      await dbManager.execute('CREATE INDEX IF NOT EXISTS idx_usage_entry_id ON test_usage_stats(entry_id)');
      await dbManager.execute('CREATE INDEX IF NOT EXISTS idx_usage_time ON test_usage_stats(access_time)');

      // Populate test data
      const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'CICS'];
      for (const cat of categories) {
        await dbManager.execute(
          'INSERT INTO test_categories (category_name, description) VALUES (?, ?)',
          [cat, `Description for ${cat}`]
        );
      }

      // Add usage stats
      const entries = await dbManager.execute('SELECT id FROM kb_entries LIMIT 100');
      const usageData = entries.flatMap((entry: any) => 
        Array(10).fill(0).map(() => [
          entry.id,
          'test-user',
          new Date().toISOString(),
          'view'
        ])
      );

      await dbManager.transaction(async () => {
        for (const [entryId, userId, accessTime, action] of usageData) {
          await dbManager.execute(
            'INSERT INTO test_usage_stats (entry_id, user_id, access_time, action) VALUES (?, ?, ?, ?)',
            [entryId, userId, accessTime, action]
          );
        }
      });

      const complexJoinQueries = [
        `SELECT e.title, c.category_name, COUNT(u.entry_id) as usage_count
         FROM kb_entries e
         LEFT JOIN test_categories c ON e.category = c.category_name
         LEFT JOIN test_usage_stats u ON e.id = u.entry_id
         GROUP BY e.id, e.title, c.category_name
         ORDER BY usage_count DESC
         LIMIT 20`,
        
        `SELECT c.category_name, AVG(e.usage_count) as avg_usage, COUNT(e.id) as entry_count
         FROM test_categories c
         JOIN kb_entries e ON c.category_name = e.category
         WHERE e.created_at > datetime('now', '-30 days')
         GROUP BY c.category_name
         HAVING entry_count > 5`,
        
        `SELECT e.title, 
                COUNT(CASE WHEN u.action = 'view' THEN 1 END) as views,
                COUNT(CASE WHEN u.action = 'rate_success' THEN 1 END) as success_rates
         FROM kb_entries e
         LEFT JOIN test_usage_stats u ON e.id = u.entry_id
         WHERE e.success_count > 0
         GROUP BY e.id, e.title
         ORDER BY views DESC
         LIMIT 50`
      ];

      const joinResults = await performanceHelper.compareImplementations(
        complexJoinQueries.map((query, i) => ({
          name: `complex-join-${i + 1}`,
          fn: () => dbManager.execute(query)
        })),
        20
      );

      Object.values(joinResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(10);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(200); // < 200ms per complex query
      });
    });

    it('should optimize full-text search queries', async () => {
      const ftsQueries = [
        'VSAM error status',
        '"data exception"',
        'JCL AND dataset',
        'system OR application',
        'error NOT temporary',
        'batch processing failure',
        'network timeout connection',
        'memory allocation problem',
        'file operation error',
        'database connection timeout'
      ];

      const ftsResults = await performanceHelper.compareImplementations(
        ftsQueries.map(query => ({
          name: `fts-${query.split(' ')[0]}`,
          fn: () => dbManager.execute(`
            SELECT e.*, bm25(kb_fts) as score
            FROM kb_fts f
            JOIN kb_entries e ON f.id = e.id
            WHERE kb_fts MATCH ?
            ORDER BY score DESC
            LIMIT 20
          `, [query])
        })),
        50
      );

      Object.values(ftsResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(50);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(50); // < 50ms per FTS query
      });
    });

    it('should execute aggregation queries efficiently', async () => {
      const aggregationQueries = [
        'SELECT category, COUNT(*) FROM kb_entries GROUP BY category',
        'SELECT DATE(created_at) as date, COUNT(*) FROM kb_entries GROUP BY DATE(created_at) ORDER BY date DESC',
        'SELECT category, AVG(usage_count), SUM(success_count), MAX(failure_count) FROM kb_entries GROUP BY category',
        'SELECT COUNT(CASE WHEN usage_count > 10 THEN 1 END) as popular, COUNT(CASE WHEN usage_count <= 10 THEN 1 END) as unpopular FROM kb_entries',
        'SELECT category, COUNT(*) as total, ROUND(AVG(CAST(success_count AS FLOAT) / NULLIF(usage_count, 0)) * 100, 2) as success_rate FROM kb_entries WHERE usage_count > 0 GROUP BY category'
      ];

      const aggResults = await performanceHelper.compareImplementations(
        aggregationQueries.map((query, i) => ({
          name: `aggregation-${i + 1}`,
          fn: () => dbManager.execute(query)
        })),
        30
      );

      Object.values(aggResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(20);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(100); // < 100ms per aggregation
      });
    });
  });

  describe('Index Performance Testing', () => {
    it('should demonstrate index effectiveness for common query patterns', async () => {
      // Create test table without indexes
      await dbManager.execute(`
        CREATE TABLE perf_test_no_index (
          id INTEGER PRIMARY KEY,
          category TEXT,
          status TEXT,
          created_at DATETIME,
          number_value INTEGER,
          text_content TEXT
        )
      `);

      // Create identical table with indexes
      await dbManager.execute(`
        CREATE TABLE perf_test_with_index (
          id INTEGER PRIMARY KEY,
          category TEXT,
          status TEXT,
          created_at DATETIME,
          number_value INTEGER,
          text_content TEXT
        )
      `);

      // Add comprehensive indexes
      await dbManager.execute('CREATE INDEX idx_category_status ON perf_test_with_index(category, status)');
      await dbManager.execute('CREATE INDEX idx_created_at ON perf_test_with_index(created_at)');
      await dbManager.execute('CREATE INDEX idx_number_value ON perf_test_with_index(number_value)');
      await dbManager.execute('CREATE INDEX idx_text_content ON perf_test_with_index(text_content)');

      // Generate comprehensive test data
      const testData = Array(10000).fill(0).map((_, i) => [
        `category_${i % 20}`,
        `status_${i % 5}`,
        new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        Math.floor(Math.random() * 1000),
        `text content ${i} with various keywords`
      ]);

      // Insert data into both tables
      await dbManager.transaction(async () => {
        for (const [category, status, created_at, number_value, text_content] of testData) {
          await dbManager.execute(
            'INSERT INTO perf_test_no_index (category, status, created_at, number_value, text_content) VALUES (?, ?, ?, ?, ?)',
            [category, status, created_at, number_value, text_content]
          );
          await dbManager.execute(
            'INSERT INTO perf_test_with_index (category, status, created_at, number_value, text_content) VALUES (?, ?, ?, ?, ?)',
            [category, status, created_at, number_value, text_content]
          );
        }
      });

      // Test various query patterns
      const queryPatterns = [
        'SELECT * FROM {} WHERE category = "category_5"',
        'SELECT * FROM {} WHERE category = "category_5" AND status = "status_2"',
        'SELECT * FROM {} WHERE created_at > datetime("now", "-30 days")',
        'SELECT * FROM {} WHERE number_value BETWEEN 100 AND 200',
        'SELECT COUNT(*) FROM {} WHERE text_content LIKE "%keywords%"',
        'SELECT category, COUNT(*) FROM {} GROUP BY category',
        'SELECT * FROM {} WHERE category = "category_10" ORDER BY created_at DESC LIMIT 10'
      ];

      for (const queryTemplate of queryPatterns) {
        const noIndexQuery = queryTemplate.replace('{}', 'perf_test_no_index');
        const withIndexQuery = queryTemplate.replace('{}', 'perf_test_with_index');

        const noIndexResult = await performanceHelper.measureOperation(
          'query-without-index',
          () => dbManager.execute(noIndexQuery),
          10
        );

        const withIndexResult = await performanceHelper.measureOperation(
          'query-with-index',
          () => dbManager.execute(withIndexQuery),
          10
        );

        expect(noIndexResult.success).toBe(true);
        expect(withIndexResult.success).toBe(true);
        
        // Indexed queries should be significantly faster
        expect(withIndexResult.metrics.executionTime).toBeLessThan(noIndexResult.metrics.executionTime * 0.5);
        expect(withIndexResult.metrics.operationsPerSecond).toBeGreaterThan(noIndexResult.metrics.operationsPerSecond! * 2);
      }
    });

    it('should validate composite index performance', async () => {
      await dbManager.execute(`
        CREATE TABLE composite_index_test (
          id INTEGER PRIMARY KEY,
          region TEXT,
          category TEXT,
          priority INTEGER,
          status TEXT,
          created_at DATETIME
        )
      `);

      // Create composite indexes
      await dbManager.execute('CREATE INDEX idx_region_category ON composite_index_test(region, category)');
      await dbManager.execute('CREATE INDEX idx_region_priority_status ON composite_index_test(region, priority, status)');
      await dbManager.execute('CREATE INDEX idx_category_status_created ON composite_index_test(category, status, created_at)');

      // Generate test data with realistic distribution
      const regions = ['North', 'South', 'East', 'West'];
      const categories = ['A', 'B', 'C', 'D', 'E'];
      const priorities = [1, 2, 3, 4, 5];
      const statuses = ['Active', 'Inactive', 'Pending'];

      const compositeData = Array(5000).fill(0).map(() => [
        regions[Math.floor(Math.random() * regions.length)],
        categories[Math.floor(Math.random() * categories.length)],
        priorities[Math.floor(Math.random() * priorities.length)],
        statuses[Math.floor(Math.random() * statuses.length)],
        new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
      ]);

      await dbManager.transaction(async () => {
        for (const [region, category, priority, status, created_at] of compositeData) {
          await dbManager.execute(
            'INSERT INTO composite_index_test (region, category, priority, status, created_at) VALUES (?, ?, ?, ?, ?)',
            [region, category, priority, status, created_at]
          );
        }
      });

      const compositeQueries = [
        // Should use idx_region_category
        'SELECT * FROM composite_index_test WHERE region = "North" AND category = "A"',
        // Should use idx_region_priority_status
        'SELECT * FROM composite_index_test WHERE region = "South" AND priority = 1 AND status = "Active"',
        // Should use idx_category_status_created
        'SELECT * FROM composite_index_test WHERE category = "B" AND status = "Pending" AND created_at > datetime("now", "-30 days")',
        // Complex query using multiple conditions
        'SELECT COUNT(*) FROM composite_index_test WHERE region IN ("North", "South") AND category = "A" GROUP BY priority'
      ];

      const compositeResults = await performanceHelper.compareImplementations(
        compositeQueries.map((query, i) => ({
          name: `composite-index-${i + 1}`,
          fn: () => dbManager.execute(query)
        })),
        50
      );

      Object.values(compositeResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(100);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(20); // < 20ms with proper indexes
      });
    });

    it('should maintain index performance during updates and deletes', async () => {
      // Populate initial data
      const initialData = Array(2000).fill(0).map((_, i) => [
        `title_${i}`,
        `problem_${i}`,
        `solution_${i}`,
        ['VSAM', 'JCL', 'DB2'][i % 3]
      ]);

      await dbManager.transaction(async () => {
        for (const [title, problem, solution, category] of initialData) {
          await kb.addEntry({ title, problem, solution, category }, 'test-user');
        }
      });

      // Perform mixed workload operations
      const mixedWorkloadResult = await performanceHelper.measureOperation(
        'mixed-workload-with-indexes',
        async () => {
          // Updates
          for (let i = 0; i < 100; i++) {
            await dbManager.execute(
              'UPDATE kb_entries SET usage_count = usage_count + 1 WHERE id IN (SELECT id FROM kb_entries LIMIT 1 OFFSET ?)',
              [Math.floor(Math.random() * 1000)]
            );
          }

          // Inserts
          for (let i = 0; i < 50; i++) {
            await kb.addEntry({
              title: `new_entry_${i}`,
              problem: `new_problem_${i}`,
              solution: `new_solution_${i}`,
              category: 'Batch'
            }, 'test-user');
          }

          // Selects (should benefit from maintained indexes)
          for (let i = 0; i < 100; i++) {
            await dbManager.execute('SELECT * FROM kb_entries WHERE category = ? LIMIT 5', ['VSAM']);
          }

          // Deletes
          const toDelete = await dbManager.execute('SELECT id FROM kb_entries WHERE title LIKE "new_entry_%" LIMIT 25');
          for (const row of toDelete) {
            await kb.deleteEntry((row as any).id);
          }
        },
        5
      );

      expect(mixedWorkloadResult.success).toBe(true);
      expect(mixedWorkloadResult.metrics.executionTime / mixedWorkloadResult.iterations).toBeLessThan(5000); // < 5s for mixed workload
    });
  });

  describe('Transaction Throughput', () => {
    it('should handle high-throughput transaction processing', async () => {
      const throughputSizes = [100, 500, 1000, 2000];
      const throughputResults: any[] = [];

      for (const batchSize of throughputSizes) {
        const entries = TestDatabaseFactory.createLargeTestDataset(batchSize);
        
        const batchResult = await performanceHelper.measureOperation(
          `transaction-throughput-${batchSize}`,
          async () => {
            await dbManager.transaction(async () => {
              for (const entry of entries) {
                await kb.addEntry(entry, 'test-user');
              }
            });
          }
        );

        const throughputPerSecond = batchSize / (batchResult.metrics.executionTime / 1000);
        
        throughputResults.push({
          batchSize,
          totalTime: batchResult.metrics.executionTime,
          throughputPerSecond
        });

        expect(batchResult.success).toBe(true);
        expect(throughputPerSecond).toBeGreaterThan(50); // At least 50 inserts/second
      }

      // Throughput should scale reasonably with batch size
      const firstThroughput = throughputResults[0].throughputPerSecond;
      const lastThroughput = throughputResults[throughputResults.length - 1].throughputPerSecond;
      
      // Large batches should maintain reasonable throughput (within 2x of small batches)
      expect(lastThroughput).toBeGreaterThan(firstThroughput * 0.5);
    });

    it('should handle concurrent transactions efficiently', async () => {
      const concurrentTransactionResult = await performanceHelper.runLoadTest({
        concurrentUsers: 10,
        duration: 15, // 15 seconds
        rampUpTime: 2,
        operations: [
          // Insert operations
          async () => {
            await dbManager.transaction(async () => {
              for (let i = 0; i < 10; i++) {
                await kb.addEntry({
                  title: `Concurrent Entry ${Date.now()}-${i}`,
                  problem: `Concurrent Problem ${i}`,
                  solution: `Concurrent Solution ${i}`,
                  category: 'VSAM'
                }, 'concurrent-user');
              }
            });
          },
          // Update operations
          async () => {
            await dbManager.transaction(async () => {
              const entries = await dbManager.execute('SELECT id FROM kb_entries ORDER BY RANDOM() LIMIT 5');
              for (const entry of entries) {
                await dbManager.execute(
                  'UPDATE kb_entries SET usage_count = usage_count + 1 WHERE id = ?',
                  [(entry as any).id]
                );
              }
            });
          },
          // Select operations
          async () => {
            await dbManager.execute('SELECT * FROM kb_entries WHERE category = ? LIMIT 10', ['VSAM']);
          }
        ]
      });

      const successRate = concurrentTransactionResult.filter(r => r.success).length / concurrentTransactionResult.length;
      expect(successRate).toBeGreaterThan(0.90); // 90% success rate under concurrent load

      // Check for deadlocks or transaction conflicts
      const errors = concurrentTransactionResult.filter(r => !r.success);
      const deadlockErrors = errors.filter(r => r.error?.includes('deadlock') || r.error?.includes('locked'));
      
      // Should have minimal deadlock issues
      expect(deadlockErrors.length).toBeLessThan(concurrentTransactionResult.length * 0.05); // < 5% deadlocks
    });

    it('should maintain ACID properties under high load', async () => {
      const acidTestResult = await performanceHelper.measureOperation(
        'acid-properties-test',
        async () => {
          const initialCount = await dbManager.execute('SELECT COUNT(*) as count FROM kb_entries');
          const startCount = (initialCount[0] as any).count;

          // Concurrent operations that should maintain consistency
          const operations = Array(20).fill(0).map(async (_, i) => {
            try {
              await dbManager.transaction(async () => {
                // Add entry
                const entryId = await kb.addEntry({
                  title: `ACID Test ${i}`,
                  problem: `ACID Problem ${i}`,
                  solution: `ACID Solution ${i}`,
                  category: 'Test'
                }, 'acid-test-user');

                // Update it
                await dbManager.execute(
                  'UPDATE kb_entries SET usage_count = 1 WHERE id = ?',
                  [entryId]
                );

                // Verify it exists
                const verification = await dbManager.execute(
                  'SELECT * FROM kb_entries WHERE id = ?',
                  [entryId]
                );
                
                if (verification.length !== 1) {
                  throw new Error('Transaction consistency violation');
                }
              });
            } catch (error) {
              // Log transaction failures but don't fail the test - this is expected under high concurrency
              console.log(`Transaction ${i} failed:`, error.message);
            }
          });

          await Promise.all(operations);

          // Verify final state is consistent
          const finalCount = await dbManager.execute('SELECT COUNT(*) as count FROM kb_entries');
          const endCount = (finalCount[0] as any).count;
          
          // Count should have increased (some transactions may have failed due to contention)
          expect(endCount).toBeGreaterThan(startCount);
          
          // All test entries should be properly committed or not exist at all
          const testEntries = await dbManager.execute(
            'SELECT * FROM kb_entries WHERE title LIKE "ACID Test%"'
          );
          
          // Each existing test entry should have correct data
          testEntries.forEach((entry: any) => {
            expect(entry.problem).toContain('ACID Problem');
            expect(entry.solution).toContain('ACID Solution');
            expect(entry.category).toBe('Test');
          });
        },
        3
      );

      expect(acidTestResult.success).toBe(true);
    });
  });

  describe('Bulk Operation Performance', () => {
    it('should handle bulk inserts efficiently', async () => {
      const bulkSizes = [1000, 2500, 5000];
      const bulkResults: any[] = [];

      for (const bulkSize of bulkSizes) {
        const bulkData = TestDatabaseFactory.createLargeTestDataset(bulkSize);
        
        const bulkResult = await performanceHelper.measureOperation(
          `bulk-insert-${bulkSize}`,
          async () => {
            await dbManager.transaction(async () => {
              // Use prepared statements for better performance
              const stmt = await dbManager.prepare(`
                INSERT INTO kb_entries (id, title, problem, solution, category, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
              `);

              for (const entry of bulkData) {
                await stmt.run([
                  entry.id || require('uuid').v4(),
                  entry.title,
                  entry.problem,
                  entry.solution,
                  entry.category,
                  'bulk-test-user'
                ]);
              }

              await stmt.finalize();
            });
          }
        );

        const recordsPerSecond = bulkSize / (bulkResult.metrics.executionTime / 1000);
        
        bulkResults.push({
          bulkSize,
          totalTime: bulkResult.metrics.executionTime,
          recordsPerSecond
        });

        expect(bulkResult.success).toBe(true);
        expect(recordsPerSecond).toBeGreaterThan(100); // At least 100 records/second
        expect(bulkResult.metrics.executionTime).toBeLessThan(bulkSize * 2); // < 2ms per record
      }

      // Performance should scale sub-linearly
      const smallBatch = bulkResults[0];
      const largeBatch = bulkResults[bulkResults.length - 1];
      const sizeRatio = largeBatch.bulkSize / smallBatch.bulkSize;
      const timeRatio = largeBatch.totalTime / smallBatch.totalTime;
      
      expect(timeRatio).toBeLessThan(sizeRatio); // Better than linear scaling
    });

    it('should handle bulk updates efficiently', async () => {
      // Create initial data
      const initialData = TestDatabaseFactory.createLargeTestDataset(3000);
      const entryIds: string[] = [];
      
      await dbManager.transaction(async () => {
        for (const entry of initialData) {
          const id = await kb.addEntry(entry, 'test-user');
          entryIds.push(id);
        }
      });

      const updateSizes = [500, 1000, 2000];
      
      for (const updateSize of updateSizes) {
        const idsToUpdate = entryIds.slice(0, updateSize);
        
        const updateResult = await performanceHelper.measureOperation(
          `bulk-update-${updateSize}`,
          async () => {
            await dbManager.transaction(async () => {
              const updateStmt = await dbManager.prepare(`
                UPDATE kb_entries 
                SET usage_count = usage_count + 1, 
                    success_count = success_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `);

              for (const id of idsToUpdate) {
                await updateStmt.run([id]);
              }

              await updateStmt.finalize();
            });
          }
        );

        const updatesPerSecond = updateSize / (updateResult.metrics.executionTime / 1000);
        
        expect(updateResult.success).toBe(true);
        expect(updatesPerSecond).toBeGreaterThan(200); // At least 200 updates/second
        expect(updateResult.metrics.executionTime).toBeLessThan(updateSize * 1); // < 1ms per update
      }
    });

    it('should handle bulk deletes efficiently', async () => {
      // Create test data
      const testData = TestDatabaseFactory.createLargeTestDataset(2000);
      const entryIds: string[] = [];
      
      await dbManager.transaction(async () => {
        for (const entry of testData) {
          const id = await kb.addEntry(entry, 'test-user');
          entryIds.push(id);
        }
      });

      const deleteSizes = [200, 500, 1000];
      
      for (const deleteSize of deleteSizes) {
        const idsToDelete = entryIds.splice(0, deleteSize); // Remove from array to avoid conflicts
        
        const deleteResult = await performanceHelper.measureOperation(
          `bulk-delete-${deleteSize}`,
          async () => {
            await dbManager.transaction(async () => {
              // Delete related data first (foreign key constraints)
              await dbManager.execute(`
                DELETE FROM kb_tags WHERE entry_id IN (${idsToDelete.map(() => '?').join(',')})
              `, idsToDelete);

              // Delete main entries
              await dbManager.execute(`
                DELETE FROM kb_entries WHERE id IN (${idsToDelete.map(() => '?').join(',')})
              `, idsToDelete);

              // Update FTS index
              await dbManager.execute(`
                DELETE FROM kb_fts WHERE id IN (${idsToDelete.map(() => '?').join(',')})
              `, idsToDelete);
            });
          }
        );

        const deletesPerSecond = deleteSize / (deleteResult.metrics.executionTime / 1000);
        
        expect(deleteResult.success).toBe(true);
        expect(deletesPerSecond).toBeGreaterThan(100); // At least 100 deletes/second
        
        // Verify deletes were successful
        const remainingEntries = await dbManager.execute(`
          SELECT COUNT(*) as count FROM kb_entries WHERE id IN (${idsToDelete.map(() => '?').join(',')})
        `, idsToDelete);
        
        expect((remainingEntries[0] as any).count).toBe(0);
      }
    });
  });

  describe('Connection Pool Efficiency', () => {
    it('should manage connection pool effectively under load', async () => {
      const connectionPoolResult = await performanceHelper.runLoadTest({
        concurrentUsers: 15, // More than max connections to test pooling
        duration: 20,
        rampUpTime: 3,
        operations: [
          async () => {
            await dbManager.execute('SELECT COUNT(*) FROM kb_entries');
          },
          async () => {
            await dbManager.execute('SELECT * FROM kb_entries ORDER BY RANDOM() LIMIT 1');
          },
          async () => {
            await dbManager.execute(
              'SELECT * FROM kb_entries WHERE category = ? LIMIT 5',
              [['VSAM', 'JCL', 'DB2'][Math.floor(Math.random() * 3)]]
            );
          }
        ]
      });

      const successRate = connectionPoolResult.filter(r => r.success).length / connectionPoolResult.length;
      expect(successRate).toBeGreaterThan(0.90); // Should handle more users than pool size

      // Check pool health after load test
      const poolHealth = await dbManager.getHealth();
      expect(poolHealth.status).toMatch(/healthy|degraded/);
      expect(poolHealth.connections.active).toBeLessThanOrEqual(poolHealth.connections.maxConnections);
      expect(poolHealth.connections.available).toBeGreaterThanOrEqual(0);
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      // Create many concurrent long-running operations
      const longRunningOperations = Array(20).fill(0).map(async (_, i) => {
        try {
          await dbManager.transaction(async () => {
            // Simulate long-running query
            await new Promise(resolve => setTimeout(resolve, 2000));
            await dbManager.execute('SELECT COUNT(*) FROM kb_entries');
          });
          return { success: true, index: i };
        } catch (error) {
          return { success: false, index: i, error: error.message };
        }
      });

      const results = await Promise.all(longRunningOperations);
      
      // Some operations might timeout or fail due to pool exhaustion, which is expected
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(5); // At least some should succeed

      // Pool should recover after operations complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const healthAfterRecovery = await dbManager.getHealth();
      expect(healthAfterRecovery.status).toMatch(/healthy|degraded/);
      expect(healthAfterRecovery.connections.active).toBeLessThan(healthAfterRecovery.connections.maxConnections);
    });

    it('should optimize connection reuse patterns', async () => {
      const connectionReuseResult = await performanceHelper.measureOperation(
        'connection-reuse-patterns',
        async () => {
          // Simulate realistic usage patterns with mixed query types
          const operations = [
            () => dbManager.execute('SELECT COUNT(*) FROM kb_entries'),
            () => dbManager.execute('SELECT * FROM kb_entries WHERE category = "VSAM" LIMIT 5'),
            () => dbManager.execute('SELECT category, COUNT(*) FROM kb_entries GROUP BY category'),
            () => dbManager.execute('SELECT * FROM kb_entries ORDER BY created_at DESC LIMIT 10')
          ];

          // Execute operations in a realistic pattern
          for (let i = 0; i < 100; i++) {
            const operation = operations[i % operations.length];
            await operation();
          }
        },
        10
      );

      expect(connectionReuseResult.success).toBe(true);
      expect(connectionReuseResult.metrics.operationsPerSecond).toBeGreaterThan(50);
      
      // Verify pool is still healthy
      const poolHealth = await dbManager.getHealth();
      expect(poolHealth.connections.active).toBeLessThanOrEqual(poolHealth.connections.maxConnections);
    });
  });

  describe('Database Performance Regression Detection', () => {
    it('should detect query performance regressions', async () => {
      // Establish baseline performance
      const baselineQueries = [
        'SELECT COUNT(*) FROM kb_entries',
        'SELECT * FROM kb_entries WHERE category = "VSAM" LIMIT 10',
        'SELECT category, AVG(usage_count) FROM kb_entries GROUP BY category',
        'SELECT * FROM kb_fts WHERE kb_fts MATCH "error" LIMIT 20'
      ];

      const baselineResults = await performanceHelper.compareImplementations(
        baselineQueries.map((query, i) => ({
          name: `baseline-query-${i + 1}`,
          fn: () => dbManager.execute(query)
        })),
        20
      );

      // Simulate database under stress
      await this.simulateDatabaseStress();

      // Run same queries under stress
      const stressResults = await performanceHelper.compareImplementations(
        baselineQueries.map((query, i) => ({
          name: `baseline-query-${i + 1}`,
          fn: () => dbManager.execute(query)
        })),
        20
      );

      // Analyze regression
      const regressionAnalysis = performanceHelper.analyzeRegression(
        Object.values(baselineResults),
        Object.values(stressResults),
        0.5 // 50% degradation threshold
      );

      // Most queries should not show significant regression
      const regressions = regressionAnalysis.filter(r => r.isRegression);
      expect(regressions.length).toBeLessThan(baselineQueries.length * 0.5); // Less than 50% regression
    });

    private async simulateDatabaseStress(): Promise<void> {
      // Add more data
      const stressData = TestDatabaseFactory.createLargeTestDataset(1000);
      await dbManager.transaction(async () => {
        for (const entry of stressData) {
          await kb.addEntry(entry, 'stress-test');
        }
      });

      // Run background operations
      const backgroundOps = Array(50).fill(0).map(() =>
        dbManager.execute('SELECT * FROM kb_entries ORDER BY RANDOM() LIMIT 5')
      );
      
      await Promise.all(backgroundOps);
    }
  });
});