/**
 * Knowledge Base Repository Implementation
 * Repository pattern with full type safety, validation, and error handling
 */

import Database from 'better-sqlite3';
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
  KBCategory,
  SearchMatchType,
} from '../schemas/KnowledgeBase.schema';
import {
  SearchOptions,
  QueryPerformanceMetrics,
  PerformanceSchemaValidator,
} from '../schemas/PerformanceOptimization.schema';
import { AppError, ErrorCode, ErrorUtils } from '../../core/errors/AppError';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository operation result with comprehensive error handling
 */
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  metadata?: {
    executionTime: number;
    cacheHit: boolean;
    affectedRows?: number;
    queryHash?: string;
  };
}

/**
 * Base repository interface for type safety
 */
export interface IRepository<T, CreateT = Omit<T, 'id'>, UpdateT = Partial<T>> {
  findById(id: string): Promise<RepositoryResult<T>>;
  findAll(options?: { limit?: number; offset?: number }): Promise<RepositoryResult<T[]>>;
  create(data: CreateT): Promise<RepositoryResult<T>>;
  update(id: string, data: UpdateT): Promise<RepositoryResult<T>>;
  delete(id: string): Promise<RepositoryResult<void>>;
  count(filters?: any): Promise<RepositoryResult<number>>;
}

/**
 * Knowledge Base specific repository interface
 */
export interface IKnowledgeBaseRepository
  extends IRepository<KBEntry, CreateKBEntry, UpdateKBEntry> {
  // Search operations
  search(query: SearchQuery): Promise<RepositoryResult<SearchResult[]>>;
  searchWithFacets(query: SearchQuery): Promise<RepositoryResult<SearchWithFacets>>;
  autoComplete(
    query: string,
    limit?: number
  ): Promise<
    RepositoryResult<
      Array<{
        suggestion: string;
        category: string;
        score: number;
      }>
    >
  >;

  // Category and tag operations
  findByCategory(
    category: KBCategory,
    options?: SearchOptions
  ): Promise<RepositoryResult<SearchResult[]>>;
  findByTags(tags: string[], options?: SearchOptions): Promise<RepositoryResult<SearchResult[]>>;
  getAllCategories(): Promise<RepositoryResult<Array<{ name: string; count: number }>>>;
  getAllTags(): Promise<RepositoryResult<Array<{ name: string; count: number }>>>;

  // Statistics and analytics
  getStatistics(): Promise<RepositoryResult<DatabaseStats>>;
  getPopularEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;
  getRecentEntries(limit?: number): Promise<RepositoryResult<SearchResult[]>>;

  // Feedback and usage tracking
  recordFeedback(feedback: EntryFeedback): Promise<RepositoryResult<string>>;
  recordUsage(metric: UsageMetric): Promise<RepositoryResult<void>>;
  recordSearch(history: SearchHistory): Promise<RepositoryResult<void>>;

  // Bulk operations
  bulkCreate(entries: CreateKBEntry[]): Promise<RepositoryResult<string[]>>;
  bulkUpdate(updates: Array<{ id: string; data: UpdateKBEntry }>): Promise<RepositoryResult<void>>;
  bulkDelete(ids: string[]): Promise<RepositoryResult<void>>;
}

/**
 * Knowledge Base Repository Implementation
 */
export class KnowledgeBaseRepository implements IKnowledgeBaseRepository {
  private db: Database.Database;
  private readonly statements = new Map<string, Database.Statement>();

  constructor(database: Database.Database) {
    this.db = database;
    this.initializePreparedStatements();
  }

