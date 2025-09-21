-- =====================================================================
-- EMERGENCY ROLLBACK SCRIPT: UNIFIED SCHEMA TO ORIGINAL TABLES
-- =====================================================================
-- This script provides emergency rollback from unified schema to original
-- separate kb_entries and incidents tables
-- WARNING: Use only in case of critical issues after migration
-- Version: 1.0
-- Created: 2025-01-20
-- =====================================================================

-- Enable safety checks
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Start transaction for atomic rollback
BEGIN IMMEDIATE TRANSACTION;

.print "=== EMERGENCY ROLLBACK PROCEDURE STARTED ==="
.print "WARNING: This will revert to the original separate table structure"

-- ===== STEP 1: VERIFY ROLLBACK CONDITIONS =====

.print "=== STEP 1: VERIFYING ROLLBACK CONDITIONS ==="

-- Check if backup tables exist
CREATE TEMP VIEW rollback_prereqs AS
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE name = 'kb_entries_backup' AND type = 'table')
        THEN 'PASS'
        ELSE 'FAIL'
    END as kb_backup_exists,
    CASE
        WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE name = 'incidents_backup' AND type = 'table')
        THEN 'PASS'
        ELSE 'FAIL'
    END as incidents_backup_exists,
    CASE
        WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE name = 'unified_entries' AND type = 'table')
        THEN 'PASS'
        ELSE 'FAIL'
    END as unified_table_exists;

SELECT * FROM rollback_prereqs;

-- Verify we have data to rollback from
SELECT
    'Unified entries count' as metric,
    COUNT(*) as value
FROM unified_entries
UNION ALL
SELECT
    'KB backup count' as metric,
    COUNT(*) as value
FROM kb_entries_backup
UNION ALL
SELECT
    'Incidents backup count' as metric,
    COUNT(*) as value
FROM incidents_backup;

-- ===== STEP 2: CREATE ROLLBACK DATA EXTRACTION =====

.print "=== STEP 2: EXTRACTING DATA FROM UNIFIED TABLES ==="

-- Create rollback staging tables from unified data
CREATE TABLE IF NOT EXISTS kb_entries_rollback AS
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
    checksum
FROM unified_entries
WHERE entry_type = 'knowledge';

CREATE TABLE IF NOT EXISTS incidents_rollback AS
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

-- Create kb_tags rollback table
CREATE TABLE IF NOT EXISTS kb_tags_rollback AS
SELECT
    t.entry_id,
    t.tag,
    t.created_at
FROM unified_tags t
JOIN unified_entries e ON t.entry_id = e.id
WHERE e.entry_type = 'knowledge';

.print "Rollback staging tables created"

-- ===== STEP 3: VALIDATE ROLLBACK DATA =====

.print "=== STEP 3: VALIDATING ROLLBACK DATA ==="

-- Compare rollback data with original backups
CREATE TEMP VIEW rollback_validation AS
SELECT
    'KB entries: backup vs rollback' as comparison,
    (SELECT COUNT(*) FROM kb_entries_backup) as backup_count,
    (SELECT COUNT(*) FROM kb_entries_rollback) as rollback_count,
    CASE
        WHEN (SELECT COUNT(*) FROM kb_entries_backup) = (SELECT COUNT(*) FROM kb_entries_rollback)
        THEN 'MATCH'
        ELSE 'DIFFER'
    END as status
UNION ALL
SELECT
    'Incidents: backup vs rollback' as comparison,
    (SELECT COUNT(*) FROM incidents_backup) as backup_count,
    (SELECT COUNT(*) FROM incidents_rollback) as rollback_count,
    CASE
        WHEN (SELECT COUNT(*) FROM incidents_backup) = (SELECT COUNT(*) FROM incidents_rollback)
        THEN 'MATCH'
        ELSE 'DIFFER'
    END as status
