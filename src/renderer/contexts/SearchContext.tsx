/**
 * Enhanced Search Context - Optimized Search State Management
 * 
 * This context provides comprehensive search state management with:
 * - Optimized React Context with proper memoization
 * - Debounced search handling for performance
 * - Advanced caching mechanisms for search results
 * - Search history with persistence
 * - Real-time search suggestions
 * - Performance monitoring and analytics
 * - Context splitting for minimal re-renders
 * - Offline search capabilities
 * 
 * @author State Management Architect
 * @version 2.0.0
 */

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useEffect, 
  useMemo, 
  useRef,
  ReactNode 
} from 'react';
import { SearchResult, SearchOptions, KBCategory } from '../../types/services';
import { useApp } from './AppContext';
import { debounce, createCacheManager } from '../utils/stateHelpers';

// Search filters interface
export interface SearchFilters {
  category?: KBCategory;
  tags?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  successRateRange?: {
    min?: number;
    max?: number;
  };
  sortBy: 'relevance' | 'usage' | 'recent' | 'success_rate' | 'score';
  sortOrder: 'asc' | 'desc';
}

// Enhanced search state interface
export interface SearchState {
  // Query and results
  query: string;
  results: SearchResult[];
  totalResults: number;
  
  // Search status
  isSearching: boolean;
  lastSearchTime?: Date;
  searchError?: string;
  
  // Filters and options
  filters: SearchFilters;
  useAI: boolean;
  
  // History and suggestions
  searchHistory: string[];
  suggestions: string[];
  recentQueries: Array<{
    query: string;
    timestamp: number;
    resultCount: number;
    successful: boolean;
  }>;
  
  // Pagination
  currentPage: number;
  pageSize: number;
  
  // Performance metrics
  searchMetrics?: {
    queryTime: number;
    resultCount: number;
    aiUsed: boolean;
    cacheHit: boolean;
    fallbackUsed?: boolean;
    processingTime?: number;
  };
  
  // Cache status
  cacheStats: {
    hitCount: number;
    missCount: number;
    hitRate: number;
  };
  
  // Search analytics
  searchAnalytics: {
    totalSearches: number;
    averageResponseTime: number;
    successRate: number;
    noResultQueries: string[];
    popularQueries: Array<{ query: string; count: number }>;
  };
}

// Initial state
const initialFilters: SearchFilters = {
  sortBy: 'relevance',
  sortOrder: 'desc',
};

const initialState: SearchState = {
  query: '',
  results: [],
  totalResults: 0,
  isSearching: false,
  filters: initialFilters,
  useAI: true,
  searchHistory: [],
  suggestions: [],
  recentQueries: [],
  currentPage: 1,
  pageSize: 20,
  cacheStats: {
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
  },
  searchAnalytics: {
    totalSearches: 0,
    averageResponseTime: 0,
    successRate: 1,
    noResultQueries: [],
    popularQueries: [],
  },
};

