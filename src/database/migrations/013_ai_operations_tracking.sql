-- Migration: Add AI Operations Tracking for Incident Management
-- Purpose: Create tables to track AI operations, authorization, and costs for transparency
-- Author: AI Integration Specialist
-- Date: 2025-09-18

PRAGMA foreign_keys = ON;

-- ===== AI OPERATIONS TRACKING TABLE =====

-- Main table for tracking all AI operations across the system
CREATE TABLE IF NOT EXISTS ai_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT UNIQUE NOT NULL,                 -- Unique operation identifier
    operation_type TEXT NOT NULL CHECK(               -- Type of AI operation
        operation_type IN (
            'analyze_incident', 'semantic_search', 'suggest_solution',
            'explain_error', 'analyze_entry', 'generate_tags',
            'categorize_problem', 'find_similar', 'expand_context'
        )
    ),

    -- Context and references
    entry_id TEXT,                                     -- Related KB entry/incident ID
    user_id TEXT NOT NULL,                            -- User who requested operation
    session_id TEXT,                                   -- User session identifier

    -- Authorization tracking
    status TEXT NOT NULL DEFAULT 'pending_authorization' CHECK(
        status IN (
            'pending_authorization', 'authorized', 'denied', 'local_fallback',
            'in_progress', 'completed', 'failed', 'cancelled'
        )
    ),
    authorized_by TEXT,                               -- User who authorized operation
    authorized_at DATETIME,                          -- Authorization timestamp
    authorization_method TEXT,                       -- 'manual', 'auto_approved', 'remembered'

    -- Cost and resource tracking
    estimated_cost REAL,                             -- Estimated cost in USD
    estimated_tokens INTEGER,                        -- Estimated token count
    actual_cost REAL,                               -- Actual cost charged
    actual_tokens INTEGER,                          -- Actual tokens used

    -- Execution tracking
    started_at DATETIME,                            -- Operation start time
    completed_at DATETIME,                          -- Operation completion time
    execution_time_ms INTEGER,                      -- Execution time in milliseconds

    -- Data and results
    request_data TEXT,                              -- JSON: Original request parameters
    result_data TEXT,                               -- JSON: Operation results/output
    error_message TEXT,                             -- Error message if failed

    -- AI service details
    ai_service TEXT DEFAULT 'gemini',               -- AI service used (gemini, openai, etc.)
    ai_model TEXT DEFAULT 'gemini-pro',             -- Specific model used
    temperature REAL,                               -- AI temperature setting
    max_tokens INTEGER,                             -- Max tokens limit

    -- Quality and feedback
    quality_rating INTEGER CHECK(quality_rating BETWEEN 1 AND 5), -- User quality rating
    user_feedback TEXT,                             -- User feedback text
    accepted BOOLEAN,                               -- Whether result was accepted

    -- Audit and compliance
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,                                -- User IP for audit
    user_agent TEXT,                                -- User agent for audit

    -- Additional metadata
    metadata TEXT,                                  -- JSON: Additional context/metadata

    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE SET NULL
);

-- ===== AI AUTHORIZATION DECISIONS TABLE =====

-- Track user authorization decisions for learning and policy enforcement
CREATE TABLE IF NOT EXISTS ai_authorization_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL,                     -- Reference to ai_operations
    user_id TEXT NOT NULL,                         -- User making decision

    -- Decision details
    decision TEXT NOT NULL CHECK(                  -- Authorization decision
        decision IN ('approve_once', 'approve_always', 'deny', 'use_local_only', 'modify_query')
    ),
    decision_scope TEXT,                           -- JSON: Scope of decision (operation type, cost range, etc.)
    remember_decision BOOLEAN DEFAULT FALSE,       -- Whether to remember this decision
    decision_time_ms INTEGER,                      -- Time taken to make decision

    -- Context at time of decision
    estimated_cost_at_decision REAL,              -- Cost estimate when decision was made
    data_context TEXT,                            -- JSON: Data context at decision time
    modified_query TEXT,                          -- Modified query if applicable

    -- Notes and reasoning
    user_notes TEXT,                              -- User's notes about decision
    auto_applied BOOLEAN DEFAULT FALSE,            -- Whether decision was auto-applied from policy

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,

    FOREIGN KEY (operation_id) REFERENCES ai_operations(operation_id) ON DELETE CASCADE
);

