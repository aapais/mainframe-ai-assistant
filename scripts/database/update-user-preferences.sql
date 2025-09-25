-- Update user_preferences table to include display_name and email columns
-- This ensures user profile data persists across sessions

-- Add display_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'user_preferences'
                   AND column_name = 'display_name') THEN
        ALTER TABLE user_preferences ADD COLUMN display_name VARCHAR(255);
    END IF;
END $$;

-- Add email column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'user_preferences'
                   AND column_name = 'email') THEN
        ALTER TABLE user_preferences ADD COLUMN email VARCHAR(255);
    END IF;
END $$;

-- Show the updated table structure
\d user_preferences