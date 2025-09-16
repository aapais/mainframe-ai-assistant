import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { SearchService } from '../../../services/SearchService';
import { SearchOptions, SearchResult, KBEntry, SearchQuery, PopularSearch } from '../../../types/services';
import { SearchAutocomplete } from './SearchAutocomplete';
import { SearchResultsVirtualized } from './SearchResultsVirtualized';
import { SearchFilters } from './SearchFilters';
import { PerformanceIndicator } from './PerformanceIndicator';
import { SearchHistory } from './SearchHistory';
import { SearchAnalytics } from './SearchAnalytics';
import { QueryBuilder } from './QueryBuilder';
import { debounce } from 'lodash';
import './SearchInterface.css';

interface SearchInterfaceProps {
  entries: KBEntry[];
  onEntrySelect?: (entry: KBEntry) => void;
  onEntryRate?: (entryId: string, successful: boolean) => void;
  showAnalytics?: boolean;
  maxResults?: number;
  defaultOptions?: Partial<SearchOptions>;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  lastSearchTime: number;
  totalResults: number;
  searchOptions: SearchOptions;
  recentSearches: SearchQuery[];
  popularSearches: PopularSearch[];
  suggestions: string[];
  showAdvanced: boolean;
  activeFilters: number;
  autocompleteOpen: boolean;
  realTimeMetrics: {
    cacheHitRate: number;
    averageSearchTime: number;
    p95SearchTime: number;
    queryOptimizationCacheSize: number;
    recentPerformance: Array<{ operation: string; avg: number; p95: number }>;
  } | null;
  hasMore: boolean;
  isLoadingMore: boolean;
}

/**
 * Main Search Interface Component
 * 
 * Features:
 * - High-performance search with <1s response time
 * - Real-time performance monitoring
 * - Advanced filtering and sorting
 * - Search history and suggestions
 * - Responsive design with accessibility
 * - AI-enhanced semantic search with fallback
 */
