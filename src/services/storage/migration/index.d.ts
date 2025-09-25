export { MigrationService } from './MigrationService';
export type {
  MVPMigrationConfig,
  MigrationExecutionOptions,
  MigrationProgress,
} from './MigrationService';
export { MigrationPlanner } from './MigrationPlanner';
export type {
  MigrationPlan,
  MigrationPhase,
  ValidationCheck,
  MVPMigrationPath,
} from './MigrationPlanner';
export { SchemaEvolution } from './SchemaEvolution';
export type {
  SchemaVersion,
  SchemaChange,
  CompatibilityInfo,
  SchemaEvolutionPlan,
  SchemaSnapshot,
  SchemaRiskAssessment,
} from './SchemaEvolution';
export { DataTransformer } from './DataTransformer';
export type {
  DataTransformation,
  TransformationPlan,
  TransformationResult,
  MVPDataMigration,
} from './DataTransformer';
export { RollbackManager } from './RollbackManager';
export type {
  RollbackPlan,
  RollbackStep,
  RollbackResult,
  EmergencyRollbackPlan,
  RollbackCheckpoint,
} from './RollbackManager';
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
export declare function createMigrationFramework(
  config: MigrationFrameworkConfig
): MigrationFramework;
export declare const MigrationUtils: {
  healthCheck(framework: MigrationFramework): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }>;
  generateMigrationReport(framework: MigrationFramework): Promise<{
    currentState: any;
    capabilities: string[];
    recommendations: string[];
  }>;
};
export declare const MIGRATION_FRAMEWORK_VERSION = '1.0.0';
export declare const SUPPORTED_FEATURES: {
  readonly schemaEvolution: true;
  readonly dataTransformation: true;
  readonly rollbackSupport: true;
  readonly validationChecks: true;
  readonly mvpProgression: true;
  readonly emergencyRecovery: true;
  readonly performanceMonitoring: true;
  readonly integrityValidation: true;
};
export declare const DEFAULT_MIGRATION_CONFIG: Partial<MigrationFrameworkConfig>;
//# sourceMappingURL=index.d.ts.map
