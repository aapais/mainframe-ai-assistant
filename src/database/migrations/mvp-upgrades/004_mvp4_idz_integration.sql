-- UP
-- Migration: MVP4 IDZ Integration and Template Engine
-- Version: 004
-- Generated: 2025-01-11
-- Description: Add IDZ project management, templates, and multi-file workspace capabilities

-- ===== IDZ PROJECT MANAGEMENT TABLES =====

-- IDZ Projects
CREATE TABLE IF NOT EXISTS idz_projects (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    idz_workspace_path TEXT,
    local_workspace_path TEXT NOT NULL,
    project_type TEXT CHECK(project_type IN ('cobol', 'pli', 'assembler', 'mixed')) DEFAULT 'cobol',
    description TEXT,
    status TEXT CHECK(status IN ('active', 'imported', 'exported', 'archived', 'error')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    imported_at DATETIME,
    last_exported DATETIME,
    last_synchronized DATETIME,
    created_by TEXT DEFAULT 'system',
    metadata TEXT, -- JSON for IDZ project metadata
    import_config TEXT, -- JSON for import configuration
    export_config TEXT -- JSON for export configuration
);

-- Project files tracking
CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_id TEXT, -- Links to code_files table
    relative_path TEXT NOT NULL,
    file_type TEXT CHECK(file_type IN ('source', 'copybook', 'jcl', 'proc', 'include', 'other')) NOT NULL,
    status TEXT CHECK(status IN ('unchanged', 'modified', 'added', 'deleted', 'conflict')) DEFAULT 'unchanged',
    idz_last_modified DATETIME,
    local_last_modified DATETIME,
    sync_status TEXT CHECK(sync_status IN ('in_sync', 'out_of_sync', 'conflict', 'unknown')) DEFAULT 'unknown',
    checksum_idz TEXT,
    checksum_local TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES idz_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE SET NULL
);

-- Project dependencies (copybooks, includes, etc.)
CREATE TABLE IF NOT EXISTS project_dependencies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dependency_name TEXT NOT NULL,
    dependency_type TEXT CHECK(dependency_type IN ('copybook', 'include', 'subroutine', 'external_program')) NOT NULL,
    source_file_id TEXT,
    target_file_id TEXT,
    dependency_path TEXT,
    resolution_status TEXT CHECK(resolution_status IN ('resolved', 'unresolved', 'missing', 'circular')) DEFAULT 'unresolved',
    is_external BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES idz_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (source_file_id) REFERENCES project_files(id) ON DELETE SET NULL,
    FOREIGN KEY (target_file_id) REFERENCES project_files(id) ON DELETE SET NULL
);

-- ===== TEMPLATE ENGINE TABLES =====

-- Code templates
CREATE TABLE IF NOT EXISTS code_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN ('error_handling', 'data_validation', 'file_operations', 'calculations', 'reports', 'common_patterns', 'other')) NOT NULL,
    language TEXT DEFAULT 'cobol',
    template_content TEXT NOT NULL,
    parameters TEXT, -- JSON array of parameter definitions
    validation_rules TEXT, -- JSON array of validation rules
    example_usage TEXT,
    success_rate REAL DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    source_pattern_id TEXT, -- Links to detected_patterns if generated from pattern
    source_kb_entry_id TEXT, -- Links to kb_entries if based on KB
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    tags TEXT, -- JSON array of tags
    is_public BOOLEAN DEFAULT TRUE,
    is_validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    FOREIGN KEY (source_kb_entry_id) REFERENCES kb_entries(id) ON DELETE SET NULL
);

-- Template parameters definition
CREATE TABLE IF NOT EXISTS template_parameters (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    parameter_name TEXT NOT NULL,
    parameter_type TEXT CHECK(parameter_type IN ('string', 'integer', 'boolean', 'choice', 'file_path', 'variable_name')) NOT NULL,
    description TEXT,
    default_value TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    choices TEXT, -- JSON array for choice type parameters
    validation_regex TEXT,
    help_text TEXT,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES code_templates(id) ON DELETE CASCADE,
    UNIQUE(template_id, parameter_name)
);

