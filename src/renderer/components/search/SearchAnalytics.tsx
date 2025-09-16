import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SearchQuery } from '../../../types/services';
import { formatDate, formatRelativeTime } from '../../utils/formatters';
import './SearchAnalytics.css';

interface SearchAnalyticsProps {
  searchHistory: SearchQuery[];
  className?: string;
  timeframe?: '24h' | '7d' | '30d' | 'all';
  showCharts?: boolean;
  realTimeMetrics?: {
    cacheHitRate: number;
    averageSearchTime: number;
    p95SearchTime: number;
    queryOptimizationCacheSize: number;
    recentPerformance: { operation: string; avg: number; p95: number }[];
  };
  onRefresh?: () => void;
  autoRefresh?: boolean;
}

interface AnalyticsData {
  summary: {
    totalSearches: number;
    uniqueQueries: number;
    avgResponseTime: number;
    successRate: number;
    aiUsageRate: number;
    topCategories: string[];
  };
  performance: {
    fastSearches: number; // <500ms
    normalSearches: number; // 500ms-1s
    slowSearches: number; // >1s
    avgByHour: Array<{ hour: number; avgTime: number; count: number }>;
  };
  trends: {
    searchesByDay: Array<{ date: string; count: number }>;
    topQueries: Array<{ query: string; count: number; avgResults: number }>;
    categoryDistribution: Array<{ category: string; count: number; percentage: number }>;
  };
  insights: string[];
}

/**
 * Search Analytics Dashboard Component
 * 
 * Features:
 * - Performance metrics and trends
 * - Search pattern analysis
 * - Usage statistics
 * - Performance optimization insights
 * - Visual charts and graphs
 * - Actionable recommendations
 */
