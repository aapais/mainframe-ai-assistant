import React, { useState, useEffect, useMemo } from 'react';
import './PerformanceIndicator.css';

interface RealTimeMetrics {
  cacheHitRate: number;
  averageSearchTime: number;
  p95SearchTime: number;
  queryOptimizationCacheSize: number;
  recentPerformance: Array<{ operation: string; avg: number; p95: number }>;
}

interface PerformanceIndicatorProps {
  searchTime: number;
  resultCount: number;
  isLoading: boolean;
  cacheHit?: boolean;
  aiUsed?: boolean;
  fallbackUsed?: boolean;
  className?: string;
  showDetails?: boolean;
  realTimeMetrics?: RealTimeMetrics | null;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  searchCount: number;
  cacheHitRate: number;
  aiUsageRate: number;
  fallbackRate: number;
  fastSearches: number; // searches under 1s
  slowSearches: number; // searches over 2s
}

/**
 * Performance Indicator Component
 * 
 * Features:
 * - Real-time search performance display
 * - <1s response time highlighting
 * - Cache hit indicators
 * - AI usage tracking
 * - Performance trends
 * - Visual performance meter
 */
export const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  searchTime,
  resultCount,
  isLoading,
  cacheHit = false,
  aiUsed = false,
  fallbackUsed = false,
  className = '',
  showDetails = false,
  realTimeMetrics
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    averageResponseTime: 0,
    searchCount: 0,
    cacheHitRate: 0,
    aiUsageRate: 0,
    fallbackRate: 0,
    fastSearches: 0,
    slowSearches: 0
  });
  const [expanded, setExpanded] = useState(false);

  // Update metrics when new search completes
  useEffect(() => {
    if (searchTime > 0) {
      setMetrics(prev => {
        const newSearchCount = prev.searchCount + 1;
        const newAverageTime = ((prev.averageResponseTime * prev.searchCount) + searchTime) / newSearchCount;
        
        return {
          averageResponseTime: newAverageTime,
          searchCount: newSearchCount,
          cacheHitRate: ((prev.cacheHitRate * prev.searchCount) + (cacheHit ? 1 : 0)) / newSearchCount,
          aiUsageRate: ((prev.aiUsageRate * prev.searchCount) + (aiUsed ? 1 : 0)) / newSearchCount,
          fallbackRate: ((prev.fallbackRate * prev.searchCount) + (fallbackUsed ? 1 : 0)) / newSearchCount,
          fastSearches: prev.fastSearches + (searchTime < 1000 ? 1 : 0),
          slowSearches: prev.slowSearches + (searchTime > 2000 ? 1 : 0)
        };
      });
    }
  }, [searchTime, cacheHit, aiUsed, fallbackUsed]);

  // Performance status based on search time
  const performanceStatus = useMemo(() => {
    if (isLoading) return 'loading';
    if (searchTime === 0) return 'idle';
    if (searchTime < 500) return 'excellent';
    if (searchTime < 1000) return 'good';
    if (searchTime < 2000) return 'fair';
    return 'slow';
  }, [searchTime, isLoading]);

  // Performance color and icon
  const performanceConfig = useMemo(() => {
    const configs = {
      loading: { color: '#3b82f6', icon: '⏳', label: 'Searching...', message: 'Processing query' },
      idle: { color: '#6b7280', icon: '⚪', label: 'Ready', message: 'Enter search query' },
      excellent: { color: '#10b981', icon: '🚀', label: 'Excellent', message: 'Lightning fast!' },
      good: { color: '#22c55e', icon: '✅', label: 'Good', message: 'Under 1 second' },
      fair: { color: '#f59e0b', icon: '⚠️', label: 'Fair', message: 'Slightly slow' },
      slow: { color: '#ef4444', icon: '🐌', label: 'Slow', message: 'Performance issue' }
    };
    return configs[performanceStatus];
  }, [performanceStatus]);

  // Format time display
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Calculate performance score (0-100)
  const performanceScore = useMemo(() => {
    if (searchTime === 0) return 0;
    // Score based on how close to 1000ms target
    const score = Math.max(0, 100 - ((searchTime - 200) / 1800) * 100);
    return Math.round(Math.min(100, score));
  }, [searchTime]);

  return (
    <div className={`performance-indicator ${className} performance-indicator--${performanceStatus}`}>
      <div 
        className="performance-indicator__main"
        onClick={() => showDetails && setExpanded(!expanded)}
        role={showDetails ? 'button' : undefined}
        tabIndex={showDetails ? 0 : undefined}
        aria-expanded={showDetails ? expanded : undefined}
      >
        <div className="performance-indicator__status">
          <span className="performance-indicator__icon">
            {performanceConfig.icon}
          </span>
          
          <div className="performance-indicator__text">
            <div className="performance-indicator__label">
              {performanceConfig.label}
            </div>
            <div className="performance-indicator__time">
              {isLoading ? 'Searching...' : searchTime > 0 ? formatTime(searchTime) : 'Ready'}
            </div>
          </div>
        </div>

        {searchTime > 0 && (
          <div className="performance-indicator__meter">
            <div 
              className="performance-indicator__bar"
              style={{ 
                width: `${performanceScore}%`,
                backgroundColor: performanceConfig.color
              }}
            />
            <div className="performance-indicator__target" />
          </div>
        )}

        <div className="performance-indicator__badges">
          {cacheHit && (
            <span className="badge badge--cache" title="Cache hit - faster response">
              💾
            </span>
          )}
          {aiUsed && (
            <span className="badge badge--ai" title="AI enhanced search">
              🤖
            </span>
          )}
          {fallbackUsed && (
            <span className="badge badge--fallback" title="Fallback to local search">
              🔄
            </span>
          )}
          {resultCount > 0 && (
            <span className="badge badge--results" title={`${resultCount} results found`}>
              {resultCount}
            </span>
          )}
        </div>

        {showDetails && (
          <div className="performance-indicator__expand">
            <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>▼</span>
          </div>
        )}
      </div>

      {showDetails && expanded && (
        <div className="performance-indicator__details">
          <div className="performance-details">
            <div className="performance-details__section">
              <h4 className="performance-details__title">Current Search</h4>
              <div className="performance-details__grid">
                <div className="metric">
                  <span className="metric__label">Response Time:</span>
                  <span className="metric__value">{formatTime(searchTime)}</span>
                </div>
                <div className="metric">
                  <span className="metric__label">Results:</span>
                  <span className="metric__value">{resultCount}</span>
                </div>
                <div className="metric">
                  <span className="metric__label">Performance:</span>
                  <span className="metric__value">{performanceScore}/100</span>
                </div>
                <div className="metric">
                  <span className="metric__label">Source:</span>
                  <span className="metric__value">
                    {cacheHit ? 'Cache' : aiUsed ? 'AI + DB' : 'Database'}
                  </span>
                </div>
              </div>
            </div>

            {(metrics.searchCount > 0 || realTimeMetrics) && (
              <div className="performance-details__section">
                <h4 className="performance-details__title">
                  {realTimeMetrics ? 'Real-Time Statistics' : 'Session Statistics'}
                </h4>
                <div className="performance-details__grid">
                  {realTimeMetrics ? (
                    <>
                      <div className="metric">
                        <span className="metric__label">Cache Hit Rate:</span>
                        <span className="metric__value">
                          {Math.round(realTimeMetrics.cacheHitRate * 100)}%
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">Avg Response:</span>
                        <span className="metric__value">{formatTime(realTimeMetrics.averageSearchTime)}</span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">P95 Response:</span>
                        <span className="metric__value">{formatTime(realTimeMetrics.p95SearchTime)}</span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">Cache Size:</span>
                        <span className="metric__value">{realTimeMetrics.queryOptimizationCacheSize}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="metric">
                        <span className="metric__label">Total Searches:</span>
                        <span className="metric__value">{metrics.searchCount}</span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">Avg Response:</span>
                        <span className="metric__value">{formatTime(metrics.averageResponseTime)}</span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">Fast Searches:</span>
                        <span className="metric__value">
                          {metrics.fastSearches} ({Math.round((metrics.fastSearches / metrics.searchCount) * 100)}%)
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">Cache Hit Rate:</span>
                        <span className="metric__value">
                          {Math.round(metrics.cacheHitRate * 100)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {realTimeMetrics && realTimeMetrics.recentPerformance.length > 0 && (
              <div className="performance-details__section">
                <h4 className="performance-details__title">Operation Performance</h4>
                <div className="performance-table">
                  <div className="performance-table__header">
                    <span className="col-operation">Operation</span>
                    <span className="col-avg">Avg</span>
                    <span className="col-p95">P95</span>
                    <span className="col-status">Status</span>
                  </div>
                  {realTimeMetrics.recentPerformance.map((perf, index) => {
                    const status = perf.operation === 'autocomplete'
                      ? perf.p95 < 50 ? 'excellent' : perf.p95 < 100 ? 'good' : 'slow'
                      : perf.p95 < 500 ? 'excellent' : perf.p95 < 1000 ? 'good' : 'slow';

                    return (
                      <div key={index} className={`performance-table__row performance-table__row--${status}`}>
                        <span className="col-operation">
                          {perf.operation === 'autocomplete' ? '⚡ Autocomplete' : '🔍 Search'}
                        </span>
                        <span className="col-avg">{formatTime(perf.avg)}</span>
                        <span className="col-p95">{formatTime(perf.p95)}</span>
                        <span className="col-status">
                          {status === 'excellent' ? '🚀' : status === 'good' ? '✅' : '⚠️'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="performance-details__section">
              <h4 className="performance-details__title">Performance Targets</h4>
              <div className="target-list">
                <div className={`target ${searchTime < 500 ? 'target--met' : ''}`}>
                  <span className="target__icon">🎯</span>
                  <span className="target__label">Excellent: &lt;500ms</span>
                  <span className="target__status">
                    {searchTime < 500 ? '✅' : searchTime > 0 ? '❌' : '⏳'}
                  </span>
                </div>
                <div className={`target ${searchTime < 1000 ? 'target--met' : ''}`}>
                  <span className="target__icon">✅</span>
                  <span className="target__label">Good: &lt;1000ms</span>
                  <span className="target__status">
                    {searchTime < 1000 ? '✅' : searchTime > 0 ? '❌' : '⏳'}
                  </span>
                </div>
                <div className={`target ${searchTime < 2000 ? 'target--met' : ''}`}>
                  <span className="target__icon">⚠️</span>
                  <span className="target__label">Acceptable: &lt;2000ms</span>
                  <span className="target__status">
                    {searchTime < 2000 ? '✅' : searchTime > 0 ? '❌' : '⏳'}
                  </span>
                </div>
              </div>
            </div>

            {(metrics.fallbackRate > 0 || fallbackUsed) && (
              <div className="performance-details__section">
                <h4 className="performance-details__title">Performance Notes</h4>
                <div className="performance-notes">
                  {fallbackUsed && (
                    <div className="note note--warning">
                      <span className="note__icon">🔄</span>
                      <span className="note__text">
                        AI search failed, used local fallback
                      </span>
                    </div>
                  )}
                  {metrics.fallbackRate > 0.2 && (
                    <div className="note note--info">
                      <span className="note__icon">💡</span>
                      <span className="note__text">
                        High fallback rate ({Math.round(metrics.fallbackRate * 100)}%) - 
                        check AI service configuration
                      </span>
                    </div>
                  )}
                  {metrics.slowSearches > metrics.fastSearches && metrics.searchCount > 3 && (
                    <div className="note note--warning">
                      <span className="note__icon">⚠️</span>
                      <span className="note__text">
                        Many slow searches detected - consider optimizing search index
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick status tooltip for compact view */}
      {!showDetails && searchTime > 0 && (
        <div className="performance-indicator__tooltip">
          <div className="tooltip-content">
            <div className="tooltip-title">{performanceConfig.label} Performance</div>
            <div className="tooltip-text">{performanceConfig.message}</div>
            <div className="tooltip-details">
              <span>Time: {formatTime(searchTime)}</span>
              <span>Results: {resultCount}</span>
              {cacheHit && <span>✅ Cache Hit</span>}
              {aiUsed && <span>🤖 AI Enhanced</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceIndicator;