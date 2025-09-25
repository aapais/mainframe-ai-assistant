'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.QueryCache = void 0;
class QueryCache {
  cacheOrchestrator;
  queryStats = new Map();
  config;
  constructor(
    cacheOrchestrator,
    config = {
      maxCacheSize: 1000,
      defaultTTL: 600,
      maxQueryTime: 30000,
      enableStats: true,
    }
  ) {
    this.cacheOrchestrator = cacheOrchestrator;
    this.config = config;
  }
  async executeSearchQuery(query, filters = {}, executor, ttl) {
    const queryKey = {
      type: 'search',
      operation: 'query',
      parameters: { query, filters },
      version: '1.0',
    };
    return this.executeWithCache(queryKey, executor, ttl || this.config.defaultTTL);
  }
  async executeDbQuery(sql, params = [], executor, ttl) {
    const queryKey = {
      type: 'db',
      operation: 'sql',
      parameters: { sql, params },
      version: '1.0',
    };
    return this.executeWithCache(queryKey, executor, ttl || this.config.defaultTTL);
  }
  async executeApiCall(endpoint, method, params = {}, executor, ttl) {
    const queryKey = {
      type: 'api',
      operation: `${method}:${endpoint}`,
      parameters: params,
      version: '1.0',
    };
    return this.executeWithCache(queryKey, executor, ttl || this.config.defaultTTL);
  }
  async executeWithCache(queryKey, executor, ttl) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(queryKey);
    try {
      const cached = await this.cacheOrchestrator.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        this.recordCacheHit(cacheKey, Date.now() - startTime);
        return cached.result;
      }
      const executionStart = Date.now();
      const result = await this.executeWithTimeout(executor, this.config.maxQueryTime);
      const executionTime = Date.now() - executionStart;
      const cachedQuery = {
        key: queryKey,
        result,
        timestamp: Date.now(),
        ttl,
        executionTime,
        size: this.estimateSize(result),
      };
      const tags = this.generateTags(queryKey, executor.invalidationTags);
      await this.cacheOrchestrator.set(cacheKey, cachedQuery, ttl, tags);
      this.recordCacheMiss(cacheKey, Date.now() - startTime, executionTime);
      return result;
    } catch (error) {
      console.error('Query cache execution error:', error);
      return await executor.execute();
    }
  }
  async invalidateQueries(pattern) {
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
  async warmCache(queries) {
    console.log(`Warming query cache with ${queries.length} queries`);
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
  getStats() {
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
      avgCacheRetrievalTime: 15,
      memorySaved: this.estimateMemorySaved(),
      topQueries,
    };
  }
  async clearCache() {
    await this.cacheOrchestrator.invalidateByTag('query');
    this.queryStats.clear();
  }
  generateCacheKey(queryKey) {
    const paramHash = this.hashParams(queryKey.parameters);
    return `query:${queryKey.type}:${queryKey.operation}:${paramHash}`;
  }
  generateTags(queryKey, customTags) {
    const tags = ['query', `query-type:${queryKey.type}`, `query-op:${queryKey.operation}`];
    if (customTags) {
      tags.push(...customTags);
    }
    return tags;
  }
  hashParams(params) {
    try {
      const normalized = this.normalizeParams(params);
      return Buffer.from(JSON.stringify(normalized)).toString('base64').substring(0, 16);
    } catch {
      return 'unknown';
    }
  }
  normalizeParams(params) {
    if (typeof params !== 'object' || params === null) {
      return params;
    }
    if (Array.isArray(params)) {
      return params.map(item => this.normalizeParams(item));
    }
    const normalized = {};
    const keys = Object.keys(params).sort();
    for (const key of keys) {
      normalized[key] = this.normalizeParams(params[key]);
    }
    return normalized;
  }
  isCacheValid(cached) {
    const now = Date.now();
    return now < cached.timestamp + cached.ttl * 1000;
  }
  async executeWithTimeout(executor, timeout) {
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
  recordCacheHit(cacheKey, retrievalTime) {
    if (!this.config.enableStats) return;
    const stat = this.queryStats.get(cacheKey) || { hits: 0, totalTime: 0, lastAccess: 0 };
    stat.hits++;
    stat.totalTime += retrievalTime;
    stat.lastAccess = Date.now();
    this.queryStats.set(cacheKey, stat);
  }
  recordCacheMiss(cacheKey, totalTime, executionTime) {
    if (!this.config.enableStats) return;
    const stat = this.queryStats.get(cacheKey) || { hits: 0, totalTime: 0, lastAccess: 0 };
    stat.totalTime += totalTime;
    stat.lastAccess = Date.now();
    this.queryStats.set(cacheKey, stat);
  }
  calculateHitRate() {
    const cacheMetrics = this.cacheOrchestrator.getMetrics();
    return cacheMetrics.overall.hitRate || 0;
  }
  estimateMemorySaved() {
    const stats = Array.from(this.queryStats.values());
    return stats.reduce((total, stat) => {
      return total + stat.hits * 1024;
    }, 0);
  }
  estimateSize(data) {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch {
      return 1024;
    }
  }
}
exports.QueryCache = QueryCache;
//# sourceMappingURL=QueryCache.js.map
