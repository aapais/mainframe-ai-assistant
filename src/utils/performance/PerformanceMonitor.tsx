/**
 * Performance Monitoring Utilities
 * Comprehensive performance tracking and optimization tools
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

export interface PerformanceMetrics {
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  renderCount: number;
  rerenderReasons: string[];
}

export interface ComponentPerformanceData {
  componentName: string;
  renderTime: number;
  renderCount: number;
  propsChanged: boolean;
  contextChanged: boolean;
  timestamp: number;
}

class PerformanceTracker {
  private static instance: PerformanceTracker;
  private metrics: PerformanceMetrics;
  private componentData: Map<string, ComponentPerformanceData[]>;
  private observers: Map<string, PerformanceObserver>;
  private onMetricsUpdate: ((metrics: PerformanceMetrics) => void) | null = null;

  private constructor() {
    this.metrics = {
      fcp: null,
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null,
      renderCount: 0,
      rerenderReasons: [],
    };
    this.componentData = new Map();
    this.observers = new Map();
    this.initializeObservers();
  }

  public static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  private initializeObservers(): void {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    // Observe paint metrics (FCP, LCP)
    try {
      const paintObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
          }
        }
        this.notifyUpdate();
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.set('paint', paintObserver);
    } catch (e) {
      console.warn('Paint observer not supported:', e);
    }

    // Observe LCP
    try {
      const lcpObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          this.metrics.lcp = entries[entries.length - 1].startTime;
          this.notifyUpdate();
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.set('lcp', lcpObserver);
    } catch (e) {
      console.warn('LCP observer not supported:', e);
    }

    // Observe FID
    try {
      const fidObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.metrics.fid = (entry as any).processingStart - entry.startTime;
        }
        this.notifyUpdate();
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.set('fid', fidObserver);
    } catch (e) {
      console.warn('FID observer not supported:', e);
    }

    // Observe CLS
    try {
      const clsObserver = new PerformanceObserver(list => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.metrics.cls = clsValue;
        this.notifyUpdate();
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('cls', clsObserver);
    } catch (e) {
      console.warn('CLS observer not supported:', e);
    }

    // Get TTFB from navigation timing
    if (window.performance && window.performance.timing) {
      const { responseStart, navigationStart } = window.performance.timing;
      this.metrics.ttfb = responseStart - navigationStart;
    }
  }

  public trackComponentRender(
    componentName: string,
    renderTime: number,
    reasons: string[] = []
  ): void {
    if (!this.componentData.has(componentName)) {
      this.componentData.set(componentName, []);
    }

    const data = this.componentData.get(componentName)!;
    data.push({
      componentName,
      renderTime,
      renderCount: data.length + 1,
      propsChanged: reasons.includes('props'),
      contextChanged: reasons.includes('context'),
      timestamp: Date.now(),
    });

    this.metrics.renderCount++;
    this.metrics.rerenderReasons.push(...reasons);
    this.notifyUpdate();
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getComponentData(componentName?: string): ComponentPerformanceData[] {
    if (componentName) {
      return this.componentData.get(componentName) || [];
    }
    return Array.from(this.componentData.values()).flat();
  }

  public onUpdate(callback: (metrics: PerformanceMetrics) => void): void {
    this.onMetricsUpdate = callback;
  }

  private notifyUpdate(): void {
    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(this.getMetrics());
    }
  }

  public generateReport(): string {
    const metrics = this.getMetrics();
    const componentData = this.getComponentData();

    return `
Performance Report:
==================
FCP: ${metrics.fcp ? `${metrics.fcp.toFixed(2)}ms` : 'N/A'}
LCP: ${metrics.lcp ? `${metrics.lcp.toFixed(2)}ms` : 'N/A'}
FID: ${metrics.fid ? `${metrics.fid.toFixed(2)}ms` : 'N/A'}
CLS: ${metrics.cls ? metrics.cls.toFixed(4) : 'N/A'}
TTFB: ${metrics.ttfb ? `${metrics.ttfb.toFixed(2)}ms` : 'N/A'}

Component Renders: ${metrics.renderCount}
Top Rerender Reasons: ${[...new Set(metrics.rerenderReasons)].slice(0, 5).join(', ')}

Most Rendered Components:
${Array.from(this.componentData.entries())
  .sort(([, a], [, b]) => b.length - a.length)
  .slice(0, 5)
  .map(([name, data]) => `- ${name}: ${data.length} renders`)
  .join('\n')}
    `.trim();
  }

  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// React Hook for Performance Monitoring
export const usePerformanceTracking = (componentName: string) => {
  const renderStartTime = useRef<number>(Date.now());
  const previousProps = useRef<any>(null);
  const renderCount = useRef<number>(0);
  const tracker = PerformanceTracker.getInstance();

  const trackRender = useCallback(
    (props?: any, reasons: string[] = []) => {
      const renderTime = Date.now() - renderStartTime.current;
      renderCount.current++;

      // Detect prop changes
      if (previousProps.current && props) {
        const propsChanged = JSON.stringify(previousProps.current) !== JSON.stringify(props);
        if (propsChanged) reasons.push('props');
      }

      tracker.trackComponentRender(componentName, renderTime, reasons);
      previousProps.current = props;
      renderStartTime.current = Date.now();
    },
    [componentName, tracker]
  );

  useEffect(() => {
    trackRender();
  });

  return { trackRender, renderCount: renderCount.current };
};

// Performance Monitoring Dashboard Component
export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(
    PerformanceTracker.getInstance().getMetrics()
  );
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const tracker = PerformanceTracker.getInstance();
    tracker.onUpdate(setMetrics);

    // Show dashboard on Ctrl+Shift+P
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      tracker.cleanup();
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const getScoreColor = (score: number | null, thresholds: [number, number]) => {
    if (score === null) return 'gray';
    if (score <= thresholds[0]) return 'green';
    if (score <= thresholds[1]) return 'yellow';
    return 'red';
  };

  return (
    <div className='fixed top-4 right-4 bg-white shadow-2xl rounded-lg p-4 z-[9999] max-w-sm border'>
      <div className='flex justify-between items-center mb-3'>
        <h3 className='font-bold text-lg'>Performance Monitor</h3>
        <button onClick={() => setIsVisible(false)} className='text-gray-500 hover:text-gray-700'>
          ×
        </button>
      </div>

      <div className='space-y-2 text-sm'>
        <div className='flex justify-between'>
          <span>FCP:</span>
          <span className={`font-mono text-${getScoreColor(metrics.fcp, [1800, 3000])}-600`}>
            {metrics.fcp ? `${metrics.fcp.toFixed(0)}ms` : 'N/A'}
          </span>
        </div>

        <div className='flex justify-between'>
          <span>LCP:</span>
          <span className={`font-mono text-${getScoreColor(metrics.lcp, [2500, 4000])}-600`}>
            {metrics.lcp ? `${metrics.lcp.toFixed(0)}ms` : 'N/A'}
          </span>
        </div>

        <div className='flex justify-between'>
          <span>FID:</span>
          <span className={`font-mono text-${getScoreColor(metrics.fid, [100, 300])}-600`}>
            {metrics.fid ? `${metrics.fid.toFixed(0)}ms` : 'N/A'}
          </span>
        </div>

        <div className='flex justify-between'>
          <span>CLS:</span>
          <span className={`font-mono text-${getScoreColor(metrics.cls, [0.1, 0.25])}-600`}>
            {metrics.cls ? metrics.cls.toFixed(3) : 'N/A'}
          </span>
        </div>

        <div className='flex justify-between'>
          <span>Renders:</span>
          <span className='font-mono'>{metrics.renderCount}</span>
        </div>
      </div>

      <div className='mt-3 pt-3 border-t text-xs text-gray-500'>Press Ctrl+Shift+P to toggle</div>
    </div>
  );
};

// Higher-Order Component for Performance Tracking
export const withPerformanceTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const PerformanceTrackedComponent = React.memo((props: P) => {
    const name =
      componentName || WrappedComponent.displayName || WrappedComponent.name || 'Unknown';
    usePerformanceTracking(name);

    return <WrappedComponent {...props} />;
  });

  PerformanceTrackedComponent.displayName = `withPerformanceTracking(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;

  return PerformanceTrackedComponent;
};

export { PerformanceTracker };
