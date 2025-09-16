/**
 * KB-Optimized Router
 * Enhanced routing system specifically designed for Knowledge Base workflows
 * Supports search state persistence, fast navigation, and context preservation
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { KBCategory, KBEntry } from '../../types';
import { useSearch } from '../contexts/SearchContext';
import { useApp } from '../context/AppContext';

// ========================
// Navigation State Types
// ========================

export interface NavigationState {
  // Current route info
  currentRoute: string;
  previousRoute?: string;
  
  // Search context preservation
  searchContext?: {
    query: string;
    category?: KBCategory;
    results: any[];
    useAI: boolean;
  };
  
  // Entry context
  selectedEntryId?: string;
  
  // Navigation history
  navigationHistory: NavigationHistoryItem[];
  
  // User preferences
  preferences: {
    rememberSearchState: boolean;
    enableDeepLinking: boolean;
    cacheNavigation: boolean;
  };
}

export interface NavigationHistoryItem {
  route: string;
  timestamp: Date;
  searchQuery?: string;
  entryId?: string;
  metadata?: Record<string, any>;
}

export interface KBRouterContextValue {
  // Navigation state
  state: NavigationState;
  
  // Navigation methods
  navigateToSearch: (query?: string, category?: KBCategory) => void;
  navigateToEntry: (entryId: string, source?: 'search' | 'browse') => void;
  navigateToAddEntry: (prefilledData?: Partial<KBEntry>) => void;
  navigateToMetrics: () => void;
  navigateToHistory: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
  
  // State management
  preserveSearchContext: (context: NavigationState['searchContext']) => void;
  restoreSearchContext: () => NavigationState['searchContext'] | undefined;
  clearNavigationHistory: () => void;
  
  // URL utilities
  generateShareableURL: (query?: string, category?: KBCategory) => string;
  parseURLParams: () => URLSearchParams;
  updateURLWithState: (state: Partial<NavigationState['searchContext']>) => void;
}

// ========================
// Navigation Context
// ========================

const KBRouterContext = createContext<KBRouterContextValue | null>(null);

export const useKBRouter = (): KBRouterContextValue => {
  const context = useContext(KBRouterContext);
  if (!context) {
    throw new Error('useKBRouter must be used within KBRouterProvider');
  }
  return context;
};

// ========================
// Router Provider Component
// ========================

interface KBRouterProviderProps {
  children: React.ReactNode;
}

export const KBRouterProvider: React.FC<KBRouterProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: searchState, performSearch, setQuery, updateFilters } = useSearch();
  const { state: appState, selectEntry } = useApp();

  const [navState, setNavState] = useState<NavigationState>({
    currentRoute: location.pathname,
    navigationHistory: [],
    preferences: {
      rememberSearchState: true,
      enableDeepLinking: true,
      cacheNavigation: true,
    },
  });

  // ========================
  // URL State Synchronization
  // ========================

  // Parse URL parameters on mount and route changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const hash = location.hash;
    const pathname = location.pathname;

    // Update current route
    setNavState(prev => ({
      ...prev,
      previousRoute: prev.currentRoute,
      currentRoute: pathname,
    }));

    // Handle route-specific logic
    if (pathname.startsWith('/search')) {
      handleSearchRoute(urlParams, pathname);
    } else if (pathname.startsWith('/entry')) {
      handleEntryRoute(pathname);
    }

    // Add to navigation history
    addToNavigationHistory(pathname, urlParams);
  }, [location]);

  const handleSearchRoute = useCallback(async (params: URLSearchParams, pathname: string) => {
    const query = params.get('q') || '';
    const category = params.get('category') as KBCategory || undefined;
    const useAI = params.get('ai') !== 'false';

    // Extract query from path if present
    const pathQuery = pathname.split('/search/')[1];
    const decodedQuery = pathQuery ? decodeURIComponent(pathQuery) : query;

    // Restore search state if different from current
    if (decodedQuery !== searchState.query || 
        category !== searchState.filters.category) {
      
      // Update search context
      if (decodedQuery) {
        setQuery(decodedQuery);
        updateFilters({ category });
        await performSearch(decodedQuery, { useAI, category });
      }

      // Preserve search context
      preserveSearchContext({
        query: decodedQuery,
        category,
        results: searchState.results,
        useAI,
      });
    }
  }, [searchState, setQuery, updateFilters, performSearch]);

  const handleEntryRoute = useCallback((pathname: string) => {
    const entryId = pathname.split('/entry/')[1]?.split('/')[0];
    if (entryId && entryId !== appState.selectedEntry?.id) {
      // Find and select the entry
      const entry = searchState.results.find(r => r.entry.id === entryId)?.entry;
      if (entry) {
        selectEntry(entry);
      }
    }
  }, [appState.selectedEntry, searchState.results, selectEntry]);

  // ========================
  // Navigation Methods
  // ========================

  const navigateToSearch = useCallback((query?: string, category?: KBCategory) => {
    let path = '/search';
    const params = new URLSearchParams();

    if (query) {
      path += `/${encodeURIComponent(query)}`;
      params.set('q', query);
    }

    if (category) {
      params.set('category', category);
    }

    if (!searchState.useAI) {
      params.set('ai', 'false');
    }

    const fullPath = params.toString() ? `${path}?${params.toString()}` : path;
    navigate(fullPath);
  }, [navigate, searchState.useAI]);

  const navigateToEntry = useCallback((entryId: string, source?: 'search' | 'browse') => {
    const path = `/entry/${entryId}`;
    const params = new URLSearchParams();

    if (source) {
      params.set('source', source);
    }

    // Preserve search context in URL
    if (searchState.query) {
      params.set('return_query', searchState.query);
    }

    const fullPath = params.toString() ? `${path}?${params.toString()}` : path;
    navigate(fullPath);
  }, [navigate, searchState.query]);

  const navigateToAddEntry = useCallback((prefilledData?: Partial<KBEntry>) => {
    let path = '/add';
    const params = new URLSearchParams();

    if (prefilledData?.category) {
      params.set('category', prefilledData.category);
    }

    if (searchState.query) {
      params.set('related_query', searchState.query);
    }

    const fullPath = params.toString() ? `${path}?${params.toString()}` : path;
    navigate(fullPath);
  }, [navigate, searchState.query]);

  const navigateToMetrics = useCallback(() => {
    navigate('/metrics');
  }, [navigate]);

  const navigateToHistory = useCallback(() => {
    navigate('/history');
  }, [navigate]);

  const navigateBack = useCallback(() => {
    const history = navState.navigationHistory;
    if (history.length > 1) {
      const previousItem = history[history.length - 2];
      navigate(previousItem.route);
    } else {
      navigate(-1);
    }
  }, [navigate, navState.navigationHistory]);

  const navigateForward = useCallback(() => {
    navigate(1);
  }, [navigate]);

  // ========================
  // State Management
  // ========================

  const preserveSearchContext = useCallback((context: NavigationState['searchContext']) => {
    setNavState(prev => ({
      ...prev,
      searchContext: context,
    }));

    // Persist to localStorage if enabled
    if (navState.preferences.rememberSearchState) {
      try {
        localStorage.setItem('kb-search-context', JSON.stringify(context));
      } catch (error) {
        console.warn('Failed to save search context:', error);
      }
    }
  }, [navState.preferences.rememberSearchState]);

  const restoreSearchContext = useCallback((): NavigationState['searchContext'] | undefined => {
    // Return current context if available
    if (navState.searchContext) {
      return navState.searchContext;
    }

    // Try to restore from localStorage
    if (navState.preferences.rememberSearchState) {
      try {
        const saved = localStorage.getItem('kb-search-context');
        if (saved) {
          const context = JSON.parse(saved);
          setNavState(prev => ({ ...prev, searchContext: context }));
          return context;
        }
      } catch (error) {
        console.warn('Failed to restore search context:', error);
      }
    }

    return undefined;
  }, [navState.searchContext, navState.preferences.rememberSearchState]);

  const addToNavigationHistory = useCallback((
    route: string, 
    params?: URLSearchParams
  ) => {
    const historyItem: NavigationHistoryItem = {
      route,
      timestamp: new Date(),
      searchQuery: params?.get('q') || undefined,
      entryId: route.includes('/entry/') ? route.split('/entry/')[1]?.split('/')[0] : undefined,
      metadata: {
        category: params?.get('category'),
        source: params?.get('source'),
      },
    };

    setNavState(prev => ({
      ...prev,
      navigationHistory: [
        ...prev.navigationHistory.slice(-19), // Keep last 20 items
        historyItem,
      ],
    }));
  }, []);

  const clearNavigationHistory = useCallback(() => {
    setNavState(prev => ({
      ...prev,
      navigationHistory: [],
    }));
  }, []);

  // ========================
  // URL Utilities
  // ========================

  const generateShareableURL = useCallback((query?: string, category?: KBCategory): string => {
    const baseUrl = window.location.origin + window.location.pathname;
    let path = '/search';
    const params = new URLSearchParams();

    if (query) {
      path += `/${encodeURIComponent(query)}`;
      params.set('q', query);
    }

    if (category) {
      params.set('category', category);
    }

    return `${baseUrl}#${path}${params.toString() ? `?${params.toString()}` : ''}`;
  }, []);

  const parseURLParams = useCallback((): URLSearchParams => {
    return new URLSearchParams(location.search);
  }, [location.search]);

  const updateURLWithState = useCallback((state: Partial<NavigationState['searchContext']>) => {
    const currentParams = new URLSearchParams(location.search);
    
    if (state.query !== undefined) {
      if (state.query) {
        currentParams.set('q', state.query);
      } else {
        currentParams.delete('q');
      }
    }

    if (state.category !== undefined) {
      if (state.category) {
        currentParams.set('category', state.category);
      } else {
        currentParams.delete('category');
      }
    }

    if (state.useAI !== undefined) {
      if (state.useAI) {
        currentParams.delete('ai');
      } else {
        currentParams.set('ai', 'false');
      }
    }

    const newSearch = currentParams.toString();
    const newURL = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;
    
    navigate(newURL, { replace: true });
  }, [location, navigate]);

  // ========================
  // Context Value
  // ========================

  const contextValue: KBRouterContextValue = {
    state: navState,
    navigateToSearch,
    navigateToEntry,
    navigateToAddEntry,
    navigateToMetrics,
    navigateToHistory,
    navigateBack,
    navigateForward,
    preserveSearchContext,
    restoreSearchContext,
    clearNavigationHistory,
    generateShareableURL,
    parseURLParams,
    updateURLWithState,
  };

  return (
    <KBRouterContext.Provider value={contextValue}>
      {children}
    </KBRouterContext.Provider>
  );
};

// ========================
// Enhanced App Router
// ========================

export const KBAppRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Router>
      <KBRouterProvider>
        {children}
      </KBRouterProvider>
    </Router>
  );
};

// ========================
// Navigation Hooks
// ========================

export const useKBNavigation = () => {
  const {
    navigateToSearch,
    navigateToEntry,
    navigateToAddEntry,
    navigateToMetrics,
    navigateToHistory,
    navigateBack,
  } = useKBRouter();

  return {
    toSearch: navigateToSearch,
    toEntry: navigateToEntry,
    toAddEntry: navigateToAddEntry,
    toMetrics: navigateToMetrics,
    toHistory: navigateToHistory,
    back: navigateBack,
  };
};

export const useSearchURL = () => {
  const { generateShareableURL, updateURLWithState, parseURLParams } = useKBRouter();
  const { state } = useSearch();

  const getCurrentSearchURL = useCallback(() => {
    return generateShareableURL(state.query, state.filters.category);
  }, [generateShareableURL, state.query, state.filters.category]);

  const syncURLWithSearch = useCallback(() => {
    updateURLWithState({
      query: state.query,
      category: state.filters.category,
      useAI: state.useAI,
    });
  }, [updateURLWithState, state.query, state.filters.category, state.useAI]);

  return {
    getCurrentSearchURL: getCurrentSearchURL,
    syncURLWithSearch,
    parseURLParams,
    generateShareableURL,
  };
};

export const useNavigationHistory = () => {
  const { state, clearNavigationHistory } = useKBRouter();
  
  return {
    history: state.navigationHistory,
    clearHistory: clearNavigationHistory,
  };
};