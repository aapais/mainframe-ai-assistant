import { KBEntry, KBCategory, KBEntryInput, KBEntryUpdate } from '../../types';
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
    entries: Map<string, KBEntry>;
    categories: KBCategory[];
    isLoading: boolean;
    isSaving: boolean;
    isDeleting: boolean;
    isOffline: boolean;
    isSyncing: boolean;
    errors: Map<string, {
        code: string;
        message: string;
        timestamp: number;
        operation?: OperationMetadata;
    }>;
    optimisticOperations: Map<string, OperationMetadata>;
    rollbackData: Map<string, any>;
    syncQueue: SyncQueueItem[];
    lastSyncTimestamp: number;
    conflicts: Map<string, ConflictResolution>;
    metrics: {
        totalOperations: number;
        successfulOperations: number;
        failedOperations: number;
        averageResponseTime: number;
        cacheHitRate: number;
        optimisticSuccessRate: number;
    };
    filters: {
        category?: KBCategory;
        tags?: string[];
        search?: string;
        dateRange?: {
            from: Date;
            to: Date;
        };
    };
    pagination: {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        hasMore: boolean;
    };
}
export interface ReactiveActions {
    loadEntries: (options?: LoadOptions) => Promise<KBEntry[]>;
    createEntry: (entry: KBEntryInput, optimistic?: boolean) => Promise<KBEntry>;
    updateEntry: (id: string, updates: KBEntryUpdate, optimistic?: boolean) => Promise<KBEntry>;
    deleteEntry: (id: string, optimistic?: boolean) => Promise<void>;
    createEntries: (entries: KBEntryInput[], optimistic?: boolean) => Promise<KBEntry[]>;
    updateEntries: (updates: Array<{
        id: string;
        updates: KBEntryUpdate;
    }>, optimistic?: boolean) => Promise<KBEntry[]>;
    deleteEntries: (ids: string[], optimistic?: boolean) => Promise<void>;
    rollbackOptimisticOperation: (operationId: string) => void;
    retryFailedOperation: (operationId: string) => Promise<void>;
    clearOptimisticOperations: () => void;
    syncWithServer: (force?: boolean) => Promise<void>;
    processSyncQueue: () => Promise<void>;
    resolveConflict: (entryId: string, resolution: ConflictResolution) => Promise<void>;
    clearError: (errorId: string) => void;
    clearAllErrors: () => void;
    setOfflineMode: (offline: boolean) => void;
    updateFilters: (filters: Partial<ReactiveState['filters']>) => void;
    updatePagination: (pagination: Partial<ReactiveState['pagination']>) => void;
    resetFilters: () => void;
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
export declare const useReactiveStore: any;
export declare const selectEntries: (state: ReactiveState & ReactiveActions) => Map<string, KBEntry>;
export declare const selectLoading: (state: ReactiveState & ReactiveActions) => boolean;
export declare const selectErrors: (state: ReactiveState & ReactiveActions) => Map<string, {
    code: string;
    message: string;
    timestamp: number;
    operation?: OperationMetadata;
}>;
export declare const selectMetrics: (state: ReactiveState & ReactiveActions) => {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageResponseTime: number;
    cacheHitRate: number;
    optimisticSuccessRate: number;
};
export declare const selectFilters: (state: ReactiveState & ReactiveActions) => {
    category?: KBCategory;
    tags?: string[];
    search?: string;
    dateRange?: {
        from: Date;
        to: Date;
    };
};
export declare const selectPagination: (state: ReactiveState & ReactiveActions) => {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
};
export declare const selectOptimisticOperations: (state: ReactiveState & ReactiveActions) => Map<string, OperationMetadata>;
export declare const selectSyncStatus: (state: ReactiveState & ReactiveActions) => {
    isSyncing: boolean;
    isOffline: boolean;
    syncQueueLength: number;
    lastSyncTimestamp: number;
};
export {};
//# sourceMappingURL=reactive-state.d.ts.map