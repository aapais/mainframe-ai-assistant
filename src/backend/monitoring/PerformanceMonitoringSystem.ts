/**
 * Performance Monitoring System for Backend Architecture
 * Comprehensive monitoring with metrics collection, alerting, and reporting
 */

import { EventEmitter } from 'events';
import { IBaseService, ServiceContext, ServiceHealth } from '../core/interfaces/ServiceInterfaces';

// Node.js timer types
type NodeTimer = ReturnType<typeof setInterval>;

// ==============================
// Core Monitoring Interfaces
// ==============================

export interface IPerformanceMonitor extends IBaseService {
  // Operation tracking
  recordOperation(operation: string, success: boolean, duration: number, metadata?: any): void;
  recordError(operation: string, error: Error, metadata?: any): void;
  recordSlowQuery(operation: string, duration: number, metadata?: any): void;

  // Metrics recording
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  recordCounter(name: string, increment?: number, tags?: Record<string, string>): void;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;

  // Cache metrics
  recordCacheHit(operation: string, layer?: string): void;
  recordCacheMiss(operation: string): void;

  // Database metrics
  recordDatabaseQuery(query: string, duration: number, rowCount?: number): void;
  recordConnectionPoolStats(stats: ConnectionPoolStats): void;

  // System metrics
  recordMemoryUsage(usage: MemoryUsage): void;
  recordCPUUsage(usage: number): void;
  recordDiskUsage(usage: DiskUsage): void;

  // Reporting
  getMetrics(timeRange?: TimeRange): Promise<MetricsReport>;
  getOperationStats(operation: string): Promise<OperationStats>;
  getSystemHealth(): Promise<SystemHealthReport>;
  exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<string>;

  // Alerts
  checkAlerts(): Promise<Alert[]>;
  addAlertRule(rule: AlertRule): void;
  removeAlertRule(ruleId: string): void;
}

export interface IAlertManager {
  triggerAlert(type: string, severity: AlertSeverity, message: string, data?: any): Promise<void>;
  resolveAlert(alertId: string): Promise<void>;
  getActiveAlerts(): Promise<Alert[]>;
  getAlertHistory(timeRange?: TimeRange): Promise<Alert[]>;
}

// ==============================
// Performance Monitor Implementation
// ==============================

