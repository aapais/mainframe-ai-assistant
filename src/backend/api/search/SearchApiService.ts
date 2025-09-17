/**
 * Search API Service - Business Logic Layer
 * Orchestrates search operations with performance optimization and intelligent caching
 */

import { KBEntry, SearchResult } from '../../../types/index';
import { AdvancedSearchEngine } from '../../../services/search/AdvancedSearchEngine';
import { AutocompleteService } from './AutocompleteService';
import { SearchHistoryService } from './SearchHistoryService';
import { AppError } from '../../core/errors/AppError';

export interface SearchParams {
  query: string;
  limit: number;
  offset: number;
  category?: string;
  includeArchived: boolean;
  fuzzyThreshold: number;
  useAI: boolean;
  userId?: string;
  sessionId?: string;
}

export interface AutocompleteParams {
  query: string;
  limit: number;
  category?: string;
  userId?: string;
}

export interface HistoryParams {
  userId?: string;
  limit: number;
  offset: number;
  timeframe: string;
}

export interface SearchResponse {
  results: SearchResult[];
  suggestions: string[];
  facets: SearchFacet[];
  metadata: SearchMetadata;
  timing: SearchTiming;
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: string;
    count: number;
  }>;
}

export interface SearchMetadata {
  query: string;
  totalResults: number;
  hasMore: boolean;
  appliedFilters: Record<string, any>;
  searchAlgorithm: string;
}

export interface SearchTiming {
  indexTime: number;
  queryTime: number;
  rankingTime: number;
  totalTime: number;
}

export interface AutocompleteSuggestion {
  text: string;
  type: 'query' | 'category' | 'tag' | 'title';
  frequency: number;
  category?: string;
}

export interface SearchHistory {
  entries: SearchHistoryEntry[];
  pagination: {
    total: number;
    hasMore: boolean;
    nextOffset?: number;
  };
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
  responseTime: number;
  category?: string;
  successful: boolean;
}

/**
 * High-Performance Search API Service
 * Features:
 * - Intelligent search orchestration
 * - Performance-optimized query execution
 * - Real-time autocomplete suggestions
 * - Comprehensive search history management
 * - Error handling with graceful degradation
 */
export class SearchApiService {
  private searchEngine: AdvancedSearchEngine;
  private autocompleteService: AutocompleteService;
  private historyService: SearchHistoryService;

  constructor(
    searchEngine: AdvancedSearchEngine,
    autocompleteService: AutocompleteService,
    historyService: SearchHistoryService
  ) {
    this.searchEngine = searchEngine;
    this.autocompleteService = autocompleteService;
    this.historyService = historyService;
  }

  /**
   * Execute comprehensive search with performance monitoring
   */
  async executeSearch(params: SearchParams): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Validate search parameters
      this.validateSearchParams(params);

      // Start parallel operations for performance
      const [
        searchResults,
        suggestions,
        facets
      ] = await Promise.all([
        this.performSearch(params),
        this.generateSuggestions(params.query, params.category),
        this.generateFacets(params)
      ]);

      const totalTime = Date.now() - startTime;

      // Record search in history (async, don't wait)
      this.recordSearchHistory(params, searchResults, totalTime);