export const SearchInterface = memo<SearchInterfaceProps>(({
  entries,
  onEntrySelect,
  onEntryRate,
  showAnalytics = false,
  maxResults = 50,
  defaultOptions = {}
}) => {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    isLoading: false,
    lastSearchTime: 0,
    totalResults: 0,
    searchOptions: {
      limit: maxResults,
      includeHighlights: true,
      useAI: true,
      threshold: 0.1,
      sortBy: 'relevance',
      sortOrder: 'desc',
      ...defaultOptions
    },
    recentSearches: [],
    popularSearches: [],
    suggestions: [],
    showAdvanced: false,
    activeFilters: 0,
    autocompleteOpen: false,
    realTimeMetrics: null,
    hasMore: false,
    isLoadingMore: false
  });

  const searchServiceRef = useRef<SearchService>();
  const abortControllerRef = useRef<AbortController>();
  const metricsIntervalRef = useRef<NodeJS.Timeout>();
  const performanceBuffer = useRef<Array<{ timestamp: number; duration: number; operation: string }>>([]);

  // Initialize search service and real-time metrics
  useEffect(() => {
    const initializeSearchService = async () => {
      try {
        // Get Gemini config from settings
        const geminiConfig = await window.electronAPI?.getGeminiConfig?.();
        searchServiceRef.current = new SearchService(geminiConfig);

        // Build search index for better performance
        await searchServiceRef.current.buildIndex(entries);

        // Load search history
        await loadSearchData();

        // Start real-time metrics collection
        startMetricsCollection();
      } catch (error) {
        console.error('Failed to initialize search service:', error);
      }
    };

    initializeSearchService();

    // Cleanup on unmount
    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [entries]);

  // Load search history and popular searches
  const loadSearchData = useCallback(async () => {
    if (!searchServiceRef.current) return;

    try {
      const [recentSearches, popularSearches] = await Promise.all([
        searchServiceRef.current.getRecentSearches(20),
        searchServiceRef.current.getPopularSearches(10)
      ]);

      setState(prev => ({
        ...prev,
        recentSearches,
        popularSearches
      }));
    } catch (error) {
      console.error('Failed to load search data:', error);
    }
  }, []);

  // Start real-time metrics collection
  const startMetricsCollection = useCallback(() => {
    metricsIntervalRef.current = setInterval(async () => {
      if (!searchServiceRef.current) return;

      try {
        const metrics = await searchServiceRef.current.getMetrics?.();
        if (metrics) {
          setState(prev => ({
            ...prev,
            realTimeMetrics: {
              cacheHitRate: metrics.cacheStats?.hitRate || 0,
              averageSearchTime: metrics.performance?.averageSearchTime || 0,
              p95SearchTime: metrics.performance?.p95SearchTime || 0,
              queryOptimizationCacheSize: metrics.queryOptimizationCacheSize || 0,
              recentPerformance: performanceBuffer.current
                .slice(-10)
                .reduce((acc, entry) => {
                  const existing = acc.find(a => a.operation === entry.operation);
                  if (existing) {
                    existing.avg = (existing.avg + entry.duration) / 2;
                    existing.p95 = Math.max(existing.p95, entry.duration);
                  } else {
                    acc.push({ operation: entry.operation, avg: entry.duration, p95: entry.duration });
                  }
                  return acc;
                }, [] as Array<{ operation: string; avg: number; p95: number }>)
            }
          }));
        }
      } catch (error) {
        console.error('Failed to collect metrics:', error);
      }
    }, 30000); // Update every 30 seconds
  }, []);

  // Debounced search function with performance tracking
  const debouncedSearch = useCallback(
    debounce(async (query: string, options: SearchOptions) => {
      if (!searchServiceRef.current || !query.trim()) {
        setState(prev => ({
          ...prev,
          results: [],
          isLoading: false,
          hasMore: false
        }));
        return;
      }

      // Cancel previous search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState(prev => ({ ...prev, isLoading: true }));

      try {
        const startTime = performance.now();

        const results = await searchServiceRef.current.search(query, entries, {
          ...options,
          userId: 'current-user', // TODO: Get from auth context
          sessionId: crypto.randomUUID()
        });

        const searchTime = performance.now() - startTime;

        // Record performance for metrics
        performanceBuffer.current.push({
          timestamp: Date.now(),
          duration: searchTime,
          operation: 'search'
        });

        // Keep only last 100 entries
        if (performanceBuffer.current.length > 100) {
          performanceBuffer.current = performanceBuffer.current.slice(-100);
        }

        setState(prev => ({
          ...prev,
          results,
          isLoading: false,
          lastSearchTime: searchTime,
          totalResults: results.length,
          hasMore: results.length >= (options.limit || maxResults)
        }));

        // Update search history
        await loadSearchData();

      } catch (error) {
        console.error('Search failed:', error);
        setState(prev => ({
          ...prev,
          results: [],
          isLoading: false,
          lastSearchTime: 0,
          hasMore: false
        }));
      }
    }, 300),
    [entries, maxResults]
  );

  // Fast autocomplete search (150ms debounce)
  const debouncedAutocompleteSearch = useCallback(
    debounce(async (query: string) => {
      if (!searchServiceRef.current || query.length < 2) {
        setState(prev => ({ ...prev, suggestions: [] }));
        return;
      }

      try {
        const startTime = performance.now();
        const suggestions = await searchServiceRef.current.suggest(query, 8);
        const autocompleteTime = performance.now() - startTime;

        // Record autocomplete performance
        performanceBuffer.current.push({
          timestamp: Date.now(),
          duration: autocompleteTime,
          operation: 'autocomplete'
        });

        setState(prev => ({ ...prev, suggestions }));
      } catch (error) {
        console.error('Autocomplete failed:', error);
        setState(prev => ({ ...prev, suggestions: [] }));
      }
    }, 150),
    []
  );

  // Handle search input with autocomplete
  const handleSearch = useCallback((query: string, useAI: boolean = true, immediate: boolean = false) => {
    const options = {
      ...state.searchOptions,
      useAI
    };

    setState(prev => ({
      ...prev,
      query,
      searchOptions: options,
      autocompleteOpen: false
    }));

    if (immediate) {
      // For selected suggestions, search immediately
      debouncedSearch.cancel();
      debouncedSearch(query, options);
    } else {
      debouncedSearch(query, options);
    }
  }, [state.searchOptions, debouncedSearch]);

  // Handle autocomplete input
  const handleAutocompleteInput = useCallback((query: string) => {
    setState(prev => ({
      ...prev,
      query,
      autocompleteOpen: query.length >= 2
    }));

    if (query.length >= 2) {
      debouncedAutocompleteSearch(query);
    } else {
      setState(prev => ({ ...prev, suggestions: [] }));
    }
  }, [debouncedAutocompleteSearch]);

  // Handle filter changes
  const handleFiltersChange = useCallback((filters: Partial<SearchOptions>) => {
    const newOptions = { ...state.searchOptions, ...filters };
    const activeFilters = Object.values(filters).filter(v => v !== undefined && v !== null).length;

    setState(prev => ({
      ...prev,
      searchOptions: newOptions,
      activeFilters
    }));

    // Re-run search with new filters if there's a query
    if (state.query.trim()) {
      debouncedSearch(state.query, newOptions);
    }
  }, [state.searchOptions, state.query, debouncedSearch]);

  // Handle sort change
  const handleSortChange = useCallback((sortBy: SearchOptions['sortBy'], sortOrder: SearchOptions['sortOrder'] = 'desc') => {
    handleFiltersChange({ sortBy, sortOrder });
  }, [handleFiltersChange]);

  // Handle entry selection
  const handleEntrySelect = useCallback((result: SearchResult) => {
    onEntrySelect?.(result.entry);
    
    // Record view usage
    if (searchServiceRef.current) {
      // Note: In real implementation, this would be handled by the backend
      console.log('Entry selected:', result.entry.id);
    }
  }, [onEntrySelect]);

  // Handle entry rating
  const handleEntryRate = useCallback(async (entryId: string, successful: boolean) => {
    try {
      onEntryRate?.(entryId, successful);
      
      // Update results with new rating
      setState(prev => ({
        ...prev,
        results: prev.results.map(result => 
          result.entry.id === entryId
            ? {
                ...result,
                entry: {
                  ...result.entry,
                  usage_count: result.entry.usage_count + 1,
                  success_count: successful 
                    ? result.entry.success_count + 1 
                    : result.entry.success_count,
                  failure_count: !successful 
                    ? result.entry.failure_count + 1 
                    : result.entry.failure_count
                }
              }
            : result
        )
      }));
    } catch (error) {
      console.error('Failed to rate entry:', error);
    }
  }, [onEntryRate]);

  // Handle load more results
  const handleLoadMore = useCallback(async () => {
    if (!searchServiceRef.current || state.isLoadingMore || !state.hasMore) return;

    setState(prev => ({ ...prev, isLoadingMore: true }));

    try {
      const newOptions = {
        ...state.searchOptions,
        offset: state.results.length,
        limit: 25 // Load smaller chunks for better UX
      };

      const newResults = await searchServiceRef.current.search(state.query, entries, {
        ...newOptions,
        userId: 'current-user',
        sessionId: crypto.randomUUID()
      });

      setState(prev => ({
        ...prev,
        results: [...prev.results, ...newResults],
        isLoadingMore: false,
        hasMore: newResults.length >= 25,
        totalResults: prev.totalResults + newResults.length
      }));
    } catch (error) {
      console.error('Failed to load more results:', error);
      setState(prev => ({ ...prev, isLoadingMore: false }));
    }
  }, [state.searchOptions, state.results.length, state.query, state.isLoadingMore, state.hasMore, entries]);

  // Handle autocomplete close
  const handleAutocompleteClose = useCallback(() => {
    setState(prev => ({ ...prev, autocompleteOpen: false }));
  }, []);

  // Handle suggestion select
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    handleSearch(suggestion, true, true); // Immediate search
  }, [handleSearch]);

  // Handle advanced search toggle
  const toggleAdvancedSearch = useCallback(() => {
    setState(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }));
  }, []);

  // Handle query builder
  const handleQueryBuilderSubmit = useCallback((builtQuery: string, options: SearchOptions) => {
    setState(prev => ({
      ...prev,
      query: builtQuery,
      searchOptions: { ...prev.searchOptions, ...options },
      showAdvanced: false
    }));

    debouncedSearch(builtQuery, { ...state.searchOptions, ...options });
  }, [state.searchOptions, debouncedSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
      debouncedSearch.cancel();
      debouncedAutocompleteSearch.cancel();
    };
  }, [debouncedSearch, debouncedAutocompleteSearch]);

  return (
    <div className="search-interface" role="main" aria-label="Knowledge base search">
      <div className="search-interface__header">
        <div className="search-interface__main-search">
          <SearchAutocomplete
            value={state.query}
            onInput={handleAutocompleteInput}
            onSearch={handleSearch}
            onSuggestionSelect={handleSuggestionSelect}
            onClose={handleAutocompleteClose}
            suggestions={state.suggestions}
            isOpen={state.autocompleteOpen}
            loading={state.isLoading}
            autoFocus
            maxLength={500}
            showAIToggle
            placeholder="Search knowledge base... (e.g., 'VSAM Status 35', 'S0C7 abend', 'JCL error')"
            entries={entries}
            recentSearches={state.recentSearches.map(s => s.query)}
          />
          
          <div className="search-interface__controls">
            <button
              className={`btn btn--secondary ${state.showAdvanced ? 'active' : ''}`}
              onClick={toggleAdvancedSearch}
              aria-pressed={state.showAdvanced}
              aria-label="Toggle advanced search"
            >
              <span className="icon">⚙️</span>
              Advanced
              {state.activeFilters > 0 && (
                <span className="badge">{state.activeFilters}</span>
              )}
            </button>
            
            <PerformanceIndicator
              searchTime={state.lastSearchTime}
              resultCount={state.totalResults}
              isLoading={state.isLoading}
              cacheHit={state.results.some(r => r.metadata?.source === 'cache')}
              realTimeMetrics={state.realTimeMetrics}
            />
          </div>
        </div>

        {state.showAdvanced && (
          <div className="search-interface__advanced">
            <QueryBuilder
              onSubmit={handleQueryBuilderSubmit}
              initialQuery={state.query}
              initialOptions={state.searchOptions}
            />
          </div>
        )}

        <div className="search-interface__filters">
          <SearchFilters
            options={state.searchOptions}
            onChange={handleFiltersChange}
            entries={entries}
            resultCount={state.totalResults}
          />
        </div>
      </div>

      <div className="search-interface__content">
        <div className="search-interface__main">
          <div className="search-interface__results">
            <SearchResultsVirtualized
              results={state.results}
              query={state.query}
              isLoading={state.isLoading}
              isLoadingMore={state.isLoadingMore}
              hasMore={state.hasMore}
              onEntrySelect={handleEntrySelect}
              onEntryRate={handleEntryRate}
              onSortChange={handleSortChange}
              onLoadMore={handleLoadMore}
              sortBy={state.searchOptions.sortBy}
              sortOrder={state.searchOptions.sortOrder}
              highlightQuery
              showExplanations
              showMetadata
              height={600}
              itemHeight={150}
              overscan={5}
            />
          </div>
        </div>

        <div className="search-interface__sidebar">
          <SearchHistory
            recentSearches={state.recentSearches}
            popularSearches={state.popularSearches}
            onSearchSelect={handleSearch}
            maxItems={10}
          />

          {showAnalytics && (
            <SearchAnalytics
              searchHistory={state.recentSearches}
              realTimeMetrics={state.realTimeMetrics}
              className="search-interface__analytics"
            />
          )}
        </div>
      </div>
    </div>
  );
});

SearchInterface.displayName = 'SearchInterface';

export default SearchInterface;