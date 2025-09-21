-- Incident Management Extension Schema
-- Extends the main KB schema with incident management capabilities
-- Optimized for analytics, relationship tracking, and automation

-- Enable foreign keys if not already enabled
PRAGMA foreign_keys = ON;

-- ===== INCIDENT MANAGEMENT CORE TABLES =====

-- Main incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Hardware', 'Software', 'Other')),
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao')),
    priority INTEGER NOT NULL DEFAULT 3 CHECK(priority >= 1 AND priority <= 5),

    -- Team and assignment
    assigned_team TEXT,
    assigned_to TEXT,
    reporter TEXT NOT NULL,

    -- Resolution tracking
    resolution TEXT,
    resolution_type TEXT CHECK(resolution_type IN ('fixed', 'workaround', 'duplicate', 'cannot_reproduce', 'invalid', 'wont_fix')),
    root_cause TEXT,

    -- Time tracking for MTTR calculations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    first_response_at DATETIME,
    assigned_at DATETIME,
    in_progress_at DATETIME,
    resolved_at DATETIME,
    closed_at DATETIME,

    -- SLA tracking
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_target_response_hours INTEGER,
    sla_target_resolution_hours INTEGER,

    -- Analytics fields
    resolution_time_hours REAL,
    response_time_hours REAL,
    escalation_count INTEGER DEFAULT 0,
    reopen_count INTEGER DEFAULT 0,

    -- Knowledge base linkage
    related_kb_entries TEXT, -- JSON array of KB entry IDs

    -- Auto-categorization
    ai_suggested_category TEXT,
    ai_confidence_score REAL,
    ai_processed BOOLEAN DEFAULT FALSE,

    -- Additional metadata
    tags TEXT, -- JSON array of tags
    custom_fields TEXT, -- JSON for custom fields
    attachments TEXT, -- JSON array of attachment info

    archived BOOLEAN DEFAULT FALSE
);

-- Incident relationships table for linking related incidents
CREATE TABLE IF NOT EXISTS incident_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_incident_id TEXT NOT NULL,
    target_incident_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN ('related', 'duplicate', 'blocks', 'blocked_by', 'parent', 'child', 'caused_by', 'causes')),
    similarity_score REAL DEFAULT 0.0 CHECK(similarity_score >= 0 AND similarity_score <= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    notes TEXT,

    FOREIGN KEY (source_incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (target_incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    UNIQUE(source_incident_id, target_incident_id, relationship_type)
);

-- Incident comments/updates for tracking progress
CREATE TABLE IF NOT EXISTS incident_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    comment_type TEXT DEFAULT 'comment' CHECK(comment_type IN ('comment', 'status_change', 'assignment', 'escalation', 'resolution')),
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- SLA definitions for different incident categories/severities
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
    rule_type TEXT NOT NULL CHECK(rule_type IN ('auto_assign', 'auto_categorize', 'auto_escalate', 'auto_close', 'notification')),
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

-- Incident metrics snapshots for trend analysis
CREATE TABLE IF NOT EXISTS incident_metrics_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date DATE NOT NULL,
    period_type TEXT NOT NULL CHECK(period_type IN ('daily', 'weekly', 'monthly')),

    -- Volume metrics
    total_incidents INTEGER DEFAULT 0,
    new_incidents INTEGER DEFAULT 0,
    resolved_incidents INTEGER DEFAULT 0,
    closed_incidents INTEGER DEFAULT 0,
    reopened_incidents INTEGER DEFAULT 0,

    -- Time metrics
    avg_response_time_hours REAL DEFAULT 0,
    avg_resolution_time_hours REAL DEFAULT 0,
    avg_mttr_hours REAL DEFAULT 0,

    -- Category breakdown (JSON)
    category_breakdown TEXT,
    severity_breakdown TEXT,
    team_breakdown TEXT,

    -- SLA metrics
    sla_met_percentage REAL DEFAULT 0,
    sla_breaches INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(snapshot_date, period_type)
);

-- Team performance metrics
CREATE TABLE IF NOT EXISTS team_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT NOT NULL,
    member_name TEXT,
    metric_date DATE NOT NULL,

    -- Volume metrics
    incidents_assigned INTEGER DEFAULT 0,
    incidents_resolved INTEGER DEFAULT 0,
    incidents_escalated INTEGER DEFAULT 0,

    -- Quality metrics
    avg_resolution_time_hours REAL DEFAULT 0,
    customer_satisfaction_score REAL,
    first_call_resolution_rate REAL,

    -- SLA performance
    sla_met_count INTEGER DEFAULT 0,
    sla_missed_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_name, member_name, metric_date)
);