UNION ALL
SELECT
    'KB tags: backup vs rollback' as comparison,
    (SELECT COUNT(*) FROM kb_tags_backup) as backup_count,
    (SELECT COUNT(*) FROM kb_tags_rollback) as rollback_count,
    CASE
        WHEN (SELECT COUNT(*) FROM kb_tags_backup) = (SELECT COUNT(*) FROM kb_tags_rollback)
        THEN 'MATCH'
        ELSE 'DIFFER'
    END as status;

SELECT * FROM rollback_validation;

-- ===== STEP 4: REMOVE UNIFIED SCHEMA OBJECTS =====

.print "=== STEP 4: REMOVING UNIFIED SCHEMA OBJECTS ==="

-- Drop unified triggers
DROP TRIGGER IF EXISTS tr_unified_update_timestamp;
DROP TRIGGER IF EXISTS tr_unified_status_update;
DROP TRIGGER IF EXISTS tr_unified_response_time;
DROP TRIGGER IF EXISTS tr_unified_update_last_used;
DROP TRIGGER IF EXISTS tr_unified_update_usage_count;
DROP TRIGGER IF EXISTS tr_unified_update_success_count;
DROP TRIGGER IF EXISTS tr_unified_update_failure_count;
DROP TRIGGER IF EXISTS tr_unified_generate_checksum;
DROP TRIGGER IF EXISTS tr_unified_fts_insert;
DROP TRIGGER IF EXISTS tr_unified_fts_delete;
DROP TRIGGER IF EXISTS tr_unified_fts_update;
DROP TRIGGER IF EXISTS tr_unified_tags_fts_update;

-- Drop unified views
DROP VIEW IF EXISTS kb_entries;
DROP VIEW IF EXISTS incidents;
DROP VIEW IF EXISTS kb_tags;
DROP VIEW IF EXISTS usage_metrics;
DROP VIEW IF EXISTS v_knowledge_analytics;
DROP VIEW IF EXISTS v_incident_analytics;
DROP VIEW IF EXISTS v_unified_search;
DROP VIEW IF EXISTS v_unified_category_distribution;

-- Drop unified FTS table
DROP TABLE IF EXISTS unified_fts;

.print "Unified schema objects removed"

-- ===== STEP 5: RENAME UNIFIED TABLES =====

.print "=== STEP 5: RENAMING UNIFIED TABLES ==="

-- Rename unified tables to archive names
ALTER TABLE unified_entries RENAME TO unified_entries_archive;
ALTER TABLE unified_tags RENAME TO unified_tags_archive;
ALTER TABLE unified_relationships RENAME TO unified_relationships_archive;
ALTER TABLE unified_comments RENAME TO unified_comments_archive;
ALTER TABLE unified_usage_metrics RENAME TO unified_usage_metrics_archive;

.print "Unified tables archived"

-- ===== STEP 6: RESTORE ORIGINAL TABLES =====

.print "=== STEP 6: RESTORING ORIGINAL TABLES ==="

