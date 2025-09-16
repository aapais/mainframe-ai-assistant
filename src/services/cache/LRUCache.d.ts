export interface LRUCacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    lastAccessed: number;
    accessCount: number;
    frequency: number;
    ttl?: number;
    size: number;
    prev?: LRUCacheNode<T>;
    next?: LRUCacheNode<T>;
}
export interface LRUCacheNode<T> {
    entry: LRUCacheEntry<T>;
    prev?: LRUCacheNode<T>;
    next?: LRUCacheNode<T>;
}
export interface LRUCacheConfig {
    maxSize: number;
    maxMemoryMB: number;
    defaultTTL: number;
    evictionPolicy: 'LRU' | 'LFU' | 'ARC' | 'ADAPTIVE';
    enableStats: boolean;
    cleanupInterval: number;
    memoryPressureThreshold: number;
}
export interface LRUCacheStats {
    hitCount: number;
    missCount: number;
    hitRate: number;
    size: number;
    memoryUsage: number;
    averageAccessTime: number;
    evictions: number;
    hotKeyCount: number;
    averageEntryAge: number;
}
export declare class LRUCache<T = any> {
    private cache;
    private head?;
    private tail?;
    private t1;
    private t2;
    private b1;
    private b2;
    private config;
    private stats;
    private cleanupTimer?;
    private currentMemoryUsage;
    private adaptiveP;
    constructor(config?: Partial<LRUCacheConfig>);
    get(key: string): T | null;
    set(key: string, value: T, ttl?: number): boolean;
    delete(key: string): boolean;
    clear(): void;
    has(key: string): boolean;
    keys(): string[];
    getStats(): LRUCacheStats;
    getHotKeys(limit?: number): Array<{
        key: string;
        frequency: number;
        accessCount: number;
    }>;
    optimize(): void;
    destroy(): void;
    private handleAccess;
    private handleInsertion;
    private handleARCAccess;
    private handleARCInsertion;
    private handleAdaptiveAccess;
    private handleAdaptiveInsertion;
    private moveToFront;
    private addToFront;
    private removeNode;
    private updateLFUPosition;
    private addToLFU;
    private ensureCapacity;
    private evictLRU;
    private updateAccess;
    private isExpired;
    private estimateSize;
    private recordHit;
    private recordMiss;
    private updateAverageAccessTime;
    private updateHitRate;
    private updateStats;
    private calculateHotThreshold;
    private cleanupExpired;
    private rebalanceARC;
    private updateFrequencyScores;
    private startCleanupTimer;
}
export default LRUCache;
//# sourceMappingURL=LRUCache.d.ts.map