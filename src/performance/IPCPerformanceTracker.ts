/**
 * IPC Performance Tracker
 * Monitors Inter-Process Communication performance between main and renderer
 * Target: <5ms round-trip time
 */

import { EventEmitter } from 'events';
import { ipcMain, ipcRenderer } from 'electron';

export interface IPCPerformanceMetrics {
  channel: string;
  direction: 'main-to-renderer' | 'renderer-to-main' | 'round-trip';
  startTime: number;
  endTime: number;
  latency: number;
  isTargetMet: boolean; // < 5ms target
  dataSize: number; // bytes
  messageType: 'request' | 'response' | 'event';
  payload?: any;
  errorOccurred: boolean;
  errorMessage?: string;
}

export interface IPCChannelStats {
  channel: string;
  totalMessages: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  targetMeetRate: number;
  errorRate: number;
  totalDataTransferred: number;
}

export class IPCPerformanceTracker extends EventEmitter {
  private metrics: IPCPerformanceMetrics[] = [];
  private activeRequests: Map<string, Partial<IPCPerformanceMetrics>> = new Map();
  private targetLatency = 5; // 5ms target
  private maxHistorySize = 5000;
  private isMainProcess: boolean;

  constructor(targetLatency = 5) {
    super();
    this.targetLatency = targetLatency;
    this.isMainProcess = process.type === 'browser';

    if (this.isMainProcess) {
      this.setupMainProcessTracking();
    } else {
      this.setupRendererProcessTracking();
    }
  }

