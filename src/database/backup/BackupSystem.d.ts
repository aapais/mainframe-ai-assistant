import { EventEmitter } from 'events';
export interface BackupConfig {
    backupPath: string;
    compression?: boolean;
    retentionDays?: number;
    intervalHours?: number;
    verifyIntegrity?: boolean;
    maxBackups?: number;
    namePattern?: string;
}
export interface BackupMetadata {
    id: string;
    filePath: string;
    originalPath: string;
    created: Date;
    size: number;
    compressed: boolean;
    checksum: string;
    version: string;
    entryCount: number;
    description?: string;
    tags?: string[];
}
export interface BackupResult {
    success: boolean;
    backupId: string;
    filePath: string;
    duration: number;
    originalSize: number;
    compressedSize?: number;
    compressionRatio?: number;
    checksum: string;
    error?: string;
}
export interface RestoreResult {
    success: boolean;
    restoredPath: string;
    duration: number;
    verificationPassed: boolean;
    error?: string;
}
export interface VerificationResult {
    valid: boolean;
    checksum: string;
    expectedChecksum: string;
    corruptionDetected: boolean;
    errors: string[];
}
export declare class BackupSystem extends EventEmitter {
    private config;
    private db;
    private schedulerTimer;
    private isInitialized;
    private metadataDb;
    constructor(config: BackupConfig);
    initialize(): Promise<void>;
    createBackup(dbPath: string, options?: {
        description?: string;
        tags?: string[];
        compress?: boolean;
        verify?: boolean;
    }): Promise<BackupResult>;
    restore(backupId: string, targetPath: string, options?: {
        verify?: boolean;
        overwrite?: boolean;
    }): Promise<RestoreResult>;
    listBackups(filter?: {
        tags?: string[];
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
    }): Promise<BackupMetadata[]>;
    deleteBackup(backupId: string): Promise<void>;
    startScheduler(dbPath?: string): Promise<void>;
    stopScheduler(): void;
    verifyBackup(backupPath: string, expectedChecksum?: string): Promise<VerificationResult>;
    getStats(): Promise<{
        totalBackups: number;
        totalSize: number;
        averageSize: number;
        oldestBackup: Date | null;
        newestBackup: Date | null;
        compressionSavings: number;
    }>;
    cleanupExpiredBackups(): Promise<number>;
    shutdown(): Promise<void>;
    private initializeMetadataDb;
    private generateBackupId;
    private calculateChecksum;
    private verifyBackupData;
    private storeBackupMetadata;
    private getBackupMetadata;
    private getDatabaseEntryCount;
    private getDatabaseVersion;
    private setupErrorHandling;
}
//# sourceMappingURL=BackupSystem.d.ts.map