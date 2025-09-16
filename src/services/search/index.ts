/**
 * High-Performance Search Engine Module Exports
 * Complete backend search service with <1s response time guarantee
 */

// Core Engine
export { default as AdvancedSearchEngine } from './AdvancedSearchEngine';
export type { 
  SearchEngineConfig,
  PerformanceConfig,
  FeatureFlags,
  SearchContext,
  UserPreferences,
  SearchMetrics,
  SearchResponse,
  SearchFacet,
  SearchMetadata 
} from './AdvancedSearchEngine';

// Inverted Index
export { default as InvertedIndex } from './InvertedIndex';
export type {
  IndexedDocument,
  PostingList,
  PostingEntry,
  IndexStats
} from './InvertedIndex';

// Text Processing
export { default as TextProcessor } from './TextProcessor';
export type {
  TokenInfo,
  TokenType,
  ProcessingOptions
} from './TextProcessor';

// Query Parser
export { default as QueryParser } from './QueryParser';
export type {
  ParsedQuery,
  QueryType,
  QueryTerm,
  QueryOperator,
  QueryFilter,
  FilterOperator,
  QueryOptions
} from './QueryParser';

// Fuzzy Matching
export { default as FuzzyMatcher } from './FuzzyMatcher';
export type {
  FuzzyMatch,
  FuzzyAlgorithm,
  FuzzyOptions,
  AlgorithmWeights
} from './FuzzyMatcher';

// Ranking Engine
export { default as RankingEngine } from './RankingEngine';
export type {
  RankingScore,
  ScoreComponent,
  RankingAlgorithm,
  RankingOptions,
  BM25Parameters,
  TFIDFParameters,
  CombinationWeights,
  DocumentCollection
} from './RankingEngine';

// Search Cache
export { default as SearchCache } from './SearchCache';
export type {
  CacheEntry,
  CacheStats,
  CacheConfiguration,
  EvictionStrategy,
  CacheLayerConfig,
  PersistenceConfig,
  CompressionConfig,
  WarmingConfig,
  WarmingStrategy
} from './SearchCache';

// Benchmarking
export { default as SearchBenchmark } from './SearchBenchmark';
export type {
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkSummary,
  DetailedMetrics,
  PerformanceProfile,
  OptimizationRecommendation,
  ComplianceReport,
  IndexMetrics,
  CacheMetrics,
  RankingMetrics
} from './SearchBenchmark';

// FTS5 Full-Text Search Engine
export { default as FTS5Engine } from './FTS5Engine';
export type {
  FTS5Config,
  FTS5SearchResult,
  MainframeTokenizerConfig
} from './FTS5Engine';

// FTS5 Integration Service
export { default as FTS5Integration } from './FTS5Integration';
export type {
  FTS5IntegrationConfig,
  SearchStrategy
} from './FTS5Integration';

/**
 * Factory function to create a fully configured search engine
 */
export function createSearchEngine(config?: Partial<SearchEngineConfig>): AdvancedSearchEngine {
  return new AdvancedSearchEngine(config);
}

/**
 * Factory function to create a search benchmark suite
 */
export function createBenchmark(engine: AdvancedSearchEngine): SearchBenchmark {
  return new SearchBenchmark(engine);
}

/**
 * Factory function to create an FTS5 search engine
 */
export function createFTS5Engine(
  db: any,
  config?: Partial<any>
): any {
  // Import dynamically to avoid circular dependencies
  const FTS5Engine = require('./FTS5Engine').default;
  return new FTS5Engine(db, config);
}

/**
 * Factory function to create FTS5 integration service
 */
export function createFTS5Integration(
  db: any,
  legacyEngine: AdvancedSearchEngine,
  fts5Config?: Partial<any>,
  integrationConfig?: Partial<any>
): any {
  // Import dynamically to avoid circular dependencies
  const FTS5Integration = require('./FTS5Integration').default;
  return new FTS5Integration(db, legacyEngine, fts5Config, integrationConfig);
}

/**
 * Utility function to validate search engine performance
 */
export async function validatePerformance(
  engine: AdvancedSearchEngine, 
  quickTest: boolean = true
): Promise<{ passed: boolean; details: any }> {
  const benchmark = new SearchBenchmark(engine);
  
  if (quickTest) {
    const result = await benchmark.quickValidation();
    return {
      passed: result.passed,
      details: result.metrics
    };
  } else {
    const result = await benchmark.runBenchmark();
    return {
      passed: result.summary.passed,
      details: result
    };
  }
}

/**
 * Performance constants and recommendations
 */
export const PERFORMANCE_TARGETS = {
  RESPONSE_TIME_MS: 1000,
  CACHE_HIT_RATE: 0.8,
  ERROR_RATE: 0.01,
  MEMORY_LIMIT_MB: 512,
  THROUGHPUT_QPS: 10
} as const;

export const OPTIMIZATION_LEVELS = {
  FAST: {
    indexing: 'minimal',
    caching: 'aggressive',
    ranking: 'simple'
  },
  BALANCED: {
    indexing: 'standard',
    caching: 'moderate',
    ranking: 'bm25'
  },
  ACCURATE: {
    indexing: 'comprehensive',
    caching: 'conservative',
    ranking: 'combined'
  }
} as const;