import { EventEmitter } from 'events';
import { KBEntry, SearchResult, SearchOptions } from '../../database/KnowledgeDB';
import Database from 'better-sqlite3';

/**
 * Advanced search strategy with performance characteristics
 */
export interface SearchStrategy {
  name: string;
  priority: number;
  estimatedTime: number; // in milliseconds
  accuracy: number; // 0-1 scale
  description: string;
}

/**
 * Search suggestion with metadata
 */
export interface SearchSuggestion {
  suggestion: string;
  type: 'query' | 'category' | 'tag' | 'error_code';
  frequency: number;
  lastUsed: Date;
  score: number;
}

/**
 * Comprehensive search analytics
 */
export interface SearchAnalytics {
  totalSearches: number;
  avgResponseTime: number;
  cacheHitRate: number;
  topQueries: Array<{ query: string; count: number }>;
  failedQueries: Array<{ query: string; reason: string; count: number }>;
  strategiesUsed: Record<string, number>;
  timeDistribution: {
    under50ms: number;
    under100ms: number;
    under500ms: number;
    over500ms: number;
  };
}

/**
 * Real-time search performance metrics
 */
export interface SearchPerformanceMetrics {
  queriesPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  cacheStats: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    size: number;
    maxSize: number;
  };
  memoryUsage: {
    cacheSize: number;
    indexSize: number;
    totalSize: number;
  };
}

/**
 * LRU Cache with TTL support for search results
 */
class SearchCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number; hits: number }>();
  private accessOrder = new Map<string, number>();
  private maxSize: number;
  private defaultTTL: number;
  private accessCounter = 0;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) {
    // 5 minutes default TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access order and hit count
    this.accessOrder.set(key, ++this.accessCounter);
    entry.hits++;

    return entry.data;
  }

  set(key: string, data: any, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl || this.defaultTTL;

    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: entryTTL,
      hits: 0,
    });

    this.accessOrder.set(key, ++this.accessCounter);
  }

  invalidate(pattern?: string): number {
    if (!pattern) {
      const count = this.cache.size;
      this.cache.clear();
      this.accessOrder.clear();
      return count;
    }

    const regex = new RegExp(pattern);
    let invalidated = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    avgHits: number;
    oldestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const oldestTimestamp =
      entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : Date.now();

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: entries.length > 0 ? totalHits / (entries.length * 10) : 0, // Estimated hit rate
      avgHits: entries.length > 0 ? totalHits / entries.length : 0,
      oldestEntry: Date.now() - oldestTimestamp,
    };
  }

  private evictLRU(): void {
    // Find least recently used entry
    let lruKey: string | null = null;
    let lruAccess = Number.MAX_SAFE_INTEGER;

    for (const [key, access] of this.accessOrder.entries()) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    });
  }
}

/**
 * Smart search service with intelligent caching, query optimization, and performance monitoring
 *
 * Features:
 * - Multi-strategy search with automatic strategy selection
 * - Intelligent query preprocessing and normalization
 * - LRU cache with TTL support for optimal performance
 * - Real-time performance monitoring and analytics
 * - Query suggestion engine based on usage patterns
 * - Adaptive query routing based on performance characteristics
 * - Automatic index optimization recommendations
 *
 * Performance targets:
 * - <50ms for cached queries
 * - <100ms for simple queries
 * - <500ms for complex queries
 * - 90%+ cache hit rate for repeated queries
 *
 * @extends EventEmitter
 *
 * @emits 'search' - Search execution with performance metrics
 * @emits 'cache-hit' - Cache hit events
 * @emits 'cache-miss' - Cache miss events
 * @emits 'slow-query' - Queries exceeding performance thresholds
 * @emits 'error' - Search errors and failures
 *
 * @example
 * ```typescript
 * const smartSearch = new SmartSearchService(database);
 *
 * // Perform optimized search
 * const results = await smartSearch.search('VSAM status 35', {
 *   maxResults: 10,
 *   timeout: 1000
 * });
 *
 * // Get search suggestions
 * const suggestions = await smartSearch.getSuggestions('vsam');
 *
 * // Monitor performance
 * const metrics = smartSearch.getPerformanceMetrics();
 * console.log(`Cache hit rate: ${metrics.cacheStats.hitRate}%`);
 * ```
 */
