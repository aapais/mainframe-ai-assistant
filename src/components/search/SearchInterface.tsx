/**
 * SearchInterface - Main Search UI Component
 *
 * Comprehensive search interface with:
 * - Intelligent autocomplete with debouncing
 * - Search result display with highlights
 * - Snippet preview with context
 * - Advanced filters and facets
 * - Responsive design and accessibility
 * - Real-time search with WebSocket support
 * - Export functionality
 *
 * @author Frontend Developer
 * @version 2.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo
} from 'react';
import { Search, Filter, SlidersHorizontal, Download, Layers } from 'lucide-react';
import { IntelligentSearchInput } from './IntelligentSearchInput';
import { SearchResults } from './SearchResults';
import { SearchFilters } from './SearchFilters';
import { SnippetPreview } from './SnippetPreview';
import { SearchResultsOptimized } from './SearchResultsOptimized';
import { useDebounce } from '../../hooks/useDebounce';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { useAutocomplete } from '../../hooks/useAutocomplete';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { SearchResult, SearchFilter, SearchOptions, AutocompleteSuggestion } from '../../types';

// ========================
// Types & Interfaces
// ========================

export interface SearchInterfaceProps {
  /** Initial search query */
  initialQuery?: string;
  /** Search placeholder text */
  placeholder?: string;
  /** Enable real-time search */
  enableRealTimeSearch?: boolean;
  /** Enable search filters */
  enableFilters?: boolean;
  /** Enable snippet preview */
  enableSnippetPreview?: boolean;
  /** Enable export functionality */
  enableExport?: boolean;
  /** Custom CSS className */
  className?: string;
  /** Search API endpoint */
  searchEndpoint?: string;
  /** WebSocket URL for real-time updates */
  websocketUrl?: string;
  /** Maximum results per page */
  pageSize?: number;
  /** Custom filter configurations */
  customFilters?: SearchFilter[];
  /** Theme variant */
  variant?: 'default' | 'compact' | 'expanded';
  /** Mobile responsive breakpoint */
  mobileBreakpoint?: number;

  // Event handlers
  onSearch?: (query: string, filters: SearchFilter[], options: SearchOptions) => Promise<SearchResult[]>;
  onResultSelect?: (result: SearchResult, index: number) => void;
  onFilterChange?: (filters: SearchFilter[]) => void;
  onExport?: (format: string, data: any) => void;
  onError?: (error: Error) => void;

  // Performance options
  virtualizeResults?: boolean;
  debounceMs?: number;
  cacheResults?: boolean;
  maxCachedQueries?: number;

  // Accessibility options
  ariaLabel?: string;
  ariaDescribedBy?: string;
  highContrastMode?: boolean;
  announceResults?: boolean;
}

export interface SearchInterfaceHandle {
  performSearch: (query: string, options?: SearchOptions) => Promise<void>;
  clearSearch: () => void;
  exportResults: (format: 'json' | 'csv' | 'excel') => Promise<void>;
  toggleFilters: () => void;
  focusSearch: () => void;
  getSearchState: () => SearchState;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  filters: SearchFilter[];
  loading: boolean;
  error: string | null;
  totalResults: number;
  currentPage: number;
  hasMore: boolean;
  selectedResult: SearchResult | null;
  previewVisible: boolean;
}

// ========================
// Default Configurations
// ========================

const DEFAULT_FILTERS: SearchFilter[] = [
  {
    id: 'category',
    type: 'category',
    label: 'Category',
    value: 'all',
    active: false,
    options: [
      { label: 'All Categories', value: 'all' },
      { label: 'VSAM Errors', value: 'vsam' },
      { label: 'JCL Issues', value: 'jcl' },
      { label: 'COBOL Abends', value: 'cobol' },
      { label: 'DB2 SQL', value: 'db2' },
      { label: 'System Errors', value: 'system' }
    ]
  },
  {
    id: 'difficulty',
    type: 'range',
    label: 'Complexity',
    value: [1, 5],
    active: false,
    min: 1,
    max: 5
  },
  {
    id: 'date',
    type: 'date',
    label: 'Last Updated',
    value: null,
    active: false,
    options: [
      { label: 'Any time', value: null },
      { label: 'Last 24 hours', value: '1d' },
      { label: 'Last week', value: '7d' },
      { label: 'Last month', value: '30d' },
      { label: 'Last year', value: '365d' }
    ]
  },
  {
    id: 'tags',
    type: 'multiselect',
    label: 'Tags',
    value: [],
    active: false,
    options: []
  }
];

