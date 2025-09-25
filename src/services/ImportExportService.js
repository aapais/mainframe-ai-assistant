'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ImportExportService = void 0;
const tslib_1 = require('tslib');
const promises_1 = tslib_1.__importDefault(require('fs/promises'));
const path_1 = tslib_1.__importDefault(require('path'));
const sync_1 = require('csv-parse/sync');
const sync_2 = require('csv-stringify/sync');
const xml2js_1 = require('xml2js');
const services_1 = require('../types/services');
class ImportExportService {
  kbService;
  validationService;
  supportedFormats = ['json', 'csv', 'xml'];
  constructor(kbService, validationService) {
    this.kbService = kbService;
    this.validationService = validationService;
  }
  async exportToJSON(options = {}) {
    try {
      const entries = await this.fetchEntriesForExport(options);
      const exportData = {
        version: '1.0',
        metadata: {
          exported_at: new Date().toISOString(),
          exported_by: 'KB Assistant',
          total_entries: entries.length,
          format: 'json',
          source_system: 'Mainframe KB Assistant',
        },
        entries: this.prepareEntriesForExport(entries, options),
      };
      if (options.includeMetrics) {
        exportData.statistics = await this.generateExportStatistics(entries);
      }
      return JSON.stringify(exportData, null, options.format === 'compact' ? 0 : 2);
    } catch (error) {
      throw new services_1.ServiceError(
        `JSON export failed: ${error.message}`,
        'EXPORT_FAILED',
        500,
        { options, originalError: error }
      );
    }
  }
  async importFromJSON(data, options = {}) {
    const result = {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      summary: {
        totalProcessed: 0,
        processingTime: 0,
        validationErrors: 0,
        duplicates: 0,
      },
    };
    const startTime = Date.now();
    try {
      const validation = this.validateFormat(data, 'json');
      if (!validation.valid) {
        result.errors.push({
          line: 0,
          field: 'format',
          message: 'Invalid JSON format',
          code: 'INVALID_FORMAT',
        });
        return result;
      }
      const importData = JSON.parse(data);
      if (!importData.entries || !Array.isArray(importData.entries)) {
        result.errors.push({
          line: 0,
          field: 'entries',
          message: 'Missing or invalid entries array',
          code: 'INVALID_STRUCTURE',
        });
        return result;
      }
      result.summary.totalProcessed = importData.entries.length;
      if (importData.version && importData.version !== '1.0') {
        result.warnings.push({
          line: 0,
          field: 'version',
          message: `Unsupported version: ${importData.version}`,
          code: 'VERSION_MISMATCH',
          suggestion: 'Data may not import correctly',
        });
      }
      const batchSize = options.batchSize || 100;
      const entries = importData.entries;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, i, options);
        result.imported += batchResult.imported;
        result.updated += batchResult.updated;
        result.skipped += batchResult.skipped;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.summary.validationErrors += batchResult.validationErrors;
        result.summary.duplicates += batchResult.duplicates;
      }
      result.success = result.errors.length === 0 || result.imported > 0;
      result.summary.processingTime = Date.now() - startTime;
      return result;
    } catch (error) {
      result.errors.push({
        line: 0,
        field: 'general',
        message: `Import failed: ${error.message}`,
        code: 'IMPORT_FAILED',
      });
      result.summary.processingTime = Date.now() - startTime;
      return result;
    }
  }
  async exportToCSV(options = {}) {
    try {
      const entries = await this.fetchEntriesForExport(options);
      const csvData = this.convertEntriesToCSV(entries, options);
      return (0, sync_2.stringify)(csvData, {
        header: true,
        columns: this.getCSVColumns(options),
        quoted: true,
      });
    } catch (error) {
      throw new services_1.ServiceError(
        `CSV export failed: ${error.message}`,
        'EXPORT_FAILED',
        500,
        { options, originalError: error }
      );
    }
  }
  async importFromCSV(data, options = {}) {
    const result = {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      summary: {
        totalProcessed: 0,
        processingTime: 0,
        validationErrors: 0,
        duplicates: 0,
      },
    };
    const startTime = Date.now();
    try {
      const records = (0, sync_1.parse)(data, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: ',',
        quote: '"',
        escape: '"',
      });
      result.summary.totalProcessed = records.length;
      const entries = records
        .map((record, index) => {
          try {
            return this.convertCSVRecordToEntry(record, index);
          } catch (error) {
            result.errors.push({
              line: index + 2,
              field: 'conversion',
              message: `Failed to convert record: ${error.message}`,
              code: 'CONVERSION_FAILED',
            });
            return null;
          }
        })
        .filter(Boolean);
      const batchSize = options.batchSize || 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, i, options);
        result.imported += batchResult.imported;
        result.updated += batchResult.updated;
        result.skipped += batchResult.skipped;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.summary.validationErrors += batchResult.validationErrors;
        result.summary.duplicates += batchResult.duplicates;
      }
      result.success = result.errors.length === 0 || result.imported > 0;
      result.summary.processingTime = Date.now() - startTime;
      return result;
    } catch (error) {
      result.errors.push({
        line: 0,
        field: 'parsing',
        message: `CSV parsing failed: ${error.message}`,
        code: 'PARSE_FAILED',
      });
      result.summary.processingTime = Date.now() - startTime;
      return result;
    }
  }
  async exportToXML(options = {}) {
    try {
      const entries = await this.fetchEntriesForExport(options);
      const xmlData = {
        knowledgebase: {
          $: {
            version: '1.0',
            exported_at: new Date().toISOString(),
          },
          metadata: {
            total_entries: entries.length,
            format: 'xml',
            source_system: 'Mainframe KB Assistant',
          },
          entries: {
            entry: entries.map(entry => ({
              $: { id: entry.id },
              title: entry.title,
              problem: entry.problem,
              solution: entry.solution,
              category: entry.category,
              tags: entry.tags.length > 0 ? { tag: entry.tags } : undefined,
              metadata: {
                created_at: entry.created_at.toISOString(),
                updated_at: entry.updated_at.toISOString(),
                created_by: entry.created_by,
                usage_count: entry.usage_count,
                success_count: entry.success_count,
                failure_count: entry.failure_count,
                version: entry.version,
              },
            })),
          },
        },
      };
      const builder = new xml2js_1.Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: options.format !== 'compact' },
      });
      return builder.buildObject(xmlData);
    } catch (error) {
      throw new services_1.ServiceError(
        `XML export failed: ${error.message}`,
        'EXPORT_FAILED',
        500,
        { options, originalError: error }
      );
    }
  }
  async importFromXML(data, options = {}) {
    const result = {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      summary: {
        totalProcessed: 0,
        processingTime: 0,
        validationErrors: 0,
        duplicates: 0,
      },
    };
    const startTime = Date.now();
    try {
      const parsedData = await new Promise((resolve, reject) => {
        (0, xml2js_1.parseString)(data, { explicitArray: false }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      if (!parsedData.knowledgebase?.entries?.entry) {
        result.errors.push({
          line: 0,
          field: 'structure',
          message: 'Invalid XML structure: missing knowledgebase/entries/entry',
          code: 'INVALID_STRUCTURE',
        });
        return result;
      }
      const xmlEntries = Array.isArray(parsedData.knowledgebase.entries.entry)
        ? parsedData.knowledgebase.entries.entry
        : [parsedData.knowledgebase.entries.entry];
      result.summary.totalProcessed = xmlEntries.length;
      const entries = xmlEntries
        .map((xmlEntry, index) => {
          try {
            return this.convertXMLEntryToEntry(xmlEntry, index);
          } catch (error) {
            result.errors.push({
              line: index + 1,
              field: 'conversion',
              message: `Failed to convert XML entry: ${error.message}`,
              code: 'CONVERSION_FAILED',
            });
            return null;
          }
        })
        .filter(Boolean);
      const batchSize = options.batchSize || 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, i, options);
        result.imported += batchResult.imported;
        result.updated += batchResult.updated;
        result.skipped += batchResult.skipped;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);
        result.summary.validationErrors += batchResult.validationErrors;
        result.summary.duplicates += batchResult.duplicates;
      }
      result.success = result.errors.length === 0 || result.imported > 0;
      result.summary.processingTime = Date.now() - startTime;
      return result;
    } catch (error) {
      result.errors.push({
        line: 0,
        field: 'parsing',
        message: `XML parsing failed: ${error.message}`,
        code: 'PARSE_FAILED',
      });
      result.summary.processingTime = Date.now() - startTime;
      return result;
    }
  }
  async backup(backupPath) {
    try {
      const backupDir = path_1.default.dirname(backupPath);
      await promises_1.default.mkdir(backupDir, { recursive: true });
      const exportOptions = {
        includeMetrics: true,
        includeHistory: true,
        format: 'full',
      };
      const backupData = await this.exportToJSON(exportOptions);
      const backup = {
        backup_metadata: {
          created_at: new Date().toISOString(),
          backup_type: 'full',
          version: '1.0',
          source: 'Mainframe KB Assistant',
        },
        data: JSON.parse(backupData),
      };
      await promises_1.default.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');
      console.info(`Backup created successfully: ${backupPath}`);
    } catch (error) {
      throw new services_1.ServiceError(`Backup failed: ${error.message}`, 'BACKUP_FAILED', 500, {
        backupPath,
        originalError: error,
      });
    }
  }
  async restore(backupPath) {
    const result = {
      success: false,
      restored: 0,
      errors: [],
      metadata: {
        backupVersion: 'unknown',
        restoreTime: new Date(),
        dataIntegrity: false,
      },
    };
    try {
      const backupContent = await promises_1.default.readFile(backupPath, 'utf8');
      const backup = JSON.parse(backupContent);
      if (!backup.data || !backup.backup_metadata) {
        result.errors.push({
          table: 'backup',
          message: 'Invalid backup format',
          recoverable: false,
        });
        return result;
      }
      result.metadata.backupVersion = backup.backup_metadata.version || 'unknown';
      const importOptions = {
        overwrite: true,
        batchSize: 50,
      };
      const importResult = await this.importFromJSON(JSON.stringify(backup.data), importOptions);
      result.success = importResult.success;
      result.restored = importResult.imported + importResult.updated;
      result.metadata.dataIntegrity = importResult.errors.length === 0;
      importResult.errors.forEach(importError => {
        result.errors.push({
          table: 'kb_entries',
          message: importError.message,
          details: { line: importError.line, field: importError.field },
          recoverable: true,
        });
      });
      console.info(`Restore completed: ${result.restored} entries restored`);
      return result;
    } catch (error) {
      result.errors.push({
        table: 'system',
        message: `Restore failed: ${error.message}`,
        details: { backupPath },
        recoverable: false,
      });
      return result;
    }
  }
  validateFormat(data, format) {
    const errors = [];
    const warnings = [];
    try {
      switch (format) {
        case 'json':
          JSON.parse(data);
          break;
        case 'csv':
          (0, sync_1.parse)(data, { columns: true, skip_empty_lines: true });
          break;
        case 'xml':
          if (!data.trim().startsWith('<?xml') && !data.trim().startsWith('<')) {
            throw new Error('Invalid XML format');
          }
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      errors.push({
        field: 'format',
        code: 'INVALID_FORMAT',
        message: error.message,
        severity: 'error',
      });
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  getFormats() {
    return [...this.supportedFormats];
  }
  async fetchEntriesForExport(options) {
    const listOptions = {
      limit: 10000,
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
    const result = await this.kbService.list(listOptions);
    return result.data;
  }
  prepareEntriesForExport(entries, options) {
    let exportEntries = [...entries];
    switch (options.format) {
      case 'minimal':
        exportEntries = exportEntries.map(entry => ({
          ...entry,
          usage_count: undefined,
          success_count: undefined,
          failure_count: undefined,
          version: undefined,
        }));
        break;
      case 'compact':
        break;
      case 'full':
      default:
        break;
    }
    return exportEntries;
  }
  async generateExportStatistics(entries) {
    const categoryStats = {};
    const tagStats = {};
    let totalUsage = 0;
    let totalSuccess = 0;
    let totalFailure = 0;
    entries.forEach(entry => {
      categoryStats[entry.category] = (categoryStats[entry.category] || 0) + 1;
      entry.tags.forEach(tag => {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      });
      totalUsage += entry.usage_count || 0;
      totalSuccess += entry.success_count || 0;
      totalFailure += entry.failure_count || 0;
    });
    return {
      categories: categoryStats,
      tags: tagStats,
      usage_summary: {
        total_usage: totalUsage,
        total_success: totalSuccess,
        total_failure: totalFailure,
        success_rate:
          totalSuccess + totalFailure > 0 ? totalSuccess / (totalSuccess + totalFailure) : 0,
      },
    };
  }
  convertEntriesToCSV(entries, options) {
    return entries.map(entry => {
      const csvRecord = {
        id: entry.id,
        title: entry.title,
        problem: entry.problem,
        solution: entry.solution,
        category: entry.category,
        tags: entry.tags.join(';'),
        created_at: entry.created_at.toISOString(),
        updated_at: entry.updated_at.toISOString(),
        created_by: entry.created_by,
      };
      if (options.includeMetrics) {
        csvRecord.usage_count = entry.usage_count;
        csvRecord.success_count = entry.success_count;
        csvRecord.failure_count = entry.failure_count;
        csvRecord.version = entry.version;
      }
      return csvRecord;
    });
  }
  getCSVColumns(options) {
    const baseColumns = [
      'id',
      'title',
      'problem',
      'solution',
      'category',
      'tags',
      'created_at',
      'updated_at',
      'created_by',
    ];
    if (options.includeMetrics) {
      baseColumns.push('usage_count', 'success_count', 'failure_count', 'version');
    }
    return baseColumns;
  }
  convertCSVRecordToEntry(record, lineIndex) {
    if (!record.title || !record.problem || !record.solution || !record.category) {
      throw new Error('Missing required fields (title, problem, solution, category)');
    }
    const entry = {
      title: String(record.title).trim(),
      problem: String(record.problem).trim(),
      solution: String(record.solution).trim(),
      category: String(record.category).trim(),
      tags: record.tags
        ? String(record.tags)
            .split(';')
            .map(tag => tag.trim())
            .filter(Boolean)
        : [],
      created_by: record.created_by ? String(record.created_by).trim() : 'imported',
    };
    return entry;
  }
  convertXMLEntryToEntry(xmlEntry, index) {
    if (!xmlEntry.title || !xmlEntry.problem || !xmlEntry.solution || !xmlEntry.category) {
      throw new Error('Missing required XML elements');
    }
    const entry = {
      title: String(xmlEntry.title).trim(),
      problem: String(xmlEntry.problem).trim(),
      solution: String(xmlEntry.solution).trim(),
      category: String(xmlEntry.category).trim(),
      tags: [],
      created_by: xmlEntry.metadata?.created_by
        ? String(xmlEntry.metadata.created_by).trim()
        : 'imported',
    };
    if (xmlEntry.tags) {
      if (Array.isArray(xmlEntry.tags.tag)) {
        entry.tags = xmlEntry.tags.tag.map(tag => String(tag).trim());
      } else if (xmlEntry.tags.tag) {
        entry.tags = [String(xmlEntry.tags.tag).trim()];
      }
    }
    return entry;
  }
  async processBatch(entries, startIndex, options) {
    const batchResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      validationErrors: 0,
      duplicates: 0,
    };
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const lineNumber = startIndex + i + 1;
      try {
        if (this.validationService) {
          const validation = this.validationService.validateEntry(entry);
          if (!validation.valid) {
            batchResult.validationErrors++;
            validation.errors.forEach(error => {
              batchResult.errors.push({
                line: lineNumber,
                field: error.field,
                message: error.message,
                value: error.value,
                code: error.code,
              });
            });
            if (options.validateOnly || validation.errors.some(e => e.severity === 'error')) {
              batchResult.skipped++;
              continue;
            }
          }
          validation.warnings.forEach(warning => {
            batchResult.warnings.push({
              line: lineNumber,
              field: warning.field,
              message: warning.message,
              suggestion: warning.suggestion,
              code: warning.code,
            });
          });
        }
        if (options.validateOnly) {
          continue;
        }
        const existing = await this.findExistingEntry(entry);
        if (existing) {
          batchResult.duplicates++;
          if (options.skipDuplicates) {
            batchResult.skipped++;
            continue;
          }
          if (options.updateExisting) {
            const success = await this.kbService.update(existing.id, {
              title: entry.title,
              problem: entry.problem,
              solution: entry.solution,
              category: entry.category,
              tags: entry.tags,
              updated_by: 'import',
            });
            if (success) {
              batchResult.updated++;
            } else {
              batchResult.errors.push({
                line: lineNumber,
                field: 'update',
                message: 'Failed to update existing entry',
                code: 'UPDATE_FAILED',
              });
            }
            continue;
          }
          if (options.onConflict === 'skip') {
            batchResult.skipped++;
            continue;
          } else if (options.onConflict === 'error') {
            batchResult.errors.push({
              line: lineNumber,
              field: 'duplicate',
              message: `Duplicate entry found: ${entry.title}`,
              code: 'DUPLICATE_ENTRY',
            });
            continue;
          }
        }
        const id = await this.kbService.create(entry);
        if (id) {
          batchResult.imported++;
        } else {
          batchResult.errors.push({
            line: lineNumber,
            field: 'create',
            message: 'Failed to create entry',
            code: 'CREATE_FAILED',
          });
        }
      } catch (error) {
        batchResult.errors.push({
          line: lineNumber,
          field: 'processing',
          message: `Processing failed: ${error.message}`,
          code: 'PROCESSING_FAILED',
        });
      }
    }
    return batchResult;
  }
  async findExistingEntry(entry) {
    try {
      const results = await this.kbService.search(entry.title, {
        limit: 5,
        threshold: 0.9,
      });
      const exactMatch = results.find(
        result => result.entry.title.toLowerCase() === entry.title.toLowerCase()
      );
      return exactMatch?.entry || null;
    } catch (error) {
      console.warn('Failed to check for duplicates:', error);
      return null;
    }
  }
}
exports.ImportExportService = ImportExportService;
exports.default = ImportExportService;
//# sourceMappingURL=ImportExportService.js.map
