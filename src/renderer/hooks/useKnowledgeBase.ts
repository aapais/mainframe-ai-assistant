/**
 * React Hook for Knowledge Base Operations
 * Provides reactive state management for KB entries with optimistic updates
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { 
  KBEntry, 
  KBEntryInput, 
  KBEntryUpdate, 
  SearchResult, 
  SearchQuery 
} from '../../types';
import { ipcBridge } from '../ipc/IPCBridge';

// Hook state interface
export interface UseKnowledgeBaseState {
  entries: SearchResult[];
  selectedEntry: KBEntry | null;
  isLoading: boolean;
  error: string | null;
  isOptimistic: boolean;
}

// Hook return interface
export interface UseKnowledgeBaseReturn extends UseKnowledgeBaseState {
  // Entry operations
  addEntry: (entry: KBEntryInput) => Promise<string>;
  updateEntry: (id: string, updates: KBEntryUpdate) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  selectEntry: (id: string) => Promise<void>;
  clearSelection: () => void;
  
  // Data fetching
  loadEntries: (query?: SearchQuery) => Promise<void>;
  refreshEntries: () => Promise<void>;
  
  // Rating operations
  rateEntry: (id: string, successful: boolean, comment?: string) => Promise<void>;
  
  // Utilities
  findEntryById: (id: string) => SearchResult | undefined;
  clearError: () => void;
  retryLastOperation: () => Promise<void>;
}

// Hook options
export interface UseKnowledgeBaseOptions {
  initialQuery?: SearchQuery;
  autoLoad?: boolean;
  optimisticUpdates?: boolean;
  errorRetries?: number;
}

/**
 * Knowledge Base Hook with optimistic updates and error handling
 */
