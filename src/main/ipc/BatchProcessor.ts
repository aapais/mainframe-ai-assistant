/**
 * Batch Processor for Main Process
 *
 * Handles batched IPC requests on the main process side.
 * Executes multiple requests in parallel and returns aggregated responses.
 */

import {
  BatchRequestPayload,
  BatchResponsePayload,
  BatchRequest,
  BatchResponse,
  BatchError,
  BatchStats,
} from '../../shared/types/BatchTypes';
import { DatabaseManager } from '../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../caching/MultiLayerCacheManager';

interface BatchHandler {
  method: string;
  handler: (...args: any[]) => Promise<any>;
  cacheable: boolean;
  timeout: number;
}

export class BatchProcessor {
  private handlers = new Map<string, BatchHandler>();
  private cache?: MultiLayerCacheManager;
  private databaseManager?: DatabaseManager;
  private stats: BatchStats = {
    totalBatches: 0,
    totalRequests: 0,
    averageBatchSize: 0,
    averageExecutionTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    timesSaved: 0,
  };

  private debugMode = process.env.NODE_ENV === 'development';
  private maxConcurrentRequests = 10;
  private defaultTimeout = 5000;

  constructor(
    options: {
      cache?: MultiLayerCacheManager;
      databaseManager?: DatabaseManager;
      maxConcurrentRequests?: number;
      defaultTimeout?: number;
    } = {}
  ) {
    this.cache = options.cache;
    this.databaseManager = options.databaseManager;
    this.maxConcurrentRequests = options.maxConcurrentRequests || 10;
    this.defaultTimeout = options.defaultTimeout || 5000;

    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers() {
    // System handlers
    this.registerHandler('system:get-metrics', this.getSystemMetrics.bind(this), true, 1000);
    this.registerHandler(
      'system:get-performance-metrics',
      this.getPerformanceMetrics.bind(this),
      true,
      1000
    );
    this.registerHandler('system:get-health-status', this.getHealthStatus.bind(this), true, 500);
    this.registerHandler('system:get-storage-info', this.getStorageInfo.bind(this), true, 200);

    // Knowledge Base handlers
    this.registerHandler('kb:get-stats', this.getKBStats.bind(this), true, 800);
    this.registerHandler('kb:get-entries', this.getKBEntries.bind(this), true, 1500);
    this.registerHandler('kb:get-popular', this.getPopularEntries.bind(this), true, 1000);
    this.registerHandler('kb:get-recent', this.getRecentEntries.bind(this), true, 800);

    // Search handlers
    this.registerHandler('search:execute', this.executeSearch.bind(this), true, 2000);
    this.registerHandler('search:get-recent-queries', this.getRecentQueries.bind(this), true, 300);
    this.registerHandler('search:get-suggestions', this.getSearchSuggestions.bind(this), true, 500);
    this.registerHandler('search:record-query', this.recordSearchQuery.bind(this), false, 100);
  }

  public registerHandler(
    method: string,
    handler: (...args: any[]) => Promise<any>,
    cacheable = true,
    timeout = 5000
  ) {
    this.handlers.set(method, {
      method,
      handler,
      cacheable,
      timeout,
    });
  }

  public unregisterHandler(method: string) {
    this.handlers.delete(method);
  }

  /**
   * Process a batch of IPC requests
   */
  async processBatch(payload: BatchRequestPayload): Promise<BatchResponsePayload> {
    const startTime = Date.now();
    const responses: BatchResponse[] = [];
    let cacheHits = 0;
    let errors = 0;

    if (this.debugMode) {
      console.log(
        `[BatchProcessor] Processing batch ${payload.batchId} with ${payload.requests.length} requests`
      );
    }

    try {
      // Process requests in parallel with concurrency control
      const chunks = this.chunkArray(payload.requests, this.maxConcurrentRequests);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async request => {
          return this.processRequest(request);
        });

        const chunkResults = await Promise.allSettled(chunkPromises);

        chunkResults.forEach((result, index) => {
          const request = chunk[index];

          if (result.status === 'fulfilled') {
            const response = result.value;
            responses.push(response);

            if (response.metadata?.cached) {
              cacheHits++;
            }
            if (!response.success) {
              errors++;
            }
          } else {
            errors++;
            responses.push({
              id: request.id,
              success: false,
              error: {
                code: BatchError.HANDLER_NOT_FOUND,
                message:
                  result.reason instanceof Error
                    ? result.reason.message
                    : 'Request processing failed',
                details: result.reason,
              },
            });
          }
        });
      }

      // Update statistics
      this.updateStats(payload, Date.now() - startTime, cacheHits, errors);

      return {
        responses,
        batchId: payload.batchId,
        timestamp: Date.now(),
        metadata: {
          totalExecutionTime: Date.now() - startTime,
          cacheHits,
          errors,
          processed: responses.length,
        },
      };
    } catch (error) {
      console.error('[BatchProcessor] Batch processing failed:', error);
      throw error;
    }
  }

  private async processRequest(request: BatchRequest): Promise<BatchResponse> {
    const startTime = Date.now();
    const handler = this.handlers.get(request.method);

    if (!handler) {
      return {
        id: request.id,
        success: false,
        error: {
          code: BatchError.HANDLER_NOT_FOUND,
          message: `Handler not found for method: ${request.method}`,
        },
      };
    }

    try {
      // Check cache first if the request is cacheable
      if (handler.cacheable && this.cache) {
        const cacheKey = this.generateCacheKey(request);
        const cachedResult = await this.cache.get(cacheKey);

        if (cachedResult !== null) {
          return {
            id: request.id,
            success: true,
            data: cachedResult,
            metadata: {
              cached: true,
              executionTime: Date.now() - startTime,
              fromBatch: true,
            },
          };
        }
      }

      // Execute the handler with timeout
      const timeoutMs = request.timeout || handler.timeout || this.defaultTimeout;
      const result = await this.executeWithTimeout(
        handler.handler,
        request.params || [],
        timeoutMs
      );

      // Cache the result if cacheable
      if (handler.cacheable && this.cache) {
        const cacheKey = this.generateCacheKey(request);
        await this.cache.set(cacheKey, result, 60); // Cache for 1 minute
      }

      return {
        id: request.id,
        success: true,
        data: result,
        metadata: {
          cached: false,
          executionTime: Date.now() - startTime,
          fromBatch: true,
        },
      };
    } catch (error) {
      console.error(`[BatchProcessor] Request ${request.id} (${request.method}) failed:`, error);

      return {
        id: request.id,
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
        metadata: {
          cached: false,
          executionTime: Date.now() - startTime,
          fromBatch: true,
        },
      };
    }
  }

  private async executeWithTimeout<T>(
    handler: (...args: any[]) => Promise<T>,
    params: any[],
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      handler(...params),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  }

  private generateCacheKey(request: BatchRequest): string {
    const paramsKey = request.params ? JSON.stringify(request.params) : '';
    return `batch:${request.method}:${paramsKey}`;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private updateStats(
    payload: BatchRequestPayload,
    executionTime: number,
    cacheHits: number,
    errors: number
  ) {
    this.stats.totalBatches++;
    this.stats.totalRequests += payload.requests.length;
    this.stats.averageBatchSize = this.stats.totalRequests / this.stats.totalBatches;
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalBatches - 1) + executionTime) /
      this.stats.totalBatches;
    this.stats.cacheHitRate =
      (this.stats.cacheHitRate * (this.stats.totalBatches - 1) +
        cacheHits / payload.requests.length) /
      this.stats.totalBatches;
    this.stats.errorRate =
      (this.stats.errorRate * (this.stats.totalBatches - 1) + errors / payload.requests.length) /
      this.stats.totalBatches;

    // Estimate time saved (assuming sequential execution would take sum of all timeouts)
    const estimatedSequentialTime = payload.requests.reduce(
      (sum, req) => sum + (req.timeout || 1000),
      0
    );
    const timeSaved = Math.max(0, estimatedSequentialTime - executionTime);
    this.stats.timesSaved += timeSaved;
  }

  // Default handler implementations
  private async getSystemMetrics(): Promise<any> {
    if (!this.databaseManager) {
      throw new Error('Database manager not available');
    }

    return {
      total_entries: await this.databaseManager.getEntryCount(),
      searches_today: await this.databaseManager.getSearchCountToday(),
      avg_response_time: await this.databaseManager.getAverageResponseTime(),
      cache_hit_rate: this.cache ? await this.cache.getHitRate() : 0,
      storage_used_mb: await this.databaseManager.getDatabaseSize(),
    };
  }

  private async getPerformanceMetrics(): Promise<any> {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      uptime,
      eventLoopDelay: 0, // Would need to implement this
      activeRequests: 0, // Would need to track this
    };
  }

  private async getHealthStatus(): Promise<any> {
    const dbHealthy = this.databaseManager ? await this.databaseManager.isHealthy() : false;
    const cacheHealthy = this.cache ? await this.cache.isHealthy() : true;

    return {
      overall: dbHealthy && cacheHealthy,
      database: dbHealthy,
      cache: cacheHealthy,
      connections: true,
      performance: true,
      issues: [],
    };
  }

  private async getStorageInfo(): Promise<any> {
    if (!this.databaseManager) {
      return { size: 0, available: 0 };
    }

    return {
      size: await this.databaseManager.getDatabaseSize(),
      available: 1000, // Would need OS-specific implementation
      usage_percent: 10, // Mock value
    };
  }

  private async getKBStats(): Promise<any> {
    if (!this.databaseManager) {
      throw new Error('Database manager not available');
    }

    return await this.databaseManager.getStats();
  }

  private async getKBEntries(query?: string, limit = 50): Promise<any> {
    if (!this.databaseManager) {
      throw new Error('Database manager not available');
    }

    return await this.databaseManager.searchEntries(query || '', { limit });
  }

  private async getPopularEntries(limit = 10): Promise<any> {
    if (!this.databaseManager) {
      throw new Error('Database manager not available');
    }

    return await this.databaseManager.getPopularEntries(limit);
  }

  private async getRecentEntries(limit = 10): Promise<any> {
    if (!this.databaseManager) {
      throw new Error('Database manager not available');
    }

    return await this.databaseManager.getRecentEntries(limit);
  }

  private async executeSearch(query: string, options?: any): Promise<any> {
    if (!this.databaseManager) {
      throw new Error('Database manager not available');
    }

    return await this.databaseManager.searchEntries(query, options);
  }

  private async getRecentQueries(limit = 10): Promise<any> {
    if (!this.databaseManager) {
      return [];
    }

    return await this.databaseManager.getRecentSearches(limit);
  }

  private async getSearchSuggestions(query: string, limit = 5): Promise<any> {
    // Mock implementation - would use actual suggestion logic
    return [
      { suggestion: `${query} error`, category: 'error', score: 0.9 },
      { suggestion: `${query} solution`, category: 'solution', score: 0.8 },
    ].slice(0, limit);
  }

  private async recordSearchQuery(query: string, userId?: string): Promise<void> {
    if (!this.databaseManager) {
      return;
    }

    await this.databaseManager.recordSearch(query, userId);
  }

  // Public methods
  public getStats(): BatchStats {
    return { ...this.stats };
  }

  public clearStats() {
    this.stats = {
      totalBatches: 0,
      totalRequests: 0,
      averageBatchSize: 0,
      averageExecutionTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      timesSaved: 0,
    };
  }
}
