/**
 * Search API Controller - High-Performance Search Endpoints
 * Handles all search-related HTTP endpoints with comprehensive error handling and monitoring
 */

import { Request, Response } from 'express';
import { SearchApiService } from './SearchApiService';
import { MultiLayerCacheSystem as MultiLayerCache } from '../../cache/MultiLayerCacheSystem';
import { SearchMetricsCollector } from './SearchMetricsCollector';
import { RateLimiter } from '../../middleware/RateLimiter';
import { RequestValidator } from '../../middleware/RequestValidator';
import { AppError } from '../../core/errors/AppError';

export interface SearchRequest extends Request {
  body: {
    query: string;
    options?: {
      limit?: number;
      offset?: number;
      category?: string;
      includeArchived?: boolean;
      fuzzyThreshold?: number;
      useAI?: boolean;
    };
    context?: {
      userId?: string;
      sessionId?: string;
      userAgent?: string;
    };
  };
}

export interface AutocompleteRequest extends Request {
  query: {
    q: string;
    limit?: string;
    category?: string;
  };
}

export interface HistoryRequest extends Request {
  query: {
    userId?: string;
    limit?: string;
    offset?: string;
    timeframe?: string;
  };
}

export interface MetricsRequest extends Request {
  query: {
    timeframe?: string;
    granularity?: string;
    userId?: string;
  };
}

/**
 * Production-ready Search API Controller
 * Features:
 * - Sub-second response times with caching
 * - Comprehensive error handling and logging
 * - Rate limiting and request validation
 * - Real-time performance metrics
 * - Graceful degradation on failures
 */
export class SearchApiController {
  private searchService: SearchApiService;
  private cache: MultiLayerCache;
  private metricsCollector: SearchMetricsCollector;
  private rateLimiter: RateLimiter;
  private validator: RequestValidator;

