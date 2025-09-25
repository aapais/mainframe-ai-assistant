import { KnowledgeDB } from './KnowledgeDB';
export interface BenchmarkResult {
  strategy: string;
  query: string;
  executionTimeMs: number;
  resultCount: number;
  cacheHit: boolean;
  complexity: 'simple' | 'medium' | 'complex';
  success: boolean;
  error?: string;
}
export interface PerformanceReport {
  summary: {
    totalTests: number;
    passedTests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    cacheHitRate: number;
    slowQueries: number;
  };
  strategyPerformance: Record<
    string,
    {
      averageTime: number;
      testCount: number;
      successRate: number;
      cacheHitRate: number;
    }
  >;
  recommendations: string[];
  detailedResults: BenchmarkResult[];
}
export declare class SearchBenchmark {
  private db;
  private testQueries;
  constructor(db: KnowledgeDB);
  runBenchmark(options?: {
    iterations?: number;
    includeAutoComplete?: boolean;
    warmupRuns?: number;
  }): Promise<PerformanceReport>;
  private benchmarkSingleQuery;
  private benchmarkAutoComplete;
  private runWarmupQueries;
  private generatePerformanceReport;
  private generateRecommendations;
  private printSummaryReport;
  exportResults(report: PerformanceReport, filePath: string): Promise<void>;
}
export declare class SearchComplexityAnalyzer {
  static analyzeQuery(query: string): {
    complexity: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)';
    strategy: string;
    expectedTimeMs: number;
    reasoning: string[];
  };
}
//# sourceMappingURL=SearchBenchmark.d.ts.map
