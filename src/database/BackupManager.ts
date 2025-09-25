import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createGzip, createGunzip } from 'zlib';

const pipelineAsync = promisify(pipeline);

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

export class BackupManager {
  private db: Database.Database;
  private backupDir: string;
  private maxBackups: number;
  private compressionEnabled: boolean;

  constructor(
    db: Database.Database,
    backupDir: string = './backups',
    maxBackups: number = 30,
    compressionEnabled: boolean = true
  ) {
    this.db = db;
    this.backupDir = backupDir;
    this.maxBackups = maxBackups;
    this.compressionEnabled = compressionEnabled;
    this.ensureBackupDirectory();
  }

  /**
   * Create a backup of the current database
   */
  async createBackup(
    type: 'manual' | 'auto' | 'migration' | 'export' = 'manual'
  ): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    const filename = `kb_backup_${backupId}_${timestamp.toISOString().replace(/[:.]/g, '-')}.db`;
    const backupPath = path.join(this.backupDir, filename);

    console.log(`🔄 Creating ${type} backup: ${filename}`);

    try {
      // Create backup metadata entry
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type,
        filePath: backupPath,
        compressedSize: 0,
        originalSize: 0,
        checksum: '',
        entryCount: 0,
        version: await this.getDatabaseVersion(),
        compressed: this.compressionEnabled,
        status: 'in_progress',
      };

      // Log backup start
      this.logBackupStart(metadata);

      // Get entry count before backup
      const entryCount = this.getEntryCount();
      metadata.entryCount = entryCount;

      // Create database backup
      const tempBackupPath = backupPath + '.tmp';

      // Use SQLite backup API for consistency
      await this.createSQLiteBackup(tempBackupPath);

      // Get original size
      const originalSize = fs.statSync(tempBackupPath).size;
      metadata.originalSize = originalSize;

      let finalPath = tempBackupPath;

      // Compress if enabled
      if (this.compressionEnabled) {
        const compressedPath = backupPath + '.gz';
        await this.compressFile(tempBackupPath, compressedPath);

        // Remove uncompressed temp file
        fs.unlinkSync(tempBackupPath);

        finalPath = compressedPath;
        metadata.filePath = compressedPath;
        metadata.compressedSize = fs.statSync(compressedPath).size;
      } else {
        // Rename temp file to final name
        fs.renameSync(tempBackupPath, backupPath);
        metadata.compressedSize = originalSize;
      }

      // Calculate checksum
      metadata.checksum = await this.calculateFileChecksum(finalPath);

      // Update backup status
      metadata.status = 'completed';
      this.logBackupCompletion(metadata);

      console.log(
        `✅ Backup completed: ${this.formatBytes(metadata.compressedSize)} (${this.compressionEnabled ? 'compressed' : 'uncompressed'})`
      );

      // Cleanup old backups
      await this.cleanupOldBackups();

