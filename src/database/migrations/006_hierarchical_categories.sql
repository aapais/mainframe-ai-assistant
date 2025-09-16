-- Migration: Hierarchical Categories and Enhanced Tagging System
-- Version: 006
-- Description: Adds support for hierarchical categories and enhanced tagging with metadata

-- ===========================
-- HIERARCHICAL CATEGORIES
-- ===========================

-- Drop existing category constraints if they exist
DROP INDEX IF EXISTS idx_kb_entries_category;

-- Create hierarchical categories table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id TEXT,
    level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 5),
    sort_order INTEGER NOT NULL DEFAULT 0,
    icon TEXT,
    color TEXT CHECK (color IS NULL OR color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    entry_count INTEGER NOT NULL DEFAULT 0 CHECK (entry_count >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',

    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
    CHECK (parent_id IS NULL OR parent_id != id) -- Prevent self-reference
);

-- Create indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name COLLATE NOCASE);

-- Create composite index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_categories_hierarchy ON categories(parent_id, level, sort_order, is_active);

-- ===========================
-- ENHANCED TAGS SYSTEM
-- ===========================

-- Create enhanced tags table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    description TEXT,
    category_id TEXT,
    color TEXT CHECK (color IS NULL OR color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
    usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_suggested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',

    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Create indexes for tags
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tags_category_id ON tags(category_id);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_is_system ON tags(is_system);
CREATE INDEX IF NOT EXISTS idx_tags_is_suggested ON tags(is_suggested);

-- Create FTS index for tag names and descriptions
CREATE VIRTUAL TABLE IF NOT EXISTS tags_fts USING fts5(
    id UNINDEXED,
    name,
    display_name,
    description,
    content=tags
);

-- ===========================
-- TAG ASSOCIATIONS
-- ===========================

-- Create tag associations table (replaces simple kb_tags)
CREATE TABLE IF NOT EXISTS tag_associations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    entry_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    relevance_score REAL CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1)),
    assigned_by TEXT NOT NULL DEFAULT 'user' CHECK (assigned_by IN ('user', 'system', 'ai')),
    confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',

    FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(entry_id, tag_id) -- Prevent duplicate associations
);

