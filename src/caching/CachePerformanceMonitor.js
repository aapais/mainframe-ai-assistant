'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CachePerformanceMonitor = void 0;
const events_1 = require('events');
class CachePerformanceMonitor extends events_1.EventEmitter {
  db;
  cacheManager;
  warmingEngine;
  invalidationManager;
  currentMetrics;
  historicalMetrics = [];
  alerts = [];
  responseTimes = [];
  targets = new Map();
  config = {
    monitoringInterval: 30000,
    alertThresholds: {
      responseTimeWarning: 500,
      responseTimeCritical: 1000,
      hitRateWarning: 0.7,
      hitRateCritical: 0.5,
      memoryWarning: 0.8,
      memoryCritical: 0.95,
    },
    historyRetention: 24 * 60 * 60 * 1000,
    trendAnalysisWindow: 60,
    alertCooldown: 5 * 60 * 1000,
  };
  constructor(database, cacheManager, warmingEngine, invalidationManager, mvpLevel) {
    super();
    this.db = database;
    this.cacheManager = cacheManager;
    this.warmingEngine = warmingEngine;
    this.invalidationManager = invalidationManager;
    this.setupPerformanceTargets();
    this.initializeMonitoringTables();
    this.startMonitoring();
    this.collectMetrics();
    console.log(`📊 Cache performance monitor initialized for MVP${mvpLevel}`);
  }
  getCurrentMetrics() {
    return { ...this.currentMetrics };
  }
  getHistoricalMetrics(hours = 1) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.historicalMetrics.filter(m => m.timestamp.getTime() > cutoff);
  }
  getActiveAlerts() {
    const cutoff = Date.now() - this.config.alertCooldown;
    return this.alerts.filter(a => a.timestamp.getTime() > cutoff);
  }
  getTrendAnalysis() {
    const trends = [];
    const recentMetrics = this.getHistoricalMetrics(1);
    if (recentMetrics.length < 5) {
      return trends;
    }
    const responseTimeTrend = this.analyzeTrend(
      recentMetrics.map(m => m.avgResponseTime),
      'avgResponseTime'
    );
    trends.push(responseTimeTrend);
    const hitRateTrend = this.analyzeTrend(
      recentMetrics.map(m => m.overallHitRate),
      'overallHitRate'
    );
    trends.push(hitRateTrend);
    const memoryTrend = this.analyzeTrend(
      recentMetrics.map(m => m.memoryUsage),
      'memoryUsage'
    );
    trends.push(memoryTrend);
    return trends;
  }
  recordOperation(operation, duration, cacheHit) {
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    this.storeOperationMetric(operation, duration, cacheHit);
  }
  generateReport(timeframe = 'hourly') {
    const hours = timeframe === 'hourly' ? 1 : timeframe === 'daily' ? 24 : 168;
    const metrics = this.getHistoricalMetrics(hours);
    if (metrics.length === 0) {
      return { error: 'No metrics available for specified timeframe' };
    }
    const report = {
      timeframe,
      period: {
        start: metrics[0].timestamp,
        end: metrics[metrics.length - 1].timestamp,
        dataPoints: metrics.length,
      },
      performance: {
        avgResponseTime: this.calculateAverage(metrics.map(m => m.avgResponseTime)),
        bestResponseTime: Math.min(...metrics.map(m => m.avgResponseTime)),
        worstResponseTime: Math.max(...metrics.map(m => m.avgResponseTime)),
        responseTimeStability: this.calculateStability(metrics.map(m => m.avgResponseTime)),
      },
      hitRates: {
        avgOverallHitRate: this.calculateAverage(metrics.map(m => m.overallHitRate)),
        bestHitRate: Math.max(...metrics.map(m => m.overallHitRate)),
        worstHitRate: Math.min(...metrics.map(m => m.overallHitRate)),
        hitRateStability: this.calculateStability(metrics.map(m => m.overallHitRate)),
      },
      memory: {
        avgMemoryUsage: this.calculateAverage(metrics.map(m => m.memoryUsage)),
        peakMemoryUsage: Math.max(...metrics.map(m => m.memoryUsage)),
        memoryEfficiency: this.calculateAverage(metrics.map(m => m.memoryEfficiency)),
      },
      sla: {
        complianceRate: this.calculateAverage(metrics.map(m => m.slaCompliance)),
        performanceGrade: this.calculateOverallGrade(metrics),
        violations: metrics.filter(m => m.slaCompliance < 0.95).length,
      },
      trends: this.getTrendAnalysis(),
      alerts: this.getAlertSummary(hours),
      recommendations: this.generateRecommendations(metrics),
    };
    return report;
  }
  getOptimizationSuggestions() {
    const suggestions = [];
    const metrics = this.currentMetrics;
    if (metrics.avgResponseTime > this.config.alertThresholds.responseTimeWarning) {
      suggestions.push('Consider increasing hot cache size to improve response times');
      if (metrics.layerHitRates['hot'] < 0.6) {
        suggestions.push('Hot cache hit rate is low - review warming strategies');
      }
    }
    if (metrics.overallHitRate < this.config.alertThresholds.hitRateWarning) {
      suggestions.push('Overall hit rate is below target - review TTL settings');
      suggestions.push('Consider implementing more aggressive cache warming');
    }
    if (metrics.memoryEfficiency < 0.7) {
      suggestions.push('Memory efficiency is low - review cache entry sizes');
      suggestions.push('Consider implementing compression for large cache entries');
    }
    if (metrics.warmingEffectiveness < 0.6) {
      suggestions.push('Cache warming is not effective - review prediction algorithms');
    }
    if (metrics.invalidationAccuracy < 0.8) {
      suggestions.push('Cache invalidation accuracy is low - review invalidation rules');
    }
    return suggestions;
  }
  async collectMetrics() {
    try {
      const timestamp = new Date();
      const cacheMetrics = this.cacheManager.getMetrics();
      const warmingStats = this.warmingEngine.getStats();
      const invalidationStats = this.invalidationManager.getStats();
      const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sortedTimes, 50);
      const p95 = this.calculatePercentile(sortedTimes, 95);
      const p99 = this.calculatePercentile(sortedTimes, 99);
      const layerHitRates = {};
      cacheMetrics.layers.forEach(layer => {
        layerHitRates[layer.name.toLowerCase().replace(/[^a-z0-9]/g, '_')] = layer.hitRate;
      });
      const target = this.targets.get(this.currentMetrics?.mvpLevel || 1);
      const slaCompliance = target ? this.calculateSLACompliance(cacheMetrics, target) : 1;
      const metrics = {
        timestamp,
        mvpLevel: this.currentMetrics?.mvpLevel || 1,
        avgResponseTime: cacheMetrics.avgResponseTime,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        overallHitRate: cacheMetrics.overallHitRate,
        layerHitRates,
        memoryUsage: this.calculateTotalMemoryUsage(cacheMetrics),
        memoryEfficiency: this.calculateMemoryEfficiency(cacheMetrics),
        requestsPerSecond: this.calculateRequestsPerSecond(),
        cacheEventsPerMinute: this.calculateCacheEventsPerMinute(),
        warmingEffectiveness: warmingStats.accuracy || 0,
        invalidationAccuracy: invalidationStats.effectiveness || 0,
        dataFreshness: this.calculateDataFreshness(),
        slaCompliance,
        performanceGrade: this.calculatePerformanceGrade(slaCompliance, cacheMetrics),
      };
      this.currentMetrics = metrics;
      this.historicalMetrics.push(metrics);
      this.cleanupHistoricalMetrics();
      await this.checkAlerts(metrics);
      await this.storeMetrics(metrics);
      this.emit('metrics-updated', metrics);
    } catch (error) {
      console.error('Error collecting cache performance metrics:', error);
    }
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
  calculateTotalMemoryUsage(metrics) {
    return metrics.layers.reduce((total, layer) => total + layer.memoryUsage, 0);
  }
  calculateMemoryEfficiency(metrics) {
    const totalMemory = this.calculateTotalMemoryUsage(metrics);
    const totalSize = metrics.layers.reduce((total, layer) => total + layer.size, 0);
    return totalSize > 0 ? metrics.overallHitRate * (totalSize / Math.max(totalMemory, 1)) : 0;
  }
  calculateRequestsPerSecond() {
    const recentMetrics = this.historicalMetrics.slice(-5);
    if (recentMetrics.length < 2) return 0;
    const timeSpan =
      recentMetrics[recentMetrics.length - 1].timestamp.getTime() -
      recentMetrics[0].timestamp.getTime();
    return timeSpan > 0 ? (this.responseTimes.length * 1000) / timeSpan : 0;
  }
  calculateCacheEventsPerMinute() {
    return (this.responseTimes.length * 60) / (this.config.monitoringInterval / 1000);
  }
  calculateDataFreshness() {
    return Math.max(0.5, 1 - (this.currentMetrics?.avgResponseTime || 0) / 1000);
  }
  calculateSLACompliance(metrics, target) {
    let compliance = 0;
    let criteria = 0;
    if (metrics.avgResponseTime <= target.maxResponseTime) {
      compliance += 0.4;
    }
    criteria += 0.4;
    if (metrics.overallHitRate >= target.minHitRate) {
      compliance += 0.3;
    }
    criteria += 0.3;
    const totalMemory = this.calculateTotalMemoryUsage(metrics);
    if (totalMemory <= target.maxMemoryUsage) {
      compliance += 0.2;
    }
    criteria += 0.2;
    compliance += 0.1;
    criteria += 0.1;
    return criteria > 0 ? compliance / criteria : 1;
  }
  calculatePerformanceGrade(slaCompliance, metrics) {
    if (slaCompliance >= 0.95 && metrics.avgResponseTime < 100) return 'A';
    if (slaCompliance >= 0.9 && metrics.avgResponseTime < 200) return 'B';
    if (slaCompliance >= 0.8 && metrics.avgResponseTime < 500) return 'C';
    if (slaCompliance >= 0.7) return 'D';
    return 'F';
  }
  async checkAlerts(metrics) {
    const now = new Date();
    if (metrics.avgResponseTime > this.config.alertThresholds.responseTimeCritical) {
      await this.createAlert({
        level: 'critical',
        metric: 'avgResponseTime',
        currentValue: metrics.avgResponseTime,
        threshold: this.config.alertThresholds.responseTimeCritical,
        message: 'Average response time is critically high',
        recommendations: [
          'Check hot cache hit rate',
          'Review cache warming strategies',
          'Consider increasing cache sizes',
        ],
      });
    } else if (metrics.avgResponseTime > this.config.alertThresholds.responseTimeWarning) {
      await this.createAlert({
        level: 'warning',
        metric: 'avgResponseTime',
        currentValue: metrics.avgResponseTime,
        threshold: this.config.alertThresholds.responseTimeWarning,
        message: 'Average response time is above warning threshold',
        recommendations: ['Monitor cache hit rates', 'Consider cache optimization'],
      });
    }
    if (metrics.overallHitRate < this.config.alertThresholds.hitRateCritical) {
      await this.createAlert({
        level: 'critical',
        metric: 'overallHitRate',
        currentValue: metrics.overallHitRate,
        threshold: this.config.alertThresholds.hitRateCritical,
        message: 'Cache hit rate is critically low',
        recommendations: [
          'Review TTL settings',
          'Improve cache warming',
          'Check invalidation patterns',
        ],
      });
    }
    const memoryUtilization = metrics.memoryUsage / (256 * 1024 * 1024);
    if (memoryUtilization > this.config.alertThresholds.memoryCritical) {
      await this.createAlert({
        level: 'critical',
        metric: 'memoryUsage',
        currentValue: memoryUtilization,
        threshold: this.config.alertThresholds.memoryCritical,
        message: 'Memory usage is critically high',
        recommendations: [
          'Review cache sizes',
          'Implement cache compression',
          'Optimize eviction policies',
        ],
      });
    }
  }
  async createAlert(alert) {
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
    await this.storeAlert(fullAlert);
    console.log(`🚨 Cache performance alert: ${alert.level.toUpperCase()} - ${alert.message}`);
    this.emit('performance-alert', fullAlert);
  }
  analyzeTrend(values, metric) {
    if (values.length < 3) {
      return {
        metric,
        trend: 'stable',
        changeRate: 0,
        projection: values[values.length - 1] || 0,
        confidence: 0,
      };
    }
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const changeRate = Math.abs(slope);
    let trend;
    if (changeRate < 0.01) {
      trend = 'stable';
    } else if (
      (metric === 'overallHitRate' && slope > 0) ||
      (metric === 'avgResponseTime' && slope < 0) ||
      (metric === 'memoryUsage' && slope < 0)
    ) {
      trend = 'improving';
    } else {
      trend = 'degrading';
    }
    const yMean = sumY / n;
    const totalVariance = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const residualVariance = values.reduce((sum, val, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const rSquared = totalVariance > 0 ? 1 - residualVariance / totalVariance : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));
    const projection = intercept + slope * n;
    return {
      metric,
      trend,
      changeRate,
      projection,
      confidence,
    };
  }
  calculateAverage(values) {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }
  calculateStability(values) {
    if (values.length < 2) return 1;
    const avg = this.calculateAverage(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return avg > 0 ? Math.max(0, 1 - stdDev / avg) : 1;
  }
  calculateOverallGrade(metrics) {
    const grades = metrics.map(m => m.performanceGrade);
    const gradeScores = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    const avgScore = grades.reduce((sum, grade) => sum + gradeScores[grade], 0) / grades.length;
    if (avgScore >= 3.5) return 'A';
    if (avgScore >= 2.5) return 'B';
    if (avgScore >= 1.5) return 'C';
    if (avgScore >= 0.5) return 'D';
    return 'F';
  }
  getAlertSummary(hours) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const recentAlerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
    const summary = {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.level === 'critical').length,
      warning: recentAlerts.filter(a => a.level === 'warning').length,
      info: recentAlerts.filter(a => a.level === 'info').length,
      topMetrics: this.getTopAlertMetrics(recentAlerts),
    };
    return summary;
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
  generateRecommendations(metrics) {
    const recommendations = [];
    if (metrics.length === 0) return recommendations;
    const latest = metrics[metrics.length - 1];
    const avgResponseTime = this.calculateAverage(metrics.map(m => m.avgResponseTime));
    const avgHitRate = this.calculateAverage(metrics.map(m => m.overallHitRate));
    if (avgResponseTime > 200) {
      recommendations.push(
        'Response time is consistently high - consider cache architecture review'
      );
    }
    if (avgHitRate < 0.7) {
      recommendations.push('Hit rate is below target - optimize warming and TTL strategies');
    }
    if (latest.memoryEfficiency < 0.6) {
      recommendations.push('Memory efficiency is low - review cache entry sizes and compression');
    }
    return recommendations;
  }
  setupPerformanceTargets() {
    this.targets.set(1, {
      mvpLevel: 1,
      maxResponseTime: 1000,
      minHitRate: 0.8,
      maxMemoryUsage: 100 * 1024 * 1024,
      maxEvictionRate: 10,
    });
    this.targets.set(2, {
      mvpLevel: 2,
      maxResponseTime: 800,
      minHitRate: 0.82,
      maxMemoryUsage: 150 * 1024 * 1024,
      maxEvictionRate: 8,
    });
    this.targets.set(3, {
      mvpLevel: 3,
      maxResponseTime: 500,
      minHitRate: 0.85,
      maxMemoryUsage: 200 * 1024 * 1024,
      maxEvictionRate: 6,
    });
    this.targets.set(4, {
      mvpLevel: 4,
      maxResponseTime: 300,
      minHitRate: 0.88,
      maxMemoryUsage: 250 * 1024 * 1024,
      maxEvictionRate: 4,
    });
    this.targets.set(5, {
      mvpLevel: 5,
      maxResponseTime: 200,
      minHitRate: 0.9,
      maxMemoryUsage: 512 * 1024 * 1024,
      maxEvictionRate: 2,
    });
  }
  cleanupHistoricalMetrics() {
    const cutoff = Date.now() - this.config.historyRetention;
    this.historicalMetrics = this.historicalMetrics.filter(m => m.timestamp.getTime() > cutoff);
  }
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  async storeMetrics(metrics) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO cache_performance_metrics (
          timestamp, mvp_level, avg_response_time, p50_response_time,
          p95_response_time, p99_response_time, overall_hit_rate,
          memory_usage, memory_efficiency, requests_per_second,
          warming_effectiveness, invalidation_accuracy, sla_compliance,
          performance_grade
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          metrics.timestamp.toISOString(),
          metrics.mvpLevel,
          metrics.avgResponseTime,
          metrics.p50ResponseTime,
          metrics.p95ResponseTime,
          metrics.p99ResponseTime,
          metrics.overallHitRate,
          metrics.memoryUsage,
          metrics.memoryEfficiency,
          metrics.requestsPerSecond,
          metrics.warmingEffectiveness,
          metrics.invalidationAccuracy,
          metrics.slaCompliance,
          metrics.performanceGrade
        );
    } catch (error) {
      console.error('Failed to store performance metrics:', error);
    }
  }
  async storeAlert(alert) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO cache_performance_alerts (
          alert_id, timestamp, level, metric, current_value,
          threshold, message, recommendations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
          JSON.stringify(alert.recommendations)
        );
    } catch (error) {
      console.error('Failed to store performance alert:', error);
    }
  }
  async storeOperationMetric(operation, duration, cacheHit) {
    try {
      this.db
        .prepare(
          `
        INSERT INTO cache_operation_metrics (
          timestamp, operation, duration_ms, cache_hit
        ) VALUES (datetime('now'), ?, ?, ?)
      `
        )
        .run(operation, duration, cacheHit ? 1 : 0);
    } catch (error) {
      console.warn('Failed to store operation metric:', error);
    }
  }
  initializeMonitoringTables() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache_performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          mvp_level INTEGER,
          avg_response_time REAL,
          p50_response_time REAL,
          p95_response_time REAL,
          p99_response_time REAL,
          overall_hit_rate REAL,
          memory_usage INTEGER,
          memory_efficiency REAL,
          requests_per_second REAL,
          warming_effectiveness REAL,
          invalidation_accuracy REAL,
          sla_compliance REAL,
          performance_grade TEXT
        )
      `);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache_performance_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id TEXT UNIQUE,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          metric TEXT NOT NULL,
          current_value REAL,
          threshold REAL,
          message TEXT,
          recommendations TEXT
        )
      `);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache_operation_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          operation TEXT,
          duration_ms REAL,
          cache_hit INTEGER
        )
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_perf_metrics_timestamp
        ON cache_performance_metrics(timestamp DESC)
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_perf_alerts_timestamp
        ON cache_performance_alerts(timestamp DESC)
      `);
      console.log('✅ Performance monitoring tables initialized');
    } catch (error) {
      console.error('❌ Failed to initialize monitoring tables:', error);
    }
  }
  startMonitoring() {
    setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('Error in metrics collection:', error);
      });
    }, this.config.monitoringInterval);
    setInterval(
      () => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
      },
      60 * 60 * 1000
    );
    console.log('🔄 Performance monitoring started');
  }
}
exports.CachePerformanceMonitor = CachePerformanceMonitor;
//# sourceMappingURL=CachePerformanceMonitor.js.map
