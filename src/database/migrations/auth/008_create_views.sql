-- UP
-- Migration: Create Reporting Views for SSO Analytics and Monitoring
-- Version: 008
-- Generated: 2024-09-24T13:05:00.000Z

-- Create user overview view
CREATE VIEW v_sso_user_overview AS
SELECT
    u.id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    u.display_name,
    u.status,
    u.email_verified,
    u.two_factor_enabled,
    u.last_login,
    u.login_count,
    u.failed_login_attempts,
    u.created_at,
    u.updated_at,

    -- Role information
    GROUP_CONCAT(r.name, ', ') as roles,
    GROUP_CONCAT(r.display_name, ', ') as role_display_names,

    -- Group information
    GROUP_CONCAT(g.name, ', ') as groups,

    -- Session information
    (SELECT COUNT(*) FROM sso_sessions s WHERE s.user_id = u.id AND s.status = 'active') as active_sessions,
    (SELECT MAX(s.last_activity) FROM sso_sessions s WHERE s.user_id = u.id) as last_activity,

    -- Security information
    (SELECT COUNT(*) FROM sso_security_events se WHERE se.user_id = u.id AND se.detected_at >= date('now', '-30 days')) as security_events_30d,

    -- API key count
    (SELECT COUNT(*) FROM sso_api_keys ak WHERE ak.user_id = u.id AND ak.status = 'active') as active_api_keys

FROM sso_users u
LEFT JOIN sso_user_role_assignments ura ON u.id = ura.user_id AND ura.is_active = TRUE
LEFT JOIN sso_user_roles r ON ura.role_id = r.id
LEFT JOIN sso_user_group_memberships ugm ON u.id = ugm.user_id AND ugm.is_active = TRUE
LEFT JOIN sso_user_groups g ON ugm.group_id = g.id

GROUP BY u.id, u.email, u.username, u.first_name, u.last_name, u.display_name,
         u.status, u.email_verified, u.two_factor_enabled, u.last_login,
         u.login_count, u.failed_login_attempts, u.created_at, u.updated_at;

-- Create session analytics view
CREATE VIEW v_sso_session_analytics AS
SELECT
    s.id,
    s.session_id,
    s.user_id,
    u.email as user_email,
    u.display_name as user_display_name,
    s.device_type,
    s.browser_name,
    s.os_name,
    s.ip_address,
    s.ip_country,
    s.ip_city,
    s.auth_method,
    p.display_name as provider_name,
    s.is_trusted_device,
    s.created_at as session_start,
    s.last_activity,
    s.expires_at,
    s.status as session_status,
    s.termination_reason,

    -- Calculate session duration
    CASE
        WHEN s.terminated_at IS NOT NULL THEN
            ROUND((julianday(s.terminated_at) - julianday(s.created_at)) * 24 * 60, 2)
        WHEN s.status = 'active' THEN
            ROUND((julianday('now') - julianday(s.created_at)) * 24 * 60, 2)
        ELSE NULL
    END as duration_minutes,

    -- Activity metrics
    (SELECT COUNT(*) FROM sso_session_activities sa WHERE sa.session_id = s.id) as total_activities,
    (SELECT COUNT(*) FROM sso_session_activities sa WHERE sa.session_id = s.id AND sa.success = FALSE) as failed_activities,

    -- Security flags
    (SELECT COUNT(*) FROM sso_security_events se WHERE se.session_id = s.id) as security_events

FROM sso_sessions s
JOIN sso_users u ON s.user_id = u.id
LEFT JOIN sso_providers p ON s.provider_id = p.id;

