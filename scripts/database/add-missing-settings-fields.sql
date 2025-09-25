-- Add missing fields for Advanced Settings persistence
-- Run this script to update the user_settings table with additional fields

-- API Configuration fields
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS api_rate_limit INTEGER DEFAULT 60;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS api_timeout INTEGER DEFAULT 30;

-- Security Configuration fields
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS force_https BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS enable_audit_trail BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS session_timeout INTEGER DEFAULT 30;

-- Developer Options fields
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS debug_mode BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS verbose_console BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS enable_devtools BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.api_rate_limit IS 'API rate limit in requests per minute';
COMMENT ON COLUMN user_settings.api_timeout IS 'API request timeout in seconds';
COMMENT ON COLUMN user_settings.force_https IS 'Force HTTPS connections for all API calls';
COMMENT ON COLUMN user_settings.enable_audit_trail IS 'Enable audit trail logging for all user actions';
COMMENT ON COLUMN user_settings.session_timeout IS 'Session timeout in minutes';
COMMENT ON COLUMN user_settings.debug_mode IS 'Enable debug mode for troubleshooting';
COMMENT ON COLUMN user_settings.verbose_console IS 'Enable verbose console output';
COMMENT ON COLUMN user_settings.enable_devtools IS 'Enable developer tools access';