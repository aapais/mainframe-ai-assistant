"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisManager = void 0;
const events_1 = require("events");
class RedisManager extends events_1.EventEmitter {
    client;
    isConnected = false;
    config;
    metrics;
    compressionThreshold = 1024;
    constructor(config) {
        super();
        this.config = config;
        this.metrics = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            avgResponseTime: 0,
            memoryUsage: 0,
            operations: { get: 0, set: 0, del: 0 }
        };
        this.initializeClient();
    }
    async initializeClient() {
        try {
            this.client = {
                connect: async () => { this.isConnected = true; },
                get: async (key) => {
                    this.metrics.operations.get++;
                    return this.mockGet(key);
                },
                set: async (key, value, ttl) => {
                    this.metrics.operations.set++;
                    return this.mockSet(key, value, ttl);
                },
                del: async (key) => {
                    this.metrics.operations.del++;
                    return this.mockDel(key);
                },
                keys: async (pattern) => [],
                flushdb: async () => true,
                info: async () => 'used_memory:1024'
            };
            await this.client.connect();
            this.emit('connected');
            console.log('Redis manager initialized successfully');
        }
        catch (error) {
            console.error('Redis connection failed:', error);
            this.emit('error', error);
        }
    }
    mockStorage = new Map();
    mockGet(key) {
        const item = this.mockStorage.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expires) {
            this.mockStorage.delete(key);
            return null;
        }
        return item.value;
    }
    mockSet(key, value, ttl = this.config.ttl.default) {
        this.mockStorage.set(key, {
            value,
            expires: Date.now() + (ttl * 1000)
        });
        return true;
    }
    mockDel(key) {
        return this.mockStorage.delete(key);
    }
    async get(key) {
        const startTime = Date.now();
        try {
            const data = await this.client.get(this.getKey(key));
            const responseTime = Date.now() - startTime;
            this.updateMetrics('hit', responseTime);
            if (!data) {
                this.metrics.misses++;
                return null;
            }
            const entry = JSON.parse(data);
            if (Date.now() > entry.timestamp + (entry.ttl * 1000)) {
                await this.del(key);
                this.metrics.misses++;
                return null;
            }
            this.metrics.hits++;
            return entry.data;
        }
        catch (error) {
            console.error('Cache get error:', error);
            this.metrics.misses++;
            return null;
        }
    }
    async set(key, data, ttl = this.config.ttl.default, tags) {
        try {
            const entry = {
                data,
                timestamp: Date.now(),
                ttl,
                tags,
                version: '1.0'
            };
            const serialized = JSON.stringify(entry);
            const compressed = this.shouldCompress(serialized);
            if (compressed) {
                entry.compressed = true;
            }
            await this.client.set(this.getKey(key), JSON.stringify(entry), ttl);
            return true;
        }
        catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }
    async del(key) {
        try {
            await this.client.del(this.getKey(key));
            return true;
        }
        catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }
    async invalidateByTag(tag) {
        try {
            const keys = await this.client.keys(`${this.config.keyPrefix || ''}*`);
            let invalidated = 0;
            for (const key of keys) {
                const data = await this.client.get(key);
                if (data) {
                    const entry = JSON.parse(data);
                    if (entry.tags && entry.tags.includes(tag)) {
                        await this.client.del(key);
                        invalidated++;
                    }
                }
            }
            return invalidated;
        }
        catch (error) {
            console.error('Tag invalidation error:', error);
            return 0;
        }
    }
    async flush() {
        try {
            await this.client.flushdb();
            this.resetMetrics();
            return true;
        }
        catch (error) {
            console.error('Cache flush error:', error);
            return false;
        }
    }
    async warming(keys) {
        console.log(`Starting cache warming for ${keys.length} keys`);
        const batchSize = 10;
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);
            await Promise.all(batch.map(async ({ key, fetcher, ttl }) => {
                try {
                    const data = await fetcher();
                    await this.set(key, data, ttl);
                }
                catch (error) {
                    console.error(`Cache warming failed for key ${key}:`, error);
                }
            }));
        }
        console.log('Cache warming completed');
    }
    getMetrics() {
        const total = this.metrics.hits + this.metrics.misses;
        this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
        return { ...this.metrics };
    }
    getKey(key) {
        return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    }
    shouldCompress(data) {
        return Buffer.byteLength(data, 'utf8') > this.compressionThreshold;
    }
    updateMetrics(type, responseTime) {
        if (type === 'hit') {
            this.metrics.hits++;
        }
        else {
            this.metrics.misses++;
        }
        const totalOps = this.metrics.operations.get;
        this.metrics.avgResponseTime =
            (this.metrics.avgResponseTime * (totalOps - 1) + responseTime) / totalOps;
    }
    resetMetrics() {
        this.metrics = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            avgResponseTime: 0,
            memoryUsage: 0,
            operations: { get: 0, set: 0, del: 0 }
        };
    }
    isReady() {
        return this.isConnected;
    }
    async disconnect() {
        if (this.client && this.isConnected) {
            this.isConnected = false;
            this.emit('disconnected');
        }
    }
}
exports.RedisManager = RedisManager;
//# sourceMappingURL=RedisManager.js.map