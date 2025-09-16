/**
 * LoadingState Component
 *
 * Loading state component for SearchResults with accessibility
 * @version 2.0.0
 */

import React, { memo } from 'react';

interface LoadingStateProps {
  /** Custom loading message */
  message?: string;
  /** Custom className */
  className?: string;
  /** Whether to show animated spinner */
  showSpinner?: boolean;
  /** Size of the loading state */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Loading state component with accessibility features
 */
export const LoadingState: React.FC<LoadingStateProps> = memo(({
  message = 'Searching knowledge base...',
  className = '',
  showSpinner = true,
  size = 'medium'
}) => {
  const sizeClasses = {
    small: 'p-4 text-sm',
    medium: 'p-8 text-base',
    large: 'p-12 text-lg'
  };

  const spinnerSizes = {
    small: 'h-6 w-6',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div
      className={`
        search-results-loading flex flex-col items-center justify-center text-center
        ${sizeClasses[size]} ${className}
      `}
      role="status"
      aria-live="polite"
      aria-label="Loading search results"
    >
      {showSpinner && (
        <div
          className={`
            inline-block animate-spin rounded-full border-b-2 border-blue-500 mb-4
            ${spinnerSizes[size]}
          `}
          aria-hidden="true"
        />
      )}

      <p className="text-gray-600 font-medium">
        {message}
      </p>

      {/* Additional loading indicators for better UX */}
      <div className="mt-2 flex space-x-1" aria-hidden="true">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
});

LoadingState.displayName = 'LoadingState';

/**
 * Skeleton loading component for search results
 */
export const SearchResultsSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = memo(({ count = 3, className = '' }) => (
  <div className={`space-y-4 ${className}`} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="p-4 border-b border-gray-200 animate-pulse">
        <div className="flex items-start gap-4">
          <div className="w-2 h-2 bg-gray-300 rounded-full mt-2" />
          <div className="flex-grow">
            <div className="h-5 bg-gray-300 rounded mb-2 w-3/4" />
            <div className="h-4 bg-gray-200 rounded mb-2 w-full" />
            <div className="h-4 bg-gray-200 rounded mb-3 w-5/6" />
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-1/6" />
            </div>
          </div>
          <div className="w-16 h-8 bg-gray-200 rounded" />
        </div>
      </div>
    ))}
  </div>
));

SearchResultsSkeleton.displayName = 'SearchResultsSkeleton';

/**
 * Compact loading state for inline use
 */
export const CompactLoadingState: React.FC<{
  message?: string;
  className?: string;
}> = memo(({ message = 'Loading...', className = '' }) => (
  <div
    className={`inline-flex items-center gap-2 text-sm text-gray-600 ${className}`}
    role="status"
    aria-live="polite"
  >
    <div
      className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
      aria-hidden="true"
    />
    <span>{message}</span>
  </div>
));

CompactLoadingState.displayName = 'CompactLoadingState';

export default LoadingState;