export class PerformanceMonitor extends EventEmitter implements IPerformanceMonitor {
  public readonly name = 'performance-monitor';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];

  private readonly metricsStore: MetricsStore;
  private readonly alertManager: IAlertManager;
  private readonly config: MonitoringConfig;
  private readonly collectors: Map<string, MetricCollector> = new Map();
  private readonly alertRules: Map<string, AlertRule> = new Map();
  private context!: ServiceContext;
  private metricsCollectionInterval?: NodeTimer;
  private healthCheckInterval?: NodeTimer;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.metricsStore = new MetricsStore(config.storage);
    this.alertManager = new AlertManager(config.alerts);
    this.initializeCollectors();
    this.setupDefaultAlertRules();
  }

  async initialize(context: ServiceContext): Promise<void> {
    this.context = context;

    await this.metricsStore.initialize();
    await this.alertManager.initialize();

    if (this.config.collection.enabled) {
      this.startMetricsCollection();
    }

    if (this.config.healthChecks.enabled) {
      this.startHealthChecks();
    }

    this.emit('monitor:initialized');
  }

  async shutdown(): Promise<void> {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.metricsStore.shutdown();
    this.emit('monitor:shutdown');
  }

  async healthCheck(): Promise<ServiceHealth> {
    const details: any = {};
    let healthy = true;

    try {
      // Check metrics store
      details.metricsStore = await this.metricsStore.healthCheck();
      if (!details.metricsStore.healthy) healthy = false;

      // Check alert manager
      details.alertManager = await this.alertManager.healthCheck();
      if (!details.alertManager.healthy) healthy = false;

      // Check collectors
      details.collectors = {};
      for (const [name, collector] of this.collectors) {
        details.collectors[name] = collector.isHealthy();
        if (!details.collectors[name]) healthy = false;
      }
    } catch (error) {
      healthy = false;
      details.error = (error as Error).message;
    }

    return {
      healthy,
      details,
      lastCheck: new Date(),
    };
  }

  // Operation Tracking

  recordOperation(operation: string, success: boolean, duration: number, metadata?: any): void {
    const metric: OperationMetric = {
      operation,
      success,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    // Store in metrics store
    this.metricsStore.addMetric('operations', metric);

    // Update real-time collectors
    const collector = this.getOrCreateCollector(operation);
    collector.recordOperation(success, duration);

    // Check for alerts
    this.checkOperationAlerts(operation, success, duration);

    this.emit('operation:recorded', metric);
  }

  recordError(operation: string, error: Error, metadata?: any): void {
    const errorMetric: ErrorMetric = {
      operation,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      timestamp: Date.now(),
      metadata,
    };

    this.metricsStore.addMetric('errors', errorMetric);

    // Update error rate in collector
    const collector = this.getOrCreateCollector(operation);
    collector.recordError();

    this.emit('error:recorded', errorMetric);
  }

  recordSlowQuery(operation: string, duration: number, metadata?: any): void {
    const slowQueryMetric: SlowQueryMetric = {
      operation,
      duration,
      threshold: this.config.slowQueryThreshold,
      timestamp: Date.now(),
      metadata,
    };

    this.metricsStore.addMetric('slow_queries', slowQueryMetric);

    // Trigger slow query alert
    this.triggerAlert(
      'slow-query',
      'warning',
      `Slow query detected: ${operation} took ${duration}ms`,
      slowQueryMetric
    );

    this.emit('slow-query:recorded', slowQueryMetric);
  }

  // Metrics Recording

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: GenericMetric = {
      name,
      value,
      tags: tags || {},
      timestamp: Date.now(),
    };

    this.metricsStore.addMetric('custom', metric);
    this.emit('metric:recorded', metric);
  }

  recordCounter(name: string, increment: number = 1, tags?: Record<string, string>): void {
    const existing = this.metricsStore.getLatestMetric(`counter_${name}`);
    const newValue = (existing?.value || 0) + increment;

    this.recordMetric(`counter_${name}`, newValue, tags);
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    // Store individual value
    this.recordMetric(`histogram_${name}`, value, tags);

    // Update histogram statistics
    const histogramCollector = this.getOrCreateHistogramCollector(name);
    histogramCollector.addValue(value);
  }

  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(`gauge_${name}`, value, tags);
  }

  // Cache Metrics

  recordCacheHit(operation: string, layer?: string): void {
    const tags = { operation, ...(layer && { layer }) };
    this.recordCounter('cache.hits', 1, tags);

    const collector = this.getOrCreateCollector(`cache.${operation}`);
    collector.recordCacheHit();
  }

  recordCacheMiss(operation: string): void {
    this.recordCounter('cache.misses', 1, { operation });

    const collector = this.getOrCreateCollector(`cache.${operation}`);
    collector.recordCacheMiss();
  }

  // Database Metrics

  recordDatabaseQuery(query: string, duration: number, rowCount?: number): void {
    const dbMetric: DatabaseMetric = {
      query: this.sanitizeQuery(query),
      duration,
      rowCount,
      timestamp: Date.now(),
    };

    this.metricsStore.addMetric('database', dbMetric);

    // Check for slow queries
    if (duration > this.config.slowQueryThreshold) {
      this.recordSlowQuery('database.query', duration, { query });
    }

    this.emit('database:query-recorded', dbMetric);
  }

  recordConnectionPoolStats(stats: ConnectionPoolStats): void {
    this.recordGauge('database.pool.active', stats.active);
    this.recordGauge('database.pool.idle', stats.idle);
    this.recordGauge('database.pool.total', stats.total);
    this.recordGauge('database.pool.waiting', stats.waiting);
  }

  // System Metrics

  recordMemoryUsage(usage: MemoryUsage): void {
    this.recordGauge('system.memory.used', usage.used);
    this.recordGauge('system.memory.total', usage.total);
    this.recordGauge('system.memory.percentage', (usage.used / usage.total) * 100);

    // Check memory alerts
    const percentage = (usage.used / usage.total) * 100;
    if (percentage > this.config.alerts.memoryThreshold) {
      this.triggerAlert(
        'high-memory',
        'warning',
        `High memory usage: ${percentage.toFixed(2)}%`,
        usage
      );
    }
  }

  recordCPUUsage(usage: number): void {
    this.recordGauge('system.cpu.percentage', usage);

    if (usage > this.config.alerts.cpuThreshold) {
      this.triggerAlert('high-cpu', 'warning', `High CPU usage: ${usage.toFixed(2)}%`, { usage });
    }
  }

  recordDiskUsage(usage: DiskUsage): void {
    this.recordGauge('system.disk.used', usage.used);
    this.recordGauge('system.disk.total', usage.total);
    this.recordGauge('system.disk.percentage', (usage.used / usage.total) * 100);

    const percentage = (usage.used / usage.total) * 100;
    if (percentage > this.config.alerts.diskThreshold) {
      this.triggerAlert(
        'high-disk',
        'warning',
        `High disk usage: ${percentage.toFixed(2)}%`,
        usage
      );
    }
  }

  // Reporting

  async getMetrics(timeRange?: TimeRange): Promise<MetricsReport> {
    const range = timeRange || {
      start: new Date(Date.now() - 3600000), // Last hour
      end: new Date(),
    };

    const operationMetrics = await this.metricsStore.getMetrics('operations', range);
    const errorMetrics = await this.metricsStore.getMetrics('errors', range);
    const slowQueryMetrics = await this.metricsStore.getMetrics('slow_queries', range);
    const customMetrics = await this.metricsStore.getMetrics('custom', range);

    return {
      timeRange: range,
      operations: this.aggregateOperationMetrics(operationMetrics),
      errors: this.aggregateErrorMetrics(errorMetrics),
      slowQueries: slowQueryMetrics.length,
      custom: this.aggregateCustomMetrics(customMetrics),
      summary: {
        totalOperations: operationMetrics.length,
        totalErrors: errorMetrics.length,
        errorRate:
          operationMetrics.length > 0 ? (errorMetrics.length / operationMetrics.length) * 100 : 0,
        averageResponseTime: this.calculateAverageResponseTime(operationMetrics),
      },
      generatedAt: new Date(),
    };
  }

  async getOperationStats(operation: string): Promise<OperationStats> {
    const collector = this.collectors.get(operation);

    if (!collector) {
      return {
        count: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        errorRate: 0,
        successRate: 0,
        throughput: 0,
      };
    }

    return collector.getStats();
  }

  async getSystemHealth(): Promise<SystemHealthReport> {
    const systemMetrics = await this.collectSystemMetrics();
    const alerts = await this.alertManager.getActiveAlerts();

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Determine overall health based on metrics and alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');

    if (criticalAlerts.length > 0) {
      overallHealth = 'unhealthy';
    } else if (warningAlerts.length > 0) {
      overallHealth = 'degraded';
    }

    return {
      overall: overallHealth,
      services: await this.getServicesHealth(),
      resources: systemMetrics,
      alerts,
      timestamp: new Date(),
    };
  }

  async exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<string> {
    const metrics = await this.getMetrics();

    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);

      case 'csv':
        return this.exportToCSV(metrics);

      case 'prometheus':
        return this.exportToPrometheus(metrics);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Alert Management

  async checkAlerts(): Promise<Alert[]> {
    const activeAlerts: Alert[] = [];

    for (const [ruleId, rule] of this.alertRules) {
      const alertTriggered = await this.evaluateAlertRule(rule);

      if (alertTriggered) {
        const alert = await this.alertManager.triggerAlert(rule.type, rule.severity, rule.message, {
          ruleId,
          ...alertTriggered.data,
        });
        activeAlerts.push(alert);
      }
    }

    return activeAlerts;
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
  }

  getMetrics(): any {
    const collectorStats = Object.fromEntries(
      Array.from(this.collectors.entries()).map(([name, collector]) => [name, collector.getStats()])
    );

    return {
      collectors: collectorStats,
      alertRules: this.alertRules.size,
      activeAlerts: this.alertManager.getActiveAlerts(),
      uptime: process.uptime(),
    };
  }

  resetMetrics(): void {
    this.collectors.clear();
    this.metricsStore.clear();
  }

  // Private Methods

  private initializeCollectors(): void {
    // Initialize default metric collectors
    const defaultOperations = [
      'kb.search',
      'kb.create',
      'kb.update',
      'kb.delete',
      'cache.get',
      'cache.set',
      'database.query',
    ];

    defaultOperations.forEach(operation => {
      this.collectors.set(operation, new MetricCollector(operation));
    });
  }

  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        type: 'error-rate',
        severity: 'critical',
        condition: {
          metric: 'error_rate',
          operator: '>',
          threshold: 5, // 5%
          timeWindow: 300000, // 5 minutes
        },
        message: 'Error rate is above 5% in the last 5 minutes',
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        type: 'response-time',
        severity: 'warning',
        condition: {
          metric: 'average_response_time',
          operator: '>',
          threshold: 2000, // 2 seconds
          timeWindow: 300000,
        },
        message: 'Average response time is above 2 seconds',
      },
      {
        id: 'low-cache-hit-rate',
        name: 'Low Cache Hit Rate',
        type: 'cache-performance',
        severity: 'warning',
        condition: {
          metric: 'cache_hit_rate',
          operator: '<',
          threshold: 70, // 70%
          timeWindow: 600000, // 10 minutes
        },
        message: 'Cache hit rate is below 70%',
      },
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
  }

  private getOrCreateCollector(operation: string): MetricCollector {
    if (!this.collectors.has(operation)) {
      this.collectors.set(operation, new MetricCollector(operation));
    }
    return this.collectors.get(operation)!;
  }

  private getOrCreateHistogramCollector(name: string): HistogramCollector {
    const key = `histogram_${name}`;
    if (!this.collectors.has(key)) {
      this.collectors.set(key, new HistogramCollector(name) as any);
    }
    return this.collectors.get(key) as any;
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.collection.interval);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthChecks.interval);
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const process = require('process');
    const memoryUsage = process.memoryUsage();

    const systemMetrics: SystemMetrics = {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      cpu: {
        percentage: await this.getCPUUsage(),
      },
      disk: {
        used: 0, // Would implement disk usage check
        total: 0,
        percentage: 0,
      },
    };

    this.recordMemoryUsage(systemMetrics.memory);
    this.recordCPUUsage(systemMetrics.cpu.percentage);

    return systemMetrics;
  }

  private async getCPUUsage(): Promise<number> {
    // Simplified CPU usage calculation
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu: any) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;

    return 100 - (idle / total) * 100;
  }

  private async performHealthChecks(): Promise<void> {
    // Perform health checks and trigger alerts if needed
    try {
      const health = await this.getSystemHealth();

      if (health.overall === 'unhealthy') {
        this.triggerAlert('system-unhealthy', 'critical', 'System health is unhealthy', health);
      } else if (health.overall === 'degraded') {
        this.triggerAlert('system-degraded', 'warning', 'System health is degraded', health);
      }
    } catch (error) {
      this.context.logger?.error('Health check failed', error as Error);
    }
  }

  private checkOperationAlerts(operation: string, success: boolean, duration: number): void {
    // Check for high error rate
    if (!success) {
      const collector = this.getOrCreateCollector(operation);
      const stats = collector.getStats();

      if (stats.errorRate > this.config.alerts.errorRateThreshold) {
        this.triggerAlert(
          'high-error-rate',
          'critical',
          `High error rate for ${operation}: ${stats.errorRate.toFixed(2)}%`,
          { operation, errorRate: stats.errorRate }
        );
      }
    }

    // Check for slow operations
    if (duration > this.config.slowQueryThreshold) {
      this.recordSlowQuery(operation, duration);
    }
  }

  private async triggerAlert(
    type: string,
    severity: AlertSeverity,
    message: string,
    data?: any
  ): Promise<void> {
    try {
      await this.alertManager.triggerAlert(type, severity, message, data);
    } catch (error) {
      this.context.logger?.error('Failed to trigger alert', error as Error);
    }
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries
    return query.replace(/('[^']*'|"[^"]*"|\b\d{4,}\b)/g, '?');
  }

  private async getServicesHealth(): Promise<Record<string, ServiceHealth>> {
    // Would collect health from all registered services
    return {};
  }

  // Stub implementations for interface methods
  private aggregateOperationMetrics(metrics: any[]): any {
    // Aggregate operation metrics
    return {};
  }

  private aggregateErrorMetrics(metrics: any[]): any {
    // Aggregate error metrics
    return {};
  }

  private aggregateCustomMetrics(metrics: any[]): any {
    // Aggregate custom metrics
    return {};
  }

  private calculateAverageResponseTime(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum: number, m: any) => sum + (m.duration || 0), 0);
    return total / metrics.length;
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<any> {
    // Evaluate alert rule conditions
    return null;
  }

  private exportToCSV(metrics: MetricsReport): string {
    // Export metrics to CSV format
    return '';
  }

  private exportToPrometheus(metrics: MetricsReport): string {
    // Export metrics to Prometheus format
    return '';
  }
}

