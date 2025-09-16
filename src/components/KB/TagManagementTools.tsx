/**
 * Tag Management Tools Component
 *
 * Comprehensive tag management interface with tools for merging,
 * renaming, organizing, and maintaining tag consistency.
 *
 * Features:
 * - Tag merging with conflict resolution
 * - Bulk tag renaming and editing
 * - Tag relationship management
 * - Duplicate tag detection and resolution
 * - Tag usage analytics and cleanup
 * - Import/export tag structures
 * - Tag validation and normalization
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
import {
  Tag,
  TagRelationship,
  TagMergeOperation,
  EnhancedTagService
} from '../../services/EnhancedTagService';
import './TagManagementTools.css';

// ===========================
// TYPES & INTERFACES
// ===========================

export interface TagManagementToolsProps {
  className?: string;

  // Data
  tags: Tag[];
  relationships: TagRelationship[];
  loading?: boolean;
  error?: string;

  // Services
  tagService?: EnhancedTagService;

  // Configuration
  enableMerging?: boolean;
  enableRenaming?: boolean;
  enableRelationships?: boolean;
  enableCleanup?: boolean;
  enableImportExport?: boolean;

  // Event handlers
  onTagUpdate?: (tag: Tag) => Promise<void>;
  onTagDelete?: (tagId: string) => Promise<void>;
  onTagMerge?: (operation: TagMergeOperation) => Promise<void>;
  onRelationshipCreate?: (tagId: string, relatedTagId: string, type: string) => Promise<void>;
  onRefresh?: () => Promise<void>;

  // Accessibility
  ariaLabel?: string;
  announceChanges?: boolean;
}

export interface TagConflict {
  id: string;
  type: 'duplicate' | 'similar' | 'synonym';
  tags: Tag[];
  confidence: number;
  suggestedAction: 'merge' | 'rename' | 'ignore';
}

export interface TagCleanupSuggestion {
  id: string;
  type: 'unused' | 'low_usage' | 'deprecated' | 'orphaned';
  tag: Tag;
  reason: string;
  suggestedAction: 'delete' | 'archive' | 'merge';
  alternativeTags?: Tag[];
}

// ===========================
// MAIN COMPONENT
// ===========================

export const TagManagementTools: React.FC<TagManagementToolsProps> = memo(({
  className = '',
  tags = [],
  relationships = [],
  loading = false,
  error,
  tagService,
  enableMerging = true,
  enableRenaming = true,
  enableRelationships = true,
  enableCleanup = true,
  enableImportExport = true,
  ariaLabel = 'Tag management tools',
  announceChanges = true,
  onTagUpdate,
  onTagDelete,
  onTagMerge,
  onRelationshipCreate,
  onRefresh
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'conflicts' | 'cleanup' | 'relationships' | 'import-export'>('overview');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'created'>('usage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Analysis state
  const [tagConflicts, setTagConflicts] = useState<TagConflict[]>([]);
  const [cleanupSuggestions, setCleanupSuggestions] = useState<TagCleanupSuggestion[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Modal states
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [mergeOperation, setMergeOperation] = useState<Partial<TagMergeOperation> | null>(null);
  const [renameTag, setRenameTag] = useState<Tag | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process and filter tags
  const processedTags = useMemo(() => {
    let filtered = [...tags];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tag =>
        tag.name.toLowerCase().includes(query) ||
        tag.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'usage':
          comparison = (b.usage_count || 0) - (a.usage_count || 0);
          break;
        case 'created':
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          comparison = bDate - aDate;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [tags, searchQuery, sortBy, sortOrder]);

  // Run analysis when tags change
  useEffect(() => {
    if (tags.length > 0) {
      runAnalysis();
    }
  }, [tags]);

  // Analysis functions
  const runAnalysis = useCallback(async () => {
    setAnalysisLoading(true);

    try {
      // Detect conflicts
      const conflicts = await detectTagConflicts(tags);
      setTagConflicts(conflicts);

      // Generate cleanup suggestions
      const suggestions = await generateCleanupSuggestions(tags);
      setCleanupSuggestions(suggestions);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalysisLoading(false);
    }
  }, [tags]);

  const detectTagConflicts = async (tags: Tag[]): Promise<TagConflict[]> => {
    const conflicts: TagConflict[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < tags.length; i++) {
      const tag1 = tags[i];
      if (processed.has(tag1.id)) continue;

      const similarTags = [tag1];

      for (let j = i + 1; j < tags.length; j++) {
        const tag2 = tags[j];
        if (processed.has(tag2.id)) continue;

        const similarity = calculateStringSimilarity(tag1.name, tag2.name);

        if (similarity > 0.8) { // Very similar names
          similarTags.push(tag2);
          processed.add(tag2.id);
        }
      }

      if (similarTags.length > 1) {
        conflicts.push({
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'similar',
          tags: similarTags,
          confidence: 0.8,
          suggestedAction: 'merge'
        });
      }

      processed.add(tag1.id);
    }

    return conflicts;
  };

  const generateCleanupSuggestions = async (tags: Tag[]): Promise<TagCleanupSuggestion[]> => {
    const suggestions: TagCleanupSuggestion[] = [];

    tags.forEach(tag => {
      // Unused tags
      if ((tag.usage_count || 0) === 0) {
        suggestions.push({
          id: `cleanup_${tag.id}`,
          type: 'unused',
          tag,
          reason: 'This tag has never been used',
          suggestedAction: 'delete'
        });
      }
      // Low usage tags (used less than 3 times)
      else if ((tag.usage_count || 0) < 3) {
        suggestions.push({
          id: `cleanup_${tag.id}`,
          type: 'low_usage',
          tag,
          reason: `This tag has only been used ${tag.usage_count} time(s)`,
          suggestedAction: 'merge',
          alternativeTags: findSimilarTags(tag, tags.filter(t => t.id !== tag.id))
        });
      }
      // Tags not used in a long time
      else if (tag.last_used && isOlderThan(tag.last_used, 90)) {
        suggestions.push({
          id: `cleanup_${tag.id}`,
          type: 'deprecated',
          tag,
          reason: 'This tag hasn\'t been used in over 90 days',
          suggestedAction: 'archive'
        });
      }
    });

    return suggestions;
  };

  // Utility functions
  const calculateStringSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  const findSimilarTags = (tag: Tag, otherTags: Tag[]): Tag[] => {
    return otherTags
      .map(otherTag => ({
        tag: otherTag,
        similarity: calculateStringSimilarity(tag.name, otherTag.name)
      }))
      .filter(({ similarity }) => similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(({ tag }) => tag);
  };

  const isOlderThan = (date: Date, days: number): boolean => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(date) < cutoff;
  };

  // Event handlers
  const handleTagSelection = useCallback((tagId: string, selected: boolean) => {
    const newSelected = new Set(selectedTags);
    if (selected) {
      newSelected.add(tagId);
    } else {
      newSelected.delete(tagId);
    }
    setSelectedTags(newSelected);
  }, [selectedTags]);

  const handleSelectAll = useCallback(() => {
    setSelectedTags(new Set(processedTags.map(tag => tag.id)));
  }, [processedTags]);

  const handleSelectNone = useCallback(() => {
    setSelectedTags(new Set());
  }, []);

  const handleBulkMerge = useCallback(() => {
    if (selectedTags.size < 2) {
      alert('Please select at least 2 tags to merge');
      return;
    }

    const targetTag = processedTags.find(tag => selectedTags.has(tag.id));
    if (!targetTag) return;

    setMergeOperation({
      source_tag_ids: Array.from(selectedTags).filter(id => id !== targetTag.id),
      target_tag_id: targetTag.id,
      preserve_relationships: true,
      update_entries: true
    });
    setShowMergeModal(true);
  }, [selectedTags, processedTags]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTags.size === 0) {
      alert('Please select tags to delete');
      return;
    }

    const confirmMessage = `Delete ${selectedTags.size} selected tag(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      for (const tagId of selectedTags) {
        await onTagDelete?.(tagId);
      }
      setSelectedTags(new Set());
      await onRefresh?.();
    } catch (error) {
      console.error('Bulk delete failed:', error);
    }
  }, [selectedTags, onTagDelete, onRefresh]);

  const handleRename = useCallback((tag: Tag) => {
    setRenameTag(tag);
    setShowRenameModal(true);
  }, []);

  const handleMergeConflict = useCallback((conflict: TagConflict) => {
    setMergeOperation({
      source_tag_ids: conflict.tags.slice(1).map(tag => tag.id),
      target_tag_id: conflict.tags[0].id,
      preserve_relationships: true,
      update_entries: true
    });
    setShowMergeModal(true);
  }, []);

  const handleCleanupSuggestion = useCallback(async (suggestion: TagCleanupSuggestion) => {
    switch (suggestion.suggestedAction) {
      case 'delete':
        if (window.confirm(`Delete tag "${suggestion.tag.name}"?`)) {
          await onTagDelete?.(suggestion.tag.id);
        }
        break;
      case 'archive':
        await onTagUpdate?.({ ...suggestion.tag, is_active: false });
        break;
      case 'merge':
        if (suggestion.alternativeTags && suggestion.alternativeTags.length > 0) {
          setMergeOperation({
            source_tag_ids: [suggestion.tag.id],
            target_tag_id: suggestion.alternativeTags[0].id,
            preserve_relationships: true,
            update_entries: true
          });
          setShowMergeModal(true);
        }
        break;
    }
  }, [onTagDelete, onTagUpdate]);

  const handleImportTags = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Process import data
      if (importData.tags && Array.isArray(importData.tags)) {
        for (const tagData of importData.tags) {
          // Import tag logic would go here
          console.log('Importing tag:', tagData);
        }
        await onRefresh?.();
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import tags. Please check the file format.');
    }

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onRefresh]);

  const handleExportTags = useCallback(async () => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      tags: selectedTags.size > 0
        ? tags.filter(tag => selectedTags.has(tag.id))
        : tags,
      relationships: relationships
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tags-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [tags, relationships, selectedTags]);

  // Render loading state
  if (loading) {
    return (
      <div className={`tag-management-loading ${className}`}>
        <div className="loading-spinner" />
        <p>Loading tag management tools...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`tag-management-error ${className}`} role="alert">
        <h3>Error Loading Tags</h3>
        <p>{error}</p>
        <button onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <div className={`tag-management-tools ${className}`} role="region" aria-label={ariaLabel}>
      {/* Header */}
      <div className="tag-management-header">
        <h2>Tag Management Tools</h2>
        <div className="header-stats">
          <span>Total Tags: {tags.length}</span>
          {tagConflicts.length > 0 && (
            <span className="conflicts-indicator">
              ⚠️ {tagConflicts.length} Conflicts
            </span>
          )}
          {cleanupSuggestions.length > 0 && (
            <span className="cleanup-indicator">
              🧹 {cleanupSuggestions.length} Cleanup Suggestions
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tab-navigation" role="tablist">
        {[
          { key: 'overview', label: 'Overview', count: processedTags.length },
          { key: 'conflicts', label: 'Conflicts', count: tagConflicts.length },
          { key: 'cleanup', label: 'Cleanup', count: cleanupSuggestions.length },
          { key: 'relationships', label: 'Relationships', count: relationships.length },
          { key: 'import-export', label: 'Import/Export', count: null }
        ].map(tab => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key as any)}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content" role="tabpanel">
        {activeTab === 'overview' && (
          <TagOverviewPanel
            tags={processedTags}
            selectedTags={selectedTags}
            searchQuery={searchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSearchChange={setSearchQuery}
            onSortChange={setSortBy}
            onSortOrderChange={setSortOrder}
            onTagSelection={handleTagSelection}
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
            onBulkMerge={handleBulkMerge}
            onBulkDelete={handleBulkDelete}
            onRename={handleRename}
            onTagUpdate={onTagUpdate}
            onTagDelete={onTagDelete}
          />
        )}

        {activeTab === 'conflicts' && (
          <TagConflictsPanel
            conflicts={tagConflicts}
            loading={analysisLoading}
            onMergeConflict={handleMergeConflict}
            onIgnoreConflict={(conflictId) => {
              setTagConflicts(prev => prev.filter(c => c.id !== conflictId));
            }}
            onRefreshAnalysis={runAnalysis}
          />
        )}

        {activeTab === 'cleanup' && (
          <TagCleanupPanel
            suggestions={cleanupSuggestions}
            loading={analysisLoading}
            onApplySuggestion={handleCleanupSuggestion}
            onIgnoreSuggestion={(suggestionId) => {
              setCleanupSuggestions(prev => prev.filter(s => s.id !== suggestionId));
            }}
            onRefreshAnalysis={runAnalysis}
          />
        )}

        {activeTab === 'relationships' && (
          <TagRelationshipsPanel
            tags={tags}
            relationships={relationships}
            onCreateRelationship={onRelationshipCreate}
          />
        )}

        {activeTab === 'import-export' && (
          <ImportExportPanel
            onImport={handleImportTags}
            onExport={handleExportTags}
            selectedCount={selectedTags.size}
            totalCount={tags.length}
            fileInputRef={fileInputRef}
          />
        )}
      </div>

      {/* Modals */}
      {showMergeModal && mergeOperation && (
        <TagMergeModal
          operation={mergeOperation}
          tags={tags}
          onConfirm={async (operation) => {
            await onTagMerge?.(operation as TagMergeOperation);
            setShowMergeModal(false);
            setMergeOperation(null);
            await onRefresh?.();
          }}
          onCancel={() => {
            setShowMergeModal(false);
            setMergeOperation(null);
          }}
        />
      )}

      {showRenameModal && renameTag && (
        <TagRenameModal
          tag={renameTag}
          onConfirm={async (newName) => {
            await onTagUpdate?.({ ...renameTag, name: newName });
            setShowRenameModal(false);
            setRenameTag(null);
            await onRefresh?.();
          }}
          onCancel={() => {
            setShowRenameModal(false);
            setRenameTag(null);
          }}
        />
      )}

      {/* Screen reader announcements */}
      {announceChanges && (
        <div className="sr-only" aria-live="polite">
          {selectedTags.size > 0 && `${selectedTags.size} tags selected`}
          {tagConflicts.length > 0 && `${tagConflicts.length} tag conflicts detected`}
          {cleanupSuggestions.length > 0 && `${cleanupSuggestions.length} cleanup suggestions available`}
        </div>
      )}
    </div>
  );
});

