-- UP
-- Migration: Create Comprehensive Audit Log Tables with Retention
-- Version: 005
-- Generated: 2024-09-24T13:05:00.000Z

-- Create audit event types
CREATE TABLE sso_audit_event_types (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    category TEXT NOT NULL CHECK (category IN (
        'authentication', 'authorization', 'user_management', 'system',
        'data_access', 'configuration', 'security', 'compliance'
    )),
    event_type TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    is_sensitive BOOLEAN DEFAULT FALSE,
    requires_review BOOLEAN DEFAULT FALSE,
    retention_days INTEGER DEFAULT 365,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create main audit log table
CREATE TABLE sso_audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))), -- Correlation ID

    -- Event classification
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),

    -- Actor information (who performed the action)
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'service', 'system', 'anonymous')),
    actor_id TEXT, -- User ID, service ID, etc.
    actor_name TEXT,
    actor_email TEXT,
    impersonator_id TEXT, -- If someone is acting on behalf of another user
    impersonator_name TEXT,

    -- Target/Subject information (what was affected)
    target_type TEXT, -- user, role, session, api_key, etc.
    target_id TEXT,
    target_name TEXT,
    parent_target_type TEXT, -- For nested resources
    parent_target_id TEXT,

    -- Action details
    action TEXT NOT NULL, -- create, read, update, delete, login, logout, etc.
    resource TEXT, -- API endpoint, database table, etc.
    method TEXT, -- HTTP method, database operation, etc.

    -- Request/Context information
    session_id TEXT,
    request_id TEXT,
    correlation_id TEXT,

    -- Network information
    ip_address TEXT,
    user_agent TEXT,
    referer TEXT,

    -- Geographic information
    country TEXT,
    region TEXT,
    city TEXT,

    -- Data changes
    old_values TEXT, -- JSON of old values (sensitive data should be masked)
    new_values TEXT, -- JSON of new values (sensitive data should be masked)
    changed_fields TEXT, -- JSON array of changed field names

    -- Result information
    success BOOLEAN NOT NULL DEFAULT TRUE,
    status_code INTEGER,
    error_code TEXT,
    error_message TEXT,

    -- Additional context
    message TEXT,
    details TEXT, -- JSON with additional event-specific details
    tags TEXT, -- JSON array of tags for categorization

    -- Compliance and risk
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    compliance_flags TEXT, -- JSON array of compliance requirements (GDPR, HIPAA, etc.)
    requires_notification BOOLEAN DEFAULT FALSE,

    -- Timing
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER, -- How long the operation took

    -- Data retention
    expires_at DATETIME, -- When this record should be purged
    is_archived BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (event_type) REFERENCES sso_audit_event_types (event_type) ON DELETE RESTRICT
);

-- Create sensitive data access log
CREATE TABLE sso_sensitive_data_access (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    audit_log_id TEXT NOT NULL,

    -- Data classification
    data_type TEXT NOT NULL CHECK (data_type IN (
        'pii', 'financial', 'health', 'credentials', 'api_keys', 'tokens', 'other'
    )),
    data_classification TEXT NOT NULL CHECK (data_classification IN (
        'public', 'internal', 'confidential', 'restricted', 'top_secret'
    )),

    -- Access details
    field_names TEXT, -- JSON array of sensitive field names accessed
    record_count INTEGER DEFAULT 1,
    access_reason TEXT,
    access_justification TEXT,

    -- Authorization
    authorized_by TEXT, -- Who authorized this access
    authorization_reference TEXT, -- Ticket number, approval ID, etc.

    -- Legal basis (for GDPR compliance)
    legal_basis TEXT CHECK (legal_basis IN (
        'consent', 'contract', 'legal_obligation', 'vital_interests',
        'public_task', 'legitimate_interests'
    )),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (audit_log_id) REFERENCES sso_audit_logs (id) ON DELETE CASCADE
);

-- Create compliance audit table
CREATE TABLE sso_compliance_audits (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    audit_period_start DATETIME NOT NULL,
    audit_period_end DATETIME NOT NULL,

    -- Compliance framework
    framework TEXT NOT NULL CHECK (framework IN (
        'GDPR', 'HIPAA', 'SOX', 'PCI-DSS', 'ISO27001', 'SOC2', 'NIST', 'custom'
    )),
    framework_version TEXT,

    -- Audit details
    auditor_name TEXT NOT NULL,
    auditor_organization TEXT,
    audit_type TEXT NOT NULL CHECK (audit_type IN ('internal', 'external', 'certification')),

    -- Status and results
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
        'planned', 'in_progress', 'completed', 'failed', 'cancelled'
    )),
    overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
    findings_count INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    high_findings INTEGER DEFAULT 0,
    medium_findings INTEGER DEFAULT 0,
    low_findings INTEGER DEFAULT 0,

    -- Documentation
    report_path TEXT,
    findings_summary TEXT,
    recommendations TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Create audit retention policies
