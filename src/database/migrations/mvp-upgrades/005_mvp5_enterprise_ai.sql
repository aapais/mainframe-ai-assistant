-- UP
-- Migration: MVP5 Enterprise AI and Auto-Resolution
-- Version: 005
-- Generated: 2025-01-11
-- Description: Add enterprise AI features, auto-resolution, predictive analytics, and governance

-- ===== AUTO-RESOLUTION SYSTEM TABLES =====

-- Auto-resolution rules and configurations
CREATE TABLE IF NOT EXISTS auto_resolution_rules (
    id TEXT PRIMARY KEY,
    rule_name TEXT NOT NULL,
    description TEXT,
    incident_pattern TEXT NOT NULL, -- JSON pattern matching criteria
    kb_entry_id TEXT, -- Preferred KB solution
    resolution_script TEXT, -- Automated resolution steps
    confidence_threshold REAL DEFAULT 0.85 CHECK(confidence_threshold >= 0 AND confidence_threshold <= 1),
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE,
    max_retry_attempts INTEGER DEFAULT 3,
    cooldown_minutes INTEGER DEFAULT 60,
    success_rate REAL DEFAULT 0.0,
    total_attempts INTEGER DEFAULT 0,
    successful_attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    tags TEXT, -- JSON array of tags
    FOREIGN KEY (kb_entry_id) REFERENCES kb_entries(id) ON DELETE SET NULL
);

-- Auto-resolution attempts and results
CREATE TABLE IF NOT EXISTS auto_resolution_attempts (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    rule_id TEXT,
    attempt_number INTEGER DEFAULT 1,
    status TEXT CHECK(status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'requires_approval')) NOT NULL,
    confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 1),
    resolution_steps TEXT, -- JSON array of steps taken
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_seconds INTEGER,
    rollback_performed BOOLEAN DEFAULT FALSE,
    rollback_reason TEXT,
    human_validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    validated_by TEXT,
    validated_at DATETIME,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES auto_resolution_rules(id) ON DELETE SET NULL
);

-- ===== PREDICTIVE ANALYTICS TABLES =====

-- Machine learning models for prediction
CREATE TABLE IF NOT EXISTS ml_models (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_type TEXT CHECK(model_type IN ('classification', 'regression', 'clustering', 'time_series', 'anomaly_detection')) NOT NULL,
    purpose TEXT CHECK(purpose IN ('incident_prediction', 'component_health', 'failure_prediction', 'pattern_detection', 'resource_optimization')) NOT NULL,
    model_version TEXT DEFAULT '1.0',
    model_data BLOB, -- Serialized model data
    training_data_hash TEXT,
    features TEXT, -- JSON array of feature definitions
    hyperparameters TEXT, -- JSON object with model parameters
    performance_metrics TEXT, -- JSON object with accuracy, precision, recall, etc.
    training_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    model_format TEXT DEFAULT 'tensorflow_js',
    created_by TEXT DEFAULT 'system'
);

-- Predictive analytics results
CREATE TABLE IF NOT EXISTS prediction_results (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    prediction_type TEXT CHECK(prediction_type IN ('incident_likelihood', 'component_failure', 'resource_exhaustion', 'performance_degradation', 'security_risk')) NOT NULL,
    target_component TEXT,
    prediction_value REAL NOT NULL,
    confidence_level REAL CHECK(confidence_level >= 0 AND confidence_level <= 1) NOT NULL,
    prediction_horizon_hours INTEGER, -- How far into the future
    features_used TEXT, -- JSON object with feature values
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    actual_outcome BOOLEAN, -- Whether the prediction came true
    outcome_recorded_at DATETIME,
    accuracy_score REAL,
    FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE CASCADE
);

