import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { EventEmitter } from 'events';
import { AppError } from '../../core/errors/AppError';
import { RequestBatcher } from './RequestBatcher';
import { StreamingHandler } from './StreamingHandler';
import { CacheManager } from '../../caching/MultiLayerCacheManager';

// Type definitions for IPC operations
export interface IPCRequest {
  id: string;
  channel: string;
  data: any;
  timestamp: number;
  batchable?: boolean;
  streamable?: boolean;
  cacheable?: boolean;
  ttl?: number;
}

export interface IPCResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    cached?: boolean;
    streamed?: boolean;
    batched?: boolean;
    executionTime?: number;
  };
}

export interface IPCHandler {
  (event: IpcMainInvokeEvent, ...args: any[]): Promise<any> | any;
}

export interface IPCHandlerConfig {
  batchable?: boolean;
  batchSize?: number;
  batchDelay?: number;
  streamable?: boolean;
  streamChunkSize?: number;
  cacheable?: boolean;
  cacheTTL?: number;
  validation?: (args: any[]) => boolean | string;
  rateLimit?: {
    requests: number;
    window: number; // in ms
  };
}

export interface IPCMetrics {
  totalRequests: number;
  totalResponses: number;
  totalErrors: number;
  averageResponseTime: number;
  cacheHitRate: number;
  batchedRequests: number;
  streamedRequests: number;
}

/**
 * Enhanced IPC Manager with batching, streaming, caching, and type safety
 */
export class IPCManager extends EventEmitter {
  private handlers = new Map<string, { handler: IPCHandler; config: IPCHandlerConfig }>();
  private requestBatcher: RequestBatcher;
  private streamingHandler: StreamingHandler;
  private cacheManager: CacheManager;
  private metrics: IPCMetrics;
  private rateLimiters = new Map<string, { requests: number; resetTime: number }>();

  constructor(cacheManager: CacheManager) {
    super();
    this.cacheManager = cacheManager;
    this.requestBatcher = new RequestBatcher(this);
    this.streamingHandler = new StreamingHandler();
    this.metrics = {
      totalRequests: 0,
      totalResponses: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      batchedRequests: 0,
      streamedRequests: 0
    };

    this.initialize();
  }

