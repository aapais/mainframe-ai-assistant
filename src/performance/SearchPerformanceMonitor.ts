/**
 * Search Performance Monitor
 * Tracks search response times with <1s target
 */

import { EventEmitter } from 'events';

export interface SearchPerformanceMetrics {
  query: string;
  startTime: number;
  endTime: number;
  responseTime: number;
  resultCount: number;
  isTargetMet: boolean; // < 1000ms target
  cacheHit: boolean;
  searchType: 'basic' | 'advanced' | 'fuzzy' | 'semantic';
  filters: Record<string, any>;
  errorOccurred: boolean;
  errorMessage?: string;
}

export interface SearchPerformanceSummary {
  totalSearches: number;
  averageResponseTime: number;
  targetMeetRate: number;
  cacheHitRate: number;
  errorRate: number;
  slowestQuery: SearchPerformanceMetrics | null;
  fastestQuery: SearchPerformanceMetrics | null;
}

export class SearchPerformanceMonitor extends EventEmitter {
  private metrics: SearchPerformanceMetrics[] = [];
  private activeSearches: Map<string, Partial<SearchPerformanceMetrics>> = new Map();
  private targetResponseTime = 1000; // 1 second
  private maxHistorySize = 10000;

  constructor(targetResponseTime = 1000) {
    super();
    this.targetResponseTime = targetResponseTime;
  }

  /**
   * Start tracking a search operation
   */
  public startSearch(
    query: string,
    searchType: 'basic' | 'advanced' | 'fuzzy' | 'semantic' = 'basic',
    filters: Record<string, any> = {}
  ): string {
    const searchId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    const searchMetrics: Partial<SearchPerformanceMetrics> = {
      query,
      startTime,
      searchType,
      filters,
      cacheHit: false,
      errorOccurred: false
    };

    this.activeSearches.set(searchId, searchMetrics);

    // Track via main process if available
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.trackSearchStart(query).catch(console.error);
    }

