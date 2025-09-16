/**
 * Accessible Loading Indicator Component
 * Provides comprehensive loading states with proper screen reader announcements
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ScreenReaderOnly, ScreenReaderProgress } from './ScreenReaderOnly';
import { useScreenReaderAnnouncements } from '../hooks/useScreenReaderAnnouncements';
import { ScreenReaderTextUtils } from '../utils/screenReaderUtils';

export interface AccessibleLoadingIndicatorProps {
  /**
   * Whether the loading indicator is active
   */
  loading: boolean;

  /**
   * Loading message to display and announce
   */
  message?: string;

  /**
   * Context for the loading operation
   */
  context?: string;

  /**
   * Progress value (0-100) for determinate progress
   */
  progress?: number;

  /**
   * Visual variant
   */
  variant?: 'spinner' | 'bar' | 'dots' | 'pulse' | 'skeleton';

  /**
   * Size of the indicator
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Color theme
   */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';

  /**
   * Position of the indicator
   */
  position?: 'inline' | 'overlay' | 'centered';

  /**
   * Whether to show percentage for progress
   */
  showPercentage?: boolean;

  /**
   * Whether to announce progress updates
   */
  announceProgress?: boolean;

  /**
   * Frequency of progress announcements (in percentage points)
   */
  announceEvery?: number;

  /**
   * Custom loading text for screen readers
   */
  screenReaderText?: string;

  /**
   * Whether to disable all announcements
   */
  quiet?: boolean;

  /**
   * Callback when loading starts
   */
  onLoadingStart?: () => void;

  /**
   * Callback when loading completes
   */
  onLoadingComplete?: () => void;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Children to display alongside the loading indicator
   */
  children?: React.ReactNode;

  /**
   * Accessible label for the loading indicator
   */
  'aria-label'?: string;

  /**
   * ID for the loading indicator
   */
  id?: string;
}

/**
 * Spinner component
 */
const Spinner: React.FC<{ size: string; color: string; className?: string }> = ({
  size,
  color,
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'border-blue-200 border-t-blue-600',
    secondary: 'border-gray-200 border-t-gray-600',
    success: 'border-green-200 border-t-green-600',
    warning: 'border-yellow-200 border-t-yellow-600',
    error: 'border-red-200 border-t-red-600'
  };

  return (
    <div
      className={`${sizeClasses[size]} border-2 border-solid rounded-full animate-spin ${colorClasses[color]} ${className}`}
      role="presentation"
      aria-hidden="true"
    />
  );
};

/**
 * Progress Bar component
 */
const ProgressBar: React.FC<{
  progress: number;
  size: string;
  color: string;
  showPercentage: boolean;
  className?: string;
}> = ({ progress, size, color, showPercentage, className = '' }) => {
  const heightClasses = {
    xs: 'h-1',
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
    xl: 'h-6'
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`w-full bg-gray-200 rounded-full ${heightClasses[size]}`}
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={`${colorClasses[color]} ${heightClasses[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {showPercentage && (
        <div className="text-sm text-gray-600 mt-1 text-center">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};

/**
 * Dots component
 */
const Dots: React.FC<{ size: string; color: string; className?: string }> = ({
  size,
  color,
  className = ''
}) => {
  const dotSizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };

  return (
    <div className={`flex space-x-1 ${className}`} role="presentation" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${dotSizeClasses[size]} ${colorClasses[color]} rounded-full animate-pulse`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1.2s'
          }}
        />
      ))}
    </div>
  );
};

/**
 * Pulse component
 */
const Pulse: React.FC<{ size: string; color: string; className?: string }> = ({
  size,
  color,
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-pulse ${className}`}
      role="presentation"
      aria-hidden="true"
    />
  );
};

/**
 * Skeleton component
 */
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse ${className}`} role="presentation" aria-hidden="true">
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
  </div>
);

/**
 * Main Accessible Loading Indicator Component
 */
