/**
 * SearchResultsFooter Component
 *
 * Footer section for search results with load more and pagination
 * @version 2.0.0
 */

import React, { memo } from 'react';

interface SearchResultsFooterProps {
  /** Whether to show load more button */
  showLoadMore?: boolean;
  /** Load more callback */
  onLoadMore?: () => void;
  /** Loading state for load more */
  isLoadingMore?: boolean;
  /** Whether there are more results to load */
  hasMoreResults?: boolean;
  /** Custom className */
  className?: string;
  /** Current page information */
  pagination?: {
    current: number;
    total: number;
    pageSize: number;
  };
  /** Additional footer actions */
  actions?: React.ReactNode;
}

/**
 * Footer component for search results with load more functionality
 */
export const SearchResultsFooter: React.FC<SearchResultsFooterProps> = memo(({
  showLoadMore = false,
  onLoadMore,
  isLoadingMore = false,
  hasMoreResults = false,
  className = '',
  pagination,
  actions
}) => {
  return (
    <div className={`search-results-footer p-4 border-t bg-gray-50 sticky bottom-0 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between">
        {/* Pagination info */}
        {pagination && (
          <div className="text-sm text-gray-600">
            Page {pagination.current} of {pagination.total}
            {pagination.pageSize && (
              <span className="ml-2">({pagination.pageSize} per page)</span>
            )}
          </div>
        )}

        {/* Load more section */}
        <div className="flex items-center gap-4">
          {/* Additional actions */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}

          {/* Load more button */}
          {showLoadMore && hasMoreResults && (
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className={`
                px-6 py-2 bg-blue-500 text-white rounded-lg transition-colors
                hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-label="Load more search results"
            >
              {isLoadingMore ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                'Load More Results'
              )}
            </button>
          )}

          {/* End of results indicator */}
          {showLoadMore && !hasMoreResults && !isLoadingMore && (
            <div className="text-sm text-gray-500">
              No more results to load
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

SearchResultsFooter.displayName = 'SearchResultsFooter';

/**
 * Simple footer with just pagination
 */
export const SimplePaginationFooter: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}> = memo(({ currentPage, totalPages, onPageChange, className = '' }) => (
  <div className={`search-results-pagination p-4 border-t bg-gray-50 ${className}`}>
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        Previous
      </button>

      <span className="px-3 py-1 text-sm text-gray-600">
        {currentPage} of {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  </div>
));

SimplePaginationFooter.displayName = 'SimplePaginationFooter';

/**
 * Compact footer for smaller spaces
 */
export const CompactSearchResultsFooter: React.FC<{
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMoreResults?: boolean;
  className?: string;
}> = memo(({ onLoadMore, isLoadingMore = false, hasMoreResults = false, className = '' }) => (
  <div className={`search-results-footer-compact p-2 border-t bg-gray-50 text-center ${className}`}>
    {hasMoreResults && onLoadMore ? (
      <button
        onClick={onLoadMore}
        disabled={isLoadingMore}
        className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        aria-label="Load more results"
      >
        {isLoadingMore ? 'Loading...' : 'Load More'}
      </button>
    ) : (
      <span className="text-xs text-gray-500">
        End of results
      </span>
    )}
  </div>
));

CompactSearchResultsFooter.displayName = 'CompactSearchResultsFooter';

export default SearchResultsFooter;