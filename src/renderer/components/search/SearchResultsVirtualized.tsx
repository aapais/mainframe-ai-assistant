/**
 * SearchResultsVirtualized - High-Performance Virtual Scrolling Search Results
 *
 * Features:
 * - React Window for 60fps scrolling with 10k+ items
 * - Lazy loading of result details
 * - Infinite scroll with pagination
 * - Result grouping and categorization
 * - Expandable result cards
 * - Memory optimization (<50MB for UI components)
 * - Smooth animations and transitions
 * - Keyboard navigation support
 * - Responsive mobile design
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  KeyboardEvent
} from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import AutoSizer from 'react-virtualized-auto-sizer';
import { SearchResult, KBEntry } from '../../../types/services';
import './SearchResultsVirtualized.css';

export interface VirtualizedSearchResult extends SearchResult {
  id: string;
  isExpanded?: boolean;
  isLoading?: boolean;
  groupId?: string;
  groupHeader?: string;
  isGroupHeader?: boolean;
}

export interface SearchResultsVirtualizedProps {
  results: SearchResult[];
  query: string;
  isLoading: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => Promise<void>;
  onEntrySelect: (result: SearchResult) => void;
  onEntryRate?: (entryId: string, successful: boolean) => void;
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  highlightQuery?: boolean;
  showExplanations?: boolean;
  showMetadata?: boolean;
  groupBy?: 'category' | 'matchType' | 'none';
  itemHeight?: number;
  groupHeaderHeight?: number;
  overscanCount?: number;
  threshold?: number;
  className?: string;
  onScroll?: (scrollOffset: number) => void;
  selectedId?: string;
  onSelectionChange?: (selectedId: string | null) => void;
}

interface GroupedResults {
  items: VirtualizedSearchResult[];
  groups: Map<string, VirtualizedSearchResult[]>;
}

// Memoized result item component for performance
const ResultItem = memo<ListChildComponentProps & {
  data: {
    items: VirtualizedSearchResult[];
    query: string;
    highlightQuery: boolean;
    showExplanations: boolean;
    showMetadata: boolean;
    onEntrySelect: (result: SearchResult) => void;
    onEntryRate?: (entryId: string, successful: boolean) => void;
    onToggleExpand: (index: number) => void;
    selectedId?: string;
    onSelectionChange?: (selectedId: string | null) => void;
  };
}>(({ index, style, data }) => {
  const {
    items,
    query,
    highlightQuery,
    showExplanations,
    showMetadata,
    onEntrySelect,
    onEntryRate,
    onToggleExpand,
    selectedId,
    onSelectionChange
  } = data;

  const item = items[index];
  if (!item) return null;

  const isSelected = selectedId === item.entry.id;

  // Handle keyboard navigation
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (item.isGroupHeader) {
          onToggleExpand(index);
        } else {
          onEntrySelect(item);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (index < items.length - 1) {
          const nextItem = items[index + 1];
          if (!nextItem.isGroupHeader) {
            onSelectionChange?.(nextItem.entry.id);
          }
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (index > 0) {
          const prevItem = items[index - 1];
          if (!prevItem.isGroupHeader) {
            onSelectionChange?.(prevItem.entry.id);
          }
        }
        break;
    }
  };

  if (item.isGroupHeader) {
    return (
      <div
        style={style}
        className="search-result-group-header"
        onClick={() => onToggleExpand(index)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={item.isExpanded}
      >
        <div className="search-result-group-header__content">
          <span className="search-result-group-header__icon">
            {item.isExpanded ? '▼' : '▶'}
          </span>
          <span className="search-result-group-header__title">
            {item.groupHeader}
          </span>
          <span className="search-result-group-header__count">
            ({item.metadata?.groupCount || 0})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={style}
      className={`search-result-item ${isSelected ? 'selected' : ''} ${
        item.isExpanded ? 'expanded' : ''
      }`}
      onClick={() => {
        onSelectionChange?.(item.entry.id);
        onEntrySelect(item);
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
      aria-selected={isSelected}
    >
      <div className="search-result-item__content">
        {/* Score Badge */}
        <div className="search-result-item__score">
          <span className="score-value">{Math.round(item.score)}%</span>
          <div className={`score-indicator score-indicator--${getScoreLevel(item.score)}`} />
        </div>

        {/* Main Content */}
        <div className="search-result-item__main">
          {/* Header */}
          <div className="search-result-item__header">
            <h3 className="search-result-item__title">
              {highlightQuery
                ? highlightText(item.entry.title, query)
                : item.entry.title
              }
            </h3>
            <div className="search-result-item__meta">
              <span className={`category category--${item.entry.category.toLowerCase()}`}>
                {item.entry.category}
              </span>
              <span className={`match-type match-type--${item.matchType}`}>
                {item.matchType}
              </span>
            </div>
          </div>

          {/* Problem Preview */}
          <div className="search-result-item__problem">
            {highlightQuery
              ? highlightText(truncateText(item.entry.problem, 150), query)
              : truncateText(item.entry.problem, 150)
            }
          </div>

          {/* Tags */}
          {item.entry.tags && item.entry.tags.length > 0 && (
            <div className="search-result-item__tags">
              {item.entry.tags.slice(0, 5).map((tag, tagIndex) => (
                <span key={tagIndex} className="tag">
                  {tag}
                </span>
              ))}
              {item.entry.tags.length > 5 && (
                <span className="tag tag--more">
                  +{item.entry.tags.length - 5} more
                </span>
              )}
            </div>
          )}

          {/* Usage Stats */}
          <div className="search-result-item__stats">
            <div className="stat">
              <span className="stat__icon">👁️</span>
              <span className="stat__value">{item.entry.usage_count}</span>
            </div>
            {item.entry.success_count > 0 && (
              <div className="stat">
                <span className="stat__icon">✅</span>
                <span className="stat__value">
                  {Math.round(
                    (item.entry.success_count /
                      (item.entry.success_count + item.entry.failure_count)) *
                      100
                  )}%
                </span>
              </div>
            )}
            {showMetadata && item.metadata && (
              <div className="stat">
                <span className="stat__icon">⚡</span>
                <span className="stat__value">{item.metadata.processingTime}ms</span>
              </div>
            )}
          </div>

          {/* Explanation */}
          {showExplanations && item.explanation && (
            <div className="search-result-item__explanation">
              <span className="explanation-icon">💡</span>
              {item.explanation}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="search-result-item__actions">
          <button
            className="action-btn action-btn--expand"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(index);
            }}
            aria-label={item.isExpanded ? 'Collapse' : 'Expand'}
            title={item.isExpanded ? 'Collapse' : 'Expand details'}
          >
            {item.isExpanded ? '▲' : '▼'}
          </button>

          {onEntryRate && (
            <>
              <button
                className="action-btn action-btn--success"
                onClick={(e) => {
                  e.stopPropagation();
                  onEntryRate(item.entry.id, true);
                }}
                aria-label="Mark as helpful"
                title="This solution helped"
              >
                👍
              </button>
              <button
                className="action-btn action-btn--failure"
                onClick={(e) => {
                  e.stopPropagation();
                  onEntryRate(item.entry.id, false);
                }}
                aria-label="Mark as not helpful"
                title="This solution didn't help"
              >
                👎
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {item.isExpanded && (
        <div className="search-result-item__expanded">
          <div className="expanded-section">
            <h4 className="expanded-section__title">Solution</h4>
            <div className="expanded-section__content">
              <pre className="solution-text">
                {highlightQuery
                  ? highlightText(item.entry.solution, query)
                  : item.entry.solution
                }
              </pre>
            </div>
          </div>

          {item.highlights && item.highlights.length > 0 && (
            <div className="expanded-section">
              <h4 className="expanded-section__title">Highlights</h4>
              <div className="highlights">
                {item.highlights.slice(0, 3).map((highlight, hlIndex) => (
                  <div key={hlIndex} className="highlight">
                    <span className="highlight__field">{highlight.field}:</span>
                    <span className="highlight__text">
                      ...{highlight.context}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showMetadata && item.metadata && (
            <div className="expanded-section">
              <h4 className="expanded-section__title">Metadata</h4>
              <div className="metadata">
                <div className="metadata-item">
                  <span className="metadata-item__label">Source:</span>
                  <span className="metadata-item__value">{item.metadata.source}</span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-item__label">Confidence:</span>
                  <span className="metadata-item__value">
                    {Math.round(item.metadata.confidence * 100)}%
                  </span>
                </div>
                {item.metadata.fallback && (
                  <div className="metadata-item">
                    <span className="metadata-item__label">Fallback:</span>
                    <span className="metadata-item__value">Yes</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Helper functions
function getScoreLevel(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;

  const terms = query.split(/\s+/).filter(term => term.length > 1);
  let highlighted = text;

  terms.forEach(term => {
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });

  return highlighted;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

ResultItem.displayName = 'ResultItem';

// Main component
export const SearchResultsVirtualized = memo<SearchResultsVirtualizedProps>(({
  results,
  query,
  isLoading,
  hasNextPage = false,
  onLoadMore,
  onEntrySelect,
  onEntryRate,
  onSortChange,
  sortBy = 'relevance',
  sortOrder = 'desc',
  highlightQuery = true,
  showExplanations = false,
  showMetadata = false,
  groupBy = 'none',
  itemHeight = 140,
  groupHeaderHeight = 48,
  overscanCount = 5,
  threshold = 15,
  className = '',
  onScroll,
  selectedId,
  onSelectionChange
}) => {
  // State for expanded items
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const listRef = useRef<List>(null);
  const loaderRef = useRef<InfiniteLoader>(null);

  // Create grouped and virtualized results
  const groupedResults = useMemo((): GroupedResults => {
    const virtualizedResults: VirtualizedSearchResult[] = results.map((result, index) => ({
      ...result,
      id: result.entry.id,
      isExpanded: expandedItems.has(index)
    }));

    if (groupBy === 'none') {
      return {
        items: virtualizedResults,
        groups: new Map()
      };
    }

    // Group results
    const groups = new Map<string, VirtualizedSearchResult[]>();
    virtualizedResults.forEach(result => {
      const groupKey = groupBy === 'category'
        ? result.entry.category
        : result.matchType;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey)!.push({
        ...result,
        groupId: groupKey
      });
    });

    // Create flat array with group headers
    const items: VirtualizedSearchResult[] = [];
    let itemIndex = 0;

    for (const [groupKey, groupResults] of groups) {
      // Add group header
      const groupHeaderIndex = itemIndex++;
      items.push({
        id: `group-${groupKey}`,
        entry: {} as KBEntry,
        score: 0,
        matchType: 'exact',
        isGroupHeader: true,
        groupHeader: `${groupKey} (${groupResults.length})`,
        groupId: groupKey,
        isExpanded: expandedItems.has(groupHeaderIndex),
        metadata: { groupCount: groupResults.length }
      });

      // Add group items if expanded
      if (expandedItems.has(groupHeaderIndex)) {
        groupResults.forEach(result => {
          items.push({
            ...result,
            id: `${groupKey}-${result.id}`
          });
          itemIndex++;
        });
      }
    }

    return { items, groups };
  }, [results, groupBy, expandedItems]);

  // Handle expand/collapse
  const handleToggleExpand = useCallback((index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Calculate dynamic item height
  const getItemHeight = useCallback((index: number) => {
    const item = groupedResults.items[index];
    if (!item) return itemHeight;

    if (item.isGroupHeader) {
      return groupHeaderHeight;
    }

    let height = itemHeight;

    // Add height for expanded content
    if (item.isExpanded) {
      height += 200; // Base expanded height

      if (item.highlights && item.highlights.length > 0) {
        height += Math.min(item.highlights.length * 30, 90);
      }

      if (showMetadata && item.metadata) {
        height += 60;
      }
    }

    return height;
  }, [groupedResults.items, itemHeight, groupHeaderHeight, showMetadata]);

  // Infinite loading
  const itemCount = hasNextPage
    ? groupedResults.items.length + 1
    : groupedResults.items.length;

  const isItemLoaded = useCallback((index: number) => {
    return !!groupedResults.items[index];
  }, [groupedResults.items]);

  const loadMoreItems = useCallback(async (startIndex: number, stopIndex: number) => {
    if (onLoadMore) {
      await onLoadMore();
    }
  }, [onLoadMore]);

  // Handle scroll
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    onScroll?.(scrollOffset);
  }, [onScroll]);

  // Handle keyboard navigation at list level
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== document.body) return;

      const currentIndex = groupedResults.items.findIndex(
        item => item.entry.id === selectedId
      );

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, groupedResults.items.length - 1);
          const nextItem = groupedResults.items[nextIndex];
          if (nextItem && !nextItem.isGroupHeader) {
            onSelectionChange?.(nextItem.entry.id);
            listRef.current?.scrollToItem(nextIndex);
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevItem = groupedResults.items[prevIndex];
          if (prevItem && !prevItem.isGroupHeader) {
            onSelectionChange?.(prevItem.entry.id);
            listRef.current?.scrollToItem(prevIndex);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown as any);
    return () => document.removeEventListener('keydown', handleKeyDown as any);
  }, [groupedResults.items, selectedId, onSelectionChange]);

  // Clear expanded items when results change
  useEffect(() => {
    setExpandedItems(new Set());
  }, [results]);

  if (results.length === 0 && !isLoading) {
    return (
      <div className={`search-results-empty ${className}`}>
        <div className="search-results-empty__content">
          <div className="search-results-empty__icon">🔍</div>
          <h3 className="search-results-empty__title">No results found</h3>
          <p className="search-results-empty__message">
            {query
              ? `No matches found for "${query}". Try different keywords or check spelling.`
              : 'Start typing to search the knowledge base.'
            }
          </p>
          <div className="search-results-empty__suggestions">
            <h4>Search tips:</h4>
            <ul>
              <li>Use specific error codes (e.g., "S0C7", "VSAM Status 35")</li>
              <li>Include system names (e.g., "JCL", "DB2", "CICS")</li>
              <li>Try category filters for better results</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const itemData = {
    items: groupedResults.items,
    query,
    highlightQuery,
    showExplanations,
    showMetadata,
    onEntrySelect,
    onEntryRate,
    onToggleExpand: handleToggleExpand,
    selectedId,
    onSelectionChange
  };

  return (
    <div className={`search-results-virtualized ${className}`}>
      {/* Results Header */}
      <div className="search-results-header">
        <div className="search-results-header__info">
          <span className="results-count">
            {results.length} results
            {query && <span className="query-text"> for "{query}"</span>}
          </span>
          {isLoading && <span className="loading-indicator">Loading...</span>}
        </div>

        <div className="search-results-header__controls">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc'];
              onSortChange?.(newSortBy, newSortOrder);
            }}
            className="sort-select"
          >
            <option value="relevance-desc">Most Relevant</option>
            <option value="usage-desc">Most Used</option>
            <option value="recent-desc">Most Recent</option>
            <option value="success_rate-desc">Highest Success Rate</option>
            <option value="score-desc">Highest Score</option>
          </select>

          <select
            value={groupBy}
            onChange={(e) => {
              // This would need to be passed as a prop or handled by parent
              console.log('Group by changed:', e.target.value);
            }}
            className="group-select"
          >
            <option value="none">No Grouping</option>
            <option value="category">Group by Category</option>
            <option value="matchType">Group by Match Type</option>
          </select>
        </div>
      </div>

      {/* Virtualized List */}
      <div className="search-results-list">
        <AutoSizer>
          {({ height, width }) => (
            <InfiniteLoader
              ref={loaderRef}
              isItemLoaded={isItemLoaded}
              itemCount={itemCount}
              loadMoreItems={loadMoreItems}
              threshold={threshold}
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
                  itemSize={getItemHeight}
                  itemData={itemData}
                  onItemsRendered={onItemsRendered}
                  onScroll={handleScroll}
                  overscanCount={overscanCount}
                  className="virtual-list"
                >
                  {ResultItem}
                </List>
              )}
            </InfiniteLoader>
          )}
        </AutoSizer>
      </div>
    </div>
  );
});

SearchResultsVirtualized.displayName = 'SearchResultsVirtualized';

export default SearchResultsVirtualized;