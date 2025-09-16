"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceBenchmark = exports.PerformanceBenchmark = void 0;
const MetricsCollector_1 = require("./MetricsCollector");
class PerformanceBenchmark {
    activeTests = new Map();
    async runBenchmark(config, operation) {
        const testId = `benchmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`Starting benchmark: ${config.name} (${testId})`);
        this.activeTests.set(testId, true);
        try {
            const startTime = Date.now();
            if (config.warmupTime && config.warmupTime > 0) {
                console.log(`Warming up for ${config.warmupTime}ms...`);
                await this.runWarmup(operation, config.warmupTime);
            }
            console.log(`Running benchmark for ${config.duration}ms with ${config.concurrency} concurrent operations...`);
            const results = await this.runMainBenchmark(testId, config, operation);
            if (config.cooldownTime && config.cooldownTime > 0) {
                console.log(`Cooling down for ${config.cooldownTime}ms...`);
                await this.sleep(config.cooldownTime);
            }
            const endTime = Date.now();
            const benchmarkResult = this.analyzeResults(testId, config, startTime, endTime, results);
            console.log(`Benchmark completed: ${config.name}`);
            console.log(`Results: ${benchmarkResult.summary.totalRequests} requests, ` +
                `${benchmarkResult.summary.avgResponseTime.toFixed(2)}ms avg, ` +
                `${benchmarkResult.summary.throughput.toFixed(2)} req/s, ` +
                `${(benchmarkResult.summary.errorRate * 100).toFixed(2)}% error rate`);
            return benchmarkResult;
        }
        catch (error) {
            console.error(`Benchmark failed: ${config.name}`, error);
            throw error;
        }
        finally {
            this.activeTests.delete(testId);
        }
    }
    async runWarmup(operation, warmupTime) {
        const warmupStart = Date.now();
        const warmupPromises = [];
        while (Date.now() - warmupStart < warmupTime) {
            warmupPromises.push(operation().catch(() => { }));
            if (warmupPromises.length >= 10) {
                await Promise.all(warmupPromises);
                warmupPromises.length = 0;
            }
            await this.sleep(10);
        }
        if (warmupPromises.length > 0) {
            await Promise.all(warmupPromises);
        }
    }
    async runMainBenchmark(testId, config, operation) {
        const results = [];
        const startTime = Date.now();
        const workers = [];
        for (let i = 0; i < config.concurrency; i++) {
            workers.push(this.runWorker(testId, config, operation, startTime, results));
        }
        await Promise.all(workers);
        return results;
    }
    async runWorker(testId, config, operation, startTime, results) {
        while (this.activeTests.get(testId) && Date.now() - startTime < config.duration) {
            const requestStart = Date.now();
            try {
                const result = await operation();
                const responseTime = Date.now() - requestStart;
                const testResult = {
                    timestamp: Date.now(),
                    responseTime,
                    success: result.success,
                    error: result.error,
                    statusCode: result.statusCode,
                    metadata: result.metadata
                };
                results.push(testResult);
                MetricsCollector_1.metricsCollector.recordResponseTime(config.name, 'BENCHMARK', responseTime, result.statusCode || (result.success ? 200 : 500));
            }
            catch (error) {
                const responseTime = Date.now() - requestStart;
                results.push({
                    timestamp: Date.now(),
                    responseTime,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                MetricsCollector_1.metricsCollector.recordResponseTime(config.name, 'BENCHMARK', responseTime, 500);
            }
            await this.sleep(1);
        }
    }
    analyzeResults(testId, config, startTime, endTime, results) {
        const totalDuration = endTime - startTime;
        const totalRequests = results.length;
        const successfulRequests = results.filter(r => r.success).length;
        const failedRequests = totalRequests - successfulRequests;
        const responseTimes = results.map(r => r.responseTime).sort((a, b) => a - b);
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
        const minResponseTime = responseTimes[0] || 0;
        const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
        const throughput = totalRequests / (totalDuration / 1000);
        const errorRate = failedRequests / totalRequests || 0;
        const successRate = successfulRequests / totalRequests || 0;
        const percentiles = {
            p50: this.calculatePercentile(responseTimes, 50),
            p75: this.calculatePercentile(responseTimes, 75),
            p90: this.calculatePercentile(responseTimes, 90),
            p95: this.calculatePercentile(responseTimes, 95),
            p99: this.calculatePercentile(responseTimes, 99)
        };
        const failures = [];
        let passed = true;
        if (config.targets.responseTime && avgResponseTime > config.targets.responseTime) {
            failures.push(`Average response time ${avgResponseTime.toFixed(2)}ms exceeds target ${config.targets.responseTime}ms`);
            passed = false;
        }
        if (config.targets.throughput && throughput < config.targets.throughput) {
            failures.push(`Throughput ${throughput.toFixed(2)} req/s below target ${config.targets.throughput} req/s`);
            passed = false;
        }
        if (config.targets.errorRate && errorRate > config.targets.errorRate) {
            failures.push(`Error rate ${(errorRate * 100).toFixed(2)}% exceeds target ${(config.targets.errorRate * 100).toFixed(2)}%`);
            passed = false;
        }
        if (config.targets.successRate && successRate < config.targets.successRate) {
            failures.push(`Success rate ${(successRate * 100).toFixed(2)}% below target ${(config.targets.successRate * 100).toFixed(2)}%`);
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
                successRate
            },
            percentiles,
            results,
            passed,
            failures
        };
    }
    calculatePercentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static createHttpBenchmark(url, options = {}) {
        return async () => {
            const startTime = Date.now();
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    ...options
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
                        contentLength: response.headers.get('content-length')
                    }
                };
            }
            catch (error) {
                const responseTime = Date.now() - startTime;
                return {
                    success: false,
                    responseTime,
                    error: error instanceof Error ? error.message : 'Network error',
                    metadata: { url, method: options.method || 'GET' }
                };
            }
        };
    }
    static createDatabaseBenchmark(queryFn, queryName = 'database-query') {
        return async () => {
            const startTime = Date.now();
            try {
                await queryFn();
                const responseTime = Date.now() - startTime;
                return {
                    success: true,
                    responseTime,
                    metadata: { queryName }
                };
            }
            catch (error) {
                const responseTime = Date.now() - startTime;
                return {
                    success: false,
                    responseTime,
                    error: error instanceof Error ? error.message : 'Database error',
                    metadata: { queryName }
                };
            }
        };
    }
    static createCacheBenchmark(cacheGet, keyPrefix = 'benchmark') {
        let counter = 0;
        return async () => {
            const key = `${keyPrefix}-${counter++}`;
            const startTime = Date.now();
            try {
                const result = await cacheGet(key);
                const responseTime = Date.now() - startTime;
                const hit = result !== null && result !== undefined;
                MetricsCollector_1.metricsCollector.recordCacheEvent(key, hit, responseTime);
                return {
                    success: true,
                    responseTime,
                    metadata: { key, hit }
                };
            }
            catch (error) {
                const responseTime = Date.now() - startTime;
                return {
                    success: false,
                    responseTime,
                    error: error instanceof Error ? error.message : 'Cache error',
                    metadata: { key }
                };
            }
        };
    }
    async runSystemBenchmark() {
        console.log('Running comprehensive system benchmark...');
        const httpBenchmark = await this.runBenchmark({
            name: 'HTTP Endpoints',
            description: 'Test HTTP endpoint response times and throughput',
            duration: 30000,
            concurrency: 10,
            targets: {
                responseTime: 500,
                throughput: 100,
                errorRate: 0.01
            }
        }, PerformanceBenchmark.createHttpBenchmark('/api/health'));
        const databaseBenchmark = await this.runBenchmark({
            name: 'Database Queries',
            description: 'Test database query performance',
            duration: 20000,
            concurrency: 5,
            targets: {
                responseTime: 100,
                errorRate: 0.001
            }
        }, PerformanceBenchmark.createDatabaseBenchmark(() => new Promise(resolve => setTimeout(resolve, Math.random() * 50)), 'select-benchmark'));
        const cacheBenchmark = await this.runBenchmark({
            name: 'Cache Operations',
            description: 'Test cache hit rates and response times',
            duration: 15000,
            concurrency: 20,
            targets: {
                responseTime: 10,
                errorRate: 0.001
            }
        }, PerformanceBenchmark.createCacheBenchmark((key) => new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.2 ? `value-${key}` : null), Math.random() * 5))));
        return {
            http: httpBenchmark,
            database: databaseBenchmark,
            cache: cacheBenchmark
        };
    }
}
exports.PerformanceBenchmark = PerformanceBenchmark;
exports.performanceBenchmark = new PerformanceBenchmark();
//# sourceMappingURL=PerformanceBenchmark.js.map