import { CacheSystemConfig } from '../../config/cacheConfig';
import { SearchResult, SearchOptions } from '../../types/services';
export interface SearchCacheEntry {
  results: SearchResult[];
  query: string;
  options: SearchOptions;
  timestamp: number;
  computationTime: number;
  hitCount: number;
}
export interface SearchCacheStats {
  l0: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  l1: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  l2: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  redis: {
    hits: number;
    misses: number;
    hitRate: number;
    connected: boolean;
  };
  predictive: {
    predictions: number;
    accuracy: number;
    cacheSaves: number;
  };
  overall: {
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    averageResponseTime: number;
    memoryUsage: number;
  };
}
export interface WarmupData {
  popularQueries?: string[];
  recentSearches?: string[];
  predictedTerms?: string[];
  userContext?: string;
}
export declare class EnhancedSearchCache {
  private l0Cache;
  private l1Cache;
  private l2Cache;
  private redisCache?;
  private predictiveCache;
  private incrementalLoader;
  private config;
  private stats;
  constructor(config?: Partial<CacheSystemConfig>);
  get<T = SearchResult[]>(
    key: string,
    options?: SearchOptions,
    userContext?: string
  ): Promise<T | null>;
  set<T = SearchResult[]>(
    key: string,
    value: T,
    options?: SearchOptions,
    computationTime?: number,
    userContext?: string
  ): Promise<void>;
  delete(key: string, options?: SearchOptions): Promise<boolean>;
  deletePattern(pattern: string): Promise<number>;
  clear(): Promise<void>;
  has(key: string, options?: SearchOptions): Promise<boolean>;
  expire(key: string, ttl: number, options?: SearchOptions): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  getStats(): SearchCacheStats;
  warmCache(warmupData: WarmupData): Promise<void>;
  generateQueryCacheKey(query: string, options: SearchOptions): string;
  generateTermCacheKey(term: string): string;
  generateIndexCacheKey(segment: string): string;
  close(): Promise<void>;
  private generateCacheKey;
  private hashOptions;
  private determineCacheStrategy;
  private promoteToL0;
  private promoteToL1;
  private setInL0;
  private setInL1;
  private setInL2;
  private recordHit;
  private recordMiss;
  private calculateOverallHitRate;
  private initializeStats;
  private setupEventHandlers;
}
export default EnhancedSearchCache;
//# sourceMappingURL=EnhancedSearchCache.d.ts.map
