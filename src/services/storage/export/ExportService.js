'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ExportService = void 0;
const tslib_1 = require('tslib');
const events_1 = require('events');
const stream_1 = require('stream');
const promises_1 = tslib_1.__importDefault(require('fs/promises'));
const path_1 = tslib_1.__importDefault(require('path'));
const uuid_1 = require('uuid');
const FormatConverter_1 = require('./FormatConverter');
const DataTransformer_1 = require('./DataTransformer');
class ExportService extends events_1.EventEmitter {
  kbService;
  options;
  jobs = new Map();
  formatConverter;
  dataTransformer;
  batchProcessor;
  constructor(
    kbService,
    options = {
      maxConcurrentJobs: 3,
      defaultBatchSize: 1000,
      enableCompression: true,
      retainJobHistory: true,
    }
  ) {
    super();
    this.kbService = kbService;
    this.options = options;
    this.formatConverter = new FormatConverter_1.FormatConverter();
    this.dataTransformer = new DataTransformer_1.DataTransformer();
    this.batchProcessor = new BatchProcessor_1.BatchProcessor({
      batchSize: this.options.defaultBatchSize,
      enableProgress: true,
    });
  }
  async export(format, outputPath, options = {}, progressCallback) {
    const jobId = (0, uuid_1.v4)();
    const job = this.createJob(jobId, format, outputPath, options);
    this.jobs.set(jobId, job);
    try {
      this.emit('job:started', job);
      const entries = await this.fetchFilteredEntries(options);
      const transformedData = await this.transformData(entries, options);
      const result = await this.performExport(
        format,
        transformedData,
        outputPath,
        options,
        progress => {
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
      job.error = error;
      this.emit('job:failed', job);
      throw error;
    }
  }
  async exportStream(format, options = {}) {
    const batchSize = options.batchSize || this.options.defaultBatchSize;
    let offset = 0;
    let hasMore = true;
    return new stream_1.Readable({
      objectMode: true,
      async read() {
        if (!hasMore) {
          this.push(null);
          return;
        }
        try {
          const batch = await this.kbService.list({
            offset,
            limit: batchSize,
            ...options.filters,
          });
          if (batch.data.length === 0) {
            hasMore = false;
            this.push(null);
            return;
          }
          const transformedBatch = options.transform
            ? batch.data.map(options.transform)
            : batch.data;
          const convertedData = await this.formatConverter.convert(transformedBatch, format, {
            streaming: true,
          });
          this.push(convertedData);
          offset += batchSize;
        } catch (error) {
          this.emit('error', error);
        }
      },
    });
  }
  async exportBatch(jobs, progressCallback) {
    const results = [];
    let completedJobs = 0;
    const jobBatches = this.chunkArray(jobs, this.options.maxConcurrentJobs);
    for (const batch of jobBatches) {
      const batchPromises = batch.map(async job => {
        try {
          const result = await this.export(job.format, job.outputPath, job.options);
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
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch export job failed:', result.reason);
          results.push({
            success: false,
            jobId: (0, uuid_1.v4)(),
            format: 'json',
            outputPath: '',
            exportedCount: 0,
            metadata: {},
            processingTime: 0,
            error: result.reason.message,
          });
        }
      });
    }
    return results;
  }
  async exportForSystem(targetSystem, outputPath, options = {}) {
    const systemConfig = this.getSystemConfig(targetSystem);
    const enhancedOptions = {
      ...options,
      format: systemConfig.preferredFormat,
      includeSystemMetadata: true,
      transform: {
        ...options.transform,
        ...systemConfig.fieldMappings,
      },
    };
    if (systemConfig.requiresHeaders) {
      enhancedOptions.customHeaders = {
        ...options.customHeaders,
        ...systemConfig.headers,
      };
    }
    return this.export(systemConfig.preferredFormat, outputPath, enhancedOptions);
  }
  async exportCompatible(targetVersion, outputPath, options = {}) {
    const compatibilityOptions = this.getCompatibilityOptions(targetVersion);
    const enhancedOptions = {
      ...options,
      ...compatibilityOptions,
      includeVersionInfo: true,
      targetVersion,
    };
    return this.export(options.format || 'json', outputPath, enhancedOptions);
  }
  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }
  async cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }
    job.status = 'cancelled';
    job.endTime = new Date();
    this.emit('job:cancelled', job);
    return true;
  }
  getSupportedFormats() {
    return this.formatConverter.getSupportedFormats();
  }
  validateOptions(format, options) {
    const errors = [];
    const warnings = [];
    if (format === 'parquet' && !options.schema) {
      warnings.push('No schema provided for Parquet export - will use inferred schema');
    }
    if (format === 'avro' && !options.schema) {
      errors.push('Avro format requires schema definition');
    }
    if (options.compression && !this.formatConverter.supportsCompression(format)) {
      warnings.push(`Compression not supported for ${format} format`);
    }
    if (options.includeHistory && format === 'csv') {
      warnings.push('CSV format may not preserve complex history data structure');
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  createJob(jobId, format, outputPath, options) {
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
        compatibility_version: options.targetVersion || 'latest',
      },
    };
  }
  async fetchFilteredEntries(options) {
    const listOptions = {
      limit: options.limit || 10000,
    };
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
  async transformData(entries, options) {
    return this.dataTransformer.transform(entries, {
      format: options.format,
      includeMetrics: options.includeMetrics,
      includeHistory: options.includeHistory,
      customTransform: options.transform,
      targetSystem: options.targetSystem,
      version: options.targetVersion,
    });
  }
  async performExport(format, data, outputPath, options, progressCallback) {
    const startTime = Date.now();
    try {
      const convertedData = await this.formatConverter.convert(data, format, {
        schema: options.schema,
        compression: options.compression,
        encoding: options.encoding,
        customHeaders: options.customHeaders,
        onProgress: progressCallback,
      });
      const outputDir = path_1.default.dirname(outputPath);
      await promises_1.default.mkdir(outputDir, { recursive: true });
      if (typeof convertedData === 'string') {
        await promises_1.default.writeFile(outputPath, convertedData, 'utf8');
      } else {
        await promises_1.default.writeFile(outputPath, convertedData);
      }
      const processingTime = Date.now() - startTime;
      const stats = await promises_1.default.stat(outputPath);
      return {
        success: true,
        jobId: (0, uuid_1.v4)(),
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
          compression: options.compression || 'none',
        },
        processingTime,
      };
    } catch (error) {
      return {
        success: false,
        jobId: (0, uuid_1.v4)(),
        format,
        outputPath,
        exportedCount: 0,
        metadata: {},
        processingTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }
  getSystemConfig(system) {
    const configs = {
      servicenow: {
        preferredFormat: 'json',
        requiresHeaders: true,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        fieldMappings: {
          title: 'short_description',
          problem: 'description',
          solution: 'resolution_notes',
          category: 'category',
        },
      },
      jira: {
        preferredFormat: 'json',
        requiresHeaders: true,
        headers: {
          'Content-Type': 'application/json',
        },
        fieldMappings: {
          title: 'summary',
          problem: 'description',
          solution: 'resolution',
          category: 'issuetype',
        },
      },
      confluence: {
        preferredFormat: 'xml',
        requiresHeaders: false,
        fieldMappings: {
          solution: 'body',
        },
      },
      sharepoint: {
        preferredFormat: 'csv',
        requiresHeaders: false,
        fieldMappings: {},
      },
      generic: {
        preferredFormat: 'json',
        requiresHeaders: false,
        fieldMappings: {},
      },
    };
    return configs[system] || configs.generic;
  }
  getCompatibilityOptions(version) {
    const versionConfigs = {
      '1.0': {
        format: 'json',
        includeMetrics: false,
        includeHistory: false,
      },
      1.1: {
        format: 'json',
        includeMetrics: true,
        includeHistory: false,
      },
      '2.0': {
        format: 'json',
        includeMetrics: true,
        includeHistory: true,
      },
    };
    return versionConfigs[version] || versionConfigs['2.0'];
  }
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
exports.ExportService = ExportService;
exports.default = ExportService;
//# sourceMappingURL=ExportService.js.map