CREATE TABLE sso_audit_retention_policies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    policy_name TEXT UNIQUE NOT NULL,
    description TEXT,

    -- Scope
    event_categories TEXT, -- JSON array of categories this policy applies to
    event_types TEXT, -- JSON array of specific event types
    severity_levels TEXT, -- JSON array of severity levels

    -- Retention rules
    retention_days INTEGER NOT NULL,
    archive_after_days INTEGER,
    delete_after_days INTEGER,

    -- Conditions
    apply_to_sensitive_data BOOLEAN DEFAULT TRUE,
    apply_to_compliance_events BOOLEAN DEFAULT TRUE,

    -- Legal hold
    legal_hold_enabled BOOLEAN DEFAULT FALSE,
    legal_hold_reason TEXT,
    legal_hold_until DATETIME,

    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- Higher priority policies override lower ones

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create audit search index table for fast querying
CREATE TABLE sso_audit_search_index (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    audit_log_id TEXT NOT NULL,

    -- Searchable text content
    search_content TEXT NOT NULL, -- Concatenated searchable fields

    -- Faceted search fields
    date_bucket TEXT, -- YYYY-MM for monthly partitioning
    hour_bucket TEXT, -- YYYY-MM-DD-HH for hourly analysis

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (audit_log_id) REFERENCES sso_audit_logs (id) ON DELETE CASCADE
);

-- Insert default audit event types
INSERT INTO sso_audit_event_types (category, event_type, display_name, description, severity, requires_review) VALUES
-- Authentication events
('authentication', 'user_login', 'User Login', 'User successfully logged in', 'info', FALSE),
('authentication', 'user_login_failed', 'User Login Failed', 'User login attempt failed', 'medium', TRUE),
('authentication', 'user_logout', 'User Logout', 'User logged out', 'info', FALSE),
('authentication', 'password_change', 'Password Changed', 'User changed their password', 'medium', FALSE),
('authentication', 'password_reset', 'Password Reset', 'User reset their password', 'medium', TRUE),
('authentication', 'mfa_enabled', 'MFA Enabled', 'Multi-factor authentication was enabled', 'medium', FALSE),
('authentication', 'mfa_disabled', 'MFA Disabled', 'Multi-factor authentication was disabled', 'high', TRUE),

-- Authorization events
('authorization', 'permission_granted', 'Permission Granted', 'Permission was granted to user', 'info', FALSE),
('authorization', 'permission_denied', 'Permission Denied', 'Permission was denied', 'medium', TRUE),
('authorization', 'role_assigned', 'Role Assigned', 'Role was assigned to user', 'medium', FALSE),
('authorization', 'role_removed', 'Role Removed', 'Role was removed from user', 'medium', TRUE),
('authorization', 'privilege_escalation', 'Privilege Escalation', 'User privileges were escalated', 'high', TRUE),

-- User management events
('user_management', 'user_created', 'User Created', 'New user account was created', 'medium', FALSE),
('user_management', 'user_updated', 'User Updated', 'User account was updated', 'info', FALSE),
('user_management', 'user_deleted', 'User Deleted', 'User account was deleted', 'high', TRUE),
('user_management', 'user_suspended', 'User Suspended', 'User account was suspended', 'high', TRUE),
('user_management', 'user_activated', 'User Activated', 'User account was activated', 'medium', FALSE),

-- Data access events
('data_access', 'sensitive_data_access', 'Sensitive Data Access', 'Sensitive data was accessed', 'high', TRUE),
('data_access', 'bulk_data_export', 'Bulk Data Export', 'Large amount of data was exported', 'high', TRUE),
('data_access', 'data_modification', 'Data Modification', 'Data was modified', 'medium', FALSE),

-- Security events
('security', 'suspicious_activity', 'Suspicious Activity', 'Suspicious user activity detected', 'high', TRUE),
('security', 'brute_force_attempt', 'Brute Force Attempt', 'Brute force attack detected', 'critical', TRUE),
('security', 'account_lockout', 'Account Lockout', 'Account was locked due to security policy', 'high', TRUE),
('security', 'security_policy_violation', 'Security Policy Violation', 'Security policy was violated', 'high', TRUE),

-- System events
('system', 'system_startup', 'System Startup', 'System was started', 'info', FALSE),
('system', 'system_shutdown', 'System Shutdown', 'System was shut down', 'medium', FALSE),
('system', 'configuration_change', 'Configuration Change', 'System configuration was changed', 'medium', TRUE),
('system', 'database_backup', 'Database Backup', 'Database backup was performed', 'info', FALSE);

-- Insert default retention policy
INSERT INTO sso_audit_retention_policies (
    policy_name, description, event_categories, retention_days, archive_after_days, delete_after_days
) VALUES (
    'default_retention', 'Default audit log retention policy',
    '["authentication", "authorization", "user_management", "data_access", "security", "system", "configuration", "compliance"]',
    365, 90, 2555 -- Keep 1 year, archive after 90 days, delete after 7 years
);

