/**
 * Knowledge Base Database Model
 * Enhanced database model with validation, error handling, and type safety
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  KBEntry,
  CreateKBEntry,
  UpdateKBEntry,
  SearchQuery,
  SearchResult,
  SearchWithFacets,
  EntryFeedback,
  UsageMetric,
  SearchHistory,
  DatabaseStats,
  SchemaValidator,
  DatabaseSchemas,
  KBCategory,
  SearchMatchType,
  SeverityLevel,
} from '../schemas/KnowledgeBase.schema';
import { AppError, ErrorCode } from '../../core/errors/AppError';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { QueryOptimizer } from '../QueryOptimizer';

/**
 * Database transaction wrapper with error handling
 */
type TransactionCallback<T> = () => T;

/**
 * Database operation result wrapper
 */
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  performance?: {
    executionTime: number;
    queriesExecuted: number;
    cacheHit: boolean;
  };
}

/**
 * Enhanced Knowledge Base Model with comprehensive validation and error handling
 */
export class KnowledgeBaseModel {
  private db: Database.Database;
  private performanceMonitor: PerformanceMonitor;
  private queryOptimizer: QueryOptimizer;

  // Prepared statements for optimal performance
  private readonly statements = {
    insertEntry: null as Database.Statement | null,
    updateEntry: null as Database.Statement | null,
    selectById: null as Database.Statement | null,
    deleteById: null as Database.Statement | null,
    insertTag: null as Database.Statement | null,
    deleteEntryTags: null as Database.Statement | null,
    insertFeedback: null as Database.Statement | null,
    insertUsageMetric: null as Database.Statement | null,
    insertSearchHistory: null as Database.Statement | null,
  };

  constructor(
    db: Database.Database,
    performanceMonitor: PerformanceMonitor,
    queryOptimizer: QueryOptimizer
  ) {
    this.db = db;
    this.performanceMonitor = performanceMonitor;
    this.queryOptimizer = queryOptimizer;
    this.initializePreparedStatements();
  }

  /**
   * Initialize prepared statements for optimal performance
   */
  private initializePreparedStatements(): void {
    try {
      this.statements.insertEntry = this.db.prepare(`
        INSERT INTO kb_entries (
          id, title, problem, solution, category, severity, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      this.statements.updateEntry = this.db.prepare(`
        UPDATE kb_entries 
        SET title = ?, problem = ?, solution = ?, category = ?, severity = ?, 
            archived = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      this.statements.selectById = this.db.prepare(`
        SELECT 
          e.*,
          GROUP_CONCAT(t.tag, ',') as tags
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.id = ?
        GROUP BY e.id
      `);

      this.statements.deleteById = this.db.prepare(`
        DELETE FROM kb_entries WHERE id = ?
      `);

      this.statements.insertTag = this.db.prepare(`
        INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)
      `);

      this.statements.deleteEntryTags = this.db.prepare(`
        DELETE FROM kb_tags WHERE entry_id = ?
      `);

      this.statements.insertFeedback = this.db.prepare(`
        INSERT INTO entry_feedback (
          id, entry_id, user_id, rating, successful, comment, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      this.statements.insertUsageMetric = this.db.prepare(`
        INSERT INTO usage_metrics (
          entry_id, action, user_id, session_id, metadata
        ) VALUES (?, ?, ?, ?, ?)
      `);

      this.statements.insertSearchHistory = this.db.prepare(`
        INSERT INTO search_history (
          query, normalized_query, results_count, selected_entry_id, 
          user_id, session_id, search_time_ms, filters_used, ai_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    } catch (error) {
      throw new AppError(
        ErrorCode.DATABASE_INITIALIZATION_ERROR,
        'Failed to initialize prepared statements',
        { originalError: error }
      );
    }
  }

  // ===========================
  // KB ENTRY OPERATIONS
  // ===========================

  /**
   * Create a new knowledge base entry with full validation
   */
  async createEntry(entryData: CreateKBEntry, userId?: string): Promise<DatabaseResult<string>> {
    return this.executeWithPerformanceTracking('createEntry', async () => {
      // Validate input data
      const validationResult = SchemaValidator.safeParse(DatabaseSchemas.CreateKBEntry, entryData);

      if (!validationResult.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid KB entry data', {
          validationErrors: validationResult.error,
        });
      }

      const validatedData = validationResult.data!;
      const id = uuidv4();

      // Execute in transaction
      const transaction = this.db.transaction(() => {
        try {
          // Insert main entry
          this.statements.insertEntry!.run(
            id,
            validatedData.title,
            validatedData.problem,
            validatedData.solution,
            validatedData.category,
            validatedData.severity || 'medium',
            userId || 'system'
          );

          // Insert tags if provided
          if (validatedData.tags && validatedData.tags.length > 0) {
            for (const tag of validatedData.tags) {
              this.statements.insertTag!.run(id, tag.toLowerCase().trim());
            }
          }

          // Update FTS index
          this.updateFTSIndex(id, validatedData);

          return id;
        } catch (error) {
          throw new AppError(ErrorCode.DATABASE_INSERT_ERROR, 'Failed to create KB entry', {
            entryId: id,
            originalError: error,
          });
        }
      });

      const result = transaction();

      // Log creation event
      this.logUsageMetric({
        entry_id: result,
        action: 'create',
        user_id: userId,
        timestamp: new Date(),
      });

      return result;
    });
  }

  /**
   * Update an existing knowledge base entry
   */
  async updateEntry(
    id: string,
    updates: UpdateKBEntry,
    userId?: string
  ): Promise<DatabaseResult<void>> {
    return this.executeWithPerformanceTracking('updateEntry', async () => {
      // Validate input data
      const validationResult = SchemaValidator.safeParse(DatabaseSchemas.UpdateKBEntry, updates);

      if (!validationResult.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid update data', {
          validationErrors: validationResult.error,
        });
      }

      const validatedUpdates = validationResult.data!;

      // Check if entry exists
      const existingEntry = await this.getEntryById(id);
      if (!existingEntry.success || !existingEntry.data) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'KB entry not found', { entryId: id });
      }

