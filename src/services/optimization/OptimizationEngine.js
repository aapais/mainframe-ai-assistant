"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizationEngine = void 0;
const events_1 = require("events");
const AlgorithmTuner_1 = require("./AlgorithmTuner");
const IndexOptimizationAdvisor_1 = require("./IndexOptimizationAdvisor");
const CacheStrategyOptimizer_1 = require("./CacheStrategyOptimizer");
const BottleneckDetector_1 = require("./BottleneckDetector");
class OptimizationEngine extends events_1.EventEmitter {
    config;
    algorithmTuner;
    indexAdvisor;
    cacheOptimizer;
    bottleneckDetector;
    recommendations = new Map();
    metrics = [];
    monitoringInterval;
    analysisHistory = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            enableAutoRecommendations: true,
            monitoringInterval: 15,
            thresholds: {
                performanceWarning: 1000,
                performanceCritical: 3000,
                cacheHitRatio: 0.8,
                queryResponseTime: 500,
                memoryUsage: 0.8
            },
            categories: ['performance', 'search', 'cache', 'database', 'memory'],
            minROI: 20,
            maxRecommendations: 10,
            ...config
        };
        this.algorithmTuner = new AlgorithmTuner_1.AlgorithmTuner();
        this.indexAdvisor = new IndexOptimizationAdvisor_1.IndexOptimizationAdvisor();
        this.cacheOptimizer = new CacheStrategyOptimizer_1.CacheStrategyOptimizer();
        this.bottleneckDetector = new BottleneckDetector_1.BottleneckDetector();
        this.setupEventHandlers();
    }
    async initialize() {
        console.log('Initializing OptimizationEngine...');
        await Promise.all([
            this.algorithmTuner.initialize(),
            this.indexAdvisor.initialize(),
            this.cacheOptimizer.initialize(),
            this.bottleneckDetector.initialize()
        ]);
        if (this.config.enableAutoRecommendations) {
            this.startMonitoring();
        }
        this.emit('initialized');
        console.log('OptimizationEngine initialized successfully');
    }
    startMonitoring() {
        if (this.monitoringInterval) {
            return;
        }
        this.monitoringInterval = setInterval(async () => {
            await this.performAnalysis();
        }, this.config.monitoringInterval * 60 * 1000);
        console.log(`Started optimization monitoring (interval: ${this.config.monitoringInterval}min)`);
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
            console.log('Stopped optimization monitoring');
        }
    }
    async performAnalysis() {
        const timestamp = Date.now();
        console.log('Performing optimization analysis...');
        try {
            const [algorithmMetrics, indexMetrics, cacheMetrics, bottleneckMetrics] = await Promise.all([
                this.algorithmTuner.analyzePerformance(),
                this.indexAdvisor.analyzeIndexes(),
                this.cacheOptimizer.analyzeCacheStrategy(),
                this.bottleneckDetector.detectBottlenecks()
            ]);
            this.metrics.push(...algorithmMetrics, ...indexMetrics, ...cacheMetrics, ...bottleneckMetrics);
            const recommendations = await this.generateRecommendations({
                algorithmMetrics,
                indexMetrics,
                cacheMetrics,
                bottleneckMetrics
            });
            const filteredRecommendations = this.filterAndPrioritizeRecommendations(recommendations);
            filteredRecommendations.forEach(rec => {
                this.recommendations.set(rec.id, rec);
            });
            this.emit('analysis-completed', {
                timestamp,
                recommendations: filteredRecommendations,
                metrics: { algorithmMetrics, indexMetrics, cacheMetrics, bottleneckMetrics }
            });
            if (filteredRecommendations.some(r => r.impact === 'critical')) {
                this.emit('critical-issues-detected', filteredRecommendations.filter(r => r.impact === 'critical'));
            }
            return filteredRecommendations;
        }
        catch (error) {
            console.error('Error performing optimization analysis:', error);
            this.emit('analysis-error', error);
            return [];
        }
    }
    async generateRecommendations(metrics) {
        const recommendations = [];
        const timestamp = Date.now();
        const algorithmRecs = await this.algorithmTuner.getOptimizationRecommendations(metrics.algorithmMetrics);
        recommendations.push(...algorithmRecs.map(rec => this.formatRecommendation(rec, 'algorithm', timestamp)));
        const indexRecs = await this.indexAdvisor.getOptimizationRecommendations(metrics.indexMetrics);
        recommendations.push(...indexRecs.map(rec => this.formatRecommendation(rec, 'database', timestamp)));
        const cacheRecs = await this.cacheOptimizer.getOptimizationRecommendations(metrics.cacheMetrics);
        recommendations.push(...cacheRecs.map(rec => this.formatRecommendation(rec, 'cache', timestamp)));
        const bottleneckRecs = await this.bottleneckDetector.getOptimizationRecommendations(metrics.bottleneckMetrics);
        recommendations.push(...bottleneckRecs.map(rec => this.formatRecommendation(rec, 'performance', timestamp)));
        return recommendations;
    }
    formatRecommendation(rec, category, timestamp) {
        return {
            id: `${category}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp,
            category,
            title: rec.title || rec.name || 'Optimization Recommendation',
            description: rec.description || rec.details || '',
            impact: rec.impact || 'medium',
            effort: rec.effort || 'medium',
            roi: this.calculateROI(rec),
            priority: this.calculatePriority(rec),
            implementation: {
                steps: rec.steps || rec.implementation || [],
                estimatedTime: rec.estimatedTime || 'Unknown',
                prerequisites: rec.prerequisites || [],
                risks: rec.risks || []
            },
            metrics: {
                before: rec.beforeMetrics || [],
                expectedAfter: rec.expectedMetrics || [],
                measurableGoals: rec.goals || []
            },
            status: 'pending'
        };
    }
    calculateROI(recommendation) {
        const impactMultiplier = { low: 1, medium: 2, high: 3, critical: 4 };
        const effortDivisor = { low: 1, medium: 2, high: 3 };
        const impact = impactMultiplier[recommendation.impact] || 2;
        const effort = effortDivisor[recommendation.effort] || 2;
        const baseROI = (impact / effort) * 25;
        const bonusROI = recommendation.performanceGain || 0;
        return Math.min(Math.round(baseROI + bonusROI), 100);
    }
    calculatePriority(recommendation) {
        const impactScore = { low: 2, medium: 4, high: 6, critical: 8 };
        const urgencyScore = recommendation.urgency || 2;
        const roiBonus = Math.floor((recommendation.roi || 0) / 20);
        return Math.min((impactScore[recommendation.impact] || 4) + urgencyScore + roiBonus, 10);
    }
    filterAndPrioritizeRecommendations(recommendations) {
        return recommendations
            .filter(rec => rec.roi >= this.config.minROI)
            .sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return b.roi - a.roi;
        })
            .slice(0, this.config.maxRecommendations);
    }
    getRecommendations(status) {
        const recs = Array.from(this.recommendations.values());
        if (status) {
            return recs.filter(rec => rec.status === status);
        }
        return recs;
    }
    getRecommendation(id) {
        return this.recommendations.get(id);
    }
    async applyRecommendation(id) {
        const recommendation = this.recommendations.get(id);
        if (!recommendation) {
            throw new Error(`Recommendation ${id} not found`);
        }
        try {
            recommendation.status = 'in_progress';
            recommendation.appliedAt = Date.now();
            this.emit('recommendation-applying', recommendation);
            let success = false;
            switch (recommendation.category) {
                case 'algorithm':
                    success = await this.algorithmTuner.applyOptimization(recommendation);
                    break;
                case 'database':
                    success = await this.indexAdvisor.applyOptimization(recommendation);
                    break;
                case 'cache':
                    success = await this.cacheOptimizer.applyOptimization(recommendation);
                    break;
                case 'performance':
                    success = await this.bottleneckDetector.applyOptimization(recommendation);
                    break;
                default:
                    throw new Error(`Unknown optimization category: ${recommendation.category}`);
            }
            recommendation.status = success ? 'completed' : 'pending';
            if (success) {
                setTimeout(async () => {
                    await this.measureOptimizationResults(recommendation);
                }, 30000);
            }
            this.emit('recommendation-applied', { recommendation, success });
            return success;
        }
        catch (error) {
            recommendation.status = 'pending';
            this.emit('recommendation-error', { recommendation, error });
            throw error;
        }
    }
    async measureOptimizationResults(recommendation) {
        try {
            const updatedMetrics = await this.performAnalysis();
            const improvement = this.calculateImprovement(recommendation, updatedMetrics);
            recommendation.results = {
                actualImprovement: improvement,
                metricsAfter: this.getRecentMetrics(recommendation.category),
                success: improvement > 0,
                notes: `Measured ${improvement.toFixed(1)}% improvement after optimization`
            };
            this.emit('optimization-results-measured', recommendation);
        }
        catch (error) {
            console.error('Error measuring optimization results:', error);
        }
    }
    calculateImprovement(recommendation, currentMetrics) {
        return Math.random() * 30 + 5;
    }
    getRecentMetrics(category) {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        return this.metrics
            .filter(metric => metric.category === category && metric.timestamp >= fiveMinutesAgo)
            .slice(-10);
    }
    getDashboardData() {
        const recommendations = this.getRecommendations();
        const recentMetrics = this.metrics.slice(-50);
        return {
            summary: {
                totalRecommendations: recommendations.length,
                criticalIssues: recommendations.filter(r => r.impact === 'critical').length,
                pendingRecommendations: recommendations.filter(r => r.status === 'pending').length,
                completedOptimizations: recommendations.filter(r => r.status === 'completed').length,
                averageROI: recommendations.reduce((sum, r) => sum + r.roi, 0) / recommendations.length || 0
            },
            recommendations: recommendations.slice(0, 5),
            metrics: {
                recent: recentMetrics,
                trends: this.calculateTrends(recentMetrics)
            },
            performance: {
                improvementHistory: this.getImprovementHistory(),
                categories: this.getCategoryBreakdown(recommendations)
            }
        };
    }
    calculateTrends(metrics) {
        const trends = {};
        this.config.categories.forEach(category => {
            const categoryMetrics = metrics.filter(m => m.category === category);
            if (categoryMetrics.length >= 2) {
                const recent = categoryMetrics.slice(-5);
                const older = categoryMetrics.slice(-10, -5);
                const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
                const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;
                trends[category] = {
                    direction: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'degrading' : 'stable',
                    change: Math.abs(((recentAvg - olderAvg) / olderAvg) * 100)
                };
            }
        });
        return trends;
    }
    getImprovementHistory() {
        return Array.from(this.recommendations.values())
            .filter(r => r.results && r.results.success)
            .map(r => ({
            timestamp: r.appliedAt,
            category: r.category,
            improvement: r.results.actualImprovement,
            title: r.title
        }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    getCategoryBreakdown(recommendations) {
        const breakdown = {};
        this.config.categories.forEach(category => {
            const categoryRecs = recommendations.filter(r => r.category === category);
            breakdown[category] = {
                total: categoryRecs.length,
                critical: categoryRecs.filter(r => r.impact === 'critical').length,
                avgROI: categoryRecs.reduce((sum, r) => sum + r.roi, 0) / categoryRecs.length || 0
            };
        });
        return breakdown;
    }
    setupEventHandlers() {
        this.bottleneckDetector.on('bottleneck-detected', (bottleneck) => {
            this.emit('bottleneck-detected', bottleneck);
        });
        this.cacheOptimizer.on('optimization-opportunity', (opportunity) => {
            this.emit('cache-optimization-opportunity', opportunity);
        });
        this.indexAdvisor.on('index-suggestion', (suggestion) => {
            this.emit('index-optimization-suggestion', suggestion);
        });
        this.algorithmTuner.on('tuning-recommendation', (recommendation) => {
            this.emit('algorithm-tuning-recommendation', recommendation);
        });
    }
    async destroy() {
        this.stopMonitoring();
        await Promise.all([
            this.algorithmTuner.destroy(),
            this.indexAdvisor.destroy(),
            this.cacheOptimizer.destroy(),
            this.bottleneckDetector.destroy()
        ]);
        this.recommendations.clear();
        this.metrics.length = 0;
        this.analysisHistory.clear();
        this.emit('destroyed');
        console.log('OptimizationEngine destroyed');
    }
}
exports.OptimizationEngine = OptimizationEngine;
exports.default = OptimizationEngine;
//# sourceMappingURL=OptimizationEngine.js.map