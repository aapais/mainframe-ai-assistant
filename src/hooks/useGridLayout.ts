/**
 * useGridLayout Hook
 *
 * Dynamic grid layout management with responsive behavior
 * Optimized for the Mainframe KB Assistant layout system
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useResponsive, BreakpointKey } from './useResponsive';
import { useResizeObserver } from './useResizeObserver';

// =========================
// TYPE DEFINITIONS
// =========================

export interface GridItem {
  /** Unique identifier */
  id: string;
  /** Column span */
  colSpan?: number;
  /** Row span */
  rowSpan?: number;
  /** Column start position */
  colStart?: number;
  /** Row start position */
  rowStart?: number;
  /** Column end position */
  colEnd?: number;
  /** Row end position */
  rowEnd?: number;
  /** Grid area name */
  area?: string;
  /** Minimum width constraint */
  minWidth?: number;
  /** Minimum height constraint */
  minHeight?: number;
  /** Item priority for auto-placement */
  priority?: number;
  /** Whether item is pinned (always visible) */
  pinned?: boolean;
  /** Responsive column spans */
  responsive?: Partial<Record<BreakpointKey, number>>;
  /** Custom data */
  data?: any;
}

export interface GridLayoutConfig {
  /** Number of columns per breakpoint */
  columns: Partial<Record<BreakpointKey, number>>;
  /** Row height (auto | fixed number) */
  rowHeight?: 'auto' | number;
  /** Gap size */
  gap?: number;
  /** Minimum item width */
  minItemWidth?: number;
  /** Maximum items per row */
  maxItemsPerRow?: number;
  /** Auto-fit/auto-fill behavior */
  autoFit?: boolean;
  /** Dense packing */
  dense?: boolean;
  /** Masonry layout */
  masonry?: boolean;
}

export interface GridLayoutState {
  /** Current columns */
  columns: number;
  /** Current rows */
  rows: number;
  /** Container width */
  containerWidth: number;
  /** Container height */
  containerHeight: number;
  /** Item positions */
  positions: Record<string, { x: number; y: number; width: number; height: number }>;
  /** Available space */
  availableSpace: { width: number; height: number };
  /** Current breakpoint */
  breakpoint: BreakpointKey;
}

export interface UseGridLayoutOptions {
  /** Initial items */
  items?: GridItem[];
  /** Layout configuration */
  config?: GridLayoutConfig;
  /** Enable auto-layout */
  autoLayout?: boolean;
  /** Container selector or element */
  container?: string | HTMLElement | null;
  /** Debounce resize events */
  debounceMs?: number;
  /** Enable performance monitoring */
  monitor?: boolean;
  /** Callback when layout changes */
  onLayoutChange?: (state: GridLayoutState) => void;
}

export interface UseGridLayoutReturn {
  /** Current layout state */
  state: GridLayoutState;
  /** Grid items */
  items: GridItem[];
  /** Container ref */
  containerRef: React.RefCallback<HTMLElement>;
  /** Add item to grid */
  addItem: (item: GridItem) => void;
  /** Remove item from grid */
  removeItem: (itemId: string) => void;
  /** Update item */
  updateItem: (itemId: string, updates: Partial<GridItem>) => void;
  /** Move item to new position */
  moveItem: (itemId: string, position: { colStart?: number; rowStart?: number }) => void;
  /** Recalculate layout */
  recalculateLayout: () => void;
  /** Get item position */
  getItemPosition: (itemId: string) => { x: number; y: number; width: number; height: number } | null;
  /** Check if position is available */
  isPositionAvailable: (colStart: number, rowStart: number, colSpan: number, rowSpan: number) => boolean;
  /** Get next available position */
  getNextAvailablePosition: (colSpan: number, rowSpan: number) => { colStart: number; rowStart: number } | null;
  /** Reset layout */
  resetLayout: () => void;
}

// =========================
// DEFAULT CONFIGURATION
// =========================

