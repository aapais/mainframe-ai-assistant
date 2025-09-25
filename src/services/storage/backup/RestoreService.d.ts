import { EventEmitter } from 'events';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { BackupMetadata } from './BackupStrategy';
export interface RestoreRequest {
  id?: string;
  backupId?: string;
  backupPath?: string;
  destinationPath: string;
  strategy?: 'fastest' | 'most_reliable' | 'specific_destination' | 'point_in_time';
  destinationId?: string;
  pointInTime?: Date;
  includeValidation?: boolean;
  preservePermissions?: boolean;
  overwriteExisting?: boolean;
  restoreOptions?: RestoreOptions;
}
export interface RestoreOptions {
  selectiveTables?: string[];
  excludeTables?: string[];
  dataOnly?: boolean;
  schemaOnly?: boolean;
  remapTableNames?: Record<string, string>;
  beforeRestoreHook?: () => Promise<void>;
  afterRestoreHook?: () => Promise<void>;
  progressCallback?: (progress: RestoreProgress) => void;
}
export interface RestoreProgress {
  phase: string;
  percentage: number;
  currentTable?: string;
  tablesProcessed: number;
  totalTables: number;
  bytesProcessed: number;
  totalBytes: number;
  estimatedTimeRemaining?: number;
}
export interface RestoreJob {
  id: string;
  request: RestoreRequest;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: RestoreProgress;
  restoredPath?: string;
  backupChain?: BackupMetadata[];
  validationResult?: RestoreValidationResult;
  error?: string;
  metrics?: RestoreMetrics;
}
export interface RestoreValidationResult {
  success: boolean;
  checksumValid: boolean;
  schemaValid: boolean;
  dataIntegrityValid: boolean;
  tableCount: number;
  recordCount: number;
  issues: string[];
  performance: {
    validationTime: number;
    avgQueryTime: number;
  };
}
export interface RestoreMetrics {
  totalDuration: number;
  preparationTime: number;
  restoreTime: number;
  validationTime: number;
  dataSize: number;
  tablesRestored: number;
  recordsRestored: number;
  decompressionTime?: number;
  decryptionTime?: number;
}
export interface RestorePoint {
  id: string;
  timestamp: Date;
  backupId: string;
  strategy: string;
  size: number;
  entryCount: number;
  dependencies: string[];
  description?: string;
  tags?: string[];
}
export interface BackupChain {
  fullBackup: BackupMetadata;
  incrementalBackups: BackupMetadata[];
  differentialBackup?: BackupMetadata;
  totalSize: number;
  timeSpan: {
    start: Date;
    end: Date;
  };
}
export declare class RestoreService extends EventEmitter {
  private adapter;
  private config;
  private activeJobs;
  private completedJobs;
  constructor(adapter: IStorageAdapter, config: any);
  restore(request: RestoreRequest): Promise<string>;
  getRestoreJob(jobId: string): Promise<RestoreJob | null>;
  cancelRestore(jobId: string): Promise<boolean>;
  listRestorePoints(backupId?: string): Promise<RestorePoint[]>;
  findNearestRestorePoint(targetTime: Date): Promise<RestorePoint | null>;
  analyzeBackupChain(backupId: string): Promise<BackupChain | null>;
  private restoreFromFull;
  private restoreFromIncremental;
  private restoreFromDifferential;
  validateRestore(job: RestoreJob): Promise<RestoreValidationResult>;
  private validateSchema;
  private generateJobId;
  private createRestoreJob;
  private validateRestoreRequest;
  private executeRestoreJob;
  private updateProgress;
  private extractBackupData;
  private extractBackupMetadata;
  private validateBackupData;
  private verifyRestoredDatabase;
  private getBackupMetadata;
  private getAllBackupMetadata;
  private getBackupPath;
  private findBaseFullBackup;
  private getIncrementalChain;
  private restoreFullToPath;
  private applyIncrementalChanges;
  private applyDifferentialChanges;
  private getTableNames;
  private calculateRestoreMetrics;
  private cleanupPartialRestore;
}
export declare function calculateRestoreTime(backupChain: BackupChain): {
  estimated: number;
  factors: string[];
};
export declare function getRestoreComplexity(
  backupChain: BackupChain
): 'simple' | 'moderate' | 'complex';
export declare function formatRestoreEstimate(timeSeconds: number): string;
//# sourceMappingURL=RestoreService.d.ts.map
