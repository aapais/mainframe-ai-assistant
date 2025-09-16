import React, { useState, useMemo } from 'react';
import { TeamNotification } from '../../types/performance';

interface NotificationCenterProps {
  notifications: TeamNotification[];
  onNotificationRead: (id: string) => void;
  compact?: boolean;
  maxVisible?: number;
}

interface NotificationItemProps {
  notification: TeamNotification;
  onRead: () => void;
  compact?: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  compact = false
}) => {
  const [expanded, setExpanded] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return '🔔';
      case 'regression': return '📉';
      case 'budget': return '💰';
      case 'deployment': return '🚀';
      default: return '📊';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const handleClick = () => {
    if (!notification.read) {
      onRead();
    }
    if (!compact) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className={`notification-item severity-${notification.severity} type-${notification.type} ${notification.read ? 'read' : 'unread'} ${compact ? 'compact' : ''}`}
      onClick={handleClick}
    >
      <div className="notification-header">
        <div className="notification-main">
          <div className="notification-icons">
            <span className="type-icon">{getTypeIcon(notification.type)}</span>
            <span className="severity-icon">{getSeverityIcon(notification.severity)}</span>
          </div>

          <div className="notification-content">
            <h4 className="notification-title">{notification.title}</h4>
            <p className="notification-message">{notification.message}</p>
            {!compact && (
              <div className="notification-meta">
                <span className="notification-type">{notification.type}</span>
                <span className="notification-time">{formatTimestamp(notification.timestamp)}</span>
                {notification.recipients.length > 0 && (
                  <span className="notification-recipients">
                    To: {notification.recipients.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="notification-status">
          {!notification.read && <span className="unread-indicator">●</span>}
          {notification.actionRequired && (
            <span className="action-required">Action Required</span>
          )}
          {compact && (
            <span className="compact-time">{formatTimestamp(notification.timestamp)}</span>
          )}
        </div>
      </div>

      {expanded && !compact && notification.metadata && (
        <div className="notification-details">
          <h5>Additional Details</h5>
          <div className="metadata-grid">
            {Object.entries(notification.metadata).map(([key, value]) => (
              <div key={key} className="metadata-item">
                <label>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</label>
                <span>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .notification-item {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-left: 4px solid ${getSeverityColor(notification.severity)};
          border-radius: 8px;
          margin-bottom: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .notification-item.compact {
          margin-bottom: 0.5rem;
        }

        .notification-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);
        }

        .notification-item.unread {
          background: var(--bg-primary);
          border-left-width: 5px;
        }

        .notification-item.read {
          opacity: 0.8;
        }

        .notification-header {
          display: flex;
          align-items: flex-start;
          padding: 1rem;
        }

        .notification-item.compact .notification-header {
          padding: 0.75rem;
          align-items: center;
        }

        .notification-main {
          display: flex;
          align-items: flex-start;
          flex: 1;
          gap: 0.75rem;
        }

        .notification-item.compact .notification-main {
          align-items: center;
        }

        .notification-icons {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 32px;
        }

        .notification-item.compact .notification-icons {
          flex-direction: row;
          gap: 0.5rem;
        }

        .type-icon, .severity-icon {
          font-size: 1.1rem;
        }

        .notification-content {
          flex: 1;
        }

        .notification-title {
          margin: 0 0 0.25rem 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
        }

        .notification-item.compact .notification-title {
          margin-bottom: 0;
        }

        .notification-message {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .notification-item.compact .notification-message {
          margin-bottom: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }

        .notification-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          flex-wrap: wrap;
        }

        .notification-type {
          background: var(--bg-tertiary);
          padding: 0.2rem 0.4rem;
          border-radius: 12px;
          text-transform: capitalize;
        }

        .notification-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }

        .notification-item.compact .notification-status {
          flex-direction: row;
          align-items: center;
        }

        .unread-indicator {
          color: var(--color-primary);
          font-size: 1.2rem;
          line-height: 1;
        }

        .action-required {
          background: #fef2f2;
          color: #ef4444;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          border: 1px solid #ef444420;
        }

        .compact-time {
          font-size: 0.75rem;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .notification-details {
          border-top: 1px solid var(--border-color);
          padding: 1rem;
          background: var(--bg-tertiary);
        }

        .notification-details h5 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          text-transform: uppercase;
        }

        .metadata-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
        }

        .metadata-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .metadata-item label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .metadata-item span {
          font-size: 0.8rem;
          color: var(--text-primary);
          word-break: break-word;
        }
      `}</style>
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onNotificationRead,
  compact = false,
  maxVisible = 20
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'error' | 'warning' | 'info'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'alert' | 'regression' | 'budget' | 'deployment'>('all');

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply read/severity filter
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (filter !== 'all') {
      filtered = filtered.filter(n => n.severity === filter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(n => n.type === typeFilter);
    }

    return filtered.slice(0, maxVisible);
  }, [notifications, filter, typeFilter, maxVisible]);

  const notificationStats = useMemo(() => {
    return notifications.reduce((stats, notification) => {
      stats.total = (stats.total || 0) + 1;
      stats[notification.severity] = (stats[notification.severity] || 0) + 1;
      stats[notification.type] = (stats[notification.type] || 0) + 1;
      if (!notification.read) {
        stats.unread = (stats.unread || 0) + 1;
      }
      if (notification.actionRequired) {
        stats.actionRequired = (stats.actionRequired || 0) + 1;
      }
      return stats;
    }, {} as Record<string, number>);
  }, [notifications]);

  const markAllAsRead = () => {
    notifications
      .filter(n => !n.read)
      .forEach(n => onNotificationRead(n.id));
  };

  return (
    <div className={`notification-center ${compact ? 'compact' : ''}`}>
      <div className="center-header">
        <h3>Notifications</h3>

        <div className="notification-summary">
          <span className="summary-item total">
            Total: {notificationStats.total || 0}
          </span>
          <span className="summary-item unread">
            Unread: {notificationStats.unread || 0}
          </span>
          {notificationStats.actionRequired > 0 && (
            <span className="summary-item action-required">
              Action Required: {notificationStats.actionRequired}
            </span>
          )}
        </div>
      </div>

      {!compact && (
        <div className="center-controls">
          <div className="filter-group">
            <label>Filter:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All</option>
              <option value="unread">Unread Only</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Type:</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
              <option value="all">All Types</option>
              <option value="alert">Alerts</option>
              <option value="regression">Regressions</option>
              <option value="budget">Budget</option>
              <option value="deployment">Deployments</option>
            </select>
          </div>

          {notificationStats.unread > 0 && (
            <button onClick={markAllAsRead} className="mark-all-read-btn">
              Mark All Read
            </button>
          )}
        </div>
      )}

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            <span className="no-notifications-icon">🔔</span>
            <p>No notifications</p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}>Show All</button>
            )}
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={() => onNotificationRead(notification.id)}
              compact={compact}
            />
          ))
        )}
      </div>

      {notifications.length > maxVisible && (
        <div className="center-footer">
          <p>Showing {Math.min(filteredNotifications.length, maxVisible)} of {notifications.length} notifications</p>
        </div>
      )}

      <style jsx>{`
        .notification-center {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
        }

        .center-header {
          padding: 1.25rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .notification-center.compact .center-header {
          padding: 1rem;
        }

        .center-header h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .notification-summary {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .summary-item {
          font-size: 0.875rem;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-weight: 500;
        }

        .summary-item.total {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .summary-item.unread {
          background: #dbeafe;
          color: #3b82f6;
        }

        .summary-item.action-required {
          background: #fef2f2;
          color: #ef4444;
        }

        .center-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
          padding: 1rem 1.25rem;
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

        .mark-all-read-btn {
          padding: 0.5rem 1rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          margin-left: auto;
        }

        .mark-all-read-btn:hover {
          background: var(--color-primary-dark);
        }

        .notifications-list {
          max-height: 600px;
          overflow-y: auto;
          padding: 1rem;
        }

        .notification-center.compact .notifications-list {
          padding: 0.75rem;
          max-height: 400px;
        }

        .no-notifications {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }

        .no-notifications-icon {
          font-size: 2rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .no-notifications p {
          margin: 0 0 1rem 0;
          font-size: 0.9rem;
        }

        .no-notifications button {
          padding: 0.5rem 1rem;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .center-footer {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          text-align: center;
        }

        .center-footer p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};

export default NotificationCenter;