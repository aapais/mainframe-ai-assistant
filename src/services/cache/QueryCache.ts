import { CacheOrchestrator, QueryCacheKey } from './CacheOrchestrator';

export interface QueryExecutor<T = any> {
  execute: () => Promise<T>;
  invalidationTags?: string[];
  dependencies?: string[];
}

export interface CachedQuery<T = any> {
  key: QueryCacheKey;
  result: T;
  timestamp: number;
  ttl: number;
  executionTime: number;
  size: number;
}

export interface QueryCacheStats {
  totalQueries: number;
  cachedQueries: number;
  hitRate: number;
  avgExecutionTime: number;
  avgCacheRetrievalTime: number;
  memorySaved: number;
  topQueries: Array<{
    key: string;
    hits: number;
    avgTime: number;
  }>;
}

export class QueryCache {
  private cacheOrchestrator: CacheOrchestrator;
  private queryStats: Map<
    string,
    {
      hits: number;
      totalTime: number;
      lastAccess: number;
    }
  > = new Map();
  private config: {
    maxCacheSize: number;
    defaultTTL: number;
    maxQueryTime: number;
    enableStats: boolean;
  };

  constructor(
    cacheOrchestrator: CacheOrchestrator,
    config = {
      maxCacheSize: 1000,
      defaultTTL: 600, // 10 minutes
      maxQueryTime: 30000, // 30 seconds
      enableStats: true,
    }
  ) {
    this.cacheOrchestrator = cacheOrchestrator;
    this.config = config;
  }

  // Search query caching
  async executeSearchQuery<T>(
    query: string,
    filters: any = {},
    executor: QueryExecutor<T>,
    ttl?: number
  ): Promise<T> {
    const queryKey: QueryCacheKey = {
      type: 'search',
      operation: 'query',
      parameters: { query, filters },
      version: '1.0',
    };

    return this.executeWithCache(queryKey, executor, ttl || this.config.defaultTTL);
  }

  // Database query caching
  async executeDbQuery<T>(
    sql: string,
    params: any[] = [],
    executor: QueryExecutor<T>,
    ttl?: number
  ): Promise<T> {
    const queryKey: QueryCacheKey = {
      type: 'db',
      operation: 'sql',
      parameters: { sql, params },
      version: '1.0',
    };

    return this.executeWithCache(queryKey, executor, ttl || this.config.defaultTTL);
  }

  // API call caching
  async executeApiCall<T>(
    endpoint: string,
    method: string,
    params: any = {},
    executor: QueryExecutor<T>,
    ttl?: number
  ): Promise<T> {
    const queryKey: QueryCacheKey = {
      type: 'api',
      operation: `${method}:${endpoint}`,
      parameters: params,
      version: '1.0',
    };

    return this.executeWithCache(queryKey, executor, ttl || this.config.defaultTTL);
  }

  // Generic cached execution
  async executeWithCache<T>(
    queryKey: QueryCacheKey,
    executor: QueryExecutor<T>,
    ttl: number
  ): Promise<T> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(queryKey);

