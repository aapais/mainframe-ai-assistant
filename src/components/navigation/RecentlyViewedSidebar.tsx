/**
 * Recently Viewed Entries Sidebar
 *
 * Smart sidebar component that tracks and displays recently accessed
 * KB entries with intelligent grouping, persistence, and quick access features.
 *
 * Features:
 * - Recently viewed entries with thumbnails and metadata
 * - Time-based grouping (Today, Yesterday, This Week, Older)
 * - Session-based and persistent storage
 * - Quick preview on hover
 * - Pinned/favorite entries at top
 * - Search within recent entries
 * - Clear history functionality
 * - Keyboard navigation support
 * - Collapsible sections
 *
 * @author Swarm Navigation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import {
  ClockIcon,
  StarIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  ChevronRightIcon,
  PinIcon
} from '../icons/NavigationIcons';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './RecentlyViewedSidebar.css';

// ========================
// TYPES & INTERFACES
// ========================

export interface RecentEntry {
  id: string;
  title: string;
  category: string;
  snippet: string;
  viewedAt: Date;
  viewCount: number;
  isPinned: boolean;
  metadata: {
    type: 'entry' | 'category' | 'search';
    tags: string[];
    lastModified: Date;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    popularity: number;
    estimatedReadTime?: number;
  };
  preview?: {
    thumbnail?: string;
    description: string;
    keyPoints: string[];
  };
}

export interface TimeGroup {
  id: string;
  label: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  entries: RecentEntry[];
  collapsed: boolean;
}

export interface RecentlyViewedSidebarProps {
  className?: string;
  /** Recently viewed entries */
  entries: RecentEntry[];
  /** Maximum entries to show */
  maxEntries?: number;
  /** Enable entry pinning */
  enablePinning?: boolean;
  /** Enable search within recent */
  enableSearch?: boolean;
  /** Enable quick preview */
  enablePreview?: boolean;
  /** Show entry metadata */
  showMetadata?: boolean;
  /** Group entries by time */
  groupByTime?: boolean;
  /** Collapsible sidebar */
  collapsible?: boolean;
  /** Initially collapsed */
  initiallyCollapsed?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Event handlers */
  onEntryClick?: (entry: RecentEntry) => void;
  onEntryPin?: (entry: RecentEntry, pinned: boolean) => void;
  onEntryRemove?: (entry: RecentEntry) => void;
  onClearHistory?: () => void;
  onPreviewToggle?: (entry: RecentEntry, show: boolean) => void;
  onGroupToggle?: (groupId: string, collapsed: boolean) => void;
  /** Accessibility */
  ariaLabel?: string;
  announceChanges?: boolean;
}

// ========================
// TIME GROUPING UTILITIES
// ========================