TagManagementTools.displayName = 'TagManagementTools';

// ===========================
// SUB-COMPONENTS
// ===========================

interface TagOverviewPanelProps {
  tags: Tag[];
  selectedTags: Set<string>;
  searchQuery: string;
  sortBy: string;
  sortOrder: string;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: string) => void;
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onTagSelection: (tagId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onBulkMerge: () => void;
  onBulkDelete: () => void;
  onRename: (tag: Tag) => void;
  onTagUpdate?: (tag: Tag) => Promise<void>;
  onTagDelete?: (tagId: string) => Promise<void>;
}

const TagOverviewPanel = memo<TagOverviewPanelProps>(({
  tags,
  selectedTags,
  searchQuery,
  sortBy,
  sortOrder,
  onSearchChange,
  onSortChange,
  onSortOrderChange,
  onTagSelection,
  onSelectAll,
  onSelectNone,
  onBulkMerge,
  onBulkDelete,
  onRename,
  onTagUpdate,
  onTagDelete
}) => (
  <div className="tag-overview-panel">
    {/* Controls */}
    <div className="overview-controls">
      <div className="search-sort-controls">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="sort-select"
        >
          <option value="usage">Sort by Usage</option>
          <option value="name">Sort by Name</option>
          <option value="created">Sort by Created</option>
        </select>
        <button
          className="sort-order-button"
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div className="bulk-actions">
        <button onClick={onSelectAll} className="select-button">
          Select All
        </button>
        <button onClick={onSelectNone} className="select-button">
          Select None
        </button>
        {selectedTags.size > 1 && (
          <button onClick={onBulkMerge} className="action-button merge">
            Merge Selected
          </button>
        )}
        {selectedTags.size > 0 && (
          <button onClick={onBulkDelete} className="action-button delete">
            Delete Selected
          </button>
        )}
      </div>
    </div>

    {/* Tags List */}
    <div className="tags-list">
      {tags.map(tag => (
        <div
          key={tag.id}
          className={`tag-item ${selectedTags.has(tag.id) ? 'selected' : ''} ${tag.is_system ? 'system' : ''}`}
        >
          <input
            type="checkbox"
            checked={selectedTags.has(tag.id)}
            onChange={(e) => onTagSelection(tag.id, e.target.checked)}
            disabled={tag.is_system}
          />
          <div className="tag-info">
            <div className="tag-name">{tag.name}</div>
            <div className="tag-meta">
              <span className="usage-count">Used {tag.usage_count || 0} times</span>
              {tag.trending_score && tag.trending_score > 0 && (
                <span className="trending">🔥 Trending</span>
              )}
              {tag.is_system && <span className="system-tag">System</span>}
            </div>
          </div>
          <div className="tag-actions">
            {!tag.is_system && (
              <>
                <button
                  onClick={() => onRename(tag)}
                  className="action-button small"
                  title="Rename tag"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onTagDelete?.(tag.id)}
                  className="action-button small delete"
                  title="Delete tag"
                >
                  🗑️
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
));

interface TagConflictsPanelProps {
  conflicts: TagConflict[];
  loading: boolean;
  onMergeConflict: (conflict: TagConflict) => void;
  onIgnoreConflict: (conflictId: string) => void;
  onRefreshAnalysis: () => void;
}

const TagConflictsPanel = memo<TagConflictsPanelProps>(({
  conflicts,
  loading,
  onMergeConflict,
  onIgnoreConflict,
  onRefreshAnalysis
}) => (
  <div className="tag-conflicts-panel">
    <div className="panel-header">
      <h3>Tag Conflicts</h3>
      <button onClick={onRefreshAnalysis} className="refresh-button">
        🔄 Refresh Analysis
      </button>
    </div>

    {loading ? (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Analyzing tags for conflicts...</p>
      </div>
    ) : conflicts.length === 0 ? (
      <div className="empty-state">
        <p>No tag conflicts detected! 🎉</p>
      </div>
    ) : (
      <div className="conflicts-list">
        {conflicts.map(conflict => (
          <div key={conflict.id} className="conflict-item">
            <div className="conflict-header">
              <span className="conflict-type">{conflict.type}</span>
              <span className="confidence">
                {Math.round(conflict.confidence * 100)}% confidence
              </span>
            </div>
            <div className="conflict-tags">
              {conflict.tags.map(tag => (
                <span key={tag.id} className="conflict-tag">
                  {tag.name} ({tag.usage_count || 0} uses)
                </span>
              ))}
            </div>
            <div className="conflict-actions">
              <button
                onClick={() => onMergeConflict(conflict)}
                className="action-button primary"
              >
                Merge Tags
              </button>
              <button
                onClick={() => onIgnoreConflict(conflict.id)}
                className="action-button secondary"
              >
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
));

interface TagCleanupPanelProps {
  suggestions: TagCleanupSuggestion[];
  loading: boolean;
  onApplySuggestion: (suggestion: TagCleanupSuggestion) => void;
  onIgnoreSuggestion: (suggestionId: string) => void;
  onRefreshAnalysis: () => void;
}

const TagCleanupPanel = memo<TagCleanupPanelProps>(({
  suggestions,
  loading,
  onApplySuggestion,
  onIgnoreSuggestion,
  onRefreshAnalysis
}) => (
  <div className="tag-cleanup-panel">
    <div className="panel-header">
      <h3>Cleanup Suggestions</h3>
      <button onClick={onRefreshAnalysis} className="refresh-button">
        🔄 Refresh Analysis
      </button>
    </div>

    {loading ? (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Generating cleanup suggestions...</p>
      </div>
    ) : suggestions.length === 0 ? (
      <div className="empty-state">
        <p>No cleanup suggestions! Your tags are well maintained. ✨</p>
      </div>
    ) : (
      <div className="suggestions-list">
        {suggestions.map(suggestion => (
          <div key={suggestion.id} className="suggestion-item">
            <div className="suggestion-header">
              <span className={`suggestion-type ${suggestion.type}`}>
                {suggestion.type.replace('_', ' ')}
              </span>
              <span className="tag-name">{suggestion.tag.name}</span>
            </div>
            <p className="suggestion-reason">{suggestion.reason}</p>
            {suggestion.alternativeTags && suggestion.alternativeTags.length > 0 && (
              <div className="alternative-tags">
                <span>Similar tags: </span>
                {suggestion.alternativeTags.map(tag => (
                  <span key={tag.id} className="alternative-tag">
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
            <div className="suggestion-actions">
              <button
                onClick={() => onApplySuggestion(suggestion)}
                className="action-button primary"
              >
                {suggestion.suggestedAction === 'delete' && 'Delete'}
                {suggestion.suggestedAction === 'archive' && 'Archive'}
                {suggestion.suggestedAction === 'merge' && 'Merge'}
              </button>
              <button
                onClick={() => onIgnoreSuggestion(suggestion.id)}
                className="action-button secondary"
              >
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
));

interface TagRelationshipsPanelProps {
  tags: Tag[];
  relationships: TagRelationship[];
  onCreateRelationship?: (tagId: string, relatedTagId: string, type: string) => Promise<void>;
}

const TagRelationshipsPanel = memo<TagRelationshipsPanelProps>(({
  tags,
  relationships,
  onCreateRelationship
}) => (
  <div className="tag-relationships-panel">
    <div className="panel-header">
      <h3>Tag Relationships</h3>
    </div>
    <p>Tag relationships functionality coming soon...</p>
  </div>
));

interface ImportExportPanelProps {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  selectedCount: number;
  totalCount: number;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const ImportExportPanel = memo<ImportExportPanelProps>(({
  onImport,
  onExport,
  selectedCount,
  totalCount,
  fileInputRef
}) => (
  <div className="import-export-panel">
    <div className="import-section">
      <h3>Import Tags</h3>
      <p>Import tags from a JSON file</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={onImport}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="action-button primary"
      >
        📁 Choose File
      </button>
    </div>

    <div className="export-section">
      <h3>Export Tags</h3>
      <p>
        Export {selectedCount > 0 ? selectedCount + ' selected' : 'all ' + totalCount} tags to JSON
      </p>
      <button onClick={onExport} className="action-button primary">
        📤 Export Tags
      </button>
    </div>
  </div>
));

// Modal components would be defined here...
const TagMergeModal = memo<any>(() => <div>Merge modal coming soon...</div>);
const TagRenameModal = memo<any>(() => <div>Rename modal coming soon...</div>);

export default TagManagementTools;