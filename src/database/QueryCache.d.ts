import Database from 'better-sqlite3';
export interface CacheEntry<T = any> {
    key: string;
    value: T;
    timestamp: number;
    ttl: number;
    hitCount: number;
    lastAccessed: number;
    computeTime: number;
    size: number;
}
export interface CacheStats {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
    avgResponseTime: number;
    evictionCount: number;
    topQueries: Array<{
        query: string;
        hitCount: number;
        avgTime: number;
    }>;
}
export interface CacheConfig {
    maxSize: number;
    defaultTTL: number;
    maxMemoryMB: number;
    persistToDisk: boolean;
    compressionEnabled: boolean;
}
export declare class QueryCache {
    private memoryCache;
    private db;
    private config;
    private stats;
    constructor(db: Database.Database, config?: Partial<CacheConfig>);
    private initializePersistentCache;
    get<T>(key: string, computeFn: () => Promise<T> | T, options?: {
        ttl?: number;
        tags?: string[];
        forceRefresh?: boolean;
    }): Promise<T>;
    set<T>(key: string, value: T, options?: {
        ttl?: number;
        tags?: string[];
        priority?: 'low' | 'normal' | 'high';
    }): Promise<void>;
    invalidate(pattern?: string, tags?: string[]): Promise<number>;
    preWarm(): Promise<void>;
    private analyzeFrequentQueries;
    private getCategoryUsageStats;
    private calculateTTLBasedOnUsage;
    private executeFrequentQuery;
    private executePaginatedSearch;
    private getPopularSearches;
    private getSearchAutoComplete;
    private getFromMemory;
    private setInMemory;
    private getFromDisk;
    private setOnDisk;
    private computeAndCache;
    private generateCacheKey;
    private enforceMemoryLimit;
    private getCurrentMemoryUsage;
    private estimateSize;
    private updateStats;
    private startMaintenanceTimer;
    private cleanupExpiredEntries;
    private performMaintenance;
    getStats(): CacheStats;
    private compress;
    private decompress;
    private getPopularEntries;
    private getRecentEntries;
    private getCategoryStats;
    private getUsageTrends;
    private getCategoryEntries;
}
//# sourceMappingURL=QueryCache.d.ts.map