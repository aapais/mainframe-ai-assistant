import Database from 'better-sqlite3';
import { Migration, MigrationResult } from '../../../database/MigrationManager';
import { EventEmitter } from 'events';
export interface DataTransformation {
    id: string;
    name: string;
    description: string;
    sourceTable: string;
    targetTable: string;
    transformationType: 'copy' | 'convert' | 'merge' | 'split' | 'enrich' | 'migrate';
    sql: string;
    reversible: boolean;
    estimatedRows: number;
    estimatedDuration: number;
    dependencies: string[];
    validationQueries: string[];
}
export interface TransformationPlan {
    transformations: DataTransformation[];
    executionOrder: string[];
    totalEstimatedDuration: number;
    dataVolumeImpact: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export interface TransformationResult {
    transformationId: string;
    success: boolean;
    rowsProcessed: number;
    duration: number;
    error?: string;
    validationResults?: ValidationResult[];
}
export interface ValidationResult {
    query: string;
    expected: any;
    actual: any;
    passed: boolean;
    message?: string;
}
export interface MVPDataMigration {
    fromMVP: number;
    toMVP: number;
    transformations: DataTransformation[];
    dataPreservationStrategy: 'full' | 'selective' | 'archive';
    rollbackStrategy: string;
}
export declare class DataTransformer extends EventEmitter {
    private db;
    private transformationRegistry;
    private mvpMigrations;
    constructor(db: Database.Database);
    prepareForMigration(plan: any): Promise<TransformationPlan>;
    executeMigrationWithTransformation(migration: Migration): Promise<MigrationResult>;
    simulateTransformation(migration: Migration): Promise<{
        transformations: DataTransformation[];
        estimatedImpact: {
            rowsAffected: number;
            tablesModified: string[];
            duration: number;
        };
        risks: string[];
    }>;
    executeMVPDataMigration(fromMVP: number, toMVP: number, options?: {
        preserveData?: boolean;
        validateResults?: boolean;
        createBackup?: boolean;
    }): Promise<TransformationResult[]>;
    enrichDataForMVP(targetMVP: number): Promise<TransformationResult[]>;
    archiveOldData(mvp: number, archiveStrategy: 'compress' | 'export' | 'delete'): Promise<{
        archivedTables: string[];
        archivedRows: number;
        archiveSize: number;
        archivePath?: string;
    }>;
    validateDataIntegrity(transformationResults: TransformationResult[]): Promise<{
        valid: boolean;
        issues: Array<{
            type: 'missing_data' | 'duplicate_data' | 'invalid_reference' | 'constraint_violation';
            table: string;
            description: string;
            count: number;
            severity: 'error' | 'warning';
        }>;
        statistics: {
            totalRowsValidated: number;
            tablesChecked: number;
            integrityViolations: number;
        };
    }>;
    private initializeTransformationTracking;
    private registerMVPTransformations;
    private identifyRequiredTransformations;
    private calculateOptimalExecutionOrder;
    private calculateTotalDuration;
    private estimateDataVolumeImpact;
    private assessTransformationRisk;
    private validateTransformationPlan;
    private getTransformationsForMigration;
    private executeTransformation;
    private executeTransformationWithValidation;
    private rollbackPartialTransformation;
    private createDataBackup;
    private detectCustomTransformations;
    private getTableRowCount;
    private tableExists;
    private runValidationQuery;
    private generateRollbackSql;
    private getEnrichmentTransformations;
    private executeDataEnrichment;
    private getTablesForArchival;
    private archiveTableData;
    private validateTableIntegrity;
    private validateMVPMigrationResults;
}
//# sourceMappingURL=DataTransformer.d.ts.map