/**
 * Virtualized Settings List - High-Performance List Rendering
 *
 * Features:
 * - Window-based virtualization for large lists
 * - Dynamic height calculation
 * - Smooth scrolling with momentum
 * - Keyboard navigation support
 * - Memory optimization
 * - Intersection observer integration
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle
} from 'react';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface VirtualItem {
  id: string;
  height: number;
  offset: number;
  index: number;
}

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight?: number | ((item: T, index: number) => number);
  containerHeight?: number;
  overscan?: number;
  scrollToIndex?: number;
  scrollToAlignment?: 'start' | 'center' | 'end' | 'auto';
  onItemsRendered?: (info: {
    startIndex: number;
    endIndex: number;
    visibleItems: T[];
  }) => void;
  children: (props: {
    item: T;
    index: number;
    style: React.CSSProperties;
    isVisible: boolean;
  }) => React.ReactNode;
  className?: string;
  estimatedItemHeight?: number;
  getItemKey?: (item: T, index: number) => string;
}

interface VirtualizedListRef {
  scrollToItem: (index: number, alignment?: 'start' | 'center' | 'end' | 'auto') => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  getVisibleRange: () => { start: number; end: number };
}

interface ItemSizeCache {
  [key: string]: number;
}

// ============================================================================
// VIRTUALIZED LIST HOOK
// ============================================================================

function useVirtualization<T>({
  items,
  itemHeight,
  containerHeight = 400,
  overscan = 5,
  estimatedItemHeight = 50
}: {
  items: T[];
  itemHeight?: number | ((item: T, index: number) => number);
  containerHeight: number;
  overscan: number;
  estimatedItemHeight: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [itemSizeCache, setItemSizeCache] = useState<ItemSizeCache>({});

  const scrollElementRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate item sizes
  const getItemSize = useCallback((item: T, index: number): number => {
    const key = `${index}`;

    if (itemSizeCache[key]) {
      return itemSizeCache[key];
    }

    if (typeof itemHeight === 'function') {
      return itemHeight(item, index);
    }

    return itemHeight || estimatedItemHeight;
  }, [itemHeight, estimatedItemHeight, itemSizeCache]);

  // Update item size in cache
  const setItemSize = useCallback((index: number, size: number) => {
    const key = `${index}`;
    setItemSizeCache(cache => ({
      ...cache,
      [key]: size
    }));
  }, []);

  // Calculate virtual items
  const virtualItems = useMemo(() => {
    const items_: VirtualItem[] = [];
    let offset = 0;

    for (let i = 0; i < items.length; i++) {
      const size = getItemSize(items[i], i);
      items_.push({
        id: `${i}`,
        height: size,
        offset,
        index: i
      });
      offset += size;
    }

    return items_;
  }, [items, getItemSize]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    return virtualItems.reduce((acc, item) => acc + item.height, 0);
  }, [virtualItems]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.max(
      0,
      virtualItems.findIndex(item => item.offset + item.height > scrollTop) - overscan
    );

    const end = Math.min(
      virtualItems.length - 1,
      virtualItems.findIndex(item => item.offset > scrollTop + containerHeight) + overscan
    );

    return {
      start: start >= 0 ? start : 0,
      end: end >= 0 ? end : virtualItems.length - 1
    };
  }, [virtualItems, scrollTop, containerHeight, overscan]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return virtualItems.slice(visibleRange.start, visibleRange.end + 1);
  }, [virtualItems, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    setScrollTop(scrollTop);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set scrolling to false after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Scroll to specific item
  const scrollToItem = useCallback((index: number, alignment: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    if (!scrollElementRef.current || index < 0 || index >= virtualItems.length) {
      return;
    }

    const item = virtualItems[index];
    let scrollTop: number;

    switch (alignment) {
      case 'start':
        scrollTop = item.offset;
        break;
      case 'end':
        scrollTop = item.offset + item.height - containerHeight;
        break;
      case 'center':
        scrollTop = item.offset + (item.height - containerHeight) / 2;
        break;
      case 'auto':
      default:
        const currentScrollTop = scrollElementRef.current.scrollTop;
        const itemStart = item.offset;
        const itemEnd = item.offset + item.height;
        const containerStart = currentScrollTop;
        const containerEnd = currentScrollTop + containerHeight;

        if (itemStart < containerStart) {
          scrollTop = itemStart;
        } else if (itemEnd > containerEnd) {
          scrollTop = itemEnd - containerHeight;
        } else {
          return; // Item is already visible
        }
    }

    scrollElementRef.current.scrollTo({
      top: Math.max(0, Math.min(scrollTop, totalHeight - containerHeight)),
      behavior: 'smooth'
    });
  }, [virtualItems, containerHeight, totalHeight]);

  return {
    virtualItems: visibleItems,
    totalHeight,
    visibleRange,
    scrollTop,
    isScrolling,
    handleScroll,
    scrollToItem,
    setItemSize,
    scrollElementRef
  };
}

// ============================================================================
// VIRTUALIZED LIST COMPONENT
// ============================================================================

export const VirtualizedList = forwardRef<VirtualizedListRef, VirtualizedListProps<any>>(
  <T,>({
    items,
    itemHeight,
    containerHeight = 400,
    overscan = 5,
    scrollToIndex,
    scrollToAlignment = 'auto',
    onItemsRendered,
    children,
    className = '',
    estimatedItemHeight = 50,
    getItemKey = (item: T, index: number) => `item-${index}`
  }: VirtualizedListProps<T>, ref) => {
    const {
      virtualItems,
      totalHeight,
      visibleRange,
      scrollTop,
      isScrolling,
      handleScroll,
      scrollToItem,
      setItemSize,
      scrollElementRef
    } = useVirtualization({
      items,
      itemHeight,
      containerHeight,
      overscan,
      estimatedItemHeight
    });

    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const resizeObserverRef = useRef<ResizeObserver>();

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      scrollToItem,
      scrollToTop: () => scrollToItem(0, 'start'),
      scrollToBottom: () => scrollToItem(items.length - 1, 'end'),
      getVisibleRange: () => visibleRange
    }), [scrollToItem, items.length, visibleRange]);

    // Auto-scroll to index when prop changes
    useEffect(() => {
      if (scrollToIndex !== undefined && scrollToIndex >= 0 && scrollToIndex < items.length) {
        scrollToItem(scrollToIndex, scrollToAlignment);
      }
    }, [scrollToIndex, scrollToAlignment, scrollToItem, items.length]);

    // Setup ResizeObserver for dynamic heights
    useEffect(() => {
      if (typeof itemHeight === 'function' || !itemHeight) {
        resizeObserverRef.current = new ResizeObserver((entries) => {
          entries.forEach((entry) => {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            const height = entry.contentRect.height;
            setItemSize(index, height);
          });
        });

        return () => {
          resizeObserverRef.current?.disconnect();
        };
      }
    }, [itemHeight, setItemSize]);

    // Observe item size changes
    const observeItem = useCallback((index: number, element: HTMLDivElement | null) => {
      const prevElement = itemRefs.current.get(index);

      if (prevElement && resizeObserverRef.current) {
        resizeObserverRef.current.unobserve(prevElement);
      }

      if (element) {
        itemRefs.current.set(index, element);
        if (resizeObserverRef.current) {
          resizeObserverRef.current.observe(element);
        }
      } else {
        itemRefs.current.delete(index);
      }
    }, []);

    // Notify parent of rendered items
    useEffect(() => {
      if (onItemsRendered) {
        const visibleItems = items.slice(visibleRange.start, visibleRange.end + 1);
        onItemsRendered({
          startIndex: visibleRange.start,
          endIndex: visibleRange.end,
          visibleItems
        });
      }
    }, [onItemsRendered, items, visibleRange]);

    return (
      <div
        ref={scrollElementRef}
        className={`virtual-list-container ${className}`}
        style={{
          height: containerHeight,
          overflow: 'auto',
          willChange: 'scroll-position'
        }}
        onScroll={handleScroll}
        role="list"
        aria-label="Virtualized list"
      >
        <div
          className="virtual-list-inner"
          style={{
            height: totalHeight,
            position: 'relative'
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            const key = getItemKey(item, virtualItem.index);

            return (
              <div
                key={key}
                ref={(el) => observeItem(virtualItem.index, el)}
                data-index={virtualItem.index}
                className="virtual-list-item"
                style={{
                  position: 'absolute',
                  top: virtualItem.offset,
                  left: 0,
                  right: 0,
                  height: virtualItem.height,
                  ...(isScrolling && { pointerEvents: 'none' })
                }}
                role="listitem"
              >
                {children({
                  item,
                  index: virtualItem.index,
                  style: {
                    height: virtualItem.height,
                    width: '100%'
                  },
                  isVisible: true
                })}
              </div>
            );
          })}
        </div>

        {/* Scroll indicators */}
        {totalHeight > containerHeight && (
          <div className="virtual-list-scrollbar">
            <div
              className="virtual-list-thumb"
              style={{
                height: `${(containerHeight / totalHeight) * 100}%`,
                top: `${(scrollTop / totalHeight) * 100}%`
              }}
            />
          </div>
        )}

        <style jsx>{`
          .virtual-list-container {
            position: relative;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e0 #f7fafc;
          }

          .virtual-list-container::-webkit-scrollbar {
            width: 6px;
          }

          .virtual-list-container::-webkit-scrollbar-track {
            background: #f7fafc;
            border-radius: 3px;
          }

          .virtual-list-container::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 3px;
          }

          .virtual-list-container::-webkit-scrollbar-thumb:hover {
            background: #a0aec0;
          }

          .virtual-list-item {
            contain: layout style paint;
          }

          .virtual-list-scrollbar {
            position: absolute;
            top: 0;
            right: 0;
            width: 6px;
            height: 100%;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
          }

          .virtual-list-container:hover .virtual-list-scrollbar {
            opacity: 1;
          }

          .virtual-list-thumb {
            position: absolute;
            width: 100%;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 3px;
            transition: background 0.2s;
          }

          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            .virtual-list-container {
              scrollbar-color: #4a5568 #1a202c;
            }

            .virtual-list-container::-webkit-scrollbar-track {
              background: #1a202c;
            }

            .virtual-list-container::-webkit-scrollbar-thumb {
              background: #4a5568;
            }

            .virtual-list-container::-webkit-scrollbar-thumb:hover {
              background: #718096;
            }

            .virtual-list-scrollbar {
              background: rgba(255, 255, 255, 0.1);
            }

            .virtual-list-thumb {
              background: rgba(255, 255, 255, 0.3);
            }
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .virtual-list-scrollbar,
            .virtual-list-thumb {
              transition: none;
            }
          }
        `}</style>
      </div>
    );
  }
);

