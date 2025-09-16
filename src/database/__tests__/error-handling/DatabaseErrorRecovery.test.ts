import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DatabaseManager, DatabaseConfig } from '../../DatabaseManager';
import { KnowledgeDB } from '../../KnowledgeDB';
import { MigrationManager } from '../../MigrationManager';
import { BackupManager } from '../../BackupManager';
import { TestDatabaseFactory } from '../test-utils/TestDatabaseFactory';
import { PerformanceTestHelper } from '../test-utils/PerformanceTestHelper';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

describe('Database Error Recovery Tests', () => {
  let dbManager: DatabaseManager;
  let kb: KnowledgeDB;
  let testDbPath: string;
  let performanceHelper: PerformanceTestHelper;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'error-test.db');
  });

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(async () => {
    if (kb) {
      try {
        kb.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (dbManager) {
      try {
        await dbManager.shutdown();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  afterAll(() => {
    performanceHelper.clearResults();
  });

  describe('Database Corruption Recovery', () => {
    it('should detect database corruption', async () => {
      // Create a valid database first
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        enableWAL: false
      });

      kb = new KnowledgeDB(testDbPath);
      const testEntry = TestDatabaseFactory.createTestKBEntries()[0];
      await kb.addEntry(testEntry, 'test-user');

      // Close connections
      kb.close();
      await dbManager.shutdown();

      // Corrupt the database file
      await TestDatabaseFactory.corruptDatabase(testDbPath);

      // Attempt to recreate connections
      let corruptionDetected = false;
      try {
        dbManager = await TestDatabaseFactory.createTestDatabaseManager({
          path: testDbPath,
          enableWAL: false
        });
      } catch (error) {
        corruptionDetected = true;
        expect(error.message).toMatch(/corrupt|malformed|disk.*image/i);
      }

      if (!corruptionDetected) {
        try {
          kb = new KnowledgeDB(testDbPath);
          await kb.getEntryCount();
        } catch (error) {
          corruptionDetected = true;
          expect(error.message).toMatch(/corrupt|malformed|disk.*image/i);
        }
      }

      expect(corruptionDetected).toBe(true);
    });

    it('should recover from backup when corruption detected', async () => {
      // Create database with data
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });

      kb = new KnowledgeDB(testDbPath);
      const testEntries = TestDatabaseFactory.createTestKBEntries();
      for (const entry of testEntries) {
        await kb.addEntry(entry, 'test-user');
      }

      // Create backup
      const backupManager = new BackupManager(testDbPath, {
        backupDir: path.join(__dirname, '..', 'temp', 'backups'),
        retentionDays: 7
      });

      const backupPath = await backupManager.createBackup();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Close connections and corrupt database
      kb.close();
      await dbManager.shutdown();
      await TestDatabaseFactory.corruptDatabase(testDbPath);

      // Restore from backup
      await backupManager.restoreBackup(backupPath);

      // Verify recovery
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });
      kb = new KnowledgeDB(testDbPath);

      const recoveredCount = await kb.getEntryCount();
      expect(recoveredCount).toBe(testEntries.length);

      const searchResults = await kb.search('VSAM');
      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should handle partial corruption gracefully', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });

      kb = new KnowledgeDB(testDbPath);
      const testEntries = TestDatabaseFactory.createTestKBEntries();
      
      // Add entries in transaction to ensure atomicity
      await dbManager.transaction(async () => {
        for (const entry of testEntries) {
          await kb.addEntry(entry, 'test-user');
        }
      });

      const originalCount = await kb.getEntryCount();
      
      // Simulate partial corruption by writing invalid data to the end of the file
      kb.close();
      await dbManager.shutdown();

      const fd = fs.openSync(testDbPath, 'a');
      fs.writeSync(fd, Buffer.from('CORRUPTED_DATA_AT_END'));
      fs.closeSync(fd);

      // Try to recover
      try {
        dbManager = await TestDatabaseFactory.createTestDatabaseManager({
          path: testDbPath
        });
        kb = new KnowledgeDB(testDbPath);

        // SQLite might be able to read the valid data before corruption
        const recoveredCount = await kb.getEntryCount();
        expect(recoveredCount).toBeGreaterThanOrEqual(0);
        
        // If some data is recoverable, verify it's consistent
        if (recoveredCount > 0) {
          const searchResults = await kb.search('test');
          expect(Array.isArray(searchResults)).toBe(true);
        }
      } catch (error) {
        // If corruption is too severe, ensure error is properly reported
        expect(error.message).toMatch(/corrupt|malformed|disk.*image/i);
      }
    });
  });

  describe('Transaction Failure Recovery', () => {
    beforeEach(async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });
      kb = new KnowledgeDB(testDbPath);
    });

    it('should rollback failed transactions completely', async () => {
      const initialCount = await kb.getEntryCount();
      const testEntry = TestDatabaseFactory.createTestKBEntries()[0];

      let transactionError: Error | null = null;
      try {
        await dbManager.transaction(async () => {
          // Add entry
          await kb.addEntry(testEntry, 'test-user');
          
          // Verify entry was added within transaction
          const midTransactionCount = await kb.getEntryCount();
          expect(midTransactionCount).toBe(initialCount + 1);
          
          // Force transaction to fail
          throw new Error('Simulated transaction failure');
        });
      } catch (error) {
        transactionError = error as Error;
      }

      expect(transactionError).toBeDefined();
      expect(transactionError!.message).toBe('Simulated transaction failure');

      // Verify rollback occurred
      const finalCount = await kb.getEntryCount();
      expect(finalCount).toBe(initialCount);

      // Verify no partial data remains
      const searchResults = await kb.search(testEntry.title);
      expect(searchResults).toHaveLength(0);
    });

    it('should handle nested transaction failures', async () => {
      const entry1 = TestDatabaseFactory.createTestKBEntries()[0];
      const entry2 = TestDatabaseFactory.createTestKBEntries()[1];
      
      const initialCount = await kb.getEntryCount();

      let outerTransactionError: Error | null = null;
      try {
        await dbManager.transaction(async () => {
          await kb.addEntry(entry1, 'test-user');
          
          try {
            await dbManager.transaction(async () => {
              await kb.addEntry(entry2, 'test-user');
              throw new Error('Inner transaction failure');
            });
          } catch (innerError) {
            // Inner transaction failed, but outer should continue
            expect((innerError as Error).message).toBe('Inner transaction failure');
          }
          
          // This should still cause complete rollback
          throw new Error('Outer transaction failure');
        });
      } catch (error) {
        outerTransactionError = error as Error;
      }

      expect(outerTransactionError!.message).toBe('Outer transaction failure');
      
      // All changes should be rolled back
      const finalCount = await kb.getEntryCount();
      expect(finalCount).toBe(initialCount);
    });

    it('should maintain referential integrity after transaction failures', async () => {
      // Add an entry with tags
      const entryWithTags = {
        ...TestDatabaseFactory.createTestKBEntries()[0],
        tags: ['test-tag-1', 'test-tag-2', 'test-tag-3']
      };

      const entryId = await kb.addEntry(entryWithTags, 'test-user');
      
      // Verify tags were added
      const initialTags = await kb.getTagsForEntry(entryId);
      expect(initialTags).toHaveLength(3);

      // Attempt a transaction that modifies both entry and tags, then fails
      try {
        await dbManager.transaction(async () => {
          await kb.updateEntry(entryId, {
            ...entryWithTags,
            title: 'Modified title',
            tags: ['new-tag-1', 'new-tag-2']
          }, 'test-user');
          
          throw new Error('Transaction failure after modifications');
        });
      } catch (error) {
        expect(error.message).toBe('Transaction failure after modifications');
      }

      // Verify original state is preserved
      const recoveredEntry = await kb.getEntryById(entryId);
      expect(recoveredEntry!.title).toBe(entryWithTags.title); // Original title
      
      const recoveredTags = await kb.getTagsForEntry(entryId);
      expect(recoveredTags).toHaveLength(3); // Original tags
      expect(recoveredTags).toEqual(expect.arrayContaining(entryWithTags.tags!));
    });

    it('should handle deadlock scenarios', async () => {
      // This is more relevant for databases that support true concurrent transactions
      // For SQLite, we'll simulate concurrent operations that might conflict
      
      const entry1 = TestDatabaseFactory.createTestKBEntries()[0];
      const entry2 = TestDatabaseFactory.createTestKBEntries()[1];
      
      const id1 = await kb.addEntry(entry1, 'user1');
      const id2 = await kb.addEntry(entry2, 'user2');

      // Simulate concurrent updates that might cause conflicts
      const update1Promise = dbManager.transaction(async () => {
        await TestDatabaseFactory.wait(10); // Small delay
        await kb.updateEntry(id1, { ...entry1, solution: 'Updated by user1' }, 'user1');
        await TestDatabaseFactory.wait(20);
        await kb.updateEntry(id2, { ...entry2, solution: 'Also updated by user1' }, 'user1');
      });

      const update2Promise = dbManager.transaction(async () => {
        await TestDatabaseFactory.wait(15); // Small delay
        await kb.updateEntry(id2, { ...entry2, solution: 'Updated by user2' }, 'user2');
        await TestDatabaseFactory.wait(10);
        await kb.updateEntry(id1, { ...entry1, solution: 'Also updated by user2' }, 'user2');
      });

      // Both operations should complete (SQLite handles this with locking)
      const results = await Promise.allSettled([update1Promise, update2Promise]);
      
      // At least one should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);

      // Database should remain consistent
      const finalEntry1 = await kb.getEntryById(id1);
      const finalEntry2 = await kb.getEntryById(id2);
      
      expect(finalEntry1).toBeDefined();
      expect(finalEntry2).toBeDefined();
    });
  });

  describe('Connection Failure Recovery', () => {
    it('should recover from connection interruptions', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        maxConnections: 5,
        timeout: 1000
      });

      // Perform initial operations
      const testEntry = TestDatabaseFactory.createTestKBEntries()[0];
      const result = await dbManager.execute('SELECT 1 as test');
      expect(result[0].test).toBe(1);

      // Simulate connection interruption by forcing shutdown
      await dbManager.shutdown();

      // Reinitialize and verify recovery
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        maxConnections: 5,
        timeout: 1000
      });

      // Should be able to perform operations again
      const recoveryResult = await dbManager.execute('SELECT 2 as test');
      expect(recoveryResult[0].test).toBe(2);

      const health = await dbManager.getHealth();
      expect(health.status).toBe('healthy');
    });

    it('should handle connection pool exhaustion', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        maxConnections: 2, // Very small pool for testing
        timeout: 1000
      });

      kb = new KnowledgeDB(testDbPath);

      // Create operations that will exhaust connection pool
      const operations = Array(5).fill(0).map((_, i) => 
        async () => {
          await TestDatabaseFactory.wait(100); // Hold connection briefly
          return await kb.search(`query ${i}`);
        }
      );

      // Run operations concurrently
      const results = await Promise.allSettled(
        operations.map(op => op())
      );

      // Most operations should succeed despite pool exhaustion
      const successfulOps = results.filter(r => r.status === 'fulfilled');
      expect(successfulOps.length).toBeGreaterThan(0);

      // System should remain functional after pool stress
      const healthCheck = await dbManager.getHealth();
      expect(healthCheck.status).toMatch(/healthy|degraded/);
    });

    it('should handle database file locking conflicts', async () => {
      // Create first database manager
      const dbManager1 = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        enableWAL: false // Disable WAL to test locking
      });

      // Create second database manager to same file
      const dbManager2 = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        enableWAL: false,
        timeout: 500
      });

      // Both should be able to read
      const result1 = await dbManager1.execute('SELECT 1 as test');
      const result2 = await dbManager2.execute('SELECT 1 as test');
      
      expect(result1[0].test).toBe(1);
      expect(result2[0].test).toBe(1);

      // Cleanup
      await dbManager1.shutdown();
      await dbManager2.shutdown();
    });
  });

  describe('Data Validation and Constraint Failures', () => {
    beforeEach(async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        enableForeignKeys: true
      });
      kb = new KnowledgeDB(testDbPath);
    });

    it('should handle foreign key constraint violations', async () => {
      // Add an entry
      const testEntry = TestDatabaseFactory.createTestKBEntries()[0];
      const entryId = await kb.addEntry(testEntry, 'test-user');

      // Try to add usage record with non-existent entry ID
      await expect(
        kb.recordUsage('non-existent-entry-id', 'view', 'test-user')
      ).rejects.toThrow();

      // Verify original entry is unaffected
      const originalEntry = await kb.getEntryById(entryId);
      expect(originalEntry).toBeDefined();
      expect(originalEntry!.usage_count).toBe(0);
    });

    it('should handle check constraint violations', async () => {
      const invalidEntry = {
        title: 'Test Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'INVALID_CATEGORY' // This should violate the check constraint
      };

      await expect(
        kb.addEntry(invalidEntry as any, 'test-user')
      ).rejects.toThrow();

      // Verify no partial data was inserted
      const count = await kb.getEntryCount();
      expect(count).toBe(0);
    });

    it('should handle unique constraint violations', async () => {
      // Create a table with unique constraint for testing
      await dbManager.execute(`
        CREATE TABLE unique_test (
          id INTEGER PRIMARY KEY,
          unique_value TEXT UNIQUE,
          other_data TEXT
        )
      `);

      // Insert initial record
      await dbManager.execute(
        'INSERT INTO unique_test (unique_value, other_data) VALUES (?, ?)',
        ['unique_val', 'data1']
      );

      // Try to insert duplicate
      await expect(
        dbManager.execute(
          'INSERT INTO unique_test (unique_value, other_data) VALUES (?, ?)',
          ['unique_val', 'data2']
        )
      ).rejects.toThrow(/UNIQUE constraint failed/);

      // Verify original record is unchanged
      const result = await dbManager.execute(
        'SELECT * FROM unique_test WHERE unique_value = ?',
        ['unique_val']
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].other_data).toBe('data1');
    });

    it('should handle not null constraint violations', async () => {
      // Try to add entry with null required field
      await expect(
        kb.addEntry({
          title: null,
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'VSAM'
        } as any, 'test-user')
      ).rejects.toThrow();

      // Verify no data was inserted
      const count = await kb.getEntryCount();
      expect(count).toBe(0);
    });
  });

  describe('Disk Space and Storage Failures', () => {
    it('should handle disk full scenarios gracefully', async () => {
      // This is difficult to test without actually filling disk
      // We'll simulate by testing large data insertions and monitoring behavior
      
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });
      kb = new KnowledgeDB(testDbPath);

      // Try to insert a very large entry
      const largeEntry = {
        title: 'Large Entry',
        problem: 'A'.repeat(1000000), // 1MB of text
        solution: 'B'.repeat(1000000), // 1MB of text
        category: 'VSAM'
      };

      let insertSucceeded = false;
      try {
        await kb.addEntry(largeEntry, 'test-user');
        insertSucceeded = true;
      } catch (error) {
        // If insertion fails due to size, that's acceptable
        expect(error.message).toMatch(/disk|space|size|memory/i);
      }

      // Database should remain functional regardless
      const smallEntry = TestDatabaseFactory.createTestKBEntries()[0];
      await kb.addEntry(smallEntry, 'test-user');
      
      const count = await kb.getEntryCount();
      expect(count).toBeGreaterThan(0);
    });

    it('should handle file permission errors', async () => {
      // Create database in a temporary location
      const tempDbPath = path.join(__dirname, '..', 'temp', 'permission-test.db');
      
      try {
        dbManager = await TestDatabaseFactory.createTestDatabaseManager({
          path: tempDbPath
        });

        // Perform normal operations
        await dbManager.execute('SELECT 1');
        
        await dbManager.shutdown();

        // Try to open read-only file (simulation of permission issues)
        if (fs.existsSync(tempDbPath)) {
          fs.chmodSync(tempDbPath, 0o444); // Read-only
        }

        let permissionError = false;
        try {
          dbManager = await TestDatabaseFactory.createTestDatabaseManager({
            path: tempDbPath
          });
          await dbManager.execute('CREATE TABLE test_write (id INTEGER)');
        } catch (error) {
          permissionError = true;
          expect(error.message).toMatch(/readonly|permission|write/i);
        }

        // Restore permissions for cleanup
        if (fs.existsSync(tempDbPath)) {
          fs.chmodSync(tempDbPath, 0o666);
        }

        expect(permissionError).toBe(true);
      } finally {
        if (fs.existsSync(tempDbPath)) {
          fs.unlinkSync(tempDbPath);
        }
      }
    });
  });

  describe('Migration Failure Recovery', () => {
    it('should rollback failed migrations', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });

      const migrationsDir = path.join(__dirname, '..', 'temp', 'error-migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }

      const migrationManager = new MigrationManager(
        dbManager.getConnection(),
        migrationsDir
      );

      // Create a valid migration
      const validMigration = {
        version: 1,
        description: 'valid-migration',
        up: 'CREATE TABLE test_table (id INTEGER PRIMARY KEY);',
        down: 'DROP TABLE test_table;'
      };

      // Create an invalid migration
      const invalidMigration = {
        version: 2,
        description: 'invalid-migration',
        up: 'INVALID SQL STATEMENT THAT WILL FAIL;',
        down: 'SELECT 1;'
      };

      fs.writeFileSync(
        path.join(migrationsDir, '001_valid-migration.json'),
        JSON.stringify(validMigration, null, 2)
      );

      fs.writeFileSync(
        path.join(migrationsDir, '002_invalid-migration.json'),
        JSON.stringify(invalidMigration, null, 2)
      );

      // Run migrations
      const results = await migrationManager.runPendingMigrations();
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);

      // Only first migration should be applied
      expect(migrationManager.getCurrentVersion()).toBe(1);

      // Verify database consistency
      const tables = await dbManager.execute(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'
      `);
      expect(tables).toHaveLength(1);

      // Database should still be usable
      await dbManager.execute('INSERT INTO test_table DEFAULT VALUES');
      const count = await dbManager.execute('SELECT COUNT(*) as count FROM test_table');
      expect(count[0].count).toBe(1);
    });

    it('should handle migration file corruption', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });

      const migrationsDir = path.join(__dirname, '..', 'temp', 'corrupt-migrations');
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }

      // Create corrupted migration file
      fs.writeFileSync(
        path.join(migrationsDir, '001_corrupt-migration.json'),
        '{ "version": 1, "description": "corrupt", invalid json syntax'
      );

      const migrationManager = new MigrationManager(
        dbManager.getConnection(),
        migrationsDir
      );

      // Should throw when trying to load corrupted migration
      expect(() => migrationManager.getMigrations()).toThrow();

      // Database should remain unaffected
      const initialVersion = migrationManager.getCurrentVersion();
      expect(initialVersion).toBe(0);
    });
  });

  describe('Backup and Recovery Failures', () => {
    it('should handle backup creation failures', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });

      kb = new KnowledgeDB(testDbPath);
      const testEntry = TestDatabaseFactory.createTestKBEntries()[0];
      await kb.addEntry(testEntry, 'test-user');

      // Try to create backup in non-existent directory
      const backupManager = new BackupManager(testDbPath, {
        backupDir: '/non/existent/directory',
        retentionDays: 7
      });

      await expect(backupManager.createBackup()).rejects.toThrow();

      // Original database should be unaffected
      const count = await kb.getEntryCount();
      expect(count).toBe(1);

      const searchResults = await kb.search(testEntry.title);
      expect(searchResults).toHaveLength(1);
    });

    it('should handle backup restoration failures', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });

      kb = new KnowledgeDB(testDbPath);
      const testEntry = TestDatabaseFactory.createTestKBEntries()[0];
      await kb.addEntry(testEntry, 'test-user');

      const backupManager = new BackupManager(testDbPath, {
        backupDir: path.join(__dirname, '..', 'temp', 'backup-test'),
        retentionDays: 7
      });

      // Try to restore from non-existent backup
      await expect(
        backupManager.restoreBackup('/non/existent/backup.db')
      ).rejects.toThrow();

      // Original database should be unaffected
      const count = await kb.getEntryCount();
      expect(count).toBe(1);
    });

    it('should handle corrupted backup files', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath
      });

      const backupDir = path.join(__dirname, '..', 'temp', 'corrupt-backup-test');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Create a corrupted backup file
      const corruptBackupPath = path.join(backupDir, 'corrupt-backup.db');
      fs.writeFileSync(corruptBackupPath, 'This is not a valid SQLite database file');

      const backupManager = new BackupManager(testDbPath, {
        backupDir,
        retentionDays: 7
      });

      // Should fail to restore corrupted backup
      await expect(
        backupManager.restoreBackup(corruptBackupPath)
      ).rejects.toThrow();
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    it('should handle memory pressure gracefully', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        cacheSize: 1 // Very small cache
      });

      kb = new KnowledgeDB(testDbPath);

      // Create memory pressure by inserting many large entries
      const largeEntries = Array(100).fill(0).map((_, i) => ({
        title: `Large Entry ${i}`,
        problem: `Problem description ${'x'.repeat(1000)} ${i}`,
        solution: `Solution text ${'y'.repeat(1000)} ${i}`,
        category: 'VSAM' as const,
        tags: [`tag${i}`, `category${i % 5}`, `type${i % 3}`]
      }));

      let insertErrors = 0;
      for (const entry of largeEntries) {
        try {
          await kb.addEntry(entry, 'test-user');
        } catch (error) {
          insertErrors++;
          // Acceptable if some inserts fail due to memory pressure
        }
      }

      // At least some inserts should succeed
      const finalCount = await kb.getEntryCount();
      expect(finalCount).toBeGreaterThan(0);

      // System should remain functional
      const searchResults = await kb.search('Large Entry');
      expect(searchResults.length).toBeGreaterThan(0);

      // Memory pressure should not have caused corruption
      const health = await dbManager.getHealth();
      expect(health.status).toMatch(/healthy|degraded/);
    });

    it('should handle connection resource exhaustion', async () => {
      dbManager = await TestDatabaseFactory.createTestDatabaseManager({
        path: testDbPath,
        maxConnections: 2, // Very limited connections
        timeout: 500
      });

      // Create many concurrent operations
      const operations = Array(20).fill(0).map((_, i) => 
        () => dbManager.execute(`SELECT ${i} as test`)
      );

      const results = await Promise.allSettled(
        operations.map(op => op())
      );

      // Some operations should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);

      // Failed operations should have meaningful error messages
      const failures = results.filter(r => r.status === 'rejected') as Array<{status: 'rejected'; reason: Error}>;
      failures.forEach(failure => {
        expect(failure.reason.message).toMatch(/timeout|busy|locked/i);
      });

      // System should recover after resource pressure
      await TestDatabaseFactory.wait(1000);
      const finalTest = await dbManager.execute('SELECT 999 as test');
      expect(finalTest[0].test).toBe(999);
    });
  });
});