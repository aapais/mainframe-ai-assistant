import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface PerformanceConfig {
  cacheSize: number;
  mmapSize: number;
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
  lockingMode: 'NORMAL' | 'EXCLUSIVE';
  autoVacuum: 'NONE' | 'FULL' | 'INCREMENTAL';
}

export class PerformanceTuner {
  private db: Database.Database;
  private config: PerformanceConfig;

  constructor(db: Database.Database) {
    this.db = db;
    this.config = this.getOptimalConfig();
    this.applyConfiguration();
  }

  /**
   * Get optimal configuration for desktop Knowledge Base
   */
  private getOptimalConfig(): PerformanceConfig {
    // Detect system capabilities
    const totalRAM = this.estimateAvailableRAM();
    const isLocal = this.isLocalDatabase();

    return {
      // Cache size: Use 25% of available RAM, min 64MB, max 512MB
      cacheSize: Math.min(512 * 1024, Math.max(64 * 1024, Math.floor(totalRAM * 0.25))),

      // Memory mapping: 256MB for local files, good for read performance
      mmapSize: isLocal ? 256 * 1024 * 1024 : 0,

      // WAL mode for better concurrency and crash recovery
      journalMode: 'WAL',

      // NORMAL synchronous for good balance of performance/safety
      synchronous: 'NORMAL',

      // Memory temp store for better performance
      tempStore: 'MEMORY',

      // Normal locking for desktop app (single user)
      lockingMode: 'NORMAL',

      // Incremental auto-vacuum to prevent file bloat
      autoVacuum: 'INCREMENTAL',
    };
  }

  /**
   * Apply performance configuration
   */
  private applyConfiguration(): void {
    console.log('🔧 Applying SQLite performance configuration...');

    try {
      // Core performance settings
      this.db.pragma(`cache_size = -${this.config.cacheSize}`);
      this.db.pragma(`mmap_size = ${this.config.mmapSize}`);
      this.db.pragma(`journal_mode = ${this.config.journalMode}`);
      this.db.pragma(`synchronous = ${this.config.synchronous}`);
      this.db.pragma(`temp_store = ${this.config.tempStore}`);
      this.db.pragma(`locking_mode = ${this.config.lockingMode}`);
      this.db.pragma(`auto_vacuum = ${this.config.autoVacuum}`);

      // Additional optimizations
      this.db.pragma('optimize');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('recursive_triggers = ON');
      this.db.pragma('trusted_schema = OFF'); // Security

      // Query optimizer settings
      this.db.pragma('query_only = OFF');
      this.db.pragma('defer_foreign_keys = OFF');

      console.log('✅ Performance configuration applied successfully');
      this.logConfiguration();
    } catch (error) {
      console.error('❌ Failed to apply performance configuration:', error);
    }
  }

  /**
   * Log current configuration
   */
  private logConfiguration(): void {
    const currentConfig = {
      cache_size: this.db.pragma('cache_size', { simple: true }),
      journal_mode: this.db.pragma('journal_mode', { simple: true }),
      synchronous: this.db.pragma('synchronous', { simple: true }),
      temp_store: this.db.pragma('temp_store', { simple: true }),
      mmap_size: this.db.pragma('mmap_size', { simple: true }),
      auto_vacuum: this.db.pragma('auto_vacuum', { simple: true }),
    };

    console.log('📊 Current SQLite configuration:', currentConfig);
  }

