/**
 * Accessible Success Indicator Component
 * Provides WCAG 2.1 AA compliant success feedback with screen reader announcements
 */

import React, { useEffect, useState } from 'react';
import { announceSuccess } from '../../utils/accessibility';
import './SuccessIndicator.css';

interface SuccessIndicatorProps {
  /** Whether to show the success indicator */
  show: boolean;
  /** Success message to display */
  message?: string;
  /** Duration to show the indicator (ms) */
  duration?: number;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Display variant */
  variant?: 'icon' | 'badge' | 'banner' | 'inline';
  /** Auto-hide after duration */
  autoHide?: boolean;
  /** Callback when indicator is dismissed */
  onDismiss?: () => void;
  /** Custom icon (defaults to checkmark) */
  icon?: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Whether to announce to screen readers */
  announce?: boolean;
}

export const SuccessIndicator: React.FC<SuccessIndicatorProps> = ({
  show,
  message = 'Success',
  duration = 3000,
  size = 'medium',
  variant = 'badge',
  autoHide = true,
  onDismiss,
  icon,
  className = '',
  announce = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsAnimating(true);

      // Announce to screen readers
      if (announce) {
        announceSuccess(message);
      }

      // Auto-hide timer
      if (autoHide && duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);

        return () => clearTimeout(timer);
      }

      // Animation cleanup
      const animationTimer = setTimeout(() => {
        setIsAnimating(false);
      }, 500);

      return () => clearTimeout(animationTimer);
    } else {
      setIsVisible(false);
      setIsAnimating(false);
    }
  }, [show, message, duration, autoHide, announce]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsAnimating(false);
    onDismiss?.();
  };

  if (!isVisible) {
    return null;
  }

  const successId = `success-${Date.now()}`;
  const classes = [
    'success-indicator',
    `success-indicator--${variant}`,
    `success-indicator--${size}`,
    isAnimating ? 'success-indicator--animating' : '',
    className
  ].filter(Boolean).join(' ');

  const defaultIcon = (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );

  return (
    <div
      className={classes}
      role="status"
      aria-live="polite"
      aria-labelledby={successId}
      data-testid="success-indicator"
    >
      {variant === 'banner' && (
        <div className="success-indicator__banner">
          <div className="success-indicator__content">
            <span className="success-indicator__icon" aria-hidden="true">
              {icon || defaultIcon}
            </span>
            <span id={successId} className="success-indicator__message">
              {message}
            </span>
          </div>
          {onDismiss && (
            <button
              className="success-indicator__dismiss"
              onClick={handleDismiss}
              aria-label="Dismiss success message"
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}

      {variant === 'badge' && (
        <div className="success-indicator__badge">
          <span className="success-indicator__icon" aria-hidden="true">
            {icon || defaultIcon}
          </span>
          <span id={successId} className="success-indicator__message">
            {message}
          </span>
        </div>
      )}

      {variant === 'icon' && (
        <span
          className="success-indicator__icon-only"
          aria-label={message}
          title={message}
        >
          {icon || defaultIcon}
        </span>
      )}

      {variant === 'inline' && (
        <span className="success-indicator__inline">
          <span className="success-indicator__icon" aria-hidden="true">
            {icon || defaultIcon}
          </span>
          <span id={successId}>{message}</span>
        </span>
      )}

      {/* Screen reader announcement */}
      <span className="sr-only">
        Success: {message}
      </span>
    </div>
  );
};

/**
 * Success Toast Component
 */
interface SuccessToastProps {
  /** Whether to show the toast */
  show: boolean;
  /** Success message */
  message: string;
  /** Auto-dismiss duration */
  duration?: number;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Position on screen */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const SuccessToast: React.FC<SuccessToastProps> = ({
  show,
  message,
  duration = 4000,
  onDismiss,
  position = 'top-right'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      announceSuccess(message);

      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, message, duration, onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`success-toast success-toast--${position}`}
      role="status"
      aria-live="polite"
      data-testid="success-toast"
    >
      <div className="success-toast__content">
        <span className="success-toast__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
        <span className="success-toast__message">{message}</span>
        <button
          className="success-toast__dismiss"
          onClick={() => {
            setIsVisible(false);
            onDismiss?.();
          }}
          aria-label="Dismiss success message"
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Success Animation Component (for form submissions, saves, etc.)
 */
interface SuccessAnimationProps {
  /** Whether to trigger the animation */
  trigger: boolean;
  /** Size of the animation */
  size?: 'small' | 'medium' | 'large';
  /** Color variant */
  color?: 'success' | 'primary';
  /** Callback when animation completes */
  onComplete?: () => void;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  trigger,
  size = 'medium',
  color = 'success',
  onComplete
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsAnimating(true);

      const timer = setTimeout(() => {
        setIsAnimating(false);
        onComplete?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!isAnimating) {
    return null;
  }

  return (
    <div
      className={`success-animation success-animation--${size} success-animation--${color}`}
      role="status"
      aria-label="Operation completed successfully"
      data-testid="success-animation"
    >
      <div className="success-animation__circle">
        <div className="success-animation__checkmark">
          <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="success-animation__path"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

/**
 * Auto-save Success Indicator
 */
interface AutoSaveIndicatorProps {
  /** Last saved timestamp */
  lastSaved: Date | null;
  /** Whether currently saving */
  isSaving: boolean;
  /** Error message if save failed */
  error?: string | null;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  lastSaved,
  isSaving,
  error
}) => {
  const getStatusText = () => {
    if (error) return `Auto-save failed: ${error}`;
    if (isSaving) return 'Saving...';
    if (lastSaved) {
      const timeAgo = Math.round((Date.now() - lastSaved.getTime()) / 1000);
      if (timeAgo < 60) return `Saved ${timeAgo}s ago`;
      if (timeAgo < 3600) return `Saved ${Math.round(timeAgo / 60)}m ago`;
      return `Saved ${Math.round(timeAgo / 3600)}h ago`;
    }
    return 'Not saved';
  };

  const getStatusIcon = () => {
    if (error) return '❌';
    if (isSaving) return '⏳';
    if (lastSaved) return '✅';
    return '💾';
  };

  return (
    <div
      className={`auto-save-indicator ${error ? 'auto-save-indicator--error' : ''} ${
        isSaving ? 'auto-save-indicator--saving' : ''
      }`}
      role="status"
      aria-live="polite"
      aria-label={getStatusText()}
      data-testid="auto-save-indicator"
    >
      <span className="auto-save-indicator__icon" aria-hidden="true">
        {getStatusIcon()}
      </span>
      <span className="auto-save-indicator__text">
        {getStatusText()}
      </span>
    </div>
  );
};

export default SuccessIndicator;