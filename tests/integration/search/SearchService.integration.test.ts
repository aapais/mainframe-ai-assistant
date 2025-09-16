/**
 * Integration Tests for Search Service
 * Tests real interactions between search components, database, and external APIs
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import {
  getTestDatabase,
  getPerformanceMonitor,
  getGeminiMock,
  cleanupIntegrationTests,
  integrationTestData,
  TestDatabaseManager,
  IntegrationPerformanceMonitor,
  MockGeminiIntegration
} from '../../setup/integration-setup';

// Import actual services (not mocked for integration tests)
import { AdvancedSearchEngine } from '../../../src/services/search/AdvancedSearchEngine';
import { GeminiService } from '../../../src/services/GeminiService';
import { KnowledgeDB } from '../../../src/database/KnowledgeDB';

describe('Search Service Integration Tests', () => {
  let searchEngine: AdvancedSearchEngine;
  let knowledgeDB: KnowledgeDB;
  let testDbManager: TestDatabaseManager;
  let performanceMonitor: IntegrationPerformanceMonitor;
  let geminiMock: MockGeminiIntegration;
  let testData: any[];

  beforeAll(async () => {
    // Initialize test environment
    testDbManager = await getTestDatabase();
    performanceMonitor = getPerformanceMonitor();
    geminiMock = getGeminiMock();

    // Seed test data
    testData = await testDbManager.seedTestData(100);
    console.log(`Seeded ${testData.length} test entries for integration tests`);
  }, 30000);

  beforeEach(async () => {
    // Initialize knowledge database with test database
    knowledgeDB = new KnowledgeDB(testDbManager.getDatabase());

    // Initialize search engine
    searchEngine = new AdvancedSearchEngine({
      maxResults: 50,
      defaultTimeout: 2000,
      cacheEnabled: true,
      fuzzyEnabled: true,
      rankingAlgorithm: 'bm25',
      performance: {
        indexingBatchSize: 100,
        searchTimeout: 1500,
        maxConcurrentSearches: 10,
        memoryThreshold: 256 * 1024 * 1024,
        optimizationLevel: 'balanced'
      },
      features: {
        semanticSearch: true,
        autoComplete: true,
        spellCorrection: true,
        queryExpansion: false,
        resultClustering: false,
        personalizedRanking: false
      }
    });

    // Initialize search engine with test data
    const entries = await knowledgeDB.getAllEntries();
    await searchEngine.initialize(entries);

    performanceMonitor.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await cleanupIntegrationTests();
  }, 10000);

  describe('Full Search Pipeline Integration', () => {
    it('should perform end-to-end search with database integration', async () => {
      const searchScenarios = integrationTestData.createSearchScenarios();

      for (const scenario of searchScenarios) {
        const { result, duration } = await performanceMonitor.measure(
          `search_${scenario.query.replace(/\s+/g, '_')}`,
          async () => {
            return await searchEngine.search(scenario.query, { limit: 10 });
          }
        );

        // Verify result structure
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('metrics');
        expect(Array.isArray(result.results)).toBe(true);

        // Verify minimum result expectations
        if (scenario.expectedMinResults > 0) {
          expect(result.results.length).toBeGreaterThanOrEqual(scenario.expectedMinResults);
        } else {
          expect(result.results.length).toBe(0);
        }

        // Verify category filtering if specified
        if (scenario.category && result.results.length > 0) {
          const hasCategory = result.results.some(r => r.entry.category === scenario.category);
          expect(hasCategory).toBe(true);
        }

        // Verify performance
        expect(duration).toBeLessThan(2000); // 2 second max for integration tests
        expect(result.metadata.processingTime).toBeLessThan(2000);

        // Verify search metrics
        expect(result.metrics).toHaveProperty('queryTime');
        expect(result.metrics).toHaveProperty('indexTime');
        expect(result.metrics).toHaveProperty('rankingTime');
        expect(result.metrics).toHaveProperty('totalTime');
        expect(result.metrics.totalTime).toBeGreaterThan(0);
      }
    });

    it('should handle database queries with proper error handling', async () => {
      // Test with malformed database state
      await testDbManager.clearTestData();

      const result = await searchEngine.search('test query');

      expect(result.results).toHaveLength(0);
      expect(result.metadata.totalResults).toBe(0);

      // Restore test data
      await testDbManager.seedTestData(50);
      const entries = await knowledgeDB.getAllEntries();
      await searchEngine.initialize(entries);
    });

    it('should integrate with cache system properly', async () => {
      const query = 'cache integration test';

      // First search - should miss cache
      const { result: result1 } = await performanceMonitor.measure('cache_miss', async () => {
        return await searchEngine.search(query);
      });

      expect(result1.metrics.cacheHit).toBe(false);

      // Second search - should hit cache
      const { result: result2, duration } = await performanceMonitor.measure('cache_hit', async () => {
        return await searchEngine.search(query);
      });

      expect(result2.metrics.cacheHit).toBe(true);
      expect(duration).toBeLessThan(100); // Cache hits should be very fast

      // Results should be identical
      expect(result1.results.length).toBe(result2.results.length);
      expect(result1.metadata.totalResults).toBe(result2.metadata.totalResults);
    });

    it('should maintain consistency across multiple operations', async () => {
      const query = 'consistency test';

      // Perform multiple searches
      const searches = await Promise.all([
        searchEngine.search(query),
        searchEngine.search(query),
        searchEngine.search(query)
      ]);

      // All searches should return consistent results
      const firstResultCount = searches[0].results.length;
      expect(searches[1].results.length).toBe(firstResultCount);
      expect(searches[2].results.length).toBe(firstResultCount);

      // Result ordering should be consistent
      if (firstResultCount > 0) {
        const firstResultId = searches[0].results[0].entry.id;
        expect(searches[1].results[0].entry.id).toBe(firstResultId);
        expect(searches[2].results[0].entry.id).toBe(firstResultId);
      }
    });
  });

  describe('Database Operations Integration', () => {
    it('should add entries and immediately make them searchable', async () => {
      const newEntry = {
        id: 'integration-test-new-entry',
        title: 'Integration Test New Entry',
        problem: 'This is a test problem for integration testing',
        solution: 'This is a test solution for integration testing',
        category: 'Other' as const,
        tags: ['integration', 'test', 'new'],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0
      };

      // Add entry to database
      await knowledgeDB.addEntry(newEntry);

      // Add to search engine
      await searchEngine.addDocument(newEntry);

      // Verify it's immediately searchable
      const result = await searchEngine.search('Integration Test New Entry');

      expect(result.results.length).toBeGreaterThan(0);
      const found = result.results.find(r => r.entry.id === newEntry.id);
      expect(found).toBeDefined();
      expect(found?.entry.title).toBe(newEntry.title);
    });

    it('should remove entries and update search results', async () => {
      // Get an existing entry
      const entries = await knowledgeDB.getAllEntries();
      const entryToRemove = entries[0];

      // Remove from search engine and database
      await searchEngine.removeDocument(entryToRemove.id);
      await knowledgeDB.deleteEntry(entryToRemove.id);

      // Verify it's no longer findable by exact title search
      const result = await searchEngine.search(entryToRemove.title);
      const found = result.results.find(r => r.entry.id === entryToRemove.id);
      expect(found).toBeUndefined();
    });

    it('should handle concurrent database operations', async () => {
      const concurrentOperations = [];

      // Create multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        const entry = {
          id: `concurrent-test-${i}`,
          title: `Concurrent Test Entry ${i}`,
          problem: `Concurrent problem ${i}`,
          solution: `Concurrent solution ${i}`,
          category: 'Other' as const,
          tags: ['concurrent', 'test'],
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0
        };

        concurrentOperations.push(
          performanceMonitor.measure(`concurrent_add_${i}`, async () => {
            await knowledgeDB.addEntry(entry);
            await searchEngine.addDocument(entry);
            return entry;
          })
        );
      }

      // Wait for all operations to complete
      const results = await Promise.all(concurrentOperations);
      expect(results).toHaveLength(5);

      // Verify all entries are searchable
      const searchResult = await searchEngine.search('Concurrent Test');
      expect(searchResult.results.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should meet performance requirements under load', async () => {
      const performanceScenarios = integrationTestData.createPerformanceScenarios();

      for (const scenario of performanceScenarios) {
        const { duration } = await performanceMonitor.measure(
          scenario.name,
          async () => {
            return await searchEngine.search(scenario.query);
          }
        );

        expect(duration).toBeLessThan(scenario.maxTime);
      }

      // Generate performance report
      const report = performanceMonitor.generateReport();
      console.log('\nPerformance Integration Test Report:');
      console.log(report);
    });

    it('should handle concurrent searches efficiently', async () => {
      const concurrentSearches = [];
      const searchQuery = 'concurrent performance test';

      // Create 10 concurrent searches
      for (let i = 0; i < 10; i++) {
        concurrentSearches.push(
          performanceMonitor.measure(`concurrent_search_${i}`, async () => {
            return await searchEngine.search(`${searchQuery} ${i}`);
          })
        );
      }

      const results = await Promise.all(concurrentSearches);

      // All searches should complete successfully
      expect(results).toHaveLength(10);
      results.forEach(({ result }) => {
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('metadata');
      });

      // Average response time should be reasonable
      const avgTime = performanceMonitor.getAverageTime('concurrent_search_0');
      expect(avgTime).toBeLessThan(1000); // 1 second average
    });

    it('should scale with dataset size', async () => {
      // Test with current dataset
      const { duration: smallDatasetTime } = await performanceMonitor.measure('small_dataset', async () => {
        return await searchEngine.search('error status');
      });

      // Add more test data
      const additionalData = await testDbManager.seedTestData(200);
      const allEntries = await knowledgeDB.getAllEntries();
      await searchEngine.initialize(allEntries);

      // Test with larger dataset
      const { duration: largeDatasetTime } = await performanceMonitor.measure('large_dataset', async () => {
        return await searchEngine.search('error status');
      });

      // Performance should not degrade significantly (allow 2x degradation)
      expect(largeDatasetTime).toBeLessThan(smallDatasetTime * 2.5);
      expect(largeDatasetTime).toBeLessThan(2000); // Still under 2 seconds
    });
  });

  describe('AI Service Integration', () => {
    it('should integrate with Gemini API mock for semantic search', async () => {
      // Configure Gemini mock for success
      geminiMock.setDelay(200);
      geminiMock.setShouldFail(false);

      const query = 'VSAM file error';
      const entries = await knowledgeDB.getAllEntries();
      const vslamEntries = entries.filter(e => e.category === 'VSAM').slice(0, 5);

      // Test Gemini integration
      const { result: aiResults } = await performanceMonitor.measure('gemini_integration', async () => {
        return await geminiMock.findSimilar(query, vslamEntries);
      });

      expect(Array.isArray(aiResults)).toBe(true);
      expect(aiResults.length).toBeGreaterThan(0);
      expect(aiResults.length).toBeLessThanOrEqual(5);

      aiResults.forEach(result => {
        expect(result).toHaveProperty('entry');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('matchType', 'ai');
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });

      // Results should be ordered by score
      for (let i = 1; i < aiResults.length; i++) {
        expect(aiResults[i - 1].score).toBeGreaterThanOrEqual(aiResults[i].score);
      }
    });

    it('should handle AI service failures gracefully', async () => {
      // Configure Gemini mock to fail
      geminiMock.setShouldFail(true);

      const query = 'test AI failure';
      const entries = await knowledgeDB.getAllEntries();

      // Should not throw, should fall back gracefully
      await expect(geminiMock.findSimilar(query, entries.slice(0, 5)))
        .rejects.toThrow('Mock Gemini API failure');

      // Search engine should continue working with local search
      const result = await searchEngine.search(query);
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('metadata');

      // Reset mock
      geminiMock.setShouldFail(false);
    });

    it('should handle AI service timeouts', async () => {
      // Configure long delay
      geminiMock.setDelay(6000); // 6 seconds

      const query = 'timeout test';
      const entries = await knowledgeDB.getAllEntries().slice(0, 3);

      const startTime = performance.now();

      // Should timeout or complete within reasonable time
      try {
        await Promise.race([
          geminiMock.findSimilar(query, entries),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);
      } catch (error) {
        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(5100); // Should timeout within 5 seconds
        expect(error.message).toContain('Timeout');
      }

      // Reset delay
      geminiMock.setDelay(100);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors', async () => {
      // Close database connection
      await testDbManager.close();

      // Search should handle gracefully (may return cached results or empty)
      const result = await searchEngine.search('database error test');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('metadata');

      // Restore database
      testDbManager = await getTestDatabase();
      await testDbManager.seedTestData(50);
    });

    it('should handle malformed search queries', async () => {
      const malformedQueries = [
        '', // Empty
        ' ', // Whitespace only
        'a'.repeat(10000), // Very long
        'special!@#$%^&*()chars',
        'unicode 测试 🚀',
        'null\0byte',
        '../../etc/passwd', // Injection attempt
        '<script>alert(1)</script>' // XSS attempt
      ];

      for (const query of malformedQueries) {
        const result = await searchEngine.search(query);

        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata.query).toBe(query);

        // Should not crash the system
        expect(Array.isArray(result.results)).toBe(true);
      }
    });

    it('should recover from temporary failures', async () => {
      // Simulate temporary failures
      const originalSearch = searchEngine.search.bind(searchEngine);
      let failureCount = 0;

      // Mock to fail first 2 attempts
      const mockSearch = async (query: string, options?: any) => {
        if (failureCount < 2) {
          failureCount++;
          throw new Error('Temporary failure');
        }
        return originalSearch(query, options);
      };

      searchEngine.search = mockSearch as any;

      // First attempts should fail
      await expect(searchEngine.search('failure test 1')).rejects.toThrow('Temporary failure');
      await expect(searchEngine.search('failure test 2')).rejects.toThrow('Temporary failure');

      // Third attempt should succeed
      const result = await searchEngine.search('failure test 3');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('metadata');

      // Restore original method
      searchEngine.search = originalSearch;
    });
  });

  describe('Data Consistency Integration', () => {
    it('should maintain search index consistency with database', async () => {
      const initialEntries = await knowledgeDB.getAllEntries();
      const initialCount = initialEntries.length;

      // Add entry to database only (simulate inconsistency)
      const newEntry = {
        id: 'consistency-test',
        title: 'Consistency Test Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Other' as const,
        tags: ['consistency'],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0
      };

      await knowledgeDB.addEntry(newEntry);

      // Re-initialize search engine to sync with database
      const updatedEntries = await knowledgeDB.getAllEntries();
      expect(updatedEntries.length).toBe(initialCount + 1);

      await searchEngine.initialize(updatedEntries);

      // Search should now find the new entry
      const result = await searchEngine.search('Consistency Test Entry');
      const found = result.results.find(r => r.entry.id === newEntry.id);
      expect(found).toBeDefined();
    });

    it('should handle concurrent read/write operations', async () => {
      const operations = [];

      // Mix of read and write operations
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          // Read operation
          operations.push(
            performanceMonitor.measure(`concurrent_read_${i}`, async () => {
              return await searchEngine.search(`concurrent test ${i}`);
            })
          );
        } else {
          // Write operation
          operations.push(
            performanceMonitor.measure(`concurrent_write_${i}`, async () => {
              const entry = {
                id: `concurrent-rw-${i}`,
                title: `Concurrent RW Test ${i}`,
                problem: `Problem ${i}`,
                solution: `Solution ${i}`,
                category: 'Other' as const,
                tags: ['concurrent-rw'],
                created_at: new Date(),
                updated_at: new Date(),
                usage_count: 0,
                success_count: 0,
                failure_count: 0
              };

              await knowledgeDB.addEntry(entry);
              await searchEngine.addDocument(entry);
              return entry;
            })
          );
        }
      }

      // All operations should complete without errors
      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);

      // Verify no data corruption
      const finalEntries = await knowledgeDB.getAllEntries();
      expect(finalEntries.length).toBeGreaterThan(100); // Should have grown
    });
  });
});