import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface PostgresMigrationConfig {
    sourceDb: Database.Database;
    targetConfig: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
        ssl?: boolean;
        maxConnections?: number;
    };
    options: {
        batchSize?: number;
        maxConcurrency?: number;
        validateData?: boolean;
        createIndexesLast?: boolean;
        useTransactions?: boolean;
        continueOnError?: boolean;
        dryRun?: boolean;
    };
}
export interface PostgresMigrationPlan {
    schemaMapping: SchemaMapping[];
    dataMapping: DataMapping[];
    indexMapping: IndexMapping[];
    triggerMapping: TriggerMapping[];
    estimatedDuration: number;
    estimatedSize: number;
    compatibility: {
        fullyCompatible: string[];
        requiresTransformation: string[];
        unsupported: string[];
    };
}
interface SchemaMapping {
    sqliteTable: string;
    postgresTable: string;
    columns: ColumnMapping[];
    constraints: ConstraintMapping[];
}
interface ColumnMapping {
    sqliteName: string;
    postgresName: string;
    sqliteType: string;
    postgresType: string;
    requiresTransformation: boolean;
    transformFunction?: (value: any) => any;
}
interface DataMapping {
    sourceTable: string;
    targetTable: string;
    rowCount: number;
    transformationRequired: boolean;
    dependencies: string[];
}
interface IndexMapping {
    sqliteIndex: string;
    postgresIndex: string;
    indexType: string;
    columns: string[];
    isUnique: boolean;
    createAfterData: boolean;
}
interface TriggerMapping {
    sqliteTrigger: string;
    postgresFunction: string;
    postgresTrigger: string;
    requiresRewrite: boolean;
}
export declare class PostgresMigrator extends EventEmitter {
    private sourceDb;
    private targetPool;
    private config;
    private migrationPlan?;
    private isRunning;
    constructor(config: PostgresMigrationConfig);
    analyzeMigration(): Promise<PostgresMigrationPlan>;
    executeMigration(plan?: PostgresMigrationPlan): Promise<{
        success: boolean;
        migratedTables: string[];
        errors: string[];
        warnings: string[];
        duration: number;
    }>;
    generatePostgresSchema(): Promise<string>;
    testConnection(): Promise<boolean>;
    private analyzeSchemaMigration;
    private analyzeTableColumns;
    private analyzeTableConstraints;
    private analyzeDataMigration;
    private analyzeIndexMigration;
    private analyzeTriggerMigration;
    private mapSqliteTypeToPostgres;
    private requiresTypeTransformation;
    private getTypeTransformFunction;
    private generateTableSchema;
    private generateIndexSchema;
    private generateTriggerSchema;
    private migrateData;
    private migrateTableData;
    private insertBatchToPostgres;
    private convertTableName;
    private convertIndexName;
    private convertTriggerName;
    private estimateMigrationDuration;
    private estimateDataSize;
    private analyzeCompatibility;
    private getOriginalColumnInfo;
    private getTableForIndex;
    private requiresDataTransformation;
    private getTableDependencies;
    private sortByDependencies;
    private determineIndexType;
    private convertTriggerToFunction;
    private convertTriggerSyntax;
    private requiresTriggerRewrite;
    private createPostgresSchema;
    private createIndexes;
    private createTriggersAndFunctions;
    private validateMigratedData;
    private cleanupFailedMigration;
    close(): Promise<void>;
}
interface ConstraintMapping {
    type: 'foreign_key' | 'unique' | 'check' | 'primary_key';
    sqliteDefinition: string;
    postgresDefinition: string;
}
export {};
//# sourceMappingURL=PostgresMigrator.d.ts.map