-- Create indexes for tag associations
CREATE INDEX IF NOT EXISTS idx_tag_associations_entry_id ON tag_associations(entry_id);
CREATE INDEX IF NOT EXISTS idx_tag_associations_tag_id ON tag_associations(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_associations_relevance ON tag_associations(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_tag_associations_assigned_by ON tag_associations(assigned_by);

-- ===========================
-- CATEGORY ASSOCIATIONS
-- ===========================

-- Add category_id to kb_entries if not exists (for backward compatibility)
ALTER TABLE kb_entries ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;

-- Create index for new category_id
CREATE INDEX IF NOT EXISTS idx_kb_entries_category_id ON kb_entries(category_id);

-- ===========================
-- ANALYTICS TABLES
-- ===========================

-- Category analytics table
CREATE TABLE IF NOT EXISTS category_analytics (
    category_id TEXT PRIMARY KEY,
    entry_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    search_count INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 1),
    avg_resolution_time INTEGER, -- in milliseconds
    trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
    trend_percentage REAL,
    trend_period TEXT,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Tag analytics table
CREATE TABLE IF NOT EXISTS tag_analytics (
    tag_id TEXT PRIMARY KEY,
    usage_count INTEGER NOT NULL DEFAULT 0,
    entry_count INTEGER NOT NULL DEFAULT 0,
    trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
    trend_percentage REAL,
    trend_period TEXT,
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ===========================
-- AUTOCOMPLETE CACHE
-- ===========================

-- Autocomplete suggestions cache table
CREATE TABLE IF NOT EXISTS autocomplete_cache (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL CHECK (type IN ('category', 'tag', 'entry', 'search_term')),
    value TEXT NOT NULL,
    display_value TEXT NOT NULL,
    description TEXT,
    score REAL NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    metadata TEXT, -- JSON
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for autocomplete
CREATE INDEX IF NOT EXISTS idx_autocomplete_type ON autocomplete_cache(type);
CREATE INDEX IF NOT EXISTS idx_autocomplete_value ON autocomplete_cache(value COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_autocomplete_score ON autocomplete_cache(score DESC);
CREATE INDEX IF NOT EXISTS idx_autocomplete_usage ON autocomplete_cache(usage_count DESC);

-- Create FTS index for autocomplete
CREATE VIRTUAL TABLE IF NOT EXISTS autocomplete_fts USING fts5(
    id UNINDEXED,
    value,
    display_value,
    description,
    content=autocomplete_cache
);

-- ===========================
-- MIGRATION DATA
-- ===========================

-- Insert default system categories (hierarchical structure)
INSERT OR IGNORE INTO categories (id, name, slug, description, parent_id, level, sort_order, is_system, is_active) VALUES
    ('mainframe-root', 'Mainframe Systems', 'mainframe', 'Root category for all mainframe-related knowledge', NULL, 0, 0, TRUE, TRUE),
    ('languages', 'Programming Languages', 'languages', 'Programming languages and development tools', 'mainframe-root', 1, 1, TRUE, TRUE),
    ('data-systems', 'Data Systems', 'data-systems', 'Database and file management systems', 'mainframe-root', 1, 2, TRUE, TRUE),
    ('job-control', 'Job Control', 'job-control', 'Job control and batch processing', 'mainframe-root', 1, 3, TRUE, TRUE),
    ('middleware', 'Middleware', 'middleware', 'Transaction processors and middleware', 'mainframe-root', 1, 4, TRUE, TRUE),
    ('operations', 'Operations', 'operations', 'System operations and utilities', 'mainframe-root', 1, 5, TRUE, TRUE),

    -- Second level categories
    ('cobol', 'COBOL', 'cobol', 'COBOL programming language', 'languages', 2, 1, TRUE, TRUE),
    ('assembler', 'Assembler', 'assembler', 'Assembler programming language', 'languages', 2, 2, TRUE, TRUE),
    ('pl1', 'PL/I', 'pl1', 'PL/I programming language', 'languages', 2, 3, TRUE, TRUE),

    ('db2', 'DB2', 'db2', 'DB2 database system', 'data-systems', 2, 1, TRUE, TRUE),
    ('ims-db', 'IMS Database', 'ims-db', 'IMS database management', 'data-systems', 2, 2, TRUE, TRUE),
    ('vsam', 'VSAM', 'vsam', 'Virtual Storage Access Method', 'data-systems', 2, 3, TRUE, TRUE),
    ('sequential', 'Sequential Files', 'sequential', 'Sequential file processing', 'data-systems', 2, 4, TRUE, TRUE),

    ('jcl', 'JCL', 'jcl', 'Job Control Language', 'job-control', 2, 1, TRUE, TRUE),
    ('batch', 'Batch Processing', 'batch', 'Batch job processing and scheduling', 'job-control', 2, 2, TRUE, TRUE),

    ('cics', 'CICS', 'cics', 'Customer Information Control System', 'middleware', 2, 1, TRUE, TRUE),
    ('ims-tm', 'IMS/TM', 'ims-tm', 'IMS Transaction Manager', 'middleware', 2, 2, TRUE, TRUE),
    ('mq', 'MQ Series', 'mq', 'Message queuing middleware', 'middleware', 2, 3, TRUE, TRUE),

    ('utilities', 'System Utilities', 'utilities', 'System utilities and tools', 'operations', 2, 1, TRUE, TRUE),
    ('monitoring', 'Monitoring', 'monitoring', 'System monitoring and performance', 'operations', 2, 2, TRUE, TRUE),
    ('security', 'Security', 'security', 'Security and access control', 'operations', 2, 3, TRUE, TRUE),

    -- Legacy compatibility
    ('functional', 'Functional', 'functional', 'Business functional issues', 'mainframe-root', 1, 6, TRUE, TRUE),
    ('other', 'Other', 'other', 'Miscellaneous issues', 'mainframe-root', 1, 7, TRUE, TRUE);

-- Insert default system tags
INSERT OR IGNORE INTO tags (name, display_name, description, category_id, is_system, is_active) VALUES
    -- Error types
    ('abend', 'Abend', 'Abnormal termination of program', NULL, TRUE, TRUE),
    ('error-code', 'Error Code', 'Specific error codes and messages', NULL, TRUE, TRUE),
    ('timeout', 'Timeout', 'Timeout-related issues', NULL, TRUE, TRUE),
    ('performance', 'Performance', 'Performance-related problems', NULL, TRUE, TRUE),

    -- Severity levels
    ('critical', 'Critical', 'Critical severity issues', NULL, TRUE, TRUE),
    ('high-priority', 'High Priority', 'High priority issues', NULL, TRUE, TRUE),
    ('medium-priority', 'Medium Priority', 'Medium priority issues', NULL, TRUE, TRUE),
    ('low-priority', 'Low Priority', 'Low priority issues', NULL, TRUE, TRUE),

    -- Common terms
    ('file-not-found', 'File Not Found', 'File or dataset not found errors', 'data-systems', TRUE, TRUE),
    ('access-denied', 'Access Denied', 'Permission and access issues', 'security', TRUE, TRUE),
    ('memory-error', 'Memory Error', 'Memory-related errors', NULL, TRUE, TRUE),
    ('configuration', 'Configuration', 'Configuration-related issues', NULL, TRUE, TRUE),

    -- COBOL specific
    ('s0c7', 'S0C7', 'Data exception abend', 'cobol', TRUE, TRUE),
    ('s0c4', 'S0C4', 'Protection exception', 'cobol', TRUE, TRUE),
    ('s013', 'S013', 'Open error abend', 'cobol', TRUE, TRUE),

    -- JCL specific
    ('jcl-error', 'JCL Error', 'JCL syntax and execution errors', 'jcl', TRUE, TRUE),
    ('job-failure', 'Job Failure', 'Job execution failures', 'batch', TRUE, TRUE),

    -- DB2 specific
    ('sqlcode', 'SQLCODE', 'DB2 SQL return codes', 'db2', TRUE, TRUE),
    ('deadlock', 'Deadlock', 'Database deadlock situations', 'db2', TRUE, TRUE),

    -- VSAM specific
    ('vsam-status', 'VSAM Status', 'VSAM file status codes', 'vsam', TRUE, TRUE),

    -- CICS specific
    ('cics-abend', 'CICS Abend', 'CICS transaction abends', 'cics', TRUE, TRUE);

-- ===========================
-- TRIGGERS FOR MAINTENANCE
-- ===========================

-- Update categories.updated_at on changes
CREATE TRIGGER IF NOT EXISTS trg_categories_updated_at
    AFTER UPDATE ON categories
    FOR EACH ROW
BEGIN
    UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update tags.updated_at on changes
CREATE TRIGGER IF NOT EXISTS trg_tags_updated_at
    AFTER UPDATE ON tags
    FOR EACH ROW
BEGIN
    UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update tag usage count when associations are added/removed
CREATE TRIGGER IF NOT EXISTS trg_tag_usage_count_insert
    AFTER INSERT ON tag_associations
    FOR EACH ROW
BEGIN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tag_usage_count_delete
    AFTER DELETE ON tag_associations
    FOR EACH ROW
BEGIN
    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
END;

-- Update category entry count
CREATE TRIGGER IF NOT EXISTS trg_category_entry_count_insert
    AFTER INSERT ON kb_entries
    FOR EACH ROW
    WHEN NEW.category_id IS NOT NULL
BEGIN
    UPDATE categories SET entry_count = entry_count + 1 WHERE id = NEW.category_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_category_entry_count_update
    AFTER UPDATE ON kb_entries
    FOR EACH ROW
BEGIN
    -- Decrease count for old category
    UPDATE categories SET entry_count = entry_count - 1
    WHERE id = OLD.category_id AND OLD.category_id IS NOT NULL;

    -- Increase count for new category
    UPDATE categories SET entry_count = entry_count + 1
    WHERE id = NEW.category_id AND NEW.category_id IS NOT NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_category_entry_count_delete
    AFTER DELETE ON kb_entries
    FOR EACH ROW
    WHEN OLD.category_id IS NOT NULL
BEGIN
    UPDATE categories SET entry_count = entry_count - 1 WHERE id = OLD.category_id;
END;

-- Maintain FTS indexes
CREATE TRIGGER IF NOT EXISTS trg_tags_fts_insert
    AFTER INSERT ON tags
    FOR EACH ROW
BEGIN
    INSERT INTO tags_fts(id, name, display_name, description)
    VALUES(NEW.id, NEW.name, NEW.display_name, NEW.description);
END;

CREATE TRIGGER IF NOT EXISTS trg_tags_fts_update
    AFTER UPDATE ON tags
    FOR EACH ROW
BEGIN
    UPDATE tags_fts SET
        name = NEW.name,
        display_name = NEW.display_name,
        description = NEW.description
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tags_fts_delete
    AFTER DELETE ON tags
    FOR EACH ROW
BEGIN
    DELETE FROM tags_fts WHERE id = OLD.id;
END;

-- Similar triggers for autocomplete_fts
CREATE TRIGGER IF NOT EXISTS trg_autocomplete_fts_insert
    AFTER INSERT ON autocomplete_cache
    FOR EACH ROW
BEGIN
    INSERT INTO autocomplete_fts(id, value, display_value, description)
    VALUES(NEW.id, NEW.value, NEW.display_value, NEW.description);
END;

CREATE TRIGGER IF NOT EXISTS trg_autocomplete_fts_update
    AFTER UPDATE ON autocomplete_cache
    FOR EACH ROW
BEGIN
    UPDATE autocomplete_fts SET
        value = NEW.value,
        display_value = NEW.display_value,
        description = NEW.description
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_autocomplete_fts_delete
    AFTER DELETE ON autocomplete_cache
    FOR EACH ROW
BEGIN
    DELETE FROM autocomplete_fts WHERE id = OLD.id;
END;

-- ===========================
-- VIEWS FOR COMMON QUERIES
-- ===========================

-- Hierarchical category view with full path
CREATE VIEW IF NOT EXISTS v_category_hierarchy AS
WITH RECURSIVE category_path AS (
    -- Base case: root categories
    SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.parent_id,
        c.level,
        c.sort_order,
        c.icon,
        c.color,
        c.is_active,
        c.is_system,
        c.entry_count,
        c.created_at,
        c.updated_at,
        c.created_by,
        c.name as path,
        c.slug as slug_path,
        0 as depth_from_root
    FROM categories c
    WHERE c.parent_id IS NULL

    UNION ALL

    -- Recursive case: child categories
    SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.parent_id,
        c.level,
        c.sort_order,
        c.icon,
        c.color,
        c.is_active,
        c.is_system,
        c.entry_count,
        c.created_at,
        c.updated_at,
        c.created_by,
        cp.path || ' > ' || c.name as path,
        cp.slug_path || '/' || c.slug as slug_path,
        cp.depth_from_root + 1 as depth_from_root
    FROM categories c
    JOIN category_path cp ON c.parent_id = cp.id
)
SELECT * FROM category_path;

-- Category with statistics view
CREATE VIEW IF NOT EXISTS v_category_stats AS
SELECT
    c.*,
    COALESCE(ca.view_count, 0) as view_count,
    COALESCE(ca.search_count, 0) as search_count,
    COALESCE(ca.success_rate, 0) as success_rate,
    ca.avg_resolution_time,
    ca.trend_direction,
    ca.trend_percentage
FROM categories c
LEFT JOIN category_analytics ca ON c.id = ca.category_id;

-- Tag with statistics view
CREATE VIEW IF NOT EXISTS v_tag_stats AS
SELECT
    t.*,
    c.name as category_name,
    c.slug as category_slug,
    COALESCE(ta.trend_direction, 'stable') as trend_direction,
    COALESCE(ta.trend_percentage, 0) as trend_percentage
FROM tags t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN tag_analytics ta ON t.id = ta.tag_id;

-- Entry with full categorization view
CREATE VIEW IF NOT EXISTS v_kb_entries_categorized AS
SELECT
    e.*,
    c.name as category_name,
    c.slug as category_slug,
    c.level as category_level,
    ch.path as category_path,
    ch.slug_path as category_slug_path,
    GROUP_CONCAT(t.display_name, ', ') as tag_names,
    GROUP_CONCAT(t.name, ', ') as tag_values,
    COUNT(DISTINCT ta.tag_id) as tag_count
FROM kb_entries e
LEFT JOIN categories c ON e.category_id = c.id
LEFT JOIN v_category_hierarchy ch ON c.id = ch.id
LEFT JOIN tag_associations ta ON e.id = ta.entry_id
LEFT JOIN tags t ON ta.tag_id = t.id
GROUP BY e.id;

-- ===========================
-- CLEANUP AND OPTIMIZATION
-- ===========================

-- Update entry counts for existing categories
UPDATE categories SET entry_count = (
    SELECT COUNT(*)
    FROM kb_entries
    WHERE kb_entries.category_id = categories.id
);

-- Analyze tables for query optimization
ANALYZE;