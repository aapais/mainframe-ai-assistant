/**
 * Reliability Monitoring Tools
 * Provides monitoring, alerting, and health check utilities for system reliability
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Health status enumeration
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  CRITICAL = 'critical'
}

// Health check result interface
export interface HealthCheckResult {
  component: string;
  status: HealthStatus;
  timestamp: Date;
  responseTime: number;
  message?: string;
  details?: any;
  metadata?: Record<string, any>;
}

// System metrics interface
export interface SystemMetrics {
  timestamp: Date;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  performance: {
    eventLoop: number;
    activeHandles: number;
    activeRequests: number;
  };
  database: {
    connections: number;
    queryTime: number;
    errorRate: number;
  };
  application: {
    uptime: number;
    requestsPerSecond: number;
    errorCount: number;
    responseTime: number;
  };
}

// Alert interface
export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  details: any;
  resolved?: boolean;
  resolvedAt?: Date;
}

// Reliability threshold configuration
export interface ReliabilityThresholds {
  responseTime: {
    warning: number;
    critical: number;
  };
  memoryUsage: {
    warning: number; // percentage
    critical: number;
  };
  errorRate: {
    warning: number; // percentage
    critical: number;
  };
  availability: {
    warning: number; // percentage
    critical: number;
  };
  diskSpace: {
    warning: number; // percentage free
    critical: number;
  };
}

// Default reliability thresholds
export const DEFAULT_THRESHOLDS: ReliabilityThresholds = {
  responseTime: {
    warning: 1000, // 1 second
    critical: 5000  // 5 seconds
  },
  memoryUsage: {
    warning: 80,    // 80%
    critical: 95    // 95%
  },
  errorRate: {
    warning: 1,     // 1%
    critical: 5     // 5%
  },
  availability: {
    warning: 99.9,  // 99.9%
    critical: 99.0  // 99.0%
  },
  diskSpace: {
    warning: 20,    // 20% free
    critical: 10    // 10% free
  }
};

/**
 * System Health Monitor
 * Monitors system health and generates alerts
 */
export class SystemHealthMonitor extends EventEmitter {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private lastMetrics: SystemMetrics | null = null;
  private alertHistory: Alert[] = [];
  private startTime = Date.now();
  private thresholds: ReliabilityThresholds;

  constructor(thresholds: ReliabilityThresholds = DEFAULT_THRESHOLDS) {
    super();
    this.thresholds = thresholds;
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    this.healthChecks.set(name, checkFunction);
  }

  /**
   * Start monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();

    this.interval = setInterval(async () => {
      try {
        await this.performHealthChecks();
        await this.collectMetrics();
        await this.checkThresholds();
      } catch (error) {
        this.emit('monitor-error', error);
      }
    }, intervalMs);

    this.emit('monitor-started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.emit('monitor-stopped');
  }

  /**
   * Perform all registered health checks
   */
  private async performHealthChecks(): Promise<void> {
    const results: HealthCheckResult[] = [];

    for (const [name, checkFn] of this.healthChecks) {
      try {
        const result = await checkFn();
        results.push(result);

        // Emit events for status changes
        if (result.status === HealthStatus.UNHEALTHY || result.status === HealthStatus.CRITICAL) {
          this.createAlert('error', name, `Health check failed: ${result.message}`, result);
        }
      } catch (error) {
        const errorResult: HealthCheckResult = {
          component: name,
          status: HealthStatus.CRITICAL,
          timestamp: new Date(),
          responseTime: 0,
          message: `Health check exception: ${(error as Error).message}`,
          details: error
        };
        results.push(errorResult);
        this.createAlert('critical', name, `Health check exception: ${(error as Error).message}`, error);
      }
    }

    this.emit('health-check-complete', results);
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      performance: {
        eventLoop: 0, // Would need additional monitoring
        activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
        activeRequests: (process as any)._getActiveRequests?.()?.length || 0
      },
      database: {
        connections: 0, // Would be provided by database layer
        queryTime: 0,   // Would be provided by database layer
        errorRate: 0    // Would be calculated from error logs
      },
      application: {
        uptime: uptime,
        requestsPerSecond: 0, // Would be calculated from request logs
        errorCount: this.alertHistory.filter(a => a.severity === 'error' || a.severity === 'critical').length,
        responseTime: 0 // Would be calculated from response time logs
      }
    };

