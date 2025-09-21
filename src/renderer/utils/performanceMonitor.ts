/**
 * Performance Monitoring and Optimization Utilities
 *
 * Comprehensive performance tracking for search operations:
 * - Real-time performance metrics
 * - Memory usage monitoring
 * - Frame rate analysis
 * - Bundle size optimization
 * - Performance alerts
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

// ===========================================
// Types and Interfaces
// ===========================================

export interface PerformanceMetrics {
  searchTime: number;
  renderTime: number;
  memoryUsage: number;
  frameRate: number;
  bundleSize?: number;
  cacheHitRate: number;
  componentRenderCount: number;
}

export interface PerformanceThresholds {
  searchTime: number; // milliseconds
  renderTime: number; // milliseconds
  memoryUsage: number; // bytes
  frameRate: number; // fps
  cacheHitRate: number; // percentage
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

// ===========================================
// Default Performance Thresholds
// ===========================================

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  searchTime: 100, // 100ms max search time
  renderTime: 16.67, // 60fps (16.67ms per frame)
  memoryUsage: 150 * 1024 * 1024, // 150MB max memory usage
  frameRate: 55, // Min 55fps
  cacheHitRate: 70, // Min 70% cache hit rate
};

// ===========================================
// Memory Usage Monitor
// ===========================================

export class MemoryMonitor {
  private memoryObserver?: PerformanceObserver;
  private measurements: number[] = [];
  private maxMeasurements = 100;

  constructor() {
    this.initMemoryObserver();
  }

  private initMemoryObserver() {
    if ('PerformanceObserver' in window && 'memory' in (performance as any)) {
      try {
        this.memoryObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' && entry.name.startsWith('memory-')) {
              this.recordMeasurement(entry.duration);
            }
          }
        });

        this.memoryObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Memory observer not supported:', error);
      }
    }
  }

  private recordMeasurement(value: number) {
    this.measurements.push(value);
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  getCurrentMemoryUsage(): number {
    if ('memory' in (performance as any)) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize || 0;
    }
    return 0;
  }

  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.measurements.length < 10) return 'stable';

    const recent = this.measurements.slice(-5);
    const older = this.measurements.slice(-10, -5);

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

    const difference = recentAvg - olderAvg;
    const threshold = olderAvg * 0.1; // 10% threshold

    if (difference > threshold) return 'increasing';
    if (difference < -threshold) return 'decreasing';
    return 'stable';
  }

  detectMemoryLeaks(): boolean {
    const trend = this.getMemoryTrend();
    const currentUsage = this.getCurrentMemoryUsage();

    return trend === 'increasing' && currentUsage > DEFAULT_THRESHOLDS.memoryUsage;
  }

  destroy() {
    this.memoryObserver?.disconnect();
    this.measurements = [];
  }
}

// ===========================================
// Frame Rate Monitor
// ===========================================

export class FrameRateMonitor {
  private frameTimestamps: number[] = [];
  private isMonitoring = false;
  private animationFrameId?: number;
  private frameRateCallback?: (fps: number) => void;

  startMonitoring(callback?: (fps: number) => void) {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameRateCallback = callback;
    this.frameTimestamps = [];
    this.measureFrameRate();
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private measureFrameRate = () => {
    if (!this.isMonitoring) return;

    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only last 60 frames for 1-second average
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps.shift();
    }

    // Calculate FPS from timestamps
    if (this.frameTimestamps.length >= 2) {
      const totalTime = now - this.frameTimestamps[0];
      const fps = (this.frameTimestamps.length - 1) * 1000 / totalTime;

      this.frameRateCallback?.(fps);
    }

    this.animationFrameId = requestAnimationFrame(this.measureFrameRate);
  };

  getCurrentFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;

    const now = performance.now();
    const totalTime = now - this.frameTimestamps[0];
    return (this.frameTimestamps.length - 1) * 1000 / totalTime;
  }
}

// ===========================================
// Search Performance Tracker
// ===========================================

export class SearchPerformanceTracker {
  private searchTimes: number[] = [];
  private renderTimes: number[] = [];
  private maxEntries = 50;

  recordSearchTime(searchTime: number) {
    this.searchTimes.push(searchTime);
    if (this.searchTimes.length > this.maxEntries) {
      this.searchTimes.shift();
    }
  }

  recordRenderTime(renderTime: number) {
    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > this.maxEntries) {
      this.renderTimes.shift();
    }
  }

  getAverageSearchTime(): number {
    if (this.searchTimes.length === 0) return 0;
    return this.searchTimes.reduce((sum, time) => sum + time, 0) / this.searchTimes.length;
  }

  getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    return this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
  }

  getPercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getP95SearchTime(): number {
    return this.getPercentile(this.searchTimes, 95);
  }

  getP95RenderTime(): number {
    return this.getPercentile(this.renderTimes, 95);
  }

  reset() {
    this.searchTimes = [];
    this.renderTimes = [];
  }
}

// ===========================================
// Bundle Size Analyzer
// ===========================================

export class BundleSizeAnalyzer {
  static async analyzeChunkSizes(): Promise<Record<string, number>> {
    const chunks: Record<string, number> = {};

    try {
      // Analyze loaded scripts
      const scripts = document.querySelectorAll('script[src]');

      for (const script of scripts) {
        const src = (script as HTMLScriptElement).src;
        if (src.includes('chunk') || src.includes('bundle')) {
          try {
            const response = await fetch(src, { method: 'HEAD' });
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              const filename = src.split('/').pop() || 'unknown';
              chunks[filename] = parseInt(contentLength, 10);
            }
          } catch (error) {
            console.warn('Failed to analyze chunk size:', src, error);
          }
        }
      }
    } catch (error) {
      console.warn('Bundle analysis failed:', error);
    }

    return chunks;
  }

  static calculateTotalBundleSize(chunks: Record<string, number>): number {
    return Object.values(chunks).reduce((total, size) => total + size, 0);
  }

  static identifyLargeChunks(chunks: Record<string, number>, threshold = 500 * 1024): string[] {
    return Object.entries(chunks)
      .filter(([, size]) => size > threshold)
      .map(([name]) => name);
  }
}

// ===========================================
// Component Render Tracker
// ===========================================

export class ComponentRenderTracker {
  private renderCounts = new Map<string, number>();
  private renderTimes = new Map<string, number[]>();

  recordRender(componentName: string, renderTime?: number) {
    // Update render count
    const currentCount = this.renderCounts.get(componentName) || 0;
    this.renderCounts.set(componentName, currentCount + 1);

    // Update render times if provided
    if (renderTime !== undefined) {
      const times = this.renderTimes.get(componentName) || [];
      times.push(renderTime);

      // Keep only last 20 renders
      if (times.length > 20) {
        times.shift();
      }

      this.renderTimes.set(componentName, times);
    }
  }

  getRenderCount(componentName: string): number {
    return this.renderCounts.get(componentName) || 0;
  }

  getAverageRenderTime(componentName: string): number {
    const times = this.renderTimes.get(componentName) || [];
    if (times.length === 0) return 0;

    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getTopRenderingComponents(limit = 10): Array<{ name: string; count: number; avgTime: number }> {
    return Array.from(this.renderCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        avgTime: this.getAverageRenderTime(name),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  reset() {
    this.renderCounts.clear();
    this.renderTimes.clear();
  }
}

// ===========================================
// Main Performance Monitor
// ===========================================

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;

  private memoryMonitor: MemoryMonitor;
  private frameRateMonitor: FrameRateMonitor;
  private searchTracker: SearchPerformanceTracker;
  private renderTracker: ComponentRenderTracker;
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private subscribers: Array<(metrics: PerformanceMetrics) => void> = [];

  private constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.memoryMonitor = new MemoryMonitor();
    this.frameRateMonitor = new FrameRateMonitor();
    this.searchTracker = new SearchPerformanceTracker();
    this.renderTracker = new ComponentRenderTracker();

    this.startMonitoring();
  }

  static getInstance(thresholds?: Partial<PerformanceThresholds>): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(thresholds);
    }
    return PerformanceMonitor.instance;
  }

  private startMonitoring() {
    this.frameRateMonitor.startMonitoring((fps) => {
      if (fps < this.thresholds.frameRate) {
        this.addAlert('warning', 'frameRate', fps, this.thresholds.frameRate, 'Frame rate is below optimal');
      }
    });

    // Periodic memory checks
    setInterval(() => {
      const memoryUsage = this.memoryMonitor.getCurrentMemoryUsage();
      if (memoryUsage > this.thresholds.memoryUsage) {
        this.addAlert('warning', 'memoryUsage', memoryUsage, this.thresholds.memoryUsage, 'Memory usage is high');
      }

      if (this.memoryMonitor.detectMemoryLeaks()) {
        this.addAlert('error', 'memoryUsage', memoryUsage, this.thresholds.memoryUsage, 'Potential memory leak detected');
      }
    }, 5000); // Check every 5 seconds
  }

  // Recording methods
  recordSearchTime(searchTime: number) {
    this.searchTracker.recordSearchTime(searchTime);

    if (searchTime > this.thresholds.searchTime) {
      this.addAlert('warning', 'searchTime', searchTime, this.thresholds.searchTime, 'Search time is slow');
    }
  }

  recordRenderTime(renderTime: number) {
    this.searchTracker.recordRenderTime(renderTime);

    if (renderTime > this.thresholds.renderTime) {
      this.addAlert('warning', 'renderTime', renderTime, this.thresholds.renderTime, 'Render time is slow');
    }
  }

  recordComponentRender(componentName: string, renderTime?: number) {
    this.renderTracker.recordRender(componentName, renderTime);
  }

  // Metrics retrieval
  getCurrentMetrics(): PerformanceMetrics {
    return {
      searchTime: this.searchTracker.getAverageSearchTime(),
      renderTime: this.searchTracker.getAverageRenderTime(),
      memoryUsage: this.memoryMonitor.getCurrentMemoryUsage(),
      frameRate: this.frameRateMonitor.getCurrentFPS(),
      cacheHitRate: 0, // This would be provided by cache system
      componentRenderCount: this.renderTracker.getTopRenderingComponents(1)[0]?.count || 0,
    };
  }

  getDetailedMetrics() {
    return {
      search: {
        average: this.searchTracker.getAverageSearchTime(),
        p95: this.searchTracker.getP95SearchTime(),
      },
      render: {
        average: this.searchTracker.getAverageRenderTime(),
        p95: this.searchTracker.getP95RenderTime(),
      },
      memory: {
        current: this.memoryMonitor.getCurrentMemoryUsage(),
        trend: this.memoryMonitor.getMemoryTrend(),
        leaksDetected: this.memoryMonitor.detectMemoryLeaks(),
      },
      frameRate: {
        current: this.frameRateMonitor.getCurrentFPS(),
      },
      components: this.renderTracker.getTopRenderingComponents(),
    };
  }

  // Alert management
  private addAlert(type: PerformanceAlert['type'], metric: keyof PerformanceMetrics, value: number, threshold: number, message: string) {
    const alert: PerformanceAlert = {
      id: `${metric}-${Date.now()}`,
      type,
      metric,
      value,
      threshold,
      timestamp: Date.now(),
      message,
    };

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Notify subscribers
    this.notifySubscribers();
  }

  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  clearAlerts() {
    this.alerts = [];
  }

  // Subscription management
  subscribe(callback: (metrics: PerformanceMetrics) => void) {
    this.subscribers.push(callback);

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private notifySubscribers() {
    const metrics = this.getCurrentMetrics();
    this.subscribers.forEach(callback => callback(metrics));
  }

  // Optimization suggestions
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const metrics = this.getCurrentMetrics();

    if (metrics.searchTime > this.thresholds.searchTime) {
      suggestions.push('Consider implementing search result caching');
      suggestions.push('Optimize search algorithms or add indexing');
    }

    if (metrics.renderTime > this.thresholds.renderTime) {
      suggestions.push('Use React.memo for expensive components');
      suggestions.push('Implement virtual scrolling for large lists');
      suggestions.push('Reduce component re-renders with useCallback');
    }

    if (metrics.memoryUsage > this.thresholds.memoryUsage) {
      suggestions.push('Check for memory leaks in event listeners');
      suggestions.push('Implement lazy loading for large components');
      suggestions.push('Clear unused cache entries regularly');
    }

    if (metrics.frameRate < this.thresholds.frameRate) {
      suggestions.push('Reduce DOM mutations during scrolling');
      suggestions.push('Use requestAnimationFrame for animations');
      suggestions.push('Debounce scroll and resize handlers');
    }

    return suggestions;
  }

  // Performance testing
  async runPerformanceTest(): Promise<{
    searchPerformance: { average: number; p95: number };
    renderPerformance: { average: number; p95: number };
    memoryEfficiency: { usage: number; trend: string };
    overallScore: number;
  }> {
    // This would run a comprehensive performance test
    const metrics = this.getDetailedMetrics();

    // Calculate overall performance score (0-100)
    let score = 100;

    if (metrics.search.average > this.thresholds.searchTime) {
      score -= 20;
    }

    if (metrics.render.average > this.thresholds.renderTime) {
      score -= 20;
    }

    if (metrics.memory.current > this.thresholds.memoryUsage) {
      score -= 30;
    }

    if (metrics.frameRate.current < this.thresholds.frameRate) {
      score -= 30;
    }

    return {
      searchPerformance: metrics.search,
      renderPerformance: metrics.render,
      memoryEfficiency: {
        usage: metrics.memory.current,
        trend: metrics.memory.trend,
      },
      overallScore: Math.max(0, score),
    };
  }

  destroy() {
    this.memoryMonitor.destroy();
    this.frameRateMonitor.stopMonitoring();
    this.subscribers = [];
    this.alerts = [];
  }
}

// ===========================================
// Performance Hooks
// ===========================================

export function usePerformanceMonitor() {
  const monitor = PerformanceMonitor.getInstance();

  return {
    recordSearchTime: (time: number) => monitor.recordSearchTime(time),
    recordRenderTime: (time: number) => monitor.recordRenderTime(time),
    recordComponentRender: (name: string, time?: number) => monitor.recordComponentRender(name, time),
    getCurrentMetrics: () => monitor.getCurrentMetrics(),
    getDetailedMetrics: () => monitor.getDetailedMetrics(),
    getAlerts: () => monitor.getAlerts(),
    clearAlerts: () => monitor.clearAlerts(),
    subscribe: (callback: (metrics: PerformanceMetrics) => void) => monitor.subscribe(callback),
    getOptimizationSuggestions: () => monitor.getOptimizationSuggestions(),
    runPerformanceTest: () => monitor.runPerformanceTest(),
  };
}

// Performance measurement decorators
export function measureSearchTime<T extends (...args: any[]) => Promise<any>>(
  searchFunction: T,
  monitor?: PerformanceMonitor
): T {
  const performanceMonitor = monitor || PerformanceMonitor.getInstance();

  return (async (...args: any[]) => {
    const startTime = performance.now();
    try {
      const result = await searchFunction(...args);
      const endTime = performance.now();
      performanceMonitor.recordSearchTime(endTime - startTime);
      return result;
    } catch (error) {
      const endTime = performance.now();
      performanceMonitor.recordSearchTime(endTime - startTime);
      throw error;
    }
  }) as T;
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();