-- Create authentication analytics view
CREATE VIEW v_sso_auth_analytics AS
SELECT
    DATE(timestamp) as auth_date,
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT actor_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips,

    -- Geographic distribution
    COUNT(DISTINCT country) as unique_countries,

    -- Success rate
    ROUND(
        CAST(SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2
    ) as success_rate,

    -- Provider breakdown
    COUNT(CASE WHEN details LIKE '%"provider_id"%' THEN 1 END) as sso_logins,
    COUNT(CASE WHEN details NOT LIKE '%"provider_id"%' THEN 1 END) as local_logins

FROM sso_audit_logs
WHERE category = 'authentication'
  AND event_type IN ('user_login', 'user_login_failed', 'user_logout')
  AND timestamp >= date('now', '-30 days')
GROUP BY DATE(timestamp), event_type
ORDER BY auth_date DESC, event_type;

-- Create security events summary view
CREATE VIEW v_sso_security_summary AS
SELECT
    DATE(detected_at) as event_date,
    threat_code,
    stt.name as threat_name,
    severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT ip_address) as unique_ips,
    COUNT(DISTINCT user_id) as affected_users,
    SUM(CASE WHEN blocked = TRUE THEN 1 ELSE 0 END) as blocked_count,
    AVG(risk_score) as avg_risk_score,
    MIN(detected_at) as first_detected,
    MAX(detected_at) as last_detected

FROM sso_security_events se
JOIN sso_security_threat_types stt ON se.threat_type_id = stt.id
WHERE detected_at >= date('now', '-30 days')
GROUP BY DATE(detected_at), threat_code, stt.name, severity
ORDER BY event_date DESC, event_count DESC;

-- Create API usage analytics view
CREATE VIEW v_sso_api_usage AS
SELECT
    ak.id as api_key_id,
    ak.name as api_key_name,
    ak.key_prefix,
    u.email as user_email,
    ak.status,
    ak.rate_limit,
    ak.current_usage,
    ak.last_used,

    -- Usage statistics (last 24 hours)
    (SELECT COUNT(*) FROM sso_api_key_usage_logs ul
     WHERE ul.api_key_id = ak.id AND ul.created_at >= datetime('now', '-24 hours')) as requests_24h,

    (SELECT COUNT(*) FROM sso_api_key_usage_logs ul
     WHERE ul.api_key_id = ak.id AND ul.created_at >= datetime('now', '-24 hours') AND ul.status_code >= 400) as errors_24h,

    (SELECT AVG(ul.response_time_ms) FROM sso_api_key_usage_logs ul
     WHERE ul.api_key_id = ak.id AND ul.created_at >= datetime('now', '-24 hours')) as avg_response_time_24h,

    -- Top endpoints
    (SELECT ul.endpoint FROM sso_api_key_usage_logs ul
     WHERE ul.api_key_id = ak.id AND ul.created_at >= datetime('now', '-24 hours')
     GROUP BY ul.endpoint ORDER BY COUNT(*) DESC LIMIT 1) as top_endpoint_24h,

    -- Top IP addresses
    (SELECT ul.ip_address FROM sso_api_key_usage_logs ul
     WHERE ul.api_key_id = ak.id AND ul.created_at >= datetime('now', '-24 hours')
     GROUP BY ul.ip_address ORDER BY COUNT(*) DESC LIMIT 1) as top_ip_24h,

    -- Rate limiting hits
    (SELECT COUNT(*) FROM sso_api_key_usage_logs ul
     WHERE ul.api_key_id = ak.id AND ul.created_at >= datetime('now', '-24 hours') AND ul.rate_limit_hit = TRUE) as rate_limit_hits_24h

FROM sso_api_keys ak
LEFT JOIN sso_users u ON ak.user_id = u.id
ORDER BY ak.last_used DESC NULLS LAST;

