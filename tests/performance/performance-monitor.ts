import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';
import fs from 'fs';
import path from 'path';

/**
 * Performance Monitoring Tools for MVP1 Knowledge Base Assistant
 * 
 * Provides real-time performance monitoring, profiling, and alerting
 * capabilities for production and development environments.
 */

export interface PerformanceMetric {
  timestamp: Date;
  type: 'cpu' | 'memory' | 'database' | 'search' | 'ui' | 'custom';
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  metadata?: any;
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  threshold: number;
  actualValue: number;
  message: string;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface MonitoringConfig {
  enabled: boolean;
  sampleInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  alertThresholds: Record<string, number>;
  exportPath?: string;
  enabledMetrics: string[];
}

export interface SystemSnapshot {
  timestamp: Date;
  cpu: {
    usage: NodeJS.CpuUsage;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  custom: Record<string, any>;
}

export interface PerformanceProfile {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  samples: PerformanceMetric[];
  children: PerformanceProfile[];
  metadata: Record<string, any>;
}

/**
 * Real-time Performance Monitor
 */
export class PerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private profiles: Map<string, PerformanceProfile> = new Map();
  private isRunning = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      sampleInterval: 5000, // 5 seconds
      retentionPeriod: 3600000, // 1 hour
      alertThresholds: {
        'cpu.usage': 80, // 80% CPU usage
        'memory.heapUsed': 400, // 400MB heap usage
        'memory.rss': 500, // 500MB RSS
        'search.responseTime': 1000, // 1s search response
        'database.queryTime': 100, // 100ms query time
        'ui.renderTime': 100, // 100ms UI render
      },
      enabledMetrics: ['cpu', 'memory', 'search', 'database', 'ui'],
      ...config
    };
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('monitor:started');

    // System metrics sampling
    if (this.config.enabledMetrics.includes('cpu') || this.config.enabledMetrics.includes('memory')) {
      const systemInterval = setInterval(() => {
        this.collectSystemMetrics();
      }, this.config.sampleInterval);
      
      this.intervals.push(systemInterval);
    }

    // Metric retention cleanup
    const cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Every minute
    
    this.intervals.push(cleanupInterval);

    // Alert processing
    const alertInterval = setInterval(() => {
      this.processAlerts();
    }, 10000); // Every 10 seconds
    
    this.intervals.push(alertInterval);
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    this.emit('monitor:stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (!this.config.enabled) return;

    const fullMetric: PerformanceMetric = {
      timestamp: new Date(),
      ...metric
    };

    this.metrics.push(fullMetric);
    this.emit('metric:recorded', fullMetric);

    // Check for threshold violations
    this.checkThresholds(fullMetric);
  }

  /**
   * Start performance profiling
   */
  startProfile(name: string, metadata: Record<string, any> = {}): void {
    const profile: PerformanceProfile = {
      name,
      startTime: performance.now(),
      samples: [],
      children: [],
      metadata
    };

    this.profiles.set(name, profile);
    this.emit('profile:started', { name, startTime: profile.startTime });
  }

  /**
   * End performance profiling
   */
  endProfile(name: string): PerformanceProfile | null {
    const profile = this.profiles.get(name);
    if (!profile) return null;

    profile.endTime = performance.now();
    profile.duration = profile.endTime - profile.startTime;

    this.profiles.delete(name);
    this.emit('profile:completed', profile);

    return profile;
  }

  /**
   * Add sample to active profile
   */
  addProfileSample(profileName: string, metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const profile = this.profiles.get(profileName);
    if (!profile) return;

    const sample: PerformanceMetric = {
      timestamp: new Date(),
      ...metric
    };

    profile.samples.push(sample);
  }

  /**
   * Measure operation performance
   */
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T> | T,
    options: { 
      profileName?: string;
      recordMetric?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      const executionTime = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      if (options.recordMetric !== false) {
        this.recordMetric({
          type: 'custom',
          name: `operation.${name}`,
          value: executionTime,
          unit: 'ms',
          tags: {
            operation: name,
            status: 'success'
          },
          metadata: {
            memoryDelta,
            ...options.metadata
          }
        });
      }

      if (options.profileName) {
        this.addProfileSample(options.profileName, {
          type: 'custom',
          name: `operation.${name}`,
          value: executionTime,
          unit: 'ms'
        });
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      if (options.recordMetric !== false) {
        this.recordMetric({
          type: 'custom',
          name: `operation.${name}`,
          value: executionTime,
          unit: 'ms',
          tags: {
            operation: name,
            status: 'error'
          },
          metadata: {
            error: error.message,
            ...options.metadata
          }
        });
      }

      throw error;
    }
  }

