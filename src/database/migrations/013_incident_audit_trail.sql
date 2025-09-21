-- Migration: Create incident audit trail table
-- Purpose: Track all changes made to incidents for compliance and auditing
-- Author: Code Implementation Agent
-- Date: 2025-01-15

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Create incident_audit_trail table
CREATE TABLE IF NOT EXISTS incident_audit_trail (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    changed_fields TEXT NOT NULL, -- JSON array of field names
    change_reason TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    previous_values TEXT NOT NULL, -- JSON object with old values
    new_values TEXT NOT NULL, -- JSON object with new values
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    requires_approval BOOLEAN DEFAULT FALSE,
    critical_change BOOLEAN DEFAULT FALSE,
    approved_by TEXT,
    approved_at DATETIME,
    approval_status TEXT CHECK(approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approval_notes TEXT,

    FOREIGN KEY (incident_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_trail_incident_id ON incident_audit_trail(incident_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON incident_audit_trail(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_trail_changed_by ON incident_audit_trail(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_trail_critical ON incident_audit_trail(critical_change);
CREATE INDEX IF NOT EXISTS idx_audit_trail_approval ON incident_audit_trail(requires_approval, approval_status);

-- Create incident_status_transitions table if it doesn't exist
CREATE TABLE IF NOT EXISTS incident_status_transitions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    incident_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    change_reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON for additional transition metadata

    FOREIGN KEY (incident_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Create indexes for status transitions
CREATE INDEX IF NOT EXISTS idx_status_transitions_incident_id ON incident_status_transitions(incident_id);
CREATE INDEX IF NOT EXISTS idx_status_transitions_timestamp ON incident_status_transitions(timestamp);
CREATE INDEX IF NOT EXISTS idx_status_transitions_status ON incident_status_transitions(from_status, to_status);

-- Update incident_comments table to support comment types
ALTER TABLE incident_comments ADD COLUMN comment_type TEXT DEFAULT 'user_comment'
CHECK(comment_type IN ('user_comment', 'system_update', 'status_change', 'assignment', 'escalation', 'resolution'));

-- Create view for audit trail with human-readable information
CREATE VIEW IF NOT EXISTS v_incident_audit_trail AS
SELECT
    iat.id,
    iat.incident_id,
    ke.title as incident_title,
    ke.incident_number,
    iat.changed_fields,
    iat.change_reason,
    iat.changed_by,
    iat.previous_values,
    iat.new_values,
    iat.timestamp,
    iat.requires_approval,
    iat.critical_change,
    iat.approved_by,
    iat.approved_at,
    iat.approval_status,
    iat.approval_notes,

    -- Calculate change impact
    CASE
        WHEN json_extract(iat.changed_fields, '$') LIKE '%status%' THEN 'Status Change'
        WHEN json_extract(iat.changed_fields, '$') LIKE '%priority%' THEN 'Priority Change'
        WHEN json_extract(iat.changed_fields, '$') LIKE '%assigned_to%' THEN 'Assignment Change'
        WHEN json_extract(iat.changed_fields, '$') LIKE '%category%' THEN 'Category Change'
        ELSE 'General Update'
    END as change_type,

    -- Count of fields changed
    json_array_length(iat.changed_fields) as fields_changed_count

FROM incident_audit_trail iat
LEFT JOIN kb_entries ke ON iat.incident_id = ke.id
ORDER BY iat.timestamp DESC;

-- Create view for recent incident activity
CREATE VIEW IF NOT EXISTS v_recent_incident_activity AS
SELECT
    'audit' as activity_type,
    iat.id as activity_id,
    iat.incident_id,
    ke.title as incident_title,
    ke.incident_number,
    iat.changed_by as actor,
    'Incident updated: ' || iat.change_reason as description,
    iat.timestamp,
    iat.critical_change as is_critical
FROM incident_audit_trail iat
LEFT JOIN kb_entries ke ON iat.incident_id = ke.id

UNION ALL

SELECT
    'comment' as activity_type,
    ic.id as activity_id,
    ic.incident_id,
    ke.title as incident_title,
    ke.incident_number,
    ic.author as actor,
    CASE
        WHEN ic.comment_type = 'status_change' THEN 'Status changed'
        WHEN ic.comment_type = 'assignment' THEN 'Assignment changed'
        WHEN ic.comment_type = 'escalation' THEN 'Incident escalated'
        WHEN ic.comment_type = 'resolution' THEN 'Incident resolved'
        ELSE 'Comment added'
    END as description,
    ic.timestamp,
    FALSE as is_critical
FROM incident_comments ic
LEFT JOIN kb_entries ke ON ic.incident_id = ke.id

UNION ALL

SELECT
    'status_transition' as activity_type,
    ist.id as activity_id,
    ist.incident_id,
    ke.title as incident_title,
    ke.incident_number,
    ist.changed_by as actor,
    'Status: ' || ist.from_status || ' → ' || ist.to_status as description,
    ist.timestamp,
    TRUE as is_critical
FROM incident_status_transitions ist
LEFT JOIN kb_entries ke ON ist.incident_id = ke.id

ORDER BY timestamp DESC
LIMIT 100;

-- Create triggers for automatic audit trail updates

-- Trigger: Update approval timestamp when approval status changes
CREATE TRIGGER IF NOT EXISTS tr_audit_approval_update
AFTER UPDATE ON incident_audit_trail
FOR EACH ROW
WHEN OLD.approval_status != NEW.approval_status AND NEW.approval_status IN ('approved', 'rejected')
BEGIN
    UPDATE incident_audit_trail
    SET approved_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id AND approved_at IS NULL;
END;

-- Trigger: Auto-approve non-critical changes
CREATE TRIGGER IF NOT EXISTS tr_auto_approve_non_critical
AFTER INSERT ON incident_audit_trail
FOR EACH ROW
WHEN NEW.critical_change = FALSE AND NEW.requires_approval = FALSE
BEGIN
    UPDATE incident_audit_trail
    SET approval_status = 'approved',
        approved_by = 'system_auto',
        approved_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Function to cleanup old audit records (older than 2 years)
-- This would be called by a maintenance job
-- DELETE FROM incident_audit_trail WHERE timestamp < datetime('now', '-2 years');

COMMIT;

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;

-- Update schema version
INSERT OR IGNORE INTO schema_versions (version, description, applied_at) VALUES
    (13, 'Incident audit trail and status transitions', CURRENT_TIMESTAMP);

-- Analyze tables for query optimization
ANALYZE incident_audit_trail;
ANALYZE incident_status_transitions;
ANALYZE incident_comments;

-- Success message
SELECT 'Incident audit trail migration completed successfully' as result;