-- ===== AI USAGE POLICIES TABLE =====

-- Store user preferences and automatic authorization policies
CREATE TABLE IF NOT EXISTS ai_usage_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                         -- User the policy applies to
    policy_name TEXT NOT NULL,                     -- Human-readable policy name

    -- Policy scope
    operation_types TEXT,                          -- JSON array: Operation types this applies to
    max_cost_usd REAL,                            -- Maximum cost for auto-approval
    max_tokens INTEGER,                            -- Maximum tokens for auto-approval
    data_sensitivity_levels TEXT,                  -- JSON array: Allowed data sensitivity levels

    -- Policy behavior
    auto_approve BOOLEAN DEFAULT FALSE,            -- Auto-approve operations matching criteria
    require_confirmation BOOLEAN DEFAULT TRUE,     -- Always require user confirmation
    use_local_fallback BOOLEAN DEFAULT FALSE,     -- Prefer local processing

    -- Policy metadata
    active BOOLEAN DEFAULT TRUE,                   -- Whether policy is active
    expires_at DATETIME,                          -- Policy expiration (NULL = no expiration)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Additional settings
    settings TEXT,                                 -- JSON: Additional policy settings

    UNIQUE(user_id, policy_name)
);

-- ===== AI COST SUMMARY TABLE =====

-- Aggregated cost tracking for reporting and budgeting
CREATE TABLE IF NOT EXISTS ai_cost_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary_date DATE NOT NULL,                    -- Date of summary (YYYY-MM-DD)
    user_id TEXT,                                 -- User (NULL for system-wide)
    operation_type TEXT,                          -- Operation type (NULL for all types)

    -- Cost metrics
    total_operations INTEGER DEFAULT 0,           -- Number of operations
    total_estimated_cost REAL DEFAULT 0,         -- Total estimated cost
    total_actual_cost REAL DEFAULT 0,            -- Total actual cost
    total_tokens INTEGER DEFAULT 0,              -- Total tokens used

    -- Success metrics
    successful_operations INTEGER DEFAULT 0,      -- Successfully completed operations
    failed_operations INTEGER DEFAULT 0,         -- Failed operations
    cancelled_operations INTEGER DEFAULT 0,      -- Cancelled operations

    -- Authorization metrics
    auto_approved INTEGER DEFAULT 0,             -- Auto-approved operations
    manually_approved INTEGER DEFAULT 0,         -- Manually approved operations
    denied_operations INTEGER DEFAULT 0,         -- Denied operations
    local_fallback_used INTEGER DEFAULT 0,       -- Used local fallback instead

    -- Time metrics
    avg_execution_time_ms REAL,                  -- Average execution time
    total_execution_time_ms INTEGER DEFAULT 0,   -- Total execution time

    -- Quality metrics
    avg_quality_rating REAL,                     -- Average user quality rating
    accepted_results INTEGER DEFAULT 0,          -- Results accepted by users

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(summary_date, user_id, operation_type)
);

-- ===== INDEXES FOR PERFORMANCE =====

-- Indexes for ai_operations table
CREATE INDEX IF NOT EXISTS idx_ai_operations_operation_id ON ai_operations(operation_id);
CREATE INDEX IF NOT EXISTS idx_ai_operations_entry_id ON ai_operations(entry_id);
CREATE INDEX IF NOT EXISTS idx_ai_operations_user_id ON ai_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_operations_status ON ai_operations(status);
CREATE INDEX IF NOT EXISTS idx_ai_operations_type ON ai_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_operations_created_at ON ai_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_operations_authorized_at ON ai_operations(authorized_at);

