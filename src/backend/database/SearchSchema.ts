/**
 * Search Database Schema - Optimized for Performance
 * Comprehensive schema for search history, metrics, and analytics
 */

import Database from 'better-sqlite3';

/**
 * Advanced Search Database Schema
 * Features:
 * - Optimized indexes for sub-second queries
 * - Materialized views for popular searches
 * - Partitioning strategy for large datasets
 * - Full-text search capabilities
 * - Real-time metrics aggregation
 */
export class SearchSchema {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Initialize complete search schema with performance optimizations
   */
  initialize(): void {
    this.createTables();
    this.createIndexes();
    this.createMaterializedViews();
    this.createTriggers();
    this.optimizeDatabase();
  }

  /**
   * Create all search-related tables
   */
  private createTables(): void {
    // Search History Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        query TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        response_time INTEGER NOT NULL,
        result_count INTEGER NOT NULL DEFAULT 0,
        category TEXT,
        used_ai INTEGER DEFAULT 0,
        fuzzy_threshold REAL DEFAULT 0.7,
        successful INTEGER DEFAULT 1,
        ip_address TEXT,
        user_agent TEXT,
        request_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Search Metrics Table (Real-time aggregation)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timeframe TEXT NOT NULL, -- '5m', '15m', '1h', '1d'
        window_start INTEGER NOT NULL,
        window_end INTEGER NOT NULL,
        total_searches INTEGER DEFAULT 0,
        successful_searches INTEGER DEFAULT 0,
        failed_searches INTEGER DEFAULT 0,
        avg_response_time REAL DEFAULT 0,
        min_response_time INTEGER DEFAULT 0,
        max_response_time INTEGER DEFAULT 0,
        p95_response_time INTEGER DEFAULT 0,
        total_results INTEGER DEFAULT 0,
        ai_searches INTEGER DEFAULT 0,
        cache_hits INTEGER DEFAULT 0,
        cache_misses INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        unique_queries INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Popular Searches Table (Materialized view data)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS popular_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL UNIQUE,
        search_count INTEGER DEFAULT 1,
        success_rate REAL DEFAULT 1.0,
        avg_response_time REAL DEFAULT 0,
        avg_results REAL DEFAULT 0,
        last_searched INTEGER,
        first_searched INTEGER,
        category TEXT,
        trending_score REAL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Search Suggestions Table (Autocomplete)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('query', 'category', 'tag', 'title')),
        frequency INTEGER DEFAULT 1,
        category TEXT,
        source TEXT, -- 'user', 'system', 'ai'
        relevance_score REAL DEFAULT 1.0,
        last_used INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(text, type, category)
      )
    `);

    // Search Performance Log (Detailed monitoring)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_performance_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        operation TEXT NOT NULL, -- 'search', 'autocomplete', 'history', 'metrics'
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        duration INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'timeout'
        error_message TEXT,
        cache_layer TEXT, -- 'L0', 'L1', 'L2', 'miss'
        result_count INTEGER,
        query_length INTEGER,
        user_id TEXT,
        memory_usage INTEGER,
        cpu_usage REAL
      )
    `);

    // Query Analytics Table (Advanced analytics)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL, -- YYYY-MM-DD format
        hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
        query_pattern TEXT NOT NULL,
        category TEXT,
        search_count INTEGER DEFAULT 1,
        success_count INTEGER DEFAULT 0,
        total_response_time INTEGER DEFAULT 0,
        total_results INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(date, hour, query_pattern, category)
      )
    `);

    // User Search Patterns Table (Personalization)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_search_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        query_hash TEXT NOT NULL, -- Hash of normalized query
        search_count INTEGER DEFAULT 1,
        last_searched INTEGER NOT NULL,
        preferred_categories TEXT, -- JSON array
        avg_session_length REAL DEFAULT 0,
        success_rate REAL DEFAULT 1.0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(user_id, query_hash)
      )
    `);
  }

  /**
   * Create high-performance indexes
   */
  private createIndexes(): void {
    // Search History Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_history_timestamp
      ON search_history(timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_search_history_user_timestamp
      ON search_history(user_id, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_search_history_query
      ON search_history(query);

      CREATE INDEX IF NOT EXISTS idx_search_history_category_timestamp
      ON search_history(category, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_search_history_session
      ON search_history(session_id, timestamp);

      CREATE INDEX IF NOT EXISTS idx_search_history_successful_timestamp
      ON search_history(successful, timestamp DESC);
    `);

    // Search Metrics Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_metrics_timeframe_window
      ON search_metrics(timeframe, window_start, window_end);

      CREATE INDEX IF NOT EXISTS idx_search_metrics_window_start
      ON search_metrics(window_start DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_search_metrics_unique_window
      ON search_metrics(timeframe, window_start);
    `);

    // Popular Searches Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_popular_searches_count
      ON popular_searches(search_count DESC);

      CREATE INDEX IF NOT EXISTS idx_popular_searches_trending
      ON popular_searches(trending_score DESC);

      CREATE INDEX IF NOT EXISTS idx_popular_searches_category
      ON popular_searches(category, search_count DESC);

      CREATE INDEX IF NOT EXISTS idx_popular_searches_last_searched
      ON popular_searches(last_searched DESC);
    `);

    // Search Suggestions Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_suggestions_text
      ON search_suggestions(text);

      CREATE INDEX IF NOT EXISTS idx_search_suggestions_type_frequency
      ON search_suggestions(type, frequency DESC);

      CREATE INDEX IF NOT EXISTS idx_search_suggestions_category_frequency
      ON search_suggestions(category, frequency DESC);

      CREATE INDEX IF NOT EXISTS idx_search_suggestions_relevance
      ON search_suggestions(relevance_score DESC);
    `);

    // Performance Log Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_search_performance_timestamp
      ON search_performance_log(timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_search_performance_operation_timestamp
      ON search_performance_log(operation, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_search_performance_status
      ON search_performance_log(status, timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_search_performance_request_id
      ON search_performance_log(request_id);
    `);

    // Query Analytics Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_query_analytics_date_hour
      ON query_analytics(date DESC, hour DESC);

      CREATE INDEX IF NOT EXISTS idx_query_analytics_pattern
      ON query_analytics(query_pattern, date DESC);

      CREATE INDEX IF NOT EXISTS idx_query_analytics_category_date
      ON query_analytics(category, date DESC);
    `);

    // User Patterns Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_search_patterns_user_id
      ON user_search_patterns(user_id, last_searched DESC);

      CREATE INDEX IF NOT EXISTS idx_user_search_patterns_success_rate
      ON user_search_patterns(user_id, success_rate DESC);
    `);

    // Full-text search indexes (if SQLite supports FTS5)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_history_fts USING fts5(
        query,
        category,
        user_id,
        content=search_history,
        content_rowid=rowid
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS popular_searches_fts USING fts5(
        query,
        category,
        content=popular_searches,
        content_rowid=id
      );
    `);
  }

  /**
   * Create materialized views for performance
   */
  private createMaterializedViews(): void {
    // Daily search summary (refreshed periodically)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_search_summary AS
      SELECT
        date(timestamp/1000, 'unixepoch') as search_date,
        COUNT(*) as total_searches,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT query) as unique_queries,
        AVG(response_time) as avg_response_time,
        SUM(CASE WHEN successful = 1 THEN 1 ELSE 0 END) as successful_searches,
        SUM(CASE WHEN used_ai = 1 THEN 1 ELSE 0 END) as ai_searches,
        AVG(result_count) as avg_results,
        COUNT(DISTINCT category) as categories_used
      FROM search_history
      GROUP BY date(timestamp/1000, 'unixepoch')
    `);

    // Hourly performance metrics
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hourly_performance_summary AS
      SELECT
        datetime(timestamp/1000, 'unixepoch', 'start of hour') as hour_start,
        COUNT(*) as total_requests,
        AVG(duration) as avg_duration,
        MIN(duration) as min_duration,
        MAX(duration) as max_duration,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(memory_usage) as avg_memory_usage
      FROM search_performance_log
      GROUP BY datetime(timestamp/1000, 'unixepoch', 'start of hour')
    `);

    // Create indexes for materialized views
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summary_date
      ON daily_search_summary(search_date);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_performance_hour
      ON hourly_performance_summary(hour_start);
    `);
  }

  /**
   * Create triggers for real-time updates
   */
  private createTriggers(): void {
    // Update popular searches on new search history
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_popular_searches_on_insert
      AFTER INSERT ON search_history
      BEGIN
        INSERT OR REPLACE INTO popular_searches (
          query, search_count, success_rate, avg_response_time, avg_results,
          last_searched, first_searched, category, updated_at
        )
        SELECT
          NEW.query,
          COALESCE((SELECT search_count FROM popular_searches WHERE query = NEW.query), 0) + 1,
          (COALESCE((SELECT success_rate * search_count FROM popular_searches WHERE query = NEW.query), 0) + NEW.successful) /
          (COALESCE((SELECT search_count FROM popular_searches WHERE query = NEW.query), 0) + 1),
          (COALESCE((SELECT avg_response_time * search_count FROM popular_searches WHERE query = NEW.query), 0) + NEW.response_time) /
          (COALESCE((SELECT search_count FROM popular_searches WHERE query = NEW.query), 0) + 1),
          (COALESCE((SELECT avg_results * search_count FROM popular_searches WHERE query = NEW.query), 0) + NEW.result_count) /
          (COALESCE((SELECT search_count FROM popular_searches WHERE query = NEW.query), 0) + 1),
          NEW.timestamp,
          COALESCE((SELECT first_searched FROM popular_searches WHERE query = NEW.query), NEW.timestamp),
          NEW.category,
          strftime('%s', 'now') * 1000;
      END;
    `);

    // Update search suggestions frequency
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_suggestions_frequency
      AFTER INSERT ON search_history
      BEGIN
        INSERT OR IGNORE INTO search_suggestions (text, type, frequency, last_used, category, source)
        VALUES (NEW.query, 'query', 1, NEW.timestamp, NEW.category, 'user');

        UPDATE search_suggestions
        SET frequency = frequency + 1, last_used = NEW.timestamp, updated_at = strftime('%s', 'now') * 1000
        WHERE text = NEW.query AND type = 'query';
      END;
    `);

    // Update FTS indexes
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS search_history_fts_insert
      AFTER INSERT ON search_history
      BEGIN
        INSERT INTO search_history_fts(rowid, query, category, user_id)
        VALUES (NEW.rowid, NEW.query, NEW.category, NEW.user_id);
      END;

      CREATE TRIGGER IF NOT EXISTS search_history_fts_delete
      AFTER DELETE ON search_history
      BEGIN
        DELETE FROM search_history_fts WHERE rowid = OLD.rowid;
      END;
    `);

    // Update trending scores (calculated based on recent activity)
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_trending_scores
      AFTER INSERT ON search_history
      WHEN NEW.timestamp > (strftime('%s', 'now') - 3600) * 1000 -- Last hour
      BEGIN
        UPDATE popular_searches
        SET trending_score = CASE
          WHEN last_searched > (strftime('%s', 'now') - 3600) * 1000
          THEN search_count * 0.1 + (search_count / (strftime('%s', 'now') * 1000 - first_searched + 1)) * 100000
          ELSE trending_score * 0.9
        END,
        updated_at = strftime('%s', 'now') * 1000
        WHERE query = NEW.query;
      END;
    `);
  }

  /**
   * Optimize database for performance
   */
  private optimizeDatabase(): void {
    // Set pragmas for optimal performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB memory map
    this.db.pragma('optimize');

    // Analyze tables for query optimization
    this.db.exec('ANALYZE');

    console.log('Search database schema initialized with performance optimizations');
  }

  /**
   * Refresh materialized views (call periodically)
   */
  refreshMaterializedViews(): void {
    const transaction = this.db.transaction(() => {
      // Refresh daily summary
      this.db.exec('DELETE FROM daily_search_summary');
      this.db.exec(`
        INSERT INTO daily_search_summary
        SELECT
          date(timestamp/1000, 'unixepoch') as search_date,
          COUNT(*) as total_searches,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT query) as unique_queries,
          AVG(response_time) as avg_response_time,
          SUM(CASE WHEN successful = 1 THEN 1 ELSE 0 END) as successful_searches,
          SUM(CASE WHEN used_ai = 1 THEN 1 ELSE 0 END) as ai_searches,
          AVG(result_count) as avg_results,
          COUNT(DISTINCT category) as categories_used
        FROM search_history
        GROUP BY date(timestamp/1000, 'unixepoch')
      `);

      // Refresh hourly performance summary
      this.db.exec('DELETE FROM hourly_performance_summary');
      this.db.exec(`
        INSERT INTO hourly_performance_summary
        SELECT
          datetime(timestamp/1000, 'unixepoch', 'start of hour') as hour_start,
          COUNT(*) as total_requests,
          AVG(duration) as avg_duration,
          MIN(duration) as min_duration,
          MAX(duration) as max_duration,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_requests,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(memory_usage) as avg_memory_usage
        FROM search_performance_log
        GROUP BY datetime(timestamp/1000, 'unixepoch', 'start of hour')
      `);
    });

    transaction();
    console.log('Materialized views refreshed');
  }

  /**
   * Clean up old data (call periodically)
   */
  cleanup(retentionDays: number = 90): void {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const transaction = this.db.transaction(() => {
      // Clean old search history
      const historyResult = this.db
        .prepare(
          `
        DELETE FROM search_history WHERE timestamp < ?
      `
        )
        .run(cutoffTime);

      // Clean old performance logs
      const perfResult = this.db
        .prepare(
          `
        DELETE FROM search_performance_log WHERE timestamp < ?
      `
        )
        .run(cutoffTime);

      // Clean old metrics (keep daily aggregates longer)
      const metricsResult = this.db
        .prepare(
          `
        DELETE FROM search_metrics
        WHERE window_start < ? AND timeframe IN ('5m', '15m')
      `
        )
        .run(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days for fine-grained metrics

      console.log(
        `Cleanup completed: ${historyResult.changes} history entries, ${perfResult.changes} performance logs, ${metricsResult.changes} metrics removed`
      );
    });

    transaction();

    // Vacuum database to reclaim space
    this.db.exec('VACUUM');
  }
}

/**
 * Prepared statements for common queries (performance optimization)
 */
export class SearchQueryBuilder {
  private db: Database.Database;

  // Prepared statements
  public insertSearchHistory: Database.Statement;
  public getSearchHistory: Database.Statement;
  public getPopularSearches: Database.Statement;
  public getSuggestions: Database.Statement;
  public insertPerformanceLog: Database.Statement;
  public getMetricsSummary: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.prepareStatements();
  }

  private prepareStatements(): void {
    this.insertSearchHistory = this.db.prepare(`
      INSERT INTO search_history (
        query, user_id, session_id, response_time, result_count,
        category, used_ai, fuzzy_threshold, successful, ip_address,
        user_agent, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getSearchHistory = this.db.prepare(`
      SELECT * FROM search_history
      WHERE (? IS NULL OR user_id = ?)
      AND timestamp > ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    this.getPopularSearches = this.db.prepare(`
      SELECT * FROM popular_searches
      WHERE (? IS NULL OR category = ?)
      ORDER BY search_count DESC
      LIMIT ?
    `);

    this.getSuggestions = this.db.prepare(`
      SELECT * FROM search_suggestions
      WHERE text LIKE ? || '%'
      AND (? IS NULL OR type = ?)
      AND (? IS NULL OR category = ?)
      ORDER BY frequency DESC, relevance_score DESC
      LIMIT ?
    `);

    this.insertPerformanceLog = this.db.prepare(`
      INSERT INTO search_performance_log (
        request_id, operation, duration, status, error_message,
        cache_layer, result_count, query_length, user_id,
        memory_usage, cpu_usage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getMetricsSummary = this.db.prepare(`
      SELECT
        timeframe,
        window_start,
        total_searches,
        successful_searches,
        avg_response_time,
        p95_response_time,
        ai_searches,
        cache_hits,
        unique_users
      FROM search_metrics
      WHERE timeframe = ?
      AND window_start >= ?
      AND window_end <= ?
      ORDER BY window_start ASC
    `);
  }
}