    try {
      // Try to get from cache first
      const cached = await this.cacheOrchestrator.get<CachedQuery<T>>(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        this.recordCacheHit(cacheKey, Date.now() - startTime);
        return cached.result;
      }

      // Execute the query
      const executionStart = Date.now();
      const result = await this.executeWithTimeout(executor, this.config.maxQueryTime);
      const executionTime = Date.now() - executionStart;

      // Cache the result
      const cachedQuery: CachedQuery<T> = {
        key: queryKey,
        result,
        timestamp: Date.now(),
        ttl,
        executionTime,
        size: this.estimateSize(result),
      };

      // Store in cache with appropriate tags
      const tags = this.generateTags(queryKey, executor.invalidationTags);
      await this.cacheOrchestrator.set(cacheKey, cachedQuery, ttl, tags);

      this.recordCacheMiss(cacheKey, Date.now() - startTime, executionTime);
      return result;
    } catch (error) {
      console.error('Query cache execution error:', error);
      // Fallback to direct execution without caching
      return await executor.execute();
    }
  }

  // Invalidate queries by pattern
  async invalidateQueries(pattern: {
    type?: string;
    operation?: string;
    paramPattern?: any;
  }): Promise<number> {
    const tags = [];

    if (pattern.type) {
      tags.push(`query-type:${pattern.type}`);
    }

    if (pattern.operation) {
      tags.push(`query-op:${pattern.operation}`);
    }

    let totalInvalidated = 0;
    for (const tag of tags) {
      totalInvalidated += await this.cacheOrchestrator.invalidateByTag(tag);
    }

    return totalInvalidated;
  }

  // Pre-warm cache with popular queries
  async warmCache(
    queries: Array<{
      key: QueryCacheKey;
      executor: QueryExecutor;
      priority: number;
      ttl?: number;
    }>
  ): Promise<void> {
    console.log(`Warming query cache with ${queries.length} queries`);

    // Sort by priority
    const sortedQueries = queries.sort((a, b) => b.priority - a.priority);

    const batchSize = 5;
    for (let i = 0; i < sortedQueries.length; i += batchSize) {
      const batch = sortedQueries.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async ({ key, executor, ttl }) => {
          try {
            await this.executeWithCache(key, executor, ttl || this.config.defaultTTL);
          } catch (error) {
            console.error(`Cache warming failed for query:`, key, error);
          }
        })
      );
    }

    console.log('Query cache warming completed');
  }

  // Get cache statistics
  getStats(): QueryCacheStats {
    const stats = Array.from(this.queryStats.entries());
    const totalQueries = stats.reduce((sum, [, stat]) => sum + stat.hits, 0);
    const totalTime = stats.reduce((sum, [, stat]) => sum + stat.totalTime, 0);

    const topQueries = stats
      .map(([key, stat]) => ({
        key,
        hits: stat.hits,
        avgTime: stat.totalTime / stat.hits,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    return {
      totalQueries,
      cachedQueries: stats.length,
      hitRate: this.calculateHitRate(),
      avgExecutionTime: totalTime / totalQueries || 0,
      avgCacheRetrievalTime: 15, // Estimated cache retrieval time
      memorySaved: this.estimateMemorySaved(),
      topQueries,
    };
  }

  // Clear all cached queries
  async clearCache(): Promise<void> {
    await this.cacheOrchestrator.invalidateByTag('query');
    this.queryStats.clear();
  }

  private generateCacheKey(queryKey: QueryCacheKey): string {
    const paramHash = this.hashParams(queryKey.parameters);
    return `query:${queryKey.type}:${queryKey.operation}:${paramHash}`;
  }

  private generateTags(queryKey: QueryCacheKey, customTags?: string[]): string[] {
    const tags = ['query', `query-type:${queryKey.type}`, `query-op:${queryKey.operation}`];

    if (customTags) {
      tags.push(...customTags);
    }

    return tags;
  }

  private hashParams(params: any): string {
    try {
      const normalized = this.normalizeParams(params);
      return Buffer.from(JSON.stringify(normalized)).toString('base64').substring(0, 16);
    } catch {
      return 'unknown';
    }
  }

  private normalizeParams(params: any): any {
    if (typeof params !== 'object' || params === null) {
      return params;
    }

    if (Array.isArray(params)) {
      return params.map(item => this.normalizeParams(item));
    }

    const normalized: any = {};
    const keys = Object.keys(params).sort();

    for (const key of keys) {
      normalized[key] = this.normalizeParams(params[key]);
    }

    return normalized;
  }

  private isCacheValid(cached: CachedQuery): boolean {
    const now = Date.now();
    return now < cached.timestamp + cached.ttl * 1000;
  }

  private async executeWithTimeout<T>(executor: QueryExecutor<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Query execution timeout after ${timeout}ms`));
      }, timeout);

      executor
        .execute()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private recordCacheHit(cacheKey: string, retrievalTime: number): void {
    if (!this.config.enableStats) return;

    const stat = this.queryStats.get(cacheKey) || { hits: 0, totalTime: 0, lastAccess: 0 };
    stat.hits++;
    stat.totalTime += retrievalTime;
    stat.lastAccess = Date.now();
    this.queryStats.set(cacheKey, stat);
  }

  private recordCacheMiss(cacheKey: string, totalTime: number, executionTime: number): void {
    if (!this.config.enableStats) return;

    const stat = this.queryStats.get(cacheKey) || { hits: 0, totalTime: 0, lastAccess: 0 };
    stat.totalTime += totalTime;
    stat.lastAccess = Date.now();
    this.queryStats.set(cacheKey, stat);
  }

  private calculateHitRate(): number {
    const cacheMetrics = this.cacheOrchestrator.getMetrics();
    return cacheMetrics.overall.hitRate || 0;
  }

  private estimateMemorySaved(): number {
    // Estimate memory saved by avoiding repeated query executions
    const stats = Array.from(this.queryStats.values());
    return stats.reduce((total, stat) => {
      // Assume each cache hit saves 1KB of processing
      return total + stat.hits * 1024;
    }, 0);
  }

  private estimateSize(data: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch {
      return 1024; // Default estimate
    }
  }
}