  /**
   * Initialize optimized prepared statements
   */
  private initializePreparedStatements(): void {
    const statements = {
      findById: `
        SELECT 
          e.*,
          GROUP_CONCAT(DISTINCT t.tag, ',') as tags,
          CASE WHEN (e.success_count + e.failure_count) > 0 
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
               ELSE 0 END as success_rate
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.id = ? AND e.archived = FALSE
        GROUP BY e.id
      `,

      findAll: `
        SELECT 
          e.*,
          GROUP_CONCAT(DISTINCT t.tag, ',') as tags,
          CASE WHEN (e.success_count + e.failure_count) > 0 
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
               ELSE 0 END as success_rate
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.archived = FALSE
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
      `,

      create: `
        INSERT INTO kb_entries (
          id, title, problem, solution, category, severity, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,

      update: `
        UPDATE kb_entries 
        SET title = ?, problem = ?, solution = ?, category = ?, severity = ?, 
            archived = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND archived = FALSE
      `,

      delete: `
        UPDATE kb_entries 
        SET archived = TRUE, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND archived = FALSE
      `,

      hardDelete: `
        DELETE FROM kb_entries WHERE id = ?
      `,

      count: `
        SELECT COUNT(*) as count FROM kb_entries WHERE archived = FALSE
      `,

      insertTag: `
        INSERT OR IGNORE INTO kb_tags (entry_id, tag) VALUES (?, ?)
      `,

      deleteEntryTags: `
        DELETE FROM kb_tags WHERE entry_id = ?
      `,

      findByCategory: `
        SELECT 
          e.*,
          GROUP_CONCAT(DISTINCT t.tag, ',') as tags,
          90 as relevance_score,
          CASE WHEN (e.success_count + e.failure_count) > 0 
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
               ELSE 0 END as success_rate
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.category = ? AND e.archived = FALSE
        GROUP BY e.id
        ORDER BY e.usage_count DESC, success_rate DESC
        LIMIT ? OFFSET ?
      `,

      findByTags: `
        SELECT 
          e.*,
          GROUP_CONCAT(DISTINCT t.tag, ',') as tags,
          COUNT(DISTINCT CASE WHEN t2.tag IN (${Array(10).fill('?').join(',')}) THEN t2.tag END) as tag_matches,
          CASE WHEN (e.success_count + e.failure_count) > 0 
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
               ELSE 0 END as success_rate
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        JOIN kb_tags t2 ON e.id = t2.entry_id
        WHERE t2.tag IN (${Array(10).fill('?').join(',')}) AND e.archived = FALSE
        GROUP BY e.id
        HAVING tag_matches > 0
        ORDER BY tag_matches DESC, e.usage_count DESC
        LIMIT ? OFFSET ?
      `,

      getAllCategories: `
        SELECT 
          category as name, 
          COUNT(*) as count
        FROM kb_entries 
        WHERE archived = FALSE
        GROUP BY category
        ORDER BY count DESC
      `,

      getAllTags: `
        SELECT 
          t.tag as name, 
          COUNT(*) as count
        FROM kb_tags t
        JOIN kb_entries e ON t.entry_id = e.id
        WHERE e.archived = FALSE
        GROUP BY t.tag
        ORDER BY count DESC
        LIMIT 50
      `,

      getPopular: `
        SELECT 
          e.*,
          GROUP_CONCAT(DISTINCT t.tag, ',') as tags,
          e.usage_count as relevance_score,
          CASE WHEN (e.success_count + e.failure_count) > 0 
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
               ELSE 0 END as success_rate
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.archived = FALSE
        GROUP BY e.id
        ORDER BY e.usage_count DESC, success_rate DESC
        LIMIT ?
      `,

      getRecent: `
        SELECT 
          e.*,
          GROUP_CONCAT(DISTINCT t.tag, ',') as tags,
          100 as relevance_score,
          CASE WHEN (e.success_count + e.failure_count) > 0 
               THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
               ELSE 0 END as success_rate
        FROM kb_entries e
        LEFT JOIN kb_tags t ON e.id = t.entry_id
        WHERE e.archived = FALSE
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT ?
      `,

      recordFeedback: `
        INSERT INTO entry_feedback (
          id, entry_id, user_id, rating, successful, comment, session_id, resolution_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,

      recordUsage: `
        INSERT INTO usage_metrics (
          entry_id, action, user_id, session_id, metadata
        ) VALUES (?, ?, ?, ?, ?)
      `,

      recordSearch: `
        INSERT INTO search_history (
          query, normalized_query, results_count, selected_entry_id, 
          user_id, session_id, search_time_ms, filters_used, ai_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,

      updateEntryMetrics: `
        UPDATE kb_entries 
        SET usage_count = usage_count + 1, 
            success_count = success_count + ?,
            failure_count = failure_count + ?,
            last_used = CURRENT_TIMESTAMP
        WHERE id = ?
      `,

      autoComplete: `
        WITH suggestions AS (
          -- Entry titles
          SELECT DISTINCT 
            title as suggestion,
            'entry' as category,
            (usage_count + success_count * 2) as score
          FROM kb_entries 
          WHERE title LIKE '%' || ? || '%' AND archived = FALSE
          
          UNION ALL
          
          -- Categories
          SELECT DISTINCT 
            'category:' || category as suggestion,
            'filter' as category,
            COUNT(*) * 10 as score
          FROM kb_entries 
          WHERE category LIKE ? || '%' AND archived = FALSE
          GROUP BY category
          
          UNION ALL
          
          -- Tags
          SELECT DISTINCT 
            'tag:' || tag as suggestion,
            'filter' as category,
            COUNT(*) * 5 as score
          FROM kb_tags t
          JOIN kb_entries e ON t.entry_id = e.id
          WHERE tag LIKE ? || '%' AND e.archived = FALSE
          GROUP BY tag
        )
        SELECT suggestion, category, score
        FROM suggestions
        WHERE suggestion IS NOT NULL
        ORDER BY score DESC, length(suggestion) ASC
        LIMIT ?
      `,
    };

    // Prepare all statements
    Object.entries(statements).forEach(([name, sql]) => {
      try {
        this.statements.set(name, this.db.prepare(sql));
      } catch (error) {
        throw new AppError(
          ErrorCode.DATABASE_INITIALIZATION_ERROR,
          `Failed to prepare statement: ${name}`,
          { statementName: name, sql, originalError: error }
        );
      }
    });
  }

  // ===========================
  // BASIC CRUD OPERATIONS
  // ===========================

  async findById(id: string): Promise<RepositoryResult<KBEntry>> {
    return this.executeWithMetrics('findById', async () => {
      if (!id?.trim()) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Entry ID is required');
      }

      const row = this.statements.get('findById')!.get(id) as any;

      if (!row) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'KB entry not found', { entryId: id });
      }

      const entry = this.transformRowToKBEntry(row);

      // Record view
      await this.recordUsage({
        entry_id: id,
        action: 'view',
        timestamp: new Date(),
      });

      return entry;
    });
  }

  async findAll(
    options: { limit?: number; offset?: number } = {}
  ): Promise<RepositoryResult<KBEntry[]>> {
    return this.executeWithMetrics('findAll', async () => {
      const { limit = 50, offset = 0 } = options;

      if (limit > 1000) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Limit cannot exceed 1000');
      }

      const rows = this.statements.get('findAll')!.all(limit, offset) as any[];
      return rows.map(row => this.transformRowToKBEntry(row));
    });
  }

  async create(data: CreateKBEntry): Promise<RepositoryResult<KBEntry>> {
    return this.executeWithMetrics('create', async () => {
      // Validate input
      const validatedData = SchemaValidator.validateKBEntry(data);
      const id = uuidv4();

      const transaction = this.db.transaction(() => {
        // Insert main entry
        this.statements
          .get('create')!
          .run(
            id,
            validatedData.title,
            validatedData.problem,
            validatedData.solution,
            validatedData.category,
            validatedData.severity || 'medium',
            'system'
          );

        // Insert tags
        if (validatedData.tags && validatedData.tags.length > 0) {
          const insertTag = this.statements.get('insertTag')!;
          validatedData.tags.forEach(tag => {
            insertTag.run(id, tag.toLowerCase().trim());
          });
        }

        // Update FTS index
        this.updateFTSIndex(id, validatedData);

        return id;
      });

      const createdId = transaction();

      // Record creation
      await this.recordUsage({
        entry_id: createdId,
        action: 'create',
        timestamp: new Date(),
      });

      // Return created entry
      const result = await this.findById(createdId);
      return result.data!;
    });
  }

  async update(id: string, data: UpdateKBEntry): Promise<RepositoryResult<KBEntry>> {
    return this.executeWithMetrics('update', async () => {
      // Validate input
      const validatedData = SchemaValidator.validateKBEntryUpdate(data);

      // Check if entry exists
      const existing = await this.findById(id);
      if (!existing.success) {
        throw existing.error!;
      }

      const transaction = this.db.transaction(() => {
        // Update main entry if any fields changed
        if (
          validatedData.title !== undefined ||
          validatedData.problem !== undefined ||
          validatedData.solution !== undefined ||
          validatedData.category !== undefined ||
          validatedData.severity !== undefined ||
          validatedData.archived !== undefined
        ) {
          const result = this.statements
            .get('update')!
            .run(
              validatedData.title ?? existing.data!.title,
              validatedData.problem ?? existing.data!.problem,
              validatedData.solution ?? existing.data!.solution,
              validatedData.category ?? existing.data!.category,
              validatedData.severity ?? existing.data!.severity,
              validatedData.archived ?? existing.data!.archived,
              id
            );

          if (result.changes === 0) {
            throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Entry not found or archived');
          }
        }

        // Update tags if provided
        if (validatedData.tags !== undefined) {
          this.statements.get('deleteEntryTags')!.run(id);

          if (validatedData.tags.length > 0) {
            const insertTag = this.statements.get('insertTag')!;
            validatedData.tags.forEach(tag => {
              insertTag.run(id, tag.toLowerCase().trim());
            });
          }
        }

        // Update FTS if content changed
        if (
          validatedData.title !== undefined ||
          validatedData.problem !== undefined ||
          validatedData.solution !== undefined ||
          validatedData.tags !== undefined
        ) {
          this.updateFTSIndex(id, {
            title: validatedData.title ?? existing.data!.title,
            problem: validatedData.problem ?? existing.data!.problem,
            solution: validatedData.solution ?? existing.data!.solution,
            tags: validatedData.tags ?? existing.data!.tags,
          });
        }
      });

      transaction();

      // Record update
      await this.recordUsage({
        entry_id: id,
        action: 'update',
        timestamp: new Date(),
      });

      // Return updated entry
      const result = await this.findById(id);
      return result.data!;
    });
  }

  async delete(id: string): Promise<RepositoryResult<void>> {
    return this.executeWithMetrics('delete', async () => {
      const result = this.statements.get('delete')!.run(id);

      if (result.changes === 0) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Entry not found', { entryId: id });
      }

      // Record deletion
      await this.recordUsage({
        entry_id: id,
        action: 'delete',
        timestamp: new Date(),
      });
    });
  }

  async count(filters: any = {}): Promise<RepositoryResult<number>> {
    return this.executeWithMetrics('count', async () => {
      const result = this.statements.get('count')!.get() as { count: number };
      return result.count;
    });
  }

  // ===========================
  // SEARCH OPERATIONS
  // ===========================

  async search(query: SearchQuery): Promise<RepositoryResult<SearchResult[]>> {
    return this.executeWithMetrics('search', async () => {
      const validatedQuery = SchemaValidator.validateSearchQuery(query);

      // Use existing search logic with optimizations
      const searchStart = Date.now();
      let results: SearchResult[] = [];

      try {
        // Determine search strategy
        const strategy = this.determineSearchStrategy(validatedQuery);

        // Execute search based on strategy
        switch (strategy) {
          case 'category':
            const categoryResults = await this.findByCategory(
              validatedQuery.category as KBCategory,
              { limit: validatedQuery.limit, offset: validatedQuery.offset }
            );
            results = categoryResults.data || [];
            break;

          case 'tag':
            const tagResults = await this.findByTags(validatedQuery.tags || [], {
              limit: validatedQuery.limit,
              offset: validatedQuery.offset,
            });
            results = tagResults.data || [];
            break;

          case 'fts':
          default:
            results = await this.executeFTSSearch(validatedQuery);
            break;
        }

        // Record search
        await this.recordSearch({
          query: validatedQuery.query,
          normalized_query: this.normalizeQuery(validatedQuery.query),
          results_count: results.length,
          search_time_ms: Date.now() - searchStart,
          filters_used: this.extractFilters(validatedQuery),
          ai_used: validatedQuery.useAI,
        });

        return results;
      } catch (error) {
        throw ErrorUtils.searchError(validatedQuery.query, error);
      }
    });
  }

  async searchWithFacets(query: SearchQuery): Promise<RepositoryResult<SearchWithFacets>> {
    return this.executeWithMetrics('searchWithFacets', async () => {
      const [searchResults, facets] = await Promise.all([
        this.search(query),
        this.calculateFacets(query.query),
      ]);

      if (!searchResults.success) {
        throw searchResults.error!;
      }

      return {
        results: searchResults.data!,
        facets: facets.data!,
        totalCount: searchResults.data!.length,
        executionTime: searchResults.metadata?.executionTime,
      } as SearchWithFacets;
    });
  }

  async autoComplete(
    query: string,
    limit: number = 5
  ): Promise<
    RepositoryResult<
      Array<{
        suggestion: string;
        category: string;
        score: number;
      }>
    >
  > {
    return this.executeWithMetrics('autoComplete', async () => {
      if (!query || query.length < 2) {
        return [];
      }

      const results = this.statements
        .get('autoComplete')!
        .all(query, query, query, limit) as Array<{
        suggestion: string;
        category: string;
        score: number;
      }>;

      return results;
    });
  }

  // ===========================
  // CATEGORY AND TAG OPERATIONS
  // ===========================

  async findByCategory(
    category: KBCategory,
    options: SearchOptions = {}
  ): Promise<RepositoryResult<SearchResult[]>> {
    return this.executeWithMetrics('findByCategory', async () => {
      const { limit = 10, offset = 0 } = options;

      const rows = this.statements.get('findByCategory')!.all(category, limit, offset) as any[];

      return rows.map(row => ({
        entry: this.transformRowToKBEntry(row),
        score: row.relevance_score || 90,
        matchType: 'category' as SearchMatchType,
        highlights: [],
        executionTime: 0,
      }));
    });
  }

  async findByTags(
    tags: string[],
    options: SearchOptions = {}
  ): Promise<RepositoryResult<SearchResult[]>> {
    return this.executeWithMetrics('findByTags', async () => {
      if (!tags || tags.length === 0) {
        return [];
      }

      const { limit = 10, offset = 0 } = options;

      // Pad tags array to match prepared statement
      const paddedTags = [...tags.slice(0, 10), ...Array(10 - Math.min(tags.length, 10)).fill('')];

      const rows = this.statements
        .get('findByTags')!
        .all(...paddedTags, ...paddedTags, limit, offset) as any[];

      return rows.map(row => ({
        entry: this.transformRowToKBEntry(row),
        score: (row.tag_matches || 0) * 20 + 60,
        matchType: 'tag' as SearchMatchType,
        highlights: [],
        executionTime: 0,
      }));
    });
  }

  async getAllCategories(): Promise<RepositoryResult<Array<{ name: string; count: number }>>> {
    return this.executeWithMetrics('getAllCategories', async () => {
      return this.statements.get('getAllCategories')!.all() as Array<{
        name: string;
        count: number;
      }>;
    });
  }

  async getAllTags(): Promise<RepositoryResult<Array<{ name: string; count: number }>>> {
    return this.executeWithMetrics('getAllTags', async () => {
      return this.statements.get('getAllTags')!.all() as Array<{ name: string; count: number }>;
    });
  }

  // ===========================
  // STATISTICS AND ANALYTICS
  // ===========================

  async getStatistics(): Promise<RepositoryResult<DatabaseStats>> {
    return this.executeWithMetrics('getStatistics', async () => {
      const [basicStats, categories, tags, severities] = await Promise.all([
        this.getBasicStats(),
        this.getAllCategories(),
        this.getAllTags(),
        this.getSeverityStats(),
      ]);

      const stats: DatabaseStats = {
        totalEntries: basicStats.totalEntries,
        categoryCounts: this.arrayToRecord(categories.data || []),
        recentActivity: basicStats.recentActivity,
        searchesToday: basicStats.searchesToday,
        averageSuccessRate: basicStats.averageSuccessRate,
        topEntries: basicStats.topEntries || [],
        diskUsage: this.getDiskUsage(),
        performance: {
          avgSearchTime: 150, // Placeholder
          cacheHitRate: 75, // Placeholder
          slowQueries: 0,
          errorRate: 0.1,
        },
        healthStatus: {
          overall: 'healthy',
          database: true,
          cache: true,
          indexes: true,
          backup: true,
          issues: [],
        },
        timestamp: new Date(),
      };

      return stats;
    });
  }

  async getPopularEntries(limit: number = 10): Promise<RepositoryResult<SearchResult[]>> {
    return this.executeWithMetrics('getPopular', async () => {
      const rows = this.statements.get('getPopular')!.all(limit) as any[];

      return rows.map(row => ({
        entry: this.transformRowToKBEntry(row),
        score: row.relevance_score || 0,
        matchType: 'popular' as SearchMatchType,
        highlights: [],
        executionTime: 0,
      }));
    });
  }

  async getRecentEntries(limit: number = 10): Promise<RepositoryResult<SearchResult[]>> {
    return this.executeWithMetrics('getRecent', async () => {
      const rows = this.statements.get('getRecent')!.all(limit) as any[];

      return rows.map(row => ({
        entry: this.transformRowToKBEntry(row),
        score: 100,
        matchType: 'recent' as SearchMatchType,
        highlights: [],
        executionTime: 0,
      }));
    });
  }

  // ===========================
  // FEEDBACK AND USAGE TRACKING
  // ===========================

  async recordFeedback(feedback: EntryFeedback): Promise<RepositoryResult<string>> {
    return this.executeWithMetrics('recordFeedback', async () => {
      const validatedFeedback = SchemaValidator.validateFeedback(feedback);
      const id = uuidv4();

      this.statements
        .get('recordFeedback')!
        .run(
          id,
          validatedFeedback.entry_id,
          validatedFeedback.user_id,
          validatedFeedback.rating,
          validatedFeedback.successful,
          validatedFeedback.comment,
          validatedFeedback.session_id,
          validatedFeedback.resolution_time
        );

      // Update entry metrics
      this.statements
        .get('updateEntryMetrics')!
        .run(
          validatedFeedback.successful ? 1 : 0,
          validatedFeedback.successful ? 0 : 1,
          validatedFeedback.entry_id
        );

      return id;
    });
  }

  async recordUsage(metric: UsageMetric): Promise<RepositoryResult<void>> {
    return this.executeWithMetrics('recordUsage', async () => {
      try {
        this.statements
          .get('recordUsage')!
          .run(
            metric.entry_id,
            metric.action,
            metric.user_id || 'anonymous',
            metric.session_id,
            metric.metadata ? JSON.stringify(metric.metadata) : null
          );
      } catch (error) {
        // Non-critical error, log but don't throw
        console.warn('Failed to record usage metric:', error);
      }
    });
  }

  async recordSearch(history: SearchHistory): Promise<RepositoryResult<void>> {
    return this.executeWithMetrics('recordSearch', async () => {
      try {
        this.statements
          .get('recordSearch')!
          .run(
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
        // Non-critical error, log but don't throw
        console.warn('Failed to record search history:', error);
      }
    });
  }

  // ===========================
  // BULK OPERATIONS
  // ===========================

  async bulkCreate(entries: CreateKBEntry[]): Promise<RepositoryResult<string[]>> {
    return this.executeWithMetrics('bulkCreate', async () => {
      const ids: string[] = [];

      const transaction = this.db.transaction(() => {
        const createStmt = this.statements.get('create')!;
        const tagStmt = this.statements.get('insertTag')!;

        for (const entry of entries) {
          const validatedEntry = SchemaValidator.validateKBEntry(entry);
          const id = uuidv4();

          createStmt.run(
            id,
            validatedEntry.title,
            validatedEntry.problem,
            validatedEntry.solution,
            validatedEntry.category,
            validatedEntry.severity || 'medium',
            'system'
          );

          if (validatedEntry.tags) {
            validatedEntry.tags.forEach(tag => {
              tagStmt.run(id, tag.toLowerCase().trim());
            });
          }

          this.updateFTSIndex(id, validatedEntry);
          ids.push(id);
        }
      });

      transaction();
      return ids;
    });
  }

  async bulkUpdate(
    updates: Array<{ id: string; data: UpdateKBEntry }>
  ): Promise<RepositoryResult<void>> {
    return this.executeWithMetrics('bulkUpdate', async () => {
      const transaction = this.db.transaction(() => {
        for (const update of updates) {
          // Use individual update method for validation and consistency
          this.update(update.id, update.data);
        }
      });

      transaction();
    });
  }

  async bulkDelete(ids: string[]): Promise<RepositoryResult<void>> {
    return this.executeWithMetrics('bulkDelete', async () => {
      const transaction = this.db.transaction(() => {
        const deleteStmt = this.statements.get('delete')!;
        for (const id of ids) {
          deleteStmt.run(id);
        }
      });

      transaction();
    });
  }

  // ===========================
  // PRIVATE HELPER METHODS
  // ===========================

  private async executeWithMetrics<T>(
    operation: string,
    callback: () => Promise<T> | T
  ): Promise<RepositoryResult<T>> {
    const startTime = Date.now();

    try {
      const result = await callback();
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        metadata: {
          executionTime,
          cacheHit: false,
          queryHash: this.generateQueryHash(operation),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof AppError ? error : AppError.fromUnknown(error, { operation }),
        metadata: {
          executionTime,
          cacheHit: false,
        },
      };
    }
  }

  private transformRowToKBEntry(row: any): KBEntry {
    return {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category as KBCategory,
      severity: row.severity,
      tags: row.tags ? row.tags.split(',').filter((tag: string) => tag.trim()) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      usage_count: row.usage_count || 0,
      success_count: row.success_count || 0,
      failure_count: row.failure_count || 0,
      last_used: row.last_used ? new Date(row.last_used) : undefined,
      archived: Boolean(row.archived),
      confidence_score: row.confidence_score,
    };
  }

  private updateFTSIndex(id: string, data: any): void {
    try {
      this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);
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
    }
  }

  private determineSearchStrategy(
    query: SearchQuery
  ): 'exact' | 'fts' | 'fuzzy' | 'category' | 'tag' | 'hybrid' {
    if (query.category) return 'category';
    if (query.tags && query.tags.length > 0) return 'tag';
    return 'fts';
  }

  private async executeFTSSearch(query: SearchQuery): Promise<SearchResult[]> {
    const ftsQuery = this.prepareFTSQuery(query.query);

    const sql = `
      SELECT 
        e.*,
        GROUP_CONCAT(DISTINCT t.tag, ',') as tags,
        bm25(kb_fts, 3.0, 2.0, 1.5, 1.0) as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0 
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count) * 100
             ELSE 0 END as success_rate
      FROM kb_fts f
      JOIN kb_entries e ON f.id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE kb_fts MATCH ? AND e.archived = FALSE
      GROUP BY e.id
      ORDER BY relevance_score DESC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(ftsQuery, query.limit || 10) as any[];

    return rows.map(row => ({
      entry: this.transformRowToKBEntry(row),
      score: Math.abs(row.relevance_score || 0) * 10,
      matchType: 'fts' as SearchMatchType,
      highlights: this.generateHighlights(query.query, row),
      executionTime: 0,
    }));
  }

  private prepareFTSQuery(query: string): string {
    // Clean and prepare query for FTS5
    return query.trim().replace(/['"]/g, '').replace(/\s+/g, ' ');
  }

  private generateHighlights(query: string, row: any): string[] {
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
    };
  }

  private async calculateFacets(query: string): Promise<
    RepositoryResult<{
      categories: Array<{ name: string; count: number }>;
      tags: Array<{ name: string; count: number }>;
      severities: Array<{ name: string; count: number }>;
    }>
  > {
    const [categories, tags, severities] = await Promise.all([
      this.getAllCategories(),
      this.getAllTags(),
      this.getSeverityStats(),
    ]);

    return {
      categories: categories.data || [],
      tags: (tags.data || []).slice(0, 15),
      severities: severities.data || [],
    };
  }

  private async getBasicStats(): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as totalEntries,
        COUNT(CASE WHEN last_used > datetime('now', '-7 days') THEN 1 END) as recentActivity,
        AVG(CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count) * 100
                 ELSE 0 END) as averageSuccessRate,
        (SELECT COUNT(*) FROM search_history WHERE date(timestamp) = date('now')) as searchesToday
      FROM kb_entries
      WHERE archived = FALSE
    `;

    const topEntriesSql = `
      SELECT id, title, usage_count, 
             CASE WHEN (success_count + failure_count) > 0 
                  THEN CAST(success_count AS REAL) / (success_count + failure_count) * 100
                  ELSE 0 END as success_rate
      FROM kb_entries
      WHERE archived = FALSE
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT 10
    `;

    const [basic, topEntries] = await Promise.all([
      this.db.prepare(sql).get(),
      this.db.prepare(topEntriesSql).all(),
    ]);

    return {
      ...basic,
      topEntries,
    };
  }

  private async getSeverityStats(): Promise<
    RepositoryResult<Array<{ name: string; count: number }>>
  > {
    const sql = `
      SELECT severity as name, COUNT(*) as count
      FROM kb_entries 
      WHERE archived = FALSE
      GROUP BY severity
      ORDER BY count DESC
    `;

    return {
      success: true,
      data: this.db.prepare(sql).all() as Array<{ name: string; count: number }>,
    };
  }

  private arrayToRecord(arr: Array<{ name: string; count: number }>): Record<string, number> {
    const record: Record<string, number> = {};
    arr.forEach(item => {
      record[item.name] = item.count;
    });
    return record;
  }

  private getDiskUsage(): number {
    try {
      const fs = require('fs');
      return fs.statSync(this.db.name).size;
    } catch {
      return 0;
    }
  }

  private generateQueryHash(operation: string): string {
    return require('crypto')
      .createHash('md5')
      .update(operation + Date.now())
      .digest('hex');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.statements.forEach(stmt => {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn('Error finalizing prepared statement:', error);
      }
    });
    this.statements.clear();
  }
}

export default KnowledgeBaseRepository;