const DEFAULT_CONFIG: GridLayoutConfig = {
  columns: {
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 6,
    '2xl': 8,
  },
  rowHeight: 'auto',
  gap: 16,
  minItemWidth: 250,
  maxItemsPerRow: 12,
  autoFit: false,
  dense: false,
  masonry: false,
};

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Calculate grid dimensions based on container size and configuration
 */
const calculateGridDimensions = (
  containerWidth: number,
  columns: number,
  gap: number,
  minItemWidth: number
): { columnWidth: number; actualColumns: number } => {
  // Calculate available space after gaps
  const availableWidth = containerWidth - gap * (columns + 1);
  const columnWidth = availableWidth / columns;

  // Check if column width meets minimum requirements
  if (columnWidth < minItemWidth) {
    // Reduce columns to meet minimum width
    const actualColumns = Math.max(1, Math.floor((containerWidth - gap) / (minItemWidth + gap)));
    const newAvailableWidth = containerWidth - gap * (actualColumns + 1);
    const newColumnWidth = newAvailableWidth / actualColumns;

    return {
      columnWidth: newColumnWidth,
      actualColumns,
    };
  }

  return {
    columnWidth,
    actualColumns: columns,
  };
};

/**
 * Calculate item position in pixels
 */
const calculateItemPosition = (
  colStart: number,
  rowStart: number,
  colSpan: number,
  rowSpan: number,
  columnWidth: number,
  rowHeight: number,
  gap: number
): { x: number; y: number; width: number; height: number } => {
  const x = gap + (colStart - 1) * (columnWidth + gap);
  const y = gap + (rowStart - 1) * (rowHeight + gap);
  const width = colSpan * columnWidth + (colSpan - 1) * gap;
  const height = rowSpan * rowHeight + (rowSpan - 1) * gap;

  return { x, y, width, height };
};

/**
 * Auto-place items in grid
 */
