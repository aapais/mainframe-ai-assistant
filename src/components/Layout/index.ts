/**
 * Layout Components - Optimized Responsive System
 *
 * Export all layout components and utilities for the mainframe AI assistant.
 * This module provides performance-optimized, accessible, and responsive
 * layout components built with modern CSS features.
 *
 * @version 3.0.0
 * @performance Optimized for 60fps layout transitions
 */

// =========================
// CORE LAYOUT COMPONENTS
// =========================

export {
  OptimizedResponsiveGrid,
  GridItem,
  AutoFitGrid,
  DenseGrid,
  MasonryGrid,
  DashboardGrid,
  CardGrid,
  MetricsGrid,
  type OptimizedResponsiveGridProps,
  type GridItemProps,
} from './OptimizedResponsiveGrid';

export {
  FluidContainer,
  ArticleContainer,
  SectionContainer,
  ContentContainer,
  BreakoutContainer,
  AspectContainer,
  type FluidContainerProps,
} from './FluidContainer';

export {
  ResponsiveTable,
  type ResponsiveTableProps,
  type TableColumn,
} from './ResponsiveTable';

export {
  AdaptiveNavigation,
  TabNavigation,
  BreadcrumbNavigation,
  PaginationNavigation,
  type AdaptiveNavigationProps,
  type NavigationItem,
} from './AdaptiveNavigation';

export {
  ResponsiveCard,
  MediaCard,
  ActionCard,
  CompactCard,
  FeatureCard,
  AspectCard,
  type ResponsiveCardProps,
} from './ResponsiveCard';

// =========================
// LEGACY COMPONENTS (for compatibility)
// =========================

export {
  ResponsiveGrid,
  GridItem as LegacyGridItem,
  GridContainer,
  type ResponsiveGridProps as LegacyResponsiveGridProps,
  type GridItemProps as LegacyGridItemProps,
} from './ResponsiveGrid';

export {
  LayoutPanel,
  CollapsiblePanel,
  ResizablePanel,
  SidePanel,
  InfoPanel,
  type LayoutPanelProps,
} from './LayoutPanel';

// =========================
// LAYOUT UTILITIES
// =========================

/**
 * Common layout patterns and presets
 */
export const LayoutPresets = {
  // Grid presets
  DASHBOARD_GRID: {
    autoFit: true,
    minItemWidth: '320px',
    gap: 'lg',
    enableGPU: true,
  },
  CARD_GRID: {
    cols: { xs: 1, sm: 2, md: 3, lg: 4 },
    gap: 'md',
  },
  METRICS_GRID: {
    autoFit: true,
    minItemWidth: '250px',
    gap: 'sm',
    dense: true,
  },

  // Container presets
  ARTICLE_CONTAINER: {
    size: 'prose' as const,
    padding: 'responsive' as const,
    margin: 'lg' as const,
  },
  CONTENT_CONTAINER: {
    size: 'lg' as const,
    padding: 'md' as const,
    margin: 'auto' as const,
  },

  // Navigation presets
  HEADER_NAVIGATION: {
    variant: 'horizontal' as const,
    size: 'md' as const,
    sticky: true,
    enableCollapse: true,
  },
  SIDEBAR_NAVIGATION: {
    variant: 'vertical' as const,
    size: 'sm' as const,
  },

  // Table presets
  DATA_TABLE: {
    virtualScrolling: true,
    stickyHeader: true,
    mobileLayout: 'cards' as const,
  },

  // Card presets
  FEATURE_CARD: {
    variant: 'elevated' as const,
    hoverEffect: 'lift' as const,
    aspectRatio: 'video' as const,
  },
  COMPACT_CARD: {
    size: 'sm' as const,
    padding: 'sm' as const,
  },
} as const;

// =========================
// PERFORMANCE UTILITIES
// =========================

export const PerformanceUtils = {
  /**
   * Measure layout performance
   */
  measureLayout: async (callback: () => void | Promise<void>) => {
    const startTime = performance.now();
    await callback();
    const endTime = performance.now();
    return endTime - startTime;
  },

  /**
   * Monitor layout shifts
   */
  observeLayoutShifts: (callback: (shifts: number[]) => void) => {
    const shifts: number[] = [];
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.entryType === 'layout-shift') {
          shifts.push((entry as any).value);
        }
      }
      callback(shifts);
    });

    observer.observe({ entryTypes: ['layout-shift'] });
    return () => observer.disconnect();
  },

  /**
   * Check for container query support
   */
  supportsContainerQueries: () => {
    return CSS.supports('container-type: inline-size');
  },

  /**
   * Check for CSS containment support
   */
  supportsContainment: () => {
    return CSS.supports('contain: layout');
  },

  /**
   * Check for aspect-ratio support
   */
  supportsAspectRatio: () => {
    return CSS.supports('aspect-ratio: 1');
  },
} as const;

// =========================
// TYPE DEFINITIONS
// =========================

export type LayoutSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type LayoutGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export type LayoutPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'responsive';
export type LayoutMargin = 'none' | 'auto' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LayoutContainment = 'layout' | 'style' | 'paint' | 'strict' | 'none';
export type LayoutAspectRatio = 'square' | 'video' | 'wide' | 'portrait' | 'golden' | number | string;

export interface LayoutComponent {
  /** Component size variant */
  size?: LayoutSize;
  /** Gap between elements */
  gap?: LayoutGap;
  /** Padding configuration */
  padding?: LayoutPadding;
  /** Margin configuration */
  margin?: LayoutMargin;
  /** CSS containment level */
  containment?: LayoutContainment;
  /** Enable GPU acceleration */
  enableGPU?: boolean;
  /** Container query name */
  containerName?: string;
  /** Custom CSS className */
  className?: string;
}

// =========================
// DEFAULT EXPORTS
// =========================

export default {
  OptimizedResponsiveGrid,
  FluidContainer,
  ResponsiveTable,
  AdaptiveNavigation,
  ResponsiveCard,
  LayoutPresets,
  PerformanceUtils,
};