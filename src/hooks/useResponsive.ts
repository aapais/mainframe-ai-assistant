/**
 * useResponsive Hook
 *
 * Detects current breakpoint and provides device information
 * Optimized for Electron environment with debouncing and performance optimizations
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

// =========================
// TYPE DEFINITIONS
// =========================

export interface BreakpointConfig {
  /** Extra small devices (<640px) */
  xs: number;
  /** Small devices (≥640px) */
  sm: number;
  /** Medium devices (≥768px) */
  md: number;
  /** Large devices (≥1024px) */
  lg: number;
  /** Extra large devices (≥1280px) */
  xl: number;
  /** 2X large devices (≥1536px) */
  '2xl': number;
}

export type BreakpointKey = keyof BreakpointConfig;

export interface DeviceInfo {
  /** Screen width in pixels */
  width: number;
  /** Screen height in pixels */
  height: number;
  /** Current breakpoint */
  breakpoint: BreakpointKey;
  /** Is touch device */
  isTouchDevice: boolean;
  /** Is mobile device (xs or sm) */
  isMobile: boolean;
  /** Is tablet device (md) */
  isTablet: boolean;
  /** Is desktop device (lg, xl, 2xl) */
  isDesktop: boolean;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Is high DPI display */
  isHighDPI: boolean;
  /** Reduced motion preference */
  prefersReducedMotion: boolean;
  /** Dark mode preference */
  prefersDark: boolean;
}

export interface ResponsiveHookOptions {
  /** Custom breakpoints (overrides default) */
  breakpoints?: Partial<BreakpointConfig>;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Enable SSR support */
  ssr?: boolean;
  /** Initial breakpoint for SSR */
  initialBreakpoint?: BreakpointKey;
}

export interface ResponsiveHookReturn {
  /** Current device information */
  device: DeviceInfo;
  /** Current breakpoint */
  breakpoint: BreakpointKey;
  /** Screen dimensions */
  dimensions: { width: number; height: number };
  /** Breakpoint utilities */
  is: Record<BreakpointKey, boolean>;
  /** Above breakpoint utilities */
  above: Record<BreakpointKey, boolean>;
  /** Below breakpoint utilities */
  below: Record<BreakpointKey, boolean>;
  /** Match specific breakpoint */
  matches: (query: string) => boolean;
}

// =========================
// DEFAULT CONFIGURATION
// =========================

const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Get current breakpoint based on width
 */
const getCurrentBreakpoint = (
  width: number,
  breakpoints: BreakpointConfig
): BreakpointKey => {
  const breakpointEntries = Object.entries(breakpoints) as [BreakpointKey, number][];

  // Sort by value descending to find the largest matching breakpoint
  const sorted = breakpointEntries.sort(([, a], [, b]) => b - a);

  for (const [key, value] of sorted) {
    if (width >= value) {
      return key;
    }
  }

  return 'xs';
};

/**
 * Check if user prefers reduced motion
 */
const checkReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Check if user prefers dark mode
 */
const checkDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

/**
 * Check if device supports touch
 */
