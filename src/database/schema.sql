-- Mainframe KB Assistant - Complete SQLite Schema
-- Version: 1.0
-- Optimized for <1s search performance

-- Enable foreign keys and WAL mode
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000; -- 64MB cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB mmap

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_versions (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    rollback_sql TEXT
);

-- Insert initial schema version
INSERT OR IGNORE INTO schema_versions (version, description) VALUES (1, 'Initial KB schema');

-- Main knowledge base entries
CREATE TABLE IF NOT EXISTS kb_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    problem TEXT NOT NULL,
    solution TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Other')),
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_used DATETIME,
    archived BOOLEAN DEFAULT FALSE,
    checksum TEXT -- For change detection
);

-- Tags for flexible categorization
CREATE TABLE IF NOT EXISTS kb_tags (
    entry_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entry_id, tag),
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Related entries (entry can be related to other entries)
CREATE TABLE IF NOT EXISTS kb_relations (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT DEFAULT 'related' CHECK(relation_type IN ('related', 'duplicate', 'superseded', 'prerequisite')),
    strength REAL DEFAULT 0.5 CHECK(strength >= 0 AND strength <= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_id, target_id),
    FOREIGN KEY (source_id) REFERENCES kb_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Search history for analytics and learning
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    query_type TEXT DEFAULT 'text' CHECK(query_type IN ('text', 'category', 'tag', 'ai')),
    results_count INTEGER DEFAULT 0,
    selected_entry_id TEXT,
    search_time_ms INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT DEFAULT 'anonymous',
    session_id TEXT,
    FOREIGN KEY (selected_entry_id) REFERENCES kb_entries(id)
);

-- Detailed usage metrics
CREATE TABLE IF NOT EXISTS usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure', 'export', 'edit')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT DEFAULT 'anonymous',
    session_id TEXT,
    metadata TEXT, -- JSON for additional context
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'integer', 'float', 'boolean', 'json')),
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backup metadata
CREATE TABLE IF NOT EXISTS backup_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_path TEXT NOT NULL,
    backup_type TEXT DEFAULT 'manual' CHECK(backup_type IN ('manual', 'auto', 'migration')),
    file_size INTEGER,
    entries_count INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('in_progress', 'completed', 'failed'))
);

-- Error log for debugging
CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context TEXT, -- JSON context
    severity TEXT DEFAULT 'error' CHECK(severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== FULL-TEXT SEARCH CONFIGURATION =====

-- Main FTS5 table for content search
CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
    id UNINDEXED,
    title,
    problem,
    solution,
    category UNINDEXED,
    tags,
    tokenize = 'porter unicode61',
    content = 'kb_entries',
    content_rowid = 'rowid'
);

