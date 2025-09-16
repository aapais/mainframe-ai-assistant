/**
 * Performance Monitoring Utilities for Integration Testing
 * Provides comprehensive performance tracking and analysis for service interactions
 */

import { EventEmitter } from 'events';

export interface PerformanceMetric {
  operationId: string;
  operationType: string;
  service: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: Error;
  metadata?: Record<string, any>;
  resourceUsage?: {
    memoryBefore: number;
    memoryAfter: number;
    memoryDelta: number;
    cpuTime?: number;
  };
}

export interface PerformanceReport {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  p99Duration: number;
  minDuration: number;
  maxDuration: number;
  throughput: number; // operations per second
  errorRate: number;
  serviceBreakdown: Record<string, {
    operations: number;
    averageDuration: number;
    errorRate: number;
  }>;
  operationBreakdown: Record<string, {
    operations: number;
    averageDuration: number;
    errorRate: number;
  }>;
  memoryUsage: {
    averageUsage: number;
    peakUsage: number;
    totalAllocated: number;
    totalFreed: number;
  };
  timeSeriesData: Array<{
    timestamp: number;
    operationsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
  }>;
}

/**
 * Performance monitor for tracking service operation performance
 */
export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private activeOperations = new Map<string, {
    startTime: number;
    memoryBefore: number;
    operationType: string;
    service: string;
    metadata?: Record<string, any>;
  }>();
  private timeSeriesInterval?: NodeJS.Timeout;
  private timeSeriesData: Array<{
    timestamp: number;
    operationsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
  }> = [];

  constructor(
    private options: {
      enableTimeSeriesCollection?: boolean;
      timeSeriesInterval?: number;
      maxMetricsHistory?: number;
    } = {}
  ) {
    super();
    
    if (options.enableTimeSeriesCollection) {
      this.startTimeSeriesCollection();
    }
  }

  /**
   * Start tracking a service operation
   */
  startOperation(
    operationId: string,
    operationType: string,
    service: string,
    metadata?: Record<string, any>
  ): void {
    const memoryUsage = process.memoryUsage();
    
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      memoryBefore: memoryUsage.heapUsed,
      operationType,
      service,
      metadata
    });
  }

  /**
   * End tracking a service operation
   */
  endOperation(
    operationId: string,
    success: boolean = true,
    error?: Error,
    additionalMetadata?: Record<string, any>
  ): PerformanceMetric | null {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      console.warn(`Operation ${operationId} not found in active operations`);
      return null;
    }

    const endTime = Date.now();
    const memoryUsage = process.memoryUsage();
    
    const metric: PerformanceMetric = {
      operationId,
      operationType: operation.operationType,
      service: operation.service,
      startTime: operation.startTime,
      endTime,
      duration: endTime - operation.startTime,
      success,
      error,
      metadata: { ...operation.metadata, ...additionalMetadata },
      resourceUsage: {
        memoryBefore: operation.memoryBefore,
        memoryAfter: memoryUsage.heapUsed,
        memoryDelta: memoryUsage.heapUsed - operation.memoryBefore
      }
    };

    this.metrics.push(metric);
    this.activeOperations.delete(operationId);

    // Emit event for real-time monitoring
    this.emit('operation:completed', metric);

    // Limit history size
    const maxHistory = this.options.maxMetricsHistory || 10000;
    if (this.metrics.length > maxHistory) {
      this.metrics = this.metrics.slice(-maxHistory);
    }

    return metric;
  }

  /**
   * Track an operation with automatic timing
   */
  async trackOperation<T>(
    operationId: string,
    operationType: string,
    service: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startOperation(operationId, operationType, service, metadata);
    
    try {
      const result = await operation();
      this.endOperation(operationId, true, undefined, { resultType: typeof result });
      return result;
    } catch (error) {
      this.endOperation(operationId, false, error as Error);
      throw error;
    }
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(timeWindow?: { start: number; end: number }): PerformanceReport {
    let filteredMetrics = this.metrics;
    
    if (timeWindow) {
      filteredMetrics = this.metrics.filter(m => 
        m.startTime >= timeWindow.start && m.startTime <= timeWindow.end
      );
    }

    if (filteredMetrics.length === 0) {
      return this.getEmptyReport();
    }

    const durations = filteredMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successfulOperations = filteredMetrics.filter(m => m.success);
    const failedOperations = filteredMetrics.filter(m => !m.success);
    
    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const medianIndex = Math.floor(durations.length * 0.5);

    // Calculate service breakdown
    const serviceBreakdown: Record<string, {
      operations: number;
      averageDuration: number;
      errorRate: number;
    }> = {};

    const operationBreakdown: Record<string, {
      operations: number;
      averageDuration: number;
      errorRate: number;
    }> = {};

    filteredMetrics.forEach(metric => {
      // Service breakdown
      if (!serviceBreakdown[metric.service]) {
        serviceBreakdown[metric.service] = {
          operations: 0,
          averageDuration: 0,
          errorRate: 0
        };
      }
      serviceBreakdown[metric.service].operations++;
      serviceBreakdown[metric.service].averageDuration += metric.duration;

      // Operation breakdown
      if (!operationBreakdown[metric.operationType]) {
        operationBreakdown[metric.operationType] = {
          operations: 0,
          averageDuration: 0,
          errorRate: 0
        };
      }
      operationBreakdown[metric.operationType].operations++;
      operationBreakdown[metric.operationType].averageDuration += metric.duration;
    });

    // Calculate averages and error rates
    Object.keys(serviceBreakdown).forEach(service => {
      const breakdown = serviceBreakdown[service];
      breakdown.averageDuration /= breakdown.operations;
      
      const serviceErrors = filteredMetrics.filter(m => 
        m.service === service && !m.success
      ).length;
      breakdown.errorRate = serviceErrors / breakdown.operations;
    });

    Object.keys(operationBreakdown).forEach(operation => {
      const breakdown = operationBreakdown[operation];
      breakdown.averageDuration /= breakdown.operations;
      
      const operationErrors = filteredMetrics.filter(m => 
        m.operationType === operation && !m.success
      ).length;
      breakdown.errorRate = operationErrors / breakdown.operations;
    });

    // Memory usage calculations
    const memoryMetrics = filteredMetrics
      .filter(m => m.resourceUsage)
      .map(m => m.resourceUsage!);

    const memoryUsage = {
      averageUsage: memoryMetrics.length > 0 
        ? memoryMetrics.reduce((sum, m) => sum + m.memoryAfter, 0) / memoryMetrics.length
        : 0,
      peakUsage: memoryMetrics.length > 0 
        ? Math.max(...memoryMetrics.map(m => m.memoryAfter))
        : 0,
      totalAllocated: memoryMetrics
        .filter(m => m.memoryDelta > 0)
        .reduce((sum, m) => sum + m.memoryDelta, 0),
      totalFreed: memoryMetrics
        .filter(m => m.memoryDelta < 0)
        .reduce((sum, m) => sum + Math.abs(m.memoryDelta), 0)
    };

    // Calculate throughput
    const timeSpan = filteredMetrics.length > 0 
      ? (Math.max(...filteredMetrics.map(m => m.endTime)) - 
         Math.min(...filteredMetrics.map(m => m.startTime))) / 1000
      : 1;
    const throughput = filteredMetrics.length / timeSpan;

    return {
      totalOperations: filteredMetrics.length,
      successfulOperations: successfulOperations.length,
      failedOperations: failedOperations.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      medianDuration: durations[medianIndex] || 0,
      p95Duration: durations[p95Index] || 0,
      p99Duration: durations[p99Index] || 0,
      minDuration: durations[0] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      throughput,
      errorRate: failedOperations.length / filteredMetrics.length,
      serviceBreakdown,
      operationBreakdown,
      memoryUsage,
      timeSeriesData: this.getTimeSeriesData(timeWindow)
    };
  }

  /**
   * Get time series data for charting/visualization
   */
  private getTimeSeriesData(timeWindow?: { start: number; end: number }) {
    let data = this.timeSeriesData;
    
    if (timeWindow) {
      data = data.filter(d => 
        d.timestamp >= timeWindow.start && d.timestamp <= timeWindow.end
      );
    }
    
    return data;
  }

  /**
   * Start collecting time series performance data
   */
  private startTimeSeriesCollection(): void {
    const interval = this.options.timeSeriesInterval || 5000; // 5 seconds default
    
    this.timeSeriesInterval = setInterval(() => {
      const now = Date.now();
      const recentWindow = now - interval;
      
      const recentMetrics = this.metrics.filter(m => 
        m.startTime >= recentWindow && m.startTime <= now
      );

      if (recentMetrics.length === 0) {
        return;
      }

      const operationsPerSecond = recentMetrics.length / (interval / 1000);
      const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
      const errors = recentMetrics.filter(m => !m.success).length;
      const errorRate = errors / recentMetrics.length;
      const memoryUsage = process.memoryUsage().heapUsed;

      this.timeSeriesData.push({
        timestamp: now,
        operationsPerSecond,
        averageResponseTime,
        errorRate,
        memoryUsage
      });

      // Limit time series data (keep last 1000 data points)
      if (this.timeSeriesData.length > 1000) {
        this.timeSeriesData = this.timeSeriesData.slice(-1000);
      }

      this.emit('timeseries:updated', {
        timestamp: now,
        operationsPerSecond,
        averageResponseTime,
        errorRate,
        memoryUsage
      });
    }, interval);
  }

  /**
   * Clear all collected metrics
   */
  clear(): void {
    this.metrics = [];
    this.activeOperations.clear();
    this.timeSeriesData = [];
  }

  /**
   * Stop time series collection
   */
  stop(): void {
    if (this.timeSeriesInterval) {
      clearInterval(this.timeSeriesInterval);
      this.timeSeriesInterval = undefined;
    }
  }

  /**
   * Get current active operations
   */
  getActiveOperations(): Array<{
    operationId: string;
    operationType: string;
    service: string;
    duration: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeOperations.entries()).map(([id, op]) => ({
      operationId: id,
      operationType: op.operationType,
      service: op.service,
      duration: now - op.startTime
    }));
  }

  /**
   * Get metrics for a specific service
   */
  getServiceMetrics(service: string, timeWindow?: { start: number; end: number }): PerformanceMetric[] {
    let metrics = this.metrics.filter(m => m.service === service);
    
    if (timeWindow) {
      metrics = metrics.filter(m => 
        m.startTime >= timeWindow.start && m.startTime <= timeWindow.end
      );
    }
    
    return metrics;
  }

  /**
   * Get metrics for a specific operation type
   */
  getOperationMetrics(operationType: string, timeWindow?: { start: number; end: number }): PerformanceMetric[] {
    let metrics = this.metrics.filter(m => m.operationType === operationType);
    
    if (timeWindow) {
      metrics = metrics.filter(m => 
        m.startTime >= timeWindow.start && m.startTime <= timeWindow.end
      );
    }
    
    return metrics;
  }

  private getEmptyReport(): PerformanceReport {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      medianDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      minDuration: 0,
      maxDuration: 0,
      throughput: 0,
      errorRate: 0,
      serviceBreakdown: {},
      operationBreakdown: {},
      memoryUsage: {
        averageUsage: 0,
        peakUsage: 0,
        totalAllocated: 0,
        totalFreed: 0
      },
      timeSeriesData: []
    };
  }
}

