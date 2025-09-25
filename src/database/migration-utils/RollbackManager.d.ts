import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface RollbackPoint {
  id: string;
  version: number;
  createdAt: Date;
  backupPath?: string;
  description: string;
  rollbackSql: string;
  checksum: string;
}
export interface RollbackResult {
  success: boolean;
  rolledBackToVersion: number;
  stepsExecuted: number;
  errors: string[];
  warnings: string[];
  duration: number;
}
export declare class RollbackManager extends EventEmitter {
  private db;
  private rollbackPoints;
  constructor(db: Database.Database);
  createRollbackPoint(version: number, description: string, rollbackSql?: string): Promise<string>;
  rollbackToVersion(targetVersion: number): Promise<RollbackResult>;
  rollbackMigration(version: number): Promise<RollbackResult>;
  restoreFromBackup(backupPath: string): Promise<void>;
  validateRollbackCapability(
    fromVersion: number,
    toVersion: number
  ): Promise<{
    canRollback: boolean;
    missingRollbackSql: number[];
    missingBackups: number[];
    warnings: string[];
  }>;
  getAvailableRollbackPoints(): RollbackPoint[];
  cleanupOldRollbackPoints(retentionDays?: number): Promise<{
    cleaned: number;
    errors: string[];
  }>;
  testRollback(
    fromVersion: number,
    toVersion: number
  ): Promise<{
    success: boolean;
    steps: number;
    duration: number;
    errors: string[];
  }>;
  private loadRollbackPoints;
  private saveRollbackPoint;
  private removeRollbackPoint;
  private createDatabaseBackup;
  private getRollbackSteps;
  private executeRollbackStep;
  private getCurrentVersion;
  private calculateDatabaseChecksum;
  getRollbackStatistics(): {
    totalRollbackPoints: number;
    oldestRollbackPoint?: Date;
    newestRollbackPoint?: Date;
    totalBackupSize: number;
    versionsWithRollback: number[];
    versionsWithoutRollback: number[];
  };
}
//# sourceMappingURL=RollbackManager.d.ts.map
