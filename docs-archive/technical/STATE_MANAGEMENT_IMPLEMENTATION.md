# State Management Implementation Guide
## Custom Hooks + Context Pattern for Mainframe KB Assistant

---

## Overview

This document provides detailed implementation guidance for the recommended state management architecture using React Context API with custom hooks, optimized for performance and maintainability while avoiding Redux complexity.

---

## 1. Core State Architecture

### 1.1 State Provider Structure

```typescript
// types/StateTypes.ts
export interface GlobalState {
  app: AppState;
  kb: KnowledgeBaseState;
  ui: UIState;
  user: UserState;
}

export interface AppState {
  theme: 'light' | 'dark';
  isOffline: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  version: string;
  isInitialized: boolean;
  notifications: Notification[];
  errors: ApplicationError[];
}

export interface KnowledgeBaseState {
  entries: KBEntry[];
  searchResults: SearchResult[];
  selectedEntry: KBEntry | null;
  searchQuery: string;
  filters: SearchFilters;
  metrics: KBMetrics;
  isSearching: boolean;
  isLoading: boolean;
  cache: Map<string, SearchResult[]>;
  recentSearches: string[];
}

export interface UIState {
  activeWindow: string;
  openWindows: WindowState[];
  focusedElement: string | null;
  modals: ModalState[];
  panels: {
    sidebar: { isOpen: boolean; width: number };
    details: { isOpen: boolean; width: number };
    filters: { isOpen: boolean; position: 'left' | 'right' };
  };
  layout: {
    windowBounds: WindowBounds;
    isMaximized: boolean;
    isMinimized: boolean;
  };
}

export interface UserState {
  preferences: UserPreferences;
  session: UserSession;
  bookmarks: string[];
  recentEntries: string[];
  customShortcuts: KeyboardShortcut[];
}
```

### 1.2 Context Providers Implementation

```typescript
// context/AppStateContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';

interface AppStateContextType {
  state: AppState;
  dispatch: Dispatch<AppStateAction>;
}

const AppStateContext = createContext<AppStateContextType | null>(null);

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};

// Reducer for complex state updates
function appStateReducer(state: AppState, action: AppStateAction): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    case 'SET_OFFLINE':
      return { ...state, isOffline: action.payload };

    case 'ADD_ERROR':
      return {
        ...state,
        errors: [...state.errors, action.payload]
      };

    case 'CLEAR_ERRORS':
      return { ...state, errors: [] };

    default:
      return state;
  }
}

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [state, dispatch] = useReducer(appStateReducer, {
    theme: 'light',
    isOffline: !navigator.onLine,
    connectionStatus: 'connected',
    version: '1.0.0',
    isInitialized: false,
    notifications: [],
    errors: []
  });

  // Initialize app state
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load saved theme
        const savedTheme = await window.electronAPI?.getTheme();
        if (savedTheme) {
          dispatch({ type: 'SET_THEME', payload: savedTheme });
        }

        // Setup offline listeners
        const handleOnline = () => {
          dispatch({ type: 'SET_OFFLINE', payload: false });
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
        };

        const handleOffline = () => {
          dispatch({ type: 'SET_OFFLINE', payload: true });
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        dispatch({ type: 'SET_INITIALIZED', payload: true });

        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      } catch (error) {
        dispatch({
          type: 'ADD_ERROR',
          payload: {
            id: Date.now().toString(),
            message: 'Failed to initialize application',
            severity: 'error',
            timestamp: new Date()
          }
        });
      }
    };

    initializeApp();
  }, []);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};
```

### 1.3 Knowledge Base State Provider

