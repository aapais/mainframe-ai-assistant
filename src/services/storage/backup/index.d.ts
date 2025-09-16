export { BackupService } from './BackupService';
export { RestoreService } from './RestoreService';
export { BackupScheduler } from './BackupScheduler';
export { BackupValidator } from './BackupValidator';
export { BackupStrategy, AbstractBackupStrategy, FullBackupStrategy, IncrementalBackupStrategy, DifferentialBackupStrategy, createBackupStrategy, isValidBackupStrategyType, getBackupStrategyDescription, getRecommendedStrategy } from './BackupStrategy';
export type { BackupDestination, BackupConfig, BackupRequest, BackupJob, BackupJobResult, BackupMetrics, ValidationResult, RestoreRequest, BackupInventory } from './BackupService';
export type { BackupStrategyType, BackupProgress, BackupExecutionContext, BackupMetadata, BackupDelta } from './BackupStrategy';
export type { ScheduleConfig, RetryPolicy, ScheduleConditions, TimeWindow, NotificationConfig, ScheduleExecution, ScheduleStats, PerformanceConfig } from './BackupScheduler';
export type { RestoreRequest, RestoreOptions, RestoreProgress, RestoreJob, RestoreValidationResult, RestoreMetrics, RestorePoint, BackupChain } from './RestoreService';
export type { ValidationConfig, ValidationRule, ValidationContext, ValidationProgress, ValidationResult as ValidatorResult, ValidationSummary, ValidationRuleResult, ValidationPerformance, ValidationReport, ValidationIssue } from './BackupValidator';
export { createCronExpression, validateCronExpression, getNextExecutionTime, COMMON_SCHEDULES } from './BackupScheduler';
export { calculateRestoreTime, getRestoreComplexity, formatRestoreEstimate } from './RestoreService';
export { StandardValidationRules, createDefaultValidationConfig, createQuickValidationConfig, formatValidationReport } from './BackupValidator';
export declare const BackupServiceFactory: {
    createDefault: (adapter: any) => BackupService;
    createEnterprise: (adapter: any, primaryDestination: any, secondaryDestination?: any) => BackupService;
    createDevelopment: (adapter: any) => BackupService;
};
export declare const BackupConfigurations: {
    NIGHTLY_FULL: {
        cronExpression: string;
        strategy: "full";
        description: string;
    };
    BUSINESS_HOURS_DIFFERENTIAL: {
        cronExpression: string;
        strategy: "differential";
        description: string;
    };
    HOURLY_INCREMENTAL: {
        cronExpression: string;
        strategy: "incremental";
        description: string;
    };
    WEEKLY_FULL_DAILY_DIFF: ({
        cronExpression: string;
        strategy: "full";
        description: string;
    } | {
        cronExpression: string;
        strategy: "differential";
        description: string;
    })[];
};
export declare class BackupServiceError extends Error {
    readonly code: string;
    readonly details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class BackupValidationError extends BackupServiceError {
    readonly validationResult: any;
    constructor(message: string, validationResult: any);
}
export declare class RestoreError extends BackupServiceError {
    readonly restoreJob?: any | undefined;
    constructor(message: string, restoreJob?: any | undefined);
}
export declare class ScheduleError extends BackupServiceError {
    readonly schedule?: any | undefined;
    constructor(message: string, schedule?: any | undefined);
}
export declare const BACKUP_CONSTANTS: {
    EXTENSIONS: {
        COMPRESSED: string;
        ENCRYPTED: string;
        BACKUP: string;
        DATABASE: string;
    };
    TIMEOUTS: {
        DEFAULT_BACKUP: number;
        DEFAULT_RESTORE: number;
        DEFAULT_VALIDATION: number;
        QUICK_VALIDATION: number;
    };
    LIMITS: {
        MAX_BACKUP_SIZE: number;
        MIN_BACKUP_SIZE: number;
        MAX_RETENTION_DAYS: number;
        MAX_CONCURRENT_BACKUPS: number;
        MAX_SCHEDULE_COUNT: number;
    };
    PERFORMANCE: {
        GOOD_BACKUP_TIME: number;
        ACCEPTABLE_BACKUP_TIME: number;
        GOOD_COMPRESSION_RATIO: number;
        MIN_TRANSFER_RATE: number;
    };
};
//# sourceMappingURL=index.d.ts.map