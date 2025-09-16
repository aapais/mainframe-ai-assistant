export { default as AdvancedSearchEngine } from './AdvancedSearchEngine';
export type { SearchEngineConfig, PerformanceConfig, FeatureFlags, SearchContext, UserPreferences, SearchMetrics, SearchResponse, SearchFacet, SearchMetadata } from './AdvancedSearchEngine';
export { default as InvertedIndex } from './InvertedIndex';
export type { IndexedDocument, PostingList, PostingEntry, IndexStats } from './InvertedIndex';
export { default as TextProcessor } from './TextProcessor';
export type { TokenInfo, TokenType, ProcessingOptions } from './TextProcessor';
export { default as QueryParser } from './QueryParser';
export type { ParsedQuery, QueryType, QueryTerm, QueryOperator, QueryFilter, FilterOperator, QueryOptions } from './QueryParser';
export { default as FuzzyMatcher } from './FuzzyMatcher';
export type { FuzzyMatch, FuzzyAlgorithm, FuzzyOptions, AlgorithmWeights } from './FuzzyMatcher';
export { default as RankingEngine } from './RankingEngine';
export type { RankingScore, ScoreComponent, RankingAlgorithm, RankingOptions, BM25Parameters, TFIDFParameters, CombinationWeights, DocumentCollection } from './RankingEngine';
export { default as SearchCache } from './SearchCache';
export type { CacheEntry, CacheStats, CacheConfiguration, EvictionStrategy, CacheLayerConfig, PersistenceConfig, CompressionConfig, WarmingConfig, WarmingStrategy } from './SearchCache';
export { default as SearchBenchmark } from './SearchBenchmark';
export type { BenchmarkConfig, BenchmarkResult, BenchmarkSummary, DetailedMetrics, PerformanceProfile, OptimizationRecommendation, ComplianceReport, IndexMetrics, CacheMetrics, RankingMetrics } from './SearchBenchmark';
export { default as FTS5Engine } from './FTS5Engine';
export type { FTS5Config, FTS5SearchResult, MainframeTokenizerConfig } from './FTS5Engine';
export { default as FTS5Integration } from './FTS5Integration';
export type { FTS5IntegrationConfig, SearchStrategy } from './FTS5Integration';
export declare function createSearchEngine(config?: Partial<SearchEngineConfig>): AdvancedSearchEngine;
export declare function createBenchmark(engine: AdvancedSearchEngine): SearchBenchmark;
export declare function createFTS5Engine(db: any, config?: Partial<any>): any;
export declare function createFTS5Integration(db: any, legacyEngine: AdvancedSearchEngine, fts5Config?: Partial<any>, integrationConfig?: Partial<any>): any;
export declare function validatePerformance(engine: AdvancedSearchEngine, quickTest?: boolean): Promise<{
    passed: boolean;
    details: any;
}>;
export declare const PERFORMANCE_TARGETS: {
    readonly RESPONSE_TIME_MS: 1000;
    readonly CACHE_HIT_RATE: 0.8;
    readonly ERROR_RATE: 0.01;
    readonly MEMORY_LIMIT_MB: 512;
    readonly THROUGHPUT_QPS: 10;
};
export declare const OPTIMIZATION_LEVELS: {
    readonly FAST: {
        readonly indexing: "minimal";
        readonly caching: "aggressive";
        readonly ranking: "simple";
    };
    readonly BALANCED: {
        readonly indexing: "standard";
        readonly caching: "moderate";
        readonly ranking: "bm25";
    };
    readonly ACCURATE: {
        readonly indexing: "comprehensive";
        readonly caching: "conservative";
        readonly ranking: "combined";
    };
};
//# sourceMappingURL=index.d.ts.map