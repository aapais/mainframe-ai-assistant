/**
 * Incremental Loading API Endpoints
 * RESTful endpoints for progressive data loading with caching
 */

import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../../services/cache/CacheService';
import { IncrementalLoader, LoadRequest } from '../../services/cache/IncrementalLoader';
import { SearchService } from '../../services/search/SearchService';

export interface IncrementalSearchRequest extends Request {
  body: {
    query: string;
    totalSize?: number;
    chunkSize?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    loadStrategy?: 'sequential' | 'parallel' | 'adaptive';
    maxParallelChunks?: number;
    filters?: Record<string, any>;
    sortBy?: string;
    includeMetadata?: boolean;
  };
  query: {
    offset?: string;
    limit?: string;
    sessionId?: string;
    requestId?: string;
  };
}

export interface StreamingResponse extends Response {
  stream?: (chunk: any, progress: any) => void;
}

/**
 * Incremental Search Controller
 * Handles progressive loading of search results with intelligent caching
 */
export class IncrementalSearchController {
  constructor(
    private cacheService: CacheService,
    private searchService: SearchService
  ) {}

  /**
   * Start incremental search session
   * POST /api/search/incremental/start
   */
  async startIncrementalSearch(
    req: IncrementalSearchRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        query,
        totalSize = 1000,
        chunkSize = 100,
        priority = 'medium',
        loadStrategy = 'adaptive',
        maxParallelChunks = 3,
        filters = {},
        sortBy = 'relevance',
        includeMetadata = false
      } = req.body;

      const sessionId = req.query.sessionId as string || this.generateSessionId();
      const requestId = `search-${sessionId}-${Date.now()}`;

      // Validate input
      if (!query || query.trim().length === 0) {
        res.status(400).json({
          error: 'Query is required',
          code: 'INVALID_QUERY'
        });
        return;
      }

      if (totalSize > 10000) {
        res.status(400).json({
          error: 'Total size cannot exceed 10,000 items',
          code: 'SIZE_LIMIT_EXCEEDED'
        });
        return;
      }