      return metadata;
    } catch (error) {
      console.error(`❌ Backup failed:`, error);

      // Log failure
      this.db
        .prepare(
          `
        UPDATE backup_log 
        SET status = 'failed' 
        WHERE backup_path = ?
      `
        )
        .run(backupPath);

      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    console.log('🔄 Starting database restore...');

    // Create restore point if requested
    if (options.createRestorePoint !== false) {
      console.log('📸 Creating restore point...');
      await this.createBackup('manual');
    }

    let backupPath: string;

    if (options.backupPath) {
      backupPath = options.backupPath;
    } else if (options.backupId) {
      backupPath = await this.getBackupPath(options.backupId);
    } else if (options.pointInTime) {
      backupPath = await this.findBackupByTime(options.pointInTime);
    } else {
      backupPath = await this.getLatestBackupPath();
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    console.log(`📂 Restoring from: ${path.basename(backupPath)}`);

    try {
      // Verify backup integrity if requested
      if (options.verifyIntegrity !== false) {
        console.log('🔍 Verifying backup integrity...');
        await this.verifyBackupIntegrity(backupPath);
      }

      // Prepare restore file
      const restoreFile = await this.prepareRestoreFile(backupPath);

      // Close current database
      this.db.close();

      // Replace database file
      const dbPath = this.db.name;
      fs.copyFileSync(restoreFile, dbPath);

      // Cleanup temp restore file
      if (restoreFile !== backupPath) {
        fs.unlinkSync(restoreFile);
      }

      // Reopen database
      this.db = new Database(dbPath);

      // Verify restored database
      await this.verifyRestoredDatabase();

      console.log('✅ Database restore completed successfully');
    } catch (error) {
      console.error('❌ Database restore failed:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  listBackups(): BackupMetadata[] {
    const backups = this.db
      .prepare(
        `
      SELECT 
        backup_path as filePath,
        backup_type as type,
        file_size as compressedSize,
        entries_count as entryCount,
        created_at as timestamp,
        checksum,
        status
      FROM backup_log
      WHERE status = 'completed'
      ORDER BY created_at DESC
    `
      )
      .all() as Array<{
      filePath: string;
      type: string;
      compressedSize: number;
      entryCount: number;
      timestamp: string;
      checksum: string;
      status: string;
    }>;

    return backups.map(backup => ({
      id: path.basename(backup.filePath, path.extname(backup.filePath)),
      timestamp: new Date(backup.timestamp),
      type: backup.type as any,
      filePath: backup.filePath,
      compressedSize: backup.compressedSize,
      originalSize: 0, // Not stored in log
      checksum: backup.checksum,
      entryCount: backup.entryCount,
      version: '1.0', // Default version
      compressed: backup.filePath.endsWith('.gz'),
      status: backup.status as any,
    }));
  }

  /**
   * Export database to JSON
   */
  async exportToJSON(outputPath: string): Promise<void> {
    console.log('📤 Exporting database to JSON...');

    try {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: await this.getDatabaseVersion(),
          entryCount: this.getEntryCount(),
        },
        entries: this.db
          .prepare(
            `
          SELECT 
            e.*,
            GROUP_CONCAT(t.tag) as tags
          FROM kb_entries e
          LEFT JOIN kb_tags t ON e.id = t.entry_id
          WHERE e.archived = FALSE
          GROUP BY e.id
          ORDER BY e.created_at
        `
          )
          .all(),
        categories: this.db
          .prepare(
            `
          SELECT category, COUNT(*) as count
          FROM kb_entries
          WHERE archived = FALSE
          GROUP BY category
        `
          )
          .all(),
        systemConfig: this.db
          .prepare(
            `
          SELECT key, value, type, description
          FROM system_config
        `
          )
          .all(),
      };

      // Process entries to parse tags
      exportData.entries = exportData.entries.map((entry: any) => ({
        ...entry,
        tags: entry.tags ? entry.tags.split(',') : [],
      }));

      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

      console.log(`✅ Export completed: ${this.formatBytes(fs.statSync(outputPath).size)}`);
    } catch (error) {
      console.error('❌ JSON export failed:', error);
      throw error;
    }
  }

  /**
   * Import database from JSON
   */
  async importFromJSON(jsonPath: string, mergeMode: boolean = false): Promise<void> {
    console.log('📥 Importing database from JSON...');

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found: ${jsonPath}`);
    }

    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      if (!jsonData.entries || !Array.isArray(jsonData.entries)) {
        throw new Error('Invalid JSON format: missing entries array');
      }

      // Create backup before import
      await this.createBackup('manual');

      let imported = 0;
      let skipped = 0;

      // Import entries
      const transaction = this.db.transaction(() => {
        for (const entry of jsonData.entries) {
          try {
            // Check if entry exists (in merge mode)
            if (mergeMode) {
              const existing = this.db
                .prepare('SELECT id FROM kb_entries WHERE id = ?')
                .get(entry.id);
              if (existing) {
                skipped++;
                continue;
              }
            }

            // Insert entry
            this.db
              .prepare(
                `
              INSERT OR REPLACE INTO kb_entries 
              (id, title, problem, solution, category, created_at, created_by, usage_count, success_count, failure_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
              )
              .run(
                entry.id,
                entry.title,
                entry.problem,
                entry.solution,
                entry.category,
                entry.created_at,
                entry.created_by || 'import',
                entry.usage_count || 0,
                entry.success_count || 0,
                entry.failure_count || 0
              );

            // Insert tags
            if (entry.tags && entry.tags.length > 0) {
              const tagStmt = this.db.prepare(
                'INSERT OR IGNORE INTO kb_tags (entry_id, tag) VALUES (?, ?)'
              );
              entry.tags.forEach((tag: string) => {
                tagStmt.run(entry.id, tag);
              });
            }

            imported++;
          } catch (error) {
            console.error(`Failed to import entry ${entry.id}:`, error);
          }
        }
      });

      transaction();

      console.log(`✅ Import completed: ${imported} imported, ${skipped} skipped`);
    } catch (error) {
      console.error('❌ JSON import failed:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutoBackups(intervalHours: number = 24): void {
    console.log(`⏰ Scheduling automatic backups every ${intervalHours} hours`);

    const intervalMs = intervalHours * 60 * 60 * 1000;

    setInterval(async () => {
      try {
        console.log('🔄 Running scheduled backup...');
        await this.createBackup('auto');
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
      }
    }, intervalMs);

    // Run initial backup after 1 minute
    setTimeout(async () => {
      try {
        await this.createBackup('auto');
      } catch (error) {
        console.error('❌ Initial auto backup failed:', error);
      }
    }, 60000);
  }

  /**
   * Get backup statistics
   */
  getBackupStats(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    averageSize: number;
    backupsByType: Record<string, number>;
  } {
    const stats = this.db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalBackups,
        SUM(file_size) as totalSize,
        MIN(created_at) as oldestBackup,
        MAX(created_at) as newestBackup,
        AVG(file_size) as averageSize
      FROM backup_log
      WHERE status = 'completed'
    `
      )
      .get() as any;

    const typeStats = this.db
      .prepare(
        `
      SELECT backup_type, COUNT(*) as count
      FROM backup_log
      WHERE status = 'completed'
      GROUP BY backup_type
    `
      )
      .all() as Array<{ backup_type: string; count: number }>;

    const backupsByType: Record<string, number> = {};
    typeStats.forEach(stat => {
      backupsByType[stat.backup_type] = stat.count;
    });

    return {
      totalBackups: stats.totalBackups || 0,
      totalSize: stats.totalSize || 0,
      oldestBackup: stats.oldestBackup ? new Date(stats.oldestBackup) : null,
      newestBackup: stats.newestBackup ? new Date(stats.newestBackup) : null,
      averageSize: stats.averageSize || 0,
      backupsByType,
    };
  }

  // Private helper methods

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private generateBackupId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private async getDatabaseVersion(): Promise<string> {
    try {
      const result = this.db
        .prepare('SELECT MAX(version) as version FROM schema_versions')
        .get() as { version: number };
      return result.version?.toString() || '1';
    } catch (error) {
      return '1';
    }
  }

  private getEntryCount(): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM kb_entries WHERE archived = FALSE')
      .get() as { count: number };
    return result.count;
  }

  private async createSQLiteBackup(backupPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const backup = this.db.backup(backupPath);
        backup.then(() => resolve()).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const readable = fs.createReadStream(inputPath);
    const writable = fs.createWriteStream(outputPath);
    const gzip = createGzip({ level: 6 });

    await pipelineAsync(readable, gzip, writable);
  }

  private async decompressFile(inputPath: string, outputPath: string): Promise<void> {
    const readable = fs.createReadStream(inputPath);
    const writable = fs.createWriteStream(outputPath);
    const gunzip = createGunzip();

    await pipelineAsync(readable, gunzip, writable);
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private logBackupStart(metadata: BackupMetadata): void {
    this.db
      .prepare(
        `
      INSERT INTO backup_log (backup_path, backup_type, entries_count, created_at, status)
      VALUES (?, ?, ?, ?, 'in_progress')
    `
      )
      .run(metadata.filePath, metadata.type, metadata.entryCount, metadata.timestamp.toISOString());
  }

  private logBackupCompletion(metadata: BackupMetadata): void {
    this.db
      .prepare(
        `
      UPDATE backup_log 
      SET file_size = ?, checksum = ?, status = 'completed'
      WHERE backup_path = ?
    `
      )
      .run(metadata.compressedSize, metadata.checksum, metadata.filePath);
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = this.db
      .prepare(
        `
      SELECT backup_path, created_at
      FROM backup_log
      WHERE status = 'completed'
      ORDER BY created_at DESC
    `
      )
      .all() as Array<{ backup_path: string; created_at: string }>;

    if (backups.length <= this.maxBackups) return;

    const toDelete = backups.slice(this.maxBackups);

    for (const backup of toDelete) {
      try {
        if (fs.existsSync(backup.backup_path)) {
          fs.unlinkSync(backup.backup_path);
        }

        this.db.prepare('DELETE FROM backup_log WHERE backup_path = ?').run(backup.backup_path);
        console.log(`🗑️ Cleaned up old backup: ${path.basename(backup.backup_path)}`);
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.backup_path}:`, error);
      }
    }
  }

  private async getBackupPath(backupId: string): Promise<string> {
    const result = this.db
      .prepare('SELECT backup_path FROM backup_log WHERE backup_path LIKE ?')
      .get(`%${backupId}%`) as { backup_path: string };
    if (!result) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    return result.backup_path;
  }

  private async getLatestBackupPath(): Promise<string> {
    const result = this.db
      .prepare(
        `
      SELECT backup_path 
      FROM backup_log 
      WHERE status = 'completed'
      ORDER BY created_at DESC 
      LIMIT 1
    `
      )
      .get() as { backup_path: string };

    if (!result) {
      throw new Error('No backups found');
    }
    return result.backup_path;
  }

  private async findBackupByTime(pointInTime: Date): Promise<string> {
    const result = this.db
      .prepare(
        `
      SELECT backup_path 
      FROM backup_log 
      WHERE status = 'completed' AND created_at <= ?
      ORDER BY created_at DESC 
      LIMIT 1
    `
      )
      .get(pointInTime.toISOString()) as { backup_path: string };

    if (!result) {
      throw new Error(`No backup found before ${pointInTime.toISOString()}`);
    }
    return result.backup_path;
  }

  private async prepareRestoreFile(backupPath: string): Promise<string> {
    if (backupPath.endsWith('.gz')) {
      // Decompress to temp file
      const tempFile = path.join(this.backupDir, `restore_${Date.now()}.db`);
      await this.decompressFile(backupPath, tempFile);
      return tempFile;
    }
    return backupPath;
  }

  private async verifyBackupIntegrity(backupPath: string): Promise<void> {
    // Get expected checksum from log
    const logEntry = this.db
      .prepare('SELECT checksum FROM backup_log WHERE backup_path = ?')
      .get(backupPath) as { checksum: string };

    if (logEntry) {
      const actualChecksum = await this.calculateFileChecksum(backupPath);
      if (actualChecksum !== logEntry.checksum) {
        throw new Error('Backup integrity check failed: checksum mismatch');
      }
    }

    // Test SQLite file integrity (if uncompressed or after decompression)
    const testFile = await this.prepareRestoreFile(backupPath);

    try {
      const testDb = new Database(testFile, { readonly: true });
      const result = testDb.pragma('integrity_check', { simple: true });
      testDb.close();

      if (result !== 'ok') {
        throw new Error(`Backup integrity check failed: ${result}`);
      }
    } finally {
      if (testFile !== backupPath) {
        fs.unlinkSync(testFile);
      }
    }
  }

  private async verifyRestoredDatabase(): Promise<void> {
    // Quick integrity check
    const result = this.db.pragma('quick_check', { simple: true });
    if (result !== 'ok') {
      throw new Error(`Restored database integrity check failed: ${result}`);
    }

    // Verify essential tables exist
    const tables = this.db
      .prepare(
        `
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name IN ('kb_entries', 'kb_tags', 'kb_fts')
    `
      )
      .all();

    if (tables.length < 3) {
      throw new Error('Restored database is missing essential tables');
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
