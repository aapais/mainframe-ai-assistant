import Database from 'better-sqlite3';
import { Migration } from '../../../database/MigrationManager';
export interface MigrationPlan {
  id: string;
  currentVersion: number;
  targetVersion: number;
  currentMVP: number;
  targetMVP: number;
  migrations: Migration[];
  phases: MigrationPhase[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresDowntime: boolean;
  dataBackupRequired: boolean;
  rollbackStrategy: string;
  prerequisites: string[];
  postMigrationTasks: string[];
  validationChecks: ValidationCheck[];
}
export interface MigrationPhase {
  name: string;
  description: string;
  migrations: number[];
  estimatedDuration: number;
  canRunInParallel: boolean;
  dependencies: string[];
  rollbackPoint: boolean;
}
export interface ValidationCheck {
  type: 'schema' | 'data' | 'integrity' | 'performance';
  description: string;
  critical: boolean;
  query?: string;
  expectedResult?: any;
}
export interface MVPMigrationPath {
  from: number;
  to: number;
  intermediateSteps: number[];
  criticalPath: boolean;
  alternativeRoutes: number[][];
}
export declare class MigrationPlanner {
  private db;
  private migrationsPath;
  private mvpDefinitions;
  constructor(db: Database.Database, migrationsPath: string);
  createComprehensiveMigrationPlan(targetMVP: number): Promise<MigrationPlan>;
  getMigrationsForMVPUpgrade(fromMVP: number, toMVP: number): Promise<Migration[]>;
  analyzeMigrationPaths(targetMVP: number): Promise<{
    recommendedPath: MVPMigrationPath;
    alternativePaths: MVPMigrationPath[];
    pathAnalysis: {
      path: MVPMigrationPath;
      pros: string[];
      cons: string[];
      riskLevel: string;
      estimatedDuration: number;
    }[];
  }>;
  createEmergencyRollbackPlan(fromVersion: number): Promise<{
    rollbackSteps: Array<{
      step: number;
      description: string;
      sql: string;
      estimatedDuration: number;
      riskLevel: string;
    }>;
    dataRecoverySteps: string[];
    validationSteps: string[];
    emergencyContacts: string[];
  }>;
  estimateResourceRequirements(plan: MigrationPlan): Promise<{
    storage: {
      additionalSpaceRequired: number;
      temporarySpaceRequired: number;
      backupSpaceRequired: number;
    };
    memory: {
      peakMemoryUsage: number;
      recommendedMemory: number;
    };
    cpu: {
      estimatedCpuTime: number;
      recommendedCores: number;
    };
    network: {
      dataTransferRequired: number;
      estimatedBandwidth: number;
    };
  }>;
  generateMigrationTimeline(plan: MigrationPlan): {
    timeline: Array<{
      milestone: string;
      estimatedTime: Date;
      duration: number;
      phase: string;
      dependencies: string[];
      criticalPath: boolean;
    }>;
    criticalPath: string[];
    bufferTime: number;
    contingencyPlan: string[];
  };
  private initializeMVPDefinitions;
  private getCurrentVersion;
  private detectCurrentMVP;
  private calculateOptimalMigrationPath;
  private loadMigrationsForPath;
  private loadMigrationsForMVP;
  private organizeMigrationsIntoPhases;
  private getMVPForVersion;
  private estimatePhaseDuration;
  private calculateTotalEstimatedDuration;
  private assessOverallRiskLevel;
  private assessDowntimeRequirement;
  private assessBackupRequirement;
  private selectRollbackStrategy;
  private generatePrerequisites;
  private generatePostMigrationTasks;
  private generateValidationChecks;
  private validateMigrationPlan;
  private generateAllPossiblePaths;
  private analyzeSinglePath;
  private selectRecommendedPath;
  private generatePathPros;
  private generatePathCons;
  private generatePlanId;
  private getAppliedMigrationsSince;
  private generateRollbackSteps;
  private generateDataRecoverySteps;
  private generateRollbackValidationSteps;
  private getEmergencyContacts;
  private getDatabaseSize;
  private calculateMigrationComplexity;
}
//# sourceMappingURL=MigrationPlanner.d.ts.map
