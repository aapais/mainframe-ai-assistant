-- ===== UNIFIED KNOWLEDGE BASE AND INCIDENT MANAGEMENT SCHEMA =====
-- Merges kb_entries and incidents into a single 'entries' table
-- Provides backward compatibility through views
-- Optimized for full-text search, analytics, and performance
-- Version: 3.0.0 - Unified Schema

-- Enable foreign keys and other pragmas
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB

-- ===== CORE UNIFIED TABLE =====

-- Main unified entries table (replaces both kb_entries and incidents)
CREATE TABLE IF NOT EXISTS entries (
    -- Primary identification
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 255),

    -- Entry type and classification flags
    entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')) DEFAULT 'knowledge',
    is_knowledge_base BOOLEAN GENERATED ALWAYS AS (entry_type = 'knowledge') STORED,
    is_incident BOOLEAN GENERATED ALWAYS AS (entry_type = 'incident') STORED,

    -- Content fields (flexible for both knowledge and incidents)
    description TEXT NOT NULL CHECK(length(description) >= 10 AND length(description) <= 10000),
    problem TEXT CHECK(length(problem) <= 5000), -- For KB entries and incident problem description
    solution TEXT CHECK(length(solution) <= 10000), -- For KB entries and incident resolution

    -- Category and classification
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Hardware', 'Software', 'System', 'Other')),
    subcategory TEXT CHECK(length(subcategory) <= 100),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    priority INTEGER DEFAULT 3 CHECK(priority >= 1 AND priority <= 5),

    -- Status (unified for both types)
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived', 'deleted', 'aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao')),

    -- Incident-specific fields
    incident_status TEXT CHECK(incident_status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao')),
    assigned_team TEXT CHECK(length(assigned_team) <= 100),
    assigned_to TEXT CHECK(length(assigned_to) <= 100),
    reporter TEXT CHECK(length(reporter) <= 100),
    resolution_type TEXT CHECK(resolution_type IN ('fixed', 'workaround', 'duplicate', 'cannot_reproduce', 'invalid', 'wont_fix')),
    root_cause TEXT CHECK(length(root_cause) <= 2000),

    -- Time tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT DEFAULT 'system' CHECK(length(created_by) <= 100),

    -- Incident time tracking
    first_response_at DATETIME,
    assigned_at DATETIME,
    in_progress_at DATETIME,
    resolved_at DATETIME,
    closed_at DATETIME,
    last_used DATETIME,

    -- Metrics and analytics
    usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
    success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
    failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
    escalation_count INTEGER DEFAULT 0 CHECK(escalation_count >= 0),
    reopen_count INTEGER DEFAULT 0 CHECK(reopen_count >= 0),

    -- Time metrics
    resolution_time_hours REAL CHECK(resolution_time_hours >= 0),
    response_time_hours REAL CHECK(response_time_hours >= 0),

    -- SLA tracking
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_target_response_hours INTEGER CHECK(sla_target_response_hours > 0),
    sla_target_resolution_hours INTEGER CHECK(sla_target_resolution_hours > 0),

    -- Quality and confidence
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 100),
    ai_confidence_score REAL CHECK(ai_confidence_score >= 0 AND ai_confidence_score <= 1),
    ai_suggested_category TEXT CHECK(length(ai_suggested_category) <= 50),
    ai_processed BOOLEAN DEFAULT FALSE,

    -- Relationships and links
    related_entries TEXT, -- JSON array of related entry IDs
    related_kb_entries TEXT, -- JSON array of KB entry IDs (for incidents)
    parent_entry_id TEXT,

    -- Flexible metadata
    tags TEXT, -- JSON array of tags
    custom_fields TEXT, -- JSON for custom fields
    attachments TEXT, -- JSON array of attachment info
    metadata TEXT, -- JSON blob for additional context

    -- Flags
    archived BOOLEAN DEFAULT FALSE,
    pinned BOOLEAN DEFAULT FALSE,
    featured BOOLEAN DEFAULT FALSE,

    -- Version control
    version INTEGER DEFAULT 1 CHECK(version >= 1),

    -- Constraints and relationships
    FOREIGN KEY (parent_entry_id) REFERENCES entries(id) ON DELETE SET NULL,

    -- Validation constraints
    CHECK (
        CASE
            WHEN entry_type = 'knowledge' THEN problem IS NOT NULL AND solution IS NOT NULL
            WHEN entry_type = 'incident' THEN reporter IS NOT NULL
            ELSE 1
        END
    ),

    CHECK (
        CASE
            WHEN entry_type = 'incident' THEN incident_status IS NOT NULL
            ELSE incident_status IS NULL
        END
    )
);

-- ===== SUPPORTING TABLES =====

