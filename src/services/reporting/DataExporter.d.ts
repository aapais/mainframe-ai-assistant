import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';
export interface ExportConfig {
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'xml' | 'html';
  fileName?: string;
  filePath?: string;
  options: ExportOptions;
}
export interface ExportOptions {
  includeHeaders?: boolean;
  compression?: 'none' | 'gzip' | 'brotli';
  encoding?: 'utf8' | 'utf16' | 'ascii';
  delimiter?: string;
  quoteChar?: string;
  escapeChar?: string;
  lineEnding?: '\n' | '\r\n' | '\r';
  sheetName?: string;
  includeFormulas?: boolean;
  autoFitColumns?: boolean;
  freezeHeaders?: boolean;
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margins?: PdfMargins;
  includePageNumbers?: boolean;
  watermark?: string;
  includeCSS?: boolean;
  customCSS?: string;
  responsive?: boolean;
  prettyPrint?: boolean;
  dateFormat?: string;
  numberFormat?: NumberFormat;
  currencyFormat?: CurrencyFormat;
}
export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface NumberFormat {
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}
export interface CurrencyFormat {
  code: string;
  symbol: string;
  position: 'before' | 'after';
  decimals: number;
}
export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  recordCount: number;
  duration: number;
  format: string;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}
export interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  config: ExportConfig;
  data: any[];
  startTime: Date;
  endTime?: Date;
  progress: number;
  result?: ExportResult;
  error?: string;
}
export interface DataTransformer {
  name: string;
  transform(data: any[], options?: Record<string, any>): Promise<any[]>;
}
export interface FormatHandler {
  format: string;
  export(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult>;
  validate(config: ExportConfig): string[];
}
export declare class DataExporter extends EventEmitter {
  private readonly logger;
  private readonly jobs;
  private readonly formatHandlers;
  private readonly transformers;
  private readonly outputDirectory;
  private readonly maxConcurrentJobs;
  private activeJobs;
  constructor(logger: Logger, outputDirectory?: string, maxConcurrentJobs?: number);
  private ensureOutputDirectory;
  private initializeFormatHandlers;
  registerFormatHandler(handler: FormatHandler): void;
  registerTransformer(transformer: DataTransformer): void;
  exportData(data: any[], config: ExportConfig): Promise<string>;
  private processJob;
  private validateConfig;
  private applyTransformations;
  private transformDates;
  private transformNumbers;
  private transformCurrency;
  private formatDate;
  private formatNumber;
  private formatCurrency;
  private isDateString;
  private performExport;
  private generateFilePath;
  private getFileExtension;
  private generateJobId;
  getJob(jobId: string): ExportJob | null;
  listJobs(status?: string): ExportJob[];
  cancelJob(jobId: string): boolean;
  clearCompletedJobs(): number;
  getSupportedFormats(): string[];
}
//# sourceMappingURL=DataExporter.d.ts.map
