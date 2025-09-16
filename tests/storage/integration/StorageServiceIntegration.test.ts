/**
 * Integration Tests for Storage Service
 * Tests full end-to-end functionality with real dependencies
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { StorageService } from '../../../src/services/storage/StorageService';
import { SQLiteAdapter } from '../../../src/services/storage/adapters/SQLiteAdapter';
import { BackupService } from '../../../src/services/storage/backup/BackupService';
import { ExportService } from '../../../src/services/storage/export/ExportService';
import { ImportService } from '../../../src/services/storage/export/ImportService';
import { AnalyticsPlugin } from '../../../src/services/storage/plugins/AnalyticsPlugin';
import { StorageConfig } from '../../../src/services/storage/IStorageService';
import { createMockConfig, createTestKBEntry, SAMPLE_KB_ENTRIES, TestData } from '../fixtures/testData';
import * as fs from 'fs';
import * as path from 'path';

describe('Storage Service Integration Tests', () => {
  let storageService: StorageService;
  let backupService: BackupService;
  let exportService: ExportService;
  let importService: ImportService;
  let config: StorageConfig;
  let testDir: string;
  let dbPath: string;

  beforeAll(() => {
    // Create test directory
    testDir = path.join(__dirname, '..', 'temp', 'integration');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Create unique database for each test
    dbPath = path.join(testDir, `test-${Date.now()}.db`);
    
    config = createMockConfig({
      database: {
        type: 'sqlite',
        path: dbPath,
        pragmas: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          foreign_keys: 'ON'
        }
      },
      backup: {
        enabled: true,
        interval: 60000, // 1 minute for testing
        retention: 3,
        compression: true,
        destinations: [{
          type: 'local',
          path: path.join(testDir, 'backups')
        }]
      }
    });

    storageService = new StorageService(config);
    await storageService.initialize();

    // Initialize additional services
    backupService = new BackupService(storageService, config.backup);
    exportService = new ExportService(storageService);
    importService = new ImportService(storageService);
  });

  afterEach(async () => {
    await storageService.close();
    
    // Cleanup test files
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  afterAll(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Full Workflow Integration', () => {
    it('should handle complete CRUD workflow', async () => {
      // Add multiple entries
      const entryInputs = TestData.createBatchKBEntries(5);
      const addedEntries = [];

      for (const input of entryInputs) {
        const entry = await storageService.addEntry(input);
        addedEntries.push(entry);
        expect(entry.id).toBeDefined();
        expect(entry.title).toBe(input.title);
      }

      // Search for entries
      const searchResults = await storageService.search('Batch Entry');
      expect(searchResults.length).toBeGreaterThan(0);

      // Update an entry
      const entryToUpdate = addedEntries[0];
      const updatedEntry = await storageService.updateEntry(entryToUpdate.id!, {
        title: 'Updated Batch Entry',
        tags: ['updated', 'test']
      });

      expect(updatedEntry).toBeDefined();
      expect(updatedEntry!.title).toBe('Updated Batch Entry');
      expect(updatedEntry!.tags).toContain('updated');

      // Search for updated entry
      const updatedResults = await storageService.search('Updated Batch Entry');
      expect(updatedResults.length).toBe(1);
      expect(updatedResults[0].entry.id).toBe(entryToUpdate.id);

      // Delete an entry
      await storageService.deleteEntry(entryToUpdate.id!);

      // Verify deletion
      const deletedEntry = await storageService.getEntry(entryToUpdate.id!);
      expect(deletedEntry).toBeNull();

      // Verify remaining entries
      const remainingResults = await storageService.search('Batch Entry');
      expect(remainingResults.length).toBe(4); // 5 - 1 deleted
    });

    it('should handle search with complex filters', async () => {
      // Add sample data
      for (const entry of SAMPLE_KB_ENTRIES) {
        await storageService.addEntry(entry);
      }

      // Test category filtering
      const vsamResults = await storageService.search('', {
        filters: { category: 'VSAM' }
      });
      expect(vsamResults.length).toBe(1);
      expect(vsamResults[0].entry.category).toBe('VSAM');

      // Test tag filtering
      const abendResults = await storageService.search('', {
        filters: { tags: ['abend'] }
      });
      expect(abendResults.length).toBeGreaterThan(0);
      expect(abendResults.every(r => r.entry.tags?.includes('abend'))).toBe(true);

      // Test combined filtering
      const combinedResults = await storageService.search('error', {
        filters: {
          category: 'JCL',
          tags: ['syntax-error']
        }
      });
      expect(combinedResults.length).toBe(1);
      expect(combinedResults[0].entry.category).toBe('JCL');
      expect(combinedResults[0].entry.tags).toContain('syntax-error');

      // Test pagination
      const firstPage = await storageService.search('', {
        limit: 2,
        offset: 0
      });
      const secondPage = await storageService.search('', {
        limit: 2,
        offset: 2
      });

      expect(firstPage.length).toBeLessThanOrEqual(2);
      expect(secondPage.length).toBeLessThanOrEqual(2);
      expect(firstPage[0].entry.id).not.toBe(secondPage[0]?.entry.id);
    });

    it('should handle batch operations efficiently', async () => {
      const batchSize = 20;
      const entries = TestData.createBatchKBEntries(batchSize);

      // Batch insert
      const startTime = Date.now();
      const insertedEntries = await storageService.batchInsert(entries);
      const insertTime = Date.now() - startTime;

      expect(insertedEntries.length).toBe(batchSize);
      expect(insertedEntries.every(e => e.id)).toBe(true);

      // Batch update
      const updates = insertedEntries.slice(0, 10).map(entry => ({
        id: entry.id!,
        data: { title: `Updated ${entry.title}` }
      }));

      const updatedEntries = await storageService.batchUpdate(updates);
      expect(updatedEntries.length).toBe(10);
      expect(updatedEntries.every(e => e.title.startsWith('Updated'))).toBe(true);

      // Batch delete
      const idsToDelete = insertedEntries.slice(10, 15).map(e => e.id!);
      await storageService.batchDelete(idsToDelete);

      // Verify deletions
      for (const id of idsToDelete) {
        const entry = await storageService.getEntry(id);
        expect(entry).toBeNull();
      }

      // Verify remaining entries
      const remainingCount = await storageService.getTotalCount();
      expect(remainingCount).toBe(batchSize - 5); // 20 - 5 deleted

      // Performance check - batch operations should be reasonably fast
      expect(insertTime).toBeLessThan(5000); // Less than 5 seconds for 20 entries
    });
  });

  describe('Plugin Integration', () => {
    it('should integrate with analytics plugin', async () => {
      const analyticsPlugin = new AnalyticsPlugin();
      storageService.registerPlugin(analyticsPlugin);
      await analyticsPlugin.initialize();

      // Perform operations that should be tracked
      const entry = await storageService.addEntry(createTestKBEntry());
      await storageService.search('test query');
      await storageService.updateEntry(entry.id!, { title: 'Updated Title' });

      // Get analytics data
      const analytics = await analyticsPlugin.getAnalytics();
      
      expect(analytics.totalOperations).toBeGreaterThan(0);
      expect(analytics.operationBreakdown.add).toBe(1);
      expect(analytics.operationBreakdown.search).toBe(1);
      expect(analytics.operationBreakdown.update).toBe(1);

      await analyticsPlugin.cleanup();
    });

    it('should handle plugin failures gracefully', async () => {
      // Create a plugin that fails during operations
      const failingPlugin = {
        name: 'FailingPlugin',
        version: '1.0.0',
        description: 'Plugin that fails for testing',
        isInitialized: false,
        isEnabled: true,

        async initialize() { this.isInitialized = true; },
        async cleanup() { this.isInitialized = false; },
        
        async beforeAdd() { 
          throw new Error('Plugin beforeAdd failed'); 
        },
        async afterAdd() { 
          throw new Error('Plugin afterAdd failed'); 
        }
      };

      storageService.registerPlugin(failingPlugin);

      // Operation should still succeed despite plugin failures
      const entry = await storageService.addEntry(createTestKBEntry());
      expect(entry.id).toBeDefined();
    });

    it('should respect plugin dependencies', async () => {
      // Create plugins with dependencies
      const corePlugin = {
        name: 'CorePlugin',
        version: '1.0.0',
        description: 'Core plugin',
        isInitialized: false,
        isEnabled: true,
        dependencies: [],

        async initialize() { this.isInitialized = true; },
        async cleanup() { this.isInitialized = false; }
      };

      const dependentPlugin = {
        name: 'DependentPlugin',
        version: '1.0.0',
        description: 'Plugin that depends on Core',
        isInitialized: false,
        isEnabled: true,
        dependencies: ['CorePlugin'],

        async initialize() { 
          if (!this.areDependenciesSatisfied(['CorePlugin'])) {
            throw new Error('Dependencies not satisfied');
          }
          this.isInitialized = true; 
        },
        async cleanup() { this.isInitialized = false; },
        
        areDependenciesSatisfied(available: string[]) {
          return this.dependencies.every(dep => available.includes(dep));
        }
      };

      // Register core plugin first
      storageService.registerPlugin(corePlugin);
      await corePlugin.initialize();

      // Register dependent plugin
      storageService.registerPlugin(dependentPlugin);
      await dependentPlugin.initialize();

      expect(corePlugin.isInitialized).toBe(true);
      expect(dependentPlugin.isInitialized).toBe(true);
    });
  });

  describe('Backup and Restore Integration', () => {
    it('should create and restore from backup', async () => {
      // Add sample data
      for (const entry of SAMPLE_KB_ENTRIES) {
        await storageService.addEntry(entry);
      }

      const originalCount = await storageService.getTotalCount();
      expect(originalCount).toBe(SAMPLE_KB_ENTRIES.length);

      // Create backup
      const backupPath = await backupService.createBackup();
      expect(fs.existsSync(backupPath)).toBe(true);

      // Clear database
      const allEntries = await storageService.search('', { limit: 100 });
      for (const result of allEntries) {
        await storageService.deleteEntry(result.entry.id!);
      }

      const clearedCount = await storageService.getTotalCount();
      expect(clearedCount).toBe(0);

      // Restore from backup
      await backupService.restoreFromBackup(backupPath);

      const restoredCount = await storageService.getTotalCount();
      expect(restoredCount).toBe(originalCount);

      // Verify data integrity
      const restoredResults = await storageService.search('VSAM Status 35');
      expect(restoredResults.length).toBe(1);
      expect(restoredResults[0].entry.title).toBe('VSAM Status 35 - File Not Found');
    });

    it('should handle incremental backups', async () => {
      // Initial data
      await storageService.addEntry(SAMPLE_KB_ENTRIES[0]);
      const backup1 = await backupService.createBackup();

      // Add more data
      await storageService.addEntry(SAMPLE_KB_ENTRIES[1]);
      const backup2 = await backupService.createBackup();

      expect(fs.existsSync(backup1)).toBe(true);
      expect(fs.existsSync(backup2)).toBe(true);

      // Backup files should be different sizes
      const backup1Stats = fs.statSync(backup1);
      const backup2Stats = fs.statSync(backup2);
      expect(backup2Stats.size).toBeGreaterThan(backup1Stats.size);
    });
  });

  describe('Import/Export Integration', () => {
    it('should export and import JSON format', async () => {
      // Add sample data
      for (const entry of SAMPLE_KB_ENTRIES) {
        await storageService.addEntry(entry);
      }

      // Export to JSON
      const exportPath = path.join(testDir, 'export.json');
      await exportService.exportToFile(exportPath, 'json');

      expect(fs.existsSync(exportPath)).toBe(true);

      // Verify export content
      const exportedData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(exportedData.entries).toHaveLength(SAMPLE_KB_ENTRIES.length);
      expect(exportedData.metadata).toBeDefined();
      expect(exportedData.metadata.version).toBeDefined();

      // Clear database
      const allEntries = await storageService.search('', { limit: 100 });
      for (const result of allEntries) {
        await storageService.deleteEntry(result.entry.id!);
      }

      // Import from JSON
      const importResult = await importService.importFromFile(exportPath, 'json');
      
      expect(importResult.success).toBe(true);
      expect(importResult.entriesImported).toBe(SAMPLE_KB_ENTRIES.length);
      expect(importResult.errors).toHaveLength(0);

      // Verify imported data
      const importedCount = await storageService.getTotalCount();
      expect(importedCount).toBe(SAMPLE_KB_ENTRIES.length);

      const searchResult = await storageService.search('VSAM');
      expect(searchResult.length).toBe(1);
    });

    it('should export and import CSV format', async () => {
      // Add sample data
      for (const entry of SAMPLE_KB_ENTRIES.slice(0, 3)) {
        await storageService.addEntry(entry);
      }

      // Export to CSV
      const exportPath = path.join(testDir, 'export.csv');
      await exportService.exportToFile(exportPath, 'csv');

      expect(fs.existsSync(exportPath)).toBe(true);

      // Verify CSV format
      const csvContent = fs.readFileSync(exportPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      expect(lines.length).toBe(4); // 3 entries + header

      // Clear database
      const allEntries = await storageService.search('', { limit: 100 });
      for (const result of allEntries) {
        await storageService.deleteEntry(result.entry.id!);
      }

      // Import from CSV
      const importResult = await importService.importFromFile(exportPath, 'csv');
      
      expect(importResult.success).toBe(true);
      expect(importResult.entriesImported).toBe(3);

      const importedCount = await storageService.getTotalCount();
      expect(importedCount).toBe(3);
    });

    it('should handle import validation errors', async () => {
      // Create invalid CSV content
      const invalidCsvPath = path.join(testDir, 'invalid.csv');
      const invalidContent = `title,problem,solution,category,tags
"Valid Title","Valid Problem","Valid Solution","JCL","tag1,tag2"
"","Invalid - Empty Title","Valid Solution","VSAM","tag3"
"Valid Title 2",,"Invalid - Empty Problem","DB2","tag4"`;

      fs.writeFileSync(invalidCsvPath, invalidContent);

      // Import should handle validation errors
      const importResult = await importService.importFromFile(invalidCsvPath, 'csv');
      
      expect(importResult.success).toBe(false);
      expect(importResult.entriesImported).toBe(1); // Only the valid entry
      expect(importResult.errors.length).toBe(2); // Two validation errors
    });
  });

  describe('Performance Integration', () => {
    it('should handle large dataset operations', async () => {
      const largeDataset = TestData.createPerformanceTestData(1000);
      
      // Batch insert large dataset
      const insertStart = Date.now();
      const chunks = [];
      const chunkSize = 50;
      
      for (let i = 0; i < largeDataset.length; i += chunkSize) {
        const chunk = largeDataset.slice(i, i + chunkSize);
        chunks.push(chunk);
      }

      for (const chunk of chunks) {
        await storageService.batchInsert(chunk);
      }
      
      const insertTime = Date.now() - insertStart;
      
      // Verify all entries were inserted
      const totalCount = await storageService.getTotalCount();
      expect(totalCount).toBe(1000);

      // Test search performance
      const searchStart = Date.now();
      const searchResults = await storageService.search('Performance Test', { limit: 50 });
      const searchTime = Date.now() - searchStart;

      expect(searchResults.length).toBe(50);
      expect(searchTime).toBeLessThan(1000); // Should be fast even with large dataset

      // Test pagination performance
      const paginationStart = Date.now();
      const page1 = await storageService.search('', { limit: 20, offset: 0 });
      const page2 = await storageService.search('', { limit: 20, offset: 20 });
      const page3 = await storageService.search('', { limit: 20, offset: 40 });
      const paginationTime = Date.now() - paginationStart;

      expect(page1.length).toBe(20);
      expect(page2.length).toBe(20);
      expect(page3.length).toBe(20);
      expect(paginationTime).toBeLessThan(2000);

      // Performance should be reasonable
      expect(insertTime).toBeLessThan(30000); // Less than 30 seconds for 1000 entries
      console.log(`Performance metrics:
        - Insert time: ${insertTime}ms for 1000 entries
        - Search time: ${searchTime}ms
        - Pagination time: ${paginationTime}ms for 3 pages`);
    });

    it('should maintain performance under concurrent operations', async () => {
      const concurrentOperations = 20;
      const operationsPerType = 5;

      // Prepare test data
      const testEntries = TestData.createBatchKBEntries(operationsPerType);
      
      // Add initial data
      for (const entry of testEntries) {
        await storageService.addEntry(entry);
      }

      const startTime = Date.now();

      // Run concurrent operations
      const operations = [];

      // Concurrent searches
      for (let i = 0; i < operationsPerType; i++) {
        operations.push(storageService.search(`Batch Entry ${i + 1}`));
      }

      // Concurrent adds
      for (let i = 0; i < operationsPerType; i++) {
        operations.push(storageService.addEntry(createTestKBEntry({
          title: `Concurrent Entry ${i + 1}`
        })));
      }

      // Concurrent updates
      const entriesToUpdate = await storageService.search('Batch Entry', { limit: operationsPerType });
      for (let i = 0; i < entriesToUpdate.length; i++) {
        operations.push(storageService.updateEntry(entriesToUpdate[i].entry.id!, {
          title: `Updated Concurrent ${i + 1}`
        }));
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(operations);
      const totalTime = Date.now() - startTime;

      // Check that most operations succeeded
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(concurrentOperations * 0.8); // At least 80% success
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Concurrent operations metrics:
        - Total time: ${totalTime}ms
        - Successful: ${successful}/${concurrentOperations}
        - Failed: ${failed}/${concurrentOperations}`);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from database corruption', async () => {
      // Add test data
      await storageService.addEntry(createTestKBEntry());
      const originalCount = await storageService.getTotalCount();

      // Simulate database corruption by closing connection unexpectedly
      await storageService.close();

      // Reinitialize - should handle gracefully
      await storageService.initialize();

      // Verify data is still accessible
      const recoveredCount = await storageService.getTotalCount();
      expect(recoveredCount).toBe(originalCount);
    });

    it('should handle transaction rollback on failures', async () => {
      const validEntry = createTestKBEntry();
      const invalidEntry = { ...createTestKBEntry(), category: null as any };

      // This should fail and rollback
      await expect(storageService.batchInsert([validEntry, invalidEntry]))
        .rejects.toThrow();

      // Verify no entries were added
      const count = await storageService.getTotalCount();
      expect(count).toBe(0);
    });

    it('should maintain data consistency during failures', async () => {
      // Add initial data
      const entry = await storageService.addEntry(createTestKBEntry());
      
      // Attempt operation that fails midway
      try {
        await storageService.updateEntry(entry.id!, { 
          title: null as any // This should fail validation
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify original data is unchanged
      const retrievedEntry = await storageService.getEntry(entry.id!);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).toBe(entry.title);
    });
  });
});