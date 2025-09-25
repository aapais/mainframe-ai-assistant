/**
 * Search Analytics & Monitoring Service
 *
 * Comprehensive analytics and monitoring for search operations including:
 * - Performance metrics tracking
 * - User behavior analytics
 * - Search quality metrics
 * - Real-time monitoring dashboards
 * - Error tracking and alerting
 * - A/B testing support
 *
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { SearchResult, SearchOptions, KBEntry } from '../types/services';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  data: any;
  metadata?: {
    userAgent?: string;
    platform?: string;
    version?: string;
    experimentId?: string;
  };
}

export type AnalyticsEventType =
  | 'search_performed'
  | 'search_results_viewed'
  | 'result_clicked'
  | 'result_rated'
  | 'search_refined'
  | 'export_performed'
  | 'filter_applied'
  | 'sort_changed'
  | 'page_navigation'
  | 'error_occurred'
  | 'performance_metric';

export interface SearchPerformanceMetrics {
  query: string;
  searchTime: number;
  resultCount: number;
  cacheHit: boolean;
  aiUsed: boolean;
  fallbackUsed: boolean;
  indexSize?: number;
  queryComplexity?: number;
}

export interface UserBehaviorMetrics {
  userId: string;
  sessionId: string;
  searchCount: number;
  averageSearchTime: number;
  clickThroughRate: number;
  refinementRate: number;
  exportCount: number;
  averageSessionDuration: number;
  popularQueries: Array<{ query: string; count: number }>;
  preferredCategories: Array<{ category: string; count: number }>;
}

export interface SearchQualityMetrics {
  query: string;
  resultRelevance: number;
  userSatisfaction?: number;
  zeroResultRate: number;
  clickPosition: number;
  dwellTime: number;
  refinementNeeded: boolean;
  expertRating?: number;
}

export interface SystemHealthMetrics {
  searchLatency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  errorRate: {
    total: number;
    percentage: number;
    byType: Record<string, number>;
  };
  cachePerformance: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
  };
  resourceUsage: {
    memoryUsage: number;
    cpuUsage: number;
    indexSize: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemHealthMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownPeriod: number;
  lastTriggered?: number;
}

export interface AnalyticsConfig {
  enableTracking: boolean;
  enablePerformanceMonitoring: boolean;
  enableUserBehaviorTracking: boolean;
  enableErrorTracking: boolean;
  batchSize: number;
  batchTimeout: number;
  retentionPeriod: number;
  anonymizeData: boolean;
  enableExport: boolean;
}

/**
 * Advanced analytics and monitoring service
 */
export class SearchAnalyticsService extends EventEmitter {
  private config: AnalyticsConfig;
  private eventBuffer: AnalyticsEvent[] = [];
  private performanceBuffer: SearchPerformanceMetrics[] = [];
  private userSessions = new Map<string, UserBehaviorMetrics>();
  private qualityMetrics: SearchQualityMetrics[] = [];
  private systemMetrics: SystemHealthMetrics;
  private alertRules: AlertRule[] = [];

  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private metricsTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    super();

    this.config = {
      enableTracking: true,
      enablePerformanceMonitoring: true,
      enableUserBehaviorTracking: true,
      enableErrorTracking: true,
      batchSize: 50,
      batchTimeout: 5000, // 5 seconds
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      anonymizeData: false,
      enableExport: true,
      ...config,
    };

    this.systemMetrics = this.initializeSystemMetrics();

