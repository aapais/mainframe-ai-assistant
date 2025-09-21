/**
 * Virtual Scrolling Utilities for Search Performance Optimization
 *
 * This module provides high-performance virtual scrolling utilities optimized for:
 * - Large result sets (1000+ items)
 * - 60fps smooth scrolling
 * - Dynamic item heights
 * - Memory efficiency
 * - Keyboard navigation support
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { FixedSizeList, VariableSizeList, ListChildComponentProps } from 'react-window';

// ===========================================
// Types and Interfaces
// ===========================================

export interface VirtualScrollConfig {
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number;
  threshold?: number;
  scrollBehavior?: 'auto' | 'smooth';
}

export interface VirtualScrollState {
  scrollTop: number;
  isScrolling: boolean;
  visibleRange: { start: number; end: number };
}

export interface SearchResultItem {
  id: string;
  height?: number;
  expanded?: boolean;
  data: any;
}

// ===========================================
// Performance Constants
// ===========================================

const VIRTUAL_SCROLL_DEFAULTS = {
  OVERSCAN_COUNT: 5,
  THRESHOLD: 100, // Trigger virtual scrolling for 100+ items
  BASE_ITEM_HEIGHT: 120,
  EXPANDED_ITEM_HEIGHT: 300,
  SCROLL_DEBOUNCE: 16, // 60fps
  PERFORMANCE_BUDGET: 16.67, // 60fps frame budget in ms
} as const;

// ===========================================
// Dynamic Height Calculator
// ===========================================

export class DynamicHeightCalculator {
  private heightCache = new Map<number, number>();
  private defaultHeight: number;
  private measureElement?: HTMLElement;

  constructor(defaultHeight: number = VIRTUAL_SCROLL_DEFAULTS.BASE_ITEM_HEIGHT) {
    this.defaultHeight = defaultHeight;
    this.createMeasureElement();
  }

  private createMeasureElement() {
    this.measureElement = document.createElement('div');
    this.measureElement.style.position = 'absolute';
    this.measureElement.style.left = '-9999px';
    this.measureElement.style.top = '-9999px';
    this.measureElement.style.visibility = 'hidden';
    this.measureElement.style.width = '100%';
    document.body.appendChild(this.measureElement);
  }

  getItemHeight = (index: number, item?: SearchResultItem): number => {
    // Check cache first
    if (this.heightCache.has(index)) {
      return this.heightCache.get(index)!;
    }

    // Calculate height based on content
    let height = this.defaultHeight;

    if (item) {
      // Base height
      height = VIRTUAL_SCROLL_DEFAULTS.BASE_ITEM_HEIGHT;

      // Add height for expanded state
      if (item.expanded) {
        height += VIRTUAL_SCROLL_DEFAULTS.EXPANDED_ITEM_HEIGHT;
      }

      // Add height for tags (estimate)
      const tagCount = item.data?.tags?.length || 0;
      if (tagCount > 5) {
        height += Math.ceil((tagCount - 5) / 3) * 24; // 3 tags per row, 24px per row
      }

      // Add height for long content
      const problemLength = item.data?.problem?.length || 0;
      if (problemLength > 200) {
        height += Math.min(100, Math.floor((problemLength - 200) / 100) * 20);
      }

      // Cache the calculated height
      this.heightCache.set(index, height);
    }

    return height;
  };

  updateItemHeight = (index: number, height: number): void => {
    this.heightCache.set(index, height);
  };

  clearCache = (): void => {
    this.heightCache.clear();
  };

  destroy = (): void => {
    if (this.measureElement && this.measureElement.parentNode) {
      this.measureElement.parentNode.removeChild(this.measureElement);
    }
    this.clearCache();
  };
}

// ===========================================
// Virtual Scroll Hook
// ===========================================

export interface UseVirtualScrollProps<T> {
  items: T[];
  containerHeight: number;
  getItemHeight?: (index: number, item: T) => number;
  overscan?: number;
  threshold?: number;
}

export function useVirtualScroll<T extends SearchResultItem>({
  items,
  containerHeight,
  getItemHeight,
  overscan = VIRTUAL_SCROLL_DEFAULTS.OVERSCAN_COUNT,
  threshold = VIRTUAL_SCROLL_DEFAULTS.THRESHOLD,
}: UseVirtualScrollProps<T>) {
  const [scrollState, setScrollState] = useState<VirtualScrollState>({
    scrollTop: 0,
    isScrolling: false,
    visibleRange: { start: 0, end: 0 },
  });

  const heightCalculator = useRef(new DynamicHeightCalculator());
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Determine if we should use virtual scrolling
  const shouldVirtualize = useMemo(() => items.length >= threshold, [items.length, threshold]);

  // Calculate item height function
  const calculateItemHeight = useCallback((index: number): number => {
    const item = items[index];
    if (getItemHeight) {
      return getItemHeight(index, item);
    }
    return heightCalculator.current.getItemHeight(index, item);
  }, [items, getItemHeight]);

  // Calculate visible range for virtual scrolling
  const visibleRange = useMemo(() => {
    if (!shouldVirtualize || containerHeight === 0) {
      return { start: 0, end: Math.min(items.length - 1, 50) }; // Show first 50 items
    }

    const { scrollTop } = scrollState;
    let startIndex = 0;
    let endIndex = 0;
    let currentOffset = 0;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const itemHeight = calculateItemHeight(i);
      if (currentOffset + itemHeight > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      currentOffset += itemHeight;
    }

    // Find end index
    let visibleHeight = 0;
    for (let i = startIndex; i < items.length; i++) {
      const itemHeight = calculateItemHeight(i);
      visibleHeight += itemHeight;
      if (visibleHeight >= containerHeight + (overscan * VIRTUAL_SCROLL_DEFAULTS.BASE_ITEM_HEIGHT)) {
        endIndex = Math.min(items.length - 1, i + overscan);
        break;
      }
    }

    return { start: startIndex, end: endIndex };
  }, [shouldVirtualize, containerHeight, scrollState.scrollTop, items.length, calculateItemHeight, overscan]);

  // Handle scroll events with debouncing
  const handleScroll = useCallback((scrollTop: number) => {
    setScrollState(prev => ({
      ...prev,
      scrollTop,
      isScrolling: true,
      visibleRange,
    }));

    // Debounce scroll end detection
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setScrollState(prev => ({
        ...prev,
        isScrolling: false,
      }));
    }, 150);
  }, [visibleRange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      heightCalculator.current.destroy();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    shouldVirtualize,
    visibleRange,
    scrollState,
    handleScroll,
    calculateItemHeight,
    updateItemHeight: heightCalculator.current.updateItemHeight,
    clearHeightCache: heightCalculator.current.clearCache,
  };
}

// ===========================================
// Optimized List Components
// ===========================================

export interface OptimizedVirtualListProps<T> {
  items: T[];
  height: number;
  width?: number | string;
  itemRenderer: (props: ListChildComponentProps) => React.ReactElement;
  getItemHeight?: (index: number, item: T) => number;
  onScroll?: (scrollTop: number) => void;
  className?: string;
  overscan?: number;
}

export function OptimizedVirtualList<T extends SearchResultItem>({
  items,
  height,
  width = '100%',
  itemRenderer,
  getItemHeight,
  onScroll,
  className = '',
  overscan = VIRTUAL_SCROLL_DEFAULTS.OVERSCAN_COUNT,
}: OptimizedVirtualListProps<T>) {
  const listRef = useRef<VariableSizeList>(null);
  const heightCalculator = useRef(new DynamicHeightCalculator());

  const itemHeight = useCallback((index: number): number => {
    const item = items[index];
    if (getItemHeight) {
      return getItemHeight(index, item);
    }
    return heightCalculator.current.getItemHeight(index, item);
  }, [items, getItemHeight]);

  const handleScroll = useCallback(({ scrollTop }: { scrollTop: number }) => {
    onScroll?.(scrollTop);
  }, [onScroll]);

  // Reset cache when items change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0, true);
    }
  }, [items]);

  return React.createElement(VariableSizeList, {
    ref: listRef,
    className: `optimized-virtual-list ${className}`,
    height: height,
    width: width,
    itemCount: items.length,
    itemSize: itemHeight,
    onScroll: handleScroll,
    overscanCount: overscan,
    itemData: items
  }, itemRenderer);
}

// ===========================================
// Performance Monitoring
// ===========================================

export class VirtualScrollPerformanceMonitor {
  private frameTimings: number[] = [];
  private maxFrameTimings = 100;
  private performanceObserver?: PerformanceObserver;

  constructor() {
    this.initPerformanceObserver();
  }

  private initPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.startsWith('virtual-scroll')) {
            this.recordFrameTiming(entry.duration);
          }
        }
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }

  recordFrameTiming(duration: number) {
    this.frameTimings.push(duration);
    if (this.frameTimings.length > this.maxFrameTimings) {
      this.frameTimings.shift();
    }
  }

  getAverageFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;
    return this.frameTimings.reduce((sum, time) => sum + time, 0) / this.frameTimings.length;
  }

  getFrameDropCount(): number {
    return this.frameTimings.filter(time => time > VIRTUAL_SCROLL_DEFAULTS.PERFORMANCE_BUDGET).length;
  }

  getPerformanceMetrics() {
    return {
      averageFrameTime: this.getAverageFrameTime(),
      frameDropCount: this.getFrameDropCount(),
      totalFrames: this.frameTimings.length,
      performanceScore: Math.max(0, 100 - (this.getFrameDropCount() / this.frameTimings.length) * 100),
    };
  }

  reset() {
    this.frameTimings = [];
  }

  destroy() {
    this.performanceObserver?.disconnect();
    this.reset();
  }
}

// ===========================================
// Utility Functions
// ===========================================

export function measureScrollPerformance<T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T {
  return ((...args: any[]) => {
    performance.mark(`virtual-scroll-${name}-start`);
    const result = fn(...args);
    performance.mark(`virtual-scroll-${name}-end`);
    performance.measure(
      `virtual-scroll-${name}`,
      `virtual-scroll-${name}-start`,
      `virtual-scroll-${name}-end`
    );
    return result;
  }) as T;
}

export function debounceScroll(
  callback: (scrollTop: number) => void,
  delay: number = VIRTUAL_SCROLL_DEFAULTS.SCROLL_DEBOUNCE
) {
  let timeoutId: NodeJS.Timeout;
  let lastScrollTop = 0;

  return (scrollTop: number) => {
    lastScrollTop = scrollTop;
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      callback(lastScrollTop);
    }, delay);
  };
}

export function throttleScroll(
  callback: (scrollTop: number) => void,
  delay: number = VIRTUAL_SCROLL_DEFAULTS.SCROLL_DEBOUNCE
) {
  let lastCall = 0;

  return (scrollTop: number) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      callback(scrollTop);
    }
  };
}

// ===========================================
// Export Performance Monitor Instance
// ===========================================

export const virtualScrollMonitor = new VirtualScrollPerformanceMonitor();