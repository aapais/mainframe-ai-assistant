import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  width?: string | number;
  height: string | number;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
  className?: string;
  style?: React.CSSProperties;
  children: (props: {
    item: T;
    index: number;
    style: React.CSSProperties;
  }) => React.ReactNode;
}

interface VirtualItemInfo {
  index: number;
  offset: number;
  size: number;
}

/**
 * High-performance virtual scrolling component
 * Supports both fixed and variable item heights
 * Optimized for large lists with thousands of items
 */
export function VirtualList<T>({
  items,
  itemHeight,
  width = '100%',
  height,
  overscan = 5,
  onScroll,
  className = '',
  style = {},
  children,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate item positions for variable height items
  const itemMetadata = useMemo(() => {
    const metadata: VirtualItemInfo[] = [];
    let offset = 0;

    for (let i = 0; i < items.length; i++) {
      const size = typeof itemHeight === 'function'
        ? itemHeight(i, items[i])
        : itemHeight;

      metadata[i] = {
        index: i,
        offset,
        size,
      };

      offset += size;
    }

    return metadata;
  }, [items, itemHeight]);

  const totalHeight = useMemo(() => {
    return itemMetadata.length > 0
      ? itemMetadata[itemMetadata.length - 1].offset + itemMetadata[itemMetadata.length - 1].size
      : 0;
  }, [itemMetadata]);

  // Update container height when component mounts/resizes
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(containerRef.current);

      return () => resizeObserver.disconnect();
    }
  }, []);

  // Binary search to find start index for variable height items
  const findStartIndex = useCallback((scrollTop: number) => {
    let low = 0;
    let high = itemMetadata.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const currentOffset = itemMetadata[mid].offset;

      if (currentOffset === scrollTop) {
        return mid;
      } else if (currentOffset < scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return Math.max(0, high);
  }, [itemMetadata]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (itemMetadata.length === 0 || containerHeight === 0) {
      return { start: 0, end: 0, items: [] };
    }

    const startIndex = Math.max(0, findStartIndex(scrollTop) - overscan);

    let endIndex = startIndex;
    let accumulatedHeight = 0;

    // Find end index by accumulating heights until we exceed visible area + overscan
    while (endIndex < itemMetadata.length && accumulatedHeight < containerHeight + (overscan * 50)) {
      accumulatedHeight += itemMetadata[endIndex].size;
      endIndex++;
    }

    endIndex = Math.min(itemMetadata.length - 1, endIndex + overscan);

    const visibleItems: Array<{
      item: T;
      index: number;
      offset: number;
      size: number;
    }> = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const metadata = itemMetadata[i];
      if (metadata) {
        visibleItems.push({
          item: items[i],
          index: i,
          offset: metadata.offset,
          size: metadata.size,
        });
      }
    }

    return {
      start: startIndex,
      end: endIndex,
      items: visibleItems,
    };
  }, [scrollTop, containerHeight, itemMetadata, items, overscan, findStartIndex]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrollTop(scrollTop);
    onScroll?.(scrollTop);
  }, [onScroll]);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    if (!scrollElementRef.current || !itemMetadata[index]) return;

    const metadata = itemMetadata[index];
    let targetScrollTop = metadata.offset;

    if (align === 'center') {
      targetScrollTop = metadata.offset - (containerHeight - metadata.size) / 2;
    } else if (align === 'end') {
      targetScrollTop = metadata.offset - containerHeight + metadata.size;
    }

    targetScrollTop = Math.max(0, Math.min(totalHeight - containerHeight, targetScrollTop));

    scrollElementRef.current.scrollTop = targetScrollTop;
  }, [itemMetadata, containerHeight, totalHeight]);

  // Scroll to specific item
  const scrollToItem = useCallback((item: T, align: 'start' | 'center' | 'end' = 'start') => {
    const index = items.indexOf(item);
    if (index >= 0) {
      scrollToIndex(index, align);
    }
  }, [items, scrollToIndex]);

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <div
        ref={scrollElementRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch', // Enable momentum scrolling on iOS
        }}
        onScroll={handleScroll}
      >
        <div
          style={{
            height: totalHeight,
            width: '100%',
            position: 'relative',
          }}
        >
          {visibleRange.items.map(({ item, index, offset, size }) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: offset,
                left: 0,
                right: 0,
                height: size,
                width: '100%',
              }}
            >
              {children({
                item,
                index,
                style: {
                  height: size,
                  width: '100%',
                },
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Fixed height virtual list (optimized version)
 */
export interface FixedSizeListProps<T> {
  items: T[];
  itemHeight: number;
  width?: string | number;
  height: string | number;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
  className?: string;
  style?: React.CSSProperties;
  children: (props: {
    item: T;
    index: number;
    style: React.CSSProperties;
  }) => React.ReactNode;
}

export function FixedSizeList<T>({
  items,
  itemHeight,
  width = '100%',
  height,
  overscan = 5,
  onScroll,
  className = '',
  style = {},
  children,
}: FixedSizeListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Update container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(containerRef.current);

      return () => resizeObserver.disconnect();
    }
  }, []);

  // Calculate visible range (simpler for fixed height)
  const visibleRange = useMemo(() => {
    if (containerHeight === 0) {
      return { start: 0, end: 0 };
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { start: startIndex, end: endIndex };
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrollTop(scrollTop);
    onScroll?.(scrollTop);
  }, [onScroll]);

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollElementRef.current) return;

    const targetScrollTop = index * itemHeight;
    scrollElementRef.current.scrollTop = targetScrollTop;
  }, [itemHeight]);

  const totalHeight = items.length * itemHeight;
  const visibleItems = items.slice(visibleRange.start, visibleRange.end + 1);

  return (
    <div
      ref={containerRef}
      className={`fixed-size-list ${className}`}
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <div
        ref={scrollElementRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={handleScroll}
      >
        <div
          style={{
            height: totalHeight,
            width: '100%',
            position: 'relative',
          }}
        >
          {visibleItems.map((item, i) => {
            const index = visibleRange.start + i;
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  top: index * itemHeight,
                  left: 0,
                  right: 0,
                  height: itemHeight,
                  width: '100%',
                }}
              >
                {children({
                  item,
                  index,
                  style: {
                    height: itemHeight,
                    width: '100%',
                  },
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Utility hook for virtual scrolling
export function useVirtualScrolling<T>(items: T[], itemHeight: number | ((index: number) => number)) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const getVisibleRange = useCallback((overscan = 5) => {
    if (typeof itemHeight === 'number') {
      // Fixed height calculation
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
      );
      return { start: startIndex, end: endIndex };
    } else {
      // Variable height - simplified calculation
      let currentOffset = 0;
      let startIndex = 0;

      // Find start index
      for (let i = 0; i < items.length; i++) {
        const height = itemHeight(i);
        if (currentOffset + height > scrollTop) {
          startIndex = Math.max(0, i - overscan);
          break;
        }
        currentOffset += height;
      }

      // Find end index
      let endIndex = startIndex;
      let visibleHeight = 0;

      while (endIndex < items.length && visibleHeight < containerHeight + overscan * 50) {
        visibleHeight += itemHeight(endIndex);
        endIndex++;
      }

      endIndex = Math.min(items.length - 1, endIndex + overscan);

      return { start: startIndex, end: endIndex };
    }
  }, [scrollTop, containerHeight, itemHeight, items.length]);

  return {
    scrollTop,
    setScrollTop,
    containerHeight,
    setContainerHeight,
    getVisibleRange,
  };
}

export default VirtualList;