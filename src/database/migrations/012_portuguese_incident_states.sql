-- Migration: Convert incident states from English to Portuguese
-- Purpose: Update all incident-related state values to Portuguese terminology
-- Author: Backend Specialist
-- Date: 2025-09-18

PRAGMA foreign_keys = OFF;

-- ===== PHASE 1: UPDATE MAIN INCIDENT STATES =====

-- Update incident schema check constraint to use Portuguese states
BEGIN TRANSACTION;

-- First, temporarily disable the check constraint by recreating the table
-- Create new incidents table with Portuguese states
CREATE TABLE incidents_new (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Hardware', 'Software', 'Other')),
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    -- UPDATED: Portuguese incident states
    status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto', 'em_tratamento', 'resolvido', 'fechado', 'em_revisao')),
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

-- Copy existing data with state translation
INSERT INTO incidents_new SELECT
    id,
    title,
    description,
    category,
    severity,
    -- State translation mapping
    CASE status
        WHEN 'open' THEN 'aberto'
        WHEN 'in_progress' THEN 'em_tratamento'
        WHEN 'resolved' THEN 'resolvido'
        WHEN 'closed' THEN 'fechado'
        WHEN 'reopened' THEN 'aberto'  -- reopened becomes aberto
        ELSE 'aberto'  -- default fallback
    END as status,
    priority,
    assigned_team,
    assigned_to,
    reporter,
    resolution,
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
FROM incidents WHERE EXISTS (SELECT 1 FROM incidents LIMIT 1);

-- Drop old table and rename new one
DROP TABLE IF EXISTS incidents;
ALTER TABLE incidents_new RENAME TO incidents;

COMMIT;

-- ===== PHASE 2: UPDATE KB_ENTRIES INCIDENT STATUS FIELD =====

BEGIN TRANSACTION;

-- Update kb_entries status field to Portuguese if it has incident status
UPDATE kb_entries SET
    status = CASE status
        WHEN 'open' THEN 'aberto'
        WHEN 'in_progress' THEN 'em_tratamento'
        WHEN 'resolved' THEN 'resolvido'
        WHEN 'closed' THEN 'fechado'
        WHEN 'reopened' THEN 'aberto'
        ELSE status  -- Keep other statuses unchanged
    END
WHERE status IN ('open', 'in_progress', 'resolved', 'closed', 'reopened');

COMMIT;

-- ===== PHASE 3: UPDATE INCIDENT RELATIONSHIPS =====

-- Note: incident_relationships table doesn't contain status fields, so no update needed

-- ===== PHASE 4: UPDATE INCIDENT COMMENTS =====

-- Update status change comments to reflect new Portuguese states
BEGIN TRANSACTION;

UPDATE incident_comments
SET content = REPLACE(content, 'Status changed from open to', 'Status mudou de aberto para')
WHERE content LIKE '%Status changed from open to%';

UPDATE incident_comments
SET content = REPLACE(content, 'Status changed from in_progress to', 'Status mudou de em_tratamento para')
WHERE content LIKE '%Status changed from in_progress to%';

UPDATE incident_comments
SET content = REPLACE(content, 'Status changed from resolved to', 'Status mudou de resolvido para')
WHERE content LIKE '%Status changed from resolved to%';

UPDATE incident_comments
SET content = REPLACE(content, 'Status changed from closed to', 'Status mudou de fechado para')
WHERE content LIKE '%Status changed from closed to%';

UPDATE incident_comments
SET content = REPLACE(content, 'Status changed from reopened to', 'Status mudou de aberto para')
WHERE content LIKE '%Status changed from reopened to%';

-- Update target statuses in comments
UPDATE incident_comments
SET content = REPLACE(content, ' open', ' aberto')
WHERE content LIKE '%Status changed%' OR content LIKE '%Status mudou%';

UPDATE incident_comments
SET content = REPLACE(content, ' in_progress', ' em_tratamento')
WHERE content LIKE '%Status changed%' OR content LIKE '%Status mudou%';

UPDATE incident_comments
SET content = REPLACE(content, ' resolved', ' resolvido')
WHERE content LIKE '%Status changed%' OR content LIKE '%Status mudou%';

UPDATE incident_comments
SET content = REPLACE(content, ' closed', ' fechado')
WHERE content LIKE '%Status changed%' OR content LIKE '%Status mudou%';

UPDATE incident_comments
SET content = REPLACE(content, ' reopened', ' aberto')
WHERE content LIKE '%Status changed%' OR content LIKE '%Status mudou%';

COMMIT;

-- ===== PHASE 5: UPDATE STATUS TRANSITIONS TABLE =====

BEGIN TRANSACTION;

-- Update incident_status_transitions table if it exists
UPDATE incident_status_transitions
SET from_status = CASE from_status
    WHEN 'open' THEN 'aberto'
    WHEN 'in_progress' THEN 'em_tratamento'
    WHEN 'resolved' THEN 'resolvido'
    WHEN 'closed' THEN 'fechado'
    WHEN 'reopened' THEN 'aberto'
    ELSE from_status
END,
to_status = CASE to_status
    WHEN 'open' THEN 'aberto'
    WHEN 'in_progress' THEN 'em_tratamento'
    WHEN 'resolved' THEN 'resolvido'
    WHEN 'closed' THEN 'fechado'
    WHEN 'reopened' THEN 'aberto'
    ELSE to_status
END
WHERE EXISTS (SELECT 1 FROM incident_status_transitions LIMIT 1);

COMMIT;

-- ===== PHASE 6: UPDATE AUTOMATION RULES =====

BEGIN TRANSACTION;

-- Update automation rules conditions and actions that reference incident states
UPDATE automation_rules
SET conditions = REPLACE(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(conditions, '"open"', '"aberto"'),
                '"in_progress"', '"em_tratamento"'
            ),
            '"resolved"', '"resolvido"'
        ),
        '"closed"', '"fechado"'
    ),
    '"reopened"', '"aberto"'
)
WHERE conditions LIKE '%"open"%'
   OR conditions LIKE '%"in_progress"%'
   OR conditions LIKE '%"resolved"%'
   OR conditions LIKE '%"closed"%'
   OR conditions LIKE '%"reopened"%';

