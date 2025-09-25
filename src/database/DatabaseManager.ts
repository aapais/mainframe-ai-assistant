import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { ConnectionPool } from './ConnectionPool';
import { MigrationManager } from './MigrationManager';
import { BackupManager } from './BackupManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { QueryCache } from './QueryCache';

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** Database file path */
  path: string;
  /** Enable WAL mode for better concurrency */
  enableWAL?: boolean;
  /** Enable foreign key constraints */
  enableForeignKeys?: boolean;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Maximum number of connections in pool */
  maxConnections?: number;
  /** Cache size in MB */
  cacheSize?: number;
  /** Enable performance monitoring */
  enableMonitoring?: boolean;
  /** Backup configuration */
  backup?: {
    enabled: boolean;
    intervalHours?: number;
    retentionDays?: number;
    path?: string;
  };
  /** Query cache configuration */
  queryCache?: {
    enabled: boolean;
    maxSize?: number;
    ttlMs?: number;
  };
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Transaction isolation level */
  isolation?: 'deferred' | 'immediate' | 'exclusive';
  /** Maximum retry attempts for busy database */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
  /** Transaction timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Query execution result
 */
export interface QueryResult<T = any> {
  data: T;
  executionTime: number;
  fromCache: boolean;
  affectedRows?: number;
}

/**
 * Database health status
 */
export interface DatabaseHealth {
  connected: boolean;
  version: string;
  size: number;
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  performance: {
    avgQueryTime: number;
    cacheHitRate: number;
    queueLength: number;
  };
  lastBackup?: Date;
  issues: string[];
}

/**
 * Comprehensive Database Manager
 *
 * Provides high-level database operations with connection pooling,
 * transaction management, monitoring, and automatic recovery.
 *
 * @example
 * ```typescript
 * const dbManager = new DatabaseManager({
 *   path: './knowledge.db',
 *   enableWAL: true,
 *   maxConnections: 10,
 *   backup: { enabled: true, intervalHours: 6 }
 * });
 *
 * await dbManager.initialize();
 *
 * // Execute query with automatic retry and caching
 * const result = await dbManager.query('SELECT * FROM kb_entries WHERE category = ?', ['VSAM']);
 *
 * // Execute in transaction with retry logic
 * await dbManager.transaction(async (db) => {
 *   await db.prepare('INSERT INTO kb_entries (...) VALUES (...)').run(data);
 *   await db.prepare('UPDATE usage_metrics ...').run(metrics);
 * });
 * ```
 */
export class DatabaseManager extends EventEmitter {
  private config: Required<DatabaseConfig>;
  private db: Database.Database;
  private connectionPool: ConnectionPool;
  private migrationManager: MigrationManager;
  private backupManager: BackupManager;
  private performanceMonitor: PerformanceMonitor;
  private queryCache: QueryCache;
  private isInitialized = false;
  private shutdownInProgress = false;
  private healthCheckInterval?: ReturnType<typeof setTimeout>;

