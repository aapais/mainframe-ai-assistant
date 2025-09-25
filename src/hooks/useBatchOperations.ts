/**
 * Batch Operations Hook
 *
 * Custom React hook for managing batch operations on KB entries
 * with progress tracking, error handling, and state management.
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { KBEntry } from '../database/KnowledgeDB';
import {
  BatchOperationsService,
  BatchOperationProgress,
  BatchOperationResult,
} from '../services/BatchOperationsService';

// ========================
// Types & Interfaces
// ========================

export interface BatchOperationState {
  /** Currently active operation type */
  activeOperation: string | null;
  /** Operation progress */
  progress: BatchOperationProgress | null;
  /** Whether an operation is currently running */
  isOperating: boolean;
  /** Last operation error */
  error: string | null;
  /** Last operation result */
  lastResult: BatchOperationResult | null;
  /** History of completed operations */
  operationHistory: Array<{
    id: string;
    type: string;
    timestamp: Date;
    success: boolean;
    itemCount: number;
    duration: number;
  }>;
}

export interface BatchSelectionState {
  /** Set of selected entry IDs */
  selectedIds: Set<string>;
  /** Whether all entries are selected */
  allSelected: boolean;
  /** Whether some (but not all) entries are selected */
  someSelected: boolean;
  /** Number of selected entries */
  selectedCount: number;
}

export interface UseBatchOperationsReturn {
  // State
  operationState: BatchOperationState;
  selectionState: BatchSelectionState;

  // Computed values
  selectedEntries: KBEntry[];
  canBatchEdit: boolean;
  canBatchDelete: boolean;
  canBatchExport: boolean;

  // Selection operations
  selectAll: () => void;
  selectNone: () => void;
  selectInvert: () => void;
  selectEntries: (entryIds: string[]) => void;
  toggleSelection: (entryId: string) => void;
  isSelected: (entryId: string) => boolean;

  // Batch operations
  performBatchUpdate: (
    updates: Partial<KBEntry> | ((entry: KBEntry) => Partial<KBEntry>),
    options?: any
  ) => Promise<BatchOperationResult>;
  performBatchDelete: (options?: any) => Promise<BatchOperationResult>;
  performBatchDuplicate: (options?: any) => Promise<BatchOperationResult>;
  performBatchExport: (format?: string, options?: any) => Promise<BatchOperationResult>;
  performBatchOperation: (operation: string, entryIds: string[]) => Promise<void>;

  // Operation control
  cancelCurrentOperation: () => Promise<boolean>;
  clearError: () => void;
  clearHistory: () => void;
}

// ========================
// Hook Implementation
// ========================

