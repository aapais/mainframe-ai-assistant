/**
 * VirtualizedResults Component
 *
 * High-performance virtualized search results with comprehensive interaction support:
 * - Virtual scrolling for 10,000+ items
 * - Touch gesture support for mobile
 * - Advanced keyboard navigation
 * - WCAG 2.1 AA accessibility compliance
 * - Interaction analytics
 * - Performance optimization
 * @version 1.0.0
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  forwardRef
} from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { trackInteraction } from '../../utils/analytics';
import { SearchResult } from '../../types';

export interface VirtualizedResultsProps {
  /** Search results to display */
  results: SearchResult[];
  /** Search query for highlighting */
  query: string;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string | null;
  /** Whether more items can be loaded */
  hasNextPage?: boolean;
  /** Callback to load more items */
  onLoadMore?: () => Promise<void>;
  /** Callback when result is selected */
  onResultSelect?: (result: SearchResult, index: number) => void;
  /** Callback for result rating */
  onResultRate?: (resultId: string, helpful: boolean) => void;
  /** Height of each result item */
  itemHeight?: number;
  /** Number of items to overscan for smooth scrolling */
  overscanCount?: number;
  /** Threshold for loading more items */
  loadMoreThreshold?: number;
  /** Enable touch gestures */
  enableTouchGestures?: boolean;
  /** Enable advanced keyboard shortcuts */
  enableAdvancedKeyboardShortcuts?: boolean;
  /** Enable interaction analytics */
  enableAnalytics?: boolean;
  /** Custom className */
  className?: string;
  /** ARIA label */
  ariaLabel?: string;
  /** Announcement callback for screen readers */
  onAnnouncement?: (message: string, priority: 'polite' | 'assertive') => void;
  /** Selected result ID */
  selectedId?: string;
  /** Callback when selection changes */
  onSelectionChange?: (selectedId: string | null, index: number) => void;
}

interface ResultItemProps extends ListChildComponentProps {
  data: {
    results: SearchResult[];
    query: string;
    selectedId?: string;
    onResultSelect?: (result: SearchResult, index: number) => void;
    onResultRate?: (resultId: string, helpful: boolean) => void;
    onSelectionChange?: (selectedId: string | null, index: number) => void;
    enableAnalytics: boolean;
    onAnnouncement?: (message: string, priority: 'polite' | 'assertive') => void;
  };
}

// Utility function to highlight search terms
const highlightText = (text: string, query: string): string => {
  if (!query.trim()) return text;

  const terms = query.split(/\s+/).filter(term => term.length > 1);
  let highlighted = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
  });

  return highlighted;
};

