import Database from 'better-sqlite3';
import { Migration } from '../MigrationManager';
import { MigrationPlan } from './MigrationOrchestrator';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}
export interface SchemaValidation {
    tables: {
        name: string;
        exists: boolean;
        columns: {
            name: string;
            type: string;
            nullable: boolean;
            defaultValue?: string;
        }[];
        indexes: {
            name: string;
            columns: string[];
            unique: boolean;
        }[];
        constraints: string[];
    }[];
}
export declare class MigrationValidator {
    private db;
    constructor(db: Database.Database);
    validateMigrationPlan(plan: MigrationPlan): Promise<ValidationResult>;
    validatePreMigration(migration: Migration): Promise<ValidationResult>;
    validatePostMigration(migration: Migration): Promise<ValidationResult>;
    validateSqlSyntax(sql: string): Promise<ValidationResult>;
    getSchemaSnapshot(): Promise<SchemaValidation>;
    compareSchemas(before: SchemaValidation, after: SchemaValidation): {
        tablesAdded: string[];
        tablesDropped: string[];
        tablesModified: Array<{
            name: string;
            columnsAdded: string[];
            columnsDropped: string[];
            columnsModified: string[];
            indexesAdded: string[];
            indexesDropped: string[];
        }>;
    };
    private validateMigrationSequence;
    private validateMigrationConflicts;
    private validateResourceRequirements;
    private validateDependencies;
    private validateDestructiveOperations;
    private validateSchemaChanges;
    private validateDataIntegrity;
    private validateConstraints;
    private validateIndexes;
    private splitSqlStatements;
    private checkCommonSqlIssues;
    private extractTableOperations;
    private extractReferencedTables;
    private extractIndexNames;
    private getExistingTables;
    private getDatabaseSize;
    private estimateDatabaseGrowth;
}
//# sourceMappingURL=MigrationValidator.d.ts.map