export function useKnowledgeBase(options: UseKnowledgeBaseOptions = {}): UseKnowledgeBaseReturn {
  const {
    initialQuery,
    autoLoad = true,
    optimisticUpdates = true,
    errorRetries = 2
  } = options;

  // State
  const [state, setState] = useState<UseKnowledgeBaseState>({
    entries: [],
    selectedEntry: null,
    isLoading: false,
    error: null,
    isOptimistic: false
  });

  // Refs for tracking operations
  const lastOperationRef = useRef<() => Promise<void>>();
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  // Safe state update that checks if component is still mounted
  const safeSetState = useCallback((update: Partial<UseKnowledgeBaseState> | ((prev: UseKnowledgeBaseState) => UseKnowledgeBaseState)) => {
    if (mountedRef.current) {
      setState(update);
    }
  }, []);

  // Error handling
  const handleError = useCallback((error: Error, operation?: () => Promise<void>) => {
    console.error('Knowledge Base Error:', error);
    
    if (operation) {
      lastOperationRef.current = operation;
    }
    
    safeSetState(prev => ({
      ...prev,
      error: error.message,
      isLoading: false,
      isOptimistic: false
    }));
  }, [safeSetState]);

  // Load entries
  const loadEntries = useCallback(async (query?: SearchQuery) => {
    safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const operation = async () => {
      try {
        const entries = await ipcBridge.getKBEntries(query);
        safeSetState(prev => ({
          ...prev,
          entries,
          isLoading: false,
          error: null,
          isOptimistic: false
        }));
        retryCountRef.current = 0;
      } catch (error) {
        handleError(error as Error, () => loadEntries(query));
      }
    };
    
    await operation();
  }, [safeSetState, handleError]);

  // Add entry with optimistic update
  const addEntry = useCallback(async (entry: KBEntryInput): Promise<string> => {
    if (!optimisticUpdates) {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
    } else {
      safeSetState(prev => ({ ...prev, isOptimistic: true, error: null }));
    }

    const operation = async () => {
      try {
        const id = await ipcBridge.addKBEntry(entry);
        
        if (!optimisticUpdates) {
          // Refresh entries if not using optimistic updates
          await loadEntries();
        } else {
          safeSetState(prev => ({ ...prev, isOptimistic: false }));
        }
        
        retryCountRef.current = 0;
        return id;
      } catch (error) {
        handleError(error as Error, () => addEntry(entry).then(() => {}));
        throw error;
      }
    };

    lastOperationRef.current = () => operation().then(() => {});
    return await operation();
  }, [optimisticUpdates, safeSetState, handleError, loadEntries]);

  // Update entry with optimistic update
  const updateEntry = useCallback(async (id: string, updates: KBEntryUpdate): Promise<void> => {
    if (!optimisticUpdates) {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
    } else {
      safeSetState(prev => ({ ...prev, isOptimistic: true, error: null }));
    }

    const operation = async () => {
      try {
        await ipcBridge.updateKBEntry(id, updates);
        
        if (!optimisticUpdates) {
          // Refresh entries if not using optimistic updates
          await loadEntries();
        } else {
          safeSetState(prev => ({ ...prev, isOptimistic: false }));
        }
        
        // Refresh selected entry if it was updated
        if (state.selectedEntry?.id === id) {
          await selectEntry(id);
        }
        
        retryCountRef.current = 0;
      } catch (error) {
        handleError(error as Error, () => updateEntry(id, updates));
        throw error;
      }
    };

    lastOperationRef.current = operation;
    await operation();
  }, [optimisticUpdates, safeSetState, handleError, loadEntries, state.selectedEntry?.id]);

  // Delete entry with optimistic update
  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    if (!optimisticUpdates) {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
    } else {
      safeSetState(prev => ({ ...prev, isOptimistic: true, error: null }));
    }

    const operation = async () => {
      try {
        await ipcBridge.deleteKBEntry(id);
        
        // Clear selection if deleted entry was selected
        if (state.selectedEntry?.id === id) {
          safeSetState(prev => ({ 
            ...prev, 
            selectedEntry: null, 
            isOptimistic: optimisticUpdates ? false : prev.isOptimistic 
          }));
        }
        
        if (!optimisticUpdates) {
          // Refresh entries if not using optimistic updates
          await loadEntries();
        } else {
          safeSetState(prev => ({ ...prev, isOptimistic: false }));
        }
        
        retryCountRef.current = 0;
      } catch (error) {
        handleError(error as Error, () => deleteEntry(id));
        throw error;
      }
    };

    lastOperationRef.current = operation;
    await operation();
  }, [optimisticUpdates, safeSetState, handleError, loadEntries, state.selectedEntry?.id]);

  // Select entry
  const selectEntry = useCallback(async (id: string): Promise<void> => {
    safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const operation = async () => {
      try {
        const entry = await ipcBridge.getEntry(id);
        safeSetState(prev => ({
          ...prev,
          selectedEntry: entry,
          isLoading: false,
          error: null
        }));
        retryCountRef.current = 0;
      } catch (error) {
        handleError(error as Error, () => selectEntry(id));
      }
    };

    lastOperationRef.current = operation;
    await operation();
  }, [safeSetState, handleError]);

  // Clear selection
  const clearSelection = useCallback(() => {
    safeSetState(prev => ({ ...prev, selectedEntry: null }));
  }, [safeSetState]);

  // Refresh entries
  const refreshEntries = useCallback(async () => {
    // Clear cache and reload
    ipcBridge.clearCache();
    await loadEntries(initialQuery);
  }, [loadEntries, initialQuery]);

  // Rate entry
  const rateEntry = useCallback(async (id: string, successful: boolean, comment?: string): Promise<void> => {
    if (!optimisticUpdates) {
      safeSetState(prev => ({ ...prev, isLoading: true, error: null }));
    } else {
      safeSetState(prev => ({ ...prev, isOptimistic: true, error: null }));
    }

    const operation = async () => {
      try {
        await ipcBridge.rateEntry(id, successful, comment);
        
        // Refresh selected entry if it was rated
        if (state.selectedEntry?.id === id) {
          await selectEntry(id);
        }
        
        safeSetState(prev => ({ 
          ...prev, 
          isLoading: false, 
          isOptimistic: false,
          error: null 
        }));
        
        retryCountRef.current = 0;
      } catch (error) {
        handleError(error as Error, () => rateEntry(id, successful, comment));
        throw error;
      }
    };

    lastOperationRef.current = operation;
    await operation();
  }, [optimisticUpdates, safeSetState, handleError, state.selectedEntry?.id, selectEntry]);

  // Find entry by ID
  const findEntryById = useCallback((id: string): SearchResult | undefined => {
    return state.entries.find(result => result.entry.id === id);
  }, [state.entries]);

  // Clear error
  const clearError = useCallback(() => {
    safeSetState(prev => ({ ...prev, error: null }));
  }, [safeSetState]);

  // Retry last operation
  const retryLastOperation = useCallback(async (): Promise<void> => {
    if (lastOperationRef.current && retryCountRef.current < errorRetries) {
      retryCountRef.current++;
      await lastOperationRef.current();
    }
  }, [errorRetries]);

  // Listen for optimistic updates and cache events
  useEffect(() => {
    const handleOptimisticApplied = () => {
      safeSetState(prev => ({ ...prev, isOptimistic: true }));
    };

    const handleOptimisticConfirmed = () => {
      safeSetState(prev => ({ ...prev, isOptimistic: false }));
    };

    const handleOptimisticRollback = () => {
      safeSetState(prev => ({ ...prev, isOptimistic: false }));
      // Refresh data to get correct state
      loadEntries(initialQuery);
    };

    ipcBridge.on('optimistic:applied', handleOptimisticApplied);
    ipcBridge.on('optimistic:confirmed', handleOptimisticConfirmed);
    ipcBridge.on('optimistic:rollback', handleOptimisticRollback);

    return () => {
      ipcBridge.removeAllListeners('optimistic:applied');
      ipcBridge.removeAllListeners('optimistic:confirmed');
      ipcBridge.removeAllListeners('optimistic:rollback');
    };
  }, [safeSetState, loadEntries, initialQuery]);

  // Auto-load entries on mount
  useEffect(() => {
    if (autoLoad) {
      loadEntries(initialQuery);
    }
  }, [autoLoad, initialQuery, loadEntries]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    // State
    ...state,
    
    // Operations
    addEntry,
    updateEntry,
    deleteEntry,
    selectEntry,
    clearSelection,
    
    // Data fetching
    loadEntries,
    refreshEntries,
    
    // Rating
    rateEntry,
    
    // Utilities
    findEntryById,
    clearError,
    retryLastOperation
  };
}

export default useKnowledgeBase;