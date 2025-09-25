-- UP
-- Migration: Create Backup and Restore Procedures with Encryption
-- Version: 009
-- Generated: 2024-09-24T13:05:00.000Z

-- Create backup configuration table
CREATE TABLE sso_backup_configs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    config_name TEXT UNIQUE NOT NULL,
    description TEXT,

    -- Backup scope
    backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential', 'auth_only')),
    included_tables TEXT NOT NULL, -- JSON array of table names
    excluded_tables TEXT DEFAULT '[]', -- JSON array of tables to exclude

    -- Schedule configuration
    schedule_enabled BOOLEAN DEFAULT FALSE,
    schedule_cron TEXT, -- Cron expression
    schedule_timezone TEXT DEFAULT 'UTC',

    -- Retention policy
    retention_days INTEGER DEFAULT 30,
    max_backups INTEGER DEFAULT 10, -- Maximum number of backups to keep
    auto_cleanup BOOLEAN DEFAULT TRUE,

    -- Encryption settings
    encryption_enabled BOOLEAN DEFAULT TRUE,
    encryption_algorithm TEXT DEFAULT 'AES-256-GCM',
    key_derivation_method TEXT DEFAULT 'PBKDF2',
    key_iterations INTEGER DEFAULT 100000,

    -- Compression settings
    compression_enabled BOOLEAN DEFAULT TRUE,
    compression_algorithm TEXT DEFAULT 'gzip',
    compression_level INTEGER DEFAULT 6 CHECK (compression_level BETWEEN 1 AND 9),

    -- Verification settings
    checksum_algorithm TEXT DEFAULT 'SHA-256',
    verify_after_backup BOOLEAN DEFAULT TRUE,
    verify_after_restore BOOLEAN DEFAULT TRUE,

    -- Storage settings
    storage_path TEXT NOT NULL,
    storage_type TEXT DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'azure', 'gcp')),
    storage_config TEXT DEFAULT '{}', -- JSON configuration for cloud storage

    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create backup execution log
CREATE TABLE sso_backup_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    backup_config_id TEXT NOT NULL,
    execution_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Backup metadata
    backup_type TEXT NOT NULL,
    backup_name TEXT NOT NULL, -- Generated backup filename
    backup_path TEXT NOT NULL, -- Full path to backup file

    -- Execution details
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'api', 'migration')),
    triggered_by TEXT,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN (
        'started', 'in_progress', 'completed', 'failed', 'cancelled', 'verified'
    )),

    -- Timing information
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_seconds INTEGER,

    -- Size and statistics
    original_size_bytes INTEGER DEFAULT 0,
    compressed_size_bytes INTEGER DEFAULT 0,
    compression_ratio REAL,
    records_count INTEGER DEFAULT 0,
    tables_count INTEGER DEFAULT 0,

    -- Security information
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_key_id TEXT,
    checksum TEXT, -- Backup file checksum
    checksum_algorithm TEXT,

    -- Verification results
    verification_status TEXT CHECK (verification_status IN ('pending', 'passed', 'failed', 'skipped')),
    verification_checksum TEXT,
    verification_completed_at DATETIME,

    -- Error information
    error_message TEXT,
    error_details TEXT, -- JSON with detailed error information
    warnings_count INTEGER DEFAULT 0,
    warnings TEXT, -- JSON array of warning messages

    -- Metadata
    backup_metadata TEXT DEFAULT '{}', -- JSON with additional metadata
    source_database_version TEXT,
    schema_version INTEGER,

    FOREIGN KEY (backup_config_id) REFERENCES sso_backup_configs (id) ON DELETE CASCADE
);

-- Create backup file registry
CREATE TABLE sso_backup_files (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    backup_execution_id TEXT NOT NULL,

    -- File information
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('data', 'schema', 'metadata', 'log')),

    -- Size information
    file_size_bytes INTEGER NOT NULL,
    compressed_size_bytes INTEGER,

    -- Security information
    checksum TEXT NOT NULL,
    checksum_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
    is_encrypted BOOLEAN DEFAULT FALSE,

    -- Content information
    tables_included TEXT, -- JSON array of table names in this file
    records_count INTEGER DEFAULT 0,
    date_range_start DATETIME, -- Earliest record date
    date_range_end DATETIME, -- Latest record date

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (backup_execution_id) REFERENCES sso_backup_executions (id) ON DELETE CASCADE
);

