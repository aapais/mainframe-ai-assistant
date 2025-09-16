/**
 * Performance Monitoring Hook
 *
 * Comprehensive performance monitoring hook with:
 * - Real-time metrics collection
 * - Performance budget tracking
 * - Component render optimization
 * - Memory usage monitoring
 * - Network request tracking
 * - User interaction metrics
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ========================
// Types & Interfaces
// ========================

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'render' | 'network' | 'memory' | 'interaction' | 'custom';
  metadata?: Record<string, any>;
}

export interface PerformanceBudget {
  render_time: number;
  network_request: number;
  memory_usage: number;
  interaction_delay: number;
}

export interface ComponentPerformance {
  component_name: string;
  render_count: number;
  avg_render_time: number;
  last_render_time: number;
  total_render_time: number;
  slow_renders: number;
}

export interface NetworkMetric {
  url: string;
  method: string;
  duration: number;
  size: number;
  status: number;
  timestamp: number;
}

export interface UsePerformanceOptions {
  enableRenderTracking?: boolean;
  enableNetworkTracking?: boolean;
  enableMemoryTracking?: boolean;
  enableInteractionTracking?: boolean;
  budget?: Partial<PerformanceBudget>;
  samplingRate?: number;
  autoFlush?: boolean;
  flushInterval?: number;
  maxMetrics?: number;
}

export interface UsePerformanceReturn {
  metrics: PerformanceMetric[];
  componentMetrics: Map<string, ComponentPerformance>;
  networkMetrics: NetworkMetric[];
  memoryUsage: number;
  isOverBudget: boolean;
  budgetViolations: string[];
  // Measurement functions
  startMeasure: (name: string, metadata?: Record<string, any>) => string;
  endMeasure: (measureId: string) => PerformanceMetric | null;
  recordMetric: (name: string, value: number, type?: string, metadata?: Record<string, any>) => void;
  trackRender: (componentName: string) => () => void;
  trackInteraction: (eventName: string, metadata?: Record<string, any>) => void;
  // Utility functions
  getAverageMetric: (metricName: string) => number;
  getMetricHistory: (metricName: string, limit?: number) => PerformanceMetric[];
  clearMetrics: () => void;
  exportMetrics: () => string;
  // Performance analysis
  getSlowComponents: (threshold?: number) => ComponentPerformance[];
  getPerformanceScore: () => number;
  generateReport: () => PerformanceReport;
}

export interface PerformanceReport {
  timestamp: number;
  score: number;
  summary: {
    total_metrics: number;
    avg_render_time: number;
    slow_renders: number;
    memory_usage: number;
    network_requests: number;
    budget_violations: number;
  };
  components: ComponentPerformance[];
  violations: BudgetViolation[];
  recommendations: string[];
}

export interface BudgetViolation {
  metric: string;
  expected: number;
  actual: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
}

// ========================
// Default Configuration
// ========================

const DEFAULT_BUDGET: PerformanceBudget = {
  render_time: 16, // 60fps target
  network_request: 1000, // 1 second
  memory_usage: 100 * 1024 * 1024, // 100MB
  interaction_delay: 100 // 100ms
};

const DEFAULT_OPTIONS: Required<UsePerformanceOptions> = {
  enableRenderTracking: true,
  enableNetworkTracking: true,
  enableMemoryTracking: true,
  enableInteractionTracking: true,
  budget: DEFAULT_BUDGET,
  samplingRate: 1.0,
  autoFlush: true,
  flushInterval: 30000, // 30 seconds
  maxMetrics: 1000
};

// ========================
// Hook Implementation
// ========================

export const usePerformance = (
  options: UsePerformanceOptions = {}
): UsePerformanceReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const budget = { ...DEFAULT_BUDGET, ...config.budget };

  // State management
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [componentMetrics, setComponentMetrics] = useState<Map<string, ComponentPerformance>>(new Map());
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetric[]>([]);
  const [memoryUsage, setMemoryUsage] = useState(0);

  // Refs for active measurements
  const activeMeasures = useRef<Map<string, { name: string; startTime: number; metadata?: Record<string, any> }>>(new Map());
  const flushTimer = useRef<NodeJS.Timeout>();
  const measureIdCounter = useRef(0);

  // Performance Observer (if available)
  const observer = useRef<PerformanceObserver>();

  // Initialize performance monitoring
  useEffect(() => {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        observer.current = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'navigation' || entry.entryType === 'resource') {
              recordNetworkMetric(entry as PerformanceNavigationTiming | PerformanceResourceTiming);
            } else if (entry.entryType === 'measure') {
              recordCustomMeasure(entry as PerformanceMeasure);
            }
          });
        });

        observer.current.observe({ entryTypes: ['navigation', 'resource', 'measure'] });
      } catch (error) {
        console.warn('PerformanceObserver not available:', error);
      }
    }

    // Memory monitoring
    if (config.enableMemoryTracking) {
      startMemoryMonitoring();
    }

    // Auto-flush timer
    if (config.autoFlush) {
      flushTimer.current = setInterval(() => {
        if (metrics.length > config.maxMetrics) {
          flushOldMetrics();
        }
      }, config.flushInterval);
    }

    return () => {
      observer.current?.disconnect();
      if (flushTimer.current) {
        clearInterval(flushTimer.current);
      }
    };
  }, [config.enableMemoryTracking, config.autoFlush, config.flushInterval, config.maxMetrics]);

  // Start measurement
  const startMeasure = useCallback((name: string, metadata?: Record<string, any>): string => {
    if (Math.random() > config.samplingRate) {
      return ''; // Skip measurement based on sampling rate
    }

    const measureId = `measure_${++measureIdCounter.current}`;
    const startTime = performance.now();

    activeMeasures.current.set(measureId, {
      name,
      startTime,
      metadata
    });

    return measureId;
  }, [config.samplingRate]);

  // End measurement
  const endMeasure = useCallback((measureId: string): PerformanceMetric | null => {
    const measure = activeMeasures.current.get(measureId);
    if (!measure) return null;

    const endTime = performance.now();
    const duration = endTime - measure.startTime;

    const metric: PerformanceMetric = {
      name: measure.name,
      value: duration,
      timestamp: Date.now(),
      type: 'custom',
      metadata: measure.metadata
    };

    activeMeasures.current.delete(measureId);
    addMetric(metric);

    return metric;
  }, []);

  // Record metric directly
  const recordMetric = useCallback((
    name: string,
    value: number,
    type: string = 'custom',
    metadata?: Record<string, any>
  ) => {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type: type as PerformanceMetric['type'],
      metadata
    };

    addMetric(metric);
  }, []);

  // Track component render
  const trackRender = useCallback((componentName: string) => {
    if (!config.enableRenderTracking) return () => {};

    const startTime = performance.now();

    return () => {
      const renderTime = performance.now() - startTime;

      // Record render metric
      recordMetric(`${componentName}_render`, renderTime, 'render', {
        component: componentName
      });

      // Update component metrics
      setComponentMetrics(prev => {
        const current = prev.get(componentName) || {
          component_name: componentName,
          render_count: 0,
          avg_render_time: 0,
          last_render_time: 0,
          total_render_time: 0,
          slow_renders: 0
        };

        const newCount = current.render_count + 1;
        const newTotal = current.total_render_time + renderTime;
        const isSlowRender = renderTime > budget.render_time;

        const updated: ComponentPerformance = {
          ...current,
          render_count: newCount,
          avg_render_time: newTotal / newCount,
          last_render_time: renderTime,
          total_render_time: newTotal,
          slow_renders: current.slow_renders + (isSlowRender ? 1 : 0)
        };

        const newMap = new Map(prev);
        newMap.set(componentName, updated);
        return newMap;
      });

      // Check budget violation
      if (renderTime > budget.render_time) {
        checkBudgetViolation('render_time', renderTime, budget.render_time);
      }
    };
  }, [config.enableRenderTracking, budget.render_time]);

  // Track user interaction
  const trackInteraction = useCallback((eventName: string, metadata?: Record<string, any>) => {
    if (!config.enableInteractionTracking) return;

    const startTime = performance.now();

    // Use requestIdleCallback or setTimeout for delayed measurement
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        const interactionDelay = performance.now() - startTime;
        recordMetric(`interaction_${eventName}`, interactionDelay, 'interaction', metadata);

        if (interactionDelay > budget.interaction_delay) {
          checkBudgetViolation('interaction_delay', interactionDelay, budget.interaction_delay);
        }
      });
    } else {
      setTimeout(() => {
        const interactionDelay = performance.now() - startTime;
        recordMetric(`interaction_${eventName}`, interactionDelay, 'interaction', metadata);
      }, 0);
    }
  }, [config.enableInteractionTracking, budget.interaction_delay]);

  // Add metric to store
  const addMetric = useCallback((metric: PerformanceMetric) => {
    setMetrics(prev => {
      const updated = [...prev, metric];

      // Keep only recent metrics if over limit
      if (updated.length > config.maxMetrics) {
        return updated.slice(-config.maxMetrics);
      }

      return updated;
    });
  }, [config.maxMetrics]);

  // Record network metric from PerformanceEntry
  const recordNetworkMetric = useCallback((entry: PerformanceNavigationTiming | PerformanceResourceTiming) => {
    if (!config.enableNetworkTracking) return;

    const metric: NetworkMetric = {
      url: entry.name,
      method: 'GET', // Default, actual method not available from PerformanceEntry
      duration: entry.responseEnd - entry.requestStart,
      size: (entry as any).transferSize || 0,
      status: 200, // Default, actual status not available
      timestamp: Date.now()
    };

    setNetworkMetrics(prev => [...prev.slice(-99), metric]); // Keep last 100

    // Check budget
    if (metric.duration > budget.network_request) {
      checkBudgetViolation('network_request', metric.duration, budget.network_request);
    }
  }, [config.enableNetworkTracking, budget.network_request]);

  // Record custom measure
  const recordCustomMeasure = useCallback((entry: PerformanceMeasure) => {
    recordMetric(entry.name, entry.duration, 'custom', {
      detail: entry.detail
    });
  }, [recordMetric]);

  // Memory monitoring
  const startMemoryMonitoring = useCallback(() => {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const updateMemory = () => {
        const memory = (performance as any).memory;
        if (memory) {
          const usage = memory.usedJSHeapSize;
          setMemoryUsage(usage);

          recordMetric('memory_usage', usage, 'memory');

          if (usage > budget.memory_usage) {
            checkBudgetViolation('memory_usage', usage, budget.memory_usage);
          }
        }
      };

      updateMemory();
      const interval = setInterval(updateMemory, 5000); // Every 5 seconds

      return () => clearInterval(interval);
    }
  }, [budget.memory_usage]);

  // Budget violation checker
  const checkBudgetViolation = useCallback((metric: string, actual: number, expected: number) => {
    const severity = actual > expected * 2 ? 'high' :
                    actual > expected * 1.5 ? 'medium' : 'low';

    console.warn(`Performance budget violation: ${metric}`, {
      expected,
      actual,
      severity,
      overage: ((actual - expected) / expected * 100).toFixed(1) + '%'
    });
  }, []);

  // Flush old metrics
  const flushOldMetrics = useCallback(() => {
    setMetrics(prev => prev.slice(-Math.floor(config.maxMetrics * 0.8)));
  }, [config.maxMetrics]);

  // Computed values
  const isOverBudget = useMemo(() => {
    const recentMetrics = metrics.slice(-10);
    return recentMetrics.some(metric => {
      switch (metric.type) {
        case 'render':
          return metric.value > budget.render_time;
        case 'network':
          return metric.value > budget.network_request;
        case 'memory':
          return metric.value > budget.memory_usage;
        case 'interaction':
          return metric.value > budget.interaction_delay;
        default:
          return false;
      }
    });
  }, [metrics, budget]);

  const budgetViolations = useMemo(() => {
    const violations: string[] = [];
    const recentMetrics = metrics.slice(-50);

    const renderViolations = recentMetrics.filter(m =>
      m.type === 'render' && m.value > budget.render_time
    ).length;

    if (renderViolations > 0) {
      violations.push(`${renderViolations} render time violations`);
    }

    const networkViolations = networkMetrics.filter(m =>
      m.duration > budget.network_request
    ).length;

    if (networkViolations > 0) {
      violations.push(`${networkViolations} network request violations`);
    }

    if (memoryUsage > budget.memory_usage) {
      violations.push(`Memory usage over budget`);
    }

    return violations;
  }, [metrics, networkMetrics, memoryUsage, budget]);

  // Utility functions
  const getAverageMetric = useCallback((metricName: string): number => {
    const matchingMetrics = metrics.filter(m => m.name === metricName);
    if (matchingMetrics.length === 0) return 0;

    const sum = matchingMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / matchingMetrics.length;
  }, [metrics]);

  const getMetricHistory = useCallback((metricName: string, limit: number = 50): PerformanceMetric[] => {
    return metrics
      .filter(m => m.name === metricName)
      .slice(-limit)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [metrics]);

  const clearMetrics = useCallback(() => {
    setMetrics([]);
    setComponentMetrics(new Map());
    setNetworkMetrics([]);
    activeMeasures.current.clear();
  }, []);

  const exportMetrics = useCallback((): string => {
    const exportData = {
      timestamp: Date.now(),
      metrics,
      componentMetrics: Array.from(componentMetrics.entries()),
      networkMetrics,
      memoryUsage,
      budget,
      violations: budgetViolations
    };

    return JSON.stringify(exportData, null, 2);
  }, [metrics, componentMetrics, networkMetrics, memoryUsage, budget, budgetViolations]);

  const getSlowComponents = useCallback((threshold: number = budget.render_time): ComponentPerformance[] => {
    return Array.from(componentMetrics.values())
      .filter(comp => comp.avg_render_time > threshold)
      .sort((a, b) => b.avg_render_time - a.avg_render_time);
  }, [componentMetrics, budget.render_time]);

  const getPerformanceScore = useCallback((): number => {
    let score = 100;

    // Render performance (40% weight)
    const avgRenderTime = getAverageMetric('render');
    if (avgRenderTime > budget.render_time) {
      score -= Math.min(30, (avgRenderTime - budget.render_time) / budget.render_time * 40);
    }

    // Network performance (30% weight)
    const avgNetworkTime = networkMetrics.length > 0
      ? networkMetrics.reduce((sum, m) => sum + m.duration, 0) / networkMetrics.length
      : 0;
    if (avgNetworkTime > budget.network_request) {
      score -= Math.min(25, (avgNetworkTime - budget.network_request) / budget.network_request * 30);
    }

    // Memory usage (20% weight)
    if (memoryUsage > budget.memory_usage) {
      score -= Math.min(15, (memoryUsage - budget.memory_usage) / budget.memory_usage * 20);
    }

    // Interaction delay (10% weight)
    const avgInteractionDelay = getAverageMetric('interaction');
    if (avgInteractionDelay > budget.interaction_delay) {
      score -= Math.min(10, (avgInteractionDelay - budget.interaction_delay) / budget.interaction_delay * 10);
    }

    return Math.max(0, Math.round(score));
  }, [getAverageMetric, networkMetrics, memoryUsage, budget]);

  const generateReport = useCallback((): PerformanceReport => {
    const slowComponents = getSlowComponents();
    const score = getPerformanceScore();

    const violations: BudgetViolation[] = [];
    const recommendations: string[] = [];

    // Analyze violations and generate recommendations
    if (slowComponents.length > 0) {
      violations.push({
        metric: 'render_time',
        expected: budget.render_time,
        actual: slowComponents[0].avg_render_time,
        severity: slowComponents[0].avg_render_time > budget.render_time * 2 ? 'high' : 'medium',
        timestamp: Date.now()
      });

      recommendations.push(`Optimize ${slowComponents[0].component_name} component rendering`);
    }

    if (memoryUsage > budget.memory_usage) {
      violations.push({
        metric: 'memory_usage',
        expected: budget.memory_usage,
        actual: memoryUsage,
        severity: 'medium',
        timestamp: Date.now()
      });

      recommendations.push('Consider implementing memory optimization strategies');
    }

    if (networkMetrics.some(m => m.duration > budget.network_request)) {
      recommendations.push('Optimize network requests with caching or request bundling');
    }

    return {
      timestamp: Date.now(),
      score,
      summary: {
        total_metrics: metrics.length,
        avg_render_time: getAverageMetric('render'),
        slow_renders: Array.from(componentMetrics.values()).reduce((sum, comp) => sum + comp.slow_renders, 0),
        memory_usage: memoryUsage,
        network_requests: networkMetrics.length,
        budget_violations: violations.length
      },
      components: Array.from(componentMetrics.values()),
      violations,
      recommendations
    };
  }, [getSlowComponents, getPerformanceScore, metrics, componentMetrics, networkMetrics, memoryUsage, budget, getAverageMetric]);

  return {
    metrics,
    componentMetrics,
    networkMetrics,
    memoryUsage,
    isOverBudget,
    budgetViolations,
    startMeasure,
    endMeasure,
    recordMetric,
    trackRender,
    trackInteraction,
    getAverageMetric,
    getMetricHistory,
    clearMetrics,
    exportMetrics,
    getSlowComponents,
    getPerformanceScore,
    generateReport
  };
};

export default usePerformance;