const autoPlaceItems = (
  items: GridItem[],
  columns: number,
  dense: boolean = false
): GridItem[] => {
  const grid: boolean[][] = [];
  const placedItems: GridItem[] = [];

  // Sort items by priority (higher first)
  const sortedItems = [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  sortedItems.forEach(item => {
    const colSpan = item.colSpan || 1;
    const rowSpan = item.rowSpan || 1;

    // Skip items with explicit positions
    if (item.colStart && item.rowStart) {
      placedItems.push(item);
      markGridCells(grid, item.colStart - 1, item.rowStart - 1, colSpan, rowSpan);
      return;
    }

    // Find next available position
    const position = findNextAvailablePosition(grid, columns, colSpan, rowSpan, dense);

    if (position) {
      const placedItem = {
        ...item,
        colStart: position.colStart + 1,
        rowStart: position.rowStart + 1,
      };

      placedItems.push(placedItem);
      markGridCells(grid, position.colStart, position.rowStart, colSpan, rowSpan);
    } else {
      // Could not place item, add to end
      placedItems.push(item);
    }
  });

  return placedItems;
};

/**
 * Mark grid cells as occupied
 */
const markGridCells = (
  grid: boolean[][],
  colStart: number,
  rowStart: number,
  colSpan: number,
  rowSpan: number
): void => {
  for (let row = rowStart; row < rowStart + rowSpan; row++) {
    if (!grid[row]) grid[row] = [];
    for (let col = colStart; col < colStart + colSpan; col++) {
      grid[row][col] = true;
    }
  }
};

/**
 * Find next available position for item
 */
const findNextAvailablePosition = (
  grid: boolean[][],
  columns: number,
  colSpan: number,
  rowSpan: number,
  dense: boolean
): { colStart: number; rowStart: number } | null => {
  const maxRow = grid.length + rowSpan;

  for (let row = 0; row < maxRow; row++) {
    for (let col = 0; col <= columns - colSpan; col++) {
      if (isPositionAvailable(grid, col, row, colSpan, rowSpan)) {
        return { colStart: col, rowStart: row };
      }
    }
  }

  return null;
};

/**
 * Check if grid position is available
 */
const isPositionAvailable = (
  grid: boolean[][],
  colStart: number,
  rowStart: number,
  colSpan: number,
  rowSpan: number
): boolean => {
  for (let row = rowStart; row < rowStart + rowSpan; row++) {
    if (!grid[row]) continue;
    for (let col = colStart; col < colStart + colSpan; col++) {
      if (grid[row][col]) return false;
    }
  }
  return true;
};

// =========================
// MAIN HOOK
// =========================

/**
 * useGridLayout Hook
 *
 * Manages dynamic grid layout with responsive behavior
 *
 * @param options - Configuration options
 * @returns Grid layout utilities and state
 *
 * @example
 * ```tsx
 * const { state, containerRef, addItem, removeItem } = useGridLayout({
 *   items: initialItems,
 *   config: {
 *     columns: { xs: 1, md: 3, lg: 4 },
 *     gap: 16,
 *     minItemWidth: 250
 *   },
 *   autoLayout: true
 * });
 *
 * return (
 *   <div ref={containerRef} className="grid-container">
 *     {state.items.map(item => (
 *       <GridItem key={item.id} {...getItemPosition(item.id)} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export const useGridLayout = (options: UseGridLayoutOptions = {}): UseGridLayoutReturn => {
  const {
    items: initialItems = [],
    config = DEFAULT_CONFIG,
    autoLayout = true,
    debounceMs = 150,
    monitor = false,
    onLayoutChange,
  } = options;

  // Merge config with defaults
  const gridConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
  }), [config]);

  // Responsive utilities
  const { device, breakpoint } = useResponsive({ debounceMs });

  // State
  const [items, setItems] = useState<GridItem[]>(initialItems);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Refs
  const layoutStateRef = useRef<GridLayoutState | null>(null);
  const onLayoutChangeRef = useRef(onLayoutChange);

  // Update callback ref
  onLayoutChangeRef.current = onLayoutChange;

  // Container resize observer
  const { ref: containerRef } = useResizeObserver({
    debounceMs,
    onResize: useCallback((entry) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });

      if (monitor) {
        console.log('Grid container resized:', { width, height, breakpoint });
      }
    }, [monitor, breakpoint]),
  });

  // Calculate current layout state
  const state = useMemo<GridLayoutState>(() => {
    const currentColumns = gridConfig.columns[breakpoint] || gridConfig.columns.lg || 4;
    const { columnWidth, actualColumns } = calculateGridDimensions(
      containerSize.width,
      currentColumns,
      gridConfig.gap || 16,
      gridConfig.minItemWidth || 250
    );

    // Auto-place items if enabled
    const layoutItems = autoLayout ? autoPlaceItems(items, actualColumns, gridConfig.dense) : items;

    // Calculate positions
    const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const rowHeight = typeof gridConfig.rowHeight === 'number' ? gridConfig.rowHeight : 200;
    let maxRow = 0;

    layoutItems.forEach(item => {
      if (item.colStart && item.rowStart) {
        const colSpan = item.colSpan || 1;
        const rowSpan = item.rowSpan || 1;

        positions[item.id] = calculateItemPosition(
          item.colStart,
          item.rowStart,
          colSpan,
          rowSpan,
          columnWidth,
          rowHeight,
          gridConfig.gap || 16
        );

        maxRow = Math.max(maxRow, item.rowStart + rowSpan - 1);
      }
    });

    const newState: GridLayoutState = {
      columns: actualColumns,
      rows: maxRow,
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      positions,
      availableSpace: {
        width: containerSize.width,
        height: maxRow * rowHeight + (maxRow + 1) * (gridConfig.gap || 16),
      },
      breakpoint,
    };

    // Store reference for comparison
    layoutStateRef.current = newState;

    // Notify of layout changes
    if (onLayoutChangeRef.current) {
      onLayoutChangeRef.current(newState);
    }

    if (monitor) {
      console.log('Grid layout calculated:', newState);
    }

    return newState;
  }, [
    breakpoint,
    containerSize,
    items,
    gridConfig,
    autoLayout,
    monitor,
  ]);

  // Item management functions
  const addItem = useCallback((item: GridItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateItem = useCallback((itemId: string, updates: Partial<GridItem>) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ));
  }, []);

  const moveItem = useCallback((itemId: string, position: { colStart?: number; rowStart?: number }) => {
    updateItem(itemId, position);
  }, [updateItem]);

  const recalculateLayout = useCallback(() => {
    // Force re-render by updating items state
    setItems(prev => [...prev]);
  }, []);

  const getItemPosition = useCallback((itemId: string) => {
    return state.positions[itemId] || null;
  }, [state.positions]);

  const isPositionAvailable = useCallback((
    colStart: number,
    rowStart: number,
    colSpan: number,
    rowSpan: number
  ): boolean => {
    const grid: boolean[][] = [];

    // Mark all existing items
    items.forEach(item => {
      if (item.colStart && item.rowStart) {
        markGridCells(
          grid,
          item.colStart - 1,
          item.rowStart - 1,
          item.colSpan || 1,
          item.rowSpan || 1
        );
      }
    });

    return isPositionAvailable(grid, colStart - 1, rowStart - 1, colSpan, rowSpan);
  }, [items]);

  const getNextAvailablePosition = useCallback((colSpan: number, rowSpan: number) => {
    const grid: boolean[][] = [];

    // Mark all existing items
    items.forEach(item => {
      if (item.colStart && item.rowStart) {
        markGridCells(
          grid,
          item.colStart - 1,
          item.rowStart - 1,
          item.colSpan || 1,
          item.rowSpan || 1
        );
      }
    });

    const position = findNextAvailablePosition(grid, state.columns, colSpan, rowSpan, gridConfig.dense || false);

    if (position) {
      return {
        colStart: position.colStart + 1,
        rowStart: position.rowStart + 1,
      };
    }

    return null;
  }, [items, state.columns, gridConfig.dense]);

  const resetLayout = useCallback(() => {
    setItems(initialItems);
  }, [initialItems]);

  return {
    state,
    items,
    containerRef,
    addItem,
    removeItem,
    updateItem,
    moveItem,
    recalculateLayout,
    getItemPosition,
    isPositionAvailable,
    getNextAvailablePosition,
    resetLayout,
  };
};

// =========================
// CONVENIENCE HOOKS
// =========================

/**
 * Simple grid layout for equal-sized items
 */
export const useSimpleGridLayout = (options: {
  itemCount: number;
  minItemWidth?: number;
  gap?: number;
  container?: string | HTMLElement | null;
}) => {
  const { itemCount, minItemWidth = 250, gap = 16, container } = options;

  const items = useMemo<GridItem[]>(() => {
    return Array.from({ length: itemCount }, (_, index) => ({
      id: `item-${index}`,
      colSpan: 1,
      rowSpan: 1,
    }));
  }, [itemCount]);

  return useGridLayout({
    items,
    config: {
      columns: { xs: 1, sm: 2, md: 3, lg: 4, xl: 6, '2xl': 8 },
      minItemWidth,
      gap,
      autoFit: true,
    },
    autoLayout: true,
    container,
  });
};

/**
 * Masonry grid layout
 */
export const useMasonryLayout = (options: {
  items: (GridItem & { height?: number })[];
  columns?: Partial<Record<BreakpointKey, number>>;
  gap?: number;
}) => {
  const { items, columns, gap = 16 } = options;

  return useGridLayout({
    items,
    config: {
      columns: columns || { xs: 1, sm: 2, md: 3, lg: 4 },
      gap,
      masonry: true,
      rowHeight: 'auto',
    },
    autoLayout: false, // Manual masonry layout
  });
};

export default useGridLayout;