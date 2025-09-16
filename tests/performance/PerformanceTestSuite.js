"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceTestSuite = void 0;
const perf_hooks_1 = require("perf_hooks");
const SearchService_1 = require("../../src/services/SearchService");
const PerformanceOptimizer_1 = require("../../src/optimization/PerformanceOptimizer");
class PerformanceTestSuite {
    db;
    searchService;
    optimizer;
    testResults = [];
    SLA_THRESHOLDS = {
        AUTOCOMPLETE: 100,
        SEARCH: 1000,
        AVAILABILITY: 99.9,
        MEMORY: 500,
        ERROR_RATE: 0.05
    };
    constructor(database) {
        this.db = database;
        this.searchService = new SearchService_1.SearchService();
        this.optimizer = new PerformanceOptimizer_1.PerformanceOptimizer(database);
        this.setupTestData();
    }
    async runFullTestSuite() {
        console.log('🚀 Starting comprehensive performance test suite...');
        const startTime = perf_hooks_1.performance.now();
        const results = [];
        results.push(await this.runBaselineTest());
        results.push(await this.runLoadTest({
            duration: 60,
            concurrency: 10,
            rampUpTime: 10,
            queries: this.generateTestQueries(50),
            targetThroughput: 15
        }));
        results.push(await this.runStressTest({
            maxConcurrency: 100,
            stepSize: 10,
            stepDuration: 30,
            memoryThreshold: this.SLA_THRESHOLDS.MEMORY,
            responseTimeThreshold: this.SLA_THRESHOLDS.SEARCH
        }));
        results.push(await this.runAutocompleteTest());
        results.push(await this.runMemoryLeakTest());
        results.push(await this.runDatabaseStressTest());
        results.push(await this.runCachePerformanceTest());
        results.push(await this.runBundleSizeTest());
        this.testResults = results;
        const totalDuration = perf_hooks_1.performance.now() - startTime;
        const summary = this.generateTestSummary(results);
        console.log(`✅ Performance test suite completed in ${(totalDuration / 1000).toFixed(1)}s`);
        console.log(`📊 Results: ${summary.passed}/${summary.totalTests} tests passed`);
        console.log(`🎯 Overall SLA compliance: ${(summary.slaCompliance * 100).toFixed(1)}%`);
        return { results, summary };
    }
    async runBaselineTest() {
        console.log('📊 Running baseline performance test...');
        const startTime = perf_hooks_1.performance.now();
        const responseTimes = [];
        const queries = this.generateTestQueries(20);
        const entries = await this.getTestEntries();
        let errors = 0;
        for (const query of queries) {
            try {
                const queryStart = perf_hooks_1.performance.now();
                await this.searchService.search(query, entries);
                const queryTime = perf_hooks_1.performance.now() - queryStart;
                responseTimes.push(queryTime);
            }
            catch (error) {
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
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    async runLoadTest(config) {
        console.log(`🔄 Running load test: ${config.concurrency} users for ${config.duration}s...`);
        const startTime = perf_hooks_1.performance.now();
        const responseTimes = [];
        const entries = await this.getTestEntries();
        let totalQueries = 0;
        let errors = 0;
        let activeUsers = 0;
        const results = await new Promise((resolve) => {
            const endTime = startTime + (config.duration * 1000);
            const rampUpInterval = (config.rampUpTime * 1000) / config.concurrency;
            const userIntervals = [];
            let completed = 0;
            const checkCompletion = () => {
                if (perf_hooks_1.performance.now() >= endTime && completed === config.concurrency) {
                    userIntervals.forEach(clearInterval);
                    resolve({ responseTimes, totalQueries, errors });
                }
            };
            for (let i = 0; i < config.concurrency; i++) {
                setTimeout(() => {
                    activeUsers++;
                    console.log(`👤 User ${i + 1}/${config.concurrency} started`);
                    const userInterval = setInterval(async () => {
                        if (perf_hooks_1.performance.now() >= endTime) {
                            clearInterval(userInterval);
                            completed++;
                            checkCompletion();
                            return;
                        }
                        try {
                            const query = config.queries[Math.floor(Math.random() * config.queries.length)];
                            const queryStart = perf_hooks_1.performance.now();
                            await this.searchService.search(query, entries);
                            const queryTime = perf_hooks_1.performance.now() - queryStart;
                            responseTimes.push(queryTime);
                            totalQueries++;
                        }
                        catch (error) {
                            errors++;
                            totalQueries++;
                        }
                    }, 1000 + Math.random() * 1000);
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
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    async runStressTest(config) {
        console.log(`💪 Running stress test: 0 → ${config.maxConcurrency} users...`);
        const startTime = perf_hooks_1.performance.now();
        const results = [];
        const entries = await this.getTestEntries();
        const queries = this.generateTestQueries(20);
        let breakingPoint = 0;
        for (let concurrency = config.stepSize; concurrency <= config.maxConcurrency; concurrency += config.stepSize) {
            console.log(`📈 Testing with ${concurrency} concurrent users...`);
            const stepResults = await this.runConcurrentQueries(concurrency, config.stepDuration, queries, entries);
            const stepMetrics = this.calculateMetrics(stepResults.responseTimes, stepResults.errors, stepResults.totalQueries);
            results.push({ concurrency, metrics: stepMetrics });
            if (stepMetrics.responseTime.p95 > config.responseTimeThreshold ||
                stepMetrics.memoryUsage.peak > config.memoryThreshold ||
                stepMetrics.errorRate > this.SLA_THRESHOLDS.ERROR_RATE) {
                breakingPoint = concurrency;
                console.log(`⚠️ Performance degradation detected at ${concurrency} concurrent users`);
                break;
            }
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
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    async runAutocompleteTest() {
        console.log('⚡ Testing autocomplete performance...');
        const startTime = perf_hooks_1.performance.now();
        const responseTimes = [];
        const prefixes = ['js', 'vs', 'db', 'co', 'ab', 'er', 'fi', 'da', 'sy', 'me'];
        let errors = 0;
        for (const prefix of prefixes) {
            for (let i = 0; i < 10; i++) {
                try {
                    const queryStart = perf_hooks_1.performance.now();
                    await this.searchService.suggest(prefix + 'x'.repeat(i), 10);
                    const queryTime = perf_hooks_1.performance.now() - queryStart;
                    responseTimes.push(queryTime);
                }
                catch (error) {
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
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    async runMemoryLeakTest() {
        console.log('🧠 Testing for memory leaks...');
        const startTime = perf_hooks_1.performance.now();
        const memorySnapshots = [];
        const queries = this.generateTestQueries(100);
        const entries = await this.getTestEntries();
        const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        memorySnapshots.push(initialMemory);
        const batchSize = 20;
        for (let i = 0; i < queries.length; i += batchSize) {
            const batch = queries.slice(i, i + batchSize);
            await Promise.all(batch.map(query => this.searchService.search(query, entries)));
            if (global.gc) {
                global.gc();
            }
            const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
            memorySnapshots.push(currentMemory);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const finalMemory = memorySnapshots[memorySnapshots.length - 1];
        const memoryGrowth = finalMemory - initialMemory;
        const maxMemory = Math.max(...memorySnapshots);
        const growthRate = memoryGrowth / (queries.length / batchSize);
        const hasLeak = growthRate > 5;
        const metrics = {
            throughput: queries.length / ((perf_hooks_1.performance.now() - startTime) / 1000),
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
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    async runDatabaseStressTest() {
        console.log('💾 Testing database performance under stress...');
        const startTime = perf_hooks_1.performance.now();
        const responseTimes = [];
        const queries = this.generateTestQueries(50);
        const entries = await this.getTestEntries();
        const concurrentQueries = 20;
        const iterations = 5;
        let errors = 0;
        for (let i = 0; i < iterations; i++) {
            const promises = [];
            for (let j = 0; j < concurrentQueries; j++) {
                const query = queries[Math.floor(Math.random() * queries.length)];
                promises.push((async () => {
                    try {
                        const queryStart = perf_hooks_1.performance.now();
                        await this.searchService.search(query, entries);
                        const queryTime = perf_hooks_1.performance.now() - queryStart;
                        responseTimes.push(queryTime);
                    }
                    catch (error) {
                        errors++;
                    }
                })());
            }
            await Promise.all(promises);
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
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    async runCachePerformanceTest() {
        console.log('💾 Testing cache performance...');
        const startTime = perf_hooks_1.performance.now();
        const queries = this.generateTestQueries(20);
        const entries = await this.getTestEntries();
        const firstRunTimes = [];
        for (const query of queries) {
            const queryStart = perf_hooks_1.performance.now();
            await this.searchService.search(query, entries);
            firstRunTimes.push(perf_hooks_1.performance.now() - queryStart);
        }
        const secondRunTimes = [];
        for (const query of queries) {
            const queryStart = perf_hooks_1.performance.now();
            await this.searchService.search(query, entries);
            secondRunTimes.push(perf_hooks_1.performance.now() - queryStart);
        }
        const firstRunAvg = firstRunTimes.reduce((a, b) => a + b) / firstRunTimes.length;
        const secondRunAvg = secondRunTimes.reduce((a, b) => a + b) / secondRunTimes.length;
        const improvement = (firstRunAvg - secondRunAvg) / firstRunAvg;
        const metrics = this.calculateMetrics(secondRunTimes, 0, queries.length);
        const passed = improvement > 0.3;
        return {
            testName: 'Cache Performance',
            config: { queries: queries.length, expectedImprovement: 0.3 },
            metrics,
            passed,
            failures: passed ? [] : [`Cache improvement ${(improvement * 100).toFixed(1)}% below expected 30%`],
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    async runBundleSizeTest() {
        console.log('📦 Testing bundle size and loading performance...');
        const startTime = perf_hooks_1.performance.now();
        const bundleAnalysis = await this.optimizer.analyzeBundleSize();
        const maxBundleSize = 5 * 1024 * 1024;
        const metrics = {
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
            duration: perf_hooks_1.performance.now() - startTime,
            timestamp: new Date()
        };
    }
    generateRegressionReport(baselineResults) {
        const regressions = [];
        const improvements = [];
        this.testResults.forEach((current, index) => {
            const baseline = baselineResults[index];
            if (!baseline || baseline.testName !== current.testName)
                return;
            const comparisons = [
                { metric: 'P95 Response Time', baseline: baseline.metrics.responseTime.p95, current: current.metrics.responseTime.p95 },
                { metric: 'Mean Response Time', baseline: baseline.metrics.responseTime.mean, current: current.metrics.responseTime.mean },
                { metric: 'Throughput', baseline: baseline.metrics.throughput, current: current.metrics.throughput },
                { metric: 'Memory Usage', baseline: baseline.metrics.memoryUsage.peak, current: current.metrics.memoryUsage.peak },
                { metric: 'Error Rate', baseline: baseline.metrics.errorRate, current: current.metrics.errorRate }
            ];
            comparisons.forEach(comp => {
                const change = ((comp.current - comp.baseline) / comp.baseline) * 100;
                if (Math.abs(change) > 5) {
                    if ((comp.metric === 'Throughput' && change > 0) ||
                        (comp.metric !== 'Throughput' && change < 0)) {
                        improvements.push({
                            testName: current.testName,
                            ...comp,
                            change
                        });
                    }
                    else {
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
    async setupTestData() {
        console.log('📋 Setting up performance test data...');
    }
    generateTestQueries(count) {
        const baseQueries = [
            'jcl error', 'vsam status', 'db2 sqlcode', 'cobol abend',
            'cics transaction', 'ims database', 'batch job failure',
            'tso command', 'ispf panel', 'dataset allocation',
            'catalog error', 'racf security', 'sort utility',
            'ftp transfer', 'tcp/ip connection', 's0c7 data exception'
        ];
        const queries = [];
        for (let i = 0; i < count; i++) {
            const base = baseQueries[i % baseQueries.length];
            const variation = Math.floor(Math.random() * 5);
            switch (variation) {
                case 0:
                    queries.push(base);
                    break;
                case 1:
                    queries.push(base + ' problem');
                    break;
                case 2:
                    queries.push('how to fix ' + base);
                    break;
                case 3:
                    queries.push(base.split(' ')[0]);
                    break;
                case 4:
                    queries.push(base + ' solution');
                    break;
            }
        }
        return queries;
    }
    async getTestEntries() {
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
    async runConcurrentQueries(concurrency, duration, queries, entries) {
        const responseTimes = [];
        let totalQueries = 0;
        let errors = 0;
        const promises = [];
        for (let i = 0; i < concurrency; i++) {
            promises.push((async () => {
                const endTime = perf_hooks_1.performance.now() + (duration * 1000);
                while (perf_hooks_1.performance.now() < endTime) {
                    try {
                        const query = queries[Math.floor(Math.random() * queries.length)];
                        const queryStart = perf_hooks_1.performance.now();
                        await this.searchService.search(query, entries);
                        const queryTime = perf_hooks_1.performance.now() - queryStart;
                        responseTimes.push(queryTime);
                        totalQueries++;
                    }
                    catch (error) {
                        errors++;
                        totalQueries++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
                }
            })());
        }
        await Promise.all(promises);
        return { responseTimes, totalQueries, errors };
    }
    calculateMetrics(responseTimes, errors, totalQueries) {
        const sortedTimes = [...responseTimes].sort((a, b) => a - b);
        const metrics = {
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
            cpuUsage: { mean: 50, peak: 75 }
        };
        return metrics;
    }
    percentile(sortedArray, p) {
        if (sortedArray.length === 0)
            return 0;
        const index = (p / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) {
            return sortedArray[lower];
        }
        const weight = index - lower;
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }
    evaluateBaslinePerformance(metrics) {
        return metrics.responseTime.p95 <= this.SLA_THRESHOLDS.SEARCH &&
            metrics.errorRate <= this.SLA_THRESHOLDS.ERROR_RATE &&
            metrics.memoryUsage.peak <= this.SLA_THRESHOLDS.MEMORY;
    }
    evaluateLoadTestPerformance(metrics, config) {
        return metrics.responseTime.p95 <= this.SLA_THRESHOLDS.SEARCH &&
            metrics.errorRate <= this.SLA_THRESHOLDS.ERROR_RATE &&
            metrics.slaCompliance >= 0.95 &&
            (!config.targetThroughput || metrics.throughput >= config.targetThroughput * 0.9);
    }
    getPerformanceFailures(metrics) {
        const failures = [];
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
    getLoadTestFailures(metrics, config) {
        const failures = this.getPerformanceFailures(metrics);
        if (metrics.slaCompliance < 0.95) {
            failures.push(`SLA compliance ${(metrics.slaCompliance * 100).toFixed(1)}% below 95% requirement`);
        }
        if (config.targetThroughput && metrics.throughput < config.targetThroughput * 0.9) {
            failures.push(`Throughput ${metrics.throughput.toFixed(1)} QPS below target ${config.targetThroughput} QPS`);
        }
        return failures;
    }
    getDatabaseStressFailures(metrics) {
        const failures = [];
        if (metrics.responseTime.p95 > this.SLA_THRESHOLDS.SEARCH) {
            failures.push(`Database queries too slow under stress: ${metrics.responseTime.p95.toFixed(1)}ms P95`);
        }
        if (metrics.errorRate > this.SLA_THRESHOLDS.ERROR_RATE) {
            failures.push(`Database errors under stress: ${(metrics.errorRate * 100).toFixed(1)}% error rate`);
        }
        return failures;
    }
    aggregateStressTestMetrics(results) {
        const lastResult = results[results.length - 1];
        return lastResult.metrics;
    }
    generateTestSummary(results) {
        const totalTests = results.length;
        const passed = results.filter(r => r.passed).length;
        const failed = totalTests - passed;
        const avgSlaCompliance = results.reduce((sum, r) => sum + r.metrics.slaCompliance, 0) / totalTests;
        const recommendations = [];
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
exports.PerformanceTestSuite = PerformanceTestSuite;
//# sourceMappingURL=PerformanceTestSuite.js.map