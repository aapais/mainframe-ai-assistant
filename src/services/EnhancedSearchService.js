'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EnhancedSearchService = void 0;
exports.createEnhancedSearchService = createEnhancedSearchService;
const services_1 = require('../types/services');
const FTS5EnhancedSearch_1 = require('../database/FTS5EnhancedSearch');
const SearchService_1 = require('./SearchService');
class EnhancedSearchService extends SearchService_1.SearchService {
  fts5Engine;
  enhancedSearchMetrics = new Map();
  constructor(geminiConfig, database, cacheManager) {
    super(geminiConfig, database, cacheManager);
    if (database) {
      try {
        this.fts5Engine = new FTS5EnhancedSearch_1.FTS5EnhancedSearch(database);
        console.log('✅ Enhanced FTS5 search engine initialized');
      } catch (error) {
        console.warn(
          '⚠️ FTS5 enhanced search initialization failed, falling back to standard search:',
          error
        );
        this.fts5Engine = undefined;
      }
    }
  }
  async search(query, entries, options = {}) {
    const startTime = performance.now();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }
    try {
      const cacheKey = this.generateInstantCacheKey(normalizedQuery, options);
      const cachedResult = this.getFromInstantCache(cacheKey);
      if (cachedResult) {
        this.recordPerformanceMetric('instant_cache_hit', performance.now() - startTime);
        return cachedResult;
      }
      let results = [];
      if (this.fts5Engine && this.shouldUseFTS5(normalizedQuery, options)) {
        try {
          results = await this.performEnhancedFTS5Search(normalizedQuery, options);
          if (results.length > 0) {
            this.recordEnhancedSearchMetric('fts5_success', performance.now() - startTime);
            return this.finalizeResults(results, normalizedQuery, options, startTime);
          }
        } catch (error) {
          console.warn('FTS5 enhanced search failed, falling back to standard search:', error);
          this.recordEnhancedSearchMetric('fts5_fallback', performance.now() - startTime);
        }
      }
      const searchPromises = [];
      searchPromises.push(this.performOptimizedFTSSearch(normalizedQuery, entries, options));
      searchPromises.push(this.performLocalSearch(normalizedQuery, entries, options));
      if (options.useAI !== false && this.geminiConfig && entries.length <= 100) {
        searchPromises.push(
          this.performAISearch(normalizedQuery, entries, options).catch(error => {
            console.warn('AI search failed, continuing with local results:', error);
            return [];
          })
        );
      }
      const searchResults = await Promise.allSettled(searchPromises);
      const successfulResults = searchResults
        .filter(result => result.status === 'fulfilled' && result.value.length > 0)
        .map(result => result.value);
      if (successfulResults.length > 0) {
        results = this.intelligentMergeResults(successfulResults, options);
      }
      return this.finalizeResults(results, normalizedQuery, options, startTime);
    } catch (error) {
      this.recordPerformanceMetric('search_error', performance.now() - startTime);
      throw new services_1.SearchError(`Enhanced search failed: ${error.message}`, query, {
        originalError: error,
        options,
        processingTime: performance.now() - startTime,
      });
    }
  }
  async performEnhancedFTS5Search(query, options) {
    if (!this.fts5Engine) {
      throw new Error('FTS5 engine not available');
    }
    const fts5Options = {
      ...options,
      enableSnippets: true,
      snippetLength: 200,
      highlightTags: { start: '<mark>', end: '</mark>' },
      rankingProfile: this.selectRankingProfile(query),
      proximityBoost: true,
    };
    const enhancedResults = await this.fts5Engine.search(query, fts5Options);
    return enhancedResults.map(result => ({
      entry: result.entry,
      score: result.score,
      matchType: result.matchType,
      highlights: this.convertSnippetsToHighlights(result.snippets || []),
      explanation: result.explanation,
      metadata: {
        processingTime: result.debugInfo?.queryTime || 0,
        source: 'fts5_enhanced',
        confidence: result.score / 100,
        fallback: false,
        snippet: result.snippets?.[0]?.text,
        enhanced: true,
        debugInfo: result.debugInfo,
      },
    }));
  }
  shouldUseFTS5(query, options) {
    if (query.length > 20 || query.split(' ').length > 3) {
      return true;
    }
    const mainframePatterns = [
      /^S\d{3}[A-Z]?$/i,
      /^[A-Z]{3}\d{3,4}[A-Z]?$/i,
      /^\/\/[A-Z0-9@#$]{1,8}$/i,
      /VSAM|COBOL|JCL|DB2|CICS/i,
    ];
    if (mainframePatterns.some(pattern => pattern.test(query))) {
      return true;
    }
    if (options.category || (options.tags && options.tags.length > 0)) {
      return true;
    }
    return false;
  }
  selectRankingProfile(query) {
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return 'precision';
    }
    if (/VSAM|COBOL|JCL|DB2|CICS|ABEND|COMPLETION/i.test(query)) {
      return 'mainframe_focused';
    }
    if (query.split(' ').length > 4) {
      return 'recall';
    }
    return 'balanced';
  }
  convertSnippetsToHighlights(snippets) {
    const highlights = [];
    snippets.forEach(snippet => {
      snippet.highlights.forEach(highlight => {
        highlights.push({
          field: snippet.field,
          start: highlight.start,
          end: highlight.end,
          text: highlight.term,
          context: snippet.text,
        });
      });
    });
    return highlights.slice(0, 10);
  }
  finalizeResults(results, query, options, startTime) {
    results = this.applyAdvancedRanking(results, query, options);
    if (options.includeHighlights) {
      results = this.addEnhancedHighlights(results, query);
    }
    if (results.length > (options.limit || 50)) {
      results = this.streamOptimizedResults(results, options.limit || 50);
    }
    const processingTime = performance.now() - startTime;
    results.forEach((result, index) => {
      result.metadata = {
        ...result.metadata,
        processingTime: Math.round(processingTime * 100) / 100,
        source: result.metadata?.source || 'enhanced_hybrid',
        confidence: result.score / 100,
        fallback: result.metadata?.fallback || false,
        rank: index + 1,
        optimized: true,
        enhanced: true,
      };
    });
    const cacheKey = this.generateInstantCacheKey(query, options);
    this.setInInstantCache(cacheKey, results, 300000);
    this.recordEnhancedSearch(query, results, options, processingTime);
    this.recordPerformanceMetric('search_complete', processingTime);
    return results;
  }
  getEnhancedPerformanceMetrics() {
    const baseMetrics = this.getPerformanceMetrics();
    const fts5Successes = this.enhancedSearchMetrics.get('fts5_success') || [];
    const fts5Fallbacks = this.enhancedSearchMetrics.get('fts5_fallback') || [];
    const fts5SuccessRate =
      fts5Successes.length + fts5Fallbacks.length > 0
        ? fts5Successes.length / (fts5Successes.length + fts5Fallbacks.length)
        : 0;
    const standardTimes = this.performanceMetrics.get('search_complete') || [];
    const fts5Times = fts5Successes;
    const standardAvg =
      standardTimes.length > 0
        ? standardTimes.reduce((a, b) => a + b, 0) / standardTimes.length
        : 0;
    const fts5Avg =
      fts5Times.length > 0 ? fts5Times.reduce((a, b) => a + b, 0) / fts5Times.length : 0;
    const improvement =
      standardAvg > 0 && fts5Avg > 0
        ? `${Math.round((1 - fts5Avg / standardAvg) * 100)}% faster`
        : 'N/A';
    return {
      fts5Available: !!this.fts5Engine,
      fts5SuccessRate: Math.round(fts5SuccessRate * 100) / 100,
      enhancedFeatures: [
        'FTS5 with BM25 ranking',
        'Custom mainframe tokenizer',
        'Context-aware snippets',
        'Advanced highlight matching',
        'Domain-specific term weighting',
        'Performance optimization',
      ],
      performanceComparison: {
        standardSearch: {
          avg: Math.round(standardAvg),
          p95: Math.round(
            standardTimes.sort((a, b) => a - b)[Math.floor(standardTimes.length * 0.95)] || 0
          ),
        },
        fts5Search: {
          avg: Math.round(fts5Avg),
          p95: Math.round(
            fts5Times.sort((a, b) => a - b)[Math.floor(fts5Times.length * 0.95)] || 0
          ),
        },
        improvement,
      },
    };
  }
  async optimizeFTS5() {
    if (this.fts5Engine) {
      this.fts5Engine.optimize();
      console.log('✅ FTS5 index optimized');
    } else {
      console.warn('⚠️ FTS5 engine not available for optimization');
    }
  }
  clearFTS5Cache() {
    if (this.fts5Engine) {
      this.fts5Engine.clearCache();
      console.log('🗑️ FTS5 cache cleared');
    }
  }
  getFTS5Statistics() {
    if (this.fts5Engine) {
      return this.fts5Engine.getStatistics();
    }
    return null;
  }
  recordEnhancedSearchMetric(operation, duration) {
    if (!this.enhancedSearchMetrics.has(operation)) {
      this.enhancedSearchMetrics.set(operation, []);
    }
    const metrics = this.enhancedSearchMetrics.get(operation);
    metrics.push(duration);
    if (metrics.length > 100) {
      metrics.shift();
    }
  }
  async recordEnhancedSearch(query, results, options, processingTime) {
    await this.recordSearch(query, results, options);
    if (this.database) {
      try {
        this.database
          .prepare(
            `
          INSERT INTO search_performance (
            query, results_count, processing_time_ms, cache_hit, search_type, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            query,
            results.length,
            Math.round(processingTime),
            false,
            this.fts5Engine ? 'enhanced_fts5' : 'standard',
            Date.now()
          );
      } catch (error) {}
    }
  }
  async applyAdvancedRanking(results, query, options) {
    const baseRanked = await super['applyAdvancedRanking'](results, query, options);
    return baseRanked
      .map(result => {
        let enhancedScore = result.score;
        if (result.metadata?.enhanced) {
          enhancedScore *= 1.05;
        }
        if (result.metadata?.snippet && result.metadata.snippet.length > 50) {
          enhancedScore *= 1.03;
        }
        if (result.metadata?.source === 'fts5_enhanced') {
          enhancedScore *= 1.08;
        }
        return {
          ...result,
          score: Math.min(100, enhancedScore),
          metadata: {
            ...result.metadata,
            confidence: Math.min(1, enhancedScore / 100),
            boosted: enhancedScore > result.score,
          },
        };
      })
      .sort((a, b) => b.score - a.score);
  }
  async addEnhancedHighlights(results, query) {
    const baseHighlighted = await super['addEnhancedHighlights'](results, query);
    return baseHighlighted.map(result => {
      if (result.metadata?.source === 'fts5_enhanced' && result.highlights?.length) {
        return result;
      }
      return result;
    });
  }
}
exports.EnhancedSearchService = EnhancedSearchService;
function createEnhancedSearchService(geminiConfig, database, cacheManager) {
  return new EnhancedSearchService(geminiConfig, database, cacheManager);
}
exports.default = EnhancedSearchService;
//# sourceMappingURL=EnhancedSearchService.js.map
