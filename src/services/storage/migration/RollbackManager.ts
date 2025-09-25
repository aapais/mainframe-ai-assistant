import Database from 'better-sqlite3';
import { MigrationResult } from '../../../database/MigrationManager';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

export interface RollbackPlan {
  id: string;
  targetVersion: number;
  currentVersion: number;
  rollbackSteps: RollbackStep[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dataRecoveryRequired: boolean;
  backupPath?: string;
  validationChecks: string[];
}

export interface RollbackStep {
  step: number;
  description: string;
  migrationVersion: number;
  sql: string;
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dataImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  dependencies: number[];
  reversible: boolean;
  validationQuery?: string;
}

export interface RollbackResult {
  stepNumber: number;
  migrationVersion: number;
  success: boolean;
  duration: number;
  error?: string;
  dataRestored?: number;
  validationPassed?: boolean;
}

export interface EmergencyRollbackPlan {
  immediate: {
    stopApplication: string[];
    criticalBackup: string[];
    emergencyRestore: string[];
  };
  recovery: {
    dataRecovery: string[];
    integrityChecks: string[];
    serviceRestart: string[];
  };
  validation: {
    functionalTests: string[];
    dataValidation: string[];
    performanceChecks: string[];
  };
  contacts: {
    role: string;
    contact: string;
    escalationLevel: number;
  }[];
}

export interface RollbackCheckpoint {
  id: string;
  timestamp: Date;
  migrationVersion: number;
  databaseState: string;
  rollbackPosition: number;
  canResumeFrom: boolean;
}

export class RollbackManager extends EventEmitter {
  private db: Database.Database;
  private rollbackRegistry: Map<string, RollbackPlan> = new Map();
  private emergencyProcedures: Map<string, EmergencyRollbackPlan> = new Map();

  constructor(db: Database.Database) {
    super();
    this.db = db;
    this.initializeRollbackTracking();
    this.setupEmergencyProcedures();
  }

  /**
   * Create comprehensive rollback plan for specific target version
   */
  async createRollbackPlan(targetVersion: number): Promise<RollbackPlan> {
    const currentVersion = this.getCurrentVersion();

    if (targetVersion >= currentVersion) {
      throw new Error(
        `Target version ${targetVersion} must be less than current version ${currentVersion}`
      );
    }

    const rollbackSteps = await this.generateRollbackSteps(targetVersion, currentVersion);
    const planId = this.generatePlanId();

    const plan: RollbackPlan = {
      id: planId,
      targetVersion,
      currentVersion,
      rollbackSteps,
      estimatedDuration: this.calculateTotalDuration(rollbackSteps),
      riskLevel: this.assessRollbackRisk(rollbackSteps),
      dataRecoveryRequired: this.assessDataRecoveryNeed(rollbackSteps),
      validationChecks: this.generateValidationChecks(targetVersion),
    };

    // Store plan for potential execution
    this.rollbackRegistry.set(planId, plan);

    // Create backup before any rollback operations
    plan.backupPath = await this.createPreRollbackBackup(planId);

    this.emit('rollbackPlanCreated', {
      planId,
      targetVersion,
      estimatedDuration: plan.estimatedDuration,
      riskLevel: plan.riskLevel,
    });

    return plan;
  }

