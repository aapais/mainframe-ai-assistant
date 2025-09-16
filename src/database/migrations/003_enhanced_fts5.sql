-- Migration 003: Enhanced FTS5 Implementation with Mainframe Tokenizer
-- Description: Implements enhanced FTS5 search with custom mainframe tokenizer,
--              BM25 ranking, snippet generation, and performance optimizations
-- Version: 3
-- Rollback: Run migration 002 to revert to basic FTS5

-- Record migration start
INSERT INTO schema_versions (version, description) VALUES (3, 'Enhanced FTS5 with mainframe tokenizer and BM25 ranking');

-- ===== ENHANCED FTS5 TABLE CONFIGURATION =====

-- Drop existing FTS5 table if it exists
DROP TABLE IF EXISTS kb_fts_enhanced;

-- Create enhanced FTS5 virtual table with custom configuration
CREATE VIRTUAL TABLE kb_fts_enhanced USING fts5(
  id UNINDEXED,
  title,
  problem,
  solution,
  category UNINDEXED,
  tags,
  severity UNINDEXED,
  -- Enhanced tokenizer configuration
  tokenize = 'porter unicode61 remove_diacritics 2',
  -- Content table reference
  content = 'kb_entries',
  content_rowid = 'rowid',
  -- Custom BM25 ranking parameters
  -- Format: bm25(field1_weight, field2_weight, ...)
  -- Higher weights for more important fields
  rank = 'bm25(3.0, 2.0, 1.5, 1.0, 1.0, 0.5)'
);

-- ===== MAINFRAME TERM WEIGHTS TABLE =====