    this.lastMetrics = metrics;
    this.emit('metrics-collected', metrics);
  }

  /**
   * Check if metrics exceed thresholds
   */
  private async checkThresholds(): Promise<void> {
    if (!this.lastMetrics) return;

    const metrics = this.lastMetrics;

    // Memory usage check
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > this.thresholds.memoryUsage.critical) {
      this.createAlert('critical', 'memory', `Memory usage critical: ${memoryUsagePercent.toFixed(2)}%`, metrics.memory);
    } else if (memoryUsagePercent > this.thresholds.memoryUsage.warning) {
      this.createAlert('warning', 'memory', `Memory usage high: ${memoryUsagePercent.toFixed(2)}%`, metrics.memory);
    }

    // Error rate check (last hour)
    const recentAlerts = this.alertHistory.filter(a => 
      Date.now() - a.timestamp.getTime() < 3600000 && 
      (a.severity === 'error' || a.severity === 'critical')
    );
    const errorRate = (recentAlerts.length / 3600) * 100; // errors per second as percentage

    if (errorRate > this.thresholds.errorRate.critical) {
      this.createAlert('critical', 'errors', `High error rate: ${errorRate.toFixed(2)}%`, { recentAlerts: recentAlerts.length });
    } else if (errorRate > this.thresholds.errorRate.warning) {
      this.createAlert('warning', 'errors', `Elevated error rate: ${errorRate.toFixed(2)}%`, { recentAlerts: recentAlerts.length });
    }
  }

  /**
   * Create an alert
   */
  private createAlert(severity: Alert['severity'], component: string, message: string, details: any): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      component,
      message,
      details
    };

    this.alertHistory.push(alert);
    this.emit('alert', alert);

    // Keep alert history manageable
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-500);
    }
  }

  /**
   * Get current system status
   */
  getSystemStatus(): { status: HealthStatus; uptime: number; alerts: number; metrics: SystemMetrics | null } {
    const criticalAlerts = this.alertHistory.filter(a => 
      a.severity === 'critical' && !a.resolved &&
      Date.now() - a.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const warningAlerts = this.alertHistory.filter(a => 
      a.severity === 'warning' && !a.resolved &&
      Date.now() - a.timestamp.getTime() < 300000 // Last 5 minutes
    );

    let status = HealthStatus.HEALTHY;
    if (criticalAlerts.length > 0) {
      status = HealthStatus.CRITICAL;
    } else if (warningAlerts.length > 5) {
      status = HealthStatus.UNHEALTHY;
    } else if (warningAlerts.length > 0) {
      status = HealthStatus.DEGRADED;
    }

    return {
      status,
      uptime: Date.now() - this.startTime,
      alerts: this.alertHistory.filter(a => !a.resolved).length,
      metrics: this.lastMetrics
    };
  }

  /**
   * Get alert history
   */
  getAlerts(resolved: boolean = false): Alert[] {
    return this.alertHistory.filter(a => a.resolved === resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert-resolved', alert);
      return true;
    }
    return false;
  }
}

/**
 * Uptime Monitor
 * Tracks system uptime and availability
 */
export class UptimeMonitor {
  private startTime = Date.now();
  private downtimeIntervals: Array<{ start: Date; end?: Date }> = [];
  private isDown = false;

  /**
   * Record system going down
   */
  recordDowntime(): void {
    if (!this.isDown) {
      this.isDown = true;
      this.downtimeIntervals.push({ start: new Date() });
    }
  }

  /**
   * Record system coming back up
   */
  recordUptime(): void {
    if (this.isDown) {
      this.isDown = false;
      const lastDowntime = this.downtimeIntervals[this.downtimeIntervals.length - 1];
      if (lastDowntime && !lastDowntime.end) {
        lastDowntime.end = new Date();
      }
    }
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats(): {
    totalUptime: number;
    totalDowntime: number;
    availability: number;
    downtimeCount: number;
    currentUptime: number;
  } {
    const now = Date.now();
    const totalRuntime = now - this.startTime;

    let totalDowntime = 0;
    this.downtimeIntervals.forEach(interval => {
      const end = interval.end ? interval.end.getTime() : now;
      totalDowntime += end - interval.start.getTime();
    });

    const totalUptime = totalRuntime - totalDowntime;
    const availability = (totalUptime / totalRuntime) * 100;

    // Current uptime (time since last recovery or start)
    const lastDowntime = this.downtimeIntervals[this.downtimeIntervals.length - 1];
    const currentUptimeStart = (lastDowntime && lastDowntime.end) 
      ? lastDowntime.end.getTime() 
      : this.startTime;
    const currentUptime = now - currentUptimeStart;

    return {
      totalUptime,
      totalDowntime,
      availability,
      downtimeCount: this.downtimeIntervals.length,
      currentUptime
    };
  }
}

/**
 * Performance Monitor
 * Tracks performance metrics and identifies degradation
 */
export class PerformanceMonitor {
  private responseTimeHistory: Array<{ timestamp: Date; responseTime: number; operation: string }> = [];
  private operationCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  /**
   * Record operation performance
   */
  recordOperation(operation: string, responseTime: number, success: boolean = true): void {
    this.responseTimeHistory.push({
      timestamp: new Date(),
      responseTime,
      operation
    });

    // Update counters
    this.operationCounts.set(operation, (this.operationCounts.get(operation) || 0) + 1);
    
    if (!success) {
      this.errorCounts.set(operation, (this.errorCounts.get(operation) || 0) + 1);
    }

    // Keep history manageable (last 1000 operations)
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-500);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(operation?: string): {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    totalOperations: number;
    errorRate: number;
    throughput: number;
  } {
    const filteredHistory = operation 
      ? this.responseTimeHistory.filter(r => r.operation === operation)
      : this.responseTimeHistory;

    if (filteredHistory.length === 0) {
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalOperations: 0,
        errorRate: 0,
        throughput: 0
      };
    }

