/**
 * Renderer Process Performance Tracker
 * Monitors render performance, component render times, and UI responsiveness
 */

import { EventEmitter } from 'events';

export interface RendererMetrics {
  componentRenderTime: number;
  totalRenderTime: number;
  frameDuration: number;
  isTargetMet: boolean; // < 16ms target
  timestamp: number;
  componentName?: string;
  renderPhase: 'mounting' | 'updating' | 'unmounting';
}

export interface ComponentPerformanceData {
  name: string;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  lastRenderTime: number;
  violationsCount: number;
}

declare global {
  interface Window {
    electronAPI: {
      trackRenderStart: () => Promise<string>;
      trackRenderEnd: (renderStartId: string) => Promise<number>;
      trackSearchStart: (query: string) => Promise<string>;
      trackSearchEnd: (searchId: string) => Promise<number>;
      getPerformanceMetrics: () => Promise<any>;
    };
  }
}

export class RendererPerformanceTracker extends EventEmitter {
  private renderStartTimes: Map<string, number> = new Map();
  private componentMetrics: Map<string, ComponentPerformanceData> = new Map();
  private frameObserver: PerformanceObserver | null = null;
  private renderObserver: PerformanceObserver | null = null;
  private isTracking = false;
  private frameTargetMs = 16; // 60 FPS target

  private renderMetrics: RendererMetrics[] = [];
  private maxHistorySize = 1000;

  constructor() {
    super();
    this.setupPerformanceObservers();
    this.setupReactDevtools();
  }

  /**
   * Start performance tracking
   */
  public startTracking(): void {
    if (this.isTracking) {
      console.warn('Renderer performance tracking already started');
      return;
    }

    this.isTracking = true;
    this.startFrameTracking();
    this.startRenderTracking();

    console.log('Renderer performance tracking started');
    this.emit('tracking-started');
  }

  /**
   * Stop performance tracking
   */
  public stopTracking(): void {
    if (!this.isTracking) return;

    this.isTracking = false;

    if (this.frameObserver) {
      this.frameObserver.disconnect();
    }

    if (this.renderObserver) {
      this.renderObserver.disconnect();
    }

    console.log('Renderer performance tracking stopped');
    this.emit('tracking-stopped');
  }

  /**
   * Track component render start
   */
  public trackComponentRenderStart(componentName: string, renderPhase: 'mounting' | 'updating' | 'unmounting' = 'updating'): string {
    const renderId = `${componentName}-${Date.now()}-${Math.random()}`;
    const startTime = performance.now();

    this.renderStartTimes.set(renderId, startTime);

    // Track via main process for cross-process correlation
    if (window.electronAPI) {
      window.electronAPI.trackRenderStart().catch(console.error);
    }

    return renderId;
  }

  /**
   * Track component render end
   */
  public trackComponentRenderEnd(renderId: string, componentName: string, renderPhase: 'mounting' | 'updating' | 'unmounting' = 'updating'): number {
    const endTime = performance.now();
    const startTime = this.renderStartTimes.get(renderId);

    if (!startTime) {
      console.warn('Render tracking ID not found:', renderId);
      return 0;
    }

    const renderTime = endTime - startTime;
    this.renderStartTimes.delete(renderId);

    // Update component metrics
    this.updateComponentMetrics(componentName, renderTime);

    // Create render metrics
    const metrics: RendererMetrics = {
      componentRenderTime: renderTime,
      totalRenderTime: renderTime,
      frameDuration: renderTime,
      isTargetMet: renderTime <= this.frameTargetMs,
      timestamp: Date.now(),
      componentName,
      renderPhase
    };

    this.renderMetrics.push(metrics);
    this.emit('render-metrics', metrics);

    // Check for performance violations
    if (!metrics.isTargetMet) {
      this.emit('performance-violation', {
        type: 'component-render',
        componentName,
        renderTime,
        target: this.frameTargetMs,
        message: `Component ${componentName} render time ${renderTime.toFixed(2)}ms exceeds 16ms target`
      });
    }

    // Track via main process
    if (window.electronAPI) {
      window.electronAPI.trackRenderEnd(renderId).catch(console.error);
    }

    // Keep history size manageable
    if (this.renderMetrics.length > this.maxHistorySize) {
      this.renderMetrics = this.renderMetrics.slice(-this.maxHistorySize * 0.8);
    }

    return renderTime;
  }

  /**
   * Setup Performance Observers for frame and render tracking
   */
  private setupPerformanceObservers(): void {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not available');
      return;
    }

