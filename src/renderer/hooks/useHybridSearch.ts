/**
 * useHybridSearch Hook - UC001 Implementation
 * 
 * React hook for hybrid search functionality with:
 * 1. Progressive enhancement (local first, then AI)
 * 2. Authorization dialog integration
 * 3. Performance monitoring
 * 4. Error handling and fallback strategies
 * 5. Real-time search state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { hybridSearchService, HybridSearchResult, HybridSearchOptions } from '../services/hybridSearchService';
import { SearchResult, KBCategory } from '../../types/services';
import { AuthorizationResult } from '../../main/services/AIAuthorizationService';

export interface UseHybridSearchOptions extends HybridSearchOptions {
  autoSearch?: boolean;
  debounceMs?: number;
  enableRealTime?: boolean;
}

export interface HybridSearchState {
  // Search results
  results: SearchResult[];
  localResults: SearchResult[];
  aiResults: SearchResult[];
  
  // Search state
  isSearching: boolean;
  isLocalSearching: boolean;
  isAISearching: boolean;
  
  // Performance metrics
  performance: {
    localSearchTime: number;
    aiSearchTime?: number;
    totalTime: number;
    localCompleted: boolean;
    aiCompleted: boolean;
  };
  
  // Authorization state
  authorizationRequired: boolean;
  authorizationPending: boolean;
  authorizationStatus?: 'approved' | 'denied' | 'pending' | 'not_required';
  
  // Error handling
  error: string | null;
  warnings: string[];
  
  // Metadata
  metadata: {
    localResultCount: number;
    aiResultCount: number;
    totalResultCount: number;
    duplicatesRemoved: number;
    searchCompleted: boolean;
  };
}

export interface HybridSearchActions {
  search: (query: string, category?: KBCategory, options?: HybridSearchOptions) => Promise<void>;
  clearResults: () => void;
  retrySearch: () => void;
  approveAISearch: () => Promise<void>;
  denyAISearch: () => void;
  reset: () => void;
}

const initialState: HybridSearchState = {
  results: [],
  localResults: [],
  aiResults: [],
  isSearching: false,
  isLocalSearching: false,
  isAISearching: false,
  performance: {
    localSearchTime: 0,
    totalTime: 0,
    localCompleted: false,
    aiCompleted: false
  },
  authorizationRequired: false,
  authorizationPending: false,
  error: null,
  warnings: [],
  metadata: {
    localResultCount: 0,
    aiResultCount: 0,
    totalResultCount: 0,
    duplicatesRemoved: 0,
    searchCompleted: false
  }
};

/**
 * Main hybrid search hook with comprehensive state management
 */
