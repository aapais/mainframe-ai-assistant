/**
 * VirtualScrolling Component
 *
 * High-performance virtual scrolling for large result sets.
 * Optimized for 60fps scrolling with minimal memory usage.
 *
 * Performance targets:
 * - Render only visible items
 * - Smooth scrolling at 60fps
 * - Memory usage independent of total items
 * - Sub-100ms initial render
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  CSSProperties
} from 'react';
import { useResizeObserver } from '../../hooks/useResizeObserver';

// ========================
// Types & Interfaces
// ========================

export interface VirtualScrollingProps<T> {
  /** Array of all items to virtualize */
  items: T[];
  /** Height of each item in pixels */
  itemHeight: number | ((index: number, item: T) => number);
  /** Height of the container */
  height: number;
  /** Width of the container */
  width?: number;
  /** Number of items to render outside viewport (default: 5) */
  overscan?: number;
  /** Custom class name */
  className?: string;
  /** Render function for each item */
  renderItem: (props: {
    item: T;
    index: number;
    style: CSSProperties;
  }) => React.ReactNode;
  /** Optional loading component */
  renderLoading?: () => React.ReactNode;
  /** Optional empty state component */
  renderEmpty?: () => React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Scroll event handler */
  onScroll?: (scrollTop: number) => void;
  /** Item selection handler */
  onItemSelect?: (item: T, index: number) => void;
  /** Scroll to item index */
  scrollToIndex?: number;
  /** Scroll behavior */
  scrollBehavior?: 'auto' | 'smooth';
  /** Enable horizontal scrolling */
  horizontal?: boolean;
  /** Accessibility */
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role?: string;
}

interface VirtualItem {
  index: number;
  start: number;
  end: number;
  size: number;
}

interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
  isScrolling: boolean;
}

// ========================
// Utility Functions
// ========================

function getItemSize<T>(
  itemHeight: number | ((index: number, item: T) => number),
  index: number,
  item: T
): number {
  return typeof itemHeight === 'function' ? itemHeight(index, item) : itemHeight;
}

function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  items: any[],
  itemHeight: number | ((index: number, item: any) => number),
  overscan: number = 5
): { startIndex: number; endIndex: number; visibleItems: VirtualItem[] } {
  if (items.length === 0) {
    return { startIndex: 0, endIndex: 0, visibleItems: [] };
  }

  let startIndex = 0;
  let currentOffset = 0;

  // Find start index
  if (typeof itemHeight === 'number') {
    // Fixed height optimization
    startIndex = Math.floor(scrollTop / itemHeight);
    startIndex = Math.max(0, Math.min(startIndex, items.length - 1));
  } else {
    // Dynamic height calculation
    for (let i = 0; i < items.length; i++) {
      const size = getItemSize(itemHeight, i, items[i]);
      if (currentOffset + size > scrollTop) {
        startIndex = i;
        break;
      }
      currentOffset += size;
    }
  }

  // Calculate visible items
  const visibleItems: VirtualItem[] = [];
  const viewportEnd = scrollTop + containerHeight;
  let offset = currentOffset;

  for (let i = startIndex; i < items.length; i++) {
    const size = getItemSize(itemHeight, i, items[i]);

    if (offset > viewportEnd + overscan * size) {
      break;
    }

    visibleItems.push({
      index: i,
      start: offset,
      end: offset + size,
      size
    });

    offset += size;
  }

  const endIndex = visibleItems.length > 0
    ? visibleItems[visibleItems.length - 1].index
    : startIndex;

  return {
    startIndex: Math.max(0, startIndex - overscan),
    endIndex: Math.min(items.length - 1, endIndex + overscan),
    visibleItems
  };
}

function getTotalSize<T>(
  items: T[],
  itemHeight: number | ((index: number, item: T) => number)
): number {
  if (typeof itemHeight === 'number') {
    return items.length * itemHeight;
  }

  return items.reduce((total, item, index) => {
    return total + getItemSize(itemHeight, index, item);
  }, 0);
}

// ========================
// Main Component
// ========================