// ==============================
// Supporting Classes
// ==============================

class MetricsStore {
  private metrics: Map<string, any[]> = new Map();

  constructor(private config: StorageConfig) {}

  async initialize(): Promise<void> {
    // Initialize storage
  }

  async shutdown(): Promise<void> {
    // Shutdown storage
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    return { healthy: true };
  }

  addMetric(type: string, metric: any): void {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    this.metrics.get(type)!.push(metric);
  }

  async getMetrics(type: string, timeRange: TimeRange): Promise<any[]> {
    const metrics = this.metrics.get(type) || [];
    return metrics.filter(
      m => m.timestamp >= timeRange.start.getTime() && m.timestamp <= timeRange.end.getTime()
    );
  }

  getLatestMetric(name: string): any {
    const metrics = this.metrics.get('custom') || [];
    return metrics.filter(m => m.name === name).pop();
  }

  clear(): void {
    this.metrics.clear();
  }
}

class AlertManager implements IAlertManager {
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];

  constructor(private config: AlertConfig) {}

  async initialize(): Promise<void> {
    // Initialize alert manager
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    return { healthy: true };
  }

  async triggerAlert(
    type: string,
    severity: AlertSeverity,
    message: string,
    data?: any
  ): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      data,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Send notification if configured
    if (this.config.notifications.enabled) {
      await this.sendNotification(alert);
    }

    return alert;
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.alerts.delete(alertId);
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values());
  }

  async getAlertHistory(timeRange?: TimeRange): Promise<Alert[]> {
    if (!timeRange) return this.alertHistory;

    return this.alertHistory.filter(
      alert => alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end
    );
  }

  private async sendNotification(alert: Alert): Promise<void> {
    // Send notification via configured channels
    console.log(`ALERT [${alert.severity}]: ${alert.message}`);
  }
}

