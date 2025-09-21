"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedSearchCache = void 0;
const tslib_1 = require("tslib");
const LRUCache_1 = tslib_1.__importDefault(require("../cache/LRUCache"));
const RedisCache_1 = tslib_1.__importDefault(require("../cache/RedisCache"));
const PredictiveCache_1 = tslib_1.__importDefault(require("../cache/PredictiveCache"));
const IncrementalLoader_1 = tslib_1.__importDefault(require("../cache/IncrementalLoader"));
const cacheConfig_1 = require("../../config/cacheConfig");
class EnhancedSearchCache {
    l0Cache;
    l1Cache;
    l2Cache;
    redisCache;
    predictiveCache;
    incrementalLoader;
    config;
    stats;
    constructor(config = {}) {
        this.config = { ...cacheConfig_1.cacheConfig, ...config };
        this.l0Cache = new LRUCache_1.default({
            maxSize: this.config.l0Cache.maxSize,
            maxMemoryMB: this.config.l0Cache.maxMemoryMB,
            defaultTTL: this.config.l0Cache.defaultTTL,
            evictionPolicy: this.config.l0Cache.evictionPolicy,
            enableStats: true,
            cleanupInterval: this.config.l0Cache.cleanupInterval
        });
        this.l1Cache = new LRUCache_1.default({
            maxSize: this.config.l1Cache.maxSize,
            maxMemoryMB: this.config.l1Cache.maxMemoryMB,
            defaultTTL: this.config.l1Cache.defaultTTL,
            evictionPolicy: this.config.l1Cache.evictionPolicy,
            enableStats: true,
            cleanupInterval: this.config.l1Cache.cleanupInterval
        });
        this.l2Cache = new LRUCache_1.default({
            maxSize: this.config.l2Cache.maxSize,
            maxMemoryMB: this.config.l2Cache.maxMemoryMB,
            defaultTTL: this.config.l2Cache.defaultTTL,
            evictionPolicy: this.config.l2Cache.evictionPolicy,
            enableStats: true,
            cleanupInterval: this.config.l2Cache.cleanupInterval
        });
        if (this.config.l3Redis.enabled) {
            this.redisCache = new RedisCache_1.default({
                host: this.config.l3Redis.host,
                port: this.config.l3Redis.port,
                password: this.config.l3Redis.password,
                db: this.config.l3Redis.db,
                keyPrefix: this.config.l3Redis.keyPrefix,
                defaultTTL: 600,
                maxRetries: this.config.l3Redis.maxRetries,
                retryDelayMs: this.config.l3Redis.retryDelayMs,
                enableCompression: true,
                compressionThreshold: 1024
            });
        }
        this.predictiveCache = new PredictiveCache_1.default({
            enableMLPredictions: this.config.predictiveCache.enableMLPredictions,
            maxPredictions: this.config.predictiveCache.maxPredictions,
            confidenceThreshold: this.config.predictiveCache.confidenceThreshold,
            predictionHorizon: this.config.predictiveCache.predictionHorizon,
            enablePatternLearning: this.config.predictiveCache.enablePatternLearning,
            enableContextualPredictions: this.config.predictiveCache.enableContextualPredictions,
            enableTemporalPredictions: this.config.predictiveCache.enableTemporalPredictions
        });
        this.incrementalLoader = new IncrementalLoader_1.default({
            get: (key) => this.l2Cache.get(key)?.results || null,
            set: (key, chunk, ttl) => {
                const entry = {
                    results: chunk.data,
                    query: key,
                    options: {},
                    timestamp: Date.now(),
                    computationTime: 0,
                    hitCount: 0
                };
                this.l2Cache.set(key, entry, ttl);
            },
            delete: (key) => this.l2Cache.delete(key),
            clear: () => this.l2Cache.clear(),
            size: this.l2Cache.getStats().size
        }, {
            defaultChunkSize: this.config.incrementalLoading.defaultChunkSize,
            maxParallelLoads: this.config.incrementalLoading.maxParallelLoads,
            enableAdaptiveChunking: this.config.incrementalLoading.enableAdaptiveChunking,
            enablePrioritization: this.config.incrementalLoading.enablePrioritization,
            loadTimeout: this.config.incrementalLoading.loadTimeout,
            retryAttempts: this.config.incrementalLoading.retryAttempts,
            retryDelay: this.config.incrementalLoading.retryDelay
        });
        this.initializeStats();
        this.setupEventHandlers();
        console.log(`🚀 Enhanced Search Cache initialized for ${this.config.environment} environment`);
    }
    async get(key, options = {}, userContext) {
        const startTime = performance.now();
        const cacheKey = this.generateCacheKey(key, options);
        try {
            let entry = this.l0Cache.get(cacheKey);
            if (entry) {
                entry.hitCount++;
                this.recordHit('l0', startTime);
                return entry.results;
            }
            entry = this.l1Cache.get(cacheKey);
            if (entry) {
                entry.hitCount++;
                if (entry.hitCount >= 3) {
                    this.promoteToL0(cacheKey, entry);
                }
                this.recordHit('l1', startTime);
                return entry.results;
            }
            entry = this.l2Cache.get(cacheKey);
            if (entry) {
                entry.hitCount++;
                if (entry.hitCount >= 2) {
                    this.promoteToL1(cacheKey, entry);
                }
                this.recordHit('l2', startTime);
                return entry.results;
            }
            if (this.redisCache) {
                const redisEntry = await this.redisCache.get(cacheKey);
                if (redisEntry) {
                    redisEntry.hitCount++;
                    this.setInL2(cacheKey, redisEntry);
                    this.recordHit('redis', startTime);
                    return redisEntry.results;
                }
            }
            this.recordMiss(startTime);
            return null;
        }
        catch (error) {
            console.error('Search cache get error:', error);
            this.recordMiss(startTime);
            return null;
        }
    }
    async set(key, value, options = {}, computationTime = 0, userContext) {
        const cacheKey = this.generateCacheKey(key, options);
        const entry = {
            results: value,
            query: key,
            options,
            timestamp: Date.now(),
            computationTime,
            hitCount: 0
        };
        try {
            const strategy = this.determineCacheStrategy(entry, computationTime);
            if (strategy.useL0) {
                this.setInL0(cacheKey, entry);
            }
            if (strategy.useL1) {
                this.setInL1(cacheKey, entry);
            }
            if (strategy.useL2) {
                this.setInL2(cacheKey, entry);
            }
            if (strategy.useRedis && this.redisCache) {
                await this.redisCache.set(cacheKey, entry, strategy.redisTTL);
            }
            if (this.config.predictiveCache.enabled && userContext) {
                this.predictiveCache.recordSearchEvent(userContext, {
                    query: key,
                    timestamp: Date.now(),
                    category: options.category,
                    resultClicks: 0,
                    sessionDuration: 0,
                    followupQueries: []
                }, userContext);
            }
        }
        catch (error) {
            console.error('Search cache set error:', error);
        }
    }
    async delete(key, options = {}) {
        const cacheKey = this.generateCacheKey(key, options);
        let deleted = false;
        try {
            if (this.l0Cache.delete(cacheKey))
                deleted = true;
            if (this.l1Cache.delete(cacheKey))
                deleted = true;
            if (this.l2Cache.delete(cacheKey))
                deleted = true;
            if (this.redisCache) {
                if (await this.redisCache.delete(cacheKey))
                    deleted = true;
            }
            return deleted;
        }
        catch (error) {
            console.error('Search cache delete error:', error);
            return false;
        }
    }
    async deletePattern(pattern) {
        let deletedCount = 0;
        try {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            const l0Keys = this.l0Cache.keys().filter(key => regex.test(key));
            l0Keys.forEach(key => {
                if (this.l0Cache.delete(key))
                    deletedCount++;
            });
            const l1Keys = this.l1Cache.keys().filter(key => regex.test(key));
            l1Keys.forEach(key => {
                if (this.l1Cache.delete(key))
                    deletedCount++;
            });
            const l2Keys = this.l2Cache.keys().filter(key => regex.test(key));
            l2Keys.forEach(key => {
                if (this.l2Cache.delete(key))
                    deletedCount++;
            });
            if (this.redisCache) {
                deletedCount += await this.redisCache.deletePattern(pattern);
            }
            return deletedCount;
        }
        catch (error) {
            console.error('Search cache delete pattern error:', error);
            return 0;
        }
    }
    async clear() {
        try {
            this.l0Cache.clear();
            this.l1Cache.clear();
            this.l2Cache.clear();
            if (this.redisCache) {
                await this.redisCache.clear();
            }
            this.predictiveCache.reset();
            console.log('Search cache cleared');
        }
        catch (error) {
            console.error('Search cache clear error:', error);
        }
    }
    async has(key, options = {}) {
        const cacheKey = this.generateCacheKey(key, options);
        try {
            if (this.l0Cache.has(cacheKey))
                return true;
            if (this.l1Cache.has(cacheKey))
                return true;
            if (this.l2Cache.has(cacheKey))
                return true;
            if (this.redisCache) {
                return await this.redisCache.exists(cacheKey);
            }
            return false;
        }
        catch (error) {
            console.error('Search cache has error:', error);
            return false;
        }
    }
    async expire(key, ttl, options = {}) {
        const cacheKey = this.generateCacheKey(key, options);
        try {
            let updated = false;
            const l0Entry = this.l0Cache.get(cacheKey);
            if (l0Entry) {
                this.l0Cache.set(cacheKey, l0Entry, ttl);
                updated = true;
            }
            const l1Entry = this.l1Cache.get(cacheKey);
            if (l1Entry) {
                this.l1Cache.set(cacheKey, l1Entry, ttl);
                updated = true;
            }
            const l2Entry = this.l2Cache.get(cacheKey);
            if (l2Entry) {
                this.l2Cache.set(cacheKey, l2Entry, ttl);
                updated = true;
            }
            if (this.redisCache) {
                if (await this.redisCache.expire(cacheKey, Math.floor(ttl / 1000))) {
                    updated = true;
                }
            }
            return updated;
        }
        catch (error) {
            console.error('Search cache expire error:', error);
            return false;
        }
    }
    async keys(pattern) {
        try {
            const allKeys = new Set();
            this.l0Cache.keys().forEach(key => allKeys.add(key));
            this.l1Cache.keys().forEach(key => allKeys.add(key));
            this.l2Cache.keys().forEach(key => allKeys.add(key));
            if (this.redisCache) {
                const redisKeys = await this.redisCache.keys(pattern);
                redisKeys.forEach(key => allKeys.add(key));
            }
            const result = Array.from(allKeys);
            if (!pattern) {
                return result;
            }
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return result.filter(key => regex.test(key));
        }
        catch (error) {
            console.error('Search cache keys error:', error);
            return [];
        }
    }
    getStats() {
        const l0Stats = this.l0Cache.getStats();
        const l1Stats = this.l1Cache.getStats();
        const l2Stats = this.l2Cache.getStats();
        const redisStats = this.redisCache?.getStats();
        const predictiveStats = this.predictiveCache.getStats();
        return {
            l0: {
                hits: l0Stats.hitCount,
                misses: l0Stats.missCount,
                hitRate: l0Stats.hitRate,
                size: l0Stats.size
            },
            l1: {
                hits: l1Stats.hitCount,
                misses: l1Stats.missCount,
                hitRate: l1Stats.hitRate,
                size: l1Stats.size
            },
            l2: {
                hits: l2Stats.hitCount,
                misses: l2Stats.missCount,
                hitRate: l2Stats.hitRate,
                size: l2Stats.size
            },
            redis: {
                hits: redisStats?.hitCount || 0,
                misses: redisStats?.missCount || 0,
                hitRate: redisStats?.hitRate || 0,
                connected: redisStats?.connectionStatus === 'connected'
            },
            predictive: {
                predictions: predictiveStats.totalPredictions,
                accuracy: predictiveStats.predictionAccuracy,
                cacheSaves: predictiveStats.successfulPredictions
            },
            overall: {
                totalHits: l0Stats.hitCount + l1Stats.hitCount + l2Stats.hitCount + (redisStats?.hitCount || 0),
                totalMisses: l0Stats.missCount + l1Stats.missCount + l2Stats.missCount + (redisStats?.missCount || 0),
                overallHitRate: this.calculateOverallHitRate(),
                averageResponseTime: (l0Stats.averageAccessTime + l1Stats.averageAccessTime + l2Stats.averageAccessTime) / 3,
                memoryUsage: l0Stats.memoryUsage + l1Stats.memoryUsage + l2Stats.memoryUsage
            }
        };
    }
    async warmCache(warmupData) {
        const { popularQueries = [], recentSearches = [], predictedTerms = [], userContext } = warmupData;
        console.log(`🔥 Warming search cache with ${popularQueries.length + recentSearches.length + predictedTerms.length} entries...`);
        try {
            for (const query of popularQueries) {
                const cacheKey = this.generateQueryCacheKey(query, {});
                const entry = {
                    results: [],
                    query,
                    options: {},
                    timestamp: Date.now(),
                    computationTime: 0,
                    hitCount: 1
                };
                this.l2Cache.set(`${cacheKey  }:warm`, entry, this.config.l2Cache.defaultTTL * 2);
            }
            for (const query of recentSearches) {
                const cacheKey = this.generateQueryCacheKey(query, {});
                const entry = {
                    results: [],
                    query,
                    options: {},
                    timestamp: Date.now(),
                    computationTime: 0,
                    hitCount: 1
                };
                this.l2Cache.set(`${cacheKey  }:recent`, entry, this.config.l2Cache.defaultTTL);
            }
            if (this.config.predictiveCache.enabled && userContext) {
                const predictions = await this.predictiveCache.getPredictions(userContext, userContext);
                for (const prediction of predictions) {
                    if (prediction.confidence >= this.config.predictiveCache.confidenceThreshold) {
                        this.predictiveCache.markPredictionSuccess(prediction.key);
                    }
                }
            }
            console.log(`✅ Cache warming completed`);
        }
        catch (error) {
            console.error('Cache warming error:', error);
        }
    }
    generateQueryCacheKey(query, options) {
        const normalized = query.toLowerCase().trim();
        const optionsHash = this.hashOptions(options);
        return `query:${normalized}:${optionsHash}`;
    }
    generateTermCacheKey(term) {
        return `term:${term.toLowerCase()}`;
    }
    generateIndexCacheKey(segment) {
        return `index:${segment}`;
    }
    async close() {
        try {
            this.l0Cache.destroy();
            this.l1Cache.destroy();
            this.l2Cache.destroy();
            if (this.redisCache) {
                await this.redisCache.close();
            }
            console.log('Enhanced search cache closed');
        }
        catch (error) {
            console.error('Search cache close error:', error);
        }
    }
    generateCacheKey(key, options) {
        const optionsHash = this.hashOptions(options);
        return `search:${key}:${optionsHash}`;
    }
    hashOptions(options) {
        const relevant = {
            limit: options.limit,
            category: options.category,
            tags: options.tags,
            sortBy: options.sortBy,
            useAI: options.useAI,
            threshold: options.threshold
        };
        return btoa(JSON.stringify(relevant)).slice(0, 8);
    }
    determineCacheStrategy(entry, computationTime) {
        const resultSize = JSON.stringify(entry.results).length;
        const isExpensive = computationTime > 500;
        const isFrequent = entry.hitCount > 0;
        return {
            useL0: resultSize < 10240 && (isExpensive || isFrequent),
            useL1: resultSize < 51200 && isExpensive,
            useL2: true,
            useRedis: this.config.l3Redis.enabled && resultSize < 102400,
            redisTTL: isExpensive ? 1200 : 600
        };
    }
    promoteToL0(key, entry) {
        const resultSize = JSON.stringify(entry.results).length;
        if (resultSize < 10240) {
            this.l0Cache.set(key, entry, this.config.l0Cache.defaultTTL);
        }
    }
    promoteToL1(key, entry) {
        const resultSize = JSON.stringify(entry.results).length;
        if (resultSize < 51200) {
            this.l1Cache.set(key, entry, this.config.l1Cache.defaultTTL);
        }
    }
    setInL0(key, entry) {
        this.l0Cache.set(key, entry, this.config.l0Cache.defaultTTL);
    }
    setInL1(key, entry) {
        this.l1Cache.set(key, entry, this.config.l1Cache.defaultTTL);
    }
    setInL2(key, entry) {
        this.l2Cache.set(key, entry, this.config.l2Cache.defaultTTL);
    }
    recordHit(layer, startTime) {
        this.stats[layer].hits++;
    }
    recordMiss(startTime) {
    }
    calculateOverallHitRate() {
        const stats = this.getStats();
        const totalRequests = stats.overall.totalHits + stats.overall.totalMisses;
        return totalRequests > 0 ? stats.overall.totalHits / totalRequests : 0;
    }
    initializeStats() {
        this.stats = {
            l0: { hits: 0, misses: 0, hitRate: 0, size: 0 },
            l1: { hits: 0, misses: 0, hitRate: 0, size: 0 },
            l2: { hits: 0, misses: 0, hitRate: 0, size: 0 },
            redis: { hits: 0, misses: 0, hitRate: 0, connected: false },
            predictive: { predictions: 0, accuracy: 0, cacheSaves: 0 },
            overall: {
                totalHits: 0,
                totalMisses: 0,
                overallHitRate: 0,
                averageResponseTime: 0,
                memoryUsage: 0
            }
        };
    }
    setupEventHandlers() {
        this.predictiveCache.on('prediction-success', (data) => {
            console.log(`Predictive cache hit: ${data.key}`);
        });
        this.predictiveCache.on('prediction-failure', (data) => {
            console.log(`Predictive cache miss: ${data.key}`);
        });
        if (this.redisCache) {
            this.redisCache.on('connected', () => {
                console.log('Redis cache connected');
            });
            this.redisCache.on('disconnected', () => {
                console.log('Redis cache disconnected');
            });
            this.redisCache.on('error', (error) => {
                console.error('Redis cache error:', error);
            });
        }
    }
}
exports.EnhancedSearchCache = EnhancedSearchCache;
exports.default = EnhancedSearchCache;
//# sourceMappingURL=EnhancedSearchCache.js.map