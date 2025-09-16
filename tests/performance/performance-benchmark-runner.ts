/**
 * Performance Benchmark Runner
 * Automated system for running performance benchmarks, detecting regressions,
 * and generating performance reports for UI components
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Performance benchmark configuration
interface BenchmarkConfig {
  name: string;
  description: string;
  threshold: number; // milliseconds
  warningThreshold: number; // milliseconds
  samples: number;
  warmupRuns: number;
  maxExecutionTime: number; // milliseconds
  memoryThreshold: number; // MB
}

// Performance measurement results
interface PerformanceMeasurement {
  name: string;
  duration: number;
  memory: number;
  timestamp: number;
  samples: number[];
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
    standardDeviation: number;
  };
  passed: boolean;
  warning: boolean;
  metadata?: Record<string, any>;
}

// Regression detection results
interface RegressionAnalysis {
  hasRegression: boolean;
  severityLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  performanceChange: number; // percentage change
  baselineMean: number;
  currentMean: number;
  confidenceLevel: number;
  recommendation: string;
}

// Performance report structure
interface PerformanceReport {
  timestamp: number;
  summary: {
    totalBenchmarks: number;
    passedBenchmarks: number;
    failedBenchmarks: number;
    warningBenchmarks: number;
    averagePerformance: number;
    regressionCount: number;
  };
  benchmarks: PerformanceMeasurement[];
  regressions: Array<{
    benchmark: string;
    analysis: RegressionAnalysis;
  }>;
  recommendations: string[];
  metadata: {
    environment: string;
    nodeVersion: string;
    platform: string;
    cpuInfo?: any;
    memoryInfo?: any;
  };
}

export class PerformanceBenchmarkRunner {
  private baselines: Map<string, PerformanceMeasurement> = new Map();
  private currentResults: Map<string, PerformanceMeasurement> = new Map();
  private config: Map<string, BenchmarkConfig> = new Map();
  private reportPath: string;

  constructor(reportPath: string = './performance-reports') {
    this.reportPath = reportPath;
    this.loadBaselines();
    this.setupDefaultConfigs();
  }

  /**
   * Setup default performance configurations for UI components
   */
  private setupDefaultConfigs(): void {
    const defaultConfigs: BenchmarkConfig[] = [
      {
        name: 'SearchInput-render',
        description: 'SearchInput component initial render performance',
        threshold: 100,
        warningThreshold: 75,
        samples: 20,
        warmupRuns: 5,
        maxExecutionTime: 5000,
        memoryThreshold: 50,
      },
      {
        name: 'SearchInput-interaction',
        description: 'SearchInput typing and interaction performance',
        threshold: 50,
        warningThreshold: 35,
        samples: 30,
        warmupRuns: 5,
        maxExecutionTime: 3000,
        memoryThreshold: 25,
      },
      {
        name: 'ResultsList-render-small',
        description: 'ResultsList rendering with small dataset (10 items)',
        threshold: 100,
        warningThreshold: 75,
        samples: 15,
        warmupRuns: 3,
        maxExecutionTime: 2000,
        memoryThreshold: 30,
      },
      {
        name: 'ResultsList-render-large',
        description: 'ResultsList rendering with large dataset (100+ items)',
        threshold: 300,
        warningThreshold: 200,
        samples: 10,
        warmupRuns: 2,
        maxExecutionTime: 10000,
        memoryThreshold: 100,
      },
      {
        name: 'ResultsList-scroll',
        description: 'ResultsList scrolling performance',
        threshold: 16.67, // 60 FPS target
        warningThreshold: 25,
        samples: 50,
        warmupRuns: 10,
        maxExecutionTime: 5000,
        memoryThreshold: 10,
      },
      {
        name: 'EntryDetail-render',
        description: 'EntryDetail component render performance',
        threshold: 100,
        warningThreshold: 75,
        samples: 15,
        warmupRuns: 3,
        maxExecutionTime: 2000,
        memoryThreshold: 40,
      },
      {
        name: 'AppLayout-render',
        description: 'AppLayout component render performance',
        threshold: 100,
        warningThreshold: 75,
        samples: 15,
        warmupRuns: 3,
        maxExecutionTime: 2000,
        memoryThreshold: 35,
      },
      {
        name: 'Component-lifecycle',
        description: 'Component mount/unmount lifecycle performance',
        threshold: 50,
        warningThreshold: 35,
        samples: 25,
        warmupRuns: 5,
        maxExecutionTime: 3000,
        memoryThreshold: 20,
      },
    ];

    defaultConfigs.forEach(config => {
      this.config.set(config.name, config);
    });
  }

  /**
   * Run a single performance benchmark
   */
  async runBenchmark(
    name: string,
    benchmarkFn: () => Promise<void> | void,
    customConfig?: Partial<BenchmarkConfig>
  ): Promise<PerformanceMeasurement> {
    const config = this.getConfig(name, customConfig);
    const samples: number[] = [];
    let totalMemory = 0;

    console.log(`🏃 Running benchmark: ${config.name}`);
    console.log(`📊 Configuration: ${config.samples} samples, ${config.warmupRuns} warmup runs`);

    // Warmup runs
    for (let i = 0; i < config.warmupRuns; i++) {
      await this.executeBenchmark(benchmarkFn);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    // Actual benchmark runs
    for (let i = 0; i < config.samples; i++) {
      const memoryBefore = this.getMemoryUsage();

      const startTime = performance.now();
      await this.executeBenchmark(benchmarkFn);
      const duration = performance.now() - startTime;

      const memoryAfter = this.getMemoryUsage();
      const memoryUsed = (memoryAfter - memoryBefore) / (1024 * 1024); // MB

      samples.push(duration);
      totalMemory += memoryUsed;

      // Check for timeout
      if (duration > config.maxExecutionTime) {
        console.warn(`⚠️ Benchmark ${name} exceeded maximum execution time`);
        break;
      }

      // Small delay to prevent overwhelming
      await this.sleep(10);
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(samples);
    const averageMemory = totalMemory / samples.length;

    const result: PerformanceMeasurement = {
      name: config.name,
      duration: statistics.mean,
      memory: averageMemory,
      timestamp: Date.now(),
      samples,
      statistics,
      passed: statistics.mean <= config.threshold && averageMemory <= config.memoryThreshold,
      warning: statistics.mean > config.warningThreshold || averageMemory > (config.memoryThreshold * 0.8),
      metadata: {
        description: config.description,
        threshold: config.threshold,
        warningThreshold: config.warningThreshold,
        memoryThreshold: config.memoryThreshold,
        sampleCount: samples.length,
      },
    };

    // Store result
    this.currentResults.set(name, result);

    // Log results
    this.logBenchmarkResult(result);

    return result;
  }

  /**
   * Run multiple benchmarks in sequence
   */
  async runBenchmarkSuite(
    benchmarks: Array<{
      name: string;
      fn: () => Promise<void> | void;
      config?: Partial<BenchmarkConfig>;
    }>
  ): Promise<PerformanceMeasurement[]> {
    const results: PerformanceMeasurement[] = [];

    console.log(`🎯 Starting benchmark suite with ${benchmarks.length} benchmarks`);

    for (const benchmark of benchmarks) {
      try {
        const result = await this.runBenchmark(benchmark.name, benchmark.fn, benchmark.config);
        results.push(result);
      } catch (error) {
        console.error(`❌ Benchmark ${benchmark.name} failed:`, error);

        // Create error result
        const errorResult: PerformanceMeasurement = {
          name: benchmark.name,
          duration: 0,
          memory: 0,
          timestamp: Date.now(),
          samples: [],
          statistics: {
            min: 0,
            max: 0,
            mean: 0,
            median: 0,
            p95: 0,
            p99: 0,
            standardDeviation: 0,
          },
          passed: false,
          warning: false,
          metadata: { error: error.message },
        };
        results.push(errorResult);
      }

      // Cleanup between benchmarks
      if (global.gc) {
        global.gc();
      }
      await this.sleep(100);
    }

    console.log(`✅ Benchmark suite completed`);
    return results;
  }

  /**
   * Detect performance regressions by comparing with baselines
   */
  analyzeRegressions(): Array<{ benchmark: string; analysis: RegressionAnalysis }> {
    const regressions: Array<{ benchmark: string; analysis: RegressionAnalysis }> = [];

    for (const [name, current] of this.currentResults) {
      const baseline = this.baselines.get(name);

      if (!baseline) {
        console.log(`📊 No baseline found for ${name}, creating new baseline`);
        this.baselines.set(name, current);
        continue;
      }

      const analysis = this.analyzeRegression(baseline, current);

      if (analysis.hasRegression) {
        regressions.push({ benchmark: name, analysis });
      }

      // Update baseline if current performance is better
      if (current.statistics.mean < baseline.statistics.mean * 0.95) {
        console.log(`📈 Performance improvement detected for ${name}, updating baseline`);
        this.baselines.set(name, current);
      }
    }

    return regressions;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(
    results?: PerformanceMeasurement[],
    includeRegressionAnalysis: boolean = true
  ): Promise<PerformanceReport> {
    const benchmarkResults = results || Array.from(this.currentResults.values());
    const regressions = includeRegressionAnalysis ? this.analyzeRegressions() : [];

    const report: PerformanceReport = {
      timestamp: Date.now(),
      summary: {
        totalBenchmarks: benchmarkResults.length,
        passedBenchmarks: benchmarkResults.filter(r => r.passed).length,
        failedBenchmarks: benchmarkResults.filter(r => !r.passed).length,
        warningBenchmarks: benchmarkResults.filter(r => r.warning).length,
        averagePerformance: benchmarkResults.length > 0
          ? benchmarkResults.reduce((sum, r) => sum + r.duration, 0) / benchmarkResults.length
          : 0,
        regressionCount: regressions.length,
      },
      benchmarks: benchmarkResults,
      regressions,
      recommendations: this.generateRecommendations(benchmarkResults, regressions),
      metadata: {
        environment: process.env.NODE_ENV || 'unknown',
        nodeVersion: process.version,
        platform: process.platform,
        cpuInfo: this.getCPUInfo(),
        memoryInfo: this.getMemoryInfo(),
      },
    };

    // Save report
    await this.saveReport(report);

    return report;
  }

  /**
   * Save performance baselines for future comparisons
   */
  async saveBaselines(): Promise<void> {
    try {
      await fs.mkdir(this.reportPath, { recursive: true });

      const baselinesData = Object.fromEntries(this.baselines);
      const filePath = path.join(this.reportPath, 'performance-baselines.json');

      await fs.writeFile(filePath, JSON.stringify(baselinesData, null, 2));
      console.log(`💾 Baselines saved to ${filePath}`);
    } catch (error) {
      console.error('Failed to save baselines:', error);
    }
  }

  /**
   * Load performance baselines from previous runs
   */
  private async loadBaselines(): Promise<void> {
    try {
      const filePath = path.join(this.reportPath, 'performance-baselines.json');
      const data = await fs.readFile(filePath, 'utf8');
      const baselinesData = JSON.parse(data);

      this.baselines = new Map(Object.entries(baselinesData));
      console.log(`📥 Loaded ${this.baselines.size} performance baselines`);
    } catch (error) {
      console.log('📊 No existing baselines found, will create new ones');
    }
  }

  /**
   * Execute a benchmark function with error handling
   */
  private async executeBenchmark(fn: () => Promise<void> | void): Promise<void> {
    try {
      const result = fn();
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      throw new Error(`Benchmark execution failed: ${error.message}`);
    }
  }

  /**
   * Calculate statistical measures for benchmark samples
   */
  private calculateStatistics(samples: number[]) {
    if (samples.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        standardDeviation: 0,
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;

    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      standardDeviation,
    };
  }

  /**
   * Analyze regression between baseline and current performance
   */
  private analyzeRegression(baseline: PerformanceMeasurement, current: PerformanceMeasurement): RegressionAnalysis {
    const performanceChange = ((current.statistics.mean - baseline.statistics.mean) / baseline.statistics.mean) * 100;

    // Statistical significance test (simplified t-test)
    const pooledStdDev = Math.sqrt(
      (baseline.statistics.standardDeviation ** 2 + current.statistics.standardDeviation ** 2) / 2
    );
    const tStatistic = Math.abs(current.statistics.mean - baseline.statistics.mean) /
      (pooledStdDev * Math.sqrt(2 / Math.min(baseline.samples.length, current.samples.length)));

    const confidenceLevel = Math.min(tStatistic / 2.57, 1) * 100; // Simplified confidence calculation

    let severityLevel: RegressionAnalysis['severityLevel'] = 'none';
    let hasRegression = false;

    if (performanceChange > 5) {
      hasRegression = true;
      if (performanceChange > 50) severityLevel = 'critical';
      else if (performanceChange > 25) severityLevel = 'high';
      else if (performanceChange > 15) severityLevel = 'medium';
      else severityLevel = 'low';
    }

    const recommendation = this.generateRegressionRecommendation(performanceChange, severityLevel);

    return {
      hasRegression,
      severityLevel,
      performanceChange,
      baselineMean: baseline.statistics.mean,
      currentMean: current.statistics.mean,
      confidenceLevel,
      recommendation,
    };
  }

  /**
   * Generate recommendations based on performance results
   */
  private generateRecommendations(
    results: PerformanceMeasurement[],
    regressions: Array<{ benchmark: string; analysis: RegressionAnalysis }>
  ): string[] {
    const recommendations: string[] = [];

    // General performance recommendations
    const slowBenchmarks = results.filter(r => !r.passed);
    if (slowBenchmarks.length > 0) {
      recommendations.push(
        `⚠️ ${slowBenchmarks.length} benchmark(s) failed performance thresholds. Consider optimizing: ${
          slowBenchmarks.map(b => b.name).join(', ')
        }`
      );
    }

    const warningBenchmarks = results.filter(r => r.warning && r.passed);
    if (warningBenchmarks.length > 0) {
      recommendations.push(
        `🔔 ${warningBenchmarks.length} benchmark(s) showing warning performance. Monitor: ${
          warningBenchmarks.map(b => b.name).join(', ')
        }`
      );
    }

    // Memory usage recommendations
    const memoryThreshold = 50; // MB
    const highMemoryBenchmarks = results.filter(r => r.memory > memoryThreshold);
    if (highMemoryBenchmarks.length > 0) {
      recommendations.push(
        `💾 High memory usage detected in: ${highMemoryBenchmarks.map(b => b.name).join(', ')}. Consider memory optimization.`
      );
    }

    // Regression recommendations
    const criticalRegressions = regressions.filter(r => r.analysis.severityLevel === 'critical');
    if (criticalRegressions.length > 0) {
      recommendations.push(
        `🚨 Critical performance regressions detected! Immediate action required for: ${
          criticalRegressions.map(r => r.benchmark).join(', ')
        }`
      );
    }

    // Performance improvement suggestions
    if (recommendations.length === 0) {
      recommendations.push('✅ All performance benchmarks are within acceptable ranges.');
    }

    return recommendations;
  }

  /**
   * Generate regression-specific recommendations
   */
  private generateRegressionRecommendation(change: number, severity: RegressionAnalysis['severityLevel']): string {
    if (severity === 'critical') {
      return `🚨 Critical regression (${change.toFixed(1)}% slower). Immediate optimization required. Consider profiling and code review.`;
    } else if (severity === 'high') {
      return `🔥 High regression (${change.toFixed(1)}% slower). High priority optimization needed. Review recent changes.`;
    } else if (severity === 'medium') {
      return `⚠️ Medium regression (${change.toFixed(1)}% slower). Schedule optimization in next iteration.`;
    } else if (severity === 'low') {
      return `📊 Low regression (${change.toFixed(1)}% slower). Monitor and consider minor optimizations.`;
    }
    return 'No regression detected.';
  }

  /**
   * Get configuration for a benchmark
   */
  private getConfig(name: string, customConfig?: Partial<BenchmarkConfig>): BenchmarkConfig {
    const defaultConfig = this.config.get(name);
    if (!defaultConfig) {
      throw new Error(`No configuration found for benchmark: ${name}`);
    }
    return { ...defaultConfig, ...customConfig };
  }

  /**
   * Log benchmark result to console
   */
  private logBenchmarkResult(result: PerformanceMeasurement): void {
    const status = result.passed ? '✅' : '❌';
    const warningIndicator = result.warning ? '⚠️' : '';

    console.log(`${status}${warningIndicator} ${result.name}:`);
    console.log(`   Duration: ${result.duration.toFixed(2)}ms (threshold: ${result.metadata?.threshold}ms)`);
    console.log(`   Memory: ${result.memory.toFixed(2)}MB (threshold: ${result.metadata?.memoryThreshold}MB)`);
    console.log(`   Statistics: min=${result.statistics.min.toFixed(2)}ms, max=${result.statistics.max.toFixed(2)}ms, p95=${result.statistics.p95.toFixed(2)}ms`);
  }

  /**
   * Save performance report to file
   */
  private async saveReport(report: PerformanceReport): Promise<void> {
    try {
      await fs.mkdir(this.reportPath, { recursive: true });

      const timestamp = new Date(report.timestamp).toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(this.reportPath, `performance-report-${timestamp}.json`);

      await fs.writeFile(filePath, JSON.stringify(report, null, 2));
      console.log(`📊 Performance report saved to ${filePath}`);

      // Also save as latest
      const latestPath = path.join(this.reportPath, 'latest-performance-report.json');
      await fs.writeFile(latestPath, JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('Failed to save performance report:', error);
    }
  }

  /**
   * Utility methods
   */
  private getMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || process.memoryUsage().heapUsed;
  }

  private getCPUInfo(): any {
    try {
      const os = require('os');
      return {
        model: os.cpus()[0]?.model,
        cores: os.cpus().length,
        architecture: os.arch(),
      };
    } catch {
      return null;
    }
  }

  private getMemoryInfo(): any {
    try {
      const os = require('os');
      return {
        total: os.totalmem(),
        free: os.freemem(),
        usage: process.memoryUsage(),
      };
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export types for use in tests
export type {
  BenchmarkConfig,
  PerformanceMeasurement,
  RegressionAnalysis,
  PerformanceReport,
};