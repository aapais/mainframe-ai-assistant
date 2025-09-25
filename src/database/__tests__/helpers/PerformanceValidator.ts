/**
 * Performance Validation Helper for Integration Tests
 * Provides utilities for measuring and validating performance requirements
 */

import { performance } from 'perf_hooks';

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface PerformanceBenchmark {
  name: string;
  threshold: number; // milliseconds
  samples: number[];
  average: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  passed: boolean;
}

export interface PerformanceReport {
  totalOperations: number;
  totalTime: number;
  averageTime: number;
  benchmarks: PerformanceBenchmark[];
  summary: {
    passed: number;
    failed: number;
    overall: 'PASS' | 'FAIL';
  };
}

/**
 * Performance Validator Class
 */
export class PerformanceValidator {
  private metrics: PerformanceMetric[] = [];
  private benchmarks: Map<string, { threshold: number; samples: number[] }> = new Map();

  /**
   * Start measuring a performance operation
   */
  startMeasurement(operation: string): string {
    const measurementId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    this.metrics.push({
      operation,
      startTime,
      endTime: 0,
      duration: 0,
      metadata: { measurementId },
    });

    return measurementId;
  }

  /**
   * End measurement and record results
   */
  endMeasurement(measurementId: string, metadata?: Record<string, any>): PerformanceMetric {
    const endTime = performance.now();
    const metricIndex = this.metrics.findIndex(m => m.metadata?.measurementId === measurementId);

    if (metricIndex === -1) {
      throw new Error(`Measurement with ID ${measurementId} not found`);
    }

    const metric = this.metrics[metricIndex];
    metric.endTime = endTime;
    metric.duration = endTime - metric.startTime;
    metric.metadata = { ...metric.metadata, ...metadata };

    // Add to benchmark if configured
    if (this.benchmarks.has(metric.operation)) {
      this.benchmarks.get(metric.operation)!.samples.push(metric.duration);
    }

    return metric;
  }

  /**
   * Measure an async operation
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; metric: PerformanceMetric }> {
    const measurementId = this.startMeasurement(operation);

    try {
      const result = await fn();
      const metric = this.endMeasurement(measurementId, { ...metadata, success: true });
      return { result, metric };
    } catch (error) {
      const metric = this.endMeasurement(measurementId, {
        ...metadata,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): { result: T; metric: PerformanceMetric } {
    const measurementId = this.startMeasurement(operation);

    try {
      const result = fn();
      const metric = this.endMeasurement(measurementId, { ...metadata, success: true });
      return { result, metric };
    } catch (error) {
      const metric = this.endMeasurement(measurementId, {
        ...metadata,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Configure performance benchmark
   */
  setBenchmark(operation: string, threshold: number): void {
    this.benchmarks.set(operation, { threshold, samples: [] });
  }

  /**
   * Validate operation against performance threshold
   */
  validatePerformance(operation: string, duration: number, threshold: number): boolean {
    return duration <= threshold;
  }

  /**
   * Get performance statistics for an operation
   */
  getOperationStats(operation: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);