  /**
   * Get current performance snapshot
   */
  getSnapshot(): SystemSnapshot {
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: new Date(),
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg()
      },
      memory: {
        used: memUsage.rss,
        total: os.totalmem(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: memUsage
      },
      custom: {}
    };
  }

  /**
   * Get metrics for a time range
   */
  getMetrics(options: {
    type?: string;
    name?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  } = {}): PerformanceMetric[] {
    let filtered = this.metrics;

    if (options.type) {
      filtered = filtered.filter(m => m.type === options.type);
    }

    if (options.name) {
      filtered = filtered.filter(m => m.name === options.name);
    }

    if (options.startTime) {
      filtered = filtered.filter(m => m.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      filtered = filtered.filter(m => m.timestamp <= options.endTime!);
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get active alerts
   */
  getAlerts(resolved: boolean = false): PerformanceAlert[] {
    return this.alerts.filter(alert => alert.resolved === resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    
    this.emit('alert:resolved', alert);
    return true;
  }

  /**
   * Export metrics to file
   */
  async exportMetrics(filePath: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    const metrics = this.getMetrics();
    
    if (format === 'csv') {
      const csvContent = this.convertToCSV(metrics);
      await fs.promises.writeFile(filePath, csvContent, 'utf8');
    } else {
      const jsonContent = JSON.stringify(metrics, null, 2);
      await fs.promises.writeFile(filePath, jsonContent, 'utf8');
    }

    this.emit('export:completed', { filePath, format, count: metrics.length });
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange: { start: Date; end: Date }): any {
    const metrics = this.getMetrics({
      startTime: timeRange.start,
      endTime: timeRange.end
    });

    const report = {
      timeRange,
      summary: this.generateSummary(metrics),
      breakdown: this.generateBreakdown(metrics),
      alerts: this.getAlerts().filter(alert => 
        alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end
      ),
      recommendations: this.generateRecommendations(metrics)
    };

    return report;
  }

  private collectSystemMetrics(): void {
    const snapshot = this.getSnapshot();

    // CPU metrics
    if (this.config.enabledMetrics.includes('cpu')) {
      const cpuPercent = (snapshot.cpu.usage.user + snapshot.cpu.usage.system) / 1000000 * 100;
      
      this.recordMetric({
        type: 'cpu',
        name: 'cpu.usage',
        value: cpuPercent,
        unit: 'percent'
      });

      snapshot.cpu.loadAverage.forEach((load, index) => {
        this.recordMetric({
          type: 'cpu',
          name: `cpu.loadAverage.${index + 1}m`,
          value: load,
          unit: 'load'
        });
      });
    }

    // Memory metrics
    if (this.config.enabledMetrics.includes('memory')) {
      this.recordMetric({
        type: 'memory',
        name: 'memory.heapUsed',
        value: snapshot.memory.heapUsed / 1024 / 1024,
        unit: 'MB'
      });

      this.recordMetric({
        type: 'memory',
        name: 'memory.heapTotal',
        value: snapshot.memory.heapTotal / 1024 / 1024,
        unit: 'MB'
      });

      this.recordMetric({
        type: 'memory',
        name: 'memory.rss',
        value: snapshot.memory.used / 1024 / 1024,
        unit: 'MB'
      });

      this.recordMetric({
        type: 'memory',
        name: 'memory.external',
        value: snapshot.memory.external / 1024 / 1024,
        unit: 'MB'
      });
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.config.alertThresholds[metric.name];
    if (!threshold) return;

    const violatesThreshold = metric.value > threshold;
    if (!violatesThreshold) return;

    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity: this.getSeverityLevel(metric.name, metric.value, threshold),
      metric: metric.name,
      threshold,
      actualValue: metric.value,
      message: `${metric.name} exceeded threshold: ${metric.value}${metric.unit} > ${threshold}${metric.unit}`,
      resolved: false
    };

    this.alerts.push(alert);
    this.emit('alert:triggered', alert);
  }

  private getSeverityLevel(metricName: string, value: number, threshold: number): PerformanceAlert['severity'] {
    const ratio = value / threshold;
    
    if (ratio >= 2.0) return 'critical';
    if (ratio >= 1.5) return 'error';
    if (ratio >= 1.2) return 'warning';
    return 'info';
  }

  private processAlerts(): void {
    const activeAlerts = this.getAlerts(false);
    
    // Auto-resolve alerts that are no longer violating
    activeAlerts.forEach(alert => {
      const recentMetrics = this.getMetrics({
        name: alert.metric,
        startTime: new Date(Date.now() - 60000), // Last minute
        limit: 5
      });

      if (recentMetrics.length > 0) {
        const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
        
        if (avgValue <= alert.threshold * 0.9) { // 10% below threshold
          this.resolveAlert(alert.id);
        }
      }
    });
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);
    const oldCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(metric => metric.timestamp >= cutoffTime);
    
    const cleanedCount = oldCount - this.metrics.length;
    if (cleanedCount > 0) {
      this.emit('cleanup:completed', { cleanedCount, remaining: this.metrics.length });
    }

    // Also cleanup old alerts
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp >= cutoffTime || !alert.resolved
    );
  }

  private convertToCSV(metrics: PerformanceMetric[]): string {
    if (metrics.length === 0) return '';

    const headers = ['timestamp', 'type', 'name', 'value', 'unit', 'tags', 'metadata'];
    const rows = metrics.map(metric => [
      metric.timestamp.toISOString(),
      metric.type,
      metric.name,
      metric.value.toString(),
      metric.unit,
      JSON.stringify(metric.tags || {}),
      JSON.stringify(metric.metadata || {})
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  private generateSummary(metrics: PerformanceMetric[]): any {
    const summary = {
      totalMetrics: metrics.length,
      timeSpan: 0,
      metricTypes: {} as Record<string, number>,
      averages: {} as Record<string, number>,
      peaks: {} as Record<string, number>
    };

    if (metrics.length === 0) return summary;

    const earliest = Math.min(...metrics.map(m => m.timestamp.getTime()));
    const latest = Math.max(...metrics.map(m => m.timestamp.getTime()));
    summary.timeSpan = latest - earliest;

    // Count by type
    metrics.forEach(metric => {
      summary.metricTypes[metric.type] = (summary.metricTypes[metric.type] || 0) + 1;
    });

    // Calculate averages and peaks by metric name
    const metricGroups: Record<string, PerformanceMetric[]> = {};
    metrics.forEach(metric => {
      if (!metricGroups[metric.name]) {
        metricGroups[metric.name] = [];
      }
      metricGroups[metric.name].push(metric);
    });

    Object.entries(metricGroups).forEach(([name, group]) => {
      const values = group.map(m => m.value);
      summary.averages[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
      summary.peaks[name] = Math.max(...values);
    });

    return summary;
  }

  private generateBreakdown(metrics: PerformanceMetric[]): any {
    const breakdown: Record<string, any> = {};

    const metricsByType = metrics.reduce((acc, metric) => {
      if (!acc[metric.type]) {
        acc[metric.type] = [];
      }
      acc[metric.type].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);

    Object.entries(metricsByType).forEach(([type, typeMetrics]) => {
      breakdown[type] = {
        count: typeMetrics.length,
        timeRange: {
          start: Math.min(...typeMetrics.map(m => m.timestamp.getTime())),
          end: Math.max(...typeMetrics.map(m => m.timestamp.getTime()))
        },
        metrics: typeMetrics.reduce((acc, metric) => {
          if (!acc[metric.name]) {
            acc[metric.name] = {
              count: 0,
              average: 0,
              min: Infinity,
              max: -Infinity,
              latest: 0
            };
          }

          const stats = acc[metric.name];
          stats.count++;
          stats.average = ((stats.average * (stats.count - 1)) + metric.value) / stats.count;
          stats.min = Math.min(stats.min, metric.value);
          stats.max = Math.max(stats.max, metric.value);
          stats.latest = metric.value;

          return acc;
        }, {} as Record<string, any>)
      };
    });

    return breakdown;
  }

  private generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];
    const summary = this.generateSummary(metrics);

    // Memory recommendations
    if (summary.peaks['memory.heapUsed'] > 300) {
      recommendations.push('High memory usage detected. Consider implementing memory optimization strategies.');
    }

    // CPU recommendations
    if (summary.averages['cpu.usage'] > 70) {
      recommendations.push('High CPU usage detected. Consider optimizing performance-critical operations.');
    }

    // Search performance recommendations
    if (summary.averages['search.responseTime'] > 800) {
      recommendations.push('Search response time is above optimal. Consider implementing search result caching.');
    }

    // Database recommendations
    if (summary.averages['database.queryTime'] > 80) {
      recommendations.push('Database query performance is suboptimal. Review query optimization and indexing.');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable parameters.');
    }

    return recommendations;
  }
}

/**
 * Performance Profiler for detailed analysis
 */
export class PerformanceProfiler {
  private profiles: PerformanceProfile[] = [];
  private activeProfiles: Map<string, PerformanceProfile> = new Map();

  /**
   * Start a new performance profile
   */
  start(name: string, metadata: Record<string, any> = {}): void {
    const profile: PerformanceProfile = {
      name,
      startTime: performance.now(),
      samples: [],
      children: [],
      metadata
    };

    this.activeProfiles.set(name, profile);
  }

  /**
   * End a performance profile
   */
  end(name: string): PerformanceProfile | null {
    const profile = this.activeProfiles.get(name);
    if (!profile) return null;

    profile.endTime = performance.now();
    profile.duration = profile.endTime - profile.startTime;

    this.activeProfiles.delete(name);
    this.profiles.push(profile);

    return profile;
  }

  /**
   * Mark a point in an active profile
   */
  mark(profileName: string, label: string, metadata?: any): void {
    const profile = this.activeProfiles.get(profileName);
    if (!profile) return;

    profile.samples.push({
      timestamp: new Date(),
      type: 'custom',
      name: label,
      value: performance.now() - profile.startTime,
      unit: 'ms',
      metadata
    });
  }

  /**
   * Get completed profiles
   */
  getProfiles(): PerformanceProfile[] {
    return [...this.profiles];
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles = [];
    this.activeProfiles.clear();
  }

  /**
   * Export profiles to file
   */
  async export(filePath: string): Promise<void> {
    const data = {
      timestamp: new Date().toISOString(),
      profiles: this.profiles
    };

    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

/**
 * Load Test Performance Monitor
 */
export class LoadTestMonitor extends PerformanceMonitor {
  private loadTestResults: Array<{
    timestamp: Date;
    concurrentUsers: number;
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number;
    systemMetrics: SystemSnapshot;
  }> = [];

  /**
   * Record load test result
   */
  recordLoadTestResult(result: {
    concurrentUsers: number;
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number;
  }): void {
    this.loadTestResults.push({
      timestamp: new Date(),
      ...result,
      systemMetrics: this.getSnapshot()
    });

    // Record as metrics
    this.recordMetric({
      type: 'custom',
      name: 'loadtest.concurrentUsers',
      value: result.concurrentUsers,
      unit: 'users'
    });

    this.recordMetric({
      type: 'custom',
      name: 'loadtest.requestsPerSecond',
      value: result.requestsPerSecond,
      unit: 'req/s'
    });

    this.recordMetric({
      type: 'custom',
      name: 'loadtest.avgResponseTime',
      value: result.avgResponseTime,
      unit: 'ms'
    });

    this.recordMetric({
      type: 'custom',
      name: 'loadtest.errorRate',
      value: result.errorRate * 100,
      unit: 'percent'
    });
  }

  /**
   * Get load test results
   */
  getLoadTestResults(): typeof this.loadTestResults {
    return [...this.loadTestResults];
  }

  /**
   * Generate load test report
   */
  generateLoadTestReport(): any {
    const results = this.getLoadTestResults();
    
    if (results.length === 0) {
      return { message: 'No load test results available' };
    }

    const avgConcurrentUsers = results.reduce((sum, r) => sum + r.concurrentUsers, 0) / results.length;
    const avgRequestsPerSecond = results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / results.length;
    const avgResponseTime = results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length;
    const avgErrorRate = results.reduce((sum, r) => sum + r.errorRate, 0) / results.length;

    const maxConcurrentUsers = Math.max(...results.map(r => r.concurrentUsers));
    const maxRequestsPerSecond = Math.max(...results.map(r => r.requestsPerSecond));
    const minResponseTime = Math.min(...results.map(r => r.avgResponseTime));
    const maxResponseTime = Math.max(...results.map(r => r.avgResponseTime));

    return {
      summary: {
        totalTests: results.length,
        timeSpan: {
          start: results[0].timestamp,
          end: results[results.length - 1].timestamp,
          duration: results[results.length - 1].timestamp.getTime() - results[0].timestamp.getTime()
        },
        averages: {
          concurrentUsers: avgConcurrentUsers,
          requestsPerSecond: avgRequestsPerSecond,
          responseTime: avgResponseTime,
          errorRate: avgErrorRate
        },
        peaks: {
          maxConcurrentUsers,
          maxRequestsPerSecond,
          minResponseTime,
          maxResponseTime
        }
      },
      results: results.map(result => ({
        ...result,
        systemMetrics: {
          memoryUsageMB: result.systemMetrics.memory.heapUsed / 1024 / 1024,
          cpuLoadAverage: result.systemMetrics.cpu.loadAverage[0]
        }
      }))
    };
  }
}

// Export singleton instance for easy use
export const performanceMonitor = new PerformanceMonitor();
export const performanceProfiler = new PerformanceProfiler();