/**
 * Reactive Knowledge Base Hook
 * Provides easy integration with reactive state management
 *
 * Features:
 * - Optimistic updates with automatic rollback
 * - Offline-first operation with sync queue
 * - Type-safe reactive state management
 * - Performance optimizations with selectors
 * - Automatic error handling and retry
 * - Real-time sync status monitoring
 *
 * @author React Hook Coordinator
 * @version 1.0.0
 */

import { useCallback, useMemo, useEffect } from 'react';
import { shallow } from 'zustand/shallow';
import {
  useReactiveStore,
  selectEntries,
  selectLoading,
  selectErrors,
  selectMetrics,
  selectFilters,
  selectPagination,
  selectOptimisticOperations,
  selectSyncStatus,
} from '../stores/reactive-state';
import { useIPCBridge } from '../stores/ipc-bridge';
import { KBEntry, KBEntryInput, KBEntryUpdate, KBCategory } from '../../types';

// =====================
// Main Hook
// =====================

export function useReactiveKB() {
  // Core state selections with shallow comparison for performance
  const entries = useReactiveStore(selectEntries, shallow);
  const isLoading = useReactiveStore(selectLoading);
  const errors = useReactiveStore(selectErrors, shallow);
  const metrics = useReactiveStore(selectMetrics, shallow);
  const filters = useReactiveStore(selectFilters, shallow);
  const pagination = useReactiveStore(selectPagination, shallow);
  const optimisticOps = useReactiveStore(selectOptimisticOperations, shallow);
  const syncStatus = useReactiveStore(selectSyncStatus, shallow);

  // Actions from store
  const {
    loadEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    createEntries,
    updateEntries,
    deleteEntries,
    updateFilters,
    updatePagination,
    resetFilters,
    clearError,
    clearAllErrors,
    rollbackOptimisticOperation,
    retryFailedOperation,
    syncWithServer,
  } = useReactiveStore();

  // IPC Bridge integration
  const { forceSync, getMetrics: getBridgeMetrics, isOnline } = useIPCBridge();

  // =====================
  // Computed Values
  // =====================

  const entriesArray = useMemo(() => Array.from(entries.values()), [entries]);

  const filteredEntries = useMemo(() => {
    let filtered = entriesArray;

    if (filters.category) {
      filtered = filtered.filter(entry => entry.category === filters.category);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(entry =>
        entry.tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(searchLower) ||
        entry.problem.toLowerCase().includes(searchLower) ||
        entry.solution.toLowerCase().includes(searchLower) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (filters.dateRange) {
      const { from, to } = filters.dateRange;
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.created_at);
        return entryDate >= from && entryDate <= to;
      });
    }

    return filtered;
  }, [entriesArray, filters]);

  const paginatedEntries = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    return filteredEntries.slice(startIndex, startIndex + pagination.pageSize);
  }, [filteredEntries, pagination]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredEntries.length / pagination.pageSize);
  }, [filteredEntries.length, pagination.pageSize]);

  const hasNextPage = pagination.currentPage < totalPages;
  const hasPrevPage = pagination.currentPage > 1;

  const errorList = useMemo(() => Array.from(errors.values()), [errors]);
  const hasErrors = errorList.length > 0;

  const optimisticOperationsList = useMemo(() => Array.from(optimisticOps.values()), [optimisticOps]);
  const hasOptimisticOperations = optimisticOperationsList.length > 0;

  // =====================
  // Enhanced Actions
  // =====================

  const createEntryOptimistic = useCallback(async (entry: KBEntryInput) => {
    try {
      return await createEntry(entry, true); // Enable optimistic updates by default
    } catch (error) {
      console.error('Failed to create entry:', error);
      throw error;
    }
  }, [createEntry]);

  const updateEntryOptimistic = useCallback(async (id: string, updates: KBEntryUpdate) => {
    try {
      return await updateEntry(id, updates, true); // Enable optimistic updates by default
    } catch (error) {
      console.error('Failed to update entry:', error);
      throw error;
    }
  }, [updateEntry]);

  const deleteEntryOptimistic = useCallback(async (id: string) => {
    try {
      await deleteEntry(id, true); // Enable optimistic updates by default
    } catch (error) {
      console.error('Failed to delete entry:', error);
      throw error;
    }
  }, [deleteEntry]);

  const batchCreateEntries = useCallback(async (entries: KBEntryInput[]) => {
    try {
      return await createEntries(entries, true);
    } catch (error) {
      console.error('Failed to batch create entries:', error);
      throw error;
    }
  }, [createEntries]);

  const batchUpdateEntries = useCallback(async (updates: Array<{ id: string; updates: KBEntryUpdate }>) => {
    try {
      return await updateEntries(updates, true);
    } catch (error) {
      console.error('Failed to batch update entries:', error);
      throw error;
    }
  }, [updateEntries]);

  const batchDeleteEntries = useCallback(async (ids: string[]) => {
    try {
      await deleteEntries(ids, true);
    } catch (error) {
      console.error('Failed to batch delete entries:', error);
      throw error;
    }
  }, [deleteEntries]);

  // =====================
  // Search and Filter Actions
  // =====================

  const searchEntries = useCallback((query: string) => {
    updateFilters({ search: query });
  }, [updateFilters]);

  const filterByCategory = useCallback((category: KBCategory | undefined) => {
    updateFilters({ category });
  }, [updateFilters]);

  const filterByTags = useCallback((tags: string[]) => {
    updateFilters({ tags });
  }, [updateFilters]);

  const filterByDateRange = useCallback((dateRange: { from: Date; to: Date } | undefined) => {
    updateFilters({ dateRange });
  }, [updateFilters]);

  const clearFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  // =====================
  // Pagination Actions
  // =====================

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      updatePagination({ currentPage: page });
    }
  }, [updatePagination, totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      updatePagination({ currentPage: pagination.currentPage + 1 });
    }
  }, [updatePagination, pagination.currentPage, hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      updatePagination({ currentPage: pagination.currentPage - 1 });
    }
  }, [updatePagination, pagination.currentPage, hasPrevPage]);

  const changePageSize = useCallback((pageSize: number) => {
    updatePagination({ pageSize, currentPage: 1 });
  }, [updatePagination]);

  // =====================
  // Error Handling Actions
  // =====================

  const dismissError = useCallback((errorId: string) => {
    clearError(errorId);
  }, [clearError]);

  const dismissAllErrors = useCallback(() => {
    clearAllErrors();
  }, [clearAllErrors]);

  const retryOperation = useCallback(async (operationId: string) => {
    try {
      await retryFailedOperation(operationId);
    } catch (error) {
      console.error('Retry operation failed:', error);
    }
  }, [retryFailedOperation]);

  const rollbackOperation = useCallback((operationId: string) => {
    rollbackOptimisticOperation(operationId);
  }, [rollbackOptimisticOperation]);

  // =====================
  // Sync Actions
  // =====================

  const refreshData = useCallback(async () => {
    try {
      await loadEntries({ force: true });
    } catch (error) {
      console.error('Failed to refresh data:', error);
      throw error;
    }
  }, [loadEntries]);

  const syncData = useCallback(async () => {
    try {
      await syncWithServer(true);
    } catch (error) {
      console.error('Failed to sync data:', error);
      throw error;
    }
  }, [syncWithServer]);

  const forceBridgeSync = useCallback(async () => {
    try {
      await forceSync();
    } catch (error) {
      console.error('Failed to force sync via bridge:', error);
      throw error;
    }
  }, [forceSync]);

  // =====================
  // Entry Access Helpers
  // =====================

  const getEntry = useCallback((id: string): KBEntry | undefined => {
    return entries.get(id);
  }, [entries]);

  const getEntriesByCategory = useCallback((category: KBCategory): KBEntry[] => {
    return entriesArray.filter(entry => entry.category === category);
  }, [entriesArray]);

  const getEntriesByTags = useCallback((tags: string[]): KBEntry[] => {
    return entriesArray.filter(entry =>
      entry.tags?.some(tag => tags.includes(tag))
    );
  }, [entriesArray]);

  const getMostUsedEntries = useCallback((limit: number = 10): KBEntry[] => {
    return [...entriesArray]
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, limit);
  }, [entriesArray]);

  const getRecentEntries = useCallback((limit: number = 10): KBEntry[] => {
    return [...entriesArray]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }, [entriesArray]);

  // =====================
  // Performance Monitoring
  // =====================

  const getPerformanceMetrics = useCallback(() => {
    const bridgeMetrics = getBridgeMetrics();
    return {
      store: metrics,
      bridge: bridgeMetrics,
      combined: {
        totalOperations: metrics.totalOperations + (bridgeMetrics?.totalRequests || 0),
        successRate: metrics.totalOperations > 0
          ? (metrics.successfulOperations / metrics.totalOperations) * 100
          : 0,
        averageResponseTime: (metrics.averageResponseTime + (bridgeMetrics?.averageRequestTime || 0)) / 2,
        syncSuccess: bridgeMetrics?.syncOperations || 0,
      }
    };
  }, [metrics, getBridgeMetrics]);

  // =====================
  // Auto-load on Mount
  // =====================

  useEffect(() => {
    if (entriesArray.length === 0 && !isLoading) {
      loadEntries();
    }
  }, [loadEntries, entriesArray.length, isLoading]);

  // =====================
  // Return API
  // =====================

  return {
    // Data
    entries: entriesArray,
    filteredEntries,
    paginatedEntries,

    // State
    isLoading,
    isOnline: isOnline(),
    syncStatus,

    // Pagination
    pagination: {
      ...pagination,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },

    // Filters
    filters,

    // Errors
    errors: errorList,
    hasErrors,

    // Optimistic Operations
    optimisticOperations: optimisticOperationsList,
    hasOptimisticOperations,

    // Metrics
    metrics,
    getPerformanceMetrics,

    // CRUD Operations
    createEntry: createEntryOptimistic,
    updateEntry: updateEntryOptimistic,
    deleteEntry: deleteEntryOptimistic,

    // Batch Operations
    batchCreateEntries,
    batchUpdateEntries,
    batchDeleteEntries,

    // Search and Filter
    searchEntries,
    filterByCategory,
    filterByTags,
    filterByDateRange,
    clearFilters,

    // Pagination
    goToPage,
    nextPage,
    prevPage,
    changePageSize,

    // Entry Access
    getEntry,
    getEntriesByCategory,
    getEntriesByTags,
    getMostUsedEntries,
    getRecentEntries,

    // Sync Operations
    refreshData,
    syncData,
    forceBridgeSync,

    // Error Handling
    dismissError,
    dismissAllErrors,
    retryOperation,
    rollbackOperation,
  };
}

