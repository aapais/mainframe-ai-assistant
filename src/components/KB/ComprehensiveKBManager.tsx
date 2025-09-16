/**
 * Comprehensive KB Entry Manager
 *
 * Main interface component that combines all KB management features:
 * - Advanced entry list with virtual scrolling
 * - Real-time search and filtering
 * - Batch operations with progress tracking
 * - Inline editing and version control
 * - Duplicate detection and AI suggestions
 * - Import/export capabilities
 * - Comprehensive accessibility support
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from 'react';
import { KnowledgeDB, KBEntry } from '../../database/KnowledgeDB';
import { KBCategory } from '../../types/services';
import { BatchOperationsService } from '../../services/BatchOperationsService';
import { VersionControlService, VersionHistory, VersionedEntry, ChangeRecord } from '../../services/VersionControlService';
import { useKBData, SearchOptions } from '../../hooks/useKBData';
import { useBatchOperations } from '../../hooks/useBatchOperations';
import { AdvancedKBEntryList } from './AdvancedKBEntryList';
import { EnhancedKBSearchBar } from '../EnhancedKBSearchBar';
import { KBEntryForm } from '../forms/KBEntryForm';
import { EditEntryForm } from '../forms/EditEntryForm';
import { VersionHistoryModal } from './VersionHistoryModal';
import { VersionCompareModal } from './VersionCompareModal';
import { RollbackConfirmModal } from './RollbackConfirmModal';
import './ComprehensiveKBManager.css';

// ========================
// Types & Interfaces
// ========================

export interface ComprehensiveKBManagerProps {
  className?: string;
  /** Knowledge database instance */
  db: KnowledgeDB;
  /** Initial view mode */
  initialViewMode?: 'list' | 'grid' | 'compact';
  /** Enable advanced features */
  enableAdvancedFeatures?: boolean;
  /** Enable real-time updates */
  realTimeUpdates?: boolean;
  /** Auto-refresh interval in milliseconds */
  autoRefresh?: number;
  /** Maximum entries to display */
  maxEntries?: number;
  /** Event handlers */
  onEntrySelect?: (entry: KBEntry) => void;
  onEntryCreate?: (entry: KBEntry) => void;
  onEntryUpdate?: (entry: KBEntry) => void;
  onEntryDelete?: (entry: KBEntry) => void;
  onBatchOperation?: (operation: string, count: number) => void;
}

interface KBManagerState {
  /** Current view mode */
  viewMode: 'list' | 'grid' | 'compact';
  /** Search and filter state */
  searchState: {
    query: string;
    category?: KBCategory;
    tags: string[];
    sortBy: 'relevance' | 'usage' | 'created' | 'updated' | 'title';
    sortOrder: 'asc' | 'desc';
    useAI: boolean;
  };
  /** UI state */
  uiState: {
    showCreateForm: boolean;
    showFilters: boolean;
    showBatchToolbar: boolean;
    showImportDialog: boolean;
    showExportDialog: boolean;
    showStats: boolean;
    sidebarCollapsed: boolean;
  };
  /** Modal state */
  modals: {
    createEntry: boolean;
    editEntry: KBEntry | null;
    deleteConfirm: KBEntry | null;
    batchDeleteConfirm: string[] | null;
    importData: boolean;
    exportData: boolean;
    versionHistory: KBEntry | null;
    compareVersions: { entry: KBEntry; versionA: number; versionB: number } | null;
    rollbackConfirm: { entry: KBEntry; targetVersion: number } | null;
  };
}

// ========================
// Main Component
// ========================

