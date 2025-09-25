import { RedisManager, RedisConfig } from './RedisManager';
import { MemoryCache, MemoryCacheConfig } from './MemoryCache';

export interface CacheLayer {
  name: string;
  priority: number;
  enabled: boolean;
}

export interface CacheStrategy {
  readThrough: boolean;
  writeThrough: boolean;
  writeBehind: boolean;
  failover: boolean;
}

export interface CacheOrchestratorConfig {
  layers: CacheLayer[];
  strategy: CacheStrategy;
  redis: RedisConfig;
  memory: MemoryCacheConfig;
  queryCache: {
    enabled: boolean;
    defaultTTL: number;
    maxQueries: number;
  };
}

export interface QueryCacheKey {
  type: 'search' | 'db' | 'api';
  operation: string;
  parameters: any;
  version: string;
}

export class CacheOrchestrator {
  private redisManager: RedisManager;
  private memoryCache: MemoryCache;
  private config: CacheOrchestratorConfig;
  private queryCache: Map<string, any> = new Map();
  private invalidationQueue: Set<string> = new Set();
  private metricsCollector: any;

  constructor(config: CacheOrchestratorConfig) {
    this.config = config;
    this.redisManager = new RedisManager(config.redis);
    this.memoryCache = new MemoryCache(config.memory);
    this.setupMetricsCollection();
  }

