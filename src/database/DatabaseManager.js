"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const events_1 = require("events");
const ConnectionPool_1 = require("./ConnectionPool");
const MigrationManager_1 = require("./MigrationManager");
const BackupManager_1 = require("./BackupManager");
const PerformanceMonitor_1 = require("./PerformanceMonitor");
const QueryCache_1 = require("./QueryCache");
class DatabaseManager extends events_1.EventEmitter {
    config;
    db;
    connectionPool;
    migrationManager;
    backupManager;
    performanceMonitor;
    queryCache;
    isInitialized = false;
    shutdownInProgress = false;
    healthCheckInterval;
    constructor(config) {
        super();
        this.config = {
            path: config.path,
            enableWAL: config.enableWAL ?? true,
            enableForeignKeys: config.enableForeignKeys ?? true,
            timeout: config.timeout ?? 30000,
            maxConnections: config.maxConnections ?? 10,
            cacheSize: config.cacheSize ?? 64,
            enableMonitoring: config.enableMonitoring ?? true,
            backup: {
                enabled: config.backup?.enabled ?? true,
                intervalHours: config.backup?.intervalHours ?? 6,
                retentionDays: config.backup?.retentionDays ?? 30,
                path: config.backup?.path ?? path_1.default.join(path_1.default.dirname(config.path), 'backups')
            },
            queryCache: {
                enabled: config.queryCache?.enabled ?? true,
                maxSize: config.queryCache?.maxSize ?? 1000,
                ttlMs: config.queryCache?.ttlMs ?? 300000
            }
        };
        this.setupErrorHandling();
    }
    async initialize() {
        if (this.isInitialized) {
            throw new Error('DatabaseManager is already initialized');
        }
        try {
            const dbDir = path_1.default.dirname(this.config.path);
            if (!fs_1.default.existsSync(dbDir)) {
                fs_1.default.mkdirSync(dbDir, { recursive: true });
            }
            this.db = new better_sqlite3_1.default(this.config.path);
            this.configureDatabase();
            this.connectionPool = new ConnectionPool_1.ConnectionPool(this.config.path, {
                maxConnections: this.config.maxConnections,
                timeout: this.config.timeout,
                enableWAL: this.config.enableWAL
            });
            this.migrationManager = new MigrationManager_1.MigrationManager(this.db, path_1.default.join(path_1.default.dirname(this.config.path), 'migrations'));
            this.backupManager = new BackupManager_1.BackupManager(this.config.path, {
                backupPath: this.config.backup.path,
                retentionDays: this.config.backup.retentionDays,
                intervalHours: this.config.backup.intervalHours
            });
            if (this.config.enableMonitoring) {
                this.performanceMonitor = new PerformanceMonitor_1.PerformanceMonitor(this.db);
            }
            if (this.config.queryCache.enabled) {
                this.queryCache = new QueryCache_1.QueryCache({
                    maxSize: this.config.queryCache.maxSize,
                    ttl: this.config.queryCache.ttlMs
                });
            }
            await this.runMigrations();
            await this.startBackgroundTasks();
            this.startHealthMonitoring();
            this.isInitialized = true;
            this.emit('initialized');
            console.log('✅ DatabaseManager initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize DatabaseManager:', error);
            await this.cleanup();
            throw error;
        }
    }
    async query(sql, params = [], options = {}) {
        this.ensureInitialized();
        const startTime = Date.now();
        const cacheKey = options.cacheKey || this.generateCacheKey(sql, params);
        const useCache = options.useCache ?? true;
        const maxRetries = options.maxRetries ?? 3;
        if (useCache && this.queryCache) {
            const cached = this.queryCache.get(cacheKey);
            if (cached) {
                return {
                    data: cached,
                    executionTime: Date.now() - startTime,
                    fromCache: true
                };
            }
        }
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const connection = await this.connectionPool.acquire();
                try {
                    const stmt = connection.prepare(sql);
                    const result = stmt.all(params);
                    if (useCache && this.queryCache && sql.trim().toUpperCase().startsWith('SELECT')) {
                        this.queryCache.set(cacheKey, result);
                    }
                    if (this.performanceMonitor) {
                        this.performanceMonitor.recordQuery(sql, Date.now() - startTime, params.length);
                    }
                    const executionTime = Date.now() - startTime;
                    return {
                        data: result,
                        executionTime,
                        fromCache: false,
                        affectedRows: stmt.reader ? undefined : result?.changes
                    };
                }
                finally {
                    this.connectionPool.release(connection);
                }
            }
            catch (error) {
                lastError = error;
                if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
                    const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                console.error(`Query failed (attempt ${attempt}/${maxRetries}):`, error);
                this.emit('query-error', { sql, params, error, attempt });
                if (attempt === maxRetries)
                    break;
            }
        }
        const error = new Error(`Query failed after ${maxRetries} attempts: ${lastError.message}`);
        error.cause = lastError;
        throw error;
    }
    async transaction(callback, options = {}) {
        this.ensureInitialized();
        const { isolation = 'deferred', maxRetries = 3, retryDelayMs = 100, timeoutMs = 30000 } = options;
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const connection = await this.connectionPool.acquire();
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Transaction timeout')), timeoutMs);
                });
                const transactionPromise = this.executeTransaction(connection, callback, isolation);
                const result = await Promise.race([transactionPromise, timeoutPromise]);
                this.emit('transaction-success', { attempt, isolation });
                return result;
            }
            catch (error) {
                lastError = error;
                if ((error.code === 'SQLITE_BUSY' || error.message === 'Transaction timeout')
                    && attempt < maxRetries) {
                    const delay = retryDelayMs * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    this.emit('transaction-retry', { attempt, error: error.message });
                    continue;
                }
                this.emit('transaction-error', { attempt, error });
                break;
            }
            finally {
                this.connectionPool.release(connection);
            }
        }
        throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError.message}`);
    }
    async getHealth() {
        if (!this.isInitialized) {
            return {
                connected: false,
                version: 'unknown',
                size: 0,
                connections: { active: 0, idle: 0, total: 0 },
                performance: { avgQueryTime: 0, cacheHitRate: 0, queueLength: 0 },
                issues: ['Database not initialized']
            };
        }
        const issues = [];
        try {
            const versionResult = this.db.prepare('SELECT sqlite_version() as version').get();
            const stats = fs_1.default.statSync(this.config.path);
            const poolStats = this.connectionPool.getStats();
            const perfStats = this.performanceMonitor ?
                await this.performanceMonitor.getMetrics() :
                { avgQueryTime: 0, cacheHitRate: 0, queueLength: 0 };
            if (poolStats.active > poolStats.total * 0.9) {
                issues.push('High connection pool utilization');
            }
            if (perfStats.avgQueryTime > 1000) {
                issues.push('Slow query performance');
            }
            if (stats.size > 100 * 1024 * 1024) {
                issues.push('Large database size');
            }
            let lastBackup;
            if (this.backupManager) {
                const backups = await this.backupManager.listBackups();
                if (backups.length > 0) {
                    lastBackup = backups[0].created;
                    const hoursSinceBackup = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceBackup > this.config.backup.intervalHours * 2) {
                        issues.push('Backup is overdue');
                    }
                }
                else {
                    issues.push('No backups found');
                }
            }
            return {
                connected: true,
                version: versionResult.version,
                size: stats.size,
                connections: {
                    active: poolStats.active,
                    idle: poolStats.idle,
                    total: poolStats.total
                },
                performance: {
                    avgQueryTime: perfStats.avgQueryTime,
                    cacheHitRate: perfStats.cacheHitRate,
                    queueLength: perfStats.queueLength
                },
                lastBackup,
                issues
            };
        }
        catch (error) {
            return {
                connected: false,
                version: 'unknown',
                size: 0,
                connections: { active: 0, idle: 0, total: 0 },
                performance: { avgQueryTime: 0, cacheHitRate: 0, queueLength: 0 },
                issues: [`Health check failed: ${error.message}`]
            };
        }
    }
    async backup(description) {
        this.ensureInitialized();
        return await this.backupManager.createBackup(description);
    }
    async restore(backupPath) {
        this.ensureInitialized();
        await this.connectionPool.drain();
        this.db.close();
        try {
            await this.backupManager.restore(backupPath);
            this.db = new better_sqlite3_1.default(this.config.path);
            this.configureDatabase();
        }
        catch (error) {
            throw new Error(`Restore failed: ${error.message}`);
        }
    }
    async optimize() {
        this.ensureInitialized();
        const startTime = Date.now();
        try {
            await this.query('VACUUM');
            await this.query('ANALYZE');
            const duration = Date.now() - startTime;
            console.log(`✅ Database optimized in ${duration}ms`);
            this.emit('optimized', { duration });
        }
        catch (error) {
            console.error('❌ Database optimization failed:', error);
            throw error;
        }
    }
    async shutdown() {
        if (this.shutdownInProgress) {
            return;
        }
        this.shutdownInProgress = true;
        try {
            console.log('🔄 Shutting down DatabaseManager...');
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            if (this.backupManager) {
                await this.backupManager.stop();
            }
            if (this.connectionPool) {
                await this.connectionPool.drain();
            }
            if (this.db) {
                this.db.close();
            }
            if (this.queryCache) {
                this.queryCache.clear();
            }
            this.isInitialized = false;
            this.emit('shutdown');
            console.log('✅ DatabaseManager shut down successfully');
        }
        catch (error) {
            console.error('❌ Error during shutdown:', error);
            throw error;
        }
    }
    configureDatabase() {
        if (this.config.enableWAL) {
            this.db.pragma('journal_mode = WAL');
        }
        if (this.config.enableForeignKeys) {
            this.db.pragma('foreign_keys = ON');
        }
        this.db.pragma(`cache_size = -${this.config.cacheSize * 1024}`);
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 268435456');
        this.db.pragma(`busy_timeout = ${this.config.timeout}`);
    }
    async runMigrations() {
        try {
            const results = await this.migrationManager.migrate();
            for (const result of results) {
                if (result.success) {
                    console.log(`✅ Migration ${result.version} applied in ${result.duration}ms`);
                }
                else {
                    console.error(`❌ Migration ${result.version} failed: ${result.error}`);
                    throw new Error(`Migration failed: ${result.error}`);
                }
            }
        }
        catch (error) {
            throw new Error(`Migration process failed: ${error.message}`);
        }
    }
    async startBackgroundTasks() {
        if (this.config.backup.enabled && this.backupManager) {
            await this.backupManager.start();
        }
    }
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await this.getHealth();
                if (health.issues.length > 0) {
                    this.emit('health-warning', health);
                }
            }
            catch (error) {
                this.emit('health-error', error);
            }
        }, 30000);
    }
    async executeTransaction(connection, callback, isolation) {
        const transaction = connection.transaction((db) => {
            return callback(db);
        });
        if (isolation !== 'deferred') {
            connection.prepare(`BEGIN ${isolation.toUpperCase()}`).run();
        }
        return transaction(connection);
    }
    generateCacheKey(sql, params) {
        const key = sql + JSON.stringify(params);
        return Buffer.from(key).toString('base64');
    }
    setupErrorHandling() {
        this.on('error', (error) => {
            console.error('DatabaseManager error:', error);
        });
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }
    async cleanup() {
        try {
            if (this.db && this.db.open) {
                this.db.close();
            }
            if (this.connectionPool) {
                await this.connectionPool.drain();
            }
        }
        catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('DatabaseManager is not initialized. Call initialize() first.');
        }
    }
    get migrationManager() {
        return this.migrationManager;
    }
    get backupManager() {
        return this.backupManager;
    }
    get performanceMonitor() {
        return this.performanceMonitor;
    }
    get connectionPool() {
        return this.connectionPool;
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=DatabaseManager.js.map