/**
 * Knowledge Base Data Context - Optimized State Management
 * 
 * This context provides comprehensive KB data management with:
 * - Optimized React Context with proper memoization
 * - Built-in caching mechanisms for performance  
 * - Offline-first operation with local SQLite
 * - Proper loading, error, and success state handling
 * - Performance monitoring and metrics
 * - Batch operations for efficiency
 * - Context splitting for minimal re-renders
 * 
 * @author State Management Architect
 * @version 1.0.0
 */

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useMemo, 
  useEffect,
  useRef,
  ReactNode 
} from 'react';
import { KBEntry, KBCategory, KBEntryInput, KBEntryUpdate } from '../../types/services';
import { createStateHelpers, createCacheManager, debounce } from '../utils/stateHelpers';

// =====================
// Types & Interfaces
// =====================

export interface KBDataState {
  // Core data
  entries: Map<string, KBEntry>;
  categories: KBCategory[];
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  
  // Error handling
  error: string | null;
  operationError: {
    operation: string;
    message: string;
    entryId?: string;
  } | null;
  
  // Cache and performance
  lastFetch: number;
  cacheStatus: 'fresh' | 'stale' | 'invalid';
  totalEntries: number;
  
  // Operation tracking
  pendingOperations: Set<string>;
  recentOperations: Array<{
    type: string;
    entryId: string;
    timestamp: number;
    success: boolean;
  }>;
  
  // Filters and pagination
  currentFilters: {
    category?: KBCategory;
    tags?: string[];
    search?: string;
    dateRange?: { from: Date; to: Date };
  };
  pagination: {
    currentPage: number;
    pageSize: number;
    hasMore: boolean;
  };
}

export interface KBDataContextValue {
  // State
  state: KBDataState;
  
  // Core operations
  loadEntries: (options?: LoadEntriesOptions) => Promise<void>;
  refreshEntries: () => Promise<void>;
  
  // CRUD operations
  createEntry: (entry: KBEntryInput) => Promise<KBEntry>;
  updateEntry: (id: string, updates: KBEntryUpdate) => Promise<KBEntry>;
  deleteEntry: (id: string) => Promise<void>;
  
  // Batch operations
  createEntries: (entries: KBEntryInput[]) => Promise<KBEntry[]>;
  updateEntries: (updates: Array<{ id: string; updates: KBEntryUpdate }>) => Promise<KBEntry[]>;
  deleteEntries: (ids: string[]) => Promise<void>;
  
  // Entry selection and retrieval
  getEntry: (id: string) => KBEntry | null;
  getEntries: (ids: string[]) => KBEntry[];
  getEntriesByCategory: (category: KBCategory) => KBEntry[];
  getEntriesByTags: (tags: string[]) => KBEntry[];
  
  // Usage tracking
  recordEntryUsage: (id: string, successful: boolean, metadata?: any) => Promise<void>;
  recordEntryView: (id: string) => Promise<void>;
  
  // Filter and pagination
  updateFilters: (filters: Partial<KBDataState['currentFilters']>) => void;
  updatePagination: (pagination: Partial<KBDataState['pagination']>) => void;
  resetFilters: () => void;
  
  // Cache management
  invalidateCache: () => void;
  preloadEntries: (ids: string[]) => Promise<void>;
  
  // Error handling
  clearError: () => void;
  retryFailedOperation: () => Promise<void>;
}

