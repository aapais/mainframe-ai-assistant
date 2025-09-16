// Type definitions for API Settings components and services

export interface APIProvider {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  apiKeyFormat: string;
  testEndpoint: string;
  pricingInfo: {
    inputCostPer1K: number;
    outputCostPer1K: number;
    currency: string;
  };
  documentationUrl: string;
  setupInstructions: string[];
  requiredHeaders?: Record<string, string>;
}

export interface APIKey {
  id: string;
  providerId: string;
  keyName: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  costThisMonth: number;
  monthlyLimit?: number;
  isSessionOnly: boolean;
}

export interface APIUsageStats {
  providerId: string;
  requestCount: number;
  totalCost: number;
  lastRequest: Date;
  errorCount: number;
  averageResponseTime: number;
}

export interface ConnectionTestResult {
  success: boolean;
  responseTime: number;
  error?: string;
  statusCode?: number;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
}

export interface APISettingsResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ImportResult {
  imported: number;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// IPC Channel definitions for type safety
export interface APISettingsIPC {
  // Provider management
  'api-settings:get-providers': () => Promise<APIProvider[]>;
  'api-settings:get-provider': (providerId: string) => Promise<APIProvider | null>;

  // Key management
  'api-settings:get-keys': () => Promise<APIKey[]>;
  'api-settings:store-key': (
    providerId: string,
    keyName: string,
    apiKey: string,
    isSessionOnly?: boolean,
    monthlyLimit?: number
  ) => Promise<APISettingsResponse<{ keyId: string }>>;
  'api-settings:delete-key': (keyId: string) => Promise<APISettingsResponse>;
  'api-settings:update-key-status': (keyId: string, isActive: boolean) => Promise<APISettingsResponse>;

  // Connection testing
  'api-settings:test-connection': (providerId: string, apiKey: string) => Promise<ConnectionTestResult>;
  'api-settings:test-stored-key': (keyId: string) => Promise<ConnectionTestResult>;

  // Usage statistics
  'api-settings:get-usage-stats': (providerId?: string) => Promise<APIUsageStats[]>;
  'api-settings:record-usage': (
    providerId: string,
    requestCount?: number,
    cost?: number,
    responseTime?: number,
    isError?: boolean
  ) => Promise<APISettingsResponse>;

  // Import/Export
  'api-settings:import-from-env': (envFilePath: string) => Promise<ImportResult>;
  'api-settings:export-configuration': () => Promise<APISettingsResponse<string>>;

  // Security operations
  'api-settings:clear-all-keys': () => Promise<APISettingsResponse>;
  'api-settings:validate-key-format': (providerId: string, apiKey: string) => Promise<ValidationResult>;

  // Session management
  'api-settings:get-session-keys': () => Promise<string[]>;
  'api-settings:clear-session-keys': () => Promise<APISettingsResponse>;
}

// React component prop types
export interface APISettingsProps {
  className?: string;
  onKeyAdded?: (keyId: string) => void;
  onKeyDeleted?: (keyId: string) => void;
  onTestCompleted?: (result: ConnectionTestResult) => void;
}

export interface ProviderSetupProps {
  provider: APIProvider;
  onClose?: () => void;
}

export interface UsageStatsProps {
  stats: APIUsageStats[];
  providers: APIProvider[];
  timeframe?: '24h' | '7d' | '30d' | '90d';
}

// Utility types
export type APIProviderType = 'openai' | 'anthropic' | 'gemini' | 'github-copilot';
export type TestStatus = 'idle' | 'testing' | 'success' | 'error';
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Configuration export format
export interface APIConfigurationExport {
  version: string;
  exportDate: string;
  keys: Omit<APIKey, 'maskedKey'>[];
  stats: APIUsageStats[];
  providers: Pick<APIProvider, 'id' | 'name'>[];
}

// Security event types
export interface SecurityEvent {
  type: 'key_added' | 'key_deleted' | 'key_tested' | 'unauthorized_access';
  timestamp: Date;
  providerId?: string;
  keyId?: string;
  details?: string;
}

// Form data types
export interface APIKeyFormData {
  keyName: string;
  apiKey: string;
  isSessionOnly: boolean;
  monthlyLimit: string;
}

export interface APISettingsFormData {
  selectedProvider: string;
  keyForm: APIKeyFormData;
  testResults: Record<string, ConnectionTestResult>;
  showKey: boolean;
  testing: string;
}

// Settings tab types
export type APISettingsTab = 'configure' | 'usage' | 'import-export' | 'security';

// Notification state
export interface NotificationState {
  type: NotificationType;
  message: string;
  id?: string;
  duration?: number;
}

export default {
  APIProvider,
  APIKey,
  APIUsageStats,
  ConnectionTestResult,
  APISettingsResponse,
  ImportResult,
  ValidationResult,
  APISettingsIPC,
  APISettingsProps,
  ProviderSetupProps,
  UsageStatsProps,
  APIProviderType,
  TestStatus,
  NotificationType,
  APIConfigurationExport,
  SecurityEvent,
  APIKeyFormData,
  APISettingsFormData,
  APISettingsTab,
  NotificationState
};