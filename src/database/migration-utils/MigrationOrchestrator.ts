import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MigrationManager, Migration, MigrationResult } from '../MigrationManager';
import { DataTransformer } from './DataTransformer';
import { MigrationValidator } from './MigrationValidator';
import { RollbackManager } from './RollbackManager';
import { ProgressTracker } from './ProgressTracker';
import fs from 'fs';
import path from 'path';

export interface MigrationPlan {
  currentVersion: number;
  targetVersion: number;
  migrations: Migration[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresDowntime: boolean;
  rollbackPlan: string[];
}

export interface MigrationProgress {
  currentStep: number;
  totalSteps: number;
  currentMigration?: number;
  status: 'planning' | 'running' | 'completed' | 'failed' | 'rolled_back';
  startTime: Date;
  estimatedCompletion?: Date;
  errors: string[];
  warnings: string[];
}

export class MigrationOrchestrator extends EventEmitter {
  private db: Database.Database;
  private migrationManager: MigrationManager;
  private dataTransformer: DataTransformer;
  private validator: MigrationValidator;
  private rollbackManager: RollbackManager;
  private progressTracker: ProgressTracker;
  private currentProgress?: MigrationProgress;

  constructor(
    db: Database.Database,
    migrationsPath: string = './src/database/migrations/mvp-upgrades'
  ) {
    super();
    this.db = db;
    this.migrationManager = new MigrationManager(db, migrationsPath);
    this.dataTransformer = new DataTransformer(db);
    this.validator = new MigrationValidator(db);
    this.rollbackManager = new RollbackManager(db);
    this.progressTracker = new ProgressTracker();
  }

  /**
   * Create a comprehensive migration plan from current version to target
   */
  async createMigrationPlan(targetVersion: number): Promise<MigrationPlan> {
    const currentVersion = this.migrationManager.getCurrentVersion();
    
    if (targetVersion <= currentVersion) {
      throw new Error(`Target version ${targetVersion} must be greater than current version ${currentVersion}`);
    }

    const migrations = await this.loadMigrationsForPlan(currentVersion, targetVersion);
    
    const plan: MigrationPlan = {
      currentVersion,
      targetVersion,
      migrations,
      estimatedDuration: this.estimateMigrationDuration(migrations),
      riskLevel: this.assessRiskLevel(migrations),
      requiresDowntime: this.assessDowntimeRequirement(migrations),
      rollbackPlan: this.generateRollbackPlan(migrations)
    };

    // Validate the migration plan
    const validationResult = await this.validator.validateMigrationPlan(plan);
    if (!validationResult.isValid) {
      throw new Error(`Migration plan validation failed: ${validationResult.errors.join(', ')}`);
    }

    return plan;
  }

  /**
   * Execute migration plan with zero-downtime strategy when possible
   */
  async executeMigrationPlan(plan: MigrationPlan, options: {
    dryRun?: boolean;
    pauseBetweenSteps?: number;
    maxRetries?: number;
    continueOnWarning?: boolean;
  } = {}): Promise<MigrationResult[]> {
    
    if (options.dryRun) {
      return this.executeDryRun(plan);
    }

    this.currentProgress = {
      currentStep: 0,
      totalSteps: plan.migrations.length,
      status: 'running',
      startTime: new Date(),
      errors: [],
      warnings: []
    };

    this.emit('migrationStarted', this.currentProgress);
    this.progressTracker.start(plan.migrations.length);

    const results: MigrationResult[] = [];
    let rollbackRequired = false;

    try {
      // Pre-migration backup
      await this.createPreMigrationBackup(plan);

      // Execute migrations one by one
      for (let i = 0; i < plan.migrations.length; i++) {
        const migration = plan.migrations[i];
        this.currentProgress.currentStep = i + 1;
        this.currentProgress.currentMigration = migration.version;
        
        this.emit('migrationStepStarted', {
          step: i + 1,
          migration: migration.version,
          description: migration.description
        });

        // Pre-migration validation
        const preValidation = await this.validator.validatePreMigration(migration);
        if (!preValidation.isValid) {
          this.currentProgress.errors.push(`Pre-migration validation failed for ${migration.version}: ${preValidation.errors.join(', ')}`);
          throw new Error(`Pre-migration validation failed for ${migration.version}`);
        }

        // Execute migration with retries
        const result = await this.executeMigrationWithRetries(
          migration,
          options.maxRetries || 3
        );
        
        results.push(result);

        if (!result.success) {
          rollbackRequired = true;
          break;
        }

        // Post-migration validation
        const postValidation = await this.validator.validatePostMigration(migration);
        if (!postValidation.isValid) {
          this.currentProgress.errors.push(`Post-migration validation failed for ${migration.version}: ${postValidation.errors.join(', ')}`);
          if (!options.continueOnWarning) {
            rollbackRequired = true;
            break;
          }
        }

        // Update progress
        this.progressTracker.updateProgress(i + 1);
        this.emit('migrationStepCompleted', {
          step: i + 1,
          migration: migration.version,
          success: result.success,
          duration: result.duration
        });

        // Pause between steps if requested
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
          success: true
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
        rollbackPerformed: results.length > 0
      });
      
      throw error;
    } finally {
      this.progressTracker.finish();
    }

