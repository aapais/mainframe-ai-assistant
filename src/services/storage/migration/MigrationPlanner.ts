import Database from 'better-sqlite3';
import { Migration } from '../../../database/MigrationManager';
import fs from 'fs';
import path from 'path';

export interface MigrationPlan {
  id: string;
  currentVersion: number;
  targetVersion: number;
  currentMVP: number;
  targetMVP: number;
  migrations: Migration[];
  phases: MigrationPhase[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresDowntime: boolean;
  dataBackupRequired: boolean;
  rollbackStrategy: string;
  prerequisites: string[];
  postMigrationTasks: string[];
  validationChecks: ValidationCheck[];
}

export interface MigrationPhase {
  name: string;
  description: string;
  migrations: number[];
  estimatedDuration: number;
  canRunInParallel: boolean;
  dependencies: string[];
  rollbackPoint: boolean;
}

export interface ValidationCheck {
  type: 'schema' | 'data' | 'integrity' | 'performance';
  description: string;
  critical: boolean;
  query?: string;
  expectedResult?: any;
}

export interface MVPMigrationPath {
  from: number;
  to: number;
  intermediateSteps: number[];
  criticalPath: boolean;
  alternativeRoutes: number[][];
}

export class MigrationPlanner {
  private db: Database.Database;
  private migrationsPath: string;
  private mvpDefinitions: Map<number, MVPDefinition> = new Map();

  constructor(db: Database.Database, migrationsPath: string) {
    this.db = db;
    this.migrationsPath = migrationsPath;
    this.initializeMVPDefinitions();
  }

  /**
   * Create comprehensive migration plan for MVP upgrade
   */
  async createComprehensiveMigrationPlan(targetMVP: number): Promise<MigrationPlan> {
    const currentVersion = this.getCurrentVersion();
    const currentMVP = this.detectCurrentMVP(currentVersion);

    if (targetMVP <= currentMVP) {
      throw new Error(`Target MVP ${targetMVP} must be greater than current MVP ${currentMVP}`);
    }

    const migrationPath = this.calculateOptimalMigrationPath(currentMVP, targetMVP);
    const migrations = await this.loadMigrationsForPath(migrationPath);
    const phases = this.organizeMigrationsIntoPhases(migrations, migrationPath);

    const plan: MigrationPlan = {
      id: this.generatePlanId(),
      currentVersion,
      targetVersion: Math.max(...migrations.map(m => m.version)),
      currentMVP,
      targetMVP,
      migrations,
      phases,
      estimatedDuration: this.calculateTotalEstimatedDuration(phases),
      riskLevel: this.assessOverallRiskLevel(migrations, migrationPath),
      requiresDowntime: this.assessDowntimeRequirement(migrations),
      dataBackupRequired: this.assessBackupRequirement(migrations),
      rollbackStrategy: this.selectRollbackStrategy(migrationPath),
      prerequisites: this.generatePrerequisites(migrationPath),
      postMigrationTasks: this.generatePostMigrationTasks(targetMVP),
      validationChecks: this.generateValidationChecks(migrations, targetMVP),
    };

    // Validate the plan
    await this.validateMigrationPlan(plan);

    return plan;
  }

  /**
   * Get migrations needed for specific MVP upgrade
   */
  async getMigrationsForMVPUpgrade(fromMVP: number, toMVP: number): Promise<Migration[]> {
    const migrationPath = this.calculateOptimalMigrationPath(fromMVP, toMVP);
    return await this.loadMigrationsForPath(migrationPath);
  }

  /**
   * Analyze multiple migration paths and recommend the best one
   */
  async analyzeMigrationPaths(targetMVP: number): Promise<{
    recommendedPath: MVPMigrationPath;
    alternativePaths: MVPMigrationPath[];
    pathAnalysis: {
      path: MVPMigrationPath;
      pros: string[];
      cons: string[];
      riskLevel: string;
      estimatedDuration: number;
    }[];
  }> {
    const currentMVP = this.detectCurrentMVP(this.getCurrentVersion());
    const allPaths = this.generateAllPossiblePaths(currentMVP, targetMVP);

    const pathAnalyses = await Promise.all(allPaths.map(path => this.analyzeSinglePath(path)));

    const recommendedPath = this.selectRecommendedPath(pathAnalyses);

    return {
      recommendedPath: recommendedPath.path,
      alternativePaths: allPaths.filter(p => p !== recommendedPath.path),
      pathAnalysis: pathAnalyses,
    };
  }

