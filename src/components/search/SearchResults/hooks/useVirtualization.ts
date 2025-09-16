/**
 * useVirtualization Hook
 *
 * Custom hook for managing virtual scrolling in large result sets
 * @version 2.0.0
 */

import { useState, useCallback, useMemo, useEffect, CSSProperties } from 'react';
import { UseVirtualizationReturn, VirtualizationSettings } from '../types';
import {
  calculateVisibleRange,
  calculateTotalHeight,
  calculateItemOffset,
  throttle,
  clamp
} from '../utils';

interface UseVirtualizationOptions {
  /** Total number of items */
  itemCount: number;
  /** Height of each item */
  itemHeight: number;
  /** Container height */
  containerHeight: number;
  /** Number of items to render outside visible area */
  bufferSize?: number;
  /** Whether virtualization is enabled */
  enabled?: boolean;
  /** Scroll throttle delay in milliseconds */
  scrollThrottleMs?: number;
  /** Minimum number of items to enable virtualization */
  threshold?: number;
}

/**
 * Hook for managing virtual scrolling with performance optimizations
 */
export const useVirtualization = (
  options: UseVirtualizationOptions
): UseVirtualizationReturn => {
  const {
    itemCount,
    itemHeight,
    containerHeight,
    bufferSize = 5,
    enabled = true,
    scrollThrottleMs = 16,
    threshold = 20
  } = options;

  const [scrollTop, setScrollTop] = useState(0);

  // Determine if virtualization should be active
  const isVirtualizationActive = useMemo(() => {
    return enabled && itemCount >= threshold;
  }, [enabled, itemCount, threshold]);

  // Calculate virtualization settings
  const settings = useMemo((): VirtualizationSettings => ({
    enabled: isVirtualizationActive,
    threshold,
    itemHeight,
    containerHeight,
    bufferSize
  }), [isVirtualizationActive, threshold, itemHeight, containerHeight, bufferSize]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    if (!isVirtualizationActive) {
      return { start: 0, end: itemCount };
    }

    return calculateVisibleRange(
      scrollTop,
      containerHeight,
      itemHeight,
      itemCount,
      bufferSize
    );
  }, [isVirtualizationActive, scrollTop, containerHeight, itemHeight, itemCount, bufferSize]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    return calculateTotalHeight(itemCount, itemHeight);
  }, [itemCount, itemHeight]);

  // Throttled scroll handler
  const throttledScrollHandler = useMemo(() => {
    return throttle((event: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = event.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
    }, scrollThrottleMs);
  }, [scrollThrottleMs]);

  // Container scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!isVirtualizationActive) return;
    throttledScrollHandler(event);
  }, [isVirtualizationActive, throttledScrollHandler]);

  // Container props
  const containerProps = useMemo(() => ({
    style: {
      height: containerHeight,
      overflow: 'auto' as const,
      position: 'relative' as const
    } as CSSProperties,
    onScroll: handleScroll,
    className: 'virtual-scroll-container'
  }), [containerHeight, handleScroll]);

  // Function to get item props
  const getItemProps = useCallback((index: number) => {
    const offset = calculateItemOffset(index, itemHeight);
    const style: CSSProperties = isVirtualizationActive ? {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: itemHeight,
      transform: `translateY(${offset}px)`
    } : {
      height: itemHeight
    };

    return {
      style,
      key: index
    };
  }, [itemHeight, isVirtualizationActive]);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number, alignment: 'start' | 'center' | 'end' = 'start') => {
    const clampedIndex = clamp(index, 0, itemCount - 1);
    let targetScrollTop: number;

    switch (alignment) {
      case 'center':
        targetScrollTop = (clampedIndex * itemHeight) - (containerHeight / 2) + (itemHeight / 2);
        break;
      case 'end':
        targetScrollTop = (clampedIndex * itemHeight) - containerHeight + itemHeight;
        break;
      case 'start':
      default:
        targetScrollTop = clampedIndex * itemHeight;
        break;
    }

    // Clamp scroll position
    const maxScrollTop = Math.max(0, totalHeight - containerHeight);
    const finalScrollTop = clamp(targetScrollTop, 0, maxScrollTop);

    setScrollTop(finalScrollTop);

    // If we have a container element, actually scroll it
    // This would be handled by the component using this hook
    return finalScrollTop;
  }, [itemCount, itemHeight, containerHeight, totalHeight]);

  // Reset scroll position when itemCount changes significantly
  useEffect(() => {
    if (scrollTop > totalHeight - containerHeight) {
      setScrollTop(Math.max(0, totalHeight - containerHeight));
    }
  }, [totalHeight, containerHeight, scrollTop]);

  return {
    settings,
    visibleRange,
    containerProps,
    getItemProps,
    totalHeight,
    scrollTop,
    scrollToIndex
  };
};

// Additional virtualization utilities

/**
 * Hook for managing virtual scrolling with dynamic item heights
 */
export const useDynamicVirtualization = (options: {
  itemCount: number;
  estimatedItemHeight: number;
  containerHeight: number;
  getItemHeight: (index: number) => number;
  bufferSize?: number;
}) => {
  const { itemCount, estimatedItemHeight, containerHeight, getItemHeight, bufferSize = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());

  // Calculate cumulative heights
  const cumulativeHeights = useMemo(() => {
    const heights = [0];
    for (let i = 0; i < itemCount; i++) {
      const height = itemHeights.get(i) || estimatedItemHeight;
      heights.push(heights[i] + height);
    }
    return heights;
  }, [itemCount, itemHeights, estimatedItemHeight]);

  // Find visible range for dynamic heights
  const visibleRange = useMemo(() => {
    let start = 0;
    let end = itemCount;

    // Binary search for start index
    let left = 0;
    let right = itemCount;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (cumulativeHeights[mid] < scrollTop) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    start = Math.max(0, left - bufferSize);

    // Find end index
    const viewportBottom = scrollTop + containerHeight;
    left = start;
    right = itemCount;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (cumulativeHeights[mid] < viewportBottom) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    end = Math.min(itemCount, left + bufferSize);

    return { start, end };
  }, [scrollTop, containerHeight, cumulativeHeights, itemCount, bufferSize]);

  // Update item height
  const updateItemHeight = useCallback((index: number, height: number) => {
    setItemHeights(prev => {
      const next = new Map(prev);
      next.set(index, height);
      return next;
    });
  }, []);

  const totalHeight = cumulativeHeights[itemCount] || 0;

  return {
    visibleRange,
    totalHeight,
    scrollTop,
    setScrollTop,
    updateItemHeight,
    getItemOffset: (index: number) => cumulativeHeights[index] || 0
  };
};

export { UseVirtualizationReturn, VirtualizationSettings };