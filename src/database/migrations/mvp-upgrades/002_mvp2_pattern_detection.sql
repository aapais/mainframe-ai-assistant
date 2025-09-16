-- UP
-- Migration: MVP2 Pattern Detection Tables
-- Version: 002
-- Generated: 2025-01-11
-- Description: Add pattern detection capabilities for incident analysis

-- ===== INCIDENT MANAGEMENT TABLES =====

-- Imported incidents from external systems
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    component TEXT,
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
    status TEXT CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    created_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolution TEXT,
    resolution_time_minutes INTEGER,
    assigned_to TEXT,
    source_system TEXT DEFAULT 'manual' CHECK(source_system IN ('servicenow', 'jira', 'manual', 'auto')),
    kb_entry_id TEXT,
    metadata TEXT, -- JSON for additional fields
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id)
);

-- Pattern detection results
CREATE TABLE IF NOT EXISTS detected_patterns (
    id TEXT PRIMARY KEY,
    pattern_type TEXT CHECK(pattern_type IN ('temporal', 'component', 'error', 'mixed')) NOT NULL,
    confidence REAL CHECK(confidence >= 0 AND confidence <= 1) NOT NULL,
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')) NOT NULL,
    frequency INTEGER DEFAULT 1,
    first_seen DATETIME NOT NULL,
    last_seen DATETIME NOT NULL,
    status TEXT CHECK(status IN ('active', 'resolved', 'ignored')) DEFAULT 'active',
    suggested_cause TEXT,
    suggested_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    resolved_at DATETIME
);

-- Link incidents to patterns
CREATE TABLE IF NOT EXISTS pattern_incidents (
    pattern_id TEXT NOT NULL,
    incident_id TEXT NOT NULL,
    contribution_score REAL DEFAULT 1.0 CHECK(contribution_score >= 0 AND contribution_score <= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pattern_id, incident_id),
    FOREIGN KEY (pattern_id) REFERENCES detected_patterns(id) ON DELETE CASCADE,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Root cause analysis results
CREATE TABLE IF NOT EXISTS root_cause_analysis (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL,
    cause_type TEXT CHECK(cause_type IN ('sudden_failure', 'component_failure', 'recurring_error', 'cascading_failure', 'external_dependency', 'configuration_change', 'capacity_limit', 'human_error')) NOT NULL,
    description TEXT NOT NULL,
    confidence REAL CHECK(confidence >= 0 AND confidence <= 1) NOT NULL,
    evidence TEXT, -- JSON array of evidence
    suggestions TEXT, -- JSON array of suggestions
    validated BOOLEAN DEFAULT FALSE,
    validated_by TEXT,
    validated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pattern_id) REFERENCES detected_patterns(id) ON DELETE CASCADE
);

