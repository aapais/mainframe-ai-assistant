import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { KBEntry } from '../../database/KnowledgeDB';
import Database from 'better-sqlite3';

/**
 * Batch operation types supported by the service
 */
export type BatchOperationType = 'create' | 'update' | 'delete' | 'archive' | 'restore';

/**
 * Individual operation within a batch
 */
export interface BatchOperation {
  id: string;
  type: BatchOperationType;
  entryId?: string;
  entry?: Partial<KBEntry>;
  metadata?: Record<string, any>;
}

/**
 * Batch operation result for individual operations
 */
export interface BatchOperationResult {
  operationId: string;
  success: boolean;
  entryId?: string;
  error?: string;
  executionTime?: number;
}

/**
 * Complete batch execution result
 */
export interface BatchExecutionResult {
  batchId: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  executionTime: number;
  results: BatchOperationResult[];
  rollbackId?: string;
}

/**
 * Progress tracking for long-running batch operations
 */
export interface BatchProgress {
  batchId: string;
  totalOperations: number;
  completedOperations: number;
  currentOperation: string;
  estimatedTimeRemaining: number;
  percentage: number;
}

/**
 * Export format options
 */
export interface ExportOptions {
  format: 'json' | 'csv';
  includeMetadata?: boolean;
  includeUsageStats?: boolean;
  filter?: {
    categories?: string[];
    tags?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    archived?: boolean;
  };
}

/**
 * Import options and validation settings
 */
export interface ImportOptions {
  format: 'json' | 'csv';
  validateBeforeImport?: boolean;
  mergeStrategy?: 'skip' | 'overwrite' | 'merge';
  createMissingCategories?: boolean;
  bulkSize?: number;
}

/**
 * High-performance batch operations service for Knowledge Base entries
 *
 * Provides:
 * - Bulk create/update/delete operations with transaction safety
 * - Progress tracking for long-running operations
 * - Export/import functionality with multiple formats
 * - Rollback capabilities for failed operations
 * - Performance optimization for large datasets
 *
 * @extends EventEmitter
 *
 * @emits 'progress' - Progress updates for long-running operations
 * @emits 'complete' - Batch operation completion
 * @emits 'error' - Operation errors and failures
 * @emits 'validation' - Validation errors during import
 *
 * @example
 * ```typescript
 * const batchService = new BatchOperationsService(database);
 *
 * // Create multiple entries
 * const operations = [
 *   { id: 'op1', type: 'create', entry: { title: 'Entry 1', ... } },
 *   { id: 'op2', type: 'create', entry: { title: 'Entry 2', ... } }
 * ];
 *
 * batchService.on('progress', (progress) => {
 *   console.log(`${progress.percentage}% complete`);
 * });
 *
 * const result = await batchService.executeBatch(operations);
 * console.log(`${result.successfulOperations}/${result.totalOperations} operations completed`);
 * ```
 */
export class BatchOperationsService extends EventEmitter {
  private db: Database.Database;
  private activeBatches = new Map<string, BatchProgress>();
  private rollbackData = new Map<string, any[]>();

  // Performance tuning parameters
  private readonly BULK_INSERT_SIZE = 100;
  private readonly PROGRESS_UPDATE_INTERVAL = 50; // Update progress every N operations
  private readonly MAX_ROLLBACK_RETENTION = 24 * 60 * 60 * 1000; // 24 hours

  constructor(database: Database.Database) {
    super();
    this.db = database;

    // Setup periodic cleanup
    this.setupCleanupInterval();
  }

