/**
 * Comprehensive Functional Test Suite for Search Features
 * Tests all search functionality including query processing, ranking, caching, and analytics
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { AdvancedSearchEngine } from '../../../src/services/search/AdvancedSearchEngine';
import QueryParser from '../../../src/services/search/QueryParser';
import RankingEngine from '../../../src/services/search/RankingEngine';
import SearchCache from '../../../src/services/search/SearchCache';
import { KBEntry, SearchOptions, SearchResult } from '../../../src/types';
import { SearchFunctionalTestData } from './fixtures/SearchFunctionalTestData';
import { SearchMetricsCollector } from './helpers/SearchMetricsCollector';
import { SearchAssertions } from './helpers/SearchAssertions';

describe('Search Functional Test Suite', () => {
  let searchEngine: AdvancedSearchEngine;
  let queryParser: QueryParser;
  let rankingEngine: RankingEngine;
  let searchCache: SearchCache;
  let testData: SearchFunctionalTestData;
  let metricsCollector: SearchMetricsCollector;
  let assertions: SearchAssertions;

  // Test configuration
  const testConfig = {
    timeout: 30000,
    maxResults: 100,
    cacheEnabled: true,
    performanceThresholds: {
      searchResponseTime: 1000, // 1 second max
      cacheHitRate: 0.7,        // 70% cache hit rate
      indexingTime: 5000        // 5 seconds max for full index
    }
  };

  beforeAll(async () => {
    // Initialize test infrastructure
    testData = new SearchFunctionalTestData();
    metricsCollector = new SearchMetricsCollector();
    assertions = new SearchAssertions();

    // Initialize search components
    searchEngine = new AdvancedSearchEngine({
      maxResults: testConfig.maxResults,
      cacheEnabled: testConfig.cacheEnabled,
      defaultTimeout: testConfig.timeout
    });

    queryParser = new QueryParser();
    rankingEngine = new RankingEngine();
    searchCache = new SearchCache();

    // Load test data and initialize search engine
    const entries = await testData.generateTestEntries(1000);
    await searchEngine.initialize(entries);

    console.log(`Functional test suite initialized with ${entries.length} test entries`);
  });

  afterAll(async () => {
    await searchEngine.shutdown();
    await searchCache.close();
    await metricsCollector.generateReport();
  });

  beforeEach(() => {
    metricsCollector.startTest();
  });

  afterEach(() => {
    metricsCollector.endTest();
  });

  describe('Query Processing and Parsing', () => {
    test('should parse simple text queries correctly', async () => {
      const testCases = [
        { query: 'VSAM error', expectedTerms: ['vsam', 'error'] },
        { query: 'DB2 connection timeout', expectedTerms: ['db2', 'connection', 'timeout'] },
        { query: 'JCL step failure', expectedTerms: ['jcl', 'step', 'failure'] }
      ];

      for (const testCase of testCases) {
        const parsed = queryParser.parse(testCase.query);

        assertions.assertQueryParsing(parsed, {
          type: 'simple',
          termCount: testCase.expectedTerms.length,
          containsTerms: testCase.expectedTerms
        });

        const searchTerms = queryParser.extractSearchTerms(parsed);
        expect(searchTerms.optional.length).toBeGreaterThan(0);

        metricsCollector.recordQueryParsing(testCase.query, parsed);
      }
    });

    test('should handle boolean query operators correctly', async () => {
      const testCases = [
        {
          query: 'VSAM AND DB2',
          expectedType: 'boolean',
          expectedOperators: ['AND']
        },
        {
          query: 'CICS OR IMS',
          expectedType: 'boolean',
          expectedOperators: ['OR']
        },
        {
          query: 'JCL NOT COBOL',
          expectedType: 'boolean',
          expectedOperators: ['NOT']
        },
        {
          query: '(VSAM OR DB2) AND error',
          expectedType: 'mixed',
          expectedOperators: ['OR', 'AND']
        }
      ];

      for (const testCase of testCases) {
        const parsed = queryParser.parse(testCase.query);

        expect(parsed.type).toBe(testCase.expectedType);

        const hasExpectedOperators = testCase.expectedOperators.every(op =>
          parsed.terms.some(term => term.operator === op)
        );
        expect(hasExpectedOperators).toBe(true);

        metricsCollector.recordBooleanQuery(testCase.query, parsed);
      }
    });

    test('should process phrase queries with quotes', async () => {
      const testCases = [
        { query: '"VSAM file error"', expectedPhrases: ['vsam file error'] },
        { query: '"DB2 SQL error" AND timeout', expectedPhrases: ['db2 sql error'] },
        { query: '"JCL step" OR "job failure"', expectedPhrases: ['jcl step', 'job failure'] }
      ];

      for (const testCase of testCases) {
        const parsed = queryParser.parse(testCase.query);

        const phraseTerms = parsed.terms.filter(term => term.operator === 'PHRASE');
        expect(phraseTerms.length).toBe(testCase.expectedPhrases.length);

        for (const expectedPhrase of testCase.expectedPhrases) {
          const hasPhrase = phraseTerms.some(term =>
            term.text.includes(expectedPhrase.replace(/\s+/g, ' ').toLowerCase())
          );
          expect(hasPhrase).toBe(true);
        }

        metricsCollector.recordPhraseQuery(testCase.query, parsed);
      }
    });

    test('should handle field-specific queries', async () => {
      const testCases = [
        { query: 'title:"VSAM error"', field: 'title', value: 'vsam error' },
        { query: 'category:DB2 AND problem:connection', fields: ['category', 'problem'] },
        { query: 'tags:JCL OR tags:COBOL', field: 'tags', values: ['jcl', 'cobol'] }
      ];

      for (const testCase of testCases) {
        const parsed = queryParser.parse(testCase.query);

        const fieldTerms = parsed.terms.filter(term => term.field !== undefined);
        expect(fieldTerms.length).toBeGreaterThan(0);

        if (testCase.field && testCase.value) {
          const hasFieldTerm = fieldTerms.some(term =>
            term.field === testCase.field && term.text.includes(testCase.value)
          );
          expect(hasFieldTerm).toBe(true);
        }

        metricsCollector.recordFieldQuery(testCase.query, parsed);
      }
    });

    test('should validate query syntax and provide error messages', async () => {
      const invalidQueries = [
        { query: 'VSAM AND', expectedError: 'Query ends with operator' },
        { query: '"unclosed quote', expectedError: 'Unmatched quotation marks' },
        { query: 'test (unmatched paren', expectedError: 'Unmatched opening parenthesis' },
        { query: 'test unmatched)', expectedError: 'Unmatched closing parenthesis' }
      ];

      for (const testCase of invalidQueries) {
        const validation = queryParser.validate(testCase.query);

        expect(validation.valid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);

        const hasExpectedError = validation.errors.some(error =>
          error.includes(testCase.expectedError)
        );
        expect(hasExpectedError).toBe(true);

        metricsCollector.recordQueryValidation(testCase.query, validation);
      }
    });
  });

  describe('Search Result Ranking and Relevance', () => {
    test('should rank results by relevance using BM25 algorithm', async () => {
      const queries = [
        'VSAM file error',
        'DB2 connection timeout',
        'JCL step failure ABEND'
      ];

      for (const query of queries) {
        const results = await searchEngine.search(query, {
          limit: 10,
          sortBy: 'relevance'
        });

        // Verify results are sorted by score (descending)
        assertions.assertResultsRankedByRelevance(results.results);

        // Verify BM25 scores are calculated correctly
        for (const result of results.results) {
          expect(result.score).toBeGreaterThan(0);
          expect(result.explanation).toBeDefined();
        }

        // Verify top results are actually relevant
        const topResult = results.results[0];
        assertions.assertResultRelevance(topResult, query);

        metricsCollector.recordRankingTest(query, results.results);
      }
    });

    test('should apply field-specific boosting correctly', async () => {
      // Test that title matches get higher scores than content matches
      const titleQuery = 'VSAM error handling';

      const results = await searchEngine.search(titleQuery, { limit: 20 });

      // Find results with title matches vs content-only matches
      const titleMatches = results.results.filter(result =>
        result.entry.title.toLowerCase().includes('vsam') ||
        result.entry.title.toLowerCase().includes('error')
      );

      const contentOnlyMatches = results.results.filter(result =>
        !result.entry.title.toLowerCase().includes('vsam') &&
        !result.entry.title.toLowerCase().includes('error') &&
        (result.entry.problem.toLowerCase().includes('vsam') ||
         result.entry.solution.toLowerCase().includes('vsam'))
      );

      if (titleMatches.length > 0 && contentOnlyMatches.length > 0) {
        const avgTitleScore = titleMatches.reduce((sum, r) => sum + r.score, 0) / titleMatches.length;
        const avgContentScore = contentOnlyMatches.reduce((sum, r) => sum + r.score, 0) / contentOnlyMatches.length;

        expect(avgTitleScore).toBeGreaterThan(avgContentScore);
      }

      metricsCollector.recordFieldBoostingTest(titleQuery, results.results);
    });

    test('should handle fuzzy matching for misspelled terms', async () => {
      const fuzzyQueries = [
        { query: 'VSEM error', intended: 'VSAM error' },
        { query: 'DB3 connection', intended: 'DB2 connection' },
        { query: 'JCK step failure', intended: 'JCL step failure' }
      ];

      for (const testCase of fuzzyQueries) {
        const fuzzyResults = await searchEngine.search(testCase.query, {
          fuzzyEnabled: true,
          limit: 10
        });

        const exactResults = await searchEngine.search(testCase.intended, {
          fuzzyEnabled: false,
          limit: 10
        });

        // Fuzzy search should return some results even with misspelling
        expect(fuzzyResults.results.length).toBeGreaterThan(0);

        // Should suggest corrections
        expect(fuzzyResults.corrections.length).toBeGreaterThan(0);

        // Fuzzy results should be somewhat similar to exact results
        if (exactResults.results.length > 0) {
          const commonResults = fuzzyResults.results.filter(fuzzyResult =>
            exactResults.results.some(exactResult =>
              exactResult.entry.id === fuzzyResult.entry.id
            )
          );

          expect(commonResults.length).toBeGreaterThan(0);
        }

        metricsCollector.recordFuzzyMatchingTest(testCase.query, fuzzyResults.results);
      }
    });

    test('should prioritize exact phrase matches', async () => {
      const phraseQuery = '"VSAM file error"';
      const results = await searchEngine.search(phraseQuery);

      // Verify that results containing the exact phrase get higher scores
      const exactPhraseMatches = results.results.filter(result => {
        const fullText = `${result.entry.title} ${result.entry.problem} ${result.entry.solution}`.toLowerCase();
        return fullText.includes('vsam file error');
      });

      const partialMatches = results.results.filter(result => {
        const fullText = `${result.entry.title} ${result.entry.problem} ${result.entry.solution}`.toLowerCase();
        return !fullText.includes('vsam file error') &&
               (fullText.includes('vsam') || fullText.includes('file') || fullText.includes('error'));
      });

      if (exactPhraseMatches.length > 0 && partialMatches.length > 0) {
        const avgExactScore = exactPhraseMatches.reduce((sum, r) => sum + r.score, 0) / exactPhraseMatches.length;
        const avgPartialScore = partialMatches.reduce((sum, r) => sum + r.score, 0) / partialMatches.length;

        expect(avgExactScore).toBeGreaterThan(avgPartialScore);
      }

      metricsCollector.recordPhraseMatchingTest(phraseQuery, results.results);
    });
  });

  describe('Filtering and Faceted Search', () => {
    test('should filter results by category', async () => {
      const categories = ['VSAM', 'DB2', 'JCL', 'CICS'];

      for (const category of categories) {
        const results = await searchEngine.search('error', {
          category: category,
          limit: 20
        });

        // All results should belong to the specified category
        for (const result of results.results) {
          expect(result.entry.category).toBe(category);
        }

        // Should return category facets
        expect(results.facets).toBeDefined();
        const categoryFacet = results.facets?.find(f => f.field === 'category');
        expect(categoryFacet).toBeDefined();

        metricsCollector.recordCategoryFilterTest(category, results.results);
      }
    });

    test('should filter results by tags', async () => {
      const tagFilters = [
        ['error', 'troubleshooting'],
        ['performance', 'tuning'],
        ['configuration', 'setup']
      ];

      for (const tags of tagFilters) {
        const results = await searchEngine.search('mainframe', {
          tags: tags,
          limit: 15
        });

        // Results should contain at least one of the specified tags
        for (const result of results.results) {
          const hasTag = tags.some(tag =>
            result.entry.tags.some(entryTag =>
              entryTag.toLowerCase().includes(tag.toLowerCase())
            )
          );
          expect(hasTag).toBe(true);
        }

        metricsCollector.recordTagFilterTest(tags, results.results);
      }
    });

    test('should support multiple filter combinations', async () => {
      const filterCombinations = [
        { category: 'VSAM', tags: ['error'] },
        { category: 'DB2', tags: ['performance', 'tuning'] },
        { category: 'JCL', tags: ['troubleshooting'] }
      ];

      for (const filters of filterCombinations) {
        const results = await searchEngine.search('mainframe system', filters);

        // Verify category filter
        for (const result of results.results) {
          expect(result.entry.category).toBe(filters.category);
        }

        // Verify tag filter
        for (const result of results.results) {
          const hasTag = filters.tags.some(tag =>
            result.entry.tags.some(entryTag =>
              entryTag.toLowerCase().includes(tag.toLowerCase())
            )
          );
          expect(hasTag).toBe(true);
        }

        metricsCollector.recordMultiFilterTest(filters, results.results);
      }
    });

    test('should generate accurate facet counts', async () => {
      const results = await searchEngine.search('error system', { limit: 50 });

      expect(results.facets).toBeDefined();
      expect(results.facets!.length).toBeGreaterThan(0);

      // Verify facet counts are accurate
      for (const facet of results.facets!) {
        let totalCount = 0;

        for (const value of facet.values) {
          expect(value.count).toBeGreaterThan(0);
          totalCount += value.count;
        }

        // Total facet counts should not exceed result count
        expect(totalCount).toBeLessThanOrEqual(results.results.length);
      }

      metricsCollector.recordFacetTest(results.facets!);
    });
  });

  describe('Caching and Performance Optimization', () => {
    test('should cache search results correctly', async () => {
      const query = 'VSAM file access error';
      const options = { limit: 10, category: 'VSAM' };

      // First search - cache miss
      const firstResults = await searchEngine.search(query, options);
      expect(firstResults.metrics.cacheHit).toBe(false);

      // Second search - should hit cache
      const secondResults = await searchEngine.search(query, options);
      expect(secondResults.metrics.cacheHit).toBe(true);

      // Results should be identical
      expect(secondResults.results.length).toBe(firstResults.results.length);
      assertions.assertResultsEqual(firstResults.results, secondResults.results);

      metricsCollector.recordCacheTest(query, firstResults.metrics, secondResults.metrics);
    });

    test('should invalidate cache when documents are modified', async () => {
      const query = 'cache invalidation test';

      // Initial search
      const initialResults = await searchEngine.search(query);

      // Add a new document
      const newEntry: KBEntry = testData.createTestEntry({
        title: 'Cache invalidation test document',
        problem: 'Testing cache invalidation',
        solution: 'Document added to test cache invalidation',
        category: 'Testing'
      });

      await searchEngine.addDocument(newEntry);

      // Search again - should not hit cache and should include new document
      const updatedResults = await searchEngine.search(query);
      expect(updatedResults.metrics.cacheHit).toBe(false);
      expect(updatedResults.results.length).toBeGreaterThanOrEqual(initialResults.results.length);

      // Should find the new document
      const foundNewDoc = updatedResults.results.some(result =>
        result.entry.id === newEntry.id
      );
      expect(foundNewDoc).toBe(true);

      metricsCollector.recordCacheInvalidationTest(query, newEntry.id);
    });

    test('should meet performance thresholds for search response time', async () => {
      const performanceQueries = [
        'simple query',
        'VSAM AND DB2 OR JCL',
        '"complex phrase query with multiple terms"',
        'category:VSAM tags:error,performance'
      ];

      for (const query of performanceQueries) {
        const startTime = Date.now();
        const results = await searchEngine.search(query, { limit: 20 });
        const responseTime = Date.now() - startTime;

        expect(responseTime).toBeLessThan(testConfig.performanceThresholds.searchResponseTime);
        expect(results.metrics.totalTime).toBeLessThan(testConfig.performanceThresholds.searchResponseTime);

        metricsCollector.recordPerformanceTest(query, responseTime, results.metrics);
      }
    });

    test('should achieve target cache hit rate', async () => {
      const queries = [
        'VSAM error',
        'DB2 connection',
        'JCL failure',
        'CICS transaction',
        'IMS database'
      ];

      // Run queries multiple times to build cache
      for (let i = 0; i < 3; i++) {
        for (const query of queries) {
          await searchEngine.search(query);
        }
      }

      // Get cache statistics
      const stats = searchEngine.getStats();
      expect(stats.cache.hitRate).toBeGreaterThanOrEqual(testConfig.performanceThresholds.cacheHitRate);

      metricsCollector.recordCacheHitRateTest(stats.cache.hitRate);
    });
  });

  describe('Analytics and Metrics Collection', () => {
    test('should collect search metrics accurately', async () => {
      const query = 'analytics test query';
      const results = await searchEngine.search(query);

      // Verify metrics are collected
      expect(results.metrics).toBeDefined();
      expect(results.metrics.totalTime).toBeGreaterThan(0);
      expect(results.metrics.queryTime).toBeGreaterThan(0);
      expect(results.metrics.indexTime).toBeGreaterThan(0);
      expect(results.metrics.rankingTime).toBeGreaterThan(0);
      expect(results.metrics.resultCount).toBe(results.results.length);
      expect(results.metrics.algorithm).toBeDefined();

      metricsCollector.recordMetricsCollectionTest(results.metrics);
    });

    test('should track search engine statistics', async () => {
      // Perform several searches
      const queries = ['test1', 'test2', 'test3'];
      for (const query of queries) {
        await searchEngine.search(query);
      }

      const stats = searchEngine.getStats();

      expect(stats.engine.totalSearches).toBeGreaterThan(0);
      expect(stats.engine.averageResponseTime).toBeGreaterThan(0);
      expect(stats.index.totalDocuments).toBeGreaterThan(0);
      expect(stats.cache.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.health.initialized).toBe(true);

      metricsCollector.recordEngineStatsTest(stats);
    });

    test('should provide detailed score explanations', async () => {
      const query = 'VSAM file error detailed explanation';
      const results = await searchEngine.search(query, { limit: 5 });

      for (const result of results.results) {
        expect(result.explanation).toBeDefined();
        expect(result.explanation.length).toBeGreaterThan(0);
        expect(result.score).toBeGreaterThan(0);

        // Verify explanation contains relevant information
        const explanation = result.explanation.toLowerCase();
        expect(
          explanation.includes('score') ||
          explanation.includes('relevance') ||
          explanation.includes('match')
        ).toBe(true);
      }

      metricsCollector.recordScoreExplanationTest(query, results.results);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty queries gracefully', async () => {
      const emptyQueries = ['', '   ', '\t\n'];

      for (const query of emptyQueries) {
        const results = await searchEngine.search(query);

        expect(results.results.length).toBe(0);
        expect(results.metadata.totalResults).toBe(0);
        expect(results.suggestions.length).toBe(0);

        metricsCollector.recordEmptyQueryTest(query);
      }
    });

    test('should handle very long queries', async () => {
      const longQuery = 'VSAM file error '.repeat(100); // 1600+ characters

      const results = await searchEngine.search(longQuery);

      // Should still return results, might be limited
      expect(results.metadata.processingTime).toBeLessThan(testConfig.timeout);

      metricsCollector.recordLongQueryTest(longQuery, results);
    });

    test('should handle special characters in queries', async () => {
      const specialCharQueries = [
        'error@system.com',
        'file-name_with-special.chars',
        'query with (parentheses) and [brackets]',
        'query with "quotes" and \'apostrophes\'',
        'query/with/slashes\\and\\backslashes'
      ];

      for (const query of specialCharQueries) {
        const results = await searchEngine.search(query);

        // Should not throw errors
        expect(results).toBeDefined();
        expect(results.metadata.processingTime).toBeLessThan(testConfig.timeout);

        metricsCollector.recordSpecialCharQueryTest(query, results);
      }
    });

    test('should handle concurrent search requests', async () => {
      const concurrentQueries = [
        'concurrent test 1',
        'concurrent test 2',
        'concurrent test 3',
        'concurrent test 4',
        'concurrent test 5'
      ];

      const startTime = Date.now();
      const promises = concurrentQueries.map(query =>
        searchEngine.search(query, { limit: 10 })
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All searches should complete successfully
      expect(results.length).toBe(concurrentQueries.length);

      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.metadata.processingTime).toBeLessThan(testConfig.timeout);
      }

      // Concurrent execution should be faster than sequential
      expect(totalTime).toBeLessThan(concurrentQueries.length * 1000);

      metricsCollector.recordConcurrentSearchTest(concurrentQueries, results, totalTime);
    });
  });

  describe('Auto-complete and Suggestions', () => {
    test('should provide query suggestions for partial input', async () => {
      const partialQueries = [
        { input: 'VSA', expectedSuggestions: ['VSAM'] },
        { input: 'DB', expectedSuggestions: ['DB2'] },
        { input: 'err', expectedSuggestions: ['error'] }
      ];

      for (const testCase of partialQueries) {
        const suggestions = await searchEngine.suggest(testCase.input, 10);

        expect(suggestions.length).toBeGreaterThan(0);

        // Check if expected suggestions are present
        for (const expectedSuggestion of testCase.expectedSuggestions) {
          const hasSuggestion = suggestions.some(suggestion =>
            suggestion.toLowerCase().includes(expectedSuggestion.toLowerCase())
          );
          expect(hasSuggestion).toBe(true);
        }

        metricsCollector.recordSuggestionTest(testCase.input, suggestions);
      }
    });

    test('should provide spelling corrections for misspelled queries', async () => {
      const misspelledQueries = [
        { query: 'VSEM error', expectedCorrection: 'VSAM error' },
        { query: 'DB3 connection', expectedCorrection: 'DB2 connection' },
        { query: 'JCK failure', expectedCorrection: 'JCL failure' }
      ];

      for (const testCase of misspelledQueries) {
        const corrections = await searchEngine.correct(testCase.query);

        expect(corrections.length).toBeGreaterThan(0);

        // Check if the correction is reasonable
        const hasReasonableCorrection = corrections.some(correction =>
          correction.toLowerCase().includes(testCase.expectedCorrection.toLowerCase().split(' ')[0])
        );
        expect(hasReasonableCorrection).toBe(true);

        metricsCollector.recordSpellCorrectionTest(testCase.query, corrections);
      }
    });
  });
});