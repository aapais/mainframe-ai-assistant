/**
 * Performance Monitoring Hook
 *
 * Provides comprehensive performance monitoring capabilities for React components
 * including render time tracking, memory usage, and performance bottleneck detection.
 *
 * Features:
 * - Render performance tracking
 * - Memory usage monitoring
 * - Component re-render counting
 * - Performance bottleneck detection
 * - Automatic performance warnings
 *
 * @author Performance Engineer
 * @version 2.0.0
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// ========================
// Types & Interfaces
// ========================

export interface PerformanceMetrics {
  /** Component render time in milliseconds */
  renderTime: number;
  /** Number of re-renders since hook initialization */
  renderCount: number;
  /** Memory usage in MB (when available) */
  memoryUsage?: number;
  /** Last performance measurement timestamp */
  lastMeasurement: number;
  /** Performance score (0-100, higher is better) */
  performanceScore: number;
  /** Detected performance issues */
  issues: PerformanceIssue[];
}

export interface PerformanceIssue {
  /** Issue type */
  type: 'slow-render' | 'excessive-rerenders' | 'memory-leak' | 'large-dom';
  /** Issue severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable issue description */
  message: string;
  /** Suggested fix for the issue */
  suggestion: string;
  /** Timestamp when issue was detected */
  detectedAt: number;
}

export interface PerformanceOptions {
  /** Component name for tracking */
  componentName?: string;
  /** Enable automatic performance warnings */
  enableWarnings?: boolean;
  /** Render time threshold for warnings (ms) */
  slowRenderThreshold?: number;
  /** Re-render count threshold for warnings */
  excessiveRerenderThreshold?: number;
  /** Enable memory monitoring */
  enableMemoryMonitoring?: boolean;
  /** Sampling rate for performance measurements (0-1) */
  samplingRate?: number;
}

export interface PerformanceHookReturn {
  /** Current performance metrics */
  metrics: PerformanceMetrics;
  /** Start performance measurement */
  startMeasurement: () => void;
  /** End performance measurement */
  endMeasurement: () => void;
  /** Reset performance counters */
  resetMetrics: () => void;
  /** Check if performance is within acceptable bounds */
  isPerformanceAcceptable: boolean;
  /** Get performance recommendations */
  getRecommendations: () => string[];
}

// ========================
// Performance Utilities
// ========================

/**
 * Calculates performance score based on metrics
 */
const calculatePerformanceScore = (renderTime: number, renderCount: number, memoryUsage?: number): number => {
  let score = 100;

  // Penalize slow renders (exponential penalty after 16ms)
  if (renderTime > 16) {
    score -= Math.min(50, Math.pow((renderTime - 16) / 16, 1.5) * 20);
  }

  // Penalize excessive re-renders (linear penalty after 10 renders)
  if (renderCount > 10) {
    score -= Math.min(30, (renderCount - 10) * 2);
  }

  // Penalize high memory usage (if available)
  if (memoryUsage && memoryUsage > 50) {
    score -= Math.min(20, (memoryUsage - 50) / 10);
  }

  return Math.max(0, Math.round(score));
};

/**
 * Detects performance issues based on metrics
 */
const detectPerformanceIssues = (
  renderTime: number,
  renderCount: number,
  memoryUsage: number | undefined,
  componentName: string,
  thresholds: { slowRender: number; excessiveRerender: number }
): PerformanceIssue[] => {
  const issues: PerformanceIssue[] = [];
  const now = Date.now();

  // Slow render detection
  if (renderTime > thresholds.slowRender) {
    const severity: PerformanceIssue['severity'] =
      renderTime > 100 ? 'critical' :
      renderTime > 50 ? 'high' :
      renderTime > 25 ? 'medium' : 'low';

    issues.push({
      type: 'slow-render',
      severity,
      message: `${componentName} render took ${renderTime.toFixed(2)}ms`,
      suggestion: 'Consider memoizing expensive calculations, using React.memo, or implementing virtual scrolling',
      detectedAt: now
    });
  }

  // Excessive re-renders detection
  if (renderCount > thresholds.excessiveRerender) {
    const severity: PerformanceIssue['severity'] =
      renderCount > 100 ? 'critical' :
      renderCount > 50 ? 'high' :
      renderCount > 25 ? 'medium' : 'low';

    issues.push({
      type: 'excessive-rerenders',
      severity,
      message: `${componentName} has re-rendered ${renderCount} times`,
      suggestion: 'Check for unnecessary state updates, use useCallback for event handlers, and memoize complex calculations',
      detectedAt: now
    });
  }

  // Memory usage detection (if available)
  if (memoryUsage && memoryUsage > 100) {
    const severity: PerformanceIssue['severity'] =
      memoryUsage > 500 ? 'critical' :
      memoryUsage > 250 ? 'high' :
      memoryUsage > 150 ? 'medium' : 'low';

    issues.push({
      type: 'memory-leak',
      severity,
      message: `High memory usage detected: ${memoryUsage.toFixed(2)}MB`,
      suggestion: 'Check for memory leaks, cleanup event listeners, and consider implementing data virtualization',
      detectedAt: now
    });
  }

  return issues;
};

/**
 * Gets memory usage if performance.memory is available (Chrome only)
 */
const getMemoryUsage = (): number | undefined => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const performance = window.performance as any;
    if (performance.memory) {
      // Convert bytes to MB
      return performance.memory.usedJSHeapSize / (1024 * 1024);
    }
  }
  return undefined;
};

// ========================
// Performance Hook
// ========================

