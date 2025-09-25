-- UP
-- Migration: Create Security Events Tracking and Alerting Tables
-- Version: 006
-- Generated: 2024-09-24T13:05:00.000Z

-- Create security threat types
CREATE TABLE sso_security_threat_types (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    threat_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'authentication', 'authorization', 'injection', 'exposure',
        'cryptography', 'logging', 'deserialization', 'validation',
        'session_management', 'access_control', 'other'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    owasp_category TEXT, -- OWASP Top 10 category
    cwe_id INTEGER, -- CWE (Common Weakness Enumeration) ID
    auto_block BOOLEAN DEFAULT FALSE,
    auto_alert BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create main security events table
CREATE TABLE sso_security_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Threat classification
    threat_type_id TEXT NOT NULL,
    threat_code TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    confidence_score REAL DEFAULT 0.0 CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),

    -- Actor information
    user_id TEXT,
    session_id TEXT,
    ip_address TEXT NOT NULL,
    user_agent TEXT,

    -- Geographic information
    country TEXT,
    region TEXT,
    city TEXT,
    isp TEXT,
    is_tor BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    is_vpn BOOLEAN DEFAULT FALSE,

    -- Attack details
    attack_vector TEXT, -- How the attack was attempted
    payload TEXT, -- The malicious payload (sanitized)
    target_endpoint TEXT, -- What was targeted
    target_parameter TEXT, -- Specific parameter targeted

    -- Request information
    http_method TEXT,
    request_url TEXT,
    request_headers TEXT, -- JSON of suspicious headers
    request_body TEXT, -- Sanitized request body

    -- Response information
    response_status INTEGER,
    response_time_ms INTEGER,

    -- Detection information
    detection_method TEXT CHECK (detection_method IN (
        'rule_based', 'ml_model', 'signature', 'anomaly', 'rate_limit', 'manual'
    )),
    detection_rule TEXT, -- Which rule triggered
    detection_confidence REAL DEFAULT 1.0,

    -- Status and handling
    status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN (
        'detected', 'investigating', 'confirmed', 'false_positive', 'resolved', 'ignored'
    )),
    blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT,

    -- Incident management
    incident_id TEXT,
    assigned_to TEXT,
    resolution TEXT,
    resolution_time_hours REAL,

    -- Additional context
    message TEXT,
    details TEXT, -- JSON with additional event details
    evidence TEXT, -- JSON with evidence collected

    -- Timing
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    first_seen DATETIME,
    last_seen DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,

    FOREIGN KEY (threat_type_id) REFERENCES sso_security_threat_types (id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES sso_sessions (id) ON DELETE SET NULL
);

-- Create attack patterns table
CREATE TABLE sso_attack_patterns (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pattern_name TEXT UNIQUE NOT NULL,
    description TEXT,
    threat_types TEXT, -- JSON array of applicable threat types

    -- Pattern definition
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'frequency', 'sequence', 'geographic', 'behavioral', 'signature'
    )),
    pattern_rules TEXT NOT NULL, -- JSON configuration for pattern matching

    -- Thresholds
    time_window_minutes INTEGER DEFAULT 60,
    occurrence_threshold INTEGER DEFAULT 10,
    severity_threshold TEXT DEFAULT 'medium',

    -- Actions
    auto_block BOOLEAN DEFAULT FALSE,
    auto_alert BOOLEAN DEFAULT TRUE,
    escalation_time_hours INTEGER DEFAULT 24,

    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);