UPDATE automation_rules
SET actions = REPLACE(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(actions, '"open"', '"aberto"'),
                '"in_progress"', '"em_tratamento"'
            ),
            '"resolved"', '"resolvido"'
        ),
        '"closed"', '"fechado"'
    ),
    '"reopened"', '"aberto"'
)
WHERE actions LIKE '%"open"%'
   OR actions LIKE '%"in_progress"%'
   OR actions LIKE '%"resolved"%'
   OR actions LIKE '%"closed"%'
   OR actions LIKE '%"reopened"%';

COMMIT;

-- ===== PHASE 7: RECREATE VIEWS WITH PORTUGUESE STATES =====

-- Drop existing views that reference incident states
DROP VIEW IF EXISTS v_incident_analytics;
DROP VIEW IF EXISTS v_mttr_metrics;
DROP VIEW IF EXISTS v_daily_incident_trends;
DROP VIEW IF EXISTS v_team_performance_summary;
DROP VIEW IF EXISTS v_category_distribution;

-- Recreate views with Portuguese states
CREATE VIEW v_incident_analytics AS
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

-- MTTR calculations by category and team (updated for Portuguese states)
CREATE VIEW v_mttr_metrics AS
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
WHERE status IN ('resolvido', 'fechado')  -- Updated Portuguese states
    AND resolved_at IS NOT NULL
    AND archived = FALSE
GROUP BY category, assigned_team, severity;

-- Daily incident trends (updated for Portuguese states)
CREATE VIEW v_daily_incident_trends AS
SELECT
    DATE(created_at) as incident_date,
    category,
    severity,
    COUNT(*) as new_incidents,
    COUNT(CASE WHEN status IN ('resolvido', 'fechado') THEN 1 END) as resolved_incidents,  -- Portuguese states
    COUNT(CASE WHEN sla_breach = TRUE THEN 1 END) as sla_breaches,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time
FROM incidents
WHERE created_at >= datetime('now', '-90 days')
    AND archived = FALSE
GROUP BY DATE(created_at), category, severity
ORDER BY incident_date DESC;

