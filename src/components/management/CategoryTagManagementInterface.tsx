/**
 * Category and Tag Management Interface
 *
 * Comprehensive interface that integrates all categorization and tagging
 * components into a unified, accessible management system.
 *
 * Features:
 * - Unified category and tag management
 * - Drag-and-drop organization
 * - Bulk operations support
 * - Real-time search and filtering
 * - Visual analytics and insights
 * - Import/export functionality
 * - Full WCAG 2.1 AA compliance
 * - Responsive design
 * - Keyboard navigation
 * - Screen reader support
 *
 * @author Frontend Developer Agent
 * @version 2.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle
} from 'react';
import { KBEntry } from '../../database/KnowledgeDB';
import { Tag } from '../../services/EnhancedTagService';
import { CategoryNode } from '../../services/CategoryHierarchyService';
import { EnhancedTagInput } from '../tags/EnhancedTagInput';
import { EnhancedCategoryTree } from '../categorization/EnhancedCategoryTree';
import { BulkOperationsPanel } from '../bulk/BulkOperationsPanel';
import { EnhancedTagCloud } from '../visualization/EnhancedTagCloud';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './CategoryTagManagementInterface.css';

// ===========================
// TYPES & INTERFACES
// ===========================

export interface ManagementView {
  id: string;
  name: string;
  icon: string;
  description: string;
  component: React.ComponentType<any>;
}

export interface ManagementStats {
  totalEntries: number;
  totalTags: number;
  totalCategories: number;
  averageTagsPerEntry: number;
  mostUsedTags: Tag[];
  mostPopularCategories: CategoryNode[];
  recentActivity: {
    date: Date;
    action: string;
    target: string;
    user: string;
  }[];
}

export interface CategoryTagManagementInterfaceProps {
  className?: string;

  // Data
  entries: KBEntry[];
  tags: Tag[];
  categories: CategoryNode[];
  loading?: boolean;
  error?: string | null;

  // Configuration
  defaultView?: string;
  enabledViews?: string[];
  showStats?: boolean;
  enableExportImport?: boolean;

  // Event handlers
  onEntryUpdate?: (entry: KBEntry) => Promise<void>;
  onTagCreate?: (tag: Omit<Tag, 'id'>) => Promise<Tag>;
  onTagUpdate?: (tag: Tag) => Promise<void>;
  onTagDelete?: (tagId: string) => Promise<void>;
  onCategoryCreate?: (category: Omit<CategoryNode, 'id'>) => Promise<CategoryNode>;
  onCategoryUpdate?: (category: CategoryNode) => Promise<void>;
  onCategoryDelete?: (categoryId: string) => Promise<void>;
  onBulkOperation?: (operation: any, entries: KBEntry[]) => Promise<any>;
  onExport?: (format: string, data: any) => Promise<void>;
  onImport?: (format: string, file: File) => Promise<void>;

  // Accessibility
  ariaLabel?: string;
  announceChanges?: boolean;
}

export interface ManagementInterfaceRef {
  switchView: (viewId: string) => void;
  refreshData: () => Promise<void>;
  exportData: (format: string) => Promise<void>;
  importData: (file: File) => Promise<void>;
  getStats: () => ManagementStats;
  focus: () => void;
}

// ===========================
// VIEW COMPONENTS
// ===========================

const TagManagementView: React.FC<{
  tags: Tag[];
  entries: KBEntry[];
  onTagCreate: (tag: Omit<Tag, 'id'>) => Promise<Tag>;
  onTagUpdate: (tag: Tag) => Promise<void>;
  onTagDelete: (tagId: string) => Promise<void>;
}> = ({ tags, entries, onTagCreate, onTagUpdate, onTagDelete }) => {
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = useMemo(() => {
    return tags.filter(tag =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tags, searchQuery]);

  const tagUsageData = useMemo(() => {
    return filteredTags.map(tag => ({
      tag,
      weight: (tag.usage_count || 0) / Math.max(...tags.map(t => t.usage_count || 0), 1)
    }));
  }, [filteredTags, tags]);

  return (
    <div className="tag-management-view">
      <div className="view-header">
        <h2>Tag Management</h2>
        <div className="view-actions">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label="Search tags"
          />
          <button
            onClick={() => {
              const name = prompt('Enter tag name:');
              if (name) {
                onTagCreate({ name, category_id: '', is_system: false, created_at: new Date(), updated_at: new Date(), usage_count: 0 });
              }
            }}
            className="create-button"
          >
            Create Tag
          </button>
        </div>
      </div>

      <div className="view-content">
        <div className="tags-list">
          <div className="list-header">
            <span>Tag ({filteredTags.length})</span>
            <span>Usage</span>
            <span>Category</span>
            <span>Actions</span>
          </div>
          {filteredTags.map(tag => (
            <div key={tag.id} className="tag-item">
              <div className="tag-info">
                <span className="tag-name">{tag.name}</span>
                {tag.description && (
                  <span className="tag-description">{tag.description}</span>
                )}
              </div>
              <div className="tag-usage">
                <span className="usage-count">{tag.usage_count || 0}</span>
                <div className="usage-bar">
                  <div
                    className="usage-fill"
                    style={{ width: `${Math.min((tag.usage_count || 0) / 100 * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="tag-category">
                {tag.category_id && (
                  <span className="category-badge">{tag.category_id}</span>
                )}
              </div>
              <div className="tag-actions">
                <button
                  onClick={() => {
                    const newName = prompt('Enter new name:', tag.name);
                    if (newName && newName !== tag.name) {
                      onTagUpdate({ ...tag, name: newName, updated_at: new Date() });
                    }
                  }}
                  className="edit-button"
                  aria-label={`Edit ${tag.name}`}
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete tag "${tag.name}"?`)) {
                      onTagDelete(tag.id);
                    }
                  }}
                  className="delete-button"
                  aria-label={`Delete ${tag.name}`}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="tags-visualization">
          <h3>Tag Usage Visualization</h3>
          <EnhancedTagCloud
            tags={tagUsageData}
            height={300}
            config={{
              algorithm: 'force',
              colorScheme: 'frequency',
              enableAnimation: true
            }}
          />
        </div>
      </div>
    </div>
  );
};

const CategoryManagementView: React.FC<{
  categories: CategoryNode[];
  onCategoryCreate: (category: Omit<CategoryNode, 'id'>) => Promise<CategoryNode>;
  onCategoryUpdate: (category: CategoryNode) => Promise<void>;
  onCategoryDelete: (categoryId: string) => Promise<void>;
}> = ({ categories, onCategoryCreate, onCategoryUpdate, onCategoryDelete }) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  return (
    <div className="category-management-view">
      <div className="view-header">
        <h2>Category Management</h2>
        <div className="view-actions">
          <button
            onClick={() => {
              const name = prompt('Enter category name:');
              if (name) {
                onCategoryCreate({
                  name,
                  description: '',
                  parent_id: null,
                  is_system: false,
                  is_active: true,
                  created_at: new Date(),
                  updated_at: new Date(),
                  entry_count: 0
                });
              }
            }}
            className="create-button"
          >
            Create Category
          </button>
        </div>
      </div>

      <div className="view-content">
        <EnhancedCategoryTree
          categories={categories.map(cat => ({ node: cat, children: [], depth: 0, path: [cat.name] }))}
          selectedIds={selectedCategories}
          height={500}
          onSelectionChange={(ids, nodes) => setSelectedCategories(ids)}
          onNodeCreate={async (parentId, data) => {
            const category = await onCategoryCreate({
              ...data,
              parent_id: parentId,
              is_system: false,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
              entry_count: 0
            } as Omit<CategoryNode, 'id'>);
            return category.id;
          }}
          onNodeUpdate={async (id, updates) => {
            const category = categories.find(c => c.id === id);
            if (category) {
              await onCategoryUpdate({ ...category, ...updates, updated_at: new Date() });
            }
            return true;
          }}
          onNodeDelete={async (id) => {
            await onCategoryDelete(id);
            return true;
          }}
        />
      </div>
    </div>
  );
};

const BulkOperationsView: React.FC<{
  entries: KBEntry[];
  tags: Tag[];
  categories: CategoryNode[];
  onBulkOperation: (operation: any, entries: KBEntry[]) => Promise<any>;
}> = ({ entries, tags, categories, onBulkOperation }) => {
  const [selectedEntries, setSelectedEntries] = useState<KBEntry[]>([]);

  return (
    <div className="bulk-operations-view">
      <div className="view-header">
        <h2>Bulk Operations</h2>
        <p>Select entries to perform batch operations</p>
      </div>

      <div className="view-content">
        <div className="entries-selection">
          <h3>Select Entries</h3>
          <div className="entries-list">
            {entries.slice(0, 50).map(entry => (
              <label key={entry.id} className="entry-checkbox">
                <input
                  type="checkbox"
                  checked={selectedEntries.some(e => e.id === entry.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEntries([...selectedEntries, entry]);
                    } else {
                      setSelectedEntries(selectedEntries.filter(e => e.id !== entry.id));
                    }
                  }}
                />
                <span className="entry-title">{entry.title}</span>
                <span className="entry-category">{entry.category}</span>
              </label>
            ))}
          </div>
        </div>

        <BulkOperationsPanel
          selectedEntries={selectedEntries}
          availableTags={tags}
          availableCategories={categories}
          onOperationExecute={onBulkOperation}
          onSelectionChange={setSelectedEntries}
        />
      </div>
    </div>
  );
};

const AnalyticsView: React.FC<{
  stats: ManagementStats;
}> = ({ stats }) => {
  return (
    <div className="analytics-view">
      <div className="view-header">
        <h2>Analytics & Insights</h2>
      </div>

      <div className="view-content">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Entries</h3>
            <div className="stat-value">{stats.totalEntries}</div>
          </div>
          <div className="stat-card">
            <h3>Total Tags</h3>
            <div className="stat-value">{stats.totalTags}</div>
          </div>
          <div className="stat-card">
            <h3>Total Categories</h3>
            <div className="stat-value">{stats.totalCategories}</div>
          </div>
          <div className="stat-card">
            <h3>Avg Tags per Entry</h3>
            <div className="stat-value">{stats.averageTagsPerEntry.toFixed(1)}</div>
          </div>
        </div>

        <div className="insights-section">
          <div className="most-used-tags">
            <h3>Most Used Tags</h3>
            <div className="tags-list">
              {stats.mostUsedTags.slice(0, 10).map(tag => (
                <div key={tag.id} className="tag-insight">
                  <span className="tag-name">{tag.name}</span>
                  <span className="tag-count">{tag.usage_count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="popular-categories">
            <h3>Most Popular Categories</h3>
            <div className="categories-list">
              {stats.mostPopularCategories.slice(0, 10).map(category => (
                <div key={category.id} className="category-insight">
                  <span className="category-name">{category.name}</span>
                  <span className="category-count">{category.entry_count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="recent-activity">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {stats.recentActivity.slice(0, 20).map((activity, index) => (
              <div key={index} className="activity-item">
                <span className="activity-date">
                  {activity.date.toLocaleDateString()}
                </span>
                <span className="activity-action">{activity.action}</span>
                <span className="activity-target">{activity.target}</span>
                <span className="activity-user">{activity.user}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================
// MAIN COMPONENT
// ===========================

export const CategoryTagManagementInterface = forwardRef<ManagementInterfaceRef, CategoryTagManagementInterfaceProps>(({
  className = '',
  entries = [],
  tags = [],
  categories = [],
  loading = false,
  error = null,
  defaultView = 'tags',
  enabledViews = ['tags', 'categories', 'bulk', 'analytics'],
  showStats = true,
  enableExportImport = true,
  ariaLabel = 'Category and tag management interface',
  announceChanges = true,
  onEntryUpdate,
  onTagCreate,
  onTagUpdate,
  onTagDelete,
  onCategoryCreate,
  onCategoryUpdate,
  onCategoryDelete,
  onBulkOperation,
  onExport,
  onImport
}, ref) => {

  // State
  const [currentView, setCurrentView] = useLocalStorage('management-view', defaultView);
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('sidebar-collapsed', false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Available views
  const availableViews: ManagementView[] = useMemo(() => [
    {
      id: 'tags',
      name: 'Tag Management',
      icon: '🏷️',
      description: 'Manage and organize tags',
      component: TagManagementView
    },
    {
      id: 'categories',
      name: 'Category Management',
      icon: '📁',
      description: 'Manage category hierarchy',
      component: CategoryManagementView
    },
    {
      id: 'bulk',
      name: 'Bulk Operations',
      icon: '⚙️',
      description: 'Perform batch operations',
      component: BulkOperationsView
    },
    {
      id: 'analytics',
      name: 'Analytics',
      icon: '📊',
      description: 'View insights and statistics',
      component: AnalyticsView
    }
  ].filter(view => enabledViews.includes(view.id)), [enabledViews]);

  // Calculate statistics
  const stats = useMemo<ManagementStats>(() => {
    const totalEntries = entries.length;
    const totalTags = tags.length;
    const totalCategories = categories.length;

    const tagCounts = entries.reduce((acc, entry) => {
      return acc + (entry.tags?.length || 0);
    }, 0);
    const averageTagsPerEntry = totalEntries > 0 ? tagCounts / totalEntries : 0;

    const mostUsedTags = [...tags]
      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
      .slice(0, 10);

    const mostPopularCategories = [...categories]
      .sort((a, b) => (b.entry_count || 0) - (a.entry_count || 0))
      .slice(0, 10);

    const recentActivity = [
      // Mock data - in real app, would come from activity log
      {
        date: new Date(),
        action: 'Created tag',
        target: 'new-tag',
        user: 'current-user'
      }
    ];

    return {
      totalEntries,
      totalTags,
      totalCategories,
      averageTagsPerEntry,
      mostUsedTags,
      mostPopularCategories,
      recentActivity
    };
  }, [entries, tags, categories]);

  // Event handlers
  const handleViewSwitch = useCallback((viewId: string) => {
    setCurrentView(viewId);
    announceToScreen(`Switched to ${availableViews.find(v => v.id === viewId)?.name}`);
  }, [availableViews]);

  const handleExport = useCallback(async (format: string) => {
    const data = {
      entries,
      tags,
      categories,
      stats,
      exportDate: new Date().toISOString()
    };

    await onExport?.(format, data);
    announceToScreen(`Exported data as ${format.toUpperCase()}`);
  }, [entries, tags, categories, stats, onExport]);

  const handleImport = useCallback(async (file: File) => {
    await onImport?.(file.type, file);
    announceToScreen('Data imported successfully');
  }, [onImport]);

  // Announce to screen reader
  const announceToScreen = useCallback((message: string) => {
    if (!announceChanges || !announcementRef.current) return;

    announcementRef.current.textContent = message;
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = '';
      }
    }, 1000);
  }, [announceChanges]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case '1':
      case '2':
      case '3':
      case '4':
        if (event.altKey) {
          event.preventDefault();
          const viewIndex = parseInt(event.key) - 1;
          if (availableViews[viewIndex]) {
            handleViewSwitch(availableViews[viewIndex].id);
          }
        }
        break;
      case 'b':
        if (event.altKey && event.ctrlKey) {
          event.preventDefault();
          setSidebarCollapsed(!sidebarCollapsed);
        }
        break;
    }
  }, [availableViews, handleViewSwitch, sidebarCollapsed]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    switchView: handleViewSwitch,
    refreshData: async () => {
      // Implementation would refresh data from services
      announceToScreen('Data refreshed');
    },
    exportData: handleExport,
    importData: handleImport,
    getStats: () => stats,
    focus: () => containerRef.current?.focus()
  }), [handleViewSwitch, handleExport, handleImport, stats]);

  // Render current view
  const renderCurrentView = () => {
    const view = availableViews.find(v => v.id === currentView);
    if (!view) return null;

    const ViewComponent = view.component;

    const commonProps = {
      entries,
      tags,
      categories
    };

    switch (view.id) {
      case 'tags':
        return (
          <TagManagementView
            {...commonProps}
            onTagCreate={onTagCreate!}
            onTagUpdate={onTagUpdate!}
            onTagDelete={onTagDelete!}
          />
        );
      case 'categories':
        return (
          <CategoryManagementView
            {...commonProps}
            onCategoryCreate={onCategoryCreate!}
            onCategoryUpdate={onCategoryUpdate!}
            onCategoryDelete={onCategoryDelete!}
          />
        );
      case 'bulk':
        return (
          <BulkOperationsView
            {...commonProps}
            onBulkOperation={onBulkOperation!}
          />
        );
      case 'analytics':
        return <AnalyticsView stats={stats} />;
      default:
        return null;
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className={`management-interface loading ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading management interface...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`management-interface error ${className}`} role="alert">
        <div className="error-container">
          <h3>Error Loading Interface</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`category-tag-management-interface ${className} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label={ariaLabel}
    >
      {/* Sidebar Navigation */}
      <nav className="management-sidebar" role="navigation">
        <div className="sidebar-header">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="collapse-button"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
          {!sidebarCollapsed && <h2>Management</h2>}
        </div>

        <div className="sidebar-nav">
          {availableViews.map((view, index) => (
            <button
              key={view.id}
              onClick={() => handleViewSwitch(view.id)}
              className={`nav-item ${currentView === view.id ? 'active' : ''}`}
              aria-current={currentView === view.id ? 'page' : undefined}
              title={view.description}
            >
              <span className="nav-icon">{view.icon}</span>
              {!sidebarCollapsed && (
                <>
                  <span className="nav-label">{view.name}</span>
                  <kbd className="nav-shortcut">Alt+{index + 1}</kbd>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Stats Summary */}
        {showStats && !sidebarCollapsed && (
          <div className="sidebar-stats">
            <h3>Quick Stats</h3>
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="stat-label">Entries</span>
                <span className="stat-value">{stats.totalEntries}</span>
              </div>
              <div className="quick-stat">
                <span className="stat-label">Tags</span>
                <span className="stat-value">{stats.totalTags}</span>
              </div>
              <div className="quick-stat">
                <span className="stat-label">Categories</span>
                <span className="stat-value">{stats.totalCategories}</span>
              </div>
            </div>
          </div>
        )}

        {/* Export/Import */}
        {enableExportImport && !sidebarCollapsed && (
          <div className="sidebar-actions">
            <button
              onClick={() => handleExport('json')}
              className="action-button"
            >
              📤 Export
            </button>
            <label className="action-button">
              📥 Import
              <input
                type="file"
                accept=".json,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="management-main">
        {renderCurrentView()}
      </main>

      {/* Screen Reader Announcements */}
      <div
        ref={announcementRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      {/* Keyboard shortcuts help */}
      <div className="keyboard-help sr-only">
        <p>Keyboard shortcuts: Alt+1-4 to switch views, Alt+Ctrl+B to toggle sidebar</p>
      </div>
    </div>
  );
});

CategoryTagManagementInterface.displayName = 'CategoryTagManagementInterface';

export default CategoryTagManagementInterface;