    return searchId;
  }

  /**
   * End tracking a search operation
   */
  public endSearch(
    searchId: string,
    resultCount: number,
    cacheHit = false,
    error?: string
  ): SearchPerformanceMetrics | null {
    const searchData = this.activeSearches.get(searchId);

    if (!searchData) {
      console.warn('Search tracking ID not found:', searchId);
      return null;
    }

    const endTime = performance.now();
    const responseTime = endTime - (searchData.startTime || 0);

    const metrics: SearchPerformanceMetrics = {
      query: searchData.query || '',
      startTime: searchData.startTime || 0,
      endTime,
      responseTime,
      resultCount,
      isTargetMet: responseTime <= this.targetResponseTime,
      cacheHit,
      searchType: searchData.searchType || 'basic',
      filters: searchData.filters || {},
      errorOccurred: !!error,
      errorMessage: error
    };

    this.activeSearches.delete(searchId);
    this.metrics.push(metrics);

    // Emit events
    this.emit('search-completed', metrics);

    if (!metrics.isTargetMet) {
      this.emit('performance-violation', {
        type: 'search-response-time',
        query: metrics.query,
        responseTime: metrics.responseTime,
        target: this.targetResponseTime,
        message: `Search "${metrics.query}" took ${responseTime.toFixed(2)}ms, exceeding target of ${this.targetResponseTime}ms`
      });
    }

    if (metrics.errorOccurred) {
      this.emit('search-error', {
        query: metrics.query,
        error: metrics.errorMessage,
        responseTime: metrics.responseTime
      });
    }

    // Track via main process if available
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.trackSearchEnd(searchId).catch(console.error);
    }

    // Keep history size manageable
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-Math.floor(this.maxHistorySize * 0.8));
    }

    return metrics;
  }

  /**
   * Track a complete search operation
   */
  public async trackSearch<T>(
    query: string,
    searchFunction: () => Promise<T>,
    searchType: 'basic' | 'advanced' | 'fuzzy' | 'semantic' = 'basic',
    filters: Record<string, any> = {}
  ): Promise<T> {
    const searchId = this.startSearch(query, searchType, filters);

    try {
      const result = await searchFunction();

      // Extract result count if possible
      let resultCount = 0;
      if (Array.isArray(result)) {
        resultCount = result.length;
      } else if (result && typeof result === 'object' && 'length' in result) {
        resultCount = (result as any).length;
      } else if (result && typeof result === 'object' && 'results' in result) {
        const results = (result as any).results;
        resultCount = Array.isArray(results) ? results.length : 0;
      }

      this.endSearch(searchId, resultCount);
      return result;
    } catch (error) {
      this.endSearch(searchId, 0, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get search performance metrics
   */
  public getMetrics(count?: number): SearchPerformanceMetrics[] {
    if (!count) return [...this.metrics];
    return this.metrics.slice(-count);
  }

  /**
   * Get search performance summary
   */
  public getSummary(): SearchPerformanceSummary {
    if (this.metrics.length === 0) {
      return {
        totalSearches: 0,
        averageResponseTime: 0,
        targetMeetRate: 0,
        cacheHitRate: 0,
        errorRate: 0,
        slowestQuery: null,
        fastestQuery: null
      };
    }

    const totalSearches = this.metrics.length;
    const averageResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalSearches;
    const targetMeets = this.metrics.filter(m => m.isTargetMet).length;
    const cacheHits = this.metrics.filter(m => m.cacheHit).length;
    const errors = this.metrics.filter(m => m.errorOccurred).length;

    const slowestQuery = this.metrics.reduce((slowest, current) =>
      !slowest || current.responseTime > slowest.responseTime ? current : slowest);

    const fastestQuery = this.metrics.reduce((fastest, current) =>
      !fastest || current.responseTime < fastest.responseTime ? current : fastest);

    return {
      totalSearches,
      averageResponseTime,
      targetMeetRate: targetMeets / totalSearches,
      cacheHitRate: cacheHits / totalSearches,
      errorRate: errors / totalSearches,
      slowestQuery,
      fastestQuery
    };
  }

  /**
   * Get metrics by search type
   */
  public getMetricsByType(searchType: 'basic' | 'advanced' | 'fuzzy' | 'semantic'): SearchPerformanceMetrics[] {
    return this.metrics.filter(m => m.searchType === searchType);
  }

  /**
   * Get metrics within time range
   */
  public getMetricsInTimeRange(startTime: number, endTime: number): SearchPerformanceMetrics[] {
    return this.metrics.filter(m => m.startTime >= startTime && m.endTime <= endTime);
  }

  /**
   * Get slow queries (above target)
   */
  public getSlowQueries(): SearchPerformanceMetrics[] {
    return this.metrics.filter(m => !m.isTargetMet);
  }

  /**
   * Get cache performance data
   */
  public getCachePerformance(): {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    averageCacheHitTime: number;
    averageCacheMissTime: number;
  } {
    const totalQueries = this.metrics.length;
    const cacheHits = this.metrics.filter(m => m.cacheHit);
    const cacheMisses = this.metrics.filter(m => !m.cacheHit);

    const averageCacheHitTime = cacheHits.length > 0
      ? cacheHits.reduce((sum, m) => sum + m.responseTime, 0) / cacheHits.length
      : 0;

    const averageCacheMissTime = cacheMisses.length > 0
      ? cacheMisses.reduce((sum, m) => sum + m.responseTime, 0) / cacheMisses.length
      : 0;

    return {
      totalQueries,
      cacheHits: cacheHits.length,
      cacheMisses: cacheMisses.length,
      hitRate: totalQueries > 0 ? cacheHits.length / totalQueries : 0,
      averageCacheHitTime,
      averageCacheMissTime
    };
  }

  /**
   * Get query patterns and analysis
   */
  public getQueryAnalysis(): {
    totalUniqueQueries: number;
    mostFrequentQueries: { query: string; count: number; averageTime: number }[];
    queryLengthDistribution: { min: number; max: number; average: number };
    performanceByQueryLength: { length: number; averageTime: number }[];
  } {
    const queryMap = new Map<string, { count: number; totalTime: number; times: number[] }>();

    // Aggregate query data
    this.metrics.forEach(m => {
      const existing = queryMap.get(m.query);
      if (existing) {
        existing.count++;
        existing.totalTime += m.responseTime;
        existing.times.push(m.responseTime);
      } else {
        queryMap.set(m.query, {
          count: 1,
          totalTime: m.responseTime,
          times: [m.responseTime]
        });
      }
    });

    // Most frequent queries
    const mostFrequentQueries = Array.from(queryMap.entries())
      .map(([query, data]) => ({
        query,
        count: data.count,
        averageTime: data.totalTime / data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Query length analysis
    const queryLengths = this.metrics.map(m => m.query.length);
    const queryLengthDistribution = {
      min: Math.min(...queryLengths),
      max: Math.max(...queryLengths),
      average: queryLengths.reduce((sum, length) => sum + length, 0) / queryLengths.length
    };

    // Performance by query length
    const lengthGroups = new Map<number, { totalTime: number; count: number }>();
    this.metrics.forEach(m => {
      const lengthGroup = Math.floor(m.query.length / 10) * 10; // Group by 10s
      const existing = lengthGroups.get(lengthGroup);
      if (existing) {
        existing.totalTime += m.responseTime;
        existing.count++;
      } else {
        lengthGroups.set(lengthGroup, { totalTime: m.responseTime, count: 1 });
      }
    });

    const performanceByQueryLength = Array.from(lengthGroups.entries())
      .map(([length, data]) => ({
        length,
        averageTime: data.totalTime / data.count
      }))
      .sort((a, b) => a.length - b.length);

    return {
      totalUniqueQueries: queryMap.size,
      mostFrequentQueries,
      queryLengthDistribution,
      performanceByQueryLength
    };
  }

  /**
   * Export search performance data
   */
  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'query', 'startTime', 'endTime', 'responseTime', 'resultCount',
        'isTargetMet', 'cacheHit', 'searchType', 'errorOccurred', 'errorMessage'
      ];

      const rows = this.metrics.map(m => [
        `"${m.query.replace(/"/g, '""')}"`, // Escape quotes in CSV
        m.startTime,
        m.endTime,
        m.responseTime,
        m.resultCount,
        m.isTargetMet,
        m.cacheHit,
        m.searchType,
        m.errorOccurred,
        m.errorMessage ? `"${m.errorMessage.replace(/"/g, '""')}"` : ''
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify({
      metrics: this.metrics,
      summary: this.getSummary(),
      cachePerformance: this.getCachePerformance(),
      queryAnalysis: this.getQueryAnalysis()
    }, null, 2);
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics = [];
    this.activeSearches.clear();
    this.emit('metrics-reset');
  }

  /**
   * Set target response time
   */
  public setTargetResponseTime(targetMs: number): void {
    this.targetResponseTime = targetMs;
    this.emit('target-updated', targetMs);
  }

  /**
   * Get current target response time
   */
  public getTargetResponseTime(): number {
    return this.targetResponseTime;
  }
}

export default SearchPerformanceMonitor;