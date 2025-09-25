-- Fix script for user settings persistence
-- This script ensures proper table structure for settings persistence

-- First, check if user_preferences table exists (preferred new schema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public'
                   AND table_name = 'user_preferences') THEN

        -- Create user_preferences table (new schema without foreign key)
        CREATE TABLE user_preferences (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) UNIQUE NOT NULL,  -- String ID from auth, with UNIQUE constraint
            theme VARCHAR(20) DEFAULT 'light',
            language VARCHAR(10) DEFAULT 'pt-BR',
            notifications BOOLEAN DEFAULT true,
            auto_login BOOLEAN DEFAULT true,
            session_timeout INTEGER DEFAULT 28800,
            settings_json JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

        RAISE NOTICE 'Created user_preferences table successfully';
    ELSE
        -- Ensure user_id column has UNIQUE constraint
        ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_key;
        ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_key UNIQUE(user_id);
        RAISE NOTICE 'user_preferences table already exists, ensured UNIQUE constraint';
    END IF;
END $$;

-- Create or update the trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Test data (optional)
-- INSERT INTO user_preferences (user_id, theme, language)
-- VALUES ('test-user-123', 'dark', 'en-US')
-- ON CONFLICT (user_id) DO UPDATE
-- SET theme = EXCLUDED.theme,
--     language = EXCLUDED.language,
--     updated_at = CURRENT_TIMESTAMP;

-- Display the table structure
\d user_preferences