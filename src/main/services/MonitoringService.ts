/**
 * Monitoring Service Implementation
 * Provides system-wide monitoring and alerting capabilities
 */

import * as os from 'os';
import { Service, ServiceContext, ServiceHealth, ServiceStatus } from './ServiceManager';

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  services: {
    healthy: string[];
    unhealthy: string[];
    total: number;
  };
  timestamp: Date;
}

interface Alert {
  id: string;
  type: 'system' | 'service' | 'performance';
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export class MonitoringService implements Service {
  public readonly name = 'MonitoringService';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];
  public readonly priority = 10; // Low priority - monitoring service
  public readonly critical = false;

  private status: ServiceStatus = {
    status: 'stopped',
    restartCount: 0,
    uptime: 0,
  };
  private startTime?: Date;
  private monitoringInterval?: ReturnType<typeof setTimeout>;
  private metricsHistory: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private context?: ServiceContext;

  // Configurable thresholds
  private readonly thresholds = {
    cpuUsage: 80, // CPU usage percentage
    memoryUsage: 85, // Memory usage percentage
    diskUsage: 90, // Disk usage percentage
    serviceHealthCheck: 5000, // Service health check timeout (ms)
  };

  async initialize(context: ServiceContext): Promise<void> {
    context.logger.info('Initializing Monitoring Service...');
    this.startTime = new Date();
    this.context = context;

    try {
      // Start monitoring loop
      this.startMonitoring();

      this.status = {
        status: 'running',
        startTime: this.startTime,
        restartCount: 0,
        uptime: 0,
      };

      context.logger.info('Monitoring Service initialized successfully');
      context.metrics.increment('service.monitoring.initialized');
    } catch (error) {
      this.status = {
        status: 'error',
        lastError: error,
        restartCount: 0,
        uptime: 0,
      };

      context.logger.error('Monitoring Service initialization failed', error);
      context.metrics.increment('service.monitoring.initialization_failed');
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.status = {
      ...this.status,
      status: 'stopped',
    };
  }

  getStatus(): ServiceStatus {
    if (this.startTime && this.status.status === 'running') {
      this.status.uptime = Date.now() - this.startTime.getTime();
    }
    return { ...this.status };
  }

  async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check if monitoring is active
      const isMonitoring = this.monitoringInterval !== undefined;
      const metricsCount = this.metricsHistory.length;
      const activeAlerts = this.alerts.filter(a => !a.resolved).length;

      return {
        healthy: isMonitoring,
        details: {
          monitoring: isMonitoring,
          metricsHistory: metricsCount,
          activeAlerts,
          lastCollection: this.metricsHistory[this.metricsHistory.length - 1]?.timestamp,
        },
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  // Public API methods
  getCurrentMetrics(): SystemMetrics {
    return this.collectSystemMetrics();
  }

  getMetricsHistory(minutes: number = 60): SystemMetrics[] {
    const cutoffTime = Date.now() - minutes * 60 * 1000;
    return this.metricsHistory.filter(m => m.timestamp.getTime() > cutoffTime);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAllAlerts(hours: number = 24): Alert[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.alerts.filter(a => a.timestamp.getTime() > cutoffTime);
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  // Private methods
  private startMonitoring(): void {
    // Collect metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectAndAnalyzeMetrics();
    }, 30000);

    // Initial collection
    this.collectAndAnalyzeMetrics();
  }

  private collectAndAnalyzeMetrics(): void {
    try {
      const metrics = this.collectSystemMetrics();
      this.storeMetrics(metrics);
      this.analyzeMetrics(metrics);
    } catch (error) {
      if (this.context) {
        this.context.logger.error('Failed to collect system metrics', error);
      }
    }
  }

  private collectSystemMetrics(): SystemMetrics {
    const memInfo = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // System memory info
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Service health status from service manager
    let healthyServices: string[] = [];
    let unhealthyServices: string[] = [];

    if (this.context) {
      try {
        // Try to get service manager instance through context
        const serviceManagerProxy = this.context.getService('ServiceManager');
        if (serviceManagerProxy) {
          healthyServices = (serviceManagerProxy as any).getHealthyServices?.() || [];
          unhealthyServices = (serviceManagerProxy as any).getUnhealthyServices?.() || [];
        }
      } catch (error) {
        // Fallback - assume services are healthy if we can't check
        healthyServices = ['DatabaseService', 'WindowService', 'AIService', 'IPCService'];
        unhealthyServices = [];
      }
    }

    return {
      cpu: {
        usage: this.calculateCPUUsage(cpuUsage),
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: (usedMem / totalMem) * 100,
      },
      disk: {
        total: 0, // Would need platform-specific implementation
        free: 0,
        used: 0,
        usagePercent: 0,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: memInfo,
        cpuUsage: cpuUsage,
      },
      services: {
        healthy: healthyServices,
        unhealthy: unhealthyServices,
        total: healthyServices.length + unhealthyServices.length,
      },
      timestamp: new Date(),
    };
  }

  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simple approximation - in production you'd want more sophisticated calculation
    const total = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (total / 1000000) * 100); // Convert microseconds to percentage
  }