class MetricCollector {
  private operationCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private totalDuration = 0;
  private minDuration = Infinity;
  private maxDuration = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private lastResetTime = Date.now();

  constructor(private readonly name: string) {}

  recordOperation(success: boolean, duration: number): void {
    this.operationCount++;
    this.totalDuration += duration;
    this.minDuration = Math.min(this.minDuration, duration);
    this.maxDuration = Math.max(this.maxDuration, duration);

    if (success) {
      this.successCount++;
    } else {
      this.errorCount++;
    }
  }

  recordError(): void {
    this.errorCount++;
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  getStats(): OperationStats {
    const windowSeconds = (Date.now() - this.lastResetTime) / 1000;

    return {
      count: this.operationCount,
      averageDuration: this.operationCount > 0 ? this.totalDuration / this.operationCount : 0,
      minDuration: this.minDuration === Infinity ? 0 : this.minDuration,
      maxDuration: this.maxDuration,
      errorRate: this.operationCount > 0 ? (this.errorCount / this.operationCount) * 100 : 0,
      successRate: this.operationCount > 0 ? (this.successCount / this.operationCount) * 100 : 0,
      throughput: windowSeconds > 0 ? this.operationCount / windowSeconds : 0,
      cacheHitRate:
        this.cacheHits + this.cacheMisses > 0
          ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100
          : 0,
    };
  }

  isHealthy(): boolean {
    const stats = this.getStats();
    return stats.errorRate < 10 && stats.averageDuration < 5000; // 10% error rate, 5s average
  }

  reset(): void {
    this.operationCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.totalDuration = 0;
    this.minDuration = Infinity;
    this.maxDuration = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lastResetTime = Date.now();
  }
}

class HistogramCollector {
  private values: number[] = [];
  private buckets: Map<number, number> = new Map();

