"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const stream_1 = require("stream");
const promises_1 = tslib_1.__importDefault(require("fs/promises"));
const path_1 = tslib_1.__importDefault(require("path"));
const uuid_1 = require("uuid");
const FormatConverter_1 = require("./FormatConverter");
const DataTransformer_1 = require("./DataTransformer");
const ValidationService_1 = require("./ValidationService");
class ImportService extends events_1.EventEmitter {
    kbService;
    options;
    jobs = new Map();
    checkpoints = new Map();
    formatConverter;
    dataTransformer;
    validationService;
    batchProcessor;
    constructor(kbService, options = {
        maxConcurrentJobs: 2,
        defaultBatchSize: 100,
        enableCheckpoints: true,
        autoValidation: true,
        enableRecovery: true
    }) {
        super();
        this.kbService = kbService;
        this.options = options;
        this.formatConverter = new FormatConverter_1.FormatConverter();
        this.dataTransformer = new DataTransformer_1.DataTransformer();
        this.validationService = new ValidationService_1.ValidationService();
        this.batchProcessor = new BatchProcessor_1.BatchProcessor({
            batchSize: this.options.defaultBatchSize,
            enableProgress: true
        });
    }
    async import(filePath, format, options = {}, progressCallback) {
        const jobId = (0, uuid_1.v4)();
        const job = this.createJob(jobId, filePath, format, options);
        this.jobs.set(jobId, job);
        try {
            this.emit('job:started', job);
            await this.preImportValidation(filePath, format, options);
            const rawData = await this.readFile(filePath);
            const parsedData = await this.parseData(rawData, format, options);
            const validationResult = await this.validateData(parsedData, options);
            if (!validationResult.valid && !options.allowPartialImport) {
                throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
            }
            const transformedData = await this.transformData(parsedData, options);
            const result = await this.performImport(transformedData, options, (progress) => {
                job.progress = progress;
                this.emit('job:progress', job);
                progressCallback?.(progress);
            });
            job.status = 'completed';
            job.endTime = new Date();
            job.result = result;
            this.emit('job:completed', job);
            return result;
        }
        catch (error) {
            job.status = 'failed';
            job.endTime = new Date();
            job.error = error;
            if (options.recovery?.enableAutoRecovery) {
                try {
                    const recoveryResult = await this.attemptRecovery(job);
                    if (recoveryResult.success) {
                        job.status = 'completed';
                        job.result = recoveryResult;
                        this.emit('job:recovered', job);
                        return recoveryResult;
                    }
                }
                catch (recoveryError) {
                    console.error('Recovery failed:', recoveryError);
                }
            }
            this.emit('job:failed', job);
            throw error;
        }
    }
    async importStream(stream, format, options = {}, progressCallback) {
        const jobId = (0, uuid_1.v4)();
        const job = this.createJob(jobId, 'stream', format, options);
        this.jobs.set(jobId, job);
        return new Promise((resolve, reject) => {
            const results = [];
            let processedCount = 0;
            let errorCount = 0;
            const transform = new stream_1.Transform({
                objectMode: true,
                async transform(chunk, encoding, callback) {
                    try {
                        const parsedChunk = await this.formatConverter.parseChunk(chunk, format);
                        const validation = await this.validationService.validateBatch(parsedChunk);
                        if (validation.valid || options.allowPartialImport) {
                            const transformedChunk = await this.dataTransformer.transformBatch(parsedChunk, options);
                            const importResult = await this.importBatch(transformedChunk, options);
                            results.push(importResult);
                            processedCount += transformedChunk.length;
                            const progress = Math.min(100, (processedCount / (options.expectedTotal || 1000)) * 100);
                            progressCallback?.(progress);
                        }
                        else {
                            errorCount += parsedChunk.length;
                        }
                        callback();
                    }
                    catch (error) {
                        errorCount++;
                        callback(error);
                    }
                }
            });
            stream
                .pipe(transform)
                .on('finish', () => {
                const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
                const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
                const result = {
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
                        duplicates: 0
                    }
                };
                job.status = 'completed';
                job.result = result;
                resolve(result);
            })
                .on('error', (error) => {
                job.status = 'failed';
                job.error = error;
                reject(error);
            });
        });
    }
    async validateImport(filePath, format, options = {}) {
        try {
            const rawData = await this.readFile(filePath);
            const parsedData = await this.parseData(rawData, format, {});
            return await this.validationService.validateImportData(parsedData, {
                strictMode: options.strictMode,
                validateSchema: options.validateSchema,
                customValidators: options.customValidators
            });
        }
        catch (error) {
            return {
                valid: false,
                errors: [error.message],
                warnings: [],
                stats: {
                    totalRecords: 0,
                    validRecords: 0,
                    invalidRecords: 0,
                    duplicateRecords: 0
                }
            };
        }
    }
    async importFromSystem(filePath, sourceSystem, options = {}) {
        const systemConfig = this.getSystemConfig(sourceSystem);
        const enhancedOptions = {
            ...options,
            transform: {
                ...options.transform,
                fieldMappings: systemConfig.fieldMappings,
                systemSpecific: true
            },
            validation: {
                ...options.validation,
                customValidators: systemConfig.validators
            }
        };
        return this.import(filePath, systemConfig.expectedFormat, enhancedOptions);
    }
    async importCompatible(filePath, sourceVersion, options = {}) {
        const compatibilityConfig = this.getCompatibilityConfig(sourceVersion);
        const enhancedOptions = {
            ...options,
            ...compatibilityConfig,
            sourceVersion
        };
        return this.import(filePath, 'json', enhancedOptions);
    }
    async resumeImport(jobId) {
        const checkpoint = this.checkpoints.get(jobId);
        if (!checkpoint) {
            throw new Error(`No checkpoint found for job ${jobId}`);
        }
        const job = this.jobs.get(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        job.status = 'running';
        try {
            const remainingData = checkpoint.data.slice(checkpoint.processedCount);
            const result = await this.performImport(remainingData, job.options, (progress) => {
                job.progress = progress;
                this.emit('job:progress', job);
            }, checkpoint);
            result.imported += checkpoint.successCount;
            result.summary.totalProcessed += checkpoint.processedCount;
            job.status = 'completed';
            job.result = result;
            this.emit('job:resumed', job);
            return result;
        }
        catch (error) {
            job.status = 'failed';
            job.error = error;
            throw error;
        }
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
        if (job.options.recovery?.rollbackOnFailure) {
            await this.rollbackImport(jobId);
        }
        this.emit('job:cancelled', job);
        return true;
    }
    getSupportedFormats() {
        return this.formatConverter.getSupportedFormats();
    }
    createJob(jobId, source, format, options) {
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
                recoveryEnabled: this.options.enableRecovery
            }
        };
    }
    async preImportValidation(filePath, format, options) {
        try {
            await promises_1.default.access(filePath, promises_1.default.constants.R_OK);
        }
        catch (error) {
            throw new Error(`File not accessible: ${filePath}`);
        }
        const stats = await promises_1.default.stat(filePath);
        if (stats.size === 0) {
            throw new Error('Import file is empty');
        }
        if (stats.size > 100 * 1024 * 1024) {
            console.warn(`Large file detected (${stats.size} bytes), consider using stream import`);
        }
        const fileExt = path_1.default.extname(filePath).toLowerCase();
        const expectedExts = this.getFormatExtensions(format);
        if (!expectedExts.includes(fileExt)) {
            console.warn(`File extension ${fileExt} doesn't match format ${format}`);
        }
    }
    async readFile(filePath) {
        const stats = await promises_1.default.stat(filePath);
        if (stats.size > 50 * 1024 * 1024) {
            throw new Error('File too large for direct import, use stream import instead');
        }
        return promises_1.default.readFile(filePath);
    }
    async parseData(rawData, format, options) {
        return this.formatConverter.parse(rawData, format, {
            encoding: options.encoding,
            schema: options.schema,
            strictMode: options.validation?.strictMode
        });
    }
    async validateData(data, options) {
        return this.validationService.validateImportData(data, {
            strictMode: options.validation?.strictMode,
            allowPartialImport: options.allowPartialImport,
            customValidators: options.validation?.customValidators
        });
    }
    async transformData(data, options) {
        return this.dataTransformer.transformForImport(data, {
            fieldMappings: options.transform?.fieldMappings,
            customTransform: options.transform?.customTransform,
            sourceSystem: options.sourceSystem,
            sourceVersion: options.sourceVersion
        });
    }
    async performImport(data, options, progressCallback, checkpoint) {
        const startTime = Date.now();
        const batchSize = options.batchSize || this.options.defaultBatchSize;
        let imported = checkpoint?.successCount || 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];
        const warnings = [];
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
                const progress = Math.min(100, ((i + batchSize) / data.length) * 100);
                progressCallback(progress);
                if (this.options.enableCheckpoints) {
                    await this.createCheckpoint(data, i + batchSize, imported, errors.length);
                }
            }
            catch (error) {
                if (options.recovery?.rollbackOnFailure) {
                    await this.rollbackImport('current');
                    throw error;
                }
                errors.push({
                    batch: i / batchSize,
                    message: error.message,
                    recoverable: true
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
                duplicates: skipped
            }
        };
    }
    async importBatch(batch, options) {
        return this.batchProcessor.processBatch(batch, async (entries) => {
            const results = {
                imported: 0,
                updated: 0,
                skipped: 0,
                errors: [],
                warnings: []
            };
            for (const entry of entries) {
                try {
                    const existing = await this.findExistingEntry(entry);
                    if (existing) {
                        if (options.skipDuplicates) {
                            results.skipped++;
                            continue;
                        }
                        if (options.updateExisting) {
                            await this.kbService.update(existing.id, entry);
                            results.updated++;
                        }
                        else {
                            results.skipped++;
                        }
                    }
                    else {
                        await this.kbService.create(entry);
                        results.imported++;
                    }
                }
                catch (error) {
                    results.errors.push({
                        entry: entry.title,
                        error: error.message
                    });
                }
            }
            return results;
        });
    }
    async findExistingEntry(entry) {
        try {
            const results = await this.kbService.search(entry.title, { limit: 1 });
            return results.find(r => r.entry.title.toLowerCase() === entry.title.toLowerCase())?.entry || null;
        }
        catch (error) {
            return null;
        }
    }
    async createCheckpoint(data, processedCount, successCount, errorCount) {
        const checkpoint = {
            jobId: (0, uuid_1.v4)(),
            processedCount,
            successCount,
            errorCount,
            lastProcessedId: data[processedCount - 1]?.id || '',
            timestamp: new Date(),
            data
        };
        this.checkpoints.set(checkpoint.jobId, checkpoint);
    }
    async attemptRecovery(job) {
        console.log('Attempting recovery for job:', job.id);
        throw new Error('Recovery not implemented');
    }
    async rollbackImport(jobId) {
        console.log('Rolling back import for job:', jobId);
    }
    getSystemConfig(system) {
        const configs = {
            servicenow: {
                expectedFormat: 'json',
                fieldMappings: {
                    'short_description': 'title',
                    'description': 'problem',
                    'resolution_notes': 'solution',
                    'category': 'category'
                },
                validators: []
            },
            jira: {
                expectedFormat: 'json',
                fieldMappings: {
                    'summary': 'title',
                    'description': 'problem',
                    'resolution': 'solution',
                    'issuetype': 'category'
                },
                validators: []
            },
            generic: {
                expectedFormat: 'json',
                fieldMappings: {},
                validators: []
            }
        };
        return configs[system] || configs.generic;
    }
    getCompatibilityConfig(version) {
        const configs = {
            '1.0': {
                transform: {
                    legacyCompatibility: true
                }
            },
            '2.0': {
                transform: {
                    enhancedFeatures: true
                }
            }
        };
        return configs[version] || {};
    }
    getFormatExtensions(format) {
        const extensionMap = {
            json: ['.json'],
            csv: ['.csv'],
            xml: ['.xml'],
            parquet: ['.parquet'],
            avro: ['.avro'],
            orc: ['.orc']
        };
        return extensionMap[format] || [];
    }
}
exports.ImportService = ImportService;
exports.default = ImportService;
//# sourceMappingURL=ImportService.js.map