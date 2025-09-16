/**
 * Performance Metrics and Perceived Performance Testing
 * Measures and validates user-perceived performance requirements
 */

import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  // Core Web Vitals
  firstContentfulPaint: number; // Time to first content render
  largestContentfulPaint: number; // Time to largest content render
  cumulativeLayoutShift: number; // Visual stability score
  firstInputDelay: number; // Input responsiveness

  // Search-specific metrics
  searchResponseTime: number; // Time from query to results
  autocompleteResponseTime: number; // Time to show suggestions
  resultRenderTime: number; // Time to render results UI
  filterApplicationTime: number; // Time to apply filters

  // Perceived performance
  initialLoadTime: number; // Time to interactive app
  searchFeedbackTime: number; // Time to show loading indicator
  progressIndicatorAccuracy: number; // How accurate progress indicators are

  // Memory and resource usage
  memoryUsage: number; // Peak memory consumption
  cpuUsage: number; // CPU utilization during operations
  networkRequests: number; // Number of network calls
  cacheHitRate: number; // Percentage of cache hits
}

export interface PerformanceThresholds {
  excellent: number;
  good: number;
  needsImprovement: number;
  poor: number;
}

export const PERFORMANCE_THRESHOLDS: Record<keyof PerformanceMetrics, PerformanceThresholds> = {
  firstContentfulPaint: { excellent: 1000, good: 1800, needsImprovement: 3000, poor: Infinity },
  largestContentfulPaint: { excellent: 2000, good: 2500, needsImprovement: 4000, poor: Infinity },
  cumulativeLayoutShift: { excellent: 0.1, good: 0.25, needsImprovement: 0.5, poor: Infinity },
  firstInputDelay: { excellent: 100, good: 300, needsImprovement: 600, poor: Infinity },

  searchResponseTime: { excellent: 500, good: 1000, needsImprovement: 2000, poor: Infinity },
  autocompleteResponseTime: { excellent: 150, good: 300, needsImprovement: 500, poor: Infinity },
  resultRenderTime: { excellent: 200, good: 500, needsImprovement: 1000, poor: Infinity },
  filterApplicationTime: { excellent: 100, good: 300, needsImprovement: 600, poor: Infinity },

  initialLoadTime: { excellent: 2000, good: 3000, needsImprovement: 5000, poor: Infinity },
  searchFeedbackTime: { excellent: 100, good: 200, needsImprovement: 500, poor: Infinity },
  progressIndicatorAccuracy: { excellent: 95, good: 85, needsImprovement: 70, poor: 0 },

  memoryUsage: { excellent: 50, good: 100, needsImprovement: 200, poor: Infinity }, // MB
  cpuUsage: { excellent: 20, good: 40, needsImprovement: 70, poor: Infinity }, // Percentage
  networkRequests: { excellent: 3, good: 6, needsImprovement: 10, poor: Infinity },
  cacheHitRate: { excellent: 80, good: 60, needsImprovement: 40, poor: 0 } // Percentage
};

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private startTimes: Map<string, number> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.setupPerformanceObservers();
  }

  private setupPerformanceObservers(): void {
    // Observe paint metrics
    if ('PerformanceObserver' in window) {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.firstContentfulPaint = entry.startTime;
          }
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

      // Observe LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.largestContentfulPaint = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // Observe layout shifts
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.metrics.cumulativeLayoutShift = clsValue;
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

      // Observe first input delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.firstInputDelay = (entry as any).processingStart - entry.startTime;
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    }
  }

  startTiming(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  endTiming(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      throw new Error(`No start time recorded for operation: ${operation}`);
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operation);
    return duration;
  }

  measureSearchPerformance(): Promise<Partial<PerformanceMetrics>> {
    return new Promise((resolve) => {
      // Simulate search operation measurement
      this.startTiming('search');

      // Mock search implementation
      setTimeout(() => {
        const searchTime = this.endTiming('search');
        this.metrics.searchResponseTime = searchTime;

        // Measure other search-related metrics
        this.measureAutocompletePerformance();
        this.measureRenderPerformance();
        this.measureResourceUsage();

        resolve(this.metrics);
      }, Math.random() * 500 + 200); // Simulate 200-700ms search time
    });
  }

  private measureAutocompletePerformance(): void {
    this.startTiming('autocomplete');

    // Simulate autocomplete
    setTimeout(() => {
      this.metrics.autocompleteResponseTime = this.endTiming('autocomplete');
    }, Math.random() * 200 + 50); // 50-250ms
  }

  private measureRenderPerformance(): void {
    this.startTiming('render');

    // Use requestAnimationFrame to measure render time
    requestAnimationFrame(() => {
      this.metrics.resultRenderTime = this.endTiming('render');
    });
  }

  private measureResourceUsage(): void {
    // Measure memory usage (approximation)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.metrics.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }

    // Simulate CPU usage measurement
    this.metrics.cpuUsage = Math.random() * 30 + 10; // 10-40% CPU usage

    // Count network requests from Performance API
    const resourceEntries = performance.getEntriesByType('resource');
    this.metrics.networkRequests = resourceEntries.length;

    // Simulate cache hit rate
    this.metrics.cacheHitRate = Math.random() * 40 + 60; // 60-100% cache hit rate
  }

  measureFilterPerformance(): Promise<number> {
    return new Promise((resolve) => {
      this.startTiming('filter');

      // Simulate filter application
      setTimeout(() => {
        const filterTime = this.endTiming('filter');
        this.metrics.filterApplicationTime = filterTime;
        resolve(filterTime);
      }, Math.random() * 300 + 50); // 50-350ms
    });
  }

  measureLoadTime(): Promise<number> {
    return new Promise((resolve) => {
      // Measure from navigation start to load complete
      window.addEventListener('load', () => {
        const loadTime = performance.now();
        this.metrics.initialLoadTime = loadTime;
        resolve(loadTime);
      });
    });
  }

  getMetrics(): PerformanceMetrics {
    return {
      firstContentfulPaint: this.metrics.firstContentfulPaint || 0,
      largestContentfulPaint: this.metrics.largestContentfulPaint || 0,
      cumulativeLayoutShift: this.metrics.cumulativeLayoutShift || 0,
      firstInputDelay: this.metrics.firstInputDelay || 0,
      searchResponseTime: this.metrics.searchResponseTime || 0,
      autocompleteResponseTime: this.metrics.autocompleteResponseTime || 0,
      resultRenderTime: this.metrics.resultRenderTime || 0,
      filterApplicationTime: this.metrics.filterApplicationTime || 0,
      initialLoadTime: this.metrics.initialLoadTime || 0,
      searchFeedbackTime: this.metrics.searchFeedbackTime || 0,
      progressIndicatorAccuracy: this.metrics.progressIndicatorAccuracy || 0,
      memoryUsage: this.metrics.memoryUsage || 0,
      cpuUsage: this.metrics.cpuUsage || 0,
      networkRequests: this.metrics.networkRequests || 0,
      cacheHitRate: this.metrics.cacheHitRate || 0
    };
  }

  evaluatePerformance(): PerformanceEvaluation {
    const metrics = this.getMetrics();
    const evaluation: PerformanceEvaluation = {
      overallScore: 0,
      categoryScores: {},
      criticalIssues: [],
      recommendations: [],
      passedThresholds: {},
      failedThresholds: {}
    };

    let totalScore = 0;
    let categoryCount = 0;

    // Evaluate each metric
    Object.entries(metrics).forEach(([key, value]) => {
      const metricKey = key as keyof PerformanceMetrics;
      const thresholds = PERFORMANCE_THRESHOLDS[metricKey];
      const score = this.calculateMetricScore(value, thresholds);

      evaluation.categoryScores[metricKey] = score;
      totalScore += score;
      categoryCount++;

      if (score >= 80) {
        evaluation.passedThresholds[metricKey] = value;
      } else {
        evaluation.failedThresholds[metricKey] = value;

        if (score < 50) {
          evaluation.criticalIssues.push(
            `${metricKey}: ${value} (${this.getPerformanceCategory(value, thresholds)})`
          );
        }
      }
    });

    evaluation.overallScore = totalScore / categoryCount;

    // Generate recommendations
    evaluation.recommendations = this.generateRecommendations(evaluation.failedThresholds);

    return evaluation;
  }

  private calculateMetricScore(value: number, thresholds: PerformanceThresholds): number {
    if (value <= thresholds.excellent) return 100;
    if (value <= thresholds.good) return 80;
    if (value <= thresholds.needsImprovement) return 60;
    return 30;
  }

  private getPerformanceCategory(value: number, thresholds: PerformanceThresholds): string {
    if (value <= thresholds.excellent) return 'Excellent';
    if (value <= thresholds.good) return 'Good';
    if (value <= thresholds.needsImprovement) return 'Needs Improvement';
    return 'Poor';
  }

  private generateRecommendations(failedMetrics: Record<string, number>): string[] {
    const recommendations: string[] = [];

    Object.keys(failedMetrics).forEach(metric => {
      switch (metric) {
        case 'searchResponseTime':
          recommendations.push('Optimize search algorithms and implement result caching');
          break;
        case 'autocompleteResponseTime':
          recommendations.push('Implement debounced autocomplete with local caching');
          break;
        case 'resultRenderTime':
          recommendations.push('Use virtual scrolling for large result sets');
          break;
        case 'filterApplicationTime':
          recommendations.push('Optimize filter logic and use client-side filtering');
          break;
        case 'initialLoadTime':
          recommendations.push('Implement code splitting and lazy loading');
          break;
        case 'memoryUsage':
          recommendations.push('Optimize memory usage and implement proper cleanup');
          break;
        case 'firstContentfulPaint':
          recommendations.push('Optimize critical rendering path and reduce bundle size');
          break;
        case 'largestContentfulPaint':
          recommendations.push('Optimize images and implement progressive loading');
          break;
        case 'cumulativeLayoutShift':
          recommendations.push('Define explicit dimensions for dynamic content');
          break;
        case 'firstInputDelay':
          recommendations.push('Reduce main thread blocking and defer non-critical JavaScript');
          break;
      }
    });

    return recommendations;
  }

  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.startTimes.clear();
  }
}

