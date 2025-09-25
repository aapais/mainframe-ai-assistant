-- UP
-- Migration: Create Data Validation and Rollback Safety Mechanisms
-- Version: 010
-- Generated: 2024-09-24T13:05:00.000Z

-- Create data validation rules table
CREATE TABLE sso_data_validation_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rule_name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'data_integrity', 'business_logic', 'security', 'compliance', 'performance'
    )),

    -- Rule configuration
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'not_null', 'unique', 'foreign_key', 'check_constraint',
        'range_check', 'format_validation', 'custom_query', 'count_validation'
    )),
    target_table TEXT NOT NULL,
    target_column TEXT,
    validation_query TEXT, -- SQL query for custom validations
    expected_result TEXT, -- Expected result pattern or value

    -- Rule parameters
    rule_parameters TEXT DEFAULT '{}', -- JSON configuration for rule-specific parameters
    severity_level TEXT NOT NULL DEFAULT 'error' CHECK (severity_level IN ('error', 'warning', 'info')),
    is_blocking BOOLEAN DEFAULT TRUE, -- Block operations if rule fails

    -- Execution control
    is_active BOOLEAN DEFAULT TRUE,
    execution_order INTEGER DEFAULT 1,
    timeout_seconds INTEGER DEFAULT 30,

    -- Scope control
    apply_on_insert BOOLEAN DEFAULT TRUE,
    apply_on_update BOOLEAN DEFAULT TRUE,
    apply_on_delete BOOLEAN DEFAULT FALSE,
    apply_on_migration BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create validation execution log
CREATE TABLE sso_validation_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    execution_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Context information
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'migration', 'manual', 'scheduled', 'api', 'trigger', 'backup'
    )),
    trigger_context TEXT, -- Additional context like migration version
    triggered_by TEXT,

    -- Execution details
    validation_rule_id TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_record_id TEXT, -- Specific record being validated (if applicable)

    -- Results
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning', 'error', 'timeout')),
    expected_value TEXT,
    actual_value TEXT,
    error_message TEXT,
    details TEXT, -- JSON with additional details

    -- Performance metrics
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    execution_time_ms INTEGER,
    records_validated INTEGER DEFAULT 0,

    FOREIGN KEY (validation_rule_id) REFERENCES sso_data_validation_rules (id) ON DELETE CASCADE
);

-- Create migration safety checkpoints
CREATE TABLE sso_migration_checkpoints (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    checkpoint_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Migration information
    migration_version INTEGER NOT NULL,
    migration_name TEXT NOT NULL,
    migration_description TEXT,

    -- Checkpoint data
    checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN (
        'pre_migration', 'post_migration', 'rollback_point', 'validation_point'
    )),
    database_state TEXT, -- JSON snapshot of critical database state
    validation_results TEXT, -- JSON with validation results at checkpoint
    performance_metrics TEXT, -- JSON with performance metrics

    -- Safety information
    rollback_available BOOLEAN DEFAULT TRUE,
    rollback_sql TEXT, -- SQL commands to rollback to this point
    rollback_validated BOOLEAN DEFAULT FALSE,

    -- Statistics at checkpoint
    record_counts TEXT, -- JSON with record counts per table
    index_statistics TEXT, -- JSON with index usage statistics
    constraint_status TEXT, -- JSON with constraint validation status

    -- Timing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- When this checkpoint can be safely removed

    -- Context
    created_by TEXT,
    notes TEXT
);

-- Create rollback execution log
CREATE TABLE sso_rollback_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rollback_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Source information
    source_checkpoint_id TEXT,
    target_migration_version INTEGER,
    rollback_reason TEXT NOT NULL,

    -- Execution details
    triggered_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
        'initiated', 'validating', 'executing', 'verifying', 'completed', 'failed', 'aborted'
    )),

    -- Rollback steps
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    failed_steps INTEGER DEFAULT 0,
    current_step TEXT,

    -- Safety checks
    pre_rollback_validation BOOLEAN DEFAULT FALSE,
    post_rollback_validation BOOLEAN DEFAULT FALSE,
    data_integrity_verified BOOLEAN DEFAULT FALSE,

    -- Results
    records_affected INTEGER DEFAULT 0,
    tables_modified INTEGER DEFAULT 0,
    constraints_restored INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,

    -- Timing
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    total_duration_ms INTEGER,

    -- Error handling
    error_message TEXT,
    error_details TEXT, -- JSON with detailed error information
    recovery_actions TEXT, -- JSON with recovery steps taken

    FOREIGN KEY (source_checkpoint_id) REFERENCES sso_migration_checkpoints (id) ON DELETE SET NULL
);

