/**
 * ErrorState Component
 *
 * Error state component for SearchResults with recovery options
 * @version 2.0.0
 */

import React, { memo } from 'react';

interface ErrorStateProps {
  /** Error message to display */
  error: string;
  /** Custom className */
  className?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Custom error title */
  title?: string;
  /** Custom error icon */
  icon?: string;
  /** Whether to show technical details */
  showDetails?: boolean;
  /** Additional error context */
  context?: string;
  /** Size of the error state */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Error state component with retry functionality
 */
export const ErrorState: React.FC<ErrorStateProps> = memo(({
  error,
  className = '',
  onRetry,
  title = 'Search Error',
  icon = '⚠️',
  showDetails = false,
  context,
  size = 'medium'
}) => {
  const sizeClasses = {
    small: 'p-4 text-sm',
    medium: 'p-8 text-base',
    large: 'p-12 text-lg'
  };

  const iconSizes = {
    small: 'text-4xl',
    medium: 'text-6xl',
    large: 'text-8xl'
  };

  return (
    <div
      className={`
        search-results-error flex flex-col items-center justify-center text-center
        ${sizeClasses[size]} ${className}
      `}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`text-red-500 mb-4 ${iconSizes[size]}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <h3 className="text-red-700 font-semibold mb-2">
        {title}
      </h3>

      <p className="text-gray-600 mb-4 max-w-md">
        {error}
      </p>

      {context && (
        <p className="text-gray-500 text-sm mb-4 max-w-md">
          {context}
        </p>
      )}

      {showDetails && (
        <details className="mb-4 text-left">
          <summary className="cursor-pointer text-gray-600 hover:text-gray-800 text-sm">
            Technical Details
          </summary>
          <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 font-mono max-w-md">
            {error}
          </div>
        </details>
      )}

      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            aria-label="Retry search"
          >
            Try Again
          </button>
        )}

        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          aria-label="Reload the page"
        >
          Reload Page
        </button>
      </div>

      {/* Screen reader description */}
      <div className="sr-only">
        Search error occurred. {error}. Use the retry button to try again or reload the page.
      </div>
    </div>
  );
});

ErrorState.displayName = 'ErrorState';

/**
 * Compact error state for inline use
 */
export const CompactErrorState: React.FC<{
  error: string;
  onRetry?: () => void;
  className?: string;
}> = memo(({ error, onRetry, className = '' }) => (
  <div
    className={`inline-flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm ${className}`}
    role="alert"
  >
    <span aria-hidden="true">⚠️</span>
    <span className="flex-grow">{error}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-red-600 hover:text-red-800 underline text-xs"
        aria-label="Retry"
      >
        Retry
      </button>
    )}
  </div>
));

CompactErrorState.displayName = 'CompactErrorState';

/**
 * Network error state with specific messaging
 */
export const NetworkErrorState: React.FC<{
  onRetry?: () => void;
  className?: string;
}> = memo(({ onRetry, className = '' }) => (
  <ErrorState
    error="Unable to connect to the search service. Please check your internet connection and try again."
    title="Connection Error"
    icon="📡"
    context="This could be due to network issues or the service being temporarily unavailable."
    onRetry={onRetry}
    className={className}
  />
));

NetworkErrorState.displayName = 'NetworkErrorState';

/**
 * Timeout error state
 */
export const TimeoutErrorState: React.FC<{
  onRetry?: () => void;
  className?: string;
}> = memo(({ onRetry, className = '' }) => (
  <ErrorState
    error="The search request took too long to complete. This might be due to high server load."
    title="Request Timeout"
    icon="⏱️"
    context="Try again with a more specific search query or wait a moment before retrying."
    onRetry={onRetry}
    className={className}
  />
));

TimeoutErrorState.displayName = 'TimeoutErrorState';

export default ErrorState;