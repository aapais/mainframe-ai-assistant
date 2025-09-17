/**
 * Memory Leak Detector
 * Monitors memory usage patterns and detects potential leaks
 * Target: <10MB/hour growth rate
 */

import { EventEmitter } from 'events';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  processId: number;
}

export interface MemoryLeak {
  type: 'gradual' | 'sudden' | 'oscillating';
  detected: number;
  startSnapshot: MemorySnapshot;
  endSnapshot: MemorySnapshot;
  growthRate: number; // MB/hour
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  possibleCauses: string[];
}

export interface MemoryAnalysis {
  currentUsage: MemorySnapshot;
  growthRate: number; // MB/hour
  trend: 'stable' | 'growing' | 'shrinking' | 'oscillating';
  targetMet: boolean; // < 10MB/hour target
  detectedLeaks: MemoryLeak[];
  recommendations: string[];
}

export class MemoryLeakDetector extends EventEmitter {
  private snapshots: MemorySnapshot[] = [];
  private detectedLeaks: MemoryLeak[] = [];
  private monitoringInterval: ReturnType<typeof setTimeout> | null = null;
  private isMonitoring = false;

  private targetGrowthRate = 10; // 10MB per hour
  private snapshotInterval = 30000; // 30 seconds
  private maxSnapshots = 2880; // 24 hours of 30-second snapshots
  private leakDetectionThreshold = 2; // 2x target growth rate

  constructor(options?: {
    targetGrowthRate?: number;
    snapshotInterval?: number;
    maxSnapshots?: number;
    leakDetectionThreshold?: number;
  }) {
    super();

    if (options) {
      this.targetGrowthRate = options.targetGrowthRate ?? this.targetGrowthRate;
      this.snapshotInterval = options.snapshotInterval ?? this.snapshotInterval;
      this.maxSnapshots = options.maxSnapshots ?? this.maxSnapshots;
      this.leakDetectionThreshold = options.leakDetectionThreshold ?? this.leakDetectionThreshold;
    }
  }

  /**
   * Start memory monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Memory leak detection already started');
      return;
    }

    this.isMonitoring = true;
    this.takeSnapshot(); // Initial snapshot

    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
      this.analyzeMemoryUsage();
      this.detectLeaks();
    }, this.snapshotInterval);

    this.emit('monitoring-started');
    console.log('Memory leak detection started');
  }

  /**
   * Stop memory monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring-stopped');
    console.log('Memory leak detection stopped');
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): void {
    const memoryUsage = process.memoryUsage();

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      processId: process.pid
    };

    this.snapshots.push(snapshot);

    // Keep snapshots within limit
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-Math.floor(this.maxSnapshots * 0.9));
    }

    this.emit('snapshot-taken', snapshot);
  }

  /**
   * Analyze current memory usage
   */
  private analyzeMemoryUsage(): void {
    if (this.snapshots.length < 2) return;

    const current = this.snapshots[this.snapshots.length - 1];
    const growthRate = this.calculateGrowthRate();
    const trend = this.analyzeTrend();

    const analysis: MemoryAnalysis = {
      currentUsage: current,
      growthRate,
      trend,
      targetMet: growthRate <= this.targetGrowthRate,
      detectedLeaks: [...this.detectedLeaks],
      recommendations: this.generateRecommendations(growthRate, trend)
    };

    this.emit('memory-analysis', analysis);

    // Check for threshold violations
    if (!analysis.targetMet) {
      this.emit('threshold-violation', {
        type: 'memory-growth-rate',
        value: growthRate,
        target: this.targetGrowthRate,
        message: `Memory growth rate ${growthRate.toFixed(2)}MB/h exceeds target of ${this.targetGrowthRate}MB/h`
      });
    }
  }

  /**
   * Calculate memory growth rate in MB/hour
   */
  private calculateGrowthRate(periodHours = 1): number {
    if (this.snapshots.length < 2) return 0;

    const now = Date.now();
    const periodMs = periodHours * 60 * 60 * 1000;
    const cutoff = now - periodMs;

    const recentSnapshots = this.snapshots.filter(s => s.timestamp >= cutoff);
    if (recentSnapshots.length < 2) return 0;

    const oldest = recentSnapshots[0];
    const newest = recentSnapshots[recentSnapshots.length - 1];

    const timeDiffHours = (newest.timestamp - oldest.timestamp) / 1000 / 3600;
    if (timeDiffHours === 0) return 0;

    const memoryDiffMB = (newest.heapUsed - oldest.heapUsed) / 1024 / 1024;
    return memoryDiffMB / timeDiffHours;
  }

