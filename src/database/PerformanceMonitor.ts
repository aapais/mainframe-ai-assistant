/**
 * Advanced Performance Monitoring for Database Operations
 * 
 * Real-time monitoring, alerting, and optimization suggestions
 * to maintain sub-1s search performance.
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  timestamp: number;
  operation: string;
  duration: number;
  recordsProcessed: number;
  cacheHit: boolean;
  indexesUsed: string[];
  queryPlan?: string;
  memoryUsage: number;
  cpuUsage?: number;
}

export interface PerformanceAlert {
  level: 'warning' | 'critical';
  message: string;
  metric: string;
  threshold: number;
  actual: number;
  timestamp: number;
  suggestions: string[];
}

export interface PerformanceReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    totalOperations: number;
    averageResponseTime: number;
    slowOperations: number;
    cacheHitRate: number;
    errorRate: number;
  };
  breakdown: {
    byOperation: Map<string, OperationStats>;
    byHour: Map<number, HourlyStats>;
    slowestQueries: PerformanceMetrics[];
  };
  recommendations: string[];
  alerts: PerformanceAlert[];
}

interface OperationStats {
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  cacheHits: number;
}

interface HourlyStats {
  hour: number;
  operations: number;
  averageTime: number;
  errorCount: number;
}

export interface MonitorConfig {
  slowQueryThreshold: number;
  criticalThreshold: number;
  memoryAlertThreshold: number;
  sampleRate: number;
  retentionDays: number;
  enableRealTimeAlerts: boolean;
  enableQueryPlanCapture: boolean;
}

export class PerformanceMonitor extends EventEmitter {
  private db: Database.Database;
  private config: MonitorConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private startTime: number = Date.now();

  // Performance thresholds
  private readonly THRESHOLDS = {
    SLOW_QUERY_MS: 1000,
    CRITICAL_QUERY_MS: 5000,
    HIGH_MEMORY_MB: 500,
    LOW_CACHE_HIT_RATE: 0.8,
    HIGH_ERROR_RATE: 0.05
  };

  constructor(db: Database.Database, config?: Partial<MonitorConfig>) {
    super();
    
    this.db = db;
    this.config = {
      slowQueryThreshold: 1000,
      criticalThreshold: 5000,
      memoryAlertThreshold: 500 * 1024 * 1024, // 500MB
      sampleRate: 1.0, // 100% sampling
      retentionDays: 7,
      enableRealTimeAlerts: true,
      enableQueryPlanCapture: true,
      ...config
    };

    this.initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    console.log('📊 Initializing performance monitoring...');
    
    // Create monitoring tables if they don't exist
    this.createMonitoringTables();
    
    // Start background monitoring
    this.startMonitoring();
    
    console.log('✅ Performance monitoring initialized');
  }

  /**
   * Create tables for storing performance metrics
   */
  private createMonitoringTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          operation TEXT NOT NULL,
          duration INTEGER NOT NULL,
          records_processed INTEGER DEFAULT 0,
          cache_hit BOOLEAN DEFAULT FALSE,
          indexes_used TEXT, -- JSON array
          query_plan TEXT,
          memory_usage INTEGER,
          cpu_usage REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_perf_timestamp ON performance_metrics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_perf_operation ON performance_metrics(operation);
        CREATE INDEX IF NOT EXISTS idx_perf_duration ON performance_metrics(duration DESC);
        
        CREATE TABLE IF NOT EXISTS performance_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL CHECK(level IN ('warning', 'critical')),
          message TEXT NOT NULL,
          metric TEXT NOT NULL,
          threshold REAL NOT NULL,
          actual REAL NOT NULL,
          timestamp INTEGER NOT NULL,
          suggestions TEXT, -- JSON array
          resolved BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON performance_alerts(timestamp);
        CREATE INDEX IF NOT EXISTS idx_alerts_level ON performance_alerts(level);
        CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON performance_alerts(resolved);
      `);
    } catch (error) {
      console.error('Failed to create monitoring tables:', error);
    }
  }

  /**
   * Start background monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Monitor system resources every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkPerformanceThresholds();
      this.cleanupOldMetrics();
    }, 30000);

    console.log('🔄 Background performance monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    operation: string,
    duration: number,
    options?: {
      recordsProcessed?: number;
      cacheHit?: boolean;
      indexesUsed?: string[];
      queryPlan?: string;
    }
  ): void {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      operation,
      duration,
      recordsProcessed: options?.recordsProcessed || 0,
      cacheHit: options?.cacheHit || false,
      indexesUsed: options?.indexesUsed || [],
      queryPlan: options?.queryPlan,
      memoryUsage: this.getCurrentMemoryUsage(),
      cpuUsage: this.getCurrentCPUUsage()
    };

    // Store in memory (with limit)
    this.metrics.push(metric);
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000); // Keep last 5000
    }

    // Store in database (with sampling)
    if (Math.random() < this.config.sampleRate) {
      this.persistMetric(metric);
    }

    // Check for alerts
    this.checkMetricForAlerts(metric);

    // Emit event for real-time monitoring
    this.emit('metric', metric);
  }

  /**
   * Measure and record operation performance
   */
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T> | T,
    options?: {
      recordsProcessed?: number;
      expectedCacheHit?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = this.getCurrentMemoryUsage();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      // Determine if result came from cache (heuristic)
      const cacheHit = options?.expectedCacheHit || duration < 10;
      
      this.recordMetric(operation, duration, {
        recordsProcessed: options?.recordsProcessed,
        cacheHit
      });

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metric
      this.recordMetric(`${operation}_error`, duration);
      
      throw error;
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(
    startTime?: number,
    endTime?: number
  ): PerformanceReport {
    const start = startTime || (Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endTime || Date.now();
    
    // Get metrics from database for the period
    const periodMetrics = this.getMetricsForPeriod(start, end);
    
    // Calculate summary statistics
    const summary = this.calculateSummaryStats(periodMetrics);
    
    // Break down by operation and time
    const breakdown = this.calculateBreakdownStats(periodMetrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, breakdown);
    
    // Get alerts for the period
    const periodAlerts = this.getAlertsForPeriod(start, end);

    return {
      period: {
        start,
        end,
        duration: end - start
      },
      summary,
      breakdown,
      recommendations,
      alerts: periodAlerts
    };
  }

  /**
   * Get real-time performance status
   */
  getRealTimeStatus(): {
    isHealthy: boolean;
    currentLoad: number;
    averageResponseTime: number;
    activeAlerts: number;
    cacheHitRate: number;
    memoryUsage: number;
  } {
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );

    const avgResponseTime = recentMetrics.length > 0 ?
      recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length : 0;
    
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = recentMetrics.length > 0 ? cacheHits / recentMetrics.length : 0;
    
    const activeAlerts = this.alerts.filter(a => 
      a.timestamp > Date.now() - 60 * 60 * 1000 // Last hour
    ).length;

    const isHealthy = avgResponseTime < this.THRESHOLDS.SLOW_QUERY_MS && 
                     cacheHitRate > this.THRESHOLDS.LOW_CACHE_HIT_RATE &&
                     activeAlerts === 0;

    return {
      isHealthy,
      currentLoad: recentMetrics.length,
      averageResponseTime: Math.round(avgResponseTime),
      activeAlerts,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      memoryUsage: this.getCurrentMemoryUsage()
    };
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(hours: number = 24): {
    responseTime: Array<{ time: number; value: number }>;
    throughput: Array<{ time: number; value: number }>;
    errorRate: Array<{ time: number; value: number }>;
    cacheHitRate: Array<{ time: number; value: number }>;
  } {
    const startTime = Date.now() - (hours * 60 * 60 * 1000);
    const bucketSize = (hours * 60 * 60 * 1000) / 48; // 48 data points
    
    const trends = {
      responseTime: [] as Array<{ time: number; value: number }>,
      throughput: [] as Array<{ time: number; value: number }>,
      errorRate: [] as Array<{ time: number; value: number }>,
      cacheHitRate: [] as Array<{ time: number; value: number }>
    };

    // Get metrics from database
    const metrics = this.getMetricsForPeriod(startTime, Date.now());
    
    // Group into time buckets
    for (let time = startTime; time < Date.now(); time += bucketSize) {
      const bucketMetrics = metrics.filter(m => 
        m.timestamp >= time && m.timestamp < time + bucketSize
      );
      
      if (bucketMetrics.length > 0) {
        const avgResponseTime = bucketMetrics.reduce((sum, m) => sum + m.duration, 0) / bucketMetrics.length;
        const throughput = bucketMetrics.length;
        const errors = bucketMetrics.filter(m => m.operation.includes('_error')).length;
        const errorRate = errors / bucketMetrics.length;
        const cacheHits = bucketMetrics.filter(m => m.cacheHit).length;
        const cacheHitRate = cacheHits / bucketMetrics.length;
        
        trends.responseTime.push({ time, value: avgResponseTime });
        trends.throughput.push({ time, value: throughput });
        trends.errorRate.push({ time, value: errorRate });
        trends.cacheHitRate.push({ time, value: cacheHitRate });
      }
    }

    return trends;
  }

  /**
   * Get slow queries with analysis
   */
  getSlowQueries(limit: number = 10): Array<{
    operation: string;
    duration: number;
    frequency: number;
    timestamp: number;
    queryPlan?: string;
    recommendations: string[];
  }> {
    const slowMetrics = this.metrics
      .filter(m => m.duration > this.config.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);

    return slowMetrics.map(metric => ({
      operation: metric.operation,
      duration: metric.duration,
      frequency: this.getOperationFrequency(metric.operation),
      timestamp: metric.timestamp,
      queryPlan: metric.queryPlan,
      recommendations: this.getQueryRecommendations(metric)
    }));
  }

  /**
   * Private helper methods
   */

  private persistMetric(metric: PerformanceMetrics): void {
    try {
      this.db.prepare(`
        INSERT INTO performance_metrics (
          timestamp, operation, duration, records_processed,
          cache_hit, indexes_used, query_plan, memory_usage, cpu_usage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        metric.timestamp,
        metric.operation,
        metric.duration,
        metric.recordsProcessed,
        metric.cacheHit,
        JSON.stringify(metric.indexesUsed),
        metric.queryPlan,
        metric.memoryUsage,
        metric.cpuUsage
      );
    } catch (error) {
      console.error('Failed to persist metric:', error);
    }
  }

  private checkMetricForAlerts(metric: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Slow query alert
    if (metric.duration > this.config.slowQueryThreshold) {
      const level = metric.duration > this.config.criticalThreshold ? 'critical' : 'warning';
      alerts.push({
        level,
        message: `Slow ${metric.operation} operation detected`,
        metric: 'response_time',
        threshold: this.config.slowQueryThreshold,
        actual: metric.duration,
        timestamp: metric.timestamp,
        suggestions: this.getQueryRecommendations(metric)
      });
    }

    // Memory alert
    if (metric.memoryUsage > this.config.memoryAlertThreshold) {
      alerts.push({
        level: 'warning',
        message: 'High memory usage detected',
        metric: 'memory_usage',
        threshold: this.config.memoryAlertThreshold,
        actual: metric.memoryUsage,
        timestamp: metric.timestamp,
        suggestions: [
          'Consider reducing cache size',
          'Check for memory leaks',
          'Monitor long-running operations'
        ]
      });
    }

    // Store and emit alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.persistAlert(alert);
      
      if (this.config.enableRealTimeAlerts) {
        this.emit('alert', alert);
      }
    });
  }

  private persistAlert(alert: PerformanceAlert): void {
    try {
      this.db.prepare(`
        INSERT INTO performance_alerts (
          level, message, metric, threshold, actual, timestamp, suggestions
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        alert.level,
        alert.message,
        alert.metric,
        alert.threshold,
        alert.actual,
        alert.timestamp,
        JSON.stringify(alert.suggestions)
      );
    } catch (error) {
      console.error('Failed to persist alert:', error);
    }
  }

  private collectSystemMetrics(): void {
    const memoryUsage = this.getCurrentMemoryUsage();
    const cpuUsage = this.getCurrentCPUUsage();
    
    this.recordMetric('system_monitoring', 0, {
      recordsProcessed: 0
    });
  }

  private checkPerformanceThresholds(): void {
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );

    if (recentMetrics.length === 0) return;

    // Check cache hit rate
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = cacheHits / recentMetrics.length;
    
    if (cacheHitRate < this.THRESHOLDS.LOW_CACHE_HIT_RATE) {
      this.emit('alert', {
        level: 'warning',
        message: 'Low cache hit rate detected',
        metric: 'cache_hit_rate',
        threshold: this.THRESHOLDS.LOW_CACHE_HIT_RATE,
        actual: cacheHitRate,
        timestamp: Date.now(),
        suggestions: [
          'Increase cache size',
          'Review cache expiration policies',
          'Optimize query patterns'
        ]
      });
    }

    // Check error rate
    const errors = recentMetrics.filter(m => m.operation.includes('_error')).length;
    const errorRate = errors / recentMetrics.length;
    
    if (errorRate > this.THRESHOLDS.HIGH_ERROR_RATE) {
      this.emit('alert', {
        level: 'critical',
        message: 'High error rate detected',
        metric: 'error_rate',
        threshold: this.THRESHOLDS.HIGH_ERROR_RATE,
        actual: errorRate,
        timestamp: Date.now(),
        suggestions: [
          'Check database connectivity',
          'Review error logs',
          'Validate data integrity'
        ]
      });
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    
    try {
      // Clean database
      this.db.prepare('DELETE FROM performance_metrics WHERE timestamp < ?').run(cutoff);
      this.db.prepare('DELETE FROM performance_alerts WHERE timestamp < ?').run(cutoff);
      
      // Clean memory
      this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
      this.alerts = this.alerts.filter(a => a.timestamp >= cutoff);
      
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error);
    }
  }

  private getMetricsForPeriod(start: number, end: number): PerformanceMetrics[] {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM performance_metrics 
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp
      `).all(start, end);

      return rows.map((row: any) => ({
        timestamp: row.timestamp,
        operation: row.operation,
        duration: row.duration,
        recordsProcessed: row.records_processed,
        cacheHit: Boolean(row.cache_hit),
        indexesUsed: row.indexes_used ? JSON.parse(row.indexes_used) : [],
        queryPlan: row.query_plan,
        memoryUsage: row.memory_usage,
        cpuUsage: row.cpu_usage
      }));
    } catch (error) {
      console.error('Failed to get metrics for period:', error);
      return [];
    }
  }

  private getAlertsForPeriod(start: number, end: number): PerformanceAlert[] {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM performance_alerts 
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp DESC
      `).all(start, end);

      return rows.map((row: any) => ({
        level: row.level,
        message: row.message,
        metric: row.metric,
        threshold: row.threshold,
        actual: row.actual,
        timestamp: row.timestamp,
        suggestions: row.suggestions ? JSON.parse(row.suggestions) : []
      }));
    } catch (error) {
      console.error('Failed to get alerts for period:', error);
      return [];
    }
  }

  private calculateSummaryStats(metrics: PerformanceMetrics[]): any {
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        slowOperations: 0,
        cacheHitRate: 0,
        errorRate: 0
      };
    }

    const totalOperations = metrics.length;
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;
    const slowOperations = metrics.filter(m => m.duration > this.config.slowQueryThreshold).length;
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const cacheHitRate = cacheHits / totalOperations;
    const errors = metrics.filter(m => m.operation.includes('_error')).length;
    const errorRate = errors / totalOperations;

    return {
      totalOperations,
      averageResponseTime: Math.round(averageResponseTime),
      slowOperations,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  private calculateBreakdownStats(metrics: PerformanceMetrics[]): any {
    const byOperation = new Map<string, OperationStats>();
    const byHour = new Map<number, HourlyStats>();

    metrics.forEach(metric => {
      // By operation
      const opKey = metric.operation.replace('_error', '');
      if (!byOperation.has(opKey)) {
        byOperation.set(opKey, {
          count: 0,
          totalTime: 0,
          averageTime: 0,
          minTime: Infinity,
          maxTime: 0,
          errorCount: 0,
          cacheHits: 0
        });
      }

      const opStats = byOperation.get(opKey)!;
      opStats.count++;
      opStats.totalTime += metric.duration;
      opStats.minTime = Math.min(opStats.minTime, metric.duration);
      opStats.maxTime = Math.max(opStats.maxTime, metric.duration);
      
      if (metric.operation.includes('_error')) {
        opStats.errorCount++;
      }
      
      if (metric.cacheHit) {
        opStats.cacheHits++;
      }

      // By hour
      const hour = new Date(metric.timestamp).getHours();
      if (!byHour.has(hour)) {
        byHour.set(hour, {
          hour,
          operations: 0,
          averageTime: 0,
          errorCount: 0
        });
      }

      const hourStats = byHour.get(hour)!;
      hourStats.operations++;
      hourStats.averageTime = (hourStats.averageTime * (hourStats.operations - 1) + metric.duration) / hourStats.operations;
      
      if (metric.operation.includes('_error')) {
        hourStats.errorCount++;
      }
    });

    // Calculate averages
    byOperation.forEach(stats => {
      stats.averageTime = stats.totalTime / stats.count;
    });

    const slowestQueries = metrics
      .filter(m => m.duration > this.config.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      byOperation,
      byHour,
      slowestQueries
    };
  }

  private generateRecommendations(summary: any, breakdown: any): string[] {
    const recommendations: string[] = [];

    if (summary.averageResponseTime > this.THRESHOLDS.SLOW_QUERY_MS) {
      recommendations.push('Overall response time is high - consider index optimization');
    }

    if (summary.cacheHitRate < this.THRESHOLDS.LOW_CACHE_HIT_RATE) {
      recommendations.push('Cache hit rate is low - increase cache size or review cache strategy');
    }

    if (summary.errorRate > this.THRESHOLDS.HIGH_ERROR_RATE) {
      recommendations.push('Error rate is elevated - review error logs and fix underlying issues');
    }

    if (summary.slowOperations > summary.totalOperations * 0.1) {
      recommendations.push('High percentage of slow operations - review query optimization');
    }

    return recommendations;
  }

  private getCurrentMemoryUsage(): number {
    try {
      const usage = process.memoryUsage();
      return usage.heapUsed;
    } catch (error) {
      return 0;
    }
  }

  private getCurrentCPUUsage(): number {
    try {
      const usage = process.cpuUsage();
      return (usage.user + usage.system) / 1000000; // Convert to seconds
    } catch (error) {
      return 0;
    }
  }

  private getOperationFrequency(operation: string): number {
    return this.metrics.filter(m => m.operation === operation).length;
  }

  private getQueryRecommendations(metric: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metric.duration > this.THRESHOLDS.CRITICAL_QUERY_MS) {
      recommendations.push('Critical performance issue - immediate optimization required');
    }

    if (metric.indexesUsed.length === 0) {
      recommendations.push('No indexes used - add appropriate indexes');
    }

    if (!metric.cacheHit && metric.operation.includes('search')) {
      recommendations.push('Search result not cached - consider caching strategy');
    }

    if (metric.recordsProcessed > 1000) {
      recommendations.push('Large result set - consider pagination or filtering');
    }

    return recommendations;
  }
}