// =====================
// Specialized Hooks
// =====================

/**
 * Hook for monitoring sync status only
 */
export function useSyncStatus() {
  const syncStatus = useReactiveStore(selectSyncStatus, shallow);
  const { isOnline, forceSync } = useIPCBridge();

  return {
    ...syncStatus,
    isOnline: isOnline(),
    forceSync,
  };
}

/**
 * Hook for error management only
 */
export function useErrorManagement() {
  const errors = useReactiveStore(selectErrors, shallow);
  const { clearError, clearAllErrors, retryFailedOperation } = useReactiveStore();

  const errorList = useMemo(() => Array.from(errors.values()), [errors]);

  const dismissError = useCallback((errorId: string) => {
    clearError(errorId);
  }, [clearError]);

  const dismissAllErrors = useCallback(() => {
    clearAllErrors();
  }, [clearAllErrors]);

  const retryOperation = useCallback(async (operationId: string) => {
    try {
      await retryFailedOperation(operationId);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [retryFailedOperation]);

  return {
    errors: errorList,
    hasErrors: errorList.length > 0,
    dismissError,
    dismissAllErrors,
    retryOperation,
  };
}

/**
 * Hook for performance monitoring only
 */
export function usePerformanceMetrics() {
  const metrics = useReactiveStore(selectMetrics, shallow);
  const { getMetrics: getBridgeMetrics } = useIPCBridge();

  const getPerformanceMetrics = useCallback(() => {
    const bridgeMetrics = getBridgeMetrics();
    return {
      store: metrics,
      bridge: bridgeMetrics,
      combined: {
        totalOperations: metrics.totalOperations + (bridgeMetrics?.totalRequests || 0),
        successRate: metrics.totalOperations > 0
          ? (metrics.successfulOperations / metrics.totalOperations) * 100
          : 0,
        averageResponseTime: (metrics.averageResponseTime + (bridgeMetrics?.averageRequestTime || 0)) / 2,
      }
    };
  }, [metrics, getBridgeMetrics]);

  return {
    metrics,
    getPerformanceMetrics,
  };
}

export default useReactiveKB;