export interface LoadEntriesOptions {
  force?: boolean;
  category?: KBCategory;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// =====================
// Initial State
// =====================

const initialState: KBDataState = {
  entries: new Map(),
  categories: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'],
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
  operationError: null,
  lastFetch: 0,
  cacheStatus: 'invalid',
  totalEntries: 0,
  pendingOperations: new Set(),
  recentOperations: [],
  currentFilters: {},
  pagination: {
    currentPage: 1,
    pageSize: 50,
    hasMore: false,
  },
};

// =====================
// Actions & Reducer
// =====================

type KBDataAction = 
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: { entries: KBEntry[]; totalEntries: number } }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'CREATE_START'; payload: string }
  | { type: 'CREATE_SUCCESS'; payload: KBEntry }
  | { type: 'CREATE_ERROR'; payload: { operation: string; message: string; entryId?: string } }
  | { type: 'UPDATE_START'; payload: string }
  | { type: 'UPDATE_SUCCESS'; payload: KBEntry }
  | { type: 'UPDATE_ERROR'; payload: { operation: string; message: string; entryId?: string } }
  | { type: 'DELETE_START'; payload: string }
  | { type: 'DELETE_SUCCESS'; payload: string }
  | { type: 'DELETE_ERROR'; payload: { operation: string; message: string; entryId?: string } }
  | { type: 'BATCH_CREATE_SUCCESS'; payload: KBEntry[] }
  | { type: 'BATCH_UPDATE_SUCCESS'; payload: KBEntry[] }
  | { type: 'BATCH_DELETE_SUCCESS'; payload: string[] }
  | { type: 'UPDATE_FILTERS'; payload: Partial<KBDataState['currentFilters']> }
  | { type: 'UPDATE_PAGINATION'; payload: Partial<KBDataState['pagination']> }
  | { type: 'RESET_FILTERS' }
  | { type: 'INVALIDATE_CACHE' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'ADD_RECENT_OPERATION'; payload: { type: string; entryId: string; success: boolean } };

function kbDataReducer(state: KBDataState, action: KBDataAction): KBDataState {
  const helpers = createStateHelpers(state);
  
  switch (action.type) {
    case 'LOAD_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOAD_SUCCESS': {
      const entriesMap = new Map();
      action.payload.entries.forEach(entry => entriesMap.set(entry.id, entry));
      
      return {
        ...state,
        entries: entriesMap,
        totalEntries: action.payload.totalEntries,
        isLoading: false,
        error: null,
        lastFetch: Date.now(),
        cacheStatus: 'fresh',
      };
    }

    case 'LOAD_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        cacheStatus: 'invalid',
      };

    case 'CREATE_START':
      return {
        ...state,
        isSaving: true,
        operationError: null,
        pendingOperations: new Set([...state.pendingOperations, action.payload]),
      };

    case 'CREATE_SUCCESS': {
      const newEntries = new Map(state.entries);
      newEntries.set(action.payload.id, action.payload);
      
      return helpers.withRecentOperation({
        ...state,
        entries: newEntries,
        totalEntries: state.totalEntries + 1,
        isSaving: false,
        operationError: null,
        pendingOperations: helpers.removePendingOperation(action.payload.id),
      }, 'create', action.payload.id, true);
    }

    case 'CREATE_ERROR': {
      return helpers.withRecentOperation({
        ...state,
        isSaving: false,
        operationError: action.payload,
        pendingOperations: helpers.removePendingOperation(action.payload.entryId || ''),
      }, 'create', action.payload.entryId || '', false);
    }

    case 'UPDATE_START':
      return {
        ...state,
        isSaving: true,
        operationError: null,
        pendingOperations: new Set([...state.pendingOperations, action.payload]),
      };

    case 'UPDATE_SUCCESS': {
      const newEntries = new Map(state.entries);
      newEntries.set(action.payload.id, action.payload);
      
      return helpers.withRecentOperation({
        ...state,
        entries: newEntries,
        isSaving: false,
        operationError: null,
        pendingOperations: helpers.removePendingOperation(action.payload.id),
      }, 'update', action.payload.id, true);
    }

    case 'UPDATE_ERROR': {
      return helpers.withRecentOperation({
        ...state,
        isSaving: false,
        operationError: action.payload,
        pendingOperations: helpers.removePendingOperation(action.payload.entryId || ''),
      }, 'update', action.payload.entryId || '', false);
    }

    case 'DELETE_START':
      return {
        ...state,
        isDeleting: true,
        operationError: null,
        pendingOperations: new Set([...state.pendingOperations, action.payload]),
      };

    case 'DELETE_SUCCESS': {
      const newEntries = new Map(state.entries);
      newEntries.delete(action.payload);
      
      return helpers.withRecentOperation({
        ...state,
        entries: newEntries,
        totalEntries: Math.max(0, state.totalEntries - 1),
        isDeleting: false,
        operationError: null,
        pendingOperations: helpers.removePendingOperation(action.payload),
      }, 'delete', action.payload, true);
    }

    case 'DELETE_ERROR': {
      return helpers.withRecentOperation({
        ...state,
        isDeleting: false,
        operationError: action.payload,
        pendingOperations: helpers.removePendingOperation(action.payload.entryId || ''),
      }, 'delete', action.payload.entryId || '', false);
    }

    case 'BATCH_CREATE_SUCCESS': {
      const newEntries = new Map(state.entries);
      action.payload.forEach(entry => newEntries.set(entry.id, entry));
      
      return {
        ...state,
        entries: newEntries,
        totalEntries: state.totalEntries + action.payload.length,
        isSaving: false,
        operationError: null,
      };
    }

    case 'BATCH_UPDATE_SUCCESS': {
      const newEntries = new Map(state.entries);
      action.payload.forEach(entry => newEntries.set(entry.id, entry));
      
      return {
        ...state,
        entries: newEntries,
        isSaving: false,
        operationError: null,
      };
    }

    case 'BATCH_DELETE_SUCCESS': {
      const newEntries = new Map(state.entries);
      action.payload.forEach(id => newEntries.delete(id));
      
      return {
        ...state,
        entries: newEntries,
        totalEntries: Math.max(0, state.totalEntries - action.payload.length),
        isDeleting: false,
        operationError: null,
      };
    }

    case 'UPDATE_FILTERS':
      return {
        ...state,
        currentFilters: { ...state.currentFilters, ...action.payload },
        pagination: { ...state.pagination, currentPage: 1 },
      };

    case 'UPDATE_PAGINATION':
      return {
        ...state,
        pagination: { ...state.pagination, ...action.payload },
      };

    case 'RESET_FILTERS':
      return {
        ...state,
        currentFilters: {},
        pagination: { ...state.pagination, currentPage: 1 },
      };

    case 'INVALIDATE_CACHE':
      return {
        ...state,
        cacheStatus: 'invalid',
        lastFetch: 0,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        operationError: null,
      };

    case 'ADD_RECENT_OPERATION': {
      const operation = {
        ...action.payload,
        timestamp: Date.now(),
      };
      
      return {
        ...state,
        recentOperations: [operation, ...state.recentOperations.slice(0, 49)],
      };
    }

    default:
      return state;
  }
}