const checkTouchSupport = (): boolean => {
  if (typeof window === 'undefined') return false;

  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Debounce function for performance optimization
 */
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// =========================
// MAIN HOOK
// =========================

/**
 * useResponsive Hook
 *
 * Provides comprehensive responsive utilities and device information
 *
 * @param options - Configuration options
 * @returns Responsive utilities and device information
 *
 * @example
 * ```tsx
 * const { device, breakpoint, is, above, below } = useResponsive({
 *   debounceMs: 100,
 *   ssr: true,
 *   initialBreakpoint: 'lg'
 * });
 *
 * if (is.mobile) {
 *   // Mobile-specific logic
 * }
 *
 * if (above.md) {
 *   // Desktop+ layout
 * }
 * ```
 */
export const useResponsive = (options: ResponsiveHookOptions = {}): ResponsiveHookReturn => {
  const {
    breakpoints = DEFAULT_BREAKPOINTS,
    debounceMs = 150,
    ssr = true,
    initialBreakpoint = 'lg',
  } = options;

  // Merge custom breakpoints with defaults
  const mergedBreakpoints = useMemo(() => ({
    ...DEFAULT_BREAKPOINTS,
    ...breakpoints,
  }), [breakpoints]);

  // Initialize state with SSR-safe defaults
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        width: mergedBreakpoints[initialBreakpoint],
        height: 768,
      };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  const [deviceInfo, setDeviceInfo] = useState<Omit<DeviceInfo, 'width' | 'height' | 'breakpoint'>>(() => ({
    isTouchDevice: ssr ? false : checkTouchSupport(),
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    isHighDPI: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) > 1 : false,
    prefersReducedMotion: ssr ? false : checkReducedMotion(),
    prefersDark: ssr ? false : checkDarkMode(),
    isMobile: false,
    isTablet: false,
    isDesktop: false,
  }));

  // Memoized device calculations
  const device = useMemo<DeviceInfo>(() => {
    const { width, height } = dimensions;
    const breakpoint = getCurrentBreakpoint(width, mergedBreakpoints);

    const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
    const isTablet = breakpoint === 'md';
    const isDesktop = breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl';

    return {
      ...deviceInfo,
      width,
      height,
      breakpoint,
      isMobile,
      isTablet,
      isDesktop,
    };
  }, [dimensions, deviceInfo, mergedBreakpoints]);

  // Debounced resize handler
  const handleResize = useMemo(
    () => debounce(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setDimensions({ width, height });

      // Update device info that might change
      setDeviceInfo(prev => ({
        ...prev,
        devicePixelRatio: window.devicePixelRatio || 1,
        isHighDPI: (window.devicePixelRatio || 1) > 1,
      }));
    }, debounceMs),
    [debounceMs]
  );

  // Effect for window resize listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Update device info on mount
    setDeviceInfo({
      isTouchDevice: checkTouchSupport(),
      devicePixelRatio: window.devicePixelRatio || 1,
      isHighDPI: (window.devicePixelRatio || 1) > 1,
      prefersReducedMotion: checkReducedMotion(),
      prefersDark: checkDarkMode(),
      isMobile: false,
      isTablet: false,
      isDesktop: false,
    });

    // Set up resize listener
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // Effect for media query listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-color-scheme: dark)'),
    ];

    const handleMediaChange = () => {
      setDeviceInfo(prev => ({
        ...prev,
        prefersReducedMotion: checkReducedMotion(),
        prefersDark: checkDarkMode(),
      }));
    };

    mediaQueries.forEach(mq => {
      if (mq.addEventListener) {
        mq.addEventListener('change', handleMediaChange);
      } else {
        // Fallback for older browsers
        mq.addListener(handleMediaChange);
      }
    });

    return () => {
      mediaQueries.forEach(mq => {
        if (mq.removeEventListener) {
          mq.removeEventListener('change', handleMediaChange);
        } else {
          // Fallback for older browsers
          mq.removeListener(handleMediaChange);
        }
      });
    };
  }, []);

  // Breakpoint utilities
  const is = useMemo(() => {
    const result = {} as Record<BreakpointKey, boolean>;
    Object.keys(mergedBreakpoints).forEach(key => {
      result[key as BreakpointKey] = device.breakpoint === key;
    });
    return result;
  }, [device.breakpoint, mergedBreakpoints]);

  const above = useMemo(() => {
    const result = {} as Record<BreakpointKey, boolean>;
    Object.entries(mergedBreakpoints).forEach(([key, value]) => {
      result[key as BreakpointKey] = dimensions.width >= value;
    });
    return result;
  }, [dimensions.width, mergedBreakpoints]);

  const below = useMemo(() => {
    const result = {} as Record<BreakpointKey, boolean>;
    Object.entries(mergedBreakpoints).forEach(([key, value]) => {
      result[key as BreakpointKey] = dimensions.width < value;
    });
    return result;
  }, [dimensions.width, mergedBreakpoints]);

  // Custom media query matcher
  const matches = useCallback((query: string): boolean => {
    if (typeof window === 'undefined') return false;

    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  }, []);

  return {
    device,
    breakpoint: device.breakpoint,
    dimensions,
    is,
    above,
    below,
    matches,
  };
};

export default useResponsive;