  /**
   * Create emergency rollback plan
   */
  async createEmergencyRollbackPlan(fromVersion: number): Promise<{
    rollbackSteps: Array<{
      step: number;
      description: string;
      sql: string;
      estimatedDuration: number;
      riskLevel: string;
    }>;
    dataRecoverySteps: string[];
    validationSteps: string[];
    emergencyContacts: string[];
  }> {
    const appliedMigrations = this.getAppliedMigrationsSince(fromVersion);

    return {
      rollbackSteps: this.generateRollbackSteps(appliedMigrations),
      dataRecoverySteps: this.generateDataRecoverySteps(appliedMigrations),
      validationSteps: this.generateRollbackValidationSteps(appliedMigrations),
      emergencyContacts: this.getEmergencyContacts(),
    };
  }

  /**
   * Estimate resource requirements for migration
   */
  async estimateResourceRequirements(plan: MigrationPlan): Promise<{
    storage: {
      additionalSpaceRequired: number;
      temporarySpaceRequired: number;
      backupSpaceRequired: number;
    };
    memory: {
      peakMemoryUsage: number;
      recommendedMemory: number;
    };
    cpu: {
      estimatedCpuTime: number;
      recommendedCores: number;
    };
    network: {
      dataTransferRequired: number;
      estimatedBandwidth: number;
    };
  }> {
    const currentDbSize = this.getDatabaseSize();
    const migrationComplexity = this.calculateMigrationComplexity(plan.migrations);

    return {
      storage: {
        additionalSpaceRequired: currentDbSize * 0.2, // 20% growth estimate
        temporarySpaceRequired: currentDbSize * 0.5, // 50% for temp operations
        backupSpaceRequired: currentDbSize * 2, // Full backup + incremental
      },
      memory: {
        peakMemoryUsage: Math.max(512 * 1024 * 1024, currentDbSize * 0.1), // Min 512MB or 10% of DB
        recommendedMemory: Math.max(1024 * 1024 * 1024, currentDbSize * 0.2), // Min 1GB or 20% of DB
      },
      cpu: {
        estimatedCpuTime: plan.estimatedDuration * 60 * 1000, // Convert to milliseconds
        recommendedCores: migrationComplexity > 50 ? 4 : 2,
      },
      network: {
        dataTransferRequired: 0, // Local migrations don't require network transfer
        estimatedBandwidth: 0,
      },
    };
  }

  /**
   * Generate migration timeline with milestones
   */
  generateMigrationTimeline(plan: MigrationPlan): {
    timeline: Array<{
      milestone: string;
      estimatedTime: Date;
      duration: number;
      phase: string;
      dependencies: string[];
      criticalPath: boolean;
    }>;
    criticalPath: string[];
    bufferTime: number;
    contingencyPlan: string[];
  } {
    const startTime = new Date();
    let currentTime = new Date(startTime);
    const timeline: any[] = [];
    const criticalPath: string[] = [];

    // Add pre-migration phase
    timeline.push({
      milestone: 'Pre-migration backup and validation',
      estimatedTime: new Date(currentTime),
      duration: 30, // 30 minutes
      phase: 'preparation',
      dependencies: [],
      criticalPath: true,
    });
    currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);

    // Add migration phases
    for (const phase of plan.phases) {
      timeline.push({
        milestone: `Phase: ${phase.name}`,
        estimatedTime: new Date(currentTime),
        duration: phase.estimatedDuration,
        phase: phase.name,
        dependencies: phase.dependencies,
        criticalPath: phase.rollbackPoint,
      });

      if (phase.rollbackPoint) {
        criticalPath.push(phase.name);
      }

      currentTime = new Date(currentTime.getTime() + phase.estimatedDuration * 60 * 1000);
    }

    // Add post-migration validation
    timeline.push({
      milestone: 'Post-migration validation and cleanup',
      estimatedTime: new Date(currentTime),
      duration: 15, // 15 minutes
      phase: 'validation',
      dependencies: ['all_migrations'],
      criticalPath: true,
    });

