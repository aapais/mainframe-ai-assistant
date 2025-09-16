/**
 * Comprehensive Performance Testing Suite
 *
 * Load testing, stress testing, and performance regression testing
 * for the search system with SLA compliance verification.
 */

import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';
import { SearchService } from '../../src/services/SearchService';
import { PerformanceOptimizer } from '../../src/optimization/PerformanceOptimizer';

interface LoadTestConfig {
  duration: number; // Test duration in seconds
  concurrency: number; // Number of concurrent users
  rampUpTime: number; // Ramp up time in seconds
  queries: string[]; // Test queries
  targetThroughput?: number; // Target QPS
}

interface StressTestConfig {
  maxConcurrency: number;
  stepSize: number;
  stepDuration: number;
  memoryThreshold: number; // MB
  responseTimeThreshold: number; // ms
}

interface PerformanceMetrics {
  throughput: number; // Queries per second
  responseTime: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  errorRate: number;
  slaCompliance: number;
  cpuUsage: {
    mean: number;
    peak: number;
  };
}

interface TestResult {
  testName: string;
  config: any;
  metrics: PerformanceMetrics;
  passed: boolean;
  failures: string[];
  duration: number;
  timestamp: Date;
}

export class PerformanceTestSuite {
  private db: Database.Database;
  private searchService: SearchService;
  private optimizer: PerformanceOptimizer;
  private testResults: TestResult[] = [];

  // SLA thresholds
  private readonly SLA_THRESHOLDS = {
    AUTOCOMPLETE: 100, // ms
    SEARCH: 1000, // ms
    AVAILABILITY: 99.9, // %
    MEMORY: 500, // MB
    ERROR_RATE: 0.05 // 5%
  };

  constructor(database: Database.Database) {
    this.db = database;
    this.searchService = new SearchService();
    this.optimizer = new PerformanceOptimizer(database);
    this.setupTestData();
  }