```typescript
// context/KnowledgeBaseContext.tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';

interface KBStateContextType {
  state: KnowledgeBaseState;
  actions: KBActions;
}

interface KBActions {
  search: (query: string) => Promise<void>;
  selectEntry: (entry: KBEntry) => void;
  addEntry: (entry: Omit<KBEntry, 'id'>) => Promise<void>;
  updateEntry: (id: string, updates: Partial<KBEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  rateEntry: (id: string, rating: boolean) => Promise<void>;
  setFilters: (filters: Partial<SearchFilters>) => void;
  clearSearch: () => void;
  loadMetrics: () => Promise<void>;
}

const KBStateContext = createContext<KBStateContextType | null>(null);

export const useKBState = () => {
  const context = useContext(KBStateContext);
  if (!context) {
    throw new Error('useKBState must be used within KBStateProvider');
  }
  return context;
};

// KB State Reducer
function kbStateReducer(state: KnowledgeBaseState, action: KBStateAction): KnowledgeBaseState {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload, isSearching: false };

    case 'SET_SEARCHING':
      return { ...state, isSearching: action.payload };

    case 'SELECT_ENTRY':
      return { ...state, selectedEntry: action.payload };

    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [...state.entries, action.payload]
      };

    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map(entry =>
          entry.id === action.payload.id
            ? { ...entry, ...action.payload.updates }
            : entry
        ),
        selectedEntry: state.selectedEntry?.id === action.payload.id
          ? { ...state.selectedEntry, ...action.payload.updates }
          : state.selectedEntry
      };

    case 'DELETE_ENTRY':
      return {
        ...state,
        entries: state.entries.filter(entry => entry.id !== action.payload),
        selectedEntry: state.selectedEntry?.id === action.payload ? null : state.selectedEntry
      };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };

    case 'SET_METRICS':
      return { ...state, metrics: action.payload };

    case 'ADD_TO_CACHE':
      const newCache = new Map(state.cache);
      newCache.set(action.payload.query, action.payload.results);
      return { ...state, cache: newCache };

    case 'CLEAR_SEARCH':
      return {
        ...state,
        searchQuery: '',
        searchResults: [],
        isSearching: false
      };

    default:
      return state;
  }
}

export const KBStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [state, dispatch] = useReducer(kbStateReducer, {
    entries: [],
    searchResults: [],
    selectedEntry: null,
    searchQuery: '',
    filters: {
      category: '',
      tags: [],
      dateRange: null,
      sortBy: 'relevance'
    },
    metrics: {
      totalEntries: 0,
      searchesToday: 0,
      popularCategories: [],
      recentActivity: []
    },
    isSearching: false,
    isLoading: false,
    cache: new Map(),
    recentSearches: []
  });

  // KB Service integration
  const kbService = useKBService();

  const actions: KBActions = {
    search: useCallback(async (query: string) => {
      if (!query.trim()) {
        dispatch({ type: 'CLEAR_SEARCH' });
        return;
      }

      dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
      dispatch({ type: 'SET_SEARCHING', payload: true });

      try {
        // Check cache first
        const cached = state.cache.get(query);
        if (cached) {
          dispatch({ type: 'SET_SEARCH_RESULTS', payload: cached });
          return;
        }

        // Perform search
        const results = await kbService.search(query, state.filters);

        dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
        dispatch({ type: 'ADD_TO_CACHE', payload: { query, results } });

        // Add to recent searches
        const recentSearches = [
          query,
          ...state.recentSearches.filter(s => s !== query)
        ].slice(0, 10);

        // Update recent searches in storage
        await window.electronAPI?.setUserPreference('recentSearches', recentSearches);

      } catch (error) {
        console.error('Search failed:', error);
        dispatch({ type: 'SET_SEARCHING', payload: false });
      }
    }, [kbService, state.cache, state.filters, state.recentSearches]),

    selectEntry: useCallback((entry: KBEntry) => {
      dispatch({ type: 'SELECT_ENTRY', payload: entry });
    }, []),

    addEntry: useCallback(async (entryData: Omit<KBEntry, 'id'>) => {
      try {
        const entry = await kbService.addEntry(entryData);
        dispatch({ type: 'ADD_ENTRY', payload: entry });
        return entry;
      } catch (error) {
        console.error('Failed to add entry:', error);
        throw error;
      }
    }, [kbService]),

    updateEntry: useCallback(async (id: string, updates: Partial<KBEntry>) => {
      try {
        await kbService.updateEntry(id, updates);
        dispatch({ type: 'UPDATE_ENTRY', payload: { id, updates } });
      } catch (error) {
        console.error('Failed to update entry:', error);
        throw error;
      }
    }, [kbService]),

    deleteEntry: useCallback(async (id: string) => {
      try {
        await kbService.deleteEntry(id);
        dispatch({ type: 'DELETE_ENTRY', payload: id });
      } catch (error) {
        console.error('Failed to delete entry:', error);
        throw error;
      }
    }, [kbService]),

    rateEntry: useCallback(async (id: string, rating: boolean) => {
      try {
        await kbService.rateEntry(id, rating);
        // Update entry metrics locally
        const entry = state.entries.find(e => e.id === id);
        if (entry) {
          const updates = {
            usageCount: entry.usageCount + 1,
            successCount: rating ? entry.successCount + 1 : entry.successCount,
            failureCount: rating ? entry.failureCount : entry.failureCount + 1
          };
          dispatch({ type: 'UPDATE_ENTRY', payload: { id, updates } });
        }
      } catch (error) {
        console.error('Failed to rate entry:', error);
        throw error;
      }
    }, [kbService, state.entries]),

    setFilters: useCallback((filters: Partial<SearchFilters>) => {
      dispatch({ type: 'SET_FILTERS', payload: filters });
      // Re-run search with new filters if there's an active query
      if (state.searchQuery) {
        actions.search(state.searchQuery);
      }
    }, [state.searchQuery]),

    clearSearch: useCallback(() => {
      dispatch({ type: 'CLEAR_SEARCH' });
    }, []),

    loadMetrics: useCallback(async () => {
      try {
        const metrics = await kbService.getMetrics();
        dispatch({ type: 'SET_METRICS', payload: metrics });
      } catch (error) {
        console.error('Failed to load metrics:', error);
      }
    }, [kbService])
  };

  return (
    <KBStateContext.Provider value={{ state, actions }}>
      {children}
    </KBStateContext.Provider>
  );
};
```

