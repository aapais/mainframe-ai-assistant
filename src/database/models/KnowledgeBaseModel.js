'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.KnowledgeBaseModel = void 0;
const uuid_1 = require('uuid');
const KnowledgeBase_schema_1 = require('../schemas/KnowledgeBase.schema');
const AppError_1 = require('../../core/errors/AppError');
class KnowledgeBaseModel {
  db;
  performanceMonitor;
  queryOptimizer;
  statements = {
    insertEntry: null,
    updateEntry: null,
    selectById: null,
    deleteById: null,
    insertTag: null,
    deleteEntryTags: null,
    insertFeedback: null,
    insertUsageMetric: null,
    insertSearchHistory: null,
  };
  constructor(db, performanceMonitor, queryOptimizer) {
    this.db = db;
    this.performanceMonitor = performanceMonitor;
    this.queryOptimizer = queryOptimizer;
    this.initializePreparedStatements();
  }
  initializePreparedStatements() {
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
      throw new AppError_1.AppError(
        AppError_1.ErrorCode.DATABASE_INITIALIZATION_ERROR,
        'Failed to initialize prepared statements',
        { originalError: error }
      );
    }
  }
  async createEntry(entryData, userId) {
    return this.executeWithPerformanceTracking('createEntry', async () => {
      const validationResult = KnowledgeBase_schema_1.SchemaValidator.safeParse(
        KnowledgeBase_schema_1.DatabaseSchemas.CreateKBEntry,
        entryData
      );
      if (!validationResult.success) {
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.VALIDATION_ERROR,
          'Invalid KB entry data',
          { validationErrors: validationResult.error }
        );
      }
      const validatedData = validationResult.data;
      const id = (0, uuid_1.v4)();
      const transaction = this.db.transaction(() => {
        try {
          this.statements.insertEntry.run(
            id,
            validatedData.title,
            validatedData.problem,
            validatedData.solution,
            validatedData.category,
            validatedData.severity || 'medium',
            userId || 'system'
          );
          if (validatedData.tags && validatedData.tags.length > 0) {
            for (const tag of validatedData.tags) {
              this.statements.insertTag.run(id, tag.toLowerCase().trim());
            }
          }
          this.updateFTSIndex(id, validatedData);
          return id;
        } catch (error) {
          throw new AppError_1.AppError(
            AppError_1.ErrorCode.DATABASE_INSERT_ERROR,
            'Failed to create KB entry',
            { entryId: id, originalError: error }
          );
        }
      });
      const result = transaction();
      this.logUsageMetric({
        entry_id: result,
        action: 'create',
        user_id: userId,
        timestamp: new Date(),
      });
      return result;
    });
  }
  async updateEntry(id, updates, userId) {
    return this.executeWithPerformanceTracking('updateEntry', async () => {
      const validationResult = KnowledgeBase_schema_1.SchemaValidator.safeParse(
        KnowledgeBase_schema_1.DatabaseSchemas.UpdateKBEntry,
        updates
      );
      if (!validationResult.success) {
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.VALIDATION_ERROR,
          'Invalid update data',
          { validationErrors: validationResult.error }
        );
      }
      const validatedUpdates = validationResult.data;
      const existingEntry = await this.getEntryById(id);
      if (!existingEntry.success || !existingEntry.data) {
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.RESOURCE_NOT_FOUND,
          'KB entry not found',
          { entryId: id }
        );
      }
      const transaction = this.db.transaction(() => {
        try {
          if (
            validatedUpdates.title !== undefined ||
            validatedUpdates.problem !== undefined ||
            validatedUpdates.solution !== undefined ||
            validatedUpdates.category !== undefined ||
            validatedUpdates.severity !== undefined ||
            validatedUpdates.archived !== undefined
          ) {
            this.statements.updateEntry.run(
              validatedUpdates.title ?? existingEntry.data.title,
              validatedUpdates.problem ?? existingEntry.data.problem,
              validatedUpdates.solution ?? existingEntry.data.solution,
              validatedUpdates.category ?? existingEntry.data.category,
              validatedUpdates.severity ?? existingEntry.data.severity,
              validatedUpdates.archived ?? existingEntry.data.archived,
              id
            );
          }
          if (validatedUpdates.tags !== undefined) {
            this.statements.deleteEntryTags.run(id);
            if (validatedUpdates.tags.length > 0) {
              for (const tag of validatedUpdates.tags) {
                this.statements.insertTag.run(id, tag.toLowerCase().trim());
              }
            }
          }
          if (
            validatedUpdates.title !== undefined ||
            validatedUpdates.problem !== undefined ||
            validatedUpdates.solution !== undefined ||
            validatedUpdates.tags !== undefined
          ) {
            this.updateFTSIndex(id, {
              title: validatedUpdates.title ?? existingEntry.data.title,
              problem: validatedUpdates.problem ?? existingEntry.data.problem,
              solution: validatedUpdates.solution ?? existingEntry.data.solution,
              tags: validatedUpdates.tags ?? existingEntry.data.tags,
            });
          }
        } catch (error) {
          throw new AppError_1.AppError(
            AppError_1.ErrorCode.DATABASE_UPDATE_ERROR,
            'Failed to update KB entry',
            { entryId: id, originalError: error }
          );
        }
      });
      transaction();
      this.logUsageMetric({
        entry_id: id,
        action: 'update',
        user_id: userId,
        timestamp: new Date(),
      });
    });
  }
  async getEntryById(id) {
    return this.executeWithPerformanceTracking('getEntryById', async () => {
      if (!id || typeof id !== 'string') {
        throw new AppError_1.AppError(AppError_1.ErrorCode.VALIDATION_ERROR, 'Invalid entry ID', {
          entryId: id,
        });
      }
      try {
        const row = this.statements.selectById.get(id);
        if (!row) {
          throw new AppError_1.AppError(
            AppError_1.ErrorCode.RESOURCE_NOT_FOUND,
            'KB entry not found',
            { entryId: id }
          );
        }
        const entry = {
          id: row.id,
          title: row.title,
          problem: row.problem,
          solution: row.solution,
          category: row.category,
          severity: row.severity,
          tags: row.tags ? row.tags.split(',').map(tag => tag.trim()) : [],
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
          created_by: row.created_by,
          usage_count: row.usage_count || 0,
          success_count: row.success_count || 0,
          failure_count: row.failure_count || 0,
          last_used: row.last_used ? new Date(row.last_used) : undefined,
          archived: Boolean(row.archived),
        };
        const validationResult = KnowledgeBase_schema_1.SchemaValidator.safeParse(
          KnowledgeBase_schema_1.DatabaseSchemas.KBEntry,
          entry
        );
        if (!validationResult.success) {
          throw new AppError_1.AppError(
            AppError_1.ErrorCode.DATA_CONSISTENCY_ERROR,
            'Entry data validation failed after retrieval',
            { entryId: id, validationErrors: validationResult.error }
          );
        }
        this.logUsageMetric({
          entry_id: id,
          action: 'view',
          timestamp: new Date(),
        });
        return validationResult.data;
      } catch (error) {
        if (error instanceof AppError_1.AppError) {
          throw error;
        }
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.DATABASE_QUERY_ERROR,
          'Failed to retrieve KB entry',
          { entryId: id, originalError: error }
        );
      }
    });
  }
  async deleteEntry(id, userId) {
    return this.executeWithPerformanceTracking('deleteEntry', async () => {
      const existingEntry = await this.getEntryById(id);
      if (!existingEntry.success || !existingEntry.data) {
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.RESOURCE_NOT_FOUND,
          'KB entry not found',
          { entryId: id }
        );
      }
      const transaction = this.db.transaction(() => {
        try {
          this.statements.deleteEntryTags.run(id);
          this.db.prepare('DELETE FROM entry_feedback WHERE entry_id = ?').run(id);
          this.db.prepare('DELETE FROM usage_metrics WHERE entry_id = ?').run(id);
          this.db
            .prepare(
              `
            UPDATE search_history 
            SET selected_entry_id = NULL 
            WHERE selected_entry_id = ?
          `
            )
            .run(id);
          this.db.prepare('DELETE FROM kb_fts WHERE id = ?').run(id);
          const result = this.statements.deleteById.run(id);
          if (result.changes === 0) {
            throw new Error('Entry not found or already deleted');
          }
        } catch (error) {
          throw new AppError_1.AppError(
            AppError_1.ErrorCode.DATABASE_DELETE_ERROR,
            'Failed to delete KB entry',
            { entryId: id, originalError: error }
          );
        }
      });
      transaction();
      this.logUsageMetric({
        entry_id: id,
        action: 'delete',
        user_id: userId,
        timestamp: new Date(),
      });
    });
  }
  async search(searchQuery) {
    return this.executeWithPerformanceTracking('search', async () => {
      const validationResult = KnowledgeBase_schema_1.SchemaValidator.safeParse(
        KnowledgeBase_schema_1.DatabaseSchemas.SearchQuery,
        searchQuery
      );
      if (!validationResult.success) {
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.VALIDATION_ERROR,
          'Invalid search query',
          { validationErrors: validationResult.error }
        );
      }
      const validatedQuery = validationResult.data;
      try {
        const searchResults = await this.queryOptimizer.executeOptimizedSearch(validatedQuery);
        const results = searchResults.map(row => ({
          entry: this.transformRowToKBEntry(row),
          score: Math.min(100, Math.max(0, row.relevance_score || 0)),
          matchType: this.determineMatchType(validatedQuery, row),
          highlights: this.generateHighlights(validatedQuery.query, row),
          executionTime: row.execution_time,
        }));
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
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.SEARCH_ERROR,
          'Search operation failed',
          { query: validatedQuery.query, originalError: error }
        );
      }
    });
  }
  async searchWithFacets(searchQuery) {
    return this.executeWithPerformanceTracking('searchWithFacets', async () => {
      const searchResults = await this.search(searchQuery);
      if (!searchResults.success) {
        throw searchResults.error;
      }
      const facets = await this.calculateFacets(searchQuery.query, searchQuery);
      const result = {
        results: searchResults.data,
        facets,
        totalCount: searchResults.data.length,
        executionTime: searchResults.performance?.executionTime,
      };
      return result;
    });
  }
  async recordFeedback(feedback) {
    return this.executeWithPerformanceTracking('recordFeedback', async () => {
      const validationResult = KnowledgeBase_schema_1.SchemaValidator.safeParse(
        KnowledgeBase_schema_1.DatabaseSchemas.EntryFeedback,
        feedback
      );
      if (!validationResult.success) {
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.VALIDATION_ERROR,
          'Invalid feedback data',
          { validationErrors: validationResult.error }
        );
      }
      const validatedFeedback = validationResult.data;
      const feedbackId = (0, uuid_1.v4)();
      try {
        this.statements.insertFeedback.run(
          feedbackId,
          validatedFeedback.entry_id,
          validatedFeedback.user_id,
          validatedFeedback.rating,
          validatedFeedback.successful,
          validatedFeedback.comment,
          validatedFeedback.session_id
        );
        this.updateEntryMetrics(validatedFeedback.entry_id, validatedFeedback.successful);
        return feedbackId;
      } catch (error) {
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.DATABASE_INSERT_ERROR,
          'Failed to record feedback',
          { originalError: error }
        );
      }
    });
  }
  async logUsageMetric(metric) {
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
      console.warn('Failed to log usage metric:', error);
    }
  }
  async logSearchHistory(history) {
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
      console.warn('Failed to log search history:', error);
    }
  }
  async getStatistics() {
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
          .get();
        const categoryCounts = this.db
          .prepare(
            `
          SELECT category, COUNT(*) as count
          FROM kb_entries
          WHERE archived = FALSE
          GROUP BY category
        `
          )
          .all();
        const searchesToday = this.db
          .prepare(
            `
          SELECT COUNT(*) as count
          FROM search_history
          WHERE date(timestamp) = date('now')
        `
          )
          .get();
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
          .all();
        const diskUsage = this.getDiskUsage();
        const performanceStats = this.performanceMonitor.getStats();
        const healthStatus = await this.checkHealth();
        const categoryMap = {};
        categoryCounts.forEach(cat => {
          categoryMap[cat.category] = cat.count;
        });
        const stats = {
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
        const validationResult = KnowledgeBase_schema_1.SchemaValidator.safeParse(
          KnowledgeBase_schema_1.DatabaseSchemas.DatabaseStats,
          stats
        );
        if (!validationResult.success) {
          throw new AppError_1.AppError(
            AppError_1.ErrorCode.DATA_CONSISTENCY_ERROR,
            'Statistics validation failed',
            { validationErrors: validationResult.error }
          );
        }
        return validationResult.data;
      } catch (error) {
        if (error instanceof AppError_1.AppError) {
          throw error;
        }
        throw new AppError_1.AppError(
          AppError_1.ErrorCode.DATABASE_QUERY_ERROR,
          'Failed to retrieve statistics',
          { originalError: error }
        );
      }
    });
  }
  async executeWithPerformanceTracking(operation, callback) {
    const startTime = Date.now();
    const cacheHit = false;
    const queriesExecuted = 0;
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
      this.performanceMonitor.recordOperation(operation, executionTime, false);
      if (error instanceof AppError_1.AppError) {
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
        error: new AppError_1.AppError(
          AppError_1.ErrorCode.UNKNOWN_ERROR,
          `Operation ${operation} failed`,
          { originalError: error }
        ),
        performance: {
          executionTime,
          queriesExecuted,
          cacheHit,
        },
      };
    }
  }
  transformRowToKBEntry(row) {
    const entry = {
      id: row.id,
      title: row.title,
      problem: row.problem,
      solution: row.solution,
      category: row.category,
      severity: row.severity,
      tags: row.tags ? row.tags.split(',').map(tag => tag.trim()) : [],
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      created_by: row.created_by,
      usage_count: row.usage_count || 0,
      success_count: row.success_count || 0,
      failure_count: row.failure_count || 0,
      last_used: row.last_used ? new Date(row.last_used) : undefined,
      archived: Boolean(row.archived),
    };
    const validationResult = KnowledgeBase_schema_1.SchemaValidator.safeParse(
      KnowledgeBase_schema_1.DatabaseSchemas.KBEntry,
      entry
    );
    if (!validationResult.success) {
      throw new AppError_1.AppError(
        AppError_1.ErrorCode.DATA_CONSISTENCY_ERROR,
        'Invalid entry data from database',
        { entryId: row.id, validationErrors: validationResult.error }
      );
    }
    return entry;
  }
  updateFTSIndex(id, data) {
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
  updateEntryMetrics(entryId, successful) {
    try {
      const updateQuery = successful
        ? 'UPDATE kb_entries SET usage_count = usage_count + 1, success_count = success_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?'
        : 'UPDATE kb_entries SET usage_count = usage_count + 1, failure_count = failure_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.prepare(updateQuery).run(entryId);
    } catch (error) {
      console.warn('Failed to update entry metrics:', error);
    }
  }
  determineMatchType(query, row) {
    if (query.query === row.title) return 'exact';
    if (query.category && query.category === row.category) return 'category';
    if (query.useAI) return 'ai';
    return 'fuzzy';
  }
  generateHighlights(query, row) {
    const highlights = [];
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
  normalizeQuery(query) {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  extractFilters(query) {
    return {
      category: query.category,
      severity: query.severity,
      tags: query.tags,
      sortBy: query.sortBy,
      dateRange: query.dateRange,
    };
  }
  async calculateFacets(query, options) {
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
  getDiskUsage() {
    try {
      const stats = require('fs').statSync(this.db.name);
      return stats.size;
    } catch {
      return 0;
    }
  }
  async checkHealth() {
    try {
      this.db.prepare('SELECT 1').get();
      return {
        overall: 'healthy',
        database: true,
        cache: true,
        indexes: true,
        backup: true,
        issues: [],
      };
    } catch {
      return {
        overall: 'critical',
        database: false,
        cache: false,
        indexes: false,
        backup: false,
        issues: ['Database connection failed'],
      };
    }
  }
  async cleanup() {
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
exports.KnowledgeBaseModel = KnowledgeBaseModel;
exports.default = KnowledgeBaseModel;
//# sourceMappingURL=KnowledgeBaseModel.js.map
