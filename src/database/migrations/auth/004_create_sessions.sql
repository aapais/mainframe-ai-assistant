-- UP
-- Migration: Create Session Management Tables with TTL and Cleanup
-- Version: 004
-- Generated: 2024-09-24T13:05:00.000Z

-- Create session storage table
CREATE TABLE sso_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_token TEXT UNIQUE NOT NULL, -- Hashed session token
    session_id TEXT UNIQUE NOT NULL, -- Public session ID

    -- User and device information
    user_id TEXT NOT NULL,
    device_id TEXT, -- Device fingerprint/ID
    device_name TEXT,
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'tv', 'watch', 'other')),

    -- Browser/client information
    user_agent TEXT,
    browser_name TEXT,
    browser_version TEXT,
    os_name TEXT,
    os_version TEXT,
    is_mobile BOOLEAN DEFAULT FALSE,
    is_bot BOOLEAN DEFAULT FALSE,

    -- Network information
    ip_address TEXT NOT NULL,
    ip_country TEXT,
    ip_region TEXT,
    ip_city TEXT,
    ip_isp TEXT,

    -- Authentication method
    auth_method TEXT NOT NULL CHECK (auth_method IN ('password', 'sso', 'api_key', 'token', 'mfa')),
    provider_id TEXT, -- SSO provider used

    -- Session data
    session_data TEXT DEFAULT '{}', -- JSON session data

    -- Security flags
    is_trusted_device BOOLEAN DEFAULT FALSE,
    is_elevated BOOLEAN DEFAULT FALSE, -- Elevated privileges session
    requires_mfa BOOLEAN DEFAULT FALSE,
    mfa_verified BOOLEAN DEFAULT FALSE,

    -- Session lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'invalid')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,

    -- Termination info
    terminated_at DATETIME,
    terminated_by TEXT,
    termination_reason TEXT CHECK (termination_reason IN ('logout', 'timeout', 'admin', 'security', 'expired', 'replaced')),

    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES sso_providers (id) ON DELETE SET NULL
);

-- Create refresh tokens table
CREATE TABLE sso_refresh_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    token_hash TEXT UNIQUE NOT NULL, -- Hashed refresh token
    session_id TEXT NOT NULL,

    -- Token lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked', 'expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_used DATETIME,

    -- Usage tracking
    use_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT -1, -- -1 for unlimited

    -- Revocation info
    revoked_at DATETIME,
    revoked_by TEXT,
    revocation_reason TEXT,

    FOREIGN KEY (session_id) REFERENCES sso_sessions (id) ON DELETE CASCADE
);

-- Create access tokens table (JWT/Bearer tokens)
CREATE TABLE sso_access_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    token_hash TEXT UNIQUE NOT NULL, -- Hashed access token
    jti TEXT UNIQUE, -- JWT ID for JWT tokens
    session_id TEXT NOT NULL,

    -- Token metadata
    token_type TEXT DEFAULT 'bearer' CHECK (token_type IN ('bearer', 'jwt', 'mac')),
    scopes TEXT, -- JSON array of granted scopes
    audience TEXT, -- Intended audience

    -- Token lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_used DATETIME,

    -- Usage tracking
    use_count INTEGER DEFAULT 0,

    -- Revocation info
    revoked_at DATETIME,
    revoked_by TEXT,
    revocation_reason TEXT,

    FOREIGN KEY (session_id) REFERENCES sso_sessions (id) ON DELETE CASCADE
);

-- Create device trust table
CREATE TABLE sso_trusted_devices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_fingerprint TEXT, -- Browser/device fingerprint

    -- Trust information
    trust_level INTEGER DEFAULT 1 CHECK (trust_level BETWEEN 1 AND 5), -- 1=basic, 5=fully trusted
    trust_score REAL DEFAULT 0.0 CHECK (trust_score BETWEEN 0.0 AND 1.0),

    -- Device details
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    seen_count INTEGER DEFAULT 1,

    -- Geographic information
    usual_locations TEXT DEFAULT '[]', -- JSON array of usual IP ranges
    current_location TEXT, -- Current IP/location

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_at DATETIME,
    blocked_reason TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE,
    UNIQUE (user_id, device_id)
);

-- Create session activity log
CREATE TABLE sso_session_activities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT NOT NULL,

    -- Activity information
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'login', 'logout', 'refresh', 'access', 'mfa_challenge',
        'mfa_success', 'mfa_failure', 'permission_check', 'error'
    )),
    resource TEXT, -- Resource accessed
    action TEXT, -- Action performed

    -- Result information
    success BOOLEAN DEFAULT TRUE,
    error_code TEXT,
    error_message TEXT,

    -- Request information
    ip_address TEXT,
    user_agent TEXT,

    -- Response information
    response_time_ms INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES sso_sessions (id) ON DELETE CASCADE
);

-- Create concurrent session limits table
CREATE TABLE sso_session_limits (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT UNIQUE NOT NULL,

    -- Limits
    max_concurrent_sessions INTEGER DEFAULT 5,
    max_sessions_per_device INTEGER DEFAULT 3,
    max_session_duration_minutes INTEGER DEFAULT 1440, -- 24 hours
    max_idle_time_minutes INTEGER DEFAULT 120, -- 2 hours

    -- Enforcement
    enforce_single_session BOOLEAN DEFAULT FALSE,
    allow_session_sharing BOOLEAN DEFAULT FALSE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE
);

