/**
 * Metrics Collector for SQLite Performance Monitoring
 *
 * Handles time-series data collection, aggregation, and export
 * for comprehensive database performance analysis.
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface AggregationResult {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stddev: number;
}

export interface MetricDefinition {
  name: string;
  description: string;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels: string[];
  retention: number; // days
  aggregationInterval: number; // seconds
}

export interface AlertThreshold {
  metricName: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration: number; // seconds
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface CollectorConfig {
  enabled: boolean;
  collectionInterval: number; // seconds
  aggregationInterval: number; // seconds
  retentionDays: number;
  maxDataPoints: number;
  enableCompression: boolean;
  exportFormats: ('prometheus' | 'json' | 'csv')[];
  alertThresholds: AlertThreshold[];
}

export class MetricsCollector extends EventEmitter {
  private db: Database.Database;
  private config: CollectorConfig;
  private metrics: Map<string, MetricDefinition> = new Map();
  private dataBuffer: Map<string, TimeSeriesDataPoint[]> = new Map();
  private aggregationTimer?: ReturnType<typeof setTimeout>;
  private collectionTimer?: ReturnType<typeof setTimeout>;
  private isCollecting = false;

  // Built-in metric definitions
  private readonly BUILTIN_METRICS: MetricDefinition[] = [
    {
      name: 'sqlite_query_duration_ms',
      description: 'SQLite query execution time in milliseconds',
      unit: 'ms',
      type: 'histogram',
      labels: ['operation', 'table', 'index_used'],
      retention: 7,
      aggregationInterval: 60,
    },
    {
      name: 'sqlite_memory_usage_bytes',
      description: 'SQLite memory usage in bytes',
      unit: 'bytes',
      type: 'gauge',
      labels: ['process', 'connection'],
      retention: 7,
      aggregationInterval: 60,
    },
    {
      name: 'sqlite_cache_hit_ratio',
      description: 'Cache hit ratio as percentage',
      unit: 'percent',
      type: 'gauge',
      labels: ['cache_type'],
      retention: 7,
      aggregationInterval: 60,
    },
    {
      name: 'sqlite_queries_total',
      description: 'Total number of queries executed',
      unit: 'count',
      type: 'counter',
      labels: ['operation', 'status'],
      retention: 30,
      aggregationInterval: 60,
    },
    {
      name: 'sqlite_connections_active',
      description: 'Number of active database connections',
      unit: 'count',
      type: 'gauge',
      labels: ['pool'],
      retention: 7,
      aggregationInterval: 30,
    },
    {
      name: 'sqlite_io_operations_total',
      description: 'Total I/O operations',
      unit: 'count',
      type: 'counter',
      labels: ['operation_type'],
      retention: 7,
      aggregationInterval: 60,
    },
    {
      name: 'sqlite_lock_wait_time_ms',
      description: 'Time spent waiting for locks',
      unit: 'ms',
      type: 'histogram',
      labels: ['lock_type'],
      retention: 7,
      aggregationInterval: 60,
    },
    {
      name: 'sqlite_error_count',
      description: 'Number of errors encountered',
      unit: 'count',
      type: 'counter',
      labels: ['error_type', 'operation'],
      retention: 30,
      aggregationInterval: 60,
    },
  ];

  constructor(db: Database.Database, config?: Partial<CollectorConfig>) {
    super();
    this.db = db;
    this.config = this.buildConfig(config);
    this.initializeCollector();
  }

  private buildConfig(config?: Partial<CollectorConfig>): CollectorConfig {
    const defaultThresholds: AlertThreshold[] = [
      {
        metricName: 'sqlite_query_duration_ms',
        operator: 'gt',
        value: 1000,
        duration: 60,
        severity: 'warning',
        description: 'Slow query detected',
      },
      {
        metricName: 'sqlite_query_duration_ms',
        operator: 'gt',
        value: 5000,
        duration: 0,
        severity: 'critical',
        description: 'Critical query performance',
      },
      {
        metricName: 'sqlite_cache_hit_ratio',
        operator: 'lt',
        value: 80,
        duration: 300,
        severity: 'warning',
        description: 'Low cache hit ratio',
      },
      {
        metricName: 'sqlite_error_count',
        operator: 'gt',
        value: 10,
        duration: 60,
        severity: 'critical',
        description: 'High error rate detected',
      },
      {
        metricName: 'sqlite_memory_usage_bytes',
        operator: 'gt',
        value: 512 * 1024 * 1024, // 512MB
        duration: 300,
        severity: 'warning',
        description: 'High memory usage',
      },
    ];

    return {
      enabled: true,
      collectionInterval: 30,
      aggregationInterval: 60,
      retentionDays: 7,
      maxDataPoints: 10000,
      enableCompression: true,
      exportFormats: ['prometheus', 'json'],
      alertThresholds: defaultThresholds,
      ...config,
    };
  }

  private initializeCollector(): void {
    if (!this.config.enabled) return;

    this.createMetricsTables();
    this.registerBuiltinMetrics();
    this.startCollection();
  }

  private createMetricsTables(): void {
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS metric_definitions (
        name TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        unit TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('counter', 'gauge', 'histogram', 'summary')),
        labels TEXT NOT NULL, -- JSON array
        retention_days INTEGER NOT NULL,
        aggregation_interval INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS time_series_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        value REAL NOT NULL,
        labels TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (metric_name) REFERENCES metric_definitions(name)
      );

      CREATE TABLE IF NOT EXISTS aggregated_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        time_bucket INTEGER NOT NULL, -- Unix timestamp rounded to aggregation interval
        count INTEGER NOT NULL,
        sum REAL NOT NULL,
        min REAL NOT NULL,
        max REAL NOT NULL,
        avg REAL NOT NULL,
        p50 REAL,
        p95 REAL,
        p99 REAL,
        stddev REAL,
        labels TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(metric_name, time_bucket, labels),
        FOREIGN KEY (metric_name) REFERENCES metric_definitions(name)
      );

      CREATE TABLE IF NOT EXISTS alert_history (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        metric_name TEXT NOT NULL,
        threshold_value REAL NOT NULL,
        actual_value REAL NOT NULL,
        operator TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
        description TEXT NOT NULL,
        triggered_at INTEGER NOT NULL,
        resolved_at INTEGER,
        duration INTEGER, -- seconds the condition persisted
        metadata TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_timeseries_metric_time ON time_series_data(metric_name, timestamp);
      CREATE INDEX IF NOT EXISTS idx_timeseries_timestamp ON time_series_data(timestamp);
      CREATE INDEX IF NOT EXISTS idx_aggregated_metric_bucket ON aggregated_metrics(metric_name, time_bucket);
      CREATE INDEX IF NOT EXISTS idx_alert_history_metric ON alert_history(metric_name);
      CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON alert_history(triggered_at);
    `;

    this.db.exec(createTablesSQL);
  }

  private registerBuiltinMetrics(): void {
    const insertMetric = this.db.prepare(`
      INSERT OR REPLACE INTO metric_definitions 
      (name, description, unit, type, labels, retention_days, aggregation_interval)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.BUILTIN_METRICS.forEach(metric => {
      this.metrics.set(metric.name, metric);
      insertMetric.run(
        metric.name,
        metric.description,
        metric.unit,
        metric.type,
        JSON.stringify(metric.labels),
        metric.retention,
        metric.aggregationInterval
      );
    });
  }

  public startCollection(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;

    // Start data collection
    this.collectionTimer = setInterval(() => {
      this.collectSystemMetrics();
      this.processDataBuffer();
    }, this.config.collectionInterval * 1000);

    // Start aggregation
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
      this.checkAlertThresholds();
      this.cleanupOldData();
    }, this.config.aggregationInterval * 1000);

    this.emit('collection-started');
  }

  public stopCollection(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }

    // Flush remaining data
    this.processDataBuffer();
    this.emit('collection-stopped');
  }

  public recordMetric(
    metricName: string,
    value: number,
    labels?: Record<string, string>,
    timestamp?: number
  ): void {
    if (!this.config.enabled || !this.metrics.has(metricName)) {
      return;
    }

    const dataPoint: TimeSeriesDataPoint = {
      timestamp: timestamp || Date.now(),
      value,
      labels,
    };

    if (!this.dataBuffer.has(metricName)) {
      this.dataBuffer.set(metricName, []);
    }

    const buffer = this.dataBuffer.get(metricName)!;
    buffer.push(dataPoint);

    // Limit buffer size
    if (buffer.length > this.config.maxDataPoints) {
      buffer.splice(0, buffer.length - this.config.maxDataPoints);
    }

    this.emit('metric-recorded', metricName, dataPoint);
  }

  public registerMetric(metric: MetricDefinition): void {
    this.metrics.set(metric.name, metric);

    // Persist to database
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO metric_definitions 
      (name, description, unit, type, labels, retention_days, aggregation_interval)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        metric.name,
        metric.description,
        metric.unit,
        metric.type,
        JSON.stringify(metric.labels),
        metric.retention,
        metric.aggregationInterval
      );
  }

  public getMetricData(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Record<string, string>
  ): TimeSeriesDataPoint[] {
    let query = `
      SELECT timestamp, value, labels
      FROM time_series_data
      WHERE metric_name = ? AND timestamp BETWEEN ? AND ?
    `;
    const params: any[] = [metricName, startTime, endTime];

    if (labels) {
      query += ` AND labels = ?`;
      params.push(JSON.stringify(labels));
    }

    query += ` ORDER BY timestamp`;

    try {
      const results = this.db.prepare(query).all(...params);
      return results.map((row: any) => ({
        timestamp: row.timestamp,
        value: row.value,
        labels: row.labels ? JSON.parse(row.labels) : undefined,
      }));
    } catch (error) {
      console.error(`Failed to get metric data for ${metricName}:`, error);
      return [];
    }
  }

  public getAggregatedData(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Record<string, string>
  ): Array<AggregationResult & { timestamp: number }> {
    let query = `
      SELECT 
        time_bucket as timestamp, count, sum, min, max, avg,
        p50, p95, p99, stddev
      FROM aggregated_metrics
      WHERE metric_name = ? AND time_bucket BETWEEN ? AND ?
    `;
    const params: any[] = [metricName, startTime, endTime];

    if (labels) {
      query += ` AND labels = ?`;
      params.push(JSON.stringify(labels));
    }

    query += ` ORDER BY time_bucket`;

    try {
      const results = this.db.prepare(query).all(...params);
      return results.map((row: any) => ({
        timestamp: row.timestamp,
        count: row.count,
        sum: row.sum,
        min: row.min,
        max: row.max,
        avg: row.avg,
        p50: row.p50,
        p95: row.p95,
        p99: row.p99,
        stddev: row.stddev,
      }));
    } catch (error) {
      console.error(`Failed to get aggregated data for ${metricName}:`, error);
      return [];
    }
  }

  public calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = values.slice().sort((a, b) => a - b);
    const n = sorted.length;

    return {
      p50: sorted[Math.floor(n * 0.5)],
      p95: sorted[Math.floor(n * 0.95)],
      p99: sorted[Math.floor(n * 0.99)],
    };
  }

  public exportPrometheusFormat(): string {
    const output: string[] = [];
    const now = Date.now();
    const recentTime = now - 5 * 60 * 1000; // Last 5 minutes

    this.metrics.forEach((metric, name) => {
      // Get recent data points
      const dataPoints = this.getMetricData(name, recentTime, now);

      if (dataPoints.length === 0) return;

      // Add metric help and type
      output.push(`# HELP ${name} ${metric.description}`);
      output.push(`# TYPE ${name} ${metric.type}`);

      // Group by labels
      const labelGroups = new Map<string, TimeSeriesDataPoint[]>();

      dataPoints.forEach(point => {
        const labelsKey = JSON.stringify(point.labels || {});
        if (!labelGroups.has(labelsKey)) {
          labelGroups.set(labelsKey, []);
        }
        labelGroups.get(labelsKey)!.push(point);
      });

      labelGroups.forEach((points, labelsKey) => {
        const labels = JSON.parse(labelsKey);
        const labelStr = Object.entries(labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');

        const latestPoint = points[points.length - 1];
        const metricName = labelStr ? `${name}{${labelStr}}` : name;

        if (metric.type === 'histogram') {
          // For histograms, calculate and export percentiles
          const values = points.map(p => p.value);
          const percentiles = this.calculatePercentiles(values);

          output.push(`${metricName}_p50 ${percentiles.p50}`);
          output.push(`${metricName}_p95 ${percentiles.p95}`);
          output.push(`${metricName}_p99 ${percentiles.p99}`);
          output.push(`${metricName}_count ${values.length}`);
        } else {
          output.push(`${metricName} ${latestPoint.value}`);
        }
      });

      output.push(''); // Empty line between metrics
    });

    return output.join('\n');
  }

  public exportJSONFormat(): any {
    const result: any = {
      timestamp: Date.now(),
      metrics: {},
    };

    const now = Date.now();
    const recentTime = now - 5 * 60 * 1000; // Last 5 minutes

    this.metrics.forEach((metric, name) => {
      const dataPoints = this.getMetricData(name, recentTime, now);
      const aggregated = this.getAggregatedData(name, recentTime, now);

      result.metrics[name] = {
        definition: metric,
        current_value: dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : null,
        data_points: dataPoints.length,
        aggregated: aggregated.length > 0 ? aggregated[aggregated.length - 1] : null,
      };
    });

    return result;
  }

  public exportCSVFormat(metricName: string, startTime: number, endTime: number): string {
    const dataPoints = this.getMetricData(metricName, startTime, endTime);

    if (dataPoints.length === 0) {
      return 'timestamp,value,labels\n';
    }

    const headers = ['timestamp', 'value', 'labels'];
    const rows = dataPoints.map(point => [
      point.timestamp,
      point.value,
      JSON.stringify(point.labels || {}),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private collectSystemMetrics(): void {
    const now = Date.now();

    // Memory usage
    const memUsage = process.memoryUsage();
    this.recordMetric('sqlite_memory_usage_bytes', memUsage.heapUsed, { type: 'heap' }, now);
    this.recordMetric('sqlite_memory_usage_bytes', memUsage.rss, { type: 'rss' }, now);

    // CPU usage (basic)
    const cpuUsage = process.cpuUsage();
    const cpuTotal = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.recordMetric('sqlite_cpu_time_seconds', cpuTotal, { type: 'total' }, now);

    // Database-specific metrics would be collected here
    // These would typically come from SQLite pragmas or custom monitoring
    try {
      // Cache hit ratio (example using SQLite pragma)
      const cacheInfo = this.db.pragma('cache_size');
      this.recordMetric('sqlite_cache_size', cacheInfo, { type: 'page_cache' }, now);
    } catch (error) {
      console.error('Failed to collect database metrics:', error);
    }
  }

  private processDataBuffer(): void {
    if (this.dataBuffer.size === 0) return;

    const insertStmt = this.db.prepare(`
      INSERT INTO time_series_data (metric_name, timestamp, value, labels)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      this.dataBuffer.forEach((dataPoints, metricName) => {
        if (dataPoints.length === 0) return;

        dataPoints.forEach(point => {
          insertStmt.run(
            metricName,
            point.timestamp,
            point.value,
            point.labels ? JSON.stringify(point.labels) : null
          );
        });

        // Clear processed data
        dataPoints.length = 0;
      });
    });

    try {
      transaction();
    } catch (error) {
      console.error('Failed to process data buffer:', error);
    }
  }

  private aggregateMetrics(): void {
    const now = Date.now();
    const aggregationWindow = this.config.aggregationInterval * 1000;
    const currentBucket = Math.floor(now / aggregationWindow) * aggregationWindow;
    const startTime = currentBucket - aggregationWindow;

    this.metrics.forEach((metric, name) => {
      this.aggregateMetricForPeriod(name, startTime, currentBucket);
    });
  }

  private aggregateMetricForPeriod(metricName: string, startTime: number, endTime: number): void {
    try {
      // Get raw data for the period
      const rawData = this.db
        .prepare(
          `
        SELECT value, labels
        FROM time_series_data
        WHERE metric_name = ? AND timestamp >= ? AND timestamp < ?
        ORDER BY timestamp
      `
        )
        .all(metricName, startTime, endTime);

      if (rawData.length === 0) return;

      // Group by labels
      const labelGroups = new Map<string, number[]>();

      rawData.forEach((row: any) => {
        const labelsKey = row.labels || '{}';
        if (!labelGroups.has(labelsKey)) {
          labelGroups.set(labelsKey, []);
        }
        labelGroups.get(labelsKey)!.push(row.value);
      });

      // Calculate aggregations for each label group
      const upsertStmt = this.db.prepare(`
        INSERT INTO aggregated_metrics (
          metric_name, time_bucket, count, sum, min, max, avg, p50, p95, p99, stddev, labels
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(metric_name, time_bucket, labels) DO UPDATE SET
          count = excluded.count,
          sum = excluded.sum,
          min = excluded.min,
          max = excluded.max,
          avg = excluded.avg,
          p50 = excluded.p50,
          p95 = excluded.p95,
          p99 = excluded.p99,
          stddev = excluded.stddev
      `);

      labelGroups.forEach((values, labelsKey) => {
        const aggregation = this.calculateAggregation(values);
        const percentiles = this.calculatePercentiles(values);

        upsertStmt.run(
          metricName,
          startTime,
          aggregation.count,
          aggregation.sum,
          aggregation.min,
          aggregation.max,
          aggregation.avg,
          percentiles.p50,
          percentiles.p95,
          percentiles.p99,
          aggregation.stddev,
          labelsKey === '{}' ? null : labelsKey
        );
      });
    } catch (error) {
      console.error(`Failed to aggregate metric ${metricName}:`, error);
    }
  }

  private calculateAggregation(values: number[]): AggregationResult {
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        stddev: 0,
      };
    }

    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate standard deviation
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / count;
    const stddev = Math.sqrt(variance);

    const percentiles = this.calculatePercentiles(values);

    return {
      count,
      sum,
      min,
      max,
      avg,
      p50: percentiles.p50,
      p95: percentiles.p95,
      p99: percentiles.p99,
      stddev,
    };
  }

  private checkAlertThresholds(): void {
    this.config.alertThresholds.forEach(threshold => {
      this.evaluateThreshold(threshold);
    });
  }

  private evaluateThreshold(threshold: AlertThreshold): void {
    const now = Date.now();
    const checkPeriod = threshold.duration * 1000;
    const startTime = now - checkPeriod;

    // Get recent values for the metric
    const recentData = this.getMetricData(threshold.metricName, startTime, now);

    if (recentData.length === 0) return;

    // Calculate the value to check against threshold
    let checkValue: number;
    const values = recentData.map(d => d.value);

    switch (threshold.operator) {
      case 'gt':
      case 'gte':
        checkValue = Math.max(...values);
        break;
      case 'lt':
      case 'lte':
        checkValue = Math.min(...values);
        break;
      default:
        checkValue = values[values.length - 1]; // Latest value
    }

    const isTriggered = this.evaluateCondition(checkValue, threshold.operator, threshold.value);

    if (isTriggered) {
      this.recordAlert(threshold, checkValue, now);
    }
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
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

  private recordAlert(threshold: AlertThreshold, actualValue: number, timestamp: number): void {
    const alertId = `${timestamp}_${threshold.metricName}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.db
        .prepare(
          `
        INSERT INTO alert_history (
          id, metric_name, threshold_value, actual_value, operator,
          severity, description, triggered_at, duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          alertId,
          threshold.metricName,
          threshold.value,
          actualValue,
          threshold.operator,
          threshold.severity,
          threshold.description,
          timestamp,
          threshold.duration
        );

      this.emit('alert-triggered', {
        id: alertId,
        metricName: threshold.metricName,
        severity: threshold.severity,
        description: threshold.description,
        actualValue,
        thresholdValue: threshold.value,
        timestamp,
      });
    } catch (error) {
      console.error('Failed to record alert:', error);
    }
  }

  private cleanupOldData(): void {
    const now = Date.now();

    try {
      // Clean up time series data based on metric retention
      this.metrics.forEach((metric, name) => {
        const cutoff = now - metric.retention * 24 * 60 * 60 * 1000;
        this.db
          .prepare('DELETE FROM time_series_data WHERE metric_name = ? AND timestamp < ?')
          .run(name, cutoff);
      });

      // Clean up old aggregated data
      const aggregatedCutoff = now - this.config.retentionDays * 24 * 60 * 60 * 1000;
      this.db.prepare('DELETE FROM aggregated_metrics WHERE time_bucket < ?').run(aggregatedCutoff);

      // Clean up old alerts (keep for 30 days)
      const alertCutoff = now - 30 * 24 * 60 * 60 * 1000;
      this.db.prepare('DELETE FROM alert_history WHERE triggered_at < ?').run(alertCutoff);

      // Compress data if enabled
      if (this.config.enableCompression) {
        this.db.exec('VACUUM');
      }
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  public getCollectionStats(): {
    totalMetrics: number;
    activeMetrics: number;
    dataPointsToday: number;
    lastCollection: number;
    bufferSize: number;
    alertsToday: number;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    try {
      const dataPointsToday =
        this.db
          .prepare('SELECT COUNT(*) as count FROM time_series_data WHERE timestamp >= ?')
          .get(todayStart)?.count || 0;

      const alertsToday =
        this.db
          .prepare('SELECT COUNT(*) as count FROM alert_history WHERE triggered_at >= ?')
          .get(todayStart)?.count || 0;

      let bufferSize = 0;
      this.dataBuffer.forEach(buffer => {
        bufferSize += buffer.length;
      });

      return {
        totalMetrics: this.metrics.size,
        activeMetrics: this.dataBuffer.size,
        dataPointsToday,
        lastCollection: Date.now(),
        bufferSize,
        alertsToday,
      };
    } catch (error) {
      console.error('Failed to get collection stats:', error);
      return {
        totalMetrics: 0,
        activeMetrics: 0,
        dataPointsToday: 0,
        lastCollection: 0,
        bufferSize: 0,
        alertsToday: 0,
      };
    }
  }

  public destroy(): void {
    this.stopCollection();
    this.removeAllListeners();
    this.dataBuffer.clear();
    this.metrics.clear();
  }
}
