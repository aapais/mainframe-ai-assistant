-- UP
-- Migration: Create Audit Trail Triggers for Data Integrity
-- Version: 007
-- Generated: 2024-09-24T13:05:00.000Z

-- Create trigger to automatically update updated_at timestamps
CREATE TRIGGER tr_sso_users_updated_at
    AFTER UPDATE ON sso_users
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE sso_users
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER tr_sso_user_roles_updated_at
    AFTER UPDATE ON sso_user_roles
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE sso_user_roles
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER tr_sso_providers_updated_at
    AFTER UPDATE ON sso_providers
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE sso_providers
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER tr_sso_sessions_updated_at
    AFTER UPDATE ON sso_sessions
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE sso_sessions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Create audit triggers for user management
CREATE TRIGGER tr_sso_users_audit_insert
    AFTER INSERT ON sso_users
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id, actor_name,
        target_type, target_id, target_name, action, resource,
        new_values, success, message, timestamp
    ) VALUES (
        'user_created', 'user_management', 'medium', 'system',
        COALESCE(NEW.created_by, 'system'), COALESCE(NEW.created_by, 'system'),
        'user', NEW.id, COALESCE(NEW.display_name, NEW.email),
        'create', 'sso_users',
        json_object(
            'id', NEW.id,
            'email', NEW.email,
            'username', NEW.username,
            'status', NEW.status,
            'email_verified', NEW.email_verified
        ),
        TRUE,
        'New user account created: ' || COALESCE(NEW.display_name, NEW.email),
        CURRENT_TIMESTAMP
    );
END;

CREATE TRIGGER tr_sso_users_audit_update
    AFTER UPDATE ON sso_users
    FOR EACH ROW
    WHEN OLD.email != NEW.email
      OR OLD.username != NEW.username
      OR OLD.status != NEW.status
      OR OLD.email_verified != NEW.email_verified
      OR OLD.two_factor_enabled != NEW.two_factor_enabled
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id, actor_name,
        target_type, target_id, target_name, action, resource,
        old_values, new_values, success, message, timestamp
    ) VALUES (
        'user_updated', 'user_management', 'info', 'user',
        COALESCE(NEW.updated_by, OLD.id), COALESCE(NEW.updated_by, NEW.email),
        'user', NEW.id, COALESCE(NEW.display_name, NEW.email),
        'update', 'sso_users',
        json_object(
            'email', OLD.email,
            'username', OLD.username,
            'status', OLD.status,
            'email_verified', OLD.email_verified,
            'two_factor_enabled', OLD.two_factor_enabled
        ),
        json_object(
            'email', NEW.email,
            'username', NEW.username,
            'status', NEW.status,
            'email_verified', NEW.email_verified,
            'two_factor_enabled', NEW.two_factor_enabled
        ),
        TRUE,
        'User account updated: ' || COALESCE(NEW.display_name, NEW.email),
        CURRENT_TIMESTAMP
    );
END;

CREATE TRIGGER tr_sso_users_audit_delete
    AFTER DELETE ON sso_users
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id, actor_name,
        target_type, target_id, target_name, action, resource,
        old_values, success, message, timestamp
    ) VALUES (
        'user_deleted', 'user_management', 'high', 'system',
        'system', 'system',
        'user', OLD.id, COALESCE(OLD.display_name, OLD.email),
        'delete', 'sso_users',
        json_object(
            'id', OLD.id,
            'email', OLD.email,
            'username', OLD.username,
            'status', OLD.status
        ),
        TRUE,
        'User account deleted: ' || COALESCE(OLD.display_name, OLD.email),
        CURRENT_TIMESTAMP
    );
END;

-- Create audit triggers for role assignments
CREATE TRIGGER tr_sso_user_role_assignments_audit_insert
    AFTER INSERT ON sso_user_role_assignments
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id, actor_name,
        target_type, target_id, action, resource,
        new_values, success, message, timestamp
    ) VALUES (
        'role_assigned', 'authorization', 'medium', 'user',
        NEW.assigned_by, NEW.assigned_by,
        'user', NEW.user_id, 'assign', 'sso_user_role_assignments',
        json_object(
            'user_id', NEW.user_id,
            'role_id', NEW.role_id,
            'assigned_by', NEW.assigned_by,
            'expires_at', NEW.expires_at
        ),
        TRUE,
        'Role assigned to user',
        CURRENT_TIMESTAMP
    );