-- Create provider performance view
CREATE VIEW v_sso_provider_performance AS
SELECT
    p.id,
    p.name,
    p.display_name,
    p.provider_type,
    p.is_enabled,

    -- Daily statistics (last 30 days average)
    COALESCE(AVG(ps.total_logins), 0) as avg_daily_logins,
    COALESCE(AVG(ps.successful_logins), 0) as avg_daily_successful_logins,
    COALESCE(AVG(ps.failed_logins), 0) as avg_daily_failed_logins,
    COALESCE(AVG(ps.new_registrations), 0) as avg_daily_registrations,

    -- Success rates
    CASE
        WHEN SUM(ps.total_logins) > 0 THEN
            ROUND(CAST(SUM(ps.successful_logins) AS REAL) / SUM(ps.total_logins) * 100, 2)
        ELSE 0
    END as success_rate_30d,

    -- Performance metrics
    COALESCE(AVG(ps.avg_response_time), 0) as avg_response_time,
    COALESCE(MAX(ps.max_response_time), 0) as max_response_time,

    -- Error rates
    CASE
        WHEN SUM(ps.total_logins) > 0 THEN
            ROUND(CAST(SUM(ps.timeout_errors + ps.auth_errors + ps.config_errors + ps.network_errors) AS REAL) / SUM(ps.total_logins) * 100, 4)
        ELSE 0
    END as error_rate_30d,

    -- Active users
    (SELECT COUNT(DISTINCT ui.user_id) FROM sso_user_identities ui WHERE ui.provider_id = p.id) as total_users,
    (SELECT COUNT(DISTINCT ui.user_id) FROM sso_user_identities ui WHERE ui.provider_id = p.id AND ui.last_login >= date('now', '-30 days')) as active_users_30d

FROM sso_providers p
LEFT JOIN sso_provider_stats ps ON p.id = ps.provider_id AND ps.date >= date('now', '-30 days')
GROUP BY p.id, p.name, p.display_name, p.provider_type, p.is_enabled
ORDER BY avg_daily_logins DESC;