  /**
   * Run complete performance test suite
   */
  async runFullTestSuite(): Promise<{
    results: TestResult[];
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
      slaCompliance: number;
      recommendations: string[];
    };
  }> {
    console.log('🚀 Starting comprehensive performance test suite...');

    const startTime = performance.now();
    const results: TestResult[] = [];

    // 1. Baseline performance test
    results.push(await this.runBaselineTest());

    // 2. Load testing
    results.push(await this.runLoadTest({
      duration: 60,
      concurrency: 10,
      rampUpTime: 10,
      queries: this.generateTestQueries(50),
      targetThroughput: 15
    }));

    // 3. Stress testing
    results.push(await this.runStressTest({
      maxConcurrency: 100,
      stepSize: 10,
      stepDuration: 30,
      memoryThreshold: this.SLA_THRESHOLDS.MEMORY,
      responseTimeThreshold: this.SLA_THRESHOLDS.SEARCH
    }));

    // 4. Autocomplete performance test
    results.push(await this.runAutocompleteTest());

    // 5. Memory leak test
    results.push(await this.runMemoryLeakTest());

    // 6. Database stress test
    results.push(await this.runDatabaseStressTest());

    // 7. Cache performance test
    results.push(await this.runCachePerformanceTest());

    // 8. Bundle size test
    results.push(await this.runBundleSizeTest());

    this.testResults = results;

    const totalDuration = performance.now() - startTime;
    const summary = this.generateTestSummary(results);

    console.log(`✅ Performance test suite completed in ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📊 Results: ${summary.passed}/${summary.totalTests} tests passed`);
    console.log(`🎯 Overall SLA compliance: ${(summary.slaCompliance * 100).toFixed(1)}%`);

    return { results, summary };
  }

  /**
   * Baseline performance test
   */
  async runBaselineTest(): Promise<TestResult> {
    console.log('📊 Running baseline performance test...');

    const startTime = performance.now();
    const responseTimes: number[] = [];
    const queries = this.generateTestQueries(20);
    const entries = await this.getTestEntries();

    let errors = 0;

    for (const query of queries) {
      try {
        const queryStart = performance.now();
        await this.searchService.search(query, entries);
        const queryTime = performance.now() - queryStart;
        responseTimes.push(queryTime);
      } catch (error) {
        errors++;
      }
    }

    const metrics = this.calculateMetrics(responseTimes, errors, queries.length);
    const passed = this.evaluateBaslinePerformance(metrics);

    return {
      testName: 'Baseline Performance',
      config: { queries: queries.length },
      metrics,
      passed,
      failures: passed ? [] : this.getPerformanceFailures(metrics),
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Load testing with sustained concurrent users
   */
  async runLoadTest(config: LoadTestConfig): Promise<TestResult> {
    console.log(`🔄 Running load test: ${config.concurrency} users for ${config.duration}s...`);

    const startTime = performance.now();
    const responseTimes: number[] = [];
    const entries = await this.getTestEntries();

    let totalQueries = 0;
    let errors = 0;
    let activeUsers = 0;

    const results = await new Promise<{ responseTimes: number[]; totalQueries: number; errors: number }>((resolve) => {
      const endTime = startTime + (config.duration * 1000);
      const rampUpInterval = (config.rampUpTime * 1000) / config.concurrency;

      const userIntervals: NodeJS.Timeout[] = [];
      let completed = 0;

      const checkCompletion = () => {
        if (performance.now() >= endTime && completed === config.concurrency) {
          userIntervals.forEach(clearInterval);
          resolve({ responseTimes, totalQueries, errors });
        }
      };

      // Ramp up users gradually
      for (let i = 0; i < config.concurrency; i++) {
        setTimeout(() => {
          activeUsers++;
          console.log(`👤 User ${i + 1}/${config.concurrency} started`);

          const userInterval = setInterval(async () => {
            if (performance.now() >= endTime) {
              clearInterval(userInterval);
              completed++;
              checkCompletion();
              return;
            }

            try {
              const query = config.queries[Math.floor(Math.random() * config.queries.length)];
              const queryStart = performance.now();
              await this.searchService.search(query, entries);
              const queryTime = performance.now() - queryStart;

              responseTimes.push(queryTime);
              totalQueries++;
            } catch (error) {
              errors++;
              totalQueries++;
            }
          }, 1000 + Math.random() * 1000); // Random interval 1-2s

          userIntervals.push(userInterval);
        }, i * rampUpInterval);
      }
    });

    const metrics = this.calculateMetrics(results.responseTimes, results.errors, results.totalQueries);
    const passed = this.evaluateLoadTestPerformance(metrics, config);

    return {
      testName: 'Load Test',
      config,
      metrics,
      passed,
      failures: passed ? [] : this.getLoadTestFailures(metrics, config),
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Stress testing with increasing load
   */
  async runStressTest(config: StressTestConfig): Promise<TestResult> {
    console.log(`💪 Running stress test: 0 → ${config.maxConcurrency} users...`);

    const startTime = performance.now();
    const results: Array<{ concurrency: number; metrics: PerformanceMetrics }> = [];
    const entries = await this.getTestEntries();
    const queries = this.generateTestQueries(20);

    let breakingPoint = 0;

    for (let concurrency = config.stepSize; concurrency <= config.maxConcurrency; concurrency += config.stepSize) {
      console.log(`📈 Testing with ${concurrency} concurrent users...`);

      const stepResults = await this.runConcurrentQueries(
        concurrency,
        config.stepDuration,
        queries,
        entries
      );

      const stepMetrics = this.calculateMetrics(
        stepResults.responseTimes,
        stepResults.errors,
        stepResults.totalQueries
      );

      results.push({ concurrency, metrics: stepMetrics });

      // Check if we've hit performance degradation
      if (stepMetrics.responseTime.p95 > config.responseTimeThreshold ||
          stepMetrics.memoryUsage.peak > config.memoryThreshold ||
          stepMetrics.errorRate > this.SLA_THRESHOLDS.ERROR_RATE) {
        breakingPoint = concurrency;
        console.log(`⚠️ Performance degradation detected at ${concurrency} concurrent users`);
        break;
      }

      // Brief pause between steps
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const overallMetrics = this.aggregateStressTestMetrics(results);
    const passed = breakingPoint === 0 || breakingPoint >= config.maxConcurrency * 0.8;

    return {
      testName: 'Stress Test',
      config: { ...config, breakingPoint },
      metrics: overallMetrics,
      passed,
      failures: passed ? [] : [`Performance degraded at ${breakingPoint} users`],
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Autocomplete performance test
   */
  async runAutocompleteTest(): Promise<TestResult> {
    console.log('⚡ Testing autocomplete performance...');

    const startTime = performance.now();
    const responseTimes: number[] = [];
    const prefixes = ['js', 'vs', 'db', 'co', 'ab', 'er', 'fi', 'da', 'sy', 'me'];

    let errors = 0;

    for (const prefix of prefixes) {
      for (let i = 0; i < 10; i++) {
        try {
          const queryStart = performance.now();
          await this.searchService.suggest(prefix + 'x'.repeat(i), 10);
          const queryTime = performance.now() - queryStart;
          responseTimes.push(queryTime);
        } catch (error) {
          errors++;
        }
      }
    }

    const metrics = this.calculateMetrics(responseTimes, errors, prefixes.length * 10);
    const passed = metrics.responseTime.p95 <= this.SLA_THRESHOLDS.AUTOCOMPLETE;

    return {
      testName: 'Autocomplete Performance',
      config: { prefixes: prefixes.length, iterations: 10 },
      metrics,
      passed,
      failures: passed ? [] : [`P95 response time ${metrics.responseTime.p95.toFixed(1)}ms exceeds ${this.SLA_THRESHOLDS.AUTOCOMPLETE}ms threshold`],
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Memory leak detection test
   */
  async runMemoryLeakTest(): Promise<TestResult> {
    console.log('🧠 Testing for memory leaks...');

    const startTime = performance.now();
    const memorySnapshots: number[] = [];
    const queries = this.generateTestQueries(100);
    const entries = await this.getTestEntries();

    // Take initial memory snapshot
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    memorySnapshots.push(initialMemory);

    // Run queries in batches and monitor memory
    const batchSize = 20;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      // Run batch
      await Promise.all(
        batch.map(query => this.searchService.search(query, entries))
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Take memory snapshot
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      memorySnapshots.push(currentMemory);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryGrowth = finalMemory - initialMemory;
    const maxMemory = Math.max(...memorySnapshots);

    // Detect memory leak patterns
    const growthRate = memoryGrowth / (queries.length / batchSize);
    const hasLeak = growthRate > 5; // More than 5MB growth per batch

    const metrics: PerformanceMetrics = {
      throughput: queries.length / ((performance.now() - startTime) / 1000),
      responseTime: { mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 },
      memoryUsage: {
        initial: initialMemory,
        peak: maxMemory,
        final: finalMemory
      },
      errorRate: 0,
      slaCompliance: hasLeak ? 0 : 1,
      cpuUsage: { mean: 0, peak: 0 }
    };

    return {
      testName: 'Memory Leak Detection',
      config: { queries: queries.length, batchSize },
      metrics,
      passed: !hasLeak && maxMemory < this.SLA_THRESHOLDS.MEMORY,
      failures: hasLeak ? [`Memory leak detected: ${growthRate.toFixed(1)}MB growth per batch`] : [],
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Database performance stress test
   */
  async runDatabaseStressTest(): Promise<TestResult> {
    console.log('💾 Testing database performance under stress...');

    const startTime = performance.now();
    const responseTimes: number[] = [];
    const queries = this.generateTestQueries(50);
    const entries = await this.getTestEntries();

    // Simulate high database load
    const concurrentQueries = 20;
    const iterations = 5;
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const promises: Promise<void>[] = [];

      for (let j = 0; j < concurrentQueries; j++) {
        const query = queries[Math.floor(Math.random() * queries.length)];

        promises.push(
          (async () => {
            try {
              const queryStart = performance.now();
              await this.searchService.search(query, entries);
              const queryTime = performance.now() - queryStart;
              responseTimes.push(queryTime);
            } catch (error) {
              errors++;
            }
          })()
        );
      }

      await Promise.all(promises);

      // Brief pause between iterations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const metrics = this.calculateMetrics(responseTimes, errors, concurrentQueries * iterations);
    const passed = metrics.responseTime.p95 <= this.SLA_THRESHOLDS.SEARCH && metrics.errorRate <= this.SLA_THRESHOLDS.ERROR_RATE;

    return {
      testName: 'Database Stress Test',
      config: { concurrentQueries, iterations },
      metrics,
      passed,
      failures: passed ? [] : this.getDatabaseStressFailures(metrics),
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Cache performance evaluation
   */
  async runCachePerformanceTest(): Promise<TestResult> {
    console.log('💾 Testing cache performance...');

    const startTime = performance.now();
    const queries = this.generateTestQueries(20);
    const entries = await this.getTestEntries();

    // First run - populate cache
    const firstRunTimes: number[] = [];
    for (const query of queries) {
      const queryStart = performance.now();
      await this.searchService.search(query, entries);
      firstRunTimes.push(performance.now() - queryStart);
    }

    // Second run - should hit cache
    const secondRunTimes: number[] = [];
    for (const query of queries) {
      const queryStart = performance.now();
      await this.searchService.search(query, entries);
      secondRunTimes.push(performance.now() - queryStart);
    }

    const firstRunAvg = firstRunTimes.reduce((a, b) => a + b) / firstRunTimes.length;
    const secondRunAvg = secondRunTimes.reduce((a, b) => a + b) / secondRunTimes.length;
    const improvement = (firstRunAvg - secondRunAvg) / firstRunAvg;

    const metrics = this.calculateMetrics(secondRunTimes, 0, queries.length);
    const passed = improvement > 0.3; // At least 30% improvement

    return {
      testName: 'Cache Performance',
      config: { queries: queries.length, expectedImprovement: 0.3 },
      metrics,
      passed,
      failures: passed ? [] : [`Cache improvement ${(improvement * 100).toFixed(1)}% below expected 30%`],
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Bundle size and loading performance
   */
  async runBundleSizeTest(): Promise<TestResult> {
    console.log('📦 Testing bundle size and loading performance...');

    const startTime = performance.now();

    // Simulate bundle analysis
    const bundleAnalysis = await this.optimizer.analyzeBundleSize();
    const maxBundleSize = 5 * 1024 * 1024; // 5MB limit

    const metrics: PerformanceMetrics = {
      throughput: 0,
      responseTime: { mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 },
      memoryUsage: {
        initial: bundleAnalysis.totalSize / 1024 / 1024,
        peak: bundleAnalysis.totalSize / 1024 / 1024,
        final: bundleAnalysis.totalSize / 1024 / 1024
      },
      errorRate: 0,
      slaCompliance: bundleAnalysis.totalSize <= maxBundleSize ? 1 : 0,
      cpuUsage: { mean: 0, peak: 0 }
    };

    const passed = bundleAnalysis.totalSize <= maxBundleSize;

    return {
      testName: 'Bundle Size Test',
      config: { maxBundleSize: maxBundleSize / 1024 / 1024 },
      metrics,
      passed,
      failures: passed ? [] : [`Bundle size ${(bundleAnalysis.totalSize / 1024 / 1024).toFixed(1)}MB exceeds ${maxBundleSize / 1024 / 1024}MB limit`],
      duration: performance.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Generate performance regression report
   */
  generateRegressionReport(baselineResults: TestResult[]): {
    regressions: Array<{
      testName: string;
      metric: string;
      baseline: number;
      current: number;
      change: number;
    }>;
    improvements: Array<{
      testName: string;
      metric: string;
      baseline: number;
      current: number;
      change: number;
    }>;
  } {
    const regressions: any[] = [];
    const improvements: any[] = [];

    this.testResults.forEach((current, index) => {
      const baseline = baselineResults[index];
      if (!baseline || baseline.testName !== current.testName) return;

      const comparisons = [
        { metric: 'P95 Response Time', baseline: baseline.metrics.responseTime.p95, current: current.metrics.responseTime.p95 },
        { metric: 'Mean Response Time', baseline: baseline.metrics.responseTime.mean, current: current.metrics.responseTime.mean },
        { metric: 'Throughput', baseline: baseline.metrics.throughput, current: current.metrics.throughput },
        { metric: 'Memory Usage', baseline: baseline.metrics.memoryUsage.peak, current: current.metrics.memoryUsage.peak },
        { metric: 'Error Rate', baseline: baseline.metrics.errorRate, current: current.metrics.errorRate }
      ];

      comparisons.forEach(comp => {
        const change = ((comp.current - comp.baseline) / comp.baseline) * 100;

        if (Math.abs(change) > 5) { // Significant change threshold
          if ((comp.metric === 'Throughput' && change > 0) ||
              (comp.metric !== 'Throughput' && change < 0)) {
            improvements.push({
              testName: current.testName,
              ...comp,
              change
            });
          } else {
            regressions.push({
              testName: current.testName,
              ...comp,
              change
            });
          }
        }
      });
    });

    return { regressions, improvements };
  }

  // Private helper methods

  private async setupTestData(): Promise<void> {
    // Create test data tables and populate with sample entries
    console.log('📋 Setting up performance test data...');
  }

  private generateTestQueries(count: number): string[] {
    const baseQueries = [
      'jcl error', 'vsam status', 'db2 sqlcode', 'cobol abend',
      'cics transaction', 'ims database', 'batch job failure',
      'tso command', 'ispf panel', 'dataset allocation',
      'catalog error', 'racf security', 'sort utility',
      'ftp transfer', 'tcp/ip connection', 's0c7 data exception'
    ];

    const queries: string[] = [];
    for (let i = 0; i < count; i++) {
      const base = baseQueries[i % baseQueries.length];
      const variation = Math.floor(Math.random() * 5);

      switch (variation) {
        case 0: queries.push(base); break;
        case 1: queries.push(base + ' problem'); break;
        case 2: queries.push('how to fix ' + base); break;
        case 3: queries.push(base.split(' ')[0]); break;
        case 4: queries.push(base + ' solution'); break;
      }
    }

    return queries;
  }

  private async getTestEntries(): Promise<any[]> {
    // Return mock KB entries for testing
    return Array.from({ length: 100 }, (_, i) => ({
      id: `test-${i}`,
      title: `Test Entry ${i}`,
      problem: `Test problem description ${i}`,
      solution: `Test solution steps ${i}`,
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'][i % 5],
      tags: [`tag${i % 10}`, `category${i % 3}`],
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: Math.floor(Math.random() * 50),
      success_count: Math.floor(Math.random() * 40),
      failure_count: Math.floor(Math.random() * 10)
    }));
  }

  private async runConcurrentQueries(
    concurrency: number,
    duration: number,
    queries: string[],
    entries: any[]
  ): Promise<{ responseTimes: number[]; totalQueries: number; errors: number }> {
    const responseTimes: number[] = [];
    let totalQueries = 0;
    let errors = 0;

    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        (async () => {
          const endTime = performance.now() + (duration * 1000);

          while (performance.now() < endTime) {
            try {
              const query = queries[Math.floor(Math.random() * queries.length)];
              const queryStart = performance.now();
              await this.searchService.search(query, entries);
              const queryTime = performance.now() - queryStart;

              responseTimes.push(queryTime);
              totalQueries++;
            } catch (error) {
              errors++;
              totalQueries++;
            }

            // Small delay between queries
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
          }
        })()
      );
    }

    await Promise.all(promises);

    return { responseTimes, totalQueries, errors };
  }

  private calculateMetrics(responseTimes: number[], errors: number, totalQueries: number): PerformanceMetrics {
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);

    const metrics: PerformanceMetrics = {
      throughput: totalQueries / (Math.max(...responseTimes, 1000) / 1000),
      responseTime: {
        mean: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
        p50: this.percentile(sortedTimes, 50),
        p95: this.percentile(sortedTimes, 95),
        p99: this.percentile(sortedTimes, 99),
        min: Math.min(...responseTimes) || 0,
        max: Math.max(...responseTimes) || 0
      },
      memoryUsage: {
        initial: 0,
        peak: process.memoryUsage().heapUsed / 1024 / 1024,
        final: process.memoryUsage().heapUsed / 1024 / 1024
      },
      errorRate: errors / totalQueries || 0,
      slaCompliance: responseTimes.filter(t => t <= this.SLA_THRESHOLDS.SEARCH).length / responseTimes.length || 0,
      cpuUsage: { mean: 50, peak: 75 } // Simulated values
    };

    return metrics;
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private evaluateBaslinePerformance(metrics: PerformanceMetrics): boolean {
    return metrics.responseTime.p95 <= this.SLA_THRESHOLDS.SEARCH &&
           metrics.errorRate <= this.SLA_THRESHOLDS.ERROR_RATE &&
           metrics.memoryUsage.peak <= this.SLA_THRESHOLDS.MEMORY;
  }

  private evaluateLoadTestPerformance(metrics: PerformanceMetrics, config: LoadTestConfig): boolean {
    return metrics.responseTime.p95 <= this.SLA_THRESHOLDS.SEARCH &&
           metrics.errorRate <= this.SLA_THRESHOLDS.ERROR_RATE &&
           metrics.slaCompliance >= 0.95 &&
           (!config.targetThroughput || metrics.throughput >= config.targetThroughput * 0.9);
  }

  private getPerformanceFailures(metrics: PerformanceMetrics): string[] {
    const failures: string[] = [];

    if (metrics.responseTime.p95 > this.SLA_THRESHOLDS.SEARCH) {
      failures.push(`P95 response time ${metrics.responseTime.p95.toFixed(1)}ms exceeds ${this.SLA_THRESHOLDS.SEARCH}ms SLA`);
    }

    if (metrics.errorRate > this.SLA_THRESHOLDS.ERROR_RATE) {
      failures.push(`Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds ${this.SLA_THRESHOLDS.ERROR_RATE * 100}% threshold`);
    }

    if (metrics.memoryUsage.peak > this.SLA_THRESHOLDS.MEMORY) {
      failures.push(`Memory usage ${metrics.memoryUsage.peak.toFixed(1)}MB exceeds ${this.SLA_THRESHOLDS.MEMORY}MB limit`);
    }

    return failures;
  }

  private getLoadTestFailures(metrics: PerformanceMetrics, config: LoadTestConfig): string[] {
    const failures = this.getPerformanceFailures(metrics);

    if (metrics.slaCompliance < 0.95) {
      failures.push(`SLA compliance ${(metrics.slaCompliance * 100).toFixed(1)}% below 95% requirement`);
    }

    if (config.targetThroughput && metrics.throughput < config.targetThroughput * 0.9) {
      failures.push(`Throughput ${metrics.throughput.toFixed(1)} QPS below target ${config.targetThroughput} QPS`);
    }

    return failures;
  }

  private getDatabaseStressFailures(metrics: PerformanceMetrics): string[] {
    const failures: string[] = [];

    if (metrics.responseTime.p95 > this.SLA_THRESHOLDS.SEARCH) {
      failures.push(`Database queries too slow under stress: ${metrics.responseTime.p95.toFixed(1)}ms P95`);
    }

    if (metrics.errorRate > this.SLA_THRESHOLDS.ERROR_RATE) {
      failures.push(`Database errors under stress: ${(metrics.errorRate * 100).toFixed(1)}% error rate`);
    }

    return failures;
  }

  private aggregateStressTestMetrics(results: Array<{ concurrency: number; metrics: PerformanceMetrics }>): PerformanceMetrics {
    // Return metrics from the highest successful concurrency level
    const lastResult = results[results.length - 1];
    return lastResult.metrics;
  }

  private generateTestSummary(results: TestResult[]): {
    totalTests: number;
    passed: number;
    failed: number;
    slaCompliance: number;
    recommendations: string[];
  } {
    const totalTests = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = totalTests - passed;

    const avgSlaCompliance = results.reduce((sum, r) => sum + r.metrics.slaCompliance, 0) / totalTests;

    const recommendations: string[] = [];

    if (avgSlaCompliance < 0.95) {
      recommendations.push('Overall SLA compliance below target - review performance optimizations');
    }

    const avgResponseTime = results.reduce((sum, r) => sum + r.metrics.responseTime.p95, 0) / totalTests;
    if (avgResponseTime > this.SLA_THRESHOLDS.SEARCH * 0.8) {
      recommendations.push('Response times approaching SLA limits - consider query optimization');
    }

    if (failed > 0) {
      recommendations.push('Some tests failed - review individual test results for specific issues');
    }

    return {
      totalTests,
      passed,
      failed,
      slaCompliance: avgSlaCompliance,
      recommendations
    };
  }
}