/**
 * FTS5 Search Service - Advanced Full-Text Search Backend
 *
 * Features:
 * - Complete FTS5 query parser with boolean operators
 * - Advanced ranking algorithms (BM25, TF-IDF, hybrid)
 * - Intelligent pagination with offset/limit controls
 * - Real-time search result filtering and faceting
 * - Query optimization and caching
 * - Performance monitoring and debugging
 * - Snippet generation with highlighting
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import {
  FTS5SearchOptions,
  FTS5SearchResult,
  SearchPagination,
  PaginatedSearchResponse,
  SearchFacet,
  FTS5QueryParser,
  ParsedQuery,
  SearchServiceConfig,
  KBEntry
} from '../types/services';

export interface FTS5DatabaseSchema {
  kb_entries: {
    id: string;
    title: string;
    problem: string;
    solution: string;
    category: string;
    tags: string;
    created_at: string;
    updated_at: string;
    usage_count: number;
    success_count: number;
    failure_count: number;
  };
  kb_fts: {
    id: string;
    title: string;
    problem: string;
    solution: string;
    tags: string;
    category: string;
  };
}

export interface RankingWeights {
  title: number;
  problem: number;
  solution: number;
  tags: number;
  category: number;
  usage: number;
  recency: number;
  success_rate: number;
}

export interface SearchDebugInfo {
  query_parsing_time: number;
  fts_execution_time: number;
  ranking_time: number;
  total_time: number;
  cache_hit: boolean;
  query_rewrite: string;
  results_count: number;
  index_used: string;
}

/**
 * High-Performance FTS5 Search Service
 * Implements advanced full-text search with comprehensive backend features
 */
export class FTS5SearchService extends EventEmitter {
  private db: Database.Database;
  private queryParser: FTS5QueryParser;
  private config: SearchServiceConfig;
  private cache = new Map<string, { results: PaginatedSearchResponse; timestamp: number }>();
  private stats = {
    total_searches: 0,
    cache_hits: 0,
    avg_response_time: 0,
    error_count: 0
  };

  // Prepared statements for performance
  private statements: {
    searchFTS: Database.Statement;
    getFacetCounts: Database.Statement;
    getEntryDetails: Database.Statement;
    updateUsageStats: Database.Statement;
    getSearchStats: Database.Statement;
  };

  constructor(config: SearchServiceConfig) {
    super();
    this.config = config;
    this.queryParser = new FTS5QueryParser();
    this.initializeDatabase();
    this.prepareStatements();
    this.setupCacheCleanup();
  }