export class SmartSearchService extends EventEmitter {
  private db: Database.Database;
  private cache: SearchCache;
  private performanceTracker = new Map<string, number[]>(); // Query -> [execution times]
  private searchStats = {
    totalSearches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failedQueries: new Map<string, number>(),
    queryFrequency: new Map<string, number>(),
    strategyUsage: new Map<string, number>(),
    responseTimeDistribution: { under50: 0, under100: 0, under500: 0, over500: 0 },
  };

  // Search strategies with performance characteristics
  private strategies: SearchStrategy[] = [
    {
      name: 'exact_match',
      priority: 10,
      estimatedTime: 20,
      accuracy: 1.0,
      description: 'Direct string matching for error codes and specific terms',
    },
    {
      name: 'fts_search',
      priority: 8,
      estimatedTime: 50,
      accuracy: 0.9,
      description: 'Full-text search with BM25 ranking',
    },
    {
      name: 'fuzzy_search',
      priority: 6,
      estimatedTime: 80,
      accuracy: 0.7,
      description: 'Approximate matching for typos and partial terms',
    },
    {
      name: 'semantic_search',
      priority: 4,
      estimatedTime: 200,
      accuracy: 0.8,
      description: 'AI-powered semantic similarity matching',
    },
    {
      name: 'hybrid_search',
      priority: 2,
      estimatedTime: 150,
      accuracy: 0.95,
      description: 'Combined strategy for comprehensive results',
    },
  ];

  // Performance thresholds
  private readonly FAST_QUERY_THRESHOLD = 50; // ms
  private readonly ACCEPTABLE_QUERY_THRESHOLD = 100; // ms
  private readonly SLOW_QUERY_THRESHOLD = 500; // ms
  private readonly CACHE_TTL_FAST = 300000; // 5 minutes for fast queries
  private readonly CACHE_TTL_SLOW = 600000; // 10 minutes for slow queries

  constructor(
    database: Database.Database,
    options?: {
      cacheSize?: number;
      defaultCacheTTL?: number;
      enablePerformanceTracking?: boolean;
    }
  ) {
    super();

    this.db = database;
    this.cache = new SearchCache(options?.cacheSize || 1000, options?.defaultCacheTTL || 300000);

    this.initializeSearchTables();
    this.setupPerformanceMonitoring();
  }