  /**
   * Execute a batch of operations with full transaction safety
   *
   * @param operations - Array of operations to execute
   * @param options - Batch execution options
   * @returns Promise resolving to batch execution results
   */
  async executeBatch(
    operations: BatchOperation[],
    options: {
      enableRollback?: boolean;
      progressUpdates?: boolean;
      validateFirst?: boolean;
      stopOnFirstError?: boolean;
    } = {}
  ): Promise<BatchExecutionResult> {
    const batchId = uuidv4();
    const startTime = Date.now();

    const {
      enableRollback = true,
      progressUpdates = true,
      validateFirst = true,
      stopOnFirstError = false
    } = options;

    // Initialize progress tracking
    if (progressUpdates) {
      this.initializeProgress(batchId, operations.length);
    }

    // Pre-validation phase
    if (validateFirst) {
      const validationErrors = await this.validateBatch(operations);
      if (validationErrors.length > 0) {
        this.emit('validation', { batchId, errors: validationErrors });
        if (stopOnFirstError) {
          throw new Error(`Validation failed: ${validationErrors[0]}`);
        }
      }
    }

    let rollbackId: string | undefined;
    const results: BatchOperationResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Execute batch in transaction
    const transaction = this.db.transaction(() => {
      // Create rollback point if enabled
      if (enableRollback) {
        rollbackId = this.createRollbackPoint(operations);
      }

      // Execute operations
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const opStartTime = Date.now();

        try {
          const result = this.executeOperation(operation);
          const executionTime = Date.now() - opStartTime;

          results.push({
            operationId: operation.id,
            success: true,
            entryId: result.entryId,
            executionTime
          });

          successCount++;

          // Update progress
          if (progressUpdates && i % this.PROGRESS_UPDATE_INTERVAL === 0) {
            this.updateProgress(batchId, i + 1, operation.type);
          }

        } catch (error) {
          const executionTime = Date.now() - opStartTime;

          results.push({
            operationId: operation.id,
            success: false,
            error: error.message,
            executionTime
          });

          failureCount++;

          // Stop on first error if configured
          if (stopOnFirstError) {
            throw error;
          }
        }
      }
    });

    try {
      transaction();

      // Final progress update
      if (progressUpdates) {
        this.completeProgress(batchId);
      }

    } catch (error) {
      // Handle transaction failure
      if (enableRollback && rollbackId) {
        await this.rollbackBatch(rollbackId);
      }

      this.emit('error', { batchId, error: error.message });
      throw error;
    }

    const executionResult: BatchExecutionResult = {
      batchId,
      totalOperations: operations.length,
      successfulOperations: successCount,
      failedOperations: failureCount,
      executionTime: Date.now() - startTime,
      results,
      rollbackId
    };