  /**
   * Main search method with comprehensive FTS5 support
   */
  async search(
    query: string,
    options: FTS5SearchOptions = {}
  ): Promise<PaginatedSearchResponse> {
    const startTime = Date.now();
    this.stats.total_searches++;

    try {
      // Validate and normalize options
      const normalizedOptions = this.normalizeOptions(options);

      // Check cache first
      const cacheKey = this.generateCacheKey(query, normalizedOptions);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.stats.cache_hits++;
        this.emit('search:cache_hit', { query, options });
        return cached;
      }

      // Parse the query
      const parsedQuery = this.queryParser.parse(query);

      // Execute the search
      const searchResults = await this.executeSearch(parsedQuery, normalizedOptions);

      // Calculate pagination
      const pagination = this.calculatePagination(
        searchResults.totalResults,
        normalizedOptions.offset || 0,
        normalizedOptions.limit || 20
      );

      // Generate facets if requested
      const facets = normalizedOptions.include_facets
        ? await this.generateFacets(parsedQuery, normalizedOptions)
        : [];

      // Get suggestions if query has few results
      const suggestions = searchResults.results.length < 3
        ? this.queryParser.suggest_corrections(query)
        : [];

      const totalTime = Date.now() - startTime;
      this.updateAverageResponseTime(totalTime);

      const response: PaginatedSearchResponse = {
        results: searchResults.results,
        pagination,
        facets,
        query_info: {
          original_query: query,
          parsed_query: parsedQuery.fts5_query,
          execution_time: searchResults.execution_time,
          total_time: totalTime
        },
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };

      // Cache the results
      this.setInCache(cacheKey, response);

      this.emit('search:completed', {
        query,
        options,
        results_count: searchResults.results.length,
        total_time: totalTime
      });

      return response;

    } catch (error) {
      this.stats.error_count++;
      this.emit('search:error', { query, options, error: error.message });
      throw new Error(`FTS5 search failed: ${error.message}`);
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(
    partialQuery: string,
    limit: number = 10
  ): Promise<string[]> {
    if (partialQuery.length < 2) {
      return [];
    }

    try {
      // Get suggestions from query history and popular terms
      const stmt = this.db.prepare(`
        SELECT DISTINCT query, COUNT(*) as frequency
        FROM search_history
        WHERE query LIKE ?
          AND query != ?
          AND LENGTH(query) >= ?
        GROUP BY query
        ORDER BY frequency DESC, LENGTH(query) ASC
        LIMIT ?
      `);

      const historyResults = stmt.all(
        `${partialQuery}%`,
        partialQuery,
        partialQuery.length,
        limit
      ) as Array<{ query: string; frequency: number }>;

      // Get suggestions from FTS5 index terms
      const ftsStmt = this.db.prepare(`
        SELECT title, problem, solution
        FROM kb_fts
        WHERE kb_fts MATCH ?
        LIMIT 5
      `);

      const ftsResults = ftsStmt.all(`${partialQuery}*`) as Array<{
        title: string;
        problem: string;
        solution: string;
      }>;

      // Extract terms from FTS results
      const termSuggestions = new Set<string>();
      ftsResults.forEach(result => {
        const text = `${result.title} ${result.problem} ${result.solution}`;
        const words = text.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.startsWith(partialQuery.toLowerCase()) && word.length > partialQuery.length) {
            termSuggestions.add(word);
          }
        });
      });

      // Combine and rank suggestions
      const allSuggestions = [
        ...historyResults.map(r => r.query),
        ...Array.from(termSuggestions)
      ];

      return Array.from(new Set(allSuggestions)).slice(0, limit);

    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Get search statistics and performance metrics
   */
  getSearchStats(): {
    total_searches: number;
    cache_hit_rate: number;
    avg_response_time: number;
    error_rate: number;
    index_stats: any;
  } {
    const cacheHitRate = this.stats.total_searches > 0
      ? this.stats.cache_hits / this.stats.total_searches
      : 0;

    const errorRate = this.stats.total_searches > 0
      ? this.stats.error_count / this.stats.total_searches
      : 0;

    // Get FTS5 index statistics
    const indexStats = this.getIndexStats();

    return {
      total_searches: this.stats.total_searches,
      cache_hit_rate: Math.round(cacheHitRate * 100) / 100,
      avg_response_time: Math.round(this.stats.avg_response_time),
      error_rate: Math.round(errorRate * 100) / 100,
      index_stats: indexStats
    };
  }

  /**
   * Rebuild the FTS5 index for better performance
   */
  async rebuildIndex(): Promise<void> {
    try {
      this.emit('index:rebuild_start');

      // Rebuild FTS5 index
      this.db.exec('INSERT INTO kb_fts(kb_fts) VALUES("rebuild")');

      // Optimize the index
      this.db.exec('INSERT INTO kb_fts(kb_fts) VALUES("optimize")');

      this.emit('index:rebuild_complete');

    } catch (error) {
      this.emit('index:rebuild_error', error);
      throw new Error(`Index rebuild failed: ${error.message}`);
    }
  }

  /**
   * Close the search service and cleanup resources
   */
  async close(): Promise<void> {
    try {
      this.cache.clear();
      this.removeAllListeners();
      this.db.close();
    } catch (error) {
      console.error('Error closing FTS5SearchService:', error);
    }
  }

  // Private Methods

  private initializeDatabase(): void {
    this.db = new Database(this.config.database.path);

    // Set pragmas for performance
    Object.entries(this.config.database.pragmas).forEach(([key, value]) => {
      this.db.pragma(`${key} = ${value}`);
    });

    // Ensure FTS5 table exists with proper configuration
    this.createFTSSchema();
  }