-- Alert notifications
CREATE TABLE IF NOT EXISTS pattern_alerts (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL,
    alert_type TEXT CHECK(alert_type IN ('critical_pattern', 'emerging_issue', 'preventive_alert', 'escalation')) NOT NULL,
    message TEXT NOT NULL,
    channel TEXT CHECK(channel IN ('dashboard', 'email', 'teams', 'sms')) DEFAULT 'dashboard',
    sent_to TEXT,
    status TEXT CHECK(status IN ('pending', 'sent', 'failed', 'acknowledged')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    acknowledged_at DATETIME,
    FOREIGN KEY (pattern_id) REFERENCES detected_patterns(id) ON DELETE CASCADE
);

-- Component health tracking
CREATE TABLE IF NOT EXISTS component_health (
    component TEXT PRIMARY KEY,
    health_score REAL CHECK(health_score >= 0 AND health_score <= 100) DEFAULT 100,
    incident_count_24h INTEGER DEFAULT 0,
    incident_count_7d INTEGER DEFAULT 0,
    last_incident_at DATETIME,
    mean_time_to_repair_minutes REAL,
    failure_rate REAL DEFAULT 0,
    status TEXT CHECK(status IN ('healthy', 'degraded', 'failing', 'unknown')) DEFAULT 'healthy',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON for additional metrics
);

-- Import job tracking
CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    source_system TEXT NOT NULL,
    job_type TEXT CHECK(job_type IN ('full', 'incremental', 'manual')) DEFAULT 'incremental',
    status TEXT CHECK(status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
    records_processed INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    file_path TEXT,
    error_log TEXT,
    metadata TEXT -- JSON for additional info
);

-- ===== INDEXES FOR PATTERN DETECTION PERFORMANCE =====

-- Incident indexes
CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_component ON incidents(component, created_at DESC) WHERE component IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_ticket_id ON incidents(ticket_id);
CREATE INDEX IF NOT EXISTS idx_incidents_kb_link ON incidents(kb_entry_id) WHERE kb_entry_id IS NOT NULL;

-- Pattern indexes
CREATE INDEX IF NOT EXISTS idx_patterns_type ON detected_patterns(pattern_type, status);
CREATE INDEX IF NOT EXISTS idx_patterns_severity ON detected_patterns(severity, status);
CREATE INDEX IF NOT EXISTS idx_patterns_active ON detected_patterns(status, last_seen DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_patterns_timeline ON detected_patterns(first_seen, last_seen);

-- Pattern incidents composite index
CREATE INDEX IF NOT EXISTS idx_pattern_incidents_pattern ON pattern_incidents(pattern_id, contribution_score DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_incidents_incident ON pattern_incidents(incident_id);

-- Root cause indexes
CREATE INDEX IF NOT EXISTS idx_root_cause_pattern ON root_cause_analysis(pattern_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_root_cause_validated ON root_cause_analysis(validated, confidence DESC);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_alerts_pattern ON pattern_alerts(pattern_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON pattern_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_pending ON pattern_alerts(status, created_at) WHERE status = 'pending';

-- Component health indexes
CREATE INDEX IF NOT EXISTS idx_component_health_score ON component_health(health_score ASC);
CREATE INDEX IF NOT EXISTS idx_component_health_updated ON component_health(last_updated DESC);

-- Import job indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_system ON import_jobs(source_system, started_at DESC);

-- ===== PATTERN DETECTION VIEWS =====

-- View for active critical patterns
CREATE VIEW IF NOT EXISTS v_critical_patterns AS
SELECT 
    p.id,
    p.pattern_type,
    p.severity,
    p.confidence,
    p.frequency,
    p.suggested_cause,
    p.suggested_action,
    p.first_seen,
    p.last_seen,
    COUNT(pi.incident_id) as incident_count,
    GROUP_CONCAT(DISTINCT i.component, ', ') as affected_components,
    MAX(i.created_at) as latest_incident
FROM detected_patterns p
JOIN pattern_incidents pi ON p.id = pi.pattern_id
JOIN incidents i ON pi.incident_id = i.id
WHERE p.status = 'active' AND p.severity IN ('critical', 'high')
GROUP BY p.id, p.pattern_type, p.severity, p.confidence, p.frequency, 
         p.suggested_cause, p.suggested_action, p.first_seen, p.last_seen
ORDER BY p.severity = 'critical' DESC, p.confidence DESC;

-- View for component health summary
CREATE VIEW IF NOT EXISTS v_component_summary AS
SELECT 
    ch.component,
    ch.health_score,
    ch.status,
    ch.incident_count_24h,
    ch.incident_count_7d,
    ch.last_incident_at,
    ch.mean_time_to_repair_minutes,
    COUNT(DISTINCT dp.id) as active_patterns,
    MAX(dp.severity) as highest_pattern_severity
FROM component_health ch
LEFT JOIN incidents i ON ch.component = i.component 
LEFT JOIN pattern_incidents pi ON i.id = pi.incident_id
LEFT JOIN detected_patterns dp ON pi.pattern_id = dp.id AND dp.status = 'active'
GROUP BY ch.component, ch.health_score, ch.status, ch.incident_count_24h, 
         ch.incident_count_7d, ch.last_incident_at, ch.mean_time_to_repair_minutes;

-- View for pattern analytics
CREATE VIEW IF NOT EXISTS v_pattern_analytics AS
SELECT 
    DATE(p.first_seen) as date,
    p.pattern_type,
    p.severity,
    COUNT(*) as patterns_detected,
    AVG(p.confidence) as avg_confidence,
    SUM(p.frequency) as total_incidents,
    COUNT(CASE WHEN p.status = 'resolved' THEN 1 END) as resolved_patterns,
    COUNT(CASE WHEN p.acknowledged_at IS NOT NULL THEN 1 END) as acknowledged_patterns
FROM detected_patterns p
WHERE p.first_seen >= DATE('now', '-30 days')
GROUP BY DATE(p.first_seen), p.pattern_type, p.severity
ORDER BY date DESC;

-- ===== TRIGGERS FOR PATTERN DETECTION =====

-- Update component health on new incidents
CREATE TRIGGER IF NOT EXISTS tr_update_component_health
AFTER INSERT ON incidents
FOR EACH ROW
WHEN NEW.component IS NOT NULL
BEGIN
    INSERT OR REPLACE INTO component_health (
        component,
        incident_count_24h,
        incident_count_7d,
        last_incident_at,
        last_updated
    )
    VALUES (
        NEW.component,
        COALESCE((
            SELECT incident_count_24h + 1
            FROM component_health 
            WHERE component = NEW.component
        ), 1),
        COALESCE((
            SELECT incident_count_7d + 1
            FROM component_health 
            WHERE component = NEW.component
        ), 1),
        NEW.created_at,
        CURRENT_TIMESTAMP
    );
END;

-- Update pattern last_seen when new incident is linked
CREATE TRIGGER IF NOT EXISTS tr_update_pattern_last_seen
AFTER INSERT ON pattern_incidents
FOR EACH ROW
BEGIN
    UPDATE detected_patterns 
    SET 
        last_seen = (
            SELECT MAX(i.created_at)
            FROM incidents i
            JOIN pattern_incidents pi ON i.id = pi.incident_id
            WHERE pi.pattern_id = NEW.pattern_id
        ),
        frequency = frequency + 1
    WHERE id = NEW.pattern_id;
END;

-- Update incident resolution time
CREATE TRIGGER IF NOT EXISTS tr_calculate_resolution_time
AFTER UPDATE OF resolved_at ON incidents
FOR EACH ROW
WHEN NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL
BEGIN
    UPDATE incidents 
    SET resolution_time_minutes = CAST(
        (julianday(NEW.resolved_at) - julianday(NEW.created_at)) * 1440 AS INTEGER
    )
    WHERE id = NEW.id;
END;

-- ===== PATTERN DETECTION CONFIGURATION =====

-- Add pattern detection configuration
INSERT OR IGNORE INTO system_config (key, value, type, description) VALUES
('pattern_detection_enabled', 'true', 'boolean', 'Enable automatic pattern detection'),
('pattern_min_incidents', '3', 'integer', 'Minimum incidents required to form a pattern'),
('pattern_time_window_hours', '24', 'integer', 'Time window for pattern detection in hours'),
('pattern_similarity_threshold', '0.7', 'float', 'Minimum similarity threshold for pattern detection'),
('pattern_alert_threshold', '5', 'integer', 'Minimum incidents to trigger alerts'),
('component_health_update_interval', '300', 'integer', 'Component health update interval in seconds'),
('import_batch_size', '1000', 'integer', 'Batch size for incident imports'),
('pattern_cleanup_days', '90', 'integer', 'Days to keep resolved patterns'),
('root_cause_confidence_threshold', '0.6', 'float', 'Minimum confidence for root cause suggestions'),
('alert_retry_attempts', '3', 'integer', 'Number of retry attempts for failed alerts');

-- Update schema version
INSERT INTO schema_versions (version, description) VALUES (2, 'MVP2: Pattern Detection and Incident Analysis');

-- Initial component health scan
INSERT OR IGNORE INTO component_health (component, health_score, status)
SELECT DISTINCT category as component, 100 as health_score, 'healthy' as status
FROM kb_entries
WHERE category IS NOT NULL;

-- DOWN
-- Rollback for: MVP2 Pattern Detection Tables

-- Drop triggers first
DROP TRIGGER IF EXISTS tr_update_component_health;
DROP TRIGGER IF EXISTS tr_update_pattern_last_seen;
DROP TRIGGER IF EXISTS tr_calculate_resolution_time;

-- Drop views
DROP VIEW IF EXISTS v_pattern_analytics;
DROP VIEW IF EXISTS v_component_summary;
DROP VIEW IF EXISTS v_critical_patterns;

-- Drop indexes
DROP INDEX IF EXISTS idx_import_jobs_system;
DROP INDEX IF EXISTS idx_import_jobs_status;
DROP INDEX IF EXISTS idx_component_health_updated;
DROP INDEX IF EXISTS idx_component_health_score;
DROP INDEX IF EXISTS idx_alerts_pending;
DROP INDEX IF EXISTS idx_alerts_status;
DROP INDEX IF EXISTS idx_alerts_pattern;
DROP INDEX IF EXISTS idx_root_cause_validated;
DROP INDEX IF EXISTS idx_root_cause_pattern;
DROP INDEX IF EXISTS idx_pattern_incidents_incident;
DROP INDEX IF EXISTS idx_pattern_incidents_pattern;
DROP INDEX IF EXISTS idx_patterns_timeline;
DROP INDEX IF EXISTS idx_patterns_active;
DROP INDEX IF EXISTS idx_patterns_severity;
DROP INDEX IF EXISTS idx_patterns_type;
DROP INDEX IF EXISTS idx_incidents_kb_link;
DROP INDEX IF EXISTS idx_incidents_ticket_id;
DROP INDEX IF EXISTS idx_incidents_status;
DROP INDEX IF EXISTS idx_incidents_severity;
DROP INDEX IF EXISTS idx_incidents_component;
DROP INDEX IF EXISTS idx_incidents_timestamp;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS import_jobs;
DROP TABLE IF EXISTS component_health;
DROP TABLE IF EXISTS pattern_alerts;
DROP TABLE IF EXISTS root_cause_analysis;
DROP TABLE IF EXISTS pattern_incidents;
DROP TABLE IF EXISTS detected_patterns;
DROP TABLE IF EXISTS incidents;

-- Remove configuration
DELETE FROM system_config WHERE key IN (
    'pattern_detection_enabled',
    'pattern_min_incidents', 
    'pattern_time_window_hours',
    'pattern_similarity_threshold',
    'pattern_alert_threshold',
    'component_health_update_interval',
    'import_batch_size',
    'pattern_cleanup_days',
    'root_cause_confidence_threshold',
    'alert_retry_attempts'
);

-- Remove schema version
DELETE FROM schema_versions WHERE version = 2;