    // Frame timing observer
    try {
      this.frameObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            this.handleFrameEntry(entry);
          }
        }
      });
    } catch (error) {
      console.warn('Could not create frame observer:', error);
    }

    // Render timing observer
    try {
      this.renderObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name.includes('render') || entry.name.includes('component')) {
            this.handleRenderEntry(entry);
          }
        }
      });
    } catch (error) {
      console.warn('Could not create render observer:', error);
    }
  }

  /**
   * Start frame tracking
   */
  private startFrameTracking(): void {
    if (this.frameObserver) {
      try {
        this.frameObserver.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        console.warn('Could not start frame observer:', error);
      }
    }

    // Fallback frame tracking using requestAnimationFrame
    this.trackFramesWithRAF();
  }

  /**
   * Start render tracking
   */
  private startRenderTracking(): void {
    if (this.renderObserver) {
      try {
        this.renderObserver.observe({ entryTypes: ['measure', 'mark'] });
      } catch (error) {
        console.warn('Could not start render observer:', error);
      }
    }
  }

  /**
   * Track frames using requestAnimationFrame
   */
  private trackFramesWithRAF(): void {
    let lastFrameTime = performance.now();

    const trackFrame = () => {
      if (!this.isTracking) return;

      const currentTime = performance.now();
      const frameDuration = currentTime - lastFrameTime;

      if (frameDuration > this.frameTargetMs) {
        const metrics: RendererMetrics = {
          componentRenderTime: 0,
          totalRenderTime: frameDuration,
          frameDuration,
          isTargetMet: frameDuration <= this.frameTargetMs,
          timestamp: Date.now(),
          renderPhase: 'updating'
        };

        this.renderMetrics.push(metrics);
        this.emit('frame-metrics', metrics);

        if (!metrics.isTargetMet) {
          this.emit('performance-violation', {
            type: 'frame-duration',
            frameDuration,
            target: this.frameTargetMs,
            message: `Frame duration ${frameDuration.toFixed(2)}ms exceeds 16ms target`
          });
        }
      }

      lastFrameTime = currentTime;
      requestAnimationFrame(trackFrame);
    };

    requestAnimationFrame(trackFrame);
  }

  /**
   * Handle frame performance entries
   */
  private handleFrameEntry(entry: PerformanceEntry): void {
    const frameDuration = entry.duration;

    const metrics: RendererMetrics = {
      componentRenderTime: 0,
      totalRenderTime: frameDuration,
      frameDuration,
      isTargetMet: frameDuration <= this.frameTargetMs,
      timestamp: Date.now(),
      renderPhase: 'updating'
    };

    this.renderMetrics.push(metrics);
    this.emit('frame-entry', metrics);
  }

  /**
   * Handle render performance entries
   */
  private handleRenderEntry(entry: PerformanceEntry): void {
    const renderTime = entry.duration;
    const componentName = this.extractComponentName(entry.name);

    const metrics: RendererMetrics = {
      componentRenderTime: renderTime,
      totalRenderTime: renderTime,
      frameDuration: renderTime,
      isTargetMet: renderTime <= this.frameTargetMs,
      timestamp: Date.now(),
      componentName,
      renderPhase: 'updating'
    };

    this.renderMetrics.push(metrics);
    this.emit('render-entry', metrics);

    if (componentName) {
      this.updateComponentMetrics(componentName, renderTime);
    }
  }

  /**
   * Extract component name from performance entry name
   */
  private extractComponentName(entryName: string): string | undefined {
    const patterns = [
      /component-(.+)/,
      /render-(.+)/,
      /(.+)-render/,
      /(.+)-component/
    ];

    for (const pattern of patterns) {
      const match = entryName.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Update component performance metrics
   */
  private updateComponentMetrics(componentName: string, renderTime: number): void {
    let metrics = this.componentMetrics.get(componentName);

    if (!metrics) {
      metrics = {
        name: componentName,
        renderCount: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: Infinity,
        lastRenderTime: 0,
        violationsCount: 0
      };
      this.componentMetrics.set(componentName, metrics);
    }

    metrics.renderCount++;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
    metrics.maxRenderTime = Math.max(metrics.maxRenderTime, renderTime);
    metrics.minRenderTime = Math.min(metrics.minRenderTime, renderTime);
    metrics.lastRenderTime = renderTime;

    if (renderTime > this.frameTargetMs) {
      metrics.violationsCount++;
    }

    this.emit('component-metrics-updated', metrics);
  }

  /**
   * Setup React DevTools integration if available
   */
  private setupReactDevtools(): void {
    // Check if React DevTools is available
    if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

      // Hook into React fiber updates
      const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
      hook.onCommitFiberRoot = (id: number, root: any, priorityLevel: any) => {
        if (this.isTracking) {
          this.trackReactCommit(root);
        }

        if (originalOnCommitFiberRoot) {
          originalOnCommitFiberRoot(id, root, priorityLevel);
        }
      };
    }
  }

  /**
   * Track React commit performance
   */
  private trackReactCommit(root: any): void {
    const startTime = performance.now();

    // Track the commit phase
    setTimeout(() => {
      const commitTime = performance.now() - startTime;

      const metrics: RendererMetrics = {
        componentRenderTime: commitTime,
        totalRenderTime: commitTime,
        frameDuration: commitTime,
        isTargetMet: commitTime <= this.frameTargetMs,
        timestamp: Date.now(),
        componentName: 'React-Commit',
        renderPhase: 'updating'
      };

      this.renderMetrics.push(metrics);
      this.emit('react-commit', metrics);
    }, 0);
  }

  /**
   * Get component performance data
   */
  public getComponentMetrics(): ComponentPerformanceData[] {
    return Array.from(this.componentMetrics.values());
  }

  /**
   * Get render metrics history
   */
  public getRenderMetrics(count?: number): RendererMetrics[] {
    if (!count) return [...this.renderMetrics];
    return this.renderMetrics.slice(-count);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    totalRenders: number;
    averageRenderTime: number;
    violationsCount: number;
    violationRate: number;
    slowestComponent: ComponentPerformanceData | null;
    fastestComponent: ComponentPerformanceData | null;
  } {
    const metrics = Array.from(this.componentMetrics.values());
    const totalViolations = this.renderMetrics.filter(m => !m.isTargetMet).length;

    return {
      totalRenders: this.renderMetrics.length,
      averageRenderTime: this.renderMetrics.length > 0
        ? this.renderMetrics.reduce((sum, m) => sum + m.componentRenderTime, 0) / this.renderMetrics.length
        : 0,
      violationsCount: totalViolations,
      violationRate: this.renderMetrics.length > 0 ? totalViolations / this.renderMetrics.length : 0,
      slowestComponent: metrics.reduce((slowest, current) =>
        !slowest || current.averageRenderTime > slowest.averageRenderTime ? current : slowest, null as ComponentPerformanceData | null),
      fastestComponent: metrics.reduce((fastest, current) =>
        !fastest || current.averageRenderTime < fastest.averageRenderTime ? current : fastest, null as ComponentPerformanceData | null)
    };
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.renderMetrics = [];
    this.componentMetrics.clear();
    this.renderStartTimes.clear();
    this.emit('metrics-reset');
  }

  /**
   * Export metrics data
   */
  public exportData(): {
    renderMetrics: RendererMetrics[];
    componentMetrics: ComponentPerformanceData[];
    summary: ReturnType<typeof this.getPerformanceSummary>;
  } {
    return {
      renderMetrics: this.getRenderMetrics(),
      componentMetrics: this.getComponentMetrics(),
      summary: this.getPerformanceSummary()
    };
  }
}

