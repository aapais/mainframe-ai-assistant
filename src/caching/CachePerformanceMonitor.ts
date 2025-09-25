/**
 * Cache Performance Monitor
 *
 * Provides comprehensive monitoring and metrics for the multi-layer caching system:
 *
 * - Real-time performance tracking across all cache layers
 * - Hit rate analysis and optimization recommendations
 * - Memory usage monitoring with alerts
 * - Response time analysis with percentile tracking
 * - MVP-specific performance targets and SLA monitoring
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MultiLayerCacheManager, CacheMetrics } from './MultiLayerCacheManager';
import { CacheWarmingEngine, WarmingStats } from './CacheWarmingEngine';
import { CacheInvalidationManager, InvalidationStats } from './CacheInvalidationManager';

export interface PerformanceTarget {
  mvpLevel: 1 | 2 | 3 | 4 | 5;
  maxResponseTime: number; // milliseconds
  minHitRate: number; // percentage (0-1)
  maxMemoryUsage: number; // bytes
  maxEvictionRate: number; // evictions per minute
}

export interface PerformanceMetrics {
  timestamp: Date;
  mvpLevel: 1 | 2 | 3 | 4 | 5;

  // Response time metrics
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;

  // Hit rate metrics
  overallHitRate: number;
  layerHitRates: Record<string, number>;

  // Memory metrics
  memoryUsage: number;
  memoryEfficiency: number;

  // Throughput metrics
  requestsPerSecond: number;
  cacheEventsPerMinute: number;

  // Quality metrics
  warmingEffectiveness: number;
  invalidationAccuracy: number;
  dataFreshness: number;

  // SLA compliance
  slaCompliance: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  recommendations: string[];
}

export interface TrendAnalysis {
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  projection: number;
  confidence: number;
}

export class CachePerformanceMonitor extends EventEmitter {
  private db: Database.Database;
  private cacheManager: MultiLayerCacheManager;
  private warmingEngine: CacheWarmingEngine;
  private invalidationManager: CacheInvalidationManager;

  private currentMetrics: PerformanceMetrics;
  private historicalMetrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private responseTimes: number[] = [];

  private targets: Map<number, PerformanceTarget> = new Map();

  private config = {
    monitoringInterval: 30000, // 30 seconds
    alertThresholds: {
      responseTimeWarning: 500,
      responseTimeCritical: 1000,
      hitRateWarning: 0.7,
      hitRateCritical: 0.5,
      memoryWarning: 0.8,
      memoryCritical: 0.95,
    },
    historyRetention: 24 * 60 * 60 * 1000, // 24 hours
    trendAnalysisWindow: 60, // 60 data points
    alertCooldown: 5 * 60 * 1000, // 5 minutes between similar alerts
  };

  constructor(
    database: Database.Database,
    cacheManager: MultiLayerCacheManager,
    warmingEngine: CacheWarmingEngine,
    invalidationManager: CacheInvalidationManager,
    mvpLevel: 1 | 2 | 3 | 4 | 5
  ) {
    super();

    this.db = database;
    this.cacheManager = cacheManager;
    this.warmingEngine = warmingEngine;
    this.invalidationManager = invalidationManager;

    this.setupPerformanceTargets();
    this.initializeMonitoringTables();
    this.startMonitoring();

    // Initial metrics collection
    this.collectMetrics();

    console.log(`📊 Cache performance monitor initialized for MVP${mvpLevel}`);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get historical metrics for trend analysis
   */
  getHistoricalMetrics(hours: number = 1): PerformanceMetrics[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.historicalMetrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Get active performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    const cutoff = Date.now() - this.config.alertCooldown;
    return this.alerts.filter(a => a.timestamp.getTime() > cutoff);
  }

  /**
   * Get trend analysis for key metrics
   */
  getTrendAnalysis(): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];
    const recentMetrics = this.getHistoricalMetrics(1); // Last hour

    if (recentMetrics.length < 5) {
      return trends; // Not enough data for trend analysis
    }

    // Analyze response time trend
    const responseTimeTrend = this.analyzeTrend(
      recentMetrics.map(m => m.avgResponseTime),
      'avgResponseTime'
    );
    trends.push(responseTimeTrend);

    // Analyze hit rate trend
    const hitRateTrend = this.analyzeTrend(
      recentMetrics.map(m => m.overallHitRate),
      'overallHitRate'
    );
    trends.push(hitRateTrend);

    // Analyze memory usage trend
    const memoryTrend = this.analyzeTrend(
      recentMetrics.map(m => m.memoryUsage),
      'memoryUsage'
    );
    trends.push(memoryTrend);

    return trends;
  }

  /**
   * Record operation timing for performance analysis
   */
  recordOperation(operation: string, duration: number, cacheHit: boolean): void {
    this.responseTimes.push(duration);

    // Keep only recent response times (last 1000 operations)
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    // Store detailed operation metrics
    this.storeOperationMetric(operation, duration, cacheHit);
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(timeframe: 'hourly' | 'daily' | 'weekly' = 'hourly'): any {
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

  /**
   * Get optimization suggestions based on current performance
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const metrics = this.currentMetrics;

    // Response time optimizations
    if (metrics.avgResponseTime > this.config.alertThresholds.responseTimeWarning) {
      suggestions.push('Consider increasing hot cache size to improve response times');

      if (metrics.layerHitRates['hot'] < 0.6) {
        suggestions.push('Hot cache hit rate is low - review warming strategies');
      }
    }

    // Hit rate optimizations
    if (metrics.overallHitRate < this.config.alertThresholds.hitRateWarning) {
      suggestions.push('Overall hit rate is below target - review TTL settings');
      suggestions.push('Consider implementing more aggressive cache warming');
    }

    // Memory optimizations
    if (metrics.memoryEfficiency < 0.7) {
      suggestions.push('Memory efficiency is low - review cache entry sizes');
      suggestions.push('Consider implementing compression for large cache entries');
    }

    // Warming effectiveness
    if (metrics.warmingEffectiveness < 0.6) {
      suggestions.push('Cache warming is not effective - review prediction algorithms');
    }

    // Invalidation accuracy
    if (metrics.invalidationAccuracy < 0.8) {
      suggestions.push('Cache invalidation accuracy is low - review invalidation rules');
    }

    return suggestions;
  }

  // Private implementation methods

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();

      // Get cache metrics
      const cacheMetrics = this.cacheManager.getMetrics();
      const warmingStats = this.warmingEngine.getStats();
      const invalidationStats = this.invalidationManager.getStats();

      // Calculate response time percentiles
      const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sortedTimes, 50);
      const p95 = this.calculatePercentile(sortedTimes, 95);
      const p99 = this.calculatePercentile(sortedTimes, 99);

      // Calculate layer hit rates
      const layerHitRates: Record<string, number> = {};
      cacheMetrics.layers.forEach(layer => {
        layerHitRates[layer.name.toLowerCase().replace(/[^a-z0-9]/g, '_')] = layer.hitRate;
      });

      // Calculate SLA compliance
      const target = this.targets.get(this.currentMetrics?.mvpLevel || 1);
      const slaCompliance = target ? this.calculateSLACompliance(cacheMetrics, target) : 1;

      // Build performance metrics
      const metrics: PerformanceMetrics = {
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

      // Clean up old metrics
      this.cleanupHistoricalMetrics();

      // Check for alerts
      await this.checkAlerts(metrics);

      // Store metrics in database
      await this.storeMetrics(metrics);

      this.emit('metrics-updated', metrics);
    } catch (error) {
      console.error('Error collecting cache performance metrics:', error);
    }
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
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

  private calculateTotalMemoryUsage(metrics: CacheMetrics): number {
    return metrics.layers.reduce((total, layer) => total + layer.memoryUsage, 0);
  }

  private calculateMemoryEfficiency(metrics: CacheMetrics): number {
    const totalMemory = this.calculateTotalMemoryUsage(metrics);
    const totalSize = metrics.layers.reduce((total, layer) => total + layer.size, 0);

    return totalSize > 0 ? metrics.overallHitRate * (totalSize / Math.max(totalMemory, 1)) : 0;
  }

  private calculateRequestsPerSecond(): number {
    // Calculate based on recent response times
    const recentMetrics = this.historicalMetrics.slice(-5); // Last 5 measurements
    if (recentMetrics.length < 2) return 0;

    const timeSpan =
      recentMetrics[recentMetrics.length - 1].timestamp.getTime() -
      recentMetrics[0].timestamp.getTime();

    return timeSpan > 0 ? (this.responseTimes.length * 1000) / timeSpan : 0;
  }

  private calculateCacheEventsPerMinute(): number {
    // Estimate based on metrics collection frequency
    return (this.responseTimes.length * 60) / (this.config.monitoringInterval / 1000);
  }

  private calculateDataFreshness(): number {
    // Simplified calculation - in practice, would track actual data staleness
    return Math.max(0.5, 1 - (this.currentMetrics?.avgResponseTime || 0) / 1000);
  }

  private calculateSLACompliance(metrics: CacheMetrics, target: PerformanceTarget): number {
    let compliance = 0;
    let criteria = 0;

    // Response time compliance
    if (metrics.avgResponseTime <= target.maxResponseTime) {
      compliance += 0.4;
    }
    criteria += 0.4;

    // Hit rate compliance
    if (metrics.overallHitRate >= target.minHitRate) {
      compliance += 0.3;
    }
    criteria += 0.3;

    // Memory usage compliance
    const totalMemory = this.calculateTotalMemoryUsage(metrics);
    if (totalMemory <= target.maxMemoryUsage) {
      compliance += 0.2;
    }
    criteria += 0.2;

    // Eviction rate compliance (placeholder)
    compliance += 0.1;
    criteria += 0.1;

    return criteria > 0 ? compliance / criteria : 1;
  }

  private calculatePerformanceGrade(
    slaCompliance: number,
    metrics: CacheMetrics
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (slaCompliance >= 0.95 && metrics.avgResponseTime < 100) return 'A';
    if (slaCompliance >= 0.9 && metrics.avgResponseTime < 200) return 'B';
    if (slaCompliance >= 0.8 && metrics.avgResponseTime < 500) return 'C';
    if (slaCompliance >= 0.7) return 'D';
    return 'F';
  }

  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    const now = new Date();

    // Response time alerts
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

    // Hit rate alerts
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

    // Memory usage alerts
    const memoryUtilization = metrics.memoryUsage / (256 * 1024 * 1024); // Assume 256MB limit
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

  private async createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp'>): Promise<void> {
    const fullAlert: PerformanceAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      ...alert,
    };

    // Check for recent similar alerts
    const recentSimilar = this.alerts.find(
      a =>
        a.metric === alert.metric &&
        a.level === alert.level &&
        Date.now() - a.timestamp.getTime() < this.config.alertCooldown
    );

    if (recentSimilar) {
      return; // Skip duplicate alert
    }

    this.alerts.push(fullAlert);
    await this.storeAlert(fullAlert);

    console.log(`🚨 Cache performance alert: ${alert.level.toUpperCase()} - ${alert.message}`);
    this.emit('performance-alert', fullAlert);
  }

  private analyzeTrend(values: number[], metric: string): TrendAnalysis {
    if (values.length < 3) {
      return {
        metric,
        trend: 'stable',
        changeRate: 0,
        projection: values[values.length - 1] || 0,
        confidence: 0,
      };
    }

    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // 0 + 1 + 2 + ... + (n-1)
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Determine trend
    const changeRate = Math.abs(slope);
    let trend: 'improving' | 'stable' | 'degrading';

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

    // Calculate confidence based on R-squared
    const yMean = sumY / n;
    const totalVariance = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const residualVariance = values.reduce((sum, val, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(val - predicted, 2);
    }, 0);

    const rSquared = totalVariance > 0 ? 1 - residualVariance / totalVariance : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Project next value
    const projection = intercept + slope * n;

    return {
      metric,
      trend,
      changeRate,
      projection,
      confidence,
    };
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateStability(values: number[]): number {
    if (values.length < 2) return 1;

    const avg = this.calculateAverage(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Return stability as coefficient of variation (lower is more stable)
    return avg > 0 ? Math.max(0, 1 - stdDev / avg) : 1;
  }

  private calculateOverallGrade(metrics: PerformanceMetrics[]): 'A' | 'B' | 'C' | 'D' | 'F' {
    const grades = metrics.map(m => m.performanceGrade);
    const gradeScores = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    const avgScore = grades.reduce((sum, grade) => sum + gradeScores[grade], 0) / grades.length;

    if (avgScore >= 3.5) return 'A';
    if (avgScore >= 2.5) return 'B';
    if (avgScore >= 1.5) return 'C';
    if (avgScore >= 0.5) return 'D';
    return 'F';
  }

  private getAlertSummary(hours: number): any {
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

  private getTopAlertMetrics(alerts: PerformanceAlert[]): Array<{ metric: string; count: number }> {
    const metricCounts = new Map<string, number>();

    alerts.forEach(alert => {
      metricCounts.set(alert.metric, (metricCounts.get(alert.metric) || 0) + 1);
    });

    return Array.from(metricCounts.entries())
      .map(([metric, count]) => ({ metric, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private generateRecommendations(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];

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

  private setupPerformanceTargets(): void {
    // MVP1-2: Basic performance targets
    this.targets.set(1, {
      mvpLevel: 1,
      maxResponseTime: 1000,
      minHitRate: 0.8,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxEvictionRate: 10, // per minute
    });

    this.targets.set(2, {
      mvpLevel: 2,
      maxResponseTime: 800,
      minHitRate: 0.82,
      maxMemoryUsage: 150 * 1024 * 1024, // 150MB
      maxEvictionRate: 8,
    });

    // MVP3-4: Enhanced performance targets
    this.targets.set(3, {
      mvpLevel: 3,
      maxResponseTime: 500,
      minHitRate: 0.85,
      maxMemoryUsage: 200 * 1024 * 1024, // 200MB
      maxEvictionRate: 6,
    });

    this.targets.set(4, {
      mvpLevel: 4,
      maxResponseTime: 300,
      minHitRate: 0.88,
      maxMemoryUsage: 250 * 1024 * 1024, // 250MB
      maxEvictionRate: 4,
    });

    // MVP5: Enterprise performance targets
    this.targets.set(5, {
      mvpLevel: 5,
      maxResponseTime: 200,
      minHitRate: 0.9,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxEvictionRate: 2,
    });
  }

  private cleanupHistoricalMetrics(): void {
    const cutoff = Date.now() - this.config.historyRetention;
    this.historicalMetrics = this.historicalMetrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
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

  private async storeAlert(alert: PerformanceAlert): Promise<void> {
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

  private async storeOperationMetric(
    operation: string,
    duration: number,
    cacheHit: boolean
  ): Promise<void> {
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
      // Non-critical error, don't throw
      console.warn('Failed to store operation metric:', error);
    }
  }

  private initializeMonitoringTables(): void {
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

  private startMonitoring(): void {
    // Collect metrics at regular intervals
    setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('Error in metrics collection:', error);
      });
    }, this.config.monitoringInterval);

    // Clean up old alerts every hour
    setInterval(
      () => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        this.alerts = this.alerts.filter(a => a.timestamp.getTime() > cutoff);
      },
      60 * 60 * 1000
    );

    console.log('🔄 Performance monitoring started');
  }
}
