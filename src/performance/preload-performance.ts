/**
 * Performance Monitoring Preload Script
 * Exposes performance tracking APIs to renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Performance API for renderer process
const performanceAPI = {
  // Render performance tracking
  trackRenderStart: () => ipcRenderer.invoke('perf:track-render-start'),
  trackRenderEnd: (renderStartId: string) =>
    ipcRenderer.invoke('perf:track-render-end', renderStartId),

  // Search performance tracking
  trackSearchStart: (query: string) => ipcRenderer.invoke('perf:track-search-start', query),
  trackSearchEnd: (searchId: string) => ipcRenderer.invoke('perf:track-search-end', searchId),

  // IPC performance tracking
  trackIPCStart: (channel: string) => ipcRenderer.invoke('perf:track-ipc-start', channel),
  trackIPCEnd: (ipcId: string) => ipcRenderer.invoke('perf:track-ipc-end', ipcId),

  // Window operation tracking
  trackWindowOperationStart: (operation: string) =>
    ipcRenderer.invoke('perf:track-window-start', operation),
  trackWindowOperationEnd: (windowId: string) =>
    ipcRenderer.invoke('perf:track-window-end', windowId),

  // Get performance metrics
  getPerformanceMetrics: () => ipcRenderer.invoke('perf:get-metrics'),
  getMetricsHistory: (count?: number) => ipcRenderer.invoke('perf:get-history', count),
  getPerformanceSummary: () => ipcRenderer.invoke('perf:get-summary'),

  // Get integrated performance data
  getIntegratedData: () => ipcRenderer.invoke('perf:get-integrated-data'),
  getPerformanceReport: () => ipcRenderer.invoke('perf:get-report'),

  // Component-specific metrics
  getComponentMetrics: () => ipcRenderer.invoke('perf:get-component-metrics'),
  getSearchMetrics: () => ipcRenderer.invoke('perf:get-search-metrics'),
  getIPCMetrics: () => ipcRenderer.invoke('perf:get-ipc-metrics'),
  getMemoryMetrics: () => ipcRenderer.invoke('perf:get-memory-metrics'),
  getWindowMetrics: () => ipcRenderer.invoke('perf:get-window-metrics'),

  // Alert management
  getAlerts: (count?: number) => ipcRenderer.invoke('perf:get-alerts', count),
  getAlertsBySeverity: (severity: string) =>
    ipcRenderer.invoke('perf:get-alerts-severity', severity),
  clearOldAlerts: (olderThanMs?: number) =>
    ipcRenderer.invoke('perf:clear-old-alerts', olderThanMs),

  // Performance control
  startMonitoring: () => ipcRenderer.invoke('perf:start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('perf:stop-monitoring'),
  resetMetrics: () => ipcRenderer.invoke('perf:reset-metrics'),

  // Data export
  exportMetrics: (format?: 'json' | 'csv') => ipcRenderer.invoke('perf:export-metrics', format),
  exportAllData: (format?: 'json' | 'csv') => ipcRenderer.invoke('perf:export-all-data', format),

  // Real-time events
  onMetricsUpdated: (callback: (metrics: any) => void) => {
    ipcRenderer.on('perf:metrics-updated', (event, metrics) => callback(metrics));
    return () => ipcRenderer.removeAllListeners('perf:metrics-updated');
  },

  onAlertAdded: (callback: (alert: any) => void) => {
    ipcRenderer.on('perf:alert-added', (event, alert) => callback(alert));
    return () => ipcRenderer.removeAllListeners('perf:alert-added');
  },

  onCriticalAlert: (callback: (alert: any) => void) => {
    ipcRenderer.on('perf:critical-alert', (event, alert) => callback(alert));
    return () => ipcRenderer.removeAllListeners('perf:critical-alert');
  },

  onThresholdViolation: (callback: (violation: any) => void) => {
    ipcRenderer.on('perf:threshold-violation', (event, violation) => callback(violation));
    return () => ipcRenderer.removeAllListeners('perf:threshold-violation');
  },

  // Memory management
  forceGC: () => ipcRenderer.invoke('perf:force-gc'),
  getMemorySnapshot: () => ipcRenderer.invoke('perf:get-memory-snapshot'),

  // Performance targets
  updateTargets: (targets: any) => ipcRenderer.invoke('perf:update-targets', targets),
  getTargets: () => ipcRenderer.invoke('perf:get-targets'),

  // Benchmarking
  runBenchmark: (type: string, options?: any) =>
    ipcRenderer.invoke('perf:run-benchmark', type, options),
  getBenchmarkResults: () => ipcRenderer.invoke('perf:get-benchmark-results'),

  // Health check
  getSystemHealth: () => ipcRenderer.invoke('perf:get-system-health'),
  getHealthTrend: (hours?: number) => ipcRenderer.invoke('perf:get-health-trend', hours),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronPerformanceAPI', performanceAPI);

// Also add to the existing electronAPI if it exists
if (typeof window !== 'undefined') {
  // Extend existing electronAPI or create new one
  contextBridge.exposeInMainWorld('electronAPI', {
    ...performanceAPI,
    // Backwards compatibility aliases
    trackRenderStart: performanceAPI.trackRenderStart,
    trackRenderEnd: performanceAPI.trackRenderEnd,
    trackSearchStart: performanceAPI.trackSearchStart,
    trackSearchEnd: performanceAPI.trackSearchEnd,
    getPerformanceMetrics: performanceAPI.getPerformanceMetrics,
  });
}

// Performance utilities for renderer
const performanceUtils = {
  /**
   * Wrapper for component render tracking
   */
  trackComponentRender: async (componentName: string, renderFunction: () => Promise<any> | any) => {
    const renderId = await performanceAPI.trackRenderStart();

    try {
      const result = await renderFunction();
      await performanceAPI.trackRenderEnd(renderId);
      return result;
    } catch (error) {
      await performanceAPI.trackRenderEnd(renderId);
      throw error;
    }
  },

  /**
   * Wrapper for search operation tracking
   */
  trackSearchOperation: async (query: string, searchFunction: () => Promise<any>) => {
    const searchId = await performanceAPI.trackSearchStart(query);

    try {
      const result = await searchFunction();
      await performanceAPI.trackSearchEnd(searchId);
      return result;
    } catch (error) {
      await performanceAPI.trackSearchEnd(searchId);
      throw error;
    }
  },

  /**
   * Wrapper for IPC operation tracking
   */
  trackIPCOperation: async (channel: string, ipcFunction: () => Promise<any>) => {
    const ipcId = await performanceAPI.trackIPCStart(channel);

    try {
      const result = await ipcFunction();
      await performanceAPI.trackIPCEnd(ipcId);
      return result;
    } catch (error) {
      await performanceAPI.trackIPCEnd(ipcId);
      throw error;
    }
  },

  /**
   * Debounced performance logging
   */
  debouncedLog: (() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (message: string, delay = 1000) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log(`[Performance] ${message}`);
      }, delay);
    };
  })(),

  /**
   * Performance observer for automatic tracking
   */
  createPerformanceObserver: (callback: (entries: PerformanceEntry[]) => void) => {
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver(list => {
        callback(list.getEntries());
      });

      try {
        observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
        return observer;
      } catch (error) {
        console.warn('PerformanceObserver not fully supported:', error);
        return null;
      }
    }
    return null;
  },

  /**
   * Simple FPS counter
   */
  createFPSCounter: () => {
    let frames = 0;
    let lastTime = performance.now();
    let fps = 0;

    const count = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        fps = Math.round((frames * 1000) / (currentTime - lastTime));
        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(count);
    };

    count();

    return {
      getFPS: () => fps,
      stop: () => (frames = -1), // Signal to stop counting
    };
  },

  /**
   * Memory usage tracker
   */
  trackMemoryUsage: () => {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      };
    }
    return null;
  },

  /**
   * Network performance tracker
   */
  trackNetworkPerformance: () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      };
    }
    return null;
  },
};

// Expose performance utilities
contextBridge.exposeInMainWorld('performanceUtils', performanceUtils);

// Type declarations for TypeScript
declare global {
  interface Window {
    electronPerformanceAPI: typeof performanceAPI;
    performanceUtils: typeof performanceUtils;
    electronAPI: typeof performanceAPI;
  }
}

export { performanceAPI, performanceUtils };