-- Create restore execution log
CREATE TABLE sso_restore_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restore_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Source backup information
    backup_execution_id TEXT,
    backup_path TEXT NOT NULL,
    backup_name TEXT,

    -- Restore options
    restore_type TEXT NOT NULL CHECK (restore_type IN ('full', 'partial', 'point_in_time')),
    target_database TEXT,
    table_mapping TEXT DEFAULT '{}', -- JSON mapping of source to target table names
    data_transformation TEXT DEFAULT '{}', -- JSON with data transformation rules

    -- Execution details
    triggered_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN (
        'started', 'validating', 'restoring', 'verifying', 'completed', 'failed', 'cancelled'
    )),

    -- Timing information
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_seconds INTEGER,

    -- Statistics
    records_restored INTEGER DEFAULT 0,
    tables_restored INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,

    -- Verification results
    verification_status TEXT CHECK (verification_status IN ('pending', 'passed', 'failed', 'skipped')),
    verification_completed_at DATETIME,

    -- Error information
    error_message TEXT,
    error_details TEXT, -- JSON with detailed error information
    warnings TEXT, -- JSON array of warning messages

    -- Pre-restore snapshot
    pre_restore_snapshot_path TEXT,
    cleanup_snapshot BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (backup_execution_id) REFERENCES sso_backup_executions (id) ON DELETE SET NULL
);

-- Create encryption keys table for backup encryption
CREATE TABLE sso_backup_encryption_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    key_id TEXT UNIQUE NOT NULL,
    key_name TEXT NOT NULL,

    -- Key information
    algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    key_length INTEGER NOT NULL DEFAULT 256,
    key_derivation_method TEXT NOT NULL DEFAULT 'PBKDF2',
    iterations INTEGER NOT NULL DEFAULT 100000,

    -- Key storage (encrypted with master key)
    encrypted_key TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT, -- Initialization vector for symmetric encryption

    -- Key lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'compromised')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    rotated_from TEXT, -- Previous key ID

    -- Usage tracking
    last_used DATETIME,
    usage_count INTEGER DEFAULT 0,

    -- Access control
    allowed_operations TEXT DEFAULT '["backup", "restore"]', -- JSON array
    created_by TEXT,

    FOREIGN KEY (rotated_from) REFERENCES sso_backup_encryption_keys (key_id) ON DELETE SET NULL
);

-- Create scheduled backup jobs table
CREATE TABLE sso_scheduled_backup_jobs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    job_name TEXT UNIQUE NOT NULL,
    backup_config_id TEXT NOT NULL,

    -- Schedule information
    cron_expression TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    next_run_at DATETIME,

    -- Job status
    is_enabled BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'running', 'completed', 'failed', 'disabled'
    )),

    -- Execution tracking
    last_run_at DATETIME,
    last_status TEXT,
    last_duration_seconds INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    max_consecutive_failures INTEGER DEFAULT 3,

    -- Error handling
    retry_enabled BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2,
    retry_delay_minutes INTEGER DEFAULT 30,

    -- Notifications
    notify_on_success BOOLEAN DEFAULT FALSE,
    notify_on_failure BOOLEAN DEFAULT TRUE,
    notification_recipients TEXT, -- JSON array of email addresses

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,

    FOREIGN KEY (backup_config_id) REFERENCES sso_backup_configs (id) ON DELETE CASCADE
);

