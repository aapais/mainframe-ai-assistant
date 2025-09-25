/**
 * Dashboard Data Provider for SQLite Performance Monitoring
 *
 * Provides comprehensive real-time and historical data for monitoring dashboards,
 * including Grafana integration and custom dashboard APIs.
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { PerformanceMonitor } from './PerformanceMonitor';
import { MetricsCollector } from './MetricsCollector';
import { HealthCheck } from './HealthCheck';
import { QueryAnalyzer } from './QueryAnalyzer';

export interface DashboardMetrics {
  timestamp: number;
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    cacheHitRate: number;
    activeConnections: number;
    memoryUsage: number;
  };
  health: {
    overall: 'healthy' | 'warning' | 'critical' | 'unknown';
    score: number;
    activeAlerts: number;
    lastCheck: number;
  };
  queries: {
    totalQueries: number;
    slowQueries: number;
    topSlowQueries: Array<{
      query: string;
      avgDuration: number;
      occurrences: number;
    }>;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    uptime: number;
  };
}

export interface TimeSeriesData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: Array<{ x: number; y: number }>;
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
  }>;
}

export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  recent: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: number;
    resolved: boolean;
  }>;
}

export interface CapacityPlanningData {
  projections: {
    storage: {
      current: number;
      projected30Days: number;
      projected90Days: number;
      growthRate: number;
    };
    connections: {
      current: number;
      peak: number;
      projected: number;
      utilization: number;
    };
    queries: {
      currentQPS: number;
      peakQPS: number;
      projectedQPS: number;
      growthTrend: 'increasing' | 'stable' | 'decreasing';
    };
  };
  recommendations: Array<{
    type: 'storage' | 'performance' | 'scaling';
    urgency: 'low' | 'medium' | 'high';
    description: string;
    timeline: string;
  }>;
}

export interface DashboardConfig {
  refreshInterval: number; // seconds
  retentionPeriod: number; // days
  enableRealTime: boolean;
  enableAlerts: boolean;
  enableTrends: boolean;
  enableCapacityPlanning: boolean;
  customMetrics: string[];
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

export class DashboardProvider extends EventEmitter {
  private db: Database.Database;
  private config: DashboardConfig;
  private performanceMonitor: PerformanceMonitor;
  private metricsCollector: MetricsCollector;
  private healthCheck: HealthCheck;
  private queryAnalyzer: QueryAnalyzer;

  private refreshTimer?: ReturnType<typeof setTimeout>;
  private isRunning = false;
  private lastMetrics?: DashboardMetrics;
  private metricsHistory: DashboardMetrics[] = [];

  constructor(
    db: Database.Database,
    performanceMonitor: PerformanceMonitor,
    metricsCollector: MetricsCollector,
    healthCheck: HealthCheck,
    queryAnalyzer: QueryAnalyzer,
    config?: Partial<DashboardConfig>
  ) {
    super();
    this.db = db;
    this.performanceMonitor = performanceMonitor;
    this.metricsCollector = metricsCollector;
    this.healthCheck = healthCheck;
    this.queryAnalyzer = queryAnalyzer;
    this.config = this.buildConfig(config);

    this.initializeProvider();
  }

  private buildConfig(config?: Partial<DashboardConfig>): DashboardConfig {
    return {
      refreshInterval: 30, // 30 seconds
      retentionPeriod: 7, // 7 days
      enableRealTime: true,
      enableAlerts: true,
      enableTrends: true,
      enableCapacityPlanning: true,
      customMetrics: [],
      alertThresholds: {
        responseTime: 1000, // 1 second
        errorRate: 0.05, // 5%
        memoryUsage: 0.8, // 80%
        diskUsage: 0.9, // 90%
      },
      ...config,
      alertThresholds: {
        responseTime: 1000,
        errorRate: 0.05,
        memoryUsage: 0.8,
        diskUsage: 0.9,
        ...config?.alertThresholds,
      },
    };
  }

  private initializeProvider(): void {
    this.createDashboardTables();
    this.loadMetricsHistory();
    this.startDataCollection();
  }

  private createDashboardTables(): void {
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS dashboard_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        metrics_data TEXT NOT NULL, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dashboard_alerts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        value REAL,
        threshold REAL,
        triggered_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolved BOOLEAN DEFAULT FALSE,
        metadata TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS capacity_planning (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        current_value REAL NOT NULL,
        projected_value REAL NOT NULL,
        projection_days INTEGER NOT NULL,
        confidence REAL NOT NULL, -- 0-1
        growth_rate REAL NOT NULL,
        calculation_date INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_timestamp ON dashboard_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_dashboard_alerts_triggered ON dashboard_alerts(triggered_at);
      CREATE INDEX IF NOT EXISTS idx_dashboard_alerts_resolved ON dashboard_alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_capacity_planning_metric ON capacity_planning(metric_name);
    `;

    this.db.exec(createTablesSQL);
  }

  private loadMetricsHistory(): void {
    try {
      const results = this.db
        .prepare(
          `
        SELECT timestamp, metrics_data 
        FROM dashboard_metrics 
        WHERE timestamp > ?
        ORDER BY timestamp DESC 
        LIMIT 100
      `
        )
        .all(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

      this.metricsHistory = results.map((row: any) => ({
        timestamp: row.timestamp,
        ...JSON.parse(row.metrics_data),
      }));
    } catch (error) {
      console.error('Failed to load metrics history:', error);
      this.metricsHistory = [];
    }
  }

  public startDataCollection(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Collect initial metrics
    this.collectMetrics();

    // Start periodic collection
    if (this.config.enableRealTime) {
      this.refreshTimer = setInterval(() => {
        this.collectMetrics();
      }, this.config.refreshInterval * 1000);
    }

    this.emit('data-collection-started');
  }

  public stopDataCollection(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.emit('data-collection-stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();

      // Collect performance metrics
      const performanceMetrics = this.performanceMonitor.getRealtimeMetrics();

      // Collect health metrics
      const healthStatus = this.healthCheck.getHealthStatus();

      // Collect query metrics
      const queryStats = this.queryAnalyzer.getAnalyzerStats();
      const slowQueries = this.queryAnalyzer.getSlowQueries(5);

      // Collect system metrics
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const metrics: DashboardMetrics = {
        timestamp,
        performance: {
          avgResponseTime: performanceMetrics.avgResponseTime,
          throughput: performanceMetrics.queriesPerSecond,
          errorRate: 0, // Would calculate from error metrics
          cacheHitRate: performanceMetrics.cacheHitRate,
          activeConnections: performanceMetrics.currentConnections,
          memoryUsage: performanceMetrics.memoryUsage,
        },
        health: {
          overall: healthStatus?.overall || 'unknown',
          score: healthStatus?.score || 0,
          activeAlerts: healthStatus?.checks.filter(c => c.status !== 'healthy').length || 0,
          lastCheck: healthStatus?.lastCheck || timestamp,
        },
        queries: {
          totalQueries: queryStats.totalQueries,
          slowQueries: queryStats.slowQueries,
          topSlowQueries: slowQueries.slice(0, 5).map(q => ({
            query: q.query.substring(0, 100) + (q.query.length > 100 ? '...' : ''),
            avgDuration: q.avgDuration,
            occurrences: q.occurrences,
          })),
        },
        system: {
          cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          memoryUsage: memUsage.heapUsed,
          diskUsage: 0, // Would get from disk usage monitoring
          uptime: process.uptime(),
        },
      };

      this.lastMetrics = metrics;

      // Add to history
      this.metricsHistory.push(metrics);

      // Keep only recent history in memory
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-500);
      }

      // Store in database (sample rate for storage efficiency)
      if (Math.random() < 0.1) {
        // Store 10% of metrics
        this.storeMetrics(metrics);
      }

      // Check for alerts
      if (this.config.enableAlerts) {
        this.checkForAlerts(metrics);
      }

      // Update capacity planning data
      if (this.config.enableCapacityPlanning) {
        this.updateCapacityPlanning(metrics);
      }

      this.emit('metrics-collected', metrics);
    } catch (error) {
      console.error('Failed to collect dashboard metrics:', error);
    }
  }

  private storeMetrics(metrics: DashboardMetrics): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO dashboard_metrics (timestamp, metrics_data)
        VALUES (?, ?)
      `
        )
        .run(
          metrics.timestamp,
          JSON.stringify({
            performance: metrics.performance,
            health: metrics.health,
            queries: metrics.queries,
            system: metrics.system,
          })
        );
    } catch (error) {
      console.error('Failed to store dashboard metrics:', error);
    }
  }

  private checkForAlerts(metrics: DashboardMetrics): void {
    const alerts: Array<{
      type: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      message: string;
      value: number;
      threshold: number;
    }> = [];

    // Check response time
    if (metrics.performance.avgResponseTime > this.config.alertThresholds.responseTime) {
      const severity =
        metrics.performance.avgResponseTime > this.config.alertThresholds.responseTime * 2
          ? 'critical'
          : 'warning';

      alerts.push({
        type: 'response_time',
        severity,
        title: 'High Response Time',
        message: `Average response time is ${metrics.performance.avgResponseTime}ms`,
        value: metrics.performance.avgResponseTime,
        threshold: this.config.alertThresholds.responseTime,
      });
    }

    // Check error rate
    if (metrics.performance.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        title: 'High Error Rate',
        message: `Error rate is ${(metrics.performance.errorRate * 100).toFixed(1)}%`,
        value: metrics.performance.errorRate,
        threshold: this.config.alertThresholds.errorRate,
      });
    }

    // Check memory usage
    const memoryUtilization = metrics.performance.memoryUsage / (1024 * 1024 * 1024); // GB
    if (memoryUtilization > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage',
        severity: memoryUtilization > 0.95 ? 'critical' : 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is ${(memoryUtilization * 100).toFixed(1)}%`,
        value: memoryUtilization,
        threshold: this.config.alertThresholds.memoryUsage,
      });
    }

    // Store and emit alerts
    alerts.forEach(alert => {
      this.createAlert(alert);
    });
  }

  private createAlert(alert: {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    value: number;
    threshold: number;
  }): void {
    try {
      const alertId = `${Date.now()}_${alert.type}_${Math.random().toString(36).substr(2, 9)}`;

      this.db
        .prepare(
          `
        INSERT INTO dashboard_alerts (
          id, alert_type, severity, title, message, value, threshold, triggered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          alertId,
          alert.type,
          alert.severity,
          alert.title,
          alert.message,
          alert.value,
          alert.threshold,
          Date.now()
        );

      this.emit('alert-triggered', {
        id: alertId,
        ...alert,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }

  private updateCapacityPlanning(metrics: DashboardMetrics): void {
    // Simple linear projection based on historical data
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Get historical data for trend analysis
    const historicalData = this.metricsHistory.filter(m => m.timestamp > oneDayAgo);

    if (historicalData.length < 2) return;

    // Calculate growth rates for key metrics
    const oldestData = historicalData[0];
    const newestData = historicalData[historicalData.length - 1];
    const timeDiff = (newestData.timestamp - oldestData.timestamp) / (1000 * 60 * 60); // hours

    if (timeDiff > 0) {
      // Memory growth rate
      const memoryGrowthRate =
        (newestData.performance.memoryUsage - oldestData.performance.memoryUsage) / timeDiff;

      // Query rate growth
      const queryGrowthRate =
        (newestData.performance.throughput - oldestData.performance.throughput) / timeDiff;

      // Store projections
      this.storeCapacityProjection(
        'memory_usage',
        newestData.performance.memoryUsage,
        memoryGrowthRate
      );
      this.storeCapacityProjection(
        'query_throughput',
        newestData.performance.throughput,
        queryGrowthRate
      );
    }
  }

  private storeCapacityProjection(
    metricName: string,
    currentValue: number,
    growthRate: number
  ): void {
    try {
      const projectionDays = 30;
      const projectedValue = currentValue + growthRate * 24 * projectionDays; // 24 hours per day
      const confidence = Math.max(0.1, Math.min(1.0, 1.0 - Math.abs(growthRate) / currentValue));

      this.db
        .prepare(
          `
        INSERT INTO capacity_planning (
          metric_name, current_value, projected_value, projection_days,
          confidence, growth_rate, calculation_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          metricName,
          currentValue,
          projectedValue,
          projectionDays,
          confidence,
          growthRate,
          Date.now()
        );
    } catch (error) {
      console.error('Failed to store capacity projection:', error);
    }
  }

  // Public API Methods

  public getCurrentMetrics(): DashboardMetrics | null {
    return this.lastMetrics || null;
  }

  public getMetricsHistory(hours = 24): DashboardMetrics[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  public getTimeSeriesData(
    metric: 'responseTime' | 'throughput' | 'errorRate' | 'cacheHitRate' | 'memoryUsage',
    hours = 24
  ): TimeSeriesData {
    const history = this.getMetricsHistory(hours);

    const data = history.map(m => {
      let value: number;
      switch (metric) {
        case 'responseTime':
          value = m.performance.avgResponseTime;
          break;
        case 'throughput':
          value = m.performance.throughput;
          break;
        case 'errorRate':
          value = m.performance.errorRate * 100; // Convert to percentage
          break;
        case 'cacheHitRate':
          value = m.performance.cacheHitRate * 100; // Convert to percentage
          break;
        case 'memoryUsage':
          value = m.performance.memoryUsage / (1024 * 1024); // Convert to MB
          break;
        default:
          value = 0;
      }

      return { x: m.timestamp, y: value };
    });

    return {
      labels: data.map(d => new Date(d.x).toISOString()),
      datasets: [
        {
          label: metric,
          data,
          borderColor: this.getMetricColor(metric),
          backgroundColor: this.getMetricColor(metric) + '20', // Add transparency
          fill: false,
        },
      ],
    };
  }

  private getMetricColor(metric: string): string {
    const colors = {
      responseTime: '#ff6b6b',
      throughput: '#4ecdc4',
      errorRate: '#ff8e53',
      cacheHitRate: '#45b7d1',
      memoryUsage: '#96ceb4',
    };
    return colors[metric as keyof typeof colors] || '#999999';
  }

  public getAlertSummary(hours = 24): AlertSummary {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    try {
      const alerts = this.db
        .prepare(
          `
        SELECT * FROM dashboard_alerts 
        WHERE triggered_at > ?
        ORDER BY triggered_at DESC
      `
        )
        .all(cutoff);

      const summary = alerts.reduce(
        (acc: any, alert: any) => {
          acc.total++;
          acc[alert.severity]++;
          return acc;
        },
        { total: 0, critical: 0, warning: 0, info: 0 }
      );

      const recent = alerts.slice(0, 10).map((alert: any) => ({
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.triggered_at,
        resolved: alert.resolved,
      }));

      return { ...summary, recent };
    } catch (error) {
      console.error('Failed to get alert summary:', error);
      return { total: 0, critical: 0, warning: 0, info: 0, recent: [] };
    }
  }

  public getCapacityPlanningData(): CapacityPlanningData {
    try {
      const projections = this.db
        .prepare(
          `
        SELECT 
          metric_name,
          current_value,
          projected_value,
          projection_days,
          confidence,
          growth_rate
        FROM capacity_planning 
        WHERE calculation_date > ?
        ORDER BY calculation_date DESC
      `
        )
        .all(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

      const recommendations: Array<{
        type: 'storage' | 'performance' | 'scaling';
        urgency: 'low' | 'medium' | 'high';
        description: string;
        timeline: string;
      }> = [];

      // Generate recommendations based on projections
      projections.forEach((proj: any) => {
        if (proj.growth_rate > 0) {
          const growthPercent = (proj.growth_rate / proj.current_value) * 100;

          if (growthPercent > 10) {
            // More than 10% growth projected
            recommendations.push({
              type: proj.metric_name.includes('memory') ? 'scaling' : 'performance',
              urgency: growthPercent > 50 ? 'high' : 'medium',
              description: `${proj.metric_name} is growing at ${growthPercent.toFixed(1)}% per day`,
              timeline: proj.projection_days > 30 ? 'Long term' : 'Short term',
            });
          }
        }
      });

      // Build capacity planning response
      const memoryProjection = projections.find(p => p.metric_name === 'memory_usage');
      const queryProjection = projections.find(p => p.metric_name === 'query_throughput');

      return {
        projections: {
          storage: {
            current: 0, // Would calculate actual database size
            projected30Days: 0,
            projected90Days: 0,
            growthRate: 0,
          },
          connections: {
            current: this.lastMetrics?.performance.activeConnections || 0,
            peak: 0, // Would track historical peak
            projected: 0,
            utilization: 0,
          },
          queries: {
            currentQPS: this.lastMetrics?.performance.throughput || 0,
            peakQPS: 0, // Would track historical peak
            projectedQPS: queryProjection?.projected_value || 0,
            growthTrend: (queryProjection?.growth_rate || 0) > 0 ? 'increasing' : 'stable',
          },
        },
        recommendations,
      };
    } catch (error) {
      console.error('Failed to get capacity planning data:', error);
      return {
        projections: {
          storage: { current: 0, projected30Days: 0, projected90Days: 0, growthRate: 0 },
          connections: { current: 0, peak: 0, projected: 0, utilization: 0 },
          queries: { currentQPS: 0, peakQPS: 0, projectedQPS: 0, growthTrend: 'stable' },
        },
        recommendations: [],
      };
    }
  }

  public getPrometheusMetrics(): string {
    const metrics = this.getCurrentMetrics();
    if (!metrics) return '';

    const prometheusData = [
      `# HELP sqlite_dashboard_response_time_ms Average response time in milliseconds`,
      `# TYPE sqlite_dashboard_response_time_ms gauge`,
      `sqlite_dashboard_response_time_ms ${metrics.performance.avgResponseTime}`,
      ``,
      `# HELP sqlite_dashboard_throughput_qps Queries per second`,
      `# TYPE sqlite_dashboard_throughput_qps gauge`,
      `sqlite_dashboard_throughput_qps ${metrics.performance.throughput}`,
      ``,
      `# HELP sqlite_dashboard_cache_hit_ratio Cache hit ratio`,
      `# TYPE sqlite_dashboard_cache_hit_ratio gauge`,
      `sqlite_dashboard_cache_hit_ratio ${metrics.performance.cacheHitRate}`,
      ``,
      `# HELP sqlite_dashboard_memory_usage_bytes Memory usage in bytes`,
      `# TYPE sqlite_dashboard_memory_usage_bytes gauge`,
      `sqlite_dashboard_memory_usage_bytes ${metrics.performance.memoryUsage}`,
      ``,
      `# HELP sqlite_dashboard_health_score Health score (0-100)`,
      `# TYPE sqlite_dashboard_health_score gauge`,
      `sqlite_dashboard_health_score ${metrics.health.score}`,
      ``,
      `# HELP sqlite_dashboard_active_alerts Number of active alerts`,
      `# TYPE sqlite_dashboard_active_alerts gauge`,
      `sqlite_dashboard_active_alerts ${metrics.health.activeAlerts}`,
      ``,
      `# HELP sqlite_dashboard_slow_queries Number of slow queries`,
      `# TYPE sqlite_dashboard_slow_queries gauge`,
      `sqlite_dashboard_slow_queries ${metrics.queries.slowQueries}`,
    ];

    return prometheusData.join('\n');
  }

  public getGrafanaDataSource(): any {
    return {
      name: 'SQLite Performance Monitor',
      type: 'json',
      url: '/api/dashboard/metrics',
      access: 'proxy',
      basicAuth: false,
      jsonData: {
        timeField: 'timestamp',
        httpMethod: 'GET',
      },
    };
  }

  public handleGrafanaQuery(query: any): any {
    try {
      const { range, targets } = query;
      const startTime = new Date(range.from).getTime();
      const endTime = new Date(range.to).getTime();

      const results = targets.map((target: any) => {
        const history = this.metricsHistory.filter(
          m => m.timestamp >= startTime && m.timestamp <= endTime
        );

        const datapoints = history.map(m => {
          let value: number;

          switch (target.target) {
            case 'response_time':
              value = m.performance.avgResponseTime;
              break;
            case 'throughput':
              value = m.performance.throughput;
              break;
            case 'cache_hit_rate':
              value = m.performance.cacheHitRate * 100;
              break;
            case 'memory_usage':
              value = m.performance.memoryUsage / (1024 * 1024); // MB
              break;
            case 'health_score':
              value = m.health.score;
              break;
            default:
              value = 0;
          }

          return [value, m.timestamp];
        });

        return {
          target: target.target,
          datapoints,
        };
      });

      return results;
    } catch (error) {
      console.error('Failed to handle Grafana query:', error);
      return [];
    }
  }

  public resolveAlert(alertId: string): boolean {
    try {
      const result = this.db
        .prepare(
          `
        UPDATE dashboard_alerts 
        SET resolved = TRUE, resolved_at = ?
        WHERE id = ?
      `
        )
        .run(Date.now(), alertId);

      if (result.changes > 0) {
        this.emit('alert-resolved', { alertId });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      return false;
    }
  }

  public getDashboardConfig(): DashboardConfig {
    return { ...this.config };
  }

  public updateDashboardConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart data collection if refresh interval changed
    if (newConfig.refreshInterval && this.isRunning) {
      this.stopDataCollection();
      this.startDataCollection();
    }

    this.emit('config-updated', this.config);
  }

  private cleanupOldData(): void {
    const retentionCutoff = Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000;

    try {
      // Cleanup old metrics
      this.db.prepare('DELETE FROM dashboard_metrics WHERE timestamp < ?').run(retentionCutoff);

      // Cleanup resolved alerts older than retention period
      this.db
        .prepare(
          `
        DELETE FROM dashboard_alerts 
        WHERE resolved = TRUE AND resolved_at < ?
      `
        )
        .run(retentionCutoff);

      // Cleanup old capacity planning data
      this.db
        .prepare('DELETE FROM capacity_planning WHERE calculation_date < ?')
        .run(retentionCutoff);
    } catch (error) {
      console.error('Failed to cleanup old dashboard data:', error);
    }
  }

  public destroy(): void {
    this.stopDataCollection();
    this.removeAllListeners();
    this.metricsHistory.length = 0;
  }
}
