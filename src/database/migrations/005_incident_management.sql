-- Migration: Incident Management System
-- Version: 002
-- Date: 2025-01-18
-- Description: Add incident management tables with Portuguese states

-- Schema version update
INSERT INTO schema_versions (version, description, rollback_sql)
VALUES (
    2,
    'Incident management system with Portuguese states',
    '-- Rollback SQL
    DROP TABLE IF EXISTS incident_logs;
    DROP TABLE IF EXISTS incident_comments;
    DROP TABLE IF EXISTS incident_related;
    DROP TABLE IF EXISTS incidents;
    DROP VIEW IF EXISTS v_incident_stats;
    DROP VIEW IF EXISTS v_incident_queue;
    DROP VIEW IF EXISTS v_incident_analysis_queue;
    DELETE FROM schema_versions WHERE version = 2;'
);

-- Main incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'Security', 'Network', 'Other')),

    -- Estados em português conforme requisitos
    status TEXT NOT NULL DEFAULT 'em_revisao' CHECK(status IN ('em_revisao', 'aberto', 'em_tratamento', 'resolvido', 'fechado')),

    -- Criticidade em português
    severity TEXT NOT NULL DEFAULT 'media' CHECK(severity IN ('critica', 'alta', 'media', 'baixa')),

    -- Tipo de inserção
    insertion_type TEXT NOT NULL DEFAULT 'manual' CHECK(insertion_type IN ('manual', 'bulk', 'api', 'integracao')),

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    closed_at DATETIME,

    -- User tracking
    created_by TEXT DEFAULT 'system',
    assigned_to TEXT,
    resolved_by TEXT,

    -- Solution tracking
    solution TEXT,
    solution_rating INTEGER CHECK(solution_rating >= 1 AND solution_rating <= 5),
    solution_accepted BOOLEAN DEFAULT FALSE,

    -- Analysis flags
    ai_analysis_requested BOOLEAN DEFAULT FALSE,
    ai_analysis_completed BOOLEAN DEFAULT FALSE,
    semantic_expansion TEXT, -- JSON with LLM semantic expansion

    -- Metrics
    view_count INTEGER DEFAULT 0,
    analysis_count INTEGER DEFAULT 0,

    -- Source information for bulk/API imports
    source_file TEXT,
    source_system TEXT,
    external_id TEXT,

    UNIQUE(source_system, external_id) -- Prevent duplicate imports
);

