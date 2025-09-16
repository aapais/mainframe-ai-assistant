/**
 * Knowledge Base Context
 * Manages KB entries, CRUD operations, and entry-specific state
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect } from 'react';
import { KBEntry, KBCategory } from '../../types/services';
import { useApp } from './AppContext';

// KB operation types
export type KBOperationType = 'create' | 'update' | 'delete' | 'rate';

// KB entry input for creation/updates
export interface KBEntryInput extends Omit<KBEntry, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'success_count' | 'failure_count'> {
  id?: string;
}

// KB state interface
export interface KBState {
  // Entry management
  entries: KBEntry[];
  selectedEntry: KBEntry | null;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  
  // Error states
  error?: string;
  operationError?: { operation: KBOperationType; message: string };
  
  // Categories and metadata
  categories: KBCategory[];
  totalEntries: number;
  
  // Filters and pagination
  filters: {
    category?: KBCategory;
    search?: string;
    tags?: string[];
  };
  currentPage: number;
  pageSize: number;
  
  // Recent operations tracking
  recentOperations: {
    type: KBOperationType;
    entryId: string;
    timestamp: Date;
    success: boolean;
  }[];
}

// Initial state
const initialState: KBState = {
  entries: [],
  selectedEntry: null,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  categories: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'],
  totalEntries: 0,
  filters: {},
  currentPage: 1,
  pageSize: 50,
  recentOperations: [],
};

// Action types
type KBAction =
  | { type: 'SET_ENTRIES'; payload: { entries: KBEntry[]; totalEntries: number } }
  | { type: 'ADD_ENTRY'; payload: KBEntry }
  | { type: 'UPDATE_ENTRY'; payload: KBEntry }
  | { type: 'DELETE_ENTRY'; payload: string }
  | { type: 'SELECT_ENTRY'; payload: KBEntry | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_DELETING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | undefined }
  | { type: 'SET_OPERATION_ERROR'; payload: { operation: KBOperationType; message: string } | undefined }
  | { type: 'SET_FILTERS'; payload: Partial<KBState['filters']> }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'ADD_RECENT_OPERATION'; payload: Omit<KBState['recentOperations'][0], 'timestamp'> }
  | { type: 'CLEAR_RECENT_OPERATIONS' };

// Reducer
function kbReducer(state: KBState, action: KBAction): KBState {
  switch (action.type) {
    case 'SET_ENTRIES':
      return {
        ...state,
        entries: action.payload.entries,
        totalEntries: action.payload.totalEntries,
        isLoading: false,
        error: undefined,
      };

    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [action.payload, ...state.entries],
        totalEntries: state.totalEntries + 1,
        isSaving: false,
        error: undefined,
      };

    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map(entry =>
          entry.id === action.payload.id ? action.payload : entry
        ),
        selectedEntry: state.selectedEntry?.id === action.payload.id ? action.payload : state.selectedEntry,
        isSaving: false,
        error: undefined,
      };

    case 'DELETE_ENTRY':
      return {
        ...state,
        entries: state.entries.filter(entry => entry.id !== action.payload),
        selectedEntry: state.selectedEntry?.id === action.payload ? null : state.selectedEntry,
        totalEntries: Math.max(0, state.totalEntries - 1),
        isDeleting: false,
        error: undefined,
      };

    case 'SELECT_ENTRY':
      return { ...state, selectedEntry: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_DELETING':
      return { ...state, isDeleting: action.payload };

    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload,
        isLoading: false,
        isSaving: false,
        isDeleting: false,
      };

    case 'SET_OPERATION_ERROR':
      return {
        ...state,
        operationError: action.payload,
        isSaving: false,
        isDeleting: false,
      };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
        currentPage: 1,
      };

    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };

    case 'ADD_RECENT_OPERATION':
      const operation = { ...action.payload, timestamp: new Date() };
      return {
        ...state,
        recentOperations: [operation, ...state.recentOperations.slice(0, 49)], // Keep last 50
      };

    case 'CLEAR_RECENT_OPERATIONS':
      return { ...state, recentOperations: [] };

    default:
      return state;
  }
}

// Context value interface
export interface KBContextValue {
  // State
  state: KBState;
  
  // Entry management
  loadEntries: (filters?: Partial<KBState['filters']>) => Promise<void>;
  addEntry: (entry: KBEntryInput) => Promise<KBEntry>;
  updateEntry: (id: string, updates: Partial<KBEntryInput>) => Promise<KBEntry>;
  deleteEntry: (id: string) => Promise<void>;
  
  // Entry selection
  selectEntry: (entry: KBEntry | null) => void;
  
  // Entry operations
  rateEntry: (id: string, successful: boolean, comment?: string) => Promise<void>;
  recordEntryView: (id: string) => Promise<void>;
  duplicateEntry: (id: string) => Promise<KBEntry>;
  
  // Filtering and pagination
  updateFilters: (filters: Partial<KBState['filters']>) => void;
  setPage: (page: number) => void;
  
  // Utility functions
  getEntryById: (id: string) => KBEntry | undefined;
  getEntriesByCategory: (category: KBCategory) => KBEntry[];
  getEntriesByTag: (tag: string) => KBEntry[];
  refreshEntries: () => Promise<void>;
  clearError: () => void;
}

// Create context
const KBContext = createContext<KBContextValue | null>(null);

// Provider component
export interface KBProviderProps {
  children: ReactNode;
  initialState?: Partial<KBState>;
}

export const KBProvider: React.FC<KBProviderProps> = ({
  children,
  initialState: providedInitialState,
}) => {
  const [state, dispatch] = useReducer(
    kbReducer,
    { ...initialState, ...providedInitialState }
  );
  
  const { addNotification, updateLastActivity } = useApp();

  // Load entries on mount
  useEffect(() => {
    loadEntries();
  }, []);

  // Entry management
  const loadEntries = useCallback(async (filters?: Partial<KBState['filters']>) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const searchFilters = { ...state.filters, ...filters };
      
      const response = window.electronAPI?.getKBEntries ? 
        await window.electronAPI.getKBEntries({
          category: searchFilters.category,
          search: searchFilters.search,
          tags: searchFilters.tags,
          page: state.currentPage,
          pageSize: state.pageSize,
        }) : { entries: [], total: 0 };

      dispatch({
        type: 'SET_ENTRIES',
        payload: {
          entries: response.entries || response,
          totalEntries: response.total || (response.entries || response).length,
        },
      });

    } catch (error) {
      console.error('Failed to load KB entries:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load entries',
      });
      
      addNotification({
        type: 'error',
        message: 'Failed to load knowledge base entries',
        duration: 5000,
      });
    }
  }, [state.filters, state.currentPage, state.pageSize, addNotification]);

  const addEntry = useCallback(async (entry: KBEntryInput): Promise<KBEntry> => {
    dispatch({ type: 'SET_SAVING', payload: true });
    
    try {
      const newEntry = window.electronAPI?.addKBEntry ?
        await window.electronAPI.addKBEntry(entry) :
        { ...entry, id: Date.now().toString(), created_at: new Date(), updated_at: new Date(), usage_count: 0, success_count: 0, failure_count: 0 } as KBEntry;

      dispatch({ type: 'ADD_ENTRY', payload: newEntry });
      dispatch({
        type: 'ADD_RECENT_OPERATION',
        payload: { type: 'create', entryId: newEntry.id, success: true },
      });

      addNotification({
        type: 'success',
        title: 'Entry Added',
        message: `"${entry.title}" has been added to the knowledge base`,
        duration: 3000,
      });

      updateLastActivity();
      return newEntry;

    } catch (error) {
      console.error('Failed to add KB entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add entry';
      
      dispatch({
        type: 'SET_OPERATION_ERROR',
        payload: { operation: 'create', message: errorMessage },
      });
      
      addNotification({
        type: 'error',
        title: 'Add Failed',
        message: errorMessage,
        duration: 5000,
      });

      throw error;
    }
  }, [addNotification, updateLastActivity]);

  const updateEntry = useCallback(async (id: string, updates: Partial<KBEntryInput>): Promise<KBEntry> => {
    dispatch({ type: 'SET_SAVING', payload: true });
    
    try {
      const updatedEntry = window.electronAPI?.updateKBEntry ?
        await window.electronAPI.updateKBEntry(id, updates) :
        { ...state.entries.find(e => e.id === id), ...updates, updated_at: new Date() } as KBEntry;

      dispatch({ type: 'UPDATE_ENTRY', payload: updatedEntry });
      dispatch({
        type: 'ADD_RECENT_OPERATION',
        payload: { type: 'update', entryId: id, success: true },
      });

      addNotification({
        type: 'success',
        title: 'Entry Updated',
        message: `Knowledge base entry has been updated`,
        duration: 3000,
      });

      updateLastActivity();
      return updatedEntry;

    } catch (error) {
      console.error('Failed to update KB entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update entry';
      
      dispatch({
        type: 'SET_OPERATION_ERROR',
        payload: { operation: 'update', message: errorMessage },
      });
      
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: errorMessage,
        duration: 5000,
      });

      throw error;
    }
  }, [state.entries, addNotification, updateLastActivity]);

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'SET_DELETING', payload: true });
    
    try {
      const entry = state.entries.find(e => e.id === id);
      
      if (window.electronAPI?.deleteKBEntry) {
        await window.electronAPI.deleteKBEntry(id);
      }

      dispatch({ type: 'DELETE_ENTRY', payload: id });
      dispatch({
        type: 'ADD_RECENT_OPERATION',
        payload: { type: 'delete', entryId: id, success: true },
      });

      addNotification({
        type: 'success',
        title: 'Entry Deleted',
        message: `"${entry?.title || 'Entry'}" has been deleted`,
        duration: 3000,
        actions: [{
          label: 'Undo',
          action: async () => {
            if (entry) {
              try {
                await addEntry(entry);
              } catch (error) {
                addNotification({
                  type: 'error',
                  message: 'Failed to restore deleted entry',
                  duration: 5000,
                });
              }
            }
          },
        }],
      });

      updateLastActivity();

    } catch (error) {
      console.error('Failed to delete KB entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete entry';
      
      dispatch({
        type: 'SET_OPERATION_ERROR',
        payload: { operation: 'delete', message: errorMessage },
      });
      
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: errorMessage,
        duration: 5000,
      });

      throw error;
    }
  }, [state.entries, addEntry, addNotification, updateLastActivity]);

  // Entry selection
  const selectEntry = useCallback((entry: KBEntry | null) => {
    dispatch({ type: 'SELECT_ENTRY', payload: entry });
    if (entry) {
      recordEntryView(entry.id);
    }
  }, []);

  // Entry operations
  const rateEntry = useCallback(async (id: string, successful: boolean, comment?: string): Promise<void> => {
    try {
      if (window.electronAPI?.rateKBEntry) {
        await window.electronAPI.rateKBEntry(id, successful, comment);
      }

      // Update the entry in state
      const entry = state.entries.find(e => e.id === id);
      if (entry) {
        const updatedEntry = {
          ...entry,
          usage_count: entry.usage_count + 1,
          success_count: entry.success_count + (successful ? 1 : 0),
          failure_count: entry.failure_count + (successful ? 0 : 1),
        };
        dispatch({ type: 'UPDATE_ENTRY', payload: updatedEntry });
      }

      dispatch({
        type: 'ADD_RECENT_OPERATION',
        payload: { type: 'rate', entryId: id, success: true },
      });

      addNotification({
        type: 'success',
        message: `Feedback recorded: ${successful ? 'Helpful' : 'Not helpful'}`,
        duration: 2000,
      });

      updateLastActivity();

    } catch (error) {
      console.error('Failed to rate KB entry:', error);
      addNotification({
        type: 'error',
        message: 'Failed to record feedback',
        duration: 3000,
      });
    }
  }, [state.entries, addNotification, updateLastActivity]);

  const recordEntryView = useCallback(async (id: string): Promise<void> => {
    try {
      if (window.electronAPI?.recordEntryView) {
        await window.electronAPI.recordEntryView(id);
      }

      // Update usage count in state
      const entry = state.entries.find(e => e.id === id);
      if (entry) {
        const updatedEntry = {
          ...entry,
          usage_count: entry.usage_count + 1,
        };
        dispatch({ type: 'UPDATE_ENTRY', payload: updatedEntry });
      }

    } catch (error) {
      console.warn('Failed to record entry view:', error);
    }
  }, [state.entries]);

  const duplicateEntry = useCallback(async (id: string): Promise<KBEntry> => {
    const originalEntry = state.entries.find(e => e.id === id);
    if (!originalEntry) {
      throw new Error('Entry not found');
    }

    const duplicateData: KBEntryInput = {
      ...originalEntry,
      title: `${originalEntry.title} (Copy)`,
    };

    return addEntry(duplicateData);
  }, [state.entries, addEntry]);

  // Filtering and pagination
  const updateFilters = useCallback((filters: Partial<KBState['filters']>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
    updateLastActivity();
  }, [updateLastActivity]);

  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  // Utility functions
  const getEntryById = useCallback((id: string): KBEntry | undefined => {
    return state.entries.find(entry => entry.id === id);
  }, [state.entries]);

  const getEntriesByCategory = useCallback((category: KBCategory): KBEntry[] => {
    return state.entries.filter(entry => entry.category === category);
  }, [state.entries]);

  const getEntriesByTag = useCallback((tag: string): KBEntry[] => {
    return state.entries.filter(entry => 
      entry.tags && entry.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
    );
  }, [state.entries]);

  const refreshEntries = useCallback(async (): Promise<void> => {
    await loadEntries(state.filters);
  }, [loadEntries, state.filters]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: undefined });
    dispatch({ type: 'SET_OPERATION_ERROR', payload: undefined });
  }, []);

  // Context value
  const contextValue: KBContextValue = {
    state,
    loadEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    selectEntry,
    rateEntry,
    recordEntryView,
    duplicateEntry,
    updateFilters,
    setPage,
    getEntryById,
    getEntriesByCategory,
    getEntriesByTag,
    refreshEntries,
    clearError,
  };

  return (
    <KBContext.Provider value={contextValue}>
      {children}
    </KBContext.Provider>
  );
};

// Hook to use the context
export const useKB = (): KBContextValue => {
  const context = useContext(KBContext);
  if (!context) {
    throw new Error('useKB must be used within a KBProvider');
  }
  return context;
};

// Convenience hooks for specific parts of the KB state
export const useKBEntries = () => {
  const { state, loadEntries, refreshEntries } = useKB();
  return {
    entries: state.entries,
    totalEntries: state.totalEntries,
    isLoading: state.isLoading,
    loadEntries,
    refreshEntries,
  };
};

export const useKBOperations = () => {
  const { addEntry, updateEntry, deleteEntry, rateEntry, duplicateEntry } = useKB();
  return {
    addEntry,
    updateEntry,
    deleteEntry,
    rateEntry,
    duplicateEntry,
  };
};

export const useSelectedEntry = () => {
  const { state, selectEntry, recordEntryView } = useKB();
  return {
    selectedEntry: state.selectedEntry,
    selectEntry,
    recordEntryView,
  };
};

export const useKBFilters = () => {
  const { state, updateFilters, setPage } = useKB();
  return {
    filters: state.filters,
    currentPage: state.currentPage,
    pageSize: state.pageSize,
    updateFilters,
    setPage,
  };
};

export default KBContext;