'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BatchOperationsService = void 0;
const events_1 = require('events');
class BatchOperationsService extends events_1.EventEmitter {
  db;
  activeOperations = new Map();
  constructor(db) {
    super();
    this.db = db;
  }
  async batchUpdate(entryIds, updates, options = {}) {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);
    try {
      return await this.executeBatchOperation(
        operationId,
        'update',
        entryIds,
        async entry => {
          const updateData = typeof updates === 'function' ? updates(entry) : updates;
          await this.db.updateEntry(entry.id, updateData);
          return { ...entry, ...updateData };
        },
        options
      );
    } finally {
      this.activeOperations.delete(operationId);
    }
  }
  async batchDelete(entryIds, options = {}) {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);
    try {
      const backupPath = await this.createOperationBackup(entryIds, 'delete');
      const result = await this.executeBatchOperation(
        operationId,
        'delete',
        entryIds,
        async entry => {
          await this.db.updateEntry(entry.id, { archived: true });
        },
        { ...options, validateBeforeProcessing: false }
      );
      if (!result.success && backupPath) {
        await this.restoreFromBackup(backupPath, entryIds);
        result.rolledBack = entryIds.filter(
          id => !result.results.find(r => r.id === id && r.success)
        );
      }
      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }
  async batchDuplicate(entryIds, options = {}) {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);
    try {
      return await this.executeBatchOperation(
        operationId,
        'duplicate',
        entryIds,
        async entry => {
          const duplicatedEntry = {
            ...entry,
            id: undefined,
            title: `${entry.title} (Copy)`,
            created_at: new Date(),
            updated_at: new Date(),
            usage_count: 0,
            success_count: 0,
            failure_count: 0,
            last_used: undefined,
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
  async batchExport(entryIds, format = 'json', options = {}) {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);
    try {
      const entries = [];
      const result = await this.executeBatchOperation(
        operationId,
        'export',
        entryIds,
        async entry => {
          entries.push(entry);
          return this.formatEntry(entry, format);
        },
        options
      );
      if (result.success) {
        const exportData = this.combineExportData(
          result.results.map(r => r.data).filter(Boolean),
          format
        );
        return {
          ...result,
          results: [
            {
              id: 'combined',
              success: true,
              data: exportData,
            },
          ],
        };
      }
      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }
  async batchImport(data, format = 'json', options = {}) {
    const operationId = this.generateOperationId();
    const abortController = new AbortController();
    this.activeOperations.set(operationId, abortController);
    try {
      const entries = await this.parseImportData(data, format);
      const entryIds = entries.map((entry, index) => entry.id || `import-${index}`);
      if (!options.skipValidation) {
        const validationResult = await this.validateBatch(entries);
        if (!validationResult.isValid) {
          throw new Error(
            `Import validation failed: ${validationResult.validationErrors.length} errors found`
          );
        }
      }
      return await this.executeBatchOperation(
        operationId,
        'import',
        entryIds,
        async (entry, index) => {
          const importEntry = entries[index];
          if (options.mergeDuplicates) {
            const existingEntries = await this.db.search(importEntry.title, { limit: 5 });
            const duplicate = existingEntries.find(
              result => this.calculateSimilarity(result.entry, importEntry) > 0.85
            );
            if (duplicate) {
              await this.db.updateEntry(duplicate.entry.id, importEntry);
              return { ...duplicate.entry, ...importEntry };
            }
          }
          const newId = await this.db.addEntry(importEntry);
          return { ...importEntry, id: newId };
        },
        options
      );
    } finally {
      this.activeOperations.delete(operationId);
    }
  }
  async validateBatch(entries) {
    const validationErrors = [];
    const duplicates = [];
    const conflicts = [];
    for (const entry of entries) {
      const errors = [];
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
      if (entry.title && entry.title.length > 200) {
        errors.push('Title must be less than 200 characters');
      }
      if (entry.problem && entry.problem.length > 2000) {
        errors.push('Problem description must be less than 2000 characters');
      }
      if (entry.solution && entry.solution.length > 5000) {
        errors.push('Solution must be less than 5000 characters');
      }
      if (entry.tags && entry.tags.length > 10) {
        errors.push('Maximum 10 tags allowed');
      }
      if (errors.length > 0) {
        validationErrors.push({
          id: entry.id || 'unknown',
          errors,
        });
      }
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const similarity = this.calculateSimilarity(entries[i], entries[j]);
        if (similarity > 0.85) {
          duplicates.push({
            id: entries[j].id || `entry-${j}`,
            duplicateOf: entries[i].id || `entry-${i}`,
            similarity,
          });
        }
      }
    }
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
              details: 'Entry has been modified by another user',
            });
          }
        }
      }
    }
    return {
      isValid: validationErrors.length === 0,
      validationErrors,
      duplicates,
      conflicts,
    };
  }
  async cancelOperation(operationId) {
    const controller = this.activeOperations.get(operationId);
    if (controller) {
      controller.abort();
      this.activeOperations.delete(operationId);
      this.emit('operationCancelled', { operationId });
      return true;
    }
    return false;
  }
  getActiveOperations() {
    return Array.from(this.activeOperations.keys());
  }
  async executeBatchOperation(operationId, operationType, entryIds, operation, options) {
    const startTime = Date.now();
    const {
      batchSize = 10,
      continueOnError = true,
      timeout = 300000,
      validateBeforeProcessing = true,
    } = options;
    const progress = {
      total: entryIds.length,
      processed: 0,
      successful: 0,
      failed: 0,
      percentComplete: 0,
    };
    const results = [];
    try {
      const entries = [];
      for (const id of entryIds) {
        const entry = await this.db.getEntry(id);
        if (!entry) {
          results.push({
            id,
            success: false,
            error: 'Entry not found',
          });
          progress.failed++;
        } else {
          entries.push(entry);
        }
      }
      if (validateBeforeProcessing && entries.length > 0) {
        const validationResult = await this.validateBatch(entries);
        if (!validationResult.isValid) {
          throw new Error(
            `Validation failed: ${validationResult.validationErrors.length} errors found`
          );
        }
      }
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
              this.createTimeoutPromise(timeout),
            ]);
            progress.successful++;
            progress.processed++;
            progress.percentComplete = Math.round((progress.processed / progress.total) * 100);
            const elapsed = Date.now() - startTime;
            const rate = progress.processed / elapsed;
            progress.estimatedTimeRemaining = Math.round(
              (progress.total - progress.processed) / rate
            );
            return {
              id: entry.id,
              success: true,
              data: result,
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
              id: entry.id,
              success: false,
              error: errorMessage,
            };
          }
        });
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        const controller = this.activeOperations.get(operationId);
        if (controller?.signal.aborted) {
          throw new Error('Operation was cancelled');
        }
        this.emit('progress', { operationId, progress });
      }
      const duration = Date.now() - startTime;
      const success = progress.failed === 0;
      this.emit('operationComplete', {
        operationId,
        operationType,
        success,
        duration,
        progress,
      });
      return {
        success,
        progress,
        results,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('operationError', {
        operationId,
        operationType,
        error: errorMessage,
        duration,
        progress,
      });
      return {
        success: false,
        progress,
        results,
        error: errorMessage,
        duration,
      };
    }
  }
  generateOperationId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  async createTimeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeout);
    });
  }
  async createOperationBackup(entryIds, operation) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `backup_${operation}_${timestamp}.json`;
    const entries = [];
    for (const id of entryIds) {
      const entry = await this.db.getEntry(id);
      if (entry) {
        entries.push(entry);
      }
    }
    await this.db.exportToJSON(backupPath);
    return backupPath;
  }
  async restoreFromBackup(backupPath, entryIds) {
    try {
      await this.db.importFromJSON(backupPath, true);
    } catch (error) {
      console.error('Failed to restore from backup:', error);
    }
  }
  calculateSimilarity(entry1, entry2) {
    const text1 = `${entry1.title} ${entry1.problem}`.toLowerCase();
    const text2 = `${entry2.title} ${entry2.problem}`.toLowerCase();
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }
  formatEntry(entry, format) {
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
          entry.failure_count || 0,
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
  combineExportData(exportedItems, format) {
    switch (format) {
      case 'json':
        return `[\n${exportedItems.join(',\n')}\n]`;
      case 'csv':
        const header =
          'id,title,problem,solution,category,tags,created,usage_count,success_count,failure_count';
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
  async parseImportData(data, format) {
    switch (format) {
      case 'json':
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [parsed];
      case 'csv':
        const lines = data.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const entries = [];
        for (let i = 1; i < lines.length; i++) {
          const values = this.parseCSVLine(lines[i]);
          const entry = {};
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
            }
          });
          if (entry.title && entry.problem && entry.solution) {
            entries.push(entry);
          }
        }
        return entries;
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
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
exports.BatchOperationsService = BatchOperationsService;
exports.default = BatchOperationsService;
//# sourceMappingURL=BatchOperationsService.js.map
