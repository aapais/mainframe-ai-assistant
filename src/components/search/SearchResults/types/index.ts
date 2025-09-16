/**
 * TypeScript Type Definitions for SearchResults Component Architecture
 *
 * Comprehensive type definitions for all SearchResults components with strict TypeScript compliance
 * @version 2.0.0
 */

import { ReactNode, CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import { SearchResult, KBEntry } from '../../../../types/index';

// ========================
// Core Component Props
// ========================

export interface SearchResultsProps {
  /** Array of search results to display */
  results: SearchResult[];
  /** Search query for highlighting */
  searchQuery: string;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
  /** Selected result index for keyboard navigation */
  selectedIndex?: number;
  /** Callback when result is selected */
  onResultSelect?: (result: SearchResult, index: number) => void;
  /** Callback when more results need to be loaded */
  onLoadMore?: () => void;
  /** Whether to show confidence scores */
  showConfidenceScores?: boolean;
  /** Custom className */
  className?: string;
  /** ARIA label for the results list */
  ariaLabel?: string;
  /** Maximum number of results to display before virtualization */
  virtualizationThreshold?: number;
  /** Height of each result item for virtualization */
  itemHeight?: number;
  /** Container height for virtual scrolling */
  containerHeight?: number;
}

export interface SearchResultItemProps {
  /** The search result data */
  result: SearchResult;
  /** Item index in the list */
  index: number;
  /** Whether this item is currently selected */
  isSelected: boolean;
  /** Search terms for highlighting */
  searchTerms: readonly string[];
  /** Whether to show confidence scores */
  showConfidenceScores: boolean;
  /** Callback when item is selected */
  onSelect: (result: SearchResult, index: number) => void;
  /** Custom className */
  className?: string;
  /** Custom style (for virtual scrolling) */
  style?: CSSProperties;
}

export interface VirtualizedResultItemProps {
  /** Item index */
  index: number;
  /** Inline styles for positioning */
  style: CSSProperties;
  /** Shared data for all virtual items */
  data: VirtualizedItemData;
}

export interface VirtualizedItemData {
  /** Array of search results */
  results: SearchResult[];
  /** Search query for highlighting */
  searchQuery: string;
  /** Currently selected index */
  selectedIndex: number;
  /** Selection callback */
  onResultSelect: (result: SearchResult, index: number) => void;
  /** Whether to show confidence scores */
  showConfidenceScores: boolean;
  /** Search terms for highlighting */
  searchTerms: readonly string[];
}

// ========================
// Sub-Component Props
// ========================

export interface HighlightTextProps {
  /** Text to highlight */
  text: string;
  /** Search terms to highlight */
  searchTerms: readonly string[];
  /** Custom className */
  className?: string;
  /** HTML tag to render */
  as?: keyof JSX.IntrinsicElements;
}

export interface LazyImageProps {
  /** Image source URL */
  src?: string;
  /** Alt text for accessibility */
  alt: string;
  /** Custom className */
  className?: string;
  /** Fallback image source */
  fallbackSrc?: string;
  /** Intersection observer options */
  observerOptions?: IntersectionObserverInit;
  /** Loading placeholder component */
  placeholder?: ReactNode;
  /** Error placeholder component */
  errorPlaceholder?: ReactNode;
}

export interface ConfidenceScoreProps {
  /** Confidence score (0-1) */
  score: number;
  /** Type of match */
  matchType: SearchResult['matchType'];
  /** Show percentage text */
  showPercentage?: boolean;
  /** Custom className */
  className?: string;
  /** Bar color override */
  color?: string;
}

export interface VirtualListProps<T = unknown> {
  /** Array of items to render */
  items: T[];
  /** Height of each item */
  itemHeight: number;
  /** Container height */
  containerHeight: number;
  /** Render function for each item */
  renderItem: (props: VirtualizedResultItemProps) => ReactNode;
  /** Shared data for all items */
  itemData: VirtualizedItemData;
  /** Custom className */
  className?: string;
  /** Buffer size for rendering extra items */
  bufferSize?: number;
  /** Scroll event handler */
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

// ========================
// Provider Props
// ========================

export interface SearchResultsContextValue {
  /** Current search results */
  results: SearchResult[];
  /** Current search query */
  searchQuery: string;
  /** Selected result index */
  selectedIndex: number;
  /** Set selected index */
  setSelectedIndex: (index: number) => void;
  /** Search terms for highlighting */
  searchTerms: readonly string[];
  /** Whether to show confidence scores */
  showConfidenceScores: boolean;
  /** Selection handler */
  onResultSelect?: (result: SearchResult, index: number) => void;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Virtualization settings */
  virtualization: VirtualizationSettings;
}

export interface SearchResultsProviderProps {
  /** Child components */
  children: ReactNode;
  /** Provider value override */
  value?: Partial<SearchResultsContextValue>;
}

export interface VirtualizationSettings {
  /** Whether virtualization is enabled */
  enabled: boolean;
  /** Number of items threshold for virtualization */
  threshold: number;
  /** Item height */
  itemHeight: number;
  /** Container height */
  containerHeight: number;
  /** Buffer size */
  bufferSize: number;
}

// ========================
// Hook Return Types
// ========================

export interface UseSearchHighlightReturn {
  /** Extracted search terms */
  searchTerms: readonly string[];
  /** Function to highlight text */
  highlightText: (text: string) => ReactNode;
  /** Function to check if text contains search terms */
  hasHighlights: (text: string) => boolean;
}

export interface UseKeyboardNavigationReturn {
  /** Currently selected index */
  selectedIndex: number;
  /** Set selected index */
  setSelectedIndex: (index: number) => void;
  /** Keyboard event handler */
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Navigate to specific index */
  navigateToIndex: (index: number) => void;
  /** Navigate to first item */
  navigateToFirst: () => void;
  /** Navigate to last item */
  navigateToLast: () => void;
}

export interface UseVirtualizationReturn {
  /** Virtualization settings */
  settings: VirtualizationSettings;
  /** Visible item range */
  visibleRange: { start: number; end: number };
  /** Container props */
  containerProps: {
    style: CSSProperties;
    onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
    className: string;
  };
  /** Virtual item props generator */
  getItemProps: (index: number) => {
    style: CSSProperties;
    key: string | number;
  };
  /** Total height of all items */
  totalHeight: number;
  /** Current scroll position */
  scrollTop: number;
}

export interface UseSearchResultsReturn {
  /** All state and handlers */
  state: SearchResultsContextValue;
  /** Action creators */
  actions: {
    selectResult: (result: SearchResult, index: number) => void;
    navigateUp: () => void;
    navigateDown: () => void;
    navigateToFirst: () => void;
    navigateToLast: () => void;
    clearSelection: () => void;
  };
}

// ========================
// Error Boundary Types
// ========================

export interface ErrorBoundaryState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** Error details */
  error?: Error;
  /** Error info from React */
  errorInfo?: React.ErrorInfo;
}

export interface ErrorBoundaryProps {
  /** Child components to protect */
  children: ReactNode;
  /** Custom error fallback component */
  fallback?: ReactNode | ((error: Error, errorInfo: React.ErrorInfo) => ReactNode);
  /** Error callback */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to log errors to console */
  logErrors?: boolean;
}

// ========================
// Utility Types
// ========================

export interface HighlightMatch {
  /** Matched text */
  text: string;
  /** Start index in original text */
  start: number;
  /** End index in original text */
  end: number;
  /** Whether this is a highlighted match */
  isHighlight: boolean;
}

export interface SearchTermConfig {
  /** Minimum term length */
  minLength: number;
  /** Whether to include partial matches */
  includePartial: boolean;
  /** Custom word boundaries */
  wordBoundaries: string;
  /** Case sensitivity */
  caseSensitive: boolean;
}

export interface VirtualScrollState {
  /** Current scroll position */
  scrollTop: number;
  /** Visible start index */
  startIndex: number;
  /** Visible end index */
  endIndex: number;
  /** Container height */
  containerHeight: number;
  /** Item height */
  itemHeight: number;
}

// ========================
// Event Handler Types
// ========================

export type SearchResultSelectHandler = (result: SearchResult, index: number) => void;
export type LoadMoreHandler = () => void;
export type NavigationHandler = (direction: 'up' | 'down' | 'first' | 'last') => void;
export type VirtualScrollHandler = (event: React.UIEvent<HTMLDivElement>) => void;

// ========================
// Configuration Types
// ========================

export interface SearchResultsConfig {
  /** Virtualization configuration */
  virtualization: VirtualizationSettings;
  /** Highlighting configuration */
  highlighting: SearchTermConfig;
  /** Accessibility configuration */
  accessibility: {
    announceChanges: boolean;
    announceSelection: boolean;
    announceLoading: boolean;
  };
  /** Performance configuration */
  performance: {
    debounceMs: number;
    throttleMs: number;
    maxRenderedItems: number;
  };
}

// ========================
// Component Compound Pattern Types
// ========================

export interface SearchResultsCompoundComponents {
  Provider: React.ComponentType<SearchResultsProviderProps>;
  List: React.ComponentType<Pick<SearchResultsProps, 'className' | 'ariaLabel'>>;
  Item: React.ComponentType<SearchResultItemProps>;
  Header: React.ComponentType<{ className?: string }>;
  Footer: React.ComponentType<{ className?: string; onLoadMore?: LoadMoreHandler }>;
  EmptyState: React.ComponentType<{ className?: string; message?: string }>;
  LoadingState: React.ComponentType<{ className?: string; message?: string }>;
  ErrorState: React.ComponentType<{ className?: string; error: string; onRetry?: () => void }>;
}

// ========================
// Re-exports
// ========================

export type { SearchResult, KBEntry } from '../../../../types/index';

// ========================
// Default Configurations
// ========================

export const DEFAULT_VIRTUALIZATION_SETTINGS: VirtualizationSettings = {
  enabled: false,
  threshold: 20,
  itemHeight: 200,
  containerHeight: 600,
  bufferSize: 5,
} as const;

export const DEFAULT_SEARCH_TERM_CONFIG: SearchTermConfig = {
  minLength: 2,
  includePartial: true,
  wordBoundaries: '\\s\\.,;:!?()[]{}"\'-',
  caseSensitive: false,
} as const;

export const DEFAULT_SEARCH_RESULTS_CONFIG: SearchResultsConfig = {
  virtualization: DEFAULT_VIRTUALIZATION_SETTINGS,
  highlighting: DEFAULT_SEARCH_TERM_CONFIG,
  accessibility: {
    announceChanges: true,
    announceSelection: true,
    announceLoading: true,
  },
  performance: {
    debounceMs: 150,
    throttleMs: 16,
    maxRenderedItems: 100,
  },
} as const;