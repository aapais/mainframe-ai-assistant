-- KB Listing Optimization Migration
-- Adds indexes, tables, and optimizations specifically for advanced listing functionality
-- Migration Version: 20250114_001

-- ================================
-- SAVED SEARCHES TABLE
-- ================================

CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    query_json TEXT NOT NULL,
    user_id TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    tags_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    last_used DATETIME,
    shortcut TEXT UNIQUE,

    CONSTRAINT chk_query_json_valid CHECK (json_valid(query_json)),
    CONSTRAINT chk_tags_json_valid CHECK (json_valid(tags_json))
);

-- ================================
-- ENHANCED USAGE METRICS
-- ================================

-- Add new columns to usage_metrics if they don't exist
ALTER TABLE usage_metrics ADD COLUMN session_id TEXT;
ALTER TABLE usage_metrics ADD COLUMN search_query TEXT;
ALTER TABLE usage_metrics ADD COLUMN filter_context TEXT;
ALTER TABLE usage_metrics ADD COLUMN response_time_ms INTEGER;

-- ================================
-- LISTING PERFORMANCE INDEXES
-- ================================

-- Primary listing index (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_kb_entries_listing_primary
ON kb_entries (archived, category, updated_at DESC, created_at DESC);

-- Multi-column sorting optimization
CREATE INDEX IF NOT EXISTS idx_kb_entries_usage_stats
ON kb_entries (usage_count DESC, success_count, failure_count, last_used DESC);

-- Comprehensive timestamp index
CREATE INDEX IF NOT EXISTS idx_kb_entries_timestamps
ON kb_entries (updated_at DESC, created_at DESC, last_used DESC);

-- Category and severity filtering
CREATE INDEX IF NOT EXISTS idx_kb_entries_categories
ON kb_entries (category, severity, archived);

-- Success rate calculation optimization
CREATE INDEX IF NOT EXISTS idx_kb_entries_success_calc
ON kb_entries (success_count, failure_count, usage_count);

-- Search field optimization
CREATE INDEX IF NOT EXISTS idx_kb_entries_search_text
ON kb_entries (category, archived, title, created_at);

-- ================================
-- TAG SYSTEM OPTIMIZATION
-- ================================

-- Tag lookup optimization
CREATE INDEX IF NOT EXISTS idx_kb_tags_lookup
ON kb_tags (tag, entry_id);

-- Entry to tags mapping
CREATE INDEX IF NOT EXISTS idx_kb_tags_entry_mapping
ON kb_tags (entry_id, tag);

-- Tag popularity analysis
CREATE INDEX IF NOT EXISTS idx_kb_tags_popularity
ON kb_tags (tag);

-- ================================
-- USAGE METRICS OPTIMIZATION
-- ================================

-- Usage analysis by entry
CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry_analysis
ON usage_metrics (entry_id, timestamp DESC, action);

-- Time-based usage patterns
CREATE INDEX IF NOT EXISTS idx_usage_metrics_timeline
ON usage_metrics (timestamp DESC, action, entry_id);

-- Session-based analysis
CREATE INDEX IF NOT EXISTS idx_usage_metrics_sessions
ON usage_metrics (session_id, timestamp, user_id);

-- Search performance tracking
CREATE INDEX IF NOT EXISTS idx_usage_metrics_search
ON usage_metrics (search_query, response_time_ms, timestamp);

-- ================================
-- SAVED SEARCHES OPTIMIZATION
-- ================================

-- User searches lookup
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_lookup
ON saved_searches (user_id, is_public, updated_at DESC);

-- Public searches access
CREATE INDEX IF NOT EXISTS idx_saved_searches_public
ON saved_searches (is_public, usage_count DESC, updated_at DESC);

-- Shortcut access optimization
CREATE INDEX IF NOT EXISTS idx_saved_searches_shortcuts
ON saved_searches (shortcut) WHERE shortcut IS NOT NULL;

-- Tag-based search filtering
CREATE INDEX IF NOT EXISTS idx_saved_searches_tags
ON saved_searches (tags_json) WHERE json_array_length(tags_json) > 0;

-- Usage popularity
CREATE INDEX IF NOT EXISTS idx_saved_searches_usage
ON saved_searches (usage_count DESC, last_used DESC);

-- ================================
-- FULL-TEXT SEARCH OPTIMIZATION
-- ================================

-- Rebuild FTS index with better configuration
DROP TABLE IF EXISTS kb_fts;
CREATE VIRTUAL TABLE kb_fts USING fts5(
    id UNINDEXED,
    title,
    problem,
    solution,
    category,
    tags,
    content='kb_entries',
    content_rowid='rowid',
    tokenize="porter ascii",
    prefix='2,3,4'
);

-- Populate FTS index with current data
INSERT INTO kb_fts(id, title, problem, solution, category, tags)
SELECT
    e.id,
    e.title,
    e.problem,
    e.solution,
    e.category,
    COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags
FROM kb_entries e
LEFT JOIN kb_tags t ON e.id = t.entry_id
GROUP BY e.id;

-- ================================
-- MATERIALIZED VIEWS FOR AGGREGATIONS
-- ================================

-- Category statistics view (updated via triggers)
CREATE TABLE IF NOT EXISTS mv_category_stats (
    category TEXT PRIMARY KEY,
    entry_count INTEGER,
    total_usage INTEGER,
    avg_success_rate REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh category stats
DELETE FROM mv_category_stats;
INSERT INTO mv_category_stats (category, entry_count, total_usage, avg_success_rate)
SELECT
    e.category,
    COUNT(*) as entry_count,
    SUM(e.usage_count) as total_usage,
    AVG(CASE WHEN (e.success_count + e.failure_count) > 0
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END) as avg_success_rate
FROM kb_entries e
WHERE e.archived = FALSE
GROUP BY e.category;

-- Tag popularity view
CREATE TABLE IF NOT EXISTS mv_tag_popularity (
    tag TEXT PRIMARY KEY,
    usage_count INTEGER,
    entry_count INTEGER,
    popularity_score REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tag popularity
DELETE FROM mv_tag_popularity;
INSERT INTO mv_tag_popularity (tag, usage_count, entry_count, popularity_score)
SELECT
    t.tag,
    SUM(e.usage_count) as usage_count,
    COUNT(DISTINCT e.id) as entry_count,
    (COUNT(DISTINCT e.id) * 1.0 + SUM(e.usage_count) * 0.5) as popularity_score
FROM kb_tags t
JOIN kb_entries e ON t.entry_id = e.id
WHERE e.archived = FALSE
GROUP BY t.tag;

-- ================================
-- TRIGGERS FOR MAINTAINING VIEWS
-- ================================

-- Trigger to update category stats when entries change
CREATE TRIGGER IF NOT EXISTS tr_update_category_stats
AFTER UPDATE OF usage_count, success_count, failure_count ON kb_entries
BEGIN
    UPDATE mv_category_stats
    SET
        total_usage = (
            SELECT SUM(usage_count) FROM kb_entries
            WHERE category = NEW.category AND archived = FALSE
        ),
        avg_success_rate = (
            SELECT AVG(CASE WHEN (success_count + failure_count) > 0
                             THEN CAST(success_count AS REAL) / (success_count + failure_count)
                             ELSE 0 END)
            FROM kb_entries
            WHERE category = NEW.category AND archived = FALSE
        ),
        last_updated = CURRENT_TIMESTAMP
    WHERE category = NEW.category;
END;

-- Trigger to update FTS when entries change
CREATE TRIGGER IF NOT EXISTS tr_update_fts_entries
AFTER UPDATE ON kb_entries
BEGIN
    UPDATE kb_fts
    SET title = NEW.title, problem = NEW.problem, solution = NEW.solution, category = NEW.category
    WHERE id = NEW.id;
END;

-- Trigger to update FTS when tags change
CREATE TRIGGER IF NOT EXISTS tr_update_fts_tags
AFTER INSERT ON kb_tags
BEGIN
    UPDATE kb_fts
    SET tags = (
        SELECT GROUP_CONCAT(tag, ' ')
        FROM kb_tags
        WHERE entry_id = NEW.entry_id
    )
    WHERE id = NEW.entry_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_update_fts_tags_delete
AFTER DELETE ON kb_tags
BEGIN
    UPDATE kb_fts
    SET tags = COALESCE((
        SELECT GROUP_CONCAT(tag, ' ')
        FROM kb_tags
        WHERE entry_id = OLD.entry_id
    ), '')
    WHERE id = OLD.entry_id;
END;

-- ================================
-- PERFORMANCE MONITORING TABLES
-- ================================

-- Query performance tracking
CREATE TABLE IF NOT EXISTS query_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_type TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    result_count INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,

    INDEX idx_query_perf_type (query_type, timestamp),
    INDEX idx_query_perf_hash (query_hash),
    INDEX idx_query_perf_time (execution_time_ms DESC, timestamp)
);

-- Index usage statistics
CREATE TABLE IF NOT EXISTS index_usage_stats (
    table_name TEXT,
    index_name TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used DATETIME,
    avg_seek_time_ms REAL,

    PRIMARY KEY (table_name, index_name)
);

-- ================================
-- CACHE OPTIMIZATION TABLES
-- ================================

-- Query result cache
CREATE TABLE IF NOT EXISTS query_cache (
    cache_key TEXT PRIMARY KEY,
    result_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    hit_count INTEGER DEFAULT 0,
    size_bytes INTEGER,

    INDEX idx_cache_expiry (expires_at),
    INDEX idx_cache_hits (hit_count DESC, created_at)
);

-- ================================
-- CONFIGURATION TABLE
-- ================================

-- System configuration for listing behavior
CREATE TABLE IF NOT EXISTS listing_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    config_type TEXT DEFAULT 'string',
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT OR REPLACE INTO listing_config (config_key, config_value, config_type, description)
VALUES
    ('default_page_size', '20', 'integer', 'Default number of items per page'),
    ('max_page_size', '100', 'integer', 'Maximum allowed page size'),
    ('cache_ttl_seconds', '300', 'integer', 'Cache time-to-live in seconds'),
    ('enable_query_cache', 'true', 'boolean', 'Enable query result caching'),
    ('enable_aggregation_cache', 'true', 'boolean', 'Enable aggregation caching'),
    ('slow_query_threshold_ms', '1000', 'integer', 'Threshold for logging slow queries'),
    ('max_filter_complexity', '10', 'integer', 'Maximum number of filters allowed'),
    ('enable_search_suggestions', 'true', 'boolean', 'Enable search auto-suggestions');

-- ================================
-- STATISTICS AND ANALYSIS VIEWS
-- ================================

-- Create view for listing performance analysis
CREATE VIEW IF NOT EXISTS v_listing_performance AS
SELECT
    query_type,
    COUNT(*) as query_count,
    AVG(execution_time_ms) as avg_time,
    MIN(execution_time_ms) as min_time,
    MAX(execution_time_ms) as max_time,
    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as cache_hit_rate,
    AVG(result_count) as avg_results
FROM query_performance
WHERE timestamp >= datetime('now', '-7 days')
GROUP BY query_type;

-- Create view for popular search patterns
CREATE VIEW IF NOT EXISTS v_search_patterns AS
SELECT
    search_query,
    COUNT(*) as search_count,
    AVG(response_time_ms) as avg_response_time,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(timestamp) as last_searched
FROM usage_metrics
WHERE search_query IS NOT NULL
    AND timestamp >= datetime('now', '-30 days')
GROUP BY search_query
ORDER BY search_count DESC;

-- ================================
-- CLEANUP AND MAINTENANCE
-- ================================

-- Schedule automatic cleanup of old performance data
-- (This would typically be handled by application code)

-- Analyze all tables to update statistics
ANALYZE;

-- Vacuum to optimize database structure
-- VACUUM; -- Commented out as it should be run separately

-- ================================
-- MIGRATION COMPLETION LOG
-- ================================

INSERT OR REPLACE INTO system_config (key, value, description)
VALUES (
    'kb_listing_migration_20250114',
    datetime('now'),
    'KB Listing optimization migration completed'
);