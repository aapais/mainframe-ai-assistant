"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCache = void 0;
const events_1 = require("events");
class RedisCache extends events_1.EventEmitter {
    client;
    config;
    stats;
    circuitBreakerOpen = false;
    failureCount = 0;
    lastFailureTime = 0;
    latencyBuffer = [];
    constructor(config = {}) {
        super();
        this.config = {
            host: 'localhost',
            port: 6379,
            db: 0,
            keyPrefix: 'cache:',
            defaultTTL: 300,
            maxRetries: 3,
            retryDelayMs: 1000,
            enableCompression: true,
            compressionThreshold: 1024,
            maxConnectionPoolSize: 10,
            enableCluster: false,
            enableReadReplicas: false,
            ...config
        };
        this.stats = {
            hitCount: 0,
            missCount: 0,
            hitRate: 0,
            setCount: 0,
            errorCount: 0,
            connectionStatus: 'disconnected',
            memoryUsage: 0,
            keyCount: 0,
            averageLatency: 0,
            compressionRatio: 1.0
        };
        this.initializeClient();
    }
    async get(key) {
        const startTime = performance.now();
        try {
            if (this.circuitBreakerOpen) {
                this.recordMiss(startTime);
                return null;
            }
            const fullKey = this.getFullKey(key);
            const rawValue = await this.executeWithRetry(() => this.client.get(fullKey));
            if (!rawValue) {
                this.recordMiss(startTime);
                return null;
            }
            const entry = this.deserializeEntry(rawValue);
            if (this.isExpired(entry)) {
                await this.delete(key);
                this.recordMiss(startTime);
                return null;
            }
            this.recordHit(startTime);
            return entry.value;
        }
        catch (error) {
            this.handleError(error);
            this.recordMiss(startTime);
            return null;
        }
    }
    async set(key, value, ttl) {
        const startTime = performance.now();
        try {
            if (this.circuitBreakerOpen) {
                return false;
            }
            const fullKey = this.getFullKey(key);
            const entry = this.createCacheEntry(value, ttl);
            const serialized = this.serializeEntry(entry);
            const effectiveTTL = ttl || this.config.defaultTTL;
            await this.executeWithRetry(() => this.client.setex(fullKey, effectiveTTL, serialized));
            this.stats.setCount++;
            this.recordLatency(startTime);
            return true;
        }
        catch (error) {
            this.handleError(error);
            return false;
        }
    }
    async delete(key) {
        try {
            if (this.circuitBreakerOpen) {
                return false;
            }
            const fullKey = this.getFullKey(key);
            const result = await this.executeWithRetry(() => this.client.del(fullKey));
            return result > 0;
        }
        catch (error) {
            this.handleError(error);
            return false;
        }
    }
    async deletePattern(pattern) {
        try {
            if (this.circuitBreakerOpen) {
                return 0;
            }
            const fullPattern = this.getFullKey(pattern);
            const keys = await this.executeWithRetry(() => this.client.keys(fullPattern));
            if (keys.length === 0) {
                return 0;
            }
            const result = await this.executeWithRetry(() => this.client.del(...keys));
            return result;
        }
        catch (error) {
            this.handleError(error);
            return 0;
        }
    }
    async exists(key) {
        try {
            if (this.circuitBreakerOpen) {
                return false;
            }
            const fullKey = this.getFullKey(key);
            const result = await this.executeWithRetry(() => this.client.exists(fullKey));
            return result > 0;
        }
        catch (error) {
            this.handleError(error);
            return false;
        }
    }
    async expire(key, seconds) {
        try {
            if (this.circuitBreakerOpen) {
                return false;
            }
            const fullKey = this.getFullKey(key);
            const result = await this.executeWithRetry(() => this.client.expire(fullKey, seconds));
            return result > 0;
        }
        catch (error) {
            this.handleError(error);
            return false;
        }
    }
    async mget(keys) {
        try {
            if (this.circuitBreakerOpen) {
                return keys.map(() => null);
            }
            const pipeline = this.client.pipeline();
            const fullKeys = keys.map(key => this.getFullKey(key));
            fullKeys.forEach(fullKey => {
                pipeline.get(fullKey);
            });
            const results = await pipeline.exec();
            const values = [];
            for (let i = 0; i < results.length; i++) {
                const [error, rawValue] = results[i];
                if (error || !rawValue) {
                    values.push(null);
                    continue;
                }
                try {
                    const entry = this.deserializeEntry(rawValue);
                    if (this.isExpired(entry)) {
                        values.push(null);
                        this.delete(keys[i]).catch(() => { });
                    }
                    else {
                        values.push(entry.value);
                    }
                }
                catch {
                    values.push(null);
                }
            }
            return values;
        }
        catch (error) {
            this.handleError(error);
            return keys.map(() => null);
        }
    }
    async mset(items) {
        try {
            if (this.circuitBreakerOpen) {
                return false;
            }
            const pipeline = this.client.pipeline();
            for (const item of items) {
                const fullKey = this.getFullKey(item.key);
                const entry = this.createCacheEntry(item.value, item.ttl);
                const serialized = this.serializeEntry(entry);
                const effectiveTTL = item.ttl || this.config.defaultTTL;
                pipeline.set(fullKey, serialized);
            }
            await pipeline.exec();
            this.stats.setCount += items.length;
            return true;
        }
        catch (error) {
            this.handleError(error);
            return false;
        }
    }
    async clear() {
        try {
            if (this.circuitBreakerOpen) {
                return;
            }
            const pattern = this.getFullKey('*');
            const keys = await this.executeWithRetry(() => this.client.keys(pattern));
            if (keys.length > 0) {
                await this.executeWithRetry(() => this.client.del(...keys));
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async keys(pattern) {
        try {
            if (this.circuitBreakerOpen) {
                return [];
            }
            const fullPattern = this.getFullKey(pattern || '*');
            const fullKeys = await this.executeWithRetry(() => this.client.keys(fullPattern));
            const prefixLength = this.config.keyPrefix.length;
            return fullKeys.map(key => key.substring(prefixLength));
        }
        catch (error) {
            this.handleError(error);
            return [];
        }
    }
    getStats() {
        this.updateStats();
        return { ...this.stats };
    }
    async ping() {
        try {
            if (!this.client)
                return false;
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch (error) {
            this.handleError(error);
            return false;
        }
    }
    async close() {
        try {
            if (this.client) {
                await this.client.quit();
                this.client = undefined;
            }
            this.stats.connectionStatus = 'disconnected';
            this.emit('disconnected');
        }
        catch (error) {
            console.error('Redis close error:', error);
        }
    }
    async invalidate(pattern, tags) {
        let totalInvalidated = 0;
        if (pattern) {
            totalInvalidated += await this.deletePattern(pattern);
        }
        if (tags && tags.length > 0) {
            for (const tag of tags) {
                const tagPattern = `*:tag:${tag}:*`;
                totalInvalidated += await this.deletePattern(tagPattern);
            }
        }
        return totalInvalidated;
    }
    async initializeClient() {
        try {
            this.client = this.createMockClient();
            this.setupEventHandlers();
            this.stats.connectionStatus = 'connected';
            this.emit('connected');
        }
        catch (error) {
            this.handleError(error);
            throw error;
        }
    }
    createMockClient() {
        const storage = new Map();
        return {
            async get(key) {
                return storage.get(key) || null;
            },
            async set(key, value) {
                storage.set(key, value);
                return 'OK';
            },
            async setex(key, seconds, value) {
                storage.set(key, value);
                setTimeout(() => storage.delete(key), seconds * 1000);
                return 'OK';
            },
            async del(...keys) {
                let deleted = 0;
                keys.forEach(key => {
                    if (storage.delete(key))
                        deleted++;
                });
                return deleted;
            },
            async exists(...keys) {
                return keys.filter(key => storage.has(key)).length;
            },
            async expire(key, seconds) {
                if (storage.has(key)) {
                    setTimeout(() => storage.delete(key), seconds * 1000);
                    return 1;
                }
                return 0;
            },
            async keys(pattern) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return Array.from(storage.keys()).filter(key => regex.test(key));
            },
            async flushdb() {
                storage.clear();
                return 'OK';
            },
            async ping() {
                return 'PONG';
            },
            async quit() {
                storage.clear();
                return 'OK';
            },
            pipeline() {
                const commands = [];
                const pipeline = {
                    get(key) {
                        commands.push({ method: 'get', args: [key] });
                        return pipeline;
                    },
                    set(key, value) {
                        commands.push({ method: 'set', args: [key, value] });
                        return pipeline;
                    },
                    del(key) {
                        commands.push({ method: 'del', args: [key] });
                        return pipeline;
                    },
                    async exec() {
                        const results = [];
                        for (const command of commands) {
                            try {
                                let result;
                                switch (command.method) {
                                    case 'get':
                                        result = await this.get(command.args[0]);
                                        break;
                                    case 'set':
                                        result = await this.set(command.args[0], command.args[1]);
                                        break;
                                    case 'del':
                                        result = await this.del(...command.args);
                                        break;
                                }
                                results.push([null, result]);
                            }
                            catch (error) {
                                results.push([error, null]);
                            }
                        }
                        return results;
                    }
                };
                return pipeline;
            },
            multi() {
                return this.pipeline();
            }
        };
    }
    setupEventHandlers() {
        if (!this.client)
            return;
    }
    async executeWithRetry(operation) {
        let lastError;
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt < this.config.maxRetries) {
                    await this.sleep(this.config.retryDelayMs * Math.pow(2, attempt));
                }
            }
        }
        throw lastError;
    }
    createCacheEntry(value, ttl) {
        return {
            value,
            timestamp: Date.now(),
            ttl: ttl || this.config.defaultTTL,
            compressed: false,
            version: '1.0'
        };
    }
    serializeEntry(entry) {
        const serialized = JSON.stringify(entry);
        if (this.config.enableCompression &&
            serialized.length > this.config.compressionThreshold) {
            entry.compressed = true;
        }
        return serialized;
    }
    deserializeEntry(serialized) {
        return JSON.parse(serialized);
    }
    isExpired(entry) {
        return Date.now() > entry.timestamp + (entry.ttl * 1000);
    }
    getFullKey(key) {
        return `${this.config.keyPrefix}${key}`;
    }
    handleError(error) {
        console.error('Redis cache error:', error);
        this.stats.errorCount++;
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= 5) {
            this.circuitBreakerOpen = true;
            this.stats.connectionStatus = 'error';
            setTimeout(() => {
                this.circuitBreakerOpen = false;
                this.failureCount = 0;
            }, 30000);
        }
        this.emit('error', error);
    }
    recordHit(startTime) {
        this.stats.hitCount++;
        this.recordLatency(startTime);
        this.updateHitRate();
    }
    recordMiss(startTime) {
        this.stats.missCount++;
        this.recordLatency(startTime);
        this.updateHitRate();
    }
    recordLatency(startTime) {
        const latency = performance.now() - startTime;
        this.latencyBuffer.push(latency);
        if (this.latencyBuffer.length > 1000) {
            this.latencyBuffer = this.latencyBuffer.slice(-1000);
        }
        this.stats.averageLatency = this.latencyBuffer.reduce((sum, l) => sum + l, 0) / this.latencyBuffer.length;
    }
    updateHitRate() {
        const total = this.stats.hitCount + this.stats.missCount;
        this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
    }
    updateStats() {
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RedisCache = RedisCache;
exports.default = RedisCache;
//# sourceMappingURL=RedisCache.js.map