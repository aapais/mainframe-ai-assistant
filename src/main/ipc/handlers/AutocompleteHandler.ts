/**
 * Autocomplete Service IPC Handler
 *
 * Handles all autocomplete and intelligent search suggestion operations
 * including multi-source aggregation, learning, and context-aware matching.
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode,
} from '../../../types/ipc';
import {
  AutocompleteSuggestion,
  SearchContext,
  SuggestionSource,
} from '../../../database/schemas/HierarchicalCategories.schema';
import { AutocompleteService } from '../../../services/AutocompleteService';
import { CategoryService } from '../../../services/CategoryService';
import { TagService } from '../../../services/TagService';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { HandlerUtils, HandlerConfigs } from './index';

// Request/Response Types
interface AutocompleteRequest extends BaseIPCRequest {
  query: string;
  context?: SearchContext;
  options?: {
    max_suggestions?: number;
    min_confidence?: number;
    sources?: SuggestionSource[];
    include_learning?: boolean;
    fuzzy_matching?: boolean;
  };
}

interface AutocompleteResponse extends BaseIPCResponse {
  data: AutocompleteSuggestion[];
  metadata: {
    query_processing_time: number;
    sources_used: SuggestionSource[];
    total_candidates: number;
    learning_applied: boolean;
  };
}

interface AutocompleteSearchRequest extends BaseIPCRequest {
  query: string;
  search_type: 'unified' | 'category' | 'tag' | 'entry' | 'history';
  context?: SearchContext;
  options?: {
    limit?: number;
    offset?: number;
    include_analytics?: boolean;
    boost_popular?: boolean;
  };
}

interface AutocompleteSearchResponse extends BaseIPCResponse {
  data: {
    suggestions: AutocompleteSuggestion[];
    categories: any[];
    tags: any[];
    entries: any[];
    history: any[];
  };
  metadata: {
    total_results: number;
    search_time: number;
    cache_hit: boolean;
  };
}

interface AutocompleteLearnRequest extends BaseIPCRequest {
  query: string;
  selected_suggestion: AutocompleteSuggestion;
  context?: SearchContext;
  outcome?: {
    was_helpful: boolean;
    result_found: boolean;
    time_to_result?: number;
  };
}

interface AutocompleteCacheRequest extends BaseIPCRequest {
  action: 'warm' | 'clear' | 'stats';
  options?: {
    category?: string;
    force_rebuild?: boolean;
  };
}

interface AutocompleteCacheResponse extends BaseIPCResponse {
  data: {
    action_performed: string;
    cache_size?: number;
    entries_processed?: number;
    rebuild_time?: number;
  };
}

interface AutocompleteAnalyticsRequest extends BaseIPCRequest {
  timeframe?: string;
  options?: {
    include_learning_metrics?: boolean;
    include_performance_metrics?: boolean;
    include_popular_queries?: boolean;
  };
}

/**
 * Autocomplete Service Handler
 *
 * Provides intelligent search suggestions with multi-source aggregation,
 * learning capabilities, and performance optimization.
 */
