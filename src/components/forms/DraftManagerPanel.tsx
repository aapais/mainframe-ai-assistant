/**
 * Draft Manager Panel Component
 *
 * Panel for managing drafts with:
 * - List of all available drafts with metadata
 * - Preview of draft content
 * - Search and filter capabilities
 * - Version history for each draft
 * - Import/export functionality
 *
 * @author Swarm Coordinator
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import './DraftManagerPanel.css';

// ========================
// Types & Interfaces
// ========================

export interface DraftMetadata {
  id: string;
  entryId?: string;
  created: Date;
  updated: Date;
  versions: any[];
  isActive: boolean;
  editor: string;
  title: string;
}

export interface DraftManagerPanelProps {
  drafts: DraftMetadata[];
  currentDraft: DraftMetadata | null;
  onLoadDraft: (draftId: string) => Promise<void>;
  onDeleteDraft: (draftId: string) => Promise<void>;
  onClose: () => void;
  className?: string;
}

interface FilterOptions {
  search: string;
  editor: string;
  dateRange: 'all' | 'today' | 'week' | 'month';
  sortBy: 'updated' | 'created' | 'title' | 'editor';
  sortOrder: 'asc' | 'desc';
}

// ========================
// Main Component
// ========================

export const DraftManagerPanel: React.FC<DraftManagerPanelProps> = ({
  drafts,
  currentDraft,
  onLoadDraft,
  onDeleteDraft,
  onClose,
  className = ''
}) => {
  const [selectedDraft, setSelectedDraft] = useState<DraftMetadata | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    editor: 'all',
    dateRange: 'all',
    sortBy: 'updated',
    sortOrder: 'desc'
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter and sort drafts
  const filteredDrafts = useMemo(() => {
    let filtered = [...drafts];

    // Search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(draft =>
        draft.title.toLowerCase().includes(searchTerm) ||
        draft.editor.toLowerCase().includes(searchTerm)
      );
    }

    // Editor filter
    if (filters.editor !== 'all') {
      filtered = filtered.filter(draft => draft.editor === filters.editor);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();

      switch (filters.dateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter(draft => draft.updated >= cutoff);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'editor':
          comparison = a.editor.localeCompare(b.editor);
          break;
        case 'created':
          comparison = a.created.getTime() - b.created.getTime();
          break;
        case 'updated':
        default:
          comparison = a.updated.getTime() - b.updated.getTime();
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [drafts, filters]);

  // Get unique editors for filter
  const uniqueEditors = useMemo(() => {
    const editors = new Set(drafts.map(draft => draft.editor));
    return Array.from(editors).sort();
  }, [drafts]);

  // Handle draft selection
  const handleDraftSelect = useCallback((draft: DraftMetadata) => {
    setSelectedDraft(selectedDraft?.id === draft.id ? null : draft);
  }, [selectedDraft]);

  // Handle draft load
  const handleLoadDraft = useCallback(async (draftId: string) => {
    setIsLoading(true);
    try {
      await onLoadDraft(draftId);
      onClose();
    } catch (error) {
      console.error('Failed to load draft:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onLoadDraft, onClose]);

  // Handle draft delete
  const handleDeleteDraft = useCallback(async (draftId: string) => {
    setIsLoading(true);
    try {
      await onDeleteDraft(draftId);
      setShowDeleteConfirm(null);
      setSelectedDraft(null);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onDeleteDraft]);

  // Handle filter change
  const handleFilterChange = useCallback((key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      editor: 'all',
      dateRange: 'all',
      sortBy: 'updated',
      sortOrder: 'desc'
    });
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        if (showDeleteConfirm) {
          setShowDeleteConfirm(null);
        } else if (selectedDraft) {
          setSelectedDraft(null);
        } else {
          onClose();
        }
        break;
      case 'Delete':
        if (selectedDraft && !showDeleteConfirm) {
          setShowDeleteConfirm(selectedDraft.id);
        }
        break;
      case 'Enter':
        if (selectedDraft && !showDeleteConfirm) {
          handleLoadDraft(selectedDraft.id);
        }
        break;
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        break;
    }
  }, [selectedDraft, showDeleteConfirm, onClose, handleLoadDraft]);

  return (
    <div
      className={`draft-manager-panel ${className}`}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-manager-title"
    >
      {/* Header */}
      <div className="panel-header">
        <h3 id="draft-manager-title">📁 Draft Manager</h3>
        <div className="header-actions">
          <span className="draft-count">
            {filteredDrafts.length} of {drafts.length} drafts
          </span>
          <button
            onClick={onClose}
            className="close-button"
            aria-label="Close draft manager"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-filter">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search drafts..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
            aria-label="Search drafts"
          />
        </div>

        <div className="filter-row">
          <select
            value={filters.editor}
            onChange={(e) => handleFilterChange('editor', e.target.value)}
            className="filter-select"
            aria-label="Filter by editor"
          >
            <option value="all">All editors</option>
            {uniqueEditors.map(editor => (
              <option key={editor} value={editor}>{editor}</option>
            ))}
          </select>

          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="filter-select"
            aria-label="Filter by date range"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>

          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              handleFilterChange('sortBy', sortBy);
              handleFilterChange('sortOrder', sortOrder);
            }}
            className="filter-select"
            aria-label="Sort options"
          >
            <option value="updated-desc">Latest first</option>
            <option value="updated-asc">Oldest first</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="editor-asc">Editor A-Z</option>
            <option value="created-desc">Created newest</option>
          </select>

          <button
            onClick={clearFilters}
            className="clear-filters-button"
            title="Clear all filters"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Draft List */}
      <div className="drafts-list">
        {filteredDrafts.length === 0 ? (
          <div className="empty-state">
            <p>No drafts found</p>
            {filters.search || filters.editor !== 'all' || filters.dateRange !== 'all' ? (
              <button onClick={clearFilters} className="link-button">
                Clear filters to see all drafts
              </button>
            ) : null}
          </div>
        ) : (
          filteredDrafts.map((draft) => (
            <div
              key={draft.id}
              className={`draft-item ${selectedDraft?.id === draft.id ? 'selected' : ''} ${
                currentDraft?.id === draft.id ? 'current' : ''
              }`}
              onClick={() => handleDraftSelect(draft)}
              role="button"
              tabIndex={0}
              aria-selected={selectedDraft?.id === draft.id}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDraftSelect(draft);
                }
              }}
            >
              <div className="draft-header">
                <div className="draft-title">
                  {draft.title || 'Untitled Draft'}
                  {currentDraft?.id === draft.id && (
                    <span className="current-badge">Current</span>
                  )}
                </div>
                <div className="draft-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadDraft(draft.id);
                    }}
                    className="action-button load"
                    disabled={isLoading || currentDraft?.id === draft.id}
                    title="Load this draft"
                  >
                    📂
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(draft.id);
                    }}
                    className="action-button delete"
                    disabled={isLoading}
                    title="Delete this draft"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="draft-meta">
                <span className="editor">👤 {draft.editor}</span>
                <span className="updated">
                  📅 {formatDistanceToNow(draft.updated, { addSuffix: true })}
                </span>
                <span className="versions">
                  📝 {draft.versions.length} version{draft.versions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {selectedDraft?.id === draft.id && (
                <div className="draft-preview">
                  <div className="preview-section">
                    <h4>Latest Content</h4>
                    {draft.versions[0]?.data && (
                      <div className="content-preview">
                        {draft.versions[0].data.problem && (
                          <div className="preview-field">
                            <label>Problem:</label>
                            <p>{draft.versions[0].data.problem.substring(0, 200)}...</p>
                          </div>
                        )}
                        {draft.versions[0].data.solution && (
                          <div className="preview-field">
                            <label>Solution:</label>
                            <p>{draft.versions[0].data.solution.substring(0, 200)}...</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-confirm-modal">
          <div className="modal-content">
            <h4>Delete Draft</h4>
            <p>
              Are you sure you want to delete this draft? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="button secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDraft(showDeleteConfirm)}
                className="button danger"
                disabled={isLoading}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <span className="spinner" />
            <span>Processing...</span>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="panel-footer">
        <small className="keyboard-hints">
          Enter=Load • Delete=Delete • Esc=Close • Ctrl+F=Search
        </small>
      </div>
    </div>
  );
};

export default DraftManagerPanel;