  async get<T>(
    key: string,
    options?: {
      layers?: string[];
      fallback?: () => Promise<T>;
      ttl?: number;
      tags?: string[];
    }
  ): Promise<T | null> {
    const startTime = Date.now();
    const layers = options?.layers || ['memory', 'redis'];

    try {
      // Try memory cache first (L1)
      if (layers.includes('memory')) {
        const memoryResult = this.memoryCache.get(key);
        if (memoryResult !== null) {
          this.recordCacheHit('memory', Date.now() - startTime);
          return memoryResult;
        }
      }

      // Try Redis cache (L2)
      if (layers.includes('redis') && this.redisManager.isReady()) {
        const redisResult = await this.redisManager.get<T>(key);
        if (redisResult !== null) {
          // Populate memory cache (read-through)
          if (this.config.strategy.readThrough && layers.includes('memory')) {
            this.memoryCache.set(key, redisResult, options?.ttl, options?.tags);
          }
          this.recordCacheHit('redis', Date.now() - startTime);
          return redisResult;
        }
      }

      // Fallback to data source
      if (options?.fallback) {
        const result = await options.fallback();
        if (result !== null) {
          // Populate all cache layers (write-through)
          await this.set(key, result, options?.ttl, options?.tags);
          this.recordCacheMiss('fallback', Date.now() - startTime);
        }
        return result;
      }

      this.recordCacheMiss('all', Date.now() - startTime);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return options?.fallback ? await options.fallback() : null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean> {
    const operations: Promise<boolean>[] = [];

    try {
      // Write to memory cache
      if (this.config.layers.find(l => l.name === 'memory')?.enabled) {
        const memoryResult = this.memoryCache.set(key, value, ttl, tags);
        operations.push(Promise.resolve(memoryResult));
      }

      // Write to Redis cache
      if (
        this.config.layers.find(l => l.name === 'redis')?.enabled &&
        this.redisManager.isReady()
      ) {
        operations.push(this.redisManager.set(key, value, ttl, tags));
      }

      const results = await Promise.allSettled(operations);
      return results.some(result => result.status === 'fulfilled' && result.value);
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    const operations: Promise<boolean>[] = [];

    // Delete from memory cache
    operations.push(Promise.resolve(this.memoryCache.delete(key)));

    // Delete from Redis cache
    if (this.redisManager.isReady()) {
      operations.push(this.redisManager.del(key));
    }

    const results = await Promise.allSettled(operations);
    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  async invalidateByTag(tag: string): Promise<number> {
    let totalInvalidated = 0;

    // Invalidate memory cache
    totalInvalidated += this.memoryCache.invalidateByTag(tag);

    // Invalidate Redis cache
    if (this.redisManager.isReady()) {
      totalInvalidated += await this.redisManager.invalidateByTag(tag);
    }

    // Add to invalidation queue for write-behind processing
    this.invalidationQueue.add(tag);

    return totalInvalidated;
  }

  // Query-specific caching
  async cacheQuery<T>(
    queryKey: QueryCacheKey,
    executor: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.config.queryCache.enabled) {
      return await executor();
    }

    const cacheKey = this.generateQueryCacheKey(queryKey);

    // Try to get from cache first
    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const result = await executor();
    const queryTTL = ttl || this.config.queryCache.defaultTTL;

    await this.set(cacheKey, result, queryTTL, [queryKey.type, queryKey.operation]);

    return result;
  }

  // Cache warming strategies
  async warmCache(
    entries: Array<{
      key: string;
      fetcher: () => Promise<any>;
      ttl?: number;
      tags?: string[];
      priority?: number;
    }>
  ): Promise<void> {
    console.log(`Starting cache warming for ${entries.length} entries`);

    // Sort by priority (higher first)
    const sortedEntries = entries.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const batchSize = 10;
    for (let i = 0; i < sortedEntries.length; i += batchSize) {
      const batch = sortedEntries.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async ({ key, fetcher, ttl, tags }) => {
          try {
            const data = await fetcher();
            await this.set(key, data, ttl, tags);
          } catch (error) {
            console.error(`Cache warming failed for key ${key}:`, error);
          }
        })
      );
    }

    console.log('Cache warming completed');
  }

  // Performance monitoring
  getMetrics() {
    const memoryStats = this.memoryCache.getStats();
    const redisMetrics = this.redisManager.getMetrics();

    return {
      memory: memoryStats,
      redis: redisMetrics,
      overall: {
        hitRate: (memoryStats.hitRate + redisMetrics.hitRate) / 2,
        totalRequests:
          memoryStats.hits + memoryStats.misses + redisMetrics.hits + redisMetrics.misses,
        avgResponseTime: (redisMetrics.avgResponseTime + 5) / 2, // Memory cache ~5ms
        memoryUsage: memoryStats.memoryUsage + redisMetrics.memoryUsage,
      },
      invalidationQueue: this.invalidationQueue.size,
    };
  }

  // Health checks
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    layers: { [key: string]: boolean };
    metrics: any;
  }> {
    const layers = {
      memory: true, // Memory cache is always available
      redis: this.redisManager.isReady(),
    };

    const healthyLayers = Object.values(layers).filter(Boolean).length;
    const totalLayers = Object.keys(layers).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyLayers === totalLayers) {
      status = 'healthy';
    } else if (healthyLayers > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      layers,
      metrics: this.getMetrics(),
    };
  }

  // Cleanup and maintenance
  async flush(): Promise<void> {
    this.memoryCache.clear();
    if (this.redisManager.isReady()) {
      await this.redisManager.flush();
    }
    this.queryCache.clear();
    this.invalidationQueue.clear();
  }

  private generateQueryCacheKey(queryKey: QueryCacheKey): string {
    const paramHash = this.hashObject(queryKey.parameters);
    return `query:${queryKey.type}:${queryKey.operation}:${paramHash}:${queryKey.version}`;
  }

  private hashObject(obj: any): string {
    // Simple hash implementation - use a proper hash library in production
    return Buffer.from(JSON.stringify(obj)).toString('base64').substring(0, 16);
  }

  private recordCacheHit(layer: string, responseTime: number): void {
    if (this.metricsCollector) {
      this.metricsCollector.recordHit(layer, responseTime);
    }
  }

  private recordCacheMiss(layer: string, responseTime: number): void {
    if (this.metricsCollector) {
      this.metricsCollector.recordMiss(layer, responseTime);
    }
  }

  private setupMetricsCollection(): void {
    this.metricsCollector = {
      recordHit: (layer: string, time: number) => {
        console.debug(`Cache HIT [${layer}] - ${time}ms`);
      },
      recordMiss: (layer: string, time: number) => {
        console.debug(`Cache MISS [${layer}] - ${time}ms`);
      },
    };
  }

  async destroy(): Promise<void> {
    this.memoryCache.destroy();
    await this.redisManager.disconnect();
    this.queryCache.clear();
    this.invalidationQueue.clear();
  }
}