export const useBatchOperations = (
  entries: KBEntry[],
  initialSelectedIds?: Set<string>,
  batchService?: BatchOperationsService
): UseBatchOperationsReturn => {
  // State management
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelectedIds || new Set());

  const [operationState, setOperationState] = useState<BatchOperationState>({
    activeOperation: null,
    progress: null,
    isOperating: false,
    error: null,
    lastResult: null,
    operationHistory: [],
  });

  // Computed selection state
  const selectionState = useMemo<BatchSelectionState>(() => {
    const selectedCount = selectedIds.size;
    const totalCount = entries.length;
    const allSelected = totalCount > 0 && selectedCount === totalCount;
    const someSelected = selectedCount > 0 && selectedCount < totalCount;

    return {
      selectedIds,
      allSelected,
      someSelected,
      selectedCount,
    };
  }, [selectedIds, entries.length]);

  // Computed values
  const selectedEntries = useMemo(() => {
    return entries.filter(entry => entry.id && selectedIds.has(entry.id));
  }, [entries, selectedIds]);

  const canBatchEdit = useMemo(() => {
    return selectedEntries.length > 0 && selectedEntries.every(entry => !entry.archived);
  }, [selectedEntries]);

  const canBatchDelete = useMemo(() => {
    return selectedEntries.length > 0;
  }, [selectedEntries]);

  const canBatchExport = useMemo(() => {
    return selectedEntries.length > 0;
  }, [selectedEntries]);

  // Selection operations
  const selectAll = useCallback(() => {
    const allIds = new Set(entries.map(entry => entry.id).filter(Boolean) as string[]);
    setSelectedIds(allIds);
  }, [entries]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectInvert = useCallback(() => {
    const allIds = entries.map(entry => entry.id).filter(Boolean) as string[];
    const newSelection = new Set(allIds.filter(id => !selectedIds.has(id)));
    setSelectedIds(newSelection);
  }, [entries, selectedIds]);

  const selectEntries = useCallback((entryIds: string[]) => {
    setSelectedIds(new Set(entryIds));
  }, []);

  const toggleSelection = useCallback((entryId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  }, []);

  const isSelected = useCallback(
    (entryId: string) => {
      return selectedIds.has(entryId);
    },
    [selectedIds]
  );

  // Operation helpers
  const updateOperationState = useCallback((updates: Partial<BatchOperationState>) => {
    setOperationState(prev => ({ ...prev, ...updates }));
  }, []);

  const addToHistory = useCallback(
    (id: string, type: string, success: boolean, itemCount: number, duration: number) => {
      setOperationState(prev => ({
        ...prev,
        operationHistory: [
          ...prev.operationHistory.slice(-9), // Keep last 10 operations
          {
            id,
            type,
            timestamp: new Date(),
            success,
            itemCount,
            duration,
          },
        ],
      }));
    },
    []
  );

  // Batch operations
  const performBatchUpdate = useCallback(
    async (
      updates: Partial<KBEntry> | ((entry: KBEntry) => Partial<KBEntry>),
      options: any = {}
    ): Promise<BatchOperationResult> => {
      if (!batchService) {
        throw new Error('Batch service not available');
      }

      const entryIds = Array.from(selectedIds);
      if (entryIds.length === 0) {
        throw new Error('No entries selected for update');
      }

      updateOperationState({
        activeOperation: 'update',
        isOperating: true,
        error: null,
        progress: null,
      });

      try {
        const result = await batchService.batchUpdate(entryIds, updates, options);

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          lastResult: result,
          progress: result.progress,
        });

        addToHistory(
          `update_${Date.now()}`,
          'update',
          result.success,
          entryIds.length,
          result.duration
        );

        if (result.success) {
          // Clear selection after successful update
          selectNone();
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Update failed';

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [batchService, selectedIds, updateOperationState, addToHistory, selectNone]
  );

  const performBatchDelete = useCallback(
    async (options: any = {}): Promise<BatchOperationResult> => {
      if (!batchService) {
        throw new Error('Batch service not available');
      }

      const entryIds = Array.from(selectedIds);
      if (entryIds.length === 0) {
        throw new Error('No entries selected for deletion');
      }

      updateOperationState({
        activeOperation: 'delete',
        isOperating: true,
        error: null,
        progress: null,
      });

      try {
        const result = await batchService.batchDelete(entryIds, options);

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          lastResult: result,
          progress: result.progress,
        });

        addToHistory(
          `delete_${Date.now()}`,
          'delete',
          result.success,
          entryIds.length,
          result.duration
        );

        if (result.success) {
          // Clear selection after successful deletion
          selectNone();
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Delete failed';

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [batchService, selectedIds, updateOperationState, addToHistory, selectNone]
  );

  const performBatchDuplicate = useCallback(
    async (options: any = {}): Promise<BatchOperationResult> => {
      if (!batchService) {
        throw new Error('Batch service not available');
      }

      const entryIds = Array.from(selectedIds);
      if (entryIds.length === 0) {
        throw new Error('No entries selected for duplication');
      }

      updateOperationState({
        activeOperation: 'duplicate',
        isOperating: true,
        error: null,
        progress: null,
      });

      try {
        const result = await batchService.batchDuplicate(entryIds, options);

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          lastResult: result,
          progress: result.progress,
        });

        addToHistory(
          `duplicate_${Date.now()}`,
          'duplicate',
          result.success,
          entryIds.length,
          result.duration
        );

        // Don't clear selection after duplication (user might want to see originals)

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Duplication failed';

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [batchService, selectedIds, updateOperationState, addToHistory]
  );

  const performBatchExport = useCallback(
    async (format: string = 'json', options: any = {}): Promise<BatchOperationResult> => {
      if (!batchService) {
        throw new Error('Batch service not available');
      }

      const entryIds = Array.from(selectedIds);
      if (entryIds.length === 0) {
        throw new Error('No entries selected for export');
      }

      updateOperationState({
        activeOperation: 'export',
        isOperating: true,
        error: null,
        progress: null,
      });

      try {
        const result = await batchService.batchExport(entryIds, format as any, options);

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          lastResult: result,
          progress: result.progress,
        });

        addToHistory(
          `export_${Date.now()}`,
          `export_${format}`,
          result.success,
          entryIds.length,
          result.duration
        );

        // Don't clear selection after export (user might want to perform other operations)

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Export failed';

        updateOperationState({
          activeOperation: null,
          isOperating: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [batchService, selectedIds, updateOperationState, addToHistory]
  );

  const performBatchOperation = useCallback(
    async (operation: string, entryIds: string[]): Promise<void> => {
      if (!batchService) {
        throw new Error('Batch service not available');
      }

      // Update selection to match provided entry IDs
      setSelectedIds(new Set(entryIds));

      switch (operation) {
        case 'edit':
        case 'update':
          await performBatchUpdate({});
          break;

        case 'delete':
          await performBatchDelete();
          break;

        case 'duplicate':
          await performBatchDuplicate();
          break;

        case 'export':
          await performBatchExport('json');
          break;

        default:
          throw new Error(`Unknown batch operation: ${operation}`);
      }
    },
    [
      batchService,
      performBatchUpdate,
      performBatchDelete,
      performBatchDuplicate,
      performBatchExport,
    ]
  );

  // Operation control
  const cancelCurrentOperation = useCallback(async (): Promise<boolean> => {
    if (!batchService || !operationState.activeOperation) {
      return false;
    }

    const activeOperations = batchService.getActiveOperations();
    if (activeOperations.length > 0) {
      const success = await batchService.cancelOperation(activeOperations[0]);

      if (success) {
        updateOperationState({
          activeOperation: null,
          isOperating: false,
          error: 'Operation cancelled by user',
          progress: null,
        });
      }

      return success;
    }

    return false;
  }, [batchService, operationState.activeOperation, updateOperationState]);

  const clearError = useCallback(() => {
    updateOperationState({ error: null });
  }, [updateOperationState]);

  const clearHistory = useCallback(() => {
    updateOperationState({ operationHistory: [] });
  }, [updateOperationState]);

  // Event listeners for batch service events
  useEffect(() => {
    if (!batchService) return;

    const handleProgress = ({ progress }: { progress: BatchOperationProgress }) => {
      updateOperationState({ progress });
    };

    const handleOperationComplete = (event: any) => {
      updateOperationState({
        activeOperation: null,
        isOperating: false,
        progress: event.progress,
      });
    };

    const handleOperationError = (event: any) => {
      updateOperationState({
        activeOperation: null,
        isOperating: false,
        error: event.error,
        progress: event.progress,
      });
    };

    const handleOperationCancelled = () => {
      updateOperationState({
        activeOperation: null,
        isOperating: false,
        error: 'Operation cancelled',
        progress: null,
      });
    };

    batchService.on('progress', handleProgress);
    batchService.on('operationComplete', handleOperationComplete);
    batchService.on('operationError', handleOperationError);
    batchService.on('operationCancelled', handleOperationCancelled);

    return () => {
      batchService.off('progress', handleProgress);
      batchService.off('operationComplete', handleOperationComplete);
      batchService.off('operationError', handleOperationError);
      batchService.off('operationCancelled', handleOperationCancelled);
    };
  }, [batchService, updateOperationState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchService && operationState.activeOperation) {
        cancelCurrentOperation();
      }
    };
  }, [batchService, operationState.activeOperation, cancelCurrentOperation]);

  return {
    // State
    operationState,
    selectionState,

    // Computed values
    selectedEntries,
    canBatchEdit,
    canBatchDelete,
    canBatchExport,

    // Selection operations
    selectAll,
    selectNone,
    selectInvert,
    selectEntries,
    toggleSelection,
    isSelected,

    // Batch operations
    performBatchUpdate,
    performBatchDelete,
    performBatchDuplicate,
    performBatchExport,
    performBatchOperation,

    // Operation control
    cancelCurrentOperation,
    clearError,
    clearHistory,
  };
};

export default useBatchOperations;
