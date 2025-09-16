"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheOrchestrator = void 0;
const RedisManager_1 = require("./RedisManager");
const MemoryCache_1 = require("./MemoryCache");
class CacheOrchestrator {
    redisManager;
    memoryCache;
    config;
    queryCache = new Map();
    invalidationQueue = new Set();
    metricsCollector;
    constructor(config) {
        this.config = config;
        this.redisManager = new RedisManager_1.RedisManager(config.redis);
        this.memoryCache = new MemoryCache_1.MemoryCache(config.memory);
        this.setupMetricsCollection();
    }
    async get(key, options) {
        const startTime = Date.now();
        const layers = options?.layers || ['memory', 'redis'];
        try {
            if (layers.includes('memory')) {
                const memoryResult = this.memoryCache.get(key);
                if (memoryResult !== null) {
                    this.recordCacheHit('memory', Date.now() - startTime);
                    return memoryResult;
                }
            }
            if (layers.includes('redis') && this.redisManager.isReady()) {
                const redisResult = await this.redisManager.get(key);
                if (redisResult !== null) {
                    if (this.config.strategy.readThrough && layers.includes('memory')) {
                        this.memoryCache.set(key, redisResult, options?.ttl, options?.tags);
                    }
                    this.recordCacheHit('redis', Date.now() - startTime);
                    return redisResult;
                }
            }
            if (options?.fallback) {
                const result = await options.fallback();
                if (result !== null) {
                    await this.set(key, result, options?.ttl, options?.tags);
                    this.recordCacheMiss('fallback', Date.now() - startTime);
                }
                return result;
            }
            this.recordCacheMiss('all', Date.now() - startTime);
            return null;
        }
        catch (error) {
            console.error('Cache get error:', error);
            return options?.fallback ? await options.fallback() : null;
        }
    }
    async set(key, value, ttl, tags) {
        const operations = [];
        try {
            if (this.config.layers.find(l => l.name === 'memory')?.enabled) {
                const memoryResult = this.memoryCache.set(key, value, ttl, tags);
                operations.push(Promise.resolve(memoryResult));
            }
            if (this.config.layers.find(l => l.name === 'redis')?.enabled && this.redisManager.isReady()) {
                operations.push(this.redisManager.set(key, value, ttl, tags));
            }
            const results = await Promise.allSettled(operations);
            return results.some(result => result.status === 'fulfilled' && result.value);
        }
        catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }
    async del(key) {
        const operations = [];
        operations.push(Promise.resolve(this.memoryCache.delete(key)));
        if (this.redisManager.isReady()) {
            operations.push(this.redisManager.del(key));
        }
        const results = await Promise.allSettled(operations);
        return results.some(result => result.status === 'fulfilled' && result.value);
    }
    async invalidateByTag(tag) {
        let totalInvalidated = 0;
        totalInvalidated += this.memoryCache.invalidateByTag(tag);
        if (this.redisManager.isReady()) {
            totalInvalidated += await this.redisManager.invalidateByTag(tag);
        }
        this.invalidationQueue.add(tag);
        return totalInvalidated;
    }
    async cacheQuery(queryKey, executor, ttl) {
        if (!this.config.queryCache.enabled) {
            return await executor();
        }
        const cacheKey = this.generateQueryCacheKey(queryKey);
        const cached = await this.get(cacheKey);
        if (cached !== null) {
            return cached;
        }
        const result = await executor();
        const queryTTL = ttl || this.config.queryCache.defaultTTL;
        await this.set(cacheKey, result, queryTTL, [queryKey.type, queryKey.operation]);
        return result;
    }
    async warmCache(entries) {
        console.log(`Starting cache warming for ${entries.length} entries`);
        const sortedEntries = entries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        const batchSize = 10;
        for (let i = 0; i < sortedEntries.length; i += batchSize) {
            const batch = sortedEntries.slice(i, i + batchSize);
            await Promise.allSettled(batch.map(async ({ key, fetcher, ttl, tags }) => {
                try {
                    const data = await fetcher();
                    await this.set(key, data, ttl, tags);
                }
                catch (error) {
                    console.error(`Cache warming failed for key ${key}:`, error);
                }
            }));
        }
        console.log('Cache warming completed');
    }
    getMetrics() {
        const memoryStats = this.memoryCache.getStats();
        const redisMetrics = this.redisManager.getMetrics();
        return {
            memory: memoryStats,
            redis: redisMetrics,
            overall: {
                hitRate: (memoryStats.hitRate + redisMetrics.hitRate) / 2,
                totalRequests: memoryStats.hits + memoryStats.misses + redisMetrics.hits + redisMetrics.misses,
                avgResponseTime: (redisMetrics.avgResponseTime + 5) / 2,
                memoryUsage: memoryStats.memoryUsage + redisMetrics.memoryUsage
            },
            invalidationQueue: this.invalidationQueue.size
        };
    }
    async healthCheck() {
        const layers = {
            memory: true,
            redis: this.redisManager.isReady()
        };
        const healthyLayers = Object.values(layers).filter(Boolean).length;
        const totalLayers = Object.keys(layers).length;
        let status;
        if (healthyLayers === totalLayers) {
            status = 'healthy';
        }
        else if (healthyLayers > 0) {
            status = 'degraded';
        }
        else {
            status = 'unhealthy';
        }
        return {
            status,
            layers,
            metrics: this.getMetrics()
        };
    }
    async flush() {
        this.memoryCache.clear();
        if (this.redisManager.isReady()) {
            await this.redisManager.flush();
        }
        this.queryCache.clear();
        this.invalidationQueue.clear();
    }
    generateQueryCacheKey(queryKey) {
        const paramHash = this.hashObject(queryKey.parameters);
        return `query:${queryKey.type}:${queryKey.operation}:${paramHash}:${queryKey.version}`;
    }
    hashObject(obj) {
        return Buffer.from(JSON.stringify(obj)).toString('base64').substring(0, 16);
    }
    recordCacheHit(layer, responseTime) {
        if (this.metricsCollector) {
            this.metricsCollector.recordHit(layer, responseTime);
        }
    }
    recordCacheMiss(layer, responseTime) {
        if (this.metricsCollector) {
            this.metricsCollector.recordMiss(layer, responseTime);
        }
    }
    setupMetricsCollection() {
        this.metricsCollector = {
            recordHit: (layer, time) => {
                console.debug(`Cache HIT [${layer}] - ${time}ms`);
            },
            recordMiss: (layer, time) => {
                console.debug(`Cache MISS [${layer}] - ${time}ms`);
            }
        };
    }
    async destroy() {
        this.memoryCache.destroy();
        await this.redisManager.disconnect();
        this.queryCache.clear();
        this.invalidationQueue.clear();
    }
}
exports.CacheOrchestrator = CacheOrchestrator;
//# sourceMappingURL=CacheOrchestrator.js.map