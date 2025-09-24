-- Knowledge Base Database Schema
-- Creates the knowledge_base table with proper constraints and indexes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category VARCHAR(100) DEFAULT 'General',
    tags TEXT[] DEFAULT '{}',
    confidence_score DECIMAL(3,2) DEFAULT 0.9,
    source VARCHAR(255) DEFAULT 'manual',
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Full-text search vector
    search_vector tsvector,

    -- Vector embedding (if pgvector is available)
    embedding vector(1536)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_uuid ON knowledge_base(uuid);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_kb_created_at ON knowledge_base(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_search_vector ON knowledge_base USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_kb_tags ON knowledge_base USING gin(tags);

-- Create index for vector similarity search (if pgvector is available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        CREATE INDEX IF NOT EXISTS idx_kb_embedding ON knowledge_base
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    END IF;
END $$;

-- Function to automatically update search_vector
CREATE OR REPLACE FUNCTION update_kb_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'B') ||
        setweight(to_tsvector('portuguese', coalesce(NEW.summary, '')), 'C') ||
        setweight(to_tsvector('portuguese', array_to_string(NEW.tags, ' ')), 'D');

    NEW.updated_at := CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector
DROP TRIGGER IF EXISTS trigger_update_kb_search_vector ON knowledge_base;
CREATE TRIGGER trigger_update_kb_search_vector
    BEFORE INSERT OR UPDATE ON knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_kb_search_vector();

-- Create sample categories
INSERT INTO knowledge_base (title, content, summary, category, tags, source, created_by) VALUES
    ('Conhecimento Base - Introdução',
     'Este é o sistema de base de conhecimento do Mainframe AI Assistant. Aqui você encontrará documentação, procedimentos e soluções para problemas comuns.',
     'Introdução ao sistema de base de conhecimento',
     'Sistema',
     ARRAY['introdução', 'sistema', 'documentação'],
     'system',
     'system'
    ),
    ('Processamento de Documentos',
     'O sistema suporta upload e processamento automático de documentos em vários formatos incluindo PDF, Word, Excel, PowerPoint e outros. Os documentos são automaticamente processados e indexados na base de conhecimento.',
     'Funcionalidade de processamento automático de documentos',
     'Funcionalidades',
     ARRAY['documentos', 'upload', 'processamento', 'automático'],
     'system',
     'system'
    )
ON CONFLICT (uuid) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_base TO mainframe_user;
GRANT USAGE, SELECT ON SEQUENCE knowledge_base_id_seq TO mainframe_user;