END;

CREATE TRIGGER tr_sso_user_role_assignments_audit_delete
    AFTER DELETE ON sso_user_role_assignments
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id, actor_name,
        target_type, target_id, action, resource,
        old_values, success, message, timestamp
    ) VALUES (
        'role_removed', 'authorization', 'medium', 'system',
        'system', 'system',
        'user', OLD.user_id, 'remove', 'sso_user_role_assignments',
        json_object(
            'user_id', OLD.user_id,
            'role_id', OLD.role_id,
            'assigned_by', OLD.assigned_by
        ),
        TRUE,
        'Role removed from user',
        CURRENT_TIMESTAMP
    );
END;

-- Create audit triggers for API keys
CREATE TRIGGER tr_sso_api_keys_audit_insert
    AFTER INSERT ON sso_api_keys
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id, actor_name,
        target_type, target_id, target_name, action, resource,
        new_values, success, message, timestamp
    ) VALUES (
        'api_key_created', 'security', 'medium', 'user',
        COALESCE(NEW.user_id, 'system'), COALESCE(NEW.created_by, 'system'),
        'api_key', NEW.id, NEW.name, 'create', 'sso_api_keys',
        json_object(
            'id', NEW.id,
            'name', NEW.name,
            'key_prefix', NEW.key_prefix,
            'permissions', NEW.permissions,
            'expires_at', NEW.expires_at
        ),
        TRUE,
        'API key created: ' || NEW.name,
        CURRENT_TIMESTAMP
    );
END;

CREATE TRIGGER tr_sso_api_keys_audit_update
    AFTER UPDATE ON sso_api_keys
    FOR EACH ROW
    WHEN OLD.status != NEW.status
      OR OLD.permissions != NEW.permissions
      OR OLD.rate_limit != NEW.rate_limit
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id, actor_name,
        target_type, target_id, target_name, action, resource,
        old_values, new_values, success, message, timestamp
    ) VALUES (
        CASE
            WHEN NEW.status = 'revoked' THEN 'api_key_revoked'
            ELSE 'api_key_updated'
        END,
        'security', 'medium', 'user',
        COALESCE(NEW.updated_by, NEW.user_id, 'system'), COALESCE(NEW.updated_by, 'system'),
        'api_key', NEW.id, NEW.name, 'update', 'sso_api_keys',
        json_object(
            'status', OLD.status,
            'permissions', OLD.permissions,
            'rate_limit', OLD.rate_limit
        ),
        json_object(
            'status', NEW.status,
            'permissions', NEW.permissions,
            'rate_limit', NEW.rate_limit,
            'revocation_reason', NEW.revocation_reason
        ),
        TRUE,
        'API key ' ||
        CASE
            WHEN NEW.status = 'revoked' THEN 'revoked: '
            ELSE 'updated: '
        END || NEW.name,
        CURRENT_TIMESTAMP
    );
END;

-- Create audit triggers for sessions
CREATE TRIGGER tr_sso_sessions_audit_insert
    AFTER INSERT ON sso_sessions
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id,
        target_type, target_id, action, resource, ip_address, user_agent,
        new_values, success, message, timestamp
    ) VALUES (
        'user_login', 'authentication', 'info', 'user', NEW.user_id,
        'session', NEW.id, 'create', 'sso_sessions',
        NEW.ip_address, NEW.user_agent,
        json_object(
            'session_id', NEW.session_id,
            'auth_method', NEW.auth_method,
            'provider_id', NEW.provider_id,
            'device_type', NEW.device_type,
            'is_trusted_device', NEW.is_trusted_device
        ),
        TRUE,
        'User logged in via ' || NEW.auth_method,
        CURRENT_TIMESTAMP
    );
END;

CREATE TRIGGER tr_sso_sessions_audit_update_terminated
    AFTER UPDATE ON sso_sessions
    FOR EACH ROW
    WHEN OLD.status != NEW.status AND NEW.status IN ('terminated', 'expired')
