/**
 * FTS5 Search API Controller - REST Endpoints for Advanced Search
 *
 * Features:
 * - RESTful API endpoints for FTS5 search operations
 * - Request validation and error handling
 * - Rate limiting and security measures
 * - Search analytics and monitoring
 * - Response caching and optimization
 */

import { Request, Response, NextFunction } from 'express';
import { FTS5SearchService } from '../../../services/FTS5SearchService';
import { SearchResultsIntegrationAdapter } from '../../../services/SearchResultsIntegrationAdapter';
import { AppError } from '../../core/errors/AppError';
import { RateLimiter } from '../../middleware/RateLimiter';
import { RequestValidator } from '../../middleware/RequestValidator';

export interface SearchRequest extends Request {
  body: {
    query: string;
    options?: {
      limit?: number;
      offset?: number;
      category?: string;
      query_type?: 'simple' | 'boolean' | 'phrase' | 'proximity';
      include_facets?: boolean;
      include_snippets?: boolean;
      sort_by?: 'relevance' | 'date' | 'usage' | 'title';
      sort_order?: 'asc' | 'desc';
      fields?: string[];
      boost_fields?: Record<string, number>;
      date_range?: {
        from?: string;
        to?: string;
      };
      min_score?: number;
    };
    user_id?: string;
    session_id?: string;
  };
}

export interface SuggestionsRequest extends Request {
  query: {
    q: string;
    limit?: string;
    category?: string;
  };
}

export interface AnalyticsRequest extends Request {
  query: {
    timeframe?: string;
    metric?: string;
  };
}

/**
 * FTS5 Search Controller
 * Handles all search-related HTTP requests with comprehensive validation and error handling
 */
export class FTS5SearchController {
  private searchService: FTS5SearchService;
  private integrationAdapter: SearchResultsIntegrationAdapter;
  private rateLimiter: RateLimiter;
  private requestValidator: RequestValidator;

