-- Migration: Create conversation_summaries table
-- Description: Store compressed summaries for token management

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    summary TEXT NOT NULL,
    message_count INTEGER NOT NULL CHECK (message_count >= 2),
    tokens_saved INTEGER CHECK (tokens_saved >= 0),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Foreign key constraint
    CONSTRAINT fk_conversation_summary
        FOREIGN KEY (conversation_id)
        REFERENCES chat_conversations(id)
        ON DELETE CASCADE
);

-- Create index for summary retrieval
CREATE INDEX IF NOT EXISTS idx_summaries_conversation
ON conversation_summaries(conversation_id, created_at DESC);

-- Unique constraint to prevent duplicate summaries at same timestamp
CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_unique
ON conversation_summaries(conversation_id, created_at);

-- Add comments for documentation
COMMENT ON TABLE conversation_summaries IS 'Stores conversation summaries for token management';
COMMENT ON COLUMN conversation_summaries.id IS 'Unique summary identifier';
COMMENT ON COLUMN conversation_summaries.conversation_id IS 'Links to parent conversation';
COMMENT ON COLUMN conversation_summaries.summary IS 'Compressed conversation summary text';
COMMENT ON COLUMN conversation_summaries.message_count IS 'Number of messages summarized';
COMMENT ON COLUMN conversation_summaries.tokens_saved IS 'Tokens reduced by summarization';