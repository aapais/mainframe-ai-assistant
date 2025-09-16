/**
 * React Hook for Component Memory Tracking
 *
 * Provides automatic memory tracking for React components including:
 * - Mount/unmount memory delta
 * - Render-triggered memory changes
 * - Props/state memory impact
 * - Memory leak detection
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { MemoryAnalyzer } from '../../performance/MemoryAnalyzer';

interface MemoryTrackingOptions {
  componentName?: string;
  trackProps?: boolean;
  trackState?: boolean;
  leakThreshold?: number; // bytes
  sampleInterval?: number; // ms
  enableWarnings?: boolean;
}

interface ComponentMemoryStats {
  mountMemory: number;
  currentMemory: number;
  memoryDelta: number;
  propsSize: number;
  stateSize: number;
  renderCount: number;
  averageRenderMemory: number;
  isLeakSuspected: boolean;
  mountTime: Date;
  lastMeasurement: Date;
}

interface MemoryTrackingResult {
  stats: ComponentMemoryStats;
  takeSnapshot: () => Promise<void>;
  checkForLeaks: () => boolean;
  getMemoryBreakdown: () => {
    component: number;
    props: number;
    state: number;
    dom: number;
    events: number;
  };
  exportData: () => any;
}

export function useMemoryTracking(
  props?: any,
  state?: any,
  options: MemoryTrackingOptions = {}
): MemoryTrackingResult {
  const {
    componentName = 'UnknownComponent',
    trackProps = true,
    trackState = true,
    leakThreshold = 1024 * 1024, // 1MB
    sampleInterval = 5000, // 5 seconds
    enableWarnings = true
  } = options;

  // Refs for persistent data
  const mountMemoryRef = useRef<number>(0);
  const mountTimeRef = useRef<Date>(new Date());
  const renderCountRef = useRef<number>(0);
  const memoryHistoryRef = useRef<number[]>([]);
  const lastPropsRef = useRef<any>(null);
  const lastStateRef = useRef<any>(null);
  const samplingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State for reactive stats
  const [stats, setStats] = useState<ComponentMemoryStats>({
    mountMemory: 0,
    currentMemory: 0,
    memoryDelta: 0,
    propsSize: 0,
    stateSize: 0,
    renderCount: 0,
    averageRenderMemory: 0,
    isLeakSuspected: false,
    mountTime: new Date(),
    lastMeasurement: new Date()
  });

  // Memory measurement utilities
  const measureMemory = useCallback((): number => {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }, []);

  const calculateObjectSize = useCallback((obj: any): number => {
    if (!obj) return 0;
    try {
      return new Blob([JSON.stringify(obj)]).size;
    } catch {
      return JSON.stringify(obj || {}).length * 2;
    }
  }, []);

  const takeSnapshot = useCallback(async (): Promise<void> => {
    const currentMemory = measureMemory();
    const memoryDelta = currentMemory - mountMemoryRef.current;
    const propsSize = trackProps ? calculateObjectSize(props) : 0;
    const stateSize = trackState ? calculateObjectSize(state) : 0;

    renderCountRef.current++;
    memoryHistoryRef.current.push(currentMemory);

    // Keep only last 50 measurements
    if (memoryHistoryRef.current.length > 50) {
      memoryHistoryRef.current.shift();
    }

    const averageRenderMemory = memoryHistoryRef.current.length > 0
      ? memoryHistoryRef.current.reduce((sum, mem) => sum + mem, 0) / memoryHistoryRef.current.length
      : currentMemory;

    const isLeakSuspected = checkForLeaks(currentMemory, memoryDelta);

    setStats({
      mountMemory: mountMemoryRef.current,
      currentMemory,
      memoryDelta,
      propsSize,
      stateSize,
      renderCount: renderCountRef.current,
      averageRenderMemory,
      isLeakSuspected,
      mountTime: mountTimeRef.current,
      lastMeasurement: new Date()
    });

    // Warnings
    if (enableWarnings && isLeakSuspected) {
      console.warn(`🚨 Memory leak suspected in ${componentName}:`, {
        memoryDelta: formatBytes(memoryDelta),
        renderCount: renderCountRef.current,
        currentMemory: formatBytes(currentMemory)
      });
    }

    if (enableWarnings && propsSize > 100 * 1024) { // 100KB
      console.warn(`⚠️ Large props detected in ${componentName}: ${formatBytes(propsSize)}`);
    }

    if (enableWarnings && stateSize > 100 * 1024) { // 100KB
      console.warn(`⚠️ Large state detected in ${componentName}: ${formatBytes(stateSize)}`);
    }
  }, [props, state, componentName, trackProps, trackState, enableWarnings, measureMemory, calculateObjectSize]);

  const checkForLeaks = useCallback((currentMemory?: number, memoryDelta?: number): boolean => {
    const memory = currentMemory || measureMemory();
    const delta = memoryDelta || (memory - mountMemoryRef.current);

    // Multiple leak detection strategies
    const strategies = {
      // 1. Absolute memory growth
      absoluteGrowth: delta > leakThreshold,

      // 2. Memory growth rate (per render)
      growthRate: renderCountRef.current > 10 && (delta / renderCountRef.current) > (leakThreshold / 100),

      // 3. Trend analysis (last 10 measurements)
      trendAnalysis: (() => {
        const recent = memoryHistoryRef.current.slice(-10);
        if (recent.length < 5) return false;

        const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
        const secondHalf = recent.slice(Math.floor(recent.length / 2));

        const avgFirst = firstHalf.reduce((sum, mem) => sum + mem, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((sum, mem) => sum + mem, 0) / secondHalf.length;

        return (avgSecond - avgFirst) > (leakThreshold / 10);
      })(),

      // 4. Props/state bloat
      propsBloat: trackProps && calculateObjectSize(props) > calculateObjectSize(lastPropsRef.current) * 2,
      stateBloat: trackState && calculateObjectSize(state) > calculateObjectSize(lastStateRef.current) * 2
    };

    // Update refs for next comparison
    lastPropsRef.current = props;
    lastStateRef.current = state;

    // Return true if any strategy indicates a leak
    return Object.values(strategies).some(Boolean);
  }, [props, state, leakThreshold, trackProps, trackState, measureMemory, calculateObjectSize]);

  const getMemoryBreakdown = useCallback(() => {
    const total = measureMemory();
    const propsSize = trackProps ? calculateObjectSize(props) : 0;
    const stateSize = trackState ? calculateObjectSize(state) : 0;

    // Estimate DOM memory (simplified)
    const domSize = typeof document !== 'undefined'
      ? document.querySelectorAll(`[data-component="${componentName}"]`).length * 512
      : 0;

    // Estimate event listener memory
    const eventsSize = typeof document !== 'undefined'
      ? document.querySelectorAll(`[data-component="${componentName}"] *`).length * 64
      : 0;

    const componentSize = Math.max(0, total - propsSize - stateSize - domSize - eventsSize);

    return {
      component: componentSize,
      props: propsSize,
      state: stateSize,
      dom: domSize,
      events: eventsSize
    };
  }, [componentName, props, state, trackProps, trackState, measureMemory, calculateObjectSize]);

  const exportData = useCallback(() => {
    return {
      componentName,
      stats,
      memoryHistory: [...memoryHistoryRef.current],
      breakdown: getMemoryBreakdown(),
      config: options,
      timestamp: new Date().toISOString()
    };
  }, [componentName, stats, options, getMemoryBreakdown]);

  // Component lifecycle tracking
  useEffect(() => {
    // Component mount
    mountMemoryRef.current = measureMemory();
    mountTimeRef.current = new Date();

    console.log(`📊 ${componentName} mounted. Memory: ${formatBytes(mountMemoryRef.current)}`);

    // Start periodic sampling
    samplingIntervalRef.current = setInterval(() => {
      takeSnapshot();
    }, sampleInterval);

    // Cleanup on unmount
    return () => {
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
      }

      const unmountMemory = measureMemory();
      const memoryDelta = unmountMemory - mountMemoryRef.current;
      const duration = Date.now() - mountTimeRef.current.getTime();

      console.log(`📊 ${componentName} unmounted after ${duration}ms`);
      console.log(`   Memory delta: ${formatBytes(memoryDelta)}`);
      console.log(`   Renders: ${renderCountRef.current}`);

      if (memoryDelta > leakThreshold) {
        console.warn(`🚨 ${componentName} memory leak suspected: ${formatBytes(memoryDelta)} not freed`);
      }

      // Export final data for analysis
      const finalData = {
        componentName,
        lifecycle: 'unmount',
        duration,
        memoryDelta,
        renderCount: renderCountRef.current,
        memoryHistory: [...memoryHistoryRef.current],
        finalBreakdown: getMemoryBreakdown()
      };

      // Store in global memory tracker if available
      if (typeof window !== 'undefined' && (window as any).__MEMORY_TRACKER__) {
        (window as any).__MEMORY_TRACKER__.componentLifecycles.push(finalData);
      }
    };
  }, [componentName, sampleInterval, leakThreshold, takeSnapshot, getMemoryBreakdown, measureMemory]);

  // Track re-renders
  useEffect(() => {
    takeSnapshot();
  });

  return {
    stats,
    takeSnapshot,
    checkForLeaks: () => checkForLeaks(),
    getMemoryBreakdown,
    exportData
  };
}

/**
 * Higher-order component for automatic memory tracking
 */
