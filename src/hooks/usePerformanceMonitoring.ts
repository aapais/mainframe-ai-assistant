/**
 * Advanced Performance Monitoring Hooks
 *
 * Additional hooks for comprehensive React component performance tracking
 * including memory usage, interaction tracking, and batch performance analysis
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { performanceStore, RenderMetrics, PerformanceThresholds } from './useReactProfiler';

// =========================
// TYPES AND INTERFACES
// =========================

export interface InteractionMetric {
  id: string;
  type: 'click' | 'input' | 'scroll' | 'resize' | 'custom';
  timestamp: number;
  duration: number;
  targetComponent?: string;
  payload?: any;
  blocking: boolean;
}

export interface MemoryMetric {
  timestamp: number;
  usedJSMemory: number;
  totalJSMemory: number;
  jsMemoryDelta: number;
  componentName?: string;
}

export interface PerformanceBatch {
  id: string;
  componentName: string;
  startTime: number;
  endTime: number;
  renderCount: number;
  totalRenderTime: number;
  avgRenderTime: number;
  maxRenderTime: number;
  slowRenders: number;
  interactions: InteractionMetric[];
  memoryUsage: MemoryMetric[];
}

export interface ComponentHealthScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
  recommendations: string[];
  metrics: {
    avgRenderTime: number;
    slowRenderRatio: number;
    memoryLeaks: boolean;
    excessiveReRenders: boolean;
  };
}

// =========================
// INTERACTION TRACKING HOOK
// =========================

/**
 * Hook to track user interactions and their performance impact
 */
export function useInteractionTracking(componentName: string) {
  const [interactions, setInteractions] = useState<InteractionMetric[]>([]);
  const interactionStartTime = useRef<number>(0);
  const interactionId = useRef<string>('');

  const startInteraction = useCallback((type: InteractionMetric['type'], payload?: any) => {
    interactionStartTime.current = performance.now();
    interactionId.current = `${componentName}-${type}-${Date.now()}`;

    // Use React's experimental profiler to detect if interaction is blocking
    if ('scheduler' in window && (window as any).scheduler?.isInputPending) {
      const isBlocking = (window as any).scheduler.isInputPending();

      if (isBlocking && process.env.NODE_ENV === 'development') {
        console.warn(`🚨 Blocking interaction detected in ${componentName}:`, type);
      }
    }
  }, [componentName]);

  const endInteraction = useCallback((type: InteractionMetric['type'], payload?: any) => {
    if (interactionStartTime.current === 0) return;

    const duration = performance.now() - interactionStartTime.current;
    const isBlocking = duration > 16; // Consider blocking if > 16ms

    const interaction: InteractionMetric = {
      id: interactionId.current || `${componentName}-${type}-${Date.now()}`,
      type,
      timestamp: Date.now(),
      duration,
      targetComponent: componentName,
      payload,
      blocking: isBlocking
    };

    setInteractions(prev => [interaction, ...prev.slice(0, 49)]); // Keep last 50

    // Log slow interactions
    if (isBlocking && process.env.NODE_ENV === 'development') {
      console.warn(
        `🐌 Slow interaction in ${componentName}: ${type} took ${duration.toFixed(2)}ms`,
        interaction
      );
    }

    interactionStartTime.current = 0;
    interactionId.current = '';
  }, [componentName]);

  const trackClick = useCallback((event: React.MouseEvent) => {
    startInteraction('click', {
      target: event.currentTarget.tagName,
      button: event.button
    });

    // Use requestIdleCallback to end the interaction when the browser is idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => endInteraction('click'));
    } else {
      setTimeout(() => endInteraction('click'), 0);
    }
  }, [startInteraction, endInteraction]);

  const trackInput = useCallback((event: React.ChangeEvent) => {
    startInteraction('input', {
      inputType: event.target.type,
      valueLength: event.target.value?.length
    });

    // End after a short delay to capture immediate effects
    setTimeout(() => endInteraction('input'), 5);
  }, [startInteraction, endInteraction]);

  return {
    interactions,
    trackClick,
    trackInput,
    startInteraction,
    endInteraction,
    clearInteractions: () => setInteractions([])
  };
}