    if (this.config.enableTracking) {
      this.startBatchProcessing();
      this.startMetricsCollection();
      this.setupDefaultAlerts();
    }
  }

  /**
   * Track search operation
   */
  trackSearch(
    query: string,
    results: SearchResult[],
    options: SearchOptions,
    performanceMetrics: SearchPerformanceMetrics
  ): void {
    if (!this.config.enableTracking) return;

    // Track main search event
    this.trackEvent('search_performed', {
      query: this.anonymizeQuery(query),
      resultCount: results.length,
      options: this.sanitizeOptions(options),
      timestamp: Date.now(),
    });

    // Track performance metrics
    if (this.config.enablePerformanceMonitoring) {
      this.trackPerformanceMetric(performanceMetrics);
    }

    // Update user behavior metrics
    if (this.config.enableUserBehaviorTracking) {
      this.updateUserBehavior('search', {
        query,
        resultCount: results.length,
        searchTime: performanceMetrics.searchTime,
      });
    }

    // Track search quality
    this.trackSearchQuality({
      query: this.anonymizeQuery(query),
      resultRelevance: this.calculateRelevanceScore(results),
      zeroResultRate: results.length === 0 ? 1 : 0,
      clickPosition: -1, // Will be updated on click
      dwellTime: 0, // Will be updated later
      refinementNeeded: false, // Will be updated if user refines
    });
  }

  /**
   * Track result interaction
   */
  trackResultClick(
    result: SearchResult,
    position: number,
    query: string,
    dwellTime?: number
  ): void {
    if (!this.config.enableTracking) return;

    this.trackEvent('result_clicked', {
      resultId: result.entry.id,
      position,
      score: result.score,
      query: this.anonymizeQuery(query),
      dwellTime: dwellTime || 0,
    });

    // Update click-through rate
    this.updateUserBehavior('click', {
      position,
      dwellTime: dwellTime || 0,
    });

    // Update search quality metrics
    this.updateSearchQuality(query, {
      clickPosition: position,
      dwellTime: dwellTime || 0,
    });
  }

  /**
   * Track result rating/feedback
   */
  trackResultRating(result: SearchResult, rating: number, query: string, feedback?: string): void {
    if (!this.config.enableTracking) return;

    this.trackEvent('result_rated', {
      resultId: result.entry.id,
      rating,
      query: this.anonymizeQuery(query),
      feedback: feedback ? this.sanitizeFeedback(feedback) : undefined,
    });

    // Update search quality metrics
    this.updateSearchQuality(query, {
      userSatisfaction: rating,
      expertRating: rating,
    });
  }

  /**
   * Track search refinement
   */
  trackSearchRefinement(
    originalQuery: string,
    refinedQuery: string,
    refinementType: 'filter' | 'sort' | 'modify'
  ): void {
    if (!this.config.enableTracking) return;

    this.trackEvent('search_refined', {
      originalQuery: this.anonymizeQuery(originalQuery),
      refinedQuery: this.anonymizeQuery(refinedQuery),
      refinementType,
    });

    // Update refinement rate
    this.updateUserBehavior('refine', {
      originalQuery,
      refinedQuery,
      refinementType,
    });

    // Mark original search as needing refinement
    this.updateSearchQuality(originalQuery, {
      refinementNeeded: true,
    });
  }

  /**
   * Track export operations
   */
  trackExport(format: string, resultCount: number, query?: string): void {
    if (!this.config.enableTracking) return;

    this.trackEvent('export_performed', {
      format,
      resultCount,
      query: query ? this.anonymizeQuery(query) : undefined,
    });

    this.updateUserBehavior('export', {
      format,
      resultCount,
    });
  }

  /**
   * Track errors
   */
  trackError(
    error: Error,
    context: {
      operation: string;
      query?: string;
      userId?: string;
    }
  ): void {
    if (!this.config.enableErrorTracking) return;

    this.trackEvent('error_occurred', {
      errorMessage: error.message,
      errorStack: error.stack,
      operation: context.operation,
      query: context.query ? this.anonymizeQuery(context.query) : undefined,
      timestamp: Date.now(),
    });

    // Update system error metrics
    this.updateSystemErrorMetrics(error, context);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(timeRange?: { from: number; to: number }): {
    searchLatency: SystemHealthMetrics['searchLatency'];
    throughput: SystemHealthMetrics['throughput'];
    cachePerformance: SystemHealthMetrics['cachePerformance'];
  } {
    const metrics = this.filterMetricsByTimeRange(this.performanceBuffer, timeRange);

    const latencies = metrics.map(m => m.searchTime);
    latencies.sort((a, b) => a - b);

    const searchLatency = {
      p50: this.percentile(latencies, 50),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
      average: latencies.reduce((sum, val) => sum + val, 0) / latencies.length || 0,
    };

    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    const recentMetrics = this.performanceBuffer.filter(m => m.timestamp > oneHourAgo);
    const throughput = {
      requestsPerSecond: recentMetrics.filter(m => m.timestamp > oneSecondAgo).length,
      requestsPerMinute: recentMetrics.filter(m => m.timestamp > oneMinuteAgo).length,
      requestsPerHour: recentMetrics.length,
    };

    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const cachePerformance = {
      hitRate: metrics.length > 0 ? cacheHits / metrics.length : 0,
      missRate: metrics.length > 0 ? (metrics.length - cacheHits) / metrics.length : 0,
      evictionRate: 0, // Would need cache eviction data
    };

    return { searchLatency, throughput, cachePerformance };
  }

  /**
   * Get user behavior analytics
   */
  getUserBehaviorMetrics(userId?: string): UserBehaviorMetrics[] {
    if (userId) {
      const metrics = this.userSessions.get(userId);
      return metrics ? [metrics] : [];
    }

    return Array.from(this.userSessions.values());
  }

  /**
   * Get search quality metrics
   */
  getSearchQualityMetrics(query?: string): SearchQualityMetrics[] {
    if (query) {
      return this.qualityMetrics.filter(m => m.query === this.anonymizeQuery(query));
    }

    return [...this.qualityMetrics];
  }

  /**
   * Get system health status
   */
  getSystemHealth(): SystemHealthMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Generate analytics report
   */
  generateReport(timeRange: { from: number; to: number }, format: 'json' | 'csv' = 'json'): any {
    const events = this.eventBuffer.filter(
      e => e.timestamp >= timeRange.from && e.timestamp <= timeRange.to
    );

    const performance = this.getPerformanceMetrics(timeRange);
    const userBehavior = this.getUserBehaviorMetrics();
    const searchQuality = this.getSearchQualityMetrics();
    const systemHealth = this.getSystemHealth();

    const report = {
      timeRange,
      summary: {
        totalEvents: events.length,
        totalSearches: events.filter(e => e.type === 'search_performed').length,
        totalClicks: events.filter(e => e.type === 'result_clicked').length,
        totalErrors: events.filter(e => e.type === 'error_occurred').length,
        uniqueUsers: new Set(events.map(e => e.userId).filter(Boolean)).size,
      },
      performance,
      userBehavior: this.aggregateUserBehavior(userBehavior),
      searchQuality: this.aggregateSearchQuality(searchQuality),
      systemHealth,
      topQueries: this.getTopQueries(events),
      errorAnalysis: this.analyzeErrors(events),
    };

    if (format === 'csv') {
      return this.convertToCSV(report);
    }

    return report;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'lastTriggered'>): void {
    this.alertRules.push({ ...rule, lastTriggered: undefined });
  }

  /**
   * Export analytics data
   */
  async exportData(
    format: 'json' | 'csv' | 'excel',
    timeRange?: { from: number; to: number }
  ): Promise<Blob> {
    if (!this.config.enableExport) {
      throw new Error('Data export is disabled');
    }

    const data = this.generateReport(
      timeRange || { from: 0, to: Date.now() },
      format === 'csv' ? 'csv' : 'json'
    );

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });

      case 'csv':
        return new Blob([data], { type: 'text/csv' });

      case 'excel':
        // This would require a library like xlsx
        // For now, return JSON
        return new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Private Methods
   */

  private trackEvent(type: AnalyticsEventType, data: any): void {
    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      userId: this.getCurrentUserId(),
      sessionId: this.getCurrentSessionId(),
      data,
      metadata: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        version: '1.0.0', // Would come from app version
      },
    };

    this.eventBuffer.push(event);

    // Process batch if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.processBatch();
    }
  }

  private trackPerformanceMetric(metrics: SearchPerformanceMetrics): void {
    this.performanceBuffer.push({
      ...metrics,
      timestamp: Date.now(),
    } as any);

    // Keep buffer size manageable
    if (this.performanceBuffer.length > 1000) {
      this.performanceBuffer.shift();
    }

    // Update system metrics
    this.updateSystemMetrics(metrics);
  }

  private updateUserBehavior(action: string, data: any): void {
    const userId = this.getCurrentUserId();
    const sessionId = this.getCurrentSessionId();

    if (!userId) return;

    let metrics = this.userSessions.get(userId);
    if (!metrics) {
      metrics = {
        userId,
        sessionId,
        searchCount: 0,
        averageSearchTime: 0,
        clickThroughRate: 0,
        refinementRate: 0,
        exportCount: 0,
        averageSessionDuration: 0,
        popularQueries: [],
        preferredCategories: [],
      };
      this.userSessions.set(userId, metrics);
    }

    switch (action) {
      case 'search':
        metrics.searchCount++;
        metrics.averageSearchTime = (metrics.averageSearchTime + data.searchTime) / 2;
        this.updatePopularQueries(metrics, data.query);
        break;

      case 'click':
        // Update CTR calculation
        const totalClicks = metrics.clickThroughRate * metrics.searchCount + 1;
        metrics.clickThroughRate = totalClicks / metrics.searchCount;
        break;

      case 'refine':
        const totalRefinements = metrics.refinementRate * metrics.searchCount + 1;
        metrics.refinementRate = totalRefinements / metrics.searchCount;
        break;

      case 'export':
        metrics.exportCount++;
        break;
    }
  }

  private trackSearchQuality(quality: SearchQualityMetrics): void {
    this.qualityMetrics.push(quality);

    // Keep buffer size manageable
    if (this.qualityMetrics.length > 1000) {
      this.qualityMetrics.shift();
    }
  }

  private updateSearchQuality(query: string, updates: Partial<SearchQualityMetrics>): void {
    const anonymizedQuery = this.anonymizeQuery(query);
    const existing = this.qualityMetrics.find(m => m.query === anonymizedQuery);

    if (existing) {
      Object.assign(existing, updates);
    }
  }

  private startBatchProcessing(): void {
    this.batchTimer = setInterval(() => {
      if (this.eventBuffer.length > 0) {
        this.processBatch();
      }
    }, this.config.batchTimeout);
  }

  private processBatch(): void {
    const batch = [...this.eventBuffer];
    this.eventBuffer = [];

    // Send to analytics backend (simulated)
    this.sendToBackend(batch);

    // Emit batch processed event
    this.emit('batchProcessed', { size: batch.length });
  }

  private sendToBackend(events: AnalyticsEvent[]): void {
    // In a real implementation, this would send to an analytics service
    console.log(`Processing analytics batch of ${events.length} events`);

    // Simulate API call
    if (window.electronAPI?.sendAnalytics) {
      window.electronAPI.sendAnalytics(events).catch(console.error);
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectSystemMetrics();
      this.checkAlerts();
    }, 30000); // Every 30 seconds
  }

  private collectSystemMetrics(): void {
    // This would collect real system metrics
    // For now, simulate some metrics
    this.systemMetrics.resourceUsage = {
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      cpuUsage: Math.random() * 100, // Simulated
      indexSize: this.performanceBuffer.length * 1000, // Estimated
    };
  }

  private checkAlerts(): void {
    for (const rule of this.alertRules) {
      // Check cooldown period
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownPeriod) {
        continue;
      }

      if (rule.condition(this.systemMetrics)) {
        rule.lastTriggered = Date.now();
        this.emit('alert', {
          ruleId: rule.id,
          name: rule.name,
          severity: rule.severity,
          timestamp: Date.now(),
          metrics: this.systemMetrics,
        });
      }
    }
  }

  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlertRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: metrics => metrics.errorRate.percentage > 5,
      severity: 'high',
      cooldownPeriod: 5 * 60 * 1000, // 5 minutes
    });

    // High latency alert
    this.addAlertRule({
      id: 'high-latency',
      name: 'High Search Latency',
      condition: metrics => metrics.searchLatency.p95 > 2000, // 2 seconds
      severity: 'medium',
      cooldownPeriod: 5 * 60 * 1000,
    });

    // Low cache hit rate alert
    this.addAlertRule({
      id: 'low-cache-hit-rate',
      name: 'Low Cache Hit Rate',
      condition: metrics => metrics.cachePerformance.hitRate < 0.5,
      severity: 'medium',
      cooldownPeriod: 10 * 60 * 1000, // 10 minutes
    });
  }

  private initializeSystemMetrics(): SystemHealthMetrics {
    return {
      searchLatency: { p50: 0, p95: 0, p99: 0, average: 0 },
      throughput: { requestsPerSecond: 0, requestsPerMinute: 0, requestsPerHour: 0 },
      errorRate: { total: 0, percentage: 0, byType: {} },
      cachePerformance: { hitRate: 0, missRate: 0, evictionRate: 0 },
      resourceUsage: { memoryUsage: 0, cpuUsage: 0, indexSize: 0 },
    };
  }

  private updateSystemMetrics(performanceMetrics: SearchPerformanceMetrics): void {
    // Update latency metrics
    const latencies = this.performanceBuffer.map(m => m.searchTime);
    if (latencies.length > 0) {
      latencies.sort((a, b) => a - b);
      this.systemMetrics.searchLatency = {
        p50: this.percentile(latencies, 50),
        p95: this.percentile(latencies, 95),
        p99: this.percentile(latencies, 99),
        average: latencies.reduce((sum, val) => sum + val, 0) / latencies.length,
      };
    }

    // Update cache metrics
    const cacheHits = this.performanceBuffer.filter(m => m.cacheHit).length;
    const total = this.performanceBuffer.length;
    if (total > 0) {
      this.systemMetrics.cachePerformance.hitRate = cacheHits / total;
      this.systemMetrics.cachePerformance.missRate = (total - cacheHits) / total;
    }
  }

  private updateSystemErrorMetrics(error: Error, context: any): void {
    this.systemMetrics.errorRate.total++;

    const errorType = context.operation || 'unknown';
    this.systemMetrics.errorRate.byType[errorType] =
      (this.systemMetrics.errorRate.byType[errorType] || 0) + 1;

    // Calculate error percentage over recent operations
    const recentOperations = this.performanceBuffer.length + this.systemMetrics.errorRate.total;
    this.systemMetrics.errorRate.percentage =
      (this.systemMetrics.errorRate.total / recentOperations) * 100;
  }

  // Utility methods
  private anonymizeQuery(query: string): string {
    if (!this.config.anonymizeData) return query;

    // Simple anonymization - replace with hash
    return btoa(query).substring(0, 16);
  }

  private sanitizeOptions(options: SearchOptions): any {
    // Remove sensitive data from options
    const { userId, sessionId, ...sanitized } = options as any;
    return sanitized;
  }

  private sanitizeFeedback(feedback: string): string {
    // Remove potentially sensitive information
    return feedback.replace(/\b\w+@\w+\.\w+\b/g, '[email]').replace(/\b\d{4}\b/g, '[year]');
  }

  private calculateRelevanceScore(results: SearchResult[]): number {
    if (results.length === 0) return 0;

    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    return averageScore / 100; // Normalize to 0-1
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;

    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  }

  private filterMetricsByTimeRange(
    metrics: any[],
    timeRange?: { from: number; to: number }
  ): any[] {
    if (!timeRange) return metrics;

    return metrics.filter(m => m.timestamp >= timeRange.from && m.timestamp <= timeRange.to);
  }

  private updatePopularQueries(metrics: UserBehaviorMetrics, query: string): void {
    const existing = metrics.popularQueries.find(pq => pq.query === query);
    if (existing) {
      existing.count++;
    } else {
      metrics.popularQueries.push({ query, count: 1 });
    }

    // Keep top 10
    metrics.popularQueries = metrics.popularQueries.sort((a, b) => b.count - a.count).slice(0, 10);
  }

  private aggregateUserBehavior(behaviors: UserBehaviorMetrics[]): any {
    if (behaviors.length === 0) return {};

    return {
      totalUsers: behaviors.length,
      averageSearches: behaviors.reduce((sum, b) => sum + b.searchCount, 0) / behaviors.length,
      averageCTR: behaviors.reduce((sum, b) => sum + b.clickThroughRate, 0) / behaviors.length,
      averageRefinementRate:
        behaviors.reduce((sum, b) => sum + b.refinementRate, 0) / behaviors.length,
      topQueries: this.mergePopularQueries(behaviors.map(b => b.popularQueries)),
    };
  }

  private aggregateSearchQuality(qualities: SearchQualityMetrics[]): any {
    if (qualities.length === 0) return {};

    const avgRelevance =
      qualities.reduce((sum, q) => sum + q.resultRelevance, 0) / qualities.length;
    const zeroResultRate = qualities.filter(q => q.zeroResultRate > 0).length / qualities.length;
    const avgClickPosition =
      qualities.filter(q => q.clickPosition > 0).reduce((sum, q) => sum + q.clickPosition, 0) /
      qualities.length;

    return {
      averageRelevance: avgRelevance,
      zeroResultRate,
      averageClickPosition: avgClickPosition || 0,
      refinementRate: qualities.filter(q => q.refinementNeeded).length / qualities.length,
    };
  }

  private getTopQueries(events: AnalyticsEvent[]): Array<{ query: string; count: number }> {
    const queryCount = new Map<string, number>();

    events
      .filter(e => e.type === 'search_performed' && e.data.query)
      .forEach(e => {
        const query = e.data.query;
        queryCount.set(query, (queryCount.get(query) || 0) + 1);
      });

    return Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private analyzeErrors(events: AnalyticsEvent[]): any {
    const errors = events.filter(e => e.type === 'error_occurred');
    const errorsByType = new Map<string, number>();

    errors.forEach(e => {
      const operation = e.data.operation || 'unknown';
      errorsByType.set(operation, (errorsByType.get(operation) || 0) + 1);
    });

    return {
      totalErrors: errors.length,
      errorsByType: Object.fromEntries(errorsByType),
      recentErrors: errors.slice(-10).map(e => ({
        timestamp: e.timestamp,
        operation: e.data.operation,
        message: e.data.errorMessage,
      })),
    };
  }

  private mergePopularQueries(
    queryArrays: Array<{ query: string; count: number }[]>
  ): Array<{ query: string; count: number }> {
    const merged = new Map<string, number>();

    queryArrays.forEach(queries => {
      queries.forEach(({ query, count }) => {
        merged.set(query, (merged.get(query) || 0) + count);
      });
    });

    return Array.from(merged.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in real implementation would be more sophisticated
    return JSON.stringify(data);
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUserId(): string {
    return localStorage.getItem('userId') || 'anonymous';
  }

  private getCurrentSessionId(): string {
    return localStorage.getItem('sessionId') || this.generateEventId();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Process remaining events
    if (this.eventBuffer.length > 0) {
      this.processBatch();
    }

    this.removeAllListeners();
  }
}

export default SearchAnalyticsService;