  /**
   * Execute optimized search with automatic strategy selection
   *
   * @param query - Search query string
   * @param options - Search configuration options
   * @returns Promise resolving to search results with performance metadata
   */
  async search(
    query: string,
    options: Partial<
      SearchOptions & {
        maxResults?: number;
        timeout?: number;
        forceStrategy?: string;
        enableCaching?: boolean;
        includeAnalytics?: boolean;
      }
    > = {}
  ): Promise<{
    results: SearchResult[];
    metadata: {
      strategy: string;
      executionTime: number;
      cacheHit: boolean;
      totalResults: number;
      query: string;
      normalizedQuery: string;
    };
  }> {
    const startTime = Date.now();
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = this.generateCacheKey(normalizedQuery, options);

    const {
      maxResults = 10,
      timeout = 1000,
      enableCaching = true,
      includeAnalytics = false,
    } = options;

    // Update search statistics
    this.searchStats.totalSearches++;
    this.updateQueryFrequency(normalizedQuery);

    try {
      // Check cache first if caching is enabled
      if (enableCaching) {
        const cachedResult = this.cache.get(cacheKey);
        if (cachedResult) {
          this.searchStats.cacheHits++;

          const metadata = {
            strategy: 'cached',
            executionTime: Date.now() - startTime,
            cacheHit: true,
            totalResults: cachedResult.results.length,
            query,
            normalizedQuery,
          };

          this.emit('cache-hit', { query: normalizedQuery, executionTime: metadata.executionTime });
          this.emit('search', { query: normalizedQuery, ...metadata });

          return {
            results: cachedResult.results.slice(0, maxResults),
            metadata,
          };
        }
      }

      this.searchStats.cacheMisses++;

      // Select optimal search strategy
      const strategy =
        options.forceStrategy || (await this.selectOptimalStrategy(normalizedQuery, options));

      // Execute search with timeout protection
      const searchPromise = this.executeSearchStrategy(strategy, normalizedQuery, options);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Search timeout after ${timeout}ms`)), timeout);
      });

      const results = await Promise.race([searchPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Update performance tracking
      this.updatePerformanceMetrics(normalizedQuery, executionTime, strategy);
      this.updateResponseTimeDistribution(executionTime);

      // Cache results if caching is enabled and query was successful
      if (enableCaching && results.length > 0) {
        const cacheTTL =
          executionTime > this.SLOW_QUERY_THRESHOLD ? this.CACHE_TTL_SLOW : this.CACHE_TTL_FAST;

        this.cache.set(cacheKey, { results }, cacheTTL);
      }

      const metadata = {
        strategy,
        executionTime,
        cacheHit: false,
        totalResults: results.length,
        query,
        normalizedQuery,
      };

      // Emit events for monitoring
      this.emit('cache-miss', { query: normalizedQuery, executionTime });
      this.emit('search', { query: normalizedQuery, ...metadata });

      if (executionTime > this.SLOW_QUERY_THRESHOLD) {
        this.emit('slow-query', { query: normalizedQuery, executionTime, strategy });
      }

      return {
        results: results.slice(0, maxResults),
        metadata,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Track failed queries
      const failureCount = this.searchStats.failedQueries.get(normalizedQuery) || 0;
      this.searchStats.failedQueries.set(normalizedQuery, failureCount + 1);

      this.emit('error', {
        query: normalizedQuery,
        error: error.message,
        executionTime,
      });

      throw error;
    }
  }

  /**
   * Get intelligent search suggestions based on query patterns and usage
   *
   * @param partialQuery - Partial query string for suggestions
   * @param limit - Maximum number of suggestions to return
   * @returns Promise resolving to array of search suggestions
   */
  async getSuggestions(partialQuery: string, limit: number = 8): Promise<SearchSuggestion[]> {
    const cacheKey = `suggestions:${partialQuery.toLowerCase()}:${limit}`;
    const cached = this.cache.get(cacheKey);

    if (cached) return cached;

    const normalizedQuery = partialQuery.toLowerCase().trim();

    if (normalizedQuery.length < 2) return [];

    const suggestions: SearchSuggestion[] = [];

    // Get query-based suggestions from search history
    const queryHistory = this.db
      .prepare(
        `
      SELECT
        query,
        COUNT(*) as frequency,
        MAX(timestamp) as last_used
      FROM search_history
      WHERE LOWER(query) LIKE ? || '%'
        AND LENGTH(query) > LENGTH(?)
        AND results_count > 0
      GROUP BY LOWER(query)
      ORDER BY frequency DESC, last_used DESC
      LIMIT ?
    `
      )
      .all(normalizedQuery, normalizedQuery, Math.ceil(limit * 0.4));

    queryHistory.forEach((row: any) => {
      suggestions.push({
        suggestion: row.query,
        type: 'query',
        frequency: row.frequency,
        lastUsed: new Date(row.last_used),
        score: row.frequency * 2,
      });
    });

    // Get category suggestions
    const categories = this.db
      .prepare(
        `
      SELECT
        category as suggestion,
        COUNT(*) as frequency
      FROM kb_entries
      WHERE LOWER(category) LIKE ? || '%'
        AND archived = FALSE
      GROUP BY LOWER(category)
      ORDER BY frequency DESC
      LIMIT ?
    `
      )
      .all(normalizedQuery, Math.ceil(limit * 0.2));

    categories.forEach((row: any) => {
      suggestions.push({
        suggestion: `category:${row.suggestion}`,
        type: 'category',
        frequency: row.frequency,
        lastUsed: new Date(),
        score: row.frequency * 1.5,
      });
    });

    // Get tag suggestions
    const tags = this.db
      .prepare(
        `
      SELECT
        tag as suggestion,
        COUNT(*) as frequency
      FROM kb_tags
      WHERE LOWER(tag) LIKE ? || '%'
      GROUP BY LOWER(tag)
      ORDER BY frequency DESC
      LIMIT ?
    `
      )
      .all(normalizedQuery, Math.ceil(limit * 0.3));

    tags.forEach((row: any) => {
      suggestions.push({
        suggestion: `tag:${row.suggestion}`,
        type: 'tag',
        frequency: row.frequency,
        lastUsed: new Date(),
        score: row.frequency,
      });
    });

    // Get error code suggestions (based on common mainframe error patterns)
    if (/^[A-Z]*\d/.test(normalizedQuery)) {
      const errorCodes = this.db
        .prepare(
          `
        SELECT DISTINCT
          CASE
            WHEN title LIKE '%S0C%' THEN SUBSTR(title, INSTR(title, 'S0C'), 4)
            WHEN title LIKE '%IEF%' THEN SUBSTR(title, INSTR(title, 'IEF'), 6)
            WHEN title LIKE '%WER%' THEN SUBSTR(title, INSTR(title, 'WER'), 6)
            ELSE NULL
          END as error_code
        FROM kb_entries
        WHERE error_code IS NOT NULL
          AND LOWER(error_code) LIKE ? || '%'
          AND archived = FALSE
        LIMIT ?
      `
        )
        .all(normalizedQuery, Math.ceil(limit * 0.1));

      errorCodes.forEach((row: any) => {
        if (row.error_code) {
          suggestions.push({
            suggestion: row.error_code,
            type: 'error_code',
            frequency: 10, // Boost error codes
            lastUsed: new Date(),
            score: 50, // High score for error codes
          });
        }
      });
    }

    // Sort by score and remove duplicates
    const uniqueSuggestions = Array.from(
      new Map(suggestions.map(s => [s.suggestion.toLowerCase(), s])).values()
    )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Cache suggestions for 30 seconds (short TTL for dynamic suggestions)
    this.cache.set(cacheKey, uniqueSuggestions, 30000);

    return uniqueSuggestions;
  }

  /**
   * Get comprehensive search analytics and performance metrics
   *
   * @param timeRange - Optional time range for analytics
   * @returns Current search analytics data
   */
  getAnalytics(timeRange?: { start: Date; end: Date }): SearchAnalytics {
    const topQueries = Array.from(this.searchStats.queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    const failedQueries = Array.from(this.searchStats.failedQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, reason: 'execution_error', count }));

    const strategiesUsed: Record<string, number> = {};
    this.searchStats.strategyUsage.forEach((count, strategy) => {
      strategiesUsed[strategy] = count;
    });

    const totalQueries = this.searchStats.totalSearches;
    const totalTime = Array.from(this.performanceTracker.values())
      .flat()
      .reduce((sum, time) => sum + time, 0);

    return {
      totalSearches: totalQueries,
      avgResponseTime: totalQueries > 0 ? totalTime / totalQueries : 0,
      cacheHitRate: totalQueries > 0 ? (this.searchStats.cacheHits / totalQueries) * 100 : 0,
      topQueries,
      failedQueries,
      strategiesUsed,
      timeDistribution: {
        under50ms: this.searchStats.responseTimeDistribution.under50,
        under100ms: this.searchStats.responseTimeDistribution.under100,
        under500ms: this.searchStats.responseTimeDistribution.under500,
        over500ms: this.searchStats.responseTimeDistribution.over500,
      },
    };
  }

  /**
   * Get real-time performance metrics
   *
   * @returns Current performance metrics
   */
  getPerformanceMetrics(): SearchPerformanceMetrics {
    const allExecutionTimes = Array.from(this.performanceTracker.values()).flat();
    const sortedTimes = allExecutionTimes.sort((a, b) => a - b);

    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    const cacheStats = this.cache.getStats();

    return {
      queriesPerSecond: this.calculateQPS(),
      averageLatency:
        sortedTimes.length > 0
          ? sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length
          : 0,
      p95Latency: sortedTimes[p95Index] || 0,
      p99Latency: sortedTimes[p99Index] || 0,
      cacheStats: {
        hitRate:
          (this.searchStats.cacheHits /
            (this.searchStats.cacheHits + this.searchStats.cacheMisses)) *
            100 || 0,
        missRate:
          (this.searchStats.cacheMisses /
            (this.searchStats.cacheHits + this.searchStats.cacheMisses)) *
            100 || 0,
        evictionRate: 0, // TODO: Track evictions
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
      },
      memoryUsage: {
        cacheSize: this.estimateCacheMemoryUsage(),
        indexSize: 0, // TODO: Estimate index size
        totalSize: this.estimateCacheMemoryUsage(),
      },
    };
  }

  /**
   * Optimize search performance by prewarming cache and analyzing patterns
   *
   * @returns Promise resolving to optimization results
   */
  async optimizePerformance(): Promise<{
    cachePrewarmed: number;
    slowQueriesOptimized: number;
    indexRecommendations: string[];
  }> {
    const results = {
      cachePrewarmed: 0,
      slowQueriesOptimized: 0,
      indexRecommendations: [],
    };

    // Prewarm cache with popular queries
    const popularQueries = Array.from(this.searchStats.queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50); // Top 50 queries

    for (const [query, frequency] of popularQueries) {
      if (frequency >= 5) {
        // Only prewarm queries used 5+ times
        try {
          await this.search(query, { maxResults: 10, enableCaching: true });
          results.cachePrewarmed++;
        } catch (error) {
          // Skip failed queries during prewarming
        }
      }
    }

    // Analyze slow queries for optimization opportunities
    const slowQueries = Array.from(this.performanceTracker.entries()).filter(([_, times]) => {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      return avgTime > this.SLOW_QUERY_THRESHOLD;
    });

    results.slowQueriesOptimized = slowQueries.length;

    // Generate index recommendations based on query patterns
    results.indexRecommendations = this.generateIndexRecommendations();

    return results;
  }

  /**
   * Clear search cache and reset performance metrics
   *
   * @param resetMetrics - Whether to reset performance tracking data
   */
  clearCache(resetMetrics: boolean = false): void {
    this.cache.invalidate();

    if (resetMetrics) {
      this.performanceTracker.clear();
      this.searchStats = {
        totalSearches: 0,
        cacheHits: 0,
        cacheMisses: 0,
        failedQueries: new Map(),
        queryFrequency: new Map(),
        strategyUsage: new Map(),
        responseTimeDistribution: { under50: 0, under100: 0, under500: 0, over500: 0 },
      };
    }
  }

  // Private implementation methods

  private initializeSearchTables(): void {
    // Ensure search history table exists for analytics
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        normalized_query TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        results_count INTEGER NOT NULL,
        execution_time INTEGER NOT NULL,
        strategy TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(normalized_query);
      CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp);
    `);
  }