  /**
   * Perform comprehensive database optimization
   */
  optimize(): {
    sizeBefore: number;
    sizeAfter: number;
    duration: number;
    operations: string[];
  } {
    const startTime = Date.now();
    const operations: string[] = [];

    console.log('🚀 Starting comprehensive database optimization...');

    // Get initial size
    const sizeBefore = this.getDatabaseSize();

    // 1. Update table statistics
    console.log('📊 Updating table statistics...');
    this.db.exec('ANALYZE');
    operations.push('ANALYZE tables');

    // 2. Optimize query planner
    console.log('🔍 Optimizing query planner...');
    this.db.pragma('optimize');
    operations.push('Query planner optimization');

    // 3. Rebuild FTS index if needed
    console.log('🔍 Checking FTS index...');
    try {
      const ftsInfo = this.db.prepare('SELECT count(*) as count FROM kb_fts').get() as {
        count: number;
      };
      const entriesCount = this.db.prepare('SELECT count(*) as count FROM kb_entries').get() as {
        count: number;
      };

      if (Math.abs(ftsInfo.count - entriesCount.count) > 0) {
        console.log('🔧 Rebuilding FTS index...');
        this.db.exec("INSERT INTO kb_fts(kb_fts) VALUES('rebuild')");
        operations.push('FTS index rebuild');
      }
    } catch (error) {
      console.log('ℹ️ FTS index check skipped');
    }

    // 4. Incremental vacuum
    console.log('🧹 Running incremental vacuum...');
    try {
      this.db.pragma('incremental_vacuum');
      operations.push('Incremental vacuum');
    } catch (error) {
      console.log('ℹ️ Incremental vacuum not needed');
    }

    // 5. WAL checkpoint
    if (this.config.journalMode === 'WAL') {
      console.log('📝 WAL checkpoint...');
      const result = this.db.pragma('wal_checkpoint(TRUNCATE)');
      operations.push(`WAL checkpoint: ${JSON.stringify(result)}`);
    }

    // 6. Integrity check (quick)
    console.log('🔍 Quick integrity check...');
    const integrityResult = this.db.pragma('quick_check', { simple: true });
    if (integrityResult === 'ok') {
      operations.push('Integrity check: OK');
    } else {
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
      operations,
    };
  }

