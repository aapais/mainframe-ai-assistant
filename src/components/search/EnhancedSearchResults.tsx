/**
 * Enhanced SearchResults Component with Full Service Integration
 *
 * This component integrates with:
 * - SearchService for real-time search
 * - Redux/Zustand state management
 * - Caching layers for performance
 * - Monitoring and analytics services
 * - WebSocket for real-time updates
 * - Export functionality
 * - Pagination and infinite scroll
 *
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useImperativeHandle,
  forwardRef
} from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  SearchResult,
  SearchOptions,
  ExportFormat
} from '../../types/services';
import { useReactiveStore } from '../../renderer/stores/reactive-state';
import { useSearch } from '../../renderer/contexts/SearchContext';
import { SearchResultsIntegrationAdapter, useSearchResultsIntegration } from '../../services/SearchResultsIntegrationAdapter';
import './SearchResults.css';

// ========================
// Types & Interfaces
// ========================

export interface EnhancedSearchResultsProps {
  /** Search query for highlighting */
  searchQuery?: string;
  /** Initial search options */
  initialOptions?: SearchOptions;
  /** Whether to show confidence scores */
  showConfidenceScores?: boolean;
  /** Whether to enable real-time updates */
  enableRealTimeUpdates?: boolean;
  /** Whether to enable infinite scroll */
  enableInfiniteScroll?: boolean;
  /** Whether to show export options */
  showExportOptions?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when result is selected */
  onResultSelect?: (result: SearchResult, index: number) => void;
  /** Callback when search is performed */
  onSearch?: (query: string, options: SearchOptions) => void;
  /** Callback when results are exported */
  onExport?: (format: ExportFormat, blob: Blob | string) => void;
  /** WebSocket URL for real-time updates */
  websocketUrl?: string;
  /** Page size for pagination */
  pageSize?: number;
}

export interface SearchResultsHandle {
  performSearch: (query: string, options?: SearchOptions) => Promise<void>;
  exportResults: (format: ExportFormat) => Promise<void>;
  clearResults: () => void;
  refreshResults: () => Promise<void>;
  getSelectedResults: () => SearchResult[];
  selectAll: () => void;
  clearSelection: () => void;
}

interface VirtualizedItemProps {
  index: number;
  style: React.CSSProperties;
}

// ========================
// Enhanced SearchResults Component
// ========================

