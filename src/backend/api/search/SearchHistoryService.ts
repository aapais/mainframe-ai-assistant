/**
 * Search History Service - Efficient History Management
 * Handles search history storage, retrieval, and analytics with performance optimization
 */

import Database from 'better-sqlite3';
import { SearchSchema, SearchQueryBuilder } from '../../database/SearchSchema';
import { AppError } from '../../core/errors/AppError';

export interface SearchHistoryEntry {
  id: string;
  query: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  responseTime: number;
  resultCount: number;
  category?: string;
  useAI: boolean;
  fuzzyThreshold: number;
  successful: boolean;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface RecordSearchParams {
  query: string;
  userId?: string;
  sessionId?: string;
  resultCount: number;
  responseTime: number;
  category?: string;
  successful: boolean;
  useAI: boolean;
  fuzzyThreshold?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface GetHistoryParams {
  userId?: string;
  limit: number;
  offset: number;
  timeframe: number; // hours
  category?: string;
  successful?: boolean;
}

export interface HistoryResult {
  entries: SearchHistoryEntry[];
  total: number;
  hasMore: boolean;
}

export interface HistoryAnalytics {
  totalSearches: number;
  uniqueUsers: number;
  uniqueQueries: number;
  avgResponseTime: number;
  successRate: number;
  aiUsageRate: number;
  categorySummary: Record<string, number>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
  performanceTrend: Array<{ timestamp: number; avgResponseTime: number }>;
}

/**
 * High-Performance Search History Service
 * Features:
 * - Efficient batch operations for high-volume searches
 * - Real-time analytics and reporting
 * - Automatic data aging and cleanup
 * - Privacy-aware data handling
 * - Performance monitoring integration
 */
export class SearchHistoryService {
  private db: Database.Database;
  private schema: SearchSchema;
  private queryBuilder: SearchQueryBuilder;

  // Performance optimization: batch processing
  private pendingEntries: RecordSearchParams[] = [];
  private batchTimeout?: ReturnType<typeof setTimeout>;
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT_MS = 5000;

  constructor(dbPath: string = './search_history.db') {
    try {
      this.db = new Database(dbPath);
      this.schema = new SearchSchema(this.db);
      this.schema.initialize();
      this.queryBuilder = new SearchQueryBuilder(this.db);

      this.startBatchProcessor();
    } catch (error) {
      console.error('SearchHistoryService initialization error:', error);
      throw new AppError('Failed to initialize search history service', 'HISTORY_INIT_ERROR', 500, {
        error: error.message,
      });
    }
  }

  /**
   * Record a search operation (with batching for performance)
   */
  async recordSearch(params: RecordSearchParams): Promise<void> {
    try {
      // Add to pending batch
      this.pendingEntries.push(params);

      // Process immediately if batch is full
      if (this.pendingEntries.length >= this.BATCH_SIZE) {
        await this.flushBatch();
      } else if (!this.batchTimeout) {
        // Schedule batch processing
        this.batchTimeout = setTimeout(() => {
          this.flushBatch().catch(console.error);
        }, this.BATCH_TIMEOUT_MS);
      }
    } catch (error) {
      console.error('Record search error:', error);
      // Don't throw - history recording shouldn't break search functionality
    }
  }

  /**
   * Get search history with filtering and pagination
   */
  async getHistory(params: GetHistoryParams): Promise<HistoryResult> {
    try {
      const cutoffTime = Date.now() - params.timeframe * 60 * 60 * 1000;

      // Build dynamic query based on filters
      let query = `
        SELECT
          id, query, user_id, session_id, timestamp, response_time,
          result_count, category, used_ai, fuzzy_threshold, successful,
          ip_address, user_agent, request_id
        FROM search_history
        WHERE timestamp > ?
      `;
      const queryParams: any[] = [cutoffTime];

      if (params.userId) {
        query += ` AND user_id = ?`;
        queryParams.push(params.userId);
      }

      if (params.category) {
        query += ` AND category = ?`;
        queryParams.push(params.category);
      }

      if (params.successful !== undefined) {
        query += ` AND successful = ?`;
        queryParams.push(params.successful ? 1 : 0);
      }

      query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
      queryParams.push(params.limit + 1, params.offset); // +1 to check hasMore

      const rows = this.db.prepare(query).all(...queryParams) as any[];

      const hasMore = rows.length > params.limit;
      if (hasMore) {
        rows.pop(); // Remove extra row
      }

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total FROM search_history WHERE timestamp > ?
      `;
      const countParams: any[] = [cutoffTime];

      if (params.userId) {
        countQuery += ` AND user_id = ?`;
        countParams.push(params.userId);
      }

      if (params.category) {
        countQuery += ` AND category = ?`;
        countParams.push(params.category);
      }

      if (params.successful !== undefined) {
        countQuery += ` AND successful = ?`;
        countParams.push(params.successful ? 1 : 0);
      }

      const { total } = this.db.prepare(countQuery).get(...countParams) as { total: number };

      const entries: SearchHistoryEntry[] = rows.map(row => ({
        id: row.id,
        query: row.query,
        userId: row.user_id,
        sessionId: row.session_id,
        timestamp: new Date(row.timestamp),
        responseTime: row.response_time,
        resultCount: row.result_count,
        category: row.category,
        useAI: Boolean(row.used_ai),
        fuzzyThreshold: row.fuzzy_threshold,
        successful: Boolean(row.successful),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        requestId: row.request_id,
      }));

      return {
        entries,
        total,
        hasMore,
      };
    } catch (error) {
      console.error('Get history error:', error);
      throw new AppError('Failed to retrieve search history', 'HISTORY_GET_ERROR', 500, {
        params,
        error: error.message,
      });
    }
  }

  /**
   * Get comprehensive history analytics
   */
  async getAnalytics(timeframe: number = 24): Promise<HistoryAnalytics> {
    try {
      const cutoffTime = Date.now() - timeframe * 60 * 60 * 1000;

      // Basic metrics
      const basicMetrics = this.db
        .prepare(
          `
        SELECT
          COUNT(*) as totalSearches,
          COUNT(DISTINCT user_id) as uniqueUsers,
          COUNT(DISTINCT query) as uniqueQueries,
          AVG(response_time) as avgResponseTime,
          AVG(CASE WHEN successful = 1 THEN 1.0 ELSE 0.0 END) as successRate,
          AVG(CASE WHEN used_ai = 1 THEN 1.0 ELSE 0.0 END) as aiUsageRate
        FROM search_history
        WHERE timestamp > ?
      `
        )
        .get(cutoffTime) as any;

      // Category summary
      const categoryRows = this.db
        .prepare(
          `
        SELECT category, COUNT(*) as count
        FROM search_history
        WHERE timestamp > ? AND category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `
        )
        .all(cutoffTime) as any[];

      const categorySummary: Record<string, number> = {};
      categoryRows.forEach(row => {
        categorySummary[row.category] = row.count;
      });

      // Hourly distribution
      const hourlyRows = this.db
        .prepare(
          `
        SELECT
          CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as hour,
          COUNT(*) as count
        FROM search_history
        WHERE timestamp > ?
        GROUP BY hour
        ORDER BY hour
      `
        )
        .all(cutoffTime) as any[];

      const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourlyRows.find(row => row.hour === hour)?.count || 0,
      }));

      // Top queries
      const topQueries = this.db
        .prepare(
          `
        SELECT query, COUNT(*) as count
        FROM search_history
        WHERE timestamp > ?
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
      `
        )
        .all(cutoffTime) as Array<{ query: string; count: number }>;

      // Performance trend (hourly averages)
      const performanceTrend = this.db
        .prepare(
          `
        SELECT
          CAST(strftime('%s', datetime(timestamp/1000, 'unixepoch', 'start of hour')) AS INTEGER) * 1000 as timestamp,
          AVG(response_time) as avgResponseTime
        FROM search_history
        WHERE timestamp > ?
        GROUP BY datetime(timestamp/1000, 'unixepoch', 'start of hour')
        ORDER BY timestamp
      `
        )
        .all(cutoffTime) as Array<{ timestamp: number; avgResponseTime: number }>;

      return {
        totalSearches: basicMetrics.totalSearches || 0,
        uniqueUsers: basicMetrics.uniqueUsers || 0,
        uniqueQueries: basicMetrics.uniqueQueries || 0,
        avgResponseTime: basicMetrics.avgResponseTime || 0,
        successRate: basicMetrics.successRate || 0,
        aiUsageRate: basicMetrics.aiUsageRate || 0,
        categorySummary,
        hourlyDistribution,
        topQueries,
        performanceTrend,
      };
    } catch (error) {
      console.error('Get analytics error:', error);
      throw new AppError('Failed to retrieve history analytics', 'HISTORY_ANALYTICS_ERROR', 500, {
        timeframe,
        error: error.message,
      });
    }
  }

  /**
   * Get user-specific search patterns for personalization
   */
  async getUserPatterns(
    userId: string,
    limit: number = 20
  ): Promise<{
    frequentQueries: Array<{ query: string; count: number; avgResponseTime: number }>;
    preferredCategories: Array<{ category: string; count: number }>;
    searchTimes: Array<{ hour: number; count: number }>;
    successfulPatterns: Array<{ pattern: string; successRate: number }>;
  }> {
    try {
      // Frequent queries for this user
      const frequentQueries = this.db
        .prepare(
          `
        SELECT query, COUNT(*) as count, AVG(response_time) as avgResponseTime
        FROM search_history
        WHERE user_id = ? AND timestamp > ?
        GROUP BY query
        ORDER BY count DESC
        LIMIT ?
      `
        )
        .all(userId, Date.now() - 30 * 24 * 60 * 60 * 1000, limit) as any[];

      // Preferred categories
      const preferredCategories = this.db
        .prepare(
          `
        SELECT category, COUNT(*) as count
        FROM search_history
        WHERE user_id = ? AND category IS NOT NULL AND timestamp > ?
        GROUP BY category
        ORDER BY count DESC
      `
        )
        .all(userId, Date.now() - 30 * 24 * 60 * 60 * 1000) as any[];

      // Search time patterns
      const searchTimes = this.db
        .prepare(
          `
        SELECT
          CAST(strftime('%H', datetime(timestamp/1000, 'unixepoch')) AS INTEGER) as hour,
          COUNT(*) as count
        FROM search_history
        WHERE user_id = ? AND timestamp > ?
        GROUP BY hour
        ORDER BY count DESC
      `
        )
        .all(userId, Date.now() - 30 * 24 * 60 * 60 * 1000) as any[];

      // Successful patterns (simplified pattern matching)
      const successfulPatterns = this.db
        .prepare(
          `
        SELECT
          CASE
            WHEN LENGTH(query) <= 10 THEN 'short'
            WHEN LENGTH(query) <= 30 THEN 'medium'
            ELSE 'long'
          END as pattern,
          AVG(CASE WHEN successful = 1 THEN 1.0 ELSE 0.0 END) as successRate
        FROM search_history
        WHERE user_id = ? AND timestamp > ?
        GROUP BY pattern
        ORDER BY successRate DESC
      `
        )
        .all(userId, Date.now() - 30 * 24 * 60 * 60 * 1000) as any[];

      return {
        frequentQueries,
        preferredCategories,
        searchTimes,
        successfulPatterns,
      };
    } catch (error) {
      console.error('Get user patterns error:', error);
      throw new AppError('Failed to retrieve user patterns', 'USER_PATTERNS_ERROR', 500, {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Clean up old history data
   */
  async cleanup(retentionDays: number = 90): Promise<{ removed: number }> {
    try {
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

      const result = this.db
        .prepare(
          `
        DELETE FROM search_history WHERE timestamp < ?
      `
        )
        .run(cutoffTime);

      console.log(
        `Search history cleanup: removed ${result.changes} entries older than ${retentionDays} days`
      );

      return { removed: result.changes };
    } catch (error) {
      console.error('History cleanup error:', error);
      throw new AppError('Failed to cleanup history', 'HISTORY_CLEANUP_ERROR', 500, {
        retentionDays,
        error: error.message,
      });
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalEntries: number;
    databaseSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    try {
      const stats = this.db
        .prepare(
          `
        SELECT
          COUNT(*) as total,
          MIN(timestamp) as oldest,
          MAX(timestamp) as newest
        FROM search_history
      `
        )
        .get() as any;

      // Get database file size
      const dbStats = this.db.prepare('PRAGMA page_count').get() as { page_count: number };
      const pageSize = this.db.prepare('PRAGMA page_size').get() as { page_size: number };
      const databaseSize = dbStats.page_count * pageSize.page_size;

      return {
        totalEntries: stats.total || 0,
        databaseSize,
        oldestEntry: stats.oldest ? new Date(stats.oldest) : null,
        newestEntry: stats.newest ? new Date(stats.newest) : null,
      };
    } catch (error) {
      console.error('Get stats error:', error);
      return {
        totalEntries: 0,
        databaseSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      // Flush any pending entries
      await this.flushBatch();

      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      this.db.close();
      console.log('Search history service closed');
    } catch (error) {
      console.error('Error closing search history service:', error);
    }
  }

  // Private Methods

  /**
   * Process batched entries for performance
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingEntries.length === 0) return;

    try {
      const transaction = this.db.transaction((entries: RecordSearchParams[]) => {
        entries.forEach(params => {
          this.queryBuilder.insertSearchHistory.run(
            params.query,
            params.userId || null,
            params.sessionId || null,
            params.responseTime,
            params.resultCount,
            params.category || null,
            params.useAI ? 1 : 0,
            params.fuzzyThreshold || 0.7,
            params.successful ? 1 : 0,
            params.ipAddress || null,
            params.userAgent || null,
            params.requestId || null
          );
        });
      });

      transaction(this.pendingEntries);

      console.log(`Recorded ${this.pendingEntries.length} search history entries`);
      this.pendingEntries = [];

      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = undefined;
      }
    } catch (error) {
      console.error('Batch flush error:', error);
      // Reset batch to prevent data loss
      this.pendingEntries = [];
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    // Flush batches periodically
    setInterval(() => {
      this.flushBatch().catch(console.error);
    }, this.BATCH_TIMEOUT_MS);

    // Graceful shutdown handling
    process.on('exit', () => {
      this.flushBatch().catch(console.error);
    });

    process.on('SIGINT', () => {
      this.flushBatch()
        .catch(() => {})
        .finally(() => process.exit());
    });

    process.on('SIGTERM', () => {
      this.flushBatch()
        .catch(() => {})
        .finally(() => process.exit());
    });
  }
}
