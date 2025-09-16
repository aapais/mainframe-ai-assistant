/**
 * AI Authorization Dialog Types
 * Provides comprehensive typing for MVP1 v8 transparency features
 */

// =========================
// CORE AUTHORIZATION TYPES
// =========================

/**
 * AI operation types that require user authorization
 */
export type AIOperationType =
  | 'semantic_search'
  | 'explain_error'
  | 'analyze_entry'
  | 'generate_summary'
  | 'extract_keywords'
  | 'classify_content'
  | 'translate_text'
  | 'improve_writing';

/**
 * Authorization decision types
 */
export type AuthorizationAction =
  | 'approve_once'
  | 'approve_always'
  | 'deny'
  | 'use_local_only'
  | 'modify_query';

/**
 * Authorization permission levels
 */
export type PermissionLevel = 'none' | 'ask_always' | 'auto_approve' | 'disabled';

// =========================
// REQUEST & RESPONSE TYPES
// =========================

/**
 * AI Authorization Request
 * Contains all data needed for user to make informed decision
 */
export interface AIAuthorizationRequest {
  /** Unique request identifier */
  id: string;

  /** Type of AI operation being requested */
  operationType: AIOperationType;

  /** Human-readable description of the operation */
  operationDescription: string;

  /** The query/prompt being sent to AI */
  query: string;

  /** Data context being shared with AI service */
  dataContext: AIDataContext;

  /** Cost and resource estimates */
  estimates: AIOperationEstimates;

  /** Available fallback options */
  fallbackOptions: AIFallbackOption[];

  /** Request timestamp */
  timestamp: Date;

  /** Priority level of the request */
  priority: 'low' | 'medium' | 'high' | 'critical';

  /** User session context */
  sessionContext?: SessionContext;
}

/**
 * Data being shared with AI service
 */
export interface AIDataContext {
  /** Types of data being processed */
  dataTypes: string[];

  /** Estimated data size in bytes */
  dataSizeBytes: number;

  /** Whether data contains PII */
  containsPII: boolean;

  /** Whether data is confidential */
  isConfidential: boolean;

  /** Data retention policy */
  retentionPolicy: 'no_retention' | 'session_only' | 'cached' | 'permanent';

  /** Specific data fields being shared */
  dataFields: DataField[];

  /** Data sources */
  dataSources: string[];
}

/**
 * Individual data field information
 */
export interface DataField {
  /** Field name/identifier */
  name: string;

  /** Data type */
  type: 'text' | 'number' | 'date' | 'boolean' | 'object' | 'array';

  /** Field sensitivity level */
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';

  /** Sample/preview of data (sanitized) */
  preview?: string;

  /** Why this field is needed */
  purpose?: string;
}

/**
 * Cost and performance estimates
 */
export interface AIOperationEstimates {
  /** Estimated tokens to be consumed */
  estimatedTokens: number;

  /** Estimated cost in USD */
  estimatedCostUSD: number;

  /** Estimated processing time range */
  estimatedTimeSeconds: {
    min: number;
    max: number;
    typical: number;
  };

  /** Confidence in estimates (0-1) */
  confidence: number;

  /** Breakdown of cost components */
  costBreakdown: CostBreakdown;

  /** Performance characteristics */
  performance: PerformanceMetrics;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Cost breakdown details
 */
export interface CostBreakdown {
  /** Input token cost */
  inputTokens: {
    count: number;
    costUSD: number;
    rate: number;
  };

  /** Output token cost */
  outputTokens: {
    count: number;
    costUSD: number;
    rate: number;
  };

  /** API call overhead */
  apiOverhead: number;

  /** Additional service fees */
  serviceFees: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Expected response time percentiles */
  responseTimePercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };

  /** Expected accuracy/quality score */
  expectedQuality: number;

  /** Cache hit probability */
  cacheHitProbability: number;

  /** Rate limit status */
  rateLimitStatus: {
    remaining: number;
    resetTime: Date;
  };
}

/**
 * Available fallback options
 */
export interface AIFallbackOption {
  /** Option identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this option does */
  description: string;

  /** Whether this is the recommended fallback */
  recommended: boolean;

  /** Performance characteristics of fallback */
  performance: {
    speed: 'instant' | 'fast' | 'moderate' | 'slow';
    accuracy: 'low' | 'medium' | 'high';
    coverage: 'limited' | 'partial' | 'complete';
  };

  /** Any limitations or caveats */
  limitations?: string[];
}

/**
 * Session context for request
 */
export interface SessionContext {
  /** Current user session ID */
  sessionId: string;

  /** User identifier */
  userId?: string;

  /** Previous related requests */
  relatedRequests: string[];

  /** User's current permission settings */
  currentPermissions: Record<AIOperationType, PermissionLevel>;

  /** Session start time */
  sessionStartTime: Date;
}

// =========================
// AUTHORIZATION RESPONSE
// =========================

/**
 * User's authorization response
 */
export interface AIAuthorizationResponse {
  /** Request ID this response is for */
  requestId: string;

  /** User's decision */
  action: AuthorizationAction;

  /** Modified query (if action is 'modify_query') */
  modifiedQuery?: string;

  /** Whether to remember this decision */
  rememberDecision: boolean;

  /** Scope of remembered decision */
  decisionScope?: DecisionScope;

  /** User's reasoning/notes */
  notes?: string;