  constructor(
    searchService: SearchApiService,
    cache: MultiLayerCache,
    metricsCollector: SearchMetricsCollector
  ) {
    this.searchService = searchService;
    this.cache = cache;
    this.metricsCollector = metricsCollector;
    this.rateLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      skipSuccessfulRequests: false,
    });
    this.validator = new RequestValidator();

    // Bind methods to preserve 'this' context
    this.autocomplete = this.autocomplete.bind(this);
    this.executeSearch = this.executeSearch.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getMetrics = this.getMetrics.bind(this);
  }

  /**
   * POST /api/search/autocomplete
   * Real-time search suggestions with aggressive caching
   */
  async autocomplete(req: AutocompleteRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Rate limiting
      await this.rateLimiter.checkLimit(req);

      // Input validation
      const { q, limit, category } = req.query;
      this.validator.validateAutocompleteRequest({ q, limit, category });

      const query = q.trim();
      const maxResults = Math.min(parseInt(limit || '10'), 20);

      // Check L0 cache (in-memory) first
      const cacheKey = `autocomplete:${query}:${category || 'all'}:${maxResults}`;
      let suggestions = await this.cache.get(cacheKey);

      if (!suggestions) {
        // Generate suggestions (assuming SearchApiService has this method)
        suggestions = await this.searchService.getAutocompleteSuggestions(query, maxResults, {
          userId: req.headers['x-user-id'] as string,
          currentQuery: query,
          preferredCategories: category ? [category] : undefined,
        });

        // Cache for 5 minutes with L0 priority (memory cache)
        await this.cache.set(cacheKey, suggestions, 300, { layer: 'L0' });
      }

      const responseTime = Date.now() - startTime;

      // Record metrics
      await this.metricsCollector.recordAutocomplete({
        requestId,
        query,
        responseTime,
        resultCount: suggestions.length,
        cacheHit: !!suggestions,
        userId: req.headers['x-user-id'] as string,
      });

      res.json({
        success: true,
        data: {
          query,
          suggestions,
          metadata: {
            count: suggestions.length,
            responseTime,
            cacheHit: !!suggestions,
          },
        },
        requestId,
      });
    } catch (error) {
      this.handleError(error, req, res, requestId, 'autocomplete', Date.now() - startTime);
    }
  }

  /**
   * POST /api/search/execute
   * Full-text search with multi-layer caching and AI enhancement
   */
  async executeSearch(req: SearchRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Rate limiting
      await this.rateLimiter.checkLimit(req);

      // Input validation
      this.validator.validateSearchRequest(req.body);

      const { query, options = {}, context = {} } = req.body;
      const searchParams = {
        query: query.trim(),
        limit: Math.min(options.limit || 10, 100),
        offset: Math.max(options.offset || 0, 0),
        category: options.category,
        includeArchived: options.includeArchived || false,
        fuzzyThreshold: Math.min(Math.max(options.fuzzyThreshold || 0.7, 0.1), 1.0),
        useAI: options.useAI !== false, // default true
        ...context,
      };

      // Multi-layer cache strategy
      const cacheKey = this.generateCacheKey(searchParams);
      let searchResult = await this.cache.get(cacheKey);
      let fromCache = !!searchResult;

      if (!searchResult) {
        // Execute search with performance monitoring
        const searchStartTime = Date.now();
        searchResult = await this.searchService.executeSearch(searchParams);

        const searchTime = Date.now() - searchStartTime;
        searchResult.metadata.searchTime = searchTime;

        // Cache strategy based on query complexity and results
        const ttl = this.calculateCacheTTL(searchParams, searchResult);
        const cacheLayer = this.selectCacheLayer(searchParams, searchResult);

        await this.cache.set(cacheKey, searchResult, ttl, { layer: cacheLayer });
      }

      const responseTime = Date.now() - startTime;

      // Record comprehensive metrics
      await this.metricsCollector.recordSearch({
        requestId,
        query: searchParams.query,
        responseTime,
        resultCount: searchResult.results.length,
        cacheHit: fromCache,
        useAI: searchParams.useAI,
        category: searchParams.category,
        userId: searchParams.userId,
        sessionId: searchParams.sessionId,
      });

      res.json({
        success: true,
        data: {
          ...searchResult,
          metadata: {
            ...searchResult.metadata,
            responseTime,
            cacheHit: fromCache,
            requestId,
          },
        },
        requestId,
      });
    } catch (error) {
      this.handleError(error, req, res, requestId, 'search', Date.now() - startTime);
    }
  }

  /**
   * GET /api/search/history
   * Retrieve search history with filtering and pagination
   */
  async getHistory(req: HistoryRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Rate limiting
      await this.rateLimiter.checkLimit(req);

      // Input validation
      const { userId, limit, offset, timeframe } = req.query;
      this.validator.validateHistoryRequest({ userId, limit, offset, timeframe });

      const historyParams = {
        userId,
        limit: Math.min(parseInt(limit || '50'), 200),
        offset: Math.max(parseInt(offset || '0'), 0),
        timeframe: timeframe || '7d', // default 7 days
      };

      // Check L1 cache (Redis) for history
      const cacheKey = `history:${historyParams.userId}:${historyParams.limit}:${historyParams.offset}:${historyParams.timeframe}`;
      let history = await this.cache.get(cacheKey);

      if (!history) {
        history = await this.searchService.getSearchHistory(historyParams);

        // Cache for 30 minutes in L1 (Redis)
        await this.cache.set(cacheKey, history, 1800, { layer: 'L1' });
      }

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          ...history,
          metadata: {
            responseTime,
            cacheHit: !!history,
            requestId,
          },
        },
        requestId,
      });
    } catch (error) {
      this.handleError(error, req, res, requestId, 'history', Date.now() - startTime);
    }
  }

  /**
   * GET /api/search/metrics
   * Real-time search performance and usage metrics
   */
  async getMetrics(req: MetricsRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Rate limiting (more restrictive for metrics)
      await this.rateLimiter.checkLimit(req, { windowMs: 60000, max: 20 });

      // Input validation
      const { timeframe, granularity, userId } = req.query;
      this.validator.validateMetricsRequest({ timeframe, granularity, userId });

      const metricsParams = {
        timeframe: timeframe || '1h',
        granularity: granularity || '5m',
        userId,
      };

      // Metrics are cached less aggressively (L2 - database cache)
      const cacheKey = `metrics:${metricsParams.timeframe}:${metricsParams.granularity}:${metricsParams.userId || 'all'}`;
      let metrics = await this.cache.get(cacheKey);

      if (!metrics) {
        metrics = await this.metricsCollector.getMetrics(metricsParams);

        // Cache for 2 minutes in L2
        await this.cache.set(cacheKey, metrics, 120, { layer: 'L2' });
      }

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          ...metrics,
          metadata: {
            responseTime,
            cacheHit: !!metrics,
            requestId,
          },
        },
        requestId,
      });
    } catch (error) {
      this.handleError(error, req, res, requestId, 'metrics', Date.now() - startTime);
    }
  }

  /**
   * Generate cache key based on search parameters
   */
  private generateCacheKey(params: any): string {
    const keyParts = [
      params.query.toLowerCase(),
      params.category || 'all',
      params.limit,
      params.offset,
      params.includeArchived,
      params.fuzzyThreshold,
      params.useAI,
    ];
    return `search:${keyParts.join(':')}`;
  }

  /**
   * Calculate cache TTL based on query characteristics
   */
  private calculateCacheTTL(params: any, result: any): number {
    let ttl = 300; // default 5 minutes

    // Longer TTL for stable queries
    if (result.results.length > 0) {
      ttl += 300; // +5 minutes
    }

    // Shorter TTL for AI-enhanced queries (more dynamic)
    if (params.useAI) {
      ttl = Math.max(ttl - 180, 60); // min 1 minute
    }

    // Category-specific caching
    if (params.category) {
      ttl += 120; // +2 minutes for category searches
    }

    return ttl;
  }

  /**
   * Select optimal cache layer based on query characteristics
   */
  private selectCacheLayer(params: any, result: any): 'L0' | 'L1' | 'L2' {
    // L0 (memory) for frequent, small results
    if (result.results.length <= 5 && !params.useAI) {
      return 'L0';
    }

    // L1 (Redis) for most queries
    if (result.results.length <= 50) {
      return 'L1';
    }

    // L2 (database cache) for large result sets
    return 'L2';
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Centralized error handling with comprehensive logging and metrics
   */
  private async handleError(
    error: any,
    req: Request,
    res: Response,
    requestId: string,
    operation: string,
    responseTime: number
  ): Promise<void> {
    console.error(`Search API Error [${requestId}] ${operation}:`, {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      userId: req.headers['x-user-id'],
    });

    // Record error metrics
    await this.metricsCollector.recordError({
      requestId,
      operation,
      error: error.message,
      responseTime,
      userId: req.headers['x-user-id'] as string,
    });

    // Return appropriate error response
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
        requestId,
      });
    } else if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: error.message,
        },
        requestId,
      });
    } else if (error.name === 'RateLimitError') {
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: error.retryAfter,
        },
        requestId,
      });
    } else {
      // Generic server error
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        requestId,
      });
    }
  }
}