-- Create backup data validation rules
CREATE TABLE sso_backup_validation_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rule_name TEXT UNIQUE NOT NULL,
    description TEXT,

    -- Rule configuration
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'record_count', 'data_integrity', 'referential_integrity',
        'schema_validation', 'custom_query', 'file_size'
    )),
    table_name TEXT, -- Specific table to validate (null for global rules)
    rule_query TEXT, -- SQL query for custom validations
    expected_result TEXT, -- Expected result for validation
    tolerance_threshold REAL DEFAULT 0.05, -- Tolerance for count variations (5%)

    -- Rule execution
    execution_order INTEGER DEFAULT 1,
    is_critical BOOLEAN DEFAULT TRUE, -- Fail backup if this rule fails
    is_active BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create backup validation results
CREATE TABLE sso_backup_validation_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    backup_execution_id TEXT NOT NULL,
    validation_rule_id TEXT NOT NULL,

    -- Validation results
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning', 'skipped')),
    expected_value TEXT,
    actual_value TEXT,
    difference_value TEXT,
    error_message TEXT,

    -- Timing
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_ms INTEGER,

    FOREIGN KEY (backup_execution_id) REFERENCES sso_backup_executions (id) ON DELETE CASCADE,
    FOREIGN KEY (validation_rule_id) REFERENCES sso_backup_validation_rules (id) ON DELETE CASCADE
);

-- Insert default backup configuration for SSO data
INSERT INTO sso_backup_configs (
    config_name, description, backup_type, included_tables,
    retention_days, max_backups, storage_path
) VALUES (
    'sso_full_backup',
    'Complete SSO system backup including all authentication and authorization data',
    'full',
    '["sso_users", "sso_user_roles", "sso_user_role_assignments", "sso_user_groups", "sso_user_group_memberships", "sso_providers", "sso_user_identities", "sso_api_keys", "sso_sessions", "sso_audit_logs", "sso_security_events"]',
    90, -- Keep for 90 days
    12, -- Keep 12 backups
    './backups/sso/'
);

INSERT INTO sso_backup_configs (
    config_name, description, backup_type, included_tables,
    retention_days, max_backups, storage_path, schedule_enabled, schedule_cron
) VALUES (
    'sso_daily_backup',
    'Daily incremental backup of SSO data',
    'incremental',
    '["sso_users", "sso_sessions", "sso_audit_logs", "sso_security_events", "sso_api_key_usage_logs"]',
    30, -- Keep for 30 days
    30, -- Keep 30 daily backups
    './backups/sso/daily/',
    TRUE,
    '0 2 * * *' -- Daily at 2 AM
);

-- Insert default validation rules
INSERT INTO sso_backup_validation_rules (rule_name, description, rule_type, table_name, rule_query, is_critical) VALUES
('sso_users_count', 'Validate user record count', 'record_count', 'sso_users', 'SELECT COUNT(*) FROM sso_users', TRUE),
('sso_active_sessions', 'Validate active session count', 'custom_query', 'sso_sessions', 'SELECT COUNT(*) FROM sso_sessions WHERE status = "active"', FALSE),
('sso_audit_integrity', 'Validate audit log integrity', 'data_integrity', 'sso_audit_logs', 'SELECT COUNT(*) FROM sso_audit_logs WHERE event_id IS NOT NULL AND timestamp IS NOT NULL', TRUE),
('sso_referential_integrity', 'Validate foreign key relationships', 'referential_integrity', NULL, 'SELECT COUNT(*) FROM sso_user_role_assignments ura LEFT JOIN sso_users u ON ura.user_id = u.id WHERE u.id IS NULL', TRUE);

-- Insert default encryption key (this would normally be generated securely)
INSERT INTO sso_backup_encryption_keys (
    key_id, key_name, algorithm, key_length,
    encrypted_key, salt, status
) VALUES (
    'backup_key_001',
    'Default SSO Backup Key',
    'AES-256-GCM',
    256,
    'encrypted_key_placeholder_should_be_generated_securely',
    'salt_placeholder_should_be_random',
    'active'
);