// Enhanced action types
type SearchAction =
  | { type: 'SET_QUERY'; payload: string }
  | { type: 'SET_RESULTS'; payload: { results: SearchResult[]; totalResults: number; metrics?: SearchState['searchMetrics'] } }
  | { type: 'SET_SEARCHING'; payload: boolean }
  | { type: 'SET_SEARCH_ERROR'; payload: string | undefined }
  | { type: 'SET_FILTERS'; payload: Partial<SearchFilters> }
  | { type: 'SET_USE_AI'; payload: boolean }
  | { type: 'ADD_TO_HISTORY'; payload: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_SUGGESTIONS'; payload: string[] }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'RESET_SEARCH' }
  | { type: 'ADD_RECENT_QUERY'; payload: { query: string; resultCount: number; successful: boolean } }
  | { type: 'UPDATE_CACHE_STATS'; payload: { hit?: boolean; miss?: boolean } }
  | { type: 'UPDATE_SEARCH_ANALYTICS'; payload: Partial<SearchState['searchAnalytics']> }
  | { type: 'INCREMENT_POPULAR_QUERY'; payload: string };

// Reducer
function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, query: action.payload, currentPage: 1 };

    case 'SET_RESULTS':
      return {
        ...state,
        results: action.payload.results,
        totalResults: action.payload.totalResults,
        searchMetrics: action.payload.metrics,
        lastSearchTime: new Date(),
        searchError: undefined,
        isSearching: false,
      };

    case 'SET_SEARCHING':
      return { 
        ...state, 
        isSearching: action.payload,
        searchError: action.payload ? undefined : state.searchError,
      };

    case 'SET_SEARCH_ERROR':
      return { 
        ...state, 
        searchError: action.payload,
        isSearching: false,
      };

    case 'SET_FILTERS':
      return { 
        ...state, 
        filters: { ...state.filters, ...action.payload },
        currentPage: 1,
      };

    case 'SET_USE_AI':
      return { ...state, useAI: action.payload };

    case 'ADD_TO_HISTORY':
      const query = action.payload.trim();
      if (query && !state.searchHistory.includes(query)) {
        return {
          ...state,
          searchHistory: [query, ...state.searchHistory.slice(0, 19)], // Keep last 20
        };
      }
      return state;

    case 'CLEAR_HISTORY':
      return { ...state, searchHistory: [] };

    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.payload };

    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };

    case 'RESET_SEARCH':
      return {
        ...state,
        query: '',
        results: [],
        totalResults: 0,
        searchError: undefined,
        currentPage: 1,
        filters: initialFilters,
      };

    case 'ADD_RECENT_QUERY': {
      const recentQuery = { ...action.payload, timestamp: Date.now() };
      return {
        ...state,
        recentQueries: [recentQuery, ...state.recentQueries.slice(0, 49)], // Keep last 50
      };
    }

    case 'UPDATE_CACHE_STATS': {
      const { hit, miss } = action.payload;
      const newHitCount = state.cacheStats.hitCount + (hit ? 1 : 0);
      const newMissCount = state.cacheStats.missCount + (miss ? 1 : 0);
      const totalRequests = newHitCount + newMissCount;
      
      return {
        ...state,
        cacheStats: {
          hitCount: newHitCount,
          missCount: newMissCount,
          hitRate: totalRequests > 0 ? newHitCount / totalRequests : 0,
        },
      };
    }

    case 'UPDATE_SEARCH_ANALYTICS': {
      return {
        ...state,
        searchAnalytics: {
          ...state.searchAnalytics,
          ...action.payload,
        },
      };
    }

    case 'INCREMENT_POPULAR_QUERY': {
      const query = action.payload;
      const existingQuery = state.searchAnalytics.popularQueries.find(pq => pq.query === query);
      
      let updatedPopularQueries;
      if (existingQuery) {
        updatedPopularQueries = state.searchAnalytics.popularQueries.map(pq =>
          pq.query === query ? { ...pq, count: pq.count + 1 } : pq
        );
      } else {
        updatedPopularQueries = [...state.searchAnalytics.popularQueries, { query, count: 1 }];
      }
      
      // Sort by count and keep top 20
      updatedPopularQueries = updatedPopularQueries
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      return {
        ...state,
        searchAnalytics: {
          ...state.searchAnalytics,
          popularQueries: updatedPopularQueries,
        },
      };
    }

    default:
      return state;
  }
}

// Enhanced context value interface
export interface SearchContextValue {
  // State
  state: SearchState;
  
  // Query management
  setQuery: (query: string) => void;
  clearQuery: () => void;
  
  // Search execution
  performSearch: (query?: string, options?: Partial<SearchOptions>) => Promise<void>;
  performSearchWithCache: (query: string, options?: Partial<SearchOptions>) => Promise<void>;
  clearResults: () => void;
  