export const EnhancedSearchResults = forwardRef<SearchResultsHandle, EnhancedSearchResultsProps>(({
  searchQuery = '',
  initialOptions = {},
  showConfidenceScores = true,
  enableRealTimeUpdates = false,
  enableInfiniteScroll = true,
  showExportOptions = true,
  className = '',
  onResultSelect,
  onSearch,
  onExport,
  websocketUrl,
  pageSize = 50
}, ref) => {
  // State management integration
  const reactiveStore = useReactiveStore();
  const searchContext = useSearch();
  const integration = useSearchResultsIntegration(websocketUrl);

  // Local state
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [virtualizedResults, setVirtualizedResults] = useState<SearchResult[]>([]);

  // Refs
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreTimeoutRef = useRef<NodeJS.Timeout>();

  // Get integration state
  const integrationState = integration.getSearchState();

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: virtualizedResults.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 200, // Estimated item height
    overscan: 5
  });

  // ========================
  // Effects and Initialization
  // ========================

  // Initialize integration
  useEffect(() => {
    integration.enableRealTimeUpdates(enableRealTimeUpdates);

    // Subscribe to real-time updates
    const unsubscribe = integration.subscribeToUpdates((results) => {
      setVirtualizedResults(results);
    });

    return unsubscribe;
  }, [integration, enableRealTimeUpdates]);

  // Update results when integration state changes
  useEffect(() => {
    setVirtualizedResults(integrationState.results);
  }, [integrationState.results]);

  // Perform initial search if query provided
  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      performSearch(searchQuery, initialOptions);
    }
  }, [searchQuery, initialOptions]);

  // ========================
  // Search Operations
  // ========================

  const performSearch = useCallback(async (
    query: string,
    options: SearchOptions = {}
  ) => {
    try {
      const finalOptions = {
        ...initialOptions,
        ...options,
        limit: pageSize
      };

      const results = await integration.performSearch(query, finalOptions);
      setSelectedResults(new Set()); // Clear selection on new search

      onSearch?.(query, finalOptions);

      // Track in search context
      searchContext.setQuery(query);

    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [integration, initialOptions, pageSize, onSearch, searchContext]);

  const loadMoreResults = useCallback(async () => {
    if (!enableInfiniteScroll || integrationState.loading || !integrationState.hasMore) {
      return;
    }

    try {
      const offset = virtualizedResults.length;
      await integration.loadMoreResults(integrationState.query, offset, pageSize);

    } catch (error) {
      console.error('Failed to load more results:', error);
    }
  }, [
    integration,
    enableInfiniteScroll,
    integrationState.loading,
    integrationState.hasMore,
    integrationState.query,
    virtualizedResults.length,
    pageSize
  ]);

  // ========================
  // Export Functionality
  // ========================

  const exportResults = useCallback(async (format: ExportFormat) => {
    if (virtualizedResults.length === 0) return;

    setIsExporting(true);

    try {
      const resultsToExport = selectedResults.size > 0
        ? virtualizedResults.filter(result => selectedResults.has(result.entry.id))
        : virtualizedResults;

      const exported = await integration.exportResults(resultsToExport, format);

      // Create download link
      const url = URL.createObjectURL(exported as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `search-results-${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onExport?.(format, exported);

      // Track analytics
      integration.trackSearchEvent({
        type: 'export',
        metadata: {
          format,
          resultCount: resultsToExport.length,
          hasSelection: selectedResults.size > 0
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [integration, virtualizedResults, selectedResults, onExport]);

  // ========================
  // Selection Management
  // ========================

  const handleResultSelect = useCallback((result: SearchResult, index: number) => {
    // Track selection
    integration.trackSearchEvent({
      type: 'select',
      resultId: result.entry.id,
      metadata: {
        index,
        score: result.score
      },
      timestamp: Date.now()
    });

    onResultSelect?.(result, index);
  }, [integration, onResultSelect]);

  const toggleResultSelection = useCallback((resultId: string) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedResults(new Set(virtualizedResults.map(result => result.entry.id)));
  }, [virtualizedResults]);

  const clearSelection = useCallback(() => {
    setSelectedResults(new Set());
  }, []);

  // ========================
  // Infinite Scroll Implementation
  // ========================

  const isItemLoaded = useCallback((index: number) => {
    return index < virtualizedResults.length;
  }, [virtualizedResults.length]);

  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (loadMoreTimeoutRef.current) {
      clearTimeout(loadMoreTimeoutRef.current);
    }

    loadMoreTimeoutRef.current = setTimeout(loadMoreResults, 100);
  }, [loadMoreResults]);

  // ========================
  // Imperative Handle
  // ========================

  useImperativeHandle(ref, () => ({
    performSearch,
    exportResults,
    clearResults: () => {
      integration.updateSearchState({
        results: [],
        totalResults: 0,
        query: ''
      });
      setVirtualizedResults([]);
      setSelectedResults(new Set());
    },
    refreshResults: () => {
      if (integrationState.query) {
        return performSearch(integrationState.query, { force: true });
      }
      return Promise.resolve();
    },
    getSelectedResults: () => {
      return virtualizedResults.filter(result => selectedResults.has(result.entry.id));
    },
    selectAll,
    clearSelection
  }), [
    performSearch,
    exportResults,
    integration,
    integrationState.query,
    virtualizedResults,
    selectedResults,
    selectAll,
    clearSelection
  ]);

  // ========================
  // Render Helpers
  // ========================

  const renderVirtualizedItem = useCallback(({ index, style }: VirtualizedItemProps) => {
    const result = virtualizedResults[index];
    if (!result) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          <div className="animate-pulse bg-gray-200 rounded h-32 w-full" />
        </div>
      );
    }

    const isSelected = selectedResults.has(result.entry.id);

    return (
      <div
        style={style}
        className={`search-result-item card card-sm transition-all duration-200 hover:shadow-md ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
        } cursor-pointer border-b border-gray-200`}
        onClick={() => handleResultSelect(result, index)}
      >
        <div className="flex items-start gap-4">
          {/* Selection checkbox */}
          <label className="relative flex items-center mt-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleResultSelection(result.entry.id)}
              onClick={(e) => e.stopPropagation()}
              className="sr-only"
            />
            <div className={`w-4 h-4 border-2 rounded-sm transition-all duration-200 ${
              isSelected
                ? 'bg-blue-600 border-blue-600'
                : 'border-gray-300 hover:border-blue-400'
            } flex items-center justify-center`}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </label>

          {/* Content */}
          <div className="flex-grow">
            <div className="flex-1 min-w-0">
              <h3 className="heading-4 text-gray-900 mb-2 line-clamp-1">
                {result.entry.title}
              </h3>

              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Problem</h4>
                <p className="body-small text-gray-600 line-clamp-2">
                  {result.entry.problem}
                </p>
              </div>

              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Solution</h4>
                <p className="body-small text-gray-700 line-clamp-3">
                  {result.entry.solution}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="badge badge-secondary text-xs">
                    {result.entry.category}
                  </span>
                  {result.entry.tags.length > 0 && (
                    <div className="flex gap-1">
                      {result.entry.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="badge badge-sm badge-primary text-xs">
                          {tag}
                        </span>
                      ))}
                      {result.entry.tags.length > 2 && (
                        <span className="text-xs text-gray-400">+{result.entry.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>

                {showConfidenceScores && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {Math.round(result.score)}% confidence
                    </span>
                    <div className="progress-bar w-12 h-2" title={`${Math.round(result.score)}% confidence`}>
                      <div
                        className="progress-fill bg-gradient-to-r from-blue-500 to-blue-600"
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    virtualizedResults,
    selectedResults,
    handleResultSelect,
    toggleResultSelection,
    showConfidenceScores
  ]);

  const renderExportOptions = () => {
    if (!showExportOptions || virtualizedResults.length === 0) {
      return null;
    }

    return (
      <div className="flex items-center gap-2">
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="pdf">PDF</option>
          <option value="markdown">Markdown</option>
        </select>

        <button
          onClick={() => exportResults(exportFormat)}
          disabled={isExporting}
          className="btn btn-success btn-sm"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    );
  };

  const renderSelectionActions = () => {
    if (virtualizedResults.length === 0) return null;

    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">
          {selectedResults.size} of {virtualizedResults.length} selected
        </span>

        <button
          onClick={selectAll}
          className="text-blue-600 hover:text-blue-800"
        >
          Select All
        </button>

        {selectedResults.size > 0 && (
          <button
            onClick={clearSelection}
            className="text-red-600 hover:text-red-800"
          >
            Clear Selection
          </button>
        )}
      </div>
    );
  };

  // ========================
  // Main Render
  // ========================

  if (integrationState.loading && virtualizedResults.length === 0) {
    return (
      <div className={`search-results-loading card p-8 text-center ${className}`}>
        <div className="spinner-lg mb-4" />
        <p className="body-text text-gray-600">Searching knowledge base...</p>
        <div className="mt-4 space-y-2">
          {/* Skeleton loading animation */}
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (integrationState.error) {
    return (
      <div className={`search-results-error card p-8 text-center ${className}`}>
        <div className="text-6xl mb-4" role="img" aria-label="Error">⚠️</div>
        <h3 className="heading-3 text-red-700 mb-2">Search Error</h3>
        <p className="body-text text-gray-600 mb-4">{integrationState.error}</p>

        <button
          onClick={() => performSearch(integrationState.query, { force: true })}
          className="btn btn-primary"
        >
          Retry Search
        </button>
      </div>
    );
  }

  if (virtualizedResults.length === 0 && integrationState.query) {
    return (
      <div className={`search-results-empty card p-8 text-center ${className}`}>
        <div className="text-6xl mb-4" role="img" aria-label="No results">🔍</div>
        <h3 className="heading-3 text-gray-600 mb-2">No results found</h3>
        <p className="body-small text-gray-500">
          Try adjusting your search query or using different keywords.
        </p>
      </div>
    );
  }

  return (
    <div className={`enhanced-search-results ${className}`}>
      {/* Header with controls */}
      <div className="search-results-header card-header p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="heading-2">
              Search Results
            </h2>
            <p className="body-small text-gray-600">
              Found {integrationState.totalResults} result{integrationState.totalResults !== 1 ? 's' : ''}
              {integrationState.query && (
                <span className="ml-1">
                  for <span className="font-medium">"{integrationState.query}"</span>
                </span>
              )}
            </p>
          </div>

          {renderExportOptions()}
        </div>

        <div className="flex items-center justify-between">
          {renderSelectionActions()}

          {/* Real-time indicator */}
          {enableRealTimeUpdates && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live Updates
            </div>
          )}
        </div>
      </div>

      {/* Virtualized results list */}
      <div
        ref={containerRef}
        className="search-results-container"
        style={{ height: '600px', overflow: 'auto' }}
      >
        {enableInfiniteScroll ? (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={integrationState.hasMore ? virtualizedResults.length + 1 : virtualizedResults.length}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref: infiniteRef }) => (
              <List
                ref={(list) => {
                  listRef.current = list;
                  infiniteRef(list);
                }}
                height={600}
                itemCount={virtualizedResults.length}
                itemSize={200}
                onItemsRendered={onItemsRendered}
              >
                {renderVirtualizedItem}
              </List>
            )}
          </InfiniteLoader>
        ) : (
          <List
            ref={listRef}
            height={600}
            itemCount={virtualizedResults.length}
            itemSize={200}
          >
            {renderVirtualizedItem}
          </List>
        )}
      </div>

      {/* Loading indicator for infinite scroll */}
      {integrationState.loading && virtualizedResults.length > 0 && (
        <div className="p-4 text-center border-t">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
          Loading more results...
        </div>
      )}

      {/* Metrics footer */}
      <div className="search-results-footer p-2 border-t bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <div>
            Response time: {integration.getSearchMetrics().averageResponseTime.toFixed(0)}ms
          </div>
          <div>
            Cache hit rate: {(integration.getSearchMetrics().cacheHitRate * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
});

EnhancedSearchResults.displayName = 'EnhancedSearchResults';

export default EnhancedSearchResults;