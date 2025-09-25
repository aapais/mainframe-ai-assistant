import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { ConnectionPool } from './ConnectionPool';
import { MigrationManager } from './MigrationManager';
import { BackupManager } from './BackupManager';
import { PerformanceMonitor } from './PerformanceMonitor';
export interface DatabaseConfig {
  path: string;
  enableWAL?: boolean;
  enableForeignKeys?: boolean;
  timeout?: number;
  maxConnections?: number;
  cacheSize?: number;
  enableMonitoring?: boolean;
  backup?: {
    enabled: boolean;
    intervalHours?: number;
    retentionDays?: number;
    path?: string;
  };
  queryCache?: {
    enabled: boolean;
    maxSize?: number;
    ttlMs?: number;
  };
}
export interface TransactionOptions {
  isolation?: 'deferred' | 'immediate' | 'exclusive';
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}
export interface QueryResult<T = any> {
  data: T;
  executionTime: number;
  fromCache: boolean;
  affectedRows?: number;
}
export interface DatabaseHealth {
  connected: boolean;
  version: string;
  size: number;
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  performance: {
    avgQueryTime: number;
    cacheHitRate: number;
    queueLength: number;
  };
  lastBackup?: Date;
  issues: string[];
}
export declare class DatabaseManager extends EventEmitter {
  private config;
  private db;
  private connectionPool;
  private migrationManager;
  private backupManager;
  private performanceMonitor;
  private queryCache;
  private isInitialized;
  private shutdownInProgress;
  private healthCheckInterval?;
  constructor(config: DatabaseConfig);
  initialize(): Promise<void>;
  query<T = any>(
    sql: string,
    params?: any[],
    options?: {
      useCache?: boolean;
      cacheKey?: string;
      maxRetries?: number;
      timeout?: number;
    }
  ): Promise<QueryResult<T>>;
  transaction<T>(
    callback: (db: Database.Database) => Promise<T> | T,
    options?: TransactionOptions
  ): Promise<T>;
  getHealth(): Promise<DatabaseHealth>;
  backup(description?: string): Promise<string>;
  restore(backupPath: string): Promise<void>;
  optimize(): Promise<void>;
  shutdown(): Promise<void>;
  private configureDatabase;
  private runMigrations;
  private startBackgroundTasks;
  private startHealthMonitoring;
  private executeTransaction;
  private generateCacheKey;
  private setupErrorHandling;
  private cleanup;
  private ensureInitialized;
  get migrationManager(): MigrationManager;
  get backupManager(): BackupManager;
  get performanceMonitor(): PerformanceMonitor;
  get connectionPool(): ConnectionPool;
}
//# sourceMappingURL=DatabaseManager.d.ts.map
