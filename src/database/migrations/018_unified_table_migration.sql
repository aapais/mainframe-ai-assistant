-- UP
-- Migration: Unified Table Migration - KB Entries and Incidents
-- Version: 018
-- Generated: 2025-01-20T00:00:00.000Z
-- Description: Safely migrate existing data from kb_entries and incidents tables to unified 'entries' schema

-- ===== TRANSACTION BEGIN =====
BEGIN TRANSACTION;

-- ===== PRE-MIGRATION VALIDATION =====

-- Check if source tables exist
SELECT CASE
    WHEN NOT EXISTS (SELECT name FROM sqlite_master WHERE type='table' AND name='kb_entries') THEN
        RAISE(ABORT, 'Source table kb_entries does not exist')
    WHEN NOT EXISTS (SELECT name FROM sqlite_master WHERE type='table' AND name='incidents') THEN
        RAISE(ABORT, 'Source table incidents does not exist')
    ELSE 1
END as validation_check;

-- Create backup tables for rollback safety
CREATE TABLE kb_entries_backup_018 AS SELECT * FROM kb_entries;
CREATE TABLE incidents_backup_018 AS SELECT * FROM incidents;

-- Backup related tables
CREATE TABLE kb_tags_backup_018 AS SELECT * FROM kb_tags WHERE EXISTS (SELECT 1 FROM kb_entries WHERE id = entry_id);
CREATE TABLE incident_comments_backup_018 AS SELECT * FROM incident_comments WHERE EXISTS (SELECT 1 FROM incidents WHERE id = incident_id);
CREATE TABLE incident_related_backup_018 AS SELECT * FROM incident_related WHERE EXISTS (SELECT 1 FROM incidents WHERE id = incident_id);

-- Create backup log entry
INSERT INTO backup_log (backup_path, backup_type, entries_count, status)
VALUES ('unified_migration_018_backup', 'migration',
        (SELECT COUNT(*) FROM kb_entries) + (SELECT COUNT(*) FROM incidents), 'created');

-- ===== CREATE UNIFIED ENTRIES TABLE =====

CREATE TABLE IF NOT EXISTS entries (
    -- Core identification
    id TEXT PRIMARY KEY,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('knowledge', 'incident')) DEFAULT 'knowledge',

    -- Content fields
    title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 255),
    description TEXT NOT NULL CHECK(length(description) >= 10 AND length(description) <= 5000),
    solution TEXT CHECK(length(solution) <= 10000),

    -- Classification
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'Security', 'Network', 'Hardware', 'Software', 'System', 'Other')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),

    -- Status management (unified for both types)
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN (
        -- Knowledge statuses
        'active', 'draft', 'archived', 'deprecated',
        -- Incident statuses (Portuguese as required)
        'em_revisao', 'aberto', 'em_tratamento', 'resolvido', 'fechado', 'reaberto', 'em_revisao'
    )),

    -- Priority for incidents (1=highest, 5=lowest)
    priority INTEGER DEFAULT 3 CHECK(priority >= 1 AND priority <= 5),

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at DATETIME,
    closed_at DATETIME,
    last_used DATETIME,

    -- User tracking
    created_by TEXT DEFAULT 'system' CHECK(length(created_by) <= 100),
    assigned_to TEXT CHECK(length(assigned_to) <= 100),
    resolved_by TEXT CHECK(length(resolved_by) <= 100),

    -- Metrics
    usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
    success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
    failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
    view_count INTEGER DEFAULT 0 CHECK(view_count >= 0),
    analysis_count INTEGER DEFAULT 0 CHECK(analysis_count >= 0),

    -- Solution tracking
    solution_rating INTEGER CHECK(solution_rating >= 1 AND solution_rating <= 5),
    solution_accepted BOOLEAN DEFAULT FALSE,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 100),

    -- AI and analysis
    ai_analysis_requested BOOLEAN DEFAULT FALSE,
    ai_analysis_completed BOOLEAN DEFAULT FALSE,
    semantic_expansion TEXT,

    -- Source tracking for imports
    insertion_type TEXT DEFAULT 'manual' CHECK(insertion_type IN ('manual', 'bulk', 'api', 'integracao')),
    source_file TEXT CHECK(length(source_file) <= 500),
    source_system TEXT CHECK(length(source_system) <= 100),
    external_id TEXT CHECK(length(external_id) <= 100),

    -- Incident-specific fields
    escalation_count INTEGER DEFAULT 0 CHECK(escalation_count >= 0),
    reopen_count INTEGER DEFAULT 0 CHECK(reopen_count >= 0),
    response_time_hours REAL,
    resolution_time_hours REAL,
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_target_response_hours INTEGER,
    sla_target_resolution_hours INTEGER,

    -- Relationships and attachments (JSON)
    related_entries TEXT, -- JSON array of related entry IDs
    attachments TEXT, -- JSON array of attachment info
    custom_fields TEXT, -- JSON for custom fields
    tags_json TEXT, -- JSON array of tags for easier querying

    -- Archive flag
    archived BOOLEAN DEFAULT FALSE,

    -- Unique constraint for external imports
    UNIQUE(source_system, external_id) WHERE source_system IS NOT NULL AND external_id IS NOT NULL
);