  private initialize(): void {
    // Set up global error handler for unhandled promise rejections in IPC
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled IPC promise rejection:', reason);
      this.emit('error', new AppError('IPC_UNHANDLED_REJECTION', 'Unhandled promise rejection in IPC', {
        reason: reason,
        promise: promise
      }));
    });
  }

  /**
   * Register a type-safe IPC handler with advanced options
   */
  registerHandler<T extends any[], R>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R> | R,
    config: IPCHandlerConfig = {}
  ): void {
    // Validate handler function
    if (typeof handler !== 'function') {
      throw new AppError('IPC_INVALID_HANDLER', `Handler for channel ${channel} must be a function`);
    }

    // Store handler configuration
    this.handlers.set(channel, {
      handler: handler as IPCHandler,
      config: {
        batchable: false,
        batchSize: 10,
        batchDelay: 50,
        streamable: false,
        streamChunkSize: 1000,
        cacheable: false,
        cacheTTL: 300000, // 5 minutes default
        ...config
      }
    });

    // Register with Electron's IPC system
    ipcMain.handle(channel, this.createWrappedHandler(channel));

    console.log(`✅ Registered IPC handler: ${channel}`, {
      batchable: config.batchable,
      streamable: config.streamable,
      cacheable: config.cacheable
    });
  }

  /**
   * Create a wrapped handler with all enhancements
   */
  private createWrappedHandler(channel: string) {
    return async (event: IpcMainInvokeEvent, ...args: any[]) => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();
      const handlerInfo = this.handlers.get(channel);

      if (!handlerInfo) {
        throw new AppError('IPC_HANDLER_NOT_FOUND', `No handler registered for channel: ${channel}`);
      }

      try {
        // Update metrics
        this.metrics.totalRequests++;

        // Rate limiting check
        if (handlerInfo.config.rateLimit && !this.checkRateLimit(channel, handlerInfo.config.rateLimit)) {
          throw new AppError('IPC_RATE_LIMIT_EXCEEDED', `Rate limit exceeded for channel: ${channel}`);
        }

        // Validation
        if (handlerInfo.config.validation) {
          const validationResult = handlerInfo.config.validation(args);
          if (validationResult !== true) {
            throw new AppError('IPC_VALIDATION_FAILED', 
              typeof validationResult === 'string' ? validationResult : 'Request validation failed'
            );
          }
        }

        // Check cache first
        let result: any;
        let fromCache = false;
        const cacheKey = this.generateCacheKey(channel, args);

        if (handlerInfo.config.cacheable && this.cacheManager) {
          const cached = await this.cacheManager.get(cacheKey);
          if (cached !== null) {
            result = cached;
            fromCache = true;
            this.updateCacheHitRate(true);
          }
        }

        // If not cached, execute handler
        if (!fromCache) {
          if (handlerInfo.config.batchable) {
            // Handle batchable requests
            this.metrics.batchedRequests++;
            result = await this.requestBatcher.addRequest({
              id: requestId,
              channel,
              data: args,
              timestamp: startTime
            }, handlerInfo.handler, event);
          } else if (handlerInfo.config.streamable) {
            // Handle streamable requests
            this.metrics.streamedRequests++;
            result = await this.streamingHandler.handleStream(
              handlerInfo.handler,
              event,
              args,
              handlerInfo.config.streamChunkSize
            );
          } else {
            // Regular handler execution
            result = await handlerInfo.handler(event, ...args);
          }

          // Cache the result if cacheable
          if (handlerInfo.config.cacheable && this.cacheManager && result !== undefined) {
            await this.cacheManager.set(cacheKey, result, handlerInfo.config.cacheTTL);
          }

          this.updateCacheHitRate(false);
        }

        // Update metrics
        const executionTime = Date.now() - startTime;
        this.updateResponseTime(executionTime);
        this.metrics.totalResponses++;

        // Return enhanced response
        return {
          success: true,
          data: result,
          metadata: {
            cached: fromCache,
            streamed: handlerInfo.config.streamable,
            batched: handlerInfo.config.batchable,
            executionTime
          }
        } as IPCResponse;

      } catch (error) {
        this.metrics.totalErrors++;
        const appError = error instanceof AppError ? error : 
          new AppError('IPC_HANDLER_ERROR', `Error in IPC handler ${channel}`, { originalError: error });
        
        console.error(`❌ IPC Error in ${channel}:`, appError);
        
        // Emit error event for monitoring
        this.emit('error', appError);

        return {
          success: false,
          error: {
            code: appError.code,
            message: appError.message,
            details: appError.details
          },
          metadata: {
            executionTime: Date.now() - startTime
          }
        } as IPCResponse;
      }
    };
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(channel: string): void {
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel);
      this.handlers.delete(channel);
      console.log(`🗑️ Unregistered IPC handler: ${channel}`);
    }
  }

  /**
   * Unregister all handlers
   */
  unregisterAllHandlers(): void {
    for (const channel of this.handlers.keys()) {
      this.unregisterHandler(channel);
    }
    console.log('🗑️ All IPC handlers unregistered');
  }

  /**
   * Get IPC performance metrics
   */
  getMetrics(): IPCMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      totalResponses: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      batchedRequests: 0,
      streamedRequests: 0
    };
  }

  /**
   * Get registered handlers info
   */
  getHandlersInfo(): Array<{ channel: string; config: IPCHandlerConfig }> {
    return Array.from(this.handlers.entries()).map(([channel, info]) => ({
      channel,
      config: info.config
    }));
  }

  /**
   * Invalidate cache for specific patterns
   */
  async invalidateCache(pattern: string): Promise<void> {
    if (this.cacheManager) {
      // This would depend on the cache manager implementation
      // For now, we'll emit an event that can be handled by specific cache managers
      this.emit('cache:invalidate', pattern);
    }
  }

  // Private helper methods

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(channel: string, args: any[]): string {
    const argsHash = JSON.stringify(args);
    return `ipc:${channel}:${Buffer.from(argsHash).toString('base64')}`;
  }

  private checkRateLimit(channel: string, config: { requests: number; window: number }): boolean {
    const now = Date.now();
    const key = channel;
    const limiter = this.rateLimiters.get(key);

    if (!limiter || now > limiter.resetTime) {
      // Reset or initialize rate limiter
      this.rateLimiters.set(key, {
        requests: 1,
        resetTime: now + config.window
      });
      return true;
    }

    if (limiter.requests >= config.requests) {
      return false;
    }

    limiter.requests++;
    return true;
  }

  private updateResponseTime(executionTime: number): void {
    const totalTime = this.metrics.averageResponseTime * this.metrics.totalResponses;
    const newTotalResponses = this.metrics.totalResponses + 1;
    this.metrics.averageResponseTime = (totalTime + executionTime) / newTotalResponses;
  }

  private updateCacheHitRate(hit: boolean): void {
    const totalCacheRequests = this.metrics.totalRequests;
    if (totalCacheRequests === 0) {
      this.metrics.cacheHitRate = hit ? 100 : 0;
    } else {
      const currentHits = (this.metrics.cacheHitRate * (totalCacheRequests - 1)) / 100;
      const newHits = hit ? currentHits + 1 : currentHits;
      this.metrics.cacheHitRate = (newHits / totalCacheRequests) * 100;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.unregisterAllHandlers();
    this.requestBatcher.destroy();
    this.streamingHandler.destroy();
    this.rateLimiters.clear();
    this.removeAllListeners();
    console.log('🧹 IPCManager destroyed');
  }
}