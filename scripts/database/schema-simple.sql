-- Simplified PostgreSQL schema without vector extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS incidents_enhanced CASCADE;

-- Enhanced incidents table (without vector embeddings)
CREATE TABLE incidents_enhanced (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    technical_area VARCHAR(50) NOT NULL,
    business_area VARCHAR(50),
    status VARCHAR(20) DEFAULT 'OPEN',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    assigned_to VARCHAR(100),
    reporter VARCHAR(100),
    resolution TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(resolution, ''))
    ) STORED
);

-- Knowledge base table
CREATE TABLE knowledge_base (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category VARCHAR(50),
    tags TEXT[],
    confidence_score DECIMAL(3,2),
    source VARCHAR(100),
    last_used_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, '') || ' ' || array_to_string(tags, ' '))
    ) STORED
);

-- Create indexes
CREATE INDEX idx_incidents_search ON incidents_enhanced USING gin(search_vector);
CREATE INDEX idx_kb_search ON knowledge_base USING gin(search_vector);
CREATE INDEX idx_incidents_status ON incidents_enhanced(status);
CREATE INDEX idx_incidents_priority ON incidents_enhanced(priority);
CREATE INDEX idx_incidents_created ON incidents_enhanced(created_at DESC);
CREATE INDEX idx_kb_category ON knowledge_base(category);
CREATE INDEX idx_kb_created ON knowledge_base(created_at DESC);