      // Execute in transaction
      const transaction = this.db.transaction(() => {
        try {
          // Update main entry if any core fields changed
          if (
            validatedUpdates.title !== undefined ||
            validatedUpdates.problem !== undefined ||
            validatedUpdates.solution !== undefined ||
            validatedUpdates.category !== undefined ||
            validatedUpdates.severity !== undefined ||
            validatedUpdates.archived !== undefined
          ) {
            this.statements.updateEntry!.run(
              validatedUpdates.title ?? existingEntry.data!.title,
              validatedUpdates.problem ?? existingEntry.data!.problem,
              validatedUpdates.solution ?? existingEntry.data!.solution,
              validatedUpdates.category ?? existingEntry.data!.category,
              validatedUpdates.severity ?? existingEntry.data!.severity,
              validatedUpdates.archived ?? existingEntry.data!.archived,
              id
            );
          }

          // Update tags if provided
          if (validatedUpdates.tags !== undefined) {
            // Remove existing tags
            this.statements.deleteEntryTags!.run(id);

            // Add new tags
            if (validatedUpdates.tags.length > 0) {
              for (const tag of validatedUpdates.tags) {
                this.statements.insertTag!.run(id, tag.toLowerCase().trim());
              }
            }
          }

          // Update FTS index if content changed
          if (
            validatedUpdates.title !== undefined ||
            validatedUpdates.problem !== undefined ||
            validatedUpdates.solution !== undefined ||
            validatedUpdates.tags !== undefined
          ) {
            this.updateFTSIndex(id, {
              title: validatedUpdates.title ?? existingEntry.data!.title,
              problem: validatedUpdates.problem ?? existingEntry.data!.problem,
              solution: validatedUpdates.solution ?? existingEntry.data!.solution,
              tags: validatedUpdates.tags ?? existingEntry.data!.tags,
            });
          }
        } catch (error) {
          throw new AppError(ErrorCode.DATABASE_UPDATE_ERROR, 'Failed to update KB entry', {
            entryId: id,
            originalError: error,
          });
        }
      });

      transaction();