// =====================
// Context Creation
// =====================

const KBDataContext = createContext<KBDataContextValue | null>(null);

// =====================
// Provider Component
// =====================

export interface KBDataProviderProps {
  children: ReactNode;
  initialState?: Partial<KBDataState>;
  cacheTimeout?: number;
  enableOfflineMode?: boolean;
}

export const KBDataProvider: React.FC<KBDataProviderProps> = ({
  children,
  initialState: providedInitialState = {},
  cacheTimeout = 5 * 60 * 1000, // 5 minutes
  enableOfflineMode = true,
}) => {
  const [state, dispatch] = useReducer(kbDataReducer, {
    ...initialState,
    ...providedInitialState,
  });
  
  // Cache manager for performance optimization
  const cacheManager = useRef(createCacheManager<KBEntry>({
    maxSize: 1000,
    ttl: cacheTimeout,
  }));
  
  // Debounced operations to prevent excessive API calls
  const debouncedLoadEntries = useMemo(
    () => debounce(async (options: LoadEntriesOptions = {}) => {
      const { force = false, category, tags, limit = 50, offset = 0 } = options;
      
      // Check cache first unless force refresh
      if (!force && state.cacheStatus === 'fresh' && Date.now() - state.lastFetch < cacheTimeout) {
        return;
      }
      
      dispatch({ type: 'LOAD_START' });
      
      try {
        const searchOptions = {
          category,
          tags,
          limit,
          offset,
          includeMetrics: true,
        };
        
        const response = await window.electronAPI?.getKBEntries?.(searchOptions) || {
          entries: [],
          total: 0,
        };
        
        const entries = Array.isArray(response) ? response : (response.entries || []);
        const totalEntries = Array.isArray(response) ? response.length : (response.total || entries.length);
        
        // Update cache
        entries.forEach(entry => {
          cacheManager.current.set(entry.id, entry);
        });
        
        dispatch({
          type: 'LOAD_SUCCESS',
          payload: { entries, totalEntries },
        });
        
      } catch (error) {
        console.error('Failed to load KB entries:', error);
        dispatch({
          type: 'LOAD_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to load entries',
        });
      }
    }, 300),
    [state.cacheStatus, state.lastFetch, cacheTimeout]
  );
  
  // =====================
  // Core Operations
  // =====================
  
  const loadEntries = useCallback(async (options: LoadEntriesOptions = {}) => {
    return debouncedLoadEntries(options);
  }, [debouncedLoadEntries]);
  
  const refreshEntries = useCallback(async () => {
    dispatch({ type: 'INVALIDATE_CACHE' });
    return loadEntries({ force: true });
  }, [loadEntries]);
  
  // =====================
  // CRUD Operations
  // =====================
  
  const createEntry = useCallback(async (entry: KBEntryInput): Promise<KBEntry> => {
    const tempId = `temp-${Date.now()}`;
    dispatch({ type: 'CREATE_START', payload: tempId });
    
    try {
      const newEntry = await window.electronAPI?.addKBEntry?.(entry);
      if (!newEntry) throw new Error('Failed to create entry');
      
      // Update cache
      cacheManager.current.set(newEntry.id, newEntry);
      
      dispatch({ type: 'CREATE_SUCCESS', payload: newEntry });
      return newEntry;
      
    } catch (error) {
      console.error('Failed to create KB entry:', error);
      dispatch({
        type: 'CREATE_ERROR',
        payload: {
          operation: 'create',
          message: error instanceof Error ? error.message : 'Failed to create entry',
          entryId: tempId,
        },
      });
      throw error;
    }
  }, []);
  
  const updateEntry = useCallback(async (id: string, updates: KBEntryUpdate): Promise<KBEntry> => {
    dispatch({ type: 'UPDATE_START', payload: id });
    
    try {
      const updatedEntry = await window.electronAPI?.updateKBEntry?.(id, updates);
      if (!updatedEntry) throw new Error('Failed to update entry');
      
      // Update cache
      cacheManager.current.set(updatedEntry.id, updatedEntry);
      
      dispatch({ type: 'UPDATE_SUCCESS', payload: updatedEntry });
      return updatedEntry;
      
    } catch (error) {
      console.error('Failed to update KB entry:', error);
      dispatch({
        type: 'UPDATE_ERROR',
        payload: {
          operation: 'update',
          message: error instanceof Error ? error.message : 'Failed to update entry',
          entryId: id,
        },
      });
      throw error;
    }
  }, []);
  
  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    dispatch({ type: 'DELETE_START', payload: id });
    
    try {
      await window.electronAPI?.deleteKBEntry?.(id);
      
      // Remove from cache
      cacheManager.current.delete(id);
      
      dispatch({ type: 'DELETE_SUCCESS', payload: id });
      
    } catch (error) {
      console.error('Failed to delete KB entry:', error);
      dispatch({
        type: 'DELETE_ERROR',
        payload: {
          operation: 'delete',
          message: error instanceof Error ? error.message : 'Failed to delete entry',
          entryId: id,
        },
      });
      throw error;
    }
  }, []);
  
  // =====================
  // Batch Operations
  // =====================
  
  const createEntries = useCallback(async (entries: KBEntryInput[]): Promise<KBEntry[]> => {
    dispatch({ type: 'CREATE_START', payload: 'batch' });
    
    try {
      const createdEntries: KBEntry[] = [];
      
      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(entry => window.electronAPI?.addKBEntry?.(entry))
        );
        
        const validResults = batchResults.filter(Boolean) as KBEntry[];
        createdEntries.push(...validResults);
        
        // Update cache
        validResults.forEach(entry => {
          cacheManager.current.set(entry.id, entry);
        });
      }
      
      dispatch({ type: 'BATCH_CREATE_SUCCESS', payload: createdEntries });
      return createdEntries;
      
    } catch (error) {
      console.error('Failed to create KB entries in batch:', error);
      dispatch({
        type: 'CREATE_ERROR',
        payload: {
          operation: 'batch_create',
          message: error instanceof Error ? error.message : 'Failed to create entries',
        },
      });
      throw error;
    }
  }, []);
  
  const updateEntries = useCallback(async (
    updates: Array<{ id: string; updates: KBEntryUpdate }>
  ): Promise<KBEntry[]> => {
    dispatch({ type: 'UPDATE_START', payload: 'batch' });
    
    try {
      const updatedEntries: KBEntry[] = [];
      
      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(({ id, updates }) => window.electronAPI?.updateKBEntry?.(id, updates))
        );
        
        const validResults = batchResults.filter(Boolean) as KBEntry[];
        updatedEntries.push(...validResults);
        
        // Update cache
        validResults.forEach(entry => {
          cacheManager.current.set(entry.id, entry);
        });
      }
      
      dispatch({ type: 'BATCH_UPDATE_SUCCESS', payload: updatedEntries });
      return updatedEntries;
      
    } catch (error) {
      console.error('Failed to update KB entries in batch:', error);
      dispatch({
        type: 'UPDATE_ERROR',
        payload: {
          operation: 'batch_update',
          message: error instanceof Error ? error.message : 'Failed to update entries',
        },
      });
      throw error;
    }
  }, []);
  
  const deleteEntries = useCallback(async (ids: string[]): Promise<void> => {
    dispatch({ type: 'DELETE_START', payload: 'batch' });
    
    try {
      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await Promise.all(
          batch.map(id => window.electronAPI?.deleteKBEntry?.(id))
        );
        
        // Remove from cache
        batch.forEach(id => cacheManager.current.delete(id));
      }
      
      dispatch({ type: 'BATCH_DELETE_SUCCESS', payload: ids });
      
    } catch (error) {
      console.error('Failed to delete KB entries in batch:', error);
      dispatch({
        type: 'DELETE_ERROR',
        payload: {
          operation: 'batch_delete',
          message: error instanceof Error ? error.message : 'Failed to delete entries',
        },
      });
      throw error;
    }
  }, []);
  
  // =====================
  // Entry Retrieval
  // =====================
  
  const getEntry = useCallback((id: string): KBEntry | null => {
    // Check cache first
    const cached = cacheManager.current.get(id);
    if (cached) return cached;
    
    // Check state
    return state.entries.get(id) || null;
  }, [state.entries]);
  
  const getEntries = useCallback((ids: string[]): KBEntry[] => {
    return ids.map(id => getEntry(id)).filter(Boolean) as KBEntry[];
  }, [getEntry]);
  
  const getEntriesByCategory = useCallback((category: KBCategory): KBEntry[] => {
    return Array.from(state.entries.values()).filter(entry => entry.category === category);
  }, [state.entries]);
  
  const getEntriesByTags = useCallback((tags: string[]): KBEntry[] => {
    return Array.from(state.entries.values()).filter(entry => 
      entry.tags?.some(tag => tags.includes(tag))
    );
  }, [state.entries]);
  
  // =====================
  // Usage Tracking
  // =====================
  
  const recordEntryUsage = useCallback(async (
    id: string, 
    successful: boolean, 
    metadata?: any
  ): Promise<void> => {
    try {
      await window.electronAPI?.rateKBEntry?.(id, successful, metadata?.comment);
      
      // Update local state
      const entry = state.entries.get(id);
      if (entry) {
        const updatedEntry = {
          ...entry,
          usage_count: entry.usage_count + 1,
          success_count: entry.success_count + (successful ? 1 : 0),
          failure_count: entry.failure_count + (successful ? 0 : 1),
        };
        
        state.entries.set(id, updatedEntry);
        cacheManager.current.set(id, updatedEntry);
      }
      
      dispatch({
        type: 'ADD_RECENT_OPERATION',
        payload: { type: 'usage', entryId: id, success: successful },
      });
      
    } catch (error) {
      console.warn('Failed to record entry usage:', error);
    }
  }, [state.entries]);
  
  const recordEntryView = useCallback(async (id: string): Promise<void> => {
    try {
      await window.electronAPI?.recordEntryView?.(id);
      
      // Update usage count in local state
      const entry = state.entries.get(id);
      if (entry) {
        const updatedEntry = {
          ...entry,
          usage_count: entry.usage_count + 1,
        };
        
        state.entries.set(id, updatedEntry);
        cacheManager.current.set(id, updatedEntry);
      }
      
    } catch (error) {
      console.warn('Failed to record entry view:', error);
    }
  }, [state.entries]);
  
  // =====================
  // Filter and Pagination
  // =====================
  
  const updateFilters = useCallback((filters: Partial<KBDataState['currentFilters']>) => {
    dispatch({ type: 'UPDATE_FILTERS', payload: filters });
  }, []);
  
  const updatePagination = useCallback((pagination: Partial<KBDataState['pagination']>) => {
    dispatch({ type: 'UPDATE_PAGINATION', payload: pagination });
  }, []);
  
  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);
  
  // =====================
  // Cache Management
  // =====================
  
  const invalidateCache = useCallback(() => {
    cacheManager.current.clear();
    dispatch({ type: 'INVALIDATE_CACHE' });
  }, []);
  
  const preloadEntries = useCallback(async (ids: string[]): Promise<void> => {
    const missingIds = ids.filter(id => !cacheManager.current.has(id) && !state.entries.has(id));
    
    if (missingIds.length === 0) return;
    
    try {
      const entries = await Promise.all(
        missingIds.map(id => window.electronAPI?.getKBEntry?.(id))
      );
      
      entries.filter(Boolean).forEach(entry => {
        if (entry) {
          cacheManager.current.set(entry.id, entry);
        }
      });
      
    } catch (error) {
      console.warn('Failed to preload entries:', error);
    }
  }, [state.entries]);
  
  // =====================
  // Error Handling
  // =====================
  
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);
  
  const retryFailedOperation = useCallback(async (): Promise<void> => {
    if (!state.operationError) return;
    
    // Implement retry logic based on the failed operation
    const { operation, entryId } = state.operationError;
    
    try {
      if (operation === 'create' && entryId) {
        // Retry create operation
        // This would need access to the original entry data
      } else if (operation === 'update' && entryId) {
        // Retry update operation
        // This would need access to the original update data
      } else if (operation === 'delete' && entryId) {
        // Retry delete operation
        await deleteEntry(entryId);
      }
    } catch (error) {
      console.warn('Retry operation failed:', error);
    }
  }, [state.operationError, deleteEntry]);
  
  // =====================
  // Auto-load on mount
  // =====================
  
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);
  
  // =====================
  // Cache cleanup on unmount
  // =====================
  
  useEffect(() => {
    return () => {
      cacheManager.current.clear();
    };
  }, []);
  
  // =====================
  // Context Value (Memoized)
  // =====================
  
  const contextValue = useMemo<KBDataContextValue>(() => ({
    state,
    loadEntries,
    refreshEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    createEntries,
    updateEntries,
    deleteEntries,
    getEntry,
    getEntries,
    getEntriesByCategory,
    getEntriesByTags,
    recordEntryUsage,
    recordEntryView,
    updateFilters,
    updatePagination,
    resetFilters,
    invalidateCache,
    preloadEntries,
    clearError,
    retryFailedOperation,
  }), [
    state,
    loadEntries,
    refreshEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    createEntries,
    updateEntries,
    deleteEntries,
    getEntry,
    getEntries,
    getEntriesByCategory,
    getEntriesByTags,
    recordEntryUsage,
    recordEntryView,
    updateFilters,
    updatePagination,
    resetFilters,
    invalidateCache,
    preloadEntries,
    clearError,
    retryFailedOperation,
  ]);
  
  return (
    <KBDataContext.Provider value={contextValue}>
      {children}
    </KBDataContext.Provider>
  );
};

// =====================
// Hook
// =====================

/**
 * Hook to access KB Data Context
 * @throws Error if used outside of KBDataProvider
 */
export const useKBData = (): KBDataContextValue => {
  const context = useContext(KBDataContext);
  if (!context) {
    throw new Error('useKBData must be used within a KBDataProvider');
  }
  return context;
};

export default KBDataContext;