    const responseTimes = filteredHistory.map(r => r.responseTime).sort((a, b) => a - b);
    const totalOperations = operation 
      ? this.operationCounts.get(operation) || 0
      : Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0);
    const totalErrors = operation
      ? this.errorCounts.get(operation) || 0
      : Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);

    // Calculate percentiles
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Calculate throughput (operations per second in last minute)
    const oneMinuteAgo = Date.now() - 60000;
    const recentOperations = filteredHistory.filter(r => r.timestamp.getTime() > oneMinuteAgo);
    const throughput = recentOperations.length / 60; // ops per second

    return {
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      totalOperations,
      errorRate: totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0,
      throughput
    };
  }

  /**
   * Detect performance degradation
   */
  detectDegradation(operation?: string, windowMinutes: number = 10): {
    degraded: boolean;
    currentAvg: number;
    baselineAvg: number;
    degradationPercent: number;
  } {
    const windowMs = windowMinutes * 60 * 1000;
    const now = Date.now();
    const windowStart = now - windowMs;
    const baselineStart = now - (windowMs * 2);

    const filteredHistory = operation 
      ? this.responseTimeHistory.filter(r => r.operation === operation)
      : this.responseTimeHistory;

    const currentWindow = filteredHistory.filter(r => 
      r.timestamp.getTime() >= windowStart
    );
    
    const baselineWindow = filteredHistory.filter(r => 
      r.timestamp.getTime() >= baselineStart && 
      r.timestamp.getTime() < windowStart
    );

    if (currentWindow.length === 0 || baselineWindow.length === 0) {
      return {
        degraded: false,
        currentAvg: 0,
        baselineAvg: 0,
        degradationPercent: 0
      };
    }

    const currentAvg = currentWindow.reduce((sum, r) => sum + r.responseTime, 0) / currentWindow.length;
    const baselineAvg = baselineWindow.reduce((sum, r) => sum + r.responseTime, 0) / baselineWindow.length;
    
    const degradationPercent = ((currentAvg - baselineAvg) / baselineAvg) * 100;
    const degraded = degradationPercent > 50; // 50% degradation threshold

    return {
      degraded,
      currentAvg,
      baselineAvg,
      degradationPercent
    };
  }
}

/**
 * Resource Monitor
 * Monitors system resources (memory, CPU, disk, etc.)
 */
export class ResourceMonitor {
  /**
   * Get current memory usage
   */
  static getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
    external: number;
    rss: number;
  } {
    const usage = process.memoryUsage();
    return {
      used: usage.heapUsed,
      total: usage.heapTotal,
      percentage: (usage.heapUsed / usage.heapTotal) * 100,
      external: usage.external,
      rss: usage.rss
    };
  }

  /**
   * Check disk space
   */
  static async checkDiskSpace(path: string): Promise<{
    free: number;
    total: number;
    used: number;
    percentage: number;
  }> {
    try {
      const stats = await fs.statfs(path);
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const percentage = (used / total) * 100;

      return { free, total, used, percentage };
    } catch (error) {
      // Fallback for systems that don't support statfs
      return { free: 0, total: 0, used: 0, percentage: 0 };
    }
  }

  /**
   * Get process information
   */
  static getProcessInfo(): {
    pid: number;
    uptime: number;
    version: string;
    platform: string;
    arch: string;
  } {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }
}

/**
 * Recovery Automation
 * Provides automated recovery mechanisms
 */
export class RecoveryAutomation extends EventEmitter {
  private recoveryActions: Map<string, () => Promise<boolean>> = new Map();
  private recoveryHistory: Array<{
    timestamp: Date;
    component: string;
    action: string;
    success: boolean;
    error?: string;
  }> = [];

