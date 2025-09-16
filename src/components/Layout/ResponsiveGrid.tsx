/**
 * ResponsiveGrid Component
 * Flexible grid component utilizing the responsive-grid.css system
 */

import React, { useMemo, ReactNode } from 'react';
import { BaseComponentProps } from '../types/BaseComponent';
import { smartMemo } from '../performance/PerformanceOptimizer';

// =========================
// TYPE DEFINITIONS
// =========================

export interface ResponsiveGridProps extends BaseComponentProps {
  /** Number of columns for different breakpoints */
  cols?: {
    /** Extra small devices (<640px) */
    xs?: number;
    /** Small devices (≥640px) */
    sm?: number;
    /** Medium devices (≥768px) */
    md?: number;
    /** Large devices (≥1024px) */
    lg?: number;
    /** Extra large devices (≥1280px) */
    xl?: number;
    /** 2X large devices (≥1536px) */
    '2xl'?: number;
  };

  /** Default number of columns */
  defaultCols?: number;

  /** Number of rows */
  rows?: number;

  /** Grid gap size */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

  /** Gap between columns only */
  gapX?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

  /** Gap between rows only */
  gapY?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

  /** Grid auto-flow direction */
  flow?: 'row' | 'col' | 'dense' | 'row-dense' | 'col-dense';

  /** Grid template areas for named grid layout */
  areas?: string[];

  /** Auto-fit/auto-fill behavior */
  autoFit?: boolean;
  autoFill?: boolean;

  /** Minimum item width for auto-fit/auto-fill */
  minItemWidth?: string;

  /** Maximum item width for auto-fit/auto-fill */
  maxItemWidth?: string;

  /** Alignment properties */
  alignItems?: 'start' | 'end' | 'center' | 'stretch';
  justifyItems?: 'start' | 'end' | 'center' | 'stretch';
  alignContent?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'stretch';
  justifyContent?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';

  /** Place items shorthand */
  placeItems?: 'start' | 'end' | 'center' | 'stretch';
  placeContent?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'stretch';

  /** Enable masonry layout */
  masonry?: boolean;

  /** Dense grid packing */
  dense?: boolean;

  /** Container element type */
  as?: keyof JSX.IntrinsicElements;

  /** Children elements */
  children: ReactNode;

  /** Performance optimization */
  enableGPUAcceleration?: boolean;
  containment?: boolean;
}

export interface GridItemProps extends BaseComponentProps {
  /** Column span */
  colSpan?: number | 'full';

  /** Row span */
  rowSpan?: number | 'full';

  /** Column start position */
  colStart?: number;

  /** Column end position */
  colEnd?: number;

  /** Row start position */
  rowStart?: number;

  /** Row end position */
  rowEnd?: number;

  /** Grid area name (for named grid layouts) */
  area?: string;

  /** Self alignment */
  alignSelf?: 'start' | 'end' | 'center' | 'stretch';
  justifySelf?: 'start' | 'end' | 'center' | 'stretch';
  placeSelf?: 'start' | 'end' | 'center' | 'stretch';

  /** Responsive column spans */
  colSpanResponsive?: {
    xs?: number | 'full';
    sm?: number | 'full';
    md?: number | 'full';
    lg?: number | 'full';
    xl?: number | 'full';
    '2xl'?: number | 'full';
  };

  /** Element type */
  as?: keyof JSX.IntrinsicElements;

  /** Children */
  children: ReactNode;
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Convert gap value to CSS class or custom property
 */
const getGapClass = (gap: ResponsiveGridProps['gap']): string => {
  if (typeof gap === 'number') {
    return `gap-[${gap}px]`;
  }

  const gapMap = {
    none: 'gap-0',
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  };

  return gap ? gapMap[gap] || 'gap-4' : 'gap-4';
};

/**
 * Get responsive column classes
 */
const getResponsiveColClasses = (cols: ResponsiveGridProps['cols'], defaultCols: number = 12): string[] => {
  const classes: string[] = [];

  if (cols?.xs) classes.push(`grid-cols-${cols.xs}`);
  if (cols?.sm) classes.push(`sm:grid-cols-${cols.sm}`);
  if (cols?.md) classes.push(`md:grid-cols-${cols.md}`);
  if (cols?.lg) classes.push(`lg:grid-cols-${cols.lg}`);
  if (cols?.xl) classes.push(`xl:grid-cols-${cols.xl}`);
  if (cols?.['2xl']) classes.push(`2xl:grid-cols-${cols['2xl']}`);

  // Add default if no responsive classes
  if (classes.length === 0) {
    classes.push(`grid-cols-${defaultCols}`);
  }

  return classes;
};

/**
 * Get auto-fit/auto-fill template
 */
const getAutoTemplate = (
  autoFit: boolean = false,
  autoFill: boolean = false,
  minWidth: string = '250px',
  maxWidth: string = '1fr'
): React.CSSProperties => {
  if (autoFit) {
    return {
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, ${maxWidth}))`
    };
  }

  if (autoFill) {
    return {
      gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, ${maxWidth}))`
    };
  }

  return {};
};

