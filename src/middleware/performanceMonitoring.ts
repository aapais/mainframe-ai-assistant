/**
 * Performance Monitoring Middleware
 * Real-time performance tracking for cache operations and API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

// Import from centralized types
import type {
  HTTPPerformanceMetrics as PerformanceMetrics,
  PerformanceAlert,
  PerformanceConfig,
  PerformanceStats
} from '../types/shared/performance';

/**
 * High-Performance Monitoring Middleware
 *
 * Features:
 * - Real-time performance tracking
 * - Cache performance monitoring
 * - Memory and CPU usage tracking
 * - Automatic alerting on thresholds
 * - Statistical analysis and reporting
 * - Request correlation and tracing
 * - Adaptive sampling for high load
 */
export class PerformanceMonitoringMiddleware extends EventEmitter {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics[] = [];
  private batchBuffer: PerformanceMetrics[] = [];
  private alertHistory: PerformanceAlert[] = [];
  private endpointStats = new Map<string, { times: number[]; errors: number; requests: number }>();
  private errorCounts = new Map<string, { count: number; lastSeen: number }>();

  // Performance tracking
  private lastCpuUsage = process.cpuUsage();
  private requestCounter = 0;
  private flushTimer?: ReturnType<typeof setTimeout>;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();

    this.config = {
      enableDetailedLogging: true,
      enableRealTimeAlerts: true,
      alertThresholds: {
        highLatency: 2000, // 2 seconds
        highErrorRate: 0.05, // 5%
        cacheMissRate: 0.7, // 70%
        memoryUsage: 0.8, // 80%
        cpuUsage: 0.9 // 90%
      },
      samplingRate: 1.0, // 100% sampling by default
      retentionPeriodMs: 24 * 60 * 60 * 1000, // 24 hours
      batchSize: 100,
      flushIntervalMs: 5000, // 5 seconds
      ...config
    };

