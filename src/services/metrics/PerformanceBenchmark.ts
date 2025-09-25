/**
 * Performance Benchmark Utility
 * Tools for benchmarking and testing system performance
 */

import { metricsCollector } from './MetricsCollector';

export interface BenchmarkConfig {
  name: string;
  description: string;
  duration: number; // Test duration in milliseconds
  concurrency: number; // Number of concurrent operations
  warmupTime?: number; // Warmup period in milliseconds
  cooldownTime?: number; // Cooldown period in milliseconds
  targets: {
    responseTime?: number; // Max acceptable response time in ms
    throughput?: number; // Min required throughput per second
    errorRate?: number; // Max acceptable error rate (0-1)
    successRate?: number; // Min required success rate (0-1)
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
    throughput: number; // Requests per second
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

export class PerformanceBenchmark {
  private activeTests: Map<string, boolean> = new Map();

  /**
   * Run a performance benchmark test
   */
  async runBenchmark(
    config: BenchmarkConfig,
    operation: BenchmarkOperation
  ): Promise<BenchmarkResult> {
    const testId = `benchmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Starting benchmark: ${config.name} (${testId})`);

    this.activeTests.set(testId, true);

    try {
      const startTime = Date.now();

      // Warmup phase
      if (config.warmupTime && config.warmupTime > 0) {
        console.log(`Warming up for ${config.warmupTime}ms...`);
        await this.runWarmup(operation, config.warmupTime);
      }

      // Main benchmark phase
      console.log(
        `Running benchmark for ${config.duration}ms with ${config.concurrency} concurrent operations...`
      );
      const results = await this.runMainBenchmark(testId, config, operation);

      // Cooldown phase
      if (config.cooldownTime && config.cooldownTime > 0) {
        console.log(`Cooling down for ${config.cooldownTime}ms...`);
        await this.sleep(config.cooldownTime);
      }

      const endTime = Date.now();

      // Analyze results
      const benchmarkResult = this.analyzeResults(testId, config, startTime, endTime, results);

      console.log(`Benchmark completed: ${config.name}`);
      console.log(
        `Results: ${benchmarkResult.summary.totalRequests} requests, ` +
          `${benchmarkResult.summary.avgResponseTime.toFixed(2)}ms avg, ` +
          `${benchmarkResult.summary.throughput.toFixed(2)} req/s, ` +
          `${(benchmarkResult.summary.errorRate * 100).toFixed(2)}% error rate`
      );

      return benchmarkResult;
    } catch (error) {
      console.error(`Benchmark failed: ${config.name}`, error);
      throw error;
    } finally {
      this.activeTests.delete(testId);
    }
  }

  /**
   * Run warmup phase
   */
  private async runWarmup(operation: BenchmarkOperation, warmupTime: number): Promise<void> {
    const warmupStart = Date.now();
    const warmupPromises: Promise<any>[] = [];

    while (Date.now() - warmupStart < warmupTime) {
      warmupPromises.push(
        operation().catch(() => {}) // Ignore warmup errors
      );

      // Limit concurrent warmup requests
      if (warmupPromises.length >= 10) {
        await Promise.all(warmupPromises);
        warmupPromises.length = 0;
      }

      await this.sleep(10); // Small delay between requests
    }

    // Wait for remaining warmup requests
    if (warmupPromises.length > 0) {
      await Promise.all(warmupPromises);
    }
  }

  /**
   * Run main benchmark phase
   */
  private async runMainBenchmark(
    testId: string,
    config: BenchmarkConfig,
    operation: BenchmarkOperation
  ): Promise<BenchmarkTestResult[]> {
    const results: BenchmarkTestResult[] = [];
    const startTime = Date.now();
    const workers: Promise<void>[] = [];

    // Create concurrent workers
    for (let i = 0; i < config.concurrency; i++) {
      workers.push(this.runWorker(testId, config, operation, startTime, results));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    return results;
  }

  /**
   * Run individual benchmark worker
   */
  private async runWorker(
    testId: string,
    config: BenchmarkConfig,
    operation: BenchmarkOperation,
    startTime: number,
    results: BenchmarkTestResult[]
  ): Promise<void> {
    while (this.activeTests.get(testId) && Date.now() - startTime < config.duration) {
      const requestStart = Date.now();

      try {
        const result = await operation();
        const responseTime = Date.now() - requestStart;

        const testResult: BenchmarkTestResult = {
          timestamp: Date.now(),
          responseTime,
          success: result.success,
          error: result.error,
          statusCode: result.statusCode,
          metadata: result.metadata,
        };

        results.push(testResult);

        // Record metrics in the monitoring system
        metricsCollector.recordResponseTime(
          config.name,
          'BENCHMARK',
          responseTime,
          result.statusCode || (result.success ? 200 : 500)
        );
      } catch (error) {
        const responseTime = Date.now() - requestStart;

        results.push({
          timestamp: Date.now(),
          responseTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        metricsCollector.recordResponseTime(config.name, 'BENCHMARK', responseTime, 500);
      }

      // Small delay to prevent overwhelming the system
      await this.sleep(1);
    }
  }

  /**
   * Analyze benchmark results
   */
  private analyzeResults(
    testId: string,
    config: BenchmarkConfig,
    startTime: number,
    endTime: number,
    results: BenchmarkTestResult[]
  ): BenchmarkResult {
    const totalDuration = endTime - startTime;
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const responseTimes = results.map(r => r.responseTime).sort((a, b) => a - b);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
    const minResponseTime = responseTimes[0] || 0;
    const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;

    const throughput = totalRequests / (totalDuration / 1000); // Requests per second
    const errorRate = failedRequests / totalRequests || 0;
    const successRate = successfulRequests / totalRequests || 0;

    // Calculate percentiles
    const percentiles = {
      p50: this.calculatePercentile(responseTimes, 50),
      p75: this.calculatePercentile(responseTimes, 75),
      p90: this.calculatePercentile(responseTimes, 90),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99),
    };

    // Check if benchmark passed
    const failures: string[] = [];
    let passed = true;

    if (config.targets.responseTime && avgResponseTime > config.targets.responseTime) {
      failures.push(
        `Average response time ${avgResponseTime.toFixed(2)}ms exceeds target ${config.targets.responseTime}ms`
      );
      passed = false;
    }

    if (config.targets.throughput && throughput < config.targets.throughput) {
      failures.push(
        `Throughput ${throughput.toFixed(2)} req/s below target ${config.targets.throughput} req/s`
      );
      passed = false;
    }

    if (config.targets.errorRate && errorRate > config.targets.errorRate) {
      failures.push(
        `Error rate ${(errorRate * 100).toFixed(2)}% exceeds target ${(config.targets.errorRate * 100).toFixed(2)}%`
      );
      passed = false;
    }

    if (config.targets.successRate && successRate < config.targets.successRate) {
      failures.push(
        `Success rate ${(successRate * 100).toFixed(2)}% below target ${(config.targets.successRate * 100).toFixed(2)}%`
      );
      passed = false;
    }

    return {
      id: testId,
      config,
      startTime,
      endTime,
      duration: totalDuration,
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        throughput,
        errorRate,
        successRate,
      },
      percentiles,
      results,
      passed,
      failures,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a simple HTTP endpoint benchmark operation
   */
  static createHttpBenchmark(url: string, options: RequestInit = {}): BenchmarkOperation {
    return async () => {
      const startTime = Date.now();

      try {
        const response = await fetch(url, {
          method: 'GET',
          ...options,
        });

        const responseTime = Date.now() - startTime;
        const success = response.ok;

        return {
          success,
          responseTime,
          statusCode: response.status,
          error: success ? undefined : `HTTP ${response.status}: ${response.statusText}`,
          metadata: {
            url,
            method: options.method || 'GET',
            contentLength: response.headers.get('content-length'),
          },
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;

        return {
          success: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Network error',
          metadata: { url, method: options.method || 'GET' },
        };
      }
    };
  }

  /**
   * Create a database query benchmark operation
   */
  static createDatabaseBenchmark(
    queryFn: () => Promise<any>,
    queryName: string = 'database-query'
  ): BenchmarkOperation {
    return async () => {
      const startTime = Date.now();

      try {
        await queryFn();
        const responseTime = Date.now() - startTime;

        return {
          success: true,
          responseTime,
          metadata: { queryName },
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;

        return {
          success: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Database error',
          metadata: { queryName },
        };
      }
    };
  }

  /**
   * Create a cache operation benchmark
   */
  static createCacheBenchmark(
    cacheGet: (key: string) => Promise<any>,
    keyPrefix: string = 'benchmark'
  ): BenchmarkOperation {
    let counter = 0;

    return async () => {
      const key = `${keyPrefix}-${counter++}`;
      const startTime = Date.now();

      try {
        const result = await cacheGet(key);
        const responseTime = Date.now() - startTime;
        const hit = result !== null && result !== undefined;

        // Record cache event in metrics
        metricsCollector.recordCacheEvent(key, hit, responseTime);

        return {
          success: true,
          responseTime,
          metadata: { key, hit },
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;

        return {
          success: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Cache error',
          metadata: { key },
        };
      }
    };
  }

  /**
   * Run a comprehensive system benchmark
   */
  async runSystemBenchmark(): Promise<{
    http: BenchmarkResult;
    database: BenchmarkResult;
    cache: BenchmarkResult;
  }> {
    console.log('Running comprehensive system benchmark...');

    // HTTP endpoint benchmark
    const httpBenchmark = await this.runBenchmark(
      {
        name: 'HTTP Endpoints',
        description: 'Test HTTP endpoint response times and throughput',
        duration: 30000, // 30 seconds
        concurrency: 10,
        targets: {
          responseTime: 500,
          throughput: 100,
          errorRate: 0.01,
        },
      },
      PerformanceBenchmark.createHttpBenchmark('/api/health')
    );

    // Database benchmark (mock)
    const databaseBenchmark = await this.runBenchmark(
      {
        name: 'Database Queries',
        description: 'Test database query performance',
        duration: 20000, // 20 seconds
        concurrency: 5,
        targets: {
          responseTime: 100,
          errorRate: 0.001,
        },
      },
      PerformanceBenchmark.createDatabaseBenchmark(
        () => new Promise(resolve => setTimeout(resolve, Math.random() * 50)),
        'select-benchmark'
      )
    );

    // Cache benchmark (mock)
    const cacheBenchmark = await this.runBenchmark(
      {
        name: 'Cache Operations',
        description: 'Test cache hit rates and response times',
        duration: 15000, // 15 seconds
        concurrency: 20,
        targets: {
          responseTime: 10,
          errorRate: 0.001,
        },
      },
      PerformanceBenchmark.createCacheBenchmark(
        key =>
          new Promise(resolve =>
            setTimeout(
              () => resolve(Math.random() > 0.2 ? `value-${key}` : null),
              Math.random() * 5
            )
          )
      )
    );

    return {
      http: httpBenchmark,
      database: databaseBenchmark,
      cache: cacheBenchmark,
    };
  }
}

// Global instance
export const performanceBenchmark = new PerformanceBenchmark();
