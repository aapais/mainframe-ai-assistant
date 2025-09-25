import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  details?: any;
  timestamp: number;
  duration: number;
  remediation?: string[];
}
export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  checks: HealthCheckResult[];
  score: number;
  lastCheck: number;
  uptime: number;
}
export interface HealthCheckConfig {
  enabled: boolean;
  checkInterval: number;
  enableAutoRemediation: boolean;
  criticalThresholds: {
    corruptionDetected: boolean;
    schemaValidationFailed: boolean;
    performanceDegradation: number;
    diskSpaceLow: number;
    memoryUsageHigh: number;
    connectionFailures: number;
    queryFailureRate: number;
  };
  remediationActions: {
    vacuum: boolean;
    reindex: boolean;
    checkpoint: boolean;
    connectionPoolReset: boolean;
    cacheFlush: boolean;
  };
}
export interface IntegrityIssue {
  type: 'corruption' | 'constraint_violation' | 'index_mismatch' | 'foreign_key_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  table: string;
  description: string;
  affectedRows?: number;
  remediation: string[];
}
export declare class HealthCheck extends EventEmitter {
  private db;
  private config;
  private checkTimer?;
  private isChecking;
  private lastHealthStatus?;
  private checkHistory;
  private startTime;
  private healthChecks;
  constructor(db: Database.Database, config?: Partial<HealthCheckConfig>);
  private buildConfig;
  private initializeHealthChecks;
  private createHealthTables;
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void;
  startHealthChecks(): void;
  stopHealthChecks(): void;
  runHealthChecks(): Promise<HealthStatus>;
  private checkDatabaseIntegrity;
  private checkSchemaValidation;
  private checkPerformanceHealth;
  private checkConnectionHealth;
  private checkDiskSpace;
  private checkMemoryUsage;
  private checkQueryPerformance;
  private checkDataConsistency;
  private checkIndexHealth;
  private checkTransactionLog;
  private calculateOverallStatus;
  private calculateHealthScore;
  private createUnknownStatus;
  private storeHealthCheckResults;
  private recordIntegrityIssues;
  private triggerAutomaticRemediation;
  private executeRemediation;
  private cleanupHealthHistory;
  getHealthStatus(): HealthStatus | null;
  getHealthHistory(checkName?: string, limit?: number): HealthCheckResult[];
  getIntegrityIssues(resolved?: boolean): IntegrityIssue[];
  destroy(): void;
}
//# sourceMappingURL=HealthCheck.d.ts.map
