export interface MigrationConfig {
    sourceDB: string;
    targetDB: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
        ssl?: boolean;
    };
    batchSize: number;
    parallelWorkers: number;
    validateData: boolean;
    keepSQLite: boolean;
    rollbackOnError: boolean;
}
export interface MigrationStats {
    startTime: number;
    endTime?: number;
    tablesProcessed: number;
    recordsMigrated: number;
    errorCount: number;
    performanceComparison: {
        sqlite: {
            [operation: string]: number;
        };
        postgresql: {
            [operation: string]: number;
        };
    };
}
export interface FeatureParityCheck {
    feature: string;
    sqlite: boolean;
    postgresql: boolean;
    compatible: boolean;
    notes?: string;
}
export declare class PostgreSQLMigration {
    private sqliteDB;
    private pgPool;
    private config;
    private stats;
    constructor(config: MigrationConfig);
    migrate(): Promise<MigrationStats>;
    private performPreMigrationChecks;
    private createPostgreSQLSchema;
    private generatePostgreSQLSchema;
    private migrateDataPhased;
    private migrateTable;
    private validateMigration;
    private performPerformanceComparison;
    private optimizePostgreSQL;
    private checkFeatureParity;
    private getTableColumns;
    private generateInsertSQL;
    private transformRecord;
    private generateUUID;
    private validateSampleData;
    private createDataDrivenIndexes;
    private setupPostgreSQLMaintenance;
    private rollback;
    close(): Promise<void>;
}
//# sourceMappingURL=PostgreSQLMigration.d.ts.map