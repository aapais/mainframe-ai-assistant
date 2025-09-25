-- UP
-- Migration: Create Encrypted API Keys Storage and Management
-- Version: 003
-- Generated: 2024-09-24T13:05:00.000Z

-- Create API key types/scopes
CREATE TABLE sso_api_key_types (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    default_permissions TEXT NOT NULL, -- JSON array of permissions
    max_rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    default_expires_days INTEGER DEFAULT 365,
    is_system_type BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create API keys table with encryption support
CREATE TABLE sso_api_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    key_hash TEXT UNIQUE NOT NULL, -- SHA-256 hash of the actual key
    key_prefix TEXT NOT NULL, -- First 8 chars for identification (ak_12345678...)

    -- Key metadata
    name TEXT NOT NULL,
    description TEXT,
    key_type_id TEXT NOT NULL,

    -- Ownership and access
    user_id TEXT,
    service_id TEXT, -- For service-to-service authentication
    client_id TEXT, -- For client applications

    -- Permissions and scopes
    permissions TEXT NOT NULL, -- JSON array of specific permissions
    scopes TEXT, -- JSON array of OAuth-like scopes
    allowed_ips TEXT, -- JSON array of allowed IP addresses/ranges
    allowed_domains TEXT, -- JSON array of allowed domains

    -- Rate limiting
    rate_limit INTEGER, -- Requests per hour (overrides type default)
    current_usage INTEGER DEFAULT 0,
    usage_reset_at DATETIME,

    -- Key rotation and lifecycle
    version INTEGER DEFAULT 1,
    previous_key_hash TEXT, -- For key rotation
    rotation_schedule TEXT, -- Cron expression for auto-rotation

    -- Security settings
    is_encrypted BOOLEAN DEFAULT TRUE,
    encryption_key_id TEXT, -- Reference to encryption key used
    require_https BOOLEAN DEFAULT TRUE,
    require_client_cert BOOLEAN DEFAULT FALSE,

    -- Status and lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked', 'expired', 'rotating')),
    is_read_only BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    expires_at DATETIME,
    revoked_at DATETIME,
    revoked_by TEXT,
    revocation_reason TEXT,

    -- Audit fields
    created_by TEXT,
    updated_by TEXT,

    FOREIGN KEY (key_type_id) REFERENCES sso_api_key_types (id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE,
    FOREIGN KEY (previous_key_hash) REFERENCES sso_api_keys (key_hash) ON DELETE SET NULL
);

-- Create API key usage logs
CREATE TABLE sso_api_key_usage_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    api_key_id TEXT NOT NULL,

    -- Request information
    method TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT NOT NULL,

    -- Response information
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    bytes_sent INTEGER DEFAULT 0,
    bytes_received INTEGER DEFAULT 0,

    -- Error tracking
    error_code TEXT,
    error_message TEXT,

    -- Rate limiting
    rate_limit_hit BOOLEAN DEFAULT FALSE,
    rate_limit_remaining INTEGER,

    -- Geolocation (optional)
    country TEXT,
    region TEXT,
    city TEXT,

    -- Timestamp
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (api_key_id) REFERENCES sso_api_keys (id) ON DELETE CASCADE
);

-- Create API key rotation history
CREATE TABLE sso_api_key_rotation_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    api_key_id TEXT NOT NULL,
    old_key_hash TEXT NOT NULL,
    new_key_hash TEXT NOT NULL,
    rotation_type TEXT NOT NULL CHECK (rotation_type IN ('manual', 'scheduled', 'forced', 'compromised')),
    rotation_reason TEXT,
    rotated_by TEXT,
    rotated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (api_key_id) REFERENCES sso_api_keys (id) ON DELETE CASCADE
);

-- Create service accounts table for API keys
CREATE TABLE sso_service_accounts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    service_type TEXT DEFAULT 'application' CHECK (service_type IN ('application', 'service', 'integration', 'webhook')),

    -- Contact information
    owner_email TEXT,
    team_name TEXT,

    -- Configuration
    allowed_key_types TEXT, -- JSON array of allowed key types
    max_keys INTEGER DEFAULT 5,
    default_permissions TEXT, -- JSON array of default permissions

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT
);

-- Create client applications table
CREATE TABLE sso_client_applications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    client_id TEXT UNIQUE NOT NULL,
    client_secret_hash TEXT, -- Hashed client secret
    name TEXT NOT NULL,
    description TEXT,

    -- Application metadata
    app_type TEXT DEFAULT 'web' CHECK (app_type IN ('web', 'mobile', 'desktop', 'service', 'spa')),
    homepage_url TEXT,
    callback_urls TEXT, -- JSON array of valid callback URLs
    allowed_origins TEXT, -- JSON array for CORS

    -- OAuth2/OIDC settings
    grant_types TEXT DEFAULT '["authorization_code"]', -- JSON array
    response_types TEXT DEFAULT '["code"]', -- JSON array
    scopes TEXT DEFAULT '["openid"]', -- JSON array

    -- Security settings
    require_pkce BOOLEAN DEFAULT TRUE,
    require_client_secret BOOLEAN DEFAULT TRUE,
    token_endpoint_auth_method TEXT DEFAULT 'client_secret_basic',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_confidential BOOLEAN DEFAULT TRUE, -- vs public client

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT
);

