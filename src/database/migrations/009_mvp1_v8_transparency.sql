-- MVP1 v8 Transparency Features Schema Migration
-- Date: 2025-09-16
-- Adds support for AI transparency, cost tracking, and authorization

-- ================================================================
-- 1. AI AUTHORIZATION TRACKING
-- ================================================================

-- Store user authorization preferences for AI operations
CREATE TABLE IF NOT EXISTS ai_authorization_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    operation_type TEXT NOT NULL CHECK(operation_type IN ('semantic_search', 'explain_error', 'analyze_entry', 'suggest_similar')),
    authorization_mode TEXT NOT NULL CHECK(authorization_mode IN ('always_ask', 'always_allow', 'always_deny', 'auto_below_limit')),
    cost_limit REAL DEFAULT 0.01, -- Maximum cost to auto-approve
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, operation_type)
);

-- Log all AI authorization decisions
CREATE TABLE IF NOT EXISTS ai_authorization_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT NOT NULL DEFAULT 'default',
    operation_type TEXT NOT NULL,
    query TEXT NOT NULL,
    estimated_tokens INTEGER,
    estimated_cost REAL,
    estimated_time_ms INTEGER,
    user_decision TEXT NOT NULL CHECK(user_decision IN ('approved', 'denied', 'modified', 'use_local')),
    decision_time_ms INTEGER, -- How long user took to decide
    modified_query TEXT, -- If user modified the query
    session_id TEXT,
    context_entry_id TEXT,
    FOREIGN KEY (context_entry_id) REFERENCES kb_entries(id)
);

-- ================================================================
-- 2. COST TRACKING
-- ================================================================

-- Track costs for all AI operations
CREATE TABLE IF NOT EXISTS ai_cost_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    operation_id TEXT UNIQUE NOT NULL, -- UUID for operation
    operation_type TEXT NOT NULL,
    model TEXT DEFAULT 'gemini-pro',
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost_per_1k_input REAL DEFAULT 0.00025, -- Current Gemini pricing
    cost_per_1k_output REAL DEFAULT 0.00125,
    total_cost REAL GENERATED ALWAYS AS
        ((input_tokens * cost_per_1k_input / 1000.0) +
         (output_tokens * cost_per_1k_output / 1000.0)) STORED,
    user_id TEXT DEFAULT 'default',
    session_id TEXT,
    kb_entry_id TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id)
);

-- Cost limits and budgets
CREATE TABLE IF NOT EXISTS ai_cost_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    budget_type TEXT NOT NULL CHECK(budget_type IN ('daily', 'weekly', 'monthly')),
    budget_amount REAL NOT NULL,
    current_usage REAL DEFAULT 0,
    period_start DATETIME NOT NULL,
    period_end DATETIME NOT NULL,
    alert_threshold REAL DEFAULT 0.8, -- Alert at 80% of budget
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, budget_type, period_start)
);

-- ================================================================
-- 3. OPERATION LOGGING
-- ================================================================

-- Comprehensive operation logging for all AI interactions
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    operation_type TEXT NOT NULL,
    operation_subtype TEXT,
    user_id TEXT DEFAULT 'default',
    session_id TEXT,

    -- Request details
    request_query TEXT,
    request_params TEXT, -- JSON
    request_source TEXT CHECK(request_source IN ('ui', 'api', 'cli', 'automation')),

    -- Authorization
    authorization_required BOOLEAN DEFAULT FALSE,
    authorization_result TEXT,

    -- Performance
    response_time_ms INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,

    -- AI specific
    ai_used BOOLEAN DEFAULT FALSE,
    ai_model TEXT,
    ai_tokens_used INTEGER,
    ai_cost REAL,

    -- Results
    success BOOLEAN DEFAULT TRUE,
    error_code TEXT,
    error_message TEXT,
    result_count INTEGER,
    result_quality_score REAL, -- 0-1 score

    -- Context
    kb_entry_id TEXT,
    category TEXT,
    tags TEXT, -- JSON array

    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id)
);

