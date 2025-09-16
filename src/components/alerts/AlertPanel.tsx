import React, { useState, useMemo } from 'react';
import { PerformanceAlert } from '../../types/performance';

interface AlertPanelProps {
  alerts: PerformanceAlert[];
  onAlertAction: (alertId: string, action: string) => void;
  compact?: boolean;
  maxVisible?: number;
}

interface AlertItemProps {
  alert: PerformanceAlert;
  onAction: (action: string) => void;
  compact?: boolean;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onAction, compact = false }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📊';
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { text: 'Active', color: '#ef4444', bg: '#fef2f2' },
      resolved: { text: 'Resolved', color: '#10b981', bg: '#f0fdf4' },
      muted: { text: 'Muted', color: '#6b7280', bg: '#f9fafb' }
    };

    const badge = badges[status] || badges.active;
    return (
      <span
        className="status-badge"
        style={{
          color: badge.color,
          backgroundColor: badge.bg,
          border: `1px solid ${badge.color}30`
        }}
      >
        {badge.text}
      </span>
    );
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 24 * 60) {
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className={`alert-item severity-${alert.severity} status-${alert.status} ${compact ? 'compact' : ''}`}>
      <div className="alert-header" onClick={() => setShowDetails(!showDetails)}>
        <div className="alert-main">
          <div className="alert-severity">
            <span className="severity-icon">{getSeverityIcon(alert.severity)}</span>
            <span className="severity-text">{alert.severity.toUpperCase()}</span>
          </div>

          <div className="alert-content">
            <h4 className="alert-title">{alert.description}</h4>
            {!compact && (
              <div className="alert-meta">
                <span className="alert-metric">Metric: {alert.metricId}</span>
                <span className="alert-threshold">
                  Threshold: {alert.threshold} ({alert.condition})
                </span>
                <span className="alert-time">{formatTimestamp(alert.createdAt)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="alert-status">
          {getStatusBadge(alert.status)}
          {alert.assignee && (
            <span className="assignee">@{alert.assignee}</span>
          )}
        </div>

        <div className="alert-actions">
          {alert.status === 'active' && (
            <>
              <button
                className="action-btn resolve"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction('resolve');
                }}
                title="Resolve Alert"
              >
                ✓
              </button>
              <button
                className="action-btn mute"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction('mute');
                }}
                title="Mute Alert"
              >
                🔇
              </button>
            </>
          )}

          <button
            className="action-btn details"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            title="Toggle Details"
          >
            {showDetails ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {showDetails && !compact && (
        <div className="alert-details">
          <div className="details-grid">
            <div className="detail-item">
              <label>Alert ID:</label>
              <span>{alert.id}</span>
            </div>
            <div className="detail-item">
              <label>Created:</label>
              <span>{new Date(alert.createdAt).toLocaleString()}</span>
            </div>
            {alert.resolvedAt && (
              <div className="detail-item">
                <label>Resolved:</label>
                <span>{new Date(alert.resolvedAt).toLocaleString()}</span>
              </div>
            )}
            <div className="detail-item">
              <label>Condition:</label>
              <span>{alert.condition} {alert.threshold}</span>
            </div>
            {alert.tags && alert.tags.length > 0 && (
              <div className="detail-item">
                <label>Tags:</label>
                <div className="tags">
                  {alert.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .alert-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-left: 4px solid ${getSeverityColor(alert.severity)};
          border-radius: 8px;
          margin-bottom: 0.75rem;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .alert-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .alert-item.compact {
          margin-bottom: 0.5rem;
        }

        .alert-header {
          display: flex;
          align-items: center;
          padding: 1rem;
          cursor: pointer;
        }

        .alert-item.compact .alert-header {
          padding: 0.75rem;
        }

        .alert-main {
          display: flex;
          align-items: center;
          flex: 1;
          gap: 1rem;
        }

        .alert-severity {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 100px;
        }

        .severity-icon {
          font-size: 1.2rem;
        }

        .severity-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: ${getSeverityColor(alert.severity)};
        }

        .alert-content {
          flex: 1;
        }

        .alert-title {
          margin: 0 0 0.25rem 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .alert-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .alert-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .assignee {
          font-size: 0.8rem;
          color: var(--text-secondary);
          background: var(--bg-tertiary);
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
        }

        .alert-actions {
          display: flex;
          gap: 0.25rem;
          margin-left: 1rem;
        }

        .action-btn {
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
          font-size: 0.9rem;
        }

        .action-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--color-primary);
        }

        .action-btn.resolve {
          color: var(--color-success);
        }

        .action-btn.resolve:hover {
          background: var(--color-success);
          color: white;
        }

        .action-btn.mute {
          color: var(--color-warning);
        }

        .action-btn.mute:hover {
          background: var(--color-warning);
          color: white;
        }

        .alert-details {
          border-top: 1px solid var(--border-color);
          padding: 1rem;
          background: var(--bg-tertiary);
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-item label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .detail-item span {
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .tag {
          padding: 0.2rem 0.4rem;
          background: var(--color-primary);
          color: white;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  onAlertAction,
  compact = false,
  maxVisible = 10
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved' | 'muted'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'severity'>('time');

  const filteredAndSortedAlerts = useMemo(() => {
    let filtered = alerts;

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(alert => alert.status === filter);
    }

    // Sort alerts
    filtered.sort((a, b) => {
      if (sortBy === 'severity') {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aSeverity = severityOrder[a.severity] || 0;
        const bSeverity = severityOrder[b.severity] || 0;
        if (aSeverity !== bSeverity) {
          return bSeverity - aSeverity; // Higher severity first
        }
      }

      return b.createdAt - a.createdAt; // Most recent first
    });

    return filtered.slice(0, maxVisible);
  }, [alerts, filter, sortBy, maxVisible]);

  const alertCounts = useMemo(() => {
    return alerts.reduce((counts, alert) => {
      counts[alert.status] = (counts[alert.status] || 0) + 1;
      counts.total = (counts.total || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }, [alerts]);

  return (
    <div className={`alert-panel ${compact ? 'compact' : ''}`}>
      <div className="panel-header">
        <h3>Alerts & Notifications</h3>

        <div className="alert-summary">
          <span className="alert-count total">
            Total: {alertCounts.total || 0}
          </span>
          <span className="alert-count active">
            Active: {alertCounts.active || 0}
          </span>
          {!compact && (
            <>
              <span className="alert-count resolved">
                Resolved: {alertCounts.resolved || 0}
              </span>
              <span className="alert-count muted">
                Muted: {alertCounts.muted || 0}
              </span>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="panel-controls">
          <div className="filter-controls">
            <label>Filter:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All Alerts</option>
              <option value="active">Active Only</option>
              <option value="resolved">Resolved</option>
              <option value="muted">Muted</option>
            </select>
          </div>

          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="time">Time</option>
              <option value="severity">Severity</option>
            </select>
          </div>
        </div>
      )}

      <div className="alerts-list">
        {filteredAndSortedAlerts.length === 0 ? (
          <div className="no-alerts">
            <span className="no-alerts-icon">✅</span>
            <p>No alerts found</p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}>Show All Alerts</button>
            )}
          </div>
        ) : (
          filteredAndSortedAlerts.map(alert => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onAction={(action) => onAlertAction(alert.id, action)}
              compact={compact}
            />
          ))
        )}
      </div>

      {alerts.length > maxVisible && (
        <div className="panel-footer">
          <button className="show-more-btn">
            Showing {Math.min(filteredAndSortedAlerts.length, maxVisible)} of {alerts.length} alerts
          </button>
        </div>
      )}

      <style jsx>{`
        .alert-panel {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
        }

        .panel-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .alert-panel.compact .panel-header {
          padding: 1rem;
        }

        .panel-header h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .alert-summary {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .alert-count {
          font-size: 0.875rem;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-weight: 500;
        }

        .alert-count.total {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .alert-count.active {
          background: #fef2f2;
          color: #ef4444;
        }

        .alert-count.resolved {
          background: #f0fdf4;
          color: #10b981;
        }

        .alert-count.muted {
          background: #f9fafb;
          color: #6b7280;
        }

        .panel-controls {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-tertiary);
        }

        .filter-controls, .sort-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .filter-controls label, .sort-controls label {
          color: var(--text-secondary);
          font-weight: 500;
        }

        .filter-controls select, .sort-controls select {
          padding: 0.25rem 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.875rem;
        }

        .alerts-list {
          max-height: 600px;
          overflow-y: auto;
          padding: 1rem;
        }

        .alert-panel.compact .alerts-list {
          padding: 0.75rem;
          max-height: 400px;
        }

        .no-alerts {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }

        .no-alerts-icon {
          font-size: 2rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .no-alerts p {
          margin: 0 0 1rem 0;
          font-size: 0.9rem;
        }

        .no-alerts button {
          padding: 0.5rem 1rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .panel-footer {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          text-align: center;
        }

        .show-more-btn {
          background: none;
          border: none;
          color: var(--color-primary);
          cursor: pointer;
          font-size: 0.875rem;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default AlertPanel;