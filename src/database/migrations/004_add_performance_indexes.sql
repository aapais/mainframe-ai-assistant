-- UP
-- Migration: Add Performance Indexes
-- Version: 002
-- Generated: 2025-01-01T00:00:00.000Z

-- Create additional indexes for better query performance

-- Index for full-text search optimization
CREATE INDEX IF NOT EXISTS idx_kb_entries_fts_title ON kb_entries(title);
CREATE INDEX IF NOT EXISTS idx_kb_entries_fts_problem ON kb_entries(problem);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_kb_entries_category_created ON kb_entries(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_severity_usage ON kb_entries(severity, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_success_rate ON kb_entries(
    (CAST(success_count AS REAL) / NULLIF(success_count + failure_count, 0)) DESC,
    usage_count DESC
);

-- Indexes for search_history table
CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_user_timestamp ON search_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query);

-- Indexes for usage_metrics table
CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry_timestamp ON usage_metrics(entry_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_action ON usage_metrics(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_session ON usage_metrics(session_id, timestamp);

-- Index for tags table
CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag);
CREATE INDEX IF NOT EXISTS idx_kb_tags_entry ON kb_tags(entry_id);

-- Create backup tracking table
CREATE TABLE IF NOT EXISTS backup_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_path TEXT NOT NULL,
    backup_type TEXT CHECK(backup_type IN ('manual', 'automatic', 'migration', 'export')) DEFAULT 'manual',
    entries_count INTEGER NOT NULL DEFAULT 0,
    file_size INTEGER,
    checksum TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    description TEXT,
    restored_at DATETIME,
    restored_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_log_created ON backup_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_log_type ON backup_log(backup_type, created_at DESC);

-- Create query performance tracking table
CREATE TABLE IF NOT EXISTS query_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash TEXT NOT NULL,
    query_type TEXT CHECK(query_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    row_count INTEGER,
    cache_hit BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_query_performance_hash ON query_performance(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_performance_time ON query_performance(execution_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_timestamp ON query_performance(timestamp DESC);

-- Create system health monitoring table
CREATE TABLE IF NOT EXISTS system_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    severity TEXT CHECK(severity IN ('info', 'warning', 'error', 'critical')) DEFAULT 'info',
    details TEXT,
    resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_system_health_metric ON system_health(metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_severity ON system_health(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_unresolved ON system_health(resolved, severity);

-- Create user preferences table for personalization
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    preferred_categories TEXT, -- JSON array of preferred categories
    search_history_enabled BOOLEAN DEFAULT 1,
    notification_settings TEXT, -- JSON object with notification preferences
    ui_preferences TEXT, -- JSON object with UI settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp
AFTER UPDATE ON user_preferences
FOR EACH ROW
BEGIN
    UPDATE user_preferences SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

-- Create KB entry validation rules table
CREATE TABLE IF NOT EXISTS validation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL UNIQUE,
    rule_type TEXT CHECK(rule_type IN ('required', 'format', 'length', 'pattern', 'business')) NOT NULL,
    field_name TEXT NOT NULL,
    rule_definition TEXT NOT NULL, -- JSON object with rule parameters
    error_message TEXT NOT NULL,
    warning_message TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_validation_rules_field ON validation_rules(field_name, enabled);
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(rule_type, enabled);

-- Insert default validation rules
INSERT OR IGNORE INTO validation_rules (rule_name, rule_type, field_name, rule_definition, error_message, warning_message) VALUES
('title_length', 'length', 'title', '{"min": 5, "max": 200}', 'Title must be between 5 and 200 characters', NULL),
('problem_length', 'length', 'problem', '{"min": 20, "max": 5000}', 'Problem description must be between 20 and 5000 characters', NULL),
('solution_length', 'length', 'solution', '{"min": 20, "max": 10000}', 'Solution must be between 20 and 10000 characters', NULL),
('category_required', 'required', 'category', '{}', 'Category is required', NULL),
('tags_count', 'length', 'tags', '{"max": 10}', 'Maximum 10 tags allowed', NULL),
('solution_actionable', 'business', 'solution', '{"patterns": ["check", "verify", "run", "execute", "modify", "update"]}', NULL, 'Solution should contain actionable steps'),
('error_codes_helpful', 'business', 'problem', '{"patterns": ["S0C\\\\d", "U\\\\d{4}", "IEF\\\\d{3}[A-Z]", "SQLCODE", "status \\\\d+"]}', NULL, 'Problems with specific error codes are more useful');


-- DOWN
-- Rollback for: Add Performance Indexes

-- Drop validation rules and related data
DROP TABLE IF EXISTS validation_rules;

-- Drop user preferences and related triggers
DROP TRIGGER IF EXISTS update_user_preferences_timestamp;
DROP TABLE IF EXISTS user_preferences;

-- Drop monitoring tables
DROP TABLE IF EXISTS system_health;
DROP TABLE IF EXISTS query_performance;
DROP TABLE IF EXISTS backup_log;

-- Drop performance indexes
DROP INDEX IF EXISTS idx_kb_entries_fts_title;
DROP INDEX IF EXISTS idx_kb_entries_fts_problem;
DROP INDEX IF EXISTS idx_kb_entries_category_created;
DROP INDEX IF EXISTS idx_kb_entries_severity_usage;
DROP INDEX IF EXISTS idx_kb_entries_success_rate;
DROP INDEX IF EXISTS idx_search_history_timestamp;
DROP INDEX IF EXISTS idx_search_history_user_timestamp;
DROP INDEX IF EXISTS idx_search_history_query;
DROP INDEX IF EXISTS idx_usage_metrics_entry_timestamp;
DROP INDEX IF EXISTS idx_usage_metrics_action;
DROP INDEX IF EXISTS idx_usage_metrics_session;
DROP INDEX IF EXISTS idx_kb_tags_tag;
DROP INDEX IF EXISTS idx_kb_tags_entry;
DROP INDEX IF EXISTS idx_backup_log_created;
DROP INDEX IF EXISTS idx_backup_log_type;
DROP INDEX IF EXISTS idx_query_performance_hash;
DROP INDEX IF EXISTS idx_query_performance_time;
DROP INDEX IF EXISTS idx_query_performance_timestamp;
DROP INDEX IF EXISTS idx_system_health_metric;
DROP INDEX IF EXISTS idx_system_health_severity;
DROP INDEX IF EXISTS idx_system_health_unresolved;