import { EventEmitter } from 'events';
export interface ValidationConfig {
    enableIntegrityChecks: boolean;
    enableChecksumValidation: boolean;
    enableRestoreValidation: boolean;
    validationSamplePercent: number;
    performance: {
        maxValidationTime: number;
        enableParallelValidation: boolean;
        maxConcurrentValidations: number;
    };
    rules: ValidationRule[];
}
export interface ValidationRule {
    id: string;
    name: string;
    type: 'checksum' | 'size' | 'schema' | 'data' | 'performance' | 'custom';
    severity: 'critical' | 'high' | 'medium' | 'low';
    enabled: boolean;
    config: Record<string, any>;
    validator: (context: ValidationContext) => Promise<ValidationRuleResult>;
}
export interface ValidationContext {
    backupPath: string;
    expectedChecksum?: string;
    expectedSize?: number;
    backupMetadata?: any;
    tempDirectory: string;
    validationConfig: ValidationConfig;
    progress?: ValidationProgress;
}
export interface ValidationProgress {
    phase: string;
    percentage: number;
    currentRule?: string;
    rulesCompleted: number;
    totalRules: number;
    issuesFound: number;
    estimatedTimeRemaining?: number;
}
export interface ValidationResult {
    success: boolean;
    overall: 'pass' | 'warning' | 'fail';
    summary: ValidationSummary;
    ruleResults: ValidationRuleResult[];
    performance: ValidationPerformance;
    recommendations: string[];
    report: ValidationReport;
}
export interface ValidationSummary {
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    failedChecks: number;
    criticalIssues: number;
    timeToValidate: number;
    dataIntegrityScore: number;
    reliabilityScore: number;
}
export interface ValidationRuleResult {
    ruleId: string;
    ruleName: string;
    status: 'pass' | 'warning' | 'fail' | 'skipped' | 'error';
    severity: 'critical' | 'high' | 'medium' | 'low';
    duration: number;
    details: string;
    evidence?: any;
    recommendations?: string[];
    metrics?: Record<string, number>;
}
export interface ValidationPerformance {
    totalDuration: number;
    ruleExecutionTimes: Record<string, number>;
    resourceUsage: {
        peakMemoryMb: number;
        avgCpuPercent: number;
        diskIoMb: number;
    };
    bottlenecks: string[];
}
export interface ValidationReport {
    timestamp: Date;
    backupInfo: {
        path: string;
        size: number;
        checksum: string;
        strategy?: string;
    };
    validationConfig: ValidationConfig;
    issues: ValidationIssue[];
    passedRules: string[];
    warnings: string[];
    errors: string[];
    recommendations: string[];
    nextValidationSuggested?: Date;
}
export interface ValidationIssue {
    id: string;
    ruleId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'integrity' | 'performance' | 'compatibility' | 'security';
    description: string;
    impact: string;
    resolution: string;
    evidence?: any;
    detectedAt: Date;
}
export declare class StandardValidationRules {
    static createChecksumRule(): ValidationRule;
    static createFileSizeRule(): ValidationRule;
    static createDatabaseIntegrityRule(): ValidationRule;
    static createSchemaValidationRule(): ValidationRule;
    static createPerformanceRule(): ValidationRule;
    static getAllStandardRules(): ValidationRule[];
}
export declare class BackupValidator extends EventEmitter {
    private config;
    private activeValidations;
    constructor(config: ValidationConfig);
    validate(backupPath: string, expectedChecksum?: string, options?: {
        expectedSize?: number;
        backupMetadata?: any;
        progressCallback?: (progress: ValidationProgress) => void;
    }): Promise<ValidationResult>;
    quickValidate(backupPath: string, expectedChecksum?: string): Promise<{
        valid: boolean;
        issues: string[];
    }>;
    getActiveValidations(): string[];
    getValidationProgress(validationId: string): ValidationProgress | null;
    cancelValidation(validationId: string): Promise<boolean>;
    updateConfig(updates: Partial<ValidationConfig>): void;
    addCustomRule(rule: ValidationRule): void;
    removeRule(ruleId: string): boolean;
    getRules(): ValidationRule[];
    private generateValidationId;
    private createTempDirectory;
    private cleanupTempDirectory;
    private generateValidationResult;
    private calculateIntegrityScore;
    private calculateReliabilityScore;
    private identifyBottlenecks;
    private createValidationIssue;
    private categorizeRule;
    private getImpactDescription;
    private generateRecommendations;
}
export declare function createDefaultValidationConfig(): ValidationConfig;
export declare function createQuickValidationConfig(): ValidationConfig;
export declare function formatValidationReport(result: ValidationResult): string;
//# sourceMappingURL=BackupValidator.d.ts.map