-- Template usage tracking
CREATE TABLE IF NOT EXISTS template_usage (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    project_id TEXT,
    file_id TEXT,
    parameters_used TEXT, -- JSON object with parameter values
    generated_code TEXT,
    success BOOLEAN,
    error_message TEXT,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_by TEXT DEFAULT 'system',
    feedback_rating INTEGER CHECK(feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_text TEXT,
    FOREIGN KEY (template_id) REFERENCES code_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES idz_projects(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE SET NULL
);

-- ===== WORKSPACE MANAGEMENT TABLES =====

-- Multi-file workspace sessions
CREATE TABLE IF NOT EXISTS workspace_sessions (
    id TEXT PRIMARY KEY,
    session_name TEXT NOT NULL,
    project_id TEXT,
    status TEXT CHECK(status IN ('active', 'saved', 'closed', 'error')) DEFAULT 'active',
    open_files TEXT, -- JSON array of open file IDs
    active_file_id TEXT,
    layout_config TEXT, -- JSON for UI layout configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    auto_save BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (project_id) REFERENCES idz_projects(id) ON DELETE SET NULL,
    FOREIGN KEY (active_file_id) REFERENCES code_files(id) ON DELETE SET NULL
);

-- Change tracking for workspace
CREATE TABLE IF NOT EXISTS workspace_changes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    change_type TEXT CHECK(change_type IN ('create', 'modify', 'delete', 'rename', 'move')) NOT NULL,
    old_content_hash TEXT,
    new_content_hash TEXT,
    change_description TEXT,
    line_changes TEXT, -- JSON array of line-level changes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    is_committed BOOLEAN DEFAULT FALSE,
    commit_id TEXT,
    FOREIGN KEY (session_id) REFERENCES workspace_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- ===== EXPORT/IMPORT MANAGEMENT TABLES =====

-- Export jobs
CREATE TABLE IF NOT EXISTS export_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    job_type TEXT CHECK(job_type IN ('full_export', 'incremental', 'selective', 'validation_only')) NOT NULL,
    status TEXT CHECK(status IN ('pending', 'running', 'validating', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    export_path TEXT,
    files_exported INTEGER DEFAULT 0,
    files_failed INTEGER DEFAULT 0,
    validation_results TEXT, -- JSON with validation results
    error_log TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    started_by TEXT DEFAULT 'system',
    configuration TEXT, -- JSON export configuration
    package_info TEXT -- JSON with package metadata
    FOREIGN KEY (project_id) REFERENCES idz_projects(id) ON DELETE CASCADE
);

-- Validation results
CREATE TABLE IF NOT EXISTS validation_results (
    id TEXT PRIMARY KEY,
    export_job_id TEXT,
    file_id TEXT,
    validation_type TEXT CHECK(validation_type IN ('syntax', 'standards', 'kb_check', 'dependencies', 'security')) NOT NULL,
    status TEXT CHECK(status IN ('passed', 'failed', 'warning', 'skipped')) NOT NULL,
    message TEXT,
    line_number INTEGER,
    column_number INTEGER,
    rule_id TEXT,
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')) DEFAULT 'medium',
    can_auto_fix BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (export_job_id) REFERENCES export_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- ===== INDEXES FOR IDZ INTEGRATION PERFORMANCE =====

-- IDZ Projects indexes
CREATE INDEX IF NOT EXISTS idx_idz_projects_status ON idz_projects(status, last_synchronized DESC);
CREATE INDEX IF NOT EXISTS idx_idz_projects_type ON idz_projects(project_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idz_projects_workspace ON idz_projects(local_workspace_path);

-- Project files indexes
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id, file_type);
CREATE INDEX IF NOT EXISTS idx_project_files_status ON project_files(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_files_sync ON project_files(sync_status, local_last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_path ON project_files(project_id, relative_path);

-- Project dependencies indexes
CREATE INDEX IF NOT EXISTS idx_project_deps_project ON project_dependencies(project_id, dependency_type);
CREATE INDEX IF NOT EXISTS idx_project_deps_status ON project_dependencies(resolution_status, is_external);
CREATE INDEX IF NOT EXISTS idx_project_deps_name ON project_dependencies(dependency_name, dependency_type);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_category ON code_templates(category, is_public);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON code_templates(usage_count DESC, success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_templates_validated ON code_templates(is_validated, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_language ON code_templates(language, category);

-- Template parameters indexes
CREATE INDEX IF NOT EXISTS idx_template_params_template ON template_parameters(template_id, display_order);
CREATE INDEX IF NOT EXISTS idx_template_params_required ON template_parameters(template_id, is_required);

-- Template usage indexes
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage(template_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_project ON template_usage(project_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_success ON template_usage(success, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_rating ON template_usage(feedback_rating DESC) WHERE feedback_rating IS NOT NULL;

-- Workspace indexes
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_status ON workspace_sessions(status, last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_sessions_project ON workspace_sessions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_changes_session ON workspace_changes(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_changes_file ON workspace_changes(file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_changes_committed ON workspace_changes(is_committed, created_at DESC);

-- Export/Import indexes
CREATE INDEX IF NOT EXISTS idx_export_jobs_project ON export_jobs(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_results_job ON validation_results(export_job_id, status);
CREATE INDEX IF NOT EXISTS idx_validation_results_file ON validation_results(file_id, validation_type);
CREATE INDEX IF NOT EXISTS idx_validation_results_severity ON validation_results(severity, status);

-- ===== IDZ INTEGRATION VIEWS =====

-- View for project status summary
CREATE VIEW IF NOT EXISTS v_project_status AS
SELECT 
    p.id,
    p.project_name,
    p.status,
    p.last_synchronized,
    COUNT(pf.id) as total_files,
    COUNT(CASE WHEN pf.status = 'modified' THEN 1 END) as modified_files,
    COUNT(CASE WHEN pf.sync_status = 'out_of_sync' THEN 1 END) as out_of_sync_files,
    COUNT(CASE WHEN pd.resolution_status = 'unresolved' THEN 1 END) as unresolved_dependencies,
    MAX(pf.local_last_modified) as latest_change
FROM idz_projects p
LEFT JOIN project_files pf ON p.id = pf.project_id
LEFT JOIN project_dependencies pd ON p.id = pd.project_id
WHERE p.status != 'archived'
GROUP BY p.id, p.project_name, p.status, p.last_synchronized;

-- View for template effectiveness
CREATE VIEW IF NOT EXISTS v_template_effectiveness AS
SELECT 
    t.id,
    t.name,
    t.category,
    t.usage_count,
    t.success_rate,
    COUNT(tu.id) as recent_usage,
    AVG(tu.feedback_rating) as avg_rating,
    COUNT(CASE WHEN tu.success = TRUE THEN 1 END) as recent_successes,
    MAX(tu.used_at) as last_used
FROM code_templates t
LEFT JOIN template_usage tu ON t.id = tu.template_id AND tu.used_at > DATE('now', '-30 days')
WHERE t.is_public = TRUE
GROUP BY t.id, t.name, t.category, t.usage_count, t.success_rate
ORDER BY t.usage_count DESC, t.success_rate DESC;

-- View for workspace activity
CREATE VIEW IF NOT EXISTS v_workspace_activity AS
SELECT 
    ws.id as session_id,
    ws.session_name,
    ws.status,
    ws.last_accessed,
    p.project_name,
    COUNT(wc.id) as total_changes,
    COUNT(CASE WHEN wc.is_committed = FALSE THEN 1 END) as uncommitted_changes,
    COUNT(DISTINCT wc.file_id) as modified_files,
    MAX(wc.created_at) as latest_change
FROM workspace_sessions ws
LEFT JOIN idz_projects p ON ws.project_id = p.id
LEFT JOIN workspace_changes wc ON ws.id = wc.session_id
WHERE ws.status = 'active'
GROUP BY ws.id, ws.session_name, ws.status, ws.last_accessed, p.project_name;

-- View for export validation summary
CREATE VIEW IF NOT EXISTS v_export_validation_summary AS
SELECT 
    ej.id as export_job_id,
    ej.project_id,
    p.project_name,
    ej.status as export_status,
    ej.started_at,
    COUNT(vr.id) as total_validations,
    COUNT(CASE WHEN vr.status = 'failed' THEN 1 END) as failed_validations,
    COUNT(CASE WHEN vr.status = 'warning' THEN 1 END) as warnings,
    COUNT(CASE WHEN vr.severity = 'critical' THEN 1 END) as critical_issues,
    COUNT(CASE WHEN vr.can_auto_fix = TRUE THEN 1 END) as auto_fixable
FROM export_jobs ej
JOIN idz_projects p ON ej.project_id = p.id
LEFT JOIN validation_results vr ON ej.id = vr.export_job_id
WHERE ej.started_at > DATE('now', '-7 days')
GROUP BY ej.id, ej.project_id, p.project_name, ej.status, ej.started_at
ORDER BY ej.started_at DESC;

-- ===== TRIGGERS FOR IDZ INTEGRATION =====

-- Update project sync status when files change
CREATE TRIGGER IF NOT EXISTS tr_update_project_sync_status
AFTER UPDATE OF local_last_modified ON project_files
FOR EACH ROW
WHEN NEW.local_last_modified != OLD.local_last_modified
BEGIN
    UPDATE project_files
    SET sync_status = CASE 
        WHEN NEW.checksum_local != OLD.checksum_local AND NEW.checksum_idz != NEW.checksum_local THEN 'out_of_sync'
        WHEN NEW.checksum_local = NEW.checksum_idz THEN 'in_sync'
        ELSE 'unknown'
    END,
    status = CASE
        WHEN NEW.checksum_local != OLD.checksum_local THEN 'modified'
        ELSE NEW.status
    END
    WHERE id = NEW.id;
END;

-- Update template success rate when usage is recorded
CREATE TRIGGER IF NOT EXISTS tr_update_template_success_rate
AFTER INSERT ON template_usage
FOR EACH ROW
BEGIN
    UPDATE code_templates
    SET 
        usage_count = usage_count + 1,
        success_rate = (
            SELECT CAST(COUNT(CASE WHEN success = TRUE THEN 1 END) AS REAL) / COUNT(*) * 100
            FROM template_usage
            WHERE template_id = NEW.template_id
        ),
        last_updated = CURRENT_TIMESTAMP
    WHERE id = NEW.template_id;
END;

-- Track workspace changes
CREATE TRIGGER IF NOT EXISTS tr_track_workspace_changes
AFTER UPDATE ON workspace_sessions
FOR EACH ROW
WHEN NEW.last_accessed != OLD.last_accessed
BEGIN
    UPDATE workspace_sessions
    SET last_accessed = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Auto-resolve dependencies when target files are added
CREATE TRIGGER IF NOT EXISTS tr_auto_resolve_dependencies
AFTER INSERT ON project_files
FOR EACH ROW
WHEN NEW.file_type IN ('source', 'copybook', 'include')
BEGIN
    UPDATE project_dependencies
    SET 
        target_file_id = NEW.id,
        resolution_status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP
    WHERE dependency_name LIKE '%' || NEW.relative_path || '%'
    AND project_id = NEW.project_id
    AND resolution_status = 'unresolved';
END;

-- ===== IDZ INTEGRATION CONFIGURATION =====

-- Add IDZ integration configuration
INSERT OR IGNORE INTO system_config (key, value, type, description) VALUES
('idz_integration_enabled', 'true', 'boolean', 'Enable IDZ integration features'),
('default_workspace_path', './workspace', 'string', 'Default local workspace path'),
('auto_sync_enabled', 'false', 'boolean', 'Enable automatic synchronization with IDZ'),
('sync_interval_minutes', '30', 'integer', 'Synchronization interval in minutes'),
('export_validation_enabled', 'true', 'boolean', 'Enable validation before export'),
('template_generation_enabled', 'true', 'boolean', 'Enable automatic template generation from patterns'),
('max_workspace_sessions', '10', 'integer', 'Maximum number of concurrent workspace sessions'),
('auto_save_interval_seconds', '60', 'integer', 'Auto-save interval for workspace changes'),
('dependency_scan_depth', '5', 'integer', 'Maximum depth for dependency scanning'),
('export_package_compression', 'true', 'boolean', 'Enable compression for export packages'),
('template_validation_required', 'true', 'boolean', 'Require validation before template publication'),
('workspace_change_retention_days', '30', 'integer', 'Days to retain workspace change history');

-- Create some initial templates from common patterns
INSERT OR IGNORE INTO code_templates (id, name, description, category, template_content, parameters) VALUES
('tpl_error_handling_01', 'Basic Error Handling', 'Standard error handling pattern for COBOL programs', 'error_handling', 
'       IF {{condition}} NOT = ZERO\n           DISPLAY "{{error_message}}"\n           MOVE {{error_code}} TO RETURN-CODE\n           PERFORM 9999-ERROR-EXIT\n       END-IF',
'[{"name": "condition", "type": "string", "description": "Condition to check", "required": true}, {"name": "error_message", "type": "string", "description": "Error message to display", "required": true}, {"name": "error_code", "type": "integer", "description": "Error code to set", "default_value": "8", "required": false}]'),

('tpl_file_check_01', 'File Status Check', 'Check file operation status and handle errors', 'file_operations',
'       IF FILE-STATUS NOT = "00"\n           DISPLAY "File error: " FILE-STATUS " on {{file_name}}"\n           EVALUATE FILE-STATUS\n               WHEN "35"\n                   DISPLAY "File not found"\n               WHEN "37"\n                   DISPLAY "No space available"\n               WHEN OTHER\n                   DISPLAY "Unexpected file error"\n           END-EVALUATE\n           PERFORM 9999-ERROR-EXIT\n       END-IF',
'[{"name": "file_name", "type": "string", "description": "Name of the file being checked", "required": true}]'),

('tpl_numeric_validation_01', 'Numeric Field Validation', 'Validate numeric fields before arithmetic operations', 'data_validation',
'       IF {{field_name}} IS NOT NUMERIC\n           DISPLAY "{{field_name}} is not numeric: " {{field_name}}\n           MOVE ZERO TO {{field_name}}\n       END-IF',
'[{"name": "field_name", "type": "variable_name", "description": "Name of the numeric field to validate", "required": true}]');

-- Update schema version
INSERT INTO schema_versions (version, description) VALUES (4, 'MVP4: IDZ Integration, Templates, and Multi-file Workspace');

-- DOWN
-- Rollback for: MVP4 IDZ Integration and Template Engine

-- Drop triggers first
DROP TRIGGER IF EXISTS tr_auto_resolve_dependencies;
DROP TRIGGER IF EXISTS tr_track_workspace_changes;
DROP TRIGGER IF EXISTS tr_update_template_success_rate;
DROP TRIGGER IF EXISTS tr_update_project_sync_status;

-- Drop views
DROP VIEW IF EXISTS v_export_validation_summary;
DROP VIEW IF EXISTS v_workspace_activity;
DROP VIEW IF EXISTS v_template_effectiveness;
DROP VIEW IF EXISTS v_project_status;

-- Drop indexes
DROP INDEX IF EXISTS idx_validation_results_severity;
DROP INDEX IF EXISTS idx_validation_results_file;
DROP INDEX IF EXISTS idx_validation_results_job;
DROP INDEX IF EXISTS idx_export_jobs_status;
DROP INDEX IF EXISTS idx_export_jobs_project;
DROP INDEX IF EXISTS idx_workspace_changes_committed;
DROP INDEX IF EXISTS idx_workspace_changes_file;
DROP INDEX IF EXISTS idx_workspace_changes_session;
DROP INDEX IF EXISTS idx_workspace_sessions_project;
DROP INDEX IF EXISTS idx_workspace_sessions_status;
DROP INDEX IF EXISTS idx_template_usage_rating;
DROP INDEX IF EXISTS idx_template_usage_success;
DROP INDEX IF EXISTS idx_template_usage_project;
DROP INDEX IF EXISTS idx_template_usage_template;
DROP INDEX IF EXISTS idx_template_params_required;
DROP INDEX IF EXISTS idx_template_params_template;
DROP INDEX IF EXISTS idx_templates_language;
DROP INDEX IF EXISTS idx_templates_validated;
DROP INDEX IF EXISTS idx_templates_usage;
DROP INDEX IF EXISTS idx_templates_category;
DROP INDEX IF EXISTS idx_project_deps_name;
DROP INDEX IF EXISTS idx_project_deps_status;
DROP INDEX IF EXISTS idx_project_deps_project;
DROP INDEX IF EXISTS idx_project_files_path;
DROP INDEX IF EXISTS idx_project_files_sync;
DROP INDEX IF EXISTS idx_project_files_status;
DROP INDEX IF EXISTS idx_project_files_project;
DROP INDEX IF EXISTS idx_idz_projects_workspace;
DROP INDEX IF EXISTS idx_idz_projects_type;
DROP INDEX IF EXISTS idx_idz_projects_status;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS validation_results;
DROP TABLE IF EXISTS export_jobs;
DROP TABLE IF EXISTS workspace_changes;
DROP TABLE IF EXISTS workspace_sessions;
DROP TABLE IF EXISTS template_usage;
DROP TABLE IF EXISTS template_parameters;
DROP TABLE IF EXISTS code_templates;
DROP TABLE IF EXISTS project_dependencies;
DROP TABLE IF EXISTS project_files;
DROP TABLE IF EXISTS idz_projects;

-- Remove configuration
DELETE FROM system_config WHERE key IN (
    'idz_integration_enabled',
    'default_workspace_path',
    'auto_sync_enabled',
    'sync_interval_minutes',
    'export_validation_enabled',
    'template_generation_enabled',
    'max_workspace_sessions',
    'auto_save_interval_seconds',
    'dependency_scan_depth',
    'export_package_compression',
    'template_validation_required',
    'workspace_change_retention_days'
);

-- Remove schema version
DELETE FROM schema_versions WHERE version = 4;