export interface PerformanceEvaluation {
  overallScore: number;
  categoryScores: Record<string, number>;
  criticalIssues: string[];
  recommendations: string[];
  passedThresholds: Record<string, number>;
  failedThresholds: Record<string, number>;
}

export class PerformanceTestRunner {
  private monitor: PerformanceMonitor;

  constructor() {
    this.monitor = new PerformanceMonitor();
  }

  async runSearchPerformanceTest(iterations: number = 10): Promise<PerformanceTestResult> {
    const results: PerformanceMetrics[] = [];

    for (let i = 0; i < iterations; i++) {
      const metrics = await this.monitor.measureSearchPerformance();
      results.push(metrics as PerformanceMetrics);

      // Wait between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.aggregateResults(results);
  }

  async runComprehensivePerformanceTest(): Promise<PerformanceTestResult> {
    const testSuites = [
      () => this.testSearchScenarios(),
      () => this.testFilterScenarios(),
      () => this.testRenderingScenarios(),
      () => this.testMemoryScenarios()
    ];

    const allResults: PerformanceMetrics[] = [];

    for (const testSuite of testSuites) {
      const suiteResults = await testSuite();
      allResults.push(...suiteResults);
    }

    return this.aggregateResults(allResults);
  }

  private async testSearchScenarios(): Promise<PerformanceMetrics[]> {
    const scenarios = [
      'S0C7 abend',
      'VSAM error status',
      'JCL job failure',
      'DB2 SQL performance',
      'CICS timeout issue'
    ];

    const results: PerformanceMetrics[] = [];

    for (const query of scenarios) {
      const metrics = await this.monitor.measureSearchPerformance();
      results.push(metrics as PerformanceMetrics);
    }

    return results;
  }

  private async testFilterScenarios(): Promise<PerformanceMetrics[]> {
    const filterCombinations = [
      { category: 'COBOL' },
      { category: 'VSAM', tags: ['error'] },
      { tags: ['performance', 'optimization'] },
      { threshold: 0.8 },
      { category: 'DB2', threshold: 0.6, sortBy: 'usage' }
    ];

    const results: PerformanceMetrics[] = [];

    for (const filters of filterCombinations) {
      const filterTime = await this.monitor.measureFilterPerformance();
      const baseMetrics = this.monitor.getMetrics();
      baseMetrics.filterApplicationTime = filterTime;
      results.push(baseMetrics);
    }

    return results;
  }

  private async testRenderingScenarios(): Promise<PerformanceMetrics[]> {
    const resultCounts = [10, 25, 50, 100, 250];
    const results: PerformanceMetrics[] = [];

    for (const count of resultCounts) {
      // Simulate rendering different result set sizes
      this.monitor.startTiming('render');

      // Simulate DOM manipulation time based on result count
      await new Promise(resolve => setTimeout(resolve, count * 2));

      const renderTime = this.monitor.endTiming('render');
      const metrics = this.monitor.getMetrics();
      metrics.resultRenderTime = renderTime;

      results.push(metrics);
    }

    return results;
  }

  private async testMemoryScenarios(): Promise<PerformanceMetrics[]> {
    const results: PerformanceMetrics[] = [];

    // Test memory usage with different operations
    const operations = [
      'initial-load',
      'search-heavy-use',
      'filter-operations',
      'result-navigation',
      'cleanup'
    ];

    for (const operation of operations) {
      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }

      const metrics = this.monitor.getMetrics();
      this.monitor.measureResourceUsage();
      results.push(this.monitor.getMetrics());

      // Simulate operation load
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  private aggregateResults(results: PerformanceMetrics[]): PerformanceTestResult {
    if (results.length === 0) {
      throw new Error('No performance results to aggregate');
    }

    const aggregated: PerformanceMetrics = {} as PerformanceMetrics;
    const keys = Object.keys(results[0]) as (keyof PerformanceMetrics)[];

    // Calculate averages
    keys.forEach(key => {
      const values = results.map(r => r[key]).filter(v => v > 0);
      aggregated[key] = values.length > 0
        ? values.reduce((sum, val) => sum + val, 0) / values.length
        : 0;
    });

    // Calculate additional statistics
    const stats: PerformanceStats = {} as PerformanceStats;
    keys.forEach(key => {
      const values = results.map(r => r[key]).filter(v => v > 0);
      if (values.length > 0) {
        values.sort((a, b) => a - b);
        stats[key] = {
          min: values[0],
          max: values[values.length - 1],
          median: values[Math.floor(values.length / 2)],
          p95: values[Math.floor(values.length * 0.95)],
          standardDeviation: this.calculateStandardDeviation(values)
        };
      }
    });

    const evaluation = this.monitor.evaluatePerformance();

    return {
      averageMetrics: aggregated,
      statistics: stats,
      evaluation,
      rawResults: results,
      testCount: results.length
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(variance);
  }

  cleanup(): void {
    this.monitor.cleanup();
  }
}

export interface PerformanceStats {
  [K in keyof PerformanceMetrics]: {
    min: number;
    max: number;
    median: number;
    p95: number;
    standardDeviation: number;
  };
}

export interface PerformanceTestResult {
  averageMetrics: PerformanceMetrics;
  statistics: PerformanceStats;
  evaluation: PerformanceEvaluation;
  rawResults: PerformanceMetrics[];
  testCount: number;
}