/**
 * Performance monitoring hook for React components
 *
 * Usage:
 * ```tsx
 * const { metrics, startMeasurement, endMeasurement, isPerformanceAcceptable } =
 *   usePerformanceMonitor({ componentName: 'SearchResults' });
 *
 * useEffect(() => {
 *   startMeasurement();
 *   // Component logic
 *   endMeasurement();
 * }, [dependency]);
 * ```
 */
export const usePerformanceMonitor = (options: PerformanceOptions = {}): PerformanceHookReturn => {
  const {
    componentName = 'Unknown Component',
    enableWarnings = true,
    slowRenderThreshold = 16,
    excessiveRerenderThreshold = 20,
    enableMemoryMonitoring = true,
    samplingRate = 1.0
  } = options;

  // Performance tracking state
  const [renderCount, setRenderCount] = useState(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    renderCount: 0,
    memoryUsage: undefined,
    lastMeasurement: Date.now(),
    performanceScore: 100,
    issues: []
  });

  // Refs for performance tracking
  const measurementStartTime = useRef<number>(0);
  const performanceObserver = useRef<PerformanceObserver | null>(null);
  const warningsRef = useRef(new Set<string>());

  // Increment render count on each render
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  });

  // Initialize performance observer for advanced metrics
  useEffect(() => {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window && Math.random() < samplingRate) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.name.includes(componentName)) {
              // Process performance entries
              console.debug(`Performance entry for ${componentName}:`, entry);
            }
          }
        });

        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
        performanceObserver.current = observer;

        return () => {
          observer.disconnect();
        };
      } catch (error) {
        console.warn('Failed to initialize PerformanceObserver:', error);
      }
    }
  }, [componentName, samplingRate]);

  // Start performance measurement
  const startMeasurement = useCallback(() => {
    measurementStartTime.current = performance.now();
  }, []);

  // End performance measurement and update metrics
  const endMeasurement = useCallback(() => {
    const endTime = performance.now();
    const renderTime = endTime - measurementStartTime.current;

    // Only sample based on sampling rate to reduce overhead
    if (Math.random() > samplingRate) return;

    const memoryUsage = enableMemoryMonitoring ? getMemoryUsage() : undefined;
    const performanceScore = calculatePerformanceScore(renderTime, renderCount, memoryUsage);
    const issues = detectPerformanceIssues(
      renderTime,
      renderCount,
      memoryUsage,
      componentName,
      { slowRender: slowRenderThreshold, excessiveRerender: excessiveRerenderThreshold }
    );

    // Update metrics
    setMetrics({
      renderTime,
      renderCount,
      memoryUsage,
      lastMeasurement: Date.now(),
      performanceScore,
      issues
    });

    // Emit warnings for performance issues
    if (enableWarnings && issues.length > 0) {
      issues.forEach(issue => {
        const warningKey = `${issue.type}-${issue.severity}`;
        if (!warningsRef.current.has(warningKey)) {
          warningsRef.current.add(warningKey);
          console.warn(`🚨 Performance Issue in ${componentName}:`, issue);
        }
      });
    }

    // Mark performance in browser DevTools
    if (typeof window !== 'undefined' && window.performance?.mark) {
      performance.mark(`${componentName}-render-${renderCount}`);
      if (renderTime > slowRenderThreshold) {
        performance.mark(`${componentName}-slow-render-${renderCount}`);
      }
    }
  }, [
    renderCount,
    componentName,
    enableWarnings,
    enableMemoryMonitoring,
    slowRenderThreshold,
    excessiveRerenderThreshold,
    samplingRate
  ]);

  // Reset performance metrics
  const resetMetrics = useCallback(() => {
    setRenderCount(0);
    setMetrics({
      renderTime: 0,
      renderCount: 0,
      memoryUsage: undefined,
      lastMeasurement: Date.now(),
      performanceScore: 100,
      issues: []
    });
    warningsRef.current.clear();
  }, []);

  // Calculate if performance is acceptable
  const isPerformanceAcceptable = useMemo(() => {
    return metrics.performanceScore > 70 &&
           metrics.issues.filter(issue => issue.severity === 'critical' || issue.severity === 'high').length === 0;
  }, [metrics.performanceScore, metrics.issues]);

  // Generate performance recommendations
  const getRecommendations = useCallback((): string[] => {
    const recommendations: string[] = [];

    if (metrics.renderTime > slowRenderThreshold) {
      recommendations.push('Consider using React.memo() to prevent unnecessary re-renders');
      recommendations.push('Implement virtual scrolling for large lists');
      recommendations.push('Use useMemo() for expensive calculations');
      recommendations.push('Lazy load components and images');
    }

    if (metrics.renderCount > excessiveRerenderThreshold) {
      recommendations.push('Use useCallback() to memoize event handlers');
      recommendations.push('Optimize state structure to minimize updates');
      recommendations.push('Consider state management libraries like Zustand');
    }

    if (metrics.memoryUsage && metrics.memoryUsage > 100) {
      recommendations.push('Implement proper cleanup in useEffect');
      recommendations.push('Use WeakMap/WeakSet for caching when appropriate');
      recommendations.push('Consider data virtualization techniques');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal! Keep up the good work.');
    }

    return recommendations;
  }, [metrics.renderTime, metrics.renderCount, metrics.memoryUsage, slowRenderThreshold, excessiveRerenderThreshold]);

  return {
    metrics,
    startMeasurement,
    endMeasurement,
    resetMetrics,
    isPerformanceAcceptable,
    getRecommendations
  };
};

export default usePerformanceMonitor;