// React Hook for component performance tracking
export function useComponentPerformance(componentName: string) {
  const trackerRef = React.useRef<RendererPerformanceTracker | null>(null);
  const renderIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!trackerRef.current) {
      trackerRef.current = new RendererPerformanceTracker();
      trackerRef.current.startTracking();
    }
  }, []);

  const trackRenderStart = React.useCallback((phase: 'mounting' | 'updating' | 'unmounting' = 'updating') => {
    if (trackerRef.current) {
      renderIdRef.current = trackerRef.current.trackComponentRenderStart(componentName, phase);
    }
  }, [componentName]);

  const trackRenderEnd = React.useCallback((phase: 'mounting' | 'updating' | 'unmounting' = 'updating') => {
    if (trackerRef.current && renderIdRef.current) {
      return trackerRef.current.trackComponentRenderEnd(renderIdRef.current, componentName, phase);
    }
    return 0;
  }, [componentName]);

  React.useEffect(() => {
    trackRenderStart('mounting');
    return () => {
      trackRenderEnd('unmounting');
    };
  }, [trackRenderStart, trackRenderEnd]);

  React.useEffect(() => {
    trackRenderStart('updating');
    trackRenderEnd('updating');
  });

  return { trackRenderStart, trackRenderEnd, tracker: trackerRef.current };
}

export default RendererPerformanceTracker;