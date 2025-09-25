'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.OptimizationMetricsAggregator = void 0;
const events_1 = require('events');
class OptimizationMetricsAggregator extends events_1.EventEmitter {
  optimizationEngine;
  config;
  rawMetrics = [];
  aggregatedMetrics = new Map();
  snapshots = new Map();
  aggregationInterval;
  anomalyDetector;
  constructor(optimizationEngine, config = {}) {
    super();
    this.optimizationEngine = optimizationEngine;
    this.config = {
      aggregationInterval: 15,
      retentionPeriod: 30,
      anomalyThreshold: 2.5,
      enablePredictions: true,
      enableRealTimeAlerts: true,
      categories: ['performance', 'search', 'cache', 'database', 'memory'],
      customThresholds: {},
      ...config,
    };
    this.setupEngineEventHandlers();
  }
  async initialize() {
    console.log('Initializing OptimizationMetricsAggregator...');
    this.initializeAnomalyDetector();
    this.startPeriodicAggregation();
    await this.performAggregation('initial');
    console.log('OptimizationMetricsAggregator initialized');
  }
  recordMetric(metric) {
    this.rawMetrics.push({
      ...metric,
      timestamp: Date.now(),
    });
    this.cleanupOldMetrics();
    if (this.config.enableRealTimeAlerts) {
      this.checkRealTimeAnomalies(metric);
    }
    this.emit('metric-recorded', metric);
  }
  async performAggregation(type = 'scheduled') {
    const timestamp = Date.now();
    const period = this.getCurrentPeriod();
    console.log(`Performing metrics aggregation (${type})...`);
    const aggregated = await this.aggregateMetrics(period);
    this.aggregatedMetrics.set(period, aggregated);
    const snapshot = {
      id: `snapshot-${timestamp}`,
      timestamp,
      type,
      metrics: this.getRecentMetrics(this.config.aggregationInterval * 60 * 1000),
      aggregated,
      insights: this.generateMetricsInsights(aggregated),
      alerts: this.checkMetricsAlerts(aggregated),
    };
    this.snapshots.set(snapshot.id, snapshot);
    this.emit('aggregation-completed', {
      aggregated,
      snapshot,
      type,
    });
    if (snapshot.alerts.length > 0) {
      this.emit('metrics-alerts', snapshot.alerts);
    }
    return aggregated;
  }
  getAggregatedMetrics(period) {
    const targetPeriod = period || this.getCurrentPeriod();
    return this.aggregatedMetrics.get(targetPeriod) || null;
  }
  getSnapshots(limit = 10) {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  getMetricsForTimeRange(startTime, endTime) {
    return this.rawMetrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
  }
  getTrendingMetrics(category, timeWindow = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeWindow;
    const metrics = this.rawMetrics.filter(m => m.timestamp >= cutoff);
    const filtered = category ? metrics.filter(m => m.category === category) : metrics;
    if (filtered.length < 2) {
      return { trend: 'stable', change: 0, confidence: 0 };
    }
    const hourlyData = this.groupMetricsByHour(filtered);
    const trend = this.calculateTrendDirection(hourlyData);
    const change = this.calculateTrendChange(hourlyData);
    return {
      trend,
      change,
      confidence: this.calculateTrendConfidence(hourlyData),
      dataPoints: hourlyData.size,
      category: category || 'all',
    };
  }
  getAnomalies(timeWindow = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.rawMetrics.filter(m => m.timestamp >= cutoff);
    return this.detectAnomalies(recentMetrics);
  }
  getPerformancePredictions() {
    if (!this.config.enablePredictions) {
      return null;
    }
    const recentMetrics = this.getRecentMetrics(7 * 24 * 60 * 60 * 1000);
    return this.generatePredictions(recentMetrics);
  }
  generateMetricsReport(period = '24h') {
    const timeWindow = this.parseTimeWindow(period);
    const metrics = this.getMetricsForTimeRange(Date.now() - timeWindow, Date.now());
    if (metrics.length === 0) {
      return {
        period,
        summary: { noData: true },
        categories: {},
        trends: {},
        anomalies: [],
        insights: ['No data available for the selected period'],
      };
    }
    const summary = this.generateMetricsSummary(metrics);
    const categories = this.generateCategoryAnalysis(metrics);
    const trends = this.generateTrendAnalysis(metrics);
    const anomalies = this.detectAnomalies(metrics);
    const insights = this.generateAdvancedInsights(metrics, trends, anomalies);
    return {
      period,
      timeWindow,
      dataPoints: metrics.length,
      summary,
      categories,
      trends,
      anomalies,
      insights,
      generatedAt: Date.now(),
    };
  }
  setupEngineEventHandlers() {
    this.optimizationEngine.on('analysis-completed', data => {
      if (data.metrics) {
        Object.values(data.metrics).forEach(categoryMetrics => {
          if (Array.isArray(categoryMetrics)) {
            categoryMetrics.forEach(metric => this.recordMetric(metric));
          }
        });
      }
    });
    this.optimizationEngine.on('recommendation-applied', data => {
      this.recordMetric({
        timestamp: Date.now(),
        category: 'optimization',
        metric: 'recommendation_applied',
        value: 1,
        unit: 'count',
        trend: 'improving',
        severity: 'low',
      });
    });
    this.optimizationEngine.on('optimization-results-measured', recommendation => {
      if (recommendation.results?.success) {
        this.recordMetric({
          timestamp: Date.now(),
          category: 'optimization',
          metric: 'optimization_improvement',
          value: recommendation.results.actualImprovement,
          unit: 'percent',
          trend: 'improving',
          severity: 'low',
        });
      }
    });
  }
  initializeAnomalyDetector() {
    this.anomalyDetector = {
      threshold: this.config.anomalyThreshold,
      enabled: true,
      history: new Map(),
    };
  }
  startPeriodicAggregation() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    this.aggregationInterval = setInterval(
      async () => {
        await this.performAggregation('scheduled');
      },
      this.config.aggregationInterval * 60 * 1000
    );
  }
  async aggregateMetrics(period) {
    const periodStart = this.getPeriodStart(period);
    const periodMetrics = this.rawMetrics.filter(m => m.timestamp >= periodStart);
    const categories = this.aggregateByCategory(periodMetrics);
    const systemOverview = this.calculateSystemOverview(periodMetrics);
    const trends = this.calculateTrends(periodMetrics);
    const anomalies = this.detectAnomalies(periodMetrics);
    const predictions = this.config.enablePredictions
      ? this.generatePredictions(periodMetrics)
      : null;
    return {
      timestamp: Date.now(),
      period,
      totalMetrics: periodMetrics.length,
      categories,
      systemOverview,
      trends,
      anomalies,
      predictions: predictions || { shortTerm: null, longTerm: null },
    };
  }
  aggregateByCategory(metrics) {
    const categories = {};
    this.config.categories.forEach(category => {
      const categoryMetrics = metrics.filter(m => m.category === category);
      if (categoryMetrics.length === 0) {
        categories[category] = {
          count: 0,
          averageValue: 0,
          minValue: 0,
          maxValue: 0,
          trend: 'stable',
          variance: 0,
        };
        return;
      }
      const values = categoryMetrics.map(m => m.value);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const variance = this.calculateVariance(values, avg);
      categories[category] = {
        count: categoryMetrics.length,
        averageValue: avg,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        trend: this.determineCategoryTrend(categoryMetrics),
        variance,
      };
    });
    return categories;
  }
  calculateSystemOverview(metrics) {
    if (metrics.length === 0) {
      return {
        healthScore: 100,
        performanceIndex: 100,
        efficiencyRating: 100,
        stabilityScore: 100,
      };
    }
    const severityCounts = {
      low: metrics.filter(m => m.severity === 'low').length,
      medium: metrics.filter(m => m.severity === 'medium').length,
      high: metrics.filter(m => m.severity === 'high').length,
      critical: metrics.filter(m => m.severity === 'critical').length,
    };
    const healthScore = Math.max(
      0,
      100 - severityCounts.medium * 5 - severityCounts.high * 15 - severityCounts.critical * 30
    );
    const improvingCount = metrics.filter(m => m.trend === 'improving').length;
    const degradingCount = metrics.filter(m => m.trend === 'degrading').length;
    const performanceIndex = Math.max(
      0,
      100 + ((improvingCount - degradingCount) / metrics.length) * 50
    );
    const avgValue = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
    const targetValue = 100;
    const efficiencyRating = Math.min(100, (targetValue / Math.max(avgValue, 1)) * 100);
    const values = metrics.map(m => m.value);
    const variance = this.calculateVariance(values);
    const stabilityScore = Math.max(0, 100 - variance * 10);
    return {
      healthScore: Math.round(healthScore),
      performanceIndex: Math.round(performanceIndex),
      efficiencyRating: Math.round(efficiencyRating),
      stabilityScore: Math.round(stabilityScore),
    };
  }
  calculateTrends(metrics) {
    const hourly = this.groupMetricsByHour(metrics);
    const daily = this.groupMetricsByDay(metrics);
    const weekly = this.groupMetricsByWeek(metrics);
    return {
      hourly: this.convertMapToRecord(hourly),
      daily: this.convertMapToRecord(daily),
      weekly: this.convertMapToRecord(weekly),
    };
  }
  detectAnomalies(metrics) {
    const anomalies = [];
    const metricGroups = new Map();
    metrics.forEach(metric => {
      const key = `${metric.category}:${metric.metric}`;
      if (!metricGroups.has(key)) {
        metricGroups.set(key, []);
      }
      metricGroups.get(key).push(metric);
    });
    metricGroups.forEach((groupMetrics, key) => {
      if (groupMetrics.length < 5) return;
      const values = groupMetrics.map(m => m.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(this.calculateVariance(values, mean));
      groupMetrics.forEach(metric => {
        const zScore = Math.abs((metric.value - mean) / stdDev);
        if (zScore > this.config.anomalyThreshold) {
          anomalies.push({
            id: `anomaly-${metric.timestamp}`,
            timestamp: metric.timestamp,
            category: metric.category,
            metric: metric.metric,
            value: metric.value,
            expectedRange: {
              min: mean - stdDev * this.config.anomalyThreshold,
              max: mean + stdDev * this.config.anomalyThreshold,
            },
            severity: zScore > 3 ? 'high' : 'medium',
            zScore,
            description: `${key} value ${metric.value} is ${zScore.toFixed(1)} standard deviations from mean`,
          });
        }
      });
    });
    return anomalies.sort((a, b) => b.zScore - a.zScore);
  }
  generatePredictions(metrics) {
    if (metrics.length < 10) {
      return { shortTerm: null, longTerm: null };
    }
    const timeValues = metrics.map(m => m.timestamp);
    const metricValues = metrics.map(m => m.value);
    const trend = this.calculateLinearTrend(timeValues, metricValues);
    const shortTermPrediction = {
      timeHorizon: '1 hour',
      predictedValue: trend.slope * (Date.now() + 3600000) + trend.intercept,
      confidence: Math.min(90, trend.correlation * 100),
      trend: trend.slope > 0 ? 'increasing' : trend.slope < 0 ? 'decreasing' : 'stable',
    };
    const longTermPrediction = {
      timeHorizon: '24 hours',
      predictedValue: trend.slope * (Date.now() + 86400000) + trend.intercept,
      confidence: Math.min(70, trend.correlation * 80),
      trend: trend.slope > 0 ? 'increasing' : trend.slope < 0 ? 'decreasing' : 'stable',
    };
    return {
      shortTerm: shortTermPrediction,
      longTerm: longTermPrediction,
    };
  }
  getRecentMetrics(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.rawMetrics.filter(m => m.timestamp >= cutoff);
  }
  getCurrentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  }
  getPeriodStart(period) {
    const parts = period.split('-');
    if (parts.length === 4) {
      const [year, month, day, hour] = parts.map(Number);
      return new Date(year, month - 1, day, hour).getTime();
    }
    return Date.now() - 24 * 60 * 60 * 1000;
  }
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000;
    this.rawMetrics = this.rawMetrics.filter(m => m.timestamp >= cutoff);
  }
  checkRealTimeAnomalies(metric) {
    const key = `${metric.category}:${metric.metric}`;
    const history = this.anomalyDetector.history.get(key) || [];
    history.push(metric.value);
    if (history.length > 20) {
      history.shift();
    }
    this.anomalyDetector.history.set(key, history);
    if (history.length >= 5) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const stdDev = Math.sqrt(this.calculateVariance(history, mean));
      const zScore = Math.abs((metric.value - mean) / stdDev);
      if (zScore > this.config.anomalyThreshold) {
        this.emit('real-time-anomaly', {
          metric,
          zScore,
          severity: zScore > 3 ? 'high' : 'medium',
        });
      }
    }
  }
  generateMetricsInsights(aggregated) {
    const insights = [];
    if (aggregated.systemOverview.healthScore < 70) {
      insights.push(
        `System health score is ${aggregated.systemOverview.healthScore}% - consider immediate optimization`
      );
    }
    const degradingCategories = Object.entries(aggregated.categories)
      .filter(([, data]) => data.trend === 'degrading')
      .map(([category]) => category);
    if (degradingCategories.length > 0) {
      insights.push(`Performance degrading in: ${degradingCategories.join(', ')}`);
    }
    if (aggregated.anomalies.length > 0) {
      insights.push(`${aggregated.anomalies.length} anomalies detected in current period`);
    }
    return insights;
  }
  checkMetricsAlerts(aggregated) {
    const alerts = [];
    if (aggregated.systemOverview.healthScore < 60) {
      alerts.push({
        type: 'health_critical',
        severity: 'critical',
        message: `System health critically low: ${aggregated.systemOverview.healthScore}%`,
      });
    }
    if (aggregated.systemOverview.performanceIndex < 70) {
      alerts.push({
        type: 'performance_warning',
        severity: 'warning',
        message: `Performance index below threshold: ${aggregated.systemOverview.performanceIndex}%`,
      });
    }
    return alerts;
  }
  parseTimeWindow(period) {
    const timeWindows = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return timeWindows[period] || timeWindows['24h'];
  }
  generateMetricsSummary(metrics) {
    return {
      totalMetrics: metrics.length,
      timeSpan:
        metrics.length > 0 ? metrics[metrics.length - 1].timestamp - metrics[0].timestamp : 0,
      categories: [...new Set(metrics.map(m => m.category))],
      severityDistribution: {
        low: metrics.filter(m => m.severity === 'low').length,
        medium: metrics.filter(m => m.severity === 'medium').length,
        high: metrics.filter(m => m.severity === 'high').length,
        critical: metrics.filter(m => m.severity === 'critical').length,
      },
    };
  }
  generateCategoryAnalysis(metrics) {
    return this.aggregateByCategory(metrics);
  }
  generateTrendAnalysis(metrics) {
    return this.calculateTrends(metrics);
  }
  generateAdvancedInsights(metrics, trends, anomalies) {
    const insights = [];
    if (trends.hourly && Object.keys(trends.hourly).length > 0) {
      insights.push('Hourly trend patterns identified');
    }
    if (anomalies.length > 0) {
      insights.push(`${anomalies.length} anomalies require attention`);
    }
    return insights;
  }
  calculateVariance(values, mean) {
    if (values.length === 0) return 0;
    const avg = mean !== undefined ? mean : values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
  determineCategoryTrend(metrics) {
    if (metrics.length < 3) return 'stable';
    const recent = metrics.slice(-Math.floor(metrics.length / 3));
    const older = metrics.slice(0, Math.floor(metrics.length / 3));
    const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (Math.abs(changePercent) < 5) return 'stable';
    return changePercent > 0 ? 'degrading' : 'improving';
  }
  groupMetricsByHour(metrics) {
    const hourlyData = new Map();
    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp).getHours();
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour).push(metric.value);
    });
    const hourlyAverages = new Map();
    hourlyData.forEach((values, hour) => {
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      hourlyAverages.set(hour, average);
    });
    return hourlyAverages;
  }
  groupMetricsByDay(metrics) {
    const dailyData = new Map();
    metrics.forEach(metric => {
      const date = new Date(metric.timestamp).toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, []);
      }
      dailyData.get(date).push(metric.value);
    });
    const dailyAverages = new Map();
    dailyData.forEach((values, date) => {
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      dailyAverages.set(date, average);
    });
    return dailyAverages;
  }
  groupMetricsByWeek(metrics) {
    const weeklyData = new Map();
    metrics.forEach(metric => {
      const date = new Date(metric.timestamp);
      const year = date.getFullYear();
      const week = Math.ceil(
        ((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7
      );
      const weekKey = `${year}-W${week}`;
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, []);
      }
      weeklyData.get(weekKey).push(metric.value);
    });
    const weeklyAverages = new Map();
    weeklyData.forEach((values, week) => {
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      weeklyAverages.set(week, average);
    });
    return weeklyAverages;
  }
  calculateTrendDirection(data) {
    const values = Array.from(data.values());
    if (values.length < 3) return 'stable';
    const recentValues = values.slice(-Math.floor(values.length / 3));
    const olderValues = values.slice(0, Math.floor(values.length / 3));
    const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const olderAvg = olderValues.reduce((a, b) => a + b, 0) / olderValues.length;
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (Math.abs(changePercent) < 5) return 'stable';
    return changePercent > 0 ? 'degrading' : 'improving';
  }
  calculateTrendChange(data) {
    const values = Array.from(data.values());
    if (values.length < 2) return 0;
    return ((values[values.length - 1] - values[0]) / values[0]) * 100;
  }
  calculateTrendConfidence(data) {
    const values = Array.from(data.values());
    if (values.length < 3) return 0;
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    const correlation = this.calculateCorrelation(x, y, xMean, yMean);
    return Math.abs(correlation) * 100;
  }
  calculateLinearTrend(x, y) {
    const n = x.length;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) ** 2;
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;
    const correlation = this.calculateCorrelation(x, y, xMean, yMean);
    return { slope, intercept, correlation };
  }
  calculateCorrelation(x, y, xMean, yMean) {
    const n = x.length;
    let numerator = 0;
    let xSumSquares = 0;
    let ySumSquares = 0;
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xSumSquares += xDiff ** 2;
      ySumSquares += yDiff ** 2;
    }
    const denominator = Math.sqrt(xSumSquares * ySumSquares);
    return denominator !== 0 ? numerator / denominator : 0;
  }
  convertMapToRecord(map) {
    const record = {};
    map.forEach((value, key) => {
      record[String(key)] = value;
    });
    return record;
  }
  async destroy() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    this.rawMetrics.length = 0;
    this.aggregatedMetrics.clear();
    this.snapshots.clear();
    console.log('OptimizationMetricsAggregator destroyed');
  }
}
exports.OptimizationMetricsAggregator = OptimizationMetricsAggregator;
exports.default = OptimizationMetricsAggregator;
//# sourceMappingURL=OptimizationMetricsAggregator.js.map
