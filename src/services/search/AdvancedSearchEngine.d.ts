import { KBEntry, SearchResult, SearchOptions } from '../../types';
import { ParsedQuery } from './QueryParser';
export interface SearchEngineConfig {
    maxResults: number;
    defaultTimeout: number;
    cacheEnabled: boolean;
    fuzzyEnabled: boolean;
    rankingAlgorithm: 'tfidf' | 'bm25' | 'combined';
    performance: PerformanceConfig;
    features: FeatureFlags;
}
export interface PerformanceConfig {
    indexingBatchSize: number;
    searchTimeout: number;
    maxConcurrentSearches: number;
    memoryThreshold: number;
    optimizationLevel: 'fast' | 'balanced' | 'accurate';
}
export interface FeatureFlags {
    semanticSearch: boolean;
    autoComplete: boolean;
    spellCorrection: boolean;
    queryExpansion: boolean;
    resultClustering: boolean;
    personalizedRanking: boolean;
}
export interface SearchContext {
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    searchHistory?: string[];
    preferences?: UserPreferences;
}
export interface UserPreferences {
    preferredCategories?: string[];
    boostFactors?: Record<string, number>;
    language?: string;
    resultFormat?: 'summary' | 'detailed' | 'minimal';
}
export interface SearchMetrics {
    queryTime: number;
    indexTime: number;
    rankingTime: number;
    totalTime: number;
    resultCount: number;
    cacheHit: boolean;
    algorithm: string;
    optimizations: string[];
}
export interface SearchResponse {
    results: SearchResult[];
    suggestions?: string[];
    corrections?: string[];
    facets?: SearchFacet[];
    metadata: SearchMetadata;
    metrics: SearchMetrics;
    context: SearchContext;
}
export interface SearchFacet {
    field: string;
    values: Array<{
        value: string;
        count: number;
        selected?: boolean;
    }>;
}
export interface SearchMetadata {
    query: string;
    parsedQuery: ParsedQuery;
    totalResults: number;
    processingTime: number;
    resultWindow: {
        offset: number;
        limit: number;
    };
    sortBy: string;
    filters: Record<string, any>;
}
export declare class AdvancedSearchEngine {
    private index;
    private textProcessor;
    private queryParser;
    private fuzzyMatcher;
    private rankingEngine;
    private cache;
    private config;
    private isInitialized;
    private searchQueue;
    private activeSearches;
    private metrics;
    constructor(config?: Partial<SearchEngineConfig>);
    initialize(entries: KBEntry[]): Promise<void>;
    search(query: string, options?: SearchOptions, context?: SearchContext): Promise<SearchResponse>;
    suggest(prefix: string, limit?: number): Promise<string[]>;
    correct(query: string): Promise<string[]>;
    addDocument(entry: KBEntry): Promise<void>;
    removeDocument(docId: string): Promise<boolean>;
    getStats(): {
        engine: {
            totalSearches: number;
            averageResponseTime: number;
            cacheHitRate: number;
            errorRate: number;
            indexSize: number;
            lastIndexUpdate: number;
        };
        index: import("./InvertedIndex").IndexStats;
        cache: import("./SearchCache").CacheStats;
        processor: {
            cacheSize: number;
            cacheHitRate: number;
            tokensProcessed: number;
            cacheHits: number;
            stemOperations: number;
            processingTime: number;
        };
        ranking: {
            cacheSize: number;
            cacheHitRate: number;
            rankingsCalculated: number;
            cacheHits: number;
            averageRankingTime: number;
            totalRankingTime: number;
        };
        health: {
            initialized: boolean;
            activeSearches: number;
            queueLength: number;
            memoryUsage: any;
        };
    };
    optimize(): Promise<void>;
    shutdown(): Promise<void>;
    private initializeComponents;
    private executeSearchWithTimeout;
    private executeSearch;
    private convertRankingsToResults;
    private generateFacets;
    private createEmptyResponse;
    private warmUpCache;
    private updateMetrics;
    private queueSearch;
    private processQueue;
}
export default AdvancedSearchEngine;
//# sourceMappingURL=AdvancedSearchEngine.d.ts.map