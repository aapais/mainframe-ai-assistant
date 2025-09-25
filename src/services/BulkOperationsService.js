'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BulkOperationsService =
  exports.BulkUpdateOperationSchema =
  exports.BulkCategoryOperationSchema =
  exports.BulkTagOperationSchema =
  exports.BulkOperationSchema =
    void 0;
const events_1 = require('events');
const zod_1 = require('zod');
exports.BulkOperationSchema = zod_1.z.object({
  id: zod_1.z.string().uuid(),
  type: zod_1.z.enum([
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
  status: zod_1.z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  target_entry_ids: zod_1.z.array(zod_1.z.string().uuid()),
  operation_data: zod_1.z.record(zod_1.z.any()),
  created_at: zod_1.z.date(),
  started_at: zod_1.z.date().optional(),
  completed_at: zod_1.z.date().optional(),
  created_by: zod_1.z.string().optional(),
  progress: zod_1.z.object({
    total: zod_1.z.number().int().min(0),
    completed: zod_1.z.number().int().min(0),
    failed: zod_1.z.number().int().min(0),
    current_item: zod_1.z.string().optional(),
  }),
  errors: zod_1.z.array(
    zod_1.z.object({
      entry_id: zod_1.z.string().uuid(),
      error_message: zod_1.z.string(),
      error_code: zod_1.z.string().optional(),
      timestamp: zod_1.z.date(),
    })
  ),
  rollback_data: zod_1.z.record(zod_1.z.any()).optional(),
  can_rollback: zod_1.z.boolean().default(false),
});
exports.BulkTagOperationSchema = zod_1.z.object({
  operation_type: zod_1.z.enum(['add', 'remove', 'replace']),
  tags: zod_1.z.array(zod_1.z.string()),
  entry_ids: zod_1.z.array(zod_1.z.string().uuid()),
  validation_options: zod_1.z
    .object({
      validate_tags: zod_1.z.boolean().default(true),
      create_missing_tags: zod_1.z.boolean().default(true),
      skip_duplicates: zod_1.z.boolean().default(true),
    })
    .optional(),
});
exports.BulkCategoryOperationSchema = zod_1.z.object({
  new_category_id: zod_1.z.string().uuid(),
  entry_ids: zod_1.z.array(zod_1.z.string().uuid()),
  preserve_subcategories: zod_1.z.boolean().default(false),
  validation_options: zod_1.z
    .object({
      validate_category: zod_1.z.boolean().default(true),
      allow_system_categories: zod_1.z.boolean().default(true),
    })
    .optional(),
});
exports.BulkUpdateOperationSchema = zod_1.z.object({
  updates: zod_1.z.record(zod_1.z.any()),
  entry_ids: zod_1.z.array(zod_1.z.string().uuid()),
  update_mode: zod_1.z.enum(['merge', 'replace']).default('merge'),
  validation_options: zod_1.z
    .object({
      validate_schema: zod_1.z.boolean().default(true),
      skip_invalid: zod_1.z.boolean().default(true),
      preserve_metadata: zod_1.z.boolean().default(true),
    })
    .optional(),
});
class BulkOperationsService extends events_1.EventEmitter {
  operations = new Map();
  operationQueue = [];
  activeOperations = new Set();
  operationHistory = [];
  options;
  constructor(options = {}) {
    super();
    this.options = {
      maxConcurrentOperations: 3,
      batchSize: 50,
      rateLimitDelay: 100,
      enableRollback: true,
      enableAuditLogging: true,
      maxHistoryEntries: 100,
      progressUpdateInterval: 1000,
      ...options,
    };
    this.startOperationProcessor();
  }
  async addTagsToEntries(operation) {
    const bulkOp = await this.createBulkOperation('add_tags', operation.entry_ids, {
      tags: operation.tags,
      validation_options: operation.validation_options,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async removeTagsFromEntries(operation) {
    const bulkOp = await this.createBulkOperation('remove_tags', operation.entry_ids, {
      tags: operation.tags,
      validation_options: operation.validation_options,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async replaceTagsOnEntries(operation) {
    const bulkOp = await this.createBulkOperation('replace_tags', operation.entry_ids, {
      tags: operation.tags,
      validation_options: operation.validation_options,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async changeCategoryForEntries(operation) {
    const bulkOp = await this.createBulkOperation('change_category', operation.entry_ids, {
      new_category_id: operation.new_category_id,
      preserve_subcategories: operation.preserve_subcategories,
      validation_options: operation.validation_options,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async updateEntries(operation) {
    const bulkOp = await this.createBulkOperation('update_entries', operation.entry_ids, {
      updates: operation.updates,
      update_mode: operation.update_mode,
      validation_options: operation.validation_options,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async deleteEntries(entryIds, options = {}) {
    const bulkOp = await this.createBulkOperation('delete_entries', entryIds, {
      create_backup: options.createBackup ?? true,
      force_delete: options.forceDelete ?? false,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async archiveEntries(entryIds) {
    const bulkOp = await this.createBulkOperation('archive_entries', entryIds, {});
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async duplicateEntries(entryIds, options = {}) {
    const bulkOp = await this.createBulkOperation('duplicate_entries', entryIds, {
      name_prefix: options.namePrefix ?? 'Copy of ',
      preserve_metadata: options.preserveMetadata ?? false,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  async exportEntries(entryIds, format = 'json') {
    const bulkOp = await this.createBulkOperation('export_entries', entryIds, {
      format,
      export_path: this.generateExportPath(format),
      include_metadata: true,
    });
    this.queueOperation(bulkOp.id);
    return bulkOp.id;
  }
  getOperationStatus(operationId) {
    return this.operations.get(operationId) || null;
  }
  async cancelOperation(operationId) {
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
  async rollbackOperation(operationId) {
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
  getOperationHistory(limit = 50) {
    return this.operationHistory
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }
  getActiveOperations() {
    return Array.from(this.activeOperations)
      .map(id => this.operations.get(id))
      .filter(Boolean);
  }
  getQueuedOperations() {
    return this.operationQueue.map(id => this.operations.get(id)).filter(Boolean);
  }
  async startOperationProcessor() {
    setInterval(async () => {
      await this.processQueue();
    }, this.options.progressUpdateInterval);
  }
  async processQueue() {
    while (
      this.operationQueue.length > 0 &&
      this.activeOperations.size < this.options.maxConcurrentOperations
    ) {
      const operationId = this.operationQueue.shift();
      const operation = this.operations.get(operationId);
      if (operation && operation.status === 'pending') {
        this.activeOperations.add(operationId);
        this.executeOperation(operation).catch(error => {
          console.error(`Operation ${operationId} failed:`, error);
        });
      }
    }
  }
  async executeOperation(operation) {
    try {
      operation.status = 'in_progress';
      operation.started_at = new Date();
      await this.updateOperationInStorage(operation);
      this.emit('operationStarted', operation);
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
      this.operationHistory.push({ ...operation });
      if (this.operationHistory.length > this.options.maxHistoryEntries) {
        this.operationHistory.shift();
      }
    }
  }
  async executeAddTags(operation) {
    const { tags, validation_options } = operation.operation_data;
    const rollbackData = {};
    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;
          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }
          if (this.options.enableRollback) {
            rollbackData[entryId] = [...(entry.tags || [])];
          }
          const validTags = await this.validateTags(tags, validation_options);
          const existingTags = entry.tags || [];
          const newTags = validation_options?.skip_duplicates
            ? validTags.filter(tag => !existingTags.includes(tag))
            : validTags;
          const updatedTags = [...existingTags, ...newTags];
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
  async executeRemoveTags(operation) {
    const { tags } = operation.operation_data;
    const rollbackData = {};
    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);
    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;
          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }
          if (this.options.enableRollback) {
            rollbackData[entryId] = [...(entry.tags || [])];
          }
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
  async executeReplaceTags(operation) {
    const { tags, validation_options } = operation.operation_data;
    const rollbackData = {};
    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);
    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;
          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }
          if (this.options.enableRollback) {
            rollbackData[entryId] = [...(entry.tags || [])];
          }
          const validTags = await this.validateTags(tags, validation_options);
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
  async executeChangeCategory(operation) {
    const { new_category_id, validation_options } = operation.operation_data;
    const rollbackData = {};
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
          if (this.options.enableRollback) {
            rollbackData[entryId] = entry.category;
          }
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
  async executeUpdateEntries(operation) {
    const { updates, update_mode, validation_options } = operation.operation_data;
    const rollbackData = {};
    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);
    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;
          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }
          if (this.options.enableRollback) {
            rollbackData[entryId] = { ...entry };
          }
          let finalUpdates = updates;
          if (update_mode === 'merge') {
            finalUpdates = { ...entry, ...updates };
          }
          if (validation_options?.validate_schema) {
            await this.validateKBEntryUpdate(finalUpdates);
          }
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
  async executeDeleteEntries(operation) {
    const { create_backup, force_delete } = operation.operation_data;
    const backupData = {};
    if (create_backup) {
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
  async executeArchiveEntries(operation) {
    const rollbackData = {};
    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);
    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;
          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }
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
  async executeDuplicateEntries(operation) {
    const { name_prefix, preserve_metadata } = operation.operation_data;
    const createdEntryIds = [];
    const batches = this.createBatches(operation.target_entry_ids, this.options.batchSize);
    for (const batch of batches) {
      for (const entryId of batch) {
        try {
          operation.progress.current_item = entryId;
          const entry = await this.getKBEntry(entryId);
          if (!entry) {
            throw new Error('Entry not found');
          }
          const duplicateData = {
            ...entry,
            id: undefined,
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
          createdEntryIds.push(newEntry.id);
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
      operation.rollback_data = { created_entry_ids: createdEntryIds };
      operation.can_rollback = true;
    }
  }
  async executeExportEntries(operation) {
    const { format, export_path, include_metadata } = operation.operation_data;
    const exportData = [];
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
    await this.writeExportFile(export_path, exportData, format);
    operation.operation_data.final_export_path = export_path;
  }
  async createBulkOperation(type, entryIds, operationData) {
    const operation = {
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
  queueOperation(operationId) {
    this.operationQueue.push(operationId);
  }
  removeFromQueue(operationId) {
    const index = this.operationQueue.indexOf(operationId);
    if (index !== -1) {
      this.operationQueue.splice(index, 1);
    }
  }
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  async performRollback(operation) {
    if (!operation.rollback_data) return;
    switch (operation.type) {
      case 'add_tags':
      case 'remove_tags':
      case 'replace_tags':
        for (const [entryId, originalTags] of Object.entries(operation.rollback_data)) {
          await this.updateKBEntry(entryId, { tags: originalTags });
        }
        break;
      case 'change_category':
        for (const [entryId, originalCategory] of Object.entries(operation.rollback_data)) {
          await this.updateKBEntry(entryId, { category: originalCategory });
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
          await this.updateKBEntry(entryId, { archived: wasArchived });
        }
        break;
      case 'duplicate_entries':
        const createdIds = operation.rollback_data.created_entry_ids;
        for (const entryId of createdIds) {
          await this.deleteKBEntry(entryId, { force: true });
        }
        break;
    }
  }
  generateId() {
    return `bulkop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  generateExportPath(format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `/exports/kb-export-${timestamp}.${format}`;
  }
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
exports.BulkOperationsService = BulkOperationsService;
//# sourceMappingURL=BulkOperationsService.js.map