-- Create constraint validation table
CREATE TABLE sso_constraint_validations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    constraint_name TEXT NOT NULL,
    constraint_type TEXT NOT NULL CHECK (constraint_type IN (
        'foreign_key', 'unique', 'check', 'not_null', 'primary_key'
    )),
    table_name TEXT NOT NULL,
    column_name TEXT,

    -- Validation configuration
    validation_query TEXT NOT NULL,
    expected_violations INTEGER DEFAULT 0, -- Expected number of violations (0 = no violations expected)
    tolerance_level TEXT DEFAULT 'strict' CHECK (tolerance_level IN ('strict', 'moderate', 'relaxed')),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_validated DATETIME,
    last_status TEXT CHECK (last_status IN ('passed', 'failed', 'warning')),
    violation_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create data integrity monitoring
CREATE TABLE sso_data_integrity_monitors (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    monitor_name TEXT UNIQUE NOT NULL,
    description TEXT,

    -- Monitoring configuration
    monitor_type TEXT NOT NULL CHECK (monitor_type IN (
        'referential_integrity', 'data_consistency', 'orphaned_records',
        'duplicate_detection', 'data_quality', 'business_rules'
    )),
    table_names TEXT NOT NULL, -- JSON array of tables to monitor
    monitoring_query TEXT NOT NULL,

    -- Thresholds
    error_threshold INTEGER DEFAULT 0, -- Maximum acceptable errors
    warning_threshold INTEGER DEFAULT 5, -- Warning level
    critical_threshold INTEGER DEFAULT 10, -- Critical level

    -- Schedule
    schedule_enabled BOOLEAN DEFAULT TRUE,
    schedule_interval_minutes INTEGER DEFAULT 60,
    last_run_at DATETIME,
    next_run_at DATETIME,

    -- Alerting
    alert_on_error BOOLEAN DEFAULT TRUE,
    alert_on_warning BOOLEAN DEFAULT FALSE,
    alert_recipients TEXT, -- JSON array of email addresses

    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create integrity monitoring results
CREATE TABLE sso_integrity_monitoring_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    monitor_id TEXT NOT NULL,
    execution_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Results
    status TEXT NOT NULL CHECK (status IN ('passed', 'warning', 'error', 'critical', 'timeout')),
    violations_found INTEGER DEFAULT 0,
    details TEXT, -- JSON with detailed results
    affected_records TEXT, -- JSON with IDs of affected records

    -- Performance
    execution_time_ms INTEGER,
    records_checked INTEGER DEFAULT 0,

    -- Actions taken
    auto_fix_applied BOOLEAN DEFAULT FALSE,
    auto_fix_details TEXT,
    notifications_sent BOOLEAN DEFAULT FALSE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (monitor_id) REFERENCES sso_data_integrity_monitors (id) ON DELETE CASCADE
);

-- Insert default validation rules for SSO system
INSERT INTO sso_data_validation_rules (
    rule_name, description, category, rule_type, target_table, validation_query, severity_level
) VALUES
('sso_users_email_required', 'Users must have an email address', 'data_integrity', 'not_null', 'sso_users', 'SELECT COUNT(*) FROM sso_users WHERE email IS NULL OR email = ""', 'error'),
('sso_users_email_unique', 'User email addresses must be unique', 'data_integrity', 'unique', 'sso_users', 'SELECT email, COUNT(*) FROM sso_users GROUP BY email HAVING COUNT(*) > 1', 'error'),
('sso_users_email_format', 'User email must be valid format', 'data_integrity', 'format_validation', 'sso_users', 'SELECT COUNT(*) FROM sso_users WHERE email NOT LIKE "%@%"', 'error'),
('sso_sessions_valid_users', 'All sessions must belong to existing users', 'data_integrity', 'foreign_key', 'sso_sessions', 'SELECT COUNT(*) FROM sso_sessions s LEFT JOIN sso_users u ON s.user_id = u.id WHERE u.id IS NULL', 'error'),
('sso_role_assignments_valid_users', 'Role assignments must reference existing users', 'data_integrity', 'foreign_key', 'sso_user_role_assignments', 'SELECT COUNT(*) FROM sso_user_role_assignments ra LEFT JOIN sso_users u ON ra.user_id = u.id WHERE u.id IS NULL', 'error'),
('sso_role_assignments_valid_roles', 'Role assignments must reference existing roles', 'data_integrity', 'foreign_key', 'sso_user_role_assignments', 'SELECT COUNT(*) FROM sso_user_role_assignments ra LEFT JOIN sso_user_roles r ON ra.role_id = r.id WHERE r.id IS NULL', 'error'),
('sso_api_keys_valid_users', 'API keys must belong to existing users or services', 'data_integrity', 'custom_query', 'sso_api_keys', 'SELECT COUNT(*) FROM sso_api_keys k LEFT JOIN sso_users u ON k.user_id = u.id WHERE k.user_id IS NOT NULL AND u.id IS NULL', 'error'),
('sso_audit_logs_required_fields', 'Audit logs must have required fields', 'data_integrity', 'custom_query', 'sso_audit_logs', 'SELECT COUNT(*) FROM sso_audit_logs WHERE event_type IS NULL OR category IS NULL OR timestamp IS NULL', 'error'),
('sso_sessions_expiry_logic', 'Active sessions must not be expired', 'business_logic', 'custom_query', 'sso_sessions', 'SELECT COUNT(*) FROM sso_sessions WHERE status = "active" AND expires_at <= datetime("now")', 'warning'),
('sso_security_events_severity_valid', 'Security events must have valid severity levels', 'data_integrity', 'check_constraint', 'sso_security_events', 'SELECT COUNT(*) FROM sso_security_events WHERE severity NOT IN ("critical", "high", "medium", "low")', 'error');

