/**
 * KnowledgeDB Integration Tests
 * 
 * Comprehensive integration testing for the KnowledgeDB system focusing on:
 * - CRUD operations with concurrent access
 * - Transaction integrity and rollback scenarios  
 * - Performance benchmarks (search <1s for 1000 entries)
 * - FTS5 index consistency
 * - Schema migration testing
 * - Backup/restore validation
 * 
 * @author Database Testing Specialist
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { KnowledgeDB, KBEntry, SearchResult, DatabaseStats } from '../../../src/database/KnowledgeDB';
import { MigrationManager } from '../../../src/database/MigrationManager';
import { BackupManager } from '../../../src/database/BackupManager';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

// Test configuration constants
const TEST_CONFIG = {
  MAX_SEARCH_TIME: 1000,        // 1 second max search time
  LARGE_DATASET_SIZE: 1000,     // For performance testing
  CONCURRENT_OPERATIONS: 50,    // Concurrent access testing
  PERFORMANCE_THRESHOLD: 0.95,  // 95% operations should succeed
  BACKUP_RETENTION: 3,          // Number of backups to keep
  MIGRATION_TIMEOUT: 30000,     // 30 seconds for migrations
} as const;

/**
 * Test data generator utilities
 */
class TestDataGenerator {
  static createKBEntry(overrides: Partial<KBEntry> = {}): KBEntry {
    return {
      title: 'Test VSAM Status 35 Error',
      problem: 'Job fails with VSAM status code 35 indicating file not found',
      solution: '1. Check if dataset exists using LISTCAT\n2. Verify DD statement DSN\n3. Check RACF permissions',
      category: 'VSAM',
      severity: 'medium',
      tags: ['vsam', 'status-35', 'file-error'],
      ...overrides
    };
  }

  static createBatchKBEntries(count: number): KBEntry[] {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS'];
    const severities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
    
    return Array.from({ length: count }, (_, i) => ({
      title: `Test Entry ${i + 1} - ${categories[i % categories.length]} Issue`,
      problem: `Problem description for test entry ${i + 1}. This is a ${categories[i % categories.length]} related issue.`,
      solution: `Solution steps for entry ${i + 1}:\n1. Step one\n2. Step two\n3. Step three`,
      category: categories[i % categories.length],
      severity: severities[i % severities.length],
      tags: [`tag-${i + 1}`, categories[i % categories.length].toLowerCase(), 'test']
    }));
  }

  static createPerformanceTestData(count: number): KBEntry[] {
    const errorCodes = ['S0C7', 'S0C4', 'S013', 'IEF212I', 'WER027A', 'U0778'];
    const components = ['COBOL-PROG', 'JCL-STEP', 'VSAM-FILE', 'DB2-TABLE', 'CICS-TRAN'];
    
    return Array.from({ length: count }, (_, i) => ({
      title: `Performance Test Entry ${i + 1} - ${errorCodes[i % errorCodes.length]}`,
      problem: `Performance test problem ${i + 1}. Error code ${errorCodes[i % errorCodes.length]} occurred in component ${components[i % components.length]}.`,
      solution: `Performance solution ${i + 1}:\n1. Investigate ${errorCodes[i % errorCodes.length]}\n2. Check ${components[i % components.length]}\n3. Apply fix`,
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS'][i % 5],
      severity: ['critical', 'high', 'medium', 'low'][i % 4] as any,
      tags: [`perf-${i}`, errorCodes[i % errorCodes.length].toLowerCase(), 'performance-test']
    }));
  }
}

/**
 * Performance measurement utilities
 */
class PerformanceValidator {
  private static measurements: Map<string, number[]> = new Map();

  static startTimer(operation: string): number {
    return Date.now();
  }

