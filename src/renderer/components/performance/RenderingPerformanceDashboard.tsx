/**
 * Real-time Rendering Performance Dashboard
 * Monitors component rendering, paint performance, and optimization metrics
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { performanceMonitor } from './PerformanceMonitoring';

interface RenderingMetrics {
  renderCount: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  lastRenderTime: number;
  renderFrequency: number; // renders per second
  wastedRenders: number;
  optimizationScore: number; // 0-100
}

interface PaintMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  totalBlockingTime: number;
  firstInputDelay: number;
  interactionToNextPaint: number;
}

interface ComponentOptimization {
  name: string;
  usesReactMemo: boolean;
  usesUseMemo: boolean;
  usesUseCallback: boolean;
  hasKeyProps: boolean;
  renderComplexity: 'low' | 'medium' | 'high';
  recommendations: string[];
}

interface BundleMetrics {
  totalSize: number;
  loadedChunks: number;
  lazyChunks: number;
  cacheHitRate: number;
  compressionRatio: number;
}

class RenderingPerformanceTracker {
  private componentMetrics: Map<string, RenderingMetrics> = new Map();
  private paintObserver: PerformanceObserver | null = null;
  private paintMetrics: PaintMetrics = {
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    totalBlockingTime: 0,
    firstInputDelay: 0,
    interactionToNextPaint: 0
  };
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private fpsMeasurements: number[] = [];

  constructor() {
    this.setupPerformanceObservers();
    this.startFPSMonitoring();
  }

  private setupPerformanceObservers() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Paint timing observer
      this.paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.updatePaintMetrics(entry);
        }
      });

      this.paintObserver.observe({
        entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift', 'first-input']
      });

      // Navigation timing
      if (performance.getEntriesByType) {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const navEntry = navEntries[0] as PerformanceNavigationTiming;
          this.paintMetrics.totalBlockingTime = navEntry.domInteractive - navEntry.domLoading;
        }
      }
    } catch (error) {
      console.warn('Performance observers not fully supported:', error);
    }
  }

  private updatePaintMetrics(entry: PerformanceEntry) {
    switch (entry.name) {
      case 'first-contentful-paint':
        this.paintMetrics.firstContentfulPaint = entry.startTime;
        break;
      case 'largest-contentful-paint':
        this.paintMetrics.largestContentfulPaint = entry.startTime;
        break;
      case 'first-input-delay':
        this.paintMetrics.firstInputDelay = (entry as any).processingStart - entry.startTime;
        break;
    }

    if (entry.entryType === 'layout-shift') {
      this.paintMetrics.cumulativeLayoutShift += (entry as any).value;
    }
  }

  private startFPSMonitoring() {
    const measureFPS = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        const fps = 1000 / delta;
        this.fpsMeasurements.push(fps);

        // Keep only last 60 measurements (1 second at 60fps)
        if (this.fpsMeasurements.length > 60) {
          this.fpsMeasurements.shift();
        }
      }

      this.lastFrameTime = timestamp;
      this.frameId = requestAnimationFrame(measureFPS);
    };

    this.frameId = requestAnimationFrame(measureFPS);
  }

  recordComponentRender(
    componentName: string,
    renderTime: number,
    wasOptimized: boolean = true
  ) {
    const existing = this.componentMetrics.get(componentName) || {
      renderCount: 0,
      averageRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
      lastRenderTime: 0,
      renderFrequency: 0,
      wastedRenders: 0,
      optimizationScore: 100
    };

    const newCount = existing.renderCount + 1;
    const newAverage = (existing.averageRenderTime * existing.renderCount + renderTime) / newCount;

    const updatedMetrics: RenderingMetrics = {
      renderCount: newCount,
      averageRenderTime: newAverage,
      maxRenderTime: Math.max(existing.maxRenderTime, renderTime),
      minRenderTime: Math.min(existing.minRenderTime, renderTime),
      lastRenderTime: renderTime,
      renderFrequency: this.calculateRenderFrequency(componentName),
      wastedRenders: existing.wastedRenders + (wasOptimized ? 0 : 1),
      optimizationScore: this.calculateOptimizationScore(componentName, existing.wastedRenders)
    };

    this.componentMetrics.set(componentName, updatedMetrics);
  }

  private calculateRenderFrequency(componentName: string): number {
    // Simplified calculation - in real implementation, would track timestamps
    const metrics = this.componentMetrics.get(componentName);
    if (!metrics || metrics.renderCount < 2) return 0;

    return metrics.renderCount / (Date.now() - (Date.now() - 10000)) * 1000; // renders per second
  }

  private calculateOptimizationScore(componentName: string, wastedRenders: number): number {
    const metrics = this.componentMetrics.get(componentName);
    if (!metrics) return 100;

    const wasteRatio = wastedRenders / metrics.renderCount;
    const performanceScore = Math.max(0, 100 - (metrics.averageRenderTime / 16) * 100); // 16ms = 60fps
    const efficiencyScore = Math.max(0, 100 - wasteRatio * 100);

    return (performanceScore + efficiencyScore) / 2;
  }

  getComponentMetrics(componentName?: string) {
    if (componentName) {
      return this.componentMetrics.get(componentName);
    }
    return Object.fromEntries(this.componentMetrics);
  }

  getPaintMetrics(): PaintMetrics {
    return { ...this.paintMetrics };
  }

  getFPS(): number {
    if (this.fpsMeasurements.length === 0) return 0;
    return this.fpsMeasurements.reduce((sum, fps) => sum + fps, 0) / this.fpsMeasurements.length;
  }

  getWebVitalsScore(): { score: number; ratings: Record<string, 'good' | 'needs-improvement' | 'poor'> } {
    const ratings = {
      fcp: this.paintMetrics.firstContentfulPaint <= 1800 ? 'good' :
           this.paintMetrics.firstContentfulPaint <= 3000 ? 'needs-improvement' : 'poor',
      lcp: this.paintMetrics.largestContentfulPaint <= 2500 ? 'good' :
           this.paintMetrics.largestContentfulPaint <= 4000 ? 'needs-improvement' : 'poor',
      cls: this.paintMetrics.cumulativeLayoutShift <= 0.1 ? 'good' :
           this.paintMetrics.cumulativeLayoutShift <= 0.25 ? 'needs-improvement' : 'poor',
      fid: this.paintMetrics.firstInputDelay <= 100 ? 'good' :
           this.paintMetrics.firstInputDelay <= 300 ? 'needs-improvement' : 'poor'
    } as const;

    const scores = {
      good: 100,
      'needs-improvement': 50,
      poor: 0
    };

    const totalScore = Object.values(ratings).reduce((sum, rating) => sum + scores[rating], 0) / 4;

    return { score: totalScore, ratings };
  }

  generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const allMetrics = Object.entries(this.componentMetrics);

    // Component-specific recommendations
    allMetrics.forEach(([name, metrics]) => {
      if (metrics.averageRenderTime > 16) {
        recommendations.push(`${name}: Consider optimization - avg render time ${metrics.averageRenderTime.toFixed(2)}ms exceeds 16ms`);
      }

      if (metrics.wastedRenders / metrics.renderCount > 0.3) {
        recommendations.push(`${name}: High wasted render ratio - consider React.memo or useMemo`);
      }

      if (metrics.renderFrequency > 10) {
        recommendations.push(`${name}: High render frequency - check for unnecessary state updates`);
      }
    });

    // Paint performance recommendations
    if (this.paintMetrics.largestContentfulPaint > 2500) {
      recommendations.push('LCP > 2.5s: Consider lazy loading, image optimization, or code splitting');
    }

    if (this.paintMetrics.cumulativeLayoutShift > 0.1) {
      recommendations.push('CLS > 0.1: Avoid layout shifts by sizing images and ads properly');
    }

    if (this.paintMetrics.firstInputDelay > 100) {
      recommendations.push('FID > 100ms: Reduce JavaScript execution time and use web workers');
    }

    // FPS recommendations
    const avgFPS = this.getFPS();
    if (avgFPS < 55) {
      recommendations.push(`Low FPS (${avgFPS.toFixed(1)}): Optimize animations and reduce heavy computations`);
    }

    return recommendations;
  }

  destroy() {
    if (this.paintObserver) {
      this.paintObserver.disconnect();
    }

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
  }
}

// Global tracker instance
const renderingTracker = new RenderingPerformanceTracker();

export const RenderingPerformanceDashboard: React.FC<{
  isVisible?: boolean;
  onToggle?: (visible: boolean) => void;
  refreshInterval?: number;
}> = ({
  isVisible = false,
  onToggle,
  refreshInterval = 2000
}) => {
  const [metrics, setMetrics] = useState<Record<string, RenderingMetrics>>({});
  const [paintMetrics, setPaintMetrics] = useState<PaintMetrics>(renderingTracker.getPaintMetrics());
  const [webVitals, setWebVitals] = useState(renderingTracker.getWebVitalsScore());
  const [fps, setFPS] = useState(0);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timer>();

  const updateMetrics = useCallback(() => {
    setMetrics(renderingTracker.getComponentMetrics());
    setPaintMetrics(renderingTracker.getPaintMetrics());
    setWebVitals(renderingTracker.getWebVitalsScore());
    setFPS(renderingTracker.getFPS());
    setRecommendations(renderingTracker.generateRecommendations());
  }, []);

  useEffect(() => {
    if (isVisible) {
      updateMetrics();
      intervalRef.current = setInterval(updateMetrics, refreshInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible, refreshInterval, updateMetrics]);

  const formatTime = (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#10b981'; // green
    if (score >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getRatingColor = (rating: 'good' | 'needs-improvement' | 'poor'): string => {
    switch (rating) {
      case 'good': return '#10b981';
      case 'needs-improvement': return '#f59e0b';
      case 'poor': return '#ef4444';
    }
  };

  const sortedComponents = useMemo(() => {
    return Object.entries(metrics).sort((a, b) => b[1].averageRenderTime - a[1].averageRenderTime);
  }, [metrics]);

  if (!isVisible && process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => onToggle?.(!isVisible)}
        style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          padding: '8px 12px',
          backgroundColor: '#1f2937',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease'
        }}
        title="Rendering Performance Dashboard"
      >
        🎯 {fps.toFixed(0)} FPS
      </button>

      {/* Dashboard Panel */}
      {isVisible && (
        <div
          style={{
            position: 'fixed',
            top: '120px',
            right: '20px',
            width: '450px',
            maxHeight: '70vh',
            backgroundColor: '#1f2937',
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 10001,
            fontSize: '13px',
            fontFamily: 'ui-monospace, monospace',
            overflow: 'hidden',
            border: '1px solid #374151'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #374151',
              background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#f9fafb' }}>
                🎯 Rendering Performance
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                Real-time optimization monitoring
              </p>
            </div>
            <button
              onClick={() => onToggle?.(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ maxHeight: 'calc(70vh - 80px)', overflow: 'auto' }}>
            {/* Web Vitals Summary */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#f3f4f6' }}>
                Web Vitals Score: {webVitals.score.toFixed(0)}/100
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>FCP</div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: getRatingColor(webVitals.ratings.fcp)
                  }}>
                    {formatTime(paintMetrics.firstContentfulPaint)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>LCP</div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: getRatingColor(webVitals.ratings.lcp)
                  }}>
                    {formatTime(paintMetrics.largestContentfulPaint)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>CLS</div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: getRatingColor(webVitals.ratings.cls)
                  }}>
                    {paintMetrics.cumulativeLayoutShift.toFixed(3)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>FID</div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: getRatingColor(webVitals.ratings.fid)
                  }}>
                    {formatTime(paintMetrics.firstInputDelay)}
                  </div>
                </div>
              </div>

              {/* FPS Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>FPS:</span>
                <div style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: fps >= 55 ? '#065f46' : fps >= 30 ? '#92400e' : '#7f1d1d',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {fps.toFixed(1)}
                </div>
              </div>
            </div>

            {/* Component Performance */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Component Performance
              </h4>

              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {sortedComponents.length === 0 ? (
                  <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No components tracked yet</div>
                ) : (
                  sortedComponents.map(([name, componentMetrics]) => (
                    <div
                      key={name}
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid #374151',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: '600',
                          color: '#f3f4f6',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {componentMetrics.renderCount} renders • {componentMetrics.wastedRenders} wasted
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: componentMetrics.averageRenderTime > 16 ? '#f87171' : '#34d399'
                        }}>
                          {formatTime(componentMetrics.averageRenderTime)}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: getScoreColor(componentMetrics.optimizationScore)
                        }}>
                          {componentMetrics.optimizationScore.toFixed(0)}% opt
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div style={{ padding: '16px 20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                  🔧 Optimization Recommendations
                </h4>

                <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                  {recommendations.slice(0, 5).map((rec, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        marginBottom: '6px',
                        backgroundColor: '#374151',
                        borderRadius: '6px',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        color: '#d1d5db'
                      }}
                    >
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// HOC for automatic component performance tracking
export function withRenderingPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name;

  return React.memo(React.forwardRef<any, P>((props, ref) => {
    const renderStartTime = useRef<number>(0);
    const prevPropsRef = useRef<P>(props);

    // Start timing before render
    renderStartTime.current = performance.now();

    // Track if this was an optimized render (props didn't change)
    const wasOptimized = useMemo(() => {
      return JSON.stringify(prevPropsRef.current) === JSON.stringify(props);
    }, [props]);

    // Update previous props
    useEffect(() => {
      prevPropsRef.current = props;
    });

    // Track render completion
    useEffect(() => {
      const renderTime = performance.now() - renderStartTime.current;
      renderingTracker.recordComponentRender(displayName, renderTime, wasOptimized);
    });

    return <WrappedComponent {...props} ref={ref} />;
  }));
}

// Hook for manual performance tracking
export function useRenderingPerformanceTracking(componentName: string) {
  const renderStartTime = useRef<number>(0);

  const startTracking = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const endTracking = useCallback((wasOptimized: boolean = true) => {
    const renderTime = performance.now() - renderStartTime.current;
    renderingTracker.recordComponentRender(componentName, renderTime, wasOptimized);
  }, [componentName]);

  return { startTracking, endTracking };
}

export { renderingTracker };