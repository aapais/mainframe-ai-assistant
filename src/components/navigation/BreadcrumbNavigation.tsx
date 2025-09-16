/**
 * Breadcrumb Navigation Component
 *
 * Hierarchical breadcrumb navigation showing current location in KB hierarchy
 * with interactive navigation and accessibility support.
 *
 * Features:
 * - Dynamic breadcrumb generation from current path
 * - Interactive navigation to any level
 * - Responsive collapse for mobile
 * - Keyboard navigation support
 * - ARIA landmark and navigation roles
 * - Context-aware path construction
 *
 * @author Swarm Navigation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import { ChevronRightIcon, HomeIcon, EllipsisIcon } from '../icons/NavigationIcons';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './BreadcrumbNavigation.css';

// ========================
// TYPES & INTERFACES
// ========================

export interface BreadcrumbItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  metadata?: {
    category?: string;
    entryCount?: number;
    type?: 'home' | 'category' | 'subcategory' | 'entry' | 'search';
  };
}

export interface BreadcrumbNavigationProps {
  className?: string;
  /** Current navigation path */
  items: BreadcrumbItem[];
  /** Maximum items to show before collapsing */
  maxItems?: number;
  /** Show home icon for root */
  showHomeIcon?: boolean;
  /** Enable interactive navigation */
  interactive?: boolean;
  /** Separator between items */
  separator?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Responsive behavior */
  responsive?: boolean;
  /** Event handlers */
  onNavigate?: (item: BreadcrumbItem, index: number) => void;
  onItemClick?: (item: BreadcrumbItem, index: number, event: React.MouseEvent) => void;
  /** Accessibility */
  ariaLabel?: string;
  announceNavigation?: boolean;
}

// ========================
// RESPONSIVE BREADCRUMBS
// ========================

const useResponsiveBreadcrumbs = (
  items: BreadcrumbItem[],
  maxItems: number = 4,
  responsive: boolean = true
) => {
  const [collapsed, setCollapsed] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLElement>(null);

  // Monitor container width for responsive behavior
  React.useEffect(() => {
    if (!responsive || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [responsive]);

  // Calculate visible items based on width and maxItems
  const visibleItems = useMemo(() => {
    if (!responsive || items.length <= maxItems) {
      return items;
    }

    // Auto-collapse based on width
    const shouldCollapse = containerWidth < 600 || items.length > maxItems;

    if (shouldCollapse && items.length > 3) {
      const first = items[0];
      const last = items[items.length - 1];
      const secondLast = items[items.length - 2];

      return [
        first,
        {
          id: 'collapsed',
          label: '...',
          metadata: { type: 'ellipsis' as const }
        },
        secondLast,
        last
      ];
    }

    return items;
  }, [items, maxItems, containerWidth, responsive]);

  return {
    containerRef,
    visibleItems,
    collapsed: visibleItems.some(item => item.metadata?.type === 'ellipsis'),
    shouldShowCollapsed: items.length > maxItems
  };
};

// ========================
// BREADCRUMB ITEM COMPONENT
// ========================

interface BreadcrumbItemComponentProps {
  item: BreadcrumbItem;
  index: number;
  isLast: boolean;
  separator: React.ReactNode;
  interactive: boolean;
  onClick?: (item: BreadcrumbItem, index: number, event: React.MouseEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

const BreadcrumbItemComponent = memo<BreadcrumbItemComponentProps>(({
  item,
  index,
  isLast,
  separator,
  interactive,
  onClick,
  onKeyDown
}) => {
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!interactive || item.metadata?.type === 'ellipsis') return;
    onClick?.(item, index, event);
  }, [item, index, interactive, onClick]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!interactive) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (item.metadata?.type !== 'ellipsis') {
          onClick?.(item, index, event as any);
        }
        break;
      default:
        onKeyDown?.(event);
    }
  }, [item, index, interactive, onClick, onKeyDown]);

  // Special handling for ellipsis item
  if (item.metadata?.type === 'ellipsis') {
    return (
      <>
        <span
          className="breadcrumb-ellipsis"
          aria-label="Collapsed navigation items"
          title="Click to expand all items"
        >
          <EllipsisIcon className="w-4 h-4 text-gray-400" />
        </span>
        {!isLast && (
          <span className="breadcrumb-separator" aria-hidden="true">
            {separator}
          </span>
        )}
      </>
    );
  }

  const ItemContent = () => (
    <>
      {/* Item Icon */}
      {item.icon && (
        <span className="breadcrumb-icon" aria-hidden="true">
          {item.icon}
        </span>
      )}

      {/* Item Label */}
      <span className="breadcrumb-label">
        {item.label}
      </span>

      {/* Entry Count Badge */}
      {item.metadata?.entryCount !== undefined && (
        <span
          className="breadcrumb-badge"
          title={`${item.metadata.entryCount} entries`}
        >
          {item.metadata.entryCount}
        </span>
      )}
    </>
  );

  return (
    <>
      {interactive && !isLast ? (
        <button
          type="button"
          className={`breadcrumb-item interactive ${item.isActive ? 'active' : ''}`}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-current={isLast ? 'page' : undefined}
          data-breadcrumb-type={item.metadata?.type}
        >
          <ItemContent />
        </button>
      ) : (
        <span
          className={`breadcrumb-item static ${item.isActive ? 'active' : ''} ${isLast ? 'current' : ''}`}
          aria-current={isLast ? 'page' : undefined}
          data-breadcrumb-type={item.metadata?.type}
        >
          <ItemContent />
        </span>
      )}

      {!isLast && (
        <span className="breadcrumb-separator" aria-hidden="true">
          {separator}
        </span>
      )}
    </>
  );
});

