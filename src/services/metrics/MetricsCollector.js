'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.metricsCollector = exports.MetricsCollector = void 0;
class MetricsCollector {
  metrics = new Map();
  subscribers = new Set();
  windowSize = 300000;
  cleanupInterval;
  aggregationInterval;
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000);
    this.aggregationInterval = setInterval(() => {
      this.notifySubscribers();
    }, 5000);
  }
  recordMetric(metric) {
    const key = `${metric.type}:${metric.tags.join(',')}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key).push(metric);
  }
  recordQuery(query, duration, success, metadata = {}) {
    this.recordMetric({
      id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'query',
      value: duration,
      metadata: {
        query: query.substring(0, 100),
        success,
        ...metadata,
      },
      tags: ['database', success ? 'success' : 'error'],
    });
  }
  recordCacheEvent(key, hit, retrievalTime) {
    this.recordMetric({
      id: `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'cache',
      value: retrievalTime || 0,
      metadata: {
        key: key.substring(0, 50),
        hit,
      },
      tags: ['cache', hit ? 'hit' : 'miss'],
    });
  }
  recordResponseTime(endpoint, method, duration, statusCode) {
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
  calculatePercentiles(values) {
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
    const percentile = p => {
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
  getQueryMetrics() {
    const queryMetrics = this.getMetricsByType('query');
    const values = queryMetrics.map(m => m.value);
    const errors = queryMetrics.filter(m => !m.metadata.success);
    const slowQueries = queryMetrics
      .filter(m => m.value > 1000)
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
  getCacheMetrics() {
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
      evictions: 0,
      size: 0,
      maxSize: 0,
    };
  }
  getResponseTimeMetrics() {
    const responseMetrics = this.getMetricsByType('response');
    const values = responseMetrics.map(m => m.value);
    const byEndpoint = {};
    responseMetrics.forEach(m => {
      const endpoint = m.metadata.endpoint;
      if (!byEndpoint[endpoint]) {
        byEndpoint[endpoint] = [];
      }
      byEndpoint[endpoint].push(m.value);
    });
    const endpointMetrics = {};
    Object.entries(byEndpoint).forEach(([endpoint, endpointValues]) => {
      endpointMetrics[endpoint] = this.calculatePercentiles(endpointValues);
    });
    return {
      ...this.calculatePercentiles(values),
      byEndpoint: endpointMetrics,
    };
  }
  getSLAMetrics(targets) {
    const queryMetrics = this.getQueryMetrics();
    const responseMetrics = this.getResponseTimeMetrics();
    const now = Date.now();
    const hourAgo = now - 3600000;
    const recentMetrics = this.getMetricsSince(hourAgo);
    const availability = recentMetrics.length > 0 ? 1 : 0;
    const violations = [];
    if (responseMetrics.p95 > targets.responseTime) {
      violations.push({
        type: 'response_time',
        timestamp: now,
        severity: responseMetrics.p95 > targets.responseTime * 2 ? 'critical' : 'warning',
        message: `P95 response time (${responseMetrics.p95.toFixed(2)}ms) exceeds target (${targets.responseTime}ms)`,
      });
    }
    if (queryMetrics.errorRate > targets.errorRate) {
      violations.push({
        type: 'error_rate',
        timestamp: now,
        severity: queryMetrics.errorRate > targets.errorRate * 2 ? 'critical' : 'warning',
        message: `Error rate (${(queryMetrics.errorRate * 100).toFixed(2)}%) exceeds target (${(targets.errorRate * 100).toFixed(2)}%)`,
      });
    }
    const recentRequests = recentMetrics.filter(m => m.type === 'response').length;
    const throughputActual = recentRequests / 60;
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
  getMetricsByType(type) {
    const now = Date.now();
    const cutoff = now - this.windowSize;
    const allMetrics = [];
    for (const [key, metrics] of this.metrics.entries()) {
      if (key.startsWith(`${type}:`)) {
        allMetrics.push(...metrics.filter(m => m.timestamp > cutoff));
      }
    }
    return allMetrics;
  }
  getMetricsSince(timestamp) {
    const allMetrics = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics.filter(m => m.timestamp > timestamp));
    }
    return allMetrics;
  }
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  notifySubscribers() {
    const metrics = {
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
    this.subscribers.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error notifying metrics subscriber:', error);
      }
    });
  }
  cleanupOldMetrics() {
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
  destroy() {
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
exports.MetricsCollector = MetricsCollector;
exports.metricsCollector = new MetricsCollector();
//# sourceMappingURL=MetricsCollector.js.map