-- Create table for mainframe-specific term weights
CREATE TABLE IF NOT EXISTS mainframe_term_weights (
  term TEXT PRIMARY KEY,
  weight REAL DEFAULT 1.0,
  term_type TEXT DEFAULT 'general' CHECK(term_type IN ('error_code', 'jcl_syntax', 'cobol_keyword', 'system_msg', 'general')),
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert high-priority mainframe terms with weights
INSERT OR REPLACE INTO mainframe_term_weights (term, weight, term_type, description) VALUES

-- System Completion Codes (Highest Priority)
('S0C7', 3.0, 'error_code', 'Data exception - program interruption'),
('S0C4', 3.0, 'error_code', 'Protection exception - storage protection violation'),
('S806', 3.0, 'error_code', 'Program not found'),
('S878', 3.0, 'error_code', 'Region size insufficient'),
('S80A', 3.0, 'error_code', 'Insufficient virtual storage'),
('S222', 3.0, 'error_code', 'Job cancelled by operator'),
('S322', 3.0, 'error_code', 'Job timed out'),
('S522', 3.0, 'error_code', 'Job cancelled by TSO user'),
('S913', 3.0, 'error_code', 'Dataset in use by another job'),
('S0CB', 3.0, 'error_code', 'Division by zero'),

-- System Messages (High Priority)
('IEF212I', 3.0, 'error_code', 'Job step was not run'),
('IEF285I', 3.0, 'error_code', 'Dataset in use'),
('IEF287I', 3.0, 'error_code', 'Dataset not found'),
('IEF373I', 3.0, 'system_msg', 'Step terminated'),
('IEF374I', 3.0, 'system_msg', 'Job terminated'),
('IEF452I', 3.0, 'system_msg', 'Job completed normally'),
('IEF450I', 3.0, 'system_msg', 'Job summary information'),

-- Sort Messages
('WER027A', 3.0, 'error_code', 'Sort insufficient storage'),
('WER031A', 3.0, 'error_code', 'Sort work dataset required'),
('WER108A', 3.0, 'error_code', 'Sort control statement error'),
('WER211B', 3.0, 'error_code', 'Sort SYSIN error'),
('WER146B', 3.0, 'error_code', 'Sort SORTOUT error'),

-- Language Environment Messages
('CEE3204S', 3.0, 'error_code', 'Program not found'),
('CEE3207S', 3.0, 'error_code', 'Program termination'),
('CEE0374S', 3.0, 'error_code', 'PL/I condition'),
('IGZ0035S', 3.0, 'error_code', 'COBOL runtime error'),

-- TSO/ISPF Messages
('IKJ56650I', 3.0, 'system_msg', 'TSO session terminated'),
('IKJ56648I', 3.0, 'system_msg', 'TSO command not found'),
('IKJ56700I', 3.0, 'system_msg', 'TSO dataset allocation'),

-- RACF Security Messages
('ICH408I', 3.0, 'error_code', 'RACF dataset protection violation'),
('ICH420I', 3.0, 'error_code', 'RACF insufficient access authority'),
('ICH408D', 3.0, 'error_code', 'RACF dataset access request'),

-- User Completion Codes
('U0778', 3.0, 'error_code', 'User completion code 0778'),
('U4038', 3.0, 'error_code', 'User completion code 4038'),
('U0016', 3.0, 'error_code', 'User completion code 0016'),

-- JCL Keywords (High Priority)
('//', 2.5, 'jcl_syntax', 'JCL statement delimiter'),
('DD', 2.5, 'jcl_syntax', 'Data definition statement'),
('DSN', 2.5, 'jcl_syntax', 'Dataset name parameter'),
('DISP', 2.5, 'jcl_syntax', 'Dataset disposition parameter'),
('SPACE', 2.5, 'jcl_syntax', 'Space allocation parameter'),
('UNIT', 2.5, 'jcl_syntax', 'Device unit parameter'),
('VOL', 2.5, 'jcl_syntax', 'Volume parameter'),
('EXEC', 2.5, 'jcl_syntax', 'Execute statement'),
('JOB', 2.5, 'jcl_syntax', 'Job statement'),
('STEP', 2.5, 'jcl_syntax', 'Job step'),
('PROC', 2.5, 'jcl_syntax', 'Procedure'),
('PEND', 2.5, 'jcl_syntax', 'Procedure end'),
('CLASS', 2.5, 'jcl_syntax', 'Job class parameter'),
('MSGCLASS', 2.5, 'jcl_syntax', 'Message class parameter'),
('REGION', 2.5, 'jcl_syntax', 'Region size parameter'),

-- VSAM Keywords (High Priority)
('VSAM', 2.5, 'system_msg', 'Virtual Storage Access Method'),
('KSDS', 2.5, 'system_msg', 'Key Sequenced Dataset'),
('ESDS', 2.5, 'system_msg', 'Entry Sequenced Dataset'),
('RRDS', 2.5, 'system_msg', 'Relative Record Dataset'),
('LDS', 2.5, 'system_msg', 'Linear Dataset'),
('STATUS', 2.5, 'system_msg', 'VSAM status code'),
('AIX', 2.5, 'system_msg', 'Alternate Index'),
('PATH', 2.5, 'system_msg', 'VSAM path'),
('CLUSTER', 2.5, 'system_msg', 'VSAM cluster'),

-- COBOL Keywords (Medium-High Priority)
('COBOL', 2.0, 'cobol_keyword', 'COBOL programming language'),
('MOVE', 2.0, 'cobol_keyword', 'COBOL MOVE statement'),
('PERFORM', 2.0, 'cobol_keyword', 'COBOL PERFORM statement'),
('CALL', 2.0, 'cobol_keyword', 'COBOL CALL statement'),
('PIC', 2.0, 'cobol_keyword', 'COBOL PICTURE clause'),
('PICTURE', 2.0, 'cobol_keyword', 'COBOL PICTURE clause'),
('COMP', 2.0, 'cobol_keyword', 'COBOL computational field'),
('COMP-3', 2.0, 'cobol_keyword', 'COBOL packed decimal'),
('WORKING-STORAGE', 2.0, 'cobol_keyword', 'COBOL working storage section'),
('FILE-CONTROL', 2.0, 'cobol_keyword', 'COBOL file control'),
('SELECT', 2.0, 'cobol_keyword', 'COBOL SELECT statement'),
('ASSIGN', 2.0, 'cobol_keyword', 'COBOL ASSIGN clause'),
('ORGANIZATION', 2.0, 'cobol_keyword', 'COBOL file organization'),
('ACCESS', 2.0, 'cobol_keyword', 'COBOL access mode'),

-- DB2 Keywords
('DB2', 2.0, 'system_msg', 'DB2 database system'),
('SQLCODE', 2.0, 'error_code', 'SQL return code'),
('BIND', 2.0, 'system_msg', 'DB2 bind process'),
('PLAN', 2.0, 'system_msg', 'DB2 application plan'),
('PACKAGE', 2.0, 'system_msg', 'DB2 package'),
('DBRM', 2.0, 'system_msg', 'Database Request Module'),

-- CICS Keywords
('CICS', 2.0, 'system_msg', 'Customer Information Control System'),
('TRANSACTION', 2.0, 'system_msg', 'CICS transaction'),
('COMMAREA', 2.0, 'system_msg', 'CICS communication area'),
('CEMT', 2.0, 'system_msg', 'CICS master terminal'),
('CESN', 2.0, 'system_msg', 'CICS sign on'),
('CESF', 2.0, 'system_msg', 'CICS sign off'),

-- General System Terms (Medium Priority)
('ABEND', 2.0, 'system_msg', 'Abnormal end'),
('COMPLETION', 2.0, 'system_msg', 'Job completion'),
('CODE', 2.0, 'system_msg', 'Completion code'),
('DATASET', 1.5, 'system_msg', 'Data set'),
('CATALOG', 1.5, 'system_msg', 'System catalog'),
('VOLUME', 1.5, 'system_msg', 'Storage volume'),
('ALLOCATION', 1.5, 'system_msg', 'Dataset allocation'),
('MOUNT', 1.5, 'system_msg', 'Volume mount'),
('SYSOUT', 1.5, 'system_msg', 'System output'),
('JCL', 1.5, 'system_msg', 'Job Control Language'),
('BATCH', 1.5, 'system_msg', 'Batch processing'),
('TSO', 1.5, 'system_msg', 'Time Sharing Option'),
('ISPF', 1.5, 'system_msg', 'Interactive System Productivity Facility'),
('MVS', 1.5, 'system_msg', 'Multiple Virtual Storage'),
('ZOS', 1.5, 'system_msg', 'z/OS operating system'),
('RACF', 1.5, 'system_msg', 'Resource Access Control Facility'),
('SMS', 1.5, 'system_msg', 'Storage Management Subsystem'),
('HSM', 1.5, 'system_msg', 'Hierarchical Storage Manager');

-- ===== ENHANCED FTS5 TRIGGERS =====

-- Drop existing triggers
DROP TRIGGER IF EXISTS kb_fts_enhanced_insert;
DROP TRIGGER IF EXISTS kb_fts_enhanced_delete;
DROP TRIGGER IF EXISTS kb_fts_enhanced_update;
DROP TRIGGER IF EXISTS kb_tags_fts_enhanced_update;

-- Create enhanced triggers with error handling
CREATE TRIGGER kb_fts_enhanced_insert AFTER INSERT ON kb_entries
FOR EACH ROW
BEGIN
  INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
  SELECT
    NEW.rowid,
    NEW.id,
    NEW.title,
    NEW.problem,
    NEW.solution,
    NEW.category,
    COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''),
    NEW.severity;
