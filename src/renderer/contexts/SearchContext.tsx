/**
 * Search Context - UC001 Implementation
 *
 * Global state management for hybrid search functionality including:
 * 1. Centralized search state across components
 * 2. Authorization dialog management
 * 3. Performance monitoring and metrics
 * 4. Search history and preferences
 * 5. Error handling and recovery
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { HybridSearchState, HybridSearchActions, useHybridSearch, UseHybridSearchOptions } from '../hooks/useHybridSearch';
import { SearchResult, KBCategory } from '../../types/services';
import { HybridSearchOptions } from '../services/hybridSearchService';

// Extended state for global search context
export interface SearchContextState extends HybridSearchState {
  // Search history
  searchHistory: string[];
  recentSearches: Array<{
    query: string;
    category?: KBCategory;
    timestamp: Date;
    resultCount: number;
  }>;

  // User preferences
  preferences: {
    enableAIByDefault: boolean;
    maxResults: number;
    autoSearchDelay: number;
    saveSearchHistory: boolean;
    showPerformanceMetrics: boolean;
  };

  // Authorization dialog state
  authDialog: {
    isOpen: boolean;
    query: string;
    estimatedCost?: number;
    onApprove?: () => void;
    onDeny?: () => void;
    onCancel?: () => void;
  };

  // Global search settings
  globalSettings: {
    enableProgressiveSearch: boolean;
    enableRealTimeSearch: boolean;
    performanceMode: 'fast' | 'balanced' | 'comprehensive';
  };
}

export interface SearchContextActions extends HybridSearchActions {
  // History management
  addToHistory: (query: string, category?: KBCategory, resultCount?: number) => void;
  clearHistory: () => void;
  searchFromHistory: (query: string, category?: KBCategory) => void;

  // Preferences
  updatePreferences: (preferences: Partial<SearchContextState['preferences']>) => void;
  updateGlobalSettings: (settings: Partial<SearchContextState['globalSettings']>) => void;

  // Authorization dialog
  showAuthDialog: (query: string, estimatedCost?: number) => Promise<boolean>;
  hideAuthDialog: () => void;

  // Advanced search operations
  searchWithAnalytics: (query: string, category?: KBCategory, options?: HybridSearchOptions) => Promise<void>;
  getPerformanceMetrics: () => {
    averageSearchTime: number;
    searchCount: number;
    complianceRate: number;
  };
}

// Action types for reducer
type SearchAction =
  | { type: 'SET_SEARCH_STATE'; payload: Partial<SearchContextState> }
  | { type: 'ADD_TO_HISTORY'; payload: { query: string; category?: KBCategory; resultCount: number } }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<SearchContextState['preferences']> }
  | { type: 'UPDATE_GLOBAL_SETTINGS'; payload: Partial<SearchContextState['globalSettings']> }
  | { type: 'SHOW_AUTH_DIALOG'; payload: { query: string; estimatedCost?: number } }
  | { type: 'HIDE_AUTH_DIALOG' }
  | { type: 'UPDATE_PERFORMANCE_METRICS'; payload: { searchTime: number; compliance: boolean } };

// Initial state
const initialState: SearchContextState = {
  // Base hybrid search state
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
  },

  // Extended context state
  searchHistory: [],
  recentSearches: [],
  preferences: {
    enableAIByDefault: true,
    maxResults: 50,
    autoSearchDelay: 300,
    saveSearchHistory: true,
    showPerformanceMetrics: false
  },
  authDialog: {
    isOpen: false,
    query: ''
  },
  globalSettings: {
    enableProgressiveSearch: true,
    enableRealTimeSearch: true,
    performanceMode: 'balanced'
  }
};

// Reducer function
function searchReducer(state: SearchContextState, action: SearchAction): SearchContextState {
  switch (action.type) {
    case 'SET_SEARCH_STATE':
      return { ...state, ...action.payload };

    case 'ADD_TO_HISTORY':
      if (!state.preferences.saveSearchHistory) return state;

      const newRecentSearch = {
        query: action.payload.query,
        category: action.payload.category,
        timestamp: new Date(),
        resultCount: action.payload.resultCount
      };

      return {
        ...state,
        searchHistory: [
          action.payload.query,
          ...state.searchHistory.filter(q => q !== action.payload.query)
        ].slice(0, 50), // Keep last 50
        recentSearches: [
          newRecentSearch,
          ...state.recentSearches.filter(s => s.query !== action.payload.query)
        ].slice(0, 20) // Keep last 20
      };

    case 'CLEAR_HISTORY':
      return {
        ...state,
        searchHistory: [],
        recentSearches: []
      };

    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload }
      };

    case 'UPDATE_GLOBAL_SETTINGS':
      return {
        ...state,
        globalSettings: { ...state.globalSettings, ...action.payload }
      };

    case 'SHOW_AUTH_DIALOG':
      return {
        ...state,
        authDialog: {
          isOpen: true,
          query: action.payload.query,
          estimatedCost: action.payload.estimatedCost
        }
      };

    case 'HIDE_AUTH_DIALOG':
      return {
        ...state,
        authDialog: {
          ...state.authDialog,
          isOpen: false,
          onApprove: undefined,
          onDeny: undefined,
          onCancel: undefined
        }
      };

    default:
      return state;
  }
}

// Context creation
const SearchContext = createContext<{
  state: SearchContextState;
  actions: SearchContextActions;
} | null>(null);

// Provider component
export interface SearchProviderProps {
  children: ReactNode;
  defaultOptions?: UseHybridSearchOptions;
}

export function SearchProvider({ children, defaultOptions = {} }: SearchProviderProps) {
  const [contextState, dispatch] = useReducer(searchReducer, initialState);

  // Use hybrid search hook with context-aware options
  const hybridSearchOptions: UseHybridSearchOptions = {
    enableAI: contextState.preferences.enableAIByDefault,
    maxLocalResults: contextState.preferences.maxResults,
    debounceMs: contextState.preferences.autoSearchDelay,
    enableRealTime: contextState.globalSettings.enableRealTimeSearch,
    ...defaultOptions
  };

  const [hybridState, hybridActions] = useHybridSearch(hybridSearchOptions);

  // Sync hybrid search state with context state
  useEffect(() => {
    dispatch({
      type: 'SET_SEARCH_STATE',
      payload: {
        results: hybridState.results,
        localResults: hybridState.localResults,
        aiResults: hybridState.aiResults,
        isSearching: hybridState.isSearching,
        isLocalSearching: hybridState.isLocalSearching,
        isAISearching: hybridState.isAISearching,
        performance: hybridState.performance,
        authorizationRequired: hybridState.authorizationRequired,
        authorizationPending: hybridState.authorizationPending,
        authorizationStatus: hybridState.authorizationStatus,
        error: hybridState.error,
        warnings: hybridState.warnings,
        metadata: hybridState.metadata
      }
    });
  }, [hybridState]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedPreferences = localStorage.getItem('search-preferences');
      if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
      }

      const savedSettings = localStorage.getItem('search-global-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        dispatch({ type: 'UPDATE_GLOBAL_SETTINGS', payload: settings });
      }

      const savedHistory = localStorage.getItem('search-history');
      if (savedHistory) {
        const history = JSON.parse(savedHistory);
        dispatch({
          type: 'SET_SEARCH_STATE',
          payload: {
            searchHistory: history.searchHistory || [],
            recentSearches: history.recentSearches || []
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load search preferences:', error);
    }
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('search-preferences', JSON.stringify(contextState.preferences));
    } catch (error) {
      console.warn('Failed to save search preferences:', error);
    }
  }, [contextState.preferences]);

  useEffect(() => {
    try {
      localStorage.setItem('search-global-settings', JSON.stringify(contextState.globalSettings));
    } catch (error) {
      console.warn('Failed to save search settings:', error);
    }
  }, [contextState.globalSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('search-history', JSON.stringify({
        searchHistory: contextState.searchHistory,
        recentSearches: contextState.recentSearches
      }));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, [contextState.searchHistory, contextState.recentSearches]);

  // Extended actions
  const addToHistory = useCallback((query: string, category?: KBCategory, resultCount: number = 0) => {
    dispatch({
      type: 'ADD_TO_HISTORY',
      payload: { query, category, resultCount }
    });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  const searchFromHistory = useCallback(async (query: string, category?: KBCategory) => {
    await hybridActions.search(query, category);
  }, [hybridActions]);

  const updatePreferences = useCallback((preferences: Partial<SearchContextState['preferences']>) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
  }, []);

  const updateGlobalSettings = useCallback((settings: Partial<SearchContextState['globalSettings']>) => {
    dispatch({ type: 'UPDATE_GLOBAL_SETTINGS', payload: settings });
  }, []);

  const showAuthDialog = useCallback((query: string, estimatedCost?: number): Promise<boolean> => {
    return new Promise((resolve) => {
      dispatch({
        type: 'SHOW_AUTH_DIALOG',
        payload: { query, estimatedCost }
      });

      // Set up dialog callbacks
      dispatch({
        type: 'SET_SEARCH_STATE',
        payload: {
          authDialog: {
            isOpen: true,
            query,
            estimatedCost,
            onApprove: () => {
              hideAuthDialog();
              resolve(true);
            },
            onDeny: () => {
              hideAuthDialog();
              resolve(false);
            },
            onCancel: () => {
              hideAuthDialog();
              resolve(false);
            }
          }
        }
      });
    });
  }, []);

  const hideAuthDialog = useCallback(() => {
    dispatch({ type: 'HIDE_AUTH_DIALOG' });
  }, []);

  const searchWithAnalytics = useCallback(async (
    query: string,
    category?: KBCategory,
    options?: HybridSearchOptions
  ) => {
    const startTime = Date.now();

    try {
      await hybridActions.search(query, category, options);

      // Add to history after successful search
      addToHistory(query, category, contextState.metadata.totalResultCount);

    } catch (error) {
      console.error('Search with analytics failed:', error);
    }
  }, [hybridActions, addToHistory, contextState.metadata.totalResultCount]);

  const getPerformanceMetrics = useCallback(() => {
    const searchCount = contextState.recentSearches.length;
    const averageSearchTime = searchCount > 0 ?
      contextState.recentSearches.reduce((sum, search) => sum + contextState.performance.totalTime, 0) / searchCount :
      0;

    const complianceRate = searchCount > 0 ?
      contextState.recentSearches.filter(search => contextState.performance.localSearchTime <= 500).length / searchCount :
      1;

    return {
      averageSearchTime,
      searchCount,
      complianceRate
    };
  }, [contextState]);

  const actions: SearchContextActions = {
    ...hybridActions,
    addToHistory,
    clearHistory,
    searchFromHistory,
    updatePreferences,
    updateGlobalSettings,
    showAuthDialog,
    hideAuthDialog,
    searchWithAnalytics,
    getPerformanceMetrics
  };

  return (
    <SearchContext.Provider value={{ state: contextState, actions }}>
      {children}
    </SearchContext.Provider>
  );
}

// Hook to use search context
export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}

// Convenience hooks for specific functionality
export function useSearchState() {
  const { state } = useSearchContext();
  return state;
}

export function useSearchActions() {
  const { actions } = useSearchContext();
  return actions;
}

export function useSearchHistory() {
  const { state, actions } = useSearchContext();
  return {
    history: state.searchHistory,
    recentSearches: state.recentSearches,
    addToHistory: actions.addToHistory,
    clearHistory: actions.clearHistory,
    searchFromHistory: actions.searchFromHistory
  };
}

export function useSearchPreferences() {
  const { state, actions } = useSearchContext();
  return {
    preferences: state.preferences,
    globalSettings: state.globalSettings,
    updatePreferences: actions.updatePreferences,
    updateGlobalSettings: actions.updateGlobalSettings
  };
}

export function useAuthorizationDialog() {
  const { state, actions } = useSearchContext();
  return {
    authDialog: state.authDialog,
    showAuthDialog: actions.showAuthDialog,
    hideAuthDialog: actions.hideAuthDialog
  };
}