  /**
   * Execute rollback plan with comprehensive safety measures
   */
  async executeRollbackPlan(
    plan: RollbackPlan,
    options: {
      preserveUserData?: boolean;
      validateRollback?: boolean;
      createCheckpoints?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    let currentCheckpoint: RollbackCheckpoint | null = null;

    this.emit('rollbackStarted', {
      planId: plan.id,
      targetVersion: plan.targetVersion,
      totalSteps: plan.rollbackSteps.length,
    });

    try {
      // Pre-rollback validation
      await this.validatePreRollbackState(plan);

      // Execute rollback steps in order
      for (let i = 0; i < plan.rollbackSteps.length; i++) {
        const step = plan.rollbackSteps[i];

        // Create checkpoint if enabled
        if (options.createCheckpoints) {
          currentCheckpoint = await this.createRollbackCheckpoint(
            plan.id,
            step.migrationVersion,
            i
          );
        }

        // Execute rollback step with retries
        const result = await this.executeRollbackStepWithRetries(step, options.maxRetries || 3);

        results.push({
          success: result.success,
          version: step.migrationVersion,
          duration: result.duration,
          error: result.error,
        });

        if (!result.success) {
          await this.handleRollbackStepFailure(step, result, currentCheckpoint);
          break;
        }

        // Validate step if required
        if (options.validateRollback && step.validationQuery) {
          const validationPassed = await this.validateRollbackStep(step);
          if (!validationPassed) {
            throw new Error(`Rollback validation failed for step ${step.step}`);
          }
        }

        this.emit('rollbackStepCompleted', {
          planId: plan.id,
          stepNumber: step.step,
          migrationVersion: step.migrationVersion,
          success: result.success,
        });
      }

      // Post-rollback validation
      if (options.validateRollback) {
        await this.validatePostRollbackState(plan);
      }

      // Preserve user data if requested
      if (options.preserveUserData) {
        await this.preserveUserDataAfterRollback(plan);
      }

      this.emit('rollbackCompleted', {
        planId: plan.id,
        targetVersion: plan.targetVersion,
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        success: results.every(r => r.success),
      });
    } catch (error) {
      await this.handleRollbackFailure(plan, error, results, currentCheckpoint);
      throw error;
    }

    return results;
  }

  /**
   * Execute emergency rollback with minimal validation
   */
  async executeEmergencyRollback(
    emergencyType: 'corruption' | 'performance' | 'data_loss' | 'security' = 'corruption'
  ): Promise<{
    success: boolean;
    actionsPerformed: string[];
    restoredToVersion: number;
    emergencyContacts: string[];
    nextSteps: string[];
  }> {
    const emergencyPlan = this.emergencyProcedures.get(emergencyType);
    if (!emergencyPlan) {
      throw new Error(`No emergency procedure defined for type: ${emergencyType}`);
    }

    const actionsPerformed: string[] = [];

    this.emit('emergencyRollbackStarted', { type: emergencyType });

    try {
      // Phase 1: Immediate actions
      for (const action of emergencyPlan.immediate.stopApplication) {
        await this.executeEmergencyAction(action);
        actionsPerformed.push(action);
      }

      for (const action of emergencyPlan.immediate.criticalBackup) {
        await this.executeEmergencyAction(action);
        actionsPerformed.push(action);
      }

      for (const action of emergencyPlan.immediate.emergencyRestore) {
        await this.executeEmergencyAction(action);
        actionsPerformed.push(action);
      }

      // Phase 2: Recovery actions
      for (const action of emergencyPlan.recovery.dataRecovery) {
        await this.executeEmergencyAction(action);
        actionsPerformed.push(action);
      }

      const restoredVersion = this.getCurrentVersion();

      this.emit('emergencyRollbackCompleted', {
        type: emergencyType,
        restoredToVersion: restoredVersion,
        actionsPerformed: actionsPerformed.length,
      });

      return {
        success: true,
        actionsPerformed,
        restoredToVersion: restoredVersion,
        emergencyContacts: emergencyPlan.contacts.map(c => c.contact),
        nextSteps: emergencyPlan.validation.functionalTests,
      };
    } catch (error) {
      this.emit('emergencyRollbackFailed', {
        type: emergencyType,
        error: error.message,
        actionsCompleted: actionsPerformed.length,
      });

      throw new Error(`Emergency rollback failed: ${error.message}`);
    }
  }

  /**
   * Prepare rollback environment and safety measures
   */
  async prepareRollbackEnvironment(plan: any): Promise<{
    backupCreated: boolean;
    dependenciesChecked: boolean;
    safetyMeasuresEnabled: boolean;
    rollbackReadiness: 'ready' | 'needs_preparation' | 'unsafe';
  }> {
    const preparation = {
      backupCreated: false,
      dependenciesChecked: false,
      safetyMeasuresEnabled: false,
      rollbackReadiness: 'needs_preparation' as const,
    };

    try {
      // Create comprehensive backup
      const backupPath = await this.createPreRollbackBackup(`prep_${Date.now()}`);
      preparation.backupCreated = !!backupPath;

      // Check rollback dependencies
      await this.validateRollbackDependencies();
      preparation.dependenciesChecked = true;

      // Enable safety measures
      await this.enableRollbackSafetyMeasures();
      preparation.safetyMeasuresEnabled = true;

      preparation.rollbackReadiness = 'ready';
    } catch (error) {
      console.error('Rollback preparation failed:', error);
      preparation.rollbackReadiness = 'unsafe';
    }

    return preparation;
  }

  /**
   * Resume rollback from checkpoint
   */
  async resumeRollbackFromCheckpoint(checkpointId: string): Promise<MigrationResult[]> {
    const checkpoint = await this.loadRollbackCheckpoint(checkpointId);

    if (!checkpoint || !checkpoint.canResumeFrom) {
      throw new Error('Invalid or unsafe checkpoint for rollback resume');
    }

    const plan = this.rollbackRegistry.get(checkpoint.id);
    if (!plan) {
      throw new Error('Rollback plan not found for checkpoint');
    }

    // Resume from checkpoint position
    const remainingSteps = plan.rollbackSteps.slice(checkpoint.rollbackPosition);
    const modifiedPlan: RollbackPlan = {
      ...plan,
      rollbackSteps: remainingSteps,
    };

    return await this.executeRollbackPlan(modifiedPlan);
  }

  /**
   * Validate rollback capability and safety
   */
  async validateRollbackCapability(targetVersion: number): Promise<{
    canRollback: boolean;
    issues: Array<{
      type: 'blocking' | 'warning';
      message: string;
      resolution: string;
    }>;
    requiredActions: string[];
    estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const issues: any[] = [];
    const requiredActions: string[] = [];

    // Check if target version exists
    const targetExists = await this.versionExists(targetVersion);
    if (!targetExists) {
      issues.push({
        type: 'blocking',
        message: `Target version ${targetVersion} not found in migration history`,
        resolution: 'Verify the target version is correct and was previously applied',
      });
    }

    // Check for data dependencies
    const dataDependencies = await this.checkDataDependencies(targetVersion);
    if (dataDependencies.length > 0) {
      issues.push({
        type: 'warning',
        message: 'Data dependencies detected that may be affected by rollback',
        resolution: 'Review data impact and create appropriate backups',
      });
      requiredActions.push('Create comprehensive data backup');
    }

    // Check for breaking changes
    const breakingChanges = await this.identifyBreakingChanges(targetVersion);
    if (breakingChanges.length > 0) {
      issues.push({
        type: 'blocking',
        message: 'Breaking changes detected in rollback path',
        resolution: 'Review breaking changes and ensure rollback SQL is available',
      });
    }

    const canRollback = issues.filter(i => i.type === 'blocking').length === 0;
    const estimatedRisk = this.calculateRollbackRisk(issues, breakingChanges.length);

    return {
      canRollback,
      issues,
      requiredActions,
      estimatedRisk,
    };
  }

  // Private implementation methods

  private initializeRollbackTracking(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rollback_plans (
        id TEXT PRIMARY KEY,
        target_version INTEGER NOT NULL,
        current_version INTEGER NOT NULL,
        plan_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        executed_at DATETIME,
        success BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS rollback_checkpoints (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        migration_version INTEGER NOT NULL,
        rollback_position INTEGER NOT NULL,
        database_state TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        can_resume_from BOOLEAN DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS rollback_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT NOT NULL,
        step_number INTEGER NOT NULL,
        migration_version INTEGER NOT NULL,
        action TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        duration_ms INTEGER NOT NULL,
        error_message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private setupEmergencyProcedures(): void {
    // Corruption emergency procedure
    this.emergencyProcedures.set('corruption', {
      immediate: {
        stopApplication: [
          'Stop all application processes',
          'Prevent new connections',
          'Lock database for exclusive access',
        ],
        criticalBackup: [
          'Create emergency database backup',
          'Export critical user data',
          'Save current schema state',
        ],
        emergencyRestore: [
          'Restore from last known good backup',
          'Verify backup integrity',
          'Update schema version tracking',
        ],
      },
      recovery: {
        dataRecovery: [
          'Merge critical user data from emergency export',
          'Verify data consistency',
          'Run integrity checks',
        ],
        integrityChecks: [
          'Check referential integrity',
          'Validate schema consistency',
          'Verify index integrity',
        ],
        serviceRestart: [
          'Restart application services',
          'Monitor for errors',
          'Verify functionality',
        ],
      },
      validation: {
        functionalTests: [
          'Test core application features',
          'Verify data access',
          'Check search functionality',
        ],
        dataValidation: [
          'Validate critical data exists',
          'Check data consistency',
          'Verify user access',
        ],
        performanceChecks: [
          'Monitor response times',
          'Check resource usage',
          'Verify search performance',
        ],
      },
      contacts: [
        { role: 'Database Administrator', contact: 'dba@company.com', escalationLevel: 1 },
        { role: 'Technical Lead', contact: 'lead@company.com', escalationLevel: 2 },
        { role: 'System Administrator', contact: 'sysadmin@company.com', escalationLevel: 3 },
      ],
    });

    // Data loss emergency procedure
    this.emergencyProcedures.set('data_loss', {
      immediate: {
        stopApplication: [
          'Immediately stop all write operations',
          'Preserve current database state',
          'Isolate affected systems',
        ],
        criticalBackup: [
          'Create point-in-time backup',
          'Export recoverable data',
          'Document data loss scope',
        ],
        emergencyRestore: [
          'Restore from last backup before data loss',
          'Merge recoverable data',
          'Verify restored data integrity',
        ],
      },
      recovery: {
        dataRecovery: [
          'Identify recoverable data sources',
          'Merge data from multiple sources',
          'Resolve conflicts and duplicates',
        ],
        integrityChecks: [
          'Validate restored data completeness',
          'Check for missing references',
          'Verify data relationships',
        ],
        serviceRestart: [
          'Gradual service restoration',
          'Monitor data consistency',
          'Verify no additional data loss',
        ],
      },
      validation: {
        functionalTests: [
          'Test all data-dependent features',
          'Verify data access patterns',
          'Check for missing functionality',
        ],
        dataValidation: [
          'Audit critical data completeness',
          'Validate business logic constraints',
          'Check data chronology',
        ],
        performanceChecks: [
          'Monitor query performance',
          'Check for data fragmentation',
          'Verify index effectiveness',
        ],
      },
      contacts: [
        { role: 'Data Recovery Specialist', contact: 'recovery@company.com', escalationLevel: 1 },
        { role: 'Database Administrator', contact: 'dba@company.com', escalationLevel: 1 },
        { role: 'Business Owner', contact: 'business@company.com', escalationLevel: 2 },
      ],
    });
  }

  private getCurrentVersion(): number {
    try {
      const result = this.db
        .prepare(
          `
        SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations
      `
        )
        .get() as { version: number };
      return result.version;
    } catch {
      return 0;
    }
  }

  private async generateRollbackSteps(
    targetVersion: number,
    currentVersion: number
  ): Promise<RollbackStep[]> {
    const steps: RollbackStep[] = [];

    // Get migrations to rollback (in reverse order)
    const migrations = this.db
      .prepare(
        `
      SELECT version, description, rollback_sql
      FROM schema_migrations
      WHERE version > ? AND version <= ?
      ORDER BY version DESC
    `
      )
      .all(targetVersion, currentVersion) as Array<{
      version: number;
      description: string;
      rollback_sql: string;
    }>;

    migrations.forEach((migration, index) => {
      steps.push({
        step: index + 1,
        description: `Rollback migration ${migration.version}: ${migration.description}`,
        migrationVersion: migration.version,
        sql: migration.rollback_sql,
        estimatedDuration: this.estimateStepDuration(migration.rollback_sql),
        riskLevel: this.assessStepRisk(migration.rollback_sql),
        dataImpact: this.assessDataImpact(migration.rollback_sql),
        dependencies: [],
        reversible: true,
        validationQuery: this.generateValidationQuery(migration.version),
      });
    });

    return steps;
  }

  private calculateTotalDuration(steps: RollbackStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedDuration, 0);
  }

  private assessRollbackRisk(steps: RollbackStep[]): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    for (const step of steps) {
      if (step.riskLevel === 'critical') riskScore += 10;
      else if (step.riskLevel === 'high') riskScore += 6;
      else if (step.riskLevel === 'medium') riskScore += 3;
      else riskScore += 1;

      if (step.dataImpact === 'significant') riskScore += 5;
      if (!step.reversible) riskScore += 8;
    }

    if (riskScore >= 25) return 'critical';
    if (riskScore >= 15) return 'high';
    if (riskScore >= 8) return 'medium';
    return 'low';
  }

  private assessDataRecoveryNeed(steps: RollbackStep[]): boolean {
    return steps.some(
      step =>
        step.dataImpact === 'significant' ||
        step.sql.includes('DROP TABLE') ||
        step.sql.includes('DELETE FROM')
    );
  }

  private generateValidationChecks(targetVersion: number): string[] {
    return [
      `Verify schema version is ${targetVersion}`,
      'Check database integrity',
      'Validate core functionality',
      'Verify data consistency',
    ];
  }

  private generatePlanId(): string {
    return `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createPreRollbackBackup(planId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      path.dirname(this.db.name),
      `backup_pre_rollback_${planId}_${timestamp}.db`
    );

    this.db.backup(backupPath);

    this.emit('backupCreated', { backupPath, type: 'pre-rollback', planId });
    return backupPath;
  }

  private async executeRollbackStepWithRetries(
    step: RollbackStep,
    maxRetries: number
  ): Promise<RollbackResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        // Execute rollback SQL in transaction
        const transaction = this.db.transaction(() => {
          this.db.exec(step.sql);

          // Update migration tracking
          this.db
            .prepare(
              `
            DELETE FROM schema_migrations WHERE version = ?
          `
            )
            .run(step.migrationVersion);
        });

        transaction();

        const result: RollbackResult = {
          stepNumber: step.step,
          migrationVersion: step.migrationVersion,
          success: true,
          duration: Date.now() - startTime,
        };

        // Log successful rollback
        this.logRollbackStep(step, result);

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          this.emit('rollbackStepRetry', {
            step: step.step,
            attempt,
            error: error.message,
          });

          // Wait before retry
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    const result: RollbackResult = {
      stepNumber: step.step,
      migrationVersion: step.migrationVersion,
      success: false,
      duration: Date.now() - Date.now(),
      error: lastError?.message || 'Unknown error',
    };

    this.logRollbackStep(step, result);
    return result;
  }

  private logRollbackStep(step: RollbackStep, result: RollbackResult): void {
    this.db
      .prepare(
        `
      INSERT INTO rollback_logs (
        plan_id, step_number, migration_version, action, success, duration_ms, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        '', // Plan ID would be passed in real implementation
        step.step,
        step.migrationVersion,
        'rollback',
        result.success ? 1 : 0,
        result.duration,
        result.error || null
      );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Placeholder implementations for complex methods
  private estimateStepDuration(sql: string): number {
    // Estimate based on SQL complexity
    return sql.length > 200 ? 60 : 30; // seconds
  }

  private assessStepRisk(sql: string): 'low' | 'medium' | 'high' | 'critical' {
    if (sql.includes('DROP TABLE')) return 'critical';
    if (sql.includes('DELETE FROM')) return 'high';
    if (sql.includes('ALTER TABLE')) return 'medium';
    return 'low';
  }

  private assessDataImpact(sql: string): 'none' | 'minimal' | 'moderate' | 'significant' {
    if (sql.includes('DROP TABLE') || sql.includes('DELETE FROM')) return 'significant';
    if (sql.includes('DROP COLUMN')) return 'moderate';
    if (sql.includes('ALTER TABLE')) return 'minimal';
    return 'none';
  }

  private generateValidationQuery(version: number): string {
    return `SELECT COUNT(*) FROM schema_migrations WHERE version = ${version}`;
  }

  // Additional placeholder implementations
  private async validatePreRollbackState(plan: RollbackPlan): Promise<void> {}
  private async handleRollbackStepFailure(
    step: RollbackStep,
    result: RollbackResult,
    checkpoint: RollbackCheckpoint | null
  ): Promise<void> {}
  private async validateRollbackStep(step: RollbackStep): Promise<boolean> {
    return true;
  }
  private async validatePostRollbackState(plan: RollbackPlan): Promise<void> {}
  private async preserveUserDataAfterRollback(plan: RollbackPlan): Promise<void> {}
  private async handleRollbackFailure(
    plan: RollbackPlan,
    error: Error,
    results: MigrationResult[],
    checkpoint: RollbackCheckpoint | null
  ): Promise<void> {}
  private async executeEmergencyAction(action: string): Promise<void> {}
  private async createRollbackCheckpoint(
    planId: string,
    migrationVersion: number,
    position: number
  ): Promise<RollbackCheckpoint> {
    return {
      id: `checkpoint_${Date.now()}`,
      timestamp: new Date(),
      migrationVersion,
      databaseState: '',
      rollbackPosition: position,
      canResumeFrom: true,
    };
  }
  private async loadRollbackCheckpoint(checkpointId: string): Promise<RollbackCheckpoint | null> {
    return null;
  }
  private async validateRollbackDependencies(): Promise<void> {}
  private async enableRollbackSafetyMeasures(): Promise<void> {}
  private async versionExists(version: number): Promise<boolean> {
    return true;
  }
  private async checkDataDependencies(version: number): Promise<any[]> {
    return [];
  }
  private async identifyBreakingChanges(version: number): Promise<any[]> {
    return [];
  }
  private calculateRollbackRisk(
    issues: any[],
    breakingChanges: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    return 'medium';
  }
}
