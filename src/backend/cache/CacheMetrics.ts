/**
 * Cache Metrics Collector - Real-time Performance Monitoring
 * Tracks cache performance across all layers with detailed statistics
 */

import { EventEmitter } from 'events';
import { MonitoringConfig, LayerStats, OverallStats } from './MultiLayerCache';

interface MetricEvent {
  layer: string;
  operation: 'hit' | 'miss' | 'set' | 'delete' | 'error' | 'clear';
  timestamp: number;
  latency: number;
  size?: number;
}

interface TimeWindow {
  start: number;
  end: number;
  events: MetricEvent[];
}

/**
 * Advanced Cache Metrics System
 * Features:
 * - Real-time performance tracking
 * - Sliding window statistics
 * - Memory-efficient circular buffer
 * - Alerting thresholds
 * - Performance trend analysis
 */
export class CacheMetrics extends EventEmitter {
  private config: MonitoringConfig;
  private metricsBuffer: Map<string, TimeWindow[]> = new Map();
  private windowSizeMs: number = 300000; // 5 minutes
  private maxWindows: number = 12; // 1 hour of data
  private updateInterval?: ReturnType<typeof setTimeout>;

  // Current statistics
  private currentStats: Map<string, LayerStats> = new Map();

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;

    this.initializeStats();

