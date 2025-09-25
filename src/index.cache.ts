/**
 * Main Cache Integration Entry Point
 *
 * This module provides the primary interface for the intelligent search caching system,
 * integrating all cache components with the existing search service infrastructure.
 */

import { EventEmitter } from 'events';
import { CacheManager } from './cache/CacheManager';
import { RedisService } from './cache/RedisService';
import { InMemoryCache } from './cache/InMemoryCache';
import { CacheMetrics } from './cache/CacheMetrics';
import { CacheConfiguration } from './cache/types';
import { SearchService } from './search/SearchService';
import { Logger } from './utils/Logger';

export interface CacheSystemOptions {
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    maxRetries?: number;
    retryDelayOnFailover?: number;
  };
  memory?: {
    maxSize: number;
    ttl: number;
    checkPeriod?: number;
  };
  metrics?: {
    enabled: boolean;
    flushInterval?: number;
    retentionDays?: number;
  };
  fallback?: {
    enableMemoryFallback: boolean;
    memoryFallbackSize?: number;
  };
}

/**
 * Intelligent Search Cache System
 *
 * Provides a unified interface for search result caching with multi-tier storage,
 * intelligent invalidation, and comprehensive performance monitoring.
 */
export class SearchCacheSystem extends EventEmitter {
  private cacheManager: CacheManager;
  private redisService: RedisService;
  private memoryCache: InMemoryCache;
  private metrics: CacheMetrics;
  private searchService: SearchService;
  private logger: Logger;
  private isInitialized: boolean = false;
  private shutdownHandlers: (() => Promise<void>)[] = [];

  constructor(
    private options: CacheSystemOptions,
    searchService?: SearchService
  ) {
    super();
    this.logger = new Logger('SearchCacheSystem');

    if (searchService) {
      this.searchService = searchService;
    }

    this.setupGracefulShutdown();
  }

