-- Migration: Add vector columns to knowledge_base table
-- Description: Enable vector similarity search for multiple LLM providers

-- First, ensure pgvector extension is installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector columns for different embedding models
-- Only add columns if they don't already exist
DO $$
BEGIN
    -- Add OpenAI embedding column (1536 dimensions for text-embedding-3-small)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base' AND column_name = 'embedding_openai'
    ) THEN
        ALTER TABLE knowledge_base
        ADD COLUMN embedding_openai vector(1536);
    END IF;

    -- Add Gemini embedding column (768 dimensions for embedding-001)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base' AND column_name = 'embedding_gemini'
    ) THEN
        ALTER TABLE knowledge_base
        ADD COLUMN embedding_gemini vector(768);
    END IF;

    -- Add embedding metadata column for storing model info and generation details
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base' AND column_name = 'embedding_metadata'
    ) THEN
        ALTER TABLE knowledge_base
        ADD COLUMN embedding_metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add last_embedded_at timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_base' AND column_name = 'last_embedded_at'
    ) THEN
        ALTER TABLE knowledge_base
        ADD COLUMN last_embedded_at TIMESTAMP;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN knowledge_base.embedding_openai IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_gemini IS 'Google Gemini embedding-001 vector (768 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_metadata IS 'Metadata about embedding generation (model version, timestamp, etc.)';
COMMENT ON COLUMN knowledge_base.last_embedded_at IS 'Timestamp of last embedding generation';