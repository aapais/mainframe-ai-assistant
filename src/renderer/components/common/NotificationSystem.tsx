/**
 * Accessible Notification System Component
 * Provides WCAG 2.1 AA compliant toast notifications, alerts, and status messages
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { announceToScreenReader, AriaUtils, focusManager } from '../../utils/accessibility';
import { useNotifications } from '../../hooks/useUXEnhancements';
import { Button, IconButton } from './Button';
import './NotificationSystem.css';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number; // 0 means no auto-dismiss
  actions?: NotificationAction[];
  persistent?: boolean;
  timestamp?: Date;
}

export interface NotificationAction {
  label: string;
  handler: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  destructive?: boolean;
}

interface NotificationSystemProps {
  /** Maximum number of notifications to show */
  maxNotifications?: number;
  /** Position of notifications */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Enable stacking animations */
  enableStacking?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Individual Notification Component
 */
const NotificationItem: React.FC<{
  notification: Notification;
  onDismiss: (id: string) => void;
  onAction: (action: NotificationAction, notificationId: string) => void;
  index: number;
}> = ({ notification, onDismiss, onAction, index }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(notification.duration || 0);
  const notificationRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const { id, type, title, message, duration, actions, persistent } = notification;

  // Setup auto-dismiss timer and progress
  useEffect(() => {
    if (duration && duration > 0 && !persistent) {
      setTimeRemaining(duration);
      
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 100) {
            onDismiss(id);
            return 0;
          }
          return prev - 100;
        });
      }, 100);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [duration, persistent, id, onDismiss]);

  // Update progress bar
  useEffect(() => {
    if (progressRef.current && duration && duration > 0) {
      const percentage = ((duration - timeRemaining) / duration) * 100;
      progressRef.current.style.width = `${percentage}%`;
    }
  }, [timeRemaining, duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };

  const handleAction = (action: NotificationAction) => {
    onAction(action, id);
    if (!persistent) {
      handleDismiss();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getAriaRole = () => {
    switch (type) {
      case 'error':
        return 'alert';
      case 'warning':
        return 'alert';
      default:
        return 'status';
    }
  };

  const notificationClasses = [
    'notification',
    `notification--${type}`,
    isExiting ? 'notification--exiting' : '',
    persistent ? 'notification--persistent' : ''
  ].filter(Boolean).join(' ');

  const titleId = title ? `${id}-title` : undefined;
  const messageId = `${id}-message`;

  return (
    <div
      ref={notificationRef}
      className={notificationClasses}
      role={getAriaRole()}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid={`notification-${type}`}
      style={{ '--notification-index': index } as React.CSSProperties}
    >
      {/* Progress bar for timed notifications */}
      {duration && duration > 0 && !persistent && (
        <div className="notification__progress" aria-hidden="true">
          <div ref={progressRef} className="notification__progress-bar" />
        </div>
      )}

      {/* Main content */}
      <div className="notification__content">
        <div className="notification__icon" aria-hidden="true">
          {getIcon()}
        </div>

        <div className="notification__text">
          {title && (
            <div id={titleId} className="notification__title">
              {title}
            </div>
          )}
          <div id={messageId} className="notification__message">
            {message}
          </div>
        </div>

        {/* Dismiss button */}
        <IconButton
          icon="×"
          label={`Dismiss ${type} notification`}
          variant="ghost"
          size="small"
          onClick={handleDismiss}
          className="notification__dismiss"
          data-testid="notification-dismiss"
        />
      </div>

      {/* Action buttons */}
      {actions && actions.length > 0 && (
        <div className="notification__actions">
          {actions.map((action, actionIndex) => (
            <Button
              key={actionIndex}
              variant={action.variant || 'ghost'}
              size="small"
              destructive={action.destructive}
              onClick={() => handleAction(action)}
              className="notification__action"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only">
        {type.charAt(0).toUpperCase() + type.slice(1)} notification: {title && `${title}. `}{message}
        {actions && actions.length > 0 && '. Available actions: ' + actions.map(a => a.label).join(', ')}
      </div>
    </div>
  );
};

/**
 * Main Notification System Component
 */
export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  maxNotifications = 5,
  position = 'top-right',
  enableStacking = true,
  className = ''
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global notification methods
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      duration: notification.duration !== undefined ? notification.duration : 
                (notification.type === 'error' ? 0 : 5000) // Errors don't auto-dismiss
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Limit number of notifications
      if (updated.length > maxNotifications) {
        return updated.slice(0, maxNotifications);
      }
      return updated;
    });

    // Announce to screen readers
    const priority = notification.type === 'error' ? 'assertive' : 'polite';
    const announcementText = `${notification.type}: ${notification.title || ''} ${notification.message}`;
    announceToScreenReader(announcementText, priority);

    return id;
  }, [maxNotifications]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    announceToScreenReader('All notifications cleared', 'polite');
  }, []);

  const handleAction = useCallback((action: NotificationAction, notificationId: string) => {
    action.handler();
    announceToScreenReader(`Notification action: ${action.label}`, 'polite');
  }, []);

  // Expose methods globally
  useEffect(() => {
    // Add to global notification system
    (window as any).notificationSystem = {
      success: (message: string, options?: Partial<Notification>) => 
        addNotification({ type: 'success', message, ...options }),
      error: (message: string, options?: Partial<Notification>) => 
        addNotification({ type: 'error', message, ...options }),
      warning: (message: string, options?: Partial<Notification>) => 
        addNotification({ type: 'warning', message, ...options }),
      info: (message: string, options?: Partial<Notification>) => 
        addNotification({ type: 'info', message, ...options }),
      clear: clearAllNotifications,
      remove: removeNotification
    };

    return () => {
      delete (window as any).notificationSystem;
    };
  }, [addNotification, clearAllNotifications, removeNotification]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to dismiss all notifications
      if (e.key === 'Escape' && notifications.length > 0) {
        clearAllNotifications();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [notifications.length, clearAllNotifications]);

  if (notifications.length === 0) {
    return null;
  }

  const containerClasses = [
    'notification-system',
    `notification-system--${position}`,
    enableStacking ? 'notification-system--stacking' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      className={containerClasses}
      role="region"
      aria-label="Notifications"
      data-testid="notification-system"
    >
      {/* Clear all button for multiple notifications */}
      {notifications.length > 1 && (
        <div className="notification-system__header">
          <Button
            variant="ghost"
            size="small"
            onClick={clearAllNotifications}
            className="notification-system__clear-all"
          >
            Clear All ({notifications.length})
          </Button>
        </div>
      )}

      {/* Notifications list */}
      <div className="notification-system__list">
        {notifications.map((notification, index) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={removeNotification}
            onAction={handleAction}
            index={index}
          />
        ))}
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" id="notification-instructions">
        {notifications.length} notification{notifications.length > 1 ? 's' : ''} displayed. 
        Press Escape to dismiss all notifications.
      </div>
    </div>
  );
};

/**
 * Notification Provider Hook
 */
export const useNotificationSystem = () => {
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    if ((window as any).notificationSystem) {
      const method = (window as any).notificationSystem[notification.type];
      if (method) {
        return method(notification.message, notification);
      }
    }
    console.warn('Notification system not initialized');
    return null;
  }, []);

  const success = useCallback((message: string, options?: Partial<Notification>) => 
    addNotification({ type: 'success', message, ...options }), [addNotification]);

  const error = useCallback((message: string, options?: Partial<Notification>) => 
    addNotification({ type: 'error', message, ...options }), [addNotification]);

  const warning = useCallback((message: string, options?: Partial<Notification>) => 
    addNotification({ type: 'warning', message, ...options }), [addNotification]);

  const info = useCallback((message: string, options?: Partial<Notification>) => 
    addNotification({ type: 'info', message, ...options }), [addNotification]);

  const clear = useCallback(() => {
    if ((window as any).notificationSystem?.clear) {
      (window as any).notificationSystem.clear();
    }
  }, []);

  return {
    success,
    error,
    warning,
    info,
    clear
  };
};

export default NotificationSystem;