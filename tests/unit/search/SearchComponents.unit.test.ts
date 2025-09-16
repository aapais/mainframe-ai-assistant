/**
 * Unit Tests for Individual Search Components
 * Tests InvertedIndex, TextProcessor, QueryParser, FuzzyMatcher, RankingEngine, SearchCache
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  MockInvertedIndex,
  MockTextProcessor,
  MockQueryParser,
  MockFuzzyMatcher,
  MockRankingEngine,
  MockSearchCache,
  createTestKBEntries,
  performanceThresholds
} from '../../setup/search-test-setup';
import { TestDataFactory, measureMemoryUsage } from '../../setup/test-setup';

describe('Search Components Unit Tests', () => {
  let testEntries: any[];

  beforeEach(() => {
    testEntries = createTestKBEntries(20);
  });

  describe('InvertedIndex', () => {
    let index: MockInvertedIndex;

    beforeEach(() => {
      index = new MockInvertedIndex();
    });

    it('should build index from documents', async () => {
      await index.buildIndex(testEntries);

      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(testEntries.length);
      expect(stats.totalTerms).toBeGreaterThan(0);
    });

    it('should search for terms and return posting lists', async () => {
      await index.buildIndex(testEntries);

      const results = index.search(['test', 'problem']);
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBeGreaterThan(0);

      // Each result should have docId and frequency
      const firstResult = Array.from(results.values())[0];
      expect(firstResult).toHaveProperty('docId');
      expect(firstResult).toHaveProperty('frequency');
    });

    it('should find terms with prefix', async () => {
      await index.buildIndex(testEntries);

      const terms = index.findTermsWithPrefix('test', 5);
      expect(Array.isArray(terms)).toBe(true);
      expect(terms.length).toBeLessThanOrEqual(5);

      terms.forEach(term => {
        expect(term.toLowerCase().startsWith('test')).toBe(true);
      });
    });

    it('should add individual documents', async () => {
      await index.buildIndex([]);
      const initialStats = index.getStats();

      const newDoc = TestDataFactory.createKBEntry();
      await index.addDocument(newDoc);

      const updatedStats = index.getStats();
      expect(updatedStats.totalDocuments).toBe(initialStats.totalDocuments + 1);
    });

    it('should remove documents', async () => {
      await index.buildIndex(testEntries);
      const docToRemove = testEntries[0];

      const removed = await index.removeDocument(docToRemove.id);
      expect(removed).toBe(true);

      const document = index.getDocument(docToRemove.id);
      expect(document).toBeUndefined();
    });

    it('should optimize index efficiently', async () => {
      await index.buildIndex(testEntries);

      const startTime = performance.now();
      await index.optimizeIndex();
      const optimizationTime = performance.now() - startTime;

      expect(optimizationTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle empty search terms', async () => {
      await index.buildIndex(testEntries);

      const results = index.search([]);
      expect(results.size).toBe(0);
    });

    it('should handle non-existent terms', async () => {
      await index.buildIndex(testEntries);

      const results = index.search(['nonexistentterm123']);
      expect(results.size).toBe(0);
    });
  });

  describe('TextProcessor', () => {
    let processor: MockTextProcessor;

    beforeEach(() => {
      processor = new MockTextProcessor();
    });

    it('should process text into tokens', () => {
      const text = 'This is a test VSAM Status 35 error message';
      const tokens = processor.processText(text);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      tokens.forEach(token => {
        expect(token).toHaveProperty('original');
        expect(token).toHaveProperty('normalized');
        expect(token).toHaveProperty('stemmed');
        expect(token).toHaveProperty('position');
      });
    });

    it('should tokenize queries', () => {
      const query = 'VSAM Status OR DB2 error';
      const tokens = processor.tokenizeQuery(query);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens).toContain('vsam');
      expect(tokens).toContain('status');
      expect(tokens).toContain('db2');
    });

    it('should handle empty text', () => {
      const tokens = processor.processText('');
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(0);
    });

    it('should handle special characters', () => {
      const text = 'S0C7 @#$% error with special characters!';
      const tokens = processor.processText(text);

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some(t => t.original.includes('s0c7'))).toBe(true);
    });

    it('should filter out short words', () => {
      const text = 'a an the is at on in';
      const tokens = processor.processText(text);

      // Short words (length <= 2) should be filtered out
      expect(tokens.length).toBe(0);
    });

    it('should normalize case consistently', () => {
      const text1 = 'VSAM Status Error';
      const text2 = 'vsam status error';

      const tokens1 = processor.processText(text1);
      const tokens2 = processor.processText(text2);

      expect(tokens1).toEqual(tokens2);
    });
  });

  describe('QueryParser', () => {
    let parser: MockQueryParser;
    let processor: MockTextProcessor;

    beforeEach(() => {
      processor = new MockTextProcessor();
      parser = new MockQueryParser();
    });

    it('should parse basic query', () => {
      const query = 'VSAM Status 35';
      const parsed = parser.parse(query);

      expect(parsed).toHaveProperty('originalQuery', query);
      expect(parsed).toHaveProperty('terms');
      expect(parsed).toHaveProperty('operators');
      expect(parsed).toHaveProperty('filters');
      expect(Array.isArray(parsed.terms)).toBe(true);
    });

    it('should extract search terms', () => {
      const parsedQuery = {
        terms: ['vsam', 'status', '35'],
        operators: [],
        filters: {}
      };

      const searchTerms = parser.extractSearchTerms(parsedQuery);

      expect(searchTerms).toHaveProperty('required');
      expect(searchTerms).toHaveProperty('optional');
      expect(searchTerms).toHaveProperty('phrases');
      expect(Array.isArray(searchTerms.required)).toBe(true);
    });

    it('should handle boolean operators', () => {
      const query = 'VSAM AND Status OR error';
      const parsed = parser.parse(query);

      expect(parsed.terms).toContain('vsam');
      expect(parsed.terms).toContain('status');
      expect(parsed.terms).toContain('error');
    });

    it('should handle quoted phrases', () => {
      const query = '"VSAM Status 35" error';
      const parsed = parser.parse(query);

      expect(parsed.originalQuery).toBe(query);
    });

    it('should handle field filters', () => {
      const query = 'category:VSAM error';
      const parsed = parser.parse(query);

      expect(parsed.originalQuery).toBe(query);
    });

    it('should handle empty query', () => {
      const parsed = parser.parse('');

      expect(parsed.terms).toHaveLength(0);
    });

    it('should handle malformed queries gracefully', () => {
      const malformedQueries = [
        'AND OR',
        '((()))',
        '""""',
        'category:',
        'field:value:invalid'
      ];

      malformedQueries.forEach(query => {
        expect(() => parser.parse(query)).not.toThrow();
      });
    });
  });

  describe('FuzzyMatcher', () => {
    let fuzzyMatcher: MockFuzzyMatcher;

    beforeEach(() => {
      fuzzyMatcher = new MockFuzzyMatcher();
    });

    it('should suggest similar terms', () => {
      const vocabulary = ['status', 'error', 'vsam', 'database', 'connection'];
      const suggestions = fuzzyMatcher.suggest('staus', vocabulary, 3);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(3);
      expect(suggestions).toContain('status');
    });

    it('should handle exact matches', () => {
      const vocabulary = ['status', 'error', 'vsam'];
      const suggestions = fuzzyMatcher.suggest('status', vocabulary, 3);

      expect(suggestions[0]).toBe('status');
    });

    it('should return empty array for no matches', () => {
      const vocabulary = ['completely', 'different', 'words'];
      const suggestions = fuzzyMatcher.suggest('xyz123', vocabulary, 3);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    it('should respect suggestion limit', () => {
      const vocabulary = Array.from({ length: 100 }, (_, i) => `word${i}`);
      const suggestions = fuzzyMatcher.suggest('word', vocabulary, 5);

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should clear cache', () => {
      expect(() => fuzzyMatcher.clearCache()).not.toThrow();
    });

    it('should handle empty vocabulary', () => {
      const suggestions = fuzzyMatcher.suggest('test', [], 5);
      expect(suggestions).toHaveLength(0);
    });

    it('should handle special characters in terms', () => {
      const vocabulary = ['S0C7', 'IEF212I', 'DB2-SQL'];
      const suggestions = fuzzyMatcher.suggest('s0c7', vocabulary, 3);

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('RankingEngine', () => {
    let rankingEngine: MockRankingEngine;

    beforeEach(() => {
      rankingEngine = new MockRankingEngine();
    });

    it('should rank documents by relevance', () => {
      const parsedQuery = {
        terms: ['test', 'error'],
        operators: [],
        filters: {}
      };

      const postingLists = new Map([
        ['doc1', { docId: 'doc1', frequency: 3, positions: [0, 5, 10] }],
        ['doc2', { docId: 'doc2', frequency: 1, positions: [7] }],
        ['doc3', { docId: 'doc3', frequency: 2, positions: [2, 8] }]
      ]);

      const collection = {
        documents: new Map(),
        totalDocuments: 3,
        averageDocumentLength: 100,
        fieldAverageLength: {}
      };

      const rankings = rankingEngine.rankDocuments(
        parsedQuery,
        postingLists,
        collection,
        { algorithm: 'bm25' }
      );

      expect(Array.isArray(rankings)).toBe(true);
      expect(rankings.length).toBeGreaterThan(0);

      rankings.forEach(ranking => {
        expect(ranking).toHaveProperty('docId');
        expect(ranking).toHaveProperty('score');
        expect(ranking).toHaveProperty('explanation');
        expect(typeof ranking.score).toBe('number');
        expect(ranking.score).toBeGreaterThan(0);
      });

      // Rankings should be in descending score order
      for (let i = 1; i < rankings.length; i++) {
        expect(rankings[i - 1].score).toBeGreaterThanOrEqual(rankings[i].score);
      }
    });

    it('should handle empty posting lists', () => {
      const parsedQuery = { terms: [], operators: [], filters: {} };
      const postingLists = new Map();
      const collection = { documents: new Map(), totalDocuments: 0, averageDocumentLength: 0, fieldAverageLength: {} };

      const rankings = rankingEngine.rankDocuments(parsedQuery, postingLists, collection, {});

      expect(rankings).toHaveLength(0);
    });

    it('should support different ranking algorithms', () => {
      const baseParams = {
        parsedQuery: { terms: ['test'], operators: [], filters: {} },
        postingLists: new Map([['doc1', { docId: 'doc1', frequency: 1, positions: [0] }]]),
        collection: { documents: new Map(), totalDocuments: 1, averageDocumentLength: 100, fieldAverageLength: {} }
      };

      const algorithms = ['tfidf', 'bm25', 'combined'];

      algorithms.forEach(algorithm => {
        const rankings = rankingEngine.rankDocuments(
          baseParams.parsedQuery,
          baseParams.postingLists,
          baseParams.collection,
          { algorithm }
        );

        expect(rankings.length).toBeGreaterThan(0);
      });
    });

    it('should clear cache', () => {
      expect(() => rankingEngine.clearCache()).not.toThrow();
    });

    it('should provide statistics', () => {
      const stats = rankingEngine.getStats();

      expect(stats).toHaveProperty('totalRankings');
      expect(stats).toHaveProperty('averageRankingTime');
      expect(typeof stats.totalRankings).toBe('number');
      expect(typeof stats.averageRankingTime).toBe('number');
    });
  });

  describe('SearchCache', () => {
    let cache: MockSearchCache;

    beforeEach(() => {
      cache = new MockSearchCache({
        maxSize: 10 * 1024 * 1024, // 10MB
        defaultTTL: 300000 // 5 minutes
      });
    });

    it('should store and retrieve cached values', async () => {
      const key = 'test-key';
      const value = { test: 'data', timestamp: Date.now() };

      await cache.set(key, value);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should generate consistent query cache keys', () => {
      const query = 'test query';
      const options = { limit: 10, offset: 0 };

      const key1 = cache.generateQueryCacheKey(query, options);
      const key2 = cache.generateQueryCacheKey(query, options);

      expect(key1).toBe(key2);
    });

    it('should delete entries by pattern', async () => {
      await cache.set('user:123:search:1', 'data1');
      await cache.set('user:123:search:2', 'data2');
      await cache.set('user:456:search:1', 'data3');

      await cache.deletePattern('user:123:*');

      expect(await cache.get('user:123:search:1')).toBeNull();
      expect(await cache.get('user:123:search:2')).toBeNull();
      expect(await cache.get('user:456:search:1')).not.toBeNull();
    });

    it('should clear all cached data', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should track cache statistics', async () => {
      // Generate some cache activity
      await cache.set('key1', 'value1');
      await cache.get('key1'); // Hit
      await cache.get('missing'); // Miss

      const stats = cache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should handle cache warming', async () => {
      const warmingData = {
        popularQueries: ['error', 'status', 'vsam'],
        recentSearches: ['recent query 1', 'recent query 2'],
        predictedTerms: ['predicted1', 'predicted2']
      };

      await expect(cache.warmCache(warmingData)).resolves.not.toThrow();
    });

    it('should close gracefully', async () => {
      await expect(cache.close()).resolves.not.toThrow();
    });
  });

  describe('Component Integration', () => {
    it('should work together in search pipeline', async () => {
      const processor = new MockTextProcessor();
      const parser = new MockQueryParser();
      const index = new MockInvertedIndex();
      const fuzzyMatcher = new MockFuzzyMatcher();
      const rankingEngine = new MockRankingEngine();

      // Build index
      await index.buildIndex(testEntries);

      // Process query
      const query = 'test error status';
      const parsedQuery = parser.parse(query);
      const searchTerms = parser.extractSearchTerms(parsedQuery);

      // Search index
      const postingLists = index.search(searchTerms.required);

      // Rank results
      const collection = {
        documents: new Map(),
        totalDocuments: testEntries.length,
        averageDocumentLength: 100,
        fieldAverageLength: {}
      };

      const rankings = rankingEngine.rankDocuments(parsedQuery, postingLists, collection, {});

      // All components should work together
      expect(postingLists.size).toBeGreaterThan(0);
      expect(rankings.length).toBeGreaterThan(0);
    });

    it('should handle performance requirements across components', async () => {
      const startTime = performance.now();

      const processor = new MockTextProcessor();
      const index = new MockInvertedIndex();

      // Build index (should be fast for test data)
      await index.buildIndex(testEntries);

      // Process text (should be very fast)
      const text = testEntries.map(e => `${e.title} ${e.problem}`).join(' ');
      processor.processText(text);

      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(performanceThresholds.indexing.small);
    });
  });
});