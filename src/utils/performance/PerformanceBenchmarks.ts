/**
 * Performance Benchmarking Suite
 * Comprehensive performance testing and measurement utilities
 */

export interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryUsage?: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  startTime: number;
  endTime: number;
  totalDuration: number;
  summary: {
    fastest: BenchmarkResult;
    slowest: BenchmarkResult;
    average: number;
    median: number;
  };
}

class PerformanceBenchmarks {
  private static instance: PerformanceBenchmarks;
  private benchmarks: Map<string, BenchmarkResult[]> = new Map();
  private running: Map<string, { startTime: number; startMemory?: number }> = new Map();

  public static getInstance(): PerformanceBenchmarks {
    if (!PerformanceBenchmarks.instance) {
      PerformanceBenchmarks.instance = new PerformanceBenchmarks();
    }
    return PerformanceBenchmarks.instance;
  }

  /**
   * Start a benchmark measurement
   */
  public start(name: string): void {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    this.running.set(name, {
      startTime,
      startMemory
    });
  }

  /**
   * End a benchmark measurement
   */
  public end(name: string, operations: number = 1, metadata?: Record<string, any>): BenchmarkResult | null {
    const runningBenchmark = this.running.get(name);
    if (!runningBenchmark) {
      console.warn(`Benchmark "${name}" was not started`);
      return null;
    }

    const endTime = performance.now();
    const endMemory = this.getMemoryUsage();
    const duration = endTime - runningBenchmark.startTime;
    const opsPerSecond = operations / (duration / 1000);

    const result: BenchmarkResult = {
      name,
      duration,
      operations,
      opsPerSecond,
      memoryUsage: endMemory && runningBenchmark.startMemory ?
        endMemory - runningBenchmark.startMemory : undefined,
      timestamp: Date.now(),
      metadata
    };

    // Store result
    if (!this.benchmarks.has(name)) {
      this.benchmarks.set(name, []);
    }
    this.benchmarks.get(name)!.push(result);

    this.running.delete(name);
    return result;
  }

  /**
   * Measure a function's performance
   */
  public async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    operations: number = 1,
    metadata?: Record<string, any>
  ): Promise<{ result: T; benchmark: BenchmarkResult }> {
    this.start(name);

    try {
      const result = await fn();
      const benchmark = this.end(name, operations, metadata)!;
      return { result, benchmark };
    } catch (error) {
      this.running.delete(name);
      throw error;
    }
  }

  /**
   * Run a benchmark multiple times and get statistics
   */
  public async runSuite(
    name: string,
    fn: () => any | Promise<any>,
    iterations: number = 10,
    operations: number = 1
  ): Promise<BenchmarkSuite> {
    const results: BenchmarkResult[] = [];
    const suiteStartTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const benchmarkName = `${name}_iteration_${i}`;
      const { benchmark } = await this.measure(benchmarkName, fn, operations, { iteration: i });
      results.push(benchmark);
    }

    const suiteEndTime = performance.now();
    const totalDuration = suiteEndTime - suiteStartTime;

    // Calculate statistics
    const durations = results.map(r => r.duration);
    const fastest = results.reduce((prev, curr) => prev.duration < curr.duration ? prev : curr);
    const slowest = results.reduce((prev, curr) => prev.duration > curr.duration ? prev : curr);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    const suite: BenchmarkSuite = {
      name,
      results,
      startTime: suiteStartTime,
      endTime: suiteEndTime,
      totalDuration,
      summary: {
        fastest,
        slowest,
        average,
        median
      }
    };

    return suite;
  }

  /**
   * Get benchmark results
   */
  public getResults(name?: string): BenchmarkResult[] {
    if (name) {
      return this.benchmarks.get(name) || [];
    }
    return Array.from(this.benchmarks.values()).flat();
  }

  /**
   * Clear benchmark results
   */
  public clear(name?: string): void {
    if (name) {
      this.benchmarks.delete(name);
    } else {
      this.benchmarks.clear();
    }
  }

  /**
   * Generate a performance report
   */
  public generateReport(): string {
    const allResults = this.getResults();
    if (allResults.length === 0) {
      return 'No benchmark results available';
    }

    const groupedResults = new Map<string, BenchmarkResult[]>();
    allResults.forEach(result => {
      const key = result.name.replace(/_iteration_\d+$/, '');
      if (!groupedResults.has(key)) {
        groupedResults.set(key, []);
      }
      groupedResults.get(key)!.push(result);
    });

    let report = 'Performance Benchmark Report\n';
    report += '================================\n\n';

    for (const [name, results] of groupedResults) {
      const durations = results.map(r => r.duration);
      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      const opsPerSec = results.map(r => r.opsPerSecond);
      const avgOps = opsPerSec.reduce((sum, ops) => sum + ops, 0) / opsPerSec.length;

      report += `${name}:\n`;
      report += `  Runs: ${results.length}\n`;
      report += `  Average: ${average.toFixed(2)}ms\n`;
      report += `  Min: ${min.toFixed(2)}ms\n`;
      report += `  Max: ${max.toFixed(2)}ms\n`;
      report += `  Ops/sec: ${avgOps.toFixed(0)}\n\n`;
    }

    return report;
  }

  /**
   * Get memory usage (if available)
   */
  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      return (performance as any).memory?.usedJSHeapSize;
    }
    return undefined;
  }
}

