/**
 * React Profiler API Integration Hooks
 *
 * Provides comprehensive React component performance monitoring
 * using React DevTools Profiler API with <16ms render threshold detection
 */

import React, {
  useCallback,
  useRef,
  useEffect,
  useState,
  Profiler,
  ProfilerOnRenderCallback,
} from 'react';

// =========================
// TYPES AND INTERFACES
// =========================

export interface RenderMetrics {
  /** Component identifier */
  id: string;
  /** Render phase: 'mount' or 'update' */
  phase: 'mount' | 'update';
  /** Time spent rendering (in ms) */
  actualDuration: number;
  /** Base duration for comparison */
  baseDuration: number;
  /** Render start time */
  startTime: number;
  /** Commit time */
  commitTime: number;
  /** Timestamp of the render */
  timestamp: number;
  /** Render count */
  renderCount: number;
  /** Whether render exceeded 16ms threshold */
  exceededThreshold: boolean;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  /** Critical threshold (red zone) - default 16ms */
  critical: number;
  /** Warning threshold (yellow zone) - default 12ms */
  warning: number;
  /** Good threshold (green zone) - default 8ms */
  good: number;
}

export interface ProfilerOptions {
  /** Component name for identification */
  componentName?: string;
  /** Performance thresholds */
  thresholds?: Partial<PerformanceThresholds>;
  /** Enable detailed logging */
  enableLogging?: boolean;
  /** Sample rate (0-1, 1 = capture all renders) */
  sampleRate?: number;
  /** Enable memory tracking */
  trackMemory?: boolean;
  /** Custom metadata to include */
  metadata?: Record<string, any>;
}

export interface PerformanceStore {
  /** All render metrics */
  metrics: RenderMetrics[];
  /** Slow renders (exceeded threshold) */
  slowRenders: RenderMetrics[];
  /** Component statistics */
  stats: {
    totalRenders: number;
    slowRenderCount: number;
    averageRenderTime: number;
    maxRenderTime: number;
    minRenderTime: number;
    lastRenderTime: number;
  };
}

// =========================
// CONSTANTS
// =========================

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  critical: 16, // 16ms for 60fps
  warning: 12, // 12ms warning zone
  good: 8, // 8ms good performance
};

const PERFORMANCE_STORAGE_KEY = 'react-performance-metrics';
const MAX_STORED_METRICS = 1000; // Prevent memory leaks

// =========================
// PERFORMANCE STORE
// =========================

class ReactPerformanceStore {
  private metrics: RenderMetrics[] = [];
  private listeners = new Set<(store: PerformanceStore) => void>();
  private thresholds = DEFAULT_THRESHOLDS;

  addMetric(metric: RenderMetrics) {
    this.metrics.unshift(metric);

    // Maintain max metrics limit
    if (this.metrics.length > MAX_STORED_METRICS) {
      this.metrics = this.metrics.slice(0, MAX_STORED_METRICS);
    }

    this.notifyListeners();
  }

  getStore(): PerformanceStore {
    const slowRenders = this.metrics.filter(m => m.exceededThreshold);
    const renderTimes = this.metrics.map(m => m.actualDuration);

    return {
      metrics: [...this.metrics],
      slowRenders,
      stats: {
        totalRenders: this.metrics.length,
        slowRenderCount: slowRenders.length,
        averageRenderTime:
          renderTimes.length > 0 ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length : 0,
        maxRenderTime: Math.max(...renderTimes, 0),
        minRenderTime: Math.min(...renderTimes, Infinity) || 0,
        lastRenderTime: renderTimes[0] || 0,
      },
    };
  }

  subscribe(listener: (store: PerformanceStore) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const store = this.getStore();
    this.listeners.forEach(listener => listener(store));
  }

  clear() {
    this.metrics = [];
    this.notifyListeners();
  }

  setThresholds(thresholds: Partial<PerformanceThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }
}

// Singleton store instance
const performanceStore = new ReactPerformanceStore();

// =========================
// MAIN PROFILER HOOK
// =========================

/**
 * Main React Profiler hook for component performance monitoring
 */
