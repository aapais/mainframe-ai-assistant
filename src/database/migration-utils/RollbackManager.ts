import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface RollbackPoint {
  id: string;
  version: number;
  createdAt: Date;
  backupPath?: string;
  description: string;
  rollbackSql: string;
  checksum: string;
}

export interface RollbackResult {
  success: boolean;
  rolledBackToVersion: number;
  stepsExecuted: number;
  errors: string[];
  warnings: string[];
  duration: number;
}

export class RollbackManager extends EventEmitter {
  private db: Database.Database;
  private rollbackPoints: Map<number, RollbackPoint> = new Map();

  constructor(db: Database.Database) {
    super();
    this.db = db;
    this.loadRollbackPoints();
  }

  /**
   * Create a rollback point before migration
   */
  async createRollbackPoint(
    version: number,
    description: string,
    rollbackSql?: string
  ): Promise<string> {
    const rollbackId = `rollback_${version}_${Date.now()}`;
    const backupPath = await this.createDatabaseBackup(version);

    const rollbackPoint: RollbackPoint = {
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

  /**
   * Execute rollback to a specific version
   */
  async rollbackToVersion(targetVersion: number): Promise<RollbackResult> {
    const startTime = Date.now();
    const result: RollbackResult = {
      success: false,
      rolledBackToVersion: this.getCurrentVersion(),
      stepsExecuted: 0,
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      this.emit('rollbackStarted', { targetVersion });

      // Get rollback points to execute
      const rollbackSteps = this.getRollbackSteps(targetVersion);

      if (rollbackSteps.length === 0) {
        throw new Error(`No rollback path found to version ${targetVersion}`);
      }

      // Execute rollback steps in reverse order
      for (const step of rollbackSteps) {
        this.emit('rollbackStepStarted', { version: step.version, description: step.description });

        try {
          await this.executeRollbackStep(step);
          result.stepsExecuted++;

          this.emit('rollbackStepCompleted', { version: step.version });
        } catch (error) {
          result.errors.push(`Rollback step ${step.version} failed: ${error.message}`);

          // Try to restore from backup if SQL rollback failed
          if (step.backupPath && fs.existsSync(step.backupPath)) {
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

  /**
   * Rollback a single migration
   */
  async rollbackMigration(version: number): Promise<RollbackResult> {
    const startTime = Date.now();
    const result: RollbackResult = {
      success: false,
      rolledBackToVersion: this.getCurrentVersion(),
      stepsExecuted: 0,
      errors: [],
      warnings: [],
      duration: 0,
    };

    try {
      // Get rollback SQL from migration record
      const rollbackSql = this.db
        .prepare(
          `
        SELECT rollback_sql FROM schema_migrations WHERE version = ?
      `
        )
        .get(version) as { rollback_sql: string } | undefined;

      if (!rollbackSql?.rollback_sql) {
        throw new Error(`No rollback SQL found for migration ${version}`);
      }

      // Create rollback point before execution
      await this.createRollbackPoint(version, `Pre-rollback of migration ${version}`);

      // Execute rollback SQL
      this.db.transaction(() => {
        this.db.exec(rollbackSql.rollback_sql);

        // Remove migration record
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

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    this.emit('restoreStarted', { backupPath });

    try {
      // Close current database connection
      this.db.close();

      // Replace database with backup
      const currentDbPath = this.db.name;
      fs.copyFileSync(backupPath, currentDbPath);

      // Reopen database
      this.db = new Database(currentDbPath);

      this.emit('restoreCompleted', { backupPath });
    } catch (error) {
      this.emit('restoreFailed', { backupPath, error: error.message });
      throw error;
    }
  }

  /**
   * Validate rollback capability
   */
  async validateRollbackCapability(
    fromVersion: number,
    toVersion: number
  ): Promise<{
    canRollback: boolean;
    missingRollbackSql: number[];
    missingBackups: number[];
    warnings: string[];
  }> {
    const result = {
      canRollback: true,
      missingRollbackSql: [] as number[],
      missingBackups: [] as number[],
      warnings: [] as string[],
    };

    // Check each version between fromVersion and toVersion
    for (let version = fromVersion; version > toVersion; version--) {
      // Check rollback SQL
      const migration = this.db
        .prepare(
          `
        SELECT rollback_sql FROM schema_migrations WHERE version = ?
      `
        )
        .get(version) as { rollback_sql: string } | undefined;

      if (!migration?.rollback_sql || migration.rollback_sql.trim() === '') {
        result.missingRollbackSql.push(version);
        result.canRollback = false;
      }

      // Check backup existence
      const rollbackPoint = this.rollbackPoints.get(version);
      if (rollbackPoint?.backupPath && !fs.existsSync(rollbackPoint.backupPath)) {
        result.missingBackups.push(version);
        result.warnings.push(`Backup missing for version ${version}: ${rollbackPoint.backupPath}`);
      }
    }

    return result;
  }

  /**
   * List available rollback points
   */
  getAvailableRollbackPoints(): RollbackPoint[] {
    return Array.from(this.rollbackPoints.values()).sort((a, b) => b.version - a.version);
  }

  /**
   * Clean old rollback points and backups
   */
  async cleanupOldRollbackPoints(retentionDays: number = 30): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = {
      cleaned: 0,
      errors: [] as string[],
    };

    for (const [version, rollbackPoint] of this.rollbackPoints.entries()) {
      if (rollbackPoint.createdAt < cutoffDate) {
        try {
          // Remove backup file if exists
          if (rollbackPoint.backupPath && fs.existsSync(rollbackPoint.backupPath)) {
            fs.unlinkSync(rollbackPoint.backupPath);
          }

          // Remove from database
          await this.removeRollbackPoint(rollbackPoint.id);

          // Remove from memory
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

  /**
   * Test rollback on a copy of the database
   */
  async testRollback(
    fromVersion: number,
    toVersion: number
  ): Promise<{
    success: boolean;
    steps: number;
    duration: number;
    errors: string[];
  }> {
    // Create temporary database copy
    const tempDbPath = path.join(path.dirname(this.db.name), `test_rollback_${Date.now()}.db`);
    fs.copyFileSync(this.db.name, tempDbPath);

    const result = {
      success: false,
      steps: 0,
      duration: 0,
      errors: [] as string[],
    };

    try {
      // Open temporary database
      const tempDb = new Database(tempDbPath);
      const tempRollbackManager = new RollbackManager(tempDb);

      // Copy rollback points
      tempRollbackManager.rollbackPoints = new Map(this.rollbackPoints);

      // Execute test rollback
      const rollbackResult = await tempRollbackManager.rollbackToVersion(toVersion);

      result.success = rollbackResult.success;
      result.steps = rollbackResult.stepsExecuted;
      result.duration = rollbackResult.duration;
      result.errors = rollbackResult.errors;

      tempDb.close();
    } catch (error) {
      result.errors.push(`Test rollback failed: ${error.message}`);
    } finally {
      // Cleanup temporary database
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    }

    return result;
  }

  // Private methods

  private loadRollbackPoints(): void {
    try {
      // Ensure rollback_points table exists
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

      // Load existing rollback points
      const points = this.db
        .prepare(
          `
        SELECT * FROM rollback_points ORDER BY version DESC
      `
        )
        .all() as any[];

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

  private async saveRollbackPoint(rollbackPoint: RollbackPoint): Promise<void> {
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

  private async removeRollbackPoint(rollbackId: string): Promise<void> {
    this.db.prepare(`DELETE FROM rollback_points WHERE id = ?`).run(rollbackId);
  }

  private async createDatabaseBackup(version: number): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      path.dirname(this.db.name),
      `rollback_backup_v${version}_${timestamp}.db`
    );

    this.db.backup(backupPath);

    // Record backup in log table
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

  private getRollbackSteps(targetVersion: number): RollbackPoint[] {
    const currentVersion = this.getCurrentVersion();
    const steps: RollbackPoint[] = [];

    for (let version = currentVersion; version > targetVersion; version--) {
      const rollbackPoint = this.rollbackPoints.get(version);
      if (rollbackPoint) {
        steps.push(rollbackPoint);
      } else {
        // Create rollback point from migration record if not exists
        const migration = this.db
          .prepare(
            `
          SELECT rollback_sql, description FROM schema_migrations WHERE version = ?
        `
          )
          .get(version) as { rollback_sql: string; description: string } | undefined;

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

  private async executeRollbackStep(step: RollbackPoint): Promise<void> {
    if (!step.rollbackSql || step.rollbackSql.trim() === '') {
      throw new Error(`No rollback SQL available for version ${step.version}`);
    }

    this.db.transaction(() => {
      try {
        // Execute rollback SQL
        this.db.exec(step.rollbackSql);

        // Remove migration record
        this.db.prepare(`DELETE FROM schema_migrations WHERE version = ?`).run(step.version);
      } catch (error) {
        throw new Error(
          `Rollback SQL execution failed for version ${step.version}: ${error.message}`
        );
      }
    })();
  }

  private getCurrentVersion(): number {
    const result = this.db
      .prepare(
        `
      SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations
    `
      )
      .get() as { version: number };

    return result.version;
  }

  private calculateDatabaseChecksum(): string {
    // Simple checksum based on schema and key data
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');

      // Hash schema
      const schema = this.db
        .prepare(
          `
        SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name
      `
        )
        .all()
        .map((row: any) => row.sql)
        .join('');
      hash.update(schema);

      // Hash critical data counts
      const tables = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `
        )
        .all() as Array<{ name: string }>;

      for (const table of tables) {
        const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as {
          count: number;
        };
        hash.update(`${table.name}:${count.count}`);
      }

      return hash.digest('hex');
    } catch (error) {
      return 'checksum_error';
    }
  }

  /**
   * Get rollback statistics
   */
  getRollbackStatistics(): {
    totalRollbackPoints: number;
    oldestRollbackPoint?: Date;
    newestRollbackPoint?: Date;
    totalBackupSize: number;
    versionsWithRollback: number[];
    versionsWithoutRollback: number[];
  } {
    const points = Array.from(this.rollbackPoints.values());

    // Get all migration versions
    const migrations = this.db
      .prepare(
        `
      SELECT version FROM schema_migrations ORDER BY version
    `
      )
      .all() as Array<{ version: number }>;

    const allVersions = migrations.map(m => m.version);
    const versionsWithRollback = points.map(p => p.version);
    const versionsWithoutRollback = allVersions.filter(v => !versionsWithRollback.includes(v));

    // Calculate backup sizes
    let totalBackupSize = 0;
    for (const point of points) {
      if (point.backupPath && fs.existsSync(point.backupPath)) {
        try {
          const stats = fs.statSync(point.backupPath);
          totalBackupSize += stats.size;
        } catch (error) {
          // Ignore file access errors
        }
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
