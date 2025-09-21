"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceTuner = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
class PerformanceTuner {
    db;
    config;
    constructor(db) {
        this.db = db;
        this.config = this.getOptimalConfig();
        this.applyConfiguration();
    }
    getOptimalConfig() {
        const totalRAM = this.estimateAvailableRAM();
        const isLocal = this.isLocalDatabase();
        return {
            cacheSize: Math.min(512 * 1024, Math.max(64 * 1024, Math.floor(totalRAM * 0.25))),
            mmapSize: isLocal ? 256 * 1024 * 1024 : 0,
            journalMode: 'WAL',
            synchronous: 'NORMAL',
            tempStore: 'MEMORY',
            lockingMode: 'NORMAL',
            autoVacuum: 'INCREMENTAL'
        };
    }
    applyConfiguration() {
        console.log('🔧 Applying SQLite performance configuration...');
        try {
            this.db.pragma(`cache_size = -${this.config.cacheSize}`);
            this.db.pragma(`mmap_size = ${this.config.mmapSize}`);
            this.db.pragma(`journal_mode = ${this.config.journalMode}`);
            this.db.pragma(`synchronous = ${this.config.synchronous}`);
            this.db.pragma(`temp_store = ${this.config.tempStore}`);
            this.db.pragma(`locking_mode = ${this.config.lockingMode}`);
            this.db.pragma(`auto_vacuum = ${this.config.autoVacuum}`);
            this.db.pragma('optimize');
            this.db.pragma('foreign_keys = ON');
            this.db.pragma('recursive_triggers = ON');
            this.db.pragma('trusted_schema = OFF');
            this.db.pragma('query_only = OFF');
            this.db.pragma('defer_foreign_keys = OFF');
            console.log('✅ Performance configuration applied successfully');
            this.logConfiguration();
        }
        catch (error) {
            console.error('❌ Failed to apply performance configuration:', error);
        }
    }
    logConfiguration() {
        const currentConfig = {
            cache_size: this.db.pragma('cache_size', { simple: true }),
            journal_mode: this.db.pragma('journal_mode', { simple: true }),
            synchronous: this.db.pragma('synchronous', { simple: true }),
            temp_store: this.db.pragma('temp_store', { simple: true }),
            mmap_size: this.db.pragma('mmap_size', { simple: true }),
            auto_vacuum: this.db.pragma('auto_vacuum', { simple: true })
        };
        console.log('📊 Current SQLite configuration:', currentConfig);
    }
    optimize() {
        const startTime = Date.now();
        const operations = [];
        console.log('🚀 Starting comprehensive database optimization...');
        const sizeBefore = this.getDatabaseSize();
        console.log('📊 Updating table statistics...');
        this.db.exec('ANALYZE');
        operations.push('ANALYZE tables');
        console.log('🔍 Optimizing query planner...');
        this.db.pragma('optimize');
        operations.push('Query planner optimization');
        console.log('🔍 Checking FTS index...');
        try {
            const ftsInfo = this.db.prepare("SELECT count(*) as count FROM kb_fts").get();
            const entriesCount = this.db.prepare("SELECT count(*) as count FROM kb_entries").get();
            if (Math.abs(ftsInfo.count - entriesCount.count) > 0) {
                console.log('🔧 Rebuilding FTS index...');
                this.db.exec("INSERT INTO kb_fts(kb_fts) VALUES('rebuild')");
                operations.push('FTS index rebuild');
            }
        }
        catch (error) {
            console.log('ℹ️ FTS index check skipped');
        }
        console.log('🧹 Running incremental vacuum...');
        try {
            this.db.pragma('incremental_vacuum');
            operations.push('Incremental vacuum');
        }
        catch (error) {
            console.log('ℹ️ Incremental vacuum not needed');
        }
        if (this.config.journalMode === 'WAL') {
            console.log('📝 WAL checkpoint...');
            const result = this.db.pragma('wal_checkpoint(TRUNCATE)');
            operations.push(`WAL checkpoint: ${JSON.stringify(result)}`);
        }
        console.log('🔍 Quick integrity check...');
        const integrityResult = this.db.pragma('quick_check', { simple: true });
        if (integrityResult === 'ok') {
            operations.push('Integrity check: OK');
        }
        else {
            console.warn('⚠️ Integrity check found issues:', integrityResult);
            operations.push(`Integrity check: ${integrityResult}`);
        }
        const sizeAfter = this.getDatabaseSize();
        const duration = Date.now() - startTime;
        console.log(`✅ Optimization completed in ${duration}ms`);
        console.log(`📊 Size: ${this.formatBytes(sizeBefore)} → ${this.formatBytes(sizeAfter)}`);
        return {
            sizeBefore,
            sizeAfter,
            duration,
            operations
        };
    }
    getPerformanceMetrics() {
        const cacheHit = this.db.pragma('cache_hit_ratio', { simple: true }) || 0;
        const pageCount = this.db.pragma('page_count', { simple: true });
        const pageSize = this.db.pragma('page_size', { simple: true });
        const freePages = this.db.pragma('freelist_count', { simple: true });
        let walSize;
        if (this.config.journalMode === 'WAL') {
            try {
                const walFile = `${this.db.name  }-wal`;
                if (fs_1.default.existsSync(walFile)) {
                    walSize = fs_1.default.statSync(walFile).size;
                }
            }
            catch (error) {
            }
        }
        const indexes = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `).all();
        const indexUsage = indexes.map(idx => ({
            name: idx.name,
            used: this.checkIndexUsage(idx.name)
        }));
        return {
            cacheHitRatio: cacheHit,
            pageCount,
            pageSize,
            databaseSize: pageCount * pageSize,
            walSize,
            freePages,
            indexUsage
        };
    }
    scheduleMaintenace() {
        setInterval(() => {
            console.log('🔄 Running scheduled database optimization...');
            this.optimize();
        }, 24 * 60 * 60 * 1000);
        if (this.config.journalMode === 'WAL') {
            setInterval(() => {
                try {
                    this.db.pragma('wal_checkpoint(PASSIVE)');
                }
                catch (error) {
                    console.error('WAL checkpoint error:', error);
                }
            }, 60 * 60 * 1000);
        }
        setInterval(() => {
            try {
                this.db.pragma('incremental_vacuum(100)');
            }
            catch (error) {
            }
        }, 6 * 60 * 60 * 1000);
        console.log('⏰ Automatic maintenance scheduled');
    }
    async benchmark() {
        console.log('🏃 Running performance benchmark...');
        const testData = {
            id: 'benchmark-test',
            title: 'Benchmark Test Entry',
            problem: 'This is a test problem for benchmarking database performance',
            solution: 'This is a test solution with various keywords for search testing',
            category: 'Other',
            tags: ['benchmark', 'test', 'performance']
        };
        const insertStart = Date.now();
        const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO kb_entries (id, title, problem, solution, category)
      VALUES (?, ?, ?, ?, ?)
    `);
        insertStmt.run(testData.id, testData.title, testData.problem, testData.solution, testData.category);
        const insertTime = Date.now() - insertStart;
        const searchStart = Date.now();
        const searchStmt = this.db.prepare('SELECT * FROM kb_entries WHERE id = ?');
        searchStmt.get(testData.id);
        const searchTime = Date.now() - searchStart;
        const updateStart = Date.now();
        const updateStmt = this.db.prepare('UPDATE kb_entries SET usage_count = usage_count + 1 WHERE id = ?');
        updateStmt.run(testData.id);
        const updateTime = Date.now() - updateStart;
        const ftsStart = Date.now();
        try {
            const ftsStmt = this.db.prepare('SELECT * FROM kb_fts WHERE kb_fts MATCH ? LIMIT 1');
            ftsStmt.get('benchmark');
        }
        catch (error) {
        }
        const ftsSearchTime = Date.now() - ftsStart;
        const deleteStart = Date.now();
        const deleteStmt = this.db.prepare('DELETE FROM kb_entries WHERE id = ?');
        deleteStmt.run(testData.id);
        const deleteTime = Date.now() - deleteStart;
        const results = {
            insertTime,
            searchTime,
            updateTime,
            deleteTime,
            ftsSearchTime
        };
        console.log('📊 Benchmark results (ms):', results);
        return results;
    }
    estimateAvailableRAM() {
        return 8 * 1024;
    }
    isLocalDatabase() {
        return this.db.name !== ':memory:' && !this.db.name.includes('://');
    }
    getDatabaseSize() {
        try {
            if (this.db.name === ':memory:')
                return 0;
            return fs_1.default.statSync(this.db.name).size;
        }
        catch (error) {
            return 0;
        }
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
    }
    checkIndexUsage(indexName) {
        try {
            const result = this.db.prepare(`
        EXPLAIN QUERY PLAN 
        SELECT * FROM kb_entries WHERE rowid = 1
      `).all();
            return result.some((row) => row.detail && row.detail.includes(indexName));
        }
        catch (error) {
            return false;
        }
    }
    getRecommendations() {
        const recommendations = [];
        const metrics = this.getPerformanceMetrics();
        if (metrics.cacheHitRatio < 0.9) {
            recommendations.push(`Low cache hit ratio (${metrics.cacheHitRatio.toFixed(2)}). Consider increasing cache_size.`);
        }
        if (metrics.freePages > metrics.pageCount * 0.1) {
            recommendations.push(`High free page count (${metrics.freePages}). Consider running VACUUM.`);
        }
        if (metrics.walSize && metrics.walSize > metrics.databaseSize * 0.1) {
            recommendations.push(`Large WAL file (${this.formatBytes(metrics.walSize)}). Consider checkpoint.`);
        }
        const unusedIndexes = metrics.indexUsage.filter(idx => !idx.used);
        if (unusedIndexes.length > 0) {
            recommendations.push(`Found ${unusedIndexes.length} potentially unused indexes.`);
        }
        return recommendations;
    }
}
exports.PerformanceTuner = PerformanceTuner;
//# sourceMappingURL=PerformanceTuner.js.map