export const SearchAnalytics: React.FC<SearchAnalyticsProps> = ({
  searchHistory,
  className = '',
  timeframe = '7d',
  showCharts = true,
  realTimeMetrics,
  onRefresh,
  autoRefresh = false
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trends' | 'insights' | 'realtime'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  // Manual refresh with loading state
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500); // Show loading for at least 500ms
    }
  }, [onRefresh, isRefreshing]);

  // Filter search history based on timeframe
  const filteredHistory = useMemo(() => {
    if (timeframe === 'all') return searchHistory;
    
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeframe) {
      case '24h':
        cutoff.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoff.setDate(now.getDate() - 30);
        break;
    }
    
    return searchHistory.filter(search => search.timestamp >= cutoff);
  }, [searchHistory, timeframe]);

  // Calculate analytics data
  const analyticsData = useMemo<AnalyticsData>(() => {
    if (filteredHistory.length === 0) {
      return {
        summary: {
          totalSearches: 0,
          uniqueQueries: 0,
          avgResponseTime: 0,
          successRate: 0,
          aiUsageRate: 0,
          topCategories: []
        },
        performance: {
          fastSearches: 0,
          normalSearches: 0,
          slowSearches: 0,
          avgByHour: []
        },
        trends: {
          searchesByDay: [],
          topQueries: [],
          categoryDistribution: []
        },
        insights: []
      };
    }

    // Summary calculations
    const totalSearches = filteredHistory.length;
    const uniqueQueries = new Set(filteredHistory.map(s => s.text.toLowerCase())).size;
    
    // Mock response times (in real app, this would come from metadata)
    const responseTimes = filteredHistory.map(() => Math.random() * 2000 + 100);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    const aiUsageRate = filteredHistory.filter(s => s.options.useAI).length / totalSearches;
    
    // Performance analysis
    const fastSearches = responseTimes.filter(t => t < 500).length;
    const normalSearches = responseTimes.filter(t => t >= 500 && t <= 1000).length;
    const slowSearches = responseTimes.filter(t => t > 1000).length;
    
    // Hourly performance distribution
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({
      hour,
      avgTime: 0,
      count: 0
    }));
    
    filteredHistory.forEach((search, index) => {
      const hour = search.timestamp.getHours();
      hourlyData[hour].count++;
      hourlyData[hour].avgTime += responseTimes[index];
    });
    
    hourlyData.forEach(data => {
      if (data.count > 0) {
        data.avgTime = data.avgTime / data.count;
      }
    });

    // Trends analysis
    const dailySearches = new Map<string, number>();
    filteredHistory.forEach(search => {
      const dateKey = search.timestamp.toISOString().split('T')[0];
      dailySearches.set(dateKey, (dailySearches.get(dateKey) || 0) + 1);
    });
    
    const searchesByDay = Array.from(dailySearches.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top queries
    const queryCount = new Map<string, number>();
    filteredHistory.forEach(search => {
      const query = search.text.toLowerCase();
      queryCount.set(query, (queryCount.get(query) || 0) + 1);
    });
    
    const topQueries = Array.from(queryCount.entries())
      .map(([query, count]) => ({
        query,
        count,
        avgResults: Math.floor(Math.random() * 10) + 1 // Mock data
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Category distribution
    const categoryCount = new Map<string, number>();
    filteredHistory.forEach(search => {
      const category = search.options.category || 'Uncategorized';
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    });
    
    const categoryDistribution = Array.from(categoryCount.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / totalSearches) * 100
      }))
      .sort((a, b) => b.count - a.count);

    const topCategories = categoryDistribution.slice(0, 3).map(c => c.category);

    // Generate insights
    const insights: string[] = [];
    
    if (avgResponseTime > 1000) {
      insights.push('⚠️ Average response time is above 1 second. Consider optimizing search index.');
    }
    
    if (fastSearches / totalSearches > 0.8) {
      insights.push('🚀 Excellent performance! 80%+ of searches are under 500ms.');
    }
    
    if (aiUsageRate < 0.3) {
      insights.push('🤖 AI search usage is low. Users might benefit from more AI-enhanced results.');
    } else if (aiUsageRate > 0.8) {
      insights.push('🎯 High AI usage detected. Monitor for potential API costs.');
    }
    
    if (uniqueQueries / totalSearches < 0.3) {
      insights.push('🔄 Many repeated searches detected. Consider improving search suggestions.');
    }
    
    if (topQueries.length > 0 && topQueries[0].count > totalSearches * 0.3) {
      insights.push(`📈 "${topQueries[0].query}" is searched very frequently. Consider featured content.`);
    }
    
    const weekdaySearches = filteredHistory.filter(s => {
      const day = s.timestamp.getDay();
      return day >= 1 && day <= 5; // Monday to Friday
    }).length;
    
    if (weekdaySearches / totalSearches > 0.8) {
      insights.push('📊 Most searches happen on weekdays. Consider business hours optimization.');
    }

    return {
      summary: {
        totalSearches,
        uniqueQueries,
        avgResponseTime,
        successRate: 0.85, // Mock data
        aiUsageRate,
        topCategories
      },
      performance: {
        fastSearches,
        normalSearches,
        slowSearches,
        avgByHour: hourlyData
      },
      trends: {
        searchesByDay,
        topQueries,
        categoryDistribution
      },
      insights
    };
  }, [filteredHistory]);

  // Format time display
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Generate performance chart (simplified ASCII-style visualization)
  const renderPerformanceChart = () => {
    const { avgByHour } = analyticsData.performance;
    const maxTime = Math.max(...avgByHour.map(d => d.avgTime), 1);
    
    return (
      <div className="performance-chart">
        <div className="chart-title">Average Response Time by Hour</div>
        <div className="chart-bars">
          {avgByHour.map(({ hour, avgTime, count }) => (
            <div key={hour} className="chart-bar">
              <div className="bar-container">
                <div 
                  className={`bar ${avgTime > 1000 ? 'bar--slow' : avgTime > 500 ? 'bar--normal' : 'bar--fast'}`}
                  style={{ height: `${(avgTime / maxTime) * 100}%` }}
                  title={`${hour}:00 - ${formatTime(avgTime)} (${count} searches)`}
                />
              </div>
              <div className="bar-label">{hour}</div>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-color legend-color--fast" />
            Fast (&lt;500ms)
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--normal" />
            Normal (500ms-1s)
          </span>
          <span className="legend-item">
            <span className="legend-color legend-color--slow" />
            Slow (&gt;1s)
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={`search-analytics ${className}`}>
      <div className="search-analytics__header">
        <div className="search-analytics__title-section">
          <h3 className="search-analytics__title">
            <span className="icon">📊</span>
            Search Analytics
          </h3>
          <div className="search-analytics__timeframe">
            <span className="timeframe-label">Last {timeframe}</span>
            {autoRefresh && (
              <span className="auto-refresh-indicator">
                <span className="indicator-dot"></span>
                Live
              </span>
            )}
          </div>
        </div>
        <div className="search-analytics__controls">
          {onRefresh && (
            <button
              className={`btn btn--refresh ${isRefreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh analytics data"
            >
              <span className="icon">🔄</span>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      <div className="search-analytics__tabs">
        {(['overview', 'performance', 'trends', 'insights', ...(realTimeMetrics ? ['realtime'] as const : [])] as const).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'realtime' ? 'Real-time' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="search-analytics__content">
        {activeTab === 'overview' && (
          <div className="analytics-section">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-card__icon">🔍</div>
                <div className="metric-card__value">{analyticsData.summary.totalSearches}</div>
                <div className="metric-card__label">Total Searches</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-card__icon">📝</div>
                <div className="metric-card__value">{analyticsData.summary.uniqueQueries}</div>
                <div className="metric-card__label">Unique Queries</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-card__icon">⚡</div>
                <div className="metric-card__value">{formatTime(analyticsData.summary.avgResponseTime)}</div>
                <div className="metric-card__label">Avg Response</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-card__icon">🤖</div>
                <div className="metric-card__value">{Math.round(analyticsData.summary.aiUsageRate * 100)}%</div>
                <div className="metric-card__label">AI Usage</div>
              </div>
            </div>

            <div className="overview-details">
              <div className="detail-section">
                <h4 className="detail-title">Performance Distribution</h4>
                <div className="performance-breakdown">
                  <div className="breakdown-item breakdown-item--fast">
                    <span className="breakdown-count">{analyticsData.performance.fastSearches}</span>
                    <span className="breakdown-label">Fast (&lt;500ms)</span>
                  </div>
                  <div className="breakdown-item breakdown-item--normal">
                    <span className="breakdown-count">{analyticsData.performance.normalSearches}</span>
                    <span className="breakdown-label">Normal (500ms-1s)</span>
                  </div>
                  <div className="breakdown-item breakdown-item--slow">
                    <span className="breakdown-count">{analyticsData.performance.slowSearches}</span>
                    <span className="breakdown-label">Slow (&gt;1s)</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4 className="detail-title">Top Categories</h4>
                <div className="category-list">
                  {analyticsData.summary.topCategories.map(category => (
                    <span key={category} className="category-tag">{category}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="analytics-section">
            {showCharts && renderPerformanceChart()}
            
            <div className="performance-details">
              <div className="detail-section">
                <h4 className="detail-title">Performance Targets</h4>
                <div className="target-list">
                  <div className={`target ${analyticsData.summary.avgResponseTime < 500 ? 'target--met' : ''}`}>
                    <span className="target__icon">🎯</span>
                    <span className="target__label">Excellent: &lt;500ms average</span>
                    <span className="target__status">
                      {analyticsData.summary.avgResponseTime < 500 ? '✅' : '❌'}
                    </span>
                  </div>
                  <div className={`target ${analyticsData.summary.avgResponseTime < 1000 ? 'target--met' : ''}`}>
                    <span className="target__icon">✅</span>
                    <span className="target__label">Good: &lt;1000ms average</span>
                    <span className="target__status">
                      {analyticsData.summary.avgResponseTime < 1000 ? '✅' : '❌'}
                    </span>
                  </div>
                  <div className={`target ${(analyticsData.performance.fastSearches / analyticsData.summary.totalSearches) > 0.7 ? 'target--met' : ''}`}>
                    <span className="target__icon">🚀</span>
                    <span className="target__label">70%+ fast searches</span>
                    <span className="target__status">
                      {(analyticsData.performance.fastSearches / analyticsData.summary.totalSearches) > 0.7 ? '✅' : '❌'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="analytics-section">
            <div className="trends-grid">
              <div className="trend-section">
                <h4 className="trend-title">Top Search Queries</h4>
                <div className="query-list">
                  {analyticsData.trends.topQueries.slice(0, 5).map((query, index) => (
                    <div key={query.query} className="query-item">
                      <span className="query-rank">#{index + 1}</span>
                      <span className="query-text">{query.query}</span>
                      <span className="query-count">{query.count}x</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="trend-section">
                <h4 className="trend-title">Category Distribution</h4>
                <div className="category-breakdown">
                  {analyticsData.trends.categoryDistribution.slice(0, 5).map(category => (
                    <div key={category.category} className="category-item">
                      <span className="category-name">{category.category}</span>
                      <div className="category-bar">
                        <div 
                          className="category-bar__fill"
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                      <span className="category-percentage">{Math.round(category.percentage)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="analytics-section">
            <div className="insights-list">
              {analyticsData.insights.length === 0 ? (
                <div className="empty-insights">
                  <span className="empty-insights__icon">💡</span>
                  <p className="empty-insights__text">
                    No specific insights available yet. Keep using the search to generate recommendations.
                  </p>
                </div>
              ) : (
                analyticsData.insights.map((insight, index) => (
                  <div key={index} className="insight-item">
                    <div className="insight-content">{insight}</div>
                  </div>
                ))
              )}
            </div>

            <div className="recommendations">
              <h4 className="recommendations__title">General Recommendations</h4>
              <ul className="recommendations__list">
                <li>Monitor search response times to maintain &lt;1s target</li>
                <li>Review frequently searched terms for content opportunities</li>
                <li>Consider caching for popular search results</li>
                <li>Use AI search patterns to improve knowledge base organization</li>
                <li>Track user satisfaction to optimize search relevance</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'realtime' && realTimeMetrics && (
          <div className="analytics-section">
            <div className="realtime-header">
              <h4 className="realtime-title">
                <span className="icon">🔴</span>
                Live Performance Metrics
              </h4>
              <div className="realtime-status">
                <span className="status-dot status-dot--live"></span>
                <span className="status-text">Live Data</span>
                <span className="update-time">
                  Updated {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="realtime-metrics-grid">
              <div className="realtime-metric">
                <div className="metric-header">
                  <span className="metric-icon">🚀</span>
                  <span className="metric-title">Cache Hit Rate</span>
                </div>
                <div className="metric-value">
                  {(realTimeMetrics.cacheHitRate * 100).toFixed(1)}%
                </div>
                <div className="metric-description">
                  Percentage of searches served from cache
                </div>
                <div className={`metric-status ${realTimeMetrics.cacheHitRate > 0.8 ? 'status--good' : realTimeMetrics.cacheHitRate > 0.6 ? 'status--warning' : 'status--poor'}`}>
                  {realTimeMetrics.cacheHitRate > 0.8 ? 'Excellent' : realTimeMetrics.cacheHitRate > 0.6 ? 'Good' : 'Needs Attention'}
                </div>
              </div>

              <div className="realtime-metric">
                <div className="metric-header">
                  <span className="metric-icon">⚡</span>
                  <span className="metric-title">Average Response</span>
                </div>
                <div className="metric-value">
                  {formatTime(realTimeMetrics.averageSearchTime)}
                </div>
                <div className="metric-description">
                  Current average search response time
                </div>
                <div className={`metric-status ${realTimeMetrics.averageSearchTime < 500 ? 'status--good' : realTimeMetrics.averageSearchTime < 1000 ? 'status--warning' : 'status--poor'}`}>
                  {realTimeMetrics.averageSearchTime < 500 ? 'Fast' : realTimeMetrics.averageSearchTime < 1000 ? 'Acceptable' : 'Slow'}
                </div>
              </div>

              <div className="realtime-metric">
                <div className="metric-header">
                  <span className="metric-icon">📊</span>
                  <span className="metric-title">P95 Response</span>
                </div>
                <div className="metric-value">
                  {formatTime(realTimeMetrics.p95SearchTime)}
                </div>
                <div className="metric-description">
                  95th percentile response time
                </div>
                <div className={`metric-status ${realTimeMetrics.p95SearchTime < 1000 ? 'status--good' : realTimeMetrics.p95SearchTime < 2000 ? 'status--warning' : 'status--poor'}`}>
                  {realTimeMetrics.p95SearchTime < 1000 ? 'Excellent' : realTimeMetrics.p95SearchTime < 2000 ? 'Good' : 'Needs Attention'}
                </div>
              </div>

              <div className="realtime-metric">
                <div className="metric-header">
                  <span className="metric-icon">🧠</span>
                  <span className="metric-title">Query Cache Size</span>
                </div>
                <div className="metric-value">
                  {realTimeMetrics.queryOptimizationCacheSize}
                </div>
                <div className="metric-description">
                  Optimized queries in cache
                </div>
                <div className="metric-status status--info">
                  {realTimeMetrics.queryOptimizationCacheSize > 100 ? 'Well Populated' : 'Building Up'}
                </div>
              </div>
            </div>

            {realTimeMetrics.recentPerformance && realTimeMetrics.recentPerformance.length > 0 && (
              <div className="performance-breakdown-realtime">
                <h4 className="breakdown-title">Operation Performance Breakdown</h4>
                <div className="performance-table">
                  <div className="table-header">
                    <div className="table-cell">Operation</div>
                    <div className="table-cell">Average</div>
                    <div className="table-cell">95th Percentile</div>
                    <div className="table-cell">Status</div>
                  </div>
                  {realTimeMetrics.recentPerformance.map((perf, index) => (
                    <div key={index} className="table-row">
                      <div className="table-cell">
                        <span className="operation-name">{perf.operation.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="table-cell">
                        <span className="performance-value">{formatTime(perf.avg)}</span>
                      </div>
                      <div className="table-cell">
                        <span className="performance-value">{formatTime(perf.p95)}</span>
                      </div>
                      <div className="table-cell">
                        <span className={`performance-status ${perf.avg < 500 ? 'status--good' : perf.avg < 1000 ? 'status--warning' : 'status--poor'}`}>
                          {perf.avg < 500 ? '🟢' : perf.avg < 1000 ? '🟡' : '🔴'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="realtime-footer">
              <p className="footer-note">
                💡 <strong>Tip:</strong> Real-time metrics help identify performance issues immediately.
                Monitor cache hit rates and response times to maintain optimal search experience.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchAnalytics;