import { KnowledgeDB, KBEntry } from '../database/KnowledgeDB';
import { EventEmitter } from 'events';
export interface BatchOperationOptions {
  batchSize?: number;
  continueOnError?: boolean;
  timeout?: number;
  validateBeforeProcessing?: boolean;
  customValidation?: (entry: KBEntry) => Promise<string | null>;
}
export interface BatchOperationProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentOperation?: string;
  currentItem?: string;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}
export interface BatchOperationResult<T = any> {
  success: boolean;
  progress: BatchOperationProgress;
  results: Array<{
    id: string;
    success: boolean;
    data?: T;
    error?: string;
  }>;
  error?: string;
  duration: number;
  rolledBack?: string[];
}
export interface BatchValidationResult {
  isValid: boolean;
  validationErrors: Array<{
    id: string;
    errors: string[];
  }>;
  duplicates: Array<{
    id: string;
    duplicateOf: string;
    similarity: number;
  }>;
  conflicts: Array<{
    id: string;
    conflictType: string;
    details: string;
  }>;
}
export declare class BatchOperationsService extends EventEmitter {
  private db;
  private activeOperations;
  constructor(db: KnowledgeDB);
  batchUpdate(
    entryIds: string[],
    updates: Partial<KBEntry> | ((entry: KBEntry) => Partial<KBEntry>),
    options?: BatchOperationOptions
  ): Promise<BatchOperationResult<KBEntry>>;
  batchDelete(
    entryIds: string[],
    options?: BatchOperationOptions
  ): Promise<BatchOperationResult<void>>;
  batchDuplicate(
    entryIds: string[],
    options?: BatchOperationOptions
  ): Promise<BatchOperationResult<KBEntry>>;
  batchExport(
    entryIds: string[],
    format?: 'json' | 'csv' | 'markdown' | 'xml',
    options?: BatchOperationOptions
  ): Promise<BatchOperationResult<string>>;
  batchImport(
    data: string,
    format?: 'json' | 'csv' | 'xml',
    options?: BatchOperationOptions & {
      mergeDuplicates?: boolean;
      skipValidation?: boolean;
    }
  ): Promise<BatchOperationResult<KBEntry>>;
  validateBatch(entries: KBEntry[]): Promise<BatchValidationResult>;
  cancelOperation(operationId: string): Promise<boolean>;
  getActiveOperations(): string[];
  private executeBatchOperation;
  private generateOperationId;
  private createTimeoutPromise;
  private createOperationBackup;
  private restoreFromBackup;
  private calculateSimilarity;
  private formatEntry;
  private combineExportData;
  private parseImportData;
  private parseCSVLine;
}
export default BatchOperationsService;
//# sourceMappingURL=BatchOperationsService.d.ts.map
