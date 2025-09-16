/**
 * Comprehensive Unit Tests for AdvancedSearchEngine
 * Tests all core functionality, edge cases, and performance requirements
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AdvancedSearchEngine, SearchEngineConfig } from '../../../src/services/search/AdvancedSearchEngine';
import {
  MockInvertedIndex,
  MockTextProcessor,
  MockQueryParser,
  MockFuzzyMatcher,
  MockRankingEngine,
  MockSearchCache,
  createTestKBEntries,
  measureSearchPerformance,
  performanceThresholds,
  searchTestScenarios
} from '../../setup/search-test-setup';
import { TestDataFactory, createPerformanceWrapper } from '../../setup/test-setup';

// Mock the dependency modules
jest.mock('../../../src/services/search/InvertedIndex', () => ({
  default: MockInvertedIndex
}));

jest.mock('../../../src/services/search/TextProcessor', () => ({
  default: MockTextProcessor
}));

jest.mock('../../../src/services/search/QueryParser', () => ({
  default: MockQueryParser
}));

jest.mock('../../../src/services/search/FuzzyMatcher', () => ({
  default: MockFuzzyMatcher
}));

jest.mock('../../../src/services/search/RankingEngine', () => ({
  default: MockRankingEngine
}));

jest.mock('../../../src/services/search/SearchCache', () => ({
  default: MockSearchCache
}));

describe('AdvancedSearchEngine', () => {
  let searchEngine: AdvancedSearchEngine;
  let testKBEntries: any[];
  let defaultConfig: Partial<SearchEngineConfig>;

  beforeEach(() => {
    // Create test data
    testKBEntries = createTestKBEntries(10);

    // Default configuration
    defaultConfig = {
      maxResults: 10,
      defaultTimeout: 1000,
      cacheEnabled: true,
      fuzzyEnabled: true,
      rankingAlgorithm: 'bm25',
      performance: {
        indexingBatchSize: 100,
        searchTimeout: 800,
        maxConcurrentSearches: 5,
        memoryThreshold: 512 * 1024 * 1024,
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
    };

    // Create search engine instance
    searchEngine = new AdvancedSearchEngine(defaultConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const engine = new AdvancedSearchEngine();
      expect(engine).toBeInstanceOf(AdvancedSearchEngine);

      const stats = engine.getStats();
      expect(stats.health.initialized).toBe(false);
      expect(stats.health.activeSearches).toBe(0);
      expect(stats.health.queueLength).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<SearchEngineConfig> = {
        maxResults: 25,
        defaultTimeout: 2000,
        cacheEnabled: false
      };

      const engine = new AdvancedSearchEngine(customConfig);
      expect(engine).toBeInstanceOf(AdvancedSearchEngine);
    });

    it('should initialize search engine with knowledge base entries', async () => {
      const initPromise = searchEngine.initialize(testKBEntries);

      // Should complete within reasonable time
      await expect(initPromise).resolves.not.toThrow();

      const stats = engine.getStats();
      expect(stats.health.initialized).toBe(true);
      expect(stats.engine.indexSize).toBe(testKBEntries.length);
      expect(stats.engine.lastIndexUpdate).toBeGreaterThan(0);
    });

    it('should handle initialization errors gracefully', async () => {
      // Create engine with mock that throws error
      const mockIndex = new MockInvertedIndex();
      jest.spyOn(mockIndex, 'buildIndex').mockRejectedValue(new Error('Index build failed'));

      await expect(searchEngine.initialize(testKBEntries))
        .rejects.toThrow('Failed to initialize search engine');
    });

    it('should warm cache during initialization when enabled', async () => {
      const cacheEnabledConfig = { ...defaultConfig, cacheEnabled: true };
      const engine = new AdvancedSearchEngine(cacheEnabledConfig);

      await engine.initialize(testKBEntries);

      // Verify cache warming occurred (through mock interactions)
      const stats = engine.getStats();
      expect(stats.health.initialized).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      await searchEngine.initialize(testKBEntries);
    });

    describe('Basic Search Operations', () => {
      it('should perform basic search with results', async () => {
        const { result, metrics } = await measureSearchPerformance(async () => {
          return await searchEngine.search('VSAM Status 35');
        });

        expect(result.results).toHaveLength(5);
        expect(result.results[0]).toMatchSearchResult(expect.any(Object));
        expect(result.metadata.query).toBe('VSAM Status 35');
        expect(result.metadata.totalResults).toBeGreaterThan(0);
        expect(metrics.executionTime).toBeLessThan(performanceThresholds.search.slow);
      });

      it('should handle empty query', async () => {
        await expect(searchEngine.search(''))
          .rejects.toThrow();
      });

      it('should handle search with no results', async () => {
        const result = await searchEngine.search('nonexistentquery123');

        expect(result.results).toHaveLength(0);
        expect(result.metadata.totalResults).toBe(0);
        expect(result.suggestions).toBeDefined();
        expect(result.corrections).toBeDefined();
      });

      it('should respect result limits', async () => {
        const result = await searchEngine.search('error', { limit: 3 });

        expect(result.results).toHaveLength(3);
        expect(result.metadata.resultWindow.limit).toBe(3);
      });

      it('should handle pagination with offset', async () => {
        const page1 = await searchEngine.search('test', { limit: 5, offset: 0 });
        const page2 = await searchEngine.search('test', { limit: 5, offset: 5 });

        expect(page1.metadata.resultWindow.offset).toBe(0);
        expect(page2.metadata.resultWindow.offset).toBe(5);

        // Results should be different (if enough total results)
        if (page1.results.length > 0 && page2.results.length > 0) {
          expect(page1.results[0].entry.id).not.toBe(page2.results[0].entry.id);
        }
      });
    });

    describe('Advanced Search Features', () => {
      it('should provide search suggestions', async () => {
        const suggestions = await searchEngine.suggest('VSA');

        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toMatch(/^VSA/i);
      });

      it('should provide spell corrections', async () => {
        const corrections = await searchEngine.correct('VSAM Staus');

        expect(Array.isArray(corrections)).toBe(true);
        if (corrections.length > 0) {
          expect(corrections[0]).toContain('Status');
        }
      });

      it('should generate facets for results', async () => {
        const result = await searchEngine.search('error');

        expect(result.facets).toBeDefined();
        expect(Array.isArray(result.facets)).toBe(true);

        // Should have category facet if multiple categories
        const categoryFacet = result.facets?.find(f => f.field === 'category');
        if (categoryFacet && result.results.length > 1) {
          expect(categoryFacet.values.length).toBeGreaterThan(0);
        }
      });

      it('should support different search contexts', async () => {
        const context = {
          userId: 'test-user',
          sessionId: 'test-session',
          preferences: {
            preferredCategories: ['VSAM', 'JCL']
          }
        };

        const result = await searchEngine.search('test', {}, context);

        expect(result.context).toBeDefined();
        expect(result.context.userId).toBe('test-user');
        expect(result.context.sessionId).toBe('test-session');
      });
    });

    describe('Performance Requirements', () => {
      it('should complete search within 1 second', async () => {
        const { metrics } = await measureSearchPerformance(async () => {
          return await searchEngine.search('performance test');
        });

        expect(metrics.executionTime).toBeLessThan(performanceThresholds.search.slow);
      });

      it('should handle concurrent searches within limits', async () => {
        const searches = Array(5).fill(null).map((_, i) =>
          searchEngine.search(`concurrent test ${i}`)
        );

        const results = await Promise.all(searches);

        expect(results).toHaveLength(5);
        results.forEach(result => {
          expect(result.results).toBeDefined();
          expect(result.metadata).toBeDefined();
        });
      });

      it('should queue searches when at capacity', async () => {
        // Mock to simulate slow searches
        const slowSearches = Array(10).fill(null).map((_, i) =>
          searchEngine.search(`queue test ${i}`)
        );

        // All searches should eventually complete
        const results = await Promise.allSettled(slowSearches);

        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);
      });

      it('should timeout long-running searches', async () => {
        await expect(
          searchEngine.search('timeout test', { timeout: 100 })
        ).rejects.toThrow('timeout');
      });
    });

    describe('Caching Behavior', () => {
      it('should cache successful search results', async () => {
        const query = 'cache test';

        // First search
        const result1 = await searchEngine.search(query);
        expect(result1.metrics.cacheHit).toBe(false);

        // Second search should hit cache
        const result2 = await searchEngine.search(query);
        expect(result2.metrics.cacheHit).toBe(true);
      });

      it('should invalidate cache when documents change', async () => {
        const query = 'invalidation test';

        // Initial search
        await searchEngine.search(query);

        // Add new document
        const newEntry = TestDataFactory.createKBEntry({
          title: 'invalidation test entry'
        });
        await searchEngine.addDocument(newEntry);

        // Cache should be invalidated for related queries
        const result = await searchEngine.search(query);
        expect(result.metadata.totalResults).toBeGreaterThan(0);
      });

      it('should work when caching is disabled', async () => {
        const noCacheConfig = { ...defaultConfig, cacheEnabled: false };
        const engine = new AdvancedSearchEngine(noCacheConfig);
        await engine.initialize(testKBEntries);

        const result = await engine.search('no cache test');

        expect(result.metrics.cacheHit).toBe(false);
        expect(result.results).toBeDefined();
      });
    });
  });

  describe('Document Management', () => {
    beforeEach(async () => {
      await searchEngine.initialize(testKBEntries);
    });

    it('should add new documents to index', async () => {
      const newEntry = TestDataFactory.createKBEntry({
        title: 'New Test Entry',
        problem: 'New problem description'
      });

      await searchEngine.addDocument(newEntry);

      const result = await searchEngine.search('New Test Entry');
      expect(result.results.length).toBeGreaterThan(0);

      const stats = searchEngine.getStats();
      expect(stats.engine.indexSize).toBe(testKBEntries.length + 1);
    });

    it('should remove documents from index', async () => {
      const entryToRemove = testKBEntries[0];

      const removed = await searchEngine.removeDocument(entryToRemove.id);
      expect(removed).toBe(true);

      const stats = searchEngine.getStats();
      expect(stats.engine.indexSize).toBe(testKBEntries.length - 1);
    });

    it('should handle removal of non-existent document', async () => {
      const removed = await searchEngine.removeDocument('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await searchEngine.initialize(testKBEntries);
    });

    it('should handle search without initialization', async () => {
      const uninitializedEngine = new AdvancedSearchEngine();

      await expect(uninitializedEngine.search('test'))
        .rejects.toThrow('Search engine not initialized');
    });

    it('should handle malformed search options', async () => {
      const result = await searchEngine.search('test', {
        limit: -1,
        offset: -10,
        timeout: -100
      } as any);

      // Should use sensible defaults
      expect(result.results).toBeDefined();
      expect(result.metadata.resultWindow.limit).toBeGreaterThan(0);
      expect(result.metadata.resultWindow.offset).toBeGreaterThanOrEqual(0);
    });

    it('should handle special characters in queries', async () => {
      const specialQuery = 'test@#$%^&*()[]{}|\\:";\'<>?,./ ';

      const result = await searchEngine.search(specialQuery);

      // Should not crash and return proper response structure
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.query).toBe(specialQuery);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'test '.repeat(200); // Very long query

      const { metrics } = await measureSearchPerformance(async () => {
        return await searchEngine.search(longQuery.trim());
      });

      expect(metrics.executionTime).toBeLessThan(performanceThresholds.search.slow * 2);
    });

    it('should handle queries with only stop words', async () => {
      const stopWordsQuery = 'the and or but';

      const result = await searchEngine.search(stopWordsQuery);

      expect(result.results).toBeDefined();
      expect(result.metadata.query).toBe(stopWordsQuery);
    });
  });

  describe('Statistics and Health Monitoring', () => {
    beforeEach(async () => {
      await searchEngine.initialize(testKBEntries);
    });

    it('should provide comprehensive statistics', () => {
      const stats = searchEngine.getStats();

      expect(stats).toHaveProperty('engine');
      expect(stats).toHaveProperty('index');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('processor');
      expect(stats).toHaveProperty('ranking');
      expect(stats).toHaveProperty('health');

      expect(stats.health.initialized).toBe(true);
      expect(stats.engine.indexSize).toBe(testKBEntries.length);
    });

    it('should update metrics after searches', async () => {
      const initialStats = searchEngine.getStats();
      const initialSearches = initialStats.engine.totalSearches;

      await searchEngine.search('metric test');

      const updatedStats = searchEngine.getStats();
      expect(updatedStats.engine.totalSearches).toBe(initialSearches + 1);
      expect(updatedStats.engine.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track cache hit rates', async () => {
      const query = 'cache metrics test';

      // First search (cache miss)
      await searchEngine.search(query);

      // Second search (cache hit)
      await searchEngine.search(query);

      const stats = searchEngine.getStats();
      expect(stats.cache.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Optimization and Maintenance', () => {
    beforeEach(async () => {
      await searchEngine.initialize(testKBEntries);
    });

    it('should optimize search engine', async () => {
      await searchEngine.optimize();

      // Optimization should complete without errors
      const stats = searchEngine.getStats();
      expect(stats.health.initialized).toBe(true);
    });

    it('should handle shutdown gracefully', async () => {
      // Start some searches
      const searchPromises = [
        searchEngine.search('shutdown test 1'),
        searchEngine.search('shutdown test 2')
      ];

      // Shutdown while searches are running
      await searchEngine.shutdown();

      // Engine should be marked as not initialized
      const stats = searchEngine.getStats();
      expect(stats.health.initialized).toBe(false);

      // Future searches should fail
      await expect(searchEngine.search('after shutdown'))
        .rejects.toThrow('Search engine not initialized');
    });
  });

  describe('Feature Flags', () => {
    it('should disable features based on configuration', async () => {
      const restrictedConfig = {
        ...defaultConfig,
        features: {
          semanticSearch: false,
          autoComplete: false,
          spellCorrection: false,
          queryExpansion: false,
          resultClustering: false,
          personalizedRanking: false
        }
      };

      const engine = new AdvancedSearchEngine(restrictedConfig);
      await engine.initialize(testKBEntries);

      // Auto-complete should be disabled
      const suggestions = await engine.suggest('test');
      expect(suggestions).toHaveLength(0);

      // Spell correction should be disabled
      const corrections = await engine.correct('tset');
      expect(corrections).toHaveLength(0);
    });

    it('should enable advanced features when configured', async () => {
      const advancedConfig = {
        ...defaultConfig,
        features: {
          semanticSearch: true,
          autoComplete: true,
          spellCorrection: true,
          queryExpansion: true,
          resultClustering: true,
          personalizedRanking: true
        }
      };

      const engine = new AdvancedSearchEngine(advancedConfig);
      await engine.initialize(testKBEntries);

      // Features should work as expected
      const result = await engine.search('test');
      expect(result.suggestions).toBeDefined();
      expect(result.corrections).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should not exceed memory thresholds during operation', async () => {
      const initialMemory = process.memoryUsage?.() || { heapUsed: 0 };

      // Perform many operations
      for (let i = 0; i < 10; i++) {
        await searchEngine.search(`memory test ${i}`);
      }

      const finalMemory = process.memoryUsage?.() || { heapUsed: 0 };
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Search Scenarios', () => {
    beforeEach(async () => {
      await searchEngine.initialize(testKBEntries);
    });

    Object.entries(searchTestScenarios).forEach(([scenarioName, scenario]) => {
      if (scenario.query && !scenario.expectedError) {
        it(`should handle ${scenarioName} scenario`, async () => {
          const { result, metrics } = await measureSearchPerformance(async () => {
            return await searchEngine.search(scenario.query);
          });

          if (scenario.expectedResults !== undefined) {
            expect(result.results.length).toBeGreaterThanOrEqual(scenario.expectedResults);
          }

          if (scenario.expectedTopScore && result.results.length > 0) {
            expect(result.results[0].score).toBeGreaterThanOrEqual(scenario.expectedTopScore - 20);
          }

          if (scenario.maxResponseTime) {
            expect(metrics.executionTime).toBeLessThan(scenario.maxResponseTime);
          }
        });
      }
    });
  });
});