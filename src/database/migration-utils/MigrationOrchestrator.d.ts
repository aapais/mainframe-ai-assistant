import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { Migration, MigrationResult } from '../MigrationManager';
export interface MigrationPlan {
    currentVersion: number;
    targetVersion: number;
    migrations: Migration[];
    estimatedDuration: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresDowntime: boolean;
    rollbackPlan: string[];
}
export interface MigrationProgress {
    currentStep: number;
    totalSteps: number;
    currentMigration?: number;
    status: 'planning' | 'running' | 'completed' | 'failed' | 'rolled_back';
    startTime: Date;
    estimatedCompletion?: Date;
    errors: string[];
    warnings: string[];
}
export declare class MigrationOrchestrator extends EventEmitter {
    private db;
    private migrationManager;
    private dataTransformer;
    private validator;
    private rollbackManager;
    private progressTracker;
    private currentProgress?;
    constructor(db: Database.Database, migrationsPath?: string);
    createMigrationPlan(targetVersion: number): Promise<MigrationPlan>;
    executeMigrationPlan(plan: MigrationPlan, options?: {
        dryRun?: boolean;
        pauseBetweenSteps?: number;
        maxRetries?: number;
        continueOnWarning?: boolean;
    }): Promise<MigrationResult[]>;
    getCurrentProgress(): MigrationProgress | null;
    analyzeUpgradePath(): Promise<{
        currentVersion: number;
        latestVersion: number;
        pendingMigrations: Migration[];
        recommendedAction: string;
        warnings: string[];
    }>;
    resumeFromCheckpoint(checkpointPath: string): Promise<MigrationResult[]>;
    private loadMigrationsForPlan;
    private loadAllMigrations;
    private estimateMigrationDuration;
    private assessRiskLevel;
    private assessDowntimeRequirement;
    private generateRollbackPlan;
    private executeDryRun;
    private createPreMigrationBackup;
    private executeMigrationWithRetries;
    private executeRollback;
    private findVersionGaps;
    private loadCheckpoint;
    private sleep;
}
//# sourceMappingURL=MigrationOrchestrator.d.ts.map