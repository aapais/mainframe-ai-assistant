import { EventEmitter } from 'events';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { BackupStrategy, BackupStrategyType } from './BackupStrategy';
export interface BackupDestination {
    id: string;
    name: string;
    type: 'local' | 'cloud' | 'network';
    path: string;
    credentials?: Record<string, any>;
    priority: number;
    enabled: boolean;
    config: {
        maxRetentionDays: number;
        maxBackupCount: number;
        compressionLevel: number;
        encryptionEnabled: boolean;
        encryptionKey?: string;
    };
}
export interface BackupConfig {
    destinations: BackupDestination[];
    defaultStrategy: BackupStrategyType;
    globalRetentionPolicy: {
        keepDaily: number;
        keepWeekly: number;
        keepMonthly: number;
        keepYearly: number;
    };
    performance: {
        maxConcurrentBackups: number;
        maxParallelDestinations: number;
        progressReportingInterval: number;
        timeoutMinutes: number;
    };
    validation: {
        enableIntegrityChecks: boolean;
        enableChecksumValidation: boolean;
        enableRestoreValidation: boolean;
        validationSamplePercent: number;
    };
    monitoring: {
        enableMetrics: boolean;
        enableAlerting: boolean;
        alertThresholds: {
            failureRate: number;
            responseTime: number;
            storageUsage: number;
        };
    };
}
export interface BackupRequest {
    id?: string;
    name?: string;
    description?: string;
    strategy: BackupStrategyType;
    destinations?: string[];
    metadata?: Record<string, any>;
    tags?: string[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    validateAfterBackup?: boolean;
    notifyOnCompletion?: boolean;
}
export interface BackupJob {
    id: string;
    request: BackupRequest;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    strategy: BackupStrategy;
    destinations: BackupDestination[];
    startTime?: Date;
    endTime?: Date;
    progress: {
        phase: string;
        percentage: number;
        currentDestination?: string;
        bytesProcessed: number;
        totalBytes: number;
        estimatedTimeRemaining?: number;
    };
    results: BackupJobResult[];
    error?: string;
    metrics?: BackupMetrics;
}
export interface BackupJobResult {
    destinationId: string;
    success: boolean;
    backupPath: string;
    size: number;
    compressedSize?: number;
    checksums: {
        original: string;
        backup: string;
    };
    duration: number;
    error?: string;
    validationResult?: ValidationResult;
}
export interface BackupMetrics {
    totalDuration: number;
    dataSize: number;
    compressionRatio: number;
    transferRate: number;
    validationTime?: number;
    destinationMetrics: Array<{
        destinationId: string;
        uploadTime: number;
        transferRate: number;
        retryCount: number;
    }>;
}
export interface ValidationResult {
    success: boolean;
    checksumMatch: boolean;
    integrityCheck: boolean;
    restoreTest?: boolean;
    errors: string[];
}
export interface RestoreRequest {
    backupId: string;
    destinationPath: string;
    strategy?: 'fastest' | 'most_reliable' | 'specific_destination';
    destinationId?: string;
    pointInTime?: Date;
    includeValidation?: boolean;
    preservePermissions?: boolean;
    overwriteExisting?: boolean;
}
export interface BackupInventory {
    totalBackups: number;
    totalSize: number;
    byStrategy: Record<BackupStrategyType, number>;
    byDestination: Record<string, {
        count: number;
        size: number;
        oldestBackup: Date;
        newestBackup: Date;
    }>;
    retentionStatus: {
        expiredBackups: number;
        orphanedBackups: number;
        corruptedBackups: number;
    };
}
export declare class BackupService extends EventEmitter {
    private adapter;
    private config;
    private scheduler;
    private restoreService;
    private validator;
    private strategies;
    private activeJobs;
    private initialized;
    constructor(adapter: IStorageAdapter, config: BackupConfig);
    initialize(): Promise<void>;
    stop(): Promise<void>;
    createBackup(request: BackupRequest): Promise<string>;
    getBackupJob(jobId: string): Promise<BackupJob | null>;
    listBackups(filter?: {
        strategy?: BackupStrategyType;
        destination?: string;
        status?: string;
        fromDate?: Date;
        toDate?: Date;
        tags?: string[];
        limit?: number;
    }): Promise<BackupJob[]>;
    cancelBackup(jobId: string): Promise<boolean>;
    restore(request: RestoreRequest): Promise<string>;
    listRestorePoints(backupId?: string): Promise<any[]>;
    scheduleBackup(cronExpression: string, request: BackupRequest, options?: {
        enabled?: boolean;
        name?: string;
    }): Promise<string>;
    unscheduleBackup(scheduleId: string): Promise<boolean>;
    listSchedules(): Promise<any[]>;
    getMetrics(): Promise<{
        service: any;
        destinations: any[];
        strategies: any[];
        performance: any;
    }>;
    getInventory(): Promise<BackupInventory>;
    healthCheck(): Promise<{
        status: 'healthy' | 'warning' | 'critical';
        issues: string[];
        destinations: Array<{
            id: string;
            status: string;
            message?: string;
        }>;
        performance: any;
    }>;
    addDestination(destination: BackupDestination): Promise<void>;
    removeDestination(destinationId: string): Promise<void>;
    testDestination(destinationId: string): Promise<{
        success: boolean;
        responseTime?: number;
        error?: string;
    }>;
    private ensureInitialized;
    private initializeStrategies;
    private validateDestinations;
    private validateDestination;
    private initializeMetadataStorage;
    private generateJobId;
    private createBackupJob;
    private executeBackupJob;
    private uploadToDestination;
    private validateBackupResults;
    private calculateBackupMetrics;
    private storeJobMetadata;
    private getCompletedJob;
    private getCompletedJobs;
    private hydrateJobFromRow;
    private cleanupPartialBackups;
    private encryptData;
    private getTotalJobCount;
    private calculateSuccessRate;
    private getDestinationMetrics;
    private getStrategyMetrics;
    private getPerformanceMetrics;
    private calculateRetentionStatus;
    private checkDestinationHealth;
    private destinationHasActiveBackups;
    private startRetentionPolicyEnforcement;
    private enforceRetentionPolicy;
    private logServiceStats;
}
//# sourceMappingURL=BackupService.d.ts.map