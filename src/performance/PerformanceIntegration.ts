/**
 * Performance Integration Manager
 * Coordinates all performance monitoring components
 */

import { EventEmitter } from 'events';
import ElectronPerformanceMetrics from './ElectronPerformanceMetrics';
import RendererPerformanceTracker from './RendererPerformanceTracker';
import SearchPerformanceMonitor from './SearchPerformanceMonitor';
import IPCPerformanceTracker from './IPCPerformanceTracker';
import MemoryLeakDetector from './MemoryLeakDetector';
import WindowOperationTracker from './WindowOperationTracker';

export interface IntegratedPerformanceData {
  timestamp: number;
  electron: ReturnType<ElectronPerformanceMetrics['getLatestMetrics']>;
  renderer: ReturnType<RendererPerformanceTracker['getPerformanceSummary']>;
  search: ReturnType<SearchPerformanceMonitor['getSummary']>;
  ipc: ReturnType<IPCPerformanceTracker['getPerformanceSummary']>;
  memory: ReturnType<MemoryLeakDetector['getCurrentAnalysis']>;
  window: ReturnType<WindowOperationTracker['getPerformanceSummary']>;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  alertCount: number;
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

export class PerformanceIntegration extends EventEmitter {
  private electronMetrics: ElectronPerformanceMetrics;
  private rendererTracker: RendererPerformanceTracker;
  private searchMonitor: SearchPerformanceMonitor;
  private ipcTracker: IPCPerformanceTracker;
  private memoryDetector: MemoryLeakDetector;
  private windowTracker: WindowOperationTracker;

  private isMainProcess: boolean;
  private isMonitoring = false;
  private alerts: PerformanceAlert[] = [];
  private performanceHistory: IntegratedPerformanceData[] = [];
  private integrationInterval: ReturnType<typeof setTimeout> | null = null;

  private maxHistorySize = 1000;
  private maxAlertSize = 100;

  constructor() {
    super();

    this.isMainProcess = process.type === 'browser';

    // Initialize performance monitors
    this.electronMetrics = new ElectronPerformanceMetrics();
    this.rendererTracker = new RendererPerformanceTracker();
    this.searchMonitor = new SearchPerformanceMonitor();
    this.ipcTracker = new IPCPerformanceTracker();
    this.memoryDetector = new MemoryLeakDetector();
    this.windowTracker = new WindowOperationTracker();

    this.setupEventListeners();
  }

  /**
   * Start integrated performance monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Performance monitoring already started');
      return;
    }

    this.isMonitoring = true;

    // Start individual monitors
    if (this.isMainProcess) {
      this.electronMetrics.startMonitoring();
      this.memoryDetector.startMonitoring();
      // Window tracker starts automatically
    }

    this.rendererTracker.startTracking();
    // Search and IPC trackers are passive - they track on usage

    // Start integration data collection
    this.integrationInterval = setInterval(() => {
      this.collectIntegratedData();
    }, 5000); // Every 5 seconds

    this.emit('monitoring-started');
    console.log('Integrated performance monitoring started');
  }

  /**
   * Stop integrated performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    // Stop individual monitors
    if (this.isMainProcess) {
      this.electronMetrics.stopMonitoring();
      this.memoryDetector.stopMonitoring();
    }

    this.rendererTracker.stopTracking();

    // Stop integration data collection
    if (this.integrationInterval) {
      clearInterval(this.integrationInterval);
      this.integrationInterval = null;
    }

    this.emit('monitoring-stopped');
    console.log('Integrated performance monitoring stopped');
  }

  /**
   * Setup event listeners for all monitors
   */
  private setupEventListeners(): void {
    // Electron metrics events
    this.electronMetrics.on('threshold-violation', data => {
      this.addAlert('threshold-violation', 'electron', data.message, 'medium', data);
    });

    // Renderer tracker events
    this.rendererTracker.on('performance-violation', data => {
      this.addAlert('threshold-violation', 'renderer', data.message, 'medium', data);
    });

    // Search monitor events
    this.searchMonitor.on('performance-violation', data => {
      this.addAlert('threshold-violation', 'search', data.message, 'medium', data);
    });

    // IPC tracker events
    this.ipcTracker.on('performance-violation', data => {
      this.addAlert('threshold-violation', 'ipc', data.message, 'medium', data);
    });

    // Memory detector events
    this.memoryDetector.on('leak-detected', leak => {
      this.addAlert('memory-leak', 'memory', leak.description, leak.severity as any, leak);
    });

    this.memoryDetector.on('threshold-violation', data => {
      this.addAlert('threshold-violation', 'memory', data.message, 'high', data);
    });

    // Window tracker events
    this.windowTracker.on('performance-violation', data => {
      this.addAlert('threshold-violation', 'window', data.message, 'medium', data);
    });
  }

  /**
   * Add a performance alert
   */
  private addAlert(
    type: PerformanceAlert['type'],
    component: PerformanceAlert['component'],
    message: string,
    severity: PerformanceAlert['severity'],
    data?: any
  ): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      component,
      severity,
      message,
      timestamp: Date.now(),
      data,
    };

