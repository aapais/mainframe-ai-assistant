/**
 * Performance Monitor - Tracks startup time, memory usage, and provides
 * performance alerts and optimization suggestions
 */

import { EventEmitter } from 'events';
import { app, powerMonitor } from 'electron';
import * as os from 'os';
import * as process from 'process';

export interface PerformanceMetrics {
  startup: StartupMetrics;
  memory: MemoryMetrics;
  cpu: CpuMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
}

export interface StartupMetrics {
  totalTime: number;
  phaseTimings: Record<string, number>;
  criticalPathTime: number;
  preloadTime: number;
  serviceInitTime: number;
  firstPaintTime?: number;
  timeToInteractive?: number;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  peakUsage: number;
  gcCount: number;
  gcTime: number;
}

export interface CpuMetrics {
  usage: number;
  loadAverage: number[];
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
}

export interface DiskMetrics {
  readOps: number;
  writeOps: number;
  readBytes: number;
  writeBytes: number;
  spaceUsed: number;
  spaceAvailable: number;
}

export interface NetworkMetrics {
  requests: number;
  responseTime: number;
  errors: number;
  bytesReceived: number;
  bytesSent: number;
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  category: 'memory' | 'cpu' | 'disk' | 'network' | 'startup';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  suggestion?: string;
}

export interface PerformanceThresholds {
  memory: {
    heapUsage: number; // MB
    rssUsage: number; // MB
  };
  cpu: {
    usage: number; // %
    eventLoopDelay: number; // ms
  };
  startup: {
    totalTime: number; // ms
    phaseTime: number; // ms
  };
  disk: {
    usage: number; // %
  };
}

export class PerformanceMonitor extends EventEmitter {
  private startupStartTime = 0;
  private startupEndTime = 0;
  private phaseTimings = new Map<string, number>();
  private isMonitoring = false;
  private monitoringInterval?: ReturnType<typeof setTimeout>;
  private metricsHistory: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private gcObserver?: any;

  private readonly thresholds: PerformanceThresholds = {
    memory: {
      heapUsage: 200, // 200MB
      rssUsage: 500, // 500MB
    },
    cpu: {
      usage: 80, // 80%
      eventLoopDelay: 50, // 50ms
    },
    startup: {
      totalTime: 5000, // 5 seconds
      phaseTime: 2000, // 2 seconds per phase
    },
    disk: {
      usage: 90, // 90%
    },
  };

  constructor() {
    super();
    this.setupGCObserver();
  }

  /**
   * Start tracking startup performance
   */
  startStartupTracking(): void {
    this.startupStartTime = Date.now();
    console.log('📊 Performance monitoring started');

    // Record initial memory state
    this.recordMemorySnapshot('startup-begin');

    this.emit('startup-tracking:started');
  }

  /**
   * Record timing for a startup phase
   */
  recordPhaseTime(phaseName: string, duration: number): void {
    this.phaseTimings.set(phaseName, duration);

    // Check if phase exceeded threshold
    if (duration > this.thresholds.startup.phaseTime) {
      this.addAlert({
        type: 'warning',
        category: 'startup',
        message: `Startup phase '${phaseName}' took longer than expected`,
        value: duration,
        threshold: this.thresholds.startup.phaseTime,
        timestamp: new Date(),
        suggestion: `Consider optimizing ${phaseName} phase or moving non-critical operations to background`,
      });
    }

    this.emit('phase-time:recorded', phaseName, duration);
  }

  /**
   * Complete startup tracking
   */
  completeStartupTracking(): StartupMetrics {
    this.startupEndTime = Date.now();
    const totalTime = this.startupEndTime - this.startupStartTime;

    const startupMetrics: StartupMetrics = {
      totalTime,
      phaseTimings: Object.fromEntries(this.phaseTimings),
      criticalPathTime: this.calculateCriticalPathTime(),
      preloadTime: this.phaseTimings.get('preloading') || 0,
      serviceInitTime:
        (this.phaseTimings.get('services-critical') || 0) +
        (this.phaseTimings.get('services-optional') || 0),
    };

    // Check total startup time
    if (totalTime > this.thresholds.startup.totalTime) {
      this.addAlert({
        type: 'warning',
        category: 'startup',
        message: 'Application startup time exceeded target',
        value: totalTime,
        threshold: this.thresholds.startup.totalTime,
        timestamp: new Date(),
        suggestion: 'Consider enabling more aggressive caching or reducing startup operations',
      });
    }

    console.log(`📊 Startup tracking completed: ${totalTime}ms total`);
    this.emit('startup-tracking:completed', startupMetrics);

    return startupMetrics;
  }

