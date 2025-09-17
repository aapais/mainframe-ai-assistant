import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import { EventEmitter } from 'events';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Backup configuration
 */
export interface BackupConfig {
  /** Backup directory path */
  backupPath: string;
  /** Enable compression */
  compression?: boolean;
  /** Retention period in days */
  retentionDays?: number;
  /** Automatic backup interval in hours */
  intervalHours?: number;
  /** Include integrity verification */
  verifyIntegrity?: boolean;
  /** Maximum number of backups to keep */
  maxBackups?: number;
  /** Backup file name pattern */
  namePattern?: string;
}

/**
 * Backup metadata
 */
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

/**
 * Backup operation result
 */
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

/**
 * Restore operation result
 */
export interface RestoreResult {
  success: boolean;
  restoredPath: string;
  duration: number;
  verificationPassed: boolean;
  error?: string;
}

/**
 * Backup verification result
 */
export interface VerificationResult {
  valid: boolean;
  checksum: string;
  expectedChecksum: string;
  corruptionDetected: boolean;
  errors: string[];
}

/**
 * Advanced Backup & Restore System
 * 
 * Provides comprehensive backup functionality with compression,
 * integrity verification, scheduled backups, and point-in-time recovery.
 * 
 * @example
 * ```typescript
 * const backupSystem = new BackupSystem({
 *   backupPath: './backups',
 *   compression: true,
 *   retentionDays: 30,
 *   intervalHours: 6,
 *   verifyIntegrity: true
 * });
 * 
 * await backupSystem.initialize();
 * 
 * // Create manual backup
 * const result = await backupSystem.createBackup('./knowledge.db', {
 *   description: 'Pre-migration backup',
 *   tags: ['migration', 'manual']
 * });
 * 
 * // Restore from backup
 * await backupSystem.restore(result.backupId, './restored.db');
 * 
 * // Start automatic backups
 * await backupSystem.startScheduler();
 * ```
 */
export class BackupSystem extends EventEmitter {
  private config: Required<BackupConfig>;
  private db: Database.Database | null = null;
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private metadataDb: Database.Database;

  constructor(config: BackupConfig) {
    super();
    
    this.config = {
      backupPath: config.backupPath,
      compression: config.compression ?? true,
      retentionDays: config.retentionDays ?? 30,
      intervalHours: config.intervalHours ?? 6,
      verifyIntegrity: config.verifyIntegrity ?? true,
      maxBackups: config.maxBackups ?? 100,
      namePattern: config.namePattern ?? 'backup_{timestamp}_{id}'
    };

    this.setupErrorHandling();
  }

