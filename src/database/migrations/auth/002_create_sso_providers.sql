-- UP
-- Migration: Create SSO Provider Configuration Tables
-- Version: 002
-- Generated: 2024-09-24T13:05:00.000Z

-- Create SSO providers table
CREATE TABLE sso_providers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN (
        'oauth2', 'oidc', 'saml', 'ldap', 'ad', 'google', 'microsoft',
        'github', 'gitlab', 'okta', 'auth0', 'custom'
    )),
    is_enabled BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,

    -- OAuth2/OIDC Configuration
    client_id TEXT,
    client_secret TEXT, -- Encrypted
    authorization_url TEXT,
    token_url TEXT,
    userinfo_url TEXT,
    discovery_url TEXT,
    scopes TEXT DEFAULT 'openid email profile', -- Space-separated scopes

    -- SAML Configuration
    sso_url TEXT,
    slo_url TEXT,
    certificate TEXT, -- X.509 certificate
    entity_id TEXT,

    -- LDAP/AD Configuration
    server_url TEXT,
    bind_dn TEXT,
    bind_password TEXT, -- Encrypted
    user_base_dn TEXT,
    user_filter TEXT,
    group_base_dn TEXT,
    group_filter TEXT,

    -- Field Mappings
    user_id_field TEXT DEFAULT 'sub',
    email_field TEXT DEFAULT 'email',
    first_name_field TEXT DEFAULT 'given_name',
    last_name_field TEXT DEFAULT 'family_name',
    display_name_field TEXT DEFAULT 'name',
    avatar_field TEXT DEFAULT 'picture',
    groups_field TEXT DEFAULT 'groups',

    -- Advanced Settings
    allow_signup BOOLEAN DEFAULT TRUE,
    auto_create_users BOOLEAN DEFAULT TRUE,
    auto_link_accounts BOOLEAN DEFAULT FALSE,
    sync_user_info BOOLEAN DEFAULT TRUE,
    sync_groups BOOLEAN DEFAULT FALSE,

    -- Security Settings
    require_verified_email BOOLEAN DEFAULT TRUE,
    trusted_domains TEXT, -- JSON array
    allowed_domains TEXT, -- JSON array
    blocked_domains TEXT, -- JSON array

    -- Configuration JSON for provider-specific settings
    configuration TEXT DEFAULT '{}',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT
);

-- Create provider-specific user identities
CREATE TABLE sso_user_identities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    provider_user_id TEXT NOT NULL, -- External user ID from provider
    provider_username TEXT,
    provider_email TEXT,
    provider_data TEXT, -- JSON data from provider

    -- Connection metadata
    first_login DATETIME,
    last_login DATETIME,
    login_count INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES sso_providers (id) ON DELETE CASCADE,
    UNIQUE (provider_id, provider_user_id)
);

-- Create group mappings for SSO providers
CREATE TABLE sso_provider_group_mappings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider_id TEXT NOT NULL,
    provider_group TEXT NOT NULL, -- Group name from provider
    internal_role_id TEXT, -- Map to internal role
    internal_group_id TEXT, -- Map to internal group
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,

    FOREIGN KEY (provider_id) REFERENCES sso_providers (id) ON DELETE CASCADE,
    FOREIGN KEY (internal_role_id) REFERENCES sso_user_roles (id) ON DELETE SET NULL,
    FOREIGN KEY (internal_group_id) REFERENCES sso_user_groups (id) ON DELETE SET NULL,
    UNIQUE (provider_id, provider_group)
);

-- Create provider statistics
CREATE TABLE sso_provider_stats (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider_id TEXT NOT NULL,
    date DATE NOT NULL,

    -- Daily statistics
    total_logins INTEGER DEFAULT 0,
    successful_logins INTEGER DEFAULT 0,
    failed_logins INTEGER DEFAULT 0,
    new_registrations INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,

    -- Response times in milliseconds
    avg_response_time INTEGER DEFAULT 0,
    max_response_time INTEGER DEFAULT 0,
    min_response_time INTEGER DEFAULT 0,

    -- Error tracking
    timeout_errors INTEGER DEFAULT 0,
    auth_errors INTEGER DEFAULT 0,
    config_errors INTEGER DEFAULT 0,
    network_errors INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (provider_id) REFERENCES sso_providers (id) ON DELETE CASCADE,
    UNIQUE (provider_id, date)
);

-- Insert default local authentication provider
INSERT INTO sso_providers (
    name, display_name, provider_type, is_enabled, is_default, priority,
    allow_signup, auto_create_users, configuration
) VALUES (
    'local', 'Local Authentication', 'custom', TRUE, TRUE, 100,
    TRUE, TRUE, '{"supports_password_reset": true, "password_policy": {"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_numbers": true, "require_symbols": false}}'
);

-- Create indexes for performance
CREATE INDEX idx_sso_providers_type ON sso_providers (provider_type);
CREATE INDEX idx_sso_providers_enabled ON sso_providers (is_enabled);
CREATE INDEX idx_sso_providers_priority ON sso_providers (priority DESC);

CREATE INDEX idx_sso_user_identities_user_id ON sso_user_identities (user_id);
CREATE INDEX idx_sso_user_identities_provider_id ON sso_user_identities (provider_id);
CREATE INDEX idx_sso_user_identities_provider_user_id ON sso_user_identities (provider_user_id);
CREATE INDEX idx_sso_user_identities_primary ON sso_user_identities (is_primary);

CREATE INDEX idx_sso_provider_group_mappings_provider_id ON sso_provider_group_mappings (provider_id);
CREATE INDEX idx_sso_provider_group_mappings_provider_group ON sso_provider_group_mappings (provider_group);

CREATE INDEX idx_sso_provider_stats_provider_id ON sso_provider_stats (provider_id);
CREATE INDEX idx_sso_provider_stats_date ON sso_provider_stats (date);

-- DOWN
-- Rollback for: Create SSO Provider Configuration Tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_provider_stats_date;
DROP INDEX IF EXISTS idx_sso_provider_stats_provider_id;
DROP INDEX IF EXISTS idx_sso_provider_group_mappings_provider_group;
DROP INDEX IF EXISTS idx_sso_provider_group_mappings_provider_id;
DROP INDEX IF EXISTS idx_sso_user_identities_primary;
DROP INDEX IF EXISTS idx_sso_user_identities_provider_user_id;
DROP INDEX IF EXISTS idx_sso_user_identities_provider_id;
DROP INDEX IF EXISTS idx_sso_user_identities_user_id;
DROP INDEX IF EXISTS idx_sso_providers_priority;
DROP INDEX IF EXISTS idx_sso_providers_enabled;
DROP INDEX IF EXISTS idx_sso_providers_type;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_provider_stats;
DROP TABLE IF EXISTS sso_provider_group_mappings;
DROP TABLE IF EXISTS sso_user_identities;
DROP TABLE IF EXISTS sso_providers;