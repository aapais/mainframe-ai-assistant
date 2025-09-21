"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataExporter = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const fs_1 = require("fs");
const path = tslib_1.__importStar(require("path"));
class DataExporter extends events_1.EventEmitter {
    logger;
    jobs;
    formatHandlers;
    transformers;
    outputDirectory;
    maxConcurrentJobs;
    activeJobs = 0;
    constructor(logger, outputDirectory = './exports', maxConcurrentJobs = 5) {
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
    async ensureOutputDirectory() {
        try {
            await fs_1.promises.mkdir(this.outputDirectory, { recursive: true });
        }
        catch (error) {
            this.logger.error('Failed to create output directory', error);
        }
    }
    initializeFormatHandlers() {
        this.registerFormatHandler(new CSVFormatHandler());
        this.registerFormatHandler(new JSONFormatHandler());
        this.registerFormatHandler(new XMLFormatHandler());
        this.registerFormatHandler(new HTMLFormatHandler());
        this.registerFormatHandler(new ExcelFormatHandler());
        this.registerFormatHandler(new PDFFormatHandler());
    }
    registerFormatHandler(handler) {
        this.formatHandlers.set(handler.format, handler);
        this.logger.info(`Format handler registered: ${handler.format}`);
    }
    registerTransformer(transformer) {
        this.transformers.set(transformer.name, transformer);
        this.logger.info(`Data transformer registered: ${transformer.name}`);
    }
    async exportData(data, config) {
        if (this.activeJobs >= this.maxConcurrentJobs) {
            throw new Error('Maximum concurrent export jobs reached');
        }
        const jobId = this.generateJobId();
        const job = {
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
        this.processJob(jobId).catch(error => {
            this.logger.error(`Export job failed: ${jobId}`, error);
        });
        return jobId;
    }
    async processJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return;
        }
        try {
            this.activeJobs++;
            job.status = 'processing';
            this.emit('jobStarted', job);
            const validationErrors = this.validateConfig(job.config);
            if (validationErrors.length > 0) {
                throw new Error(`Configuration validation failed: ${validationErrors.join(', ')}`);
            }
            job.progress = 10;
            this.emit('jobProgress', job);
            const transformedData = await this.applyTransformations(job.data, job.config);
            job.progress = 20;
            this.emit('jobProgress', job);
            const filePath = this.generateFilePath(job.config);
            job.progress = 30;
            this.emit('jobProgress', job);
            const result = await this.performExport(transformedData, job.config, filePath);
            job.status = 'completed';
            job.endTime = new Date();
            job.progress = 100;
            job.result = result;
            this.logger.info(`Export job completed: ${jobId}`);
            this.emit('jobCompleted', job);
        }
        catch (error) {
            job.status = 'failed';
            job.endTime = new Date();
            job.error = error instanceof Error ? error.message : String(error);
            this.logger.error(`Export job failed: ${jobId}`, error);
            this.emit('jobFailed', job);
        }
        finally {
            this.activeJobs--;
        }
    }
    validateConfig(config) {
        const errors = [];
        if (!config.format) {
            errors.push('Export format is required');
        }
        const handler = this.formatHandlers.get(config.format);
        if (!handler) {
            errors.push(`Unsupported export format: ${config.format}`);
        }
        else {
            const handlerErrors = handler.validate(config);
            errors.push(...handlerErrors);
        }
        return errors;
    }
    async applyTransformations(data, config) {
        let transformedData = [...data];
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
    transformDates(data, format) {
        return data.map(row => {
            const transformedRow = { ...row };
            for (const [key, value] of Object.entries(transformedRow)) {
                if (value instanceof Date) {
                    transformedRow[key] = this.formatDate(value, format);
                }
                else if (typeof value === 'string' && this.isDateString(value)) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        transformedRow[key] = this.formatDate(date, format);
                    }
                }
            }
            return transformedRow;
        });
    }
    transformNumbers(data, format) {
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
    transformCurrency(data, format) {
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
    formatDate(date, format) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return format
            .replace('YYYY', year.toString())
            .replace('MM', month)
            .replace('DD', day);
    }
    formatNumber(num, format) {
        const fixed = num.toFixed(format.decimals);
        const [integer, decimal] = fixed.split('.');
        const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSeparator);
        return decimal ?
            `${formattedInteger}${format.decimalSeparator}${decimal}` :
            formattedInteger;
    }
    formatCurrency(amount, format) {
        const formatted = amount.toFixed(format.decimals);
        return format.position === 'before' ?
            `${format.symbol}${formatted}` :
            `${formatted}${format.symbol}`;
    }
    isDateString(value) {
        return /^\d{4}-\d{2}-\d{2}/.test(value) ||
            /^\d{2}\/\d{2}\/\d{4}/.test(value) ||
            !isNaN(Date.parse(value));
    }
    async performExport(data, config, filePath) {
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
    generateFilePath(config) {
        if (config.filePath) {
            return config.filePath;
        }
        const fileName = config.fileName ||
            `export_${Date.now()}.${this.getFileExtension(config.format)}`;
        return path.join(this.outputDirectory, fileName);
    }
    getFileExtension(format) {
        const extensions = {
            'csv': 'csv',
            'json': 'json',
            'xml': 'xml',
            'html': 'html',
            'excel': 'xlsx',
            'pdf': 'pdf'
        };
        return extensions[format] || format;
    }
    generateJobId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }
    listJobs(status) {
        const allJobs = Array.from(this.jobs.values());
        if (status) {
            return allJobs.filter(job => job.status === status);
        }
        return allJobs;
    }
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job || job.status === 'completed' || job.status === 'failed') {
            return false;
        }
        job.status = 'cancelled';
        job.endTime = new Date();
        this.emit('jobCancelled', job);
        return true;
    }
    clearCompletedJobs() {
        const completedJobs = Array.from(this.jobs.entries())
            .filter(([_, job]) => job.status === 'completed' || job.status === 'failed')
            .map(([id, _]) => id);
        completedJobs.forEach(id => this.jobs.delete(id));
        return completedJobs.length;
    }
    getSupportedFormats() {
        return Array.from(this.formatHandlers.keys());
    }
}
exports.DataExporter = DataExporter;
class CSVFormatHandler {
    format = 'csv';
    validate(config) {
        return [];
    }
    async export(data, config, filePath) {
        const options = config.options;
        const delimiter = options.delimiter || ',';
        const quoteChar = options.quoteChar || '"';
        const lineEnding = options.lineEnding || '\n';
        try {
            let csvContent = '';
            if (data.length > 0) {
                if (options.includeHeaders !== false) {
                    const headers = Object.keys(data[0]);
                    csvContent += headers.map(h => `${quoteChar}${h}${quoteChar}`).join(delimiter) + lineEnding;
                }
                for (const row of data) {
                    const values = Object.values(row).map(value => {
                        const stringValue = String(value || '');
                        return `${quoteChar}${stringValue.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar)}${quoteChar}`;
                    });
                    csvContent += values.join(delimiter) + lineEnding;
                }
            }
            await fs_1.promises.writeFile(filePath, csvContent, { encoding: options.encoding || 'utf8' });
            const stats = await fs_1.promises.stat(filePath);
            return {
                success: true,
                filePath,
                fileSize: stats.size,
                recordCount: data.length,
                duration: 0,
                format: this.format
            };
        }
        catch (error) {
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
class JSONFormatHandler {
    format = 'json';
    validate(config) {
        return [];
    }
    async export(data, config, filePath) {
        try {
            const jsonContent = config.options.prettyPrint
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data);
            await fs_1.promises.writeFile(filePath, jsonContent, { encoding: config.options.encoding || 'utf8' });
            const stats = await fs_1.promises.stat(filePath);
            return {
                success: true,
                filePath,
                fileSize: stats.size,
                recordCount: data.length,
                duration: 0,
                format: this.format
            };
        }
        catch (error) {
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
class XMLFormatHandler {
    format = 'xml';
    validate(config) {
        return [];
    }
    async export(data, config, filePath) {
        try {
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
            for (const row of data) {
                xmlContent += '  <record>\n';
                for (const [key, value] of Object.entries(row)) {
                    const escapedValue = String(value || '').replace(/[<>&'"]/g, (char) => {
                        const entities = {
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
            await fs_1.promises.writeFile(filePath, xmlContent, { encoding: config.options.encoding || 'utf8' });
            const stats = await fs_1.promises.stat(filePath);
            return {
                success: true,
                filePath,
                fileSize: stats.size,
                recordCount: data.length,
                duration: 0,
                format: this.format
            };
        }
        catch (error) {
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
class HTMLFormatHandler {
    format = 'html';
    validate(config) {
        return [];
    }
    async export(data, config, filePath) {
        try {
            const responsive = config.options.responsive !== false;
            const includeCSS = config.options.includeCSS !== false;
            let htmlContent = '<!DOCTYPE html>\n<html>\n<head>\n<title>Data Export</title>\n';
            if (includeCSS) {
                htmlContent += this.getDefaultCSS(responsive, config.options.customCSS);
            }
            htmlContent += '</head>\n<body>\n<table>\n';
            if (data.length > 0) {
                htmlContent += '<thead><tr>';
                const headers = Object.keys(data[0]);
                for (const header of headers) {
                    htmlContent += `<th>${this.escapeHtml(header)}</th>`;
                }
                htmlContent += '</tr></thead>\n';
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
            await fs_1.promises.writeFile(filePath, htmlContent, { encoding: config.options.encoding || 'utf8' });
            const stats = await fs_1.promises.stat(filePath);
            return {
                success: true,
                filePath,
                fileSize: stats.size,
                recordCount: data.length,
                duration: 0,
                format: this.format
            };
        }
        catch (error) {
            return {
                success: false,
                recordCount: data.length,
                duration: 0,
                format: this.format,
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    getDefaultCSS(responsive, customCSS) {
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
            css += `${customCSS  }\n`;
        }
        css += '</style>\n';
        return css;
    }
    escapeHtml(text) {
        return text.replace(/[<>&'"]/g, (char) => {
            const entities = {
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
class ExcelFormatHandler {
    format = 'excel';
    validate(config) {
        return [];
    }
    async export(data, config, filePath) {
        throw new Error('Excel export requires additional dependencies (exceljs)');
    }
}
class PDFFormatHandler {
    format = 'pdf';
    validate(config) {
        return [];
    }
    async export(data, config, filePath) {
        throw new Error('PDF export requires additional dependencies (pdfkit)');
    }
}
//# sourceMappingURL=DataExporter.js.map