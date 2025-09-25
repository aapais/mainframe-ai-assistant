/**
 * Knowledge Base IPC Handler
 *
 * Handles all CRUD operations for knowledge base entries with
 * comprehensive error handling, validation, and performance optimization.
 */

import {
  IPCHandlerFunction,
  KBSearchRequest,
  KBSearchResponse,
  KBEntryCreateRequest,
  KBEntryCreateResponse,
  KBEntryGetRequest,
  KBEntryGetResponse,
  KBEntryUpdateRequest,
  KBEntryUpdateResponse,
  KBEntryDeleteRequest,
  KBFeedbackRequest,
  IPCErrorCode,
  BaseIPCResponse,
} from '../../../types/ipc';
import { KBEntry, KBEntryInput, SearchResult, KBCategory } from '../../../types/index';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../../caching/MultiLayerCacheManager';
import { AppError } from '../../../core/errors/AppError';
import { v4 as uuidv4 } from 'uuid';

/**
 * Knowledge Base Service Handler
 *
 * Provides comprehensive KB operations with caching, validation,
 * and performance optimizations.
 */
export class KnowledgeBaseHandler {
  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager
  ) {}

  /**
   * Handle local KB search requests
   */
  handleLocalSearch: IPCHandlerFunction<'kb:search:local'> = async request => {
    const startTime = Date.now();

    try {
      const { query, options = {} } = request;

      // Validate search query
      if (!query || query.trim().length === 0) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_SEARCH_QUERY,
          'Search query cannot be empty'
        );
      }

      // Check cache first
      const cacheKey = this.generateSearchCacheKey('local', query, options);
      const cached = await this.cacheManager.get<SearchResult[]>(cacheKey);

      if (cached) {
        return {
          success: true,
          requestId: request.requestId,
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          data: cached,
          metadata: {
            cached: true,
            batched: false,
            streamed: false,
            fromCache: 'memory',
            totalResults: cached.length,
            searchType: 'exact',
            queryProcessingTime: Date.now() - startTime,
            hasMoreResults: false,
          },
        } as KBSearchResponse;
      }

      // Build SQL query with filters
      const { sql, params } = this.buildSearchQuery(query, options);

      // Execute search
      const queryResult = await this.dbManager.query<any[]>(sql, params, {
        useCache: true,
        cacheKey: `kb_search_${Buffer.from(sql + JSON.stringify(params)).toString('base64')}`,
        maxRetries: 2,
      });

      // Transform results
      const entries = queryResult.data.map(row => this.transformRowToKBEntry(row));
      const searchResults = this.calculateSearchScores(entries, query, options);

      // Cache results
      await this.cacheManager.set(cacheKey, searchResults, {
        ttl: 300000, // 5 minutes
        layer: 'memory',
        tags: ['kb-search', `query:${query.substring(0, 20)}`],
      });

      // Update search metrics
      await this.recordSearchMetrics(
        query,
        searchResults.length,
        'local',
        queryResult.executionTime
      );

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        data: searchResults,
        metadata: {
          cached: false,
          batched: false,
          streamed: false,
          totalResults: searchResults.length,
          searchType: 'fuzzy',
          queryProcessingTime: queryResult.executionTime,
          hasMoreResults: searchResults.length === (options.limit || 20),
        },
      } as KBSearchResponse;
    } catch (error) {
      console.error('Local search error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Local search failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Handle KB entry creation
   */
  handleEntryCreate: IPCHandlerFunction<'kb:entry:create'> = async request => {
    const startTime = Date.now();

    try {
      const { entry, options = {} } = request;

      // Validate entry data
      const validationResult = this.validateEntryInput(entry);
      if (!validationResult.valid) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          validationResult.error || 'Entry validation failed'
        );
      }

      // Check for duplicates if requested
      let duplicatesFound = 0;
      if (options.duplicateCheck) {
        const duplicates = await this.findSimilarEntries(entry);
        duplicatesFound = duplicates.length;

        if (duplicates.length > 0 && !options.validate) {
          return this.createErrorResponse(
            request.requestId,
            startTime,
            IPCErrorCode.DUPLICATE_ENTRY,
            'Similar entries already exist',
            { duplicates: duplicates.slice(0, 3) } // Return first 3 duplicates
          );
        }
      }

      // Generate auto tags if requested
      const autoGeneratedTags: string[] = [];
      if (options.autoTags) {
        autoGeneratedTags.push(...this.generateAutoTags(entry));
      }

      // Prepare entry for insertion
      const newEntry: KBEntry = {
        id: uuidv4(),
        title: entry.title.trim(),
        problem: entry.problem.trim(),
        solution: entry.solution.trim(),
        category: entry.category,
        tags: [...(entry.tags || []), ...autoGeneratedTags],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: entry.created_by || 'system',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        version: 1,
      };

      // Insert into database with transaction
      await this.dbManager.transaction(async db => {
        // Insert main entry
        const insertStmt = db.prepare(`
          INSERT INTO kb_entries (
            id, title, problem, solution, category, created_at, updated_at, 
            created_by, usage_count, success_count, failure_count, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
          newEntry.id,
          newEntry.title,
          newEntry.problem,
          newEntry.solution,
          newEntry.category,
          newEntry.created_at.toISOString(),
          newEntry.updated_at.toISOString(),
          newEntry.created_by,
          newEntry.usage_count,
          newEntry.success_count,
          newEntry.failure_count,
          newEntry.version
        );

        // Insert tags
        if (newEntry.tags.length > 0) {
          const tagStmt = db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
          newEntry.tags.forEach(tag => {
            tagStmt.run(newEntry.id, tag.toLowerCase().trim());
          });
        }

        // Update full-text search index
        const ftsStmt = db.prepare(`
          INSERT INTO kb_fts (id, title, problem, solution, tags)
          VALUES (?, ?, ?, ?, ?)
        `);

        ftsStmt.run(
          newEntry.id,
          newEntry.title,
          newEntry.problem,
          newEntry.solution,
          newEntry.tags.join(' ')
        );
      });

      // Invalidate search caches
      await this.cacheManager.invalidateByTags(['kb-search', 'kb-entries']);

      // Log creation
      console.log(`✅ Created KB entry: ${newEntry.title} (${newEntry.id})`);

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        data: newEntry.id,
        metadata: {
          cached: false,
          batched: false,
          streamed: false,
          duplicatesFound,
          autoGeneratedTags,
          validationPassed: true,
        },
      } as KBEntryCreateResponse;
    } catch (error) {
      console.error('Entry creation error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Entry creation failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Handle KB entry retrieval
   */
  handleEntryGet: IPCHandlerFunction<'kb:entry:get'> = async request => {
    const startTime = Date.now();

    try {
      const { id, options = {} } = request;

      // Validate ID format
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid entry ID format'
        );
      }

      // Check cache first
      const cacheKey = `kb_entry_${id}`;
      const cached = await this.cacheManager.get<KBEntry>(cacheKey);

      if (cached) {
        // Mark as viewed if requested
        if (options.markAsViewed) {
          await this.recordEntryView(id);
        }

        return {
          success: true,
          requestId: request.requestId,
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          data: cached,
          metadata: {
            cached: true,
            batched: false,
            streamed: false,
            fromCache: 'memory',
          },
        } as KBEntryGetResponse;
      }

      // Query database
      const sql = `
        SELECT 
          e.*,
          GROUP_CONCAT(t.tag) as tags
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.id = ?
        GROUP BY e.id
      `;

      const queryResult = await this.dbManager.query<any[]>(sql, [id]);

      if (!queryResult.data || queryResult.data.length === 0) {
        return {
          success: true,
          requestId: request.requestId,
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          data: null,
          metadata: {
            cached: false,
            batched: false,
            streamed: false,
          },
        } as KBEntryGetResponse;
      }

      // Transform to KBEntry
      const entry = this.transformRowToKBEntry(queryResult.data[0]);

      // Cache the entry
      await this.cacheManager.set(cacheKey, entry, {
        ttl: 600000, // 10 minutes
        layer: 'memory',
        tags: ['kb-entries', `category:${entry.category}`],
      });

      // Get related entries if requested
      let relatedEntries: KBEntry[] | undefined;
      if (options.includeRelated) {
        relatedEntries = await this.findRelatedEntries(entry);
      }

      // Mark as viewed if requested
      if (options.markAsViewed) {
        await this.recordEntryView(id);
      }

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        data: entry,
        metadata: {
          cached: false,
          batched: false,
          streamed: false,
          relatedEntries,
          viewCount: entry.usage_count + (options.markAsViewed ? 1 : 0),
          lastModified: entry.updated_at.getTime(),
        },
      } as KBEntryGetResponse;
    } catch (error) {
      console.error('Entry retrieval error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Entry retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Handle KB entry updates
   */
  handleEntryUpdate: IPCHandlerFunction<'kb:entry:update'> = async request => {
    const startTime = Date.now();

    try {
      const { id, updates, options = {} } = request;

      // Validate ID and updates
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid entry ID format'
        );
      }

      if (Object.keys(updates).length === 0) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'No updates provided'
        );
      }

      // Get existing entry
      const existingEntry = await this.getEntryById(id);
      if (!existingEntry) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Entry with ID ${id} not found`
        );
      }

      // Validate updates
      const validationResult = this.validateEntryUpdates(updates);
      if (!validationResult.valid) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          validationResult.error || 'Update validation failed'
        );
      }

      // Create revision if requested
      let revisionId: string | undefined;
      if (options.createRevision) {
        revisionId = await this.createEntryRevision(existingEntry, options.reason);
      }

      // Update entry with transaction
      await this.dbManager.transaction(async db => {
        // Build update SQL
        const updateFields: string[] = [];
        const updateValues: any[] = [];

        if (updates.title) {
          updateFields.push('title = ?');
          updateValues.push(updates.title.trim());
        }
        if (updates.problem) {
          updateFields.push('problem = ?');
          updateValues.push(updates.problem.trim());
        }
        if (updates.solution) {
          updateFields.push('solution = ?');
          updateValues.push(updates.solution.trim());
        }
        if (updates.category) {
          updateFields.push('category = ?');
          updateValues.push(updates.category);
        }

        updateFields.push('updated_at = ?', 'version = version + 1');
        updateValues.push(new Date().toISOString());
        updateValues.push(id); // For WHERE clause

        // Update main entry
        const updateSql = `
          UPDATE kb_entries 
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `;

        db.prepare(updateSql).run(...updateValues);

        // Update tags if provided
        if (updates.tags) {
          // Delete existing tags
          db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);

          // Insert new tags
          if (updates.tags.length > 0) {
            const tagStmt = db.prepare('INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)');
            updates.tags.forEach(tag => {
              tagStmt.run(id, tag.toLowerCase().trim());
            });
          }
        }

        // Update full-text search index
        const updatedEntry = { ...existingEntry, ...updates };
        const ftsUpdateSql = `
          UPDATE kb_fts 
          SET title = ?, problem = ?, solution = ?, tags = ?
          WHERE id = ?
        `;

        db.prepare(ftsUpdateSql).run(
          updatedEntry.title,
          updatedEntry.problem,
          updatedEntry.solution,
          (updatedEntry.tags || []).join(' '),
          id
        );
      });

      // Invalidate caches
      await this.cacheManager.invalidateByTags([
        'kb-search',
        'kb-entries',
        `entry:${id}`,
        `category:${existingEntry.category}`,
      ]);

      // Log update
      console.log(`✅ Updated KB entry: ${id}`);

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        metadata: {
          cached: false,
          batched: false,
          streamed: false,
          revisionId,
          affectedUsers: options.notifyUsers ? 1 : 0, // Simplified
          validationWarnings: [],
        },
      } as KBEntryUpdateResponse;
    } catch (error) {
      console.error('Entry update error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Entry update failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Handle KB entry deletion
   */
  handleEntryDelete: IPCHandlerFunction<'kb:entry:delete'> = async request => {
    const startTime = Date.now();

    try {
      const { id, options = {} } = request;

      // Validate ID
      if (!this.isValidUUID(id)) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Invalid entry ID format'
        );
      }

      // Check if entry exists
      const existingEntry = await this.getEntryById(id);
      if (!existingEntry) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Entry with ID ${id} not found`
        );
      }

      // Perform deletion (soft or hard)
      if (options.softDelete) {
        // Soft delete - mark as archived
        await this.dbManager.query(
          'UPDATE kb_entries SET archived = 1, archived_at = ?, archived_reason = ? WHERE id = ?',
          [new Date().toISOString(), options.reason || 'User deleted', id]
        );
      } else {
        // Hard delete with transaction
        await this.dbManager.transaction(async db => {
          // Delete tags first (foreign key constraint)
          db.prepare('DELETE FROM kb_tags WHERE entry_id = ?').run(id);

          // Delete from FTS index
          db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);

          // Delete usage metrics
          db.prepare('DELETE FROM usage_metrics WHERE entry_id = ?').run(id);

          // Delete entry
          db.prepare('DELETE FROM kb_entries WHERE id = ?').run(id);
        });
      }

      // Invalidate caches
      await this.cacheManager.invalidateByTags([
        'kb-search',
        'kb-entries',
        `entry:${id}`,
        `category:${existingEntry.category}`,
      ]);

      // Log deletion
      console.log(`🗑️ ${options.softDelete ? 'Archived' : 'Deleted'} KB entry: ${id}`);

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
      } as BaseIPCResponse;
    } catch (error) {
      console.error('Entry deletion error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Entry deletion failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  /**
   * Handle user feedback
   */
  handleFeedback: IPCHandlerFunction<'kb:feedback:rate'> = async request => {
    const startTime = Date.now();

    try {
      const { entryId, rating, comment, context } = request;

      // Validate entry exists
      const entry = await this.getEntryById(entryId);
      if (!entry) {
        return this.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.ENTRY_NOT_FOUND,
          `Entry with ID ${entryId} not found`
        );
      }

      // Record feedback with transaction
      await this.dbManager.transaction(async db => {
        // Update success/failure counts
        const isHelpful = rating === 'helpful';
        const updateSql = `
          UPDATE kb_entries 
          SET ${isHelpful ? 'success_count = success_count + 1' : 'failure_count = failure_count + 1'},
              usage_count = usage_count + 1,
              updated_at = ?
          WHERE id = ?
        `;

        db.prepare(updateSql).run(new Date().toISOString(), entryId);

        // Record detailed feedback
        db.prepare(
          `
          INSERT INTO kb_feedback (
            entry_id, rating, comment, search_query, problem_resolved, 
            time_to_resolve, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          entryId,
          rating,
          comment || null,
          context?.searchQuery || null,
          context?.problemResolved ? 1 : 0,
          context?.timeToResolve || null,
          new Date().toISOString()
        );
      });

      // Invalidate entry cache
      await this.cacheManager.invalidateByTags([`entry:${entryId}`]);

      // Log feedback
      console.log(`📝 Recorded feedback for KB entry: ${entryId} (${rating})`);

      return {
        success: true,
        requestId: request.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
      } as BaseIPCResponse;
    } catch (error) {
      console.error('Feedback recording error:', error);
      return this.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Feedback recording failed: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  };

  // Private helper methods

  private buildSearchQuery(query: string, options: any): { sql: string; params: any[] } {
    const { categories, tags, includeArchived, sortBy, sortOrder, limit, offset } = options;

    let sql = `
      SELECT 
        e.*,
        GROUP_CONCAT(t.tag) as tags,
        bm25(kb_fts) as fts_score
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ?
    `;

    const params: any[] = [query];

    // Add filters
    if (!includeArchived) {
      sql += ' AND (e.archived IS NULL OR e.archived = 0)';
    }

    if (categories && categories.length > 0) {
      sql += ` AND e.category IN (${categories.map(() => '?').join(',')})`;
      params.push(...categories);
    }

    if (tags && tags.length > 0) {
      sql += ` AND EXISTS (
        SELECT 1 FROM kb_tags kt 
        WHERE kt.entry_id = e.id AND kt.tag IN (${tags.map(() => '?').join(',')})
      )`;
      params.push(...tags);
    }

    sql += ' GROUP BY e.id';

    // Add sorting
    const orderByMap = {
      relevance: 'fts_score ASC',
      date: 'e.created_at',
      usage: 'e.usage_count',
      rating: '(CAST(e.success_count AS REAL) / NULLIF(e.success_count + e.failure_count, 0))',
    };

    const orderBy = orderByMap[sortBy as keyof typeof orderByMap] || orderByMap.relevance;
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${orderBy} ${order}`;

    // Add pagination
    sql += ` LIMIT ${limit || 20}`;
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

    return { sql, params };
  }

  private calculateSearchScores(entries: KBEntry[], query: string, options: any): SearchResult[] {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);

    return entries
      .map(entry => {
        let score = 0;
        const highlights: string[] = [];

        // Text content for scoring
        const content = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();

        // Exact phrase match
        if (content.includes(query.toLowerCase())) {
          score += 50;
          highlights.push(query);
        }

        // Word matches
        queryWords.forEach(word => {
          if (content.includes(word)) {
            score += 10;
            highlights.push(word);
          }
        });

        // Category match
        if (entry.category.toLowerCase().includes(query.toLowerCase())) {
          score += 20;
        }

        // Tag matches
        entry.tags.forEach(tag => {
          if (queryWords.some(word => tag.toLowerCase().includes(word))) {
            score += 15;
          }
        });

        // Usage boost
        score += Math.min(entry.usage_count, 10);

        // Success rate boost
        const totalFeedback = entry.success_count + entry.failure_count;
        if (totalFeedback > 0) {
          const successRate = entry.success_count / totalFeedback;
          score += successRate * 10;
        }

        return {
          entry,
          score: Math.min(100, score),
          matchType: 'fuzzy' as const,
          highlights: [...new Set(highlights)],
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private transformRowToKBEntry(row: any): KBEntry {
    return {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category as KBCategory,
      tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by || 'system',
      usage_count: row.usage_count || 0,
      success_count: row.success_count || 0,
      failure_count: row.failure_count || 0,
      version: row.version || 1,
    };
  }

  private validateEntryInput(entry: KBEntryInput): { valid: boolean; error?: string } {
    if (!entry.title || entry.title.trim().length === 0) {
      return { valid: false, error: 'Title is required' };
    }

    if (entry.title.length > 255) {
      return { valid: false, error: 'Title must be less than 255 characters' };
    }

    if (!entry.problem || entry.problem.trim().length === 0) {
      return { valid: false, error: 'Problem description is required' };
    }

    if (!entry.solution || entry.solution.trim().length === 0) {
      return { valid: false, error: 'Solution is required' };
    }

    if (!entry.category) {
      return { valid: false, error: 'Category is required' };
    }

    const validCategories: KBCategory[] = [
      'JCL',
      'VSAM',
      'DB2',
      'Batch',
      'Functional',
      'IMS',
      'CICS',
      'System',
      'Other',
    ];

    if (!validCategories.includes(entry.category)) {
      return { valid: false, error: 'Invalid category' };
    }

    if (entry.tags && entry.tags.length > 20) {
      return { valid: false, error: 'Maximum 20 tags allowed' };
    }

    return { valid: true };
  }

  private validateEntryUpdates(updates: any): { valid: boolean; error?: string } {
    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string' || updates.title.trim().length === 0) {
        return { valid: false, error: 'Title must be a non-empty string' };
      }
      if (updates.title.length > 255) {
        return { valid: false, error: 'Title must be less than 255 characters' };
      }
    }

    if (
      updates.problem !== undefined &&
      (typeof updates.problem !== 'string' || updates.problem.trim().length === 0)
    ) {
      return { valid: false, error: 'Problem must be a non-empty string' };
    }

    if (
      updates.solution !== undefined &&
      (typeof updates.solution !== 'string' || updates.solution.trim().length === 0)
    ) {
      return { valid: false, error: 'Solution must be a non-empty string' };
    }

    if (updates.category !== undefined) {
      const validCategories: KBCategory[] = [
        'JCL',
        'VSAM',
        'DB2',
        'Batch',
        'Functional',
        'IMS',
        'CICS',
        'System',
        'Other',
      ];

      if (!validCategories.includes(updates.category)) {
        return { valid: false, error: 'Invalid category' };
      }
    }

    if (updates.tags !== undefined && (!Array.isArray(updates.tags) || updates.tags.length > 20)) {
      return { valid: false, error: 'Tags must be an array with maximum 20 items' };
    }

    return { valid: true };
  }

  private async getEntryById(id: string): Promise<KBEntry | null> {
    const sql = `
      SELECT 
        e.*,
        GROUP_CONCAT(t.tag) as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.id = ?
      GROUP BY e.id
    `;

    const result = await this.dbManager.query<any[]>(sql, [id]);

    if (!result.data || result.data.length === 0) {
      return null;
    }

    return this.transformRowToKBEntry(result.data[0]);
  }

  private async findSimilarEntries(entry: KBEntryInput): Promise<KBEntry[]> {
    // Simple similarity check based on title similarity
    const sql = `
      SELECT e.*, GROUP_CONCAT(t.tag) as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE e.category = ? 
      AND (
        LOWER(e.title) LIKE LOWER(?) OR
        LOWER(e.problem) LIKE LOWER(?)
      )
      GROUP BY e.id
      LIMIT 5
    `;

    const titlePattern = `%${entry.title.substring(0, 20)}%`;
    const problemPattern = `%${entry.problem.substring(0, 50)}%`;

    const result = await this.dbManager.query<any[]>(sql, [
      entry.category,
      titlePattern,
      problemPattern,
    ]);

    return result.data ? result.data.map(row => this.transformRowToKBEntry(row)) : [];
  }

  private async findRelatedEntries(entry: KBEntry): Promise<KBEntry[]> {
    // Find entries with similar tags or category
    const sql = `
      SELECT DISTINCT e.*, GROUP_CONCAT(t.tag) as tags
      FROM kb_entries e
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      LEFT JOIN kb_tags rt ON rt.entry_id = e.id
      WHERE e.id != ? 
      AND (
        e.category = ? OR
        rt.tag IN (${entry.tags.map(() => '?').join(',')})
      )
      GROUP BY e.id
      ORDER BY e.usage_count DESC
      LIMIT 5
    `;

    const params = [entry.id, entry.category, ...entry.tags];
    const result = await this.dbManager.query<any[]>(sql, params);

    return result.data ? result.data.map(row => this.transformRowToKBEntry(row)) : [];
  }

  private generateAutoTags(entry: KBEntryInput): string[] {
    const tags: string[] = [];
    const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();

    // Common mainframe terms
    const mainframeTerms = {
      'job control language': ['jcl'],
      vsam: ['vsam'],
      db2: ['db2', 'sql'],
      cobol: ['cobol'],
      cics: ['cics'],
      ims: ['ims'],
      s0c: ['abend', 'system-error'],
      sql: ['database', 'query'],
      dataset: ['data', 'file'],
      batch: ['batch-job'],
      error: ['troubleshooting'],
      performance: ['optimization'],
    };

    Object.entries(mainframeTerms).forEach(([term, tagList]) => {
      if (text.includes(term)) {
        tags.push(...tagList);
      }
    });

    return [...new Set(tags)]; // Remove duplicates
  }

  private async recordSearchMetrics(
    query: string,
    resultCount: number,
    searchType: string,
    executionTime: number
  ): Promise<void> {
    try {
      await this.dbManager.query(
        'INSERT INTO search_history (query, results_count, search_type, execution_time, timestamp) VALUES (?, ?, ?, ?, ?)',
        [query, resultCount, searchType, executionTime, new Date().toISOString()]
      );
    } catch (error) {
      console.warn('Failed to record search metrics:', error);
    }
  }

  private async recordEntryView(entryId: string): Promise<void> {
    try {
      await this.dbManager.query(
        'UPDATE kb_entries SET usage_count = usage_count + 1 WHERE id = ?',
        [entryId]
      );
    } catch (error) {
      console.warn('Failed to record entry view:', error);
    }
  }

  private async createEntryRevision(entry: KBEntry, reason?: string): Promise<string> {
    const revisionId = uuidv4();

    await this.dbManager.query(
      `
      INSERT INTO kb_revisions (
        revision_id, entry_id, title, problem, solution, category, tags,
        created_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        revisionId,
        entry.id,
        entry.title,
        entry.problem,
        entry.solution,
        entry.category,
        JSON.stringify(entry.tags),
        new Date().toISOString(),
        reason || 'Entry updated',
      ]
    );

    return revisionId;
  }

  private generateSearchCacheKey(type: string, query: string, options: any): string {
    const key = `search:${type}:${query}:${JSON.stringify(options)}`;
    return Buffer.from(key).toString('base64');
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private createErrorResponse(
    requestId: string,
    startTime: number,
    code: IPCErrorCode,
    message: string,
    details?: any
  ): BaseIPCResponse {
    return {
      success: false,
      requestId,
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      error: {
        code,
        message,
        details,
        severity: 'medium',
        retryable: false,
      },
    };
  }
}
