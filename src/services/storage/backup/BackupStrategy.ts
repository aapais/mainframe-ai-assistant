/**
 * Backup Strategy Implementation
 * 
 * Implements the Strategy pattern for different types of backups:
 * - Full: Complete database backup
 * - Incremental: Only changes since last backup
 * - Differential: Changes since last full backup
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import Database from 'better-sqlite3';
import { IStorageAdapter } from '../adapters/IStorageAdapter';

// ===========================
// Types and Interfaces
// ===========================

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
  dependencies?: string[]; // For incremental/differential backups
}

export interface BackupDelta {
  added: Array<{ table: string; entries: any[] }>;
  modified: Array<{ table: string; entries: any[] }>;
  deleted: Array<{ table: string; ids: string[] }>;
  metadata: {
    totalChanges: number;
    tablesAffected: string[];
    changeTypes: Record<string, number>;
  };
}

// ===========================
// Abstract Base Strategy
// ===========================

export abstract class AbstractBackupStrategy {
  protected type: BackupStrategyType;
  protected metadata: BackupMetadata | null = null;

  constructor(type: BackupStrategyType) {
    this.type = type;
  }

  abstract execute(
    adapter: IStorageAdapter, 
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer>;

  abstract getRequiredDependencies(): string[];
  
  abstract validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{ valid: boolean; issues: string[] }>;

  getType(): BackupStrategyType {
    return this.type;
  }

  getMetadata(): BackupMetadata | null {
    return this.metadata;
  }

  protected generateBackupId(): string {
    return createHash('sha256')
      .update(`${this.type}-${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  protected updateProgress(
    progress: BackupProgress, 
    phase: string, 
    percentage: number, 
    bytesProcessed?: number
  ): void {
    progress.phase = phase;
    progress.percentage = Math.min(100, Math.max(0, percentage));
    if (bytesProcessed !== undefined) {
      progress.bytesProcessed = bytesProcessed;
    }
  }

  protected async calculateTableChecksum(
    adapter: IStorageAdapter, 
    tableName: string
  ): Promise<string> {
    try {
      const rows = await adapter.executeSQL(`SELECT * FROM ${tableName} ORDER BY rowid`);
      const data = JSON.stringify(rows);
      return createHash('sha256').update(data).digest('hex');
    } catch (error) {
      console.warn(`Could not calculate checksum for table ${tableName}:`, error);
      return '';
    }
  }

  protected async getAllTableNames(adapter: IStorageAdapter): Promise<string[]> {
    const result = await adapter.executeSQL(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    return result.map(row => row.name);
  }
}

// ===========================
// Full Backup Strategy
// ===========================

export class FullBackupStrategy extends AbstractBackupStrategy {
  constructor() {
    super('full');
  }

  async execute(
    adapter: IStorageAdapter, 
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer> {
    this.updateProgress(progress, 'initializing', 0);

    try {
      // Validate preconditions
      const validation = await this.validatePreconditions(adapter, context);
      if (!validation.valid) {
        throw new Error(`Precondition validation failed: ${validation.issues.join(', ')}`);
      }

      this.updateProgress(progress, 'reading_database', 10);

      // Get database file path from adapter
      const dbPath = await this.getDatabasePath(adapter);
      
      // Read entire database
      const dbData = fs.readFileSync(dbPath);
      this.updateProgress(progress, 'calculating_checksums', 50, dbData.length);

      // Calculate table checksums for metadata
      const tableNames = await this.getAllTableNames(adapter);
      const tableChecksums: Record<string, string> = {};
      
      for (let i = 0; i < tableNames.length; i++) {
        const tableName = tableNames[i];
        tableChecksums[tableName] = await this.calculateTableChecksum(adapter, tableName);
        this.updateProgress(progress, 'calculating_checksums', 50 + (i / tableNames.length) * 30);
      }

      this.updateProgress(progress, 'generating_metadata', 80);

      // Get entry count
      const entryCount = await this.getTotalEntryCount(adapter);

      // Generate metadata
      this.metadata = {
        id: this.generateBackupId(),
        strategy: this.type,
        timestamp: new Date(),
        checksum: createHash('sha256').update(dbData).digest('hex'),
        size: dbData.length,
        entryCount,
        tableChecksums,
        version: await this.getDatabaseVersion(adapter)
      };

      this.updateProgress(progress, 'finalizing', 95);

      // Create backup package with metadata
      const backupPackage = await this.createBackupPackage(dbData, this.metadata);

      this.updateProgress(progress, 'completed', 100, backupPackage.length);

      console.log(`✅ Full backup completed: ${this.metadata.id} (${this.formatBytes(dbData.length)})`);

      return backupPackage;

    } catch (error) {
      console.error('❌ Full backup failed:', error);
      throw error;
    }
  }

  getRequiredDependencies(): string[] {
    return []; // Full backup has no dependencies
  }

  async validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check database accessibility
      const metrics = await adapter.getMetrics();
      if (!metrics) {
        issues.push('Cannot access database metrics');
      }

      // Check available space in working directory
      if (context?.workingDirectory) {
        const stats = fs.statSync(context.workingDirectory);
        if (!stats.isDirectory()) {
          issues.push('Working directory is not accessible');
        }
      }

      // Verify database integrity
      const integrityCheck = await adapter.executeSQL('PRAGMA integrity_check');
      if (integrityCheck[0]?.integrity_check !== 'ok') {
        issues.push('Database integrity check failed');
      }

    } catch (error) {
      issues.push(`Precondition check failed: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  private async getDatabasePath(adapter: IStorageAdapter): Promise<string> {
    // This is adapter-specific - for SQLite adapter
    if ('getDatabasePath' in adapter) {
      return (adapter as any).getDatabasePath();
    }
    
    // Fallback: try to get from connection string or config
    throw new Error('Cannot determine database path for full backup');
  }

  private async getTotalEntryCount(adapter: IStorageAdapter): Promise<number> {
    try {
      const result = await adapter.executeSQL('SELECT COUNT(*) as count FROM kb_entries');
      return result[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  private async getDatabaseVersion(adapter: IStorageAdapter): Promise<string> {
    try {
      const result = await adapter.executeSQL('PRAGMA user_version');
      return result[0]?.user_version?.toString() || '0';
    } catch {
      return '0';
    }
  }

  private async createBackupPackage(data: Buffer, metadata: BackupMetadata): Promise<Buffer> {
    // Create a simple package format: metadata JSON + separator + data
    const metadataJson = JSON.stringify(metadata);
    const separator = Buffer.from('\n---BACKUP-DATA-SEPARATOR---\n');
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    
    return Buffer.concat([metadataBuffer, separator, data]);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// ===========================
// Incremental Backup Strategy
// ===========================

export class IncrementalBackupStrategy extends AbstractBackupStrategy {
  constructor() {
    super('incremental');
  }

  async execute(
    adapter: IStorageAdapter, 
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer> {
    this.updateProgress(progress, 'initializing', 0);

    try {
      if (!context?.previousBackupMetadata) {
        throw new Error('Incremental backup requires previous backup metadata');
      }

      const validation = await this.validatePreconditions(adapter, context);
      if (!validation.valid) {
        throw new Error(`Precondition validation failed: ${validation.issues.join(', ')}`);
      }

      this.updateProgress(progress, 'analyzing_changes', 10);

      // Find changes since last backup
      const delta = await this.calculateDelta(adapter, context.previousBackupMetadata);

      this.updateProgress(progress, 'preparing_delta', 40);

      // Package the delta
      const deltaPackage = await this.createDeltaPackage(delta);

      this.updateProgress(progress, 'generating_metadata', 80);

      // Generate metadata
      this.metadata = {
        id: this.generateBackupId(),
        strategy: this.type,
        timestamp: new Date(),
        checksum: createHash('sha256').update(deltaPackage).digest('hex'),
        size: deltaPackage.length,
        entryCount: delta.metadata.totalChanges,
        tableChecksums: await this.calculateAffectedTableChecksums(adapter, delta),
        version: await this.getDatabaseVersion(adapter),
        dependencies: [context.previousBackupMetadata.id]
      };

      this.updateProgress(progress, 'finalizing', 95);

      const backupPackage = await this.createBackupPackage(deltaPackage, this.metadata);

      this.updateProgress(progress, 'completed', 100, backupPackage.length);

      console.log(`✅ Incremental backup completed: ${this.metadata.id} (${delta.metadata.totalChanges} changes)`);

      return backupPackage;

    } catch (error) {
      console.error('❌ Incremental backup failed:', error);
      throw error;
    }
  }

  getRequiredDependencies(): string[] {
    return ['previous_backup']; // Requires at least one previous backup
  }

  async validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!context?.previousBackupMetadata) {
      issues.push('Previous backup metadata is required for incremental backup');
    }

    // Check if database has timestamp tracking
    try {
      const tables = await this.getAllTableNames(adapter);
      const timestampColumns = await this.checkTimestampColumns(adapter, tables);
      
      if (timestampColumns.length === 0) {
        issues.push('No timestamp columns found for change tracking');
      }
    } catch (error) {
      issues.push(`Cannot verify change tracking capabilities: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  private async calculateDelta(
    adapter: IStorageAdapter, 
    previousMetadata: BackupMetadata
  ): Promise<BackupDelta> {
    const delta: BackupDelta = {
      added: [],
      modified: [],
      deleted: [],
      metadata: {
        totalChanges: 0,
        tablesAffected: [],
        changeTypes: { added: 0, modified: 0, deleted: 0 }
      }
    };

    const tables = await this.getAllTableNames(adapter);
    const previousTimestamp = previousMetadata.timestamp;

    for (const tableName of tables) {
      try {
        // Check if table has timestamp columns
        const hasTimestamp = await this.tableHasTimestamp(adapter, tableName);
        
        if (hasTimestamp) {
          // Find added/modified records
          const changes = await adapter.executeSQL(`
            SELECT * FROM ${tableName}
            WHERE updated_at > ? OR created_at > ?
          `, [previousTimestamp.toISOString(), previousTimestamp.toISOString()]);

          if (changes.length > 0) {
            delta.modified.push({ table: tableName, entries: changes });
            delta.metadata.changeTypes.modified += changes.length;
            delta.metadata.tablesAffected.push(tableName);
          }
        } else {
          // Fallback: compare checksums
          const currentChecksum = await this.calculateTableChecksum(adapter, tableName);
          const previousChecksum = previousMetadata.tableChecksums[tableName];

          if (currentChecksum !== previousChecksum) {
            // Table has changes, include all data
            const allData = await adapter.executeSQL(`SELECT * FROM ${tableName}`);
            delta.modified.push({ table: tableName, entries: allData });
            delta.metadata.changeTypes.modified += allData.length;
            delta.metadata.tablesAffected.push(tableName);
          }
        }
      } catch (error) {
        console.warn(`Could not process changes for table ${tableName}:`, error);
      }
    }

    delta.metadata.totalChanges = 
      delta.metadata.changeTypes.added + 
      delta.metadata.changeTypes.modified + 
      delta.metadata.changeTypes.deleted;

    return delta;
  }

  private async createDeltaPackage(delta: BackupDelta): Promise<Buffer> {
    const deltaJson = JSON.stringify(delta);
    return Buffer.from(deltaJson, 'utf-8');
  }

  private async createBackupPackage(data: Buffer, metadata: BackupMetadata): Promise<Buffer> {
    const metadataJson = JSON.stringify(metadata);
    const separator = Buffer.from('\n---INCREMENTAL-DATA-SEPARATOR---\n');
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    
    return Buffer.concat([metadataBuffer, separator, data]);
  }

  private async checkTimestampColumns(
    adapter: IStorageAdapter, 
    tables: string[]
  ): Promise<string[]> {
    const timestampTables: string[] = [];

    for (const table of tables) {
      const hasTimestamp = await this.tableHasTimestamp(adapter, table);
      if (hasTimestamp) {
        timestampTables.push(table);
      }
    }

    return timestampTables;
  }

  private async tableHasTimestamp(adapter: IStorageAdapter, tableName: string): Promise<boolean> {
    try {
      const schema = await adapter.executeSQL(`PRAGMA table_info(${tableName})`);
      return schema.some(col => 
        col.name === 'updated_at' || 
        col.name === 'created_at' || 
        col.name === 'timestamp'
      );
    } catch {
      return false;
    }
  }

  private async calculateAffectedTableChecksums(
    adapter: IStorageAdapter, 
    delta: BackupDelta
  ): Promise<Record<string, string>> {
    const checksums: Record<string, string> = {};

    for (const tableName of delta.metadata.tablesAffected) {
      checksums[tableName] = await this.calculateTableChecksum(adapter, tableName);
    }

    return checksums;
  }

  private async getDatabaseVersion(adapter: IStorageAdapter): Promise<string> {
    try {
      const result = await adapter.executeSQL('PRAGMA user_version');
      return result[0]?.user_version?.toString() || '0';
    } catch {
      return '0';
    }
  }
}

// ===========================
// Differential Backup Strategy
// ===========================

export class DifferentialBackupStrategy extends AbstractBackupStrategy {
  constructor() {
    super('differential');
  }

  async execute(
    adapter: IStorageAdapter, 
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer> {
    this.updateProgress(progress, 'initializing', 0);

    try {
      if (!context?.lastFullBackupMetadata) {
        throw new Error('Differential backup requires last full backup metadata');
      }

      const validation = await this.validatePreconditions(adapter, context);
      if (!validation.valid) {
        throw new Error(`Precondition validation failed: ${validation.issues.join(', ')}`);
      }

      this.updateProgress(progress, 'analyzing_changes', 10);

      // Find changes since last full backup
      const delta = await this.calculateDifferentialDelta(adapter, context.lastFullBackupMetadata);

      this.updateProgress(progress, 'preparing_delta', 50);

      const deltaPackage = await this.createDeltaPackage(delta);

      this.updateProgress(progress, 'generating_metadata', 80);

      // Generate metadata
      this.metadata = {
        id: this.generateBackupId(),
        strategy: this.type,
        timestamp: new Date(),
        checksum: createHash('sha256').update(deltaPackage).digest('hex'),
        size: deltaPackage.length,
        entryCount: delta.metadata.totalChanges,
        tableChecksums: await this.calculateAffectedTableChecksums(adapter, delta),
        version: await this.getDatabaseVersion(adapter),
        dependencies: [context.lastFullBackupMetadata.id]
      };

      this.updateProgress(progress, 'finalizing', 95);

      const backupPackage = await this.createBackupPackage(deltaPackage, this.metadata);

      this.updateProgress(progress, 'completed', 100, backupPackage.length);

      console.log(`✅ Differential backup completed: ${this.metadata.id} (${delta.metadata.totalChanges} changes since full backup)`);

      return backupPackage;

    } catch (error) {
      console.error('❌ Differential backup failed:', error);
      throw error;
    }
  }

  getRequiredDependencies(): string[] {
    return ['full_backup']; // Requires at least one full backup
  }

  async validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!context?.lastFullBackupMetadata) {
      issues.push('Last full backup metadata is required for differential backup');
    }

    if (context?.lastFullBackupMetadata?.strategy !== 'full') {
      issues.push('Reference backup must be a full backup');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  private async calculateDifferentialDelta(
    adapter: IStorageAdapter, 
    fullBackupMetadata: BackupMetadata
  ): Promise<BackupDelta> {
    const delta: BackupDelta = {
      added: [],
      modified: [],
      deleted: [],
      metadata: {
        totalChanges: 0,
        tablesAffected: [],
        changeTypes: { added: 0, modified: 0, deleted: 0 }
      }
    };

    const tables = await this.getAllTableNames(adapter);
    const fullBackupTimestamp = fullBackupMetadata.timestamp;

    for (const tableName of tables) {
      try {
        // Compare current table checksum with full backup
        const currentChecksum = await this.calculateTableChecksum(adapter, tableName);
        const fullBackupChecksum = fullBackupMetadata.tableChecksums[tableName];

        if (currentChecksum !== fullBackupChecksum) {
          // Table has changes since full backup
          
          // Try to get only changed records if timestamp tracking available
          const hasTimestamp = await this.tableHasTimestamp(adapter, tableName);
          
          if (hasTimestamp) {
            const changes = await adapter.executeSQL(`
              SELECT * FROM ${tableName}
              WHERE updated_at > ? OR created_at > ?
            `, [fullBackupTimestamp.toISOString(), fullBackupTimestamp.toISOString()]);

            if (changes.length > 0) {
              delta.modified.push({ table: tableName, entries: changes });
              delta.metadata.changeTypes.modified += changes.length;
            }
          } else {
            // Include all data for tables without timestamp tracking
            const allData = await adapter.executeSQL(`SELECT * FROM ${tableName}`);
            delta.modified.push({ table: tableName, entries: allData });
            delta.metadata.changeTypes.modified += allData.length;
          }

          delta.metadata.tablesAffected.push(tableName);
        }
      } catch (error) {
        console.warn(`Could not process differential changes for table ${tableName}:`, error);
      }
    }

    delta.metadata.totalChanges = 
      delta.metadata.changeTypes.added + 
      delta.metadata.changeTypes.modified + 
      delta.metadata.changeTypes.deleted;

    return delta;
  }

  private async createDeltaPackage(delta: BackupDelta): Promise<Buffer> {
    const deltaJson = JSON.stringify(delta);
    return Buffer.from(deltaJson, 'utf-8');
  }

  private async createBackupPackage(data: Buffer, metadata: BackupMetadata): Promise<Buffer> {
    const metadataJson = JSON.stringify(metadata);
    const separator = Buffer.from('\n---DIFFERENTIAL-DATA-SEPARATOR---\n');
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    
    return Buffer.concat([metadataBuffer, separator, data]);
  }

  private async tableHasTimestamp(adapter: IStorageAdapter, tableName: string): Promise<boolean> {
    try {
      const schema = await adapter.executeSQL(`PRAGMA table_info(${tableName})`);
      return schema.some(col => 
        col.name === 'updated_at' || 
        col.name === 'created_at' || 
        col.name === 'timestamp'
      );
    } catch {
      return false;
    }
  }

  private async calculateAffectedTableChecksums(
    adapter: IStorageAdapter, 
    delta: BackupDelta
  ): Promise<Record<string, string>> {
    const checksums: Record<string, string> = {};

    for (const tableName of delta.metadata.tablesAffected) {
      checksums[tableName] = await this.calculateTableChecksum(adapter, tableName);
    }

    return checksums;
  }

  private async getDatabaseVersion(adapter: IStorageAdapter): Promise<string> {
    try {
      const result = await adapter.executeSQL('PRAGMA user_version');
      return result[0]?.user_version?.toString() || '0';
    } catch {
      return '0';
    }
  }
}

// ===========================
// Strategy Factory
// ===========================

export class BackupStrategy {
  private strategy: AbstractBackupStrategy;

  constructor(type: BackupStrategyType) {
    switch (type) {
      case 'full':
        this.strategy = new FullBackupStrategy();
        break;
      case 'incremental':
        this.strategy = new IncrementalBackupStrategy();
        break;
      case 'differential':
        this.strategy = new DifferentialBackupStrategy();
        break;
      default:
        throw new Error(`Unknown backup strategy: ${type}`);
    }
  }

  async execute(
    adapter: IStorageAdapter, 
    progress: BackupProgress,
    context?: BackupExecutionContext
  ): Promise<Buffer> {
    return this.strategy.execute(adapter, progress, context);
  }

  getRequiredDependencies(): string[] {
    return this.strategy.getRequiredDependencies();
  }

  async validatePreconditions(
    adapter: IStorageAdapter,
    context?: BackupExecutionContext
  ): Promise<{ valid: boolean; issues: string[] }> {
    return this.strategy.validatePreconditions(adapter, context);
  }

  getType(): BackupStrategyType {
    return this.strategy.getType();
  }

  getMetadata(): BackupMetadata | null {
    return this.strategy.getMetadata();
  }
}

// ===========================
// Utility Functions
// ===========================

export function createBackupStrategy(type: BackupStrategyType): BackupStrategy {
  return new BackupStrategy(type);
}

export function isValidBackupStrategyType(type: string): type is BackupStrategyType {
  return ['full', 'incremental', 'differential'].includes(type);
}

export function getBackupStrategyDescription(type: BackupStrategyType): string {
  switch (type) {
    case 'full':
      return 'Complete database backup - includes all data and serves as baseline';
    case 'incremental':
      return 'Changes since last backup - minimal storage but requires chain for restore';
    case 'differential':
      return 'Changes since last full backup - balance of storage and restore speed';
    default:
      return 'Unknown backup strategy';
  }
}

export function getRecommendedStrategy(
  dataSize: number, 
  changeFrequency: 'low' | 'medium' | 'high',
  storageConstraints: 'none' | 'limited' | 'critical'
): BackupStrategyType {
  // Small databases or low change frequency: full backups
  if (dataSize < 100 * 1024 * 1024 || changeFrequency === 'low') { // < 100MB
    return 'full';
  }

  // Large databases with storage constraints: incremental
  if (dataSize > 1024 * 1024 * 1024 && storageConstraints === 'critical') { // > 1GB
    return 'incremental';
  }

  // Most cases: differential provides good balance
  return 'differential';
}