import Database from 'better-sqlite3';
import { MigrationResult } from '../../../database/MigrationManager';
import { EventEmitter } from 'events';
export interface RollbackPlan {
    id: string;
    targetVersion: number;
    currentVersion: number;
    rollbackSteps: RollbackStep[];
    estimatedDuration: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    dataRecoveryRequired: boolean;
    backupPath?: string;
    validationChecks: string[];
}
export interface RollbackStep {
    step: number;
    description: string;
    migrationVersion: number;
    sql: string;
    estimatedDuration: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    dataImpact: 'none' | 'minimal' | 'moderate' | 'significant';
    dependencies: number[];
    reversible: boolean;
    validationQuery?: string;
}
export interface RollbackResult {
    stepNumber: number;
    migrationVersion: number;
    success: boolean;
    duration: number;
    error?: string;
    dataRestored?: number;
    validationPassed?: boolean;
}
export interface EmergencyRollbackPlan {
    immediate: {
        stopApplication: string[];
        criticalBackup: string[];
        emergencyRestore: string[];
    };
    recovery: {
        dataRecovery: string[];
        integrityChecks: string[];
        serviceRestart: string[];
    };
    validation: {
        functionalTests: string[];
        dataValidation: string[];
        performanceChecks: string[];
    };
    contacts: {
        role: string;
        contact: string;
        escalationLevel: number;
    }[];
}
export interface RollbackCheckpoint {
    id: string;
    timestamp: Date;
    migrationVersion: number;
    databaseState: string;
    rollbackPosition: number;
    canResumeFrom: boolean;
}
export declare class RollbackManager extends EventEmitter {
    private db;
    private rollbackRegistry;
    private emergencyProcedures;
    constructor(db: Database.Database);
    createRollbackPlan(targetVersion: number): Promise<RollbackPlan>;
    executeRollbackPlan(plan: RollbackPlan, options?: {
        preserveUserData?: boolean;
        validateRollback?: boolean;
        createCheckpoints?: boolean;
        maxRetries?: number;
    }): Promise<MigrationResult[]>;
    executeEmergencyRollback(emergencyType?: 'corruption' | 'performance' | 'data_loss' | 'security'): Promise<{
        success: boolean;
        actionsPerformed: string[];
        restoredToVersion: number;
        emergencyContacts: string[];
        nextSteps: string[];
    }>;
    prepareRollbackEnvironment(plan: any): Promise<{
        backupCreated: boolean;
        dependenciesChecked: boolean;
        safetyMeasuresEnabled: boolean;
        rollbackReadiness: 'ready' | 'needs_preparation' | 'unsafe';
    }>;
    resumeRollbackFromCheckpoint(checkpointId: string): Promise<MigrationResult[]>;
    validateRollbackCapability(targetVersion: number): Promise<{
        canRollback: boolean;
        issues: Array<{
            type: 'blocking' | 'warning';
            message: string;
            resolution: string;
        }>;
        requiredActions: string[];
        estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
    }>;
    private initializeRollbackTracking;
    private setupEmergencyProcedures;
    private getCurrentVersion;
    private generateRollbackSteps;
    private calculateTotalDuration;
    private assessRollbackRisk;
    private assessDataRecoveryNeed;
    private generateValidationChecks;
    private generatePlanId;
    private createPreRollbackBackup;
    private executeRollbackStepWithRetries;
    private logRollbackStep;
    private sleep;
    private estimateStepDuration;
    private assessStepRisk;
    private assessDataImpact;
    private generateValidationQuery;
    private validatePreRollbackState;
    private handleRollbackStepFailure;
    private validateRollbackStep;
    private validatePostRollbackState;
    private preserveUserDataAfterRollback;
    private handleRollbackFailure;
    private executeEmergencyAction;
    private createRollbackCheckpoint;
    private loadRollbackCheckpoint;
    private validateRollbackDependencies;
    private enableRollbackSafetyMeasures;
    private versionExists;
    private checkDataDependencies;
    private identifyBreakingChanges;
    private calculateRollbackRisk;
}
//# sourceMappingURL=RollbackManager.d.ts.map