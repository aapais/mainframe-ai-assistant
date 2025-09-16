/**
 * Integration Testing Framework for Component Interactions
 * Tests the integration between different services, components, and data layers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';
import { TestDataGenerator, AssertionHelpers, DatabaseTestUtils } from '../utils/TestingUtilities';
import { SearchService } from '../../src/services/SearchService';
import { KnowledgeBaseService } from '../../src/services/KnowledgeBaseService';
import { GeminiService } from '../../src/services/GeminiService';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KBEntry, SearchOptions, SearchResult } from '../../src/types';

/**
 * Base Integration Test Class
 */
export abstract class BaseIntegrationTest {
  protected database: DatabaseManager;
  protected kbService: KnowledgeBaseService;
  protected searchService: SearchService;
  protected geminiService: GeminiService;
  protected testData: KBEntry[];

  async setup(): Promise<void> {
    // Initialize test database
    this.database = await DatabaseTestUtils.createTestDatabase();

    // Initialize services
    this.kbService = new KnowledgeBaseService(this.database);
    this.geminiService = new GeminiService({
      apiKey: 'test-key',
      model: 'gemini-pro'
    });
    this.searchService = new SearchService(this.geminiService);

    // Generate test data
    this.testData = TestDataGenerator.createLargeDataset(100);

    // Seed database
    await this.seedDatabase();

    // Build search indices
    await this.searchService.buildIndex(this.testData);
  }

  async cleanup(): Promise<void> {
    await DatabaseTestUtils.cleanupTestDatabase(this.database);
  }

  private async seedDatabase(): Promise<void> {
    for (const entry of this.testData) {
      await this.kbService.addEntry(entry, 'test-user');
    }
  }

  protected findTestEntry(criteria: Partial<KBEntry>): KBEntry {
    const found = this.testData.find(entry =>
      Object.keys(criteria).every(key =>
        entry[key as keyof KBEntry] === criteria[key as keyof KBEntry]
      )
    );

    if (!found) {
      throw new Error(`Test entry not found with criteria: ${JSON.stringify(criteria)}`);
    }

    return found;
  }
}

/**
 * Search Integration Tests
 * Tests the complete search workflow from UI to database
 */