BreadcrumbItemComponent.displayName = 'BreadcrumbItemComponent';

// ========================
// MAIN COMPONENT
// ========================

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = memo(({
  className = '',
  items = [],
  maxItems = 4,
  showHomeIcon = true,
  interactive = true,
  separator = <ChevronRightIcon className="w-4 h-4 text-gray-400" />,
  loading = false,
  responsive = true,
  onNavigate,
  onItemClick,
  ariaLabel = 'Breadcrumb navigation',
  announceNavigation = true
}) => {
  // Responsive breadcrumbs logic
  const { containerRef, visibleItems, collapsed } = useResponsiveBreadcrumbs(
    items,
    maxItems,
    responsive
  );

  // Keyboard navigation
  const { focusedIndex, handleKeyDown } = useKeyboardNavigation({
    itemCount: visibleItems.length,
    orientation: 'horizontal',
    loop: false
  });

  // Enhanced items with home icon
  const enhancedItems = useMemo(() => {
    if (items.length === 0) return [];

    const processed = [...items];

    // Add home icon to first item if enabled
    if (showHomeIcon && processed[0] && !processed[0].icon) {
      processed[0] = {
        ...processed[0],
        icon: <HomeIcon className="w-4 h-4" />
      };
    }

    return processed;
  }, [items, showHomeIcon]);

  // Handle navigation
  const handleItemClick = useCallback((
    item: BreadcrumbItem,
    index: number,
    event: React.MouseEvent
  ) => {
    if (item.metadata?.type === 'ellipsis') {
      // Show collapsed items
      return;
    }

    onNavigate?.(item, index);
    onItemClick?.(item, index, event);

    // Announce navigation for screen readers
    if (announceNavigation) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = `Navigated to ${item.label}`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  }, [onNavigate, onItemClick, announceNavigation]);

  // Loading state
  if (loading) {
    return (
      <nav className={`breadcrumb-navigation loading ${className}`} aria-label={ariaLabel}>
        <div className="breadcrumb-skeleton">
          <div className="skeleton-item w-16 h-4 bg-gray-200 rounded animate-pulse" />
          <span className="skeleton-separator text-gray-300">/</span>
          <div className="skeleton-item w-24 h-4 bg-gray-200 rounded animate-pulse" />
          <span className="skeleton-separator text-gray-300">/</span>
          <div className="skeleton-item w-20 h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      </nav>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <nav className={`breadcrumb-navigation empty ${className}`} aria-label={ariaLabel}>
        <div className="breadcrumb-empty">
          <HomeIcon className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Home</span>
        </div>
      </nav>
    );
  }

  return (
    <nav
      ref={containerRef}
      className={`breadcrumb-navigation ${collapsed ? 'collapsed' : ''} ${className}`}
      aria-label={ariaLabel}
      role="navigation"
    >
      <ol className="breadcrumb-list" role="list">
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;

          return (
            <li key={item.id} className="breadcrumb-list-item" role="listitem">
              <BreadcrumbItemComponent
                item={item}
                index={index}
                isLast={isLast}
                separator={separator}
                interactive={interactive}
                onClick={handleItemClick}
                onKeyDown={handleKeyDown}
              />
            </li>
          );
        })}
      </ol>

      {/* Expanded items overlay for mobile */}
      {responsive && collapsed && (
        <div className="breadcrumb-expansion" role="complementary" aria-hidden="true">
          {/* This could show the full path on demand */}
        </div>
      )}

      {/* Screen reader current location */}
      {items.length > 0 && (
        <div className="sr-only" aria-live="polite">
          Current location: {items.map(item => item.label).join(' > ')}
        </div>
      )}
    </nav>
  );
});

BreadcrumbNavigation.displayName = 'BreadcrumbNavigation';

export default BreadcrumbNavigation;