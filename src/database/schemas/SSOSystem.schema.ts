/**
 * SSO System Database Schema Definitions
 * Comprehensive TypeScript interfaces for all SSO entities with full type safety
 * Generated for mainframe-ai-assistant SSO migration system
 */

import { z } from 'zod';

// ===========================
// CORE SSO ENUMS AND TYPES
// ===========================

export const UserStatusSchema = z.enum(['active', 'inactive', 'suspended', 'deleted']);
export const SessionStatusSchema = z.enum(['active', 'expired', 'terminated', 'invalid']);
export const ApiKeyStatusSchema = z.enum(['active', 'inactive', 'revoked', 'expired', 'rotating']);
export const SecurityEventSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const AuditEventSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const ProviderTypeSchema = z.enum(['oauth2', 'oidc', 'saml', 'ldap', 'ad', 'google', 'microsoft', 'github', 'gitlab', 'okta', 'auth0', 'custom']);

export type UserStatus = z.infer<typeof UserStatusSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;
export type SecurityEventSeverity = z.infer<typeof SecurityEventSeveritySchema>;
export type AuditEventSeverity = z.infer<typeof AuditEventSeveritySchema>;
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

// ===========================
// USER MANAGEMENT SCHEMAS
// ===========================

/**
 * SSO User schema with comprehensive validation
 */
export const SSOUserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email().max(255),
  username: z.string().min(3).max(50).optional(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  display_name: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().optional(),
  locale: z.string().default('en'),
  timezone: z.string().default('UTC'),
  status: UserStatusSchema.default('active'),
  email_verified: z.boolean().default(false),
  phone_verified: z.boolean().default(false),
  two_factor_enabled: z.boolean().default(false),
  password_hash: z.string().optional(),
  password_salt: z.string().optional(),
  password_reset_token: z.string().optional(),
  password_reset_expires: z.date().optional(),
  email_verification_token: z.string().optional(),
  email_verification_expires: z.date().optional(),
  last_login: z.date().optional(),
  login_count: z.number().int().min(0).default(0),
  failed_login_attempts: z.number().int().min(0).default(0),
  locked_until: z.date().optional(),
  metadata: z.string().optional(), // JSON metadata
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
  updated_by: z.string().max(100).optional(),
});

export type SSOUser = z.infer<typeof SSOUserSchema>;

/**
 * User role schema
 */
export const SSOUserRoleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  description: z.string().optional(),
  permissions: z.string(), // JSON array of permissions
  is_system_role: z.boolean().default(false),
  is_default: z.boolean().default(false),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
});

export type SSOUserRole = z.infer<typeof SSOUserRoleSchema>;

/**
 * User role assignment schema
 */
export const SSOUserRoleAssignmentSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
  assigned_by: z.string().max(100).optional(),
  assigned_at: z.date().optional(),
  expires_at: z.date().optional(),
  is_active: z.boolean().default(true),
});

export type SSOUserRoleAssignment = z.infer<typeof SSOUserRoleAssignmentSchema>;

// ===========================
// SSO PROVIDER SCHEMAS
// ===========================

/**
 * SSO Provider configuration schema
 */
export const SSOProviderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  provider_type: ProviderTypeSchema,
  is_enabled: z.boolean().default(true),
  is_default: z.boolean().default(false),
  priority: z.number().int().default(0),

  // OAuth2/OIDC Configuration
  client_id: z.string().optional(),
  client_secret: z.string().optional(), // Encrypted
  authorization_url: z.string().url().optional(),
  token_url: z.string().url().optional(),
  userinfo_url: z.string().url().optional(),
  discovery_url: z.string().url().optional(),
  scopes: z.string().default('openid email profile'),

  // SAML Configuration
  sso_url: z.string().url().optional(),
  slo_url: z.string().url().optional(),
  certificate: z.string().optional(),
  entity_id: z.string().optional(),

  // LDAP/AD Configuration
  server_url: z.string().url().optional(),
  bind_dn: z.string().optional(),
  bind_password: z.string().optional(), // Encrypted
  user_base_dn: z.string().optional(),
  user_filter: z.string().optional(),
  group_base_dn: z.string().optional(),
  group_filter: z.string().optional(),

  // Field Mappings
  user_id_field: z.string().default('sub'),
  email_field: z.string().default('email'),
  first_name_field: z.string().default('given_name'),
  last_name_field: z.string().default('family_name'),
  display_name_field: z.string().default('name'),
  avatar_field: z.string().default('picture'),
  groups_field: z.string().default('groups'),

  // Settings
  allow_signup: z.boolean().default(true),
  auto_create_users: z.boolean().default(true),
  auto_link_accounts: z.boolean().default(false),
  sync_user_info: z.boolean().default(true),
  sync_groups: z.boolean().default(false),

  // Security
  require_verified_email: z.boolean().default(true),
  trusted_domains: z.string().optional(), // JSON array
  allowed_domains: z.string().optional(), // JSON array
  blocked_domains: z.string().optional(), // JSON array

  configuration: z.string().default('{}'), // JSON configuration
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
  updated_by: z.string().max(100).optional(),
});

