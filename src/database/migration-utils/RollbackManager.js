'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RollbackManager = void 0;
const tslib_1 = require('tslib');
const better_sqlite3_1 = tslib_1.__importDefault(require('better-sqlite3'));
const events_1 = require('events');
const fs_1 = tslib_1.__importDefault(require('fs'));
const path_1 = tslib_1.__importDefault(require('path'));
class RollbackManager extends events_1.EventEmitter {
  db;
  rollbackPoints = new Map();
  constructor(db) {
    super();
    this.db = db;
    this.loadRollbackPoints();
  }
  async createRollbackPoint(version, description, rollbackSql) {
    const rollbackId = `rollback_${version}_${Date.now()}`;
    const backupPath = await this.createDatabaseBackup(version);
    const rollbackPoint = {
      id: rollbackId,
      version,
      createdAt: new Date(),
      backupPath,
      description,
      rollbackSql: rollbackSql || '',
      checksum: this.calculateDatabaseChecksum(),
    };
    this.rollbackPoints.set(version, rollbackPoint);
    await this.saveRollbackPoint(rollbackPoint);
    this.emit('rollbackPointCreated', { rollbackId, version, backupPath });
    return rollbackId;
  }
  async rollbackToVersion(targetVersion) {
    const startTime = Date.now();
    const result = {
      success: false,
      rolledBackToVersion: this.getCurrentVersion(),
      stepsExecuted: 0,
      errors: [],
      warnings: [],
      duration: 0,
    };
    try {
      this.emit('rollbackStarted', { targetVersion });
      const rollbackSteps = this.getRollbackSteps(targetVersion);
      if (rollbackSteps.length === 0) {
        throw new Error(`No rollback path found to version ${targetVersion}`);
      }
      for (const step of rollbackSteps) {
        this.emit('rollbackStepStarted', { version: step.version, description: step.description });
        try {
          await this.executeRollbackStep(step);
          result.stepsExecuted++;
          this.emit('rollbackStepCompleted', { version: step.version });
        } catch (error) {
          result.errors.push(`Rollback step ${step.version} failed: ${error.message}`);
          if (step.backupPath && fs_1.default.existsSync(step.backupPath)) {
            result.warnings.push(
              `SQL rollback failed for version ${step.version}, attempting backup restore`
            );
            await this.restoreFromBackup(step.backupPath);
            result.stepsExecuted++;
          } else {
            throw error;
          }
        }
      }
      result.success = true;
      result.rolledBackToVersion = targetVersion;
      this.emit('rollbackCompleted', { targetVersion, stepsExecuted: result.stepsExecuted });
    } catch (error) {
      result.errors.push(`Rollback failed: ${error.message}`);
      this.emit('rollbackFailed', { error: error.message, result });
    }
    result.duration = Date.now() - startTime;
    return result;
  }
  async rollbackMigration(version) {
    const startTime = Date.now();
    const result = {
      success: false,
      rolledBackToVersion: this.getCurrentVersion(),
      stepsExecuted: 0,
      errors: [],
      warnings: [],
      duration: 0,
    };
    try {
      const rollbackSql = this.db
        .prepare(
          `
        SELECT rollback_sql FROM schema_migrations WHERE version = ?
      `
        )
        .get(version);
      if (!rollbackSql?.rollback_sql) {
        throw new Error(`No rollback SQL found for migration ${version}`);
      }
      await this.createRollbackPoint(version, `Pre-rollback of migration ${version}`);
      this.db.transaction(() => {
        this.db.exec(rollbackSql.rollback_sql);
        this.db.prepare(`DELETE FROM schema_migrations WHERE version = ?`).run(version);
      })();
      result.success = true;
      result.stepsExecuted = 1;
      result.rolledBackToVersion = version - 1;
    } catch (error) {
      result.errors.push(`Single migration rollback failed: ${error.message}`);
    }
    result.duration = Date.now() - startTime;
    return result;
  }
  async restoreFromBackup(backupPath) {
    if (!fs_1.default.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    this.emit('restoreStarted', { backupPath });
    try {
      this.db.close();
      const currentDbPath = this.db.name;
      fs_1.default.copyFileSync(backupPath, currentDbPath);
      this.db = new better_sqlite3_1.default(currentDbPath);
      this.emit('restoreCompleted', { backupPath });
    } catch (error) {
      this.emit('restoreFailed', { backupPath, error: error.message });
      throw error;
    }
  }
  async validateRollbackCapability(fromVersion, toVersion) {
    const result = {
      canRollback: true,
      missingRollbackSql: [],
      missingBackups: [],
      warnings: [],
    };
    for (let version = fromVersion; version > toVersion; version--) {
      const migration = this.db
        .prepare(
          `
        SELECT rollback_sql FROM schema_migrations WHERE version = ?
      `
        )
        .get(version);
      if (!migration?.rollback_sql || migration.rollback_sql.trim() === '') {
        result.missingRollbackSql.push(version);
        result.canRollback = false;
      }
      const rollbackPoint = this.rollbackPoints.get(version);
      if (rollbackPoint?.backupPath && !fs_1.default.existsSync(rollbackPoint.backupPath)) {
        result.missingBackups.push(version);
        result.warnings.push(`Backup missing for version ${version}: ${rollbackPoint.backupPath}`);
      }
    }
    return result;
  }
  getAvailableRollbackPoints() {
    return Array.from(this.rollbackPoints.values()).sort((a, b) => b.version - a.version);
  }
  async cleanupOldRollbackPoints(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const result = {
      cleaned: 0,
      errors: [],
    };
    for (const [version, rollbackPoint] of this.rollbackPoints.entries()) {
      if (rollbackPoint.createdAt < cutoffDate) {
        try {
          if (rollbackPoint.backupPath && fs_1.default.existsSync(rollbackPoint.backupPath)) {
            fs_1.default.unlinkSync(rollbackPoint.backupPath);
          }
          await this.removeRollbackPoint(rollbackPoint.id);
          this.rollbackPoints.delete(version);
          result.cleaned++;
        } catch (error) {
          result.errors.push(
            `Failed to cleanup rollback point ${rollbackPoint.id}: ${error.message}`
          );
        }
      }
    }
    this.emit('rollbackPointsCleaned', { cleaned: result.cleaned, errors: result.errors });
    return result;
  }
  async testRollback(fromVersion, toVersion) {
    const tempDbPath = path_1.default.join(
      path_1.default.dirname(this.db.name),
      `test_rollback_${Date.now()}.db`
    );
    fs_1.default.copyFileSync(this.db.name, tempDbPath);
    const result = {
      success: false,
      steps: 0,
      duration: 0,
      errors: [],
    };
    try {
      const tempDb = new better_sqlite3_1.default(tempDbPath);
      const tempRollbackManager = new RollbackManager(tempDb);
      tempRollbackManager.rollbackPoints = new Map(this.rollbackPoints);
      const rollbackResult = await tempRollbackManager.rollbackToVersion(toVersion);
      result.success = rollbackResult.success;
      result.steps = rollbackResult.stepsExecuted;
      result.duration = rollbackResult.duration;
      result.errors = rollbackResult.errors;
      tempDb.close();
    } catch (error) {
      result.errors.push(`Test rollback failed: ${error.message}`);
    } finally {
      if (fs_1.default.existsSync(tempDbPath)) {
        fs_1.default.unlinkSync(tempDbPath);
      }
    }
    return result;
  }
  loadRollbackPoints() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS rollback_points (
          id TEXT PRIMARY KEY,
          version INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          backup_path TEXT,
          description TEXT,
          rollback_sql TEXT,
          checksum TEXT
        )
      `);
      const points = this.db
        .prepare(
          `
        SELECT * FROM rollback_points ORDER BY version DESC
      `
        )
        .all();
      for (const point of points) {
        this.rollbackPoints.set(point.version, {
          id: point.id,
          version: point.version,
          createdAt: new Date(point.created_at),
          backupPath: point.backup_path,
          description: point.description,
          rollbackSql: point.rollback_sql,
          checksum: point.checksum,
        });
      }
    } catch (error) {
      console.warn('Failed to load rollback points:', error.message);
    }
  }
  async saveRollbackPoint(rollbackPoint) {
    this.db
      .prepare(
        `
      INSERT INTO rollback_points (id, version, backup_path, description, rollback_sql, checksum)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        rollbackPoint.id,
        rollbackPoint.version,
        rollbackPoint.backupPath,
        rollbackPoint.description,
        rollbackPoint.rollbackSql,
        rollbackPoint.checksum
      );
  }
  async removeRollbackPoint(rollbackId) {
    this.db.prepare(`DELETE FROM rollback_points WHERE id = ?`).run(rollbackId);
  }
  async createDatabaseBackup(version) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path_1.default.join(
      path_1.default.dirname(this.db.name),
      `rollback_backup_v${version}_${timestamp}.db`
    );
    this.db.backup(backupPath);
    this.db
      .prepare(
        `
      INSERT INTO backup_log (backup_path, backup_type, entries_count)
      VALUES (?, 'rollback', (SELECT COUNT(*) FROM kb_entries))
    `
      )
      .run(backupPath);
    return backupPath;
  }
  getRollbackSteps(targetVersion) {
    const currentVersion = this.getCurrentVersion();
    const steps = [];
    for (let version = currentVersion; version > targetVersion; version--) {
      const rollbackPoint = this.rollbackPoints.get(version);
      if (rollbackPoint) {
        steps.push(rollbackPoint);
      } else {
        const migration = this.db
          .prepare(
            `
          SELECT rollback_sql, description FROM schema_migrations WHERE version = ?
        `
          )
          .get(version);
        if (migration?.rollback_sql) {
          steps.push({
            id: `auto_${version}_${Date.now()}`,
            version,
            createdAt: new Date(),
            description: migration.description || `Auto-rollback for migration ${version}`,
            rollbackSql: migration.rollback_sql,
            checksum: '',
          });
        }
      }
    }
    return steps;
  }
  async executeRollbackStep(step) {
    if (!step.rollbackSql || step.rollbackSql.trim() === '') {
      throw new Error(`No rollback SQL available for version ${step.version}`);
    }
    this.db.transaction(() => {
      try {
        this.db.exec(step.rollbackSql);
        this.db.prepare(`DELETE FROM schema_migrations WHERE version = ?`).run(step.version);
      } catch (error) {
        throw new Error(
          `Rollback SQL execution failed for version ${step.version}: ${error.message}`
        );
      }
    })();
  }
  getCurrentVersion() {
    const result = this.db
      .prepare(
        `
      SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations
    `
      )
      .get();
    return result.version;
  }
  calculateDatabaseChecksum() {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      const schema = this.db
        .prepare(
          `
        SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name
      `
        )
        .all()
        .map(row => row.sql)
        .join('');
      hash.update(schema);
      const tables = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `
        )
        .all();
      for (const table of tables) {
        const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        hash.update(`${table.name}:${count.count}`);
      }
      return hash.digest('hex');
    } catch (error) {
      return 'checksum_error';
    }
  }
  getRollbackStatistics() {
    const points = Array.from(this.rollbackPoints.values());
    const migrations = this.db
      .prepare(
        `
      SELECT version FROM schema_migrations ORDER BY version
    `
      )
      .all();
    const allVersions = migrations.map(m => m.version);
    const versionsWithRollback = points.map(p => p.version);
    const versionsWithoutRollback = allVersions.filter(v => !versionsWithRollback.includes(v));
    let totalBackupSize = 0;
    for (const point of points) {
      if (point.backupPath && fs_1.default.existsSync(point.backupPath)) {
        try {
          const stats = fs_1.default.statSync(point.backupPath);
          totalBackupSize += stats.size;
        } catch (error) {}
      }
    }
    return {
      totalRollbackPoints: points.length,
      oldestRollbackPoint:
        points.length > 0
          ? new Date(Math.min(...points.map(p => p.createdAt.getTime())))
          : undefined,
      newestRollbackPoint:
        points.length > 0
          ? new Date(Math.max(...points.map(p => p.createdAt.getTime())))
          : undefined,
      totalBackupSize,
      versionsWithRollback: versionsWithRollback.sort((a, b) => a - b),
      versionsWithoutRollback: versionsWithoutRollback.sort((a, b) => a - b),
    };
  }
}
exports.RollbackManager = RollbackManager;
//# sourceMappingURL=RollbackManager.js.map
