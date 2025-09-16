/**
 * React Hook for Search Operations
 * Provides search functionality with caching, debouncing, and AI fallback
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { SearchResult, SearchQuery, KBCategory } from '../../types';
import { ipcBridge } from '../ipc/IPCBridge';

// Search state interface
export interface UseSearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  hasSearched: boolean;
  searchType: 'local' | 'ai' | 'mixed';
  resultCount: number;
  searchTime: number;
}

// Search options
export interface UseSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  enableAI?: boolean;
  autoSearch?: boolean;
  defaultCategory?: KBCategory;
  fallbackToLocal?: boolean;
  maxResults?: number;
}

// Search return interface
export interface UseSearchReturn extends UseSearchState {
  // Search operations
  search: (query: string, useAI?: boolean) => Promise<void>;
  searchLocal: (query: string, options?: SearchQuery) => Promise<void>;
  searchWithAI: (query: string, options?: SearchQuery) => Promise<void>;
  
  // Query management
  setQuery: (query: string) => void;
  clearQuery: () => void;
  clearResults: () => void;
  
  // Filters
  setCategory: (category?: KBCategory) => void;
  setTags: (tags: string[]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  
  // Utilities
  clearError: () => void;
  retryLastSearch: () => Promise<void>;
  getSearchSuggestions: () => string[];
  
  // Computed values
  isEmpty: boolean;
  hasResults: boolean;
  filteredResults: SearchResult[];
  topResults: SearchResult[];
}

// Search history for suggestions
interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}

/**
 * Search Hook with debouncing, caching, and AI integration
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    enableAI = true,
    autoSearch = false,
    defaultCategory,
    fallbackToLocal = true,
    maxResults = 50
  } = options;

  // State
  const [state, setState] = useState<UseSearchState>({
    query: '',
    results: [],
    isLoading: false,
    isSearching: false,
    error: null,
    hasSearched: false,
    searchType: 'local',
    resultCount: 0,
    searchTime: 0
  });

  const [searchOptions, setSearchOptions] = useState<SearchQuery>({
    query: '',
    category: defaultCategory,
    tags: [],
    useAI: enableAI,
    limit: maxResults
  });

  // Refs
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSearchRef = useRef<() => Promise<void>>();
  const mountedRef = useRef(true);
  const searchHistoryRef = useRef<SearchHistoryItem[]>([]);

  // Safe state update
  const safeSetState = useCallback((update: Partial<UseSearchState> | ((prev: UseSearchState) => UseSearchState)) => {
    if (mountedRef.current) {
      setState(update);
    }
  }, []);

  // Error handling
  const handleError = useCallback((error: Error, searchFn?: () => Promise<void>) => {
    console.error('Search Error:', error);
    
    if (searchFn) {
      lastSearchRef.current = searchFn;
    }
    
    safeSetState(prev => ({
      ...prev,
      error: error.message,
      isLoading: false,
      isSearching: false
    }));
  }, [safeSetState]);

  // Add to search history
  const addToHistory = useCallback((query: string, resultCount: number) => {
    const historyItem: SearchHistoryItem = {
      query: query.toLowerCase().trim(),
      timestamp: Date.now(),
      resultCount
    };
    
    // Remove duplicate entries
    searchHistoryRef.current = searchHistoryRef.current.filter(
      item => item.query !== historyItem.query
    );
    
    // Add to beginning and limit size
    searchHistoryRef.current.unshift(historyItem);
    searchHistoryRef.current = searchHistoryRef.current.slice(0, 50);
  }, []);

  // Local search
  const searchLocal = useCallback(async (query: string, customOptions?: SearchQuery): Promise<void> => {
    const startTime = performance.now();
    
    safeSetState(prev => ({
      ...prev,
      isSearching: true,
      error: null,
      searchType: 'local'
    }));

    const operation = async () => {
      try {
        const searchQuery = { ...searchOptions, ...customOptions, query };
        const results = await ipcBridge.searchLocal(query, searchQuery);
        const endTime = performance.now();
        const searchTime = endTime - startTime;

        safeSetState(prev => ({
          ...prev,
          results,
          resultCount: results.length,
          searchTime,
          isSearching: false,
          isLoading: false,
          hasSearched: true,
          error: null
        }));

        addToHistory(query, results.length);
      } catch (error) {
        handleError(error as Error, () => searchLocal(query, customOptions));
      }
    };

    lastSearchRef.current = operation;
    await operation();
  }, [searchOptions, safeSetState, handleError, addToHistory]);

  // AI search with fallback
  const searchWithAI = useCallback(async (query: string, customOptions?: SearchQuery): Promise<void> => {
    if (!enableAI) {
      return searchLocal(query, customOptions);
    }

    const startTime = performance.now();
    
    safeSetState(prev => ({
      ...prev,
      isSearching: true,
      error: null,
      searchType: 'ai'
    }));

    const operation = async () => {
      try {
        const searchQuery = { ...searchOptions, ...customOptions, query, useAI: true };
        let results = await ipcBridge.searchWithAI(query, searchQuery);
        let searchType: 'ai' | 'mixed' = 'ai';

        // If AI search returns few results and fallback is enabled, combine with local results
        if (fallbackToLocal && results.length < 3) {
          try {
            const localResults = await ipcBridge.searchLocal(query, { ...searchQuery, useAI: false });
            
            // Merge results, avoiding duplicates
            const combinedResults = [...results];
            const aiIds = new Set(results.map(r => r.entry.id));
            
            localResults.forEach(localResult => {
              if (!aiIds.has(localResult.entry.id)) {
                combinedResults.push({
                  ...localResult,
                  score: localResult.score * 0.8 // Slightly reduce score for local results
                });
              }
            });
            
            results = combinedResults.sort((a, b) => b.score - a.score);
            searchType = 'mixed';
          } catch (localError) {
            console.warn('Local fallback search failed:', localError);
          }
        }

        const endTime = performance.now();
        const searchTime = endTime - startTime;

        safeSetState(prev => ({
          ...prev,
          results,
          resultCount: results.length,
          searchTime,
          isSearching: false,
          isLoading: false,
          hasSearched: true,
          searchType,
          error: null
        }));

        addToHistory(query, results.length);
      } catch (error) {
        // If AI search fails and fallback is enabled, try local search
        if (fallbackToLocal) {
          try {
            await searchLocal(query, customOptions);
            return;
          } catch (localError) {
            handleError(localError as Error, () => searchWithAI(query, customOptions));
            return;
          }
        }
        
        handleError(error as Error, () => searchWithAI(query, customOptions));
      }
    };

    lastSearchRef.current = operation;
    await operation();
  }, [enableAI, searchLocal, searchOptions, safeSetState, handleError, addToHistory, fallbackToLocal]);

  // Generic search function
  const search = useCallback(async (query: string, useAI?: boolean): Promise<void> => {
    if (!query.trim() || query.trim().length < minQueryLength) {
      safeSetState(prev => ({
        ...prev,
        results: [],
        hasSearched: false,
        error: null
      }));
      return;
    }

    const shouldUseAI = useAI !== undefined ? useAI : (enableAI && searchOptions.useAI);
    
    if (shouldUseAI) {
      await searchWithAI(query);
    } else {
      await searchLocal(query);
    }
  }, [minQueryLength, enableAI, searchOptions.useAI, searchWithAI, searchLocal, safeSetState]);

  // Set query with debounced search
  const setQuery = useCallback((newQuery: string) => {
    setState(prev => ({ ...prev, query: newQuery }));
    setSearchOptions(prev => ({ ...prev, query: newQuery }));

    // Clear previous debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce search if auto-search is enabled
    if (autoSearch && newQuery.trim().length >= minQueryLength) {
      debounceTimeoutRef.current = setTimeout(() => {
        search(newQuery);
      }, debounceMs);
    }
  }, [autoSearch, minQueryLength, debounceMs, search]);

  // Clear query
  const clearQuery = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      query: '', 
      results: [], 
      hasSearched: false,
      error: null 
    }));
    setSearchOptions(prev => ({ ...prev, query: '' }));
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      results: [], 
      hasSearched: false,
      error: null,
      resultCount: 0 
    }));
  }, []);

  // Filter operations
  const setCategory = useCallback((category?: KBCategory) => {
    setSearchOptions(prev => ({ ...prev, category }));
    
    // Re-search if we have a query and auto-search is enabled
    if (autoSearch && state.query.trim()) {
      search(state.query);
    }
  }, [autoSearch, state.query, search]);

  const setTags = useCallback((tags: string[]) => {
    setSearchOptions(prev => ({ ...prev, tags }));
    
    if (autoSearch && state.query.trim()) {
      search(state.query);
    }
  }, [autoSearch, state.query, search]);

  const addTag = useCallback((tag: string) => {
    setSearchOptions(prev => ({ 
      ...prev, 
      tags: [...(prev.tags || []), tag].filter((t, i, arr) => arr.indexOf(t) === i)
    }));
    
    if (autoSearch && state.query.trim()) {
      search(state.query);
    }
  }, [autoSearch, state.query, search]);

  const removeTag = useCallback((tag: string) => {
    setSearchOptions(prev => ({ 
      ...prev, 
      tags: (prev.tags || []).filter(t => t !== tag)
    }));
    
    if (autoSearch && state.query.trim()) {
      search(state.query);
    }
  }, [autoSearch, state.query, search]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Retry last search
  const retryLastSearch = useCallback(async (): Promise<void> => {
    if (lastSearchRef.current) {
      await lastSearchRef.current();
    }
  }, []);

  // Get search suggestions based on history
  const getSearchSuggestions = useCallback((): string[] => {
    const currentQuery = state.query.toLowerCase().trim();
    
    if (!currentQuery) return [];
    
    return searchHistoryRef.current
      .filter(item => 
        item.query.includes(currentQuery) && 
        item.query !== currentQuery &&
        item.resultCount > 0
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map(item => item.query);
  }, [state.query]);

  // Computed values
  const isEmpty = state.results.length === 0;
  const hasResults = state.results.length > 0 && state.hasSearched;

  // Filtered results (apply client-side filtering if needed)
  const filteredResults = useMemo(() => {
    let results = state.results;
    
    // Apply category filter if not already applied server-side
    if (searchOptions.category) {
      results = results.filter(result => result.entry.category === searchOptions.category);
    }
    
    // Apply tag filters
    if (searchOptions.tags && searchOptions.tags.length > 0) {
      results = results.filter(result =>
        searchOptions.tags!.every(tag =>
          result.entry.tags?.some(entryTag => 
            entryTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }
    
    return results;
  }, [state.results, searchOptions.category, searchOptions.tags]);

  // Top results (highest scoring)
  const topResults = useMemo(() => {
    return filteredResults.slice(0, 10);
  }, [filteredResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Search operations
    search,
    searchLocal,
    searchWithAI,
    
    // Query management
    setQuery,
    clearQuery,
    clearResults,
    
    // Filters
    setCategory,
    setTags,
    addTag,
    removeTag,
    
    // Utilities
    clearError,
    retryLastSearch,
    getSearchSuggestions,
    
    // Computed values
    isEmpty,
    hasResults,
    filteredResults,
    topResults
  };
}

export default useSearch;