const EXPORT_FORMATS = [
  { label: 'JSON', value: 'json', icon: '📄' },
  { label: 'CSV', value: 'csv', icon: '📊' },
  { label: 'Excel', value: 'excel', icon: '📈' },
  { label: 'PDF', value: 'pdf', icon: '📋' }
];

// ========================
// Main Component
// ========================

export const SearchInterface = memo(forwardRef<SearchInterfaceHandle, SearchInterfaceProps>(({
  initialQuery = '',
  placeholder = 'Search knowledge base...',
  enableRealTimeSearch = true,
  enableFilters = true,
  enableSnippetPreview = true,
  enableExport = true,
  className = '',
  searchEndpoint = '/api/search',
  websocketUrl,
  pageSize = 20,
  customFilters = [],
  variant = 'default',
  mobileBreakpoint = 768,
  onSearch,
  onResultSelect,
  onFilterChange,
  onExport,
  onError,
  virtualizeResults = false,
  debounceMs = 300,
  cacheResults = true,
  maxCachedQueries = 50,
  ariaLabel = 'Knowledge base search interface',
  ariaDescribedBy,
  highContrastMode = false,
  announceResults = true
}, ref) => {
  // ========================
  // State Management
  // ========================

  const [searchState, setSearchState] = useState<SearchState>({
    query: initialQuery,
    results: [],
    filters: [...DEFAULT_FILTERS, ...customFilters],
    loading: false,
    error: null,
    totalResults: 0,
    currentPage: 1,
    hasMore: false,
    selectedResult: null,
    previewVisible: false
  });

  const [uiState, setUIState] = useState({
    filtersVisible: false,
    exportMenuVisible: false,
    viewMode: 'list' as 'list' | 'grid' | 'compact'
  });

  // ========================
  // Refs and Hooks
  // ========================

  const searchInputRef = useRef<any>(null);
  const resultsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Media query for responsive design
  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint}px)`);
  const isTablet = useMediaQuery('(max-width: 1024px)');

  // Search debouncing
  const [debouncedQuery] = useDebounce(searchState.query, debounceMs);

  // Search history
  const { addSearch, getRecentSearches, getSuggestions } = useSearchHistory({
    enabled: true,
    maxHistory: 100
  });

  // Autocomplete
  const autocomplete = useAutocomplete([
    {
      id: 'history',
      name: 'Search History',
      getSuggestions: async (query) => getSuggestions(query),
      priority: 10,
      enabled: true
    }
  ], {
    minLength: 2,
    maxSuggestions: 8,
    debounceMs: 100
  });

  // Keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts({
    'ctrl+k': () => searchInputRef.current?.focus(),
    'ctrl+f': () => toggleFilters(),
    'escape': () => clearSearch(),
    'ctrl+e': () => setUIState(prev => ({ ...prev, exportMenuVisible: !prev.exportMenuVisible }))
  });

  // ========================
  // Search Operations
  // ========================

  const performSearch = useCallback(async (
    query: string,
    options: SearchOptions = {}
  ) => {
    if (!query.trim() && !searchState.filters.some(f => f.active)) {
      return;
    }

    setSearchState(prev => ({
      ...prev,
      loading: true,
      error: null,
      query
    }));

    try {
      const searchOptions: SearchOptions = {
        ...options,
        page: options.page || 1,
        limit: pageSize,
        filters: searchState.filters.filter(f => f.active),
        highlight: true,
        includeTags: true,
        sortBy: options.sortBy || 'relevance'
      };

      let results: SearchResult[] = [];

      if (onSearch) {
        results = await onSearch(query, searchState.filters, searchOptions);
      } else {
        // Default search implementation
        const response = await fetch(searchEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            ...searchOptions
          })
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data = await response.json();
        results = data.results || [];
      }

      // Add to search history
      addSearch(query, results.length, Date.now(), {
        success: true,
        filters: searchState.filters.filter(f => f.active).length,
        responseTime: Date.now()
      });

      setSearchState(prev => ({
        ...prev,
        results: options.page === 1 ? results : [...prev.results, ...results],
        loading: false,
        totalResults: results.length,
        hasMore: results.length === pageSize,
        currentPage: options.page || 1
      }));

      // Announce results for accessibility
      if (announceResults) {
        const message = `Found ${results.length} results for "${query}"`;
        // This would connect to an aria-live region
        console.log('Announce:', message);
      }

    } catch (error) {
      console.error('Search error:', error);
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }));
      onError?.(error instanceof Error ? error : new Error('Search failed'));
    }
  }, [
    searchEndpoint,
    searchState.filters,
    pageSize,
    onSearch,
    addSearch,
    announceResults,
    onError
  ]);

  const loadMoreResults = useCallback(async () => {
    if (!searchState.hasMore || searchState.loading) return;

    await performSearch(searchState.query, {
      page: searchState.currentPage + 1,
      append: true
    });
  }, [searchState.hasMore, searchState.loading, searchState.query, searchState.currentPage, performSearch]);

  // ========================
  // Filter Operations
  // ========================

  const updateFilter = useCallback((filterId: string, value: any, active?: boolean) => {
    setSearchState(prev => ({
      ...prev,
      filters: prev.filters.map(filter =>
        filter.id === filterId
          ? { ...filter, value, active: active ?? true }
          : filter
      )
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      filters: prev.filters.map(filter => ({ ...filter, active: false }))
    }));
  }, []);

  const toggleFilters = useCallback(() => {
    setUIState(prev => ({ ...prev, filtersVisible: !prev.filtersVisible }));
  }, []);

  // ========================
  // Export Operations
  // ========================

  const exportResults = useCallback(async (format: 'json' | 'csv' | 'excel' | 'pdf') => {
    if (searchState.results.length === 0) {
      alert('No results to export');
      return;
    }

    try {
      let exportData: any;
      let filename: string;
      let mimeType: string;

      const timestamp = new Date().toISOString().split('T')[0];

      switch (format) {
        case 'json':
          exportData = JSON.stringify({
            query: searchState.query,
            results: searchState.results,
            filters: searchState.filters.filter(f => f.active),
            exportedAt: new Date().toISOString(),
            totalResults: searchState.totalResults
          }, null, 2);
          filename = `search-results-${timestamp}.json`;
          mimeType = 'application/json';
          break;

        case 'csv':
          const csvHeaders = ['Title', 'Category', 'Problem', 'Solution', 'Tags', 'Score', 'Updated'];
          const csvRows = searchState.results.map(result => [
            `"${result.entry.title.replace(/"/g, '""')}"`,
            `"${result.entry.category}"`,
            `"${result.entry.problem.replace(/"/g, '""')}"`,
            `"${result.entry.solution.replace(/"/g, '""')}"`,
            `"${result.entry.tags.join(', ')}"`,
            result.score.toFixed(2),
            result.entry.updated_at
          ]);
          exportData = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
          filename = `search-results-${timestamp}.csv`;
          mimeType = 'text/csv';
          break;

        case 'excel':
          // For Excel export, we'll generate CSV and let the browser handle it
          exportData = [
            ['Title', 'Category', 'Problem', 'Solution', 'Tags', 'Score', 'Updated'],
            ...searchState.results.map(result => [
              result.entry.title,
              result.entry.category,
              result.entry.problem,
              result.entry.solution,
              result.entry.tags.join(', '),
              result.score,
              result.entry.updated_at
            ])
          ].map(row => row.join('\t')).join('\n');
          filename = `search-results-${timestamp}.xlsx`;
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // Create and download blob
      const blob = new Blob([exportData], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onExport?.(format, exportData);

    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
  }, [searchState.results, searchState.query, searchState.filters, searchState.totalResults, onExport]);

  // ========================
  // UI Operations
  // ========================

  const clearSearch = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      query: '',
      results: [],
      error: null,
      selectedResult: null,
      previewVisible: false
    }));
    searchInputRef.current?.clear();
  }, []);

  const handleResultSelect = useCallback((result: SearchResult, index: number) => {
    setSearchState(prev => ({
      ...prev,
      selectedResult: result,
      previewVisible: enableSnippetPreview
    }));

    onResultSelect?.(result, index);

    // Track selection analytics
    if (enableRealTimeSearch && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'result_selected',
        data: {
          resultId: result.entry.id,
          query: searchState.query,
          index,
          timestamp: Date.now()
        }
      }));
    }
  }, [enableSnippetPreview, enableRealTimeSearch, searchState.query, onResultSelect]);

  const handleSuggestionSelect = useCallback((suggestion: AutocompleteSuggestion) => {
    setSearchState(prev => ({ ...prev, query: suggestion.text }));
    performSearch(suggestion.text);
  }, [performSearch]);

  // ========================
  // Effects
  // ========================

  // Auto-search on debounced query change
  useEffect(() => {
    if (enableRealTimeSearch && debouncedQuery && debouncedQuery !== initialQuery) {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery, enableRealTimeSearch, performSearch, initialQuery]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!websocketUrl || !enableRealTimeSearch) return;

    const ws = new WebSocket(websocketUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Search WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'search_results_updated') {
          // Refresh current search
          if (searchState.query) {
            performSearch(searchState.query, { force: true });
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onclose = () => {
      console.log('Search WebSocket disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [websocketUrl, enableRealTimeSearch, searchState.query, performSearch]);

  // Filter change effect
  useEffect(() => {
    const activeFilters = searchState.filters.filter(f => f.active);
    onFilterChange?.(activeFilters);

    // Re-search if there's a query and filters changed
    if (searchState.query && activeFilters.length > 0) {
      performSearch(searchState.query);
    }
  }, [searchState.filters, searchState.query, performSearch, onFilterChange]);

  // Initial search
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  // ========================
  // Imperative Handle
  // ========================

  useImperativeHandle(ref, () => ({
    performSearch,
    clearSearch,
    exportResults,
    toggleFilters,
    focusSearch: () => searchInputRef.current?.focus(),
    getSearchState: () => searchState
  }), [performSearch, clearSearch, exportResults, toggleFilters, searchState]);

  // ========================
  // Computed Values
  // ========================

  const activeFilterCount = searchState.filters.filter(f => f.active).length;
  const hasResults = searchState.results.length > 0;
  const showFilters = enableFilters && (uiState.filtersVisible || !isMobile);
  const showPreview = enableSnippetPreview && searchState.previewVisible && searchState.selectedResult;

  const layoutClasses = useMemo(() => {
    const baseClasses = [
      'search-interface',
      'flex flex-col h-full',
      variant === 'compact' && 'compact-mode',
      variant === 'expanded' && 'expanded-mode',
      isMobile && 'mobile-layout',
      isTablet && 'tablet-layout',
      highContrastMode && 'high-contrast',
      className
    ].filter(Boolean).join(' ');

    return baseClasses;
  }, [variant, isMobile, isTablet, highContrastMode, className]);

  // ========================
  // Render Methods
  // ========================

  const renderToolbar = () => (
    <div className="search-toolbar flex items-center justify-between p-2 border-b bg-gray-50">
      <div className="flex items-center gap-2">
        {enableFilters && (
          <button
            onClick={toggleFilters}
            className={`toolbar-button p-2 rounded-lg transition-colors ${
              uiState.filtersVisible ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
            title="Toggle filters"
            aria-label="Toggle search filters"
          >
            <SlidersHorizontal size={18} />
            {activeFilterCount > 0 && (
              <span className="ml-1 text-xs bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        <div className="view-mode-selector flex items-center gap-1 border rounded-lg p-1">
          {['list', 'grid', 'compact'].map((mode) => (
            <button
              key={mode}
              onClick={() => setUIState(prev => ({ ...prev, viewMode: mode as any }))}
              className={`p-1.5 rounded text-xs transition-colors ${
                uiState.viewMode === mode
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
              title={`${mode} view`}
            >
              <Layers size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasResults && (
          <span className="text-sm text-gray-600">
            {searchState.totalResults} result{searchState.totalResults !== 1 ? 's' : ''}
          </span>
        )}

        {enableExport && hasResults && (
          <div className="relative">
            <button
              onClick={() => setUIState(prev => ({
                ...prev,
                exportMenuVisible: !prev.exportMenuVisible
              }))}
              className="toolbar-button p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Export results"
              aria-label="Export search results"
            >
              <Download size={18} />
            </button>

            {uiState.exportMenuVisible && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[120px]">
                {EXPORT_FORMATS.map(format => (
                  <button
                    key={format.value}
                    onClick={() => {
                      exportResults(format.value as any);
                      setUIState(prev => ({ ...prev, exportMenuVisible: false }));
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <span>{format.icon}</span>
                    <span className="text-sm">{format.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    const contentLayout = showFilters && showPreview
      ? 'three-column'
      : showFilters || showPreview
        ? 'two-column'
        : 'single-column';

    return (
      <div className={`search-content flex-1 flex ${contentLayout === 'single-column' ? 'flex-col' : ''}`}>
        {/* Filters Sidebar */}
        {showFilters && (
          <div className={`filters-sidebar ${
            isMobile ? 'w-full border-b' : 'w-80 border-r'
          } bg-gray-50`}>
            <SearchFilters
              filters={searchState.filters}
              onFilterChange={updateFilter}
              onClearFilters={clearFilters}
              className="p-4"
            />
          </div>
        )}

        {/* Main Results Area */}
        <div className="results-area flex-1 flex flex-col min-w-0">
          {searchState.loading && searchState.results.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
                <p className="text-gray-600">Searching...</p>
              </div>
            </div>
          ) : searchState.error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-600">
                <p className="font-semibold mb-2">Search Error</p>
                <p className="text-sm">{searchState.error}</p>
                <button
                  onClick={() => performSearch(searchState.query)}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : hasResults ? (
            virtualizeResults ? (
              <SearchResultsOptimized
                ref={resultsRef}
                results={searchState.results}
                searchQuery={searchState.query}
                onResultSelect={handleResultSelect}
                onLoadMore={searchState.hasMore ? loadMoreResults : undefined}
                showConfidenceScores={true}
                viewMode={uiState.viewMode}
                loading={searchState.loading}
              />
            ) : (
              <SearchResults
                results={searchState.results}
                searchQuery={searchState.query}
                onResultSelect={handleResultSelect}
                showConfidenceScores={true}
                loading={searchState.loading}
                selectedIndex={-1}
                className="flex-1"
              />
            )
          ) : searchState.query ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500">
                <p className="text-4xl mb-4">🔍</p>
                <p className="font-semibold mb-2">No results found</p>
                <p className="text-sm">Try adjusting your search terms or filters</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500">
                <p className="text-4xl mb-4">🔍</p>
                <p className="font-semibold mb-2">Start searching</p>
                <p className="text-sm">Enter a query to find relevant knowledge</p>
              </div>
            </div>
          )}
        </div>

        {/* Snippet Preview Sidebar */}
        {showPreview && searchState.selectedResult && (
          <div className={`preview-sidebar ${
            isMobile ? 'w-full border-t' : 'w-96 border-l'
          } bg-white`}>
            <SnippetPreview
              result={searchState.selectedResult}
              searchQuery={searchState.query}
              onClose={() => setSearchState(prev => ({ ...prev, previewVisible: false }))}
              className="h-full"
            />
          </div>
        )}
      </div>
    );
  };

  // ========================
  // Main Render
  // ========================

  return (
    <div
      ref={containerRef}
      className={layoutClasses}
      role="search"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      data-variant={variant}
      data-mobile={isMobile}
      data-high-contrast={highContrastMode}
    >
      {/* Search Input Header */}
      <div className="search-header p-4 border-b bg-white">
        <IntelligentSearchInput
          ref={searchInputRef}
          value={searchState.query}
          placeholder={placeholder}
          onChange={(value) => setSearchState(prev => ({ ...prev, query: value }))}
          onSearch={(query) => performSearch(query)}
          onSuggestionSelect={handleSuggestionSelect}
          loading={searchState.loading}
          error={searchState.error}
          enableAutocomplete={true}
          enableHistory={true}
          enableKeyboardShortcuts={true}
          showShortcutHints={!isMobile}
          filters={searchState.filters.filter(f => f.active)}
          size={isMobile ? 'md' : 'lg'}
          variant={variant === 'compact' ? 'minimal' : 'default'}
          className="w-full"
        />
      </div>

      {/* Toolbar */}
      {renderToolbar()}

      {/* Main Content */}
      {renderContent()}

      {/* Keyboard Shortcuts Help */}
      {shortcuts.length > 0 && !isMobile && (
        <div className="sr-only" aria-live="polite">
          Available shortcuts: {shortcuts.map(s => s.displayText).join(', ')}
        </div>
      )}
    </div>
  );
}));

SearchInterface.displayName = 'SearchInterface';

export default SearchInterface;