import Database from 'better-sqlite3';
export interface BackupMetadata {
    id: string;
    timestamp: Date;
    type: 'manual' | 'auto' | 'migration' | 'export';
    filePath: string;
    compressedSize: number;
    originalSize: number;
    checksum: string;
    entryCount: number;
    version: string;
    compressed: boolean;
    status: 'in_progress' | 'completed' | 'failed';
}
export interface RestoreOptions {
    backupId?: string;
    backupPath?: string;
    pointInTime?: Date;
    verifyIntegrity?: boolean;
    createRestorePoint?: boolean;
}
export declare class BackupManager {
    private db;
    private backupDir;
    private maxBackups;
    private compressionEnabled;
    constructor(db: Database.Database, backupDir?: string, maxBackups?: number, compressionEnabled?: boolean);
    createBackup(type?: 'manual' | 'auto' | 'migration' | 'export'): Promise<BackupMetadata>;
    restoreFromBackup(options: RestoreOptions): Promise<void>;
    listBackups(): BackupMetadata[];
    exportToJSON(outputPath: string): Promise<void>;
    importFromJSON(jsonPath: string, mergeMode?: boolean): Promise<void>;
    scheduleAutoBackups(intervalHours?: number): void;
    getBackupStats(): {
        totalBackups: number;
        totalSize: number;
        oldestBackup: Date | null;
        newestBackup: Date | null;
        averageSize: number;
        backupsByType: Record<string, number>;
    };
    private ensureBackupDirectory;
    private generateBackupId;
    private getDatabaseVersion;
    private getEntryCount;
    private createSQLiteBackup;
    private compressFile;
    private decompressFile;
    private calculateFileChecksum;
    private logBackupStart;
    private logBackupCompletion;
    private cleanupOldBackups;
    private getBackupPath;
    private getLatestBackupPath;
    private findBackupByTime;
    private prepareRestoreFile;
    private verifyBackupIntegrity;
    private verifyRestoredDatabase;
    private formatBytes;
}
//# sourceMappingURL=BackupManager.d.ts.map