-- Insert default constraint validations
INSERT INTO sso_constraint_validations (constraint_name, constraint_type, table_name, validation_query) VALUES
('fk_sso_sessions_user_id', 'foreign_key', 'sso_sessions', 'SELECT COUNT(*) FROM sso_sessions s LEFT JOIN sso_users u ON s.user_id = u.id WHERE u.id IS NULL'),
('fk_sso_user_role_assignments_user_id', 'foreign_key', 'sso_user_role_assignments', 'SELECT COUNT(*) FROM sso_user_role_assignments ra LEFT JOIN sso_users u ON ra.user_id = u.id WHERE u.id IS NULL'),
('fk_sso_user_role_assignments_role_id', 'foreign_key', 'sso_user_role_assignments', 'SELECT COUNT(*) FROM sso_user_role_assignments ra LEFT JOIN sso_user_roles r ON ra.role_id = r.id WHERE r.id IS NULL'),
('unique_sso_users_email', 'unique', 'sso_users', 'SELECT email, COUNT(*) as cnt FROM sso_users GROUP BY email HAVING cnt > 1'),
('unique_sso_user_roles_name', 'unique', 'sso_user_roles', 'SELECT name, COUNT(*) as cnt FROM sso_user_roles GROUP BY name HAVING cnt > 1'),
('check_sso_users_status', 'check', 'sso_users', 'SELECT COUNT(*) FROM sso_users WHERE status NOT IN ("active", "inactive", "suspended", "deleted")');

-- Insert default data integrity monitors
INSERT INTO sso_data_integrity_monitors (
    monitor_name, description, monitor_type, table_names, monitoring_query, error_threshold, warning_threshold
) VALUES
('orphaned_sessions', 'Monitor for sessions without valid users', 'orphaned_records', '["sso_sessions"]',
 'SELECT COUNT(*) FROM sso_sessions s LEFT JOIN sso_users u ON s.user_id = u.id WHERE u.id IS NULL', 0, 0),
('orphaned_role_assignments', 'Monitor for role assignments without valid users or roles', 'orphaned_records', '["sso_user_role_assignments"]',
 'SELECT COUNT(*) FROM sso_user_role_assignments ra LEFT JOIN sso_users u ON ra.user_id = u.id LEFT JOIN sso_user_roles r ON ra.role_id = r.id WHERE u.id IS NULL OR r.id IS NULL', 0, 0),
('duplicate_user_emails', 'Monitor for duplicate user email addresses', 'duplicate_detection', '["sso_users"]',
 'SELECT COUNT(*) FROM (SELECT email FROM sso_users GROUP BY email HAVING COUNT(*) > 1)', 0, 0),
('expired_active_sessions', 'Monitor for expired sessions that are still marked as active', 'business_rules', '["sso_sessions"]',
 'SELECT COUNT(*) FROM sso_sessions WHERE status = "active" AND expires_at <= datetime("now")', 0, 5),
('security_events_without_details', 'Monitor for security events missing required details', 'data_quality', '["sso_security_events"]',
 'SELECT COUNT(*) FROM sso_security_events WHERE threat_code IS NULL OR severity IS NULL OR ip_address IS NULL', 0, 0);

