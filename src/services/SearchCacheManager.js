"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchCacheManager = void 0;
class SearchCacheManager {
    l1Cache = new Map();
    l2Cache = null;
    l3CacheName = 'search-cache-v1';
    metrics = {
        hitCount: 0,
        missCount: 0,
        hitRate: 0,
        totalEntries: 0,
        totalSize: 0,
        averageAccessTime: 0,
        evictionCount: 0,
        l1Hits: 0,
        l2Hits: 0,
        l3Hits: 0
    };
    config;
    cleanupInterval = null;
    constructor(config = {}) {
        this.config = {
            l1MaxSize: 100,
            l2MaxSize: 1000,
            defaultTTL: 5 * 60 * 1000,
            cleanupInterval: 2 * 60 * 1000,
            compressionEnabled: true,
            persistentCacheEnabled: true,
            serviceWorkerCacheEnabled: false,
            ...config
        };
        this.initialize();
    }
    async initialize() {
        try {
            if (this.config.persistentCacheEnabled) {
                await this.initializeIndexedDB();
            }
            if (this.config.serviceWorkerCacheEnabled && 'caches' in window) {
                await this.initializeServiceWorkerCache();
            }
            this.startCleanup();
            console.log('SearchCacheManager initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize cache manager:', error);
        }
    }
    initializeIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SearchCacheDB', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.l2Cache = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('searchCache')) {
                    const store = db.createObjectStore('searchCache', { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('lastAccess', 'lastAccess', { unique: false });
                }
            };
        });
    }
    async initializeServiceWorkerCache() {
        try {
            await caches.open(this.l3CacheName);
            console.log('Service worker cache initialized');
        }
        catch (error) {
            console.warn('Service worker cache initialization failed:', error);
        }
    }
    generateCacheKey(query, options = {}) {
        const normalizedQuery = query.toLowerCase().trim();
        const keyObject = {
            query: normalizedQuery,
            category: options.category,
            tags: options.tags?.sort(),
            sortBy: options.sortBy,
            sortOrder: options.sortOrder,
            filters: options.filters
        };
        return btoa(JSON.stringify(keyObject)).replace(/[+/=]/g, '');
    }
    async get(query, options = {}) {
        const startTime = performance.now();
        const key = this.generateCacheKey(query, options);
        try {
            const l1Result = this.getFromL1(key);
            if (l1Result) {
                this.updateMetrics('l1_hit', performance.now() - startTime);
                return l1Result;
            }
            if (this.config.persistentCacheEnabled && this.l2Cache) {
                const l2Result = await this.getFromL2(key);
                if (l2Result) {
                    this.setInL1(key, l2Result, query, options);
                    this.updateMetrics('l2_hit', performance.now() - startTime);
                    return l2Result.results;
                }
            }
            if (this.config.serviceWorkerCacheEnabled && 'caches' in window) {
                const l3Result = await this.getFromL3(key);
                if (l3Result) {
                    this.setInL1(key, l3Result, query, options);
                    if (this.l2Cache) {
                        await this.setInL2(key, l3Result);
                    }
                    this.updateMetrics('l3_hit', performance.now() - startTime);
                    return l3Result.results;
                }
            }
            this.updateMetrics('cache_miss', performance.now() - startTime);
            return null;
        }
        catch (error) {
            console.error('Cache get operation failed:', error);
            this.updateMetrics('cache_miss', performance.now() - startTime);
            return null;
        }
    }
    async set(query, results, options = {}, searchDuration = 0) {
        const key = this.generateCacheKey(query, options);
        try {
            const entry = {
                key,
                results,
                timestamp: Date.now(),
                ttl: this.config.defaultTTL,
                accessCount: 1,
                lastAccess: Date.now(),
                metadata: {
                    query,
                    options,
                    resultCount: results.length,
                    searchDuration
                }
            };
            this.setInL1(key, entry, query, options);
            if (this.config.persistentCacheEnabled && this.l2Cache) {
                await this.setInL2(key, entry);
            }
            if (this.config.serviceWorkerCacheEnabled && 'caches' in window) {
                await this.setInL3(key, entry);
            }
            this.updateCacheMetrics();
        }
        catch (error) {
            console.error('Cache set operation failed:', error);
        }
    }
    getFromL1(key) {
        const entry = this.l1Cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.timestamp + entry.ttl) {
            this.l1Cache.delete(key);
            return null;
        }
        entry.accessCount++;
        entry.lastAccess = Date.now();
        return entry.results;
    }
    setInL1(key, entry, query, options) {
        if (this.l1Cache.size >= this.config.l1MaxSize) {
            this.evictLRUFromL1();
        }
        this.l1Cache.set(key, entry);
    }
    evictLRUFromL1() {
        let oldestKey = '';
        let oldestTime = Date.now();
        for (const [key, entry] of this.l1Cache) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.l1Cache.delete(oldestKey);
            this.metrics.evictionCount++;
        }
    }
    async getFromL2(key) {
        if (!this.l2Cache)
            return null;
        return new Promise((resolve) => {
            const transaction = this.l2Cache.transaction(['searchCache'], 'readonly');
            const store = transaction.objectStore('searchCache');
            const request = store.get(key);
            request.onsuccess = () => {
                const entry = request.result;
                if (!entry) {
                    resolve(null);
                    return;
                }
                if (Date.now() > entry.timestamp + entry.ttl) {
                    this.deleteFromL2(key);
                    resolve(null);
                    return;
                }
                entry.accessCount++;
                entry.lastAccess = Date.now();
                this.setInL2(key, entry);
                resolve(entry);
            };
            request.onerror = () => resolve(null);
        });
    }
    async setInL2(key, entry) {
        if (!this.l2Cache)
            return;
        return new Promise((resolve) => {
            const transaction = this.l2Cache.transaction(['searchCache'], 'readwrite');
            const store = transaction.objectStore('searchCache');
            if (this.config.compressionEnabled) {
                entry = this.compressEntry(entry);
            }
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }
    async deleteFromL2(key) {
        if (!this.l2Cache)
            return;
        return new Promise((resolve) => {
            const transaction = this.l2Cache.transaction(['searchCache'], 'readwrite');
            const store = transaction.objectStore('searchCache');
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }
    async getFromL3(key) {
        try {
            if (!('caches' in window))
                return null;
            const cache = await caches.open(this.l3CacheName);
            const response = await cache.match(key);
            if (!response)
                return null;
            const entry = await response.json();
            if (Date.now() > entry.timestamp + entry.ttl) {
                await cache.delete(key);
                return null;
            }
            return entry;
        }
        catch (error) {
            console.warn('L3 cache get failed:', error);
            return null;
        }
    }
    async setInL3(key, entry) {
        try {
            if (!('caches' in window))
                return;
            const cache = await caches.open(this.l3CacheName);
            const response = new Response(JSON.stringify(entry), {
                headers: { 'Content-Type': 'application/json' }
            });
            await cache.put(key, response);
        }
        catch (error) {
            console.warn('L3 cache set failed:', error);
        }
    }
    async warmCache(queries) {
        console.log(`Warming cache with ${queries.length} queries...`);
        const warmingPromises = queries.map(async ({ query, options }) => {
            try {
                const cached = await this.get(query, options);
                if (!cached) {
                    console.log(`Cache warming needed for query: ${query}`);
                }
            }
            catch (error) {
                console.warn(`Cache warming failed for query "${query}":`, error);
            }
        });
        await Promise.allSettled(warmingPromises);
        console.log('Cache warming completed');
    }
    async prefetchQueries(baseQuery, variations) {
        const prefetchPromises = variations.map(async (variation) => {
            try {
                const query = `${baseQuery  } ${  variation}`;
                const cached = await this.get(query);
                if (!cached) {
                    console.log(`Prefetch candidate: ${query}`);
                }
            }
            catch (error) {
                console.warn(`Prefetch failed for variation "${variation}":`, error);
            }
        });
        await Promise.allSettled(prefetchPromises);
    }
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupInterval);
    }
    async performCleanup() {
        try {
            this.cleanupL1();
            if (this.config.persistentCacheEnabled && this.l2Cache) {
                await this.cleanupL2();
            }
            this.updateCacheMetrics();
            console.log('Cache cleanup completed');
        }
        catch (error) {
            console.error('Cache cleanup failed:', error);
        }
    }
    cleanupL1() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, entry] of this.l1Cache) {
            if (now > entry.timestamp + entry.ttl) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.l1Cache.delete(key));
    }
    async cleanupL2() {
        if (!this.l2Cache)
            return;
        return new Promise((resolve) => {
            const transaction = this.l2Cache.transaction(['searchCache'], 'readwrite');
            const store = transaction.objectStore('searchCache');
            const index = store.index('timestamp');
            const now = Date.now();
            const cutoff = now - this.config.defaultTTL;
            const range = IDBKeyRange.upperBound(cutoff);
            const request = index.openCursor(range);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
                else {
                    resolve();
                }
            };
            request.onerror = () => resolve();
        });
    }
    compressEntry(entry) {
        const compressed = {
            ...entry,
            results: entry.results.map(result => ({
                ...result,
                entry: {
                    ...result.entry,
                    problem: result.entry.problem.length > 500
                        ? `${result.entry.problem.substring(0, 500)  }...`
                        : result.entry.problem,
                    solution: result.entry.solution.length > 500
                        ? `${result.entry.solution.substring(0, 500)  }...`
                        : result.entry.solution
                }
            }))
        };
        return compressed;
    }
    updateMetrics(operation, duration) {
        switch (operation) {
            case 'l1_hit':
                this.metrics.hitCount++;
                this.metrics.l1Hits++;
                break;
            case 'l2_hit':
                this.metrics.hitCount++;
                this.metrics.l2Hits++;
                break;
            case 'l3_hit':
                this.metrics.hitCount++;
                this.metrics.l3Hits++;
                break;
            case 'cache_miss':
                this.metrics.missCount++;
                break;
        }
        const totalRequests = this.metrics.hitCount + this.metrics.missCount;
        this.metrics.hitRate = totalRequests > 0 ? this.metrics.hitCount / totalRequests : 0;
        this.metrics.averageAccessTime = (this.metrics.averageAccessTime + duration) / 2;
    }
    updateCacheMetrics() {
        this.metrics.totalEntries = this.l1Cache.size;
        let totalSize = 0;
        for (const entry of this.l1Cache.values()) {
            totalSize += JSON.stringify(entry).length;
        }
        this.metrics.totalSize = totalSize;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    async clearAll() {
        try {
            this.l1Cache.clear();
            if (this.l2Cache) {
                const transaction = this.l2Cache.transaction(['searchCache'], 'readwrite');
                const store = transaction.objectStore('searchCache');
                await new Promise((resolve) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => resolve();
                });
            }
            if ('caches' in window) {
                await caches.delete(this.l3CacheName);
                await caches.open(this.l3CacheName);
            }
            this.metrics = {
                hitCount: 0,
                missCount: 0,
                hitRate: 0,
                totalEntries: 0,
                totalSize: 0,
                averageAccessTime: 0,
                evictionCount: 0,
                l1Hits: 0,
                l2Hits: 0,
                l3Hits: 0
            };
            console.log('All caches cleared');
        }
        catch (error) {
            console.error('Failed to clear caches:', error);
        }
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.l1Cache.clear();
        if (this.l2Cache) {
            this.l2Cache.close();
        }
    }
}
exports.SearchCacheManager = SearchCacheManager;
exports.default = SearchCacheManager;
//# sourceMappingURL=SearchCacheManager.js.map