export type SSOProvider = z.infer<typeof SSOProviderSchema>;

// ===========================
// SESSION MANAGEMENT SCHEMAS
// ===========================

export const DeviceTypeSchema = z.enum(['desktop', 'mobile', 'tablet', 'tv', 'watch', 'other']);
export const AuthMethodSchema = z.enum(['password', 'sso', 'api_key', 'token', 'mfa']);
export const TerminationReasonSchema = z.enum(['logout', 'timeout', 'admin', 'security', 'expired', 'replaced']);

/**
 * SSO Session schema
 */
export const SSOSessionSchema = z.object({
  id: z.string().uuid().optional(),
  session_token: z.string(), // Hashed session token
  session_id: z.string(), // Public session ID
  user_id: z.string().uuid(),
  device_id: z.string().optional(),
  device_name: z.string().optional(),
  device_type: DeviceTypeSchema.optional(),
  user_agent: z.string().optional(),
  browser_name: z.string().optional(),
  browser_version: z.string().optional(),
  os_name: z.string().optional(),
  os_version: z.string().optional(),
  is_mobile: z.boolean().default(false),
  is_bot: z.boolean().default(false),
  ip_address: z.string(),
  ip_country: z.string().optional(),
  ip_region: z.string().optional(),
  ip_city: z.string().optional(),
  ip_isp: z.string().optional(),
  auth_method: AuthMethodSchema,
  provider_id: z.string().uuid().optional(),
  session_data: z.string().default('{}'), // JSON session data
  is_trusted_device: z.boolean().default(false),
  is_elevated: z.boolean().default(false),
  requires_mfa: z.boolean().default(false),
  mfa_verified: z.boolean().default(false),
  status: SessionStatusSchema.default('active'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  last_activity: z.date().optional(),
  expires_at: z.date(),
  terminated_at: z.date().optional(),
  terminated_by: z.string().max(100).optional(),
  termination_reason: TerminationReasonSchema.optional(),
});

export type SSOSession = z.infer<typeof SSOSessionSchema>;

// ===========================
// API KEY MANAGEMENT SCHEMAS
// ===========================

/**
 * API Key schema with encryption support
 */
export const SSOApiKeySchema = z.object({
  id: z.string().uuid().optional(),
  key_hash: z.string(), // SHA-256 hash of the actual key
  key_prefix: z.string(), // First 8 chars for identification
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  key_type_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  permissions: z.string(), // JSON array of permissions
  scopes: z.string().optional(), // JSON array of scopes
  allowed_ips: z.string().optional(), // JSON array of allowed IPs
  allowed_domains: z.string().optional(), // JSON array of allowed domains
  rate_limit: z.number().int().optional(),
  current_usage: z.number().int().default(0),
  usage_reset_at: z.date().optional(),
  version: z.number().int().default(1),
  previous_key_hash: z.string().optional(),
  rotation_schedule: z.string().optional(), // Cron expression
  is_encrypted: z.boolean().default(true),
  encryption_key_id: z.string().optional(),
  require_https: z.boolean().default(true),
  require_client_cert: z.boolean().default(false),
  status: ApiKeyStatusSchema.default('active'),
  is_read_only: z.boolean().default(false),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  last_used: z.date().optional(),
  expires_at: z.date().optional(),
  revoked_at: z.date().optional(),
  revoked_by: z.string().max(100).optional(),
  revocation_reason: z.string().optional(),
  created_by: z.string().max(100).optional(),
  updated_by: z.string().max(100).optional(),
});

export type SSOApiKey = z.infer<typeof SSOApiKeySchema>;

// ===========================
// AUDIT AND SECURITY SCHEMAS
// ===========================

export const AuditEventCategorySchema = z.enum([
  'authentication', 'authorization', 'user_management', 'system',
  'data_access', 'configuration', 'security', 'compliance'
]);

export const ActorTypeSchema = z.enum(['user', 'service', 'system', 'anonymous']);

/**
 * SSO Audit Log schema
 */
export const SSO AuditLogSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  event_type: z.string().min(1).max(100),
  category: AuditEventCategorySchema,
  severity: AuditEventSeveritySchema,
  actor_type: ActorTypeSchema,
  actor_id: z.string().max(100).optional(),
  actor_name: z.string().max(200).optional(),
  actor_email: z.string().email().optional(),
  impersonator_id: z.string().max(100).optional(),
  impersonator_name: z.string().max(200).optional(),
  target_type: z.string().max(50).optional(),
  target_id: z.string().max(100).optional(),
  target_name: z.string().max(200).optional(),
  parent_target_type: z.string().max(50).optional(),
  parent_target_id: z.string().max(100).optional(),
  action: z.string().min(1).max(50),
  resource: z.string().max(200).optional(),
  method: z.string().max(20).optional(),
  session_id: z.string().uuid().optional(),
  request_id: z.string().max(100).optional(),
  correlation_id: z.string().max(100).optional(),
  ip_address: z.string().max(45).optional(),
  user_agent: z.string().max(500).optional(),
  referer: z.string().url().optional(),
  country: z.string().max(2).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  old_values: z.string().optional(), // JSON
  new_values: z.string().optional(), // JSON
  changed_fields: z.string().optional(), // JSON array
  success: z.boolean().default(true),
  status_code: z.number().int().optional(),
  error_code: z.string().max(50).optional(),
  error_message: z.string().optional(),
  message: z.string().optional(),
  details: z.string().optional(), // JSON
  tags: z.string().optional(), // JSON array
  risk_score: z.number().int().min(0).max(100).default(0),
  compliance_flags: z.string().optional(), // JSON array
  requires_notification: z.boolean().default(false),
  timestamp: z.date().optional(),
  duration_ms: z.number().int().optional(),
  expires_at: z.date().optional(),
  is_archived: z.boolean().default(false),
});

