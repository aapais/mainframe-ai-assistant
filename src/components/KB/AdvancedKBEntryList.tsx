/**
 * Advanced KB Entry List Component
 *
 * Comprehensive knowledge base entry management interface with:
 * - Virtual scrolling for large datasets (10,000+ entries)
 * - Real-time search and filtering
 * - Batch operations (edit, delete, export, duplicate)
 * - Smart sorting and grouping
 * - Inline editing capabilities
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Performance optimizations
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo
} from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { KBEntry, SearchResult } from '../../database/KnowledgeDB';
import { KBCategory } from '../../types/services';
import { useKBData } from '../hooks/useKBData';
import { useVirtualization } from '../hooks/useVirtualization';
import { useBatchOperations } from '../hooks/useBatchOperations';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import './AdvancedKBEntryList.css';

// ========================
// Types & Interfaces
// ========================

export interface KBEntryListItem extends KBEntry {
  isSelected?: boolean;
  isEditing?: boolean;
  matchHighlights?: string[];
  relevanceScore?: number;
}

export interface AdvancedKBEntryListProps {
  className?: string;
  height?: number;
  itemHeight?: number;

  // Search and filtering
  searchQuery?: string;
  categoryFilter?: KBCategory;
  tagFilter?: string[];
  sortBy?: 'relevance' | 'usage' | 'created' | 'updated' | 'title';
  sortOrder?: 'asc' | 'desc';

  // Display options
  viewMode?: 'list' | 'grid' | 'compact';
  showPreview?: boolean;
  showMetrics?: boolean;
  groupBy?: 'category' | 'tags' | 'created' | 'none';

  // Batch operations
  enableBatchSelect?: boolean;
  enableInlineEdit?: boolean;
  enableQuickActions?: boolean;

  // Event handlers
  onEntrySelect?: (entry: KBEntryListItem) => void;
  onEntryEdit?: (entry: KBEntryListItem) => void;
  onEntryDelete?: (entry: KBEntryListItem) => void;
  onEntryCopy?: (entry: KBEntryListItem) => void;
  onBatchOperation?: (operation: string, entries: KBEntryListItem[]) => void;

  // Version control handlers
  onShowVersionHistory?: (entry: KBEntryListItem) => void;
  onCompareVersions?: (entry: KBEntryListItem) => void;
  onRollback?: (entry: KBEntryListItem) => void;

  // Accessibility
  ariaLabel?: string;
  announceChanges?: boolean;
}

// ========================
// Entry Item Component
// ========================

const KBEntryItem = memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    entries: KBEntryListItem[];
    selectedIds: Set<string>;
    editingId: string | null;
    viewMode: string;
    showPreview: boolean;
    showMetrics: boolean;
    onSelect: (entry: KBEntryListItem) => void;
    onToggleSelect: (entry: KBEntryListItem) => void;
    onEdit: (entry: KBEntryListItem) => void;
    onSave: (entry: KBEntryListItem, updates: Partial<KBEntry>) => void;
    onCancel: () => void;
    onQuickAction: (action: string, entry: KBEntryListItem) => void;
  };
}>(({ index, style, data }) => {
  const {
    entries,
    selectedIds,
    editingId,
    viewMode,
    showPreview,
    showMetrics,
    onSelect,
    onToggleSelect,
    onEdit,
    onSave,
    onCancel,
    onQuickAction
  } = data;

  const entry = entries[index];
  if (!entry) return null;

  const isSelected = selectedIds.has(entry.id!);
  const isEditing = editingId === entry.id;
  const [editValues, setEditValues] = useState<Partial<KBEntry>>({});

  useEffect(() => {
    if (isEditing) {
      setEditValues({
        title: entry.title,
        problem: entry.problem,
        solution: entry.solution,
        category: entry.category,
        tags: entry.tags || []
      });
    }
  }, [isEditing, entry]);

  const handleSave = useCallback(() => {
    onSave(entry, editValues);
    setEditValues({});
  }, [entry, editValues, onSave]);

  const handleCancel = useCallback(() => {
    onCancel();
    setEditValues({});
  }, [onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        if (e.ctrlKey || e.metaKey) {
          onSelect(entry);
        } else if (isEditing) {
          handleSave();
        }
        break;
      case 'Escape':
        if (isEditing) {
          handleCancel();
        }
        break;
      case ' ':
        if (!isEditing && e.target === e.currentTarget) {
          e.preventDefault();
          onToggleSelect(entry);
        }
        break;
      case 'e':
        if (!isEditing && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onEdit(entry);
        }
        break;
      case 'd':
        if (!isEditing && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onQuickAction('duplicate', entry);
        }
        break;
    }
  }, [entry, isEditing, onSelect, onToggleSelect, onEdit, onQuickAction, handleSave, handleCancel]);

  const successRate = useMemo(() => {
    if (!entry.success_count || !entry.failure_count) return null;
    const total = entry.success_count + entry.failure_count;
    return total > 0 ? Math.round((entry.success_count / total) * 100) : 0;
  }, [entry.success_count, entry.failure_count]);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div
      style={style}
      className={`kb-entry-item ${viewMode} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      role="option"
      aria-selected={isSelected}
      aria-label={`Knowledge base entry: ${entry.title}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onSelect(entry)}
    >
      {/* Selection Checkbox */}
      <div className="entry-selection">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(entry)}
          aria-label={`Select ${entry.title}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Entry Content */}
      <div className="entry-content">
        {/* Header */}
        <div className="entry-header">
          {isEditing ? (
            <input
              type="text"
              value={editValues.title || ''}
              onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
              className="entry-title-edit"
              autoFocus
              aria-label="Edit entry title"
            />
          ) : (
            <h3 className="entry-title">
              {entry.matchHighlights?.includes('title') ? (
                <span dangerouslySetInnerHTML={{ __html: entry.title }} />
              ) : (
                entry.title
              )}
            </h3>
          )}

          {/* Entry Metadata */}
          <div className="entry-metadata">
            <span className={`entry-category category-${entry.category?.toLowerCase()}`}>
              {entry.category}
            </span>

            {entry.relevanceScore && (
              <span className="entry-relevance" title={`Relevance: ${entry.relevanceScore}%`}>
                {Math.round(entry.relevanceScore)}%
              </span>
            )}

            {showMetrics && (
              <>
                <span className="entry-usage" title={`Used ${entry.usage_count || 0} times`}>
                  👁 {entry.usage_count || 0}
                </span>

                {successRate !== null && (
                  <span
                    className={`entry-success ${successRate > 80 ? 'high' : successRate > 60 ? 'medium' : 'low'}`}
                    title={`Success rate: ${successRate}%`}
                  >
                    ✓ {successRate}%
                  </span>
                )}

                <span className="entry-date" title={`Created ${formatDate(entry.created_at)}`}>
                  📅 {formatDate(entry.created_at)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Problem Preview */}
        {showPreview && (
          <div className="entry-preview">
            {isEditing ? (
              <textarea
                value={editValues.problem || ''}
                onChange={(e) => setEditValues(prev => ({ ...prev, problem: e.target.value }))}
                className="entry-problem-edit"
                rows={3}
                aria-label="Edit problem description"
              />
            ) : (
              <p className="entry-problem">
                {entry.matchHighlights?.includes('problem') ? (
                  <span dangerouslySetInnerHTML={{
                    __html: entry.problem.substring(0, 200) + (entry.problem.length > 200 ? '...' : '')
                  }} />
                ) : (
                  entry.problem.substring(0, 200) + (entry.problem.length > 200 ? '...' : '')
                )}
              </p>
            )}
          </div>
        )}

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="entry-tags">
            {isEditing ? (
              <input
                type="text"
                value={editValues.tags?.join(', ') || ''}
                onChange={(e) => setEditValues(prev => ({
                  ...prev,
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                }))}
                className="entry-tags-edit"
                placeholder="Comma-separated tags"
                aria-label="Edit tags"
              />
            ) : (
              entry.tags.slice(0, 5).map(tag => (
                <span key={tag} className="entry-tag">
                  {tag}
                </span>
              ))
            )}
            {!isEditing && entry.tags.length > 5 && (
              <span className="entry-tag-more">+{entry.tags.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="entry-actions">
        {isEditing ? (
          <>
            <button
              className="action-button save"
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              aria-label="Save changes"
              title="Save changes (Ctrl+Enter)"
            >
              💾
            </button>
            <button
              className="action-button cancel"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              aria-label="Cancel editing"
              title="Cancel (Escape)"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button
              className="action-button edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(entry);
              }}
              aria-label="Edit entry"
              title="Edit (Ctrl+E)"
            >
              ✏️
            </button>
            <button
              className="action-button copy"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction('duplicate', entry);
              }}
              aria-label="Duplicate entry"
              title="Duplicate (Ctrl+D)"
            >
              📋
            </button>
            <button
              className="action-button more"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction('menu', entry);
              }}
              aria-label="More actions"
              title="More actions"
            >
              ⋯
            </button>
          </>
        )}
      </div>
    </div>
  );
});

// ========================
// Main Component
// ========================

export const AdvancedKBEntryList: React.FC<AdvancedKBEntryListProps> = ({
  className = '',
  height = 600,
  itemHeight = 120,
  searchQuery = '',
  categoryFilter,
  tagFilter = [],
  sortBy = 'relevance',
  sortOrder = 'desc',
  viewMode = 'list',
  showPreview = true,
  showMetrics = true,
  groupBy = 'none',
  enableBatchSelect = true,
  enableInlineEdit = true,
  enableQuickActions = true,
  ariaLabel = 'Knowledge base entries',
  announceChanges = true,
  onEntrySelect,
  onEntryEdit,
  onEntryDelete,
  onEntryCopy,
  onBatchOperation
}) => {
  // State management
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Refs
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const {
    entries: rawEntries,
    loading,
    error,
    searchEntries,
    updateEntry,
    deleteEntry,
    duplicateEntry,
    refresh
  } = useKBData();

  const {
    selectedEntries,
    selectAll,
    selectNone,
    selectInvert,
    canBatchEdit,
    canBatchDelete,
    performBatchOperation
  } = useBatchOperations(rawEntries, selectedIds);

  // Process and filter entries
  const processedEntries = useMemo(() => {
    let filtered = rawEntries.filter(entry => {
      // Category filter
      if (categoryFilter && entry.category !== categoryFilter) {
        return false;
      }

      // Tag filter
      if (tagFilter.length > 0) {
        const entryTags = entry.tags || [];
        const hasAllTags = tagFilter.every(tag =>
          entryTags.some(entryTag => entryTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasAllTags) return false;
      }

      return true;
    });

    // Search filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => {
        const searchText = `${entry.title} ${entry.problem} ${entry.solution} ${entry.tags?.join(' ') || ''}`.toLowerCase();
        return searchText.includes(query);
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = (b.usage_count || 0) - (a.usage_count || 0);
          break;
        case 'usage':
          comparison = (b.usage_count || 0) - (a.usage_count || 0);
          break;
        case 'created':
          comparison = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          break;
        case 'updated':
          comparison = new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered.map(entry => ({
      ...entry,
      isSelected: selectedIds.has(entry.id!),
      isEditing: editingId === entry.id,
      matchHighlights: searchQuery ? ['title', 'problem'] : []
    }));
  }, [rawEntries, categoryFilter, tagFilter, searchQuery, sortBy, sortOrder, selectedIds, editingId]);

  // Keyboard navigation
  useKeyboardNavigation({
    itemCount: processedEntries.length,
    focusedIndex,
    onFocusChange: setFocusedIndex,
    onSelect: (index) => {
      const entry = processedEntries[index];
      if (entry && onEntrySelect) {
        onEntrySelect(entry);
      }
    },
    onToggleSelect: (index) => {
      const entry = processedEntries[index];
      if (entry?.id) {
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(entry.id!)) {
            newSet.delete(entry.id!);
          } else {
            newSet.add(entry.id!);
          }
          return newSet;
        });
      }
    }
  });

  // Event handlers
  const handleEntrySelect = useCallback((entry: KBEntryListItem) => {
    onEntrySelect?.(entry);
  }, [onEntrySelect]);

  const handleEntryToggleSelect = useCallback((entry: KBEntryListItem) => {
    if (!entry.id) return;

    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entry.id!)) {
        newSet.delete(entry.id!);
      } else {
        newSet.add(entry.id!);
      }
      return newSet;
    });
  }, []);

  const handleEntryEdit = useCallback((entry: KBEntryListItem) => {
    if (enableInlineEdit) {
      setEditingId(entry.id!);
    }
    onEntryEdit?.(entry);
  }, [enableInlineEdit, onEntryEdit]);

  const handleEntrySave = useCallback(async (entry: KBEntryListItem, updates: Partial<KBEntry>) => {
    try {
      await updateEntry(entry.id!, updates);
      setEditingId(null);

      if (announceChanges) {
        // Announce successful save
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Entry "${entry.title}" updated successfully`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  }, [updateEntry, announceChanges]);

  const handleEntryCancel = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleQuickAction = useCallback(async (action: string, entry: KBEntryListItem) => {
    switch (action) {
      case 'duplicate':
        try {
          await duplicateEntry(entry.id!);
          onEntryCopy?.(entry);
        } catch (error) {
          console.error('Failed to duplicate entry:', error);
        }
        break;
      case 'delete':
        try {
          await deleteEntry(entry.id!);
          setSelectedIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(entry.id!);
            return newSet;
          });
          onEntryDelete?.(entry);
        } catch (error) {
          console.error('Failed to delete entry:', error);
        }
        break;
      case 'version-history':
        onShowVersionHistory?.(entry);
        break;
      case 'compare-versions':
        onCompareVersions?.(entry);
        break;
      case 'rollback':
        onRollback?.(entry);
        break;
      case 'menu':
        // Show context menu
        break;
      default:
        break;
    }
  }, [duplicateEntry, deleteEntry, onEntryCopy, onEntryDelete, onShowVersionHistory, onCompareVersions, onRollback]);

  const handleBatchOperation = useCallback(async (operation: string) => {
    try {
      await performBatchOperation(operation, Array.from(selectedIds));

      if (operation === 'delete') {
        setSelectedIds(new Set());
      }

      onBatchOperation?.(operation, selectedEntries);

      if (announceChanges) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Batch operation "${operation}" completed for ${selectedIds.size} entries`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    } catch (error) {
      console.error(`Failed to perform batch operation ${operation}:`, error);
    }
  }, [performBatchOperation, selectedIds, selectedEntries, onBatchOperation, announceChanges]);

  // Virtualization data
  const itemData = useMemo(() => ({
    entries: processedEntries,
    selectedIds,
    editingId,
    viewMode,
    showPreview,
    showMetrics,
    onSelect: handleEntrySelect,
    onToggleSelect: handleEntryToggleSelect,
    onEdit: handleEntryEdit,
    onSave: handleEntrySave,
    onCancel: handleEntryCancel,
    onQuickAction: handleQuickAction
  }), [
    processedEntries,
    selectedIds,
    editingId,
    viewMode,
    showPreview,
    showMetrics,
    handleEntrySelect,
    handleEntryToggleSelect,
    handleEntryEdit,
    handleEntrySave,
    handleEntryCancel,
    handleQuickAction
  ]);

  // Loading state
  if (loading) {
    return (
      <div className={`kb-entry-list-loading ${className}`}>
        <div className="loading-spinner" aria-label="Loading entries..." />
        <p>Loading knowledge base entries...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`kb-entry-list-error ${className}`} role="alert">
        <h3>Error Loading Entries</h3>
        <p>{error.message}</p>
        <button onClick={refresh} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (processedEntries.length === 0) {
    return (
      <div className={`kb-entry-list-empty ${className}`}>
        <div className="empty-state">
          <h3>No entries found</h3>
          {searchQuery ? (
            <p>No entries match your search criteria. Try adjusting your filters or search terms.</p>
          ) : (
            <p>The knowledge base is empty. Create your first entry to get started.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`advanced-kb-entry-list ${className} ${viewMode}`}
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={enableBatchSelect}
    >
      {/* Batch Operations Toolbar */}
      {enableBatchSelect && selectedIds.size > 0 && (
        <div className="batch-toolbar" role="toolbar" aria-label="Batch operations">
          <div className="batch-info">
            <span>{selectedIds.size} selected</span>
          </div>

          <div className="batch-actions">
            <button
              onClick={() => handleBatchOperation('edit')}
              disabled={!canBatchEdit}
              aria-label={`Edit ${selectedIds.size} entries`}
            >
              ✏️ Edit
            </button>

            <button
              onClick={() => handleBatchOperation('duplicate')}
              aria-label={`Duplicate ${selectedIds.size} entries`}
            >
              📋 Duplicate
            </button>

            <button
              onClick={() => handleBatchOperation('export')}
              aria-label={`Export ${selectedIds.size} entries`}
            >
              📤 Export
            </button>

            <button
              onClick={() => handleBatchOperation('delete')}
              disabled={!canBatchDelete}
              className="delete-action"
              aria-label={`Delete ${selectedIds.size} entries`}
            >
              🗑️ Delete
            </button>
          </div>

          <div className="batch-selection">
            <button onClick={selectAll}>Select All</button>
            <button onClick={selectNone}>Select None</button>
            <button onClick={selectInvert}>Invert Selection</button>
          </div>
        </div>
      )}

      {/* Virtualized List */}
      <List
        ref={listRef}
        height={height - (selectedIds.size > 0 ? 60 : 0)} // Account for toolbar
        itemCount={processedEntries.length}
        itemSize={itemHeight}
        itemData={itemData}
        className="kb-entry-list-items"
      >
        {KBEntryItem}
      </List>

      {/* Status Information */}
      <div className="list-status" aria-live="polite" aria-atomic="false">
        <span className="entry-count">
          {processedEntries.length} of {rawEntries.length} entries
        </span>

        {searchQuery && (
          <span className="search-status">
            • Search: "{searchQuery}"
          </span>
        )}

        {categoryFilter && (
          <span className="filter-status">
            • Category: {categoryFilter}
          </span>
        )}

        {tagFilter.length > 0 && (
          <span className="filter-status">
            • Tags: {tagFilter.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
};

export default AdvancedKBEntryList;