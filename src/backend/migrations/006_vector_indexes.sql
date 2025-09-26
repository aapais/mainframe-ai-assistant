-- Migration: Create HNSW indexes for vector similarity search
-- Description: Optimize vector similarity search performance with HNSW indexes

-- Create HNSW index for OpenAI embeddings
-- Using cosine distance for similarity (most common for text embeddings)
CREATE INDEX IF NOT EXISTS idx_kb_embedding_openai
ON knowledge_base
USING hnsw (embedding_openai vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding_openai IS NOT NULL;

-- Create HNSW index for Gemini embeddings
CREATE INDEX IF NOT EXISTS idx_kb_embedding_gemini
ON knowledge_base
USING hnsw (embedding_gemini vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE embedding_gemini IS NOT NULL;

-- Create partial index for recently updated entries (for incremental embedding generation)
CREATE INDEX IF NOT EXISTS idx_kb_needs_embedding
ON knowledge_base(updated_at)
WHERE (embedding_openai IS NULL OR embedding_gemini IS NULL)
  AND content IS NOT NULL
  AND content != '';

-- Create index for faster embedding metadata queries
CREATE INDEX IF NOT EXISTS idx_kb_embedding_metadata
ON knowledge_base USING gin (embedding_metadata)
WHERE embedding_metadata IS NOT NULL;

-- Add function for vector similarity search
CREATE OR REPLACE FUNCTION search_knowledge_base_openai(
    query_embedding vector(1536),
    match_limit INTEGER DEFAULT 5,
    min_score FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    title VARCHAR(500),
    relevance_score FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.content,
        kb.title,
        1 - (kb.embedding_openai <=> query_embedding) AS relevance_score,
        kb.metadata
    FROM knowledge_base kb
    WHERE kb.embedding_openai IS NOT NULL
    ORDER BY kb.embedding_openai <=> query_embedding
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- Add function for Gemini vector similarity search
CREATE OR REPLACE FUNCTION search_knowledge_base_gemini(
    query_embedding vector(768),
    match_limit INTEGER DEFAULT 5,
    min_score FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    title VARCHAR(500),
    relevance_score FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.content,
        kb.title,
        1 - (kb.embedding_gemini <=> query_embedding) AS relevance_score,
        kb.metadata
    FROM knowledge_base kb
    WHERE kb.embedding_gemini IS NOT NULL
    ORDER BY kb.embedding_gemini <=> query_embedding
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON INDEX idx_kb_embedding_openai IS 'HNSW index for OpenAI embedding similarity search';
COMMENT ON INDEX idx_kb_embedding_gemini IS 'HNSW index for Gemini embedding similarity search';
COMMENT ON INDEX idx_kb_needs_embedding IS 'Index for finding entries that need embedding generation';
COMMENT ON FUNCTION search_knowledge_base_openai IS 'Performs vector similarity search using OpenAI embeddings';
COMMENT ON FUNCTION search_knowledge_base_gemini IS 'Performs vector similarity search using Gemini embeddings';