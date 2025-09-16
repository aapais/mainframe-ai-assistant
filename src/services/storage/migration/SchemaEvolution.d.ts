import Database from 'better-sqlite3';
export interface SchemaVersion {
    version: number;
    mvp: number;
    timestamp: Date;
    description: string;
    changes: SchemaChange[];
    compatibility: CompatibilityInfo;
}
export interface SchemaChange {
    type: 'table' | 'column' | 'index' | 'constraint' | 'trigger';
    operation: 'create' | 'alter' | 'drop';
    target: string;
    details: any;
    reversible: boolean;
    breakingChange: boolean;
}
export interface CompatibilityInfo {
    backwardCompatible: boolean;
    forwardCompatible: boolean;
    minimumClientVersion: string;
    deprecatedFeatures: string[];
    newFeatures: string[];
}
export interface SchemaEvolutionPlan {
    currentSchema: SchemaSnapshot;
    targetSchema: SchemaSnapshot;
    evolutionSteps: SchemaEvolutionStep[];
    compatibilityMatrix: CompatibilityMatrix;
    riskAssessment: SchemaRiskAssessment;
}
export interface SchemaSnapshot {
    version: number;
    mvp: number;
    timestamp: Date;
    tables: TableDefinition[];
    indexes: IndexDefinition[];
    constraints: ConstraintDefinition[];
    triggers: TriggerDefinition[];
    checksum: string;
}
export interface SchemaEvolutionStep {
    step: number;
    description: string;
    sql: string;
    reversible: boolean;
    estimatedDuration: number;
    dataImpact: 'none' | 'minimal' | 'moderate' | 'significant';
    dependencies: number[];
}
export interface CompatibilityMatrix {
    versions: number[];
    compatibility: {
        [fromVersion: number]: {
            [toVersion: number]: 'compatible' | 'degraded' | 'incompatible';
        };
    };
}
export interface SchemaRiskAssessment {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: Array<{
        factor: string;
        severity: 'low' | 'medium' | 'high';
        impact: string;
        mitigation: string;
    }>;
    recommendations: string[];
}
export declare class SchemaEvolution {
    private db;
    private mvpSchemaDefinitions;
    constructor(db: Database.Database);
    detectCurrentMVP(version?: number): number;
    createEvolutionPlan(targetMVP: number): Promise<SchemaEvolutionPlan>;
    recordMVPUpgrade(mvp: number): Promise<void>;
    analyzeCompatibility(fromVersion: number, toVersion: number): Promise<{
        compatible: boolean;
        issues: Array<{
            type: 'breaking' | 'warning' | 'info';
            description: string;
            impact: string;
            resolution: string;
        }>;
        migrationRequired: boolean;
        autoMigratable: boolean;
    }>;
    generateSchemaDiff(fromVersion: number, toVersion: number): {
        tablesAdded: string[];
        tablesRemoved: string[];
        tablesModified: Array<{
            table: string;
            columnsAdded: string[];
            columnsRemoved: string[];
            columnsModified: string[];
        }>;
        indexesAdded: string[];
        indexesRemoved: string[];
        constraintsChanged: string[];
    };
    validateSchemaIntegrity(): Promise<{
        valid: boolean;
        issues: Array<{
            severity: 'error' | 'warning';
            category: 'structure' | 'data' | 'reference' | 'index';
            description: string;
            location: string;
            suggestion: string;
        }>;
        statistics: {
            totalTables: number;
            totalIndexes: number;
            totalConstraints: number;
            orphanedRecords: number;
            integrityViolations: number;
        };
    }>;
    backupSchema(): Promise<string>;
    restoreSchemaFromBackup(backupId: string): Promise<void>;
    private initializeSchemaTracking;
    private loadMVPSchemaDefinitions;
    private captureCurrentSchema;
    private getCurrentTables;
    private getCurrentIndexes;
    private getCurrentConstraints;
    private getCurrentTriggers;
    private hasTable;
    private getCurrentSchemaVersion;
    private calculateSchemaChecksum;
    private generateTargetSchema;
    private calculateEvolutionSteps;
    private generateCompatibilityMatrix;
    private assessEvolutionRisk;
    private generateRiskRecommendations;
    private extractTableFromIndexSql;
    private extractColumnsFromIndexSql;
    private extractTableFromTriggerSql;
    private extractEventFromTriggerSql;
    private generateCreateTableSql;
    private emit;
    private compareSchemas;
    private calculateSchemaDiff;
    private getSchemaAtVersion;
    private getRecentChanges;
    private validateTableStructures;
    private validateReferentialIntegrity;
    private validateIndexIntegrity;
    private gatherSchemaStatistics;
    private generateBackupId;
    private restoreSchemaStructure;
}
interface TableDefinition {
    name: string;
    columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        defaultValue?: string;
        primaryKey?: boolean;
    }>;
    foreignKeys?: Array<{
        column: string;
        references: string;
    }>;
}
interface IndexDefinition {
    name: string;
    table: string;
    columns: string[];
    unique: boolean;
    sql: string;
}
interface ConstraintDefinition {
    name: string;
    type: string;
    table: string;
    sql: string;
}
interface TriggerDefinition {
    name: string;
    table: string;
    event: string;
    sql: string;
}
export {};
//# sourceMappingURL=SchemaEvolution.d.ts.map