    return {
      timeline,
      criticalPath,
      bufferTime: plan.estimatedDuration * 0.2, // 20% buffer
      contingencyPlan: [
        'Immediate rollback if critical validation fails',
        'Emergency data recovery procedures',
        'Escalation to technical lead if rollback fails',
      ],
    };
  }

  // Private implementation methods

  private initializeMVPDefinitions(): void {
    this.mvpDefinitions.set(1, {
      version: 1,
      name: 'Knowledge Base Assistant',
      features: ['basic_kb', 'search', 'gemini_integration'],
      requiredTables: ['kb_entries', 'kb_tags', 'search_history'],
      schemaVersion: 10,
    });

    this.mvpDefinitions.set(2, {
      version: 2,
      name: 'Pattern Detection & Enrichment',
      features: ['incident_import', 'pattern_detection', 'alerts'],
      requiredTables: ['incidents', 'patterns', 'alerts'],
      schemaVersion: 20,
    });

    this.mvpDefinitions.set(3, {
      version: 3,
      name: 'Code Analysis Integration',
      features: ['cobol_parsing', 'kb_code_linking', 'guided_debugging'],
      requiredTables: ['code_files', 'kb_code_links', 'code_analysis'],
      schemaVersion: 30,
    });

    this.mvpDefinitions.set(4, {
      version: 4,
      name: 'IDZ Integration & Templates',
      features: ['idz_import', 'templates', 'workspace_management'],
      requiredTables: ['projects', 'templates', 'workspaces'],
      schemaVersion: 40,
    });

    this.mvpDefinitions.set(5, {
      version: 5,
      name: 'Enterprise Intelligence Platform',
      features: ['auto_resolution', 'predictive_analytics', 'enterprise_features'],
      requiredTables: ['ml_models', 'auto_resolutions', 'analytics'],
      schemaVersion: 50,
    });
  }

  private getCurrentVersion(): number {
    try {
      const result = this.db
        .prepare(
          `
        SELECT COALESCE(MAX(version), 0) as version 
        FROM schema_migrations
      `
        )
        .get() as { version: number };
      return result.version;
    } catch {
      return 0;
    }
  }

  private detectCurrentMVP(version: number): number {
    if (version >= 50) return 5;
    if (version >= 40) return 4;
    if (version >= 30) return 3;
    if (version >= 20) return 2;
    if (version >= 10) return 1;
    return 0;
  }

  private calculateOptimalMigrationPath(fromMVP: number, toMVP: number): MVPMigrationPath {
    // For sequential MVP upgrades, the optimal path is usually direct
    const intermediateSteps: number[] = [];
    for (let mvp = fromMVP + 1; mvp <= toMVP; mvp++) {
      intermediateSteps.push(mvp);
    }

    return {
      from: fromMVP,
      to: toMVP,
      intermediateSteps,
      criticalPath: true,
      alternativeRoutes: [], // No alternative routes for MVP upgrades
    };
  }

