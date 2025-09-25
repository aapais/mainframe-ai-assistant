'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.KnowledgeBaseService = void 0;
const tslib_1 = require('tslib');
const better_sqlite3_1 = tslib_1.__importDefault(require('better-sqlite3'));
const events_1 = require('events');
const uuid_1 = require('uuid');
const promises_1 = tslib_1.__importDefault(require('fs/promises'));
const path_1 = tslib_1.__importDefault(require('path'));
const services_1 = require('../types/services');
class KnowledgeBaseService extends events_1.EventEmitter {
  config;
  validationService;
  searchService;
  cacheService;
  metricsService;
  importExportService;
  db;
  isInitialized = false;
  transactions = new Map();
  startTime = Date.now();
  statements;
  constructor(
    config = services_1.DEFAULT_SERVICE_CONFIG,
    validationService,
    searchService,
    cacheService,
    metricsService,
    importExportService
  ) {
    super();
    this.config = config;
    this.validationService = validationService;
    this.searchService = searchService;
    this.cacheService = cacheService;
    this.metricsService = metricsService;
    this.importExportService = importExportService;
    this.setMaxListeners(50);
  }
  async initialize() {
    try {
      await this.initializeDatabase();
      await this.prepareStatements();
      await this.initializeDependentServices();
      await this.setupPeriodicTasks();
      this.isInitialized = true;
      this.emit('service:initialized', { timestamp: new Date() });
      console.info('KnowledgeBaseService initialized successfully');
    } catch (error) {
      const serviceError = new services_1.DatabaseError(
        'Failed to initialize KnowledgeBaseService',
        'initialize',
        { originalError: error }
      );
      this.emit('error:occurred', serviceError);
      throw serviceError;
    }
  }
  async create(entry) {
    this.ensureInitialized();
    if (this.validationService) {
      const validation = this.validationService.validateEntry(entry);
      if (!validation.valid) {
        throw new services_1.ValidationError(
          `Entry validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors[0]?.field || 'unknown'
        );
      }
    }
    const id = (0, uuid_1.v4)();
    const now = new Date();
    const transaction = this.db.transaction(() => {
      try {
        this.statements.insertEntry.run(
          id,
          entry.title,
          entry.problem,
          entry.solution,
          entry.category,
          now.toISOString(),
          now.toISOString(),
          entry.created_by || 'system',
          0,
          0,
          0,
          1
        );
        if (entry.tags && entry.tags.length > 0) {
          this.statements.deleteTagsForEntry.run(id);
          entry.tags.forEach(tag => {
            this.statements.insertTag.run(id, tag.toLowerCase().trim(), 1.0);
          });
        }
        this.updateFTSIndex(id, entry);
        return id;
      } catch (error) {
        throw new services_1.DatabaseError(`Failed to create entry: ${error.message}`, 'create', {
          entry,
          originalError: error,
        });
      }
    });
    const result = transaction();
    const createdEntry = await this.read(id);
    if (createdEntry) {
      this.emit('entry:created', createdEntry);
      if (this.metricsService) {
        await this.metricsService.recordUsage(id, 'create');
      }
      if (this.cacheService) {
        await this.cacheService.delete(`entry:${id}`);
      }
    }
    return id;
  }
  async createBatch(entries) {
    this.ensureInitialized();
    if (entries.length === 0) {
      return [];
    }
    if (this.validationService) {
      const validations = this.validationService.validateBatch(entries);
      const invalidEntries = validations.filter(v => !v.valid);
      if (invalidEntries.length > 0) {
        throw new services_1.ValidationError(
          `Batch validation failed for ${invalidEntries.length} entries`,
          'batch'
        );
      }
    }
    const ids = [];
    const now = new Date();
    const transaction = this.db.transaction(() => {
      entries.forEach(entry => {
        const id = (0, uuid_1.v4)();
        ids.push(id);
        this.statements.insertEntry.run(
          id,
          entry.title,
          entry.problem,
          entry.solution,
          entry.category,
          now.toISOString(),
          now.toISOString(),
          entry.created_by || 'system',
          0,
          0,
          0,
          1
        );
        if (entry.tags && entry.tags.length > 0) {
          entry.tags.forEach(tag => {
            this.statements.insertTag.run(id, tag.toLowerCase().trim(), 1.0);
          });
        }
        this.updateFTSIndex(id, entry);
      });
    });
    transaction();
    const createdEntries = await this.readBatch(ids);
    this.emit('entries:batch-created', createdEntries);
    if (this.metricsService) {
      await Promise.all(ids.map(id => this.metricsService.recordUsage(id, 'create')));
    }
    return ids;
  }
  async read(id) {
    this.ensureInitialized();
    if (this.cacheService) {
      const cached = await this.cacheService.get(`entry:${id}`);
      if (cached) {
        this.emit('cache:hit', `entry:${id}`);
        return cached;
      }
      this.emit('cache:miss', `entry:${id}`);
    }
    try {
      const row = this.statements.selectEntry.get(id);
      if (!row) {
        return null;
      }
      const entry = this.mapDBEntryToKBEntry(row);
      const tags = this.db
        .prepare(
          `
        SELECT tag FROM kb_tags WHERE entry_id = ? ORDER BY weight DESC, tag ASC
      `
        )
        .all(id);
      entry.tags = tags.map(t => t.tag);
      if (this.cacheService) {
        await this.cacheService.set(`entry:${id}`, entry, this.config.cache.ttl);
      }
      return entry;
    } catch (error) {
      throw new services_1.DatabaseError(`Failed to read entry ${id}: ${error.message}`, 'read', {
        id,
        originalError: error,
      });
    }
  }
  async readBatch(ids) {
    this.ensureInitialized();
    if (ids.length === 0) {
      return [];
    }
    const results = [];
    const missingIds = [];
    if (this.cacheService) {
      const cacheKeys = ids.map(id => `entry:${id}`);
      const cachedEntries = await this.cacheService.mget(cacheKeys);
      for (let i = 0; i < ids.length; i++) {
        if (cachedEntries[i]) {
          results.push(cachedEntries[i]);
          this.emit('cache:hit', `entry:${ids[i]}`);
        } else {
          missingIds.push(ids[i]);
          this.emit('cache:miss', `entry:${ids[i]}`);
        }
      }
    } else {
      missingIds.push(...ids);
    }
    if (missingIds.length > 0) {
      const placeholders = missingIds.map(() => '?').join(',');
      const query = `
        SELECT * FROM kb_entries 
        WHERE id IN (${placeholders})
        ORDER BY created_at DESC
      `;
      const rows = this.db.prepare(query).all(...missingIds);
      const dbEntries = rows.map(row => this.mapDBEntryToKBEntry(row));
      if (dbEntries.length > 0) {
        const tagQuery = `
          SELECT entry_id, tag FROM kb_tags 
          WHERE entry_id IN (${placeholders})
          ORDER BY weight DESC, tag ASC
        `;
        const tagRows = this.db.prepare(tagQuery).all(...missingIds);
        const tagsByEntry = new Map();
        tagRows.forEach(row => {
          if (!tagsByEntry.has(row.entry_id)) {
            tagsByEntry.set(row.entry_id, []);
          }
          tagsByEntry.get(row.entry_id).push(row.tag);
        });
        dbEntries.forEach(entry => {
          entry.tags = tagsByEntry.get(entry.id) || [];
        });
        if (this.cacheService) {
          const cacheItems = dbEntries.map(entry => ({
            key: `entry:${entry.id}`,
            value: entry,
            ttl: this.config.cache.ttl,
          }));
          await this.cacheService.mset(cacheItems);
        }
      }
      results.push(...dbEntries);
    }
    const sortedResults = ids.map(id => results.find(entry => entry.id === id)).filter(Boolean);
    return sortedResults;
  }
  async update(id, updates) {
    this.ensureInitialized();
    if (this.validationService) {
      const validation = this.validationService.validateUpdate(updates);
      if (!validation.valid) {
        throw new services_1.ValidationError(
          `Update validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors[0]?.field || 'unknown'
        );
      }
    }
    const currentEntry = await this.read(id);
    if (!currentEntry) {
      return false;
    }
    const now = new Date();
    const newVersion = currentEntry.version + 1;
    const transaction = this.db.transaction(() => {
      try {
        const updateFields = [];
        const updateValues = [];
        if (updates.title !== undefined) {
          updateFields.push('title = ?');
          updateValues.push(updates.title);
        }
        if (updates.problem !== undefined) {
          updateFields.push('problem = ?');
          updateValues.push(updates.problem);
        }
        if (updates.solution !== undefined) {
          updateFields.push('solution = ?');
          updateValues.push(updates.solution);
        }
        if (updates.category !== undefined) {
          updateFields.push('category = ?');
          updateValues.push(updates.category);
        }
        updateFields.push('updated_at = ?', 'version = ?');
        updateValues.push(now.toISOString(), newVersion);
        if (updates.updated_by) {
          updateFields.push('updated_by = ?');
          updateValues.push(updates.updated_by);
        }
        const updateQuery = `
          UPDATE kb_entries 
          SET ${updateFields.join(', ')} 
          WHERE id = ?
        `;
        updateValues.push(id);
        const result = this.db.prepare(updateQuery).run(...updateValues);
        if (result.changes === 0) {
          return false;
        }
        if (updates.tags !== undefined) {
          this.statements.deleteTagsForEntry.run(id);
          if (updates.tags.length > 0) {
            updates.tags.forEach(tag => {
              this.statements.insertTag.run(id, tag.toLowerCase().trim(), 1.0);
            });
          }
        }
        const updatedEntry = { ...currentEntry, ...updates };
        this.updateFTSIndex(id, updatedEntry);
        return true;
      } catch (error) {
        throw new services_1.DatabaseError(
          `Failed to update entry ${id}: ${error.message}`,
          'update',
          { id, updates, originalError: error }
        );
      }
    });
    const success = transaction();
    if (success) {
      if (this.cacheService) {
        await this.cacheService.delete(`entry:${id}`);
      }
      const updatedEntry = await this.read(id);
      if (updatedEntry) {
        this.emit('entry:updated', updatedEntry, updates);
        if (this.metricsService) {
          await this.metricsService.recordUsage(id, 'update');
        }
      }
    }
    return success;
  }
  async updateBatch(updates) {
    this.ensureInitialized();
    if (updates.length === 0) {
      return [];
    }
    const results = [];
    const now = new Date();
    const transaction = this.db.transaction(() => {
      updates.forEach(({ id, updates: entryUpdates }) => {
        try {
          const exists = this.statements.selectEntry.get(id);
          if (!exists) {
            results.push(false);
            return;
          }
          const updateFields = [];
          const updateValues = [];
          Object.entries(entryUpdates).forEach(([key, value]) => {
            if (value !== undefined && key !== 'tags' && key !== 'updated_by') {
              updateFields.push(`${key} = ?`);
              updateValues.push(value);
            }
          });
          if (entryUpdates.updated_by) {
            updateFields.push('updated_by = ?');
            updateValues.push(entryUpdates.updated_by);
          }
          updateFields.push('updated_at = ?', 'version = version + 1');
          updateValues.push(now.toISOString(), id);
          const updateQuery = `
            UPDATE kb_entries 
            SET ${updateFields.join(', ')} 
            WHERE id = ?
          `;
          const result = this.db.prepare(updateQuery).run(...updateValues);
          if (entryUpdates.tags !== undefined) {
            this.statements.deleteTagsForEntry.run(id);
            if (entryUpdates.tags.length > 0) {
              entryUpdates.tags.forEach(tag => {
                this.statements.insertTag.run(id, tag.toLowerCase().trim(), 1.0);
              });
            }
          }
          results.push(result.changes > 0);
        } catch (error) {
          console.error(`Failed to update entry ${id}:`, error);
          results.push(false);
        }
      });
    });
    transaction();
    if (this.cacheService) {
      const cacheKeys = updates.map(u => `entry:${u.id}`);
      await Promise.all(cacheKeys.map(key => this.cacheService.delete(key)));
    }
    const successfulUpdates = updates.filter((_, index) => results[index]);
    if (successfulUpdates.length > 0) {
      const updatedEntries = await this.readBatch(successfulUpdates.map(u => u.id));
      this.emit(
        'entries:batch-updated',
        successfulUpdates.map((u, i) => ({
          id: u.id,
          entry: updatedEntries[i],
          changes: u.updates,
        }))
      );
      if (this.metricsService) {
        await Promise.all(
          successfulUpdates.map(u => this.metricsService.recordUsage(u.id, 'update'))
        );
      }
    }
    return results;
  }
  async delete(id) {
    this.ensureInitialized();
    const transaction = this.db.transaction(() => {
      try {
        this.db
          .prepare('DELETE FROM kb_fts WHERE rowid = (SELECT rowid FROM kb_entries WHERE id = ?)')
          .run(id);
        this.statements.deleteTagsForEntry.run(id);
        const result = this.statements.deleteEntry.run(id);
        return result.changes > 0;
      } catch (error) {
        throw new services_1.DatabaseError(
          `Failed to delete entry ${id}: ${error.message}`,
          'delete',
          { id, originalError: error }
        );
      }
    });
    const success = transaction();
    if (success) {
      if (this.cacheService) {
        await this.cacheService.delete(`entry:${id}`);
      }
      this.emit('entry:deleted', id);
      if (this.metricsService) {
        await this.metricsService.recordUsage(id, 'delete');
      }
    }
    return success;
  }
  async deleteBatch(ids) {
    this.ensureInitialized();
    if (ids.length === 0) {
      return [];
    }
    const results = [];
    const transaction = this.db.transaction(() => {
      ids.forEach(id => {
        try {
          this.db
            .prepare('DELETE FROM kb_fts WHERE rowid = (SELECT rowid FROM kb_entries WHERE id = ?)')
            .run(id);
          this.statements.deleteTagsForEntry.run(id);
          const result = this.statements.deleteEntry.run(id);
          results.push(result.changes > 0);
        } catch (error) {
          console.error(`Failed to delete entry ${id}:`, error);
          results.push(false);
        }
      });
    });
    transaction();
    if (this.cacheService) {
      const cacheKeys = ids.map(id => `entry:${id}`);
      await Promise.all(cacheKeys.map(key => this.cacheService.delete(key)));
    }
    const successfulDeletions = ids.filter((_, index) => results[index]);
    if (successfulDeletions.length > 0) {
      this.emit('entries:batch-deleted', successfulDeletions);
      if (this.metricsService) {
        await Promise.all(
          successfulDeletions.map(id => this.metricsService.recordUsage(id, 'delete'))
        );
      }
    }
    return results;
  }
  async list(options = {}) {
    this.ensureInitialized();
    const {
      limit = 50,
      offset = 0,
      category,
      sortBy = 'created_at',
      sortOrder = 'desc',
      includeMetrics = false,
      filters = {},
    } = options;
    const conditions = [];
    const params = [];
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (filters.createdAfter) {
      conditions.push('created_at >= ?');
      params.push(filters.createdAfter.toISOString());
    }
    if (filters.createdBefore) {
      conditions.push('created_at <= ?');
      params.push(filters.createdBefore.toISOString());
    }
    if (filters.minUsage) {
      conditions.push('usage_count >= ?');
      params.push(filters.minUsage);
    }
    if (filters.minSuccessRate) {
      conditions.push(
        'CASE WHEN (success_count + failure_count) = 0 THEN 0 ELSE CAST(success_count AS REAL) / (success_count + failure_count) END >= ?'
      );
      params.push(filters.minSuccessRate);
    }
    if (filters.createdBy) {
      conditions.push('created_by = ?');
      params.push(filters.createdBy);
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagPlaceholders = filters.tags.map(() => '?').join(',');
      conditions.push(
        `id IN (SELECT DISTINCT entry_id FROM kb_tags WHERE tag IN (${tagPlaceholders}))`
      );
      params.push(...filters.tags);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const validSortFields = ['created_at', 'updated_at', 'usage_count', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    let orderByClause = `ORDER BY ${sortField} ${order}`;
    if (sortBy === 'success_rate') {
      orderByClause = `ORDER BY CASE WHEN (success_count + failure_count) = 0 THEN 0 ELSE CAST(success_count AS REAL) / (success_count + failure_count) END ${order}`;
    }
    try {
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM kb_entries 
        ${whereClause}
      `;
      const { total } = this.db.prepare(countQuery).get(...params);
      const query = `
        SELECT * FROM kb_entries 
        ${whereClause} 
        ${orderByClause} 
        LIMIT ? OFFSET ?
      `;
      const rows = this.db.prepare(query).all(...params, limit, offset);
      const entries = rows.map(row => this.mapDBEntryToKBEntry(row));
      if (entries.length > 0) {
        const entryIds = entries.map(e => e.id);
        const placeholders = entryIds.map(() => '?').join(',');
        const tagQuery = `
          SELECT entry_id, tag FROM kb_tags 
          WHERE entry_id IN (${placeholders})
          ORDER BY weight DESC, tag ASC
        `;
        const tagRows = this.db.prepare(tagQuery).all(...entryIds);
        const tagsByEntry = new Map();
        tagRows.forEach(row => {
          if (!tagsByEntry.has(row.entry_id)) {
            tagsByEntry.set(row.entry_id, []);
          }
          tagsByEntry.get(row.entry_id).push(row.tag);
        });
        entries.forEach(entry => {
          entry.tags = tagsByEntry.get(entry.id) || [];
        });
      }
      return {
        data: entries,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        nextOffset: offset + limit < total ? offset + limit : undefined,
        previousOffset: offset > 0 ? Math.max(0, offset - limit) : undefined,
      };
    } catch (error) {
      throw new services_1.DatabaseError(`Failed to list entries: ${error.message}`, 'list', {
        options,
        originalError: error,
      });
    }
  }
  async search(query, options = {}) {
    this.ensureInitialized();
    if (!this.searchService) {
      throw new services_1.ServiceError('Search service not configured', 'SEARCH_SERVICE_MISSING');
    }
    const startTime = Date.now();
    try {
      const allEntries = await this.getAllEntriesForSearch(options);
      const results = await this.searchService.search(query, allEntries, options);
      const searchTime = Date.now() - startTime;
      if (this.metricsService) {
        const searchQuery = {
          text: query,
          options,
          timestamp: new Date(),
          user_id: options.userId,
          session_id: options.sessionId,
        };
        await this.metricsService.recordSearch(searchQuery, results);
        await this.metricsService.recordPerformance('search', searchTime, {
          query,
          resultCount: results.length,
        });
      }
      this.emit('search:performed', { text: query, options, timestamp: new Date() }, results);
      return results;
    } catch (error) {
      const searchError = new services_1.ServiceError(
        `Search failed: ${error.message}`,
        'SEARCH_FAILED',
        500,
        { query, options, originalError: error }
      );
      this.emit('error:occurred', searchError);
      throw searchError;
    }
  }
  async recordUsage(id, successful, userId) {
    this.ensureInitialized();
    try {
      const successIncrement = successful ? 1 : 0;
      const failureIncrement = successful ? 0 : 1;
      this.statements.updateUsageStats.run(successIncrement, failureIncrement, id);
      if (this.cacheService) {
        await this.cacheService.delete(`entry:${id}`);
      }
      if (this.metricsService) {
        const action = successful ? 'rate_success' : 'rate_failure';
        await this.metricsService.recordUsage(id, action, userId);
      }
      this.emit('usage:recorded', id, successful ? 'rate_success' : 'rate_failure', userId);
    } catch (error) {
      throw new services_1.DatabaseError(
        `Failed to record usage for entry ${id}: ${error.message}`,
        'recordUsage',
        { id, successful, userId, originalError: error }
      );
    }
  }
  async getMetrics() {
    this.ensureInitialized();
    if (this.metricsService) {
      return await this.metricsService.getMetrics();
    }
    try {
      const overview = this.db
        .prepare(
          `
        SELECT 
          COUNT(*) as totalEntries,
          AVG(CASE WHEN (success_count + failure_count) = 0 THEN 0 ELSE CAST(success_count AS REAL) / (success_count + failure_count) END) as averageSuccessRate,
          SUM(usage_count) as totalUsage
        FROM kb_entries
      `
        )
        .get();
      const categories = this.db
        .prepare(
          `
        SELECT 
          category,
          COUNT(*) as count,
          SUM(usage_count) as usage,
          AVG(CASE WHEN (success_count + failure_count) = 0 THEN 0 ELSE CAST(success_count AS REAL) / (success_count + failure_count) END) as successRate
        FROM kb_entries
        GROUP BY category
        ORDER BY count DESC
      `
        )
        .all();
      return {
        overview: {
          totalEntries: overview.totalEntries || 0,
          totalSearches: 0,
          averageSuccessRate: overview.averageSuccessRate || 0,
          totalUsage: overview.totalUsage || 0,
          activeUsers: 0,
          uptime: Date.now() - this.startTime,
        },
        categories: categories.map(cat => ({
          category: cat.category,
          count: cat.count,
          usage: cat.usage || 0,
          successRate: cat.successRate || 0,
          averageScore: 0,
          trend: 0,
          lastUpdated: new Date(),
        })),
        searches: {
          totalSearches: 0,
          uniqueQueries: 0,
          averageResultCount: 0,
          averageResponseTime: 0,
          noResultQueries: [],
          popularQueries: [],
          searchTypes: {
            exact: 0,
            fuzzy: 0,
            semantic: 0,
            category: 0,
            tag: 0,
            ai: 0,
          },
          aiUsage: {
            totalRequests: 0,
            successRate: 0,
            averageLatency: 0,
            fallbackRate: 0,
          },
        },
        usage: {
          totalViews: 0,
          totalRatings: 0,
          averageRating: 0,
          uniqueUsers: 0,
          mostUsed: [],
          leastUsed: [],
          recentActivity: [],
          userEngagement: {
            dailyActive: 0,
            weeklyActive: 0,
            monthlyActive: 0,
            retention: 0,
          },
        },
        performance: {
          averageSearchTime: 0,
          averageDbTime: 0,
          averageAiTime: 0,
          cacheHitRate: this.cacheService ? this.cacheService.stats().hitRate : 0,
          errorRate: 0,
          uptime: Date.now() - this.startTime,
          memoryUsage: process.memoryUsage().heapUsed,
          diskUsage: 0,
          throughput: {
            searches: 0,
            creates: 0,
            updates: 0,
          },
        },
        trends: {
          period: '24h',
          searches: [],
          usage: [],
          successRate: [],
          performance: [],
          users: [],
          errors: [],
        },
        alerts: [],
      };
    } catch (error) {
      throw new services_1.DatabaseError(`Failed to get metrics: ${error.message}`, 'getMetrics', {
        originalError: error,
      });
    }
  }
  async export(options = {}) {
    this.ensureInitialized();
    if (this.importExportService) {
      return await this.importExportService.exportToJSON(options);
    }
    const entries = await this.list({ limit: 10000 });
    return JSON.stringify(
      {
        version: '1.0',
        exported_at: new Date().toISOString(),
        total: entries.total,
        entries: entries.data,
      },
      null,
      2
    );
  }
  async import(data, options = {}) {
    this.ensureInitialized();
    if (this.importExportService) {
      return await this.importExportService.importFromJSON(data, options);
    }
    throw new services_1.ServiceError('Import service not configured', 'IMPORT_SERVICE_MISSING');
  }
  async backup() {
    this.ensureInitialized();
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path_1.default.join(
        this.config.database.backup.path || './backups',
        `kb-backup-${timestamp}.db`
      );
      await promises_1.default.mkdir(path_1.default.dirname(backupPath), { recursive: true });
      await this.db.backup(backupPath);
      this.emit('data:backup-created', backupPath, 0);
      return backupPath;
    } catch (error) {
      throw new services_1.ServiceError(`Backup failed: ${error.message}`, 'BACKUP_FAILED', 500, {
        originalError: error,
      });
    }
  }
  async restore(backupPath) {
    this.ensureInitialized();
    try {
      await promises_1.default.access(backupPath);
      this.db.close();
      await promises_1.default.copyFile(backupPath, this.config.database.path);
      await this.initializeDatabase();
      await this.prepareStatements();
      const result = {
        success: true,
        restored: 0,
        errors: [],
        metadata: {
          backupVersion: '1.0',
          restoreTime: new Date(),
          dataIntegrity: true,
        },
      };
      this.emit('data:restored', result);
      return result;
    } catch (error) {
      throw new services_1.ServiceError(`Restore failed: ${error.message}`, 'RESTORE_FAILED', 500, {
        backupPath,
        originalError: error,
      });
    }
  }
  async close() {
    try {
      this.removeAllListeners();
      if (this.db && this.db.open) {
        this.db.close();
      }
      if (this.cacheService) {
        await this.cacheService.clear();
      }
      this.isInitialized = false;
      console.info('KnowledgeBaseService closed successfully');
    } catch (error) {
      console.error('Error closing KnowledgeBaseService:', error);
      throw error;
    }
  }
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new services_1.ServiceError('Service not initialized', 'SERVICE_NOT_INITIALIZED');
    }
  }
  async initializeDatabase() {
    try {
      const dbDir = path_1.default.dirname(this.config.database.path);
      await promises_1.default.mkdir(dbDir, { recursive: true });
      this.db = new better_sqlite3_1.default(this.config.database.path);
      Object.entries(this.config.database.pragmas).forEach(([key, value]) => {
        this.db.pragma(`${key} = ${value}`);
      });
      await this.createSchema();
      console.info(`Database initialized at ${this.config.database.path}`);
    } catch (error) {
      throw new services_1.DatabaseError(
        `Failed to initialize database: ${error.message}`,
        'initialize',
        { path: this.config.database.path, originalError: error }
      );
    }
  }
  async createSchema() {
    const schema = `
      -- Knowledge Base entries
      CREATE TABLE IF NOT EXISTS kb_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        metadata TEXT
      );

      -- Tags for entries (many-to-many)
      CREATE TABLE IF NOT EXISTS kb_tags (
        entry_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        PRIMARY KEY (entry_id, tag),
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
      );

      -- Search history
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        results_count INTEGER DEFAULT 0,
        selected_entry_id TEXT,
        user_id TEXT,
        session_id TEXT,
        search_type TEXT DEFAULT 'fuzzy',
        response_time INTEGER DEFAULT 0,
        success BOOLEAN DEFAULT 1,
        metadata TEXT
      );

      -- Usage metrics
      CREATE TABLE IF NOT EXISTS usage_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        user_id TEXT,
        session_id TEXT,
        metadata TEXT,
        value REAL
      );

      -- Performance metrics snapshots
      CREATE TABLE IF NOT EXISTS metric_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT
      );

