/**
 * OptimizedResponsiveGrid - Performance-first responsive grid system
 *
 * Features:
 * - CSS Grid with auto-fit and intrinsic sizing
 * - Container queries for component-level responsiveness
 * - CSS containment for performance optimization
 * - Reduced layout thrashing with will-change
 * - CSS logical properties for RTL support
 * - GPU acceleration for smooth transitions
 *
 * @version 3.0.0
 * @performance Optimized for 60fps layout transitions
 */

import React, { forwardRef, useMemo, CSSProperties, HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

// =========================
// TYPES & INTERFACES
// =========================

export interface OptimizedResponsiveGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Auto-fit grid with minimum item width */
  autoFit?: boolean;
  /** Minimum item width for auto-fit/auto-fill */
  minItemWidth?: string;
  /** Maximum item width for auto-fit/auto-fill */
  maxItemWidth?: string;

  /** Fixed column count for different breakpoints */
  cols?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };

  /** Gap size using consistent spacing scale */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

  /** Grid alignment options */
  alignItems?: 'start' | 'end' | 'center' | 'stretch';
  justifyItems?: 'start' | 'end' | 'center' | 'stretch';

  /** Performance optimizations */
  containment?: 'layout' | 'style' | 'paint' | 'strict' | 'none';
  enableGPU?: boolean;

  /** Accessibility enhancements */
  ariaLabel?: string;
  role?: string;

  /** Container query support */
  containerName?: string;

  /** Dense grid packing */
  dense?: boolean;

  /** Masonry layout simulation */
  masonry?: boolean;

  /** Element type */
  as?: keyof JSX.IntrinsicElements;
}

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Column span for different breakpoints */
  colSpan?: {
    xs?: number | 'full';
    sm?: number | 'full';
    md?: number | 'full';
    lg?: number | 'full';
    xl?: number | 'full';
    '2xl'?: number | 'full';
  } | number | 'full';

  /** Row span */
  rowSpan?: number | 'full';

  /** Grid area for named layouts */
  area?: string;

  /** Self alignment */
  alignSelf?: 'start' | 'end' | 'center' | 'stretch';
  justifySelf?: 'start' | 'end' | 'center' | 'stretch';

  /** Performance optimizations */
  containment?: 'layout' | 'style' | 'paint' | 'strict' | 'none';

  /** Element type */
  as?: keyof JSX.IntrinsicElements;
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Generate CSS custom properties for container queries
 */
const generateContainerVariables = (containerName?: string): CSSProperties => {
  if (!containerName) return {};

  return {
    containerName,
    containerType: 'inline-size',
  } as CSSProperties;
};

/**
 * Convert gap size to CSS custom property
 */
const getGapValue = (gap: OptimizedResponsiveGridProps['gap'] = 'md'): string => {
  const gapMap = {
    none: '0',
    xs: 'var(--space-1, 0.25rem)',
    sm: 'var(--space-2, 0.5rem)',
    md: 'var(--space-4, 1rem)',
    lg: 'var(--space-6, 1.5rem)',
    xl: 'var(--space-8, 2rem)',
    xxl: 'var(--space-12, 3rem)',
  };

  return gapMap[gap];
};

/**
 * Generate responsive column classes
 */
const generateResponsiveColumns = (cols?: OptimizedResponsiveGridProps['cols']): string[] => {
  if (!cols) return [];

  const classes: string[] = [];
  const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

  breakpoints.forEach(bp => {
    if (cols[bp]) {
      const prefix = bp === 'xs' ? '' : `${bp}:`;
      classes.push(`${prefix}grid-cols-${cols[bp]}`);
    }
  });

  return classes;
};

/**
 * Generate column span classes for responsive breakpoints
 */
