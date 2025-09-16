-- UP
-- Migration: Initial Knowledge Base Schema
-- Version: 001
-- Generated: 2025-01-11T00:00:00.000Z

-- Create Knowledge Base Entries table
CREATE TABLE IF NOT EXISTS kb_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 255),
    problem TEXT NOT NULL CHECK(length(problem) >= 10 AND length(problem) <= 5000),
    solution TEXT NOT NULL CHECK(length(solution) >= 10 AND length(solution) <= 10000),
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT DEFAULT 'system' CHECK(length(created_by) <= 100),
    usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
    success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
    failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
    last_used DATETIME,
    archived BOOLEAN DEFAULT FALSE,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 100)
);

-- Create Tags table for flexible tagging system
CREATE TABLE IF NOT EXISTS kb_tags (
    entry_id TEXT NOT NULL,
    tag TEXT NOT NULL CHECK(length(tag) >= 1 AND length(tag) <= 50),
    PRIMARY KEY (entry_id, tag),
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Create Entry Feedback table for user ratings
CREATE TABLE IF NOT EXISTS entry_feedback (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    user_id TEXT CHECK(length(user_id) <= 100),
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    successful BOOLEAN NOT NULL,
    comment TEXT CHECK(length(comment) <= 1000),
    session_id TEXT CHECK(length(session_id) <= 100),
    resolution_time INTEGER CHECK(resolution_time >= 0),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Create Usage Metrics table for detailed tracking
CREATE TABLE IF NOT EXISTS usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure', 'export', 'print', 'share', 'create', 'update', 'delete')),
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON blob for additional context
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Create Search History table for analytics
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL CHECK(length(query) <= 500),
    normalized_query TEXT CHECK(length(normalized_query) <= 500),
    results_count INTEGER NOT NULL CHECK(results_count >= 0),
    selected_entry_id TEXT,
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    search_time_ms INTEGER CHECK(search_time_ms >= 0),
    filters_used TEXT, -- JSON blob for search filters
    ai_used BOOLEAN DEFAULT FALSE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (selected_entry_id) REFERENCES kb_entries(id) ON DELETE SET NULL
);

-- Create System Configuration table
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY CHECK(length(key) <= 100),
    value TEXT NOT NULL CHECK(length(value) <= 2000),
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT CHECK(length(description) <= 500),
    category TEXT DEFAULT 'general' CHECK(length(category) <= 50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Backup Log table for tracking backups
CREATE TABLE IF NOT EXISTS backup_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_path TEXT NOT NULL CHECK(length(backup_path) <= 500),
    backup_type TEXT NOT NULL CHECK(backup_type IN ('manual', 'scheduled', 'migration', 'export')),
    entries_count INTEGER NOT NULL CHECK(entries_count >= 0),
    file_size INTEGER CHECK(file_size >= 0),
    checksum TEXT CHECK(length(checksum) <= 64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'created' CHECK(status IN ('created', 'verified', 'corrupted', 'deleted'))
);

-- Create Audit Log table for tracking all changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL CHECK(length(table_name) <= 50),
    record_id TEXT NOT NULL CHECK(length(record_id) <= 100),
    operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT, -- JSON blob
    new_values TEXT, -- JSON blob
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    ip_address TEXT CHECK(length(ip_address) <= 45),
    user_agent TEXT CHECK(length(user_agent) <= 500),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Query Performance table for monitoring
CREATE TABLE IF NOT EXISTS query_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash TEXT NOT NULL CHECK(length(query_hash) <= 64),
    query_text TEXT NOT NULL CHECK(length(query_text) <= 1000),
    execution_time_ms INTEGER NOT NULL CHECK(execution_time_ms >= 0),
    rows_examined INTEGER NOT NULL CHECK(rows_examined >= 0),
    rows_returned INTEGER NOT NULL CHECK(rows_returned >= 0),
    cache_hit BOOLEAN DEFAULT FALSE,
    index_used BOOLEAN DEFAULT FALSE,
    query_plan TEXT CHECK(length(query_plan) <= 2000),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT CHECK(length(user_id) <= 100)
);

-- Create Full-Text Search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
    id UNINDEXED,
    title,
    problem,
    solution,
    tags,
    content=kb_entries,
    content_rowid=id
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries(category);
CREATE INDEX IF NOT EXISTS idx_kb_entries_severity ON kb_entries(severity);
CREATE INDEX IF NOT EXISTS idx_kb_entries_usage ON kb_entries(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_success_rate ON kb_entries(success_count, failure_count);
CREATE INDEX IF NOT EXISTS idx_kb_entries_created_at ON kb_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_updated_at ON kb_entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_archived ON kb_entries(archived);
CREATE INDEX IF NOT EXISTS idx_kb_entries_last_used ON kb_entries(last_used DESC);

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag);
CREATE INDEX IF NOT EXISTS idx_kb_tags_entry_id ON kb_tags(entry_id);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_entry_id ON entry_feedback(entry_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON entry_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON entry_feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_successful ON entry_feedback(successful);

-- Usage metrics indexes
CREATE INDEX IF NOT EXISTS idx_usage_entry_id ON usage_metrics(entry_id);
CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_metrics(action);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_metrics(user_id);

-- Search history indexes
CREATE INDEX IF NOT EXISTS idx_search_query ON search_history(query);
CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_selected_entry ON search_history(selected_entry_id);

-- System config indexes
CREATE INDEX IF NOT EXISTS idx_config_category ON system_config(category);
CREATE INDEX IF NOT EXISTS idx_config_type ON system_config(type);

-- Backup log indexes
CREATE INDEX IF NOT EXISTS idx_backup_created_at ON backup_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_type ON backup_log(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_status ON backup_log(status);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);

-- Query performance indexes
CREATE INDEX IF NOT EXISTS idx_perf_query_hash ON query_performance(query_hash);
CREATE INDEX IF NOT EXISTS idx_perf_timestamp ON query_performance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_perf_execution_time ON query_performance(execution_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_perf_cache_hit ON query_performance(cache_hit);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_kb_entries_timestamp 
    AFTER UPDATE ON kb_entries
BEGIN
    UPDATE kb_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_system_config_timestamp 
    AFTER UPDATE ON system_config
BEGIN
    UPDATE system_config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

-- Create triggers for audit logging
CREATE TRIGGER IF NOT EXISTS audit_kb_entries_insert 
    AFTER INSERT ON kb_entries
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_values)
    VALUES ('kb_entries', NEW.id, 'INSERT', 
            json_object(
                'title', NEW.title,
                'category', NEW.category,
                'severity', NEW.severity,
                'created_by', NEW.created_by
            ));
END;

CREATE TRIGGER IF NOT EXISTS audit_kb_entries_update 
    AFTER UPDATE ON kb_entries
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values)
    VALUES ('kb_entries', NEW.id, 'UPDATE',
            json_object(
                'title', OLD.title,
                'problem', substr(OLD.problem, 1, 100),
                'solution', substr(OLD.solution, 1, 100),
                'category', OLD.category,
                'severity', OLD.severity,
                'archived', OLD.archived
            ),
            json_object(
                'title', NEW.title,
                'problem', substr(NEW.problem, 1, 100),
                'solution', substr(NEW.solution, 1, 100),
                'category', NEW.category,
                'severity', NEW.severity,
                'archived', NEW.archived
            ));
END;

CREATE TRIGGER IF NOT EXISTS audit_kb_entries_delete 
    AFTER DELETE ON kb_entries
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values)
    VALUES ('kb_entries', OLD.id, 'DELETE',
            json_object(
                'title', OLD.title,
                'category', OLD.category,
                'severity', OLD.severity
            ));