    this.startFlushTimer();
    this.startPeriodicChecks();
  }

  /**
   * Express middleware for performance monitoring
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.requestCounter++;
      const requestId = this.generateRequestId();
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      // Skip sampling if rate is less than 100%
      if (Math.random() > this.config.samplingRate) {
        return next();
      }

      // Add request ID to headers for tracing
      res.setHeader('X-Request-ID', requestId);

      // Cache performance tracking
      let cacheHit = false;
      let cacheLatency: number | undefined;

      // Override res.json to detect cache hits
      const originalJson = res.json;
      res.json = function(body: any) {
        if (body && typeof body === 'object' && body.cached === true) {
          cacheHit = true;
        }
        return originalJson.call(this, body);
      };

      // Track cache operations
      const originalSend = res.send;
      res.send = function(body: any) {
        return originalSend.call(this, body);
      };

      // Monitor response completion
      res.on('finish', () => {
        try {
          const endTime = process.hrtime.bigint();
          const responseTime = Number((endTime - startTime) / BigInt(1000000)); // Convert to milliseconds
          const endMemory = process.memoryUsage();
          const cpuUsage = this.calculateCpuUsage();

          const metrics: PerformanceMetrics = {
            requestId,
            method: req.method,
            url: this.sanitizeUrl(req.originalUrl || req.url),
            statusCode: res.statusCode,
            responseTime,
            cacheHit,
            cacheLatency,
            memoryUsage: endMemory.heapUsed,
            cpuUsage,
            timestamp: Date.now(),
            userAgent: req.get('User-Agent'),
            userId: req.headers['user-id'] as string,
            sessionId: req.headers['session-id'] as string,
            contentLength: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined,
            errorMessage: res.statusCode >= 400 ? this.extractErrorMessage(res) : undefined
          };

          this.recordMetrics(metrics);
          this.checkAlerts(metrics);
          this.updateEndpointStats(metrics);

          if (this.config.enableDetailedLogging) {
            this.logRequestDetails(metrics);
          }

        } catch (error) {
          console.error('Performance monitoring error:', error);
        }
      });

      next();
    };
  }

  /**
   * Record cache operation performance
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete' | 'clear',
    key: string,
    hit: boolean,
    latency: number,
    size?: number
  ): void {
    const metrics = {
      operation,
      key: this.sanitizeKey(key),
      hit,
      latency,
      size,
      timestamp: Date.now()
    };

    if (latency > this.config.alertThresholds.highLatency / 4) {
      this.emitAlert({
        type: 'high_latency',
        severity: 'warning',
        message: `Cache ${operation} operation took ${latency}ms`,
        value: latency,
        threshold: this.config.alertThresholds.highLatency / 4,
        timestamp: Date.now(),
        metadata: { operation, key: this.sanitizeKey(key) }
      });
    }

    this.emit('cache-operation', metrics);
  }

  /**
   * Record memory usage spike
   */
  recordMemoryUsage(usage: NodeJS.MemoryUsage): void {
    const heapUsagePercent = usage.heapUsed / usage.heapTotal;

    if (heapUsagePercent > this.config.alertThresholds.memoryUsage) {
      this.emitAlert({
        type: 'memory_pressure',
        severity: heapUsagePercent > 0.95 ? 'critical' : 'warning',
        message: `High memory usage: ${(heapUsagePercent * 100).toFixed(1)}%`,
        value: heapUsagePercent,
        threshold: this.config.alertThresholds.memoryUsage,
        timestamp: Date.now(),
        metadata: { memoryUsage: usage }
      });
    }

    this.emit('memory-usage', { usage, timestamp: Date.now() });
  }

  /**
   * Get comprehensive performance statistics
   */
  getStats(timeWindowMs: number = 3600000): PerformanceStats {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return this.getEmptyStats();
    }

    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const errors = recentMetrics.filter(m => m.statusCode >= 400);
    const cacheHits = recentMetrics.filter(m => m.cacheHit);
    const cacheOperations = recentMetrics.filter(m => m.cacheLatency !== undefined);

    // Calculate percentiles
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Endpoint analysis
    const endpointPerformance = new Map<string, { times: number[]; count: number }>();
    recentMetrics.forEach(m => {
      const endpoint = `${m.method} ${this.normalizeEndpoint(m.url)}`;
      const current = endpointPerformance.get(endpoint) || { times: [], count: 0 };
      current.times.push(m.responseTime);
      current.count++;
      endpointPerformance.set(endpoint, current);
    });

    const slowestEndpoints = Array.from(endpointPerformance.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        avgTime: data.times.reduce((sum, t) => sum + t, 0) / data.times.length,
        requestCount: data.count
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    // Error analysis
    const topErrors = Array.from(this.errorCounts.entries())
      .map(([error, data]) => ({
        error,
        count: data.count,
        lastSeen: data.lastSeen
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests: recentMetrics.length,
      averageResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      errorRate: errors.length / recentMetrics.length,
      cacheHitRate: cacheHits.length / recentMetrics.length,
      averageCacheLatency: cacheOperations.length > 0
        ? cacheOperations.reduce((sum, m) => sum + (m.cacheLatency || 0), 0) / cacheOperations.length
        : 0,
      throughput: recentMetrics.length / (timeWindowMs / 1000),
      peakMemoryUsage: Math.max(...recentMetrics.map(m => m.memoryUsage)),
      averageCpuUsage: recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length,
      slowestEndpoints,
      topErrors
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(timeWindowMs: number = 3600000): PerformanceAlert[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.alertHistory.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Get real-time metrics for monitoring dashboard
   */
  getRealTimeMetrics(): {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    memoryUsage: number;
    cpuUsage: number;
    activeAlerts: number;
  } {
    const oneMinuteAgo = Date.now() - 60000;
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneMinuteAgo);

    if (recentMetrics.length === 0) {
      return {
        requestsPerSecond: 0,
        averageResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        activeAlerts: 0
      };
    }

    const errors = recentMetrics.filter(m => m.statusCode >= 400);
    const cacheHits = recentMetrics.filter(m => m.cacheHit);
    const currentMemory = process.memoryUsage();

    return {
      requestsPerSecond: recentMetrics.length / 60,
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length,
      errorRate: errors.length / recentMetrics.length,
      cacheHitRate: cacheHits.length / recentMetrics.length,
      memoryUsage: currentMemory.heapUsed / currentMemory.heapTotal,
      cpuUsage: this.calculateCpuUsage(),
      activeAlerts: this.getAlerts(300000).length // Last 5 minutes
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    const stats = this.getStats();

    if (format === 'prometheus') {
      return this.formatPrometheusMetrics(stats);
    }

    return JSON.stringify({
      timestamp: Date.now(),
      stats,
      alerts: this.getAlerts(),
      realtime: this.getRealTimeMetrics()
    }, null, 2);
  }

  /**
   * Clear old metrics and optimize memory usage
   */
  cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriodMs;

    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.alertHistory = this.alertHistory.filter(a => a.timestamp > cutoff);

    // Cleanup endpoint stats
    for (const [endpoint, stats] of this.endpointStats) {
      if (stats.requests === 0) {
        this.endpointStats.delete(endpoint);
      }
    }

    // Cleanup error counts
    for (const [error, data] of this.errorCounts) {
      if (data.lastSeen < cutoff) {
        this.errorCounts.delete(error);
      }
    }

    this.emit('cleanup-completed', {
      metricsRetained: this.metrics.length,
      alertsRetained: this.alertHistory.length
    });
  }

  /**
   * Shutdown and cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushBatch();
    this.removeAllListeners();
    this.metrics = [];
    this.alertHistory = [];
    this.endpointStats.clear();
    this.errorCounts.clear();
  }

  // Private Implementation

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeUrl(url: string): string {
    // Remove query parameters and sanitize for privacy
    return url.split('?')[0].replace(/\/\d+/g, '/:id');
  }

  private sanitizeKey(key: string): string {
    // Remove sensitive information from cache keys
    return key.replace(/user:\w+/, 'user:***').substring(0, 100);
  }

  private calculateCpuUsage(): number {
    const currentUsage = process.cpuUsage(this.lastCpuUsage);
    const totalUsage = currentUsage.user + currentUsage.system;
    this.lastCpuUsage = process.cpuUsage();

    // Convert to percentage (rough approximation)
    return totalUsage / 1000000 / 1000; // Convert microseconds to percentage
  }

  private extractErrorMessage(res: Response): string {
    // Extract error message from response (implementation depends on error format)
    return `HTTP ${res.statusCode}`;
  }

  private recordMetrics(metrics: PerformanceMetrics): void {
    this.batchBuffer.push(metrics);

    if (this.batchBuffer.length >= this.config.batchSize) {
      this.flushBatch();
    }
  }

  private flushBatch(): void {
    if (this.batchBuffer.length === 0) return;

    this.metrics.push(...this.batchBuffer);
    this.emit('metrics-batch', this.batchBuffer.slice());
    this.batchBuffer = [];

    // Keep memory usage in check
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  private checkAlerts(metrics: PerformanceMetrics): void {
    if (!this.config.enableRealTimeAlerts) return;

    // High latency alert
    if (metrics.responseTime > this.config.alertThresholds.highLatency) {
      this.emitAlert({
        type: 'high_latency',
        severity: metrics.responseTime > this.config.alertThresholds.highLatency * 2 ? 'critical' : 'warning',
        message: `High response time: ${metrics.responseTime}ms for ${metrics.method} ${metrics.url}`,
        value: metrics.responseTime,
        threshold: this.config.alertThresholds.highLatency,
        timestamp: metrics.timestamp,
        requestId: metrics.requestId
      });
    }

    // Memory pressure alert
    const memoryUsagePercent = metrics.memoryUsage / (1024 * 1024 * 1024); // Convert to GB
    if (memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
      this.emitAlert({
        type: 'memory_pressure',
        severity: 'warning',
        message: `High memory usage: ${memoryUsagePercent.toFixed(2)}GB`,
        value: memoryUsagePercent,
        threshold: this.config.alertThresholds.memoryUsage,
        timestamp: metrics.timestamp,
        requestId: metrics.requestId
      });
    }

    // CPU usage alert
    if (metrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
      this.emitAlert({
        type: 'cpu_spike',
        severity: 'warning',
        message: `High CPU usage: ${(metrics.cpuUsage * 100).toFixed(1)}%`,
        value: metrics.cpuUsage,
        threshold: this.config.alertThresholds.cpuUsage,
        timestamp: metrics.timestamp,
        requestId: metrics.requestId
      });
    }

    // Track error patterns
    if (metrics.errorMessage) {
      const errorKey = `${metrics.statusCode}: ${metrics.errorMessage}`;
      const current = this.errorCounts.get(errorKey) || { count: 0, lastSeen: 0 };
      current.count++;
      current.lastSeen = metrics.timestamp;
      this.errorCounts.set(errorKey, current);
    }
  }

  private emitAlert(alert: PerformanceAlert): void {
    this.alertHistory.push(alert);

    // Keep alert history manageable
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-500);
    }

    this.emit('performance-alert', alert);

    if (this.config.enableDetailedLogging) {
      console.warn(`Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    }
  }

  private updateEndpointStats(metrics: PerformanceMetrics): void {
    const endpoint = `${metrics.method} ${this.normalizeEndpoint(metrics.url)}`;
    const current = this.endpointStats.get(endpoint) || { times: [], errors: 0, requests: 0 };

    current.times.push(metrics.responseTime);
    current.requests++;

    if (metrics.statusCode >= 400) {
      current.errors++;
    }

    // Keep only recent times for memory efficiency
    if (current.times.length > 100) {
      current.times = current.times.slice(-50);
    }

    this.endpointStats.set(endpoint, current);
  }

  private normalizeEndpoint(url: string): string {
    return url.replace(/\/\d+/g, '/:id')
              .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:uuid')
              .replace(/\?.*$/, '');
  }

  private logRequestDetails(metrics: PerformanceMetrics): void {
    const logLevel = metrics.statusCode >= 400 ? 'error' :
                    metrics.responseTime > 1000 ? 'warn' : 'info';

    console[logLevel](`${metrics.method} ${metrics.url} - ${metrics.statusCode} - ${metrics.responseTime}ms - Cache: ${metrics.cacheHit ? 'HIT' : 'MISS'}`);
  }

  private getEmptyStats(): PerformanceStats {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      cacheHitRate: 0,
      averageCacheLatency: 0,
      throughput: 0,
      peakMemoryUsage: 0,
      averageCpuUsage: 0,
      slowestEndpoints: [],
      topErrors: []
    };
  }

  private formatPrometheusMetrics(stats: PerformanceStats): string {
    return `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${stats.totalRequests}

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_sum ${stats.averageResponseTime * stats.totalRequests / 1000}
http_request_duration_seconds_count ${stats.totalRequests}

# HELP http_request_duration_seconds_p95 95th percentile response time
# TYPE http_request_duration_seconds_p95 gauge
http_request_duration_seconds_p95 ${stats.p95ResponseTime / 1000}

# HELP cache_hit_rate Cache hit rate
# TYPE cache_hit_rate gauge
cache_hit_rate ${stats.cacheHitRate}

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes ${stats.peakMemoryUsage}
    `.trim();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushBatch();
    }, this.config.flushIntervalMs);
  }

  private startPeriodicChecks(): void {
    // Check system health every 30 seconds
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.recordMemoryUsage(memoryUsage);

      // Check for error rate spikes
      this.checkErrorRateSpikes();

      // Check for cache miss spikes
      this.checkCacheMissSpikes();
    }, 30000);

    // Cleanup old data every hour
    setInterval(() => {
      this.cleanup();
    }, 3600000);
  }

  private checkErrorRateSpikes(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    const recentMetrics = this.metrics.filter(m => m.timestamp > fiveMinutesAgo);

    if (recentMetrics.length < 10) return; // Not enough data

    const errors = recentMetrics.filter(m => m.statusCode >= 400);
    const errorRate = errors.length / recentMetrics.length;

    if (errorRate > this.config.alertThresholds.highErrorRate) {
      this.emitAlert({
        type: 'high_error_rate',
        severity: errorRate > 0.1 ? 'critical' : 'warning',
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        value: errorRate,
        threshold: this.config.alertThresholds.highErrorRate,
        timestamp: Date.now()
      });
    }
  }

  private checkCacheMissSpikes(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    const recentMetrics = this.metrics.filter(m => m.timestamp > fiveMinutesAgo);

    if (recentMetrics.length < 10) return; // Not enough data

    const cacheMisses = recentMetrics.filter(m => !m.cacheHit);
    const missRate = cacheMisses.length / recentMetrics.length;

    if (missRate > this.config.alertThresholds.cacheMissRate) {
      this.emitAlert({
        type: 'cache_miss_spike',
        severity: 'warning',
        message: `High cache miss rate: ${(missRate * 100).toFixed(1)}%`,
        value: missRate,
        threshold: this.config.alertThresholds.cacheMissRate,
        timestamp: Date.now()
      });
    }
  }
}

// Export middleware factory
export function createPerformanceMiddleware(config?: Partial<PerformanceConfig>) {
  const monitor = new PerformanceMonitoringMiddleware(config);

  return {
    middleware: monitor.middleware(),
    monitor,
    getStats: () => monitor.getStats(),
    getAlerts: () => monitor.getAlerts(),
    getRealTimeMetrics: () => monitor.getRealTimeMetrics(),
    exportMetrics: (format?: 'json' | 'prometheus') => monitor.exportMetrics(format)
  };
}

export default PerformanceMonitoringMiddleware;