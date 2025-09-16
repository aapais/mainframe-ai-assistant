"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDB = void 0;
exports.createKnowledgeDB = createKnowledgeDB;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const MigrationManager_1 = require("./MigrationManager");
const QueryOptimizer_1 = require("./QueryOptimizer");
const PerformanceTuner_1 = require("./PerformanceTuner");
const BackupManager_1 = require("./BackupManager");
const DataSeeder_1 = require("./DataSeeder");
const AdvancedIndexStrategy_1 = require("./AdvancedIndexStrategy");
const QueryCache_1 = require("./QueryCache");
const ConnectionPool_1 = require("./ConnectionPool");
const PerformanceMonitor_1 = require("./PerformanceMonitor");
class KnowledgeDB {
    db;
    migrationManager;
    queryOptimizer;
    performanceTuner;
    backupManager;
    dataSeeder;
    advancedIndexStrategy;
    queryCache;
    connectionPool;
    performanceMonitor;
    initialized = false;
    constructor(dbPath = './knowledge.db', options) {
        console.log('🚀 Initializing Knowledge Database...');
        this.db = new better_sqlite3_1.default(dbPath);
        this.migrationManager = new MigrationManager_1.MigrationManager(this.db);
        this.performanceTuner = new PerformanceTuner_1.PerformanceTuner(this.db);
        this.queryOptimizer = new QueryOptimizer_1.QueryOptimizer(this.db);
        this.backupManager = new BackupManager_1.BackupManager(this.db, options?.backupDir, options?.maxBackups);
        this.dataSeeder = new DataSeeder_1.DataSeeder(this);
        this.advancedIndexStrategy = new AdvancedIndexStrategy_1.AdvancedIndexStrategy(this.db);
        this.queryCache = new QueryCache_1.QueryCache(this.db, {
            maxSize: 1000,
            defaultTTL: 300000,
            maxMemoryMB: 100,
            persistToDisk: true,
            compressionEnabled: true
        });
        this.connectionPool = new ConnectionPool_1.ConnectionPool(dbPath, {
            maxReaders: 5,
            maxWriters: 1,
            acquireTimeout: 30000,
            idleTimeout: 300000,
            enableWAL: true
        });
        this.performanceMonitor = new PerformanceMonitor_1.PerformanceMonitor(this.db, {
            slowQueryThreshold: 1000,
            criticalThreshold: 5000,
            enableRealTimeAlerts: true,
            enableQueryPlanCapture: true
        });
        this.initialize(options);
    }
    async initialize(options) {
        try {
            console.log('🔧 Setting up database schema and optimizations...');
            const migrationResults = await this.migrationManager.migrate();
            if (migrationResults.some(r => !r.success)) {
                console.warn('⚠️ Some migrations failed, but continuing...');
            }
            this.performanceTuner.optimize();
            this.performanceTuner.scheduleMaintenace();
            if (options?.autoBackup !== false) {
                this.backupManager.scheduleAutoBackups(options?.backupInterval || 24);
            }
            if (await this.dataSeeder.needsSeeding()) {
                console.log('🌱 Database appears empty, seeding with initial data...');
                await this.dataSeeder.seedAll();
            }
            this.initialized = true;
            console.log('✅ Knowledge Database initialized successfully');
            this.logInitializationStats();
        }
        catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }
    async addEntry(entry, userId) {
        this.ensureInitialized();
        const id = entry.id || (0, uuid_1.v4)();
        const transaction = this.db.transaction(() => {
            try {
                this.db.prepare(`
          INSERT INTO kb_entries (
            id, title, problem, solution, category, severity, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, entry.title, entry.problem, entry.solution, entry.category, entry.severity || 'medium', userId || 'system');
                if (entry.tags && entry.tags.length > 0) {
                    const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
                    entry.tags.forEach(tag => {
                        tagStmt.run(id, tag.toLowerCase().trim());
                    });
                }
                return id;
            }
            catch (error) {
                console.error('Failed to add entry:', error);
                throw error;
            }
        });
        return transaction();
    }
    async updateEntry(id, updates, userId) {
        this.ensureInitialized();
        const transaction = this.db.transaction(() => {
            const setClause = [];
            const values = [];
            if (updates.title !== undefined) {
                setClause.push('title = ?');
                values.push(updates.title);
            }
            if (updates.problem !== undefined) {
                setClause.push('problem = ?');
                values.push(updates.problem);
            }
            if (updates.solution !== undefined) {
                setClause.push('solution = ?');
                values.push(updates.solution);
            }
            if (updates.category !== undefined) {
                setClause.push('category = ?');
                values.push(updates.category);
            }
            if (updates.severity !== undefined) {
                setClause.push('severity = ?');
                values.push(updates.severity);
            }
            if (updates.archived !== undefined) {
                setClause.push('archived = ?');
                values.push(updates.archived);
            }
            if (setClause.length > 0) {
                setClause.push('updated_at = CURRENT_TIMESTAMP');
                values.push(id);
                this.db.prepare(`
          UPDATE kb_entries 
          SET ${setClause.join(', ')}
          WHERE id = ?
        `).run(...values);
            }
            if (updates.tags !== undefined) {
                this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);
                if (updates.tags.length > 0) {
                    const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
                    updates.tags.forEach(tag => {
                        tagStmt.run(id, tag.toLowerCase().trim());
                    });
                }
            }
        });
        transaction();
    }
    async search(query, options) {
        this.ensureInitialized();
        const searchOptions = {
            query,
            limit: 10,
            offset: 0,
            sortBy: 'relevance',
            includeArchived: false,
            ...options
        };
        const normalizedQuery = this.normalizeQuery(query);
        const cacheKey = this.generateSearchCacheKey(normalizedQuery, searchOptions);
        return this.performanceMonitor.measureOperation('search', async () => {
            return this.queryCache.get(cacheKey, async () => {
                const strategy = await this.selectSearchStrategy(normalizedQuery, searchOptions);
                const result = await this.executeHybridSearch(strategy, normalizedQuery, searchOptions);
                const searchResults = result.results.map(row => ({
                    entry: {
                        id: row.id,
                        title: row.title,
                        problem: row.problem,
                        solution: row.solution,
                        category: row.category,
                        severity: row.severity,
                        tags: row.tags ? row.tags.split(', ') : [],
                        usage_count: row.usage_count,
                        success_count: row.success_count,
                        failure_count: row.failure_count,
                        last_used: row.last_used ? new Date(row.last_used) : undefined
                    },
                    score: this.calculateRelevanceScore(row, normalizedQuery, result.strategy),
                    matchType: result.strategy,
                    highlights: this.generateAdvancedHighlights(normalizedQuery, row)
                }));
                return searchResults;
            }, {
                ttl: this.calculateCacheTTL(searchOptions),
                tags: this.generateCacheTags(searchOptions),
                priority: this.getCachePriority(normalizedQuery)
            });
        }, {
            recordsProcessed: searchOptions.limit || 10,
            queryComplexity: this.calculateQueryComplexity(normalizedQuery)
        });
    }
    async autoComplete(query, limit = 5) {
        if (!query || query.length < 2)
            return [];
        const cacheKey = `autocomplete:${query.toLowerCase()}:${limit}`;
        return this.queryCache.get(cacheKey, async () => {
            const suggestions = this.db.prepare(`
        WITH suggestions AS (
          -- Common search terms
          SELECT DISTINCT 
            SUBSTR(query, 1, 50) as suggestion,
            'search' as category,
            COUNT(*) * 2 as score
          FROM search_history 
          WHERE query LIKE ? || '%'
          GROUP BY SUBSTR(query, 1, 50)
          
          UNION ALL
          
          -- Entry titles
          SELECT DISTINCT 
            title as suggestion,
            'entry' as category,
            usage_count + success_count as score
          FROM kb_entries 
          WHERE title LIKE '%' || ? || '%'
            AND archived = FALSE
          
          UNION ALL
          
          -- Categories
          SELECT DISTINCT 
            'category:' || category as suggestion,
            'filter' as category,
            COUNT(*) * 1.5 as score
          FROM kb_entries 
          WHERE category LIKE ? || '%'
            AND archived = FALSE
          GROUP BY category
          
          UNION ALL
          
          -- Tags
          SELECT DISTINCT 
            'tag:' || tag as suggestion,
            'filter' as category,
            COUNT(*) as score
          FROM kb_tags 
          WHERE tag LIKE ? || '%'
          GROUP BY tag
        )
        SELECT suggestion, category, score
        FROM suggestions
        WHERE suggestion IS NOT NULL
        ORDER BY score DESC, length(suggestion) ASC
        LIMIT ?
      `).all(query, query, query, query, limit);
            return suggestions;
        }, {
            ttl: 30000,
            priority: 'high'
        });
    }
    async searchWithFacets(query, options) {
        const searchResults = await this.search(query, options);
        const facetsCacheKey = `facets:${this.normalizeQuery(query)}`;
        const facets = await this.queryCache.get(facetsCacheKey, async () => {
            return this.calculateFacets(query, options);
        }, {
            ttl: 120000,
            tags: ['facets']
        });
        return {
            results: searchResults,
            facets,
            totalCount: searchResults.length
        };
    }
    async getEntry(id) {
        this.ensureInitialized();
        const entry = this.queryOptimizer.getById(id);
        if (!entry)
            return null;
        return {
            id: entry.id,
            title: entry.title,
            problem: entry.problem,
            solution: entry.solution,
            category: entry.category,
            severity: entry.severity,
            tags: entry.tags ? entry.tags.split(', ') : [],
            created_at: new Date(entry.created_at),
            updated_at: new Date(entry.updated_at),
            created_by: entry.created_by,
            usage_count: entry.usage_count,
            success_count: entry.success_count,
            failure_count: entry.failure_count,
            last_used: entry.last_used ? new Date(entry.last_used) : undefined,
            archived: entry.archived
        };
    }
    async recordUsage(entryId, successful, userId) {
        this.ensureInitialized();
        const action = successful ? 'rate_success' : 'rate_failure';
        this.db.prepare(`
      INSERT INTO usage_metrics (entry_id, action, user_id)
      VALUES (?, ?, ?)
    `).run(entryId, action, userId || 'anonymous');
    }
    async getPopular(limit = 10) {
        this.ensureInitialized();
        const entries = this.queryOptimizer.getPopular(limit);
        return entries.map(entry => ({
            entry: {
                id: entry.id,
                title: entry.title,
                category: entry.category,
                tags: entry.tags ? entry.tags.split(', ') : [],
                usage_count: entry.usage_count,
                success_count: entry.success_count,
                failure_count: entry.failure_count,
                last_used: entry.last_used ? new Date(entry.last_used) : undefined
            },
            score: entry.success_rate,
            matchType: 'popular'
        }));
    }
    async getRecent(limit = 10) {
        this.ensureInitialized();
        const entries = this.queryOptimizer.getRecent(limit);
        return entries.map(entry => ({
            entry: {
                id: entry.id,
                title: entry.title,
                category: entry.category,
                tags: entry.tags ? entry.tags.split(', ') : [],
                created_at: new Date(entry.created_at),
                usage_count: entry.usage_count
            },
            score: 100,
            matchType: 'recent'
        }));
    }
    async getStats() {
        this.ensureInitialized();
        const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalEntries,
        COUNT(CASE WHEN last_used > datetime('now', '-7 days') THEN 1 END) as recentActivity,
        AVG(CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count)
                 ELSE 0 END) as averageSuccessRate
      FROM kb_entries
      WHERE archived = FALSE
    `).get();
        const categoryCounts = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM kb_entries
      WHERE archived = FALSE
      GROUP BY category
    `).all();
        const searchesToday = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM search_history
      WHERE date(timestamp) = date('now')
    `).get();
        const topEntries = this.db.prepare(`
      SELECT title, usage_count
      FROM kb_entries
      WHERE archived = FALSE
      ORDER BY usage_count DESC
      LIMIT 5
    `).all();
        const performance = this.queryOptimizer.getPerformanceStats();
        const diskUsage = this.getDiskUsage();
        const categoryMap = {};
        categoryCounts.forEach(cat => {
            categoryMap[cat.category] = cat.count;
        });
        return {
            totalEntries: stats.totalEntries,
            categoryCounts: categoryMap,
            recentActivity: stats.recentActivity,
            searchesToday: searchesToday.count,
            averageSuccessRate: Math.round((stats.averageSuccessRate || 0) * 100),
            topEntries,
            diskUsage,
            performance: {
                avgSearchTime: performance.avgSearchTime,
                cacheHitRate: performance.cacheHitRate
            }
        };
    }
    async createBackup() {
        this.ensureInitialized();
        await this.backupManager.createBackup('manual');
    }
    async restoreFromBackup(backupPath) {
        this.ensureInitialized();
        await this.backupManager.restoreFromBackup({ backupPath });
    }
    async exportToJSON(outputPath) {
        this.ensureInitialized();
        await this.backupManager.exportToJSON(outputPath);
    }
    async importFromJSON(jsonPath, mergeMode = false) {
        this.ensureInitialized();
        await this.backupManager.importFromJSON(jsonPath, mergeMode);
    }
    getConfig(key) {
        this.ensureInitialized();
        const result = this.db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
        return result?.value || null;
    }
    async setConfig(key, value, type = 'string', description) {
        this.ensureInitialized();
        this.db.prepare(`
      INSERT OR REPLACE INTO system_config (key, value, type, description)
      VALUES (?, ?, ?, ?)
    `).run(key, value, type, description);
    }
    getEntryCount() {
        this.ensureInitialized();
        const result = this.db.prepare('SELECT COUNT(*) as count FROM kb_entries WHERE archived = FALSE').get();
        return result.count;
    }
    async optimize() {
        this.ensureInitialized();
        console.log('🔧 Optimizing database...');
        this.performanceTuner.optimize();
        this.queryOptimizer.optimize();
    }
    getRecommendations() {
        this.ensureInitialized();
        return this.performanceTuner.getRecommendations();
    }
    getPerformanceStatus() {
        this.ensureInitialized();
        return this.performanceMonitor.getRealTimeStatus();
    }
    generatePerformanceReport(startTime, endTime) {
        this.ensureInitialized();
        return this.performanceMonitor.generateReport(startTime, endTime);
    }
    getPerformanceTrends(hours = 24) {
        this.ensureInitialized();
        return this.performanceMonitor.getPerformanceTrends(hours);
    }
    getSlowQueries(limit = 10) {
        this.ensureInitialized();
        return this.performanceMonitor.getSlowQueries(limit);
    }
    getCacheStats() {
        this.ensureInitialized();
        return this.queryCache.getStats();
    }
    getConnectionPoolStats() {
        this.ensureInitialized();
        return this.connectionPool.getStats();
    }
    getIndexAnalysis() {
        this.ensureInitialized();
        return this.advancedIndexStrategy.analyzeIndexEffectiveness();
    }
    getIndexMaintenanceReport() {
        this.ensureInitialized();
        return this.advancedIndexStrategy.generateMaintenanceReport();
    }
    async optimizeIndexes() {
        this.ensureInitialized();
        return this.advancedIndexStrategy.optimizeForQueryPatterns();
    }
    async preWarmCache() {
        this.ensureInitialized();
        await this.queryCache.preWarm();
    }
    async invalidateCache(pattern, tags) {
        this.ensureInitialized();
        return this.queryCache.invalidate(pattern, tags);
    }
    async healthCheck() {
        this.ensureInitialized();
        const issues = [];
        let dbHealthy = true;
        let cacheHealthy = true;
        let connectionsHealthy = true;
        let performanceHealthy = true;
        try {
            this.db.prepare('SELECT 1').get();
        }
        catch (error) {
            dbHealthy = false;
            issues.push('Database connectivity issue');
        }
        try {
            const cacheStats = this.queryCache.getStats();
            if (cacheStats.hitRate < 0.5) {
                issues.push('Low cache hit rate');
            }
        }
        catch (error) {
            cacheHealthy = false;
            issues.push('Cache system issue');
        }
        try {
            const poolHealth = await this.connectionPool.healthCheck();
            if (!poolHealth.healthy) {
                connectionsHealthy = false;
                issues.push(...poolHealth.issues);
            }
        }
        catch (error) {
            connectionsHealthy = false;
            issues.push('Connection pool issue');
        }
        try {
            const perfStatus = this.performanceMonitor.getRealTimeStatus();
            if (!perfStatus.isHealthy) {
                performanceHealthy = false;
                issues.push('Performance degradation detected');
            }
        }
        catch (error) {
            performanceHealthy = false;
            issues.push('Performance monitoring issue');
        }
        const overall = dbHealthy && cacheHealthy && connectionsHealthy && performanceHealthy;
        return {
            overall,
            database: dbHealthy,
            cache: cacheHealthy,
            connections: connectionsHealthy,
            performance: performanceHealthy,
            issues
        };
    }
    async close() {
        if (this.performanceMonitor) {
            this.performanceMonitor.stopMonitoring();
        }
        if (this.connectionPool) {
            await this.connectionPool.close();
        }
        if (this.db) {
            this.db.close();
        }
    }
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Database not initialized. Wait for initialization to complete.');
        }
    }
    logSearch(query, resultCount, timeMs, userId) {
        try {
            this.db.prepare(`
        INSERT INTO search_history (query, results_count, search_time_ms, user_id)
        VALUES (?, ?, ?, ?)
      `).run(query, resultCount, timeMs, userId || 'anonymous');
        }
        catch (error) {
            console.warn('Failed to log search:', error);
        }
    }
    normalizeQuery(query) {
        return query
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s:@.-]/g, '');
    }
    generateSearchCacheKey(normalizedQuery, options) {
        const keyParts = [
            'search',
            normalizedQuery,
            options.category || 'all',
            options.sortBy || 'relevance',
            options.limit || 10,
            options.offset || 0
        ];
        return keyParts.join(':');
    }
    async selectSearchStrategy(query, options) {
        if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
            return 'exact';
        }
        if (query.startsWith('category:') || options.category) {
            return 'category';
        }
        if (query.startsWith('tag:') || (options.tags && options.tags.length > 0)) {
            return 'tag';
        }
        const complexity = this.calculateQueryComplexity(query);
        if (complexity.isComplex) {
            return 'hybrid';
        }
        else if (complexity.hasFuzzyTerms) {
            return 'fuzzy';
        }
        else {
            return 'fts';
        }
    }
    async executeHybridSearch(strategy, query, options) {
        const startTime = Date.now();
        let results = [];
        switch (strategy) {
            case 'exact':
                results = await this.executeExactSearch(query, options);
                break;
            case 'fts':
                results = await this.executeFTSSearch(query, options);
                break;
            case 'fuzzy':
                results = await this.executeFuzzySearch(query, options);
                break;
            case 'category':
                results = await this.executeCategorySearch(query, options);
                break;
            case 'tag':
                results = await this.executeTagSearch(query, options);
                break;
            case 'hybrid':
                results = await this.executeMultiStrategySearch(query, options);
                break;
            default:
                results = await this.executeFTSSearch(query, options);
        }
        const executionTime = Date.now() - startTime;
        if (executionTime > 500) {
            console.warn(`Slow ${strategy} search (${executionTime}ms): "${query}"`);
        }
        return { results, strategy };
    }
    async executeExactSearch(query, options) {
        return this.db.prepare(`
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        100 as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE (e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY e.usage_count DESC, success_rate DESC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, ...(options.category ? [options.category] : []), options.limit || 10);
    }
    async executeFTSSearch(query, options) {
        const ftsQuery = this.prepareFTSQuery(query);
        return this.db.prepare(`
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        bm25(kb_fts, 3.0, 2.0, 1.5, 1.0) as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ?
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY 
        CASE ?
          WHEN 'relevance' THEN relevance_score
          WHEN 'usage' THEN e.usage_count
          WHEN 'success_rate' THEN success_rate
          ELSE relevance_score
        END DESC
      LIMIT ?
    `).all(ftsQuery, ...(options.category ? [options.category] : []), options.sortBy || 'relevance', options.limit || 10);
    }
    async executeFuzzySearch(query, options) {
        const fuzzyTerms = query.split(/\s+/).filter(term => term.length > 2);
        const likeConditions = fuzzyTerms.map(() => '(e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)').join(' AND ');
        const params = fuzzyTerms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]);
        return this.db.prepare(`
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        (${fuzzyTerms.map(() => 'CASE WHEN e.title LIKE ? THEN 3 ELSE 0 END').join(' + ')}) +
        (${fuzzyTerms.map(() => 'CASE WHEN e.problem LIKE ? THEN 2 ELSE 0 END').join(' + ')}) +
        (${fuzzyTerms.map(() => 'CASE WHEN e.solution LIKE ? THEN 1 ELSE 0 END').join(' + ')}) as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE ${likeConditions}
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      HAVING relevance_score > 0
      ORDER BY relevance_score DESC, e.usage_count DESC
      LIMIT ?
    `).all(...params, ...fuzzyTerms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]), ...(options.category ? [options.category] : []), options.limit || 10);
    }
    async executeCategorySearch(query, options) {
        const category = options.category || query.replace('category:', '');
        return this.db.prepare(`
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        CASE 
          WHEN e.title LIKE ? THEN 90
          WHEN e.problem LIKE ? THEN 80
          WHEN e.solution LIKE ? THEN 70
          ELSE 60
        END as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.category = ?
        AND e.archived = FALSE
        ${query && !query.startsWith('category:') ? 'AND (e.title LIKE ? OR e.problem LIKE ?)' : ''}
      GROUP BY e.id
      ORDER BY relevance_score DESC, e.usage_count DESC
      LIMIT ?
    `).all(...(query && !query.startsWith('category:') ? [`%${query}%`, `%${query}%`, `%${query}%`] : ['', '', '']), category, ...(query && !query.startsWith('category:') ? [`%${query}%`, `%${query}%`] : []), options.limit || 10);
    }
    async executeTagSearch(query, options) {
        const tags = options.tags || [query.replace('tag:', '')];
        const tagPlaceholders = tags.map(() => '?').join(',');
        return this.db.prepare(`
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        COUNT(DISTINCT CASE WHEN t.tag IN (${tagPlaceholders}) THEN t.tag END) as tag_matches,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
      FROM kb_entries e
      JOIN kb_tags t ON e.id = t.entry_id
      WHERE t.tag IN (${tagPlaceholders})
        AND e.archived = FALSE
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY tag_matches DESC, e.usage_count DESC
      LIMIT ?
    `).all(...tags, ...tags, ...(options.category ? [options.category] : []), options.limit || 10);
    }
    async executeMultiStrategySearch(query, options) {
        const strategies = ['fts', 'fuzzy', 'exact'];
        const allResults = new Map();
        const searchPromises = strategies.map(async (strategy) => {
            try {
                let results = [];
                const strategyOptions = { ...options, limit: 5 };
                switch (strategy) {
                    case 'fts':
                        results = await this.executeFTSSearch(query, strategyOptions);
                        break;
                    case 'fuzzy':
                        results = await this.executeFuzzySearch(query, strategyOptions);
                        break;
                    case 'exact':
                        results = await this.executeExactSearch(query, strategyOptions);
                        break;
                }
                return results.map(r => ({ ...r, strategy }));
            }
            catch (error) {
                console.warn(`Strategy ${strategy} failed:`, error);
                return [];
            }
        });
        const strategyResults = await Promise.all(searchPromises);
        strategyResults.forEach(results => {
            results.forEach(result => {
                const existing = allResults.get(result.id);
                if (existing) {
                    existing.relevance_score = Math.max(existing.relevance_score, result.relevance_score);
                    existing.strategy_count = (existing.strategy_count || 1) + 1;
                }
                else {
                    allResults.set(result.id, { ...result, strategy_count: 1 });
                }
            });
        });
        return Array.from(allResults.values())
            .sort((a, b) => {
            const scoreA = a.relevance_score * Math.log(a.strategy_count + 1);
            const scoreB = b.relevance_score * Math.log(b.strategy_count + 1);
            return scoreB - scoreA;
        })
            .slice(0, options.limit || 10);
    }
    calculateRelevanceScore(row, query, strategy) {
        let baseScore = row.relevance_score || 0;
        const usageBoost = Math.log(row.usage_count + 1) * 10;
        const successRate = row.success_rate || 0;
        const successBoost = successRate * 20;
        const strategyMultiplier = {
            'exact': 1.5,
            'fts': 1.0,
            'fuzzy': 0.8,
            'category': 1.2,
            'tag': 1.1,
            'hybrid': 1.3
        }[strategy] || 1.0;
        const finalScore = (baseScore + usageBoost + successBoost) * strategyMultiplier;
        return Math.min(100, Math.max(0, finalScore));
    }
    generateAdvancedHighlights(query, row) {
        const highlights = [];
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const fields = [
            { name: 'title', content: row.title, weight: 3 },
            { name: 'problem', content: row.problem, weight: 2 },
            { name: 'solution', content: row.solution, weight: 1 }
        ];
        fields.forEach(field => {
            const lowerContent = field.content.toLowerCase();
            queryTerms.forEach(term => {
                const index = lowerContent.indexOf(term);
                if (index !== -1) {
                    const start = Math.max(0, index - 30);
                    const end = Math.min(field.content.length, index + term.length + 30);
                    const snippet = field.content.substring(start, end);
                    highlights.push({
                        field: field.name,
                        snippet: start > 0 ? '...' + snippet : snippet,
                        term: term
                    });
                }
            });
        });
        return highlights.slice(0, 3);
    }
    calculateQueryComplexity(query) {
        const terms = query.split(/\s+/);
        const hasOperators = /[:@]/.test(query);
        const hasFuzzyTerms = terms.some(term => term.length < 3 || /[*?]/.test(term));
        return {
            isComplex: terms.length > 3 || hasOperators,
            hasFuzzyTerms,
            termCount: terms.length,
            hasOperators
        };
    }
    calculateCacheTTL(options) {
        if (options.category || (options.tags && options.tags.length > 0)) {
            return 600000;
        }
        return 300000;
    }
    generateCacheTags(options) {
        const tags = ['search'];
        if (options.category)
            tags.push(`category:${options.category}`);
        if (options.sortBy)
            tags.push(`sort:${options.sortBy}`);
        if (options.tags)
            tags.push(...options.tags.map(tag => `tag:${tag}`));
        return tags;
    }
    getCachePriority(query) {
        if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
            return 'high';
        }
        const commonCategories = ['JCL', 'VSAM', 'DB2', 'CICS', 'Batch'];
        if (commonCategories.some(cat => query.toLowerCase().includes(cat.toLowerCase()))) {
            return 'high';
        }
        return 'normal';
    }
    async calculateFacets(query, options) {
        const baseWhere = query ?
            'WHERE (e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?) AND e.archived = FALSE' :
            'WHERE e.archived = FALSE';
        const params = query ? [`%${query}%`, `%${query}%`, `%${query}%`] : [];
        const [categories, tags, severities] = await Promise.all([
            this.db.prepare(`
        SELECT e.category as name, COUNT(*) as count
        FROM kb_entries e
        ${baseWhere}
        GROUP BY e.category
        ORDER BY count DESC
        LIMIT 10
      `).all(...params),
            this.db.prepare(`
        SELECT t.tag as name, COUNT(*) as count
        FROM kb_entries e
        JOIN kb_tags t ON e.id = t.entry_id
        ${baseWhere}
        GROUP BY t.tag
        ORDER BY count DESC
        LIMIT 15
      `).all(...params),
            this.db.prepare(`
        SELECT COALESCE(e.severity, 'medium') as name, COUNT(*) as count
        FROM kb_entries e
        ${baseWhere}
        GROUP BY COALESCE(e.severity, 'medium')
        ORDER BY count DESC
      `).all(...params)
        ]);
        return { categories, tags, severities };
    }
    prepareFTSQuery(query) {
        if (query.startsWith('category:')) {
            return `category:${query.substring(9)}`;
        }
        if (query.startsWith('tag:')) {
            return `tags:${query.substring(4)}`;
        }
        let ftsQuery = query.trim().replace(/['"]/g, '');
        const terms = ftsQuery.split(/\s+/).filter(term => term.length > 1);
        if (terms.length === 0)
            return ftsQuery;
        if (terms.length > 1) {
            return `"${terms.join(' ')}"`;
        }
        return `${terms[0]}*`;
    }
    extractHighlights(query, title, problem) {
        return this.generateAdvancedHighlights(query, { title, problem });
    }
    getDiskUsage() {
        try {
            if (this.db.name === ':memory:')
                return 0;
            return fs_1.default.statSync(this.db.name).size;
        }
        catch (error) {
            return 0;
        }
    }
    logInitializationStats() {
        const stats = {
            entries: this.getEntryCount(),
            dbSize: this.formatBytes(this.getDiskUsage()),
            version: this.migrationManager.getCurrentVersion()
        };
        console.log(`📊 Database ready: ${stats.entries} entries, ${stats.dbSize}, schema v${stats.version}`);
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
exports.KnowledgeDB = KnowledgeDB;
async function createKnowledgeDB(dbPath, options) {
    const db = new KnowledgeDB(dbPath, options);
    await new Promise(resolve => {
        const checkInit = () => {
            if (db['initialized']) {
                resolve(undefined);
            }
            else {
                setTimeout(checkInit, 100);
            }
        };
        checkInit();
    });
    return db;
}
//# sourceMappingURL=KnowledgeDB.js.map