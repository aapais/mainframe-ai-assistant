"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupSystem = void 0;
const tslib_1 = require("tslib");
const better_sqlite3_1 = tslib_1.__importDefault(require("better-sqlite3"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const crypto_1 = require("crypto");
const util_1 = require("util");
const zlib_1 = require("zlib");
const events_1 = require("events");
const gzipAsync = (0, util_1.promisify)(zlib_1.gzip);
const gunzipAsync = (0, util_1.promisify)(zlib_1.gunzip);
class BackupSystem extends events_1.EventEmitter {
    config;
    db = null;
    schedulerTimer = null;
    isInitialized = false;
    metadataDb;
    constructor(config) {
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
    async initialize() {
        try {
            if (!fs_1.default.existsSync(this.config.backupPath)) {
                fs_1.default.mkdirSync(this.config.backupPath, { recursive: true });
            }
            const metadataPath = path_1.default.join(this.config.backupPath, 'backup_metadata.db');
            this.metadataDb = new better_sqlite3_1.default(metadataPath);
            await this.initializeMetadataDb();
            await this.cleanupExpiredBackups();
            this.isInitialized = true;
            this.emit('initialized');
            console.log('✅ BackupSystem initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize BackupSystem:', error);
            throw error;
        }
    }
    async createBackup(dbPath, options = {}) {
        if (!this.isInitialized) {
            throw new Error('BackupSystem not initialized');
        }
        const startTime = Date.now();
        const backupId = this.generateBackupId();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = this.config.namePattern
            .replace('{timestamp}', timestamp)
            .replace('{id}', backupId.substring(0, 8));
        const backupPath = path_1.default.join(this.config.backupPath, `${filename}.db${this.config.compression ? '.gz' : ''}`);
        try {
            if (!fs_1.default.existsSync(dbPath)) {
                throw new Error(`Source database not found: ${dbPath}`);
            }
            const sourceStats = fs_1.default.statSync(dbPath);
            let backupData;
            try {
                const sourceDb = new better_sqlite3_1.default(dbPath, { readonly: true });
                backupData = sourceDb.serialize();
                sourceDb.close();
            }
            catch {
                backupData = fs_1.default.readFileSync(dbPath);
            }
            let finalData = backupData;
            let compressedSize;
            if (options.compress ?? this.config.compression) {
                finalData = await gzipAsync(backupData);
                compressedSize = finalData.length;
            }
            fs_1.default.writeFileSync(backupPath, finalData);
            const checksum = this.calculateChecksum(backupData);
            if (options.verify ?? this.config.verifyIntegrity) {
                const verification = await this.verifyBackup(backupPath, checksum);
                if (!verification.valid) {
                    throw new Error(`Backup verification failed: ${verification.errors.join(', ')}`);
                }
            }
            const entryCount = await this.getDatabaseEntryCount(dbPath);
            const metadata = {
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
            const result = {
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
        }
        catch (error) {
            if (fs_1.default.existsSync(backupPath)) {
                fs_1.default.unlinkSync(backupPath);
            }
            const result = {
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
    async restore(backupId, targetPath, options = {}) {
        if (!this.isInitialized) {
            throw new Error('BackupSystem not initialized');
        }
        const startTime = Date.now();
        try {
            const metadata = await this.getBackupMetadata(backupId);
            if (!metadata) {
                throw new Error(`Backup not found: ${backupId}`);
            }
            if (!fs_1.default.existsSync(metadata.filePath)) {
                throw new Error(`Backup file not found: ${metadata.filePath}`);
            }
            if (fs_1.default.existsSync(targetPath) && !options.overwrite) {
                throw new Error(`Target file exists: ${targetPath}. Use overwrite option.`);
            }
            const targetDir = path_1.default.dirname(targetPath);
            if (!fs_1.default.existsSync(targetDir)) {
                fs_1.default.mkdirSync(targetDir, { recursive: true });
            }
            let backupData = fs_1.default.readFileSync(metadata.filePath);
            if (metadata.compressed) {
                backupData = await gunzipAsync(backupData);
            }
            let verificationPassed = true;
            if (options.verify ?? this.config.verifyIntegrity) {
                const verification = await this.verifyBackupData(backupData, metadata.checksum);
                verificationPassed = verification.valid;
                if (!verificationPassed) {
                    throw new Error(`Backup integrity verification failed: ${verification.errors.join(', ')}`);
                }
            }
            fs_1.default.writeFileSync(targetPath, backupData);
            try {
                const testDb = new better_sqlite3_1.default(targetPath, { readonly: true });
                testDb.prepare('SELECT COUNT(*) FROM sqlite_master').get();
                testDb.close();
            }
            catch (error) {
                fs_1.default.unlinkSync(targetPath);
                throw new Error(`Restored database is invalid: ${error.message}`);
            }
            const duration = Date.now() - startTime;
            const result = {
                success: true,
                restoredPath: targetPath,
                duration,
                verificationPassed
            };
            this.emit('restore-completed', result);
            console.log(`✅ Database restored from backup ${backupId} (${duration}ms)`);
            return result;
        }
        catch (error) {
            const result = {
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
    async listBackups(filter) {
        if (!this.isInitialized) {
            throw new Error('BackupSystem not initialized');
        }
        let query = `
      SELECT * FROM backups 
      WHERE 1=1
    `;
        const params = [];
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
        const rows = this.metadataDb.prepare(query).all(params);
        return rows.map(row => ({
            ...row,
            created: new Date(row.created),
            tags: row.tags ? JSON.parse(row.tags) : undefined
        }));
    }
    async deleteBackup(backupId) {
        if (!this.isInitialized) {
            throw new Error('BackupSystem not initialized');
        }
        const metadata = await this.getBackupMetadata(backupId);
        if (!metadata) {
            throw new Error(`Backup not found: ${backupId}`);
        }
        if (fs_1.default.existsSync(metadata.filePath)) {
            fs_1.default.unlinkSync(metadata.filePath);
        }
        this.metadataDb.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
        this.emit('backup-deleted', { backupId });
        console.log(`🗑️ Backup deleted: ${backupId}`);
    }
    async startScheduler(dbPath) {
        if (this.schedulerTimer) {
            console.log('⚠️ Scheduler already running');
            return;
        }
        if (!dbPath && !this.db) {
            throw new Error('Database path required for scheduler');
        }
        const targetPath = dbPath || this.db.name;
        const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
        this.schedulerTimer = setInterval(async () => {
            try {
                await this.createBackup(targetPath, {
                    description: 'Automatic backup',
                    tags: ['auto', 'scheduled']
                });
            }
            catch (error) {
                console.error('❌ Scheduled backup failed:', error);
                this.emit('scheduled-backup-failed', error);
            }
        }, intervalMs);
        this.emit('scheduler-started', { intervalHours: this.config.intervalHours });
        console.log(`⏰ Backup scheduler started (every ${this.config.intervalHours}h)`);
    }
    stopScheduler() {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
            this.emit('scheduler-stopped');
            console.log('⏰ Backup scheduler stopped');
        }
    }
    async verifyBackup(backupPath, expectedChecksum) {
        try {
            let backupData = fs_1.default.readFileSync(backupPath);
            if (backupPath.endsWith('.gz')) {
                backupData = await gunzipAsync(backupData);
            }
            return await this.verifyBackupData(backupData, expectedChecksum);
        }
        catch (error) {
            return {
                valid: false,
                checksum: '',
                expectedChecksum: expectedChecksum || '',
                corruptionDetected: true,
                errors: [`Verification failed: ${error.message}`]
            };
        }
    }
    async getStats() {
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
    `).get();
        const compressedBackups = this.metadataDb.prepare(`
      SELECT filePath FROM backups WHERE compressed = 1
    `).all();
        let totalCompressedSize = 0;
        for (const backup of compressedBackups) {
            if (fs_1.default.existsSync(backup.filePath)) {
                totalCompressedSize += fs_1.default.statSync(backup.filePath).size;
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
    async cleanupExpiredBackups() {
        if (!this.isInitialized) {
            return 0;
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        const expiredBackups = this.metadataDb.prepare(`
      SELECT id, filePath FROM backups 
      WHERE created < ? OR (
        SELECT COUNT(*) FROM backups b2 WHERE b2.created > backups.created
      ) >= ?
    `).all(cutoffDate.toISOString(), this.config.maxBackups);
        let cleanedCount = 0;
        for (const backup of expiredBackups) {
            try {
                if (fs_1.default.existsSync(backup.filePath)) {
                    fs_1.default.unlinkSync(backup.filePath);
                }
                this.metadataDb.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
                cleanedCount++;
            }
            catch (error) {
                console.error(`Failed to cleanup backup ${backup.id}:`, error);
            }
        }
        if (cleanedCount > 0) {
            this.emit('cleanup-completed', { cleanedCount });
            console.log(`🧹 Cleaned up ${cleanedCount} expired backups`);
        }
        return cleanedCount;
    }
    async shutdown() {
        this.stopScheduler();
        if (this.metadataDb) {
            this.metadataDb.close();
        }
        this.isInitialized = false;
        this.emit('shutdown');
        console.log('✅ BackupSystem shut down');
    }
    async initializeMetadataDb() {
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
    generateBackupId() {
        return (0, crypto_1.createHash)('sha256')
            .update(Date.now().toString() + Math.random().toString())
            .digest('hex')
            .substring(0, 16);
    }
    calculateChecksum(data) {
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
    async verifyBackupData(data, expectedChecksum) {
        const errors = [];
        const checksum = this.calculateChecksum(data);
        let checksumValid = true;
        if (expectedChecksum && checksum !== expectedChecksum) {
            checksumValid = false;
            errors.push('Checksum mismatch');
        }
        let dbValid = true;
        try {
            const tempPath = path_1.default.join(this.config.backupPath, `temp_verify_${Date.now()}.db`);
            fs_1.default.writeFileSync(tempPath, data);
            const testDb = new better_sqlite3_1.default(tempPath, { readonly: true });
            testDb.prepare('SELECT COUNT(*) FROM sqlite_master').get();
            testDb.close();
            fs_1.default.unlinkSync(tempPath);
        }
        catch (error) {
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
    async storeBackupMetadata(metadata) {
        this.metadataDb.prepare(`
      INSERT INTO backups (
        id, filePath, originalPath, created, size, compressed, 
        checksum, version, entryCount, description, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(metadata.id, metadata.filePath, metadata.originalPath, metadata.created.toISOString(), metadata.size, metadata.compressed, metadata.checksum, metadata.version, metadata.entryCount, metadata.description, metadata.tags ? JSON.stringify(metadata.tags) : null);
    }
    async getBackupMetadata(backupId) {
        const row = this.metadataDb.prepare(`
      SELECT * FROM backups WHERE id = ?
    `).get(backupId);
        if (!row)
            return null;
        return {
            ...row,
            created: new Date(row.created),
            tags: row.tags ? JSON.parse(row.tags) : undefined
        };
    }
    async getDatabaseEntryCount(dbPath) {
        try {
            const db = new better_sqlite3_1.default(dbPath, { readonly: true });
            const result = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get();
            db.close();
            return result.count;
        }
        catch {
            return 0;
        }
    }
    async getDatabaseVersion(dbPath) {
        try {
            const db = new better_sqlite3_1.default(dbPath, { readonly: true });
            const result = db.prepare('PRAGMA user_version').get();
            db.close();
            return result.user_version.toString();
        }
        catch {
            return '0';
        }
    }
    setupErrorHandling() {
        this.on('error', (error) => {
            console.error('BackupSystem error:', error);
        });
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }
}
exports.BackupSystem = BackupSystem;
//# sourceMappingURL=BackupSystem.js.map