      -- Alerts
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        timestamp TEXT NOT NULL,
        acknowledged BOOLEAN DEFAULT 0,
        acknowledged_at TEXT,
        acknowledged_by TEXT,
        metadata TEXT
      );

      -- Full-text search index
      CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
        id UNINDEXED,
        title,
        problem,
        solution,
        tags,
        category UNINDEXED,
        tokenize = 'porter'
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries(category);
      CREATE INDEX IF NOT EXISTS idx_kb_entries_created_at ON kb_entries(created_at);
      CREATE INDEX IF NOT EXISTS idx_kb_entries_updated_at ON kb_entries(updated_at);
      CREATE INDEX IF NOT EXISTS idx_kb_entries_usage_count ON kb_entries(usage_count DESC);
      CREATE INDEX IF NOT EXISTS idx_kb_entries_success_rate ON kb_entries(success_count, failure_count);
      CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag);
      CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry_timestamp ON usage_metrics(entry_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_metric_snapshots_timestamp ON metric_snapshots(timestamp, metric_type);

      -- Triggers for FTS synchronization
      CREATE TRIGGER IF NOT EXISTS kb_fts_insert AFTER INSERT ON kb_entries BEGIN
        INSERT INTO kb_fts(id, title, problem, solution, category)
        VALUES (NEW.id, NEW.title, NEW.problem, NEW.solution, NEW.category);
      END;

      CREATE TRIGGER IF NOT EXISTS kb_fts_update AFTER UPDATE ON kb_entries BEGIN
        UPDATE kb_fts SET
          title = NEW.title,
          problem = NEW.problem,
          solution = NEW.solution,
          category = NEW.category
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS kb_fts_delete AFTER DELETE ON kb_entries BEGIN
        DELETE FROM kb_fts WHERE id = OLD.id;
      END;
    `;
    this.db.exec(schema);
  }
  async prepareStatements() {
    this.statements = {
      insertEntry: this.db.prepare(`
        INSERT INTO kb_entries (
          id, title, problem, solution, category,
          created_at, updated_at, created_by,
          usage_count, success_count, failure_count, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateEntry: this.db.prepare(`
        UPDATE kb_entries 
        SET title = ?, problem = ?, solution = ?, category = ?, updated_at = ?, version = ?
        WHERE id = ?
      `),
      selectEntry: this.db.prepare(`
        SELECT * FROM kb_entries WHERE id = ?
      `),
      deleteEntry: this.db.prepare(`
        DELETE FROM kb_entries WHERE id = ?
      `),
      insertTag: this.db.prepare(`
        INSERT OR REPLACE INTO kb_tags (entry_id, tag, weight) VALUES (?, ?, ?)
      `),
      deleteTagsForEntry: this.db.prepare(`
        DELETE FROM kb_tags WHERE entry_id = ?
      `),
      selectEntriesWithTags: this.db.prepare(`
        SELECT e.*, GROUP_CONCAT(t.tag) as tags
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        GROUP BY e.id
        ORDER BY e.created_at DESC
      `),
      selectEntriesByCategory: this.db.prepare(`
        SELECT * FROM kb_entries 
        WHERE category = ? 
        ORDER BY usage_count DESC, created_at DESC
      `),
      updateUsageStats: this.db.prepare(`
        UPDATE kb_entries 
        SET usage_count = usage_count + 1,
            success_count = success_count + ?,
            failure_count = failure_count + ?,
            updated_at = datetime('now')
        WHERE id = ?
      `),
      selectMetrics: this.db.prepare(`
        SELECT 
          COUNT(*) as total_entries,
          AVG(usage_count) as avg_usage,
          SUM(usage_count) as total_usage,
          AVG(CASE WHEN (success_count + failure_count) = 0 THEN 0 
               ELSE CAST(success_count AS REAL) / (success_count + failure_count) END) as avg_success_rate
        FROM kb_entries
      `),
    };
  }
  async initializeDependentServices() {
    if (this.metricsService) {
    }
    if (this.cacheService) {
    }
  }
  async setupPeriodicTasks() {
    if (this.config.database.backup.enabled) {
      setInterval(async () => {
        try {
          await this.backup();
        } catch (error) {
          console.error('Periodic backup failed:', error);
        }
      }, this.config.database.backup.interval);
    }
    if (this.config.metrics.enabled && this.config.metrics.aggregation.enabled) {
      setInterval(async () => {
        try {
          if (this.metricsService) {
            await this.metricsService.getMetrics();
          }
        } catch (error) {
          console.error('Metrics aggregation failed:', error);
        }
      }, this.config.metrics.aggregation.interval);
    }
  }
  mapDBEntryToKBEntry(row) {
    return {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category,
      tags: [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      usage_count: row.usage_count,
      success_count: row.success_count,
      failure_count: row.failure_count,
      version: row.version,
    };
  }
  updateFTSIndex(id, entry) {
    const tags = Array.isArray(entry.tags) ? entry.tags.join(' ') : '';
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO kb_fts (id, title, problem, solution, tags, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        entry.title || '',
        entry.problem || '',
        entry.solution || '',
        tags,
        entry.category || ''
      );
  }
  async getAllEntriesForSearch(options) {
    const listOptions = {
      limit: 10000,
      category: options.category,
      filters: {
        tags: options.tags,
      },
    };
    const result = await this.list(listOptions);
    return result.data;
  }
}
exports.KnowledgeBaseService = KnowledgeBaseService;
exports.default = KnowledgeBaseService;
//# sourceMappingURL=KnowledgeBaseService.js.map
