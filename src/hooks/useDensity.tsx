/**
 * useDensity Hook
 *
 * Density mode management for responsive UI scaling
 * Provides comfortable, compact, and dense layout modes
 */

import React, { useState, useEffect, useCallback, useMemo, useContext, createContext } from 'react';
import { useResponsive, BreakpointKey } from './useResponsive';
import { useMediaQuery } from './useMediaQuery';

// =========================
// TYPE DEFINITIONS
// =========================

export type DensityMode = 'comfortable' | 'compact' | 'dense';

export interface DensitySettings {
  /** Current density mode */
  mode: DensityMode;
  /** Scale factor for spacing */
  spacingScale: number;
  /** Scale factor for font sizes */
  fontScale: number;
  /** Scale factor for component sizes */
  componentScale: number;
  /** Minimum touch target size */
  minTouchTarget: number;
  /** Grid gap scaling */
  gridGapScale: number;
  /** Whether to use dense mode on mobile */
  denseMobile: boolean;
  /** Auto-switch based on screen size */
  autoSwitch: boolean;
}

export interface DensityBreakpoints {
  /** Density settings per breakpoint */
  [key: string]: Partial<DensitySettings>;
}

export interface UseDensityOptions {
  /** Initial density mode */
  initialMode?: DensityMode;
  /** Enable auto-switching based on screen size */
  autoSwitch?: boolean;
  /** Custom breakpoint settings */
  breakpoints?: DensityBreakpoints;
  /** Persist density preference */
  persist?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
  /** Enable system preference detection */
  respectSystemPrefs?: boolean;
  /** Callback when density changes */
  onChange?: (settings: DensitySettings) => void;
}

export interface UseDensityReturn {
  /** Current density settings */
  density: DensitySettings;
  /** Set density mode */
  setMode: (mode: DensityMode) => void;
  /** Toggle between modes */
  toggleMode: () => void;
  /** Get scaled value */
  scale: (value: number, type?: 'spacing' | 'font' | 'component') => number;
  /** Get CSS custom properties */
  cssVars: Record<string, string>;
  /** Check if touch-friendly */
  isTouchFriendly: boolean;
  /** Available modes */
  availableModes: DensityMode[];
}

// =========================
// DENSITY CONFIGURATIONS
// =========================

const DENSITY_CONFIGS: Record<DensityMode, DensitySettings> = {
  comfortable: {
    mode: 'comfortable',
    spacingScale: 1.0,
    fontScale: 1.0,
    componentScale: 1.0,
    minTouchTarget: 44,
    gridGapScale: 1.0,
    denseMobile: false,
    autoSwitch: false,
  },
  compact: {
    mode: 'compact',
    spacingScale: 0.75,
    fontScale: 0.9,
    componentScale: 0.9,
    minTouchTarget: 40,
    gridGapScale: 0.75,
    denseMobile: true,
    autoSwitch: false,
  },
  dense: {
    mode: 'dense',
    spacingScale: 0.5,
    fontScale: 0.85,
    componentScale: 0.8,
    minTouchTarget: 36,
    gridGapScale: 0.5,
    denseMobile: true,
    autoSwitch: false,
  },
};

const DEFAULT_BREAKPOINTS: DensityBreakpoints = {
  xs: { mode: 'compact', autoSwitch: true },
  sm: { mode: 'compact', autoSwitch: true },
  md: { mode: 'comfortable', autoSwitch: true },
  lg: { mode: 'comfortable', autoSwitch: false },
  xl: { mode: 'comfortable', autoSwitch: false },
  '2xl': { mode: 'comfortable', autoSwitch: false },
};

// =========================
// CONTEXT FOR DENSITY
// =========================

export interface DensityContextValue {
  density: DensitySettings;
  setMode: (mode: DensityMode) => void;
  scale: (value: number, type?: 'spacing' | 'font' | 'component') => number;
}

export const DensityContext = createContext<DensityContextValue | null>(null);

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Get density preference from localStorage
 */
const getDensityFromStorage = (key: string): DensityMode | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(key);
    if (stored && ['comfortable', 'compact', 'dense'].includes(stored)) {
      return stored as DensityMode;
    }
  } catch {
    // Ignore storage errors
  }

  return null;
};

/**
 * Save density preference to localStorage
 */
const saveDensityToStorage = (key: string, mode: DensityMode): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, mode);
  } catch {
    // Ignore storage errors
  }
};

/**
 * Detect system density preference
 */
