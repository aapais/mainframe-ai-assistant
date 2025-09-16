/**
 * Custom Hooks for Mainframe KB Assistant
 *
 * Responsive utilities and layout management hooks optimized for Electron
 */

// =========================
// RESPONSIVE HOOKS
// =========================

export {
  useResponsive,
  type BreakpointConfig,
  type BreakpointKey,
  type DeviceInfo,
  type ResponsiveHookOptions,
  type ResponsiveHookReturn,
} from './useResponsive';

export {
  useMediaQuery,
  useDarkMode,
  useReducedMotion,
  useHighContrast,
  useHover,
  useFinePointer,
  useLandscape,
  usePortrait,
  useSmallScreen,
  useMediumScreen,
  useLargeScreen,
  useExtraLargeScreen,
  useMediaQueries,
  usePrint,
  useScreenReader,
  type MediaQueryOptions,
  type MediaQueryResult,
} from './useMediaQuery';

export {
  useResizeObserver,
  useWidthObserver,
  useHeightObserver,
  useBoundsObserver,
  useSignificantResize,
  type ResizeObserverEntry,
  type ElementSize,
  type UseResizeObserverOptions,
  type UseResizeObserverReturn,
} from './useResizeObserver';

// =========================
// LAYOUT HOOKS
// =========================

export {
  useGridLayout,
  useSimpleGridLayout,
  useMasonryLayout,
  type GridItem,
  type GridLayoutConfig,
  type GridLayoutState,
  type UseGridLayoutOptions,
  type UseGridLayoutReturn,
} from './useGridLayout';

export {
  useDensity,
  useDensityContext,
  useScaledSpacing,
  useResponsiveSize,
  useTouchTarget,
  DensityProvider,
  DensityContext,
  type DensityMode,
  type DensitySettings,
  type DensityBreakpoints,
  type UseDensityOptions,
  type UseDensityReturn,
  type DensityContextValue,
  type DensityProviderProps,
} from './useDensity';

export {
  useLayoutState,
  type LayoutConfig,
  type PanelConfig,
  type GridConfig,
  type LayoutStateOptions,
  type UseLayoutStateReturn,
} from './useLayoutState';

// =========================
// HOOK COMBINATIONS
// =========================

/**
 * Combined responsive layout hook
 * Provides comprehensive layout utilities
 */
export const useResponsiveLayout = (options: {
  /** Enable grid layout management */
  enableGrid?: boolean;
  /** Enable density management */
  enableDensity?: boolean;
  /** Enable layout persistence */
  enablePersistence?: boolean;
  /** Grid configuration */
  gridConfig?: any;
  /** Density options */
  densityOptions?: any;
  /** Layout state options */
  layoutOptions?: any;
} = {}) => {
  const {
    enableGrid = true,
    enableDensity = true,
    enablePersistence = false,
    gridConfig = {},
    densityOptions = {},
    layoutOptions = {},
  } = options;

  // Responsive utilities
  const responsive = useResponsive();

  // Optional hooks based on configuration
  const grid = enableGrid ? useGridLayout(gridConfig) : null;
  const density = enableDensity ? useDensity(densityOptions) : null;
  const layoutState = enablePersistence ? useLayoutState(layoutOptions) : null;

  return {
    responsive,
    grid,
    density,
    layoutState,
    // Convenience getters
    get breakpoint() {
      return responsive.breakpoint;
    },
    get device() {
      return responsive.device;
    },
    get isMobile() {
      return responsive.device.isMobile;
    },
    get isDesktop() {
      return responsive.device.isDesktop;
    },
  };
};

// =========================
// HOOK UTILITIES
// =========================

/**
 * Utility function to check if all required hooks are available
 */
export const checkHookSupport = () => {
  const support = {
    mediaQueries: typeof window !== 'undefined' && 'matchMedia' in window,
    resizeObserver: typeof window !== 'undefined' && 'ResizeObserver' in window,
    localStorage: typeof window !== 'undefined' && 'localStorage' in window,
    devicePixelRatio: typeof window !== 'undefined' && 'devicePixelRatio' in window,
  };

  const allSupported = Object.values(support).every(Boolean);

  return {
    ...support,
    allSupported,
    warnings: allSupported ? [] : [
      !support.mediaQueries && 'MediaQuery API not supported',
      !support.resizeObserver && 'ResizeObserver API not supported',
      !support.localStorage && 'localStorage not available',
      !support.devicePixelRatio && 'devicePixelRatio not available',
    ].filter(Boolean),
  };
};

/**
 * Debug utility for responsive hooks
 */
export const useResponsiveDebug = (enabled: boolean = false) => {
  const responsive = useResponsive();
  const mediaQuery = useMediaQuery('(min-width: 768px)');
  const density = useDensity();

  if (enabled && typeof window !== 'undefined') {
    // Add debug info to window for development
    (window as any).responsiveDebug = {
      responsive,
      mediaQuery,
      density,
      timestamp: Date.now(),
    };

    console.group('🔧 Responsive Debug Info');
    console.log('Breakpoint:', responsive.breakpoint);
    console.log('Device:', responsive.device);
    console.log('Media Query (md+):', mediaQuery.matches);
    console.log('Density:', density.density.mode);
    console.log('Support:', checkHookSupport());
    console.groupEnd();
  }

  return {
    responsive,
    mediaQuery,
    density,
    support: checkHookSupport(),
  };
};

// =========================
// DEFAULT EXPORT
// =========================

/**
 * Main responsive hook combining all utilities
 * Recommended for most use cases
 */
export default useResponsiveLayout;