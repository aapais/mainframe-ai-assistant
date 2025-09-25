/**
 * Enhanced Import Service - Multi-format support with validation and transformation
 * Supports JSON, CSV, XML, Parquet, Avro, ORC formats with comprehensive validation
 */

import { EventEmitter } from 'events';
import { Readable, Transform } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { FormatConverter } from './FormatConverter';
import { DataTransformer } from './DataTransformer';
import { ValidationService } from './ValidationService';
import { BatchProcessor } from './BatchProcessor';
import {
  IImportService,
  ImportOptions,
  ImportResult,
  ImportFormat,
  ImportJob,
  ValidationResult,
  ProgressCallback,
  KBEntryInput,
  IKnowledgeBaseService,
} from '../../../types/services';

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

/**
 * Advanced Import Service with validation, transformation, and error recovery
 */
export class ImportService extends EventEmitter implements IImportService {
  private jobs = new Map<string, ImportJob>();
  private checkpoints = new Map<string, ImportCheckpoint>();
  private formatConverter: FormatConverter;
  private dataTransformer: DataTransformer;
  private validationService: ValidationService;
  private batchProcessor: BatchProcessor;

  constructor(
    private kbService: IKnowledgeBaseService,
    private options = {
      maxConcurrentJobs: 2,
      defaultBatchSize: 100,
      enableCheckpoints: true,
      autoValidation: true,
      enableRecovery: true,
    }
  ) {
    super();
    this.formatConverter = new FormatConverter();
    this.dataTransformer = new DataTransformer();
    this.validationService = new ValidationService();
    this.batchProcessor = new BatchProcessor({
      batchSize: this.options.defaultBatchSize,
      enableProgress: true,
    });
  }

  /**
   * Import data from file with comprehensive validation
   */
  async import(
    filePath: string,
    format: ImportFormat,
    options: ImportOptions = {},
    progressCallback?: ProgressCallback
  ): Promise<ImportResult> {
    const jobId = uuidv4();
    const job = this.createJob(jobId, filePath, format, options);

    this.jobs.set(jobId, job);

    try {
      this.emit('job:started', job);

      // Pre-import validation
      await this.preImportValidation(filePath, format, options);

      // Read and parse file
      const rawData = await this.readFile(filePath);
      const parsedData = await this.parseData(rawData, format, options);

      // Validate data structure
      const validationResult = await this.validateData(parsedData, options);

      if (!validationResult.valid && !options.allowPartialImport) {
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Transform data
      const transformedData = await this.transformData(parsedData, options);

      // Import with recovery support
      const result = await this.performImport(transformedData, options, progress => {
        job.progress = progress;
        this.emit('job:progress', job);
        progressCallback?.(progress);
      });

      job.status = 'completed';
      job.endTime = new Date();
      job.result = result;

      this.emit('job:completed', job);
      return result;
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error as Error;

      // Attempt recovery if enabled
      if (options.recovery?.enableAutoRecovery) {
        try {
          const recoveryResult = await this.attemptRecovery(job);
          if (recoveryResult.success) {
            job.status = 'completed';
            job.result = recoveryResult;
            this.emit('job:recovered', job);
            return recoveryResult;
          }
        } catch (recoveryError) {
          console.error('Recovery failed:', recoveryError);
        }
      }

      this.emit('job:failed', job);
      throw error;
    }
  }

  /**
   * Import from stream for large datasets
   */
  async importStream(
    stream: Readable,
    format: ImportFormat,
    options: ImportOptions = {},
    progressCallback?: ProgressCallback
  ): Promise<ImportResult> {
    const jobId = uuidv4();
    const job = this.createJob(jobId, 'stream', format, options);

    this.jobs.set(jobId, job);

    return new Promise((resolve, reject) => {
      const results: any[] = [];
      let processedCount = 0;
      let errorCount = 0;

      const transform = new Transform({
        objectMode: true,
        async transform(chunk, encoding, callback) {
          try {
            // Parse chunk based on format
            const parsedChunk = await this.formatConverter.parseChunk(chunk, format);

            // Validate chunk
            const validation = await this.validationService.validateBatch(parsedChunk);

            if (validation.valid || options.allowPartialImport) {
              // Transform chunk
              const transformedChunk = await this.dataTransformer.transformBatch(
                parsedChunk,
                options
              );

              // Import chunk
              const importResult = await this.importBatch(transformedChunk, options);

              results.push(importResult);
              processedCount += transformedChunk.length;

              // Update progress
              const progress = Math.min(
                100,
                (processedCount / (options.expectedTotal || 1000)) * 100
              );
              progressCallback?.(progress);
            } else {
              errorCount += parsedChunk.length;
            }

            callback();
          } catch (error) {
            errorCount++;
            callback(error);
          }
        },
      });

      stream
        .pipe(transform)
        .on('finish', () => {
          const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
          const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);

          const result: ImportResult = {
            success: errorCount === 0 || totalImported > 0,
            imported: totalImported,
            updated: totalUpdated,
            skipped: errorCount,
            errors: [],
            warnings: [],
            summary: {
              totalProcessed: processedCount,
              processingTime: Date.now() - job.startTime.getTime(),
              validationErrors: errorCount,
              duplicates: 0,
            },
          };

          job.status = 'completed';
          job.result = result;
          resolve(result);
        })
        .on('error', error => {
          job.status = 'failed';
          job.error = error;
          reject(error);
        });
    });
  }

