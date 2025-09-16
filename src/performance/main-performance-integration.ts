/**
 * Main Process Performance Integration
 * Sets up performance monitoring in the main Electron process
 */

import { ipcMain } from 'electron';
import PerformanceIntegration from './PerformanceIntegration';

let performanceIntegration: PerformanceIntegration | null = null;

/**
 * Initialize performance monitoring in main process
 */
export function initializeMainPerformanceMonitoring(): PerformanceIntegration {
  if (performanceIntegration) {
    console.warn('Performance monitoring already initialized');
    return performanceIntegration;
  }

  performanceIntegration = new PerformanceIntegration();

  // Setup IPC handlers for renderer communication
  setupIPCHandlers();

  // Setup event forwarding to renderer
  setupEventForwarding();

  // Start monitoring by default
  performanceIntegration.startMonitoring();

  console.log('Main process performance monitoring initialized');
  return performanceIntegration;
}

/**
 * Setup IPC handlers for performance API
 */
function setupIPCHandlers(): void {
  if (!performanceIntegration) return;

  // Basic tracking handlers
  ipcMain.handle('perf:track-render-start', () => {
    return performanceIntegration?.getMonitors().electron.trackRenderStart();
  });

  ipcMain.handle('perf:track-render-end', (event, renderStartId: string) => {
    return performanceIntegration?.getMonitors().electron.trackRenderEnd(renderStartId);
  });

  ipcMain.handle('perf:track-search-start', (event, query: string) => {
    return performanceIntegration?.getMonitors().search.startSearch(query);
  });

  ipcMain.handle('perf:track-search-end', (event, searchId: string) => {
    return performanceIntegration?.getMonitors().search.endSearch(searchId, 0); // Will be updated with actual results
  });

  ipcMain.handle('perf:track-ipc-start', (event, channel: string) => {
    return performanceIntegration?.getMonitors().ipc.trackIPCStart(channel, 'renderer-to-main');
  });

  ipcMain.handle('perf:track-ipc-end', (event, ipcId: string) => {
    return performanceIntegration?.getMonitors().ipc.trackIPCEnd(ipcId);
  });

  ipcMain.handle('perf:track-window-start', (event, operation: string) => {
    const windowId = event.sender.id || 0;
    return performanceIntegration?.getMonitors().window.startOperation(operation, windowId);
  });

  ipcMain.handle('perf:track-window-end', (event, windowOperationId: string) => {
    return performanceIntegration?.getMonitors().window.endOperation(windowOperationId);
  });

  // Metrics retrieval handlers
  ipcMain.handle('perf:get-metrics', () => {
    return performanceIntegration?.getMonitors().electron.getLatestMetrics();
  });

  ipcMain.handle('perf:get-history', (event, count?: number) => {
    return performanceIntegration?.getMonitors().electron.getMetricsHistory(count);
  });

  ipcMain.handle('perf:get-summary', () => {
    return performanceIntegration?.getMonitors().electron.getPerformanceSummary();
  });

  ipcMain.handle('perf:get-integrated-data', () => {
    return performanceIntegration?.getCurrentData();
  });

  ipcMain.handle('perf:get-report', () => {
    return performanceIntegration?.getPerformanceReport();
  });

  // Component-specific metrics
  ipcMain.handle('perf:get-component-metrics', () => {
    return performanceIntegration?.getMonitors().renderer.getPerformanceSummary();
  });

  ipcMain.handle('perf:get-search-metrics', () => {
    return performanceIntegration?.getMonitors().search.getSummary();
  });

  ipcMain.handle('perf:get-ipc-metrics', () => {
    return performanceIntegration?.getMonitors().ipc.getPerformanceSummary();
  });

  ipcMain.handle('perf:get-memory-metrics', () => {
    return performanceIntegration?.getMonitors().memory.getCurrentAnalysis();
  });

  ipcMain.handle('perf:get-window-metrics', () => {
    return performanceIntegration?.getMonitors().window.getPerformanceSummary();
  });

  // Alert management
  ipcMain.handle('perf:get-alerts', (event, count?: number) => {
    return performanceIntegration?.getAlerts(count);
  });

  ipcMain.handle('perf:get-alerts-severity', (event, severity: string) => {
    return performanceIntegration?.getAlertsBySeverity(severity as any);
  });

  ipcMain.handle('perf:clear-old-alerts', (event, olderThanMs?: number) => {
    return performanceIntegration?.clearOldAlerts(olderThanMs);
  });

  // Performance control
  ipcMain.handle('perf:start-monitoring', () => {
    performanceIntegration?.startMonitoring();
    return true;
  });

  ipcMain.handle('perf:stop-monitoring', () => {
    performanceIntegration?.stopMonitoring();
    return true;
  });

  ipcMain.handle('perf:reset-metrics', () => {
    performanceIntegration?.resetAllData();
    return true;
  });

  // Data export
  ipcMain.handle('perf:export-metrics', (event, format: 'json' | 'csv' = 'json') => {
    return performanceIntegration?.getMonitors().electron.exportMetrics(format);
  });

  ipcMain.handle('perf:export-all-data', (event, format: 'json' | 'csv' = 'json') => {
    return performanceIntegration?.exportAllData(format);
  });

  // Memory management
  ipcMain.handle('perf:force-gc', () => {
    return performanceIntegration?.getMonitors().memory.forceGC();
  });

  ipcMain.handle('perf:get-memory-snapshot', () => {
    const memory = performanceIntegration?.getMonitors().memory;
    return memory?.getSnapshots(1)[0] || null;
  });

  // Performance targets
  ipcMain.handle('perf:update-targets', (event, targets: any) => {
    // Update targets for all monitors
    if (targets.renderTime) {
      // performanceIntegration?.getMonitors().electron.setTargetRenderTime(targets.renderTime);
    }
    if (targets.searchResponse) {
      performanceIntegration?.getMonitors().search.setTargetResponseTime(targets.searchResponse);
    }
    if (targets.ipcLatency) {
      performanceIntegration?.getMonitors().ipc.setTargetLatency(targets.ipcLatency);
    }
    if (targets.windowOperation) {
      performanceIntegration?.getMonitors().window.setTargetDuration(targets.windowOperation);
    }
    return true;
  });

  ipcMain.handle('perf:get-targets', () => {
    return {
      renderTime: 16, // ms
      searchResponse: performanceIntegration?.getMonitors().search.getTargetResponseTime() || 1000,
      ipcLatency: performanceIntegration?.getMonitors().ipc.getTargetLatency() || 5,
      windowOperation: performanceIntegration?.getMonitors().window.getTargetDuration() || 100,
      memoryGrowthRate: 10 // MB/hour
    };
  });

  // Benchmarking
  ipcMain.handle('perf:run-benchmark', async (event, type: string, options?: any) => {
    return runPerformanceBenchmark(type, options);
  });

  ipcMain.handle('perf:get-benchmark-results', () => {
    // Return stored benchmark results
    return getBenchmarkResults();
  });

  // Health check
  ipcMain.handle('perf:get-system-health', () => {
    const currentData = performanceIntegration?.getCurrentData();
    return {
      overallHealth: currentData?.overallHealth || 'unknown',
      timestamp: Date.now(),
      metrics: currentData
    };
  });

  ipcMain.handle('perf:get-health-trend', (event, hours = 1) => {
    const history = performanceIntegration?.getPerformanceHistory();
    if (!history) return [];

    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return history.filter(data => data.timestamp >= cutoff);
  });
}

