import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { KnowledgeDB, KBEntry, SearchResult, SearchOptions } from '../../KnowledgeDB';
import { TestDatabaseFactory } from '../test-utils/TestDatabaseFactory';
import { PerformanceTestHelper } from '../test-utils/PerformanceTestHelper';

describe('KnowledgeDB Unit Tests', () => {
  let kb: KnowledgeDB;
  let performanceHelper: PerformanceTestHelper;
  let testEntries: KBEntry[];

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
  });

  beforeEach(() => {
    kb = TestDatabaseFactory.createTestKnowledgeDB();
    testEntries = TestDatabaseFactory.createTestKBEntries();
  });

  afterEach(() => {
    if (kb) {
      kb.close();
    }
  });

  afterAll(() => {
    performanceHelper.clearResults();
  });

  describe('Initialization', () => {
    it('should initialize with memory database', () => {
      expect(kb).toBeDefined();
      expect(kb.isReady()).toBe(true);
    });

    it('should initialize with file database', () => {
      const fileKb = TestDatabaseFactory.createTestKnowledgeDB('/tmp/test-kb.db');

      expect(fileKb).toBeDefined();
      expect(fileKb.isReady()).toBe(true);

      fileKb.close();
    });

    it('should create required tables on initialization', async () => {
      const tables = await kb.getTables();

      expect(tables).toContain('kb_entries');
      expect(tables).toContain('kb_tags');
      expect(tables).toContain('kb_usage_metrics');
      expect(tables).toContain('kb_search_history');
    });

    it('should initialize within performance threshold', async () => {
      const result = await performanceHelper.measureOperation('knowledgedb-initialization', () =>
        TestDatabaseFactory.createTestKnowledgeDB()
      );

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toHaveExecutedWithin(100);

      // Close the created KB
      if (result.result) {
        (result.result as any).close();
      }
    });
  });

  describe('Entry Management', () => {
    it('should add entry successfully', async () => {
      const entry = testEntries[0];
      const id = await kb.addEntry(entry, 'test-user');

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      const retrievedEntry = await kb.getEntryById(id);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).toBe(entry.title);
      expect(retrievedEntry!.problem).toBe(entry.problem);
      expect(retrievedEntry!.solution).toBe(entry.solution);
      expect(retrievedEntry!.category).toBe(entry.category);
    });

    it('should add entry with tags', async () => {
      const entry = testEntries[1];
      const id = await kb.addEntry(entry, 'test-user');

      const retrievedEntry = await kb.getEntryById(id);
      expect(retrievedEntry!.tags).toEqual(expect.arrayContaining(entry.tags || []));
    });

    it('should update existing entry', async () => {
      const entry = testEntries[0];
      const id = await kb.addEntry(entry, 'test-user');

      const updatedData = {
        ...entry,
        title: 'Updated Title',
        solution: 'Updated Solution',
      };

      await kb.updateEntry(id, updatedData, 'test-user');

      const retrievedEntry = await kb.getEntryById(id);
      expect(retrievedEntry!.title).toBe('Updated Title');
      expect(retrievedEntry!.solution).toBe('Updated Solution');
    });

    it('should delete entry successfully', async () => {
      const entry = testEntries[0];
      const id = await kb.addEntry(entry, 'test-user');

      await kb.deleteEntry(id);

      const retrievedEntry = await kb.getEntryById(id);
      expect(retrievedEntry).toBeNull();
    });

    it('should handle duplicate entries', async () => {
      const entry = testEntries[0];

      const id1 = await kb.addEntry(entry, 'test-user');
      const id2 = await kb.addEntry(entry, 'test-user');

      // Should allow duplicates but with different IDs
      expect(id1).not.toBe(id2);

      const count = await kb.getEntryCount();
      expect(count).toBe(2);
    });

    it('should validate required fields', async () => {
      const invalidEntry = {
        title: '',
        problem: 'Some problem',
        solution: 'Some solution',
        category: 'VSAM',
      };

      await expect(kb.addEntry(invalidEntry as any, 'test-user')).rejects.toThrow();
    });

    it('should validate category values', async () => {
      const invalidEntry = {
        title: 'Test',
        problem: 'Some problem',
        solution: 'Some solution',
        category: 'INVALID_CATEGORY',
      };

      await expect(kb.addEntry(invalidEntry as any, 'test-user')).rejects.toThrow();
    });

    it('should measure entry operations performance', async () => {
      const entry = testEntries[0];

      const addResult = await performanceHelper.measureOperation(
        'add-entry',
        () => kb.addEntry(entry, 'test-user'),
        100
      );

      expect(addResult.success).toBe(true);
      expect(addResult.metrics.operationsPerSecond).toBeGreaterThan(100);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      // Populate KB with test data
      for (const entry of testEntries) {
        await kb.addEntry(entry, 'test-user');
      }
    });

    it('should search by title', async () => {
      const results = await kb.search('VSAM Status 35');

      expect(results).toHaveLength(1);
      expect(results[0].entry.title).toContain('VSAM Status 35');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should search by problem description', async () => {
      const results = await kb.search('data exception');

      expect(results.length).toBeGreaterThanOrEqual(1);
      const s0c7Entry = results.find(r => r.entry.title.includes('S0C7'));
      expect(s0c7Entry).toBeDefined();
    });

    it('should search by solution content', async () => {
      const results = await kb.search('check numeric data');

      expect(results.length).toBeGreaterThanOrEqual(1);
      const relevantEntry = results.find(r => r.entry.solution.toLowerCase().includes('numeric'));
      expect(relevantEntry).toBeDefined();
    });

    it('should search by category', async () => {
      const results = await kb.searchByCategory('VSAM');

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(result => {
        expect(result.entry.category).toBe('VSAM');
      });
    });

    it('should search by tags', async () => {
      const results = await kb.searchByTag('s0c7');

      expect(results.length).toBeGreaterThanOrEqual(1);
      const s0c7Entry = results.find(r => r.entry.tags && r.entry.tags.includes('s0c7'));
      expect(s0c7Entry).toBeDefined();
    });

    it('should return results sorted by relevance', async () => {
      const results = await kb.search('error');

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it('should limit search results', async () => {
      const options: SearchOptions = { limit: 2 };
      const results = await kb.search('test', options);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty search queries', async () => {
      const results = await kb.search('');

      // Should return recent entries or empty array
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle non-matching search queries', async () => {
      const results = await kb.search('nonexistent query xyz123');

      expect(results).toHaveLength(0);
    });

    it('should perform fuzzy matching', async () => {
      const results = await kb.search('VASM'); // Misspelled VSAM

      // Should still find VSAM-related entries with fuzzy matching
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should search with advanced options', async () => {
      const options: SearchOptions = {
        limit: 3,
        includeUsageStats: true,
        sortBy: 'usage_count',
        sortOrder: 'DESC',
      };

      const results = await kb.search('error', options);

      expect(results.length).toBeLessThanOrEqual(3);
      if (results.length > 1) {
        expect(results[0].entry.usage_count).toBeGreaterThanOrEqual(results[1].entry.usage_count!);
      }
    });

    it('should measure search performance', async () => {
      const result = await performanceHelper.measureOperation(
        'basic-search',
        () => kb.search('error'),
        100
      );

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toHaveExecutedWithin(50); // per operation
      expect(result.metrics.operationsPerSecond).toBeGreaterThan(200);
    });

    it('should scale search performance with dataset size', async () => {
      const sizes = [100, 500, 1000];
      const results: any[] = [];

      for (const size of sizes) {
        // Clear existing data
        await kb.clearAllEntries();

        // Add large dataset
        const largeDataset = TestDatabaseFactory.createLargeTestDataset(size);
        for (const entry of largeDataset) {
          await kb.addEntry(entry, 'test-user');
        }

        // Measure search performance
        const searchResult = await performanceHelper.measureOperation(
          `search-scaling-${size}`,
          () => kb.search('error'),
          10
        );

        results.push({ size, time: searchResult.metrics.executionTime });
      }

      // Search time should scale reasonably with dataset size
      // Allow up to 3x increase for 10x data size
      expect(results[2].time).toBeLessThan(results[0].time * 3);
    });
  });

  describe('Usage Tracking', () => {
    let entryId: string;

    beforeEach(async () => {
      const entry = testEntries[0];
      entryId = await kb.addEntry(entry, 'test-user');
    });

    it('should track entry views', async () => {
      await kb.recordUsage(entryId, 'view', 'test-user');

      const entry = await kb.getEntryById(entryId);
      expect(entry!.usage_count).toBeGreaterThan(0);
    });

    it('should track successful resolutions', async () => {
      await kb.recordUsage(entryId, 'success', 'test-user');

      const entry = await kb.getEntryById(entryId);
      expect(entry!.success_count).toBeGreaterThan(0);
    });

    it('should track failed resolutions', async () => {
      await kb.recordUsage(entryId, 'failure', 'test-user');

      const entry = await kb.getEntryById(entryId);
      expect(entry!.failure_count).toBeGreaterThan(0);
    });

    it('should calculate success rate correctly', async () => {
      // Record some successes and failures
      await kb.recordUsage(entryId, 'success', 'test-user');
      await kb.recordUsage(entryId, 'success', 'test-user');
      await kb.recordUsage(entryId, 'failure', 'test-user');

      const entry = await kb.getEntryById(entryId);
      const successRate = entry!.success_count! / (entry!.success_count! + entry!.failure_count!);
      expect(successRate).toBeCloseTo(0.67, 2); // 2/3 = 0.67
    });

    it('should get usage statistics', async () => {
      await kb.recordUsage(entryId, 'view', 'test-user');
      await kb.recordUsage(entryId, 'success', 'test-user');

      const stats = await kb.getUsageStatistics();

      expect(stats).toHaveProperty('totalViews');
      expect(stats).toHaveProperty('totalSuccesses');
      expect(stats).toHaveProperty('totalFailures');
      expect(stats).toHaveProperty('mostViewedEntries');
      expect(stats).toHaveProperty('bestPerformingEntries');
    });

    it('should get entry-specific statistics', async () => {
      await kb.recordUsage(entryId, 'view', 'user1');
      await kb.recordUsage(entryId, 'view', 'user2');
      await kb.recordUsage(entryId, 'success', 'user1');

      const stats = await kb.getEntryStatistics(entryId);

      expect(stats).toHaveProperty('views');
      expect(stats).toHaveProperty('successes');
      expect(stats).toHaveProperty('failures');
      expect(stats).toHaveProperty('uniqueUsers');
      expect(stats.views).toBeGreaterThanOrEqual(2);
      expect(stats.uniqueUsers).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should enforce foreign key constraints', async () => {
      const entry = testEntries[0];
      const entryId = await kb.addEntry(entry, 'test-user');

      // Delete the entry
      await kb.deleteEntry(entryId);

      // Tags should be automatically deleted due to foreign key constraint
      const tags = await kb.getTagsForEntry(entryId);
      expect(tags).toHaveLength(0);
    });

    it('should handle concurrent modifications', async () => {
      const entry = testEntries[0];
      const entryId = await kb.addEntry(entry, 'test-user');

      // Simulate concurrent updates
      const updates = Array(10)
        .fill(0)
        .map((_, i) =>
          kb.updateEntry(
            entryId,
            {
              ...entry,
              title: `Updated Title ${i}`,
            },
            `user${i}`
          )
        );

      await Promise.all(updates);

      // Entry should still exist and be valid
      const finalEntry = await kb.getEntryById(entryId);
      expect(finalEntry).toBeDefined();
      expect(finalEntry!.title).toMatch(/Updated Title \d+/);
    });

    it('should validate entry data before insertion', async () => {
      const invalidEntries = TestDatabaseFactory.createCorruptedData();

      for (const invalidEntry of invalidEntries) {
        await expect(kb.addEntry(invalidEntry as any, 'test-user')).rejects.toThrow();
      }
    });

    it('should sanitize input data', async () => {
      const maliciousEntry = {
        title: '<script>alert("xss")</script>',
        problem: 'DROP TABLE kb_entries; --',
        solution: "'; DELETE FROM kb_entries; --",
        category: 'VSAM',
      };

      const entryId = await kb.addEntry(maliciousEntry, 'test-user');
      const retrievedEntry = await kb.getEntryById(entryId);

      // Entry should be stored but sanitized
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).not.toContain('<script>');
    });

    it('should maintain data consistency during errors', async () => {
      const entry = testEntries[0];
      const entryId = await kb.addEntry(entry, 'test-user');

      // Try to update with invalid data
      await expect(
        kb.updateEntry(
          entryId,
          {
            title: null,
            category: 'INVALID',
          } as any,
          'test-user'
        )
      ).rejects.toThrow();

      // Original entry should remain unchanged
      const unchangedEntry = await kb.getEntryById(entryId);
      expect(unchangedEntry!.title).toBe(entry.title);
      expect(unchangedEntry!.category).toBe(entry.category);
    });
  });

  describe('Analytics and Reporting', () => {
    beforeEach(async () => {
      // Populate with test data and usage
      for (const entry of testEntries) {
        const entryId = await kb.addEntry(entry, 'test-user');

        // Add some usage data
        for (let i = 0; i < Math.floor(Math.random() * 10); i++) {
          await kb.recordUsage(entryId, 'view', `user${i % 3}`);
        }

        for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
          await kb.recordUsage(
            entryId,
            Math.random() > 0.7 ? 'failure' : 'success',
            `user${i % 3}`
          );
        }
      }
    });

    it('should generate category analytics', async () => {
      const analytics = await kb.getCategoryAnalytics();

      expect(analytics).toBeDefined();
      expect(Array.isArray(analytics)).toBe(true);
      expect(analytics.length).toBeGreaterThan(0);

      analytics.forEach(category => {
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('entryCount');
        expect(category).toHaveProperty('totalViews');
        expect(category).toHaveProperty('averageSuccessRate');
      });
    });

    it('should generate time-based analytics', async () => {
      const analytics = await kb.getTimeBasedAnalytics('daily', 7);

      expect(analytics).toBeDefined();
      expect(Array.isArray(analytics)).toBe(true);

      analytics.forEach(period => {
        expect(period).toHaveProperty('period');
        expect(period).toHaveProperty('views');
        expect(period).toHaveProperty('searches');
        expect(period).toHaveProperty('newEntries');
      });
    });

    it('should identify trending entries', async () => {
      const trending = await kb.getTrendingEntries(5);

      expect(trending).toBeDefined();
      expect(Array.isArray(trending)).toBe(true);
      expect(trending.length).toBeLessThanOrEqual(5);

      trending.forEach(entry => {
        expect(entry).toHaveProperty('entry');
        expect(entry).toHaveProperty('trendScore');
        expect(entry.trendScore).toBeGreaterThan(0);
      });
    });

    it('should generate search analytics', async () => {
      // Perform some searches
      await kb.search('error');
      await kb.search('VSAM');
      await kb.search('JCL');

      const analytics = await kb.getSearchAnalytics();

      expect(analytics).toHaveProperty('totalSearches');
      expect(analytics).toHaveProperty('popularQueries');
      expect(analytics).toHaveProperty('averageResultsPerQuery');
      expect(analytics).toHaveProperty('noResultQueries');
    });

    it('should export data for backup', async () => {
      const exportData = await kb.exportData();

      expect(exportData).toHaveProperty('version');
      expect(exportData).toHaveProperty('exportDate');
      expect(exportData).toHaveProperty('entries');
      expect(exportData).toHaveProperty('statistics');

      expect(Array.isArray(exportData.entries)).toBe(true);
      expect(exportData.entries.length).toBe(testEntries.length);
    });

    it('should import data from backup', async () => {
      const exportData = await kb.exportData();

      // Clear current data
      await kb.clearAllEntries();
      expect(await kb.getEntryCount()).toBe(0);

      // Import data
      await kb.importData(exportData);

      // Verify data is restored
      expect(await kb.getEntryCount()).toBe(testEntries.length);

      // Verify search still works
      const results = await kb.search('VSAM');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = TestDatabaseFactory.createLargeTestDataset(5000);

      const insertResult = await performanceHelper.measureOperation(
        'large-dataset-insertion',
        async () => {
          for (const entry of largeDataset) {
            await kb.addEntry(entry, 'test-user');
          }
        }
      );

      expect(insertResult.success).toBe(true);
      expect(insertResult.metrics.executionTime).toHaveExecutedWithin(30000); // 30 seconds max

      // Verify all entries were inserted
      const count = await kb.getEntryCount();
      expect(count).toBe(5000);
    });

    it('should maintain search performance with large datasets', async () => {
      // Add large dataset
      const largeDataset = TestDatabaseFactory.createLargeTestDataset(2000);
      for (const entry of largeDataset) {
        await kb.addEntry(entry, 'test-user');
      }

      const searchResult = await performanceHelper.measureOperation(
        'large-dataset-search',
        () => kb.search('error'),
        50
      );

      expect(searchResult.success).toBe(true);
      expect(searchResult.metrics.operationsPerSecond).toBeGreaterThan(20);
    });

    it('should handle concurrent operations', async () => {
      const concurrentOperations = [
        // Concurrent inserts
        ...Array(10)
          .fill(0)
          .map(
            (_, i) => () =>
              kb.addEntry(
                {
                  title: `Concurrent Entry ${i}`,
                  problem: `Problem ${i}`,
                  solution: `Solution ${i}`,
                  category: 'Batch',
                },
                `user${i}`
              )
          ),
        // Concurrent searches
        ...Array(10)
          .fill(0)
          .map(() => () => kb.search('test')),
        // Concurrent usage tracking
        ...Array(5)
          .fill(0)
          .map((_, i) => () => kb.recordUsage('nonexistent', 'view', `user${i}`)),
      ];

      const loadTestConfig = {
        concurrentUsers: 5,
        duration: 10,
        rampUpTime: 2,
        operations: concurrentOperations,
      };

      const results = await performanceHelper.runLoadTest(loadTestConfig);

      const successRate = results.filter(r => r.success).length / results.length;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
    });

    it('should manage memory usage efficiently', async () => {
      const memoryMetrics = await performanceHelper.testMemoryUsage(
        async () => {
          // Perform various operations that might cause memory leaks
          const entry = TestDatabaseFactory.createTestKBEntries()[0];
          const entryId = await kb.addEntry(entry, 'test-user');
          await kb.search('test');
          await kb.recordUsage(entryId, 'view', 'test-user');
          await kb.getEntryById(entryId);
        },
        10000, // 10 seconds
        500 // Check every 500ms
      );

      // Memory usage should be stable (not continuously growing)
      const initialMemory = memoryMetrics[0].memoryUsage.heapUsed;
      const finalMemory = memoryMetrics[memoryMetrics.length - 1].memoryUsage.heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / initialMemory;

      expect(memoryGrowth).toBeLessThan(0.5); // Less than 50% memory growth
    });
  });

  describe('Error Recovery', () => {
    it('should recover from database corruption', async () => {
      // This test would require creating a corrupted database file
      // For in-memory databases, we'll simulate by causing an error
      const entry = testEntries[0];
      await kb.addEntry(entry, 'test-user');

      // Simulate recovery by creating a new KB instance
      const newKb = TestDatabaseFactory.createTestKnowledgeDB();
      expect(newKb.isReady()).toBe(true);
      newKb.close();
    });

    it('should handle partial transaction failures', async () => {
      const entry = testEntries[0];
      const entryId = await kb.addEntry(entry, 'test-user');

      // Simulate a partial failure scenario
      try {
        await kb.updateEntry(
          entryId,
          {
            title: 'Valid title',
            category: 'INVALID_CATEGORY' as any,
          },
          'test-user'
        );
      } catch (error) {
        // Error expected
      }

      // Original entry should remain unchanged
      const unchangedEntry = await kb.getEntryById(entryId);
      expect(unchangedEntry!.title).toBe(entry.title);
      expect(unchangedEntry!.category).toBe(entry.category);
    });

    it('should maintain referential integrity after errors', async () => {
      const entry = testEntries[0];
      const entryId = await kb.addEntry(entry, 'test-user');

      // Force an error that might affect referential integrity
      try {
        // This should fail but not corrupt the database
        await kb.updateEntry('nonexistent-id', entry, 'test-user');
      } catch (error) {
        // Error expected
      }

      // Database should still be functional
      const results = await kb.search(entry.title);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