-- Indexes for ai_authorization_decisions table
CREATE INDEX IF NOT EXISTS idx_ai_auth_decisions_operation_id ON ai_authorization_decisions(operation_id);
CREATE INDEX IF NOT EXISTS idx_ai_auth_decisions_user_id ON ai_authorization_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_auth_decisions_decision ON ai_authorization_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_ai_auth_decisions_created_at ON ai_authorization_decisions(created_at);

-- Indexes for ai_usage_policies table
CREATE INDEX IF NOT EXISTS idx_ai_policies_user_id ON ai_usage_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_policies_active ON ai_usage_policies(active);
CREATE INDEX IF NOT EXISTS idx_ai_policies_expires_at ON ai_usage_policies(expires_at);

-- Indexes for ai_cost_summary table
CREATE INDEX IF NOT EXISTS idx_ai_cost_summary_date ON ai_cost_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_ai_cost_summary_user_id ON ai_cost_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_summary_type ON ai_cost_summary(operation_type);

-- ===== TRIGGERS FOR AUTOMATIC UPDATES =====

-- Update ai_operations.updated_at on changes
CREATE TRIGGER IF NOT EXISTS tr_ai_operations_updated_at
AFTER UPDATE ON ai_operations
FOR EACH ROW
BEGIN
    UPDATE ai_operations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update ai_usage_policies.updated_at on changes
CREATE TRIGGER IF NOT EXISTS tr_ai_policies_updated_at
AFTER UPDATE ON ai_usage_policies
FOR EACH ROW
BEGIN
    UPDATE ai_usage_policies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update ai_cost_summary.updated_at on changes
CREATE TRIGGER IF NOT EXISTS tr_ai_cost_summary_updated_at
AFTER UPDATE ON ai_cost_summary
FOR EACH ROW
BEGIN
    UPDATE ai_cost_summary SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-update cost summary when AI operations complete
CREATE TRIGGER IF NOT EXISTS tr_ai_operations_cost_summary
AFTER UPDATE ON ai_operations
FOR EACH ROW
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    -- Insert or update daily cost summary
    INSERT OR REPLACE INTO ai_cost_summary (
        summary_date, user_id, operation_type,
        total_operations, total_estimated_cost, total_actual_cost, total_tokens,
        successful_operations, avg_execution_time_ms, total_execution_time_ms
    )
    SELECT
        DATE(NEW.completed_at) as summary_date,
        NEW.user_id,
        NEW.operation_type,
        COUNT(*) as total_operations,
        COALESCE(SUM(estimated_cost), 0) as total_estimated_cost,
        COALESCE(SUM(actual_cost), 0) as total_actual_cost,
        COALESCE(SUM(actual_tokens), 0) as total_tokens,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_operations,
        COALESCE(AVG(execution_time_ms), 0) as avg_execution_time_ms,
        COALESCE(SUM(execution_time_ms), 0) as total_execution_time_ms
    FROM ai_operations
    WHERE DATE(COALESCE(completed_at, created_at)) = DATE(NEW.completed_at)
        AND user_id = NEW.user_id
        AND operation_type = NEW.operation_type;
END;

-- ===== VIEWS FOR REPORTING =====

-- AI Operations Dashboard View
CREATE VIEW IF NOT EXISTS v_ai_operations_dashboard AS
SELECT
    ao.operation_id,
    ao.operation_type,
    ao.user_id,
    ao.status,
    ao.created_at,
    ao.completed_at,
    ao.estimated_cost,
    ao.actual_cost,
    ao.estimated_tokens,
    ao.actual_tokens,
    ao.execution_time_ms,
    ao.quality_rating,
    ao.accepted,
    ao.ai_service,
    ao.ai_model,

    -- Authorization info
    ad.decision as authorization_decision,
    ad.decision_time_ms as authorization_time_ms,
    ad.auto_applied as auto_authorized,

    -- Cost efficiency
    CASE
        WHEN ao.estimated_cost > 0 AND ao.actual_cost > 0 THEN
            ROUND((ao.actual_cost / ao.estimated_cost) * 100, 2)
        ELSE NULL
    END as cost_accuracy_percentage,

    -- Time efficiency
    CASE
        WHEN ao.completed_at IS NOT NULL AND ao.started_at IS NOT NULL THEN
            ROUND((julianday(ao.completed_at) - julianday(ao.started_at)) * 24 * 60 * 60 * 1000, 0)
        ELSE NULL
    END as total_time_ms,

    -- Related entry info
    kb.title as related_entry_title,
    kb.category as related_entry_category

