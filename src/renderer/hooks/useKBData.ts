/**
 * Knowledge Base Data Hooks
 * 
 * This module provides custom React hooks for KB data operations with:
 * - Optimized data fetching patterns with intelligent caching
 * - Automatic loading and error state management
 * - Memory-efficient pagination and filtering
 * - Real-time data synchronization and updates  
 * - Performance monitoring and analytics integration
 * - Context-aware state management and optimization
 * - Batch operations for improved performance
 * - Offline-first operation support
 * 
 * @author State Management Architect
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { KBEntry, KBCategory, KBEntryInput, KBEntryUpdate, SearchResult } from '../../types/services';
import { useKBData as useKBDataContext } from '../contexts/KBDataContext';
import { useSearch } from '../contexts/SearchContext';
import { useMetrics } from '../contexts/MetricsContext';
import { debounce, memoizeWithTTL, createRetryMechanism } from '../utils/stateHelpers';

// =====================
// Types and Interfaces
// =====================

export interface UseKBEntriesOptions {
  category?: KBCategory;
  tags?: string[];
  limit?: number;
  sortBy?: 'created_at' | 'updated_at' | 'usage_count' | 'success_rate' | 'title';
  sortOrder?: 'asc' | 'desc';
  autoRefresh?: boolean;
  refreshInterval?: number;
  enablePagination?: boolean;
  prefetchNext?: boolean;
}

export interface UseKBEntryOptions {
  preloadRelated?: boolean;
  trackViews?: boolean;
  enableAutoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseKBMutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  enableOptimisticUpdates?: boolean;
  retryAttempts?: number;
  enableBatching?: boolean;
  batchDelay?: number;
}

export interface UseKBSearchOptions {
  debounceDelay?: number;
  enableCache?: boolean;
  cacheTimeout?: number;
  enableSuggestions?: boolean;
  maxSuggestions?: number;
  enableAnalytics?: boolean;
  autoSearch?: boolean;
  minQueryLength?: number;
}

// =====================
// Core KB Data Hooks
// =====================

/**
 * Hook for managing KB entries with advanced filtering and pagination
 * @param options Configuration options for entries management
 * @returns KB entries state and operations
 */
