/**
 * AI Transparency Types and Interfaces
 * Defines types for AI operation tracking, cost management, and user authorization
 */

export type AIProvider = 'openai' | 'gemini' | 'claude' | 'local';

export type AIOperationType = 'search' | 'generation' | 'analysis' | 'chat' | 'completion';

export type UserDecision = 'approved' | 'denied' | 'modified' | 'auto_approved';

export type BudgetType = 'daily' | 'monthly' | 'yearly';

export type BudgetStatus = 'normal' | 'caution' | 'warning' | 'critical' | 'exceeded';

export type AlertType = '50_percent' | '80_percent' | '95_percent' | 'exceeded';

export interface AIOperation {
  id: string;
  operationType: AIOperationType;
  provider: AIProvider;
  model: string;
  queryText: string;
  purpose: string;
  estimatedCost: number;
  actualCost?: number;
  tokensInput: number;
  tokensOutput: number;
  userDecision: UserDecision;
  autoApproved: boolean;
  timeoutOccurred: boolean;
  responseText?: string;
  responseQualityRating?: number; // 1-5 scale
  executionTimeMs?: number;
  errorMessage?: string;
  sessionId: string;
  createdAt: string;
  completedAt?: string;
  userId: string;
}

export interface AIBudget {
  id: number;
  userId: string;
  budgetType: BudgetType;
  budgetAmount: number;
  currentUsage: number;
  alertThreshold50: boolean;
  alertThreshold80: boolean;
  alertThreshold95: boolean;
  alertsSent: string[]; // JSON array of sent alert types
  resetDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIPreferences {
  userId: string;
  alwaysAllowProviders: AIProvider[];
  alwaysAllowOperations: AIOperationType[];
  maxCostAutoApprove: number;
  defaultTimeoutSeconds: number;
  enableCostAlerts: boolean;
  enableUsageTracking: boolean;
  preferredProvider: AIProvider;
  preferredModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AICostRate {
  id: number;
  provider: AIProvider;
  model: string;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  costPerRequest: number;
  effectiveDate: string;
  deprecated: boolean;
  createdAt: string;
}

export interface AIBudgetAlert {
  id: number;
  userId: string;
  budgetId: number;
  alertType: AlertType;
  currentUsage: number;
  budgetAmount: number;
  percentageUsed: number;
  acknowledged: boolean;
  createdAt: string;
}

export interface BudgetStatus {
  budgetId: number;
  userId: string;
  budgetType: BudgetType;
  budgetAmount: number;
  currentUsage: number;
  usagePercentage: number;
  remainingBudget: number;
  status: BudgetStatus;
  resetDate: string;
  updatedAt: string;
}

export interface AIUsageSummary {
  userId: string;
  totalOperations: number;
  approvedOperations: number;
  deniedOperations: number;
  totalCost: number;
  avgCostPerOperation: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgExecutionTime: number;
  lastOperation: string;
}

export interface DailyAICosts {
  userId: string;
  operationDate: string;
  provider: AIProvider;
  operationType: AIOperationType;
  operationCount: number;
  dailyCost: number;
  dailyInputTokens: number;
  dailyOutputTokens: number;
}

// Authorization Dialog Props
export interface AuthorizationDialogProps {
  isOpen: boolean;
  operation: Partial<AIOperation>;
  estimatedCost: number;
  tokensEstimate: { input: number; output: number };
  onApprove: (modifiedOperation?: Partial<AIOperation>) => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;
  timeoutSeconds?: number;
}

// Cost Tracker Props
export interface CostTrackerProps {
  userId: string;
  compact?: boolean;
  showBudgetAlerts?: boolean;
  refreshIntervalMs?: number;
}

// Operation History Props
export interface OperationHistoryProps {
  userId: string;
  maxResults?: number;
  showFilters?: boolean;
  allowExport?: boolean;
  onOperationSelect?: (operation: AIOperation) => void;
}

// Cost Calculation Input
export interface CostCalculationInput {
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  operationType: AIOperationType;
}

// Cost Calculation Result
export interface CostCalculationResult {
  totalCost: number;
  inputCost: number;
  outputCost: number;
  requestCost: number;
  breakdown: {
    provider: AIProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    rateUsed: AICostRate;
  };
}

// Budget Alert Configuration
export interface BudgetAlertConfig {
  enabled: boolean;
  thresholds: {
    caution: number; // 50%
    warning: number; // 80%
    critical: number; // 95%
  };
  emailEnabled: boolean;
  soundEnabled: boolean;
  persistentNotification: boolean;
}

// Export Data Format
export interface ExportData {
  operations: AIOperation[];
  budgets: AIBudget[];
  summary: AIUsageSummary;
  exportedAt: string;
  userId: string;
  filters?: {
    dateRange?: { start: string; end: string };
    providers?: AIProvider[];
    operationTypes?: AIOperationType[];
  };
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Service Interface for AI Transparency
export interface AITransparencyService {
  // Operations
  createOperation(operation: Omit<AIOperation, 'id' | 'createdAt'>): Promise<AIOperation>;
  updateOperation(id: string, updates: Partial<AIOperation>): Promise<AIOperation>;
  getOperation(id: string): Promise<AIOperation | null>;
  getOperations(userId: string, filters?: any): Promise<PaginatedResponse<AIOperation>>;

  // Budget Management
  createBudget(budget: Omit<AIBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIBudget>;
  updateBudget(id: number, updates: Partial<AIBudget>): Promise<AIBudget>;
  getBudget(id: number): Promise<AIBudget | null>;
  getUserBudgets(userId: string): Promise<AIBudget[]>;
  getBudgetStatus(userId: string): Promise<BudgetStatus[]>;

  // Cost Calculation
  calculateCost(input: CostCalculationInput): Promise<CostCalculationResult>;
  getCostRates(provider?: AIProvider): Promise<AICostRate[]>;

  // Preferences
  getUserPreferences(userId: string): Promise<AIPreferences | null>;
  updateUserPreferences(
    userId: string,
    preferences: Partial<AIPreferences>
  ): Promise<AIPreferences>;

  // Analytics
  getUsageSummary(userId: string): Promise<AIUsageSummary>;
  getDailyCosts(userId: string, days?: number): Promise<DailyAICosts[]>;

  // Alerts
  getUnacknowledgedAlerts(userId: string): Promise<AIBudgetAlert[]>;
  acknowledgeAlert(alertId: number): Promise<void>;

  // Export
  exportData(userId: string, filters?: any): Promise<ExportData>;
}