/**
 * Setup event forwarding to renderer processes
 */
function setupEventForwarding(): void {
  if (!performanceIntegration) return;

  // Forward performance events to all renderer processes
  performanceIntegration.on('data-collected', (data) => {
    // Send to all renderer processes
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('perf:metrics-updated', data);
      }
    });
  });

  performanceIntegration.on('alert-added', (alert) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('perf:alert-added', alert);
      }
    });
  });

  performanceIntegration.on('critical-alert', (alert) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('perf:critical-alert', alert);
      }
    });
  });

  // Forward threshold violations
  performanceIntegration.getMonitors().electron.on('threshold-violation', (violation) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('perf:threshold-violation', violation);
      }
    });
  });
}

/**
 * Run performance benchmark
 */
async function runPerformanceBenchmark(type: string, options: any = {}): Promise<any> {
  const startTime = performance.now();
  let results: any = {};

  switch (type) {
    case 'memory':
      results = await runMemoryBenchmark(options);
      break;
    case 'ipc':
      results = await runIPCBenchmark(options);
      break;
    case 'search':
      results = await runSearchBenchmark(options);
      break;
    case 'comprehensive':
      results = await runComprehensiveBenchmark(options);
      break;
    default:
      throw new Error(`Unknown benchmark type: ${type}`);
  }

  const endTime = performance.now();
  results.benchmarkDuration = endTime - startTime;
  results.timestamp = Date.now();

  // Store results
  storeBenchmarkResults(type, results);

  return results;
}

/**
 * Memory benchmark
 */
async function runMemoryBenchmark(options: any): Promise<any> {
  const iterations = options.iterations || 1000;
  const results: any = { type: 'memory', iterations };

  const startMemory = process.memoryUsage();
  const objects: any[] = [];

  // Allocate memory
  for (let i = 0; i < iterations; i++) {
    objects.push({
      id: i,
      data: new Array(1000).fill(Math.random()),
      timestamp: Date.now()
    });
  }

  const midMemory = process.memoryUsage();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Wait for GC
  await new Promise(resolve => setTimeout(resolve, 100));

  const endMemory = process.memoryUsage();

  results.memoryAllocated = midMemory.heapUsed - startMemory.heapUsed;
  results.memoryRetained = endMemory.heapUsed - startMemory.heapUsed;
  results.gcEfficiency = (midMemory.heapUsed - endMemory.heapUsed) / midMemory.heapUsed;

  return results;
}

/**
 * IPC benchmark
 */
