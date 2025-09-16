import { EventEmitter } from 'events';
import { z } from 'zod';
import { KBEntry } from '../database/schemas/KnowledgeBase.schema';
export declare const BulkOperationSchema: any;
export type BulkOperation = z.infer<typeof BulkOperationSchema>;
export declare const BulkTagOperationSchema: any;
export type BulkTagOperation = z.infer<typeof BulkTagOperationSchema>;
export declare const BulkCategoryOperationSchema: any;
export type BulkCategoryOperation = z.infer<typeof BulkCategoryOperationSchema>;
export declare const BulkUpdateOperationSchema: any;
export type BulkUpdateOperation = z.infer<typeof BulkUpdateOperationSchema>;
export interface BulkOperationsOptions {
    maxConcurrentOperations?: number;
    batchSize?: number;
    rateLimitDelay?: number;
    enableRollback?: boolean;
    enableAuditLogging?: boolean;
    maxHistoryEntries?: number;
    progressUpdateInterval?: number;
}
export declare class BulkOperationsService extends EventEmitter {
    private operations;
    private operationQueue;
    private activeOperations;
    private operationHistory;
    private options;
    constructor(options?: BulkOperationsOptions);
    addTagsToEntries(operation: BulkTagOperation): Promise<string>;
    removeTagsFromEntries(operation: BulkTagOperation): Promise<string>;
    replaceTagsOnEntries(operation: BulkTagOperation): Promise<string>;
    changeCategoryForEntries(operation: BulkCategoryOperation): Promise<string>;
    updateEntries(operation: BulkUpdateOperation): Promise<string>;
    deleteEntries(entryIds: string[], options?: {
        createBackup?: boolean;
        forceDelete?: boolean;
    }): Promise<string>;
    archiveEntries(entryIds: string[]): Promise<string>;
    duplicateEntries(entryIds: string[], options?: {
        namePrefix?: string;
        preserveMetadata?: boolean;
    }): Promise<string>;
    exportEntries(entryIds: string[], format?: 'json' | 'csv' | 'xml'): Promise<string>;
    getOperationStatus(operationId: string): BulkOperation | null;
    cancelOperation(operationId: string): Promise<boolean>;
    rollbackOperation(operationId: string): Promise<boolean>;
    getOperationHistory(limit?: number): BulkOperation[];
    getActiveOperations(): BulkOperation[];
    getQueuedOperations(): BulkOperation[];
    private startOperationProcessor;
    private processQueue;
    private executeOperation;
    private executeAddTags;
    private executeRemoveTags;
    private executeReplaceTags;
    private executeChangeCategory;
    private executeUpdateEntries;
    private executeDeleteEntries;
    private executeArchiveEntries;
    private executeDuplicateEntries;
    private executeExportEntries;
    private createBulkOperation;
    private queueOperation;
    private removeFromQueue;
    private createBatches;
    private performRollback;
    private generateId;
    private generateExportPath;
    private sleep;
    protected abstract saveOperationToStorage(operation: BulkOperation): Promise<void>;
    protected abstract updateOperationInStorage(operation: BulkOperation): Promise<void>;
    protected abstract getKBEntry(id: string): Promise<KBEntry | null>;
    protected abstract updateKBEntry(id: string, updates: Partial<KBEntry>): Promise<void>;
    protected abstract createKBEntry(entry: Omit<KBEntry, 'id'>): Promise<KBEntry>;
    protected abstract deleteKBEntry(id: string, options: {
        force: boolean;
    }): Promise<void>;
    protected abstract validateTags(tags: string[], options: any): Promise<string[]>;
    protected abstract validateCategory(categoryId: string): Promise<void>;
    protected abstract validateKBEntryUpdate(updates: any): Promise<void>;
    protected abstract writeExportFile(path: string, data: any[], format: string): Promise<void>;
}
//# sourceMappingURL=BulkOperationsService.d.ts.map