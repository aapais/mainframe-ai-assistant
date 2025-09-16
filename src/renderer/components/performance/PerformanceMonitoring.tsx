import React, { Component, ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce, throttle } from 'lodash';

/**
 * Performance Monitoring HOCs and Utilities
 */

// Performance metrics interfaces
export interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
  lastUpdateTime: number;
  memoryUsage?: MemoryInfo;
  componentName: string;
  timestamp: number;
}

export interface RenderProfileData {
  componentName: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  lastRenderTime: number;
  memorySnapshots: MemoryInfo[];
}

export interface PerformanceReport {
  components: Record<string, RenderProfileData>;
  totalComponents: number;
  slowestComponent: string;
  heaviestComponent: string;
  recommendations: string[];
}

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private observers: Set<(report: PerformanceReport) => void> = new Set();
  private isEnabled: boolean = process.env.NODE_ENV === 'development';
  private reportInterval: NodeJS.Timer | null = null;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== 'undefined' && this.isEnabled) {
      this.startMonitoring();
    }
  }

  private startMonitoring() {
    // Monitor overall performance
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.startsWith('React')) {
            console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance observer not fully supported:', error);
      }
    }

    // Generate reports periodically
    this.reportInterval = setInterval(() => {
      this.generateReport();
    }, 30000); // Every 30 seconds
  }

  enable() {
    this.isEnabled = true;
    if (typeof window !== 'undefined' && !this.reportInterval) {
      this.startMonitoring();
    }
  }

  disable() {
    this.isEnabled = false;
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  recordMetrics(componentName: string, metrics: Omit<PerformanceMetrics, 'componentName' | 'timestamp'>) {
    if (!this.isEnabled) return;

    const fullMetrics: PerformanceMetrics = {
      ...metrics,
      componentName,
      timestamp: performance.now(),
      memoryUsage: (performance as any).memory || undefined
    };

    if (!this.metrics.has(componentName)) {
      this.metrics.set(componentName, []);
    }

    const componentMetrics = this.metrics.get(componentName)!;
    componentMetrics.push(fullMetrics);

    // Keep only last 100 metrics per component
    if (componentMetrics.length > 100) {
      componentMetrics.shift();
    }
  }

  getMetrics(componentName?: string): PerformanceMetrics[] | Map<string, PerformanceMetrics[]> {
    if (componentName) {
      return this.metrics.get(componentName) || [];
    }
    return this.metrics;
  }

  clearMetrics(componentName?: string) {
    if (componentName) {
      this.metrics.delete(componentName);
    } else {
      this.metrics.clear();
    }
  }

  generateReport(): PerformanceReport {
    const components: Record<string, RenderProfileData> = {};
    let slowestComponent = '';
    let heaviestComponent = '';
    let maxRenderTime = 0;
    let maxMemoryUsage = 0;

    this.metrics.forEach((metrics, componentName) => {
      if (metrics.length === 0) return;

      const renderTimes = metrics.map(m => m.renderTime).filter(t => t > 0);
      const totalRenderTime = renderTimes.reduce((sum, time) => sum + time, 0);
      const averageRenderTime = totalRenderTime / renderTimes.length || 0;
      const maxComponentRenderTime = Math.max(...renderTimes, 0);
      const minComponentRenderTime = Math.min(...renderTimes.filter(t => t > 0), 0);
      const lastRenderTime = metrics[metrics.length - 1]?.renderTime || 0;
      const memorySnapshots = metrics
        .map(m => m.memoryUsage)
        .filter(Boolean) as MemoryInfo[];

      const profileData: RenderProfileData = {
        componentName,
        renderCount: metrics.length,
        totalRenderTime,
        averageRenderTime,
        maxRenderTime: maxComponentRenderTime,
        minRenderTime: minComponentRenderTime,
        lastRenderTime,
        memorySnapshots
      };

      components[componentName] = profileData;

      // Track slowest component
      if (averageRenderTime > maxRenderTime) {
        maxRenderTime = averageRenderTime;
        slowestComponent = componentName;
      }

      // Track heaviest memory usage
      const avgMemory = memorySnapshots.reduce((sum, mem) => sum + mem.usedJSHeapSize, 0) / memorySnapshots.length;
      if (avgMemory > maxMemoryUsage) {
        maxMemoryUsage = avgMemory;
        heaviestComponent = componentName;
      }
    });

    const recommendations = this.generateRecommendations(components);

    const report: PerformanceReport = {
      components,
      totalComponents: Object.keys(components).length,
      slowestComponent,
      heaviestComponent,
      recommendations
    };

    this.notifyObservers(report);
    return report;
  }

  private generateRecommendations(components: Record<string, RenderProfileData>): string[] {
    const recommendations: string[] = [];

    Object.entries(components).forEach(([name, data]) => {
      if (data.averageRenderTime > 16) {
        recommendations.push(`${name}: Consider optimizing render time (avg: ${data.averageRenderTime.toFixed(2)}ms)`);
      }
      
      if (data.renderCount > 50) {
        recommendations.push(`${name}: High render frequency (${data.renderCount} renders) - check for unnecessary re-renders`);
      }
      
      if (data.memorySnapshots.length > 0) {
        const avgMemory = data.memorySnapshots.reduce((sum, mem) => sum + mem.usedJSHeapSize, 0) / data.memorySnapshots.length;
        if (avgMemory > 50 * 1024 * 1024) { // 50MB
          recommendations.push(`${name}: High memory usage (${(avgMemory / 1024 / 1024).toFixed(2)}MB)`);
        }
      }
    });

    return recommendations;
  }

  subscribe(observer: (report: PerformanceReport) => void): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  private notifyObservers(report: PerformanceReport) {
    this.observers.forEach(observer => {
      try {
        observer(report);
      } catch (error) {
        console.error('Error in performance observer:', error);
      }
    });
  }

  exportMetrics(): string {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics),
      report: this.generateReport()
    };
    return JSON.stringify(data, null, 2);
  }
}