-- Create audit log summary view
CREATE VIEW v_sso_audit_summary AS
SELECT
    DATE(timestamp) as audit_date,
    category,
    event_type,
    severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT actor_id) as unique_actors,
    COUNT(DISTINCT target_id) as unique_targets,
    COUNT(DISTINCT ip_address) as unique_ips,

    -- Success rate
    ROUND(
        CAST(SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2
    ) as success_rate,

    -- Risk assessment
    AVG(risk_score) as avg_risk_score,
    MAX(risk_score) as max_risk_score,
    COUNT(CASE WHEN risk_score >= 75 THEN 1 END) as high_risk_events,

    -- Review requirements
    COUNT(CASE WHEN requires_notification = TRUE THEN 1 END) as events_requiring_notification

FROM sso_audit_logs
WHERE timestamp >= date('now', '-30 days')
GROUP BY DATE(timestamp), category, event_type, severity
ORDER BY audit_date DESC, event_count DESC;

-- Create compliance overview view
CREATE VIEW v_sso_compliance_overview AS
SELECT
    -- User compliance
    (SELECT COUNT(*) FROM sso_users WHERE email_verified = TRUE) as verified_users,
    (SELECT COUNT(*) FROM sso_users WHERE two_factor_enabled = TRUE) as mfa_enabled_users,
    (SELECT COUNT(*) FROM sso_users WHERE status = 'active') as active_users,

    -- Session compliance
    (SELECT COUNT(*) FROM sso_sessions WHERE created_at >= date('now', '-90 days')) as sessions_90d,
    (SELECT COUNT(*) FROM sso_sessions WHERE is_trusted_device = FALSE AND created_at >= date('now', '-30 days')) as untrusted_device_sessions_30d,

    -- API key compliance
    (SELECT COUNT(*) FROM sso_api_keys WHERE expires_at IS NULL OR expires_at > date('now')) as non_expiring_keys,
    (SELECT COUNT(*) FROM sso_api_keys WHERE status = 'active' AND last_used IS NULL) as unused_active_keys,

    -- Audit compliance
    (SELECT COUNT(*) FROM sso_audit_logs WHERE timestamp >= date('now', '-1 year')) as audit_records_1y,
    (SELECT COUNT(*) FROM sso_sensitive_data_access WHERE created_at >= date('now', '-30 days')) as sensitive_access_30d,

    -- Security compliance
    (SELECT COUNT(*) FROM sso_security_events WHERE severity IN ('critical', 'high') AND status != 'resolved') as unresolved_critical_events,
    (SELECT COUNT(*) FROM sso_ip_reputation WHERE is_blacklisted = TRUE) as blacklisted_ips,

    -- Provider compliance
    (SELECT COUNT(*) FROM sso_providers WHERE is_enabled = TRUE AND auto_create_users = TRUE) as auto_provisioning_providers,

    -- Recent activity compliance
    (SELECT COUNT(*) FROM sso_users WHERE last_login >= date('now', '-90 days')) as active_users_90d,
    (SELECT COUNT(DISTINCT user_id) FROM sso_audit_logs WHERE timestamp >= date('now', '-30 days') AND category = 'data_access') as users_with_data_access_30d;

-- Create system health dashboard view
CREATE VIEW v_sso_system_health AS
SELECT
    -- Current active counts
    (SELECT COUNT(*) FROM sso_sessions WHERE status = 'active') as active_sessions,
    (SELECT COUNT(*) FROM sso_users WHERE status = 'active') as active_users,
    (SELECT COUNT(*) FROM sso_api_keys WHERE status = 'active') as active_api_keys,
    (SELECT COUNT(*) FROM sso_providers WHERE is_enabled = TRUE) as enabled_providers,

    -- Recent activity (24 hours)
    (SELECT COUNT(*) FROM sso_audit_logs WHERE timestamp >= datetime('now', '-24 hours')) as audit_events_24h,
    (SELECT COUNT(*) FROM sso_security_events WHERE detected_at >= datetime('now', '-24 hours')) as security_events_24h,
    (SELECT COUNT(DISTINCT user_id) FROM sso_sessions WHERE created_at >= datetime('now', '-24 hours')) as unique_logins_24h,

    -- Error rates (24 hours)
    (SELECT
        ROUND(
            CAST(COUNT(CASE WHEN success = FALSE THEN 1 END) AS REAL) / COUNT(*) * 100, 2
        )
     FROM sso_audit_logs
     WHERE timestamp >= datetime('now', '-24 hours') AND category = 'authentication'
    ) as auth_error_rate_24h,

    -- Security metrics
    (SELECT COUNT(*) FROM sso_security_events WHERE severity IN ('critical', 'high') AND status = 'detected') as critical_security_events,
    (SELECT COUNT(*) FROM sso_rate_limit_violations WHERE created_at >= datetime('now', '-1 hour')) as rate_limit_violations_1h,

    -- System performance
    (SELECT AVG(duration_ms) FROM sso_audit_logs WHERE timestamp >= datetime('now', '-1 hour') AND duration_ms IS NOT NULL) as avg_operation_time_1h,

    -- Data retention status
    (SELECT COUNT(*) FROM sso_audit_logs WHERE expires_at IS NOT NULL AND expires_at <= date('now')) as expired_audit_records,
    (SELECT COUNT(*) FROM sso_sessions WHERE expires_at <= datetime('now') AND status = 'active') as expired_active_sessions,

    -- Last cleanup job status
    (SELECT MAX(completed_at) FROM sso_cleanup_jobs WHERE status = 'completed') as last_cleanup_completed;

-- DOWN
-- Rollback for: Create Reporting Views for SSO Analytics and Monitoring

DROP VIEW IF EXISTS v_sso_system_health;
DROP VIEW IF EXISTS v_sso_compliance_overview;
DROP VIEW IF EXISTS v_sso_audit_summary;
DROP VIEW IF EXISTS v_sso_provider_performance;
DROP VIEW IF EXISTS v_sso_api_usage;
DROP VIEW IF EXISTS v_sso_security_summary;
DROP VIEW IF EXISTS v_sso_auth_analytics;
DROP VIEW IF EXISTS v_sso_session_analytics;
DROP VIEW IF EXISTS v_sso_user_overview;