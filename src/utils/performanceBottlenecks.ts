/**
 * Performance Bottleneck Identification System
 *
 * Advanced algorithms to identify, analyze, and provide solutions
 * for React component performance bottlenecks
 */

import { RenderMetrics, PerformanceStore } from '../hooks/useReactProfiler';
import {
  PerformanceBatch,
  ComponentHealthScore,
  MemoryMetric,
} from '../hooks/usePerformanceMonitoring';

// =========================
// TYPES AND INTERFACES
// =========================

export interface BottleneckIdentification {
  id: string;
  type: 'render' | 'memory' | 'interaction' | 'state' | 'effect' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  componentName: string;
  confidence: number; // 0-100
  impactScore: number; // 0-100
  description: string;
  evidence: Evidence[];
  rootCause: RootCause;
  recommendations: Recommendation[];
  affectedMetrics: string[];
  detectedAt: number;
  occurrenceCount: number;
  trends: {
    isGettingWorse: boolean;
    frequency: 'increasing' | 'decreasing' | 'stable';
    averageImpact: number;
  };
}

export interface Evidence {
  type: 'metric' | 'pattern' | 'correlation' | 'threshold';
  description: string;
  value: number | string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  source?: string;
}

export interface RootCause {
  category:
    | 'component-design'
    | 'state-management'
    | 'rendering'
    | 'memory'
    | 'data-flow'
    | 'external';
  primary: string;
  contributing: string[];
  likelihood: number; // 0-100
  technicalExplanation: string;
  businessImpact: string;
}

export interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  implementation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedImpact: number; // 0-100
  codeExample?: string;
  resources?: string[];
}

export interface BottleneckAnalysisConfig {
  /** Minimum render time to consider for analysis */
  minRenderTime: number;
  /** Time window for trend analysis in milliseconds */
  analysisWindow: number;
  /** Minimum occurrence count to identify pattern */
  minOccurrences: number;
  /** Confidence threshold for reporting */
  confidenceThreshold: number;
  /** Enable memory leak detection */
  enableMemoryAnalysis: boolean;
  /** Enable interaction bottleneck detection */
  enableInteractionAnalysis: boolean;
}

// =========================
// BOTTLENECK ANALYZER CLASS
// =========================

export class PerformanceBottleneckAnalyzer {
  private config: BottleneckAnalysisConfig;
  private detectedBottlenecks: BottleneckIdentification[] = [];
  private analysisHistory: Map<string, BottleneckIdentification[]> = new Map();

  constructor(config: Partial<BottleneckAnalysisConfig> = {}) {
    this.config = {
      minRenderTime: 16,
      analysisWindow: 5 * 60 * 1000, // 5 minutes
      minOccurrences: 3,
      confidenceThreshold: 70,
      enableMemoryAnalysis: true,
      enableInteractionAnalysis: true,
      ...config,
    };
  }

