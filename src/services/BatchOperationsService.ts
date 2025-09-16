/**
 * Batch Operations Service
 *
 * Handles bulk operations on knowledge base entries with:
 * - Transactional safety (rollback on failure)
 * - Progress tracking and reporting
 * - Validation and conflict resolution
 * - Optimized database operations
 * - Error handling and recovery
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { KnowledgeDB, KBEntry } from '../database/KnowledgeDB';
import { EventEmitter } from 'events';

// ========================
// Types & Interfaces
// ========================

export interface BatchOperationOptions {
  /** Maximum number of operations to process simultaneously */
  batchSize?: number;
  /** Whether to continue on individual failures */
  continueOnError?: boolean;
  /** Timeout in milliseconds for the entire operation */
  timeout?: number;
  /** Whether to validate entries before processing */
  validateBeforeProcessing?: boolean;
  /** Custom validation rules */
  customValidation?: (entry: KBEntry) => Promise<string | null>;
}

export interface BatchOperationProgress {
  /** Total number of items to process */
  total: number;
  /** Number of items processed so far */
  processed: number;
  /** Number of successful operations */
  successful: number;
  /** Number of failed operations */
  failed: number;
  /** Current operation being processed */
  currentOperation?: string;
  /** Current item being processed */
  currentItem?: string;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
}

export interface BatchOperationResult<T = any> {
  /** Whether the overall operation was successful */
  success: boolean;
  /** Final progress state */
  progress: BatchOperationProgress;
  /** Results for individual items */
  results: Array<{
    id: string;
    success: boolean;
    data?: T;
    error?: string;
  }>;
  /** Overall error message if operation failed */
  error?: string;
  /** Time taken in milliseconds */
  duration: number;
  /** Operations that were rolled back */
  rolledBack?: string[];
}

export interface BatchValidationResult {
  /** Whether all entries are valid */
  isValid: boolean;
  /** Individual validation results */
  validationErrors: Array<{
    id: string;
    errors: string[];
  }>;
  /** Duplicate entries found */
  duplicates: Array<{
    id: string;
    duplicateOf: string;
    similarity: number;
  }>;
  /** Entries with conflicts */
  conflicts: Array<{
    id: string;
    conflictType: string;
    details: string;
  }>;
}

// ========================
// Batch Operations Service
// ========================

export class BatchOperationsService extends EventEmitter {
  private db: KnowledgeDB;
  private activeOperations = new Map<string, AbortController>();

  constructor(db: KnowledgeDB) {
    super();
    this.db = db;
  }

