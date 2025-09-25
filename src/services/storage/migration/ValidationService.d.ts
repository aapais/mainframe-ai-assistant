import Database from 'better-sqlite3';
import { Migration } from '../../../database/MigrationManager';
import { EventEmitter } from 'events';
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  performance: PerformanceMetrics;
  recommendations: string[];
}
export interface ValidationError {
  type: 'schema' | 'data' | 'reference' | 'constraint' | 'syntax';
  severity: 'critical' | 'high' | 'medium';
  code: string;
  message: string;
  location?: string;
  query?: string;
  suggestion: string;
}
export interface ValidationWarning {
  type: 'performance' | 'compatibility' | 'deprecation' | 'best_practice';
  message: string;
  location?: string;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
}
export interface PerformanceMetrics {
  queryTime: number;
  tablesScanned: number;
  rowsValidated: number;
  indexUtilization: number;
  memoryUsage: number;
}
export interface ComprehensiveValidationReport {
  schemaConsistency: SchemaValidationResult;
  dataIntegrity: DataIntegrityResult;
  referentialIntegrity: ReferentialIntegrityResult;
  indexIntegrity: IndexIntegrityResult;
  constraintValidation: ConstraintValidationResult;
  performanceValidation: PerformanceValidationResult;
  mvpCompliance: MVPComplianceResult;
  summary: ValidationSummary;
}
export interface SchemaValidationResult {
  valid: boolean;
  issues: ValidationError[];
  tableCount: number;
  columnCount: number;
  indexCount: number;
  missingTables: string[];
  unexpectedTables: string[];
  structuralIssues: string[];
}
export interface DataIntegrityResult {
  valid: boolean;
  issues: ValidationError[];
  totalRows: number;
  corruptedRows: number;
  duplicateRows: number;
  orphanedRecords: number;
  nullConstraintViolations: number;
}
export interface ReferentialIntegrityResult {
  valid: boolean;
  issues: ValidationError[];
  foreignKeyViolations: number;
  brokenReferences: number;
  circularReferences: number;
  missingParentRecords: number;
}
export interface IndexIntegrityResult {
  valid: boolean;
  issues: ValidationError[];
  totalIndexes: number;
  corruptedIndexes: number;
  unusedIndexes: number;
  missingRecommendedIndexes: string[];
  duplicateIndexes: string[];
}
export interface ConstraintValidationResult {
  valid: boolean;
  issues: ValidationError[];
  constraintViolations: number;
  checkConstraintFailures: number;
  uniqueConstraintViolations: number;
}
export interface PerformanceValidationResult {
  acceptable: boolean;
  issues: ValidationWarning[];
  slowQueries: string[];
  recommendedOptimizations: string[];
  resourceUtilization: {
    cpu: number;
    memory: number;
    disk: number;
  };
}
export interface MVPComplianceResult {
  compliant: boolean;
  currentMVP: number;
  expectedFeatures: string[];
  missingFeatures: string[];
  deprecatedFeatures: string[];
  migrationRequired: boolean;
}
export interface ValidationSummary {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  criticalIssues: number;
  warnings: number;
  recommendationsCount: number;
  migrationSafety: 'safe' | 'caution' | 'risky' | 'dangerous';
  estimatedFixTime: number;
}
export declare class ValidationService extends EventEmitter {
  private db;
  private validationHistory;
  private mvpValidationRules;
  constructor(db: Database.Database);
  performComprehensiveValidation(): Promise<ComprehensiveValidationReport>;
  validateMigrationPlan(plan: any): Promise<ValidationResult>;
  validateMigrationSql(migration: Migration): Promise<ValidationResult>;
  validatePreMigrationState(): Promise<ValidationResult>;
  validatePostMigration(migration: Migration): Promise<ValidationResult>;
  validateRollbackResult(targetVersion: number): Promise<ValidationResult>;
  private initializeValidationTracking;
  private setupMVPValidationRules;
  private validateSchemaConsistency;
  private validateDataIntegrity;
  private validateReferentialIntegrity;
  private validateIndexIntegrity;
  private validateConstraints;
  private validatePerformance;
  private validateMVPCompliance;
  private generateValidationSummary;
  private storeValidationResult;
  private getCurrentVersion;
  private detectCurrentMVP;
  private getAllTables;
  private getTableRowCount;
  private getExpectedTables;
  private getTotalColumnCount;
  private getTotalIndexCount;
  private checkTableStructures;
  private findDuplicateRows;
  private findNullConstraintViolations;
  private findOrphanedRecords;
  private getAllForeignKeys;
  private checkForeignKeyViolations;
  private getAllIndexes;
  private testIndexUsage;
  private checkUniqueConstraints;
  private findLargeTables;
  private findMissingIndexes;
  private getCommonQueries;
  private measureQueryPerformance;
  private validateMigrationSequence;
  private validateMigrationsSQL;
  private checkDangerousOperations;
  private validateMigrationDependencies;
  private assessDataImpact;
  private assessPerformanceImpact;
  private checkCommonSqlIssues;
  private validateRollbackCompleteness;
  private validateBestPractices;
  private checkDiskSpace;
  private checkActiveTransactions;
  private validateCurrentSchema;
  private validateExpectedChanges;
  private validateDataConsistencyAfterMigration;
  private validatePerformanceAfterMigration;
  private validateSchemaAtVersion;
  private validateNoUnexpectedDataLoss;
}
//# sourceMappingURL=ValidationService.d.ts.map
