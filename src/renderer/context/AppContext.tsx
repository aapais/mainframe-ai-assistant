import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect } from 'react';
import { AppState, SearchResult, KBEntry, Notification, KBCategory, SearchQuery } from '../../types';

// =====================================
// State Management Types
// =====================================

interface AppContextState extends AppState {
  searchQuery: string;
  categoryFilter?: KBCategory;
  useAI: boolean;
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_VIEW'; payload: AppState['currentView'] }
  | { type: 'SET_SEARCH_RESULTS'; payload: SearchResult[] }
  | { type: 'SET_SELECTED_ENTRY'; payload: KBEntry | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_CATEGORY_FILTER'; payload: KBCategory | undefined }
  | { type: 'SET_USE_AI'; payload: boolean }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'UPDATE_ENTRY_USAGE'; payload: { entryId: string; successful: boolean } };

interface AppContextValue {
  state: AppContextState;
  // Search actions
  performSearch: (query: string, options?: Partial<SearchQuery>) => Promise<void>;
  clearSearch: () => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category?: KBCategory) => void;
  setUseAI: (enabled: boolean) => void;
  // Entry actions
  selectEntry: (entry: KBEntry | null) => void;
  rateEntry: (entryId: string, successful: boolean, comment?: string) => Promise<void>;
  // Navigation
  setCurrentView: (view: AppState['currentView']) => void;
  // Notifications
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  // Loading states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// =====================================
// Context Creation
// =====================================

const AppContext = createContext<AppContextValue | undefined>(undefined);

// =====================================
// Reducer Function
// =====================================

const appReducer = (state: AppContextState, action: AppAction): AppContextState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_CURRENT_VIEW':
      return { ...state, currentView: action.payload };

    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };

    case 'SET_SELECTED_ENTRY':
      return { ...state, selectedEntry: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_CATEGORY_FILTER':
      return { ...state, categoryFilter: action.payload };

    case 'SET_USE_AI':
      return { ...state, useAI: action.payload };

    case 'ADD_NOTIFICATION': {
      const newNotifications = [...state.notifications, action.payload];
      // Keep only the last 10 notifications
      return {
        ...state,
        notifications: newNotifications.slice(-10)
      };
    }

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };

    case 'UPDATE_ENTRY_USAGE': {
      const { entryId, successful } = action.payload;
      return {
        ...state,
        searchResults: state.searchResults.map(result => {
          if (result.entry.id === entryId) {
            return {
              ...result,
              entry: {
                ...result.entry,
                usage_count: result.entry.usage_count + 1,
                success_count: result.entry.success_count + (successful ? 1 : 0),
                failure_count: result.entry.failure_count + (successful ? 0 : 1)
              }
            };
          }
          return result;
        }),
        selectedEntry: state.selectedEntry?.id === entryId ? {
          ...state.selectedEntry,
          usage_count: state.selectedEntry.usage_count + 1,
          success_count: state.selectedEntry.success_count + (successful ? 1 : 0),
          failure_count: state.selectedEntry.failure_count + (successful ? 0 : 1)
        } : state.selectedEntry
      };
    }

    default:
      return state;
  }
};

// =====================================
// Initial State
// =====================================

const initialState: AppContextState = {
  currentView: 'search',
  searchResults: [],
  selectedEntry: null,
  isLoading: false,
  error: null,
  notifications: [],
  searchQuery: '',
  categoryFilter: undefined,
  useAI: true
};