export function useReactProfiler(options: ProfilerOptions = {}) {
  const {
    componentName = 'Unknown',
    thresholds = {},
    enableLogging = process.env.NODE_ENV === 'development',
    sampleRate = 1,
    trackMemory = true,
    metadata = {},
  } = options;

  const renderCountRef = useRef(0);
  const finalThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // Set thresholds in store
  useEffect(() => {
    performanceStore.setThresholds(finalThresholds);
  }, [finalThresholds]);

  const onRenderCallback: ProfilerOnRenderCallback = useCallback(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      // Apply sampling
      if (Math.random() > sampleRate) return;

      renderCountRef.current += 1;
      const exceededThreshold = actualDuration > finalThresholds.critical;

      const renderMetric: RenderMetrics = {
        id: `${componentName}-${id}`,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        timestamp: Date.now(),
        renderCount: renderCountRef.current,
        exceededThreshold,
        metadata: {
          ...metadata,
          ...(trackMemory && {
            memoryUsage: (performance as any).memory
              ? {
                  usedJSMemory: (performance as any).memory.usedJSMemory,
                  totalJSMemory: (performance as any).memory.totalJSMemory,
                }
              : null,
          }),
        },
      };

      // Store metric
      performanceStore.addMetric(renderMetric);

      // Logging for development
      if (enableLogging) {
        const severity =
          actualDuration > finalThresholds.critical
            ? '🔴 CRITICAL'
            : actualDuration > finalThresholds.warning
              ? '🟡 WARNING'
              : '🟢 GOOD';

        console.log(
          `${severity} [${componentName}] Render #${renderCountRef.current} (${phase}): ${actualDuration.toFixed(2)}ms`,
          {
            metric: renderMetric,
            thresholds: finalThresholds,
          }
        );

        // Detailed warning for slow renders
        if (exceededThreshold) {
          console.warn(
            `🐌 Slow render detected in ${componentName}:`,
            `${actualDuration.toFixed(2)}ms > ${finalThresholds.critical}ms threshold`,
            renderMetric
          );
        }
      }
    },
    [componentName, finalThresholds, enableLogging, sampleRate, trackMemory, metadata]
  );

  return {
    onRenderCallback,
    ProfilerWrapper: useCallback(
      ({ id, children }: { id?: string; children: React.ReactNode }) => (
        <Profiler id={id || componentName} onRender={onRenderCallback}>
          {children}
        </Profiler>
      ),
      [componentName, onRenderCallback]
    ),
  };
}

// =========================
// PERFORMANCE MONITORING HOOKS
// =========================

/**
 * Hook to subscribe to performance store updates
 */
export function usePerformanceStore() {
  const [store, setStore] = useState<PerformanceStore>(performanceStore.getStore());

  useEffect(() => {
    const unsubscribe = performanceStore.subscribe(setStore);
    return unsubscribe;
  }, []);

  const clearMetrics = useCallback(() => {
    performanceStore.clear();
  }, []);

  const setThresholds = useCallback((thresholds: Partial<PerformanceThresholds>) => {
    performanceStore.setThresholds(thresholds);
  }, []);

  return {
    store,
    clearMetrics,
    setThresholds,
    thresholds: performanceStore.getThresholds(),
  };
}

/**
 * Hook to track render performance of current component
 */
export function useRenderPerformance(componentName?: string) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef<number>(0);
  const [renderStats, setRenderStats] = useState({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    exceedsThreshold: false,
  });

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      renderCountRef.current += 1;
      lastRenderTimeRef.current = renderTime;

      const exceedsThreshold = renderTime > DEFAULT_THRESHOLDS.critical;

      setRenderStats(prev => ({
        renderCount: renderCountRef.current,
        lastRenderTime: renderTime,
        averageRenderTime:
          (prev.averageRenderTime * (renderCountRef.current - 1) + renderTime) /
          renderCountRef.current,
        exceedsThreshold,
      }));

      if (exceedsThreshold && process.env.NODE_ENV === 'development') {
        console.warn(
          `🐌 Component ${componentName || 'Unknown'} exceeded 16ms threshold: ${renderTime.toFixed(2)}ms`
        );
      }
    };
  });

  return renderStats;
}

/**
 * Hook for component-specific performance alerts
 */