-- Create IP reputation table
CREATE TABLE sso_ip_reputation (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ip_address TEXT UNIQUE NOT NULL,

    -- Reputation scoring
    reputation_score INTEGER DEFAULT 0 CHECK (reputation_score BETWEEN -100 AND 100),
    threat_level TEXT DEFAULT 'unknown' CHECK (threat_level IN (
        'trusted', 'low', 'medium', 'high', 'critical', 'unknown'
    )),

    -- Classification
    ip_type TEXT DEFAULT 'unknown' CHECK (ip_type IN (
        'residential', 'business', 'hosting', 'tor', 'proxy', 'vpn',
        'botnet', 'scanner', 'malware', 'spam', 'unknown'
    )),

    -- Geographic information
    country TEXT,
    region TEXT,
    city TEXT,
    isp TEXT,
    organization TEXT,

    -- Activity tracking
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_requests INTEGER DEFAULT 0,
    suspicious_requests INTEGER DEFAULT 0,
    blocked_requests INTEGER DEFAULT 0,

    -- Reputation sources
    reputation_sources TEXT, -- JSON array of sources that contributed to reputation

    -- Manual overrides
    is_whitelisted BOOLEAN DEFAULT FALSE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    manual_score INTEGER, -- Manual override score
    notes TEXT,

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

-- Create rate limiting violations table
CREATE TABLE sso_rate_limit_violations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Violator information
    ip_address TEXT NOT NULL,
    user_id TEXT,
    user_agent TEXT,

    -- Rate limit details
    limit_type TEXT NOT NULL CHECK (limit_type IN (
        'login_attempts', 'api_calls', 'requests_per_minute',
        'requests_per_hour', 'data_export', 'password_resets'
    )),
    limit_value INTEGER NOT NULL,
    current_count INTEGER NOT NULL,
    time_window_minutes INTEGER NOT NULL,

    -- Violation details
    endpoint TEXT,
    exceeded_by INTEGER, -- How much they exceeded the limit
    violation_duration_minutes INTEGER,

    -- Actions taken
    action_taken TEXT CHECK (action_taken IN (
        'warning', 'temporary_block', 'permanent_block', 'captcha',
        'account_lock', 'ip_block', 'none'
    )),
    block_duration_minutes INTEGER,

    -- Context
    request_details TEXT, -- JSON with request information

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,

    FOREIGN KEY (user_id) REFERENCES sso_users (id) ON DELETE SET NULL
);

-- Create security alerts table
CREATE TABLE sso_security_alerts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    alert_uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),

    -- Alert classification
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'security_event', 'anomaly', 'threshold_breach', 'pattern_match',
        'compliance_violation', 'system_health', 'other'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), -- 1=highest, 5=lowest

    -- Alert content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,

    -- Source information
    source_type TEXT NOT NULL CHECK (source_type IN (
        'security_event', 'attack_pattern', 'rate_limit', 'system_monitor', 'manual'
    )),
    source_id TEXT, -- ID of the source event/pattern

    -- Affected entities
    affected_users TEXT, -- JSON array of affected user IDs
    affected_ips TEXT, -- JSON array of affected IP addresses
    affected_resources TEXT, -- JSON array of affected resources

    -- Status and handling
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'acknowledged', 'investigating', 'resolved', 'false_positive', 'suppressed'
    )),
    assigned_to TEXT,
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    resolution TEXT,
    resolution_time_hours REAL,

    -- Escalation
    escalation_level INTEGER DEFAULT 1,
    escalated_at DATETIME,
    escalated_to TEXT,

    -- Notification tracking
    notifications_sent TEXT, -- JSON array of notification methods used
    notification_count INTEGER DEFAULT 0,

    -- Additional data
    alert_data TEXT, -- JSON with alert-specific data
    tags TEXT, -- JSON array of tags

    -- Timing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    suppressed_until DATETIME
);

-- Create security metrics aggregation table
CREATE TABLE sso_security_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    metric_date DATE NOT NULL,
    metric_hour INTEGER CHECK (metric_hour BETWEEN 0 AND 23),

    -- Event counts
    total_security_events INTEGER DEFAULT 0,
    critical_events INTEGER DEFAULT 0,
    high_events INTEGER DEFAULT 0,
    medium_events INTEGER DEFAULT 0,
    low_events INTEGER DEFAULT 0,

    -- Attack types
    authentication_attacks INTEGER DEFAULT 0,
    authorization_attacks INTEGER DEFAULT 0,
    injection_attacks INTEGER DEFAULT 0,
    other_attacks INTEGER DEFAULT 0,

    -- Actions taken
    auto_blocked_ips INTEGER DEFAULT 0,
    manual_blocks INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,

    -- Rate limiting
    rate_limit_violations INTEGER DEFAULT 0,
    blocked_requests INTEGER DEFAULT 0,

    -- Alerts
    alerts_generated INTEGER DEFAULT 0,
    alerts_resolved INTEGER DEFAULT 0,
    average_resolution_time_hours REAL DEFAULT 0.0,

    -- Top threats
    top_threat_type TEXT,
    top_source_ip TEXT,
    top_target_endpoint TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (metric_date, metric_hour)
);