  constructor(
    searchService: FTS5SearchService,
    integrationAdapter: SearchResultsIntegrationAdapter
  ) {
    this.searchService = searchService;
    this.integrationAdapter = integrationAdapter;
    this.rateLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
      skipSuccessfulRequests: false,
    });
    this.requestValidator = new RequestValidator();

    // Bind methods to preserve context
    this.search = this.search.bind(this);
    this.suggestions = this.suggestions.bind(this);
    this.analytics = this.analytics.bind(this);
    this.rebuildIndex = this.rebuildIndex.bind(this);
    this.healthCheck = this.healthCheck.bind(this);
  }

  /**
   * Main search endpoint
   * POST /api/search
   */
  async search(req: SearchRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now();

      // Rate limiting
      await this.rateLimiter.checkLimit(req, res);

      // Validate request
      const validation = this.validateSearchRequest(req.body);
      if (!validation.valid) {
        throw new AppError(
          `Invalid search request: ${validation.errors.join(', ')}`,
          'VALIDATION_ERROR',
          400
        );
      }

      const { query, options = {}, user_id, session_id } = req.body;

      // Convert date strings to Date objects if provided
      if (options.date_range) {
        if (options.date_range.from) {
          options.date_range.from = new Date(options.date_range.from) as any;
        }
        if (options.date_range.to) {
          options.date_range.to = new Date(options.date_range.to) as any;
        }
      }

      // Add user context
      const searchOptions = {
        ...options,
        userId: user_id,
        sessionId: session_id,
        userContext: req.headers['user-agent'] || 'unknown',
      };

      // Execute search
      const results = await this.searchService.search(query, searchOptions);

      // Process results through integration adapter for UI compatibility
      const processedResults = await this.integrationAdapter.adaptSearchResults(results.results, {
        query,
        pagination: results.pagination,
        facets: results.facets,
      });

      const responseTime = Date.now() - startTime;

      // Enhanced response with metadata
      const response = {
        success: true,
        data: {
          ...results,
          results: processedResults.results,
          ui_state: processedResults.uiState,
        },
        meta: {
          request_id: req.headers['x-request-id'] || 'unknown',
          response_time: responseTime,
          server_time: new Date().toISOString(),
          api_version: '2.0',
        },
      };

      // Set caching headers for search results
      res.set({
        'Cache-Control': 'private, max-age=300', // 5 minutes
        'X-Response-Time': `${responseTime}ms`,
        'X-Search-Engine': 'FTS5-Advanced',
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search suggestions endpoint
   * GET /api/search/suggestions?q=query&limit=10
   */
  async suggestions(req: SuggestionsRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Rate limiting (more lenient for suggestions)
      await this.rateLimiter.checkLimit(req, res, { maxRequests: 200 });

      const { q, limit = '10', category } = req.query;

      if (!q || q.length < 2) {
        res.status(200).json({
          success: true,
          data: {
            suggestions: [],
            meta: {
              query: q || '',
              count: 0,
            },
          },
        });
        return;
      }

      const suggestions = await this.searchService.getSuggestions(q, Math.min(parseInt(limit), 20));

      res.set({
        'Cache-Control': 'private, max-age=120', // 2 minutes
        'X-Search-Engine': 'FTS5-Suggestions',
      });

      res.status(200).json({
        success: true,
        data: {
          suggestions,
          meta: {
            query: q,
            count: suggestions.length,
            category: category || null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search analytics endpoint
   * GET /api/search/analytics?timeframe=24h&metric=all
   */
  async analytics(req: AnalyticsRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // More restrictive rate limiting for analytics
      await this.rateLimiter.checkLimit(req, res, { maxRequests: 20 });

      const stats = this.searchService.getSearchStats();

      const response = {
        success: true,
        data: {
          stats,
          timestamp: new Date().toISOString(),
          timeframe: req.query.timeframe || '24h',
        },
      };

      res.set({
        'Cache-Control': 'private, max-age=60', // 1 minute
        'X-Data-Source': 'search-analytics',
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rebuild search index endpoint
   * POST /api/search/index/rebuild
   */
  async rebuildIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Very restrictive rate limiting for index operations
      await this.rateLimiter.checkLimit(req, res, { maxRequests: 1, windowMs: 5 * 60 * 1000 });

      // This should be admin-only in production
      if (!this.isAdminRequest(req)) {
        throw new AppError('Admin access required', 'UNAUTHORIZED', 403);
      }

      await this.searchService.rebuildIndex();

      res.status(200).json({
        success: true,
        message: 'Search index rebuild completed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check endpoint
   * GET /api/search/health
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = this.searchService.getSearchStats();

      const health = {
        status: 'healthy',
        service: 'FTS5SearchService',
        timestamp: new Date().toISOString(),
        metrics: {
          total_searches: stats.total_searches,
          cache_hit_rate: stats.cache_hit_rate,
          avg_response_time: stats.avg_response_time,
          error_rate: stats.error_rate,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      // Determine health status based on metrics
      if (stats.error_rate > 0.1) {
        health.status = 'degraded';
      }
      if (stats.avg_response_time > 2000) {
        health.status = 'slow';
      }

      res.status(200).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'FTS5SearchService',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Private Methods

  private validateSearchRequest(body: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.query || typeof body.query !== 'string') {
      errors.push('Query is required and must be a string');
    } else if (body.query.length > 500) {
      errors.push('Query cannot exceed 500 characters');
    } else if (body.query.length < 1) {
      errors.push('Query cannot be empty');
    }

    if (body.options) {
      const options = body.options;

      if (options.limit !== undefined) {
        if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
          errors.push('Limit must be an integer between 1 and 100');
        }
      }

      if (options.offset !== undefined) {
        if (!Number.isInteger(options.offset) || options.offset < 0) {
          errors.push('Offset must be a non-negative integer');
        }
      }

      if (
        options.query_type &&
        !['simple', 'boolean', 'phrase', 'proximity'].includes(options.query_type)
      ) {
        errors.push('Invalid query_type. Must be one of: simple, boolean, phrase, proximity');
      }

      if (options.sort_by && !['relevance', 'date', 'usage', 'title'].includes(options.sort_by)) {
        errors.push('Invalid sort_by. Must be one of: relevance, date, usage, title');
      }

      if (options.sort_order && !['asc', 'desc'].includes(options.sort_order)) {
        errors.push('Invalid sort_order. Must be either asc or desc');
      }

      if (options.min_score !== undefined) {
        if (
          typeof options.min_score !== 'number' ||
          options.min_score < 0 ||
          options.min_score > 1
        ) {
          errors.push('min_score must be a number between 0 and 1');
        }
      }

      if (options.date_range) {
        if (options.date_range.from && isNaN(Date.parse(options.date_range.from))) {
          errors.push('Invalid from date format');
        }
        if (options.date_range.to && isNaN(Date.parse(options.date_range.to))) {
          errors.push('Invalid to date format');
        }
      }

      if (
        options.fields &&
        (!Array.isArray(options.fields) || !options.fields.every(f => typeof f === 'string'))
      ) {
        errors.push('fields must be an array of strings');
      }

      if (options.boost_fields && typeof options.boost_fields !== 'object') {
        errors.push('boost_fields must be an object');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isAdminRequest(req: Request): boolean {
    // In production, implement proper admin authentication
    // For now, check for a simple admin header
    return req.headers['x-admin-key'] === process.env.ADMIN_API_KEY;
  }

  /**
   * Get middleware stack for search routes
   */
  getMiddleware() {
    return [
      this.rateLimiter.middleware(),
      this.requestValidator.middleware(),
      // Add other middleware as needed (authentication, logging, etc.)
    ];
  }

  /**
   * Error handler middleware
   */
  errorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      // Log the error
      console.error('Search API Error:', {
        error: error.message,
        stack: error.stack,
        request: {
          method: req.method,
          url: req.url,
          body: req.body,
          query: req.query,
        },
      });

      // Handle specific error types
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            type: 'ApplicationError',
          },
          meta: {
            request_id: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Handle rate limiting errors
      if (error.type === 'RATE_LIMIT_EXCEEDED') {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retry_after: error.retry_after,
          },
        });
        return;
      }

      // Handle validation errors
      if (error.type === 'VALIDATION_ERROR') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: error.details,
          },
        });
        return;
      }

      // Generic error handler
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          type: 'SystemError',
        },
        meta: {
          request_id: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });
    };
  }
}
