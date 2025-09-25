'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PostgreSQLMigration = void 0;
const tslib_1 = require('tslib');
const better_sqlite3_1 = tslib_1.__importDefault(require('better-sqlite3'));
const pg_1 = require('pg');
class PostgreSQLMigration {
  sqliteDB;
  pgPool;
  config;
  stats;
  constructor(config) {
    this.config = config;
    this.sqliteDB = new better_sqlite3_1.default(config.sourceDB);
    const poolConfig = {
      host: config.targetDB.host,
      port: config.targetDB.port,
      database: config.targetDB.database,
      user: config.targetDB.username,
      password: config.targetDB.password,
      ssl: config.targetDB.ssl ? { rejectUnauthorized: false } : false,
      max: config.parallelWorkers * 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
    this.pgPool = new pg_1.Pool(poolConfig);
    this.stats = {
      startTime: Date.now(),
      tablesProcessed: 0,
      recordsMigrated: 0,
      errorCount: 0,
      performanceComparison: {
        sqlite: {},
        postgresql: {},
      },
    };
  }
  async migrate() {
    console.log('🚀 Starting PostgreSQL migration...');
    try {
      await this.performPreMigrationChecks();
      await this.createPostgreSQLSchema();
      await this.migrateDataPhased();
      if (this.config.validateData) {
        await this.validateMigration();
      }
      await this.performPerformanceComparison();
      await this.optimizePostgreSQL();
      this.stats.endTime = Date.now();
      console.log('✅ Migration completed successfully!');
      return this.stats;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      if (this.config.rollbackOnError) {
        await this.rollback();
      }
      throw error;
    }
  }
  async performPreMigrationChecks() {
    console.log('🔍 Performing pre-migration checks...');
    const client = await this.pgPool.connect();
    try {
      await client.query('SELECT version()');
      console.log('✅ PostgreSQL connection successful');
    } finally {
      client.release();
    }
    const integrityCheck = this.sqliteDB.pragma('integrity_check', { simple: true });
    if (integrityCheck !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${integrityCheck}`);
    }
    console.log('✅ SQLite integrity check passed');
    const parityChecks = await this.checkFeatureParity();
    const incompatibleFeatures = parityChecks.filter(check => !check.compatible);
    if (incompatibleFeatures.length > 0) {
      console.warn('⚠️ Incompatible features detected:');
      incompatibleFeatures.forEach(feature => {
        console.warn(`  - ${feature.feature}: ${feature.notes}`);
      });
    }
    console.log('✅ Pre-migration checks completed');
  }
  async createPostgreSQLSchema() {
    console.log('🏗️ Creating PostgreSQL schema...');
    const schemaSQL = await this.generatePostgreSQLSchema();
    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        DROP SCHEMA IF EXISTS knowledge_base CASCADE;
        CREATE SCHEMA knowledge_base;
        SET search_path TO knowledge_base, public;
      `);
      await client.query(schemaSQL);
      await client.query('COMMIT');
      console.log('✅ PostgreSQL schema created');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async generatePostgreSQLSchema() {
    return `
      -- Enable required extensions
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pg_trgm";
      CREATE EXTENSION IF NOT EXISTS "unaccent";
      
      -- Schema version tracking
      CREATE TABLE schema_versions (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        description TEXT,
        rollback_sql TEXT
      );
      
      -- Main knowledge base entries with PostgreSQL optimizations
      CREATE TABLE kb_entries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Other')),
        severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by TEXT DEFAULT 'system',
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_used TIMESTAMP WITH TIME ZONE,
        archived BOOLEAN DEFAULT FALSE,
        checksum TEXT,
        -- PostgreSQL specific optimizations
        search_vector tsvector,
        content_length INTEGER GENERATED ALWAYS AS (length(problem) + length(solution)) STORED,
        success_rate NUMERIC(5,4) GENERATED ALWAYS AS (
          CASE WHEN (success_count + failure_count) > 0 
          THEN success_count::numeric / (success_count + failure_count)
          ELSE 0 END
        ) STORED
      );
      
      -- Tags table with better normalization
      CREATE TABLE kb_tags (
        id SERIAL PRIMARY KEY,
        entry_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(entry_id, tag)
      );
      
      -- Relations with foreign key constraints
      CREATE TABLE kb_relations (
        id SERIAL PRIMARY KEY,
        source_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
        target_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
        relation_type TEXT DEFAULT 'related' CHECK(relation_type IN ('related', 'duplicate', 'superseded', 'prerequisite')),
        strength NUMERIC(3,2) DEFAULT 0.5 CHECK(strength >= 0 AND strength <= 1),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(source_id, target_id)
      );
      
      -- Search history with partitioning
      CREATE TABLE search_history (
        id BIGSERIAL,
        query TEXT NOT NULL,
        query_type TEXT DEFAULT 'text' CHECK(query_type IN ('text', 'category', 'tag', 'ai')),
        results_count INTEGER DEFAULT 0,
        selected_entry_id UUID REFERENCES kb_entries(id),
        search_time_ms INTEGER,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_id TEXT DEFAULT 'anonymous',
        session_id TEXT
      ) PARTITION BY RANGE (timestamp);
      
      -- Usage metrics with partitioning
      CREATE TABLE usage_metrics (
        id BIGSERIAL,
        entry_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure', 'export', 'edit')),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_id TEXT DEFAULT 'anonymous',
        session_id TEXT,
        metadata JSONB
      ) PARTITION BY RANGE (timestamp);
      
      -- System configuration
      CREATE TABLE system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        type TEXT DEFAULT 'string' CHECK(type IN ('string', 'integer', 'float', 'boolean', 'json')),
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Backup metadata
      CREATE TABLE backup_log (
        id SERIAL PRIMARY KEY,
        backup_path TEXT NOT NULL,
        backup_type TEXT DEFAULT 'manual' CHECK(backup_type IN ('manual', 'auto', 'migration')),
        file_size BIGINT,
        entries_count INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum TEXT,
        status TEXT DEFAULT 'completed' CHECK(status IN ('in_progress', 'completed', 'failed'))
      );
      
      -- Error log
      CREATE TABLE error_log (
        id BIGSERIAL PRIMARY KEY,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        stack_trace TEXT,
        context JSONB,
        severity TEXT DEFAULT 'error' CHECK(severity IN ('debug', 'info', 'warning', 'error', 'critical')),
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- === INDEXES FOR PERFORMANCE ===
      
      -- Primary performance indexes
      CREATE INDEX idx_kb_category ON kb_entries(category, archived) WHERE archived = FALSE;
      CREATE INDEX idx_kb_usage_count ON kb_entries(usage_count DESC, success_count DESC) WHERE archived = FALSE;
      CREATE INDEX idx_kb_success_rate ON kb_entries(success_rate DESC, usage_count DESC) WHERE archived = FALSE;
      CREATE INDEX idx_kb_created_at ON kb_entries(created_at DESC);
      CREATE INDEX idx_kb_last_used ON kb_entries(last_used DESC) WHERE last_used IS NOT NULL;
      CREATE INDEX idx_kb_severity ON kb_entries(severity, category) WHERE archived = FALSE;
      
      -- Full-text search indexes
      CREATE INDEX idx_kb_search_vector ON kb_entries USING gin(search_vector);
      CREATE INDEX idx_kb_title_trgm ON kb_entries USING gin(title gin_trgm_ops);
      CREATE INDEX idx_kb_problem_trgm ON kb_entries USING gin(problem gin_trgm_ops);
      
      -- Tag indexes
      CREATE INDEX idx_tags_tag ON kb_tags(tag);
      CREATE INDEX idx_tags_entry ON kb_tags(entry_id);
      CREATE INDEX idx_tags_tag_trgm ON kb_tags USING gin(tag gin_trgm_ops);
      
      -- Composite indexes for common patterns
      CREATE INDEX idx_kb_category_usage ON kb_entries(category, usage_count DESC, success_rate DESC) WHERE archived = FALSE;
      CREATE INDEX idx_kb_recent_popular ON kb_entries(last_used DESC, usage_count DESC) WHERE archived = FALSE AND last_used IS NOT NULL;
      
      -- Partial indexes for frequent queries
      CREATE INDEX idx_kb_high_usage ON kb_entries(id, title, category) WHERE usage_count > 10 AND archived = FALSE;
      CREATE INDEX idx_kb_recent_entries ON kb_entries(id, title, created_at) WHERE created_at > NOW() - INTERVAL '30 days' AND archived = FALSE;
      
      -- === TRIGGERS FOR AUTOMATION ===
      
      -- Update search vector
      CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english', 
          COALESCE(NEW.title, '') || ' ' || 
          COALESCE(NEW.problem, '') || ' ' || 
          COALESCE(NEW.solution, '') || ' ' ||
          COALESCE((SELECT string_agg(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), '')
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER trigger_update_search_vector
        BEFORE INSERT OR UPDATE ON kb_entries
        FOR EACH ROW EXECUTE FUNCTION update_search_vector();
      
      -- Update timestamp trigger
      CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER trigger_update_timestamp
        BEFORE UPDATE ON kb_entries
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      
      -- === PARTITIONING SETUP ===
      
      -- Create monthly partitions for search_history
      CREATE TABLE search_history_default PARTITION OF search_history DEFAULT;
      
      -- Create monthly partitions for usage_metrics
      CREATE TABLE usage_metrics_default PARTITION OF usage_metrics DEFAULT;
      
      -- === PERFORMANCE VIEWS ===
      
      CREATE VIEW v_entry_stats AS
      SELECT 
        e.id,
        e.title,
        e.category,
        e.usage_count,
        e.success_count,
        e.failure_count,
        e.success_rate,
        e.last_used,
        string_agg(t.tag, ', ' ORDER BY t.tag) as tags,
        COUNT(r.target_id) as related_count
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      LEFT JOIN kb_relations r ON e.id = r.source_id
      WHERE e.archived = FALSE
      GROUP BY e.id, e.title, e.category, e.usage_count, e.success_count, e.failure_count, e.success_rate, e.last_used;
      
      CREATE VIEW v_category_metrics AS
      SELECT 
        category,
        COUNT(*) as total_entries,
        SUM(usage_count) as total_usage,
        AVG(success_rate) as avg_success_rate,
        COUNT(*) FILTER (WHERE last_used > NOW() - INTERVAL '7 days') as recent_usage
      FROM kb_entries
      WHERE archived = FALSE
      GROUP BY category;
      
      -- === INITIAL CONFIGURATION ===
      
      INSERT INTO schema_versions (version, description) VALUES (1, 'Initial PostgreSQL schema');
      
      INSERT INTO system_config (key, value, type, description) VALUES
      ('search_timeout_ms', '1000', 'integer', 'Maximum search time in milliseconds'),
      ('max_search_results', '50', 'integer', 'Maximum number of search results to return'),
      ('auto_backup_enabled', 'true', 'boolean', 'Enable automatic backups'),
      ('auto_backup_interval_hours', '24', 'integer', 'Automatic backup interval in hours'),
      ('usage_analytics_enabled', 'true', 'boolean', 'Enable usage analytics collection'),
      ('max_search_history', '100000', 'integer', 'Maximum search history entries to keep'),
      ('vacuum_schedule', 'daily', 'string', 'Database vacuum schedule');
      
      -- Analyze for query optimization
      ANALYZE;
    `;
  }
  async migrateDataPhased() {
    console.log('📊 Starting phased data migration...');
    const tables = [
      { name: 'kb_entries', priority: 1, hasLargeBLOBs: true },
      { name: 'kb_tags', priority: 2, references: ['kb_entries'] },
      { name: 'kb_relations', priority: 3, references: ['kb_entries'] },
      { name: 'search_history', priority: 4, hasTimePartitions: true },
      { name: 'usage_metrics', priority: 5, hasTimePartitions: true },
      { name: 'system_config', priority: 6 },
      { name: 'backup_log', priority: 7 },
      { name: 'error_log', priority: 8 },
    ];
    tables.sort((a, b) => a.priority - b.priority);
    for (const table of tables) {
      await this.migrateTable(table);
      this.stats.tablesProcessed++;
    }
  }
  async migrateTable(tableConfig) {
    const tableName = tableConfig.name;
    console.log(`📦 Migrating table: ${tableName}`);
    try {
      const countResult = this.sqliteDB.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      const totalRecords = countResult.count;
      if (totalRecords === 0) {
        console.log(`  ✅ Table ${tableName} is empty, skipping`);
        return;
      }
      console.log(`  📊 Migrating ${totalRecords} records from ${tableName}`);
      const columns = this.getTableColumns(tableName);
      const insertSQL = this.generateInsertSQL(tableName, columns);
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        let offset = 0;
        let migratedCount = 0;
        while (offset < totalRecords) {
          const batch = this.sqliteDB
            .prepare(
              `
            SELECT * FROM ${tableName} 
            ORDER BY rowid 
            LIMIT ? OFFSET ?
          `
            )
            .all(this.config.batchSize, offset);
          if (batch.length === 0) break;
          for (const record of batch) {
            const transformedRecord = this.transformRecord(record, tableName);
            const values = columns.map(col => transformedRecord[col]);
            await client.query(insertSQL, values);
            migratedCount++;
          }
          offset += this.config.batchSize;
          if (migratedCount % 1000 === 0) {
            console.log(
              `  📈 Progress: ${migratedCount}/${totalRecords} (${Math.round((migratedCount / totalRecords) * 100)}%)`
            );
          }
        }
        await client.query('COMMIT');
        console.log(`  ✅ Migrated ${migratedCount} records from ${tableName}`);
        this.stats.recordsMigrated += migratedCount;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`❌ Failed to migrate table ${tableName}:`, error);
      this.stats.errorCount++;
      throw error;
    }
  }
  async validateMigration() {
    console.log('🔍 Validating migration...');
    const client = await this.pgPool.connect();
    try {
      const tables = ['kb_entries', 'kb_tags', 'kb_relations', 'search_history', 'usage_metrics'];
      for (const table of tables) {
        const sqliteCount = this.sqliteDB.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        const pgResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const pgCount = parseInt(pgResult.rows[0].count);
        if (sqliteCount.count !== pgCount) {
          throw new Error(
            `Record count mismatch for ${table}: SQLite=${sqliteCount.count}, PostgreSQL=${pgCount}`
          );
        }
        console.log(`  ✅ ${table}: ${pgCount} records match`);
      }
      await this.validateSampleData(client);
      console.log('✅ Migration validation passed');
    } finally {
      client.release();
    }
  }
  async performPerformanceComparison() {
    console.log('🏃 Performing performance comparison...');
    const testQueries = [
      {
        name: 'simple_select',
        sql: 'SELECT COUNT(*) FROM kb_entries WHERE archived = false',
      },
      {
        name: 'text_search',
        sql: "SELECT id, title FROM kb_entries WHERE title LIKE '%VSAM%' LIMIT 10",
      },
      {
        name: 'category_filter',
        sql: "SELECT id, title, usage_count FROM kb_entries WHERE category = 'JCL' ORDER BY usage_count DESC LIMIT 20",
      },
      {
        name: 'join_query',
        sql: `SELECT e.id, e.title, string_agg(t.tag, ', ') as tags 
              FROM kb_entries e 
              LEFT JOIN kb_tags t ON e.id = t.entry_id 
              WHERE e.archived = false 
              GROUP BY e.id, e.title 
              LIMIT 20`,
      },
      {
        name: 'aggregate_query',
        sql: `SELECT category, COUNT(*) as count, AVG(usage_count) as avg_usage 
              FROM kb_entries 
              WHERE archived = false 
              GROUP BY category`,
      },
    ];
    for (const query of testQueries) {
      const times = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        this.sqliteDB.prepare(query.sql).all();
        times.push(Date.now() - start);
      }
      this.stats.performanceComparison.sqlite[query.name] = Math.round(
        times.reduce((a, b) => a + b) / times.length
      );
    }
    const client = await this.pgPool.connect();
    try {
      for (const query of testQueries) {
        const times = [];
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          await client.query(query.sql);
          times.push(Date.now() - start);
        }
        this.stats.performanceComparison.postgresql[query.name] = Math.round(
          times.reduce((a, b) => a + b) / times.length
        );
      }
    } finally {
      client.release();
    }
    console.log('📊 Performance Comparison (avg ms):');
    for (const query of testQueries) {
      const sqliteTime = this.stats.performanceComparison.sqlite[query.name];
      const pgTime = this.stats.performanceComparison.postgresql[query.name];
      const improvement = (((sqliteTime - pgTime) / sqliteTime) * 100).toFixed(1);
      console.log(
        `  ${query.name}: SQLite=${sqliteTime}ms, PostgreSQL=${pgTime}ms (${improvement}% change)`
      );
    }
  }
  async optimizePostgreSQL() {
    console.log('⚡ Optimizing PostgreSQL...');
    const client = await this.pgPool.connect();
    try {
      await client.query('ANALYZE');
      await this.createDataDrivenIndexes(client);
      await this.setupPostgreSQLMaintenance(client);
      console.log('✅ PostgreSQL optimization completed');
    } finally {
      client.release();
    }
  }
  async checkFeatureParity() {
    return [
      {
        feature: 'Full-text search',
        sqlite: true,
        postgresql: true,
        compatible: true,
        notes: 'PostgreSQL uses tsvector, similar functionality',
      },
      {
        feature: 'JSON support',
        sqlite: true,
        postgresql: true,
        compatible: true,
        notes: 'PostgreSQL has superior JSONB support',
      },
      {
        feature: 'Triggers',
        sqlite: true,
        postgresql: true,
        compatible: true,
      },
      {
        feature: 'Views',
        sqlite: true,
        postgresql: true,
        compatible: true,
      },
      {
        feature: 'Transactions',
        sqlite: true,
        postgresql: true,
        compatible: true,
      },
      {
        feature: 'Foreign keys',
        sqlite: true,
        postgresql: true,
        compatible: true,
      },
      {
        feature: 'Check constraints',
        sqlite: true,
        postgresql: true,
        compatible: true,
      },
      {
        feature: 'Generated columns',
        sqlite: true,
        postgresql: true,
        compatible: true,
        notes: 'Syntax differences but same functionality',
      },
    ];
  }
  getTableColumns(tableName) {
    const result = this.sqliteDB.prepare(`PRAGMA table_info(${tableName})`).all();
    return result.map(col => col.name);
  }
  generateInsertSQL(tableName, columns) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  }
  transformRecord(record, tableName) {
    const transformed = { ...record };
    if (tableName === 'kb_entries' && record.id) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id)) {
        transformed.id = this.generateUUID();
      }
    }
    ['archived'].forEach(col => {
      if (transformed[col] !== undefined) {
        transformed[col] = Boolean(transformed[col]);
      }
    });
    ['created_at', 'updated_at', 'last_used', 'timestamp'].forEach(col => {
      if (transformed[col]) {
        transformed[col] = new Date(transformed[col]).toISOString();
      }
    });
    return transformed;
  }
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  async validateSampleData(client) {
    const sampleEntries = this.sqliteDB
      .prepare(
        `
      SELECT id, title, problem, solution, category 
      FROM kb_entries 
      ORDER BY RANDOM() 
      LIMIT 10
    `
      )
      .all();
    for (const entry of sampleEntries) {
      const pgResult = await client.query(
        'SELECT title, problem, solution, category FROM kb_entries WHERE id = $1',
        [entry.id]
      );
      if (pgResult.rows.length === 0) {
        throw new Error(`Entry ${entry.id} not found in PostgreSQL`);
      }
      const pgEntry = pgResult.rows[0];
      if (pgEntry.title !== entry.title || pgEntry.category !== entry.category) {
        throw new Error(`Data mismatch for entry ${entry.id}`);
      }
    }
  }
  async createDataDrivenIndexes(client) {
    const frequentTerms = await client.query(`
      SELECT query, COUNT(*) as frequency
      FROM search_history
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY query
      HAVING COUNT(*) > 10
      ORDER BY frequency DESC
      LIMIT 10
    `);
    const categoryDistribution = await client.query(`
      SELECT category, COUNT(*) as count
      FROM kb_entries
      GROUP BY category
      HAVING COUNT(*) > 100
    `);
    for (const cat of categoryDistribution.rows) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_kb_${cat.category.toLowerCase()}_specific
        ON kb_entries(usage_count DESC, success_rate DESC)
        WHERE category = '${cat.category}' AND archived = false
      `);
    }
  }
  async setupPostgreSQLMaintenance(client) {
    await client.query(`
      INSERT INTO system_config (key, value, type, description) VALUES
      ('pg_auto_vacuum', 'true', 'boolean', 'Enable automatic vacuum'),
      ('pg_analyze_schedule', 'daily', 'string', 'Statistics update schedule'),
      ('pg_partition_management', 'true', 'boolean', 'Enable automatic partition management')
      ON CONFLICT (key) DO NOTHING
    `);
  }
  async rollback() {
    console.log('🔄 Rolling back migration...');
    const client = await this.pgPool.connect();
    try {
      await client.query('DROP SCHEMA IF EXISTS knowledge_base CASCADE');
      console.log('✅ Rollback completed');
    } finally {
      client.release();
    }
  }
  async close() {
    this.sqliteDB.close();
    await this.pgPool.end();
  }
}
exports.PostgreSQLMigration = PostgreSQLMigration;
//# sourceMappingURL=PostgreSQLMigration.js.map