  /**
   * Start continuous performance monitoring
   */
  startMonitoring(interval = 30000): void {
    if (this.isMonitoring) {
      console.warn('Performance monitoring already active');
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    // Monitor system events
    this.setupSystemEventListeners();

    console.log(`📊 Continuous performance monitoring started (${interval}ms interval)`);
    this.emit('monitoring:started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.removeSystemEventListeners();

    console.log('📊 Performance monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    const metrics: PerformanceMetrics = {
      startup: this.getStartupMetrics(),
      memory: this.getMemoryMetrics(),
      cpu: this.getCpuMetrics(),
      disk: this.getDiskMetrics(),
      network: this.getNetworkMetrics(),
    };

    // Store metrics history (keep last 100 entries)
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    // Check for performance issues
    this.checkMemoryThresholds(metrics.memory);
    this.checkCpuThresholds(metrics.cpu);

    this.emit('metrics:collected', metrics);
  }

  /**
   * Get current startup metrics
   */
  getStartupMetrics(): StartupMetrics {
    return {
      totalTime: this.startupEndTime - this.startupStartTime,
      phaseTimings: Object.fromEntries(this.phaseTimings),
      criticalPathTime: this.calculateCriticalPathTime(),
      preloadTime: this.phaseTimings.get('preloading') || 0,
      serviceInitTime:
        (this.phaseTimings.get('services-critical') || 0) +
        (this.phaseTimings.get('services-optional') || 0),
    };
  }

  /**
   * Get current memory metrics
   */
  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();

    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024), // MB
      peakUsage: this.getPeakMemoryUsage(),
      gcCount: this.getGCCount(),
      gcTime: this.getGCTime(),
    };
  }

  /**
   * Get current CPU metrics
   */
  private getCpuMetrics(): CpuMetrics {
    const cpuUsage = process.cpuUsage();

    return {
      usage: this.calculateCpuUsage(cpuUsage),
      loadAverage: os.loadavg(),
      eventLoopDelay: this.measureEventLoopDelay(),
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length,
    };
  }

  /**
   * Get disk metrics
   */
  private getDiskMetrics(): DiskMetrics {
    // Simplified disk metrics - in production, you might want to use native modules
    return {
      readOps: 0,
      writeOps: 0,
      readBytes: 0,
      writeBytes: 0,
      spaceUsed: 0,
      spaceAvailable: this.getAvailableDiskSpace(),
    };
  }

  /**
   * Get network metrics
   */
  private getNetworkMetrics(): NetworkMetrics {
    // Simplified network metrics - could be enhanced with actual network monitoring
    return {
      requests: 0,
      responseTime: 0,
      errors: 0,
      bytesReceived: 0,
      bytesSent: 0,
    };
  }

  /**
   * Calculate critical path time (longest dependency chain)
   */
  private calculateCriticalPathTime(): number {
    const phases = Array.from(this.phaseTimings.entries());

    // For simplicity, assume critical path is the sum of sequential phases
    const criticalPhases = ['splash', 'services-critical', 'ui-ready', 'finalization'];

    return criticalPhases.reduce((total, phase) => {
      return total + (this.phaseTimings.get(phase) || 0);
    }, 0);
  }

  /**
   * Check memory usage against thresholds
   */
  private checkMemoryThresholds(memory: MemoryMetrics): void {
    if (memory.heapUsed > this.thresholds.memory.heapUsage) {
      this.addAlert({
        type: memory.heapUsed > this.thresholds.memory.heapUsage * 1.5 ? 'critical' : 'warning',
        category: 'memory',
        message: 'High heap memory usage detected',
        value: memory.heapUsed,
        threshold: this.thresholds.memory.heapUsage,
        timestamp: new Date(),
        suggestion: 'Consider running garbage collection or reducing memory-intensive operations',
      });
    }

    if (memory.rss > this.thresholds.memory.rssUsage) {
      this.addAlert({
        type: memory.rss > this.thresholds.memory.rssUsage * 1.5 ? 'critical' : 'warning',
        category: 'memory',
        message: 'High RSS memory usage detected',
        value: memory.rss,
        threshold: this.thresholds.memory.rssUsage,
        timestamp: new Date(),
        suggestion: 'Monitor for memory leaks and consider restarting if usage continues to grow',
      });
    }
  }

  /**
   * Check CPU usage against thresholds
   */
  private checkCpuThresholds(cpu: CpuMetrics): void {
    if (cpu.usage > this.thresholds.cpu.usage) {
      this.addAlert({
        type: cpu.usage > 95 ? 'critical' : 'warning',
        category: 'cpu',
        message: 'High CPU usage detected',
        value: cpu.usage,
        threshold: this.thresholds.cpu.usage,
        timestamp: new Date(),
        suggestion: 'Check for CPU-intensive operations or infinite loops',
      });
    }

    if (cpu.eventLoopDelay > this.thresholds.cpu.eventLoopDelay) {
      this.addAlert({
        type: 'warning',
        category: 'cpu',
        message: 'High event loop delay detected',
        value: cpu.eventLoopDelay,
        threshold: this.thresholds.cpu.eventLoopDelay,
        timestamp: new Date(),
        suggestion:
          'Consider moving heavy operations to worker threads or reducing synchronous operations',
      });
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    console.warn(`⚠️ Performance Alert [${alert.type}]: ${alert.message}`);
    this.emit('alert', alert);
  }

  /**
   * Setup garbage collection observer
   */
  private setupGCObserver(): void {
    try {
      // Use V8's GC profiler if available
      if (typeof global.gc === 'function') {
        const PerformanceObserver = require('perf_hooks').PerformanceObserver;

        this.gcObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'gc') {
              this.emit('gc:performed', {
                duration: entry.duration,
                type: entry.detail?.kind || 'unknown',
              });
            }
          }
        });

        this.gcObserver.observe({ entryTypes: ['gc'] });
      }
    } catch (error) {
      // GC observer not available, continue without it
      console.warn('GC observer not available:', error.message);
    }
  }

  /**
   * Setup system event listeners
   */
  private setupSystemEventListeners(): void {
    if (powerMonitor.isOnBatteryPower) {
      powerMonitor.on('on-battery', () => {
        this.emit('power:battery');
        console.log(
          '📱 System switched to battery power - reducing performance monitoring frequency'
        );
      });

      powerMonitor.on('on-ac', () => {
        this.emit('power:ac');
        console.log('🔌 System switched to AC power - resuming normal monitoring');
      });
    }
  }

  /**
   * Remove system event listeners
   */
  private removeSystemEventListeners(): void {
    powerMonitor.removeAllListeners('on-battery');
    powerMonitor.removeAllListeners('on-ac');
  }

  /**
   * Record memory snapshot with label
   */
  private recordMemorySnapshot(label: string): void {
    const memUsage = process.memoryUsage();
    console.log(`📊 Memory snapshot [${label}]:`, {
      heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    });
  }

  /**
   * Utility methods for metrics calculation
   */
  private getPeakMemoryUsage(): number {
    return Math.max(...this.metricsHistory.map(m => m.memory.rss), 0);
  }

  private getGCCount(): number {
    // Simplified GC count - would need native module for accurate data
    return 0;
  }

  private getGCTime(): number {
    // Simplified GC time - would need native module for accurate data
    return 0;
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU usage calculation
    const totalTime = cpuUsage.user + cpuUsage.system;
    return Math.min(100, Math.round((totalTime / 1000000) * 100)); // Convert to percentage
  }

  private measureEventLoopDelay(): number {
    // Simplified event loop delay measurement
    const start = Date.now();
    setImmediate(() => {
      const delay = Date.now() - start;
      this.emit('eventloop:delay', delay);
    });
    return 0; // Would return actual measurement in production
  }

  private getAvailableDiskSpace(): number {
    try {
      const userDataPath = app.getPath('userData');
      const stats = require('fs').statSync(userDataPath);
      // Simplified disk space check
      return stats.size || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get performance recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const recentAlerts = this.alerts.filter(
      a => Date.now() - a.timestamp.getTime() < 300000 // Last 5 minutes
    );

    if (recentAlerts.some(a => a.category === 'memory')) {
      recommendations.push('Consider implementing memory pooling for frequently allocated objects');
      recommendations.push('Review and optimize large data structures');
      recommendations.push('Enable garbage collection monitoring');
    }

    if (recentAlerts.some(a => a.category === 'cpu')) {
      recommendations.push('Move CPU-intensive operations to worker threads');
      recommendations.push('Implement request throttling for API calls');
      recommendations.push('Use lazy loading for non-critical components');
    }

    const startupMetrics = this.getStartupMetrics();
    if (startupMetrics.totalTime > 3000) {
      recommendations.push('Enable more aggressive preloading of critical resources');
      recommendations.push('Consider parallel initialization of independent services');
      recommendations.push('Optimize database query performance');
    }

    return recommendations;
  }

  /**
   * Get current alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(): any {
    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    const recentAlerts = this.alerts.filter(
      a => Date.now() - a.timestamp.getTime() < 600000 // Last 10 minutes
    );

    return {
      startup: this.getStartupMetrics(),
      current: latest,
      alerts: recentAlerts.length,
      recommendations: this.getOptimizationRecommendations(),
      healthScore: this.calculateHealthScore(),
    };
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(): number {
    let score = 100;
    const recentAlerts = this.alerts.filter(
      a => Date.now() - a.timestamp.getTime() < 300000 // Last 5 minutes
    );

    // Deduct points for alerts
    score -= recentAlerts.filter(a => a.type === 'warning').length * 10;
    score -= recentAlerts.filter(a => a.type === 'critical').length * 25;

    // Deduct points for slow startup
    const startupMetrics = this.getStartupMetrics();
    if (startupMetrics.totalTime > 3000) {
      score -= 15;
    }

    return Math.max(0, score);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stop();

    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }

    this.removeAllListeners();
    this.metricsHistory = [];
    this.alerts = [];
  }
}
