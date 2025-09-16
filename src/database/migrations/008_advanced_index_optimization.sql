-- Advanced Index Optimization Migration for Sub-1s Performance
-- Version: 008
-- Implements sophisticated indexing strategies for knowledge base scaling

-- Update schema version
INSERT INTO schema_versions (version, description) VALUES (8, 'Advanced index optimization for sub-1s search performance');

-- ==============================================
-- PHASE 1: COVERING INDEXES FOR ZERO-LOOKUP QUERIES
-- ==============================================

-- Primary search covering index - eliminates table lookups for most queries
CREATE INDEX IF NOT EXISTS idx_kb_search_covering_primary ON kb_entries(
    category,
    usage_count DESC,
    success_count DESC,
    id,
    title,
    problem,
    solution,
    severity,
    last_used,
    created_at
) WHERE archived = FALSE;

-- Success rate covering index for high-performing entries
CREATE INDEX IF NOT EXISTS idx_kb_search_covering_success ON kb_entries(
    (CASE WHEN (success_count + failure_count) > 0
     THEN CAST(success_count AS REAL) / (success_count + failure_count)
     ELSE 0 END) DESC,
    usage_count DESC,
    id,
    title,
    category,
    severity
) WHERE archived = FALSE AND (success_count + failure_count) > 0;

-- Recent activity covering index
CREATE INDEX IF NOT EXISTS idx_kb_search_covering_recent ON kb_entries(
    last_used DESC NULLS LAST,
    created_at DESC,
    id,
    title,
    category,
    usage_count,
    severity
) WHERE archived = FALSE;

-- ==============================================
-- PHASE 2: ADVANCED COMPOSITE INDEXES
-- ==============================================

-- Multi-criteria search optimization
CREATE INDEX IF NOT EXISTS idx_kb_multi_criteria_v2 ON kb_entries(
    category,
    severity,
    (CASE WHEN usage_count > 50 THEN 'high'
          WHEN usage_count > 10 THEN 'medium'
          ELSE 'low' END),
    usage_count DESC,
    success_count DESC
) WHERE archived = FALSE;

-- Temporal relevance index
CREATE INDEX IF NOT EXISTS idx_kb_temporal_relevance ON kb_entries(
    julianday('now') - julianday(COALESCE(last_used, created_at)) ASC,
    usage_count DESC,
    category
) WHERE archived = FALSE;

-- Popularity clustering index
CREATE INDEX IF NOT EXISTS idx_kb_popularity_cluster ON kb_entries(
    CASE
        WHEN usage_count >= 100 THEN 'very_high'
        WHEN usage_count >= 50 THEN 'high'
        WHEN usage_count >= 10 THEN 'medium'
        WHEN usage_count >= 1 THEN 'low'
        ELSE 'unused'
    END,
    category,
    success_count DESC,
    created_at DESC
) WHERE archived = FALSE;

-- ==============================================
-- PHASE 3: TAG OPTIMIZATION INDEXES
-- ==============================================

-- Tag frequency covering index
CREATE INDEX IF NOT EXISTS idx_tags_frequency_covering ON kb_tags(
    tag COLLATE NOCASE,
    entry_id,
    created_at
) WHERE LENGTH(tag) >= 2;

-- Tag popularity index with entry stats
CREATE INDEX IF NOT EXISTS idx_tags_popularity_stats ON kb_tags(
    tag,
    entry_id
) WHERE tag IN (
    SELECT tag FROM kb_tags
    GROUP BY tag
    HAVING COUNT(*) >= 3
);

-- Tag entry lookup optimization
CREATE INDEX IF NOT EXISTS idx_tags_entry_reverse ON kb_tags(
    entry_id,
    tag COLLATE NOCASE
);

-- ==============================================
-- PHASE 4: SEARCH HISTORY OPTIMIZATION
-- ==============================================

-- Search analytics covering index
CREATE INDEX IF NOT EXISTS idx_search_analytics_covering ON search_history(
    date(timestamp),
    query_type,
    query,
    results_count,
    search_time_ms,
    user_id
) WHERE timestamp > datetime('now', '-90 days');

