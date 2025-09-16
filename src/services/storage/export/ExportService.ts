/**
 * Enhanced Export Service - Multi-format support with enterprise features
 * Supports JSON, CSV, XML, Parquet, Avro, ORC formats with version compatibility
 */

import { EventEmitter } from 'events';
import { Transform, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { FormatConverter } from './FormatConverter';
import { DataTransformer } from './DataTransformer';
import { BatchProcessor } from './BatchProcessor';
import {
  IExportService,
  ExportOptions,
  ExportResult,
  ExportFormat,
  ExportMetadata,
  ProgressCallback,
  KBEntry,
  IKnowledgeBaseService
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

/**
 * Advanced Export Service with streaming, multiple formats, and enterprise features
 */
export class ExportService extends EventEmitter implements IExportService {
  private jobs = new Map<string, ExportJob>();
  private formatConverter: FormatConverter;
  private dataTransformer: DataTransformer;
  private batchProcessor: BatchProcessor;

  constructor(
    private kbService: IKnowledgeBaseService,
    private options = {
      maxConcurrentJobs: 3,
      defaultBatchSize: 1000,
      enableCompression: true,
      retainJobHistory: true
    }
  ) {
    super();
    this.formatConverter = new FormatConverter();
    this.dataTransformer = new DataTransformer();
    this.batchProcessor = new BatchProcessor({
      batchSize: this.options.defaultBatchSize,
      enableProgress: true
    });
  }

  /**
   * Export knowledge base to specified format
   */
  async export(
    format: ExportFormat,
    outputPath: string,
    options: ExportOptions = {},
    progressCallback?: ProgressCallback
  ): Promise<ExportResult> {
    const jobId = uuidv4();
    const job = this.createJob(jobId, format, outputPath, options);
    
    this.jobs.set(jobId, job);
    
    try {
      this.emit('job:started', job);
      
      // Fetch data with filters
      const entries = await this.fetchFilteredEntries(options);
      
      // Transform data if needed
      const transformedData = await this.transformData(entries, options);
      
      // Convert to target format
      const result = await this.performExport(
        format,
        transformedData,
        outputPath,
        options,
        (progress) => {
          job.progress = progress;
          this.emit('job:progress', job);
          progressCallback?.(progress);
        }
      );
      
      job.status = 'completed';
      job.endTime = new Date();
      job.result = result;
      
      this.emit('job:completed', job);
      return result;
      
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error as Error;
      
      this.emit('job:failed', job);
      throw error;
    }
  }

  /**
   * Export as stream for large datasets
   */
  async exportStream(
    format: ExportFormat,
    options: ExportOptions & ExportStreamOptions = {}
  ): Promise<Readable> {
    const batchSize = options.batchSize || this.options.defaultBatchSize;
    let offset = 0;
    let hasMore = true;

    return new Readable({
      objectMode: true,
      async read() {
        if (!hasMore) {
          this.push(null);
          return;
        }

        try {
          // Fetch batch
          const batch = await this.kbService.list({
            offset,
            limit: batchSize,
            ...options.filters
          });

          if (batch.data.length === 0) {
            hasMore = false;
            this.push(null);
            return;
          }

          // Transform and convert batch
          const transformedBatch = options.transform 
            ? batch.data.map(options.transform)
            : batch.data;

          const convertedData = await this.formatConverter.convert(
            transformedBatch,
            format,
            { streaming: true }
          );

          this.push(convertedData);
          offset += batchSize;
          
        } catch (error) {
          this.emit('error', error);
        }
      }
    });
  }

  /**
   * Batch export with parallel processing
   */
  async exportBatch(
    jobs: Array<{
      format: ExportFormat;
      outputPath: string;
      options?: ExportOptions;
    }>,
    progressCallback?: (completedJobs: number, totalJobs: number) => void
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    let completedJobs = 0;

    // Process jobs in batches to respect concurrency limit
    const jobBatches = this.chunkArray(jobs, this.options.maxConcurrentJobs);

    for (const batch of jobBatches) {
      const batchPromises = batch.map(async (job) => {
        try {
          const result = await this.export(
            job.format,
            job.outputPath,
            job.options
          );
          completedJobs++;
          progressCallback?.(completedJobs, jobs.length);
          return result;
        } catch (error) {
          completedJobs++;
          progressCallback?.(completedJobs, jobs.length);
          throw error;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Log error but continue with other jobs
          console.error('Batch export job failed:', result.reason);
          results.push({
            success: false,
            jobId: uuidv4(),
            format: 'json' as ExportFormat,
            outputPath: '',
            exportedCount: 0,
            metadata: {} as ExportMetadata,
            processingTime: 0,
            error: result.reason.message
          });
        }
      });
    }

    return results;
  }

  /**
   * Export with cross-system compatibility
   */
  async exportForSystem(
    targetSystem: 'servicenow' | 'jira' | 'confluence' | 'sharepoint' | 'generic',
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    // Get system-specific configuration
    const systemConfig = this.getSystemConfig(targetSystem);
    
    // Apply system-specific transformations
    const enhancedOptions: ExportOptions = {
      ...options,
      format: systemConfig.preferredFormat,
      includeSystemMetadata: true,
      transform: {
        ...options.transform,
        ...systemConfig.fieldMappings
      }
    };

    // Add system-specific headers/metadata
    if (systemConfig.requiresHeaders) {
      enhancedOptions.customHeaders = {
        ...options.customHeaders,
        ...systemConfig.headers
      };
    }

    return this.export(
      systemConfig.preferredFormat,
      outputPath,
      enhancedOptions
    );
  }

  /**
   * Export with version compatibility
   */
  async exportCompatible(
    targetVersion: string,
    outputPath: string,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const compatibilityOptions = this.getCompatibilityOptions(targetVersion);
    
    const enhancedOptions: ExportOptions = {
      ...options,
      ...compatibilityOptions,
      includeVersionInfo: true,
      targetVersion
    };

    return this.export(
      options.format || 'json',
      outputPath,
      enhancedOptions
    );
  }

  /**
   * Get export job status
   */
  getJobStatus(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Cancel export job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    job.status = 'cancelled';
    job.endTime = new Date();
    
    this.emit('job:cancelled', job);
    return true;
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): ExportFormat[] {
    return this.formatConverter.getSupportedFormats();
  }

  /**
   * Validate export options
   */
  validateOptions(format: ExportFormat, options: ExportOptions): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Format-specific validations
    if (format === 'parquet' && !options.schema) {
      warnings.push('No schema provided for Parquet export - will use inferred schema');
    }

    if (format === 'avro' && !options.schema) {
      errors.push('Avro format requires schema definition');
    }

    if (options.compression && !this.formatConverter.supportsCompression(format)) {
      warnings.push(`Compression not supported for ${format} format`);
    }

    // Size validations
    if (options.includeHistory && format === 'csv') {
      warnings.push('CSV format may not preserve complex history data structure');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // =========================
  // Private Methods
  // =========================

  private createJob(
    jobId: string,
    format: ExportFormat,
    outputPath: string,
    options: ExportOptions
  ): ExportJob {
    return {
      id: jobId,
      format,
      options,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      metadata: {
        version: '2.0',
        exported_at: new Date().toISOString(),
        exported_by: 'Enhanced Export Service',
        source_system: 'Mainframe KB Assistant',
        target_format: format,
        export_options: options,
        compatibility_version: options.targetVersion || 'latest'
      }
    };
  }

  private async fetchFilteredEntries(options: ExportOptions): Promise<KBEntry[]> {
    const listOptions: any = {
      limit: options.limit || 10000
    };

    // Apply filters
    if (options.category) {
      listOptions.category = options.category;
    }

    if (options.since || options.until) {
      listOptions.filters = {};
      if (options.since) {
        listOptions.filters.createdAfter = options.since;
      }
      if (options.until) {
        listOptions.filters.createdBefore = options.until;
      }
    }

    if (options.tags) {
      listOptions.tags = options.tags;
    }

    if (options.includeArchived !== undefined) {
      listOptions.includeArchived = options.includeArchived;
    }

    const result = await this.kbService.list(listOptions);
    return result.data;
  }

  private async transformData(entries: KBEntry[], options: ExportOptions): Promise<any[]> {
    return this.dataTransformer.transform(entries, {
      format: options.format,
      includeMetrics: options.includeMetrics,
      includeHistory: options.includeHistory,
      customTransform: options.transform,
      targetSystem: options.targetSystem,
      version: options.targetVersion
    });
  }

  private async performExport(
    format: ExportFormat,
    data: any[],
    outputPath: string,
    options: ExportOptions,
    progressCallback: ProgressCallback
  ): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      // Convert data to target format
      const convertedData = await this.formatConverter.convert(data, format, {
        schema: options.schema,
        compression: options.compression,
        encoding: options.encoding,
        customHeaders: options.customHeaders,
        onProgress: progressCallback
      });

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Write to file
      if (typeof convertedData === 'string') {
        await fs.writeFile(outputPath, convertedData, 'utf8');
      } else {
        await fs.writeFile(outputPath, convertedData);
      }

      const processingTime = Date.now() - startTime;
      
      // Generate file stats
      const stats = await fs.stat(outputPath);
      
      return {
        success: true,
        jobId: uuidv4(),
        format,
        outputPath,
        exportedCount: data.length,
        fileSize: stats.size,
        metadata: {
          version: '2.0',
          exported_at: new Date().toISOString(),
          exported_by: 'Enhanced Export Service',
          source_system: 'Mainframe KB Assistant',
          target_format: format,
          export_options: options,
          compatibility_version: options.targetVersion || 'latest',
          total_entries: data.length,
          file_size: stats.size,
          encoding: options.encoding || 'utf8',
          compression: options.compression || 'none'
        },
        processingTime
      };
      
    } catch (error) {
      return {
        success: false,
        jobId: uuidv4(),
        format,
        outputPath,
        exportedCount: 0,
        metadata: {} as ExportMetadata,
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private getSystemConfig(system: string): any {
    const configs = {
      servicenow: {
        preferredFormat: 'json' as ExportFormat,
        requiresHeaders: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        fieldMappings: {
          'title': 'short_description',
          'problem': 'description',
          'solution': 'resolution_notes',
          'category': 'category'
        }
      },
      jira: {
        preferredFormat: 'json' as ExportFormat,
        requiresHeaders: true,
        headers: {
          'Content-Type': 'application/json'
        },
        fieldMappings: {
          'title': 'summary',
          'problem': 'description',
          'solution': 'resolution',
          'category': 'issuetype'
        }
      },
      confluence: {
        preferredFormat: 'xml' as ExportFormat,
        requiresHeaders: false,
        fieldMappings: {
          'solution': 'body'
        }
      },
      sharepoint: {
        preferredFormat: 'csv' as ExportFormat,
        requiresHeaders: false,
        fieldMappings: {}
      },
      generic: {
        preferredFormat: 'json' as ExportFormat,
        requiresHeaders: false,
        fieldMappings: {}
      }
    };

    return configs[system] || configs.generic;
  }

  private getCompatibilityOptions(version: string): Partial<ExportOptions> {
    const versionConfigs = {
      '1.0': {
        format: 'json' as ExportFormat,
        includeMetrics: false,
        includeHistory: false
      },
      '1.1': {
        format: 'json' as ExportFormat,
        includeMetrics: true,
        includeHistory: false
      },
      '2.0': {
        format: 'json' as ExportFormat,
        includeMetrics: true,
        includeHistory: true
      }
    };

    return versionConfigs[version] || versionConfigs['2.0'];
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

export default ExportService;