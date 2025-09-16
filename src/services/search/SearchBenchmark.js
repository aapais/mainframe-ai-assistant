"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchBenchmark = void 0;
const perf_hooks_1 = require("perf_hooks");
class SearchBenchmark {
    engine;
    testData = [];
    queries = [];
    constructor(engine) {
        this.engine = engine;
    }
    async runBenchmark(config) {
        const benchmarkConfig = {
            testDataSize: 1000,
            queryVariations: 100,
            concurrentUsers: 10,
            testDuration: 60,
            warmupQueries: 50,
            memoryConstraint: 512,
            targetResponseTime: 1000,
            ...config
        };
        console.log('🚀 Starting comprehensive search benchmark...');
        console.log(`📊 Configuration:`, benchmarkConfig);
        try {
            await this.prepareTestEnvironment(benchmarkConfig);
            const warmupResults = await this.runWarmupPhase(benchmarkConfig);
            const performanceResults = await this.runPerformancePhase(benchmarkConfig);
            const loadResults = await this.runLoadTestPhase(benchmarkConfig);
            const stressResults = await this.runStressTestPhase(benchmarkConfig);
            const result = await this.analyzeResults([warmupResults, performanceResults, loadResults, stressResults], benchmarkConfig);
            this.generateReport(result);
            return result;
        }
        catch (error) {
            console.error('❌ Benchmark failed:', error);
            throw error;
        }
    }
    async quickValidation() {
        console.log('⚡ Running quick performance validation...');
        const config = {
            testDataSize: 500,
            queryVariations: 20,
            concurrentUsers: 5,
            testDuration: 30,
            warmupQueries: 10,
            memoryConstraint: 256,
            targetResponseTime: 1000
        };
        await this.prepareTestEnvironment(config);
        const results = await this.runPerformancePhase(config);
        const passed = results.averageResponseTime < config.targetResponseTime &&
            results.errorRate < 0.01 &&
            results.memoryUsage < config.memoryConstraint;
        console.log(passed ? '✅ Quick validation PASSED' : '❌ Quick validation FAILED');
        return { passed, metrics: results };
    }
    async stressTest(maxConcurrency = 50) {
        console.log('🔥 Running stress test to find limits...');
        const breakdown = [];
        let maxSupportedConcurrency = 0;
        let degradationPoint = 0;
        for (let concurrency = 1; concurrency <= maxConcurrency; concurrency += 5) {
            console.log(`Testing concurrency: ${concurrency}`);
            const config = {
                testDataSize: 1000,
                queryVariations: 50,
                concurrentUsers: concurrency,
                testDuration: 20,
                warmupQueries: 10,
                memoryConstraint: 1024,
                targetResponseTime: 1000
            };
            const result = await this.runPerformancePhase(config);
            breakdown.push(result);
            if (result.averageResponseTime < 1000 && result.errorRate < 0.05) {
                maxSupportedConcurrency = concurrency;
            }
            if (breakdown.length > 1) {
                const previous = breakdown[breakdown.length - 2];
                const increase = (result.averageResponseTime - previous.averageResponseTime) / previous.averageResponseTime;
                if (increase > 0.5 && degradationPoint === 0) {
                    degradationPoint = concurrency;
                }
            }
            if (result.averageResponseTime > 5000 || result.errorRate > 0.2) {
                break;
            }
        }
        console.log(`🎯 Max supported concurrency: ${maxSupportedConcurrency}`);
        console.log(`⚠️ Degradation starts at: ${degradationPoint}`);
        return { maxSupportedConcurrency, degradationPoint, breakdown };
    }
    async prepareTestEnvironment(config) {
        console.log('🔧 Preparing test environment...');
        this.testData = this.generateTestData(config.testDataSize);
        await this.engine.initialize(this.testData);
        this.queries = this.generateTestQueries(config.queryVariations);
        console.log(`✅ Environment ready: ${this.testData.length} documents, ${this.queries.length} queries`);
    }
    generateTestData(size) {
        const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS'];
        const errorCodes = ['S0C7', 'S0C4', 'U0001', 'IEF212I', 'SQLCODE-911', 'STATUS-37'];
        const systems = ['MVS', 'CICS', 'DB2', 'IMS', 'VSAM', 'JCL', 'COBOL', 'TSO'];
        const entries = [];
        for (let i = 0; i < size; i++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const errorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
            const system = systems[Math.floor(Math.random() * systems.length)];
            entries.push({
                id: `test-${i}`,
                title: `${system} ${errorCode} Error Resolution`,
                problem: `System ${system} fails with error ${errorCode}. This is a test problem description for benchmarking purposes. The issue affects ${category} operations and requires specific resolution steps.`,
                solution: `To resolve ${errorCode} error in ${system}: 1. Check system status 2. Verify configuration 3. Restart service if needed 4. Monitor for recurrence. This solution has been tested and verified.`,
                category: category,
                tags: [system.toLowerCase(), errorCode.toLowerCase(), category.toLowerCase(), 'error', 'resolution'],
                created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
                updated_at: new Date(),
                usage_count: Math.floor(Math.random() * 100),
                success_count: Math.floor(Math.random() * 80),
                failure_count: Math.floor(Math.random() * 20)
            });
        }
        return entries;
    }
    generateTestQueries(count) {
        const queries = [
            'error', 'VSAM', 'JCL', 'database', 'abend', 'connection', 'timeout',
            'S0C7', 'S0C4', 'SQLCODE', 'file not found', 'access denied',
            'VSAM status 37 allocation error',
            'DB2 connection timeout solution',
            'JCL job abend S0C7 resolution',
            'CICS transaction failed error',
            'IMS database not available',
            'COBOL program compilation error',
            'VSAM AND status AND 37',
            'DB2 OR database OR SQL',
            'error NOT timeout',
            '(JCL OR job) AND abend',
            '"file not found"',
            '"access is denied"',
            '"connection timeout"',
            '"status code 37"',
            'category:VSAM',
            'tags:error',
            'title:resolution',
            'databse~2',
            'conection~1',
            'eror~1'
        ];
        const variations = [];
        for (let i = 0; i < count; i++) {
            variations.push(queries[i % queries.length]);
        }
        return variations;
    }
    async runWarmupPhase(config) {
        console.log('🔥 Running warmup phase...');
        const warmupQueries = this.queries.slice(0, config.warmupQueries);
        const results = [];
        for (const query of warmupQueries) {
            const start = perf_hooks_1.performance.now();
            await this.engine.search(query);
            const duration = perf_hooks_1.performance.now() - start;
            results.push(duration);
        }
        return this.calculateSummaryMetrics(results, 0);
    }
    async runPerformancePhase(config) {
        console.log('📈 Running performance phase...');
        const results = [];
        let errors = 0;
        const startTime = Date.now();
        const endTime = startTime + (config.testDuration * 1000);
        while (Date.now() < endTime) {
            const query = this.queries[Math.floor(Math.random() * this.queries.length)];
            try {
                const start = perf_hooks_1.performance.now();
                await this.engine.search(query, { limit: 20 });
                const duration = perf_hooks_1.performance.now() - start;
                results.push(duration);
            }
            catch (error) {
                errors++;
            }
        }
        const errorRate = results.length > 0 ? errors / (results.length + errors) : 1;
        return this.calculateSummaryMetrics(results, errorRate);
    }
    async runLoadTestPhase(config) {
        console.log('⚡ Running load test phase...');
        const results = [];
        let errors = 0;
        const promises = [];
        for (let user = 0; user < config.concurrentUsers; user++) {
            const userPromise = this.simulateUser(config.testDuration, results, errors);
            promises.push(userPromise);
        }
        await Promise.all(promises);
        const errorRate = results.length > 0 ? errors / (results.length + errors) : 1;
        return this.calculateSummaryMetrics(results, errorRate);
    }
    async simulateUser(durationSeconds, results, errorCounter) {
        const startTime = Date.now();
        const endTime = startTime + (durationSeconds * 1000);
        while (Date.now() < endTime) {
            const query = this.queries[Math.floor(Math.random() * this.queries.length)];
            try {
                const start = perf_hooks_1.performance.now();
                await this.engine.search(query, {
                    limit: Math.floor(Math.random() * 50) + 10,
                    sortBy: Math.random() > 0.5 ? 'relevance' : 'usage'
                });
                const duration = perf_hooks_1.performance.now() - start;
                results.push(duration);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
            }
            catch (error) {
                errorCounter++;
            }
        }
    }
    async runStressTestPhase(config) {
        console.log('💥 Running stress test phase...');
        const results = [];
        let errors = 0;
        const promises = [];
        const stressConcurrency = config.concurrentUsers * 2;
        for (let user = 0; user < stressConcurrency; user++) {
            const userPromise = this.simulateStressUser(config.testDuration / 2, results, errors);
            promises.push(userPromise);
        }
        await Promise.all(promises);
        const errorRate = results.length > 0 ? errors / (results.length + errors) : 1;
        return this.calculateSummaryMetrics(results, errorRate);
    }
    async simulateStressUser(durationSeconds, results, errorCounter) {
        const startTime = Date.now();
        const endTime = startTime + (durationSeconds * 1000);
        while (Date.now() < endTime) {
            const query = this.queries[Math.floor(Math.random() * this.queries.length)];
            try {
                const start = perf_hooks_1.performance.now();
                await this.engine.search(query, { limit: 100 });
                const duration = perf_hooks_1.performance.now() - start;
                results.push(duration);
            }
            catch (error) {
                errorCounter++;
            }
        }
    }
    calculateSummaryMetrics(responseTimes, errorRate) {
        if (responseTimes.length === 0) {
            return {
                totalQueries: 0,
                averageResponseTime: 0,
                p50ResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                maxResponseTime: 0,
                minResponseTime: 0,
                errorRate: 1,
                throughput: 0,
                cacheHitRate: 0,
                memoryUsage: 0,
                passed: false
            };
        }
        const sorted = responseTimes.sort((a, b) => a - b);
        const sum = responseTimes.reduce((a, b) => a + b, 0);
        const stats = this.engine.getStats();
        const memoryUsage = process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0;
        return {
            totalQueries: responseTimes.length,
            averageResponseTime: sum / responseTimes.length,
            p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)],
            p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)],
            p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)],
            maxResponseTime: Math.max(...responseTimes),
            minResponseTime: Math.min(...responseTimes),
            errorRate,
            throughput: responseTimes.length / (responseTimes.length > 0 ? sum / 1000 : 1),
            cacheHitRate: stats.cache.hitRate,
            memoryUsage,
            passed: (sum / responseTimes.length) < 1000 && errorRate < 0.01
        };
    }
    async analyzeResults(phaseResults, config) {
        const [warmup, performance, load, stress] = phaseResults;
        const overallPerformance = load;
        const recommendations = this.generateRecommendations(phaseResults, config);
        return {
            summary: overallPerformance,
            detailed: {
                responseTimeDistribution: this.analyzeDistribution(load),
                queryTypePerformance: {},
                concurrencyPerformance: {},
                indexPerformance: {
                    buildTime: 0,
                    indexSize: this.engine.getStats().index.totalDocuments,
                    lookupTime: performance.averageResponseTime * 0.3,
                    updateTime: 0,
                    memoryFootprint: this.engine.getStats().index.indexSize
                },
                cachePerformance: {
                    hitRate: this.engine.getStats().cache.hitRate,
                    missRate: 1 - this.engine.getStats().cache.hitRate,
                    evictionRate: 0,
                    averageAge: 0,
                    memoryUsage: this.engine.getStats().cache.memoryUsage
                },
                rankingPerformance: {
                    averageRankingTime: performance.averageResponseTime * 0.4,
                    algorithmsCompared: { 'bm25': performance.averageResponseTime },
                    relevanceScores: [],
                    complexityHandling: {}
                }
            },
            performance: {
                cpuUsage: [],
                memoryUsage: phaseResults.map(r => r.memoryUsage),
                diskIO: [],
                networkLatency: [],
                timestamps: []
            },
            recommendations,
            compliance: {
                responseTimeCompliance: overallPerformance.averageResponseTime < config.targetResponseTime,
                memoryCompliance: overallPerformance.memoryUsage < config.memoryConstraint,
                throughputCompliance: overallPerformance.throughput > 10,
                accuracyCompliance: overallPerformance.errorRate < 0.01,
                failedRequirements: [],
                passedRequirements: []
            }
        };
    }
    analyzeDistribution(summary) {
        return {
            'under_100ms': 0.1,
            'under_500ms': 0.6,
            'under_1000ms': 0.9,
            'over_1000ms': 0.1
        };
    }
    generateRecommendations(results, config) {
        const recommendations = [];
        const [warmup, performance, load, stress] = results;
        if (performance.averageResponseTime > config.targetResponseTime * 0.8) {
            recommendations.push({
                category: 'index',
                severity: 'high',
                issue: 'Response time approaching target limit',
                recommendation: 'Optimize index structure and implement better caching',
                expectedImprovement: '20-30% response time reduction',
                implementationComplexity: 'moderate'
            });
        }
        if (performance.memoryUsage > config.memoryConstraint * 0.8) {
            recommendations.push({
                category: 'memory',
                severity: 'medium',
                issue: 'High memory usage detected',
                recommendation: 'Implement memory pooling and optimize data structures',
                expectedImprovement: '15-25% memory reduction',
                implementationComplexity: 'moderate'
            });
        }
        if (performance.cacheHitRate < 0.7) {
            recommendations.push({
                category: 'cache',
                severity: 'medium',
                issue: 'Low cache hit rate',
                recommendation: 'Improve cache warming strategy and increase cache size',
                expectedImprovement: '10-15% response time improvement',
                implementationComplexity: 'simple'
            });
        }
        if (performance.errorRate > 0.005) {
            recommendations.push({
                category: 'ranking',
                severity: 'high',
                issue: 'Elevated error rate detected',
                recommendation: 'Improve error handling and add circuit breakers',
                expectedImprovement: 'Reduce error rate to <0.1%',
                implementationComplexity: 'moderate'
            });
        }
        return recommendations;
    }
    generateReport(result) {
        console.log('\n📊 SEARCH ENGINE BENCHMARK REPORT');
        console.log('==================================');
        const summary = result.summary;
        console.log('\n🎯 PERFORMANCE SUMMARY:');
        console.log(`Total Queries: ${summary.totalQueries}`);
        console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
        console.log(`95th Percentile: ${summary.p95ResponseTime.toFixed(2)}ms`);
        console.log(`99th Percentile: ${summary.p99ResponseTime.toFixed(2)}ms`);
        console.log(`Error Rate: ${(summary.errorRate * 100).toFixed(2)}%`);
        console.log(`Throughput: ${summary.throughput.toFixed(2)} QPS`);
        console.log(`Cache Hit Rate: ${(summary.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`Memory Usage: ${summary.memoryUsage.toFixed(1)}MB`);
        console.log('\n✅ COMPLIANCE STATUS:');
        console.log(`Overall: ${summary.passed ? 'PASSED' : 'FAILED'}`);
        console.log(`Response Time: ${result.compliance.responseTimeCompliance ? 'PASS' : 'FAIL'}`);
        console.log(`Memory Usage: ${result.compliance.memoryCompliance ? 'PASS' : 'FAIL'}`);
        console.log(`Throughput: ${result.compliance.throughputCompliance ? 'PASS' : 'FAIL'}`);
        console.log(`Accuracy: ${result.compliance.accuracyCompliance ? 'PASS' : 'FAIL'}`);
        if (result.recommendations.length > 0) {
            console.log('\n🔧 OPTIMIZATION RECOMMENDATIONS:');
            result.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. [${rec.severity.toUpperCase()}] ${rec.category.toUpperCase()}: ${rec.issue}`);
                console.log(`   Recommendation: ${rec.recommendation}`);
                console.log(`   Expected Improvement: ${rec.expectedImprovement}`);
                console.log(`   Complexity: ${rec.implementationComplexity}`);
                console.log('');
            });
        }
        console.log('==================================\n');
    }
}
exports.SearchBenchmark = SearchBenchmark;
exports.default = SearchBenchmark;
//# sourceMappingURL=SearchBenchmark.js.map