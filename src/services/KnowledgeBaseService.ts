/**
 * KnowledgeBaseService - Core orchestrator for all KB operations
 * Production-ready service with comprehensive CRUD, transactions, and event management
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

import {
  IKnowledgeBaseService,
  IValidationService,
  ISearchService,
  ICacheService,
  IMetricsService,
  IImportExportService,
  ServiceConfig,
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchOptions,
  ListOptions,
  PaginatedResult,
  KBMetrics,
  ExportOptions,
  ImportOptions,
  ImportResult,
  RestoreResult,
  ServiceError,
  DatabaseError,
  ValidationError,
  DBKBEntry,
  DBKBTag,
  ServiceEvents,
  DEFAULT_SERVICE_CONFIG,
} from '../types/services';

/**
 * Main Knowledge Base Service
 * Orchestrates all operations with dependency injection and event-driven architecture
 */
export class KnowledgeBaseService extends EventEmitter implements IKnowledgeBaseService {
  private db: Database.Database;
  private isInitialized = false;
  private transactions = new Map<string, Database.Transaction>();
  private startTime = Date.now();

  // Prepared statements for performance
  private statements: {
    insertEntry: Database.Statement;
    updateEntry: Database.Statement;
    selectEntry: Database.Statement;
    deleteEntry: Database.Statement;
    insertTag: Database.Statement;
    deleteTagsForEntry: Database.Statement;
    selectEntriesWithTags: Database.Statement;
    selectEntriesByCategory: Database.Statement;
    updateUsageStats: Database.Statement;
    selectMetrics: Database.Statement;
  };

  constructor(
    private config: ServiceConfig = DEFAULT_SERVICE_CONFIG,
    private validationService?: IValidationService,
    private searchService?: ISearchService,
    private cacheService?: ICacheService,
    private metricsService?: IMetricsService,
    private importExportService?: IImportExportService
  ) {
    super();
    this.setMaxListeners(50); // Allow more listeners for event-driven architecture
  }

  /**
   * Initialize the service with database setup and schema creation
   */
  async initialize(): Promise<void> {
    try {
      await this.initializeDatabase();
      await this.prepareStatements();
      await this.initializeDependentServices();
      await this.setupPeriodicTasks();

      this.isInitialized = true;
      this.emit('service:initialized', { timestamp: new Date() });

      console.info('KnowledgeBaseService initialized successfully');
    } catch (error) {
      const serviceError = new DatabaseError(
        'Failed to initialize KnowledgeBaseService',
        'initialize',
        { originalError: error }
      );

      this.emit('error:occurred', serviceError);
      throw serviceError;
    }
  }