-- Report templates for custom reporting
CREATE TABLE IF NOT EXISTS report_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL CHECK(template_type IN ('incident_summary', 'sla_report', 'team_performance', 'trend_analysis', 'custom')),
    query_template TEXT NOT NULL, -- SQL template with placeholders
    parameters TEXT, -- JSON schema for parameters
    output_format TEXT DEFAULT 'csv' CHECK(output_format IN ('csv', 'pdf', 'json', 'excel')),
    schedule_config TEXT, -- JSON for scheduled reports
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled reports execution log
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    execution_date DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    output_path TEXT,
    file_size INTEGER,
    execution_time_ms INTEGER,
    error_message TEXT,
    recipients TEXT, -- JSON array of email recipients

    FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE CASCADE
);

-- Knowledge base suggestions for incidents
CREATE TABLE IF NOT EXISTS incident_kb_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    kb_entry_id TEXT NOT NULL,
    suggestion_type TEXT DEFAULT 'auto' CHECK(suggestion_type IN ('auto', 'manual', 'ai')),
    relevance_score REAL DEFAULT 0.0 CHECK(relevance_score >= 0 AND relevance_score <= 1),
    applied BOOLEAN DEFAULT FALSE,
    helpful_rating INTEGER CHECK(helpful_rating >= 1 AND helpful_rating <= 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- ===== PERFORMANCE INDEXES =====

-- Primary incident indexes
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_team ON incidents(assigned_team, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reporter, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_resolution_time ON incidents(resolution_time_hours, resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_resolved_at ON incidents(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_sla_breach ON incidents(sla_breach, severity, created_at DESC);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_incident_relationships_source ON incident_relationships(source_incident_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_incident_relationships_target ON incident_relationships(target_incident_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_incident_relationships_similarity ON incident_relationships(similarity_score DESC);

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_incident_comments_incident ON incident_comments(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_comments_author ON incident_comments(author, created_at DESC);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_date ON incident_metrics_snapshots(snapshot_date DESC, period_type);
CREATE INDEX IF NOT EXISTS idx_team_performance_date ON team_performance(metric_date DESC, team_name);

-- Automation indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON automation_rules(rule_type, enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority ASC, enabled);

-- ===== ANALYTICAL VIEWS =====

-- Comprehensive incident analytics view
CREATE VIEW IF NOT EXISTS v_incident_analytics AS
SELECT
    i.id,
    i.title,
    i.category,
    i.severity,
    i.status,
    i.assigned_team,
    i.assigned_to,
    i.created_at,
    i.resolved_at,
    i.resolution_time_hours,
    i.response_time_hours,
    i.sla_breach,
    i.escalation_count,
    i.reopen_count,

    -- Calculate business hours resolution time
    CASE
        WHEN i.resolved_at IS NOT NULL THEN
            ROUND((julianday(i.resolved_at) - julianday(i.created_at)) * 24, 2)
        ELSE NULL
    END as total_resolution_hours,

    -- SLA compliance
    CASE
        WHEN i.sla_target_resolution_hours IS NOT NULL AND i.resolution_time_hours IS NOT NULL THEN
            CASE WHEN i.resolution_time_hours <= i.sla_target_resolution_hours THEN 'Met' ELSE 'Missed' END
        ELSE 'No SLA'
    END as sla_status,

    -- Related incidents count
    (SELECT COUNT(*) FROM incident_relationships r WHERE r.source_incident_id = i.id) as related_incidents_count,

    -- Comments count
    (SELECT COUNT(*) FROM incident_comments c WHERE c.incident_id = i.id) as comments_count,

    -- KB suggestions count
    (SELECT COUNT(*) FROM incident_kb_suggestions s WHERE s.incident_id = i.id) as kb_suggestions_count

FROM incidents i
WHERE i.archived = FALSE;

-- MTTR calculations by category and team
CREATE VIEW IF NOT EXISTS v_mttr_metrics AS
SELECT
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

FROM incidents
WHERE status IN ('resolved', 'closed')
    AND resolved_at IS NOT NULL
    AND archived = FALSE
GROUP BY category, assigned_team, severity;

-- Daily incident trends
CREATE VIEW IF NOT EXISTS v_daily_incident_trends AS
SELECT
    DATE(created_at) as incident_date,
    category,
    severity,
    COUNT(*) as new_incidents,
    COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_incidents,
    COUNT(CASE WHEN sla_breach = TRUE THEN 1 END) as sla_breaches,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time
FROM incidents
WHERE created_at >= datetime('now', '-90 days')
    AND archived = FALSE
GROUP BY DATE(created_at), category, severity
ORDER BY incident_date DESC;

-- Team performance summary
CREATE VIEW IF NOT EXISTS v_team_performance_summary AS
SELECT
    assigned_team,
    assigned_to,
    COUNT(*) as total_incidents,
    COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_incidents,
    ROUND(CAST(COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as resolution_rate,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time,
    COUNT(CASE WHEN sla_breach = FALSE AND status IN ('resolved', 'closed') THEN 1 END) as sla_met,
    COUNT(CASE WHEN sla_breach = TRUE THEN 1 END) as sla_missed,
    ROUND(CAST(COUNT(CASE WHEN sla_breach = FALSE AND status IN ('resolved', 'closed') THEN 1 END) AS REAL) / COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) * 100, 2) as sla_compliance
FROM incidents
WHERE created_at >= datetime('now', '-30 days')
    AND assigned_team IS NOT NULL
    AND archived = FALSE
GROUP BY assigned_team, assigned_to;

-- Incident category distribution
CREATE VIEW IF NOT EXISTS v_category_distribution AS
SELECT
    category,
    COUNT(*) as total_incidents,
    COUNT(CASE WHEN status = 'aberto' THEN 1 END) as open_incidents,
    COUNT(CASE WHEN status = 'em_tratamento' THEN 1 END) as in_progress_incidents,
    COUNT(CASE WHEN status IN ('resolvido', 'fechado') THEN 1 END) as resolved_incidents,
    ROUND(CAST(COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as resolution_percentage,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count
FROM incidents
WHERE archived = FALSE
GROUP BY category
ORDER BY total_incidents DESC;

-- ===== TRIGGERS FOR DATA CONSISTENCY =====

-- Update incident timestamps and metrics
CREATE TRIGGER IF NOT EXISTS tr_incident_status_update
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN OLD.status != NEW.status
BEGIN
    -- Update timestamps based on status changes
    UPDATE incidents SET
        updated_at = CURRENT_TIMESTAMP,
        assigned_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status = 'aberto' THEN CURRENT_TIMESTAMP ELSE assigned_at END,
        in_progress_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status != 'em_tratamento' THEN CURRENT_TIMESTAMP ELSE in_progress_at END,
        resolved_at = CASE WHEN NEW.status = 'resolvido' AND OLD.status != 'resolvido' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        closed_at = CASE WHEN NEW.status = 'fechado' AND OLD.status != 'fechado' THEN CURRENT_TIMESTAMP ELSE closed_at END,
        reopen_count = CASE WHEN OLD.status IN ('resolvido', 'fechado') AND NEW.status = 'reaberto' THEN reopen_count + 1 ELSE reopen_count END
    WHERE id = NEW.id;

    -- Calculate resolution time when incident is resolved
    UPDATE incidents SET
        resolution_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id AND NEW.status = 'resolvido' AND resolution_time_hours IS NULL;

    -- Insert status change comment
    INSERT INTO incident_comments (incident_id, comment_type, content, author)
    VALUES (NEW.id, 'status_change', 'Status changed from ' || OLD.status || ' to ' || NEW.status, COALESCE(NEW.assigned_to, 'system'));
END;

-- Calculate response time on first assignment
CREATE TRIGGER IF NOT EXISTS tr_incident_response_time
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL
BEGIN
    UPDATE incidents SET
        first_response_at = CURRENT_TIMESTAMP,
        response_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id;
END;

-- Auto-create relationship suggestions based on similarity
CREATE TRIGGER IF NOT EXISTS tr_auto_relationship_suggestions
AFTER INSERT ON incidents
FOR EACH ROW
BEGIN
    -- Find similar incidents based on title and description similarity
    INSERT OR IGNORE INTO incident_relationships (source_incident_id, target_incident_id, relationship_type, similarity_score, created_by)
    SELECT
        NEW.id,
        i.id,
        'related',
        0.7, -- Placeholder similarity score
        'auto_system'
    FROM incidents i
    WHERE i.id != NEW.id
        AND i.category = NEW.category
        AND i.archived = FALSE
        AND (
            -- Simple text matching - in production, use more sophisticated similarity
            i.title LIKE '%' || substr(NEW.title, 1, 20) || '%'
            OR NEW.title LIKE '%' || substr(i.title, 1, 20) || '%'
        )
    LIMIT 5;
END;

-- ===== INITIAL DATA =====

-- Default SLA policies
INSERT OR IGNORE INTO sla_policies (name, severity, response_time_hours, resolution_time_hours) VALUES
('Critical Incidents', 'critical', 1, 4),
('High Priority Incidents', 'high', 2, 8),
('Medium Priority Incidents', 'medium', 4, 24),
('Low Priority Incidents', 'low', 8, 72);

-- Default automation rules
INSERT OR IGNORE INTO automation_rules (name, description, rule_type, conditions, actions, priority) VALUES
('Auto-assign DB2 incidents', 'Automatically assign DB2 incidents to database team', 'auto_assign',
 '{"category": "DB2"}',
 '{"assign_to_team": "Database Team"}', 10),

('Auto-categorize JCL errors', 'Automatically categorize incidents with JCL keywords', 'auto_categorize',
 '{"title_contains": ["JCL", "job", "step"], "description_contains": ["JCL", "ABEND"]}',
 '{"set_category": "JCL", "add_tags": ["auto-categorized"]}', 20),

('Escalate critical incidents', 'Auto-escalate critical incidents if not assigned within 30 minutes', 'auto_escalate',
 '{"severity": "critical", "status": "open", "age_minutes": 30}',
 '{"escalate_to": "Manager", "notify": ["oncall@company.com"]}', 5);

-- Default report templates
INSERT OR IGNORE INTO report_templates (name, description, template_type, query_template, parameters) VALUES
('Daily Incident Summary', 'Daily summary of incident metrics', 'incident_summary',
 'SELECT category, severity, COUNT(*) as count FROM incidents WHERE DATE(created_at) = ? GROUP BY category, severity',
 '{"date": {"type": "date", "required": true}}'),

('SLA Compliance Report', 'Weekly SLA compliance metrics', 'sla_report',
 'SELECT * FROM v_mttr_metrics WHERE created_at BETWEEN ? AND ?',
 '{"start_date": {"type": "date", "required": true}, "end_date": {"type": "date", "required": true}}'),

('Team Performance Report', 'Monthly team performance metrics', 'team_performance',
 'SELECT * FROM v_team_performance_summary WHERE created_at BETWEEN ? AND ?',
 '{"start_date": {"type": "date", "required": true}, "end_date": {"type": "date", "required": true}}');

-- Update schema version
INSERT OR IGNORE INTO schema_versions (version, description) VALUES (2, 'Incident management system');

-- Analyze tables for query optimization
ANALYZE;