"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
class LRUCache {
    cache = new Map();
    head;
    tail;
    t1 = new Map();
    t2 = new Map();
    b1 = new Map();
    b2 = new Map();
    config;
    stats;
    cleanupTimer;
    currentMemoryUsage = 0;
    adaptiveP = 0;
    constructor(config = {}) {
        this.config = {
            maxSize: 1000,
            maxMemoryMB: 100,
            defaultTTL: 300000,
            evictionPolicy: 'ADAPTIVE',
            enableStats: true,
            cleanupInterval: 60000,
            memoryPressureThreshold: 0.8,
            ...config
        };
        this.stats = {
            hitCount: 0,
            missCount: 0,
            hitRate: 0,
            size: 0,
            memoryUsage: 0,
            averageAccessTime: 0,
            evictions: 0,
            hotKeyCount: 0,
            averageEntryAge: 0
        };
        this.startCleanupTimer();
    }
    get(key) {
        const startTime = performance.now();
        try {
            const node = this.cache.get(key);
            if (!node) {
                this.recordMiss(startTime);
                return null;
            }
            if (this.isExpired(node.entry)) {
                this.delete(key);
                this.recordMiss(startTime);
                return null;
            }
            this.updateAccess(node.entry);
            this.handleAccess(node);
            this.recordHit(startTime);
            return node.entry.value;
        }
        catch (error) {
            console.error('LRU Cache get error:', error);
            this.recordMiss(startTime);
            return null;
        }
    }
    set(key, value, ttl) {
        try {
            const size = this.estimateSize(value);
            const now = Date.now();
            const existingNode = this.cache.get(key);
            if (existingNode) {
                this.currentMemoryUsage -= existingNode.entry.size;
                existingNode.entry.value = value;
                existingNode.entry.size = size;
                existingNode.entry.timestamp = now;
                existingNode.entry.lastAccessed = now;
                existingNode.entry.ttl = ttl || this.config.defaultTTL;
                this.currentMemoryUsage += size;
                this.handleAccess(existingNode);
                return true;
            }
            const entry = {
                key,
                value,
                timestamp: now,
                lastAccessed: now,
                accessCount: 1,
                frequency: 1,
                ttl: ttl || this.config.defaultTTL,
                size
            };
            const node = { entry };
            this.ensureCapacity(size);
            this.cache.set(key, node);
            this.currentMemoryUsage += size;
            this.stats.size++;
            this.handleInsertion(node);
            return true;
        }
        catch (error) {
            console.error('LRU Cache set error:', error);
            return false;
        }
    }
    delete(key) {
        const node = this.cache.get(key);
        if (!node)
            return false;
        this.removeNode(node);
        this.cache.delete(key);
        this.currentMemoryUsage -= node.entry.size;
        this.stats.size--;
        this.t1.delete(key);
        this.t2.delete(key);
        this.b1.delete(key);
        this.b2.delete(key);
        return true;
    }
    clear() {
        this.cache.clear();
        this.t1.clear();
        this.t2.clear();
        this.b1.clear();
        this.b2.clear();
        this.head = undefined;
        this.tail = undefined;
        this.currentMemoryUsage = 0;
        this.stats.size = 0;
        this.adaptiveP = 0;
    }
    has(key) {
        const node = this.cache.get(key);
        return node ? !this.isExpired(node.entry) : false;
    }
    keys() {
        const validKeys = [];
        for (const [key, node] of this.cache) {
            if (!this.isExpired(node.entry)) {
                validKeys.push(key);
            }
        }
        return validKeys;
    }
    getStats() {
        this.updateStats();
        return { ...this.stats };
    }
    getHotKeys(limit = 10) {
        const entries = Array.from(this.cache.entries())
            .map(([key, node]) => ({
            key,
            frequency: node.entry.frequency,
            accessCount: node.entry.accessCount
        }))
            .sort((a, b) => b.frequency - a.frequency);
        return entries.slice(0, limit);
    }
    optimize() {
        this.cleanupExpired();
        if (this.config.evictionPolicy === 'ADAPTIVE') {
            this.rebalanceARC();
        }
        this.updateFrequencyScores();
    }
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
    }
    handleAccess(node) {
        switch (this.config.evictionPolicy) {
            case 'LRU':
                this.moveToFront(node);
                break;
            case 'LFU':
                this.updateLFUPosition(node);
                break;
            case 'ARC':
                this.handleARCAccess(node);
                break;
            case 'ADAPTIVE':
                this.handleAdaptiveAccess(node);
                break;
        }
    }
    handleInsertion(node) {
        switch (this.config.evictionPolicy) {
            case 'LRU':
                this.addToFront(node);
                break;
            case 'LFU':
                this.addToLFU(node);
                break;
            case 'ARC':
                this.handleARCInsertion(node);
                break;
            case 'ADAPTIVE':
                this.handleAdaptiveInsertion(node);
                break;
        }
    }
    handleARCAccess(node) {
        const key = node.entry.key;
        if (this.t1.has(key)) {
            this.t1.delete(key);
            this.t2.set(key, node);
            this.moveToFront(node);
        }
        else if (this.t2.has(key)) {
            this.moveToFront(node);
        }
    }
    handleARCInsertion(node) {
        const key = node.entry.key;
        if (this.b1.has(key)) {
            this.adaptiveP = Math.min(this.adaptiveP + Math.max(1, this.b2.size / this.b1.size), this.config.maxSize);
            this.b1.delete(key);
            this.t2.set(key, node);
        }
        else if (this.b2.has(key)) {
            this.adaptiveP = Math.max(this.adaptiveP - Math.max(1, this.b1.size / this.b2.size), 0);
            this.b2.delete(key);
            this.t2.set(key, node);
        }
        else {
            this.t1.set(key, node);
        }
        this.addToFront(node);
    }
    handleAdaptiveAccess(node) {
        const isHot = node.entry.frequency > this.calculateHotThreshold();
        if (isHot) {
            this.updateLFUPosition(node);
        }
        else {
            this.moveToFront(node);
        }
    }
    handleAdaptiveInsertion(node) {
        this.addToFront(node);
    }
    moveToFront(node) {
        if (node === this.head)
            return;
        this.removeNode(node);
        this.addToFront(node);
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
    removeNode(node) {
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
    }
    updateLFUPosition(node) {
        let current = this.head;
        while (current && current.entry.frequency >= node.entry.frequency) {
            current = current.next;
        }
        this.removeNode(node);
        if (!current) {
            if (this.tail) {
                this.tail.next = node;
                node.prev = this.tail;
                node.next = undefined;
                this.tail = node;
            }
            else {
                this.addToFront(node);
            }
        }
        else {
            node.next = current;
            node.prev = current.prev;
            if (current.prev) {
                current.prev.next = node;
            }
            else {
                this.head = node;
            }
            current.prev = node;
        }
    }
    addToLFU(node) {
        if (!this.head || node.entry.frequency <= this.head.entry.frequency) {
            this.addToFront(node);
        }
        else {
            this.updateLFUPosition(node);
        }
    }
    ensureCapacity(newEntrySize) {
        const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
        const memoryPressure = (this.currentMemoryUsage + newEntrySize) / maxMemoryBytes;
        while (this.stats.size >= this.config.maxSize) {
            this.evictLRU();
        }
        while (memoryPressure > this.config.memoryPressureThreshold && this.tail) {
            this.evictLRU();
        }
    }
    evictLRU() {
        if (!this.tail)
            return;
        const victimKey = this.tail.entry.key;
        if (this.config.evictionPolicy === 'ARC') {
            if (this.t1.has(victimKey)) {
                this.b1.set(victimKey, victimKey);
                this.t1.delete(victimKey);
            }
            else if (this.t2.has(victimKey)) {
                this.b2.set(victimKey, victimKey);
                this.t2.delete(victimKey);
            }
            if (this.b1.size > this.config.maxSize - this.adaptiveP) {
                const oldestB1 = this.b1.keys().next().value;
                if (oldestB1)
                    this.b1.delete(oldestB1);
            }
            if (this.b2.size > this.adaptiveP) {
                const oldestB2 = this.b2.keys().next().value;
                if (oldestB2)
                    this.b2.delete(oldestB2);
            }
        }
        this.delete(victimKey);
        this.stats.evictions++;
    }
    updateAccess(entry) {
        const now = Date.now();
        const timeSinceLastAccess = now - entry.lastAccessed;
        entry.accessCount++;
        entry.lastAccessed = now;
        const decay = Math.exp(-timeSinceLastAccess / (24 * 60 * 60 * 1000));
        entry.frequency = entry.frequency * decay + 1;
    }
    isExpired(entry) {
        if (!entry.ttl)
            return false;
        return Date.now() - entry.timestamp > entry.ttl;
    }
    estimateSize(value) {
        try {
            const serialized = JSON.stringify(value);
            return serialized.length * 2;
        }
        catch {
            return 1000;
        }
    }
    recordHit(startTime) {
        if (!this.config.enableStats)
            return;
        this.stats.hitCount++;
        const accessTime = performance.now() - startTime;
        this.updateAverageAccessTime(accessTime);
        this.updateHitRate();
    }
    recordMiss(startTime) {
        if (!this.config.enableStats)
            return;
        this.stats.missCount++;
        const accessTime = performance.now() - startTime;
        this.updateAverageAccessTime(accessTime);
        this.updateHitRate();
    }
    updateAverageAccessTime(accessTime) {
        const totalAccesses = this.stats.hitCount + this.stats.missCount;
        this.stats.averageAccessTime =
            (this.stats.averageAccessTime * (totalAccesses - 1) + accessTime) / totalAccesses;
    }
    updateHitRate() {
        const total = this.stats.hitCount + this.stats.missCount;
        this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
    }
    updateStats() {
        this.stats.memoryUsage = this.currentMemoryUsage;
        this.stats.size = this.cache.size;
        this.stats.hotKeyCount = Array.from(this.cache.values())
            .filter(node => node.entry.frequency > this.calculateHotThreshold()).length;
        const now = Date.now();
        const totalAge = Array.from(this.cache.values())
            .reduce((sum, node) => sum + (now - node.entry.timestamp), 0);
        this.stats.averageEntryAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;
    }
    calculateHotThreshold() {
        const frequencies = Array.from(this.cache.values()).map(node => node.entry.frequency);
        if (frequencies.length === 0)
            return 1;
        frequencies.sort((a, b) => b - a);
        const percentile90 = Math.floor(frequencies.length * 0.9);
        return frequencies[percentile90] || 1;
    }
    cleanupExpired() {
        const expiredKeys = [];
        for (const [key, node] of this.cache) {
            if (this.isExpired(node.entry)) {
                expiredKeys.push(key);
            }
        }
        expiredKeys.forEach(key => this.delete(key));
    }
    rebalanceARC() {
        const targetP = this.cache.size / 2;
        const delta = Math.abs(this.adaptiveP - targetP);
        if (delta > this.cache.size * 0.1) {
            this.adaptiveP = this.adaptiveP * 0.9 + targetP * 0.1;
        }
    }
    updateFrequencyScores() {
        const decay = 0.95;
        for (const node of this.cache.values()) {
            node.entry.frequency *= decay;
        }
    }
    startCleanupTimer() {
        if (this.config.cleanupInterval > 0) {
            this.cleanupTimer = setInterval(() => {
                this.cleanupExpired();
                if (this.config.evictionPolicy === 'ADAPTIVE') {
                    this.updateFrequencyScores();
                }
            }, this.config.cleanupInterval);
        }
    }
}
exports.LRUCache = LRUCache;
exports.default = LRUCache;
//# sourceMappingURL=LRUCache.js.map