export class SearchIntegrationTest extends BaseIntegrationTest {
  testSearchWorkflow(): void {
    describe('Search Integration Workflow', () => {
      beforeAll(async () => {
        await this.setup();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('performs end-to-end search operation', async () => {
        const searchQuery = 'VSAM Status 35';
        const options: SearchOptions = {
          limit: 10,
          includeHighlights: true,
          useAI: false, // Use local search for predictable results
          threshold: 0.1,
          sortBy: 'relevance',
          sortOrder: 'desc',
          userId: 'test-user',
          sessionId: 'test-session'
        };

        // Perform search through service layer
        const results = await this.searchService.search(searchQuery, this.testData, options);

        // Validate results
        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(options.limit);

        // Check result structure
        results.forEach(result => {
          AssertionHelpers.assertSearchResults([result], searchQuery);
          expect(result.highlights).toBeDefined();
          expect(result.metadata).toBeDefined();
          expect(result.metadata.source).toBe('local');
        });

        // Verify database interaction
        const metrics = await this.kbService.getSearchMetrics();
        expect(metrics.totalSearches).toBeGreaterThan(0);
      });

      it('handles search with filters and sorting', async () => {
        const options: SearchOptions = {
          limit: 20,
          categories: ['VSAM', 'DB2'],
          tags: ['file-error'],
          sortBy: 'usage_count',
          sortOrder: 'desc',
          userId: 'test-user',
          sessionId: 'test-session'
        };

        const results = await this.searchService.search('error', this.testData, options);

        // Verify filtering
        results.forEach(result => {
          expect(['VSAM', 'DB2']).toContain(result.entry.category);
          expect(result.entry.tags?.some(tag => tag.includes('error'))).toBeTruthy();
        });

        // Verify sorting
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].entry.usage_count).toBeGreaterThanOrEqual(
            results[i].entry.usage_count
          );
        }
      });

      it('integrates with AI service for semantic search', async () => {
        // Mock Gemini service response
        const mockAIResults = this.testData.slice(0, 3).map(entry =>
          TestDataGenerator.createSearchResult(entry, { matchType: 'ai' })
        );

        vi.spyOn(this.geminiService, 'findSimilar').mockResolvedValue(mockAIResults);

        const options: SearchOptions = {
          limit: 10,
          useAI: true,
          threshold: 0.6,
          userId: 'test-user',
          sessionId: 'test-session'
        };

        const results = await this.searchService.search(
          'database connection problem',
          this.testData,
          options
        );

        // Should return AI-enhanced results
        expect(results.some(r => r.matchType === 'ai')).toBeTruthy();
        expect(this.geminiService.findSimilar).toHaveBeenCalled();
      });

      it('handles search errors gracefully', async () => {
        // Mock database error
        vi.spyOn(this.database, 'prepare').mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        const options: SearchOptions = {
          limit: 10,
          userId: 'test-user',
          sessionId: 'test-session'
        };

        // Should not throw error
        const results = await this.searchService.search('test query', this.testData, options);

        // Should return empty results with error handling
        expect(results).toEqual([]);
      });

      it('tracks search performance metrics', async () => {
        const startTime = performance.now();

        const results = await this.searchService.search(
          'performance test query',
          this.testData,
          {
            limit: 50,
            userId: 'test-user',
            sessionId: 'test-session'
          }
        );

        const endTime = performance.now();
        const searchTime = endTime - startTime;

        // Search should complete within performance threshold
        expect(searchTime).toBeLessThan(1000); // <1 second

        // Verify performance metrics are recorded
        const metrics = await this.searchService.getSearchMetrics();
        expect(metrics.averageSearchTime).toBeDefined();
        expect(metrics.totalSearches).toBeGreaterThan(0);
      });
    });
  }
}

/**
 * Knowledge Base Integration Tests
 */