END;

CREATE TRIGGER kb_fts_enhanced_delete AFTER DELETE ON kb_entries
FOR EACH ROW
BEGIN
  DELETE FROM kb_fts_enhanced WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER kb_fts_enhanced_update AFTER UPDATE ON kb_entries
FOR EACH ROW
BEGIN
  DELETE FROM kb_fts_enhanced WHERE rowid = OLD.rowid;
  INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
  SELECT
    NEW.rowid,
    NEW.id,
    NEW.title,
    NEW.problem,
    NEW.solution,
    NEW.category,
    COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''),
    NEW.severity;
END;

-- Enhanced tag trigger with better error handling
CREATE TRIGGER kb_tags_fts_enhanced_update
AFTER INSERT OR UPDATE OR DELETE ON kb_tags
FOR EACH ROW
BEGIN
  -- Delete existing FTS5 entry
  DELETE FROM kb_fts_enhanced WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);

  -- Reinsert with updated tags
  INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
  SELECT
    e.rowid,
    e.id,
    e.title,
    e.problem,
    e.solution,
    e.category,
    COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM kb_tags t WHERE t.entry_id = e.id), ''),
    e.severity
  FROM kb_entries e
  WHERE e.id = COALESCE(NEW.entry_id, OLD.entry_id);
