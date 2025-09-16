/**
 * Accessible Loading Indicator Component
 * Provides WCAG 2.1 AA compliant loading states with screen reader announcements
 */

import React, { useEffect, memo } from 'react';
import { AriaUtils } from '../../utils/accessibility';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  /** Whether the loading indicator is visible */
  isLoading: boolean;
  /** Size variant of the spinner */
  size?: 'small' | 'medium' | 'large';
  /** Text to display alongside the spinner */
  message?: string;
  /** Context description for screen readers */
  context?: string;
  /** Whether to show as inline (vs block) */
  inline?: boolean;
  /** Custom className */
  className?: string;
  /** Delay before showing loader (prevents flash for quick operations) */
  delay?: number;
  /** Minimum time to show loader (prevents flickering) */
  minDuration?: number;
}

export const LoadingIndicator = memo<LoadingIndicatorProps>(({
  isLoading,
  size = 'medium',
  message,
  context = 'content',
  inline = false,
  className = '',
  delay = 200,
  minDuration = 500
}) => {
  const [shouldShow, setShouldShow] = React.useState(false);
  const [startTime, setStartTime] = React.useState<number | null>(null);
  const delayTimeoutRef = React.useRef<NodeJS.Timeout>();
  const minTimeoutRef = React.useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isLoading) {
      // Start timing
      setStartTime(Date.now());

      // Delay showing the indicator to prevent flashing
      delayTimeoutRef.current = setTimeout(() => {
        setShouldShow(true);
        // Screen reader announcement handled by aria-live region
      }, delay);
    } else {
      // Clear delay timeout
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }

      // If we've shown the loader, ensure minimum duration
      if (shouldShow && startTime) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDuration - elapsed);

        minTimeoutRef.current = setTimeout(() => {
          setShouldShow(false);
          // Screen reader announcement handled by component removal
        }, remaining);
      } else {
        setShouldShow(false);
      }
    }

    return () => {
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
      if (minTimeoutRef.current) clearTimeout(minTimeoutRef.current);
    };
  }, [isLoading, delay, minDuration, context, shouldShow, startTime]);

  if (!shouldShow) {
    return null;
  }

  const loadingId = `loading-${context}-${Date.now()}`;
  const spinnerClasses = [
    'loading-spinner',
    `loading-spinner--${size}`,
    inline ? 'loading-spinner--inline' : 'loading-spinner--block',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={spinnerClasses}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message || `Loading ${context}`}
      data-testid="loading-indicator"
    >
      {/* Animated spinner */}
      <div className="loading-spinner__animation" aria-hidden="true">
        <div className="loading-spinner__circle"></div>
        <div className="loading-spinner__circle"></div>
        <div className="loading-spinner__circle"></div>
      </div>

      {/* Loading message */}
      {message && (
        <span className="loading-spinner__message" id={loadingId}>
          {message}
        </span>
      )}

      {/* Screen reader only text */}
      <span className="sr-only">
        Loading {context}, please wait...
      </span>
    </div>
  );
});

LoadingIndicator.displayName = 'LoadingIndicator';

/**
 * Inline Loading Spinner for smaller spaces
 */
export const InlineLoadingSpinner = memo<{
  size?: 'small' | 'medium';
  className?: string;
}>(({ size = 'small', className = '' }) => (
  <span
    className={`inline-loading-spinner inline-loading-spinner--${size} ${className}`}
    role="status"
    aria-label="Loading..."
    aria-hidden="false"
    data-testid="inline-loading-spinner"
  >
    <span className="inline-loading-spinner__dot"></span>
    <span className="inline-loading-spinner__dot"></span>
    <span className="inline-loading-spinner__dot"></span>
    <span className="sr-only">Loading...</span>
  </span>
));

InlineLoadingSpinner.displayName = 'InlineLoadingSpinner';

/**
 * Loading Skeleton for content placeholders
 */
export const LoadingSkeleton = memo<{
  lines?: number;
  width?: string | number;
  height?: string | number;
  className?: string;
  animate?: boolean;
}>(({
  lines = 3,
  width = '100%',
  height = '1rem',
  className = '',
  animate = true
}) => {
  const skeletonId = `skeleton-${Date.now()}`;
  
  return (
    <div
      className={`loading-skeleton ${animate ? 'loading-skeleton--animated' : ''} ${className}`}
      role="status"
      aria-labelledby={skeletonId}
      aria-busy="true"
      data-testid="loading-skeleton"
    >
      <span id={skeletonId} className="sr-only">
        Loading content placeholder
      </span>
      
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="loading-skeleton__line"
          style={{
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
            // Vary width for last line to look more natural
            ...(index === lines - 1 && lines > 1 ? { width: '75%' } : {})
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';

/**
 * Progress Bar with accessibility features
 */
export interface ProgressBarProps {
  /** Current progress value (0-100) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Descriptive label for the progress */
  label?: string;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Color variant */
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  /** Additional className */
  className?: string;
}

export const ProgressBar = memo<ProgressBarProps>(({
  value,
  max = 100,
  label,
  showPercentage = false,
  size = 'medium',
  variant = 'primary',
  className = ''
}) => {
  const percentage = Math.round((value / max) * 100);
  const progressId = `progress-${Date.now()}`;
  const labelId = label ? `${progressId}-label` : undefined;
  
  return (
    <div
      className={`progress-bar progress-bar--${size} progress-bar--${variant} ${className}`}
      data-testid="progress-bar"
    >
      {label && (
        <div id={labelId} className="progress-bar__label">
          {label}
          {showPercentage && (
            <span className="progress-bar__percentage" aria-hidden="true">
              {percentage}%
            </span>
          )}
        </div>
      )}
      
      <div
        className="progress-bar__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${percentage}% complete`}
        aria-labelledby={labelId}
      >
        <div
          className="progress-bar__fill"
          style={{ width: `${percentage}%` }}
          aria-hidden="true"
        />
      </div>
      
      {/* Screen reader announcement for significant progress changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="false">
        {percentage % 25 === 0 ? `${percentage}% complete` : ''}
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default LoadingIndicator;