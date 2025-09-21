-- =====================================================================
-- UNIFIED KNOWLEDGE BASE & INCIDENT MANAGEMENT SCHEMA
-- =====================================================================
-- This schema unifies kb_entries and incidents into a single table
-- while maintaining all functionality and backward compatibility
-- Version: 1.0
-- Created: 2025-01-20
-- =====================================================================

-- Enable foreign keys and optimization settings
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000; -- 64MB cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB mmap

-- ===== UNIFIED ENTRIES TABLE =====
-- Central table combining knowledge base entries and incidents
CREATE TABLE IF NOT EXISTS unified_entries (
    -- ===== PRIMARY IDENTIFICATION =====
    id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')),

    -- ===== COMMON CORE FIELDS =====
    title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 255),
    description TEXT NOT NULL CHECK(length(description) >= 10 AND length(description) <= 10000),
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Hardware', 'Software', 'Other')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),

    -- ===== KNOWLEDGE BASE SPECIFIC FIELDS =====
    -- These fields are NULL for incidents
    problem TEXT CHECK(length(problem) <= 5000), -- Separate problem description for KB
    solution TEXT CHECK(length(solution) <= 10000), -- KB solution or incident resolution
    usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
    success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
    failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
    last_used DATETIME,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 100),

    -- ===== INCIDENT SPECIFIC FIELDS =====
    -- These fields are NULL for knowledge entries
    status TEXT CHECK(status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao')),
    priority INTEGER CHECK(priority >= 1 AND priority <= 5),
    assigned_team TEXT CHECK(length(assigned_team) <= 100),
    assigned_to TEXT CHECK(length(assigned_to) <= 100),
    reporter TEXT CHECK(length(reporter) <= 100),
    resolution_type TEXT CHECK(resolution_type IN ('fixed', 'workaround', 'duplicate', 'cannot_reproduce', 'invalid', 'wont_fix')),
    root_cause TEXT CHECK(length(root_cause) <= 2000),

    -- ===== TIME TRACKING (ENHANCED FOR BOTH TYPES) =====
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT DEFAULT 'system' CHECK(length(created_by) <= 100),

    -- Incident workflow timestamps
    first_response_at DATETIME,
    assigned_at DATETIME,
    in_progress_at DATETIME,
    resolved_at DATETIME,
    closed_at DATETIME,

    -- ===== SLA TRACKING (INCIDENTS ONLY) =====
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_target_response_hours INTEGER CHECK(sla_target_response_hours > 0),
    sla_target_resolution_hours INTEGER CHECK(sla_target_resolution_hours > 0),
    resolution_time_hours REAL CHECK(resolution_time_hours >= 0),
    response_time_hours REAL CHECK(response_time_hours >= 0),

    -- ===== ANALYTICS (BOTH TYPES) =====
    escalation_count INTEGER DEFAULT 0 CHECK(escalation_count >= 0),
    reopen_count INTEGER DEFAULT 0 CHECK(reopen_count >= 0),
    related_entries TEXT, -- JSON array of related entry IDs

    -- ===== AI AND AUTOMATION =====
    ai_suggested_category TEXT CHECK(length(ai_suggested_category) <= 50),
    ai_confidence_score REAL CHECK(ai_confidence_score >= 0 AND ai_confidence_score <= 1),
    ai_processed BOOLEAN DEFAULT FALSE,

    -- ===== METADATA =====
    tags TEXT, -- JSON array of tags
    custom_fields TEXT, -- JSON for extensible custom fields
    attachments TEXT, -- JSON array of attachment info
    archived BOOLEAN DEFAULT FALSE,
    checksum TEXT CHECK(length(checksum) <= 64), -- For change detection

    -- ===== CONSTRAINTS =====
    -- Ensure KB entries have required fields
    CHECK (
        (entry_type = 'knowledge' AND problem IS NOT NULL AND solution IS NOT NULL) OR
        (entry_type = 'incident' AND status IS NOT NULL AND reporter IS NOT NULL)
    )
);