---

## 2. Custom Hooks Implementation

### 2.1 Performance-Optimized Search Hook

```typescript
// hooks/useKBSearch.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { useKBState } from '../context/KnowledgeBaseContext';
import { useDebouncedCallback } from './useDebouncedCallback';

export const useKBSearch = () => {
  const { state, actions } = useKBState();
  const [localState, setLocalState] = useState({
    suggestions: [] as string[],
    isTyping: false,
    lastSearchTime: 0
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Debounced search with performance tracking
  const debouncedSearch = useDebouncedCallback(
    async (query: string) => {
      const startTime = performance.now();

      // Cancel previous search if still running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        await actions.search(query);

        const endTime = performance.now();
        const searchTime = endTime - startTime;

        setLocalState(prev => ({ ...prev, lastSearchTime: searchTime }));

        // Track performance metrics
        if (searchTime > 1000) {
          console.warn(`Slow search detected: ${searchTime}ms for query "${query}"`);
        }

      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error);
        }
      }
    },
    300 // 300ms debounce
  );

  const search = useCallback((query: string) => {
    setLocalState(prev => ({ ...prev, isTyping: true }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setLocalState(prev => ({ ...prev, isTyping: false }));
    }, 1000);

    debouncedSearch(query);
  }, [debouncedSearch]);

  const clearSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    actions.clearSearch();
    setLocalState({
      suggestions: [],
      isTyping: false,
      lastSearchTime: 0
    });
  }, [actions]);

  // Generate search suggestions based on recent searches and popular terms
  const getSuggestions = useCallback((partialQuery: string) => {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    const suggestions = [
      ...state.recentSearches.filter(search =>
        search.toLowerCase().includes(partialQuery.toLowerCase())
      ),
      // Add common error patterns
      'S0C7 data exception',
      'VSAM Status 35',
      'IEF212I dataset not found',
      'SQLCODE -904'
    ].filter(suggestion =>
      suggestion.toLowerCase().includes(partialQuery.toLowerCase())
    ).slice(0, 5);

    setLocalState(prev => ({ ...prev, suggestions }));
    return suggestions;
  }, [state.recentSearches]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    searchQuery: state.searchQuery,
    searchResults: state.searchResults,
    isSearching: state.isSearching || localState.isTyping,
    suggestions: localState.suggestions,
    lastSearchTime: localState.lastSearchTime,

    // Actions
    search,
    clearSearch,
    getSuggestions,

    // Computed values
    hasResults: state.searchResults.length > 0,
    isEmpty: !state.searchQuery && state.searchResults.length === 0,
    isPerformant: localState.lastSearchTime > 0 && localState.lastSearchTime < 1000
  };
};
```