// =====================================
// Provider Component
// =====================================

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // =====================================
  // Search Actions
  // =====================================

  const performSearch = useCallback(async (
    query: string, 
    options: Partial<SearchQuery> = {}
  ) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const searchOptions: SearchQuery = {
        query: query.trim(),
        category: options.category || state.categoryFilter,
        useAI: options.useAI !== undefined ? options.useAI : state.useAI,
        limit: options.limit || 50,
        offset: options.offset || 0
      };

      let results: SearchResult[] = [];

      // Try AI search first if enabled
      if (searchOptions.useAI && query.trim() && window.electronAPI?.searchWithAI) {
        try {
          results = await window.electronAPI.searchWithAI(searchOptions.query, searchOptions);
        } catch (aiError) {
          console.warn('AI search failed, falling back to local search:', aiError);
          
          // Fallback to local search
          if (window.electronAPI?.searchLocal) {
            results = await window.electronAPI.searchLocal(searchOptions.query, searchOptions);
          }

          addNotification({
            type: 'warning',
            message: 'AI search unavailable, using local search',
            duration: 3000
          });
        }
      } else if (window.electronAPI?.searchLocal) {
        // Use local search
        results = await window.electronAPI.searchLocal(searchOptions.query, searchOptions);
      }

      dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
      dispatch({ type: 'SET_CURRENT_VIEW', payload: 'search' });

      // Show notification if no results found
      if (results.length === 0 && query.trim()) {
        addNotification({
          type: 'info',
          message: `No results found for "${query.trim()}"`,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Search failed. Please try again.' });
      
      addNotification({
        type: 'error',
        message: 'Search failed. Please check your connection and try again.',
        duration: 5000
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.categoryFilter, state.useAI]);

  const clearSearch = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    dispatch({ type: 'SET_CATEGORY_FILTER', payload: undefined });
    dispatch({ type: 'SET_SEARCH_RESULTS', payload: [] });
    dispatch({ type: 'SET_SELECTED_ENTRY', payload: null });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);

  const setCategoryFilter = useCallback((category?: KBCategory) => {
    dispatch({ type: 'SET_CATEGORY_FILTER', payload: category });
  }, []);

  const setUseAI = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_USE_AI', payload: enabled });
  }, []);

  // =====================================
  // Entry Actions
  // =====================================

  const selectEntry = useCallback((entry: KBEntry | null) => {
    dispatch({ type: 'SET_SELECTED_ENTRY', payload: entry });
    
    // Record entry view
    if (entry && window.electronAPI?.recordEntryView) {
      window.electronAPI.recordEntryView(entry.id).catch(console.error);
    }
  }, []);

  const rateEntry = useCallback(async (entryId: string, successful: boolean, comment?: string) => {
    try {
      await window.electronAPI?.rateEntry?.(entryId, successful, comment);
      
      // Update local state
      dispatch({ type: 'UPDATE_ENTRY_USAGE', payload: { entryId, successful } });

      addNotification({
        type: 'success',
        message: `Feedback recorded: ${successful ? 'Helpful' : 'Not helpful'}`,
        duration: 2000
      });
    } catch (error) {
      console.error('Failed to rate entry:', error);
      addNotification({
        type: 'error',
        message: 'Failed to record feedback. Please try again.',
        duration: 5000
      });
    }
  }, []);

  // =====================================
  // Navigation Actions
  // =====================================

  const setCurrentView = useCallback((view: AppState['currentView']) => {
    dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
  }, []);

  // =====================================
  // Notification Actions
  // =====================================

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = { ...notification, id };
    
    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });

    // Auto-remove notification
    if (notification.duration) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
      }, notification.duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, []);

  // =====================================
  // Loading State Actions
  // =====================================

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  // =====================================
  // Load initial data
  // =====================================

  useEffect(() => {
    const loadInitialData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // Load recent entries
        const results = await window.electronAPI?.getKBEntries?.({
          query: '',
          limit: 20
        }) || [];
        
        dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
      } catch (error) {
        console.error('Failed to load initial data:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load knowledge base entries' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadInitialData();
  }, []);

  // =====================================
  // Context Value
  // =====================================

  const contextValue: AppContextValue = {
    state,
    // Search actions
    performSearch,
    clearSearch,
    setSearchQuery,
    setCategoryFilter,
    setUseAI,
    // Entry actions
    selectEntry,
    rateEntry,
    // Navigation
    setCurrentView,
    // Notifications
    addNotification,
    removeNotification,
    clearNotifications,
    // Loading states
    setLoading,
    setError
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// =====================================
// Hook for using context
// =====================================

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// =====================================
// Hook for specific parts of state
// =====================================

export const useAppState = () => {
  const { state } = useApp();
  return state;
};

export const useSearch = () => {
  const { 
    state, 
    performSearch, 
    clearSearch, 
    setSearchQuery, 
    setCategoryFilter, 
    setUseAI 
  } = useApp();
  
  return {
    searchQuery: state.searchQuery,
    categoryFilter: state.categoryFilter,
    useAI: state.useAI,
    searchResults: state.searchResults,
    isLoading: state.isLoading,
    error: state.error,
    performSearch,
    clearSearch,
    setSearchQuery,
    setCategoryFilter,
    setUseAI
  };
};

export const useNotifications = () => {
  const { 
    state, 
    addNotification, 
    removeNotification, 
    clearNotifications 
  } = useApp();
  
  return {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearNotifications
  };
};

export default AppContext;