END;

-- ===== SEARCH PERFORMANCE TRACKING =====

-- Enhanced search performance table
CREATE TABLE IF NOT EXISTS search_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  search_type TEXT DEFAULT 'standard' CHECK(search_type IN ('standard', 'fts5', 'enhanced_fts5', 'ai', 'hybrid')),
  results_count INTEGER DEFAULT 0,
  processing_time_ms REAL NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  user_id TEXT DEFAULT 'anonymous',
  session_id TEXT,
  timestamp INTEGER DEFAULT (strftime('%s', 'now')),
  query_complexity INTEGER DEFAULT 1, -- 1=simple, 2=medium, 3=complex
  ranking_profile TEXT DEFAULT 'balanced',
  had_snippets BOOLEAN DEFAULT FALSE,
  fts5_fallback BOOLEAN DEFAULT FALSE
);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_search_performance_timestamp ON search_performance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_performance_type ON search_performance(search_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_performance_time ON search_performance(processing_time_ms);

-- ===== ENHANCED INDEXES FOR FTS5 INTEGRATION =====

-- Composite indexes for enhanced search queries
CREATE INDEX IF NOT EXISTS idx_kb_entries_fts5_composite ON kb_entries(
  category, severity, usage_count DESC, success_count DESC
) WHERE archived = FALSE;

-- Index for mainframe term weight lookups
CREATE INDEX IF NOT EXISTS idx_mainframe_terms_type ON mainframe_term_weights(term_type, weight DESC);

-- ===== SEARCH RANKING FUNCTIONS =====

-- Create view for enhanced search ranking
CREATE VIEW IF NOT EXISTS v_enhanced_search_ranking AS
SELECT
  e.id,
  e.title,
  e.problem,
  e.solution,
  e.category,
  e.severity,
  e.usage_count,
  e.success_count,
  e.failure_count,
  -- Base popularity score (logarithmic to prevent dominance)
  LOG(e.usage_count + 1) * 0.1 as popularity_score,

  -- Success rate score (0-1 normalized)
  CASE WHEN (e.success_count + e.failure_count) > 0
       THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
       ELSE 0 END as success_rate,

  -- Recency boost (entries created/updated in last 30 days)
  CASE WHEN julianday('now') - julianday(e.updated_at) < 30
       THEN 0.05 ELSE 0 END as recency_boost,

  -- Category priority weights
  CASE e.category
    WHEN 'JCL' THEN 1.1
    WHEN 'VSAM' THEN 1.1
    WHEN 'DB2' THEN 1.0
    WHEN 'Batch' THEN 1.0
    WHEN 'CICS' THEN 0.9
    ELSE 0.8 END as category_weight,

  -- Severity priority weights
  CASE e.severity
    WHEN 'critical' THEN 1.2
    WHEN 'high' THEN 1.1
    WHEN 'medium' THEN 1.0
    WHEN 'low' THEN 0.9
    ELSE 1.0 END as severity_weight,

  -- Combined ranking score
  (LOG(e.usage_count + 1) * 0.1 +
   CASE WHEN (e.success_count + e.failure_count) > 0
        THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 0.2
        ELSE 0 END +
   CASE WHEN julianday('now') - julianday(e.updated_at) < 30
        THEN 0.05 ELSE 0 END) *
  CASE e.category
    WHEN 'JCL' THEN 1.1
    WHEN 'VSAM' THEN 1.1
    ELSE 1.0 END *
  CASE e.severity
    WHEN 'critical' THEN 1.2
    WHEN 'high' THEN 1.1
    ELSE 1.0 END as composite_ranking_score

FROM kb_entries e
WHERE e.archived = FALSE;

-- ===== POPULATE ENHANCED FTS5 INDEX =====

-- Clear any existing data
DELETE FROM kb_fts_enhanced;

-- Populate enhanced FTS5 index with existing data
INSERT INTO kb_fts_enhanced(rowid, id, title, problem, solution, category, tags, severity)
SELECT
  e.rowid,
  e.id,
  e.title,
  e.problem,
  e.solution,
  e.category,
  COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM kb_tags t WHERE t.entry_id = e.id), ''),
  e.severity