    if (config.enabled) {
      this.startMetricsCollection();
    }
  }

  /**
   * Record cache hit event
   */
  recordHit(layer: string, latency: number): void {
    this.recordEvent({
      layer,
      operation: 'hit',
      timestamp: Date.now(),
      latency,
    });

    this.updateStats(layer, 'hit', latency);
  }

  /**
   * Record cache miss event
   */
  recordMiss(layer: string, latency: number): void {
    this.recordEvent({
      layer,
      operation: 'miss',
      timestamp: Date.now(),
      latency,
    });

    this.updateStats(layer, 'miss', latency);
  }

  /**
   * Record cache set operation
   */
  recordSet(layer: string, latency: number, size?: number): void {
    this.recordEvent({
      layer,
      operation: 'set',
      timestamp: Date.now(),
      latency,
      size,
    });

    this.updateStats(layer, 'set', latency, size);
  }

  /**
   * Record cache delete operation
   */
  recordDelete(layer: string, latency: number): void {
    this.recordEvent({
      layer,
      operation: 'delete',
      timestamp: Date.now(),
      latency,
    });

    this.updateStats(layer, 'delete', latency);
  }

  /**
   * Record cache error
   */
  recordError(layer: string, latency: number): void {
    this.recordEvent({
      layer,
      operation: 'error',
      timestamp: Date.now(),
      latency,
    });

    this.updateStats(layer, 'error', latency);
  }

  /**
   * Record cache clear operation
   */
  recordClear(latency: number): void {
    this.recordEvent({
      layer: 'ALL',
      operation: 'clear',
      timestamp: Date.now(),
      latency,
    });

    // Reset all stats
    this.currentStats.clear();
    this.initializeStats();
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): {
    l0: LayerStats;
    l1: LayerStats;
    l2: LayerStats;
    overall: OverallStats;
  } {
    const l0 = this.getLayerStats('L0');
    const l1 = this.getLayerStats('L1');
    const l2 = this.getLayerStats('L2');

    const overall = this.calculateOverallStats([l0, l1, l2]);

    return { l0, l1, l2, overall };
  }

  /**
   * Get performance trends over time
   */
  getTrends(
    layer: string,
    windowMinutes: number = 30
  ): {
    hitRate: number[];
    avgLatency: number[];
    errorRate: number[];
    timestamps: number[];
  } {
    const windows = this.metricsBuffer.get(layer) || [];
    const cutoffTime = Date.now() - windowMinutes * 60 * 1000;

    const relevantWindows = windows.filter(w => w.end > cutoffTime);

    const trends = {
      hitRate: [] as number[],
      avgLatency: [] as number[],
      errorRate: [] as number[],
      timestamps: [] as number[],
    };

    relevantWindows.forEach(window => {
      const hits = window.events.filter(e => e.operation === 'hit').length;
      const misses = window.events.filter(e => e.operation === 'miss').length;
      const errors = window.events.filter(e => e.operation === 'error').length;
      const total = hits + misses;

      trends.hitRate.push(total > 0 ? hits / total : 0);
      trends.errorRate.push(total > 0 ? errors / total : 0);

      const latencies = window.events.filter(e => e.operation !== 'error').map(e => e.latency);

      trends.avgLatency.push(
        latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0
      );

      trends.timestamps.push(window.end);
    });

    return trends;
  }

  /**
   * Get alerts based on thresholds
   */
  getAlerts(): Array<{
    type: 'hit_rate' | 'error_rate' | 'latency';
    layer: string;
    severity: 'warning' | 'critical';
    value: number;
    threshold: number;
    message: string;
  }> {
    const alerts: any[] = [];
    const stats = this.getStats();

    // Check hit rate alerts
    Object.entries(stats).forEach(([layer, layerStats]) => {
      if (layer === 'overall') return;

      if (layerStats.hitRate < this.config.alertThresholds.hitRateBelow) {
        alerts.push({
          type: 'hit_rate',
          layer,
          severity: layerStats.hitRate < 0.3 ? 'critical' : 'warning',
          value: layerStats.hitRate,
          threshold: this.config.alertThresholds.hitRateBelow,
          message: `Cache hit rate for ${layer} is ${(layerStats.hitRate * 100).toFixed(1)}%`,
        });
      }

      if (layerStats.avgLatency > this.config.alertThresholds.latencyAbove) {
        alerts.push({
          type: 'latency',
          layer,
          severity: layerStats.avgLatency > 1000 ? 'critical' : 'warning',
          value: layerStats.avgLatency,
          threshold: this.config.alertThresholds.latencyAbove,
          message: `Average latency for ${layer} is ${layerStats.avgLatency}ms`,
        });
      }

      const errorRate =
        layerStats.errors / (layerStats.hits + layerStats.misses + layerStats.errors);
      if (errorRate > this.config.alertThresholds.errorRateAbove) {
        alerts.push({
          type: 'error_rate',
          layer,
          severity: errorRate > 0.1 ? 'critical' : 'warning',
          value: errorRate,
          threshold: this.config.alertThresholds.errorRateAbove,
          message: `Error rate for ${layer} is ${(errorRate * 100).toFixed(1)}%`,
        });
      }
    });

    return alerts;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metricsBuffer.clear();
    this.currentStats.clear();
    this.initializeStats();
    this.emit('reset');
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.emit('stopped');
  }

  /**
   * Export metrics data for external analysis
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      stats: this.getStats(),
      alerts: this.getAlerts(),
      trends: {
        L0: this.getTrends('L0'),
        L1: this.getTrends('L1'),
        L2: this.getTrends('L2'),
      },
      exportedAt: new Date().toISOString(),
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV format (simplified)
    const stats = data.stats;
    const csvRows = [
      'Layer,Hits,Misses,HitRate,AvgLatency,Errors,CurrentSize,MaxSize',
      `L0,${stats.l0.hits},${stats.l0.misses},${stats.l0.hitRate.toFixed(3)},${stats.l0.avgLatency.toFixed(2)},${stats.l0.errors},${stats.l0.currentSize},${stats.l0.maxSize}`,
      `L1,${stats.l1.hits},${stats.l1.misses},${stats.l1.hitRate.toFixed(3)},${stats.l1.avgLatency.toFixed(2)},${stats.l1.errors},${stats.l1.currentSize},${stats.l1.maxSize}`,
      `L2,${stats.l2.hits},${stats.l2.misses},${stats.l2.hitRate.toFixed(3)},${stats.l2.avgLatency.toFixed(2)},${stats.l2.errors},${stats.l2.currentSize},${stats.l2.maxSize}`,
    ];

    return csvRows.join('\n');
  }

  // Private Methods

  private recordEvent(event: MetricEvent): void {
    if (!this.config.enabled) return;

    const layerBuffers = this.metricsBuffer.get(event.layer) || [];

    // Find or create current window
    let currentWindow = layerBuffers[layerBuffers.length - 1];
    if (!currentWindow || event.timestamp >= currentWindow.end) {
      currentWindow = {
        start: event.timestamp,
        end: event.timestamp + this.windowSizeMs,
        events: [],
      };
      layerBuffers.push(currentWindow);

      // Maintain buffer size
      if (layerBuffers.length > this.maxWindows) {
        layerBuffers.shift();
      }
    }

    currentWindow.events.push(event);
    this.metricsBuffer.set(event.layer, layerBuffers);

    this.emit('event', event);
  }

  private updateStats(layer: string, operation: string, latency: number, size?: number): void {
    let stats = this.currentStats.get(layer);
    if (!stats) {
      stats = this.createEmptyStats();
      this.currentStats.set(layer, stats);
    }

    switch (operation) {
      case 'hit':
        stats.hits++;
        break;
      case 'miss':
        stats.misses++;
        break;
      case 'set':
        stats.sets++;
        if (size) {
          stats.currentSize += size;
        }
        break;
      case 'delete':
        stats.deletes++;
        break;
      case 'error':
        stats.errors++;
        break;
    }

    // Update running averages
    const totalOps = stats.hits + stats.misses + stats.sets + stats.deletes + stats.errors;
    stats.avgLatency = (stats.avgLatency * (totalOps - 1) + latency) / totalOps;
    stats.hitRate = stats.hits / (stats.hits + stats.misses + 0.001); // Avoid division by zero

    this.currentStats.set(layer, stats);
  }

  private getLayerStats(layer: string): LayerStats {
    return this.currentStats.get(layer) || this.createEmptyStats();
  }

  private calculateOverallStats(layerStats: LayerStats[]): OverallStats {
    const totals = layerStats.reduce(
      (acc, stats) => ({
        hits: acc.hits + stats.hits,
        misses: acc.misses + stats.misses,
        sets: acc.sets + stats.sets,
        deletes: acc.deletes + stats.deletes,
        errors: acc.errors + stats.errors,
        latencySum:
          acc.latencySum +
          stats.avgLatency * (stats.hits + stats.misses + stats.sets + stats.deletes),
        operations: acc.operations + stats.hits + stats.misses + stats.sets + stats.deletes,
        memoryUsage: acc.memoryUsage + stats.currentSize,
      }),
      {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        latencySum: 0,
        operations: 0,
        memoryUsage: 0,
      }
    );

    return {
      totalHits: totals.hits,
      totalMisses: totals.misses,
      overallHitRate: totals.hits / (totals.hits + totals.misses + 0.001),
      avgResponseTime: totals.operations > 0 ? totals.latencySum / totals.operations : 0,
      memoryUsage: totals.memoryUsage,
      errorRate: totals.errors / (totals.operations + totals.errors + 0.001),
    };
  }

  private createEmptyStats(): LayerStats {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      avgLatency: 0,
      currentSize: 0,
      maxSize: 0,
    };
  }

  private initializeStats(): void {
    this.currentStats.set('L0', this.createEmptyStats());
    this.currentStats.set('L1', this.createEmptyStats());
    this.currentStats.set('L2', this.createEmptyStats());
  }

  private startMetricsCollection(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.cleanupOldWindows();
      this.emit('metrics-updated', this.getStats());
    }, this.config.metricsInterval);
  }

  private cleanupOldWindows(): void {
    const cutoffTime = Date.now() - this.maxWindows * this.windowSizeMs;

    this.metricsBuffer.forEach((windows, layer) => {
      const filtered = windows.filter(w => w.end > cutoffTime);
      if (filtered.length !== windows.length) {
        this.metricsBuffer.set(layer, filtered);
      }
    });
  }
}
