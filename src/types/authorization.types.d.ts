export type AIOperationType = 'semantic_search' | 'explain_error' | 'analyze_entry' | 'generate_summary' | 'extract_keywords' | 'classify_content' | 'translate_text' | 'improve_writing';
export type AuthorizationAction = 'approve_once' | 'approve_always' | 'deny' | 'use_local_only' | 'modify_query';
export type PermissionLevel = 'none' | 'ask_always' | 'auto_approve' | 'disabled';
export interface AIAuthorizationRequest {
    id: string;
    operationType: AIOperationType;
    operationDescription: string;
    query: string;
    dataContext: AIDataContext;
    estimates: AIOperationEstimates;
    fallbackOptions: AIFallbackOption[];
    timestamp: Date;
    priority: 'low' | 'medium' | 'high' | 'critical';
    sessionContext?: SessionContext;
}
export interface AIDataContext {
    dataTypes: string[];
    dataSizeBytes: number;
    containsPII: boolean;
    isConfidential: boolean;
    retentionPolicy: 'no_retention' | 'session_only' | 'cached' | 'permanent';
    dataFields: DataField[];
    dataSources: string[];
}
export interface DataField {
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'object' | 'array';
    sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
    preview?: string;
    purpose?: string;
}
export interface AIOperationEstimates {
    estimatedTokens: number;
    estimatedCostUSD: number;
    estimatedTimeSeconds: {
        min: number;
        max: number;
        typical: number;
    };
    confidence: number;
    costBreakdown: CostBreakdown;
    performance: PerformanceMetrics;
    updatedAt: Date;
}
export interface CostBreakdown {
    inputTokens: {
        count: number;
        costUSD: number;
        rate: number;
    };
    outputTokens: {
        count: number;
        costUSD: number;
        rate: number;
    };
    apiOverhead: number;
    serviceFees: number;
}
export interface PerformanceMetrics {
    responseTimePercentiles: {
        p50: number;
        p95: number;
        p99: number;
    };
    expectedQuality: number;
    cacheHitProbability: number;
    rateLimitStatus: {
        remaining: number;
        resetTime: Date;
    };
}
export interface AIFallbackOption {
    id: string;
    name: string;
    description: string;
    recommended: boolean;
    performance: {
        speed: 'instant' | 'fast' | 'moderate' | 'slow';
        accuracy: 'low' | 'medium' | 'high';
        coverage: 'limited' | 'partial' | 'complete';
    };
    limitations?: string[];
}
export interface SessionContext {
    sessionId: string;
    userId?: string;
    relatedRequests: string[];
    currentPermissions: Record<AIOperationType, PermissionLevel>;
    sessionStartTime: Date;
}
export interface AIAuthorizationResponse {
    requestId: string;
    action: AuthorizationAction;
    modifiedQuery?: string;
    rememberDecision: boolean;
    decisionScope?: DecisionScope;
    notes?: string;
    timestamp: Date;
    decisionTimeMs: number;
}
export interface DecisionScope {
    operationType?: AIOperationType;
    dataContext?: boolean;
    costRange?: {
        maxCostUSD: number;
    };
    timeRange?: {
        maxSeconds: number;
    };
    expiresAt?: Date;
}
export interface AIAuthorizationDialogProps {
    isOpen: boolean;
    request: AIAuthorizationRequest | null;
    onResponse: (response: AIAuthorizationResponse) => void;
    onClose: () => void;
    estimatesLoading?: boolean;
    estimatesError?: string;
    brandConfig?: BrandConfiguration;
    accessibilityConfig?: AccessibilityConfiguration;
    features?: DialogFeatures;
    demoMode?: boolean;
}
export interface BrandConfiguration {
    primaryColor: string;
    secondaryColor: string;
    companyName: string;
    logoUrl?: string;
    themeOverrides?: Record<string, string>;
}
export interface AccessibilityConfiguration {
    wcagLevel: 'A' | 'AA' | 'AAA';
    highContrast: boolean;
    screenReader: boolean;
    keyboardEnhanced: boolean;
    focusManagement: {
        trapFocus: boolean;
        restoreFocus: boolean;
        skipLinks: boolean;
    };
    reducedMotion: boolean;
}
export interface DialogFeatures {
    enableQueryEditing: boolean;
    enableCostBreakdown: boolean;
    enableDataInspection: boolean;
    enableDecisionHistory: boolean;
    enableExport: boolean;
    enableHelp: boolean;
}
export interface DialogState {
    activeTab: DialogTab;
    editingQuery: string | null;
    costBreakdownExpanded: boolean;
    dataInspectionExpanded: boolean;
    pendingDecision: Partial<AIAuthorizationResponse>;
    validationErrors: ValidationError[];
    loadingStates: LoadingStates;
}
export type DialogTab = 'overview' | 'data' | 'cost' | 'fallbacks' | 'edit';
export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}
export interface LoadingStates {
    estimates: boolean;
    fallbacks: boolean;
    validation: boolean;
    submission: boolean;
}
export type PartialUpdate<T> = Partial<T> & {
    id: string;
};
export type AuthorizationEventHandler = (event: AuthorizationEvent) => void;
export interface AuthorizationEvent {
    type: 'request' | 'response' | 'error' | 'cancel';
    timestamp: Date;
    data: any;
}
export interface AuthorizationConfig {
    defaultPermissions: Record<AIOperationType, PermissionLevel>;
    costThresholds: {
        autoApprove: number;
        requireConfirmation: number;
        block: number;
    };
    sensitivityPolicies: Record<string, PermissionLevel>;
    cacheSettings: {
        enableEstimateCache: boolean;
        estimateCacheTTL: number;
        enableDecisionCache: boolean;
        decisionCacheTTL: number;
    };
}
export type { AIOperationType as OperationType, AuthorizationAction as Action, PermissionLevel as Permission, AIAuthorizationRequest as AuthRequest, AIAuthorizationResponse as AuthResponse, AIDataContext as DataContext, AIOperationEstimates as Estimates, DialogState, DialogTab };
//# sourceMappingURL=authorization.types.d.ts.map