/**
 * Category Tree Navigation Component
 *
 * Hierarchical tree navigation for KB categories with drag-and-drop
 * reordering, inline editing, and comprehensive management features.
 *
 * Features:
 * - Hierarchical tree structure
 * - Drag and drop reordering
 * - Inline editing of categories
 * - Context menu operations
 * - Search and filtering
 * - Keyboard navigation
 * - Accessibility support
 * - Category statistics
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
  CategoryNode,
  CategoryTree
} from '../../services/CategoryHierarchyService';
import './CategoryTreeNavigation.css';

// ===========================
// TYPES & INTERFACES
// ===========================

export interface CategoryTreeItem extends CategoryNode {
  children: CategoryTreeItem[];
  isExpanded?: boolean;
  isSelected?: boolean;
  isEditing?: boolean;
  isDragOver?: boolean;
  level: number;
  hasChildren: boolean;
  path: string[];
}

export interface CategoryTreeNavigationProps {
  className?: string;
  height?: number;

  // Data
  categories: CategoryTree[];
  loading?: boolean;
  error?: string;

  // Selection
  selectedCategoryId?: string;
  expandedIds?: string[];
  multiSelect?: boolean;

  // Features
  enableSearch?: boolean;
  enableDragDrop?: boolean;
  enableInlineEdit?: boolean;
  enableContextMenu?: boolean;
  showStatistics?: boolean;
  showIcons?: boolean;

  // Filtering
  searchQuery?: string;
  categoryFilter?: 'all' | 'active' | 'system' | 'user';
  showEmptyCategories?: boolean;

  // Event handlers
  onCategorySelect?: (category: CategoryNode) => void;
  onCategoryToggle?: (categoryId: string, expanded: boolean) => void;
  onCategoryCreate?: (parentId: string | null, categoryData: Partial<CategoryNode>) => Promise<void>;
  onCategoryUpdate?: (categoryId: string, updates: Partial<CategoryNode>) => Promise<void>;
  onCategoryDelete?: (categoryId: string) => Promise<void>;
  onCategoryMove?: (categoryId: string, newParentId: string | null, position?: number) => Promise<void>;
  onSearchChange?: (query: string) => void;

  // Context menu handlers
  onDuplicate?: (category: CategoryNode) => Promise<void>;
  onExport?: (category: CategoryNode) => Promise<void>;
  onViewEntries?: (category: CategoryNode) => void;

  // Accessibility
  ariaLabel?: string;
  announceChanges?: boolean;
}

// ===========================
// TREE ITEM COMPONENT
// ===========================

interface CategoryTreeItemProps {
  item: CategoryTreeItem;
  level: number;
  isRoot?: boolean;
  enableDragDrop: boolean;
  enableInlineEdit: boolean;
  enableContextMenu: boolean;
  showStatistics: boolean;
  showIcons: boolean;
  onSelect: (item: CategoryTreeItem) => void;
  onToggle: (item: CategoryTreeItem) => void;
  onEdit: (item: CategoryTreeItem, updates: Partial<CategoryNode>) => void;
  onDelete: (item: CategoryTreeItem) => void;
  onMove: (sourceId: string, targetId: string | null, position: number) => void;
  onCreateChild: (parentItem: CategoryTreeItem) => void;
}

const CategoryTreeItemComponent = memo<CategoryTreeItemProps>(({
  item,
  level,
  isRoot = false,
  enableDragDrop,
  enableInlineEdit,
  enableContextMenu,
  showStatistics,
  showIcons,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
  onMove,
  onCreateChild
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.name);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const itemRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus edit input
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
        if (isEditing) {
          handleSaveEdit();
        } else {
          onSelect(item);
        }
        break;
      case 'Escape':
        if (isEditing) {
          handleCancelEdit();
        }
        break;
      case 'F2':
        if (enableInlineEdit && !item.is_system) {
          handleStartEdit();
        }
        break;
      case 'Delete':
        if (!isEditing && !item.is_system) {
          onDelete(item);
        }
        break;
      case 'ArrowRight':
        if (item.hasChildren && !item.isExpanded) {
          onToggle(item);
        }
        break;
      case 'ArrowLeft':
        if (item.isExpanded) {
          onToggle(item);
        }
        break;
    }
  }, [isEditing, item, enableInlineEdit, onSelect, onToggle, onDelete]);

  // Edit handlers
  const handleStartEdit = useCallback(() => {
    if (item.is_system || !enableInlineEdit) return;
    setIsEditing(true);
    setEditValue(item.name);
  }, [item.is_system, item.name, enableInlineEdit]);

  const handleSaveEdit = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== item.name) {
      onEdit(item, { name: trimmedValue });
    }
    setIsEditing(false);
  }, [editValue, item, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(item.name);
  }, [item.name]);

  // Context menu handlers
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (!enableContextMenu) return;

    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);
  }, [enableContextMenu]);

  const handleContextMenuAction = useCallback((action: string) => {
    setShowContextMenu(false);

    switch (action) {
      case 'edit':
        handleStartEdit();
        break;
      case 'delete':
        onDelete(item);
        break;
      case 'create-child':
        onCreateChild(item);
        break;
      case 'duplicate':
        // Handle duplicate
        break;
      case 'export':
        // Handle export
        break;
    }
  }, [item, onDelete, onCreateChild, handleStartEdit]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: React.DragEvent) => {
    if (!enableDragDrop) return;

    setIsDragging(true);
    event.dataTransfer.setData('text/plain', item.id);
    event.dataTransfer.effectAllowed = 'move';
  }, [item.id, enableDragDrop]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!enableDragDrop) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, [enableDragDrop]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (!enableDragDrop) return;

    event.preventDefault();
    setIsDragOver(false);

    const draggedId = event.dataTransfer.getData('text/plain');
    if (draggedId !== item.id) {
      onMove(draggedId, item.id, 0);
    }
  }, [item.id, enableDragDrop, onMove]);

  // Calculate indentation
  const indentStyle = {
    paddingLeft: `${level * 20 + 8}px`
  };

  // Get category icon
  const getCategoryIcon = () => {
    if (!showIcons) return null;

    if (item.icon) return item.icon;

    // Default icons by category type
    const iconMap: Record<string, string> = {
      'JCL': '📋',
      'VSAM': '🗄️',
      'DB2': '🗃️',
      'Batch': '⚙️',
      'CICS': '🖥️',
      'IMS': '💾',
      'System': '⚡',
      'Other': '📁'
    };

    return iconMap[item.name] || '📂';
  };

  // Render category statistics
  const renderStatistics = () => {
    if (!showStatistics) return null;

    return (
      <div className="category-stats">
        <span className="entry-count" title={`${item.entry_count || 0} entries`}>
          {item.entry_count || 0}
        </span>
        {item.trending_score && item.trending_score > 0 && (
          <span className="trending-indicator" title={`Trending: ${item.trending_score}%`}>
            🔥
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={itemRef}
      className={`category-tree-item ${item.isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${item.is_system ? 'system' : ''}`}
      style={indentStyle}
      draggable={enableDragDrop && !item.is_system}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="treeitem"
      aria-expanded={item.hasChildren ? item.isExpanded : undefined}
      aria-selected={item.isSelected}
      aria-level={level + 1}
    >
      <div className="category-item-content">
        {/* Expand/Collapse Toggle */}
        {item.hasChildren && (
          <button
            className={`expand-toggle ${item.isExpanded ? 'expanded' : ''}`}
            onClick={() => onToggle(item)}
            aria-label={`${item.isExpanded ? 'Collapse' : 'Expand'} ${item.name}`}
          >
            ▶
          </button>
        )}

        {/* Category Icon */}
        {showIcons && (
          <span className="category-icon">
            {getCategoryIcon()}
          </span>
        )}

        {/* Category Name */}
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') handleCancelEdit();
            }}
            className="category-name-edit"
          />
        ) : (
          <span
            className="category-name"
            onClick={() => onSelect(item)}
            onDoubleClick={handleStartEdit}
          >
            {item.name}
          </span>
        )}

        {/* Statistics */}
        {renderStatistics()}

        {/* System indicator */}
        {item.is_system && (
          <span className="system-indicator" title="System category">
            🔒
          </span>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && enableContextMenu && (
        <div
          className="category-context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!item.is_system && (
            <>
              <button onClick={() => handleContextMenuAction('edit')}>
                ✏️ Rename
              </button>
              <button onClick={() => handleContextMenuAction('create-child')}>
                ➕ Add Child
              </button>
              <button onClick={() => handleContextMenuAction('duplicate')}>
                📋 Duplicate
              </button>
              <div className="context-menu-separator" />
            </>
          )}
          <button onClick={() => handleContextMenuAction('export')}>
            📤 Export
          </button>
          {!item.is_system && (
            <>
              <div className="context-menu-separator" />
              <button
                onClick={() => handleContextMenuAction('delete')}
                className="danger"
              >
                🗑️ Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Children */}
      {item.isExpanded && item.children.length > 0 && (
        <div className="category-children">
          {item.children.map(child => (
            <CategoryTreeItemComponent
              key={child.id}
              item={child}
              level={level + 1}
              enableDragDrop={enableDragDrop}
              enableInlineEdit={enableInlineEdit}
              enableContextMenu={enableContextMenu}
              showStatistics={showStatistics}
              showIcons={showIcons}
              onSelect={onSelect}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}
    </div>
  );
});

CategoryTreeItemComponent.displayName = 'CategoryTreeItemComponent';

// ===========================
// MAIN COMPONENT
// ===========================

export const CategoryTreeNavigation: React.FC<CategoryTreeNavigationProps> = memo(({
  className = '',
  height = 600,
  categories = [],
  loading = false,
  error,
  selectedCategoryId,
  expandedIds = [],
  multiSelect = false,
  enableSearch = true,
  enableDragDrop = true,
  enableInlineEdit = true,
  enableContextMenu = true,
  showStatistics = true,
  showIcons = true,
  searchQuery = '',
  categoryFilter = 'all',
  showEmptyCategories = true,
  ariaLabel = 'Category tree navigation',
  announceChanges = true,
  onCategorySelect,
  onCategoryToggle,
  onCategoryCreate,
  onCategoryUpdate,
  onCategoryDelete,
  onCategoryMove,
  onSearchChange
}) => {
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(new Set(expandedIds));
  const [internalSelectedId, setInternalSelectedId] = useState(selectedCategoryId);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Update internal state when props change
  useEffect(() => {
    setInternalExpandedIds(new Set(expandedIds));
  }, [expandedIds]);

  useEffect(() => {
    setInternalSelectedId(selectedCategoryId);
  }, [selectedCategoryId]);

  // Process categories into tree items
  const processedCategories = useMemo(() => {
    const processTree = (nodes: CategoryTree[]): CategoryTreeItem[] => {
      return nodes.map(node => ({
        ...node.node,
        children: processTree(node.children),
        isExpanded: internalExpandedIds.has(node.node.id),
        isSelected: node.node.id === internalSelectedId,
        level: node.depth,
        hasChildren: node.children.length > 0,
        path: node.path
      }));
    };

    let processed = processTree(categories);

    // Apply filters
    if (searchQuery) {
      processed = filterBySearch(processed, searchQuery);
    }

    if (categoryFilter !== 'all') {
      processed = processed.filter(item => {
        switch (categoryFilter) {
          case 'active':
            return item.is_active;
          case 'system':
            return item.is_system;
          case 'user':
            return !item.is_system;
          default:
            return true;
        }
      });
    }

    if (!showEmptyCategories) {
      processed = processed.filter(item => (item.entry_count || 0) > 0);
    }

    return processed;
  }, [categories, internalExpandedIds, internalSelectedId, searchQuery, categoryFilter, showEmptyCategories]);

  // Filter by search recursively
  const filterBySearch = (items: CategoryTreeItem[], query: string): CategoryTreeItem[] => {
    const queryLower = query.toLowerCase();

    return items.filter(item => {
      const matches = item.name.toLowerCase().includes(queryLower) ||
                     item.description?.toLowerCase().includes(queryLower) ||
                     item.path.some(p => p.toLowerCase().includes(queryLower));

      const hasMatchingChildren = item.children.length > 0 &&
                                 filterBySearch(item.children, query).length > 0;

      if (matches || hasMatchingChildren) {
        // Include item and filter its children
        item.children = filterBySearch(item.children, query);
        return true;
      }

      return false;
    });
  };

  // Event handlers
  const handleCategorySelect = useCallback((item: CategoryTreeItem) => {
    setInternalSelectedId(item.id);
    onCategorySelect?.(item);
  }, [onCategorySelect]);

  const handleCategoryToggle = useCallback((item: CategoryTreeItem) => {
    const newExpanded = new Set(internalExpandedIds);

    if (item.isExpanded) {
      newExpanded.delete(item.id);
    } else {
      newExpanded.add(item.id);
    }

    setInternalExpandedIds(newExpanded);
    onCategoryToggle?.(item.id, !item.isExpanded);
  }, [internalExpandedIds, onCategoryToggle]);

  const handleCategoryEdit = useCallback(async (item: CategoryTreeItem, updates: Partial<CategoryNode>) => {
    try {
      await onCategoryUpdate?.(item.id, updates);

      if (announceChanges) {
        // Announce update
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Category "${item.name}" updated`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  }, [onCategoryUpdate, announceChanges]);

  const handleCategoryDelete = useCallback(async (item: CategoryTreeItem) => {
    if (item.is_system) return;

    const confirmMessage = item.hasChildren
      ? `Delete "${item.name}" and all its children?`
      : `Delete "${item.name}"?`;

    if (window.confirm(confirmMessage)) {
      try {
        await onCategoryDelete?.(item.id);
      } catch (error) {
        console.error('Failed to delete category:', error);
      }
    }
  }, [onCategoryDelete]);

  const handleCategoryMove = useCallback(async (sourceId: string, targetId: string | null, position: number) => {
    try {
      await onCategoryMove?.(sourceId, targetId, position);
    } catch (error) {
      console.error('Failed to move category:', error);
    }
  }, [onCategoryMove]);

  const handleCreateChild = useCallback((parentItem: CategoryTreeItem) => {
    setCreateParentId(parentItem.id);
    setShowCreateForm(true);
  }, []);

  const handleCreateCategory = useCallback(async (name: string, description?: string) => {
    try {
      await onCategoryCreate?.(createParentId, {
        name,
        description,
        is_active: true
      });

      setShowCreateForm(false);
      setCreateParentId(null);
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  }, [createParentId, onCategoryCreate]);

  // Click outside handler for context menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close any open context menus
      const contextMenus = document.querySelectorAll('.category-context-menu');
      contextMenus.forEach(menu => {
        if (!menu.contains(event.target as Node)) {
          (menu as HTMLElement).style.display = 'none';
        }
      });
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div className={`category-tree-loading ${className}`}>
        <div className="loading-spinner" />
        <p>Loading categories...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`category-tree-error ${className}`} role="alert">
        <h3>Error Loading Categories</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`category-tree-navigation ${className}`}
      style={{ height }}
    >
      {/* Header Controls */}
      <div className="category-tree-header">
        {enableSearch && (
          <div className="search-control">
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="search-input"
              aria-label="Search categories"
            />
          </div>
        )}

        <div className="header-actions">
          <select
            value={categoryFilter}
            onChange={(e) => {/* Handle filter change */}}
            className="category-filter"
            aria-label="Filter categories"
          >
            <option value="all">All Categories</option>
            <option value="active">Active Only</option>
            <option value="system">System Categories</option>
            <option value="user">User Categories</option>
          </select>

          <button
            onClick={() => setShowCreateForm(true)}
            className="create-button"
            aria-label="Create new category"
          >
            ➕
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div
        className="category-tree-content"
        role="tree"
        aria-label={ariaLabel}
        aria-multiselectable={multiSelect}
      >
        {processedCategories.length === 0 ? (
          <div className="empty-state">
            <p>No categories found</p>
            {searchQuery && <p>Try adjusting your search terms</p>}
          </div>
        ) : (
          processedCategories.map(item => (
            <CategoryTreeItemComponent
              key={item.id}
              item={item}
              level={0}
              isRoot={true}
              enableDragDrop={enableDragDrop}
              enableInlineEdit={enableInlineEdit}
              enableContextMenu={enableContextMenu}
              showStatistics={showStatistics}
              showIcons={showIcons}
              onSelect={handleCategorySelect}
              onToggle={handleCategoryToggle}
              onEdit={handleCategoryEdit}
              onDelete={handleCategoryDelete}
              onMove={handleCategoryMove}
              onCreateChild={handleCreateChild}
            />
          ))
        )}
      </div>

      {/* Create Category Form */}
      {showCreateForm && (
        <div className="create-category-modal">
          <div className="modal-content">
            <h3>Create New Category</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name') as string;
                const description = formData.get('description') as string;
                handleCreateCategory(name, description);
              }}
            >
              <div className="form-group">
                <label htmlFor="category-name">Name:</label>
                <input
                  id="category-name"
                  name="name"
                  type="text"
                  required
                  autoFocus
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="category-description">Description:</label>
                <textarea
                  id="category-description"
                  name="description"
                  className="form-textarea"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="secondary-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statistics Summary */}
      {showStatistics && (
        <div className="category-tree-footer">
          <div className="summary-stats">
            <span>Total: {processedCategories.length}</span>
            <span>Entries: {processedCategories.reduce((sum, cat) => sum + (cat.entry_count || 0), 0)}</span>
          </div>
        </div>
      )}

      {/* Screen reader announcements */}
      {announceChanges && (
        <div
          className="sr-only"
          aria-live="polite"
          aria-atomic="false"
        >
          {searchQuery && `Filtered to ${processedCategories.length} categories`}
          {internalSelectedId && `Selected category changed`}
        </div>
      )}
    </div>
  );
});

CategoryTreeNavigation.displayName = 'CategoryTreeNavigation';

export default CategoryTreeNavigation;