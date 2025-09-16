"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const services_1 = require("../types/services");
class CacheService {
    config;
    cache = new Map();
    head;
    tail;
    currentSize = 0;
    totalMemoryUsage = 0;
    stats = {
        hitCount: 0,
        missCount: 0,
        setCount: 0,
        deleteCount: 0,
        evictionCount: 0,
        startTime: Date.now()
    };
    cleanupInterval;
    constructor(config) {
        this.config = config;
        this.setupCleanupInterval();
    }
    async get(key) {
        this.validateKey(key);
        const node = this.cache.get(key);
        if (!node) {
            this.stats.missCount++;
            return null;
        }
        if (this.isExpired(node.entry)) {
            await this.delete(key);
            this.stats.missCount++;
            return null;
        }
        node.entry.hitCount++;
        this.stats.hitCount++;
        this.moveToFront(node);
        return node.entry.value;
    }
    async set(key, value, ttl) {
        this.validateKey(key);
        this.validateValue(value);
        const entrySize = this.calculateSize(value);
        const now = Date.now();
        const existingNode = this.cache.get(key);
        if (existingNode) {
            this.totalMemoryUsage -= existingNode.entry.size;
            existingNode.entry.value = value;
            existingNode.entry.timestamp = now;
            existingNode.entry.ttl = ttl;
            existingNode.entry.size = entrySize;
            this.totalMemoryUsage += entrySize;
            this.moveToFront(existingNode);
        }
        else {
            const entry = {
                value,
                timestamp: now,
                ttl,
                hitCount: 0,
                size: entrySize
            };
            const node = {
                key,
                entry
            };
            await this.ensureCapacity();
            this.cache.set(key, node);
            this.addToFront(node);
            this.currentSize++;
            this.totalMemoryUsage += entrySize;
        }
        this.stats.setCount++;
    }
    async mget(keys) {
        return Promise.all(keys.map(key => this.get(key)));
    }
    async mset(items) {
        for (const item of items) {
            await this.set(item.key, item.value, item.ttl);
        }
    }
    async delete(key) {
        this.validateKey(key);
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }
        this.removeFromList(node);
        this.cache.delete(key);
        this.currentSize--;
        this.totalMemoryUsage -= node.entry.size;
        this.stats.deleteCount++;
        return true;
    }
    async deletePattern(pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        let deletedCount = 0;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                const deleted = await this.delete(key);
                if (deleted)
                    deletedCount++;
            }
        }
        return deletedCount;
    }
    async clear() {
        this.cache.clear();
        this.head = undefined;
        this.tail = undefined;
        this.currentSize = 0;
        this.totalMemoryUsage = 0;
        this.stats.hitCount = 0;
        this.stats.missCount = 0;
    }
    async has(key) {
        this.validateKey(key);
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }
        if (this.isExpired(node.entry)) {
            await this.delete(key);
            return false;
        }
        return true;
    }
    async expire(key, ttl) {
        this.validateKey(key);
        if (ttl <= 0) {
            throw new services_1.CacheError('TTL must be positive', 'expire', { key, ttl });
        }
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }
        node.entry.ttl = ttl;
        node.entry.timestamp = Date.now();
        return true;
    }
    stats() {
        const uptime = Date.now() - this.stats.startTime;
        const hitRate = this.stats.hitCount / Math.max(1, this.stats.hitCount + this.stats.missCount);
        let totalAge = 0;
        let oldestEntry = Date.now();
        let newestEntry = 0;
        for (const node of this.cache.values()) {
            const age = Date.now() - node.entry.timestamp;
            totalAge += age;
            oldestEntry = Math.min(oldestEntry, node.entry.timestamp);
            newestEntry = Math.max(newestEntry, node.entry.timestamp);
        }
        const averageAge = this.currentSize > 0 ? totalAge / this.currentSize : 0;
        return {
            hitCount: this.stats.hitCount,
            missCount: this.stats.missCount,
            hitRate,
            size: this.currentSize,
            maxSize: this.config.maxSize,
            memoryUsage: this.totalMemoryUsage,
            evictions: this.stats.evictionCount,
            averageAge,
            oldestEntry: oldestEntry === Date.now() ? new Date() : new Date(oldestEntry),
            newestEntry: new Date(newestEntry)
        };
    }
    async keys(pattern) {
        if (!pattern) {
            return Array.from(this.cache.keys());
        }
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(this.cache.keys()).filter(key => regex.test(key));
    }
    validateKey(key) {
        if (!key || typeof key !== 'string') {
            throw new services_1.CacheError('Key must be a non-empty string', 'validation', { key });
        }
        if (key.length > 250) {
            throw new services_1.CacheError('Key too long (max 250 characters)', 'validation', { key, length: key.length });
        }
    }
    validateValue(value) {
        if (value === undefined) {
            throw new services_1.CacheError('Value cannot be undefined', 'validation', { value });
        }
        try {
            JSON.stringify(value);
        }
        catch (error) {
            throw new services_1.CacheError('Value contains circular references', 'validation', { error: error.message });
        }
    }
    isExpired(entry) {
        if (!entry.ttl) {
            return false;
        }
        return Date.now() - entry.timestamp > entry.ttl;
    }
    calculateSize(value) {
        try {
            const str = JSON.stringify(value);
            return str.length * 2;
        }
        catch {
            return 100;
        }
    }
    async ensureCapacity() {
        await this.removeExpiredEntries();
        while (this.currentSize >= this.config.maxSize) {
            await this.evictLRU();
        }
    }
    async removeExpiredEntries() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, node] of this.cache.entries()) {
            if (this.isExpired(node.entry)) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            await this.delete(key);
        }
        return keysToDelete.length;
    }
    async evictLRU() {
        if (!this.tail) {
            return;
        }
        const key = this.tail.key;
        await this.delete(key);
        this.stats.evictionCount++;
    }
    moveToFront(node) {
        if (node === this.head) {
            return;
        }
        this.removeFromList(node);
        this.addToFront(node);
    }
    removeFromList(node) {
        if (node.prev) {
            node.prev.next = node.next;
        }
        else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        else {
            this.tail = node.prev;
        }
        node.prev = undefined;
        node.next = undefined;
    }
    addToFront(node) {
        node.next = this.head;
        node.prev = undefined;
        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
    }
    setupCleanupInterval() {
        if (this.config.checkPeriod > 0) {
            this.cleanupInterval = setInterval(async () => {
                try {
                    await this.removeExpiredEntries();
                }
                catch (error) {
                    console.error('Cache cleanup error:', error);
                }
            }, this.config.checkPeriod);
        }
    }
    async close() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        await this.clear();
    }
    async debugInfo() {
        const entries = [];
        for (const [key, node] of this.cache.entries()) {
            entries.push({
                key,
                size: node.entry.size,
                age: Date.now() - node.entry.timestamp,
                hitCount: node.entry.hitCount,
                ttl: node.entry.ttl,
                expired: this.isExpired(node.entry)
            });
        }
        return {
            configuration: this.config,
            statistics: this.stats(),
            entries: entries.sort((a, b) => b.hitCount - a.hitCount),
            memoryBreakdown: {
                totalMemory: this.totalMemoryUsage,
                averageEntrySize: this.currentSize > 0 ? this.totalMemoryUsage / this.currentSize : 0,
                utilizationPercent: this.config.maxSize > 0 ? (this.currentSize / this.config.maxSize) * 100 : 0
            }
        };
    }
    async optimize() {
        const removed = await this.removeExpiredEntries();
        console.info(`Cache optimization completed: removed ${removed} expired entries`);
    }
    async warmup(data) {
        console.info(`Warming up cache with ${data.length} entries`);
        for (const item of data) {
            await this.set(item.key, item.value, item.ttl);
        }
        console.info('Cache warmup completed');
    }
    async export() {
        const entries = [];
        for (const [key, node] of this.cache.entries()) {
            if (!this.isExpired(node.entry)) {
                entries.push({
                    key,
                    value: node.entry.value,
                    timestamp: node.entry.timestamp,
                    ttl: node.entry.ttl,
                    hitCount: node.entry.hitCount
                });
            }
        }
        return JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            entries,
            stats: this.stats()
        });
    }
    async import(data) {
        try {
            const backup = JSON.parse(data);
            if (!backup.entries || !Array.isArray(backup.entries)) {
                throw new Error('Invalid backup format');
            }
            await this.clear();
            for (const entry of backup.entries) {
                let remainingTTL = entry.ttl;
                if (entry.ttl && entry.timestamp) {
                    const elapsed = Date.now() - entry.timestamp;
                    remainingTTL = Math.max(0, entry.ttl - elapsed);
                }
                if (remainingTTL > 0 || !entry.ttl) {
                    await this.set(entry.key, entry.value, remainingTTL || undefined);
                    const node = this.cache.get(entry.key);
                    if (node) {
                        node.entry.hitCount = entry.hitCount || 0;
                    }
                }
            }
            console.info(`Cache imported: ${backup.entries.length} entries`);
        }
        catch (error) {
            throw new services_1.CacheError('Failed to import cache', 'import', { error: error.message });
        }
    }
}
exports.CacheService = CacheService;
exports.default = CacheService;
//# sourceMappingURL=CacheService.js.map