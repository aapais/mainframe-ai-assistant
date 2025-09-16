/**
 * ResultsGrid Component
 * Responsive results display grid with virtualization and performance optimizations
 */

import React, { useState, useMemo, useCallback, useRef, ReactNode } from 'react';
import { BaseComponentProps } from '../types/BaseComponent';
import { smartMemo, useVirtualScroll } from '../performance/PerformanceOptimizer';
import { ResponsiveGrid, GridItem } from './ResponsiveGrid';

// =========================
// TYPE DEFINITIONS
// =========================

export interface ResultItem {
  id: string | number;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  score?: number;
  timestamp?: Date;
  metadata?: Record<string, any>;
  highlighted?: boolean;
  [key: string]: any;
}

export interface ResultsGridProps extends BaseComponentProps {
  /** Results data */
  results: ResultItem[];

  /** Loading state */
  loading?: boolean;

  /** Error state */
  error?: string | ReactNode;

  /** No results message */
  noResultsMessage?: ReactNode;

  /** Grid layout configuration */
  layout?: 'list' | 'grid' | 'masonry' | 'table';

  /** Grid columns for different breakpoints */
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };

  /** Item size variant */
  itemSize?: 'sm' | 'md' | 'lg' | 'xl';

  /** Gap between items */
  gap?: 'none' | 'sm' | 'md' | 'lg';

  /** Enable virtualization for large datasets */
  virtualized?: boolean;

  /** Virtual scroll container height */
  virtualHeight?: number;

  /** Virtual item height */
  virtualItemHeight?: number;

  /** Overscan count for virtual scrolling */
  overscan?: number;

  /** Result item render function */
  renderItem?: (item: ResultItem, index: number) => ReactNode;

  /** Custom empty state component */
  emptyState?: ReactNode;

  /** Custom loading component */
  loadingComponent?: ReactNode;

  /** Custom error component */
  errorComponent?: ReactNode;

  /** Selection handling */
  selectable?: boolean;
  multiSelect?: boolean;
  selectedItems?: (string | number)[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;

  /** Item interactions */
  onItemClick?: (item: ResultItem, index: number) => void;
  onItemDoubleClick?: (item: ResultItem, index: number) => void;
  onItemHover?: (item: ResultItem, index: number) => void;

  /** Sorting */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  /** Filtering */
  filterBy?: Record<string, any>;
  onFilterChange?: (filters: Record<string, any>) => void;

  /** Pagination */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    showPageInfo?: boolean;
    onPageChange?: (page: number) => void;
  };

  /** Performance options */
  enableGPUAcceleration?: boolean;
  lazyLoading?: boolean;

  /** Accessibility */
  ariaLabel?: string;
  ariaLabelledBy?: string;

  /** Animation preferences */
  animateItems?: boolean;
  staggerAnimation?: boolean;
}

// =========================
// HOOKS
// =========================

/**
 * Selection management hook
 */
const useSelection = (
  selectable: boolean = false,
  multiSelect: boolean = false,
  selectedItems: (string | number)[] = [],
  onSelectionChange?: (selectedIds: (string | number)[]) => void
) => {
  const [internalSelection, setInternalSelection] = useState<(string | number)[]>([]);
  const isControlled = selectedItems !== undefined;
  const selection = isControlled ? selectedItems : internalSelection;

  const toggleSelection = useCallback((itemId: string | number) => {
    if (!selectable) return;

    let newSelection: (string | number)[];

    if (multiSelect) {
      newSelection = selection.includes(itemId)
        ? selection.filter(id => id !== itemId)
        : [...selection, itemId];
    } else {
      newSelection = selection.includes(itemId) ? [] : [itemId];
    }

    if (!isControlled) {
      setInternalSelection(newSelection);
    }
    onSelectionChange?.(newSelection);
  }, [selectable, multiSelect, selection, isControlled, onSelectionChange]);

  const selectAll = useCallback((itemIds: (string | number)[]) => {
    if (!selectable || !multiSelect) return;

    const newSelection = itemIds;
    if (!isControlled) {
      setInternalSelection(newSelection);
    }
    onSelectionChange?.(newSelection);
  }, [selectable, multiSelect, isControlled, onSelectionChange]);

  const clearSelection = useCallback(() => {
    if (!selectable) return;

    if (!isControlled) {
      setInternalSelection([]);
    }
    onSelectionChange?.([]);
  }, [selectable, isControlled, onSelectionChange]);

  return {
    selection,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected: (itemId: string | number) => selection.includes(itemId)
  };
};

