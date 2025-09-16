/**
 * ImportExportService - Data portability and backup functionality
 * Production-ready import/export with validation, format detection, and error handling
 */

import fs from 'fs/promises';
import path from 'path';
import { parse as parseCSV } from 'csv-parse/sync';
import { stringify as stringifyCSV } from 'csv-stringify/sync';
import { parseString as parseXML, Builder as XMLBuilder } from 'xml2js';

import {
  IImportExportService,
  IKnowledgeBaseService,
  IValidationService,
  ExportOptions,
  ImportOptions,
  ImportResult,
  RestoreResult,
  ValidationResult,
  KBEntry,
  KBEntryInput,
  ImportError,
  ImportWarning,
  RestoreError,
  ServiceError,
  ValidationError
} from '../types/services';

interface ExportData {
  version: string;
  metadata: {
    exported_at: string;
    exported_by?: string;
    total_entries: number;
    format: string;
    source_system: string;
  };
  entries: KBEntry[];
  statistics?: {
    categories: Record<string, number>;
    tags: Record<string, number>;
    usage_summary: any;
  };
}

interface ImportData {
  version?: string;
  metadata?: any;
  entries: any[];
}

/**
 * Comprehensive Import/Export Service
 * Supports multiple formats with validation and error recovery
 */
export class ImportExportService implements IImportExportService {
  private supportedFormats = ['json', 'csv', 'xml'];

  constructor(
    private kbService: IKnowledgeBaseService,
    private validationService?: IValidationService
  ) {}

  /**
   * Export to JSON format
   */
  async exportToJSON(options: ExportOptions = {}): Promise<string> {
    try {
      const entries = await this.fetchEntriesForExport(options);
      
      const exportData: ExportData = {
        version: '1.0',
        metadata: {
          exported_at: new Date().toISOString(),
          exported_by: 'KB Assistant',
          total_entries: entries.length,
          format: 'json',
          source_system: 'Mainframe KB Assistant'
        },
        entries: this.prepareEntriesForExport(entries, options)
      };

      // Add statistics if requested
      if (options.includeMetrics) {
        exportData.statistics = await this.generateExportStatistics(entries);
      }

      return JSON.stringify(exportData, null, options.format === 'compact' ? 0 : 2);
    } catch (error) {
      throw new ServiceError(
        `JSON export failed: ${error.message}`,
        'EXPORT_FAILED',
        500,
        { options, originalError: error }
      );
    }
  }

  /**
   * Import from JSON format
   */
  async importFromJSON(data: string, options: ImportOptions = {}): Promise<ImportResult> {
    const result: ImportResult = {
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
        duplicates: 0
      }
    };

    const startTime = Date.now();

