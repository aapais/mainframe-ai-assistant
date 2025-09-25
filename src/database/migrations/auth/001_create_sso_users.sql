-- UP
-- Migration: Create SSO Users and Identity Management Tables
-- Version: 001
-- Generated: 2024-09-24T13:05:00.000Z

-- Enable UUID extension for PostgreSQL compatibility
PRAGMA foreign_keys = ON;

-- Create users table with SSO support
CREATE TABLE sso_users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    display_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    locale TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    password_hash TEXT, -- Optional for SSO-only users
    password_salt TEXT,
    password_reset_token TEXT,
    password_reset_expires DATETIME,
    email_verification_token TEXT,
    email_verification_expires DATETIME,
    last_login DATETIME,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    metadata TEXT, -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT
);

-- Create user roles table
CREATE TABLE sso_user_roles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    permissions TEXT NOT NULL, -- JSON array of permissions
    is_system_role BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create user-role assignments
CREATE TABLE sso_user_role_assignments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_by TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES sso_user_roles (id) ON DELETE CASCADE,
    UNIQUE (user_id, role_id)
);

-- Create user groups for organization
CREATE TABLE sso_user_groups (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    parent_group_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (parent_group_id) REFERENCES sso_user_groups (id) ON DELETE SET NULL
);

-- Create user-group memberships
CREATE TABLE sso_user_group_memberships (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    joined_by TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES sso_user_groups (id) ON DELETE CASCADE,
    UNIQUE (user_id, group_id)
);

-- Create user preferences
CREATE TABLE sso_user_preferences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE CASCADE,
    UNIQUE (user_id, preference_key)
);

-- Insert default system roles
INSERT INTO sso_user_roles (name, display_name, description, permissions, is_system_role, is_default) VALUES
('system_admin', 'System Administrator', 'Full system access', '["*"]', TRUE, FALSE),
('admin', 'Administrator', 'Full application access', '["admin:*", "user:*", "kb:*"]', TRUE, FALSE),
('user', 'Standard User', 'Standard application access', '["kb:read", "kb:create", "kb:update_own"]', TRUE, TRUE),
('readonly', 'Read Only', 'Read-only access', '["kb:read"]', TRUE, FALSE),
('guest', 'Guest User', 'Limited access', '["kb:read_public"]', TRUE, FALSE);

-- Create default user group
INSERT INTO sso_user_groups (name, display_name, description, is_active) VALUES
('default', 'Default Users', 'Default group for all users', TRUE);

-- Create indexes for performance
CREATE INDEX idx_sso_users_email ON sso_users (email);
CREATE INDEX idx_sso_users_username ON sso_users (username);
CREATE INDEX idx_sso_users_status ON sso_users (status);
CREATE INDEX idx_sso_users_last_login ON sso_users (last_login);
CREATE INDEX idx_sso_users_created_at ON sso_users (created_at);

CREATE INDEX idx_sso_user_role_assignments_user_id ON sso_user_role_assignments (user_id);
CREATE INDEX idx_sso_user_role_assignments_role_id ON sso_user_role_assignments (role_id);
CREATE INDEX idx_sso_user_role_assignments_active ON sso_user_role_assignments (is_active);

CREATE INDEX idx_sso_user_group_memberships_user_id ON sso_user_group_memberships (user_id);
CREATE INDEX idx_sso_user_group_memberships_group_id ON sso_user_group_memberships (group_id);

CREATE INDEX idx_sso_user_preferences_user_id ON sso_user_preferences (user_id);
CREATE INDEX idx_sso_user_preferences_key ON sso_user_preferences (preference_key);

-- DOWN
-- Rollback for: Create SSO Users and Identity Management Tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_user_preferences_key;
DROP INDEX IF EXISTS idx_sso_user_preferences_user_id;
DROP INDEX IF EXISTS idx_sso_user_group_memberships_group_id;
DROP INDEX IF EXISTS idx_sso_user_group_memberships_user_id;
DROP INDEX IF EXISTS idx_sso_user_role_assignments_active;
DROP INDEX IF EXISTS idx_sso_user_role_assignments_role_id;
DROP INDEX IF EXISTS idx_sso_user_role_assignments_user_id;
DROP INDEX IF EXISTS idx_sso_users_created_at;
DROP INDEX IF EXISTS idx_sso_users_last_login;
DROP INDEX IF EXISTS idx_sso_users_status;
DROP INDEX IF EXISTS idx_sso_users_username;
DROP INDEX IF EXISTS idx_sso_users_email;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_user_preferences;
DROP TABLE IF EXISTS sso_user_group_memberships;
DROP TABLE IF EXISTS sso_user_groups;
DROP TABLE IF EXISTS sso_user_role_assignments;
DROP TABLE IF EXISTS sso_user_roles;
DROP TABLE IF EXISTS sso_users;