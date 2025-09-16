/**
 * SearchMetrics - Real-time search performance monitoring
 *
 * Features:
 * - Real-time performance metrics visualization
 * - Response time tracking with SLA indicators
 * - Cache hit rate monitoring
 * - Search success rate analytics
 * - Performance trends and alerts
 */

import React, { useState, useMemo, useEffect } from 'react';
import './SearchMetrics.css';

export interface PerformanceMetrics {
  autocompleteResponseTime: number[];
  searchExecutionTime: number[];
  cacheHitRate: number;
  totalSearches: number;
}

export interface SearchMetricsProps {
  metrics: PerformanceMetrics;
  onClose: () => void;
  refreshInterval?: number;
  showTrends?: boolean;
}

interface MetricStats {
  current: number;
  average: number;
  p95: number;
  trend: 'up' | 'down' | 'stable';
  slaCompliant: boolean;
}

export const SearchMetrics: React.FC<SearchMetricsProps> = ({
  metrics,
  onClose,
  refreshInterval = 5000,
  showTrends = true
}) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Calculate autocomplete stats
  const autocompleteStats = useMemo((): MetricStats => {
    const times = metrics.autocompleteResponseTime.slice(-20); // Last 20 measurements

    if (times.length === 0) {
      return {
        current: 0,
        average: 0,
        p95: 0,
        trend: 'stable',
        slaCompliant: true
      };
    }

    const current = times[times.length - 1] || 0;
    const average = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

    // Calculate trend (comparing last 5 vs previous 5)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (times.length >= 10) {
      const recent = times.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const previous = times.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
      const change = (recent - previous) / previous;

      if (change > 0.1) trend = 'up';
      else if (change < -0.1) trend = 'down';
    }

    return {
      current: Math.round(current),
      average: Math.round(average),
      p95: Math.round(p95),
      trend,
      slaCompliant: p95 < 100 // SLA: <100ms for autocomplete
    };
  }, [metrics.autocompleteResponseTime, lastUpdate]);

  // Calculate search execution stats
  const searchStats = useMemo((): MetricStats => {
    const times = metrics.searchExecutionTime.slice(-20);

    if (times.length === 0) {
      return {
        current: 0,
        average: 0,
        p95: 0,
        trend: 'stable',
        slaCompliant: true
      };
    }

    const current = times[times.length - 1] || 0;
    const average = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (times.length >= 10) {
      const recent = times.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const previous = times.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
      const change = (recent - previous) / previous;

      if (change > 0.1) trend = 'up';
      else if (change < -0.1) trend = 'down';
    }

    return {
      current: Math.round(current),
      average: Math.round(average),
      p95: Math.round(p95),
      trend,
      slaCompliant: p95 < 1000 // SLA: <1s for search execution
    };
  }, [metrics.searchExecutionTime, lastUpdate]);

  // Performance status
  const overallStatus = useMemo(() => {
    if (!autocompleteStats.slaCompliant || !searchStats.slaCompliant) {
      return 'error';
    }

    if (autocompleteStats.trend === 'up' || searchStats.trend === 'up') {
      return 'warning';
    }

    return 'good';
  }, [autocompleteStats, searchStats]);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '⚪';
    }
  };

  return (
    <div className="search-metrics-panel">
      {/* Header */}
      <div className="metrics-header">
        <div className="header-title">
          <h3>Search Performance Metrics</h3>
          <div className={`status-indicator ${overallStatus}`}>
            {getStatusIcon(overallStatus)}
            <span className="status-text">
              {overallStatus === 'good' && 'All systems optimal'}
              {overallStatus === 'warning' && 'Performance degrading'}
              {overallStatus === 'error' && 'SLA breach detected'}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close metrics panel"
        >
          ✕
        </button>
      </div>

      {/* Metrics Content */}
      <div className="metrics-content">
        {/* Autocomplete Performance */}
        <div className="metric-section">
          <div className="metric-header">
            <h4>Autocomplete Response Time</h4>
            <div className="sla-indicator">
              SLA: &lt;100ms {autocompleteStats.slaCompliant ? '✅' : '❌'}
            </div>
          </div>

          <div className="metric-stats">
            <div className="stat-item">
              <label>Current</label>
              <div className="stat-value">
                <span className="value">{autocompleteStats.current}ms</span>
                {showTrends && (
                  <span className="trend">{getTrendIcon(autocompleteStats.trend)}</span>
                )}
              </div>
            </div>

            <div className="stat-item">
              <label>Average</label>
              <div className="stat-value">
                <span className="value">{autocompleteStats.average}ms</span>
              </div>
            </div>

            <div className="stat-item">
              <label>95th Percentile</label>
              <div className="stat-value">
                <span className={`value ${!autocompleteStats.slaCompliant ? 'sla-breach' : ''}`}>
                  {autocompleteStats.p95}ms
                </span>
              </div>
            </div>
          </div>

          {/* Mini Chart */}
          <div className="mini-chart">
            <div className="chart-bars">
              {metrics.autocompleteResponseTime.slice(-10).map((time, index) => (
                <div
                  key={index}
                  className="chart-bar"
                  style={{
                    height: `${Math.min(100, (time / 200) * 100)}%`,
                    backgroundColor: time > 100 ? '#ff4757' : '#2ed573'
                  }}
                  title={`${Math.round(time)}ms`}
                />
              ))}
            </div>
            <div className="chart-labels">
              <span>Last 10 requests</span>
            </div>
          </div>
        </div>

        {/* Search Execution Performance */}
        <div className="metric-section">
          <div className="metric-header">
            <h4>Search Execution Time</h4>
            <div className="sla-indicator">
              SLA: &lt;1000ms {searchStats.slaCompliant ? '✅' : '❌'}
            </div>
          </div>

          <div className="metric-stats">
            <div className="stat-item">
              <label>Current</label>
              <div className="stat-value">
                <span className="value">{searchStats.current}ms</span>
                {showTrends && (
                  <span className="trend">{getTrendIcon(searchStats.trend)}</span>
                )}
              </div>
            </div>

            <div className="stat-item">
              <label>Average</label>
              <div className="stat-value">
                <span className="value">{searchStats.average}ms</span>
              </div>
            </div>

            <div className="stat-item">
              <label>95th Percentile</label>
              <div className="stat-value">
                <span className={`value ${!searchStats.slaCompliant ? 'sla-breach' : ''}`}>
                  {searchStats.p95}ms
                </span>
              </div>
            </div>
          </div>

          {/* Mini Chart */}
          <div className="mini-chart">
            <div className="chart-bars">
              {metrics.searchExecutionTime.slice(-10).map((time, index) => (
                <div
                  key={index}
                  className="chart-bar"
                  style={{
                    height: `${Math.min(100, (time / 2000) * 100)}%`,
                    backgroundColor: time > 1000 ? '#ff4757' : '#2ed573'
                  }}
                  title={`${Math.round(time)}ms`}
                />
              ))}
            </div>
            <div className="chart-labels">
              <span>Last 10 searches</span>
            </div>
          </div>
        </div>

        {/* Cache Performance */}
        <div className="metric-section">
          <div className="metric-header">
            <h4>Cache Performance</h4>
          </div>

          <div className="metric-stats">
            <div className="stat-item">
              <label>Hit Rate</label>
              <div className="stat-value">
                <span className="value">{Math.round(metrics.cacheHitRate * 100)}%</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${metrics.cacheHitRate * 100}%`,
                      backgroundColor: metrics.cacheHitRate > 0.8 ? '#2ed573' :
                                     metrics.cacheHitRate > 0.6 ? '#ffa502' : '#ff4757'
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="stat-item">
              <label>Total Searches</label>
              <div className="stat-value">
                <span className="value">{metrics.totalSearches.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Recommendations */}
        <div className="recommendations">
          <h4>Recommendations</h4>
          <div className="recommendation-list">
            {!autocompleteStats.slaCompliant && (
              <div className="recommendation warning">
                <span className="icon">⚠️</span>
                <span>Autocomplete response time exceeds SLA. Consider cache warming or index optimization.</span>
              </div>
            )}

            {!searchStats.slaCompliant && (
              <div className="recommendation warning">
                <span className="icon">⚠️</span>
                <span>Search execution time exceeds SLA. Check database query optimization.</span>
              </div>
            )}

            {metrics.cacheHitRate < 0.6 && (
              <div className="recommendation info">
                <span className="icon">💡</span>
                <span>Low cache hit rate. Consider increasing cache TTL or pre-warming popular searches.</span>
              </div>
            )}

            {overallStatus === 'good' && (
              <div className="recommendation good">
                <span className="icon">✅</span>
                <span>All performance metrics are within acceptable ranges.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="metrics-footer">
        <div className="update-info">
          <span>Last updated: {new Date(lastUpdate).toLocaleTimeString()}</span>
          <span>Auto-refresh: {refreshInterval / 1000}s</span>
        </div>
      </div>
    </div>
  );
};

export default SearchMetrics;