async function runIPCBenchmark(options: any): Promise<any> {
  const iterations = options.iterations || 100;
  const results: any = { type: 'ipc', iterations };

  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // Simulate IPC roundtrip (this is a simplified version)
    await new Promise(resolve => setImmediate(resolve));

    const end = performance.now();
    latencies.push(end - start);
  }

  results.averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
  results.minLatency = Math.min(...latencies);
  results.maxLatency = Math.max(...latencies);
  results.p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

  return results;
}

/**
 * Search benchmark
 */
async function runSearchBenchmark(options: any): Promise<any> {
  const iterations = options.iterations || 50;
  const results: any = { type: 'search', iterations };

  const searchTimes: number[] = [];
  const testData = generateTestSearchData(options.dataSize || 10000);

  for (let i = 0; i < iterations; i++) {
    const query = `test-query-${i}`;
    const start = performance.now();

    // Simulate search operation
    await simulateSearch(testData, query);

    const end = performance.now();
    searchTimes.push(end - start);
  }

  results.averageSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
  results.minSearchTime = Math.min(...searchTimes);
  results.maxSearchTime = Math.max(...searchTimes);
  results.p95SearchTime = searchTimes.sort((a, b) => a - b)[Math.floor(searchTimes.length * 0.95)];

  return results;
}

/**
 * Comprehensive benchmark
 */
async function runComprehensiveBenchmark(options: any): Promise<any> {
  const results: any = { type: 'comprehensive' };

  results.memory = await runMemoryBenchmark(options);
  results.ipc = await runIPCBenchmark(options);
  results.search = await runSearchBenchmark(options);

  results.overallScore = calculateOverallScore(results);

  return results;
}

/**
 * Generate test search data
 */
function generateTestSearchData(size: number): any[] {
  const data = [];
  for (let i = 0; i < size; i++) {
    data.push({
      id: i,
      title: `Test Item ${i}`,
      content: `This is test content for item ${i} with some keywords`,
      tags: [`tag-${i % 10}`, `category-${i % 5}`]
    });
  }
  return data;
}

/**
 * Simulate search operation
 */
async function simulateSearch(data: any[], query: string): Promise<any[]> {
  // Simple filtering simulation
  return data.filter(item =>
    item.title.includes(query) ||
    item.content.includes(query) ||
    item.tags.some((tag: string) => tag.includes(query))
  );
}

/**
 * Calculate overall performance score
 */
function calculateOverallScore(results: any): number {
  let score = 100;

  // Memory score
  if (results.memory.gcEfficiency < 0.5) score -= 20;
  if (results.memory.memoryRetained > results.memory.memoryAllocated * 0.1) score -= 10;

  // IPC score
  if (results.ipc.averageLatency > 5) score -= 15;
  if (results.ipc.p95Latency > 10) score -= 10;

  // Search score
  if (results.search.averageSearchTime > 100) score -= 20;
  if (results.search.p95SearchTime > 500) score -= 15;

  return Math.max(0, score);
}

/**
 * Store benchmark results
 */
function storeBenchmarkResults(type: string, results: any): void {
  // In a real implementation, this would store to a database or file
  // For now, just keep in memory
  if (!(global as any).benchmarkResults) {
    (global as any).benchmarkResults = [];
  }
  (global as any).benchmarkResults.push({ type, results, timestamp: Date.now() });
}

/**
 * Get stored benchmark results
 */
function getBenchmarkResults(): any[] {
  return (global as any).benchmarkResults || [];
}

/**
 * Get performance integration instance
 */
export function getPerformanceIntegration(): PerformanceIntegration | null {
  return performanceIntegration;
}

/**
 * Cleanup performance monitoring
 */
export function cleanupMainPerformanceMonitoring(): void {
  if (performanceIntegration) {
    performanceIntegration.stopMonitoring();
    performanceIntegration.removeAllListeners();
    performanceIntegration = null;
  }

  // Remove IPC handlers
  const channels = [
    'perf:track-render-start', 'perf:track-render-end',
    'perf:track-search-start', 'perf:track-search-end',
    'perf:track-ipc-start', 'perf:track-ipc-end',
    'perf:track-window-start', 'perf:track-window-end',
    'perf:get-metrics', 'perf:get-history', 'perf:get-summary',
    'perf:get-integrated-data', 'perf:get-report',
    'perf:get-component-metrics', 'perf:get-search-metrics',
    'perf:get-ipc-metrics', 'perf:get-memory-metrics',
    'perf:get-window-metrics', 'perf:get-alerts',
    'perf:get-alerts-severity', 'perf:clear-old-alerts',
    'perf:start-monitoring', 'perf:stop-monitoring',
    'perf:reset-metrics', 'perf:export-metrics',
    'perf:export-all-data', 'perf:force-gc',
    'perf:get-memory-snapshot', 'perf:update-targets',
    'perf:get-targets', 'perf:run-benchmark',
    'perf:get-benchmark-results', 'perf:get-system-health',
    'perf:get-health-trend'
  ];

  channels.forEach(channel => {
    ipcMain.removeHandler(channel);
  });

  console.log('Main process performance monitoring cleaned up');
}

export default {
  initializeMainPerformanceMonitoring,
  getPerformanceIntegration,
  cleanupMainPerformanceMonitoring
};