/**
 * Enhanced SearchService with FTS5 Integration
 *
 * Extends the existing SearchService with advanced FTS5 capabilities while maintaining
 * backward compatibility and integrating with existing caching and optimization infrastructure.
 *
 * Key enhancements:
 * - FTS5 with custom mainframe tokenizer
 * - BM25 ranking with domain-specific weights
 * - Context-aware snippet generation
 * - Advanced highlight matching
 * - Performance optimization and caching
 */

import axios, { AxiosError } from 'axios';
import {
  ISearchService,
  SearchResult,
  SearchOptions,
  SearchQuery,
  PopularSearch,
  KBEntry,
  SearchMatchType,
  SearchHighlight,
  SearchMetadata,
  GeminiConfig,
  SearchError,
  AIServiceError,
  ServiceError
} from '../types/services';
import { FTS5EnhancedSearch, EnhancedSearchResult, FTS5SearchOptions } from '../database/FTS5EnhancedSearch';
import { SearchService } from './SearchService';

/**
 * Enhanced Search Service with FTS5 Integration
 *
 * Provides unified search interface with enhanced FTS5 capabilities while maintaining
 * compatibility with existing SearchService functionality.
 */
export class EnhancedSearchService extends SearchService {
  private fts5Engine?: FTS5EnhancedSearch;
  private enhancedSearchMetrics: Map<string, number[]> = new Map();

  constructor(
    geminiConfig?: GeminiConfig,
    database?: any,
    cacheManager?: any
  ) {
    super(geminiConfig, database, cacheManager);

    // Initialize FTS5 enhanced search if database is available
    if (database) {
      try {
        this.fts5Engine = new FTS5EnhancedSearch(database);
        console.log('✅ Enhanced FTS5 search engine initialized');
      } catch (error) {
        console.warn('⚠️ FTS5 enhanced search initialization failed, falling back to standard search:', error);
        this.fts5Engine = undefined;
      }
    }
  }

  /**
   * Enhanced search with FTS5, BM25 ranking, and snippet generation
   *
   * Automatically selects optimal search strategy:
   * - FTS5 enhanced for complex queries and when available
   * - Standard search as fallback for compatibility
   * - Hybrid approach for maximum coverage
   */
  async search(query: string, entries: KBEntry[], options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = performance.now();
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    try {
      // L0 Instant Cache Check (<10ms)
      const cacheKey = this.generateInstantCacheKey(normalizedQuery, options);
      const cachedResult = this.getFromInstantCache(cacheKey);
      if (cachedResult) {
        this.recordPerformanceMetric('instant_cache_hit', performance.now() - startTime);
        return cachedResult;
      }

      let results: SearchResult[] = [];

      // Strategy 1: Enhanced FTS5 search (if available and optimal)
      if (this.fts5Engine && this.shouldUseFTS5(normalizedQuery, options)) {
        try {
          results = await this.performEnhancedFTS5Search(normalizedQuery, options);

          // If FTS5 returns good results, use them
          if (results.length > 0) {
            this.recordEnhancedSearchMetric('fts5_success', performance.now() - startTime);
            return this.finalizeResults(results, normalizedQuery, options, startTime);
          }
        } catch (error) {
          console.warn('FTS5 enhanced search failed, falling back to standard search:', error);
          this.recordEnhancedSearchMetric('fts5_fallback', performance.now() - startTime);
        }
      }

      // Strategy 2: Hybrid approach - combine multiple search methods
      const searchPromises: Promise<SearchResult[]>[] = [];

      // Standard optimized FTS search (existing implementation)
      searchPromises.push(this.performOptimizedFTSSearch(normalizedQuery, entries, options));

      // Enhanced local search as fallback
      searchPromises.push(this.performLocalSearch(normalizedQuery, entries, options));

      // AI search if enabled and conditions met
      if (options.useAI !== false && this.geminiConfig && entries.length <= 100) {
        searchPromises.push(
          this.performAISearch(normalizedQuery, entries, options)
            .catch(error => {
              console.warn('AI search failed, continuing with local results:', error);
              return [];
            })
        );
      }

      // Execute searches in parallel
      const searchResults = await Promise.allSettled(searchPromises);
      const successfulResults = searchResults
        .filter((result): result is PromiseFulfilledResult<SearchResult[]> =>
          result.status === 'fulfilled' && result.value.length > 0
        )
        .map(result => result.value);

      // Intelligent result merging with deduplication
      if (successfulResults.length > 0) {
        results = this.intelligentMergeResults(successfulResults, options);
      }

      return this.finalizeResults(results, normalizedQuery, options, startTime);

    } catch (error) {
      this.recordPerformanceMetric('search_error', performance.now() - startTime);
      throw new SearchError(
        `Enhanced search failed: ${error.message}`,
        query,
        { originalError: error, options, processingTime: performance.now() - startTime }
      );
    }
  }