-- ================================================================
-- 4. ENHANCED KB_ENTRIES FIELDS
-- ================================================================

-- Add new fields to kb_entries for v8 features
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS jcl_type TEXT;
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS cobol_version TEXT;
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS system_component TEXT;
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS error_codes TEXT; -- JSON array
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS relevance_score REAL DEFAULT 1.0;
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS semantic_embedding BLOB; -- For future vector search
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS last_ai_analysis DATETIME;
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS ai_quality_score REAL; -- AI assessment of entry quality
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS metadata TEXT; -- JSON for extensible metadata

-- ================================================================
-- 5. QUERY ROUTING & SCORING
-- ================================================================

-- Store query patterns for routing optimization
CREATE TABLE IF NOT EXISTS query_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT UNIQUE NOT NULL,
    pattern_type TEXT CHECK(pattern_type IN ('functional', 'technical', 'hybrid')),
    confidence REAL DEFAULT 0.5,
    sample_count INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 0.5,
    avg_result_quality REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Multi-dimensional scoring configuration
CREATE TABLE IF NOT EXISTS scoring_dimensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dimension_name TEXT UNIQUE NOT NULL,
    dimension_type TEXT CHECK(dimension_type IN ('text_relevance', 'category_match', 'semantic_similarity', 'usage_frequency', 'recency', 'user_preference')),
    weight REAL DEFAULT 1.0 CHECK(weight >= 0 AND weight <= 10),
    enabled BOOLEAN DEFAULT TRUE,
    calculation_method TEXT, -- JSON with calculation parameters
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default scoring dimensions
INSERT OR IGNORE INTO scoring_dimensions (dimension_name, dimension_type, weight) VALUES
    ('FTS5 Text Match', 'text_relevance', 3.0),
    ('Category Alignment', 'category_match', 2.0),
    ('Semantic Similarity', 'semantic_similarity', 2.5),
    ('Usage Frequency', 'usage_frequency', 1.5),
    ('Recency Factor', 'recency', 1.0),
    ('User Preference', 'user_preference', 1.5);

-- ================================================================
-- 6. USER PREFERENCES & PERSONALIZATION
-- ================================================================

-- Store user-specific preferences for search and AI
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL DEFAULT 'default',

    -- Search preferences
    preferred_categories TEXT, -- JSON array
    preferred_result_count INTEGER DEFAULT 10,
    include_archived BOOLEAN DEFAULT FALSE,

    -- AI preferences
    ai_enabled BOOLEAN DEFAULT TRUE,
    ai_auto_approve_limit REAL DEFAULT 0.005, -- $0.005 auto-approve
    ai_monthly_budget REAL DEFAULT 10.0, -- $10/month
    ai_require_authorization BOOLEAN DEFAULT TRUE,

    -- UI preferences
    theme TEXT DEFAULT 'light',
    language TEXT DEFAULT 'en',
    show_cost_in_results BOOLEAN DEFAULT TRUE,
    show_confidence_scores BOOLEAN DEFAULT FALSE,

    -- Performance preferences
    enable_caching BOOLEAN DEFAULT TRUE,
    cache_duration_minutes INTEGER DEFAULT 60,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- 7. DASHBOARD METRICS
-- ================================================================