-- Insert default API key types
INSERT INTO sso_api_key_types (name, display_name, description, default_permissions, max_rate_limit, is_system_type) VALUES
('admin', 'Administrator Key', 'Full administrative access', '["*"]', 10000, TRUE),
('service', 'Service Key', 'Service-to-service authentication', '["api:read", "api:write"]', 5000, TRUE),
('integration', 'Integration Key', 'Third-party integrations', '["api:read", "webhook:receive"]', 2000, TRUE),
('readonly', 'Read-Only Key', 'Read-only access to APIs', '["api:read"]', 1000, TRUE),
('webhook', 'Webhook Key', 'Webhook endpoints only', '["webhook:receive"]', 500, TRUE);

-- Create indexes for performance
CREATE INDEX idx_sso_api_keys_hash ON sso_api_keys (key_hash);
CREATE INDEX idx_sso_api_keys_prefix ON sso_api_keys (key_prefix);
CREATE INDEX idx_sso_api_keys_user_id ON sso_api_keys (user_id);
CREATE INDEX idx_sso_api_keys_service_id ON sso_api_keys (service_id);
CREATE INDEX idx_sso_api_keys_client_id ON sso_api_keys (client_id);
CREATE INDEX idx_sso_api_keys_status ON sso_api_keys (status);
CREATE INDEX idx_sso_api_keys_expires_at ON sso_api_keys (expires_at);
CREATE INDEX idx_sso_api_keys_last_used ON sso_api_keys (last_used);

CREATE INDEX idx_sso_api_key_usage_logs_api_key_id ON sso_api_key_usage_logs (api_key_id);
CREATE INDEX idx_sso_api_key_usage_logs_created_at ON sso_api_key_usage_logs (created_at);
CREATE INDEX idx_sso_api_key_usage_logs_ip_address ON sso_api_key_usage_logs (ip_address);
CREATE INDEX idx_sso_api_key_usage_logs_status_code ON sso_api_key_usage_logs (status_code);

CREATE INDEX idx_sso_api_key_rotation_history_api_key_id ON sso_api_key_rotation_history (api_key_id);
CREATE INDEX idx_sso_api_key_rotation_history_rotated_at ON sso_api_key_rotation_history (rotated_at);

CREATE INDEX idx_sso_service_accounts_name ON sso_service_accounts (name);
CREATE INDEX idx_sso_service_accounts_active ON sso_service_accounts (is_active);

CREATE INDEX idx_sso_client_applications_client_id ON sso_client_applications (client_id);
CREATE INDEX idx_sso_client_applications_active ON sso_client_applications (is_active);

-- DOWN
-- Rollback for: Create Encrypted API Keys Storage and Management

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_client_applications_active;
DROP INDEX IF EXISTS idx_sso_client_applications_client_id;
DROP INDEX IF EXISTS idx_sso_service_accounts_active;
DROP INDEX IF EXISTS idx_sso_service_accounts_name;
DROP INDEX IF EXISTS idx_sso_api_key_rotation_history_rotated_at;
DROP INDEX IF EXISTS idx_sso_api_key_rotation_history_api_key_id;
DROP INDEX IF EXISTS idx_sso_api_key_usage_logs_status_code;
DROP INDEX IF EXISTS idx_sso_api_key_usage_logs_ip_address;
DROP INDEX IF EXISTS idx_sso_api_key_usage_logs_created_at;
DROP INDEX IF EXISTS idx_sso_api_key_usage_logs_api_key_id;
DROP INDEX IF EXISTS idx_sso_api_keys_last_used;
DROP INDEX IF EXISTS idx_sso_api_keys_expires_at;
DROP INDEX IF EXISTS idx_sso_api_keys_status;
DROP INDEX IF EXISTS idx_sso_api_keys_client_id;
DROP INDEX IF EXISTS idx_sso_api_keys_service_id;
DROP INDEX IF EXISTS idx_sso_api_keys_user_id;
DROP INDEX IF EXISTS idx_sso_api_keys_prefix;
DROP INDEX IF EXISTS idx_sso_api_keys_hash;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_client_applications;
DROP TABLE IF EXISTS sso_service_accounts;
DROP TABLE IF EXISTS sso_api_key_rotation_history;
DROP TABLE IF EXISTS sso_api_key_usage_logs;
DROP TABLE IF EXISTS sso_api_keys;
DROP TABLE IF EXISTS sso_api_key_types;