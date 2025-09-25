import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DatabaseManager } from '../../DatabaseManager';
import { MigrationManager } from '../../MigrationManager';
import { BackupManager } from '../../BackupManager';
import { KnowledgeDB } from '../../KnowledgeDB';
import { TestDatabaseFactory } from '../test-utils/TestDatabaseFactory';
import { PerformanceTestHelper } from '../test-utils/PerformanceTestHelper';
import path from 'path';
import fs from 'fs';

describe('Database Integration Tests', () => {
  let dbManager: DatabaseManager;
  let kb: KnowledgeDB;
  let migrationManager: MigrationManager;
  let backupManager: BackupManager;
  let testDbPath: string;
  let performanceHelper: PerformanceTestHelper;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'integration-test.db');
  });

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize components
    dbManager = await TestDatabaseFactory.createTestDatabaseManager({
      path: testDbPath,
      enableWAL: true,
      enableForeignKeys: true,
      enableMonitoring: true,
      backup: {
        enabled: true,
        intervalHours: 1,
        retentionDays: 7,
        path: path.join(__dirname, '..', 'temp', 'backups'),
      },
    });

    kb = new KnowledgeDB(testDbPath);
    migrationManager = new MigrationManager(
      dbManager.getConnection(),
      path.join(__dirname, '..', 'temp', 'migrations')
    );
    backupManager = new BackupManager(testDbPath, {
      backupDir: path.join(__dirname, '..', 'temp', 'backups'),
      retentionDays: 7,
      compression: true,
    });
  });

  afterEach(async () => {
    // Cleanup
    if (kb) {
      kb.close();
    }
    if (dbManager) {
      await dbManager.shutdown();
    }

    // Clean up files
    const tempDir = path.join(__dirname, '..', 'temp');
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach(file => {
        const filePath = path.join(tempDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
  });

  afterAll(() => {
    performanceHelper.clearResults();
  });

  describe('End-to-End Migration Workflow', () => {
    it('should execute complete migration lifecycle', async () => {
      // Create test migrations
      const migrationsDir = path.join(__dirname, '..', 'temp', 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }

      const migration1 = {
        version: 1,
        description: 'initial-kb-schema',
        up: `
          CREATE TABLE kb_entries (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            problem TEXT NOT NULL,
            solution TEXT NOT NULL,
            category TEXT CHECK(category IN ('VSAM', 'JCL', 'DB2', 'Batch', 'Functional')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `,
        down: 'DROP TABLE kb_entries;',
      };

      const migration2 = {
        version: 2,
        description: 'add-tags-table',
        up: `
          CREATE TABLE kb_tags (
            entry_id TEXT,
            tag TEXT,
            PRIMARY KEY (entry_id, tag),
            FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
          );
        `,
        down: 'DROP TABLE kb_tags;',
      };

      // Write migration files
      fs.writeFileSync(
        path.join(migrationsDir, '001_initial-kb-schema.json'),
        JSON.stringify(migration1, null, 2)
      );
      fs.writeFileSync(
        path.join(migrationsDir, '002_add-tags-table.json'),
        JSON.stringify(migration2, null, 2)
      );

      // Execute migrations
      const results = await migrationManager.runPendingMigrations();

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Verify schema
      const tables = await dbManager.execute(`
        SELECT name FROM sqlite_master WHERE type='table' 
        AND name IN ('kb_entries', 'kb_tags')
      `);
      expect(tables).toHaveLength(2);

      // Test rollback
      await migrationManager.rollbackMigration(2);
      expect(migrationManager.getCurrentVersion()).toBe(1);

      const remainingTables = await dbManager.execute(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='kb_tags'
      `);
      expect(remainingTables).toHaveLength(0);
    });

    it('should handle migration failures and maintain consistency', async () => {
      const migrationsDir = path.join(__dirname, '..', 'temp', 'migrations');

      const validMigration = {
        version: 1,
        description: 'valid-migration',
        up: 'CREATE TABLE valid_table (id INTEGER);',
        down: 'DROP TABLE valid_table;',
      };

      const invalidMigration = {
        version: 2,
        description: 'invalid-migration',
        up: 'INVALID SQL STATEMENT;',
        down: 'SELECT 1;',
      };

      fs.writeFileSync(
        path.join(migrationsDir, '001_valid-migration.json'),
        JSON.stringify(validMigration, null, 2)
      );
      fs.writeFileSync(
        path.join(migrationsDir, '002_invalid-migration.json'),
        JSON.stringify(invalidMigration, null, 2)
      );

      const results = await migrationManager.runPendingMigrations();

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);

      // Only first migration should be applied
      expect(migrationManager.getCurrentVersion()).toBe(1);

      // Database should still be functional
      const testResult = await dbManager.execute('SELECT 1 as test');
      expect(testResult[0].test).toBe(1);
    });
  });

  describe('Backup and Restore Integration', () => {
    it('should create and restore complete database backup', async () => {
      // Initialize KB with test data
      const testEntries = TestDatabaseFactory.createTestKBEntries();
      for (const entry of testEntries) {
        await kb.addEntry(entry, 'test-user');
      }

      // Create backup
      const backupPath = await backupManager.createBackup();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Modify data
      await kb.clearAllEntries();
      expect(await kb.getEntryCount()).toBe(0);

      // Restore from backup
      await backupManager.restoreBackup(backupPath);

      // Recreate KB instance to see restored data
      kb.close();
      kb = new KnowledgeDB(testDbPath);

      // Verify data restoration
      const count = await kb.getEntryCount();
      expect(count).toBe(testEntries.length);

      const results = await kb.search('VSAM');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle incremental backups', async () => {
      // Initial data
      const initialEntries = TestDatabaseFactory.createTestKBEntries().slice(0, 3);
      for (const entry of initialEntries) {
        await kb.addEntry(entry, 'test-user');
      }

      // Create first backup
      const backup1Path = await backupManager.createBackup();

      // Add more data
      const additionalEntries = TestDatabaseFactory.createTestKBEntries().slice(3, 5);
      for (const entry of additionalEntries) {
        await kb.addEntry(entry, 'test-user');
      }

      // Create incremental backup
      const backup2Path = await backupManager.createIncrementalBackup(backup1Path);
      expect(fs.existsSync(backup2Path)).toBe(true);

      // Verify backup contains all data
      await backupManager.restoreBackup(backup2Path);

      kb.close();
      kb = new KnowledgeDB(testDbPath);

      expect(await kb.getEntryCount()).toBe(5);
    });

    it('should perform automatic scheduled backups', async () => {
      // This test would typically require time manipulation or mocking
      // For now, we'll test the backup configuration and manual trigger

      const config = backupManager.getConfiguration();
      expect(config.retentionDays).toBe(7);
      expect(config.compression).toBe(true);

      // Trigger manual backup
      const backupPath = await backupManager.createBackup();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Verify backup metadata
      const metadata = await backupManager.getBackupMetadata(backupPath);
      expect(metadata).toHaveProperty('timestamp');
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('compressed');
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with concurrent operations', async () => {
      const operations = [
        // Database operations
        () => dbManager.execute('SELECT 1 as test'),
        () => dbManager.execute('SELECT COUNT(*) FROM sqlite_master'),

        // KB operations
        async () => {
          const entry = TestDatabaseFactory.createTestKBEntries()[0];
          return await kb.addEntry(entry, 'test-user');
        },
        () => kb.search('test'),

        // Migration operations (safe ones)
        () => migrationManager.getCurrentVersion(),
        () => migrationManager.getMigrationHistory(),
      ];

      const loadTestConfig = {
        concurrentUsers: 10,
        duration: 15, // 15 seconds
        rampUpTime: 3,
        operations,
      };

      const results = await performanceHelper.runLoadTest(loadTestConfig);

      const successRate = results.filter(r => r.success).length / results.length;
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate

      // Verify system is still functional
      const healthCheck = await dbManager.getHealth();
      expect(healthCheck.status).toMatch(/healthy|degraded/);
    });

    it('should handle database growth efficiently', async () => {
      const sizes = [100, 500, 1000];
      const performanceResults: any[] = [];

      for (const size of sizes) {
        // Clear existing data
        await kb.clearAllEntries();

        // Add data and measure performance
        const addDataResult = await performanceHelper.measureOperation(
          `add-data-${size}`,
          async () => {
            const entries = TestDatabaseFactory.createLargeTestDataset(size);
            for (const entry of entries) {
              await kb.addEntry(entry, 'test-user');
            }
          }
        );

        // Measure search performance
        const searchResult = await performanceHelper.measureOperation(
          `search-${size}`,
          () => kb.search('error'),
          10
        );

        performanceResults.push({
          size,
          addTime: addDataResult.metrics.executionTime,
          searchTime: searchResult.metrics.executionTime,
        });
      }

      // Performance should scale reasonably
      const firstResult = performanceResults[0];
      const lastResult = performanceResults[performanceResults.length - 1];

      // Allow up to 5x increase in time for 10x increase in data
      expect(lastResult.searchTime).toBeLessThan(firstResult.searchTime * 5);
    });

    it('should maintain cache effectiveness under load', async () => {
      // Add some data
      const entries = TestDatabaseFactory.createTestKBEntries();
      for (const entry of entries) {
        await kb.addEntry(entry, 'test-user');
      }

      const queries = [
        'VSAM error',
        'data exception',
        'JCL dataset',
        'DB2 resource',
        'COBOL compile',
      ];

      // Measure initial query performance (cache misses)
      const initialResults = await performanceHelper.compareImplementations(
        queries.map(query => ({
          name: `initial-${query}`,
          fn: () => kb.search(query),
        })),
        10
      );

      // Measure cached query performance
      const cachedResults = await performanceHelper.compareImplementations(
        queries.map(query => ({
          name: `cached-${query}`,
          fn: () => kb.search(query),
        })),
        50
      );

      // Cached queries should be faster on average
      const initialAvgTime =
        Object.values(initialResults).reduce(
          (sum, result) => sum + result.metrics.executionTime,
          0
        ) / queries.length;

      const cachedAvgTime =
        Object.values(cachedResults).reduce(
          (sum, result) => sum + result.metrics.executionTime,
          0
        ) / queries.length;

      expect(cachedAvgTime).toBeLessThan(initialAvgTime);
    });
  });

  describe('Transaction Integrity Across Components', () => {
    it('should maintain consistency during complex operations', async () => {
      // Start a complex operation involving multiple components
      await dbManager.transaction(async () => {
        // Add KB entry
        const entry = TestDatabaseFactory.createTestKBEntries()[0];
        const entryId = await kb.addEntry(entry, 'test-user');

        // Record usage
        await kb.recordUsage(entryId, 'view', 'test-user');

        // Update entry
        await kb.updateEntry(
          entryId,
          {
            ...entry,
            solution: 'Updated solution',
          },
          'test-user'
        );
      });

      // Verify all operations completed
      const entries = await kb.search('Updated solution');
      expect(entries).toHaveLength(1);
      expect(entries[0].entry.usage_count).toBeGreaterThan(0);
    });

    it('should rollback all changes on transaction failure', async () => {
      const initialCount = await kb.getEntryCount();

      try {
        await dbManager.transaction(async () => {
          // Add entry
          const entry = TestDatabaseFactory.createTestKBEntries()[0];
          await kb.addEntry(entry, 'test-user');

          // Cause an error
          throw new Error('Simulated transaction error');
        });
      } catch (error) {
        expect(error.message).toBe('Simulated transaction error');
      }

      // Entry count should remain unchanged
      const finalCount = await kb.getEntryCount();
      expect(finalCount).toBe(initialCount);
    });

    it('should handle nested transactions correctly', async () => {
      await dbManager.transaction(async () => {
        const entry1 = TestDatabaseFactory.createTestKBEntries()[0];
        const entryId1 = await kb.addEntry(entry1, 'test-user');

        await dbManager.transaction(async () => {
          const entry2 = TestDatabaseFactory.createTestKBEntries()[1];
          const entryId2 = await kb.addEntry(entry2, 'test-user');

          // Both should be committed
          await kb.recordUsage(entryId1, 'view', 'test-user');
          await kb.recordUsage(entryId2, 'view', 'test-user');
        });
      });

      expect(await kb.getEntryCount()).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Database Health and Monitoring', () => {
    it('should provide comprehensive health metrics', async () => {
      // Generate some activity
      const entries = TestDatabaseFactory.createTestKBEntries();
      for (const entry of entries) {
        await kb.addEntry(entry, 'test-user');
      }

      // Perform various operations
      for (let i = 0; i < 10; i++) {
        await kb.search('test');
        await dbManager.execute('SELECT COUNT(*) FROM kb_entries');
      }

      const health = await dbManager.getHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('connections');
      expect(health).toHaveProperty('performance');
      expect(health).toHaveProperty('cache');
      expect(health).toHaveProperty('storage');

      expect(health.performance.totalQueries).toBeGreaterThan(0);
      expect(health.performance.averageQueryTime).toBeGreaterThan(0);
      expect(health.connections.active).toBeGreaterThanOrEqual(0);
    });

    it('should detect performance degradation', async () => {
      // Baseline performance
      const baselineResult = await performanceHelper.measureOperation(
        'baseline-query',
        () => dbManager.execute('SELECT 1'),
        100
      );

      // Add load
      const largeDataset = TestDatabaseFactory.createLargeTestDataset(1000);
      for (const entry of largeDataset) {
        await kb.addEntry(entry, 'test-user');
      }

      // Measure performance under load
      const loadedResult = await performanceHelper.measureOperation(
        'loaded-query',
        () => dbManager.execute('SELECT 1'),
        100
      );

      // Analyze performance regression
      const regression = performanceHelper.analyzeRegression(
        [baselineResult],
        [loadedResult],
        0.5 // 50% threshold
      );

      expect(regression).toHaveLength(1);
      expect(typeof regression[0].degradation).toBe('number');
    });

    it('should monitor resource usage', async () => {
      const metrics = await performanceHelper.testMemoryUsage(
        async () => {
          // Perform memory-intensive operations
          const entry = TestDatabaseFactory.createTestKBEntries()[0];
          await kb.addEntry(entry, 'test-user');
          await kb.search('test');
          await dbManager.execute('SELECT * FROM kb_entries');
        },
        5000, // 5 seconds
        250 // Check every 250ms
      );

      expect(metrics.length).toBeGreaterThan(10);

      // Memory usage should be stable
      const maxMemory = Math.max(...metrics.map(m => m.memoryUsage.heapUsed));
      const minMemory = Math.min(...metrics.map(m => m.memoryUsage.heapUsed));
      const memoryVariation = (maxMemory - minMemory) / minMemory;

      expect(memoryVariation).toBeLessThan(2); // Less than 200% variation
    });
  });

  describe('Data Consistency Across Restarts', () => {
    it('should maintain data integrity after restart', async () => {
      // Add data
      const entries = TestDatabaseFactory.createTestKBEntries();
      const entryIds: string[] = [];

      for (const entry of entries) {
        const id = await kb.addEntry(entry, 'test-user');
        entryIds.push(id);
        await kb.recordUsage(id, 'view', 'test-user');
      }

      // Record initial state
      const initialCount = await kb.getEntryCount();
      const initialSearchResults = await kb.search('VSAM');

      // Simulate restart by closing and reopening
      kb.close();
      await dbManager.shutdown();

      // Reinitialize
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        enableWAL: true,
        enableForeignKeys: true,
      });
      kb = new KnowledgeDB(testDbPath);

      // Verify data persistence
      expect(await kb.getEntryCount()).toBe(initialCount);

      const restoredSearchResults = await kb.search('VSAM');
      expect(restoredSearchResults.length).toBe(initialSearchResults.length);

      // Verify usage metrics persisted
      for (const entryId of entryIds) {
        const entry = await kb.getEntryById(entryId);
        expect(entry).toBeDefined();
        expect(entry!.usage_count).toBeGreaterThan(0);
      }
    });

    it('should recover from improper shutdown', async () => {
      // Add data
      const entry = TestDatabaseFactory.createTestKBEntries()[0];
      await kb.addEntry(entry, 'test-user');

      // Simulate improper shutdown (don't call close methods)
      // Just reinitialize components
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        enableWAL: true,
      });
      kb = new KnowledgeDB(testDbPath);

      // Should still be functional
      expect(await kb.getEntryCount()).toBeGreaterThan(0);
      const results = await kb.search(entry.title);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Error Propagation and Handling', () => {
    it('should handle cascading failures gracefully', async () => {
      // Create a scenario where one component failure might affect others
      const entry = TestDatabaseFactory.createTestKBEntries()[0];
      const entryId = await kb.addEntry(entry, 'test-user');

      // Simulate a database connection issue
      try {
        await dbManager.execute('INVALID SQL THAT CAUSES ERROR');
      } catch (error) {
        // Expected error
      }

      // Other operations should still work
      expect(await kb.getEntryById(entryId)).toBeDefined();
      expect(await kb.search(entry.title)).toHaveLength(1);
    });

    it('should maintain service availability during partial failures', async () => {
      const entries = TestDatabaseFactory.createTestKBEntries();
      for (const entry of entries) {
        await kb.addEntry(entry, 'test-user');
      }

      // Simulate backup failure
      const invalidBackupPath = '/invalid/path/backup.db';
      try {
        await backupManager.restoreBackup(invalidBackupPath);
      } catch (error) {
        // Expected error
      }

      // Core functionality should remain available
      const searchResults = await kb.search('VSAM');
      expect(searchResults.length).toBeGreaterThan(0);

      const health = await dbManager.getHealth();
      expect(health.status).toMatch(/healthy|degraded/);
    });
  });
});
