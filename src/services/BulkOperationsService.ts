/**
 * Bulk Operations Service
 *
 * Provides efficient batch operations for managing multiple KB entries,
 * including bulk tagging, categorization, and entry management.
 *
 * Features:
 * - Bulk tag application and removal
 * - Batch category changes
 * - Mass entry updates with validation
 * - Progress tracking and error handling
 * - Operation queuing and rate limiting
 * - Rollback capabilities
 * - Operation history and audit logging
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { KBEntry } from '../database/schemas/KnowledgeBase.schema';

// ===========================
// BULK OPERATION SCHEMAS
// ===========================

export const BulkOperationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'add_tags',
    'remove_tags',
    'replace_tags',
    'change_category',
    'update_entries',
    'delete_entries',
    'archive_entries',
    'merge_entries',
    'duplicate_entries',
    'export_entries',
  ]),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  target_entry_ids: z.array(z.string().uuid()),
  operation_data: z.record(z.any()),
  created_at: z.date(),
  started_at: z.date().optional(),
  completed_at: z.date().optional(),
  created_by: z.string().optional(),
  progress: z.object({
    total: z.number().int().min(0),
    completed: z.number().int().min(0),
    failed: z.number().int().min(0),
    current_item: z.string().optional(),
  }),
  errors: z.array(
    z.object({
      entry_id: z.string().uuid(),
      error_message: z.string(),
      error_code: z.string().optional(),
      timestamp: z.date(),
    })
  ),
  rollback_data: z.record(z.any()).optional(),
  can_rollback: z.boolean().default(false),
});

export type BulkOperation = z.infer<typeof BulkOperationSchema>;

export const BulkTagOperationSchema = z.object({
  operation_type: z.enum(['add', 'remove', 'replace']),
  tags: z.array(z.string()),
  entry_ids: z.array(z.string().uuid()),
  validation_options: z
    .object({
      validate_tags: z.boolean().default(true),
      create_missing_tags: z.boolean().default(true),
      skip_duplicates: z.boolean().default(true),
    })
    .optional(),
});

export type BulkTagOperation = z.infer<typeof BulkTagOperationSchema>;

export const BulkCategoryOperationSchema = z.object({
  new_category_id: z.string().uuid(),
  entry_ids: z.array(z.string().uuid()),
  preserve_subcategories: z.boolean().default(false),
  validation_options: z
    .object({
      validate_category: z.boolean().default(true),
      allow_system_categories: z.boolean().default(true),
    })
    .optional(),
});

export type BulkCategoryOperation = z.infer<typeof BulkCategoryOperationSchema>;

export const BulkUpdateOperationSchema = z.object({
  updates: z.record(z.any()), // Field updates to apply
  entry_ids: z.array(z.string().uuid()),
  update_mode: z.enum(['merge', 'replace']).default('merge'),
  validation_options: z
    .object({
      validate_schema: z.boolean().default(true),
      skip_invalid: z.boolean().default(true),
      preserve_metadata: z.boolean().default(true),
    })
    .optional(),
});

export type BulkUpdateOperation = z.infer<typeof BulkUpdateOperationSchema>;

// ===========================
// BULK OPERATIONS SERVICE
// ===========================

export interface BulkOperationsOptions {
  maxConcurrentOperations?: number;
  batchSize?: number;
  rateLimitDelay?: number;
  enableRollback?: boolean;
  enableAuditLogging?: boolean;
  maxHistoryEntries?: number;
  progressUpdateInterval?: number;
}

export class BulkOperationsService extends EventEmitter {
  private operations: Map<string, BulkOperation> = new Map();
  private operationQueue: string[] = [];
  private activeOperations: Set<string> = new Set();
  private operationHistory: BulkOperation[] = [];
  private options: Required<BulkOperationsOptions>;

  constructor(options: BulkOperationsOptions = {}) {
    super();

    this.options = {
      maxConcurrentOperations: 3,
      batchSize: 50,
      rateLimitDelay: 100, // milliseconds
      enableRollback: true,
      enableAuditLogging: true,
      maxHistoryEntries: 100,
      progressUpdateInterval: 1000, // milliseconds
      ...options,
    };

    // Start operation processor
    this.startOperationProcessor();
  }

  // ===========================
  // BULK TAG OPERATIONS
  // ===========================

  /**
   * Add tags to multiple entries
   */
  async addTagsToEntries(operation: BulkTagOperation): Promise<string> {
    const bulkOp = await this.createBulkOperation('add_tags', operation.entry_ids, {
      tags: operation.tags,
      validation_options: operation.validation_options,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  /**
   * Remove tags from multiple entries
   */
  async removeTagsFromEntries(operation: BulkTagOperation): Promise<string> {
    const bulkOp = await this.createBulkOperation('remove_tags', operation.entry_ids, {
      tags: operation.tags,
      validation_options: operation.validation_options,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  /**
   * Replace tags on multiple entries
   */
  async replaceTagsOnEntries(operation: BulkTagOperation): Promise<string> {
    const bulkOp = await this.createBulkOperation('replace_tags', operation.entry_ids, {
      tags: operation.tags,
      validation_options: operation.validation_options,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  // ===========================
  // BULK CATEGORY OPERATIONS
  // ===========================

  /**
   * Change category for multiple entries
   */
  async changeCategoryForEntries(operation: BulkCategoryOperation): Promise<string> {
    const bulkOp = await this.createBulkOperation('change_category', operation.entry_ids, {
      new_category_id: operation.new_category_id,
      preserve_subcategories: operation.preserve_subcategories,
      validation_options: operation.validation_options,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  // ===========================
  // BULK ENTRY OPERATIONS
  // ===========================

  /**
   * Update multiple entries with same data
   */
  async updateEntries(operation: BulkUpdateOperation): Promise<string> {
    const bulkOp = await this.createBulkOperation('update_entries', operation.entry_ids, {
      updates: operation.updates,
      update_mode: operation.update_mode,
      validation_options: operation.validation_options,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  /**
   * Delete multiple entries
   */
  async deleteEntries(
    entryIds: string[],
    options: {
      createBackup?: boolean;
      forceDelete?: boolean;
    } = {}
  ): Promise<string> {
    const bulkOp = await this.createBulkOperation('delete_entries', entryIds, {
      create_backup: options.createBackup ?? true,
      force_delete: options.forceDelete ?? false,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  /**
   * Archive multiple entries
   */
  async archiveEntries(entryIds: string[]): Promise<string> {
    const bulkOp = await this.createBulkOperation('archive_entries', entryIds, {});

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  /**
   * Duplicate multiple entries
   */
  async duplicateEntries(
    entryIds: string[],
    options: {
      namePrefix?: string;
      preserveMetadata?: boolean;
    } = {}
  ): Promise<string> {
    const bulkOp = await this.createBulkOperation('duplicate_entries', entryIds, {
      name_prefix: options.namePrefix ?? 'Copy of ',
      preserve_metadata: options.preserveMetadata ?? false,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  /**
   * Export multiple entries
   */
  async exportEntries(
    entryIds: string[],
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<string> {
    const bulkOp = await this.createBulkOperation('export_entries', entryIds, {
      format,
      export_path: this.generateExportPath(format),
      include_metadata: true,
    });

    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }

  // ===========================
  // OPERATION MANAGEMENT
  // ===========================

  /**
   * Get operation status
   */
  getOperationStatus(operationId: string): BulkOperation | null {
    return this.operations.get(operationId) || null;
  }

  /**
   * Cancel pending or in-progress operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation) return false;

    if (operation.status === 'completed' || operation.status === 'cancelled') {
      return false;
    }

    operation.status = 'cancelled';
    operation.completed_at = new Date();

    this.activeOperations.delete(operationId);
    this.removeFromQueue(operationId);

    await this.updateOperationInStorage(operation);
    this.emit('operationCancelled', operation);

    return true;
  }

  /**
   * Rollback completed operation
   */
  async rollbackOperation(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation || !operation.can_rollback || !operation.rollback_data) {
      return false;
    }

    if (operation.status !== 'completed') {
      throw new Error('Can only rollback completed operations');
    }

    try {
      await this.performRollback(operation);
      this.emit('operationRolledBack', operation);
      return true;
    } catch (error) {
      console.error('Rollback failed:', error);
      return false;
    }
  }

  /**
   * Get operation history
   */
  getOperationHistory(limit: number = 50): BulkOperation[] {
    return this.operationHistory
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  /**
   * Get active operations
   */
  getActiveOperations(): BulkOperation[] {
    return Array.from(this.activeOperations)
      .map(id => this.operations.get(id))
      .filter(Boolean) as BulkOperation[];
  }

  /**
   * Get queued operations
   */
  getQueuedOperations(): BulkOperation[] {
    return this.operationQueue
      .map(id => this.operations.get(id))
      .filter(Boolean) as BulkOperation[];
  }

  // ===========================
  // OPERATION PROCESSOR
  // ===========================

  private async startOperationProcessor(): Promise<void> {
    setInterval(async () => {
      await this.processQueue();
    }, this.options.progressUpdateInterval);
  }

  private async processQueue(): Promise<void> {
    // Process queued operations up to max concurrent limit
    while (
      this.operationQueue.length > 0 &&
      this.activeOperations.size < this.options.maxConcurrentOperations
    ) {
      const operationId = this.operationQueue.shift()!;
      const operation = this.operations.get(operationId);

      if (operation && operation.status === 'pending') {
        this.activeOperations.add(operationId);
        this.executeOperation(operation).catch(error => {
          console.error(`Operation ${operationId} failed:`, error);
        });
      }
    }
  }

  private async executeOperation(operation: BulkOperation): Promise<void> {
    try {
      operation.status = 'in_progress';
      operation.started_at = new Date();
      await this.updateOperationInStorage(operation);

      this.emit('operationStarted', operation);

      // Execute based on operation type
      switch (operation.type) {
        case 'add_tags':
          await this.executeAddTags(operation);
          break;
        case 'remove_tags':
          await this.executeRemoveTags(operation);
          break;
        case 'replace_tags':
          await this.executeReplaceTags(operation);
          break;
        case 'change_category':
          await this.executeChangeCategory(operation);
          break;
        case 'update_entries':
          await this.executeUpdateEntries(operation);
          break;
        case 'delete_entries':
          await this.executeDeleteEntries(operation);
          break;
        case 'archive_entries':
          await this.executeArchiveEntries(operation);
          break;
        case 'duplicate_entries':
          await this.executeDuplicateEntries(operation);
          break;
        case 'export_entries':
          await this.executeExportEntries(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      operation.status = 'completed';
      operation.completed_at = new Date();

      this.emit('operationCompleted', operation);
    } catch (error) {
      operation.status = 'failed';
      operation.completed_at = new Date();
      operation.errors.push({
        entry_id: 'N/A',
        error_message: error.message,
        timestamp: new Date(),
      });

      this.emit('operationFailed', operation, error);
    } finally {
      this.activeOperations.delete(operation.id);
      await this.updateOperationInStorage(operation);

      // Add to history
      this.operationHistory.push({ ...operation });
      if (this.operationHistory.length > this.options.maxHistoryEntries) {
        this.operationHistory.shift();
      }
    }
  }

  // ===========================
  // OPERATION EXECUTORS
  // ===========================

  private async executeAddTags(operation: BulkOperation): Promise<void> {
    const { tags, validation_options } = operation.operation_data;
    const rollbackData: Record<string, string[]> = {};

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          // Get current entry
          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }

          // Store rollback data
          if (this.options.enableRollback) {
            rollbackData[entryId] = [...(entry.tags || [])];
          }

          // Validate and prepare tags
          const validTags = await this.validateTags(tags, validation_options);

          // Add tags (avoiding duplicates if configured)
          const existingTags = entry.tags || [];
          const newTags = validation_options?.skip_duplicates
            ? validTags.filter(tag => !existingTags.includes(tag))
            : validTags;

          const updatedTags = [...existingTags, ...newTags];

          // Update entry
          await this.updateKBEntry(entryId, { tags: updatedTags });

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        // Rate limiting
        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    if (this.options.enableRollback) {
      operation.rollback_data = rollbackData;
      operation.can_rollback = true;
    }
  }

  private async executeRemoveTags(operation: BulkOperation): Promise<void> {
    const { tags } = operation.operation_data;
    const rollbackData: Record<string, string[]> = {};

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }

          // Store rollback data
          if (this.options.enableRollback) {
            rollbackData[entryId] = [...(entry.tags || [])];
          }

          // Remove specified tags
          const updatedTags = (entry.tags || []).filter(tag => !tags.includes(tag));

          await this.updateKBEntry(entryId, { tags: updatedTags });

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    if (this.options.enableRollback) {
      operation.rollback_data = rollbackData;
      operation.can_rollback = true;
    }
  }

  private async executeReplaceTags(operation: BulkOperation): Promise<void> {
    const { tags, validation_options } = operation.operation_data;
    const rollbackData: Record<string, string[]> = {};

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }

          // Store rollback data
          if (this.options.enableRollback) {
            rollbackData[entryId] = [...(entry.tags || [])];
          }

          // Validate new tags
          const validTags = await this.validateTags(tags, validation_options);

          // Replace all tags
          await this.updateKBEntry(entryId, { tags: validTags });

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    if (this.options.enableRollback) {
      operation.rollback_data = rollbackData;
      operation.can_rollback = true;
    }
  }

  private async executeChangeCategory(operation: BulkOperation): Promise<void> {
    const { new_category_id, validation_options } = operation.operation_data;
    const rollbackData: Record<string, string> = {};

    // Validate category
    if (validation_options?.validate_category) {
      await this.validateCategory(new_category_id);
    }

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }

          // Store rollback data
          if (this.options.enableRollback) {
            rollbackData[entryId] = entry.category;
          }

          // Update category
          await this.updateKBEntry(entryId, { category: new_category_id });

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    if (this.options.enableRollback) {
      operation.rollback_data = rollbackData;
      operation.can_rollback = true;
    }
  }

  private async executeUpdateEntries(operation: BulkOperation): Promise<void> {
    const { updates, update_mode, validation_options } = operation.operation_data;
    const rollbackData: Record<string, any> = {};

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }

          // Store rollback data
          if (this.options.enableRollback) {
            rollbackData[entryId] = { ...entry };
          }

          // Prepare updates
          let finalUpdates = updates;
          if (update_mode === 'merge') {
            finalUpdates = { ...entry, ...updates };
          }

          // Validate if required
          if (validation_options?.validate_schema) {
            await this.validateKBEntryUpdate(finalUpdates);
          }

          // Update entry
          await this.updateKBEntry(entryId, finalUpdates);

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          if (!validation_options?.skip_invalid) {
            throw error;
          }

          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    if (this.options.enableRollback) {
      operation.rollback_data = rollbackData;
      operation.can_rollback = true;
    }
  }

  private async executeDeleteEntries(operation: BulkOperation): Promise<void> {
    const { create_backup, force_delete } = operation.operation_data;
    let backupData: Record<string, any> = {};

    if (create_backup) {
      // Create backup of entries before deletion
      for (const entryId of operation.target_entry_ids) {
        const entry = await this.getKBEntry(entryId);
        if (entry) {
          backupData[entryId] = entry;
        }
      }
    }

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          await this.deleteKBEntry(entryId, { force: force_delete });

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    if (create_backup) {
      operation.rollback_data = backupData;
      operation.can_rollback = true;
    }
  }

  private async executeArchiveEntries(operation: BulkOperation): Promise<void> {
    const rollbackData: Record<string, boolean> = {};

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }

          // Store rollback data
          if (this.options.enableRollback) {
            rollbackData[entryId] = entry.archived || false;
          }

          await this.updateKBEntry(entryId, { archived: true });

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    if (this.options.enableRollback) {
      operation.rollback_data = rollbackData;
      operation.can_rollback = true;
    }
  }

  private async executeDuplicateEntries(operation: BulkOperation): Promise<void> {
    const { name_prefix, preserve_metadata } = operation.operation_data;
    const createdEntryIds: string[] = [];

    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);

    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;

          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }

          // Create duplicate
          const duplicateData = {
            ...entry,
            id: undefined, // Let system generate new ID
            title: `${name_prefix}${entry.title}`,
            created_at: undefined,
            updated_at: undefined,
          };

          if (!preserve_metadata) {
            duplicateData.usage_count = 0;
            duplicateData.success_count = 0;
            duplicateData.failure_count = 0;
            duplicateData.last_used = undefined;
          }

          const newEntry = await this.createKBEntry(duplicateData);
          createdEntryIds.push(newEntry.id!);

          operation.progress.completed++;
          this.emit('operationProgress', operation);
        } catch (error) {
          operation.progress.failed++;
          operation.errors.push({
            entry_id: entryId,
            error_message: error.message,
            timestamp: new Date(),
          });
        }

        if (this.options.rateLimitDelay > 0) {
          await this.sleep(this.options.rateLimitDelay);
        }
      }
    }

    // Store created IDs for potential rollback
    if (this.options.enableRollback) {
      operation.rollback_data = { created_entry_ids: createdEntryIds };
      operation.can_rollback = true;
    }
  }

  private async executeExportEntries(operation: BulkOperation): Promise<void> {
    const { format, export_path, include_metadata } = operation.operation_data;
    const exportData: any[] = [];

    for (const entryId of operation.target_entry_ids) {
      try {
        operation.progress.current_item = entryId;

        const entry = await this.getKBEntry(entryId);
        if (!entry) {
          throw new Error('Entry not found');
        }

        const exportEntry = include_metadata
          ? entry
          : {
              title: entry.title,
              problem: entry.problem,
              solution: entry.solution,
              category: entry.category,
              tags: entry.tags,
            };

        exportData.push(exportEntry);

        operation.progress.completed++;
        this.emit('operationProgress', operation);
      } catch (error) {
        operation.progress.failed++;
        operation.errors.push({
          entry_id: entryId,
          error_message: error.message,
          timestamp: new Date(),
        });
      }
    }

    // Write export file
    await this.writeExportFile(export_path, exportData, format);

    // Store export path for reference
    operation.operation_data.final_export_path = export_path;
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private async createBulkOperation(
    type: BulkOperation['type'],
    entryIds: string[],
    operationData: any
  ): Promise<BulkOperation> {
    const operation: BulkOperation = {
      id: this.generateId(),
      type,
      status: 'pending',
      target_entry_ids: entryIds,
      operation_data: operationData,
      created_at: new Date(),
      progress: {
        total: entryIds.length,
        completed: 0,
        failed: 0,
      },
      errors: [],
      can_rollback: false,
    };

    this.operations.set(operation.id, operation);
    await this.saveOperationToStorage(operation);

    return operation;
  }

  private queueOperation(operationId: string): void {
    this.operationQueue.push(operationId);
  }

  private removeFromQueue(operationId: string): void {
    const index = this.operationQueue.indexOf(operationId);
    if (index !== -1) {
      this.operationQueue.splice(index, 1);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async performRollback(operation: BulkOperation): Promise<void> {
    if (!operation.rollback_data) return;

    switch (operation.type) {
      case 'add_tags':
      case 'remove_tags':
      case 'replace_tags':
        for (const [entryId, originalTags] of Object.entries(operation.rollback_data)) {
          await this.updateKBEntry(entryId, { tags: originalTags as string[] });
        }
        break;

      case 'change_category':
        for (const [entryId, originalCategory] of Object.entries(operation.rollback_data)) {
          await this.updateKBEntry(entryId, { category: originalCategory as string });
        }
        break;

      case 'update_entries':
        for (const [entryId, originalData] of Object.entries(operation.rollback_data)) {
          await this.updateKBEntry(entryId, originalData);
        }
        break;

      case 'delete_entries':
        for (const [entryId, entryData] of Object.entries(operation.rollback_data)) {
          await this.createKBEntry({ ...entryData, id: entryId });
        }
        break;

      case 'archive_entries':
        for (const [entryId, wasArchived] of Object.entries(operation.rollback_data)) {
          await this.updateKBEntry(entryId, { archived: wasArchived as boolean });
        }
        break;

      case 'duplicate_entries':
        const createdIds = operation.rollback_data.created_entry_ids as string[];
        for (const entryId of createdIds) {
          await this.deleteKBEntry(entryId, { force: true });
        }
        break;
    }
  }

  private generateId(): string {
    return `bulkop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExportPath(format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `/exports/kb-export-${timestamp}.${format}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Abstract methods to be implemented by concrete storage layer
  protected abstract saveOperationToStorage(operation: BulkOperation): Promise<void>;
  protected abstract updateOperationInStorage(operation: BulkOperation): Promise<void>;
  protected abstract getKBEntry(id: string): Promise<KBEntry | null>;
  protected abstract updateKBEntry(id: string, updates: Partial<KBEntry>): Promise<void>;
  protected abstract createKBEntry(entry: Omit<KBEntry, 'id'>): Promise<KBEntry>;
  protected abstract deleteKBEntry(id: string, options: { force: boolean }): Promise<void>;
  protected abstract validateTags(tags: string[], options: any): Promise<string[]>;
  protected abstract validateCategory(categoryId: string): Promise<void>;
  protected abstract validateKBEntryUpdate(updates: any): Promise<void>;
  protected abstract writeExportFile(path: string, data: any[], format: string): Promise<void>;
}
