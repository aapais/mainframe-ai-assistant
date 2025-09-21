"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryCache = void 0;
class QueryCache {
    memoryCache = new Map();
    db;
    config;
    stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalResponseTime: 0,
        operations: 0
    };
    constructor(db, config) {
        this.db = db;
        this.config = {
            maxSize: 1000,
            defaultTTL: 300000,
            maxMemoryMB: 100,
            persistToDisk: true,
            compressionEnabled: true,
            ...config
        };
        this.initializePersistentCache();
        this.startMaintenanceTimer();
    }
    initializePersistentCache() {
        if (!this.config.persistToDisk)
            return;
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS query_cache (
          cache_key TEXT PRIMARY KEY,
          value_data TEXT NOT NULL,
          value_type TEXT DEFAULT 'json',
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          hit_count INTEGER DEFAULT 0,
          last_accessed INTEGER NOT NULL,
          compute_time INTEGER DEFAULT 0,
          data_size INTEGER DEFAULT 0,
          compression_used BOOLEAN DEFAULT FALSE
        )
      `);
            this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cache_expires 
        ON query_cache(expires_at)
      `);
            this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cache_accessed 
        ON query_cache(last_accessed DESC)
      `);
            console.log('✅ Persistent query cache initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize persistent cache:', error);
        }
    }
    async get(key, computeFn, options) {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(key, options?.tags);
        if (options?.forceRefresh) {
            return this.computeAndCache(cacheKey, computeFn, options);
        }
        const memoryResult = this.getFromMemory(cacheKey);
        if (memoryResult !== null) {
            this.updateStats('hit', Date.now() - startTime);
            return memoryResult;
        }
        if (this.config.persistToDisk) {
            const persistentResult = await this.getFromDisk(cacheKey);
            if (persistentResult !== null) {
                this.setInMemory(cacheKey, persistentResult, options?.ttl);
                this.updateStats('hit', Date.now() - startTime);
                return persistentResult;
            }
        }
        this.updateStats('miss', Date.now() - startTime);
        return this.computeAndCache(cacheKey, computeFn, options);
    }
    async set(key, value, options) {
        const cacheKey = this.generateCacheKey(key, options?.tags);
        const ttl = options?.ttl || this.config.defaultTTL;
        this.setInMemory(cacheKey, value, ttl, options?.priority);
        if (this.config.persistToDisk) {
            await this.setOnDisk(cacheKey, value, ttl);
        }
    }
    async invalidate(pattern, tags) {
        let invalidated = 0;
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const [key] of this.memoryCache) {
                if (regex.test(key)) {
                    this.memoryCache.delete(key);
                    invalidated++;
                }
            }
        }
        if (tags && tags.length > 0) {
            for (const [key] of this.memoryCache) {
                if (tags.some(tag => key.includes(`tag:${tag}`))) {
                    this.memoryCache.delete(key);
                    invalidated++;
                }
            }
        }
        if (this.config.persistToDisk) {
            try {
                let sql = 'DELETE FROM query_cache WHERE 1=1';
                const params = [];
                if (pattern) {
                    sql += ' AND cache_key LIKE ?';
                    params.push(`%${pattern}%`);
                }
                if (tags && tags.length > 0) {
                    const tagConditions = tags.map(() => 'cache_key LIKE ?').join(' OR ');
                    sql += ` AND (${tagConditions})`;
                    params.push(...tags.map(tag => `%tag:${tag}%`));
                }
                const result = this.db.prepare(sql).run(...params);
                invalidated += result.changes || 0;
            }
            catch (error) {
                console.error('Error invalidating persistent cache:', error);
            }
        }
        console.log(`🗑️ Invalidated ${invalidated} cache entries`);
        return invalidated;
    }
    async preWarm() {
        console.log('🔥 Pre-warming query cache for large dataset...');
        const startTime = Date.now();
        const frequentQueries = await this.analyzeFrequentQueries();
        const commonQueries = [
            { key: 'popular_entries', fn: () => this.getPopularEntries(), priority: 'high' },
            { key: 'recent_entries', fn: () => this.getRecentEntries(), priority: 'high' },
            { key: 'category_stats', fn: () => this.getCategoryStats(), priority: 'medium' },
            { key: 'usage_trends', fn: () => this.getUsageTrends(), priority: 'medium' },
            { key: 'search_autocomplete', fn: () => this.getSearchAutoComplete(), priority: 'high' }
        ];
        const highPriorityQueries = commonQueries.filter(q => q.priority === 'high');
        await Promise.all(highPriorityQueries.map(async ({ key, fn }) => {
            try {
                await this.get(key, fn, { ttl: 900000 });
            }
            catch (error) {
                console.error(`Failed to pre-warm ${key}:`, error);
            }
        }));
        const mediumPriorityQueries = commonQueries.filter(q => q.priority === 'medium');
        await Promise.all(mediumPriorityQueries.map(async ({ key, fn }) => {
            try {
                await this.get(key, fn, { ttl: 600000 });
            }
            catch (error) {
                console.error(`Failed to pre-warm ${key}:`, error);
            }
        }));
        const categoryStats = await this.getCategoryUsageStats();
        const topCategories = categoryStats
            .sort((a, b) => b.searchFrequency - a.searchFrequency)
            .slice(0, 8);
        await Promise.all(topCategories.map(async ({ category, searchFrequency }) => {
            const ttl = this.calculateTTLBasedOnUsage(searchFrequency);
            await this.get(`category:${category}`, () => this.getCategoryEntries(category), { ttl });
        }));
        await Promise.all(frequentQueries.slice(0, 20).map(async (query) => {
            try {
                await this.get(`frequent:${query.normalized}`, () => this.executeFrequentQuery(query), {
                    ttl: this.calculateTTLBasedOnUsage(query.frequency)
                });
            }
            catch (error) {
                console.error(`Failed to pre-warm frequent query: ${query.normalized}`, error);
            }
        }));
        const popularSearches = await this.getPopularSearches();
        for (const search of popularSearches.slice(0, 10)) {
            for (let offset = 0; offset < 50; offset += 10) {
                await this.get(`paginated:${search.query}:${offset}`, () => this.executePaginatedSearch(search.query, offset), { ttl: 300000 });
            }
        }
        console.log(`✅ Intelligent cache pre-warming completed in ${Date.now() - startTime}ms`);
    }
    async analyzeFrequentQueries() {
        if (!this.config.persistToDisk)
            return [];
        return this.db.prepare(`
      SELECT 
        LOWER(TRIM(query)) as normalized,
        query as original,
        COUNT(*) as frequency,
        AVG(search_time_ms) as avgTime
      FROM search_history 
      WHERE timestamp > datetime('now', '-14 days')
        AND LENGTH(query) > 2
      GROUP BY LOWER(TRIM(query))
      HAVING frequency >= 3
      ORDER BY frequency DESC, avgTime DESC
      LIMIT 50
    `).all();
    }
    async getCategoryUsageStats() {
        return this.db.prepare(`
      SELECT 
        SUBSTR(query, 10) as category,
        COUNT(*) as searchFrequency,
        AVG(results_count) as avgResultsReturned
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND query LIKE 'category:%'
      GROUP BY SUBSTR(query, 10)
      ORDER BY searchFrequency DESC
    `).all();
    }
    calculateTTLBasedOnUsage(frequency) {
        if (frequency > 100)
            return 1800000;
        if (frequency > 50)
            return 900000;
        if (frequency > 20)
            return 600000;
        if (frequency > 10)
            return 300000;
        return 180000;
    }
    async executeFrequentQuery(query) {
        return [];
    }
    async executePaginatedSearch(query, offset) {
        return [];
    }
    async getPopularSearches() {
        return this.db.prepare(`
      SELECT query, COUNT(*) as frequency
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND LENGTH(query) > 2
      GROUP BY query
      ORDER BY frequency DESC
      LIMIT 20
    `).all();
    }
    async getSearchAutoComplete() {
        return this.db.prepare(`
      SELECT DISTINCT 
        SUBSTR(query, 1, 20) as suggestion,
        COUNT(*) as frequency
      FROM search_history 
      WHERE timestamp > datetime('now', '-30 days')
        AND LENGTH(query) >= 3
      GROUP BY SUBSTR(query, 1, 20)
      ORDER BY frequency DESC
      LIMIT 100
    `).all();
    }
    getFromMemory(key) {
        const entry = this.memoryCache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.timestamp + entry.ttl) {
            this.memoryCache.delete(key);
            return null;
        }
        entry.hitCount++;
        entry.lastAccessed = Date.now();
        return entry.value;
    }
    setInMemory(key, value, ttl, priority = 'normal') {
        this.enforceMemoryLimit();
        const entry = {
            key,
            value,
            timestamp: Date.now(),
            ttl: ttl || this.config.defaultTTL,
            hitCount: 1,
            lastAccessed: Date.now(),
            computeTime: 0,
            size: this.estimateSize(value)
        };
        if (priority === 'high') {
            entry.ttl *= 2;
        }
        else if (priority === 'low') {
            entry.ttl *= 0.5;
        }
        this.memoryCache.set(key, entry);
    }
    async getFromDisk(key) {
        if (!this.config.persistToDisk)
            return null;
        try {
            const result = this.db.prepare(`
        SELECT 
          value_data,
          value_type,
          expires_at,
          hit_count,
          compression_used
        FROM query_cache 
        WHERE cache_key = ? AND expires_at > ?
      `).get(key, Date.now());
            if (!result)
                return null;
            this.db.prepare(`
        UPDATE query_cache 
        SET hit_count = hit_count + 1, last_accessed = ?
        WHERE cache_key = ?
      `).run(Date.now(), key);
            let value = result.value_data;
            if (result.compression_used) {
                value = this.decompress(value);
            }
            if (result.value_type === 'json') {
                return JSON.parse(value);
            }
            return value;
        }
        catch (error) {
            console.error('Error reading from persistent cache:', error);
            return null;
        }
    }
    async setOnDisk(key, value, ttl) {
        if (!this.config.persistToDisk)
            return;
        try {
            let serializedValue = JSON.stringify(value);
            let compressed = false;
            if (this.config.compressionEnabled && serializedValue.length > 1000) {
                serializedValue = this.compress(serializedValue);
                compressed = true;
            }
            const expiresAt = Date.now() + ttl;
            const dataSize = serializedValue.length;
            this.db.prepare(`
        INSERT OR REPLACE INTO query_cache (
          cache_key, value_data, value_type, created_at, expires_at,
          last_accessed, data_size, compression_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(key, serializedValue, 'json', Date.now(), expiresAt, Date.now(), dataSize, compressed);
        }
        catch (error) {
            console.error('Error writing to persistent cache:', error);
        }
    }
    async computeAndCache(key, computeFn, options) {
        const startTime = Date.now();
        try {
            const value = await computeFn();
            const computeTime = Date.now() - startTime;
            await this.set(key, value, {
                ttl: options?.ttl,
                tags: options?.tags,
                priority: computeTime > 100 ? 'high' : 'normal'
            });
            return value;
        }
        catch (error) {
            console.error('Error computing cached value:', error);
            throw error;
        }
    }
    generateCacheKey(key, tags) {
        let cacheKey = `qc:${key}`;
        if (tags && tags.length > 0) {
            cacheKey += `:tags:${tags.sort().join(',')}`;
        }
        return cacheKey;
    }
    enforceMemoryLimit() {
        const currentSize = this.getCurrentMemoryUsage();
        const maxSize = this.config.maxMemoryMB * 1024 * 1024;
        if (currentSize <= maxSize && this.memoryCache.size < this.config.maxSize) {
            return;
        }
        const entries = Array.from(this.memoryCache.entries()).sort((a, b) => {
            const [, entryA] = a;
            const [, entryB] = b;
            const scoreA = entryA.hitCount * Math.log(entryA.computeTime + 1);
            const scoreB = entryB.hitCount * Math.log(entryB.computeTime + 1);
            if (scoreA !== scoreB) {
                return scoreA - scoreB;
            }
            return entryA.lastAccessed - entryB.lastAccessed;
        });
        const targetEviction = Math.max(Math.ceil(this.memoryCache.size * 0.1), this.memoryCache.size - this.config.maxSize + 100);
        for (let i = 0; i < targetEviction && i < entries.length; i++) {
            const [key] = entries[i];
            this.memoryCache.delete(key);
            this.stats.evictions++;
        }
        console.log(`🗑️ Evicted ${targetEviction} cache entries to maintain memory limit`);
    }
    getCurrentMemoryUsage() {
        let totalSize = 0;
        for (const entry of this.memoryCache.values()) {
            totalSize += entry.size;
        }
        return totalSize;
    }
    estimateSize(obj) {
        const json = JSON.stringify(obj);
        return new Blob([json]).size;
    }
    updateStats(type, responseTime) {
        if (type === 'hit') {
            this.stats.hits++;
        }
        else {
            this.stats.misses++;
        }
        this.stats.totalResponseTime += responseTime;
        this.stats.operations++;
    }
    startMaintenanceTimer() {
        setInterval(() => {
            this.cleanupExpiredEntries();
        }, 5 * 60 * 1000);
        setInterval(() => {
            this.performMaintenance();
        }, 60 * 60 * 1000);
    }
    cleanupExpiredEntries() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.memoryCache) {
            if (now > entry.timestamp + entry.ttl) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }
        if (this.config.persistToDisk) {
            try {
                const result = this.db.prepare(`
          DELETE FROM query_cache WHERE expires_at < ?
        `).run(now);
                cleaned += result.changes || 0;
            }
            catch (error) {
                console.error('Error cleaning persistent cache:', error);
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
        }
    }
    performMaintenance() {
        console.log('🔧 Performing cache maintenance...');
        this.cleanupExpiredEntries();
        this.enforceMemoryLimit();
        if (this.config.persistToDisk) {
            try {
                const retentionDays = 7;
                const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
                this.db.prepare(`
          DELETE FROM query_cache 
          WHERE created_at < ? AND hit_count < 5
        `).run(cutoff);
                console.log('✅ Cache maintenance completed');
            }
            catch (error) {
                console.error('Error during cache maintenance:', error);
            }
        }
    }
    getStats() {
        const totalOperations = this.stats.hits + this.stats.misses;
        const hitRate = totalOperations > 0 ? this.stats.hits / totalOperations : 0;
        const avgResponseTime = this.stats.operations > 0 ?
            this.stats.totalResponseTime / this.stats.operations : 0;
        const topQueries = this.config.persistToDisk ?
            this.db.prepare(`
        SELECT 
          cache_key as query,
          hit_count,
          AVG(data_size) as avg_time
        FROM query_cache
        GROUP BY cache_key
        ORDER BY hit_count DESC
        LIMIT 10
      `).all() : [];
        return {
            totalEntries: this.memoryCache.size,
            totalSize: this.getCurrentMemoryUsage(),
            hitRate: Math.round(hitRate * 100) / 100,
            missRate: Math.round((1 - hitRate) * 100) / 100,
            avgResponseTime: Math.round(avgResponseTime),
            evictionCount: this.stats.evictions,
            topQueries
        };
    }
    compress(data) {
        return data;
    }
    decompress(data) {
        return data;
    }
    async getPopularEntries() {
        return this.db.prepare(`
      SELECT id, title, category, usage_count, success_count
      FROM kb_entries
      WHERE archived = FALSE
      ORDER BY usage_count DESC, success_count DESC
      LIMIT 20
    `).all();
    }
    async getRecentEntries() {
        return this.db.prepare(`
      SELECT id, title, category, created_at
      FROM kb_entries
      WHERE archived = FALSE
      ORDER BY created_at DESC
      LIMIT 20
    `).all();
    }
    async getCategoryStats() {
        return this.db.prepare(`
      SELECT 
        category,
        COUNT(*) as total,
        SUM(usage_count) as total_usage,
        AVG(CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count)
                 ELSE 0 END) as avg_success_rate
      FROM kb_entries
      WHERE archived = FALSE
      GROUP BY category
    `).all();
    }
    async getUsageTrends() {
        return this.db.prepare(`
      SELECT 
        date(timestamp) as date,
        COUNT(*) as searches,
        COUNT(DISTINCT user_id) as unique_users
      FROM search_history
      WHERE timestamp > datetime('now', '-30 days')
      GROUP BY date(timestamp)
      ORDER BY date DESC
    `).all();
    }
    async getCategoryEntries(category) {
        return this.db.prepare(`
      SELECT id, title, problem, solution, usage_count, success_count
      FROM kb_entries
      WHERE category = ? AND archived = FALSE
      ORDER BY usage_count DESC
      LIMIT 50
    `).all(category);
    }
}
exports.QueryCache = QueryCache;
//# sourceMappingURL=QueryCache.js.map