-- Create indexes for validation and rollback tables
CREATE INDEX idx_sso_data_validation_rules_category ON sso_data_validation_rules (category);
CREATE INDEX idx_sso_data_validation_rules_target_table ON sso_data_validation_rules (target_table);
CREATE INDEX idx_sso_data_validation_rules_active ON sso_data_validation_rules (is_active);

CREATE INDEX idx_sso_validation_executions_rule_id ON sso_validation_executions (validation_rule_id);
CREATE INDEX idx_sso_validation_executions_status ON sso_validation_executions (status);
CREATE INDEX idx_sso_validation_executions_started_at ON sso_validation_executions (started_at);
CREATE INDEX idx_sso_validation_executions_trigger_type ON sso_validation_executions (trigger_type);

CREATE INDEX idx_sso_migration_checkpoints_version ON sso_migration_checkpoints (migration_version);
CREATE INDEX idx_sso_migration_checkpoints_type ON sso_migration_checkpoints (checkpoint_type);
CREATE INDEX idx_sso_migration_checkpoints_created_at ON sso_migration_checkpoints (created_at);

CREATE INDEX idx_sso_rollback_executions_checkpoint_id ON sso_rollback_executions (source_checkpoint_id);
CREATE INDEX idx_sso_rollback_executions_status ON sso_rollback_executions (status);
CREATE INDEX idx_sso_rollback_executions_started_at ON sso_rollback_executions (started_at);

CREATE INDEX idx_sso_constraint_validations_table_name ON sso_constraint_validations (table_name);
CREATE INDEX idx_sso_constraint_validations_constraint_type ON sso_constraint_validations (constraint_type);
CREATE INDEX idx_sso_constraint_validations_active ON sso_constraint_validations (is_active);

CREATE INDEX idx_sso_data_integrity_monitors_type ON sso_data_integrity_monitors (monitor_type);
CREATE INDEX idx_sso_data_integrity_monitors_next_run ON sso_data_integrity_monitors (next_run_at);
CREATE INDEX idx_sso_data_integrity_monitors_active ON sso_data_integrity_monitors (is_active);

CREATE INDEX idx_sso_integrity_monitoring_results_monitor_id ON sso_integrity_monitoring_results (monitor_id);
CREATE INDEX idx_sso_integrity_monitoring_results_status ON sso_integrity_monitoring_results (status);
CREATE INDEX idx_sso_integrity_monitoring_results_created_at ON sso_integrity_monitoring_results (created_at);

-- DOWN
-- Rollback for: Create Data Validation and Rollback Safety Mechanisms

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_integrity_monitoring_results_created_at;
DROP INDEX IF EXISTS idx_sso_integrity_monitoring_results_status;
DROP INDEX IF EXISTS idx_sso_integrity_monitoring_results_monitor_id;
DROP INDEX IF EXISTS idx_sso_data_integrity_monitors_active;
DROP INDEX IF EXISTS idx_sso_data_integrity_monitors_next_run;
DROP INDEX IF EXISTS idx_sso_data_integrity_monitors_type;
DROP INDEX IF EXISTS idx_sso_constraint_validations_active;
DROP INDEX IF EXISTS idx_sso_constraint_validations_constraint_type;
DROP INDEX IF EXISTS idx_sso_constraint_validations_table_name;
DROP INDEX IF EXISTS idx_sso_rollback_executions_started_at;
DROP INDEX IF EXISTS idx_sso_rollback_executions_status;
DROP INDEX IF EXISTS idx_sso_rollback_executions_checkpoint_id;
DROP INDEX IF EXISTS idx_sso_migration_checkpoints_created_at;
DROP INDEX IF EXISTS idx_sso_migration_checkpoints_type;
DROP INDEX IF EXISTS idx_sso_migration_checkpoints_version;
DROP INDEX IF EXISTS idx_sso_validation_executions_trigger_type;
DROP INDEX IF EXISTS idx_sso_validation_executions_started_at;
DROP INDEX IF EXISTS idx_sso_validation_executions_status;
DROP INDEX IF EXISTS idx_sso_validation_executions_rule_id;
DROP INDEX IF EXISTS idx_sso_data_validation_rules_active;
DROP INDEX IF EXISTS idx_sso_data_validation_rules_target_table;
DROP INDEX IF EXISTS idx_sso_data_validation_rules_category;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_integrity_monitoring_results;
DROP TABLE IF EXISTS sso_data_integrity_monitors;
DROP TABLE IF EXISTS sso_constraint_validations;
DROP TABLE IF EXISTS sso_rollback_executions;
DROP TABLE IF EXISTS sso_migration_checkpoints;
DROP TABLE IF EXISTS sso_validation_executions;
DROP TABLE IF EXISTS sso_data_validation_rules;