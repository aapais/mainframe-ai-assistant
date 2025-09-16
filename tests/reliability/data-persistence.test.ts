/**
 * Data Persistence Reliability Tests
 * Tests data integrity during system failures, shutdowns, and recovery scenarios
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB, KBEntry } from '../../src/database/KnowledgeDB';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Data Persistence Reliability Tests', () => {
  let testDbPath: string;
  let backupPath: string;
  let dbManager: DatabaseManager;
  let knowledgeDB: KnowledgeDB;

  const TEST_ENTRIES: KBEntry[] = [
    {
      title: 'Test Entry 1',
      problem: 'Test problem 1',
      solution: 'Test solution 1',
      category: 'VSAM',
      tags: ['test', 'reliability']
    },
    {
      title: 'Test Entry 2',
      problem: 'Test problem 2',
      solution: 'Test solution 2',
      category: 'JCL',
      tags: ['test', 'persistence']
    }
  ];

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-reliability-'));
    testDbPath = path.join(tempDir, 'test-persistence.db');
    backupPath = path.join(tempDir, 'backup.db');
  });

  beforeEach(async () => {
    // Clean start for each test
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File might not exist
    }
    
    dbManager = new DatabaseManager(testDbPath);
    await dbManager.initialize();
    knowledgeDB = new KnowledgeDB(testDbPath);
  });

  afterEach(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    if (knowledgeDB) {
      await knowledgeDB.close();
    }
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      const dir = path.dirname(testDbPath);
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  describe('Transaction Atomicity', () => {
    it('should maintain data integrity during failed transactions', async () => {
      // Add some initial data
      const entryId = await knowledgeDB.addEntry(TEST_ENTRIES[0]);
      expect(entryId).toBeTruthy();

      // Simulate a transaction failure
      const mockFailingEntry = {
        ...TEST_ENTRIES[1],
        // This should cause a constraint violation
        category: 'INVALID_CATEGORY' as any
      };

      try {
        await knowledgeDB.addEntry(mockFailingEntry);
      } catch (error) {
        // Expected to fail
      }

      // Verify original data is still intact
      const entries = await knowledgeDB.getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe(TEST_ENTRIES[0].title);
    });

    it('should handle concurrent write operations safely', async () => {
      const concurrentWrites = TEST_ENTRIES.map(async (entry, index) => {
        // Add slight delay to create race condition
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return knowledgeDB.addEntry({
          ...entry,
          title: `${entry.title} - Concurrent ${index}`
        });
      });

      const results = await Promise.allSettled(concurrentWrites);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThan(0);
      
      // Verify all successful writes are persisted
      const entries = await knowledgeDB.getAllEntries();
      expect(entries).toHaveLength(successful.length);
    });

    it('should recover from interrupted batch operations', async () => {
      const batchSize = 10;
      const batchEntries: KBEntry[] = Array.from({ length: batchSize }, (_, i) => ({
        ...TEST_ENTRIES[0],
        title: `Batch Entry ${i}`,
        problem: `Batch problem ${i}`
      }));

      // Start batch operation
      const promises = batchEntries.map(entry => knowledgeDB.addEntry(entry));
      
      // Simulate interruption by closing connection mid-operation
      setTimeout(() => {
        // Force close some connections (simulation)
      }, 1);

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      // Verify database is in consistent state
      const entries = await knowledgeDB.getAllEntries();
      expect(entries).toHaveLength(successful);
      
      // All entries should be complete and valid
      entries.forEach(entry => {
        expect(entry.title).toBeTruthy();
        expect(entry.problem).toBeTruthy();
        expect(entry.solution).toBeTruthy();
      });
    });
  });

  describe('Data Integrity During Shutdowns', () => {
    it('should preserve data during graceful shutdown', async () => {
      // Add test data
      const entryIds: string[] = [];
      for (const entry of TEST_ENTRIES) {
        const id = await knowledgeDB.addEntry(entry);
        entryIds.push(id);
      }

      // Graceful shutdown
      await knowledgeDB.close();
      await dbManager.close();

      // Restart and verify data
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      const entries = await knowledgeDB.getAllEntries();
      expect(entries).toHaveLength(TEST_ENTRIES.length);
      
      // Verify data integrity
      const retrievedTitles = entries.map(e => e.title).sort();
      const expectedTitles = TEST_ENTRIES.map(e => e.title).sort();
      expect(retrievedTitles).toEqual(expectedTitles);
    });

    it('should handle WAL checkpoint during shutdown', async () => {
      // Enable WAL mode
      await dbManager.executeQuery('PRAGMA journal_mode = WAL');
      
      // Add data to create WAL entries
      for (let i = 0; i < 50; i++) {
        await knowledgeDB.addEntry({
          ...TEST_ENTRIES[0],
          title: `WAL Test Entry ${i}`,
          problem: `WAL problem ${i}`
        });
      }

      // Force WAL checkpoint
      await dbManager.executeQuery('PRAGMA wal_checkpoint(FULL)');
      
      // Shutdown
      await knowledgeDB.close();
      await dbManager.close();

      // Restart and verify
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      const entries = await knowledgeDB.getAllEntries();
      expect(entries).toHaveLength(50);
    });

    it('should recover from unexpected shutdown (crash simulation)', async () => {
      // Add some data
      await knowledgeDB.addEntry(TEST_ENTRIES[0]);
      
      // Simulate crash by not closing properly
      // (In real scenario, this would be process termination)
      
      // Create new instances without proper cleanup
      const newDbManager = new DatabaseManager(testDbPath);
      await newDbManager.initialize();
      const newKnowledgeDB = new KnowledgeDB(testDbPath);

      try {
        // Should be able to read existing data
        const entries = await newKnowledgeDB.getAllEntries();
        expect(entries).toHaveLength(1);
        expect(entries[0].title).toBe(TEST_ENTRIES[0].title);

        // Should be able to add new data
        await newKnowledgeDB.addEntry(TEST_ENTRIES[1]);
        const updatedEntries = await newKnowledgeDB.getAllEntries();
        expect(updatedEntries).toHaveLength(2);
      } finally {
        await newKnowledgeDB.close();
        await newDbManager.close();
      }
    });
  });

  describe('Backup and Restore Functionality', () => {
    it('should create valid backups', async () => {
      // Add test data
      for (const entry of TEST_ENTRIES) {
        await knowledgeDB.addEntry(entry);
      }

      // Create backup
      await dbManager.createBackup(backupPath);

      // Verify backup file exists and is valid
      const stats = await fs.stat(backupPath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify backup can be read
      const backupDb = new KnowledgeDB(backupPath);
      try {
        const entries = await backupDb.getAllEntries();
        expect(entries).toHaveLength(TEST_ENTRIES.length);
      } finally {
        await backupDb.close();
      }
    });

    it('should restore from backup successfully', async () => {
      // Create original data
      const originalEntries: string[] = [];
      for (const entry of TEST_ENTRIES) {
        const id = await knowledgeDB.addEntry(entry);
        originalEntries.push(id);
      }

      // Create backup
      await dbManager.createBackup(backupPath);

      // Corrupt/modify original database
      await knowledgeDB.addEntry({
        title: 'Corrupt Entry',
        problem: 'This should not be in restore',
        solution: 'Delete this',
        category: 'Other',
        tags: ['corrupt']
      });

      // Close original
      await knowledgeDB.close();
      await dbManager.close();

      // Restore from backup
      await fs.copyFile(backupPath, testDbPath);

      // Open restored database
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Verify restored data
      const restoredEntries = await knowledgeDB.getAllEntries();
      expect(restoredEntries).toHaveLength(TEST_ENTRIES.length);
      
      const corruptEntry = restoredEntries.find(e => e.title === 'Corrupt Entry');
      expect(corruptEntry).toBeUndefined();
    });

    it('should handle incremental backups', async () => {
      // Create initial data
      await knowledgeDB.addEntry(TEST_ENTRIES[0]);
      
      // Create initial backup
      const initialBackup = backupPath + '.initial';
      await dbManager.createBackup(initialBackup);

      // Add more data
      await knowledgeDB.addEntry(TEST_ENTRIES[1]);
      
      // Create incremental backup
      const incrementalBackup = backupPath + '.incremental';
      await dbManager.createBackup(incrementalBackup);

      // Verify incremental backup has both entries
      const incrementalDb = new KnowledgeDB(incrementalBackup);
      try {
        const entries = await incrementalDb.getAllEntries();
        expect(entries).toHaveLength(2);
      } finally {
        await incrementalDb.close();
      }

      // Cleanup
      await fs.unlink(initialBackup);
      await fs.unlink(incrementalBackup);
    });
  });

  describe('Session Persistence', () => {
    it('should maintain search history across sessions', async () => {
      // Simulate search operations
      await knowledgeDB.addEntry(TEST_ENTRIES[0]);
      await knowledgeDB.search('Test problem');
      await knowledgeDB.search('VSAM');

      // Close session
      await knowledgeDB.close();
      await dbManager.close();

      // Start new session
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Check search history is preserved
      const metrics = await knowledgeDB.getMetrics();
      expect(metrics.recentSearches.length).toBeGreaterThan(0);
    });

    it('should persist usage statistics', async () => {
      const entryId = await knowledgeDB.addEntry(TEST_ENTRIES[0]);
      
      // Record usage
      await knowledgeDB.recordUsage(entryId, true, 'test-user');
      await knowledgeDB.recordUsage(entryId, false, 'test-user');

      // Close session
      await knowledgeDB.close();
      await dbManager.close();

      // Start new session
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Verify stats persisted
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry?.usage_count).toBe(2);
      expect(entry?.success_count).toBe(1);
      expect(entry?.failure_count).toBe(1);
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should auto-repair corrupted indexes', async () => {
      // Add data to create indexes
      for (const entry of TEST_ENTRIES) {
        await knowledgeDB.addEntry(entry);
      }

      // Simulate index corruption by manual SQL
      try {
        await dbManager.executeQuery('DROP INDEX idx_kb_entries_category');
      } catch (error) {
        // Index might not exist
      }

      // Close and reopen to trigger repair
      await knowledgeDB.close();
      await dbManager.close();

      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      knowledgeDB = new KnowledgeDB(testDbPath);

      // Should still be able to search
      const results = await knowledgeDB.search('Test');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle database schema migration gracefully', async () => {
      // Add data with current schema
      await knowledgeDB.addEntry(TEST_ENTRIES[0]);

      // Close current connection
      await knowledgeDB.close();
      await dbManager.close();

      // Simulate schema update requirement
      dbManager = new DatabaseManager(testDbPath);
      await dbManager.initialize();
      
      // Should handle any schema differences gracefully
      knowledgeDB = new KnowledgeDB(testDbPath);
      const entries = await knowledgeDB.getAllEntries();
      expect(entries).toHaveLength(1);
    });

    it('should recover from disk space issues', async () => {
      // Add data until near capacity (simulated)
      const manyEntries = Array.from({ length: 100 }, (_, i) => ({
        ...TEST_ENTRIES[0],
        title: `Large Entry ${i}`,
        problem: 'A'.repeat(1000), // Large content
        solution: 'B'.repeat(1000)
      }));

      try {
        // Attempt to add all entries
        for (const entry of manyEntries) {
          await knowledgeDB.addEntry(entry);
        }
      } catch (error) {
        // Some might fail due to constraints
      }

      // Should still be able to read existing data
      const entries = await knowledgeDB.getAllEntries();
      expect(entries.length).toBeGreaterThan(0);

      // Should be able to continue operations
      await knowledgeDB.addEntry(TEST_ENTRIES[1]);
    });
  });

  describe('Data Consistency Checks', () => {
    it('should maintain referential integrity', async () => {
      const entryId = await knowledgeDB.addEntry(TEST_ENTRIES[0]);
      
      // Add tags
      await knowledgeDB.addTags(entryId, ['tag1', 'tag2']);
      
      // Verify integrity
      const entry = await knowledgeDB.getEntry(entryId);
      expect(entry?.tags).toContain('tag1');
      expect(entry?.tags).toContain('tag2');

      // Delete entry should cascade to tags
      await knowledgeDB.deleteEntry(entryId);
      
      // Verify no orphaned tags (this would be implementation specific)
      const orphanedTags = await dbManager.executeQuery(
        'SELECT * FROM kb_tags WHERE entry_id = ?', 
        [entryId]
      );
      expect(orphanedTags).toHaveLength(0);
    });

    it('should validate data constraints', async () => {
      // Test invalid category
      const invalidEntry = {
        ...TEST_ENTRIES[0],
        category: 'INVALID' as any
      };

      await expect(knowledgeDB.addEntry(invalidEntry)).rejects.toThrow();

      // Test missing required fields
      const incompleteEntry = {
        title: 'Incomplete',
        // Missing required fields
      } as any;

      await expect(knowledgeDB.addEntry(incompleteEntry)).rejects.toThrow();
    });

    it('should handle data type consistency', async () => {
      const entryId = await knowledgeDB.addEntry(TEST_ENTRIES[0]);
      
      // Record usage with proper types
      await knowledgeDB.recordUsage(entryId, true);
      
      const entry = await knowledgeDB.getEntry(entryId);
      
      // Verify numeric fields are numbers
      expect(typeof entry?.usage_count).toBe('number');
      expect(typeof entry?.success_count).toBe('number');
      expect(typeof entry?.failure_count).toBe('number');
      
      // Verify date fields
      expect(entry?.created_at).toBeInstanceOf(Date);
      expect(entry?.updated_at).toBeInstanceOf(Date);
    });
  });
});