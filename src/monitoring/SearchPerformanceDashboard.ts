/**
 * Real-time Search Performance Monitoring Dashboard
 *
 * Provides live performance metrics, bottleneck identification, and alerting
 * for the complete search implementation
 */

import { EventEmitter } from 'events';

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  component: 'search' | 'ui' | 'cache' | 'memory' | 'network';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

export interface ComponentMetrics {
  search: {
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    throughput: number; // requests per second
    slowestQueries: Array<{ query: string; time: number }>;
  };
  cache: {
    hitRate: number;
    missRate: number;
    size: number;
    evictions: number;
    avgHitTime: number;
  };
  ui: {
    renderTime: number;
    interactionLatency: number;
    memoryUsage: number;
    scrollPerformance: number;
  };
  database: {
    queryTime: number;
    connectionPool: number;
    slowQueries: Array<{ sql: string; time: number }>;
  };
  network: {
    aiApiLatency: number;
    aiApiErrorRate: number;
    bandwidth: number;
  };
}

export interface PerformanceSnapshot {
  timestamp: Date;
  overall: {
    health: 'excellent' | 'good' | 'warning' | 'critical';
    uptime: number;
    totalRequests: number;
    activeUsers: number;
  };
  components: ComponentMetrics;
  alerts: PerformanceAlert[];
  trends: {
    responseTimetrend: number[]; // Last 60 data points
    errorRateTrend: number[];
    cacheHitTrend: number[];
    memoryTrend: number[];
  };
}

interface MetricWindow {
  values: number[];
  timestamps: number[];
  maxSize: number;
}

export class SearchPerformanceDashboard extends EventEmitter {
  private metrics: Map<string, MetricWindow> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timer;
  private alertThresholds = {
    responseTime: { warning: 800, critical: 1200 },
    errorRate: { warning: 0.05, critical: 0.1 },
    cacheHitRate: { warning: 0.8, critical: 0.7 },
    memoryUsage: { warning: 200 * 1024 * 1024, critical: 256 * 1024 * 1024 },
    uiRenderTime: { warning: 150, critical: 200 },
  };

  constructor(
    private searchService?: any,
    private cacheManager?: any,
    private monitoringIntervalMs: number = 5000
  ) {
    super();
    this.initializeMetrics();
  }

  /**
   * Start real-time performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🚀 Search Performance Dashboard started');

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.monitoringIntervalMs);

    // Collect initial metrics
    this.collectMetrics();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('⏹️ Search Performance Dashboard stopped');
  }

  /**
   * Record a search performance metric
   */
  recordSearchMetric(
    query: string,
    responseTime: number,
    resultCount: number,
    cacheHit: boolean,
    error?: string
  ): void {
    const now = Date.now();

    // Record response time
    this.addMetric('search.responseTime', responseTime);
    this.addMetric('search.resultCount', resultCount);
    this.addMetric('cache.hits', cacheHit ? 1 : 0);
    this.addMetric('search.errors', error ? 1 : 0);

    // Track slow queries
    if (responseTime > 1000) {
      this.addSlowQuery(query, responseTime);
    }

    // Check for alerts
    this.checkAlerts();

    this.emit('metric-recorded', {
      type: 'search',
      query,
      responseTime,
      resultCount,
      cacheHit,
      error,
      timestamp: now,
    });
  }