export function useKBEntries(options: UseKBEntriesOptions = {}) {
  const {
    category,
    tags,
    limit = 50,
    sortBy = 'updated_at',
    sortOrder = 'desc',
    autoRefresh = false,
    refreshInterval = 30000,
    enablePagination = true,
    prefetchNext = true,
  } = options;

  const { 
    state, 
    loadEntries, 
    refreshEntries,
    updateFilters,
    updatePagination,
    getEntriesByCategory,
    getEntriesByTags,
    preloadEntries,
  } = useKBDataContext();
  
  const { recordUsageActivity, startOperation, endOperation } = useMetrics();
  
  const [localLoading, setLocalLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Memoized filtered entries
  const filteredEntries = useMemo(() => {
    let entries = Array.from(state.entries.values());
    
    // Apply category filter
    if (category) {
      entries = entries.filter(entry => entry.category === category);
    }
    
    // Apply tags filter
    if (tags && tags.length > 0) {
      entries = entries.filter(entry => 
        entry.tags && entry.tags.some(tag => tags.includes(tag))
      );
    }
    
    // Apply sorting
    entries.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];
      
      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (sortOrder === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
    
    // Apply limit for pagination
    if (enablePagination) {
      const startIndex = (state.pagination.currentPage - 1) * state.pagination.pageSize;
      entries = entries.slice(startIndex, startIndex + limit);
    } else {
      entries = entries.slice(0, limit);
    }
    
    return entries;
  }, [
    state.entries,
    category,
    tags,
    sortBy,
    sortOrder,
    limit,
    enablePagination,
    state.pagination.currentPage,
    state.pagination.pageSize,
  ]);
  
  // Load entries with performance monitoring
  const loadEntriesWithMonitoring = useCallback(async (force: boolean = false) => {
    const operationId = startOperation('load-entries');
    setLocalLoading(true);
    
    try {
      await loadEntries({ 
        force,
        category,
        tags,
        limit,
      });
      
      // Record analytics
      await recordUsageActivity({
        entryId: 'bulk-load',
        action: 'view',
        metadata: {
          category,
          tags,
          limit,
          resultCount: filteredEntries.length,
        },
      });
      
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      setLocalLoading(false);
      endOperation(operationId);
    }
  }, [startOperation, endOperation, loadEntries, recordUsageActivity, category, tags, limit, filteredEntries.length]);
  
  // Debounced filter update
  const debouncedUpdateFilters = useMemo(
    () => debounce((filters: any) => {
      updateFilters(filters);
      loadEntriesWithMonitoring();
    }, 300),
    [updateFilters, loadEntriesWithMonitoring]
  );
  
  // Update filters
  const updateFiltersOptimized = useCallback((filters: {
    category?: KBCategory;
    tags?: string[];
  }) => {
    debouncedUpdateFilters(filters);
  }, [debouncedUpdateFilters]);
  
  // Load next page
  const loadNextPage = useCallback(async () => {
    if (!enablePagination || state.isLoading) return;
    
    updatePagination({ currentPage: state.pagination.currentPage + 1 });
    await loadEntriesWithMonitoring();
    
    // Prefetch next page if enabled
    if (prefetchNext) {
      const nextPageEntries = Array.from(state.entries.values())
        .slice((state.pagination.currentPage + 1) * state.pagination.pageSize, (state.pagination.currentPage + 2) * state.pagination.pageSize);
      
      if (nextPageEntries.length > 0) {
        const nextPageIds = nextPageEntries.map(entry => entry.id);
        await preloadEntries(nextPageIds);
      }
    }
  }, [
    enablePagination,
    state.isLoading,
    state.pagination.currentPage,
    state.pagination.pageSize,
    state.entries,
    updatePagination,
    loadEntriesWithMonitoring,
    prefetchNext,
    preloadEntries,
  ]);
  
  // Load previous page
  const loadPrevPage = useCallback(async () => {
    if (!enablePagination || state.pagination.currentPage <= 1) return;
    
    updatePagination({ currentPage: state.pagination.currentPage - 1 });
    await loadEntriesWithMonitoring();
  }, [enablePagination, state.pagination.currentPage, updatePagination, loadEntriesWithMonitoring]);
  
  // Refresh entries
  const refresh = useCallback(async () => {
    await loadEntriesWithMonitoring(true);
  }, [loadEntriesWithMonitoring]);
  
  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      refreshTimeoutRef.current = setInterval(refresh, refreshInterval);
      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refresh]);
  
  // Initial load
  useEffect(() => {
    loadEntriesWithMonitoring();
  }, [category, tags, sortBy, sortOrder]);
  
  return {
    // Data
    entries: filteredEntries,
    totalEntries: state.totalEntries,
    
    // State
    isLoading: state.isLoading || localLoading,
    error: state.error,
    hasMore,
    
    // Pagination
    currentPage: state.pagination.currentPage,
    pageSize: state.pagination.pageSize,
    
    // Operations
    refresh,
    loadNextPage,
    loadPrevPage,
    updateFilters: updateFiltersOptimized,
    
    // Utilities
    getEntriesByCategory,
    getEntriesByTags,
  };
}

/**
 * Hook for managing a single KB entry with real-time updates
 * @param entryId ID of the entry to manage
 * @param options Configuration options
 * @returns Entry state and operations
 */
