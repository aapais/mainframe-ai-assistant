/**
 * MetricsService - Comprehensive analytics and performance monitoring
 * Production-ready metrics collection with real-time analytics and alerting
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import {
  IMetricsService,
  SearchQuery,
  SearchResult,
  UsageAction,
  ServiceError,
  KBMetrics,
  MetricTrends,
  MetricAlert,
  CategoryMetrics,
  SearchMetrics,
  UsageMetrics,
  PerformanceMetrics,
  PopularSearch,
  UsageActivity,
  TrendData,
  MetricsConfig,
  DatabaseError
} from '../types/services';

interface MetricSnapshot {
  id?: number;
  timestamp: string;
  metric_type: string;
  metric_name: string;
  value: number;
  metadata?: string;
}

interface SearchHistoryRecord {
  id?: number;
  query: string;
  timestamp: string;
  results_count: number;
  selected_entry_id?: string;
  user_id?: string;
  session_id?: string;
  search_type: string;
  response_time: number;
  success: boolean;
  metadata?: string;
}

interface UsageRecord {
  id?: number;
  entry_id: string;
  action: string;
  timestamp: string;
  user_id?: string;
  session_id?: string;
  metadata?: string;
  value?: number;
}

/**
 * Comprehensive Metrics Service
 * Provides real-time analytics, trend analysis, and performance monitoring
 */
export class MetricsService extends EventEmitter implements IMetricsService {
  private db: Database.Database;
  private aggregationInterval?: ReturnType<typeof setTimeout>;
  private alertCheckInterval?: ReturnType<typeof setTimeout>;
  private alerts = new Map<string, MetricAlert>();

  // Prepared statements for performance
  private statements: {
    insertSearch: Database.Statement;
    insertUsage: Database.Statement;
    insertSnapshot: Database.Statement;
    insertAlert: Database.Statement;
    updateAlert: Database.Statement;
    selectRecentSearches: Database.Statement;
    selectPopularSearches: Database.Statement;
    selectUsageActivity: Database.Statement;
    selectMetricSnapshots: Database.Statement;
  };

  constructor(
    private config: MetricsConfig,
    private dbPath: string = ':memory:'
  ) {
    super();
    this.initializeDatabase();
    this.setupPeriodicTasks();
  }

  /**
   * Record search query and results
   */
  async recordSearch(query: SearchQuery, results: SearchResult[]): Promise<void> {
    try {
      const searchRecord: SearchHistoryRecord = {
        query: query.text,
        timestamp: query.timestamp.toISOString(),
        results_count: results.length,
        user_id: query.user_id,
        session_id: query.session_id,
        search_type: this.determineSearchType(results),
        response_time: this.calculateAverageResponseTime(results),
        success: results.length > 0,
        metadata: JSON.stringify({
          options: query.options,
          topScore: results.length > 0 ? results[0].score : 0,
          hasAIResults: results.some(r => r.matchType === 'ai' || r.matchType === 'semantic')
        })
      };

      this.statements.insertSearch.run(
        searchRecord.query,
        searchRecord.timestamp,
        searchRecord.results_count,
        searchRecord.selected_entry_id,
        searchRecord.user_id,
        searchRecord.session_id,
        searchRecord.search_type,
        searchRecord.response_time,
        searchRecord.success ? 1 : 0,
        searchRecord.metadata
      );

      // Record performance snapshot
      await this.recordPerformance('search_response_time', searchRecord.response_time);
      await this.recordPerformance('search_result_count', results.length);

      // Check for alerts
      this.checkSearchAlerts(searchRecord, results);

      this.emit('search:recorded', query, results);
    } catch (error) {
      console.error('Failed to record search:', error);
      throw new DatabaseError('Failed to record search metrics', 'recordSearch', { query, error });
    }
  }

  /**
   * Record usage action
   */
  async recordUsage(entryId: string, action: UsageAction, userId?: string, metadata?: any): Promise<void> {
    try {
      const usageRecord: UsageRecord = {
        entry_id: entryId,
        action,
        timestamp: new Date().toISOString(),
        user_id: userId,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      };

      this.statements.insertUsage.run(
        usageRecord.entry_id,
        usageRecord.action,
        usageRecord.timestamp,
        usageRecord.user_id,
        usageRecord.session_id,
        usageRecord.metadata,
        usageRecord.value
      );

      // Record performance snapshot for usage patterns
      await this.recordPerformance('usage_frequency', 1);

      this.emit('usage:recorded', entryId, action, userId, metadata);
    } catch (error) {
      console.error('Failed to record usage:', error);
      throw new DatabaseError('Failed to record usage metrics', 'recordUsage', { entryId, action, error });
    }
  }

