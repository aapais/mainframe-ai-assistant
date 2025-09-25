/**
 * Enhanced Performance Monitor for SQLite Database Operations
 *
 * Provides real-time query performance tracking, resource monitoring,
 * and intelligent analysis for maintaining optimal database performance.
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface PerformanceMetric {
  id?: string;
  timestamp: number;
  operation: string;
  query?: string;
  duration: number;
  recordsAffected: number;
  memoryUsage: number;
  cpuTime: number;
  ioWaitTime: number;
  cacheHit: boolean;
  indexesUsed: string[];
  queryPlan?: string;
  connectionId: string;
  userId?: string;
  errorCode?: string;
  warningCount: number;
}

export interface PerformanceThresholds {
  slowQueryMs: number;
  criticalQueryMs: number;
  memoryLimitMB: number;
  cpuLimitPercent: number;
  ioWaitLimitMs: number;
  cacheHitRateMin: number;
  connectionTimeoutMs: number;
  maxConcurrentQueries: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // How long condition must persist
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  actions: string[];
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  duration: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

export interface MonitoringConfig {
  enabled: boolean;
  samplingRate: number; // 0.0 to 1.0
  metricsRetentionDays: number;
  alertRetentionDays: number;
  slowQueryCapture: boolean;
  queryPlanCapture: boolean;
  realtimeAlerts: boolean;
  aggregationInterval: number; // seconds
  batchSize: number;
  thresholds: PerformanceThresholds;
  alertRules: AlertRule[];
}

export class PerformanceMonitor extends EventEmitter {
  private db: Database.Database;
  private config: MonitoringConfig;
  private metricsBuffer: PerformanceMetric[] = [];
  private alertsBuffer: PerformanceAlert[] = [];
  private activeConnections = new Map<string, number>();
  private runningQueries = new Map<string, { query: string; startTime: number }>();
  private aggregationTimer?: ReturnType<typeof setTimeout>;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private isMonitoring = false;

  // Performance baseline for anomaly detection
  private baseline = {
    avgQueryTime: 0,
    avgMemoryUsage: 0,
    avgCpuUsage: 0,
    cacheHitRate: 0,
    queryCount: 0,
    lastUpdated: 0,
  };

  constructor(db: Database.Database, config?: Partial<MonitoringConfig>) {
    super();
    this.db = db;
    this.config = this.buildConfig(config);
    this.initializeMonitoring();
  }

  private buildConfig(config?: Partial<MonitoringConfig>): MonitoringConfig {
    const defaultThresholds: PerformanceThresholds = {
      slowQueryMs: 1000,
      criticalQueryMs: 5000,
      memoryLimitMB: 512,
      cpuLimitPercent: 80,
      ioWaitLimitMs: 2000,
      cacheHitRateMin: 0.8,
      connectionTimeoutMs: 30000,
      maxConcurrentQueries: 100,
    };

    const defaultRules: AlertRule[] = [
      {
        id: 'slow-query',
        name: 'Slow Query Detection',
        metric: 'query_duration',
        operator: 'gt',
        threshold: 1000,
        duration: 0,
        severity: 'warning',
        enabled: true,
        actions: ['log', 'metric'],
      },
      {
        id: 'critical-query',
        name: 'Critical Query Performance',
        metric: 'query_duration',
        operator: 'gt',
        threshold: 5000,
        duration: 0,
        severity: 'critical',
        enabled: true,
        actions: ['log', 'metric', 'alert'],
      },
      {
        id: 'high-memory',
        name: 'High Memory Usage',
        metric: 'memory_usage',
        operator: 'gt',
        threshold: 512 * 1024 * 1024, // 512MB
        duration: 60, // 1 minute
        severity: 'warning',
        enabled: true,
        actions: ['log', 'metric'],
      },
      {
        id: 'low-cache-hit-rate',
        name: 'Low Cache Hit Rate',
        metric: 'cache_hit_rate',
        operator: 'lt',
        threshold: 0.8,
        duration: 300, // 5 minutes
        severity: 'warning',
        enabled: true,
        actions: ['log', 'metric'],
      },
    ];

    return {
      enabled: true,
      samplingRate: 1.0,
      metricsRetentionDays: 7,
      alertRetentionDays: 30,
      slowQueryCapture: true,
      queryPlanCapture: true,
      realtimeAlerts: true,
      aggregationInterval: 60,
      batchSize: 100,
      thresholds: defaultThresholds,
      alertRules: defaultRules,
      ...config,
      thresholds: { ...defaultThresholds, ...config?.thresholds },
    };
  }

  private initializeMonitoring(): void {
    if (!this.config.enabled) return;

    this.createMonitoringTables();
    this.loadBaseline();
    this.startMonitoring();
  }

  private createMonitoringTables(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        timestamp INTEGER NOT NULL,
        operation TEXT NOT NULL,
        query TEXT,
        duration INTEGER NOT NULL,
        records_affected INTEGER DEFAULT 0,
        memory_usage INTEGER NOT NULL,
        cpu_time INTEGER DEFAULT 0,
        io_wait_time INTEGER DEFAULT 0,
        cache_hit BOOLEAN DEFAULT FALSE,
        indexes_used TEXT, -- JSON array
        query_plan TEXT,
        connection_id TEXT NOT NULL,
        user_id TEXT,
        error_code TEXT,
        warning_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS performance_alerts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        timestamp INTEGER NOT NULL,
        rule_id TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
        message TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        duration INTEGER DEFAULT 0,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at INTEGER,
        metadata TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS query_performance_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hour_bucket INTEGER NOT NULL, -- Unix timestamp rounded to hour
        operation TEXT NOT NULL,
        query_hash TEXT, -- Hash of normalized query
        total_count INTEGER DEFAULT 0,
        avg_duration REAL DEFAULT 0,
        min_duration INTEGER DEFAULT 0,
        max_duration INTEGER DEFAULT 0,
        p50_duration INTEGER DEFAULT 0,
        p95_duration INTEGER DEFAULT 0,
        p99_duration INTEGER DEFAULT 0,
        total_records INTEGER DEFAULT 0,
        cache_hits INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(hour_bucket, operation, query_hash)
      );

      CREATE TABLE IF NOT EXISTS connection_metrics (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        timestamp INTEGER NOT NULL,
        connection_id TEXT NOT NULL,
        connection_time INTEGER NOT NULL,
        active_queries INTEGER DEFAULT 0,
        memory_usage INTEGER NOT NULL,
        idle_time INTEGER DEFAULT 0,
        total_queries INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_perf_timestamp ON performance_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_perf_operation ON performance_metrics(operation);
      CREATE INDEX IF NOT EXISTS idx_perf_duration ON performance_metrics(duration DESC);
      CREATE INDEX IF NOT EXISTS idx_perf_connection ON performance_metrics(connection_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON performance_alerts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON performance_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON performance_alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_summary_hour ON query_performance_summary(hour_bucket);
      CREATE INDEX IF NOT EXISTS idx_connection_timestamp ON connection_metrics(timestamp);
    `;

    this.db.exec(createTableSQL);
  }

  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Start periodic aggregation
    this.aggregationTimer = setInterval(() => {
      this.processMetricsBuffer();
      this.checkAlertRules();
      this.updateBaseline();
    }, this.config.aggregationInterval * 1000);

    // Start cleanup job
    this.cleanupTimer = setInterval(
      () => {
        this.cleanupOldData();
      },
      24 * 60 * 60 * 1000
    ); // Daily cleanup

    this.emit('monitoring-started');
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Flush remaining buffers
    this.processMetricsBuffer();
    this.emit('monitoring-stopped');
  }

  public recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    if (!this.config.enabled || Math.random() > this.config.samplingRate) {
      return;
    }

    const fullMetric: PerformanceMetric = {
      ...metric,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // Add to buffer
    this.metricsBuffer.push(fullMetric);

    // Emit real-time metric
    this.emit('metric', fullMetric);

    // Process buffer if it's full
    if (this.metricsBuffer.length >= this.config.batchSize) {
      this.processMetricsBuffer();
    }

    // Check for immediate alerts
    if (this.config.realtimeAlerts) {
      this.checkMetricAlerts(fullMetric);
    }
  }

  public async measureQuery<T>(
    operation: string,
    query: string,
    connectionId: string,
    executor: () => Promise<T>,
    options?: {
      userId?: string;
      captureQueryPlan?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    const startCpu = process.cpuUsage();

    // Track running query
    this.runningQueries.set(connectionId, { query, startTime });

    let result: T;
    let error: Error | undefined;
    let recordsAffected = 0;
    let queryPlan: string | undefined;

    try {
      // Capture query plan if requested and enabled
      if (this.config.queryPlanCapture && options?.captureQueryPlan) {
        queryPlan = this.captureQueryPlan(query);
      }

      result = await executor();

      // Estimate records affected (this would need to be passed in for accurate counts)
      if (typeof result === 'object' && result && 'length' in result) {
        recordsAffected = (result as any).length;
      }
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      // Clean up tracking
      this.runningQueries.delete(connectionId);

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const endCpu = process.cpuUsage(startCpu);

      const duration = endTime - startTime;
      const memoryDelta = endMemory - startMemory;
      const cpuTime = (endCpu.user + endCpu.system) / 1000; // Convert to milliseconds

      // Record the metric
      this.recordMetric({
        operation,
        query:
          this.config.slowQueryCapture && duration > this.config.thresholds.slowQueryMs
            ? query
            : undefined,
        duration,
        recordsAffected,
        memoryUsage: endMemory,
        cpuTime,
        ioWaitTime: 0, // SQLite doesn't provide IO wait time directly
        cacheHit: duration < 10, // Heuristic: very fast queries likely hit cache
        indexesUsed: this.extractIndexesFromPlan(queryPlan),
        queryPlan: queryPlan,
        connectionId,
        userId: options?.userId,
        errorCode: error ? error.name : undefined,
        warningCount: 0,
      });
    }

    return result!;
  }

  public getRealtimeMetrics(): {
    currentConnections: number;
    activeQueries: number;
    avgResponseTime: number;
    memoryUsage: number;
    cacheHitRate: number;
    queriesPerSecond: number;
    alertsCount: { info: number; warning: number; critical: number };
  } {
    const now = Date.now();
    const lastMinute = now - 60000;

    const recentMetrics = this.metricsBuffer.filter(m => m.timestamp > lastMinute);

    const avgResponseTime =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
        : 0;

    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = recentMetrics.length > 0 ? cacheHits / recentMetrics.length : 0;

    const queriesPerSecond = recentMetrics.length / 60;

    const recentAlerts = this.alertsBuffer.filter(a => a.timestamp > lastMinute && !a.resolved);
    const alertsCount = {
      info: recentAlerts.filter(a => a.severity === 'info').length,
      warning: recentAlerts.filter(a => a.severity === 'warning').length,
      critical: recentAlerts.filter(a => a.severity === 'critical').length,
    };

    return {
      currentConnections: this.activeConnections.size,
      activeQueries: this.runningQueries.size,
      avgResponseTime: Math.round(avgResponseTime),
      memoryUsage: process.memoryUsage().heapUsed,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      queriesPerSecond: Math.round(queriesPerSecond * 100) / 100,
      alertsCount,
    };
  }

  public getSlowQueries(
    limit = 10,
    hoursBack = 24
  ): Array<{
    query: string;
    operation: string;
    avgDuration: number;
    count: number;
    lastSeen: number;
    queryPlan?: string;
  }> {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;

    try {
      const results = this.db
        .prepare(
          `
        SELECT 
          operation,
          query,
          AVG(duration) as avg_duration,
          COUNT(*) as count,
          MAX(timestamp) as last_seen,
          query_plan
        FROM performance_metrics 
        WHERE timestamp > ? 
          AND duration > ?
          AND query IS NOT NULL
        GROUP BY operation, query
        ORDER BY avg_duration DESC
        LIMIT ?
      `
        )
        .all(cutoff, this.config.thresholds.slowQueryMs, limit);

      return results.map((row: any) => ({
        query: row.query,
        operation: row.operation,
        avgDuration: Math.round(row.avg_duration),
        count: row.count,
        lastSeen: row.last_seen,
        queryPlan: row.query_plan,
      }));
    } catch (error) {
      console.error('Failed to get slow queries:', error);
      return [];
    }
  }

  public getPerformanceTrends(hoursBack = 24): {
    responseTime: Array<{ timestamp: number; value: number }>;
    throughput: Array<{ timestamp: number; value: number }>;
    memoryUsage: Array<{ timestamp: number; value: number }>;
    cacheHitRate: Array<{ timestamp: number; value: number }>;
    errorRate: Array<{ timestamp: number; value: number }>;
  } {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    const bucketSize = (hoursBack * 60 * 60 * 1000) / 50; // 50 data points

    try {
      const results = this.db
        .prepare(
          `
        SELECT 
          (timestamp / ?) * ? as bucket,
          AVG(duration) as avg_duration,
          COUNT(*) as count,
          AVG(memory_usage) as avg_memory,
          AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END) as cache_hit_rate,
          AVG(CASE WHEN error_code IS NOT NULL THEN 1.0 ELSE 0.0 END) as error_rate
        FROM performance_metrics 
        WHERE timestamp > ?
        GROUP BY bucket
        ORDER BY bucket
      `
        )
        .all(bucketSize, bucketSize, cutoff);

      const trends = {
        responseTime: [] as Array<{ timestamp: number; value: number }>,
        throughput: [] as Array<{ timestamp: number; value: number }>,
        memoryUsage: [] as Array<{ timestamp: number; value: number }>,
        cacheHitRate: [] as Array<{ timestamp: number; value: number }>,
        errorRate: [] as Array<{ timestamp: number; value: number }>,
      };

      results.forEach((row: any) => {
        const timestamp = Math.round(row.bucket);
        trends.responseTime.push({ timestamp, value: Math.round(row.avg_duration) });
        trends.throughput.push({ timestamp, value: row.count });
        trends.memoryUsage.push({ timestamp, value: Math.round(row.avg_memory) });
        trends.cacheHitRate.push({ timestamp, value: Math.round(row.cache_hit_rate * 100) / 100 });
        trends.errorRate.push({ timestamp, value: Math.round(row.error_rate * 100) / 100 });
      });

      return trends;
    } catch (error) {
      console.error('Failed to get performance trends:', error);
      return {
        responseTime: [],
        throughput: [],
        memoryUsage: [],
        cacheHitRate: [],
        errorRate: [],
      };
    }
  }

  private processMetricsBuffer(): void {
    if (this.metricsBuffer.length === 0) return;

    const metrics = this.metricsBuffer.splice(0);

    try {
      const insertStmt = this.db.prepare(`
        INSERT INTO performance_metrics (
          timestamp, operation, query, duration, records_affected,
          memory_usage, cpu_time, io_wait_time, cache_hit, indexes_used,
          query_plan, connection_id, user_id, error_code, warning_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction((metrics: PerformanceMetric[]) => {
        metrics.forEach(metric => {
          insertStmt.run(
            metric.timestamp,
            metric.operation,
            metric.query,
            metric.duration,
            metric.recordsAffected,
            metric.memoryUsage,
            metric.cpuTime,
            metric.ioWaitTime,
            metric.cacheHit,
            JSON.stringify(metric.indexesUsed),
            metric.queryPlan,
            metric.connectionId,
            metric.userId,
            metric.errorCode,
            metric.warningCount
          );
        });
      });

      transaction(metrics);

      // Update hourly summaries
      this.updateHourlySummaries(metrics);
    } catch (error) {
      console.error('Failed to process metrics buffer:', error);
      // Put metrics back in buffer for retry
      this.metricsBuffer.unshift(...metrics);
    }
  }

  private updateHourlySummaries(metrics: PerformanceMetric[]): void {
    const summaries = new Map<string, any>();

    metrics.forEach(metric => {
      const hourBucket = Math.floor(metric.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      const queryHash = this.hashQuery(metric.query || '');
      const key = `${hourBucket}-${metric.operation}-${queryHash}`;

      if (!summaries.has(key)) {
        summaries.set(key, {
          hour_bucket: hourBucket,
          operation: metric.operation,
          query_hash: queryHash,
          durations: [],
          total_records: 0,
          cache_hits: 0,
          error_count: 0,
        });
      }

      const summary = summaries.get(key);
      summary.durations.push(metric.duration);
      summary.total_records += metric.recordsAffected;
      if (metric.cacheHit) summary.cache_hits++;
      if (metric.errorCode) summary.error_count++;
    });

    const upsertStmt = this.db.prepare(`
      INSERT INTO query_performance_summary (
        hour_bucket, operation, query_hash, total_count, avg_duration,
        min_duration, max_duration, p50_duration, p95_duration, p99_duration,
        total_records, cache_hits, error_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hour_bucket, operation, query_hash) DO UPDATE SET
        total_count = total_count + excluded.total_count,
        avg_duration = (avg_duration * total_count + excluded.avg_duration * excluded.total_count) / (total_count + excluded.total_count),
        min_duration = MIN(min_duration, excluded.min_duration),
        max_duration = MAX(max_duration, excluded.max_duration),
        total_records = total_records + excluded.total_records,
        cache_hits = cache_hits + excluded.cache_hits,
        error_count = error_count + excluded.error_count
    `);

    summaries.forEach(summary => {
      const durations = summary.durations.sort((a: number, b: number) => a - b);
      const count = durations.length;

      const p50 = durations[Math.floor(count * 0.5)];
      const p95 = durations[Math.floor(count * 0.95)];
      const p99 = durations[Math.floor(count * 0.99)];
      const avg = durations.reduce((sum: number, d: number) => sum + d, 0) / count;

      upsertStmt.run(
        summary.hour_bucket,
        summary.operation,
        summary.query_hash,
        count,
        avg,
        Math.min(...durations),
        Math.max(...durations),
        p50,
        p95,
        p99,
        summary.total_records,
        summary.cache_hits,
        summary.error_count
      );
    });
  }

  private checkAlertRules(): void {
    this.config.alertRules
      .filter(rule => rule.enabled)
      .forEach(rule => this.evaluateAlertRule(rule));
  }

  private evaluateAlertRule(rule: AlertRule): void {
    const now = Date.now();
    const cutoff = now - rule.duration * 1000;

    let currentValue: number;

    switch (rule.metric) {
      case 'query_duration':
        const recentMetrics = this.metricsBuffer.filter(m => m.timestamp > cutoff);
        currentValue =
          recentMetrics.length > 0
            ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
            : 0;
        break;

      case 'memory_usage':
        currentValue = process.memoryUsage().heapUsed;
        break;

      case 'cache_hit_rate':
        const metrics = this.metricsBuffer.filter(m => m.timestamp > cutoff);
        const hits = metrics.filter(m => m.cacheHit).length;
        currentValue = metrics.length > 0 ? hits / metrics.length : 1;
        break;

      default:
        return;
    }

    const shouldAlert = this.checkThreshold(currentValue, rule.operator, rule.threshold);

    if (shouldAlert) {
      this.createAlert(rule, currentValue, now);
    }
  }

  private checkThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private createAlert(rule: AlertRule, value: number, timestamp: number): void {
    const alert: PerformanceAlert = {
      id: this.generateId(),
      timestamp,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} ${rule.operator} ${rule.threshold} (current: ${value})`,
      value,
      threshold: rule.threshold,
      duration: rule.duration,
      resolved: false,
      metadata: { rule: rule.name },
    };

    this.alertsBuffer.push(alert);

    // Persist alert immediately for critical alerts
    if (alert.severity === 'critical') {
      this.persistAlert(alert);
    }

    this.emit('alert', alert);
  }

  private persistAlert(alert: PerformanceAlert): void {
    try {
      this.db
        .prepare(
          `
        INSERT INTO performance_alerts (
          timestamp, rule_id, severity, message, value, threshold,
          duration, resolved, resolved_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          alert.timestamp,
          alert.ruleId,
          alert.severity,
          alert.message,
          alert.value,
          alert.threshold,
          alert.duration,
          alert.resolved,
          alert.resolvedAt,
          JSON.stringify(alert.metadata)
        );
    } catch (error) {
      console.error('Failed to persist alert:', error);
    }
  }

  private checkMetricAlerts(metric: PerformanceMetric): void {
    // Quick checks for immediate alerts
    if (metric.duration > this.config.thresholds.criticalQueryMs) {
      const alert: PerformanceAlert = {
        id: this.generateId(),
        timestamp: metric.timestamp,
        ruleId: 'critical-query-immediate',
        severity: 'critical',
        message: `Critical query performance: ${metric.operation} took ${metric.duration}ms`,
        value: metric.duration,
        threshold: this.config.thresholds.criticalQueryMs,
        duration: 0,
        resolved: false,
        metadata: { operation: metric.operation, connectionId: metric.connectionId },
      };

      this.alertsBuffer.push(alert);
      this.emit('alert', alert);
    }
  }

  private loadBaseline(): void {
    try {
      const result = this.db
        .prepare(
          `
        SELECT 
          AVG(duration) as avg_query_time,
          AVG(memory_usage) as avg_memory_usage,
          AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END) as cache_hit_rate,
          COUNT(*) as query_count
        FROM performance_metrics 
        WHERE timestamp > ?
      `
        )
        .get(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

      if (result) {
        this.baseline = {
          avgQueryTime: result.avg_query_time || 0,
          avgMemoryUsage: result.avg_memory_usage || 0,
          avgCpuUsage: 0, // Would need historical CPU data
          cacheHitRate: result.cache_hit_rate || 0,
          queryCount: result.query_count || 0,
          lastUpdated: Date.now(),
        };
      }
    } catch (error) {
      console.error('Failed to load baseline:', error);
    }
  }

  private updateBaseline(): void {
    if (Date.now() - this.baseline.lastUpdated < 24 * 60 * 60 * 1000) {
      return; // Update daily only
    }
    this.loadBaseline();
  }

  private cleanupOldData(): void {
    const metricsRetention = Date.now() - this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    const alertsRetention = Date.now() - this.config.alertRetentionDays * 24 * 60 * 60 * 1000;

    try {
      const deleteMetrics = this.db.prepare('DELETE FROM performance_metrics WHERE timestamp < ?');
      const deleteAlerts = this.db.prepare('DELETE FROM performance_alerts WHERE timestamp < ?');
      const deleteSummaries = this.db.prepare(
        'DELETE FROM query_performance_summary WHERE hour_bucket < ?'
      );

      deleteMetrics.run(metricsRetention);
      deleteAlerts.run(alertsRetention);
      deleteSummaries.run(metricsRetention);

      // Vacuum database periodically
      this.db.exec('VACUUM');
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  private captureQueryPlan(query: string): string | undefined {
    try {
      const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
      return JSON.stringify(plan);
    } catch {
      return undefined;
    }
  }

  private extractIndexesFromPlan(queryPlan?: string): string[] {
    if (!queryPlan) return [];

    try {
      const plan = JSON.parse(queryPlan);
      const indexes: string[] = [];

      plan.forEach((step: any) => {
        if (step.detail && step.detail.includes('USING INDEX')) {
          const match = step.detail.match(/USING INDEX (\w+)/);
          if (match) {
            indexes.push(match[1]);
          }
        }
      });

      return indexes;
    } catch {
      return [];
    }
  }

  private hashQuery(query: string): string {
    // Simple hash function for query normalization
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Public API for external monitoring integration
  public exportPrometheusMetrics(): string {
    const metrics = this.getRealtimeMetrics();
    return [
      `# HELP sqlite_query_duration_seconds Query execution time`,
      `# TYPE sqlite_query_duration_seconds gauge`,
      `sqlite_query_duration_seconds ${metrics.avgResponseTime / 1000}`,
      ``,
      `# HELP sqlite_cache_hit_ratio Cache hit ratio`,
      `# TYPE sqlite_cache_hit_ratio gauge`,
      `sqlite_cache_hit_ratio ${metrics.cacheHitRate}`,
      ``,
      `# HELP sqlite_memory_usage_bytes Memory usage`,
      `# TYPE sqlite_memory_usage_bytes gauge`,
      `sqlite_memory_usage_bytes ${metrics.memoryUsage}`,
      ``,
      `# HELP sqlite_queries_per_second Queries per second`,
      `# TYPE sqlite_queries_per_second gauge`,
      `sqlite_queries_per_second ${metrics.queriesPerSecond}`,
      ``,
      `# HELP sqlite_active_connections Active connections`,
      `# TYPE sqlite_active_connections gauge`,
      `sqlite_active_connections ${metrics.currentConnections}`,
      ``,
      `# HELP sqlite_active_queries Active queries`,
      `# TYPE sqlite_active_queries gauge`,
      `sqlite_active_queries ${metrics.activeQueries}`,
    ].join('\n');
  }

  public destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}
