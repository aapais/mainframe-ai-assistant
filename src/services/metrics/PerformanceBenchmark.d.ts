export interface BenchmarkConfig {
  name: string;
  description: string;
  duration: number;
  concurrency: number;
  warmupTime?: number;
  cooldownTime?: number;
  targets: {
    responseTime?: number;
    throughput?: number;
    errorRate?: number;
    successRate?: number;
  };
}
export interface BenchmarkResult {
  id: string;
  config: BenchmarkConfig;
  startTime: number;
  endTime: number;
  duration: number;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
  };
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  results: BenchmarkTestResult[];
  passed: boolean;
  failures: string[];
}
export interface BenchmarkTestResult {
  timestamp: number;
  responseTime: number;
  success: boolean;
  error?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
}
export type BenchmarkOperation = () => Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
}>;
export declare class PerformanceBenchmark {
  private activeTests;
  runBenchmark(config: BenchmarkConfig, operation: BenchmarkOperation): Promise<BenchmarkResult>;
  private runWarmup;
  private runMainBenchmark;
  private runWorker;
  private analyzeResults;
  private calculatePercentile;
  private sleep;
  static createHttpBenchmark(url: string, options?: RequestInit): BenchmarkOperation;
  static createDatabaseBenchmark(
    queryFn: () => Promise<any>,
    queryName?: string
  ): BenchmarkOperation;
  static createCacheBenchmark(
    cacheGet: (key: string) => Promise<any>,
    keyPrefix?: string
  ): BenchmarkOperation;
  runSystemBenchmark(): Promise<{
    http: BenchmarkResult;
    database: BenchmarkResult;
    cache: BenchmarkResult;
  }>;
}
export declare const performanceBenchmark: PerformanceBenchmark;
//# sourceMappingURL=PerformanceBenchmark.d.ts.map