END;

-- Create triggers for FTS index maintenance
CREATE TRIGGER IF NOT EXISTS kb_entries_fts_insert 
    AFTER INSERT ON kb_entries
BEGIN
    INSERT INTO kb_fts(id, title, problem, solution, tags) 
    VALUES (NEW.id, NEW.title, NEW.problem, NEW.solution, 
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''));
END;

CREATE TRIGGER IF NOT EXISTS kb_entries_fts_update 
    AFTER UPDATE ON kb_entries
BEGIN
    DELETE FROM kb_fts WHERE id = NEW.id;
    INSERT INTO kb_fts(id, title, problem, solution, tags) 
    VALUES (NEW.id, NEW.title, NEW.problem, NEW.solution,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''));
END;

CREATE TRIGGER IF NOT EXISTS kb_entries_fts_delete 
    AFTER DELETE ON kb_entries
BEGIN
    DELETE FROM kb_fts WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS kb_tags_fts_update 
    AFTER INSERT ON kb_tags
BEGIN
    DELETE FROM kb_fts WHERE id = NEW.entry_id;
    INSERT INTO kb_fts(id, title, problem, solution, tags) 
    SELECT e.id, e.title, e.problem, e.solution, 
           COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags
    FROM kb_entries e 
    LEFT JOIN kb_tags t ON e.id = t.entry_id 
    WHERE e.id = NEW.entry_id
    GROUP BY e.id;
END;

CREATE TRIGGER IF NOT EXISTS kb_tags_fts_delete 
    AFTER DELETE ON kb_tags
BEGIN
    DELETE FROM kb_fts WHERE id = OLD.entry_id;
    INSERT INTO kb_fts(id, title, problem, solution, tags) 
    SELECT e.id, e.title, e.problem, e.solution, 
           COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags
    FROM kb_entries e 
    LEFT JOIN kb_tags t ON e.id = t.entry_id 
    WHERE e.id = OLD.entry_id
    GROUP BY e.id;
END;

