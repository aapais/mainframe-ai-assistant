/**
 * Smart Search Hook
 *
 * Comprehensive search hook with:
 * - Multi-strategy search (local, AI, hybrid)
 * - Real-time suggestions and auto-complete
 * - Search history and saved searches
 * - Advanced filtering and faceting
 * - Performance optimization
 * - Context-aware search
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { debounce } from 'lodash';

// ========================
// Types & Interfaces
// ========================

export interface SearchResult<T = any> {
  item: T;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'ai' | 'hybrid';
  highlights: SearchHighlight[];
  relevance: number;
  metadata?: Record<string, any>;
}

export interface SearchHighlight {
  field: string;
  fragment: string;
  start: number;
  end: number;
  type: 'exact' | 'fuzzy' | 'semantic';
}

export interface SearchQuery {
  text: string;
  filters: SearchFilter[];
  sort?: SearchSort;
  facets?: string[];
  options?: SearchOptions;
}

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'range' | 'in' | 'not';
  value: any;
  values?: any[];
}

export interface SearchSort {
  field: string;
  direction: 'asc' | 'desc';
  type?: 'string' | 'number' | 'date' | 'relevance';
}

export interface SearchOptions {
  enableFuzzy?: boolean;
  enableSemantic?: boolean;
  enableAI?: boolean;
  fuzzyThreshold?: number;
  semanticThreshold?: number;
  maxResults?: number;
  includeScore?: boolean;
  highlightMatches?: boolean;
  contextWindow?: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'filter' | 'completion' | 'correction';
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchHistory {
  id: string;
  query: SearchQuery;
  timestamp: Date;
  resultsCount: number;
  executionTime: number;
  selectedResults: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  created_at: Date;
  updated_at: Date;
  usage_count: number;
  is_alert?: boolean;
  alert_frequency?: 'realtime' | 'hourly' | 'daily' | 'weekly';
}

export interface SearchFacet {
  field: string;
  values: Array<{
    value: any;
    count: number;
    selected: boolean;
  }>;
  type: 'category' | 'range' | 'date' | 'boolean';
}

export interface SearchContext {
  user_id?: string;
  session_id?: string;
  location?: string;
  previous_queries?: string[];
  user_preferences?: Record<string, any>;
  domain_context?: string;
}

export interface UseSmartSearchOptions {
  enableHistory?: boolean;
  enableSuggestions?: boolean;
  enableSavedSearches?: boolean;
  enableFaceting?: boolean;
  enableAutoComplete?: boolean;
  debounceDelay?: number;
  maxHistoryItems?: number;
  maxSuggestions?: number;
  cacheResults?: boolean;
  cacheSize?: number;
  enableContextualSearch?: boolean;
  defaultSearchOptions?: SearchOptions;
}

export interface UseSmartSearchReturn<T = any> {
  // Search state
  query: SearchQuery;
  results: SearchResult<T>[];
  suggestions: SearchSuggestion[];
  facets: SearchFacet[];
  isSearching: boolean;
  error: string | null;
  searchTime: number;
  totalResults: number;

  // Search history
  history: SearchHistory[];
  savedSearches: SavedSearch[];

  // Search functions
  search: (query: string | SearchQuery, options?: SearchOptions) => Promise<SearchResult<T>[]>;
  searchWithStrategy: (strategy: 'local' | 'ai' | 'hybrid', query: string) => Promise<SearchResult<T>[]>;
  getSuggestions: (partialQuery: string) => Promise<SearchSuggestion[]>;
  autoComplete: (text: string, field?: string) => Promise<string[]>;

  // Query management
  updateQuery: (query: Partial<SearchQuery>) => void;
  clearQuery: () => void;
  addFilter: (filter: SearchFilter) => void;
  removeFilter: (index: number) => void;
  updateFilter: (index: number, filter: SearchFilter) => void;

  // History management
  clearHistory: () => void;
  deleteHistoryItem: (id: string) => void;
  rerunHistoryItem: (id: string) => Promise<void>;

  // Saved searches
  saveSearch: (name: string, description?: string, enableAlert?: boolean) => Promise<SavedSearch>;
  deleteSavedSearch: (id: string) => void;
  runSavedSearch: (id: string) => Promise<void>;
  updateSavedSearch: (id: string, updates: Partial<SavedSearch>) => void;

  // Faceting
  updateFacet: (field: string, value: any, selected: boolean) => void;
  clearFacets: () => void;
  getFacetOptions: (field: string) => Array<{ value: any; count: number }>;

  // Advanced features
  explainResult: (result: SearchResult<T>) => Promise<string>;
  findSimilar: (item: T) => Promise<SearchResult<T>[]>;
  exportResults: (format: 'json' | 'csv') => string;
  getSearchAnalytics: () => SearchAnalytics;

  // Performance
  getPerformanceMetrics: () => SearchPerformanceMetrics;
  optimizeQuery: (query: SearchQuery) => SearchQuery;
}

export interface SearchAnalytics {
  total_searches: number;
  avg_search_time: number;
  most_searched_terms: Array<{ term: string; count: number }>;
  search_success_rate: number;
  popular_filters: Array<{ field: string; value: any; count: number }>;
  search_patterns: Array<{ pattern: string; frequency: number }>;
  user_engagement: {
    click_through_rate: number;
    result_selection_rate: number;
    query_refinement_rate: number;
  };
}

export interface SearchPerformanceMetrics {
  last_search_time: number;
  avg_search_time: number;
  cache_hit_rate: number;
  total_searches: number;
  failed_searches: number;
  slow_searches: number;
  index_size: number;
}

// ========================
// Default Configuration
// ========================

const DEFAULT_OPTIONS: Required<UseSmartSearchOptions> = {
  enableHistory: true,
  enableSuggestions: true,
  enableSavedSearches: true,
  enableFaceting: true,
  enableAutoComplete: true,
  debounceDelay: 300,
  maxHistoryItems: 100,
  maxSuggestions: 10,
  cacheResults: true,
  cacheSize: 50,
  enableContextualSearch: true,
  defaultSearchOptions: {
    enableFuzzy: true,
    enableSemantic: true,
    enableAI: true,
    fuzzyThreshold: 0.7,
    semanticThreshold: 0.8,
    maxResults: 50,
    includeScore: true,
    highlightMatches: true,
    contextWindow: 100
  }
};

const DEFAULT_QUERY: SearchQuery = {
  text: '',
  filters: [],
  sort: { field: 'relevance', direction: 'desc' },
  facets: [],
  options: DEFAULT_OPTIONS.defaultSearchOptions
};

// ========================
// Hook Implementation
// ========================

export const useSmartSearch = <T = any>(
  searchFunction: (query: SearchQuery) => Promise<SearchResult<T>[]>,
  options: UseSmartSearchOptions = {}
): UseSmartSearchReturn<T> => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // State management
  const [query, setQuery] = useState<SearchQuery>(DEFAULT_QUERY);
  const [results, setResults] = useState<SearchResult<T>[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  const [totalResults, setTotalResults] = useState(0);

  // Refs for internal tracking
  const searchCache = useRef<Map<string, { results: SearchResult<T>[]; timestamp: number }>>(new Map());
  const searchId = useRef(0);
  const performanceMetrics = useRef({
    totalSearches: 0,
    failedSearches: 0,
    totalSearchTime: 0,
    cacheHits: 0
  });

  // Debounced search for suggestions
  const debouncedGetSuggestions = useCallback(
    debounce(async (partialQuery: string) => {
      if (!partialQuery || partialQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const suggestions = await getSuggestionsInternal(partialQuery);
        setSuggestions(suggestions.slice(0, config.maxSuggestions));
      } catch (error) {
        console.warn('Failed to get suggestions:', error);
        setSuggestions([]);
      }
    }, config.debounceDelay),
    [config.debounceDelay, config.maxSuggestions]
  );

  // Internal suggestion generator
  const getSuggestionsInternal = useCallback(async (partialQuery: string): Promise<SearchSuggestion[]> => {
    const suggestions: SearchSuggestion[] = [];

    // Query completion from history
    if (config.enableHistory) {
      const historySuggestions = history
        .filter(h => h.query.text.toLowerCase().includes(partialQuery.toLowerCase()))
        .slice(0, 3)
        .map(h => ({
          text: h.query.text,
          type: 'query' as const,
          score: h.resultsCount > 0 ? 0.8 : 0.5,
          metadata: { from: 'history', resultsCount: h.resultsCount }
        }));

      suggestions.push(...historySuggestions);
    }

    // Auto-complete from recent searches
    const recentQueries = history
      .slice(0, 20)
      .map(h => h.query.text)
      .filter(q => q.toLowerCase().startsWith(partialQuery.toLowerCase()))
      .slice(0, 3)
      .map(text => ({
        text,
        type: 'completion' as const,
        score: 0.9,
        metadata: { from: 'autocomplete' }
      }));

    suggestions.push(...recentQueries);

    // Filter suggestions from saved searches
    if (config.enableSavedSearches) {
      const savedSuggestions = savedSearches
        .filter(s => s.name.toLowerCase().includes(partialQuery.toLowerCase()) ||
                     s.query.text.toLowerCase().includes(partialQuery.toLowerCase()))
        .slice(0, 2)
        .map(s => ({
          text: s.name,
          type: 'query' as const,
          score: 0.7,
          metadata: { from: 'saved', id: s.id }
        }));

      suggestions.push(...savedSuggestions);
    }

    // Remove duplicates and sort by score
    const uniqueSuggestions = suggestions.filter((suggestion, index, array) =>
      index === array.findIndex(s => s.text === suggestion.text)
    );

    return uniqueSuggestions.sort((a, b) => b.score - a.score);
  }, [history, savedSearches, config.enableHistory, config.enableSavedSearches]);

  // Main search function
  const search = useCallback(async (
    queryInput: string | SearchQuery,
    options?: SearchOptions
  ): Promise<SearchResult<T>[]> => {
    const currentSearchId = ++searchId.current;
    setIsSearching(true);
    setError(null);

    const startTime = performance.now();

    try {
      // Prepare search query
      const searchQuery: SearchQuery = typeof queryInput === 'string'
        ? { ...query, text: queryInput, options: { ...query.options, ...options } }
        : queryInput;

      setQuery(searchQuery);

      // Check cache first
      const cacheKey = JSON.stringify(searchQuery);
      if (config.cacheResults && searchCache.current.has(cacheKey)) {
        const cached = searchCache.current.get(cacheKey)!;
        const cacheAge = Date.now() - cached.timestamp;

        if (cacheAge < 300000) { // 5 minutes
          performanceMetrics.current.cacheHits++;
          setResults(cached.results);
          setTotalResults(cached.results.length);
          const endTime = performance.now();
          setSearchTime(endTime - startTime);
          return cached.results;
        }
      }

      // Execute search
      const searchResults = await searchFunction(searchQuery);

      // Check if this is still the current search
      if (currentSearchId !== searchId.current) {
        return [];
      }

      // Update results
      setResults(searchResults);
      setTotalResults(searchResults.length);

      // Cache results
      if (config.cacheResults) {
        if (searchCache.current.size >= config.cacheSize) {
          // Remove oldest entry
          const oldestKey = Array.from(searchCache.current.keys())[0];
          searchCache.current.delete(oldestKey);
        }

        searchCache.current.set(cacheKey, {
          results: searchResults,
          timestamp: Date.now()
        });
      }

      // Update facets if enabled
      if (config.enableFaceting) {
        updateFacetsFromResults(searchResults);
      }

      // Add to history
      if (config.enableHistory && searchQuery.text.trim()) {
        addToHistory(searchQuery, searchResults, performance.now() - startTime);
      }

      // Update performance metrics
      performanceMetrics.current.totalSearches++;
      performanceMetrics.current.totalSearchTime += performance.now() - startTime;

      const endTime = performance.now();
      setSearchTime(endTime - startTime);

      return searchResults;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      performanceMetrics.current.failedSearches++;
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [query, config.cacheResults, config.cacheSize, config.enableFaceting, config.enableHistory, searchFunction]);

  // Strategy-specific search
  const searchWithStrategy = useCallback(async (
    strategy: 'local' | 'ai' | 'hybrid',
    queryText: string
  ): Promise<SearchResult<T>[]> => {
    const searchOptions: SearchOptions = {
      ...config.defaultSearchOptions,
      enableFuzzy: strategy === 'local' || strategy === 'hybrid',
      enableSemantic: strategy === 'ai' || strategy === 'hybrid',
      enableAI: strategy === 'ai' || strategy === 'hybrid'
    };

    return await search(queryText, searchOptions);
  }, [search, config.defaultSearchOptions]);

  // Get suggestions
  const getSuggestions = useCallback(async (partialQuery: string): Promise<SearchSuggestion[]> => {
    debouncedGetSuggestions(partialQuery);
    return suggestions;
  }, [debouncedGetSuggestions, suggestions]);

  // Auto-complete
  const autoComplete = useCallback(async (text: string, field?: string): Promise<string[]> => {
    if (!config.enableAutoComplete || text.length < 2) {
      return [];
    }

    // Simple auto-complete from search history
    const completions = history
      .map(h => field ? h.query.filters.find(f => f.field === field)?.value : h.query.text)
      .filter((value): value is string => typeof value === 'string')
      .filter(value => value.toLowerCase().startsWith(text.toLowerCase()))
      .slice(0, 10);

    return Array.from(new Set(completions));
  }, [config.enableAutoComplete, history]);

  // Query management
  const updateQuery = useCallback((updates: Partial<SearchQuery>) => {
    setQuery(prev => ({ ...prev, ...updates }));
  }, []);

  const clearQuery = useCallback(() => {
    setQuery(DEFAULT_QUERY);
    setResults([]);
    setFacets([]);
    setSuggestions([]);
    setError(null);
  }, []);

  const addFilter = useCallback((filter: SearchFilter) => {
    setQuery(prev => ({
      ...prev,
      filters: [...prev.filters, filter]
    }));
  }, []);

  const removeFilter = useCallback((index: number) => {
    setQuery(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index)
    }));
  }, []);

  const updateFilter = useCallback((index: number, filter: SearchFilter) => {
    setQuery(prev => ({
      ...prev,
      filters: prev.filters.map((f, i) => i === index ? filter : f)
    }));
  }, []);

  // History management
  const addToHistory = useCallback((searchQuery: SearchQuery, searchResults: SearchResult<T>[], executionTime: number) => {
    const historyItem: SearchHistory = {
      id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query: searchQuery,
      timestamp: new Date(),
      resultsCount: searchResults.length,
      executionTime,
      selectedResults: []
    };

    setHistory(prev => {
      const updated = [historyItem, ...prev];
      return updated.slice(0, config.maxHistoryItems);
    });
  }, [config.maxHistoryItems]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  const rerunHistoryItem = useCallback(async (id: string) => {
    const historyItem = history.find(item => item.id === id);
    if (historyItem) {
      await search(historyItem.query);
    }
  }, [history, search]);

  // Saved searches
  const saveSearch = useCallback(async (
    name: string,
    description?: string,
    enableAlert?: boolean
  ): Promise<SavedSearch> => {
    const savedSearch: SavedSearch = {
      id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      query: { ...query },
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      is_alert: enableAlert,
      alert_frequency: enableAlert ? 'daily' : undefined
    };

    setSavedSearches(prev => [...prev, savedSearch]);
    return savedSearch;
  }, [query]);

  const deleteSavedSearch = useCallback((id: string) => {
    setSavedSearches(prev => prev.filter(search => search.id !== id));
  }, []);

  const runSavedSearch = useCallback(async (id: string) => {
    const savedSearch = savedSearches.find(search => search.id === id);
    if (savedSearch) {
      // Update usage count
      setSavedSearches(prev => prev.map(search =>
        search.id === id
          ? { ...search, usage_count: search.usage_count + 1, updated_at: new Date() }
          : search
      ));

      await search(savedSearch.query);
    }
  }, [savedSearches, search]);

  const updateSavedSearch = useCallback((id: string, updates: Partial<SavedSearch>) => {
    setSavedSearches(prev => prev.map(search =>
      search.id === id
        ? { ...search, ...updates, updated_at: new Date() }
        : search
    ));
  }, []);

  // Faceting
  const updateFacetsFromResults = useCallback((searchResults: SearchResult<T>[]) => {
    if (!config.enableFaceting || searchResults.length === 0) {
      setFacets([]);
      return;
    }

    const facetData: Record<string, Map<any, number>> = {};

    // Extract facet data from results
    searchResults.forEach(result => {
      if (result.item && typeof result.item === 'object') {
        Object.entries(result.item as Record<string, any>).forEach(([field, value]) => {
          if (value != null) {
            if (!facetData[field]) {
              facetData[field] = new Map();
            }
            facetData[field].set(value, (facetData[field].get(value) || 0) + 1);
          }
        });
      }
    });

    // Convert to facet format
    const newFacets: SearchFacet[] = Object.entries(facetData)
      .filter(([_, values]) => values.size > 1) // Only show fields with multiple values
      .map(([field, valueMap]) => ({
        field,
        values: Array.from(valueMap.entries())
          .map(([value, count]) => ({
            value,
            count,
            selected: query.filters.some(f => f.field === field && f.value === value)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20), // Limit facet values
        type: inferFacetType(field, Array.from(valueMap.keys())[0])
      }));

    setFacets(newFacets);
  }, [config.enableFaceting, query.filters]);

  const updateFacet = useCallback((field: string, value: any, selected: boolean) => {
    if (selected) {
      addFilter({ field, operator: 'equals', value });
    } else {
      const filterIndex = query.filters.findIndex(f => f.field === field && f.value === value);
      if (filterIndex >= 0) {
        removeFilter(filterIndex);
      }
    }

    // Update facet state
    setFacets(prev => prev.map(facet =>
      facet.field === field
        ? {
            ...facet,
            values: facet.values.map(v =>
              v.value === value ? { ...v, selected } : v
            )
          }
        : facet
    ));
  }, [query.filters, addFilter, removeFilter]);

  const clearFacets = useCallback(() => {
    setFacets(prev => prev.map(facet => ({
      ...facet,
      values: facet.values.map(v => ({ ...v, selected: false }))
    })));

    // Remove all facet filters
    setQuery(prev => ({
      ...prev,
      filters: prev.filters.filter(f => !facets.some(facet => facet.field === f.field))
    }));
  }, [facets]);

  const getFacetOptions = useCallback((field: string): Array<{ value: any; count: number }> => {
    const facet = facets.find(f => f.field === field);
    return facet ? facet.values.map(v => ({ value: v.value, count: v.count })) : [];
  }, [facets]);

  // Advanced features
  const explainResult = useCallback(async (result: SearchResult<T>): Promise<string> => {
    const explanation: string[] = [];

    explanation.push(`Match type: ${result.matchType}`);
    explanation.push(`Relevance score: ${result.score.toFixed(2)}`);

    if (result.highlights && result.highlights.length > 0) {
      explanation.push(`Highlighted matches:`);
      result.highlights.forEach(highlight => {
        explanation.push(`  - ${highlight.field}: "${highlight.fragment}"`);
      });
    }

    if (result.metadata) {
      explanation.push(`Additional context:`);
      Object.entries(result.metadata).forEach(([key, value]) => {
        explanation.push(`  - ${key}: ${value}`);
      });
    }

    return explanation.join('\n');
  }, []);

  const findSimilar = useCallback(async (item: T): Promise<SearchResult<T>[]> => {
    // Simple similarity search based on item properties
    if (!item || typeof item !== 'object') {
      return [];
    }

    const itemProperties = Object.entries(item as Record<string, any>);
    const similarityQuery: SearchQuery = {
      text: '',
      filters: itemProperties
        .filter(([_, value]) => typeof value === 'string' && value.length > 0)
        .slice(0, 3) // Use top 3 properties
        .map(([field, value]) => ({
          field,
          operator: 'contains' as const,
          value
        })),
      options: { ...config.defaultSearchOptions, maxResults: 10 }
    };

    return await search(similarityQuery);
  }, [search, config.defaultSearchOptions]);

  const exportResults = useCallback((format: 'json' | 'csv'): string => {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }

    // CSV export
    if (results.length === 0) return '';

    const headers = ['score', 'matchType', 'relevance'];
    const itemKeys = results.length > 0 && results[0].item && typeof results[0].item === 'object'
      ? Object.keys(results[0].item as Record<string, any>)
      : [];

    const csvHeaders = [...headers, ...itemKeys].join(',');
    const csvRows = results.map(result => {
      const baseValues = [result.score, result.matchType, result.relevance];
      const itemValues = itemKeys.map(key =>
        result.item && typeof result.item === 'object'
          ? JSON.stringify((result.item as Record<string, any>)[key] || '')
          : ''
      );
      return [...baseValues, ...itemValues].join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }, [results]);

  const getSearchAnalytics = useCallback((): SearchAnalytics => {
    const searchTerms: Record<string, number> = {};
    const searchFilters: Record<string, number> = {};

    history.forEach(historyItem => {
      // Count search terms
      if (historyItem.query.text) {
        searchTerms[historyItem.query.text] = (searchTerms[historyItem.query.text] || 0) + 1;
      }

      // Count filters
      historyItem.query.filters.forEach(filter => {
        const filterKey = `${filter.field}:${filter.value}`;
        searchFilters[filterKey] = (searchFilters[filterKey] || 0) + 1;
      });
    });

    const totalSearches = history.length;
    const successfulSearches = history.filter(h => h.resultsCount > 0).length;
    const avgSearchTime = history.reduce((sum, h) => sum + h.executionTime, 0) / totalSearches || 0;

    return {
      total_searches: totalSearches,
      avg_search_time: avgSearchTime,
      most_searched_terms: Object.entries(searchTerms)
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      search_success_rate: totalSearches > 0 ? successfulSearches / totalSearches : 0,
      popular_filters: Object.entries(searchFilters)
        .map(([filter, count]) => {
          const [field, value] = filter.split(':');
          return { field, value, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      search_patterns: [], // Would implement pattern analysis
      user_engagement: {
        click_through_rate: 0.75, // Mock data
        result_selection_rate: 0.65,
        query_refinement_rate: 0.25
      }
    };
  }, [history]);

  const getPerformanceMetrics = useCallback((): SearchPerformanceMetrics => {
    const metrics = performanceMetrics.current;

    return {
      last_search_time: searchTime,
      avg_search_time: metrics.totalSearches > 0 ? metrics.totalSearchTime / metrics.totalSearches : 0,
      cache_hit_rate: metrics.totalSearches > 0 ? metrics.cacheHits / metrics.totalSearches : 0,
      total_searches: metrics.totalSearches,
      failed_searches: metrics.failedSearches,
      slow_searches: 0, // Would implement slow search tracking
      index_size: searchCache.current.size
    };
  }, [searchTime]);

  const optimizeQuery = useCallback((inputQuery: SearchQuery): SearchQuery => {
    const optimized = { ...inputQuery };

    // Remove redundant filters
    optimized.filters = inputQuery.filters.filter((filter, index, array) =>
      index === array.findIndex(f =>
        f.field === filter.field &&
        f.operator === filter.operator &&
        JSON.stringify(f.value) === JSON.stringify(filter.value)
      )
    );

    // Optimize text query
    if (inputQuery.text) {
      optimized.text = inputQuery.text
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .toLowerCase();
    }

    return optimized;
  }, []);

  // Utility function to infer facet type
  const inferFacetType = (field: string, sampleValue: any): SearchFacet['type'] => {
    if (typeof sampleValue === 'boolean') return 'boolean';
    if (typeof sampleValue === 'number') return 'range';
    if (sampleValue instanceof Date || /date|time|created|updated/i.test(field)) return 'date';
    return 'category';
  };

  // Auto-trigger suggestions on query text changes
  useEffect(() => {
    if (config.enableSuggestions && query.text) {
      debouncedGetSuggestions(query.text);
    } else {
      setSuggestions([]);
    }
  }, [query.text, config.enableSuggestions, debouncedGetSuggestions]);

  return {
    query,
    results,
    suggestions,
    facets,
    isSearching,
    error,
    searchTime,
    totalResults,
    history,
    savedSearches,
    search,
    searchWithStrategy,
    getSuggestions,
    autoComplete,
    updateQuery,
    clearQuery,
    addFilter,
    removeFilter,
    updateFilter,
    clearHistory,
    deleteHistoryItem,
    rerunHistoryItem,
    saveSearch,
    deleteSavedSearch,
    runSavedSearch,
    updateSavedSearch,
    updateFacet,
    clearFacets,
    getFacetOptions,
    explainResult,
    findSimilar,
    exportResults,
    getSearchAnalytics,
    getPerformanceMetrics,
    optimizeQuery
  };
};

export default useSmartSearch;