const getTimeGroups = (entries: RecentEntry[]): TimeGroup[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: TimeGroup[] = [
    {
      id: 'today',
      label: 'Today',
      dateRange: { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
      entries: [],
      collapsed: false
    },
    {
      id: 'yesterday',
      label: 'Yesterday',
      dateRange: { start: yesterday, end: today },
      entries: [],
      collapsed: false
    },
    {
      id: 'this-week',
      label: 'This Week',
      dateRange: { start: weekAgo, end: yesterday },
      entries: [],
      collapsed: false
    },
    {
      id: 'older',
      label: 'Older',
      dateRange: { start: new Date(0), end: weekAgo },
      entries: [],
      collapsed: true
    }
  ];

  // Distribute entries into groups
  entries.forEach(entry => {
    const viewDate = entry.viewedAt;

    for (const group of groups) {
      if (viewDate >= group.dateRange.start && viewDate < group.dateRange.end) {
        group.entries.push(entry);
        break;
      }
    }
  });

  // Remove empty groups
  return groups.filter(group => group.entries.length > 0);
};

// ========================
// ENTRY PREVIEW COMPONENT
// ========================

interface EntryPreviewProps {
  entry: RecentEntry;
  onClose: () => void;
}

const EntryPreview = memo<EntryPreviewProps>(({ entry, onClose }) => {
  return (
    <div className="entry-preview-popup">
      <div className="preview-header">
        <h4 className="preview-title">{entry.title}</h4>
        <button
          type="button"
          className="preview-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="preview-content">
        <div className="preview-meta">
          <span className="preview-category">{entry.category}</span>
          {entry.metadata.estimatedReadTime && (
            <span className="preview-read-time">
              {entry.metadata.estimatedReadTime} min read
            </span>
          )}
        </div>

        <p className="preview-description">
          {entry.preview?.description || entry.snippet}
        </p>

        {entry.preview?.keyPoints && entry.preview.keyPoints.length > 0 && (
          <div className="preview-key-points">
            <h5>Key Points:</h5>
            <ul>
              {entry.preview.keyPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="preview-stats">
          <span>Viewed {entry.viewCount} times</span>
          <span>Last: {entry.viewedAt.toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
});

EntryPreview.displayName = 'EntryPreview';

// ========================
// RECENT ENTRY COMPONENT
// ========================

interface RecentEntryComponentProps {
  entry: RecentEntry;
  compact: boolean;
  showMetadata: boolean;
  enablePreview: boolean;
  enablePinning: boolean;
  onEntryClick: (entry: RecentEntry) => void;
  onEntryPin: (entry: RecentEntry, pinned: boolean) => void;
  onEntryRemove: (entry: RecentEntry) => void;
  onPreviewToggle: (entry: RecentEntry, show: boolean) => void;
}

const RecentEntryComponent = memo<RecentEntryComponentProps>(({
  entry,
  compact,
  showMetadata,
  enablePreview,
  enablePinning,
  onEntryClick,
  onEntryPin,
  onEntryRemove,
  onPreviewToggle
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const entryRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    onEntryClick(entry);
  }, [entry, onEntryClick]);

  const handlePin = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onEntryPin(entry, !entry.isPinned);
  }, [entry, onEntryPin]);

  const handleRemove = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onEntryRemove(entry);
  }, [entry, onEntryRemove]);

  const handlePreviewToggle = useCallback((show: boolean) => {
    setShowPreview(show);
    onPreviewToggle(entry, show);
  }, [entry, onPreviewToggle]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onEntryClick(entry);
        break;
      case 'p':
      case 'P':
        if (enablePinning) {
          event.preventDefault();
          onEntryPin(entry, !entry.isPinned);
        }
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        onEntryRemove(entry);
        break;
    }
  }, [entry, enablePinning, onEntryClick, onEntryPin, onEntryRemove]);

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getDifficultyColor = (difficulty?: string) => {
    const colors = {
      beginner: 'text-green-600',
      intermediate: 'text-yellow-600',
      advanced: 'text-red-600'
    };
    return difficulty ? colors[difficulty as keyof typeof colors] : '';
  };

  return (
    <>
      <div
        ref={entryRef}
        className={`recent-entry ${compact ? 'compact' : ''} ${entry.isPinned ? 'pinned' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => {
          setShowActions(true);
          if (enablePreview) handlePreviewToggle(true);
        }}
        onMouseLeave={() => {
          setShowActions(false);
          if (enablePreview) handlePreviewToggle(false);
        }}
        tabIndex={0}
        role="button"
        aria-describedby={`entry-desc-${entry.id}`}
        data-entry-id={entry.id}
      >
        {/* Pinned Indicator */}
        {entry.isPinned && (
          <div className="pinned-indicator" aria-label="Pinned entry">
            <PinIcon className="w-3 h-3" />
          </div>
        )}

        <div className="entry-content">
          {/* Entry Icon/Thumbnail */}
          <div className="entry-icon">
            {entry.preview?.thumbnail ? (
              <img
                src={entry.preview.thumbnail}
                alt=""
                className="entry-thumbnail"
              />
            ) : (
              <span className="entry-type-icon">
                {entry.metadata.type === 'entry' ? '📄' :
                 entry.metadata.type === 'category' ? '📁' : '🔍'}
              </span>
            )}
          </div>

          {/* Entry Text */}
          <div className="entry-text">
            <h4 className="entry-title">{entry.title}</h4>
            {!compact && (
              <p className="entry-snippet">{entry.snippet}</p>
            )}

            <div className="entry-meta">
              <span className="entry-category">{entry.category}</span>
              <span className="entry-time">{getTimeAgo(entry.viewedAt)}</span>
              {showMetadata && entry.metadata.difficulty && (
                <span className={`entry-difficulty ${getDifficultyColor(entry.metadata.difficulty)}`}>
                  {entry.metadata.difficulty}
                </span>
              )}
            </div>
          </div>

          {/* View Count */}
          {showMetadata && (
            <div className="entry-stats">
              <div className="view-count" title={`Viewed ${entry.viewCount} times`}>
                <EyeIcon className="w-3 h-3" />
                <span>{entry.viewCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Entry Actions */}
        <div className={`entry-actions ${showActions ? 'visible' : ''}`}>
          {enablePinning && (
            <button
              type="button"
              className={`action-btn pin-btn ${entry.isPinned ? 'active' : ''}`}
              onClick={handlePin}
              aria-label={entry.isPinned ? 'Unpin entry' : 'Pin entry'}
              title={entry.isPinned ? 'Unpin entry (P)' : 'Pin entry (P)'}
            >
              <PinIcon className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            className="action-btn remove-btn"
            onClick={handleRemove}
            aria-label="Remove from recent"
            title="Remove from recent (Delete)"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </div>

        {/* Hidden description for screen readers */}
        <div id={`entry-desc-${entry.id}`} className="sr-only">
          {entry.metadata.type} - {entry.title} in {entry.category}
          {entry.isPinned && ' - Pinned'}
          {showMetadata && ` - Viewed ${entry.viewCount} times`}
          {` - Last viewed ${getTimeAgo(entry.viewedAt)}`}
        </div>
      </div>

      {/* Entry Preview */}
      {showPreview && enablePreview && entry.preview && (
        <EntryPreview
          entry={entry}
          onClose={() => handlePreviewToggle(false)}
        />
      )}
    </>
  );
});

RecentEntryComponent.displayName = 'RecentEntryComponent';

// ========================
// TIME GROUP COMPONENT
// ========================

interface TimeGroupComponentProps {
  group: TimeGroup;
  compact: boolean;
  showMetadata: boolean;
  enablePreview: boolean;
  enablePinning: boolean;
  onEntryClick: (entry: RecentEntry) => void;
  onEntryPin: (entry: RecentEntry, pinned: boolean) => void;
  onEntryRemove: (entry: RecentEntry) => void;
  onPreviewToggle: (entry: RecentEntry, show: boolean) => void;
  onGroupToggle: (groupId: string, collapsed: boolean) => void;
}

const TimeGroupComponent = memo<TimeGroupComponentProps>(({
  group,
  compact,
  showMetadata,
  enablePreview,
  enablePinning,
  onEntryClick,
  onEntryPin,
  onEntryRemove,
  onPreviewToggle,
  onGroupToggle
}) => {
  const handleToggle = useCallback(() => {
    onGroupToggle(group.id, !group.collapsed);
  }, [group.id, group.collapsed, onGroupToggle]);

  return (
    <div className={`time-group ${group.collapsed ? 'collapsed' : ''}`}>
      <button
        type="button"
        className="group-header"
        onClick={handleToggle}
        aria-expanded={!group.collapsed}
        aria-controls={`group-content-${group.id}`}
      >
        <ChevronRightIcon
          className={`group-chevron ${!group.collapsed ? 'expanded' : ''}`}
        />
        <span className="group-label">{group.label}</span>
        <span className="group-count">({group.entries.length})</span>
      </button>

      <div
        id={`group-content-${group.id}`}
        className="group-content"
        role="group"
        aria-labelledby={`group-header-${group.id}`}
      >
        {!group.collapsed && group.entries.map(entry => (
          <RecentEntryComponent
            key={entry.id}
            entry={entry}
            compact={compact}
            showMetadata={showMetadata}
            enablePreview={enablePreview}
            enablePinning={enablePinning}
            onEntryClick={onEntryClick}
            onEntryPin={onEntryPin}
            onEntryRemove={onEntryRemove}
            onPreviewToggle={onPreviewToggle}
          />
        ))}
      </div>
    </div>
  );
});

TimeGroupComponent.displayName = 'TimeGroupComponent';

// ========================
// MAIN COMPONENT
// ========================

export const RecentlyViewedSidebar: React.FC<RecentlyViewedSidebarProps> = memo(({
  className = '',
  entries = [],
  maxEntries = 50,
  enablePinning = true,
  enableSearch = true,
  enablePreview = true,
  showMetadata = true,
  groupByTime = true,
  collapsible = true,
  initiallyCollapsed = false,
  compact = false,
  loading = false,
  onEntryClick,
  onEntryPin,
  onEntryRemove,
  onClearHistory,
  onPreviewToggle,
  onGroupToggle,
  ariaLabel = 'Recently viewed entries',
  announceChanges = true
}) => {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupStates, setGroupStates] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Filter and process entries
  const processedEntries = useMemo(() => {
    let filtered = entries.slice(0, maxEntries);

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(query) ||
        entry.snippet.toLowerCase().includes(query) ||
        entry.category.toLowerCase().includes(query) ||
        entry.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort: pinned first, then by view date
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.viewedAt.getTime() - a.viewedAt.getTime();
    });
  }, [entries, maxEntries, searchQuery]);

  // Group entries by time if enabled
  const timeGroups = useMemo(() => {
    if (!groupByTime) return [];
    return getTimeGroups(processedEntries).map(group => ({
      ...group,
      collapsed: groupStates[group.id] ?? group.collapsed
    }));
  }, [processedEntries, groupByTime, groupStates]);

  // Keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation({
    itemCount: processedEntries.length,
    orientation: 'vertical',
    loop: false
  });

  // Event handlers
  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleGroupToggleInternal = useCallback((groupId: string, collapsed: boolean) => {
    setGroupStates(prev => ({ ...prev, [groupId]: collapsed }));
    onGroupToggle?.(groupId, collapsed);
  }, [onGroupToggle]);

  const handleClearHistory = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all recent entries?')) {
      onClearHistory?.();
      setSearchQuery('');

      if (announceChanges) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = 'Recent entries cleared';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    }
  }, [onClearHistory, announceChanges]);

  // Loading state
  if (loading) {
    return (
      <div className={`recently-viewed-sidebar loading ${compact ? 'compact' : ''} ${className}`}>
        <div className="sidebar-skeleton">
          <div className="skeleton-header" />
          <div className="skeleton-search" />
          <div className="skeleton-entries">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton-entry" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className={`recently-viewed-sidebar ${collapsed ? 'collapsed' : ''} ${compact ? 'compact' : ''} ${className}`}
      role="complementary"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="header-title">
          <ClockIcon className="w-4 h-4" />
          <span>Recently Viewed</span>
          {!collapsed && entries.length > 0 && (
            <span className="entry-count">({entries.length})</span>
          )}
        </div>

        {collapsible && (
          <button
            type="button"
            className="collapse-btn"
            onClick={handleToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRightIcon
              className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            />
          </button>
        )}
      </div>

      {/* Sidebar Content */}
      {!collapsed && (
        <div className="sidebar-content">
          {/* Search */}
          {enableSearch && entries.length > 0 && (
            <div className="sidebar-search">
              <div className="search-input-container">
                <MagnifyingGlassIcon className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search recent..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  aria-label="Search recent entries"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {entries.length > 0 && (
            <div className="sidebar-actions">
              <button
                type="button"
                className="clear-all-btn"
                onClick={handleClearHistory}
                title="Clear all recent entries"
              >
                <TrashIcon className="w-3 h-3" />
                {!compact && <span>Clear All</span>}
              </button>
            </div>
          )}

          {/* Entries */}
          <div className="sidebar-entries">
            {processedEntries.length === 0 ? (
              <div className="empty-state">
                {searchQuery ? (
                  <>
                    <p>No matching entries</p>
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={handleClearSearch}
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <p>No recent entries yet</p>
                )}
              </div>
            ) : groupByTime ? (
              // Grouped by time
              timeGroups.map(group => (
                <TimeGroupComponent
                  key={group.id}
                  group={group}
                  compact={compact}
                  showMetadata={showMetadata}
                  enablePreview={enablePreview}
                  enablePinning={enablePinning}
                  onEntryClick={onEntryClick || (() => {})}
                  onEntryPin={onEntryPin || (() => {})}
                  onEntryRemove={onEntryRemove || (() => {})}
                  onPreviewToggle={onPreviewToggle || (() => {})}
                  onGroupToggle={handleGroupToggleInternal}
                />
              ))
            ) : (
              // Flat list
              processedEntries.map(entry => (
                <RecentEntryComponent
                  key={entry.id}
                  entry={entry}
                  compact={compact}
                  showMetadata={showMetadata}
                  enablePreview={enablePreview}
                  enablePinning={enablePinning}
                  onEntryClick={onEntryClick || (() => {})}
                  onEntryPin={onEntryPin || (() => {})}
                  onEntryRemove={onEntryRemove || (() => {})}
                  onPreviewToggle={onPreviewToggle || (() => {})}
                />
              ))
            )}
          </div>

          {/* Usage Hints */}
          {!compact && processedEntries.length > 0 && (
            <div className="sidebar-hints">
              <p className="hint-text">
                💡 Tip: Press P to pin, Delete to remove
              </p>
            </div>
          )}
        </div>
      )}

      {/* Screen Reader Announcements */}
      {announceChanges && (
        <div className="sr-only" aria-live="polite">
          {searchQuery && `${processedEntries.length} entries found`}
          {collapsed ? 'Recently viewed sidebar collapsed' : 'Recently viewed sidebar expanded'}
        </div>
      )}
    </div>
  );
});

RecentlyViewedSidebar.displayName = 'RecentlyViewedSidebar';

export default RecentlyViewedSidebar;