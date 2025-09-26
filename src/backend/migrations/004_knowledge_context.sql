-- Migration: Create knowledge_context table
-- Description: Store retrieved knowledge base entries used for RAG responses

CREATE TABLE IF NOT EXISTS knowledge_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    knowledge_id INTEGER,
    relevance_score FLOAT NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
    chunk_text TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),

    -- Foreign key constraints
    CONSTRAINT fk_message
        FOREIGN KEY (message_id)
        REFERENCES chat_messages(id)
        ON DELETE CASCADE
);

-- Note: knowledge_id references knowledge_base table which should already exist
-- If it doesn't exist, this constraint will be added separately
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_base') THEN
        -- Check if constraint already exists before adding
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_knowledge'
        ) THEN
            ALTER TABLE knowledge_context
            ADD CONSTRAINT fk_knowledge
            FOREIGN KEY (knowledge_id)
            REFERENCES knowledge_base(id)
            ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_context_message
ON knowledge_context(message_id, relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_context_knowledge
ON knowledge_context(knowledge_id) WHERE knowledge_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE knowledge_context IS 'Links messages to retrieved knowledge base entries';
COMMENT ON COLUMN knowledge_context.id IS 'Unique context identifier';
COMMENT ON COLUMN knowledge_context.message_id IS 'Links to chat message';
COMMENT ON COLUMN knowledge_context.knowledge_id IS 'Links to knowledge base entry';
COMMENT ON COLUMN knowledge_context.relevance_score IS 'Similarity score (0-1)';
COMMENT ON COLUMN knowledge_context.chunk_text IS 'Retrieved text chunk';
COMMENT ON COLUMN knowledge_context.metadata IS 'Additional context metadata';