const getSystemDensityPreference = (): DensityMode => {
  // Check for system hints about density preferences
  if (typeof window === 'undefined') return 'comfortable';

  // Check device pixel ratio (high DPI = potentially prefer dense)
  const dpr = window.devicePixelRatio || 1;

  // Check available screen space
  const screenArea = window.screen.width * window.screen.height;
  const viewportArea = window.innerWidth * window.innerHeight;

  // Heuristics for density preference
  if (dpr >= 2 && screenArea > 2000000) {
    return 'dense'; // High DPI with large screen
  }

  if (viewportArea < 500000) {
    return 'compact'; // Small viewport
  }

  return 'comfortable';
};

/**
 * Calculate automatic density mode based on breakpoint
 */
const getAutoDensityMode = (
  breakpoint: BreakpointKey,
  breakpoints: DensityBreakpoints,
  isTouchDevice: boolean
): DensityMode => {
  const breakpointConfig = breakpoints[breakpoint];

  if (breakpointConfig?.mode) {
    return breakpointConfig.mode;
  }

  // Default auto-switching logic
  if (breakpoint === 'xs' || breakpoint === 'sm') {
    return isTouchDevice ? 'compact' : 'dense';
  }

  return 'comfortable';
};

// =========================
// MAIN HOOK
// =========================

/**
 * useDensity Hook
 *
 * Manages UI density modes with responsive behavior
 *
 * @param options - Configuration options
 * @returns Density utilities and settings
 *
 * @example
 * ```tsx
 * const { density, setMode, scale, cssVars } = useDensity({
 *   autoSwitch: true,
 *   persist: true,
 *   onChange: (settings) => console.log('Density changed:', settings.mode)
 * });
 *
 * // Apply CSS variables
 * <div style={cssVars}>
 *   <Button padding={scale(16, 'spacing')}>
 *     Scaled Button
 *   </Button>
 * </div>
 * ```
 */