export type SSOAuditLog = z.infer<typeof SSOAuditLogSchema>;

export const ThreatCategorySchema = z.enum([
  'authentication', 'authorization', 'injection', 'exposure',
  'cryptography', 'logging', 'deserialization', 'validation',
  'session_management', 'access_control', 'other'
]);

export const SecurityEventStatusSchema = z.enum(['detected', 'investigating', 'confirmed', 'false_positive', 'resolved', 'ignored']);

/**
 * SSO Security Event schema
 */
export const SSOSecurityEventSchema = z.object({
  id: z.string().uuid().optional(),
  event_uuid: z.string().uuid(),
  threat_type_id: z.string().uuid(),
  threat_code: z.string().min(1).max(50),
  severity: SecurityEventSeveritySchema,
  confidence_score: z.number().min(0).max(1).default(0),
  risk_score: z.number().int().min(0).max(100).default(0),
  user_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  ip_address: z.string(),
  user_agent: z.string().optional(),
  country: z.string().max(2).optional(),
  region: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  isp: z.string().max(200).optional(),
  is_tor: z.boolean().default(false),
  is_proxy: z.boolean().default(false),
  is_vpn: z.boolean().default(false),
  attack_vector: z.string().max(200).optional(),
  payload: z.string().optional(), // Sanitized payload
  target_endpoint: z.string().max(500).optional(),
  target_parameter: z.string().max(200).optional(),
  http_method: z.string().max(10).optional(),
  request_url: z.string().url().optional(),
  request_headers: z.string().optional(), // JSON
  request_body: z.string().optional(), // Sanitized
  response_status: z.number().int().optional(),
  response_time_ms: z.number().int().optional(),
  detection_method: z.enum(['rule_based', 'ml_model', 'signature', 'anomaly', 'rate_limit', 'manual']).optional(),
  detection_rule: z.string().max(200).optional(),
  detection_confidence: z.number().min(0).max(1).default(1),
  status: SecurityEventStatusSchema.default('detected'),
  blocked: z.boolean().default(false),
  block_reason: z.string().optional(),
  incident_id: z.string().uuid().optional(),
  assigned_to: z.string().max(100).optional(),
  resolution: z.string().optional(),
  resolution_time_hours: z.number().optional(),
  message: z.string().optional(),
  details: z.string().optional(), // JSON
  evidence: z.string().optional(), // JSON
  detected_at: z.date().optional(),
  first_seen: z.date().optional(),
  last_seen: z.date().optional(),
  updated_at: z.date().optional(),
  resolved_at: z.date().optional(),
});

export type SSOSecurityEvent = z.infer<typeof SSOSecurityEventSchema>;

// ===========================
// BACKUP AND VALIDATION SCHEMAS
// ===========================

export const BackupTypeSchema = z.enum(['full', 'incremental', 'differential', 'auth_only']);
export const BackupStatusSchema = z.enum(['started', 'in_progress', 'completed', 'failed', 'cancelled', 'verified']);

