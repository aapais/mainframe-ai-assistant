-- UP
-- Migration: MVP3 Code Analysis Integration
-- Version: 003
-- Generated: 2025-01-11
-- Description: Add code analysis capabilities and KB-Code linking

-- ===== CODE ANALYSIS TABLES =====

-- Uploaded code files
CREATE TABLE IF NOT EXISTS code_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT,
    file_type TEXT CHECK(file_type IN ('cobol', 'cbl', 'cob', 'jcl', 'proc', 'copybook', 'other')) NOT NULL,
    file_size INTEGER,
    content_hash TEXT, -- SHA256 of file content
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_by TEXT DEFAULT 'system',
    last_analyzed DATETIME,
    analysis_status TEXT CHECK(analysis_status IN ('pending', 'analyzing', 'completed', 'failed')) DEFAULT 'pending',
    metadata TEXT, -- JSON for additional file info
    archived BOOLEAN DEFAULT FALSE
);

-- Parsed program structure
CREATE TABLE IF NOT EXISTS parsed_programs (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    program_name TEXT,
    language TEXT DEFAULT 'cobol',
    divisions TEXT, -- JSON array of divisions found
    sections TEXT, -- JSON array of sections
    paragraphs TEXT, -- JSON array of paragraphs with line numbers
    variables TEXT, -- JSON array of variables with definitions
    calls TEXT, -- JSON array of CALL statements
    files_used TEXT, -- JSON array of file definitions
    line_count INTEGER,
    complexity_score INTEGER,
    parsed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    parser_version TEXT DEFAULT '1.0',
    parse_errors TEXT, -- JSON array of parse errors
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- Link KB entries to specific code sections
CREATE TABLE IF NOT EXISTS kb_code_links (
    id TEXT PRIMARY KEY,
    kb_entry_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    program_id TEXT,
    line_start INTEGER NOT NULL,
    line_end INTEGER,
    code_snippet TEXT,
    link_type TEXT CHECK(link_type IN ('manual', 'auto', 'pattern', 'error_location')) DEFAULT 'manual',
    confidence REAL DEFAULT 1.0 CHECK(confidence >= 0 AND confidence <= 1),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    validated BOOLEAN DEFAULT FALSE,
    validation_score REAL,
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES parsed_programs(id) ON DELETE SET NULL
);

-- Code analysis results
CREATE TABLE IF NOT EXISTS code_analysis (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    analysis_type TEXT CHECK(analysis_type IN ('syntax', 'complexity', 'quality', 'security', 'ai_review')) NOT NULL,
    analyzer TEXT NOT NULL, -- Which analyzer was used (cobol_parser, gemini, etc.)
    status TEXT CHECK(status IN ('completed', 'failed', 'partial')) DEFAULT 'completed',
    findings TEXT, -- JSON array of findings
    metrics TEXT, -- JSON object with metrics
    suggestions TEXT, -- JSON array of suggestions
    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    analysis_duration_ms INTEGER,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- Code quality issues
CREATE TABLE IF NOT EXISTS code_issues (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    issue_type TEXT CHECK(issue_type IN ('error', 'warning', 'suggestion', 'security', 'performance')) NOT NULL,
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')) DEFAULT 'medium',
    line_number INTEGER,
    column_number INTEGER,
    message TEXT NOT NULL,
    rule_id TEXT,
    suggestion TEXT,
    auto_fixable BOOLEAN DEFAULT FALSE,
    fixed BOOLEAN DEFAULT FALSE,
    false_positive BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by TEXT,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- AI analysis results
CREATE TABLE IF NOT EXISTS ai_code_analysis (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    prompt_type TEXT CHECK(prompt_type IN ('explain', 'review', 'suggest_fixes', 'find_bugs', 'optimize')) NOT NULL,
    prompt_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    model_used TEXT DEFAULT 'gemini-pro',
    tokens_used INTEGER,
    confidence_score REAL,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    feedback_rating INTEGER CHECK(feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_text TEXT,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- Code metrics tracking
CREATE TABLE IF NOT EXISTS code_metrics (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_type TEXT CHECK(metric_type IN ('complexity', 'maintainability', 'lines', 'functions', 'issues')) NOT NULL,
    calculation_method TEXT,
    baseline_value REAL,
    trend TEXT CHECK(trend IN ('improving', 'degrading', 'stable', 'unknown')) DEFAULT 'unknown',
    measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- Code dependencies and relationships
CREATE TABLE IF NOT EXISTS code_dependencies (
    id TEXT PRIMARY KEY,
    source_file_id TEXT NOT NULL,
    target_file_id TEXT,
    dependency_type TEXT CHECK(dependency_type IN ('includes', 'calls', 'copies', 'uses_copybook', 'includes_jcl')) NOT NULL,
    dependency_name TEXT, -- Name of the dependency (program, copybook, etc.)
    line_number INTEGER,
    is_external BOOLEAN DEFAULT FALSE,
    resolution_status TEXT CHECK(resolution_status IN ('resolved', 'unresolved', 'missing')) DEFAULT 'unresolved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_file_id) REFERENCES code_files(id) ON DELETE CASCADE,
    FOREIGN KEY (target_file_id) REFERENCES code_files(id) ON DELETE SET NULL
);

-- ===== INDEXES FOR CODE ANALYSIS PERFORMANCE =====

-- Code files indexes
CREATE INDEX IF NOT EXISTS idx_code_files_type ON code_files(file_type, archived);
CREATE INDEX IF NOT EXISTS idx_code_files_uploaded ON code_files(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_files_analysis_status ON code_files(analysis_status, last_analyzed);
CREATE INDEX IF NOT EXISTS idx_code_files_hash ON code_files(content_hash);
CREATE INDEX IF NOT EXISTS idx_code_files_filename ON code_files(filename);

-- Parsed programs indexes
CREATE INDEX IF NOT EXISTS idx_parsed_programs_file ON parsed_programs(file_id);
CREATE INDEX IF NOT EXISTS idx_parsed_programs_name ON parsed_programs(program_name);
CREATE INDEX IF NOT EXISTS idx_parsed_programs_complexity ON parsed_programs(complexity_score DESC);

-- KB code links indexes
CREATE INDEX IF NOT EXISTS idx_kb_code_links_kb ON kb_code_links(kb_entry_id);
CREATE INDEX IF NOT EXISTS idx_kb_code_links_file ON kb_code_links(file_id, line_start);
CREATE INDEX IF NOT EXISTS idx_kb_code_links_type ON kb_code_links(link_type, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_kb_code_links_validated ON kb_code_links(validated, validation_score DESC);

-- Code analysis indexes
CREATE INDEX IF NOT EXISTS idx_code_analysis_file ON code_analysis(file_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_analysis_type ON code_analysis(analysis_type, status);
CREATE INDEX IF NOT EXISTS idx_code_analysis_analyzer ON code_analysis(analyzer, analyzed_at DESC);

-- Code issues indexes
CREATE INDEX IF NOT EXISTS idx_code_issues_file ON code_issues(file_id, severity);
CREATE INDEX IF NOT EXISTS idx_code_issues_type ON code_issues(issue_type, severity);
CREATE INDEX IF NOT EXISTS idx_code_issues_unresolved ON code_issues(fixed, false_positive, severity) WHERE fixed = FALSE AND false_positive = FALSE;
CREATE INDEX IF NOT EXISTS idx_code_issues_line ON code_issues(file_id, line_number);

-- AI analysis indexes
CREATE INDEX IF NOT EXISTS idx_ai_analysis_file ON ai_code_analysis(file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON ai_code_analysis(prompt_type, model_used);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_rating ON ai_code_analysis(feedback_rating DESC) WHERE feedback_rating IS NOT NULL;

-- Code metrics indexes
CREATE INDEX IF NOT EXISTS idx_code_metrics_file ON code_metrics(file_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_code_metrics_type ON code_metrics(metric_type, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_metrics_trend ON code_metrics(trend, metric_name);

-- Dependencies indexes
CREATE INDEX IF NOT EXISTS idx_code_deps_source ON code_dependencies(source_file_id, dependency_type);
CREATE INDEX IF NOT EXISTS idx_code_deps_target ON code_dependencies(target_file_id) WHERE target_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_code_deps_name ON code_dependencies(dependency_name, dependency_type);
CREATE INDEX IF NOT EXISTS idx_code_deps_unresolved ON code_dependencies(resolution_status) WHERE resolution_status = 'unresolved';

-- ===== FULL-TEXT SEARCH FOR CODE CONTENT =====

-- FTS for code content (if needed for searching within code)
CREATE VIRTUAL TABLE IF NOT EXISTS code_fts USING fts5(
    file_id UNINDEXED,
    filename,
    program_name,
    content,
    tokenize = 'porter unicode61'
);

-- ===== CODE ANALYSIS VIEWS =====

-- View for code quality summary
CREATE VIEW IF NOT EXISTS v_code_quality_summary AS
SELECT 
    cf.id,
    cf.filename,
    cf.file_type,
    cf.uploaded_at,
    pp.complexity_score,
    COUNT(DISTINCT ci.id) as total_issues,
    COUNT(CASE WHEN ci.severity = 'critical' THEN 1 END) as critical_issues,
    COUNT(CASE WHEN ci.severity = 'high' THEN 1 END) as high_issues,
    COUNT(CASE WHEN ci.fixed = TRUE THEN 1 END) as fixed_issues,
    COUNT(DISTINCT kcl.kb_entry_id) as linked_kb_entries,
    MAX(ca.analyzed_at) as last_analyzed
FROM code_files cf
LEFT JOIN parsed_programs pp ON cf.id = pp.file_id
LEFT JOIN code_issues ci ON cf.id = ci.file_id AND ci.false_positive = FALSE
LEFT JOIN kb_code_links kcl ON cf.id = kcl.file_id
LEFT JOIN code_analysis ca ON cf.id = ca.file_id
WHERE cf.archived = FALSE
GROUP BY cf.id, cf.filename, cf.file_type, cf.uploaded_at, pp.complexity_score;

-- View for KB-Code relationship analysis
CREATE VIEW IF NOT EXISTS v_kb_code_coverage AS
SELECT 
    kb.id as kb_entry_id,
    kb.title,
    kb.category,
    COUNT(DISTINCT kcl.file_id) as linked_files,
    COUNT(DISTINCT kcl.id) as total_links,
    COUNT(CASE WHEN kcl.link_type = 'auto' THEN 1 END) as auto_links,
    COUNT(CASE WHEN kcl.validated = TRUE THEN 1 END) as validated_links,
    AVG(kcl.confidence) as avg_confidence,
    MAX(kcl.created_at) as last_linked
FROM kb_entries kb
LEFT JOIN kb_code_links kcl ON kb.id = kcl.kb_entry_id
WHERE kb.archived = FALSE
GROUP BY kb.id, kb.title, kb.category;

-- View for file analysis status
CREATE VIEW IF NOT EXISTS v_file_analysis_status AS
SELECT 
    cf.id,
    cf.filename,
    cf.file_type,
    cf.analysis_status,
    cf.last_analyzed,
    COUNT(DISTINCT ca.id) as analysis_count,
    COUNT(DISTINCT CASE WHEN ca.analysis_type = 'ai_review' THEN ca.id END) as ai_reviews,
    COUNT(DISTINCT ci.id) as issues_found,
    pp.complexity_score,
    pp.line_count
FROM code_files cf
LEFT JOIN code_analysis ca ON cf.id = ca.file_id
LEFT JOIN code_issues ci ON cf.id = ci.file_id AND ci.fixed = FALSE
LEFT JOIN parsed_programs pp ON cf.id = pp.file_id
WHERE cf.archived = FALSE
GROUP BY cf.id, cf.filename, cf.file_type, cf.analysis_status, cf.last_analyzed, pp.complexity_score, pp.line_count;

-- View for dependency graph
CREATE VIEW IF NOT EXISTS v_dependency_graph AS
SELECT 
    cf_source.filename as source_file,
    cf_target.filename as target_file,
    cd.dependency_type,
    cd.dependency_name,
    cd.resolution_status,
    cd.is_external
FROM code_dependencies cd
JOIN code_files cf_source ON cd.source_file_id = cf_source.id
LEFT JOIN code_files cf_target ON cd.target_file_id = cf_target.id
WHERE cf_source.archived = FALSE
ORDER BY cf_source.filename, cd.dependency_type;

-- ===== TRIGGERS FOR CODE ANALYSIS =====

-- Update code analysis status when analysis completes
CREATE TRIGGER IF NOT EXISTS tr_update_analysis_status
AFTER INSERT ON code_analysis
FOR EACH ROW
BEGIN
    UPDATE code_files 
    SET 
        analysis_status = 'completed',
        last_analyzed = CURRENT_TIMESTAMP
    WHERE id = NEW.file_id;
END;

-- Update FTS when code files are added/updated
CREATE TRIGGER IF NOT EXISTS tr_code_fts_insert
AFTER INSERT ON parsed_programs
FOR EACH ROW
BEGIN
    INSERT INTO code_fts (file_id, filename, program_name, content)
    SELECT 
        cf.id,
        cf.filename,
        NEW.program_name,
        COALESCE(NEW.divisions, '') || ' ' || 
        COALESCE(NEW.sections, '') || ' ' || 
        COALESCE(NEW.paragraphs, '')
    FROM code_files cf
    WHERE cf.id = NEW.file_id;
END;

-- Auto-link KB entries based on error patterns in code issues
CREATE TRIGGER IF NOT EXISTS tr_auto_link_code_issues
AFTER INSERT ON code_issues
FOR EACH ROW
WHEN NEW.issue_type = 'error' AND NEW.message IS NOT NULL
BEGIN
    -- This would be enhanced with actual pattern matching logic
    -- For now, just a placeholder for the concept
    INSERT INTO kb_code_links (
        id,
        kb_entry_id,
        file_id,
        line_start,
        line_end,
        code_snippet,
        link_type,
        confidence,
        description
    )
    SELECT 
        'auto_' || NEW.id || '_' || kb.id,
        kb.id,
        NEW.file_id,
        NEW.line_number,
        NEW.line_number,
        SUBSTR(NEW.message, 1, 200),
        'auto',
        0.7,
        'Auto-linked based on error pattern'
    FROM kb_entries kb
    WHERE kb.archived = FALSE
    AND (
        LOWER(kb.title) LIKE '%' || LOWER(SUBSTR(NEW.message, 1, 20)) || '%'
        OR LOWER(kb.problem) LIKE '%' || LOWER(SUBSTR(NEW.message, 1, 20)) || '%'
    )
    LIMIT 1;
END;

-- ===== CODE ANALYSIS CONFIGURATION =====

-- Add code analysis configuration
INSERT OR IGNORE INTO system_config (key, value, type, description) VALUES
('code_analysis_enabled', 'true', 'boolean', 'Enable code analysis features'),
('max_file_size_mb', '10', 'integer', 'Maximum file size for analysis in MB'),
('auto_analysis_enabled', 'true', 'boolean', 'Enable automatic analysis on file upload'),
('ai_analysis_enabled', 'true', 'boolean', 'Enable AI-powered code analysis'),
('auto_linking_enabled', 'true', 'boolean', 'Enable automatic KB-code linking'),
('complexity_threshold', '20', 'integer', 'Complexity score threshold for warnings'),
('supported_file_types', '["cobol", "cbl", "cob", "jcl", "proc"]', 'json', 'Supported file types for analysis'),
('parser_timeout_seconds', '30', 'integer', 'Timeout for code parsing operations'),
('ai_analysis_timeout_seconds', '60', 'integer', 'Timeout for AI analysis operations'),
('dependency_scan_enabled', 'true', 'boolean', 'Enable dependency scanning');

-- Update schema version
INSERT INTO schema_versions (version, description) VALUES (3, 'MVP3: Code Analysis and KB-Code Integration');

-- DOWN
-- Rollback for: MVP3 Code Analysis Integration

-- Drop triggers first
DROP TRIGGER IF EXISTS tr_auto_link_code_issues;
DROP TRIGGER IF EXISTS tr_code_fts_insert;
DROP TRIGGER IF EXISTS tr_update_analysis_status;

-- Drop views
DROP VIEW IF EXISTS v_dependency_graph;
DROP VIEW IF EXISTS v_file_analysis_status;
DROP VIEW IF EXISTS v_kb_code_coverage;
DROP VIEW IF EXISTS v_code_quality_summary;

-- Drop FTS table
DROP TABLE IF EXISTS code_fts;

-- Drop indexes
DROP INDEX IF EXISTS idx_code_deps_unresolved;
DROP INDEX IF EXISTS idx_code_deps_name;
DROP INDEX IF EXISTS idx_code_deps_target;
DROP INDEX IF EXISTS idx_code_deps_source;
DROP INDEX IF EXISTS idx_code_metrics_trend;
DROP INDEX IF EXISTS idx_code_metrics_type;
DROP INDEX IF EXISTS idx_code_metrics_file;
DROP INDEX IF EXISTS idx_ai_analysis_rating;
DROP INDEX IF EXISTS idx_ai_analysis_type;
DROP INDEX IF EXISTS idx_ai_analysis_file;
DROP INDEX IF EXISTS idx_code_issues_line;
DROP INDEX IF EXISTS idx_code_issues_unresolved;
DROP INDEX IF EXISTS idx_code_issues_type;
DROP INDEX IF EXISTS idx_code_issues_file;
DROP INDEX IF EXISTS idx_code_analysis_analyzer;
DROP INDEX IF EXISTS idx_code_analysis_type;
DROP INDEX IF EXISTS idx_code_analysis_file;
DROP INDEX IF EXISTS idx_kb_code_links_validated;
DROP INDEX IF EXISTS idx_kb_code_links_type;
DROP INDEX IF EXISTS idx_kb_code_links_file;
DROP INDEX IF EXISTS idx_kb_code_links_kb;
DROP INDEX IF EXISTS idx_parsed_programs_complexity;
DROP INDEX IF EXISTS idx_parsed_programs_name;
DROP INDEX IF EXISTS idx_parsed_programs_file;
DROP INDEX IF EXISTS idx_code_files_filename;
DROP INDEX IF EXISTS idx_code_files_hash;
DROP INDEX IF EXISTS idx_code_files_analysis_status;
DROP INDEX IF EXISTS idx_code_files_uploaded;
DROP INDEX IF EXISTS idx_code_files_type;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS code_dependencies;
DROP TABLE IF EXISTS code_metrics;
DROP TABLE IF EXISTS ai_code_analysis;
DROP TABLE IF EXISTS code_issues;
DROP TABLE IF EXISTS code_analysis;
DROP TABLE IF EXISTS kb_code_links;
DROP TABLE IF EXISTS parsed_programs;
DROP TABLE IF EXISTS code_files;

-- Remove configuration
DELETE FROM system_config WHERE key IN (
    'code_analysis_enabled',
    'max_file_size_mb',
    'auto_analysis_enabled',
    'ai_analysis_enabled',
    'auto_linking_enabled',
    'complexity_threshold',
    'supported_file_types',
    'parser_timeout_seconds',
    'ai_analysis_timeout_seconds',
    'dependency_scan_enabled'
);

-- Remove schema version
DELETE FROM schema_versions WHERE version = 3;