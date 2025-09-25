/**
 * Real-time Performance Metrics Collector
 * Collects and aggregates performance metrics with percentile tracking
 */

export interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: 'query' | 'cache' | 'response' | 'system';
  value: number;
  metadata: Record<string, any>;
  tags: string[];
}

export interface PercentileMetrics {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  count: number;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

export interface QueryMetrics {
  avgResponseTime: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }>;
  queryCount: number;
  errorRate: number;
  percentiles: PercentileMetrics;
}

export interface SLAMetrics {
  availability: number;
  responseTimeTarget: number;
  responseTimeActual: number;
  errorRateTarget: number;
  errorRateActual: number;
  throughputTarget: number;
  throughputActual: number;
  violations: Array<{
    type: string;
    timestamp: number;
    severity: 'warning' | 'critical';
    message: string;
  }>;
}

export class MetricsCollector {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private subscribers: Set<(metrics: any) => void> = new Set();
  private windowSize: number = 300000; // 5 minutes
  private cleanupInterval: ReturnType<typeof setTimeout>;
  private aggregationInterval: ReturnType<typeof setTimeout>;

  constructor() {
    // Clean up old metrics every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000);

    // Aggregate and notify subscribers every 5 seconds
    this.aggregationInterval = setInterval(() => {
      this.notifySubscribers();
    }, 5000);
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    const key = `${metric.type}:${metric.tags.join(',')}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);
  }

  /**
   * Record query performance
   */
  recordQuery(
    query: string,
    duration: number,
    success: boolean,
    metadata: Record<string, any> = {}
  ): void {
    this.recordMetric({
      id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'query',
      value: duration,
      metadata: {
        query: query.substring(0, 100), // Truncate for storage
        success,
        ...metadata,
      },
      tags: ['database', success ? 'success' : 'error'],
    });
  }

  /**
   * Record cache hit/miss
   */
  recordCacheEvent(key: string, hit: boolean, retrievalTime?: number): void {
    this.recordMetric({
      id: `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'cache',
      value: retrievalTime || 0,
      metadata: {
        key: key.substring(0, 50), // Truncate for storage
        hit,
      },
      tags: ['cache', hit ? 'hit' : 'miss'],
    });
  }

  /**
   * Record response time
   */
  recordResponseTime(endpoint: string, method: string, duration: number, statusCode: number): void {
    this.recordMetric({
      id: `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'response',
      value: duration,
      metadata: {
        endpoint,
        method,
        statusCode,
      },
      tags: ['http', method.toLowerCase(), statusCode >= 400 ? 'error' : 'success'],
    });
  }

  /**
   * Calculate percentiles from a sorted array of numbers
   */
  private calculatePercentiles(values: number[]): PercentileMetrics {
    if (values.length === 0) {
      return {
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        mean: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * len) - 1;
      return sorted[Math.max(0, Math.min(index, len - 1))];
    };

    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      mean: sum / len,
      min: sorted[0],
      max: sorted[len - 1],
      count: len,
    };
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(): QueryMetrics {
    const queryMetrics = this.getMetricsByType('query');
    const values = queryMetrics.map(m => m.value);
    const errors = queryMetrics.filter(m => !m.metadata.success);

    const slowQueries = queryMetrics
      .filter(m => m.value > 1000) // Slow queries > 1 second
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(m => ({
        query: m.metadata.query,
        duration: m.value,
        timestamp: m.timestamp,
      }));

    return {
      avgResponseTime: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      slowQueries,
      queryCount: queryMetrics.length,
      errorRate: queryMetrics.length > 0 ? errors.length / queryMetrics.length : 0,
      percentiles: this.calculatePercentiles(values),
    };
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): CacheMetrics {
    const cacheMetrics = this.getMetricsByType('cache');
    const hits = cacheMetrics.filter(m => m.metadata.hit);
    const misses = cacheMetrics.filter(m => !m.metadata.hit);

    const totalRequests = cacheMetrics.length;
    const hitCount = hits.length;
    const missCount = misses.length;

    return {
      hitRate: totalRequests > 0 ? hitCount / totalRequests : 0,
      missRate: totalRequests > 0 ? missCount / totalRequests : 0,
      totalRequests,
      hits: hitCount,
      misses: missCount,
      evictions: 0, // Would need to be tracked separately
      size: 0, // Would need to be tracked separately
      maxSize: 0, // Would need to be tracked separately
    };
  }

  /**
   * Get response time metrics with percentiles
   */
  getResponseTimeMetrics(): PercentileMetrics & { byEndpoint: Record<string, PercentileMetrics> } {
    const responseMetrics = this.getMetricsByType('response');
    const values = responseMetrics.map(m => m.value);

    // Group by endpoint
    const byEndpoint: Record<string, number[]> = {};
    responseMetrics.forEach(m => {
      const endpoint = m.metadata.endpoint;
      if (!byEndpoint[endpoint]) {
        byEndpoint[endpoint] = [];
      }
      byEndpoint[endpoint].push(m.value);
    });

    const endpointMetrics: Record<string, PercentileMetrics> = {};
    Object.entries(byEndpoint).forEach(([endpoint, endpointValues]) => {
      endpointMetrics[endpoint] = this.calculatePercentiles(endpointValues);
    });

    return {
      ...this.calculatePercentiles(values),
      byEndpoint: endpointMetrics,
    };
  }

  /**
   * Get SLA compliance metrics
   */
  getSLAMetrics(targets: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  }): SLAMetrics {
    const queryMetrics = this.getQueryMetrics();
    const responseMetrics = this.getResponseTimeMetrics();
    const now = Date.now();
    const hourAgo = now - 3600000; // 1 hour ago

    // Calculate availability (uptime in the last hour)
    const recentMetrics = this.getMetricsSince(hourAgo);
    const availability = recentMetrics.length > 0 ? 1 : 0; // Simplified calculation

    const violations: SLAMetrics['violations'] = [];

    // Check response time violations
    if (responseMetrics.p95 > targets.responseTime) {
      violations.push({
        type: 'response_time',
        timestamp: now,
        severity: responseMetrics.p95 > targets.responseTime * 2 ? 'critical' : 'warning',
        message: `P95 response time (${responseMetrics.p95.toFixed(2)}ms) exceeds target (${targets.responseTime}ms)`,
      });
    }

    // Check error rate violations
    if (queryMetrics.errorRate > targets.errorRate) {
      violations.push({
        type: 'error_rate',
        timestamp: now,
        severity: queryMetrics.errorRate > targets.errorRate * 2 ? 'critical' : 'warning',
        message: `Error rate (${(queryMetrics.errorRate * 100).toFixed(2)}%) exceeds target (${(targets.errorRate * 100).toFixed(2)}%)`,
      });
    }

    // Calculate throughput (requests per minute)
    const recentRequests = recentMetrics.filter(m => m.type === 'response').length;
    const throughputActual = recentRequests / 60; // per minute

    if (throughputActual < targets.throughput) {
      violations.push({
        type: 'throughput',
        timestamp: now,
        severity: throughputActual < targets.throughput * 0.5 ? 'critical' : 'warning',
        message: `Throughput (${throughputActual.toFixed(2)} req/min) below target (${targets.throughput} req/min)`,
      });
    }

    return {
      availability,
      responseTimeTarget: targets.responseTime,
      responseTimeActual: responseMetrics.p95,
      errorRateTarget: targets.errorRate,
      errorRateActual: queryMetrics.errorRate,
      throughputTarget: targets.throughput,
      throughputActual,
      violations,
    };
  }

  /**
   * Get all metrics of a specific type within the time window
   */
  private getMetricsByType(type: string): PerformanceMetric[] {
    const now = Date.now();
    const cutoff = now - this.windowSize;
    const allMetrics: PerformanceMetric[] = [];

    for (const [key, metrics] of this.metrics.entries()) {
      if (key.startsWith(`${type}:`)) {
        allMetrics.push(...metrics.filter(m => m.timestamp > cutoff));
      }
    }

    return allMetrics;
  }

  /**
   * Get all metrics since a specific timestamp
   */
  private getMetricsSince(timestamp: number): PerformanceMetric[] {
    const allMetrics: PerformanceMetric[] = [];

    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics.filter(m => m.timestamp > timestamp));
    }

    return allMetrics;
  }

  /**
   * Subscribe to metric updates
   */
  subscribe(callback: (metrics: any) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers with aggregated metrics
   */
  private notifySubscribers(): void {
    const metrics = {
      timestamp: Date.now(),
      query: this.getQueryMetrics(),
      cache: this.getCacheMetrics(),
      responseTime: this.getResponseTimeMetrics(),
      sla: this.getSLAMetrics({
        responseTime: 500, // 500ms target
        errorRate: 0.01, // 1% error rate target
        throughput: 100, // 100 requests per minute target
      }),
    };

    this.subscribers.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error notifying metrics subscriber:', error);
      }
    });
  }

  /**
   * Clean up old metrics outside the time window
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const cutoff = now - this.windowSize;

    for (const [key, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);
      if (filteredMetrics.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filteredMetrics);
      }
    }
  }

  /**
   * Get current metrics summary
   */
  getCurrentMetrics() {
    return {
      timestamp: Date.now(),
      query: this.getQueryMetrics(),
      cache: this.getCacheMetrics(),
      responseTime: this.getResponseTimeMetrics(),
      sla: this.getSLAMetrics({
        responseTime: 500,
        errorRate: 0.01,
        throughput: 100,
      }),
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    this.metrics.clear();
    this.subscribers.clear();
  }
}

// Global instance
export const metricsCollector = new MetricsCollector();