    this.alerts.push(alert);

    // Keep alerts within limit
    if (this.alerts.length > this.maxAlertSize) {
      this.alerts = this.alerts.slice(-Math.floor(this.maxAlertSize * 0.8));
    }

    this.emit('alert-added', alert);

    // Emit critical alerts immediately
    if (severity === 'critical') {
      this.emit('critical-alert', alert);
    }
  }

  /**
   * Collect integrated performance data
   */
  private collectIntegratedData(): void {
    const integratedData: IntegratedPerformanceData = {
      timestamp: Date.now(),
      electron: this.electronMetrics.getLatestMetrics(),
      renderer: this.rendererTracker.getPerformanceSummary(),
      search: this.searchMonitor.getSummary(),
      ipc: this.ipcTracker.getPerformanceSummary(),
      memory: this.memoryDetector.getCurrentAnalysis(),
      window: this.windowTracker.getPerformanceSummary(),
      overallHealth: this.calculateOverallHealth(),
      alertCount: this.alerts.filter(alert => Date.now() - alert.timestamp < 300000).length, // Last 5 minutes
    };

    this.performanceHistory.push(integratedData);

    // Keep history within limits
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(
        -Math.floor(this.maxHistorySize * 0.8)
      );
    }

    this.emit('data-collected', integratedData);
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    const recentAlerts = this.alerts.filter(alert => Date.now() - alert.timestamp < 300000); // Last 5 minutes
    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical').length;
    const highAlerts = recentAlerts.filter(alert => alert.severity === 'high').length;
    const mediumAlerts = recentAlerts.filter(alert => alert.severity === 'medium').length;

    // Check current metrics for target compliance
    const electronMetrics = this.electronMetrics.getLatestMetrics();
    let targetsMet = 0;
    let totalTargets = 0;

    if (electronMetrics) {
      totalTargets = 5;
      if (electronMetrics.renderTargetMet) targetsMet++;
      if (electronMetrics.searchTargetMet) targetsMet++;
      if (electronMetrics.memoryTargetMet) targetsMet++;
      if (electronMetrics.ipcTargetMet) targetsMet++;
      if (electronMetrics.windowTargetMet) targetsMet++;
    }

    const targetComplianceRate = totalTargets > 0 ? targetsMet / totalTargets : 1;

    // Determine health based on alerts and target compliance
    if (criticalAlerts > 0 || targetComplianceRate < 0.2) {
      return 'critical';
    } else if (highAlerts > 2 || targetComplianceRate < 0.4) {
      return 'poor';
    } else if (highAlerts > 0 || mediumAlerts > 3 || targetComplianceRate < 0.6) {
      return 'fair';
    } else if (mediumAlerts > 0 || targetComplianceRate < 0.8) {
      return 'good';
    } else {
      return 'excellent';
    }
  }

  /**
   * Get current integrated performance data
   */
  public getCurrentData(): IntegratedPerformanceData | null {
    return this.performanceHistory.length > 0
      ? this.performanceHistory[this.performanceHistory.length - 1]
      : null;
  }

  /**
   * Get performance history
   */
  public getPerformanceHistory(count?: number): IntegratedPerformanceData[] {
    if (!count) return [...this.performanceHistory];
    return this.performanceHistory.slice(-count);
  }

  /**
   * Get recent alerts
   */
  public getAlerts(count?: number): PerformanceAlert[] {
    const alerts = [...this.alerts].reverse(); // Most recent first
    if (!count) return alerts;
    return alerts.slice(0, count);
  }

  /**
   * Get alerts by severity
   */
  public getAlertsBySeverity(severity: PerformanceAlert['severity']): PerformanceAlert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Get alerts by component
   */
  public getAlertsByComponent(component: PerformanceAlert['component']): PerformanceAlert[] {
    return this.alerts.filter(alert => alert.component === component);
  }

  /**
   * Clear old alerts
   */
  public clearOldAlerts(olderThanMs = 3600000): number {
    // 1 hour default
    const cutoff = Date.now() - olderThanMs;
    const initialCount = this.alerts.length;

    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff);

    const removedCount = initialCount - this.alerts.length;
    if (removedCount > 0) {
      this.emit('alerts-cleared', removedCount);
    }

    return removedCount;
  }

  /**
   * Get comprehensive performance report
   */
  public getPerformanceReport(): {
    summary: {
      overallHealth: string;
      monitoringDuration: number;
      totalAlerts: number;
      criticalAlerts: number;
      averageTargetCompliance: number;
    };
    components: {
      electron: ReturnType<ElectronPerformanceMetrics['getPerformanceSummary']>;
      renderer: ReturnType<RendererPerformanceTracker['getPerformanceSummary']>;
      search: ReturnType<SearchPerformanceMonitor['getSummary']>;
      ipc: ReturnType<IPCPerformanceTracker['getPerformanceSummary']>;
      memory: ReturnType<MemoryLeakDetector['getMemorySummary']>;
      window: ReturnType<WindowOperationTracker['getPerformanceSummary']>;
    };
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const currentData = this.getCurrentData();
    const monitoringDuration =
      this.performanceHistory.length > 0 ? Date.now() - this.performanceHistory[0].timestamp : 0;

    const criticalAlerts = this.alerts.filter(alert => alert.severity === 'critical').length;

    // Calculate average target compliance
    const recentData = this.performanceHistory.slice(-10);
    const targetCompliance = recentData.map(data => {
      if (!data.electron) return 0;
      let met = 0;
      if (data.electron.renderTargetMet) met++;
      if (data.electron.searchTargetMet) met++;
      if (data.electron.memoryTargetMet) met++;
      if (data.electron.ipcTargetMet) met++;
      if (data.electron.windowTargetMet) met++;
      return met / 5;
    });

    const averageTargetCompliance =
      targetCompliance.length > 0
        ? targetCompliance.reduce((sum, val) => sum + val, 0) / targetCompliance.length
        : 0;

    return {
      summary: {
        overallHealth: currentData?.overallHealth || 'unknown',
        monitoringDuration,
        totalAlerts: this.alerts.length,
        criticalAlerts,
        averageTargetCompliance,
      },
      components: {
        electron: this.electronMetrics.getPerformanceSummary(),
        renderer: this.rendererTracker.getPerformanceSummary(),
        search: this.searchMonitor.getSummary(),
        ipc: this.ipcTracker.getPerformanceSummary(),
        memory: this.memoryDetector.getMemorySummary(),
        window: this.windowTracker.getPerformanceSummary(),
      },
      alerts: this.getAlerts(20), // Last 20 alerts
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const currentData = this.getCurrentData();

    if (!currentData) {
      recommendations.push('Start performance monitoring to get recommendations');
      return recommendations;
    }

    // Render performance recommendations
    if (currentData.electron && !currentData.electron.renderTargetMet) {
      recommendations.push('Optimize component rendering - consider React.memo and useMemo');
      recommendations.push('Review component re-render patterns and eliminate unnecessary updates');
    }

    // Search performance recommendations
    if (currentData.search.averageResponseTime > 500) {
      recommendations.push('Implement search result caching to improve response times');
      recommendations.push('Consider search result pagination for large datasets');
      recommendations.push('Optimize search algorithms and database queries');
    }

    // Memory recommendations
    if (currentData.memory && currentData.memory.growthRate > 5) {
      recommendations.push('Investigate memory leaks - check for unreleased event listeners');
      recommendations.push('Implement periodic cache cleanup');
      recommendations.push('Review object lifecycle management');
    }

    // IPC recommendations
    if (currentData.ipc.averageLatency > 3) {
      recommendations.push('Optimize IPC message size and frequency');
      recommendations.push('Consider batching IPC operations');
      recommendations.push('Review data serialization overhead');
    }

    // Window operation recommendations
    if (currentData.window.averageOperationTime > 50) {
      recommendations.push('Optimize window operations and animations');
      recommendations.push('Review CSS transitions and JavaScript animations');
      recommendations.push('Consider hardware acceleration for graphics operations');
    }

    // Critical alert recommendations
    const criticalAlerts = this.getAlertsBySeverity('critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical performance issues immediately');
      recommendations.push('Review system resources and consider scaling');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable ranges');
      recommendations.push('Continue monitoring for early detection of issues');
    }

    return recommendations;
  }

  /**
   * Export all performance data
   */
  public exportAllData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      // Simplified CSV export with key metrics
      const headers = [
        'timestamp',
        'overallHealth',
        'renderTime',
        'searchTime',
        'memoryUsage',
        'ipcLatency',
        'windowTime',
        'alertCount',
      ];

      const rows = this.performanceHistory.map(data => [
        data.timestamp,
        data.overallHealth,
        data.electron?.renderTime || 0,
        data.electron?.searchResponseTime || 0,
        data.electron?.memoryUsage?.heapUsed || 0,
        data.electron?.ipcLatency || 0,
        data.electron?.windowOperationTime || 0,
        data.alertCount,
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify(
      {
        performanceHistory: this.performanceHistory,
        alerts: this.alerts,
        report: this.getPerformanceReport(),
      },
      null,
      2
    );
  }

  /**
   * Reset all performance data
   */
  public resetAllData(): void {
    this.performanceHistory = [];
    this.alerts = [];

    // Reset individual monitors
    this.rendererTracker.resetMetrics();
    this.searchMonitor.reset();
    this.ipcTracker.reset();
    this.memoryDetector.reset();
    this.windowTracker.reset();

    this.emit('all-data-reset');
  }

  /**
   * Get individual monitor instances for advanced usage
   */
  public getMonitors() {
    return {
      electron: this.electronMetrics,
      renderer: this.rendererTracker,
      search: this.searchMonitor,
      ipc: this.ipcTracker,
      memory: this.memoryDetector,
      window: this.windowTracker,
    };
  }
}

export default PerformanceIntegration;