  /**
   * Track IPC request start
   */
  public trackIPCStart(
    channel: string,
    direction: 'main-to-renderer' | 'renderer-to-main' | 'round-trip',
    messageType: 'request' | 'response' | 'event' = 'request',
    payload?: any
  ): string {
    const requestId = `ipc-${channel}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    const dataSize = this.calculateDataSize(payload);

    const metrics: Partial<IPCPerformanceMetrics> = {
      channel,
      direction,
      startTime,
      messageType,
      dataSize,
      payload: this.shouldIncludePayload(payload) ? payload : '[payload-excluded]',
      errorOccurred: false
    };

    this.activeRequests.set(requestId, metrics);
    return requestId;
  }

  /**
   * Track IPC request end
   */
  public trackIPCEnd(requestId: string, error?: string): IPCPerformanceMetrics | null {
    const requestData = this.activeRequests.get(requestId);

    if (!requestData) {
      console.warn('IPC tracking ID not found:', requestId);
      return null;
    }

    const endTime = performance.now();
    const latency = endTime - (requestData.startTime || 0);

    const metrics: IPCPerformanceMetrics = {
      channel: requestData.channel || '',
      direction: requestData.direction || 'round-trip',
      startTime: requestData.startTime || 0,
      endTime,
      latency,
      isTargetMet: latency <= this.targetLatency,
      dataSize: requestData.dataSize || 0,
      messageType: requestData.messageType || 'request',
      payload: requestData.payload,
      errorOccurred: !!error,
      errorMessage: error
    };

    this.activeRequests.delete(requestId);
    this.metrics.push(metrics);

    // Emit events
    this.emit('ipc-completed', metrics);

    if (!metrics.isTargetMet) {
      this.emit('performance-violation', {
        type: 'ipc-latency',
        channel: metrics.channel,
        latency: metrics.latency,
        target: this.targetLatency,
        message: `IPC channel "${metrics.channel}" latency ${latency.toFixed(2)}ms exceeds target of ${this.targetLatency}ms`
      });
    }

    if (metrics.errorOccurred) {
      this.emit('ipc-error', {
        channel: metrics.channel,
        error: metrics.errorMessage,
        latency: metrics.latency
      });
    }

    // Keep history size manageable
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-Math.floor(this.maxHistorySize * 0.8));
    }

    return metrics;
  }

  /**
   * Setup main process IPC tracking
   */
  private setupMainProcessTracking(): void {
    if (!ipcMain) return;

    // Track all IPC handles
    const originalHandle = ipcMain.handle.bind(ipcMain);
    ipcMain.handle = (channel: string, listener: any) => {
      return originalHandle(channel, async (event, ...args) => {
        const requestId = this.trackIPCStart(channel, 'renderer-to-main', 'request', args);

        try {
          const result = await listener(event, ...args);
          this.trackIPCEnd(requestId);
          return result;
        } catch (error) {
          this.trackIPCEnd(requestId, error instanceof Error ? error.message : String(error));
          throw error;
        }
      });
    };

    // Track IPC sends
    const originalSend = ipcMain.emit.bind(ipcMain);
    ipcMain.emit = (channel: string, ...args: any[]) => {
      const requestId = this.trackIPCStart(channel, 'main-to-renderer', 'event', args);
      const result = originalSend(channel, ...args);

      // End tracking immediately for events (no response expected)
      setImmediate(() => {
        this.trackIPCEnd(requestId);
      });

      return result;
    };
  }

  /**
   * Setup renderer process IPC tracking
   */
  private setupRendererProcessTracking(): void {
    if (!ipcRenderer) return;

    // Track IPC invokes
    const originalInvoke = ipcRenderer.invoke.bind(ipcRenderer);
    ipcRenderer.invoke = async (channel: string, ...args: any[]) => {
      const requestId = this.trackIPCStart(channel, 'renderer-to-main', 'request', args);

      try {
        const result = await originalInvoke(channel, ...args);
        this.trackIPCEnd(requestId);
        return result;
      } catch (error) {
        this.trackIPCEnd(requestId, error instanceof Error ? error.message : String(error));
        throw error;
      }
    };

    // Track IPC sends
    const originalSend = ipcRenderer.send.bind(ipcRenderer);
    ipcRenderer.send = (channel: string, ...args: any[]) => {
      const requestId = this.trackIPCStart(channel, 'renderer-to-main', 'event', args);
      const result = originalSend(channel, ...args);

      // End tracking immediately for sends (no response expected)
      setImmediate(() => {
        this.trackIPCEnd(requestId);
      });

      return result;
    };

    // Track IPC responses
    const originalOn = ipcRenderer.on.bind(ipcRenderer);
    ipcRenderer.on = (channel: string, listener: any) => {
      return originalOn(channel, (event, ...args) => {
        const requestId = this.trackIPCStart(channel, 'main-to-renderer', 'response', args);

        try {
          const result = listener(event, ...args);
          this.trackIPCEnd(requestId);
          return result;
        } catch (error) {
          this.trackIPCEnd(requestId, error instanceof Error ? error.message : String(error));
          throw error;
        }
      });
    };
  }

  /**
   * Calculate data size of payload
   */
  private calculateDataSize(payload: any): number {
    if (!payload) return 0;

    try {
      return JSON.stringify(payload).length * 2; // Rough estimate (UTF-16)
    } catch (error) {
      return 0;
    }
  }

  /**
   * Determine if payload should be included in metrics
   */
  private shouldIncludePayload(payload: any): boolean {
    if (!payload) return true;

    const size = this.calculateDataSize(payload);
    return size < 1024; // Include payloads smaller than 1KB
  }

  /**
   * Get IPC performance metrics
   */
  public getMetrics(count?: number): IPCPerformanceMetrics[] {
    if (!count) return [...this.metrics];
    return this.metrics.slice(-count);
  }

  /**
   * Get metrics by channel
   */
  public getMetricsByChannel(channel: string): IPCPerformanceMetrics[] {
    return this.metrics.filter(m => m.channel === channel);
  }

  /**
   * Get channel statistics
   */
  public getChannelStats(): IPCChannelStats[] {
    const channelMap = new Map<string, IPCPerformanceMetrics[]>();

    // Group metrics by channel
    this.metrics.forEach(metric => {
      const existing = channelMap.get(metric.channel);
      if (existing) {
        existing.push(metric);
      } else {
        channelMap.set(metric.channel, [metric]);
      }
    });

    // Calculate stats for each channel
    return Array.from(channelMap.entries()).map(([channel, metrics]) => {
      const totalMessages = metrics.length;
      const averageLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / totalMessages;
      const minLatency = Math.min(...metrics.map(m => m.latency));
      const maxLatency = Math.max(...metrics.map(m => m.latency));
      const targetMeets = metrics.filter(m => m.isTargetMet).length;
      const errors = metrics.filter(m => m.errorOccurred).length;
      const totalDataTransferred = metrics.reduce((sum, m) => sum + m.dataSize, 0);

      return {
        channel,
        totalMessages,
        averageLatency,
        minLatency,
        maxLatency,
        targetMeetRate: targetMeets / totalMessages,
        errorRate: errors / totalMessages,
        totalDataTransferred
      };
    });
  }

  /**
   * Get slow IPC operations (above target)
   */
  public getSlowOperations(): IPCPerformanceMetrics[] {
    return this.metrics.filter(m => !m.isTargetMet);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    totalOperations: number;
    averageLatency: number;
    targetMeetRate: number;
    errorRate: number;
    totalDataTransferred: number;
    slowestOperation: IPCPerformanceMetrics | null;
    fastestOperation: IPCPerformanceMetrics | null;
    topChannelsByVolume: { channel: string; count: number }[];
    topChannelsByLatency: { channel: string; averageLatency: number }[];
  } {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageLatency: 0,
        targetMeetRate: 0,
        errorRate: 0,
        totalDataTransferred: 0,
        slowestOperation: null,
        fastestOperation: null,
        topChannelsByVolume: [],
        topChannelsByLatency: []
      };
    }

    const totalOperations = this.metrics.length;
    const averageLatency = this.metrics.reduce((sum, m) => sum + m.latency, 0) / totalOperations;
    const targetMeets = this.metrics.filter(m => m.isTargetMet).length;
    const errors = this.metrics.filter(m => m.errorOccurred).length;
    const totalDataTransferred = this.metrics.reduce((sum, m) => sum + m.dataSize, 0);

    const slowestOperation = this.metrics.reduce((slowest, current) =>
      !slowest || current.latency > slowest.latency ? current : slowest);

    const fastestOperation = this.metrics.reduce((fastest, current) =>
      !fastest || current.latency < fastest.latency ? current : fastest);

    const channelStats = this.getChannelStats();
    const topChannelsByVolume = channelStats
      .sort((a, b) => b.totalMessages - a.totalMessages)
      .slice(0, 5)
      .map(stat => ({ channel: stat.channel, count: stat.totalMessages }));

    const topChannelsByLatency = channelStats
      .sort((a, b) => b.averageLatency - a.averageLatency)
      .slice(0, 5)
      .map(stat => ({ channel: stat.channel, averageLatency: stat.averageLatency }));

    return {
      totalOperations,
      averageLatency,
      targetMeetRate: targetMeets / totalOperations,
      errorRate: errors / totalOperations,
      totalDataTransferred,
      slowestOperation,
      fastestOperation,
      topChannelsByVolume,
      topChannelsByLatency
    };
  }

  /**
   * Get latency distribution
   */
  public getLatencyDistribution(): {
    buckets: { range: string; count: number; percentage: number }[];
    percentiles: { p50: number; p90: number; p95: number; p99: number };
  } {
    if (this.metrics.length === 0) {
      return {
        buckets: [],
        percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 }
      };
    }

    const latencies = this.metrics.map(m => m.latency).sort((a, b) => a - b);

    // Create buckets
    const bucketRanges = [
      { min: 0, max: 1, label: '0-1ms' },
      { min: 1, max: 2, label: '1-2ms' },
      { min: 2, max: 5, label: '2-5ms' },
      { min: 5, max: 10, label: '5-10ms' },
      { min: 10, max: 25, label: '10-25ms' },
      { min: 25, max: 50, label: '25-50ms' },
      { min: 50, max: 100, label: '50-100ms' },
      { min: 100, max: Infinity, label: '100ms+' }
    ];

    const buckets = bucketRanges.map(range => {
      const count = latencies.filter(latency => latency >= range.min && latency < range.max).length;
      return {
        range: range.label,
        count,
        percentage: (count / latencies.length) * 100
      };
    });

    // Calculate percentiles
    const percentiles = {
      p50: latencies[Math.floor(latencies.length * 0.5)],
      p90: latencies[Math.floor(latencies.length * 0.9)],
      p95: latencies[Math.floor(latencies.length * 0.95)],
      p99: latencies[Math.floor(latencies.length * 0.99)]
    };

    return { buckets, percentiles };
  }

  /**
   * Export IPC performance data
   */
  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'channel', 'direction', 'startTime', 'endTime', 'latency',
        'isTargetMet', 'dataSize', 'messageType', 'errorOccurred', 'errorMessage'
      ];

      const rows = this.metrics.map(m => [
        m.channel,
        m.direction,
        m.startTime,
        m.endTime,
        m.latency,
        m.isTargetMet,
        m.dataSize,
        m.messageType,
        m.errorOccurred,
        m.errorMessage || ''
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify({
      metrics: this.metrics,
      channelStats: this.getChannelStats(),
      summary: this.getPerformanceSummary(),
      latencyDistribution: this.getLatencyDistribution()
    }, null, 2);
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics = [];
    this.activeRequests.clear();
    this.emit('metrics-reset');
  }

  /**
   * Set target latency
   */
  public setTargetLatency(targetMs: number): void {
    this.targetLatency = targetMs;
    this.emit('target-updated', targetMs);
  }

  /**
   * Get current target latency
   */
  public getTargetLatency(): number {
    return this.targetLatency;
  }
}

export default IPCPerformanceTracker;