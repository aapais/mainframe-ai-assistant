/**
 * Performance Monitoring Module
 * Comprehensive Electron performance monitoring system
 *
 * Key Features:
 * - Render time measurement (target: <16ms)
 * - Search response time tracking (target: <1000ms)
 * - Memory usage monitoring (target: <10MB/hour growth)
 * - IPC communication performance (target: <5ms)
 * - Window operation latency (target: <100ms)
 * - Real-time dashboard and alerting
 * - Data persistence and historical analysis
 */

// Core performance monitoring classes
export { default as ElectronPerformanceMetrics } from './ElectronPerformanceMetrics';
export { default as RendererPerformanceTracker } from './RendererPerformanceTracker';
export { default as SearchPerformanceMonitor } from './SearchPerformanceMonitor';
export { default as IPCPerformanceTracker } from './IPCPerformanceTracker';
export { default as MemoryLeakDetector } from './MemoryLeakDetector';
export { default as WindowOperationTracker } from './WindowOperationTracker';

// Integration and dashboard
export { default as PerformanceIntegration } from './PerformanceIntegration';
export { default as PerformanceDashboard } from './PerformanceDashboard';

// Main process integration
export {
  initializeMainPerformanceMonitoring,
  getPerformanceIntegration,
  cleanupMainPerformanceMonitoring,
} from './main-performance-integration';

// Preload script exports
export { performanceAPI, performanceUtils } from './preload-performance';

// React hooks for component performance tracking
export { useComponentPerformance } from './RendererPerformanceTracker';

// Type definitions
export interface PerformanceMetrics {
  renderTime: number;
  frameRate: number;
  renderTargetMet: boolean;
  searchResponseTime: number;
  searchTargetMet: boolean;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    growthRate: number;
  };
  memoryTargetMet: boolean;
  ipcLatency: number;
  ipcTargetMet: boolean;
  windowOperationTime: number;
  windowTargetMet: boolean;
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

export interface PerformanceAlert {
  id: string;
  type: 'threshold-violation' | 'memory-leak' | 'performance-degradation' | 'system-warning';
  component: 'electron' | 'renderer' | 'search' | 'ipc' | 'memory' | 'window';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  data?: any;
}

export interface IntegratedPerformanceData {
  timestamp: number;
  electron: PerformanceMetrics | null;
  renderer: any;
  search: any;
  ipc: any;
  memory: any;
  window: any;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  alertCount: number;
}

// Utility functions
export const performanceDefaults = {
  thresholds: {
    renderTime: 16, // 60 FPS target
    searchResponse: 1000, // 1 second
    memoryGrowthRate: 10, // 10MB per hour
    ipcLatency: 5, // 5ms
    windowOperation: 100, // 100ms
  },

  monitoringInterval: 1000, // 1 second
  historySize: 1000, // Keep 1000 data points
  alertsSize: 100, // Keep 100 alerts
};

/**
 * Create a basic performance monitor with default settings
 */
export function createBasicPerformanceMonitor(options?: {
  thresholds?: Partial<PerformanceThresholds>;
  monitoringInterval?: number;
}) {
  const thresholds = {
    ...performanceDefaults.thresholds,
    ...options?.thresholds,
  };

  const integration = new PerformanceIntegration();

  // Update thresholds if provided
  if (options?.thresholds) {
    const monitors = integration.getMonitors();

    if (options.thresholds.searchResponse) {
      monitors.search.setTargetResponseTime(options.thresholds.searchResponse);
    }
    if (options.thresholds.ipcLatency) {
      monitors.ipc.setTargetLatency(options.thresholds.ipcLatency);
    }
    if (options.thresholds.windowOperation) {
      monitors.window.setTargetDuration(options.thresholds.windowOperation);
    }
  }

  return integration;
}

/**
 * Quick setup for main process performance monitoring
 */
export function quickSetupMainProcess() {
  return initializeMainPerformanceMonitoring();
}