-- Predictive alerts and recommendations
CREATE TABLE IF NOT EXISTS predictive_alerts (
    id TEXT PRIMARY KEY,
    prediction_id TEXT NOT NULL,
    alert_type TEXT CHECK(alert_type IN ('preventive_maintenance', 'capacity_warning', 'failure_imminent', 'performance_degradation', 'security_threat')) NOT NULL,
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')) DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommended_actions TEXT, -- JSON array of recommended actions
    target_component TEXT,
    estimated_impact TEXT,
    time_to_act_hours INTEGER,
    status TEXT CHECK(status IN ('active', 'acknowledged', 'resolved', 'false_positive')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    acknowledged_by TEXT,
    resolved_at DATETIME,
    resolution_notes TEXT,
    feedback_rating INTEGER CHECK(feedback_rating >= 1 AND feedback_rating <= 5),
    FOREIGN KEY (prediction_id) REFERENCES prediction_results(id) ON DELETE CASCADE
);

-- ===== CONTINUOUS LEARNING SYSTEM TABLES =====

-- Learning feedback from user interactions
CREATE TABLE IF NOT EXISTS learning_feedback (
    id TEXT PRIMARY KEY,
    feedback_type TEXT CHECK(feedback_type IN ('resolution_outcome', 'prediction_accuracy', 'template_effectiveness', 'kb_relevance', 'code_suggestion')) NOT NULL,
    source_id TEXT NOT NULL, -- ID from source table (incident, prediction, template, etc.)
    source_type TEXT NOT NULL, -- Type of source (incident, prediction, template, etc.)
    feedback_value TEXT NOT NULL, -- Success/failure, rating, correction, etc.
    feedback_data TEXT, -- JSON with detailed feedback
    confidence_impact REAL DEFAULT 0.0, -- How much this affects confidence scores
    learning_weight REAL DEFAULT 1.0, -- Importance weight for learning
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    processed BOOLEAN DEFAULT FALSE,
    processed_at DATETIME
);

-- Model performance tracking over time
CREATE TABLE IF NOT EXISTS model_performance (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    evaluation_date DATE NOT NULL,
    accuracy REAL,
    precision_score REAL,
    recall REAL,
    f1_score REAL,
    true_positives INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    true_negatives INTEGER DEFAULT 0,
    false_negatives INTEGER DEFAULT 0,
    sample_size INTEGER,
    data_drift_score REAL, -- Measure of data drift
    performance_trend TEXT CHECK(performance_trend IN ('improving', 'stable', 'degrading', 'unknown')) DEFAULT 'unknown',
    retraining_recommended BOOLEAN DEFAULT FALSE,
    notes TEXT,
    FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE CASCADE,
    UNIQUE(model_id, evaluation_date)
);

-- Knowledge evolution tracking
CREATE TABLE IF NOT EXISTS knowledge_evolution (
    id TEXT PRIMARY KEY,
    evolution_type TEXT CHECK(evolution_type IN ('kb_enrichment', 'pattern_refinement', 'template_optimization', 'rule_adaptation', 'model_update')) NOT NULL,
    source_data TEXT, -- JSON with source information
    changes_made TEXT, -- JSON describing changes
    impact_score REAL DEFAULT 0.0, -- Estimated impact of changes
    validation_status TEXT CHECK(validation_status IN ('pending', 'validated', 'rejected')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    validated_at DATETIME,
    validated_by TEXT
);

-- ===== ENTERPRISE GOVERNANCE TABLES =====

-- User management and roles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT CHECK(role IN ('admin', 'analyst', 'developer', 'manager', 'viewer', 'auditor')) NOT NULL,
    department TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system',
    password_hash TEXT, -- For local authentication
    sso_provider TEXT, -- SSO provider if used
    sso_user_id TEXT, -- External SSO user ID
    preferences TEXT, -- JSON user preferences
    permissions TEXT -- JSON array of specific permissions
);

-- Audit trail for all system activities
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- kb_entry, incident, template, etc.
    resource_id TEXT NOT NULL,
    old_values TEXT, -- JSON with old values
    new_values TEXT, -- JSON with new values
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Compliance and security policies
CREATE TABLE IF NOT EXISTS compliance_policies (
    id TEXT PRIMARY KEY,
    policy_name TEXT NOT NULL,
    policy_type TEXT CHECK(policy_type IN ('data_retention', 'access_control', 'audit_requirement', 'security_standard', 'change_approval')) NOT NULL,
    description TEXT,
    policy_rules TEXT, -- JSON with policy rules
    is_active BOOLEAN DEFAULT TRUE,
    enforcement_level TEXT CHECK(enforcement_level IN ('advisory', 'warning', 'blocking')) DEFAULT 'warning',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    effective_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    created_by TEXT,
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by TEXT,
    approved_at DATETIME
);

-- Policy violations and compliance tracking
CREATE TABLE IF NOT EXISTS compliance_violations (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    user_id TEXT,
    violation_details TEXT, -- JSON with violation details
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')) DEFAULT 'medium',
    status TEXT CHECK(status IN ('open', 'investigating', 'resolved', 'accepted_risk', 'false_positive')) DEFAULT 'open',
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolution_notes TEXT,
    resolved_by TEXT,
    FOREIGN KEY (policy_id) REFERENCES compliance_policies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ===== ENTERPRISE ANALYTICS TABLES =====

-- Executive dashboards data
CREATE TABLE IF NOT EXISTS executive_metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_category TEXT CHECK(metric_category IN ('operational', 'financial', 'quality', 'productivity', 'risk', 'compliance')) NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    calculation_method TEXT,
    data_source TEXT, -- Source of the metric calculation
    benchmark_value REAL,
    target_value REAL,
    trend TEXT CHECK(trend IN ('improving', 'stable', 'degrading', 'unknown')) DEFAULT 'unknown',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ROI and cost tracking
CREATE TABLE IF NOT EXISTS roi_tracking (
    id TEXT PRIMARY KEY,
    tracking_period_start DATE NOT NULL,
    tracking_period_end DATE NOT NULL,
    category TEXT CHECK(category IN ('time_savings', 'error_reduction', 'productivity_gain', 'cost_avoidance', 'resource_optimization')) NOT NULL,
    baseline_value REAL NOT NULL,
    current_value REAL NOT NULL,
    improvement_value REAL GENERATED ALWAYS AS (current_value - baseline_value) STORED,
    improvement_percentage REAL GENERATED ALWAYS AS (
        CASE WHEN baseline_value != 0 
        THEN ((current_value - baseline_value) / baseline_value) * 100 
        ELSE 0 END
    ) STORED,
    monetary_value REAL, -- Dollar value of improvement
    calculation_notes TEXT,
    validated BOOLEAN DEFAULT FALSE,
    validated_by TEXT,
    validated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== INDEXES FOR ENTERPRISE AI PERFORMANCE =====

-- Auto-resolution indexes
CREATE INDEX IF NOT EXISTS idx_auto_resolution_rules_active ON auto_resolution_rules(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_auto_resolution_rules_success ON auto_resolution_rules(success_rate DESC, total_attempts DESC);
CREATE INDEX IF NOT EXISTS idx_auto_resolution_attempts_incident ON auto_resolution_attempts(incident_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_resolution_attempts_status ON auto_resolution_attempts(status, started_at DESC);

-- ML and predictions indexes
CREATE INDEX IF NOT EXISTS idx_ml_models_active ON ml_models(is_active, model_type);
CREATE INDEX IF NOT EXISTS idx_ml_models_purpose ON ml_models(purpose, is_active);
CREATE INDEX IF NOT EXISTS idx_prediction_results_component ON prediction_results(target_component, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_results_expires ON prediction_results(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_status ON predictive_alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_predictive_alerts_component ON predictive_alerts(target_component, created_at DESC);

-- Learning and performance indexes
CREATE INDEX IF NOT EXISTS idx_learning_feedback_processed ON learning_feedback(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_feedback_type ON learning_feedback(feedback_type, source_type);
CREATE INDEX IF NOT EXISTS idx_model_performance_date ON model_performance(model_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_evolution_type ON knowledge_evolution(evolution_type, validation_status);

-- Governance indexes
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active, role);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_active ON compliance_policies(is_active, policy_type);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_status ON compliance_violations(status, severity);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_policy ON compliance_violations(policy_id, detected_at DESC);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_executive_metrics_category ON executive_metrics(metric_category, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_executive_metrics_period ON executive_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_roi_tracking_period ON roi_tracking(tracking_period_start, tracking_period_end);
CREATE INDEX IF NOT EXISTS idx_roi_tracking_category ON roi_tracking(category, validated);

-- ===== ENTERPRISE AI VIEWS =====

-- View for auto-resolution effectiveness
CREATE VIEW IF NOT EXISTS v_auto_resolution_effectiveness AS
SELECT 
    arr.id,
    arr.rule_name,
    arr.success_rate,
    arr.total_attempts,
    arr.successful_attempts,
    COUNT(ara.id) as recent_attempts,
    COUNT(CASE WHEN ara.status = 'succeeded' THEN 1 END) as recent_successes,
    AVG(ara.duration_seconds) as avg_duration_seconds,
    MAX(ara.started_at) as last_used
FROM auto_resolution_rules arr
LEFT JOIN auto_resolution_attempts ara ON arr.id = ara.rule_id 
    AND ara.started_at > DATE('now', '-30 days')
WHERE arr.is_active = TRUE
GROUP BY arr.id, arr.rule_name, arr.success_rate, arr.total_attempts, arr.successful_attempts
ORDER BY arr.success_rate DESC, arr.total_attempts DESC;

-- View for predictive analytics summary
CREATE VIEW IF NOT EXISTS v_predictive_analytics_summary AS
SELECT 
    DATE(pr.created_at) as prediction_date,
    pr.prediction_type,
    COUNT(*) as total_predictions,
    AVG(pr.confidence_level) as avg_confidence,
    COUNT(CASE WHEN pr.actual_outcome = TRUE THEN 1 END) as correct_predictions,
    COUNT(CASE WHEN pr.actual_outcome IS NOT NULL THEN 1 END) as validated_predictions,
    CASE 
        WHEN COUNT(CASE WHEN pr.actual_outcome IS NOT NULL THEN 1 END) > 0
        THEN ROUND(
            CAST(COUNT(CASE WHEN pr.actual_outcome = TRUE THEN 1 END) AS REAL) / 
            COUNT(CASE WHEN pr.actual_outcome IS NOT NULL THEN 1 END) * 100, 2
        )
        ELSE 0 
    END as accuracy_percentage,
    COUNT(DISTINCT pa.id) as alerts_generated
FROM prediction_results pr
LEFT JOIN predictive_alerts pa ON pr.id = pa.prediction_id
WHERE pr.created_at > DATE('now', '-90 days')
GROUP BY DATE(pr.created_at), pr.prediction_type
ORDER BY prediction_date DESC;

-- View for system ROI dashboard
CREATE VIEW IF NOT EXISTS v_roi_dashboard AS
SELECT 
    rt.category,
    COUNT(*) as measurement_count,
    AVG(rt.improvement_percentage) as avg_improvement_pct,
    SUM(rt.monetary_value) as total_monetary_value,
    AVG(rt.monetary_value) as avg_monetary_value,
    MIN(rt.tracking_period_start) as first_measurement,
    MAX(rt.tracking_period_end) as last_measurement
FROM roi_tracking rt
WHERE rt.validated = TRUE
AND rt.tracking_period_end > DATE('now', '-365 days')
GROUP BY rt.category
ORDER BY total_monetary_value DESC;

-- View for compliance status
CREATE VIEW IF NOT EXISTS v_compliance_status AS
SELECT 
    cp.policy_name,
    cp.policy_type,
    cp.enforcement_level,
    COUNT(cv.id) as total_violations,
    COUNT(CASE WHEN cv.status = 'open' THEN 1 END) as open_violations,
    COUNT(CASE WHEN cv.severity IN ('critical', 'high') THEN 1 END) as high_severity_violations,
    MAX(cv.detected_at) as last_violation,
    cp.is_active
FROM compliance_policies cp
LEFT JOIN compliance_violations cv ON cp.id = cv.policy_id 
    AND cv.detected_at > DATE('now', '-90 days')
WHERE cp.is_active = TRUE
GROUP BY cp.id, cp.policy_name, cp.policy_type, cp.enforcement_level, cp.is_active
ORDER BY open_violations DESC, high_severity_violations DESC;

-- ===== TRIGGERS FOR ENTERPRISE AI =====

-- Update auto-resolution rule success rates
CREATE TRIGGER IF NOT EXISTS tr_update_auto_resolution_success_rate
AFTER INSERT ON auto_resolution_attempts
FOR EACH ROW
WHEN NEW.status IN ('succeeded', 'failed')
BEGIN
    UPDATE auto_resolution_rules
    SET 
        total_attempts = total_attempts + 1,
        successful_attempts = successful_attempts + CASE WHEN NEW.status = 'succeeded' THEN 1 ELSE 0 END,
        success_rate = CAST(successful_attempts AS REAL) / total_attempts * 100,
        last_updated = CURRENT_TIMESTAMP
    WHERE id = NEW.rule_id;
END;

-- Track model usage
CREATE TRIGGER IF NOT EXISTS tr_track_model_usage
AFTER INSERT ON prediction_results
FOR EACH ROW
BEGIN
    UPDATE ml_models
    SET 
        usage_count = usage_count + 1,
        last_used = CURRENT_TIMESTAMP
    WHERE id = NEW.model_id;
END;

-- Process learning feedback automatically
CREATE TRIGGER IF NOT EXISTS tr_process_learning_feedback
AFTER INSERT ON learning_feedback
FOR EACH ROW
BEGIN
    -- This is a placeholder for automatic feedback processing
    -- In a real implementation, this might trigger ML model updates
    UPDATE learning_feedback
    SET processed = TRUE, processed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Audit trail for sensitive operations
CREATE TRIGGER IF NOT EXISTS tr_audit_kb_changes
AFTER UPDATE ON kb_entries
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (
        action, resource_type, resource_id, old_values, new_values
    ) VALUES (
        'UPDATE', 'kb_entry', NEW.id,
        json_object('title', OLD.title, 'solution', OLD.solution),
        json_object('title', NEW.title, 'solution', NEW.solution)
    );
END;

-- ===== ENTERPRISE AI CONFIGURATION =====

-- Add enterprise AI configuration
INSERT OR IGNORE INTO system_config (key, value, type, description) VALUES
('auto_resolution_enabled', 'true', 'boolean', 'Enable automatic incident resolution'),
('auto_resolution_confidence_threshold', '0.85', 'float', 'Minimum confidence for auto-resolution'),
('predictive_analytics_enabled', 'true', 'boolean', 'Enable predictive analytics'),
('continuous_learning_enabled', 'true', 'boolean', 'Enable continuous learning from feedback'),
('audit_logging_enabled', 'true', 'boolean', 'Enable comprehensive audit logging'),
('compliance_monitoring_enabled', 'true', 'boolean', 'Enable compliance monitoring'),
('ml_model_retraining_interval_days', '7', 'integer', 'Days between ML model retraining'),
('prediction_horizon_default_hours', '24', 'integer', 'Default prediction horizon in hours'),
('executive_metrics_update_interval_hours', '1', 'integer', 'Hours between executive metrics updates'),
('roi_calculation_enabled', 'true', 'boolean', 'Enable ROI calculation and tracking'),
('data_retention_months', '60', 'integer', 'Months to retain historical data'),
('max_concurrent_auto_resolutions', '5', 'integer', 'Maximum concurrent auto-resolution attempts');

-- Create default admin user (password should be changed immediately)
INSERT OR IGNORE INTO users (id, username, email, full_name, role) VALUES
('admin_001', 'admin', 'admin@company.com', 'System Administrator', 'admin');

-- Create default compliance policies
INSERT OR IGNORE INTO compliance_policies (id, policy_name, policy_type, description, policy_rules) VALUES
('pol_data_retention', 'Data Retention Policy', 'data_retention', 
 'Defines data retention requirements for audit and compliance', 
 '{"kb_entries": "7_years", "incidents": "5_years", "audit_logs": "7_years", "user_data": "as_long_as_active"}'),
('pol_access_control', 'Access Control Policy', 'access_control',
 'Defines access control requirements for system resources',
 '{"require_authentication": true, "require_role_based_access": true, "password_complexity": "strong"}');

-- Update schema version
INSERT INTO schema_versions (version, description) VALUES (5, 'MVP5: Enterprise AI, Auto-Resolution, and Governance');

-- DOWN
-- Rollback for: MVP5 Enterprise AI and Auto-Resolution

-- Drop triggers first
DROP TRIGGER IF EXISTS tr_audit_kb_changes;
DROP TRIGGER IF EXISTS tr_process_learning_feedback;
DROP TRIGGER IF EXISTS tr_track_model_usage;
DROP TRIGGER IF EXISTS tr_update_auto_resolution_success_rate;

-- Drop views
DROP VIEW IF EXISTS v_compliance_status;
DROP VIEW IF EXISTS v_roi_dashboard;
DROP VIEW IF EXISTS v_predictive_analytics_summary;
DROP VIEW IF EXISTS v_auto_resolution_effectiveness;

-- Drop indexes
DROP INDEX IF EXISTS idx_roi_tracking_category;
DROP INDEX IF EXISTS idx_roi_tracking_period;
DROP INDEX IF EXISTS idx_executive_metrics_period;
DROP INDEX IF EXISTS idx_executive_metrics_category;
DROP INDEX IF EXISTS idx_compliance_violations_policy;
DROP INDEX IF EXISTS idx_compliance_violations_status;
DROP INDEX IF EXISTS idx_compliance_policies_active;
DROP INDEX IF EXISTS idx_audit_log_action;
DROP INDEX IF EXISTS idx_audit_log_resource;
DROP INDEX IF EXISTS idx_audit_log_user;
DROP INDEX IF EXISTS idx_users_last_login;
DROP INDEX IF EXISTS idx_users_active;
DROP INDEX IF EXISTS idx_knowledge_evolution_type;
DROP INDEX IF EXISTS idx_model_performance_date;
DROP INDEX IF EXISTS idx_learning_feedback_type;
DROP INDEX IF EXISTS idx_learning_feedback_processed;
DROP INDEX IF EXISTS idx_predictive_alerts_component;
DROP INDEX IF EXISTS idx_predictive_alerts_status;
DROP INDEX IF EXISTS idx_prediction_results_expires;
DROP INDEX IF EXISTS idx_prediction_results_component;
DROP INDEX IF EXISTS idx_ml_models_purpose;
DROP INDEX IF EXISTS idx_ml_models_active;
DROP INDEX IF EXISTS idx_auto_resolution_attempts_status;
DROP INDEX IF EXISTS idx_auto_resolution_attempts_incident;
DROP INDEX IF EXISTS idx_auto_resolution_rules_success;
DROP INDEX IF EXISTS idx_auto_resolution_rules_active;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS roi_tracking;
DROP TABLE IF EXISTS executive_metrics;
DROP TABLE IF EXISTS compliance_violations;
DROP TABLE IF EXISTS compliance_policies;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS knowledge_evolution;
DROP TABLE IF EXISTS model_performance;
DROP TABLE IF EXISTS learning_feedback;
DROP TABLE IF EXISTS predictive_alerts;
DROP TABLE IF EXISTS prediction_results;
DROP TABLE IF EXISTS ml_models;
DROP TABLE IF EXISTS auto_resolution_attempts;
DROP TABLE IF EXISTS auto_resolution_rules;

-- Remove configuration
DELETE FROM system_config WHERE key IN (
    'auto_resolution_enabled',
    'auto_resolution_confidence_threshold',
    'predictive_analytics_enabled',
    'continuous_learning_enabled',
    'audit_logging_enabled',
    'compliance_monitoring_enabled',
    'ml_model_retraining_interval_days',
    'prediction_horizon_default_hours',
    'executive_metrics_update_interval_hours',
    'roi_calculation_enabled',
    'data_retention_months',
    'max_concurrent_auto_resolutions'
);

-- Remove schema version
DELETE FROM schema_versions WHERE version = 5;