  /** Response timestamp */
  timestamp: Date;

  /** Time taken to make decision (UX metric) */
  decisionTimeMs: number;
}

/**
 * Scope for remembered decisions
 */
export interface DecisionScope {
  /** Apply to operation type */
  operationType?: AIOperationType;

  /** Apply to similar data contexts */
  dataContext?: boolean;

  /** Apply to cost range */
  costRange?: {
    maxCostUSD: number;
  };

  /** Apply to time range */
  timeRange?: {
    maxSeconds: number;
  };

  /** Expiration for this rule */
  expiresAt?: Date;
}

// =========================
// DIALOG COMPONENT PROPS
// =========================

/**
 * Props for AIAuthorizationDialog component
 */
export interface AIAuthorizationDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;

  /** Authorization request to display */
  request: AIAuthorizationRequest | null;

  /** Callback when user makes decision */
  onResponse: (response: AIAuthorizationResponse) => void;

  /** Callback when dialog is closed/cancelled */
  onClose: () => void;

  /** Whether estimates are still loading */
  estimatesLoading?: boolean;

  /** Error in loading estimates */
  estimatesError?: string;

  /** Custom branding configuration */
  brandConfig?: BrandConfiguration;

  /** Accessibility configuration */
  accessibilityConfig?: AccessibilityConfiguration;

  /** Feature flags */
  features?: DialogFeatures;

  /** Test/demo mode */
  demoMode?: boolean;
}

/**
 * Brand configuration
 */
export interface BrandConfiguration {
  /** Primary brand color */
  primaryColor: string;

  /** Secondary brand color */
  secondaryColor: string;

  /** Company name */
  companyName: string;

  /** Custom logo URL */
  logoUrl?: string;

  /** Custom theme overrides */
  themeOverrides?: Record<string, string>;
}

/**
 * Accessibility configuration
 */
export interface AccessibilityConfiguration {
  /** WCAG compliance level */
  wcagLevel: 'A' | 'AA' | 'AAA';

  /** High contrast mode */
  highContrast: boolean;

  /** Screen reader optimizations */
  screenReader: boolean;

  /** Keyboard navigation enhancements */
  keyboardEnhanced: boolean;

  /** Focus management settings */
  focusManagement: {
    trapFocus: boolean;
    restoreFocus: boolean;
    skipLinks: boolean;
  };

  /** Animation preferences */
  reducedMotion: boolean;
}

/**
 * Dialog feature flags
 */
export interface DialogFeatures {
  /** Enable query editing */
  enableQueryEditing: boolean;

  /** Enable cost breakdown view */
  enableCostBreakdown: boolean;

  /** Enable data field inspection */
  enableDataInspection: boolean;

  /** Enable decision history */
  enableDecisionHistory: boolean;

  /** Enable export functionality */
  enableExport: boolean;

  /** Enable help/documentation links */
  enableHelp: boolean;
}

// =========================
// UI STATE MANAGEMENT
// =========================

/**
 * Dialog internal state
 */
export interface DialogState {
  /** Current tab/view */
  activeTab: DialogTab;

  /** Query being edited (if any) */
  editingQuery: string | null;

  /** Whether cost breakdown is expanded */
  costBreakdownExpanded: boolean;

  /** Whether data inspection is expanded */
  dataInspectionExpanded: boolean;

  /** Current decision being made */
  pendingDecision: Partial<AIAuthorizationResponse>;

  /** Validation errors */
  validationErrors: ValidationError[];

  /** Loading states */
  loadingStates: LoadingStates;
}

/**
 * Dialog tabs/views
 */
export type DialogTab = 'overview' | 'data' | 'cost' | 'fallbacks' | 'edit';

/**
 * Validation errors
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Loading states for different operations
 */
export interface LoadingStates {
  estimates: boolean;
  fallbacks: boolean;
  validation: boolean;
  submission: boolean;
}

// =========================
// UTILITY TYPES
// =========================

/**
 * Utility type for partial updates
 */
export type PartialUpdate<T> = Partial<T> & { id: string };

/**
 * Event handler types
 */
export type AuthorizationEventHandler = (event: AuthorizationEvent) => void;

/**
 * Authorization events
 */
export interface AuthorizationEvent {
  type: 'request' | 'response' | 'error' | 'cancel';
  timestamp: Date;
  data: any;
}

/**
 * Configuration for authorization service
 */
export interface AuthorizationConfig {
  /** Default permission levels */
  defaultPermissions: Record<AIOperationType, PermissionLevel>;

  /** Cost thresholds for auto-approval */
  costThresholds: {
    autoApprove: number;
    requireConfirmation: number;
    block: number;
  };

  /** Data sensitivity policies */
  sensitivityPolicies: Record<string, PermissionLevel>;

  /** Cache settings */
  cacheSettings: {
    enableEstimateCache: boolean;
    estimateCacheTTL: number;
    enableDecisionCache: boolean;
    decisionCacheTTL: number;
  };
}

// =========================
// EXPORT ALL TYPES
// =========================

export type {
  // Re-export commonly used types
  AIOperationType as OperationType,
  AuthorizationAction as Action,
  PermissionLevel as Permission,
  AIAuthorizationRequest as AuthRequest,
  AIAuthorizationResponse as AuthResponse,
  AIDataContext as DataContext,
  AIOperationEstimates as Estimates,
  DialogState,
  DialogTab
};