-- Unified tags table for flexible tagging system
CREATE TABLE IF NOT EXISTS entry_tags (
    entry_id TEXT NOT NULL,
    tag TEXT NOT NULL CHECK(length(tag) >= 1 AND length(tag) <= 50),
    tag_type TEXT DEFAULT 'user' CHECK(tag_type IN ('user', 'system', 'auto', 'category')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entry_id, tag),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Unified feedback table for user ratings and comments
CREATE TABLE IF NOT EXISTS entry_feedback (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    user_id TEXT CHECK(length(user_id) <= 100),
    feedback_type TEXT DEFAULT 'rating' CHECK(feedback_type IN ('rating', 'comment', 'success', 'failure', 'helpful')),
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    successful BOOLEAN,
    comment TEXT CHECK(length(comment) <= 2000),
    session_id TEXT CHECK(length(session_id) <= 100),
    resolution_time INTEGER CHECK(resolution_time >= 0),
    helpful_rating INTEGER CHECK(helpful_rating >= 1 AND helpful_rating <= 5),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON for additional feedback data
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Entry relationships table for linking related entries
CREATE TABLE IF NOT EXISTS entry_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_entry_id TEXT NOT NULL,
    target_entry_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN ('related', 'duplicate', 'blocks', 'blocked_by', 'parent', 'child', 'caused_by', 'causes', 'superseded_by', 'supersedes', 'reference', 'dependency')),
    similarity_score REAL DEFAULT 0.0 CHECK(similarity_score >= 0 AND similarity_score <= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT CHECK(length(created_by) <= 100),
    notes TEXT CHECK(length(notes) <= 1000),
    active BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (source_entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    FOREIGN KEY (target_entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    UNIQUE(source_entry_id, target_entry_id, relationship_type)
);

-- Entry comments/updates for tracking progress and communication
CREATE TABLE IF NOT EXISTS entry_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    comment_type TEXT DEFAULT 'comment' CHECK(comment_type IN ('comment', 'status_change', 'assignment', 'escalation', 'resolution', 'update', 'note', 'clarification')),
    content TEXT NOT NULL CHECK(length(content) >= 1 AND length(content) <= 5000),
    author TEXT NOT NULL CHECK(length(author) <= 100),
    is_internal BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON for additional comment data

    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Usage metrics table for detailed tracking
CREATE TABLE IF NOT EXISTS usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure', 'export', 'print', 'share', 'create', 'update', 'delete', 'search', 'apply', 'resolve')),
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER CHECK(duration_seconds >= 0),
    success BOOLEAN,
    metadata TEXT, -- JSON blob for additional context

    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Search history table for analytics
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL CHECK(length(query) <= 500),
    normalized_query TEXT CHECK(length(normalized_query) <= 500),
    search_type TEXT DEFAULT 'basic' CHECK(search_type IN ('basic', 'advanced', 'semantic', 'ai', 'fts')),
    results_count INTEGER NOT NULL CHECK(results_count >= 0),
    selected_entry_id TEXT,
    entry_type_filter TEXT CHECK(entry_type_filter IN ('knowledge', 'incident', 'all')),
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    search_time_ms INTEGER CHECK(search_time_ms >= 0),
    filters_used TEXT, -- JSON blob for search filters
    ai_used BOOLEAN DEFAULT FALSE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (selected_entry_id) REFERENCES entries(id) ON DELETE SET NULL
);

-- SLA policies for different entry categories/severities
CREATE TABLE IF NOT EXISTS sla_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE CHECK(length(name) <= 100),
    entry_type TEXT CHECK(entry_type IN ('knowledge', 'incident', 'all')) DEFAULT 'all',
    category TEXT CHECK(length(category) <= 50),
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    priority_min INTEGER CHECK(priority_min >= 1 AND priority_min <= 5),
    priority_max INTEGER CHECK(priority_max >= 1 AND priority_max <= 5),
    response_time_hours INTEGER NOT NULL CHECK(response_time_hours > 0),
    resolution_time_hours INTEGER NOT NULL CHECK(resolution_time_hours > 0),
    escalation_rules TEXT, -- JSON for escalation rules
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Automation rules for entry processing
CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK(length(name) <= 100),
    description TEXT CHECK(length(description) <= 500),
    entry_type TEXT CHECK(entry_type IN ('knowledge', 'incident', 'all')) DEFAULT 'all',
    rule_type TEXT NOT NULL CHECK(rule_type IN ('auto_assign', 'auto_categorize', 'auto_escalate', 'auto_close', 'notification', 'auto_tag', 'auto_relate')),
    conditions TEXT NOT NULL, -- JSON conditions
    actions TEXT NOT NULL, -- JSON actions
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100 CHECK(priority > 0),
    success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
    failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
    last_executed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT CHECK(length(created_by) <= 100)
);

-- Entry metrics snapshots for trend analysis
CREATE TABLE IF NOT EXISTS entry_metrics_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date DATE NOT NULL,
    period_type TEXT NOT NULL CHECK(period_type IN ('daily', 'weekly', 'monthly')),
    entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident', 'all')),

    -- Volume metrics
    total_entries INTEGER DEFAULT 0 CHECK(total_entries >= 0),
    new_entries INTEGER DEFAULT 0 CHECK(new_entries >= 0),
    updated_entries INTEGER DEFAULT 0 CHECK(updated_entries >= 0),
    resolved_entries INTEGER DEFAULT 0 CHECK(resolved_entries >= 0),
    archived_entries INTEGER DEFAULT 0 CHECK(archived_entries >= 0),

    -- Knowledge base specific
    kb_usage_count INTEGER DEFAULT 0 CHECK(kb_usage_count >= 0),
    kb_success_rate REAL DEFAULT 0 CHECK(kb_success_rate >= 0 AND kb_success_rate <= 100),

    -- Incident specific
    incident_resolved INTEGER DEFAULT 0 CHECK(incident_resolved >= 0),
    incident_closed INTEGER DEFAULT 0 CHECK(incident_closed >= 0),
    incident_reopened INTEGER DEFAULT 0 CHECK(incident_reopened >= 0),

    -- Time metrics
    avg_response_time_hours REAL DEFAULT 0 CHECK(avg_response_time_hours >= 0),
    avg_resolution_time_hours REAL DEFAULT 0 CHECK(avg_resolution_time_hours >= 0),
    avg_mttr_hours REAL DEFAULT 0 CHECK(avg_mttr_hours >= 0),

    -- Category breakdown (JSON)
    category_breakdown TEXT,
    severity_breakdown TEXT,
    team_breakdown TEXT,

    -- SLA metrics
    sla_met_percentage REAL DEFAULT 0 CHECK(sla_met_percentage >= 0 AND sla_met_percentage <= 100),
    sla_breaches INTEGER DEFAULT 0 CHECK(sla_breaches >= 0),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(snapshot_date, period_type, entry_type)
);

