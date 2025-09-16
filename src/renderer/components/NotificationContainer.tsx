import React from 'react';
import { Notification } from '../../types';

export interface NotificationContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxVisible?: number;
  className?: string;
}

/**
 * NotificationContainer Component
 * 
 * Displays application notifications with proper positioning and animations.
 * Features:
 * - Multiple notification types (success, error, warning, info)
 * - Configurable positioning
 * - Auto-dismiss functionality
 * - Action buttons support
 * - Accessibility support
 * - Animation transitions
 */
export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss,
  position = 'top-right',
  maxVisible = 5,
  className = ''
}) => {
  const visibleNotifications = notifications.slice(0, maxVisible);

  if (visibleNotifications.length === 0) {
    return null;
  }

  const getNotificationIcon = (type: Notification['type']) => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  };

  return (
    <div 
      className={`notification-container notification-container--${position} ${className}`}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification--${notification.type}`}
          role="alert"
          aria-labelledby={`notification-${notification.id}-content`}
        >
          <div className="notification__content">
            <div className="notification__icon" aria-hidden="true">
              {getNotificationIcon(notification.type)}
            </div>
            
            <div 
              id={`notification-${notification.id}-content`}
              className="notification__message"
            >
              {notification.message}
            </div>

            <button
              className="notification__dismiss"
              onClick={() => onDismiss(notification.id)}
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              ×
            </button>
          </div>

          {notification.actions && notification.actions.length > 0 && (
            <div className="notification__actions">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  className={`notification__action notification__action--${action.variant || 'secondary'}`}
                  onClick={() => {
                    action.action();
                    onDismiss(notification.id);
                  }}
                  aria-label={action.label}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {notifications.length > maxVisible && (
        <div className="notification-container__overflow">
          +{notifications.length - maxVisible} more notifications
        </div>
      )}
    </div>
  );
};

export default NotificationContainer;