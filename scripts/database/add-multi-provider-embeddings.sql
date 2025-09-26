-- Add Multiple Provider Embeddings Support
-- This script adds separate embedding columns for each provider
-- to avoid incompatibility issues and enable multi-provider coexistence

BEGIN;

-- Add new embedding columns for each provider
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS embedding_openai vector(1536),
ADD COLUMN IF NOT EXISTS embedding_gemini vector(768),
ADD COLUMN IF NOT EXISTS embedding_anthropic vector(1024);

-- Add metadata columns to track embedding info
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS embedding_providers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS primary_embedding_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Migrate existing embeddings to OpenAI column (if they exist and are 1536D)
UPDATE knowledge_base
SET embedding_openai = embedding,
    embedding_providers = ARRAY['openai'],
    primary_embedding_provider = 'openai'
WHERE embedding IS NOT NULL
AND array_length(embedding, 1) = 1536;

-- Create indexes for efficient similarity search on each provider
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_embedding_openai
ON knowledge_base USING ivfflat (embedding_openai vector_cosine_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_embedding_gemini
ON knowledge_base USING ivfflat (embedding_gemini vector_cosine_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_embedding_anthropic
ON knowledge_base USING ivfflat (embedding_anthropic vector_cosine_ops);

-- Create index for efficient filtering by provider
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_providers
ON knowledge_base USING GIN (embedding_providers);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_primary_provider
ON knowledge_base (primary_embedding_provider);

-- Add comments for documentation
COMMENT ON COLUMN knowledge_base.embedding_openai IS 'OpenAI text-embedding-ada-002 vectors (1536 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_gemini IS 'Google Gemini embedding-001 vectors (768 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_anthropic IS 'Anthropic embedding vectors (1024 dimensions)';
COMMENT ON COLUMN knowledge_base.embedding_providers IS 'Array of providers that have generated embeddings for this entry';
COMMENT ON COLUMN knowledge_base.primary_embedding_provider IS 'Primary provider used for this entry (for fallback logic)';

COMMIT;

-- Display results
SELECT
    COUNT(*) as total_entries,
    COUNT(embedding_openai) as openai_embeddings,
    COUNT(embedding_gemini) as gemini_embeddings,
    COUNT(embedding_anthropic) as anthropic_embeddings,
    array_agg(DISTINCT primary_embedding_provider) as providers_used
FROM knowledge_base;