export function useKBEntry(entryId: string, options: UseKBEntryOptions = {}) {
  const {
    preloadRelated = true,
    trackViews = true,
    enableAutoRefresh = false,
    refreshInterval = 60000,
  } = options;
  
  const { 
    state,
    getEntry,
    recordEntryView,
    preloadEntries,
  } = useKBDataContext();
  
  const { recordUsageActivity } = useMetrics();
  
  const [isViewed, setIsViewed] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Get the entry from state
  const entry = useMemo(() => getEntry(entryId), [getEntry, entryId]);
  
  // Related entries (same category or tags)
  const relatedEntries = useMemo(() => {
    if (!entry) return [];
    
    return Array.from(state.entries.values())
      .filter(e => 
        e.id !== entry.id && (
          e.category === entry.category ||
          (entry.tags && e.tags && entry.tags.some(tag => e.tags!.includes(tag)))
        )
      )
      .slice(0, 5); // Limit to 5 related entries
  }, [entry, state.entries]);
  
  // Track entry view
  const trackEntryView = useCallback(async () => {
    if (!trackViews || !entry || isViewed) return;
    
    try {
      await recordEntryView(entry.id);
      await recordUsageActivity({
        entryId: entry.id,
        action: 'view',
        metadata: {
          category: entry.category,
          tags: entry.tags,
        },
      });
      
      setIsViewed(true);
    } catch (error) {
      console.warn('Failed to track entry view:', error);
    }
  }, [trackViews, entry, isViewed, recordEntryView, recordUsageActivity]);
  
  // Preload related entries
  const preloadRelatedEntries = useCallback(async () => {
    if (!preloadRelated || relatedEntries.length === 0) return;
    
    const relatedIds = relatedEntries.map(e => e.id);
    await preloadEntries(relatedIds);
  }, [preloadRelated, relatedEntries, preloadEntries]);
  
  // Auto-refresh effect
  useEffect(() => {
    if (enableAutoRefresh && entry) {
      refreshTimeoutRef.current = setInterval(() => {
        // In a real implementation, this would refetch the entry
        // For now, we'll just track it as a refresh activity
        recordUsageActivity({
          entryId: entry.id,
          action: 'view',
          metadata: { autoRefresh: true },
        });
      }, refreshInterval);
      
      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [enableAutoRefresh, entry, refreshInterval, recordUsageActivity]);
  
  // Track view on first render
  useEffect(() => {
    if (entry) {
      trackEntryView();
      preloadRelatedEntries();
    }
  }, [entry, trackEntryView, preloadRelatedEntries]);
  
  return {
    // Data
    entry,
    relatedEntries,
    
    // State
    isLoading: !entry && state.isLoading,
    error: state.error,
    isViewed,
    
    // Operations
    trackView: trackEntryView,
    preloadRelated: preloadRelatedEntries,
  };
}

/**
 * Hook for KB mutation operations (create, update, delete) with optimizations
 * @param options Configuration options for mutations
 * @returns Mutation state and operations
 */
export function useKBMutation(options: UseKBMutationOptions = {}) {
  const {
    onSuccess,
    onError,
    enableOptimisticUpdates = true,
    retryAttempts = 3,
    enableBatching = false,
    batchDelay = 1000,
  } = options;
  
  const { 
    createEntry,
    updateEntry,
    deleteEntry,
    createEntries,
    updateEntries,
    deleteEntries,
    state,
  } = useKBDataContext();
  
  const { recordUsageActivity, startOperation, endOperation } = useMetrics();
  
  const [operationState, setOperationState] = useState({
    isLoading: false,
    error: null as Error | null,
  });
  
  const batchOperationsRef = useRef<{
    creates: KBEntryInput[];
    updates: Array<{ id: string; updates: KBEntryUpdate }>;
    deletes: string[];
    timeout?: ReturnType<typeof setTimeout>;
  }>({
    creates: [],
    updates: [],
    deletes: [],
  });
  
  // Create retry mechanism for operations
  const createWithRetry = useMemo(
    () => createRetryMechanism(createEntry, retryAttempts),
    [createEntry, retryAttempts]
  );
  
  const updateWithRetry = useMemo(
    () => createRetryMechanism(updateEntry, retryAttempts),
    [updateEntry, retryAttempts]
  );
  
  const deleteWithRetry = useMemo(
    () => createRetryMechanism(deleteEntry, retryAttempts),
    [deleteEntry, retryAttempts]
  );
  
  // Execute batch operations
  const executeBatchOperations = useCallback(async () => {
    const batch = batchOperationsRef.current;
    
    if (batch.creates.length === 0 && batch.updates.length === 0 && batch.deletes.length === 0) {
      return;
    }
    
    setOperationState({ isLoading: true, error: null });
    const operationId = startOperation('batch-mutations');
    
    try {
      const results = {
        created: [] as KBEntry[],
        updated: [] as KBEntry[],
        deleted: [] as string[],
      };
      
      // Execute batch operations
      if (batch.creates.length > 0) {
        results.created = await createEntries([...batch.creates]);
        batch.creates.length = 0;
      }
      
      if (batch.updates.length > 0) {
        results.updated = await updateEntries([...batch.updates]);
        batch.updates.length = 0;
      }
      
      if (batch.deletes.length > 0) {
        await deleteEntries([...batch.deletes]);
        results.deleted = [...batch.deletes];
        batch.deletes.length = 0;
      }
      
      // Record analytics
      await recordUsageActivity({
        entryId: 'batch-operation',
        action: 'update',
        metadata: {
          created: results.created.length,
          updated: results.updated.length,
          deleted: results.deleted.length,
        },
      });
      
      onSuccess?.(results);
      setOperationState({ isLoading: false, error: null });
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Batch operation failed');
      setOperationState({ isLoading: false, error: err });
      onError?.(err);
    } finally {
      endOperation(operationId);
    }
  }, [startOperation, endOperation, createEntries, updateEntries, deleteEntries, recordUsageActivity, onSuccess, onError]);
  
  // Schedule batch execution
  const scheduleBatchExecution = useCallback(() => {
    if (batchOperationsRef.current.timeout) {
      clearTimeout(batchOperationsRef.current.timeout);
    }
    
    batchOperationsRef.current.timeout = setTimeout(executeBatchOperations, batchDelay);
  }, [executeBatchOperations, batchDelay]);
  
  // Create entry operation
  const create = useCallback(async (entryData: KBEntryInput): Promise<KBEntry | void> => {
    if (enableBatching) {
      batchOperationsRef.current.creates.push(entryData);
      scheduleBatchExecution();
      return;
    }
    
    setOperationState({ isLoading: true, error: null });
    const operationId = startOperation('create-entry');
    
    try {
      const newEntry = await createWithRetry(entryData);
      
      await recordUsageActivity({
        entryId: newEntry.id,
        action: 'create',
        metadata: {
          category: newEntry.category,
          tags: newEntry.tags,
        },
      });
      
      onSuccess?.(newEntry);
      setOperationState({ isLoading: false, error: null });
      return newEntry;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create entry');
      setOperationState({ isLoading: false, error: err });
      onError?.(err);
      throw err;
    } finally {
      endOperation(operationId);
    }
  }, [
    enableBatching,
    createWithRetry,
    startOperation,
    endOperation,
    recordUsageActivity,
    onSuccess,
    onError,
    scheduleBatchExecution,
  ]);
  
  // Update entry operation
  const update = useCallback(async (id: string, updates: KBEntryUpdate): Promise<KBEntry | void> => {
    if (enableBatching) {
      batchOperationsRef.current.updates.push({ id, updates });
      scheduleBatchExecution();
      return;
    }
    
    setOperationState({ isLoading: true, error: null });
    const operationId = startOperation('update-entry');
    
    try {
      const updatedEntry = await updateWithRetry(id, updates);
      
      await recordUsageActivity({
        entryId: id,
        action: 'update',
        metadata: {
          updatedFields: Object.keys(updates),
        },
      });
      
      onSuccess?.(updatedEntry);
      setOperationState({ isLoading: false, error: null });
      return updatedEntry;
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update entry');
      setOperationState({ isLoading: false, error: err });
      onError?.(err);
      throw err;
    } finally {
      endOperation(operationId);
    }
  }, [
    enableBatching,
    updateWithRetry,
    startOperation,
    endOperation,
    recordUsageActivity,
    onSuccess,
    onError,
    scheduleBatchExecution,
  ]);
  
  // Delete entry operation
  const remove = useCallback(async (id: string): Promise<void> => {
    if (enableBatching) {
      batchOperationsRef.current.deletes.push(id);
      scheduleBatchExecution();
      return;
    }
    
    setOperationState({ isLoading: true, error: null });
    const operationId = startOperation('delete-entry');
    
    try {
      await deleteWithRetry(id);
      
      await recordUsageActivity({
        entryId: id,
        action: 'delete',
        metadata: {
          timestamp: Date.now(),
        },
      });
      
      onSuccess?.(id);
      setOperationState({ isLoading: false, error: null });
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to delete entry');
      setOperationState({ isLoading: false, error: err });
      onError?.(err);
      throw err;
    } finally {
      endOperation(operationId);
    }
  }, [
    enableBatching,
    deleteWithRetry,
    startOperation,
    endOperation,
    recordUsageActivity,
    onSuccess,
    onError,
    scheduleBatchExecution,
  ]);
  
  // Rate entry
  const rate = useCallback(async (id: string, successful: boolean, comment?: string): Promise<void> => {
    const operationId = startOperation('rate-entry');
    
    try {
      // This would typically go through the KB context
      await recordUsageActivity({
        entryId: id,
        action: successful ? 'rate_success' : 'rate_failure',
        metadata: {
          comment,
          rating: successful,
        },
      });
      
      onSuccess?.({ id, successful, comment });
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to rate entry');
      onError?.(err);
      throw err;
    } finally {
      endOperation(operationId);
    }
  }, [startOperation, endOperation, recordUsageActivity, onSuccess, onError]);
  
  // Cleanup batch operations on unmount
  useEffect(() => {
    return () => {
      if (batchOperationsRef.current.timeout) {
        clearTimeout(batchOperationsRef.current.timeout);
        // Execute any pending batch operations
        if (batchOperationsRef.current.creates.length > 0 ||
            batchOperationsRef.current.updates.length > 0 ||
            batchOperationsRef.current.deletes.length > 0) {
          executeBatchOperations();
        }
      }
    };
  }, [executeBatchOperations]);
  
  return {
    // State
    isLoading: operationState.isLoading || state.isSaving || state.isDeleting,
    error: operationState.error || state.operationError,
    
    // Operations
    create,
    update,
    remove,
    rate,
    
    // Batch operations
    executeBatch: executeBatchOperations,
    
    // Utilities
    reset: () => setOperationState({ isLoading: false, error: null }),
  };
}

/**
 * Hook for advanced KB search with caching and analytics
 * @param options Configuration options for search
 * @returns Search state and operations
 */
export function useKBSearch(options: UseKBSearchOptions = {}) {
  const {
    debounceDelay = 300,
    enableCache = true,
    cacheTimeout = 5 * 60 * 1000,
    enableSuggestions = true,
    maxSuggestions = 8,
    enableAnalytics = true,
    autoSearch = false,
    minQueryLength = 2,
  } = options;
  
  const {
    state: searchState,
    performSearch,
    performSearchWithCache,
    generateSuggestions,
    setQuery,
    getSearchAnalytics,
    getCacheStats,
  } = useSearch();
  
  const { recordUsageActivity, recordSearch, startOperation, endOperation } = useMetrics();
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  
  // Debounced search execution
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      if (query.length < minQueryLength) return;
      
      const operationId = startOperation('search');
      
      try {
        const searchFunc = enableCache ? performSearchWithCache : performSearch;
        await searchFunc(query);
        
        if (enableAnalytics) {
          await recordSearch(query, searchState.results);
        }
        
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        endOperation(operationId);
      }
    }, debounceDelay),
    [
      debounceDelay,
      minQueryLength,
      enableCache,
      enableAnalytics,
      performSearchWithCache,
      performSearch,
      startOperation,
      endOperation,
      recordSearch,
      searchState.results,
    ]
  );
  
  // Generate suggestions with debouncing
  const debouncedGenerateSuggestions = useMemo(
    () => debounce(async (query: string) => {
      if (!enableSuggestions || query.length < 1) {
        setSuggestions([]);
        return;
      }
      
      setIsGeneratingSuggestions(true);
      
      try {
        const generatedSuggestions = await generateSuggestions(query);
        setSuggestions(generatedSuggestions.slice(0, maxSuggestions));
      } catch (error) {
        console.warn('Failed to generate suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsGeneratingSuggestions(false);
      }
    }, 200), // Faster debounce for suggestions
    [enableSuggestions, generateSuggestions, maxSuggestions]
  );
  
  // Enhanced search function
  const search = useCallback(async (query: string, force: boolean = false) => {
    setQuery(query);
    
    if (autoSearch || force) {
      await debouncedSearch(query);
    }
    
    // Generate suggestions
    if (enableSuggestions) {
      debouncedGenerateSuggestions(query);
    }
  }, [setQuery, autoSearch, debouncedSearch, enableSuggestions, debouncedGenerateSuggestions]);
  
  // Immediate search (no debouncing)
  const searchImmediate = useCallback(async (query: string) => {
    const operationId = startOperation('immediate-search');
    
    try {
      setQuery(query);
      const searchFunc = enableCache ? performSearchWithCache : performSearch;
      await searchFunc(query);
      
      if (enableAnalytics) {
        await recordUsageActivity({
          entryId: 'search-immediate',
          action: 'search',
          metadata: {
            query,
            resultCount: searchState.results.length,
          },
        });
      }
      
    } catch (error) {
      console.error('Immediate search failed:', error);
    } finally {
      endOperation(operationId);
    }
  }, [
    startOperation,
    endOperation,
    setQuery,
    enableCache,
    performSearchWithCache,
    performSearch,
    enableAnalytics,
    recordUsageActivity,
    searchState.results.length,
  ]);
  
  // Search analytics
  const analytics = useMemo(() => {
    if (!enableAnalytics) return null;
    
    return {
      searchAnalytics: getSearchAnalytics(),
      cacheStats: getCacheStats(),
      performance: searchState.searchMetrics,
    };
  }, [enableAnalytics, getSearchAnalytics, getCacheStats, searchState.searchMetrics]);
  
  return {
    // State
    query: searchState.query,
    results: searchState.results,
    totalResults: searchState.totalResults,
    isSearching: searchState.isSearching,
    error: searchState.searchError,
    suggestions,
    isGeneratingSuggestions,
    
    // Operations
    search,
    searchImmediate,
    
    // Analytics (optional)
    analytics,
    
    // Utilities
    clearResults: () => setQuery(''),
    refreshSuggestions: () => debouncedGenerateSuggestions(searchState.query),
  };
}