/**
 * Quick setup for renderer process performance monitoring
 */
export function quickSetupRendererProcess() {
  const tracker = new RendererPerformanceTracker();
  tracker.startTracking();
  return tracker;
}

/**
 * Performance monitoring facade for easy usage
 */
export class SimplePerformanceMonitor {
  private integration: PerformanceIntegration;
  private isMainProcess: boolean;

  constructor(options?: { thresholds?: Partial<PerformanceThresholds> }) {
    this.isMainProcess = process.type === 'browser';
    this.integration = createBasicPerformanceMonitor(options);
  }

  /**
   * Start monitoring
   */
  start() {
    this.integration.startMonitoring();
    return this;
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.integration.stopMonitoring();
    return this;
  }

  /**
   * Get current performance status
   */
  getStatus() {
    return this.integration.getCurrentData();
  }

  /**
   * Get performance summary
   */
  getSummary() {
    return this.integration.getPerformanceReport();
  }

  /**
   * Get recent alerts
   */
  getAlerts(count = 10) {
    return this.integration.getAlerts(count);
  }

  /**
   * Subscribe to performance updates
   */
  onUpdate(callback: (data: IntegratedPerformanceData) => void) {
    this.integration.on('data-collected', callback);
    return () => this.integration.off('data-collected', callback);
  }

  /**
   * Subscribe to alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void) {
    this.integration.on('alert-added', callback);
    return () => this.integration.off('alert-added', callback);
  }

  /**
   * Export performance data
   */
  export(format: 'json' | 'csv' = 'json') {
    return this.integration.exportAllData(format);
  }

  /**
   * Reset all data
   */
  reset() {
    this.integration.resetAllData();
    return this;
  }
}

// Default export for convenience
export default {
  // Classes
  ElectronPerformanceMetrics,
  RendererPerformanceTracker,
  SearchPerformanceMonitor,
  IPCPerformanceTracker,
  MemoryLeakDetector,
  WindowOperationTracker,
  PerformanceIntegration,
  PerformanceDashboard,
  SimplePerformanceMonitor,

  // Functions
  createBasicPerformanceMonitor,
  quickSetupMainProcess,
  quickSetupRendererProcess,
  initializeMainPerformanceMonitoring,
  getPerformanceIntegration,
  cleanupMainPerformanceMonitoring,

  // Constants
  performanceDefaults,
};

/**
 * Usage Examples:
 *
 * // Basic setup in main process
 * import { quickSetupMainProcess } from './performance';
 * const performance = quickSetupMainProcess();
 *
 * // Basic setup in renderer process
 * import { quickSetupRendererProcess } from './performance';
 * const tracker = quickSetupRendererProcess();
 *
 * // Simple monitor
 * import { SimplePerformanceMonitor } from './performance';
 * const monitor = new SimplePerformanceMonitor({
 *   thresholds: {
 *     renderTime: 8, // Stricter target
 *     searchResponse: 500
 *   }
 * }).start();
 *
 * // React component usage
 * import { useComponentPerformance } from './performance';
 *
 * function MyComponent() {
 *   const { trackRenderStart, trackRenderEnd } = useComponentPerformance('MyComponent');
 *
 *   useEffect(() => {
 *     trackRenderStart();
 *     return () => trackRenderEnd();
 *   });
 *
 *   return <div>Component content</div>;
 * }
 *
 * // Search tracking
 * import { SearchPerformanceMonitor } from './performance';
 * const searchMonitor = new SearchPerformanceMonitor();
 *
 * async function performSearch(query) {
 *   return searchMonitor.trackSearch(query, async () => {
 *     return await searchService.search(query);
 *   });
 * }
 *
 * // Dashboard usage
 * import { PerformanceDashboard } from './performance';
 *
 * function App() {
 *   return (
 *     <div>
 *       <PerformanceDashboard />
 *     </div>
 *   );
 * }
 */
