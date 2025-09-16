"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const util_1 = require("util");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
class BackupManager {
    db;
    backupDir;
    maxBackups;
    compressionEnabled;
    constructor(db, backupDir = './backups', maxBackups = 30, compressionEnabled = true) {
        this.db = db;
        this.backupDir = backupDir;
        this.maxBackups = maxBackups;
        this.compressionEnabled = compressionEnabled;
        this.ensureBackupDirectory();
    }
    async createBackup(type = 'manual') {
        const backupId = this.generateBackupId();
        const timestamp = new Date();
        const filename = `kb_backup_${backupId}_${timestamp.toISOString().replace(/[:.]/g, '-')}.db`;
        const backupPath = path_1.default.join(this.backupDir, filename);
        console.log(`🔄 Creating ${type} backup: ${filename}`);
        try {
            const metadata = {
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
                status: 'in_progress'
            };
            this.logBackupStart(metadata);
            const entryCount = this.getEntryCount();
            metadata.entryCount = entryCount;
            const tempBackupPath = backupPath + '.tmp';
            await this.createSQLiteBackup(tempBackupPath);
            const originalSize = fs_1.default.statSync(tempBackupPath).size;
            metadata.originalSize = originalSize;
            let finalPath = tempBackupPath;
            if (this.compressionEnabled) {
                const compressedPath = backupPath + '.gz';
                await this.compressFile(tempBackupPath, compressedPath);
                fs_1.default.unlinkSync(tempBackupPath);
                finalPath = compressedPath;
                metadata.filePath = compressedPath;
                metadata.compressedSize = fs_1.default.statSync(compressedPath).size;
            }
            else {
                fs_1.default.renameSync(tempBackupPath, backupPath);
                metadata.compressedSize = originalSize;
            }
            metadata.checksum = await this.calculateFileChecksum(finalPath);
            metadata.status = 'completed';
            this.logBackupCompletion(metadata);
            console.log(`✅ Backup completed: ${this.formatBytes(metadata.compressedSize)} (${this.compressionEnabled ? 'compressed' : 'uncompressed'})`);
            await this.cleanupOldBackups();
            return metadata;
        }
        catch (error) {
            console.error(`❌ Backup failed:`, error);
            this.db.prepare(`
        UPDATE backup_log 
        SET status = 'failed' 
        WHERE backup_path = ?
      `).run(backupPath);
            throw error;
        }
    }
    async restoreFromBackup(options) {
        console.log('🔄 Starting database restore...');
        if (options.createRestorePoint !== false) {
            console.log('📸 Creating restore point...');
            await this.createBackup('manual');
        }
        let backupPath;
        if (options.backupPath) {
            backupPath = options.backupPath;
        }
        else if (options.backupId) {
            backupPath = await this.getBackupPath(options.backupId);
        }
        else if (options.pointInTime) {
            backupPath = await this.findBackupByTime(options.pointInTime);
        }
        else {
            backupPath = await this.getLatestBackupPath();
        }
        if (!fs_1.default.existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }
        console.log(`📂 Restoring from: ${path_1.default.basename(backupPath)}`);
        try {
            if (options.verifyIntegrity !== false) {
                console.log('🔍 Verifying backup integrity...');
                await this.verifyBackupIntegrity(backupPath);
            }
            const restoreFile = await this.prepareRestoreFile(backupPath);
            this.db.close();
            const dbPath = this.db.name;
            fs_1.default.copyFileSync(restoreFile, dbPath);
            if (restoreFile !== backupPath) {
                fs_1.default.unlinkSync(restoreFile);
            }
            this.db = new better_sqlite3_1.default(dbPath);
            await this.verifyRestoredDatabase();
            console.log('✅ Database restore completed successfully');
        }
        catch (error) {
            console.error('❌ Database restore failed:', error);
            throw error;
        }
    }
    listBackups() {
        const backups = this.db.prepare(`
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
    `).all();
        return backups.map(backup => ({
            id: path_1.default.basename(backup.filePath, path_1.default.extname(backup.filePath)),
            timestamp: new Date(backup.timestamp),
            type: backup.type,
            filePath: backup.filePath,
            compressedSize: backup.compressedSize,
            originalSize: 0,
            checksum: backup.checksum,
            entryCount: backup.entryCount,
            version: '1.0',
            compressed: backup.filePath.endsWith('.gz'),
            status: backup.status
        }));
    }
    async exportToJSON(outputPath) {
        console.log('📤 Exporting database to JSON...');
        try {
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    version: await this.getDatabaseVersion(),
                    entryCount: this.getEntryCount()
                },
                entries: this.db.prepare(`
          SELECT 
            e.*,
            GROUP_CONCAT(t.tag) as tags
          FROM kb_entries e
          LEFT JOIN kb_tags t ON e.id = t.entry_id
          WHERE e.archived = FALSE
          GROUP BY e.id
          ORDER BY e.created_at
        `).all(),
                categories: this.db.prepare(`
          SELECT category, COUNT(*) as count
          FROM kb_entries
          WHERE archived = FALSE
          GROUP BY category
        `).all(),
                systemConfig: this.db.prepare(`
          SELECT key, value, type, description
          FROM system_config
        `).all()
            };
            exportData.entries = exportData.entries.map((entry) => ({
                ...entry,
                tags: entry.tags ? entry.tags.split(',') : []
            }));
            fs_1.default.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
            console.log(`✅ Export completed: ${this.formatBytes(fs_1.default.statSync(outputPath).size)}`);
        }
        catch (error) {
            console.error('❌ JSON export failed:', error);
            throw error;
        }
    }
    async importFromJSON(jsonPath, mergeMode = false) {
        console.log('📥 Importing database from JSON...');
        if (!fs_1.default.existsSync(jsonPath)) {
            throw new Error(`JSON file not found: ${jsonPath}`);
        }
        try {
            const jsonData = JSON.parse(fs_1.default.readFileSync(jsonPath, 'utf8'));
            if (!jsonData.entries || !Array.isArray(jsonData.entries)) {
                throw new Error('Invalid JSON format: missing entries array');
            }
            await this.createBackup('manual');
            let imported = 0;
            let skipped = 0;
            const transaction = this.db.transaction(() => {
                for (const entry of jsonData.entries) {
                    try {
                        if (mergeMode) {
                            const existing = this.db.prepare('SELECT id FROM kb_entries WHERE id = ?').get(entry.id);
                            if (existing) {
                                skipped++;
                                continue;
                            }
                        }
                        this.db.prepare(`
              INSERT OR REPLACE INTO kb_entries 
              (id, title, problem, solution, category, created_at, created_by, usage_count, success_count, failure_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(entry.id, entry.title, entry.problem, entry.solution, entry.category, entry.created_at, entry.created_by || 'import', entry.usage_count || 0, entry.success_count || 0, entry.failure_count || 0);
                        if (entry.tags && entry.tags.length > 0) {
                            const tagStmt = this.db.prepare('INSERT OR IGNORE INTO kb_tags (entry_id, tag) VALUES (?, ?)');
                            entry.tags.forEach((tag) => {
                                tagStmt.run(entry.id, tag);
                            });
                        }
                        imported++;
                    }
                    catch (error) {
                        console.error(`Failed to import entry ${entry.id}:`, error);
                    }
                }
            });
            transaction();
            console.log(`✅ Import completed: ${imported} imported, ${skipped} skipped`);
        }
        catch (error) {
            console.error('❌ JSON import failed:', error);
            throw error;
        }
    }
    scheduleAutoBackups(intervalHours = 24) {
        console.log(`⏰ Scheduling automatic backups every ${intervalHours} hours`);
        const intervalMs = intervalHours * 60 * 60 * 1000;
        setInterval(async () => {
            try {
                console.log('🔄 Running scheduled backup...');
                await this.createBackup('auto');
            }
            catch (error) {
                console.error('❌ Scheduled backup failed:', error);
            }
        }, intervalMs);
        setTimeout(async () => {
            try {
                await this.createBackup('auto');
            }
            catch (error) {
                console.error('❌ Initial auto backup failed:', error);
            }
        }, 60000);
    }
    getBackupStats() {
        const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as totalBackups,
        SUM(file_size) as totalSize,
        MIN(created_at) as oldestBackup,
        MAX(created_at) as newestBackup,
        AVG(file_size) as averageSize
      FROM backup_log
      WHERE status = 'completed'
    `).get();
        const typeStats = this.db.prepare(`
      SELECT backup_type, COUNT(*) as count
      FROM backup_log
      WHERE status = 'completed'
      GROUP BY backup_type
    `).all();
        const backupsByType = {};
        typeStats.forEach(stat => {
            backupsByType[stat.backup_type] = stat.count;
        });
        return {
            totalBackups: stats.totalBackups || 0,
            totalSize: stats.totalSize || 0,
            oldestBackup: stats.oldestBackup ? new Date(stats.oldestBackup) : null,
            newestBackup: stats.newestBackup ? new Date(stats.newestBackup) : null,
            averageSize: stats.averageSize || 0,
            backupsByType
        };
    }
    ensureBackupDirectory() {
        if (!fs_1.default.existsSync(this.backupDir)) {
            fs_1.default.mkdirSync(this.backupDir, { recursive: true });
        }
    }
    generateBackupId() {
        return crypto_1.default.randomBytes(8).toString('hex');
    }
    async getDatabaseVersion() {
        try {
            const result = this.db.prepare('SELECT MAX(version) as version FROM schema_versions').get();
            return result.version?.toString() || '1';
        }
        catch (error) {
            return '1';
        }
    }
    getEntryCount() {
        const result = this.db.prepare('SELECT COUNT(*) as count FROM kb_entries WHERE archived = FALSE').get();
        return result.count;
    }
    async createSQLiteBackup(backupPath) {
        return new Promise((resolve, reject) => {
            try {
                const backup = this.db.backup(backupPath);
                backup.then(() => resolve()).catch(reject);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async compressFile(inputPath, outputPath) {
        const readable = fs_1.default.createReadStream(inputPath);
        const writable = fs_1.default.createWriteStream(outputPath);
        const gzip = (0, zlib_1.createGzip)({ level: 6 });
        await pipelineAsync(readable, gzip, writable);
    }
    async decompressFile(inputPath, outputPath) {
        const readable = fs_1.default.createReadStream(inputPath);
        const writable = fs_1.default.createWriteStream(outputPath);
        const gunzip = (0, zlib_1.createGunzip)();
        await pipelineAsync(readable, gunzip, writable);
    }
    async calculateFileChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto_1.default.createHash('sha256');
            const stream = fs_1.default.createReadStream(filePath);
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    logBackupStart(metadata) {
        this.db.prepare(`
      INSERT INTO backup_log (backup_path, backup_type, entries_count, created_at, status)
      VALUES (?, ?, ?, ?, 'in_progress')
    `).run(metadata.filePath, metadata.type, metadata.entryCount, metadata.timestamp.toISOString());
    }
    logBackupCompletion(metadata) {
        this.db.prepare(`
      UPDATE backup_log 
      SET file_size = ?, checksum = ?, status = 'completed'
      WHERE backup_path = ?
    `).run(metadata.compressedSize, metadata.checksum, metadata.filePath);
    }
    async cleanupOldBackups() {
        const backups = this.db.prepare(`
      SELECT backup_path, created_at
      FROM backup_log
      WHERE status = 'completed'
      ORDER BY created_at DESC
    `).all();
        if (backups.length <= this.maxBackups)
            return;
        const toDelete = backups.slice(this.maxBackups);
        for (const backup of toDelete) {
            try {
                if (fs_1.default.existsSync(backup.backup_path)) {
                    fs_1.default.unlinkSync(backup.backup_path);
                }
                this.db.prepare('DELETE FROM backup_log WHERE backup_path = ?').run(backup.backup_path);
                console.log(`🗑️ Cleaned up old backup: ${path_1.default.basename(backup.backup_path)}`);
            }
            catch (error) {
                console.error(`Failed to cleanup backup ${backup.backup_path}:`, error);
            }
        }
    }
    async getBackupPath(backupId) {
        const result = this.db.prepare('SELECT backup_path FROM backup_log WHERE backup_path LIKE ?').get(`%${backupId}%`);
        if (!result) {
            throw new Error(`Backup not found: ${backupId}`);
        }
        return result.backup_path;
    }
    async getLatestBackupPath() {
        const result = this.db.prepare(`
      SELECT backup_path 
      FROM backup_log 
      WHERE status = 'completed'
      ORDER BY created_at DESC 
      LIMIT 1
    `).get();
        if (!result) {
            throw new Error('No backups found');
        }
        return result.backup_path;
    }
    async findBackupByTime(pointInTime) {
        const result = this.db.prepare(`
      SELECT backup_path 
      FROM backup_log 
      WHERE status = 'completed' AND created_at <= ?
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(pointInTime.toISOString());
        if (!result) {
            throw new Error(`No backup found before ${pointInTime.toISOString()}`);
        }
        return result.backup_path;
    }
    async prepareRestoreFile(backupPath) {
        if (backupPath.endsWith('.gz')) {
            const tempFile = path_1.default.join(this.backupDir, `restore_${Date.now()}.db`);
            await this.decompressFile(backupPath, tempFile);
            return tempFile;
        }
        return backupPath;
    }
    async verifyBackupIntegrity(backupPath) {
        const logEntry = this.db.prepare('SELECT checksum FROM backup_log WHERE backup_path = ?').get(backupPath);
        if (logEntry) {
            const actualChecksum = await this.calculateFileChecksum(backupPath);
            if (actualChecksum !== logEntry.checksum) {
                throw new Error('Backup integrity check failed: checksum mismatch');
            }
        }
        const testFile = await this.prepareRestoreFile(backupPath);
        try {
            const testDb = new better_sqlite3_1.default(testFile, { readonly: true });
            const result = testDb.pragma('integrity_check', { simple: true });
            testDb.close();
            if (result !== 'ok') {
                throw new Error(`Backup integrity check failed: ${result}`);
            }
        }
        finally {
            if (testFile !== backupPath) {
                fs_1.default.unlinkSync(testFile);
            }
        }
    }
    async verifyRestoredDatabase() {
        const result = this.db.pragma('quick_check', { simple: true });
        if (result !== 'ok') {
            throw new Error(`Restored database integrity check failed: ${result}`);
        }
        const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' AND name IN ('kb_entries', 'kb_tags', 'kb_fts')
    `).all();
        if (tables.length < 3) {
            throw new Error('Restored database is missing essential tables');
        }
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
exports.BackupManager = BackupManager;
//# sourceMappingURL=BackupManager.js.map