// React component performance testing utilities
export class ReactComponentBenchmarks {
  private static renderCounts = new Map<string, number>();
  private static renderTimes = new Map<string, number[]>();

  /**
   * Track component render performance
   */
  static trackRender(componentName: string, startTime: number): void {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Update render count
    const currentCount = this.renderCounts.get(componentName) || 0;
    this.renderCounts.set(componentName, currentCount + 1);

    // Track render times
    if (!this.renderTimes.has(componentName)) {
      this.renderTimes.set(componentName, []);
    }
    this.renderTimes.get(componentName)!.push(renderTime);

    // Keep only last 100 renders
    const times = this.renderTimes.get(componentName)!;
    if (times.length > 100) {
      times.shift();
    }
  }

  /**
   * Get component performance stats
   */
  static getStats(componentName?: string): Record<string, any> {
    if (componentName) {
      const renderCount = this.renderCounts.get(componentName) || 0;
      const times = this.renderTimes.get(componentName) || [];
      const avgTime = times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
      const maxTime = times.length > 0 ? Math.max(...times) : 0;

      return {
        componentName,
        renderCount,
        averageRenderTime: avgTime,
        maxRenderTime: maxTime,
        recentRenders: times.slice(-10)
      };
    }

    // Return stats for all components
    const stats: Record<string, any> = {};
    for (const [name] of this.renderCounts) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  /**
   * Clear component stats
   */
  static clear(componentName?: string): void {
    if (componentName) {
      this.renderCounts.delete(componentName);
      this.renderTimes.delete(componentName);
    } else {
      this.renderCounts.clear();
      this.renderTimes.clear();
    }
  }
}

// Web Performance API utilities
export class WebPerformanceMetrics {
  /**
   * Get Core Web Vitals
   */
  static async getCoreWebVitals(): Promise<Record<string, number | null>> {
    return new Promise((resolve) => {
      const metrics = {
        FCP: null as number | null,
        LCP: null as number | null,
        FID: null as number | null,
        CLS: null as number | null,
        TTFB: null as number | null
      };

      // Get FCP and LCP
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            metrics.FCP = entry.startTime;
          }
          if (entry.entryType === 'largest-contentful-paint') {
            metrics.LCP = entry.startTime;
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
      } catch (e) {
        console.warn('Performance observer not supported');
      }

      // Get TTFB
      if (window.performance && window.performance.timing) {
        const { responseStart, navigationStart } = window.performance.timing;
        metrics.TTFB = responseStart - navigationStart;
      }

      // Resolve after a short delay to allow metrics to be collected
      setTimeout(() => {
        observer.disconnect();
        resolve(metrics);
      }, 1000);
    });
  }

  /**
   * Get navigation timing metrics
   */
  static getNavigationTiming(): Record<string, number> {
    if (!window.performance || !window.performance.timing) {
      return {};
    }

    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;

    return {
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnect: timing.connectEnd - timing.connectStart,
      request: timing.responseStart - timing.requestStart,
      response: timing.responseEnd - timing.responseStart,
      domProcessing: timing.domContentLoadedEventStart - timing.responseEnd,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
      loadEvent: timing.loadEventEnd - timing.loadEventStart,
      totalTime: timing.loadEventEnd - navigationStart
    };
  }