const generateColumnSpans = (colSpan: GridItemProps['colSpan']): string[] => {
  if (typeof colSpan === 'number' || colSpan === 'full') {
    return [`col-span-${colSpan}`];
  }

  if (typeof colSpan === 'object') {
    const classes: string[] = [];
    const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

    breakpoints.forEach(bp => {
      if (colSpan[bp] !== undefined) {
        const prefix = bp === 'xs' ? '' : `${bp}:`;
        classes.push(`${prefix}col-span-${colSpan[bp]}`);
      }
    });

    return classes;
  }

  return [];
};

// =========================
// GRID VARIANTS
// =========================

const gridVariants = cva(
  [
    'grid',
    'contain-layout', // CSS containment for performance
  ],
  {
    variants: {
      alignItems: {
        start: 'items-start',
        end: 'items-end',
        center: 'items-center',
        stretch: 'items-stretch',
      },
      justifyItems: {
        start: 'justify-items-start',
        end: 'justify-items-end',
        center: 'justify-items-center',
        stretch: 'justify-items-stretch',
      },
      containment: {
        layout: 'contain-layout',
        style: 'contain-style',
        paint: 'contain-paint',
        strict: 'contain-strict',
        none: '',
      },
      enableGPU: {
        true: 'gpu-layer',
        false: '',
      },
      dense: {
        true: 'grid-flow-dense',
        false: '',
      },
      masonry: {
        true: 'grid-masonry',
        false: '',
      },
    },
    defaultVariants: {
      alignItems: 'stretch',
      justifyItems: 'stretch',
      containment: 'layout',
      enableGPU: false,
      dense: false,
      masonry: false,
    },
  }
);

const gridItemVariants = cva(
  [
    'grid-item',
    'contain-layout', // CSS containment for performance
  ],
  {
    variants: {
      alignSelf: {
        start: 'self-start',
        end: 'self-end',
        center: 'self-center',
        stretch: 'self-stretch',
      },
      justifySelf: {
        start: 'justify-self-start',
        end: 'justify-self-end',
        center: 'justify-self-center',
        stretch: 'justify-self-stretch',
      },
      containment: {
        layout: 'contain-layout',
        style: 'contain-style',
        paint: 'contain-paint',
        strict: 'contain-strict',
        none: '',
      },
    },
    defaultVariants: {
      alignSelf: 'stretch',
      justifySelf: 'stretch',
      containment: 'layout',
    },
  }
);

// =========================
// MAIN COMPONENTS
// =========================

