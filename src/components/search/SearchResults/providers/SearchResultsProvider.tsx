/**
 * SearchResultsProvider
 *
 * Context provider for search results state management and compound component pattern
 * @version 2.0.0
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import {
  SearchResultsContextValue,
  SearchResultsProviderProps,
  VirtualizationSettings,
  DEFAULT_VIRTUALIZATION_SETTINGS,
  DEFAULT_SEARCH_TERM_CONFIG,
  SearchResult
} from '../types';
import { useSearchHighlight } from '../hooks/useSearchHighlight';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { extractSearchTerms } from '../utils';

// Create context
const SearchResultsContext = createContext<SearchResultsContextValue | null>(null);

/**
 * Hook to access SearchResults context
 */
export const useSearchResultsContext = (): SearchResultsContextValue => {
  const context = useContext(SearchResultsContext);

  if (!context) {
    throw new Error('useSearchResultsContext must be used within a SearchResultsProvider');
  }

  return context;
};

/**
 * Provider component for SearchResults compound component pattern
 */
export const SearchResultsProvider: React.FC<SearchResultsProviderProps> = ({
  children,
  value
}) => {
  // Default state
  const [selectedIndex, setSelectedIndex] = useState(value?.selectedIndex ?? -1);
  const [results] = useState(value?.results ?? []);
  const [searchQuery] = useState(value?.searchQuery ?? '');
  const [isLoading] = useState(value?.isLoading ?? false);
  const [error] = useState(value?.error ?? null);
  const [showConfidenceScores] = useState(value?.showConfidenceScores ?? true);

  // Extract search terms
  const searchTerms = useMemo(() =>
    extractSearchTerms(searchQuery, DEFAULT_SEARCH_TERM_CONFIG),
    [searchQuery]
  );

  // Virtualization settings
  const virtualization = useMemo((): VirtualizationSettings => ({
    ...DEFAULT_VIRTUALIZATION_SETTINGS,
    enabled: results.length >= DEFAULT_VIRTUALIZATION_SETTINGS.threshold,
    ...value?.virtualization
  }), [results.length, value?.virtualization]);

  // Result selection handler
  const handleResultSelect = useCallback((result: SearchResult, index: number) => {
    setSelectedIndex(index);
    value?.onResultSelect?.(result, index);
  }, [value]);

  // Context value
  const contextValue = useMemo((): SearchResultsContextValue => ({
    results,
    searchQuery,
    selectedIndex,
    setSelectedIndex,
    searchTerms,
    showConfidenceScores,
    onResultSelect: handleResultSelect,
    isLoading,
    error,
    virtualization,
    ...value
  }), [
    results,
    searchQuery,
    selectedIndex,
    searchTerms,
    showConfidenceScores,
    handleResultSelect,
    isLoading,
    error,
    virtualization,
    value
  ]);

  return (
    <SearchResultsContext.Provider value={contextValue}>
      {children}
    </SearchResultsContext.Provider>
  );
};

/**
 * Hook that combines all SearchResults functionality
 */
export const useSearchResults = (options: {
  results: SearchResult[];
  searchQuery: string;
  initialSelectedIndex?: number;
  onResultSelect?: (result: SearchResult, index: number) => void;
  showConfidenceScores?: boolean;
}) => {
  const {
    results,
    searchQuery,
    initialSelectedIndex = -1,
    onResultSelect,
    showConfidenceScores = true
  } = options;

  // Search highlighting
  const { searchTerms, highlightText, hasHighlights } = useSearchHighlight(searchQuery);

  // Keyboard navigation
  const {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    navigateToIndex,
    navigateToFirst,
    navigateToLast
  } = useKeyboardNavigation({
    itemCount: results.length,
    initialSelectedIndex,
    onSelectionChange: (index) => {
      if (index >= 0 && index < results.length) {
        onResultSelect?.(results[index], index);
      }
    },
    onItemActivate: (index) => {
      if (index >= 0 && index < results.length) {
        onResultSelect?.(results[index], index);
      }
    }
  });

  // Actions
  const actions = useMemo(() => ({
    selectResult: (result: SearchResult, index: number) => {
      setSelectedIndex(index);
      onResultSelect?.(result, index);
    },
    navigateUp: () => {
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);
    },
    navigateDown: () => {
      const newIndex = Math.min(results.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);
    },
    navigateToFirst,
    navigateToLast,
    clearSelection: () => setSelectedIndex(-1)
  }), [selectedIndex, setSelectedIndex, onResultSelect, results.length, navigateToFirst, navigateToLast]);

  // State
  const state = useMemo((): SearchResultsContextValue => ({
    results,
    searchQuery,
    selectedIndex,
    setSelectedIndex,
    searchTerms,
    showConfidenceScores,
    onResultSelect,
    isLoading: false,
    error: null,
    virtualization: {
      ...DEFAULT_VIRTUALIZATION_SETTINGS,
      enabled: results.length >= DEFAULT_VIRTUALIZATION_SETTINGS.threshold
    }
  }), [
    results,
    searchQuery,
    selectedIndex,
    setSelectedIndex,
    searchTerms,
    showConfidenceScores,
    onResultSelect
  ]);

  return {
    state,
    actions,
    searchTerms,
    highlightText,
    hasHighlights,
    handleKeyDown
  };
};

/**
 * Higher-order component for providing SearchResults context
 */
export const withSearchResultsProvider = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const WrappedComponent = (props: P & { searchResultsValue?: Partial<SearchResultsContextValue> }) => {
    const { searchResultsValue, ...componentProps } = props;

    return (
      <SearchResultsProvider value={searchResultsValue}>
        <Component {...(componentProps as P)} />
      </SearchResultsProvider>
    );
  };

  WrappedComponent.displayName = `withSearchResultsProvider(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export { SearchResultsContext };
export default SearchResultsProvider;