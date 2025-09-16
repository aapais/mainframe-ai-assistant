/**
 * Performance Optimization System
 * Advanced performance patterns for React components
 */

import React, {
  ComponentType,
  memo,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
  ReactNode,
  MutableRefObject,
  DependencyList
} from 'react';

// =========================
// MEMOIZATION PATTERNS
// =========================

/**
 * Advanced memoization configuration
 */
export interface MemoConfig<TProps = any> {
  /** Properties to compare for memoization */
  compareProps?: (keyof TProps)[];

  /** Properties to ignore in comparison */
  ignoreProps?: (keyof TProps)[];

  /** Custom comparison function */
  customCompare?: (prevProps: TProps, nextProps: TProps) => boolean;

  /** Enable deep comparison */
  deepCompare?: boolean;

  /** Performance monitoring */
  monitor?: boolean;

  /** Component name for debugging */
  displayName?: string;
}

/**
 * Smart memoization HOC with advanced comparison
 */
export function smartMemo<TProps extends object>(
  Component: ComponentType<TProps>,
  config: MemoConfig<TProps> = {}
): ComponentType<TProps> {
  const {
    compareProps,
    ignoreProps,
    customCompare,
    deepCompare = false,
    monitor = false,
    displayName = Component.displayName || Component.name
  } = config;

  const MemoizedComponent = memo(Component, (prevProps, nextProps) => {
    if (customCompare) {
      return customCompare(prevProps, nextProps);
    }

    // Performance monitoring
    let startTime: number;
    if (monitor && process.env.NODE_ENV === 'development') {
      startTime = performance.now();
    }

    let propsToCompare: (keyof TProps)[];

    if (compareProps) {
      propsToCompare = compareProps;
    } else if (ignoreProps) {
      propsToCompare = (Object.keys(nextProps) as (keyof TProps)[])
        .filter(key => !ignoreProps.includes(key));
    } else {
      propsToCompare = Object.keys(nextProps) as (keyof TProps)[];
    }

    const isEqual = propsToCompare.every(key => {
      const prevValue = prevProps[key];
      const nextValue = nextProps[key];

      if (deepCompare && typeof prevValue === 'object' && typeof nextValue === 'object') {
        return deepEqual(prevValue, nextValue);
      }

      return Object.is(prevValue, nextValue);
    });

    if (monitor && process.env.NODE_ENV === 'development') {
      const endTime = performance.now();
      console.log(`🔍 ${displayName} memo comparison: ${endTime - startTime!}ms, equal: ${isEqual}`);
    }

    return isEqual;
  });

  MemoizedComponent.displayName = `SmartMemo(${displayName})`;
  return MemoizedComponent;
}

/**
 * Deep equality comparison utility
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

// =========================
// STABLE REFERENCE HOOKS
// =========================

/**
 * Stable callback hook with dependency optimization
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList = []
): T {
  const callbackRef = useRef<T>(callback);
  const depsRef = useRef<DependencyList>(deps);

  // Update callback if dependencies changed
  if (!depsEqual(depsRef.current, deps)) {
    callbackRef.current = callback;
    depsRef.current = deps;
  }

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}

/**
 * Stable memoized value with performance monitoring
 */
export function useStableMemo<T>(
  factory: () => T,
  deps: DependencyList,
  options: { monitor?: boolean; displayName?: string } = {}
): T {
  const { monitor = false, displayName = 'anonymous' } = options;

  return useMemo(() => {
    let startTime: number;
    if (monitor && process.env.NODE_ENV === 'development') {
      startTime = performance.now();
    }

    const result = factory();

    if (monitor && process.env.NODE_ENV === 'development') {
      const endTime = performance.now();
      console.log(`🧮 ${displayName} memoization: ${endTime - startTime!}ms`);
    }

    return result;
  }, deps);
}

/**
 * Dependencies equality check
 */
function depsEqual(prevDeps: DependencyList, nextDeps: DependencyList): boolean {
  if (prevDeps.length !== nextDeps.length) return false;
  return prevDeps.every((prev, i) => Object.is(prev, nextDeps[i]));
}

// =========================
// VIRTUAL SCROLLING
// =========================

