-- Table for storing document chunks with individual embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_metadata JSONB,

    -- Multi-provider embeddings for each chunk
    embedding_openai vector(1536),
    embedding_gemini vector(768),
    embedding_anthropic vector(1024),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint to prevent duplicate chunks
    UNIQUE(document_id, chunk_index)
);

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON document_chunks(chunk_index);

-- HNSW indexes for vector similarity search on chunks
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_openai_hnsw
    ON document_chunks USING hnsw (embedding_openai vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_gemini_hnsw
    ON document_chunks USING hnsw (embedding_gemini vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_anthropic_hnsw
    ON document_chunks USING hnsw (embedding_anthropic vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Add column to knowledge_base to track if document has chunks
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS has_chunks BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;