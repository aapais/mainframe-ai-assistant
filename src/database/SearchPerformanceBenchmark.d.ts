import { KnowledgeDB } from './KnowledgeDB';
export interface BenchmarkResult {
  testName: string;
  totalOperations: number;
  duration: number;
  operationsPerSecond: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  errorRate: number;
  memoryUsed: number;
  cacheHitRate?: number;
  indexesUsed: string[];
  recommendations: string[];
}
export interface BenchmarkSuite {
  suiteName: string;
  description: string;
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averagePerformance: number;
    overallRecommendations: string[];
  };
}
export declare class SearchPerformanceBenchmark {
  private db;
  private rawDb;
  private optimizationEngine?;
  constructor(db: KnowledgeDB);
  runSearchBenchmark(options?: {
    datasetSize?: number;
    iterations?: number;
    includeStressTest?: boolean;
    enableOptimizations?: boolean;
  }): Promise<BenchmarkSuite>;
  private benchmarkBasicTextSearch;
  private benchmarkCategorySearch;
  private benchmarkTagSearch;
  private benchmarkFullTextSearch;
  private benchmarkPopularEntries;
  private benchmarkRecentEntries;
  private benchmarkComplexSearch;
  private benchmarkPaginatedSearch;
  private benchmarkAutoComplete;
  private benchmarkCacheEfficiency;
  private benchmarkConcurrentSearches;
  private benchmarkLargeResultSets;
  private calculateBenchmarkResult;
  private analyzeBenchmarkResults;
  private ensureDatasetSize;
  private generateTestData;
  private getBasicSearchRecommendations;
  private getCategorySearchRecommendations;
  private getTagSearchRecommendations;
  private getFullTextSearchRecommendations;
  private getPopularEntriesRecommendations;
  private getRecentEntriesRecommendations;
  private getComplexSearchRecommendations;
  private getPaginationRecommendations;
  private getAutoCompleteRecommendations;
  private getCacheRecommendations;
  private getConcurrencyRecommendations;
  private getLargeResultsRecommendations;
}
//# sourceMappingURL=SearchPerformanceBenchmark.d.ts.map