/**
 * HOC for performance monitoring
 */
export interface WithPerformanceProps {
  enableProfiling?: boolean;
  profileThreshold?: number;
  onSlowRender?: (renderTime: number) => void;
}

export function withPerformance<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: {
    displayName?: string;
    trackMemory?: boolean;
    warnThreshold?: number;
  } = {}
) {
  const {
    displayName = WrappedComponent.displayName || WrappedComponent.name,
    trackMemory = true,
    warnThreshold = 16
  } = options;

  const PerformanceWrapper = React.forwardRef<any, P & WithPerformanceProps>(
    (props, ref) => {
      const {
        enableProfiling = true,
        profileThreshold = warnThreshold,
        onSlowRender,
        ...restProps
      } = props;

      const renderStartTime = useRef<number>(0);
      const mountTime = useRef<number>(0);
      const updateCount = useRef<number>(0);
      const monitor = PerformanceMonitor.getInstance();

      // Track mount time
      useEffect(() => {
        mountTime.current = performance.now() - renderStartTime.current;
        
        if (enableProfiling) {
          monitor.recordMetrics(displayName, {
            renderTime: mountTime.current,
            mountTime: mountTime.current,
            updateCount: 0,
            lastUpdateTime: performance.now()
          });
        }
      }, [enableProfiling, displayName]);

      // Track render performance
      const trackRender = useCallback(() => {
        if (!enableProfiling) return;

        renderStartTime.current = performance.now();
      }, [enableProfiling]);

      const recordRender = useCallback(() => {
        if (!enableProfiling) return;

        const renderTime = performance.now() - renderStartTime.current;
        updateCount.current += 1;

        monitor.recordMetrics(displayName, {
          renderTime,
          mountTime: mountTime.current,
          updateCount: updateCount.current,
          lastUpdateTime: performance.now()
        });

        // Warn about slow renders
        if (renderTime > profileThreshold) {
          console.warn(`Slow render detected in ${displayName}: ${renderTime.toFixed(2)}ms`);
          onSlowRender?.(renderTime);
        }
      }, [enableProfiling, displayName, profileThreshold, onSlowRender]);

      // Track start of render
      useEffect(() => {
        trackRender();
      });

      // Track end of render
      useEffect(() => {
        recordRender();
      });

      return <WrappedComponent {...(restProps as P)} ref={ref} />;
    }
  );

  PerformanceWrapper.displayName = `withPerformance(${displayName})`;
  return PerformanceWrapper;
}

/**
 * HOC for render optimization
 */
export interface OptimizedComponentProps {
  optimizationLevel?: 'none' | 'shallow' | 'deep';
  customComparison?: (prevProps: any, nextProps: any) => boolean;
}

export function withOptimization<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: {
    memo?: boolean;
    defaultOptimization?: 'shallow' | 'deep';
  } = {}
) {
  const { memo = true, defaultOptimization = 'shallow' } = options;

  let OptimizedComponent: ComponentType<P & OptimizedComponentProps>;

  const BaseComponent = React.forwardRef<any, P & OptimizedComponentProps>(
    ({ optimizationLevel = defaultOptimization, customComparison, ...props }, ref) => {
      return <WrappedComponent {...(props as P)} ref={ref} />;
    }
  );

  if (memo) {
    OptimizedComponent = React.memo(BaseComponent, (prevProps, nextProps) => {
      const { customComparison, optimizationLevel = defaultOptimization } = nextProps;
      
      if (customComparison) {
        return customComparison(prevProps, nextProps);
      }
      
      if (optimizationLevel === 'none') {
        return false; // Always re-render
      }
      
      if (optimizationLevel === 'deep') {
        return JSON.stringify(prevProps) === JSON.stringify(nextProps);
      }
      
      // Shallow comparison (default)
      const prevKeys = Object.keys(prevProps);
      const nextKeys = Object.keys(nextProps);
      
      if (prevKeys.length !== nextKeys.length) {
        return false;
      }
      
      return prevKeys.every(key => {
        return prevProps[key] === nextProps[key];
      });
    });
  } else {
    OptimizedComponent = BaseComponent;
  }

  OptimizedComponent.displayName = `withOptimization(${WrappedComponent.displayName || WrappedComponent.name})`;
  return OptimizedComponent;
}