export class AutocompleteHandler {
  private autocompleteService: AutocompleteService;

  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager,
    categoryService: CategoryService,
    tagService: TagService
  ) {
    this.autocompleteService = new AutocompleteService(
      dbManager,
      cacheManager,
      categoryService,
      tagService
    );
  }

  /**
   * Get autocomplete suggestions
   */
  handleAutocomplete: IPCHandlerFunction<'autocomplete:suggestions'> = async (
    request: AutocompleteRequest
  ) => {
    const startTime = Date.now();

    try {
      const { query, context, options = {} } = request;

      // Validate query
      if (!query || query.trim().length === 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query is required for autocomplete'
        );
      }

      if (query.length > 100) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query too long (max 100 characters)'
        );
      }

      // Sanitize query
      const sanitizedQuery = HandlerUtils.sanitizeString(query, 100);

      // Check cache first for frequent queries
      const cacheKey = HandlerUtils.generateCacheKey(
        'autocomplete',
        sanitizedQuery,
        context,
        options
      );
      const cached = await this.cacheManager.get<AutocompleteSuggestion[]>(cacheKey);

      if (cached) {
        return HandlerUtils.createSuccessResponse(request.requestId, startTime, cached, {
          query_processing_time: Date.now() - startTime,
          sources_used: ['cache'] as SuggestionSource[],
          total_candidates: cached.length,
          learning_applied: false,
          cached: true,
        }) as AutocompleteResponse;
      }

      const processingStart = Date.now();

      // Get suggestions from service
      const suggestions = await this.autocompleteService.getSuggestions(sanitizedQuery, {
        maxSuggestions: options.max_suggestions || 10,
        minConfidence: options.min_confidence || 0.1,
        sources: options.sources,
        includeLearning: options.include_learning !== false,
        fuzzyMatching: options.fuzzy_matching !== false,
        context: context || {},
      });

      const processingTime = Date.now() - processingStart;

      // Extract metadata from results
      const sourcesUsed = [...new Set(suggestions.map(s => s.source))];
      const totalCandidates = suggestions.length;
      const learningApplied = suggestions.some(s => s.source === 'learning');

      // Cache results for popular queries
      if (sanitizedQuery.length >= 2 && suggestions.length > 0) {
        await this.cacheManager.set(cacheKey, suggestions, {
          ttl: 180000, // 3 minutes
          layer: 'memory',
          tags: ['autocomplete', `query:${sanitizedQuery.substring(0, 10)}`],
        });
      }

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, suggestions, {
        query_processing_time: processingTime,
        sources_used: sourcesUsed,
        total_candidates: totalCandidates,
        learning_applied: learningApplied,
      }) as AutocompleteResponse;
    } catch (error) {
      console.error('Autocomplete error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Autocomplete failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Unified search across all sources
   */
  handleSearch: IPCHandlerFunction<'autocomplete:search'> = async (
    request: AutocompleteSearchRequest
  ) => {
    const startTime = Date.now();

    try {
      const { query, search_type, context, options = {} } = request;

      // Validate inputs
      if (!query || query.trim().length === 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query is required for search'
        );
      }

      const validSearchTypes = ['unified', 'category', 'tag', 'entry', 'history'];
      if (!validSearchTypes.includes(search_type)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid search type'
        );
      }

      const sanitizedQuery = HandlerUtils.sanitizeString(query, 100);

      // Check cache for unified searches
      let cacheHit = false;
      const cacheKey = HandlerUtils.generateCacheKey(
        'search',
        search_type,
        sanitizedQuery,
        options
      );

      if (search_type === 'unified' && sanitizedQuery.length >= 2) {
        const cached = await this.cacheManager.get<any>(cacheKey);
        if (cached) {
          return HandlerUtils.createSuccessResponse(request.requestId, startTime, cached, {
            total_results: this.countSearchResults(cached),
            search_time: Date.now() - startTime,
            cache_hit: true,
          }) as AutocompleteSearchResponse;
        }
      }

      const searchStart = Date.now();

      // Perform search based on type
      let results;
      switch (search_type) {
        case 'unified':
          results = await this.performUnifiedSearch(sanitizedQuery, context, options);
          break;
        case 'category':
          results = await this.performCategorySearch(sanitizedQuery, options);
          break;
        case 'tag':
          results = await this.performTagSearch(sanitizedQuery, options);
          break;
        case 'entry':
          results = await this.performEntrySearch(sanitizedQuery, options);
          break;
        case 'history':
          results = await this.performHistorySearch(sanitizedQuery, options);
          break;
        default:
          throw new Error(`Unknown search type: ${search_type}`);
      }

      const searchTime = Date.now() - searchStart;

      // Cache unified search results
      if (search_type === 'unified' && sanitizedQuery.length >= 2) {
        await this.cacheManager.set(cacheKey, results, {
          ttl: 300000, // 5 minutes
          layer: 'memory',
          tags: ['search', 'unified', `query:${sanitizedQuery.substring(0, 10)}`],
        });
      }

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, results, {
        total_results: this.countSearchResults(results),
        search_time: searchTime,
        cache_hit: cacheHit,
      }) as AutocompleteSearchResponse;
    } catch (error) {
      console.error('Autocomplete search error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Learn from user selections
   */
  handleLearn: IPCHandlerFunction<'autocomplete:learn'> = async (
    request: AutocompleteLearnRequest
  ) => {
    const startTime = Date.now();

    try {
      const { query, selected_suggestion, context, outcome } = request;

      // Validate inputs
      if (!query || !selected_suggestion) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query and selected suggestion are required for learning'
        );
      }

      const sanitizedQuery = HandlerUtils.sanitizeString(query, 100);

      // Record learning data
      await this.autocompleteService.recordSelection(
        sanitizedQuery,
        selected_suggestion,
        context || {},
        outcome
      );

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, null, {
        learning_recorded: true,
        query: sanitizedQuery,
        suggestion_type: selected_suggestion.type,
        helpful: outcome?.was_helpful,
      });
    } catch (error) {
      console.error('Autocomplete learning error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Learning failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Manage autocomplete cache
   */
  handleCacheManagement: IPCHandlerFunction<'autocomplete:cache'> = async (
    request: AutocompleteCacheRequest
  ) => {
    const startTime = Date.now();

    try {
      const { action, options = {} } = request;

      let result;
      switch (action) {
        case 'warm':
          result = await this.warmCache(options);
          break;
        case 'clear':
          result = await this.clearCache(options);
          break;
        case 'stats':
          result = await this.getCacheStats();
          break;
        default:
          return HandlerUtils.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.VALIDATION_FAILED,
            'Invalid cache action'
          );
      }

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, {
        action_performed: action,
        ...result,
      }) as AutocompleteCacheResponse;
    } catch (error) {
      console.error('Cache management error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Cache management failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get autocomplete analytics
   */
  handleAnalytics: IPCHandlerFunction<'autocomplete:analytics'> = async (
    request: AutocompleteAnalyticsRequest
  ) => {
    const startTime = Date.now();

    try {
      const { timeframe = '30d', options = {} } = request;

      const analytics = await this.autocompleteService.getAnalytics(timeframe, options);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, analytics, {
        timeframe,
        generatedAt: new Date().toISOString(),
        includeMetrics: {
          learning: options.include_learning_metrics || false,
          performance: options.include_performance_metrics || false,
          popular: options.include_popular_queries || false,
        },
      });
    } catch (error) {
      console.error('Autocomplete analytics error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Analytics failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Private helper methods

  private async performUnifiedSearch(query: string, context?: SearchContext, options?: any) {
    const [suggestions, categories, tags, entries, history] = await Promise.all([
      this.autocompleteService.getSuggestions(query, {
        maxSuggestions: options?.limit || 5,
        context: context || {},
      }),
      this.performCategorySearch(query, { limit: 3 }),
      this.performTagSearch(query, { limit: 5 }),
      this.performEntrySearch(query, { limit: 5 }),
      this.performHistorySearch(query, { limit: 3 }),
    ]);

    return {
      suggestions,
      categories: categories.categories || [],
      tags: tags.tags || [],
      entries: entries.entries || [],
      history: history.history || [],
    };
  }

  private async performCategorySearch(query: string, options?: any) {
    // This would integrate with CategoryService through the autocomplete service
    const categories = await this.autocompleteService.searchCategories(query, options?.limit || 10);
    return { categories };
  }

  private async performTagSearch(query: string, options?: any) {
    // This would integrate with TagService through the autocomplete service
    const tags = await this.autocompleteService.searchTags(query, options?.limit || 10);
    return { tags };
  }

  private async performEntrySearch(query: string, options?: any) {
    // This would integrate with existing KB search through the autocomplete service
    const entries = await this.autocompleteService.searchEntries(query, options?.limit || 10);
    return { entries };
  }

  private async performHistorySearch(query: string, options?: any) {
    // This would search through search history
    const history = await this.autocompleteService.searchHistory(query, options?.limit || 10);
    return { history };
  }

  private countSearchResults(results: any): number {
    if (!results) return 0;

    let count = 0;
    if (results.suggestions) count += results.suggestions.length;
    if (results.categories) count += results.categories.length;
    if (results.tags) count += results.tags.length;
    if (results.entries) count += results.entries.length;
    if (results.history) count += results.history.length;

    return count;
  }

  private async warmCache(options: any): Promise<any> {
    const warmStart = Date.now();

    // Warm cache with popular queries and common prefixes
    const popularQueries = await this.autocompleteService.getPopularQueries(100);
    let processedCount = 0;

    for (const query of popularQueries) {
      try {
        await this.autocompleteService.getSuggestions(query, {
          maxSuggestions: 10,
          context: {},
        });
        processedCount++;
      } catch (error) {
        console.warn(`Failed to warm cache for query: ${query}`, error);
      }
    }

    const warmTime = Date.now() - warmStart;

    return {
      entries_processed: processedCount,
      rebuild_time: warmTime,
    };
  }

  private async clearCache(options: any): Promise<any> {
    let clearedCount = 0;

    if (options.category) {
      // Clear cache for specific category
      await this.cacheManager.invalidateByTags([`category:${options.category}`]);
    } else {
      // Clear all autocomplete caches
      await this.cacheManager.invalidateByTags(['autocomplete', 'search']);
      clearedCount = await this.cacheManager.size();
    }

    return {
      cache_size: clearedCount,
    };
  }

  private async getCacheStats(): Promise<any> {
    const size = await this.cacheManager.size();
    const hitRate = (await this.cacheManager.getHitRate?.()) || 0;

    return {
      cache_size: size,
      hit_rate: hitRate,
      memory_usage: process.memoryUsage().heapUsed,
    };
  }
}

// Handler configuration with appropriate settings for autocomplete operations
export const autocompleteHandlerConfigs = {
  'autocomplete:suggestions': {
    ...HandlerConfigs.SEARCH_OPERATIONS,
    cacheTTL: 180000, // 3 minutes for suggestions
    rateLimitConfig: { requests: 100, windowMs: 60000 }, // Higher limit for autocomplete
  },
  'autocomplete:search': HandlerConfigs.SEARCH_OPERATIONS,
  'autocomplete:learn': HandlerConfigs.WRITE_OPERATIONS,
  'autocomplete:cache': HandlerConfigs.SYSTEM_OPERATIONS,
  'autocomplete:analytics': HandlerConfigs.SYSTEM_OPERATIONS,
} as const;
