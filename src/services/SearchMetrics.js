'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SearchMetrics = void 0;
const events_1 = require('events');
class SearchMetrics extends events_1.EventEmitter {
  database;
  metrics = new Map();
  cacheMetrics = new Map();
  alertRules = new Map();
  activeAlerts = new Map();
  metricsBuffer = [];
  bufferFlushInterval = 30000;
  maxMetricsInMemory = 10000;
  alertCooldownPeriod = 300000;
  constructor(database) {
    super();
    this.database = database;
    this.initializeMetrics();
    this.setupAlertRules();
    this.startMetricsCollection();
  }
  recordMetric(operation, duration, success = true, metadata) {
    const metric = {
      timestamp: Date.now(),
      operation,
      duration,
      success,
      metadata,
    };
    this.metricsBuffer.push(metric);
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    const operationMetrics = this.metrics.get(operation);
    operationMetrics.push(metric);
    if (operationMetrics.length > 1000) {
      operationMetrics.splice(0, operationMetrics.length - 1000);
    }
    this.checkPerformanceAlerts(operation, duration, success);
  }
  recordCacheMetrics(layer, level, hitRate, averageAccessTime, memoryUsage = 0) {
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
    this.checkCacheAlerts(layer, hitRate, averageAccessTime);
  }
  async getSearchAnalytics(timeRange = '24h') {
    const cutoffTime = this.getCutoffTime(timeRange);
    const searchMetrics = this.getMetricsInTimeRange('search', cutoffTime);
    if (searchMetrics.length === 0) {
      return this.getEmptyAnalytics();
    }
    const responseTimes = searchMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successfulSearches = searchMetrics.filter(m => m.success);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
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
  getRealTimeMetrics() {
    const now = Date.now();
    const lastMinute = now - 60000;
    const recentSearches = this.getMetricsInTimeRange('search', lastMinute);
    const currentQPS = recentSearches.length / 60;
    const last5Minutes = now - 300000;
    const recent5MinSearches = this.getMetricsInTimeRange('search', last5Minutes);
    const avgResponseTime =
      recent5MinSearches.length > 0 ? this.average(recent5MinSearches.map(m => m.duration)) : 0;
    const cacheHitRate = this.calculateOverallCacheHitRate();
    const activeAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
    const systemHealth = this.assessSystemHealth(
      avgResponseTime,
      cacheHitRate,
      activeAlerts.length
    );
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
  getCacheLayerMetrics() {
    return Array.from(this.cacheMetrics.values()).sort((a, b) => a.level - b.level);
  }
  createAlertRule(name, condition, threshold, severity) {
    this.alertRules.set(name, {
      name,
      condition,
      threshold,
      severity,
      enabled: true,
      triggerCount: 0,
    });
  }
  getOptimizationRecommendations() {
    const recommendations = [];
    const cacheMetrics = this.getCacheLayerMetrics();
    cacheMetrics.forEach(cache => {
      if (cache.hitRate < 0.7) {
        recommendations.push({
          category: 'cache',
          priority: 'high',
          recommendation: `Improve ${cache.layer} hit rate (currently ${Math.round(cache.hitRate * 100)}%)`,
          impact: 'Reduced response times and database load',
          effort: 'medium',
        });
      }
      if (cache.averageAccessTime > 50) {
        recommendations.push({
          category: 'cache',
          priority: 'medium',
          recommendation: `Optimize ${cache.layer} access time (currently ${Math.round(cache.averageAccessTime)}ms)`,
          impact: 'Faster cache retrieval',
          effort: 'low',
        });
      }
    });
    const searchMetrics = this.getMetricsInTimeRange('search', Date.now() - 3600000);
    if (searchMetrics.length > 0) {
      const avgResponseTime = this.average(searchMetrics.map(m => m.duration));
      if (avgResponseTime > 500) {
        recommendations.push({
          category: 'query',
          priority: 'high',
          recommendation: 'Optimize slow queries (avg response time > 500ms)',
          impact: 'Significantly faster search responses',
          effort: 'medium',
        });
      }
    }
    const systemHealth = this.getRealTimeMetrics().systemHealth;
    if (systemHealth === 'warning' || systemHealth === 'critical') {
      recommendations.push({
        category: 'system',
        priority: 'high',
        recommendation: 'Address system performance issues',
        impact: 'Improved overall system stability',
        effort: 'high',
      });
    }
    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }
  async exportMetrics(format, timeRange = '24h') {
    const cutoffTime = this.getCutoffTime(timeRange);
    const allMetrics = [];
    this.metrics.forEach(metrics => {
      metrics.forEach(metric => {
        if (metric.timestamp >= cutoffTime) {
          allMetrics.push(metric);
        }
      });
    });
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
      } catch (error) {}
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
  initializeMetrics() {
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
  setupAlertRules() {
    this.createAlertRule('high_response_time', 'average_response_time > threshold', 1000, 'high');
    this.createAlertRule('low_cache_hit_rate', 'cache_hit_rate < threshold', 0.7, 'medium');
    this.createAlertRule('high_error_rate', 'error_rate > threshold', 0.05, 'critical');
    this.createAlertRule('slow_cache_access', 'cache_access_time > threshold', 100, 'medium');
  }
  startMetricsCollection() {
    setInterval(() => {
      this.flushMetricsBuffer();
    }, this.bufferFlushInterval);
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
    setInterval(() => {
      this.performanceHealthCheck();
    }, 60000);
    console.log('✅ SearchMetrics collection started');
  }
  flushMetricsBuffer() {
    if (this.metricsBuffer.length === 0) return;
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
    this.metricsBuffer = [];
  }
  checkPerformanceAlerts(operation, duration, success) {
    const now = Date.now();
    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;
      if (rule.lastTriggered && now - rule.lastTriggered < this.alertCooldownPeriod) {
        return;
      }
      let shouldAlert = false;
      let alertMessage = '';
      switch (rule.condition) {
        case 'average_response_time > threshold':
          const recentMetrics = this.getMetricsInTimeRange(operation, now - 300000);
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
  checkCacheAlerts(layer, hitRate, accessTime) {
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
  triggerAlert(rule, message, metadata) {
    const alertId = `${rule.name}_${Date.now()}`;
    const alert = {
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
  getMetricsInTimeRange(operation, cutoffTime) {
    const operationMetrics = this.metrics.get(operation) || [];
    return operationMetrics.filter(m => m.timestamp >= cutoffTime);
  }
  getCutoffTime(timeRange) {
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
  average(numbers) {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }
  calculateOverallCacheHitRate() {
    const cacheMetrics = Array.from(this.cacheMetrics.values());
    if (cacheMetrics.length === 0) return 0;
    const totalHits = cacheMetrics.reduce((sum, cache) => sum + cache.totalHits, 0);
    const totalRequests = cacheMetrics.reduce(
      (sum, cache) => sum + cache.totalHits + cache.totalMisses,
      0
    );
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }
  assessSystemHealth(avgResponseTime, cacheHitRate, alertCount) {
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
  identifyPerformanceBottlenecks() {
    const bottlenecks = [];
    this.metrics.forEach((metrics, operation) => {
      if (metrics.length < 10) return;
      const recentMetrics = metrics.filter(m => m.timestamp > Date.now() - 300000);
      if (recentMetrics.length === 0) return;
      const avgTime = this.average(recentMetrics.map(m => m.duration));
      if (avgTime > 500) {
        bottlenecks.push(`Slow ${operation} operations (avg: ${Math.round(avgTime)}ms)`);
      }
    });
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
  getSeverityWeight(severity) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity] || 0;
  }
  async getPopularQueries(cutoffTime) {
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
      return results.map(row => ({
        query: row.query,
        count: row.count,
        avgResponseTime: Math.round(row.avgResponseTime),
        successRate: Math.round(row.successRate) / 100,
      }));
    } catch (error) {
      return [];
    }
  }
  async getPerformanceTrends(timeRange) {
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
      return results.map(row => ({
        date: row.date,
        avgResponseTime: Math.round(row.avgResponseTime),
        totalSearches: row.totalSearches,
        cacheHitRate: Math.round(row.cacheHitRate * 100) / 100,
      }));
    } catch (error) {
      return [];
    }
  }
  getEmptyAnalytics() {
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
  cleanupOldMetrics() {
    const cutoff = Date.now() - 86400000;
    this.metrics.forEach((metrics, operation) => {
      const filtered = metrics.filter(m => m.timestamp >= cutoff);
      if (filtered.length !== metrics.length) {
        this.metrics.set(operation, filtered);
      }
    });
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
          .run(Date.now() - 604800000);
      } catch (error) {
        console.error('Failed to cleanup old metrics:', error);
      }
    }
  }
  performanceHealthCheck() {
    const metrics = this.getRealTimeMetrics();
    if (metrics.systemHealth === 'critical') {
      this.emit('system-health-critical', metrics);
    } else if (metrics.systemHealth === 'warning') {
      this.emit('system-health-warning', metrics);
    }
    this.autoResolveAlerts();
  }
  autoResolveAlerts() {
    const now = Date.now();
    const autoResolveAge = 1800000;
    this.activeAlerts.forEach((alert, id) => {
      if (!alert.resolved && now - alert.timestamp > autoResolveAge) {
        alert.resolved = true;
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
          } catch (error) {}
        }
        this.emit('alert-auto-resolved', alert);
      }
    });
  }
}
exports.SearchMetrics = SearchMetrics;
exports.default = SearchMetrics;
//# sourceMappingURL=SearchMetrics.js.map
