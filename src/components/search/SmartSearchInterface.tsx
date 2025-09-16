/**
 * Smart Search Interface Component
 *
 * Advanced search interface with:
 * - Real-time search suggestions and auto-complete
 * - Advanced filtering capabilities
 * - Search history and saved searches
 * - Performance monitoring and optimization
 * - Multiple search strategies (local, AI, hybrid)
 * - Accessibility compliance (WCAG 2.1 AA)
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo
} from 'react';
import { debounce } from 'lodash';
import { KnowledgeDB, SearchResult } from '../../database/KnowledgeDB';
import { KBCategory } from '../../types/services';
import { useKBData, SearchOptions } from '../../hooks/useKBData';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './SmartSearchInterface.css';

// ========================
// Types & Interfaces
// ========================

export interface SearchSuggestion {
  id: string;
  type: 'query' | 'category' | 'tag' | 'recent' | 'popular';
  text: string;
  description?: string;
  count?: number;
  icon?: string;
  score?: number;
}

export interface SearchFilter {
  id: string;
  type: 'category' | 'tag' | 'date' | 'usage' | 'status';
  label: string;
  value: any;
  active: boolean;
  count?: number;
}

export interface SearchStrategy {
  id: 'local' | 'ai' | 'hybrid';
  name: string;
  description: string;
  enabled: boolean;
  performance: {
    averageTime: number;
    accuracy: number;
    cost: number;
  };
}

export interface SmartSearchInterfaceProps {
  className?: string;
  /** Knowledge database instance */
  db: KnowledgeDB;
  /** Initial search query */
  initialQuery?: string;
  /** Initial filters */
  initialFilters?: SearchFilter[];
  /** Search configuration */
  config?: {
    enableAutoComplete: boolean;
    enableSuggestions: boolean;
    enableAISearch: boolean;
    enableSearchHistory: boolean;
    enableSavedSearches: boolean;
    suggestionLimit: number;
    debounceDelay: number;
    minQueryLength: number;
  };
  /** Performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Event handlers */
  onSearch?: (results: SearchResult[], query: string, options: SearchOptions) => void;
  onQueryChange?: (query: string) => void;
  onFiltersChange?: (filters: SearchFilter[]) => void;
  onStrategyChange?: (strategy: SearchStrategy) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  onSearchSave?: (name: string, query: string, filters: SearchFilter[]) => void;
  onSearchLoad?: (searchId: string) => void;
  /** Accessibility */
  ariaLabel?: string;
  announceResults?: boolean;
}

interface SearchState {
  query: string;
  filters: SearchFilter[];
  suggestions: SearchSuggestion[];
  searchHistory: string[];
  savedSearches: Array<{
    id: string;
    name: string;
    query: string;
    filters: SearchFilter[];
    created: Date;
    used: number;
  }>;
  activeStrategy: SearchStrategy['id'];
  isSearching: boolean;
  showSuggestions: boolean;
  showFilters: boolean;
  showHistory: boolean;
  selectedSuggestionIndex: number;
  lastSearchTime: number;
  searchCount: number;
}

// ========================
// Main Component
// ========================