  /**
   * Register recovery action
   */
  registerRecoveryAction(component: string, action: () => Promise<boolean>): void {
    this.recoveryActions.set(component, action);
  }

  /**
   * Attempt automatic recovery
   */
  async attemptRecovery(component: string): Promise<boolean> {
    const action = this.recoveryActions.get(component);
    if (!action) {
      this.emit('recovery-unavailable', { component });
      return false;
    }

    try {
      this.emit('recovery-started', { component });
      const success = await action();
      
      this.recoveryHistory.push({
        timestamp: new Date(),
        component,
        action: 'automated-recovery',
        success
      });

      if (success) {
        this.emit('recovery-success', { component });
      } else {
        this.emit('recovery-failed', { component, reason: 'action-returned-false' });
      }

      return success;
    } catch (error) {
      this.recoveryHistory.push({
        timestamp: new Date(),
        component,
        action: 'automated-recovery',
        success: false,
        error: (error as Error).message
      });

      this.emit('recovery-failed', { component, error });
      return false;
    }
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(): Array<{
    timestamp: Date;
    component: string;
    action: string;
    success: boolean;
    error?: string;
  }> {
    return [...this.recoveryHistory];
  }
}

/**
 * Health Check Factory
 * Factory for creating common health checks
 */
export class HealthCheckFactory {
  /**
   * Create database health check
   */
  static createDatabaseHealthCheck(
    dbManager: any,
    name: string = 'database'
  ): () => Promise<HealthCheckResult> {
    return async () => {
      const startTime = performance.now();
      
      try {
        await dbManager.executeQuery('SELECT 1');
        const responseTime = performance.now() - startTime;
        
        return {
          component: name,
          status: responseTime > 1000 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
          timestamp: new Date(),
          responseTime,
          message: `Database responsive in ${responseTime.toFixed(2)}ms`
        };
      } catch (error) {
        return {
          component: name,
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date(),
          responseTime: performance.now() - startTime,
          message: `Database check failed: ${(error as Error).message}`,
          details: error
        };
      }
    };
  }

  /**
   * Create memory health check
   */
  static createMemoryHealthCheck(
    thresholds: { warning: number; critical: number } = { warning: 80, critical: 95 }
  ): () => Promise<HealthCheckResult> {
    return async () => {
      const startTime = performance.now();
      const memUsage = ResourceMonitor.getMemoryUsage();
      
      let status = HealthStatus.HEALTHY;
      let message = `Memory usage: ${memUsage.percentage.toFixed(2)}%`;
      
      if (memUsage.percentage > thresholds.critical) {
        status = HealthStatus.CRITICAL;
        message = `Critical memory usage: ${memUsage.percentage.toFixed(2)}%`;
      } else if (memUsage.percentage > thresholds.warning) {
        status = HealthStatus.DEGRADED;
        message = `High memory usage: ${memUsage.percentage.toFixed(2)}%`;
      }
      
      return {
        component: 'memory',
        status,
        timestamp: new Date(),
        responseTime: performance.now() - startTime,
        message,
        details: memUsage
      };
    };
  }

  /**
   * Create disk space health check
   */
  static createDiskSpaceHealthCheck(
    path: string,
    thresholds: { warning: number; critical: number } = { warning: 20, critical: 10 }
  ): () => Promise<HealthCheckResult> {
    return async () => {
      const startTime = performance.now();
      
      try {
        const diskUsage = await ResourceMonitor.checkDiskSpace(path);
        const freePercentage = (diskUsage.free / diskUsage.total) * 100;
        
        let status = HealthStatus.HEALTHY;
        let message = `Disk space: ${freePercentage.toFixed(2)}% free`;
        
        if (freePercentage < thresholds.critical) {
          status = HealthStatus.CRITICAL;
          message = `Critical disk space: ${freePercentage.toFixed(2)}% free`;
        } else if (freePercentage < thresholds.warning) {
          status = HealthStatus.DEGRADED;
          message = `Low disk space: ${freePercentage.toFixed(2)}% free`;
        }
        
        return {
          component: 'disk-space',
          status,
          timestamp: new Date(),
          responseTime: performance.now() - startTime,
          message,
          details: diskUsage
        };
      } catch (error) {
        return {
          component: 'disk-space',
          status: HealthStatus.UNHEALTHY,
          timestamp: new Date(),
          responseTime: performance.now() - startTime,
          message: `Disk space check failed: ${(error as Error).message}`,
          details: error
        };
      }
    };
  }
}

// Export all monitoring classes and types
export {
  SystemHealthMonitor,
  UptimeMonitor,
  PerformanceMonitor,
  ResourceMonitor,
  RecoveryAutomation,
  HealthCheckFactory
};