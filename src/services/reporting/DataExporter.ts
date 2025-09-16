import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../logger/Logger';

export interface ExportConfig {
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'xml' | 'html';
  fileName?: string;
  filePath?: string;
  options: ExportOptions;
}

export interface ExportOptions {
  // Common options
  includeHeaders?: boolean;
  compression?: 'none' | 'gzip' | 'brotli';
  encoding?: 'utf8' | 'utf16' | 'ascii';

  // CSV options
  delimiter?: string;
  quoteChar?: string;
  escapeChar?: string;
  lineEnding?: '\n' | '\r\n' | '\r';

  // Excel options
  sheetName?: string;
  includeFormulas?: boolean;
  autoFitColumns?: boolean;
  freezeHeaders?: boolean;

  // PDF options
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margins?: PdfMargins;
  includePageNumbers?: boolean;
  watermark?: string;

  // HTML options
  includeCSS?: boolean;
  customCSS?: string;
  responsive?: boolean;

  // JSON options
  prettyPrint?: boolean;

  // General formatting
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

export class DataExporter extends EventEmitter {
  private readonly logger: Logger;
  private readonly jobs: Map<string, ExportJob>;
  private readonly formatHandlers: Map<string, FormatHandler>;
  private readonly transformers: Map<string, DataTransformer>;
  private readonly outputDirectory: string;
  private readonly maxConcurrentJobs: number;
  private activeJobs: number = 0;

  constructor(
    logger: Logger,
    outputDirectory: string = './exports',
    maxConcurrentJobs: number = 5
  ) {
    super();
    this.logger = logger;
    this.jobs = new Map();
    this.formatHandlers = new Map();
    this.transformers = new Map();
    this.outputDirectory = outputDirectory;
    this.maxConcurrentJobs = maxConcurrentJobs;

    this.initializeFormatHandlers();
    this.ensureOutputDirectory();
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create output directory', error);
    }
  }

  private initializeFormatHandlers(): void {
    // Register built-in format handlers
    this.registerFormatHandler(new CSVFormatHandler());
    this.registerFormatHandler(new JSONFormatHandler());
    this.registerFormatHandler(new XMLFormatHandler());
    this.registerFormatHandler(new HTMLFormatHandler());
    this.registerFormatHandler(new ExcelFormatHandler());
    this.registerFormatHandler(new PDFFormatHandler());
  }

  public registerFormatHandler(handler: FormatHandler): void {
    this.formatHandlers.set(handler.format, handler);
    this.logger.info(`Format handler registered: ${handler.format}`);
  }

  public registerTransformer(transformer: DataTransformer): void {
    this.transformers.set(transformer.name, transformer);
    this.logger.info(`Data transformer registered: ${transformer.name}`);
  }