  /**
   * Initialize the cache system with all components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Cache system already initialized');
      return;
    }

    try {
      this.logger.info('Initializing search cache system...');

      // Initialize metrics first
      this.metrics = new CacheMetrics({
        enabled: this.options.metrics?.enabled ?? true,
        flushInterval: this.options.metrics?.flushInterval ?? 60000,
        retentionDays: this.options.metrics?.retentionDays ?? 30,
      });

      // Initialize memory cache
      this.memoryCache = new InMemoryCache({
        maxSize: this.options.memory?.maxSize ?? 100,
        ttl: this.options.memory?.ttl ?? 300000, // 5 minutes
        checkPeriod: this.options.memory?.checkPeriod ?? 60000,
      });

      // Initialize Redis service if configured
      if (this.options.redis) {
        this.redisService = new RedisService({
          host: this.options.redis.host,
          port: this.options.redis.port,
          password: this.options.redis.password,
          db: this.options.redis.db ?? 0,
          keyPrefix: this.options.redis.keyPrefix ?? 'search:cache:',
          maxRetries: this.options.redis.maxRetries ?? 3,
          retryDelayOnFailover: this.options.redis.retryDelayOnFailover ?? 100,
        });

        await this.redisService.connect();
        this.logger.info('Redis cache service connected');
      }

      // Initialize cache manager with all components
      this.cacheManager = new CacheManager({
        primary: this.redisService,
        fallback: this.options.fallback?.enableMemoryFallback ? this.memoryCache : undefined,
        metrics: this.metrics,
        fallbackConfig: {
          enableMemoryFallback: this.options.fallback?.enableMemoryFallback ?? true,
          memoryFallbackSize: this.options.fallback?.memoryFallbackSize ?? 50,
        },
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Register shutdown handlers
      this.registerShutdownHandler(() => this.cacheManager.shutdown());
      if (this.redisService) {
        this.registerShutdownHandler(() => this.redisService.disconnect());
      }
      this.registerShutdownHandler(() => this.memoryCache.clear());
      this.registerShutdownHandler(() => this.metrics.shutdown());

      this.isInitialized = true;
      this.emit('initialized');
      this.logger.info('Search cache system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize cache system:', error);
      throw new Error(`Cache system initialization failed: ${error.message}`);
    }
  }

  /**
   * Create a cached search function that wraps the original search service
   */
  createCachedSearch<T = any>(
    searchFunction: (query: string, options?: any) => Promise<T>,
    cacheOptions?: {
      ttl?: number;
      keyGenerator?: (query: string, options?: any) => string;
      shouldCache?: (query: string, options?: any, result?: T) => boolean;
    }
  ): (query: string, options?: any) => Promise<T> {
    this.ensureInitialized();

    const defaultKeyGenerator = (query: string, options?: any) => {
      const optionsHash = options ? JSON.stringify(options) : '';
      return `search:${Buffer.from(query + optionsHash).toString('base64')}`;
    };

    const keyGenerator = cacheOptions?.keyGenerator ?? defaultKeyGenerator;
    const ttl = cacheOptions?.ttl ?? 300000; // 5 minutes default
    const shouldCache = cacheOptions?.shouldCache ?? (() => true);

    return async (query: string, options?: any): Promise<T> => {
      const cacheKey = keyGenerator(query, options);

      // Try to get from cache first
      try {
        const cached = await this.cacheManager.get(cacheKey);
        if (cached !== null) {
          this.logger.debug(`Cache hit for query: ${query}`);
          this.emit('cacheHit', { query, cacheKey });
          return cached as T;
        }
      } catch (error) {
        this.logger.warn('Cache retrieval failed, proceeding with search:', error);
      }

      // Cache miss - execute search
      this.logger.debug(`Cache miss for query: ${query}`);
      this.emit('cacheMiss', { query, cacheKey });

      const startTime = Date.now();
      const result = await searchFunction(query, options);
      const searchDuration = Date.now() - startTime;

      // Cache the result if conditions are met
      if (shouldCache(query, options, result)) {
        try {
          await this.cacheManager.set(cacheKey, result, ttl);
          this.logger.debug(`Cached result for query: ${query}`);
          this.emit('cached', { query, cacheKey, searchDuration });
        } catch (error) {
          this.logger.warn('Failed to cache result:', error);
        }
      }

      return result;
    };
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    this.ensureInitialized();
    return this.cacheManager.invalidatePattern(pattern);
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidate(key: string): Promise<boolean> {
    this.ensureInitialized();
    return this.cacheManager.invalidate(key);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    this.ensureInitialized();
    return this.cacheManager.getStats();
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return this.metrics;
  }

  /**
   * Warm up the cache with common searches
   */
  async warmup(searches: Array<{ query: string; options?: any }>): Promise<void> {
    this.ensureInitialized();

    if (!this.searchService) {
      throw new Error('Search service not configured for warmup');
    }

    this.logger.info(`Starting cache warmup with ${searches.length} searches`);

    const cachedSearch = this.createCachedSearch((query: string, options?: any) =>
      this.searchService.search(query, options)
    );

    const warmupPromises = searches.map(async ({ query, options }) => {
      try {
        await cachedSearch(query, options);
        this.logger.debug(`Warmed up cache for query: ${query}`);
      } catch (error) {
        this.logger.warn(`Failed to warm up cache for query: ${query}`, error);
      }
    });

    await Promise.all(warmupPromises);
    this.logger.info('Cache warmup completed');
    this.emit('warmupCompleted', { count: searches.length });
  }

  /**
   * Perform cache maintenance (cleanup expired entries, optimize storage)
   */
  async maintenance(): Promise<void> {
    this.ensureInitialized();

    this.logger.info('Starting cache maintenance');

    try {
      await this.cacheManager.cleanup();
      this.emit('maintenanceCompleted');
      this.logger.info('Cache maintenance completed');
    } catch (error) {
      this.logger.error('Cache maintenance failed:', error);
      this.emit('maintenanceError', error);
      throw error;
    }
  }

  /**
   * Check system health
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
    metrics: any;
  }> {
    const components: Record<string, boolean> = {};

    try {
      // Check memory cache
      components.memoryCache = this.memoryCache && (await this.memoryCache.healthCheck());

      // Check Redis if available
      if (this.redisService) {
        components.redisCache = await this.redisService.healthCheck();
      }

      // Check metrics
      components.metrics = this.metrics && this.metrics.isHealthy();

      // Check cache manager
      components.cacheManager = this.cacheManager && (await this.cacheManager.healthCheck());

      const allHealthy = Object.values(components).every(Boolean);
      const someHealthy = Object.values(components).some(Boolean);

      return {
        status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
        components,
        metrics: await this.getStats(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        components,
        metrics: null,
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Shutting down cache system...');

    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
      }
    }

    this.isInitialized = false;
    this.emit('shutdown');
    this.logger.info('Cache system shutdown completed');
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Cache system not initialized. Call initialize() first.');
    }
  }

  private setupEventHandlers(): void {
    this.cacheManager.on('hit', data => this.emit('hit', data));
    this.cacheManager.on('miss', data => this.emit('miss', data));
    this.cacheManager.on('error', error => this.emit('error', error));
    this.cacheManager.on('eviction', data => this.emit('eviction', data));

    if (this.redisService) {
      this.redisService.on('connect', () => this.emit('redisConnected'));
      this.redisService.on('disconnect', () => this.emit('redisDisconnected'));
      this.redisService.on('error', error => this.emit('redisError', error));
    }
  }

  private registerShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }
}

/**
 * Factory function to create and initialize a cache system
 */
export async function createCacheSystem(
  options: CacheSystemOptions,
  searchService?: SearchService
): Promise<SearchCacheSystem> {
  const cacheSystem = new SearchCacheSystem(options, searchService);
  await cacheSystem.initialize();
  return cacheSystem;
}

/**
 * Default configuration factory
 */
export function createDefaultCacheConfig(): CacheSystemOptions {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'search:cache:',
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    },
    memory: {
      maxSize: parseInt(process.env.MEMORY_CACHE_SIZE || '100'),
      ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300000'), // 5 minutes
      checkPeriod: parseInt(process.env.MEMORY_CACHE_CHECK_PERIOD || '60000'),
    },
    metrics: {
      enabled: process.env.CACHE_METRICS_ENABLED !== 'false',
      flushInterval: parseInt(process.env.CACHE_METRICS_FLUSH_INTERVAL || '60000'),
      retentionDays: parseInt(process.env.CACHE_METRICS_RETENTION_DAYS || '30'),
    },
    fallback: {
      enableMemoryFallback: process.env.ENABLE_MEMORY_FALLBACK !== 'false',
      memoryFallbackSize: parseInt(process.env.MEMORY_FALLBACK_SIZE || '50'),
    },
  };
}

// Export types for external use
export * from './cache/types';
export { CacheManager } from './cache/CacheManager';
export { RedisService } from './cache/RedisService';
export { InMemoryCache } from './cache/InMemoryCache';
export { CacheMetrics } from './cache/CacheMetrics';