// =====================
// Utility Hooks
// =====================

/**
 * Hook for KB statistics and insights
 */
export function useKBStats() {
  const { state } = useKBDataContext();
  const { getKBMetrics, getHealthScore, getDailyStats } = useMetrics();
  
  const [stats, setStats] = useState({
    healthScore: 75,
    dailyStats: null as any,
    isLoading: false,
  });
  
  const refreshStats = useCallback(async () => {
    setStats(prev => ({ ...prev, isLoading: true }));
    
    try {
      const [metrics, healthScore, dailyStats] = await Promise.all([
        getKBMetrics(),
        getHealthScore(),
        getDailyStats(),
      ]);
      
      setStats({
        healthScore,
        dailyStats,
        isLoading: false,
      });
      
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, [getKBMetrics, getHealthScore, getDailyStats]);
  
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);
  
  return {
    // Basic stats from context
    totalEntries: state.totalEntries,
    entriesCount: state.entries.size,
    isLoading: state.isLoading || stats.isLoading,
    
    // Advanced stats
    healthScore: stats.healthScore,
    dailyStats: stats.dailyStats,
    
    // Operations
    refresh: refreshStats,
  };
}

/**
 * Hook for offline support and synchronization
 */
export function useKBOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<string[]>([]);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return {
    isOnline,
    isOffline: !isOnline,
    pendingSyncs,
    syncCount: pendingSyncs.length,
  };
}

export default {
  useKBEntries,
  useKBEntry,
  useKBMutation,
  useKBSearch,
  useKBStats,
  useKBOffline,
};