export function withMemoryTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: MemoryTrackingOptions = {}
) {
  return React.forwardRef<any, P>((props, ref) => {
    const componentName = options.componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
    const memoryTracking = useMemoryTracking(props, null, { ...options, componentName });

    // Add memory tracking data to component props
    const enhancedProps = {
      ...props,
      memoryStats: memoryTracking.stats,
      memoryTracking: {
        takeSnapshot: memoryTracking.takeSnapshot,
        checkForLeaks: memoryTracking.checkForLeaks,
        getBreakdown: memoryTracking.getMemoryBreakdown
      }
    } as P & {
      memoryStats: ComponentMemoryStats;
      memoryTracking: {
        takeSnapshot: () => Promise<void>;
        checkForLeaks: () => boolean;
        getBreakdown: () => any;
      };
    };

    return <WrappedComponent ref={ref} {...enhancedProps} />;
  });
}

/**
 * Memory tracking provider component
 */
interface MemoryTrackingProviderProps {
  children: React.ReactNode;
  globalOptions?: MemoryTrackingOptions;
  enableGlobalTracking?: boolean;
}

export function MemoryTrackingProvider({
  children,
  globalOptions = {},
  enableGlobalTracking = true
}: MemoryTrackingProviderProps) {
  useEffect(() => {
    if (!enableGlobalTracking) return;

    // Initialize global memory tracker
    if (typeof window !== 'undefined') {
      (window as any).__MEMORY_TRACKER__ = {
        componentLifecycles: [],
        globalSnapshots: [],
        config: globalOptions
      };

      // Global memory monitoring
      const takeGlobalSnapshot = () => {
        const snapshot = {
          timestamp: new Date(),
          memory: typeof performance !== 'undefined' && 'memory' in performance
            ? (performance as any).memory
            : null,
          components: document.querySelectorAll('[data-component]').length,
          eventListeners: 0 // Would need custom tracking
        };

        (window as any).__MEMORY_TRACKER__.globalSnapshots.push(snapshot);

        // Keep only last 100 snapshots
        if ((window as any).__MEMORY_TRACKER__.globalSnapshots.length > 100) {
          (window as any).__MEMORY_TRACKER__.globalSnapshots.shift();
        }
      };

      // Take snapshot every 30 seconds
      const interval = setInterval(takeGlobalSnapshot, 30000);

      // Initial snapshot
      takeGlobalSnapshot();

      return () => {
        clearInterval(interval);
        delete (window as any).__MEMORY_TRACKER__;
      };
    }
  }, [enableGlobalTracking, globalOptions]);

  return <>{children}</>;
}

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default useMemoryTracking;