  /**
   * Record UI performance metric
   */
  recordUIMetric(component: string, renderTime: number, interactionTime?: number): void {
    this.addMetric('ui.renderTime', renderTime);
    if (interactionTime) {
      this.addMetric('ui.interactionTime', interactionTime);
    }

    this.checkAlerts();
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(usage: number): void {
    this.addMetric('memory.usage', usage);
    this.checkAlerts();
  }

  /**
   * Record network performance
   */
  recordNetworkMetric(type: 'ai-api' | 'database', latency: number, error?: boolean): void {
    this.addMetric(`network.${type}.latency`, latency);
    if (error) {
      this.addMetric(`network.${type}.errors`, 1);
    }

    this.checkAlerts();
  }

  /**
   * Get current performance snapshot
   */
  getCurrentSnapshot(): PerformanceSnapshot {
    const now = new Date();

    return {
      timestamp: now,
      overall: this.calculateOverallHealth(),
      components: this.getComponentMetrics(),
      alerts: Array.from(this.alerts.values()).filter(alert => !alert.resolved),
      trends: this.getTrends(),
    };
  }

  /**
   * Get historical performance data
   */
  getHistoricalData(
    metric: string,
    timeRange: number = 3600000 // 1 hour default
  ): Array<{ timestamp: number; value: number }> {
    const window = this.metrics.get(metric);
    if (!window) return [];

    const cutoffTime = Date.now() - timeRange;

    return window.timestamps
      .map((timestamp, index) => ({
        timestamp,
        value: window.values[index],
      }))
      .filter(point => point.timestamp >= cutoffTime);
  }

  /**
   * Identify current bottlenecks
   */
  identifyBottlenecks(): Array<{
    component: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
    metrics: any;
  }> {
    const bottlenecks = [];
    const snapshot = this.getCurrentSnapshot();

    // Check search performance
    if (snapshot.components.search.p95ResponseTime > 800) {
      bottlenecks.push({
        component: 'search',
        issue: 'High search response time',
        severity: snapshot.components.search.p95ResponseTime > 1200 ? 'high' : 'medium',
        recommendation: 'Optimize FTS queries, increase cache TTL, or scale database',
        metrics: {
          p95ResponseTime: snapshot.components.search.p95ResponseTime,
          avgResponseTime: snapshot.components.search.avgResponseTime,
        },
      });
    }

    // Check cache performance
    if (snapshot.components.cache.hitRate < 0.8) {
      bottlenecks.push({
        component: 'cache',
        issue: 'Low cache hit rate',
        severity: snapshot.components.cache.hitRate < 0.7 ? 'high' : 'medium',
        recommendation: 'Increase cache size, optimize cache keys, or improve TTL strategy',
        metrics: {
          hitRate: snapshot.components.cache.hitRate,
          size: snapshot.components.cache.size,
        },
      });
    }

    // Check memory usage
    if (snapshot.components.ui.memoryUsage > 200 * 1024 * 1024) {
      bottlenecks.push({
        component: 'ui',
        issue: 'High memory usage',
        severity: snapshot.components.ui.memoryUsage > 256 * 1024 * 1024 ? 'high' : 'medium',
        recommendation:
          'Implement virtual scrolling, optimize React re-renders, or fix memory leaks',
        metrics: {
          memoryUsage: snapshot.components.ui.memoryUsage,
        },
      });
    }

    // Check error rates
    if (snapshot.components.search.errorRate > 0.05) {
      bottlenecks.push({
        component: 'search',
        issue: 'High error rate',
        severity: snapshot.components.search.errorRate > 0.1 ? 'high' : 'medium',
        recommendation:
          'Check AI API connectivity, validate input handling, or improve error recovery',
        metrics: {
          errorRate: snapshot.components.search.errorRate,
        },
      });
    }

    return bottlenecks;
  }

  /**
   * Generate performance optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    priority: 'high' | 'medium' | 'low';
    category: 'performance' | 'reliability' | 'scalability';
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
  }> {
    const recommendations = [];
    const snapshot = this.getCurrentSnapshot();

    // High priority recommendations
    if (snapshot.components.search.p95ResponseTime > 1000) {
      recommendations.push({
        priority: 'high' as const,
        category: 'performance' as const,
        title: 'Optimize Search Response Time',
        description:
          'Search P95 response time exceeds 1s target. Consider FTS query optimization, better indexing, or cache improvements.',
        impact: 'Directly improves user experience and meets performance SLA',
        effort: 'medium' as const,
      });
    }

    if (snapshot.components.cache.hitRate < 0.8) {
      recommendations.push({
        priority: 'high' as const,
        category: 'performance' as const,
        title: 'Improve Cache Hit Rate',
        description:
          'Cache hit rate is below optimal. Review cache strategy, increase size, or optimize cache keys.',
        impact: 'Significant reduction in search response time',
        effort: 'low' as const,
      });
    }

    // Medium priority recommendations
    if (snapshot.components.ui.renderTime > 150) {
      recommendations.push({
        priority: 'medium' as const,
        category: 'performance' as const,
        title: 'Optimize UI Rendering',
        description:
          'UI render time is above target. Consider React.memo, virtualization, or component optimization.',
        impact: 'Improves perceived performance and responsiveness',
        effort: 'medium' as const,
      });
    }

    if (snapshot.components.search.errorRate > 0.02) {
      recommendations.push({
        priority: 'medium' as const,
        category: 'reliability' as const,
        title: 'Reduce Error Rate',
        description:
          'Search error rate is elevated. Implement better error handling and fallback mechanisms.',
        impact: 'Improves system reliability and user experience',
        effort: 'medium' as const,
      });
    }

    // Low priority recommendations
    if (snapshot.components.network.aiApiLatency > 2000) {
      recommendations.push({
        priority: 'low' as const,
        category: 'performance' as const,
        title: 'Optimize AI API Usage',
        description:
          'AI API latency is high. Consider request optimization, timeout tuning, or fallback improvements.',
        impact: 'Reduces AI search response time',
        effort: 'low' as const,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Export performance report
   */
  exportReport(timeRange: number = 3600000): {
    summary: any;
    metrics: any;
    alerts: PerformanceAlert[];
    bottlenecks: any[];
    recommendations: any[];
    timestamp: Date;
  } {
    const snapshot = this.getCurrentSnapshot();

    return {
      summary: {
        overallHealth: snapshot.overall.health,
        uptime: snapshot.overall.uptime,
        totalRequests: snapshot.overall.totalRequests,
        activeUsers: snapshot.overall.activeUsers,
      },
      metrics: {
        search: {
          avgResponseTime: snapshot.components.search.avgResponseTime,
          p95ResponseTime: snapshot.components.search.p95ResponseTime,
          errorRate: snapshot.components.search.errorRate * 100,
          throughput: snapshot.components.search.throughput,
        },
        cache: {
          hitRate: snapshot.components.cache.hitRate * 100,
          avgHitTime: snapshot.components.cache.avgHitTime,
        },
        ui: {
          renderTime: snapshot.components.ui.renderTime,
          memoryUsage: Math.round((snapshot.components.ui.memoryUsage / 1024 / 1024) * 100) / 100,
        },
      },
      alerts: snapshot.alerts,
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.getOptimizationRecommendations(),
      timestamp: new Date(),
    };
  }

  // Private methods

  private initializeMetrics(): void {
    const metricNames = [
      'search.responseTime',
      'search.resultCount',
      'search.errors',
      'cache.hits',
      'cache.size',
      'ui.renderTime',
      'ui.interactionTime',
      'memory.usage',
      'network.ai-api.latency',
      'network.ai-api.errors',
      'network.database.latency',
    ];

    metricNames.forEach(name => {
      this.metrics.set(name, {
        values: [],
        timestamps: [],
        maxSize: 1000, // Keep last 1000 data points
      });
    });
  }

  private addMetric(name: string, value: number): void {
    const window = this.metrics.get(name);
    if (!window) return;

    const now = Date.now();

    window.values.push(value);
    window.timestamps.push(now);

    // Maintain window size
    if (window.values.length > window.maxSize) {
      window.values.shift();
      window.timestamps.shift();
    }
  }

  private addSlowQuery(query: string, time: number): void {
    // Store slow queries for analysis
    this.emit('slow-query', { query, time, timestamp: Date.now() });
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect search service metrics
      if (this.searchService && typeof this.searchService.getPerformanceMetrics === 'function') {
        const searchMetrics = this.searchService.getPerformanceMetrics();

        if (searchMetrics) {
          this.addMetric('search.responseTime', searchMetrics.averageSearchTime || 0);
          this.addMetric('cache.hits', searchMetrics.instantCacheHitRate || 0);
        }
      }

      // Collect memory usage
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memory = (performance as any).memory;
        this.addMetric('memory.usage', memory.usedJSHeapSize);
      }

      // Collect cache metrics
      if (this.cacheManager && typeof this.cacheManager.getStats === 'function') {
        const cacheStats = this.cacheManager.getStats();
        if (cacheStats) {
          this.addMetric('cache.size', cacheStats.size || 0);
        }
      }

      this.checkAlerts();
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  private calculateOverallHealth(): {
    health: 'excellent' | 'good' | 'warning' | 'critical';
    uptime: number;
    totalRequests: number;
    activeUsers: number;
  } {
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    const criticalAlerts = activeAlerts.filter(alert => alert.type === 'critical');
    const warningAlerts = activeAlerts.filter(alert => alert.type === 'warning');

    let health: 'excellent' | 'good' | 'warning' | 'critical';

    if (criticalAlerts.length > 0) {
      health = 'critical';
    } else if (warningAlerts.length > 2) {
      health = 'warning';
    } else if (warningAlerts.length > 0) {
      health = 'good';
    } else {
      health = 'excellent';
    }

    return {
      health,
      uptime: this.getUptime(),
      totalRequests: this.getTotalRequests(),
      activeUsers: this.getActiveUsers(),
    };
  }

  private getComponentMetrics(): ComponentMetrics {
    return {
      search: {
        avgResponseTime: this.getMetricAverage('search.responseTime', 300000), // 5 min window
        p95ResponseTime: this.getMetricP95('search.responseTime', 300000),
        errorRate: this.getMetricRate('search.errors', 300000),
        throughput: this.getMetricThroughput('search.responseTime', 300000),
        slowestQueries: [], // TODO: Implement slow query tracking
      },
      cache: {
        hitRate: this.getMetricAverage('cache.hits', 300000),
        missRate: 1 - this.getMetricAverage('cache.hits', 300000),
        size: this.getLatestMetric('cache.size'),
        evictions: 0, // TODO: Implement eviction tracking
        avgHitTime: this.getMetricAverage('cache.hits', 300000) * 10, // Estimate
      },
      ui: {
        renderTime: this.getMetricAverage('ui.renderTime', 300000),
        interactionLatency: this.getMetricAverage('ui.interactionTime', 300000),
        memoryUsage: this.getLatestMetric('memory.usage'),
        scrollPerformance: 0, // TODO: Implement scroll performance tracking
      },
      database: {
        queryTime: this.getMetricAverage('network.database.latency', 300000),
        connectionPool: 0, // TODO: Implement connection pool monitoring
        slowQueries: [], // TODO: Implement slow query tracking
      },
      network: {
        aiApiLatency: this.getMetricAverage('network.ai-api.latency', 300000),
        aiApiErrorRate: this.getMetricRate('network.ai-api.errors', 300000),
        bandwidth: 0, // TODO: Implement bandwidth monitoring
      },
    };
  }

  private getTrends(): {
    responseTimetrend: number[];
    errorRateTrend: number[];
    cacheHitTrend: number[];
    memoryTrend: number[];
  } {
    return {
      responseTimetrend: this.getMetricTrend('search.responseTime', 60),
      errorRateTrend: this.getMetricTrend('search.errors', 60),
      cacheHitTrend: this.getMetricTrend('cache.hits', 60),
      memoryTrend: this.getMetricTrend('memory.usage', 60),
    };
  }

  private getMetricAverage(metricName: string, timeWindow: number): number {
    const window = this.metrics.get(metricName);
    if (!window || window.values.length === 0) return 0;

    const cutoffTime = Date.now() - timeWindow;
    const recentValues = window.timestamps
      .map((timestamp, index) => ({ timestamp, value: window.values[index] }))
      .filter(point => point.timestamp >= cutoffTime)
      .map(point => point.value);

    if (recentValues.length === 0) return 0;

    return recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length;
  }

  private getMetricP95(metricName: string, timeWindow: number): number {
    const window = this.metrics.get(metricName);
    if (!window || window.values.length === 0) return 0;

    const cutoffTime = Date.now() - timeWindow;
    const recentValues = window.timestamps
      .map((timestamp, index) => ({ timestamp, value: window.values[index] }))
      .filter(point => point.timestamp >= cutoffTime)
      .map(point => point.value)
      .sort((a, b) => a - b);

    if (recentValues.length === 0) return 0;

    const p95Index = Math.floor(recentValues.length * 0.95);
    return recentValues[p95Index] || 0;
  }

  private getMetricRate(metricName: string, timeWindow: number): number {
    const window = this.metrics.get(metricName);
    if (!window || window.values.length === 0) return 0;

    const cutoffTime = Date.now() - timeWindow;
    const recentValues = window.timestamps
      .map((timestamp, index) => ({ timestamp, value: window.values[index] }))
      .filter(point => point.timestamp >= cutoffTime)
      .map(point => point.value);

    if (recentValues.length === 0) return 0;

    return recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length;
  }

  private getMetricThroughput(metricName: string, timeWindow: number): number {
    const window = this.metrics.get(metricName);
    if (!window || window.values.length === 0) return 0;

    const cutoffTime = Date.now() - timeWindow;
    const recentCount = window.timestamps.filter(timestamp => timestamp >= cutoffTime).length;

    return recentCount / (timeWindow / 1000); // requests per second
  }

  private getLatestMetric(metricName: string): number {
    const window = this.metrics.get(metricName);
    if (!window || window.values.length === 0) return 0;

    return window.values[window.values.length - 1];
  }

  private getMetricTrend(metricName: string, points: number): number[] {
    const window = this.metrics.get(metricName);
    if (!window || window.values.length === 0) return [];

    // Get last N values
    return window.values.slice(-points);
  }

  private getUptime(): number {
    // TODO: Implement actual uptime tracking
    return 99.9;
  }

  private getTotalRequests(): number {
    const searchMetrics = this.metrics.get('search.responseTime');
    return searchMetrics ? searchMetrics.values.length : 0;
  }

  private getActiveUsers(): number {
    // TODO: Implement active user tracking
    return 1;
  }

  private checkAlerts(): void {
    const now = new Date();

    // Check response time alert
    const p95ResponseTime = this.getMetricP95('search.responseTime', 300000);
    this.checkThresholdAlert(
      'response-time',
      'search',
      'High search response time detected',
      p95ResponseTime,
      this.alertThresholds.responseTime
    );

    // Check error rate alert
    const errorRate = this.getMetricRate('search.errors', 300000);
    this.checkThresholdAlert(
      'error-rate',
      'search',
      'High error rate detected',
      errorRate,
      this.alertThresholds.errorRate
    );

    // Check cache hit rate alert
    const cacheHitRate = this.getMetricAverage('cache.hits', 300000);
    this.checkThresholdAlert(
      'cache-hit-rate',
      'cache',
      'Low cache hit rate detected',
      1 - cacheHitRate, // Invert for alerting (high miss rate)
      {
        warning: 1 - this.alertThresholds.cacheHitRate.warning,
        critical: 1 - this.alertThresholds.cacheHitRate.critical,
      }
    );

    // Check memory usage alert
    const memoryUsage = this.getLatestMetric('memory.usage');
    this.checkThresholdAlert(
      'memory-usage',
      'memory',
      'High memory usage detected',
      memoryUsage,
      this.alertThresholds.memoryUsage
    );
  }

  private checkThresholdAlert(
    alertId: string,
    component: PerformanceAlert['component'],
    message: string,
    value: number,
    thresholds: { warning: number; critical: number }
  ): void {
    const existingAlert = this.alerts.get(alertId);

    if (value >= thresholds.critical) {
      if (!existingAlert || existingAlert.type !== 'critical') {
        const alert: PerformanceAlert = {
          id: alertId,
          type: 'critical',
          component,
          message,
          value,
          threshold: thresholds.critical,
          timestamp: new Date(),
          resolved: false,
        };

        this.alerts.set(alertId, alert);
        this.emit('alert', alert);
      }
    } else if (value >= thresholds.warning) {
      if (!existingAlert || existingAlert.type !== 'warning') {
        const alert: PerformanceAlert = {
          id: alertId,
          type: 'warning',
          component,
          message,
          value,
          threshold: thresholds.warning,
          timestamp: new Date(),
          resolved: false,
        };

        this.alerts.set(alertId, alert);
        this.emit('alert', alert);
      }
    } else {
      // Value is below warning threshold
      if (existingAlert && !existingAlert.resolved) {
        existingAlert.resolved = true;
        this.emit('alert-resolved', existingAlert);
      }
    }
  }
}

export default SearchPerformanceDashboard;
