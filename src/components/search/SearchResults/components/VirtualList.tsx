/**
 * VirtualList Component
 *
 * High-performance virtual scrolling implementation for large datasets
 * @version 2.0.0
 */

import React, { memo, useRef, useEffect } from 'react';
import { VirtualListProps, VirtualizedResultItemProps } from '../types';
import { useVirtualization } from '../hooks/useVirtualization';
import { SearchResultItem } from './SearchResultItem';

/**
 * Virtual scrolling list component for performance optimization
 */
export const VirtualList: React.FC<VirtualListProps> = memo(({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  itemData,
  className = '',
  bufferSize = 5,
  onScroll
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    settings,
    visibleRange,
    containerProps,
    getItemProps,
    totalHeight,
    scrollTop
  } = useVirtualization({
    itemCount: items.length,
    itemHeight,
    containerHeight,
    bufferSize,
    enabled: true,
    threshold: 1 // Always enable for VirtualList
  });

  // Combine container props with custom scroll handler
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    containerProps.onScroll(event);
    onScroll?.(event);
  };

  // Sync scroll position with container element
  useEffect(() => {
    if (containerRef.current && containerRef.current.scrollTop !== scrollTop) {
      containerRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  const visibleItems = items.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll-container ${className}`}
      style={{
        ...containerProps.style,
        height: containerHeight,
        overflow: 'auto'
      }}
      onScroll={handleScroll}
    >
      {/* Total height spacer */}
      <div
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {/* Visible items */}
        {visibleItems.map((_, index) => {
          const actualIndex = visibleRange.start + index;
          const itemProps = getItemProps(actualIndex);

          return (
            <div
              key={itemProps.key}
              style={itemProps.style}
              className="virtual-scroll-item"
            >
              {renderItem({
                index: actualIndex,
                style: itemProps.style,
                data: itemData
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

VirtualList.displayName = 'VirtualList';

/**
 * Specialized virtual list for search results with built-in item rendering
 */
export const SearchResultsVirtualList: React.FC<Omit<VirtualListProps, 'renderItem'>> = memo((props) => {
  const renderSearchResultItem = ({ index, style, data }: VirtualizedResultItemProps) => (
    <SearchResultItem
      result={data.results[index]}
      index={index}
      isSelected={index === data.selectedIndex}
      searchTerms={data.searchTerms}
      showConfidenceScores={data.showConfidenceScores}
      onSelect={data.onResultSelect}
      style={style}
    />
  );

  return (
    <VirtualList
      {...props}
      renderItem={renderSearchResultItem}
    />
  );
});

SearchResultsVirtualList.displayName = 'SearchResultsVirtualList';

/**
 * Simple fallback list for when virtualization is not needed
 */
export const SimpleList: React.FC<{
  items: unknown[];
  renderItem: (item: unknown, index: number) => React.ReactNode;
  className?: string;
  itemData?: unknown;
}> = memo(({ items, renderItem, className = '', itemData }) => (
  <div className={`simple-list ${className}`}>
    {items.map((item, index) => (
      <div key={index} data-index={index}>
        {renderItem(item, index)}
      </div>
    ))}
  </div>
));

SimpleList.displayName = 'SimpleList';

/**
 * Auto-switching list that uses virtual scrolling for large datasets
 */
export const AdaptiveList: React.FC<VirtualListProps & {
  virtualizationThreshold?: number;
}> = memo(({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  itemData,
  className = '',
  bufferSize = 5,
  onScroll,
  virtualizationThreshold = 20
}) => {
  const shouldVirtualize = items.length >= virtualizationThreshold;

  if (shouldVirtualize) {
    return (
      <VirtualList
        items={items}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
        itemData={itemData}
        className={className}
        bufferSize={bufferSize}
        onScroll={onScroll}
      />
    );
  }

  // Simple list for smaller datasets
  return (
    <div
      className={`simple-list overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={onScroll}
    >
      {items.map((_, index) => (
        <div key={index} data-index={index}>
          {renderItem({
            index,
            style: { height: itemHeight },
            data: itemData
          })}
        </div>
      ))}
    </div>
  );
});

AdaptiveList.displayName = 'AdaptiveList';

export default VirtualList;