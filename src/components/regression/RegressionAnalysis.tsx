import React, { useState, useEffect, useMemo } from 'react';
import { RegressionData, PerformanceMetric } from '../../types/performance';

interface RegressionAnalysisProps {
  performanceService: any;
  timeRange?: string;
  metrics?: string[];
  onRegressionSelect?: (regression: RegressionData) => void;
}

interface RegressionItemProps {
  regression: RegressionData;
  onSelect: () => void;
  onStatusChange: (status: string) => void;
}

const RegressionItem: React.FC<RegressionItemProps> = ({
  regression,
  onSelect,
  onStatusChange
}) => {
  const [expanded, setExpanded] = useState(false);

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getSignificanceIcon = (significance: string) => {
    switch (significance) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getChangeDirection = (changePercent: number) => {
    if (changePercent > 0) return { icon: '📈', text: 'increase', color: '#ef4444' };
    if (changePercent < 0) return { icon: '📉', text: 'decrease', color: '#10b981' };
    return { icon: '➡️', text: 'stable', color: '#6b7280' };
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatMetricValue = (value: number, metric: string) => {
    if (metric.includes('time') || metric.includes('latency')) {
      return value < 1000 ? `${value.toFixed(0)}ms` : `${(value / 1000).toFixed(2)}s`;
    }
    if (metric.includes('memory') || metric.includes('size')) {
      return value < 1024 ? `${value.toFixed(1)}MB` : `${(value / 1024).toFixed(2)}GB`;
    }
    if (metric.includes('rate') || metric.includes('percent')) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  const change = getChangeDirection(regression.changePercent);

  return (
    <div className={`regression-item significance-${regression.significance} status-${regression.status}`}>
      <div className="regression-header" onClick={() => setExpanded(!expanded)}>
        <div className="regression-main">
          <div className="regression-significance">
            <span className="significance-icon">{getSignificanceIcon(regression.significance)}</span>
            <span className="significance-text">{regression.significance.toUpperCase()}</span>
          </div>

          <div className="regression-content">
            <h4 className="regression-metric">{regression.metric}</h4>
            <div className="regression-change">
              <span className="change-icon">{change.icon}</span>
              <span className="change-text" style={{ color: change.color }}>
                {Math.abs(regression.changePercent).toFixed(1)}% {change.text}
              </span>
              <span className="change-values">
                ({formatMetricValue(regression.previousValue, regression.metric)} → {formatMetricValue(regression.currentValue, regression.metric)})
              </span>
            </div>
          </div>
        </div>

        <div className="regression-meta">
          <div className="confidence-badge">
            {(regression.confidence * 100).toFixed(0)}% confidence
          </div>
          <div className="timestamp">
            {formatTimestamp(regression.timestamp)}
          </div>
        </div>

        <div className="regression-actions">
          <select
            value={regression.status}
            onChange={(e) => onStatusChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="status-select"
          >
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="false-positive">False Positive</option>
          </select>

          <button
            className="expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="regression-details">
          <div className="details-grid">
            <div className="detail-section">
              <h5>Analysis Details</h5>
              <div className="detail-items">
                <div className="detail-item">
                  <label>Regression ID:</label>
                  <span>{regression.id}</span>
                </div>
                <div className="detail-item">
                  <label>Detection Time:</label>
                  <span>{formatTimestamp(regression.timestamp)}</span>
                </div>
                <div className="detail-item">
                  <label>Confidence Level:</label>
                  <span>{(regression.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="detail-item">
                  <label>Significance:</label>
                  <span style={{ color: getSignificanceColor(regression.significance) }}>
                    {regression.significance}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h5>Performance Impact</h5>
              <div className="detail-items">
                <div className="detail-item">
                  <label>Previous Value:</label>
                  <span>{formatMetricValue(regression.previousValue, regression.metric)}</span>
                </div>
                <div className="detail-item">
                  <label>Current Value:</label>
                  <span>{formatMetricValue(regression.currentValue, regression.metric)}</span>
                </div>
                <div className="detail-item">
                  <label>Change:</label>
                  <span style={{ color: change.color }}>
                    {regression.changePercent > 0 ? '+' : ''}{regression.changePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="detail-item">
                  <label>Absolute Change:</label>
                  <span>
                    {formatMetricValue(
                      Math.abs(regression.currentValue - regression.previousValue),
                      regression.metric
                    )}
                  </span>
                </div>
              </div>
            </div>

            {regression.cause && (
              <div className="detail-section full-width">
                <h5>Potential Cause</h5>
                <p className="cause-description">{regression.cause}</p>
              </div>
            )}
          </div>

          <div className="regression-timeline">
            <h5>Related Events</h5>
            <div className="timeline-placeholder">
              <p>Timeline view showing deployments, configuration changes, and other events around the regression detection time.</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .regression-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-left: 4px solid ${getSignificanceColor(regression.significance)};
          border-radius: 8px;
          margin-bottom: 1rem;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .regression-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .regression-header {
          display: flex;
          align-items: center;
          padding: 1.25rem;
          cursor: pointer;
        }

        .regression-main {
          display: flex;
          align-items: center;
          flex: 1;
          gap: 1rem;
        }

        .regression-significance {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 120px;
        }

        .significance-icon {
          font-size: 1.2rem;
        }

        .significance-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: ${getSignificanceColor(regression.significance)};
        }

        .regression-content {
          flex: 1;
        }

        .regression-metric {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .regression-change {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .change-icon {
          font-size: 1rem;
        }

        .change-text {
          font-weight: 600;
        }

        .change-values {
          color: var(--text-secondary);
          font-size: 0.8rem;
        }

        .regression-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          margin-right: 1rem;
        }

        .confidence-badge {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .timestamp {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .regression-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-select {
          padding: 0.25rem 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.8rem;
        }

        .expand-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--bg-primary);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .expand-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
        }

        .regression-details {
          border-top: 1px solid var(--border-color);
          padding: 1.25rem;
          background: var(--bg-tertiary);
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .detail-section {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 1rem;
        }

        .detail-section.full-width {
          grid-column: 1 / -1;
        }

        .detail-section h5 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-items {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-item label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .detail-item span {
          font-size: 0.8rem;
          color: var(--text-primary);
          font-weight: 600;
        }

        .cause-description {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-primary);
          line-height: 1.5;
        }

        .regression-timeline {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 1rem;
        }

        .regression-timeline h5 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          text-transform: uppercase;
        }

        .timeline-placeholder {
          color: var(--text-secondary);
          font-size: 0.875rem;
          font-style: italic;
          text-align: center;
          padding: 1rem;
          border: 2px dashed var(--border-color);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export const RegressionAnalysis: React.FC<RegressionAnalysisProps> = ({
  performanceService,
  timeRange = '7d',
  metrics = [],
  onRegressionSelect
}) => {
  const [regressions, setRegressions] = useState<RegressionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'investigating' | 'resolved' | 'false-positive'>('all');

  useEffect(() => {
    loadRegressions();
  }, [performanceService, timeRange, metrics]);

  const loadRegressions = async () => {
    try {
      setLoading(true);
      const data = await performanceService.getRegressions(timeRange, filter === 'all' ? undefined : filter);
      setRegressions(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load regressions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRegressions = useMemo(() => {
    let filtered = regressions;

    if (filter !== 'all') {
      filtered = filtered.filter(r => r.significance === filter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (metrics.length > 0) {
      filtered = filtered.filter(r => metrics.includes(r.metric));
    }

    return filtered.sort((a, b) => {
      // Sort by significance first, then by timestamp
      const significanceOrder = { high: 3, medium: 2, low: 1 };
      const aScore = significanceOrder[a.significance] || 0;
      const bScore = significanceOrder[b.significance] || 0;

      if (aScore !== bScore) {
        return bScore - aScore;
      }

      return b.timestamp - a.timestamp;
    });
  }, [regressions, filter, statusFilter, metrics]);

  const regressionStats = useMemo(() => {
    return regressions.reduce((stats, regression) => {
      stats.total = (stats.total || 0) + 1;
      stats[regression.significance] = (stats[regression.significance] || 0) + 1;
      stats[regression.status] = (stats[regression.status] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
  }, [regressions]);

  const handleStatusChange = async (regressionId: string, newStatus: string) => {
    try {
      // Update regression status
      setRegressions(prev =>
        prev.map(r =>
          r.id === regressionId ? { ...r, status: newStatus as any } : r
        )
      );

      // In a real implementation, this would call the API
      console.log(`Updated regression ${regressionId} status to ${newStatus}`);
    } catch (err) {
      console.error('Failed to update regression status:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="regression-analysis loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Analyzing performance regressions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="regression-analysis">
      <div className="analysis-header">
        <h2>Performance Regression Analysis</h2>

        <div className="regression-stats">
          <div className="stat-item">
            <span className="stat-value">{regressionStats.total || 0}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item high">
            <span className="stat-value">{regressionStats.high || 0}</span>
            <span className="stat-label">High</span>
          </div>
          <div className="stat-item medium">
            <span className="stat-value">{regressionStats.medium || 0}</span>
            <span className="stat-label">Medium</span>
          </div>
          <div className="stat-item low">
            <span className="stat-value">{regressionStats.low || 0}</span>
            <span className="stat-label">Low</span>
          </div>
        </div>
      </div>

      <div className="analysis-controls">
        <div className="filter-group">
          <label>Significance:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All Severities</option>
            <option value="high">High Only</option>
            <option value="medium">Medium Only</option>
            <option value="low">Low Only</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All Status</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="false-positive">False Positive</option>
          </select>
        </div>

        <button onClick={loadRegressions} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="regressions-list">
        {filteredRegressions.length === 0 ? (
          <div className="no-regressions">
            <span className="no-regressions-icon">📈</span>
            <h3>No performance regressions detected</h3>
            <p>All metrics are performing within expected ranges.</p>
            {(filter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setFilter('all');
                  setStatusFilter('all');
                }}
                className="reset-filters-btn"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          filteredRegressions.map(regression => (
            <RegressionItem
              key={regression.id}
              regression={regression}
              onSelect={() => onRegressionSelect?.(regression)}
              onStatusChange={(status) => handleStatusChange(regression.id, status)}
            />
          ))
        )}
      </div>

      <style jsx>{`
        .regression-analysis {
          background: var(--bg-primary);
          border-radius: 8px;
          overflow: hidden;
        }

        .analysis-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .analysis-header h2 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .regression-stats {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--bg-tertiary);
          border-radius: 8px;
          min-width: 80px;
        }

        .stat-item.high {
          background: #fef2f2;
          color: #ef4444;
        }

        .stat-item.medium {
          background: #fffbeb;
          color: #f59e0b;
        }

        .stat-item.low {
          background: #f0fdf4;
          color: #10b981;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }

        .stat-label {
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          margin-top: 0.25rem;
        }

        .analysis-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-tertiary);
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .filter-group label {
          color: var(--text-secondary);
          font-weight: 500;
        }

        .filter-group select {
          padding: 0.25rem 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .refresh-btn {
          padding: 0.5rem 1rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          margin-left: auto;
        }

        .refresh-btn:hover {
          background: var(--color-primary-dark);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          background: #fef2f2;
          color: #ef4444;
          border-bottom: 1px solid var(--border-color);
        }

        .error-banner button {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 1.2rem;
          margin-left: auto;
        }

        .regressions-list {
          padding: 1.5rem;
          max-height: 800px;
          overflow-y: auto;
        }

        .no-regressions {
          text-align: center;
          padding: 3rem 2rem;
          color: var(--text-secondary);
        }

        .no-regressions-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        .no-regressions h3 {
          margin: 0 0 0.5rem 0;
          color: var(--text-primary);
          font-size: 1.25rem;
        }

        .no-regressions p {
          margin: 0 0 1.5rem 0;
          font-size: 0.9rem;
        }

        .reset-filters-btn {
          padding: 0.5rem 1rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--border-color);
          border-top: 4px solid var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RegressionAnalysis;