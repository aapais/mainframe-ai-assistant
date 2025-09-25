import { RedisConfig } from './RedisManager';
import { MemoryCacheConfig } from './MemoryCache';
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
export declare class CacheOrchestrator {
  private redisManager;
  private memoryCache;
  private config;
  private queryCache;
  private invalidationQueue;
  private metricsCollector;
  constructor(config: CacheOrchestratorConfig);
  get<T>(
    key: string,
    options?: {
      layers?: string[];
      fallback?: () => Promise<T>;
      ttl?: number;
      tags?: string[];
    }
  ): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean>;
  del(key: string): Promise<boolean>;
  invalidateByTag(tag: string): Promise<number>;
  cacheQuery<T>(queryKey: QueryCacheKey, executor: () => Promise<T>, ttl?: number): Promise<T>;
  warmCache(
    entries: Array<{
      key: string;
      fetcher: () => Promise<any>;
      ttl?: number;
      tags?: string[];
      priority?: number;
    }>
  ): Promise<void>;
  getMetrics(): {
    memory: {
      hits: number;
      misses: number;
      evictions: number;
      memoryUsage: number;
      size: number;
      maxSize: number;
      hitRate: number;
      maxMemoryUsage: number;
      memoryUtilization: number;
    };
    redis: import('./RedisManager').CacheMetrics;
    overall: {
      hitRate: number;
      totalRequests: number;
      avgResponseTime: number;
      memoryUsage: number;
    };
    invalidationQueue: number;
  };
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    layers: {
      [key: string]: boolean;
    };
    metrics: any;
  }>;
  flush(): Promise<void>;
  private generateQueryCacheKey;
  private hashObject;
  private recordCacheHit;
  private recordCacheMiss;
  private setupMetricsCollection;
  destroy(): Promise<void>;
}
//# sourceMappingURL=CacheOrchestrator.d.ts.map
