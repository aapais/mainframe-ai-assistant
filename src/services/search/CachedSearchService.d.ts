import { KBEntry, SearchOptions } from '../../types';
import { SearchEngineConfig, SearchResponse, SearchContext } from './AdvancedSearchEngine';
export interface CachedSearchConfig extends SearchEngineConfig {
    cache: {
        enabled: boolean;
        layers: {
            l1: {
                size: number;
                ttl: number;
            };
            l2: {
                size: number;
                ttl: number;
            };
            l3: {
                size: number;
                ttl: number;
            };
        };
        warming: {
            enabled: boolean;
            strategies: ('popular' | 'recent' | 'predictive')[];
            schedule: string;
        };
        invalidation: {
            enabled: boolean;
            smartCascade: boolean;
            maxBatchSize: number;
        };
        monitoring: {
            enabled: boolean;
            metricsInterval: number;
            alertThresholds: {
                hitRate: number;
                responseTime: number;
                errorRate: number;
            };
        };
    };
    optimization: {
        batchSize: number;
        maxConcurrentQueries: number;
        queryNormalization: boolean;
        resultDeduplication: boolean;
        asyncProcessing: boolean;
    };
}
export interface CacheMetrics {
    hitRates: {
        overall: number;
        l1: number;
        l2: number;
        l3: number;
    };
    performance: {
        avgResponseTime: number;
        cacheResponseTime: number;
        computeResponseTime: number;
        throughput: number;
    };
    storage: {
        totalSize: number;
        utilizationPercent: number;
        evictions: number;
        memoryPressure: number;
    };
    operations: {
        totalQueries: number;
        cacheHits: number;
        cacheMisses: number;
        errors: number;
        warmingOperations: number;
    };
}
export interface SearchAnalytics {
    popularQueries: Array<{
        query: string;
        count: number;
        avgTime: number;
    }>;
    performancePatterns: {
        timeOfDay: Record<string, number>;
        queryLength: Record<string, number>;
        resultSize: Record<string, number>;
    };
    userBehavior: {
        queryPatterns: string[];
        sessionDuration: number;
        repeatQueries: number;
    };
    recommendations: {
        cacheOptimizations: string[];
        performanceImprovements: string[];
        capacityPlanning: string[];
    };
}
export declare class CachedSearchService {
    private searchEngine;
    private cacheSystem;
    private searchCache;
    private cacheService;
    private config;
    private metrics;
    private analytics;
    private isInitialized;
    private queryQueue;
    private warmingInProgress;
    private metricsInterval?;
    private queryHistory;
    constructor(config?: Partial<CachedSearchConfig>);
    initialize(entries: KBEntry[]): Promise<void>;
    search(query: string, options?: SearchOptions, context?: SearchContext): Promise<SearchResponse>;
    batchSearch(queries: Array<{
        query: string;
        options?: SearchOptions;
        context?: SearchContext;
    }>): Promise<SearchResponse[]>;
    suggest(prefix: string, limit?: number, context?: SearchContext): Promise<string[]>;
    correct(query: string, context?: SearchContext): Promise<string[]>;
    warmCache(strategy?: 'popular' | 'recent' | 'predictive' | 'all'): Promise<{
        warmed: number;
        timeSaved: number;
    }>;
    invalidateCache(pattern?: string, tags?: string[], reason?: string): Promise<{
        invalidated: number;
        cascaded: number;
    }>;
    addDocument(entry: KBEntry): Promise<void>;
    removeDocument(docId: string): Promise<boolean>;
    getMetrics(): CacheMetrics;
    getAnalytics(): SearchAnalytics;
    getHealthStatus(): {
        status: 'healthy' | 'degraded' | 'critical';
        issues: string[];
        recommendations: string[];
        uptime: number;
    };
    optimizeConfiguration(): Promise<{
        changes: string[];
        expectedImprovement: string;
    }>;
    shutdown(): Promise<void>;
    private mergeConfig;
    private initializeMetrics;
    private initializeAnalytics;
    private initializeCacheSystem;
    private validateInitialization;
    private normalizeQuery;
    private generateCacheKey;
    private executeSearch;
    private getTTLForQuery;
    private getPriorityForQuery;
    private getTagsForQuery;
    private recordQueryMetrics;
    private recordErrorMetrics;
    private setupMetricsCollection;
    private updateMetrics;
    private updateAnalytics;
    private updatePerformancePatterns;
    private updateRecommendations;
    private performInitialWarming;
    private extractCommonTerms;
    private warmPopularQueries;
    private warmRecentQueries;
    private warmPredictiveQueries;
    private extractQueryPatterns;
    private getRelatedTags;
    private invalidateRelatedCache;
}
export default CachedSearchService;
//# sourceMappingURL=CachedSearchService.d.ts.map