-- Related incidents table (for similar/related incidents)
CREATE TABLE IF NOT EXISTS incident_related (
    incident_id TEXT NOT NULL,
    related_id TEXT NOT NULL,
    similarity_score REAL DEFAULT 0.0 CHECK(similarity_score >= 0 AND similarity_score <= 1),
    relation_type TEXT DEFAULT 'similar' CHECK(relation_type IN ('similar', 'duplicate', 'caused_by', 'causes')),
    found_by TEXT DEFAULT 'system' CHECK(found_by IN ('system', 'ai', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (incident_id, related_id),
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (related_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Comments table for incident discussion
CREATE TABLE IF NOT EXISTS incident_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    comment_type TEXT DEFAULT 'user' CHECK(comment_type IN ('user', 'system', 'ai')),
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deactivated_at DATETIME,
    deactivated_by TEXT,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Incident action logs for audit trail
CREATE TABLE IF NOT EXISTS incident_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN (
        'criado', 'editado', 'status_alterado', 'atribuido',
        'comentario_adicionado', 'comentario_removido',
        'analise_solicitada', 'analise_completada',
        'solucao_proposta', 'solucao_aceita', 'solucao_rejeitada',
        'incidente_visualizado', 'relacionados_visualizados',
        'busca_inteligente', 'busca_semantica', 'analise_llm'
    )),
    action_details TEXT, -- JSON with additional details
    old_value TEXT,
    new_value TEXT,
    performed_by TEXT NOT NULL,
    performed_by_type TEXT DEFAULT 'user' CHECK(performed_by_type IN ('user', 'system', 'ai')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity, status);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_incidents_source ON incidents(source_system, external_id);

CREATE INDEX IF NOT EXISTS idx_incident_related_incident ON incident_related(incident_id, similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_incident_related_related ON incident_related(related_id);

CREATE INDEX IF NOT EXISTS idx_incident_comments_incident ON incident_comments(incident_id, is_active);
CREATE INDEX IF NOT EXISTS idx_incident_comments_created ON incident_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_logs_incident ON incident_logs(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_logs_action ON incident_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_logs_user ON incident_logs(performed_by, created_at DESC);

-- Full-text search for incidents
CREATE VIRTUAL TABLE IF NOT EXISTS incidents_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    solution,
    category UNINDEXED,
    tokenize = 'porter unicode61',
    content = 'incidents',
    content_rowid = 'rowid'
);

-- FTS triggers for automatic index maintenance
CREATE TRIGGER IF NOT EXISTS incidents_fts_insert AFTER INSERT ON incidents BEGIN
    INSERT INTO incidents_fts(rowid, id, title, description, solution, category)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.solution, NEW.category);
END;

CREATE TRIGGER IF NOT EXISTS incidents_fts_delete AFTER DELETE ON incidents BEGIN
    DELETE FROM incidents_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER IF NOT EXISTS incidents_fts_update AFTER UPDATE ON incidents BEGIN
    DELETE FROM incidents_fts WHERE rowid = OLD.rowid;
    INSERT INTO incidents_fts(rowid, id, title, description, solution, category)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.solution, NEW.category);
END;

-- Update timestamp trigger
CREATE TRIGGER IF NOT EXISTS tr_incidents_update_timestamp
AFTER UPDATE ON incidents
FOR EACH ROW
BEGIN
    UPDATE incidents
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Log status changes
CREATE TRIGGER IF NOT EXISTS tr_incidents_log_status_change
AFTER UPDATE OF status ON incidents
FOR EACH ROW
WHEN OLD.status != NEW.status
BEGIN
    INSERT INTO incident_logs (
        incident_id, action_type, old_value, new_value,
        performed_by, performed_by_type
    )
    VALUES (
        NEW.id, 'status_alterado', OLD.status, NEW.status,
        COALESCE(NEW.updated_by, 'system'), 'system'
    );
END;

-- Views for common queries

-- Incident queue view (não fechados ou resolvidos)
CREATE VIEW IF NOT EXISTS v_incident_queue AS
SELECT
    i.id,
    i.title,
    i.description,
    i.category,
    i.status,
    i.severity,
    i.created_at,
    i.updated_at,
    i.assigned_to,
    i.view_count,
    CASE
        WHEN i.severity = 'critica' THEN 1
        WHEN i.severity = 'alta' THEN 2
        WHEN i.severity = 'media' THEN 3
        WHEN i.severity = 'baixa' THEN 4
    END as severity_order,
    COUNT(DISTINCT c.id) as comment_count,
    COUNT(DISTINCT r.related_id) as related_count
FROM incidents i
LEFT JOIN incident_comments c ON i.id = c.incident_id AND c.is_active = TRUE
LEFT JOIN incident_related r ON i.id = r.incident_id
WHERE i.status NOT IN ('fechado', 'resolvido')
GROUP BY i.id
ORDER BY severity_order ASC, i.created_at DESC;

-- Incident statistics view
CREATE VIEW IF NOT EXISTS v_incident_stats AS
SELECT
    COUNT(*) as total_incidents,
    SUM(CASE WHEN status = 'em_revisao' THEN 1 ELSE 0 END) as em_revisao,
    SUM(CASE WHEN status = 'aberto' THEN 1 ELSE 0 END) as aberto,
    SUM(CASE WHEN status = 'em_tratamento' THEN 1 ELSE 0 END) as em_tratamento,
    SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END) as resolvido,
    SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END) as fechado,
    SUM(CASE WHEN severity = 'critica' THEN 1 ELSE 0 END) as critica,
    SUM(CASE WHEN severity = 'alta' THEN 1 ELSE 0 END) as alta,
    SUM(CASE WHEN severity = 'media' THEN 1 ELSE 0 END) as media,
    SUM(CASE WHEN severity = 'baixa' THEN 1 ELSE 0 END) as baixa,
    SUM(CASE WHEN ai_analysis_completed = TRUE THEN 1 ELSE 0 END) as ai_analyzed,
    SUM(CASE WHEN solution_accepted = TRUE THEN 1 ELSE 0 END) as solutions_accepted,
    AVG(CASE WHEN solution_rating IS NOT NULL THEN solution_rating ELSE NULL END) as avg_solution_rating
FROM incidents;

-- Incidents ready for AI analysis
CREATE VIEW IF NOT EXISTS v_incident_analysis_queue AS
SELECT
    i.id,
    i.title,
    i.description,
    i.category,
    i.severity,
    i.semantic_expansion,
    COUNT(r.related_id) as existing_related_count
FROM incidents i
LEFT JOIN incident_related r ON i.id = r.incident_id
WHERE i.status = 'aberto'
AND i.ai_analysis_requested = FALSE
GROUP BY i.id
ORDER BY
    CASE
        WHEN i.severity = 'critica' THEN 1
        WHEN i.severity = 'alta' THEN 2
        WHEN i.severity = 'media' THEN 3
        WHEN i.severity = 'baixa' THEN 4
    END ASC,
    i.created_at ASC;