  /**
   * Create a new knowledge base entry
   */
  async create(entry: KBEntryInput): Promise<string> {
    this.ensureInitialized();

    // Validate entry
    if (this.validationService) {
      const validation = this.validationService.validateEntry(entry);
      if (!validation.valid) {
        throw new ValidationError(
          `Entry validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors[0]?.field || 'unknown'
        );
      }
    }

    const id = uuidv4();
    const now = new Date();

    const transaction = this.db.transaction(() => {
      try {
        // Insert main entry
        this.statements.insertEntry.run(
          id,
          entry.title,
          entry.problem,
          entry.solution,
          entry.category,
          now.toISOString(),
          now.toISOString(),
          entry.created_by || 'system',
          0, // usage_count
          0, // success_count
          0, // failure_count
          1 // version
        );

        // Insert tags
        if (entry.tags && entry.tags.length > 0) {
          this.statements.deleteTagsForEntry.run(id); // Cleanup first
          entry.tags.forEach(tag => {
            this.statements.insertTag.run(id, tag.toLowerCase().trim(), 1.0);
          });
        }

        // Update FTS index
        this.updateFTSIndex(id, entry);

        return id;
      } catch (error) {
        throw new DatabaseError(`Failed to create entry: ${error.message}`, 'create', {
          entry,
          originalError: error,
        });
      }
    });

    const result = transaction();

    // Get the full created entry
    const createdEntry = await this.read(id);
    if (createdEntry) {
      this.emit('entry:created', createdEntry);

      if (this.metricsService) {
        await this.metricsService.recordUsage(id, 'create');
      }

      if (this.cacheService) {
        await this.cacheService.delete(`entry:${id}`); // Clear any cached version
      }
    }

    return id;
  }

  /**
   * Create multiple entries in a single transaction
   */
  async createBatch(entries: KBEntryInput[]): Promise<string[]> {
    this.ensureInitialized();

    if (entries.length === 0) {
      return [];
    }

    // Validate all entries first
    if (this.validationService) {
      const validations = this.validationService.validateBatch(entries);
      const invalidEntries = validations.filter(v => !v.valid);

      if (invalidEntries.length > 0) {
        throw new ValidationError(
          `Batch validation failed for ${invalidEntries.length} entries`,
          'batch'
        );
      }
    }

    const ids: string[] = [];
    const now = new Date();

    const transaction = this.db.transaction(() => {
      entries.forEach(entry => {
        const id = uuidv4();
        ids.push(id);

        // Insert main entry
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

        // Insert tags
        if (entry.tags && entry.tags.length > 0) {
          entry.tags.forEach(tag => {
            this.statements.insertTag.run(id, tag.toLowerCase().trim(), 1.0);
          });
        }

        // Update FTS index
        this.updateFTSIndex(id, entry);
      });
    });

    transaction();

    // Get all created entries
    const createdEntries = await this.readBatch(ids);
    this.emit('entries:batch-created', createdEntries);

    if (this.metricsService) {
      await Promise.all(ids.map(id => this.metricsService!.recordUsage(id, 'create')));
    }

    return ids;
  }

  /**
   * Read a single entry by ID
   */
  async read(id: string): Promise<KBEntry | null> {
    this.ensureInitialized();

    // Try cache first
    if (this.cacheService) {
      const cached = await this.cacheService.get<KBEntry>(`entry:${id}`);
      if (cached) {
        this.emit('cache:hit', `entry:${id}`);
        return cached;
      }
      this.emit('cache:miss', `entry:${id}`);
    }

    try {
      const row = this.statements.selectEntry.get(id) as DBKBEntry | undefined;

      if (!row) {
        return null;
      }

      const entry = this.mapDBEntryToKBEntry(row);

      // Get tags
      const tags = this.db
        .prepare(
          `
        SELECT tag FROM kb_tags WHERE entry_id = ? ORDER BY weight DESC, tag ASC
      `
        )
        .all(id) as { tag: string }[];

      entry.tags = tags.map(t => t.tag);

      // Cache the result
      if (this.cacheService) {
        await this.cacheService.set(`entry:${id}`, entry, this.config.cache.ttl);
      }

      return entry;
    } catch (error) {
      throw new DatabaseError(`Failed to read entry ${id}: ${error.message}`, 'read', {
        id,
        originalError: error,
      });
    }
  }

  /**
   * Read multiple entries by IDs
   */
  async readBatch(ids: string[]): Promise<KBEntry[]> {
    this.ensureInitialized();

    if (ids.length === 0) {
      return [];
    }

    // Try cache first for available entries
    const results: KBEntry[] = [];
    const missingIds: string[] = [];

    if (this.cacheService) {
      const cacheKeys = ids.map(id => `entry:${id}`);
      const cachedEntries = await this.cacheService.mget<KBEntry>(cacheKeys);

      for (let i = 0; i < ids.length; i++) {
        if (cachedEntries[i]) {
          results.push(cachedEntries[i]!);
          this.emit('cache:hit', `entry:${ids[i]}`);
        } else {
          missingIds.push(ids[i]);
          this.emit('cache:miss', `entry:${ids[i]}`);
        }
      }
    } else {
      missingIds.push(...ids);
    }

    // Fetch missing entries from database
    if (missingIds.length > 0) {
      const placeholders = missingIds.map(() => '?').join(',');
      const query = `
        SELECT * FROM kb_entries 
        WHERE id IN (${placeholders})
        ORDER BY created_at DESC
      `;

      const rows = this.db.prepare(query).all(...missingIds) as DBKBEntry[];
      const dbEntries = rows.map(row => this.mapDBEntryToKBEntry(row));

      // Get tags for all entries
      if (dbEntries.length > 0) {
        const tagQuery = `
          SELECT entry_id, tag FROM kb_tags 
          WHERE entry_id IN (${placeholders})
          ORDER BY weight DESC, tag ASC
        `;
        const tagRows = this.db.prepare(tagQuery).all(...missingIds) as {
          entry_id: string;
          tag: string;
        }[];

        // Group tags by entry_id
        const tagsByEntry = new Map<string, string[]>();
        tagRows.forEach(row => {
          if (!tagsByEntry.has(row.entry_id)) {
            tagsByEntry.set(row.entry_id, []);
          }
          tagsByEntry.get(row.entry_id)!.push(row.tag);
        });

        // Add tags to entries
        dbEntries.forEach(entry => {
          entry.tags = tagsByEntry.get(entry.id) || [];
        });

        // Cache the results
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

    // Sort results by the original ID order
    const sortedResults = ids
      .map(id => results.find(entry => entry.id === id))
      .filter(Boolean) as KBEntry[];
    return sortedResults;
  }

  /**
   * Update an existing entry
   */
  async update(id: string, updates: KBEntryUpdate): Promise<boolean> {
    this.ensureInitialized();

    // Validate updates
    if (this.validationService) {
      const validation = this.validationService.validateUpdate(updates);
      if (!validation.valid) {
        throw new ValidationError(
          `Update validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          validation.errors[0]?.field || 'unknown'
        );
      }
    }

    // Get current entry
    const currentEntry = await this.read(id);
    if (!currentEntry) {
      return false;
    }

    const now = new Date();
    const newVersion = currentEntry.version + 1;

    const transaction = this.db.transaction(() => {
      try {
        // Update main entry
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

        // Update tags if provided
        if (updates.tags !== undefined) {
          this.statements.deleteTagsForEntry.run(id);
          if (updates.tags.length > 0) {
            updates.tags.forEach(tag => {
              this.statements.insertTag.run(id, tag.toLowerCase().trim(), 1.0);
            });
          }
        }

        // Update FTS index
        const updatedEntry = { ...currentEntry, ...updates };
        this.updateFTSIndex(id, updatedEntry);

        return true;
      } catch (error) {
        throw new DatabaseError(`Failed to update entry ${id}: ${error.message}`, 'update', {
          id,
          updates,
          originalError: error,
        });
      }
    });

    const success = transaction();

    if (success) {
      // Clear cache
      if (this.cacheService) {
        await this.cacheService.delete(`entry:${id}`);
      }

      // Get updated entry and emit event
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

  /**
   * Update multiple entries in a single transaction
   */
  async updateBatch(updates: Array<{ id: string; updates: KBEntryUpdate }>): Promise<boolean[]> {
    this.ensureInitialized();

    if (updates.length === 0) {
      return [];
    }

    const results: boolean[] = [];
    const now = new Date();

    const transaction = this.db.transaction(() => {
      updates.forEach(({ id, updates: entryUpdates }) => {
        try {
          // Check if entry exists
          const exists = this.statements.selectEntry.get(id);
          if (!exists) {
            results.push(false);
            return;
          }

          // Build update query dynamically
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

          // Update tags if provided
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

    // Clear cache for updated entries
    if (this.cacheService) {
      const cacheKeys = updates.map(u => `entry:${u.id}`);
      await Promise.all(cacheKeys.map(key => this.cacheService!.delete(key)));
    }

    // Emit events for successful updates
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
          successfulUpdates.map(u => this.metricsService!.recordUsage(u.id, 'update'))
        );
      }
    }

    return results;
  }

  /**
   * Delete an entry by ID
   */
  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();

    const transaction = this.db.transaction(() => {
      try {
        // Delete from FTS index first
        this.db
          .prepare('DELETE FROM kb_fts WHERE rowid = (SELECT rowid FROM kb_entries WHERE id = ?)')
          .run(id);

        // Delete tags (will cascade)
        this.statements.deleteTagsForEntry.run(id);

        // Delete main entry
        const result = this.statements.deleteEntry.run(id);

        return result.changes > 0;
      } catch (error) {
        throw new DatabaseError(`Failed to delete entry ${id}: ${error.message}`, 'delete', {
          id,
          originalError: error,
        });
      }
    });

    const success = transaction();

    if (success) {
      // Clear cache
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

  /**
   * Delete multiple entries in a single transaction
   */
  async deleteBatch(ids: string[]): Promise<boolean[]> {
    this.ensureInitialized();

    if (ids.length === 0) {
      return [];
    }

    const results: boolean[] = [];

    const transaction = this.db.transaction(() => {
      ids.forEach(id => {
        try {
          // Delete from FTS index
          this.db
            .prepare('DELETE FROM kb_fts WHERE rowid = (SELECT rowid FROM kb_entries WHERE id = ?)')
            .run(id);

          // Delete tags
          this.statements.deleteTagsForEntry.run(id);

          // Delete main entry
          const result = this.statements.deleteEntry.run(id);

          results.push(result.changes > 0);
        } catch (error) {
          console.error(`Failed to delete entry ${id}:`, error);
          results.push(false);
        }
      });
    });

    transaction();

    // Clear cache for deleted entries
    if (this.cacheService) {
      const cacheKeys = ids.map(id => `entry:${id}`);
      await Promise.all(cacheKeys.map(key => this.cacheService!.delete(key)));
    }

    // Emit events for successful deletions
    const successfulDeletions = ids.filter((_, index) => results[index]);
    if (successfulDeletions.length > 0) {
      this.emit('entries:batch-deleted', successfulDeletions);

      if (this.metricsService) {
        await Promise.all(
          successfulDeletions.map(id => this.metricsService!.recordUsage(id, 'delete'))
        );
      }
    }

    return results;
  }

  /**
   * List entries with pagination and filtering
   */
  async list(options: ListOptions = {}): Promise<PaginatedResult<KBEntry>> {
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

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

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

    // Build ORDER BY clause
    const validSortFields = ['created_at', 'updated_at', 'usage_count', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Special handling for success_rate
    let orderByClause = `ORDER BY ${sortField} ${order}`;
    if (sortBy === 'success_rate') {
      orderByClause = `ORDER BY CASE WHEN (success_count + failure_count) = 0 THEN 0 ELSE CAST(success_count AS REAL) / (success_count + failure_count) END ${order}`;
    }

    try {
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM kb_entries 
        ${whereClause}
      `;
      const { total } = this.db.prepare(countQuery).get(...params) as { total: number };

      // Get entries
      const query = `
        SELECT * FROM kb_entries 
        ${whereClause} 
        ${orderByClause} 
        LIMIT ? OFFSET ?
      `;
      const rows = this.db.prepare(query).all(...params, limit, offset) as DBKBEntry[];

      // Map to KBEntry objects
      const entries = rows.map(row => this.mapDBEntryToKBEntry(row));

      // Get tags for all entries
      if (entries.length > 0) {
        const entryIds = entries.map(e => e.id);
        const placeholders = entryIds.map(() => '?').join(',');
        const tagQuery = `
          SELECT entry_id, tag FROM kb_tags 
          WHERE entry_id IN (${placeholders})
          ORDER BY weight DESC, tag ASC
        `;
        const tagRows = this.db.prepare(tagQuery).all(...entryIds) as {
          entry_id: string;
          tag: string;
        }[];

        // Group tags by entry_id
        const tagsByEntry = new Map<string, string[]>();
        tagRows.forEach(row => {
          if (!tagsByEntry.has(row.entry_id)) {
            tagsByEntry.set(row.entry_id, []);
          }
          tagsByEntry.get(row.entry_id)!.push(row.tag);
        });

        // Add tags to entries
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
      throw new DatabaseError(`Failed to list entries: ${error.message}`, 'list', {
        options,
        originalError: error,
      });
    }
  }

  /**
   * Search entries using the configured search service
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.ensureInitialized();

    if (!this.searchService) {
      throw new ServiceError('Search service not configured', 'SEARCH_SERVICE_MISSING');
    }

    const startTime = Date.now();

    try {
      // Get all entries for search (consider implementing a more efficient approach for large datasets)
      const allEntries = await this.getAllEntriesForSearch(options);

      // Perform search
      const results = await this.searchService.search(query, allEntries, options);

      const searchTime = Date.now() - startTime;

      // Record search metrics
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
      const searchError = new ServiceError(
        `Search failed: ${error.message}`,
        'SEARCH_FAILED',
        500,
        { query, options, originalError: error }
      );

      this.emit('error:occurred', searchError);
      throw searchError;
    }
  }

  /**
   * Record usage statistics for an entry
   */
  async recordUsage(id: string, successful: boolean, userId?: string): Promise<void> {
    this.ensureInitialized();

    try {
      const successIncrement = successful ? 1 : 0;
      const failureIncrement = successful ? 0 : 1;

      this.statements.updateUsageStats.run(successIncrement, failureIncrement, id);

      // Clear cache for this entry
      if (this.cacheService) {
        await this.cacheService.delete(`entry:${id}`);
      }

      // Record in metrics service
      if (this.metricsService) {
        const action = successful ? 'rate_success' : 'rate_failure';
        await this.metricsService.recordUsage(id, action, userId);
      }

      this.emit('usage:recorded', id, successful ? 'rate_success' : 'rate_failure', userId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to record usage for entry ${id}: ${error.message}`,
        'recordUsage',
        { id, successful, userId, originalError: error }
      );
    }
  }

  /**
   * Get comprehensive metrics
   */
  async getMetrics(): Promise<KBMetrics> {
    this.ensureInitialized();

    if (this.metricsService) {
      return await this.metricsService.getMetrics();
    }

    // Fallback to basic metrics
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
        .get() as any;

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
        .all() as any[];

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
      throw new DatabaseError(`Failed to get metrics: ${error.message}`, 'getMetrics', {
        originalError: error,
      });
    }
  }

  /**
   * Export knowledge base data
   */
  async export(options: ExportOptions = {}): Promise<string> {
    this.ensureInitialized();

    if (this.importExportService) {
      return await this.importExportService.exportToJSON(options);
    }

    // Fallback export
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

  /**
   * Import knowledge base data
   */
  async import(data: string, options: ImportOptions = {}): Promise<ImportResult> {
    this.ensureInitialized();

    if (this.importExportService) {
      return await this.importExportService.importFromJSON(data, options);
    }

    throw new ServiceError('Import service not configured', 'IMPORT_SERVICE_MISSING');
  }

  /**
   * Create a backup of the database
   */
  async backup(): Promise<string> {
    this.ensureInitialized();

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(
        this.config.database.backup.path || './backups',
        `kb-backup-${timestamp}.db`
      );

      // Ensure backup directory exists
      await fs.mkdir(path.dirname(backupPath), { recursive: true });

      // Create backup
      await this.db.backup(backupPath);

      this.emit('data:backup-created', backupPath, 0);

      return backupPath;
    } catch (error) {
      throw new ServiceError(`Backup failed: ${error.message}`, 'BACKUP_FAILED', 500, {
        originalError: error,
      });
    }
  }

  /**
   * Restore from a backup
   */
  async restore(backupPath: string): Promise<RestoreResult> {
    this.ensureInitialized();

    try {
      // Validate backup file exists
      await fs.access(backupPath);

      // Close current database
      this.db.close();

      // Replace current database with backup
      await fs.copyFile(backupPath, this.config.database.path);

      // Reinitialize
      await this.initializeDatabase();
      await this.prepareStatements();

      const result: RestoreResult = {
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
      throw new ServiceError(`Restore failed: ${error.message}`, 'RESTORE_FAILED', 500, {
        backupPath,
        originalError: error,
      });
    }
  }

  /**
   * Close the service and cleanup resources
   */
  async close(): Promise<void> {
    try {
      // Clear any periodic tasks
      this.removeAllListeners();

      // Close database
      if (this.db && this.db.open) {
        this.db.close();
      }

      // Close dependent services
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

  // =========================
  // Private Helper Methods
  // =========================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ServiceError('Service not initialized', 'SERVICE_NOT_INITIALIZED');
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.database.path);
      await fs.mkdir(dbDir, { recursive: true });

      this.db = new Database(this.config.database.path);

      // Set pragmas
      Object.entries(this.config.database.pragmas).forEach(([key, value]) => {
        this.db.pragma(`${key} = ${value}`);
      });

      // Create schema
      await this.createSchema();

      console.info(`Database initialized at ${this.config.database.path}`);
    } catch (error) {
      throw new DatabaseError(`Failed to initialize database: ${error.message}`, 'initialize', {
        path: this.config.database.path,
        originalError: error,
      });
    }
  }

  private async createSchema(): Promise<void> {
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

  private async prepareStatements(): Promise<void> {
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

  private async initializeDependentServices(): Promise<void> {
    // Initialize services with this instance as dependency
    if (this.metricsService) {
      // MetricsService might need database access
    }

    if (this.cacheService) {
      // CacheService is standalone
    }
  }

  private async setupPeriodicTasks(): Promise<void> {
    // Setup backup task if enabled
    if (this.config.database.backup.enabled) {
      setInterval(async () => {
        try {
          await this.backup();
        } catch (error) {
          console.error('Periodic backup failed:', error);
        }
      }, this.config.database.backup.interval);
    }

    // Setup metrics aggregation if enabled
    if (this.config.metrics.enabled && this.config.metrics.aggregation.enabled) {
      setInterval(async () => {
        try {
          // Aggregate metrics
          if (this.metricsService) {
            await this.metricsService.getMetrics();
          }
        } catch (error) {
          console.error('Metrics aggregation failed:', error);
        }
      }, this.config.metrics.aggregation.interval);
    }
  }

  private mapDBEntryToKBEntry(row: DBKBEntry): KBEntry {
    return {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category as any,
      tags: [], // Will be populated separately
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      usage_count: row.usage_count,
      success_count: row.success_count,
      failure_count: row.failure_count,
      version: row.version,
    };
  }

  private updateFTSIndex(id: string, entry: Partial<KBEntryInput>): void {
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

  private async getAllEntriesForSearch(options: SearchOptions): Promise<KBEntry[]> {
    // For now, get all entries. In production, consider implementing
    // more sophisticated approaches like indexed search or chunking
    const listOptions: ListOptions = {
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

export default KnowledgeBaseService;
