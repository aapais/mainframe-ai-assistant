-- Enhanced FTS5 Full-Text Search Migration
-- Version: 1.1
-- Implements advanced FTS5 virtual tables with mainframe-specific optimizations

-- Update schema version
INSERT INTO schema_versions (version, description) VALUES (7, 'Enhanced FTS5 search with mainframe tokenization');

-- Drop existing FTS5 table if it exists
DROP TABLE IF EXISTS kb_fts;
DROP TABLE IF EXISTS kb_fts5;

-- Create enhanced FTS5 virtual table with optimized configuration
CREATE VIRTUAL TABLE kb_fts5 USING fts5(
    id UNINDEXED,                    -- Entry ID (not indexed for search)
    title,                           -- Title field (searchable)
    problem,                         -- Problem description (searchable)
    solution,                        -- Solution text (searchable)
    category UNINDEXED,              -- Category (not indexed, used for filtering)
    tags,                            -- Tags (searchable)
    severity UNINDEXED,              -- Severity level (not indexed)
    created_at UNINDEXED,            -- Creation date (not indexed)

    -- Tokenizer configuration optimized for mainframe terminology
    tokenize = 'porter unicode61 remove_diacritics 1 tokenchars ".-_@#$" separators " \t\r\n,()[]{}!?;:"',

    -- Content configuration
    content = '',                    -- External content (populated via triggers)
    columnsize = 1,                  -- Store column sizes for better ranking
    detail = full                    -- Full detail mode for advanced features
);

-- Configure BM25 ranking with mainframe-optimized weights
-- Title: 3.0 (highest weight - titles are most important)
-- Problem: 2.0 (high weight - problem descriptions are key)
-- Solution: 1.5 (medium-high weight - solutions are important but less than problems)
-- Tags: 1.0 (standard weight - tags provide context)
INSERT INTO kb_fts5(kb_fts5, rank) VALUES('rank', 'bm25(3.0, 2.0, 1.5, 1.0, 1.0, 1.0, 1.0, 1.0)');

-- Configure FTS5 performance parameters
-- Automerge: Controls how often segments are merged (4 = moderate merging)
INSERT INTO kb_fts5(kb_fts5) VALUES('automerge=4');

-- Crisis merge: When to force merging under heavy load (16 segments)
INSERT INTO kb_fts5(kb_fts5) VALUES('crisismerge=16');

-- Delete size: Threshold for delete optimization (1000 deletes)
INSERT INTO kb_fts5(kb_fts5) VALUES('deletesize=1000');

-- Populate FTS5 index with existing data
INSERT INTO kb_fts5(
    id, title, problem, solution, category, tags, severity, created_at
)
SELECT
    e.id,
    e.title,
    e.problem,
    e.solution,
    e.category,
    COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags,
    COALESCE(e.severity, 'medium') as severity,
    e.created_at
FROM kb_entries e
LEFT JOIN kb_tags t ON e.id = t.entry_id
WHERE e.archived = FALSE
GROUP BY e.id, e.title, e.problem, e.solution, e.category, e.severity, e.created_at;

-- Create triggers to maintain FTS5 index automatically

-- Trigger for INSERT operations
DROP TRIGGER IF EXISTS kb_fts5_insert;
CREATE TRIGGER kb_fts5_insert AFTER INSERT ON kb_entries
BEGIN
    INSERT INTO kb_fts5(
        id, title, problem, solution, category, tags, severity, created_at
    )
    SELECT
        NEW.id,
        NEW.title,
        NEW.problem,
        NEW.solution,
        NEW.category,
        COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags,
        COALESCE(NEW.severity, 'medium') as severity,
        NEW.created_at
    FROM kb_entries e
    LEFT JOIN kb_tags t ON e.id = t.entry_id
    WHERE e.id = NEW.id
    GROUP BY e.id, e.title, e.problem, e.solution, e.category, e.severity, e.created_at;
END;

-- Trigger for UPDATE operations
DROP TRIGGER IF EXISTS kb_fts5_update;
CREATE TRIGGER kb_fts5_update AFTER UPDATE ON kb_entries
BEGIN
    -- Delete old entry
    DELETE FROM kb_fts5 WHERE id = OLD.id;

    -- Insert updated entry
    INSERT INTO kb_fts5(
        id, title, problem, solution, category, tags, severity, created_at
    )
    SELECT
        NEW.id,
        NEW.title,
        NEW.problem,
        NEW.solution,
        NEW.category,
        COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags,
        COALESCE(NEW.severity, 'medium') as severity,
        NEW.created_at
    FROM kb_entries e
    LEFT JOIN kb_tags t ON e.id = t.entry_id
    WHERE e.id = NEW.id
    GROUP BY e.id, e.title, e.problem, e.solution, e.category, e.severity, e.created_at;
END;

-- Trigger for DELETE operations
DROP TRIGGER IF EXISTS kb_fts5_delete;
CREATE TRIGGER kb_fts5_delete AFTER DELETE ON kb_entries
BEGIN
    DELETE FROM kb_fts5 WHERE id = OLD.id;
END;

