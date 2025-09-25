/**
 * SearchHistoryHandler - IPC handler for search history operations
 *
 * Features:
 * - Persistent search history storage
 * - Popular searches tracking
 * - Analytics and reporting
 * - Performance optimized queries
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode,
} from '../../../types/ipc';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { HandlerUtils, HandlerConfigs } from './index';

// Request/Response Types
interface SearchHistoryEntry {
  query: string;
  timestamp: Date;
  resultCount?: number;
  executionTime?: number;
  successful?: boolean;
  userId?: string;
  sessionId?: string;
}

interface GetHistoryRequest extends BaseIPCRequest {
  limit?: number;
  userId?: string;
  includeAnalytics?: boolean;
}

interface GetHistoryResponse extends BaseIPCResponse {
  data: {
    history: SearchHistoryEntry[];
    popular: Array<{
      query: string;
      count: number;
      lastUsed: Date;
      avgResultCount: number;
      successRate: number;
    }>;
    analytics?: {
      totalSearches: number;
      uniqueQueries: number;
      averageResultCount: number;
      successRate: number;
    };
  };
}

interface AddEntryRequest extends BaseIPCRequest {
  entry: SearchHistoryEntry;
}

interface RemoveEntryRequest extends BaseIPCRequest {
  query: string;
  userId?: string;
}

interface SearchHistoryRequest extends BaseIPCRequest {
  searchQuery: string;
  limit?: number;
  userId?: string;
}

interface ClearHistoryRequest extends BaseIPCRequest {
  userId?: string;
  confirmToken?: string;
}

export class SearchHistoryHandler {
  constructor(private dbManager: DatabaseManager) {}

  /**
   * Get search history with popular searches
   */
  handleGetHistory: IPCHandlerFunction<'searchHistory:get'> = async (
    request: GetHistoryRequest
  ) => {
    const startTime = Date.now();

    try {
      const { limit = 100, userId = 'default', includeAnalytics = false } = request;

      // Get recent search history
      const historyQuery = `
        SELECT
          query,
          timestamp,
          result_count as resultCount,
          execution_time as executionTime,
          successful,
          user_id as userId,
          session_id as sessionId
        FROM search_history
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      const history = this.dbManager.db
        .prepare(historyQuery)
        .all(userId, limit) as SearchHistoryEntry[];

      // Get popular searches
      const popularQuery = `
        SELECT
          query,
          COUNT(*) as count,
          MAX(timestamp) as lastUsed,
          AVG(COALESCE(result_count, 0)) as avgResultCount,
          AVG(CASE WHEN successful = 1 THEN 1.0 ELSE 0.0 END) as successRate
        FROM search_history
        WHERE user_id = ?
        GROUP BY query
        HAVING count > 1
        ORDER BY count DESC, lastUsed DESC
        LIMIT 20
      `;

      const popular = this.dbManager.db
        .prepare(popularQuery)
        .all(userId)
        .map((row: any) => ({
          query: row.query,
          count: row.count,
          lastUsed: new Date(row.lastUsed),
          avgResultCount: Math.round(row.avgResultCount * 10) / 10,
          successRate: Math.round(row.successRate * 100) / 100,
        }));

      let analytics;
      if (includeAnalytics) {
        const analyticsQuery = `
          SELECT
            COUNT(*) as totalSearches,
            COUNT(DISTINCT query) as uniqueQueries,
            AVG(COALESCE(result_count, 0)) as averageResultCount,
            AVG(CASE WHEN successful = 1 THEN 1.0 ELSE 0.0 END) as successRate
          FROM search_history
          WHERE user_id = ?
        `;

        const analyticsRow = this.dbManager.db.prepare(analyticsQuery).get(userId) as any;
        analytics = {
          totalSearches: analyticsRow.totalSearches,
          uniqueQueries: analyticsRow.uniqueQueries,
          averageResultCount: Math.round(analyticsRow.averageResultCount * 10) / 10,
          successRate: Math.round(analyticsRow.successRate * 100) / 100,
        };
      }

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, {
        history,
        popular,
        analytics,
      }) as GetHistoryResponse;
    } catch (error) {
      console.error('Get search history error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Failed to get search history: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Add entry to search history
   */
  handleAddEntry: IPCHandlerFunction<'searchHistory:add'> = async (request: AddEntryRequest) => {
    const startTime = Date.now();

    try {
      const { entry } = request;

      // Validate entry
      if (!entry.query || entry.query.trim().length === 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query is required'
        );
      }

      // Sanitize entry
      const sanitizedEntry = {
        query: HandlerUtils.sanitizeString(entry.query, 500),
        timestamp: entry.timestamp || new Date(),
        resultCount: typeof entry.resultCount === 'number' ? Math.max(0, entry.resultCount) : null,
        executionTime:
          typeof entry.executionTime === 'number' ? Math.max(0, entry.executionTime) : null,
        successful: typeof entry.successful === 'boolean' ? entry.successful : null,
        userId: entry.userId || 'default',
        sessionId: entry.sessionId || `session-${Date.now()}`,
      };

      // Insert into database
      const insertQuery = `
        INSERT INTO search_history (
          query, timestamp, result_count, execution_time, successful, user_id, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.dbManager.db
        .prepare(insertQuery)
        .run(
          sanitizedEntry.query,
          sanitizedEntry.timestamp.toISOString(),
          sanitizedEntry.resultCount,
          sanitizedEntry.executionTime,
          sanitizedEntry.successful,
          sanitizedEntry.userId,
          sanitizedEntry.sessionId
        );

      // Cleanup old entries (keep last 1000 per user)
      const cleanupQuery = `
        DELETE FROM search_history
        WHERE user_id = ? AND id NOT IN (
          SELECT id FROM search_history
          WHERE user_id = ?
          ORDER BY timestamp DESC
          LIMIT 1000
        )
      `;

      this.dbManager.db.prepare(cleanupQuery).run(sanitizedEntry.userId, sanitizedEntry.userId);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, {
        success: true,
        id: this.dbManager.db.prepare('SELECT last_insert_rowid()').get(),
      });
    } catch (error) {
      console.error('Add search history entry error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Failed to add search history entry: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Search within search history
   */
  handleSearchHistory: IPCHandlerFunction<'searchHistory:search'> = async (
    request: SearchHistoryRequest
  ) => {
    const startTime = Date.now();

    try {
      const { searchQuery, limit = 50, userId = 'default' } = request;

      if (!searchQuery || searchQuery.trim().length === 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Search query is required'
        );
      }

      const sanitizedQuery = HandlerUtils.sanitizeString(searchQuery, 100);

      // Search in history
      const historySearchQuery = `
        SELECT DISTINCT
          query,
          MAX(timestamp) as timestamp,
          AVG(COALESCE(result_count, 0)) as avgResultCount,
          COUNT(*) as frequency,
          AVG(CASE WHEN successful = 1 THEN 1.0 ELSE 0.0 END) as successRate
        FROM search_history
        WHERE user_id = ? AND query LIKE ?
        GROUP BY query
        ORDER BY frequency DESC, timestamp DESC
        LIMIT ?
      `;

      const results = this.dbManager.db
        .prepare(historySearchQuery)
        .all(userId, `%${sanitizedQuery}%`, limit)
        .map((row: any) => ({
          query: row.query,
          timestamp: new Date(row.timestamp),
          avgResultCount: Math.round(row.avgResultCount * 10) / 10,
          frequency: row.frequency,
          successRate: Math.round(row.successRate * 100) / 100,
        }));

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, results);
    } catch (error) {
      console.error('Search history error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Failed to search history: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Remove specific entry from history
   */
  handleRemoveEntry: IPCHandlerFunction<'searchHistory:remove'> = async (
    request: RemoveEntryRequest
  ) => {
    const startTime = Date.now();

    try {
      const { query, userId = 'default' } = request;

      if (!query || query.trim().length === 0) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Query is required'
        );
      }

      const sanitizedQuery = HandlerUtils.sanitizeString(query, 500);

      // Remove all entries with this query for the user
      const removeQuery = `DELETE FROM search_history WHERE user_id = ? AND query = ?`;
      const result = this.dbManager.db.prepare(removeQuery).run(userId, sanitizedQuery);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, {
        success: true,
        deletedCount: result.changes,
      });
    } catch (error) {
      console.error('Remove search history entry error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Failed to remove search history entry: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Clear all search history for a user
   */
  handleClearHistory: IPCHandlerFunction<'searchHistory:clear'> = async (
    request: ClearHistoryRequest
  ) => {
    const startTime = Date.now();

    try {
      const { userId = 'default', confirmToken } = request;

      // Require confirmation token for safety
      if (!confirmToken || confirmToken !== 'CONFIRM_CLEAR_HISTORY') {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.VALIDATION_FAILED,
          'Confirmation token required for clearing history'
        );
      }

      // Clear all history for the user
      const clearQuery = `DELETE FROM search_history WHERE user_id = ?`;
      const result = this.dbManager.db.prepare(clearQuery).run(userId);

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, {
        success: true,
        deletedCount: result.changes,
      });
    } catch (error) {
      console.error('Clear search history error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Failed to clear search history: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  /**
   * Get search history analytics
   */
  handleGetAnalytics: IPCHandlerFunction<'searchHistory:analytics'> = async (
    request: BaseIPCRequest
  ) => {
    const startTime = Date.now();

    try {
      const { userId = 'default' } = request as any;

      // Comprehensive analytics query
      const analyticsQuery = `
        WITH daily_stats AS (
          SELECT
            DATE(timestamp) as date,
            COUNT(*) as searches,
            COUNT(DISTINCT query) as unique_queries,
            AVG(COALESCE(result_count, 0)) as avg_results,
            AVG(CASE WHEN successful = 1 THEN 1.0 ELSE 0.0 END) as success_rate
          FROM search_history
          WHERE user_id = ?
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
          LIMIT 30
        ),
        top_queries AS (
          SELECT
            query,
            COUNT(*) as count,
            MAX(timestamp) as last_used,
            AVG(COALESCE(result_count, 0)) as avg_results
          FROM search_history
          WHERE user_id = ?
          GROUP BY query
          ORDER BY count DESC
          LIMIT 10
        )
        SELECT
          (SELECT COUNT(*) FROM search_history WHERE user_id = ?) as total_searches,
          (SELECT COUNT(DISTINCT query) FROM search_history WHERE user_id = ?) as unique_queries,
          (SELECT AVG(COALESCE(result_count, 0)) FROM search_history WHERE user_id = ?) as avg_result_count,
          (SELECT AVG(CASE WHEN successful = 1 THEN 1.0 ELSE 0.0 END) FROM search_history WHERE user_id = ?) as overall_success_rate,
          (SELECT json_group_array(json_object(
            'date', date,
            'searches', searches,
            'unique_queries', unique_queries,
            'avg_results', avg_results,
            'success_rate', success_rate
          )) FROM daily_stats) as daily_stats,
          (SELECT json_group_array(json_object(
            'query', query,
            'count', count,
            'last_used', last_used,
            'avg_results', avg_results
          )) FROM top_queries) as top_queries
      `;

      const result = this.dbManager.db
        .prepare(analyticsQuery)
        .get(userId, userId, userId, userId, userId, userId) as any;

      const analytics = {
        totalSearches: result.total_searches,
        uniqueQueries: result.unique_queries,
        averageResultCount: Math.round(result.avg_result_count * 10) / 10,
        overallSuccessRate: Math.round(result.overall_success_rate * 100) / 100,
        dailyStats: JSON.parse(result.daily_stats || '[]'),
        topQueries: JSON.parse(result.top_queries || '[]'),
      };

      return HandlerUtils.createSuccessResponse(request.requestId, startTime, analytics);
    } catch (error) {
      console.error('Get search analytics error:', error);
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        `Failed to get search analytics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

// Handler configuration
export const searchHistoryHandlerConfigs = {
  'searchHistory:get': HandlerConfigs.READ_OPERATIONS,
  'searchHistory:add': HandlerConfigs.WRITE_OPERATIONS,
  'searchHistory:search': HandlerConfigs.SEARCH_OPERATIONS,
  'searchHistory:remove': HandlerConfigs.WRITE_OPERATIONS,
  'searchHistory:clear': {
    ...HandlerConfigs.WRITE_OPERATIONS,
    rateLimitConfig: { requests: 5, windowMs: 300000 }, // More restrictive for clear operations
  },
  'searchHistory:analytics': HandlerConfigs.READ_OPERATIONS,
} as const;