export const ComprehensiveKBManager: React.FC<ComprehensiveKBManagerProps> = ({
  className = '',
  db,
  initialViewMode = 'list',
  enableAdvancedFeatures = true,
  realTimeUpdates = true,
  autoRefresh = 30000, // 30 seconds
  maxEntries = 1000,
  onEntrySelect,
  onEntryCreate,
  onEntryUpdate,
  onEntryDelete,
  onBatchOperation
}) => {
  // Refs
  const searchBarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Services
  const batchService = useMemo(() => new BatchOperationsService(db), [db]);
  const versionService = useMemo(() => new VersionControlService(db), [db]);

  // Data hooks
  const {
    entries,
    searchResults,
    stats,
    loading,
    error,
    searchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    duplicateEntry,
    refresh,
    exportEntries,
    importEntries,
    getSuggestions
  } = useKBData(db, {
    autoRefresh,
    realTimeUpdates,
    autoLoadEntries: true,
    autoLoadStats: true,
    optimisticUpdates: true
  });

  const {
    operationState,
    selectionState,
    selectedEntries,
    canBatchEdit,
    canBatchDelete,
    canBatchExport,
    selectAll,
    selectNone,
    performBatchUpdate,
    performBatchDelete,
    performBatchDuplicate,
    performBatchExport,
    cancelCurrentOperation
  } = useBatchOperations(entries, undefined, batchService);

  // Component state
  const [state, setState] = useState<KBManagerState>({
    viewMode: initialViewMode,
    searchState: {
      query: '',
      category: undefined,
      tags: [],
      sortBy: 'relevance',
      sortOrder: 'desc',
      useAI: true
    },
    uiState: {
      showCreateForm: false,
      showFilters: false,
      showBatchToolbar: selectionState.selectedCount > 0,
      showImportDialog: false,
      showExportDialog: false,
      showStats: false,
      sidebarCollapsed: false
    },
    modals: {
      createEntry: false,
      editEntry: null,
      deleteConfirm: null,
      batchDeleteConfirm: null,
      importData: false,
      exportData: false,
      versionHistory: null,
      compareVersions: null,
      rollbackConfirm: null
    }
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<KBManagerState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Update search state
  const updateSearchState = useCallback((updates: Partial<typeof state.searchState>) => {
    updateState({
      searchState: { ...state.searchState, ...updates }
    });
  }, [state.searchState, updateState]);

  // Update UI state
  const updateUIState = useCallback((updates: Partial<typeof state.uiState>) => {
    updateState({
      uiState: { ...state.uiState, ...updates }
    });
  }, [state.uiState, updateState]);

  // Update modal state
  const updateModals = useCallback((updates: Partial<typeof state.modals>) => {
    updateState({
      modals: { ...state.modals, ...updates }
    });
  }, [state.modals, updateState]);

  // Current entries to display
  const displayEntries = useMemo(() => {
    if (state.searchState.query || state.searchState.category || state.searchState.tags.length > 0) {
      return searchResults.map(result => result.entry);
    }
    return entries.slice(0, maxEntries);
  }, [entries, searchResults, state.searchState, maxEntries]);

  // Search handler
  const handleSearch = useCallback(async (query: string, filters?: any) => {
    const searchOptions: SearchOptions = {
      query,
      category: filters?.category || state.searchState.category,
      tags: filters?.tags || state.searchState.tags,
      sortBy: state.searchState.sortBy,
      sortOrder: state.searchState.sortOrder,
      useAI: state.searchState.useAI,
      limit: maxEntries
    };

    updateSearchState({ query });

    try {
      await searchEntries(searchOptions);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [searchEntries, state.searchState, maxEntries, updateSearchState]);

  // Filter handlers
  const handleCategoryFilter = useCallback((category?: KBCategory) => {
    updateSearchState({ category });
    handleSearch(state.searchState.query, { category });
  }, [state.searchState.query, handleSearch, updateSearchState]);

  const handleTagFilter = useCallback((tags: string[]) => {
    updateSearchState({ tags });
    handleSearch(state.searchState.query, { tags });
  }, [state.searchState.query, handleSearch, updateSearchState]);

  const handleSortChange = useCallback((sortBy: string, sortOrder?: 'asc' | 'desc') => {
    const newSortOrder = sortOrder || (sortBy === state.searchState.sortBy && state.searchState.sortOrder === 'desc' ? 'asc' : 'desc');
    updateSearchState({ sortBy: sortBy as any, sortOrder: newSortOrder });
    handleSearch(state.searchState.query);
  }, [state.searchState, handleSearch, updateSearchState]);

  // Entry handlers
  const handleEntrySelect = useCallback((entry: KBEntry) => {
    onEntrySelect?.(entry);
  }, [onEntrySelect]);

  const handleEntryCreate = useCallback(async (entryData: Omit<KBEntry, 'id'>) => {
    try {
      const newId = await addEntry(entryData);
      const newEntry = { ...entryData, id: newId } as KBEntry;

      updateModals({ createEntry: false });
      onEntryCreate?.(newEntry);

      // Show success message
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Entry "${entryData.title}" created successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      }, 100);
    } catch (error) {
      console.error('Failed to create entry:', error);
    }
  }, [addEntry, onEntryCreate, updateModals]);

  const handleEntryUpdate = useCallback(async (
    entryId: string,
    updates: Partial<KBEntry>,
    changeSummary?: string,
    editorName: string = 'User'
  ) => {
    try {
      // Update the entry first
      await updateEntry(entryId, updates);
      const updatedEntry = { ...entries.find(e => e.id === entryId), ...updates } as KBEntry;

      // Create version control record
      if (versionService && updatedEntry) {
        try {
          await versionService.createVersion(
            updatedEntry,
            'current-user',
            editorName,
            changeSummary || 'Entry updated'
          );
        } catch (versionError) {
          console.warn('Version control failed:', versionError);
          // Continue anyway - version control shouldn't block the update
        }
      }

      updateModals({ editEntry: null });
      onEntryUpdate?.(updatedEntry);

      // Show success message
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Entry updated successfully${changeSummary ? ' - ' + changeSummary : ''}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      }, 100);
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  }, [updateEntry, entries, onEntryUpdate, updateModals, versionService]);

  const handleEntryDelete = useCallback(async (entryId: string) => {
    try {
      const entry = entries.find(e => e.id === entryId);
      await deleteEntry(entryId);

      updateModals({ deleteConfirm: null });
      if (entry) {
        onEntryDelete?.(entry);
      }

      // Show success message
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Entry deleted successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      }, 100);
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  }, [deleteEntry, entries, onEntryDelete, updateModals]);

  const handleEntryDuplicate = useCallback(async (entryId: string) => {
    try {
      await duplicateEntry(entryId);

      // Show success message
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Entry duplicated successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      }, 100);
    } catch (error) {
      console.error('Failed to duplicate entry:', error);
    }
  }, [duplicateEntry]);

  // Batch operation handlers
  const handleBatchUpdate = useCallback(async (updates: Partial<KBEntry>) => {
    try {
      await performBatchUpdate(updates);
      onBatchOperation?.('update', selectionState.selectedCount);
    } catch (error) {
      console.error('Batch update failed:', error);
    }
  }, [performBatchUpdate, onBatchOperation, selectionState.selectedCount]);

  const handleBatchDelete = useCallback(async () => {
    try {
      await performBatchDelete();
      updateModals({ batchDeleteConfirm: null });
      onBatchOperation?.('delete', selectionState.selectedCount);
    } catch (error) {
      console.error('Batch delete failed:', error);
    }
  }, [performBatchDelete, onBatchOperation, selectionState.selectedCount, updateModals]);

  const handleBatchDuplicate = useCallback(async () => {
    try {
      await performBatchDuplicate();
      onBatchOperation?.('duplicate', selectionState.selectedCount);
    } catch (error) {
      console.error('Batch duplicate failed:', error);
    }
  }, [performBatchDuplicate, onBatchOperation, selectionState.selectedCount]);

  // Version Control Handlers
  const handleShowVersionHistory = useCallback((entry: KBEntry) => {
    updateModals({ versionHistory: entry });
  }, [updateModals]);

  const handleCompareVersions = useCallback((entry: KBEntry, versionA: number, versionB: number) => {
    updateModals({ compareVersions: { entry, versionA, versionB } });
  }, [updateModals]);

  const handleRollbackRequest = useCallback((entry: KBEntry, targetVersion: number) => {
    updateModals({ rollbackConfirm: { entry, targetVersion } });
  }, [updateModals]);

  const handleConfirmRollback = useCallback(async (
    entry: KBEntry,
    targetVersion: number,
    changeSummary?: string
  ) => {
    try {
      const rolledBackVersion = await versionService.rollbackToVersion(
        entry.id!,
        targetVersion,
        'current-user',
        'User',
        {
          target_version: targetVersion,
          create_backup: true,
          merge_strategy: 'overwrite',
          change_summary: changeSummary || `Rolled back to version ${targetVersion}`
        }
      );

      // Update the local entry
      await updateEntry(entry.id!, rolledBackVersion);

      updateModals({ rollbackConfirm: null });

      // Show success message
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Entry rolled back to version ${targetVersion} successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      }, 100);
    } catch (error) {
      console.error('Rollback failed:', error);
      // Show error message
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.textContent = `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 5000);
      }, 100);
    }
  }, [versionService, updateEntry, updateModals]);

  const handleGetVersionHistory = useCallback(async (entryId: string): Promise<VersionHistory | null> => {
    try {
      return await versionService.getVersionHistory(entryId);
    } catch (error) {
      console.error('Failed to get version history:', error);
      return null;
    }
  }, [versionService]);

  const handleGetRecentChanges = useCallback(async (limit: number = 20): Promise<ChangeRecord[]> => {
    try {
      return await versionService.getRecentChanges(limit);
    } catch (error) {
      console.error('Failed to get recent changes:', error);
      return [];
    }
  }, [versionService]);

  const handleBatchExport = useCallback(async (format: string) => {
    try {
      const result = await performBatchExport(format);

      if (result.success && result.results[0]?.data) {
        // Download the exported data
        const blob = new Blob([result.results[0].data], {
          type: format === 'json' ? 'application/json' : 'text/csv'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kb_export_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      onBatchOperation?.('export', selectionState.selectedCount);
    } catch (error) {
      console.error('Batch export failed:', error);
    }
  }, [performBatchExport, onBatchOperation, selectionState.selectedCount]);

  // Import/Export handlers
  const handleImport = useCallback(async (data: string, format: string) => {
    try {
      const count = await importEntries(data, format as any);
      updateModals({ importData: false });

      // Show success message
      setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Successfully imported ${count} entries`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
      }, 100);
    } catch (error) {
      console.error('Import failed:', error);
    }
  }, [importEntries, updateModals]);

  const handleExportAll = useCallback(async (format: string) => {
    try {
      const data = await exportEntries(format as any);

      // Download the exported data
      const blob = new Blob([data], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kb_full_export_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateModals({ exportData: false });
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [exportEntries, updateModals]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            updateModals({ createEntry: true });
            break;
          case 'f':
            e.preventDefault();
            searchBarRef.current?.querySelector('input')?.focus();
            break;
          case 'r':
            e.preventDefault();
            refresh();
            break;
          case 'a':
            if (!e.shiftKey) {
              e.preventDefault();
              selectAll();
            }
            break;
          case 'Escape':
            e.preventDefault();
            selectNone();
            updateModals({
              createEntry: false,
              editEntry: null,
              deleteConfirm: null,
              batchDeleteConfirm: null,
              importData: false,
              exportData: false
            });
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [updateModals, refresh, selectAll, selectNone]);

  // Update batch toolbar visibility
  useEffect(() => {
    updateUIState({ showBatchToolbar: selectionState.selectedCount > 0 });
  }, [selectionState.selectedCount, updateUIState]);

  // Render helpers
  const renderHeader = () => (
    <div className="kb-manager-header card card-header">
      <div className="flex items-center justify-between">
        <div className="header-title">
          <h1 className="heading-1">Knowledge Base Manager</h1>
          {stats && (
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="badge badge-primary">{stats.totalEntries}</span>
                <span className="body-small text-gray-600">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-secondary">{stats.searchesToday}</span>
                <span className="body-small text-gray-600">searches today</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-success">{Math.round(stats.averageSuccessRate)}%</span>
                <span className="body-small text-gray-600">success rate</span>
              </div>
            </div>
          )}
        </div>

        <div className="header-actions flex items-center gap-3">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => updateUIState({ showStats: !state.uiState.showStats })}
            title="Toggle statistics"
          >
            📊 Stats
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => updateModals({ importData: true })}
            title="Import entries (Ctrl+I)"
          >
            📥 Import
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => updateModals({ exportData: true })}
            title="Export entries (Ctrl+E)"
          >
            📤 Export
          </button>

          <button
            className="btn btn-primary"
            onClick={() => updateModals({ createEntry: true })}
            title="Create new entry (Ctrl+N)"
          >
            ➕ New Entry
          </button>
        </div>
      </div>
    </div>
  );

  const renderSearchBar = () => (
    <div ref={searchBarRef} className="search-section card">
      <div className="card-body">
        <EnhancedKBSearchBar
          searchQuery={state.searchState.query}
          categoryFilter={state.searchState.category}
          tagFilter={state.searchState.tags}
          useAI={state.searchState.useAI}
          onSearch={handleSearch}
          onCategorySelect={handleCategoryFilter}
          onTagSelect={handleTagFilter}
          onAIToggle={(enabled) => updateSearchState({ useAI: enabled })}
          showFilters={true}
          showHistory={true}
          showSuggestions={true}
          autoFocus={false}
        />
      </div>
    </div>
  );

  const renderViewControls = () => (
    <div className="view-controls card">
      <div className="card-body flex items-center justify-between">
        <div className="view-mode-toggle flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <button
            className={`px-3 py-2 text-sm transition-colors ${
              state.viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => updateState({ viewMode: 'list' })}
            title="List view"
          >
            📋
          </button>
          <button
            className={`px-3 py-2 text-sm transition-colors border-l border-gray-300 ${
              state.viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => updateState({ viewMode: 'grid' })}
            title="Grid view"
          >
            ⊞
          </button>
          <button
            className={`px-3 py-2 text-sm transition-colors border-l border-gray-300 ${
              state.viewMode === 'compact'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => updateState({ viewMode: 'compact' })}
            title="Compact view"
          >
            ☰
          </button>
        </div>

        <div className="sort-controls flex items-center gap-3">
          <label htmlFor="sort-select" className="body-small text-gray-600 font-medium">Sort by:</label>
          <select
            id="sort-select"
            value={state.searchState.sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="input input-sm border-gray-300 rounded-md"
          >
            <option value="relevance">Relevance</option>
            <option value="usage">Usage</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="title">Title</option>
          </select>

          <button
            className={`btn btn-sm btn-outline ${
              state.searchState.sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-600'
            }`}
            onClick={() => handleSortChange(state.searchState.sortBy, state.searchState.sortOrder === 'desc' ? 'asc' : 'desc')}
            title={`Sort ${state.searchState.sortOrder === 'desc' ? 'ascending' : 'descending'}`}
          >
            {state.searchState.sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderEntryList = () => (
    <div ref={listRef} className="entry-list-container card">
      <div className="card-header">
        <h2 className="heading-3">Knowledge Base Entries</h2>
        <p className="body-small text-gray-600">
          {displayEntries.length} entries displayed
          {state.searchState.query && ` matching "${state.searchState.query}"`}
        </p>
      </div>
      <div className="card-body p-0">
        <AdvancedKBEntryList
          entries={displayEntries}
          viewMode={state.viewMode}
          searchQuery={state.searchState.query}
          categoryFilter={state.searchState.category}
          tagFilter={state.searchState.tags}
          sortBy={state.searchState.sortBy}
          sortOrder={state.searchState.sortOrder}
          height={600}
          itemHeight={state.viewMode === 'compact' ? 80 : state.viewMode === 'grid' ? 200 : 120}
          showPreview={state.viewMode !== 'compact'}
          showMetrics={true}
          enableBatchSelect={true}
          enableInlineEdit={true}
          enableQuickActions={true}
          onEntrySelect={handleEntrySelect}
          onEntryEdit={(entry) => updateModals({ editEntry: entry })}
          onEntryDelete={(entry) => updateModals({ deleteConfirm: entry })}
          onEntryCopy={handleEntryDuplicate}
          onShowVersionHistory={handleShowVersionHistory}
          onCompareVersions={handleCompareVersions}
          onRollback={handleRollbackRequest}
          onBatchOperation={(operation, entries) => {
            switch (operation) {
              case 'edit':
                // TODO: Implement batch edit dialog
                break;
              case 'delete':
                updateModals({ batchDeleteConfirm: entries.map(e => e.id!).filter(Boolean) });
                break;
              case 'duplicate':
                handleBatchDuplicate();
                break;
              case 'export':
                handleBatchExport('json');
                break;
            }
          }}
        />
      </div>
    </div>
  );

  // Main render
  return (
    <div className={`comprehensive-kb-manager ${className} space-y-6 p-6`}>
      {/* Header */}
      {renderHeader()}

      {/* Search Bar */}
      {renderSearchBar()}

      {/* View Controls */}
      {renderViewControls()}

      {/* Entry List */}
      {renderEntryList()}

      {/* Progress Indicator */}
      {operationState.isOperating && operationState.progress && (
        <div className="alert alert-info animate-slide-up" role="status" aria-live="polite">
          <div className="progress-bar mb-3">
            <div
              className="progress-fill"
              style={{ width: `${operationState.progress.percentComplete}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="progress-text">
              <div className="font-medium">
                {operationState.progress.currentOperation || operationState.activeOperation}
              </div>
              <div className="text-sm text-gray-600">
                {operationState.progress.processed} of {operationState.progress.total}
                {operationState.progress.estimatedTimeRemaining && (
                  <span> • {Math.round(operationState.progress.estimatedTimeRemaining / 1000)}s remaining</span>
                )}
              </div>
            </div>
            <button
              className="btn btn-sm btn-outline"
              onClick={cancelCurrentOperation}
              aria-label="Cancel operation"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Entry Modal */}
      {state.modals.createEntry && (
        <div className="modal-overlay" onClick={() => updateModals({ createEntry: false })}>
          <div className="modal animate-fade-in" onClick={e => e.stopPropagation()}>
            <KBEntryForm
              title="Create New Entry"
              submitLabel="Create Entry"
              onSubmit={handleEntryCreate}
              onCancel={() => updateModals({ createEntry: false })}
            />
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {state.modals.editEntry && (
        <div className="modal-overlay" onClick={() => updateModals({ editEntry: null })}>
          <div className="modal animate-fade-in" onClick={e => e.stopPropagation()}>
            <EditEntryForm
              entry={state.modals.editEntry}
              onSubmit={(updates) => handleEntryUpdate(state.modals.editEntry!.id!, updates)}
              onCancel={() => updateModals({ editEntry: null })}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {state.modals.deleteConfirm && (
        <div className="modal-overlay" onClick={() => updateModals({ deleteConfirm: null })}>
          <div className="modal modal-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Entry</h3>
            </div>
            <div className="modal-body">
              <p className="body-text mb-3">Are you sure you want to delete "{state.modals.deleteConfirm.title}"?</p>
              <div className="alert alert-warning">
                <div className="alert-title">Warning</div>
                This action cannot be undone.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => updateModals({ deleteConfirm: null })}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={() => handleEntryDelete(state.modals.deleteConfirm!.id!)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {state.modals.batchDeleteConfirm && (
        <div className="modal-overlay" onClick={() => updateModals({ batchDeleteConfirm: null })}>
          <div className="modal modal-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Multiple Entries</h3>
            </div>
            <div className="modal-body">
              <p className="body-text mb-3">
                Are you sure you want to delete <span className="font-medium">{state.modals.batchDeleteConfirm.length}</span> selected entries?
              </p>
              <div className="alert alert-warning">
                <div className="alert-title">Warning</div>
                This action cannot be undone.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => updateModals({ batchDeleteConfirm: null })}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleBatchDelete}
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {state.modals.versionHistory && (
        <VersionHistoryModal
          entry={state.modals.versionHistory}
          versionService={versionService}
          onClose={() => updateModals({ versionHistory: null })}
          onCompareVersions={handleCompareVersions}
          onRollback={handleRollbackRequest}
        />
      )}

      {/* Version Comparison Modal */}
      {state.modals.compareVersions && (
        <VersionCompareModal
          entry={state.modals.compareVersions.entry}
          versionA={state.modals.compareVersions.versionA}
          versionB={state.modals.compareVersions.versionB}
          versionService={versionService}
          onClose={() => updateModals({ compareVersions: null })}
          onRollback={handleRollbackRequest}
        />
      )}

      {/* Rollback Confirmation Modal */}
      {state.modals.rollbackConfirm && (
        <RollbackConfirmModal
          entry={state.modals.rollbackConfirm.entry}
          targetVersion={state.modals.rollbackConfirm.targetVersion}
          onConfirm={handleConfirmRollback}
          onCancel={() => updateModals({ rollbackConfirm: null })}
        />
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="keyboard-shortcuts" style={{ display: 'none' }}>
        <h4>Keyboard Shortcuts</h4>
        <ul>
          <li><kbd>Ctrl+N</kbd> - New entry</li>
          <li><kbd>Ctrl+F</kbd> - Focus search</li>
          <li><kbd>Ctrl+R</kbd> - Refresh</li>
          <li><kbd>Ctrl+A</kbd> - Select all</li>
          <li><kbd>Escape</kbd> - Cancel/Clear selection</li>
        </ul>
      </div>
    </div>
  );
};

export default ComprehensiveKBManager;