export class KnowledgeBaseIntegrationTest extends BaseIntegrationTest {
  testKBWorkflow(): void {
    describe('Knowledge Base Integration Workflow', () => {
      beforeAll(async () => {
        await this.setup();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('performs complete CRUD operations', async () => {
        // Create
        const newEntry = TestDataGenerator.createKBEntry({
          title: 'Integration Test Entry',
          problem: 'Test problem for integration testing',
          solution: 'Test solution with detailed steps',
          category: 'Functional'
        });

        const entryId = await this.kbService.addEntry(newEntry, 'test-user');
        expect(entryId).toBeDefined();

        // Read
        const retrievedEntry = await this.kbService.getEntry(entryId);
        expect(retrievedEntry).toBeDefined();
        expect(retrievedEntry!.title).toBe(newEntry.title);
        expect(retrievedEntry!.problem).toBe(newEntry.problem);

        // Update
        const updatedEntry = {
          ...retrievedEntry!,
          title: 'Updated Integration Test Entry',
          solution: 'Updated solution with more details'
        };

        await this.kbService.updateEntry(updatedEntry, 'test-user');

        const updatedRetrieved = await this.kbService.getEntry(entryId);
        expect(updatedRetrieved!.title).toBe(updatedEntry.title);
        expect(updatedRetrieved!.solution).toBe(updatedEntry.solution);

        // Delete
        await this.kbService.deleteEntry(entryId, 'test-user');

        const deletedEntry = await this.kbService.getEntry(entryId);
        expect(deletedEntry).toBeNull();
      });

      it('handles entry usage tracking', async () => {
        const testEntry = this.findTestEntry({ category: 'VSAM' });

        const initialUsageCount = testEntry.usage_count;
        const initialSuccessCount = testEntry.success_count;

        // Record successful usage
        await this.kbService.recordUsage(testEntry.id!, true, 'test-user');

        const updatedEntry = await this.kbService.getEntry(testEntry.id!);
        expect(updatedEntry!.usage_count).toBe(initialUsageCount + 1);
        expect(updatedEntry!.success_count).toBe(initialSuccessCount + 1);

        // Record failed usage
        await this.kbService.recordUsage(testEntry.id!, false, 'test-user');

        const finalEntry = await this.kbService.getEntry(testEntry.id!);
        expect(finalEntry!.usage_count).toBe(initialUsageCount + 2);
        expect(finalEntry!.failure_count).toBe(testEntry.failure_count + 1);
      });

      it('validates data integrity', async () => {
        const invalidEntry = {
          title: '', // Empty title should be invalid
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'INVALID_CATEGORY' as any, // Invalid category
          tags: []
        };

        // Should throw validation error
        await expect(
          this.kbService.addEntry(invalidEntry, 'test-user')
        ).rejects.toThrow();
      });

      it('handles concurrent operations', async () => {
        const testEntry = this.findTestEntry({ category: 'JCL' });

        // Simulate concurrent usage recordings
        const concurrentOperations = Array.from({ length: 10 }, (_, index) =>
          this.kbService.recordUsage(testEntry.id!, index % 2 === 0, `user-${index}`)
        );

        await Promise.all(concurrentOperations);

        const finalEntry = await this.kbService.getEntry(testEntry.id!);
        expect(finalEntry!.usage_count).toBe(testEntry.usage_count + 10);
      });
    });
  }
}

/**
 * Service Layer Integration Tests
 */
export class ServiceLayerIntegrationTest extends BaseIntegrationTest {
  testServiceInteraction(): void {
    describe('Service Layer Integration', () => {
      beforeAll(async () => {
        await this.setup();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('coordinates between search and knowledge base services', async () => {
        // Add new entry through KB service
        const newEntry = TestDataGenerator.createKBEntry({
          title: 'Service Integration Test',
          tags: ['integration', 'test', 'service']
        });

        const entryId = await this.kbService.addEntry(newEntry, 'test-user');

        // Rebuild search index to include new entry
        const allEntries = await this.kbService.getAllEntries();
        await this.searchService.buildIndex(allEntries);

        // Search for the new entry
        const results = await this.searchService.search(
          'Service Integration',
          allEntries,
          { limit: 10, userId: 'test-user', sessionId: 'test-session' }
        );

        // Should find the new entry
        const foundEntry = results.find(r => r.entry.id === entryId);
        expect(foundEntry).toBeDefined();
        expect(foundEntry!.entry.title).toBe(newEntry.title);
      });

      it('handles service dependencies and fallbacks', async () => {
        // Mock Gemini service failure
        vi.spyOn(this.geminiService, 'findSimilar').mockRejectedValue(
          new Error('AI service unavailable')
        );

        const results = await this.searchService.search(
          'test query with AI failure',
          this.testData,
          {
            limit: 10,
            useAI: true, // Request AI but it should fallback
            userId: 'test-user',
            sessionId: 'test-session'
          }
        );

        // Should fallback to local search
        expect(results).toBeDefined();
        expect(results.every(r => r.matchType === 'fuzzy')).toBeTruthy();
      });

      it('maintains transaction consistency', async () => {
        const testEntry = this.findTestEntry({ category: 'DB2' });

        // Start a transaction that modifies entry and records usage
        await this.database.transaction(async () => {
          await this.kbService.updateEntry(
            { ...testEntry, title: 'Updated in Transaction' },
            'test-user'
          );

          await this.kbService.recordUsage(testEntry.id!, true, 'test-user');
        });

        const finalEntry = await this.kbService.getEntry(testEntry.id!);
        expect(finalEntry!.title).toBe('Updated in Transaction');
        expect(finalEntry!.usage_count).toBe(testEntry.usage_count + 1);
      });

      it('handles high-volume operations', async () => {
        const startTime = performance.now();

        // Perform many operations in parallel
        const operations = Array.from({ length: 100 }, async (_, index) => {
          if (index % 3 === 0) {
            // Search operations
            return this.searchService.search(
              `test query ${index}`,
              this.testData.slice(0, 10),
              { limit: 5, userId: 'test-user', sessionId: 'test-session' }
            );
          } else if (index % 3 === 1) {
            // Usage tracking
            const randomEntry = this.testData[index % this.testData.length];
            return this.kbService.recordUsage(randomEntry.id!, true, 'test-user');
          } else {
            // Metrics collection
            return this.kbService.getSearchMetrics();
          }
        });

        await Promise.all(operations);

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Should handle high volume within reasonable time
        expect(totalTime).toBeLessThan(5000); // <5 seconds for 100 operations
      });
    });
  }
}

/**
 * Database Integration Tests
 */
export class DatabaseIntegrationTest extends BaseIntegrationTest {
  testDatabaseIntegration(): void {
    describe('Database Integration', () => {
      beforeAll(async () => {
        await this.setup();
      });

      afterAll(async () => {
        await this.cleanup();
      });

      it('maintains referential integrity', async () => {
        const entry = TestDataGenerator.createKBEntry();
        const entryId = await this.kbService.addEntry(entry, 'test-user');

        // Add tags that reference the entry
        await this.database.run(
          'INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)',
          [entryId, 'test-tag']
        );

        // Delete the entry
        await this.kbService.deleteEntry(entryId, 'test-user');

        // Referenced tags should also be deleted
        const remainingTags = await this.database.all(
          'SELECT * FROM kb_tags WHERE entry_id = ?',
          [entryId]
        );

        expect(remainingTags).toHaveLength(0);
      });

      it('handles database constraints', async () => {
        // Try to insert duplicate ID
        const entry1 = TestDataGenerator.createKBEntry();
        const entry2 = { ...TestDataGenerator.createKBEntry(), id: entry1.id };

        await this.kbService.addEntry(entry1, 'test-user');

        await expect(
          this.kbService.addEntry(entry2, 'test-user')
        ).rejects.toThrow();
      });

      it('performs efficient queries', async () => {
        // Test that complex queries perform well
        await AssertionHelpers.assertPerformance(async () => {
          // Complex search with multiple joins
          const results = await this.database.all(`
            SELECT e.*, GROUP_CONCAT(t.tag) as tags,
                   COUNT(u.id) as total_usage
            FROM kb_entries e
            LEFT JOIN kb_tags t ON e.id = t.entry_id
            LEFT JOIN usage_metrics u ON e.id = u.entry_id
            WHERE e.category IN ('VSAM', 'JCL', 'DB2')
              AND e.created_at > datetime('now', '-30 days')
            GROUP BY e.id
            HAVING total_usage > 0
            ORDER BY e.usage_count DESC, e.success_count DESC
            LIMIT 50
          `);

          expect(results).toBeDefined();
        }, 500, 'Complex database query'); // Should complete in <500ms
      });

      it('handles backup and recovery', async () => {
        // Add some test data
        const entries = TestDataGenerator.createLargeDataset(10);
        for (const entry of entries) {
          await this.kbService.addEntry(entry, 'test-user');
        }

        // Create backup
        const backupPath = '/tmp/test-backup.db';
        await this.database.backup(backupPath);

        // Simulate data corruption/loss
        await this.database.run('DELETE FROM kb_entries');

        // Restore from backup
        await this.database.restore(backupPath);

        // Verify data is restored
        const restoredEntries = await this.kbService.getAllEntries();
        expect(restoredEntries.length).toBe(entries.length + this.testData.length);
      });
    });
  }
}

// Export all integration test classes
export {
  BaseIntegrationTest,
  SearchIntegrationTest,
  KnowledgeBaseIntegrationTest,
  ServiceLayerIntegrationTest,
  DatabaseIntegrationTest
};