export const OptimizedResponsiveGrid = forwardRef<HTMLDivElement, OptimizedResponsiveGridProps>(
  ({
    autoFit = false,
    minItemWidth = '250px',
    maxItemWidth = '1fr',
    cols,
    gap = 'md',
    alignItems = 'stretch',
    justifyItems = 'stretch',
    containment = 'layout',
    enableGPU = false,
    ariaLabel,
    role = 'grid',
    containerName,
    dense = false,
    masonry = false,
    as: Component = 'div',
    className = '',
    style,
    children,
    ...props
  }, ref) => {
    // Generate CSS classes
    const gridClasses = useMemo(() => {
      const baseClasses = gridVariants({
        alignItems,
        justifyItems,
        containment,
        enableGPU,
        dense,
        masonry,
      });

      const responsiveClasses = autoFit ? [] : generateResponsiveColumns(cols);

      return [baseClasses, ...responsiveClasses, className].filter(Boolean).join(' ');
    }, [alignItems, justifyItems, containment, enableGPU, dense, masonry, autoFit, cols, className]);

    // Generate inline styles
    const gridStyles = useMemo((): CSSProperties => {
      const baseStyles: CSSProperties = {
        gap: getGapValue(gap),
        ...generateContainerVariables(containerName),
        ...style,
      };

      // Auto-fit grid template
      if (autoFit) {
        baseStyles.gridTemplateColumns = `repeat(auto-fit, minmax(min(${minItemWidth}, 100%), ${maxItemWidth}))`;
      }

      // Performance optimizations
      if (enableGPU) {
        baseStyles.willChange = 'transform';
        baseStyles.transform = 'translateZ(0)';
      }

      return baseStyles;
    }, [gap, containerName, style, autoFit, minItemWidth, maxItemWidth, enableGPU]);

    return (
      <Component
        ref={ref}
        className={gridClasses}
        style={gridStyles}
        role={role}
        aria-label={ariaLabel}
        data-grid-type={autoFit ? 'auto-fit' : 'fixed'}
        data-container={containerName}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

OptimizedResponsiveGrid.displayName = 'OptimizedResponsiveGrid';

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  ({
    colSpan,
    rowSpan,
    area,
    alignSelf = 'stretch',
    justifySelf = 'stretch',
    containment = 'layout',
    as: Component = 'div',
    className = '',
    style,
    children,
    ...props
  }, ref) => {
    // Generate CSS classes
    const itemClasses = useMemo(() => {
      const baseClasses = gridItemVariants({
        alignSelf,
        justifySelf,
        containment,
      });

      const spanClasses = [
        ...generateColumnSpans(colSpan),
        ...(rowSpan ? [`row-span-${rowSpan}`] : []),
      ];

      return [baseClasses, ...spanClasses, className].filter(Boolean).join(' ');
    }, [alignSelf, justifySelf, containment, colSpan, rowSpan, className]);

    // Generate inline styles
    const itemStyles = useMemo((): CSSProperties => ({
      ...style,
      ...(area && { gridArea: area }),
    }), [style, area]);

    return (
      <Component
        ref={ref}
        className={itemClasses}
        style={itemStyles}
        data-grid-area={area}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GridItem.displayName = 'GridItem';

// =========================
// SPECIALIZED VARIANTS
// =========================

export const AutoFitGrid = forwardRef<HTMLDivElement, Omit<OptimizedResponsiveGridProps, 'autoFit'>>(
  (props, ref) => <OptimizedResponsiveGrid ref={ref} autoFit {...props} />
);

AutoFitGrid.displayName = 'AutoFitGrid';

export const DenseGrid = forwardRef<HTMLDivElement, Omit<OptimizedResponsiveGridProps, 'dense'>>(
  (props, ref) => <OptimizedResponsiveGrid ref={ref} dense {...props} />
);

DenseGrid.displayName = 'DenseGrid';

export const MasonryGrid = forwardRef<HTMLDivElement, Omit<OptimizedResponsiveGridProps, 'masonry'>>(
  (props, ref) => <OptimizedResponsiveGrid ref={ref} masonry {...props} />
);

MasonryGrid.displayName = 'MasonryGrid';

// =========================
// LAYOUT PRESETS
// =========================

export const DashboardGrid = forwardRef<HTMLDivElement, Omit<OptimizedResponsiveGridProps, 'autoFit' | 'minItemWidth' | 'containerName'>>(
  (props, ref) => (
    <OptimizedResponsiveGrid
      ref={ref}
      autoFit
      minItemWidth="320px"
      gap="lg"
      containerName="dashboard"
      enableGPU
      {...props}
    />
  )
);

DashboardGrid.displayName = 'DashboardGrid';

export const CardGrid = forwardRef<HTMLDivElement, Omit<OptimizedResponsiveGridProps, 'cols' | 'gap'>>(
  (props, ref) => (
    <OptimizedResponsiveGrid
      ref={ref}
      cols={{ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }}
      gap="md"
      enableGPU
      {...props}
    />
  )
);

CardGrid.displayName = 'CardGrid';

export const MetricsGrid = forwardRef<HTMLDivElement, Omit<OptimizedResponsiveGridProps, 'autoFit' | 'minItemWidth' | 'gap'>>(
  (props, ref) => (
    <OptimizedResponsiveGrid
      ref={ref}
      autoFit
      minItemWidth="280px"
      gap="md"
      dense
      {...props}
    />
  )
);

MetricsGrid.displayName = 'MetricsGrid';

// =========================
// EXPORTS
// =========================

export default OptimizedResponsiveGrid;
export type {
  OptimizedResponsiveGridProps,
  GridItemProps,
};