-- ===== UNIFIED TAGS TABLE =====
-- Flexible tagging system for both KB entries and incidents
CREATE TABLE IF NOT EXISTS unified_tags (
    entry_id TEXT NOT NULL,
    tag TEXT NOT NULL CHECK(length(tag) >= 1 AND length(tag) <= 50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system' CHECK(length(created_by) <= 100),

    PRIMARY KEY (entry_id, tag),
    FOREIGN KEY (entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE
);

-- ===== UNIFIED RELATIONSHIPS TABLE =====
-- Enhanced relationship tracking for both entry types
CREATE TABLE IF NOT EXISTS unified_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_entry_id TEXT NOT NULL,
    target_entry_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN (
        'related', 'duplicate', 'blocks', 'blocked_by', 'parent', 'child',
        'caused_by', 'causes', 'superseded', 'prerequisite', 'implements'
    )),
    similarity_score REAL DEFAULT 0.0 CHECK(similarity_score >= 0 AND similarity_score <= 1),
    strength REAL DEFAULT 0.5 CHECK(strength >= 0 AND strength <= 1), -- Relationship strength
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT CHECK(length(created_by) <= 100),
    notes TEXT CHECK(length(notes) <= 1000),
    validated BOOLEAN DEFAULT FALSE, -- Whether relationship was manually validated

    FOREIGN KEY (source_entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (target_entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE,
    UNIQUE(source_entry_id, target_entry_id, relationship_type)
);

-- ===== UNIFIED COMMENTS/UPDATES TABLE =====
-- Comments, updates, and feedback for both entry types
CREATE TABLE IF NOT EXISTS unified_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    comment_type TEXT DEFAULT 'comment' CHECK(comment_type IN (
        'comment', 'status_change', 'assignment', 'escalation', 'resolution',
        'usage_feedback', 'internal_note', 'external_note', 'system_update'
    )),
    content TEXT NOT NULL CHECK(length(content) >= 1 AND length(content) <= 5000),
    author TEXT NOT NULL CHECK(length(author) <= 100),
    is_internal BOOLEAN DEFAULT FALSE,

    -- Knowledge base feedback specific fields
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    successful BOOLEAN, -- Was the KB entry successful in solving the problem?
    resolution_time INTEGER CHECK(resolution_time >= 0), -- Time to resolve using KB entry (minutes)

    -- Additional metadata
    metadata TEXT, -- JSON for additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE
);

-- ===== UNIFIED USAGE METRICS TABLE =====
-- Detailed usage tracking for both entry types
CREATE TABLE IF NOT EXISTS unified_usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN (
        -- Knowledge base actions
        'view', 'copy', 'rate_success', 'rate_failure', 'export', 'print', 'share',
        'create', 'update', 'delete', 'search_result_click',
        -- Incident actions
        'assign', 'status_change', 'escalate', 'resolve', 'reopen', 'comment_add',
        'sla_breach', 'notification_sent', 'automation_triggered'
    )),
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Additional context
    metadata TEXT, -- JSON blob for action-specific data
    duration_ms INTEGER CHECK(duration_ms >= 0), -- How long the action took
    result TEXT CHECK(result IN ('success', 'failure', 'timeout', 'cancelled')),

    FOREIGN KEY (entry_id) REFERENCES unified_entries(id) ON DELETE CASCADE
);

-- ===== SEARCH HISTORY TABLE =====
-- Enhanced search history supporting both entry types
CREATE TABLE IF NOT EXISTS unified_search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL CHECK(length(query) <= 500),
    normalized_query TEXT CHECK(length(normalized_query) <= 500),
    search_type TEXT DEFAULT 'general' CHECK(search_type IN ('general', 'knowledge', 'incident', 'ai_assisted')),
    filters_used TEXT, -- JSON blob for search filters
    results_count INTEGER NOT NULL CHECK(results_count >= 0),
    selected_entry_id TEXT,
    selected_entry_type TEXT CHECK(selected_entry_type IN ('knowledge', 'incident')),
    user_id TEXT CHECK(length(user_id) <= 100),
    session_id TEXT CHECK(length(session_id) <= 100),
    search_time_ms INTEGER CHECK(search_time_ms >= 0),
    ai_used BOOLEAN DEFAULT FALSE,
    ai_confidence REAL CHECK(ai_confidence >= 0 AND ai_confidence <= 1),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (selected_entry_id) REFERENCES unified_entries(id) ON DELETE SET NULL
);

-- ===== SUPPORT TABLES (MAINTAINED FROM ORIGINAL SCHEMAS) =====