  /**
   * Record system error
   */
  async recordError(error: ServiceError): Promise<void> {
    try {
      const errorRecord = {
        entry_id: 'system',
        action: 'error',
        timestamp: new Date().toISOString(),
        metadata: JSON.stringify({
          type: error.name,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          recoverable: error.recoverable,
          details: error.details
        }),
        value: error.statusCode
      };

      this.statements.insertUsage.run(
        errorRecord.entry_id,
        errorRecord.action,
        errorRecord.timestamp,
        null,
        null,
        errorRecord.metadata,
        errorRecord.value
      );

      // Record error rate
      await this.recordPerformance('error_rate', 1);

      // Create alert for critical errors
      if (error.statusCode >= 500) {
        await this.createAlert({
          id: `error-${Date.now()}`,
          type: 'error',
          severity: 'error',
          title: 'System Error Detected',
          message: `${error.name}: ${error.message}`,
          value: error.statusCode,
          threshold: 500,
          timestamp: new Date(),
          acknowledged: false
        });
      }

      this.emit('error:recorded', error);
    } catch (recordError) {
      console.error('Failed to record error metrics:', recordError);
    }
  }

  /**
   * Record performance metric
   */
  async recordPerformance(operation: string, duration: number, metadata?: any): Promise<void> {
    try {
      const snapshot: MetricSnapshot = {
        timestamp: new Date().toISOString(),
        metric_type: 'performance',
        metric_name: operation,
        value: duration,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      };

      this.statements.insertSnapshot.run(
        snapshot.timestamp,
        snapshot.metric_type,
        snapshot.metric_name,
        snapshot.value,
        snapshot.metadata
      );

      // Check performance thresholds
      await this.checkPerformanceAlerts(operation, duration);

      this.emit('performance:recorded', operation, duration, metadata);
    } catch (error) {
      console.error('Failed to record performance metric:', error);
    }
  }

  /**
   * Get comprehensive metrics
   */
  async getMetrics(period: string = '24h'): Promise<KBMetrics> {
    try {
      const timeRange = this.getPeriodTimeRange(period);
      
      const [overview, categories, searches, usage, performance, trends] = await Promise.all([
        this.getOverviewMetrics(timeRange),
        this.getCategoryMetrics(timeRange),
        this.getSearchMetrics(timeRange),
        this.getUsageMetrics(timeRange),
        this.getPerformanceMetrics(timeRange),
        this.getTrends(period)
      ]);

      const alerts = Array.from(this.alerts.values())
        .filter(alert => !alert.acknowledged)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      return {
        overview,
        categories,
        searches,
        usage,
        performance,
        trends,
        alerts
      };
    } catch (error) {
      throw new DatabaseError('Failed to get metrics', 'getMetrics', { period, error });
    }
  }

  /**
   * Get trend analysis
   */
  async getTrends(period: string = '24h'): Promise<MetricTrends> {
    try {
      const timeRange = this.getPeriodTimeRange(period);
      const intervalSize = this.getIntervalSize(period);

      const trends = await Promise.all([
        this.getTrendData('searches', 'search', timeRange, intervalSize),
        this.getTrendData('usage', 'usage', timeRange, intervalSize),
        this.getTrendData('success_rate', 'search', timeRange, intervalSize),
        this.getTrendData('performance', 'performance', timeRange, intervalSize),
        this.getTrendData('users', 'usage', timeRange, intervalSize),
        this.getTrendData('errors', 'error', timeRange, intervalSize)
      ]);

      return {
        period,
        searches: trends[0],
        usage: trends[1],
        successRate: trends[2],
        performance: trends[3],
        users: trends[4],
        errors: trends[5]
      };
    } catch (error) {
      throw new DatabaseError('Failed to get trends', 'getTrends', { period, error });
    }
  }

