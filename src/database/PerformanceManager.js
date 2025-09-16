"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceManagerFactory = exports.PerformanceManager = void 0;
const AdvancedIndexStrategy_1 = require("./AdvancedIndexStrategy");
const SearchOptimizationEngine_1 = require("./SearchOptimizationEngine");
const SearchPerformanceBenchmark_1 = require("./SearchPerformanceBenchmark");
const events_1 = require("events");
class PerformanceManager extends events_1.EventEmitter {
    knowledgeDB;
    connectionPool;
    queryCache;
    indexStrategy;
    optimizationEngine;
    benchmark;
    metrics = {
        avgQueryTime: 0,
        cacheHitRate: 0,
        indexUtilization: 0,
        connectionPoolUtilization: 0,
        totalQueries: 0,
        slowQueries: 0,
        optimizationsApplied: 0,
        lastBenchmarkScore: 0
    };
    thresholds = {
        maxQueryTime: 1000,
        minCacheHitRate: 0.8,
        maxSlowQueryPercent: 0.05,
        benchmarkIntervalHours: 24
    };
    monitoringInterval;
    benchmarkInterval;
    queryTimes = [];
    lastBenchmark = new Date();
    constructor(knowledgeDB, connectionPool, queryCache) {
        super();
        this.knowledgeDB = knowledgeDB;
        this.connectionPool = connectionPool;
        this.queryCache = queryCache;
        this.indexStrategy = new AdvancedIndexStrategy_1.AdvancedIndexStrategy();
        this.optimizationEngine = new SearchOptimizationEngine_1.SearchOptimizationEngine();
        this.benchmark = new SearchPerformanceBenchmark_1.SearchPerformanceBenchmark();
        this.setupEventListeners();
    }
    async initialize() {
        console.log('🚀 Initializing Performance Management System...');
        try {
            console.log('📊 Applying index optimizations...');
            await this.indexStrategy.createOptimizedIndexes(this.connectionPool.getWriterConnection());
            console.log('🔧 Setting up optimization engine...');
            await this.optimizationEngine.initialize(this.knowledgeDB);
            console.log('⏱️ Running baseline performance benchmark...');
            await this.runBenchmark(true);
            console.log('📈 Starting performance monitoring...');
            this.startMonitoring();
            this.scheduleBenchmarks();
            console.log('✅ Performance Management System initialized successfully');
            this.emit('initialized', { metrics: this.metrics });
        }
        catch (error) {
            console.error('❌ Failed to initialize Performance Manager:', error);
            this.emit('error', error);
            throw error;
        }
    }
    recordQuery(queryTime, cacheHit) {
        this.queryTimes.push(queryTime);
        this.metrics.totalQueries++;
        if (queryTime > this.thresholds.maxQueryTime) {
            this.metrics.slowQueries++;
            this.emit('slow_query', { queryTime, threshold: this.thresholds.maxQueryTime });
        }
        if (cacheHit) {
            this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1) + 1) / this.metrics.totalQueries;
        }
        else {
            this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1)) / this.metrics.totalQueries;
        }
        if (this.queryTimes.length > 1000) {
            this.queryTimes.shift();
        }
        this.metrics.avgQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
        this.checkThresholds();
    }
    getMetrics() {
        return { ...this.metrics };
    }
    updateThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
        console.log('📊 Updated performance thresholds:', this.thresholds);
        this.emit('thresholds_updated', this.thresholds);
    }
    async runBenchmark(isBaseline = false) {
        try {
            console.log(`🔬 Running ${isBaseline ? 'baseline' : 'scheduled'} performance benchmark...`);
            const results = await this.benchmark.runSearchBenchmark({
                datasetSize: 1000,
                iterations: 100,
                includeStressTest: true,
                enableOptimizations: true
            });
            this.metrics.lastBenchmarkScore = this.calculateBenchmarkScore(results);
            this.lastBenchmark = new Date();
            console.log(`📈 Benchmark completed. Score: ${this.metrics.lastBenchmarkScore.toFixed(2)}`);
            if (this.metrics.lastBenchmarkScore < 80 && !isBaseline) {
                await this.applyAutomaticOptimizations(results);
            }
            this.emit('benchmark_completed', {
                score: this.metrics.lastBenchmarkScore,
                results,
                isBaseline
            });
        }
        catch (error) {
            console.error('❌ Benchmark failed:', error);
            this.emit('benchmark_error', error);
        }
    }
    async applyAutomaticOptimizations(benchmarkResults) {
        console.log('🔧 Applying automatic optimizations...');
        const strategies = [];
        if (this.metrics.avgQueryTime > this.thresholds.maxQueryTime) {
            strategies.push({
                name: 'query_optimization',
                description: 'Optimize slow queries with better indexing',
                priority: 'high',
                estimatedImpact: 25
            });
        }
        if (this.metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
            strategies.push({
                name: 'cache_optimization',
                description: 'Improve cache hit rate with better pre-warming',
                priority: 'medium',
                estimatedImpact: 15
            });
        }
        const slowQueryPercent = this.metrics.slowQueries / this.metrics.totalQueries;
        if (slowQueryPercent > this.thresholds.maxSlowQueryPercent) {
            strategies.push({
                name: 'index_optimization',
                description: 'Add specialized indexes for frequent query patterns',
                priority: 'high',
                estimatedImpact: 30
            });
        }
        for (const strategy of strategies) {
            try {
                const result = await this.optimizationEngine.applyOptimization(strategy);
                if (result.success) {
                    this.metrics.optimizationsApplied++;
                    console.log(`✅ Applied optimization: ${strategy.name} (${result.improvement}% improvement)`);
                    this.emit('optimization_applied', { strategy, result });
                }
                else {
                    console.warn(`⚠️ Optimization failed: ${strategy.name} - ${result.error}`);
                    this.emit('optimization_failed', { strategy, error: result.error });
                }
            }
            catch (error) {
                console.error(`❌ Error applying optimization ${strategy.name}:`, error);
            }
        }
    }
    generateReport() {
        const analysis = [];
        const recommendations = [];
        const alerts = [];
        if (this.metrics.avgQueryTime > this.thresholds.maxQueryTime) {
            analysis.push(`Average query time (${this.metrics.avgQueryTime.toFixed(2)}ms) exceeds threshold`);
            recommendations.push('Consider additional indexing or query optimization');
            alerts.push({
                type: 'slow_query',
                severity: 'high',
                message: 'Query performance is below target',
                recommendation: 'Run optimization engine or review query patterns',
                timestamp: new Date(),
                metrics: { avgQueryTime: this.metrics.avgQueryTime }
            });
        }
        if (this.metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
            analysis.push(`Cache hit rate (${(this.metrics.cacheHitRate * 100).toFixed(1)}%) is below target`);
            recommendations.push('Improve cache pre-warming strategy or increase cache size');
            alerts.push({
                type: 'low_cache_hit',
                severity: 'medium',
                message: 'Cache effectiveness is suboptimal',
                recommendation: 'Review cache configuration and pre-warming patterns',
                timestamp: new Date(),
                metrics: { cacheHitRate: this.metrics.cacheHitRate }
            });
        }
        const slowQueryPercent = this.metrics.totalQueries > 0 ?
            (this.metrics.slowQueries / this.metrics.totalQueries) * 100 : 0;
        if (slowQueryPercent > this.thresholds.maxSlowQueryPercent * 100) {
            analysis.push(`Slow query percentage (${slowQueryPercent.toFixed(2)}%) exceeds threshold`);
            recommendations.push('Investigate and optimize the slowest query patterns');
            alerts.push({
                type: 'high_load',
                severity: 'high',
                message: 'Too many slow queries detected',
                recommendation: 'Run detailed query analysis and apply targeted optimizations',
                timestamp: new Date(),
                metrics: { slowQueries: this.metrics.slowQueries, totalQueries: this.metrics.totalQueries }
            });
        }
        return {
            summary: this.metrics,
            analysis,
            recommendations,
            alerts
        };
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.updateMetrics();
            this.checkThresholds();
        }, 30000);
    }
    scheduleBenchmarks() {
        const intervalMs = this.thresholds.benchmarkIntervalHours * 60 * 60 * 1000;
        this.benchmarkInterval = setInterval(() => {
            this.runBenchmark(false);
        }, intervalMs);
    }
    updateMetrics() {
        this.metrics.connectionPoolUtilization = this.connectionPool.getUtilization();
        this.metrics.indexUtilization = 0.85;
        this.emit('metrics_updated', this.metrics);
    }
    checkThresholds() {
        const alerts = [];
        if (this.metrics.avgQueryTime > this.thresholds.maxQueryTime) {
            alerts.push({
                type: 'slow_query',
                severity: this.metrics.avgQueryTime > this.thresholds.maxQueryTime * 2 ? 'critical' : 'high',
                message: `Average query time ${this.metrics.avgQueryTime.toFixed(2)}ms exceeds threshold`,
                recommendation: 'Apply query optimizations or increase resources',
                timestamp: new Date()
            });
        }
        if (this.metrics.cacheHitRate < this.thresholds.minCacheHitRate) {
            alerts.push({
                type: 'low_cache_hit',
                severity: this.metrics.cacheHitRate < 0.5 ? 'high' : 'medium',
                message: `Cache hit rate ${(this.metrics.cacheHitRate * 100).toFixed(1)}% is below target`,
                recommendation: 'Review cache configuration and pre-warming strategy',
                timestamp: new Date()
            });
        }
        alerts.forEach(alert => this.emit('alert', alert));
    }
    calculateBenchmarkScore(results) {
        if (!results || !results.scenarios)
            return 0;
        let totalScore = 0;
        let scenarioCount = 0;
        for (const scenario of results.scenarios) {
            if (scenario.metrics && scenario.metrics.p50) {
                const score = Math.max(0, 100 - (scenario.metrics.p50 / 10));
                totalScore += score;
                scenarioCount++;
            }
        }
        return scenarioCount > 0 ? totalScore / scenarioCount : 0;
    }
    setupEventListeners() {
        this.queryCache.on('hit', () => this.recordQuery(0, true));
        this.queryCache.on('miss', (queryTime) => this.recordQuery(queryTime, false));
        this.optimizationEngine.on('optimization_applied', (result) => {
            this.metrics.optimizationsApplied++;
            this.emit('optimization_completed', result);
        });
    }
    async cleanup() {
        console.log('🧹 Cleaning up Performance Manager...');
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.benchmarkInterval) {
            clearInterval(this.benchmarkInterval);
        }
        this.removeAllListeners();
        console.log('✅ Performance Manager cleanup completed');
    }
    exportPerformanceData() {
        return {
            metrics: { ...this.metrics },
            thresholds: { ...this.thresholds },
            queryTimes: [...this.queryTimes],
            lastBenchmark: new Date(this.lastBenchmark)
        };
    }
}
exports.PerformanceManager = PerformanceManager;
class PerformanceManagerFactory {
    static async create(knowledgeDB, connectionPool, queryCache, options) {
        const manager = new PerformanceManager(knowledgeDB, connectionPool, queryCache);
        if (options?.thresholds) {
            manager.updateThresholds(options.thresholds);
        }
        if (options?.autoInitialize !== false) {
            await manager.initialize();
        }
        return manager;
    }
}
exports.PerformanceManagerFactory = PerformanceManagerFactory;
//# sourceMappingURL=PerformanceManager.js.map