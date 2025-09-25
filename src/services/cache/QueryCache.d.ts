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
export declare class QueryCache {
  private cacheOrchestrator;
  private queryStats;
  private config;
  constructor(
    cacheOrchestrator: CacheOrchestrator,
    config?: {
      maxCacheSize: number;
      defaultTTL: number;
      maxQueryTime: number;
      enableStats: boolean;
    }
  );
  executeSearchQuery<T>(
    query: string,
    filters: any | undefined,
    executor: QueryExecutor<T>,
    ttl?: number
  ): Promise<T>;
  executeDbQuery<T>(
    sql: string,
    params: any[] | undefined,
    executor: QueryExecutor<T>,
    ttl?: number
  ): Promise<T>;
  executeApiCall<T>(
    endpoint: string,
    method: string,
    params: any | undefined,
    executor: QueryExecutor<T>,
    ttl?: number
  ): Promise<T>;
  executeWithCache<T>(queryKey: QueryCacheKey, executor: QueryExecutor<T>, ttl: number): Promise<T>;
  invalidateQueries(pattern: {
    type?: string;
    operation?: string;
    paramPattern?: any;
  }): Promise<number>;
  warmCache(
    queries: Array<{
      key: QueryCacheKey;
      executor: QueryExecutor;
      priority: number;
      ttl?: number;
    }>
  ): Promise<void>;
  getStats(): QueryCacheStats;
  clearCache(): Promise<void>;
  private generateCacheKey;
  private generateTags;
  private hashParams;
  private normalizeParams;
  private isCacheValid;
  private executeWithTimeout;
  private recordCacheHit;
  private recordCacheMiss;
  private calculateHitRate;
  private estimateMemorySaved;
  private estimateSize;
}
//# sourceMappingURL=QueryCache.d.ts.map
