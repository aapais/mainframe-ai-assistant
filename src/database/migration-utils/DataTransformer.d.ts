import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface TransformationRule {
  id: string;
  description: string;
  sourceTable: string;
  targetTable?: string;
  condition?: string;
  transformFunction: (row: any) => any | Promise<any>;
  validation?: (originalRow: any, transformedRow: any) => boolean;
  batchSize?: number;
  priority?: number;
}
export interface TransformationResult {
  ruleId: string;
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{
    row: any;
    error: string;
  }>;
  duration: number;
}
export interface DataMigrationPlan {
  transformations: TransformationRule[];
  estimatedDuration: number;
  totalRecords: number;
  requiresDowntime: boolean;
}
export declare class DataTransformer extends EventEmitter {
  private db;
  private isRunning;
  private currentBatch;
  private totalBatches;
  constructor(db: Database.Database);
  createTransformationPlan(rules: TransformationRule[]): Promise<DataMigrationPlan>;
  executeTransformationPlan(
    plan: DataMigrationPlan,
    options?: {
      continueOnError?: boolean;
      validateEach?: boolean;
      dryRun?: boolean;
      maxConcurrency?: number;
    }
  ): Promise<TransformationResult[]>;
  private executeTransformationRule;
  private processBatch;
  private insertTransformedRow;
  private updateTransformedRow;
  static createMVPTransformationRules(): {
    mvp2: TransformationRule[];
    mvp3: TransformationRule[];
    mvp4: TransformationRule[];
    mvp5: TransformationRule[];
  };
  validateDataIntegrity(
    sourceTable: string,
    targetTable?: string,
    validationRules?: Array<{
      name: string;
      query: string;
      expectedResult: any;
    }>
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  private static extractErrorCodes;
  private static classifyCodeFile;
  private static extractTextFeatures;
  private static extractTemporalFeatures;
  private static mapSeverityToNumeric;
  getProgress(): {
    isRunning: boolean;
    currentBatch: number;
    totalBatches: number;
    progressPercentage: number;
  };
  cancel(): void;
}
//# sourceMappingURL=DataTransformer.d.ts.map
