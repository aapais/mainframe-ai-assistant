import Database from 'better-sqlite3';
import { FTS5Config } from './FTS5Engine';
import AdvancedSearchEngine from './AdvancedSearchEngine';
import { SearchResult, SearchOptions } from '../../types';
export interface FTS5IntegrationConfig {
    enabled: boolean;
    fallbackEnabled: boolean;
    minQueryLength: number;
    performance: {
        maxSearchTime: number;
        maxInitTime: number;
        enableMonitoring: boolean;
    };
    cache: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
    };
    features: {
        hybridSearch: boolean;
        autoComplete: boolean;
        snippets: boolean;
        queryExpansion: boolean;
    };
}
export interface SearchStrategy {
    strategy: 'fts5' | 'legacy' | 'hybrid';
    reason: string;
    confidence: number;
    estimatedTime: number;
}
export declare class FTS5Integration {
    private db;
    private fts5Engine;
    private legacyEngine;
    private config;
    private initialized;
    private performanceMetrics;
    private resultCache;
    private static readonly DEFAULT_CONFIG;
    constructor(db: Database.Database, legacyEngine: AdvancedSearchEngine, fts5Config?: Partial<FTS5Config>, integrationConfig?: Partial<FTS5IntegrationConfig>);
    initialize(): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    autoComplete(prefix: string, limit?: number): Promise<string[]>;
    getPerformanceMetrics(): {
        fts5: {
            averageTime: number;
            callCount: number;
            successRate: number;
        };
        legacy: {
            averageTime: number;
            callCount: number;
            successRate: number;
        };
        hybrid: {
            averageTime: number;
            callCount: number;
            successRate: number;
        };
        overall: {
            totalSearches: number;
            averageTime: number;
            cacheHitRate: number;
        };
    };
    getHealthStatus(): {
        fts5Available: boolean;
        legacyAvailable: boolean;
        cacheStatus: string;
        performanceStatus: string;
        recommendations: string[];
    };
    optimize(): Promise<void>;
    private initializeWithTimeout;
    private selectSearchStrategy;
    private executeSearch;
    private executeFTS5Search;
    private executeHybridSearch;
    private mergeSearchResults;
    private getFTS5AutoComplete;
    private mergeAutoCompleteResults;
    private generateCacheKey;
    private getFromCache;
    private addToCache;
    private cleanExpiredCache;
    private recordPerformanceMetric;
    private startPerformanceMonitoring;
    private preWarmCache;
    private mergeConfig;
    private ensureInitialized;
}
export default FTS5Integration;
//# sourceMappingURL=FTS5Integration.d.ts.map