/**
 * Get grid areas CSS
 */
const getGridAreas = (areas: string[]): React.CSSProperties => {
  if (!areas || areas.length === 0) return {};

  return {
    gridTemplateAreas: areas.map(area => `"${area}"`).join(' ')
  };
};

// =========================
// RESPONSIVE GRID COMPONENT
// =========================

export const ResponsiveGrid = smartMemo<ResponsiveGridProps>(
  ({
    cols,
    defaultCols = 12,
    rows,
    gap = 'md',
    gapX,
    gapY,
    flow = 'row',
    areas,
    autoFit = false,
    autoFill = false,
    minItemWidth = '250px',
    maxItemWidth = '1fr',
    alignItems,
    justifyItems,
    alignContent,
    justifyContent,
    placeItems,
    placeContent,
    masonry = false,
    dense = false,
    as: Element = 'div',
    enableGPUAcceleration = false,
    containment = true,
    className = '',
    style,
    children,
    'data-testid': testId,
    ...restProps
  }) => {
    // Build CSS classes
    const gridClasses = useMemo(() => {
      const classes = ['grid'];

      // Base responsive columns
      if (!autoFit && !autoFill && !areas) {
        classes.push(...getResponsiveColClasses(cols, defaultCols));
      }

      // Rows
      if (rows) {
        classes.push(`grid-rows-${rows}`);
      }

      // Gap handling
      if (gapX !== undefined && gapY !== undefined) {
        classes.push(getGapClass(gapX).replace('gap-', 'gap-x-'));
        classes.push(getGapClass(gapY).replace('gap-', 'gap-y-'));
      } else {
        classes.push(getGapClass(gap));
      }

      // Grid flow
      const flowMap = {
        row: 'grid-flow-row',
        col: 'grid-flow-col',
        dense: 'grid-flow-dense',
        'row-dense': 'grid-flow-row-dense',
        'col-dense': 'grid-flow-col-dense'
      };
      classes.push(flowMap[flow]);

      // Alignment classes
      if (alignItems) classes.push(`align-items-${alignItems}`);
      if (justifyItems) classes.push(`justify-items-${justifyItems}`);
      if (alignContent) classes.push(`align-${alignContent}`);
      if (justifyContent) classes.push(`justify-${justifyContent}`);
      if (placeItems) classes.push(`place-items-${placeItems}`);
      if (placeContent) classes.push(`place-content-${placeContent}`);

      // Special layouts
      if (masonry) classes.push('grid-masonry');
      if (dense) classes.push('grid-dense');

      // Performance optimizations
      if (containment) classes.push('grid-container');
      if (enableGPUAcceleration) classes.push('gpu-optimized');

      return className ? `${classes.join(' ')} ${className}` : classes.join(' ');
    }, [
      cols,
      defaultCols,
      rows,
      gap,
      gapX,
      gapY,
      flow,
      alignItems,
      justifyItems,
      alignContent,
      justifyContent,
      placeItems,
      placeContent,
      masonry,
      dense,
      containment,
      enableGPUAcceleration,
      className,
      autoFit,
      autoFill,
      areas
    ]);

    // Build inline styles
    const gridStyles = useMemo(() => ({
      ...style,
      ...getAutoTemplate(autoFit, autoFill, minItemWidth, maxItemWidth),
      ...getGridAreas(areas || [])
    }), [style, autoFit, autoFill, minItemWidth, maxItemWidth, areas]);

    return (
      <Element
        className={gridClasses}
        style={gridStyles}
        data-testid={testId}
        data-grid-type={masonry ? 'masonry' : autoFit ? 'auto-fit' : autoFill ? 'auto-fill' : 'standard'}
        {...restProps}
      >
        {children}
      </Element>
    );
  },
  {
    compareProps: ['cols', 'defaultCols', 'gap', 'flow', 'masonry', 'dense'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

ResponsiveGrid.displayName = 'ResponsiveGrid';

// =========================
// GRID ITEM COMPONENT
// =========================

export const GridItem = smartMemo<GridItemProps>(
  ({
    colSpan,
    rowSpan,
    colStart,
    colEnd,
    rowStart,
    rowEnd,
    area,
    alignSelf,
    justifySelf,
    placeSelf,
    colSpanResponsive,
    as: Element = 'div',
    className = '',
    style,
    children,
    'data-testid': testId,
    ...restProps
  }) => {
    // Build CSS classes
    const itemClasses = useMemo(() => {
      const classes = ['grid-item'];

      // Column span
      if (colSpan) {
        const span = colSpan === 'full' ? 'full' : colSpan;
        classes.push(`col-span-${span}`);
      }

      // Row span
      if (rowSpan) {
        const span = rowSpan === 'full' ? 'full' : rowSpan;
        classes.push(`row-span-${span}`);
      }

      // Responsive column spans
      if (colSpanResponsive) {
        Object.entries(colSpanResponsive).forEach(([breakpoint, span]) => {
          if (span !== undefined) {
            const spanValue = span === 'full' ? 'full' : span;
            const prefix = breakpoint === 'xs' ? '' : `${breakpoint}:`;
            classes.push(`${prefix}col-span-${spanValue}`);
          }
        });
      }

      // Explicit positioning
      if (colStart) classes.push(`col-start-${colStart}`);
      if (colEnd) classes.push(`col-end-${colEnd}`);
      if (rowStart) classes.push(`row-start-${rowStart}`);
      if (rowEnd) classes.push(`row-end-${rowEnd}`);

      // Self alignment
      if (alignSelf) classes.push(`self-${alignSelf}`);
      if (justifySelf) classes.push(`justify-self-${justifySelf}`);
      if (placeSelf) classes.push(`place-self-${placeSelf}`);

      return className ? `${classes.join(' ')} ${className}` : classes.join(' ');
    }, [
      colSpan,
      rowSpan,
      colStart,
      colEnd,
      rowStart,
      rowEnd,
      alignSelf,
      justifySelf,
      placeSelf,
      colSpanResponsive,
      className
    ]);

    // Build inline styles
    const itemStyles = useMemo(() => ({
      ...style,
      ...(area && { gridArea: area })
    }), [style, area]);

    return (
      <Element
        className={itemClasses}
        style={itemStyles}
        data-testid={testId}
        data-grid-area={area}
        {...restProps}
      >
        {children}
      </Element>
    );
  },
  {
    compareProps: ['colSpan', 'rowSpan', 'area', 'colSpanResponsive'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

GridItem.displayName = 'GridItem';

// =========================
// SPECIALIZED GRID VARIANTS
// =========================

export const AutoFitGrid: React.FC<Omit<ResponsiveGridProps, 'autoFit'>> = (props) => (
  <ResponsiveGrid autoFit {...props} />
);

export const AutoFillGrid: React.FC<Omit<ResponsiveGridProps, 'autoFill'>> = (props) => (
  <ResponsiveGrid autoFill {...props} />
);

export const MasonryGrid: React.FC<Omit<ResponsiveGridProps, 'masonry'>> = (props) => (
  <ResponsiveGrid masonry {...props} />
);

export const DenseGrid: React.FC<Omit<ResponsiveGridProps, 'dense'>> = (props) => (
  <ResponsiveGrid dense {...props} />
);

// =========================
// UTILITY COMPONENTS
// =========================

/**
 * Grid container with predefined layouts
 */
export const GridContainer: React.FC<{
  layout: 'sidebar' | 'dashboard' | 'metrics' | 'cards';
  children: ReactNode;
  className?: string;
}> = ({ layout, children, className = '' }) => {
  const layoutConfigs = {
    sidebar: { cols: { md: 1, lg: 4 }, areas: ['sidebar main main main'] },
    dashboard: { autoFit: true, minItemWidth: '300px', gap: 'lg' },
    metrics: { autoFit: true, minItemWidth: '250px', gap: 'md' },
    cards: { cols: { xs: 1, sm: 2, lg: 3, xl: 4 }, gap: 'md' }
  };

  const config = layoutConfigs[layout];

  return (
    <ResponsiveGrid className={className} {...config}>
      {children}
    </ResponsiveGrid>
  );
};

export default ResponsiveGrid;