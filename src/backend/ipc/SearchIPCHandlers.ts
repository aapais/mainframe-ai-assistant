/**
 * Search IPC Handlers - Electron Main Process Integration
 * High-performance IPC bridge between renderer and search backend services
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { SearchApiService } from '../api/search/SearchApiService';
import { SearchHistoryService } from '../api/search/SearchHistoryService';
import { AutocompleteService } from '../api/search/AutocompleteService';
import { SearchMetricsCollector } from '../api/search/SearchMetricsCollector';
import { MultiLayerCache } from '../cache/MultiLayerCache';
import { RequestValidator } from '../middleware/RequestValidator';
import { RateLimiter } from '../middleware/RateLimiter';
import { AppError } from '../core/errors/AppError';

export interface IPCSearchRequest {
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
}

export interface IPCAutocompleteRequest {
  query: string;
  limit?: number;
  category?: string;
  userId?: string;
}

export interface IPCHistoryRequest {
  userId?: string;
  limit?: number;
  offset?: number;
  timeframe?: string;
  category?: string;
  successful?: boolean;
}

export interface IPCMetricsRequest {
  timeframe?: string;
  granularity?: string;
  userId?: string;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  metadata?: {
    responseTime: number;
    requestId: string;
    cacheHit?: boolean;
  };
}

/**
 * High-Performance Search IPC Handler
 * Features:
 * - Async IPC communication with error handling
 * - Request validation and sanitization
 * - Performance monitoring and metrics
 * - Caching integration
 * - Rate limiting for renderer protection
 * - Graceful error handling and fallbacks
 */
export class SearchIPCHandlers {
  private searchService: SearchApiService;
  private historyService: SearchHistoryService;
  private autocompleteService: AutocompleteService;
  private metricsCollector: SearchMetricsCollector;
  private cache: MultiLayerCache;
  private validator: RequestValidator;
  private rateLimiter: RateLimiter;

  // Performance tracking
  private requestMetrics = new Map<string, {
    startTime: number;
    operation: string;
    requestId: string;
  }>();