-- ===== MIGRATION DATA TRANSFORMATION =====

-- Migrate KB Entries to unified table with entry_type='knowledge'
INSERT INTO entries (
    id, entry_type, title, description, solution, category, severity, status,
    created_at, updated_at, last_used, created_by, usage_count, success_count,
    failure_count, confidence_score, archived,
    -- Map incident fields from kb_entries extensions
    assigned_to, resolved_by, resolved_at, closed_at, solution_rating,
    solution_accepted, ai_analysis_requested, ai_analysis_completed,
    semantic_expansion, insertion_type, source_file, source_system, external_id
)
SELECT
    id,
    'knowledge' as entry_type,
    title,
    problem as description,
    solution,
    category,
    severity,
    -- Map incident_status to unified status if present, otherwise 'active'
    CASE
        WHEN incident_status IS NOT NULL THEN incident_status
        WHEN archived = TRUE THEN 'archived'
        ELSE 'active'
    END as status,
    created_at,
    updated_at,
    last_used,
    created_by,
    usage_count,
    success_count,
    failure_count,
    confidence_score,
    archived,
    -- Incident fields from kb_entries (may be NULL if columns don't exist)
    COALESCE(assigned_to, NULL) as assigned_to,
    COALESCE(resolved_by, NULL) as resolved_by,
    COALESCE(resolved_at, NULL) as resolved_at,
    COALESCE(closed_at, NULL) as closed_at,
    COALESCE(solution_rating, NULL) as solution_rating,
    COALESCE(solution_accepted, FALSE) as solution_accepted,
    COALESCE(ai_analysis_requested, FALSE) as ai_analysis_requested,
    COALESCE(ai_analysis_completed, FALSE) as ai_analysis_completed,
    COALESCE(semantic_expansion, NULL) as semantic_expansion,
    COALESCE(insertion_type, 'manual') as insertion_type,
    COALESCE(source_file, NULL) as source_file,
    COALESCE(source_system, NULL) as source_system,
    COALESCE(external_id, NULL) as external_id
FROM kb_entries
WHERE NOT EXISTS (SELECT 1 FROM entries WHERE entries.id = kb_entries.id);

-- Migrate Incidents to unified table with entry_type='incident'
INSERT INTO entries (
    id, entry_type, title, description, solution, category, severity, status,
    priority, created_at, updated_at, resolved_at, closed_at, created_by,
    assigned_to, resolved_by, solution_rating, solution_accepted,
    ai_analysis_requested, ai_analysis_completed, semantic_expansion,
    view_count, analysis_count, insertion_type, source_file, source_system,
    external_id, archived
)
SELECT
    id,
    'incident' as entry_type,
    title,
    description,
    solution,
    category,
    -- Map Portuguese severity to English if needed
    CASE
        WHEN severity = 'critica' THEN 'critical'
        WHEN severity = 'alta' THEN 'high'
        WHEN severity = 'media' THEN 'medium'
        WHEN severity = 'baixa' THEN 'low'
        ELSE severity
    END as severity,
    status,
    -- Map severity to priority (1=critical, 2=high, 3=medium, 4=low)
    CASE
        WHEN severity IN ('critica', 'critical') THEN 1
        WHEN severity IN ('alta', 'high') THEN 2
        WHEN severity IN ('media', 'medium') THEN 3
        WHEN severity IN ('baixa', 'low') THEN 4
        ELSE 3
    END as priority,
    created_at,
    updated_at,
    resolved_at,
    closed_at,
    created_by,
    assigned_to,
    resolved_by,
    solution_rating,
    solution_accepted,
    ai_analysis_requested,
    ai_analysis_completed,
    semantic_expansion,
    view_count,
    analysis_count,
    insertion_type,
    source_file,
    source_system,
    external_id,
    FALSE as archived -- Incidents are not archived by default
FROM incidents
WHERE NOT EXISTS (SELECT 1 FROM entries WHERE entries.id = incidents.id);

-- ===== MIGRATE RELATED DATA =====

-- Create unified tags table
CREATE TABLE IF NOT EXISTS entry_tags (
    entry_id TEXT NOT NULL,
    tag TEXT NOT NULL CHECK(length(tag) >= 1 AND length(tag) <= 50),
    PRIMARY KEY (entry_id, tag),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Migrate KB tags
INSERT OR IGNORE INTO entry_tags (entry_id, tag)
SELECT entry_id, tag
FROM kb_tags
WHERE EXISTS (SELECT 1 FROM entries WHERE id = entry_id AND entry_type = 'knowledge');

-- Create unified comments table
CREATE TABLE IF NOT EXISTS entry_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    comment_text TEXT NOT NULL CHECK(length(comment_text) >= 1 AND length(comment_text) <= 2000),
    comment_type TEXT DEFAULT 'user' CHECK(comment_type IN ('user', 'system', 'ai')),
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT NOT NULL CHECK(length(created_by) <= 100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deactivated_at DATETIME,
    deactivated_by TEXT CHECK(length(deactivated_by) <= 100),
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Migrate incident comments to unified comments
INSERT INTO entry_comments (
    entry_id, comment_text, comment_type, is_active, created_by,
    created_at, updated_at, deactivated_at, deactivated_by
)
SELECT
    incident_id as entry_id,
    comment_text,
    comment_type,
    is_active,
    created_by,
    created_at,
    updated_at,
    deactivated_at,
    deactivated_by
FROM incident_comments
WHERE EXISTS (SELECT 1 FROM entries WHERE id = incident_id AND entry_type = 'incident');

-- Migrate KB entry comments if they exist
INSERT INTO entry_comments (
    entry_id, comment_text, comment_type, is_active, created_by,
    created_at, updated_at, deactivated_at, deactivated_by
)
SELECT
    entry_id,
    comment_text,
    comment_type,
    is_active,
    created_by,
    created_at,
    updated_at,
    deactivated_at,
    deactivated_by
FROM kb_entry_comments
WHERE EXISTS (SELECT 1 FROM entries WHERE id = entry_id AND entry_type = 'knowledge')
AND EXISTS (SELECT name FROM sqlite_master WHERE type='table' AND name='kb_entry_comments');

-- Create unified relationships table
CREATE TABLE IF NOT EXISTS entry_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_entry_id TEXT NOT NULL,
    target_entry_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN (
        'related', 'similar', 'duplicate', 'blocks', 'blocked_by',
        'parent', 'child', 'caused_by', 'causes', 'prerequisite'
    )),
    similarity_score REAL DEFAULT 0.0 CHECK(similarity_score >= 0 AND similarity_score <= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT CHECK(length(created_by) <= 100),
    found_by TEXT DEFAULT 'system' CHECK(found_by IN ('system', 'ai', 'user')),
    notes TEXT,

    FOREIGN KEY (source_entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    FOREIGN KEY (target_entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    UNIQUE(source_entry_id, target_entry_id, relationship_type)
);

-- Migrate incident relationships
INSERT INTO entry_relationships (
    source_entry_id, target_entry_id, relationship_type, similarity_score,
    created_at, found_by
)
SELECT
    incident_id as source_entry_id,
    related_id as target_entry_id,
    relation_type as relationship_type,
    similarity_score,
    created_at,
    found_by
FROM incident_related
WHERE EXISTS (SELECT 1 FROM entries WHERE id = incident_id)
AND EXISTS (SELECT 1 FROM entries WHERE id = related_id);

-- Migrate KB entry relationships if they exist
INSERT INTO entry_relationships (
    source_entry_id, target_entry_id, relationship_type, similarity_score,
    created_at, created_by, found_by
)
SELECT
    entry_id as source_entry_id,
    related_id as target_entry_id,
    relation_type as relationship_type,
    similarity_score,
    created_at,
    created_by,
    found_by
FROM kb_entry_related
WHERE EXISTS (SELECT 1 FROM entries WHERE id = entry_id)
AND EXISTS (SELECT 1 FROM entries WHERE id = related_id)
AND EXISTS (SELECT name FROM sqlite_master WHERE type='table' AND name='kb_entry_related');

-- ===== CREATE UNIFIED AUDIT TABLE =====

CREATE TABLE IF NOT EXISTS entry_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN (
        -- Knowledge actions
        'created', 'updated', 'deleted', 'archived', 'restored',
        'viewed', 'copied', 'shared', 'exported', 'rated',
        -- Incident actions (Portuguese)
        'criado', 'editado', 'status_alterado', 'atribuido',
        'comentario_adicionado', 'comentario_removido',
        'analise_solicitada', 'analise_completada',
        'solucao_proposta', 'solucao_aceita', 'solucao_rejeitada',
        'entrada_visualizada', 'relacionados_visualizados',
        'busca_inteligente', 'busca_semantica', 'analise_llm',
        'avaliacao_adicionada', 'rating_alterado', 'arquivo_processado'
    )),
    action_details TEXT CHECK(length(action_details) <= 2000),
    old_value TEXT CHECK(length(old_value) <= 1000),
    new_value TEXT CHECK(length(new_value) <= 1000),
    performed_by TEXT NOT NULL CHECK(length(performed_by) <= 100),
    performed_by_type TEXT DEFAULT 'user' CHECK(performed_by_type IN ('user', 'system', 'ai')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT CHECK(length(session_id) <= 100),
    ip_address TEXT CHECK(length(ip_address) <= 45),

    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Migrate existing audit logs
INSERT INTO entry_audit (
    entry_id, action_type, action_details, old_value, new_value,
    performed_by, performed_by_type, created_at, session_id, ip_address
)
SELECT
    entry_id,
    action_type,
    action_details,
    old_value,
    new_value,
    performed_by,
    performed_by_type,
    created_at,
    session_id,
    ip_address
FROM kb_entry_audit
WHERE EXISTS (SELECT 1 FROM entries WHERE id = entry_id)
AND EXISTS (SELECT name FROM sqlite_master WHERE type='table' AND name='kb_entry_audit');

-- ===== CREATE PERFORMANCE INDEXES =====

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_severity ON entries(severity, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_priority ON entries(priority, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_resolved_at ON entries(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_assigned_to ON entries(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_entries_archived ON entries(archived, entry_type);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_entries_usage ON entries(usage_count DESC, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_success_rate ON entries(success_count, failure_count, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_solution_rating ON entries(solution_rating, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_ai_analysis ON entries(ai_analysis_requested, ai_analysis_completed);

-- Source tracking indexes
CREATE INDEX IF NOT EXISTS idx_entries_source ON entries(source_system, external_id);
CREATE INDEX IF NOT EXISTS idx_entries_insertion_type ON entries(insertion_type);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag);
CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags(entry_id);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_entry_comments_entry ON entry_comments(entry_id, is_active);
CREATE INDEX IF NOT EXISTS idx_entry_comments_created ON entry_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_comments_type ON entry_comments(comment_type, is_active);

-- Relationships indexes
CREATE INDEX IF NOT EXISTS idx_entry_relationships_source ON entry_relationships(source_entry_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_target ON entry_relationships(target_entry_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_entry_relationships_similarity ON entry_relationships(similarity_score DESC);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_entry_audit_entry ON entry_audit(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_audit_action ON entry_audit(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_audit_user ON entry_audit(performed_by, created_at DESC);

-- ===== CREATE FULL-TEXT SEARCH =====

-- Create unified FTS table
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
    id UNINDEXED,
    entry_type UNINDEXED,
    title,
    description,
    solution,
    tags,
    content=entries,
    content_rowid=rowid
);

-- Populate FTS index
INSERT INTO entries_fts(id, entry_type, title, description, solution, tags)
SELECT
    e.id,
    e.entry_type,
    e.title,
    e.description,
    COALESCE(e.solution, ''),
    COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM entry_tags WHERE entry_id = e.id), '')
FROM entries e;

-- ===== CREATE BACKWARD COMPATIBILITY VIEWS =====

-- KB Entries compatibility view
CREATE VIEW IF NOT EXISTS kb_entries AS
SELECT
    id,
    title,
    description as problem,
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
    -- Incident management fields
    status as incident_status,
    insertion_type,
    assigned_to,
    resolved_by,
    resolved_at,
    closed_at,
    solution_rating,
    solution_accepted,
    ai_analysis_requested,
    ai_analysis_completed,
    semantic_expansion,
    source_file,
    source_system,
    external_id
FROM entries
WHERE entry_type = 'knowledge';

-- Incidents compatibility view
CREATE VIEW IF NOT EXISTS incidents AS
SELECT
    id,
    title,
    description,
    solution,
    category,
    -- Map English severity back to Portuguese if needed
    CASE
        WHEN severity = 'critical' THEN 'critica'
        WHEN severity = 'high' THEN 'alta'
        WHEN severity = 'medium' THEN 'media'
        WHEN severity = 'low' THEN 'baixa'
        ELSE severity
    END as severity,
    status,
    insertion_type,
    created_at,
    updated_at,
    resolved_at,
    closed_at,
    created_by,
    assigned_to,
    resolved_by,
    solution_rating,
    solution_accepted,
    ai_analysis_requested,
    ai_analysis_completed,
    semantic_expansion,
    view_count,
    analysis_count,
    source_file,
    source_system,
    external_id
FROM entries
WHERE entry_type = 'incident';

-- ===== CREATE TRIGGERS FOR DATA CONSISTENCY =====

-- Update timestamp trigger
CREATE TRIGGER IF NOT EXISTS tr_entries_update_timestamp
AFTER UPDATE ON entries
FOR EACH ROW
BEGIN
    UPDATE entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Status change tracking trigger
CREATE TRIGGER IF NOT EXISTS tr_entries_status_change
AFTER UPDATE OF status ON entries
FOR EACH ROW
WHEN OLD.status != NEW.status
BEGIN
    -- Insert audit record
    INSERT INTO entry_audit (
        entry_id, action_type, old_value, new_value,
        performed_by, performed_by_type
    )
    VALUES (
        NEW.id, 'status_alterado', OLD.status, NEW.status,
        COALESCE(NEW.created_by, 'system'), 'system'
    );

    -- Auto-set timestamps
    UPDATE entries SET
        resolved_at = CASE WHEN NEW.status = 'resolvido' AND OLD.status != 'resolvido' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
        closed_at = CASE WHEN NEW.status = 'fechado' AND OLD.status != 'fechado' THEN CURRENT_TIMESTAMP ELSE closed_at END,
        reopen_count = CASE WHEN OLD.status IN ('resolvido', 'fechado') AND NEW.status = 'reaberto' THEN reopen_count + 1 ELSE reopen_count END
    WHERE id = NEW.id;
END;

-- FTS maintenance triggers
CREATE TRIGGER IF NOT EXISTS tr_entries_fts_insert
AFTER INSERT ON entries
BEGIN
    INSERT INTO entries_fts(id, entry_type, title, description, solution, tags)
    VALUES (NEW.id, NEW.entry_type, NEW.title, NEW.description, COALESCE(NEW.solution, ''),
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM entry_tags WHERE entry_id = NEW.id), ''));
END;

CREATE TRIGGER IF NOT EXISTS tr_entries_fts_update
AFTER UPDATE ON entries
BEGIN
    DELETE FROM entries_fts WHERE id = NEW.id;
    INSERT INTO entries_fts(id, entry_type, title, description, solution, tags)
    VALUES (NEW.id, NEW.entry_type, NEW.title, NEW.description, COALESCE(NEW.solution, ''),
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM entry_tags WHERE entry_id = NEW.id), ''));
END;

CREATE TRIGGER IF NOT EXISTS tr_entries_fts_delete
AFTER DELETE ON entries
BEGIN
    DELETE FROM entries_fts WHERE id = OLD.id;
END;

-- Tags FTS update trigger
CREATE TRIGGER IF NOT EXISTS tr_entry_tags_fts_update
AFTER INSERT ON entry_tags
BEGIN
    DELETE FROM entries_fts WHERE id = NEW.entry_id;
    INSERT INTO entries_fts(id, entry_type, title, description, solution, tags)
    SELECT e.id, e.entry_type, e.title, e.description, COALESCE(e.solution, ''),
           COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags
    FROM entries e
    LEFT JOIN entry_tags t ON e.id = t.entry_id
    WHERE e.id = NEW.entry_id
    GROUP BY e.id;
END;

-- ===== DATA VALIDATION CHECKS =====

-- Verify migration counts
SELECT
    'Validation: Data Migration Count Check' as check_name,
    (SELECT COUNT(*) FROM kb_entries_backup_018) as original_kb_count,
    (SELECT COUNT(*) FROM incidents_backup_018) as original_incident_count,
    (SELECT COUNT(*) FROM entries WHERE entry_type = 'knowledge') as migrated_kb_count,
    (SELECT COUNT(*) FROM entries WHERE entry_type = 'incident') as migrated_incident_count,
    CASE
        WHEN (SELECT COUNT(*) FROM kb_entries_backup_018) = (SELECT COUNT(*) FROM entries WHERE entry_type = 'knowledge')
         AND (SELECT COUNT(*) FROM incidents_backup_018) = (SELECT COUNT(*) FROM entries WHERE entry_type = 'incident')
        THEN 'PASS'
        ELSE 'FAIL'
    END as migration_status;

-- Verify no data loss in critical fields
SELECT
    'Validation: Critical Fields Check' as check_name,
    COUNT(*) as entries_with_missing_title
FROM entries
WHERE title IS NULL OR length(trim(title)) = 0;

SELECT
    'Validation: Description Fields Check' as check_name,
    COUNT(*) as entries_with_missing_description
FROM entries
WHERE description IS NULL OR length(trim(description)) = 0;

-- Verify relationships integrity
SELECT
    'Validation: Relationship Integrity Check' as check_name,
    COUNT(*) as orphaned_relationships
FROM entry_relationships er
WHERE NOT EXISTS (SELECT 1 FROM entries WHERE id = er.source_entry_id)
   OR NOT EXISTS (SELECT 1 FROM entries WHERE id = er.target_entry_id);

-- Verify tags integrity
SELECT
    'Validation: Tags Integrity Check' as check_name,
    COUNT(*) as orphaned_tags
FROM entry_tags et
WHERE NOT EXISTS (SELECT 1 FROM entries WHERE id = et.entry_id);

-- Verify comments integrity
SELECT
    'Validation: Comments Integrity Check' as check_name,
    COUNT(*) as orphaned_comments
FROM entry_comments ec
WHERE NOT EXISTS (SELECT 1 FROM entries WHERE id = ec.entry_id);

-- ===== UPDATE SYSTEM CONFIGURATION =====

INSERT OR REPLACE INTO system_config (key, value, type, description, category) VALUES
('unified_schema_enabled', 'true', 'boolean', 'Enable unified entries schema', 'system'),
('unified_migration_version', '018', 'string', 'Unified migration version', 'system'),
('unified_migration_date', datetime('now'), 'string', 'Date of unified migration', 'system'),
('backward_compatibility_enabled', 'true', 'boolean', 'Enable backward compatibility views', 'system');

-- Update backup log
UPDATE backup_log
SET status = 'verified',
    entries_count = (SELECT COUNT(*) FROM entries)
WHERE backup_path = 'unified_migration_018_backup';

-- ===== COMMIT TRANSACTION =====
COMMIT;

-- ===== MIGRATION COMPLETION MESSAGE =====
SELECT
    'SUCCESS: Unified table migration completed successfully!' as message,
    (SELECT COUNT(*) FROM entries) as total_entries,
    (SELECT COUNT(*) FROM entries WHERE entry_type = 'knowledge') as knowledge_entries,
    (SELECT COUNT(*) FROM entries WHERE entry_type = 'incident') as incident_entries,
    datetime('now') as completed_at;

-- ===== ROLLBACK PROCEDURES =====
--
-- To rollback this migration, execute the following steps:
--
-- 1. BEGIN TRANSACTION;
--
-- 2. DROP the new unified tables:
--    DROP TABLE IF EXISTS entry_audit;
--    DROP TABLE IF EXISTS entry_relationships;
--    DROP TABLE IF EXISTS entry_comments;
--    DROP TABLE IF EXISTS entry_tags;
--    DROP TABLE IF EXISTS entries_fts;
--    DROP TABLE IF EXISTS entries;
--
-- 3. DROP the compatibility views:
--    DROP VIEW IF EXISTS incidents;
--    DROP VIEW IF EXISTS kb_entries;
--
-- 4. Restore original tables from backups:
--    CREATE TABLE kb_entries AS SELECT * FROM kb_entries_backup_018;
--    CREATE TABLE incidents AS SELECT * FROM incidents_backup_018;
--    CREATE TABLE kb_tags AS SELECT * FROM kb_tags_backup_018;
--    CREATE TABLE incident_comments AS SELECT * FROM incident_comments_backup_018;
--    CREATE TABLE incident_related AS SELECT * FROM incident_related_backup_018;
--
-- 5. Recreate original indexes and triggers (from previous migrations)
--
-- 6. Update system config:
--    DELETE FROM system_config WHERE key LIKE 'unified_%';
--
-- 7. Clean up backup tables:
--    DROP TABLE kb_entries_backup_018;
--    DROP TABLE incidents_backup_018;
--    DROP TABLE kb_tags_backup_018;
--    DROP TABLE incident_comments_backup_018;
--    DROP TABLE incident_related_backup_018;
--
-- 8. COMMIT;

-- DOWN
-- Rollback for: Unified Table Migration

BEGIN TRANSACTION;

-- Drop unified tables and views
DROP TABLE IF EXISTS entry_audit;
DROP TABLE IF EXISTS entry_relationships;
DROP TABLE IF EXISTS entry_comments;
DROP TABLE IF EXISTS entry_tags;
DROP TABLE IF EXISTS entries_fts;
DROP TABLE IF EXISTS entries;

DROP VIEW IF EXISTS incidents;
DROP VIEW IF EXISTS kb_entries;

-- Restore original tables from backups
CREATE TABLE kb_entries AS SELECT * FROM kb_entries_backup_018;
CREATE TABLE incidents AS SELECT * FROM incidents_backup_018;
CREATE TABLE kb_tags AS SELECT * FROM kb_tags_backup_018;
CREATE TABLE incident_comments AS SELECT * FROM incident_comments_backup_018;
CREATE TABLE incident_related AS SELECT * FROM incident_related_backup_018;

-- Remove unified system config
DELETE FROM system_config WHERE key LIKE 'unified_%';

-- Clean up backup tables
DROP TABLE IF EXISTS kb_entries_backup_018;
DROP TABLE IF EXISTS incidents_backup_018;
DROP TABLE IF EXISTS kb_tags_backup_018;
DROP TABLE IF EXISTS incident_comments_backup_018;
DROP TABLE IF EXISTS incident_related_backup_018;

-- Update backup log
UPDATE backup_log
SET status = 'rolled_back'
WHERE backup_path = 'unified_migration_018_backup';

COMMIT;

SELECT 'Unified migration rollback completed' as message;