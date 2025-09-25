/**
 * Electron Performance Metrics Collector
 * Comprehensive performance monitoring for Electron applications
 *
 * Key Metrics:
 * - Render time < 16ms (60 FPS)
 * - Search response < 1000ms
 * - Memory usage < 10MB/hour growth
 * - IPC round-trip < 5ms
 * - Window operations < 100ms
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { app, BrowserWindow, ipcMain, webContents } from 'electron';

export interface PerformanceMetrics {
  // Render Performance
  renderTime: number;
  frameRate: number;
  renderTargetMet: boolean; // < 16ms target

  // Search Performance
  searchResponseTime: number;
  searchTargetMet: boolean; // < 1000ms target

  // Memory Metrics
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    growthRate: number; // MB/hour
  };
  memoryTargetMet: boolean; // < 10MB/hour growth

  // IPC Performance
  ipcLatency: number;
  ipcTargetMet: boolean; // < 5ms target

  // Window Operations
  windowOperationTime: number;
  windowTargetMet: boolean; // < 100ms target

  // System Overview
  timestamp: number;
  processId: number;
  cpuUsage: NodeJS.CpuUsage;
}

export interface PerformanceThresholds {
  renderTime: number; // Default: 16ms
  searchResponse: number; // Default: 1000ms
  memoryGrowthRate: number; // Default: 10MB/hour
  ipcLatency: number; // Default: 5ms
  windowOperation: number; // Default: 100ms
}

export class ElectronPerformanceMetrics extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring = false;
  private monitoringInterval: ReturnType<typeof setTimeout> | null = null;
  private memoryBaseline: NodeJS.MemoryUsage | null = null;
  private lastMemoryCheck = Date.now();

  private thresholds: PerformanceThresholds = {
    renderTime: 16, // 60 FPS target
    searchResponse: 1000, // 1 second
    memoryGrowthRate: 10, // 10MB per hour
    ipcLatency: 5, // 5ms
    windowOperation: 100, // 100ms
  };

  private renderTimings: number[] = [];
  private searchTimings: Map<string, number> = new Map();
  private ipcTimings: Map<string, number> = new Map();
  private windowOperationTimings: Map<string, number> = new Map();

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super();

    if (thresholds) {
      this.thresholds = { ...this.thresholds, ...thresholds };
    }

    this.setupIPCHandlers();
    this.setupProcessMonitoring();
    this.setupRenderPerformanceTracking();
    this.setupWindowOperationTracking();
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(intervalMs = 1000): void {
    if (this.isMonitoring) {
      console.warn('Performance monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.memoryBaseline = process.memoryUsage();
    this.lastMemoryCheck = Date.now();

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    this.emit('monitoring-started');
    console.log('Electron performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    this.emit('monitoring-stopped');
    console.log('Electron performance monitoring stopped');
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    const timestamp = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate memory growth rate
    const timeDiff = (timestamp - this.lastMemoryCheck) / 1000 / 3600; // hours
    const memoryGrowth = this.memoryBaseline
      ? (memoryUsage.heapUsed - this.memoryBaseline.heapUsed) / 1024 / 1024 // MB
      : 0;
    const growthRate = timeDiff > 0 ? memoryGrowth / timeDiff : 0;

    // Calculate average render time
    const avgRenderTime =
      this.renderTimings.length > 0
        ? this.renderTimings.reduce((a, b) => a + b, 0) / this.renderTimings.length
        : 0;

    // Calculate frame rate
    const frameRate = avgRenderTime > 0 ? 1000 / avgRenderTime : 0;

    // Get latest timings
    const latestSearchTime = this.getLatestTiming(this.searchTimings);
    const latestIpcTime = this.getLatestTiming(this.ipcTimings);
    const latestWindowTime = this.getLatestTiming(this.windowOperationTimings);

    const metrics: PerformanceMetrics = {
      // Render Performance
      renderTime: avgRenderTime,
      frameRate,
      renderTargetMet: avgRenderTime <= this.thresholds.renderTime,

      // Search Performance
      searchResponseTime: latestSearchTime,
      searchTargetMet: latestSearchTime <= this.thresholds.searchResponse,

      // Memory Metrics
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        growthRate,
      },
      memoryTargetMet: growthRate <= this.thresholds.memoryGrowthRate,

      // IPC Performance
      ipcLatency: latestIpcTime,
      ipcTargetMet: latestIpcTime <= this.thresholds.ipcLatency,

      // Window Operations
      windowOperationTime: latestWindowTime,
      windowTargetMet: latestWindowTime <= this.thresholds.windowOperation,

      // System Overview
      timestamp,
      processId: process.pid,
      cpuUsage,
    };

    this.metrics.push(metrics);
    this.emit('metrics-collected', metrics);

    // Check for threshold violations
    this.checkThresholds(metrics);

    // Clear old timing data
    this.clearOldTimings();
  }

  /**
   * Track render performance
   */
  public trackRenderStart(): string {
    const renderStartId = `render-${Date.now()}-${Math.random()}`;
    const startTime = performance.now();

    // Store start time for later completion
    (global as any).__renderTracking = (global as any).__renderTracking || new Map();
    (global as any).__renderTracking.set(renderStartId, startTime);

    return renderStartId;
  }

  public trackRenderEnd(renderStartId: string): number {
    const endTime = performance.now();
    const renderTracking = (global as any).__renderTracking;

    if (!renderTracking || !renderTracking.has(renderStartId)) {
      console.warn('Render tracking ID not found:', renderStartId);
      return 0;
    }

    const startTime = renderTracking.get(renderStartId);
    const renderTime = endTime - startTime;

    this.renderTimings.push(renderTime);
    renderTracking.delete(renderStartId);

    // Keep only last 100 measurements
    if (this.renderTimings.length > 100) {
      this.renderTimings = this.renderTimings.slice(-100);
    }

    return renderTime;
  }

  /**
   * Track search performance
   */
  public trackSearchStart(query: string): string {
    const searchId = `search-${Date.now()}-${query.slice(0, 10)}`;
    this.searchTimings.set(searchId, performance.now());
    return searchId;
  }

  public trackSearchEnd(searchId: string): number {
    const endTime = performance.now();
    const startTime = this.searchTimings.get(searchId);

    if (!startTime) {
      console.warn('Search tracking ID not found:', searchId);
      return 0;
    }

    const searchTime = endTime - startTime;
    this.searchTimings.set(searchId, searchTime);

    return searchTime;
  }

  /**
   * Track IPC performance
   */
  public trackIPCStart(channel: string): string {
    const ipcId = `ipc-${channel}-${Date.now()}`;
    this.ipcTimings.set(ipcId, performance.now());
    return ipcId;
  }

  public trackIPCEnd(ipcId: string): number {
    const endTime = performance.now();
    const startTime = this.ipcTimings.get(ipcId);

    if (!startTime) {
      console.warn('IPC tracking ID not found:', ipcId);
      return 0;
    }

    const ipcTime = endTime - startTime;
    this.ipcTimings.set(ipcId, ipcTime);

    return ipcTime;
  }

  /**
   * Track window operation performance
   */
  public trackWindowOperationStart(operation: string): string {
    const windowId = `window-${operation}-${Date.now()}`;
    this.windowOperationTimings.set(windowId, performance.now());
    return windowId;
  }

  public trackWindowOperationEnd(windowId: string): number {
    const endTime = performance.now();
    const startTime = this.windowOperationTimings.get(windowId);

    if (!startTime) {
      console.warn('Window operation tracking ID not found:', windowId);
      return 0;
    }

    const operationTime = endTime - startTime;
    this.windowOperationTimings.set(windowId, operationTime);

    return operationTime;
  }

  /**
   * Setup IPC handlers for renderer process communication
   */
  private setupIPCHandlers(): void {
    // Render performance tracking
    ipcMain.handle('perf:track-render-start', () => {
      return this.trackRenderStart();
    });

    ipcMain.handle('perf:track-render-end', (event, renderStartId: string) => {
      return this.trackRenderEnd(renderStartId);
    });

    // Search performance tracking
    ipcMain.handle('perf:track-search-start', (event, query: string) => {
      return this.trackSearchStart(query);
    });

    ipcMain.handle('perf:track-search-end', (event, searchId: string) => {
      return this.trackSearchEnd(searchId);
    });

    // Get current metrics
    ipcMain.handle('perf:get-metrics', () => {
      return this.getLatestMetrics();
    });

    // Get historical data
    ipcMain.handle('perf:get-history', (event, count?: number) => {
      return this.getMetricsHistory(count);
    });
  }

  /**
   * Setup process monitoring
   */
  private setupProcessMonitoring(): void {
    // Monitor app events
    app.on('ready', () => {
      console.log('App ready - starting performance monitoring');
      this.startMonitoring();
    });

    app.on('before-quit', () => {
      console.log('App quitting - stopping performance monitoring');
      this.stopMonitoring();
    });

    // Monitor window events
    app.on('browser-window-created', (event, window) => {
      this.trackWindowEvents(window);
    });
  }

  /**
   * Setup render performance tracking
   */
  private setupRenderPerformanceTracking(): void {
    // This will be implemented in renderer process
    // Main process provides the infrastructure
  }

  /**
   * Setup window operation tracking
   */
  private setupWindowOperationTracking(): void {
    // Track common window operations
    const operations = ['show', 'hide', 'minimize', 'maximize', 'restore', 'focus', 'blur'];

    app.on('browser-window-created', (event, window) => {
      operations.forEach(operation => {
        window.on(operation as any, () => {
          const windowId = this.trackWindowOperationStart(operation);
          setImmediate(() => {
            this.trackWindowOperationEnd(windowId);
          });
        });
      });
    });
  }

  /**
   * Track window events for performance monitoring
   */
  private trackWindowEvents(window: BrowserWindow): void {
    window.webContents.on('did-start-loading', () => {
      this.trackWindowOperationStart('page-load');
    });

    window.webContents.on('did-finish-load', () => {
      // Find the corresponding start and calculate time
      const windowId = `window-page-load-${Date.now()}`;
      this.trackWindowOperationEnd(windowId);
    });

    window.webContents.on('dom-ready', () => {
      const windowId = this.trackWindowOperationStart('dom-ready');
      setImmediate(() => {
        this.trackWindowOperationEnd(windowId);
      });
    });
  }

  /**
   * Check performance thresholds and emit alerts
   */
  private checkThresholds(metrics: PerformanceMetrics): void {
    if (!metrics.renderTargetMet) {
      this.emit('threshold-violation', {
        type: 'render-time',
        value: metrics.renderTime,
        threshold: this.thresholds.renderTime,
        message: `Render time ${metrics.renderTime.toFixed(2)}ms exceeds target of ${this.thresholds.renderTime}ms`,
      });
    }

    if (!metrics.searchTargetMet) {
      this.emit('threshold-violation', {
        type: 'search-response',
        value: metrics.searchResponseTime,
        threshold: this.thresholds.searchResponse,
        message: `Search response time ${metrics.searchResponseTime.toFixed(2)}ms exceeds target of ${this.thresholds.searchResponse}ms`,
      });
    }

    if (!metrics.memoryTargetMet) {
      this.emit('threshold-violation', {
        type: 'memory-growth',
        value: metrics.memoryUsage.growthRate,
        threshold: this.thresholds.memoryGrowthRate,
        message: `Memory growth rate ${metrics.memoryUsage.growthRate.toFixed(2)}MB/h exceeds target of ${this.thresholds.memoryGrowthRate}MB/h`,
      });
    }

    if (!metrics.ipcTargetMet) {
      this.emit('threshold-violation', {
        type: 'ipc-latency',
        value: metrics.ipcLatency,
        threshold: this.thresholds.ipcLatency,
        message: `IPC latency ${metrics.ipcLatency.toFixed(2)}ms exceeds target of ${this.thresholds.ipcLatency}ms`,
      });
    }

    if (!metrics.windowTargetMet) {
      this.emit('threshold-violation', {
        type: 'window-operation',
        value: metrics.windowOperationTime,
        threshold: this.thresholds.windowOperation,
        message: `Window operation time ${metrics.windowOperationTime.toFixed(2)}ms exceeds target of ${this.thresholds.windowOperation}ms`,
      });
    }
  }

  /**
   * Get latest timing from timing map
   */
  private getLatestTiming(timingMap: Map<string, number>): number {
    if (timingMap.size === 0) return 0;

    const values = Array.from(timingMap.values());
    return values[values.length - 1] || 0;
  }

  /**
   * Clear old timing data to prevent memory leaks
   */
  private clearOldTimings(): void {
    const cutoff = Date.now() - 60000; // Keep last 1 minute

    // Clear old search timings
    for (const [key, value] of this.searchTimings) {
      if (typeof value === 'number' && value < cutoff) {
        this.searchTimings.delete(key);
      }
    }

    // Clear old IPC timings
    for (const [key, value] of this.ipcTimings) {
      if (typeof value === 'number' && value < cutoff) {
        this.ipcTimings.delete(key);
      }
    }

    // Clear old window operation timings
    for (const [key, value] of this.windowOperationTimings) {
      if (typeof value === 'number' && value < cutoff) {
        this.windowOperationTimings.delete(key);
      }
    }
  }

  /**
   * Get latest performance metrics
   */
  public getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get performance metrics history
   */
  public getMetricsHistory(count?: number): PerformanceMetrics[] {
    if (!count) return [...this.metrics];
    return this.metrics.slice(-count);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    averageRenderTime: number;
    averageSearchTime: number;
    averageIPCLatency: number;
    averageWindowOperationTime: number;
    memoryGrowthTrend: number;
    thresholdViolations: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageRenderTime: 0,
        averageSearchTime: 0,
        averageIPCLatency: 0,
        averageWindowOperationTime: 0,
        memoryGrowthTrend: 0,
        thresholdViolations: 0,
      };
    }

    const recent = this.metrics.slice(-10); // Last 10 measurements

    return {
      averageRenderTime: recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length,
      averageSearchTime: recent.reduce((sum, m) => sum + m.searchResponseTime, 0) / recent.length,
      averageIPCLatency: recent.reduce((sum, m) => sum + m.ipcLatency, 0) / recent.length,
      averageWindowOperationTime:
        recent.reduce((sum, m) => sum + m.windowOperationTime, 0) / recent.length,
      memoryGrowthTrend:
        recent.reduce((sum, m) => sum + m.memoryUsage.growthRate, 0) / recent.length,
      thresholdViolations: recent.filter(
        m =>
          !m.renderTargetMet ||
          !m.searchTargetMet ||
          !m.memoryTargetMet ||
          !m.ipcTargetMet ||
          !m.windowTargetMet
      ).length,
    };
  }

  /**
   * Export performance data
   */
  public exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'timestamp',
        'renderTime',
        'frameRate',
        'searchResponseTime',
        'memoryHeapUsed',
        'memoryGrowthRate',
        'ipcLatency',
        'windowOperationTime',
      ];

      const rows = this.metrics.map(m => [
        m.timestamp,
        m.renderTime,
        m.frameRate,
        m.searchResponseTime,
        m.memoryUsage.heapUsed,
        m.memoryUsage.growthRate,
        m.ipcLatency,
        m.windowOperationTime,
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify(this.metrics, null, 2);
  }
}

export default ElectronPerformanceMetrics;
