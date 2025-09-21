-- =====================================================================
-- DATA MIGRATION SCRIPT: KB_ENTRIES + INCIDENTS -> UNIFIED_ENTRIES
-- =====================================================================
-- This script handles the complete migration of kb_entries and incidents
-- tables into the new unified_entries structure with full data preservation
-- Version: 1.0
-- Created: 2025-01-20
-- =====================================================================

-- Enable safety checks
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ===== MIGRATION PREPARATION =====

-- Create backup tables
CREATE TABLE IF NOT EXISTS kb_entries_backup AS SELECT * FROM kb_entries;
CREATE TABLE IF NOT EXISTS incidents_backup AS SELECT * FROM incidents;
CREATE TABLE IF NOT EXISTS kb_tags_backup AS SELECT * FROM kb_tags;

-- Create staging tables for migration
CREATE TABLE IF NOT EXISTS unified_entries_staging AS SELECT * FROM unified_entries WHERE 1=0;
CREATE TABLE IF NOT EXISTS unified_tags_staging AS SELECT * FROM unified_tags WHERE 1=0;
CREATE TABLE IF NOT EXISTS unified_relationships_staging AS SELECT * FROM unified_relationships WHERE 1=0;
CREATE TABLE IF NOT EXISTS unified_comments_staging AS SELECT * FROM unified_comments WHERE 1=0;
CREATE TABLE IF NOT EXISTS unified_usage_metrics_staging as SELECT * FROM unified_usage_metrics WHERE 1=0;

-- ===== DATA VALIDATION VIEWS =====

-- Pre-migration data counts
CREATE TEMP VIEW pre_migration_counts AS
SELECT
    'kb_entries' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN archived = FALSE THEN 1 END) as active_count
FROM kb_entries
UNION ALL
SELECT
    'incidents' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN archived = FALSE THEN 1 END) as active_count
FROM incidents
UNION ALL
SELECT
    'kb_tags' as table_name,
    COUNT(*) as record_count,
    COUNT(*) as active_count
FROM kb_tags;

-- Display pre-migration counts
.print "=== PRE-MIGRATION DATA COUNTS ==="
SELECT * FROM pre_migration_counts;

-- ===== KNOWLEDGE BASE ENTRIES MIGRATION =====

.print "=== MIGRATING KNOWLEDGE BASE ENTRIES ==="

INSERT INTO unified_entries_staging (
    id,
    entry_type,
    title,
    description,
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
    confidence_score,
    archived,
    checksum,
    -- Incident-specific fields (NULL for KB entries)
    status,
    priority,
    assigned_team,
    assigned_to,
    reporter,
    resolution_type,
    root_cause,
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
    related_entries,
    ai_suggested_category,
    ai_confidence_score,
    ai_processed,
    tags,
    custom_fields,
    attachments
)
SELECT
    -- Core identification
    kb.id,
    'knowledge' as entry_type,
    kb.title,
    -- Use problem + solution as description for unified view
    CASE
        WHEN kb.problem IS NOT NULL AND kb.solution IS NOT NULL
        THEN kb.problem || '\n\n--- SOLUTION ---\n\n' || kb.solution
        WHEN kb.problem IS NOT NULL
        THEN kb.problem
        ELSE kb.solution
    END as description,
    kb.problem,
    kb.solution,
    kb.category,
    kb.severity,
    kb.created_at,
    kb.updated_at,
    kb.created_by,
    kb.usage_count,
    kb.success_count,
    kb.failure_count,
    kb.last_used,
    kb.confidence_score,
    kb.archived,
    kb.checksum,

    -- Incident-specific fields (NULL for KB entries)
    NULL as status,
    NULL as priority,
    NULL as assigned_team,
    NULL as assigned_to,
    NULL as reporter,
    NULL as resolution_type,
    NULL as root_cause,
    NULL as first_response_at,
    NULL as assigned_at,
    NULL as in_progress_at,
    NULL as resolved_at,
    NULL as closed_at,
    FALSE as sla_breach,
    NULL as sla_target_response_hours,
    NULL as sla_target_resolution_hours,
    NULL as resolution_time_hours,
    NULL as response_time_hours,
    0 as escalation_count,
    0 as reopen_count,
    NULL as related_entries,
    NULL as ai_suggested_category,
    NULL as ai_confidence_score,
    FALSE as ai_processed,
    NULL as tags, -- Will be populated from kb_tags table
    NULL as custom_fields,
    NULL as attachments
FROM kb_entries kb;

.print "Knowledge base entries migrated: "
SELECT COUNT(*) FROM unified_entries_staging WHERE entry_type = 'knowledge';

-- ===== INCIDENTS MIGRATION =====

.print "=== MIGRATING INCIDENTS ==="