export interface VirtualScrollOptions {
  /** Total number of items */
  itemCount: number;

  /** Height of each item (or function to calculate) */
  itemHeight: number | ((index: number) => number);

  /** Container height */
  containerHeight: number;

  /** Overscan count for smooth scrolling */
  overscanCount?: number;

  /** Enable horizontal scrolling */
  horizontal?: boolean;

  /** Scroll threshold for updates */
  scrollThreshold?: number;
}

export interface VirtualScrollResult {
  /** Visible items range */
  visibleRange: { start: number; end: number };

  /** Items to render */
  items: Array<{ index: number; style: React.CSSProperties }>;

  /** Container props */
  containerProps: {
    style: React.CSSProperties;
    onScroll: (event: React.UIEvent) => void;
  };

  /** Scroll to specific index */
  scrollToIndex: (index: number) => void;
}

/**
 * Virtual scrolling hook for large lists
 */
export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollResult {
  const {
    itemCount,
    itemHeight,
    containerHeight,
    overscanCount = 5,
    horizontal = false,
    scrollThreshold = 10
  } = options;

  const [scrollOffset, setScrollOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);

  const getItemHeight = useCallback((index: number): number => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
  }, [itemHeight]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollOffset / getItemHeight(0)) - overscanCount);
    const end = Math.min(
      itemCount - 1,
      Math.ceil((scrollOffset + containerHeight) / getItemHeight(0)) + overscanCount
    );

    return { start, end };
  }, [scrollOffset, containerHeight, itemCount, overscanCount, getItemHeight]);

  // Generate items to render
  const items = useMemo(() => {
    const result: Array<{ index: number; style: React.CSSProperties }> = [];

    let offset = 0;
    for (let i = 0; i < visibleRange.start; i++) {
      offset += getItemHeight(i);
    }

    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      const height = getItemHeight(i);
      const style: React.CSSProperties = horizontal
        ? {
            position: 'absolute',
            left: offset,
            width: height,
            height: containerHeight
          }
        : {
            position: 'absolute',
            top: offset,
            height,
            width: '100%'
          };

      result.push({ index: i, style });
      offset += height;
    }

    return result;
  }, [visibleRange, getItemHeight, horizontal, containerHeight]);

  // Handle scroll with throttling
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const now = performance.now();
    if (now - lastScrollTime.current < scrollThreshold) {
      return;
    }
    lastScrollTime.current = now;

    const target = event.target as HTMLDivElement;
    const newOffset = horizontal ? target.scrollLeft : target.scrollTop;
    setScrollOffset(newOffset);
  }, [horizontal, scrollThreshold]);

  // Scroll to index function
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;

    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i);
    }

    if (horizontal) {
      containerRef.current.scrollLeft = offset;
    } else {
      containerRef.current.scrollTop = offset;
    }
  }, [getItemHeight, horizontal]);

  // Calculate total size
  const totalSize = useMemo(() => {
    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += getItemHeight(i);
    }
    return total;
  }, [itemCount, getItemHeight]);

  const containerProps = {
    ref: containerRef,
    style: {
      height: containerHeight,
      overflow: 'auto',
      position: 'relative' as const
    },
    onScroll: handleScroll
  };

  return {
    visibleRange,
    items,
    containerProps,
    scrollToIndex
  };
}

// =========================
// LAZY LOADING
// =========================

export interface LazyComponentOptions {
  /** Intersection observer options */
  threshold?: number;
  rootMargin?: string;

  /** Loading placeholder */
  fallback?: ReactNode;

  /** Error boundary */
  errorBoundary?: ComponentType<{ error: Error; retry: () => void }>;

  /** Enable performance monitoring */
  monitor?: boolean;
}

/**
 * Lazy loading component wrapper
 */
