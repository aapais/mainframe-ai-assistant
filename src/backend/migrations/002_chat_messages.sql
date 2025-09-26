-- Migration: Create chat_messages table
-- Description: Store individual messages within conversations

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model_id VARCHAR(100),
    tokens_used INTEGER CHECK (tokens_used >= 0),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Foreign key constraint
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES chat_conversations(id)
        ON DELETE CASCADE
);

-- Create index for message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON chat_messages(conversation_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat conversations';
COMMENT ON COLUMN chat_messages.id IS 'Unique message identifier';
COMMENT ON COLUMN chat_messages.conversation_id IS 'Links to parent conversation';
COMMENT ON COLUMN chat_messages.role IS 'Message sender type: user, assistant, or system';
COMMENT ON COLUMN chat_messages.content IS 'Message text content';
COMMENT ON COLUMN chat_messages.model_id IS 'Model used for assistant responses';
COMMENT ON COLUMN chat_messages.tokens_used IS 'Token count for this message';