INSERT INTO unified_entries_staging (
    id,
    entry_type,
    title,
    description,
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
    confidence_score,
    archived,
    checksum,
    -- Incident-specific fields
    status,
    priority,
    assigned_team,
    assigned_to,
    reporter,
    resolution_type,
    root_cause,
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
    related_entries,
    ai_suggested_category,
    ai_confidence_score,
    ai_processed,
    tags,
    custom_fields,
    attachments
)
SELECT
    -- Core identification
    inc.id,
    'incident' as entry_type,
    inc.title,
    inc.description,
    NULL as problem, -- Incidents don't have separate problem field
    inc.resolution as solution, -- Map incident resolution to unified solution
    inc.category,
    inc.severity,
    inc.created_at,
    inc.updated_at,
    COALESCE(inc.reporter, 'system') as created_by,

    -- KB-specific fields (NULL or default for incidents)
    0 as usage_count,
    0 as success_count,
    0 as failure_count,
    NULL as last_used,
    NULL as confidence_score,
    inc.archived,
    NULL as checksum, -- Will be generated by trigger

    -- Incident-specific fields
    inc.status,
    inc.priority,
    inc.assigned_team,
    inc.assigned_to,
    inc.reporter,
    inc.resolution_type,
    inc.root_cause,
    inc.first_response_at,
    inc.assigned_at,
    inc.in_progress_at,
    inc.resolved_at,
    inc.closed_at,
    inc.sla_breach,
    inc.sla_target_response_hours,
    inc.sla_target_resolution_hours,
    inc.resolution_time_hours,
    inc.response_time_hours,
    inc.escalation_count,
    inc.reopen_count,
    inc.related_kb_entries as related_entries,
    inc.ai_suggested_category,
    inc.ai_confidence_score,
    inc.ai_processed,
    inc.tags,
    inc.custom_fields,
    inc.attachments
FROM incidents inc;

.print "Incidents migrated: "
SELECT COUNT(*) FROM unified_entries_staging WHERE entry_type = 'incident';

-- ===== TAGS MIGRATION =====

.print "=== MIGRATING TAGS ==="

-- Migrate KB tags
INSERT INTO unified_tags_staging (entry_id, tag, created_at, created_by)
SELECT
    kt.entry_id,
    kt.tag,
    kt.created_at,
    'migration' as created_by
FROM kb_tags kt;

-- Extract and migrate tags from incidents.tags JSON field
INSERT INTO unified_tags_staging (entry_id, tag, created_at, created_by)
SELECT DISTINCT
    inc.id as entry_id,
    TRIM(tag_value.value, '"') as tag,
    inc.created_at,
    'migration' as created_by
FROM incidents inc,
     json_each(inc.tags) as tag_value
WHERE inc.tags IS NOT NULL
  AND json_valid(inc.tags)
  AND LENGTH(TRIM(tag_value.value, '"')) > 0;

.print "Tags migrated: "
SELECT COUNT(*) FROM unified_tags_staging;

-- ===== RELATIONSHIPS MIGRATION =====

.print "=== MIGRATING RELATIONSHIPS ==="

-- Migrate KB relationships
INSERT INTO unified_relationships_staging (
    source_entry_id,
    target_entry_id,
    relationship_type,
    similarity_score,
    strength,
    created_at,
    created_by,
    validated
)
SELECT
    kr.source_id as source_entry_id,
    kr.target_id as target_entry_id,
    kr.relation_type as relationship_type,
    0.5 as similarity_score, -- Default similarity
    kr.strength,
    kr.created_at,
    'migration' as created_by,
    FALSE as validated
FROM kb_relations kr;

-- Migrate incident relationships (if table exists)
INSERT INTO unified_relationships_staging (
    source_entry_id,
    target_entry_id,
    relationship_type,
    similarity_score,
    strength,
    created_at,
    created_by,
    notes,
    validated
)
SELECT
    ir.source_incident_id as source_entry_id,
    ir.target_incident_id as target_entry_id,
    ir.relationship_type,
    ir.similarity_score,
    0.5 as strength, -- Default strength
    ir.created_at,
    COALESCE(ir.created_by, 'migration') as created_by,
    ir.notes,
    FALSE as validated
FROM incident_relationships ir
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='incident_relationships');

.print "Relationships migrated: "
SELECT COUNT(*) FROM unified_relationships_staging;

-- ===== COMMENTS MIGRATION =====

.print "=== MIGRATING COMMENTS ==="

-- Migrate incident comments
INSERT INTO unified_comments_staging (
    entry_id,
    comment_type,
    content,
    author,
    is_internal,
    created_at
)
SELECT
    ic.incident_id as entry_id,
    ic.comment_type,
    ic.content,
    ic.author,
    ic.is_internal,
    ic.created_at
FROM incident_comments ic
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='incident_comments');

-- Migrate entry feedback as comments
INSERT INTO unified_comments_staging (
    entry_id,
    comment_type,
    content,
    author,
    rating,
    successful,
    resolution_time,
    created_at
)
SELECT
    ef.entry_id,
    'usage_feedback' as comment_type,
    COALESCE(ef.comment, 'Feedback rating: ' || ef.rating || '/5') as content,
    COALESCE(ef.user_id, 'anonymous') as author,
    ef.rating,
    ef.successful,
    ef.resolution_time,
    ef.timestamp as created_at
FROM entry_feedback ef
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='entry_feedback');