BEGIN
    INSERT INTO sso_audit_logs (
        event_type, category, severity, actor_type, actor_id,
        target_type, target_id, action, resource, ip_address,
        old_values, new_values, success, message, timestamp
    ) VALUES (
        CASE NEW.termination_reason
            WHEN 'logout' THEN 'user_logout'
            WHEN 'timeout' THEN 'session_timeout'
            WHEN 'admin' THEN 'session_terminated_admin'
            ELSE 'session_terminated'
        END,
        'authentication', 'info',
        CASE
            WHEN NEW.termination_reason = 'admin' THEN 'admin'
            ELSE 'user'
        END,
        COALESCE(NEW.terminated_by, NEW.user_id),
        'session', NEW.id, 'terminate', 'sso_sessions', OLD.ip_address,
        json_object(
            'status', OLD.status,
            'last_activity', OLD.last_activity
        ),
        json_object(
            'status', NEW.status,
            'termination_reason', NEW.termination_reason,
            'terminated_by', NEW.terminated_by,
            'terminated_at', NEW.terminated_at
        ),
        TRUE,
        'Session ' || NEW.termination_reason ||
        CASE NEW.termination_reason
            WHEN 'logout' THEN ' - user logged out'
            WHEN 'timeout' THEN ' - session timed out'
            WHEN 'admin' THEN ' - terminated by administrator'
            ELSE ' - session ended'
        END,
        CURRENT_TIMESTAMP
    );
END;

-- Create trigger to update session last_activity
CREATE TRIGGER tr_sso_sessions_update_activity
    BEFORE UPDATE ON sso_sessions
    FOR EACH ROW
    WHEN NEW.status = 'active' AND OLD.last_activity = NEW.last_activity
BEGIN
    UPDATE sso_sessions
    SET last_activity = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Create trigger to auto-expire sessions
CREATE TRIGGER tr_sso_sessions_auto_expire
    BEFORE UPDATE ON sso_sessions
    FOR EACH ROW
    WHEN NEW.expires_at < CURRENT_TIMESTAMP AND OLD.status = 'active'
BEGIN
    UPDATE sso_sessions
    SET
        status = 'expired',
        terminated_at = CURRENT_TIMESTAMP,
        termination_reason = 'expired'
    WHERE id = NEW.id;
END;

-- Create trigger to populate audit search index
CREATE TRIGGER tr_audit_search_index_insert
    AFTER INSERT ON sso_audit_logs
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_search_index (
        audit_log_id, search_content, date_bucket, hour_bucket
    ) VALUES (
        NEW.id,
        COALESCE(NEW.event_type, '') || ' ' ||
        COALESCE(NEW.message, '') || ' ' ||
        COALESCE(NEW.actor_name, '') || ' ' ||
        COALESCE(NEW.target_name, '') || ' ' ||
        COALESCE(NEW.details, ''),
        strftime('%Y-%m', NEW.timestamp),
        strftime('%Y-%m-%d-%H', NEW.timestamp)
    );
END;

-- Create trigger to update FTS index for audit logs
CREATE TRIGGER tr_audit_logs_fts_insert
    AFTER INSERT ON sso_audit_logs
    FOR EACH ROW
BEGIN
    INSERT INTO sso_audit_logs_fts (
        event_id, event_type, message, details, actor_name, target_name
    ) VALUES (
        NEW.event_id, NEW.event_type, NEW.message,
        NEW.details, NEW.actor_name, NEW.target_name
    );
END;

CREATE TRIGGER tr_audit_logs_fts_delete
    AFTER DELETE ON sso_audit_logs
    FOR EACH ROW
BEGIN
    DELETE FROM sso_audit_logs_fts WHERE event_id = OLD.event_id;
END;

-- Create trigger to update API key usage count
CREATE TRIGGER tr_sso_api_key_usage_update
    AFTER INSERT ON sso_api_key_usage_logs
    FOR EACH ROW
BEGIN
    UPDATE sso_api_keys
    SET
        last_used = NEW.created_at,
        current_usage = current_usage + 1
    WHERE id = NEW.api_key_id;
END;

-- Create trigger to reset API key usage count hourly
CREATE TRIGGER tr_sso_api_key_usage_reset
    AFTER UPDATE ON sso_api_keys
    FOR EACH ROW
    WHEN NEW.usage_reset_at < CURRENT_TIMESTAMP
BEGIN
    UPDATE sso_api_keys
    SET
        current_usage = 0,
        usage_reset_at = datetime(CURRENT_TIMESTAMP, '+1 hour')
    WHERE id = NEW.id;
