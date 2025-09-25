const { z } = require('zod');

// User creation validation schema
const createUserSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial'
    ),
  firstName: z.string().min(1, 'Primeiro nome é obrigatório').max(50, 'Nome muito longo'),
  lastName: z.string().min(1, 'Último nome é obrigatório').max(50, 'Nome muito longo'),
  role: z.enum(['admin', 'analyst', 'user'], 'Role inválido'),
  department: z.string().optional(),
  phoneNumber: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().default('pt-BR'),
});

// User update validation schema
const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  role: z.enum(['admin', 'analyst', 'user']).optional(),
  department: z.string().optional(),
  phoneNumber: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Password change validation
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z
      .string()
      .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Nova senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial'
      ),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  });

// User preferences validation
const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  language: z.string().default('pt-BR'),
  timezone: z.string().default('America/Sao_Paulo'),
  notifications: z
    .object({
      email: z.boolean().default(true),
      push: z.boolean().default(true),
      inApp: z.boolean().default(true),
      incidents: z.boolean().default(true),
      systemAlerts: z.boolean().default(true),
      weeklyReports: z.boolean().default(false),
    })
    .default({}),
  searchSettings: z
    .object({
      defaultCategory: z.string().optional(),
      resultsPerPage: z.number().min(10).max(100).default(20),
      enableAI: z.boolean().default(true),
      enableAutoComplete: z.boolean().default(true),
      saveSearchHistory: z.boolean().default(true),
    })
    .default({}),
  securitySettings: z
    .object({
      sessionTimeout: z.number().min(300).max(86400).default(3600), // 5 minutes to 24 hours
      requireMFA: z.boolean().default(false),
      allowedIPs: z.array(z.string().ip()).optional(),
      loginNotifications: z.boolean().default(true),
      suspiciousActivityAlerts: z.boolean().default(true),
    })
    .default({}),
  dashboardSettings: z
    .object({
      layout: z.enum(['grid', 'list', 'compact']).default('grid'),
      widgetsEnabled: z.array(z.string()).default([]),
      refreshInterval: z.number().min(30).max(3600).default(300),
    })
    .default({}),
});

// API key validation
const createApiKeySchema = z.object({
  name: z.string().min(1, 'Nome da API key é obrigatório').max(100),
  description: z.string().max(500).optional(),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'github-copilot']),
  permissions: z.array(z.string()).default(['read']),
  expiresAt: z.string().datetime().optional(),
  ipRestrictions: z.array(z.string().ip()).optional(),
  monthlyLimit: z.number().min(0).optional(),
});

// SSO configuration validation
const ssoConfigSchema = z.object({
  provider: z.enum(['google', 'microsoft', 'okta', 'auth0', 'saml']),
  displayName: z.string().min(1).max(100),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  domain: z.string().optional(),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default(['openid', 'profile', 'email']),
  isActive: z.boolean().default(true),
  autoCreateUsers: z.boolean().default(false),
  defaultRole: z.enum(['admin', 'analyst', 'user']).default('user'),
  attributeMapping: z
    .object({
      email: z.string().default('email'),
      firstName: z.string().default('given_name'),
      lastName: z.string().default('family_name'),
      role: z.string().optional(),
    })
    .default({}),
});

// Bulk operations validation
const bulkUserOperationSchema = z.object({
  operation: z.enum(['activate', 'deactivate', 'delete', 'updateRole', 'resetPassword']),
  userIds: z.array(z.string().uuid()).min(1, 'Pelo menos um usuário deve ser selecionado'),
  parameters: z
    .object({
      role: z.enum(['admin', 'analyst', 'user']).optional(),
      sendNotification: z.boolean().default(true),
    })
    .optional(),
});

// Password reset validation
const passwordResetRequestSchema = z.object({
  email: z.string().email('Email inválido'),
});

const passwordResetCompleteSchema = z
  .object({
    token: z.string().min(1, 'Token é obrigatório'),
    newPassword: z
      .string()
      .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Nova senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial'
      ),
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  });

// MFA setup validation
const mfaSetupSchema = z.object({
  type: z.enum(['totp', 'sms', 'email']),
  phoneNumber: z.string().optional(),
});

const mfaVerifySchema = z.object({
  token: z.string().min(6).max(8),
  type: z.enum(['totp', 'sms', 'email']),
});

// Session management validation
const sessionValidationSchema = z.object({
  deviceInfo: z
    .object({
      userAgent: z.string(),
      ipAddress: z.string().ip(),
      location: z.string().optional(),
      deviceId: z.string().optional(),
    })
    .optional(),
});

// Export/Import validation
const exportUserDataSchema = z.object({
  userIds: z.array(z.string().uuid()).optional(),
  includePreferences: z.boolean().default(true),
  includeApiKeys: z.boolean().default(false),
  includeSessions: z.boolean().default(false),
  format: z.enum(['json', 'csv']).default('json'),
});

const importUserDataSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  overwriteExisting: z.boolean().default(false),
  sendWelcomeEmail: z.boolean().default(true),
  defaultPassword: z.string().optional(),
});

// Query/Filter validation
const userQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['admin', 'analyst', 'user']).optional(),
  isActive: z.coerce.boolean().optional(),
  department: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  lastLoginAfter: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'lastLogin', 'firstName', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  userPreferencesSchema,
  createApiKeySchema,
  ssoConfigSchema,
  bulkUserOperationSchema,
  passwordResetRequestSchema,
  passwordResetCompleteSchema,
  mfaSetupSchema,
  mfaVerifySchema,
  sessionValidationSchema,
  exportUserDataSchema,
  importUserDataSchema,
  userQuerySchema,
};