// Memoized result item component
const ResultItem = memo<ResultItemProps>(({ index, style, data }) => {
  const {
    results,
    query,
    selectedId,
    onResultSelect,
    onResultRate,
    onSelectionChange,
    enableAnalytics,
    onAnnouncement
  } = data;

  const result = results[index];
  if (!result) return null;

  const isSelected = selectedId === result.entry.id;
  const itemRef = useRef<HTMLDivElement>(null);

  // Handle touch gestures for the item
  const { touchProps } = useTouchGestures({
    enableHorizontalSwipe: true,
    enableVerticalSwipe: false,
    enableLongPress: true,
    enableAnalytics,
    onTap: () => {
      onSelectionChange?.(result.entry.id, index);
      onResultSelect?.(result, index);
    },
    onLongPress: () => {
      // Show context menu or additional options
      onAnnouncement?.(`Long press on ${result.entry.title}`, 'assertive');
    },
    onSwipe: (direction) => {
      if (direction === 'left') {
        onResultRate?.(result.entry.id, false);
        onAnnouncement?.('Marked as not helpful', 'polite');
      } else if (direction === 'right') {
        onResultRate?.(result.entry.id, true);
        onAnnouncement?.('Marked as helpful', 'polite');
      }
    },
    onAnnouncement
  });

  const handleClick = useCallback(() => {
    onSelectionChange?.(result.entry.id, index);
    onResultSelect?.(result, index);

    if (enableAnalytics) {
      trackInteraction('result_interaction', {
        action: 'click',
        result_id: result.entry.id,
        result_title: result.entry.title,
        index,
        score: result.score
      });
    }
  }, [result, index, onResultSelect, onSelectionChange, enableAnalytics]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleClick();
        break;
      case 'h':
        if (event.ctrlKey) {
          event.preventDefault();
          onResultRate?.(result.entry.id, true);
          onAnnouncement?.('Marked as helpful', 'polite');
        }
        break;
      case 'n':
        if (event.ctrlKey) {
          event.preventDefault();
          onResultRate?.(result.entry.id, false);
          onAnnouncement?.('Marked as not helpful', 'polite');
        }
        break;
    }
  }, [handleClick, result.entry.id, onResultRate, onAnnouncement]);

  // Focus management
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.focus();
    }
  }, [isSelected]);

  const scorePercentage = Math.round(result.score * 100);
  const confidenceLevel = scorePercentage >= 80 ? 'high' : scorePercentage >= 60 ? 'medium' : 'low';

  return (
    <div
      ref={itemRef}
      style={style}
      className={`virtualized-result-item ${isSelected ? 'selected' : ''} confidence-${confidenceLevel}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isSelected ? 0 : -1}
      role="option"
      aria-selected={isSelected}
      aria-label={`Search result ${index + 1}: ${result.entry.title}`}
      aria-describedby={`result-${index}-description`}
      data-index={index}
      data-result-id={result.entry.id}
      {...touchProps}
    >
      <div className="result-item-content">
        {/* Score indicator */}
        <div className="score-indicator" aria-hidden="true">
          <div className={`score-badge score-${confidenceLevel}`}>
            {scorePercentage}%
          </div>
        </div>

        {/* Main content */}
        <div className="result-main">
          <h3
            className="result-title"
            dangerouslySetInnerHTML={{
              __html: highlightText(result.entry.title, query)
            }}
          />

          <div className="result-meta">
            <span className={`category category-${result.entry.category.toLowerCase()}`}>
              {result.entry.category}
            </span>
            <span className={`match-type match-type-${result.matchType}`}>
              {result.matchType}
            </span>
            <span className="usage-count">
              Used {result.entry.usage_count || 0} times
            </span>
          </div>

          <p
            className="result-problem"
            dangerouslySetInnerHTML={{
              __html: highlightText(
                result.entry.problem.length > 150
                  ? result.entry.problem.substring(0, 150) + '...'
                  : result.entry.problem,
                query
              )
            }}
          />

          {/* Tags */}
          {result.entry.tags && result.entry.tags.length > 0 && (
            <div className="result-tags">
              {result.entry.tags.slice(0, 5).map((tag, tagIndex) => (
                <span key={tagIndex} className="tag">
                  {tag}
                </span>
              ))}
              {result.entry.tags.length > 5 && (
                <span className="tag-more">
                  +{result.entry.tags.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="result-actions">
          <button
            className="action-btn helpful-btn"
            onClick={(e) => {
              e.stopPropagation();
              onResultRate?.(result.entry.id, true);
              onAnnouncement?.('Marked as helpful', 'polite');
            }}
            aria-label="Mark as helpful"
            title="This solution helped (Ctrl+H)"
          >
            👍
          </button>
          <button
            className="action-btn not-helpful-btn"
            onClick={(e) => {
              e.stopPropagation();
              onResultRate?.(result.entry.id, false);
              onAnnouncement?.('Marked as not helpful', 'polite');
            }}
            aria-label="Mark as not helpful"
            title="This solution didn't help (Ctrl+N)"
          >
            👎
          </button>
        </div>
      </div>

      {/* Hidden description for screen readers */}
      <div id={`result-${index}-description`} className="sr-only">
        {`Search result ${index + 1} of ${results.length}.
        Title: ${result.entry.title}.
        Category: ${result.entry.category}.
        Match type: ${result.matchType}.
        Confidence: ${scorePercentage}% (${confidenceLevel}).
        Problem: ${result.entry.problem}.
        Used ${result.entry.usage_count || 0} times.
        Press Enter to select, Ctrl+H to mark helpful, Ctrl+N to mark not helpful.`}
      </div>
    </div>
  );
});

ResultItem.displayName = 'ResultItem';

// Main VirtualizedResults component
export const VirtualizedResults = memo<VirtualizedResultsProps>(({
  results,
  query,
  isLoading = false,
  error = null,
  hasNextPage = false,
  onLoadMore,
  onResultSelect,
  onResultRate,
  itemHeight = 200,
  overscanCount = 5,
  loadMoreThreshold = 15,
  enableTouchGestures = true,
  enableAdvancedKeyboardShortcuts = true,
  enableAnalytics = true,
  className = '',
  ariaLabel = 'Search results',
  onAnnouncement,
  selectedId,
  onSelectionChange
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Create items data for type-ahead navigation
  const navigationItems = useMemo(() =>
    results.map(result => ({
      id: result.entry.id,
      title: result.entry.title
    })),
    [results]
  );

  // Enhanced keyboard navigation
  const keyboardNavigation = useKeyboardNavigation({
    itemCount: results.length,
    initialSelectedIndex: selectedIndex,
    wrap: false,
    autoScroll: true,
    containerRef,
    enableAdvancedShortcuts: enableAdvancedKeyboardShortcuts,
    enableAnalytics,
    enableTypeAhead: true,
    enableVimNavigation: true,
    items: navigationItems,
    onSelectionChange: (index) => {
      setSelectedIndex(index);
      if (index >= 0 && results[index]) {
        onSelectionChange?.(results[index].entry.id, index);
        listRef.current?.scrollToItem(index, 'smart');
      }
    },
    onItemActivate: (index) => {
      if (index >= 0 && results[index]) {
        onResultSelect?.(results[index], index);
      }
    },
    onAnnouncement
  });

  // Touch gesture support for the container
  const { touchProps: containerTouchProps } = useTouchGestures({
    enableHorizontalSwipe: false,
    enableVerticalSwipe: true,
    enablePullToRefresh: !!onLoadMore,
    enableAnalytics,
    onPullToRefresh: onLoadMore,
    onSwipe: (direction) => {
      if (direction === 'up' && hasNextPage) {
        onLoadMore?.();
      }
    },
    onAnnouncement
  });

  // Infinite loading configuration
  const itemCount = hasNextPage ? results.length + 1 : results.length;

  const isItemLoaded = useCallback((index: number) => {
    return !!results[index];
  }, [results]);

  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (onLoadMore && hasNextPage) {
      await onLoadMore();
    }
  }, [onLoadMore, hasNextPage]);

  // Update selected index when selectedId prop changes
  useEffect(() => {
    if (selectedId) {
      const index = results.findIndex(result => result.entry.id === selectedId);
      if (index !== -1) {
        setSelectedIndex(index);
        listRef.current?.scrollToItem(index, 'smart');
      }
    }
  }, [selectedId, results]);

  // Announce results loaded
  useEffect(() => {
    if (results.length > 0 && !isLoading) {
      onAnnouncement?.(
        `${results.length} search results loaded for "${query}"`,
        'polite'
      );
    }
  }, [results.length, query, isLoading, onAnnouncement]);

  // Item data for list rendering
  const itemData = useMemo(() => ({
    results,
    query,
    selectedId,
    onResultSelect,
    onResultRate,
    onSelectionChange,
    enableAnalytics,
    onAnnouncement
  }), [results, query, selectedId, onResultSelect, onResultRate, onSelectionChange, enableAnalytics, onAnnouncement]);

  // Loading state
  if (isLoading && results.length === 0) {
    return (
      <div className={`virtualized-results-loading ${className}`} role="status" aria-live="polite">
        <div className="loading-spinner" aria-hidden="true" />
        <p>Loading search results...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`virtualized-results-error ${className}`} role="alert" aria-live="assertive">
        <div className="error-icon" aria-hidden="true">⚠️</div>
        <h3>Search Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  // No results state
  if (results.length === 0) {
    return (
      <div className={`virtualized-results-empty ${className}`} role="status" aria-live="polite">
        <div className="empty-icon" aria-hidden="true">🔍</div>
        <h3>No results found</h3>
        <p>Try adjusting your search query or using different keywords.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtualized-results ${className}`}
      role="listbox"
      aria-label={`${ariaLabel}. ${results.length} results found. Use arrow keys to navigate.`}
      aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
      tabIndex={0}
      {...keyboardNavigation.handleKeyDown && { onKeyDown: keyboardNavigation.handleKeyDown }}
      {...(enableTouchGestures ? containerTouchProps : {})}
    >
      {/* Results header */}
      <div className="results-header">
        <h2 className="results-title">Search Results</h2>
        <p className="results-count">
          {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
        </p>
        {keyboardNavigation.typeAheadQuery && (
          <div className="type-ahead-indicator" aria-live="polite">
            Type ahead: "{keyboardNavigation.typeAheadQuery}"
          </div>
        )}
      </div>

      {/* Virtualized list */}
      <div className="results-list">
        <AutoSizer>
          {({ height, width }) => (
            <InfiniteLoader
              isItemLoaded={isItemLoaded}
              itemCount={itemCount}
              loadMoreItems={loadMoreItems}
              threshold={loadMoreThreshold}
            >
              {({ onItemsRendered, ref }) => (
                <List
                  ref={(list) => {
                    ref(list);
                    listRef.current = list;
                  }}
                  height={height}
                  width={width}
                  itemCount={itemCount}
                  itemSize={itemHeight}
                  itemData={itemData}
                  onItemsRendered={onItemsRendered}
                  overscanCount={overscanCount}
                  className="virtual-list"
                >
                  {({ index, style, data }) => {
                    // Loading placeholder for infinite loading
                    if (index >= results.length) {
                      return (
                        <div style={style} className="loading-item" role="status">
                          <div className="loading-spinner" aria-hidden="true" />
                          <span>Loading more results...</span>
                        </div>
                      );
                    }

                    return <ResultItem index={index} style={style} data={data} />;
                  }}
                </List>
              )}
            </InfiniteLoader>
          )}
        </AutoSizer>
      </div>

      {/* Help text */}
      <div className="sr-only" aria-live="polite">
        Use arrow keys to navigate results. Press Enter to select.
        {enableAdvancedKeyboardShortcuts &&
          'Use Ctrl+H to mark helpful, Ctrl+N to mark not helpful. Type to search quickly.'
        }
        {enableTouchGestures &&
          'On touch devices: swipe right to mark helpful, swipe left to mark not helpful, long press for options.'
        }
      </div>
    </div>
  );
});

VirtualizedResults.displayName = 'VirtualizedResults';

export default VirtualizedResults;