      // Log update event
      this.logUsageMetric({
        entry_id: id,
        action: 'update',
        user_id: userId,
        timestamp: new Date(),
      });
    });
  }

  /**
   * Get KB entry by ID with full type safety
   */
  async getEntryById(id: string): Promise<DatabaseResult<KBEntry>> {
    return this.executeWithPerformanceTracking('getEntryById', async () => {
      if (!id || typeof id !== 'string') {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid entry ID', { entryId: id });
      }

      try {
        const row = this.statements.selectById!.get(id) as any;

        if (!row) {
          throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'KB entry not found', { entryId: id });
        }

        // Transform database row to KBEntry
        const entry: KBEntry = {
          id: row.id,
          title: row.title,
          problem: row.problem,
          solution: row.solution,
          category: row.category as KBCategory,
          severity: row.severity as SeverityLevel,
          tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
          created_by: row.created_by,
          usage_count: row.usage_count || 0,
          success_count: row.success_count || 0,
          failure_count: row.failure_count || 0,
          last_used: row.last_used ? new Date(row.last_used) : undefined,
          archived: Boolean(row.archived),
        };

        // Validate the constructed entry
        const validationResult = SchemaValidator.safeParse(DatabaseSchemas.KBEntry, entry);

        if (!validationResult.success) {
          throw new AppError(
            ErrorCode.DATA_CONSISTENCY_ERROR,
            'Entry data validation failed after retrieval',
            { entryId: id, validationErrors: validationResult.error }
          );
        }

        // Log view event
        this.logUsageMetric({
          entry_id: id,
          action: 'view',
          timestamp: new Date(),
        });

        return validationResult.data!;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(ErrorCode.DATABASE_QUERY_ERROR, 'Failed to retrieve KB entry', {
          entryId: id,
          originalError: error,
        });
      }
    });
  }

  /**
   * Delete KB entry with cascade handling
   */
  async deleteEntry(id: string, userId?: string): Promise<DatabaseResult<void>> {
    return this.executeWithPerformanceTracking('deleteEntry', async () => {
      // Check if entry exists first
      const existingEntry = await this.getEntryById(id);
      if (!existingEntry.success || !existingEntry.data) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'KB entry not found', { entryId: id });
      }

      const transaction = this.db.transaction(() => {
        try {
          // Delete related records first (cascade)
          this.statements.deleteEntryTags!.run(id);

          // Delete feedback records
          this.db.prepare('DELETE FROM entry_feedback WHERE entry_id = ?').run(id);

          // Delete usage metrics
          this.db.prepare('DELETE FROM usage_metrics WHERE entry_id = ?').run(id);

          // Update search history to remove references
          this.db
            .prepare(
              `
            UPDATE search_history 
            SET selected_entry_id = NULL 
            WHERE selected_entry_id = ?
          `
            )
            .run(id);

          // Remove from FTS index
          this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);

          // Finally delete the main entry
          const result = this.statements.deleteById!.run(id);

          if (result.changes === 0) {
            throw new Error('Entry not found or already deleted');
          }
        } catch (error) {
          throw new AppError(ErrorCode.DATABASE_DELETE_ERROR, 'Failed to delete KB entry', {
            entryId: id,
            originalError: error,
          });
        }
      });

      transaction();

      // Log deletion event
      this.logUsageMetric({
        entry_id: id,
        action: 'delete',
        user_id: userId,
        timestamp: new Date(),
      });
    });
  }

  // ===========================
  // SEARCH OPERATIONS
  // ===========================

  /**
   * Perform advanced search with comprehensive validation and performance tracking
   */
  async search(searchQuery: SearchQuery): Promise<DatabaseResult<SearchResult[]>> {
    return this.executeWithPerformanceTracking('search', async () => {
      // Validate search query
      const validationResult = SchemaValidator.safeParse(DatabaseSchemas.SearchQuery, searchQuery);

      if (!validationResult.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid search query', {
          validationErrors: validationResult.error,
        });
      }

      const validatedQuery = validationResult.data!;

      try {
        // Use QueryOptimizer for performance
        const searchResults = await this.queryOptimizer.executeOptimizedSearch(validatedQuery);

        // Validate search results
        const results: SearchResult[] = searchResults.map(row => ({
          entry: this.transformRowToKBEntry(row),
          score: Math.min(100, Math.max(0, row.relevance_score || 0)),
          matchType: this.determineMatchType(validatedQuery, row),
          highlights: this.generateHighlights(validatedQuery.query, row),
          executionTime: row.execution_time,
        }));

        // Log search
        this.logSearchHistory({
          query: validatedQuery.query,
          normalized_query: this.normalizeQuery(validatedQuery.query),
          results_count: results.length,
          filters_used: this.extractFilters(validatedQuery),
          ai_used: validatedQuery.useAI,
          search_time_ms: Date.now(),
        });

        return results;
      } catch (error) {
        throw new AppError(ErrorCode.SEARCH_ERROR, 'Search operation failed', {
          query: validatedQuery.query,
          originalError: error,
        });
      }
    });
  }

  /**
   * Perform search with facets
   */
  async searchWithFacets(searchQuery: SearchQuery): Promise<DatabaseResult<SearchWithFacets>> {
    return this.executeWithPerformanceTracking('searchWithFacets', async () => {
      const searchResults = await this.search(searchQuery);

      if (!searchResults.success) {
        throw searchResults.error!;
      }

      // Calculate facets
      const facets = await this.calculateFacets(searchQuery.query, searchQuery);

      const result: SearchWithFacets = {
        results: searchResults.data!,
        facets,
        totalCount: searchResults.data!.length,
        executionTime: searchResults.performance?.executionTime,
      };

      return result;
    });
  }

  // ===========================
  // FEEDBACK AND USAGE TRACKING
  // ===========================

  /**
   * Record entry feedback with validation
   */
  async recordFeedback(feedback: EntryFeedback): Promise<DatabaseResult<string>> {
    return this.executeWithPerformanceTracking('recordFeedback', async () => {
      const validationResult = SchemaValidator.safeParse(DatabaseSchemas.EntryFeedback, feedback);

      if (!validationResult.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid feedback data', {
          validationErrors: validationResult.error,
        });
      }

      const validatedFeedback = validationResult.data!;
      const feedbackId = uuidv4();

      try {
        this.statements.insertFeedback!.run(
          feedbackId,
          validatedFeedback.entry_id,
          validatedFeedback.user_id,
          validatedFeedback.rating,
          validatedFeedback.successful,
          validatedFeedback.comment,
          validatedFeedback.session_id
        );

        // Update entry success/failure counts
        this.updateEntryMetrics(validatedFeedback.entry_id, validatedFeedback.successful);

        return feedbackId;
      } catch (error) {
        throw new AppError(ErrorCode.DATABASE_INSERT_ERROR, 'Failed to record feedback', {
          originalError: error,
        });
      }
    });
  }

  /**
   * Record usage metric
   */
  private async logUsageMetric(metric: Partial<UsageMetric>): Promise<void> {
    try {
      if (!this.statements.insertUsageMetric) return;

      this.statements.insertUsageMetric.run(
        metric.entry_id,
        metric.action,
        metric.user_id || 'anonymous',
        metric.session_id,
        metric.metadata ? JSON.stringify(metric.metadata) : null
      );
    } catch (error) {
      // Non-critical error, don't throw
      console.warn('Failed to log usage metric:', error);
    }
  }

  /**
   * Record search history
   */
  private async logSearchHistory(history: Partial<SearchHistory>): Promise<void> {
    try {
      if (!this.statements.insertSearchHistory) return;

      this.statements.insertSearchHistory.run(
        history.query,
        history.normalized_query,
        history.results_count,
        history.selected_entry_id,
        history.user_id || 'anonymous',
        history.session_id,
        history.search_time_ms,
        history.filters_used ? JSON.stringify(history.filters_used) : null,
        history.ai_used
      );
    } catch (error) {
      // Non-critical error, don't throw
      console.warn('Failed to log search history:', error);
    }
  }

  // ===========================
  // STATISTICS AND HEALTH
  // ===========================

  /**
   * Get comprehensive database statistics
   */
  async getStatistics(): Promise<DatabaseResult<DatabaseStats>> {
    return this.executeWithPerformanceTracking('getStatistics', async () => {
      try {
        const basicStats = this.db
          .prepare(
            `
          SELECT 
            COUNT(*) as totalEntries,
            COUNT(CASE WHEN last_used > datetime('now', '-7 days') THEN 1 END) as recentActivity,
            AVG(CASE WHEN (success_count + failure_count) > 0 
                     THEN CAST(success_count AS REAL) / (success_count + failure_count) * 100
                     ELSE 0 END) as averageSuccessRate
          FROM kb_entries
          WHERE archived = FALSE
        `
          )
          .get() as any;

        const categoryCounts = this.db
          .prepare(
            `
          SELECT category, COUNT(*) as count
          FROM kb_entries
          WHERE archived = FALSE
          GROUP BY category
        `
          )
          .all() as Array<{ category: string; count: number }>;

        const searchesToday = this.db
          .prepare(
            `
          SELECT COUNT(*) as count
          FROM search_history
          WHERE date(timestamp) = date('now')
        `
          )
          .get() as { count: number };

        const topEntries = this.db
          .prepare(
            `
          SELECT id, title, usage_count, 
                 CASE WHEN (success_count + failure_count) > 0 
                      THEN CAST(success_count AS REAL) / (success_count + failure_count) * 100
                      ELSE 0 END as success_rate
          FROM kb_entries
          WHERE archived = FALSE
          ORDER BY usage_count DESC, success_rate DESC
          LIMIT 10
        `
          )
          .all() as Array<{ id: string; title: string; usage_count: number; success_rate: number }>;

        const diskUsage = this.getDiskUsage();
        const performanceStats = this.performanceMonitor.getStats();
        const healthStatus = await this.checkHealth();

        const categoryMap: Record<string, number> = {};
        categoryCounts.forEach(cat => {
          categoryMap[cat.category] = cat.count;
        });

        const stats: DatabaseStats = {
          totalEntries: basicStats.totalEntries || 0,
          categoryCounts: categoryMap,
          recentActivity: basicStats.recentActivity || 0,
          searchesToday: searchesToday.count || 0,
          averageSuccessRate: Math.round(basicStats.averageSuccessRate || 0),
          topEntries,
          diskUsage,
          performance: {
            avgSearchTime: performanceStats.avgSearchTime || 0,
            cacheHitRate: performanceStats.cacheHitRate || 0,
            slowQueries: performanceStats.slowQueries || 0,
            errorRate: performanceStats.errorRate || 0,
          },
          healthStatus,
          timestamp: new Date(),
        };

        // Validate statistics
        const validationResult = SchemaValidator.safeParse(DatabaseSchemas.DatabaseStats, stats);

        if (!validationResult.success) {
          throw new AppError(ErrorCode.DATA_CONSISTENCY_ERROR, 'Statistics validation failed', {
            validationErrors: validationResult.error,
          });
        }

        return validationResult.data!;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(ErrorCode.DATABASE_QUERY_ERROR, 'Failed to retrieve statistics', {
          originalError: error,
        });
      }
    });
  }

  // ===========================
  // PRIVATE HELPER METHODS
  // ===========================

  /**
   * Execute operation with performance tracking and error handling
   */
  private async executeWithPerformanceTracking<T>(
    operation: string,
    callback: () => Promise<T> | T
  ): Promise<DatabaseResult<T>> {
    const startTime = Date.now();
    let cacheHit = false;
    let queriesExecuted = 0;

    try {
      const result = await callback();
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        performance: {
          executionTime,
          queriesExecuted,
          cacheHit,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Log performance data even for errors
      this.performanceMonitor.recordOperation(operation, executionTime, false);

      if (error instanceof AppError) {
        return {
          success: false,
          error,
          performance: {
            executionTime,
            queriesExecuted,
            cacheHit,
          },
        };
      }

      return {
        success: false,
        error: new AppError(ErrorCode.UNKNOWN_ERROR, `Operation ${operation} failed`, {
          originalError: error,
        }),
        performance: {
          executionTime,
          queriesExecuted,
          cacheHit,
        },
      };
    }
  }

  /**
   * Transform database row to KBEntry with validation
   */
  private transformRowToKBEntry(row: any): KBEntry {
    const entry: KBEntry = {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category as KBCategory,
      severity: row.severity as SeverityLevel,
      tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      usage_count: row.usage_count || 0,
      success_count: row.success_count || 0,
      failure_count: row.failure_count || 0,
      last_used: row.last_used ? new Date(row.last_used) : undefined,
      archived: Boolean(row.archived),
    };

    // Validate before returning
    const validationResult = SchemaValidator.safeParse(DatabaseSchemas.KBEntry, entry);
    if (!validationResult.success) {
      throw new AppError(ErrorCode.DATA_CONSISTENCY_ERROR, 'Invalid entry data from database', {
        entryId: row.id,
        validationErrors: validationResult.error,
      });
    }

    return entry;
  }

  /**
   * Update FTS search index
   */
  private updateFTSIndex(id: string, data: any): void {
    try {
      // Remove existing FTS entry
      this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);

      // Insert new FTS entry
      this.db
        .prepare(
          `
        INSERT INTO kb_fts (id, title, problem, solution, tags)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(
          id,
          data.title || '',
          data.problem || '',
          data.solution || '',
          Array.isArray(data.tags) ? data.tags.join(' ') : data.tags || ''
        );
    } catch (error) {
      console.warn('Failed to update FTS index:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Update entry usage metrics
   */
  private updateEntryMetrics(entryId: string, successful: boolean): void {
    try {
      const updateQuery = successful
        ? 'UPDATE kb_entries SET usage_count = usage_count + 1, success_count = success_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?'
        : 'UPDATE kb_entries SET usage_count = usage_count + 1, failure_count = failure_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?';

      this.db.prepare(updateQuery).run(entryId);
    } catch (error) {
      console.warn('Failed to update entry metrics:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Additional helper methods for search functionality
   */
  private determineMatchType(query: SearchQuery, row: any): SearchMatchType {
    // Implementation for match type determination
    if (query.query === row.title) return 'exact';
    if (query.category && query.category === row.category) return 'category';
    if (query.useAI) return 'ai';
    return 'fuzzy';
  }

  private generateHighlights(query: string, row: any): string[] {
    // Simple highlight generation
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();

    [row.title, row.problem, row.solution].forEach(field => {
      if (field && field.toLowerCase().includes(queryLower)) {
        const index = field.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, index - 30);
        const end = Math.min(field.length, index + query.length + 30);
        highlights.push(field.substring(start, end));
      }
    });

    return highlights.slice(0, 3);
  }

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private extractFilters(query: SearchQuery): Record<string, any> {
    return {
      category: query.category,
      severity: query.severity,
      tags: query.tags,
      sortBy: query.sortBy,
      dateRange: query.dateRange,
    };
  }

  private async calculateFacets(query: string, options: SearchQuery): Promise<any> {
    // Implementation for facet calculation
    const baseWhere = 'WHERE archived = FALSE';

    return {
      categories: this.db
        .prepare(
          `
        SELECT category as name, COUNT(*) as count
        FROM kb_entries ${baseWhere}
        GROUP BY category
        ORDER BY count DESC
      `
        )
        .all(),
      tags: this.db
        .prepare(
          `
        SELECT t.tag as name, COUNT(*) as count
        FROM kb_tags t
        JOIN kb_entries e ON t.entry_id = e.id
        ${baseWhere}
        GROUP BY t.tag
        ORDER BY count DESC
        LIMIT 15
      `
        )
        .all(),
      severities: this.db
        .prepare(
          `
        SELECT severity as name, COUNT(*) as count
        FROM kb_entries ${baseWhere}
        GROUP BY severity
        ORDER BY count DESC
      `
        )
        .all(),
    };
  }

  private getDiskUsage(): number {
    try {
      const stats = require('fs').statSync(this.db.name);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async checkHealth(): Promise<any> {
    try {
      // Basic health checks
      this.db.prepare('SELECT 1').get();

      return {
        overall: 'healthy' as const,
        database: true,
        cache: true,
        indexes: true,
        backup: true,
        issues: [],
      };
    } catch {
      return {
        overall: 'critical' as const,
        database: false,
        cache: false,
        indexes: false,
        backup: false,
        issues: ['Database connection failed'],
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Close prepared statements
    Object.values(this.statements).forEach(stmt => {
      if (stmt) {
        try {
          stmt.finalize();
        } catch (error) {
          console.warn('Error finalizing statement:', error);
        }
      }
    });
  }
}

export default KnowledgeBaseModel;
