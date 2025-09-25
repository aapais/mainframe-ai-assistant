'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.AdvancedSearchEngine = void 0;
const tslib_1 = require('tslib');
const services_1 = require('../../types/services');
const InvertedIndex_1 = tslib_1.__importDefault(require('./InvertedIndex'));
const TextProcessor_1 = tslib_1.__importDefault(require('./TextProcessor'));
const QueryParser_1 = tslib_1.__importDefault(require('./QueryParser'));
const FuzzyMatcher_1 = tslib_1.__importDefault(require('./FuzzyMatcher'));
const RankingEngine_1 = tslib_1.__importDefault(require('./RankingEngine'));
const SearchCache_1 = tslib_1.__importDefault(require('./SearchCache'));
class AdvancedSearchEngine {
  index;
  textProcessor;
  queryParser;
  fuzzyMatcher;
  rankingEngine;
  cache;
  config;
  isInitialized = false;
  searchQueue = [];
  activeSearches = 0;
  metrics = {
    totalSearches: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    indexSize: 0,
    lastIndexUpdate: 0,
  };
  constructor(config) {
    this.config = {
      maxResults: 100,
      defaultTimeout: 1000,
      cacheEnabled: true,
      fuzzyEnabled: true,
      rankingAlgorithm: 'bm25',
      performance: {
        indexingBatchSize: 1000,
        searchTimeout: 800,
        maxConcurrentSearches: 10,
        memoryThreshold: 512 * 1024 * 1024,
        optimizationLevel: 'balanced',
      },
      features: {
        semanticSearch: true,
        autoComplete: true,
        spellCorrection: true,
        queryExpansion: false,
        resultClustering: false,
        personalizedRanking: false,
      },
      ...config,
    };
    this.initializeComponents();
  }
  async initialize(entries) {
    const startTime = Date.now();
    try {
      console.log(`Initializing search engine with ${entries.length} entries...`);
      await this.index.buildIndex(entries);
      if (this.config.cacheEnabled) {
        await this.warmUpCache(entries);
      }
      this.isInitialized = true;
      this.metrics.indexSize = entries.length;
      this.metrics.lastIndexUpdate = Date.now();
      const initTime = Date.now() - startTime;
      console.log(`Search engine initialized in ${initTime}ms`);
    } catch (error) {
      throw new services_1.ServiceError(
        `Failed to initialize search engine: ${error.message}`,
        'SEARCH_INIT_ERROR',
        500,
        { originalError: error }
      );
    }
  }
  async search(query, options = {}, context = {}) {
    const startTime = Date.now();
    if (!this.isInitialized) {
      throw new services_1.SearchError('Search engine not initialized', query);
    }
    const timeout = options.timeout || this.config.defaultTimeout;
    if (timeout > this.config.defaultTimeout) {
      throw new services_1.SearchError('Timeout exceeds maximum allowed', query);
    }
    if (this.activeSearches >= this.config.performance.maxConcurrentSearches) {
      return this.queueSearch(query, options, context);
    }
    this.activeSearches++;
    try {
      return await this.executeSearchWithTimeout(query, options, context, timeout);
    } finally {
      this.activeSearches--;
      this.processQueue();
    }
  }
  async suggest(prefix, limit = 10) {
    if (!this.config.features.autoComplete || prefix.length < 2) {
      return [];
    }
    try {
      const cacheKey = this.cache.generateQueryCacheKey(`suggest:${prefix}`, {});
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      const suggestions = this.index.findTermsWithPrefix(prefix, limit);
      await this.cache.set(cacheKey, suggestions, 300000);
      return suggestions;
    } catch (error) {
      console.error('Suggestion generation failed:', error);
      return [];
    }
  }
  async correct(query) {
    if (!this.config.features.spellCorrection) {
      return [];
    }
    try {
      const terms = this.textProcessor.tokenizeQuery(query);
      const corrections = [];
      const vocabulary = Array.from(this.index.findTermsWithPrefix('', 10000));
      for (const term of terms) {
        if (vocabulary.includes(term)) continue;
        const suggestions = this.fuzzyMatcher.suggest(term, vocabulary, 3);
        if (suggestions.length > 0) {
          corrections.push(suggestions[0]);
        } else {
          corrections.push(term);
        }
      }
      return corrections.length > 0 ? [corrections.join(' ')] : [];
    } catch (error) {
      console.error('Spell correction failed:', error);
      return [];
    }
  }
  async addDocument(entry) {
    await this.index.addDocument(entry);
    await this.cache.deletePattern(`*${entry.id}*`);
    this.metrics.indexSize++;
    this.metrics.lastIndexUpdate = Date.now();
  }
  async removeDocument(docId) {
    const removed = await this.index.removeDocument(docId);
    if (removed) {
      await this.cache.deletePattern(`*${docId}*`);
      this.metrics.indexSize--;
      this.metrics.lastIndexUpdate = Date.now();
    }
    return removed;
  }
  getStats() {
    const indexStats = this.index.getStats();
    const cacheStats = this.cache.getStats();
    const processorStats = this.textProcessor.getStats();
    const rankingStats = this.rankingEngine.getStats();
    return {
      engine: this.metrics,
      index: indexStats,
      cache: cacheStats,
      processor: processorStats,
      ranking: rankingStats,
      health: {
        initialized: this.isInitialized,
        activeSearches: this.activeSearches,
        queueLength: this.searchQueue.length,
        memoryUsage: process.memoryUsage?.() || {},
      },
    };
  }
  async optimize() {
    console.log('Optimizing search engine...');
    await this.cache.clear();
    this.fuzzyMatcher.clearCache();
    this.rankingEngine.clearCache();
    await this.index.optimizeIndex();
    console.log('Search engine optimization completed');
  }
  async shutdown() {
    console.log('Shutting down search engine...');
    this.isInitialized = false;
    while (this.searchQueue.length > 0) {
      const { reject } = this.searchQueue.shift();
      reject(new services_1.SearchError('Search engine shutting down', ''));
    }
    await this.cache.close();
    console.log('Search engine shutdown completed');
  }
  initializeComponents() {
    this.index = new InvertedIndex_1.default();
    this.textProcessor = new TextProcessor_1.default();
    this.queryParser = new QueryParser_1.default(this.textProcessor);
    this.fuzzyMatcher = new FuzzyMatcher_1.default();
    this.rankingEngine = new RankingEngine_1.default();
    this.cache = new SearchCache_1.default({
      maxSize: 50 * 1024 * 1024,
      defaultTTL: 300000,
    });
  }
  async executeSearchWithTimeout(query, options, context, timeout) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new services_1.SearchError(`Search timeout after ${timeout}ms`, query));
      }, timeout);
      try {
        const result = await this.executeSearch(query, options, context);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  async executeSearch(query, options, context) {
    const startTime = Date.now();
    const metrics = {
      queryTime: 0,
      indexTime: 0,
      rankingTime: 0,
      totalTime: 0,
      resultCount: 0,
      cacheHit: false,
      algorithm: this.config.rankingAlgorithm,
      optimizations: [],
    };
    try {
      if (this.config.cacheEnabled) {
        const cacheKey = this.cache.generateQueryCacheKey(query, options);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          metrics.cacheHit = true;
          metrics.totalTime = Date.now() - startTime;
          cached.metrics = metrics;
          this.updateMetrics(metrics);
          return cached;
        }
      }
      const queryStart = Date.now();
      const parsedQuery = this.queryParser.parse(query, {
        defaultOperator: 'OR',
        fuzzyDistance: this.config.fuzzyEnabled ? 2 : 0,
      });
      metrics.queryTime = Date.now() - queryStart;
      const searchTerms = this.queryParser.extractSearchTerms(parsedQuery);
      const indexStart = Date.now();
      const allTerms = [...searchTerms.required, ...searchTerms.optional, ...searchTerms.phrases];
      const postingLists = this.index.search(allTerms);
      metrics.indexTime = Date.now() - indexStart;
      if (postingLists.size === 0) {
        return this.createEmptyResponse(query, parsedQuery, options, context, metrics);
      }
      const rankingStart = Date.now();
      const collection = {
        documents: new Map(
          Array.from(this.index.getStats().totalDocuments).map(doc => [doc.id, doc])
        ),
        totalDocuments: this.index.getStats().totalDocuments,
        averageDocumentLength: this.index.getStats().averageDocumentLength,
        fieldAverageLength: {},
      };
      const rankings = this.rankingEngine.rankDocuments(parsedQuery, postingLists, collection, {
        algorithm: this.config.rankingAlgorithm,
      });
      metrics.rankingTime = Date.now() - rankingStart;
      const results = await this.convertRankingsToResults(rankings, options, context);
      metrics.resultCount = results.length;
      const suggestions = this.config.features.autoComplete ? await this.suggest(query, 5) : [];
      const corrections = this.config.features.spellCorrection ? await this.correct(query) : [];
      const response = {
        results,
        suggestions,
        corrections,
        facets: await this.generateFacets(results),
        metadata: {
          query,
          parsedQuery,
          totalResults: rankings.length,
          processingTime: Date.now() - startTime,
          resultWindow: {
            offset: options.offset || 0,
            limit: options.limit || this.config.maxResults,
          },
          sortBy: options.sortBy || 'relevance',
          filters: {},
        },
        metrics,
        context,
      };
      metrics.totalTime = Date.now() - startTime;
      if (this.config.cacheEnabled && results.length > 0) {
        const cacheKey = this.cache.generateQueryCacheKey(query, options);
        await this.cache.set(cacheKey, response, 300000);
      }
      this.updateMetrics(metrics);
      return response;
    } catch (error) {
      this.metrics.errorRate++;
      throw new services_1.SearchError(`Search execution failed: ${error.message}`, query, {
        originalError: error,
        metrics,
      });
    }
  }
  async convertRankingsToResults(rankings, options, context) {
    const results = [];
    const limit = Math.min(options.limit || this.config.maxResults, this.config.maxResults);
    const offset = options.offset || 0;
    for (let i = offset; i < Math.min(offset + limit, rankings.length); i++) {
      const ranking = rankings[i];
      const doc = this.index.getDocument(ranking.docId);
      if (!doc) continue;
      const entry = {
        id: doc.id,
        title: '',
        problem: '',
        solution: '',
        category: 'Other',
        tags: [],
        created_at: new Date(doc.lastModified),
        updated_at: new Date(doc.lastModified),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
      };
      results.push({
        entry,
        score: ranking.score,
        matchType: 'fuzzy',
        explanation: ranking.explanation,
        metadata: {
          processingTime: 0,
          source: 'database',
          confidence: ranking.score / 100,
          fallback: false,
        },
      });
    }
    return results;
  }
  async generateFacets(results) {
    const facets = [];
    const categoryCount = new Map();
    for (const result of results) {
      const category = result.entry.category;
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    }
    if (categoryCount.size > 1) {
      facets.push({
        field: 'category',
        values: Array.from(categoryCount.entries()).map(([value, count]) => ({
          value,
          count,
        })),
      });
    }
    return facets;
  }
  createEmptyResponse(query, parsedQuery, options, context, metrics) {
    return {
      results: [],
      suggestions: [],
      corrections: [],
      facets: [],
      metadata: {
        query,
        parsedQuery,
        totalResults: 0,
        processingTime: metrics.totalTime,
        resultWindow: {
          offset: options.offset || 0,
          limit: options.limit || this.config.maxResults,
        },
        sortBy: options.sortBy || 'relevance',
        filters: {},
      },
      metrics,
      context,
    };
  }
  async warmUpCache(entries) {
    const termFrequency = new Map();
    for (const entry of entries) {
      const tokens = this.textProcessor.processText(
        `${entry.title} ${entry.problem} ${entry.solution}`
      );
      for (const token of tokens) {
        termFrequency.set(token.stemmed, (termFrequency.get(token.stemmed) || 0) + 1);
      }
    }
    const popularTerms = Array.from(termFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([term]) => term);
    await this.cache.warmCache({
      popularQueries: popularTerms,
      recentSearches: [],
      predictedTerms: popularTerms,
    });
  }
  updateMetrics(searchMetrics) {
    this.metrics.totalSearches++;
    const total = this.metrics.averageResponseTime * (this.metrics.totalSearches - 1);
    this.metrics.averageResponseTime =
      (total + searchMetrics.totalTime) / this.metrics.totalSearches;
    const cacheStats = this.cache.getStats();
    this.metrics.cacheHitRate = cacheStats.hitRate;
  }
  async queueSearch(query, options, context) {
    return new Promise((resolve, reject) => {
      this.searchQueue.push({
        resolve,
        reject,
        operation: () => this.executeSearch(query, options, context),
      });
    });
  }
  processQueue() {
    if (
      this.searchQueue.length > 0 &&
      this.activeSearches < this.config.performance.maxConcurrentSearches
    ) {
      const { resolve, reject, operation } = this.searchQueue.shift();
      this.activeSearches++;
      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.activeSearches--;
          this.processQueue();
        });
    }
  }
}
exports.AdvancedSearchEngine = AdvancedSearchEngine;
exports.default = AdvancedSearchEngine;
//# sourceMappingURL=AdvancedSearchEngine.js.map