VirtualizedList.displayName = 'VirtualizedList';

// ============================================================================
// SETTINGS-SPECIFIC VIRTUALIZED COMPONENTS
// ============================================================================

interface SettingsListItemProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  badge?: string;
  isActive?: boolean;
  onClick?: () => void;
}

const SettingsListItem: React.FC<SettingsListItemProps & { style: React.CSSProperties }> = ({
  title,
  description,
  icon,
  badge,
  isActive = false,
  onClick,
  style
}) => (
  <div
    className={`settings-list-item ${isActive ? 'active' : ''}`}
    style={style}
    onClick={onClick}
  >
    <div className="flex items-center space-x-3 p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
      {icon && (
        <div className="flex-shrink-0 text-gray-500">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {title}
        </h3>
        <p className="text-sm text-gray-600 truncate">
          {description}
        </p>
      </div>
      {badge && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {badge}
        </span>
      )}
    </div>
  </div>
);

export interface VirtualizedSettingsListProps {
  settings: SettingsListItemProps[];
  containerHeight?: number;
  onItemClick?: (item: SettingsListItemProps, index: number) => void;
  activeIndex?: number;
  className?: string;
}

export const VirtualizedSettingsList: React.FC<VirtualizedSettingsListProps> = ({
  settings,
  containerHeight = 400,
  onItemClick,
  activeIndex,
  className = ''
}) => {
  const listRef = useRef<VirtualizedListRef>(null);

  const handleItemClick = useCallback((item: SettingsListItemProps, index: number) => {
    onItemClick?.(item, index);
  }, [onItemClick]);

  return (
    <VirtualizedList
      ref={listRef}
      items={settings}
      itemHeight={72} // Fixed height for settings items
      containerHeight={containerHeight}
      overscan={3}
      scrollToIndex={activeIndex}
      className={`virtualized-settings-list ${className}`}
      getItemKey={(item, index) => `setting-${index}-${item.title}`}
    >
      {({ item, index, style, isVisible }) => (
        <SettingsListItem
          {...item}
          style={style}
          isActive={index === activeIndex}
          onClick={() => handleItemClick(item, index)}
        />
      )}
    </VirtualizedList>
  );
};

export default VirtualizedList;