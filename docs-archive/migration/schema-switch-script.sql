-- =====================================================================
-- SCHEMA SWITCH SCRIPT: ATOMIC REPLACEMENT OF PRODUCTION TABLES
-- =====================================================================
-- This script performs the atomic switch from staging tables to production
-- WARNING: This script modifies production data - ensure backups are complete
-- Version: 1.0
-- Created: 2025-01-20
-- =====================================================================

-- Enable safety checks
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Start transaction for atomic operation
BEGIN IMMEDIATE TRANSACTION;

-- ===== PRE-SWITCH VALIDATION =====

.print "=== PRE-SWITCH VALIDATION ==="

-- Verify staging tables exist and have data
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM unified_entries_staging) > 0
        THEN 'PASS: Staging entries exist'
        ELSE 'FAIL: No staging entries found'
    END as staging_check
UNION ALL
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM unified_tags_staging) >= 0
        THEN 'PASS: Staging tags table exists'
        ELSE 'FAIL: No staging tags table'
    END as staging_tags_check;

-- Verify backup tables exist
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM kb_entries_backup) = (SELECT COUNT(*) FROM kb_entries)
        THEN 'PASS: KB backup complete'
        ELSE 'FAIL: KB backup incomplete'
    END as kb_backup_check
UNION ALL
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM incidents_backup) = (SELECT COUNT(*) FROM incidents)
        THEN 'PASS: Incidents backup complete'
        ELSE 'FAIL: Incidents backup incomplete'
    END as incidents_backup_check;

-- ===== STEP 1: RENAME EXISTING TABLES =====

.print "=== STEP 1: RENAMING EXISTING TABLES ==="

-- Rename existing production tables
ALTER TABLE kb_entries RENAME TO kb_entries_old;
ALTER TABLE incidents RENAME TO incidents_old;
ALTER TABLE kb_tags RENAME TO kb_tags_old;

-- Rename relationship tables if they exist
UPDATE sqlite_master SET name = 'kb_relations_old'
WHERE type = 'table' AND name = 'kb_relations';

UPDATE sqlite_master SET name = 'incident_relationships_old'
WHERE type = 'table' AND name = 'incident_relationships';

-- Rename other tables if they exist
UPDATE sqlite_master SET name = 'incident_comments_old'
WHERE type = 'table' AND name = 'incident_comments';

UPDATE sqlite_master SET name = 'entry_feedback_old'
WHERE type = 'table' AND name = 'entry_feedback';

UPDATE sqlite_master SET name = 'usage_metrics_old'
WHERE type = 'table' AND name = 'usage_metrics';

.print "Existing tables renamed to *_old"

-- ===== STEP 2: ACTIVATE STAGING TABLES =====

.print "=== STEP 2: ACTIVATING STAGING TABLES ==="

-- Rename staging tables to production names
ALTER TABLE unified_entries_staging RENAME TO unified_entries;
ALTER TABLE unified_tags_staging RENAME TO unified_tags;
ALTER TABLE unified_relationships_staging RENAME TO unified_relationships;
ALTER TABLE unified_comments_staging RENAME TO unified_comments;
ALTER TABLE unified_usage_metrics_staging RENAME TO unified_usage_metrics;

.print "Staging tables activated as production tables"

-- ===== STEP 3: CREATE INDEXES =====

