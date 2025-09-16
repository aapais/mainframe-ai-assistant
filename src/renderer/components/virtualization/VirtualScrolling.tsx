import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { throttle, debounce } from 'lodash';

/**
 * Virtual Scrolling Implementation for Large Lists
 */

export interface VirtualItem {
  index: number;
  start: number;
  end: number;
  size: number;
}

export interface VirtualScrollOptions {
  itemHeight?: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number;
  scrollingDelay?: number;
  getScrollElement?: () => HTMLElement | null;
  horizontal?: boolean;
}

export interface UseVirtualScrollResult {
  virtualItems: VirtualItem[];
  totalSize: number;
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  scrollToOffset: (offset: number) => void;
  isScrolling: boolean;
}

/**
 * Advanced Virtual Scrolling Hook
 */
export function useVirtualScroll(
  itemCount: number,
  options: VirtualScrollOptions
): UseVirtualScrollResult {
  const {
    itemHeight = 50,
    containerHeight,
    overscan = 5,
    scrollingDelay = 150,
    getScrollElement,
    horizontal = false
  } = options;

  const [scrollOffset, setScrollOffset] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollElementRef = useRef<HTMLElement | null>(null);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoized item sizes
  const itemSizes = useMemo(() => {
    if (typeof itemHeight === 'function') {
      return Array.from({ length: itemCount }, (_, index) => itemHeight(index));
    }
    return Array.from({ length: itemCount }, () => itemHeight);
  }, [itemCount, itemHeight]);

  // Calculate total size
  const totalSize = useMemo(() => {
    return itemSizes.reduce((total, size) => total + size, 0);
  }, [itemSizes]);

  // Calculate visible range
  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    if (itemCount === 0) {
      return { startIndex: 0, endIndex: 0, virtualItems: [] };
    }

    let start = 0;
    let startIndex = 0;

    // Find start index
    for (let i = 0; i < itemCount; i++) {
      const itemSize = itemSizes[i];
      if (start + itemSize >= scrollOffset) {
        startIndex = i;
        break;
      }
      start += itemSize;
    }

    // Calculate end index
    let end = start;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < itemCount; i++) {
      const itemSize = itemSizes[i];
      if (end >= scrollOffset + containerHeight) {
        break;
      }
      end += itemSize;
      endIndex = i;
    }

    // Apply overscan
    const overscanStart = Math.max(0, startIndex - overscan);
    const overscanEnd = Math.min(itemCount - 1, endIndex + overscan);

    // Generate virtual items
    const virtualItems: VirtualItem[] = [];
    let offset = 0;

    for (let i = 0; i < overscanStart; i++) {
      offset += itemSizes[i];
    }

    for (let i = overscanStart; i <= overscanEnd; i++) {
      const size = itemSizes[i];
      virtualItems.push({
        index: i,
        start: offset,
        end: offset + size,
        size
      });
      offset += size;
    }

    return { startIndex: overscanStart, endIndex: overscanEnd, virtualItems };
  }, [scrollOffset, containerHeight, itemCount, itemSizes, overscan]);

  // Throttled scroll handler
  const handleScroll = useCallback(
    throttle((event: Event) => {
      const element = event.target as HTMLElement;
      const offset = horizontal ? element.scrollLeft : element.scrollTop;
      setScrollOffset(offset);
      
      setIsScrolling(true);
      
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
      
      scrollingTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, scrollingDelay);
    }, 16), // ~60fps
    [horizontal, scrollingDelay]
  );

  // Setup scroll listener
  useEffect(() => {
    const scrollElement = getScrollElement?.() || scrollElementRef.current;
    if (!scrollElement) return;

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, [handleScroll, getScrollElement]);

  // Scroll to index
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    const scrollElement = getScrollElement?.() || scrollElementRef.current;
    if (!scrollElement || index < 0 || index >= itemCount) return;

    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += itemSizes[i];
    }

    const itemSize = itemSizes[index];

    switch (align) {
      case 'center':
        offset -= (containerHeight - itemSize) / 2;
        break;
      case 'end':
        offset -= containerHeight - itemSize;
        break;
    }

    const property = horizontal ? 'scrollLeft' : 'scrollTop';
    scrollElement[property] = Math.max(0, offset);
  }, [getScrollElement, itemCount, itemSizes, containerHeight, horizontal]);

  // Scroll to offset
  const scrollToOffset = useCallback((offset: number) => {
    const scrollElement = getScrollElement?.() || scrollElementRef.current;
    if (!scrollElement) return;

    const property = horizontal ? 'scrollLeft' : 'scrollTop';
    scrollElement[property] = offset;
  }, [getScrollElement, horizontal]);

  return {
    virtualItems,
    totalSize,
    scrollToIndex,
    scrollToOffset,
    isScrolling
  };
}