-- SLA policies for incidents
CREATE TABLE IF NOT EXISTS sla_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    severity TEXT,
    priority_min INTEGER,
    priority_max INTEGER,
    response_time_hours INTEGER NOT NULL,
    resolution_time_hours INTEGER NOT NULL,
    escalation_rules TEXT, -- JSON for escalation rules
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Automation rules for incident processing
CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    applies_to TEXT NOT NULL CHECK(applies_to IN ('knowledge', 'incident', 'both')),
    rule_type TEXT NOT NULL CHECK(rule_type IN ('auto_assign', 'auto_categorize', 'auto_escalate', 'auto_close', 'notification', 'auto_tag')),
    conditions TEXT NOT NULL, -- JSON conditions
    actions TEXT NOT NULL, -- JSON actions
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_executed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY CHECK(length(key) <= 100),
    value TEXT NOT NULL CHECK(length(value) <= 2000),
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT CHECK(length(description) <= 500),
    category TEXT DEFAULT 'general' CHECK(length(category) <= 50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== FULL-TEXT SEARCH CONFIGURATION =====

-- Main FTS5 table for unified content search
CREATE VIRTUAL TABLE IF NOT EXISTS unified_fts USING fts5(
    id UNINDEXED,
    entry_type UNINDEXED,
    title,
    description,
    problem,
    solution,
    category UNINDEXED,
    tags,
    tokenize = 'porter unicode61',
    content = 'unified_entries',
    content_rowid = 'rowid'
);

-- ===== PERFORMANCE INDEXES =====

-- Primary unified entry indexes
CREATE INDEX IF NOT EXISTS idx_unified_type_category ON unified_entries(entry_type, category, archived);
CREATE INDEX IF NOT EXISTS idx_unified_type_status ON unified_entries(entry_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_type_severity ON unified_entries(entry_type, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_created_at ON unified_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_updated_at ON unified_entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_assigned ON unified_entries(assigned_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_team ON unified_entries(assigned_team, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_reporter ON unified_entries(reporter, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_usage ON unified_entries(usage_count DESC, success_count DESC) WHERE entry_type = 'knowledge';
CREATE INDEX IF NOT EXISTS idx_unified_last_used ON unified_entries(last_used DESC) WHERE entry_type = 'knowledge';
CREATE INDEX IF NOT EXISTS idx_unified_sla_breach ON unified_entries(sla_breach, severity, created_at DESC) WHERE entry_type = 'incident';
CREATE INDEX IF NOT EXISTS idx_unified_resolution_time ON unified_entries(resolution_time_hours, resolved_at DESC) WHERE entry_type = 'incident';

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_unified_tags_tag ON unified_tags(tag);
CREATE INDEX IF NOT EXISTS idx_unified_tags_entry ON unified_tags(entry_id);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_unified_rel_source ON unified_relationships(source_entry_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_unified_rel_target ON unified_relationships(target_entry_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_unified_rel_similarity ON unified_relationships(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_unified_rel_validated ON unified_relationships(validated, created_at DESC);

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_unified_comments_entry ON unified_comments(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_comments_author ON unified_comments(author, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_comments_type ON unified_comments(comment_type, created_at DESC);

-- Usage metrics indexes
CREATE INDEX IF NOT EXISTS idx_unified_usage_entry ON unified_usage_metrics(entry_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_usage_action ON unified_usage_metrics(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_usage_user ON unified_usage_metrics(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_usage_timestamp ON unified_usage_metrics(timestamp DESC);

-- Search history indexes
CREATE INDEX IF NOT EXISTS idx_unified_search_query ON unified_search_history(query);
CREATE INDEX IF NOT EXISTS idx_unified_search_timestamp ON unified_search_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_search_user ON unified_search_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_search_type ON unified_search_history(search_type, timestamp DESC);

-- Support table indexes
CREATE INDEX IF NOT EXISTS idx_sla_policies_active ON sla_policies(active, category, severity);
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON automation_rules(applies_to, rule_type, enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority ASC, enabled);

-- ===== ANALYTICAL VIEWS =====

-- Knowledge base analytics view
CREATE VIEW IF NOT EXISTS v_knowledge_analytics AS
SELECT
    e.id,
    e.title,
    e.category,
    e.severity,
    e.usage_count,
    e.success_count,
    e.failure_count,
    CASE WHEN (e.success_count + e.failure_count) > 0
         THEN ROUND(CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100, 2)
         ELSE 0 END as success_rate_percentage,
    e.last_used,
    e.created_at,
    e.updated_at,
    GROUP_CONCAT(DISTINCT t.tag, ', ') as tags,
    COUNT(DISTINCT r.target_entry_id) as related_entries_count,
    COUNT(DISTINCT c.id) as comments_count
FROM unified_entries e
LEFT JOIN unified_tags t ON e.id = t.entry_id
LEFT JOIN unified_relationships r ON e.id = r.source_entry_id
LEFT JOIN unified_comments c ON e.id = c.entry_id
WHERE e.entry_type = 'knowledge' AND e.archived = FALSE
GROUP BY e.id, e.title, e.category, e.severity, e.usage_count, e.success_count, e.failure_count, e.last_used, e.created_at, e.updated_at;

-- Incident analytics view
CREATE VIEW IF NOT EXISTS v_incident_analytics AS
SELECT
    e.id,
    e.title,
    e.category,
    e.severity,
    e.status,
    e.priority,
    e.assigned_team,
    e.assigned_to,
    e.reporter,
    e.created_at,
    e.resolved_at,
    e.resolution_time_hours,
    e.response_time_hours,
    e.sla_breach,
    e.escalation_count,
    e.reopen_count,

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

    -- Related incidents count
    COUNT(DISTINCT r.target_entry_id) as related_incidents_count,

    -- Comments count
    COUNT(DISTINCT c.id) as comments_count

FROM unified_entries e
LEFT JOIN unified_relationships r ON e.id = r.source_entry_id
LEFT JOIN unified_comments c ON e.id = c.entry_id
WHERE e.entry_type = 'incident' AND e.archived = FALSE
GROUP BY e.id, e.title, e.category, e.severity, e.status, e.priority, e.assigned_team, e.assigned_to, e.reporter,
         e.created_at, e.resolved_at, e.resolution_time_hours, e.response_time_hours, e.sla_breach,
         e.escalation_count, e.reopen_count;

-- Unified search view for cross-type queries
CREATE VIEW IF NOT EXISTS v_unified_search AS
SELECT
    id,
    entry_type,
    title,
    CASE
        WHEN entry_type = 'knowledge' THEN COALESCE(problem || '\n\n' || solution, description)
        ELSE description
    END as content,
    category,
    severity,
    status,
    priority,
    assigned_to,
    created_at,
    updated_at,
    usage_count,
    success_count,
    archived
FROM unified_entries
WHERE archived = FALSE;

-- Category distribution across both types
CREATE VIEW IF NOT EXISTS v_unified_category_distribution AS
SELECT
    category,
    entry_type,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN archived = FALSE THEN 1 END) as active_entries,
    COUNT(CASE WHEN entry_type = 'incident' AND status = 'aberto' THEN 1 END) as open_incidents,
    COUNT(CASE WHEN entry_type = 'incident' AND status IN ('resolvido', 'fechado') THEN 1 END) as resolved_incidents,
    COUNT(CASE WHEN entry_type = 'knowledge' AND usage_count > 0 THEN 1 END) as used_kb_entries,
    AVG(CASE WHEN entry_type = 'knowledge' THEN usage_count END) as avg_kb_usage,
    AVG(CASE WHEN entry_type = 'incident' AND resolution_time_hours IS NOT NULL THEN resolution_time_hours END) as avg_incident_resolution_time
FROM unified_entries
GROUP BY category, entry_type
ORDER BY category, entry_type;

-- ===== TRIGGERS FOR DATA CONSISTENCY =====

-- Update timestamps on entry changes
CREATE TRIGGER IF NOT EXISTS tr_unified_update_timestamp
AFTER UPDATE ON unified_entries
FOR EACH ROW
BEGIN
    UPDATE unified_entries
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Update incident status timestamps
CREATE TRIGGER IF NOT EXISTS tr_unified_status_update
AFTER UPDATE ON unified_entries
FOR EACH ROW
WHEN NEW.entry_type = 'incident' AND OLD.status != NEW.status
BEGIN
    -- Update timestamps based on status changes
    UPDATE unified_entries SET
        assigned_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status = 'aberto' THEN CURRENT_TIMESTAMP ELSE assigned_at END,
        in_progress_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status != 'em_tratamento' THEN CURRENT_TIMESTAMP ELSE in_progress_at END,
        resolved_at = CASE WHEN NEW.status = 'resolvido' AND OLD.status != 'resolvido' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        closed_at = CASE WHEN NEW.status = 'fechado' AND OLD.status != 'fechado' THEN CURRENT_TIMESTAMP ELSE closed_at END,
        reopen_count = CASE WHEN OLD.status IN ('resolvido', 'fechado') AND NEW.status = 'reaberto' THEN reopen_count + 1 ELSE reopen_count END
    WHERE id = NEW.id;

    -- Calculate resolution time when incident is resolved
    UPDATE unified_entries SET
        resolution_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id AND NEW.status = 'resolvido' AND resolution_time_hours IS NULL;

    -- Insert status change comment
    INSERT INTO unified_comments (entry_id, comment_type, content, author)
    VALUES (NEW.id, 'status_change', 'Status changed from ' || OLD.status || ' to ' || NEW.status, COALESCE(NEW.assigned_to, 'system'));
END;

-- Calculate response time on first assignment
CREATE TRIGGER IF NOT EXISTS tr_unified_response_time
AFTER UPDATE ON unified_entries
FOR EACH ROW
WHEN NEW.entry_type = 'incident' AND OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL
BEGIN
    UPDATE unified_entries SET
        first_response_at = CURRENT_TIMESTAMP,
        response_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id;
END;

-- Update last_used for knowledge entries
CREATE TRIGGER IF NOT EXISTS tr_unified_update_last_used
AFTER INSERT ON unified_usage_metrics
FOR EACH ROW
WHEN NEW.action = 'view'
BEGIN
    UPDATE unified_entries
    SET last_used = CURRENT_TIMESTAMP
    WHERE id = NEW.entry_id AND entry_type = 'knowledge';
END;

-- Update usage counts for knowledge entries
CREATE TRIGGER IF NOT EXISTS tr_unified_update_usage_count
AFTER INSERT ON unified_usage_metrics
FOR EACH ROW
WHEN NEW.action IN ('view', 'copy', 'export')
BEGIN
    UPDATE unified_entries
    SET usage_count = usage_count + 1
    WHERE id = NEW.entry_id AND entry_type = 'knowledge';
END;

-- Update success/failure counts for knowledge entries
CREATE TRIGGER IF NOT EXISTS tr_unified_update_success_count
AFTER INSERT ON unified_usage_metrics
FOR EACH ROW
WHEN NEW.action = 'rate_success'
BEGIN
    UPDATE unified_entries
    SET success_count = success_count + 1
    WHERE id = NEW.entry_id AND entry_type = 'knowledge';
END;

CREATE TRIGGER IF NOT EXISTS tr_unified_update_failure_count
AFTER INSERT ON unified_usage_metrics
FOR EACH ROW
WHEN NEW.action = 'rate_failure'
BEGIN
    UPDATE unified_entries
    SET failure_count = failure_count + 1
    WHERE id = NEW.entry_id AND entry_type = 'knowledge';
END;

-- FTS5 triggers for automatic index maintenance
CREATE TRIGGER IF NOT EXISTS tr_unified_fts_insert
AFTER INSERT ON unified_entries
BEGIN
    INSERT INTO unified_fts(rowid, id, entry_type, title, description, problem, solution, category, tags)
    SELECT
        NEW.rowid,
        NEW.id,
        NEW.entry_type,
        NEW.title,
        NEW.description,
        NEW.problem,
        NEW.solution,
        NEW.category,
        (SELECT GROUP_CONCAT(tag, ' ') FROM unified_tags WHERE entry_id = NEW.id);
END;

CREATE TRIGGER IF NOT EXISTS tr_unified_fts_delete
AFTER DELETE ON unified_entries
BEGIN
    DELETE FROM unified_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER IF NOT EXISTS tr_unified_fts_update
AFTER UPDATE ON unified_entries
BEGIN
    DELETE FROM unified_fts WHERE rowid = OLD.rowid;
    INSERT INTO unified_fts(rowid, id, entry_type, title, description, problem, solution, category, tags)
    SELECT
        NEW.rowid,
        NEW.id,
        NEW.entry_type,
        NEW.title,
        NEW.description,
        NEW.problem,
        NEW.solution,
        NEW.category,
        (SELECT GROUP_CONCAT(tag, ' ') FROM unified_tags WHERE entry_id = NEW.id);
END;

-- Tags FTS trigger
CREATE TRIGGER IF NOT EXISTS tr_unified_tags_fts_update
AFTER INSERT ON unified_tags
BEGIN
    DELETE FROM unified_fts WHERE id = NEW.entry_id;
    INSERT INTO unified_fts(rowid, id, entry_type, title, description, problem, solution, category, tags)
    SELECT
        e.rowid,
        e.id,
        e.entry_type,
        e.title,
        e.description,
        e.problem,
        e.solution,
        e.category,
        (SELECT GROUP_CONCAT(tag, ' ') FROM unified_tags WHERE entry_id = e.id)
    FROM unified_entries e WHERE e.id = NEW.entry_id;
END;

-- Generate checksum on entry changes
CREATE TRIGGER IF NOT EXISTS tr_unified_generate_checksum
AFTER INSERT OR UPDATE ON unified_entries
FOR EACH ROW
BEGIN
    UPDATE unified_entries
    SET checksum = hex(
        NEW.entry_type || NEW.title || NEW.description ||
        COALESCE(NEW.problem, '') || COALESCE(NEW.solution, '') ||
        NEW.category || NEW.severity
    )
    WHERE id = NEW.id;
END;

-- ===== BACKWARD COMPATIBILITY VIEWS =====

-- Legacy KB entries view for existing code compatibility
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
    confidence_score
FROM unified_entries
WHERE entry_type = 'knowledge';

-- Legacy incidents view for existing code compatibility
CREATE VIEW IF NOT EXISTS incidents AS
SELECT
    id,
    title,
    description,
    category,
    severity,
    status,
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
    related_entries as related_kb_entries,
    ai_suggested_category,
    ai_confidence_score,
    ai_processed,
    tags,
    custom_fields,
    attachments,
    archived
FROM unified_entries
WHERE entry_type = 'incident';

-- Legacy kb_tags view
CREATE VIEW IF NOT EXISTS kb_tags AS
SELECT
    entry_id,
    tag,
    created_at
FROM unified_tags t
JOIN unified_entries e ON t.entry_id = e.id
WHERE e.entry_type = 'knowledge';

-- ===== INITIAL CONFIGURATION =====

-- Insert system configuration
INSERT OR IGNORE INTO system_config (key, value, type, description, category) VALUES
('unified_schema_version', '1.0', 'string', 'Unified schema version', 'system'),
('unified_migration_completed', 'false', 'boolean', 'Whether migration to unified schema is completed', 'system'),
('unified_migration_date', '', 'string', 'Date when migration was completed', 'system'),
('search_unified_enabled', 'true', 'boolean', 'Enable unified search across both entry types', 'search'),
('kb_default_confidence_threshold', '0.7', 'number', 'Default confidence threshold for KB suggestions', 'knowledge'),
('incident_auto_relationship_enabled', 'true', 'boolean', 'Enable automatic relationship detection for incidents', 'incident'),
('max_related_entries', '10', 'number', 'Maximum number of related entries to show', 'general');

-- Insert default SLA policies
INSERT OR IGNORE INTO sla_policies (name, severity, response_time_hours, resolution_time_hours) VALUES
('Critical Issues', 'critical', 1, 4),
('High Priority Issues', 'high', 2, 8),
('Medium Priority Issues', 'medium', 4, 24),
('Low Priority Issues', 'low', 8, 72);

-- Insert default automation rules
INSERT OR IGNORE INTO automation_rules (name, description, applies_to, rule_type, conditions, actions, priority) VALUES
('Auto-categorize DB2 Issues', 'Automatically categorize entries mentioning DB2', 'both', 'auto_categorize',
 '{"title_contains": ["DB2", "database"], "description_contains": ["DB2", "SQL"]}',
 '{"set_category": "DB2", "add_tags": ["auto-categorized"]}', 10),

('Auto-assign Critical Incidents', 'Automatically assign critical incidents to senior team', 'incident', 'auto_assign',
 '{"severity": "critical", "status": "aberto"}',
 '{"assign_to_team": "Senior Support", "add_tags": ["critical-auto-assigned"]}', 5),

('Knowledge Base Usage Tracking', 'Track when KB entries are accessed', 'knowledge', 'notification',
 '{"action": "view"}',
 '{"log_usage": true, "update_metrics": true}', 50);

-- Optimize database
ANALYZE;

-- =====================================================================
-- END OF UNIFIED SCHEMA
-- =====================================================================