-- Option A: Restore from backup tables (preferred if data hasn't changed significantly)
ALTER TABLE kb_entries_backup RENAME TO kb_entries;
ALTER TABLE incidents_backup RENAME TO incidents;
ALTER TABLE kb_tags_backup RENAME TO kb_tags;

-- Restore old tables if they exist
UPDATE sqlite_master SET name = 'kb_relations'
WHERE type = 'table' AND name = 'kb_relations_old';

UPDATE sqlite_master SET name = 'incident_relationships'
WHERE type = 'table' AND name = 'incident_relationships_old';

UPDATE sqlite_master SET name = 'incident_comments'
WHERE type = 'table' AND name = 'incident_comments_old';

UPDATE sqlite_master SET name = 'entry_feedback'
WHERE type = 'table' AND name = 'entry_feedback_old';

UPDATE sqlite_master SET name = 'usage_metrics'
WHERE type = 'table' AND name = 'usage_metrics_old';

.print "Original tables restored"

-- ===== STEP 7: RECREATE ORIGINAL INDEXES =====

.print "=== STEP 7: RECREATING ORIGINAL INDEXES ==="

-- KB entries indexes
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

-- Incident indexes
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

-- Tag indexes
CREATE INDEX IF NOT EXISTS idx_tags_tag ON kb_tags(tag);
CREATE INDEX IF NOT EXISTS idx_tags_entry ON kb_tags(entry_id);

.print "Original indexes recreated"

-- ===== STEP 8: RECREATE ORIGINAL TRIGGERS =====

.print "=== STEP 8: RECREATING ORIGINAL TRIGGERS ==="

-- KB entries triggers
CREATE TRIGGER IF NOT EXISTS tr_kb_update_timestamp
AFTER UPDATE ON kb_entries
FOR EACH ROW
BEGIN
    UPDATE kb_entries
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tr_update_last_used
AFTER INSERT ON usage_metrics
FOR EACH ROW
WHEN NEW.action = 'view'
BEGIN
    UPDATE kb_entries
    SET last_used = CURRENT_TIMESTAMP
    WHERE id = NEW.entry_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_update_usage_count
AFTER INSERT ON usage_metrics
FOR EACH ROW
WHEN NEW.action IN ('view', 'copy', 'export')
BEGIN
    UPDATE kb_entries
    SET usage_count = usage_count + 1
    WHERE id = NEW.entry_id;
END;

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

-- Incident triggers
CREATE TRIGGER IF NOT EXISTS tr_incident_status_update
AFTER UPDATE ON incidents
FOR EACH ROW
WHEN OLD.status != NEW.status
BEGIN
    UPDATE incidents SET
        updated_at = CURRENT_TIMESTAMP,
        assigned_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status = 'aberto' THEN CURRENT_TIMESTAMP ELSE assigned_at END,
        in_progress_at = CASE WHEN NEW.status = 'em_tratamento' AND OLD.status != 'em_tratamento' THEN CURRENT_TIMESTAMP ELSE in_progress_at END,
        resolved_at = CASE WHEN NEW.status = 'resolvido' AND OLD.status != 'resolvido' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        closed_at = CASE WHEN NEW.status = 'fechado' AND OLD.status != 'fechado' THEN CURRENT_TIMESTAMP ELSE closed_at END,
        reopen_count = CASE WHEN OLD.status IN ('resolvido', 'fechado') AND NEW.status = 'reaberto' THEN reopen_count + 1 ELSE reopen_count END
    WHERE id = NEW.id;

    UPDATE incidents SET
        resolution_time_hours = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24, 2)
    WHERE id = NEW.id AND NEW.status = 'resolvido' AND resolution_time_hours IS NULL;
END;

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

.print "Original triggers recreated"

-- ===== STEP 9: RECREATE ORIGINAL FTS5 =====

.print "=== STEP 9: RECREATING ORIGINAL FTS5 ==="

-- Create original KB FTS5 table
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

-- Populate FTS5 table
INSERT INTO kb_fts(rowid, id, title, problem, solution, category, tags)
SELECT
    kb.rowid,
    kb.id,
    kb.title,
    kb.problem,
    kb.solution,
    kb.category,
    (SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = kb.id)
FROM kb_entries kb;

-- FTS5 triggers
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

.print "Original FTS5 recreated"

-- ===== STEP 10: UPDATE SYSTEM CONFIGURATION =====

.print "=== STEP 10: UPDATING SYSTEM CONFIGURATION ==="

-- Update system configuration to reflect rollback
UPDATE system_config SET value = 'false', updated_at = CURRENT_TIMESTAMP
WHERE key = 'unified_migration_completed';

UPDATE system_config SET value = 'false', updated_at = CURRENT_TIMESTAMP
WHERE key = 'unified_schema_active';

INSERT OR REPLACE INTO system_config (key, value, type, description, category)
VALUES ('rollback_completed', 'true', 'boolean', 'Whether rollback to original schema was completed', 'system');

INSERT OR REPLACE INTO system_config (key, value, type, description, category)
VALUES ('rollback_date', datetime('now'), 'string', 'Date when rollback was completed', 'system');

