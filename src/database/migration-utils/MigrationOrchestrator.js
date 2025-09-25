'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MigrationOrchestrator = void 0;
const tslib_1 = require('tslib');
const events_1 = require('events');
const MigrationManager_1 = require('../MigrationManager');
const DataTransformer_1 = require('./DataTransformer');
const MigrationValidator_1 = require('./MigrationValidator');
const RollbackManager_1 = require('./RollbackManager');
const ProgressTracker_1 = require('./ProgressTracker');
const fs_1 = tslib_1.__importDefault(require('fs'));
const path_1 = tslib_1.__importDefault(require('path'));
class MigrationOrchestrator extends events_1.EventEmitter {
  db;
  migrationManager;
  dataTransformer;
  validator;
  rollbackManager;
  progressTracker;
  currentProgress;
  constructor(db, migrationsPath = './src/database/migrations/mvp-upgrades') {
    super();
    this.db = db;
    this.migrationManager = new MigrationManager_1.MigrationManager(db, migrationsPath);
    this.dataTransformer = new DataTransformer_1.DataTransformer(db);
    this.validator = new MigrationValidator_1.MigrationValidator(db);
    this.rollbackManager = new RollbackManager_1.RollbackManager(db);
    this.progressTracker = new ProgressTracker_1.ProgressTracker();
  }
  async createMigrationPlan(targetVersion) {
    const currentVersion = this.migrationManager.getCurrentVersion();
    if (targetVersion <= currentVersion) {
      throw new Error(
        `Target version ${targetVersion} must be greater than current version ${currentVersion}`
      );
    }
    const migrations = await this.loadMigrationsForPlan(currentVersion, targetVersion);
    const plan = {
      currentVersion,
      targetVersion,
      migrations,
      estimatedDuration: this.estimateMigrationDuration(migrations),
      riskLevel: this.assessRiskLevel(migrations),
      requiresDowntime: this.assessDowntimeRequirement(migrations),
      rollbackPlan: this.generateRollbackPlan(migrations),
    };
    const validationResult = await this.validator.validateMigrationPlan(plan);
    if (!validationResult.isValid) {
      throw new Error(`Migration plan validation failed: ${validationResult.errors.join(', ')}`);
    }
    return plan;
  }
  async executeMigrationPlan(plan, options = {}) {
    if (options.dryRun) {
      return this.executeDryRun(plan);
    }
    this.currentProgress = {
      currentStep: 0,
      totalSteps: plan.migrations.length,
      status: 'running',
      startTime: new Date(),
      errors: [],
      warnings: [],
    };
    this.emit('migrationStarted', this.currentProgress);
    this.progressTracker.start(plan.migrations.length);
    const results = [];
    let rollbackRequired = false;
    try {
      await this.createPreMigrationBackup(plan);
      for (let i = 0; i < plan.migrations.length; i++) {
        const migration = plan.migrations[i];
        this.currentProgress.currentStep = i + 1;
        this.currentProgress.currentMigration = migration.version;
        this.emit('migrationStepStarted', {
          step: i + 1,
          migration: migration.version,
          description: migration.description,
        });
        const preValidation = await this.validator.validatePreMigration(migration);
        if (!preValidation.isValid) {
          this.currentProgress.errors.push(
            `Pre-migration validation failed for ${migration.version}: ${preValidation.errors.join(', ')}`
          );
          throw new Error(`Pre-migration validation failed for ${migration.version}`);
        }
        const result = await this.executeMigrationWithRetries(migration, options.maxRetries || 3);
        results.push(result);
        if (!result.success) {
          rollbackRequired = true;
          break;
        }
        const postValidation = await this.validator.validatePostMigration(migration);
        if (!postValidation.isValid) {
          this.currentProgress.errors.push(
            `Post-migration validation failed for ${migration.version}: ${postValidation.errors.join(', ')}`
          );
          if (!options.continueOnWarning) {
            rollbackRequired = true;
            break;
          }
        }
        this.progressTracker.updateProgress(i + 1);
        this.emit('migrationStepCompleted', {
          step: i + 1,
          migration: migration.version,
          success: result.success,
          duration: result.duration,
        });
        if (options.pauseBetweenSteps) {
          await this.sleep(options.pauseBetweenSteps);
        }
      }
      if (rollbackRequired) {
        this.currentProgress.status = 'failed';
        await this.executeRollback(results);
        this.currentProgress.status = 'rolled_back';
      } else {
        this.currentProgress.status = 'completed';
        this.emit('migrationCompleted', {
          totalMigrations: results.length,
          totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
          success: true,
        });
      }
    } catch (error) {
      this.currentProgress.status = 'failed';
      this.currentProgress.errors.push(error.message);
      if (results.length > 0) {
        await this.executeRollback(results);
        this.currentProgress.status = 'rolled_back';
      }
      this.emit('migrationFailed', {
        error: error.message,
        rollbackPerformed: results.length > 0,
      });
      throw error;
    } finally {
      this.progressTracker.finish();
    }
    return results;
  }
  getCurrentProgress() {
    return this.currentProgress;
  }
  async analyzeUpgradePath() {
    const currentVersion = this.migrationManager.getCurrentVersion();
    const allMigrations = await this.loadAllMigrations();
    const latestVersion = Math.max(...allMigrations.map(m => m.version));
    const pendingMigrations = allMigrations.filter(m => m.version > currentVersion);
    let recommendedAction = 'No action required';
    const warnings = [];
    if (pendingMigrations.length > 0) {
      if (pendingMigrations.length === 1) {
        recommendedAction = `Upgrade to version ${pendingMigrations[0].version}`;
      } else {
        recommendedAction = `Upgrade through ${pendingMigrations.length} versions to ${latestVersion}`;
      }
      const highRiskMigrations = pendingMigrations.filter(
        m =>
          m.description.toLowerCase().includes('breaking') ||
          m.description.toLowerCase().includes('major')
      );
      if (highRiskMigrations.length > 0) {
        warnings.push(
          `${highRiskMigrations.length} high-risk migrations detected - backup recommended`
        );
      }
      const versionGaps = this.findVersionGaps(pendingMigrations);
      if (versionGaps.length > 0) {
        warnings.push(
          `Version gaps detected: ${versionGaps.join(', ')} - review migration sequence`
        );
      }
    }
    return {
      currentVersion,
      latestVersion,
      pendingMigrations,
      recommendedAction,
      warnings,
    };
  }
  async resumeFromCheckpoint(checkpointPath) {
    const checkpoint = this.loadCheckpoint(checkpointPath);
    if (!checkpoint) {
      throw new Error('Invalid or missing checkpoint file');
    }
    const remainingMigrations = checkpoint.plan.migrations.slice(checkpoint.completedSteps);
    const currentVersion = this.migrationManager.getCurrentVersion();
    if (currentVersion !== checkpoint.lastCompletedVersion) {
      throw new Error(
        `Database version mismatch. Expected: ${checkpoint.lastCompletedVersion}, Found: ${currentVersion}`
      );
    }
    const updatedPlan = {
      ...checkpoint.plan,
      migrations: remainingMigrations,
      currentVersion: checkpoint.lastCompletedVersion,
    };
    return this.executeMigrationPlan(updatedPlan);
  }
  async loadMigrationsForPlan(fromVersion, toVersion) {
    const allMigrations = await this.loadAllMigrations();
    return allMigrations
      .filter(m => m.version > fromVersion && m.version <= toVersion)
      .sort((a, b) => a.version - b.version);
  }
  async loadAllMigrations() {
    const migrationsPath = path_1.default.join(__dirname, '../migrations/mvp-upgrades');
    const migrations = [];
    if (!fs_1.default.existsSync(migrationsPath)) {
      return migrations;
    }
    const files = fs_1.default
      .readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;
      const version = parseInt(match[1]);
      const description = match[2].replace(/_/g, ' ');
      const filePath = path_1.default.join(migrationsPath, file);
      const content = fs_1.default.readFileSync(filePath, 'utf8');
      const sections = content.split('-- DOWN');
      const up = sections[0].replace(/^-- UP\s*\n?/m, '').trim();
      const down = sections[1]?.trim() || '';
      migrations.push({
        version,
        description,
        up,
        down,
      });
    }
    return migrations;
  }
  estimateMigrationDuration(migrations) {
    let totalMinutes = 0;
    for (const migration of migrations) {
      const upLines = migration.up.split('\n').length;
      const downLines = migration.down.split('\n').length;
      let migrationMinutes = 0.5;
      if (upLines > 50) migrationMinutes += 1;
      if (upLines > 100) migrationMinutes += 2;
      if (upLines > 200) migrationMinutes += 5;
      if (migration.up.includes('INSERT INTO') || migration.up.includes('UPDATE')) {
        migrationMinutes += 2;
      }
      if (migration.up.includes('CREATE INDEX')) {
        migrationMinutes += 1;
      }
      totalMinutes += migrationMinutes;
    }
    return Math.ceil(totalMinutes);
  }
  assessRiskLevel(migrations) {
    let riskScore = 0;
    for (const migration of migrations) {
      if (migration.up.includes('DROP TABLE')) riskScore += 10;
      if (migration.up.includes('DROP COLUMN')) riskScore += 8;
      if (migration.up.includes('ALTER TABLE') && migration.up.includes('DROP')) riskScore += 6;
      if (migration.up.includes('DELETE FROM')) riskScore += 5;
      if (migration.up.includes('UPDATE') && !migration.up.includes('WHERE')) riskScore += 7;
      if (migration.description.toLowerCase().includes('breaking')) riskScore += 8;
      if (migration.description.toLowerCase().includes('major')) riskScore += 6;
    }
    if (riskScore >= 20) return 'critical';
    if (riskScore >= 10) return 'high';
    if (riskScore >= 5) return 'medium';
    return 'low';
  }
  assessDowntimeRequirement(migrations) {
    for (const migration of migrations) {
      if (migration.up.includes('DROP TABLE')) return true;
      if (migration.up.includes('ALTER TABLE') && migration.up.includes('DROP COLUMN')) return true;
      if (migration.up.includes('PRAGMA foreign_keys = OFF')) return true;
      if (migration.description.toLowerCase().includes('breaking')) return true;
    }
    return false;
  }
  generateRollbackPlan(migrations) {
    return migrations
      .slice()
      .reverse()
      .map(m => `Rollback version ${m.version}: ${m.description}`);
  }
  async executeDryRun(plan) {
    const results = [];
    this.emit('dryRunStarted', { plan });
    for (const migration of plan.migrations) {
      const startTime = Date.now();
      try {
        await this.validator.validateSqlSyntax(migration.up);
        results.push({
          success: true,
          version: migration.version,
          duration: Date.now() - startTime,
        });
        this.emit('dryRunStep', {
          migration: migration.version,
          success: true,
          message: 'SQL syntax valid',
        });
      } catch (error) {
        results.push({
          success: false,
          version: migration.version,
          error: error.message,
          duration: Date.now() - startTime,
        });
        this.emit('dryRunStep', {
          migration: migration.version,
          success: false,
          error: error.message,
        });
      }
    }
    this.emit('dryRunCompleted', { results });
    return results;
  }
  async createPreMigrationBackup(plan) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path_1.default.join(
      path_1.default.dirname(this.db.name),
      `backup_pre_migration_v${plan.currentVersion}_to_v${plan.targetVersion}_${timestamp}.db`
    );
    this.db.backup(backupPath);
    this.emit('backupCreated', { backupPath });
    return backupPath;
  }
  async executeMigrationWithRetries(migration, maxRetries) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.migrationManager['applyMigration'](migration);
        if (result.success) {
          return result;
        }
        lastError = new Error(result.error);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          this.emit('migrationRetry', {
            migration: migration.version,
            attempt,
            error: error.message,
          });
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    throw (
      lastError || new Error(`Migration ${migration.version} failed after ${maxRetries} attempts`)
    );
  }
  async executeRollback(completedMigrations) {
    this.emit('rollbackStarted', { migrationsToRollback: completedMigrations.length });
    const successfulMigrations = completedMigrations.filter(r => r.success).reverse();
    for (const migration of successfulMigrations) {
      try {
        await this.rollbackManager.rollbackMigration(migration.version);
        this.emit('rollbackStep', { version: migration.version, success: true });
      } catch (error) {
        this.emit('rollbackStep', {
          version: migration.version,
          success: false,
          error: error.message,
        });
      }
    }
    this.emit('rollbackCompleted');
  }
  findVersionGaps(migrations) {
    const gaps = [];
    const versions = migrations.map(m => m.version).sort((a, b) => a - b);
    for (let i = 1; i < versions.length; i++) {
      if (versions[i] - versions[i - 1] > 1) {
        for (let gap = versions[i - 1] + 1; gap < versions[i]; gap++) {
          gaps.push(gap);
        }
      }
    }
    return gaps;
  }
  loadCheckpoint(checkpointPath) {
    try {
      const content = fs_1.default.readFileSync(checkpointPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
exports.MigrationOrchestrator = MigrationOrchestrator;
//# sourceMappingURL=MigrationOrchestrator.js.map
