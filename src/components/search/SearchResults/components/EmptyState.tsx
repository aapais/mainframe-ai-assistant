/**
 * EmptyState Component
 *
 * Empty state component for SearchResults when no results found
 * @version 2.0.0
 */

import React, { memo } from 'react';

interface EmptyStateProps {
  /** Custom empty message */
  message?: string;
  /** Custom description */
  description?: string;
  /** Custom className */
  className?: string;
  /** Search query that returned no results */
  searchQuery?: string;
  /** Custom icon or emoji */
  icon?: string;
  /** Actions to show (e.g., clear search, try different terms) */
  actions?: React.ReactNode;
  /** Size of the empty state */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Empty state component with helpful suggestions
 */
export const EmptyState: React.FC<EmptyStateProps> = memo(({
  message = 'No results found',
  description,
  className = '',
  searchQuery,
  icon = '🔍',
  actions,
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

  const defaultDescription = searchQuery
    ? `No results found for "${searchQuery}". Try adjusting your search query or using different keywords.`
    : 'Try adjusting your search query or using different keywords.';

  return (
    <div
      className={`
        search-results-empty flex flex-col items-center justify-center text-center
        ${sizeClasses[size]} ${className}
      `}
      role="status"
      aria-live="polite"
    >
      <div
        className={`text-gray-400 mb-4 ${iconSizes[size]}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <h3 className="text-gray-600 font-semibold mb-2">
        {message}
      </h3>

      <p className="text-gray-500 text-sm max-w-md">
        {description || defaultDescription}
      </p>

      {/* Search suggestions */}
      <div className="mt-4 text-xs text-gray-400">
        <div className="mb-2 font-medium">Try:</div>
        <ul className="space-y-1">
          <li>• Using different or more general keywords</li>
          <li>• Checking your spelling</li>
          <li>• Removing quotes or special characters</li>
          <li>• Using shorter search terms</li>
        </ul>
      </div>

      {/* Custom actions */}
      {actions && (
        <div className="mt-6">
          {actions}
        </div>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

/**
 * Compact empty state for smaller spaces
 */
export const CompactEmptyState: React.FC<{
  message?: string;
  searchQuery?: string;
  className?: string;
}> = memo(({ message = 'No results', searchQuery, className = '' }) => (
  <div
    className={`text-center p-4 text-gray-500 ${className}`}
    role="status"
    aria-live="polite"
  >
    <div className="text-2xl mb-2" aria-hidden="true">🔍</div>
    <div className="text-sm">
      {message}
      {searchQuery && (
        <div className="mt-1 text-xs">
          for "{searchQuery}"
        </div>
      )}
    </div>
  </div>
));

CompactEmptyState.displayName = 'CompactEmptyState';

/**
 * Empty state with search suggestions
 */
export const EmptyStateWithSuggestions: React.FC<EmptyStateProps & {
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}> = memo(({
  suggestions = [],
  onSuggestionClick,
  ...props
}) => (
  <EmptyState
    {...props}
    actions={
      suggestions.length > 0 && onSuggestionClick ? (
        <div className="w-full max-w-md">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Suggested searches:
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick(suggestion)}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                aria-label={`Search for ${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : props.actions
    }
  />
));

EmptyStateWithSuggestions.displayName = 'EmptyStateWithSuggestions';

export default EmptyState;