'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PerformanceTestHelper = void 0;
const tslib_1 = require('tslib');
const perf_hooks_1 = require('perf_hooks');
const os_1 = tslib_1.__importDefault(require('os'));
const events_1 = require('events');
class PerformanceTestHelper extends events_1.EventEmitter {
  benchmarkResults = [];
  async measureOperation(name, operation, iterations = 1) {
    const cpuStart = process.cpuUsage();
    const memStart = process.memoryUsage();
    const timeStart = perf_hooks_1.performance.now();
    let success = true;
    let error;
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
    const timeEnd = perf_hooks_1.performance.now();
    const memEnd = process.memoryUsage();
    const cpuEnd = process.cpuUsage(cpuStart);
    const executionTime = timeEnd - timeStart;
    const operationsPerSecond = iterations > 1 ? iterations / (executionTime / 1000) : undefined;
    const result = {
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
  async runLoadTest(config) {
    const results = [];
    const startTime = Date.now();
    const endTime = startTime + config.duration * 1000;
    const rampUpEnd = startTime + config.rampUpTime * 1000;
    const workers = [];
    for (let i = 0; i < config.concurrentUsers; i++) {
      const workerDelay = (config.rampUpTime * 1000 * i) / config.concurrentUsers;
      workers.push(this.runWorker(i, workerDelay, endTime, config.operations, results));
    }
    await Promise.all(workers);
    return results;
  }
  async runWorker(workerId, startDelay, endTime, operations, results) {
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
  async benchmarkQueryScaling(setupData, query, sizes = [100, 500, 1000, 5000, 10000]) {
    const results = [];
    for (const size of sizes) {
      await setupData(size);
      const result = await this.measureOperation(`query-scaling-${size}`, query, 10);
      results.push(result);
      this.emit('scaling:complete', { size, result });
    }
    return results;
  }
  async testMemoryUsage(operation, duration = 60000, interval = 1000) {
    const metrics = [];
    const startTime = Date.now();
    const endTime = startTime + duration;
    const memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      metrics.push({
        executionTime: Date.now() - startTime,
        memoryUsage: memUsage,
        cpuUsage,
      });
    }, interval);
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
  async compareImplementations(implementations, iterations = 100) {
    const results = {};
    for (const impl of implementations) {
      results[impl.name] = await this.measureOperation(impl.name, impl.fn, iterations);
    }
    const fastest = Object.values(results).reduce((min, current) =>
      current.metrics.executionTime < min.metrics.executionTime ? current : min
    );
    Object.values(results).forEach(result => {
      result.metrics.throughput = fastest.metrics.executionTime / result.metrics.executionTime;
    });
    return results;
  }
  analyzeRegression(baseline, current, threshold = 0.1) {
    const analysis = [];
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
  generateReport() {
    if (this.benchmarkResults.length === 0) {
      return 'No benchmark results available';
    }
    let report = '# Performance Test Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `System: ${os_1.default.type()} ${os_1.default.release()}\n`;
    report += `CPU: ${os_1.default.cpus()[0].model}\n`;
    report += `Memory: ${Math.round(os_1.default.totalmem() / 1024 / 1024 / 1024)}GB\n\n`;
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
  clearResults() {
    this.benchmarkResults.length = 0;
  }
  getResults() {
    return [...this.benchmarkResults];
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
exports.PerformanceTestHelper = PerformanceTestHelper;
//# sourceMappingURL=PerformanceTestHelper.js.map