/**
 * Performance monitoring hooks
 */

// Hook for component performance tracking
export function usePerformanceTracking(
  componentName: string,
  enabled: boolean = true
) {
  const renderStartTime = useRef<number>(0);
  const monitor = PerformanceMonitor.getInstance();
  const renderCount = useRef<number>(0);

  const startTracking = useCallback(() => {
    if (!enabled) return;
    renderStartTime.current = performance.now();
  }, [enabled]);

  const endTracking = useCallback(() => {
    if (!enabled) return;
    
    const renderTime = performance.now() - renderStartTime.current;
    renderCount.current += 1;
    
    monitor.recordMetrics(componentName, {
      renderTime,
      mountTime: renderCount.current === 1 ? renderTime : 0,
      updateCount: renderCount.current,
      lastUpdateTime: performance.now()
    });
  }, [enabled, componentName, monitor]);

  return { startTracking, endTracking };
}

// Hook for memory monitoring
export function useMemoryMonitoring(interval: number = 5000) {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'memory' in performance;
    setIsSupported(supported);

    if (!supported) return;

    const updateMemoryInfo = () => {
      setMemoryInfo((performance as any).memory);
    };

    updateMemoryInfo();
    const intervalId = setInterval(updateMemoryInfo, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return { memoryInfo, isSupported };
}

// Hook for render counting
export function useRenderCount(componentName?: string) {
  const renderCount = useRef<number>(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    renderCount.current += 1;
    setCount(renderCount.current);
    
    if (componentName && process.env.NODE_ENV === 'development') {
      console.log(`${componentName} rendered ${renderCount.current} times`);
    }
  });

  return count;
}

// Hook for slow render detection
export function useSlowRenderDetection(
  threshold: number = 16,
  onSlowRender?: (renderTime: number) => void
) {
  const renderStartTime = useRef<number>(0);
  const [slowRenders, setSlowRenders] = useState<number[]>([]);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    
    if (renderTime > threshold) {
      setSlowRenders(prev => [...prev.slice(-9), renderTime]); // Keep last 10
      onSlowRender?.(renderTime);
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
      }
    }
  });

  return {
    slowRenders,
    averageSlowRender: slowRenders.length > 0 
      ? slowRenders.reduce((sum, time) => sum + time, 0) / slowRenders.length 
      : 0,
    slowRenderCount: slowRenders.length
  };
}

/**
 * Performance dashboard component
 */
export interface PerformanceDashboardProps {
  refreshInterval?: number;
  showRecommendations?: boolean;
  onExport?: (data: string) => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  refreshInterval = 5000,
  showRecommendations = true,
  onExport
}) => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const monitor = PerformanceMonitor.getInstance();
  const { memoryInfo } = useMemoryMonitoring(1000);

  useEffect(() => {
    const unsubscribe = monitor.subscribe(setReport);
    setReport(monitor.generateReport());

    const interval = setInterval(() => {
      setReport(monitor.generateReport());
    }, refreshInterval);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [monitor, refreshInterval]);

  const handleExport = () => {
    const data = monitor.exportMetrics();
    onExport?.(data);
    
    // Default download
    if (!onExport) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        maxWidth: '400px',
        display: isVisible ? 'block' : 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>Performance Dashboard</h3>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ×
        </button>
      </div>
      
      {memoryInfo && (
        <div style={{ marginBottom: '10px' }}>
          <strong>Memory:</strong> {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB / 
          {(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB
        </div>
      )}
      
      {report && (
        <>
          <div style={{ marginBottom: '10px' }}>
            <strong>Components:</strong> {report.totalComponents}<br/>
            {report.slowestComponent && (
              <><strong>Slowest:</strong> {report.slowestComponent}<br/></>
            )}
            {report.heaviestComponent && (
              <><strong>Heaviest:</strong> {report.heaviestComponent}<br/></>
            )}
          </div>
          
          {showRecommendations && report.recommendations.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <strong>Recommendations:</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '15px' }}>
                {report.recommendations.slice(0, 3).map((rec, index) => (
                  <li key={index} style={{ marginBottom: '2px' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={handleExport}
              style={{
                background: '#007acc',
                border: 'none',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Export
            </button>
            <button
              onClick={() => monitor.clearMetrics()}
              style={{
                background: '#cc4400',
                border: 'none',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Toggle button for performance dashboard
export const PerformanceToggle: React.FC<{
  onToggle: (visible: boolean) => void;
}> = ({ onToggle }) => {
  const [visible, setVisible] = useState(false);
  
  const handleToggle = () => {
    const newVisible = !visible;
    setVisible(newVisible);
    onToggle(newVisible);
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <button
      onClick={handleToggle}
      style={{
        position: 'fixed',
        top: 10,
        right: visible ? 420 : 10,
        zIndex: 10000,
        background: '#007acc',
        border: 'none',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '11px',
        fontFamily: 'monospace'
      }}
    >
      {visible ? 'Hide' : 'Show'} Perf
    </button>
  );
};

// Export the performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();
