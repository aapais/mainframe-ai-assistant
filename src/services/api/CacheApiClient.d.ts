import { CachePerformanceMetrics, CacheStats, IncrementalResult } from '../cache/CacheTypes';
export interface CacheApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: number;
    requestId: string;
    cached?: boolean;
    source?: 'cache' | 'database' | 'api';
    performance?: {
        responseTime: number;
        cacheHit: boolean;
        bytesTransferred: number;
    };
}
export interface CacheApiOptions {
    baseUrl?: string;
    timeout?: number;
    retries?: number;
    enableMetrics?: boolean;
    enableCompression?: boolean;
    headers?: Record<string, string>;
}
export interface CacheWarmupRequest {
    patterns: string[];
    priority: 'low' | 'normal' | 'high';
    batchSize?: number;
    concurrency?: number;
}
export interface CachePrefetchRequest {
    keys: string[];
    contexts?: Record<string, any>[];
    predictive?: boolean;
}
export interface CacheInvalidationRequest {
    keys?: string[];
    patterns?: string[];
    tags?: string[];
    cascade?: boolean;
}
export interface SearchCacheRequest {
    query: string;
    options?: {
        limit?: number;
        offset?: number;
        includeMetadata?: boolean;
        enablePrediction?: boolean;
        cacheStrategy?: 'aggressive' | 'conservative' | 'adaptive';
    };
}
export interface SearchCacheResponse {
    results: IncrementalResult[];
    totalCount: number;
    hasMore: boolean;
    cacheMetrics: CachePerformanceMetrics;
    suggestions?: any[];
    nextToken?: string;
}
export declare class CacheApiError extends Error {
    code: string;
    status?: number | undefined;
    details?: any | undefined;
    constructor(message: string, code: string, status?: number | undefined, details?: any | undefined);
}
export declare class CacheApiClient {
    private baseUrl;
    private timeout;
    private retries;
    private enableMetrics;
    private enableCompression;
    private headers;
    private requestId;
    constructor(options?: CacheApiOptions);
    get<T = any>(key: string): Promise<CacheApiResponse<T>>;
    set<T = any>(key: string, value: T, options?: {
        ttl?: number;
        tags?: string[];
        priority?: 'low' | 'normal' | 'high';
    }): Promise<CacheApiResponse<boolean>>;
    delete(key: string): Promise<CacheApiResponse<boolean>>;
    has(key: string): Promise<CacheApiResponse<boolean>>;
    clear(pattern?: string): Promise<CacheApiResponse<number>>;
    getMany<T = any>(keys: string[]): Promise<CacheApiResponse<Array<T | null>>>;
    setMany<T = any>(entries: Array<{
        key: string;
        value: T;
        ttl?: number;
        tags?: string[];
    }>): Promise<CacheApiResponse<number>>;
    deleteMany(keys: string[]): Promise<CacheApiResponse<number>>;
    search(request: SearchCacheRequest): Promise<CacheApiResponse<SearchCacheResponse>>;
    searchIncremental(query: string, token?: string, options?: {
        batchSize?: number;
        enablePrediction?: boolean;
    }): Promise<CacheApiResponse<SearchCacheResponse>>;
    getSuggestions(query: string, options?: {
        maxSuggestions?: number;
        enableML?: boolean;
        context?: Record<string, any>;
    }): Promise<CacheApiResponse<any[]>>;
    getStats(): Promise<CacheApiResponse<CacheStats>>;
    getMetrics(timeframe?: string): Promise<CacheApiResponse<CachePerformanceMetrics>>;
    getHealth(): Promise<CacheApiResponse<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Record<string, boolean>;
        uptime: number;
        version: string;
    }>>;
    warmup(request: CacheWarmupRequest): Promise<CacheApiResponse<{
        jobId: string;
        estimatedDuration: number;
        itemsToWarm: number;
    }>>;
    prefetch(request: CachePrefetchRequest): Promise<CacheApiResponse<{
        jobId: string;
        prefetchedCount: number;
        failedCount: number;
    }>>;
    invalidate(request: CacheInvalidationRequest): Promise<CacheApiResponse<{
        invalidatedCount: number;
        cascadeCount?: number;
    }>>;
    optimize(): Promise<CacheApiResponse<{
        compactedEntries: number;
        reclaimedMemory: number;
        duration: number;
    }>>;
    createEventSource(topics?: string[]): EventSource | null;
    subscribeToMetrics(callback: (metrics: CachePerformanceMetrics) => void): Promise<() => void>;
    private request;
}
export declare const createCacheApiClient: (options?: CacheApiOptions) => CacheApiClient;
export declare const getCacheApiClient: () => CacheApiClient;
export default CacheApiClient;
//# sourceMappingURL=CacheApiClient.d.ts.map