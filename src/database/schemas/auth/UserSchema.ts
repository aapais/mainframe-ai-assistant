import { z } from 'zod';

export const UserRoleSchema = z.enum(['user', 'analyst', 'admin', 'super_admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const MFAMethodSchema = z.enum(['totp', 'sms', 'email', 'hardware_key']);
export type MFAMethod = z.infer<typeof MFAMethodSchema>;

export const SessionStatusSchema = z.enum(['active', 'expired', 'revoked', 'suspicious']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(255),
  emailVerified: z.boolean().default(false),
  passwordHash: z.string().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  displayName: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional(),
  role: UserRoleSchema.default('user'),
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isSuspended: z.boolean().default(false),
  suspendedReason: z.string().max(500).optional(),
  suspendedUntil: z.date().optional(),
  lastLogin: z.date().optional(),
  lastActivity: z.date().optional(),
  loginAttempts: z.number().int().min(0).default(0),
  lockedUntil: z.date().optional(),
  passwordChangedAt: z.date().optional(),
  mfaEnabled: z.boolean().default(false),
  mfaSecret: z.string().optional(),
  mfaMethods: z.array(MFAMethodSchema).default([]),
  backupCodes: z.array(z.string()).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  deletedAt: z.date().optional(),
  metadata: z.record(z.any()).optional(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  lastLogin: true,
  lastActivity: true,
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = UserSchema.partial().omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const SSOProviderSchema = z.enum([
  'google',
  'microsoft',
  'azure_ad',
  'okta',
  'auth0',
  'ldap',
  'saml',
  'oidc',
  'github',
  'gitlab',
]);

export type SSOProvider = z.infer<typeof SSOProviderSchema>;

export const SSOConfigurationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(100),
  provider: SSOProviderSchema,
  isEnabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  clientId: z.string().max(255),
  clientSecret: z.string().max(500),
  discoveryUrl: z.string().url().optional(),
  authorizationUrl: z.string().url().optional(),
  tokenUrl: z.string().url().optional(),
  userinfoUrl: z.string().url().optional(),
  scopes: z.array(z.string()).default(['openid', 'profile', 'email']),
  claimsMapping: z.object({
    email: z.string().default('email'),
    firstName: z.string().default('given_name'),
    lastName: z.string().default('family_name'),
    displayName: z.string().default('name'),
    roles: z.string().optional(),
    groups: z.string().optional(),
  }),
  domainRestriction: z.array(z.string()).optional(),
  autoProvisionUsers: z.boolean().default(true),
  defaultRole: UserRoleSchema.default('user'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  metadata: z.record(z.any()).optional(),
});

export type SSOConfiguration = z.infer<typeof SSOConfigurationSchema>;

export const UserSSOConnectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  ssoConfigId: z.string().uuid(),
  externalId: z.string().max(255),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.date().optional(),
  lastSync: z.date().optional(),
  syncData: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type UserSSOConnection = z.infer<typeof UserSSOConnectionSchema>;

export const UserSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sessionToken: z.string(),
  refreshToken: z.string().optional(),
  deviceId: z.string().max(255).optional(),
  deviceName: z.string().max(255).optional(),
  deviceType: z.string().max(50).optional(),
  ipAddress: z.string().max(45),
  userAgent: z.string().max(1000),
  location: z
    .object({
      country: z.string().max(100).optional(),
      region: z.string().max(100).optional(),
      city: z.string().max(100).optional(),
      timezone: z.string().max(50).optional(),
    })
    .optional(),
  status: SessionStatusSchema.default('active'),
  expiresAt: z.date(),
  lastActivity: z.date().default(() => new Date()),
  createdAt: z.date().default(() => new Date()),
  revokedAt: z.date().optional(),
  revokedBy: z.string().uuid().optional(),
  revokedReason: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

export type UserSession = z.infer<typeof UserSessionSchema>;

export const UserPermissionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(500).optional(),
  resource: z.string().max(100),
  action: z.string().max(50),
  conditions: z.record(z.any()).optional(),
  isSystemPermission: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type UserPermission = z.infer<typeof UserPermissionSchema>;

export const UserRolePermissionSchema = z.object({
  roleId: z.string().max(50),
  permissionId: z.string().uuid(),
  grantedAt: z.date().default(() => new Date()),
  grantedBy: z.string().uuid(),
});

export type UserRolePermission = z.infer<typeof UserRolePermissionSchema>;

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  action: z.string().max(100),
  resource: z.string().max(100).optional(),
  resourceId: z.string().max(255).optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(1000).optional(),
  success: z.boolean().default(true),
  errorMessage: z.string().max(1000).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  timestamp: z.date().default(() => new Date()),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const SecurityEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  eventType: z.enum([
    'failed_login',
    'password_change',
    'mfa_setup',
    'suspicious_activity',
    'account_locked',
    'permission_escalation',
    'unusual_location',
    'multiple_sessions',
    'api_key_created',
    'api_key_compromised',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().max(1000),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(1000).optional(),
  resolved: z.boolean().default(false),
  resolvedBy: z.string().uuid().optional(),
  resolvedAt: z.date().optional(),
  actionTaken: z.string().max(500).optional(),
  timestamp: z.date().default(() => new Date()),
});

export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

export class UserSchemaValidator {
  static validateUser(data: unknown): User {
    return UserSchema.parse(data);
  }

  static validateCreateUser(data: unknown): CreateUser {
    return CreateUserSchema.parse(data);
  }

  static validateUpdateUser(data: unknown): UpdateUser {
    return UpdateUserSchema.parse(data);
  }

  static validateSSOConfig(data: unknown): SSOConfiguration {
    return SSOConfigurationSchema.parse(data);
  }

  static validateSession(data: unknown): UserSession {
    return UserSessionSchema.parse(data);
  }

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

export const UserSchemas = {
  User: UserSchema,
  CreateUser: CreateUserSchema,
  UpdateUser: UpdateUserSchema,
  SSOConfiguration: SSOConfigurationSchema,
  UserSSOConnection: UserSSOConnectionSchema,
  UserSession: UserSessionSchema,
  UserPermission: UserPermissionSchema,
  UserRolePermission: UserRolePermissionSchema,
  AuditLog: AuditLogSchema,
  SecurityEvent: SecurityEventSchema,
} as const;