-- Insert default security threat types
INSERT INTO sso_security_threat_types (threat_code, name, description, category, severity, owasp_category, auto_block, auto_alert) VALUES
('BRUTE_FORCE', 'Brute Force Attack', 'Repeated login attempts with different passwords', 'authentication', 'high', 'A07:2021', TRUE, TRUE),
('CREDENTIAL_STUFFING', 'Credential Stuffing', 'Using leaked credentials to gain access', 'authentication', 'high', 'A07:2021', TRUE, TRUE),
('SQL_INJECTION', 'SQL Injection', 'Attempting to inject SQL code', 'injection', 'critical', 'A03:2021', TRUE, TRUE),
('XSS_ATTEMPT', 'Cross-Site Scripting', 'Attempting to inject malicious scripts', 'injection', 'high', 'A03:2021', TRUE, TRUE),
('CSRF_ATTACK', 'Cross-Site Request Forgery', 'Forged cross-site requests', 'session_management', 'medium', 'A01:2021', FALSE, TRUE),
('PRIVILEGE_ESCALATION', 'Privilege Escalation', 'Attempting to gain higher privileges', 'authorization', 'critical', 'A01:2021', TRUE, TRUE),
('SUSPICIOUS_LOGIN', 'Suspicious Login', 'Login from unusual location or pattern', 'authentication', 'medium', 'A07:2021', FALSE, TRUE),
('DATA_EXFILTRATION', 'Data Exfiltration Attempt', 'Large or unusual data access patterns', 'exposure', 'high', 'A01:2021', FALSE, TRUE),
('RATE_LIMIT_ABUSE', 'Rate Limit Abuse', 'Excessive requests exceeding rate limits', 'other', 'medium', NULL, TRUE, TRUE),
('MALICIOUS_FILE_UPLOAD', 'Malicious File Upload', 'Attempting to upload malicious files', 'injection', 'high', 'A03:2021', TRUE, TRUE);

-- Insert default attack patterns
INSERT INTO sso_attack_patterns (pattern_name, description, pattern_type, pattern_rules, time_window_minutes, occurrence_threshold) VALUES
('Rapid Login Attempts', 'Multiple failed login attempts in short time', 'frequency',
'{"event_type": "user_login_failed", "field": "ip_address", "threshold": 5, "window": 10}', 10, 5),

('Geographic Anomaly', 'Login from unusual geographic location', 'geographic',
'{"event_type": "user_login", "check_distance": true, "max_distance_km": 1000, "time_threshold_hours": 4}', 240, 1),

('Credential Stuffing Pattern', 'Many login attempts with different usernames from same IP', 'behavioral',
'{"event_type": "user_login_failed", "field": "ip_address", "unique_usernames": 10, "window": 60}', 60, 10),

('API Abuse Pattern', 'Excessive API calls from single source', 'frequency',
'{"event_type": "api_call", "field": "ip_address", "threshold": 1000, "window": 60}', 60, 1000);

-- Create comprehensive indexes for performance
CREATE INDEX idx_sso_security_events_threat_type_id ON sso_security_events (threat_type_id);
CREATE INDEX idx_sso_security_events_threat_code ON sso_security_events (threat_code);
CREATE INDEX idx_sso_security_events_severity ON sso_security_events (severity);
CREATE INDEX idx_sso_security_events_user_id ON sso_security_events (user_id);
CREATE INDEX idx_sso_security_events_ip_address ON sso_security_events (ip_address);
CREATE INDEX idx_sso_security_events_detected_at ON sso_security_events (detected_at DESC);
CREATE INDEX idx_sso_security_events_status ON sso_security_events (status);
CREATE INDEX idx_sso_security_events_blocked ON sso_security_events (blocked);
CREATE INDEX idx_sso_security_events_risk_score ON sso_security_events (risk_score DESC);

CREATE INDEX idx_sso_ip_reputation_ip_address ON sso_ip_reputation (ip_address);
CREATE INDEX idx_sso_ip_reputation_threat_level ON sso_ip_reputation (threat_level);
CREATE INDEX idx_sso_ip_reputation_reputation_score ON sso_ip_reputation (reputation_score);
CREATE INDEX idx_sso_ip_reputation_whitelisted ON sso_ip_reputation (is_whitelisted);
CREATE INDEX idx_sso_ip_reputation_blacklisted ON sso_ip_reputation (is_blacklisted);