/**
 * Performance assertion utilities for testing
 */
export class PerformanceAssertion {
  constructor(private monitor: PerformanceMonitor) {}

  /**
   * Assert that average response time is within threshold
   */
  assertAverageResponseTime(
    threshold: number,
    service?: string,
    operationType?: string,
    timeWindow?: { start: number; end: number }
  ): void {
    let metrics = this.monitor['metrics'];
    
    if (timeWindow) {
      metrics = metrics.filter(m => 
        m.startTime >= timeWindow.start && m.startTime <= timeWindow.end
      );
    }
    
    if (service) {
      metrics = metrics.filter(m => m.service === service);
    }
    
    if (operationType) {
      metrics = metrics.filter(m => m.operationType === operationType);
    }

    if (metrics.length === 0) {
      throw new Error('No metrics found for assertion');
    }

    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    
    if (avgDuration > threshold) {
      throw new Error(
        `Average response time ${avgDuration}ms exceeds threshold ${threshold}ms ` +
        `(${service || 'all services'}, ${operationType || 'all operations'})`
      );
    }
  }

  /**
   * Assert that error rate is below threshold
   */
  assertErrorRate(
    threshold: number,
    service?: string,
    operationType?: string,
    timeWindow?: { start: number; end: number }
  ): void {
    let metrics = this.monitor['metrics'];
    
    if (timeWindow) {
      metrics = metrics.filter(m => 
        m.startTime >= timeWindow.start && m.startTime <= timeWindow.end
      );
    }
    
    if (service) {
      metrics = metrics.filter(m => m.service === service);
    }
    
    if (operationType) {
      metrics = metrics.filter(m => m.operationType === operationType);
    }

    if (metrics.length === 0) {
      throw new Error('No metrics found for assertion');
    }

    const errorCount = metrics.filter(m => !m.success).length;
    const errorRate = errorCount / metrics.length;
    
    if (errorRate > threshold) {
      throw new Error(
        `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(threshold * 100).toFixed(2)}% ` +
        `(${service || 'all services'}, ${operationType || 'all operations'})`
      );
    }
  }