END;

-- Create trigger for security event auto-blocking
CREATE TRIGGER tr_security_event_auto_block
    AFTER INSERT ON sso_security_events
    FOR EACH ROW
    WHEN NEW.severity IN ('critical', 'high')
     AND (SELECT auto_block FROM sso_security_threat_types WHERE id = NEW.threat_type_id) = TRUE
BEGIN
    -- Add IP to reputation table with negative score
    INSERT OR REPLACE INTO sso_ip_reputation (
        ip_address, reputation_score, threat_level,
        suspicious_requests, is_blacklisted, updated_at
    ) VALUES (
        NEW.ip_address,
        CASE NEW.severity
            WHEN 'critical' THEN -100
            WHEN 'high' THEN -75
            ELSE -50
        END,
        NEW.severity,
        1,
        TRUE,
        CURRENT_TIMESTAMP
    );

    -- Create security alert
    INSERT INTO sso_security_alerts (
        alert_type, severity, title, description, source_type, source_id,
        affected_ips, alert_data
    ) VALUES (
        'security_event',
        NEW.severity,
        'Auto-blocked IP: ' || NEW.ip_address,
        'IP address automatically blocked due to ' || NEW.threat_code || ' attack',
        'security_event',
        NEW.id,
        json_array(NEW.ip_address),
        json_object(
            'threat_code', NEW.threat_code,
            'auto_blocked', TRUE,
            'confidence_score', NEW.confidence_score
        )
    );
END;

-- Create trigger to clean up expired tokens
CREATE TRIGGER tr_cleanup_expired_tokens
    AFTER UPDATE ON sso_access_tokens
    FOR EACH ROW
    WHEN NEW.expires_at < CURRENT_TIMESTAMP AND OLD.status = 'active'
BEGIN
    UPDATE sso_access_tokens
    SET status = 'expired'
    WHERE id = NEW.id;
END;

CREATE TRIGGER tr_cleanup_expired_refresh_tokens
    AFTER UPDATE ON sso_refresh_tokens
    FOR EACH ROW
    WHEN NEW.expires_at < CURRENT_TIMESTAMP AND OLD.status = 'active'
BEGIN
    UPDATE sso_refresh_tokens
    SET status = 'expired'
    WHERE id = NEW.id;
END;

-- DOWN
-- Rollback for: Create Audit Trail Triggers for Data Integrity

DROP TRIGGER IF EXISTS tr_cleanup_expired_refresh_tokens;
DROP TRIGGER IF EXISTS tr_cleanup_expired_tokens;
DROP TRIGGER IF EXISTS tr_security_event_auto_block;
DROP TRIGGER IF EXISTS tr_sso_api_key_usage_reset;
DROP TRIGGER IF EXISTS tr_sso_api_key_usage_update;
DROP TRIGGER IF EXISTS tr_audit_logs_fts_delete;
DROP TRIGGER IF EXISTS tr_audit_logs_fts_insert;
DROP TRIGGER IF EXISTS tr_audit_search_index_insert;
DROP TRIGGER IF EXISTS tr_sso_sessions_auto_expire;
DROP TRIGGER IF EXISTS tr_sso_sessions_update_activity;
DROP TRIGGER IF EXISTS tr_sso_sessions_audit_update_terminated;
DROP TRIGGER IF EXISTS tr_sso_sessions_audit_insert;
DROP TRIGGER IF EXISTS tr_sso_api_keys_audit_update;
DROP TRIGGER IF EXISTS tr_sso_api_keys_audit_insert;
DROP TRIGGER IF EXISTS tr_sso_user_role_assignments_audit_delete;
DROP TRIGGER IF EXISTS tr_sso_user_role_assignments_audit_insert;
DROP TRIGGER IF EXISTS tr_sso_users_audit_delete;
DROP TRIGGER IF EXISTS tr_sso_users_audit_update;
DROP TRIGGER IF EXISTS tr_sso_users_audit_insert;
DROP TRIGGER IF EXISTS tr_sso_sessions_updated_at;
DROP TRIGGER IF EXISTS tr_sso_providers_updated_at;
DROP TRIGGER IF EXISTS tr_sso_user_roles_updated_at;
DROP TRIGGER IF EXISTS tr_sso_users_updated_at;