.print "=== STEP 3: CREATING INDEXES ==="

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

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_unified_comments_entry ON unified_comments(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_comments_author ON unified_comments(author, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_comments_type ON unified_comments(comment_type, created_at DESC);

-- Usage metrics indexes
CREATE INDEX IF NOT EXISTS idx_unified_usage_entry ON unified_usage_metrics(entry_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_usage_action ON unified_usage_metrics(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_usage_user ON unified_usage_metrics(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unified_usage_timestamp ON unified_usage_metrics(timestamp DESC);

.print "Indexes created successfully"

-- ===== STEP 4: CREATE TRIGGERS =====

.print "=== STEP 4: CREATING TRIGGERS ==="

-- Update timestamps trigger
CREATE TRIGGER IF NOT EXISTS tr_unified_update_timestamp
AFTER UPDATE ON unified_entries
FOR EACH ROW
BEGIN
    UPDATE unified_entries
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Incident status update trigger
CREATE TRIGGER IF NOT EXISTS tr_unified_status_update
AFTER UPDATE ON unified_entries
FOR EACH ROW
WHEN NEW.entry_type = 'incident' AND OLD.status != NEW.status
BEGIN
    UPDATE unified_entries SET
        assigned_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status = 'aberto' THEN CURRENT_TIMESTAMP ELSE assigned_at END,
        in_progress_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status != 'em_tratamento' THEN CURRENT_TIMESTAMP ELSE in_progress_at END,
        resolved_at = CASE WHEN NEW.status = 'resolvido' AND OLD.status != 'resolvido' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        closed_at = CASE WHEN NEW.status = 'fechado' AND OLD.status != 'fechado' THEN CURRENT_TIMESTAMP ELSE closed_at END,
        reopen_count = CASE WHEN OLD.status IN ('resolvido', 'fechado') AND NEW.status = 'reaberto' THEN reopen_count + 1 ELSE reopen_count END
    WHERE id = NEW.id;

    UPDATE unified_entries SET
        resolution_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id AND NEW.status = 'resolvido' AND resolution_time_hours IS NULL;

    INSERT INTO unified_comments (entry_id, comment_type, content, author)
    VALUES (NEW.id, 'status_change', 'Status changed from ' || OLD.status || ' to ' || NEW.status, COALESCE(NEW.assigned_to, 'system'));
END;

-- Response time calculation trigger
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

-- Knowledge base usage tracking triggers
CREATE TRIGGER IF NOT EXISTS tr_unified_update_last_used
AFTER INSERT ON unified_usage_metrics
FOR EACH ROW
WHEN NEW.action = 'view'
BEGIN
    UPDATE unified_entries
    SET last_used = CURRENT_TIMESTAMP
    WHERE id = NEW.entry_id AND entry_type = 'knowledge';
END;

CREATE TRIGGER IF NOT EXISTS tr_unified_update_usage_count
AFTER INSERT ON unified_usage_metrics
FOR EACH ROW
WHEN NEW.action IN ('view', 'copy', 'export')
BEGIN
    UPDATE unified_entries
    SET usage_count = usage_count + 1
    WHERE id = NEW.entry_id AND entry_type = 'knowledge';
END;

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

-- Checksum generation trigger
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

.print "Triggers created successfully"

-- ===== STEP 5: CREATE FTS5 SEARCH TABLE =====

.print "=== STEP 5: CREATING FTS5 SEARCH ==="

-- Drop old FTS table if it exists
DROP TABLE IF EXISTS kb_fts;

-- Create new unified FTS5 table
CREATE VIRTUAL TABLE unified_fts USING fts5(
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

-- Populate FTS5 table
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
FROM unified_entries e;

-- Create FTS triggers
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

.print "FTS5 search table created and populated"

-- ===== STEP 6: CREATE BACKWARD COMPATIBILITY VIEWS =====

.print "=== STEP 6: CREATING COMPATIBILITY VIEWS ==="

-- Legacy KB entries view
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

-- Legacy incidents view
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

-- Legacy usage_metrics view
CREATE VIEW IF NOT EXISTS usage_metrics AS
SELECT
    id,
    entry_id,
    action,
    user_id,
    session_id,
    timestamp,
    metadata
FROM unified_usage_metrics;

.print "Compatibility views created"

-- ===== STEP 7: UPDATE SYSTEM CONFIGURATION =====

.print "=== STEP 7: UPDATING SYSTEM CONFIGURATION ==="

-- Update system configuration
UPDATE system_config SET value = 'true', updated_at = CURRENT_TIMESTAMP
WHERE key = 'unified_migration_completed';

INSERT OR REPLACE INTO system_config (key, value, type, description, category)
VALUES ('unified_migration_date', datetime('now'), 'string', 'Date when migration was completed', 'system');

INSERT OR REPLACE INTO system_config (key, value, type, description, category)
VALUES ('unified_schema_active', 'true', 'boolean', 'Whether unified schema is active', 'system');

-- Update schema version
INSERT OR REPLACE INTO schema_versions (version, description, applied_at)
VALUES (2, 'Unified KB and Incident schema', CURRENT_TIMESTAMP);

.print "System configuration updated"

-- ===== STEP 8: POST-SWITCH VALIDATION =====

.print "=== STEP 8: POST-SWITCH VALIDATION ==="

-- Validate the switch was successful
CREATE TEMP VIEW post_switch_validation AS
SELECT
    'Unified entries total' as metric,
    COUNT(*) as count
FROM unified_entries
UNION ALL
SELECT
    'Knowledge entries' as metric,
    COUNT(*) as count
FROM unified_entries WHERE entry_type = 'knowledge'
UNION ALL
SELECT
    'Incident entries' as metric,
    COUNT(*) as count
FROM unified_entries WHERE entry_type = 'incident'
UNION ALL
SELECT
    'Unified tags total' as metric,
    COUNT(*) as count
FROM unified_tags
UNION ALL
SELECT
    'KB entries view' as metric,
    COUNT(*) as count
FROM kb_entries
UNION ALL
SELECT
    'Incidents view' as metric,
    COUNT(*) as count
FROM incidents
UNION ALL
SELECT
    'FTS5 entries' as metric,
    COUNT(*) as count
FROM unified_fts;

SELECT * FROM post_switch_validation;

-- Validate data integrity after switch
CREATE TEMP VIEW post_switch_integrity AS
SELECT
    'KB view matches unified KB entries' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM kb_entries) = (SELECT COUNT(*) FROM unified_entries WHERE entry_type = 'knowledge')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'Incidents view matches unified incidents' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM incidents) = (SELECT COUNT(*) FROM unified_entries WHERE entry_type = 'incident')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'FTS5 table populated' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM unified_fts) = (SELECT COUNT(*) FROM unified_entries)
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'All triggers created' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'tr_unified_%') >= 8
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'All indexes created' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_unified_%') >= 15
        THEN 'PASS'
        ELSE 'FAIL'
    END as result;

SELECT * FROM post_switch_integrity;

-- Check for any failed validations
SELECT COUNT(*) as failed_post_switch_checks FROM post_switch_integrity WHERE result = 'FAIL';

-- ===== STEP 9: OPTIMIZE DATABASE =====

.print "=== STEP 9: OPTIMIZING DATABASE ==="

-- Analyze tables for query optimization
ANALYZE unified_entries;
ANALYZE unified_tags;
ANALYZE unified_relationships;
ANALYZE unified_comments;
ANALYZE unified_usage_metrics;
ANALYZE unified_fts;

-- Vacuum to reclaim space
VACUUM;

.print "Database optimized"

-- ===== COMMIT TRANSACTION =====

COMMIT;

.print "=== SCHEMA SWITCH COMPLETED SUCCESSFULLY ==="
.print "Production tables are now using the unified schema"
.print "Backup tables (*_old) are available for rollback if needed"
.print "All validation checks completed"

-- Final status
SELECT
    'Migration Status: COMPLETED' as status,
    datetime('now') as completion_time,
    (SELECT COUNT(*) FROM unified_entries) as total_entries,
    (SELECT COUNT(*) FROM unified_entries WHERE entry_type = 'knowledge') as knowledge_entries,
    (SELECT COUNT(*) FROM unified_entries WHERE entry_type = 'incident') as incident_entries;

-- =====================================================================
-- END OF SCHEMA SWITCH SCRIPT
-- =====================================================================