    return results;
  }

  /**
   * Get current migration progress
   */
  getCurrentProgress(): MigrationProgress | null {
    return this.currentProgress;
  }

  /**
   * Check for pending migrations and assess upgrade path
   */
  async analyzeUpgradePath(): Promise<{
    currentVersion: number;
    latestVersion: number;
    pendingMigrations: Migration[];
    recommendedAction: string;
    warnings: string[];
  }> {
    const currentVersion = this.migrationManager.getCurrentVersion();
    const allMigrations = await this.loadAllMigrations();
    const latestVersion = Math.max(...allMigrations.map(m => m.version));
    const pendingMigrations = allMigrations.filter(m => m.version > currentVersion);

    let recommendedAction = 'No action required';
    const warnings: string[] = [];

    if (pendingMigrations.length > 0) {
      if (pendingMigrations.length === 1) {
        recommendedAction = `Upgrade to version ${pendingMigrations[0].version}`;
      } else {
        recommendedAction = `Upgrade through ${pendingMigrations.length} versions to ${latestVersion}`;
      }

      // Check for risky migrations
      const highRiskMigrations = pendingMigrations.filter(m => 
        m.description.toLowerCase().includes('breaking') ||
        m.description.toLowerCase().includes('major')
      );

      if (highRiskMigrations.length > 0) {
        warnings.push(`${highRiskMigrations.length} high-risk migrations detected - backup recommended`);
      }

      // Check version gaps
      const versionGaps = this.findVersionGaps(pendingMigrations);
      if (versionGaps.length > 0) {
        warnings.push(`Version gaps detected: ${versionGaps.join(', ')} - review migration sequence`);
      }
    }

    return {
      currentVersion,
      latestVersion,
      pendingMigrations,
      recommendedAction,
      warnings
    };
  }

  /**
   * Resume interrupted migration from checkpoint
   */
  async resumeFromCheckpoint(checkpointPath: string): Promise<MigrationResult[]> {
    const checkpoint = this.loadCheckpoint(checkpointPath);
    
    if (!checkpoint) {
      throw new Error('Invalid or missing checkpoint file');
    }

    const remainingMigrations = checkpoint.plan.migrations.slice(checkpoint.completedSteps);
    
    // Validate database state matches checkpoint
    const currentVersion = this.migrationManager.getCurrentVersion();
    if (currentVersion !== checkpoint.lastCompletedVersion) {
      throw new Error(`Database version mismatch. Expected: ${checkpoint.lastCompletedVersion}, Found: ${currentVersion}`);
    }

    // Continue migration from checkpoint
    const updatedPlan: MigrationPlan = {
      ...checkpoint.plan,
      migrations: remainingMigrations,
      currentVersion: checkpoint.lastCompletedVersion
    };

    return this.executeMigrationPlan(updatedPlan);
  }

  // Private methods

  private async loadMigrationsForPlan(fromVersion: number, toVersion: number): Promise<Migration[]> {
    const allMigrations = await this.loadAllMigrations();
    return allMigrations
      .filter(m => m.version > fromVersion && m.version <= toVersion)
      .sort((a, b) => a.version - b.version);
  }

  private async loadAllMigrations(): Promise<Migration[]> {
    const migrationsPath = path.join(__dirname, '../migrations/mvp-upgrades');
    const migrations: Migration[] = [];

    if (!fs.existsSync(migrationsPath)) {
      return migrations;
    }

    const files = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;

      const version = parseInt(match[1]);
      const description = match[2].replace(/_/g, ' ');
      const filePath = path.join(migrationsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');

      const sections = content.split('-- DOWN');
      const up = sections[0].replace(/^-- UP\s*\n?/m, '').trim();
      const down = sections[1]?.trim() || '';

      migrations.push({
        version,
        description,
        up,
        down
      });
    }

    return migrations;
  }