/**
 * Virtual List Component
 */
export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  height: number;
  width?: number;
  renderItem: (props: {
    index: number;
    item: T;
    style: React.CSSProperties;
    isScrolling?: boolean;
  }) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (offset: number) => void;
  placeholder?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  horizontal?: boolean;
}

export function VirtualList<T>({
  items,
  itemHeight,
  height,
  width = '100%',
  renderItem,
  overscan = 5,
  className,
  onScroll,
  placeholder,
  loadingComponent,
  horizontal = false
}: VirtualListProps<T>) {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const itemHeightFn = useCallback((index: number) => {
    if (typeof itemHeight === 'function') {
      return itemHeight(index, items[index]);
    }
    return itemHeight;
  }, [itemHeight, items]);

  const { virtualItems, totalSize, scrollToIndex, isScrolling } = useVirtualScroll(
    items.length,
    {
      itemHeight: itemHeightFn,
      containerHeight: height,
      overscan,
      horizontal,
      getScrollElement: () => scrollElementRef.current
    }
  );

  const handleScroll = useCallback(
    debounce((event: React.UIEvent<HTMLDivElement>) => {
      const offset = horizontal 
        ? event.currentTarget.scrollLeft 
        : event.currentTarget.scrollTop;
      onScroll?.(offset);
    }, 100),
    [onScroll, horizontal]
  );

  if (items.length === 0) {
    return (
      <div 
        className={`virtual-list-placeholder ${className || ''}`}
        style={{ height, width }}
      >
        {placeholder || 'No items to display'}
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    height,
    width,
    overflow: 'auto',
    position: 'relative'
  };

  const innerStyle: React.CSSProperties = horizontal
    ? {
        width: totalSize,
        height: '100%',
        position: 'relative'
      }
    : {
        height: totalSize,
        width: '100%',
        position: 'relative'
      };

  return (
    <div
      ref={scrollElementRef}
      className={`virtual-list ${className || ''}`}
      style={containerStyle}
      onScroll={handleScroll}
    >
      <div style={innerStyle}>
        {isLoading && loadingComponent && (
          <div className="virtual-list-loading">
            {loadingComponent}
          </div>
        )}
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const style: React.CSSProperties = horizontal
            ? {
                position: 'absolute',
                left: virtualItem.start,
                top: 0,
                width: virtualItem.size,
                height: '100%'
              }
            : {
                position: 'absolute',
                top: virtualItem.start,
                left: 0,
                height: virtualItem.size,
                width: '100%'
              };

          return (
            <div key={virtualItem.index} style={style}>
              {renderItem({
                index: virtualItem.index,
                item,
                style: { width: '100%', height: '100%' },
                isScrolling
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Windowed Grid Component
 */
export interface VirtualGridProps<T> {
  items: T[];
  columnCount: number;
  rowHeight: number | ((rowIndex: number) => number);
  columnWidth: number | ((columnIndex: number) => number);
  height: number;
  width: number;
  renderItem: (props: {
    rowIndex: number;
    columnIndex: number;
    item: T;
    style: React.CSSProperties;
  }) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export function VirtualGrid<T>({
  items,
  columnCount,
  rowHeight,
  columnWidth,
  height,
  width,
  renderItem,
  overscan = 5,
  className
}: VirtualGridProps<T>) {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const rowCount = Math.ceil(items.length / columnCount);

  const getRowHeight = useCallback((index: number) => {
    return typeof rowHeight === 'function' ? rowHeight(index) : rowHeight;
  }, [rowHeight]);

  const getColumnWidth = useCallback((index: number) => {
    return typeof columnWidth === 'function' ? columnWidth(index) : columnWidth;
  }, [columnWidth]);

  // Calculate visible rows and columns
  const { visibleRowStart, visibleRowEnd, visibleColumnStart, visibleColumnEnd } = useMemo(() => {
    let rowStart = 0;
    let visibleRowStart = 0;
    
    for (let i = 0; i < rowCount; i++) {
      const height = getRowHeight(i);
      if (rowStart + height >= scrollTop) {
        visibleRowStart = i;
        break;
      }
      rowStart += height;
    }

    let rowEnd = rowStart;
    let visibleRowEnd = visibleRowStart;
    
    for (let i = visibleRowStart; i < rowCount; i++) {
      const height = getRowHeight(i);
      if (rowEnd >= scrollTop + height) {
        break;
      }
      rowEnd += height;
      visibleRowEnd = i;
    }

    let columnStart = 0;
    let visibleColumnStart = 0;
    
    for (let i = 0; i < columnCount; i++) {
      const width = getColumnWidth(i);
      if (columnStart + width >= scrollLeft) {
        visibleColumnStart = i;
        break;
      }
      columnStart += width;
    }

    let columnEnd = columnStart;
    let visibleColumnEnd = visibleColumnStart;
    
    for (let i = visibleColumnStart; i < columnCount; i++) {
      const width = getColumnWidth(i);
      if (columnEnd >= scrollLeft + width) {
        break;
      }
      columnEnd += width;
      visibleColumnEnd = i;
    }

    return {
      visibleRowStart: Math.max(0, visibleRowStart - overscan),
      visibleRowEnd: Math.min(rowCount - 1, visibleRowEnd + overscan),
      visibleColumnStart: Math.max(0, visibleColumnStart - overscan),
      visibleColumnEnd: Math.min(columnCount - 1, visibleColumnEnd + overscan)
    };
  }, [scrollTop, scrollLeft, rowCount, columnCount, getRowHeight, getColumnWidth, overscan]);

  const handleScroll = useCallback(
    throttle((event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
      setScrollLeft(event.currentTarget.scrollLeft);
    }, 16),
    []
  );

  const totalHeight = useMemo(() => {
    let total = 0;
    for (let i = 0; i < rowCount; i++) {
      total += getRowHeight(i);
    }
    return total;
  }, [rowCount, getRowHeight]);

  const totalWidth = useMemo(() => {
    let total = 0;
    for (let i = 0; i < columnCount; i++) {
      total += getColumnWidth(i);
    }
    return total;
  }, [columnCount, getColumnWidth]);

  const cells = [];
  let rowOffset = 0;
  
  for (let i = 0; i < visibleRowStart; i++) {
    rowOffset += getRowHeight(i);
  }

  for (let rowIndex = visibleRowStart; rowIndex <= visibleRowEnd; rowIndex++) {
    let columnOffset = 0;
    
    for (let i = 0; i < visibleColumnStart; i++) {
      columnOffset += getColumnWidth(i);
    }

    for (let columnIndex = visibleColumnStart; columnIndex <= visibleColumnEnd; columnIndex++) {
      const itemIndex = rowIndex * columnCount + columnIndex;
      
      if (itemIndex < items.length) {
        const item = items[itemIndex];
        const style: React.CSSProperties = {
          position: 'absolute',
          top: rowOffset,
          left: columnOffset,
          width: getColumnWidth(columnIndex),
          height: getRowHeight(rowIndex)
        };

        cells.push(
          <div key={`${rowIndex}-${columnIndex}`} style={style}>
            {renderItem({
              rowIndex,
              columnIndex,
              item,
              style: { width: '100%', height: '100%' }
            })}
          </div>
        );
      }
      
      columnOffset += getColumnWidth(columnIndex);
    }
    
    rowOffset += getRowHeight(rowIndex);
  }

  return (
    <div
      ref={scrollElementRef}
      className={`virtual-grid ${className || ''}`}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          width: totalWidth,
          position: 'relative'
        }}
      >
        {cells}
      </div>
    </div>
  );
}

/**
 * Performance optimization utilities
 */
export const PerformanceOptimizations = {
  // Memoization helper
  createMemoizedComponent: <P extends object>(Component: React.ComponentType<P>) => {
    return React.memo(Component, (prevProps, nextProps) => {
      // Custom comparison logic can be added here
      return JSON.stringify(prevProps) === JSON.stringify(nextProps);
    });
  },

  // Lazy loading wrapper
  createLazyComponent: <P extends object>(importFn: () => Promise<{ default: React.ComponentType<P> }>) => {
    return React.lazy(importFn);
  },

  // Intersection observer for lazy loading
  useLazyLoading: (threshold = 0.1) => {
    const [isVisible, setIsVisible] = useState(false);
    const [hasBeenVisible, setHasBeenVisible] = useState(false);
    const elementRef = useRef<HTMLElement>(null);

    useEffect(() => {
      const element = elementRef.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsVisible(entry.isIntersecting);
          if (entry.isIntersecting && !hasBeenVisible) {
            setHasBeenVisible(true);
          }
        },
        { threshold }
      );

      observer.observe(element);
      return () => observer.disconnect();
    }, [threshold, hasBeenVisible]);

    return { isVisible, hasBeenVisible, elementRef };
  }
};
