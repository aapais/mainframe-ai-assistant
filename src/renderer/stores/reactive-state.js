"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectSyncStatus = exports.selectOptimisticOperations = exports.selectPagination = exports.selectFilters = exports.selectMetrics = exports.selectErrors = exports.selectLoading = exports.selectEntries = exports.useReactiveStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const immer_1 = require("zustand/middleware/immer");
const persist_1 = require("zustand/middleware/persist");
const initialState = {
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
exports.useReactiveStore = (0, zustand_1.create)()((0, middleware_1.devtools)((0, persist_1.persist)((0, middleware_1.subscribeWithSelector)((0, immer_1.immer)((set, get) => ({
    ...initialState,
    loadEntries: async (options = {}) => {
        const { force = false, category, tags, limit = 50, offset = 0 } = options;
        const state = get();
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
                if (offset === 0) {
                    state.entries.clear();
                }
                entries.forEach(entry => {
                    state.entries.set(entry.id, entry);
                });
                state.isLoading = false;
                state.lastSyncTimestamp = Date.now();
                state.pagination.totalPages = Math.ceil(totalEntries / limit);
                state.pagination.hasMore = entries.length === limit;
                state.metrics.averageResponseTime =
                    (state.metrics.averageResponseTime + (Date.now() - startTime)) / 2;
            });
            return entries;
        }
        catch (error) {
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
    createEntry: async (entry, optimistic = true) => {
        const operationId = `create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tempId = `temp-${operationId}`;
        const state = get();
        if (optimistic) {
            const optimisticEntry = {
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
            if (!newEntry)
                throw new Error('Failed to create entry');
            set((state) => {
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
        }
        catch (error) {
            const errorId = `create-${Date.now()}`;
            set((state) => {
                state.isSaving = false;
                state.metrics.failedOperations++;
                state.metrics.totalOperations++;
                if (optimistic) {
                    state.rollbackData.set(operationId, { tempId });
                    state.metrics.optimisticSuccessRate =
                        (state.metrics.optimisticSuccessRate + 0) / 2;
                    if (state.isOffline) {
                        state.syncQueue.push({
                            operation: state.optimisticOperations.get(operationId),
                            data: entry,
                            resolve: () => { },
                            reject: () => { },
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
    updateEntry: async (id, updates, optimistic = true) => {
        const operationId = `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const state = get();
        const existingEntry = state.entries.get(id);
        if (!existingEntry) {
            throw new Error(`Entry with id ${id} not found`);
        }
        const originalEntry = { ...existingEntry };
        if (optimistic) {
            const optimisticEntry = {
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
            if (!updatedEntry)
                throw new Error('Failed to update entry');
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
        }
        catch (error) {
            const errorId = `update-${Date.now()}`;
            set((state) => {
                state.isSaving = false;
                state.metrics.failedOperations++;
                state.metrics.totalOperations++;
                if (optimistic) {
                    state.entries.set(id, originalEntry);
                    state.metrics.optimisticSuccessRate =
                        (state.metrics.optimisticSuccessRate + 0) / 2;
                    if (state.isOffline) {
                        state.syncQueue.push({
                            operation: state.optimisticOperations.get(operationId),
                            data: { id, updates },
                            resolve: () => { },
                            reject: () => { },
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
    deleteEntry: async (id, optimistic = true) => {
        const operationId = `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const state = get();
        const existingEntry = state.entries.get(id);
        if (!existingEntry) {
            throw new Error(`Entry with id ${id} not found`);
        }
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
        }
        catch (error) {
            const errorId = `delete-${Date.now()}`;
            set((state) => {
                state.isDeleting = false;
                state.metrics.failedOperations++;
                state.metrics.totalOperations++;
                if (optimistic) {
                    state.entries.set(id, existingEntry);
                    state.metrics.optimisticSuccessRate =
                        (state.metrics.optimisticSuccessRate + 0) / 2;
                    if (state.isOffline) {
                        state.syncQueue.push({
                            operation: state.optimisticOperations.get(operationId),
                            data: { id },
                            resolve: () => { },
                            reject: () => { },
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
    createEntries: async (entries, optimistic = true) => {
        const operationId = `batch-create-${Date.now()}`;
        const tempIds = [];
        if (optimistic) {
            set((state) => {
                entries.forEach((entry, index) => {
                    const tempId = `temp-${operationId}-${index}`;
                    tempIds.push(tempId);
                    const optimisticEntry = {
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
            const createdEntries = [];
            const batchSize = 10;
            for (let i = 0; i < entries.length; i += batchSize) {
                const batch = entries.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch.map(entry => window.electronAPI?.addKBEntry?.(entry)));
                const validResults = batchResults.filter(Boolean);
                createdEntries.push(...validResults);
            }
            set((state) => {
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
        }
        catch (error) {
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
    updateEntries: async (updates, optimistic = true) => {
        const operationId = `batch-update-${Date.now()}`;
        const originalEntries = new Map();
        if (optimistic) {
            set((state) => {
                updates.forEach(({ id, updates: entryUpdates }) => {
                    const existingEntry = state.entries.get(id);
                    if (existingEntry) {
                        originalEntries.set(id, { ...existingEntry });
                        const optimisticEntry = {
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
            const updatedEntries = [];
            const batchSize = 10;
            for (let i = 0; i < updates.length; i += batchSize) {
                const batch = updates.slice(i, i + batchSize);
                const batchResults = await Promise.all(batch.map(({ id, updates }) => window.electronAPI?.updateKBEntry?.(id, updates)));
                const validResults = batchResults.filter(Boolean);
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
        }
        catch (error) {
            const errorId = `batch-update-${Date.now()}`;
            set((state) => {
                state.isSaving = false;
                state.metrics.failedOperations += updates.length;
                state.metrics.totalOperations += updates.length;
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
    deleteEntries: async (ids, optimistic = true) => {
        const operationId = `batch-delete-${Date.now()}`;
        const deletedEntries = new Map();
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
            const batchSize = 10;
            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                await Promise.all(batch.map(id => window.electronAPI?.deleteKBEntry?.(id)));
            }
            set((state) => {
                state.optimisticOperations.delete(operationId);
                state.rollbackData.delete(operationId);
                state.isDeleting = false;
                state.metrics.successfulOperations += ids.length;
                state.metrics.totalOperations += ids.length;
            });
        }
        catch (error) {
            const errorId = `batch-delete-${Date.now()}`;
            set((state) => {
                state.isDeleting = false;
                state.metrics.failedOperations += ids.length;
                state.metrics.totalOperations += ids.length;
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
    rollbackOptimisticOperation: (operationId) => {
        set((state) => {
            const operation = state.optimisticOperations.get(operationId);
            const rollbackData = state.rollbackData.get(operationId);
            if (operation && rollbackData) {
                switch (operation.type) {
                    case 'create':
                        if (rollbackData.tempId) {
                            state.entries.delete(rollbackData.tempId);
                        }
                        break;
                    case 'update':
                        state.entries.set(rollbackData.id, rollbackData);
                        break;
                    case 'delete':
                        state.entries.set(rollbackData.id, rollbackData);
                        break;
                    case 'batch':
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
    retryFailedOperation: async (operationId) => {
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
                set((state) => {
                    const index = state.syncQueue.findIndex(item => item.operation.id === operationId);
                    if (index > -1) {
                        state.syncQueue.splice(index, 1);
                    }
                });
            }
            catch (error) {
                queueItem.reject(error);
            }
        }
    },
    clearOptimisticOperations: () => {
        set((state) => {
            state.optimisticOperations.forEach((operation, operationId) => {
                const rollbackData = state.rollbackData.get(operationId);
                if (rollbackData) {
                    get().rollbackOptimisticOperation(operationId);
                }
            });
            state.optimisticOperations.clear();
            state.rollbackData.clear();
        });
    },
    syncWithServer: async (force = false) => {
        const state = get();
        if (state.isSyncing || (!force && Date.now() - state.lastSyncTimestamp < 30000)) {
            return;
        }
        set((state) => {
            state.isSyncing = true;
        });
        try {
            await get().processSyncQueue();
            if (force || Date.now() - state.lastSyncTimestamp > 300000) {
                await get().loadEntries({ force: true });
            }
            set((state) => {
                state.isSyncing = false;
                state.lastSyncTimestamp = Date.now();
            });
        }
        catch (error) {
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
        const queue = [...state.syncQueue];
        if (queue.length === 0)
            return;
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
                set((state) => {
                    const index = state.syncQueue.findIndex(queueItem => queueItem.operation.id === item.operation.id);
                    if (index > -1) {
                        state.syncQueue.splice(index, 1);
                    }
                });
            }
            catch (error) {
                set((state) => {
                    const queueItem = state.syncQueue.find(q => q.operation.id === item.operation.id);
                    if (queueItem) {
                        queueItem.operation.retryCount++;
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
    resolveConflict: async (entryId, resolution) => {
        const state = get();
        const conflict = state.conflicts.get(entryId);
        if (!conflict)
            return;
        try {
            let resolvedEntry = null;
            switch (resolution.strategy) {
                case 'client-wins':
                    const clientEntry = state.entries.get(entryId);
                    if (clientEntry) {
                        resolvedEntry = await window.electronAPI?.updateKBEntry?.(entryId, clientEntry) || null;
                    }
                    break;
                case 'server-wins':
                    resolvedEntry = await window.electronAPI?.getKBEntry?.(entryId) || null;
                    break;
                case 'merge':
                    if (resolution.resolvedData) {
                        resolvedEntry = await window.electronAPI?.updateKBEntry?.(entryId, resolution.resolvedData) || null;
                    }
                    break;
                case 'manual':
                    return;
            }
            if (resolvedEntry) {
                set((state) => {
                    state.entries.set(entryId, resolvedEntry);
                    state.conflicts.delete(entryId);
                });
            }
        }
        catch (error) {
            console.error('Failed to resolve conflict:', error);
            throw error;
        }
    },
    clearError: (errorId) => {
        set((state) => {
            state.errors.delete(errorId);
        });
    },
    clearAllErrors: () => {
        set((state) => {
            state.errors.clear();
        });
    },
    setOfflineMode: (offline) => {
        set((state) => {
            state.isOffline = offline;
            if (!offline && state.syncQueue.length > 0) {
                setTimeout(() => get().syncWithServer(), 1000);
            }
        });
    },
    updateFilters: (filters) => {
        set((state) => {
            state.filters = { ...state.filters, ...filters };
            state.pagination.currentPage = 1;
        });
    },
    updatePagination: (pagination) => {
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
    getEntry: (id) => {
        return get().entries.get(id) || null;
    },
    getEntriesByCategory: (category) => {
        return Array.from(get().entries.values()).filter(entry => entry.category === category);
    },
    invalidateCache: () => {
        set((state) => {
            state.lastSyncTimestamp = 0;
        });
    },
}))), {
    name: 'kb-reactive-store',
    storage: (0, persist_1.createJSONStorage)(() => localStorage),
    partialize: (state) => ({
        entries: Array.from(state.entries.entries()),
        categories: state.categories,
        filters: state.filters,
        pagination: state.pagination,
        metrics: state.metrics,
        lastSyncTimestamp: state.lastSyncTimestamp,
    }),
    onRehydrateStorage: () => (state) => {
        if (state) {
            state.entries = new Map(state.entries);
        }
    },
}), {
    name: 'kb-reactive-store',
}));
const selectEntries = (state) => state.entries;
exports.selectEntries = selectEntries;
const selectLoading = (state) => state.isLoading;
exports.selectLoading = selectLoading;
const selectErrors = (state) => state.errors;
exports.selectErrors = selectErrors;
const selectMetrics = (state) => state.metrics;
exports.selectMetrics = selectMetrics;
const selectFilters = (state) => state.filters;
exports.selectFilters = selectFilters;
const selectPagination = (state) => state.pagination;
exports.selectPagination = selectPagination;
const selectOptimisticOperations = (state) => state.optimisticOperations;
exports.selectOptimisticOperations = selectOptimisticOperations;
const selectSyncStatus = (state) => ({
    isSyncing: state.isSyncing,
    isOffline: state.isOffline,
    syncQueueLength: state.syncQueue.length,
    lastSyncTimestamp: state.lastSyncTimestamp,
});
exports.selectSyncStatus = selectSyncStatus;
//# sourceMappingURL=reactive-state.js.map