  private async loadMigrationsForPath(path: MVPMigrationPath): Promise<Migration[]> {
    const migrations: Migration[] = [];

    for (const mvp of path.intermediateSteps) {
      const mvpMigrations = await this.loadMigrationsForMVP(mvp);
      migrations.push(...mvpMigrations);
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  private async loadMigrationsForMVP(mvp: number): Promise<Migration[]> {
    const mvpPath = path.join(this.migrationsPath, `mvp${mvp}`);
    const migrations: Migration[] = [];

    if (!fs.existsSync(mvpPath)) {
      return migrations;
    }

    const files = fs
      .readdirSync(mvpPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;

      const version = parseInt(match[1]);
      const description = match[2].replace(/_/g, ' ');
      const filePath = path.join(mvpPath, file);
      const content = fs.readFileSync(filePath, 'utf8');

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

  private organizeMigrationsIntoPhases(
    migrations: Migration[],
    path: MVPMigrationPath
  ): MigrationPhase[] {
    const phases: MigrationPhase[] = [];

    for (const mvp of path.intermediateSteps) {
      const mvpMigrations = migrations.filter(m => this.getMVPForVersion(m.version) === mvp);

      if (mvpMigrations.length > 0) {
        const mvpDef = this.mvpDefinitions.get(mvp);
        phases.push({
          name: `MVP${mvp} Upgrade`,
          description: mvpDef?.name || `Upgrade to MVP ${mvp}`,
          migrations: mvpMigrations.map(m => m.version),
          estimatedDuration: this.estimatePhaseDuration(mvpMigrations),
          canRunInParallel: false, // MVP upgrades are sequential
          dependencies: mvp > 1 ? [`MVP${mvp - 1} Upgrade`] : [],
          rollbackPoint: true,
        });
      }
    }

    return phases;
  }

  private getMVPForVersion(version: number): number {
    return Math.floor(version / 10);
  }

  private estimatePhaseDuration(migrations: Migration[]): number {
    let duration = 0;

    for (const migration of migrations) {
      // Base time: 2 minutes per migration
      duration += 2;

      // Add complexity-based time
      const lines = migration.up.split('\n').length;
      if (lines > 50) duration += 3;
      if (lines > 100) duration += 5;

      // Add time for specific operations
      if (migration.up.includes('CREATE TABLE')) duration += 1;
      if (migration.up.includes('CREATE INDEX')) duration += 2;
      if (migration.up.includes('INSERT INTO')) duration += 3;
    }

    return duration;
  }

  private calculateTotalEstimatedDuration(phases: MigrationPhase[]): number {
    return phases.reduce((total, phase) => total + phase.estimatedDuration, 0);
  }

  private assessOverallRiskLevel(
    migrations: Migration[],
    path: MVPMigrationPath
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Risk based on number of MVPs being upgraded
    riskScore += (path.to - path.from) * 2;

    // Risk based on migration content
    for (const migration of migrations) {
      if (migration.up.includes('DROP TABLE')) riskScore += 10;
      if (migration.up.includes('DROP COLUMN')) riskScore += 8;
      if (migration.up.includes('DELETE FROM')) riskScore += 6;
      if (migration.description.toLowerCase().includes('breaking')) riskScore += 8;
    }

    if (riskScore >= 25) return 'critical';
    if (riskScore >= 15) return 'high';
    if (riskScore >= 8) return 'medium';
    return 'low';
  }

  private assessDowntimeRequirement(migrations: Migration[]): boolean {
    return migrations.some(
      m =>
        m.up.includes('DROP TABLE') ||
        (m.up.includes('ALTER TABLE') && m.up.includes('DROP')) ||
        m.description.toLowerCase().includes('breaking')
    );
  }

  private assessBackupRequirement(migrations: Migration[]): boolean {
    // Always require backup for MVP upgrades
    return true;
  }

  private selectRollbackStrategy(path: MVPMigrationPath): string {
    if (path.to - path.from === 1) {
      return 'single_mvp_rollback';
    } else if (path.to - path.from <= 2) {
      return 'staged_rollback';
    } else {
      return 'full_restore_from_backup';
    }
  }

  private generatePrerequisites(path: MVPMigrationPath): string[] {
    const prerequisites = [
      'Database backup completed and verified',
      'Sufficient disk space available',
      'Application shutdown during migration window',
    ];

    if (path.to >= 4) {
      prerequisites.push('IDZ environment configured');
    }

    if (path.to >= 5) {
      prerequisites.push('Enterprise authentication configured');
      prerequisites.push('ML model storage prepared');
    }

    return prerequisites;
  }

  private generatePostMigrationTasks(targetMVP: number): string[] {
    const tasks = [
      'Verify all migrations applied successfully',
      'Run data integrity checks',
      'Test core application functionality',
    ];

    if (targetMVP >= 2) {
      tasks.push('Verify pattern detection engine');
    }

    if (targetMVP >= 3) {
      tasks.push('Test code analysis integration');
    }

    if (targetMVP >= 4) {
      tasks.push('Verify IDZ import/export functionality');
    }

    if (targetMVP >= 5) {
      tasks.push('Test auto-resolution system');
      tasks.push('Verify enterprise security features');
    }

    return tasks;
  }

  private generateValidationChecks(migrations: Migration[], targetMVP: number): ValidationCheck[] {
    const checks: ValidationCheck[] = [
      {
        type: 'schema',
        description: 'Verify all required tables exist',
        critical: true,
        query: 'SELECT name FROM sqlite_master WHERE type="table" ORDER BY name',
      },
      {
        type: 'data',
        description: 'Verify data integrity',
        critical: true,
      },
    ];

    const mvpDef = this.mvpDefinitions.get(targetMVP);
    if (mvpDef) {
      for (const table of mvpDef.requiredTables) {
        checks.push({
          type: 'schema',
          description: `Verify ${table} table exists`,
          critical: true,
          query: `SELECT name FROM sqlite_master WHERE type="table" AND name="${table}"`,
        });
      }
    }

    return checks;
  }

  private async validateMigrationPlan(plan: MigrationPlan): Promise<void> {
    // Validate migration sequence
    const versions = plan.migrations.map(m => m.version).sort((a, b) => a - b);
    for (let i = 1; i < versions.length; i++) {
      if (versions[i] <= versions[i - 1]) {
        throw new Error(`Invalid migration sequence: ${versions[i - 1]} -> ${versions[i]}`);
      }
    }

    // Validate MVP progression
    if (plan.targetMVP <= plan.currentMVP) {
      throw new Error(
        `Target MVP ${plan.targetMVP} must be greater than current MVP ${plan.currentMVP}`
      );
    }
  }

  private generateAllPossiblePaths(fromMVP: number, toMVP: number): MVPMigrationPath[] {
    // For MVP upgrades, there's typically only one valid path (sequential)
    return [this.calculateOptimalMigrationPath(fromMVP, toMVP)];
  }

  private async analyzeSinglePath(path: MVPMigrationPath): Promise<any> {
    const migrations = await this.loadMigrationsForPath(path);

    return {
      path,
      pros: this.generatePathPros(path),
      cons: this.generatePathCons(path),
      riskLevel: this.assessOverallRiskLevel(migrations, path),
      estimatedDuration: this.estimatePhaseDuration(migrations),
    };
  }

  private selectRecommendedPath(analyses: any[]): any {
    // For MVP upgrades, return the only available path
    return analyses[0];
  }

  private generatePathPros(path: MVPMigrationPath): string[] {
    return [
      'Sequential upgrade ensures compatibility',
      'Each MVP builds on previous features',
      'Rollback points at each MVP level',
    ];
  }

  private generatePathCons(path: MVPMigrationPath): string[] {
    const cons = [];

    if (path.to - path.from > 2) {
      cons.push('Multiple MVP upgrades increase overall risk');
      cons.push('Longer migration window required');
    }

    return cons;
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAppliedMigrationsSince(fromVersion: number): any[] {
    return this.db
      .prepare(
        `
      SELECT * FROM schema_migrations 
      WHERE version > ? 
      ORDER BY version DESC
    `
      )
      .all(fromVersion);
  }

  private generateRollbackSteps(migrations: any[]): any[] {
    return migrations.map((m, index) => ({
      step: index + 1,
      description: `Rollback migration ${m.version}: ${m.description}`,
      sql: m.rollback_sql,
      estimatedDuration: 2,
      riskLevel: 'medium',
    }));
  }

  private generateDataRecoverySteps(migrations: any[]): string[] {
    return [
      'Verify backup integrity before proceeding',
      'Stop all application processes',
      'Restore database from backup',
      'Verify data consistency after restore',
      'Restart application services',
    ];
  }

  private generateRollbackValidationSteps(migrations: any[]): string[] {
    return [
      'Verify schema version matches expected',
      'Run data integrity checks',
      'Test core application functionality',
      'Verify all features working as expected',
    ];
  }

  private getEmergencyContacts(): string[] {
    return [
      'Database Administrator: dba@company.com',
      'Technical Lead: lead@company.com',
      'System Administrator: sysadmin@company.com',
    ];
  }

  private getDatabaseSize(): number {
    try {
      const stats = fs.statSync(this.db.name);
      return stats.size;
    } catch {
      return 10 * 1024 * 1024; // Default 10MB
    }
  }

  private calculateMigrationComplexity(migrations: Migration[]): number {
    let complexity = 0;

    for (const migration of migrations) {
      complexity += migration.up.split('\n').length;
      if (migration.up.includes('CREATE TABLE')) complexity += 10;
      if (migration.up.includes('CREATE INDEX')) complexity += 5;
      if (migration.up.includes('INSERT INTO')) complexity += 15;
    }

    return complexity;
  }
}

interface MVPDefinition {
  version: number;
  name: string;
  features: string[];
  requiredTables: string[];
  schemaVersion: number;
}