  private estimateMigrationDuration(migrations: Migration[]): number {
    // Estimate based on migration complexity
    let totalMinutes = 0;
    
    for (const migration of migrations) {
      const upLines = migration.up.split('\n').length;
      const downLines = migration.down.split('\n').length;
      
      // Base time: 30 seconds per migration
      let migrationMinutes = 0.5;
      
      // Add time based on complexity
      if (upLines > 50) migrationMinutes += 1;
      if (upLines > 100) migrationMinutes += 2;
      if (upLines > 200) migrationMinutes += 5;
      
      // Add time for data transformations
      if (migration.up.includes('INSERT INTO') || migration.up.includes('UPDATE')) {
        migrationMinutes += 2;
      }
      
      // Add time for index creation
      if (migration.up.includes('CREATE INDEX')) {
        migrationMinutes += 1;
      }
      
      totalMinutes += migrationMinutes;
    }
    
    return Math.ceil(totalMinutes);
  }

  private assessRiskLevel(migrations: Migration[]): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;
    
    for (const migration of migrations) {
      // Check for risky operations
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

  private assessDowntimeRequirement(migrations: Migration[]): boolean {
    for (const migration of migrations) {
      // Operations that typically require downtime
      if (migration.up.includes('DROP TABLE')) return true;
      if (migration.up.includes('ALTER TABLE') && migration.up.includes('DROP COLUMN')) return true;
      if (migration.up.includes('PRAGMA foreign_keys = OFF')) return true;
      if (migration.description.toLowerCase().includes('breaking')) return true;
    }
    return false;
  }

  private generateRollbackPlan(migrations: Migration[]): string[] {
    return migrations
      .slice()
      .reverse()
      .map(m => `Rollback version ${m.version}: ${m.description}`);
  }

  private async executeDryRun(plan: MigrationPlan): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    this.emit('dryRunStarted', { plan });
    
    for (const migration of plan.migrations) {
      // Simulate migration execution
      const startTime = Date.now();
      
      try {
        // Validate SQL syntax without execution
        await this.validator.validateSqlSyntax(migration.up);
        
        results.push({
          success: true,
          version: migration.version,
          duration: Date.now() - startTime
        });
        
        this.emit('dryRunStep', {
          migration: migration.version,
          success: true,
          message: 'SQL syntax valid'
        });
        
      } catch (error) {
        results.push({
          success: false,
          version: migration.version,
          error: error.message,
          duration: Date.now() - startTime
        });
        
        this.emit('dryRunStep', {
          migration: migration.version,
          success: false,
          error: error.message
        });
      }
    }
    
    this.emit('dryRunCompleted', { results });
    return results;
  }

  private async createPreMigrationBackup(plan: MigrationPlan): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      path.dirname(this.db.name),
      `backup_pre_migration_v${plan.currentVersion}_to_v${plan.targetVersion}_${timestamp}.db`
    );
    
    this.db.backup(backupPath);
    
    this.emit('backupCreated', { backupPath });
    return backupPath;
  }

  private async executeMigrationWithRetries(
    migration: Migration, 
    maxRetries: number
  ): Promise<MigrationResult> {
    let lastError: Error | null = null;
    
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
            error: error.message
          });
          
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError || new Error(`Migration ${migration.version} failed after ${maxRetries} attempts`);
  }

  private async executeRollback(completedMigrations: MigrationResult[]): Promise<void> {
    this.emit('rollbackStarted', { migrationsToRollback: completedMigrations.length });
    
    const successfulMigrations = completedMigrations
      .filter(r => r.success)
      .reverse();
      
    for (const migration of successfulMigrations) {
      try {
        await this.rollbackManager.rollbackMigration(migration.version);
        this.emit('rollbackStep', { version: migration.version, success: true });
      } catch (error) {
        this.emit('rollbackStep', { 
          version: migration.version, 
          success: false, 
          error: error.message 
        });
        // Continue with other rollbacks even if one fails
      }
    }
    
    this.emit('rollbackCompleted');
  }

  private findVersionGaps(migrations: Migration[]): number[] {
    const gaps: number[] = [];
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

  private loadCheckpoint(checkpointPath: string): any | null {
    try {
      const content = fs.readFileSync(checkpointPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}