  public async exportData(data: any[], config: ExportConfig): Promise<string> {
    if (this.activeJobs >= this.maxConcurrentJobs) {
      throw new Error('Maximum concurrent export jobs reached');
    }

    const jobId = this.generateJobId();
    const job: ExportJob = {
      id: jobId,
      status: 'pending',
      config,
      data,
      startTime: new Date(),
      progress: 0
    };

    this.jobs.set(jobId, job);
    this.logger.info(`Export job created: ${jobId} (${config.format})`);
    this.emit('jobCreated', job);

    // Start processing asynchronously
    this.processJob(jobId).catch(error => {
      this.logger.error(`Export job failed: ${jobId}`, error);
    });

    return jobId;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    try {
      this.activeJobs++;
      job.status = 'processing';
      this.emit('jobStarted', job);

      // Validate configuration
      const validationErrors = this.validateConfig(job.config);
      if (validationErrors.length > 0) {
        throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
      }

      // Apply data transformations
      job.progress = 10;
      this.emit('jobProgress', job);

      let transformedData = await this.applyTransformations(job.data, job.config);

      // Prepare file path
      job.progress = 20;
      this.emit('jobProgress', job);

      const filePath = this.generateFilePath(job.config);

      // Export data
      job.progress = 30;
      this.emit('jobProgress', job);

      const result = await this.performExport(transformedData, job.config, filePath);

      // Complete job
      job.status = 'completed';
      job.endTime = new Date();
      job.progress = 100;
      job.result = result;

      this.logger.info(`Export job completed: ${jobId}`);
      this.emit('jobCompleted', job);

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Export job failed: ${jobId}`, error);
      this.emit('jobFailed', job);

    } finally {
      this.activeJobs--;
    }
  }

  private validateConfig(config: ExportConfig): string[] {
    const errors: string[] = [];

    if (!config.format) {
      errors.push('Export format is required');
    }

    const handler = this.formatHandlers.get(config.format);
    if (!handler) {
      errors.push(`Unsupported export format: ${config.format}`);
    } else {
      const handlerErrors = handler.validate(config);
      errors.push(...handlerErrors);
    }

    return errors;
  }

  private async applyTransformations(data: any[], config: ExportConfig): Promise<any[]> {
    let transformedData = [...data];

    // Apply built-in transformations based on format options
    if (config.options.dateFormat) {
      transformedData = this.transformDates(transformedData, config.options.dateFormat);
    }

    if (config.options.numberFormat) {
      transformedData = this.transformNumbers(transformedData, config.options.numberFormat);
    }

    if (config.options.currencyFormat) {
      transformedData = this.transformCurrency(transformedData, config.options.currencyFormat);
    }

    return transformedData;
  }

  private transformDates(data: any[], format: string): any[] {
    return data.map(row => {
      const transformedRow = { ...row };

      for (const [key, value] of Object.entries(transformedRow)) {
        if (value instanceof Date) {
          transformedRow[key] = this.formatDate(value, format);
        } else if (typeof value === 'string' && this.isDateString(value)) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            transformedRow[key] = this.formatDate(date, format);
          }
        }
      }

      return transformedRow;
    });
  }

  private transformNumbers(data: any[], format: NumberFormat): any[] {
    return data.map(row => {
      const transformedRow = { ...row };

      for (const [key, value] of Object.entries(transformedRow)) {
        if (typeof value === 'number' && !isNaN(value)) {
          transformedRow[key] = this.formatNumber(value, format);
        }
      }

      return transformedRow;
    });
  }

  private transformCurrency(data: any[], format: CurrencyFormat): any[] {
    return data.map(row => {
      const transformedRow = { ...row };

      for (const [key, value] of Object.entries(transformedRow)) {
        if (typeof value === 'number' && key.toLowerCase().includes('price') ||
            key.toLowerCase().includes('cost') || key.toLowerCase().includes('amount')) {
          transformedRow[key] = this.formatCurrency(value, format);
        }
      }

      return transformedRow;
    });
  }

  private formatDate(date: Date, format: string): string {
    // Simple date formatting - in production, use a library like date-fns
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return format
      .replace('YYYY', year.toString())
      .replace('MM', month)
      .replace('DD', day);
  }

  private formatNumber(num: number, format: NumberFormat): string {
    const fixed = num.toFixed(format.decimals);
    const [integer, decimal] = fixed.split('.');

    // Add thousands separator
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSeparator);

    return decimal ?
      `${formattedInteger}${format.decimalSeparator}${decimal}` :
      formattedInteger;
  }

  private formatCurrency(amount: number, format: CurrencyFormat): string {
    const formatted = amount.toFixed(format.decimals);
    return format.position === 'before' ?
      `${format.symbol}${formatted}` :
      `${formatted}${format.symbol}`;
  }

  private isDateString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}/.test(value) ||
           /^\d{2}\/\d{2}\/\d{4}/.test(value) ||
           !isNaN(Date.parse(value));
  }

  private async performExport(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult> {
    const handler = this.formatHandlers.get(config.format);
    if (!handler) {
      throw new Error(`No handler found for format: ${config.format}`);
    }

    const startTime = Date.now();
    const result = await handler.export(data, config, filePath);
    const duration = Date.now() - startTime;

    return {
      ...result,
      duration,
      recordCount: data.length
    };
  }

  private generateFilePath(config: ExportConfig): string {
    if (config.filePath) {
      return config.filePath;
    }

    const fileName = config.fileName ||
      `export_${Date.now()}.${this.getFileExtension(config.format)}`;

    return path.join(this.outputDirectory, fileName);
  }

  private getFileExtension(format: string): string {
    const extensions: Record<string, string> = {
      'csv': 'csv',
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'excel': 'xlsx',
      'pdf': 'pdf'
    };

    return extensions[format] || format;
  }

  private generateJobId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for job management
  public getJob(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  public listJobs(status?: string): ExportJob[] {
    const allJobs = Array.from(this.jobs.values());

    if (status) {
      return allJobs.filter(job => job.status === status);
    }

    return allJobs;
  }

  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    job.status = 'cancelled';
    job.endTime = new Date();
    this.emit('jobCancelled', job);

    return true;
  }

  public clearCompletedJobs(): number {
    const completedJobs = Array.from(this.jobs.entries())
      .filter(([_, job]) => job.status === 'completed' || job.status === 'failed')
      .map(([id, _]) => id);

    completedJobs.forEach(id => this.jobs.delete(id));

    return completedJobs.length;
  }

  public getSupportedFormats(): string[] {
    return Array.from(this.formatHandlers.keys());
  }
}

// Format Handler Implementations
class CSVFormatHandler implements FormatHandler {
  format = 'csv';

  validate(config: ExportConfig): string[] {
    return []; // CSV has minimal validation requirements
  }

  async export(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult> {
    const options = config.options;
    const delimiter = options.delimiter || ',';
    const quoteChar = options.quoteChar || '"';
    const lineEnding = options.lineEnding || '\n';

    try {
      let csvContent = '';

      if (data.length > 0) {
        // Headers
        if (options.includeHeaders !== false) {
          const headers = Object.keys(data[0]);
          csvContent += headers.map(h => `${quoteChar}${h}${quoteChar}`).join(delimiter) + lineEnding;
        }

        // Data rows
        for (const row of data) {
          const values = Object.values(row).map(value => {
            const stringValue = String(value || '');
            return `${quoteChar}${stringValue.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar)}${quoteChar}`;
          });
          csvContent += values.join(delimiter) + lineEnding;
        }
      }

      await fs.writeFile(filePath, csvContent, { encoding: options.encoding as BufferEncoding || 'utf8' });
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size,
        recordCount: data.length,
        duration: 0,
        format: this.format
      };

    } catch (error) {
      return {
        success: false,
        recordCount: data.length,
        duration: 0,
        format: this.format,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
}

class JSONFormatHandler implements FormatHandler {
  format = 'json';

  validate(config: ExportConfig): string[] {
    return [];
  }

  async export(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult> {
    try {
      const jsonContent = config.options.prettyPrint
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);

      await fs.writeFile(filePath, jsonContent, { encoding: config.options.encoding as BufferEncoding || 'utf8' });
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size,
        recordCount: data.length,
        duration: 0,
        format: this.format
      };

    } catch (error) {
      return {
        success: false,
        recordCount: data.length,
        duration: 0,
        format: this.format,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
}

class XMLFormatHandler implements FormatHandler {
  format = 'xml';

  validate(config: ExportConfig): string[] {
    return [];
  }

  async export(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult> {
    try {
      let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

      for (const row of data) {
        xmlContent += '  <record>\n';
        for (const [key, value] of Object.entries(row)) {
          const escapedValue = String(value || '').replace(/[<>&'"]/g, (char) => {
            const entities: Record<string, string> = {
              '<': '&lt;',
              '>': '&gt;',
              '&': '&amp;',
              "'": '&apos;',
              '"': '&quot;'
            };
            return entities[char];
          });
          xmlContent += `    <${key}>${escapedValue}</${key}>\n`;
        }
        xmlContent += '  </record>\n';
      }

      xmlContent += '</root>';

      await fs.writeFile(filePath, xmlContent, { encoding: config.options.encoding as BufferEncoding || 'utf8' });
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size,
        recordCount: data.length,
        duration: 0,
        format: this.format
      };

    } catch (error) {
      return {
        success: false,
        recordCount: data.length,
        duration: 0,
        format: this.format,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
}

class HTMLFormatHandler implements FormatHandler {
  format = 'html';

  validate(config: ExportConfig): string[] {
    return [];
  }

  async export(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult> {
    try {
      const responsive = config.options.responsive !== false;
      const includeCSS = config.options.includeCSS !== false;

      let htmlContent = '<!DOCTYPE html>\n<html>\n<head>\n<title>Data Export</title>\n';

      if (includeCSS) {
        htmlContent += this.getDefaultCSS(responsive, config.options.customCSS);
      }

      htmlContent += '</head>\n<body>\n<table>\n';

      if (data.length > 0) {
        // Headers
        htmlContent += '<thead><tr>';
        const headers = Object.keys(data[0]);
        for (const header of headers) {
          htmlContent += `<th>${this.escapeHtml(header)}</th>`;
        }
        htmlContent += '</tr></thead>\n';

        // Data rows
        htmlContent += '<tbody>';
        for (const row of data) {
          htmlContent += '<tr>';
          for (const value of Object.values(row)) {
            htmlContent += `<td>${this.escapeHtml(String(value || ''))}</td>`;
          }
          htmlContent += '</tr>';
        }
        htmlContent += '</tbody>';
      }

      htmlContent += '\n</table>\n</body>\n</html>';

      await fs.writeFile(filePath, htmlContent, { encoding: config.options.encoding as BufferEncoding || 'utf8' });
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        fileSize: stats.size,
        recordCount: data.length,
        duration: 0,
        format: this.format
      };

    } catch (error) {
      return {
        success: false,
        recordCount: data.length,
        duration: 0,
        format: this.format,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private getDefaultCSS(responsive: boolean, customCSS?: string): string {
    let css = '<style>\n';
    css += 'table { border-collapse: collapse; width: 100%; }\n';
    css += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n';
    css += 'th { background-color: #f2f2f2; font-weight: bold; }\n';
    css += 'tr:nth-child(even) { background-color: #f9f9f9; }\n';

    if (responsive) {
      css += '@media screen and (max-width: 600px) {\n';
      css += '  table { font-size: 12px; }\n';
      css += '  th, td { padding: 4px; }\n';
      css += '}\n';
    }

    if (customCSS) {
      css += customCSS + '\n';
    }

    css += '</style>\n';
    return css;
  }

  private escapeHtml(text: string): string {
    return text.replace(/[<>&'"]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&#39;',
        '"': '&quot;'
      };
      return entities[char];
    });
  }
}

// Placeholder implementations for Excel and PDF handlers
class ExcelFormatHandler implements FormatHandler {
  format = 'excel';

  validate(config: ExportConfig): string[] {
    return [];
  }

  async export(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult> {
    // In a real implementation, use libraries like 'exceljs' or 'xlsx'
    throw new Error('Excel export requires additional dependencies (exceljs)');
  }
}

class PDFFormatHandler implements FormatHandler {
  format = 'pdf';

  validate(config: ExportConfig): string[] {
    return [];
  }

  async export(data: any[], config: ExportConfig, filePath: string): Promise<ExportResult> {
    // In a real implementation, use libraries like 'pdfkit' or 'puppeteer'
    throw new Error('PDF export requires additional dependencies (pdfkit)');
  }
}