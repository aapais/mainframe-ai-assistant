/**
 * SearchResultsHeader Component
 *
 * Header section for search results with summary and controls
 * @version 2.0.0
 */

import React, { memo } from 'react';
import { ConfidenceScoreLegend } from './ConfidenceScore';

interface SearchResultsHeaderProps {
  /** Number of results found */
  resultCount: number;
  /** Search query that was used */
  searchQuery: string;
  /** Whether to show confidence score legend */
  showConfidenceScores?: boolean;
  /** Custom className */
  className?: string;
  /** Additional header actions */
  actions?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Header component for search results display
 */
export const SearchResultsHeader: React.FC<SearchResultsHeaderProps> = memo(({
  resultCount,
  searchQuery,
  showConfidenceScores = true,
  className = '',
  actions,
  isLoading = false
}) => {
  return (
    <div className={`search-results-header p-4 border-b bg-gray-50 sticky top-0 z-10 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-grow">
          <h2 className="text-lg font-semibold text-gray-900">
            Search Results
          </h2>
          <p className="text-sm text-gray-600">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                Searching...
              </span>
            ) : (
              <>
                Found {resultCount} result{resultCount !== 1 ? 's' : ''} for "{searchQuery}"
              </>
            )}
          </p>
        </div>

        {/* Header actions */}
        {actions && (
          <div className="flex-shrink-0 ml-4">
            {actions}
          </div>
        )}
      </div>

      {/* Confidence score legend */}
      {showConfidenceScores && !isLoading && resultCount > 0 && (
        <div className="mt-3">
          <ConfidenceScoreLegend />
        </div>
      )}
    </div>
  );
});

SearchResultsHeader.displayName = 'SearchResultsHeader';

/**
 * Compact header for smaller spaces
 */
export const CompactSearchResultsHeader: React.FC<{
  resultCount: number;
  searchQuery: string;
  className?: string;
  isLoading?: boolean;
}> = memo(({ resultCount, searchQuery, className = '', isLoading = false }) => (
  <div className={`search-results-header-compact p-2 border-b bg-gray-50 ${className}`}>
    <div className="text-sm text-gray-600">
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Searching...
        </span>
      ) : (
        <>{resultCount} result{resultCount !== 1 ? 's' : ''} for "{searchQuery}"</>
      )}
    </div>
  </div>
));

CompactSearchResultsHeader.displayName = 'CompactSearchResultsHeader';

export default SearchResultsHeader;