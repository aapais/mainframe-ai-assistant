export interface MemoryCacheConfig {
    maxSize: number;
    defaultTTL: number;
    cleanupInterval: number;
    enableLRU: boolean;
    maxMemoryUsage: number;
}
export interface CacheItem<T = any> {
    value: T;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccessed: number;
    size: number;
    tags?: string[];
}
export declare class MemoryCache<T = any> {
    private cache;
    private accessOrder;
    private config;
    private cleanupTimer?;
    private currentMemoryUsage;
    private metrics;
    constructor(config: MemoryCacheConfig);
    get(key: string): T | null;
    set(key: string, value: T, ttl?: number, tags?: string[]): boolean;
    delete(key: string): boolean;
    has(key: string): boolean;
    clear(): void;
    invalidateByTag(tag: string): number;
    getStats(): {
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
    keys(pattern?: string): string[];
    mget(keys: string[]): (T | null)[];
    mset(entries: Array<{
        key: string;
        value: T;
        ttl?: number;
        tags?: string[];
    }>): boolean;
    private isExpired;
    private evictLRU;
    private updateAccessOrder;
    private removeFromAccessOrder;
    private estimateSize;
    private startCleanupTimer;
    private cleanup;
    destroy(): void;
}
//# sourceMappingURL=MemoryCache.d.ts.map