export const SmartSearchInterface: React.FC<SmartSearchInterfaceProps> = memo(({
  className = '',
  db,
  initialQuery = '',
  initialFilters = [],
  config = {
    enableAutoComplete: true,
    enableSuggestions: true,
    enableAISearch: true,
    enableSearchHistory: true,
    enableSavedSearches: true,
    suggestionLimit: 10,
    debounceDelay: 300,
    minQueryLength: 2
  },
  enablePerformanceMonitoring = true,
  ariaLabel = 'Smart search interface',
  announceResults = true,
  onSearch,
  onQueryChange,
  onFiltersChange,
  onStrategyChange,
  onSuggestionSelect,
  onSearchSave,
  onSearchLoad
}) => {
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const performanceRef = useRef({
    searchTimes: [] as number[],
    lastQuery: '',
    totalSearches: 0
  });

  // State management
  const [state, setState] = useState<SearchState>({
    query: initialQuery,
    filters: [...initialFilters],
    suggestions: [],
    searchHistory: [],
    savedSearches: [],
    activeStrategy: 'hybrid',
    isSearching: false,
    showSuggestions: false,
    showFilters: false,
    showHistory: false,
    selectedSuggestionIndex: -1,
    lastSearchTime: 0,
    searchCount: 0
  });

  // Custom hooks
  const {
    searchEntries,
    getSuggestions,
    getRecentSearches,
    loading,
    error
  } = useKBData(db, {
    autoLoadEntries: false,
    cacheDuration: 2 * 60 * 1000 // 2 minutes cache for search results
  });

  const { recordMetric, getMetrics } = usePerformanceMonitoring(
    'SmartSearchInterface',
    { enabled: enablePerformanceMonitoring }
  );

  // Available search strategies
  const searchStrategies = useMemo<SearchStrategy[]>(() => [
    {
      id: 'local',
      name: 'Local Search',
      description: 'Fast local full-text search with fuzzy matching',
      enabled: true,
      performance: {
        averageTime: 50,
        accuracy: 75,
        cost: 0
      }
    },
    {
      id: 'ai',
      name: 'AI Search',
      description: 'Semantic search using AI for better understanding',
      enabled: config.enableAISearch,
      performance: {
        averageTime: 800,
        accuracy: 90,
        cost: 0.001
      }
    },
    {
      id: 'hybrid',
      name: 'Hybrid Search',
      description: 'Combines local and AI search for optimal results',
      enabled: config.enableAISearch,
      performance: {
        averageTime: 200,
        accuracy: 85,
        cost: 0.0005
      }
    }
  ], [config.enableAISearch]);

  // Update state helper
  const updateState = useCallback((updates: Partial<SearchState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Load search history and saved searches
  useEffect(() => {
    if (config.enableSearchHistory) {
      const loadHistory = async () => {
        try {
          const history = getRecentSearches();
          updateState({ searchHistory: history });
        } catch (error) {
          console.warn('Failed to load search history:', error);
        }
      };
      loadHistory();
    }
  }, [config.enableSearchHistory, getRecentSearches, updateState]);

  // Generate search suggestions
  const generateSuggestions = useCallback(async (query: string): Promise<SearchSuggestion[]> => {
    if (!query || query.length < config.minQueryLength) {
      return [];
    }

    const suggestions: SearchSuggestion[] = [];

    try {
      // Add auto-complete suggestions
      if (config.enableAutoComplete) {
        const autoComplete = await getSuggestions(query);
        autoComplete.slice(0, 5).forEach((suggestion, index) => {
          suggestions.push({
            id: `auto-${index}`,
            type: 'query',
            text: suggestion,
            icon: '🔍',
            score: 100 - (index * 10)
          });
        });
      }

      // Add category suggestions
      const categories: KBCategory[] = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'];
      categories.forEach(category => {
        if (category.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            id: `category-${category}`,
            type: 'category',
            text: `Search in ${category}`,
            description: `Filter by ${category} category`,
            icon: '📁',
            score: 80
          });
        }
      });

      // Add popular search suggestions
      const popularQueries = [
        'VSAM status 35',
        'S0C7 data exception',
        'JCL dataset not found',
        'DB2 SQLCODE -904',
        'Sort failed WER027A'
      ];

      popularQueries.forEach((popular, index) => {
        if (popular.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push({
            id: `popular-${index}`,
            type: 'popular',
            text: popular,
            description: 'Popular search',
            icon: '🔥',
            score: 70 - (index * 5)
          });
        }
      });

      // Add recent searches
      state.searchHistory.forEach((recent, index) => {
        if (recent.toLowerCase().includes(query.toLowerCase()) && recent !== query) {
          suggestions.push({
            id: `recent-${index}`,
            type: 'recent',
            text: recent,
            description: 'Recent search',
            icon: '🕒',
            score: 60 - (index * 3)
          });
        }
      });

      // Sort by score and limit
      return suggestions
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, config.suggestionLimit);

    } catch (error) {
      console.warn('Failed to generate suggestions:', error);
      return [];
    }
  }, [
    config.minQueryLength,
    config.enableAutoComplete,
    config.suggestionLimit,
    getSuggestions,
    state.searchHistory
  ]);

  // Debounced suggestion generation
  const debouncedSuggestions = useMemo(
    () => debounce(async (query: string) => {
      if (config.enableSuggestions) {
        const suggestions = await generateSuggestions(query);
        updateState({
          suggestions,
          showSuggestions: suggestions.length > 0
        });
      }
    }, config.debounceDelay),
    [config.enableSuggestions, config.debounceDelay, generateSuggestions, updateState]
  );

  // Perform search
  const performSearch = useCallback(async (
    query: string = state.query,
    filters: SearchFilter[] = state.filters,
    strategy: SearchStrategy['id'] = state.activeStrategy
  ): Promise<void> => {
    if (!query.trim() && filters.length === 0) {
      return;
    }

    const startTime = performance.now();
    updateState({ isSearching: true, showSuggestions: false });

    try {
      // Build search options
      const searchOptions: SearchOptions = {
        query: query.trim(),
        useAI: strategy === 'ai' || strategy === 'hybrid',
        limit: 50
      };

      // Apply filters
      filters.forEach(filter => {
        if (!filter.active) return;

        switch (filter.type) {
          case 'category':
            searchOptions.category = filter.value as KBCategory;
            break;
          case 'tag':
            searchOptions.tags = searchOptions.tags || [];
            searchOptions.tags.push(filter.value);
            break;
          // Add more filter types as needed
        }
      });

      // Record performance metric
      if (enablePerformanceMonitoring) {
        recordMetric('search_start', { query, strategy });
      }

      // Perform search
      const results = await searchEntries(searchOptions);
      const duration = performance.now() - startTime;

      // Update performance tracking
      performanceRef.current.searchTimes.push(duration);
      performanceRef.current.lastQuery = query;
      performanceRef.current.totalSearches++;

      // Keep only last 50 search times for rolling average
      if (performanceRef.current.searchTimes.length > 50) {
        performanceRef.current.searchTimes.shift();
      }

      // Update search history
      if (config.enableSearchHistory && query.trim()) {
        const newHistory = [
          query,
          ...state.searchHistory.filter(h => h !== query)
        ].slice(0, 20);

        updateState({
          searchHistory: newHistory,
          lastSearchTime: duration,
          searchCount: state.searchCount + 1
        });
      }

      // Record performance metric
      if (enablePerformanceMonitoring) {
        recordMetric('search_complete', {
          query,
          strategy,
          duration,
          resultCount: results.length
        });
      }

      // Announce results for accessibility
      if (announceResults) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Search completed. Found ${results.length} results for "${query}"`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }

      // Trigger callbacks
      onSearch?.(results, query, searchOptions);

      updateState({ isSearching: false });

    } catch (error) {
      console.error('Search failed:', error);
      updateState({ isSearching: false });

      if (enablePerformanceMonitoring) {
        recordMetric('search_error', { query, strategy, error: error.message });
      }

      // Announce error
      if (announceResults) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.textContent = `Search failed. Please try again.`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      }
    }
  }, [
    state.query,
    state.filters,
    state.activeStrategy,
    state.searchHistory,
    state.searchCount,
    config.enableSearchHistory,
    searchEntries,
    enablePerformanceMonitoring,
    announceResults,
    recordMetric,
    onSearch,
    updateState
  ]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce(performSearch, config.debounceDelay),
    [performSearch, config.debounceDelay]
  );

  // Handle query change
  const handleQueryChange = useCallback((newQuery: string) => {
    updateState({ query: newQuery });
    onQueryChange?.(newQuery);

    // Generate suggestions
    if (newQuery.length >= config.minQueryLength) {
      debouncedSuggestions(newQuery);
    } else {
      updateState({ suggestions: [], showSuggestions: false });
    }

    // Auto-search if enabled
    if (newQuery.length >= config.minQueryLength) {
      debouncedSearch();
    }
  }, [
    config.minQueryLength,
    debouncedSuggestions,
    debouncedSearch,
    updateState,
    onQueryChange
  ]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    updateState({
      query: suggestion.text,
      showSuggestions: false,
      selectedSuggestionIndex: -1
    });

    onSuggestionSelect?.(suggestion);

    // Perform search immediately
    performSearch(suggestion.text);
  }, [updateState, onSuggestionSelect, performSearch]);

  // Handle filter toggle
  const handleFilterToggle = useCallback((filterId: string) => {
    const newFilters = state.filters.map(filter =>
      filter.id === filterId
        ? { ...filter, active: !filter.active }
        : filter
    );

    updateState({ filters: newFilters });
    onFiltersChange?.(newFilters);

    // Re-search with new filters
    performSearch(state.query, newFilters);
  }, [state.filters, state.query, updateState, onFiltersChange, performSearch]);

  // Handle strategy change
  const handleStrategyChange = useCallback((strategyId: SearchStrategy['id']) => {
    const strategy = searchStrategies.find(s => s.id === strategyId);
    if (!strategy || !strategy.enabled) return;

    updateState({ activeStrategy: strategyId });
    onStrategyChange?.(strategy);

    // Re-search with new strategy
    performSearch(state.query, state.filters, strategyId);
  }, [searchStrategies, state.query, state.filters, updateState, onStrategyChange, performSearch]);

  // Keyboard navigation for suggestions
  useKeyboardNavigation({
    itemCount: state.suggestions.length,
    focusedIndex: state.selectedSuggestionIndex,
    onFocusChange: (index) => updateState({ selectedSuggestionIndex: index }),
    onSelect: (index) => {
      if (state.suggestions[index]) {
        handleSuggestionSelect(state.suggestions[index]);
      }
    },
    onEscape: () => updateState({ showSuggestions: false, selectedSuggestionIndex: -1 }),
    enabled: state.showSuggestions
  });

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (state.selectedSuggestionIndex >= 0 && state.suggestions[state.selectedSuggestionIndex]) {
          handleSuggestionSelect(state.suggestions[state.selectedSuggestionIndex]);
        } else {
          performSearch();
        }
        break;

      case 'Escape':
        updateState({
          showSuggestions: false,
          showFilters: false,
          showHistory: false,
          selectedSuggestionIndex: -1
        });
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (state.showSuggestions && state.suggestions.length > 0) {
          updateState({
            selectedSuggestionIndex: Math.min(
              state.selectedSuggestionIndex + 1,
              state.suggestions.length - 1
            )
          });
        } else {
          updateState({ showSuggestions: true });
          debouncedSuggestions(state.query);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (state.showSuggestions) {
          updateState({
            selectedSuggestionIndex: Math.max(state.selectedSuggestionIndex - 1, -1)
          });
        }
        break;
    }
  }, [
    state.selectedSuggestionIndex,
    state.suggestions,
    state.showSuggestions,
    state.query,
    handleSuggestionSelect,
    performSearch,
    updateState,
    debouncedSuggestions
  ]);

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    const times = performanceRef.current.searchTimes;
    return {
      averageTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      lastTime: performanceRef.current.searchTimes[performanceRef.current.searchTimes.length - 1] || 0,
      totalSearches: performanceRef.current.totalSearches
    };
  }, [state.searchCount]); // Re-compute when search count changes

  return (
    <div
      className={`smart-search-interface ${className}`}
      role="search"
      aria-label={ariaLabel}
    >
      {/* Main Search Bar */}
      <div className="search-bar-container">
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            type="text"
            value={state.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (state.suggestions.length > 0) {
                updateState({ showSuggestions: true });
              } else if (state.query.length >= config.minQueryLength) {
                debouncedSuggestions(state.query);
              }
            }}
            onBlur={(e) => {
              // Hide suggestions after a delay to allow clicks
              setTimeout(() => {
                if (!suggestionsRef.current?.contains(document.activeElement)) {
                  updateState({ showSuggestions: false, selectedSuggestionIndex: -1 });
                }
              }, 150);
            }}
            placeholder="Search knowledge base... (try 'VSAM status' or 'S0C7')"
            className="search-input"
            aria-label="Search query"
            aria-expanded={state.showSuggestions}
            aria-autocomplete="list"
            aria-controls={state.showSuggestions ? 'search-suggestions' : undefined}
            aria-activedescendant={
              state.selectedSuggestionIndex >= 0
                ? `suggestion-${state.selectedSuggestionIndex}`
                : undefined
            }
          />

          {/* Search Loading Indicator */}
          {state.isSearching && (
            <div className="search-loading" aria-label="Searching...">
              <div className="spinner" />
            </div>
          )}

          {/* Search Actions */}
          <div className="search-actions">
            <button
              onClick={() => performSearch()}
              disabled={state.isSearching}
              className="search-button"
              aria-label="Perform search"
              title="Search (Enter)"
            >
              🔍
            </button>

            <button
              onClick={() => updateState({ showFilters: !state.showFilters })}
              className={`filters-button ${state.showFilters ? 'active' : ''}`}
              aria-label="Toggle filters"
              aria-pressed={state.showFilters}
              title="Advanced filters"
            >
              🎛️
            </button>

            <button
              onClick={() => updateState({ showHistory: !state.showHistory })}
              className={`history-button ${state.showHistory ? 'active' : ''}`}
              aria-label="Toggle search history"
              aria-pressed={state.showHistory}
              title="Search history"
              disabled={!config.enableSearchHistory}
            >
              🕒
            </button>
          </div>
        </div>

        {/* Search Suggestions */}
        {state.showSuggestions && state.suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            id="search-suggestions"
            className="search-suggestions"
            role="listbox"
            aria-label="Search suggestions"
          >
            {state.suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                id={`suggestion-${index}`}
                className={`suggestion-item ${index === state.selectedSuggestionIndex ? 'selected' : ''}`}
                role="option"
                aria-selected={index === state.selectedSuggestionIndex}
                onClick={() => handleSuggestionSelect(suggestion)}
                onMouseEnter={() => updateState({ selectedSuggestionIndex: index })}
              >
                <div className="suggestion-icon">
                  {suggestion.icon}
                </div>
                <div className="suggestion-content">
                  <div className="suggestion-text">
                    {suggestion.text}
                  </div>
                  {suggestion.description && (
                    <div className="suggestion-description">
                      {suggestion.description}
                    </div>
                  )}
                </div>
                {suggestion.count && (
                  <div className="suggestion-count">
                    {suggestion.count}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {state.showFilters && (
        <div
          ref={filtersRef}
          className="filters-panel"
          role="region"
          aria-label="Advanced search filters"
        >
          <div className="filters-header">
            <h3>Filters</h3>
            <button
              onClick={() => updateState({ showFilters: false })}
              className="close-filters"
              aria-label="Close filters"
            >
              ✕
            </button>
          </div>

          <div className="filters-content">
            {/* Category Filters */}
            <div className="filter-section">
              <h4>Categories</h4>
              <div className="filter-options">
                {['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'].map(category => (
                  <label key={category} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={state.filters.some(f => f.type === 'category' && f.value === category && f.active)}
                      onChange={() => {
                        const existingFilter = state.filters.find(f => f.type === 'category' && f.value === category);
                        if (existingFilter) {
                          handleFilterToggle(existingFilter.id);
                        } else {
                          const newFilter: SearchFilter = {
                            id: `category-${category}`,
                            type: 'category',
                            label: category,
                            value: category,
                            active: true
                          };
                          const newFilters = [...state.filters, newFilter];
                          updateState({ filters: newFilters });
                          onFiltersChange?.(newFilters);
                          performSearch(state.query, newFilters);
                        }
                      }}
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>

            {/* Search Strategy */}
            <div className="filter-section">
              <h4>Search Strategy</h4>
              <div className="strategy-options">
                {searchStrategies.filter(s => s.enabled).map(strategy => (
                  <label key={strategy.id} className="strategy-radio">
                    <input
                      type="radio"
                      name="search-strategy"
                      checked={state.activeStrategy === strategy.id}
                      onChange={() => handleStrategyChange(strategy.id)}
                    />
                    <div className="strategy-info">
                      <div className="strategy-name">{strategy.name}</div>
                      <div className="strategy-description">{strategy.description}</div>
                      <div className="strategy-performance">
                        Speed: ~{strategy.performance.averageTime}ms |
                        Accuracy: {strategy.performance.accuracy}%
                        {strategy.performance.cost > 0 && ` | Cost: $${strategy.performance.cost}`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search History Panel */}
      {state.showHistory && config.enableSearchHistory && (
        <div className="history-panel" role="region" aria-label="Search history">
          <div className="history-header">
            <h3>Recent Searches</h3>
            <button
              onClick={() => updateState({ showHistory: false })}
              className="close-history"
              aria-label="Close history"
            >
              ✕
            </button>
          </div>

          <div className="history-content">
            {state.searchHistory.length === 0 ? (
              <p className="history-empty">No recent searches</p>
            ) : (
              <ul className="history-list">
                {state.searchHistory.map((query, index) => (
                  <li key={index} className="history-item">
                    <button
                      onClick={() => {
                        updateState({ query, showHistory: false });
                        performSearch(query);
                      }}
                      className="history-query"
                    >
                      {query}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Performance Display */}
      {enablePerformanceMonitoring && (
        <div className="search-performance" role="status" aria-live="polite">
          <div className="performance-stats">
            <span className="stat">
              Last: {performanceMetrics.lastTime.toFixed(0)}ms
            </span>
            <span className="stat">
              Avg: {performanceMetrics.averageTime.toFixed(0)}ms
            </span>
            <span className="stat">
              Total: {performanceMetrics.totalSearches}
            </span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error.search && (
        <div className="search-error" role="alert">
          <p>Search error: {error.search.message}</p>
          <button
            onClick={() => performSearch()}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

SmartSearchInterface.displayName = 'SmartSearchInterface';

export default SmartSearchInterface;