import { EventEmitter } from 'events';
import { Readable } from 'stream';
import {
  IExportService,
  ExportOptions,
  ExportResult,
  ExportFormat,
  ExportMetadata,
  ProgressCallback,
  IKnowledgeBaseService,
} from '../../../types/services';
export interface ExportJob {
  id: string;
  format: ExportFormat;
  options: ExportOptions;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime: Date;
  endTime?: Date;
  result?: ExportResult;
  error?: Error;
  metadata: ExportMetadata;
}
export interface ExportStreamOptions {
  batchSize?: number;
  compression?: 'gzip' | 'brotli' | 'none';
  encoding?: string;
  transform?: (data: any) => any;
}
export declare class ExportService extends EventEmitter implements IExportService {
  private kbService;
  private options;
  private jobs;
  private formatConverter;
  private dataTransformer;
  private batchProcessor;
  constructor(
    kbService: IKnowledgeBaseService,
    options?: {
      maxConcurrentJobs: number;
      defaultBatchSize: number;
      enableCompression: boolean;
      retainJobHistory: boolean;
    }
  );
  export(
    format: ExportFormat,
    outputPath: string,
    options?: ExportOptions,
    progressCallback?: ProgressCallback
  ): Promise<ExportResult>;
  exportStream(
    format: ExportFormat,
    options?: ExportOptions & ExportStreamOptions
  ): Promise<Readable>;
  exportBatch(
    jobs: Array<{
      format: ExportFormat;
      outputPath: string;
      options?: ExportOptions;
    }>,
    progressCallback?: (completedJobs: number, totalJobs: number) => void
  ): Promise<ExportResult[]>;
  exportForSystem(
    targetSystem: 'servicenow' | 'jira' | 'confluence' | 'sharepoint' | 'generic',
    outputPath: string,
    options?: ExportOptions
  ): Promise<ExportResult>;
  exportCompatible(
    targetVersion: string,
    outputPath: string,
    options?: ExportOptions
  ): Promise<ExportResult>;
  getJobStatus(jobId: string): ExportJob | null;
  cancelJob(jobId: string): Promise<boolean>;
  getSupportedFormats(): ExportFormat[];
  validateOptions(
    format: ExportFormat,
    options: ExportOptions
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  private createJob;
  private fetchFilteredEntries;
  private transformData;
  private performExport;
  private getSystemConfig;
  private getCompatibilityOptions;
  private chunkArray;
}
export default ExportService;
//# sourceMappingURL=ExportService.d.ts.map