      // Check cache first
      const cacheKey = {
        type: 'search' as const,
        id: requestId,
        params: { query, filters, sortBy },
        userContext: req.headers['user-id'] as string
      };

      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        res.json({
          requestId,
          sessionId,
          cached: true,
          data: cachedResult,
          progress: {
            loadedChunks: Math.ceil((cachedResult as any[]).length / chunkSize),
            totalChunks: Math.ceil(totalSize / chunkSize),
            percentage: 100,
            complete: true
          }
        });
        return;
      }

      // Create load request
      const loadRequest: LoadRequest<any> = {
        id: requestId,
        query,
        totalSize,
        chunkSize,
        priority,
        loadStrategy,
        maxParallelChunks,
        userContext: req.headers['user-id'] as string,
        onChunkLoaded: (chunk, progress) => {
          // Emit server-sent events for real-time updates
          this.emitProgress(sessionId, {
            type: 'chunk-loaded',
            chunk,
            progress
          });
        },
        onComplete: (data, stats) => {
          this.emitProgress(sessionId, {
            type: 'complete',
            data,
            stats
          });
        },
        onError: (error, chunkId) => {
          this.emitProgress(sessionId, {
            type: 'error',
            error: error.message,
            chunkId
          });
        }
      };

      // Start incremental loading in background
      this.startBackgroundLoad(loadRequest, filters, sortBy, includeMetadata);

      res.json({
        requestId,
        sessionId,
        status: 'started',
        estimatedTime: this.estimateLoadTime(totalSize, chunkSize),
        streamUrl: `/api/search/incremental/stream/${sessionId}`,
        progressUrl: `/api/search/incremental/progress/${requestId}`
      });

    } catch (error) {
      console.error('Start incremental search error:', error);
      next(error);
    }
  }

  /**
   * Get incremental search progress
   * GET /api/search/incremental/progress/:requestId
   */
  async getProgress(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { requestId } = req.params;

      // Get progress from incremental loader
      const progress = await this.getLoadProgress(requestId);

      if (!progress) {
        res.status(404).json({
          error: 'Request not found',
          code: 'REQUEST_NOT_FOUND'
        });
        return;
      }

      res.json({
        requestId,
        progress,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Get progress error:', error);
      next(error);
    }
  }

  /**
   * Stream incremental search results
   * GET /api/search/incremental/stream/:sessionId
   */
  async streamResults(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { sessionId } = req.params;

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection event
      this.sendSSE(res, 'connected', { sessionId, timestamp: Date.now() });

      // Set up cleanup on client disconnect
      req.on('close', () => {
        console.log(`Client disconnected from session ${sessionId}`);
        this.cleanupSession(sessionId);
      });

      // Register session for streaming
      this.registerStreamingSession(sessionId, res);

    } catch (error) {
      console.error('Stream results error:', error);
      next(error);
    }
  }

  /**
   * Get specific chunk by ID
   * GET /api/search/incremental/chunk/:requestId/:chunkId
   */
  async getChunk(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { requestId, chunkId } = req.params;

      // Check cache for chunk
      const cacheKey = {
        type: 'data' as const,
        id: `${requestId}-chunk-${chunkId}`,
        userContext: req.headers['user-id'] as string
      };

      const chunk = await this.cacheService.get(cacheKey);

      if (!chunk) {
        res.status(404).json({
          error: 'Chunk not found',
          code: 'CHUNK_NOT_FOUND'
        });
        return;
      }

      res.json({
        requestId,
        chunkId,
        data: chunk,
        cached: true,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Get chunk error:', error);
      next(error);
    }
  }

  /**
   * Cancel incremental search
   * DELETE /api/search/incremental/:requestId
   */
  async cancelSearch(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { requestId } = req.params;

      const cancelled = await this.cancelLoadRequest(requestId);

      if (!cancelled) {
        res.status(404).json({
          error: 'Request not found or already completed',
          code: 'REQUEST_NOT_FOUND'
        });
        return;
      }

      res.json({
        requestId,
        status: 'cancelled',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Cancel search error:', error);
      next(error);
    }
  }

  /**
   * Get incremental search statistics
   * GET /api/search/incremental/stats
   */
  async getStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await this.getIncrementalStats();

      res.json({
        stats,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Get stats error:', error);
      next(error);
    }
  }

  /**
   * Preload data for improved performance
   * POST /api/search/incremental/preload
   */
  async preloadData(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        queries,
        priority = 'low',
        maxConcurrency = 2
      } = req.body;

      if (!Array.isArray(queries) || queries.length === 0) {
        res.status(400).json({
          error: 'Queries array is required',
          code: 'INVALID_QUERIES'
        });
        return;
      }

      if (queries.length > 20) {
        res.status(400).json({
          error: 'Maximum 20 queries allowed for preloading',
          code: 'TOO_MANY_QUERIES'
        });
        return;
      }

      // Start preloading in background
      const preloadId = this.generateSessionId();
      this.startBackgroundPreload(preloadId, queries, priority, maxConcurrency);

      res.json({
        preloadId,
        status: 'started',
        queries: queries.length,
        estimatedTime: queries.length * 500 // Rough estimate
      });

    } catch (error) {
      console.error('Preload data error:', error);
      next(error);
    }
  }

  // Private Implementation

  private activeStreams = new Map<string, Response>();
  private loadRequests = new Map<string, any>();

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async startBackgroundLoad(
    loadRequest: LoadRequest<any>,
    filters: Record<string, any>,
    sortBy: string,
    includeMetadata: boolean
  ): Promise<void> {
    try {
      this.loadRequests.set(loadRequest.id, loadRequest);

      // Create data source function
      const dataSource = async (offset: number, limit: number) => {
        return await this.searchService.search(loadRequest.query, {
          offset,
          limit,
          filters,
          sortBy,
          includeMetadata
        });
      };

      // Start incremental loading
      const result = await this.cacheService.loadIncremental(loadRequest, dataSource);

      // Cache the complete result
      await this.cacheService.set({
        type: 'search',
        id: loadRequest.id,
        params: { query: loadRequest.query, filters, sortBy },
        userContext: loadRequest.userContext
      }, result, {
        ttl: 600000, // 10 minutes
        priority: loadRequest.priority
      });

    } catch (error) {
      console.error('Background load error:', error);

      // Emit error to streaming clients
      if (loadRequest.userContext) {
        this.emitProgress(loadRequest.userContext, {
          type: 'error',
          error: error.message
        });
      }
    } finally {
      this.loadRequests.delete(loadRequest.id);
    }
  }

  private async startBackgroundPreload(
    preloadId: string,
    queries: string[],
    priority: string,
    maxConcurrency: number
  ): Promise<void> {
    try {
      const semaphore = new Array(maxConcurrency).fill(null);
      const results = [];

      for (const query of queries) {
        await new Promise(resolve => {
          const process = async () => {
            try {
              const data = await this.searchService.search(query, { limit: 50 });

              await this.cacheService.set({
                type: 'search',
                id: `preload-${query}`,
                params: { query }
              }, data, {
                ttl: 1800000, // 30 minutes
                priority: priority as any
              });

              results.push({ query, success: true });
            } catch (error) {
              results.push({ query, success: false, error: error.message });
            } finally {
              resolve(null);
            }
          };

          process();
        });
      }

      console.log(`Preload ${preloadId} completed: ${results.filter(r => r.success).length}/${results.length} successful`);

    } catch (error) {
      console.error('Background preload error:', error);
    }
  }

  private registerStreamingSession(sessionId: string, res: Response): void {
    this.activeStreams.set(sessionId, res);

    // Send periodic heartbeat
    const heartbeat = setInterval(() => {
      this.sendSSE(res, 'heartbeat', { timestamp: Date.now() });
    }, 30000);

    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(heartbeat);
      this.activeStreams.delete(sessionId);
    });
  }

  private emitProgress(sessionId: string, event: any): void {
    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      this.sendSSE(stream, 'progress', event);
    }
  }

  private sendSSE(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private cleanupSession(sessionId: string): void {
    this.activeStreams.delete(sessionId);
  }

  private async getLoadProgress(requestId: string): Promise<any> {
    // This would integrate with the actual incremental loader
    // For now, return mock progress
    return {
      loadedChunks: 5,
      totalChunks: 10,
      percentage: 50,
      estimatedTimeRemaining: 5000
    };
  }

  private async cancelLoadRequest(requestId: string): Promise<boolean> {
    const request = this.loadRequests.get(requestId);
    if (request) {
      this.loadRequests.delete(requestId);
      return true;
    }
    return false;
  }

  private async getIncrementalStats(): Promise<any> {
    const cacheStats = this.cacheService.getMetrics();

    return {
      activeLoads: this.loadRequests.size,
      activeStreams: this.activeStreams.size,
      cacheMetrics: cacheStats.incremental,
      performance: cacheStats.overall
    };
  }

  private estimateLoadTime(totalSize: number, chunkSize: number): number {
    const chunks = Math.ceil(totalSize / chunkSize);
    return chunks * 200; // Rough estimate: 200ms per chunk
  }
}

// Export route handlers
export function createIncrementalRoutes(
  cacheService: CacheService,
  searchService: SearchService
) {
  const controller = new IncrementalSearchController(cacheService, searchService);

  return {
    startIncrementalSearch: controller.startIncrementalSearch.bind(controller),
    getProgress: controller.getProgress.bind(controller),
    streamResults: controller.streamResults.bind(controller),
    getChunk: controller.getChunk.bind(controller),
    cancelSearch: controller.cancelSearch.bind(controller),
    getStats: controller.getStats.bind(controller),
    preloadData: controller.preloadData.bind(controller)
  };
}