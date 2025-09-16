/**
 * SearchLayout Component
 * Responsive search interface layout optimized for knowledge base search
 */

import React, { useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { BaseComponentProps } from '../types/BaseComponent';
import { smartMemo, useStableCallback } from '../performance/PerformanceOptimizer';
import { ResponsiveGrid, GridItem } from './ResponsiveGrid';
import { LayoutPanel } from './LayoutPanel';

// =========================
// TYPE DEFINITIONS
// =========================

export interface SearchLayoutProps extends BaseComponentProps {
  /** Search input component */
  searchInput: ReactNode;

  /** Search filters/options */
  searchFilters?: ReactNode;

  /** Quick action buttons */
  quickActions?: ReactNode;

  /** Search results component */
  searchResults?: ReactNode;

  /** Selected item detail view */
  detailView?: ReactNode;

  /** Search suggestions */
  suggestions?: ReactNode;

  /** Recent searches */
  recentSearches?: ReactNode;

  /** Search statistics */
  searchStats?: ReactNode;

  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical' | 'auto';

  /** Enable filters panel */
  showFilters?: boolean;

  /** Initial filters panel state */
  filtersCollapsed?: boolean;

  /** Enable suggestions panel */
  showSuggestions?: boolean;

  /** Enable recent searches */
  showRecentSearches?: boolean;

  /** Enable search statistics */
  showStats?: boolean;

  /** Results panel collapsible */
  resultsCollapsible?: boolean;

  /** Detail panel collapsible */
  detailCollapsible?: boolean;

  /** Search layout variant */
  variant?: 'standard' | 'compact' | 'expanded' | 'sidebar';

  /** Enable responsive behavior */
  responsive?: boolean;

  /** Search input placeholder */
  searchPlaceholder?: string;

  /** Loading state */
  loading?: boolean;

  /** No results message */
  noResultsMessage?: ReactNode;

  /** Error state */
  error?: string | ReactNode;

  /** Search callbacks */
  onSearch?: (query: string, filters?: any) => void;
  onFilterChange?: (filters: any) => void;
  onResultSelect?: (result: any) => void;
  onClearSearch?: () => void;

  /** Panel resize callbacks */
  onPanelResize?: (panel: string, size: { width?: number; height?: number }) => void;
}

export interface SearchResultsProps {
  results?: any[];
  loading?: boolean;
  error?: string | ReactNode;
  noResultsMessage?: ReactNode;
  onResultSelect?: (result: any) => void;
  selectedResult?: any;
}

// =========================
// HOOKS
// =========================

/**
 * Search layout responsive behavior
 */
const useSearchLayoutResponsive = (responsive: boolean = true) => {
  const [layoutState, setLayoutState] = useState({
    isMobile: false,
    isTablet: false,
    showSidebar: true,
    orientation: 'horizontal' as const
  });

  React.useEffect(() => {
    if (!responsive) return;

    const updateLayout = () => {
      const width = window.innerWidth;
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;

      setLayoutState(prev => ({
        ...prev,
        isMobile,
        isTablet,
        showSidebar: isDesktop,
        orientation: isMobile ? 'vertical' : 'horizontal'
      }));
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [responsive]);

  return layoutState;
};

/**
 * Search state management
 */
const useSearchState = (
  onSearch?: (query: string, filters?: any) => void,
  onFilterChange?: (filters: any) => void
) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [selectedResult, setSelectedResult] = useState(null);

  const handleSearch = useStableCallback((newQuery: string) => {
    setQuery(newQuery);
    onSearch?.(newQuery, filters);
  }, [filters, onSearch]);

  const handleFilterChange = useStableCallback((newFilters: any) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
    onSearch?.(query, updatedFilters);
  }, [query, filters, onSearch, onFilterChange]);

  const handleResultSelect = useStableCallback((result: any) => {
    setSelectedResult(result);
  }, []);

  return {
    query,
    filters,
    selectedResult,
    handleSearch,
    handleFilterChange,
    handleResultSelect
  };
};

// =========================
// STYLE UTILITIES
// =========================

const getSearchLayoutClasses = (
  variant: SearchLayoutProps['variant'],
  orientation: string,
  responsive: any
) => {
  const { isMobile, isTablet } = responsive;
  const classes = ['search-layout', 'h-full'];

  // Variant-specific classes
  switch (variant) {
    case 'compact':
      classes.push('search-layout-compact');
      break;
    case 'expanded':
      classes.push('search-layout-expanded');
      break;
    case 'sidebar':
      classes.push('search-layout-sidebar');
      break;
    default:
      classes.push('search-layout-standard');
  }

  // Responsive classes
  if (isMobile) {
    classes.push('search-layout-mobile');
  } else if (isTablet) {
    classes.push('search-layout-tablet');
  } else {
    classes.push('search-layout-desktop');
  }

  return classes.join(' ');
};

// =========================
// COMPONENT SECTIONS
// =========================

/**
 * Search Header Section
 */
const SearchHeader: React.FC<{
  searchInput: ReactNode;
  quickActions?: ReactNode;
  showStats?: boolean;
  searchStats?: ReactNode;
  variant?: string;
}> = ({ searchInput, quickActions, showStats, searchStats, variant }) => (
  <div className="search-header bg-white border-b border-gray-200 p-4">
    <div className="flex flex-col space-y-4">
      {/* Search Input Row */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          {searchInput}
        </div>
        {quickActions && (
          <div className="flex items-center space-x-2">
            {quickActions}
          </div>
        )}
      </div>

      {/* Search Stats */}
      {showStats && searchStats && (
        <div className="search-stats text-sm text-gray-600">
          {searchStats}
        </div>
      )}
    </div>
  </div>
);

/**
 * Search Filters Panel
 */
const SearchFilters: React.FC<{
  filters?: ReactNode;
  suggestions?: ReactNode;
  recentSearches?: ReactNode;
  showSuggestions?: boolean;
  showRecentSearches?: boolean;
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}> = ({
  filters,
  suggestions,
  recentSearches,
  showSuggestions,
  showRecentSearches,
  collapsed,
  onToggle
}) => {
  if (!filters && !suggestions && !recentSearches) return null;

  return (
    <LayoutPanel
      title="Search Filters"
      collapsible
      defaultCollapsed={collapsed}
      onToggle={onToggle}
      variant="bordered"
      size="full"
      padding="sm"
      className="search-filters-panel"
    >
      <div className="space-y-4">
        {/* Filters */}
        {filters && (
          <div className="filters-section">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Filters</h4>
            {filters}
          </div>
        )}

        {/* Suggestions */}
        {showSuggestions && suggestions && (
          <div className="suggestions-section">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Suggestions</h4>
            {suggestions}
          </div>
        )}

        {/* Recent Searches */}
        {showRecentSearches && recentSearches && (
          <div className="recent-searches-section">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Searches</h4>
            {recentSearches}
          </div>
        )}
      </div>
    </LayoutPanel>
  );
};

/**
 * Search Results Section
 */
const SearchResults: React.FC<SearchResultsProps & {
  collapsible?: boolean;
  className?: string;
}> = ({
  results = [],
  loading = false,
  error,
  noResultsMessage,
  onResultSelect,
  selectedResult,
  collapsible = false,
  className = ''
}) => {
  const hasResults = results.length > 0;
  const showNoResults = !loading && !error && !hasResults;

  return (
    <LayoutPanel
      title="Search Results"
      collapsible={collapsible}
      variant="bordered"
      size="full"
      padding="none"
      className={`search-results-panel ${className}`}
    >
      <div className="h-full overflow-hidden">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
              <span>Searching...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {typeof error === 'string' ? error : error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Results */}
        {showNoResults && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">{noResultsMessage || 'No results found'}</p>
          </div>
        )}

        {/* Results List */}
        {hasResults && (
          <div className="results-list h-full overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={result.id || index}
                className={`result-item p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedResult?.id === result.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => onResultSelect?.(result)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onResultSelect?.(result);
                  }
                }}
                data-testid={`search-result-${index}`}
              >
                {/* This would be customized based on the actual result structure */}
                <div className="result-content">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">
                    {result.title || result.name}
                  </h3>
                  {result.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {result.description}
                    </p>
                  )}
                  {result.category && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {result.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </LayoutPanel>
  );
};

/**
 * Search Detail Panel
 */
const SearchDetail: React.FC<{
  detailView?: ReactNode;
  selectedResult?: any;
  collapsible?: boolean;
}> = ({ detailView, selectedResult, collapsible = false }) => {
  if (!detailView && !selectedResult) {
    return (
      <LayoutPanel
        title="Details"
        collapsible={collapsible}
        variant="bordered"
        size="full"
        className="search-detail-panel"
      >
        <div className="flex items-center justify-center h-32 text-gray-500">
          <p className="text-sm">Select an item to view details</p>
        </div>
      </LayoutPanel>
    );
  }

  return (
    <LayoutPanel
      title="Details"
      collapsible={collapsible}
      variant="bordered"
      size="full"
      className="search-detail-panel"
    >
      {detailView || (
        <div className="detail-content">
          {selectedResult && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedResult.title || selectedResult.name}
              </h2>
              {selectedResult.description && (
                <p className="text-gray-700">{selectedResult.description}</p>
              )}
              {/* Add more detail fields as needed */}
            </div>
          )}
        </div>
      )}
    </LayoutPanel>
  );
};

// =========================
// MAIN COMPONENT
// =========================

export const SearchLayout = smartMemo<SearchLayoutProps>(
  ({
    searchInput,
    searchFilters,
    quickActions,
    searchResults,
    detailView,
    suggestions,
    recentSearches,
    searchStats,
    orientation = 'auto',
    showFilters = true,
    filtersCollapsed = false,
    showSuggestions = true,
    showRecentSearches = true,
    showStats = false,
    resultsCollapsible = false,
    detailCollapsible = false,
    variant = 'standard',
    responsive = true,
    loading = false,
    noResultsMessage,
    error,
    onSearch,
    onFilterChange,
    onResultSelect,
    onPanelResize,
    className = '',
    style,
    'data-testid': testId,
    ...restProps
  }) => {
    // Responsive layout state
    const responsiveState = useSearchLayoutResponsive(responsive);
    const { isMobile, isTablet, orientation: autoOrientation } = responsiveState;

    // Search state management
    const searchState = useSearchState(onSearch, onFilterChange);

    // Determine final orientation
    const finalOrientation = orientation === 'auto' ? autoOrientation : orientation;

    // Layout configuration based on variant and responsiveness
    const layoutConfig = useMemo(() => {
      if (isMobile) {
        return {
          areas: [
            'header',
            'filters',
            'results',
            'detail'
          ],
          cols: { xs: 1 },
          gap: 'sm'
        };
      }

      if (isTablet) {
        return {
          areas: [
            'header header',
            'filters results',
            'detail detail'
          ],
          cols: { md: 2 },
          gap: 'md'
        };
      }

      // Desktop layout
      switch (variant) {
        case 'compact':
          return {
            areas: [
              'header header header',
              'filters results detail'
            ],
            cols: { lg: 3 },
            gap: 'md'
          };

        case 'expanded':
          return {
            areas: [
              'header header header header',
              'filters results results detail'
            ],
            cols: { lg: 4 },
            gap: 'lg'
          };

        case 'sidebar':
          return {
            areas: [
              'filters header header',
              'filters results detail'
            ],
            cols: { lg: 3 },
            gap: 'md'
          };

        default: // standard
          return {
            areas: [
              'header header header',
              'filters results detail'
            ],
            cols: { lg: 3 },
            gap: 'md'
          };
      }
    }, [variant, isMobile, isTablet]);

    // Layout classes
    const searchLayoutClasses = useMemo(() => {
      const base = getSearchLayoutClasses(variant, finalOrientation, responsiveState);
      return className ? `${base} ${className}` : base;
    }, [variant, finalOrientation, responsiveState, className]);

    return (
      <div
        className={searchLayoutClasses}
        style={style}
        data-testid={testId}
        data-variant={variant}
        data-orientation={finalOrientation}
        data-responsive={responsive}
        {...restProps}
      >
        <ResponsiveGrid
          areas={layoutConfig.areas}
          cols={layoutConfig.cols}
          gap={layoutConfig.gap}
          className="h-full"
        >
          {/* Search Header */}
          <GridItem area="header">
            <SearchHeader
              searchInput={searchInput}
              quickActions={quickActions}
              showStats={showStats}
              searchStats={searchStats}
              variant={variant}
            />
          </GridItem>

          {/* Filters Panel */}
          {showFilters && (
            <GridItem area="filters">
              <SearchFilters
                filters={searchFilters}
                suggestions={suggestions}
                recentSearches={recentSearches}
                showSuggestions={showSuggestions}
                showRecentSearches={showRecentSearches}
                collapsed={filtersCollapsed}
              />
            </GridItem>
          )}

          {/* Results Panel */}
          <GridItem area="results">
            <SearchResults
              loading={loading}
              error={error}
              noResultsMessage={noResultsMessage}
              onResultSelect={(result) => {
                searchState.handleResultSelect(result);
                onResultSelect?.(result);
              }}
              selectedResult={searchState.selectedResult}
              collapsible={resultsCollapsible}
            />
          </GridItem>

          {/* Detail Panel */}
          <GridItem area="detail">
            <SearchDetail
              detailView={detailView}
              selectedResult={searchState.selectedResult}
              collapsible={detailCollapsible}
            />
          </GridItem>
        </ResponsiveGrid>
      </div>
    );
  },
  {
    compareProps: ['variant', 'orientation', 'showFilters', 'loading'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

SearchLayout.displayName = 'SearchLayout';

// =========================
// LAYOUT VARIANTS
// =========================

export const CompactSearchLayout: React.FC<Omit<SearchLayoutProps, 'variant'>> = (props) => (
  <SearchLayout variant="compact" {...props} />
);

export const ExpandedSearchLayout: React.FC<Omit<SearchLayoutProps, 'variant'>> = (props) => (
  <SearchLayout variant="expanded" {...props} />
);

export const SidebarSearchLayout: React.FC<Omit<SearchLayoutProps, 'variant'>> = (props) => (
  <SearchLayout variant="sidebar" {...props} />
);

export default SearchLayout;