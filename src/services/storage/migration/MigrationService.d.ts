import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { Migration, MigrationResult } from '../../../database/MigrationManager';
export interface MVPMigrationConfig {
    fromMVP: number;
    toMVP: number;
    requiresDowntime: boolean;
    estimatedDuration: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    dataTransformations: string[];
    rollbackStrategy: string;
    validationChecks: string[];
}
export interface MigrationExecutionOptions {
    dryRun?: boolean;
    pauseBetweenSteps?: number;
    maxRetries?: number;
    continueOnWarning?: boolean;
    createCheckpoints?: boolean;
    enableRollback?: boolean;
    validateIntegrity?: boolean;
    preserveData?: boolean;
}
export interface MigrationProgress {
    id: string;
    status: 'planning' | 'preparing' | 'running' | 'validating' | 'completed' | 'failed' | 'rolled_back';
    currentStep: number;
    totalSteps: number;
    currentMigration?: number;
    startTime: Date;
    estimatedCompletion?: Date;
    elapsedTime: number;
    remainingTime?: number;
    bytesProcessed: number;
    totalBytes: number;
    errors: Array<{
        timestamp: Date;
        type: 'error' | 'warning';
        message: string;
        migration?: number;
        step?: string;
    }>;
    performance: {
        avgStepTime: number;
        memoryUsage: number;
        diskUsage: number;
    };
}
export declare class MigrationService extends EventEmitter {
    private db;
    private migrationManager;
    private planner;
    private schemaEvolution;
    private dataTransformer;
    private rollbackManager;
    private validationService;
    private currentProgress?;
    private mvpConfigurations;
    constructor(db: Database.Database, migrationsPath?: string);
    analyzeMVPUpgradePath(targetMVP: number): Promise<{
        currentVersion: number;
        currentMVP: number;
        targetMVP: number;
        requiredMigrations: Migration[];
        estimatedDuration: number;
        riskAssessment: {
            level: 'low' | 'medium' | 'high' | 'critical';
            factors: string[];
            recommendations: string[];
        };
        dataImpact: {
            tablesAffected: string[];
            estimatedDataLoss: number;
            backupRequired: boolean;
        };
        downtime: {
            required: boolean;
            estimatedMinutes: number;
            strategy: string;
        };
    }>;
    executeMVPMigration(targetMVP: number, options?: MigrationExecutionOptions): Promise<MigrationResult[]>;
    rollbackMVPMigration(targetVersion: number, options?: {
        preserveUserData?: boolean;
        validateRollback?: boolean;
        createBackup?: boolean;
    }): Promise<MigrationResult[]>;
    validateMigrationIntegrity(): Promise<{
        schemaConsistency: boolean;
        dataIntegrity: boolean;
        referentialIntegrity: boolean;
        indexIntegrity: boolean;
        issues: Array<{
            type: 'schema' | 'data' | 'reference' | 'index';
            severity: 'error' | 'warning';
            description: string;
            suggestion: string;
        }>;
    }>;
    getCurrentProgress(): MigrationProgress | null;
    resumeFromCheckpoint(checkpointPath: string): Promise<MigrationResult[]>;
    createCheckpoint(migrationId: string): Promise<string>;
    private initializeMVPConfigurations;
    private setupProgressTracking;
    private initializeProgress;
    private updateProgress;
    private executePreMigrationSteps;
    private executeMigrationsWithOrchestration;
    private executePostMigrationValidation;
    private executeDryRun;
    private executeSingleMigrationWithRetries;
    private handleMigrationFailure;
    private generateMigrationId;
    private generateCheckpointPath;
    private createPreMigrationBackup;
    private createPreRollbackBackup;
    private updatePerformanceMetrics;
    private sleep;
    private assessMVPUpgradeRisk;
    private analyzeDataImpact;
    private analyzeDowntimeRequirements;
    private calculateTotalDuration;
    private identifyRiskFactors;
    private generateRiskRecommendations;
    private finalizeSuccessfulMigration;
    private loadCheckpoint;
    private validateCheckpointState;
    private resumeMigrationFromCheckpoint;
    private captureDatabaseState;
}
//# sourceMappingURL=MigrationService.d.ts.map