FROM kb_entries e
WHERE e.archived = FALSE;

-- Optimize the FTS5 index for better performance
INSERT INTO kb_fts_enhanced(kb_fts_enhanced) VALUES('optimize');

-- ===== ENHANCED SYSTEM CONFIGURATION =====

-- Add enhanced FTS5 configuration settings
INSERT OR REPLACE INTO system_config (key, value, type, description) VALUES
('fts5_enhanced_enabled', 'true', 'boolean', 'Enable enhanced FTS5 search with mainframe tokenizer'),
('fts5_snippet_length', '200', 'integer', 'Default snippet length for enhanced search'),
('fts5_ranking_profile', 'balanced', 'string', 'Default ranking profile: balanced, precision, recall, mainframe_focused'),
('fts5_mainframe_boost', '1.2', 'float', 'Boost factor for mainframe-specific terms'),
('fts5_cache_ttl_seconds', '300', 'integer', 'FTS5 search cache TTL in seconds'),
('fts5_max_results', '100', 'integer', 'Maximum results for FTS5 search'),
('fts5_proximity_boost', 'true', 'boolean', 'Enable proximity boosting for term clusters'),
('fts5_enable_snippets', 'true', 'boolean', 'Enable context-aware snippet generation'),
('fts5_highlight_tags', '{"start": "<mark>", "end": "</mark>"}', 'json', 'HTML tags for search highlighting'),
('fts5_performance_logging', 'true', 'boolean', 'Enable detailed performance logging for FTS5');

-- ===== MAINTENANCE PROCEDURES =====

-- Create maintenance schedule for enhanced FTS5
CREATE TABLE IF NOT EXISTS fts5_maintenance_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL CHECK(operation IN ('optimize', 'rebuild', 'integrity_check', 'cleanup')),
  status TEXT DEFAULT 'completed' CHECK(status IN ('started', 'completed', 'failed')),
  duration_ms INTEGER,
  records_processed INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== ROLLBACK INSTRUCTIONS =====

-- To rollback this migration:
-- 1. DROP TABLE kb_fts_enhanced;
-- 2. DROP TABLE mainframe_term_weights;
-- 3. DROP TABLE search_performance;
-- 4. DROP TABLE fts5_maintenance_log;
-- 5. DROP VIEW v_enhanced_search_ranking;
-- 6. Recreate original kb_fts table if needed
-- 7. UPDATE schema_versions SET version = 2 WHERE version = 3;

-- Record successful migration completion
UPDATE schema_versions SET applied_at = CURRENT_TIMESTAMP WHERE version = 3;

-- Analyze tables for query optimization
ANALYZE;

-- Log migration completion
INSERT INTO fts5_maintenance_log (operation, status, records_processed)
SELECT 'rebuild', 'completed', COUNT(*) FROM kb_fts_enhanced;