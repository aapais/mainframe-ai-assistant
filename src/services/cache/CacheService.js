"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const LRUCache_1 = tslib_1.__importDefault(require("./LRUCache"));
const PredictiveCache_1 = require("./PredictiveCache");
const IncrementalLoader_1 = require("./IncrementalLoader");
class CacheService extends events_1.EventEmitter {
    config;
    lruCache;
    predictiveCache;
    incrementalLoader;
    cacheWarmer;
    metrics;
    requestHistory = [];
    activeOperations = new Map();
    constructor(config = {}) {
        super();
        this.config = this.mergeConfig(config);
        this.initializeComponents();
        this.initializeMetrics();
        this.startPerformanceMonitoring();
    }
    async get(key) {
        const startTime = performance.now();
        const keyString = this.generateCacheKey(key);
        try {
            const lruResult = await this.lruCache.get(keyString);
            if (lruResult !== null) {
                this.recordHit(keyString, performance.now() - startTime, this.estimateSize(lruResult));
                return lruResult;
            }
            this.recordMiss(keyString, performance.now() - startTime);
            if (key.userContext && this.config.predictive.enableMLPredictions) {
                this.triggerPredictiveLoading(key);
            }
            return null;
        }
        catch (error) {
            console.error('Cache get error:', error);
            this.recordMiss(keyString, performance.now() - startTime);
            return null;
        }
    }
    async set(key, value, options) {
        const keyString = this.generateCacheKey(key);
        try {
            const ttl = options?.ttl || this.config.lru.defaultTTL;
            const success = await this.lruCache.set(keyString, value, ttl);
            if (success && options?.metadata) {
                this.storeMetadata(keyString, options.metadata);
            }
            this.emit('cache-set', { key: keyString, size: this.estimateSize(value) });
            return success;
        }
        catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }
    async delete(key) {
        const keyString = this.generateCacheKey(key);
        try {
            const result = await this.lruCache.delete(keyString);
            if (result) {
                this.emit('cache-delete', { key: keyString });
            }
            return result;
        }
        catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }
    async has(key) {
        const keyString = this.generateCacheKey(key);
        try {
            return await this.lruCache.has(keyString);
        }
        catch (error) {
            console.error('Cache has error:', error);
            return false;
        }
    }
    async clear() {
        try {
            await this.lruCache.clear();
            this.resetMetrics();
            this.emit('cache-cleared');
        }
        catch (error) {
            console.error('Cache clear error:', error);
            throw error;
        }
    }
    async loadIncremental(request, dataSource) {
        const operationId = `load-${request.id}`;
        if (this.activeOperations.has(operationId)) {
            return this.activeOperations.get(operationId);
        }
        const operation = this.incrementalLoader.load(request, dataSource);
        this.activeOperations.set(operationId, operation);
        try {
            const result = await operation;
            await this.set({
                type: 'data',
                id: request.id,
                params: { query: request.query }
            }, result, {
                ttl: 600000,
                priority: request.priority,
                metadata: { incremental: true, size: result.length }
            });
            return result;
        }
        finally {
            this.activeOperations.delete(operationId);
        }
    }
    async warmCache(strategy, userContext) {
        if (!this.cacheWarmer) {
            throw new Error('Cache warmer not initialized');
        }
        if (strategy) {
            return await this.cacheWarmer.warmCache(strategy, userContext);
        }
        else {
            const metrics = this.getMetrics();
            return await this.cacheWarmer.adaptiveWarming({
                hitRate: metrics.overall.cacheHits / metrics.overall.totalRequests,
                avgResponseTime: metrics.overall.averageResponseTime,
                throughput: metrics.overall.throughput,
                errorRate: 0
            });
        }
    }
    recordSearchEvent(sessionId, event, userId) {
        if (this.predictiveCache) {
            this.predictiveCache.recordSearchEvent(sessionId, event, userId);
        }
    }
    async getPredictions(sessionId, userId, context) {
        if (!this.predictiveCache)
            return [];
        return await this.predictiveCache.getPredictions(sessionId, userId, context);
    }
    getMetrics() {
        this.updateMetrics();
        return { ...this.metrics };
    }
    getPerformanceStats() {
        const recentRequests = this.requestHistory
            .filter(r => Date.now() - r.timestamp < 3600000);
        if (recentRequests.length === 0) {
            return {
                hitRate: 0,
                missRate: 0,
                averageResponseTime: 0,
                throughput: 0,
                hotKeys: [],
                recommendations: ['No cache activity in the last hour']
            };
        }
        const hits = recentRequests.filter(r => r.hit);
        const hitRate = hits.length / recentRequests.length;
        const missRate = 1 - hitRate;
        const averageResponseTime = recentRequests
            .reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length;
        const throughput = recentRequests.length / 3600;
        const keyStats = new Map();
        recentRequests.forEach(r => {
            const current = keyStats.get(r.key) || { hitCount: 0, totalResponseTime: 0, requests: 0 };
            keyStats.set(r.key, {
                hitCount: current.hitCount + (r.hit ? 1 : 0),
                totalResponseTime: current.totalResponseTime + r.responseTime,
                requests: current.requests + 1
            });
        });
        const hotKeys = Array.from(keyStats.entries())
            .map(([key, stats]) => ({
            key,
            hitCount: stats.hitCount,
            avgResponseTime: stats.totalResponseTime / stats.requests
        }))
            .sort((a, b) => b.hitCount - a.hitCount)
            .slice(0, 10);
        const recommendations = this.generateRecommendations(hitRate, averageResponseTime, throughput);
        return {
            hitRate,
            missRate,
            averageResponseTime,
            throughput,
            hotKeys,
            recommendations
        };
    }
    async optimize() {
        const actions = [];
        let estimatedImprovement = 0;
        if (this.lruCache) {
            this.lruCache.optimize();
            actions.push('LRU cache optimization');
            estimatedImprovement += 0.05;
        }
        if (this.incrementalLoader) {
            this.incrementalLoader.optimizeChunkSizes();
            actions.push('Incremental loader chunk size optimization');
            estimatedImprovement += 0.03;
        }
        if (this.predictiveCache) {
            await this.predictiveCache.trainModels();
            actions.push('Predictive model training');
            estimatedImprovement += 0.08;
        }
        const newConfig = this.adaptConfiguration();
        actions.push('Configuration adaptation');
        estimatedImprovement += 0.02;
        return {
            actionsPerformed: actions,
            estimatedImprovement,
            newConfiguration: newConfig
        };
    }
    async destroy() {
        try {
            if (this.lruCache) {
                this.lruCache.destroy();
            }
            if (this.cacheWarmer) {
                await this.cacheWarmer.stopScheduledWarming();
            }
            this.removeAllListeners();
            this.activeOperations.clear();
            console.log('Cache service destroyed');
        }
        catch (error) {
            console.error('Error during cache service destruction:', error);
            throw error;
        }
    }
    mergeConfig(config) {
        return {
            lru: {
                maxSize: 1000,
                maxMemoryMB: 100,
                defaultTTL: 300000,
                evictionPolicy: 'ADAPTIVE',
                ...config.lru
            },
            predictive: {
                enableMLPredictions: true,
                maxPredictions: 50,
                confidenceThreshold: 0.7,
                predictionHorizon: 30,
                ...config.predictive
            },
            incremental: {
                defaultChunkSize: 100,
                maxParallelLoads: 3,
                enableAdaptiveChunking: true,
                ...config.incremental
            },
            warming: config.warming || {},
            performance: {
                enableMetrics: true,
                metricsRetentionDays: 7,
                enableAlerts: true,
                ...config.performance
            }
        };
    }
    initializeComponents() {
        this.lruCache = new LRUCache_1.default({
            maxSize: this.config.lru.maxSize,
            maxMemoryMB: this.config.lru.maxMemoryMB,
            defaultTTL: this.config.lru.defaultTTL,
            evictionPolicy: this.config.lru.evictionPolicy,
            enableStats: this.config.performance.enableMetrics
        });
        this.predictiveCache = new PredictiveCache_1.PredictiveCache({
            enableMLPredictions: this.config.predictive.enableMLPredictions,
            maxPredictions: this.config.predictive.maxPredictions,
            confidenceThreshold: this.config.predictive.confidenceThreshold,
            predictionHorizon: this.config.predictive.predictionHorizon
        });
        const chunkCache = {
            get: (key) => this.lruCache.get(`chunk:${key}`),
            set: (key, chunk, ttl) => {
                this.lruCache.set(`chunk:${key}`, chunk, ttl);
            },
            delete: (key) => this.lruCache.delete(`chunk:${key}`),
            clear: () => this.lruCache.clear(),
            get size() { return 0; }
        };
        this.incrementalLoader = new IncrementalLoader_1.IncrementalLoader(chunkCache, {
            defaultChunkSize: this.config.incremental.defaultChunkSize,
            maxParallelLoads: this.config.incremental.maxParallelLoads,
            enableAdaptiveChunking: this.config.incremental.enableAdaptiveChunking
        });
    }
    initializeMetrics() {
        this.metrics = {
            lru: {
                hitRate: 0,
                size: 0,
                memoryUsage: 0,
                evictions: 0
            },
            predictive: {
                totalPredictions: 0,
                successfulPredictions: 0,
                predictionAccuracy: 0
            },
            incremental: {
                activeLoads: 0,
                averageLoadTime: 0,
                cacheHitRate: 0
            },
            warming: {
                totalWarmed: 0,
                avgHitRateImprovement: 0,
                successRate: 0
            },
            overall: {
                totalRequests: 0,
                cacheHits: 0,
                cacheMisses: 0,
                averageResponseTime: 0,
                throughput: 0
            }
        };
    }
    updateMetrics() {
        if (this.lruCache) {
            const lruStats = this.lruCache.getStats();
            this.metrics.lru = {
                hitRate: lruStats.hitRate,
                size: lruStats.size,
                memoryUsage: lruStats.memoryUsage,
                evictions: lruStats.evictions
            };
        }
        if (this.predictiveCache) {
            const predictiveStats = this.predictiveCache.getStats();
            this.metrics.predictive = {
                totalPredictions: predictiveStats.totalPredictions,
                successfulPredictions: predictiveStats.successfulPredictions,
                predictionAccuracy: predictiveStats.predictionAccuracy
            };
        }
        if (this.incrementalLoader) {
            const incrementalStats = this.incrementalLoader.getStats();
            this.metrics.incremental = {
                activeLoads: incrementalStats.activeLoads,
                averageLoadTime: incrementalStats.averageLoadTime,
                cacheHitRate: incrementalStats.cacheHitRate
            };
        }
        this.updateOverallMetrics();
    }
    updateOverallMetrics() {
        const recentRequests = this.requestHistory
            .filter(r => Date.now() - r.timestamp < 3600000);
        if (recentRequests.length === 0)
            return;
        const hits = recentRequests.filter(r => r.hit);
        this.metrics.overall = {
            totalRequests: recentRequests.length,
            cacheHits: hits.length,
            cacheMisses: recentRequests.length - hits.length,
            averageResponseTime: recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length,
            throughput: recentRequests.length / 3600
        };
    }
    recordHit(key, responseTime, size) {
        this.requestHistory.push({
            key,
            hit: true,
            responseTime,
            timestamp: Date.now(),
            size
        });
        this.cleanupRequestHistory();
    }
    recordMiss(key, responseTime) {
        this.requestHistory.push({
            key,
            hit: false,
            responseTime,
            timestamp: Date.now(),
            size: 0
        });
        this.cleanupRequestHistory();
    }
    cleanupRequestHistory() {
        const cutoff = Date.now() - (this.config.performance.metricsRetentionDays * 24 * 60 * 60 * 1000);
        this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);
    }
    generateCacheKey(key) {
        const parts = [key.type, key.id];
        if (key.params) {
            const paramString = Object.entries(key.params)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => `${k}:${v}`)
                .join('|');
            parts.push(paramString);
        }
        if (key.userContext) {
            parts.push(`user:${key.userContext}`);
        }
        return parts.join(':');
    }
    estimateSize(value) {
        try {
            return JSON.stringify(value).length * 2;
        }
        catch {
            return 1000;
        }
    }
    storeMetadata(key, metadata) {
    }
    async triggerPredictiveLoading(key) {
        if (!this.predictiveCache || !key.userContext)
            return;
        try {
            const predictions = await this.predictiveCache.getPredictions(key.userContext, undefined, { currentKey: key });
            for (const prediction of predictions.slice(0, 3)) {
                if (prediction.confidence > 0.8) {
                    this.emit('prediction-trigger', { prediction, originalKey: key });
                }
            }
        }
        catch (error) {
            console.warn('Predictive loading trigger failed:', error);
        }
    }
    resetMetrics() {
        this.initializeMetrics();
        this.requestHistory = [];
    }
    generateRecommendations(hitRate, avgResponseTime, throughput) {
        const recommendations = [];
        if (hitRate < 0.7) {
            recommendations.push('Consider increasing cache size or TTL');
            recommendations.push('Enable cache warming for frequently accessed data');
        }
        if (avgResponseTime > 1000) {
            recommendations.push('Optimize data serialization/deserialization');
            recommendations.push('Consider using incremental loading for large datasets');
        }
        if (throughput < 10) {
            recommendations.push('Enable predictive caching to reduce cold starts');
        }
        if (recommendations.length === 0) {
            recommendations.push('Cache performance is optimal');
        }
        return recommendations;
    }
    adaptConfiguration() {
        const stats = this.getPerformanceStats();
        const adaptations = {};
        if (stats.hitRate < 0.6) {
            adaptations.lru = {
                ...this.config.lru,
                maxSize: Math.floor(this.config.lru.maxSize * 1.2),
                defaultTTL: Math.floor(this.config.lru.defaultTTL * 1.1)
            };
        }
        if (stats.averageResponseTime > 500) {
            adaptations.incremental = {
                ...this.config.incremental,
                defaultChunkSize: Math.floor(this.config.incremental.defaultChunkSize * 0.8)
            };
        }
        return adaptations;
    }
    startPerformanceMonitoring() {
        setInterval(() => {
            this.updateMetrics();
            if (this.config.performance.enableAlerts) {
                this.checkPerformanceAlerts();
            }
        }, 60000);
        setInterval(() => {
            this.cleanupRequestHistory();
        }, 3600000);
    }
    checkPerformanceAlerts() {
        const stats = this.getPerformanceStats();
        if (stats.hitRate < 0.5) {
            this.emit('performance-alert', {
                type: 'low-hit-rate',
                value: stats.hitRate,
                message: 'Cache hit rate is below 50%'
            });
        }
        if (stats.averageResponseTime > 2000) {
            this.emit('performance-alert', {
                type: 'high-response-time',
                value: stats.averageResponseTime,
                message: 'Average response time exceeds 2 seconds'
            });
        }
    }
}
exports.CacheService = CacheService;
exports.default = CacheService;
//# sourceMappingURL=CacheService.js.map