"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceValidator = void 0;
const perf_hooks_1 = require("perf_hooks");
class PerformanceValidator {
    metrics = [];
    benchmarks = new Map();
    startMeasurement(operation) {
        const measurementId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = perf_hooks_1.performance.now();
        this.metrics.push({
            operation,
            startTime,
            endTime: 0,
            duration: 0,
            metadata: { measurementId }
        });
        return measurementId;
    }
    endMeasurement(measurementId, metadata) {
        const endTime = perf_hooks_1.performance.now();
        const metricIndex = this.metrics.findIndex(m => m.metadata?.measurementId === measurementId);
        if (metricIndex === -1) {
            throw new Error(`Measurement with ID ${measurementId} not found`);
        }
        const metric = this.metrics[metricIndex];
        metric.endTime = endTime;
        metric.duration = endTime - metric.startTime;
        metric.metadata = { ...metric.metadata, ...metadata };
        if (this.benchmarks.has(metric.operation)) {
            this.benchmarks.get(metric.operation).samples.push(metric.duration);
        }
        return metric;
    }
    async measureAsync(operation, fn, metadata) {
        const measurementId = this.startMeasurement(operation);
        try {
            const result = await fn();
            const metric = this.endMeasurement(measurementId, { ...metadata, success: true });
            return { result, metric };
        }
        catch (error) {
            const metric = this.endMeasurement(measurementId, {
                ...metadata,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    measureSync(operation, fn, metadata) {
        const measurementId = this.startMeasurement(operation);
        try {
            const result = fn();
            const metric = this.endMeasurement(measurementId, { ...metadata, success: true });
            return { result, metric };
        }
        catch (error) {
            const metric = this.endMeasurement(measurementId, {
                ...metadata,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    setBenchmark(operation, threshold) {
        this.benchmarks.set(operation, { threshold, samples: [] });
    }
    validatePerformance(operation, duration, threshold) {
        return duration <= threshold;
    }
    getOperationStats(operation) {
        const operationMetrics = this.metrics.filter(m => m.operation === operation);
        if (operationMetrics.length === 0) {
            return {
                count: 0,
                total: 0,
                average: 0,
                min: 0,
                max: 0,
                p95: 0,
                p99: 0
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
            p99: this.calculatePercentile(durations, 99)
        };
    }
    generateReport() {
        const operations = [...new Set(this.metrics.map(m => m.operation))];
        const benchmarks = [];
        let passed = 0;
        let failed = 0;
        for (const operation of operations) {
            const stats = this.getOperationStats(operation);
            const benchmark = this.benchmarks.get(operation);
            if (benchmark) {
                const benchmarkResult = {
                    name: operation,
                    threshold: benchmark.threshold,
                    samples: [...benchmark.samples],
                    average: stats.average,
                    min: stats.min,
                    max: stats.max,
                    p95: stats.p95,
                    p99: stats.p99,
                    passed: stats.p95 <= benchmark.threshold
                };
                benchmarks.push(benchmarkResult);
                if (benchmarkResult.passed) {
                    passed++;
                }
                else {
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
                overall: failed === 0 ? 'PASS' : 'FAIL'
            }
        };
    }
    clear() {
        this.metrics = [];
        this.benchmarks.clear();
    }
    getMetrics() {
        return [...this.metrics];
    }
    exportMetrics() {
        return JSON.stringify({
            metrics: this.metrics,
            benchmarks: Object.fromEntries(this.benchmarks),
            report: this.generateReport(),
            timestamp: new Date().toISOString()
        }, null, 2);
    }
    validateSearchPerformance(searchTime, resultCount = 0) {
        const SEARCH_THRESHOLD = 1000;
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
                thresholdMet: passed
            }
        };
    }
    async monitorPerformance(operation, fn, options = {}) {
        const { maxDuration = 30000, sampleInterval = 100, onSample } = options;
        const startTime = perf_hooks_1.performance.now();
        let sampleCount = 0;
        const monitorInterval = setInterval(() => {
            const currentTime = perf_hooks_1.performance.now();
            const elapsed = currentTime - startTime;
            if (elapsed >= maxDuration) {
                clearInterval(monitorInterval);
                throw new Error(`Operation ${operation} exceeded maximum duration of ${maxDuration}ms`);
            }
            const sampleMetric = {
                operation: `${operation}_sample_${++sampleCount}`,
                startTime,
                endTime: currentTime,
                duration: elapsed,
                metadata: { sampleNumber: sampleCount, totalElapsed: elapsed }
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
        }
        catch (error) {
            clearInterval(monitorInterval);
            throw error;
        }
    }
    async stressTest(operation, fn, options) {
        const { iterations, concurrency, threshold, warmupIterations = 0 } = options;
        if (warmupIterations > 0) {
            for (let i = 0; i < warmupIterations; i++) {
                try {
                    await fn();
                }
                catch (error) {
                }
            }
        }
        const results = [];
        const errors = [];
        const startTime = perf_hooks_1.performance.now();
        for (let batch = 0; batch < Math.ceil(iterations / concurrency); batch++) {
            const batchSize = Math.min(concurrency, iterations - batch * concurrency);
            const batchPromises = [];
            for (let i = 0; i < batchSize; i++) {
                const promise = this.measureAsync(`${operation}_stress`, fn)
                    .then(({ metric }) => ({
                    duration: metric.duration,
                    success: true
                }))
                    .catch(error => ({
                    duration: 0,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }));
                batchPromises.push(promise);
            }
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            batchResults.forEach(result => {
                if (!result.success && result.error) {
                    errors.push(result.error);
                }
            });
        }
        const endTime = perf_hooks_1.performance.now();
        const totalTime = endTime - startTime;
        const completedIterations = results.filter(r => r.success).length;
        const failedIterations = results.filter(r => !r.success).length;
        const successfulDurations = results
            .filter(r => r.success)
            .map(r => r.duration)
            .sort((a, b) => a - b);
        const averageTime = successfulDurations.length > 0
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
                throughput: completedIterations / (totalTime / 1000)
            },
            errors: [...new Set(errors)]
        };
    }
    calculatePercentile(sortedArray, percentile) {
        if (sortedArray.length === 0)
            return 0;
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
exports.PerformanceValidator = PerformanceValidator;
//# sourceMappingURL=PerformanceValidator.js.map