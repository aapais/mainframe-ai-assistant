/**
 * Quick Access Patterns Component
 *
 * Intelligent quick access component that learns user patterns and provides
 * shortcuts to frequently accessed entries, categories, and search queries.
 *
 * Features:
 * - Frequently accessed entries with usage statistics
 * - Smart pattern recognition based on user behavior
 * - Recent searches and bookmarked queries
 * - Time-based access patterns (recent, daily, weekly)
 * - Contextual suggestions based on current category
 * - Keyboard shortcuts for rapid access
 * - Customizable quick actions and favorites
 * - Drag-and-drop reordering
 *
 * @author Swarm Navigation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import {
  ClockIcon,
  StarIcon,
  FireIcon,
  BookmarkIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  EllipsisVerticalIcon
} from '../icons/NavigationIcons';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import './QuickAccessPatterns.css';

// ========================
// TYPES & INTERFACES
// ========================

export interface QuickAccessItem {
  id: string;
  type: 'entry' | 'category' | 'search' | 'action' | 'bookmark';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  metadata: {
    category?: string;
    lastAccessed?: Date;
    accessCount: number;
    accessScore: number;
    trending?: boolean;
    favorite?: boolean;
    shortcut?: string;
    tags?: string[];
  };
  preview?: {
    description: string;
    entryCount?: number;
    recentCount?: number;
  };
}

export interface AccessPattern {
  id: string;
  type: 'frequent' | 'recent' | 'trending' | 'contextual' | 'bookmarked';
  label: string;
  description: string;
  items: QuickAccessItem[];
  icon?: React.ReactNode;
  refreshable?: boolean;
  customizable?: boolean;
}

export interface QuickAccessPatternsProps {
  className?: string;
  /** Available access patterns */
  patterns: AccessPattern[];
  /** Currently selected pattern */
  activePattern?: string;
  /** Maximum items per pattern */
  maxItemsPerPattern?: number;
  /** Enable drag and drop reordering */
  enableReordering?: boolean;
  /** Enable pattern customization */
  enableCustomization?: boolean;
  /** Show usage statistics */
  showStats?: boolean;
  /** Show keyboard shortcuts */
  showShortcuts?: boolean;
  /** Compact mode for sidebar */
  compact?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Event handlers */
  onItemClick?: (item: QuickAccessItem) => void;
  onItemFavorite?: (item: QuickAccessItem, favorite: boolean) => void;
  onPatternChange?: (patternId: string) => void;
  onPatternRefresh?: (patternId: string) => void;
  onItemReorder?: (patternId: string, fromIndex: number, toIndex: number) => void;
  onPatternCustomize?: (patternId: string) => void;
  /** Accessibility */
  ariaLabel?: string;
}

// ========================
// DEFAULT PATTERNS
// ========================

const getDefaultIcon = (type: string) => {
  const icons = {
    frequent: <FireIcon className="w-4 h-4 text-orange-500" />,
    recent: <ClockIcon className="w-4 h-4 text-blue-500" />,
    trending: <FireIcon className="w-4 h-4 text-red-500" />,
    contextual: <ArrowRightIcon className="w-4 h-4 text-green-500" />,
    bookmarked: <BookmarkIcon className="w-4 h-4 text-purple-500" />
  };
  return icons[type as keyof typeof icons] || <StarIcon className="w-4 h-4" />;
};

// ========================
// QUICK ACCESS ITEM COMPONENT
// ========================

interface QuickAccessItemComponentProps {
  item: QuickAccessItem;
  index: number;
  pattern: AccessPattern;
  compact: boolean;
  showStats: boolean;
  showShortcuts: boolean;
  draggable: boolean;
  onItemClick: (item: QuickAccessItem) => void;
  onFavorite: (item: QuickAccessItem, favorite: boolean) => void;
  onDragStart?: (event: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent, index: number) => void;
  onDrop?: (event: React.DragEvent, index: number) => void;
}

