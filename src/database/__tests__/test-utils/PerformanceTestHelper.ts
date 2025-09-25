import { performance } from 'perf_hooks';
import os from 'os';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage | null;
  operationsPerSecond?: number;
  throughput?: number;
}

export interface BenchmarkResult {
  name: string;
  metrics: PerformanceMetrics;
  iterations: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface LoadTestConfig {
  concurrentUsers: number;
  duration: number; // in seconds
  rampUpTime: number; // in seconds
  operations: (() => Promise<void>)[];
}

/**
 * Helper class for performance testing and benchmarking
 */
export class PerformanceTestHelper extends EventEmitter {
  private benchmarkResults: BenchmarkResult[] = [];

  /**
   * Measure performance of a single operation
   */
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T> | T,
    iterations: number = 1
  ): Promise<BenchmarkResult> {
    const cpuStart = process.cpuUsage();
    const memStart = process.memoryUsage();
    const timeStart = performance.now();

    let success = true;
    let error: string | undefined;

    try {
      if (iterations === 1) {
        await operation();
      } else {
        for (let i = 0; i < iterations; i++) {
          await operation();
        }
      }
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : String(e);
    }

    const timeEnd = performance.now();
    const memEnd = process.memoryUsage();
    const cpuEnd = process.cpuUsage(cpuStart);

    const executionTime = timeEnd - timeStart;
    const operationsPerSecond = iterations > 1 ? iterations / (executionTime / 1000) : undefined;

    const result: BenchmarkResult = {
      name,
      iterations,
      success,
      error,
      timestamp: new Date(),
      metrics: {
        executionTime,
        memoryUsage: {
          rss: memEnd.rss - memStart.rss,
          heapUsed: memEnd.heapUsed - memStart.heapUsed,
          heapTotal: memEnd.heapTotal - memStart.heapTotal,
          external: memEnd.external - memStart.external,
          arrayBuffers: memEnd.arrayBuffers - memStart.arrayBuffers,
        },
        cpuUsage: cpuEnd,
        operationsPerSecond,
      },
    };

    this.benchmarkResults.push(result);
    this.emit('benchmark:complete', result);

    return result;
  }

  /**
   * Run a load test with multiple concurrent operations
   */
  async runLoadTest(config: LoadTestConfig): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    const startTime = Date.now();
    const endTime = startTime + config.duration * 1000;
    const rampUpEnd = startTime + config.rampUpTime * 1000;

    const workers: Promise<void>[] = [];

    // Create concurrent workers
    for (let i = 0; i < config.concurrentUsers; i++) {
      const workerDelay = (config.rampUpTime * 1000 * i) / config.concurrentUsers;

      workers.push(this.runWorker(i, workerDelay, endTime, config.operations, results));
    }

    await Promise.all(workers);