-- Trigger for tag changes (updates FTS5 when tags are modified)
DROP TRIGGER IF EXISTS kb_fts5_tags_update;
CREATE TRIGGER kb_fts5_tags_update AFTER INSERT ON kb_tags
BEGIN
    -- Delete existing FTS5 entry
    DELETE FROM kb_fts5 WHERE id = NEW.entry_id;

    -- Reinsert with updated tags
    INSERT INTO kb_fts5(
        id, title, problem, solution, category, tags, severity, created_at
    )
    SELECT
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags,
        COALESCE(e.severity, 'medium') as severity,
        e.created_at
    FROM kb_entries e
    LEFT JOIN kb_tags t ON e.id = t.entry_id
    WHERE e.id = NEW.entry_id
    GROUP BY e.id, e.title, e.problem, e.solution, e.category, e.severity, e.created_at;
END;

-- Trigger for tag deletions
DROP TRIGGER IF EXISTS kb_fts5_tags_delete;
CREATE TRIGGER kb_fts5_tags_delete AFTER DELETE ON kb_tags
BEGIN
    -- Delete existing FTS5 entry
    DELETE FROM kb_fts5 WHERE id = OLD.entry_id;

    -- Reinsert with updated tags
    INSERT INTO kb_fts5(
        id, title, problem, solution, category, tags, severity, created_at
    )
    SELECT
        e.id,
        e.title,
        e.problem,
        e.solution,
        e.category,
        COALESCE(GROUP_CONCAT(t.tag, ' '), '') as tags,
        COALESCE(e.severity, 'medium') as severity,
        e.created_at
    FROM kb_entries e
    LEFT JOIN kb_tags t ON e.id = t.entry_id
    WHERE e.id = OLD.entry_id
    GROUP BY e.id, e.title, e.problem, e.solution, e.category, e.severity, e.created_at;
END;

-- Create supporting views for FTS5 search analytics

-- View for search performance monitoring
CREATE VIEW IF NOT EXISTS v_fts5_search_stats AS
SELECT
    COUNT(*) as total_indexed_entries,
    AVG(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as avg_document_length,
    MAX(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as max_document_length,
    MIN(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as min_document_length,
    SUM(LENGTH(title) + LENGTH(problem) + LENGTH(solution) + LENGTH(tags)) as total_index_size
FROM kb_fts5;

-- View for FTS5 token analysis
CREATE VIEW IF NOT EXISTS v_fts5_token_analysis AS
SELECT
    category,
    COUNT(*) as entries_count,
    AVG(LENGTH(title)) as avg_title_length,
    AVG(LENGTH(problem)) as avg_problem_length,
    AVG(LENGTH(solution)) as avg_solution_length,
    AVG(LENGTH(tags)) as avg_tags_length
FROM kb_fts5
GROUP BY category;

-- Create indexes for FTS5 performance optimization

-- Index for category filtering (used in FTS5 queries)
CREATE INDEX IF NOT EXISTS idx_kb_entries_category_archived ON kb_entries(category, archived);

-- Index for severity filtering
CREATE INDEX IF NOT EXISTS idx_kb_entries_severity_archived ON kb_entries(severity, archived);

-- Index for date-based filtering
CREATE INDEX IF NOT EXISTS idx_kb_entries_created_archived ON kb_entries(created_at, archived);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_kb_entries_cat_sev_arch ON kb_entries(category, severity, archived);

-- Add FTS5-specific configuration to system_config
INSERT OR REPLACE INTO system_config (key, value, type, description) VALUES
('fts5_enabled', 'true', 'boolean', 'Enable FTS5 full-text search engine'),
('fts5_bm25_k1', '1.2', 'float', 'BM25 k1 parameter for term frequency saturation'),
('fts5_bm25_b', '0.75', 'float', 'BM25 b parameter for length normalization'),
('fts5_title_weight', '3.0', 'float', 'BM25 weight for title field'),
('fts5_problem_weight', '2.0', 'float', 'BM25 weight for problem field'),
('fts5_solution_weight', '1.5', 'float', 'BM25 weight for solution field'),
('fts5_tags_weight', '1.0', 'float', 'BM25 weight for tags field'),
('fts5_snippet_length', '200', 'integer', 'Maximum snippet length in characters'),
('fts5_snippet_context', '30', 'integer', 'Context window around matches in snippets'),
('fts5_max_snippets', '3', 'integer', 'Maximum number of snippets per result'),
('fts5_automerge', '4', 'integer', 'FTS5 automerge frequency'),
('fts5_crisismerge', '16', 'integer', 'FTS5 crisis merge threshold'),
('fts5_deletesize', '1000', 'integer', 'FTS5 delete size threshold'),
('fts5_highlight_start', '<mark>', 'string', 'HTML tag for highlight start'),
('fts5_highlight_end', '</mark>', 'string', 'HTML tag for highlight end');

-- Optimize the FTS5 index for better performance
INSERT INTO kb_fts5(kb_fts5) VALUES('optimize');

-- Update table statistics for query optimizer
ANALYZE kb_fts5;
ANALYZE kb_entries;
ANALYZE kb_tags;

-- Create maintenance procedures

-- Procedure to rebuild FTS5 index (for large updates)
-- Note: This is implemented as a series of statements that can be called together
-- To rebuild:
-- 1. DELETE FROM kb_fts5 WHERE kb_fts5 = 'delete-all';
-- 2. Run the INSERT statement below
-- 3. INSERT INTO kb_fts5(kb_fts5) VALUES('rebuild');

-- Procedure to get FTS5 index statistics
-- Query: SELECT * FROM v_fts5_search_stats;

-- Procedure to optimize FTS5 index
-- Command: INSERT INTO kb_fts5(kb_fts5) VALUES('optimize');

-- Log migration completion
INSERT INTO error_log (error_type, error_message, severity) VALUES
('MIGRATION', 'FTS5 enhanced search migration completed successfully', 'info');