  /**
   * Assert that throughput meets minimum requirement
   */
  assertThroughput(
    minThroughput: number,
    service?: string,
    operationType?: string,
    timeWindow?: { start: number; end: number }
  ): void {
    let metrics = this.monitor['metrics'];
    
    if (timeWindow) {
      metrics = metrics.filter(m => 
        m.startTime >= timeWindow.start && m.startTime <= timeWindow.end
      );
    }
    
    if (service) {
      metrics = metrics.filter(m => m.service === service);
    }
    
    if (operationType) {
      metrics = metrics.filter(m => m.operationType === operationType);
    }

    if (metrics.length === 0) {
      throw new Error('No metrics found for assertion');
    }

    const timeSpan = (Math.max(...metrics.map(m => m.endTime)) - 
                     Math.min(...metrics.map(m => m.startTime))) / 1000;
    const throughput = metrics.length / timeSpan;
    
    if (throughput < minThroughput) {
      throw new Error(
        `Throughput ${throughput.toFixed(2)} ops/sec is below minimum ${minThroughput} ops/sec ` +
        `(${service || 'all services'}, ${operationType || 'all operations'})`
      );
    }
  }

  /**
   * Assert that P95 response time is within threshold
   */
  assertP95ResponseTime(
    threshold: number,
    service?: string,
    operationType?: string,
    timeWindow?: { start: number; end: number }
  ): void {
    const report = this.monitor.getPerformanceReport(timeWindow);
    
    if (report.p95Duration > threshold) {
      throw new Error(
        `P95 response time ${report.p95Duration}ms exceeds threshold ${threshold}ms`
      );
    }
  }

  /**
   * Assert that memory usage growth is within bounds
   */
  assertMemoryUsage(
    maxGrowth: number,
    service?: string,
    operationType?: string,
    timeWindow?: { start: number; end: number }
  ): void {
    const report = this.monitor.getPerformanceReport(timeWindow);
    const memoryGrowth = report.memoryUsage.totalAllocated - report.memoryUsage.totalFreed;
    
    if (memoryGrowth > maxGrowth) {
      throw new Error(
        `Memory growth ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(maxGrowth / 1024 / 1024).toFixed(2)}MB`
      );
    }
  }
}

/**
 * Utility to create performance monitor decorators for services
 */
export function createPerformanceDecorator(monitor: PerformanceMonitor, service: string) {
  return function performanceDecorator(operationType: string, metadata?: Record<string, any>) {
    return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;
      
      descriptor.value = async function(...args: any[]) {
        const operationId = `${service}-${operationType}-${Date.now()}-${Math.random()}`;
        
        return await monitor.trackOperation(
          operationId,
          operationType,
          service,
          () => method.apply(this, args),
          metadata
        );
      };
    };
  };
}