FROM ai_operations ao
LEFT JOIN ai_authorization_decisions ad ON ao.operation_id = ad.operation_id
LEFT JOIN kb_entries kb ON ao.entry_id = kb.id
WHERE ao.created_at >= datetime('now', '-30 days')
ORDER BY ao.created_at DESC;

-- AI Cost Analysis View
CREATE VIEW IF NOT EXISTS v_ai_cost_analysis AS
SELECT
    user_id,
    operation_type,
    COUNT(*) as total_operations,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_operations,
    ROUND(SUM(COALESCE(actual_cost, estimated_cost)), 4) as total_cost_usd,
    ROUND(AVG(COALESCE(actual_cost, estimated_cost)), 4) as avg_cost_per_operation,
    SUM(COALESCE(actual_tokens, estimated_tokens)) as total_tokens,
    ROUND(AVG(COALESCE(actual_tokens, estimated_tokens)), 0) as avg_tokens_per_operation,

    -- Time metrics
    ROUND(AVG(execution_time_ms), 0) as avg_execution_time_ms,
    ROUND(SUM(execution_time_ms), 0) as total_execution_time_ms,

    -- Quality metrics
    ROUND(AVG(quality_rating), 2) as avg_quality_rating,
    COUNT(CASE WHEN accepted = TRUE THEN 1 END) as accepted_count,
    ROUND(CAST(COUNT(CASE WHEN accepted = TRUE THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as acceptance_rate,

    -- Authorization metrics
    COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied_count,
    COUNT(CASE WHEN status = 'local_fallback' THEN 1 END) as local_fallback_count,

    MIN(created_at) as first_operation,
    MAX(created_at) as last_operation

FROM ai_operations
WHERE created_at >= datetime('now', '-90 days')
GROUP BY user_id, operation_type
ORDER BY total_cost_usd DESC;

-- ===== CLEANUP PROCEDURES =====

-- Insert cleanup policy for old AI operations
INSERT OR IGNORE INTO ai_usage_policies (
    user_id, policy_name, operation_types, max_cost_usd, max_tokens,
    auto_approve, require_confirmation, active, settings
) VALUES (
    'system', 'Default Cleanup Policy', '["all"]', 0.50, 5000,
    FALSE, TRUE, TRUE,
    '{"cleanup_after_days": 90, "archive_high_value": true}'
);

-- ===== DEFAULT POLICIES =====

-- Insert default AI usage policy for new users
INSERT OR IGNORE INTO ai_usage_policies (
    user_id, policy_name, operation_types, max_cost_usd, max_tokens,
    auto_approve, require_confirmation, active, settings
) VALUES (
    'default', 'Conservative AI Usage', '["analyze_incident", "semantic_search"]', 0.10, 2000,
    FALSE, TRUE, TRUE,
    '{"require_confirmation_for_sensitive_data": true, "prefer_local_fallback": false}'
);

-- Update schema version
INSERT OR IGNORE INTO schema_versions (version, description, applied_at) VALUES (
    4, 'AI operations tracking and authorization system', CURRENT_TIMESTAMP
);

-- Optimize tables
ANALYZE ai_operations;
ANALYZE ai_authorization_decisions;
ANALYZE ai_usage_policies;
ANALYZE ai_cost_summary;

-- ===== MIGRATION COMPLETE =====
SELECT 'AI operations tracking migration completed successfully' as result;