-- Pre-aggregated metrics for dashboard performance
CREATE TABLE IF NOT EXISTS dashboard_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_date DATE NOT NULL,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    user_id TEXT DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_date, metric_type, metric_name, user_id)
);

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- Authorization and cost tracking indexes
CREATE INDEX IF NOT EXISTS idx_auth_log_user_timestamp ON ai_authorization_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_timestamp ON ai_cost_tracking(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_date ON ai_cost_tracking(user_id, DATE(timestamp));
CREATE INDEX IF NOT EXISTS idx_cost_budgets_user_type ON ai_cost_budgets(user_id, budget_type);

-- Operation logging indexes
CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON operation_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_session ON operation_logs(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(operation_type, operation_subtype);

-- Query patterns and scoring indexes
CREATE INDEX IF NOT EXISTS idx_query_patterns_type ON query_patterns(pattern_type, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_dimensions_enabled ON scoring_dimensions(enabled, weight DESC);

-- Dashboard metrics index
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_lookup ON dashboard_metrics(user_id, metric_date DESC, metric_type);

-- ================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================================================

-- Update timestamps automatically
CREATE TRIGGER IF NOT EXISTS update_auth_prefs_timestamp
AFTER UPDATE ON ai_authorization_preferences
BEGIN
    UPDATE ai_authorization_preferences
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_prefs_timestamp
AFTER UPDATE ON user_preferences
BEGIN
    UPDATE user_preferences
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Update budget usage automatically
CREATE TRIGGER IF NOT EXISTS update_budget_usage
AFTER INSERT ON ai_cost_tracking
BEGIN
    UPDATE ai_cost_budgets
    SET current_usage = current_usage + NEW.total_cost
    WHERE user_id = NEW.user_id
    AND datetime(NEW.timestamp) BETWEEN period_start AND period_end;
END;

-- ================================================================
-- VIEWS FOR EASY QUERYING
-- ================================================================

-- Current day cost summary
CREATE VIEW IF NOT EXISTS v_daily_costs AS
SELECT
    user_id,
    DATE(timestamp) as cost_date,
    COUNT(*) as operation_count,
    SUM(total_tokens) as total_tokens,
    SUM(total_cost) as total_cost,
    AVG(total_cost) as avg_cost_per_operation
FROM ai_cost_tracking
WHERE DATE(timestamp) = DATE('now', 'localtime')
GROUP BY user_id, DATE(timestamp);

-- Authorization decision patterns
CREATE VIEW IF NOT EXISTS v_authorization_patterns AS
SELECT
    user_id,
    operation_type,
    user_decision,
    COUNT(*) as decision_count,
    AVG(estimated_cost) as avg_estimated_cost,
    AVG(decision_time_ms) as avg_decision_time
FROM ai_authorization_log
WHERE timestamp > datetime('now', '-30 days')
GROUP BY user_id, operation_type, user_decision;

-- Operation performance summary
CREATE VIEW IF NOT EXISTS v_operation_performance AS
SELECT
    operation_type,
    DATE(timestamp) as operation_date,
    COUNT(*) as total_operations,
    AVG(response_time_ms) as avg_response_time,
    SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as cache_hit_rate,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM operation_logs
WHERE timestamp > datetime('now', '-7 days')
GROUP BY operation_type, DATE(timestamp);

-- ================================================================
-- INITIAL DATA & CONFIGURATION
-- ================================================================

-- Insert default system configuration for v8
INSERT OR REPLACE INTO system_config (key, value, type, description) VALUES
    ('ai.authorization.enabled', 'true', 'boolean', 'Require authorization for AI operations'),
    ('ai.cost.tracking.enabled', 'true', 'boolean', 'Track costs for AI operations'),
    ('ai.cost.display.currency', 'USD', 'string', 'Currency for cost display'),
    ('ai.cost.warning.threshold', '0.10', 'float', 'Warn when single operation exceeds this cost'),
    ('ai.default.model', 'gemini-pro', 'string', 'Default AI model to use'),
    ('transparency.dashboard.enabled', 'true', 'boolean', 'Show transparency dashboard'),
    ('query.routing.enabled', 'true', 'boolean', 'Enable intelligent query routing'),
    ('scoring.multidimensional.enabled', 'true', 'boolean', 'Use multi-dimensional scoring');

-- Update schema version
INSERT INTO schema_versions (version, description)
VALUES (9, 'MVP1 v8 Transparency Features - Authorization, Cost Tracking, Operation Logging');

-- ================================================================
-- END OF MIGRATION
-- ================================================================