  /**
   * Get active alerts
   */
  async getAlerts(): Promise<MetricAlert[]> {
    return Array.from(this.alerts.values())
      .sort((a, b) => {
        if (a.acknowledged !== b.acknowledged) {
          return a.acknowledged ? 1 : -1;
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return;
    }

    alert.acknowledged = true;
    this.alerts.set(alertId, alert);

    try {
      this.statements.updateAlert.run(1, new Date().toISOString(), 'system', alertId);
    } catch (error) {
      console.error('Failed to update alert in database:', error);
    }

    this.emit('alert:acknowledged', alertId);
  }

  /**
   * Export metrics in different formats
   */
  async exportMetrics(format: 'json' | 'csv' | 'prometheus' = 'json'): Promise<string> {
    const metrics = await this.getMetrics('7d');

    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      
      case 'csv':
        return this.exportToCSV(metrics);
      
      case 'prometheus':
        return this.exportToPrometheus(metrics);
      
      default:
        throw new ServiceError(`Unsupported export format: ${format}`, 'INVALID_FORMAT');
    }
  }

  // =========================
  // Private Methods
  // =========================

  private initializeDatabase(): void {
    this.db = new Database(this.dbPath);

    // Create schema
    this.db.exec(`
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

      CREATE TABLE IF NOT EXISTS metric_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        metadata TEXT
      );

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

      CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_entry_id ON usage_metrics(entry_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON metric_snapshots(timestamp, metric_type);
      CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged, timestamp);
    `);

    this.prepareStatements();
    this.loadExistingAlerts();
  }

  private prepareStatements(): void {
    this.statements = {
      insertSearch: this.db.prepare(`
        INSERT INTO search_history (query, timestamp, results_count, selected_entry_id, user_id, session_id, search_type, response_time, success, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      insertUsage: this.db.prepare(`
        INSERT INTO usage_metrics (entry_id, action, timestamp, user_id, session_id, metadata, value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),

      insertSnapshot: this.db.prepare(`
        INSERT INTO metric_snapshots (timestamp, metric_type, metric_name, value, metadata)
        VALUES (?, ?, ?, ?, ?)
      `),

      insertAlert: this.db.prepare(`
        INSERT OR REPLACE INTO alerts (id, type, severity, title, message, value, threshold, timestamp, acknowledged, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      updateAlert: this.db.prepare(`
        UPDATE alerts SET acknowledged = ?, acknowledged_at = ?, acknowledged_by = ? WHERE id = ?
      `),

      selectRecentSearches: this.db.prepare(`
        SELECT * FROM search_history 
        WHERE timestamp >= ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `),

      selectPopularSearches: this.db.prepare(`
        SELECT query, COUNT(*) as count, AVG(results_count) as avg_results,
               SUM(CASE WHEN success THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
               MAX(timestamp) as last_used
        FROM search_history 
        WHERE timestamp >= ?
        GROUP BY query 
        ORDER BY count DESC 
        LIMIT ?
      `),

      selectUsageActivity: this.db.prepare(`
        SELECT * FROM usage_metrics 
        WHERE timestamp >= ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `),

      selectMetricSnapshots: this.db.prepare(`
        SELECT * FROM metric_snapshots 
        WHERE timestamp >= ? AND metric_type = ? 
        ORDER BY timestamp DESC
      `)
    };
  }

  private loadExistingAlerts(): void {
    try {
      const alertRows = this.db.prepare(`
        SELECT * FROM alerts WHERE acknowledged = 0 ORDER BY timestamp DESC
      `).all() as any[];

      alertRows.forEach(row => {
        const alert: MetricAlert = {
          id: row.id,
          type: row.type,
          severity: row.severity,
          title: row.title,
          message: row.message,
          value: row.value,
          threshold: row.threshold,
          timestamp: new Date(row.timestamp),
          acknowledged: Boolean(row.acknowledged),
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };

        this.alerts.set(alert.id, alert);
      });
    } catch (error) {
      console.warn('Failed to load existing alerts:', error);
    }
  }

  private setupPeriodicTasks(): void {
    if (this.config.aggregation.enabled) {
      this.aggregationInterval = setInterval(
        () => this.performAggregation(),
        this.config.aggregation.interval
      );
    }

    // Alert checking every 5 minutes
    this.alertCheckInterval = setInterval(
      () => this.checkSystemAlerts(),
      5 * 60 * 1000
    );
  }

  private async performAggregation(): Promise<void> {
    try {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Aggregate search metrics
      const searchStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_searches,
          AVG(results_count) as avg_results,
          AVG(response_time) as avg_response_time,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate
        FROM search_history 
        WHERE timestamp >= ?
      `).get(hourAgo.toISOString()) as any;

      if (searchStats && searchStats.total_searches > 0) {
        await this.recordPerformance('hourly_searches', searchStats.total_searches);
        await this.recordPerformance('hourly_avg_response_time', searchStats.avg_response_time);
        await this.recordPerformance('hourly_success_rate', searchStats.success_rate);
      }

      // Aggregate usage metrics
      const usageStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT entry_id) as unique_entries
        FROM usage_metrics 
        WHERE timestamp >= ?
      `).get(hourAgo.toISOString()) as any;

      if (usageStats && usageStats.total_actions > 0) {
        await this.recordPerformance('hourly_usage', usageStats.total_actions);
        await this.recordPerformance('hourly_active_users', usageStats.unique_users);
      }

      console.debug('Metrics aggregation completed');
    } catch (error) {
      console.error('Failed to perform metrics aggregation:', error);
    }
  }

  private async checkSystemAlerts(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Check error rate
      const errorCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM usage_metrics 
        WHERE action = 'error' AND timestamp >= ?
      `).get(fiveMinAgo.toISOString()) as any;

      if (errorCount.count > 10) {
        await this.createAlert({
          id: `high-error-rate-${Date.now()}`,
          type: 'error',
          severity: 'warning',
          title: 'High Error Rate',
          message: `${errorCount.count} errors in the last 5 minutes`,
          value: errorCount.count,
          threshold: 10,
          timestamp: now,
          acknowledged: false
        });
      }

      // Check response time
      const avgResponseTime = this.db.prepare(`
        SELECT AVG(response_time) as avg_time FROM search_history 
        WHERE timestamp >= ?
      `).get(fiveMinAgo.toISOString()) as any;

      if (avgResponseTime.avg_time > 2000) {
        await this.createAlert({
          id: `slow-response-${Date.now()}`,
          type: 'performance',
          severity: 'warning',
          title: 'Slow Response Times',
          message: `Average response time: ${Math.round(avgResponseTime.avg_time)}ms`,
          value: avgResponseTime.avg_time,
          threshold: 2000,
          timestamp: now,
          acknowledged: false
        });
      }

    } catch (error) {
      console.error('Failed to check system alerts:', error);
    }
  }

  private async createAlert(alert: MetricAlert): Promise<void> {
    this.alerts.set(alert.id, alert);

    try {
      this.statements.insertAlert.run(
        alert.id,
        alert.type,
        alert.severity,
        alert.title,
        alert.message,
        alert.value,
        alert.threshold,
        alert.timestamp.toISOString(),
        alert.acknowledged ? 1 : 0,
        alert.metadata ? JSON.stringify(alert.metadata) : null
      );
    } catch (error) {
      console.error('Failed to save alert to database:', error);
    }

    this.emit('alert:created', alert);
  }

  private determineSearchType(results: SearchResult[]): string {
    if (results.length === 0) return 'no_results';
    
    const hasAI = results.some(r => r.matchType === 'ai' || r.matchType === 'semantic');
    const hasExact = results.some(r => r.matchType === 'exact');
    
    if (hasAI) return 'ai_enhanced';
    if (hasExact) return 'exact_match';
    return 'fuzzy_match';
  }

  private calculateAverageResponseTime(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    const times = results
      .map(r => r.metadata?.processingTime || 0)
      .filter(t => t > 0);
    
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  private checkSearchAlerts(search: SearchHistoryRecord, results: SearchResult[]): void {
    // Check for no results pattern
    if (!search.success) {
      // Could implement logic to detect patterns of failed searches
    }

    // Check for slow searches
    if (search.response_time > 3000) {
      this.createAlert({
        id: `slow-search-${Date.now()}`,
        type: 'performance',
        severity: 'info',
        title: 'Slow Search Detected',
        message: `Search "${search.query}" took ${search.response_time}ms`,
        value: search.response_time,
        threshold: 3000,
        timestamp: new Date(),
        acknowledged: false
      });
    }
  }

  private async checkPerformanceAlerts(operation: string, value: number): Promise<void> {
    const thresholds = this.config.alerts?.thresholds || {};
    const threshold = thresholds[operation];
    
    if (!threshold || value <= threshold) return;

    await this.createAlert({
      id: `perf-${operation}-${Date.now()}`,
      type: 'performance',
      severity: value > threshold * 2 ? 'error' : 'warning',
      title: 'Performance Threshold Exceeded',
      message: `${operation}: ${value} exceeds threshold of ${threshold}`,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false
    });
  }

  private getPeriodTimeRange(period: string): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (period) {
      case '1h':
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  private getIntervalSize(period: string): number {
    switch (period) {
      case '1h': return 5 * 60 * 1000; // 5 minutes
      case '24h': return 60 * 60 * 1000; // 1 hour
      case '7d': return 24 * 60 * 60 * 1000; // 1 day
      case '30d': return 24 * 60 * 60 * 1000; // 1 day
      default: return 60 * 60 * 1000; // 1 hour
    }
  }

  private async getOverviewMetrics(timeRange: { start: Date; end: Date }): Promise<any> {
    const searches = this.db.prepare(`
      SELECT COUNT(*) as count FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const usage = this.db.prepare(`
      SELECT COUNT(*) as count, COUNT(DISTINCT user_id) as users FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const successRate = this.db.prepare(`
      SELECT AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as rate FROM search_history
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    return {
      totalEntries: 0, // Would need access to main KB
      totalSearches: searches.count || 0,
      averageSuccessRate: successRate.rate || 0,
      totalUsage: usage.count || 0,
      activeUsers: usage.users || 0,
      uptime: Date.now() - this.config.aggregation.interval
    };
  }

  private async getCategoryMetrics(timeRange: { start: Date; end: Date }): Promise<CategoryMetrics[]> {
    // This would require access to the main KB entries
    // For now return empty array
    return [];
  }

  private async getSearchMetrics(timeRange: { start: Date; end: Date }): Promise<SearchMetrics> {
    const totalSearches = this.db.prepare(`
      SELECT COUNT(*) as count FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const avgResults = this.db.prepare(`
      SELECT AVG(results_count) as avg FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const avgResponseTime = this.db.prepare(`
      SELECT AVG(response_time) as avg FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ? AND response_time > 0
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const noResultQueries = this.db.prepare(`
      SELECT query FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ? AND results_count = 0
      GROUP BY query 
      ORDER BY COUNT(*) DESC 
      LIMIT 10
    `).all(timeRange.start.toISOString(), timeRange.end.toISOString()) as any[];

    const popularQueries = this.statements.selectPopularSearches.all(
      timeRange.start.toISOString(),
      20
    ) as any[];

    const searchTypes = this.db.prepare(`
      SELECT search_type, COUNT(*) as count FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY search_type
    `).all(timeRange.start.toISOString(), timeRange.end.toISOString()) as any[];

    const searchTypesMap: Record<string, number> = {
      exact: 0,
      fuzzy: 0,
      semantic: 0,
      category: 0,
      tag: 0,
      ai: 0
    };

    searchTypes.forEach(st => {
      if (searchTypesMap.hasOwnProperty(st.search_type)) {
        searchTypesMap[st.search_type] = st.count;
      }
    });

    return {
      totalSearches: totalSearches.count || 0,
      uniqueQueries: 0, // Would need DISTINCT query count
      averageResultCount: avgResults.avg || 0,
      averageResponseTime: avgResponseTime.avg || 0,
      noResultQueries: noResultQueries.map(q => q.query),
      popularQueries: popularQueries.map(pq => ({
        query: pq.query,
        count: pq.count,
        averageResults: pq.avg_results,
        successRate: pq.success_rate,
        lastUsed: new Date(pq.last_used)
      })),
      searchTypes: searchTypesMap,
      aiUsage: {
        totalRequests: searchTypesMap.ai || 0,
        successRate: 0,
        averageLatency: 0,
        fallbackRate: 0
      }
    };
  }

  private async getUsageMetrics(timeRange: { start: Date; end: Date }): Promise<UsageMetrics> {
    const totalActivity = this.db.prepare(`
      SELECT COUNT(*) as count FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const uniqueUsers = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ? AND user_id IS NOT NULL
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const recentActivity = this.statements.selectUsageActivity.all(
      timeRange.start.toISOString(),
      50
    ) as any[];

    return {
      totalViews: 0,
      totalRatings: 0,
      averageRating: 0,
      uniqueUsers: uniqueUsers.count || 0,
      mostUsed: [],
      leastUsed: [],
      recentActivity: recentActivity.map(ra => ({
        timestamp: new Date(ra.timestamp),
        entryId: ra.entry_id,
        action: ra.action as UsageAction,
        userId: ra.user_id
      })),
      userEngagement: {
        dailyActive: 0,
        weeklyActive: 0,
        monthlyActive: 0,
        retention: 0
      }
    };
  }

  private async getPerformanceMetrics(timeRange: { start: Date; end: Date }): Promise<PerformanceMetrics> {
    const searchTimes = this.db.prepare(`
      SELECT AVG(response_time) as avg FROM search_history 
      WHERE timestamp >= ? AND timestamp <= ? AND response_time > 0
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const errorRate = this.db.prepare(`
      SELECT COUNT(*) as errors FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ? AND action = 'error'
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    const totalActions = this.db.prepare(`
      SELECT COUNT(*) as count FROM usage_metrics 
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(timeRange.start.toISOString(), timeRange.end.toISOString()) as any;

    return {
      averageSearchTime: searchTimes.avg || 0,
      averageDbTime: 0,
      averageAiTime: 0,
      cacheHitRate: 0,
      errorRate: totalActions.count > 0 ? errorRate.errors / totalActions.count : 0,
      uptime: Date.now() - this.config.aggregation.interval,
      memoryUsage: process.memoryUsage().heapUsed,
      diskUsage: 0,
      throughput: {
        searches: 0,
        creates: 0,
        updates: 0
      }
    };
  }

  private async getTrendData(
    type: string,
    metricType: string,
    timeRange: { start: Date; end: Date },
    intervalSize: number
  ): Promise<TrendData[]> {
    const trends: TrendData[] = [];
    const current = new Date(timeRange.start);

    while (current < timeRange.end) {
      const intervalEnd = new Date(current.getTime() + intervalSize);
      
      let value = 0;
      
      switch (type) {
        case 'searches':
          const searchCount = this.db.prepare(`
            SELECT COUNT(*) as count FROM search_history 
            WHERE timestamp >= ? AND timestamp < ?
          `).get(current.toISOString(), intervalEnd.toISOString()) as any;
          value = searchCount.count;
          break;
          
        case 'usage':
          const usageCount = this.db.prepare(`
            SELECT COUNT(*) as count FROM usage_metrics 
            WHERE timestamp >= ? AND timestamp < ?
          `).get(current.toISOString(), intervalEnd.toISOString()) as any;
          value = usageCount.count;
          break;
          
        case 'errors':
          const errorCount = this.db.prepare(`
            SELECT COUNT(*) as count FROM usage_metrics 
            WHERE timestamp >= ? AND timestamp < ? AND action = 'error'
          `).get(current.toISOString(), intervalEnd.toISOString()) as any;
          value = errorCount.count;
          break;
      }

      trends.push({
        timestamp: new Date(current),
        value,
        trend: trends.length > 0 ? (value > trends[trends.length - 1].value ? 'up' : value < trends[trends.length - 1].value ? 'down' : 'stable') : 'stable'
      });

      current.setTime(current.getTime() + intervalSize);
    }

    return trends;
  }

  private exportToCSV(metrics: KBMetrics): string {
    const lines = [
      'Metric,Value,Timestamp',
      `Total Entries,${metrics.overview.totalEntries},${new Date().toISOString()}`,
      `Total Searches,${metrics.overview.totalSearches},${new Date().toISOString()}`,
      `Average Success Rate,${metrics.overview.averageSuccessRate},${new Date().toISOString()}`,
      `Total Usage,${metrics.overview.totalUsage},${new Date().toISOString()}`,
      `Active Users,${metrics.overview.activeUsers},${new Date().toISOString()}`
    ];

    return lines.join('\n');
  }

  private exportToPrometheus(metrics: KBMetrics): string {
    const timestamp = Date.now();
    
    return [
      `# HELP kb_total_entries Total number of knowledge base entries`,
      `# TYPE kb_total_entries gauge`,
      `kb_total_entries ${metrics.overview.totalEntries} ${timestamp}`,
      '',
      `# HELP kb_total_searches Total number of searches performed`,
      `# TYPE kb_total_searches counter`,
      `kb_total_searches ${metrics.overview.totalSearches} ${timestamp}`,
      '',
      `# HELP kb_average_success_rate Average success rate of searches`,
      `# TYPE kb_average_success_rate gauge`,
      `kb_average_success_rate ${metrics.overview.averageSuccessRate} ${timestamp}`,
      ''
    ].join('\n');
  }

  /**
   * Close the metrics service and cleanup
   */
  async close(): Promise<void> {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    if (this.db) {
      this.db.close();
    }

    this.removeAllListeners();
  }
}

export default MetricsService;