### 2.2 Offline-First Data Hook

```typescript
// hooks/useOfflineFirst.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppState } from '../context/AppStateContext';

interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'ENTRY' | 'RATING' | 'METRICS';
  data: any;
  timestamp: number;
  retryCount: number;
}

export const useOfflineFirst = () => {
  const { state: appState, dispatch } = useAppState();
  const [syncQueue, setSyncQueue] = useState<SyncOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Add operation to sync queue
  const queueSync = useCallback((operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    const syncOp: SyncOperation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      ...operation
    };

    setSyncQueue(prev => [...prev, syncOp]);

    // If online, try to sync immediately
    if (!appState.isOffline) {
      processSyncQueue();
    }
  }, [appState.isOffline]);

  // Process sync queue
  const processSyncQueue = useCallback(async () => {
    if (isSyncing || syncQueue.length === 0 || appState.isOffline) {
      return;
    }

    setIsSyncing(true);
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });

    const remainingOps: SyncOperation[] = [];

    for (const operation of syncQueue) {
      try {
        await executeSync(operation);
        // Operation successful, don't add to remaining
        console.log(`Synced operation ${operation.id}`);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);

        // Retry with exponential backoff
        if (operation.retryCount < 3) {
          remainingOps.push({
            ...operation,
            retryCount: operation.retryCount + 1
          });
        } else {
          console.error(`Giving up on operation ${operation.id} after 3 retries`);
        }
      }
    }

    setSyncQueue(remainingOps);
    setIsSyncing(false);

    if (remainingOps.length > 0) {
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'reconnecting' });
    }
  }, [isSyncing, syncQueue, appState.isOffline, dispatch]);

  // Execute individual sync operation
  const executeSync = async (operation: SyncOperation): Promise<void> => {
    // Simulate API calls that would sync with server
    // In real implementation, these would be actual API calls

    switch (operation.entity) {
      case 'ENTRY':
        if (operation.type === 'CREATE') {
          await window.electronAPI?.syncCreateEntry(operation.data);
        } else if (operation.type === 'UPDATE') {
          await window.electronAPI?.syncUpdateEntry(operation.data.id, operation.data);
        } else if (operation.type === 'DELETE') {
          await window.electronAPI?.syncDeleteEntry(operation.data.id);
        }
        break;

      case 'RATING':
        await window.electronAPI?.syncRating(operation.data);
        break;

      case 'METRICS':
        await window.electronAPI?.syncMetrics(operation.data);
        break;
    }
  };

  // Setup automatic sync when coming online
  useEffect(() => {
    if (!appState.isOffline && syncQueue.length > 0) {
      // Delay sync slightly to ensure connection is stable
      const timer = setTimeout(processSyncQueue, 1000);
      return () => clearTimeout(timer);
    }
  }, [appState.isOffline, syncQueue.length, processSyncQueue]);

  // Setup periodic sync retry
  useEffect(() => {
    if (!appState.isOffline && syncQueue.length > 0) {
      syncIntervalRef.current = setInterval(() => {
        processSyncQueue();
      }, 30000); // Retry every 30 seconds
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [appState.isOffline, syncQueue.length, processSyncQueue]);

  // Clear sync queue (for testing/debugging)
  const clearSyncQueue = useCallback(() => {
    setSyncQueue([]);
  }, []);

  // Get sync status
  const getSyncStatus = useCallback(() => {
    if (appState.isOffline) {
      return {
        status: 'offline' as const,
        pendingOperations: syncQueue.length,
        message: `${syncQueue.length} operations queued for sync`
      };
    }

    if (isSyncing) {
      return {
        status: 'syncing' as const,
        pendingOperations: syncQueue.length,
        message: 'Syncing changes...'
      };
    }

    if (syncQueue.length > 0) {
      return {
        status: 'pending' as const,
        pendingOperations: syncQueue.length,
        message: `${syncQueue.length} operations pending`
      };
    }

    return {
      status: 'synced' as const,
      pendingOperations: 0,
      message: 'All changes synced'
    };
  }, [appState.isOffline, isSyncing, syncQueue.length]);

  return {
    // State
    isOffline: appState.isOffline,
    isSyncing,
    syncQueue,

    // Actions
    queueSync,
    processSyncQueue,
    clearSyncQueue,

    // Computed
    getSyncStatus: getSyncStatus(),
    hasPendingSync: syncQueue.length > 0
  };
};
```