export const VirtualScrolling = memo(<T,>({
  items,
  itemHeight,
  height,
  width = '100%',
  overscan = 5,
  className = '',
  renderItem,
  renderLoading,
  renderEmpty,
  loading = false,
  onScroll,
  onItemSelect,
  scrollToIndex,
  scrollBehavior = 'auto',
  horizontal = false,
  ariaLabel = 'Virtual scroll list',
  ariaDescribedBy,
  role = 'list'
}: VirtualScrollingProps<T>) => {
  // ========================
  // State & Refs
  // ========================

  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollTop: 0,
    scrollLeft: 0,
    isScrolling: false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // ========================
  // Resize Observer
  // ========================

  const { width: observedWidth, height: observedHeight } = useResizeObserver({
    ref: containerRef,
    box: 'border-box'
  });

  const containerWidth = typeof width === 'number' ? width : observedWidth || 0;
  const containerHeight = height || observedHeight || 0;

  // ========================
  // Calculations
  // ========================

  const totalSize = useMemo(() => {
    return getTotalSize(items, itemHeight);
  }, [items, itemHeight]);

  const { startIndex, endIndex, visibleItems } = useMemo(() => {
    const scrollPosition = horizontal ? scrollState.scrollLeft : scrollState.scrollTop;
    const containerSize = horizontal ? containerWidth : containerHeight;

    return calculateVisibleRange(
      scrollPosition,
      containerSize,
      items,
      itemHeight,
      overscan
    );
  }, [
    items,
    itemHeight,
    scrollState.scrollTop,
    scrollState.scrollLeft,
    containerWidth,
    containerHeight,
    overscan,
    horizontal
  ]);

  // ========================
  // Event Handlers
  // ========================

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const newScrollTop = target.scrollTop;
    const newScrollLeft = target.scrollLeft;

    setScrollState(prev => ({
      ...prev,
      scrollTop: newScrollTop,
      scrollLeft: newScrollLeft,
      isScrolling: true
    }));

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set timeout to detect scroll end
    scrollTimeoutRef.current = setTimeout(() => {
      setScrollState(prev => ({
        ...prev,
        isScrolling: false
      }));
    }, 150);

    // Call external scroll handler
    onScroll?.(newScrollTop);
  }, [onScroll]);

  const handleItemClick = useCallback((item: T, index: number) => {
    onItemSelect?.(item, index);
  }, [onItemSelect]);

  // ========================
  // Scroll to Index
  // ========================

  useEffect(() => {
    if (scrollToIndex !== undefined && containerRef.current) {
      const container = containerRef.current;
      let targetOffset = 0;

      // Calculate offset to target index
      if (typeof itemHeight === 'number') {
        targetOffset = scrollToIndex * itemHeight;
      } else {
        for (let i = 0; i < scrollToIndex && i < items.length; i++) {
          targetOffset += getItemSize(itemHeight, i, items[i]);
        }
      }

      // Scroll to position
      if (horizontal) {
        container.scrollTo({
          left: targetOffset,
          behavior: scrollBehavior
        });
      } else {
        container.scrollTo({
          top: targetOffset,
          behavior: scrollBehavior
        });
      }
    }
  }, [scrollToIndex, scrollBehavior, itemHeight, items, horizontal]);

  // ========================
  // Cleanup
  // ========================

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // ========================
  // Render Loading State
  // ========================

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
        aria-label="Loading items"
      >
        {renderLoading ? renderLoading() : (
          <div className="text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        )}
      </div>
    );
  }

  // ========================
  // Render Empty State
  // ========================

  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height, width }}
        aria-label="No items"
      >
        {renderEmpty ? renderEmpty() : (
          <div className="text-gray-500 dark:text-gray-400">
            No items to display
          </div>
        )}
      </div>
    );
  }

  // ========================
  // Render Virtual List
  // ========================

  const containerStyle: CSSProperties = {
    height,
    width,
    overflow: 'auto',
    position: 'relative',
    willChange: 'scroll-position'
  };

  const innerStyle: CSSProperties = horizontal ? {
    width: totalSize,
    height: '100%',
    position: 'relative'
  } : {
    height: totalSize,
    width: '100%',
    position: 'relative'
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      onScroll={handleScroll}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      role={role}
      aria-rowcount={items.length}
      aria-setsize={items.length}
    >
      <div style={innerStyle}>
        {visibleItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const itemStyle: CSSProperties = horizontal ? {
            position: 'absolute',
            left: virtualItem.start,
            top: 0,
            width: virtualItem.size,
            height: '100%'
          } : {
            position: 'absolute',
            top: virtualItem.start,
            left: 0,
            height: virtualItem.size,
            width: '100%'
          };

          return (
            <div
              key={virtualItem.index}
              style={itemStyle}
              onClick={() => handleItemClick(item, virtualItem.index)}
              role="listitem"
              aria-posinset={virtualItem.index + 1}
              aria-setsize={items.length}
            >
              {renderItem({
                item,
                index: virtualItem.index,
                style: itemStyle
              })}
            </div>
          );
        })}
      </div>

      {/* Scroll indicators */}
      {scrollState.isScrolling && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          {Math.round((scrollState.scrollTop / (totalSize - containerHeight)) * 100)}%
        </div>
      )}
    </div>
  );
});

VirtualScrolling.displayName = 'VirtualScrolling';

// ========================
// Hook for Virtual Scrolling
// ========================

export function useVirtualScrolling<T>(
  items: T[],
  options: {
    itemHeight: number | ((index: number, item: T) => number);
    containerHeight: number;
    overscan?: number;
  }
) {
  const [scrollTop, setScrollTop] = useState(0);
  const { itemHeight, containerHeight, overscan = 5 } = options;

  const { startIndex, endIndex, visibleItems } = useMemo(() => {
    return calculateVisibleRange(
      scrollTop,
      containerHeight,
      items,
      itemHeight,
      overscan
    );
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  const totalSize = useMemo(() => {
    return getTotalSize(items, itemHeight);
  }, [items, itemHeight]);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'auto') => {
    let targetOffset = 0;

    if (typeof itemHeight === 'number') {
      targetOffset = index * itemHeight;
    } else {
      for (let i = 0; i < index && i < items.length; i++) {
        targetOffset += getItemSize(itemHeight, i, items[i]);
      }
    }

    setScrollTop(targetOffset);
  }, [itemHeight, items]);

  const scrollBy = useCallback((delta: number) => {
    setScrollTop(prev => Math.max(0, Math.min(prev + delta, totalSize - containerHeight)));
  }, [totalSize, containerHeight]);

  return {
    startIndex,
    endIndex,
    visibleItems,
    totalSize,
    scrollTop,
    setScrollTop,
    scrollToIndex,
    scrollBy
  };
}