export function usePerformanceAlerts(componentName: string) {
  const [alerts, setAlerts] = useState<
    Array<{
      id: string;
      timestamp: number;
      message: string;
      severity: 'warning' | 'critical';
      renderTime: number;
    }>
  >([]);

  const { store } = usePerformanceStore();

  useEffect(() => {
    const componentMetrics = store.metrics.filter(
      m => m.id.includes(componentName) && m.exceededThreshold
    );

    const newAlerts = componentMetrics
      .slice(0, 5) // Last 5 slow renders
      .map(metric => ({
        id: `${metric.id}-${metric.timestamp}`,
        timestamp: metric.timestamp,
        message: `Slow render: ${metric.actualDuration.toFixed(2)}ms (${metric.phase})`,
        severity: metric.actualDuration > 32 ? ('critical' as const) : ('warning' as const),
        renderTime: metric.actualDuration,
      }));

    setAlerts(newAlerts);
  }, [store.metrics, componentName]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    clearAlerts,
    hasAlerts: alerts.length > 0,
  };
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Get performance metrics for a specific component
 */
export function getComponentMetrics(componentName: string): RenderMetrics[] {
  const store = performanceStore.getStore();
  return store.metrics.filter(metric => metric.id.includes(componentName));
}

/**
 * Get overall performance summary
 */
export function getPerformanceSummary() {
  const store = performanceStore.getStore();
  const thresholds = performanceStore.getThresholds();

  return {
    ...store.stats,
    thresholds,
    performanceScore: calculatePerformanceScore(store),
    recommendations: generateRecommendations(store),
  };
}

/**
 * Calculate performance score (0-100)
 */
function calculatePerformanceScore(store: PerformanceStore): number {
  if (store.stats.totalRenders === 0) return 100;

  const slowRenderRatio = store.stats.slowRenderCount / store.stats.totalRenders;
  const avgTimeRatio = Math.min(store.stats.averageRenderTime / 16, 2); // Cap at 2x threshold

  // Score based on slow render ratio (60%) and average time (40%)
  const score = Math.max(0, 100 - (slowRenderRatio * 60 + (avgTimeRatio - 1) * 40));
  return Math.round(score);
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(store: PerformanceStore): string[] {
  const recommendations: string[] = [];
  const { stats } = store;

  if (stats.slowRenderCount > 0) {
    const slowRenderRatio = stats.slowRenderCount / stats.totalRenders;

    if (slowRenderRatio > 0.1) {
      recommendations.push(
        'High number of slow renders detected. Consider implementing React.memo for component optimization.'
      );
    }

    if (stats.maxRenderTime > 50) {
      recommendations.push(
        'Very slow renders detected (>50ms). Consider breaking down large components or implementing virtualization.'
      );
    }

    if (stats.averageRenderTime > 20) {
      recommendations.push(
        'Average render time is high. Consider optimizing expensive calculations with useMemo and useCallback.'
      );
    }
  }

  if (stats.totalRenders > 100 && stats.averageRenderTime > 10) {
    recommendations.push(
      'Frequent re-renders detected. Review component dependencies and state management.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Performance looks good! All renders are within acceptable thresholds.');
  }

  return recommendations;
}

/**
 * Export performance data
 */
export function exportPerformanceData(format: 'json' | 'csv' = 'json'): string {
  const store = performanceStore.getStore();
  const summary = getPerformanceSummary();

  const data = {
    summary,
    metrics: store.metrics,
    exportTimestamp: new Date().toISOString(),
  };

  if (format === 'csv') {
    return convertToCSV(store.metrics);
  }

  return JSON.stringify(data, null, 2);
}

function convertToCSV(metrics: RenderMetrics[]): string {
  if (metrics.length === 0) return '';

  const headers = [
    'timestamp',
    'id',
    'phase',
    'actualDuration',
    'baseDuration',
    'exceededThreshold',
    'renderCount',
  ];
  const rows = metrics.map(metric => [
    new Date(metric.timestamp).toISOString(),
    metric.id,
    metric.phase,
    metric.actualDuration.toString(),
    metric.baseDuration.toString(),
    metric.exceededThreshold.toString(),
    metric.renderCount.toString(),
  ]);

  return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
}

// =========================
// EXPORTS
// =========================

export { performanceStore };
export type { RenderMetrics, PerformanceThresholds, ProfilerOptions, PerformanceStore };
