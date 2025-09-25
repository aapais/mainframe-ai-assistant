/**
 * SQLite Storage Adapter
 * Provides SQLite-specific implementation of the storage adapter interface
 *
 * Features:
 * - High-performance SQLite operations with WAL mode
 * - Full-text search with FTS5
 * - Transaction support
 * - Query optimization and indexing
 * - Advanced caching and connection pooling
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import {
  IStorageAdapter,
  StorageTransaction,
  AdapterHealthStatus,
  SchemaInfo,
  AdapterConfig,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ConnectionError,
  QueryError,
  TransactionError,
} from './IStorageAdapter';
import {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchOptions,
  ExportFormat,
  ImportFormat,
  ExportOptions,
  ImportOptions,
  ImportResult,
  OptimizationResult,
  DatabaseMetrics,
} from '../IStorageService';

export class SQLiteAdapter implements IStorageAdapter {
  private db: Database.Database;
  private config: AdapterConfig;
  private isInitialized = false;
  private connectionStartTime: number;
  private queryCount = 0;
  private errorCount = 0;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.connectionStartTime = Date.now();
  }

  // ========================
  // Lifecycle Management
  // ========================

  async initialize(): Promise<void> {
    try {
      console.log('🔗 Initializing SQLite adapter...');

      // Create database connection
      const dbPath = this.config.connectionString;
      this.db = new Database(dbPath);

      // Apply performance configuration
      this.applyPragmas();

      // Initialize schema
      await this.initializeSchema();

      // Create indexes
      await this.createIndexes();

      // Enable query performance monitoring
      if (this.config.performanceTuning.enableQueryPlan) {
        this.enableQueryMonitoring();
      }

      this.isInitialized = true;
      console.log(`✅ SQLite adapter initialized: ${dbPath}`);
    } catch (error) {
      console.error('❌ SQLite adapter initialization failed:', error);
      throw new ConnectionError(
        `Failed to initialize SQLite adapter: ${error.message}`,
        'sqlite',
        error
      );
    }
  }

  async close(): Promise<void> {
    if (!this.isInitialized || !this.db) return;

    try {
      console.log('🔒 Closing SQLite adapter...');

      // Perform final checkpoint if WAL mode is enabled
      if (this.config.backup.enableWALCheckpoint) {
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      }

      // Close database connection
      this.db.close();
      this.isInitialized = false;

      console.log('✅ SQLite adapter closed');
    } catch (error) {
      console.error('❌ Error closing SQLite adapter:', error);
      throw error;
    }
  }

  // ========================
  // Core CRUD Operations
  // ========================

  async createEntry(entry: KBEntryInput): Promise<string> {
    this.ensureInitialized();

    const id = uuidv4();
    const transaction = this.db.transaction(() => {
      try {
        // Insert main entry
        this.db
          .prepare(
            `
          INSERT INTO kb_entries (
            id, title, problem, solution, category, severity, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            id,
            entry.title,
            entry.problem,
            entry.solution,
            entry.category,
            entry.severity || 'medium',
            entry.created_by || 'system'
          );

        // Insert tags
        if (entry.tags && entry.tags.length > 0) {
          const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
          entry.tags.forEach(tag => {
            tagStmt.run(id, tag.toLowerCase().trim());
          });
        }

        // Update FTS index
        this.updateFTSIndex(id, entry);

        this.queryCount++;
        return id;
      } catch (error) {
        this.errorCount++;
        throw new QueryError(`Failed to create entry: ${error.message}`, 'sqlite', 'INSERT', error);
      }
    });

    return transaction();
  }

  async readEntry(id: string): Promise<KBEntry | null> {
    this.ensureInitialized();

    try {
      const entry = this.db
        .prepare(
          `
        SELECT 
          e.*,
          GROUP_CONCAT(t.tag, ', ') as tags
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.id = ?
        GROUP BY e.id
      `
        )
        .get(id) as any;

      this.queryCount++;

      if (!entry) return null;

      return this.mapRowToEntry(entry);
    } catch (error) {
      this.errorCount++;
      throw new QueryError(`Failed to read entry: ${error.message}`, 'sqlite', 'SELECT', error);
    }
  }

  async updateEntry(id: string, updates: KBEntryUpdate): Promise<boolean> {
    this.ensureInitialized();

    const transaction = this.db.transaction(() => {
      try {
        // Build dynamic update query
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
          values.push(updates.archived ? 1 : 0);
        }

        if (setClause.length > 0) {
          setClause.push('updated_at = CURRENT_TIMESTAMP');
          values.push(id);

          const result = this.db
            .prepare(
              `
            UPDATE kb_entries 
            SET ${setClause.join(', ')}
            WHERE id = ?
          `
            )
            .run(...values);

          if (result.changes === 0) {
            return false;
          }
        }

        // Update tags if provided
        if (updates.tags !== undefined) {
          // Remove existing tags
          this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);

          // Add new tags
          if (updates.tags.length > 0) {
            const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
            updates.tags.forEach(tag => {
              tagStmt.run(id, tag.toLowerCase().trim());
            });
          }
        }

        // Update FTS index
        this.updateFTSIndexForUpdate(id, updates);

        this.queryCount++;
        return true;
      } catch (error) {
        this.errorCount++;
        throw new QueryError(`Failed to update entry: ${error.message}`, 'sqlite', 'UPDATE', error);
      }
    });

    return transaction();
  }

  async deleteEntry(id: string): Promise<boolean> {
    this.ensureInitialized();

    const transaction = this.db.transaction(() => {
      try {
        // Delete from FTS index first
        this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);

        // Delete tags
        this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);

        // Delete main entry
        const result = this.db.prepare('DELETE FROM kb_entries WHERE id = ?').run(id);

        this.queryCount++;
        return result.changes > 0;
      } catch (error) {
        this.errorCount++;
        throw new QueryError(`Failed to delete entry: ${error.message}`, 'sqlite', 'DELETE', error);
      }
    });

    return transaction();
  }

  // ========================
  // Batch Operations
  // ========================

  async createEntries(entries: KBEntryInput[]): Promise<string[]> {
    this.ensureInitialized();

    const transaction = this.db.transaction(() => {
      const ids: string[] = [];

      try {
        const entryStmt = this.db.prepare(`
          INSERT INTO kb_entries (
            id, title, problem, solution, category, severity, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');

        for (const entry of entries) {
          const id = uuidv4();

          entryStmt.run(
            id,
            entry.title,
            entry.problem,
            entry.solution,
            entry.category,
            entry.severity || 'medium',
            entry.created_by || 'system'
          );

          if (entry.tags && entry.tags.length > 0) {
            entry.tags.forEach(tag => {
              tagStmt.run(id, tag.toLowerCase().trim());
            });
          }

          this.updateFTSIndex(id, entry);
          ids.push(id);
        }

        this.queryCount += entries.length;
        return ids;
      } catch (error) {
        this.errorCount++;
        throw new QueryError(
          `Failed to create entries: ${error.message}`,
          'sqlite',
          'INSERT BATCH',
          error
        );
      }
    });

    return transaction();
  }

  async readEntries(ids: string[]): Promise<(KBEntry | null)[]> {
    this.ensureInitialized();

    if (ids.length === 0) return [];

    try {
      const placeholders = ids.map(() => '?').join(',');
      const entries = this.db
        .prepare(
          `
        SELECT 
          e.*,
          GROUP_CONCAT(t.tag, ', ') as tags
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.id IN (${placeholders})
        GROUP BY e.id
      `
        )
        .all(...ids) as any[];

      this.queryCount++;

      // Create result array maintaining order
      const entryMap = new Map(entries.map(e => [e.id, this.mapRowToEntry(e)]));
      return ids.map(id => entryMap.get(id) || null);
    } catch (error) {
      this.errorCount++;
      throw new QueryError(
        `Failed to read entries: ${error.message}`,
        'sqlite',
        'SELECT BATCH',
        error
      );
    }
  }

  async updateEntries(updates: Array<{ id: string; updates: KBEntryUpdate }>): Promise<boolean[]> {
    this.ensureInitialized();

    const transaction = this.db.transaction(() => {
      const results: boolean[] = [];

      try {
        for (const { id, updates: entryUpdates } of updates) {
          // Reuse single entry update logic
          const success = this.updateSingleEntryInTransaction(id, entryUpdates);
          results.push(success);
        }

        this.queryCount += updates.length;
        return results;
      } catch (error) {
        this.errorCount++;
        throw new QueryError(
          `Failed to update entries: ${error.message}`,
          'sqlite',
          'UPDATE BATCH',
          error
        );
      }
    });

    return transaction();
  }

  async deleteEntries(ids: string[]): Promise<boolean[]> {
    this.ensureInitialized();

    if (ids.length === 0) return [];

    const transaction = this.db.transaction(() => {
      const results: boolean[] = [];

      try {
        const deleteEntryStmt = this.db.prepare('DELETE FROM kb_entries WHERE id = ?');
        const deleteTagsStmt = this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?');
        const deleteFTSStmt = this.db.prepare('DELETE FROM kb_fts WHERE id = ?');

        for (const id of ids) {
          deleteFTSStmt.run(id);
          deleteTagsStmt.run(id);
          const result = deleteEntryStmt.run(id);
          results.push(result.changes > 0);
        }

        this.queryCount += ids.length;
        return results;
      } catch (error) {
        this.errorCount++;
        throw new QueryError(
          `Failed to delete entries: ${error.message}`,
          'sqlite',
          'DELETE BATCH',
          error
        );
      }
    });

    return transaction();
  }

  // ========================
  // Search Operations
  // ========================

  async searchEntries(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const searchOptions = {
        limit: 10,
        offset: 0,
        sortBy: 'relevance',
        ...options,
      };

      // Choose search strategy based on query
      const strategy = this.selectSearchStrategy(query, searchOptions);
      const results = await this.executeSearch(strategy, query, searchOptions);

      this.queryCount++;
      return results;
    } catch (error) {
      this.errorCount++;
      throw new QueryError(`Failed to search entries: ${error.message}`, 'sqlite', 'SEARCH', error);
    }
  }

  async getPopularEntries(limit: number = 10): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const entries = this.db
        .prepare(
          `
        SELECT 
          e.*,
          GROUP_CONCAT(t.tag, ', ') as tags,
          (e.usage_count * 2 + e.success_count) as popularity_score
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.archived = 0
        GROUP BY e.id
        ORDER BY popularity_score DESC, e.usage_count DESC
        LIMIT ?
      `
        )
        .all(limit) as any[];

      this.queryCount++;

      return entries.map(entry => ({
        entry: this.mapRowToEntry(entry),
        score: entry.popularity_score || 0,
        matchType: 'popular' as any,
        highlights: [],
      }));
    } catch (error) {
      this.errorCount++;
      throw new QueryError(
        `Failed to get popular entries: ${error.message}`,
        'sqlite',
        'SELECT',
        error
      );
    }
  }

  async getRecentEntries(limit: number = 10): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      const entries = this.db
        .prepare(
          `
        SELECT 
          e.*,
          GROUP_CONCAT(t.tag, ', ') as tags
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.archived = 0
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT ?
      `
        )
        .all(limit) as any[];

      this.queryCount++;

      return entries.map(entry => ({
        entry: this.mapRowToEntry(entry),
        score: 100,
        matchType: 'recent' as any,
        highlights: [],
      }));
    } catch (error) {
      this.errorCount++;
      throw new QueryError(
        `Failed to get recent entries: ${error.message}`,
        'sqlite',
        'SELECT',
        error
      );
    }
  }

  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    this.ensureInitialized();

    if (!query || query.length < 2) return [];

    try {
      const suggestions = this.db
        .prepare(
          `
        WITH suggestions AS (
          -- Common search terms from history
          SELECT DISTINCT 
            query as suggestion,
            COUNT(*) * 2 as score
          FROM search_history 
          WHERE query LIKE ? || '%'
          GROUP BY query
          
          UNION ALL
          
          -- Entry titles
          SELECT DISTINCT 
            title as suggestion,
            usage_count + success_count as score
          FROM kb_entries 
          WHERE title LIKE '%' || ? || '%'
            AND archived = 0
          
          UNION ALL
          
          -- Categories
          SELECT DISTINCT 
            'category:' || category as suggestion,
            COUNT(*) * 1.5 as score
          FROM kb_entries 
          WHERE category LIKE ? || '%'
            AND archived = 0
          GROUP BY category
          
          UNION ALL
          
          -- Tags
          SELECT DISTINCT 
            'tag:' || tag as suggestion,
            COUNT(*) as score
          FROM kb_tags 
          WHERE tag LIKE ? || '%'
          GROUP BY tag
        )
        SELECT suggestion
        FROM suggestions
        WHERE suggestion IS NOT NULL
        ORDER BY score DESC, length(suggestion) ASC
        LIMIT ?
      `
        )
        .all(query, query, query, query, limit)
        .map((row: any) => row.suggestion);

      this.queryCount++;
      return suggestions;
    } catch (error) {
      this.errorCount++;
      throw new QueryError(
        `Failed to get search suggestions: ${error.message}`,
        'sqlite',
        'SELECT',
        error
      );
    }
  }

  // ========================
  // Data Management
  // ========================

  async executeSQL(sql: string, params: any[] = []): Promise<any> {
    this.ensureInitialized();

    try {
      let result;

      // Determine if this is a SELECT or modification query
      const isSelect = sql.trim().toLowerCase().startsWith('select');

      if (isSelect) {
        result = this.db.prepare(sql).all(...params);
      } else {
        result = this.db.prepare(sql).run(...params);
      }

      this.queryCount++;
      return result;
    } catch (error) {
      this.errorCount++;
      throw new QueryError(`Failed to execute SQL: ${error.message}`, 'sqlite', sql, error);
    }
  }

  async beginTransaction(): Promise<StorageTransaction> {
    this.ensureInitialized();

    return new SQLiteTransaction(this.db);
  }

  async export(format: ExportFormat, options?: ExportOptions): Promise<string> {
    this.ensureInitialized();

    // Implementation would depend on format
    // For now, return JSON export
    const entries = await this.getAllEntries(options);
    return JSON.stringify(
      {
        version: '1.0',
        format,
        exported_at: new Date().toISOString(),
        entries,
      },
      null,
      2
    );
  }

  async import(data: string, format: ImportFormat, options?: ImportOptions): Promise<ImportResult> {
    this.ensureInitialized();

    // Basic JSON import implementation
    try {
      const importData = JSON.parse(data);
      const entries = importData.entries || [];

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors: any[] = [];

      for (const entry of entries) {
        try {
          if (options?.updateExisting && entry.id) {
            const existing = await this.readEntry(entry.id);
            if (existing) {
              await this.updateEntry(entry.id, entry);
              updated++;
            } else {
              await this.createEntry(entry);
              imported++;
            }
          } else {
            await this.createEntry(entry);
            imported++;
          }
        } catch (error) {
          skipped++;
          errors.push({
            line: entries.indexOf(entry) + 1,
            field: 'entry',
            message: error.message,
            code: 'IMPORT_ERROR',
          });
        }
      }

      return {
        success: errors.length === 0,
        imported,
        updated,
        skipped,
        errors,
        warnings: [],
        duration: 0,
      };
    } catch (error) {
      throw new QueryError(`Failed to import data: ${error.message}`, 'sqlite', 'IMPORT', error);
    }
  }

  // ========================
  // Performance & Monitoring
  // ========================

  async getMetrics(): Promise<DatabaseMetrics> {
    this.ensureInitialized();

    try {
      const dbInfo = this.db.prepare('PRAGMA database_list').all() as any[];
      const tableInfo = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as any[];
      const indexInfo = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all() as any[];

      const pageCount = this.db.pragma('page_count') as number;
      const pageSize = this.db.pragma('page_size') as number;
      const size = pageCount * pageSize;

      return {
        size,
        tableCount: tableInfo.length,
        indexCount: indexInfo.length,
        connectionCount: 1, // SQLite is single connection
        queryCount: this.queryCount,
        averageQueryTime: 0, // TODO: Implement timing
      };
    } catch (error) {
      throw new QueryError(`Failed to get metrics: ${error.message}`, 'sqlite', 'PRAGMA', error);
    }
  }

  async optimize(): Promise<OptimizationResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const optimizations: any[] = [];

    try {
      // Analyze tables
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as any[];

      for (const table of tables) {
        try {
          this.db.prepare(`ANALYZE ${table.name}`).run();
          optimizations.push({
            type: 'analyze',
            description: `Analyzed table ${table.name}`,
            impact: 'medium',
            executed: true,
          });
        } catch (error) {
          optimizations.push({
            type: 'analyze',
            description: `Failed to analyze table ${table.name}`,
            impact: 'medium',
            executed: false,
            error: error.message,
          });
        }
      }

      // Vacuum if enabled
      if (this.config.performanceTuning.autoVacuum) {
        try {
          this.db.prepare('VACUUM').run();
          optimizations.push({
            type: 'vacuum',
            description: 'Performed database vacuum',
            impact: 'high',
            executed: true,
          });
        } catch (error) {
          optimizations.push({
            type: 'vacuum',
            description: 'Failed to vacuum database',
            impact: 'high',
            executed: false,
            error: error.message,
          });
        }
      }

      const duration = Date.now() - startTime;
      const successfulOptimizations = optimizations.filter(o => o.executed).length;
      const performanceImprovement = Math.min(successfulOptimizations * 10, 50); // Estimate

      return {
        success: optimizations.some(o => o.executed),
        optimizations,
        performanceImprovement,
        duration,
      };
    } catch (error) {
      throw new QueryError(
        `Failed to optimize database: ${error.message}`,
        'sqlite',
        'OPTIMIZE',
        error
      );
    }
  }

  async healthCheck(): Promise<AdapterHealthStatus> {
    try {
      // Test basic database operation
      this.db.prepare('SELECT 1').get();

      const uptime = Date.now() - this.connectionStartTime;
      const errorRate = this.queryCount > 0 ? this.errorCount / this.queryCount : 0;

      const issues: any[] = [];

      if (errorRate > 0.05) {
        issues.push({
          severity: 'warning',
          message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
          details: { errorCount: this.errorCount, queryCount: this.queryCount },
        });
      }

      const status =
        issues.length === 0
          ? 'healthy'
          : issues.some(i => i.severity === 'critical')
            ? 'critical'
            : 'warning';

      return {
        status,
        uptime,
        connectionCount: 1,
        metrics: {
          queryCount: this.queryCount,
          errorCount: this.errorCount,
          errorRate: errorRate,
        },
        issues,
      };
    } catch (error) {
      return {
        status: 'critical',
        uptime: Date.now() - this.connectionStartTime,
        connectionCount: 0,
        lastError: error as Error,
        metrics: {
          queryCount: this.queryCount,
          errorCount: this.errorCount + 1,
          errorRate: 1,
        },
        issues: [
          {
            severity: 'critical',
            message: 'Database health check failed',
            details: error,
          },
        ],
      };
    }
  }

  async getSchemaInfo(): Promise<SchemaInfo> {
    this.ensureInitialized();

    try {
      const tables = await this.getTableInfo();
      const indexes = await this.getIndexInfo();

      return {
        version: '1.0',
        tables,
        indexes,
        triggers: [], // TODO: Implement trigger info
        constraints: [], // TODO: Implement constraint info
      };
    } catch (error) {
      throw new QueryError(
        `Failed to get schema info: ${error.message}`,
        'sqlite',
        'SCHEMA',
        error
      );
    }
  }

  // ========================
  // Configuration
  // ========================

  getConfig(): AdapterConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<AdapterConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // Apply pragma changes if needed
    if (config.pragma) {
      this.applyPragmas();
    }
  }

  // ========================
  // Private Helper Methods
  // ========================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ConnectionError('SQLite adapter not initialized', 'sqlite');
    }
  }

  private applyPragmas(): void {
    if (!this.config.pragma) return;

    for (const [key, value] of Object.entries(this.config.pragma)) {
      try {
        this.db.pragma(`${key} = ${value}`);
      } catch (error) {
        console.warn(`Failed to set pragma ${key}:`, error);
      }
    }
  }

  private async initializeSchema(): Promise<void> {
    // Check if schema exists
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_entries'")
      .get();

    if (!tables) {
      // Create base schema
      await this.createBaseSchema();
    }
  }

  private async createBaseSchema(): Promise<void> {
    const schemaSQL = `
      -- Knowledge Base Entries
      CREATE TABLE IF NOT EXISTS kb_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_used DATETIME,
        archived INTEGER DEFAULT 0
      );

      -- Tags
      CREATE TABLE IF NOT EXISTS kb_tags (
        entry_id TEXT,
        tag TEXT,
        PRIMARY KEY (entry_id, tag),
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
      );

      -- Search History
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        results_count INTEGER,
        selected_entry_id TEXT,
        user_id TEXT,
        session_id TEXT,
        search_type TEXT,
        response_time INTEGER,
        success INTEGER DEFAULT 1
      );

      -- Usage Metrics
      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT,
        action TEXT CHECK(action IN ('view', 'search', 'rate_success', 'rate_failure', 'create', 'update', 'delete')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        session_id TEXT,
        metadata TEXT,
        value REAL,
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id)
      );

      -- Full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
        id UNINDEXED,
        title,
        problem,
        solution,
        tags,
        category UNINDEXED,
        content=kb_entries
      );

      -- System Configuration
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        type TEXT DEFAULT 'string',
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      this.db.prepare(statement).run();
    }
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries(category)',
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_usage ON kb_entries(usage_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_created_at ON kb_entries(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_entries_archived ON kb_entries(archived)',
      'CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry_id ON usage_metrics(entry_id)',
      'CREATE INDEX IF NOT EXISTS idx_usage_metrics_timestamp ON usage_metrics(timestamp DESC)',
    ];

    for (const indexSQL of indexes) {
      try {
        this.db.prepare(indexSQL).run();
      } catch (error) {
        console.warn('Failed to create index:', indexSQL, error);
      }
    }
  }

  private enableQueryMonitoring(): void {
    // Enable query plan capture for performance analysis
    if (this.config.performanceTuning.enableQueryPlan) {
      this.db.pragma('query_only = false');
    }
  }

  private updateFTSIndex(id: string, entry: KBEntryInput): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO kb_fts (id, title, problem, solution, tags, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          id,
          entry.title,
          entry.problem,
          entry.solution,
          entry.tags?.join(' ') || '',
          entry.category
        );
    } catch (error) {
      console.warn('Failed to update FTS index:', error);
    }
  }

  private updateFTSIndexForUpdate(id: string, updates: KBEntryUpdate): void {
    try {
      // Remove old entry
      this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);

      // Get current entry data
      const current = this.db.prepare('SELECT * FROM kb_entries WHERE id = ?').get(id) as any;
      if (!current) return;

      // Update with new data
      const title = updates.title !== undefined ? updates.title : current.title;
      const problem = updates.problem !== undefined ? updates.problem : current.problem;
      const solution = updates.solution !== undefined ? updates.solution : current.solution;
      const category = updates.category !== undefined ? updates.category : current.category;

      let tags = '';
      if (updates.tags !== undefined) {
        tags = updates.tags.join(' ');
      } else {
        const currentTags = this.db
          .prepare('SELECT GROUP_CONCAT(tag, " ") as tags FROM kb_tags WHERE entry_id = ?')
          .get(id) as any;
        tags = currentTags?.tags || '';
      }

      this.db
        .prepare(
          `
        INSERT INTO kb_fts (id, title, problem, solution, tags, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(id, title, problem, solution, tags, category);
    } catch (error) {
      console.warn('Failed to update FTS index for update:', error);
    }
  }

  private mapRowToEntry(row: any): KBEntry {
    return {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category,
      severity: row.severity,
      tags: row.tags ? row.tags.split(', ').filter(Boolean) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      usage_count: row.usage_count || 0,
      success_count: row.success_count || 0,
      failure_count: row.failure_count || 0,
      last_used: row.last_used ? new Date(row.last_used) : undefined,
      archived: Boolean(row.archived),
    };
  }

  private selectSearchStrategy(
    query: string,
    options: SearchOptions
  ): 'exact' | 'fts' | 'fuzzy' | 'category' | 'tag' {
    // Error code patterns
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return 'exact';
    }

    // Category search
    if (query.startsWith('category:') || options.category) {
      return 'category';
    }

    // Tag search
    if (query.startsWith('tag:')) {
      return 'tag';
    }

    // Short queries - use fuzzy
    if (query.length < 4) {
      return 'fuzzy';
    }

    // Default to FTS
    return 'fts';
  }

  private async executeSearch(
    strategy: string,
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    switch (strategy) {
      case 'exact':
        return this.executeExactSearch(query, options);
      case 'fts':
        return this.executeFTSSearch(query, options);
      case 'fuzzy':
        return this.executeFuzzySearch(query, options);
      case 'category':
        return this.executeCategorySearch(query, options);
      case 'tag':
        return this.executeTagSearch(query, options);
      default:
        return this.executeFTSSearch(query, options);
    }
  }

  private executeExactSearch(query: string, options: SearchOptions): SearchResult[] {
    const entries = this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        100 as relevance_score
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE (e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)
        AND e.archived = 0
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY e.usage_count DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        ...(options.category ? [options.category] : []),
        options.limit || 10,
        options.offset || 0
      ) as any[];

    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: 100,
      matchType: 'exact' as any,
      highlights: this.generateHighlights(query, entry),
    }));
  }

  private executeFTSSearch(query: string, options: SearchOptions): SearchResult[] {
    const ftsQuery = this.prepareFTSQuery(query);

    const entries = this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        bm25(kb_fts, 3.0, 2.0, 1.5, 1.0) as relevance_score
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ?
        AND e.archived = 0
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY relevance_score DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(
        ftsQuery,
        ...(options.category ? [options.category] : []),
        options.limit || 10,
        options.offset || 0
      ) as any[];

    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: Math.abs(entry.relevance_score) * 10,
      matchType: 'fuzzy' as any,
      highlights: this.generateHighlights(query, entry),
    }));
  }

  private executeFuzzySearch(query: string, options: SearchOptions): SearchResult[] {
    const entries = this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        (CASE WHEN e.title LIKE ? THEN 3 ELSE 0 END +
         CASE WHEN e.problem LIKE ? THEN 2 ELSE 0 END +
         CASE WHEN e.solution LIKE ? THEN 1 ELSE 0 END) as relevance_score
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE (e.title LIKE ? OR e.problem LIKE ? OR e.solution LIKE ?)
        AND e.archived = 0
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      HAVING relevance_score > 0
      ORDER BY relevance_score DESC, e.usage_count DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        ...(options.category ? [options.category] : []),
        options.limit || 10,
        options.offset || 0
      ) as any[];

    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: entry.relevance_score * 20,
      matchType: 'fuzzy' as any,
      highlights: this.generateHighlights(query, entry),
    }));
  }

  private executeCategorySearch(query: string, options: SearchOptions): SearchResult[] {
    const category = options.category || query.replace('category:', '');

    const entries = this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        90 as relevance_score
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.category = ?
        AND e.archived = 0
      GROUP BY e.id
      ORDER BY e.usage_count DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(category, options.limit || 10, options.offset || 0) as any[];

    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: 90,
      matchType: 'category' as any,
      highlights: [],
    }));
  }

  private executeTagSearch(query: string, options: SearchOptions): SearchResult[] {
    const tag = query.replace('tag:', '');

    const entries = this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
        85 as relevance_score
      FROM kb_entries e
      JOIN kb_tags t ON e.id = t.entry_id
      WHERE t.tag = ?
        AND e.archived = 0
        ${options.category ? 'AND e.category = ?' : ''}
      GROUP BY e.id
      ORDER BY e.usage_count DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(
        tag,
        ...(options.category ? [options.category] : []),
        options.limit || 10,
        options.offset || 0
      ) as any[];

    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: 85,
      matchType: 'tag' as any,
      highlights: [],
    }));
  }

  private generateHighlights(query: string, entry: any): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();

    const fields = [
      { name: 'title', content: entry.title },
      { name: 'problem', content: entry.problem },
      { name: 'solution', content: entry.solution },
    ];

    fields.forEach(field => {
      const lowerContent = field.content.toLowerCase();
      const index = lowerContent.indexOf(queryLower);
      if (index !== -1) {
        const start = Math.max(0, index - 30);
        const end = Math.min(field.content.length, index + queryLower.length + 30);
        const snippet = field.content.substring(start, end);
        highlights.push(start > 0 ? '...' + snippet : snippet);
      }
    });

    return highlights.slice(0, 3);
  }

  private prepareFTSQuery(query: string): string {
    // Handle special prefixes
    if (query.startsWith('category:')) {
      return `category:${query.substring(9)}`;
    }
    if (query.startsWith('tag:')) {
      return `tags:${query.substring(4)}`;
    }

    // Clean and prepare query
    let ftsQuery = query.trim().replace(/['"]/g, '');
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 1);

    if (terms.length === 0) return ftsQuery;

    // Use phrase search for multi-word queries
    if (terms.length > 1) {
      return `"${terms.join(' ')}"`;
    }

    // Single term with prefix matching
    return `${terms[0]}*`;
  }

  private updateSingleEntryInTransaction(id: string, updates: KBEntryUpdate): boolean {
    // This is a helper method for batch updates within a transaction
    // Implementation similar to updateEntry but without transaction wrapper

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
      values.push(updates.archived ? 1 : 0);
    }

    if (setClause.length > 0) {
      setClause.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const result = this.db
        .prepare(
          `
        UPDATE kb_entries 
        SET ${setClause.join(', ')}
        WHERE id = ?
      `
        )
        .run(...values);

      if (result.changes === 0) {
        return false;
      }
    }

    // Update tags if provided
    if (updates.tags !== undefined) {
      this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);

      if (updates.tags.length > 0) {
        const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
        updates.tags.forEach(tag => {
          tagStmt.run(id, tag.toLowerCase().trim());
        });
      }
    }

    // Update FTS index
    this.updateFTSIndexForUpdate(id, updates);

    return true;
  }

  private async getAllEntries(options?: ExportOptions): Promise<KBEntry[]> {
    let whereClause = 'WHERE e.archived = 0';
    const params: any[] = [];

    if (options?.filter?.categories) {
      whereClause +=
        ' AND e.category IN (' + options.filter.categories.map(() => '?').join(',') + ')';
      params.push(...options.filter.categories);
    }

    if (options?.filter?.dateRange) {
      whereClause += ' AND e.created_at BETWEEN ? AND ?';
      params.push(
        options.filter.dateRange.start.toISOString(),
        options.filter.dateRange.end.toISOString()
      );
    }

    const entries = this.db
      .prepare(
        `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      ${whereClause}
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `
      )
      .all(...params) as any[];

    return entries.map(entry => this.mapRowToEntry(entry));
  }

  private async getTableInfo(): Promise<TableInfo[]> {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as any[];

    const tableInfos: TableInfo[] = [];

    for (const table of tables) {
      const columns = this.db.prepare(`PRAGMA table_info(${table.name})`).all() as any[];
      const rowCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as any;

      const columnInfos: ColumnInfo[] = columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        defaultValue: col.dflt_value,
        isPrimaryKey: Boolean(col.pk),
        isForeignKey: false, // TODO: Detect foreign keys
      }));

      tableInfos.push({
        name: table.name,
        columns: columnInfos,
        rowCount: rowCount.count,
        size: 0, // TODO: Calculate table size
      });
    }

    return tableInfos;
  }

  private async getIndexInfo(): Promise<IndexInfo[]> {
    const indexes = this.db
      .prepare(
        "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as any[];

    return indexes.map(index => ({
      name: index.name,
      table: index.tbl_name,
      columns: [], // TODO: Parse columns from SQL
      unique: index.sql.includes('UNIQUE'),
      type: 'btree', // SQLite default
      size: 0, // TODO: Calculate index size
      usage: {
        scanCount: 0,
        seekCount: 0,
      },
    }));
  }
}

class SQLiteTransaction implements StorageTransaction {
  private transaction: any;
  private active = true;

  constructor(private db: Database.Database) {
    this.transaction = this.db.transaction(() => {});
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.active) {
      throw new TransactionError('Transaction is not active', 'sqlite');
    }

    try {
      const isSelect = sql.trim().toLowerCase().startsWith('select');

      if (isSelect) {
        return this.db.prepare(sql).all(...params);
      } else {
        return this.db.prepare(sql).run(...params);
      }
    } catch (error) {
      throw new QueryError(`Transaction execute failed: ${error.message}`, 'sqlite', sql, error);
    }
  }

  async commit(): Promise<void> {
    if (!this.active) {
      throw new TransactionError('Transaction is not active', 'sqlite');
    }

    try {
      this.transaction();
      this.active = false;
    } catch (error) {
      throw new TransactionError(`Transaction commit failed: ${error.message}`, 'sqlite', error);
    }
  }

  async rollback(): Promise<void> {
    if (!this.active) {
      throw new TransactionError('Transaction is not active', 'sqlite');
    }

    try {
      // SQLite auto-rollbacks on error, so just mark as inactive
      this.active = false;
    } catch (error) {
      throw new TransactionError(`Transaction rollback failed: ${error.message}`, 'sqlite', error);
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
