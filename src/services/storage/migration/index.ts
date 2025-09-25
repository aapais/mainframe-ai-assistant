/**
 * Migration Framework - Comprehensive Database Migration and Schema Evolution System
 *
 * This module provides a complete migration framework supporting schema evolution
 * across MVP transitions with rollback capabilities, data transformation utilities,
 * and comprehensive validation.
 */

// Main Migration Service
export { MigrationService } from './MigrationService';
export type {
  MVPMigrationConfig,
  MigrationExecutionOptions,
  MigrationProgress,
} from './MigrationService';

// Migration Planning
export { MigrationPlanner } from './MigrationPlanner';
export type {
  MigrationPlan,
  MigrationPhase,
  ValidationCheck,
  MVPMigrationPath,
} from './MigrationPlanner';

// Schema Evolution Management
export { SchemaEvolution } from './SchemaEvolution';
export type {
  SchemaVersion,
  SchemaChange,
  CompatibilityInfo,
  SchemaEvolutionPlan,
  SchemaSnapshot,
  SchemaRiskAssessment,
} from './SchemaEvolution';

// Data Transformation
export { DataTransformer } from './DataTransformer';
export type {
  DataTransformation,
  TransformationPlan,
  TransformationResult,
  MVPDataMigration,
} from './DataTransformer';

// Rollback Management
export { RollbackManager } from './RollbackManager';
export type {
  RollbackPlan,
  RollbackStep,
  RollbackResult,
  EmergencyRollbackPlan,
  RollbackCheckpoint,
} from './RollbackManager';

// Validation Services
export { ValidationService } from './ValidationService';
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ComprehensiveValidationReport,
  SchemaValidationResult,
  DataIntegrityResult,
  ReferentialIntegrityResult,
  ValidationSummary,
} from './ValidationService';

/**
 * Migration Framework Factory
 *
 * Provides a convenient way to initialize the complete migration framework
 * with all services properly configured and interconnected.
 */
import Database from 'better-sqlite3';
import { MigrationService } from './MigrationService';
import { MigrationPlanner } from './MigrationPlanner';
import { SchemaEvolution } from './SchemaEvolution';
import { DataTransformer } from './DataTransformer';
import { RollbackManager } from './RollbackManager';
import { ValidationService } from './ValidationService';

export interface MigrationFrameworkConfig {
  database: Database.Database;
  migrationsPath?: string;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  backupPath?: string;
}

export interface MigrationFramework {
  migrationService: MigrationService;
  planner: MigrationPlanner;
  schemaEvolution: SchemaEvolution;
  dataTransformer: DataTransformer;
  rollbackManager: RollbackManager;
  validation: ValidationService;
}

/**
 * Creates a complete migration framework with all services configured
 */
export function createMigrationFramework(config: MigrationFrameworkConfig): MigrationFramework {
  const {
    database,
    migrationsPath = './src/database/migrations/mvp-upgrades',
    enableLogging = true,
    enableMetrics = true,
  } = config;

  // Initialize all services
  const validation = new ValidationService(database);
  const schemaEvolution = new SchemaEvolution(database);
  const dataTransformer = new DataTransformer(database);
  const rollbackManager = new RollbackManager(database);
  const planner = new MigrationPlanner(database, migrationsPath);
  const migrationService = new MigrationService(database, migrationsPath);

  // Setup logging if enabled
  if (enableLogging) {
    setupFrameworkLogging({
      migrationService,
      planner,
      schemaEvolution,
      dataTransformer,
      rollbackManager,
      validation,
    });
  }

  // Setup metrics collection if enabled
  if (enableMetrics) {
    setupFrameworkMetrics({
      migrationService,
      planner,
      schemaEvolution,
      dataTransformer,
      rollbackManager,
      validation,
    });
  }

  return {
    migrationService,
    planner,
    schemaEvolution,
    dataTransformer,
    rollbackManager,
    validation,
  };
}

/**
 * Setup comprehensive logging across all migration framework services
 */