    return results;
  }

  private async runWorker(
    workerId: number,
    startDelay: number,
    endTime: number,
    operations: (() => Promise<void>)[],
    results: BenchmarkResult[]
  ): Promise<void> {
    // Wait for ramp-up
    if (startDelay > 0) {
      await this.sleep(startDelay);
    }

    let operationCount = 0;

    while (Date.now() < endTime) {
      const operation = operations[operationCount % operations.length];

      try {
        const result = await this.measureOperation(
          `worker-${workerId}-op-${operationCount}`,
          operation
        );
        results.push(result);
      } catch (error) {
        this.emit('worker:error', { workerId, error });
      }

      operationCount++;
    }
  }

  /**
   * Benchmark query performance with different dataset sizes
   */
  async benchmarkQueryScaling(
    setupData: (size: number) => Promise<void>,
    query: () => Promise<any>,
    sizes: number[] = [100, 500, 1000, 5000, 10000]
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const size of sizes) {
      await setupData(size);

      const result = await this.measureOperation(
        `query-scaling-${size}`,
        query,
        10 // Run 10 times for average
      );

      results.push(result);
      this.emit('scaling:complete', { size, result });
    }

    return results;
  }

  /**
   * Test memory usage under sustained load
   */
  async testMemoryUsage(
    operation: () => Promise<void>,
    duration: number = 60000, // 1 minute
    interval: number = 1000 // 1 second
  ): Promise<PerformanceMetrics[]> {
    const metrics: PerformanceMetrics[] = [];
    const startTime = Date.now();
    const endTime = startTime + duration;

    const memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      metrics.push({
        executionTime: Date.now() - startTime,
        memoryUsage: memUsage,
        cpuUsage: cpuUsage,
      });
    }, interval);

    // Run operations continuously
    while (Date.now() < endTime) {
      try {
        await operation();
      } catch (error) {
        this.emit('memory:error', error);
      }
    }

    clearInterval(memoryMonitor);
    return metrics;
  }

  /**
   * Compare performance between different implementations
   */
  async compareImplementations(
    implementations: { name: string; fn: () => Promise<any> }[],
    iterations: number = 100
  ): Promise<{ [key: string]: BenchmarkResult }> {
    const results: { [key: string]: BenchmarkResult } = {};

    for (const impl of implementations) {
      results[impl.name] = await this.measureOperation(impl.name, impl.fn, iterations);
    }

    // Calculate relative performance
    const fastest = Object.values(results).reduce((min, current) =>
      current.metrics.executionTime < min.metrics.executionTime ? current : min
    );

    Object.values(results).forEach(result => {
      result.metrics.throughput = fastest.metrics.executionTime / result.metrics.executionTime;
    });

    return results;
  }

  /**
   * Analyze performance regression between test runs
   */
  analyzeRegression(
    baseline: BenchmarkResult[],
    current: BenchmarkResult[],
    threshold: number = 0.1 // 10% performance degradation threshold
  ): Array<{ test: string; degradation: number; isRegression: boolean }> {
    const analysis: Array<{ test: string; degradation: number; isRegression: boolean }> = [];

    baseline.forEach(baselineResult => {
      const currentResult = current.find(r => r.name === baselineResult.name);

      if (currentResult) {
        const degradation =
          (currentResult.metrics.executionTime - baselineResult.metrics.executionTime) /
          baselineResult.metrics.executionTime;

        analysis.push({
          test: baselineResult.name,
          degradation,
          isRegression: degradation > threshold,
        });
      }
    });

    return analysis;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    if (this.benchmarkResults.length === 0) {
      return 'No benchmark results available';
    }

    let report = '# Performance Test Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `System: ${os.type()} ${os.release()}\n`;
    report += `CPU: ${os.cpus()[0].model}\n`;
    report += `Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB\n\n`;

    report += '## Test Results\n\n';
    report +=
      '| Test Name | Execution Time (ms) | Memory Usage (MB) | Operations/sec | Success |\n';
    report += '|-----------|-------------------|------------------|----------------|----------|\n';

    this.benchmarkResults.forEach(result => {
      const memUsageMB =
        Math.round((result.metrics.memoryUsage.heapUsed / 1024 / 1024) * 100) / 100;
      const opsPerSec = result.metrics.operationsPerSecond
        ? Math.round(result.metrics.operationsPerSecond * 100) / 100
        : 'N/A';

      report += `| ${result.name} | ${Math.round(result.metrics.executionTime * 100) / 100} | ${memUsageMB} | ${opsPerSec} | ${result.success ? '✅' : '❌'} |\n`;
    });

    // Add summary statistics
    const successful = this.benchmarkResults.filter(r => r.success);
    if (successful.length > 0) {
      const avgTime =
        successful.reduce((sum, r) => sum + r.metrics.executionTime, 0) / successful.length;
      const maxTime = Math.max(...successful.map(r => r.metrics.executionTime));
      const minTime = Math.min(...successful.map(r => r.metrics.executionTime));

      report += '\n## Summary Statistics\n\n';
      report += `- Total Tests: ${this.benchmarkResults.length}\n`;
      report += `- Successful: ${successful.length}\n`;
      report += `- Failed: ${this.benchmarkResults.length - successful.length}\n`;
      report += `- Average Execution Time: ${Math.round(avgTime * 100) / 100}ms\n`;
      report += `- Min Execution Time: ${Math.round(minTime * 100) / 100}ms\n`;
      report += `- Max Execution Time: ${Math.round(maxTime * 100) / 100}ms\n`;
    }

    return report;
  }

  /**
   * Clear benchmark results
   */
  clearResults(): void {
    this.benchmarkResults.length = 0;
  }

  /**
   * Get all benchmark results
   */
  getResults(): BenchmarkResult[] {
    return [...this.benchmarkResults];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