  /**
   * Monitor database performance
   */
  getPerformanceMetrics(): {
    cacheHitRatio: number;
    pageCount: number;
    pageSize: number;
    databaseSize: number;
    walSize?: number;
    freePages: number;
    indexUsage: Array<{ name: string; used: boolean }>;
  } {
    const cacheHit = this.db.pragma('cache_hit_ratio', { simple: true }) || 0;
    const pageCount = this.db.pragma('page_count', { simple: true });
    const pageSize = this.db.pragma('page_size', { simple: true });
    const freePages = this.db.pragma('freelist_count', { simple: true });

    let walSize;
    if (this.config.journalMode === 'WAL') {
      try {
        const walFile = this.db.name + '-wal';
        if (fs.existsSync(walFile)) {
          walSize = fs.statSync(walFile).size;
        }
      } catch (error) {
        // WAL file might not exist
      }
    }

    // Check index usage
    const indexes = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
    `
      )
      .all() as Array<{ name: string }>;

    const indexUsage = indexes.map(idx => ({
      name: idx.name,
      used: this.checkIndexUsage(idx.name),
    }));

    return {
      cacheHitRatio: cacheHit,
      pageCount,
      pageSize,
      databaseSize: pageCount * pageSize,
      walSize,
      freePages,
      indexUsage,
    };
  }

  /**
   * Schedule automatic maintenance
   */
  scheduleMaintenace(): void {
    // Auto-optimize every 24 hours
    setInterval(
      () => {
        console.log('🔄 Running scheduled database optimization...');
        this.optimize();
      },
      24 * 60 * 60 * 1000
    );

    // WAL checkpoint every hour
    if (this.config.journalMode === 'WAL') {
      setInterval(
        () => {
          try {
            this.db.pragma('wal_checkpoint(PASSIVE)');
          } catch (error) {
            console.error('WAL checkpoint error:', error);
          }
        },
        60 * 60 * 1000
      );
    }

    // Incremental vacuum every 6 hours
    setInterval(
      () => {
        try {
          this.db.pragma('incremental_vacuum(100)'); // Vacuum up to 100 pages
        } catch (error) {
          // Not critical if it fails
        }
      },
      6 * 60 * 60 * 1000
    );

    console.log('⏰ Automatic maintenance scheduled');
  }

  /**
   * Benchmark database operations
   */
  async benchmark(): Promise<{
    insertTime: number;
    searchTime: number;
    updateTime: number;
    deleteTime: number;
    ftsSearchTime: number;
  }> {
    console.log('🏃 Running performance benchmark...');

    const testData = {
      id: 'benchmark-test',
      title: 'Benchmark Test Entry',
      problem: 'This is a test problem for benchmarking database performance',
      solution: 'This is a test solution with various keywords for search testing',
      category: 'Other',
      tags: ['benchmark', 'test', 'performance'],
    };

    // Benchmark INSERT
    const insertStart = Date.now();
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO kb_entries (id, title, problem, solution, category)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      testData.id,
      testData.title,
      testData.problem,
      testData.solution,
      testData.category
    );
    const insertTime = Date.now() - insertStart;

    // Benchmark SELECT
    const searchStart = Date.now();
    const searchStmt = this.db.prepare('SELECT * FROM kb_entries WHERE id = ?');
    searchStmt.get(testData.id);
    const searchTime = Date.now() - searchStart;

    // Benchmark UPDATE
    const updateStart = Date.now();
    const updateStmt = this.db.prepare(
      'UPDATE kb_entries SET usage_count = usage_count + 1 WHERE id = ?'
    );
    updateStmt.run(testData.id);
    const updateTime = Date.now() - updateStart;

    // Benchmark FTS SEARCH
    const ftsStart = Date.now();
    try {
      const ftsStmt = this.db.prepare('SELECT * FROM kb_fts WHERE kb_fts MATCH ? LIMIT 1');
      ftsStmt.get('benchmark');
    } catch (error) {
      // FTS might not be ready
    }
    const ftsSearchTime = Date.now() - ftsStart;

    // Benchmark DELETE
    const deleteStart = Date.now();
    const deleteStmt = this.db.prepare('DELETE FROM kb_entries WHERE id = ?');
    deleteStmt.run(testData.id);
    const deleteTime = Date.now() - deleteStart;

    const results = {
      insertTime,
      searchTime,
      updateTime,
      deleteTime,
      ftsSearchTime,
    };

    console.log('📊 Benchmark results (ms):', results);
    return results;
  }

  /**
   * Estimate available RAM (simplified)
   */
  private estimateAvailableRAM(): number {
    // Simplified estimation - in production, use OS-specific methods
    return 8 * 1024; // Assume 8GB RAM, return in MB
  }

  /**
   * Check if database is local file
   */
  private isLocalDatabase(): boolean {
    return this.db.name !== ':memory:' && !this.db.name.includes('://');
  }

  /**
   * Get database file size
   */
  private getDatabaseSize(): number {
    try {
      if (this.db.name === ':memory:') return 0;
      return fs.statSync(this.db.name).size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if index is being used (simplified)
   */
  private checkIndexUsage(indexName: string): boolean {
    try {
      // This is a simplified check - in production, use query plan analysis
      const result = this.db
        .prepare(
          `
        EXPLAIN QUERY PLAN 
        SELECT * FROM kb_entries WHERE rowid = 1
      `
        )
        .all();

      return result.some((row: any) => row.detail && row.detail.includes(indexName));
    } catch (error) {
      return false;
    }
  }

  /**
   * Get configuration recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getPerformanceMetrics();

    // Cache hit ratio
    if (metrics.cacheHitRatio < 0.9) {
      recommendations.push(
        `Low cache hit ratio (${metrics.cacheHitRatio.toFixed(2)}). Consider increasing cache_size.`
      );
    }

    // Free pages
    if (metrics.freePages > metrics.pageCount * 0.1) {
      recommendations.push(`High free page count (${metrics.freePages}). Consider running VACUUM.`);
    }

    // WAL size
    if (metrics.walSize && metrics.walSize > metrics.databaseSize * 0.1) {
      recommendations.push(
        `Large WAL file (${this.formatBytes(metrics.walSize)}). Consider checkpoint.`
      );
    }

    // Unused indexes
    const unusedIndexes = metrics.indexUsage.filter(idx => !idx.used);
    if (unusedIndexes.length > 0) {
      recommendations.push(`Found ${unusedIndexes.length} potentially unused indexes.`);
    }

    return recommendations;
  }
}
