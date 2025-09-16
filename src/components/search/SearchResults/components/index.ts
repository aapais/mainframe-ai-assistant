/**
 * SearchResults Components Index
 *
 * Centralized exports for all SearchResults components
 * @version 2.0.0
 */

// Core components
export { default as SearchResultItem, SearchResultItemWithRef } from './SearchResultItem';
export { default as HighlightText, HighlightTextHTML } from './HighlightText';
export { default as ConfidenceScore, ConfidenceScoreCompact, ConfidenceScoreLegend } from './ConfidenceScore';
export { default as LazyImage, SimpleImage } from './LazyImage';
export { default as VirtualList, SearchResultsVirtualList, SimpleList, AdaptiveList } from './VirtualList';
export { default as ErrorBoundary, SearchResultsErrorBoundary, InlineErrorBoundary, SearchResultsErrorFallback, withErrorBoundary, useErrorHandler } from './ErrorBoundary';

// State components
export { LoadingState, SearchResultsSkeleton, CompactLoadingState } from './LoadingState';
export { EmptyState, CompactEmptyState, EmptyStateWithSuggestions } from './EmptyState';
export { ErrorState, CompactErrorState, NetworkErrorState, TimeoutErrorState } from './ErrorState';

// Layout components
export { SearchResultsHeader, CompactSearchResultsHeader } from './SearchResultsHeader';
export { SearchResultsFooter, SimplePaginationFooter, CompactSearchResultsFooter } from './SearchResultsFooter';
export { SearchResultsList, StandaloneSearchResultsList } from './SearchResultsList';