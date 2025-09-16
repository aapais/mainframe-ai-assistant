import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { IImportService, ImportOptions, ImportResult, ImportFormat, ImportJob, ValidationResult, ProgressCallback, IKnowledgeBaseService } from '../../../types/services';
export interface ImportValidationOptions {
    strictMode?: boolean;
    allowPartialImport?: boolean;
    validateSchema?: boolean;
    customValidators?: Array<(entry: any) => ValidationResult>;
    transformOnValidation?: boolean;
}
export interface ImportRecoveryOptions {
    enableAutoRecovery?: boolean;
    retryAttempts?: number;
    rollbackOnFailure?: boolean;
    createBackupBeforeImport?: boolean;
    resumeFromCheckpoint?: boolean;
}
export interface ImportCheckpoint {
    jobId: string;
    processedCount: number;
    successCount: number;
    errorCount: number;
    lastProcessedId: string;
    timestamp: Date;
    data: any;
}
export declare class ImportService extends EventEmitter implements IImportService {
    private kbService;
    private options;
    private jobs;
    private checkpoints;
    private formatConverter;
    private dataTransformer;
    private validationService;
    private batchProcessor;
    constructor(kbService: IKnowledgeBaseService, options?: {
        maxConcurrentJobs: number;
        defaultBatchSize: number;
        enableCheckpoints: boolean;
        autoValidation: boolean;
        enableRecovery: boolean;
    });
    import(filePath: string, format: ImportFormat, options?: ImportOptions, progressCallback?: ProgressCallback): Promise<ImportResult>;
    importStream(stream: Readable, format: ImportFormat, options?: ImportOptions, progressCallback?: ProgressCallback): Promise<ImportResult>;
    validateImport(filePath: string, format: ImportFormat, options?: ImportValidationOptions): Promise<ValidationResult>;
    importFromSystem(filePath: string, sourceSystem: 'servicenow' | 'jira' | 'confluence' | 'sharepoint' | 'generic', options?: ImportOptions): Promise<ImportResult>;
    importCompatible(filePath: string, sourceVersion: string, options?: ImportOptions): Promise<ImportResult>;
    resumeImport(jobId: string): Promise<ImportResult>;
    getJobStatus(jobId: string): ImportJob | null;
    cancelJob(jobId: string): Promise<boolean>;
    getSupportedFormats(): ImportFormat[];
    private createJob;
    private preImportValidation;
    private readFile;
    private parseData;
    private validateData;
    private transformData;
    private performImport;
    private importBatch;
    private findExistingEntry;
    private createCheckpoint;
    private attemptRecovery;
    private rollbackImport;
    private getSystemConfig;
    private getCompatibilityConfig;
    private getFormatExtensions;
}
export default ImportService;
//# sourceMappingURL=ImportService.d.ts.map