/**
 * SearchMetrics - Comprehensive Performance Monitoring and Analytics
 *
 * Features:
 * - Real-time performance monitoring and alerting
 * - Query analytics and pattern detection
 * - Cache hit rate tracking across all layers
 * - Response time measurements and optimization insights
 * - User behavior analysis and search effectiveness
 * - System resource utilization monitoring
 * - Predictive performance analysis
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';

export interface PerformanceMetric {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: any;
}

export interface SearchAnalytics {
  totalSearches: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  cacheHitRate: number;
  popularQueries: Array<{
    query: string;
    count: number;
    avgResponseTime: number;
    successRate: number;
  }>;
  performanceTrends: Array<{
    date: string;
    avgResponseTime: number;
    totalSearches: number;
    cacheHitRate: number;
  }>;
}

export interface CacheMetrics {
  layer: string;
  level: number;
  hitRate: number;
  missRate: number;
  averageAccessTime: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  evictionCount: number;
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  lastTriggered?: number;
  triggerCount: number;
}

export interface PerformanceAlert {
  id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata: any;
  acknowledged: boolean;
  resolved: boolean;
}

export class SearchMetrics extends EventEmitter {
  private database?: Database.Database;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private cacheMetrics: Map<string, CacheMetrics> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, PerformanceAlert> = new Map();

  private metricsBuffer: PerformanceMetric[] = [];
  private bufferFlushInterval = 30000; // 30 seconds
  private maxMetricsInMemory = 10000;
  private alertCooldownPeriod = 300000; // 5 minutes

  constructor(database?: Database.Database) {
    super();
    this.database = database;
    this.initializeMetrics();
    this.setupAlertRules();
    this.startMetricsCollection();
  }

  /**
   * Record a performance metric
   */
  recordMetric(operation: string, duration: number, success: boolean = true, metadata?: any): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      operation,
      duration,
      success,
      metadata,
    };

    // Add to buffer for batch processing
    this.metricsBuffer.push(metric);

    // Also add to in-memory metrics for real-time analysis
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(metric);

    // Keep only recent metrics in memory
    if (operationMetrics.length > 1000) {
      operationMetrics.splice(0, operationMetrics.length - 1000);
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(operation, duration, success);
  }

  /**
   * Record cache performance metrics
   */
  recordCacheMetrics(
    layer: string,
    level: number,
    hitRate: number,
    averageAccessTime: number,
    memoryUsage: number = 0
  ): void {
    const existing = this.cacheMetrics.get(layer);

    if (existing) {
      existing.hitRate = hitRate;
      existing.missRate = 1 - hitRate;
      existing.averageAccessTime = averageAccessTime;
      existing.memoryUsage = memoryUsage;
    } else {
      this.cacheMetrics.set(layer, {
        layer,
        level,
        hitRate,
        missRate: 1 - hitRate,
        averageAccessTime,
        totalHits: 0,
        totalMisses: 0,
        memoryUsage,
        evictionCount: 0,
      });
    }

    // Check cache performance alerts
    this.checkCacheAlerts(layer, hitRate, averageAccessTime);
  }

  /**
   * Get comprehensive search analytics
   */
  async getSearchAnalytics(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<SearchAnalytics> {
    const cutoffTime = this.getCutoffTime(timeRange);
    const searchMetrics = this.getMetricsInTimeRange('search', cutoffTime);

    if (searchMetrics.length === 0) {
      return this.getEmptyAnalytics();
    }

    const responseTimes = searchMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successfulSearches = searchMetrics.filter(m => m.success);

    // Calculate percentiles
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Get popular queries from database if available
    const popularQueries = await this.getPopularQueries(cutoffTime);
    const performanceTrends = await this.getPerformanceTrends(timeRange);

    return {
      totalSearches: searchMetrics.length,
      averageResponseTime: this.average(responseTimes),
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      successRate: successfulSearches.length / searchMetrics.length,
      cacheHitRate: this.calculateOverallCacheHitRate(),
      popularQueries,
      performanceTrends,
    };
  }

  /**
   * Get real-time performance dashboard data
   */
  getRealTimeMetrics(): {
    currentQPS: number; // Queries per second
    averageResponseTime: number;
    cacheHitRate: number;
    activeAlerts: PerformanceAlert[];
    systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
    bottlenecks: string[];
  } {
    const now = Date.now();
    const lastMinute = now - 60000;

    // Calculate QPS from last minute
    const recentSearches = this.getMetricsInTimeRange('search', lastMinute);
    const currentQPS = recentSearches.length / 60;

    // Calculate average response time from last 5 minutes
    const last5Minutes = now - 300000;
    const recent5MinSearches = this.getMetricsInTimeRange('search', last5Minutes);
    const avgResponseTime =
      recent5MinSearches.length > 0 ? this.average(recent5MinSearches.map(m => m.duration)) : 0;

    // Get current cache hit rate
    const cacheHitRate = this.calculateOverallCacheHitRate();

    // Get active alerts
    const activeAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));

    // Determine system health
    const systemHealth = this.assessSystemHealth(
      avgResponseTime,
      cacheHitRate,
      activeAlerts.length
    );

    // Identify bottlenecks
    const bottlenecks = this.identifyPerformanceBottlenecks();

    return {
      currentQPS: Math.round(currentQPS * 100) / 100,
      averageResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      activeAlerts,
      systemHealth,
      bottlenecks,
    };
  }

  /**
   * Get cache layer metrics
   */
  getCacheLayerMetrics(): CacheMetrics[] {
    return Array.from(this.cacheMetrics.values()).sort((a, b) => a.level - b.level);
  }

  /**
   * Create custom alert rule
   */
  createAlertRule(
    name: string,
    condition: string,
    threshold: number,
    severity: AlertRule['severity']
  ): void {
    this.alertRules.set(name, {
      name,
      condition,
      threshold,
      severity,
      enabled: true,
      triggerCount: 0,
    });
  }

  /**
   * Get performance optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    category: 'cache' | 'query' | 'system' | 'database';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
  }> {
    const recommendations = [];

    // Cache optimization recommendations
    const cacheMetrics = this.getCacheLayerMetrics();
    cacheMetrics.forEach(cache => {
      if (cache.hitRate < 0.7) {
        recommendations.push({
          category: 'cache' as const,
          priority: 'high' as const,
          recommendation: `Improve ${cache.layer} hit rate (currently ${Math.round(cache.hitRate * 100)}%)`,
          impact: 'Reduced response times and database load',
          effort: 'medium' as const,
        });
      }

      if (cache.averageAccessTime > 50) {
        recommendations.push({
          category: 'cache' as const,
          priority: 'medium' as const,
          recommendation: `Optimize ${cache.layer} access time (currently ${Math.round(cache.averageAccessTime)}ms)`,
          impact: 'Faster cache retrieval',
          effort: 'low' as const,
        });
      }
    });

    // Query optimization recommendations
    const searchMetrics = this.getMetricsInTimeRange('search', Date.now() - 3600000);
    if (searchMetrics.length > 0) {
      const avgResponseTime = this.average(searchMetrics.map(m => m.duration));
      if (avgResponseTime > 500) {
        recommendations.push({
          category: 'query' as const,
          priority: 'high' as const,
          recommendation: 'Optimize slow queries (avg response time > 500ms)',
          impact: 'Significantly faster search responses',
          effort: 'medium' as const,
        });
      }
    }

    // System recommendations
    const systemHealth = this.getRealTimeMetrics().systemHealth;
    if (systemHealth === 'warning' || systemHealth === 'critical') {
      recommendations.push({
        category: 'system' as const,
        priority: 'high' as const,
        recommendation: 'Address system performance issues',
        impact: 'Improved overall system stability',
        effort: 'high' as const,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }

  /**
   * Export metrics for external analysis
   */
  async exportMetrics(
    format: 'json' | 'csv',
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<string> {
    const cutoffTime = this.getCutoffTime(timeRange);
    const allMetrics: PerformanceMetric[] = [];

    // Collect all metrics from memory
    this.metrics.forEach(metrics => {
      metrics.forEach(metric => {
        if (metric.timestamp >= cutoffTime) {
          allMetrics.push(metric);
        }
      });
    });

    // Collect from database if available
    if (this.database) {
      try {
        const dbMetrics = this.database
          .prepare(
            `
          SELECT * FROM search_metrics
          WHERE timestamp >= ?
          ORDER BY timestamp DESC
        `
          )
          .all(cutoffTime);
        allMetrics.push(...dbMetrics);
      } catch (error) {
        // Ignore database errors
      }
    }

    if (format === 'json') {
      return JSON.stringify(
        {
          timeRange,
          exportTime: new Date().toISOString(),
          totalMetrics: allMetrics.length,
          metrics: allMetrics,
          cacheMetrics: Object.fromEntries(this.cacheMetrics),
          activeAlerts: Object.fromEntries(this.activeAlerts),
        },
        null,
        2
      );
    } else {
      // CSV format
      const headers = 'timestamp,operation,duration,success,metadata\n';
      const rows = allMetrics
        .map(
          m =>
            `${m.timestamp},${m.operation},${m.duration},${m.success},${JSON.stringify(m.metadata || {})}`
        )
        .join('\n');
      return headers + rows;
    }
  }

  // Private helper methods

  private initializeMetrics(): void {
    // Initialize database tables if available
    if (this.database) {
      try {
        this.database.exec(`
          CREATE TABLE IF NOT EXISTS search_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            operation TEXT NOT NULL,
            duration REAL NOT NULL,
            success BOOLEAN NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.database.exec(`
          CREATE TABLE IF NOT EXISTS performance_alerts (
            id TEXT PRIMARY KEY,
            rule_name TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            metadata TEXT,
            acknowledged BOOLEAN DEFAULT FALSE,
            resolved BOOLEAN DEFAULT FALSE
          )
        `);

        this.database.exec(`
          CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
          ON search_metrics(timestamp)
        `);

        this.database.exec(`
          CREATE INDEX IF NOT EXISTS idx_metrics_operation
          ON search_metrics(operation)
        `);
      } catch (error) {
        console.error('Failed to initialize metrics database:', error);
      }
    }
  }

  private setupAlertRules(): void {
    // Default alert rules
    this.createAlertRule(
      'high_response_time',
      'average_response_time > threshold',
      1000, // 1 second
      'high'
    );

    this.createAlertRule(
      'low_cache_hit_rate',
      'cache_hit_rate < threshold',
      0.7, // 70%
      'medium'
    );

    this.createAlertRule(
      'high_error_rate',
      'error_rate > threshold',
      0.05, // 5%
      'critical'
    );

    this.createAlertRule(
      'slow_cache_access',
      'cache_access_time > threshold',
      100, // 100ms
      'medium'
    );
  }

  private startMetricsCollection(): void {
    // Flush metrics buffer periodically
    setInterval(() => {
      this.flushMetricsBuffer();
    }, this.bufferFlushInterval);

    // Clean up old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // Every hour

    // Performance monitoring
    setInterval(() => {
      this.performanceHealthCheck();
    }, 60000); // Every minute

    console.log('✅ SearchMetrics collection started');
  }

  private flushMetricsBuffer(): void {
    if (this.metricsBuffer.length === 0) return;

    // Store metrics in database if available
    if (this.database) {
      try {
        const stmt = this.database.prepare(`
          INSERT INTO search_metrics (timestamp, operation, duration, success, metadata)
          VALUES (?, ?, ?, ?, ?)
        `);

        const transaction = this.database.transaction(() => {
          this.metricsBuffer.forEach(metric => {
            stmt.run(
              metric.timestamp,
              metric.operation,
              metric.duration,
              metric.success,
              metric.metadata ? JSON.stringify(metric.metadata) : null
            );
          });
        });

        transaction();
      } catch (error) {
        console.error('Failed to flush metrics to database:', error);
      }
    }

    // Clear buffer
    this.metricsBuffer = [];
  }

  private checkPerformanceAlerts(operation: string, duration: number, success: boolean): void {
    const now = Date.now();

    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;

      // Check cooldown period
      if (rule.lastTriggered && now - rule.lastTriggered < this.alertCooldownPeriod) {
        return;
      }

      let shouldAlert = false;
      let alertMessage = '';

      switch (rule.condition) {
        case 'average_response_time > threshold':
          const recentMetrics = this.getMetricsInTimeRange(operation, now - 300000); // 5 minutes
          if (recentMetrics.length >= 5) {
            const avgTime = this.average(recentMetrics.map(m => m.duration));
            if (avgTime > rule.threshold) {
              shouldAlert = true;
              alertMessage = `Average response time for ${operation} is ${Math.round(avgTime)}ms (threshold: ${rule.threshold}ms)`;
            }
          }
          break;

        case 'error_rate > threshold':
          const errorMetrics = this.getMetricsInTimeRange(operation, now - 300000);
          if (errorMetrics.length >= 10) {
            const errorRate = errorMetrics.filter(m => !m.success).length / errorMetrics.length;
            if (errorRate > rule.threshold) {
              shouldAlert = true;
              alertMessage = `Error rate for ${operation} is ${Math.round(errorRate * 100)}% (threshold: ${Math.round(rule.threshold * 100)}%)`;
            }
          }
          break;
      }

      if (shouldAlert) {
        this.triggerAlert(rule, alertMessage, { operation, duration, success });
      }
    });
  }

  private checkCacheAlerts(layer: string, hitRate: number, accessTime: number): void {
    const now = Date.now();

    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;

      if (rule.lastTriggered && now - rule.lastTriggered < this.alertCooldownPeriod) {
        return;
      }

      let shouldAlert = false;
      let alertMessage = '';

      switch (rule.condition) {
        case 'cache_hit_rate < threshold':
          if (hitRate < rule.threshold) {
            shouldAlert = true;
            alertMessage = `Cache hit rate for ${layer} is ${Math.round(hitRate * 100)}% (threshold: ${Math.round(rule.threshold * 100)}%)`;
          }
          break;

        case 'cache_access_time > threshold':
          if (accessTime > rule.threshold) {
            shouldAlert = true;
            alertMessage = `Cache access time for ${layer} is ${Math.round(accessTime)}ms (threshold: ${rule.threshold}ms)`;
          }
          break;
      }

      if (shouldAlert) {
        this.triggerAlert(rule, alertMessage, { layer, hitRate, accessTime });
      }
    });
  }

  private triggerAlert(rule: AlertRule, message: string, metadata: any): void {
    const alertId = `${rule.name}_${Date.now()}`;
    const alert: PerformanceAlert = {
      id: alertId,
      rule: rule.name,
      severity: rule.severity,
      message,
      timestamp: Date.now(),
      metadata,
      acknowledged: false,
      resolved: false,
    };

    this.activeAlerts.set(alertId, alert);
    rule.lastTriggered = Date.now();
    rule.triggerCount++;

    // Store in database if available
    if (this.database) {
      try {
        this.database
          .prepare(
            `
          INSERT INTO performance_alerts (id, rule_name, severity, message, timestamp, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
        `
          )
          .run(alertId, rule.name, rule.severity, message, Date.now(), JSON.stringify(metadata));
      } catch (error) {
        console.error('Failed to store alert in database:', error);
      }
    }

    this.emit('performance-alert', alert);
    console.warn(`⚠️ Performance Alert: ${message}`);
  }

  private getMetricsInTimeRange(operation: string, cutoffTime: number): PerformanceMetric[] {
    const operationMetrics = this.metrics.get(operation) || [];
    return operationMetrics.filter(m => m.timestamp >= cutoffTime);
  }

  private getCutoffTime(timeRange: '1h' | '24h' | '7d' | '30d'): number {
    const now = Date.now();
    switch (timeRange) {
      case '1h':
        return now - 3600000;
      case '24h':
        return now - 86400000;
      case '7d':
        return now - 604800000;
      case '30d':
        return now - 2592000000;
      default:
        return now - 86400000;
    }
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  private calculateOverallCacheHitRate(): number {
    const cacheMetrics = Array.from(this.cacheMetrics.values());
    if (cacheMetrics.length === 0) return 0;

    const totalHits = cacheMetrics.reduce((sum, cache) => sum + cache.totalHits, 0);
    const totalRequests = cacheMetrics.reduce(
      (sum, cache) => sum + cache.totalHits + cache.totalMisses,
      0
    );

    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  private assessSystemHealth(
    avgResponseTime: number,
    cacheHitRate: number,
    alertCount: number
  ): 'excellent' | 'good' | 'warning' | 'critical' {
    if (alertCount > 0) {
      const hasHighSeverity = Array.from(this.activeAlerts.values()).some(
        alert => alert.severity === 'high' || alert.severity === 'critical'
      );
      if (hasHighSeverity) return 'critical';
      return 'warning';
    }

    if (avgResponseTime > 1000 || cacheHitRate < 0.5) return 'critical';
    if (avgResponseTime > 500 || cacheHitRate < 0.7) return 'warning';
    if (avgResponseTime < 200 && cacheHitRate > 0.9) return 'excellent';
    return 'good';
  }

  private identifyPerformanceBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    // Check for slow operations
    this.metrics.forEach((metrics, operation) => {
      if (metrics.length < 10) return; // Need sufficient data

      const recentMetrics = metrics.filter(m => m.timestamp > Date.now() - 300000); // 5 minutes
      if (recentMetrics.length === 0) return;

      const avgTime = this.average(recentMetrics.map(m => m.duration));
      if (avgTime > 500) {
        bottlenecks.push(`Slow ${operation} operations (avg: ${Math.round(avgTime)}ms)`);
      }
    });

    // Check cache performance
    this.cacheMetrics.forEach((metrics, layer) => {
      if (metrics.hitRate < 0.7) {
        bottlenecks.push(`Low ${layer} cache hit rate (${Math.round(metrics.hitRate * 100)}%)`);
      }
      if (metrics.averageAccessTime > 50) {
        bottlenecks.push(`Slow ${layer} cache access (${Math.round(metrics.averageAccessTime)}ms)`);
      }
    });

    return bottlenecks;
  }

  private getSeverityWeight(severity: string): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity as keyof typeof weights] || 0;
  }

  private async getPopularQueries(cutoffTime: number): Promise<SearchAnalytics['popularQueries']> {
    if (!this.database) return [];

    try {
      const results = this.database
        .prepare(
          `
        SELECT
          metadata ->> '$.query' as query,
          COUNT(*) as count,
          AVG(duration) as avgResponseTime,
          AVG(CASE WHEN success = 1 THEN 100 ELSE 0 END) as successRate
        FROM search_metrics
        WHERE timestamp >= ?
          AND operation = 'search'
          AND json_valid(metadata)
        GROUP BY metadata ->> '$.query'
        HAVING query IS NOT NULL
        ORDER BY count DESC
        LIMIT 10
      `
        )
        .all(cutoffTime);

      return results.map((row: any) => ({
        query: row.query,
        count: row.count,
        avgResponseTime: Math.round(row.avgResponseTime),
        successRate: Math.round(row.successRate) / 100,
      }));
    } catch (error) {
      return [];
    }
  }

  private async getPerformanceTrends(
    timeRange: string
  ): Promise<SearchAnalytics['performanceTrends']> {
    if (!this.database) return [];

    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 1;
      const results = this.database
        .prepare(
          `
        SELECT
          date(timestamp / 1000, 'unixepoch') as date,
          AVG(duration) as avgResponseTime,
          COUNT(*) as totalSearches,
          AVG(CASE WHEN operation LIKE 'cache_%' THEN 1 ELSE 0 END) as cacheHitRate
        FROM search_metrics
        WHERE timestamp >= ?
        GROUP BY date(timestamp / 1000, 'unixepoch')
        ORDER BY date DESC
        LIMIT ?
      `
        )
        .all(Date.now() - days * 86400000, days);

      return results.map((row: any) => ({
        date: row.date,
        avgResponseTime: Math.round(row.avgResponseTime),
        totalSearches: row.totalSearches,
        cacheHitRate: Math.round(row.cacheHitRate * 100) / 100,
      }));
    } catch (error) {
      return [];
    }
  }

  private getEmptyAnalytics(): SearchAnalytics {
    return {
      totalSearches: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      successRate: 0,
      cacheHitRate: 0,
      popularQueries: [],
      performanceTrends: [],
    };
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - 86400000; // 24 hours

    // Clean in-memory metrics
    this.metrics.forEach((metrics, operation) => {
      const filtered = metrics.filter(m => m.timestamp >= cutoff);
      if (filtered.length !== metrics.length) {
        this.metrics.set(operation, filtered);
      }
    });

    // Clean database metrics
    if (this.database) {
      try {
        this.database
          .prepare(
            `
          DELETE FROM search_metrics
          WHERE timestamp < ? AND id NOT IN (
            SELECT id FROM search_metrics
            ORDER BY timestamp DESC
            LIMIT 10000
          )
        `
          )
          .run(Date.now() - 604800000); // Keep last 7 days minimum
      } catch (error) {
        console.error('Failed to cleanup old metrics:', error);
      }
    }
  }

  private performanceHealthCheck(): void {
    const metrics = this.getRealTimeMetrics();

    if (metrics.systemHealth === 'critical') {
      this.emit('system-health-critical', metrics);
    } else if (metrics.systemHealth === 'warning') {
      this.emit('system-health-warning', metrics);
    }

    // Auto-resolve alerts that are no longer active
    this.autoResolveAlerts();
  }

  private autoResolveAlerts(): void {
    const now = Date.now();
    const autoResolveAge = 1800000; // 30 minutes

    this.activeAlerts.forEach((alert, id) => {
      if (!alert.resolved && now - alert.timestamp > autoResolveAge) {
        alert.resolved = true;

        // Update in database
        if (this.database) {
          try {
            this.database
              .prepare(
                `
              UPDATE performance_alerts
              SET resolved = TRUE
              WHERE id = ?
            `
              )
              .run(id);
          } catch (error) {
            // Ignore database errors
          }
        }

        this.emit('alert-auto-resolved', alert);
      }
    });
  }
}

export default SearchMetrics;
