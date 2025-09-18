-- UP
-- Migration: KB Incident Management Fields
-- Version: 002_kb_incident_fields
-- Generated: 2025-01-18T18:00:00.000Z
-- Description: Add incident management fields to existing kb_entries table

-- Add incident management fields to kb_entries table
ALTER TABLE kb_entries ADD COLUMN incident_status TEXT DEFAULT 'em_revisao' CHECK(incident_status IN ('em_revisao', 'aberto', 'em_tratamento', 'resolvido', 'fechado'));
ALTER TABLE kb_entries ADD COLUMN insertion_type TEXT DEFAULT 'manual' CHECK(insertion_type IN ('manual', 'bulk', 'api', 'integracao'));
ALTER TABLE kb_entries ADD COLUMN assigned_to TEXT CHECK(length(assigned_to) <= 100);
ALTER TABLE kb_entries ADD COLUMN resolved_by TEXT CHECK(length(resolved_by) <= 100);
ALTER TABLE kb_entries ADD COLUMN resolved_at DATETIME;
ALTER TABLE kb_entries ADD COLUMN closed_at DATETIME;
ALTER TABLE kb_entries ADD COLUMN solution_rating INTEGER CHECK(solution_rating >= 1 AND solution_rating <= 5);
ALTER TABLE kb_entries ADD COLUMN solution_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE kb_entries ADD COLUMN ai_analysis_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE kb_entries ADD COLUMN ai_analysis_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE kb_entries ADD COLUMN semantic_expansion TEXT;
ALTER TABLE kb_entries ADD COLUMN source_file TEXT CHECK(length(source_file) <= 500);
ALTER TABLE kb_entries ADD COLUMN source_system TEXT CHECK(length(source_system) <= 100);
ALTER TABLE kb_entries ADD COLUMN external_id TEXT CHECK(length(external_id) <= 100);

-- Create supporting tables