-- Create indexes for backup tables
CREATE INDEX idx_sso_backup_executions_config_id ON sso_backup_executions (backup_config_id);
CREATE INDEX idx_sso_backup_executions_status ON sso_backup_executions (status);
CREATE INDEX idx_sso_backup_executions_started_at ON sso_backup_executions (started_at);
CREATE INDEX idx_sso_backup_executions_backup_type ON sso_backup_executions (backup_type);

CREATE INDEX idx_sso_backup_files_execution_id ON sso_backup_files (backup_execution_id);
CREATE INDEX idx_sso_backup_files_file_type ON sso_backup_files (file_type);
CREATE INDEX idx_sso_backup_files_checksum ON sso_backup_files (checksum);

CREATE INDEX idx_sso_restore_executions_backup_execution_id ON sso_restore_executions (backup_execution_id);
CREATE INDEX idx_sso_restore_executions_status ON sso_restore_executions (status);
CREATE INDEX idx_sso_restore_executions_started_at ON sso_restore_executions (started_at);

CREATE INDEX idx_sso_backup_encryption_keys_key_id ON sso_backup_encryption_keys (key_id);
CREATE INDEX idx_sso_backup_encryption_keys_status ON sso_backup_encryption_keys (status);
CREATE INDEX idx_sso_backup_encryption_keys_expires_at ON sso_backup_encryption_keys (expires_at);

CREATE INDEX idx_sso_scheduled_backup_jobs_config_id ON sso_scheduled_backup_jobs (backup_config_id);
CREATE INDEX idx_sso_scheduled_backup_jobs_next_run_at ON sso_scheduled_backup_jobs (next_run_at);
CREATE INDEX idx_sso_scheduled_backup_jobs_enabled ON sso_scheduled_backup_jobs (is_enabled);

CREATE INDEX idx_sso_backup_validation_results_execution_id ON sso_backup_validation_results (backup_execution_id);
CREATE INDEX idx_sso_backup_validation_results_rule_id ON sso_backup_validation_results (validation_rule_id);
CREATE INDEX idx_sso_backup_validation_results_status ON sso_backup_validation_results (status);

-- DOWN
-- Rollback for: Create Backup and Restore Procedures with Encryption

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_backup_validation_results_status;
DROP INDEX IF EXISTS idx_sso_backup_validation_results_rule_id;
DROP INDEX IF EXISTS idx_sso_backup_validation_results_execution_id;
DROP INDEX IF EXISTS idx_sso_scheduled_backup_jobs_enabled;
DROP INDEX IF EXISTS idx_sso_scheduled_backup_jobs_next_run_at;
DROP INDEX IF EXISTS idx_sso_scheduled_backup_jobs_config_id;
DROP INDEX IF EXISTS idx_sso_backup_encryption_keys_expires_at;
DROP INDEX IF EXISTS idx_sso_backup_encryption_keys_status;
DROP INDEX IF EXISTS idx_sso_backup_encryption_keys_key_id;
DROP INDEX IF EXISTS idx_sso_restore_executions_started_at;
DROP INDEX IF EXISTS idx_sso_restore_executions_status;
DROP INDEX IF EXISTS idx_sso_restore_executions_backup_execution_id;
DROP INDEX IF EXISTS idx_sso_backup_files_checksum;
DROP INDEX IF EXISTS idx_sso_backup_files_file_type;
DROP INDEX IF EXISTS idx_sso_backup_files_execution_id;
DROP INDEX IF EXISTS idx_sso_backup_executions_backup_type;
DROP INDEX IF EXISTS idx_sso_backup_executions_started_at;
DROP INDEX IF EXISTS idx_sso_backup_executions_status;
DROP INDEX IF EXISTS idx_sso_backup_executions_config_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_backup_validation_results;
DROP TABLE IF EXISTS sso_backup_validation_rules;
DROP TABLE IF EXISTS sso_scheduled_backup_jobs;
DROP TABLE IF EXISTS sso_backup_encryption_keys;
DROP TABLE IF EXISTS sso_restore_executions;
DROP TABLE IF EXISTS sso_backup_files;
DROP TABLE IF EXISTS sso_backup_executions;
DROP TABLE IF EXISTS sso_backup_configs;