  /**
   * Analyze memory usage trend
   */
  private analyzeTrend(): 'stable' | 'growing' | 'shrinking' | 'oscillating' {
    if (this.snapshots.length < 10) return 'stable';

    const recent = this.snapshots.slice(-10);
    const values = recent.map(s => s.heapUsed);

    // Calculate trend using linear regression
    const n = values.length;
    const sumX = (n - 1) * n / 2; // Sum of indices 0..n-1
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = sumX * (2 * n - 1) / 3; // Sum of squares 0^2...(n-1)^2

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Check for oscillation
    let direction = 0;
    let changes = 0;
    for (let i = 1; i < values.length; i++) {
      const currentDirection = values[i] > values[i - 1] ? 1 : -1;
      if (direction !== 0 && direction !== currentDirection) {
        changes++;
      }
      direction = currentDirection;
    }

    if (changes > values.length / 2) {
      return 'oscillating';
    }

    const threshold = 1024 * 1024; // 1MB threshold
    if (Math.abs(slope) < threshold) {
      return 'stable';
    }

    return slope > 0 ? 'growing' : 'shrinking';
  }

  /**
   * Detect memory leaks
   */
  private detectLeaks(): void {
    const growthRate = this.calculateGrowthRate();

    // Gradual leak detection
    if (growthRate > this.targetGrowthRate * this.leakDetectionThreshold) {
      this.detectGradualLeak(growthRate);
    }

    // Sudden spike detection
    this.detectSuddenSpikes();

    // Oscillating memory pattern detection
    this.detectOscillatingPatterns();
  }

  /**
   * Detect gradual memory leaks
   */
  private detectGradualLeak(growthRate: number): void {
    if (this.snapshots.length < 20) return;

    const recent = this.snapshots.slice(-20);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    // Check if this is a new leak or continuation of existing
    const existingLeak = this.detectedLeaks.find(leak =>
      leak.type === 'gradual' &&
      Date.now() - leak.detected < 3600000 // Within last hour
    );

    if (!existingLeak) {
      const leak: MemoryLeak = {
        type: 'gradual',
        detected: Date.now(),
        startSnapshot: oldest,
        endSnapshot: newest,
        growthRate,
        severity: this.calculateSeverity(growthRate),
        description: `Gradual memory leak detected with growth rate of ${growthRate.toFixed(2)}MB/h`,
        possibleCauses: [
          'Event listeners not properly removed',
          'Closures holding references to large objects',
          'Cache not being cleared periodically',
          'Timers or intervals not being cleared',
          'DOM nodes not being garbage collected'
        ]
      };

      this.detectedLeaks.push(leak);
      this.emit('leak-detected', leak);
    }
  }

  /**
   * Detect sudden memory spikes
   */
  private detectSuddenSpikes(): void {
    if (this.snapshots.length < 5) return;

    const recent = this.snapshots.slice(-5);
    const baseline = recent.slice(0, -1).reduce((sum, s) => sum + s.heapUsed, 0) / 4;
    const current = recent[recent.length - 1].heapUsed;

    const spike = (current - baseline) / 1024 / 1024; // MB

    if (spike > 50) { // 50MB sudden increase
      const leak: MemoryLeak = {
        type: 'sudden',
        detected: Date.now(),
        startSnapshot: recent[0],
        endSnapshot: recent[recent.length - 1],
        growthRate: spike * 3600, // Convert to per-hour rate
        severity: spike > 200 ? 'critical' : spike > 100 ? 'high' : 'medium',
        description: `Sudden memory spike of ${spike.toFixed(2)}MB detected`,
        possibleCauses: [
          'Large data structure loaded into memory',
          'Memory buffer not released',
          'Recursive function causing stack overflow',
          'Large file loaded without streaming',
          'Memory allocation bug'
        ]
      };

      this.detectedLeaks.push(leak);
      this.emit('leak-detected', leak);
    }
  }