function setupFrameworkLogging(framework: MigrationFramework): void {
  const logger = (service: string, event: string, data: any) => {
    console.log(`[${new Date().toISOString()}] [${service}] ${event}:`, data);
  };

  // Migration Service logging
  framework.migrationService.on('migrationStarted', data =>
    logger('MigrationService', 'Migration Started', data)
  );
  framework.migrationService.on('migrationStepCompleted', data =>
    logger('MigrationService', 'Step Completed', data)
  );
  framework.migrationService.on('migrationCompleted', data =>
    logger('MigrationService', 'Migration Completed', data)
  );
  framework.migrationService.on('migrationFailed', data =>
    logger('MigrationService', 'Migration Failed', data)
  );

  // Rollback Manager logging
  framework.rollbackManager.on('rollbackStarted', data =>
    logger('RollbackManager', 'Rollback Started', data)
  );
  framework.rollbackManager.on('rollbackCompleted', data =>
    logger('RollbackManager', 'Rollback Completed', data)
  );
  framework.rollbackManager.on('emergencyRollbackStarted', data =>
    logger('RollbackManager', 'Emergency Rollback Started', data)
  );

  // Data Transformer logging
  framework.dataTransformer.on('transformationCompleted', data =>
    logger('DataTransformer', 'Transformation Completed', data)
  );

  // Validation Service logging
  framework.validation.on('validationStarted', data =>
    logger('ValidationService', 'Validation Started', data)
  );
  framework.validation.on('validationCompleted', data =>
    logger('ValidationService', 'Validation Completed', data)
  );
}

/**
 * Setup metrics collection across all migration framework services
 */
function setupFrameworkMetrics(framework: MigrationFramework): void {
  const metrics = {
    migrationsExecuted: 0,
    rollbacksPerformed: 0,
    transformationsCompleted: 0,
    validationsRun: 0,
    totalMigrationTime: 0,
    errorCount: 0,
  };

  // Track migration metrics
  framework.migrationService.on('migrationCompleted', data => {
    metrics.migrationsExecuted++;
    metrics.totalMigrationTime += data.totalDuration || 0;
  });

  framework.migrationService.on('migrationFailed', () => {
    metrics.errorCount++;
  });

  // Track rollback metrics
  framework.rollbackManager.on('rollbackCompleted', () => {
    metrics.rollbacksPerformed++;
  });

  // Track transformation metrics
  framework.dataTransformer.on('transformationCompleted', () => {
    metrics.transformationsCompleted++;
  });

  // Track validation metrics
  framework.validation.on('validationCompleted', () => {
    metrics.validationsRun++;
  });

  // Expose metrics getter
  (framework as any).getMetrics = () => ({ ...metrics });
}

/**
 * Utility functions for common migration operations
 */
export const MigrationUtils = {
  /**
   * Quick health check of the migration framework
   */
  async healthCheck(framework: MigrationFramework): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check validation service
      const validationResult = await framework.validation.validatePreMigrationState();
      if (!validationResult.isValid) {
        issues.push('Pre-migration validation failed');
        recommendations.push('Fix validation errors before proceeding');
      }

      // Check schema evolution
      const currentMVP = framework.schemaEvolution.detectCurrentMVP();
      if (currentMVP === 0) {
        issues.push('Unable to detect current MVP version');
        recommendations.push('Initialize database with MVP1 schema');
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      return {
        healthy: false,
        issues: ['Migration framework health check failed'],
        recommendations: ['Check database connectivity and framework configuration'],
      };
    }
  },

  /**
   * Generate migration summary report
   */
  async generateMigrationReport(framework: MigrationFramework): Promise<{
    currentState: any;
    capabilities: string[];
    recommendations: string[];
  }> {
    const currentMVP = framework.schemaEvolution.detectCurrentMVP();
    const validationResult = await framework.validation.performComprehensiveValidation();

    return {
      currentState: {
        mvp: currentMVP,
        overallHealth: validationResult.summary.overallHealth,
        criticalIssues: validationResult.summary.criticalIssues,
        warnings: validationResult.summary.warnings,
      },
      capabilities: [
        'Schema evolution management',
        'Data transformation pipelines',
        'Comprehensive rollback support',
        'Migration validation and safety checks',
        'MVP progression tracking',
      ],
      recommendations:
        validationResult.summary.recommendationsCount > 0
          ? ['Review validation report for specific recommendations']
          : ['System is healthy for migrations'],
    };
  },
};

/**
 * Migration Framework Version and Feature Support
 */
export const MIGRATION_FRAMEWORK_VERSION = '1.0.0';

export const SUPPORTED_FEATURES = {
  schemaEvolution: true,
  dataTransformation: true,
  rollbackSupport: true,
  validationChecks: true,
  mvpProgression: true,
  emergencyRecovery: true,
  performanceMonitoring: true,
  integrityValidation: true,
} as const;

/**
 * Default configuration for common use cases
 */
export const DEFAULT_MIGRATION_CONFIG: Partial<MigrationFrameworkConfig> = {
  migrationsPath: './src/database/migrations/mvp-upgrades',
  enableLogging: true,
  enableMetrics: true,
};
