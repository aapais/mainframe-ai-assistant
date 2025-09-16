/**
 * SearchResults Module Index
 *
 * Centralized exports for the SearchResults component architecture
 * @version 2.0.0
 */

// Main component
export { default as SearchResults, SimpleSearchResults, useSearchResultsState } from './SearchResults';

// Sub-components
export * from './components';

// Hooks
export * from './hooks/useSearchHighlight';
export * from './hooks/useKeyboardNavigation';
export * from './hooks/useVirtualization';

// Providers
export * from './providers/SearchResultsProvider';

// Types
export * from './types';

// Utilities
export * from './utils';

// Re-export for backward compatibility
export { default } from './SearchResults';