export const AccessibleLoadingIndicator: React.FC<AccessibleLoadingIndicatorProps> = ({
  loading,
  message = 'Loading',
  context = '',
  progress,
  variant = 'spinner',
  size = 'md',
  color = 'primary',
  position = 'inline',
  showPercentage = false,
  announceProgress = true,
  announceEvery = 10,
  screenReaderText,
  quiet = false,
  onLoadingStart,
  onLoadingComplete,
  className = '',
  children,
  'aria-label': ariaLabel,
  id,
  ...props
}) => {
  const { announceLoading, announceLoaded, announceProgress: announceProgressFn } = useScreenReaderAnnouncements();
  const [lastAnnouncedProgress, setLastAnnouncedProgress] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Generate screen reader text
  const getScreenReaderText = useCallback(() => {
    if (screenReaderText) return screenReaderText;

    const contextText = context ? ` ${context}` : '';
    if (progress !== undefined) {
      return ScreenReaderTextUtils.createLoadingDescription(
        `${message}${contextText}`,
        progress
      );
    }
    return ScreenReaderTextUtils.createLoadingDescription(`${message}${contextText}`);
  }, [screenReaderText, context, message, progress]);

  // Handle loading state changes
  useEffect(() => {
    if (!quiet) {
      if (loading && isFirstLoad) {
        announceLoading(getScreenReaderText());
        onLoadingStart?.();
        setIsFirstLoad(false);
      } else if (!loading && !isFirstLoad) {
        announceLoaded();
        onLoadingComplete?.();
        setIsFirstLoad(true);
        setLastAnnouncedProgress(0);
      }
    }
  }, [loading, quiet, announceLoading, announceLoaded, getScreenReaderText, onLoadingStart, onLoadingComplete, isFirstLoad]);

  // Handle progress announcements
  useEffect(() => {
    if (!quiet && loading && progress !== undefined && announceProgress) {
      const roundedProgress = Math.round(progress);
      if (roundedProgress - lastAnnouncedProgress >= announceEvery || roundedProgress === 100) {
        const progressText = context
          ? `${context}: ${roundedProgress}% complete`
          : `${message}: ${roundedProgress}% complete`;
        announceProgressFn(roundedProgress, 100, context || message);
        setLastAnnouncedProgress(roundedProgress);
      }
    }
  }, [progress, lastAnnouncedProgress, announceEvery, announceProgress, quiet, loading, announceProgressFn, context, message]);

  // Don't render if not loading
  if (!loading) {
    return children ? <>{children}</> : null;
  }

  // Render visual indicator
  const renderIndicator = () => {
    switch (variant) {
      case 'bar':
        return (
          <ProgressBar
            progress={progress || 0}
            size={size}
            color={color}
            showPercentage={showPercentage}
          />
        );
      case 'dots':
        return <Dots size={size} color={color} />;
      case 'pulse':
        return <Pulse size={size} color={color} />;
      case 'skeleton':
        return <Skeleton />;
      default:
        return <Spinner size={size} color={color} />;
    }
  };

  // Container classes based on position
  const getContainerClasses = () => {
    const baseClasses = 'flex items-center justify-center';

    switch (position) {
      case 'overlay':
        return `${baseClasses} fixed inset-0 bg-black bg-opacity-50 z-50`;
      case 'centered':
        return `${baseClasses} w-full h-full`;
      default:
        return `${baseClasses} ${className}`;
    }
  };

  return (
    <div
      className={getContainerClasses()}
      id={id}
      {...props}
    >
      {/* Screen reader content */}
      <ScreenReaderProgress
        value={progress}
        max={100}
        valueText={getScreenReaderText()}
        aria-label={ariaLabel || getScreenReaderText()}
      >
        {getScreenReaderText()}
      </ScreenReaderProgress>

      {/* Visual indicator */}
      <div className="flex flex-col items-center space-y-2">
        {renderIndicator()}

        {/* Message */}
        <div className="text-sm text-gray-600 text-center">
          {message}
          {context && ` ${context}`}
          {showPercentage && progress !== undefined && ` (${Math.round(progress)}%)`}
        </div>

        {children && (
          <div className="mt-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Specialized loading components
 */

/**
 * Page loading overlay
 */
export const PageLoadingOverlay: React.FC<
  Omit<AccessibleLoadingIndicatorProps, 'position' | 'variant'>
> = (props) => (
  <AccessibleLoadingIndicator
    {...props}
    position="overlay"
    variant="spinner"
    size="lg"
    context="page content"
  />
);

/**
 * Search loading indicator
 */
export const SearchLoadingIndicator: React.FC<
  Omit<AccessibleLoadingIndicatorProps, 'message' | 'context'>
> = (props) => (
  <AccessibleLoadingIndicator
    {...props}
    message="Searching"
    context="knowledge base"
    variant="dots"
  />
);

/**
 * Form submission loading indicator
 */
export const FormSubmissionIndicator: React.FC<
  Omit<AccessibleLoadingIndicatorProps, 'message' | 'context'>
> = (props) => (
  <AccessibleLoadingIndicator
    {...props}
    message="Submitting"
    context="form data"
    variant="spinner"
    size="sm"
  />
);

/**
 * Data loading skeleton
 */
export const DataLoadingSkeleton: React.FC<{
  loading: boolean;
  rows?: number;
  className?: string;
}> = ({ loading, rows = 3, className = '' }) => {
  if (!loading) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <ScreenReaderOnly>Loading data, please wait...</ScreenReaderOnly>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
};

/**
 * Progress bar with detailed announcements
 */
export const DetailedProgressBar: React.FC<{
  progress: number;
  total: number;
  operation: string;
  showDetails?: boolean;
  className?: string;
}> = ({ progress, total, operation, showDetails = true, className = '' }) => {
  const percentage = Math.round((progress / total) * 100);

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{operation}</span>
        <span className="text-sm text-gray-500">{percentage}%</span>
      </div>

      <ProgressBar
        progress={percentage}
        size="md"
        color="primary"
        showPercentage={false}
      />

      {showDetails && (
        <div className="text-xs text-gray-500 mt-1">
          {progress} of {total} completed
        </div>
      )}

      <ScreenReaderProgress
        value={progress}
        max={total}
        valueText={`${operation}: ${percentage}% complete, ${progress} of ${total} items processed`}
      >
        {operation}: {percentage}% complete
      </ScreenReaderProgress>
    </div>
  );
};

/**
 * Hook for managing loading states with announcements
 */
export function useAccessibleLoading() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>();
  const [message, setMessage] = useState('Loading');
  const { announceLoading, announceLoaded, announceProgress } = useScreenReaderAnnouncements();

  const startLoading = useCallback((loadingMessage?: string) => {
    setLoading(true);
    setProgress(undefined);
    if (loadingMessage) setMessage(loadingMessage);
    announceLoading(loadingMessage || message);
  }, [message, announceLoading]);

  const updateProgress = useCallback((current: number, total: number, operation?: string) => {
    const percentage = (current / total) * 100;
    setProgress(percentage);
    announceProgress(current, total, operation);
  }, [announceProgress]);

  const stopLoading = useCallback((completionMessage?: string) => {
    setLoading(false);
    setProgress(undefined);
    announceLoaded(completionMessage);
  }, [announceLoaded]);

  return {
    loading,
    progress,
    message,
    startLoading,
    updateProgress,
    stopLoading,
    setMessage
  };
}

export default AccessibleLoadingIndicator;