/**
 * SSO Backup Execution schema
 */
export const SSOBackupExecutionSchema = z.object({
  id: z.string().uuid().optional(),
  backup_config_id: z.string().uuid(),
  execution_id: z.string().uuid(),
  backup_type: BackupTypeSchema,
  backup_name: z.string().min(1).max(255),
  backup_path: z.string().min(1).max(500),
  trigger_type: z.enum(['manual', 'scheduled', 'api', 'migration']),
  triggered_by: z.string().max(100).optional(),
  status: BackupStatusSchema.default('started'),
  started_at: z.date().optional(),
  completed_at: z.date().optional(),
  duration_seconds: z.number().int().optional(),
  original_size_bytes: z.number().int().default(0),
  compressed_size_bytes: z.number().int().default(0),
  compression_ratio: z.number().optional(),
  records_count: z.number().int().default(0),
  tables_count: z.number().int().default(0),
  is_encrypted: z.boolean().default(false),
  encryption_key_id: z.string().optional(),
  checksum: z.string().optional(),
  checksum_algorithm: z.string().optional(),
  verification_status: z.enum(['pending', 'passed', 'failed', 'skipped']).optional(),
  verification_checksum: z.string().optional(),
  verification_completed_at: z.date().optional(),
  error_message: z.string().optional(),
  error_details: z.string().optional(), // JSON
  warnings_count: z.number().int().default(0),
  warnings: z.string().optional(), // JSON array
  backup_metadata: z.string().default('{}'), // JSON
  source_database_version: z.string().optional(),
  schema_version: z.number().int().optional(),
});

export type SSOBackupExecution = z.infer<typeof SSOBackupExecutionSchema>;

// ===========================
// VALIDATION UTILITIES
// ===========================

/**
 * Validation utility class for SSO schemas
 */
export class SSOSchemaValidator {
  /**
   * Validate SSO user data
   */
  static validateUser(data: unknown): SSOUser {
    return SSOUserSchema.parse(data);
  }

  /**
   * Validate SSO session data
   */
  static validateSession(data: unknown): SSOSession {
    return SSOSessionSchema.parse(data);
  }

  /**
   * Validate SSO provider configuration
   */
  static validateProvider(data: unknown): SSOProvider {
    return SSOProviderSchema.parse(data);
  }

  /**
   * Validate API key data
   */
  static validateApiKey(data: unknown): SSOApiKey {
    return SSOApiKeySchema.parse(data);
  }

  /**
   * Validate audit log entry
   */
  static validateAuditLog(data: unknown): SSOAuditLog {
    return SSOAuditLogSchema.parse(data);
  }

  /**
   * Validate security event
   */
  static validateSecurityEvent(data: unknown): SSOSecurityEvent {
    return SSOSecurityEventSchema.parse(data);
  }

  /**
   * Safe parse with error handling
   */
  static safeParse<T>(
    schema: z.ZodType<T>,
    data: unknown
  ): {
    success: boolean;
    data?: T;
    error?: string;
  } {
    try {
      const parsed = schema.parse(data);
      return { success: true, data: parsed };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        };
      }
      return {
        success: false,
        error: 'Unknown validation error',
      };
    }
  }
}

// ===========================
// SCHEMA EXPORT MAP
// ===========================

/**
 * Centralized schema export for easy access
 */
export const SSODatabaseSchemas = {
  User: SSOUserSchema,
  UserRole: SSOUserRoleSchema,
  UserRoleAssignment: SSOUserRoleAssignmentSchema,
  Provider: SSOProviderSchema,
  Session: SSOSessionSchema,
  ApiKey: SSOApiKeySchema,
  AuditLog: SSOAuditLogSchema,
  SecurityEvent: SSOSecurityEventSchema,
  BackupExecution: SSOBackupExecutionSchema,
} as const;

export type SSODatabaseSchemaTypes = {
  User: SSOUser;
  UserRole: SSOUserRole;
  UserRoleAssignment: SSOUserRoleAssignment;
  Provider: SSOProvider;
  Session: SSOSession;
  ApiKey: SSOApiKey;
  AuditLog: SSOAuditLog;
  SecurityEvent: SSOSecurityEvent;
  BackupExecution: SSOBackupExecution;
};

/**
 * Export all schema types for external use
 */
export type {
  SSOUser,
  SSOUserRole,
  SSOUserRoleAssignment,
  SSOProvider,
  SSOSession,
  SSOApiKey,
  SSOAuditLog,
  SSOSecurityEvent,
  SSOBackupExecution,
};