  /**
   * Detect oscillating memory patterns (potential inefficient GC)
   */
  private detectOscillatingPatterns(): void {
    if (this.snapshots.length < 20) return;

    const recent = this.snapshots.slice(-20);
    const values = recent.map(s => s.heapUsed);

    // Detect oscillation
    let peaks = 0;
    let valleys = 0;

    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks++;
      } else if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
        valleys++;
      }
    }

    const oscillationRatio = (peaks + valleys) / values.length;

    if (oscillationRatio > 0.3) { // More than 30% oscillation
      const amplitudeRange = Math.max(...values) - Math.min(...values);
      const amplitudeMB = amplitudeRange / 1024 / 1024;

      if (amplitudeMB > 20) { // Significant oscillation
        const leak: MemoryLeak = {
          type: 'oscillating',
          detected: Date.now(),
          startSnapshot: recent[0],
          endSnapshot: recent[recent.length - 1],
          growthRate: 0, // Not growing but inefficient
          severity: amplitudeMB > 100 ? 'high' : 'medium',
          description: `Oscillating memory pattern detected with ${amplitudeMB.toFixed(2)}MB amplitude`,
          possibleCauses: [
            'Inefficient garbage collection',
            'Frequent allocation/deallocation cycles',
            'Memory fragmentation',
            'Inefficient data structure usage',
            'Object pooling issues'
          ]
        };

        this.detectedLeaks.push(leak);
        this.emit('leak-detected', leak);
      }
    }
  }

  /**
   * Calculate leak severity
   */
  private calculateSeverity(growthRate: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = growthRate / this.targetGrowthRate;

    if (ratio > 10) return 'critical';
    if (ratio > 5) return 'high';
    if (ratio > 2) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(growthRate: number, trend: string): string[] {
    const recommendations: string[] = [];

    if (growthRate > this.targetGrowthRate) {
      recommendations.push('Memory growth rate exceeds target - investigate for memory leaks');
    }

    switch (trend) {
      case 'growing':
        recommendations.push('Memory usage is steadily growing - check for unreleased resources');
        recommendations.push('Review event listeners and ensure proper cleanup');
        recommendations.push('Check for accumulating caches or arrays');
        break;

      case 'oscillating':
        recommendations.push('Memory usage is oscillating - consider optimizing GC pressure');
        recommendations.push('Review object allocation patterns');
        recommendations.push('Consider object pooling for frequently created objects');
        break;

      case 'stable':
        if (growthRate > 0) {
          recommendations.push('Memory usage appears stable but with slight growth - monitor closely');
        }
        break;
    }

    if (this.detectedLeaks.length > 0) {
      recommendations.push('Memory leaks detected - review leak details and address root causes');
    }

    return recommendations;
  }

  /**
   * Get memory snapshots
   */
  public getSnapshots(count?: number): MemorySnapshot[] {
    if (!count) return [...this.snapshots];
    return this.snapshots.slice(-count);
  }

  /**
   * Get detected leaks
   */
  public getDetectedLeaks(): MemoryLeak[] {
    return [...this.detectedLeaks];
  }

  /**
   * Get current memory analysis
   */
  public getCurrentAnalysis(): MemoryAnalysis | null {
    if (this.snapshots.length === 0) return null;

    const current = this.snapshots[this.snapshots.length - 1];
    const growthRate = this.calculateGrowthRate();
    const trend = this.analyzeTrend();

    return {
      currentUsage: current,
      growthRate,
      trend,
      targetMet: growthRate <= this.targetGrowthRate,
      detectedLeaks: [...this.detectedLeaks],
      recommendations: this.generateRecommendations(growthRate, trend)
    };
  }

  /**
   * Get memory usage summary
   */
  public getMemorySummary(): {
    currentUsageMB: number;
    peakUsageMB: number;
    averageUsageMB: number;
    growthRate: number;
    leaksDetected: number;
    uptimeHours: number;
  } {
    if (this.snapshots.length === 0) {
      return {
        currentUsageMB: 0,
        peakUsageMB: 0,
        averageUsageMB: 0,
        growthRate: 0,
        leaksDetected: 0,
        uptimeHours: 0
      };
    }

    const current = this.snapshots[this.snapshots.length - 1];
    const heapValues = this.snapshots.map(s => s.heapUsed);

    const currentUsageMB = current.heapUsed / 1024 / 1024;
    const peakUsageMB = Math.max(...heapValues) / 1024 / 1024;
    const averageUsageMB = heapValues.reduce((sum, val) => sum + val, 0) / heapValues.length / 1024 / 1024;
    const growthRate = this.calculateGrowthRate();
    const leaksDetected = this.detectedLeaks.length;
    const uptimeHours = (current.timestamp - this.snapshots[0].timestamp) / 1000 / 3600;

    return {
      currentUsageMB,
      peakUsageMB,
      averageUsageMB,
      growthRate,
      leaksDetected,
      uptimeHours
    };
  }

  /**
   * Force garbage collection (if available)
   */
  public forceGC(): boolean {
    if (global.gc) {
      global.gc();
      this.takeSnapshot();
      this.emit('gc-forced');
      return true;
    }
    return false;
  }

  /**
   * Clear old leak records
   */
  public clearOldLeaks(olderThanHours = 24): number {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    const initialCount = this.detectedLeaks.length;

    this.detectedLeaks = this.detectedLeaks.filter(leak => leak.detected >= cutoff);

    const removedCount = initialCount - this.detectedLeaks.length;
    if (removedCount > 0) {
      this.emit('leaks-cleared', removedCount);
    }

    return removedCount;
  }

  /**
   * Export memory data
   */
  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'timestamp', 'heapUsed', 'heapTotal', 'external', 'rss', 'arrayBuffers'
      ];

      const rows = this.snapshots.map(s => [
        s.timestamp,
        s.heapUsed,
        s.heapTotal,
        s.external,
        s.rss,
        s.arrayBuffers
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify({
      snapshots: this.snapshots,
      detectedLeaks: this.detectedLeaks,
      analysis: this.getCurrentAnalysis(),
      summary: this.getMemorySummary()
    }, null, 2);
  }

  /**
   * Reset all data
   */
  public reset(): void {
    this.snapshots = [];
    this.detectedLeaks = [];
    this.emit('data-reset');
  }
}

export default MemoryLeakDetector;