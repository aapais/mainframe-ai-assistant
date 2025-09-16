/**
 * Restore Service
 * 
 * Comprehensive restore service with support for different backup strategies,
 * point-in-time recovery, validation, and rollback capabilities.
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gunzip } from 'zlib';
import Database from 'better-sqlite3';
import { IStorageAdapter } from '../adapters/IStorageAdapter';
import { BackupMetadata, BackupDelta } from './BackupStrategy';

const gunzipAsync = promisify(gunzip);

// ===========================
// Types and Interfaces
// ===========================

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

// ===========================
// Main Restore Service
// ===========================

export class RestoreService extends EventEmitter {
  private adapter: IStorageAdapter;
  private config: any; // BackupConfig from BackupService
  private activeJobs: Map<string, RestoreJob> = new Map();
  private completedJobs: Map<string, RestoreJob> = new Map();

  constructor(adapter: IStorageAdapter, config: any) {
    super();
    this.adapter = adapter;
    this.config = config;
    this.setMaxListeners(50);
  }

  // ===========================
  // Main Restore Operations
  // ===========================

  async restore(request: RestoreRequest): Promise<string> {
    const jobId = request.id || this.generateJobId();

    try {
      // Create restore job
      const job = await this.createRestoreJob(jobId, request);
      this.activeJobs.set(jobId, job);

      // Start restore execution
      this.executeRestoreJob(job).catch(error => {
        job.status = 'failed';
        job.error = error.message;
        job.endTime = new Date();
        this.emit('restore:failed', job);
      });

      this.emit('restore:started', job);
      return jobId;

    } catch (error) {
      console.error(`❌ Failed to create restore job ${jobId}:`, error);
      throw error;
    }
  }

  async getRestoreJob(jobId: string): Promise<RestoreJob | null> {
    return this.activeJobs.get(jobId) || this.completedJobs.get(jobId) || null;
  }

  async cancelRestore(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    try {
      job.status = 'cancelled';
      job.endTime = new Date();

      // Cleanup partial restore
      await this.cleanupPartialRestore(job);

      this.activeJobs.delete(jobId);
      this.completedJobs.set(jobId, job);
      this.emit('restore:cancelled', job);

      console.log(`🚫 Restore cancelled: ${jobId}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to cancel restore ${jobId}:`, error);
      return false;
    }
  }

  // ===========================
  // Point-in-Time Recovery
  // ===========================

  async listRestorePoints(backupId?: string): Promise<RestorePoint[]> {
    const backups = await this.getAllBackupMetadata();
    const restorePoints: RestorePoint[] = [];

    for (const backup of backups) {
      if (backupId && backup.id !== backupId) {
        continue;
      }

      restorePoints.push({
        id: backup.id,
        timestamp: backup.timestamp,
        backupId: backup.id,
        strategy: backup.strategy,
        size: backup.size,
        entryCount: backup.entryCount,
        dependencies: backup.dependencies || [],
        description: `${backup.strategy} backup from ${backup.timestamp.toISOString()}`,
        tags: ['backup', backup.strategy]
      });
    }

    // Sort by timestamp (newest first)
    return restorePoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async findNearestRestorePoint(targetTime: Date): Promise<RestorePoint | null> {
    const restorePoints = await this.listRestorePoints();
    
    // Find the nearest backup before or at the target time
    const validPoints = restorePoints.filter(point => point.timestamp <= targetTime);
    
    if (validPoints.length === 0) {
      return null;
    }

    // Return the closest one
    return validPoints.sort((a, b) => 
      Math.abs(targetTime.getTime() - a.timestamp.getTime()) - 
      Math.abs(targetTime.getTime() - b.timestamp.getTime())
    )[0];
  }

  async analyzeBackupChain(backupId: string): Promise<BackupChain | null> {
    const backup = await this.getBackupMetadata(backupId);
    if (!backup) {
      return null;
    }

    const chain: BackupChain = {
      fullBackup: backup.strategy === 'full' ? backup : await this.findBaseFullBackup(backup),
      incrementalBackups: [],
      totalSize: 0,
      timeSpan: {
        start: backup.timestamp,
        end: backup.timestamp
      }
    };

    if (!chain.fullBackup) {
      throw new Error(`Cannot find base full backup for ${backupId}`);
    }

    // Build the complete chain
    if (backup.strategy === 'incremental') {
      chain.incrementalBackups = await this.getIncrementalChain(backup);
    } else if (backup.strategy === 'differential') {
      chain.differentialBackup = backup;
    }

    // Calculate totals
    chain.totalSize = chain.fullBackup.size;
    chain.timeSpan.start = chain.fullBackup.timestamp;

    for (const inc of chain.incrementalBackups) {
      chain.totalSize += inc.size;
      if (inc.timestamp > chain.timeSpan.end) {
        chain.timeSpan.end = inc.timestamp;
      }
    }

    if (chain.differentialBackup) {
      chain.totalSize += chain.differentialBackup.size;
      chain.timeSpan.end = chain.differentialBackup.timestamp;
    }

    return chain;
  }

  // ===========================
  // Restore Strategies
  // ===========================

  private async restoreFromFull(backup: BackupMetadata, job: RestoreJob): Promise<void> {
    this.updateProgress(job.progress, 'reading_backup', 10);

    // Read and extract backup
    const backupPath = await this.getBackupPath(backup.id);
    const backupData = await this.extractBackupData(backupPath);

    this.updateProgress(job.progress, 'validating', 30);

    // Validate backup integrity
    if (job.request.includeValidation) {
      const isValid = await this.validateBackupData(backupData, backup.checksum);
      if (!isValid) {
        throw new Error('Backup data validation failed');
      }
    }

    this.updateProgress(job.progress, 'restoring', 50);

    // Write to destination
    fs.writeFileSync(job.request.destinationPath, backupData);

    this.updateProgress(job.progress, 'verifying', 80);

    // Verify restored database
    await this.verifyRestoredDatabase(job.request.destinationPath);
  }

  private async restoreFromIncremental(backup: BackupMetadata, job: RestoreJob): Promise<void> {
    this.updateProgress(job.progress, 'analyzing_chain', 5);

    // Build the complete backup chain
    const chain = await this.getIncrementalChain(backup);
    job.backupChain = chain;

    this.updateProgress(job.progress, 'restoring_full', 10);

    // Start with the full backup
    const fullBackup = await this.findBaseFullBackup(backup);
    if (!fullBackup) {
      throw new Error('Cannot find base full backup for incremental restore');
    }

    // Restore full backup first
    const tempPath = `${job.request.destinationPath}.temp`;
    await this.restoreFullToPath(fullBackup, tempPath);

    this.updateProgress(job.progress, 'applying_incremental', 30);

    // Apply incremental changes in order
    let progress = 30;
    const progressStep = 50 / chain.length;

    for (let i = 0; i < chain.length; i++) {
      const incrementalBackup = chain[i];
      await this.applyIncrementalChanges(tempPath, incrementalBackup);
      
      progress += progressStep;
      this.updateProgress(job.progress, `applying_incremental_${i + 1}`, progress);
    }

    this.updateProgress(job.progress, 'finalizing', 90);

    // Move to final destination
    fs.renameSync(tempPath, job.request.destinationPath);
  }

  private async restoreFromDifferential(backup: BackupMetadata, job: RestoreJob): Promise<void> {
    this.updateProgress(job.progress, 'finding_full_backup', 10);

    // Find the base full backup
    const fullBackup = await this.findBaseFullBackup(backup);
    if (!fullBackup) {
      throw new Error('Cannot find base full backup for differential restore');
    }

    job.backupChain = [fullBackup, backup];

    this.updateProgress(job.progress, 'restoring_full', 20);

    // Restore full backup first
    const tempPath = `${job.request.destinationPath}.temp`;
    await this.restoreFullToPath(fullBackup, tempPath);

    this.updateProgress(job.progress, 'applying_differential', 60);

    // Apply differential changes
    await this.applyDifferentialChanges(tempPath, backup);

    this.updateProgress(job.progress, 'finalizing', 90);

    // Move to final destination
    fs.renameSync(tempPath, job.request.destinationPath);
  }

  // ===========================
  // Validation and Verification
  // ===========================

  async validateRestore(job: RestoreJob): Promise<RestoreValidationResult> {
    const startTime = Date.now();
    const result: RestoreValidationResult = {
      success: true,
      checksumValid: true,
      schemaValid: true,
      dataIntegrityValid: true,
      tableCount: 0,
      recordCount: 0,
      issues: [],
      performance: {
        validationTime: 0,
        avgQueryTime: 0
      }
    };

    try {
      if (!job.restoredPath || !fs.existsSync(job.restoredPath)) {
        result.success = false;
        result.issues.push('Restored file does not exist');
        return result;
      }

      // Open restored database
      const db = new Database(job.restoredPath, { readonly: true });

      try {
        // Validate schema
        const schemaValidation = await this.validateSchema(db);
        result.schemaValid = schemaValidation.valid;
        if (!schemaValidation.valid) {
          result.issues.push(...schemaValidation.issues);
        }

        // Count tables and records
        const tables = await this.getTableNames(db);
        result.tableCount = tables.length;

        let totalRecords = 0;
        const queryTimes: number[] = [];

        for (const table of tables) {
          const queryStart = Date.now();
          
          try {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
            totalRecords += count.count;
            
            queryTimes.push(Date.now() - queryStart);

            // Basic data integrity check
            const integrityCheck = db.prepare(`PRAGMA integrity_check`).get() as { integrity_check: string };
            if (integrityCheck.integrity_check !== 'ok') {
              result.dataIntegrityValid = false;
              result.issues.push(`Integrity check failed for table ${table}`);
            }

          } catch (error) {
            result.issues.push(`Error validating table ${table}: ${error.message}`);
            result.dataIntegrityValid = false;
          }
        }

        result.recordCount = totalRecords;
        result.performance.avgQueryTime = queryTimes.length > 0 ? 
          queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length : 0;

        // Validate against expected backup metadata
        if (job.backupChain && job.backupChain.length > 0) {
          const expectedEntryCount = job.backupChain[job.backupChain.length - 1].entryCount;
          
          // Get actual KB entry count
          try {
            const actualEntryCount = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get() as { count: number };
            
            if (actualEntryCount.count !== expectedEntryCount) {
              result.issues.push(`Entry count mismatch: expected ${expectedEntryCount}, got ${actualEntryCount.count}`);
            }
          } catch {
            // Table might not exist in this restore
          }
        }

      } finally {
        db.close();
      }

    } catch (error) {
      result.success = false;
      result.issues.push(`Validation failed: ${error.message}`);
    }

    result.performance.validationTime = Date.now() - startTime;
    result.success = result.success && result.issues.length === 0;

    return result;
  }

  private async validateSchema(db: Database): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check if database can be opened and basic operations work
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      
      if (tables.length === 0) {
        issues.push('No tables found in restored database');
      }

      // Check for core KB table
      const kbTable = tables.find((t: any) => t.name === 'kb_entries');
      if (!kbTable) {
        issues.push('Core kb_entries table missing');
      }

      // Validate table schemas
      for (const table of tables) {
        try {
          const tableInfo = db.prepare(`PRAGMA table_info(${table.name})`).all();
          if (tableInfo.length === 0) {
            issues.push(`Table ${table.name} has no columns`);
          }
        } catch (error) {
          issues.push(`Cannot validate schema for table ${table.name}: ${error.message}`);
        }
      }

    } catch (error) {
      issues.push(`Schema validation failed: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  // ===========================
  // Helper Methods
  // ===========================

  private generateJobId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}-restore`)
      .digest('hex')
      .substring(0, 16);
  }

  private async createRestoreJob(jobId: string, request: RestoreRequest): Promise<RestoreJob> {
    const job: RestoreJob = {
      id: jobId,
      request,
      status: 'pending',
      progress: {
        phase: 'initializing',
        percentage: 0,
        tablesProcessed: 0,
        totalTables: 0,
        bytesProcessed: 0,
        totalBytes: 0
      }
    };

    // Validate request
    await this.validateRestoreRequest(request);

    return job;
  }

  private async validateRestoreRequest(request: RestoreRequest): Promise<void> {
    if (!request.backupId && !request.backupPath) {
      throw new Error('Either backupId or backupPath must be specified');
    }

    if (!request.destinationPath) {
      throw new Error('Destination path is required');
    }

    if (fs.existsSync(request.destinationPath) && !request.overwriteExisting) {
      throw new Error('Destination file exists and overwrite is not enabled');
    }

    // Validate backup exists
    if (request.backupId) {
      const backup = await this.getBackupMetadata(request.backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${request.backupId}`);
      }
    }

    if (request.backupPath && !fs.existsSync(request.backupPath)) {
      throw new Error(`Backup file not found: ${request.backupPath}`);
    }
  }

  private async executeRestoreJob(job: RestoreJob): Promise<void> {
    try {
      job.status = 'running';
      job.startTime = new Date();

      this.emit('restore:progress', job);

      // Get backup metadata
      let backup: BackupMetadata;
      if (job.request.backupId) {
        backup = await this.getBackupMetadata(job.request.backupId);
        if (!backup) {
          throw new Error(`Backup not found: ${job.request.backupId}`);
        }
      } else {
        // Extract metadata from backup file
        backup = await this.extractBackupMetadata(job.request.backupPath!);
      }

      // Choose restore strategy based on backup type
      switch (backup.strategy) {
        case 'full':
          await this.restoreFromFull(backup, job);
          break;
        case 'incremental':
          await this.restoreFromIncremental(backup, job);
          break;
        case 'differential':
          await this.restoreFromDifferential(backup, job);
          break;
        default:
          throw new Error(`Unknown backup strategy: ${backup.strategy}`);
      }

      job.restoredPath = job.request.destinationPath;

      // Validate restore if requested
      if (job.request.includeValidation) {
        this.updateProgress(job.progress, 'validating_restore', 95);
        job.validationResult = await this.validateRestore(job);
        
        if (!job.validationResult.success) {
          throw new Error(`Restore validation failed: ${job.validationResult.issues.join(', ')}`);
        }
      }

      job.status = 'completed';
      job.progress.percentage = 100;
      job.progress.phase = 'completed';
      job.endTime = new Date();

      // Calculate metrics
      job.metrics = this.calculateRestoreMetrics(job);

      // Move to completed jobs
      this.activeJobs.delete(job.id);
      this.completedJobs.set(job.id, job);

      this.emit('restore:completed', job);
      console.log(`✅ Restore completed: ${job.id}`);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();

      this.activeJobs.delete(job.id);
      this.completedJobs.set(job.id, job);

      this.emit('restore:failed', job);
      console.error(`❌ Restore failed: ${job.id}`, error);
      throw error;
    }
  }

  private updateProgress(
    progress: RestoreProgress,
    phase: string,
    percentage: number,
    currentTable?: string
  ): void {
    progress.phase = phase;
    progress.percentage = Math.min(100, Math.max(0, percentage));
    if (currentTable) {
      progress.currentTable = currentTable;
    }
  }

  private async extractBackupData(backupPath: string): Promise<Buffer> {
    let data = fs.readFileSync(backupPath);

    // Handle different backup formats
    if (backupPath.endsWith('.gz')) {
      data = await gunzipAsync(data);
    }

    // Extract data from package format
    const content = data.toString('utf-8');
    
    if (content.includes('---BACKUP-DATA-SEPARATOR---')) {
      const parts = content.split('---BACKUP-DATA-SEPARATOR---');
      if (parts.length === 2) {
        return Buffer.from(parts[1], 'binary');
      }
    }

    // Assume it's raw database data
    return data;
  }

  private async extractBackupMetadata(backupPath: string): Promise<BackupMetadata> {
    let data = fs.readFileSync(backupPath);

    if (backupPath.endsWith('.gz')) {
      data = await gunzipAsync(data);
    }

    const content = data.toString('utf-8');
    
    if (content.includes('---BACKUP-DATA-SEPARATOR---')) {
      const parts = content.split('---BACKUP-DATA-SEPARATOR---');
      if (parts.length === 2) {
        return JSON.parse(parts[0]);
      }
    }

    throw new Error('Cannot extract metadata from backup file');
  }

  private async validateBackupData(data: Buffer, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = createHash('sha256').update(data).digest('hex');
    return actualChecksum === expectedChecksum;
  }

  private async verifyRestoredDatabase(dbPath: string): Promise<void> {
    try {
      const db = new Database(dbPath, { readonly: true });
      
      // Basic verification
      const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      
      if (result.integrity_check !== 'ok') {
        throw new Error('Database integrity check failed');
      }

      db.close();
    } catch (error) {
      throw new Error(`Database verification failed: ${error.message}`);
    }
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    // TODO: Implement backup metadata retrieval from storage
    return null;
  }

  private async getAllBackupMetadata(): Promise<BackupMetadata[]> {
    // TODO: Implement retrieval of all backup metadata
    return [];
  }

  private async getBackupPath(backupId: string): Promise<string> {
    // TODO: Implement backup path resolution
    throw new Error('Not implemented');
  }

  private async findBaseFullBackup(backup: BackupMetadata): Promise<BackupMetadata | null> {
    if (backup.strategy === 'full') {
      return backup;
    }

    if (!backup.dependencies || backup.dependencies.length === 0) {
      return null;
    }

    // Recursively find the full backup
    for (const depId of backup.dependencies) {
      const dep = await this.getBackupMetadata(depId);
      if (dep) {
        if (dep.strategy === 'full') {
          return dep;
        } else {
          const fullBackup = await this.findBaseFullBackup(dep);
          if (fullBackup) {
            return fullBackup;
          }
        }
      }
    }

    return null;
  }

  private async getIncrementalChain(backup: BackupMetadata): Promise<BackupMetadata[]> {
    const chain: BackupMetadata[] = [];
    let current = backup;

    // Build chain backwards to the full backup
    while (current && current.strategy !== 'full') {
      chain.unshift(current);
      
      if (current.dependencies && current.dependencies.length > 0) {
        const dep = await this.getBackupMetadata(current.dependencies[0]);
        if (dep) {
          current = dep;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return chain;
  }

  private async restoreFullToPath(backup: BackupMetadata, path: string): Promise<void> {
    const backupPath = await this.getBackupPath(backup.id);
    const data = await this.extractBackupData(backupPath);
    fs.writeFileSync(path, data);
  }

  private async applyIncrementalChanges(dbPath: string, backup: BackupMetadata): Promise<void> {
    const backupPath = await this.getBackupPath(backup.id);
    const deltaData = await this.extractBackupData(backupPath);
    const delta: BackupDelta = JSON.parse(deltaData.toString('utf-8'));

    const db = new Database(dbPath);

    try {
      // Apply changes in transaction
      const applyChanges = db.transaction(() => {
        // Apply deletions first
        for (const deletion of delta.deleted) {
          for (const id of deletion.ids) {
            db.prepare(`DELETE FROM ${deletion.table} WHERE id = ?`).run(id);
          }
        }

        // Apply additions and modifications
        for (const addition of delta.added) {
          for (const entry of addition.entries) {
            const columns = Object.keys(entry);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT OR REPLACE INTO ${addition.table} (${columns.join(', ')}) VALUES (${placeholders})`;
            db.prepare(sql).run(...columns.map(col => entry[col]));
          }
        }

        for (const modification of delta.modified) {
          for (const entry of modification.entries) {
            const columns = Object.keys(entry);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT OR REPLACE INTO ${modification.table} (${columns.join(', ')}) VALUES (${placeholders})`;
            db.prepare(sql).run(...columns.map(col => entry[col]));
          }
        }
      });

      applyChanges();

    } finally {
      db.close();
    }
  }

  private async applyDifferentialChanges(dbPath: string, backup: BackupMetadata): Promise<void> {
    // Differential changes are applied the same way as incremental
    await this.applyIncrementalChanges(dbPath, backup);
  }

  private async getTableNames(db: Database): Promise<string[]> {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    return tables.map(t => t.name);
  }

  private calculateRestoreMetrics(job: RestoreJob): RestoreMetrics {
    const totalDuration = job.endTime && job.startTime ? 
      job.endTime.getTime() - job.startTime.getTime() : 0;

    return {
      totalDuration,
      preparationTime: 0, // TODO: Track preparation time
      restoreTime: totalDuration,
      validationTime: job.validationResult?.performance.validationTime || 0,
      dataSize: 0, // TODO: Track data size
      tablesRestored: job.progress.totalTables,
      recordsRestored: job.validationResult?.recordCount || 0
    };
  }

  private async cleanupPartialRestore(job: RestoreJob): Promise<void> {
    const tempFiles = [
      `${job.request.destinationPath}.temp`,
      job.request.destinationPath
    ];

    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`🧹 Cleaned up partial restore: ${file}`);
        } catch (error) {
          console.warn(`⚠️ Failed to cleanup file: ${file}`, error);
        }
      }
    }
  }
}

// ===========================
// Utility Functions
// ===========================

export function calculateRestoreTime(backupChain: BackupChain): {
  estimated: number;
  factors: string[];
} {
  const factors: string[] = [];
  let estimatedSeconds = 0;

  // Base time for full backup (assuming 1MB/sec)
  const fullBackupTime = Math.max(backupChain.fullBackup.size / (1024 * 1024), 30);
  estimatedSeconds += fullBackupTime;
  factors.push(`Full backup: ${fullBackupTime.toFixed(1)}s`);

  // Time for incremental backups
  if (backupChain.incrementalBackups.length > 0) {
    const incrementalTime = backupChain.incrementalBackups.reduce((sum, backup) => 
      sum + Math.max(backup.size / (1024 * 1024 * 2), 5), 0); // Faster for incremental
    estimatedSeconds += incrementalTime;
    factors.push(`Incremental backups: ${incrementalTime.toFixed(1)}s`);
  }

  // Time for differential backup
  if (backupChain.differentialBackup) {
    const diffTime = Math.max(backupChain.differentialBackup.size / (1024 * 1024 * 1.5), 10);
    estimatedSeconds += diffTime;
    factors.push(`Differential backup: ${diffTime.toFixed(1)}s`);
  }

  // Add overhead for validation and verification
  const overheadTime = estimatedSeconds * 0.2;
  estimatedSeconds += overheadTime;
  factors.push(`Validation overhead: ${overheadTime.toFixed(1)}s`);

  return {
    estimated: Math.round(estimatedSeconds),
    factors
  };
}

export function getRestoreComplexity(backupChain: BackupChain): 'simple' | 'moderate' | 'complex' {
  const chainLength = backupChain.incrementalBackups.length;
  const hasLargeDifferential = backupChain.differentialBackup && 
    backupChain.differentialBackup.size > 100 * 1024 * 1024; // > 100MB

  if (chainLength === 0 && !hasLargeDifferential) {
    return 'simple';
  }

  if (chainLength <= 5 && !hasLargeDifferential) {
    return 'moderate';
  }

  return 'complex';
}

export function formatRestoreEstimate(timeSeconds: number): string {
  if (timeSeconds < 60) {
    return `${timeSeconds} seconds`;
  } else if (timeSeconds < 3600) {
    const minutes = Math.round(timeSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(timeSeconds / 3600);
    const minutes = Math.round((timeSeconds % 3600) / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}