export const useDensity = (options: UseDensityOptions = {}): UseDensityReturn => {
  const {
    initialMode,
    autoSwitch = false,
    breakpoints = DEFAULT_BREAKPOINTS,
    persist = true,
    storageKey = 'mainframe-kb-density',
    respectSystemPrefs = true,
    onChange,
  } = options;

  // Responsive utilities
  const { device, breakpoint } = useResponsive();

  // Media queries for system preferences
  const { matches: prefersReducedData } = useMediaQuery('(prefers-reduced-data: reduce)', {
    defaultValue: false,
  });

  const { matches: prefersReducedMotion } = useMediaQuery('(prefers-reduced-motion: reduce)', {
    defaultValue: false,
  });

  // Initialize mode
  const [mode, setModeState] = useState<DensityMode>(() => {
    if (persist) {
      const stored = getDensityFromStorage(storageKey);
      if (stored) return stored;
    }

    if (initialMode) return initialMode;

    if (respectSystemPrefs) {
      return getSystemDensityPreference();
    }

    return 'comfortable';
  });

  // Calculate current density settings
  const density = useMemo<DensitySettings>(() => {
    let currentMode = mode;

    // Auto-switch logic
    if (autoSwitch) {
      currentMode = getAutoDensityMode(breakpoint, breakpoints, device.isTouchDevice);
    }

    const baseConfig = DENSITY_CONFIGS[currentMode];
    const breakpointOverrides = breakpoints[breakpoint] || {};

    // Apply system preference adjustments
    let adjustments: Partial<DensitySettings> = {};

    if (prefersReducedData) {
      adjustments = {
        ...adjustments,
        componentScale: Math.min(baseConfig.componentScale, 0.8),
        gridGapScale: Math.min(baseConfig.gridGapScale, 0.75),
      };
    }

    if (prefersReducedMotion) {
      // Keep comfortable spacing for reduced motion
      adjustments = {
        ...adjustments,
        spacingScale: Math.max(baseConfig.spacingScale, 0.8),
      };
    }

    if (device.isTouchDevice) {
      // Ensure minimum touch targets on touch devices
      adjustments = {
        ...adjustments,
        minTouchTarget: Math.max(baseConfig.minTouchTarget, 40),
      };
    }

    return {
      ...baseConfig,
      ...breakpointOverrides,
      ...adjustments,
      mode: currentMode,
    };
  }, [
    mode,
    breakpoint,
    autoSwitch,
    breakpoints,
    device.isTouchDevice,
    prefersReducedData,
    prefersReducedMotion,
  ]);

  // Set mode function
  const setMode = useCallback((newMode: DensityMode) => {
    setModeState(newMode);

    if (persist) {
      saveDensityToStorage(storageKey, newMode);
    }
  }, [persist, storageKey]);

  // Toggle between modes
  const toggleMode = useCallback(() => {
    const modes: DensityMode[] = ['comfortable', 'compact', 'dense'];
    const currentIndex = modes.indexOf(density.mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  }, [density.mode, setMode]);

  // Scaling function
  const scale = useCallback((value: number, type: 'spacing' | 'font' | 'component' = 'spacing'): number => {
    const scaleMap = {
      spacing: density.spacingScale,
      font: density.fontScale,
      component: density.componentScale,
    };

    return value * scaleMap[type];
  }, [density.spacingScale, density.fontScale, density.componentScale]);

  // CSS custom properties
  const cssVars = useMemo(() => {
    return {
      '--density-spacing-scale': density.spacingScale.toString(),
      '--density-font-scale': density.fontScale.toString(),
      '--density-component-scale': density.componentScale.toString(),
      '--density-min-touch-target': `${density.minTouchTarget}px`,
      '--density-grid-gap-scale': density.gridGapScale.toString(),
      '--density-mode': density.mode,

      // Common scaled values
      '--density-spacing-xs': `${scale(4, 'spacing')}px`,
      '--density-spacing-sm': `${scale(8, 'spacing')}px`,
      '--density-spacing-md': `${scale(16, 'spacing')}px`,
      '--density-spacing-lg': `${scale(24, 'spacing')}px`,
      '--density-spacing-xl': `${scale(32, 'spacing')}px`,

      '--density-font-xs': `${scale(12, 'font')}px`,
      '--density-font-sm': `${scale(14, 'font')}px`,
      '--density-font-md': `${scale(16, 'font')}px`,
      '--density-font-lg': `${scale(18, 'font')}px`,
      '--density-font-xl': `${scale(24, 'font')}px`,

      '--density-grid-gap': `${scale(16, 'spacing')}px`,
    };
  }, [density, scale]);

  // Touch-friendly check
  const isTouchFriendly = useMemo(() => {
    return density.minTouchTarget >= 40 && density.spacingScale >= 0.75;
  }, [density.minTouchTarget, density.spacingScale]);

  // Available modes (might be filtered based on context)
  const availableModes: DensityMode[] = useMemo(() => {
    const modes: DensityMode[] = ['comfortable', 'compact', 'dense'];

    // Filter out dense mode on very small screens if it would be unusable
    if (device.width < 320) {
      return modes.filter(m => m !== 'dense');
    }

    return modes;
  }, [device.width]);

  // Effect for onChange callback
  useEffect(() => {
    onChange?.(density);
  }, [density, onChange]);

  return {
    density,
    setMode,
    toggleMode,
    scale,
    cssVars,
    isTouchFriendly,
    availableModes,
  };
};

// =========================
// DENSITY PROVIDER COMPONENT
// =========================

export interface DensityProviderProps {
  children: React.ReactNode;
  options?: UseDensityOptions;
}

export const DensityProvider: React.FC<DensityProviderProps> = ({
  children,
  options = {},
}) => {
  const { density, setMode, scale } = useDensity(options);

  const contextValue: DensityContextValue = {
    density,
    setMode,
    scale,
  };

  return (
    <DensityContext.Provider value={contextValue}>
      <div style={density as any} className={`density-${density.mode}`}>
        {children}
      </div>
    </DensityContext.Provider>
  );
};

// =========================
// CONTEXT HOOK
// =========================

/**
 * Hook to consume density context
 */
export const useDensityContext = (): DensityContextValue => {
  const context = useContext(DensityContext);

  if (!context) {
    throw new Error('useDensityContext must be used within a DensityProvider');
  }

  return context;
};

// =========================
// CONVENIENCE HOOKS
// =========================

/**
 * Hook for scaled spacing values
 */
export const useScaledSpacing = (baseSpacing: number = 16) => {
  const { scale } = useDensity();

  return useMemo(() => ({
    xs: scale(baseSpacing * 0.25, 'spacing'),
    sm: scale(baseSpacing * 0.5, 'spacing'),
    md: scale(baseSpacing, 'spacing'),
    lg: scale(baseSpacing * 1.5, 'spacing'),
    xl: scale(baseSpacing * 2, 'spacing'),
    '2xl': scale(baseSpacing * 3, 'spacing'),
  }), [scale, baseSpacing]);
};

/**
 * Hook for responsive component sizing
 */
export const useResponsiveSize = (baseSize: { width?: number; height?: number }) => {
  const { scale } = useDensity();

  return useMemo(() => ({
    width: baseSize.width ? scale(baseSize.width, 'component') : undefined,
    height: baseSize.height ? scale(baseSize.height, 'component') : undefined,
  }), [scale, baseSize.width, baseSize.height]);
};

/**
 * Hook for density-aware touch targets
 */
export const useTouchTarget = (minSize: number = 44) => {
  const { density } = useDensity();

  return useMemo(() => {
    return Math.max(minSize, density.minTouchTarget);
  }, [minSize, density.minTouchTarget]);
};

export default useDensity;