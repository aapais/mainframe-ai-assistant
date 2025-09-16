import { EventEmitter } from 'events';
export interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<string>;
    setex(key: string, seconds: number, value: string): Promise<string>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    flushdb(): Promise<string>;
    ping(): Promise<string>;
    quit(): Promise<string>;
    pipeline(): RedisPipeline;
    multi(): RedisMulti;
}
export interface RedisPipeline {
    get(key: string): RedisPipeline;
    set(key: string, value: string): RedisPipeline;
    del(key: string): RedisPipeline;
    exec(): Promise<Array<[Error | null, any]>>;
}
export interface RedisMulti extends RedisPipeline {
    exec(): Promise<Array<[Error | null, any]>>;
}
export interface RedisCacheConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix: string;
    defaultTTL: number;
    maxRetries: number;
    retryDelayMs: number;
    enableCompression: boolean;
    compressionThreshold: number;
    maxConnectionPoolSize: number;
    enableCluster: boolean;
    clusterNodes?: Array<{
        host: string;
        port: number;
    }>;
    enableReadReplicas: boolean;
    readReplicaNodes?: Array<{
        host: string;
        port: number;
    }>;
}
export interface RedisCacheEntry<T> {
    value: T;
    timestamp: number;
    ttl: number;
    compressed: boolean;
    version: string;
    metadata?: Record<string, any>;
}
export interface RedisCacheStats {
    hitCount: number;
    missCount: number;
    hitRate: number;
    setCount: number;
    errorCount: number;
    connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
    memoryUsage: number;
    keyCount: number;
    averageLatency: number;
    compressionRatio: number;
}
export declare class RedisCache extends EventEmitter {
    private client?;
    private config;
    private stats;
    private circuitBreakerOpen;
    private failureCount;
    private lastFailureTime;
    private latencyBuffer;
    constructor(config?: Partial<RedisCacheConfig>);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    deletePattern(pattern: string): Promise<number>;
    exists(key: string): Promise<boolean>;
    expire(key: string, seconds: number): Promise<boolean>;
    mget<T>(keys: string[]): Promise<Array<T | null>>;
    mset<T>(items: Array<{
        key: string;
        value: T;
        ttl?: number;
    }>): Promise<boolean>;
    clear(): Promise<void>;
    keys(pattern?: string): Promise<string[]>;
    getStats(): RedisCacheStats;
    ping(): Promise<boolean>;
    close(): Promise<void>;
    invalidate(pattern?: string, tags?: string[]): Promise<number>;
    private initializeClient;
    private createMockClient;
    private setupEventHandlers;
    private executeWithRetry;
    private createCacheEntry;
    private serializeEntry;
    private deserializeEntry;
    private isExpired;
    private getFullKey;
    private handleError;
    private recordHit;
    private recordMiss;
    private recordLatency;
    private updateHitRate;
    private updateStats;
    private sleep;
}
export default RedisCache;
//# sourceMappingURL=RedisCache.d.ts.map