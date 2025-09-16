import Database from 'better-sqlite3';
export interface Migration {
    version: number;
    description: string;
    up: string;
    down: string;
    checksum?: string;
}
export interface MigrationResult {
    success: boolean;
    version: number;
    error?: string;
    duration: number;
}
export declare class MigrationManager {
    private db;
    private migrationsPath;
    constructor(db: Database.Database, migrationsPath?: string);
    private ensureMigrationsTable;
    getCurrentVersion(): number;
    private loadMigrations;
    migrate(): Promise<MigrationResult[]>;
    private applyMigration;
    rollback(targetVersion: number): Promise<MigrationResult[]>;
    private rollbackMigration;
    private createMigrationBackup;
    generateSchemaDiff(fromVersion: number, toVersion: number): string;
    validateMigrations(): {
        valid: boolean;
        errors: string[];
    };
    private calculateChecksum;
    getStatus(): {
        currentVersion: number;
        pendingMigrations: number;
        appliedMigrations: Array<{
            version: number;
            description: string;
            applied_at: string;
            duration_ms: number;
        }>;
    };
}
export declare class MigrationGenerator {
    static generate(description: string, migrationsPath: string): string;
}
//# sourceMappingURL=MigrationManager.d.ts.map