export function useHybridSearch(options: UseHybridSearchOptions = {}): [
  HybridSearchState,
  HybridSearchActions
] {
  const [state, setState] = useState<HybridSearchState>(initialState);
  const lastSearchRef = useRef<{
    query: string;
    category?: KBCategory;
    options?: HybridSearchOptions;
  } | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authPromiseRef = useRef<{
    resolve: (approved: boolean) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    (query: string, category?: KBCategory, searchOptions?: HybridSearchOptions) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query, category, searchOptions);
      }, options.debounceMs || 300);
    },
    [options.debounceMs]
  );

  /**
   * Core search function implementing UC001 progressive enhancement
   */
  const performSearch = useCallback(
    async (query: string, category?: KBCategory, searchOptions?: HybridSearchOptions) => {
      if (!query.trim()) {
        setState(prev => ({ ...prev, error: 'Search query cannot be empty' }));
        return;
      }

      // Store search parameters for retry functionality
      lastSearchRef.current = { query, category, options: searchOptions };

      // Reset state and start search
      setState(prev => ({
        ...prev,
        isSearching: true,
        isLocalSearching: true,
        error: null,
        warnings: [],
        authorizationRequired: false,
        authorizationPending: false,
        metadata: { ...prev.metadata, searchCompleted: false }
      }));

      try {
        const mergedOptions = { ...options, ...searchOptions };
        const searchResult = await hybridSearchService.search(query, category, mergedOptions);
        
        // Update state with complete results
        setState(prev => ({
          ...prev,
          results: searchResult.mergedResults,
          localResults: searchResult.localResults,
          aiResults: searchResult.aiResults,
          isSearching: false,
          isLocalSearching: false,
          isAISearching: false,
          performance: searchResult.performance,
          authorizationRequired: searchResult.performance.authorizationRequired,
          authorizationStatus: searchResult.metadata.authorizationStatus,
          warnings: searchResult.metadata.errorMessages || [],
          metadata: {
            localResultCount: searchResult.metadata.localResultCount,
            aiResultCount: searchResult.metadata.aiResultCount,
            totalResultCount: searchResult.metadata.mergedResultCount,
            duplicatesRemoved: searchResult.metadata.duplicatesRemoved,
            searchCompleted: true
          }
        }));

        // Log performance metrics if below UC001 requirements
        if (searchResult.performance.localSearchTime > 500) {
          console.warn(
            `Local search exceeded 500ms requirement: ${searchResult.performance.localSearchTime}ms`
          );
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        setState(prev => ({
          ...prev,
          isSearching: false,
          isLocalSearching: false,
          isAISearching: false,
          error: errorMessage,
          metadata: { ...prev.metadata, searchCompleted: true }
        }));
      }
    },
    [options]
  );

  /**
   * Progressive search implementation
   * First shows local results, then enhances with AI if authorized
   */
  const progressiveSearch = useCallback(
    async (query: string, category?: KBCategory, searchOptions?: HybridSearchOptions) => {
      if (!query.trim()) return;

      lastSearchRef.current = { query, category, options: searchOptions };

      // Phase 1: Local search (must complete in <500ms per UC001)
      setState(prev => ({
        ...prev,
        isSearching: true,
        isLocalSearching: true,
        error: null,
        warnings: []
      }));

      try {
        // Force local-only search first
        const localOnlyOptions = { 
          ...options, 
          ...searchOptions, 
          enableAI: false 
        };
        
        const localResult = await hybridSearchService.search(query, category, localOnlyOptions);
        
        // Update with local results immediately
        setState(prev => ({
          ...prev,
          results: localResult.localResults,
          localResults: localResult.localResults,
          isLocalSearching: false,
          performance: {
            ...prev.performance,
            localSearchTime: localResult.performance.localSearchTime,
            localCompleted: true
          },
          metadata: {
            ...prev.metadata,
            localResultCount: localResult.metadata.localResultCount,
            totalResultCount: localResult.metadata.localResultCount
          }
        }));

        // Phase 2: AI enhancement if enabled and beneficial
        const shouldEnhanceWithAI = (
          (searchOptions?.enableAI ?? options.enableAI ?? true) &&
          (localResult.localResults.length < 5 || 
           /how\s+to|why\s+does|explain|analyze/i.test(query))
        );

        if (shouldEnhanceWithAI) {
          setState(prev => ({ ...prev, isAISearching: true, authorizationPending: true }));
          
          const fullResult = await hybridSearchService.search(query, category, {
            ...options,
            ...searchOptions,
            enableAI: true
          });
          
          setState(prev => ({
            ...prev,
            results: fullResult.mergedResults,
            aiResults: fullResult.aiResults,
            isAISearching: false,
            authorizationPending: false,
            authorizationRequired: fullResult.performance.authorizationRequired,
            authorizationStatus: fullResult.metadata.authorizationStatus,
            performance: fullResult.performance,
            metadata: {
              ...prev.metadata,
              aiResultCount: fullResult.metadata.aiResultCount,
              totalResultCount: fullResult.metadata.mergedResultCount,
              duplicatesRemoved: fullResult.metadata.duplicatesRemoved,
              searchCompleted: true
            }
          }));
        } else {
          setState(prev => ({
            ...prev,
            isSearching: false,
            metadata: { ...prev.metadata, searchCompleted: true }
          }));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        setState(prev => ({
          ...prev,
          isSearching: false,
          isLocalSearching: false,
          isAISearching: false,
          authorizationPending: false,
          error: errorMessage
        }));
      }
    },
    [options]
  );

  /**
   * Handle AI search authorization approval
   */
  const approveAISearch = useCallback(async () => {
    if (authPromiseRef.current) {
      authPromiseRef.current.resolve(true);
      authPromiseRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      authorizationStatus: 'approved',
      authorizationPending: false
    }));

    // Retry search with AI enabled if we have a previous search
    if (lastSearchRef.current) {
      const { query, category, options: searchOptions } = lastSearchRef.current;
      await performSearch(query, category, { ...searchOptions, enableAI: true });
    }
  }, [performSearch]);

  /**
   * Handle AI search authorization denial
   */
  const denyAISearch = useCallback(() => {
    if (authPromiseRef.current) {
      authPromiseRef.current.resolve(false);
      authPromiseRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      authorizationStatus: 'denied',
      authorizationPending: false,
      authorizationRequired: false
    }));
  }, []);

  /**
   * Clear all search results and state
   */
  const clearResults = useCallback(() => {
    setState(initialState);
    lastSearchRef.current = null;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  /**
   * Retry the last search operation
   */
  const retrySearch = useCallback(() => {
    if (lastSearchRef.current) {
      const { query, category, options: searchOptions } = lastSearchRef.current;
      performSearch(query, category, searchOptions);
    }
  }, [performSearch]);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    clearResults();
    if (authPromiseRef.current) {
      authPromiseRef.current.reject(new Error('Search reset'));
      authPromiseRef.current = null;
    }
  }, [clearResults]);

  // Auto-search functionality
  useEffect(() => {
    if (options.autoSearch && lastSearchRef.current) {
      const { query, category, options: searchOptions } = lastSearchRef.current;
      if (query) {
        debouncedSearch(query, category, searchOptions);
      }
    }
  }, [options.autoSearch, debouncedSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Choose search function based on options
  const searchFunction = options.enableRealTime ? progressiveSearch : performSearch;

  const actions: HybridSearchActions = {
    search: searchFunction,
    clearResults,
    retrySearch,
    approveAISearch,
    denyAISearch,
    reset
  };

  return [state, actions];
}

/**
 * Simplified hook for basic hybrid search functionality
 */
export function useSimpleHybridSearch(defaultOptions: UseHybridSearchOptions = {}) {
  const [state, actions] = useHybridSearch(defaultOptions);
  
  return {
    results: state.results,
    isLoading: state.isSearching,
    error: state.error,
    search: actions.search,
    clear: actions.clearResults
  };
}

/**
 * Hook for monitoring hybrid search performance
 */
export function useHybridSearchPerformance() {
  const [metrics, setMetrics] = useState({
    averageLocalTime: 0,
    averageAITime: 0,
    averageTotalTime: 0,
    localSearchCompliance: 0, // Percentage of searches under 500ms
    searchCount: 0
  });

  const recordPerformance = useCallback((performance: HybridSearchState['performance']) => {
    setMetrics(prev => {
      const newCount = prev.searchCount + 1;
      const localCompliant = performance.localSearchTime <= 500;
      
      return {
        averageLocalTime: (prev.averageLocalTime * prev.searchCount + performance.localSearchTime) / newCount,
        averageAITime: performance.aiSearchTime ? 
          (prev.averageAITime * prev.searchCount + performance.aiSearchTime) / newCount : 
          prev.averageAITime,
        averageTotalTime: (prev.averageTotalTime * prev.searchCount + performance.totalTime) / newCount,
        localSearchCompliance: (prev.localSearchCompliance * prev.searchCount + (localCompliant ? 1 : 0)) / newCount,
        searchCount: newCount
      };
    });
  }, []);

  return { metrics, recordPerformance };
}