-- Insert initial system configuration
INSERT OR IGNORE INTO system_config (key, value, type, description, category) VALUES
('db_version', '1', 'number', 'Database schema version', 'system'),
('app_name', 'Mainframe KB Assistant', 'string', 'Application name', 'general'),
('app_version', '1.0.0-mvp1', 'string', 'Application version', 'general'),
('default_search_limit', '10', 'number', 'Default number of search results', 'search'),
('max_search_limit', '100', 'number', 'Maximum number of search results', 'search'),
('cache_enabled', 'true', 'boolean', 'Enable query caching', 'performance'),
('cache_ttl_minutes', '5', 'number', 'Cache time-to-live in minutes', 'performance'),
('ai_search_enabled', 'true', 'boolean', 'Enable AI-powered search', 'ai'),
('ai_search_timeout_ms', '30000', 'number', 'AI search timeout in milliseconds', 'ai'),
('backup_retention_days', '30', 'number', 'Number of days to retain backups', 'backup'),
('auto_backup_enabled', 'true', 'boolean', 'Enable automatic backups', 'backup'),
('audit_log_retention_days', '90', 'number', 'Number of days to retain audit logs', 'audit'),
('performance_monitoring_enabled', 'true', 'boolean', 'Enable performance monitoring', 'performance'),
('slow_query_threshold_ms', '1000', 'number', 'Threshold for slow query logging', 'performance');

-- Create initial backup entry
INSERT INTO backup_log (backup_path, backup_type, entries_count, status)
VALUES ('initial_setup', 'migration', 0, 'created');

-- DOWN
-- Rollback for: Initial Knowledge Base Schema

-- Drop triggers (order matters - drop dependents first)
DROP TRIGGER IF EXISTS kb_tags_fts_delete;
DROP TRIGGER IF EXISTS kb_tags_fts_update;
DROP TRIGGER IF EXISTS kb_entries_fts_delete;
DROP TRIGGER IF EXISTS kb_entries_fts_update;
DROP TRIGGER IF EXISTS kb_entries_fts_insert;

DROP TRIGGER IF EXISTS audit_kb_entries_delete;
DROP TRIGGER IF EXISTS audit_kb_entries_update;
DROP TRIGGER IF EXISTS audit_kb_entries_insert;

DROP TRIGGER IF EXISTS update_system_config_timestamp;
DROP TRIGGER IF EXISTS update_kb_entries_timestamp;

-- Drop indexes
DROP INDEX IF EXISTS idx_perf_cache_hit;
DROP INDEX IF EXISTS idx_perf_execution_time;
DROP INDEX IF EXISTS idx_perf_timestamp;
DROP INDEX IF EXISTS idx_perf_query_hash;

DROP INDEX IF EXISTS idx_audit_user_id;
DROP INDEX IF EXISTS idx_audit_operation;
DROP INDEX IF EXISTS idx_audit_timestamp;
DROP INDEX IF EXISTS idx_audit_table_record;

DROP INDEX IF EXISTS idx_backup_status;
DROP INDEX IF EXISTS idx_backup_type;
DROP INDEX IF EXISTS idx_backup_created_at;

DROP INDEX IF EXISTS idx_config_type;
DROP INDEX IF EXISTS idx_config_category;

DROP INDEX IF EXISTS idx_search_selected_entry;
DROP INDEX IF EXISTS idx_search_user_id;
DROP INDEX IF EXISTS idx_search_timestamp;
DROP INDEX IF EXISTS idx_search_query;

DROP INDEX IF EXISTS idx_usage_user_id;
DROP INDEX IF EXISTS idx_usage_timestamp;
DROP INDEX IF EXISTS idx_usage_action;
DROP INDEX IF EXISTS idx_usage_entry_id;

DROP INDEX IF EXISTS idx_feedback_successful;
DROP INDEX IF EXISTS idx_feedback_timestamp;
DROP INDEX IF EXISTS idx_feedback_rating;
DROP INDEX IF EXISTS idx_feedback_entry_id;

DROP INDEX IF EXISTS idx_kb_tags_entry_id;
DROP INDEX IF EXISTS idx_kb_tags_tag;

DROP INDEX IF EXISTS idx_kb_entries_last_used;
DROP INDEX IF EXISTS idx_kb_entries_archived;
DROP INDEX IF EXISTS idx_kb_entries_updated_at;
DROP INDEX IF EXISTS idx_kb_entries_created_at;
DROP INDEX IF EXISTS idx_kb_entries_success_rate;
DROP INDEX IF EXISTS idx_kb_entries_usage;
DROP INDEX IF EXISTS idx_kb_entries_severity;
DROP INDEX IF EXISTS idx_kb_entries_category;

-- Drop virtual table
DROP TABLE IF EXISTS kb_fts;

-- Drop tables (order matters - drop dependents first)
DROP TABLE IF EXISTS query_performance;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS backup_log;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS search_history;
DROP TABLE IF EXISTS usage_metrics;
DROP TABLE IF EXISTS entry_feedback;
DROP TABLE IF EXISTS kb_tags;
DROP TABLE IF EXISTS kb_entries;