      return {
        results: searchResults.results,
        suggestions,
        facets,
        metadata: {
          query: params.query,
          totalResults: searchResults.total,
          hasMore: searchResults.hasMore,
          appliedFilters: this.extractAppliedFilters(params),
          searchAlgorithm: searchResults.algorithm
        },
        timing: {
          indexTime: searchResults.timing.indexTime,
          queryTime: searchResults.timing.queryTime,
          rankingTime: searchResults.timing.rankingTime,
          totalTime
        }
      };

    } catch (error) {
      console.error('Search execution error:', error);

      // Try fallback search without AI
      if (params.useAI && error.message.includes('AI')) {
        console.warn('AI search failed, falling back to local search');
        return this.executeSearch({ ...params, useAI: false });
      }

      throw new AppError(
        'Search execution failed',
        'SEARCH_ERROR',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get intelligent autocomplete suggestions
   */
  async getAutocompleteSuggestions(params: AutocompleteParams): Promise<AutocompleteSuggestion[]> {
    try {
      if (params.query.length < 2) {
        return [];
      }

      // Get suggestions from multiple sources in parallel
      const [
        querySuggestions,
        categorySuggestions,
        titleSuggestions,
        tagSuggestions
      ] = await Promise.all([
        this.autocompleteService.getQuerySuggestions(params.query, params.limit),
        this.autocompleteService.getCategorySuggestions(params.query, params.category),
        this.autocompleteService.getTitleSuggestions(params.query, params.limit),
        this.autocompleteService.getTagSuggestions(params.query, params.limit)
      ]);

      // Combine and rank suggestions
      const allSuggestions = [
        ...querySuggestions.map(s => ({ ...s, type: 'query' as const })),
        ...categorySuggestions.map(s => ({ ...s, type: 'category' as const })),
        ...titleSuggestions.map(s => ({ ...s, type: 'title' as const })),
        ...tagSuggestions.map(s => ({ ...s, type: 'tag' as const }))
      ];

      // Remove duplicates and sort by relevance
      const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);

      return uniqueSuggestions
        .sort((a, b) => this.calculateSuggestionScore(b, params.query) - this.calculateSuggestionScore(a, params.query))
        .slice(0, params.limit);

    } catch (error) {
      console.error('Autocomplete error:', error);
      // Return empty array on error to avoid breaking the UI
      return [];
    }
  }

  /**
   * Get search history with filtering and pagination
   */
  async getSearchHistory(params: HistoryParams): Promise<SearchHistory> {
    try {
      const result = await this.historyService.getHistory({
        userId: params.userId,
        limit: params.limit,
        offset: params.offset,
        timeframe: this.parseTimeframe(params.timeframe)
      });

      return {
        entries: result.entries.map(entry => ({
          id: entry.id,
          query: entry.query,
          timestamp: entry.timestamp,
          resultCount: entry.resultCount,
          responseTime: entry.responseTime,
          category: entry.category,
          successful: entry.successful
        })),
        pagination: {
          total: result.total,
          hasMore: result.hasMore,
          nextOffset: result.hasMore ? params.offset + params.limit : undefined
        }
      };

    } catch (error) {
      console.error('Search history error:', error);
      throw new AppError(
        'Failed to retrieve search history',
        'HISTORY_ERROR',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Perform the actual search operation
   */
  private async performSearch(params: SearchParams): Promise<{
    results: SearchResult[];
    total: number;
    hasMore: boolean;
    algorithm: string;
    timing: SearchTiming;
  }> {
    const searchStartTime = Date.now();

    const searchOptions = {
      query: params.query,
      limit: params.limit,
      offset: params.offset,
      category: params.category,
      includeArchived: params.includeArchived,
      fuzzyThreshold: params.fuzzyThreshold,
      useAI: params.useAI,
      userId: params.userId
    };

    const response = await this.searchEngine.search(searchOptions);

    return {
      results: response.results,
      total: response.metadata.totalResults,
      hasMore: response.metadata.totalResults > (params.offset + params.limit),
      algorithm: response.metadata.algorithm || 'combined',
      timing: {
        indexTime: response.metrics?.indexTime || 0,
        queryTime: response.metrics?.queryTime || 0,
        rankingTime: response.metrics?.rankingTime || 0,
        totalTime: Date.now() - searchStartTime
      }
    };
  }

  /**
   * Generate intelligent search suggestions
   */
  private async generateSuggestions(query: string, category?: string): Promise<string[]> {
    try {
      if (query.length < 3) {
        return [];
      }

      const suggestions = await this.autocompleteService.getQuerySuggestions(query, 5);
      return suggestions.map(s => s.text);

    } catch (error) {
      console.error('Suggestion generation error:', error);
      return [];
    }
  }

  /**
   * Generate search facets for filtering
   */
  private async generateFacets(params: SearchParams): Promise<SearchFacet[]> {
    try {
      // For now, return basic facets - can be enhanced later
      const facets: SearchFacet[] = [
        {
          field: 'category',
          values: [
            { value: 'JCL', count: 0 },
            { value: 'VSAM', count: 0 },
            { value: 'DB2', count: 0 },
            { value: 'Batch', count: 0 },
            { value: 'Functional', count: 0 }
          ]
        }
      ];

      // Get actual counts if needed (optimize for performance)
      if (!params.category) {
        // Only calculate facet counts for non-filtered searches
        const counts = await this.searchEngine.getFacetCounts(params.query);
        if (counts) {
          facets[0].values = Object.entries(counts.categories || {}).map(([value, count]) => ({
            value,
            count: count as number
          }));
        }
      }

      return facets;

    } catch (error) {
      console.error('Facet generation error:', error);
      return [];
    }
  }

  /**
   * Record search in history (async operation)
   */
  private recordSearchHistory(params: SearchParams, results: any, responseTime: number): void {
    setTimeout(async () => {
      try {
        await this.historyService.recordSearch({
          query: params.query,
          userId: params.userId,
          sessionId: params.sessionId,
          resultCount: results.results?.length || 0,
          responseTime,
          category: params.category,
          successful: (results.results?.length || 0) > 0,
          useAI: params.useAI
        });
      } catch (error) {
        console.error('Failed to record search history:', error);
      }
    }, 0);
  }

  /**
   * Validate search parameters
   */
  private validateSearchParams(params: SearchParams): void {
    if (!params.query || params.query.trim().length === 0) {
      throw new AppError('Query is required', 'INVALID_QUERY', 400);
    }

    if (params.query.length > 500) {
      throw new AppError('Query too long (max 500 characters)', 'QUERY_TOO_LONG', 400);
    }

    if (params.limit < 1 || params.limit > 100) {
      throw new AppError('Limit must be between 1 and 100', 'INVALID_LIMIT', 400);
    }

    if (params.offset < 0) {
      throw new AppError('Offset cannot be negative', 'INVALID_OFFSET', 400);
    }

    if (params.fuzzyThreshold < 0.1 || params.fuzzyThreshold > 1.0) {
      throw new AppError('Fuzzy threshold must be between 0.1 and 1.0', 'INVALID_THRESHOLD', 400);
    }
  }

  /**
   * Extract applied filters from search parameters
   */
  private extractAppliedFilters(params: SearchParams): Record<string, any> {
    const filters: Record<string, any> = {};

    if (params.category) {
      filters.category = params.category;
    }

    if (params.includeArchived) {
      filters.includeArchived = true;
    }

    if (params.fuzzyThreshold !== 0.7) {
      filters.fuzzyThreshold = params.fuzzyThreshold;
    }

    return filters;
  }

  /**
   * Remove duplicate suggestions while preserving order
   */
  private deduplicateSuggestions(suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
    const seen = new Set<string>();
    const result: AutocompleteSuggestion[] = [];

    for (const suggestion of suggestions) {
      const key = suggestion.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(suggestion);
      }
    }

    return result;
  }

  /**
   * Calculate suggestion relevance score
   */
  private calculateSuggestionScore(suggestion: AutocompleteSuggestion, query: string): number {
    let score = 0;

    // Base frequency score
    score += suggestion.frequency * 10;

    // Prefix match bonus
    if (suggestion.text.toLowerCase().startsWith(query.toLowerCase())) {
      score += 50;
    }

    // Contains match bonus
    if (suggestion.text.toLowerCase().includes(query.toLowerCase())) {
      score += 20;
    }

    // Type bonuses
    switch (suggestion.type) {
      case 'query':
        score += 30; // Highest priority
        break;
      case 'title':
        score += 20;
        break;
      case 'category':
        score += 15;
        break;
      case 'tag':
        score += 10;
        break;
    }

    // Length penalty for very long suggestions
    if (suggestion.text.length > 50) {
      score -= 10;
    }

    return score;
  }

  /**
   * Parse timeframe string to number of hours
   */
  private parseTimeframe(timeframe: string): number {
    const timeframeMap: Record<string, number> = {
      '1h': 1,
      '6h': 6,
      '12h': 12,
      '1d': 24,
      '3d': 72,
      '7d': 168,
      '30d': 720
    };

    return timeframeMap[timeframe] || 168; // default to 7 days
  }
}