-- Team performance metrics
CREATE TABLE IF NOT EXISTS team_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL CHECK(length(team_name) <= 100),
    member_name TEXT CHECK(length(member_name) <= 100),
    metric_date DATE NOT NULL,
    entry_type TEXT DEFAULT 'all' CHECK(entry_type IN ('knowledge', 'incident', 'all')),

    -- Volume metrics
    entries_assigned INTEGER DEFAULT 0 CHECK(entries_assigned >= 0),
    entries_resolved INTEGER DEFAULT 0 CHECK(entries_resolved >= 0),
    entries_escalated INTEGER DEFAULT 0 CHECK(entries_escalated >= 0),
    kb_entries_created INTEGER DEFAULT 0 CHECK(kb_entries_created >= 0),
    kb_entries_updated INTEGER DEFAULT 0 CHECK(kb_entries_updated >= 0),

    -- Quality metrics
    avg_resolution_time_hours REAL DEFAULT 0 CHECK(avg_resolution_time_hours >= 0),
    customer_satisfaction_score REAL CHECK(customer_satisfaction_score >= 0 AND customer_satisfaction_score <= 5),
    first_call_resolution_rate REAL CHECK(first_call_resolution_rate >= 0 AND first_call_resolution_rate <= 100),
    knowledge_reuse_rate REAL CHECK(knowledge_reuse_rate >= 0 AND knowledge_reuse_rate <= 100),

    -- SLA performance
    sla_met_count INTEGER DEFAULT 0 CHECK(sla_met_count >= 0),
    sla_missed_count INTEGER DEFAULT 0 CHECK(sla_missed_count >= 0),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_name, member_name, metric_date, entry_type)
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY CHECK(length(key) <= 100),
    value TEXT NOT NULL CHECK(length(value) <= 2000),
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT CHECK(length(description) <= 500),
    category TEXT DEFAULT 'general' CHECK(length(category) <= 50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backup log table for tracking backups
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

-- Audit log table for tracking all changes
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

-- Query performance table for monitoring
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

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_versions (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== FULL-TEXT SEARCH =====

-- Create Full-Text Search virtual table for unified search
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    problem,
    solution,
    tags,
    entry_type UNINDEXED,
    category UNINDEXED,
    content=entries,
    content_rowid=id
);

-- ===== PERFORMANCE INDEXES =====

-- Primary entry indexes
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(entry_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category, entry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_severity ON entries(severity, entry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status, entry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_assigned ON entries(assigned_to, entry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_team ON entries(assigned_team, entry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_reporter ON entries(reporter, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_resolved_at ON entries(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_usage ON entries(usage_count DESC, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_success_rate ON entries(success_count, failure_count, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_sla_breach ON entries(sla_breach, severity, entry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_archived ON entries(archived, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_parent ON entries(parent_entry_id);
CREATE INDEX IF NOT EXISTS idx_entries_ai_processed ON entries(ai_processed, entry_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entries_type_status_severity ON entries(entry_type, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_kb_active ON entries(entry_type, archived, status) WHERE entry_type = 'knowledge';
CREATE INDEX IF NOT EXISTS idx_entries_incident_open ON entries(entry_type, incident_status, assigned_team) WHERE entry_type = 'incident';

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag, entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_id ON entry_tags(entry_id, tag_type);
CREATE INDEX IF NOT EXISTS idx_entry_tags_type ON entry_tags(tag_type, tag);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_entry_relationships_source ON entry_relationships(source_entry_id, relationship_type, active);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_target ON entry_relationships(target_entry_id, relationship_type, active);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_similarity ON entry_relationships(similarity_score DESC, active);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_entry_feedback_entry ON entry_feedback(entry_id, feedback_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_entry_feedback_rating ON entry_feedback(rating, feedback_type);
CREATE INDEX IF NOT EXISTS idx_entry_feedback_user ON entry_feedback(user_id, timestamp DESC);

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_entry_comments_entry ON entry_comments(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_comments_author ON entry_comments(author, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_comments_type ON entry_comments(comment_type, is_internal);

-- Usage metrics indexes
CREATE INDEX IF NOT EXISTS idx_usage_entry_action ON usage_metrics(entry_id, action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_user_session ON usage_metrics(user_id, session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_metrics(timestamp DESC);

-- Search history indexes
CREATE INDEX IF NOT EXISTS idx_search_query_type ON search_history(normalized_query, search_type, entry_type_filter);
CREATE INDEX IF NOT EXISTS idx_search_user_session ON search_history(user_id, session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp DESC);

-- System table indexes
CREATE INDEX IF NOT EXISTS idx_sla_policies_active ON sla_policies(entry_type, category, severity, active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON automation_rules(entry_type, rule_type, enabled, priority);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_date ON entry_metrics_snapshots(snapshot_date DESC, period_type, entry_type);
CREATE INDEX IF NOT EXISTS idx_team_performance_date ON team_performance(metric_date DESC, team_name, entry_type);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_hash ON query_performance(query_hash, timestamp DESC);

-- ===== BACKWARD COMPATIBILITY VIEWS =====

-- KB Entries backward compatibility view
CREATE VIEW IF NOT EXISTS kb_entries AS
SELECT
    id,
    title,
    problem,
    solution,
    category,
    severity,
    created_at,
    updated_at,
    created_by,
    usage_count,
    success_count,
    failure_count,
    last_used,
    archived,
    confidence_score,
    -- Map unified fields to original KB fields
    description as notes,
    metadata as custom_data,
    tags as tag_list
FROM entries
WHERE entry_type = 'knowledge';

-- Incidents backward compatibility view
CREATE VIEW IF NOT EXISTS incidents AS
SELECT
    id,
    title,
    description,
    category,
    severity,
    COALESCE(incident_status, status) as status,
    priority,
    assigned_team,
    assigned_to,
    reporter,
    solution as resolution,
    resolution_type,
    root_cause,
    created_at,
    updated_at,
    first_response_at,
    assigned_at,
    in_progress_at,
    resolved_at,
    closed_at,
    sla_breach,
    sla_target_response_hours,
    sla_target_resolution_hours,
    resolution_time_hours,
    response_time_hours,
    escalation_count,
    reopen_count,
    related_kb_entries,
    ai_suggested_category,
    ai_confidence_score,
    ai_processed,
    tags,
    custom_fields,
    attachments,
    archived
FROM entries
WHERE entry_type = 'incident';

-- ===== ANALYTICAL VIEWS =====

-- Comprehensive entry analytics view
CREATE VIEW IF NOT EXISTS v_entry_analytics AS
SELECT
    e.id,
    e.title,
    e.entry_type,
    e.category,
    e.severity,
    e.status,
    e.assigned_team,
    e.assigned_to,
    e.created_at,
    e.resolved_at,
    e.usage_count,
    e.success_count,
    e.failure_count,
    e.resolution_time_hours,
    e.response_time_hours,
    e.sla_breach,
    e.escalation_count,
    e.reopen_count,
    e.confidence_score,

    -- Calculate success rate
    CASE
        WHEN (e.success_count + e.failure_count) > 0 THEN
            ROUND(CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100, 2)
        ELSE NULL
    END as success_rate,

    -- Calculate business hours resolution time
    CASE
        WHEN e.resolved_at IS NOT NULL THEN
            ROUND((julianday(e.resolved_at) - julianday(e.created_at)) * 24, 2)
        ELSE NULL
    END as total_resolution_hours,

    -- SLA compliance
    CASE
        WHEN e.sla_target_resolution_hours IS NOT NULL AND e.resolution_time_hours IS NOT NULL THEN
            CASE WHEN e.resolution_time_hours <= e.sla_target_resolution_hours THEN 'Met' ELSE 'Missed' END
        ELSE 'No SLA'
    END as sla_status,

    -- Related entries count
    (SELECT COUNT(*) FROM entry_relationships r WHERE r.source_entry_id = e.id AND r.active = TRUE) as related_entries_count,

    -- Comments count
    (SELECT COUNT(*) FROM entry_comments c WHERE c.entry_id = e.id) as comments_count,

    -- Feedback count and average rating
    (SELECT COUNT(*) FROM entry_feedback f WHERE f.entry_id = e.id) as feedback_count,
    (SELECT ROUND(AVG(rating), 2) FROM entry_feedback f WHERE f.entry_id = e.id AND f.rating IS NOT NULL) as avg_rating,

    -- Tags
    (SELECT GROUP_CONCAT(tag, ',') FROM entry_tags t WHERE t.entry_id = e.id) as tag_list

FROM entries e
WHERE e.archived = FALSE;

-- Knowledge base specific analytics
CREATE VIEW IF NOT EXISTS v_kb_analytics AS
SELECT
    id,
    title,
    category,
    severity,
    status,
    created_at,
    updated_at,
    last_used,
    usage_count,
    success_count,
    failure_count,
    confidence_score,

    -- Calculate days since last use
    CASE
        WHEN last_used IS NOT NULL THEN
            CAST((julianday('now') - julianday(last_used)) AS INTEGER)
        ELSE NULL
    END as days_since_last_use,

    -- Calculate success rate
    CASE
        WHEN (success_count + failure_count) > 0 THEN
            ROUND(CAST(success_count AS REAL) / (success_count + failure_count) * 100, 2)
        ELSE NULL
    END as success_rate,

    -- Usage frequency categories
    CASE
        WHEN usage_count = 0 THEN 'Never Used'
        WHEN usage_count <= 5 THEN 'Low Usage'
        WHEN usage_count <= 20 THEN 'Medium Usage'
        WHEN usage_count <= 50 THEN 'High Usage'
        ELSE 'Very High Usage'
    END as usage_category

FROM entries
WHERE entry_type = 'knowledge' AND archived = FALSE;

-- Incident specific analytics
CREATE VIEW IF NOT EXISTS v_incident_analytics AS
SELECT
    id,
    title,
    category,
    severity,
    incident_status as status,
    priority,
    assigned_team,
    assigned_to,
    reporter,
    created_at,
    resolved_at,
    resolution_time_hours,
    response_time_hours,
    sla_breach,
    escalation_count,
    reopen_count,

    -- Calculate business hours resolution time
    CASE
        WHEN resolved_at IS NOT NULL THEN
            ROUND((julianday(resolved_at) - julianday(created_at)) * 24, 2)
        ELSE NULL
    END as total_resolution_hours,

    -- SLA compliance
    CASE
        WHEN sla_target_resolution_hours IS NOT NULL AND resolution_time_hours IS NOT NULL THEN
            CASE WHEN resolution_time_hours <= sla_target_resolution_hours THEN 'Met' ELSE 'Missed' END
        ELSE 'No SLA'
    END as sla_status,

    -- Age in hours
    ROUND((julianday('now') - julianday(created_at)) * 24, 2) as age_hours,

    -- Related incidents count
    (SELECT COUNT(*) FROM entry_relationships r WHERE r.source_entry_id = entries.id AND r.active = TRUE) as related_incidents_count

FROM entries
WHERE entry_type = 'incident' AND archived = FALSE;

-- MTTR calculations by category and team
CREATE VIEW IF NOT EXISTS v_mttr_metrics AS
SELECT
    entry_type,
    category,
    assigned_team,
    severity,
    COUNT(*) as total_resolved,
    ROUND(AVG(resolution_time_hours), 2) as avg_mttr_hours,
    ROUND(MIN(resolution_time_hours), 2) as min_resolution_hours,
    ROUND(MAX(resolution_time_hours), 2) as max_resolution_hours,
    ROUND(AVG(response_time_hours), 2) as avg_response_hours,

    -- SLA metrics
    COUNT(CASE WHEN sla_breach = FALSE THEN 1 END) as sla_met_count,
    COUNT(CASE WHEN sla_breach = TRUE THEN 1 END) as sla_missed_count,
    ROUND(CAST(COUNT(CASE WHEN sla_breach = FALSE THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as sla_compliance_percentage

FROM entries
WHERE (status = 'resolved' OR incident_status IN ('resolvido', 'fechado'))
    AND resolved_at IS NOT NULL
    AND archived = FALSE
GROUP BY entry_type, category, assigned_team, severity;

-- Daily trends for both knowledge and incidents
CREATE VIEW IF NOT EXISTS v_daily_trends AS
SELECT
    DATE(created_at) as entry_date,
    entry_type,
    category,
    severity,
    COUNT(*) as new_entries,
    COUNT(CASE WHEN status = 'resolved' OR incident_status IN ('resolvido', 'fechado') THEN 1 END) as resolved_entries,
    COUNT(CASE WHEN sla_breach = TRUE THEN 1 END) as sla_breaches,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time,
    SUM(usage_count) as total_usage
FROM entries
WHERE created_at >= datetime('now', '-90 days')
    AND archived = FALSE
GROUP BY DATE(created_at), entry_type, category, severity
ORDER BY entry_date DESC;

-- Category distribution across both types
CREATE VIEW IF NOT EXISTS v_category_distribution AS
SELECT
    entry_type,
    category,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN status = 'active' OR incident_status = 'aberto' THEN 1 END) as active_entries,
    COUNT(CASE WHEN status = 'resolved' OR incident_status IN ('resolvido', 'fechado') THEN 1 END) as resolved_entries,
    ROUND(CAST(COUNT(CASE WHEN status = 'resolved' OR incident_status IN ('resolvido', 'fechado') THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as resolution_percentage,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,

    -- Knowledge base specific metrics
    CASE WHEN entry_type = 'knowledge' THEN SUM(usage_count) ELSE NULL END as total_kb_usage,
    CASE WHEN entry_type = 'knowledge' THEN SUM(success_count) ELSE NULL END as total_kb_success

FROM entries
WHERE archived = FALSE
GROUP BY entry_type, category
ORDER BY entry_type, total_entries DESC;

-- ===== TRIGGERS FOR DATA CONSISTENCY =====

-- Update entry timestamps
CREATE TRIGGER IF NOT EXISTS tr_entries_update_timestamp
AFTER UPDATE ON entries
FOR EACH ROW
BEGIN
    UPDATE entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update incident-specific timestamps and metrics
CREATE TRIGGER IF NOT EXISTS tr_entries_incident_status_update
AFTER UPDATE ON entries
FOR EACH ROW
WHEN NEW.entry_type = 'incident' AND (OLD.incident_status != NEW.incident_status OR OLD.status != NEW.status)
BEGIN
    -- Update timestamps based on status changes
    UPDATE entries SET
        assigned_at = CASE
            WHEN (NEW.incident_status = 'em_tratamento' OR NEW.status = 'em_tratamento')
                 AND (OLD.incident_status != 'em_tratamento' AND OLD.status != 'em_tratamento')
            THEN CURRENT_TIMESTAMP
            ELSE assigned_at
        END,
        in_progress_at = CASE
            WHEN (NEW.incident_status = 'em_tratamento' OR NEW.status = 'em_tratamento')
                 AND (OLD.incident_status != 'em_tratamento' AND OLD.status != 'em_tratamento')
            THEN CURRENT_TIMESTAMP
            ELSE in_progress_at
        END,
        resolved_at = CASE
            WHEN (NEW.incident_status = 'resolvido' OR NEW.status = 'resolved')
                 AND (OLD.incident_status != 'resolvido' AND OLD.status != 'resolved')
            THEN CURRENT_TIMESTAMP
            ELSE resolved_at
        END,
        closed_at = CASE
            WHEN (NEW.incident_status = 'fechado' OR NEW.status = 'closed')
                 AND (OLD.incident_status != 'fechado' AND OLD.status != 'closed')
            THEN CURRENT_TIMESTAMP
            ELSE closed_at
        END,
        reopen_count = CASE
            WHEN (OLD.incident_status IN ('resolvido', 'fechado') OR OLD.status IN ('resolved', 'closed'))
                 AND (NEW.incident_status = 'reaberto' OR NEW.status = 'reopened')
            THEN reopen_count + 1
            ELSE reopen_count
        END
    WHERE id = NEW.id;

    -- Calculate resolution time when incident is resolved
    UPDATE entries SET
        resolution_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id
        AND (NEW.incident_status = 'resolvido' OR NEW.status = 'resolved')
        AND resolution_time_hours IS NULL;

    -- Insert status change comment
    INSERT INTO entry_comments (entry_id, comment_type, content, author, is_system)
    VALUES (NEW.id, 'status_change',
            'Status changed from ' || COALESCE(OLD.incident_status, OLD.status) || ' to ' || COALESCE(NEW.incident_status, NEW.status),
            COALESCE(NEW.assigned_to, 'system'), TRUE);
END;

-- Calculate response time on first assignment
CREATE TRIGGER IF NOT EXISTS tr_entries_response_time
AFTER UPDATE ON entries
FOR EACH ROW
WHEN NEW.entry_type = 'incident' AND OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL
BEGIN
    UPDATE entries SET
        first_response_at = CURRENT_TIMESTAMP,
        response_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id;
END;

-- Auto-create relationship suggestions based on similarity
CREATE TRIGGER IF NOT EXISTS tr_auto_relationship_suggestions
AFTER INSERT ON entries
FOR EACH ROW
BEGIN
    -- Find similar entries based on title and category
    INSERT OR IGNORE INTO entry_relationships (source_entry_id, target_entry_id, relationship_type, similarity_score, created_by)
    SELECT
        NEW.id,
        e.id,
        'related',
        0.7, -- Placeholder similarity score
        'auto_system'
    FROM entries e
    WHERE e.id != NEW.id
        AND e.category = NEW.category
        AND e.archived = FALSE
        AND (
            -- Simple text matching - in production, use more sophisticated similarity
            e.title LIKE '%' || substr(NEW.title, 1, 20) || '%'
            OR NEW.title LIKE '%' || substr(e.title, 1, 20) || '%'
        )
    LIMIT 5;
END;

-- Audit trail triggers
CREATE TRIGGER IF NOT EXISTS tr_audit_entries_insert
AFTER INSERT ON entries
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, new_values)
    VALUES ('entries', NEW.id, 'INSERT',
            json_object(
                'title', NEW.title,
                'entry_type', NEW.entry_type,
                'category', NEW.category,
                'severity', NEW.severity,
                'created_by', NEW.created_by
            ));
END;

CREATE TRIGGER IF NOT EXISTS tr_audit_entries_update
AFTER UPDATE ON entries
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values, new_values)
    VALUES ('entries', NEW.id, 'UPDATE',
            json_object(
                'title', OLD.title,
                'description', substr(OLD.description, 1, 100),
                'category', OLD.category,
                'severity', OLD.severity,
                'status', OLD.status,
                'archived', OLD.archived
            ),
            json_object(
                'title', NEW.title,
                'description', substr(NEW.description, 1, 100),
                'category', NEW.category,
                'severity', NEW.severity,
                'status', NEW.status,
                'archived', NEW.archived
            ));
END;

CREATE TRIGGER IF NOT EXISTS tr_audit_entries_delete
AFTER DELETE ON entries
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_values)
    VALUES ('entries', OLD.id, 'DELETE',
            json_object(
                'title', OLD.title,
                'entry_type', OLD.entry_type,
                'category', OLD.category,
                'severity', OLD.severity
            ));
END;

-- FTS index maintenance triggers
CREATE TRIGGER IF NOT EXISTS tr_entries_fts_insert
AFTER INSERT ON entries
BEGIN
    INSERT INTO entries_fts(id, title, description, problem, solution, tags, entry_type, category)
    VALUES (NEW.id, NEW.title, NEW.description, NEW.problem, NEW.solution,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM entry_tags WHERE entry_id = NEW.id), ''),
            NEW.entry_type, NEW.category);
END;

CREATE TRIGGER IF NOT EXISTS tr_entries_fts_update
AFTER UPDATE ON entries
BEGIN
    DELETE FROM entries_fts WHERE id = NEW.id;
    INSERT INTO entries_fts(id, title, description, problem, solution, tags, entry_type, category)
    VALUES (NEW.id, NEW.title, NEW.description, NEW.problem, NEW.solution,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM entry_tags WHERE entry_id = NEW.id), ''),
            NEW.entry_type, NEW.category);
END;

CREATE TRIGGER IF NOT EXISTS tr_entries_fts_delete
AFTER DELETE ON entries
BEGIN
    DELETE FROM entries_fts WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS tr_entry_tags_fts_update
AFTER INSERT ON entry_tags
BEGIN
    DELETE FROM entries_fts WHERE id = NEW.entry_id;
    INSERT INTO entries_fts(id, title, description, problem, solution, tags, entry_type, category)
    SELECT e.id, e.title, e.description, e.problem, e.solution,
           COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags,
           e.entry_type, e.category
    FROM entries e
    LEFT JOIN entry_tags t ON e.id = t.entry_id
    WHERE e.id = NEW.entry_id
    GROUP BY e.id;
END;

CREATE TRIGGER IF NOT EXISTS tr_entry_tags_fts_delete
AFTER DELETE ON entry_tags
BEGIN
    DELETE FROM entries_fts WHERE id = OLD.entry_id;
    INSERT INTO entries_fts(id, title, description, problem, solution, tags, entry_type, category)
    SELECT e.id, e.title, e.description, e.problem, e.solution,
           COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags,
           e.entry_type, e.category
    FROM entries e
    LEFT JOIN entry_tags t ON e.id = t.entry_id
    WHERE e.id = OLD.entry_id
    GROUP BY e.id;
END;

-- ===== INITIAL DATA =====

-- Insert schema version
INSERT OR IGNORE INTO schema_versions (version, description) VALUES
(3, 'Unified knowledge base and incident management schema');

-- Insert initial system configuration
INSERT OR IGNORE INTO system_config (key, value, type, description, category) VALUES
('db_version', '3', 'number', 'Database schema version', 'system'),
('app_name', 'Mainframe KB Assistant - Unified', 'string', 'Application name', 'general'),
('app_version', '3.0.0-unified', 'string', 'Application version', 'general'),
('unified_schema_enabled', 'true', 'boolean', 'Enable unified schema features', 'system'),
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
('slow_query_threshold_ms', '1000', 'number', 'Threshold for slow query logging', 'performance'),
('auto_relationship_enabled', 'true', 'boolean', 'Enable automatic relationship detection', 'ai'),
('fts_enabled', 'true', 'boolean', 'Enable full-text search', 'search'),
('entry_versioning_enabled', 'false', 'boolean', 'Enable entry versioning', 'system');

-- Default SLA policies
INSERT OR IGNORE INTO sla_policies (name, entry_type, severity, response_time_hours, resolution_time_hours) VALUES
('Critical Knowledge Entries', 'knowledge', 'critical', 1, 2),
('High Priority Knowledge Entries', 'knowledge', 'high', 2, 4),
('Critical Incidents', 'incident', 'critical', 1, 4),
('High Priority Incidents', 'incident', 'high', 2, 8),
('Medium Priority Incidents', 'incident', 'medium', 4, 24),
('Low Priority Incidents', 'incident', 'low', 8, 72),
('General Entries', 'all', 'medium', 4, 24);

-- Default automation rules
INSERT OR IGNORE INTO automation_rules (name, description, entry_type, rule_type, conditions, actions, priority) VALUES
('Auto-assign DB2 incidents', 'Automatically assign DB2 incidents to database team', 'incident', 'auto_assign',
 '{"category": "DB2"}',
 '{"assign_to_team": "Database Team"}', 10),

('Auto-categorize JCL entries', 'Automatically categorize entries with JCL keywords', 'all', 'auto_categorize',
 '{"title_contains": ["JCL", "job", "step"], "description_contains": ["JCL", "ABEND"]}',
 '{"set_category": "JCL", "add_tags": ["auto-categorized"]}', 20),

('Auto-tag knowledge entries', 'Automatically tag knowledge entries based on content', 'knowledge', 'auto_tag',
 '{"description_contains": ["error", "solution", "fix"]}',
 '{"add_tags": ["solution", "troubleshooting"]}', 30),

('Escalate critical incidents', 'Auto-escalate critical incidents if not assigned within 30 minutes', 'incident', 'auto_escalate',
 '{"severity": "critical", "incident_status": "aberto", "age_minutes": 30}',
 '{"escalate_to": "Manager", "notify": ["oncall@company.com"]}', 5);

-- Create initial backup entry
INSERT INTO backup_log (backup_path, backup_type, entries_count, status)
VALUES ('unified_schema_setup', 'migration', 0, 'created');

-- ===== PERFORMANCE OPTIMIZATION =====

-- Analyze tables for query optimization
ANALYZE;

-- Create additional statistics for the query planner
UPDATE sqlite_stat1 SET stat = '10000 1' WHERE tbl = 'entries';
UPDATE sqlite_stat1 SET stat = '50000 10' WHERE tbl = 'entry_tags';
UPDATE sqlite_stat1 SET stat = '25000 5' WHERE tbl = 'entry_feedback';

-- ===== COMMENTS AND DOCUMENTATION =====

-- Table comments (for documentation purposes)
-- entries: Unified table containing both knowledge base entries and incidents
-- entry_tags: Flexible tagging system supporting both entry types
-- entry_feedback: User feedback and ratings for both knowledge and incidents
-- entry_relationships: Links between related entries of any type
-- entry_comments: Comments and updates for tracking progress
-- usage_metrics: Detailed tracking of user interactions
-- search_history: Analytics for search behavior across both types
-- sla_policies: Service level agreements for different entry types
-- automation_rules: Automated processing rules
-- entry_metrics_snapshots: Historical metrics for trend analysis
-- team_performance: Team and individual performance tracking
-- Views: kb_entries and incidents provide backward compatibility
-- FTS: entries_fts provides unified full-text search capability