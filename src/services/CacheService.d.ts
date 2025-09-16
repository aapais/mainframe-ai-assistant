import { ICacheService, CacheStats, CacheConfig } from '../types/services';
export declare class CacheService implements ICacheService {
    private config;
    private cache;
    private head?;
    private tail?;
    private currentSize;
    private totalMemoryUsage;
    private stats;
    private cleanupInterval?;
    constructor(config: CacheConfig);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    mget<T>(keys: string[]): Promise<Array<T | null>>;
    mset<T>(items: Array<{
        key: string;
        value: T;
        ttl?: number;
    }>): Promise<void>;
    delete(key: string): Promise<boolean>;
    deletePattern(pattern: string): Promise<number>;
    clear(): Promise<void>;
    has(key: string): Promise<boolean>;
    expire(key: string, ttl: number): Promise<boolean>;
    stats(): CacheStats;
    keys(pattern?: string): Promise<string[]>;
    private validateKey;
    private validateValue;
    private isExpired;
    private calculateSize;
    private ensureCapacity;
    private removeExpiredEntries;
    private evictLRU;
    private moveToFront;
    private removeFromList;
    private addToFront;
    private setupCleanupInterval;
    close(): Promise<void>;
    debugInfo(): Promise<any>;
    optimize(): Promise<void>;
    warmup(data: Array<{
        key: string;
        value: any;
        ttl?: number;
    }>): Promise<void>;
    export(): Promise<string>;
    import(data: string): Promise<void>;
}
export default CacheService;
//# sourceMappingURL=CacheService.d.ts.map