    if (operationMetrics.length === 0) {
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
      };
    }

    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = total / durations.length;

    return {
      count: operationMetrics.length,
      total,
      average,
      min: durations[0],
      max: durations[durations.length - 1],
      p95: this.calculatePercentile(durations, 95),
      p99: this.calculatePercentile(durations, 99),
    };
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): PerformanceReport {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    const benchmarks: PerformanceBenchmark[] = [];
    let passed = 0;
    let failed = 0;

    for (const operation of operations) {
      const stats = this.getOperationStats(operation);
      const benchmark = this.benchmarks.get(operation);

      if (benchmark) {
        const benchmarkResult: PerformanceBenchmark = {
          name: operation,
          threshold: benchmark.threshold,
          samples: [...benchmark.samples],
          average: stats.average,
          min: stats.min,
          max: stats.max,
          p95: stats.p95,
          p99: stats.p99,
          passed: stats.p95 <= benchmark.threshold, // Use P95 for validation
        };

        benchmarks.push(benchmarkResult);

        if (benchmarkResult.passed) {
          passed++;
        } else {
          failed++;
        }
      }
    }

    const totalTime = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageTime = this.metrics.length > 0 ? totalTime / this.metrics.length : 0;

    return {
      totalOperations: this.metrics.length,
      totalTime,
      averageTime,
      benchmarks,
      summary: {
        passed,
        failed,
        overall: failed === 0 ? 'PASS' : 'FAIL',
      },
    };
  }

  /**
   * Clear all collected metrics
   */
  clear(): void {
    this.metrics = [];
    this.benchmarks.clear();
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Export metrics to JSON for external analysis
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        metrics: this.metrics,
        benchmarks: Object.fromEntries(this.benchmarks),
        report: this.generateReport(),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Validate search performance specifically for KB search requirements
   */
  validateSearchPerformance(
    searchTime: number,
    resultCount: number = 0
  ): {
    passed: boolean;
    message: string;
    metrics: {
      searchTime: number;
      resultCount: number;
      timePerResult: number;
      thresholdMet: boolean;
    };
  } {
    const SEARCH_THRESHOLD = 1000; // 1 second requirement
    const passed = searchTime <= SEARCH_THRESHOLD;
    const timePerResult = resultCount > 0 ? searchTime / resultCount : searchTime;

    return {
      passed,
      message: passed
        ? `Search completed in ${searchTime.toFixed(2)}ms (${resultCount} results)`
        : `Search performance failed: ${searchTime.toFixed(2)}ms exceeds ${SEARCH_THRESHOLD}ms threshold`,
      metrics: {
        searchTime,
        resultCount,
        timePerResult,
        thresholdMet: passed,
      },
    };
  }

  /**
   * Monitor performance continuously during test execution
   */
  async monitorPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    options: {
      maxDuration?: number;
      sampleInterval?: number;
      onSample?: (metric: PerformanceMetric) => void;
    } = {}
  ): Promise<T> {
    const { maxDuration = 30000, sampleInterval = 100, onSample } = options;
    const startTime = performance.now();
    let sampleCount = 0;

    const monitorInterval = setInterval(() => {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;

      if (elapsed >= maxDuration) {
        clearInterval(monitorInterval);
        throw new Error(`Operation ${operation} exceeded maximum duration of ${maxDuration}ms`);
      }

      // Create sample metric
      const sampleMetric: PerformanceMetric = {
        operation: `${operation}_sample_${++sampleCount}`,
        startTime,
        endTime: currentTime,
        duration: elapsed,
        metadata: { sampleNumber: sampleCount, totalElapsed: elapsed },
      };

      this.metrics.push(sampleMetric);

      if (onSample) {
        onSample(sampleMetric);
      }
    }, sampleInterval);

    try {
      const result = await fn();
      clearInterval(monitorInterval);
      return result;
    } catch (error) {
      clearInterval(monitorInterval);
      throw error;
    }
  }

  /**
   * Run performance stress test
   */
  async stressTest(
    operation: string,
    fn: () => Promise<any>,
    options: {
      iterations: number;
      concurrency: number;
      threshold: number;
      warmupIterations?: number;
    }
  ): Promise<{
    success: boolean;
    results: {
      totalIterations: number;
      completedIterations: number;
      failedIterations: number;
      averageTime: number;
      minTime: number;
      maxTime: number;
      p95: number;
      p99: number;
      throughput: number; // operations per second
    };
    errors: string[];
  }> {
    const { iterations, concurrency, threshold, warmupIterations = 0 } = options;

    // Warmup phase
    if (warmupIterations > 0) {
      for (let i = 0; i < warmupIterations; i++) {
        try {
          await fn();
        } catch (error) {
          // Ignore warmup errors
        }
      }
    }

    const results: Array<{ duration: number; success: boolean; error?: string }> = [];
    const errors: string[] = [];
    const startTime = performance.now();

    // Run stress test in batches based on concurrency
    for (let batch = 0; batch < Math.ceil(iterations / concurrency); batch++) {
      const batchSize = Math.min(concurrency, iterations - batch * concurrency);
      const batchPromises = [];

      for (let i = 0; i < batchSize; i++) {
        const promise = this.measureAsync(`${operation}_stress`, fn)
          .then(({ metric }) => ({
            duration: metric.duration,
            success: true,
          }))
          .catch(error => ({
            duration: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }));

        batchPromises.push(promise);
      }

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Collect errors
      batchResults.forEach(result => {
        if (!result.success && result.error) {
          errors.push(result.error);
        }
      });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const completedIterations = results.filter(r => r.success).length;
    const failedIterations = results.filter(r => !r.success).length;

    const successfulDurations = results
      .filter(r => r.success)
      .map(r => r.duration)
      .sort((a, b) => a - b);

    const averageTime =
      successfulDurations.length > 0
        ? successfulDurations.reduce((sum, d) => sum + d, 0) / successfulDurations.length
        : 0;

    return {
      success: averageTime <= threshold && failedIterations === 0,
      results: {
        totalIterations: iterations,
        completedIterations,
        failedIterations,
        averageTime,
        minTime: successfulDurations[0] || 0,
        maxTime: successfulDurations[successfulDurations.length - 1] || 0,
        p95: this.calculatePercentile(successfulDurations, 95),
        p99: this.calculatePercentile(successfulDurations, 99),
        throughput: completedIterations / (totalTime / 1000), // ops per second
      },
      errors: [...new Set(errors)], // Remove duplicates
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);

    if (Math.floor(index) === index) {
      return sortedArray[index];
    }

    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
}
