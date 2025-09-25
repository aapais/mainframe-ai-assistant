-- User Settings Schema for Mainframe AI Assistant
-- Stores user preferences that persist between sessions

-- Drop existing table if exists
DROP TABLE IF EXISTS user_settings CASCADE;

-- Create user_settings table
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Theme settings
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),

    -- Language/Locale settings
    language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'pt', 'es')),
    locale VARCHAR(10) DEFAULT 'en-US',

    -- Display settings
    display_density VARCHAR(20) DEFAULT 'normal' CHECK (display_density IN ('compact', 'normal', 'comfortable')),
    sidebar_collapsed BOOLEAN DEFAULT false,
    show_line_numbers BOOLEAN DEFAULT true,
    font_size INTEGER DEFAULT 14 CHECK (font_size BETWEEN 10 AND 24),

    -- Notification preferences (JSON)
    notifications JSONB DEFAULT '{
        "email": true,
        "desktop": true,
        "sound": true,
        "incident_updates": true,
        "system_alerts": true,
        "mentions": true
    }'::jsonb,

    -- Search & History
    recent_searches_limit INTEGER DEFAULT 10 CHECK (recent_searches_limit BETWEEN 5 AND 50),
    search_history_enabled BOOLEAN DEFAULT true,

    -- Auto-save & Export
    auto_save BOOLEAN DEFAULT true,
    auto_save_interval INTEGER DEFAULT 30, -- seconds
    export_format VARCHAR(10) DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'xml')),

    -- API Keys (encrypted)
    api_keys JSONB DEFAULT '{}'::jsonb, -- Will store encrypted keys

    -- Advanced settings
    enable_shortcuts BOOLEAN DEFAULT true,
    keyboard_shortcuts JSONB DEFAULT '{
        "search": "Ctrl+K",
        "newIncident": "Ctrl+N",
        "settings": "Ctrl+,",
        "help": "F1"
    }'::jsonb,

    -- Performance
    enable_animations BOOLEAN DEFAULT true,
    cache_enabled BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint to ensure one settings record per user
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create default settings for a user
CREATE OR REPLACE FUNCTION get_or_create_user_settings(p_user_id INTEGER)
RETURNS SETOF user_settings AS $$
BEGIN
    -- Try to get existing settings
    IF EXISTS (SELECT 1 FROM user_settings WHERE user_id = p_user_id) THEN
        RETURN QUERY SELECT * FROM user_settings WHERE user_id = p_user_id;
    ELSE
        -- Create default settings for new user
        RETURN QUERY
        INSERT INTO user_settings (user_id)
        VALUES (p_user_id)
        RETURNING *;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Sample insert for testing (will be created automatically on first login)
-- INSERT INTO user_settings (user_id) VALUES (1);