-- Create comprehensive indexes for performance
CREATE INDEX idx_sso_audit_logs_timestamp ON sso_audit_logs (timestamp DESC);
CREATE INDEX idx_sso_audit_logs_event_type ON sso_audit_logs (event_type);
CREATE INDEX idx_sso_audit_logs_category ON sso_audit_logs (category);
CREATE INDEX idx_sso_audit_logs_severity ON sso_audit_logs (severity);
CREATE INDEX idx_sso_audit_logs_actor_id ON sso_audit_logs (actor_id);
CREATE INDEX idx_sso_audit_logs_target_id ON sso_audit_logs (target_id);
CREATE INDEX idx_sso_audit_logs_session_id ON sso_audit_logs (session_id);
CREATE INDEX idx_sso_audit_logs_ip_address ON sso_audit_logs (ip_address);
CREATE INDEX idx_sso_audit_logs_success ON sso_audit_logs (success);
CREATE INDEX idx_sso_audit_logs_expires_at ON sso_audit_logs (expires_at);
CREATE INDEX idx_sso_audit_logs_risk_score ON sso_audit_logs (risk_score);

CREATE INDEX idx_sso_sensitive_data_access_audit_log_id ON sso_sensitive_data_access (audit_log_id);
CREATE INDEX idx_sso_sensitive_data_access_data_type ON sso_sensitive_data_access (data_type);
CREATE INDEX idx_sso_sensitive_data_access_classification ON sso_sensitive_data_access (data_classification);

CREATE INDEX idx_sso_compliance_audits_framework ON sso_compliance_audits (framework);
CREATE INDEX idx_sso_compliance_audits_status ON sso_compliance_audits (status);
CREATE INDEX idx_sso_compliance_audits_period_start ON sso_compliance_audits (audit_period_start);
CREATE INDEX idx_sso_compliance_audits_period_end ON sso_compliance_audits (audit_period_end);

CREATE INDEX idx_sso_audit_search_index_audit_log_id ON sso_audit_search_index (audit_log_id);
CREATE INDEX idx_sso_audit_search_index_date_bucket ON sso_audit_search_index (date_bucket);
CREATE INDEX idx_sso_audit_search_index_hour_bucket ON sso_audit_search_index (hour_bucket);

-- Create FTS index for audit log searching
CREATE VIRTUAL TABLE sso_audit_logs_fts USING fts5(
    event_id, event_type, message, details, actor_name, target_name,
    content='sso_audit_logs',
    content_rowid='rowid'
);

-- DOWN
-- Rollback for: Create Comprehensive Audit Log Tables with Retention

-- Drop FTS table
DROP TABLE IF EXISTS sso_audit_logs_fts;

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_audit_search_index_hour_bucket;
DROP INDEX IF EXISTS idx_sso_audit_search_index_date_bucket;
DROP INDEX IF EXISTS idx_sso_audit_search_index_audit_log_id;
DROP INDEX IF EXISTS idx_sso_compliance_audits_period_end;
DROP INDEX IF EXISTS idx_sso_compliance_audits_period_start;
DROP INDEX IF EXISTS idx_sso_compliance_audits_status;
DROP INDEX IF EXISTS idx_sso_compliance_audits_framework;
DROP INDEX IF EXISTS idx_sso_sensitive_data_access_classification;
DROP INDEX IF EXISTS idx_sso_sensitive_data_access_data_type;
DROP INDEX IF EXISTS idx_sso_sensitive_data_access_audit_log_id;
DROP INDEX IF EXISTS idx_sso_audit_logs_risk_score;
DROP INDEX IF EXISTS idx_sso_audit_logs_expires_at;
DROP INDEX IF EXISTS idx_sso_audit_logs_success;
DROP INDEX IF EXISTS idx_sso_audit_logs_ip_address;
DROP INDEX IF EXISTS idx_sso_audit_logs_session_id;
DROP INDEX IF EXISTS idx_sso_audit_logs_target_id;
DROP INDEX IF EXISTS idx_sso_audit_logs_actor_id;
DROP INDEX IF EXISTS idx_sso_audit_logs_severity;
DROP INDEX IF EXISTS idx_sso_audit_logs_category;
DROP INDEX IF EXISTS idx_sso_audit_logs_event_type;
DROP INDEX IF EXISTS idx_sso_audit_logs_timestamp;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_audit_search_index;
DROP TABLE IF EXISTS sso_audit_retention_policies;
DROP TABLE IF EXISTS sso_compliance_audits;
DROP TABLE IF EXISTS sso_sensitive_data_access;
DROP TABLE IF EXISTS sso_audit_logs;
DROP TABLE IF EXISTS sso_audit_event_types;