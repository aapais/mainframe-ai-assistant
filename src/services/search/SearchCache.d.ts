import { SearchOptions } from '../../types/services';
export interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  created: number;
  size: number;
  metadata?: any;
}
export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  averageAccessTime: number;
  hotKeys: string[];
  memoryUsage: number;
}
export interface CacheConfiguration {
  maxSize: number;
  defaultTTL: number;
  checkInterval: number;
  strategy: EvictionStrategy;
  layers: CacheLayerConfig[];
  persistence: PersistenceConfig;
  compression: CompressionConfig;
  warming: WarmingConfig;
}
export type EvictionStrategy = 'lru' | 'lfu' | 'ttl' | 'size' | 'adaptive';
export interface CacheLayerConfig {
  name: string;
  maxSize: number;
  ttl: number;
  strategy: EvictionStrategy;
  enabled: boolean;
}
export interface PersistenceConfig {
  enabled: boolean;
  path?: string;
  interval: number;
  snapshotThreshold: number;
}
export interface CompressionConfig {
  enabled: boolean;
  threshold: number;
  algorithm: 'gzip' | 'deflate' | 'brotli';
}
export interface WarmingConfig {
  enabled: boolean;
  strategies: WarmingStrategy[];
  schedule: string;
}
export type WarmingStrategy = 'popular_queries' | 'recent_searches' | 'predicted_terms';
export declare class SearchCache {
  private l1Cache;
  private l2Cache;
  private persistentCache;
  private stats;
  private config;
  private cleanupTimer?;
  private accessTimes;
  constructor(config?: Partial<CacheConfiguration>);
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  mget<T>(keys: string[]): Promise<Array<T | null>>;
  mset<T>(
    items: Array<{
      key: string;
      value: T;
      ttl?: number;
    }>
  ): Promise<void>;
  delete(key: string): Promise<boolean>;
  deletePattern(pattern: string): Promise<number>;
  has(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  getStats(): CacheStats;
  warmCache(warmingData: {
    popularQueries?: string[];
    recentSearches?: string[];
    predictedTerms?: string[];
  }): Promise<void>;
  generateQueryCacheKey(query: string, options: SearchOptions): string;
  generateTermCacheKey(term: string): string;
  generateIndexCacheKey(segment: string): string;
  close(): Promise<void>;
  private shouldUseL1;
  private setInL1;
  private setInL2;
  private promoteToL1;
  private evictFromL1;
  private evictFromL2;
  private selectEvictionVictim;
  private calculateAdaptiveScore;
  private isExpired;
  private updateAccess;
  private recordHit;
  private recordMiss;
  private recordAccessTime;
  private updateHitRate;
  private updateStats;
  private estimateSize;
  private hashOptions;
  private startCleanupTimer;
  private cleanup;
  private persist;
}
export default SearchCache;
//# sourceMappingURL=SearchCache.d.ts.map