// =========================
// MEMORY TRACKING HOOK
// =========================

/**
 * Hook to track memory usage and detect memory leaks
 */
export function useMemoryTracking(componentName: string, interval = 5000) {
  const [memoryMetrics, setMemoryMetrics] = useState<MemoryMetric[]>([]);
  const previousMemoryRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!('memory' in performance)) {
      console.warn('Memory API not available in this browser');
      return;
    }

    const trackMemory = () => {
      const memory = (performance as any).memory;
      const usedMemory = memory.usedJSMemory;
      const totalMemory = memory.totalJSMemory;
      const memoryDelta = usedMemory - previousMemoryRef.current;

      const metric: MemoryMetric = {
        timestamp: Date.now(),
        usedJSMemory: usedMemory,
        totalJSMemory: totalMemory,
        jsMemoryDelta: memoryDelta,
        componentName
      };

      setMemoryMetrics(prev => [metric, ...prev.slice(0, 99)]); // Keep last 100
      previousMemoryRef.current = usedMemory;

      // Detect potential memory leaks
      if (memoryDelta > 1024 * 1024 && process.env.NODE_ENV === 'development') { // 1MB increase
        console.warn(
          `🧠 Memory increase detected in ${componentName}: +${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
          metric
        );
      }
    };

    trackMemory(); // Initial measurement
    intervalRef.current = setInterval(trackMemory, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [componentName, interval]);

  const hasMemoryLeak = useCallback((): boolean => {
    if (memoryMetrics.length < 10) return false;

    // Check if memory has been consistently increasing over last 10 measurements
    const recent = memoryMetrics.slice(0, 10);
    const increases = recent.slice(0, -1).filter((metric, index) =>
      metric.jsMemoryDelta > 0 && metric.jsMemoryDelta > recent[index + 1].jsMemoryDelta
    );

    return increases.length >= 7; // 70% of recent measurements show increase
  }, [memoryMetrics]);

  const getMemoryTrend = useCallback((): 'increasing' | 'decreasing' | 'stable' => {
    if (memoryMetrics.length < 5) return 'stable';

    const recent = memoryMetrics.slice(0, 5);
    const totalDelta = recent.reduce((sum, metric) => sum + metric.jsMemoryDelta, 0);

    if (totalDelta > 500 * 1024) return 'increasing'; // 500KB increase
    if (totalDelta < -500 * 1024) return 'decreasing'; // 500KB decrease
    return 'stable';
  }, [memoryMetrics]);

  return {
    memoryMetrics,
    hasMemoryLeak: hasMemoryLeak(),
    memoryTrend: getMemoryTrend(),
    currentMemoryUsage: memoryMetrics[0]?.usedJSMemory || 0,
    clearMetrics: () => setMemoryMetrics([])
  };
}

// =========================
// BATCH PERFORMANCE ANALYSIS
// =========================

/**
 * Hook to perform batch analysis of component performance over time
 */
export function useBatchPerformanceAnalysis(componentName: string, batchDuration = 30000) {
  const [batches, setBatches] = useState<PerformanceBatch[]>([]);
  const currentBatchRef = useRef<Partial<PerformanceBatch> | null>(null);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { interactions } = useInteractionTracking(componentName);
  const { memoryMetrics } = useMemoryTracking(componentName);

  const startNewBatch = useCallback(() => {
    if (currentBatchRef.current) {
      // Complete current batch
      const endTime = performance.now();
      const batch = currentBatchRef.current as PerformanceBatch;

      if (batch.startTime) {
        batch.endTime = endTime;
        setBatches(prev => [batch, ...prev.slice(0, 9)]); // Keep last 10 batches
      }
    }

    // Start new batch
    currentBatchRef.current = {
      id: `${componentName}-batch-${Date.now()}`,
      componentName,
      startTime: performance.now(),
      renderCount: 0,
      totalRenderTime: 0,
      avgRenderTime: 0,
      maxRenderTime: 0,
      slowRenders: 0,
      interactions: [],
      memoryUsage: []
    };

    // Set timeout for batch completion
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(() => {
      startNewBatch(); // Start next batch
    }, batchDuration);
  }, [componentName, batchDuration]);

  useEffect(() => {
    startNewBatch();

    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, [startNewBatch]);

  // Update current batch with new metrics
  useEffect(() => {
    const unsubscribe = performanceStore.subscribe((store) => {
      if (!currentBatchRef.current) return;

      const componentMetrics = store.metrics.filter(m =>
        m.id.includes(componentName) &&
        m.timestamp > currentBatchRef.current!.startTime!
      );

      if (componentMetrics.length > 0) {
        const renderTimes = componentMetrics.map(m => m.actualDuration);
        const slowRenders = componentMetrics.filter(m => m.exceededThreshold);

        Object.assign(currentBatchRef.current, {
          renderCount: componentMetrics.length,
          totalRenderTime: renderTimes.reduce((a, b) => a + b, 0),
          avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
          maxRenderTime: Math.max(...renderTimes),
          slowRenders: slowRenders.length
        });
      }
    });

    return unsubscribe;
  }, [componentName]);

  // Update batch with interactions and memory
  useEffect(() => {
    if (currentBatchRef.current && interactions.length > 0) {
      currentBatchRef.current.interactions = [...interactions];
    }
  }, [interactions]);

  useEffect(() => {
    if (currentBatchRef.current && memoryMetrics.length > 0) {
      currentBatchRef.current.memoryUsage = [...memoryMetrics];
    }
  }, [memoryMetrics]);

  return {
    batches,
    currentBatch: currentBatchRef.current,
    startNewBatch,
    clearBatches: () => setBatches([])
  };
}

// =========================
// COMPONENT HEALTH SCORING
// =========================

/**
 * Hook to calculate component health score based on various metrics
 */
export function useComponentHealth(componentName: string): ComponentHealthScore {
  const [healthScore, setHealthScore] = useState<ComponentHealthScore>({
    score: 100,
    grade: 'A',
    issues: [],
    recommendations: [],
    metrics: {
      avgRenderTime: 0,
      slowRenderRatio: 0,
      memoryLeaks: false,
      excessiveReRenders: false
    }
  });

  const { memoryMetrics, hasMemoryLeak } = useMemoryTracking(componentName);
  const { batches } = useBatchPerformanceAnalysis(componentName);

  useEffect(() => {
    const unsubscribe = performanceStore.subscribe((store) => {
      const componentMetrics = store.metrics.filter(m => m.id.includes(componentName));

      if (componentMetrics.length === 0) return;

      const renderTimes = componentMetrics.map(m => m.actualDuration);
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const slowRenders = componentMetrics.filter(m => m.exceededThreshold);
      const slowRenderRatio = slowRenders.length / componentMetrics.length;

      // Check for excessive re-renders (more than 10 renders in last 5 seconds)
      const recentRenders = componentMetrics.filter(m =>
        Date.now() - m.timestamp < 5000
      );
      const excessiveReRenders = recentRenders.length > 10;

      let score = 100;
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Scoring algorithm
      if (avgRenderTime > 16) {
        score -= 30;
        issues.push(`Average render time (${avgRenderTime.toFixed(2)}ms) exceeds 16ms threshold`);
        recommendations.push('Consider optimizing render logic with React.memo or useMemo');
      } else if (avgRenderTime > 12) {
        score -= 15;
        issues.push(`Average render time (${avgRenderTime.toFixed(2)}ms) approaching threshold`);
        recommendations.push('Monitor render performance and optimize if needed');
      }

      if (slowRenderRatio > 0.2) {
        score -= 25;
        issues.push(`${(slowRenderRatio * 100).toFixed(1)}% of renders exceed threshold`);
        recommendations.push('Implement performance optimizations to reduce slow renders');
      } else if (slowRenderRatio > 0.1) {
        score -= 10;
        issues.push(`${(slowRenderRatio * 100).toFixed(1)}% of renders are slow`);
      }

      if (hasMemoryLeak) {
        score -= 20;
        issues.push('Potential memory leak detected');
        recommendations.push('Review component for memory leaks and cleanup effects');
      }

      if (excessiveReRenders) {
        score -= 15;
        issues.push('Excessive re-renders detected');
        recommendations.push('Check component dependencies and state management');
      }

      // Grade calculation
      const grade = score >= 90 ? 'A' :
                   score >= 80 ? 'B' :
                   score >= 70 ? 'C' :
                   score >= 60 ? 'D' : 'F';

      setHealthScore({
        score: Math.max(0, score),
        grade,
        issues,
        recommendations,
        metrics: {
          avgRenderTime,
          slowRenderRatio,
          memoryLeaks: hasMemoryLeak,
          excessiveReRenders
        }
      });
    });

    return unsubscribe;
  }, [componentName, hasMemoryLeak]);

  return healthScore;
}

// =========================
// PERFORMANCE COMPARISON HOOK
// =========================

/**
 * Hook to compare performance between different components or time periods
 */
export function usePerformanceComparison() {
  const compareComponents = useCallback((componentA: string, componentB: string) => {
    const store = performanceStore.getStore();

    const metricsA = store.metrics.filter(m => m.id.includes(componentA));
    const metricsB = store.metrics.filter(m => m.id.includes(componentB));

    const getStats = (metrics: RenderMetrics[]) => {
      if (metrics.length === 0) return null;

      const renderTimes = metrics.map(m => m.actualDuration);
      return {
        count: metrics.length,
        avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
        maxRenderTime: Math.max(...renderTimes),
        minRenderTime: Math.min(...renderTimes),
        slowRenders: metrics.filter(m => m.exceededThreshold).length
      };
    };

    const statsA = getStats(metricsA);
    const statsB = getStats(metricsB);

    if (!statsA || !statsB) {
      return null;
    }

    return {
      componentA,
      componentB,
      statsA,
      statsB,
      comparison: {
        avgRenderTimeDiff: statsA.avgRenderTime - statsB.avgRenderTime,
        maxRenderTimeDiff: statsA.maxRenderTime - statsB.maxRenderTime,
        slowRendersDiff: statsA.slowRenders - statsB.slowRenders,
        winner: statsA.avgRenderTime < statsB.avgRenderTime ? componentA : componentB
      }
    };
  }, []);

  const compareTimePeriods = useCallback((componentName: string, hours: number) => {
    const store = performanceStore.getStore();
    const now = Date.now();
    const cutoff = now - (hours * 60 * 60 * 1000);

    const allMetrics = store.metrics.filter(m => m.id.includes(componentName));
    const recentMetrics = allMetrics.filter(m => m.timestamp > cutoff);
    const olderMetrics = allMetrics.filter(m => m.timestamp <= cutoff);

    const getStats = (metrics: RenderMetrics[]) => {
      if (metrics.length === 0) return null;

      const renderTimes = metrics.map(m => m.actualDuration);
      return {
        count: metrics.length,
        avgRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
        slowRenders: metrics.filter(m => m.exceededThreshold).length
      };
    };

    const recentStats = getStats(recentMetrics);
    const olderStats = getStats(olderMetrics);

    if (!recentStats || !olderStats) {
      return null;
    }

    return {
      componentName,
      timeframe: `${hours} hours`,
      recent: recentStats,
      older: olderStats,
      trend: {
        avgRenderTimeChange: recentStats.avgRenderTime - olderStats.avgRenderTime,
        slowRendersChange: recentStats.slowRenders - olderStats.slowRenders,
        improving: recentStats.avgRenderTime < olderStats.avgRenderTime
      }
    };
  }, []);

  return {
    compareComponents,
    compareTimePeriods
  };
}

// =========================
// EXPORTS
// =========================

export type {
  InteractionMetric,
  MemoryMetric,
  PerformanceBatch,
  ComponentHealthScore
};