  /**
   * Initialize the backup system
   */
  async initialize(): Promise<void> {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.config.backupPath)) {
        fs.mkdirSync(this.config.backupPath, { recursive: true });
      }

      // Initialize metadata database
      const metadataPath = path.join(this.config.backupPath, 'backup_metadata.db');
      this.metadataDb = new Database(metadataPath);
      
      await this.initializeMetadataDb();
      await this.cleanupExpiredBackups();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('✅ BackupSystem initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize BackupSystem:', error);
      throw error;
    }
  }

  /**
   * Create a backup of the specified database
   */
  async createBackup(
    dbPath: string,
    options: {
      description?: string;
      tags?: string[];
      compress?: boolean;
      verify?: boolean;
    } = {}
  ): Promise<BackupResult> {
    if (!this.isInitialized) {
      throw new Error('BackupSystem not initialized');
    }

    const startTime = Date.now();
    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const filename = this.config.namePattern
      .replace('{timestamp}', timestamp)
      .replace('{id}', backupId.substring(0, 8));

    const backupPath = path.join(
      this.config.backupPath,
      `${filename}.db${this.config.compression ? '.gz' : ''}`
    );

    try {
      // Verify source database exists and is accessible
      if (!fs.existsSync(dbPath)) {
        throw new Error(`Source database not found: ${dbPath}`);
      }

      const sourceStats = fs.statSync(dbPath);
      
      // Create backup copy
      let backupData: Buffer;
      
      // Use SQLite backup API if source is currently open
      try {
        const sourceDb = new Database(dbPath, { readonly: true });
        backupData = sourceDb.serialize();
        sourceDb.close();
      } catch {
        // Fallback to file copy
        backupData = fs.readFileSync(dbPath);
      }

      // Compress if enabled
      let finalData = backupData;
      let compressedSize: number | undefined;
      
      if (options.compress ?? this.config.compression) {
        finalData = await gzipAsync(backupData);
        compressedSize = finalData.length;
      }

      // Write backup file
      fs.writeFileSync(backupPath, finalData);

      // Calculate checksum
      const checksum = this.calculateChecksum(backupData);

      // Verify backup integrity if enabled
      if (options.verify ?? this.config.verifyIntegrity) {
        const verification = await this.verifyBackup(backupPath, checksum);
        if (!verification.valid) {
          throw new Error(`Backup verification failed: ${verification.errors.join(', ')}`);
        }
      }

      // Get entry count from source database
      const entryCount = await this.getDatabaseEntryCount(dbPath);

      // Store metadata
      const metadata: BackupMetadata = {
        id: backupId,
        filePath: backupPath,
        originalPath: dbPath,
        created: new Date(),
        size: sourceStats.size,
        compressed: compressedSize !== undefined,
        checksum,
        version: await this.getDatabaseVersion(dbPath),
        entryCount,
        description: options.description,
        tags: options.tags
      };

      await this.storeBackupMetadata(metadata);

      const duration = Date.now() - startTime;
      const compressionRatio = compressedSize ? 
        ((sourceStats.size - compressedSize) / sourceStats.size) * 100 : undefined;

      const result: BackupResult = {
        success: true,
        backupId,
        filePath: backupPath,
        duration,
        originalSize: sourceStats.size,
        compressedSize,
        compressionRatio,
        checksum
      };

      this.emit('backup-created', result);

      console.log(`✅ Backup created: ${backupId} (${duration}ms)`);
      if (compressionRatio) {
        console.log(`   Compression: ${compressionRatio.toFixed(1)}%`);
      }

      return result;

    } catch (error) {
      // Cleanup on failure
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      const result: BackupResult = {
        success: false,
        backupId,
        filePath: backupPath,
        duration: Date.now() - startTime,
        originalSize: 0,
        checksum: '',
        error: error.message
      };

      this.emit('backup-failed', result);
      
      console.error(`❌ Backup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restore(
    backupId: string,
    targetPath: string,
    options: {
      verify?: boolean;
      overwrite?: boolean;
    } = {}
  ): Promise<RestoreResult> {
    if (!this.isInitialized) {
      throw new Error('BackupSystem not initialized');
    }

    const startTime = Date.now();

    try {
      // Get backup metadata
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Check if backup file exists
      if (!fs.existsSync(metadata.filePath)) {
        throw new Error(`Backup file not found: ${metadata.filePath}`);
      }

      // Check target path
      if (fs.existsSync(targetPath) && !options.overwrite) {
        throw new Error(`Target file exists: ${targetPath}. Use overwrite option.`);
      }

      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Read backup data
      let backupData = fs.readFileSync(metadata.filePath);

      // Decompress if needed
      if (metadata.compressed) {
        backupData = await gunzipAsync(backupData);
      }

      // Verify integrity if enabled
      let verificationPassed = true;
      if (options.verify ?? this.config.verifyIntegrity) {
        const verification = await this.verifyBackupData(backupData, metadata.checksum);
        verificationPassed = verification.valid;
        
        if (!verificationPassed) {
          throw new Error(`Backup integrity verification failed: ${verification.errors.join(', ')}`);
        }
      }

      // Write restored file
      fs.writeFileSync(targetPath, backupData);

      // Verify the restored database is valid
      try {
        const testDb = new Database(targetPath, { readonly: true });
        testDb.prepare('SELECT COUNT(*) FROM sqlite_master').get();
        testDb.close();
      } catch (error) {
        fs.unlinkSync(targetPath);
        throw new Error(`Restored database is invalid: ${error.message}`);
      }

      const duration = Date.now() - startTime;

      const result: RestoreResult = {
        success: true,
        restoredPath: targetPath,
        duration,
        verificationPassed
      };

      this.emit('restore-completed', result);

      console.log(`✅ Database restored from backup ${backupId} (${duration}ms)`);

      return result;

    } catch (error) {
      const result: RestoreResult = {
        success: false,
        restoredPath: targetPath,
        duration: Date.now() - startTime,
        verificationPassed: false,
        error: error.message
      };

      this.emit('restore-failed', result);
      
      console.error(`❌ Restore failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(filter?: {
    tags?: string[];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<BackupMetadata[]> {
    if (!this.isInitialized) {
      throw new Error('BackupSystem not initialized');
    }

    let query = `
      SELECT * FROM backups 
      WHERE 1=1
    `;
    const params: any[] = [];

    // Apply filters
    if (filter?.fromDate) {
      query += ' AND created >= ?';
      params.push(filter.fromDate.toISOString());
    }

    if (filter?.toDate) {
      query += ' AND created <= ?';
      params.push(filter.toDate.toISOString());
    }

    if (filter?.tags && filter.tags.length > 0) {
      query += ` AND (${filter.tags.map(() => 'tags LIKE ?').join(' OR ')})`;
      filter.tags.forEach(tag => params.push(`%${tag}%`));
    }

    query += ' ORDER BY created DESC';

    if (filter?.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
    }

    const rows = this.metadataDb.prepare(query).all(params) as any[];
    
    return rows.map(row => ({
      ...row,
      created: new Date(row.created),
      tags: row.tags ? JSON.parse(row.tags) : undefined
    }));
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('BackupSystem not initialized');
    }

    const metadata = await this.getBackupMetadata(backupId);
    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Delete backup file
    if (fs.existsSync(metadata.filePath)) {
      fs.unlinkSync(metadata.filePath);
    }

    // Delete metadata
    this.metadataDb.prepare('DELETE FROM backups WHERE id = ?').run(backupId);

    this.emit('backup-deleted', { backupId });
    console.log(`🗑️ Backup deleted: ${backupId}`);
  }

  /**
   * Start automatic backup scheduler
   */
  async startScheduler(dbPath?: string): Promise<void> {
    if (this.schedulerTimer) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    if (!dbPath && !this.db) {
      throw new Error('Database path required for scheduler');
    }

    const targetPath = dbPath || (this.db as any).name;
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;

    this.schedulerTimer = setInterval(async () => {
      try {
        await this.createBackup(targetPath, {
          description: 'Automatic backup',
          tags: ['auto', 'scheduled']
        });
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
        this.emit('scheduled-backup-failed', error);
      }
    }, intervalMs);

    this.emit('scheduler-started', { intervalHours: this.config.intervalHours });
    console.log(`⏰ Backup scheduler started (every ${this.config.intervalHours}h)`);
  }

  /**
   * Stop automatic backup scheduler
   */
  stopScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
      this.emit('scheduler-stopped');
      console.log('⏰ Backup scheduler stopped');
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath: string, expectedChecksum?: string): Promise<VerificationResult> {
    try {
      let backupData = fs.readFileSync(backupPath);
      
      // Handle compressed backups
      if (backupPath.endsWith('.gz')) {
        backupData = await gunzipAsync(backupData);
      }

      return await this.verifyBackupData(backupData, expectedChecksum);

    } catch (error) {
      return {
        valid: false,
        checksum: '',
        expectedChecksum: expectedChecksum || '',
        corruptionDetected: true,
        errors: [`Verification failed: ${error.message}`]
      };
    }
  }

  /**
   * Get backup statistics
   */
  async getStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    averageSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    compressionSavings: number;
  }> {
    if (!this.isInitialized) {
      throw new Error('BackupSystem not initialized');
    }

    const stats = this.metadataDb.prepare(`
      SELECT 
        COUNT(*) as totalBackups,
        SUM(size) as totalSize,
        AVG(size) as averageSize,
        MIN(created) as oldestBackup,
        MAX(created) as newestBackup,
        SUM(CASE WHEN compressed THEN size ELSE 0 END) as compressedOriginalSize
      FROM backups
    `).get() as any;

    // Calculate compression savings
    const compressedBackups = this.metadataDb.prepare(`
      SELECT filePath FROM backups WHERE compressed = 1
    `).all() as any[];

    let totalCompressedSize = 0;
    for (const backup of compressedBackups) {
      if (fs.existsSync(backup.filePath)) {
        totalCompressedSize += fs.statSync(backup.filePath).size;
      }
    }

    const compressionSavings = stats.compressedOriginalSize > 0 ? 
      ((stats.compressedOriginalSize - totalCompressedSize) / stats.compressedOriginalSize) * 100 : 0;

    return {
      totalBackups: stats.totalBackups || 0,
      totalSize: stats.totalSize || 0,
      averageSize: stats.averageSize || 0,
      oldestBackup: stats.oldestBackup ? new Date(stats.oldestBackup) : null,
      newestBackup: stats.newestBackup ? new Date(stats.newestBackup) : null,
      compressionSavings
    };
  }

  /**
   * Clean up expired backups
   */
  async cleanupExpiredBackups(): Promise<number> {
    if (!this.isInitialized) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    // Get expired backups
    const expiredBackups = this.metadataDb.prepare(`
      SELECT id, filePath FROM backups 
      WHERE created < ? OR (
        SELECT COUNT(*) FROM backups b2 WHERE b2.created > backups.created
      ) >= ?
    `).all(cutoffDate.toISOString(), this.config.maxBackups) as any[];

    let cleanedCount = 0;

    for (const backup of expiredBackups) {
      try {
        // Delete file if it exists
        if (fs.existsSync(backup.filePath)) {
          fs.unlinkSync(backup.filePath);
        }
        
        // Remove from metadata
        this.metadataDb.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
        cleanedCount++;
        
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.id}:`, error);
      }
    }

    if (cleanedCount > 0) {
      this.emit('cleanup-completed', { cleanedCount });
      console.log(`🧹 Cleaned up ${cleanedCount} expired backups`);
    }

    return cleanedCount;
  }

  /**
   * Shutdown backup system
   */
  async shutdown(): Promise<void> {
    this.stopScheduler();
    
    if (this.metadataDb) {
      this.metadataDb.close();
    }

    this.isInitialized = false;
    this.emit('shutdown');
    console.log('✅ BackupSystem shut down');
  }

  // Private methods

  private async initializeMetadataDb(): Promise<void> {
    this.metadataDb.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        filePath TEXT NOT NULL,
        originalPath TEXT NOT NULL,
        created TEXT NOT NULL,
        size INTEGER NOT NULL,
        compressed BOOLEAN NOT NULL,
        checksum TEXT NOT NULL,
        version TEXT NOT NULL,
        entryCount INTEGER NOT NULL,
        description TEXT,
        tags TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created);
      CREATE INDEX IF NOT EXISTS idx_backups_tags ON backups(tags);
    `);
  }

  private generateBackupId(): string {
    return createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 16);
  }

  private calculateChecksum(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async verifyBackupData(
    data: Buffer, 
    expectedChecksum?: string
  ): Promise<VerificationResult> {
    const errors: string[] = [];
    const checksum = this.calculateChecksum(data);
    
    // Check checksum if provided
    let checksumValid = true;
    if (expectedChecksum && checksum !== expectedChecksum) {
      checksumValid = false;
      errors.push('Checksum mismatch');
    }

    // Try to open as SQLite database
    let dbValid = true;
    try {
      const tempPath = path.join(this.config.backupPath, `temp_verify_${Date.now()}.db`);
      fs.writeFileSync(tempPath, data);
      
      const testDb = new Database(tempPath, { readonly: true });
      testDb.prepare('SELECT COUNT(*) FROM sqlite_master').get();
      testDb.close();
      
      fs.unlinkSync(tempPath);
      
    } catch (error) {
      dbValid = false;
      errors.push(`Database validation failed: ${error.message}`);
    }

    return {
      valid: checksumValid && dbValid,
      checksum,
      expectedChecksum: expectedChecksum || '',
      corruptionDetected: !dbValid,
      errors
    };
  }

  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    this.metadataDb.prepare(`
      INSERT INTO backups (
        id, filePath, originalPath, created, size, compressed, 
        checksum, version, entryCount, description, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      metadata.id,
      metadata.filePath,
      metadata.originalPath,
      metadata.created.toISOString(),
      metadata.size,
      metadata.compressed,
      metadata.checksum,
      metadata.version,
      metadata.entryCount,
      metadata.description,
      metadata.tags ? JSON.stringify(metadata.tags) : null
    );
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const row = this.metadataDb.prepare(`
      SELECT * FROM backups WHERE id = ?
    `).get(backupId) as any;

    if (!row) return null;

    return {
      ...row,
      created: new Date(row.created),
      tags: row.tags ? JSON.parse(row.tags) : undefined
    };
  }

  private async getDatabaseEntryCount(dbPath: string): Promise<number> {
    try {
      const db = new Database(dbPath, { readonly: true });
      const result = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get() as { count: number };
      db.close();
      return result.count;
    } catch {
      return 0;
    }
  }

  private async getDatabaseVersion(dbPath: string): Promise<string> {
    try {
      const db = new Database(dbPath, { readonly: true });
      const result = db.prepare('PRAGMA user_version').get() as { user_version: number };
      db.close();
      return result.user_version.toString();
    } catch {
      return '0';
    }
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('BackupSystem error:', error);
    });

    // Graceful shutdown on process signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
}