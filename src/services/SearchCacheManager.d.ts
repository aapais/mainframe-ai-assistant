import { SearchResult, SearchOptions } from '../types/services';
export interface CacheEntry {
    key: string;
    results: SearchResult[];
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccess: number;
    metadata: {
        query: string;
        options: SearchOptions;
        resultCount: number;
        searchDuration: number;
    };
}
export interface CacheMetrics {
    hitCount: number;
    missCount: number;
    hitRate: number;
    totalEntries: number;
    totalSize: number;
    averageAccessTime: number;
    evictionCount: number;
    l1Hits: number;
    l2Hits: number;
    l3Hits: number;
}
export interface CacheConfig {
    l1MaxSize: number;
    l2MaxSize: number;
    defaultTTL: number;
    cleanupInterval: number;
    compressionEnabled: boolean;
    persistentCacheEnabled: boolean;
    serviceWorkerCacheEnabled: boolean;
}
export declare class SearchCacheManager {
    private l1Cache;
    private l2Cache;
    private l3CacheName;
    private metrics;
    private config;
    private cleanupInterval;
    constructor(config?: Partial<CacheConfig>);
    private initialize;
    private initializeIndexedDB;
    private initializeServiceWorkerCache;
    private generateCacheKey;
    get(query: string, options?: SearchOptions): Promise<SearchResult[] | null>;
    set(query: string, results: SearchResult[], options?: SearchOptions, searchDuration?: number): Promise<void>;
    private getFromL1;
    private setInL1;
    private evictLRUFromL1;
    private getFromL2;
    private setInL2;
    private deleteFromL2;
    private getFromL3;
    private setInL3;
    warmCache(queries: Array<{
        query: string;
        options?: SearchOptions;
    }>): Promise<void>;
    prefetchQueries(baseQuery: string, variations: string[]): Promise<void>;
    private startCleanup;
    private performCleanup;
    private cleanupL1;
    private cleanupL2;
    private compressEntry;
    private updateMetrics;
    private updateCacheMetrics;
    getMetrics(): CacheMetrics;
    clearAll(): Promise<void>;
    destroy(): void;
}
export default SearchCacheManager;
//# sourceMappingURL=SearchCacheManager.d.ts.map