  private createFTSSchema(): void {
    // Create FTS5 virtual table if it doesn't exist
    const tokenizerConfig = this.config.fts.tokenizer === 'porter'
      ? "tokenize = 'porter'"
      : `tokenize = '${this.config.fts.tokenizer}'`;

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
        id UNINDEXED,
        title,
        problem,
        solution,
        tags,
        category UNINDEXED,
        ${tokenizerConfig}
      );

      -- Create search history table for suggestions
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        results_count INTEGER DEFAULT 0,
        response_time INTEGER DEFAULT 0,
        success BOOLEAN DEFAULT 1
      );

      -- Index for search history queries
      CREATE INDEX IF NOT EXISTS idx_search_history_query
      ON search_history(query);

      CREATE INDEX IF NOT EXISTS idx_search_history_timestamp
      ON search_history(timestamp);
    `);
  }

  private prepareStatements(): void {
    this.statements = {
      searchFTS: this.db.prepare(`
        SELECT
          f.id,
          e.title,
          e.problem,
          e.solution,
          e.category,
          e.tags,
          e.created_at,
          e.updated_at,
          e.usage_count,
          e.success_count,
          e.failure_count,
          bm25(kb_fts) as bm25_score,
          highlight(kb_fts, 1, '<mark>', '</mark>') as title_highlight,
          highlight(kb_fts, 2, '<mark>', '</mark>') as problem_highlight,
          highlight(kb_fts, 3, '<mark>', '</mark>') as solution_highlight,
          snippet(kb_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
        FROM kb_fts f
        INNER JOIN kb_entries e ON f.id = e.id
        WHERE kb_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `),

      getFacetCounts: this.db.prepare(`
        SELECT
          e.category,
          COUNT(*) as count
        FROM kb_fts f
        INNER JOIN kb_entries e ON f.id = e.id
        WHERE kb_fts MATCH ?
        GROUP BY e.category
        ORDER BY count DESC
      `),

      getEntryDetails: this.db.prepare(`
        SELECT * FROM kb_entries WHERE id = ?
      `),

      updateUsageStats: this.db.prepare(`
        UPDATE kb_entries
        SET usage_count = usage_count + 1,
            updated_at = datetime('now')
        WHERE id = ?
      `),

      getSearchStats: this.db.prepare(`
        SELECT
          COUNT(*) as total_entries,
          AVG(usage_count) as avg_usage,
          MAX(created_at) as last_updated
        FROM kb_entries
      `)
    };
  }

  private normalizeOptions(options: FTS5SearchOptions): Required<FTS5SearchOptions> {
    return {
      ...options,
      limit: Math.min(options.limit || 20, this.config.pagination.maxPageSize),
      offset: Math.max(options.offset || 0, 0),
      query_type: options.query_type || 'simple',
      sort_by: options.sort_by || 'relevance',
      sort_order: options.sort_order || 'desc',
      include_snippets: options.include_snippets ?? true,
      snippet_length: options.snippet_length || 150,
      min_score: options.min_score || 0.1,
      include_facets: options.include_facets ?? false,
      useAI: options.useAI ?? false,
      category: options.category,
      tags: options.tags,
      threshold: options.threshold || 0.7,
      sortBy: options.sortBy || 'relevance',
      sortOrder: options.sortOrder || 'desc',
      includeHighlights: options.includeHighlights ?? true,
      fields: options.fields || ['title', 'problem', 'solution', 'tags'],
      boost_fields: options.boost_fields || {
        title: 2.0,
        problem: 1.5,
        solution: 1.2,
        tags: 1.8
      },
      date_range: options.date_range,
      userId: options.userId,
      sessionId: options.sessionId,
      userContext: options.userContext
    };
  }

  private async executeSearch(
    parsedQuery: ParsedQuery,
    options: Required<FTS5SearchOptions>
  ): Promise<{
    results: FTS5SearchResult[];
    totalResults: number;
    execution_time: number;
  }> {
    const searchStartTime = Date.now();

    // Build the FTS5 query with ranking
    const ftsQuery = this.buildRankedFTSQuery(parsedQuery, options);

    // Execute the search
    const rawResults = this.statements.searchFTS.all(
      ftsQuery,
      options.limit,
      options.offset
    ) as any[];

    // Get total count for pagination
    const totalCountStmt = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM kb_fts f
      INNER JOIN kb_entries e ON f.id = e.id
      WHERE kb_fts MATCH ?
    `);
    const { total } = totalCountStmt.get(ftsQuery) as { total: number };

    // Process and rank results
    const results = await this.processSearchResults(rawResults, parsedQuery, options);

    const executionTime = Date.now() - searchStartTime;

    return {
      results,
      totalResults: total,
      execution_time: executionTime
    };
  }

  private buildRankedFTSQuery(parsedQuery: ParsedQuery, options: Required<FTS5SearchOptions>): string {
    let query = parsedQuery.fts5_query;

    // Add field-specific boosts if specified
    if (options.fields && options.fields.length > 0) {
      const fieldQueries = options.fields.map(field => {
        const boost = options.boost_fields?.[field] || 1.0;
        if (boost !== 1.0) {
          return `${field}:${parsedQuery.fts5_query}^${boost}`;
        }
        return `${field}:${parsedQuery.fts5_query}`;
      });

      if (fieldQueries.length > 1) {
        query = `(${fieldQueries.join(' OR ')})`;
      } else {
        query = fieldQueries[0];
      }
    }

    // Apply category filter if specified
    if (options.category) {
      query = `${query} AND category:${options.category}`;
    }

    return query;
  }

  private async processSearchResults(
    rawResults: any[],
    parsedQuery: ParsedQuery,
    options: Required<FTS5SearchOptions>
  ): Promise<FTS5SearchResult[]> {
    return rawResults.map((row, index) => {
      // Calculate enhanced score
      const enhancedScore = this.calculateEnhancedScore(row, options);

      // Create field matches analysis
      const fieldMatches = this.analyzeFieldMatches(row, parsedQuery);

      // Generate snippet if requested
      const snippet = options.include_snippets ? this.generateSnippet(row, parsedQuery, options.snippet_length) : undefined;

      const result: FTS5SearchResult = {
        entry: {
          id: row.id,
          title: row.title,
          problem: row.problem,
          solution: row.solution,
          category: row.category,
          tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
          usage_count: row.usage_count || 0,
          success_count: row.success_count || 0,
          failure_count: row.failure_count || 0
        },
        score: enhancedScore,
        rank: index + 1 + (options.offset || 0),
        bm25_score: Math.abs(row.bm25_score) || 0,
        matchType: this.determineMatchType(row, parsedQuery),
        snippet,
        field_matches: fieldMatches,
        highlights: this.extractHighlights(row),
        metadata: {
          processingTime: 0,
          source: 'fts5',
          confidence: enhancedScore / 100,
          fallback: false,
          originalQuery: parsedQuery.original
        }
      };

      // Add debug info if requested
      if (process.env.NODE_ENV === 'development') {
        result.debug_info = {
          query_rewrite: parsedQuery.fts5_query,
          execution_time: 0,
          cache_hit: false
        };
      }

      return result;
    });
  }

  private calculateEnhancedScore(row: any, options: Required<FTS5SearchOptions>): number {
    const baseScore = Math.abs(row.bm25_score) * 20 + 50; // Normalize BM25 score
    let enhancedScore = baseScore;

    // Apply ranking weights from config
    const weights = this.config.ranking.boosts;

    // Usage boost
    if (row.usage_count > 0) {
      enhancedScore += Math.min(weights.usage * Math.log(row.usage_count + 1) * 5, 20);
    }

    // Success rate boost
    const totalRatings = (row.success_count || 0) + (row.failure_count || 0);
    if (totalRatings > 0) {
      const successRate = row.success_count / totalRatings;
      enhancedScore += successRate * 15;
    }

    // Recency boost
    const daysSinceCreation = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      enhancedScore += weights.recency * (1 - daysSinceCreation / 30) * 10;
    }

    return Math.min(100, Math.max(0, enhancedScore));
  }

  private analyzeFieldMatches(row: any, parsedQuery: ParsedQuery): Record<string, number> {
    const fieldMatches: Record<string, number> = {};

    // Simple field match analysis
    const queryTerms = parsedQuery.terms.map(t => t.term.toLowerCase());

    ['title', 'problem', 'solution', 'tags'].forEach(field => {
      const fieldText = (row[field] || '').toLowerCase();
      let matches = 0;

      queryTerms.forEach(term => {
        if (fieldText.includes(term)) {
          matches++;
        }
      });

      fieldMatches[field] = matches;
    });

    return fieldMatches;
  }

  private generateSnippet(row: any, parsedQuery: ParsedQuery, maxLength: number): string {
    // Use FTS5 snippet if available
    if (row.snippet) {
      return row.snippet.length > maxLength
        ? row.snippet.substring(0, maxLength) + '...'
        : row.snippet;
    }

    // Fallback snippet generation
    const text = `${row.title} ${row.problem} ${row.solution}`;
    const firstTerm = parsedQuery.terms[0]?.term;

    if (firstTerm) {
      const index = text.toLowerCase().indexOf(firstTerm.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + firstTerm.length + 50);
        let snippet = text.substring(start, end);

        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';

        return snippet;
      }
    }

    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  private determineMatchType(row: any, parsedQuery: ParsedQuery): string {
    // Simple match type determination
    if (row.title_highlight && row.title_highlight !== row.title) {
      return 'title';
    }
    if (row.problem_highlight && row.problem_highlight !== row.problem) {
      return 'problem';
    }
    if (row.solution_highlight && row.solution_highlight !== row.solution) {
      return 'solution';
    }
    return 'fuzzy';
  }

  private extractHighlights(row: any): Array<{ field: string; text: string }> {
    const highlights = [];

    if (row.title_highlight && row.title_highlight !== row.title) {
      highlights.push({ field: 'title', text: row.title_highlight });
    }
    if (row.problem_highlight && row.problem_highlight !== row.problem) {
      highlights.push({ field: 'problem', text: row.problem_highlight });
    }
    if (row.solution_highlight && row.solution_highlight !== row.solution) {
      highlights.push({ field: 'solution', text: row.solution_highlight });
    }

    return highlights;
  }

  private calculatePagination(
    totalResults: number,
    offset: number,
    limit: number
  ): SearchPagination {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalResults / limit);

    return {
      current_page: currentPage,
      page_size: limit,
      total_results: totalResults,
      total_pages: totalPages,
      has_next: currentPage < totalPages,
      has_previous: currentPage > 1,
      next_offset: currentPage < totalPages ? offset + limit : undefined,
      previous_offset: currentPage > 1 ? Math.max(0, offset - limit) : undefined
    };
  }

  private async generateFacets(
    parsedQuery: ParsedQuery,
    options: Required<FTS5SearchOptions>
  ): Promise<SearchFacet[]> {
    try {
      const facetResults = this.statements.getFacetCounts.all(parsedQuery.fts5_query) as Array<{
        category: string;
        count: number;
      }>;

      return [
        {
          field: 'category',
          values: facetResults.map(r => ({
            value: r.category,
            count: r.count,
            selected: r.category === options.category
          }))
        }
      ];
    } catch (error) {
      console.error('Error generating facets:', error);
      return [];
    }
  }

  private generateCacheKey(query: string, options: Required<FTS5SearchOptions>): string {
    const keyData = {
      query,
      limit: options.limit,
      offset: options.offset,
      category: options.category,
      sort_by: options.sort_by,
      sort_order: options.sort_order
    };

    return `search:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  private getFromCache(key: string): PaginatedSearchResponse | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if cache entry is still valid (5 minutes TTL)
    if (Date.now() - cached.timestamp > 300000) {
      this.cache.delete(key);
      return null;
    }

    return cached.results;
  }

  private setInCache(key: string, results: PaginatedSearchResponse): void {
    // Limit cache size
    if (this.cache.size >= 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  private setupCacheCleanup(): void {
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.cache) {
        if (now - cached.timestamp > 300000) {
          this.cache.delete(key);
        }
      }
    }, 300000);
  }

  private updateAverageResponseTime(responseTime: number): void {
    this.stats.avg_response_time = (
      (this.stats.avg_response_time * (this.stats.total_searches - 1)) + responseTime
    ) / this.stats.total_searches;
  }

  private getIndexStats(): any {
    try {
      const stats = this.statements.getSearchStats.get() as any;
      return {
        total_entries: stats.total_entries || 0,
        avg_usage: Math.round(stats.avg_usage || 0),
        last_updated: stats.last_updated
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}