const QuickAccessItemComponent = memo<QuickAccessItemComponentProps>(({
  item,
  index,
  pattern,
  compact,
  showStats,
  showShortcuts,
  draggable,
  onItemClick,
  onFavorite,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    onItemClick(item);
  }, [item, onItemClick]);

  const handleFavoriteToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onFavorite(item, !item.metadata.favorite);
  }, [item, onFavorite]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onItemClick(item);
        break;
      case 'f':
      case 'F':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onFavorite(item, !item.metadata.favorite);
        }
        break;
    }
  }, [item, onItemClick, onFavorite]);

  const handleDragStart = useCallback((event: React.DragEvent) => {
    if (!draggable) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
    onDragStart?.(event, index);
  }, [draggable, index, onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragOver(false);
    onDragEnd?.();
  }, [onDragEnd]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!draggable) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    onDragOver?.(event, index);
  }, [draggable, index, onDragOver]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (!draggable) return;
    event.preventDefault();
    setIsDragOver(false);
    onDrop?.(event, index);
  }, [draggable, index, onDrop]);

  const getItemIcon = () => {
    if (item.icon) return item.icon;

    const iconMap = {
      entry: <span className="text-blue-500">📄</span>,
      category: <span className="text-green-500">📁</span>,
      search: <MagnifyingGlassIcon className="w-4 h-4 text-gray-500" />,
      action: <span className="text-purple-500">⚡</span>,
      bookmark: <BookmarkIcon className="w-4 h-4 text-purple-500" />
    };

    return iconMap[item.type] || <span>📄</span>;
  };

  const formatLastAccessed = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      ref={itemRef}
      className={`quick-access-item ${compact ? 'compact' : ''} ${isDragOver ? 'drag-over' : ''} ${item.metadata.favorite ? 'favorite' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0}
      role="button"
      aria-describedby={`item-desc-${item.id}`}
      data-item-id={item.id}
      data-item-type={item.type}
    >
      {/* Item Content */}
      <div className="item-content">
        {/* Icon */}
        <div className="item-icon">
          {getItemIcon()}
          {item.metadata.trending && (
            <span className="trending-indicator" aria-label="Trending">
              🔥
            </span>
          )}
        </div>

        {/* Text Content */}
        <div className="item-text">
          <div className="item-title">
            {item.title}
            {item.metadata.shortcut && showShortcuts && (
              <span className="item-shortcut">{item.metadata.shortcut}</span>
            )}
          </div>
          {!compact && item.subtitle && (
            <div className="item-subtitle">{item.subtitle}</div>
          )}
          {!compact && item.preview && (
            <div className="item-preview">
              {item.preview.description}
              {item.preview.entryCount !== undefined && (
                <span className="entry-count">
                  • {item.preview.entryCount} entries
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        {showStats && !compact && (
          <div className="item-stats">
            <div className="access-count" title={`Accessed ${item.metadata.accessCount} times`}>
              {item.metadata.accessCount}
            </div>
            {item.metadata.lastAccessed && (
              <div className="last-accessed" title="Last accessed">
                {formatLastAccessed(item.metadata.lastAccessed)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`item-actions ${showActions ? 'visible' : ''}`}>
        <button
          type="button"
          className={`favorite-btn ${item.metadata.favorite ? 'active' : ''}`}
          onClick={handleFavoriteToggle}
          aria-label={`${item.metadata.favorite ? 'Remove from' : 'Add to'} favorites`}
          title={`${item.metadata.favorite ? 'Remove from' : 'Add to'} favorites`}
        >
          <StarIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="more-actions-btn"
          aria-label="More actions"
          title="More actions"
        >
          <EllipsisVerticalIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Hidden description for screen readers */}
      <div id={`item-desc-${item.id}`} className="sr-only">
        {item.type} - {item.title}
        {item.subtitle && ` - ${item.subtitle}`}
        {showStats && ` - Accessed ${item.metadata.accessCount} times`}
        {item.metadata.lastAccessed && ` - Last accessed ${formatLastAccessed(item.metadata.lastAccessed)}`}
      </div>
    </div>
  );
});

QuickAccessItemComponent.displayName = 'QuickAccessItemComponent';

// ========================
// PATTERN SECTION COMPONENT
// ========================

interface PatternSectionProps {
  pattern: AccessPattern;
  isActive: boolean;
  compact: boolean;
  showStats: boolean;
  showShortcuts: boolean;
  enableReordering: boolean;
  onItemClick: (item: QuickAccessItem) => void;
  onItemFavorite: (item: QuickAccessItem, favorite: boolean) => void;
  onPatternSelect: (patternId: string) => void;
  onPatternRefresh?: (patternId: string) => void;
  onItemReorder?: (patternId: string, fromIndex: number, toIndex: number) => void;
}

const PatternSection = memo<PatternSectionProps>(({
  pattern,
  isActive,
  compact,
  showStats,
  showShortcuts,
  enableReordering,
  onItemClick,
  onItemFavorite,
  onPatternSelect,
  onPatternRefresh,
  onItemReorder
}) => {
  const [dragState, setDragState] = useState<{ dragIndex: number | null; hoverIndex: number | null }>({
    dragIndex: null,
    hoverIndex: null
  });

  const handlePatternClick = useCallback(() => {
    if (!isActive) {
      onPatternSelect(pattern.id);
    }
  }, [pattern.id, isActive, onPatternSelect]);

  const handleRefresh = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onPatternRefresh?.(pattern.id);
  }, [pattern.id, onPatternRefresh]);

  const handleDragStart = useCallback((event: React.DragEvent, index: number) => {
    setDragState({ dragIndex: index, hoverIndex: null });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ dragIndex: null, hoverIndex: null });
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent, index: number) => {
    setDragState(prev => ({ ...prev, hoverIndex: index }));
  }, []);

  const handleDrop = useCallback((event: React.DragEvent, dropIndex: number) => {
    const dragIndex = parseInt(event.dataTransfer.getData('text/plain'));
    if (dragIndex !== dropIndex) {
      onItemReorder?.(pattern.id, dragIndex, dropIndex);
    }
    setDragState({ dragIndex: null, hoverIndex: null });
  }, [pattern.id, onItemReorder]);

  return (
    <div
      className={`pattern-section ${isActive ? 'active' : ''} ${compact ? 'compact' : ''}`}
      data-pattern-id={pattern.id}
    >
      {/* Pattern Header */}
      <div
        className="pattern-header"
        onClick={handlePatternClick}
        role="button"
        tabIndex={0}
        aria-expanded={isActive}
      >
        <div className="pattern-info">
          <div className="pattern-icon">
            {pattern.icon || getDefaultIcon(pattern.type)}
          </div>
          <div className="pattern-text">
            <h3 className="pattern-title">{pattern.label}</h3>
            {!compact && (
              <p className="pattern-description">{pattern.description}</p>
            )}
            <div className="pattern-count">
              {pattern.items.length} items
            </div>
          </div>
        </div>

        <div className="pattern-actions">
          {pattern.refreshable && (
            <button
              type="button"
              className="refresh-btn"
              onClick={handleRefresh}
              aria-label={`Refresh ${pattern.label}`}
              title={`Refresh ${pattern.label}`}
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* Pattern Items */}
      {isActive && (
        <div className="pattern-items" role="group" aria-label={`${pattern.label} items`}>
          {pattern.items.length === 0 ? (
            <div className="empty-pattern">
              <p>No items yet</p>
              <span className="empty-hint">Items will appear here based on your usage</span>
            </div>
          ) : (
            pattern.items.map((item, index) => (
              <QuickAccessItemComponent
                key={item.id}
                item={item}
                index={index}
                pattern={pattern}
                compact={compact}
                showStats={showStats}
                showShortcuts={showShortcuts}
                draggable={enableReordering}
                onItemClick={onItemClick}
                onFavorite={onItemFavorite}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});

PatternSection.displayName = 'PatternSection';

// ========================
// MAIN COMPONENT
// ========================

export const QuickAccessPatterns: React.FC<QuickAccessPatternsProps> = memo(({
  className = '',
  patterns = [],
  activePattern,
  maxItemsPerPattern = 10,
  enableReordering = true,
  enableCustomization = true,
  showStats = true,
  showShortcuts = true,
  compact = false,
  loading = false,
  onItemClick,
  onItemFavorite,
  onPatternChange,
  onPatternRefresh,
  onItemReorder,
  onPatternCustomize,
  ariaLabel = 'Quick access patterns'
}) => {
  const [selectedPattern, setSelectedPattern] = useState(
    activePattern || (patterns.length > 0 ? patterns[0].id : '')
  );

  // Update selected pattern when prop changes
  React.useEffect(() => {
    if (activePattern && activePattern !== selectedPattern) {
      setSelectedPattern(activePattern);
    }
  }, [activePattern, selectedPattern]);

  // Keyboard navigation
  const { focusedIndex, handleKeyDown } = useKeyboardNavigation({
    itemCount: patterns.length,
    orientation: 'vertical',
    loop: true
  });

  // Handle pattern selection
  const handlePatternSelect = useCallback((patternId: string) => {
    setSelectedPattern(patternId);
    onPatternChange?.(patternId);
  }, [onPatternChange]);

  // Handle item interactions
  const handleItemClick = useCallback((item: QuickAccessItem) => {
    onItemClick?.(item);

    // Track usage for pattern learning
    // This would update the access patterns in real usage
    console.log('Item accessed:', item.title);
  }, [onItemClick]);

  const handleItemFavorite = useCallback((item: QuickAccessItem, favorite: boolean) => {
    onItemFavorite?.(item, favorite);
  }, [onItemFavorite]);

  // Loading state
  if (loading) {
    return (
      <div className={`quick-access-patterns loading ${compact ? 'compact' : ''} ${className}`}>
        <div className="patterns-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="pattern-skeleton">
              <div className="skeleton-header" />
              <div className="skeleton-items">
                {Array.from({ length: 4 }, (_, j) => (
                  <div key={j} className="skeleton-item" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (patterns.length === 0) {
    return (
      <div className={`quick-access-patterns empty ${compact ? 'compact' : ''} ${className}`}>
        <div className="empty-state">
          <StarIcon className="w-12 h-12 text-gray-300" />
          <h3>No Quick Access Patterns</h3>
          <p>Start using the knowledge base to see your access patterns here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`quick-access-patterns ${compact ? 'compact' : ''} ${className}`}
      role="region"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      {!compact && (
        <div className="patterns-header">
          <h2 className="patterns-title">Quick Access</h2>
          {enableCustomization && (
            <button
              type="button"
              className="customize-btn"
              onClick={() => onPatternCustomize?.(selectedPattern)}
              aria-label="Customize patterns"
              title="Customize patterns"
            >
              ⚙️
            </button>
          )}
        </div>
      )}

      {/* Pattern Sections */}
      <div className="patterns-list">
        {patterns.map((pattern) => (
          <PatternSection
            key={pattern.id}
            pattern={pattern}
            isActive={pattern.id === selectedPattern}
            compact={compact}
            showStats={showStats}
            showShortcuts={showShortcuts}
            enableReordering={enableReordering}
            onItemClick={handleItemClick}
            onItemFavorite={handleItemFavorite}
            onPatternSelect={handlePatternSelect}
            onPatternRefresh={onPatternRefresh}
            onItemReorder={onItemReorder}
          />
        ))}
      </div>

      {/* Usage Hint */}
      {!compact && showShortcuts && (
        <div className="usage-hints">
          <p className="hint-text">
            💡 Tip: Use Ctrl+F to favorite items, or drag to reorder
          </p>
        </div>
      )}
    </div>
  );
});

QuickAccessPatterns.displayName = 'QuickAccessPatterns';

export default QuickAccessPatterns;