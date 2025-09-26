-- Migration: Create chat_conversations table
-- Description: Store chat conversation sessions with user context and model selection

CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    model_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user
ON chat_conversations(user_id, updated_at DESC);

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON chat_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE chat_conversations IS 'Stores chat conversation sessions with model selection and user context';
COMMENT ON COLUMN chat_conversations.id IS 'Unique conversation identifier';
COMMENT ON COLUMN chat_conversations.user_id IS 'User identifier from authentication system';
COMMENT ON COLUMN chat_conversations.title IS 'Auto-generated or user-defined conversation title';
COMMENT ON COLUMN chat_conversations.model_id IS 'Currently selected LLM model identifier';