-- Create indexes for performance and cleanup
CREATE INDEX idx_sso_sessions_user_id ON sso_sessions (user_id);
CREATE INDEX idx_sso_sessions_session_token ON sso_sessions (session_token);
CREATE INDEX idx_sso_sessions_status ON sso_sessions (status);
CREATE INDEX idx_sso_sessions_expires_at ON sso_sessions (expires_at);
CREATE INDEX idx_sso_sessions_last_activity ON sso_sessions (last_activity);
CREATE INDEX idx_sso_sessions_ip_address ON sso_sessions (ip_address);
CREATE INDEX idx_sso_sessions_device_id ON sso_sessions (device_id);

CREATE INDEX idx_sso_refresh_tokens_token_hash ON sso_refresh_tokens (token_hash);
CREATE INDEX idx_sso_refresh_tokens_session_id ON sso_refresh_tokens (session_id);
CREATE INDEX idx_sso_refresh_tokens_status ON sso_refresh_tokens (status);
CREATE INDEX idx_sso_refresh_tokens_expires_at ON sso_refresh_tokens (expires_at);

CREATE INDEX idx_sso_access_tokens_token_hash ON sso_access_tokens (token_hash);
CREATE INDEX idx_sso_access_tokens_jti ON sso_access_tokens (jti);
CREATE INDEX idx_sso_access_tokens_session_id ON sso_access_tokens (session_id);
CREATE INDEX idx_sso_access_tokens_status ON sso_access_tokens (status);
CREATE INDEX idx_sso_access_tokens_expires_at ON sso_access_tokens (expires_at);

CREATE INDEX idx_sso_trusted_devices_user_id ON sso_trusted_devices (user_id);
CREATE INDEX idx_sso_trusted_devices_device_id ON sso_trusted_devices (device_id);
CREATE INDEX idx_sso_trusted_devices_last_seen ON sso_trusted_devices (last_seen);
CREATE INDEX idx_sso_trusted_devices_active ON sso_trusted_devices (is_active);

CREATE INDEX idx_sso_session_activities_session_id ON sso_session_activities (session_id);
CREATE INDEX idx_sso_session_activities_activity_type ON sso_session_activities (activity_type);
CREATE INDEX idx_sso_session_activities_created_at ON sso_session_activities (created_at);
CREATE INDEX idx_sso_session_activities_success ON sso_session_activities (success);

CREATE INDEX idx_sso_session_limits_user_id ON sso_session_limits (user_id);

-- Create cleanup job tracking table
CREATE TABLE sso_cleanup_jobs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    job_type TEXT NOT NULL CHECK (job_type IN ('sessions', 'tokens', 'activities', 'full')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    -- Statistics
    records_processed INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,

    -- Timing
    started_at DATETIME,
    completed_at DATETIME,
    duration_ms INTEGER,

    -- Configuration
    cleanup_before_date DATETIME,
    dry_run BOOLEAN DEFAULT FALSE,

    -- Results
    result_message TEXT,
    error_message TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
-- Rollback for: Create Session Management Tables with TTL and Cleanup

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_session_limits_user_id;
DROP INDEX IF EXISTS idx_sso_session_activities_success;
DROP INDEX IF EXISTS idx_sso_session_activities_created_at;
DROP INDEX IF EXISTS idx_sso_session_activities_activity_type;
DROP INDEX IF EXISTS idx_sso_session_activities_session_id;
DROP INDEX IF EXISTS idx_sso_trusted_devices_active;
DROP INDEX IF EXISTS idx_sso_trusted_devices_last_seen;
DROP INDEX IF EXISTS idx_sso_trusted_devices_device_id;
DROP INDEX IF EXISTS idx_sso_trusted_devices_user_id;
DROP INDEX IF EXISTS idx_sso_access_tokens_expires_at;
DROP INDEX IF EXISTS idx_sso_access_tokens_status;
DROP INDEX IF EXISTS idx_sso_access_tokens_session_id;
DROP INDEX IF EXISTS idx_sso_access_tokens_jti;
DROP INDEX IF EXISTS idx_sso_access_tokens_token_hash;
DROP INDEX IF EXISTS idx_sso_refresh_tokens_expires_at;
DROP INDEX IF EXISTS idx_sso_refresh_tokens_status;
DROP INDEX IF EXISTS idx_sso_refresh_tokens_session_id;
DROP INDEX IF EXISTS idx_sso_refresh_tokens_token_hash;
DROP INDEX IF EXISTS idx_sso_sessions_device_id;
DROP INDEX IF EXISTS idx_sso_sessions_ip_address;
DROP INDEX IF EXISTS idx_sso_sessions_last_activity;
DROP INDEX IF EXISTS idx_sso_sessions_expires_at;
DROP INDEX IF EXISTS idx_sso_sessions_status;
DROP INDEX IF EXISTS idx_sso_sessions_session_token;
DROP INDEX IF EXISTS idx_sso_sessions_user_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_cleanup_jobs;
DROP TABLE IF EXISTS sso_session_limits;
DROP TABLE IF EXISTS sso_session_activities;
DROP TABLE IF EXISTS sso_trusted_devices;
DROP TABLE IF EXISTS sso_access_tokens;
DROP TABLE IF EXISTS sso_refresh_tokens;
DROP TABLE IF EXISTS sso_sessions;