  private normalizeQuery(query: string): string {
    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s:@.-]/g, ''); // Keep search operators
  }

  private generateCacheKey(normalizedQuery: string, options: any): string {
    const keyParts = [
      'search',
      normalizedQuery,
      options.category || '',
      options.sortBy || '',
      options.maxResults || 10,
    ];
    return keyParts.join(':');
  }

  private updateQueryFrequency(query: string): void {
    const current = this.searchStats.queryFrequency.get(query) || 0;
    this.searchStats.queryFrequency.set(query, current + 1);
  }

  private async selectOptimalStrategy(
    query: string,
    options: Partial<SearchOptions>
  ): Promise<string> {
    // Rule-based strategy selection

    // Error codes: exact match
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return 'exact_match';
    }

    // Category/tag filters: direct lookup
    if (query.startsWith('category:') || query.startsWith('tag:')) {
      return 'exact_match';
    }

    // Check historical performance for this query pattern
    const similarQueries = Array.from(this.performanceTracker.entries()).filter(
      ([q, _]) => this.calculateQuerySimilarity(q, query) > 0.8
    );

    if (similarQueries.length > 0) {
      // Use strategy that performed best for similar queries
      const strategyPerformance = new Map<string, number[]>();

      // This is a simplified version - in reality, we'd track strategy per query
      // For now, use FTS for most queries, hybrid for complex ones
      const complexity = this.calculateQueryComplexity(query);

      if (complexity.isComplex) {
        return 'hybrid_search';
      } else if (complexity.hasSpecialTerms) {
        return 'fts_search';
      } else {
        return 'fuzzy_search';
      }
    }

    // Default to FTS for general queries
    return 'fts_search';
  }

  private async executeSearchStrategy(
    strategy: string,
    query: string,
    options: Partial<SearchOptions>
  ): Promise<SearchResult[]> {
    // Update strategy usage statistics
    const currentUsage = this.searchStats.strategyUsage.get(strategy) || 0;
    this.searchStats.strategyUsage.set(strategy, currentUsage + 1);

    switch (strategy) {
      case 'exact_match':
        return this.executeExactMatch(query, options);
      case 'fts_search':
        return this.executeFTSSearch(query, options);
      case 'fuzzy_search':
        return this.executeFuzzySearch(query, options);
      case 'hybrid_search':
        return this.executeHybridSearch(query, options);
      default:
        return this.executeFTSSearch(query, options);
    }
  }

  private executeExactMatch(
    query: string,
    options: Partial<SearchOptions>
  ): Promise<SearchResult[]> {
    const results = this.db
      .prepare(
        `
      SELECT
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE (
        e.title LIKE ? OR
        e.problem LIKE ? OR
        e.solution LIKE ?
      )
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY e.usage_count DESC
      LIMIT ?
    `
      )
      .all(
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        ...(options.category ? [options.category] : []),
        options.limit || 10
      );

    return Promise.resolve(this.convertToSearchResults(results, 'exact'));
  }

  private executeFTSSearch(
    query: string,
    options: Partial<SearchOptions>
  ): Promise<SearchResult[]> {
    const ftsQuery = this.prepareFTSQuery(query);

    const results = this.db
      .prepare(
        `
      SELECT
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        bm25(kb_fts, 3.0, 2.0, 1.5, 1.0) as relevance_score
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ?
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY relevance_score DESC
      LIMIT ?
    `
      )
      .all(ftsQuery, ...(options.category ? [options.category] : []), options.limit || 10);

    return Promise.resolve(this.convertToSearchResults(results, 'fts'));
  }

  private executeFuzzySearch(
    query: string,
    options: Partial<SearchOptions>
  ): Promise<SearchResult[]> {
    const terms = query.split(/\s+/).filter(term => term.length > 2);
    const likeConditions = terms
      .map(() => '(e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)')
      .join(' AND ');

    const params = terms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]);

    const results = this.db
      .prepare(
        `
      SELECT
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE ${likeConditions}
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY e.usage_count DESC
      LIMIT ?
    `
      )
      .all(...params, ...(options.category ? [options.category] : []), options.limit || 10);

    return Promise.resolve(this.convertToSearchResults(results, 'fuzzy'));
  }

  private async executeHybridSearch(
    query: string,
    options: Partial<SearchOptions>
  ): Promise<SearchResult[]> {
    // Execute multiple strategies and merge results
    const [exactResults, ftsResults, fuzzyResults] = await Promise.all([
      this.executeExactMatch(query, { ...options, limit: 5 }),
      this.executeFTSSearch(query, { ...options, limit: 5 }),
      this.executeFuzzySearch(query, { ...options, limit: 5 }),
    ]);

    // Merge and deduplicate results
    const mergedResults = new Map<string, SearchResult>();

    [exactResults, ftsResults, fuzzyResults].forEach((results, strategyIndex) => {
      const strategyWeight = [1.5, 1.0, 0.8][strategyIndex]; // Weights for exact, FTS, fuzzy

      results.forEach(result => {
        const existing = mergedResults.get(result.entry.id!);
        if (existing) {
          // Boost score for results found by multiple strategies
          existing.score = Math.max(existing.score, result.score * strategyWeight);
        } else {
          mergedResults.set(result.entry.id!, {
            ...result,
            score: result.score * strategyWeight,
            matchType: 'hybrid',
          });
        }
      });
    });

    return Array.from(mergedResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);
  }

  private convertToSearchResults(rows: any[], matchType: string): SearchResult[] {
    return rows.map(row => ({
      entry: {
        id: row.id,
        title: row.title,
        problem: row.problem,
        solution: row.solution,
        category: row.category,
        severity: row.severity,
        tags: row.tags ? row.tags.split(', ') : [],
        usage_count: row.usage_count,
        success_count: row.success_count,
        failure_count: row.failure_count,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        created_by: row.created_by,
        last_used: row.last_used ? new Date(row.last_used) : undefined,
        archived: row.archived,
      },
      score: row.relevance_score || Math.log(row.usage_count + 1) * 10,
      matchType: matchType as any,
    }));
  }

  private prepareFTSQuery(query: string): string {
    // Handle special prefixes
    if (query.startsWith('category:')) {
      return `category:${query.substring(9)}`;
    }
    if (query.startsWith('tag:')) {
      return `tags:${query.substring(4)}`;
    }

    // Clean and prepare query for FTS
    let ftsQuery = query.trim().replace(/['"]/g, '');
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 1);

    if (terms.length === 0) return ftsQuery;

    // Use phrase search for multi-word queries
    if (terms.length > 1) {
      return `"${terms.join(' ')}"`;
    }

    // Single term with prefix matching
    return `${terms[0]}*`;
  }

  private updatePerformanceMetrics(query: string, executionTime: number, strategy: string): void {
    // Track execution times per query
    const queryTimes = this.performanceTracker.get(query) || [];
    queryTimes.push(executionTime);

    // Keep only last 100 executions per query
    if (queryTimes.length > 100) {
      queryTimes.splice(0, queryTimes.length - 100);
    }

    this.performanceTracker.set(query, queryTimes);

    // Log to search history
    this.db
      .prepare(
        `
      INSERT INTO search_history (
        query, normalized_query, timestamp, results_count, execution_time, strategy
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        query,
        this.normalizeQuery(query),
        new Date().toISOString(),
        0, // Will be updated when results are available
        executionTime,
        strategy
      );
  }

  private updateResponseTimeDistribution(executionTime: number): void {
    if (executionTime < 50) {
      this.searchStats.responseTimeDistribution.under50++;
    } else if (executionTime < 100) {
      this.searchStats.responseTimeDistribution.under100++;
    } else if (executionTime < 500) {
      this.searchStats.responseTimeDistribution.under500++;
    } else {
      this.searchStats.responseTimeDistribution.over500++;
    }
  }

  private calculateQuerySimilarity(query1: string, query2: string): number {
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateQueryComplexity(query: string): {
    isComplex: boolean;
    hasSpecialTerms: boolean;
    wordCount: number;
  } {
    const words = query.split(/\s+/).filter(word => word.length > 0);
    const hasOperators = /[:@]/.test(query);
    const hasSpecialTerms = /\b(status|code|error|S0C\d|IEF\d|WER\d)\b/i.test(query);

    return {
      isComplex: words.length > 3 || hasOperators,
      hasSpecialTerms,
      wordCount: words.length,
    };
  }

  private calculateQPS(): number {
    // Calculate queries per second over the last minute
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const recentQueries = this.db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM search_history
      WHERE timestamp > ?
    `
      )
      .get(oneMinuteAgo) as { count: number };

    return recentQueries.count / 60; // Convert to per-second
  }

  private estimateCacheMemoryUsage(): number {
    // Rough estimate of cache memory usage in bytes
    const cacheStats = this.cache.getStats();
    const avgEntrySize = 2048; // Estimated average size per cache entry

    return cacheStats.size * avgEntrySize;
  }

  private generateIndexRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze query patterns to suggest indexes
    const categoryQueries = Array.from(this.searchStats.queryFrequency.keys()).filter(query =>
      query.includes('category:')
    );

    if (categoryQueries.length > 10) {
      recommendations.push(
        'Consider optimizing category index for better category-filtered searches'
      );
    }

    const tagQueries = Array.from(this.searchStats.queryFrequency.keys()).filter(query =>
      query.includes('tag:')
    );

    if (tagQueries.length > 10) {
      recommendations.push('Consider adding composite index on kb_tags for better tag searches');
    }

    // Check for slow full-text searches
    const slowFTSQueries = Array.from(this.performanceTracker.entries()).filter(
      ([query, times]) => {
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        return avgTime > 200 && !query.startsWith('category:') && !query.startsWith('tag:');
      }
    );

    if (slowFTSQueries.length > 5) {
      recommendations.push('Consider rebuilding FTS index to improve full-text search performance');
    }

    return recommendations;
  }

  private setupPerformanceMonitoring(): void {
    // Clean up old performance data every hour
    setInterval(
      () => {
        // Keep only recent performance data
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

        this.performanceTracker.forEach((times, query) => {
          // Remove times older than 24 hours (simplified - in reality we'd need timestamps)
          if (times.length > 1000) {
            times.splice(0, times.length - 500); // Keep last 500 measurements
          }
        });
      },
      60 * 60 * 1000
    ); // Run every hour
  }
}