    this.emit('complete', executionResult);
    return executionResult;
  }

  /**
   * Bulk create multiple entries with optimized performance
   *
   * @param entries - Array of KB entries to create
   * @param options - Creation options
   * @returns Promise resolving to creation results
   */
  async bulkCreate(
    entries: Omit<KBEntry, 'id'>[],
    options: {
      validateBeforeInsert?: boolean;
      skipDuplicates?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<BatchExecutionResult> {
    const operations: BatchOperation[] = entries.map(entry => ({
      id: uuidv4(),
      type: 'create' as BatchOperationType,
      entry: { ...entry, id: uuidv4() }
    }));

    return this.executeBatch(operations, {
      enableRollback: true,
      progressUpdates: true,
      validateFirst: options.validateBeforeInsert,
      stopOnFirstError: !options.skipDuplicates
    });
  }

  /**
   * Bulk update multiple entries efficiently
   *
   * @param updates - Array of entry updates with IDs
   * @param options - Update options
   * @returns Promise resolving to update results
   */
  async bulkUpdate(
    updates: Array<{ id: string; updates: Partial<KBEntry> }>,
    options: {
      validateBeforeUpdate?: boolean;
      skipMissing?: boolean;
    } = {}
  ): Promise<BatchExecutionResult> {
    const operations: BatchOperation[] = updates.map(update => ({
      id: uuidv4(),
      type: 'update' as BatchOperationType,
      entryId: update.id,
      entry: update.updates
    }));

    return this.executeBatch(operations, {
      enableRollback: true,
      progressUpdates: true,
      validateFirst: options.validateBeforeUpdate,
      stopOnFirstError: !options.skipMissing
    });
  }

  /**
   * Bulk delete multiple entries by IDs
   *
   * @param entryIds - Array of entry IDs to delete
   * @param options - Deletion options
   * @returns Promise resolving to deletion results
   */
  async bulkDelete(
    entryIds: string[],
    options: {
      softDelete?: boolean; // Archive instead of delete
      skipMissing?: boolean;
    } = {}
  ): Promise<BatchExecutionResult> {
    const operationType = options.softDelete ? 'archive' : 'delete';

    const operations: BatchOperation[] = entryIds.map(entryId => ({
      id: uuidv4(),
      type: operationType as BatchOperationType,
      entryId
    }));

    return this.executeBatch(operations, {
      enableRollback: true,
      progressUpdates: true,
      stopOnFirstError: !options.skipMissing
    });
  }

  /**
   * Export KB entries to various formats
   *
   * @param outputPath - Path to output file
   * @param options - Export configuration
   * @returns Promise resolving to export statistics
   */
  async exportEntries(
    outputPath: string,
    options: ExportOptions = { format: 'json' }
  ): Promise<{
    exportedCount: number;
    fileSize: number;
    format: string;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const { format, includeMetadata, includeUsageStats, filter } = options;

    // Build query based on filters
    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    if (filter?.categories && filter.categories.length > 0) {
      whereConditions.push(`category IN (${filter.categories.map(() => '?').join(', ')})`);
      queryParams.push(...filter.categories);
    }

    if (filter?.tags && filter.tags.length > 0) {
      whereConditions.push(`id IN (
        SELECT entry_id FROM kb_tags
        WHERE tag IN (${filter.tags.map(() => '?').join(', ')})
      )`);
      queryParams.push(...filter.tags);
    }

    if (filter?.dateRange) {
      whereConditions.push('created_at BETWEEN ? AND ?');
      queryParams.push(
        filter.dateRange.start.toISOString(),
        filter.dateRange.end.toISOString()
      );
    }

    if (filter?.archived !== undefined) {
      whereConditions.push('archived = ?');
      queryParams.push(filter.archived);
    }

    // Construct base query
    const baseQuery = `
      SELECT
        e.*,
        ${includeUsageStats ? `
          e.usage_count,
          e.success_count,
          e.failure_count,
          CASE WHEN (e.success_count + e.failure_count) > 0
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
               ELSE 0 END as success_rate,
        ` : ''}
        GROUP_CONCAT(DISTINCT t.tag, ', ') as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;

    const entries = this.db.prepare(baseQuery).all(...queryParams);

    let exportResult: { exportedCount: number; fileSize: number };

    if (format === 'json') {
      exportResult = await this.exportToJSON(entries, outputPath, includeMetadata);
    } else if (format === 'csv') {
      exportResult = await this.exportToCSV(entries, outputPath);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      ...exportResult,
      format,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Import KB entries from various formats
   *
   * @param inputPath - Path to input file
   * @param options - Import configuration
   * @returns Promise resolving to import statistics
   */
  async importEntries(
    inputPath: string,
    options: ImportOptions = { format: 'json' }
  ): Promise<{
    importedCount: number;
    skippedCount: number;
    errorCount: number;
    executionTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const { format, validateBeforeImport, mergeStrategy, bulkSize } = options;

    let entries: any[];
    const errors: string[] = [];

    try {
      if (format === 'json') {
        entries = await this.importFromJSON(inputPath);
      } else if (format === 'csv') {
        entries = await this.importFromCSV(inputPath);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse ${format.toUpperCase()} file: ${error.message}`);
    }

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process in batches for better performance
    const batchSizeValue = bulkSize || this.BULK_INSERT_SIZE;

    for (let i = 0; i < entries.length; i += batchSizeValue) {
      const batch = entries.slice(i, i + batchSizeValue);

      try {
        const operations = batch.map(entry => {
          // Validate entry structure if requested
          if (validateBeforeImport) {
            const validationError = this.validateEntryStructure(entry);
            if (validationError) {
              errors.push(`Entry ${i + batch.indexOf(entry)}: ${validationError}`);
              return null;
            }
          }

          return {
            id: uuidv4(),
            type: 'create' as BatchOperationType,
            entry: this.normalizeImportedEntry(entry)
          };
        }).filter(op => op !== null) as BatchOperation[];

        if (operations.length > 0) {
          const result = await this.executeBatch(operations, {
            enableRollback: false, // Handle errors gracefully during import
            progressUpdates: false, // Disable progress for internal batches
            validateFirst: false, // Already validated above
            stopOnFirstError: false
          });

          importedCount += result.successfulOperations;
          errorCount += result.failedOperations;

          // Collect detailed error messages
          result.results
            .filter(r => !r.success)
            .forEach(r => errors.push(`Operation ${r.operationId}: ${r.error}`));
        }

      } catch (error) {
        errorCount += batch.length;
        errors.push(`Batch ${i}-${i + batchSizeValue}: ${error.message}`);
      }
    }

    return {
      importedCount,
      skippedCount,
      errorCount,
      executionTime: Date.now() - startTime,
      errors
    };
  }

  /**
   * Rollback a batch operation using stored rollback data
   *
   * @param rollbackId - ID of the rollback point
   * @returns Promise resolving to rollback results
   */
  async rollbackBatch(rollbackId: string): Promise<{
    rolledBackOperations: number;
    success: boolean;
    errors: string[];
  }> {
    const rollbackData = this.rollbackData.get(rollbackId);

    if (!rollbackData) {
      throw new Error(`Rollback data not found for ID: ${rollbackId}`);
    }

    const errors: string[] = [];
    let rolledBackOperations = 0;

    const rollbackTransaction = this.db.transaction(() => {
      rollbackData.forEach((item, index) => {
        try {
          switch (item.action) {
            case 'restore_entry':
              this.restoreEntry(item.data);
              break;
            case 'delete_entry':
              this.db.prepare('DELETE FROM kb_entries WHERE id = ?').run(item.entryId);
              break;
            case 'restore_original':
              this.updateEntryDirect(item.data);
              break;
          }
          rolledBackOperations++;
        } catch (error) {
          errors.push(`Rollback operation ${index}: ${error.message}`);
        }
      });
    });

    try {
      rollbackTransaction();

      // Clean up rollback data
      this.rollbackData.delete(rollbackId);

      return {
        rolledBackOperations,
        success: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        rolledBackOperations: 0,
        success: false,
        errors: [`Transaction failed: ${error.message}`]
      };
    }
  }

  /**
   * Get current progress for an active batch operation
   *
   * @param batchId - ID of the batch operation
   * @returns Current progress information or null if not found
   */
  getBatchProgress(batchId: string): BatchProgress | null {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Get list of available rollback points
   *
   * @returns Array of rollback IDs with metadata
   */
  getAvailableRollbacks(): Array<{
    rollbackId: string;
    createdAt: Date;
    operationCount: number;
  }> {
    return Array.from(this.rollbackData.entries()).map(([rollbackId, data]) => ({
      rollbackId,
      createdAt: new Date(data[0]?.timestamp || Date.now()),
      operationCount: data.length
    }));
  }

  // Private implementation methods

  private validateBatch(operations: BatchOperation[]): string[] {
    const errors: string[] = [];

    operations.forEach((operation, index) => {
      if (!operation.id) {
        errors.push(`Operation ${index}: Missing operation ID`);
      }

      if (!['create', 'update', 'delete', 'archive', 'restore'].includes(operation.type)) {
        errors.push(`Operation ${index}: Invalid operation type: ${operation.type}`);
      }

      if (['update', 'delete', 'archive', 'restore'].includes(operation.type) && !operation.entryId) {
        errors.push(`Operation ${index}: Missing entryId for ${operation.type} operation`);
      }

      if (operation.type === 'create' && !operation.entry) {
        errors.push(`Operation ${index}: Missing entry data for create operation`);
      }

      if (operation.entry) {
        const entryValidation = this.validateEntryStructure(operation.entry);
        if (entryValidation) {
          errors.push(`Operation ${index}: ${entryValidation}`);
        }
      }
    });

    return errors;
  }

  private validateEntryStructure(entry: any): string | null {
    if (!entry.title || typeof entry.title !== 'string') {
      return 'Missing or invalid title';
    }

    if (!entry.problem || typeof entry.problem !== 'string') {
      return 'Missing or invalid problem description';
    }

    if (!entry.solution || typeof entry.solution !== 'string') {
      return 'Missing or invalid solution';
    }

    if (!entry.category || typeof entry.category !== 'string') {
      return 'Missing or invalid category';
    }

    if (entry.tags && !Array.isArray(entry.tags)) {
      return 'Tags must be an array';
    }

    return null;
  }

  private executeOperation(operation: BatchOperation): { entryId?: string } {
    switch (operation.type) {
      case 'create':
        return { entryId: this.createEntry(operation.entry!) };
      case 'update':
        this.updateEntry(operation.entryId!, operation.entry!);
        return { entryId: operation.entryId };
      case 'delete':
        this.deleteEntry(operation.entryId!);
        return { entryId: operation.entryId };
      case 'archive':
        this.archiveEntry(operation.entryId!);
        return { entryId: operation.entryId };
      case 'restore':
        this.restoreEntry({ id: operation.entryId! });
        return { entryId: operation.entryId };
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private createEntry(entry: Partial<KBEntry>): string {
    const id = entry.id || uuidv4();

    this.db.prepare(`
      INSERT INTO kb_entries (id, title, problem, solution, category, severity, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.title,
      entry.problem,
      entry.solution,
      entry.category,
      entry.severity || 'medium',
      entry.created_by || 'batch-service'
    );

    // Insert tags if provided
    if (entry.tags && entry.tags.length > 0) {
      const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
      entry.tags.forEach(tag => {
        tagStmt.run(id, tag.toLowerCase().trim());
      });
    }

    return id;
  }

  private updateEntry(entryId: string, updates: Partial<KBEntry>): void {
    const setClause: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'tags' && value !== undefined) {
        setClause.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (setClause.length > 0) {
      setClause.push('updated_at = CURRENT_TIMESTAMP');
      values.push(entryId);

      this.db.prepare(`
        UPDATE kb_entries
        SET ${setClause.join(', ')}
        WHERE id = ?
      `).run(...values);
    }

    // Update tags if provided
    if (updates.tags !== undefined) {
      this.db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(entryId);

      if (updates.tags.length > 0) {
        const tagStmt = this.db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
        updates.tags.forEach(tag => {
          tagStmt.run(entryId, tag.toLowerCase().trim());
        });
      }
    }
  }

  private deleteEntry(entryId: string): void {
    this.db.prepare('DELETE FROM kb_entries WHERE id = ?').run(entryId);
  }

  private archiveEntry(entryId: string): void {
    this.db.prepare('UPDATE kb_entries SET archived = TRUE WHERE id = ?').run(entryId);
  }

  private restoreEntry(data: any): void {
    if (data.id) {
      this.db.prepare('UPDATE kb_entries SET archived = FALSE WHERE id = ?').run(data.id);
    }
  }

  private updateEntryDirect(data: any): void {
    // Restore original entry data during rollback
    const setClause = Object.keys(data)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.keys(data)
      .filter(key => key !== 'id')
      .map(key => data[key]);

    values.push(data.id);

    this.db.prepare(`
      UPDATE kb_entries
      SET ${setClause}
      WHERE id = ?
    `).run(...values);
  }

  private createRollbackPoint(operations: BatchOperation[]): string {
    const rollbackId = uuidv4();
    const rollbackData: any[] = [];

    operations.forEach(operation => {
      if (operation.type === 'create') {
        // For create operations, store delete action
        rollbackData.push({
          action: 'delete_entry',
          entryId: operation.entry?.id,
          timestamp: Date.now()
        });
      } else if (operation.type === 'update' && operation.entryId) {
        // For update operations, store original data
        const original = this.db.prepare('SELECT * FROM kb_entries WHERE id = ?').get(operation.entryId);
        if (original) {
          rollbackData.push({
            action: 'restore_original',
            data: original,
            timestamp: Date.now()
          });
        }
      } else if (['delete', 'archive'].includes(operation.type) && operation.entryId) {
        // For delete/archive operations, store full entry data
        const entryData = this.db.prepare(`
          SELECT e.*, GROUP_CONCAT(t.tag) as tags
          FROM kb_entries e
          LEFT JOIN kb_tags t ON e.id = t.entry_id
          WHERE e.id = ?
          GROUP BY e.id
        `).get(operation.entryId);

        if (entryData) {
          rollbackData.push({
            action: 'restore_entry',
            data: entryData,
            timestamp: Date.now()
          });
        }
      }
    });

    this.rollbackData.set(rollbackId, rollbackData);
    return rollbackId;
  }

  private initializeProgress(batchId: string, totalOperations: number): void {
    this.activeBatches.set(batchId, {
      batchId,
      totalOperations,
      completedOperations: 0,
      currentOperation: 'Initializing...',
      estimatedTimeRemaining: 0,
      percentage: 0
    });
  }

  private updateProgress(batchId: string, completedOperations: number, currentOperation: string): void {
    const progress = this.activeBatches.get(batchId);
    if (!progress) return;

    const percentage = Math.round((completedOperations / progress.totalOperations) * 100);
    const remainingOps = progress.totalOperations - completedOperations;
    const avgTimePerOp = completedOperations > 0 ? Date.now() / completedOperations : 0;
    const estimatedTimeRemaining = remainingOps * avgTimePerOp;

    const updatedProgress: BatchProgress = {
      ...progress,
      completedOperations,
      currentOperation,
      percentage,
      estimatedTimeRemaining
    };

    this.activeBatches.set(batchId, updatedProgress);
    this.emit('progress', updatedProgress);
  }

  private completeProgress(batchId: string): void {
    const progress = this.activeBatches.get(batchId);
    if (progress) {
      this.emit('progress', {
        ...progress,
        completedOperations: progress.totalOperations,
        currentOperation: 'Completed',
        percentage: 100,
        estimatedTimeRemaining: 0
      });
    }

    this.activeBatches.delete(batchId);
  }

  private async exportToJSON(entries: any[], outputPath: string, includeMetadata?: boolean): Promise<{ exportedCount: number; fileSize: number }> {
    const fs = await import('fs/promises');

    const exportData = {
      metadata: includeMetadata ? {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        source: 'BatchOperationsService'
      } : undefined,
      entries
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    await fs.writeFile(outputPath, jsonData, 'utf8');

    return {
      exportedCount: entries.length,
      fileSize: Buffer.byteLength(jsonData, 'utf8')
    };
  }

  private async exportToCSV(entries: any[], outputPath: string): Promise<{ exportedCount: number; fileSize: number }> {
    const fs = await import('fs/promises');

    if (entries.length === 0) {
      await fs.writeFile(outputPath, '', 'utf8');
      return { exportedCount: 0, fileSize: 0 };
    }

    // CSV headers
    const headers = Object.keys(entries[0]).filter(key => key !== 'tags');
    headers.push('tags');

    // CSV rows
    const rows = entries.map(entry => {
      const row = headers.map(header => {
        if (header === 'tags') {
          return entry.tags || '';
        }
        const value = entry[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      return row.join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\n');
    await fs.writeFile(outputPath, csvData, 'utf8');

    return {
      exportedCount: entries.length,
      fileSize: Buffer.byteLength(csvData, 'utf8')
    };
  }

  private async importFromJSON(inputPath: string): Promise<any[]> {
    const fs = await import('fs/promises');
    const fileContent = await fs.readFile(inputPath, 'utf8');
    const data = JSON.parse(fileContent);

    return data.entries || data; // Support both wrapped and unwrapped formats
  }

  private async importFromCSV(inputPath: string): Promise<any[]> {
    const fs = await import('fs/promises');
    const fileContent = await fs.readFile(inputPath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const entries = lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const entry: any = {};

      headers.forEach((header, index) => {
        if (header === 'tags' && values[index]) {
          entry[header] = values[index].split(';').map(tag => tag.trim());
        } else {
          entry[header] = values[index];
        }
      });

      return entry;
    });

    return entries;
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  private normalizeImportedEntry(entry: any): Partial<KBEntry> {
    return {
      id: entry.id || uuidv4(),
      title: entry.title,
      problem: entry.problem,
      solution: entry.solution,
      category: entry.category,
      severity: entry.severity || 'medium',
      tags: Array.isArray(entry.tags) ? entry.tags : (entry.tags ? entry.tags.split(',').map((t: string) => t.trim()) : []),
      created_by: entry.created_by || 'import'
    };
  }

  private setupCleanupInterval(): void {
    // Clean up old rollback data every hour
    setInterval(() => {
      const cutoffTime = Date.now() - this.MAX_ROLLBACK_RETENTION;

      this.rollbackData.forEach((data, rollbackId) => {
        const oldestTimestamp = Math.min(...data.map(item => item.timestamp || Date.now()));
        if (oldestTimestamp < cutoffTime) {
          this.rollbackData.delete(rollbackId);
        }
      });
    }, 60 * 60 * 1000); // Run every hour
  }
}