    try {
      // Validate JSON format
      const validation = this.validateFormat(data, 'json');
      if (!validation.valid) {
        result.errors.push({
          line: 0,
          field: 'format',
          message: 'Invalid JSON format',
          code: 'INVALID_FORMAT'
        });
        return result;
      }

      const importData: ImportData = JSON.parse(data);
      
      // Validate import structure
      if (!importData.entries || !Array.isArray(importData.entries)) {
        result.errors.push({
          line: 0,
          field: 'entries',
          message: 'Missing or invalid entries array',
          code: 'INVALID_STRUCTURE'
        });
        return result;
      }

      result.summary.totalProcessed = importData.entries.length;

      // Check version compatibility
      if (importData.version && importData.version !== '1.0') {
        result.warnings.push({
          line: 0,
          field: 'version',
          message: `Unsupported version: ${importData.version}`,
          code: 'VERSION_MISMATCH',
          suggestion: 'Data may not import correctly'
        });
      }

      // Process entries in batches
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
        code: 'IMPORT_FAILED'
      });
      result.summary.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(options: ExportOptions = {}): Promise<string> {
    try {
      const entries = await this.fetchEntriesForExport(options);
      const csvData = this.convertEntriesToCSV(entries, options);
      
      return stringifyCSV(csvData, {
        header: true,
        columns: this.getCSVColumns(options),
        quoted: true
      });
    } catch (error) {
      throw new ServiceError(
        `CSV export failed: ${error.message}`,
        'EXPORT_FAILED',
        500,
        { options, originalError: error }
      );
    }
  }

  /**
   * Import from CSV format
   */
  async importFromCSV(data: string, options: ImportOptions = {}): Promise<ImportResult> {
    const result: ImportResult = {
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
        duplicates: 0
      }
    };

    const startTime = Date.now();

    try {
      // Parse CSV
      const records = parseCSV(data, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: ',',
        quote: '"',
        escape: '"'
      });

      result.summary.totalProcessed = records.length;

      // Convert CSV records to KB entries
      const entries = records.map((record, index) => {
        try {
          return this.convertCSVRecordToEntry(record, index);
        } catch (error) {
          result.errors.push({
            line: index + 2, // +2 for header and 0-based index
            field: 'conversion',
            message: `Failed to convert record: ${error.message}`,
            code: 'CONVERSION_FAILED'
          });
          return null;
        }
      }).filter(Boolean) as KBEntryInput[];

      // Process entries in batches
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
        code: 'PARSE_FAILED'
      });
      result.summary.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Export to XML format
   */
  async exportToXML(options: ExportOptions = {}): Promise<string> {
    try {
      const entries = await this.fetchEntriesForExport(options);
      
      const xmlData = {
        knowledgebase: {
          $: {
            version: '1.0',
            exported_at: new Date().toISOString()
          },
          metadata: {
            total_entries: entries.length,
            format: 'xml',
            source_system: 'Mainframe KB Assistant'
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
                version: entry.version
              }
            }))
          }
        }
      };

      const builder = new XMLBuilder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: options.format !== 'compact' }
      });

      return builder.buildObject(xmlData);
    } catch (error) {
      throw new ServiceError(
        `XML export failed: ${error.message}`,
        'EXPORT_FAILED',
        500,
        { options, originalError: error }
      );
    }
  }

  /**
   * Import from XML format
   */
  async importFromXML(data: string, options: ImportOptions = {}): Promise<ImportResult> {
    const result: ImportResult = {
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
        duplicates: 0
      }
    };

    const startTime = Date.now();

    try {
      // Parse XML
      const parsedData = await new Promise<any>((resolve, reject) => {
        parseXML(data, { explicitArray: false }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      if (!parsedData.knowledgebase?.entries?.entry) {
        result.errors.push({
          line: 0,
          field: 'structure',
          message: 'Invalid XML structure: missing knowledgebase/entries/entry',
          code: 'INVALID_STRUCTURE'
        });
        return result;
      }

      // Normalize entries (handle single entry vs array)
      const xmlEntries = Array.isArray(parsedData.knowledgebase.entries.entry)
        ? parsedData.knowledgebase.entries.entry
        : [parsedData.knowledgebase.entries.entry];

      result.summary.totalProcessed = xmlEntries.length;

      // Convert XML entries to KB entries
      const entries = xmlEntries.map((xmlEntry, index) => {
        try {
          return this.convertXMLEntryToEntry(xmlEntry, index);
        } catch (error) {
          result.errors.push({
            line: index + 1,
            field: 'conversion',
            message: `Failed to convert XML entry: ${error.message}`,
            code: 'CONVERSION_FAILED'
          });
          return null;
        }
      }).filter(Boolean) as KBEntryInput[];

      // Process entries in batches
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
        code: 'PARSE_FAILED'
      });
      result.summary.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Create backup of the knowledge base
   */
  async backup(backupPath: string): Promise<void> {
    try {
      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      await fs.mkdir(backupDir, { recursive: true });

      // Create comprehensive backup
      const exportOptions: ExportOptions = {
        includeMetrics: true,
        includeHistory: true,
        format: 'full'
      };

      const backupData = await this.exportToJSON(exportOptions);

      // Add backup metadata
      const backup = {
        backup_metadata: {
          created_at: new Date().toISOString(),
          backup_type: 'full',
          version: '1.0',
          source: 'Mainframe KB Assistant'
        },
        data: JSON.parse(backupData)
      };

      // Write backup file
      await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');

      console.info(`Backup created successfully: ${backupPath}`);
    } catch (error) {
      throw new ServiceError(
        `Backup failed: ${error.message}`,
        'BACKUP_FAILED',
        500,
        { backupPath, originalError: error }
      );
    }
  }

  /**
   * Restore from backup
   */
  async restore(backupPath: string): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      restored: 0,
      errors: [],
      metadata: {
        backupVersion: 'unknown',
        restoreTime: new Date(),
        dataIntegrity: false
      }
    };

    try {
      // Read backup file
      const backupContent = await fs.readFile(backupPath, 'utf8');
      const backup = JSON.parse(backupContent);

      // Validate backup structure
      if (!backup.data || !backup.backup_metadata) {
        result.errors.push({
          table: 'backup',
          message: 'Invalid backup format',
          recoverable: false
        });
        return result;
      }

      result.metadata.backupVersion = backup.backup_metadata.version || 'unknown';

      // Import the backup data
      const importOptions: ImportOptions = {
        overwrite: true,
        batchSize: 50
      };

      const importResult = await this.importFromJSON(
        JSON.stringify(backup.data),
        importOptions
      );

      result.success = importResult.success;
      result.restored = importResult.imported + importResult.updated;
      result.metadata.dataIntegrity = importResult.errors.length === 0;

      // Convert import errors to restore errors
      importResult.errors.forEach(importError => {
        result.errors.push({
          table: 'kb_entries',
          message: importError.message,
          details: { line: importError.line, field: importError.field },
          recoverable: true
        });
      });

      console.info(`Restore completed: ${result.restored} entries restored`);
      return result;
    } catch (error) {
      result.errors.push({
        table: 'system',
        message: `Restore failed: ${error.message}`,
        details: { backupPath },
        recoverable: false
      });
      return result;
    }
  }

  /**
   * Validate data format
   */
  validateFormat(data: string, format: 'json' | 'csv' | 'xml'): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      switch (format) {
        case 'json':
          JSON.parse(data);
          break;
          
        case 'csv':
          parseCSV(data, { columns: true, skip_empty_lines: true });
          break;
          
        case 'xml':
          // Basic XML validation (synchronous)
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
        severity: 'error'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get supported formats
   */
  getFormats(): string[] {
    return [...this.supportedFormats];
  }

  // =========================
  // Private Methods
  // =========================

  private async fetchEntriesForExport(options: ExportOptions): Promise<KBEntry[]> {
    const listOptions: any = {
      limit: 10000 // Large limit for export
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

    const result = await this.kbService.list(listOptions);
    return result.data;
  }

  private prepareEntriesForExport(entries: KBEntry[], options: ExportOptions): KBEntry[] {
    let exportEntries = [...entries];

    // Apply format-specific transformations
    switch (options.format) {
      case 'minimal':
        exportEntries = exportEntries.map(entry => ({
          ...entry,
          usage_count: undefined,
          success_count: undefined,
          failure_count: undefined,
          version: undefined
        } as any));
        break;
        
      case 'compact':
        // No changes for compact (just affects JSON formatting)
        break;
        
      case 'full':
      default:
        // Include all fields
        break;
    }

    return exportEntries;
  }

  private async generateExportStatistics(entries: KBEntry[]): Promise<any> {
    const categoryStats: Record<string, number> = {};
    const tagStats: Record<string, number> = {};
    let totalUsage = 0;
    let totalSuccess = 0;
    let totalFailure = 0;

    entries.forEach(entry => {
      // Category statistics
      categoryStats[entry.category] = (categoryStats[entry.category] || 0) + 1;

      // Tag statistics
      entry.tags.forEach(tag => {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      });

      // Usage statistics
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
        success_rate: totalSuccess + totalFailure > 0 ? totalSuccess / (totalSuccess + totalFailure) : 0
      }
    };
  }

  private convertEntriesToCSV(entries: KBEntry[], options: ExportOptions): any[] {
    return entries.map(entry => {
      const csvRecord: any = {
        id: entry.id,
        title: entry.title,
        problem: entry.problem,
        solution: entry.solution,
        category: entry.category,
        tags: entry.tags.join(';'),
        created_at: entry.created_at.toISOString(),
        updated_at: entry.updated_at.toISOString(),
        created_by: entry.created_by
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

  private getCSVColumns(options: ExportOptions): string[] {
    const baseColumns = [
      'id', 'title', 'problem', 'solution', 'category', 'tags',
      'created_at', 'updated_at', 'created_by'
    ];

    if (options.includeMetrics) {
      baseColumns.push('usage_count', 'success_count', 'failure_count', 'version');
    }

    return baseColumns;
  }

  private convertCSVRecordToEntry(record: any, lineIndex: number): KBEntryInput {
    // Required fields validation
    if (!record.title || !record.problem || !record.solution || !record.category) {
      throw new Error('Missing required fields (title, problem, solution, category)');
    }

    const entry: KBEntryInput = {
      title: String(record.title).trim(),
      problem: String(record.problem).trim(),
      solution: String(record.solution).trim(),
      category: String(record.category).trim() as any,
      tags: record.tags ? String(record.tags).split(';').map(tag => tag.trim()).filter(Boolean) : [],
      created_by: record.created_by ? String(record.created_by).trim() : 'imported'
    };

    return entry;
  }

  private convertXMLEntryToEntry(xmlEntry: any, index: number): KBEntryInput {
    if (!xmlEntry.title || !xmlEntry.problem || !xmlEntry.solution || !xmlEntry.category) {
      throw new Error('Missing required XML elements');
    }

    const entry: KBEntryInput = {
      title: String(xmlEntry.title).trim(),
      problem: String(xmlEntry.problem).trim(),
      solution: String(xmlEntry.solution).trim(),
      category: String(xmlEntry.category).trim() as any,
      tags: [],
      created_by: xmlEntry.metadata?.created_by ? String(xmlEntry.metadata.created_by).trim() : 'imported'
    };

    // Handle tags
    if (xmlEntry.tags) {
      if (Array.isArray(xmlEntry.tags.tag)) {
        entry.tags = xmlEntry.tags.tag.map(tag => String(tag).trim());
      } else if (xmlEntry.tags.tag) {
        entry.tags = [String(xmlEntry.tags.tag).trim()];
      }
    }

    return entry;
  }

  private async processBatch(
    entries: KBEntryInput[],
    startIndex: number,
    options: ImportOptions
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: ImportError[];
    warnings: ImportWarning[];
    validationErrors: number;
    duplicates: number;
  }> {
    const batchResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as ImportError[],
      warnings: [] as ImportWarning[],
      validationErrors: 0,
      duplicates: 0
    };

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const lineNumber = startIndex + i + 1;

      try {
        // Validate entry
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
                code: error.code
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
              code: warning.code
            });
          });
        }

        if (options.validateOnly) {
          continue;
        }

        // Check for duplicates (simplified check by title)
        const existing = await this.findExistingEntry(entry);
        
        if (existing) {
          batchResult.duplicates++;
          
          if (options.skipDuplicates) {
            batchResult.skipped++;
            continue;
          }

          if (options.updateExisting) {
            // Update existing entry
            const success = await this.kbService.update(existing.id, {
              title: entry.title,
              problem: entry.problem,
              solution: entry.solution,
              category: entry.category,
              tags: entry.tags,
              updated_by: 'import'
            });

            if (success) {
              batchResult.updated++;
            } else {
              batchResult.errors.push({
                line: lineNumber,
                field: 'update',
                message: 'Failed to update existing entry',
                code: 'UPDATE_FAILED'
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
              code: 'DUPLICATE_ENTRY'
            });
            continue;
          }
        }

        // Create new entry
        const id = await this.kbService.create(entry);
        if (id) {
          batchResult.imported++;
        } else {
          batchResult.errors.push({
            line: lineNumber,
            field: 'create',
            message: 'Failed to create entry',
            code: 'CREATE_FAILED'
          });
        }
      } catch (error) {
        batchResult.errors.push({
          line: lineNumber,
          field: 'processing',
          message: `Processing failed: ${error.message}`,
          code: 'PROCESSING_FAILED'
        });
      }
    }

    return batchResult;
  }

  private async findExistingEntry(entry: KBEntryInput): Promise<KBEntry | null> {
    try {
      // Simple duplicate detection by title
      const results = await this.kbService.search(entry.title, {
        limit: 5,
        threshold: 0.9
      });

      // Look for exact title match
      const exactMatch = results.find(result => 
        result.entry.title.toLowerCase() === entry.title.toLowerCase()
      );

      return exactMatch?.entry || null;
    } catch (error) {
      console.warn('Failed to check for duplicates:', error);
      return null;
    }
  }
}

export default ImportExportService;