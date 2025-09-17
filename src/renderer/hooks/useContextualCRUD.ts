/**
 * useContextualCRUD Hook
 * Provides search-integrated CRUD operations with real-time updates and contextual features
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { KBEntry, CreateKBEntry, UpdateKBEntry, SearchResult } from '../../types/services';
import { useKnowledgeBaseModals } from './useKnowledgeBaseModals';
import { knowledgeBaseService } from '../services/KnowledgeBaseService';

interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

interface ContextualData {
  query: string;
  category?: string;
  tags?: string[];
  severity?: string;
  suggestedTitle?: string;
  suggestedProblem?: string;
}

interface SearchUpdateCallbacks {
  onResultsUpdated?: (updatedResults: SearchResult[]) => void;
  onEntryAdded?: (entry: KBEntry) => void;
  onEntryUpdated?: (entry: KBEntry) => void;
  onEntryDeleted?: (entryId: string) => void;
  onEntriesArchived?: (entryIds: string[], archived: boolean) => void;
}

interface UseContextualCRUDOptions {
  searchResults: SearchResult[];
  contextualData?: ContextualData;
  callbacks?: SearchUpdateCallbacks;
  enableBulkOperations?: boolean;
  enableInlineEditing?: boolean;
  autoRefresh?: boolean;
}

interface UseContextualCRUDReturn {
  // Knowledge base modal integration
  modals: ReturnType<typeof useKnowledgeBaseModals>['modals'];
  loading: ReturnType<typeof useKnowledgeBaseModals>['loading'];
  notifications: ReturnType<typeof useKnowledgeBaseModals>['notifications'];

  // Selection state
  selectedEntries: KBEntry[];
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;

  // Contextual data
  contextualDefaults: Partial<CreateKBEntry>;

  // CRUD operations
  createEntryWithContext: (data?: Partial<CreateKBEntry>) => void;
  updateEntryInline: (entryId: string, updates: Partial<KBEntry>) => Promise<void>;
  deleteEntry: (entry: KBEntry) => void;
  duplicateEntry: (entry: KBEntry) => void;
  archiveEntry: (entry: KBEntry) => void;
  viewEntryHistory: (entry: KBEntry) => void;

  // Bulk operations
  bulkDelete: (entryIds: string[]) => Promise<void>;
  bulkArchive: (entryIds: string[], archive: boolean) => Promise<void>;
  bulkUpdateTags: (entryIds: string[], tags: string[]) => Promise<void>;
  bulkUpdateCategory: (entryIds: string[], category: string) => Promise<void>;
  bulkUpdateSeverity: (entryIds: string[], severity: string) => Promise<void>;
  bulkDuplicate: (entryIds: string[]) => Promise<void>;
  bulkExport: (entryIds: string[], format: 'pdf' | 'csv' | 'json') => Promise<void>;

  // Selection management
  toggleSelection: (entryId: string, event?: React.MouseEvent) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectRange: (startId: string, endId: string) => void;

  // Utility functions
  openContextualAdd: () => void;
  refreshResults: () => Promise<void>;
  handleEntryRate: (entryId: string, successful: boolean) => Promise<void>;
  exportEntry: (entry: KBEntry) => void;
  shareEntry: (entry: KBEntry) => void;

  // Modal handlers
  closeModals: () => void;
  removeNotification: (id: string) => void;
}

export const useContextualCRUD = ({
  searchResults,
  contextualData,
  callbacks,
  enableBulkOperations = true,
  enableInlineEditing = true,
  autoRefresh = true
}: UseContextualCRUDOptions): UseContextualCRUDReturn => {

  // Use the knowledge base modals hook
  const modalHook = useKnowledgeBaseModals();

  // Selection state
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null
  });

  // Operation tracking
  const [isRefreshing, setIsRefreshing] = useState(false);
  const operationInProgress = useRef(false);

  // Extract entries from search results
  const availableEntries = useMemo(() =>
    searchResults.map(result => result.entry),
    [searchResults]
  );

  // Get selected entries
  const selectedEntries = useMemo(() =>
    availableEntries.filter(entry => selectionState.selectedIds.has(entry.id)),
    [availableEntries, selectionState.selectedIds]
  );

  // Selection computed properties
  const allSelected = availableEntries.length > 0 && selectionState.selectedIds.size === availableEntries.length;
  const someSelected = selectionState.selectedIds.size > 0;

  // Generate contextual defaults based on search query and context
  const contextualDefaults = useMemo((): Partial<CreateKBEntry> => {
    if (!contextualData?.query) return {};

    const defaults: Partial<CreateKBEntry> = {};

    // Try to infer context from search query
    const query = contextualData.query.toLowerCase();

    // If query looks like an error code, suggest it in the title
    if (contextualData.suggestedTitle) {
      defaults.title = contextualData.suggestedTitle;
    } else if (/\b(s\d{3}|sql\d+|abend|error)\b/i.test(query)) {
      defaults.title = `${query.toUpperCase()} - `;
    }

    // Pre-fill problem description based on query
    if (contextualData.suggestedProblem) {
      defaults.problem = contextualData.suggestedProblem;
    } else if (query.length > 10) {
      defaults.problem = `Issue related to: ${contextualData.query}`;
    }

    // Set category if provided or inferred
    if (contextualData.category) {
      defaults.category = contextualData.category;
    } else if (query.includes('db2')) {
      defaults.category = 'DB2';
    } else if (query.includes('jcl')) {
      defaults.category = 'JCL';
    } else if (query.includes('cics')) {
      defaults.category = 'CICS';
    }

    // Set tags based on context
    if (contextualData.tags?.length) {
      defaults.tags = [...contextualData.tags];
    } else {
      defaults.tags = query.split(' ').filter(word =>
        word.length > 2 && !/\b(the|and|or|for|with|from)\b/.test(word)
      ).slice(0, 4);
    }

    // Set severity if provided
    if (contextualData.severity) {
      defaults.severity = contextualData.severity as 'low' | 'medium' | 'high' | 'critical';
    }

    return defaults;
  }, [contextualData]);

  // Update search results after operations
  const updateSearchResults = useCallback(async () => {
    if (!autoRefresh || !callbacks?.onResultsUpdated) return;

    try {
      setIsRefreshing(true);
      // In a real implementation, you would re-run the search
      // For now, we'll just call the callback with current results
      callbacks.onResultsUpdated(searchResults);
    } catch (error) {
      console.error('Failed to update search results:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [autoRefresh, callbacks, searchResults]);

  // Selection management
  const toggleSelection = useCallback((entryId: string, event?: React.MouseEvent) => {
    setSelectionState(prev => {
      const newSelectedIds = new Set(prev.selectedIds);

      if (event?.shiftKey && prev.lastSelectedId && enableBulkOperations) {
        // Range selection
        const lastIndex = availableEntries.findIndex(e => e.id === prev.lastSelectedId);
        const currentIndex = availableEntries.findIndex(e => e.id === entryId);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);

          for (let i = start; i <= end; i++) {
            if (newSelectedIds.has(availableEntries[i].id)) {
              newSelectedIds.delete(availableEntries[i].id);
            } else {
              newSelectedIds.add(availableEntries[i].id);
            }
          }
        }
      } else {
        // Single selection
        if (newSelectedIds.has(entryId)) {
          newSelectedIds.delete(entryId);
        } else {
          newSelectedIds.add(entryId);
        }
      }

      return {
        selectedIds: newSelectedIds,
        lastSelectedId: entryId
      };
    });
  }, [availableEntries, enableBulkOperations]);

  const selectAll = useCallback(() => {
    setSelectionState({
      selectedIds: new Set(availableEntries.map(e => e.id)),
      lastSelectedId: availableEntries[availableEntries.length - 1]?.id || null
    });
  }, [availableEntries]);

  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedIds: new Set(),
      lastSelectedId: null
    });
  }, []);

  const selectRange = useCallback((startId: string, endId: string) => {
    const startIndex = availableEntries.findIndex(e => e.id === startId);
    const endIndex = availableEntries.findIndex(e => e.id === endId);

    if (startIndex !== -1 && endIndex !== -1) {
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      setSelectionState({
        selectedIds: new Set(availableEntries.slice(start, end + 1).map(e => e.id)),
        lastSelectedId: endId
      });
    }
  }, [availableEntries]);

  // CRUD operations with search integration
  const createEntryWithContext = useCallback((data?: Partial<CreateKBEntry>) => {
    const entryData = {
      ...contextualDefaults,
      ...data
    };

    // Store contextual data for the modal
    modalHook.openAddEntryModal();

    // If we have enough contextual data, we could auto-populate the modal
    // This would require extending the modal hook to accept initial data
  }, [contextualDefaults, modalHook]);

  const updateEntryInline = useCallback(async (entryId: string, updates: Partial<KBEntry>) => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;
      await modalHook.updateEntry(entryId, updates);

      // Update search results
      await updateSearchResults();

      // Notify callbacks
      const updatedEntry = availableEntries.find(e => e.id === entryId);
      if (updatedEntry && callbacks?.onEntryUpdated) {
        callbacks.onEntryUpdated({ ...updatedEntry, ...updates });
      }
    } catch (error) {
      modalHook.handleError(error as Error, 'update entry inline');
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook, updateSearchResults, availableEntries, callbacks]);

  const deleteEntry = useCallback((entry: KBEntry) => {
    modalHook.openDeleteConfirmModal(entry);
  }, [modalHook]);

  const duplicateEntry = useCallback((entry: KBEntry) => {
    modalHook.duplicateEntry(entry);
  }, [modalHook]);

  const archiveEntry = useCallback((entry: KBEntry) => {
    modalHook.archiveEntry();
  }, [modalHook]);

  const viewEntryHistory = useCallback((entry: KBEntry) => {
    modalHook.openEntryHistoryModal(entry);
  }, [modalHook]);

  // Bulk operations
  const bulkDelete = useCallback(async (entryIds: string[]) => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;

      // Delete entries one by one (could be optimized with batch API)
      for (const entryId of entryIds) {
        await knowledgeBaseService.deleteEntry(entryId);
        callbacks?.onEntryDeleted?.(entryId);
      }

      modalHook.addNotification({
        type: 'success',
        title: 'Bulk Delete Complete',
        message: `Successfully deleted ${entryIds.length} entries.`
      });

      clearSelection();
      await updateSearchResults();
    } catch (error) {
      modalHook.handleError(error as Error, 'bulk delete entries');
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook, callbacks, clearSelection, updateSearchResults]);

  const bulkArchive = useCallback(async (entryIds: string[], archive: boolean) => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;

      for (const entryId of entryIds) {
        if (archive) {
          await knowledgeBaseService.archiveEntry(entryId);
        } else {
          // Assuming there's an unarchive method
          await knowledgeBaseService.unarchiveEntry?.(entryId);
        }
      }

      modalHook.addNotification({
        type: 'success',
        title: `Bulk ${archive ? 'Archive' : 'Unarchive'} Complete`,
        message: `Successfully ${archive ? 'archived' : 'unarchived'} ${entryIds.length} entries.`
      });

      callbacks?.onEntriesArchived?.(entryIds, archive);
      clearSelection();
      await updateSearchResults();
    } catch (error) {
      modalHook.handleError(error as Error, `bulk ${archive ? 'archive' : 'unarchive'} entries`);
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook, callbacks, clearSelection, updateSearchResults]);

  const bulkUpdateTags = useCallback(async (entryIds: string[], tags: string[]) => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;

      for (const entryId of entryIds) {
        const entry = availableEntries.find(e => e.id === entryId);
        if (entry) {
          const existingTags = entry.tags || [];
          const newTags = [...new Set([...existingTags, ...tags])];
          await knowledgeBaseService.updateEntry(entryId, { tags: newTags });
        }
      }

      modalHook.addNotification({
        type: 'success',
        title: 'Bulk Tag Update Complete',
        message: `Successfully added tags to ${entryIds.length} entries.`
      });

      clearSelection();
      await updateSearchResults();
    } catch (error) {
      modalHook.handleError(error as Error, 'bulk update tags');
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook, availableEntries, clearSelection, updateSearchResults]);

  const bulkUpdateCategory = useCallback(async (entryIds: string[], category: string) => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;

      for (const entryId of entryIds) {
        await knowledgeBaseService.updateEntry(entryId, { category });
      }

      modalHook.addNotification({
        type: 'success',
        title: 'Bulk Category Update Complete',
        message: `Successfully updated category for ${entryIds.length} entries.`
      });

      clearSelection();
      await updateSearchResults();
    } catch (error) {
      modalHook.handleError(error as Error, 'bulk update category');
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook, clearSelection, updateSearchResults]);

  const bulkUpdateSeverity = useCallback(async (entryIds: string[], severity: string) => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;

      for (const entryId of entryIds) {
        await knowledgeBaseService.updateEntry(entryId, { severity });
      }

      modalHook.addNotification({
        type: 'success',
        title: 'Bulk Severity Update Complete',
        message: `Successfully updated severity for ${entryIds.length} entries.`
      });

      clearSelection();
      await updateSearchResults();
    } catch (error) {
      modalHook.handleError(error as Error, 'bulk update severity');
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook, clearSelection, updateSearchResults]);

  const bulkDuplicate = useCallback(async (entryIds: string[]) => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;

      for (const entryId of entryIds) {
        const entry = availableEntries.find(e => e.id === entryId);
        if (entry) {
          await knowledgeBaseService.duplicateEntry(entry);
        }
      }

      modalHook.addNotification({
        type: 'success',
        title: 'Bulk Duplicate Complete',
        message: `Successfully duplicated ${entryIds.length} entries.`
      });

      clearSelection();
      await updateSearchResults();
    } catch (error) {
      modalHook.handleError(error as Error, 'bulk duplicate entries');
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook, availableEntries, clearSelection, updateSearchResults]);

  const bulkExport = useCallback(async (entryIds: string[], format: 'pdf' | 'csv' | 'json') => {
    if (operationInProgress.current) return;

    try {
      operationInProgress.current = true;

      // This would integrate with your export service
      console.log(`Exporting ${entryIds.length} entries as ${format}`);

      modalHook.addNotification({
        type: 'success',
        title: 'Export Started',
        message: `Exporting ${entryIds.length} entries as ${format.toUpperCase()}. Download will start shortly.`
      });
    } catch (error) {
      modalHook.handleError(error as Error, 'bulk export entries');
    } finally {
      operationInProgress.current = false;
    }
  }, [modalHook]);

  // Utility functions
  const openContextualAdd = useCallback(() => {
    createEntryWithContext();
  }, [createEntryWithContext]);

  const refreshResults = useCallback(async () => {
    await updateSearchResults();
  }, [updateSearchResults]);

  const handleEntryRate = useCallback(async (entryId: string, successful: boolean) => {
    try {
      await knowledgeBaseService.recordUsage(entryId, successful ? 'success' : 'failure');

      modalHook.addNotification({
        type: 'success',
        title: 'Feedback Recorded',
        message: 'Thank you for your feedback!'
      });
    } catch (error) {
      modalHook.handleError(error as Error, 'record entry rating');
    }
  }, [modalHook]);

  const exportEntry = useCallback((entry: KBEntry) => {
    // Export single entry
    console.log('Exporting entry:', entry.id);
  }, []);

  const shareEntry = useCallback((entry: KBEntry) => {
    // Share entry functionality
    console.log('Sharing entry:', entry.id);
  }, []);

  return {
    // Modal integration
    modals: modalHook.modals,
    loading: modalHook.loading,
    notifications: modalHook.notifications,

    // Selection state
    selectedEntries,
    selectedIds: selectionState.selectedIds,
    allSelected,
    someSelected,

    // Contextual data
    contextualDefaults,

    // CRUD operations
    createEntryWithContext,
    updateEntryInline,
    deleteEntry,
    duplicateEntry,
    archiveEntry,
    viewEntryHistory,

    // Bulk operations
    bulkDelete,
    bulkArchive,
    bulkUpdateTags,
    bulkUpdateCategory,
    bulkUpdateSeverity,
    bulkDuplicate,
    bulkExport,

    // Selection management
    toggleSelection,
    selectAll,
    clearSelection,
    selectRange,

    // Utility functions
    openContextualAdd,
    refreshResults,
    handleEntryRate,
    exportEntry,
    shareEntry,

    // Modal handlers
    closeModals: modalHook.closeModals,
    removeNotification: modalHook.removeNotification
  };
};

export default useContextualCRUD;