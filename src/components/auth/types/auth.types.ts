export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin' | 'manager';
  provider: SSOProvider;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSOProvider {
  id: string;
  name: string;
  type: 'google' | 'microsoft' | 'github' | 'okta' | 'saml';
  icon: string;
  enabled: boolean;
  clientId?: string;
  redirectUri: string;
  scopes: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  providers: SSOProvider[];
  session: Session | null;
}

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  device: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  userId: string;
  permissions: string[];
  expiresAt: Date | null;
  lastUsed: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface MFAMethod {
  id: string;
  type: 'totp' | 'sms' | 'email' | 'backup_codes';
  name: string;
  isEnabled: boolean;
  isPrimary: boolean;
  createdAt: Date;
}

export interface SecurityEvent {
  id: string;
  userId: string;
  type: 'login' | 'logout' | 'password_change' | 'mfa_setup' | 'api_key_created' | 'suspicious_activity';
  description: string;
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    security: boolean;
    marketing: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    activityTracking: boolean;
    dataCollection: boolean;
  };
  updatedAt: Date;
}

export interface LoginFormData {
  email?: string;
  password?: string;
  provider?: string;
  rememberMe?: boolean;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface MFASetupData {
  method: 'totp' | 'sms' | 'email';
  phoneNumber?: string;
  backupCodes?: string[];
  qrCode?: string;
  secret?: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface AuthContextType extends AuthState {
  login: (data: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (data: PasswordChangeData) => Promise<void>;
  setupMFA: (data: MFASetupData) => Promise<void>;
  disableMFA: () => Promise<void>;
  createAPIKey: (name: string, permissions: string[]) => Promise<APIKey>;
  revokeAPIKey: (keyId: string) => Promise<void>;
  getSessions: () => Promise<Session[]>;
  revokeSession: (sessionId: string) => Promise<void>;
  getSecurityEvents: () => Promise<SecurityEvent[]>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
}