CREATE INDEX idx_sso_rate_limit_violations_ip_address ON sso_rate_limit_violations (ip_address);
CREATE INDEX idx_sso_rate_limit_violations_user_id ON sso_rate_limit_violations (user_id);
CREATE INDEX idx_sso_rate_limit_violations_limit_type ON sso_rate_limit_violations (limit_type);
CREATE INDEX idx_sso_rate_limit_violations_created_at ON sso_rate_limit_violations (created_at);
CREATE INDEX idx_sso_rate_limit_violations_expires_at ON sso_rate_limit_violations (expires_at);

CREATE INDEX idx_sso_security_alerts_alert_type ON sso_security_alerts (alert_type);
CREATE INDEX idx_sso_security_alerts_severity ON sso_security_alerts (severity);
CREATE INDEX idx_sso_security_alerts_status ON sso_security_alerts (status);
CREATE INDEX idx_sso_security_alerts_created_at ON sso_security_alerts (created_at DESC);
CREATE INDEX idx_sso_security_alerts_assigned_to ON sso_security_alerts (assigned_to);
CREATE INDEX idx_sso_security_alerts_suppressed_until ON sso_security_alerts (suppressed_until);

CREATE INDEX idx_sso_security_metrics_metric_date ON sso_security_metrics (metric_date);
CREATE INDEX idx_sso_security_metrics_metric_hour ON sso_security_metrics (metric_hour);
CREATE INDEX idx_sso_security_metrics_created_at ON sso_security_metrics (created_at);

-- DOWN
-- Rollback for: Create Security Events Tracking and Alerting Tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_sso_security_metrics_created_at;
DROP INDEX IF EXISTS idx_sso_security_metrics_metric_hour;
DROP INDEX IF EXISTS idx_sso_security_metrics_metric_date;
DROP INDEX IF EXISTS idx_sso_security_alerts_suppressed_until;
DROP INDEX IF EXISTS idx_sso_security_alerts_assigned_to;
DROP INDEX IF EXISTS idx_sso_security_alerts_created_at;
DROP INDEX IF EXISTS idx_sso_security_alerts_status;
DROP INDEX IF EXISTS idx_sso_security_alerts_severity;
DROP INDEX IF EXISTS idx_sso_security_alerts_alert_type;
DROP INDEX IF EXISTS idx_sso_rate_limit_violations_expires_at;
DROP INDEX IF EXISTS idx_sso_rate_limit_violations_created_at;
DROP INDEX IF EXISTS idx_sso_rate_limit_violations_limit_type;
DROP INDEX IF EXISTS idx_sso_rate_limit_violations_user_id;
DROP INDEX IF EXISTS idx_sso_rate_limit_violations_ip_address;
DROP INDEX IF EXISTS idx_sso_ip_reputation_blacklisted;
DROP INDEX IF EXISTS idx_sso_ip_reputation_whitelisted;
DROP INDEX IF EXISTS idx_sso_ip_reputation_reputation_score;
DROP INDEX IF EXISTS idx_sso_ip_reputation_threat_level;
DROP INDEX IF EXISTS idx_sso_ip_reputation_ip_address;
DROP INDEX IF EXISTS idx_sso_security_events_risk_score;
DROP INDEX IF EXISTS idx_sso_security_events_blocked;
DROP INDEX IF EXISTS idx_sso_security_events_status;
DROP INDEX IF EXISTS idx_sso_security_events_detected_at;
DROP INDEX IF EXISTS idx_sso_security_events_ip_address;
DROP INDEX IF EXISTS idx_sso_security_events_user_id;
DROP INDEX IF EXISTS idx_sso_security_events_severity;
DROP INDEX IF EXISTS idx_sso_security_events_threat_code;
DROP INDEX IF EXISTS idx_sso_security_events_threat_type_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sso_security_metrics;
DROP TABLE IF EXISTS sso_security_alerts;
DROP TABLE IF EXISTS sso_rate_limit_violations;
DROP TABLE IF EXISTS sso_ip_reputation;
DROP TABLE IF EXISTS sso_attack_patterns;
DROP TABLE IF EXISTS sso_security_events;
DROP TABLE IF EXISTS sso_security_threat_types;