-- Popular queries index
CREATE INDEX IF NOT EXISTS idx_search_popular_queries ON search_history(
    query,
    timestamp DESC,
    results_count,
    search_time_ms
) WHERE timestamp > datetime('now', '-30 days')
  AND results_count > 0;

-- Slow query analysis index
CREATE INDEX IF NOT EXISTS idx_search_slow_queries ON search_history(
    search_time_ms DESC,
    query,
    timestamp DESC,
    results_count
) WHERE search_time_ms > 100;

-- ==============================================
-- PHASE 5: USAGE METRICS OPTIMIZATION
-- ==============================================

-- Usage trending analysis index
CREATE INDEX IF NOT EXISTS idx_usage_trending_analysis ON usage_metrics(
    entry_id,
    action,
    date(timestamp),
    COUNT(*) OVER (PARTITION BY entry_id, date(timestamp))
) WHERE timestamp > datetime('now', '-30 days')
  AND action IN ('view', 'rate_success', 'rate_failure');

-- User behavior pattern index
CREATE INDEX IF NOT EXISTS idx_usage_user_patterns ON usage_metrics(
    user_id,
    action,
    timestamp DESC,
    entry_id
) WHERE timestamp > datetime('now', '-7 days')
  AND user_id IS NOT NULL;

-- ==============================================
-- PHASE 6: EXPRESSION INDEXES FOR COMPUTED VALUES
-- ==============================================

-- Success rate computation index
CREATE INDEX IF NOT EXISTS idx_kb_success_rate_computed ON kb_entries(
    (CAST(success_count AS REAL) / NULLIF(success_count + failure_count, 0)) DESC,
    usage_count DESC,
    category
) WHERE archived = FALSE AND (success_count + failure_count) > 0;

-- Content quality score index
CREATE INDEX IF NOT EXISTS idx_kb_content_quality ON kb_entries(
    (LENGTH(problem) + LENGTH(solution)) DESC,
    category,
    usage_count DESC
) WHERE archived = FALSE
  AND LENGTH(problem) >= 50
  AND LENGTH(solution) >= 50;

-- Recency boost index
CREATE INDEX IF NOT EXISTS idx_kb_recency_boost ON kb_entries(
    CASE
        WHEN julianday('now') - julianday(created_at) <= 7 THEN 3
        WHEN julianday('now') - julianday(created_at) <= 30 THEN 2
        WHEN julianday('now') - julianday(created_at) <= 90 THEN 1
        ELSE 0
    END DESC,
    usage_count DESC,
    category
) WHERE archived = FALSE;

-- ==============================================
-- PHASE 7: PARTIAL INDEXES FOR FILTERED QUERIES
-- ==============================================

-- High-value entries index
CREATE INDEX IF NOT EXISTS idx_kb_high_value_entries ON kb_entries(
    category,
    severity,
    title,
    usage_count DESC
) WHERE archived = FALSE
  AND usage_count >= 10
  AND success_count > failure_count;

-- Recent high-activity index
CREATE INDEX IF NOT EXISTS idx_kb_recent_high_activity ON kb_entries(
    last_used DESC,
    usage_count DESC,
    category
) WHERE archived = FALSE
  AND last_used > datetime('now', '-30 days')
  AND usage_count >= 5;

-- Critical severity fast lookup
CREATE INDEX IF NOT EXISTS idx_kb_critical_fast_lookup ON kb_entries(
    created_at DESC,
    usage_count DESC,
    title
) WHERE archived = FALSE
  AND severity = 'critical';

-- Problem-specific optimization
CREATE INDEX IF NOT EXISTS idx_kb_complex_problems ON kb_entries(
    category,
    LENGTH(problem) DESC,
    usage_count DESC
) WHERE archived = FALSE
  AND LENGTH(problem) >= 200;

-- ==============================================
-- PHASE 8: FTS5 PERFORMANCE OPTIMIZATION
-- ==============================================

-- FTS5 auxiliary indexes for filtering
CREATE INDEX IF NOT EXISTS idx_kb_entries_fts_filter ON kb_entries(
    archived,
    category,
    severity,
    usage_count DESC
);

-- FTS5 result enhancement index
CREATE INDEX IF NOT EXISTS idx_kb_entries_fts_enhance ON kb_entries(
    id,
    usage_count,
    success_count,
    failure_count,
    last_used,
    severity
) WHERE archived = FALSE;

