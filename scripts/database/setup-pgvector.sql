-- Setup pgvector for optimized vector search
-- This script creates the pgvector extension and optimizes indexes

-- Create pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Show pgvector version
SELECT extversion AS pgvector_version FROM pg_extension WHERE extname = 'vector';

-- Ensure multi-provider embedding columns exist with proper vector types
DO $$
BEGIN
    -- Check if columns already exist and alter their type if needed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base'
        AND column_name = 'embedding_openai'
        AND data_type = 'vector'
    ) THEN
        -- Add or alter embedding columns
        ALTER TABLE knowledge_base
        ADD COLUMN IF NOT EXISTS embedding_openai vector(1536);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base'
        AND column_name = 'embedding_gemini'
        AND data_type = 'vector'
    ) THEN
        ALTER TABLE knowledge_base
        ADD COLUMN IF NOT EXISTS embedding_gemini vector(768);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base'
        AND column_name = 'embedding_anthropic'
        AND data_type = 'vector'
    ) THEN
        ALTER TABLE knowledge_base
        ADD COLUMN IF NOT EXISTS embedding_anthropic vector(1024);
    END IF;

    -- Add metadata columns if they don't exist
    ALTER TABLE knowledge_base
    ADD COLUMN IF NOT EXISTS embedding_providers TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS primary_embedding_provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
END $$;

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_knowledge_base_embedding_openai;
DROP INDEX IF EXISTS idx_knowledge_base_embedding_gemini;
DROP INDEX IF EXISTS idx_knowledge_base_embedding_anthropic;
DROP INDEX IF EXISTS idx_kb_embedding_openai;
DROP INDEX IF EXISTS idx_kb_embedding_gemini;
DROP INDEX IF EXISTS idx_kb_embedding_anthropic;

-- Create optimized HNSW indexes for vector similarity search
-- HNSW is faster than IVFFlat for most use cases
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_embedding_openai_hnsw
ON knowledge_base USING hnsw (embedding_openai vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding_openai IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_embedding_gemini_hnsw
ON knowledge_base USING hnsw (embedding_gemini vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding_gemini IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_embedding_anthropic_hnsw
ON knowledge_base USING hnsw (embedding_anthropic vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding_anthropic IS NOT NULL;

-- Create indexes for provider metadata
CREATE INDEX IF NOT EXISTS idx_kb_embedding_providers
ON knowledge_base USING GIN (embedding_providers);

CREATE INDEX IF NOT EXISTS idx_kb_primary_provider
ON knowledge_base (primary_embedding_provider)
WHERE primary_embedding_provider IS NOT NULL;

-- Create partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kb_has_openai_embedding
ON knowledge_base (id)
WHERE embedding_openai IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kb_has_gemini_embedding
ON knowledge_base (id)
WHERE embedding_gemini IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kb_has_anthropic_embedding
ON knowledge_base (id)
WHERE embedding_anthropic IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN knowledge_base.embedding_openai IS 'OpenAI text-embedding-ada-002 vectors (1536 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_gemini IS 'Google Gemini embedding-001 vectors (768 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_anthropic IS 'Anthropic embedding vectors (1024 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_providers IS 'Array of providers that have generated embeddings for this entry';
COMMENT ON COLUMN knowledge_base.primary_embedding_provider IS 'Primary provider used for this entry (for fallback logic)';

-- Create helper functions for vector search
CREATE OR REPLACE FUNCTION search_knowledge_base_openai(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.7,
    max_results int DEFAULT 10
)
RETURNS TABLE(
    id int,
    title text,
    content text,
    summary text,
    category varchar,
    similarity float
)
LANGUAGE sql
AS $$
    SELECT
        id,
        title,
        content,
        summary,
        category,
        1 - (embedding_openai <=> query_embedding) as similarity
    FROM knowledge_base
    WHERE embedding_openai IS NOT NULL
        AND (1 - (embedding_openai <=> query_embedding)) >= similarity_threshold
    ORDER BY embedding_openai <=> query_embedding
    LIMIT max_results;
$$;

CREATE OR REPLACE FUNCTION search_knowledge_base_gemini(
    query_embedding vector(768),
    similarity_threshold float DEFAULT 0.7,
    max_results int DEFAULT 10
)
RETURNS TABLE(
    id int,
    title text,
    content text,
    summary text,
    category varchar,
    similarity float
)
LANGUAGE sql
AS $$
    SELECT
        id,
        title,
        content,
        summary,
        category,
        1 - (embedding_gemini <=> query_embedding) as similarity
    FROM knowledge_base
    WHERE embedding_gemini IS NOT NULL
        AND (1 - (embedding_gemini <=> query_embedding)) >= similarity_threshold
    ORDER BY embedding_gemini <=> query_embedding
    LIMIT max_results;
$$;

-- Analyze tables to update statistics
ANALYZE knowledge_base;

-- Show statistics
SELECT
    'Statistics' as info_type,
    COUNT(*) as total_docs,
    COUNT(embedding_openai) as openai_embeddings,
    COUNT(embedding_gemini) as gemini_embeddings,
    COUNT(embedding_anthropic) as anthropic_embeddings,
    pg_size_pretty(pg_total_relation_size('knowledge_base')) as table_size
FROM knowledge_base;

-- Show index information
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename = 'knowledge_base'
AND indexname LIKE '%embedding%'
ORDER BY indexname;

-- Test vector operations
DO $$
BEGIN
    -- Test if vector operations work
    PERFORM '[1,2,3]'::vector <=> '[3,2,1]'::vector;
    RAISE NOTICE 'pgvector is working correctly!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'pgvector test failed: %', SQLERRM;
END $$;