-- KB Entry Comments table for incident discussion
CREATE TABLE IF NOT EXISTS kb_entry_comments (
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
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- KB Entry Related table (for similar/related incidents)
CREATE TABLE IF NOT EXISTS kb_entry_related (
    entry_id TEXT NOT NULL,
    related_id TEXT NOT NULL,
    similarity_score REAL DEFAULT 0.0 CHECK(similarity_score >= 0 AND similarity_score <= 1),
    relation_type TEXT DEFAULT 'similar' CHECK(relation_type IN ('similar', 'duplicate', 'caused_by', 'causes', 'prerequisite')),
    found_by TEXT DEFAULT 'system' CHECK(found_by IN ('system', 'ai', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT CHECK(length(created_by) <= 100),
    PRIMARY KEY (entry_id, related_id),
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (related_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- KB Entry Audit Log table for incident action tracking
CREATE TABLE IF NOT EXISTS kb_entry_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN (
        'criado', 'editado', 'status_alterado', 'atribuido',
        'comentario_adicionado', 'comentario_removido',
        'analise_solicitada', 'analise_completada',
        'solucao_proposta', 'solucao_aceita', 'solucao_rejeitada',
        'entrada_visualizada', 'relacionados_visualizados',
        'busca_inteligente', 'busca_semantica', 'analise_llm',
        'avaliacao_adicionada', 'rating_alterado', 'arquivo_processado'
    )),
    action_details TEXT CHECK(length(action_details) <= 2000), -- JSON with additional details
    old_value TEXT CHECK(length(old_value) <= 1000),
    new_value TEXT CHECK(length(new_value) <= 1000),
    performed_by TEXT NOT NULL CHECK(length(performed_by) <= 100),
    performed_by_type TEXT DEFAULT 'user' CHECK(performed_by_type IN ('user', 'system', 'ai')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT CHECK(length(session_id) <= 100),
    ip_address TEXT CHECK(length(ip_address) <= 45),
    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Create indexes for incident management performance
CREATE INDEX IF NOT EXISTS idx_kb_entries_incident_status ON kb_entries(incident_status, severity);
CREATE INDEX IF NOT EXISTS idx_kb_entries_insertion_type ON kb_entries(insertion_type);
CREATE INDEX IF NOT EXISTS idx_kb_entries_assigned_to ON kb_entries(assigned_to, incident_status);
CREATE INDEX IF NOT EXISTS idx_kb_entries_resolved_by ON kb_entries(resolved_by);
CREATE INDEX IF NOT EXISTS idx_kb_entries_resolved_at ON kb_entries(resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_closed_at ON kb_entries(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_solution_rating ON kb_entries(solution_rating);
CREATE INDEX IF NOT EXISTS idx_kb_entries_solution_accepted ON kb_entries(solution_accepted);
CREATE INDEX IF NOT EXISTS idx_kb_entries_ai_analysis ON kb_entries(ai_analysis_requested, ai_analysis_completed);
CREATE INDEX IF NOT EXISTS idx_kb_entries_source_system ON kb_entries(source_system, external_id);

-- Comment indexes
CREATE INDEX IF NOT EXISTS idx_kb_entry_comments_entry ON kb_entry_comments(entry_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kb_entry_comments_created ON kb_entry_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entry_comments_type ON kb_entry_comments(comment_type, is_active);

-- Related entries indexes
CREATE INDEX IF NOT EXISTS idx_kb_entry_related_entry ON kb_entry_related(entry_id, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entry_related_related ON kb_entry_related(related_id);
CREATE INDEX IF NOT EXISTS idx_kb_entry_related_type ON kb_entry_related(relation_type);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_kb_entry_audit_entry ON kb_entry_audit(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entry_audit_action ON kb_entry_audit(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entry_audit_user ON kb_entry_audit(performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entry_audit_session ON kb_entry_audit(session_id);

-- Add unique constraint for external system imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_entries_external_unique ON kb_entries(source_system, external_id) WHERE source_system IS NOT NULL AND external_id IS NOT NULL;

-- Create triggers for incident management

-- Update timestamp trigger for comments
CREATE TRIGGER IF NOT EXISTS tr_kb_entry_comments_update_timestamp
AFTER UPDATE ON kb_entry_comments
FOR EACH ROW
BEGIN
    UPDATE kb_entry_comments
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Incident status change trigger
CREATE TRIGGER IF NOT EXISTS tr_kb_entries_incident_status_change
AFTER UPDATE OF incident_status ON kb_entries
FOR EACH ROW
WHEN OLD.incident_status != NEW.incident_status
BEGIN
    INSERT INTO kb_entry_audit (
        entry_id, action_type, old_value, new_value,
        performed_by, performed_by_type
    )
    VALUES (
        NEW.id, 'status_alterado', OLD.incident_status, NEW.incident_status,
        COALESCE(NEW.created_by, 'system'), 'system'
    );

    -- Auto-set resolved_at when status changes to 'resolvido'
    UPDATE kb_entries
    SET resolved_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id AND NEW.incident_status = 'resolvido' AND resolved_at IS NULL;

    -- Auto-set closed_at when status changes to 'fechado'
    UPDATE kb_entries
    SET closed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id AND NEW.incident_status = 'fechado' AND closed_at IS NULL;
END;

-- Assignment change trigger
CREATE TRIGGER IF NOT EXISTS tr_kb_entries_assignment_change
AFTER UPDATE OF assigned_to ON kb_entries
FOR EACH ROW
WHEN OLD.assigned_to != NEW.assigned_to OR (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) OR (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL)
BEGIN
    INSERT INTO kb_entry_audit (
        entry_id, action_type, old_value, new_value,
        performed_by, performed_by_type
    )
    VALUES (
        NEW.id, 'atribuido',
        COALESCE(OLD.assigned_to, 'não atribuído'),
        COALESCE(NEW.assigned_to, 'não atribuído'),
        COALESCE(NEW.created_by, 'system'), 'system'
    );
END;

-- Solution acceptance trigger
CREATE TRIGGER IF NOT EXISTS tr_kb_entries_solution_accepted
AFTER UPDATE OF solution_accepted ON kb_entries
FOR EACH ROW
WHEN OLD.solution_accepted != NEW.solution_accepted
BEGIN
    INSERT INTO kb_entry_audit (
        entry_id, action_type, old_value, new_value,
        performed_by, performed_by_type
    )
    VALUES (
        NEW.id,
        CASE WHEN NEW.solution_accepted = TRUE THEN 'solucao_aceita' ELSE 'solucao_rejeitada' END,
        CASE WHEN OLD.solution_accepted = TRUE THEN 'aceita' ELSE 'rejeitada' END,
        CASE WHEN NEW.solution_accepted = TRUE THEN 'aceita' ELSE 'rejeitada' END,
        COALESCE(NEW.created_by, 'system'), 'system'
    );
END;

-- Comment audit trigger
CREATE TRIGGER IF NOT EXISTS tr_kb_entry_comments_audit
AFTER INSERT ON kb_entry_comments
FOR EACH ROW
BEGIN
    INSERT INTO kb_entry_audit (
        entry_id, action_type, new_value,
        performed_by, performed_by_type
    )
    VALUES (
        NEW.entry_id, 'comentario_adicionado',
        substr(NEW.comment_text, 1, 100) || CASE WHEN length(NEW.comment_text) > 100 THEN '...' ELSE '' END,
        NEW.created_by, NEW.comment_type
    );
END;

-- Comment deactivation trigger
CREATE TRIGGER IF NOT EXISTS tr_kb_entry_comments_deactivated
AFTER UPDATE OF is_active ON kb_entry_comments
FOR EACH ROW
WHEN OLD.is_active = TRUE AND NEW.is_active = FALSE
BEGIN
    INSERT INTO kb_entry_audit (
        entry_id, action_type, old_value, new_value,
        performed_by, performed_by_type
    )
    VALUES (
        NEW.entry_id, 'comentario_removido',
        substr(NEW.comment_text, 1, 100) || CASE WHEN length(NEW.comment_text) > 100 THEN '...' ELSE '' END,
        'desativado',
        COALESCE(NEW.deactivated_by, 'system'), 'system'
    );
END;

-- Create views for incident queue management

-- Incident Queue View (entries that are not closed or resolved)
CREATE VIEW IF NOT EXISTS v_kb_incident_queue AS
SELECT
    e.id,
    e.title,
    e.problem as description,
    e.solution,
    e.category,
    e.incident_status,
    e.severity,
    e.created_at,
    e.updated_at,
    e.assigned_to,
    e.usage_count as view_count,
    e.insertion_type,
    e.ai_analysis_requested,
    e.ai_analysis_completed,
    e.solution_accepted,
    e.solution_rating,
    CASE
        WHEN e.severity = 'critical' THEN 1
        WHEN e.severity = 'high' THEN 2
        WHEN e.severity = 'medium' THEN 3
        WHEN e.severity = 'low' THEN 4
    END as severity_order,
    COUNT(DISTINCT c.id) as comment_count,
    COUNT(DISTINCT r.related_id) as related_count
FROM kb_entries e
LEFT JOIN kb_entry_comments c ON e.id = c.entry_id AND c.is_active = TRUE
LEFT JOIN kb_entry_related r ON e.id = r.entry_id
WHERE e.incident_status NOT IN ('fechado', 'resolvido')
GROUP BY e.id
ORDER BY severity_order ASC, e.created_at DESC;

-- Incident Statistics View
CREATE VIEW IF NOT EXISTS v_kb_incident_stats AS
SELECT
    COUNT(*) as total_incidents,
    SUM(CASE WHEN incident_status = 'em_revisao' THEN 1 ELSE 0 END) as em_revisao,
    SUM(CASE WHEN incident_status = 'aberto' THEN 1 ELSE 0 END) as aberto,
    SUM(CASE WHEN incident_status = 'em_tratamento' THEN 1 ELSE 0 END) as em_tratamento,
    SUM(CASE WHEN incident_status = 'resolvido' THEN 1 ELSE 0 END) as resolvido,
    SUM(CASE WHEN incident_status = 'fechado' THEN 1 ELSE 0 END) as fechado,
    SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
    SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
    SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
    SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
    SUM(CASE WHEN ai_analysis_completed = TRUE THEN 1 ELSE 0 END) as ai_analyzed,
    SUM(CASE WHEN solution_accepted = TRUE THEN 1 ELSE 0 END) as solutions_accepted,
    AVG(CASE WHEN solution_rating IS NOT NULL THEN solution_rating ELSE NULL END) as avg_solution_rating,
    SUM(CASE WHEN insertion_type = 'manual' THEN 1 ELSE 0 END) as manual_entries,
    SUM(CASE WHEN insertion_type = 'bulk' THEN 1 ELSE 0 END) as bulk_entries,
    SUM(CASE WHEN insertion_type = 'api' THEN 1 ELSE 0 END) as api_entries,
    SUM(CASE WHEN insertion_type = 'integracao' THEN 1 ELSE 0 END) as integration_entries
FROM kb_entries;

-- AI Analysis Queue View
CREATE VIEW IF NOT EXISTS v_kb_ai_analysis_queue AS
SELECT
    e.id,
    e.title,
    e.problem as description,
    e.category,
    e.severity,
    e.incident_status,
    e.semantic_expansion,
    e.created_at,
    COUNT(r.related_id) as existing_related_count
FROM kb_entries e
LEFT JOIN kb_entry_related r ON e.id = r.entry_id
WHERE e.incident_status IN ('aberto', 'em_tratamento')
AND e.ai_analysis_requested = FALSE
GROUP BY e.id
ORDER BY
    CASE
        WHEN e.severity = 'critical' THEN 1
        WHEN e.severity = 'high' THEN 2
        WHEN e.severity = 'medium' THEN 3
        WHEN e.severity = 'low' THEN 4
    END ASC,
    e.created_at ASC;

-- My Assigned Incidents View
CREATE VIEW IF NOT EXISTS v_my_assigned_incidents AS
SELECT
    e.id,
    e.title,
    e.problem as description,
    e.category,
    e.severity,
    e.incident_status,
    e.assigned_to,
    e.created_at,
    e.updated_at,
    e.solution_accepted,
    e.solution_rating,
    COUNT(DISTINCT c.id) as comment_count,
    MAX(c.created_at) as last_comment_at
FROM kb_entries e
LEFT JOIN kb_entry_comments c ON e.id = c.entry_id AND c.is_active = TRUE
WHERE e.assigned_to IS NOT NULL
AND e.incident_status NOT IN ('fechado', 'resolvido')
GROUP BY e.id
ORDER BY
    CASE
        WHEN e.severity = 'critical' THEN 1
        WHEN e.severity = 'high' THEN 2
        WHEN e.severity = 'medium' THEN 3
        WHEN e.severity = 'low' THEN 4
    END ASC,
    e.updated_at DESC;

-- Recent Activity View
CREATE VIEW IF NOT EXISTS v_kb_recent_activity AS
SELECT
    a.entry_id,
    e.title,
    a.action_type,
    a.action_details,
    a.performed_by,
    a.performed_by_type,
    a.created_at,
    e.incident_status,
    e.severity
FROM kb_entry_audit a
JOIN kb_entries e ON a.entry_id = e.id
ORDER BY a.created_at DESC
LIMIT 100;

-- Update FTS index to include new fields
DROP TRIGGER IF EXISTS kb_entries_fts_insert;
DROP TRIGGER IF EXISTS kb_entries_fts_update;

CREATE TRIGGER IF NOT EXISTS kb_entries_fts_insert
    AFTER INSERT ON kb_entries
BEGIN
    INSERT INTO kb_fts(id, title, problem, solution, tags)
    VALUES (NEW.id, NEW.title, NEW.problem, NEW.solution,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''));
END;

CREATE TRIGGER IF NOT EXISTS kb_entries_fts_update
    AFTER UPDATE ON kb_entries
BEGIN
    DELETE FROM kb_fts WHERE id = NEW.id;
    INSERT INTO kb_fts(id, title, problem, solution, tags)
    VALUES (NEW.id, NEW.title, NEW.problem, NEW.solution,
            COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''));
END;

-- Update system config to reflect new incident capabilities
INSERT OR REPLACE INTO system_config (key, value, type, description, category) VALUES
('incident_management_enabled', 'true', 'boolean', 'Enable incident management features', 'incident'),
('incident_auto_assignment', 'false', 'boolean', 'Enable automatic incident assignment', 'incident'),
('incident_ai_analysis_auto', 'false', 'boolean', 'Enable automatic AI analysis for new incidents', 'incident'),
('incident_solution_rating_required', 'false', 'boolean', 'Require solution rating before closing', 'incident'),
('incident_comments_enabled', 'true', 'boolean', 'Enable comments on incidents', 'incident'),
('incident_related_auto_find', 'true', 'boolean', 'Automatically find related incidents', 'incident'),
('incident_semantic_expansion_enabled', 'false', 'boolean', 'Enable semantic expansion for incidents', 'incident'),
('incident_external_integration_enabled', 'false', 'boolean', 'Enable external system integration', 'incident');

-- Create initial backup entry for this migration
INSERT INTO backup_log (backup_path, backup_type, entries_count, status)
VALUES ('kb_incident_fields_migration', 'migration',
        (SELECT COUNT(*) FROM kb_entries), 'created');

-- DOWN
-- Rollback for: KB Incident Management Fields

-- Drop views
DROP VIEW IF EXISTS v_kb_recent_activity;
DROP VIEW IF EXISTS v_my_assigned_incidents;
DROP VIEW IF EXISTS v_kb_ai_analysis_queue;
DROP VIEW IF EXISTS v_kb_incident_stats;
DROP VIEW IF EXISTS v_kb_incident_queue;

-- Drop triggers
DROP TRIGGER IF EXISTS tr_kb_entry_comments_deactivated;
DROP TRIGGER IF EXISTS tr_kb_entry_comments_audit;
DROP TRIGGER IF EXISTS tr_kb_entries_solution_accepted;
DROP TRIGGER IF EXISTS tr_kb_entries_assignment_change;
DROP TRIGGER IF EXISTS tr_kb_entries_incident_status_change;
DROP TRIGGER IF EXISTS tr_kb_entry_comments_update_timestamp;

-- Drop indexes
DROP INDEX IF EXISTS idx_kb_entries_external_unique;
DROP INDEX IF EXISTS idx_kb_entry_audit_session;
DROP INDEX IF EXISTS idx_kb_entry_audit_user;
DROP INDEX IF EXISTS idx_kb_entry_audit_action;
DROP INDEX IF EXISTS idx_kb_entry_audit_entry;
DROP INDEX IF EXISTS idx_kb_entry_related_type;
DROP INDEX IF EXISTS idx_kb_entry_related_related;
DROP INDEX IF EXISTS idx_kb_entry_related_entry;
DROP INDEX IF EXISTS idx_kb_entry_comments_type;
DROP INDEX IF EXISTS idx_kb_entry_comments_created;
DROP INDEX IF EXISTS idx_kb_entry_comments_entry;
DROP INDEX IF EXISTS idx_kb_entries_source_system;
DROP INDEX IF EXISTS idx_kb_entries_ai_analysis;
DROP INDEX IF EXISTS idx_kb_entries_solution_accepted;
DROP INDEX IF EXISTS idx_kb_entries_solution_rating;
DROP INDEX IF EXISTS idx_kb_entries_closed_at;
DROP INDEX IF EXISTS idx_kb_entries_resolved_at;
DROP INDEX IF EXISTS idx_kb_entries_resolved_by;
DROP INDEX IF EXISTS idx_kb_entries_assigned_to;
DROP INDEX IF EXISTS idx_kb_entries_insertion_type;
DROP INDEX IF EXISTS idx_kb_entries_incident_status;

-- Drop supporting tables
DROP TABLE IF EXISTS kb_entry_audit;
DROP TABLE IF EXISTS kb_entry_related;
DROP TABLE IF EXISTS kb_entry_comments;

-- Remove columns from kb_entries table (SQLite doesn't support DROP COLUMN directly)
-- Create backup table
CREATE TABLE kb_entries_backup AS SELECT
    id, title, problem, solution, category, severity, created_at, updated_at,
    created_by, usage_count, success_count, failure_count, last_used,
    archived, confidence_score
FROM kb_entries;

-- Drop original table
DROP TABLE kb_entries;

-- Recreate original table without incident fields
CREATE TABLE kb_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 255),
    problem TEXT NOT NULL CHECK(length(problem) >= 10 AND length(problem) <= 5000),
    solution TEXT NOT NULL CHECK(length(solution) >= 10 AND length(solution) <= 10000),
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by TEXT DEFAULT 'system' CHECK(length(created_by) <= 100),
    usage_count INTEGER DEFAULT 0 CHECK(usage_count >= 0),
    success_count INTEGER DEFAULT 0 CHECK(success_count >= 0),
    failure_count INTEGER DEFAULT 0 CHECK(failure_count >= 0),
    last_used DATETIME,
    archived BOOLEAN DEFAULT FALSE,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 100)
);

-- Restore data
INSERT INTO kb_entries SELECT * FROM kb_entries_backup;

-- Drop backup table
DROP TABLE kb_entries_backup;

-- Recreate original indexes
CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries(category);
CREATE INDEX IF NOT EXISTS idx_kb_entries_severity ON kb_entries(severity);
CREATE INDEX IF NOT EXISTS idx_kb_entries_usage ON kb_entries(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_success_rate ON kb_entries(success_count, failure_count);
CREATE INDEX IF NOT EXISTS idx_kb_entries_created_at ON kb_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_updated_at ON kb_entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_entries_archived ON kb_entries(archived);
CREATE INDEX IF NOT EXISTS idx_kb_entries_last_used ON kb_entries(last_used DESC);

-- Recreate original triggers
CREATE TRIGGER IF NOT EXISTS update_kb_entries_timestamp
    AFTER UPDATE ON kb_entries
BEGIN
    UPDATE kb_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Remove incident-related system config
DELETE FROM system_config WHERE category = 'incident';

-- Remove migration backup entry
DELETE FROM backup_log WHERE backup_path = 'kb_incident_fields_migration';