  /**
   * Monitor frame rate
   */
  static monitorFrameRate(duration: number = 5000): Promise<{ averageFPS: number; minFPS: number; maxFPS: number }> {
    return new Promise((resolve) => {
      const frames: number[] = [];
      let lastTime = performance.now();
      let animationId: number;

      const measureFrame = (currentTime: number) => {
        const deltaTime = currentTime - lastTime;
        const fps = 1000 / deltaTime;
        frames.push(fps);
        lastTime = currentTime;

        if (currentTime - frames[0] * (1000 / fps) < duration) {
          animationId = requestAnimationFrame(measureFrame);
        } else {
          cancelAnimationFrame(animationId);

          const averageFPS = frames.reduce((sum, f) => sum + f, 0) / frames.length;
          const minFPS = Math.min(...frames);
          const maxFPS = Math.max(...frames);

          resolve({ averageFPS, minFPS, maxFPS });
        }
      };

      animationId = requestAnimationFrame(measureFrame);
    });
  }
}

// DOM performance utilities
export class DOMPerformanceMetrics {
  /**
   * Count DOM elements and complexity
   */
  static getDOMComplexity(): {
    totalElements: number;
    depth: number;
    flexElements: number;
    gridElements: number;
    uniqueTags: number;
  } {
    const allElements = document.querySelectorAll('*');
    const flexElements = document.querySelectorAll('[style*="display: flex"], [class*="flex"]');
    const gridElements = document.querySelectorAll('[style*="display: grid"], [class*="grid"]');

    // Calculate depth
    let maxDepth = 0;
    const calculateDepth = (element: Element, depth: number = 0): void => {
      maxDepth = Math.max(maxDepth, depth);
      Array.from(element.children).forEach(child => calculateDepth(child, depth + 1));
    };
    calculateDepth(document.body);

    // Count unique tags
    const uniqueTags = new Set(Array.from(allElements).map(el => el.tagName.toLowerCase()));

    return {
      totalElements: allElements.length,
      depth: maxDepth,
      flexElements: flexElements.length,
      gridElements: gridElements.length,
      uniqueTags: uniqueTags.size
    };
  }

  /**
   * Measure layout thrashing
   */
  static measureLayoutThrashing(element: HTMLElement, iterations: number = 100): number {
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Force layout
      element.offsetHeight;

      // Modify property that triggers layout
      element.style.marginTop = `${i % 10}px`;
    }

    const endTime = performance.now();
    return endTime - startTime;
  }

  /**
   * Measure scroll performance
   */
  static measureScrollPerformance(element: HTMLElement): Promise<{
    averageFrameTime: number;
    droppedFrames: number;
    smoothness: number;
  }> {
    return new Promise((resolve) => {
      const frameTimes: number[] = [];
      let lastFrameTime = performance.now();
      let animationId: number;
      let droppedFrames = 0;

      const measureFrame = (currentTime: number) => {
        const frameTime = currentTime - lastFrameTime;
        frameTimes.push(frameTime);

        // Consider frame dropped if it takes longer than 16.67ms (60fps)
        if (frameTime > 16.67) {
          droppedFrames++;
        }

        lastFrameTime = currentTime;

        if (frameTimes.length < 120) { // Measure for ~2 seconds at 60fps
          animationId = requestAnimationFrame(measureFrame);
        } else {
          cancelAnimationFrame(animationId);

          const averageFrameTime = frameTimes.reduce((sum, ft) => sum + ft, 0) / frameTimes.length;
          const smoothness = (frameTimes.length - droppedFrames) / frameTimes.length;

          resolve({
            averageFrameTime,
            droppedFrames,
            smoothness
          });
        }
      };

      // Start scrolling animation
      let scrollPosition = 0;
      const scrollAnimation = () => {
        scrollPosition += 5;
        element.scrollTop = scrollPosition;

        if (scrollPosition < element.scrollHeight - element.clientHeight) {
          requestAnimationFrame(scrollAnimation);
        }
      };

      animationId = requestAnimationFrame(measureFrame);
      scrollAnimation();
    });
  }
}

// Export singleton instance
export const performanceBenchmarks = PerformanceBenchmarks.getInstance();

// Convenience functions
export const benchmark = {
  start: (name: string) => performanceBenchmarks.start(name),
  end: (name: string, ops?: number, metadata?: Record<string, any>) => performanceBenchmarks.end(name, ops, metadata),
  measure: <T>(name: string, fn: () => T | Promise<T>, ops?: number, metadata?: Record<string, any>) =>
    performanceBenchmarks.measure(name, fn, ops, metadata),
  suite: (name: string, fn: () => any, iterations?: number, ops?: number) =>
    performanceBenchmarks.runSuite(name, fn, iterations, ops),
  results: (name?: string) => performanceBenchmarks.getResults(name),
  report: () => performanceBenchmarks.generateReport(),
  clear: (name?: string) => performanceBenchmarks.clear(name)
};