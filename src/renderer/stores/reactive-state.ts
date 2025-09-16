/**
 * Reactive Data Layer - Zustand-based State Management
 * Optimized for Electron IPC Communication with Advanced Features
 *
 * Features:
 * - Optimistic updates with automatic rollback
 * - IPC synchronization with conflict resolution
 * - Offline-first operations with sync queue
 * - Type-safe reactive state management
 * - Comprehensive error handling and recovery
 * - Performance monitoring and metrics
 *
 * @author Reactive Data Layer Coordinator
 * @version 1.0.0
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware/persist';
import { KBEntry, KBCategory, KBEntryInput, KBEntryUpdate } from '../../types';

// =====================
// State Interfaces
// =====================

export interface OperationMetadata {
  id: string;
  type: 'create' | 'update' | 'delete' | 'batch';
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  optimistic: boolean;
  rollbackData?: any;
}

export interface SyncQueueItem {
  operation: OperationMetadata;
  data: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  clientVersion: number;
  serverVersion: number;
  resolvedData?: any;
}

export interface ReactiveState {
  // Core Data
  entries: Map<string, KBEntry>;
  categories: KBCategory[];

  // Loading States
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isOffline: boolean;
  isSyncing: boolean;

  // Error Handling
  errors: Map<string, {
    code: string;
    message: string;
    timestamp: number;
    operation?: OperationMetadata;
  }>;

  // Optimistic Updates
  optimisticOperations: Map<string, OperationMetadata>;
  rollbackData: Map<string, any>;

  // Sync Management
  syncQueue: SyncQueueItem[];
  lastSyncTimestamp: number;
  conflicts: Map<string, ConflictResolution>;

  // Performance Metrics
  metrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageResponseTime: number;
    cacheHitRate: number;
    optimisticSuccessRate: number;
  };

  // Filters and Pagination
  filters: {
    category?: KBCategory;
    tags?: string[];
    search?: string;
    dateRange?: { from: Date; to: Date };
  };

  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ReactiveActions {
  // Core CRUD Operations
  loadEntries: (options?: LoadOptions) => Promise<KBEntry[]>;
  createEntry: (entry: KBEntryInput, optimistic?: boolean) => Promise<KBEntry>;
  updateEntry: (id: string, updates: KBEntryUpdate, optimistic?: boolean) => Promise<KBEntry>;
  deleteEntry: (id: string, optimistic?: boolean) => Promise<void>;

  // Batch Operations
  createEntries: (entries: KBEntryInput[], optimistic?: boolean) => Promise<KBEntry[]>;
  updateEntries: (updates: Array<{ id: string; updates: KBEntryUpdate }>, optimistic?: boolean) => Promise<KBEntry[]>;
  deleteEntries: (ids: string[], optimistic?: boolean) => Promise<void>;

  // Optimistic Update Management
  rollbackOptimisticOperation: (operationId: string) => void;
  retryFailedOperation: (operationId: string) => Promise<void>;
  clearOptimisticOperations: () => void;

  // Sync Management
  syncWithServer: (force?: boolean) => Promise<void>;
  processSyncQueue: () => Promise<void>;
  resolveConflict: (entryId: string, resolution: ConflictResolution) => Promise<void>;

  // Error Handling
  clearError: (errorId: string) => void;
  clearAllErrors: () => void;

  // State Management
  setOfflineMode: (offline: boolean) => void;
  updateFilters: (filters: Partial<ReactiveState['filters']>) => void;
  updatePagination: (pagination: Partial<ReactiveState['pagination']>) => void;
  resetFilters: () => void;

  // Utility
  getEntry: (id: string) => KBEntry | null;
  getEntriesByCategory: (category: KBCategory) => KBEntry[];
  invalidateCache: () => void;
}

interface LoadOptions {
  force?: boolean;
  category?: KBCategory;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// =====================
// Initial State
// =====================

const initialState: ReactiveState = {
  entries: new Map(),
  categories: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'],

  isLoading: false,
  isSaving: false,
  isDeleting: false,
  isOffline: false,
  isSyncing: false,

  errors: new Map(),
  optimisticOperations: new Map(),
  rollbackData: new Map(),

  syncQueue: [],
  lastSyncTimestamp: 0,
  conflicts: new Map(),

  metrics: {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    optimisticSuccessRate: 0,
  },

  filters: {},
  pagination: {
    currentPage: 1,
    pageSize: 50,
    totalPages: 1,
    hasMore: false,
  },
};

// =====================
// Store Creation
// =====================

export const useReactiveStore = create<ReactiveState & ReactiveActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,

          // =====================
          // Core CRUD Operations
          // =====================

          loadEntries: async (options: LoadOptions = {}) => {
            const { force = false, category, tags, limit = 50, offset = 0 } = options;
            const state = get();

            // Skip if already loading or fresh data exists
            if (state.isLoading || (!force && state.entries.size > 0 && Date.now() - state.lastSyncTimestamp < 60000)) {
              return Array.from(state.entries.values());
            }

            set((state) => {
              state.isLoading = true;
            });

            try {
              const startTime = Date.now();

              const response = await window.electronAPI?.getKBEntries?.({
                category,
                tags,
                limit,
                offset,
                includeMetrics: true,
              });

              const entries = Array.isArray(response) ? response : (response?.entries || []);
              const totalEntries = Array.isArray(response) ? response.length : (response?.total || entries.length);

              set((state) => {
                // Clear existing entries for fresh load
                if (offset === 0) {
                  state.entries.clear();
                }

                // Add new entries
                entries.forEach(entry => {
                  state.entries.set(entry.id, entry);
                });

                state.isLoading = false;
                state.lastSyncTimestamp = Date.now();

                // Update pagination
                state.pagination.totalPages = Math.ceil(totalEntries / limit);
                state.pagination.hasMore = entries.length === limit;

                // Update metrics
                state.metrics.averageResponseTime =
                  (state.metrics.averageResponseTime + (Date.now() - startTime)) / 2;
              });

              return entries;

            } catch (error) {
              const errorId = `load-${Date.now()}`;
              set((state) => {
                state.isLoading = false;
                state.errors.set(errorId, {
                  code: 'LOAD_FAILED',
                  message: error instanceof Error ? error.message : 'Failed to load entries',
                  timestamp: Date.now(),
                });
                state.metrics.failedOperations++;
              });

              throw error;
            }
          },

          createEntry: async (entry: KBEntryInput, optimistic = true) => {
            const operationId = `create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const tempId = `temp-${operationId}`;
            const state = get();

            // Optimistic update
            if (optimistic) {
              const optimisticEntry: KBEntry = {
                id: tempId,
                ...entry,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                usage_count: 0,
                success_count: 0,
                failure_count: 0,
                tags: entry.tags || [],
              };

              set((state) => {
                state.entries.set(tempId, optimisticEntry);
                state.optimisticOperations.set(operationId, {
                  id: operationId,
                  type: 'create',
                  timestamp: Date.now(),
                  retryCount: 0,
                  maxRetries: 3,
                  optimistic: true,
                });
                state.isSaving = true;
              });
            }

            try {
              const newEntry = await window.electronAPI?.addKBEntry?.(entry);
              if (!newEntry) throw new Error('Failed to create entry');

              set((state) => {
                // Remove optimistic entry and add real entry
                if (optimistic) {
                  state.entries.delete(tempId);
                  state.optimisticOperations.delete(operationId);
                }

                state.entries.set(newEntry.id, newEntry);
                state.isSaving = false;
                state.metrics.successfulOperations++;
                state.metrics.totalOperations++;

                if (optimistic) {
                  state.metrics.optimisticSuccessRate =
                    (state.metrics.optimisticSuccessRate + 100) / 2;
                }
              });

              return newEntry;

            } catch (error) {
              const errorId = `create-${Date.now()}`;

              set((state) => {
                state.isSaving = false;
                state.metrics.failedOperations++;
                state.metrics.totalOperations++;

                if (optimistic) {
                  // Store rollback data
                  state.rollbackData.set(operationId, { tempId });
                  state.metrics.optimisticSuccessRate =
                    (state.metrics.optimisticSuccessRate + 0) / 2;

                  // Add to sync queue for retry
                  if (state.isOffline) {
                    state.syncQueue.push({
                      operation: state.optimisticOperations.get(operationId)!,
                      data: entry,
                      resolve: () => {},
                      reject: () => {},
                    });
                  }
                }

                state.errors.set(errorId, {
                  code: 'CREATE_FAILED',
                  message: error instanceof Error ? error.message : 'Failed to create entry',
                  timestamp: Date.now(),
                  operation: state.optimisticOperations.get(operationId),
                });
              });

              throw error;
            }
          },

          updateEntry: async (id: string, updates: KBEntryUpdate, optimistic = true) => {
            const operationId = `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const state = get();
            const existingEntry = state.entries.get(id);

            if (!existingEntry) {
              throw new Error(`Entry with id ${id} not found`);
            }

            // Store original data for rollback
            const originalEntry = { ...existingEntry };

            // Optimistic update
            if (optimistic) {
              const optimisticEntry: KBEntry = {
                ...existingEntry,
                ...updates,
                updated_at: new Date().toISOString(),
              };

              set((state) => {
                state.entries.set(id, optimisticEntry);
                state.rollbackData.set(operationId, originalEntry);
                state.optimisticOperations.set(operationId, {
                  id: operationId,
                  type: 'update',
                  timestamp: Date.now(),
                  retryCount: 0,
                  maxRetries: 3,
                  optimistic: true,
                  rollbackData: originalEntry,
                });
                state.isSaving = true;
              });
            }

            try {
              const updatedEntry = await window.electronAPI?.updateKBEntry?.(id, updates);
              if (!updatedEntry) throw new Error('Failed to update entry');

              set((state) => {
                state.entries.set(id, updatedEntry);
                state.optimisticOperations.delete(operationId);
                state.rollbackData.delete(operationId);
                state.isSaving = false;
                state.metrics.successfulOperations++;
                state.metrics.totalOperations++;

                if (optimistic) {
                  state.metrics.optimisticSuccessRate =
                    (state.metrics.optimisticSuccessRate + 100) / 2;
                }
              });

              return updatedEntry;

            } catch (error) {
              const errorId = `update-${Date.now()}`;

              set((state) => {
                state.isSaving = false;
                state.metrics.failedOperations++;
                state.metrics.totalOperations++;

                if (optimistic) {
                  // Rollback optimistic changes
                  state.entries.set(id, originalEntry);
                  state.metrics.optimisticSuccessRate =
                    (state.metrics.optimisticSuccessRate + 0) / 2;

                  // Add to sync queue for retry
                  if (state.isOffline) {
                    state.syncQueue.push({
                      operation: state.optimisticOperations.get(operationId)!,
                      data: { id, updates },
                      resolve: () => {},
                      reject: () => {},
                    });
                  }
                }

                state.errors.set(errorId, {
                  code: 'UPDATE_FAILED',
                  message: error instanceof Error ? error.message : 'Failed to update entry',
                  timestamp: Date.now(),
                  operation: state.optimisticOperations.get(operationId),
                });
              });

              throw error;
            }
          },

          deleteEntry: async (id: string, optimistic = true) => {
            const operationId = `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const state = get();
            const existingEntry = state.entries.get(id);

            if (!existingEntry) {
              throw new Error(`Entry with id ${id} not found`);
            }

            // Optimistic update
            if (optimistic) {
              set((state) => {
                state.entries.delete(id);
                state.rollbackData.set(operationId, existingEntry);
                state.optimisticOperations.set(operationId, {
                  id: operationId,
                  type: 'delete',
                  timestamp: Date.now(),
                  retryCount: 0,
                  maxRetries: 3,
                  optimistic: true,
                  rollbackData: existingEntry,
                });
                state.isDeleting = true;
              });
            }

            try {
              await window.electronAPI?.deleteKBEntry?.(id);

              set((state) => {
                state.optimisticOperations.delete(operationId);
                state.rollbackData.delete(operationId);
                state.isDeleting = false;
                state.metrics.successfulOperations++;
                state.metrics.totalOperations++;

                if (optimistic) {
                  state.metrics.optimisticSuccessRate =
                    (state.metrics.optimisticSuccessRate + 100) / 2;
                }
              });

            } catch (error) {
              const errorId = `delete-${Date.now()}`;

              set((state) => {
                state.isDeleting = false;
                state.metrics.failedOperations++;
                state.metrics.totalOperations++;

                if (optimistic) {
                  // Rollback optimistic changes
                  state.entries.set(id, existingEntry);
                  state.metrics.optimisticSuccessRate =
                    (state.metrics.optimisticSuccessRate + 0) / 2;

                  // Add to sync queue for retry
                  if (state.isOffline) {
                    state.syncQueue.push({
                      operation: state.optimisticOperations.get(operationId)!,
                      data: { id },
                      resolve: () => {},
                      reject: () => {},
                    });
                  }
                }

                state.errors.set(errorId, {
                  code: 'DELETE_FAILED',
                  message: error instanceof Error ? error.message : 'Failed to delete entry',
                  timestamp: Date.now(),
                  operation: state.optimisticOperations.get(operationId),
                });
              });

              throw error;
            }
          },

          // =====================
          // Batch Operations
          // =====================

          createEntries: async (entries: KBEntryInput[], optimistic = true) => {
            const operationId = `batch-create-${Date.now()}`;
            const tempIds: string[] = [];

            // Optimistic updates
            if (optimistic) {
              set((state) => {
                entries.forEach((entry, index) => {
                  const tempId = `temp-${operationId}-${index}`;
                  tempIds.push(tempId);

                  const optimisticEntry: KBEntry = {
                    id: tempId,
                    ...entry,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    usage_count: 0,
                    success_count: 0,
                    failure_count: 0,
                    tags: entry.tags || [],
                  };

                  state.entries.set(tempId, optimisticEntry);
                });

                state.optimisticOperations.set(operationId, {
                  id: operationId,
                  type: 'batch',
                  timestamp: Date.now(),
                  retryCount: 0,
                  maxRetries: 3,
                  optimistic: true,
                });
                state.isSaving = true;
              });
            }

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
              }

              set((state) => {
                // Remove optimistic entries and add real entries
                if (optimistic) {
                  tempIds.forEach(tempId => state.entries.delete(tempId));
                  state.optimisticOperations.delete(operationId);
                }

                createdEntries.forEach(entry => {
                  state.entries.set(entry.id, entry);
                });

                state.isSaving = false;
                state.metrics.successfulOperations += createdEntries.length;
                state.metrics.totalOperations += entries.length;
              });

              return createdEntries;

            } catch (error) {
              const errorId = `batch-create-${Date.now()}`;

              set((state) => {
                state.isSaving = false;
                state.metrics.failedOperations += entries.length;
                state.metrics.totalOperations += entries.length;

                state.errors.set(errorId, {
                  code: 'BATCH_CREATE_FAILED',
                  message: error instanceof Error ? error.message : 'Failed to create entries',
                  timestamp: Date.now(),
                  operation: state.optimisticOperations.get(operationId),
                });
              });

              throw error;
            }
          },

          updateEntries: async (updates: Array<{ id: string; updates: KBEntryUpdate }>, optimistic = true) => {
            const operationId = `batch-update-${Date.now()}`;
            const originalEntries = new Map<string, KBEntry>();

            // Optimistic updates
            if (optimistic) {
              set((state) => {
                updates.forEach(({ id, updates: entryUpdates }) => {
                  const existingEntry = state.entries.get(id);
                  if (existingEntry) {
                    originalEntries.set(id, { ...existingEntry });

                    const optimisticEntry: KBEntry = {
                      ...existingEntry,
                      ...entryUpdates,
                      updated_at: new Date().toISOString(),
                    };

                    state.entries.set(id, optimisticEntry);
                  }
                });

                state.rollbackData.set(operationId, originalEntries);
                state.optimisticOperations.set(operationId, {
                  id: operationId,
                  type: 'batch',
                  timestamp: Date.now(),
                  retryCount: 0,
                  maxRetries: 3,
                  optimistic: true,
                  rollbackData: originalEntries,
                });
                state.isSaving = true;
              });
            }

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
              }

              set((state) => {
                updatedEntries.forEach(entry => {
                  state.entries.set(entry.id, entry);
                });

                state.optimisticOperations.delete(operationId);
                state.rollbackData.delete(operationId);
                state.isSaving = false;
                state.metrics.successfulOperations += updatedEntries.length;
                state.metrics.totalOperations += updates.length;
              });

              return updatedEntries;

            } catch (error) {
              const errorId = `batch-update-${Date.now()}`;

              set((state) => {
                state.isSaving = false;
                state.metrics.failedOperations += updates.length;
                state.metrics.totalOperations += updates.length;

                // Rollback optimistic changes
                if (optimistic) {
                  originalEntries.forEach((entry, id) => {
                    state.entries.set(id, entry);
                  });
                }

                state.errors.set(errorId, {
                  code: 'BATCH_UPDATE_FAILED',
                  message: error instanceof Error ? error.message : 'Failed to update entries',
                  timestamp: Date.now(),
                  operation: state.optimisticOperations.get(operationId),
                });
              });

              throw error;
            }
          },

          deleteEntries: async (ids: string[], optimistic = true) => {
            const operationId = `batch-delete-${Date.now()}`;
            const deletedEntries = new Map<string, KBEntry>();

            // Optimistic updates
            if (optimistic) {
              set((state) => {
                ids.forEach(id => {
                  const entry = state.entries.get(id);
                  if (entry) {
                    deletedEntries.set(id, entry);
                    state.entries.delete(id);
                  }
                });

                state.rollbackData.set(operationId, deletedEntries);
                state.optimisticOperations.set(operationId, {
                  id: operationId,
                  type: 'batch',
                  timestamp: Date.now(),
                  retryCount: 0,
                  maxRetries: 3,
                  optimistic: true,
                  rollbackData: deletedEntries,
                });
                state.isDeleting = true;
              });
            }

            try {
              // Process in batches
              const batchSize = 10;
              for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                await Promise.all(
                  batch.map(id => window.electronAPI?.deleteKBEntry?.(id))
                );
              }

              set((state) => {
                state.optimisticOperations.delete(operationId);
                state.rollbackData.delete(operationId);
                state.isDeleting = false;
                state.metrics.successfulOperations += ids.length;
                state.metrics.totalOperations += ids.length;
              });

            } catch (error) {
              const errorId = `batch-delete-${Date.now()}`;

              set((state) => {
                state.isDeleting = false;
                state.metrics.failedOperations += ids.length;
                state.metrics.totalOperations += ids.length;

                // Rollback optimistic changes
                if (optimistic) {
                  deletedEntries.forEach((entry, id) => {
                    state.entries.set(id, entry);
                  });
                }

                state.errors.set(errorId, {
                  code: 'BATCH_DELETE_FAILED',
                  message: error instanceof Error ? error.message : 'Failed to delete entries',
                  timestamp: Date.now(),
                  operation: state.optimisticOperations.get(operationId),
                });
              });

              throw error;
            }
          },

          // =====================
          // Optimistic Update Management
          // =====================

          rollbackOptimisticOperation: (operationId: string) => {
            set((state) => {
              const operation = state.optimisticOperations.get(operationId);
              const rollbackData = state.rollbackData.get(operationId);

              if (operation && rollbackData) {
                switch (operation.type) {
                  case 'create':
                    // Remove the optimistic entry
                    if (rollbackData.tempId) {
                      state.entries.delete(rollbackData.tempId);
                    }
                    break;

                  case 'update':
                    // Restore original entry
                    state.entries.set(rollbackData.id, rollbackData);
                    break;

                  case 'delete':
                    // Restore deleted entry
                    state.entries.set(rollbackData.id, rollbackData);
                    break;

                  case 'batch':
                    // Handle batch rollback
                    if (rollbackData instanceof Map) {
                      rollbackData.forEach((entry, id) => {
                        state.entries.set(id, entry);
                      });
                    }
                    break;
                }

                state.optimisticOperations.delete(operationId);
                state.rollbackData.delete(operationId);
              }
            });
          },

          retryFailedOperation: async (operationId: string) => {
            const state = get();
            const operation = state.optimisticOperations.get(operationId);

            if (!operation || operation.retryCount >= operation.maxRetries) {
              return;
            }

            set((state) => {
              const op = state.optimisticOperations.get(operationId);
              if (op) {
                op.retryCount++;
              }
            });

            // Find the operation in sync queue and retry
            const queueItem = state.syncQueue.find(item => item.operation.id === operationId);
            if (queueItem) {
              try {
                let result;
                switch (operation.type) {
                  case 'create':
                    result = await get().createEntry(queueItem.data, false);
                    queueItem.resolve(result);
                    break;

                  case 'update':
                    result = await get().updateEntry(queueItem.data.id, queueItem.data.updates, false);
                    queueItem.resolve(result);
                    break;

                  case 'delete':
                    await get().deleteEntry(queueItem.data.id, false);
                    queueItem.resolve(undefined);
                    break;
                }

                // Remove from sync queue on success
                set((state) => {
                  const index = state.syncQueue.findIndex(item => item.operation.id === operationId);
                  if (index > -1) {
                    state.syncQueue.splice(index, 1);
                  }
                });

              } catch (error) {
                queueItem.reject(error);
              }
            }
          },

          clearOptimisticOperations: () => {
            set((state) => {
              // Rollback all optimistic operations
              state.optimisticOperations.forEach((operation, operationId) => {
                const rollbackData = state.rollbackData.get(operationId);
                if (rollbackData) {
                  // Apply rollback logic
                  get().rollbackOptimisticOperation(operationId);
                }
              });

              state.optimisticOperations.clear();
              state.rollbackData.clear();
            });
          },

          // =====================
          // Sync Management
          // =====================

          syncWithServer: async (force = false) => {
            const state = get();

            if (state.isSyncing || (!force && Date.now() - state.lastSyncTimestamp < 30000)) {
              return;
            }

            set((state) => {
              state.isSyncing = true;
            });

            try {
              // Process sync queue
              await get().processSyncQueue();

              // Perform full sync if needed
              if (force || Date.now() - state.lastSyncTimestamp > 300000) { // 5 minutes
                await get().loadEntries({ force: true });
              }

              set((state) => {
                state.isSyncing = false;
                state.lastSyncTimestamp = Date.now();
              });

            } catch (error) {
              set((state) => {
                state.isSyncing = false;
                state.errors.set(`sync-${Date.now()}`, {
                  code: 'SYNC_FAILED',
                  message: error instanceof Error ? error.message : 'Sync failed',
                  timestamp: Date.now(),
                });
              });

              throw error;
            }
          },

          processSyncQueue: async () => {
            const state = get();
            const queue = [...state.syncQueue]; // Create copy to avoid mutation issues

            if (queue.length === 0) return;

            for (const item of queue) {
              try {
                let result;

                switch (item.operation.type) {
                  case 'create':
                    result = await get().createEntry(item.data, false);
                    break;

                  case 'update':
                    result = await get().updateEntry(item.data.id, item.data.updates, false);
                    break;

                  case 'delete':
                    await get().deleteEntry(item.data.id, false);
                    break;
                }

                item.resolve(result);

                // Remove processed item from queue
                set((state) => {
                  const index = state.syncQueue.findIndex(queueItem => queueItem.operation.id === item.operation.id);
                  if (index > -1) {
                    state.syncQueue.splice(index, 1);
                  }
                });

              } catch (error) {
                // Increment retry count
                set((state) => {
                  const queueItem = state.syncQueue.find(q => q.operation.id === item.operation.id);
                  if (queueItem) {
                    queueItem.operation.retryCount++;

                    // Remove if max retries exceeded
                    if (queueItem.operation.retryCount >= queueItem.operation.maxRetries) {
                      const index = state.syncQueue.findIndex(q => q.operation.id === item.operation.id);
                      if (index > -1) {
                        state.syncQueue.splice(index, 1);
                      }
                      item.reject(error);
                    }
                  }
                });
              }
            }
          },

          resolveConflict: async (entryId: string, resolution: ConflictResolution) => {
            const state = get();
            const conflict = state.conflicts.get(entryId);

            if (!conflict) return;

            try {
              let resolvedEntry: KBEntry | null = null;

              switch (resolution.strategy) {
                case 'client-wins':
                  // Keep client version, update server
                  const clientEntry = state.entries.get(entryId);
                  if (clientEntry) {
                    resolvedEntry = await window.electronAPI?.updateKBEntry?.(entryId, clientEntry) || null;
                  }
                  break;

                case 'server-wins':
                  // Use server version, update client
                  resolvedEntry = await window.electronAPI?.getKBEntry?.(entryId) || null;
                  break;

                case 'merge':
                  // Use provided merged data
                  if (resolution.resolvedData) {
                    resolvedEntry = await window.electronAPI?.updateKBEntry?.(entryId, resolution.resolvedData) || null;
                  }
                  break;

                case 'manual':
                  // Manual resolution handled externally
                  return;
              }

              if (resolvedEntry) {
                set((state) => {
                  state.entries.set(entryId, resolvedEntry);
                  state.conflicts.delete(entryId);
                });
              }

            } catch (error) {
              console.error('Failed to resolve conflict:', error);
              throw error;
            }
          },

          // =====================
          // Error Handling
          // =====================

          clearError: (errorId: string) => {
            set((state) => {
              state.errors.delete(errorId);
            });
          },

          clearAllErrors: () => {
            set((state) => {
              state.errors.clear();
            });
          },

          // =====================
          // State Management
          // =====================

          setOfflineMode: (offline: boolean) => {
            set((state) => {
              state.isOffline = offline;

              if (!offline && state.syncQueue.length > 0) {
                // Trigger sync when coming back online
                setTimeout(() => get().syncWithServer(), 1000);
              }
            });
          },

          updateFilters: (filters: Partial<ReactiveState['filters']>) => {
            set((state) => {
              state.filters = { ...state.filters, ...filters };
              state.pagination.currentPage = 1; // Reset to first page when filters change
            });
          },

          updatePagination: (pagination: Partial<ReactiveState['pagination']>) => {
            set((state) => {
              state.pagination = { ...state.pagination, ...pagination };
            });
          },

          resetFilters: () => {
            set((state) => {
              state.filters = {};
              state.pagination.currentPage = 1;
            });
          },

          // =====================
          // Utility Methods
          // =====================

          getEntry: (id: string) => {
            return get().entries.get(id) || null;
          },

          getEntriesByCategory: (category: KBCategory) => {
            return Array.from(get().entries.values()).filter(entry => entry.category === category);
          },

          invalidateCache: () => {
            set((state) => {
              state.lastSyncTimestamp = 0;
            });
          },
        }))
      ),
      {
        name: 'kb-reactive-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist essential state, not loading states or temporary data
          entries: Array.from(state.entries.entries()), // Convert Map to Array for serialization
          categories: state.categories,
          filters: state.filters,
          pagination: state.pagination,
          metrics: state.metrics,
          lastSyncTimestamp: state.lastSyncTimestamp,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Convert persisted entries array back to Map
            state.entries = new Map(state.entries as any);
          }
        },
      }
    ),
    {
      name: 'kb-reactive-store',
    }
  )
);

// =====================
// Selectors for optimized re-renders
// =====================

export const selectEntries = (state: ReactiveState & ReactiveActions) => state.entries;
export const selectLoading = (state: ReactiveState & ReactiveActions) => state.isLoading;
export const selectErrors = (state: ReactiveState & ReactiveActions) => state.errors;
export const selectMetrics = (state: ReactiveState & ReactiveActions) => state.metrics;
export const selectFilters = (state: ReactiveState & ReactiveActions) => state.filters;
export const selectPagination = (state: ReactiveState & ReactiveActions) => state.pagination;
export const selectOptimisticOperations = (state: ReactiveState & ReactiveActions) => state.optimisticOperations;
export const selectSyncStatus = (state: ReactiveState & ReactiveActions) => ({
  isSyncing: state.isSyncing,
  isOffline: state.isOffline,
  syncQueueLength: state.syncQueue.length,
  lastSyncTimestamp: state.lastSyncTimestamp,
});