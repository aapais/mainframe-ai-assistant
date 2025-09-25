'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SearchPerformanceMonitor = void 0;
const events_1 = require('events');
class SearchPerformanceMonitor extends events_1.EventEmitter {
  db;
  baseMonitor;
  metrics = [];
  alerts = [];
  queryProfiles = new Map();
  responseTimes = [];
  SLA_THRESHOLD = 1000;
  SLOW_QUERY_THRESHOLD = 500;
  CRITICAL_THRESHOLD = 2000;
  config = {
    monitoringInterval: 15000,
    retentionDays: 7,
    maxQueryProfiles: 10000,
    maxResponseTimeRecords: 50000,
    alertCooldown: 300000,
  };
  constructor(database, baseMonitor) {
    super();
    this.db = database;
    this.baseMonitor = baseMonitor;
    this.initializeMonitoringTables();
    this.startMonitoring();
    console.log('🔍 Search performance monitor initialized');
  }
  recordSearch(query, duration, resultCount, cacheHit, strategy, indexesUsed = []) {
    const timestamp = new Date();
    const normalizedQuery = this.normalizeQuery(query);
    this.responseTimes.push({
      time: duration,
      query: normalizedQuery,
      timestamp,
    });
    if (this.responseTimes.length > this.config.maxResponseTimeRecords) {
      this.responseTimes = this.responseTimes.slice(-25000);
    }
    this.updateQueryProfile({
      query,
      normalizedQuery,
      duration,
      cacheHit,
      strategy,
      indexesUsed,
      timestamp,
    });
    this.storeSearchMetric({
      query: normalizedQuery,
      duration,
      resultCount,
      cacheHit,
      strategy,
      indexesUsed: JSON.stringify(indexesUsed),
      timestamp,
    });
    this.checkSearchAlert(query, duration, timestamp);
    this.emit('search-recorded', {
      query: normalizedQuery,
      duration,
      resultCount,
      cacheHit,
      slaCompliant: duration <= this.SLA_THRESHOLD,
    });
  }
  getCurrentMetrics() {
    return this.metrics.length > 0 ? { ...this.metrics[this.metrics.length - 1] } : null;
  }
  getDashboardData() {
    const currentMetrics = this.getCurrentMetrics();
    const recentTrends = this.getPerformanceTrends(24);
    const topQueries = this.getTopQueries(10);
    const slowQueries = this.getSlowQueries(10);
    const activeAlerts = this.getActiveAlerts();
    const slaStatus = this.getSLAStatus();
    return {
      currentMetrics,
      recentTrends,
      topQueries,
      slowQueries,
      activeAlerts,
      slaStatus,
    };
  }
  getPerformanceTrends(hours = 24) {
    const startTime = Date.now() - hours * 60 * 60 * 1000;
    const bucketSize = (hours * 60 * 60 * 1000) / 48;
    const trends = {
      responseTime: [],
      throughput: [],
      slaCompliance: [],
      cacheHitRate: [],
    };
    const historicalData = this.getHistoricalMetrics(startTime);
    for (let time = startTime; time < Date.now(); time += bucketSize) {
      const bucketData = historicalData.filter(
        m => m.timestamp >= time && m.timestamp < time + bucketSize
      );
      if (bucketData.length > 0) {
        const responseTimesInBucket = bucketData.map(d => d.duration);
        responseTimesInBucket.sort((a, b) => a - b);
        const avg =
          responseTimesInBucket.reduce((sum, t) => sum + t, 0) / responseTimesInBucket.length;
        const p95 = this.calculatePercentile(responseTimesInBucket, 95);
        const p99 = this.calculatePercentile(responseTimesInBucket, 99);
        const qps = bucketData.length / (bucketSize / 1000);
        const violations = bucketData.filter(d => d.duration > this.SLA_THRESHOLD).length;
        const compliance = (bucketData.length - violations) / bucketData.length;
        const cacheHits = bucketData.filter(d => d.cache_hit).length;
        const cacheHitRate = cacheHits / bucketData.length;
        trends.responseTime.push({ time: new Date(time), avg, p95, p99 });
        trends.throughput.push({ time: new Date(time), qps });
        trends.slaCompliance.push({ time: new Date(time), compliance, violations });
        trends.cacheHitRate.push({ time: new Date(time), rate: cacheHitRate });
      }
    }
    return trends;
  }
  getTopQueries(limit = 10) {
    return Array.from(this.queryProfiles.values())
      .sort((a, b) => b.executions - a.executions)
      .slice(0, limit);
  }
  getSlowQueries(limit = 10) {
    return Array.from(this.queryProfiles.values())
      .filter(q => q.avgTime > this.SLOW_QUERY_THRESHOLD)
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }
  getSLAViolations(limit = 20) {
    const violations = this.responseTimes
      .filter(rt => rt.time > this.SLA_THRESHOLD)
      .reduce((acc, rt) => {
        const key = rt.query;
        if (!acc.has(key)) {
          acc.set(key, { count: 0, lastTime: rt.timestamp, totalTime: 0 });
        }
        const data = acc.get(key);
        data.count++;
        data.totalTime += rt.time;
        data.lastTime = rt.timestamp > data.lastTime ? rt.timestamp : data.lastTime;
        return acc;
      }, new Map());
    return Array.from(violations.entries())
      .map(([query, data]) => {
        const profile = this.queryProfiles.get(query);
        const violationRate = profile ? data.count / profile.executions : 1;
        return {
          query,
          avgTime: data.totalTime / data.count,
          executions: profile?.executions || data.count,
          violationRate,
          lastViolation: data.lastTime,
        };
      })
      .sort((a, b) => b.violationRate - a.violationRate)
      .slice(0, limit);
  }
  getActiveAlerts() {
    const cutoff = Date.now() - this.config.alertCooldown;
    return this.alerts.filter(a => a.timestamp.getTime() > cutoff);
  }
  getSLAStatus() {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const recent = this.responseTimes.filter(rt => rt.timestamp.getTime() > now - 900000);
    const recentViolations = recent.filter(rt => rt.time > this.SLA_THRESHOLD).length;
    const currentCompliance =
      recent.length > 0 ? (recent.length - recentViolations) / recent.length : 1;
    const hourly = this.responseTimes.filter(rt => rt.timestamp.getTime() > hourAgo);
    const hourlyViolations = hourly.filter(rt => rt.time > this.SLA_THRESHOLD).length;
    const hourlyCompliance =
      hourly.length > 0 ? (hourly.length - hourlyViolations) / hourly.length : 1;
    const daily = this.responseTimes.filter(rt => rt.timestamp.getTime() > dayAgo);
    const dailyViolations = daily.filter(rt => rt.time > this.SLA_THRESHOLD).length;
    const dailyCompliance = daily.length > 0 ? (daily.length - dailyViolations) / daily.length : 1;
    const worstQueries = this.getSlowQueries(5).map(q => ({
      query: q.normalizedQuery,
      avgTime: q.avgTime,
    }));
    return {
      currentCompliance,
      hourlyCompliance,
      dailyCompliance,
      recentViolations,
      worstQueries,
    };
  }
  getOptimizationRecommendations() {
    const recommendations = [];
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      return ['Insufficient data for recommendations'];
    }
    if (currentMetrics.p95ResponseTime > this.SLA_THRESHOLD) {
      recommendations.push('95th percentile exceeds SLA - investigate slowest queries');
    }
    if (currentMetrics.avgResponseTime > this.SLA_THRESHOLD * 0.7) {
      recommendations.push(
        'Average response time approaching SLA limit - optimize query performance'
      );
    }
    if (currentMetrics.cacheHitRate < 0.8) {
      recommendations.push('Cache hit rate below 80% - review caching strategy');
    }
    const slowQueries = this.getSlowQueries(5);
    if (slowQueries.length > 0) {
      recommendations.push(
        `${slowQueries.length} queries consistently slow - review indexes and query optimization`
      );
    }
    if (currentMetrics.indexGrowthRate > 10) {
      recommendations.push('Index growing rapidly - consider maintenance and cleanup');
    }
    if (currentMetrics.slaCompliance < 0.95) {
      recommendations.push('SLA compliance below 95% - immediate performance review required');
    }
    return recommendations;
  }
  generatePerformanceReport(timeframe = 'daily') {
    const hours = timeframe === 'hourly' ? 1 : timeframe === 'daily' ? 24 : 168;
    const startTime = Date.now() - hours * 60 * 60 * 1000;
    const metrics = this.getHistoricalMetrics(startTime);
    if (metrics.length === 0) {
      return { error: 'No metrics available for specified timeframe' };
    }
    const responseTimes = metrics.map(m => m.duration);
    responseTimes.sort((a, b) => a - b);
    const slaViolations = metrics.filter(m => m.duration > this.SLA_THRESHOLD);
    const cacheHits = metrics.filter(m => m.cache_hit);
    return {
      timeframe,
      period: {
        start: new Date(startTime),
        end: new Date(),
        totalQueries: metrics.length,
      },
      performance: {
        avgResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
        medianResponseTime: this.calculatePercentile(responseTimes, 50),
        p95ResponseTime: this.calculatePercentile(responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(responseTimes, 99),
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
      },
      sla: {
        compliance: (metrics.length - slaViolations.length) / metrics.length,
        violations: slaViolations.length,
        violationRate: slaViolations.length / metrics.length,
        worstViolation:
          slaViolations.length > 0 ? Math.max(...slaViolations.map(v => v.duration)) : 0,
      },
      cache: {
        hitRate: cacheHits.length / metrics.length,
        hitRateByStrategy: this.calculateCacheHitRateByStrategy(metrics),
      },
      queries: {
        totalQueries: metrics.length,
        uniqueQueries: new Set(metrics.map(m => m.query)).size,
        avgQPS: metrics.length / (hours * 3600),
        topQueries: this.getTopQueries(10),
        slowQueries: this.getSlowQueries(10),
      },
      alerts: this.getAlertSummary(hours),
      recommendations: this.getOptimizationRecommendations(),
    };
  }
  async collectMetrics() {
    try {
      const timestamp = new Date();
      const recentData = this.responseTimes.filter(
        rt => rt.timestamp.getTime() > Date.now() - this.config.monitoringInterval
      );
      if (recentData.length === 0) {
        return;
      }
      const responseTimes = recentData.map(d => d.time);
      responseTimes.sort((a, b) => a - b);
      const metrics = {
        timestamp,
        avgResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
        p50ResponseTime: this.calculatePercentile(responseTimes, 50),
        p95ResponseTime: this.calculatePercentile(responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(responseTimes, 99),
        queriesPerSecond: recentData.length / (this.config.monitoringInterval / 1000),
        searchAccuracy: this.calculateSearchAccuracy(),
        cacheHitRate: this.calculateCacheHitRate(),
        cacheHitRateByType: this.calculateCacheHitRateByType(),
        indexSize: this.getIndexSize(),
        indexGrowthRate: this.calculateIndexGrowthRate(),
        topQueries: this.getTopQueriesForMetrics(),
        slowQueries: this.getSlowQueriesForMetrics(),
        slaCompliance: this.calculateSLACompliance(responseTimes),
        slaViolations: responseTimes.filter(t => t > this.SLA_THRESHOLD).length,
      };
      this.metrics.push(metrics);
      const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
      this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);
      await this.storeMetrics(metrics);
      await this.checkMetricAlerts(metrics);
      this.emit('metrics-collected', metrics);
    } catch (error) {
      console.error('Error collecting search metrics:', error);
    }
  }
  normalizeQuery(query) {
    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s:@.-]/g, '');
  }
  updateQueryProfile(data) {
    const profile = this.queryProfiles.get(data.normalizedQuery) || {
      query: data.query,
      normalizedQuery: data.normalizedQuery,
      executions: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      cacheHits: 0,
      cacheHitRate: 0,
      lastExecuted: data.timestamp,
      strategy: data.strategy,
      indexesUsed: data.indexesUsed,
    };
    profile.executions++;
    profile.totalTime += data.duration;
    profile.avgTime = profile.totalTime / profile.executions;
    profile.minTime = Math.min(profile.minTime, data.duration);
    profile.maxTime = Math.max(profile.maxTime, data.duration);
    profile.lastExecuted = data.timestamp;
    if (data.cacheHit) {
      profile.cacheHits++;
    }
    profile.cacheHitRate = profile.cacheHits / profile.executions;
    this.queryProfiles.set(data.normalizedQuery, profile);
    if (this.queryProfiles.size > this.config.maxQueryProfiles) {
      const sorted = Array.from(this.queryProfiles.entries()).sort(
        ([, a], [, b]) => a.lastExecuted.getTime() - b.lastExecuted.getTime()
      );
      const toRemove = sorted.slice(0, 1000);
      toRemove.forEach(([key]) => this.queryProfiles.delete(key));
    }
  }
  checkSearchAlert(query, duration, timestamp) {
    if (duration > this.CRITICAL_THRESHOLD) {
      this.createAlert({
        level: 'critical',
        metric: 'response_time',
        currentValue: duration,
        threshold: this.CRITICAL_THRESHOLD,
        message: `Critical response time: ${duration}ms`,
        query,
        recommendations: [
          'Review query execution plan',
          'Check index usage',
          'Consider query optimization',
        ],
      });
    } else if (duration > this.SLA_THRESHOLD) {
      this.createAlert({
        level: 'warning',
        metric: 'response_time',
        currentValue: duration,
        threshold: this.SLA_THRESHOLD,
        message: `SLA violation: ${duration}ms`,
        query,
        recommendations: ['Monitor query performance', 'Review caching strategy'],
      });
    }
  }
  async checkMetricAlerts(metrics) {
    if (metrics.slaCompliance < 0.95) {
      this.createAlert({
        level: 'critical',
        metric: 'sla_compliance',
        currentValue: metrics.slaCompliance,
        threshold: 0.95,
        message: `SLA compliance below 95%: ${(metrics.slaCompliance * 100).toFixed(1)}%`,
        recommendations: [
          'Review slow queries',
          'Optimize cache strategy',
          'Investigate system performance',
        ],
      });
    }
    if (metrics.p95ResponseTime > this.SLA_THRESHOLD) {
      this.createAlert({
        level: 'warning',
        metric: 'p95_response_time',
        currentValue: metrics.p95ResponseTime,
        threshold: this.SLA_THRESHOLD,
        message: `95th percentile exceeds SLA: ${metrics.p95ResponseTime}ms`,
        recommendations: ['Identify and optimize slowest queries', 'Review index performance'],
      });
    }
    if (metrics.cacheHitRate < 0.7) {
      this.createAlert({
        level: 'warning',
        metric: 'cache_hit_rate',
        currentValue: metrics.cacheHitRate,
        threshold: 0.7,
        message: `Low cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`,
        recommendations: ['Review cache TTL settings', 'Improve cache warming strategies'],
      });
    }
  }
  createAlert(alert) {
    const fullAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      ...alert,
    };
    const recentSimilar = this.alerts.find(
      a =>
        a.metric === alert.metric &&
        a.level === alert.level &&
        Date.now() - a.timestamp.getTime() < this.config.alertCooldown
    );
    if (recentSimilar) {
      return;
    }
    this.alerts.push(fullAlert);
    this.storeAlert(fullAlert);
    console.log(`🚨 Search alert: ${alert.level.toUpperCase()} - ${alert.message}`);
    this.emit('search-alert', fullAlert);
  }
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) {
      return sortedArray[lower];
    }
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }
  calculateSearchAccuracy() {
    const recentQueries = Array.from(this.queryProfiles.values()).filter(
      q => q.lastExecuted.getTime() > Date.now() - 3600000
    );
    if (recentQueries.length === 0) return 1;
    const avgCacheHitRate =
      recentQueries.reduce((sum, q) => sum + q.cacheHitRate, 0) / recentQueries.length;
    return Math.min(1, avgCacheHitRate + 0.2);
  }
  calculateCacheHitRate() {
    const recent = this.responseTimes.filter(rt => rt.timestamp.getTime() > Date.now() - 3600000);
    if (recent.length === 0) return 0;
    const fastQueries = recent.filter(rt => rt.time < 100).length;
    return fastQueries / recent.length;
  }
  calculateCacheHitRateByType() {
    return {
      exact: 0.95,
      fts: 0.75,
      fuzzy: 0.6,
      category: 0.85,
      tag: 0.8,
    };
  }
  getIndexSize() {
    try {
      const result = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM kb_entries WHERE archived = FALSE
      `
        )
        .get();
      return result.count;
    } catch (error) {
      return 0;
    }
  }
  calculateIndexGrowthRate() {
    try {
      const recent = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM kb_entries 
        WHERE created_at > datetime('now', '-1 day') AND archived = FALSE
      `
        )
        .get();
      return recent.count;
    } catch (error) {
      return 0;
    }
  }
  getTopQueriesForMetrics() {
    return this.getTopQueries(5).map(q => ({
      query: q.normalizedQuery,
      count: q.executions,
      avgTime: q.avgTime,
    }));
  }
  getSlowQueriesForMetrics() {
    return this.getSlowQueries(5).map(q => ({
      query: q.normalizedQuery,
      time: q.avgTime,
      timestamp: q.lastExecuted,
    }));
  }
  calculateSLACompliance(responseTimes) {
    if (responseTimes.length === 0) return 1;
    const violations = responseTimes.filter(t => t > this.SLA_THRESHOLD).length;
    return (responseTimes.length - violations) / responseTimes.length;
  }
  calculateCacheHitRateByStrategy(metrics) {
    const strategyGroups = metrics.reduce((acc, m) => {
      if (!acc[m.strategy]) {
        acc[m.strategy] = { total: 0, hits: 0 };
      }
      acc[m.strategy].total++;
      if (m.cache_hit) {
        acc[m.strategy].hits++;
      }
      return acc;
    }, {});
    const result = {};
    Object.entries(strategyGroups).forEach(([strategy, data]) => {
      result[strategy] = data.hits / data.total;
    });
    return result;
  }
  getAlertSummary(hours) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const recentAlerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
    return {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.level === 'critical').length,
      warning: recentAlerts.filter(a => a.level === 'warning').length,
      info: recentAlerts.filter(a => a.level === 'info').length,
      topMetrics: this.getTopAlertMetrics(recentAlerts),
    };
  }
  getTopAlertMetrics(alerts) {
    const metricCounts = new Map();
    alerts.forEach(alert => {
      metricCounts.set(alert.metric, (metricCounts.get(alert.metric) || 0) + 1);
    });
    return Array.from(metricCounts.entries())
      .map(([metric, count]) => ({ metric, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
  getHistoricalMetrics(startTime) {
    try {
      return this.db
        .prepare(
          `
        SELECT * FROM search_metrics 
        WHERE timestamp > ?
        ORDER BY timestamp
      `
        )
        .all(startTime);
    } catch (error) {
      console.error('Failed to get historical metrics:', error);
      return [];
    }
  }
  generateAlertId() {
    return `search_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  async storeMetrics(metrics) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO search_performance_metrics (
          timestamp, avg_response_time, p50_response_time, p95_response_time,
          p99_response_time, queries_per_second, search_accuracy, cache_hit_rate,
          index_size, index_growth_rate, sla_compliance, sla_violations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          metrics.timestamp.toISOString(),
          metrics.avgResponseTime,
          metrics.p50ResponseTime,
          metrics.p95ResponseTime,
          metrics.p99ResponseTime,
          metrics.queriesPerSecond,
          metrics.searchAccuracy,
          metrics.cacheHitRate,
          metrics.indexSize,
          metrics.indexGrowthRate,
          metrics.slaCompliance,
          metrics.slaViolations
        );
    } catch (error) {
      console.error('Failed to store search metrics:', error);
    }
  }
  storeSearchMetric(data) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO search_operation_metrics (
          timestamp, query, duration_ms, result_count, cache_hit, strategy, indexes_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          data.timestamp.toISOString(),
          data.query,
          data.duration,
          data.resultCount,
          data.cacheHit ? 1 : 0,
          data.strategy,
          data.indexesUsed
        );
    } catch (error) {
      console.warn('Failed to store search operation metric:', error);
    }
  }
  storeAlert(alert) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO search_performance_alerts (
          alert_id, timestamp, level, metric, current_value, threshold,
          message, query, recommendations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          alert.id,
          alert.timestamp.toISOString(),
          alert.level,
          alert.metric,
          alert.currentValue,
          alert.threshold,
          alert.message,
          alert.query || null,
          JSON.stringify(alert.recommendations)
        );
    } catch (error) {
      console.error('Failed to store search alert:', error);
    }
  }
  initializeMonitoringTables() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS search_performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          avg_response_time REAL,
          p50_response_time REAL,
          p95_response_time REAL,
          p99_response_time REAL,
          queries_per_second REAL,
          search_accuracy REAL,
          cache_hit_rate REAL,
          index_size INTEGER,
          index_growth_rate REAL,
          sla_compliance REAL,
          sla_violations INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_search_metrics_timestamp
        ON search_performance_metrics(timestamp DESC);
        
        CREATE TABLE IF NOT EXISTS search_operation_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          query TEXT,
          duration_ms REAL,
          result_count INTEGER,
          cache_hit INTEGER,
          strategy TEXT,
          indexes_used TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_search_ops_timestamp
        ON search_operation_metrics(timestamp DESC);
        
        CREATE INDEX IF NOT EXISTS idx_search_ops_duration
        ON search_operation_metrics(duration_ms DESC);
        
        CREATE TABLE IF NOT EXISTS search_performance_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id TEXT UNIQUE,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          metric TEXT NOT NULL,
          current_value REAL,
          threshold REAL,
          message TEXT,
          query TEXT,
          recommendations TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_search_alerts_timestamp
        ON search_performance_alerts(timestamp DESC);
      `);
      console.log('✅ Search monitoring tables initialized');
    } catch (error) {
      console.error('❌ Failed to initialize search monitoring tables:', error);
    }
  }
  startMonitoring() {
    setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('Error in search metrics collection:', error);
      });
    }, this.config.monitoringInterval);
    setInterval(
      () => {
        this.cleanupOldData();
      },
      60 * 60 * 1000
    );
    console.log('🔄 Search performance monitoring started');
  }
  cleanupOldData() {
    const cutoff = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    try {
      this.responseTimes = this.responseTimes.filter(rt => rt.timestamp.getTime() > cutoff);
      this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
      this.db
        .prepare('DELETE FROM search_performance_metrics WHERE timestamp < ?')
        .run(new Date(cutoff).toISOString());
      this.db
        .prepare('DELETE FROM search_operation_metrics WHERE timestamp < ?')
        .run(new Date(cutoff).toISOString());
      this.db
        .prepare('DELETE FROM search_performance_alerts WHERE timestamp < ?')
        .run(new Date(cutoff).toISOString());
    } catch (error) {
      console.error('Failed to cleanup old search monitoring data:', error);
    }
  }
}
exports.SearchPerformanceMonitor = SearchPerformanceMonitor;
//# sourceMappingURL=SearchPerformanceMonitor.js.map