export function createLazyComponent<TProps>(
  loader: () => Promise<{ default: ComponentType<TProps> }>,
  options: LazyComponentOptions = {}
): ComponentType<TProps> {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    fallback = <div>Loading...</div>,
    errorBoundary: ErrorBoundary,
    monitor = false
  } = options;

  const LazyComponent = React.lazy(loader);

  return (props: TProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [hasError, setHasError] = useState<Error | null>(null);
    const elementRef = useRef<HTMLDivElement>(null);

    // Intersection observer for lazy loading
    useEffect(() => {
      const element = elementRef.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { threshold, rootMargin }
      );

      observer.observe(element);
      return () => observer.disconnect();
    }, [threshold, rootMargin]);

    const retry = useCallback(() => {
      setHasError(null);
      setIsVisible(true);
    }, []);

    // Error handling
    if (hasError) {
      if (ErrorBoundary) {
        return <ErrorBoundary error={hasError} retry={retry} />;
      }
      return (
        <div>
          <p>Error loading component: {hasError.message}</p>
          <button onClick={retry}>Retry</button>
        </div>
      );
    }

    // Render placeholder until visible
    if (!isVisible) {
      return <div ref={elementRef}>{fallback}</div>;
    }

    // Monitor loading time
    if (monitor && process.env.NODE_ENV === 'development') {
      console.log(`🚀 Lazy loading component: ${LazyComponent.displayName || 'Unknown'}`);
    }

    return (
      <React.Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
}

// =========================
// PERFORMANCE MONITORING
// =========================

export interface PerformanceMetrics {
  renderTime: number;
  propsChangeCount: number;
  lastRenderTimestamp: number;
  componentName: string;
}

/**
 * Performance monitoring HOC
 */
export function withPerformanceMonitor<TProps>(
  Component: ComponentType<TProps>,
  options: { trackProps?: boolean; logThreshold?: number } = {}
): ComponentType<TProps> {
  const { trackProps = false, logThreshold = 16 } = options;
  const componentName = Component.displayName || Component.name || 'Unknown';

  return (props: TProps) => {
    const renderStartTime = useRef<number>(0);
    const propsRef = useRef<TProps>(props);
    const metricsRef = useRef<PerformanceMetrics>({
      renderTime: 0,
      propsChangeCount: 0,
      lastRenderTimestamp: 0,
      componentName
    });

    // Track render start
    renderStartTime.current = performance.now();

    // Track props changes
    if (trackProps && !deepEqual(propsRef.current, props)) {
      metricsRef.current.propsChangeCount++;
      propsRef.current = props;
    }

    // Track render completion
    useEffect(() => {
      const renderTime = performance.now() - renderStartTime.current;
      metricsRef.current.renderTime = renderTime;
      metricsRef.current.lastRenderTimestamp = Date.now();

      if (process.env.NODE_ENV === 'development' && renderTime > logThreshold) {
        console.warn(
          `🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
          {
            metrics: metricsRef.current,
            props: trackProps ? props : 'tracking disabled'
          }
        );
      }
    });

    return <Component {...props} />;
  };
}

// =========================
// BATCH UPDATES
// =========================

/**
 * Batch state updates for performance
 */
export function useBatchedUpdates<T>(initialState: T): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef<Partial<T>[]>([]);
  const updateScheduled = useRef(false);

  const batchedSetState = useCallback((updates: Partial<T>) => {
    pendingUpdates.current.push(updates);

    if (!updateScheduled.current) {
      updateScheduled.current = true;

      // Use scheduler if available, otherwise setTimeout
      const scheduler = (window as any).scheduler?.postTask || setTimeout;
      scheduler(() => {
        const allUpdates = pendingUpdates.current.reduce(
          (acc, update) => ({ ...acc, ...update }),
          {}
        );

        setState(prevState => ({ ...prevState, ...allUpdates }));
        pendingUpdates.current = [];
        updateScheduled.current = false;
      });
    }
  }, []);

  return [state, batchedSetState];
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Performance profiler for development
 */
export function profileComponent<TProps>(
  Component: ComponentType<TProps>,
  profileName?: string
): ComponentType<TProps> {
  if (process.env.NODE_ENV !== 'development') {
    return Component;
  }

  const name = profileName || Component.displayName || Component.name || 'Anonymous';

  return (props: TProps) => (
    <React.Profiler
      id={name}
      onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        console.log(`⚡ ${id} [${phase}]: ${actualDuration.toFixed(2)}ms`);
      }}
    >
      <Component {...props} />
    </React.Profiler>
  );
}