  /**
   * Validate import file without importing
   */
  async validateImport(
    filePath: string,
    format: ImportFormat,
    options: ImportValidationOptions = {}
  ): Promise<ValidationResult> {
    try {
      // Read and parse file
      const rawData = await this.readFile(filePath);
      const parsedData = await this.parseData(rawData, format, {});

      // Comprehensive validation
      return await this.validationService.validateImportData(parsedData, {
        strictMode: options.strictMode,
        validateSchema: options.validateSchema,
        customValidators: options.customValidators,
      });
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        warnings: [],
        stats: {
          totalRecords: 0,
          validRecords: 0,
          invalidRecords: 0,
          duplicateRecords: 0,
        },
      };
    }
  }

  /**
   * Import with cross-system compatibility
   */
  async importFromSystem(
    filePath: string,
    sourceSystem: 'servicenow' | 'jira' | 'confluence' | 'sharepoint' | 'generic',
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    // Get system-specific configuration
    const systemConfig = this.getSystemConfig(sourceSystem);

    // Enhance options with system-specific settings
    const enhancedOptions: ImportOptions = {
      ...options,
      transform: {
        ...options.transform,
        fieldMappings: systemConfig.fieldMappings,
        systemSpecific: true,
      },
      validation: {
        ...options.validation,
        customValidators: systemConfig.validators,
      },
    };

    return this.import(filePath, systemConfig.expectedFormat, enhancedOptions);
  }

  /**
   * Import with version compatibility
   */
  async importCompatible(
    filePath: string,
    sourceVersion: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const compatibilityConfig = this.getCompatibilityConfig(sourceVersion);

    const enhancedOptions: ImportOptions = {
      ...options,
      ...compatibilityConfig,
      sourceVersion,
    };

    return this.import(filePath, 'json', enhancedOptions);
  }

  /**
   * Resume import from checkpoint
   */
  async resumeImport(jobId: string): Promise<ImportResult> {
    const checkpoint = this.checkpoints.get(jobId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for job ${jobId}`);
    }

    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Resume from checkpoint
    job.status = 'running';

    try {
      const remainingData = checkpoint.data.slice(checkpoint.processedCount);

      const result = await this.performImport(
        remainingData,
        job.options,
        progress => {
          job.progress = progress;
          this.emit('job:progress', job);
        },
        checkpoint
      );

      // Combine with previous results
      result.imported += checkpoint.successCount;
      result.summary.totalProcessed += checkpoint.processedCount;

      job.status = 'completed';
      job.result = result;

      this.emit('job:resumed', job);
      return result;
    } catch (error) {
      job.status = 'failed';
      job.error = error as Error;
      throw error;
    }
  }

  /**
   * Get import job status
   */
  getJobStatus(jobId: string): ImportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Cancel import job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    job.status = 'cancelled';
    job.endTime = new Date();

    // Rollback if configured
    if (job.options.recovery?.rollbackOnFailure) {
      await this.rollbackImport(jobId);
    }

    this.emit('job:cancelled', job);
    return true;
  }

  /**
   * Get supported import formats
   */
  getSupportedFormats(): ImportFormat[] {
    return this.formatConverter.getSupportedFormats() as ImportFormat[];
  }

  // =========================
  // Private Methods
  // =========================

  private createJob(
    jobId: string,
    source: string,
    format: ImportFormat,
    options: ImportOptions
  ): ImportJob {
    return {
      id: jobId,
      source,
      format,
      options,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      metadata: {
        sourceSystem: options.sourceSystem || 'unknown',
        sourceVersion: options.sourceVersion || 'unknown',
        importedBy: 'Enhanced Import Service',
        validationEnabled: this.options.autoValidation,
        recoveryEnabled: this.options.enableRecovery,
      },
    };
  }

  private async preImportValidation(
    filePath: string,
    format: ImportFormat,
    options: ImportOptions
  ): Promise<void> {
    // Check file exists and is readable
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`File not accessible: ${filePath}`);
    }

    // Check file size
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new Error('Import file is empty');
    }

    // Large file warning
    if (stats.size > 100 * 1024 * 1024) {
      // 100MB
      console.warn(`Large file detected (${stats.size} bytes), consider using stream import`);
    }

    // Format-specific validations
    const fileExt = path.extname(filePath).toLowerCase();
    const expectedExts = this.getFormatExtensions(format);

    if (!expectedExts.includes(fileExt)) {
      console.warn(`File extension ${fileExt} doesn't match format ${format}`);
    }
  }

  private async readFile(filePath: string): Promise<string | Buffer> {
    const stats = await fs.stat(filePath);

    // For large files, consider streaming
    if (stats.size > 50 * 1024 * 1024) {
      // 50MB
      throw new Error('File too large for direct import, use stream import instead');
    }

    return fs.readFile(filePath);
  }

  private async parseData(
    rawData: string | Buffer,
    format: ImportFormat,
    options: ImportOptions
  ): Promise<any[]> {
    return this.formatConverter.parse(rawData, format, {
      encoding: options.encoding,
      schema: options.schema,
      strictMode: options.validation?.strictMode,
    });
  }

  private async validateData(data: any[], options: ImportOptions): Promise<ValidationResult> {
    return this.validationService.validateImportData(data, {
      strictMode: options.validation?.strictMode,
      allowPartialImport: options.allowPartialImport,
      customValidators: options.validation?.customValidators,
    });
  }

  private async transformData(data: any[], options: ImportOptions): Promise<KBEntryInput[]> {
    return this.dataTransformer.transformForImport(data, {
      fieldMappings: options.transform?.fieldMappings,
      customTransform: options.transform?.customTransform,
      sourceSystem: options.sourceSystem,
      sourceVersion: options.sourceVersion,
    });
  }

  private async performImport(
    data: KBEntryInput[],
    options: ImportOptions,
    progressCallback: ProgressCallback,
    checkpoint?: ImportCheckpoint
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const batchSize = options.batchSize || this.options.defaultBatchSize;

    let imported = checkpoint?.successCount || 0;
    let updated = 0;
    let skipped = 0;
    let errors: any[] = [];
    let warnings: any[] = [];

    const startIndex = checkpoint?.processedCount || 0;

    for (let i = startIndex; i < data.length; i += batchSize) {
      const batch = data.slice(i, Math.min(i + batchSize, data.length));

      try {
        const batchResult = await this.importBatch(batch, options);

        imported += batchResult.imported;
        updated += batchResult.updated;
        skipped += batchResult.skipped;
        errors.push(...batchResult.errors);
        warnings.push(...batchResult.warnings);

        // Update progress
        const progress = Math.min(100, ((i + batchSize) / data.length) * 100);
        progressCallback(progress);

        // Create checkpoint
        if (this.options.enableCheckpoints) {
          await this.createCheckpoint(data, i + batchSize, imported, errors.length);
        }
      } catch (error) {
        if (options.recovery?.rollbackOnFailure) {
          await this.rollbackImport('current');
          throw error;
        }

        // Log error and continue with next batch
        errors.push({
          batch: i / batchSize,
          message: error.message,
          recoverable: true,
        });
      }
    }

    return {
      success: errors.length === 0 || imported > 0,
      imported,
      updated,
      skipped,
      errors,
      warnings,
      summary: {
        totalProcessed: data.length,
        processingTime: Date.now() - startTime,
        validationErrors: errors.filter(e => e.type === 'validation').length,
        duplicates: skipped,
      },
    };
  }

  private async importBatch(
    batch: KBEntryInput[],
    options: ImportOptions
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: any[];
    warnings: any[];
  }> {
    return this.batchProcessor.processBatch(batch, async entries => {
      const results = {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [] as any[],
        warnings: [] as any[],
      };

      for (const entry of entries) {
        try {
          // Check for duplicates
          const existing = await this.findExistingEntry(entry);

          if (existing) {
            if (options.skipDuplicates) {
              results.skipped++;
              continue;
            }

            if (options.updateExisting) {
              await this.kbService.update(existing.id, entry);
              results.updated++;
            } else {
              results.skipped++;
            }
          } else {
            await this.kbService.create(entry);
            results.imported++;
          }
        } catch (error) {
          results.errors.push({
            entry: entry.title,
            error: error.message,
          });
        }
      }

      return results;
    });
  }

  private async findExistingEntry(entry: KBEntryInput): Promise<any | null> {
    // Simple duplicate detection - can be enhanced
    try {
      const results = await this.kbService.search(entry.title, { limit: 1 });
      return (
        results.find(r => r.entry.title.toLowerCase() === entry.title.toLowerCase())?.entry || null
      );
    } catch (error) {
      return null;
    }
  }

  private async createCheckpoint(
    data: any[],
    processedCount: number,
    successCount: number,
    errorCount: number
  ): Promise<void> {
    const checkpoint: ImportCheckpoint = {
      jobId: uuidv4(),
      processedCount,
      successCount,
      errorCount,
      lastProcessedId: data[processedCount - 1]?.id || '',
      timestamp: new Date(),
      data,
    };

    this.checkpoints.set(checkpoint.jobId, checkpoint);
  }

  private async attemptRecovery(job: ImportJob): Promise<ImportResult> {
    // Implement recovery logic based on job type and error
    console.log('Attempting recovery for job:', job.id);

    // This is a placeholder - implement actual recovery logic
    throw new Error('Recovery not implemented');
  }

  private async rollbackImport(jobId: string): Promise<void> {
    // Implement rollback logic
    console.log('Rolling back import for job:', jobId);

    // This is a placeholder - implement actual rollback logic
  }

  private getSystemConfig(system: string): any {
    const configs = {
      servicenow: {
        expectedFormat: 'json' as ImportFormat,
        fieldMappings: {
          short_description: 'title',
          description: 'problem',
          resolution_notes: 'solution',
          category: 'category',
        },
        validators: [],
      },
      jira: {
        expectedFormat: 'json' as ImportFormat,
        fieldMappings: {
          summary: 'title',
          description: 'problem',
          resolution: 'solution',
          issuetype: 'category',
        },
        validators: [],
      },
      generic: {
        expectedFormat: 'json' as ImportFormat,
        fieldMappings: {},
        validators: [],
      },
    };

    return configs[system] || configs.generic;
  }

  private getCompatibilityConfig(version: string): Partial<ImportOptions> {
    const configs = {
      '1.0': {
        transform: {
          legacyCompatibility: true,
        },
      },
      '2.0': {
        transform: {
          enhancedFeatures: true,
        },
      },
    };

    return configs[version] || {};
  }

  private getFormatExtensions(format: ImportFormat): string[] {
    const extensionMap = {
      json: ['.json'],
      csv: ['.csv'],
      xml: ['.xml'],
      parquet: ['.parquet'],
      avro: ['.avro'],
      orc: ['.orc'],
    };

    return extensionMap[format] || [];
  }
}

export default ImportService;
