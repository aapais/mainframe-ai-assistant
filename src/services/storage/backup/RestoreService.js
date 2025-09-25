'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RestoreService = void 0;
exports.calculateRestoreTime = calculateRestoreTime;
exports.getRestoreComplexity = getRestoreComplexity;
exports.formatRestoreEstimate = formatRestoreEstimate;
const tslib_1 = require('tslib');
const events_1 = require('events');
const fs_1 = tslib_1.__importDefault(require('fs'));
const crypto_1 = require('crypto');
const util_1 = require('util');
const zlib_1 = require('zlib');
const better_sqlite3_1 = tslib_1.__importDefault(require('better-sqlite3'));
const gunzipAsync = (0, util_1.promisify)(zlib_1.gunzip);
class RestoreService extends events_1.EventEmitter {
  adapter;
  config;
  activeJobs = new Map();
  completedJobs = new Map();
  constructor(adapter, config) {
    super();
    this.adapter = adapter;
    this.config = config;
    this.setMaxListeners(50);
  }
  async restore(request) {
    const jobId = request.id || this.generateJobId();
    try {
      const job = await this.createRestoreJob(jobId, request);
      this.activeJobs.set(jobId, job);
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
  async getRestoreJob(jobId) {
    return this.activeJobs.get(jobId) || this.completedJobs.get(jobId) || null;
  }
  async cancelRestore(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }
    try {
      job.status = 'cancelled';
      job.endTime = new Date();
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
  async listRestorePoints(backupId) {
    const backups = await this.getAllBackupMetadata();
    const restorePoints = [];
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
        tags: ['backup', backup.strategy],
      });
    }
    return restorePoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  async findNearestRestorePoint(targetTime) {
    const restorePoints = await this.listRestorePoints();
    const validPoints = restorePoints.filter(point => point.timestamp <= targetTime);
    if (validPoints.length === 0) {
      return null;
    }
    return validPoints.sort(
      (a, b) =>
        Math.abs(targetTime.getTime() - a.timestamp.getTime()) -
        Math.abs(targetTime.getTime() - b.timestamp.getTime())
    )[0];
  }
  async analyzeBackupChain(backupId) {
    const backup = await this.getBackupMetadata(backupId);
    if (!backup) {
      return null;
    }
    const chain = {
      fullBackup: backup.strategy === 'full' ? backup : await this.findBaseFullBackup(backup),
      incrementalBackups: [],
      totalSize: 0,
      timeSpan: {
        start: backup.timestamp,
        end: backup.timestamp,
      },
    };
    if (!chain.fullBackup) {
      throw new Error(`Cannot find base full backup for ${backupId}`);
    }
    if (backup.strategy === 'incremental') {
      chain.incrementalBackups = await this.getIncrementalChain(backup);
    } else if (backup.strategy === 'differential') {
      chain.differentialBackup = backup;
    }
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
  async restoreFromFull(backup, job) {
    this.updateProgress(job.progress, 'reading_backup', 10);
    const backupPath = await this.getBackupPath(backup.id);
    const backupData = await this.extractBackupData(backupPath);
    this.updateProgress(job.progress, 'validating', 30);
    if (job.request.includeValidation) {
      const isValid = await this.validateBackupData(backupData, backup.checksum);
      if (!isValid) {
        throw new Error('Backup data validation failed');
      }
    }
    this.updateProgress(job.progress, 'restoring', 50);
    fs_1.default.writeFileSync(job.request.destinationPath, backupData);
    this.updateProgress(job.progress, 'verifying', 80);
    await this.verifyRestoredDatabase(job.request.destinationPath);
  }
  async restoreFromIncremental(backup, job) {
    this.updateProgress(job.progress, 'analyzing_chain', 5);
    const chain = await this.getIncrementalChain(backup);
    job.backupChain = chain;
    this.updateProgress(job.progress, 'restoring_full', 10);
    const fullBackup = await this.findBaseFullBackup(backup);
    if (!fullBackup) {
      throw new Error('Cannot find base full backup for incremental restore');
    }
    const tempPath = `${job.request.destinationPath}.temp`;
    await this.restoreFullToPath(fullBackup, tempPath);
    this.updateProgress(job.progress, 'applying_incremental', 30);
    let progress = 30;
    const progressStep = 50 / chain.length;
    for (let i = 0; i < chain.length; i++) {
      const incrementalBackup = chain[i];
      await this.applyIncrementalChanges(tempPath, incrementalBackup);
      progress += progressStep;
      this.updateProgress(job.progress, `applying_incremental_${i + 1}`, progress);
    }
    this.updateProgress(job.progress, 'finalizing', 90);
    fs_1.default.renameSync(tempPath, job.request.destinationPath);
  }
  async restoreFromDifferential(backup, job) {
    this.updateProgress(job.progress, 'finding_full_backup', 10);
    const fullBackup = await this.findBaseFullBackup(backup);
    if (!fullBackup) {
      throw new Error('Cannot find base full backup for differential restore');
    }
    job.backupChain = [fullBackup, backup];
    this.updateProgress(job.progress, 'restoring_full', 20);
    const tempPath = `${job.request.destinationPath}.temp`;
    await this.restoreFullToPath(fullBackup, tempPath);
    this.updateProgress(job.progress, 'applying_differential', 60);
    await this.applyDifferentialChanges(tempPath, backup);
    this.updateProgress(job.progress, 'finalizing', 90);
    fs_1.default.renameSync(tempPath, job.request.destinationPath);
  }
  async validateRestore(job) {
    const startTime = Date.now();
    const result = {
      success: true,
      checksumValid: true,
      schemaValid: true,
      dataIntegrityValid: true,
      tableCount: 0,
      recordCount: 0,
      issues: [],
      performance: {
        validationTime: 0,
        avgQueryTime: 0,
      },
    };
    try {
      if (!job.restoredPath || !fs_1.default.existsSync(job.restoredPath)) {
        result.success = false;
        result.issues.push('Restored file does not exist');
        return result;
      }
      const db = new better_sqlite3_1.default(job.restoredPath, { readonly: true });
      try {
        const schemaValidation = await this.validateSchema(db);
        result.schemaValid = schemaValidation.valid;
        if (!schemaValidation.valid) {
          result.issues.push(...schemaValidation.issues);
        }
        const tables = await this.getTableNames(db);
        result.tableCount = tables.length;
        let totalRecords = 0;
        const queryTimes = [];
        for (const table of tables) {
          const queryStart = Date.now();
          try {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
            totalRecords += count.count;
            queryTimes.push(Date.now() - queryStart);
            const integrityCheck = db.prepare(`PRAGMA integrity_check`).get();
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
        result.performance.avgQueryTime =
          queryTimes.length > 0
            ? queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length
            : 0;
        if (job.backupChain && job.backupChain.length > 0) {
          const expectedEntryCount = job.backupChain[job.backupChain.length - 1].entryCount;
          try {
            const actualEntryCount = db.prepare('SELECT COUNT(*) as count FROM kb_entries').get();
            if (actualEntryCount.count !== expectedEntryCount) {
              result.issues.push(
                `Entry count mismatch: expected ${expectedEntryCount}, got ${actualEntryCount.count}`
              );
            }
          } catch {}
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
  async validateSchema(db) {
    const issues = [];
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      if (tables.length === 0) {
        issues.push('No tables found in restored database');
      }
      const kbTable = tables.find(t => t.name === 'kb_entries');
      if (!kbTable) {
        issues.push('Core kb_entries table missing');
      }
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
      issues,
    };
  }
  generateJobId() {
    return (0, crypto_1.createHash)('sha256')
      .update(`${Date.now()}-${Math.random()}-restore`)
      .digest('hex')
      .substring(0, 16);
  }
  async createRestoreJob(jobId, request) {
    const job = {
      id: jobId,
      request,
      status: 'pending',
      progress: {
        phase: 'initializing',
        percentage: 0,
        tablesProcessed: 0,
        totalTables: 0,
        bytesProcessed: 0,
        totalBytes: 0,
      },
    };
    await this.validateRestoreRequest(request);
    return job;
  }
  async validateRestoreRequest(request) {
    if (!request.backupId && !request.backupPath) {
      throw new Error('Either backupId or backupPath must be specified');
    }
    if (!request.destinationPath) {
      throw new Error('Destination path is required');
    }
    if (fs_1.default.existsSync(request.destinationPath) && !request.overwriteExisting) {
      throw new Error('Destination file exists and overwrite is not enabled');
    }
    if (request.backupId) {
      const backup = await this.getBackupMetadata(request.backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${request.backupId}`);
      }
    }
    if (request.backupPath && !fs_1.default.existsSync(request.backupPath)) {
      throw new Error(`Backup file not found: ${request.backupPath}`);
    }
  }
  async executeRestoreJob(job) {
    try {
      job.status = 'running';
      job.startTime = new Date();
      this.emit('restore:progress', job);
      let backup;
      if (job.request.backupId) {
        backup = await this.getBackupMetadata(job.request.backupId);
        if (!backup) {
          throw new Error(`Backup not found: ${job.request.backupId}`);
        }
      } else {
        backup = await this.extractBackupMetadata(job.request.backupPath);
      }
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
      job.metrics = this.calculateRestoreMetrics(job);
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
  updateProgress(progress, phase, percentage, currentTable) {
    progress.phase = phase;
    progress.percentage = Math.min(100, Math.max(0, percentage));
    if (currentTable) {
      progress.currentTable = currentTable;
    }
  }
  async extractBackupData(backupPath) {
    let data = fs_1.default.readFileSync(backupPath);
    if (backupPath.endsWith('.gz')) {
      data = await gunzipAsync(data);
    }
    const content = data.toString('utf-8');
    if (content.includes('---BACKUP-DATA-SEPARATOR---')) {
      const parts = content.split('---BACKUP-DATA-SEPARATOR---');
      if (parts.length === 2) {
        return Buffer.from(parts[1], 'binary');
      }
    }
    return data;
  }
  async extractBackupMetadata(backupPath) {
    let data = fs_1.default.readFileSync(backupPath);
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
  async validateBackupData(data, expectedChecksum) {
    const actualChecksum = (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    return actualChecksum === expectedChecksum;
  }
  async verifyRestoredDatabase(dbPath) {
    try {
      const db = new better_sqlite3_1.default(dbPath, { readonly: true });
      const result = db.prepare('PRAGMA integrity_check').get();
      if (result.integrity_check !== 'ok') {
        throw new Error('Database integrity check failed');
      }
      db.close();
    } catch (error) {
      throw new Error(`Database verification failed: ${error.message}`);
    }
  }
  async getBackupMetadata(backupId) {
    return null;
  }
  async getAllBackupMetadata() {
    return [];
  }
  async getBackupPath(backupId) {
    throw new Error('Not implemented');
  }
  async findBaseFullBackup(backup) {
    if (backup.strategy === 'full') {
      return backup;
    }
    if (!backup.dependencies || backup.dependencies.length === 0) {
      return null;
    }
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
  async getIncrementalChain(backup) {
    const chain = [];
    let current = backup;
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
  async restoreFullToPath(backup, path) {
    const backupPath = await this.getBackupPath(backup.id);
    const data = await this.extractBackupData(backupPath);
    fs_1.default.writeFileSync(path, data);
  }
  async applyIncrementalChanges(dbPath, backup) {
    const backupPath = await this.getBackupPath(backup.id);
    const deltaData = await this.extractBackupData(backupPath);
    const delta = JSON.parse(deltaData.toString('utf-8'));
    const db = new better_sqlite3_1.default(dbPath);
    try {
      const applyChanges = db.transaction(() => {
        for (const deletion of delta.deleted) {
          for (const id of deletion.ids) {
            db.prepare(`DELETE FROM ${deletion.table} WHERE id = ?`).run(id);
          }
        }
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
  async applyDifferentialChanges(dbPath, backup) {
    await this.applyIncrementalChanges(dbPath, backup);
  }
  async getTableNames(db) {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    return tables.map(t => t.name);
  }
  calculateRestoreMetrics(job) {
    const totalDuration =
      job.endTime && job.startTime ? job.endTime.getTime() - job.startTime.getTime() : 0;
    return {
      totalDuration,
      preparationTime: 0,
      restoreTime: totalDuration,
      validationTime: job.validationResult?.performance.validationTime || 0,
      dataSize: 0,
      tablesRestored: job.progress.totalTables,
      recordsRestored: job.validationResult?.recordCount || 0,
    };
  }
  async cleanupPartialRestore(job) {
    const tempFiles = [`${job.request.destinationPath}.temp`, job.request.destinationPath];
    for (const file of tempFiles) {
      if (fs_1.default.existsSync(file)) {
        try {
          fs_1.default.unlinkSync(file);
          console.log(`🧹 Cleaned up partial restore: ${file}`);
        } catch (error) {
          console.warn(`⚠️ Failed to cleanup file: ${file}`, error);
        }
      }
    }
  }
}
exports.RestoreService = RestoreService;
function calculateRestoreTime(backupChain) {
  const factors = [];
  let estimatedSeconds = 0;
  const fullBackupTime = Math.max(backupChain.fullBackup.size / (1024 * 1024), 30);
  estimatedSeconds += fullBackupTime;
  factors.push(`Full backup: ${fullBackupTime.toFixed(1)}s`);
  if (backupChain.incrementalBackups.length > 0) {
    const incrementalTime = backupChain.incrementalBackups.reduce(
      (sum, backup) => sum + Math.max(backup.size / (1024 * 1024 * 2), 5),
      0
    );
    estimatedSeconds += incrementalTime;
    factors.push(`Incremental backups: ${incrementalTime.toFixed(1)}s`);
  }
  if (backupChain.differentialBackup) {
    const diffTime = Math.max(backupChain.differentialBackup.size / (1024 * 1024 * 1.5), 10);
    estimatedSeconds += diffTime;
    factors.push(`Differential backup: ${diffTime.toFixed(1)}s`);
  }
  const overheadTime = estimatedSeconds * 0.2;
  estimatedSeconds += overheadTime;
  factors.push(`Validation overhead: ${overheadTime.toFixed(1)}s`);
  return {
    estimated: Math.round(estimatedSeconds),
    factors,
  };
}
function getRestoreComplexity(backupChain) {
  const chainLength = backupChain.incrementalBackups.length;
  const hasLargeDifferential =
    backupChain.differentialBackup && backupChain.differentialBackup.size > 100 * 1024 * 1024;
  if (chainLength === 0 && !hasLargeDifferential) {
    return 'simple';
  }
  if (chainLength <= 5 && !hasLargeDifferential) {
    return 'moderate';
  }
  return 'complex';
}
function formatRestoreEstimate(timeSeconds) {
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
//# sourceMappingURL=RestoreService.js.map