.print "Comments migrated: "
SELECT COUNT(*) FROM unified_comments_staging;

-- ===== USAGE METRICS MIGRATION =====

.print "=== MIGRATING USAGE METRICS ==="

-- Migrate existing usage metrics
INSERT INTO unified_usage_metrics_staging (
    entry_id,
    action,
    user_id,
    session_id,
    timestamp,
    metadata
)
SELECT
    um.entry_id,
    um.action,
    um.user_id,
    um.session_id,
    um.timestamp,
    um.metadata
FROM usage_metrics um;

.print "Usage metrics migrated: "
SELECT COUNT(*) FROM unified_usage_metrics_staging;

-- ===== SEARCH HISTORY MIGRATION =====

.print "=== MIGRATING SEARCH HISTORY ==="

-- Update search history to use unified table
-- This assumes we're keeping the existing search_history table structure
-- but updating selected_entry_id to point to unified entries

-- No migration needed as search_history already points to entry IDs
-- The foreign key relationship will work with the unified table

-- ===== DATA VALIDATION =====

.print "=== VALIDATING MIGRATED DATA ==="

-- Create validation view
CREATE TEMP VIEW migration_validation AS
SELECT
    'Total unified entries' as metric,
    COUNT(*) as count
FROM unified_entries_staging
UNION ALL
SELECT
    'Knowledge entries' as metric,
    COUNT(*) as count
FROM unified_entries_staging WHERE entry_type = 'knowledge'
UNION ALL
SELECT
    'Incident entries' as metric,
    COUNT(*) as count
FROM unified_entries_staging WHERE entry_type = 'incident'
UNION ALL
SELECT
    'Total tags' as metric,
    COUNT(*) as count
FROM unified_tags_staging
UNION ALL
SELECT
    'Total relationships' as metric,
    COUNT(*) as count
FROM unified_relationships_staging
UNION ALL
SELECT
    'Total comments' as metric,
    COUNT(*) as count
FROM unified_comments_staging
UNION ALL
SELECT
    'Total usage metrics' as metric,
    COUNT(*) as count
FROM unified_usage_metrics_staging;

-- Show validation results
SELECT * FROM migration_validation;

-- Validate data integrity
CREATE TEMP VIEW data_integrity_check AS
SELECT
    'KB entries count match' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM kb_entries) = (SELECT COUNT(*) FROM unified_entries_staging WHERE entry_type = 'knowledge')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'Incidents count match' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM incidents) = (SELECT COUNT(*) FROM unified_entries_staging WHERE entry_type = 'incident')
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'No null IDs in unified entries' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM unified_entries_staging WHERE id IS NULL) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'No null entry types' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM unified_entries_staging WHERE entry_type IS NULL) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'Knowledge entries have problem/solution' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM unified_entries_staging WHERE entry_type = 'knowledge' AND (problem IS NULL OR solution IS NULL)) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result
UNION ALL
SELECT
    'Incidents have status and reporter' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM unified_entries_staging WHERE entry_type = 'incident' AND (status IS NULL OR reporter IS NULL)) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result;

.print "=== DATA INTEGRITY CHECKS ==="
SELECT * FROM data_integrity_check;

-- Check for any failed validations
SELECT COUNT(*) as failed_checks FROM data_integrity_check WHERE result = 'FAIL';

-- ===== FINAL STAGING VALIDATION =====

.print "=== FINAL STAGING VALIDATION ==="

-- Show sample records from each type
.print "Sample knowledge entry:"
SELECT id, entry_type, title, LEFT(description, 100) || '...' as description_preview
FROM unified_entries_staging
WHERE entry_type = 'knowledge'
LIMIT 1;

.print "Sample incident entry:"
SELECT id, entry_type, title, LEFT(description, 100) || '...' as description_preview, status, priority
FROM unified_entries_staging
WHERE entry_type = 'incident'
LIMIT 1;

-- Show tag distribution
.print "Tag distribution by entry type:"
SELECT
    e.entry_type,
    COUNT(DISTINCT t.entry_id) as entries_with_tags,
    COUNT(*) as total_tags
FROM unified_tags_staging t
JOIN unified_entries_staging e ON t.entry_id = e.id
GROUP BY e.entry_type;

-- Show category distribution
.print "Category distribution:"
SELECT
    entry_type,
    category,
    COUNT(*) as count
FROM unified_entries_staging
GROUP BY entry_type, category
ORDER BY entry_type, count DESC;

-- ===== PREPARATION FOR SCHEMA SWITCH =====

.print "=== STAGING COMPLETE - READY FOR SCHEMA SWITCH ==="
.print "To complete the migration, run the schema-switch script next."
.print "WARNING: The schema-switch script will replace the production tables."

-- Create migration log entry
INSERT INTO system_config (key, value, type, description, category)
VALUES ('migration_staging_completed', datetime('now'), 'string', 'Timestamp when staging migration completed', 'migration')
ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = CURRENT_TIMESTAMP;

-- =====================================================================
-- END OF DATA MIGRATION SCRIPT
-- =====================================================================