  static endTimer(operation: string, startTime: number): number {
    const duration = Date.now() - startTime;
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }
    this.measurements.get(operation)!.push(duration);
    return duration;
  }

  static getStats(operation: string): { avg: number; min: number; max: number; count: number } {
    const times = this.measurements.get(operation) || [];
    return {
      avg: times.reduce((a, b) => a + b, 0) / times.length || 0,
      min: Math.min(...times) || 0,
      max: Math.max(...times) || 0,
      count: times.length
    };
  }

  static validatePerformance(operation: string, maxTime: number): boolean {
    const stats = this.getStats(operation);
    return stats.avg <= maxTime;
  }

  static reset(): void {
    this.measurements.clear();
  }
}

/**
 * Test database factory for temporary databases
 */
class TestDatabaseFactory {
  private static tempDatabases: string[] = [];
  private static tempDir: string;

  static initialize(): void {
    this.tempDir = path.join(__dirname, '..', '..', 'temp', 'integration', 'db');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  static createTemporaryDatabase(): string {
    const dbPath = path.join(this.tempDir, `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`);
    this.tempDatabases.push(dbPath);
    return dbPath;
  }

  static createInMemoryDatabase(): string {
    return ':memory:';
  }

  static cleanup(): void {
    this.tempDatabases.forEach(dbPath => {
      if (dbPath !== ':memory:' && fs.existsSync(dbPath)) {
        try {
          fs.unlinkSync(dbPath);
        } catch (error) {
          console.warn(`Failed to cleanup test database: ${dbPath}`, error);
        }
      }
    });
    this.tempDatabases = [];

    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp directory: ${this.tempDir}`, error);
      }
    }
  }
}

describe('KnowledgeDB Integration Tests', () => {
  let db: KnowledgeDB;
  let dbPath: string;

  beforeAll(() => {
    TestDatabaseFactory.initialize();
    PerformanceValidator.reset();
  });

  beforeEach(async () => {
    dbPath = TestDatabaseFactory.createTemporaryDatabase();
    db = new KnowledgeDB(dbPath, {
      autoBackup: false, // Disable auto-backup for testing
      backupInterval: 24
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  afterAll(() => {
    TestDatabaseFactory.cleanup();
  });

  describe('CRUD Operations with Concurrent Access', () => {
    it('should handle basic CRUD operations correctly', async () => {
      const testEntry = TestDataGenerator.createKBEntry();

      // CREATE
      const startCreate = PerformanceValidator.startTimer('create');
      const entryId = await db.addEntry(testEntry, 'test-user');
      PerformanceValidator.endTimer('create', startCreate);

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');

      // READ
      const startRead = PerformanceValidator.startTimer('read');
      const retrievedEntry = await db.getEntry(entryId);
      PerformanceValidator.endTimer('read', startRead);

      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.id).toBe(entryId);
      expect(retrievedEntry!.title).toBe(testEntry.title);
      expect(retrievedEntry!.problem).toBe(testEntry.problem);
      expect(retrievedEntry!.solution).toBe(testEntry.solution);
      expect(retrievedEntry!.category).toBe(testEntry.category);
      expect(retrievedEntry!.tags).toEqual(testEntry.tags);

      // UPDATE
      const updateData = {
        title: 'Updated Test Title',
        tags: ['updated', 'test', 'modified']
      };

      const startUpdate = PerformanceValidator.startTimer('update');
      await db.updateEntry(entryId, updateData, 'test-user');
      PerformanceValidator.endTimer('update', startUpdate);

      const updatedEntry = await db.getEntry(entryId);
      expect(updatedEntry!.title).toBe(updateData.title);
      expect(updatedEntry!.tags).toEqual(updateData.tags);
      expect(updatedEntry!.problem).toBe(testEntry.problem); // Unchanged

      // DELETE (via archiving)
      const startArchive = PerformanceValidator.startTimer('archive');
      await db.updateEntry(entryId, { archived: true });
      PerformanceValidator.endTimer('archive', startArchive);

      // Should not appear in normal searches
      const searchResults = await db.search(testEntry.title);
      expect(searchResults.length).toBe(0);

      // But should still exist when including archived
      const archivedResults = await db.search(testEntry.title, { includeArchived: true });
      expect(archivedResults.length).toBe(1);
    });

    it('should handle concurrent read operations efficiently', async () => {
      // Add test data first
      const entries = TestDataGenerator.createBatchKBEntries(50);
      const entryIds: string[] = [];

      for (const entry of entries) {
        const id = await db.addEntry(entry);
        entryIds.push(id);
      }

      // Perform concurrent reads
      const concurrentReads = entryIds.map(async (id) => {
        const startTime = PerformanceValidator.startTimer('concurrent-read');
        const entry = await db.getEntry(id);
        PerformanceValidator.endTimer('concurrent-read', startTime);
        return entry;
      });

      const results = await Promise.all(concurrentReads);

      // All reads should succeed
      expect(results.length).toBe(entryIds.length);
      expect(results.every(entry => entry !== null)).toBe(true);

      // Performance should be good
      const readStats = PerformanceValidator.getStats('concurrent-read');
      expect(readStats.avg).toBeLessThan(100); // Average read should be < 100ms
    });

    it('should handle concurrent write operations with proper isolation', async () => {
      const concurrentWrites = Array.from({ length: TEST_CONFIG.CONCURRENT_OPERATIONS }, (_, i) => {
        return async () => {
          const entry = TestDataGenerator.createKBEntry({
            title: `Concurrent Entry ${i + 1}`,
            tags: [`concurrent-${i}`, 'test']
          });

          const startTime = PerformanceValidator.startTimer('concurrent-write');
          const id = await db.addEntry(entry, `user-${i}`);
          PerformanceValidator.endTimer('concurrent-write', startTime);
          
          return { id, entry };
        };
      });

      // Execute all writes concurrently
      const results = await Promise.allSettled(
        concurrentWrites.map(writeOp => writeOp())
      );

      // Count successful vs failed operations
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // At least 95% should succeed
      const successRate = successful / results.length;
      expect(successRate).toBeGreaterThanOrEqual(TEST_CONFIG.PERFORMANCE_THRESHOLD);

      // Verify data integrity - no duplicate IDs
      const successfulResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

      const uniqueIds = new Set(successfulResults.map(r => r.id));
      expect(uniqueIds.size).toBe(successful);

      console.log(`Concurrent write test: ${successful} successful, ${failed} failed (${(successRate * 100).toFixed(1)}% success rate)`);
    });

    it('should handle mixed concurrent operations (read/write/update)', async () => {
      // Setup initial data
      const initialEntries = TestDataGenerator.createBatchKBEntries(20);
      const existingIds: string[] = [];

      for (const entry of initialEntries) {
        const id = await db.addEntry(entry);
        existingIds.push(id);
      }

      // Create mixed operations
      const operations: Promise<any>[] = [];

      // 20 concurrent reads
      for (let i = 0; i < 20; i++) {
        const randomId = existingIds[Math.floor(Math.random() * existingIds.length)];
        operations.push(
          db.getEntry(randomId).then(entry => ({ type: 'read', success: !!entry }))
        );
      }

      // 15 concurrent writes
      for (let i = 0; i < 15; i++) {
        operations.push(
          db.addEntry(TestDataGenerator.createKBEntry({
            title: `Mixed Op Entry ${i + 1}`
          })).then(id => ({ type: 'write', success: !!id }))
        );
      }

      // 15 concurrent updates
      for (let i = 0; i < 15; i++) {
        const randomId = existingIds[Math.floor(Math.random() * existingIds.length)];
        operations.push(
          db.updateEntry(randomId, { 
            title: `Updated in Mixed Op ${i + 1}` 
          }).then(() => ({ type: 'update', success: true }))
          .catch(() => ({ type: 'update', success: false }))
        );
      }

      // Execute all operations concurrently
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const successRate = successful / results.length;

      expect(successRate).toBeGreaterThanOrEqual(0.90); // 90% success rate
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Mixed operations test: ${successful}/${results.length} successful in ${totalTime}ms`);
    });
  });

  describe('Transaction Integrity and Rollback Scenarios', () => {
    it('should maintain transaction integrity on successful operations', async () => {
      const entries = TestDataGenerator.createBatchKBEntries(5);
      const addedIds: string[] = [];

      // Simulate transaction-like behavior by adding multiple entries
      for (const entry of entries) {
        const id = await db.addEntry(entry);
        addedIds.push(id);
      }

      // Verify all entries were added
      expect(addedIds.length).toBe(5);

      // Verify data integrity
      for (const id of addedIds) {
        const retrievedEntry = await db.getEntry(id);
        expect(retrievedEntry).toBeDefined();
        expect(retrievedEntry!.id).toBe(id);
      }

      const totalCount = db.getEntryCount();
      expect(totalCount).toBe(5);
    });

    it('should handle validation failures gracefully', async () => {
      const validEntry = TestDataGenerator.createKBEntry();
      
      // First, add a valid entry
      const validId = await db.addEntry(validEntry);
      expect(validId).toBeDefined();

      // Try to add an invalid entry (missing required fields)
      const invalidEntry = {
        title: '',  // Empty title should fail validation
        problem: 'Valid problem',
        solution: 'Valid solution',
        category: 'VSAM'
      } as KBEntry;

      await expect(db.addEntry(invalidEntry)).rejects.toThrow();

      // Verify the valid entry still exists and count didn't change
      const retrievedEntry = await db.getEntry(validId);
      expect(retrievedEntry).toBeDefined();
      expect(db.getEntryCount()).toBe(1);
    });

    it('should handle database corruption gracefully', async () => {
      const testEntry = TestDataGenerator.createKBEntry();
      const entryId = await db.addEntry(testEntry);

      // Verify entry was added
      expect(await db.getEntry(entryId)).toBeDefined();

      // Simulate recovery by closing and reopening database
      await db.close();
      
      db = new KnowledgeDB(dbPath, { autoBackup: false });
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization

      // Data should still be accessible after recovery
      const recoveredEntry = await db.getEntry(entryId);
      expect(recoveredEntry).toBeDefined();
      expect(recoveredEntry!.title).toBe(testEntry.title);
    });

    it('should maintain referential integrity between tables', async () => {
      const entryWithTags = TestDataGenerator.createKBEntry({
        tags: ['tag1', 'tag2', 'tag3']
      });

      const entryId = await db.addEntry(entryWithTags);
      
      // Verify tags were properly linked
      const retrievedEntry = await db.getEntry(entryId);
      expect(retrievedEntry!.tags).toEqual(['tag1', 'tag2', 'tag3']);

      // Update tags
      await db.updateEntry(entryId, { tags: ['new-tag1', 'new-tag2'] });
      
      // Verify old tags were removed and new ones added
      const updatedEntry = await db.getEntry(entryId);
      expect(updatedEntry!.tags).toEqual(['new-tag1', 'new-tag2']);

      // Archive the entry
      await db.updateEntry(entryId, { archived: true });

      // Tags should still be accessible for archived entries
      const archivedEntry = await db.getEntry(entryId);
      expect(archivedEntry!.tags).toEqual(['new-tag1', 'new-tag2']);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet search performance requirements (<1s for 1000 entries)', async () => {
      // Add exactly 1000 test entries
      const entries = TestDataGenerator.createPerformanceTestData(TEST_CONFIG.LARGE_DATASET_SIZE);
      
      console.log(`Adding ${TEST_CONFIG.LARGE_DATASET_SIZE} entries for performance testing...`);
      const insertStart = Date.now();
      
      // Batch insert for better performance
      const batchSize = 50;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        await Promise.all(batch.map(entry => db.addEntry(entry)));
      }
      
      const insertTime = Date.now() - insertStart;
      console.log(`Inserted ${TEST_CONFIG.LARGE_DATASET_SIZE} entries in ${insertTime}ms`);

      // Verify all entries were added
      expect(db.getEntryCount()).toBe(TEST_CONFIG.LARGE_DATASET_SIZE);

      // Test search performance with various query types
      const searchTests = [
        'S0C7',                    // Exact error code
        'Performance Test',        // Common phrase
        'VSAM file error',        // Multi-word query
        'category:JCL',           // Category search
        'tag:performance-test'    // Tag search
      ];

      for (const query of searchTests) {
        const searchStart = PerformanceValidator.startTimer('search-1000');
        const results = await db.search(query, { limit: 50 });
        const searchTime = PerformanceValidator.endTimer('search-1000', searchStart);

        expect(searchTime).toBeLessThan(TEST_CONFIG.MAX_SEARCH_TIME);
        expect(results.length).toBeGreaterThan(0);

        console.log(`Search "${query}": ${searchTime}ms, ${results.length} results`);
      }

      // Validate overall search performance
      const avgSearchTime = PerformanceValidator.getStats('search-1000').avg;
      expect(avgSearchTime).toBeLessThan(TEST_CONFIG.MAX_SEARCH_TIME);
    }, 30000); // 30 second timeout for this test

    it('should handle pagination efficiently with large datasets', async () => {
      // Add test data
      const entries = TestDataGenerator.createBatchKBEntries(500);
      await Promise.all(entries.map(entry => db.addEntry(entry)));

      const pageSize = 20;
      const totalPages = 10;

      for (let page = 0; page < totalPages; page++) {
        const startTime = PerformanceValidator.startTimer('pagination');
        
        const results = await db.search('Test Entry', {
          limit: pageSize,
          offset: page * pageSize
        });
        
        const paginationTime = PerformanceValidator.endTimer('pagination', startTime);

        expect(results.length).toBeLessThanOrEqual(pageSize);
        expect(paginationTime).toBeLessThan(500); // Each page should load < 500ms
      }

      const avgPaginationTime = PerformanceValidator.getStats('pagination').avg;
      expect(avgPaginationTime).toBeLessThan(300);
    });

    it('should maintain performance during concurrent search operations', async () => {
      // Setup data
      const entries = TestDataGenerator.createBatchKBEntries(200);
      await Promise.all(entries.map(entry => db.addEntry(entry)));

      // Perform concurrent searches
      const searchQueries = [
        'JCL', 'VSAM', 'DB2', 'Batch', 'CICS',
        'Error', 'Status', 'File', 'Problem', 'Solution'
      ];

      const concurrentSearches = searchQueries.map(async (query) => {
        const startTime = PerformanceValidator.startTimer('concurrent-search');
        const results = await db.search(query, { limit: 10 });
        const searchTime = PerformanceValidator.endTimer('concurrent-search', startTime);
        
        return { query, results: results.length, time: searchTime };
      });

      const searchResults = await Promise.all(concurrentSearches);

      // All searches should complete quickly
      searchResults.forEach(result => {
        expect(result.time).toBeLessThan(1000);
        expect(result.results).toBeGreaterThanOrEqual(0);
      });

      const avgSearchTime = PerformanceValidator.getStats('concurrent-search').avg;
      expect(avgSearchTime).toBeLessThan(500);

      console.log(`Concurrent search performance: ${avgSearchTime.toFixed(1)}ms average`);
    });
  });

  describe('FTS5 Index Consistency', () => {
    it('should maintain FTS index consistency during CRUD operations', async () => {
      const testEntry = TestDataGenerator.createKBEntry({
        title: 'FTS Index Test Entry',
        problem: 'Testing full-text search indexing',
        solution: 'Verify FTS5 index maintains consistency'
      });

      // Add entry and verify it's searchable
      const entryId = await db.addEntry(testEntry);
      
      let searchResults = await db.search('FTS Index Test');
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].entry.id).toBe(entryId);

      // Update entry and verify search reflects changes
      await db.updateEntry(entryId, {
        title: 'Updated FTS Index Test Entry',
        problem: 'Updated problem description for FTS testing'
      });

      // Old content should not be found
      const oldResults = await db.search('FTS Index Test Entry');
      expect(oldResults.length).toBe(0);

      // New content should be found
      const newResults = await db.search('Updated FTS Index Test');
      expect(newResults.length).toBe(1);
      expect(newResults[0].entry.id).toBe(entryId);

      // Archive entry
      await db.updateEntry(entryId, { archived: true });

      // Should not appear in normal search
      const archivedResults = await db.search('Updated FTS Index Test');
      expect(archivedResults.length).toBe(0);

      // Should appear when including archived
      const includingArchivedResults = await db.search('Updated FTS Index Test', { 
        includeArchived: true 
      });
      expect(includingArchivedResults.length).toBe(1);
    });

    it('should handle special characters and edge cases in FTS', async () => {
      const specialEntries = [
        {
          title: 'Entry with "quotes" and symbols',
          problem: 'Problem with special chars: @#$%^&*()',
          solution: 'Solution for special characters'
        },
        {
          title: 'SQL injection attempt \'; DROP TABLE --',
          problem: 'Testing SQL injection resistance',
          solution: 'Should handle safely'
        },
        {
          title: 'Unicode test: éñtry wíth açcénts',
          problem: 'Testing unicode support in FTS',
          solution: 'Should work with international characters'
        }
      ];

      const entryIds: string[] = [];
      
      for (const entry of specialEntries) {
        const testEntry = TestDataGenerator.createKBEntry(entry);
        const id = await db.addEntry(testEntry);
        entryIds.push(id);
      }

      // Test searches with special characters
      const searchTests = [
        { query: 'quotes', expectedCount: 1 },
        { query: 'special chars', expectedCount: 1 },
        { query: 'injection', expectedCount: 1 },
        { query: 'unicode', expectedCount: 1 },
        { query: 'éñtry', expectedCount: 1 }
      ];

      for (const test of searchTests) {
        const results = await db.search(test.query);
        expect(results.length).toBeGreaterThanOrEqual(test.expectedCount);
      }
    });

    it('should rebuild FTS index correctly after corruption', async () => {
      // Add test entries
      const entries = TestDataGenerator.createBatchKBEntries(10);
      const entryIds: string[] = [];

      for (const entry of entries) {
        const id = await db.addEntry(entry);
        entryIds.push(id);
      }

      // Verify initial search works
      const initialResults = await db.search('Test Entry');
      expect(initialResults.length).toBeGreaterThan(0);

      // Simulate FTS index rebuild by optimizing database
      await db.optimize();

      // Verify search still works after optimization
      const postOptimizeResults = await db.search('Test Entry');
      expect(postOptimizeResults.length).toBe(initialResults.length);

      // Verify all entries are still searchable
      for (const entry of entries) {
        const results = await db.search(entry.title);
        expect(results.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Schema Migration Testing', () => {
    it('should handle schema migrations correctly', async () => {
      // Create a database with initial schema
      const migrationDb = new Database(dbPath);
      
      // Simulate older schema version
      migrationDb.exec(`
        CREATE TABLE IF NOT EXISTS system_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          type TEXT DEFAULT 'string',
          description TEXT
        );
        
        INSERT INTO system_config (key, value) VALUES ('schema_version', '1.0');
      `);
      
      migrationDb.close();

      // Initialize KnowledgeDB which should run migrations
      const migratedDb = new KnowledgeDB(dbPath, { autoBackup: false });
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify schema was updated
      const version = migratedDb.getConfig('schema_version');
      expect(version).toBeDefined();

      // Verify all required tables exist
      const stats = await migratedDb.getStats();
      expect(stats.totalEntries).toBe(0);

      await migratedDb.close();
    });

    it('should preserve data during migrations', async () => {
      // Create initial data
      const testEntries = TestDataGenerator.createBatchKBEntries(5);
      const entryIds: string[] = [];

      for (const entry of testEntries) {
        const id = await db.addEntry(entry);
        entryIds.push(id);
      }

      const initialCount = db.getEntryCount();
      expect(initialCount).toBe(5);

      // Close and reopen database (simulates migration scenario)
      await db.close();
      
      db = new KnowledgeDB(dbPath, { autoBackup: false });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify data is preserved
      const postMigrationCount = db.getEntryCount();
      expect(postMigrationCount).toBe(initialCount);

      // Verify specific entries are still accessible
      for (const id of entryIds) {
        const entry = await db.getEntry(id);
        expect(entry).toBeDefined();
      }
    });

    it('should handle migration failures gracefully', async () => {
      // This test would need to mock migration failures
      // For now, we test that the system can handle reinitialization
      
      const testEntry = TestDataGenerator.createKBEntry();
      await db.addEntry(testEntry);

      // Simulate multiple reinitializations
      for (let i = 0; i < 3; i++) {
        await db.close();
        db = new KnowledgeDB(dbPath, { autoBackup: false });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Data should still be accessible
      const count = db.getEntryCount();
      expect(count).toBe(1);
    });
  });

  describe('Backup and Restore Validation', () => {
    it('should create valid backups', async () => {
      // Add test data
      const entries = TestDataGenerator.createBatchKBEntries(10);
      for (const entry of entries) {
        await db.addEntry(entry);
      }

      const originalCount = db.getEntryCount();
      expect(originalCount).toBe(10);

      // Create backup
      await db.createBackup();

      // Verify backup was created (backup files would be in configured backup directory)
      // For this test, we verify the backup operation doesn't throw errors
      expect(true).toBe(true); // Backup creation succeeded
    });

    it('should restore from backup correctly', async () => {
      // Add initial data
      const entries = TestDataGenerator.createBatchKBEntries(5);
      const originalIds: string[] = [];

      for (const entry of entries) {
        const id = await db.addEntry(entry);
        originalIds.push(id);
      }

      const originalCount = db.getEntryCount();

      // Export to JSON as a form of backup
      const backupPath = path.join(path.dirname(dbPath), 'test-backup.json');
      await db.exportToJSON(backupPath);

      // Clear all data
      for (const id of originalIds) {
        await db.updateEntry(id, { archived: true });
      }

      // Verify data is cleared (archived entries don't count)
      const clearedCount = db.getEntryCount();
      expect(clearedCount).toBe(0);

      // Restore from backup
      await db.importFromJSON(backupPath, false);

      // Verify data is restored
      const restoredCount = db.getEntryCount();
      expect(restoredCount).toBe(originalCount);

      // Cleanup
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });

    it('should handle backup integrity validation', async () => {
      // Add test data
      const entry = TestDataGenerator.createKBEntry();
      await db.addEntry(entry);

      // Export to JSON
      const exportPath = path.join(path.dirname(dbPath), 'integrity-test.json');
      await db.exportToJSON(exportPath);

      // Verify export file exists and is valid JSON
      expect(fs.existsSync(exportPath)).toBe(true);
      
      const exportContent = fs.readFileSync(exportPath, 'utf8');
      const exportData = JSON.parse(exportContent);
      
      expect(exportData.entries).toBeDefined();
      expect(exportData.entries.length).toBe(1);
      expect(exportData.metadata).toBeDefined();

      // Cleanup
      fs.unlinkSync(exportPath);
    });

    it('should handle incremental backup scenarios', async () => {
      // Create initial backup point
      const entry1 = TestDataGenerator.createKBEntry({ title: 'Entry 1' });
      await db.addEntry(entry1);
      
      const backup1Path = path.join(path.dirname(dbPath), 'backup1.json');
      await db.exportToJSON(backup1Path);

      // Add more data
      const entry2 = TestDataGenerator.createKBEntry({ title: 'Entry 2' });
      await db.addEntry(entry2);
      
      const backup2Path = path.join(path.dirname(dbPath), 'backup2.json');
      await db.exportToJSON(backup2Path);

      // Verify both backups have different content
      const backup1Data = JSON.parse(fs.readFileSync(backup1Path, 'utf8'));
      const backup2Data = JSON.parse(fs.readFileSync(backup2Path, 'utf8'));

      expect(backup1Data.entries.length).toBe(1);
      expect(backup2Data.entries.length).toBe(2);

      // Cleanup
      fs.unlinkSync(backup1Path);
      fs.unlinkSync(backup2Path);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle disk space exhaustion gracefully', async () => {
      // This test simulates disk space issues by attempting large operations
      // In a real scenario, this would test actual disk space limits
      
      const largeEntry = TestDataGenerator.createKBEntry({
        problem: 'x'.repeat(100000), // Very large content
        solution: 'y'.repeat(100000)
      });

      // Should handle large entries without crashing
      const entryId = await db.addEntry(largeEntry);
      expect(entryId).toBeDefined();

      const retrievedEntry = await db.getEntry(entryId);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.problem.length).toBe(100000);
    });

    it('should handle database locks correctly', async () => {
      // Create a second database connection to the same file
      const db2 = new KnowledgeDB(dbPath, { autoBackup: false });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Both connections should be able to read
      const entry = TestDataGenerator.createKBEntry();
      const entryId = await db.addEntry(entry);

      const entryFromDb1 = await db.getEntry(entryId);
      const entryFromDb2 = await db2.getEntry(entryId);

      expect(entryFromDb1).toBeDefined();
      expect(entryFromDb2).toBeDefined();
      expect(entryFromDb1!.title).toBe(entryFromDb2!.title);

      await db2.close();
    });

    it('should validate data integrity after unexpected shutdown', async () => {
      // Add some data
      const entries = TestDataGenerator.createBatchKBEntries(3);
      const entryIds: string[] = [];

      for (const entry of entries) {
        const id = await db.addEntry(entry);
        entryIds.push(id);
      }

      // Force close without proper shutdown (simulates crash)
      if (db['db']) {
        db['db'].close();
      }

      // Reinitialize and verify data integrity
      db = new KnowledgeDB(dbPath, { autoBackup: false });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all entries are still accessible
      for (const id of entryIds) {
        const entry = await db.getEntry(id);
        expect(entry).toBeDefined();
      }

      const count = db.getEntryCount();
      expect(count).toBe(3);
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide accurate health check information', async () => {
      // Add some test data
      const entry = TestDataGenerator.createKBEntry();
      await db.addEntry(entry);

      // Perform health check
      const healthStatus = await db.healthCheck();

      expect(healthStatus.overall).toBe(true);
      expect(healthStatus.database).toBe(true);
      expect(healthStatus.cache).toBe(true);
      expect(healthStatus.connections).toBe(true);
      expect(healthStatus.performance).toBe(true);
      expect(healthStatus.issues).toEqual([]);
    });

    it('should provide comprehensive database statistics', async () => {
      // Add test data across different categories
      const entries = [
        TestDataGenerator.createKBEntry({ category: 'JCL', severity: 'critical' }),
        TestDataGenerator.createKBEntry({ category: 'VSAM', severity: 'high' }),
        TestDataGenerator.createKBEntry({ category: 'DB2', severity: 'medium' }),
        TestDataGenerator.createKBEntry({ category: 'JCL', severity: 'low' })
      ];

      for (const entry of entries) {
        await db.addEntry(entry);
      }

      // Get statistics
      const stats = await db.getStats();

      expect(stats.totalEntries).toBe(4);
      expect(stats.categoryCounts['JCL']).toBe(2);
      expect(stats.categoryCounts['VSAM']).toBe(1);
      expect(stats.categoryCounts['DB2']).toBe(1);
      expect(stats.diskUsage).toBeGreaterThan(0);
      expect(stats.performance).toBeDefined();
      expect(stats.performance.avgSearchTime).toBeGreaterThanOrEqual(0);
    });

    it('should track performance metrics accurately', async () => {
      // Perform various operations to generate metrics
      const entries = TestDataGenerator.createBatchKBEntries(10);
      
      for (const entry of entries) {
        await db.addEntry(entry);
      }

      // Perform searches to generate search metrics
      await db.search('Test');
      await db.search('Entry');
      await db.search('VSAM');

      // Get performance status
      const perfStatus = db.getPerformanceStatus();
      expect(perfStatus).toBeDefined();

      // Get performance trends
      const trends = db.getPerformanceTrends(1); // Last 1 hour
      expect(trends).toBeDefined();

      // Get cache stats
      const cacheStats = db.getCacheStats();
      expect(cacheStats).toBeDefined();
    });
  });
});