---

## 3. Performance Optimizations

### 3.1 Memoization Strategies

```typescript
// hooks/useMemoizedResults.ts
import { useMemo } from 'react';
import { SearchResult, SearchFilters } from '../types';

export const useMemoizedResults = (
  results: SearchResult[],
  query: string,
  filters: SearchFilters
) => {
  // Memoize filtered and sorted results
  const processedResults = useMemo(() => {
    let filtered = results;

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(result => result.category === filters.category);
    }

    // Apply tag filters
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(result =>
        filters.tags.some(tag =>
          result.tags?.some(resultTag =>
            resultTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'relevance':
          return b.score - a.score;
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'success':
          return b.successRate - a.successRate;
        default:
          return b.score - a.score;
      }
    });

    return filtered;
  }, [results, filters]);

  // Memoize highlighted results
  const highlightedResults = useMemo(() => {
    if (!query.trim()) return processedResults;

    return processedResults.map(result => ({
      ...result,
      highlightedTitle: highlightSearchTerms(result.title, query),
      highlightedSummary: highlightSearchTerms(result.summary, query)
    }));
  }, [processedResults, query]);

  return highlightedResults;
};

// Utility function for highlighting search terms
const highlightSearchTerms = (text: string, query: string): string => {
  if (!query.trim()) return text;

  const terms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);
  let highlighted = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });

  return highlighted;
};

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
```

### 3.2 Debounced Callbacks

```typescript
// hooks/useDebouncedCallback.ts
import { useCallback, useRef } from 'react';

export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
};
```

---

## 4. Error Handling and Resilience

### 4.1 Error Boundary Integration

```typescript
// hooks/useErrorHandler.ts
import { useCallback } from 'react';
import { useAppState } from '../context/AppStateContext';

export const useErrorHandler = () => {
  const { dispatch } = useAppState();

  const handleError = useCallback((error: Error, context?: string) => {
    console.error(`Error in ${context || 'unknown context'}:`, error);

    dispatch({
      type: 'ADD_ERROR',
      payload: {
        id: Date.now().toString(),
        message: error.message,
        context,
        severity: 'error',
        timestamp: new Date(),
        stack: error.stack
      }
    });
  }, [dispatch]);

  const handleWarning = useCallback((message: string, context?: string) => {
    console.warn(`Warning in ${context || 'unknown context'}:`, message);

    dispatch({
      type: 'ADD_ERROR',
      payload: {
        id: Date.now().toString(),
        message,
        context,
        severity: 'warning',
        timestamp: new Date()
      }
    });
  }, [dispatch]);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, [dispatch]);

  return { handleError, handleWarning, clearErrors };
};
```

This state management implementation provides a solid foundation for the Mainframe KB Assistant, emphasizing performance, offline capability, and maintainability while avoiding the complexity of Redux.