  /**
   * Perform enhanced FTS5 search with advanced features
   */
  private async performEnhancedFTS5Search(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.fts5Engine) {
      throw new Error('FTS5 engine not available');
    }

    const fts5Options: FTS5SearchOptions = {
      ...options,
      enableSnippets: true,
      snippetLength: 200,
      highlightTags: { start: '<mark>', end: '</mark>' },
      rankingProfile: this.selectRankingProfile(query),
      proximityBoost: true
    };

    const enhancedResults = await this.fts5Engine.search(query, fts5Options);

    // Convert enhanced results to standard SearchResult format
    return enhancedResults.map((result: EnhancedSearchResult) => ({
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
        debugInfo: result.debugInfo
      }
    }));
  }

  /**
   * Determine if FTS5 enhanced search should be used
   */
  private shouldUseFTS5(query: string, options: SearchOptions): boolean {
    // Use FTS5 for complex queries
    if (query.length > 20 || query.split(' ').length > 3) {
      return true;
    }

    // Use FTS5 for mainframe-specific terms
    const mainframePatterns = [
      /^S\d{3}[A-Z]?$/i,           // System completion codes
      /^[A-Z]{3}\d{3,4}[A-Z]?$/i,  // System messages
      /^\/\/[A-Z0-9@#$]{1,8}$/i,   // JCL names
      /VSAM|COBOL|JCL|DB2|CICS/i   // Mainframe keywords
    ];

    if (mainframePatterns.some(pattern => pattern.test(query))) {
      return true;
    }

    // Use FTS5 for category or tag searches
    if (options.category || (options.tags && options.tags.length > 0)) {
      return true;
    }

    // Default: use standard search for simple queries
    return false;
  }

  /**
   * Select appropriate ranking profile based on query characteristics
   */
  private selectRankingProfile(query: string): 'balanced' | 'precision' | 'recall' | 'mainframe_focused' {
    // Error codes and specific terms need precision
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return 'precision';
    }

    // Mainframe-specific queries benefit from domain focus
    if (/VSAM|COBOL|JCL|DB2|CICS|ABEND|COMPLETION/i.test(query)) {
      return 'mainframe_focused';
    }

    // Long queries benefit from recall
    if (query.split(' ').length > 4) {
      return 'recall';
    }

    // Default balanced approach
    return 'balanced';
  }

  /**
   * Convert enhanced snippets to standard highlights format
   */
  private convertSnippetsToHighlights(snippets: any[]): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];

    snippets.forEach(snippet => {
      snippet.highlights.forEach((highlight: any) => {
        highlights.push({
          field: snippet.field,
          start: highlight.start,
          end: highlight.end,
          text: highlight.term,
          context: snippet.text
        });
      });
    });

    return highlights.slice(0, 10); // Limit to 10 highlights
  }

  /**
   * Finalize search results with common processing
   */
  private finalizeResults(
    results: SearchResult[],
    query: string,
    options: SearchOptions,
    startTime: number
  ): SearchResult[] {
    // Apply advanced filtering and ranking
    results = this.applyAdvancedRanking(results, query, options);

    // Add contextual highlights if not already present
    if (options.includeHighlights) {
      results = this.addEnhancedHighlights(results, query);
    }

    // Performance optimization for large result sets
    if (results.length > (options.limit || 50)) {
      results = this.streamOptimizedResults(results, options.limit || 50);
    }

    // Enhanced metadata with performance insights
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
        enhanced: true
      };
    });

    // Cache results in L0 instant cache
    const cacheKey = this.generateInstantCacheKey(query, options);
    this.setInInstantCache(cacheKey, results, 300000); // 5 minutes TTL

    // Record enhanced search metrics
    this.recordEnhancedSearch(query, results, options, processingTime);
    this.recordPerformanceMetric('search_complete', processingTime);

    return results;
  }

  /**
   * Get enhanced search performance metrics
   */
  getEnhancedPerformanceMetrics(): {
    fts5Available: boolean;
    fts5SuccessRate: number;
    enhancedFeatures: string[];
    performanceComparison: {
      standardSearch: { avg: number; p95: number };
      fts5Search: { avg: number; p95: number };
      improvement: string;
    };
  } {
    const baseMetrics = this.getPerformanceMetrics();

    const fts5Successes = this.enhancedSearchMetrics.get('fts5_success') || [];
    const fts5Fallbacks = this.enhancedSearchMetrics.get('fts5_fallback') || [];
    const fts5SuccessRate = fts5Successes.length + fts5Fallbacks.length > 0
      ? fts5Successes.length / (fts5Successes.length + fts5Fallbacks.length)
      : 0;

    const standardTimes = this.performanceMetrics.get('search_complete') || [];
    const fts5Times = fts5Successes;

    const standardAvg = standardTimes.length > 0
      ? standardTimes.reduce((a, b) => a + b, 0) / standardTimes.length
      : 0;
    const fts5Avg = fts5Times.length > 0
      ? fts5Times.reduce((a, b) => a + b, 0) / fts5Times.length
      : 0;

    const improvement = standardAvg > 0 && fts5Avg > 0
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
        'Performance optimization'
      ],
      performanceComparison: {
        standardSearch: {
          avg: Math.round(standardAvg),
          p95: Math.round(standardTimes.sort((a, b) => a - b)[Math.floor(standardTimes.length * 0.95)] || 0)
        },
        fts5Search: {
          avg: Math.round(fts5Avg),
          p95: Math.round(fts5Times.sort((a, b) => a - b)[Math.floor(fts5Times.length * 0.95)] || 0)
        },
        improvement
      }
    };
  }

  /**
   * Optimize FTS5 index
   */
  async optimizeFTS5(): Promise<void> {
    if (this.fts5Engine) {
      this.fts5Engine.optimize();
      console.log('✅ FTS5 index optimized');
    } else {
      console.warn('⚠️ FTS5 engine not available for optimization');
    }
  }

  /**
   * Clear FTS5 search cache
   */
  clearFTS5Cache(): void {
    if (this.fts5Engine) {
      this.fts5Engine.clearCache();
      console.log('🗑️ FTS5 cache cleared');
    }
  }

  /**
   * Get FTS5 statistics
   */
  getFTS5Statistics(): any {
    if (this.fts5Engine) {
      return this.fts5Engine.getStatistics();
    }
    return null;
  }

  /**
   * Record enhanced search metrics
   */
  private recordEnhancedSearchMetric(operation: string, duration: number): void {
    if (!this.enhancedSearchMetrics.has(operation)) {
      this.enhancedSearchMetrics.set(operation, []);
    }

    const metrics = this.enhancedSearchMetrics.get(operation)!;
    metrics.push(duration);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Enhanced search recording with FTS5 metrics
   */
  private async recordEnhancedSearch(
    query: string,
    results: SearchResult[],
    options: SearchOptions,
    processingTime: number
  ): Promise<void> {
    // Call parent implementation
    await this.recordSearch(query, results, options);

    // Additional FTS5-specific logging
    if (this.database) {
      try {
        this.database.prepare(`
          INSERT INTO search_performance (
            query, results_count, processing_time_ms, cache_hit, search_type, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          query,
          results.length,
          Math.round(processingTime),
          false,
          this.fts5Engine ? 'enhanced_fts5' : 'standard',
          Date.now()
        );
      } catch (error) {
        // Ignore if table doesn't exist
      }
    }
  }

  /**
   * Enhanced version of applyAdvancedRanking with FTS5 insights
   */
  private async applyAdvancedRanking(
    results: SearchResult[],
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Apply base ranking from parent class
    const baseRanked = await super['applyAdvancedRanking'](results, query, options);

    // Additional FTS5-specific ranking adjustments
    return baseRanked.map(result => {
      let enhancedScore = result.score;

      // Boost results with enhanced metadata
      if (result.metadata?.enhanced) {
        enhancedScore *= 1.05; // 5% boost for enhanced results
      }

      // Boost results with good snippets
      if (result.metadata?.snippet && result.metadata.snippet.length > 50) {
        enhancedScore *= 1.03; // 3% boost for good snippets
      }

      // Boost results from FTS5 engine
      if (result.metadata?.source === 'fts5_enhanced') {
        enhancedScore *= 1.08; // 8% boost for FTS5 results
      }

      return {
        ...result,
        score: Math.min(100, enhancedScore),
        metadata: {
          ...result.metadata,
          confidence: Math.min(1, enhancedScore / 100),
          boosted: enhancedScore > result.score
        }
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Enhanced version of addEnhancedHighlights
   */
  private async addEnhancedHighlights(
    results: SearchResult[],
    query: string
  ): Promise<SearchResult[]> {
    // Use parent implementation as base
    const baseHighlighted = await super['addEnhancedHighlights'](results, query);

    // Additional FTS5-specific highlight enhancements
    return baseHighlighted.map(result => {
      // If result already has enhanced highlights from FTS5, preserve them
      if (result.metadata?.source === 'fts5_enhanced' && result.highlights?.length) {
        return result;
      }

      // Otherwise apply standard highlighting
      return result;
    });
  }
}

/**
 * Factory function to create enhanced search service
 */
export function createEnhancedSearchService(
  geminiConfig?: GeminiConfig,
  database?: any,
  cacheManager?: any
): EnhancedSearchService {
  return new EnhancedSearchService(geminiConfig, database, cacheManager);
}

export default EnhancedSearchService;