  constructor(
    searchService: SearchApiService,
    historyService: SearchHistoryService,
    autocompleteService: AutocompleteService,
    metricsCollector: SearchMetricsCollector,
    cache: MultiLayerCache
  ) {
    this.searchService = searchService;
    this.historyService = historyService;
    this.autocompleteService = autocompleteService;
    this.metricsCollector = metricsCollector;
    this.cache = cache;
    this.validator = new RequestValidator();
    this.rateLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 200, // 200 requests per minute per renderer
      keyGenerator: (req: any) => `renderer:${req.sessionId || 'default'}`
    });

    this.registerHandlers();
  }

  /**
   * Register all IPC handlers
   */
  private registerHandlers(): void {
    // Search handlers
    ipcMain.handle('search:execute', this.handleSearch.bind(this));
    ipcMain.handle('search:autocomplete', this.handleAutocomplete.bind(this));
    ipcMain.handle('search:suggestions', this.handleSuggestions.bind(this));

    // History handlers
    ipcMain.handle('search:history:get', this.handleGetHistory.bind(this));
    ipcMain.handle('search:history:clear', this.handleClearHistory.bind(this));

    // Metrics handlers
    ipcMain.handle('search:metrics:get', this.handleGetMetrics.bind(this));
    ipcMain.handle('search:metrics:dashboard', this.handleGetDashboard.bind(this));

    // Cache handlers
    ipcMain.handle('search:cache:stats', this.handleGetCacheStats.bind(this));
    ipcMain.handle('search:cache:clear', this.handleClearCache.bind(this));
    ipcMain.handle('search:cache:warm', this.handleWarmCache.bind(this));

    // System handlers
    ipcMain.handle('search:system:health', this.handleSystemHealth.bind(this));
    ipcMain.handle('search:system:stats', this.handleSystemStats.bind(this));

    console.log('Search IPC handlers registered');
  }

  /**
   * Handle search execution
   */
  private async handleSearch(
    event: IpcMainInvokeEvent,
    request: IPCSearchRequest
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Rate limiting check
      await this.checkRateLimit(event, 'search');

      // Input validation
      this.validator.validateSearchRequest(request);

      // Sanitize input
      const sanitizedRequest = this.validator.sanitizeInput(request);

      // Execute search
      const searchParams = {
        query: sanitizedRequest.query,
        limit: sanitizedRequest.options?.limit || 10,
        offset: sanitizedRequest.options?.offset || 0,
        category: sanitizedRequest.options?.category,
        includeArchived: sanitizedRequest.options?.includeArchived || false,
        fuzzyThreshold: sanitizedRequest.options?.fuzzyThreshold || 0.7,
        useAI: sanitizedRequest.options?.useAI !== false,
        userId: sanitizedRequest.context?.userId,
        sessionId: sanitizedRequest.context?.sessionId || event.sender.id.toString()
      };

      const result = await this.searchService.executeSearch(searchParams);

      const responseTime = Date.now() - startTime;

      // Record metrics
      await this.metricsCollector.recordSearch({
        requestId,
        query: searchParams.query,
        responseTime,
        resultCount: result.results.length,
        cacheHit: false, // TODO: Implement cache hit detection
        useAI: searchParams.useAI,
        category: searchParams.category,
        userId: searchParams.userId,
        sessionId: searchParams.sessionId
      });

      return {
        success: true,
        data: result,
        metadata: {
          responseTime,
          requestId,
          cacheHit: false
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'search', Date.now() - startTime);
    }
  }

  /**
   * Handle autocomplete requests
   */
  private async handleAutocomplete(
    event: IpcMainInvokeEvent,
    request: IPCAutocompleteRequest
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Rate limiting check (more permissive for autocomplete)
      await this.checkRateLimit(event, 'autocomplete', { max: 500, windowMs: 60000 });

      // Input validation
      this.validator.validateAutocompleteRequest({
        q: request.query,
        limit: request.limit?.toString(),
        category: request.category
      });

      // Get suggestions
      const suggestions = await this.autocompleteService.getAutocompleteSuggestions({
        query: request.query,
        limit: request.limit || 10,
        category: request.category,
        userId: request.userId
      });

      const responseTime = Date.now() - startTime;

      // Record metrics
      await this.metricsCollector.recordAutocomplete({
        requestId,
        query: request.query,
        responseTime,
        resultCount: suggestions.length,
        cacheHit: false,
        userId: request.userId
      });

      return {
        success: true,
        data: { suggestions },
        metadata: {
          responseTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'autocomplete', Date.now() - startTime);
    }
  }

  /**
   * Handle suggestion requests (broader than autocomplete)
   */
  private async handleSuggestions(
    event: IpcMainInvokeEvent,
    request: { type: 'trending' | 'popular' | 'personalized'; userId?: string; limit?: number }
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.checkRateLimit(event, 'suggestions');

      let suggestions: any[] = [];

      switch (request.type) {
        case 'trending':
          suggestions = await this.autocompleteService.getTrendingSuggestions('', request.limit || 10);
          break;
        case 'popular':
          // Get popular searches from history
          const analytics = await this.historyService.getAnalytics(24);
          suggestions = analytics.topQueries.map(q => ({
            text: q.query,
            type: 'query',
            frequency: q.count,
            relevanceScore: q.count * 10,
            source: 'system'
          }));
          break;
        case 'personalized':
          if (request.userId) {
            suggestions = await this.autocompleteService.getPersonalizedSuggestions(
              '',
              request.userId,
              request.limit || 10
            );
          }
          break;
      }

      return {
        success: true,
        data: { suggestions: suggestions.slice(0, request.limit || 10) },
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'suggestions', Date.now() - startTime);
    }
  }

  /**
   * Handle get search history
   */
  private async handleGetHistory(
    event: IpcMainInvokeEvent,
    request: IPCHistoryRequest
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.checkRateLimit(event, 'history');

      this.validator.validateHistoryRequest({
        userId: request.userId,
        limit: request.limit?.toString(),
        offset: request.offset?.toString(),
        timeframe: request.timeframe
      });

      const historyParams = {
        userId: request.userId,
        limit: request.limit || 50,
        offset: request.offset || 0,
        timeframe: this.parseTimeframe(request.timeframe || '7d'),
        category: request.category,
        successful: request.successful
      };

      const history = await this.historyService.getHistory(historyParams);

      return {
        success: true,
        data: history,
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'history', Date.now() - startTime);
    }
  }

  /**
   * Handle clear search history
   */
  private async handleClearHistory(
    event: IpcMainInvokeEvent,
    request: { userId?: string; timeframe?: string }
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.checkRateLimit(event, 'history-clear');

      // For now, implement as cleanup with shorter retention
      const retentionDays = request.timeframe === 'all' ? 0 : 1;
      const result = await this.historyService.cleanup(retentionDays);

      return {
        success: true,
        data: { removed: result.removed },
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'history-clear', Date.now() - startTime);
    }
  }

  /**
   * Handle get metrics
   */
  private async handleGetMetrics(
    event: IpcMainInvokeEvent,
    request: IPCMetricsRequest
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.checkRateLimit(event, 'metrics', { max: 50, windowMs: 60000 });

      this.validator.validateMetricsRequest(request);

      const metrics = await this.metricsCollector.getMetrics({
        timeframe: request.timeframe || '1d',
        granularity: request.granularity || '1h',
        userId: request.userId
      });

      return {
        success: true,
        data: metrics,
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'metrics', Date.now() - startTime);
    }
  }

  /**
   * Handle get dashboard data
   */
  private async handleGetDashboard(
    event: IpcMainInvokeEvent
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.checkRateLimit(event, 'dashboard', { max: 30, windowMs: 60000 });

      const dashboard = await this.metricsCollector.getDashboardData();

      return {
        success: true,
        data: dashboard,
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'dashboard', Date.now() - startTime);
    }
  }

  /**
   * Handle get cache stats
   */
  private async handleGetCacheStats(
    event: IpcMainInvokeEvent
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();

    try {
      await this.checkRateLimit(event, 'cache-stats');

      const stats = this.cache.getStats();

      return {
        success: true,
        data: stats,
        metadata: {
          responseTime: Date.now(),
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'cache-stats', 0);
    }
  }

  /**
   * Handle clear cache
   */
  private async handleClearCache(
    event: IpcMainInvokeEvent,
    request?: { layer?: 'L0' | 'L1' | 'L2' | 'all' }
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.checkRateLimit(event, 'cache-clear', { max: 10, windowMs: 300000 }); // 10 per 5 minutes

      if (!request?.layer || request.layer === 'all') {
        await this.cache.clear();
      } else {
        // Layer-specific clearing would need additional implementation
        await this.cache.clear();
      }

      return {
        success: true,
        data: { message: 'Cache cleared successfully' },
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'cache-clear', Date.now() - startTime);
    }
  }

  /**
   * Handle warm cache
   */
  private async handleWarmCache(
    event: IpcMainInvokeEvent,
    request: { queries: string[] }
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      await this.checkRateLimit(event, 'cache-warm', { max: 5, windowMs: 300000 }); // 5 per 5 minutes

      if (!Array.isArray(request.queries) || request.queries.length > 50) {
        throw new AppError('Invalid warm cache request', 'INVALID_REQUEST', 400);
      }

      // Warm cache by executing searches for common queries
      const warmupData = new Map<string, any>();
      for (const query of request.queries.slice(0, 20)) { // Limit to 20 queries
        try {
          const result = await this.searchService.executeSearch({
            query,
            limit: 10,
            offset: 0,
            useAI: false // Use faster non-AI search for warmup
          });
          warmupData.set(`search:${query}:10:0`, result);
        } catch (error) {
          // Continue warming even if individual queries fail
          console.warn(`Cache warmup failed for query "${query}":`, error.message);
        }
      }

      await this.cache.warmCache(Array.from(warmupData.keys()), warmupData);

      return {
        success: true,
        data: { warmed: warmupData.size },
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'cache-warm', Date.now() - startTime);
    }
  }

  /**
   * Handle system health check
   */
  private async handleSystemHealth(
    event: IpcMainInvokeEvent
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      const [cacheStats, rateLimiterStats, dashboardData] = await Promise.all([
        this.cache.getStats(),
        this.rateLimiter.getStats(),
        this.metricsCollector.getDashboardData()
      ]);

      const health = {
        status: dashboardData.systemHealth,
        cache: {
          operational: true,
          hitRate: cacheStats.overall.overallHitRate,
          memoryUsage: cacheStats.overall.memoryUsage
        },
        rateLimiter: {
          operational: true,
          activeKeys: rateLimiterStats.storeStats.totalKeys
        },
        performance: {
          avgResponseTime: dashboardData.avgResponseTime,
          errorRate: dashboardData.errorRate,
          currentRPS: dashboardData.currentRPS
        }
      };

      return {
        success: true,
        data: health,
        metadata: {
          responseTime: Date.now() - startTime,
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'system-health', Date.now() - startTime);
    }
  }

  /**
   * Handle system statistics
   */
  private async handleSystemStats(
    event: IpcMainInvokeEvent
  ): Promise<IPCResponse> {
    const requestId = this.generateRequestId();

    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const stats = {
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      };

      return {
        success: true,
        data: stats,
        metadata: {
          responseTime: Date.now(),
          requestId
        }
      };

    } catch (error) {
      return this.handleError(error, requestId, 'system-stats', 0);
    }
  }

  // Utility methods

  private async checkRateLimit(
    event: IpcMainInvokeEvent,
    operation: string,
    customConfig?: { max: number; windowMs: number }
  ): Promise<void> {
    const mockRequest = {
      ip: '127.0.0.1',
      headers: {
        'x-session-id': event.sender.id.toString(),
        'user-agent': 'Electron'
      },
      connection: { remoteAddress: '127.0.0.1' }
    } as any;

    try {
      await this.rateLimiter.checkLimit(mockRequest, customConfig);
    } catch (error: any) {
      if (error.name === 'RateLimitError') {
        console.warn(`Rate limit exceeded for IPC operation: ${operation}`, {
          sessionId: event.sender.id,
          operation
        });
        throw new AppError(
          'Too many requests',
          'RATE_LIMIT_EXCEEDED',
          429,
          { retryAfter: error.retryAfter }
        );
      }
      throw error;
    }
  }

  private generateRequestId(): string {
    return `ipc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseTimeframe(timeframe: string): number {
    const timeframes: Record<string, number> = {
      '1h': 1,
      '6h': 6,
      '12h': 12,
      '1d': 24,
      '3d': 72,
      '7d': 168,
      '30d': 720
    };

    return timeframes[timeframe] || 168; // Default to 7 days
  }

  private async handleError(
    error: any,
    requestId: string,
    operation: string,
    responseTime: number
  ): Promise<IPCResponse> {
    console.error(`IPC ${operation} error [${requestId}]:`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    // Record error metrics
    try {
      await this.metricsCollector.recordError({
        requestId,
        operation,
        error: error.message,
        responseTime
      });
    } catch (metricsError) {
      console.error('Failed to record error metrics:', metricsError);
    }

    // Return standardized error response
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        },
        metadata: {
          responseTime,
          requestId
        }
      };
    }

    return {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        details: error.details
      },
      metadata: {
        responseTime,
        requestId
      }
    };
  }

  /**
   * Cleanup and close all services
   */
  async close(): Promise<void> {
    console.log('Closing Search IPC Handlers...');

    try {
      await Promise.all([
        this.cache.close(),
        this.rateLimiter.close(),
        this.historyService.close(),
        this.metricsCollector.close()
      ]);

      // Remove all IPC handlers
      ipcMain.removeHandler('search:execute');
      ipcMain.removeHandler('search:autocomplete');
      ipcMain.removeHandler('search:suggestions');
      ipcMain.removeHandler('search:history:get');
      ipcMain.removeHandler('search:history:clear');
      ipcMain.removeHandler('search:metrics:get');
      ipcMain.removeHandler('search:metrics:dashboard');
      ipcMain.removeHandler('search:cache:stats');
      ipcMain.removeHandler('search:cache:clear');
      ipcMain.removeHandler('search:cache:warm');
      ipcMain.removeHandler('search:system:health');
      ipcMain.removeHandler('search:system:stats');

      console.log('Search IPC Handlers closed successfully');

    } catch (error) {
      console.error('Error closing Search IPC Handlers:', error);
    }
  }
}