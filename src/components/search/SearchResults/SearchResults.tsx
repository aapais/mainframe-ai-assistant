/**
 * SearchResults Component - Refactored Architecture
 *
 * Main SearchResults component with compound component pattern and modular architecture
 * @version 2.0.0
 */

import React, { memo, useMemo } from 'react';
import { SearchResultsProps, SearchResultsCompoundComponents } from './types';
import { SearchResultsProvider, useSearchResults } from './providers/SearchResultsProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { SearchResultsHeader } from './components/SearchResultsHeader';
import { SearchResultsFooter } from './components/SearchResultsFooter';
import { SearchResultsList } from './components/SearchResultsList';
import { extractSearchTerms } from './utils';

/**
 * Main SearchResults component with new modular architecture
 */
export const SearchResults: React.FC<SearchResultsProps> & SearchResultsCompoundComponents = memo(({
  results,
  searchQuery,
  isLoading = false,
  error = null,
  selectedIndex = -1,
  onResultSelect,
  onLoadMore,
  showConfidenceScores = true,
  className = '',
  ariaLabel = 'Search results',
  virtualizationThreshold = 20,
  itemHeight = 200,
  containerHeight = 600
}) => {
  // Extract search terms for highlighting
  const searchTerms = useMemo(() => extractSearchTerms(searchQuery), [searchQuery]);

  // Prepare provider value
  const providerValue = useMemo(() => ({
    results,
    searchQuery,
    selectedIndex,
    setSelectedIndex: () => {}, // Will be overridden by provider
    searchTerms,
    showConfidenceScores,
    onResultSelect,
    isLoading,
    error,
    virtualization: {
      enabled: results.length >= virtualizationThreshold,
      threshold: virtualizationThreshold,
      itemHeight,
      containerHeight,
      bufferSize: 5
    }
  }), [
    results,
    searchQuery,
    selectedIndex,
    searchTerms,
    showConfidenceScores,
    onResultSelect,
    isLoading,
    error,
    virtualizationThreshold,
    itemHeight,
    containerHeight
  ]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`search-results ${className}`}>
        <LoadingState />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`search-results ${className}`}>
        <ErrorState
          error={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Empty state
  if (!results.length) {
    return (
      <div className={`search-results ${className}`}>
        <EmptyState
          searchQuery={searchQuery}
          message="No results found"
        />
      </div>
    );
  }

  // Main results display
  return (
    <ErrorBoundary>
      <SearchResultsProvider value={providerValue}>
        <div
          className={`search-results bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden ${className}`}
          style={{ maxHeight: 'calc(100vh - 200px)', minHeight: '400px' }}
        >
          {/* Header */}
          <SearchResultsHeader
            resultCount={results.length}
            searchQuery={searchQuery}
            showConfidenceScores={showConfidenceScores}
            isLoading={isLoading}
          />

          {/* Results List */}
          <SearchResultsList
            ariaLabel={ariaLabel}
            virtualizationThreshold={virtualizationThreshold}
          />

          {/* Footer */}
          {onLoadMore && results.length >= 20 && (
            <SearchResultsFooter
              showLoadMore={true}
              onLoadMore={onLoadMore}
              hasMoreResults={true}
            />
          )}
        </div>
      </SearchResultsProvider>
    </ErrorBoundary>
  );
});

SearchResults.displayName = 'SearchResults';

// Compound component pattern implementation
SearchResults.Provider = SearchResultsProvider;
SearchResults.List = SearchResultsList;
SearchResults.Item = () => null; // Individual items are rendered by the list
SearchResults.Header = SearchResultsHeader;
SearchResults.Footer = SearchResultsFooter;
SearchResults.EmptyState = EmptyState;
SearchResults.LoadingState = LoadingState;
SearchResults.ErrorState = ErrorState;

/**
 * Simplified SearchResults component for basic use cases
 */
export const SimpleSearchResults: React.FC<Pick<SearchResultsProps,
  'results' | 'searchQuery' | 'onResultSelect' | 'showConfidenceScores' | 'className'
>> = memo(({ results, searchQuery, onResultSelect, showConfidenceScores = true, className = '' }) => {
  if (!results.length) {
    return <EmptyState searchQuery={searchQuery} size="small" className={className} />;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded ${className}`}>
      <div className="divide-y divide-gray-200">
        {results.map((result, index) => (
          <div key={result.entry.id} className="p-3">
            {/* Simplified result item would go here */}
            <div className="text-sm">
              <div className="font-medium">{result.entry.title}</div>
              <div className="text-gray-600 mt-1">{result.entry.problem}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

SimpleSearchResults.displayName = 'SimpleSearchResults';

/**
 * Custom hook for using SearchResults functionality
 */
export const useSearchResultsState = (options: {
  results: any[];
  searchQuery: string;
  onResultSelect?: (result: any, index: number) => void;
}) => {
  return useSearchResults(options);
};

// Export everything needed for the compound pattern
export * from './components';
export * from './hooks';
export * from './providers';
export * from './types';
export * from './utils';

export default SearchResults;