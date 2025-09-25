import { IStorageAdapter } from '../adapters/IStorageAdapter';
export type BackupStrategyType = 'full' | 'incremental' | 'differential';
export interface BackupProgress {
  phase: string;
  percentage: number;
  currentDestination?: string;
  bytesProcessed: number;
  totalBytes: number;
  estimatedTimeRemaining?: number;
}
export interface BackupExecutionContext {
  workingDirectory: string;
  previousBackupMetadata?: BackupMetadata;
  lastFullBackupMetadata?: BackupMetadata;
  compressionLevel: number;
  includeAnalytics: boolean;
  customFilters?: string[];
}
export interface BackupMetadata {
  id: string;
  strategy: BackupStrategyType;
  timestamp: Date;
  checksum: string;
  size: number;
  entryCount: number;
  tableChecksums: Record<string, string>;
  version: string;
  dependencies?: string[];
}
export interface BackupDelta {
  added: Array<{
    table: string;
    entries: any[];
  }>;
  modified: Array<{
    table: string;
    entries: any[];
  }>;
  deleted: Array<{
    table: string;
    ids: string[];
  }>;
  metadata: {
    totalChanges: number;
    tablesAffected: string[];
    changeTypes: Record<string, number>;
  };
}
export declare abstract class AbstractBackupStrategy {
  protected type: BackupStrategyType;
  protected metadata: BackupMetadata | null;
  constructor(type: BackupStrategyType);
  abstract execute(
    adapter: IStorageAdapter,
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer>;
  abstract getRequiredDependencies(): string[];
  abstract validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{
    valid: boolean;
    issues: string[];
  }>;
  getType(): BackupStrategyType;
  getMetadata(): BackupMetadata | null;
  protected generateBackupId(): string;
  protected updateProgress(
    progress: BackupProgress,
    phase: string,
    percentage: number,
    bytesProcessed?: number
  ): void;
  protected calculateTableChecksum(adapter: IStorageAdapter, tableName: string): Promise<string>;
  protected getAllTableNames(adapter: IStorageAdapter): Promise<string[]>;
}
export declare class FullBackupStrategy extends AbstractBackupStrategy {
  constructor();
  execute(
    adapter: IStorageAdapter,
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer>;
  getRequiredDependencies(): string[];
  validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{
    valid: boolean;
    issues: string[];
  }>;
  private getDatabasePath;
  private getTotalEntryCount;
  private getDatabaseVersion;
  private createBackupPackage;
  private formatBytes;
}
export declare class IncrementalBackupStrategy extends AbstractBackupStrategy {
  constructor();
  execute(
    adapter: IStorageAdapter,
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer>;
  getRequiredDependencies(): string[];
  validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{
    valid: boolean;
    issues: string[];
  }>;
  private calculateDelta;
  private createDeltaPackage;
  private createBackupPackage;
  private checkTimestampColumns;
  private tableHasTimestamp;
  private calculateAffectedTableChecksums;
  private getDatabaseVersion;
}
export declare class DifferentialBackupStrategy extends AbstractBackupStrategy {
  constructor();
  execute(
    adapter: IStorageAdapter,
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer>;
  getRequiredDependencies(): string[];
  validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{
    valid: boolean;
    issues: string[];
  }>;
  private calculateDifferentialDelta;
  private createDeltaPackage;
  private createBackupPackage;
  private tableHasTimestamp;
  private calculateAffectedTableChecksums;
  private getDatabaseVersion;
}
export declare class BackupStrategy {
  private strategy;
  constructor(type: BackupStrategyType);
  execute(
    adapter: IStorageAdapter,
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer>;
  getRequiredDependencies(): string[];
  validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{
    valid: boolean;
    issues: string[];
  }>;
  getType(): BackupStrategyType;
  getMetadata(): BackupMetadata | null;
}
export declare function createBackupStrategy(type: BackupStrategyType): BackupStrategy;
export declare function isValidBackupStrategyType(type: string): type is BackupStrategyType;
export declare function getBackupStrategyDescription(type: BackupStrategyType): string;
export declare function getRecommendedStrategy(
  dataSize: number,
  changeFrequency: 'low' | 'medium' | 'high',
  storageConstraints: 'none' | 'limited' | 'critical'
): BackupStrategyType;
//# sourceMappingURL=BackupStrategy.d.ts.map
