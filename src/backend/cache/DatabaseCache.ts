/**
 * Database Cache - L2 Cache Layer
 * SQLite-based persistent caching with compression and cleanup
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { gzipSync, gunzipSync } from 'zlib';
import { L2Config } from './MultiLayerCache';

export interface DatabaseCacheEntry {
  key: string;
  value: string;
  compressed: boolean;
  created_at: number;
  expires_at: number;
  access_count: number;
  last_accessed: number;
  size: number;
}

/**
 * High-Performance Database Cache Layer
 * Features:
 * - Persistent SQLite storage
 * - Automatic compression for large values
 * - LRU-based cleanup with access tracking
 * - Background cleanup processes
 * - Memory-efficient batch operations
 */
export class DatabaseCache extends EventEmitter {
  private db: Database.Database;
  private config: L2Config;
  private cleanupInterval?: ReturnType<typeof setTimeout>;

  // Prepared statements for performance
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private deleteStmt: Database.Statement;
  private existsStmt: Database.Statement;
  private touchStmt: Database.Statement;
  private cleanupStmt: Database.Statement;
  private countStmt: Database.Statement;
  private sizeStmt: Database.Statement;

  constructor(config: L2Config, dbPath: string = './cache.db') {
    super();
    this.config = config;

    try {
      this.db = new Database(dbPath);
      this.initializeDatabase();
      this.prepareStatements();
      this.startBackgroundCleanup();

      this.emit('ready');
    } catch (error) {
      console.error('DatabaseCache initialization error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get value from database cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const row = this.getStmt.get(key, Date.now()) as DatabaseCacheEntry | undefined;

      if (!row) {
        return null;
      }

      // Check expiration
      if (row.expires_at && row.expires_at < Date.now()) {
        this.deleteStmt.run(key);
        return null;
      }

      // Update access statistics
      this.touchStmt.run(key);

      // Decompress if needed
      let value = row.value;
      if (row.compressed) {
        try {
          const buffer = Buffer.from(value, 'base64');
          const decompressed = gunzipSync(buffer);
          value = decompressed.toString('utf8');
        } catch (error) {
          console.error('Decompression error for key:', key, error);
          return null;
        }
      }

      return JSON.parse(value) as T;

    } catch (error) {
      console.error('DatabaseCache get error:', error);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Set value in database cache
   */
  async set<T = any>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, 'utf8');

      let finalValue = serialized;
      let compressed = false;

      // Compress large values
      if (size > this.config.compressionThreshold) {
        try {
          const buffer = gzipSync(serialized);
          finalValue = buffer.toString('base64');
          compressed = true;
        } catch (error) {
          console.error('Compression error for key:', key, error);
          // Continue without compression
        }
      }

      const now = Date.now();
      const expiresAt = ttl > 0 ? now + (ttl * 1000) : 0; // 0 means no expiration

      this.setStmt.run({
        key,
        value: finalValue,
        compressed: compressed ? 1 : 0,
        created_at: now,
        expires_at: expiresAt,
        access_count: 1,
        last_accessed: now,
        size: Buffer.byteLength(finalValue, 'utf8')
      });

      // Trigger cleanup if we're approaching the limit
      const count = (this.countStmt.get() as { count: number }).count;
      if (count > this.config.maxItems * 0.9) {
        setImmediate(() => this.performCleanup());
      }

    } catch (error) {
      console.error('DatabaseCache set error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = this.deleteStmt.run(key);
      return result.changes > 0;
    } catch (error) {
      console.error('DatabaseCache delete error:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const row = this.existsStmt.get(key, Date.now());
      return !!row;
    } catch (error) {
      console.error('DatabaseCache exists error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.db.exec('DELETE FROM cache_entries');
      this.emit('cleared');
    } catch (error) {
      console.error('DatabaseCache clear error:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    totalSize: number;
    avgAccessCount: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    try {
      const stats = this.db.prepare(`
        SELECT
          COUNT(*) as totalEntries,
          SUM(size) as totalSize,
          AVG(access_count) as avgAccessCount,
          MIN(created_at) as oldestEntry,
          MAX(created_at) as newestEntry
        FROM cache_entries
        WHERE expires_at = 0 OR expires_at > ?
      `).get(Date.now()) as any;

      return {
        totalEntries: stats.totalEntries || 0,
        totalSize: stats.totalSize || 0,
        avgAccessCount: stats.avgAccessCount || 0,
        oldestEntry: stats.oldestEntry || 0,
        newestEntry: stats.newestEntry || 0
      };
    } catch (error) {
      console.error('DatabaseCache getStats error:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        avgAccessCount: 0,
        oldestEntry: 0,
        newestEntry: 0
      };
    }
  }

  /**
   * Perform manual cleanup
   */
  async performCleanup(): Promise<{ removed: number; freedBytes: number }> {
    try {
      const beforeStats = this.getStats();

      // Remove expired entries first
      const expiredResult = this.db.prepare(`
        DELETE FROM cache_entries
        WHERE expires_at > 0 AND expires_at < ?
      `).run(Date.now());

      // If still over limit, remove LRU entries
      let lruResult = { changes: 0 };
      const currentCount = (this.countStmt.get() as { count: number }).count;

      if (currentCount > this.config.maxItems) {
        const excessCount = currentCount - this.config.maxItems;
        lruResult = this.db.prepare(`
          DELETE FROM cache_entries
          WHERE key IN (
            SELECT key FROM cache_entries
            ORDER BY access_count ASC, last_accessed ASC
            LIMIT ?
          )
        `).run(excessCount);
      }

      const afterStats = this.getStats();
      const totalRemoved = expiredResult.changes + lruResult.changes;
      const freedBytes = beforeStats.totalSize - afterStats.totalSize;

      this.emit('cleanup', {
        removed: totalRemoved,
        freedBytes,
        expired: expiredResult.changes,
        lru: lruResult.changes
      });

      return { removed: totalRemoved, freedBytes };

    } catch (error) {
      console.error('DatabaseCache cleanup error:', error);
      this.emit('error', error);
      return { removed: 0, freedBytes: 0 };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      if (this.db) {
        this.db.close();
      }

      this.emit('closed');
    } catch (error) {
      console.error('DatabaseCache close error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');

    // Create cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        compressed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER DEFAULT 0,
        access_count INTEGER DEFAULT 0,
        last_accessed INTEGER NOT NULL,
        size INTEGER NOT NULL
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_entries(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cache_access_count ON cache_entries(access_count);
      CREATE INDEX IF NOT EXISTS idx_cache_last_accessed ON cache_entries(last_accessed);
      CREATE INDEX IF NOT EXISTS idx_cache_size ON cache_entries(size);
    `);

    // Analyze tables for better query planning
    this.db.exec('ANALYZE');
  }

  /**
   * Prepare SQL statements for optimal performance
   */
  private prepareStatements(): void {
    this.getStmt = this.db.prepare(`
      SELECT * FROM cache_entries
      WHERE key = ? AND (expires_at = 0 OR expires_at > ?)
    `);

    this.setStmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache_entries
      (key, value, compressed, created_at, expires_at, access_count, last_accessed, size)
      VALUES (@key, @value, @compressed, @created_at, @expires_at, @access_count, @last_accessed, @size)
    `);

    this.deleteStmt = this.db.prepare(`
      DELETE FROM cache_entries WHERE key = ?
    `);

    this.existsStmt = this.db.prepare(`
      SELECT 1 FROM cache_entries
      WHERE key = ? AND (expires_at = 0 OR expires_at > ?)
    `);

    this.touchStmt = this.db.prepare(`
      UPDATE cache_entries
      SET access_count = access_count + 1, last_accessed = ?
      WHERE key = ?
    `).bind(undefined, Date.now());

    this.cleanupStmt = this.db.prepare(`
      DELETE FROM cache_entries
      WHERE expires_at > 0 AND expires_at < ?
    `);

    this.countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cache_entries
    `);

    this.sizeStmt = this.db.prepare(`
      SELECT SUM(size) as totalSize FROM cache_entries
    `);
  }

  /**
   * Start background cleanup process
   */
  private startBackgroundCleanup(): void {
    const intervalMs = this.config.cleanupIntervalMinutes * 60 * 1000;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
        .then((result) => {
          if (result.removed > 0) {
            console.log(`Cache cleanup: removed ${result.removed} entries, freed ${result.freedBytes} bytes`);
          }
        })
        .catch((error) => {
          console.error('Background cleanup error:', error);
        });
    }, intervalMs);

    // Run initial cleanup
    setImmediate(() => this.performCleanup());
  }
}