-- Team performance summary (updated for Portuguese states)
CREATE VIEW v_team_performance_summary AS
SELECT
    assigned_team,
    assigned_to,
    COUNT(*) as total_incidents,
    COUNT(CASE WHEN status IN ('resolvido', 'fechado') THEN 1 END) as resolved_incidents,  -- Portuguese states
    ROUND(CAST(COUNT(CASE WHEN status IN ('resolvido', 'fechado') THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as resolution_rate,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time,
    COUNT(CASE WHEN sla_breach = FALSE AND status IN ('resolvido', 'fechado') THEN 1 END) as sla_met,  -- Portuguese states
    COUNT(CASE WHEN sla_breach = TRUE THEN 1 END) as sla_missed,
    ROUND(CAST(COUNT(CASE WHEN sla_breach = FALSE AND status IN ('resolvido', 'fechado') THEN 1 END) AS REAL) / COUNT(CASE WHEN status IN ('resolvido', 'fechado') THEN 1 END) * 100, 2) as sla_compliance
FROM incidents
WHERE created_at >= datetime('now', '-30 days')
    AND assigned_team IS NOT NULL
    AND archived = FALSE
GROUP BY assigned_team, assigned_to;

-- Incident category distribution (updated for Portuguese states)
CREATE VIEW v_category_distribution AS
SELECT
    category,
    COUNT(*) as total_incidents,
    COUNT(CASE WHEN status = 'aberto' THEN 1 END) as open_incidents,              -- Portuguese: aberto
    COUNT(CASE WHEN status = 'em_tratamento' THEN 1 END) as in_progress_incidents, -- Portuguese: em_tratamento
    COUNT(CASE WHEN status IN ('resolvido', 'fechado') THEN 1 END) as resolved_incidents, -- Portuguese: resolvido, fechado
    ROUND(CAST(COUNT(CASE WHEN status IN ('resolvido', 'fechado') THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as resolution_percentage,
    ROUND(AVG(CASE WHEN resolution_time_hours IS NOT NULL THEN resolution_time_hours END), 2) as avg_resolution_time,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count
FROM incidents
WHERE archived = FALSE
GROUP BY category
ORDER BY total_incidents DESC;

-- ===== PHASE 8: UPDATE TRIGGERS =====

-- Drop existing triggers
DROP TRIGGER IF EXISTS tr_incident_status_update;
DROP TRIGGER IF EXISTS tr_incident_response_time;
DROP TRIGGER IF EXISTS tr_auto_relationship_suggestions;

-- Recreate triggers with Portuguese states
CREATE TRIGGER tr_incident_status_update
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN OLD.status != NEW.status
BEGIN
    -- Update timestamps based on status changes (Portuguese states)
    UPDATE incidents SET
        updated_at = CURRENT_TIMESTAMP,
        assigned_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status = 'aberto' THEN CURRENT_TIMESTAMP ELSE assigned_at END,
        in_progress_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status != 'em_tratamento' THEN CURRENT_TIMESTAMP ELSE in_progress_at END,
        resolved_at = CASE WHEN NEW.status = 'resolvido' AND OLD.status != 'resolvido' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        closed_at = CASE WHEN NEW.status = 'fechado' AND OLD.status != 'fechado' THEN CURRENT_TIMESTAMP ELSE closed_at END,
        reopen_count = CASE WHEN OLD.status IN ('resolvido', 'fechado') AND NEW.status = 'aberto' THEN reopen_count + 1 ELSE reopen_count END
    WHERE id = NEW.id;

    -- Calculate resolution time when incident is resolved
    UPDATE incidents SET
        resolution_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id AND NEW.status = 'resolvido' AND resolution_time_hours IS NULL;

    -- Insert status change comment
    INSERT INTO incident_comments (incident_id, comment_type, content, author)
    VALUES (NEW.id, 'status_change', 'Status mudou de ' || OLD.status || ' para ' || NEW.status, COALESCE(NEW.assigned_to, 'system'));
END;

-- Recreate response time trigger (no changes needed)
CREATE TRIGGER tr_incident_response_time
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL
BEGIN
    UPDATE incidents SET
        first_response_at = CURRENT_TIMESTAMP,
        response_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id;
END;

-- Recreate auto-relationship trigger (no changes needed)
CREATE TRIGGER tr_auto_relationship_suggestions
AFTER INSERT ON incidents
FOR EACH ROW
BEGIN
    INSERT OR IGNORE INTO incident_relationships (source_incident_id, target_incident_id, relationship_type, similarity_score, created_by)
    SELECT
        NEW.id,
        i.id,
        'related',
        0.7,
        'auto_system'
    FROM incidents i
    WHERE i.id != NEW.id
        AND i.category = NEW.category
        AND i.archived = FALSE
        AND (
            i.title LIKE '%' || substr(NEW.title, 1, 20) || '%'
            OR NEW.title LIKE '%' || substr(i.title, 1, 20) || '%'
        )
    LIMIT 5;
END;

-- ===== PHASE 9: UPDATE CHECK CONSTRAINTS IN OTHER TABLES =====

-- Update migration table if it has incident-related status checks
-- Note: This migration handles the main incident tables, other tables with
-- different status values (like backup, health checks, etc.) remain unchanged

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;

-- ===== PHASE 10: CREATE COMPATIBILITY FUNCTIONS =====

-- Create helper functions for state translation if needed by applications
-- These can be used during the transition period

-- Create a mapping table for state translations (temporary)
CREATE TEMPORARY TABLE state_translation_map (
    english_state TEXT PRIMARY KEY,
    portuguese_state TEXT NOT NULL
);

INSERT INTO state_translation_map VALUES
    ('open', 'aberto'),
    ('in_progress', 'em_tratamento'),
    ('resolved', 'resolvido'),
    ('closed', 'fechado'),
    ('reopened', 'aberto'),
    ('em_revisao', 'em_revisao');  -- New state for bulk/API imports

-- Update schema version
INSERT OR IGNORE INTO schema_versions (version, description) VALUES
    (3, 'Portuguese incident states migration');

-- Optimization: Reanalyze tables after structural changes
ANALYZE incidents;
ANALYZE incident_comments;
ANALYZE incident_relationships;

-- ===== MIGRATION COMPLETE =====
-- Summary:
-- - Updated incidents.status CHECK constraint to Portuguese states
-- - Translated all existing incident status data
-- - Updated kb_entries incident statuses
-- - Updated incident comments with status changes
-- - Updated incident_status_transitions table
-- - Updated automation rules conditions and actions
-- - Recreated all incident-related views with Portuguese states
-- - Recreated triggers with Portuguese state logic
-- - Added new 'em_revisao' state for bulk/API import processing

SELECT 'Portuguese incident states migration completed successfully' as result;