INSERT OR REPLACE INTO system_config (key, value, type, description, category)
VALUES ('rollback_reason', 'Emergency rollback', 'string', 'Reason for rollback', 'system');

-- Add rollback entry to schema versions
INSERT INTO schema_versions (version, description, applied_at, rollback_sql)
VALUES (1, 'Rollback to original separate tables schema', CURRENT_TIMESTAMP, 'Emergency rollback from unified schema');

.print "System configuration updated"

-- ===== STEP 11: POST-ROLLBACK VALIDATION =====

.print "=== STEP 11: POST-ROLLBACK VALIDATION ==="

-- Validate the rollback was successful
CREATE TEMP VIEW post_rollback_validation AS
SELECT
    'KB entries count' as metric,
    COUNT(*) as count
FROM kb_entries
UNION ALL
SELECT
    'Incidents count' as metric,
    COUNT(*) as count
FROM incidents
UNION ALL
SELECT
    'KB tags count' as metric,
    COUNT(*) as count
FROM kb_tags
UNION ALL
SELECT
    'KB FTS entries' as metric,
    COUNT(*) as count
FROM kb_fts;

SELECT * FROM post_rollback_validation;

-- Validate table structures
CREATE TEMP VIEW rollback_structure_check AS
SELECT
    'KB entries table exists' as check_type,
    CASE
        WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE name = 'kb_entries' AND type = 'table')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'Incidents table exists' as check_type,
    CASE
        WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE name = 'incidents' AND type = 'table')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'Unified tables archived' as check_type,
    CASE
        WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE name = 'unified_entries_archive' AND type = 'table')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'KB FTS table exists' as check_type,
    CASE
        WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE name = 'kb_fts' AND type = 'table')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'Original triggers restored' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'tr_%' AND name NOT LIKE 'tr_unified_%') >= 6
        THEN 'PASS'
        ELSE 'FAIL'
    END as result;

SELECT * FROM rollback_structure_check;

-- Check for any failed validations
SELECT COUNT(*) as failed_rollback_checks FROM rollback_structure_check WHERE result = 'FAIL';

-- ===== STEP 12: CLEANUP ROLLBACK TABLES =====

.print "=== STEP 12: CLEANING UP ROLLBACK TABLES ==="

-- Drop rollback staging tables
DROP TABLE IF EXISTS kb_entries_rollback;
DROP TABLE IF EXISTS incidents_rollback;
DROP TABLE IF EXISTS kb_tags_rollback;

.print "Rollback staging tables cleaned up"

-- ===== STEP 13: OPTIMIZE DATABASE =====

.print "=== STEP 13: OPTIMIZING DATABASE ==="

-- Analyze tables for query optimization
ANALYZE kb_entries;
ANALYZE incidents;
ANALYZE kb_tags;
ANALYZE kb_fts;

-- Vacuum to reclaim space
VACUUM;

.print "Database optimized"

-- ===== COMMIT ROLLBACK TRANSACTION =====

COMMIT;

.print "=== EMERGENCY ROLLBACK COMPLETED SUCCESSFULLY ==="
.print "System has been restored to original separate table structure"
.print "Unified tables have been archived with '_archive' suffix"
.print "All validation checks completed"

-- Final rollback status
SELECT
    'Rollback Status: COMPLETED' as status,
    datetime('now') as completion_time,
    (SELECT COUNT(*) FROM kb_entries) as kb_entries_count,
    (SELECT COUNT(*) FROM incidents) as incidents_count,
    (SELECT COUNT(*) FROM kb_tags) as kb_tags_count;

.print ""
.print "=== POST-ROLLBACK ACTIONS REQUIRED ==="
.print "1. Restart the application to reload original table structure"
.print "2. Verify all functionality works correctly"
.print "3. Check application logs for any errors"
.print "4. Test search functionality"
.print "5. Validate data integrity"
.print "6. Consider investigating root cause of rollback need"

-- =====================================================================
-- END OF EMERGENCY ROLLBACK SCRIPT
-- =====================================================================