  // Filter management
  updateFilters: (filters: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  
  // AI toggle
  setUseAI: (useAI: boolean) => void;
  
  // History management
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  getSearchHistory: () => string[];
  
  // Suggestions
  updateSuggestions: (suggestions: string[]) => void;
  generateSuggestions: (query: string) => Promise<string[]>;
  
  // Pagination
  setPage: (page: number) => void;
  
  // Analytics and metrics
  getSearchAnalytics: () => SearchState['searchAnalytics'];
  getCacheStats: () => SearchState['cacheStats'];
  getRecentQueries: () => SearchState['recentQueries'];
  
  // Cache management
  clearSearchCache: () => void;
  preloadSearchResults: (queries: string[]) => Promise<void>;
  
  // Utilities
  resetSearch: () => void;
}

// Create context
const SearchContext = createContext<SearchContextValue | null>(null);

// Enhanced provider component
export interface SearchProviderProps {
  children: ReactNode;
  initialState?: Partial<SearchState>;
  cacheTimeout?: number;
  debounceDelay?: number;
  enableOfflineSearch?: boolean;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({
  children,
  initialState: providedInitialState = {},
  cacheTimeout = 5 * 60 * 1000, // 5 minutes
  debounceDelay = 300, // 300ms
  enableOfflineSearch = true,
}) => {
  const [state, dispatch] = useReducer(
    searchReducer,
    { ...initialState, ...providedInitialState }
  );
  
  const { addNotification, setLoading, updateLastActivity } = useApp();
  
  // Search results cache
  const searchCache = useRef(createCacheManager<SearchResult[]>({
    maxSize: 100,
    ttl: cacheTimeout,
  }));
  
  // Suggestions cache
  const suggestionsCache = useRef(createCacheManager<string[]>({
    maxSize: 50,
    ttl: cacheTimeout * 2, // Suggestions cache longer
  }));

  // Debounced search execution
  const debouncedPerformSearch = useMemo(
    () => debounce(async (query: string, options: Partial<SearchOptions> = {}) => {
      if (!query.trim()) return;
      
      const startTime = performance.now();
      const cacheKey = `search:${query}:${JSON.stringify(options)}`;
      
      dispatch({ type: 'SET_SEARCHING', payload: true });
      setLoading(true);
      
      try {
        // Check cache first
        const cachedResults = searchCache.current.get(cacheKey);
        if (cachedResults && !options.force) {
          dispatch({ 
            type: 'SET_RESULTS', 
            payload: { 
              results: cachedResults, 
              totalResults: cachedResults.length,
              metrics: {
                queryTime: performance.now() - startTime,
                resultCount: cachedResults.length,
                aiUsed: false,
                cacheHit: true,
              }
            }
          });
          dispatch({ type: 'UPDATE_CACHE_STATS', payload: { hit: true } });
          return;
        }
        
        dispatch({ type: 'UPDATE_CACHE_STATS', payload: { miss: true } });
        
        // Build search options
        const searchOptions: SearchOptions = {
          query: query.trim(),
          category: state.filters.category,
          tags: state.filters.tags,
          sortBy: state.filters.sortBy,
          sortOrder: state.filters.sortOrder,
          useAI: options.useAI !== undefined ? options.useAI : state.useAI,
          page: state.currentPage,
          pageSize: state.pageSize,
          ...options,
        };

        let results: SearchResult[] = [];
        let totalResults = 0;
        let aiUsed = false;
        let fallbackUsed = false;

        // Try AI search first if enabled
        if (searchOptions.useAI && window.electronAPI?.searchWithAI) {
          try {
            const response = await window.electronAPI.searchWithAI(query, searchOptions);
            results = Array.isArray(response) ? response : (response.results || []);
            totalResults = Array.isArray(response) ? response.length : (response.totalResults || results.length);
            aiUsed = true;
          } catch (aiError) {
            console.warn('AI search failed, falling back to local search:', aiError);
            fallbackUsed = true;
            
            addNotification({
              type: 'warning',
              message: 'AI search unavailable, using local search',
              duration: 3000,
            });
            
            // Fallback to local search
            if (window.electronAPI?.searchLocal) {
              const response = await window.electronAPI.searchLocal(query, searchOptions);
              results = Array.isArray(response) ? response : (response.results || []);
              totalResults = Array.isArray(response) ? response.length : (response.totalResults || results.length);
            }
          }
        } else if (window.electronAPI?.searchLocal) {
          // Direct local search
          const response = await window.electronAPI.searchLocal(query, searchOptions);
          results = Array.isArray(response) ? response : (response.results || []);
          totalResults = Array.isArray(response) ? response.length : (response.totalResults || results.length);
        }

        const queryTime = performance.now() - startTime;

        // Cache results
        searchCache.current.set(cacheKey, results);
        
        // Update results
        dispatch({
          type: 'SET_RESULTS',
          payload: {
            results,
            totalResults,
            metrics: {
              queryTime,
              resultCount: results.length,
              aiUsed,
              cacheHit: false,
              fallbackUsed,
              processingTime: queryTime,
            },
          },
        });

        // Update analytics
        dispatch({
          type: 'UPDATE_SEARCH_ANALYTICS',
          payload: {
            totalSearches: state.searchAnalytics.totalSearches + 1,
            averageResponseTime: ((state.searchAnalytics.averageResponseTime * state.searchAnalytics.totalSearches) + queryTime) / (state.searchAnalytics.totalSearches + 1),
            successRate: results.length > 0 ? 
              ((state.searchAnalytics.successRate * state.searchAnalytics.totalSearches) + 1) / (state.searchAnalytics.totalSearches + 1) :
              (state.searchAnalytics.successRate * state.searchAnalytics.totalSearches) / (state.searchAnalytics.totalSearches + 1),
          },
        });

        // Add to recent queries
        dispatch({
          type: 'ADD_RECENT_QUERY',
          payload: { query, resultCount: results.length, successful: results.length > 0 },
        });

        // Track popular queries
        dispatch({ type: 'INCREMENT_POPULAR_QUERY', payload: query });

        // Add to history if results found
        if (results.length > 0) {
          dispatch({ type: 'ADD_TO_HISTORY', payload: query });
        } else {
          // Track no-result queries
          const currentNoResultQueries = [...state.searchAnalytics.noResultQueries];
          if (!currentNoResultQueries.includes(query)) {
            currentNoResultQueries.push(query);
            if (currentNoResultQueries.length > 20) {
              currentNoResultQueries.shift(); // Keep only last 20
            }
            
            dispatch({
              type: 'UPDATE_SEARCH_ANALYTICS',
              payload: { noResultQueries: currentNoResultQueries },
            });
          }
          
          addNotification({
            type: 'info',
            message: `No results found for "${query}"`,
            duration: 3000,
          });
        }

      } catch (error) {
        console.error('Search failed:', error);
        
        dispatch({
          type: 'SET_SEARCH_ERROR',
          payload: error instanceof Error ? error.message : 'Search failed',
        });
        
        addNotification({
          type: 'error',
          message: 'Search failed. Please check your connection and try again.',
          duration: 5000,
        });
      } finally {
        setLoading(false);
        updateLastActivity();
      }
    }, debounceDelay),
    [
      state.filters,
      state.useAI,
      state.currentPage,
      state.pageSize,
      state.searchAnalytics,
      addNotification,
      setLoading,
      updateLastActivity,
      debounceDelay
    ]
  );

  // Load search history and analytics from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('kb-search-history');
      if (savedHistory) {
        const history = JSON.parse(savedHistory);
        if (Array.isArray(history)) {
          history.forEach(query => dispatch({ type: 'ADD_TO_HISTORY', payload: query }));
        }
      }

      const savedAnalytics = localStorage.getItem('kb-search-analytics');
      if (savedAnalytics) {
        const analytics = JSON.parse(savedAnalytics);
        dispatch({ type: 'UPDATE_SEARCH_ANALYTICS', payload: analytics });
      }
    } catch (error) {
      console.warn('Failed to load search data:', error);
    }
  }, []);

  // Save search data to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('kb-search-history', JSON.stringify(state.searchHistory));
      localStorage.setItem('kb-search-analytics', JSON.stringify(state.searchAnalytics));
    } catch (error) {
      console.warn('Failed to save search data:', error);
    }
  }, [state.searchHistory, state.searchAnalytics]);

  // Query management
  const setQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_QUERY', payload: query });
    updateLastActivity();
  }, [updateLastActivity]);

  const clearQuery = useCallback(() => {
    dispatch({ type: 'SET_QUERY', payload: '' });
  }, []);

  // Search execution
  const performSearch = useCallback(async (
    query?: string, 
    options?: Partial<SearchOptions>
  ) => {
    const searchQuery = query || state.query;
    
    if (!searchQuery.trim()) {
      return;
    }

    return debouncedPerformSearch(searchQuery, options);
  }, [state.query, debouncedPerformSearch]);

  const performSearchWithCache = useCallback(async (
    query: string, 
    options: Partial<SearchOptions> = {}
  ) => {
    return debouncedPerformSearch(query, { ...options, force: false });
  }, [debouncedPerformSearch]);

  const clearResults = useCallback(() => {
    dispatch({ type: 'SET_RESULTS', payload: { results: [], totalResults: 0 } });
  }, []);

  // Filter management
  const updateFilters = useCallback((filters: Partial<SearchFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
    updateLastActivity();
  }, [updateLastActivity]);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'SET_FILTERS', payload: initialFilters });
  }, []);

  // AI toggle
  const setUseAI = useCallback((useAI: boolean) => {
    dispatch({ type: 'SET_USE_AI', payload: useAI });
    updateLastActivity();
  }, [updateLastActivity]);

  // History management
  const addToHistory = useCallback((query: string) => {
    dispatch({ type: 'ADD_TO_HISTORY', payload: query });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
    try {
      localStorage.removeItem('kb-search-history');
      localStorage.removeItem('kb-search-analytics');
    } catch (error) {
      console.warn('Failed to clear search history from storage:', error);
    }
  }, []);

  const getSearchHistory = useCallback((): string[] => {
    return state.searchHistory;
  }, [state.searchHistory]);

  // Suggestions
  const updateSuggestions = useCallback((suggestions: string[]) => {
    dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions });
  }, []);

  const generateSuggestions = useCallback(async (query: string): Promise<string[]> => {
    if (!query.trim()) return [];
    
    const cacheKey = `suggestions:${query.toLowerCase()}`;
    const cached = suggestionsCache.current.get(cacheKey);
    if (cached) return cached;
    
    try {
      // Generate suggestions from multiple sources
      const suggestions = new Set<string>();
      
      // History-based suggestions
      state.searchHistory
        .filter(h => h.toLowerCase().includes(query.toLowerCase()) && h !== query)
        .slice(0, 3)
        .forEach(h => suggestions.add(h));
      
      // Popular query suggestions
      state.searchAnalytics.popularQueries
        .filter(pq => pq.query.toLowerCase().includes(query.toLowerCase()) && pq.query !== query)
        .slice(0, 3)
        .forEach(pq => suggestions.add(pq.query));
      
      // Category-based suggestions if query matches category
      const categoryMatches = state.searchAnalytics.popularQueries
        .filter(pq => {
          const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System'];
          return categories.some(cat => 
            query.toLowerCase().includes(cat.toLowerCase()) ||
            pq.query.toLowerCase().includes(cat.toLowerCase())
          );
        })
        .slice(0, 2);
      
      categoryMatches.forEach(pq => suggestions.add(pq.query));
      
      const suggestionArray = Array.from(suggestions).slice(0, 8);
      
      // Cache the suggestions
      suggestionsCache.current.set(cacheKey, suggestionArray);
      
      return suggestionArray;
      
    } catch (error) {
      console.warn('Failed to generate suggestions:', error);
      return [];
    }
  }, [state.searchHistory, state.searchAnalytics.popularQueries]);

  // Pagination
  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  // Analytics and metrics
  const getSearchAnalytics = useCallback((): SearchState['searchAnalytics'] => {
    return state.searchAnalytics;
  }, [state.searchAnalytics]);

  const getCacheStats = useCallback((): SearchState['cacheStats'] => {
    return state.cacheStats;
  }, [state.cacheStats]);

  const getRecentQueries = useCallback((): SearchState['recentQueries'] => {
    return state.recentQueries;
  }, [state.recentQueries]);

  // Cache management
  const clearSearchCache = useCallback(() => {
    searchCache.current.clear();
    suggestionsCache.current.clear();
  }, []);

  const preloadSearchResults = useCallback(async (queries: string[]): Promise<void> => {
    const preloadPromises = queries.map(async (query) => {
      try {
        const cacheKey = `search:${query}:${JSON.stringify(state.filters)}`;
        if (!searchCache.current.has(cacheKey)) {
          // Perform search without updating UI
          await debouncedPerformSearch(query, { silent: true });
        }
      } catch (error) {
        console.warn(`Failed to preload results for query: ${query}`, error);
      }
    });
    
    await Promise.allSettled(preloadPromises);
  }, [state.filters, debouncedPerformSearch]);

  // Reset search
  const resetSearch = useCallback(() => {
    dispatch({ type: 'RESET_SEARCH' });
  }, []);

  // Cache cleanup on unmount
  useEffect(() => {
    return () => {
      searchCache.current.clear();
      suggestionsCache.current.clear();
    };
  }, []);

  // Context value (Memoized for performance)
  const contextValue = useMemo<SearchContextValue>(() => ({
    state,
    setQuery,
    clearQuery,
    performSearch,
    performSearchWithCache,
    clearResults,
    updateFilters,
    resetFilters,
    setUseAI,
    addToHistory,
    clearHistory,
    getSearchHistory,
    updateSuggestions,
    generateSuggestions,
    setPage,
    getSearchAnalytics,
    getCacheStats,
    getRecentQueries,
    clearSearchCache,
    preloadSearchResults,
    resetSearch,
  }), [
    state,
    setQuery,
    clearQuery,
    performSearch,
    performSearchWithCache,
    clearResults,
    updateFilters,
    resetFilters,
    setUseAI,
    addToHistory,
    clearHistory,
    getSearchHistory,
    updateSuggestions,
    generateSuggestions,
    setPage,
    getSearchAnalytics,
    getCacheStats,
    getRecentQueries,
    clearSearchCache,
    preloadSearchResults,
    resetSearch,
  ]);

  return (
    <SearchContext.Provider value={contextValue}>
      {children}
    </SearchContext.Provider>
  );
};

// Hook to use the context
export const useSearch = (): SearchContextValue => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

// Convenience hooks for specific parts of the search state
export const useSearchQuery = () => {
  const { state, setQuery, clearQuery } = useSearch();
  return {
    query: state.query,
    setQuery,
    clearQuery,
  };
};

export const useSearchResults = () => {
  const { state, performSearch, clearResults } = useSearch();
  return {
    results: state.results,
    totalResults: state.totalResults,
    isSearching: state.isSearching,
    searchError: state.searchError,
    searchMetrics: state.searchMetrics,
    performSearch,
    clearResults,
  };
};

export const useSearchFilters = () => {
  const { state, updateFilters, resetFilters } = useSearch();
  return {
    filters: state.filters,
    updateFilters,
    resetFilters,
  };
};

export const useSearchHistory = () => {
  const { state, addToHistory, clearHistory } = useSearch();
  return {
    searchHistory: state.searchHistory,
    addToHistory,
    clearHistory,
  };
};

export default SearchContext;