-- FTS5 triggers for automatic index maintenance
CREATE TRIGGER IF NOT EXISTS kb_fts_insert AFTER INSERT ON kb_entries BEGIN
    INSERT INTO kb_fts(rowid, id, title, problem, solution, category, tags)
    SELECT 
        NEW.rowid,
        NEW.id,
        NEW.title,
        NEW.problem,
        NEW.solution,
        NEW.category,
        (SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS kb_fts_delete AFTER DELETE ON kb_entries BEGIN
    DELETE FROM kb_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER IF NOT EXISTS kb_fts_update AFTER UPDATE ON kb_entries BEGIN
    DELETE FROM kb_fts WHERE rowid = OLD.rowid;
    INSERT INTO kb_fts(rowid, id, title, problem, solution, category, tags)
    SELECT 
        NEW.rowid,
        NEW.id,
        NEW.title,
        NEW.problem,
        NEW.solution,
        NEW.category,
        (SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id);
END;

-- Tags FTS trigger
CREATE TRIGGER IF NOT EXISTS kb_tags_fts_update AFTER INSERT ON kb_tags BEGIN
    DELETE FROM kb_fts WHERE id = NEW.entry_id;
    INSERT INTO kb_fts(rowid, id, title, problem, solution, category, tags)
    SELECT 
        e.rowid,
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        (SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = e.id)
    FROM kb_entries e WHERE e.id = NEW.entry_id;
END;

-- ===== PERFORMANCE INDEXES =====

-- Primary search indexes
CREATE INDEX IF NOT EXISTS idx_kb_category ON kb_entries(category, archived);
CREATE INDEX IF NOT EXISTS idx_kb_created_at ON kb_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_usage_count ON kb_entries(usage_count DESC, success_count DESC);
CREATE INDEX IF NOT EXISTS idx_kb_success_rate ON kb_entries(
    CASE WHEN (success_count + failure_count) > 0 
    THEN CAST(success_count AS REAL) / (success_count + failure_count)
    ELSE 0 END DESC
);
CREATE INDEX IF NOT EXISTS idx_kb_last_used ON kb_entries(last_used DESC);
CREATE INDEX IF NOT EXISTS idx_kb_severity ON kb_entries(severity, category);

-- Tag indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_tags_tag ON kb_tags(tag);
CREATE INDEX IF NOT EXISTS idx_tags_entry ON kb_tags(entry_id);

-- Search history indexes for analytics
CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_query ON search_history(query);
CREATE INDEX IF NOT EXISTS idx_search_user ON search_history(user_id, timestamp DESC);

-- Usage metrics indexes
CREATE INDEX IF NOT EXISTS idx_usage_entry ON usage_metrics(entry_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_metrics(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_metrics(timestamp DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_kb_category_usage ON kb_entries(category, usage_count DESC) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_kb_recent_success ON kb_entries(last_used DESC, success_count DESC) WHERE archived = FALSE;

-- ===== VIEWS FOR COMMON QUERIES =====

-- View for entry statistics
CREATE VIEW IF NOT EXISTS v_entry_stats AS
SELECT 
    e.id,
    e.title,
    e.category,
    e.usage_count,
    e.success_count,
    e.failure_count,
    CASE WHEN (e.success_count + e.failure_count) > 0 
         THEN ROUND(CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100, 2)
         ELSE 0 END as success_rate,
    e.last_used,
    GROUP_CONCAT(t.tag, ', ') as tags,
    COUNT(r.target_id) as related_count
FROM kb_entries e
LEFT JOIN kb_tags t ON e.id = t.entry_id
LEFT JOIN kb_relations r ON e.id = r.source_id
WHERE e.archived = FALSE
GROUP BY e.id, e.title, e.category, e.usage_count, e.success_count, e.failure_count, e.last_used;

-- View for popular searches
CREATE VIEW IF NOT EXISTS v_popular_searches AS
SELECT 
    query,
    COUNT(*) as search_count,
    AVG(results_count) as avg_results,
    MAX(timestamp) as last_searched,
    COUNT(DISTINCT user_id) as unique_users
FROM search_history
WHERE timestamp > datetime('now', '-30 days')
GROUP BY query
HAVING search_count > 1
ORDER BY search_count DESC;

-- View for category metrics
CREATE VIEW IF NOT EXISTS v_category_metrics AS
SELECT 
    category,
    COUNT(*) as total_entries,
    SUM(usage_count) as total_usage,
    AVG(CASE WHEN (success_count + failure_count) > 0 
             THEN CAST(success_count AS REAL) / (success_count + failure_count)
             ELSE 0 END) as avg_success_rate,
    MAX(last_used) as last_category_use
FROM kb_entries
WHERE archived = FALSE
GROUP BY category;

-- View for recent activity
CREATE VIEW IF NOT EXISTS v_recent_activity AS
SELECT 
    'search' as activity_type,
    s.query as description,
    s.timestamp,
    s.user_id,
    NULL as entry_id
FROM search_history s
WHERE s.timestamp > datetime('now', '-7 days')

UNION ALL

SELECT 
    'usage' as activity_type,
    u.action || ' on entry' as description,
    u.timestamp,
    u.user_id,
    u.entry_id
FROM usage_metrics u
WHERE u.timestamp > datetime('now', '-7 days')

ORDER BY timestamp DESC;

-- ===== DATA CONSISTENCY TRIGGERS =====

-- Update timestamps on entry changes
CREATE TRIGGER IF NOT EXISTS tr_kb_update_timestamp 
AFTER UPDATE ON kb_entries
FOR EACH ROW
BEGIN
    UPDATE kb_entries 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Update last_used on view actions
CREATE TRIGGER IF NOT EXISTS tr_update_last_used
AFTER INSERT ON usage_metrics
FOR EACH ROW
WHEN NEW.action = 'view'
BEGIN
    UPDATE kb_entries 
    SET last_used = CURRENT_TIMESTAMP
    WHERE id = NEW.entry_id;
END;

-- Update usage count on metrics insert
CREATE TRIGGER IF NOT EXISTS tr_update_usage_count
AFTER INSERT ON usage_metrics
FOR EACH ROW
WHEN NEW.action IN ('view', 'copy', 'export')
BEGIN
    UPDATE kb_entries 
    SET usage_count = usage_count + 1
    WHERE id = NEW.entry_id;
END;

-- Update success/failure counts
CREATE TRIGGER IF NOT EXISTS tr_update_success_count
AFTER INSERT ON usage_metrics
FOR EACH ROW
WHEN NEW.action = 'rate_success'
BEGIN
    UPDATE kb_entries 
    SET success_count = success_count + 1
    WHERE id = NEW.entry_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_update_failure_count
AFTER INSERT ON usage_metrics
FOR EACH ROW
WHEN NEW.action = 'rate_failure'
BEGIN
    UPDATE kb_entries 
    SET failure_count = failure_count + 1
    WHERE id = NEW.entry_id;
END;

-- Generate checksum on entry changes
CREATE TRIGGER IF NOT EXISTS tr_generate_checksum
AFTER INSERT OR UPDATE ON kb_entries
FOR EACH ROW
BEGIN
    UPDATE kb_entries 
    SET checksum = hex(
        CASE 
            WHEN NEW.solution IS NOT NULL 
            THEN NEW.title || NEW.problem || NEW.solution || NEW.category
            ELSE NEW.title || NEW.problem || NEW.category
        END
    )
    WHERE id = NEW.id;
END;

-- ===== INITIAL CONFIGURATION =====

INSERT OR IGNORE INTO system_config (key, value, type, description) VALUES
('search_timeout_ms', '1000', 'integer', 'Maximum search time in milliseconds'),
('max_search_results', '50', 'integer', 'Maximum number of search results to return'),
('auto_backup_enabled', 'true', 'boolean', 'Enable automatic backups'),
('auto_backup_interval_hours', '24', 'integer', 'Automatic backup interval in hours'),
('gemini_api_timeout_ms', '5000', 'integer', 'Gemini API timeout in milliseconds'),
('gemini_fallback_enabled', 'true', 'boolean', 'Enable fallback to local search if Gemini fails'),
('usage_analytics_enabled', 'true', 'boolean', 'Enable usage analytics collection'),
('max_search_history', '10000', 'integer', 'Maximum search history entries to keep'),
('vacuum_schedule', 'weekly', 'string', 'Database vacuum schedule'),
('fts_rank_weights', '{"title": 3.0, "problem": 2.0, "solution": 1.5, "tags": 1.0}', 'json', 'FTS ranking weights');

-- ===== AI TRANSPARENCY TABLES =====

-- AI operations tracking
CREATE TABLE IF NOT EXISTS ai_operations (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL CHECK(operation_type IN ('search', 'generation', 'analysis', 'chat', 'completion')),
    provider TEXT NOT NULL CHECK(provider IN ('openai', 'gemini', 'claude', 'local')),
    model TEXT NOT NULL,
    query_text TEXT NOT NULL,
    purpose TEXT NOT NULL,
    estimated_cost REAL NOT NULL DEFAULT 0.0,
    actual_cost REAL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    user_decision TEXT NOT NULL CHECK(user_decision IN ('approved', 'denied', 'modified', 'auto_approved')),
    auto_approved BOOLEAN DEFAULT FALSE,
    timeout_occurred BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_quality_rating INTEGER CHECK(response_quality_rating >= 1 AND response_quality_rating <= 5),
    execution_time_ms INTEGER,
    error_message TEXT,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    user_id TEXT DEFAULT 'anonymous'
);

-- User budget settings and tracking
CREATE TABLE IF NOT EXISTS ai_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    budget_type TEXT NOT NULL CHECK(budget_type IN ('daily', 'monthly', 'yearly')),
    budget_amount REAL NOT NULL,
    current_usage REAL DEFAULT 0.0,
    alert_threshold_50 BOOLEAN DEFAULT TRUE,
    alert_threshold_80 BOOLEAN DEFAULT TRUE,
    alert_threshold_95 BOOLEAN DEFAULT TRUE,
    alerts_sent TEXT, -- JSON array of sent alert types
    reset_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User AI preferences
CREATE TABLE IF NOT EXISTS ai_preferences (
    user_id TEXT PRIMARY KEY,
    always_allow_providers TEXT, -- JSON array of auto-approved providers
    always_allow_operations TEXT, -- JSON array of auto-approved operation types
    max_cost_auto_approve REAL DEFAULT 0.01,
    default_timeout_seconds INTEGER DEFAULT 30,
    enable_cost_alerts BOOLEAN DEFAULT TRUE,
    enable_usage_tracking BOOLEAN DEFAULT TRUE,
    preferred_provider TEXT DEFAULT 'openai',
    preferred_model TEXT DEFAULT 'gpt-3.5-turbo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cost tracking by provider and model
CREATE TABLE IF NOT EXISTS ai_cost_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    cost_per_1k_input_tokens REAL NOT NULL,
    cost_per_1k_output_tokens REAL NOT NULL,
    cost_per_request REAL DEFAULT 0.0,
    effective_date DATE NOT NULL,
    deprecated BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, model, effective_date)
);

-- Budget alerts log
CREATE TABLE IF NOT EXISTS ai_budget_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    budget_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('50_percent', '80_percent', '95_percent', 'exceeded')),
    current_usage REAL NOT NULL,
    budget_amount REAL NOT NULL,
    percentage_used REAL NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES ai_budgets(id) ON DELETE CASCADE
);

-- ===== AI TRANSPARENCY INDEXES =====

-- AI operations indexes
CREATE INDEX IF NOT EXISTS idx_ai_operations_user ON ai_operations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_operations_provider ON ai_operations(provider, operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_operations_cost ON ai_operations(actual_cost DESC);
CREATE INDEX IF NOT EXISTS idx_ai_operations_session ON ai_operations(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_operations_decision ON ai_operations(user_decision, created_at DESC);

-- Budget indexes
CREATE INDEX IF NOT EXISTS idx_ai_budgets_user ON ai_budgets(user_id, budget_type);
CREATE INDEX IF NOT EXISTS idx_ai_budgets_usage ON ai_budgets(current_usage, budget_amount);

-- Cost rates indexes
CREATE INDEX IF NOT EXISTS idx_ai_cost_rates_provider ON ai_cost_rates(provider, model, effective_date DESC);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_ai_alerts_user ON ai_budget_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_acknowledged ON ai_budget_alerts(acknowledged, created_at);

-- ===== AI TRANSPARENCY VIEWS =====

-- View for user AI usage summary
CREATE VIEW IF NOT EXISTS v_ai_usage_summary AS
SELECT
    user_id,
    COUNT(*) as total_operations,
    SUM(CASE WHEN user_decision = 'approved' THEN 1 ELSE 0 END) as approved_operations,
    SUM(CASE WHEN user_decision = 'denied' THEN 1 ELSE 0 END) as denied_operations,
    SUM(COALESCE(actual_cost, estimated_cost)) as total_cost,
    AVG(COALESCE(actual_cost, estimated_cost)) as avg_cost_per_operation,
    SUM(tokens_input) as total_input_tokens,
    SUM(tokens_output) as total_output_tokens,
    AVG(execution_time_ms) as avg_execution_time,
    MAX(created_at) as last_operation
FROM ai_operations
GROUP BY user_id;

-- View for daily cost tracking
CREATE VIEW IF NOT EXISTS v_daily_ai_costs AS
SELECT
    user_id,
    DATE(created_at) as operation_date,
    provider,
    operation_type,
    COUNT(*) as operation_count,
    SUM(COALESCE(actual_cost, estimated_cost)) as daily_cost,
    SUM(tokens_input) as daily_input_tokens,
    SUM(tokens_output) as daily_output_tokens
FROM ai_operations
WHERE user_decision = 'approved'
GROUP BY user_id, DATE(created_at), provider, operation_type
ORDER BY operation_date DESC;

-- View for budget status
CREATE VIEW IF NOT EXISTS v_budget_status AS
SELECT
    b.id as budget_id,
    b.user_id,
    b.budget_type,
    b.budget_amount,
    b.current_usage,
    ROUND((b.current_usage / b.budget_amount) * 100, 2) as usage_percentage,
    b.budget_amount - b.current_usage as remaining_budget,
    CASE
        WHEN b.current_usage >= b.budget_amount THEN 'exceeded'
        WHEN (b.current_usage / b.budget_amount) >= 0.95 THEN 'critical'
        WHEN (b.current_usage / b.budget_amount) >= 0.80 THEN 'warning'
        WHEN (b.current_usage / b.budget_amount) >= 0.50 THEN 'caution'
        ELSE 'normal'
    END as status,
    b.reset_date,
    b.updated_at
FROM ai_budgets b;

-- ===== AI TRANSPARENCY TRIGGERS =====

-- Update budget usage when AI operation completes
CREATE TRIGGER IF NOT EXISTS tr_update_budget_usage
AFTER UPDATE ON ai_operations
FOR EACH ROW
WHEN NEW.actual_cost IS NOT NULL AND OLD.actual_cost IS NULL AND NEW.user_decision = 'approved'
BEGIN
    UPDATE ai_budgets
    SET
        current_usage = current_usage + NEW.actual_cost,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id
    AND (
        (budget_type = 'daily' AND reset_date = DATE(NEW.created_at))
        OR (budget_type = 'monthly' AND DATE(reset_date, 'start of month') = DATE(NEW.created_at, 'start of month'))
        OR (budget_type = 'yearly' AND DATE(reset_date, 'start of year') = DATE(NEW.created_at, 'start of year'))
    );
END;

-- Create budget alerts when thresholds are reached
CREATE TRIGGER IF NOT EXISTS tr_create_budget_alerts
AFTER UPDATE ON ai_budgets
FOR EACH ROW
WHEN NEW.current_usage > OLD.current_usage
BEGIN
    -- 50% threshold
    INSERT OR IGNORE INTO ai_budget_alerts (user_id, budget_id, alert_type, current_usage, budget_amount, percentage_used)
    SELECT NEW.user_id, NEW.id, '50_percent', NEW.current_usage, NEW.budget_amount, (NEW.current_usage / NEW.budget_amount) * 100
    WHERE (NEW.current_usage / NEW.budget_amount) >= 0.50
    AND (OLD.current_usage / OLD.budget_amount) < 0.50
    AND NEW.alert_threshold_50 = TRUE;

    -- 80% threshold
    INSERT OR IGNORE INTO ai_budget_alerts (user_id, budget_id, alert_type, current_usage, budget_amount, percentage_used)
    SELECT NEW.user_id, NEW.id, '80_percent', NEW.current_usage, NEW.budget_amount, (NEW.current_usage / NEW.budget_amount) * 100
    WHERE (NEW.current_usage / NEW.budget_amount) >= 0.80
    AND (OLD.current_usage / OLD.budget_amount) < 0.80
    AND NEW.alert_threshold_80 = TRUE;

    -- 95% threshold
    INSERT OR IGNORE INTO ai_budget_alerts (user_id, budget_id, alert_type, current_usage, budget_amount, percentage_used)
    SELECT NEW.user_id, NEW.id, '95_percent', NEW.current_usage, NEW.budget_amount, (NEW.current_usage / NEW.budget_amount) * 100
    WHERE (NEW.current_usage / NEW.budget_amount) >= 0.95
    AND (OLD.current_usage / OLD.budget_amount) < 0.95
    AND NEW.alert_threshold_95 = TRUE;

    -- Exceeded threshold
    INSERT OR IGNORE INTO ai_budget_alerts (user_id, budget_id, alert_type, current_usage, budget_amount, percentage_used)
    SELECT NEW.user_id, NEW.id, 'exceeded', NEW.current_usage, NEW.budget_amount, (NEW.current_usage / NEW.budget_amount) * 100
    WHERE NEW.current_usage > NEW.budget_amount
    AND OLD.current_usage <= OLD.budget_amount;
END;

-- ===== INITIAL AI TRANSPARENCY DATA =====

-- Insert default cost rates for common AI providers
INSERT OR IGNORE INTO ai_cost_rates (provider, model, cost_per_1k_input_tokens, cost_per_1k_output_tokens, effective_date) VALUES
-- OpenAI GPT-4
('openai', 'gpt-4', 0.03, 0.06, '2024-01-01'),
('openai', 'gpt-4-turbo', 0.01, 0.03, '2024-01-01'),
('openai', 'gpt-3.5-turbo', 0.0015, 0.002, '2024-01-01'),
-- Google Gemini
('gemini', 'gemini-pro', 0.0005, 0.0015, '2024-01-01'),
('gemini', 'gemini-ultra', 0.002, 0.006, '2024-01-01'),
-- Anthropic Claude
('claude', 'claude-3-sonnet', 0.003, 0.015, '2024-01-01'),
('claude', 'claude-3-opus', 0.015, 0.075, '2024-01-01'),
('claude', 'claude-3-haiku', 0.00025, 0.00125, '2024-01-01'),
-- Local models (free)
('local', 'llama-2-7b', 0.0, 0.0, '2024-01-01'),
('local', 'llama-2-13b', 0.0, 0.0, '2024-01-01'),
('local', 'mistral-7b', 0.0, 0.0, '2024-01-01');

-- Insert system configuration for AI transparency
INSERT OR IGNORE INTO system_config (key, value, type, description) VALUES
('ai_transparency_enabled', 'true', 'boolean', 'Enable AI operation transparency and cost tracking'),
('ai_authorization_timeout_seconds', '30', 'integer', 'Default timeout for AI authorization dialogs'),
('ai_auto_approve_threshold', '0.01', 'float', 'Maximum cost for auto-approval without user confirmation'),
('ai_enable_usage_analytics', 'true', 'boolean', 'Enable AI usage analytics and reporting'),
('ai_budget_alert_email_enabled', 'false', 'boolean', 'Enable email alerts for budget thresholds'),
('ai_operation_history_retention_days', '365', 'integer', 'Number of days to retain AI operation history'),
('ai_cost_calculation_precision', '4', 'integer', 'Decimal places for cost calculations');

-- Analyze tables for query optimization
ANALYZE;