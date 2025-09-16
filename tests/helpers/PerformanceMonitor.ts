/**
 * PerformanceMonitor - Real-time performance monitoring for end-to-end testing
 * Tracks performance metrics, identifies bottlenecks, and generates insights
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface ResourceMetrics {
  memoryUsage: number;    // MB
  cpuUsage: number;       // Percentage
  diskUsage: number;      // MB
  networkLatency: number; // ms
  databaseConnections: number;
}

export interface TestResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  successRate: number;
  averageResponseTime: number;
  concurrentUsers: number;
  errorRecoveryTime: number;
  errorRate: number;
  offlineFunctional: boolean;
  collaborationFeatures: boolean;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  current: number;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private testStartTime: Date = new Date();
  private testResults: Partial<TestResults> = {};

  // Performance thresholds based on MVP1 requirements
  private thresholds = {
    searchResponseTime: { warning: 800, critical: 1000 },
    memoryUsage: { warning: 200, critical: 400 },
    cpuUsage: { warning: 60, critical: 80 },
    errorRate: { warning: 0.02, critical: 0.05 },
    cacheHitRate: { warning: 0.70, critical: 0.50 }
  };

  constructor() {
    super();
    this.initializeMetrics();
  }

  /**
   * Initialize performance metrics collection
   */
  private initializeMetrics(): void {
    const metricNames = [
      'searchResponseTime',
      'memoryUsage',
      'cpuUsage',
      'diskUsage',
      'networkLatency',
      'databaseResponseTime',
      'aiServiceResponseTime',
      'errorRate',
      'throughput',
      'concurrentUsers',
      'cacheHitRate'
    ];

    metricNames.forEach(name => {
      this.metrics.set(name, []);
    });

    console.log('📊 Performance monitoring initialized');
  }

  /**
   * Start performance monitoring with specified interval
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) {
      console.warn('⚠️ Performance monitoring already running');
      return;
    }

    this.isMonitoring = true;
    this.testStartTime = new Date();

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, intervalMs);

    this.emit('monitoring:started', { timestamp: new Date() });
    console.log(`🔄 Performance monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    this.emit('monitoring:stopped', { timestamp: new Date() });
    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string = 'ms'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      threshold: this.thresholds[name] || undefined
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    // Check thresholds and emit warnings
    this.checkThresholds(metric);

    this.emit('metric:recorded', metric);
  }

  /**
   * Record search performance
   */
  recordSearchPerformance(
    query: string,
    responseTime: number,
    resultCount: number,
    useAI: boolean = false
  ): void {
    this.recordMetric('searchResponseTime', responseTime);

    // Additional search-specific metrics
    this.recordMetric('searchResultCount', resultCount, 'count');

    if (useAI) {
      this.recordMetric('aiServiceResponseTime', responseTime);
    }

    // Update test results
    const current = this.testResults.averageResponseTime || 0;
    const count = this.metrics.get('searchResponseTime')?.length || 1;
    this.testResults.averageResponseTime = ((current * (count - 1)) + responseTime) / count;

    console.log(`🔍 Search performance: ${query} -> ${responseTime}ms (${resultCount} results)`);
  }

  /**
   * Record concurrent user metrics
   */
  recordConcurrentUsers(userCount: number, averageResponseTime: number): void {
    this.recordMetric('concurrentUsers', userCount, 'users');
    this.recordMetric('concurrentResponseTime', averageResponseTime);

    // Update test results
    this.testResults.concurrentUsers = Math.max(
      this.testResults.concurrentUsers || 0,
      userCount
    );

    console.log(`👥 Concurrent users: ${userCount} (avg response: ${averageResponseTime}ms)`);
  }

  /**
   * Record error and recovery metrics
   */
  recordError(errorType: string, recoveryTime?: number): void {
    const errorMetrics = this.metrics.get('errorRate') || [];
    const currentErrorRate = errorMetrics.length > 0 ?
      errorMetrics[errorMetrics.length - 1].value : 0;

    this.recordMetric('errorRate', currentErrorRate + 0.01); // Increment error rate

    if (recoveryTime !== undefined) {
      this.recordMetric('errorRecoveryTime', recoveryTime);
      this.testResults.errorRecoveryTime = recoveryTime;
    }

    console.log(`❌ Error recorded: ${errorType} (recovery: ${recoveryTime}ms)`);
  }

  /**
   * Record test completion
   */
  recordTestCompletion(testName: string, passed: boolean, duration: number): void {
    this.testResults.totalTests = (this.testResults.totalTests || 0) + 1;

    if (passed) {
      this.testResults.passedTests = (this.testResults.passedTests || 0) + 1;
    } else {
      this.testResults.failedTests = (this.testResults.failedTests || 0) + 1;
    }

    // Calculate success rate
    this.testResults.successRate = this.testResults.passedTests / this.testResults.totalTests;

    console.log(`${passed ? '✅' : '❌'} Test completed: ${testName} (${duration}ms)`);
  }

  /**
   * Collect system resource metrics
   */
  async collectMetrics(): Promise<void> {
    try {
      const resourceMetrics = await this.getResourceMetrics();

      this.recordMetric('memoryUsage', resourceMetrics.memoryUsage, 'MB');
      this.recordMetric('cpuUsage', resourceMetrics.cpuUsage, '%');
      this.recordMetric('diskUsage', resourceMetrics.diskUsage, 'MB');
      this.recordMetric('networkLatency', resourceMetrics.networkLatency);
      this.recordMetric('databaseConnections', resourceMetrics.databaseConnections, 'count');

    } catch (error) {
      console.error('❌ Failed to collect metrics:', error);
    }
  }

  /**
   * Get current resource metrics (mock implementation for testing)
   */
  async getResourceMetrics(): Promise<ResourceMetrics> {
    // Mock resource metrics for testing
    // In production, this would use actual system monitoring
    const baseMemory = 150;
    const baseCpu = 10;
    const baseDisk = 50;

    return {
      memoryUsage: baseMemory + (Math.random() * 100), // 150-250 MB
      cpuUsage: baseCpu + (Math.random() * 30),        // 10-40%
      diskUsage: baseDisk + (Math.random() * 200),     // 50-250 MB
      networkLatency: Math.random() * 100 + 10,        // 10-110ms
      databaseConnections: Math.floor(Math.random() * 10) + 1
    };
  }

  /**
   * Check performance thresholds and emit warnings
   */
  private checkThresholds(metric: PerformanceMetric): void {
    if (!metric.threshold) return;

    const { warning, critical } = metric.threshold;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (metric.value >= critical) {
      status = 'critical';
      this.emit('threshold:critical', metric);
      console.error(`🚨 CRITICAL: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${critical})`);
    } else if (metric.value >= warning) {
      status = 'warning';
      this.emit('threshold:warning', metric);
      console.warn(`⚠️ WARNING: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${warning})`);
    }

    // Calculate trend
    const recentMetrics = this.metrics.get(metric.name)?.slice(-5) || [];
    const trend = this.calculateTrend(recentMetrics);

    const threshold: PerformanceThreshold = {
      metric: metric.name,
      warning,
      critical,
      current: metric.value,
      status,
      trend
    };

    this.emit('threshold:checked', threshold);
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(metrics: PerformanceMetric[]): 'improving' | 'stable' | 'degrading' {
    if (metrics.length < 3) return 'stable';

    const recent = metrics.slice(-3).map(m => m.value);
    const slope = this.calculateSlope(recent);

    if (Math.abs(slope) < 0.1) return 'stable';
    return slope > 0 ? 'degrading' : 'improving';
  }

  /**
   * Calculate slope for trend analysis
   */
  private calculateSlope(values: number[]): number {
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + val * (index + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averages: Record<string, number>;
    thresholds: PerformanceThreshold[];
    trends: Record<string, string>;
    alerts: Array<{ metric: string; level: string; message: string }>;
  } {
    const averages: Record<string, number> = {};
    const thresholds: PerformanceThreshold[] = [];
    const trends: Record<string, string> = {};
    const alerts: Array<{ metric: string; level: string; message: string }> = [];

    this.metrics.forEach((metricList, name) => {
      if (metricList.length === 0) return;

      // Calculate average
      const sum = metricList.reduce((acc, metric) => acc + metric.value, 0);
      averages[name] = sum / metricList.length;

      // Calculate trend
      trends[name] = this.calculateTrend(metricList);

      // Check current threshold status
      const latest = metricList[metricList.length - 1];
      if (latest.threshold) {
        const { warning, critical } = latest.threshold;
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';

        if (latest.value >= critical) {
          status = 'critical';
          alerts.push({
            metric: name,
            level: 'critical',
            message: `${name} exceeded critical threshold: ${latest.value} >= ${critical}`
          });
        } else if (latest.value >= warning) {
          status = 'warning';
          alerts.push({
            metric: name,
            level: 'warning',
            message: `${name} exceeded warning threshold: ${latest.value} >= ${warning}`
          });
        }

        thresholds.push({
          metric: name,
          warning,
          critical,
          current: latest.value,
          status,
          trend: trends[name] as any
        });
      }
    });

    return { averages, thresholds, trends, alerts };
  }

  /**
   * Get test results
   */
  async getTestResults(): Promise<TestResults> {
    return {
      totalTests: this.testResults.totalTests || 0,
      passedTests: this.testResults.passedTests || 0,
      failedTests: this.testResults.failedTests || 0,
      successRate: this.testResults.successRate || 0,
      averageResponseTime: this.testResults.averageResponseTime || 0,
      concurrentUsers: this.testResults.concurrentUsers || 0,
      errorRecoveryTime: this.testResults.errorRecoveryTime || 0,
      errorRate: this.calculateErrorRate(),
      offlineFunctional: this.testResults.offlineFunctional || false,
      collaborationFeatures: this.testResults.collaborationFeatures || false
    };
  }

  /**
   * Calculate current error rate
   */
  private calculateErrorRate(): number {
    const errorMetrics = this.metrics.get('errorRate') || [];
    if (errorMetrics.length === 0) return 0;

    return errorMetrics[errorMetrics.length - 1].value;
  }

  /**
   * Generate detailed performance report
   */
  async generateReport(): Promise<string> {
    const summary = this.getPerformanceSummary();
    const testResults = await this.getTestResults();
    const testDuration = Date.now() - this.testStartTime.getTime();

    const report = {
      timestamp: new Date(),
      testDuration: `${Math.round(testDuration / 1000)}s`,
      summary,
      testResults,
      rawMetrics: Object.fromEntries(this.metrics),
      recommendations: this.generateRecommendations(summary, testResults)
    };

    const reportPath = path.join(
      process.cwd(),
      'tests/reports',
      `performance-report-${Date.now()}.json`
    );

    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      console.log(`📊 Performance report generated: ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error(`❌ Failed to generate performance report: ${error}`);
      throw error;
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    summary: ReturnType<PerformanceMonitor['getPerformanceSummary']>,
    testResults: TestResults
  ): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (summary.averages.searchResponseTime > 800) {
      recommendations.push('Consider optimizing search algorithms or adding more aggressive caching');
    }

    // Memory usage recommendations
    if (summary.averages.memoryUsage > 300) {
      recommendations.push('Monitor memory leaks and implement memory optimization strategies');
    }

    // Error rate recommendations
    if (testResults.errorRate > 0.02) {
      recommendations.push('Improve error handling and validation to reduce error rate');
    }

    // Concurrency recommendations
    if (testResults.concurrentUsers < 5) {
      recommendations.push('Test with higher concurrent user load to validate scalability');
    }

    // Trend-based recommendations
    Object.entries(summary.trends).forEach(([metric, trend]) => {
      if (trend === 'degrading') {
        recommendations.push(`Address degrading performance in ${metric}`);
      }
    });

    // General recommendations if no issues found
    if (recommendations.length === 0) {
      recommendations.push('Performance metrics are within acceptable ranges');
    }

    return recommendations;
  }

  /**
   * Export metrics in various formats
   */
  async exportMetrics(format: 'json' | 'csv' | 'prometheus' = 'json'): Promise<string> {
    const timestamp = Date.now();
    let content: string;
    let extension: string;

    switch (format) {
      case 'csv':
        content = this.generateCSV();
        extension = 'csv';
        break;
      case 'prometheus':
        content = this.generatePrometheus();
        extension = 'prom';
        break;
      default:
        content = JSON.stringify(Object.fromEntries(this.metrics), null, 2);
        extension = 'json';
    }

    const exportPath = path.join(
      process.cwd(),
      'tests/reports',
      `metrics-export-${timestamp}.${extension}`
    );

    try {
      await fs.mkdir(path.dirname(exportPath), { recursive: true });
      await fs.writeFile(exportPath, content);

      console.log(`📤 Metrics exported: ${exportPath}`);
      return exportPath;
    } catch (error) {
      console.error(`❌ Failed to export metrics: ${error}`);
      throw error;
    }
  }

  /**
   * Generate CSV format for metrics
   */
  private generateCSV(): string {
    const rows: string[] = ['timestamp,metric,value,unit'];

    this.metrics.forEach((metricList, name) => {
      metricList.forEach(metric => {
        rows.push(`${metric.timestamp.toISOString()},${name},${metric.value},${metric.unit}`);
      });
    });

    return rows.join('\n');
  }

  /**
   * Generate Prometheus format for metrics
   */
  private generatePrometheus(): string {
    const lines: string[] = [];

    this.metrics.forEach((metricList, name) => {
      if (metricList.length === 0) return;

      const latest = metricList[metricList.length - 1];
      lines.push(`# HELP ${name} Performance metric for ${name}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${latest.value}`);
    });

    return lines.join('\n');
  }

  /**
   * Cleanup and finalize monitoring
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();

    // Generate final report
    await this.generateReport();

    this.emit('monitoring:cleanup', { timestamp: new Date() });
    console.log('🧹 Performance monitor cleaned up');
  }
}