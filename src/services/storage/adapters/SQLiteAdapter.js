'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SQLiteAdapter = void 0;
const tslib_1 = require('tslib');
const better_sqlite3_1 = tslib_1.__importDefault(require('better-sqlite3'));
const uuid_1 = require('uuid');
const IStorageAdapter_1 = require('./IStorageAdapter');
class SQLiteAdapter {
  db;
  config;
  isInitialized = false;
  connectionStartTime;
  queryCount = 0;
  errorCount = 0;
  constructor(config) {
    this.config = config;
    this.connectionStartTime = Date.now();
  }
  async initialize() {
    try {
      console.log('🔗 Initializing SQLite adapter...');
      const dbPath = this.config.connectionString;
      this.db = new better_sqlite3_1.default(dbPath);
      this.applyPragmas();
      await this.initializeSchema();
      await this.createIndexes();
      if (this.config.performanceTuning.enableQueryPlan) {
        this.enableQueryMonitoring();
      }
      this.isInitialized = true;
      console.log(`✅ SQLite adapter initialized: ${dbPath}`);
    } catch (error) {
      console.error('❌ SQLite adapter initialization failed:', error);
      throw new IStorageAdapter_1.ConnectionError(
        `Failed to initialize SQLite adapter: ${error.message}`,
        'sqlite',
        error
      );
    }
  }
  async close() {
    if (!this.isInitialized || !this.db) return;
    try {
      console.log('🔒 Closing SQLite adapter...');
      if (this.config.backup.enableWALCheckpoint) {
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      }
      this.db.close();
      this.isInitialized = false;
      console.log('✅ SQLite adapter closed');
    } catch (error) {
      console.error('❌ Error closing SQLite adapter:', error);
      throw error;
    }
  }
  async createEntry(entry) {
    this.ensureInitialized();
    const id = (0, uuid_1.v4)();
    const transaction = this.db.transaction(() => {
      try {
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
        if (entry.tags && entry.tags.length > 0) {
          const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
          entry.tags.forEach(tag => {
            tagStmt.run(id, tag.toLowerCase().trim());
          });
        }
        this.updateFTSIndex(id, entry);
        this.queryCount++;
        return id;
      } catch (error) {
        this.errorCount++;
        throw new IStorageAdapter_1.QueryError(
          `Failed to create entry: ${error.message}`,
          'sqlite',
          'INSERT',
          error
        );
      }
    });
    return transaction();
  }
  async readEntry(id) {
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
        .get(id);
      this.queryCount++;
      if (!entry) return null;
      return this.mapRowToEntry(entry);
    } catch (error) {
      this.errorCount++;
      throw new IStorageAdapter_1.QueryError(
        `Failed to read entry: ${error.message}`,
        'sqlite',
        'SELECT',
        error
      );
    }
  }
  async updateEntry(id, updates) {
    this.ensureInitialized();
    const transaction = this.db.transaction(() => {
      try {
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
        if (updates.tags !== undefined) {
          this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);
          if (updates.tags.length > 0) {
            const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
            updates.tags.forEach(tag => {
              tagStmt.run(id, tag.toLowerCase().trim());
            });
          }
        }
        this.updateFTSIndexForUpdate(id, updates);
        this.queryCount++;
        return true;
      } catch (error) {
        this.errorCount++;
        throw new IStorageAdapter_1.QueryError(
          `Failed to update entry: ${error.message}`,
          'sqlite',
          'UPDATE',
          error
        );
      }
    });
    return transaction();
  }
  async deleteEntry(id) {
    this.ensureInitialized();
    const transaction = this.db.transaction(() => {
      try {
        this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);
        this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);
        const result = this.db.prepare('DELETE FROM kb_entries WHERE id = ?').run(id);
        this.queryCount++;
        return result.changes > 0;
      } catch (error) {
        this.errorCount++;
        throw new IStorageAdapter_1.QueryError(
          `Failed to delete entry: ${error.message}`,
          'sqlite',
          'DELETE',
          error
        );
      }
    });
    return transaction();
  }
  async createEntries(entries) {
    this.ensureInitialized();
    const transaction = this.db.transaction(() => {
      const ids = [];
      try {
        const entryStmt = this.db.prepare(`
          INSERT INTO kb_entries (
            id, title, problem, solution, category, severity, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
        for (const entry of entries) {
          const id = (0, uuid_1.v4)();
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
        throw new IStorageAdapter_1.QueryError(
          `Failed to create entries: ${error.message}`,
          'sqlite',
          'INSERT BATCH',
          error
        );
      }
    });
    return transaction();
  }
  async readEntries(ids) {
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
        .all(...ids);
      this.queryCount++;
      const entryMap = new Map(entries.map(e => [e.id, this.mapRowToEntry(e)]));
      return ids.map(id => entryMap.get(id) || null);
    } catch (error) {
      this.errorCount++;
      throw new IStorageAdapter_1.QueryError(
        `Failed to read entries: ${error.message}`,
        'sqlite',
        'SELECT BATCH',
        error
      );
    }
  }
  async updateEntries(updates) {
    this.ensureInitialized();
    const transaction = this.db.transaction(() => {
      const results = [];
      try {
        for (const { id, updates: entryUpdates } of updates) {
          const success = this.updateSingleEntryInTransaction(id, entryUpdates);
          results.push(success);
        }
        this.queryCount += updates.length;
        return results;
      } catch (error) {
        this.errorCount++;
        throw new IStorageAdapter_1.QueryError(
          `Failed to update entries: ${error.message}`,
          'sqlite',
          'UPDATE BATCH',
          error
        );
      }
    });
    return transaction();
  }
  async deleteEntries(ids) {
    this.ensureInitialized();
    if (ids.length === 0) return [];
    const transaction = this.db.transaction(() => {
      const results = [];
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
        throw new IStorageAdapter_1.QueryError(
          `Failed to delete entries: ${error.message}`,
          'sqlite',
          'DELETE BATCH',
          error
        );
      }
    });
    return transaction();
  }
  async searchEntries(query, options) {
    this.ensureInitialized();
    try {
      const searchOptions = {
        limit: 10,
        offset: 0,
        sortBy: 'relevance',
        ...options,
      };
      const strategy = this.selectSearchStrategy(query, searchOptions);
      const results = await this.executeSearch(strategy, query, searchOptions);
      this.queryCount++;
      return results;
    } catch (error) {
      this.errorCount++;
      throw new IStorageAdapter_1.QueryError(
        `Failed to search entries: ${error.message}`,
        'sqlite',
        'SEARCH',
        error
      );
    }
  }
  async getPopularEntries(limit = 10) {
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
        .all(limit);
      this.queryCount++;
      return entries.map(entry => ({
        entry: this.mapRowToEntry(entry),
        score: entry.popularity_score || 0,
        matchType: 'popular',
        highlights: [],
      }));
    } catch (error) {
      this.errorCount++;
      throw new IStorageAdapter_1.QueryError(
        `Failed to get popular entries: ${error.message}`,
        'sqlite',
        'SELECT',
        error
      );
    }
  }
  async getRecentEntries(limit = 10) {
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
        .all(limit);
      this.queryCount++;
      return entries.map(entry => ({
        entry: this.mapRowToEntry(entry),
        score: 100,
        matchType: 'recent',
        highlights: [],
      }));
    } catch (error) {
      this.errorCount++;
      throw new IStorageAdapter_1.QueryError(
        `Failed to get recent entries: ${error.message}`,
        'sqlite',
        'SELECT',
        error
      );
    }
  }
  async getSearchSuggestions(query, limit = 5) {
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
        .map(row => row.suggestion);
      this.queryCount++;
      return suggestions;
    } catch (error) {
      this.errorCount++;
      throw new IStorageAdapter_1.QueryError(
        `Failed to get search suggestions: ${error.message}`,
        'sqlite',
        'SELECT',
        error
      );
    }
  }
  async executeSQL(sql, params = []) {
    this.ensureInitialized();
    try {
      let result;
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
      throw new IStorageAdapter_1.QueryError(
        `Failed to execute SQL: ${error.message}`,
        'sqlite',
        sql,
        error
      );
    }
  }
  async beginTransaction() {
    this.ensureInitialized();
    return new SQLiteTransaction(this.db);
  }
  async export(format, options) {
    this.ensureInitialized();
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
  async import(data, format, options) {
    this.ensureInitialized();
    try {
      const importData = JSON.parse(data);
      const entries = importData.entries || [];
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors = [];
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
      throw new IStorageAdapter_1.QueryError(
        `Failed to import data: ${error.message}`,
        'sqlite',
        'IMPORT',
        error
      );
    }
  }
  async getMetrics() {
    this.ensureInitialized();
    try {
      const dbInfo = this.db.prepare('PRAGMA database_list').all();
      const tableInfo = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const indexInfo = this.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
      const pageCount = this.db.pragma('page_count');
      const pageSize = this.db.pragma('page_size');
      const size = pageCount * pageSize;
      return {
        size,
        tableCount: tableInfo.length,
        indexCount: indexInfo.length,
        connectionCount: 1,
        queryCount: this.queryCount,
        averageQueryTime: 0,
      };
    } catch (error) {
      throw new IStorageAdapter_1.QueryError(
        `Failed to get metrics: ${error.message}`,
        'sqlite',
        'PRAGMA',
        error
      );
    }
  }
  async optimize() {
    this.ensureInitialized();
    const startTime = Date.now();
    const optimizations = [];
    try {
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
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
      const performanceImprovement = Math.min(successfulOptimizations * 10, 50);
      return {
        success: optimizations.some(o => o.executed),
        optimizations,
        performanceImprovement,
        duration,
      };
    } catch (error) {
      throw new IStorageAdapter_1.QueryError(
        `Failed to optimize database: ${error.message}`,
        'sqlite',
        'OPTIMIZE',
        error
      );
    }
  }
  async healthCheck() {
    try {
      this.db.prepare('SELECT 1').get();
      const uptime = Date.now() - this.connectionStartTime;
      const errorRate = this.queryCount > 0 ? this.errorCount / this.queryCount : 0;
      const issues = [];
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
          errorRate,
        },
        issues,
      };
    } catch (error) {
      return {
        status: 'critical',
        uptime: Date.now() - this.connectionStartTime,
        connectionCount: 0,
        lastError: error,
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
  async getSchemaInfo() {
    this.ensureInitialized();
    try {
      const tables = await this.getTableInfo();
      const indexes = await this.getIndexInfo();
      return {
        version: '1.0',
        tables,
        indexes,
        triggers: [],
        constraints: [],
      };
    } catch (error) {
      throw new IStorageAdapter_1.QueryError(
        `Failed to get schema info: ${error.message}`,
        'sqlite',
        'SCHEMA',
        error
      );
    }
  }
  getConfig() {
    return { ...this.config };
  }
  async updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (config.pragma) {
      this.applyPragmas();
    }
  }
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new IStorageAdapter_1.ConnectionError('SQLite adapter not initialized', 'sqlite');
    }
  }
  applyPragmas() {
    if (!this.config.pragma) return;
    for (const [key, value] of Object.entries(this.config.pragma)) {
      try {
        this.db.pragma(`${key} = ${value}`);
      } catch (error) {
        console.warn(`Failed to set pragma ${key}:`, error);
      }
    }
  }
  async initializeSchema() {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kb_entries'")
      .get();
    if (!tables) {
      await this.createBaseSchema();
    }
  }
  async createBaseSchema() {
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
  async createIndexes() {
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
  enableQueryMonitoring() {
    if (this.config.performanceTuning.enableQueryPlan) {
      this.db.pragma('query_only = false');
    }
  }
  updateFTSIndex(id, entry) {
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
  updateFTSIndexForUpdate(id, updates) {
    try {
      this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);
      const current = this.db.prepare('SELECT * FROM kb_entries WHERE id = ?').get(id);
      if (!current) return;
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
          .get(id);
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
  mapRowToEntry(row) {
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
  selectSearchStrategy(query, options) {
    if (/^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query)) {
      return 'exact';
    }
    if (query.startsWith('category:') || options.category) {
      return 'category';
    }
    if (query.startsWith('tag:')) {
      return 'tag';
    }
    if (query.length < 4) {
      return 'fuzzy';
    }
    return 'fts';
  }
  async executeSearch(strategy, query, options) {
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
  executeExactSearch(query, options) {
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
      );
    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: 100,
      matchType: 'exact',
      highlights: this.generateHighlights(query, entry),
    }));
  }
  executeFTSSearch(query, options) {
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
      );
    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: Math.abs(entry.relevance_score) * 10,
      matchType: 'fuzzy',
      highlights: this.generateHighlights(query, entry),
    }));
  }
  executeFuzzySearch(query, options) {
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
      );
    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: entry.relevance_score * 20,
      matchType: 'fuzzy',
      highlights: this.generateHighlights(query, entry),
    }));
  }
  executeCategorySearch(query, options) {
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
      .all(category, options.limit || 10, options.offset || 0);
    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: 90,
      matchType: 'category',
      highlights: [],
    }));
  }
  executeTagSearch(query, options) {
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
      );
    return entries.map(entry => ({
      entry: this.mapRowToEntry(entry),
      score: 85,
      matchType: 'tag',
      highlights: [],
    }));
  }
  generateHighlights(query, entry) {
    const highlights = [];
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
        highlights.push(start > 0 ? `...${snippet}` : snippet);
      }
    });
    return highlights.slice(0, 3);
  }
  prepareFTSQuery(query) {
    if (query.startsWith('category:')) {
      return `category:${query.substring(9)}`;
    }
    if (query.startsWith('tag:')) {
      return `tags:${query.substring(4)}`;
    }
    const ftsQuery = query.trim().replace(/['"]/g, '');
    const terms = ftsQuery.split(/\s+/).filter(term => term.length > 1);
    if (terms.length === 0) return ftsQuery;
    if (terms.length > 1) {
      return `"${terms.join(' ')}"`;
    }
    return `${terms[0]}*`;
  }
  updateSingleEntryInTransaction(id, updates) {
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
    if (updates.tags !== undefined) {
      this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);
      if (updates.tags.length > 0) {
        const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
        updates.tags.forEach(tag => {
          tagStmt.run(id, tag.toLowerCase().trim());
        });
      }
    }
    this.updateFTSIndexForUpdate(id, updates);
    return true;
  }
  async getAllEntries(options) {
    let whereClause = 'WHERE e.archived = 0';
    const params = [];
    if (options?.filter?.categories) {
      whereClause += ` AND e.category IN (${options.filter.categories.map(() => '?').join(',')})`;
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
      .all(...params);
    return entries.map(entry => this.mapRowToEntry(entry));
  }
  async getTableInfo() {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    const tableInfos = [];
    for (const table of tables) {
      const columns = this.db.prepare(`PRAGMA table_info(${table.name})`).all();
      const rowCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      const columnInfos = columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        defaultValue: col.dflt_value,
        isPrimaryKey: Boolean(col.pk),
        isForeignKey: false,
      }));
      tableInfos.push({
        name: table.name,
        columns: columnInfos,
        rowCount: rowCount.count,
        size: 0,
      });
    }
    return tableInfos;
  }
  async getIndexInfo() {
    const indexes = this.db
      .prepare(
        "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
      )
      .all();
    return indexes.map(index => ({
      name: index.name,
      table: index.tbl_name,
      columns: [],
      unique: index.sql.includes('UNIQUE'),
      type: 'btree',
      size: 0,
      usage: {
        scanCount: 0,
        seekCount: 0,
      },
    }));
  }
}
exports.SQLiteAdapter = SQLiteAdapter;
class SQLiteTransaction {
  db;
  transaction;
  active = true;
  constructor(db) {
    this.db = db;
    this.transaction = this.db.transaction(() => {});
  }
  async execute(sql, params = []) {
    if (!this.active) {
      throw new IStorageAdapter_1.TransactionError('Transaction is not active', 'sqlite');
    }
    try {
      const isSelect = sql.trim().toLowerCase().startsWith('select');
      if (isSelect) {
        return this.db.prepare(sql).all(...params);
      } else {
        return this.db.prepare(sql).run(...params);
      }
    } catch (error) {
      throw new IStorageAdapter_1.QueryError(
        `Transaction execute failed: ${error.message}`,
        'sqlite',
        sql,
        error
      );
    }
  }
  async commit() {
    if (!this.active) {
      throw new IStorageAdapter_1.TransactionError('Transaction is not active', 'sqlite');
    }
    try {
      this.transaction();
      this.active = false;
    } catch (error) {
      throw new IStorageAdapter_1.TransactionError(
        `Transaction commit failed: ${error.message}`,
        'sqlite',
        error
      );
    }
  }
  async rollback() {
    if (!this.active) {
      throw new IStorageAdapter_1.TransactionError('Transaction is not active', 'sqlite');
    }
    try {
      this.active = false;
    } catch (error) {
      throw new IStorageAdapter_1.TransactionError(
        `Transaction rollback failed: ${error.message}`,
        'sqlite',
        error
      );
    }
  }
  isActive() {
    return this.active;
  }
}
//# sourceMappingURL=SQLiteAdapter.js.map