/**
 * Sorting and filtering hook
 */
const useSortAndFilter = (
  results: ResultItem[],
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'asc',
  filterBy?: Record<string, any>
) => {
  return useMemo(() => {
    let processedResults = [...results];

    // Apply filters
    if (filterBy && Object.keys(filterBy).length > 0) {
      processedResults = processedResults.filter(item => {
        return Object.entries(filterBy).every(([key, value]) => {
          if (value === null || value === undefined || value === '') return true;

          const itemValue = item[key];
          if (Array.isArray(value)) {
            return Array.isArray(itemValue)
              ? value.some(v => itemValue.includes(v))
              : value.includes(itemValue);
          }

          if (typeof value === 'string' && typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(value.toLowerCase());
          }

          return itemValue === value;
        });
      });
    }

    // Apply sorting
    if (sortBy) {
      processedResults.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (aValue === bValue) return 0;

        const comparison = aValue < bValue ? -1 : 1;
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return processedResults;
  }, [results, sortBy, sortOrder, filterBy]);
};

// =========================
// STYLE UTILITIES
// =========================

const getLayoutClasses = (layout: string, itemSize: string) => {
  const baseClasses = ['results-grid', 'w-full', 'h-full'];

  switch (layout) {
    case 'list':
      baseClasses.push('results-list');
      break;
    case 'grid':
      baseClasses.push('results-grid-layout');
      break;
    case 'masonry':
      baseClasses.push('results-masonry');
      break;
    case 'table':
      baseClasses.push('results-table');
      break;
  }

  // Item size affects grid template
  baseClasses.push(`item-size-${itemSize}`);

  return baseClasses.join(' ');
};

const getGridConfig = (layout: string, columns: any, itemSize: string) => {
  if (layout === 'list') {
    return { cols: { xs: 1 } };
  }

  if (layout === 'table') {
    return { cols: { xs: 1 } };
  }

  // Default grid configurations based on item size
  const defaultColumns = {
    sm: { xs: 2, sm: 3, md: 4, lg: 5, xl: 6, '2xl': 7 },
    md: { xs: 1, sm: 2, md: 3, lg: 4, xl: 5, '2xl': 6 },
    lg: { xs: 1, sm: 2, md: 2, lg: 3, xl: 4, '2xl': 5 },
    xl: { xs: 1, sm: 1, md: 2, lg: 2, xl: 3, '2xl': 4 }
  };

  return {
    cols: columns || defaultColumns[itemSize] || defaultColumns.md,
    ...(layout === 'masonry' && { masonry: true })
  };
};

// =========================
// COMPONENT PARTS
// =========================

/**
 * Default Result Item Component
 */
const DefaultResultItem: React.FC<{
  item: ResultItem;
  index: number;
  layout: string;
  itemSize: string;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onHover?: () => void;
}> = ({
  item,
  index,
  layout,
  itemSize,
  selected = false,
  onClick,
  onDoubleClick,
  onHover
}) => {
  const itemClasses = useMemo(() => {
    const classes = [
      'result-item',
      'cursor-pointer',
      'transition-all',
      'duration-200',
      'hover:shadow-md',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-blue-500'
    ];

    // Layout-specific classes
    switch (layout) {
      case 'list':
        classes.push('flex', 'items-start', 'space-x-3', 'p-4', 'border-b', 'border-gray-100');
        break;
      case 'grid':
      case 'masonry':
        classes.push('bg-white', 'rounded-lg', 'border', 'border-gray-200', 'p-4');
        break;
      case 'table':
        classes.push('grid', 'grid-cols-4', 'gap-4', 'p-3', 'border-b', 'border-gray-100');
        break;
    }

    // Size-specific classes
    switch (itemSize) {
      case 'sm':
        classes.push('text-sm');
        break;
      case 'lg':
        classes.push('text-base');
        break;
      case 'xl':
        classes.push('text-lg');
        break;
      default:
        classes.push('text-sm');
    }

    // Selection state
    if (selected) {
      classes.push('ring-2', 'ring-blue-500', 'bg-blue-50');
    } else {
      classes.push('hover:bg-gray-50');
    }

    // Highlight state
    if (item.highlighted) {
      classes.push('bg-yellow-50', 'border-yellow-200');
    }

    return classes.join(' ');
  }, [layout, itemSize, selected, item.highlighted]);

  return (
    <div
      className={itemClasses}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onHover}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      data-testid={`result-item-${index}`}
      data-result-id={item.id}
    >
      {/* Score indicator */}
      {item.score !== undefined && (
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1" />
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {Math.round(item.score * 100)}%
          </span>
        </div>
      )}

      {/* Content */}
      <div className="result-content">
        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
          {item.title}
        </h3>

        {item.description && (
          <p className="text-gray-600 mb-2 line-clamp-3">
            {item.description}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            {item.category && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {item.category}
              </span>
            )}
            {item.timestamp && (
              <span>
                {item.timestamp.toLocaleDateString()}
              </span>
            )}
          </div>

          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center space-x-1">
              {item.tags.slice(0, 3).map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="text-gray-400">+{item.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Loading State Component
 */
const LoadingState: React.FC<{ layout: string; count?: number }> = ({
  layout,
  count = 6
}) => (
  <div className="loading-state">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className={`animate-pulse ${
          layout === 'list'
            ? 'h-16 bg-gray-200 rounded mb-2'
            : 'h-32 bg-gray-200 rounded'
        }`}
      />
    ))}
  </div>
);

/**
 * Empty State Component
 */
const EmptyState: React.FC<{ message?: ReactNode }> = ({ message }) => (
  <div className="empty-state flex flex-col items-center justify-center h-64 text-gray-500">
    <svg
      className="w-12 h-12 mb-4 text-gray-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
    <p className="text-sm">
      {message || 'No results to display'}
    </p>
  </div>
);

// =========================
// MAIN COMPONENT
// =========================

export const ResultsGrid = smartMemo<ResultsGridProps>(
  ({
    results = [],
    loading = false,
    error,
    noResultsMessage,
    layout = 'grid',
    columns,
    itemSize = 'md',
    gap = 'md',
    virtualized = false,
    virtualHeight = 600,
    virtualItemHeight = 200,
    overscan = 5,
    renderItem,
    emptyState,
    loadingComponent,
    errorComponent,
    selectable = false,
    multiSelect = false,
    selectedItems,
    onSelectionChange,
    onItemClick,
    onItemDoubleClick,
    onItemHover,
    sortBy,
    sortOrder = 'asc',
    onSortChange,
    filterBy,
    onFilterChange,
    pagination,
    enableGPUAcceleration = false,
    lazyLoading = false,
    ariaLabel,
    ariaLabelledBy,
    animateItems = false,
    staggerAnimation = false,
    className = '',
    style,
    'data-testid': testId,
    ...restProps
  }) => {
    // Selection management
    const selection = useSelection(selectable, multiSelect, selectedItems, onSelectionChange);

    // Sort and filter results
    const processedResults = useSortAndFilter(results, sortBy, sortOrder, filterBy);

    // Grid configuration
    const gridConfig = useMemo(() =>
      getGridConfig(layout, columns, itemSize),
      [layout, columns, itemSize]
    );

    // Virtual scrolling (only for list layout with large datasets)
    const virtualScroll = useVirtualScroll({
      itemCount: processedResults.length,
      itemHeight: virtualItemHeight,
      containerHeight: virtualHeight,
      overscanCount: overscan,
      scrollThreshold: 10
    });

    // Render single item
    const renderSingleItem = useCallback((item: ResultItem, index: number) => {
      const isSelected = selection.isSelected(item.id);

      const handleClick = () => {
        if (selectable) {
          selection.toggleSelection(item.id);
        }
        onItemClick?.(item, index);
      };

      const handleDoubleClick = () => {
        onItemDoubleClick?.(item, index);
      };

      const handleHover = () => {
        onItemHover?.(item, index);
      };

      if (renderItem) {
        return renderItem(item, index);
      }

      return (
        <DefaultResultItem
          item={item}
          index={index}
          layout={layout}
          itemSize={itemSize}
          selected={isSelected}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onHover={handleHover}
        />
      );
    }, [
      layout,
      itemSize,
      selection,
      selectable,
      renderItem,
      onItemClick,
      onItemDoubleClick,
      onItemHover
    ]);

    // Layout classes
    const layoutClasses = useMemo(() => {
      const base = getLayoutClasses(layout, itemSize);
      const classes = [base];

      if (enableGPUAcceleration) {
        classes.push('gpu-optimized');
      }

      if (animateItems) {
        classes.push('animate-items');
      }

      return className ? `${classes.join(' ')} ${className}` : classes.join(' ');
    }, [layout, itemSize, enableGPUAcceleration, animateItems, className]);

    // Handle loading state
    if (loading) {
      if (loadingComponent) return <>{loadingComponent}</>;
      return <LoadingState layout={layout} />;
    }

    // Handle error state
    if (error) {
      if (errorComponent) return <>{errorComponent}</>;
      return (
        <div className="error-state p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
          {typeof error === 'string' ? error : error}
        </div>
      );
    }

    // Handle empty state
    if (processedResults.length === 0) {
      if (emptyState) return <>{emptyState}</>;
      return <EmptyState message={noResultsMessage} />;
    }

    // Virtualized list layout
    if (virtualized && layout === 'list') {
      return (
        <div
          className={layoutClasses}
          style={style}
          data-testid={testId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          {...restProps}
        >
          <div {...virtualScroll.containerProps}>
            {virtualScroll.items.map(({ index, style: itemStyle }) => (
              <div key={processedResults[index].id} style={itemStyle}>
                {renderSingleItem(processedResults[index], index)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Standard grid layout
    return (
      <div
        className={layoutClasses}
        style={style}
        data-testid={testId}
        data-layout={layout}
        data-item-size={itemSize}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        {...restProps}
      >
        <ResponsiveGrid
          {...gridConfig}
          gap={gap}
          enableGPUAcceleration={enableGPUAcceleration}
          className="results-container"
        >
          {processedResults.map((item, index) => (
            <GridItem
              key={item.id}
              className={animateItems && staggerAnimation ?
                `animate-fade-in-up` :
                undefined
              }
              style={
                animateItems && staggerAnimation ?
                  { animationDelay: `${index * 50}ms` } :
                  undefined
              }
            >
              {renderSingleItem(item, index)}
            </GridItem>
          ))}
        </ResponsiveGrid>

        {/* Pagination */}
        {pagination && (
          <div className="pagination-container mt-4 flex items-center justify-between">
            {pagination.showPageInfo && (
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} results
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button
                onClick={() => pagination.onPageChange?.(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>

              <span className="text-sm text-gray-600">
                Page {pagination.page}
              </span>

              <button
                onClick={() => pagination.onPageChange?.(pagination.page + 1)}
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
  {
    compareProps: ['results', 'layout', 'loading', 'selectedItems'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

ResultsGrid.displayName = 'ResultsGrid';

export default ResultsGrid;