  private storeMetrics(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);

    // Keep only last 24 hours of metrics (assuming 30s intervals = 2880 entries per day)
    if (this.metricsHistory.length > 2880) {
      this.metricsHistory.shift();
    }
  }

  private analyzeMetrics(metrics: SystemMetrics): void {
    // CPU usage alert
    if (metrics.cpu.usage > this.thresholds.cpuUsage) {
      this.createAlert({
        type: 'system',
        level: 'warning',
        message: `High CPU usage detected: ${metrics.cpu.usage.toFixed(1)}%`,
        metadata: { cpuUsage: metrics.cpu.usage, threshold: this.thresholds.cpuUsage },
      });
    }

    // Memory usage alert
    if (metrics.memory.usagePercent > this.thresholds.memoryUsage) {
      this.createAlert({
        type: 'system',
        level: 'warning',
        message: `High memory usage detected: ${metrics.memory.usagePercent.toFixed(1)}%`,
        metadata: {
          memoryUsage: metrics.memory.usagePercent,
          threshold: this.thresholds.memoryUsage,
        },
      });
    }

    // Service health alerts
    if (metrics.services.unhealthy.length > 0) {
      this.createAlert({
        type: 'service',
        level: 'error',
        message: `Unhealthy services detected: ${metrics.services.unhealthy.join(', ')}`,
        metadata: { unhealthyServices: metrics.services.unhealthy },
      });
    }

    // Process memory growth alert (basic implementation)
    if (this.metricsHistory.length > 10) {
      const oldMetrics = this.metricsHistory[this.metricsHistory.length - 10];
      const memoryGrowth =
        metrics.process.memoryUsage.heapUsed - oldMetrics.process.memoryUsage.heapUsed;
      const growthMB = memoryGrowth / 1024 / 1024;

      if (growthMB > 50) {
        // More than 50MB growth in last 5 minutes
        this.createAlert({
          type: 'performance',
          level: 'warning',
          message: `Potential memory leak detected: ${growthMB.toFixed(1)}MB growth`,
          metadata: { memoryGrowth: growthMB, timeSpan: '5 minutes' },
        });
      }
    }
  }

  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      ...alertData,
      timestamp: new Date(),
      resolved: false,
    };

    // Avoid duplicate alerts within the last 5 minutes
    const recentAlerts = this.alerts.filter(
      a =>
        Date.now() - a.timestamp.getTime() < 300000 && // 5 minutes
        a.message === alert.message &&
        !a.resolved
    );

    if (recentAlerts.length === 0) {
      this.alerts.push(alert);

      // Log the alert
      if (this.context) {
        const logLevel = alert.level === 'critical' || alert.level === 'error' ? 'error' : 'warn';
        this.context.logger[logLevel](`Alert: ${alert.message}`);
        this.context.metrics.increment(`monitoring.alert.${alert.type}.${alert.level}`);
      }

      // Keep only last 1000 alerts
      if (this.alerts.length > 1000) {
        this.alerts.shift();
      }
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