-- ==============================================
-- PHASE 9: JOIN OPTIMIZATION INDEXES
-- ==============================================

-- Tag JOIN optimization
CREATE INDEX IF NOT EXISTS idx_kb_tags_join_opt ON kb_tags(
    entry_id
) INCLUDE (tag, created_at);

-- Usage metrics JOIN optimization
CREATE INDEX IF NOT EXISTS idx_usage_metrics_join_opt ON usage_metrics(
    entry_id,
    timestamp DESC
) INCLUDE (action, user_id, session_id);

-- Search history JOIN optimization
CREATE INDEX IF NOT EXISTS idx_search_history_join_opt ON search_history(
    selected_entry_id,
    timestamp DESC
) INCLUDE (query, search_time_ms, results_count)
WHERE selected_entry_id IS NOT NULL;

-- ==============================================
-- PHASE 10: STATISTICAL OPTIMIZATION
-- ==============================================

-- Create statistics table for index monitoring
CREATE TABLE IF NOT EXISTS index_usage_stats (
    index_name TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    avg_query_time_ms REAL DEFAULT 0,
    effectiveness_score REAL DEFAULT 0,
    size_estimate INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index effectiveness monitoring view
CREATE VIEW IF NOT EXISTS v_index_effectiveness AS
SELECT
    name as index_name,
    tbl_name as table_name,
    CASE
        WHEN sql LIKE '%UNIQUE%' THEN 'UNIQUE'
        WHEN sql LIKE '%WHERE%' THEN 'PARTIAL'
        WHEN sql LIKE '%(%,%' THEN 'COMPOSITE'
        ELSE 'SIMPLE'
    END as index_type,
    CASE
        WHEN name LIKE '%covering%' THEN 'COVERING'
        WHEN name LIKE '%fts%' THEN 'FTS'
        WHEN name LIKE '%join%' THEN 'JOIN'
        ELSE 'STANDARD'
    END as optimization_type
FROM sqlite_master
WHERE type = 'index'
  AND name NOT LIKE 'sqlite_%'
  AND sql IS NOT NULL;

-- Query performance analysis view
CREATE VIEW IF NOT EXISTS v_query_performance_analysis AS
SELECT
    qp.query_hash,
    COUNT(*) as execution_count,
    AVG(qp.execution_time_ms) as avg_execution_time,
    MIN(qp.execution_time_ms) as min_execution_time,
    MAX(qp.execution_time_ms) as max_execution_time,
    AVG(qp.rows_examined) as avg_rows_examined,
    AVG(qp.rows_returned) as avg_rows_returned,
    SUM(CASE WHEN qp.index_used THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as index_usage_percent,
    MAX(qp.timestamp) as last_execution
FROM query_performance qp
WHERE qp.timestamp > datetime('now', '-7 days')
GROUP BY qp.query_hash
HAVING execution_count >= 5
ORDER BY avg_execution_time DESC;

-- ==============================================
-- PHASE 11: MAINTENANCE PROCEDURES
-- ==============================================

-- Index usage tracking trigger
CREATE TRIGGER IF NOT EXISTS tr_track_index_usage
AFTER INSERT ON query_performance
FOR EACH ROW
WHEN NEW.index_used = 1 AND NEW.query_plan LIKE '%USING INDEX%'
BEGIN
    INSERT OR REPLACE INTO index_usage_stats (
        index_name,
        table_name,
        usage_count,
        last_used,
        avg_query_time_ms
    )
    SELECT
        SUBSTR(NEW.query_plan,
               INSTR(NEW.query_plan, 'USING INDEX ') + 12,
               INSTR(NEW.query_plan || ' ', ' ', INSTR(NEW.query_plan, 'USING INDEX ') + 12) - INSTR(NEW.query_plan, 'USING INDEX ') - 12
        ) as index_name,
        'kb_entries' as table_name,
        COALESCE((SELECT usage_count FROM index_usage_stats WHERE index_name = index_name), 0) + 1,
        CURRENT_TIMESTAMP,
        (COALESCE((SELECT avg_query_time_ms * usage_count FROM index_usage_stats WHERE index_name = index_name), 0) + NEW.execution_time_ms) /
        (COALESCE((SELECT usage_count FROM index_usage_stats WHERE index_name = index_name), 0) + 1);
END;

-- ==============================================
-- PHASE 12: CONFIGURATION UPDATES
-- ==============================================

-- Update system configuration for new index features
INSERT OR REPLACE INTO system_config (key, value, type, description) VALUES
('index_optimization_enabled', 'true', 'boolean', 'Enable advanced index optimization features'),
('covering_index_enabled', 'true', 'boolean', 'Enable covering indexes for zero-lookup queries'),
('partial_index_enabled', 'true', 'boolean', 'Enable partial indexes for filtered queries'),
('index_usage_monitoring', 'true', 'boolean', 'Enable index usage monitoring and statistics'),
('query_plan_analysis', 'true', 'boolean', 'Enable automatic query plan analysis'),
('index_effectiveness_threshold', '0.7', 'float', 'Minimum effectiveness score for index recommendations'),
('slow_query_index_threshold', '100', 'integer', 'Query time threshold (ms) for index recommendations'),
('auto_index_creation', 'false', 'boolean', 'Enable automatic index creation for slow queries'),
('index_maintenance_interval', '7', 'integer', 'Days between index maintenance runs'),
('max_covering_index_columns', '10', 'integer', 'Maximum columns in covering indexes');

-- ==============================================
-- PHASE 13: OPTIMIZATION AND ANALYSIS
-- ==============================================

-- Update table statistics for all tables
ANALYZE kb_entries;
ANALYZE kb_tags;
ANALYZE usage_metrics;
ANALYZE search_history;
ANALYZE query_performance;

-- Optimize FTS5 indexes
INSERT INTO kb_fts5(kb_fts5) VALUES('optimize');

-- Rebuild statistics
ANALYZE kb_fts5;

-- ==============================================
-- PHASE 14: VERIFICATION QUERIES
-- ==============================================

-- Test query 1: Category-based search with popularity
-- EXPLAIN QUERY PLAN
-- SELECT id, title, category, usage_count
-- FROM kb_entries
-- WHERE category = 'JCL' AND archived = FALSE
-- ORDER BY usage_count DESC
-- LIMIT 10;

-- Test query 2: Success rate based search
-- EXPLAIN QUERY PLAN
-- SELECT id, title, success_count, failure_count
-- FROM kb_entries
-- WHERE archived = FALSE
--   AND (success_count + failure_count) > 0
-- ORDER BY (CAST(success_count AS REAL) / (success_count + failure_count)) DESC
-- LIMIT 10;

-- Test query 3: Recent high-activity entries
-- EXPLAIN QUERY PLAN
-- SELECT id, title, last_used, usage_count
-- FROM kb_entries
-- WHERE archived = FALSE
--   AND last_used > datetime('now', '-30 days')
-- ORDER BY last_used DESC, usage_count DESC
-- LIMIT 10;

-- Test query 4: Tag-based search with JOIN
-- EXPLAIN QUERY PLAN
-- SELECT DISTINCT e.id, e.title, e.category
-- FROM kb_entries e
-- JOIN kb_tags t ON e.id = t.entry_id
-- WHERE e.archived = FALSE
--   AND t.tag = 'error'
-- ORDER BY e.usage_count DESC
-- LIMIT 10;

-- Test query 5: FTS5 search with filters
-- EXPLAIN QUERY PLAN
-- SELECT e.id, e.title, e.category, f.rank
-- FROM kb_fts5 f
-- JOIN kb_entries e ON f.id = e.id
-- WHERE f MATCH 'JCL error'
--   AND e.archived = FALSE
--   AND e.category = 'JCL'
-- ORDER BY f.rank
-- LIMIT 10;

-- Log migration completion
INSERT INTO error_log (error_type, error_message, severity) VALUES
('MIGRATION', 'Advanced index optimization migration (008) completed successfully', 'info');

-- Performance metrics after optimization
INSERT INTO error_log (error_type, error_message, severity) VALUES
('PERFORMANCE',
 'Index optimization completed. Created ' ||
 (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' AND name NOT LIKE 'sqlite_%') ||
 ' custom indexes for sub-1s query performance.',
 'info');