  /**
   * Analyze performance store for bottlenecks
   */
  analyzeStore(store: PerformanceStore): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];

    // Component-level analysis
    const componentGroups = this.groupMetricsByComponent(store.metrics);

    for (const [componentName, metrics] of componentGroups.entries()) {
      // Render performance bottlenecks
      const renderBottlenecks = this.analyzeRenderBottlenecks(componentName, metrics);
      bottlenecks.push(...renderBottlenecks);

      // Re-render frequency bottlenecks
      const reRenderBottlenecks = this.analyzeReRenderPatterns(componentName, metrics);
      bottlenecks.push(...reRenderBottlenecks);

      // Mount/update phase imbalances
      const phaseBottlenecks = this.analyzeMountUpdateImbalance(componentName, metrics);
      bottlenecks.push(...phaseBottlenecks);
    }

    // Store bottlenecks for trend analysis
    this.storeBottlenecks(bottlenecks);

    // Filter by confidence threshold
    const filteredBottlenecks = bottlenecks.filter(
      b => b.confidence >= this.config.confidenceThreshold
    );

    // Sort by impact score
    return filteredBottlenecks.sort((a, b) => b.impactScore - a.impactScore);
  }

  /**
   * Analyze batch performance data
   */
  analyzeBatches(batches: PerformanceBatch[]): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];

    batches.forEach(batch => {
      // Memory bottlenecks
      if (this.config.enableMemoryAnalysis && batch.memoryUsage.length > 0) {
        const memoryBottlenecks = this.analyzeMemoryBottlenecks(batch);
        bottlenecks.push(...memoryBottlenecks);
      }

      // Interaction bottlenecks
      if (this.config.enableInteractionAnalysis && batch.interactions.length > 0) {
        const interactionBottlenecks = this.analyzeInteractionBottlenecks(batch);
        bottlenecks.push(...interactionBottlenecks);
      }

      // Batch performance degradation
      const degradationBottlenecks = this.analyzeBatchDegradation(batch);
      bottlenecks.push(...degradationBottlenecks);
    });

    return bottlenecks;
  }

  // =========================
  // RENDER ANALYSIS METHODS
  // =========================

  private analyzeRenderBottlenecks(
    componentName: string,
    metrics: RenderMetrics[]
  ): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];
    const slowRenders = metrics.filter(m => m.actualDuration > this.config.minRenderTime);

    if (slowRenders.length < this.config.minOccurrences) return bottlenecks;

    const avgRenderTime =
      slowRenders.reduce((sum, m) => sum + m.actualDuration, 0) / slowRenders.length;
    const maxRenderTime = Math.max(...slowRenders.map(m => m.actualDuration));
    const renderTimeVariance = this.calculateVariance(slowRenders.map(m => m.actualDuration));

    // High variance indicates inconsistent performance
    if (renderTimeVariance > avgRenderTime * 0.5) {
      bottlenecks.push({
        id: `inconsistent-render-${componentName}-${Date.now()}`,
        type: 'render',
        severity: this.getSeverityFromRenderTime(avgRenderTime),
        componentName,
        confidence: 85,
        impactScore: this.calculateImpactScore(avgRenderTime, slowRenders.length),
        description: 'Inconsistent render performance detected',
        evidence: [
          {
            type: 'metric',
            description: 'High render time variance',
            value: renderTimeVariance.toFixed(2),
            severity: 'warning',
            timestamp: Date.now(),
          },
          {
            type: 'metric',
            description: 'Average render time',
            value: avgRenderTime.toFixed(2),
            severity: avgRenderTime > 32 ? 'critical' : 'warning',
            timestamp: Date.now(),
          },
        ],
        rootCause: this.identifyRenderRootCause(metrics, 'inconsistent'),
        recommendations: this.generateRenderRecommendations('inconsistent', avgRenderTime),
        affectedMetrics: ['actualDuration', 'baseDuration'],
        detectedAt: Date.now(),
        occurrenceCount: slowRenders.length,
        trends: this.analyzeTrends(metrics),
      });
    }

    // Consistently slow renders
    if (avgRenderTime > this.config.minRenderTime * 1.5) {
      bottlenecks.push({
        id: `slow-render-${componentName}-${Date.now()}`,
        type: 'render',
        severity: this.getSeverityFromRenderTime(avgRenderTime),
        componentName,
        confidence: 90,
        impactScore: this.calculateImpactScore(avgRenderTime, metrics.length),
        description: 'Consistently slow render performance',
        evidence: [
          {
            type: 'metric',
            description: 'Average render time exceeds threshold',
            value: avgRenderTime.toFixed(2),
            severity: avgRenderTime > 50 ? 'critical' : 'warning',
            timestamp: Date.now(),
          },
          {
            type: 'threshold',
            description: 'Slow render occurrence rate',
            value: `${((slowRenders.length / metrics.length) * 100).toFixed(1)}%`,
            severity: 'warning',
            timestamp: Date.now(),
          },
        ],
        rootCause: this.identifyRenderRootCause(metrics, 'slow'),
        recommendations: this.generateRenderRecommendations('slow', avgRenderTime),
        affectedMetrics: ['actualDuration'],
        detectedAt: Date.now(),
        occurrenceCount: slowRenders.length,
        trends: this.analyzeTrends(metrics),
      });
    }

    return bottlenecks;
  }

  private analyzeReRenderPatterns(
    componentName: string,
    metrics: RenderMetrics[]
  ): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];
    const timeWindow = 5000; // 5 seconds
    const now = Date.now();

    // Group renders by time windows
    const timeGroups = new Map<number, RenderMetrics[]>();

    metrics.forEach(metric => {
      const windowStart = Math.floor((now - metric.timestamp) / timeWindow) * timeWindow;
      if (!timeGroups.has(windowStart)) {
        timeGroups.set(windowStart, []);
      }
      timeGroups.get(windowStart)!.push(metric);
    });

    // Find windows with excessive re-renders
    const excessiveWindows = Array.from(timeGroups.entries())
      .filter(([_, windowMetrics]) => windowMetrics.length > 10)
      .sort((a, b) => b[1].length - a[1].length);

    if (excessiveWindows.length > 0) {
      const [_, worstWindow] = excessiveWindows[0];

      bottlenecks.push({
        id: `excessive-rerenders-${componentName}-${Date.now()}`,
        type: 'render',
        severity: 'high',
        componentName,
        confidence: 95,
        impactScore: Math.min(100, worstWindow.length * 5),
        description: 'Excessive re-renders detected',
        evidence: [
          {
            type: 'pattern',
            description: 'High frequency re-renders',
            value: `${worstWindow.length} renders in ${timeWindow / 1000}s`,
            severity: 'critical',
            timestamp: Date.now(),
          },
          {
            type: 'correlation',
            description: 'Mount vs Update ratio',
            value: this.calculateMountUpdateRatio(worstWindow),
            severity: 'warning',
            timestamp: Date.now(),
          },
        ],
        rootCause: this.identifyRenderRootCause(worstWindow, 'excessive'),
        recommendations: this.generateRenderRecommendations('excessive', worstWindow.length),
        affectedMetrics: ['renderCount', 'phase'],
        detectedAt: Date.now(),
        occurrenceCount: worstWindow.length,
        trends: this.analyzeTrends(metrics),
      });
    }

    return bottlenecks;
  }

  private analyzeMountUpdateImbalance(
    componentName: string,
    metrics: RenderMetrics[]
  ): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];

    const mountMetrics = metrics.filter(m => m.phase === 'mount');
    const updateMetrics = metrics.filter(m => m.phase === 'update');

    if (mountMetrics.length === 0 || updateMetrics.length === 0) return bottlenecks;

    const avgMountTime =
      mountMetrics.reduce((sum, m) => sum + m.actualDuration, 0) / mountMetrics.length;
    const avgUpdateTime =
      updateMetrics.reduce((sum, m) => sum + m.actualDuration, 0) / updateMetrics.length;

    // Detect if updates are significantly slower than mounts
    if (avgUpdateTime > avgMountTime * 2 && avgUpdateTime > this.config.minRenderTime) {
      bottlenecks.push({
        id: `slow-updates-${componentName}-${Date.now()}`,
        type: 'render',
        severity: this.getSeverityFromRenderTime(avgUpdateTime),
        componentName,
        confidence: 80,
        impactScore: this.calculateImpactScore(avgUpdateTime, updateMetrics.length),
        description: 'Updates significantly slower than mounts',
        evidence: [
          {
            type: 'metric',
            description: 'Average update time',
            value: avgUpdateTime.toFixed(2),
            severity: 'warning',
            timestamp: Date.now(),
          },
          {
            type: 'metric',
            description: 'Average mount time',
            value: avgMountTime.toFixed(2),
            severity: 'info',
            timestamp: Date.now(),
          },
          {
            type: 'correlation',
            description: 'Update/Mount ratio',
            value: (avgUpdateTime / avgMountTime).toFixed(2),
            severity: 'warning',
            timestamp: Date.now(),
          },
        ],
        rootCause: {
          category: 'rendering',
          primary: 'Inefficient update logic',
          contributing: [
            'Missing memoization',
            'Unnecessary prop changes',
            'Expensive calculations in render',
            'Poor state structure',
          ],
          likelihood: 85,
          technicalExplanation:
            'Component updates are taking significantly longer than initial mounts, suggesting inefficient re-rendering logic or missing optimizations.',
          businessImpact:
            'User interactions feel sluggish, reducing perceived application performance and user satisfaction.',
        },
        recommendations: [
          {
            priority: 'high',
            action: 'Implement React.memo for component memoization',
            implementation:
              'Wrap component with React.memo and provide custom comparison function if needed',
            difficulty: 'easy',
            estimatedImpact: 60,
            codeExample: `const ${componentName} = React.memo(({ prop1, prop2 }) => {\n  // Component logic\n});`,
          },
          {
            priority: 'high',
            action: 'Add useMemo for expensive calculations',
            implementation: 'Wrap expensive operations in useMemo with proper dependencies',
            difficulty: 'medium',
            estimatedImpact: 70,
            codeExample:
              'const expensiveValue = useMemo(() => expensiveCalculation(data), [data]);',
          },
        ],
        affectedMetrics: ['actualDuration', 'phase'],
        detectedAt: Date.now(),
        occurrenceCount: updateMetrics.length,
        trends: this.analyzeTrends(metrics),
      });
    }

    return bottlenecks;
  }

  // =========================
  // MEMORY ANALYSIS METHODS
  // =========================

  private analyzeMemoryBottlenecks(batch: PerformanceBatch): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];
    const memoryMetrics = batch.memoryUsage;

    if (memoryMetrics.length < 3) return bottlenecks;

    // Detect memory leaks
    const memoryLeak = this.detectMemoryLeak(memoryMetrics);
    if (memoryLeak.detected) {
      bottlenecks.push({
        id: `memory-leak-${batch.componentName}-${Date.now()}`,
        type: 'memory',
        severity: 'critical',
        componentName: batch.componentName,
        confidence: memoryLeak.confidence,
        impactScore: 90,
        description: 'Memory leak detected',
        evidence: [
          {
            type: 'pattern',
            description: 'Consistent memory increase',
            value: `${(memoryLeak.avgIncrease / 1024 / 1024).toFixed(2)}MB per measurement`,
            severity: 'critical',
            timestamp: Date.now(),
          },
          {
            type: 'metric',
            description: 'Total memory increase',
            value: `${(memoryLeak.totalIncrease / 1024 / 1024).toFixed(2)}MB`,
            severity: 'critical',
            timestamp: Date.now(),
          },
        ],
        rootCause: {
          category: 'memory',
          primary: 'Memory leak in component',
          contributing: [
            'Uncleaned event listeners',
            'Uncleared timers/intervals',
            'Retained closures',
            'Circular references',
            'Large object retention',
          ],
          likelihood: 90,
          technicalExplanation:
            'Component is consistently increasing memory usage without corresponding decreases, indicating objects are not being properly garbage collected.',
          businessImpact:
            'Application performance will degrade over time, potentially causing crashes or requiring page refreshes.',
        },
        recommendations: [
          {
            priority: 'critical',
            action: 'Review and fix useEffect cleanup',
            implementation: 'Ensure all useEffect hooks return cleanup functions',
            difficulty: 'medium',
            estimatedImpact: 80,
            codeExample:
              'useEffect(() => {\n  const handler = () => {};\n  element.addEventListener("event", handler);\n  return () => element.removeEventListener("event", handler);\n}, []);',
          },
          {
            priority: 'high',
            action: 'Clear timers and intervals',
            implementation: 'Clear all setTimeout and setInterval in cleanup',
            difficulty: 'easy',
            estimatedImpact: 70,
          },
        ],
        affectedMetrics: ['usedJSMemory', 'jsMemoryDelta'],
        detectedAt: Date.now(),
        occurrenceCount: memoryMetrics.length,
        trends: {
          isGettingWorse: true,
          frequency: 'increasing',
          averageImpact: memoryLeak.avgIncrease,
        },
      });
    }

    return bottlenecks;
  }

  // =========================
  // INTERACTION ANALYSIS METHODS
  // =========================

  private analyzeInteractionBottlenecks(batch: PerformanceBatch): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];
    const slowInteractions = batch.interactions.filter(i => i.blocking);

    if (slowInteractions.length === 0) return bottlenecks;

    const avgInteractionTime =
      slowInteractions.reduce((sum, i) => sum + i.duration, 0) / slowInteractions.length;

    if (avgInteractionTime > 100) {
      // 100ms threshold for interactions
      bottlenecks.push({
        id: `slow-interactions-${batch.componentName}-${Date.now()}`,
        type: 'interaction',
        severity: avgInteractionTime > 300 ? 'critical' : 'high',
        componentName: batch.componentName,
        confidence: 85,
        impactScore: Math.min(100, avgInteractionTime / 5),
        description: 'Slow user interaction response',
        evidence: [
          {
            type: 'metric',
            description: 'Average interaction time',
            value: avgInteractionTime.toFixed(2),
            severity: 'critical',
            timestamp: Date.now(),
          },
          {
            type: 'pattern',
            description: 'Blocking interactions count',
            value: slowInteractions.length.toString(),
            severity: 'warning',
            timestamp: Date.now(),
          },
        ],
        rootCause: {
          category: 'rendering',
          primary: 'Blocking main thread during interactions',
          contributing: [
            'Synchronous heavy computations',
            'Large DOM updates',
            'Unoptimized event handlers',
            'Inefficient state updates',
          ],
          likelihood: 80,
          technicalExplanation:
            'User interactions are causing main thread blocking, resulting in poor perceived performance.',
          businessImpact:
            'Users experience lag and unresponsiveness, leading to poor user experience and potential abandonment.',
        },
        recommendations: [
          {
            priority: 'high',
            action: 'Debounce or throttle event handlers',
            implementation: 'Use debounce/throttle for expensive operations in event handlers',
            difficulty: 'easy',
            estimatedImpact: 60,
          },
          {
            priority: 'high',
            action: 'Use React.startTransition for non-urgent updates',
            implementation: 'Wrap state updates in startTransition',
            difficulty: 'medium',
            estimatedImpact: 70,
            codeExample: 'startTransition(() => {\n  setNonUrgentState(newValue);\n});',
          },
        ],
        affectedMetrics: ['duration', 'blocking'],
        detectedAt: Date.now(),
        occurrenceCount: slowInteractions.length,
        trends: {
          isGettingWorse: false,
          frequency: 'stable',
          averageImpact: avgInteractionTime,
        },
      });
    }

    return bottlenecks;
  }

  // =========================
  // HELPER METHODS
  // =========================

  private groupMetricsByComponent(metrics: RenderMetrics[]): Map<string, RenderMetrics[]> {
    const groups = new Map<string, RenderMetrics[]>();

    metrics.forEach(metric => {
      const componentName = metric.id.split('-')[0];
      if (!groups.has(componentName)) {
        groups.set(componentName, []);
      }
      groups.get(componentName)!.push(metric);
    });

    return groups;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - mean, 2));
    return squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getSeverityFromRenderTime(renderTime: number): BottleneckIdentification['severity'] {
    if (renderTime > 100) return 'critical';
    if (renderTime > 50) return 'high';
    if (renderTime > 25) return 'medium';
    return 'low';
  }

  private calculateImpactScore(renderTime: number, occurrences: number): number {
    const timeScore = Math.min(100, (renderTime / 100) * 100);
    const frequencyScore = Math.min(100, (occurrences / 10) * 100);
    return Math.round((timeScore + frequencyScore) / 2);
  }

  private calculateMountUpdateRatio(metrics: RenderMetrics[]): string {
    const mounts = metrics.filter(m => m.phase === 'mount').length;
    const updates = metrics.filter(m => m.phase === 'update').length;
    return `${mounts}:${updates}`;
  }

  private analyzeTrends(metrics: RenderMetrics[]): BottleneckIdentification['trends'] {
    const recent = metrics.slice(0, Math.floor(metrics.length / 3));
    const older = metrics.slice(-Math.floor(metrics.length / 3));

    if (recent.length === 0 || older.length === 0) {
      return {
        isGettingWorse: false,
        frequency: 'stable',
        averageImpact: 0,
      };
    }

    const recentAvg = recent.reduce((sum, m) => sum + m.actualDuration, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.actualDuration, 0) / older.length;

    return {
      isGettingWorse: recentAvg > olderAvg * 1.1,
      frequency:
        recentAvg > olderAvg * 1.1
          ? 'increasing'
          : recentAvg < olderAvg * 0.9
            ? 'decreasing'
            : 'stable',
      averageImpact: recentAvg,
    };
  }

  private identifyRenderRootCause(metrics: RenderMetrics[], problemType: string): RootCause {
    const baseCauses = {
      inconsistent: {
        category: 'rendering' as const,
        primary: 'Inconsistent render performance',
        contributing: [
          'Variable data sizes',
          'Conditional rendering logic',
          'External dependencies',
          'Race conditions',
        ],
      },
      slow: {
        category: 'component-design' as const,
        primary: 'Inefficient component implementation',
        contributing: [
          'Missing memoization',
          'Expensive calculations',
          'Large DOM trees',
          'Poor algorithm choice',
        ],
      },
      excessive: {
        category: 'state-management' as const,
        primary: 'Excessive re-renders',
        contributing: [
          'Unstable dependencies',
          'Incorrect state structure',
          'Missing memoization',
          'Event handler recreation',
        ],
      },
    };

    const base = baseCauses[problemType] || baseCauses.slow;

    return {
      ...base,
      likelihood: 80,
      technicalExplanation: `Component exhibits ${problemType} render behavior patterns indicating ${base.primary.toLowerCase()}.`,
      businessImpact:
        'Degraded user experience leading to reduced engagement and potential user churn.',
    };
  }

  private generateRenderRecommendations(problemType: string, value: number): Recommendation[] {
    const baseRecommendations = {
      inconsistent: [
        {
          priority: 'high' as const,
          action: 'Implement consistent data handling',
          implementation: 'Normalize data structures and implement loading states',
          difficulty: 'medium' as const,
          estimatedImpact: 70,
        },
        {
          priority: 'medium' as const,
          action: 'Add error boundaries',
          implementation: 'Wrap component in error boundary to handle edge cases',
          difficulty: 'easy' as const,
          estimatedImpact: 40,
        },
      ],
      slow: [
        {
          priority: 'critical' as const,
          action: 'Optimize render logic',
          implementation: 'Profile and optimize expensive operations in render',
          difficulty: 'hard' as const,
          estimatedImpact: 80,
        },
        {
          priority: 'high' as const,
          action: 'Implement virtualization',
          implementation: 'Use react-window or similar for large lists',
          difficulty: 'medium' as const,
          estimatedImpact: 90,
        },
      ],
      excessive: [
        {
          priority: 'high' as const,
          action: 'Reduce re-render frequency',
          implementation: 'Use React.memo, useMemo, and useCallback appropriately',
          difficulty: 'medium' as const,
          estimatedImpact: 85,
        },
        {
          priority: 'high' as const,
          action: 'Optimize state structure',
          implementation: 'Break down state to minimize update scope',
          difficulty: 'medium' as const,
          estimatedImpact: 70,
        },
      ],
    };

    return baseRecommendations[problemType] || baseRecommendations.slow;
  }

  private detectMemoryLeak(memoryMetrics: MemoryMetric[]): {
    detected: boolean;
    confidence: number;
    avgIncrease: number;
    totalIncrease: number;
  } {
    if (memoryMetrics.length < 5) {
      return { detected: false, confidence: 0, avgIncrease: 0, totalIncrease: 0 };
    }

    const increases = memoryMetrics.slice(1).filter(metric => metric.jsMemoryDelta > 0);
    const totalIncrease = increases.reduce((sum, metric) => sum + metric.jsMemoryDelta, 0);
    const avgIncrease = totalIncrease / increases.length;

    // Consider it a leak if more than 70% of measurements show increase
    // and average increase is more than 1MB per measurement
    const increaseRatio = increases.length / (memoryMetrics.length - 1);
    const detected = increaseRatio > 0.7 && avgIncrease > 1024 * 1024;
    const confidence = Math.min(
      100,
      increaseRatio * 100 + (avgIncrease / (10 * 1024 * 1024)) * 100
    );

    return {
      detected,
      confidence: Math.round(confidence),
      avgIncrease,
      totalIncrease,
    };
  }

  private analyzeBatchDegradation(batch: PerformanceBatch): BottleneckIdentification[] {
    const bottlenecks: BottleneckIdentification[] = [];

    // Check if performance is degrading within the batch
    if (batch.maxRenderTime > batch.avgRenderTime * 3) {
      bottlenecks.push({
        id: `performance-degradation-${batch.componentName}-${Date.now()}`,
        type: 'render',
        severity: 'high',
        componentName: batch.componentName,
        confidence: 75,
        impactScore: 70,
        description: 'Performance degradation detected within batch',
        evidence: [
          {
            type: 'metric',
            description: 'Max vs Average render time ratio',
            value: (batch.maxRenderTime / batch.avgRenderTime).toFixed(2),
            severity: 'warning',
            timestamp: Date.now(),
          },
        ],
        rootCause: {
          category: 'rendering',
          primary: 'Intermittent performance spikes',
          contributing: ['Resource contention', 'Garbage collection', 'External API delays'],
          likelihood: 70,
          technicalExplanation:
            'Component shows occasional significant performance spikes beyond normal variation.',
          businessImpact: 'Unpredictable user experience with occasional freezing or lag.',
        },
        recommendations: [
          {
            priority: 'medium',
            action: 'Investigate performance spikes',
            implementation: 'Add detailed profiling during slow renders',
            difficulty: 'medium',
            estimatedImpact: 60,
          },
        ],
        affectedMetrics: ['maxRenderTime', 'avgRenderTime'],
        detectedAt: Date.now(),
        occurrenceCount: 1,
        trends: {
          isGettingWorse: false,
          frequency: 'stable',
          averageImpact: batch.avgRenderTime,
        },
      });
    }

    return bottlenecks;
  }

  private storeBottlenecks(bottlenecks: BottleneckIdentification[]) {
    bottlenecks.forEach(bottleneck => {
      if (!this.analysisHistory.has(bottleneck.componentName)) {
        this.analysisHistory.set(bottleneck.componentName, []);
      }
      this.analysisHistory.get(bottleneck.componentName)!.push(bottleneck);

      // Keep only recent history
      const history = this.analysisHistory.get(bottleneck.componentName)!;
      if (history.length > 50) {
        this.analysisHistory.set(bottleneck.componentName, history.slice(-50));
      }
    });
  }

  /**
   * Get historical bottlenecks for a component
   */
  getComponentHistory(componentName: string): BottleneckIdentification[] {
    return this.analysisHistory.get(componentName) || [];
  }

  /**
   * Get all detected bottlenecks
   */
  getAllBottlenecks(): BottleneckIdentification[] {
    const all: BottleneckIdentification[] = [];
    this.analysisHistory.forEach(bottlenecks => {
      all.push(...bottlenecks);
    });
    return all.sort((a, b) => b.detectedAt - a.detectedAt);
  }

  /**
   * Clear analysis history
   */
  clearHistory() {
    this.analysisHistory.clear();
  }
}

// =========================
// EXPORTS
// =========================

export const bottleneckAnalyzer = new PerformanceBottleneckAnalyzer();

export type {
  BottleneckIdentification,
  Evidence,
  RootCause,
  Recommendation,
  BottleneckAnalysisConfig,
};
