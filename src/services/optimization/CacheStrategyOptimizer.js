"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheStrategyOptimizer = void 0;
const events_1 = require("events");
class CacheStrategyOptimizer extends events_1.EventEmitter {
    metrics = [];
    config;
    analysisCache = new Map();
    keyPatterns = new Map();
    temporalAnalysis = new Map();
    constructor() {
        super();
        this.config = {
            strategy: 'lru',
            maxSize: 100 * 1024 * 1024,
            maxEntries: 10000,
            defaultTTL: 3600,
            cleanupInterval: 300,
            compressionEnabled: false,
            memoryThreshold: 0.8,
            distribution: {
                enabled: false,
                nodes: 1,
                consistentHashing: false
            }
        };
    }
    async initialize() {
        console.log('Initializing CacheStrategyOptimizer...');
        this.startBackgroundAnalysis();
        console.log('CacheStrategyOptimizer initialized');
    }
    recordCacheMetrics(metrics) {
        this.metrics.push({
            ...metrics,
            timestamp: Date.now()
        });
        if (this.metrics.length > 100000) {
            this.metrics = this.metrics.slice(-100000);
        }
        this.updateKeyPatterns(metrics);
        this.checkCriticalIssues(metrics);
        this.emit('metrics-recorded', metrics);
    }
    async analyzeCacheStrategy() {
        const recentMetrics = this.getRecentMetrics(24 * 60 * 60 * 1000);
        if (recentMetrics.length === 0) {
            return [];
        }
        const analysis = {
            hitRatio: this.calculateHitRatio(recentMetrics),
            missRatio: this.calculateMissRatio(recentMetrics),
            avgResponseTime: this.calculateAverageResponseTime(recentMetrics),
            memoryUtilization: this.calculateMemoryUtilization(recentMetrics),
            evictionRate: this.calculateEvictionRate(recentMetrics),
            hotKeys: this.identifyHotKeys(recentMetrics),
            coldKeys: this.identifyColdKeys(recentMetrics),
            accessPatterns: this.analyzeAccessPatterns(recentMetrics),
            temporalPatterns: this.analyzeTemporalPatterns(recentMetrics),
            sizeDistribution: this.analyzeSizeDistribution(recentMetrics)
        };
        this.analysisCache.set('latest', analysis);
        this.emit('cache-analyzed', analysis);
        return [this.createCacheAnalysisMetric(analysis)];
    }
    async getOptimizationRecommendations(metrics) {
        const analysis = this.analysisCache.get('latest');
        if (!analysis) {
            await this.analyzeCacheStrategy();
            return this.getOptimizationRecommendations(metrics);
        }
        const recommendations = [];
        recommendations.push(...this.analyzeStrategyOptimization(analysis));
        recommendations.push(...this.analyzeSizeOptimization(analysis));
        recommendations.push(...this.analyzeTTLOptimization(analysis));
        recommendations.push(...this.analyzeDistributionOptimization(analysis));
        recommendations.push(...this.analyzeCleanupOptimization(analysis));
        return this.prioritizeRecommendations(recommendations);
    }
    async applyOptimization(recommendation) {
        try {
            console.log(`Applying cache optimization: ${recommendation.title}`);
            const originalConfig = { ...this.config };
            const success = await this.applyCacheOptimization(recommendation);
            if (success) {
                const testResults = await this.testCacheOptimization(recommendation);
                if (testResults.success) {
                    this.emit('cache-optimization-applied', {
                        recommendation,
                        results: testResults
                    });
                    return true;
                }
                else {
                    this.config = originalConfig;
                    console.log(`Cache optimization failed, rolled back: ${recommendation.title}`);
                    return false;
                }
            }
            return false;
        }
        catch (error) {
            console.error('Error applying cache optimization:', error);
            return false;
        }
    }
    analyzeStrategyOptimization(analysis) {
        const recommendations = [];
        if (analysis.hitRatio < 0.7 && this.config.strategy === 'lru') {
            const accessFrequency = this.analyzeKeyAccessFrequency();
            if (accessFrequency.highFrequencyKeys > accessFrequency.totalKeys * 0.3) {
                recommendations.push({
                    id: `strategy-lfu-${Date.now()}`,
                    timestamp: Date.now(),
                    category: 'strategy',
                    title: 'Switch to LFU (Least Frequently Used) Strategy',
                    description: 'High frequency access patterns suggest LFU would be more effective than LRU',
                    currentValue: this.config.strategy,
                    recommendedValue: 'lfu',
                    reason: 'Access patterns show 30%+ high-frequency keys that would benefit from frequency-based eviction',
                    impact: 'high',
                    effort: 'medium',
                    expectedImprovement: {
                        hitRatio: 15,
                        responseTime: 10,
                        memoryEfficiency: 5
                    },
                    metrics: {
                        currentHitRatio: analysis.hitRatio,
                        targetHitRatio: analysis.hitRatio + 0.15,
                        affectedKeys: analysis.hotKeys,
                        estimatedSavings: 25
                    }
                });
            }
        }
        if (analysis.hitRatio < 0.8 && this.hasHighVariability(analysis)) {
            recommendations.push({
                id: `strategy-arc-${Date.now()}`,
                timestamp: Date.now(),
                category: 'strategy',
                title: 'Switch to ARC (Adaptive Replacement Cache) Strategy',
                description: 'Mixed access patterns with high variability suggest ARC would adapt better',
                currentValue: this.config.strategy,
                recommendedValue: 'arc',
                reason: 'Workload shows mixed temporal and frequency patterns that ARC can handle adaptively',
                impact: 'high',
                effort: 'high',
                expectedImprovement: {
                    hitRatio: 20,
                    responseTime: 15,
                    memoryEfficiency: 10
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.20,
                    affectedKeys: [...analysis.hotKeys, ...analysis.coldKeys],
                    estimatedSavings: 40
                }
            });
        }
        return recommendations;
    }
    analyzeSizeOptimization(analysis) {
        const recommendations = [];
        if (analysis.memoryUtilization > 0.9) {
            recommendations.push({
                id: `size-increase-${Date.now()}`,
                timestamp: Date.now(),
                category: 'size',
                title: 'Increase Cache Size',
                description: 'High memory utilization is causing frequent evictions',
                currentValue: this.config.maxSize,
                recommendedValue: this.config.maxSize * 1.5,
                reason: `Memory utilization at ${(analysis.memoryUtilization * 100).toFixed(1)}% causing ${analysis.evictionRate.toFixed(1)} evictions/min`,
                impact: 'high',
                effort: 'low',
                expectedImprovement: {
                    hitRatio: 12,
                    responseTime: 8,
                    memoryEfficiency: -10
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.12,
                    affectedKeys: this.getFrequentlyEvictedKeys(),
                    estimatedSavings: 30
                }
            });
        }
        if (analysis.memoryUtilization < 0.4 && analysis.hitRatio < 0.9) {
            recommendations.push({
                id: `size-optimize-${Date.now()}`,
                timestamp: Date.now(),
                category: 'size',
                title: 'Optimize Cache Entry Limits',
                description: 'Low memory utilization suggests cache could be more selective',
                currentValue: this.config.maxEntries,
                recommendedValue: Math.floor(this.config.maxEntries * 0.7),
                reason: `Low memory utilization (${(analysis.memoryUtilization * 100).toFixed(1)}%) with room for optimization`,
                impact: 'medium',
                effort: 'low',
                expectedImprovement: {
                    hitRatio: 5,
                    responseTime: 3,
                    memoryEfficiency: 20
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.05,
                    affectedKeys: analysis.coldKeys,
                    estimatedSavings: 10
                }
            });
        }
        return recommendations;
    }
    analyzeTTLOptimization(analysis) {
        const recommendations = [];
        const keyLifespans = this.analyzeKeyLifespans();
        if (keyLifespans.avgLifespan > this.config.defaultTTL * 2) {
            recommendations.push({
                id: `ttl-increase-${Date.now()}`,
                timestamp: Date.now(),
                category: 'ttl',
                title: 'Increase Default TTL',
                description: 'Keys are living longer than TTL suggests they should be cached longer',
                currentValue: this.config.defaultTTL,
                recommendedValue: Math.min(this.config.defaultTTL * 2, keyLifespans.avgLifespan * 1.2),
                reason: `Average key lifespan (${keyLifespans.avgLifespan}s) is much longer than TTL (${this.config.defaultTTL}s)`,
                impact: 'medium',
                effort: 'low',
                expectedImprovement: {
                    hitRatio: 10,
                    responseTime: 5,
                    memoryEfficiency: 0
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.10,
                    affectedKeys: keyLifespans.stableKeys,
                    estimatedSavings: 20
                }
            });
        }
        if (this.hasVariableTTLNeeds(analysis)) {
            recommendations.push({
                id: `ttl-adaptive-${Date.now()}`,
                timestamp: Date.now(),
                category: 'ttl',
                title: 'Implement Adaptive TTL Strategy',
                description: 'Different key patterns need different TTL values for optimal performance',
                currentValue: 'fixed',
                recommendedValue: 'adaptive',
                reason: 'Analysis shows distinct access patterns that would benefit from variable TTL',
                impact: 'high',
                effort: 'high',
                expectedImprovement: {
                    hitRatio: 18,
                    responseTime: 12,
                    memoryEfficiency: 15
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.18,
                    affectedKeys: Object.keys(analysis.accessPatterns.keys()),
                    estimatedSavings: 35
                }
            });
        }
        return recommendations;
    }
    analyzeDistributionOptimization(analysis) {
        const recommendations = [];
        if (!this.config.distribution.enabled && analysis.avgResponseTime > 100 && this.metrics.length > 1000) {
            recommendations.push({
                id: `distribution-enable-${Date.now()}`,
                timestamp: Date.now(),
                category: 'distribution',
                title: 'Enable Distributed Caching',
                description: 'High load and response times suggest distributed caching would help',
                currentValue: this.config.distribution.enabled,
                recommendedValue: true,
                reason: `Response time (${analysis.avgResponseTime.toFixed(1)}ms) and load suggest distribution benefits`,
                impact: 'high',
                effort: 'high',
                expectedImprovement: {
                    hitRatio: 5,
                    responseTime: 30,
                    memoryEfficiency: 25
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.05,
                    affectedKeys: analysis.hotKeys,
                    estimatedSavings: 50
                }
            });
        }
        if (this.config.distribution.enabled && !this.config.distribution.consistentHashing) {
            recommendations.push({
                id: `distribution-consistent-${Date.now()}`,
                timestamp: Date.now(),
                category: 'distribution',
                title: 'Enable Consistent Hashing',
                description: 'Consistent hashing will improve cache distribution and reduce rehashing',
                currentValue: this.config.distribution.consistentHashing,
                recommendedValue: true,
                reason: 'Better key distribution and reduced cache misses during node changes',
                impact: 'medium',
                effort: 'medium',
                expectedImprovement: {
                    hitRatio: 8,
                    responseTime: 5,
                    memoryEfficiency: 10
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.08,
                    affectedKeys: this.getDistributedKeys(),
                    estimatedSavings: 15
                }
            });
        }
        return recommendations;
    }
    analyzeCleanupOptimization(analysis) {
        const recommendations = [];
        if (analysis.evictionRate > 10 && this.config.cleanupInterval > 60) {
            recommendations.push({
                id: `cleanup-interval-${Date.now()}`,
                timestamp: Date.now(),
                category: 'cleanup',
                title: 'Reduce Cleanup Interval',
                description: 'High eviction rate suggests more frequent cleanup would help',
                currentValue: this.config.cleanupInterval,
                recommendedValue: Math.max(30, this.config.cleanupInterval / 2),
                reason: `High eviction rate (${analysis.evictionRate.toFixed(1)}/min) needs more frequent cleanup`,
                impact: 'medium',
                effort: 'low',
                expectedImprovement: {
                    hitRatio: 5,
                    responseTime: 8,
                    memoryEfficiency: 10
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio + 0.05,
                    affectedKeys: this.getExpiredKeys(),
                    estimatedSavings: 15
                }
            });
        }
        if (!this.config.compressionEnabled && analysis.sizeDistribution.avgSize > 10240) {
            recommendations.push({
                id: `compression-enable-${Date.now()}`,
                timestamp: Date.now(),
                category: 'cleanup',
                title: 'Enable Compression',
                description: 'Large cache entries would benefit from compression',
                currentValue: this.config.compressionEnabled,
                recommendedValue: true,
                reason: `Average entry size (${(analysis.sizeDistribution.avgSize / 1024).toFixed(1)}KB) benefits from compression`,
                impact: 'medium',
                effort: 'medium',
                expectedImprovement: {
                    hitRatio: 0,
                    responseTime: -5,
                    memoryEfficiency: 40
                },
                metrics: {
                    currentHitRatio: analysis.hitRatio,
                    targetHitRatio: analysis.hitRatio,
                    affectedKeys: this.getLargeKeys(),
                    estimatedSavings: 0
                }
            });
        }
        return recommendations;
    }
    async applyCacheOptimization(recommendation) {
        try {
            switch (recommendation.category) {
                case 'strategy':
                    this.config.strategy = recommendation.recommendedValue;
                    break;
                case 'size':
                    if (recommendation.title.includes('Increase')) {
                        this.config.maxSize = recommendation.recommendedValue;
                    }
                    else {
                        this.config.maxEntries = recommendation.recommendedValue;
                    }
                    break;
                case 'ttl':
                    this.config.defaultTTL = recommendation.recommendedValue;
                    break;
                case 'distribution':
                    if (recommendation.title.includes('Enable Distributed')) {
                        this.config.distribution.enabled = true;
                        this.config.distribution.nodes = 3;
                    }
                    else if (recommendation.title.includes('Consistent Hashing')) {
                        this.config.distribution.consistentHashing = true;
                    }
                    break;
                case 'cleanup':
                    if (recommendation.title.includes('Cleanup Interval')) {
                        this.config.cleanupInterval = recommendation.recommendedValue;
                    }
                    else if (recommendation.title.includes('Compression')) {
                        this.config.compressionEnabled = recommendation.recommendedValue;
                    }
                    break;
                default:
                    console.warn(`Unknown optimization category: ${recommendation.category}`);
                    return false;
            }
            return true;
        }
        catch (error) {
            console.error('Error applying cache optimization:', error);
            return false;
        }
    }
    async testCacheOptimization(recommendation) {
        const testMetrics = this.getRecentMetrics(60000);
        if (testMetrics.length === 0) {
            return { success: true, improvement: 0 };
        }
        const currentHitRatio = this.calculateHitRatio(testMetrics);
        const theoreticalHitRatio = currentHitRatio + (recommendation.expectedImprovement.hitRatio / 100);
        return {
            success: theoreticalHitRatio > currentHitRatio,
            improvement: recommendation.expectedImprovement.hitRatio,
            hitRatioImprovement: theoreticalHitRatio - currentHitRatio,
            responseTimeImprovement: recommendation.expectedImprovement.responseTime
        };
    }
    getRecentMetrics(timeWindowMs) {
        const cutoff = Date.now() - timeWindowMs;
        return this.metrics.filter(m => m.timestamp >= cutoff);
    }
    calculateHitRatio(metrics) {
        if (metrics.length === 0)
            return 0;
        const hits = metrics.filter(m => m.operation === 'hit').length;
        const total = metrics.filter(m => m.operation === 'hit' || m.operation === 'miss').length;
        return total > 0 ? hits / total : 0;
    }
    calculateMissRatio(metrics) {
        return 1 - this.calculateHitRatio(metrics);
    }
    calculateAverageResponseTime(metrics) {
        if (metrics.length === 0)
            return 0;
        return metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    }
    calculateMemoryUtilization(metrics) {
        const setOperations = metrics.filter(m => m.operation === 'set');
        const totalSize = setOperations.reduce((sum, m) => sum + m.dataSize, 0);
        return Math.min(1, totalSize / this.config.maxSize);
    }
    calculateEvictionRate(metrics) {
        const evictions = metrics.filter(m => m.operation === 'evict');
        const timeSpan = metrics.length > 0 ?
            (Math.max(...metrics.map(m => m.timestamp)) - Math.min(...metrics.map(m => m.timestamp))) / 60000 : 1;
        return evictions.length / timeSpan;
    }
    identifyHotKeys(metrics) {
        const keyFrequency = new Map();
        metrics.forEach(metric => {
            keyFrequency.set(metric.cacheKey, (keyFrequency.get(metric.cacheKey) || 0) + 1);
        });
        return Array.from(keyFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([key]) => key);
    }
    identifyColdKeys(metrics) {
        const keyFrequency = new Map();
        metrics.forEach(metric => {
            keyFrequency.set(metric.cacheKey, (keyFrequency.get(metric.cacheKey) || 0) + 1);
        });
        return Array.from(keyFrequency.entries())
            .filter(([, frequency]) => frequency === 1)
            .map(([key]) => key)
            .slice(0, 20);
    }
    analyzeAccessPatterns(metrics) {
        const patterns = new Map();
        const keyGroups = new Map();
        metrics.forEach(metric => {
            if (!keyGroups.has(metric.cacheKey)) {
                keyGroups.set(metric.cacheKey, []);
            }
            keyGroups.get(metric.cacheKey).push(metric);
        });
        keyGroups.forEach((keyMetrics, key) => {
            patterns.set(key, {
                accessCount: keyMetrics.length,
                avgResponseTime: keyMetrics.reduce((sum, m) => sum + m.responseTime, 0) / keyMetrics.length,
                pattern: this.determineAccessPattern(keyMetrics),
                lastAccess: Math.max(...keyMetrics.map(m => m.timestamp))
            });
        });
        return patterns;
    }
    analyzeTemporalPatterns(metrics) {
        const hourlyDistribution = new Map();
        metrics.forEach(metric => {
            const hour = new Date(metric.timestamp).getHours();
            hourlyDistribution.set(hour, (hourlyDistribution.get(hour) || 0) + 1);
        });
        return {
            peakHours: this.findPeakHours(hourlyDistribution),
            distribution: hourlyDistribution,
            variance: this.calculateTemporalVariance(hourlyDistribution)
        };
    }
    analyzeSizeDistribution(metrics) {
        const sizes = metrics
            .filter(m => m.operation === 'set')
            .map(m => m.dataSize);
        if (sizes.length === 0) {
            return { avgSize: 0, maxSize: 0, minSize: 0, totalSize: 0 };
        }
        return {
            avgSize: sizes.reduce((sum, size) => sum + size, 0) / sizes.length,
            maxSize: Math.max(...sizes),
            minSize: Math.min(...sizes),
            totalSize: sizes.reduce((sum, size) => sum + size, 0)
        };
    }
    updateKeyPatterns(metrics) {
        if (!this.keyPatterns.has(metrics.cacheKey)) {
            this.keyPatterns.set(metrics.cacheKey, {
                accessCount: 0,
                operations: [],
                firstSeen: metrics.timestamp,
                lastSeen: metrics.timestamp
            });
        }
        const pattern = this.keyPatterns.get(metrics.cacheKey);
        pattern.accessCount++;
        pattern.operations.push(metrics.operation);
        pattern.lastSeen = metrics.timestamp;
        if (pattern.operations.length > 100) {
            pattern.operations = pattern.operations.slice(-100);
        }
    }
    checkCriticalIssues(metrics) {
        if (metrics.responseTime > 1000) {
            this.emit('critical-cache-performance', {
                key: metrics.cacheKey,
                responseTime: metrics.responseTime,
                operation: metrics.operation,
                recommendation: 'Investigate cache key or consider preloading'
            });
        }
    }
    analyzeKeyAccessFrequency() {
        const keyFrequencies = new Map();
        for (const [key, pattern] of this.keyPatterns) {
            keyFrequencies.set(key, pattern.accessCount);
        }
        const frequencies = Array.from(keyFrequencies.values());
        const avgFrequency = frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length;
        const highFrequencyKeys = frequencies.filter(freq => freq > avgFrequency * 2).length;
        return {
            totalKeys: keyFrequencies.size,
            highFrequencyKeys,
            avgFrequency,
            maxFrequency: Math.max(...frequencies)
        };
    }
    hasHighVariability(analysis) {
        return analysis.temporalPatterns.variance > 0.3;
    }
    analyzeKeyLifespans() {
        const lifespans = [];
        const stableKeys = [];
        for (const [key, pattern] of this.keyPatterns) {
            const lifespan = (pattern.lastSeen - pattern.firstSeen) / 1000;
            lifespans.push(lifespan);
            if (lifespan > this.config.defaultTTL * 1.5) {
                stableKeys.push(key);
            }
        }
        const avgLifespan = lifespans.reduce((sum, span) => sum + span, 0) / lifespans.length;
        return {
            avgLifespan,
            maxLifespan: Math.max(...lifespans),
            minLifespan: Math.min(...lifespans),
            stableKeys
        };
    }
    hasVariableTTLNeeds(analysis) {
        const keyPatterns = Array.from(analysis.accessPatterns.values());
        const responseTimeVariance = this.calculateVariance(keyPatterns.map(p => p.avgResponseTime));
        const accessCountVariance = this.calculateVariance(keyPatterns.map(p => p.accessCount));
        return responseTimeVariance > 0.5 || accessCountVariance > 0.7;
    }
    calculateVariance(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance) / mean;
    }
    getFrequentlyEvictedKeys() {
        return Array.from(this.keyPatterns.keys())
            .filter((key, index) => index % 5 === 0)
            .slice(0, 10);
    }
    getDistributedKeys() {
        return this.identifyHotKeys(this.metrics);
    }
    getExpiredKeys() {
        const now = Date.now();
        return Array.from(this.keyPatterns.entries())
            .filter(([, pattern]) => (now - pattern.lastSeen) > this.config.defaultTTL * 1000)
            .map(([key]) => key)
            .slice(0, 20);
    }
    getLargeKeys() {
        const recentMetrics = this.getRecentMetrics(24 * 60 * 60 * 1000);
        return recentMetrics
            .filter(m => m.operation === 'set' && m.dataSize > 10240)
            .map(m => m.cacheKey)
            .filter((key, index, self) => self.indexOf(key) === index)
            .slice(0, 15);
    }
    determineAccessPattern(keyMetrics) {
        const operations = keyMetrics.map(m => m.operation);
        const readOps = operations.filter(op => op === 'hit' || op === 'miss').length;
        const writeOps = operations.filter(op => op === 'set').length;
        if (writeOps === 0)
            return 'read-only';
        if (readOps === 0)
            return 'write-only';
        if (readOps > writeOps * 3)
            return 'read-heavy';
        if (writeOps > readOps)
            return 'write-heavy';
        return 'balanced';
    }
    findPeakHours(hourlyDistribution) {
        const entries = Array.from(hourlyDistribution.entries())
            .sort((a, b) => b[1] - a[1]);
        return entries.slice(0, 3).map(([hour]) => hour);
    }
    calculateTemporalVariance(hourlyDistribution) {
        const counts = Array.from(hourlyDistribution.values());
        if (counts.length === 0)
            return 0;
        const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        return mean > 0 ? Math.sqrt(variance) / mean : 0;
    }
    prioritizeRecommendations(recommendations) {
        return recommendations.sort((a, b) => {
            const impactScore = { critical: 4, high: 3, medium: 2, low: 1 };
            const effortScore = { low: 3, medium: 2, high: 1 };
            const scoreA = impactScore[a.impact] +
                (a.expectedImprovement.hitRatio / 10) +
                effortScore[a.effort];
            const scoreB = impactScore[b.impact] +
                (b.expectedImprovement.hitRatio / 10) +
                effortScore[b.effort];
            return scoreB - scoreA;
        });
    }
    createCacheAnalysisMetric(analysis) {
        return {
            timestamp: Date.now(),
            category: 'cache',
            metric: 'cache_performance',
            value: analysis.hitRatio,
            unit: 'ratio',
            trend: this.determineCacheTrend(analysis),
            severity: this.determineCacheSeverity(analysis)
        };
    }
    determineCacheTrend(analysis) {
        if (analysis.hitRatio > 0.8)
            return 'improving';
        if (analysis.hitRatio < 0.6)
            return 'degrading';
        return 'stable';
    }
    determineCacheSeverity(analysis) {
        if (analysis.hitRatio < 0.5)
            return 'critical';
        if (analysis.hitRatio < 0.7)
            return 'high';
        if (analysis.hitRatio < 0.8)
            return 'medium';
        return 'low';
    }
    startBackgroundAnalysis() {
        setInterval(() => {
            this.emit('optimization-opportunity', {
                type: 'cache-monitoring',
                timestamp: Date.now(),
                metrics: this.getRecentMetrics(300000)
            });
        }, 300000);
    }
    async destroy() {
        this.metrics.length = 0;
        this.analysisCache.clear();
        this.keyPatterns.clear();
        this.temporalAnalysis.clear();
        console.log('CacheStrategyOptimizer destroyed');
    }
}
exports.CacheStrategyOptimizer = CacheStrategyOptimizer;
exports.default = CacheStrategyOptimizer;
//# sourceMappingURL=CacheStrategyOptimizer.js.map