  constructor(private readonly name: string) {
    // Initialize standard buckets
    [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000].forEach(bucket => {
      this.buckets.set(bucket, 0);
    });
  }

  addValue(value: number): void {
    this.values.push(value);

    // Update buckets
    for (const [bucket, count] of this.buckets) {
      if (value <= bucket) {
        this.buckets.set(bucket, count + 1);
      }
    }

    // Keep only recent values (last 1000)
    if (this.values.length > 1000) {
      this.values = this.values.slice(-1000);
    }
  }

  getStats(): any {
    if (this.values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.values].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((sum, val) => sum + val, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      buckets: Object.fromEntries(this.buckets),
    };
  }
}

// ==============================
// Type Definitions
// ==============================

interface MonitoringConfig {
  collection: {
    enabled: boolean;
    interval: number; // milliseconds
  };
  storage: StorageConfig;
  alerts: AlertConfig;
  healthChecks: {
    enabled: boolean;
    interval: number;
  };
  slowQueryThreshold: number;
}

interface StorageConfig {
  type: 'memory' | 'sqlite' | 'file';
  path?: string;
  retention: number; // milliseconds
}

interface AlertConfig {
  enabled: boolean;
  errorRateThreshold: number; // percentage
  memoryThreshold: number; // percentage
  cpuThreshold: number; // percentage
  diskThreshold: number; // percentage
  notifications: {
    enabled: boolean;
    channels: string[];
  };
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface OperationMetric {
  operation: string;
  success: boolean;
  duration: number;
  timestamp: number;
  metadata?: any;
}

interface ErrorMetric {
  operation: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  timestamp: number;
  metadata?: any;
}

interface SlowQueryMetric {
  operation: string;
  duration: number;
  threshold: number;
  timestamp: number;
  metadata?: any;
}

interface DatabaseMetric {
  query: string;
  duration: number;
  rowCount?: number;
  timestamp: number;
}

interface GenericMetric {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

interface ConnectionPoolStats {
  active: number;
  idle: number;
  total: number;
  waiting: number;
}

interface MemoryUsage {
  used: number;
  total: number;
}

interface DiskUsage {
  used: number;
  total: number;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface MetricsReport {
  timeRange: TimeRange;
  operations: any;
  errors: any;
  slowQueries: number;
  custom: any;
  summary: {
    totalOperations: number;
    totalErrors: number;
    errorRate: number;
    averageResponseTime: number;
  };
  generatedAt: Date;
}

interface OperationStats {
  count: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  errorRate: number;
  successRate: number;
  throughput: number; // operations per second
  cacheHitRate?: number;
}

interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  resources: SystemMetrics;
  alerts: Alert[];
  timestamp: Date;
}

interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  data?: any;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

interface AlertRule {
  id: string;
  name: string;
  type: string;
  severity: AlertSeverity;
  condition: {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    threshold: number;
    timeWindow: number; // milliseconds
  };
  message: string;
}

type AlertSeverity = 'info' | 'warning' | 'critical';

export { PerformanceMonitor as default };