  constructor(config: DatabaseConfig) {
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
        path: config.backup?.path ?? path.join(path.dirname(config.path), 'backups'),
      },
      queryCache: {
        enabled: config.queryCache?.enabled ?? true,
        maxSize: config.queryCache?.maxSize ?? 1000,
        ttlMs: config.queryCache?.ttlMs ?? 300000, // 5 minutes
      },
    };

    this.setupErrorHandling();
  }

  /**
   * Initialize the database manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('DatabaseManager is already initialized');
    }

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize main database connection
      this.db = new Database(this.config.path);
      this.configureDatabase();

      // Initialize components
      this.connectionPool = new ConnectionPool(this.config.path, {
        maxConnections: this.config.maxConnections,
        timeout: this.config.timeout,
        enableWAL: this.config.enableWAL,
      });

      this.migrationManager = new MigrationManager(
        this.db,
        path.join(path.dirname(this.config.path), 'migrations')
      );

      this.backupManager = new BackupManager(this.config.path, {
        backupPath: this.config.backup.path,
        retentionDays: this.config.backup.retentionDays,
        intervalHours: this.config.backup.intervalHours,
      });

      if (this.config.enableMonitoring) {
        this.performanceMonitor = new PerformanceMonitor(this.db);
      }

      if (this.config.queryCache.enabled) {
        this.queryCache = new QueryCache(this.db, {
          maxSize: this.config.queryCache.maxSize,
          defaultTTL: this.config.queryCache.ttlMs,
          maxMemoryMB: 50,
          persistToDisk: true,
          compressionEnabled: true,
        });
      }

      // Run migrations
      await this.runMigrations();

      // Start background tasks
      await this.startBackgroundTasks();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('✅ DatabaseManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize DatabaseManager:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Execute a query with automatic retry and caching
   */
  async query<T = any>(
    sql: string,
    params: any[] = [],
    options: {
      useCache?: boolean;
      cacheKey?: string;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): Promise<QueryResult<T>> {
    this.ensureInitialized();

    const startTime = Date.now();
    const cacheKey = options.cacheKey || this.generateCacheKey(sql, params);
    const useCache = options.useCache ?? true;
    const maxRetries = options.maxRetries ?? 3;

    // Check cache first
    if (useCache && this.queryCache) {
      try {
        const cached = await this.queryCache.get<T>(cacheKey, async () => {
          // This will be called only if cache miss occurs
          throw new Error('Cache miss - should execute query');
        });
        if (cached) {
          return {
            data: cached,
            executionTime: Date.now() - startTime,
            fromCache: true,
          };
        }
      } catch (error) {
        // Cache miss or error - proceed to execute query
      }
    }

    // Execute query with retry logic
    let lastError: Error;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const connection = await this.connectionPool.acquire();

        try {
          const stmt = connection.prepare(sql);
          const result = stmt.all(params) as T;

          // Cache result for SELECT queries
          if (useCache && this.queryCache && sql.trim().toUpperCase().startsWith('SELECT')) {
            await this.queryCache.set(cacheKey, result);
          }

          // Record performance metrics
          if (this.performanceMonitor) {
            this.performanceMonitor.recordQuery(sql, Date.now() - startTime, params.length);
          }

          const executionTime = Date.now() - startTime;

          return {
            data: result,
            executionTime,
            fromCache: false,
            affectedRows: stmt.reader ? undefined : (result as any)?.changes,
          };
        } finally {
          this.connectionPool.release(connection);
        }
      } catch (error) {
        lastError = error;

        if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
          // Wait before retry
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Log error
        console.error(`Query failed (attempt ${attempt}/${maxRetries}):`, error);
        this.emit('query-error', { sql, params, error, attempt });

        if (attempt === maxRetries) break;
      }
    }

    // All retries failed
    const error = new Error(`Query failed after ${maxRetries} attempts: ${lastError.message}`);
    error.cause = lastError;
    throw error;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (db: Database.Database) => Promise<T> | T,
    options: TransactionOptions = {}
  ): Promise<T> {
    this.ensureInitialized();

    const {
      isolation = 'deferred',
      maxRetries = 3,
      retryDelayMs = 100,
      timeoutMs = 30000,
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const connection = await this.connectionPool.acquire();

      try {
        // Setup timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Transaction timeout')), timeoutMs);
        });

        // Execute transaction
        const transactionPromise = this.executeTransaction(connection, callback, isolation);

        const result = await Promise.race([transactionPromise, timeoutPromise]);

        this.emit('transaction-success', { attempt, isolation });
        return result;
      } catch (error) {
        lastError = error;

        if (
          (error.code === 'SQLITE_BUSY' || error.message === 'Transaction timeout') &&
          attempt < maxRetries
        ) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));

          this.emit('transaction-retry', { attempt, error: error.message });
          continue;
        }

        this.emit('transaction-error', { attempt, error });
        break;
      } finally {
        this.connectionPool.release(connection);
      }
    }

    throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Get database health status
   */
  async getHealth(): Promise<DatabaseHealth> {
    if (!this.isInitialized) {
      return {
        connected: false,
        version: 'unknown',
        size: 0,
        connections: { active: 0, idle: 0, total: 0 },
        performance: { avgQueryTime: 0, cacheHitRate: 0, queueLength: 0 },
        issues: ['Database not initialized'],
      };
    }

    const issues: string[] = [];

    try {
      // Basic connectivity
      const versionResult = this.db.prepare('SELECT sqlite_version() as version').get() as {
        version: string;
      };

      // Database size
      const stats = fs.statSync(this.config.path);

      // Connection pool status
      const poolStats = this.connectionPool.getStats();

      // Performance metrics
      const perfStats = this.performanceMonitor
        ? await this.performanceMonitor.getMetrics()
        : { avgQueryTime: 0, cacheHitRate: 0, queueLength: 0 };

      // Check for issues
      if (poolStats.active > poolStats.total * 0.9) {
        issues.push('High connection pool utilization');
      }

      if (perfStats.avgQueryTime > 1000) {
        issues.push('Slow query performance');
      }

      if (stats.size > 100 * 1024 * 1024) {
        // 100MB
        issues.push('Large database size');
      }

      // Check last backup
      let lastBackup: Date | undefined;
      if (this.backupManager) {
        const backups = await this.backupManager.listBackups();
        if (backups.length > 0) {
          lastBackup = backups[0].created;

          const hoursSinceBackup = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);
          if (hoursSinceBackup > this.config.backup.intervalHours * 2) {
            issues.push('Backup is overdue');
          }
        } else {
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
          total: poolStats.total,
        },
        performance: {
          avgQueryTime: perfStats.avgQueryTime,
          cacheHitRate: perfStats.cacheHitRate,
          queueLength: perfStats.queueLength,
        },
        lastBackup,
        issues,
      };
    } catch (error) {
      return {
        connected: false,
        version: 'unknown',
        size: 0,
        connections: { active: 0, idle: 0, total: 0 },
        performance: { avgQueryTime: 0, cacheHitRate: 0, queueLength: 0 },
        issues: [`Health check failed: ${error.message}`],
      };
    }
  }

  /**
   * Create a manual backup
   */
  async backup(description?: string): Promise<string> {
    this.ensureInitialized();
    return await this.backupManager.createBackup(description);
  }

  /**
   * Restore from backup
   */
  async restore(backupPath: string): Promise<void> {
    this.ensureInitialized();

    // Close current connections
    await this.connectionPool.drain();
    this.db.close();

    try {
      await this.backupManager.restore(backupPath);

      // Reinitialize
      this.db = new Database(this.config.path);
      this.configureDatabase();
    } catch (error) {
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * Optimize database (VACUUM, ANALYZE)
   */
  async optimize(): Promise<void> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      // VACUUM to reclaim space and defragment
      await this.query('VACUUM');

      // ANALYZE to update query planner statistics
      await this.query('ANALYZE');

      const duration = Date.now() - startTime;

      console.log(`✅ Database optimized in ${duration}ms`);
      this.emit('optimized', { duration });
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;

    try {
      console.log('🔄 Shutting down DatabaseManager...');

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Stop background tasks
      if (this.backupManager) {
        await this.backupManager.stop();
      }

      // Drain connection pool
      if (this.connectionPool) {
        await this.connectionPool.drain();
      }

      // Close main connection
      if (this.db) {
        this.db.close();
      }

      // Clear cache
      if (this.queryCache) {
        this.queryCache.clear();
      }

      this.isInitialized = false;
      this.emit('shutdown');

      console.log('✅ DatabaseManager shut down successfully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  // Private methods

  private configureDatabase(): void {
    // Enable WAL mode for better concurrency
    if (this.config.enableWAL) {
      this.db.pragma('journal_mode = WAL');
    }

    // Enable foreign key constraints
    if (this.config.enableForeignKeys) {
      this.db.pragma('foreign_keys = ON');
    }

    // Set cache size (in pages, negative means KB)
    this.db.pragma(`cache_size = -${this.config.cacheSize * 1024}`);

    // Optimize for better performance
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB

    // Set busy timeout
    this.db.pragma(`busy_timeout = ${this.config.timeout}`);
  }

  private async runMigrations(): Promise<void> {
    try {
      const results = await this.migrationManager.migrate();

      for (const result of results) {
        if (result.success) {
          console.log(`✅ Migration ${result.version} applied in ${result.duration}ms`);
        } else {
          console.error(`❌ Migration ${result.version} failed: ${result.error}`);
          throw new Error(`Migration failed: ${result.error}`);
        }
      }
    } catch (error) {
      throw new Error(`Migration process failed: ${error.message}`);
    }
  }

  private async startBackgroundTasks(): Promise<void> {
    if (this.config.backup.enabled && this.backupManager) {
      await this.backupManager.start();
    }
  }

  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();

        if (health.issues.length > 0) {
          this.emit('health-warning', health);
        }
      } catch (error) {
        this.emit('health-error', error);
      }
    }, 30000);
  }

  private async executeTransaction<T>(
    connection: Database.Database,
    callback: (db: Database.Database) => Promise<T> | T,
    isolation: string
  ): Promise<T> {
    const transaction = connection.transaction((db: Database.Database) => {
      return callback(db);
    });

    // Set transaction mode
    if (isolation !== 'deferred') {
      connection.prepare(`BEGIN ${isolation.toUpperCase()}`).run();
    }

    return transaction(connection);
  }

  private generateCacheKey(sql: string, params: any[]): string {
    const key = sql + JSON.stringify(params);
    return Buffer.from(key).toString('base64');
  }

  private setupErrorHandling(): void {
    // Handle uncaught errors
    this.on('error', error => {
      console.error('DatabaseManager error:', error);
    });

    // Handle process signals for graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.db && this.db.open) {
        this.db.close();
      }

      if (this.connectionPool) {
        await this.connectionPool.drain();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('DatabaseManager is not initialized. Call initialize() first.');
    }
  }

  // Getters for accessing internal components (for advanced usage)

  get migrationManager(): MigrationManager {
    return this.migrationManager;
  }

  get backupManager(): BackupManager {
    return this.backupManager;
  }

  get performanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  get connectionPool(): ConnectionPool {
    return this.connectionPool;
  }
}