  /**
   * Perform batch update operation on multiple entries
   */
  async batchUpdate(
    entryIds: string[],
    updates: Partial<KBEntry> | ((entry: KBEntry) => Partial<KBEntry>),
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult<KBEntry>> {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);

    try {
      return await this.executeBatchOperation(
        operationId,
        'update',
        entryIds,
        async (entry: KBEntry) => {
          const updateData = typeof updates === 'function' ? updates(entry) : updates;
          await this.db.updateEntry(entry.id!, updateData);
          return { ...entry, ...updateData };
        },
        options
      );
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Perform batch delete operation on multiple entries
   */
  async batchDelete(
    entryIds: string[],
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult<void>> {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);

    try {
      // Create backup before deletion for rollback capability
      const backupPath = await this.createOperationBackup(entryIds, 'delete');

      const result = await this.executeBatchOperation(
        operationId,
        'delete',
        entryIds,
        async (entry: KBEntry) => {
          // Soft delete by archiving instead of hard delete
          await this.db.updateEntry(entry.id!, { archived: true });
        },
        { ...options, validateBeforeProcessing: false }
      );

      // If operation failed, restore from backup
      if (!result.success && backupPath) {
        await this.restoreFromBackup(backupPath, entryIds);
        result.rolledBack = entryIds.filter(id =>
          !result.results.find(r => r.id === id && r.success)
        );
      }

      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Perform batch duplicate operation on multiple entries
   */
  async batchDuplicate(
    entryIds: string[],
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult<KBEntry>> {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);

    try {
      return await this.executeBatchOperation(
        operationId,
        'duplicate',
        entryIds,
        async (entry: KBEntry) => {
          // Create a copy with modified title
          const duplicatedEntry: KBEntry = {
            ...entry,
            id: undefined, // Will be auto-generated
            title: `${entry.title} (Copy)`,
            created_at: new Date(),
            updated_at: new Date(),
            usage_count: 0,
            success_count: 0,
            failure_count: 0,
            last_used: undefined
          };

          const newId = await this.db.addEntry(duplicatedEntry);
          return { ...duplicatedEntry, id: newId };
        },
        options
      );
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Export multiple entries to various formats
   */
  async batchExport(
    entryIds: string[],
    format: 'json' | 'csv' | 'markdown' | 'xml' = 'json',
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult<string>> {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);

    try {
      const entries: KBEntry[] = [];

      const result = await this.executeBatchOperation(
        operationId,
        'export',
        entryIds,
        async (entry: KBEntry) => {
          entries.push(entry);
          return this.formatEntry(entry, format);
        },
        options
      );

      if (result.success) {
        // Combine all exported data
        const exportData = this.combineExportData(
          result.results.map(r => r.data).filter(Boolean),
          format
        );

        // Return combined result
        return {
          ...result,
          results: [{
            id: 'combined',
            success: true,
            data: exportData
          }]
        };
      }

      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Import multiple entries from various formats
   */
  async batchImport(
    data: string,
    format: 'json' | 'csv' | 'xml' = 'json',
    options: BatchOperationOptions & {
      mergeDuplicates?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<BatchOperationResult<KBEntry>> {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);

    try {
      // Parse import data
      const entries = await this.parseImportData(data, format);
      const entryIds = entries.map((entry, index) => entry.id || `import-${index}`);

      // Validate entries if not skipping validation
      if (!options.skipValidation) {
        const validationResult = await this.validateBatch(entries);
        if (!validationResult.isValid) {
          throw new Error(`Import validation failed: ${validationResult.validationErrors.length} errors found`);
        }
      }

      return await this.executeBatchOperation(
        operationId,
        'import',
        entryIds,
        async (entry: KBEntry, index: number) => {
          const importEntry = entries[index];

          // Check for duplicates if merge option is enabled
          if (options.mergeDuplicates) {
            const existingEntries = await this.db.search(importEntry.title, { limit: 5 });
            const duplicate = existingEntries.find(result =>
              this.calculateSimilarity(result.entry, importEntry) > 0.85
            );

            if (duplicate) {
              // Update existing entry instead of creating new
              await this.db.updateEntry(duplicate.entry.id!, importEntry);
              return { ...duplicate.entry, ...importEntry };
            }
          }

          // Create new entry
          const newId = await this.db.addEntry(importEntry);
          return { ...importEntry, id: newId };
        },
        options
      );
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Validate a batch of entries before processing
   */
  async validateBatch(entries: KBEntry[]): Promise<BatchValidationResult> {
    const validationErrors: Array<{ id: string; errors: string[] }> = [];
    const duplicates: Array<{ id: string; duplicateOf: string; similarity: number }> = [];
    const conflicts: Array<{ id: string; conflictType: string; details: string }> = [];

    // Individual entry validation
    for (const entry of entries) {
      const errors: string[] = [];

      // Required field validation
      if (!entry.title?.trim()) {
        errors.push('Title is required');
      }
      if (!entry.problem?.trim()) {
        errors.push('Problem description is required');
      }
      if (!entry.solution?.trim()) {
        errors.push('Solution is required');
      }
      if (!entry.category?.trim()) {
        errors.push('Category is required');
      }

      // Length validation
      if (entry.title && entry.title.length > 200) {
        errors.push('Title must be less than 200 characters');
      }
      if (entry.problem && entry.problem.length > 2000) {
        errors.push('Problem description must be less than 2000 characters');
      }
      if (entry.solution && entry.solution.length > 5000) {
        errors.push('Solution must be less than 5000 characters');
      }

      // Tag validation
      if (entry.tags && entry.tags.length > 10) {
        errors.push('Maximum 10 tags allowed');
      }

      if (errors.length > 0) {
        validationErrors.push({
          id: entry.id || 'unknown',
          errors
        });
      }
    }

    // Duplicate detection within batch
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const similarity = this.calculateSimilarity(entries[i], entries[j]);
        if (similarity > 0.85) {
          duplicates.push({
            id: entries[j].id || `entry-${j}`,
            duplicateOf: entries[i].id || `entry-${i}`,
            similarity
          });
        }
      }
    }

    // Conflict detection with existing entries
    for (const entry of entries) {
      if (entry.id) {
        const existing = await this.db.getEntry(entry.id);
        if (existing && existing.updated_at && entry.updated_at) {
          const existingTime = new Date(existing.updated_at).getTime();
          const entryTime = new Date(entry.updated_at).getTime();

          if (entryTime < existingTime) {
            conflicts.push({
              id: entry.id,
              conflictType: 'outdated',
              details: 'Entry has been modified by another user'
            });
          }
        }
      }
    }

    return {
      isValid: validationErrors.length === 0,
      validationErrors,
      duplicates,
      conflicts
    };
  }

  /**
   * Cancel an active batch operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const controller = this.activeOperations.get(operationId);
    if (controller) {
      controller.abort();
      this.activeOperations.delete(operationId);
      this.emit('operationCancelled', { operationId });
      return true;
    }
    return false;
  }

  /**
   * Get status of all active operations
   */
  getActiveOperations(): string[] {
    return Array.from(this.activeOperations.keys());
  }

  // ========================
  // Private Helper Methods
  // ========================

  /**
   * Execute a batch operation with progress tracking and error handling
   */
  private async executeBatchOperation<T>(
    operationId: string,
    operationType: string,
    entryIds: string[],
    operation: (entry: KBEntry, index: number) => Promise<T>,
    options: BatchOperationOptions
  ): Promise<BatchOperationResult<T>> {
    const startTime = Date.now();
    const {
      batchSize = 10,
      continueOnError = true,
      timeout = 300000, // 5 minutes
      validateBeforeProcessing = true
    } = options;

    const progress: BatchOperationProgress = {
      total: entryIds.length,
      processed: 0,
      successful: 0,
      failed: 0,
      percentComplete: 0
    };

    const results: Array<{
      id: string;
      success: boolean;
      data?: T;
      error?: string;
    }> = [];

    try {
      // Fetch all entries
      const entries: KBEntry[] = [];
      for (const id of entryIds) {
        const entry = await this.db.getEntry(id);
        if (!entry) {
          results.push({
            id,
            success: false,
            error: 'Entry not found'
          });
          progress.failed++;
        } else {
          entries.push(entry);
        }
      }

      // Validate entries if required
      if (validateBeforeProcessing && entries.length > 0) {
        const validationResult = await this.validateBatch(entries);
        if (!validationResult.isValid) {
          throw new Error(`Validation failed: ${validationResult.validationErrors.length} errors found`);
        }
      }

      // Process entries in batches
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchPromises = batch.map(async (entry, batchIndex) => {
          const globalIndex = i + batchIndex;

          try {
            progress.currentItem = entry.title;
            progress.currentOperation = `${operationType} ${globalIndex + 1}/${entries.length}`;

            this.emit('progress', { operationId, progress });

            const result = await Promise.race([
              operation(entry, globalIndex),
              this.createTimeoutPromise(timeout)
            ]);

            progress.successful++;
            progress.processed++;
            progress.percentComplete = Math.round((progress.processed / progress.total) * 100);

            // Estimate remaining time
            const elapsed = Date.now() - startTime;
            const rate = progress.processed / elapsed;
            progress.estimatedTimeRemaining = Math.round((progress.total - progress.processed) / rate);

            return {
              id: entry.id!,
              success: true,
              data: result
            };
          } catch (error) {
            progress.failed++;
            progress.processed++;
            progress.percentComplete = Math.round((progress.processed / progress.total) * 100);

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (!continueOnError) {
              throw error;
            }

            return {
              id: entry.id!,
              success: false,
              error: errorMessage
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Check for cancellation
        const controller = this.activeOperations.get(operationId);
        if (controller?.signal.aborted) {
          throw new Error('Operation was cancelled');
        }

        // Emit progress update
        this.emit('progress', { operationId, progress });
      }

      const duration = Date.now() - startTime;
      const success = progress.failed === 0;

      this.emit('operationComplete', {
        operationId,
        operationType,
        success,
        duration,
        progress
      });

      return {
        success,
        progress,
        results,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit('operationError', {
        operationId,
        operationType,
        error: errorMessage,
        duration,
        progress
      });

      return {
        success: false,
        progress,
        results,
        error: errorMessage,
        duration
      };
    }
  }

  private generateOperationId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createTimeoutPromise<T>(timeout: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeout);
    });
  }

  private async createOperationBackup(entryIds: string[], operation: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `backup_${operation}_${timestamp}.json`;

    const entries: KBEntry[] = [];
    for (const id of entryIds) {
      const entry = await this.db.getEntry(id);
      if (entry) {
        entries.push(entry);
      }
    }

    await this.db.exportToJSON(backupPath);
    return backupPath;
  }

  private async restoreFromBackup(backupPath: string, entryIds: string[]): Promise<void> {
    try {
      await this.db.importFromJSON(backupPath, true);
    } catch (error) {
      console.error('Failed to restore from backup:', error);
    }
  }

  private calculateSimilarity(entry1: KBEntry, entry2: KBEntry): number {
    const text1 = `${entry1.title} ${entry1.problem}`.toLowerCase();
    const text2 = `${entry2.title} ${entry2.problem}`.toLowerCase();

    // Simple Jaccard similarity
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private formatEntry(entry: KBEntry, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(entry, null, 2);

      case 'csv':
        return [
          entry.id,
          `"${entry.title?.replace(/"/g, '""')}"`,
          `"${entry.problem?.replace(/"/g, '""')}"`,
          `"${entry.solution?.replace(/"/g, '""')}"`,
          entry.category,
          `"${entry.tags?.join(', ') || ''}"`,
          entry.created_at?.toISOString(),
          entry.usage_count || 0,
          entry.success_count || 0,
          entry.failure_count || 0
        ].join(',');

      case 'markdown':
        return `# ${entry.title}

**Category:** ${entry.category}
**Tags:** ${entry.tags?.join(', ') || 'None'}
**Created:** ${entry.created_at?.toLocaleDateString()}
**Usage:** ${entry.usage_count || 0} times

## Problem
${entry.problem}

## Solution
${entry.solution}

---`;

      case 'xml':
        return `<entry id="${entry.id}">
  <title><![CDATA[${entry.title}]]></title>
  <category>${entry.category}</category>
  <problem><![CDATA[${entry.problem}]]></problem>
  <solution><![CDATA[${entry.solution}]]></solution>
  <tags>${entry.tags?.map(tag => `<tag>${tag}</tag>`).join('') || ''}</tags>
  <created>${entry.created_at?.toISOString()}</created>
  <usage>${entry.usage_count || 0}</usage>
</entry>`;

      default:
        return JSON.stringify(entry);
    }
  }

  private combineExportData(exportedItems: string[], format: string): string {
    switch (format) {
      case 'json':
        return `[\n${exportedItems.join(',\n')}\n]`;

      case 'csv':
        const header = 'id,title,problem,solution,category,tags,created,usage_count,success_count,failure_count';
        return `${header}\n${exportedItems.join('\n')}`;

      case 'markdown':
        return exportedItems.join('\n\n');

      case 'xml':
        return `<?xml version="1.0" encoding="UTF-8"?>
<entries>
${exportedItems.map(item => `  ${item.replace(/\n/g, '\n  ')}`).join('\n')}
</entries>`;

      default:
        return exportedItems.join('\n');
    }
  }

  private async parseImportData(data: string, format: string): Promise<KBEntry[]> {
    switch (format) {
      case 'json':
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [parsed];

      case 'csv':
        const lines = data.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const entries: KBEntry[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = this.parseCSVLine(lines[i]);
          const entry: Partial<KBEntry> = {};

          headers.forEach((header, index) => {
            const value = values[index]?.replace(/^"(.*)"$/, '$1').replace(/""/g, '"');

            switch (header) {
              case 'title':
                entry.title = value;
                break;
              case 'problem':
                entry.problem = value;
                break;
              case 'solution':
                entry.solution = value;
                break;
              case 'category':
                entry.category = value;
                break;
              case 'tags':
                entry.tags = value ? value.split(', ').map(t => t.trim()) : [];
                break;
              // Add other field mappings as needed
            }
          });

          if (entry.title && entry.problem && entry.solution) {
            entries.push(entry as KBEntry);
          }
        }

        return entries;

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}

export default BatchOperationsService;