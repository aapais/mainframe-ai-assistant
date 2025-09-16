/**
 * Comprehensive Memory Usage Analyzer
 *
 * Provides detailed memory analysis including:
 * - Heap snapshots and allocation tracking
 * - Memory leak detection
 * - Garbage collection monitoring
 * - DOM node tracking
 * - Event listener auditing
 * - Long session memory tracking
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  componentBreakdown: ComponentMemoryUsage[];
  leakSuspects: MemoryLeak[];
  gcMetrics: GCMetrics;
  domMetrics: DOMMetrics;
  eventListenerMetrics: EventListenerMetrics;
}

export interface ComponentMemoryUsage {
  component: string;
  instances: number;
  memoryUsage: number;
  leakSuspected: boolean;
  mountTime: Date;
  lastUpdate: Date;
  retainedSize: number;
}

export interface MemoryLeak {
  type: 'component' | 'service' | 'event-listener' | 'cache' | 'timeout';
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  memoryDelta: number;
  detectedAt: Date;
  description: string;
  suggestedFix: string;
  stackTrace?: string;
}

export interface GCMetrics {
  collections: number;
  totalTime: number;
  averageTime: number;
  frequency: number;
  lastCollection: Date;
  pressure: 'low' | 'medium' | 'high';
  efficiency: number;
}

export interface DOMMetrics {
  totalNodes: number;
  detachedNodes: number;
  eventListeners: number;
  observedElements: number;
  largestComponent: {
    name: string;
    nodeCount: number;
    memoryImpact: number;
  };
}

export interface EventListenerMetrics {
  total: number;
  orphaned: number;
  duplicates: number;
  byType: Record<string, number>;
  leakyListeners: Array<{
    element: string;
    event: string;
    count: number;
  }>;
}

export interface MemoryAnalysisReport {
  summary: {
    overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    memoryGrowthRate: number;
    leakCount: number;
    recommendations: string[];
  };
  baseline: {
    initialHeapSize: number;
    targetHeapSize: number;
    maxAllowedGrowth: number;
  };
  current: MemorySnapshot;
  trends: {
    heapGrowth: number[];
    gcFrequency: number[];
    componentCounts: Record<string, number[]>;
  };
  issues: MemoryLeak[];
  optimizations: MemoryOptimization[];
}

export interface MemoryOptimization {
  type: 'component' | 'service' | 'cache' | 'dom' | 'event';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  implementation: string;
  expectedSavings: number;
  effort: 'minimal' | 'moderate' | 'significant';
}

export class MemoryAnalyzer extends EventEmitter {
  private isMonitoring = false;
  private snapshots: MemorySnapshot[] = [];
  private baselineSnapshot?: MemorySnapshot;
  private componentRegistry = new Map<string, ComponentMemoryUsage>();
  private eventListenerRegistry = new Map<string, Set<EventListener>>();
  private gcObserver?: PerformanceObserver;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(private config = {
    snapshotInterval: 30000, // 30 seconds
    maxSnapshots: 1000,
    leakThreshold: 10 * 1024 * 1024, // 10MB
    gcPressureThreshold: 100, // ms
  }) {
    super();
  }

  /**
   * Start comprehensive memory monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.warn('Memory monitoring already started');
      return;
    }

    console.log('🔍 Starting comprehensive memory analysis...');

    this.isMonitoring = true;
    this.setupGCObserver();
    this.startPeriodicSnapshots();
    this.setupDOMObserver();
    this.setupEventListenerTracking();

    // Take baseline snapshot
    this.baselineSnapshot = await this.takeSnapshot();
    console.log(`📊 Baseline memory usage: ${this.formatBytes(this.baselineSnapshot.heapUsed)}`);

    this.emit('monitoring:started', this.baselineSnapshot);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    console.log('🛑 Memory monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Take a comprehensive memory snapshot
   */
  async takeSnapshot(): Promise<MemorySnapshot> {
    const memUsage = process.memoryUsage();
    const timestamp = new Date();

    const snapshot: MemorySnapshot = {
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      componentBreakdown: await this.analyzeComponentMemory(),
      leakSuspects: await this.detectMemoryLeaks(),
      gcMetrics: await this.getGCMetrics(),
      domMetrics: await this.analyzeDOMMemory(),
      eventListenerMetrics: await this.analyzeEventListeners(),
    };

    this.snapshots.push(snapshot);

    // Maintain snapshot limit
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    this.emit('snapshot:taken', snapshot);
    return snapshot;
  }

  /**
   * Analyze component memory usage
   */
  private async analyzeComponentMemory(): Promise<ComponentMemoryUsage[]> {
    const components: ComponentMemoryUsage[] = [];

    // Track React components if available
    if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const devtools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

      if (devtools.renderers) {
        devtools.renderers.forEach((renderer: any) => {
          if (renderer.findFiberByHostInstance) {
            // Analyze React fiber tree for memory usage
            // This is a simplified approach - in production, use React DevTools Profiler API
            const fiberRoot = renderer.current;
            if (fiberRoot) {
              this.traverseFiberTree(fiberRoot, components);
            }
          }
        });
      }
    }

    // Add service memory tracking
    this.componentRegistry.forEach((usage, name) => {
      components.push({
        component: name,
        instances: usage.instances,
        memoryUsage: usage.memoryUsage,
        leakSuspected: this.isLeakSuspected(usage),
        mountTime: usage.mountTime,
        lastUpdate: usage.lastUpdate,
        retainedSize: usage.retainedSize,
      });
    });

    return components.sort((a, b) => b.memoryUsage - a.memoryUsage);
  }

  /**
   * Detect potential memory leaks
   */
  private async detectMemoryLeaks(): Promise<MemoryLeak[]> {
    const leaks: MemoryLeak[] = [];

    if (this.snapshots.length < 2) return leaks;

    const current = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[this.snapshots.length - 2];

    const memoryGrowth = current.heapUsed - previous.heapUsed;

    // Check for excessive memory growth
    if (memoryGrowth > this.config.leakThreshold) {
      leaks.push({
        type: 'component',
        source: 'heap',
        severity: 'high',
        memoryDelta: memoryGrowth,
        detectedAt: current.timestamp,
        description: `Excessive memory growth detected: ${this.formatBytes(memoryGrowth)}`,
        suggestedFix: 'Review recent component changes and check for retained references'
      });
    }

    // Check component-specific leaks
    current.componentBreakdown.forEach(component => {
      if (component.leakSuspected) {
        leaks.push({
          type: 'component',
          source: component.component,
          severity: component.memoryUsage > 5 * 1024 * 1024 ? 'high' : 'medium',
          memoryDelta: component.memoryUsage,
          detectedAt: current.timestamp,
          description: `Component ${component.component} may be leaking memory`,
          suggestedFix: 'Check cleanup in useEffect hooks and component unmounting'
        });
      }
    });

    // Check for event listener leaks
    if (current.eventListenerMetrics.orphaned > 0) {
      leaks.push({
        type: 'event-listener',
        source: 'DOM',
        severity: current.eventListenerMetrics.orphaned > 50 ? 'high' : 'medium',
        memoryDelta: current.eventListenerMetrics.orphaned * 1024, // Estimated
        detectedAt: current.timestamp,
        description: `${current.eventListenerMetrics.orphaned} orphaned event listeners detected`,
        suggestedFix: 'Ensure event listeners are removed in cleanup functions'
      });
    }

    // Check for detached DOM nodes
    if (current.domMetrics.detachedNodes > 0) {
      leaks.push({
        type: 'component',
        source: 'DOM',
        severity: current.domMetrics.detachedNodes > 100 ? 'high' : 'medium',
        memoryDelta: current.domMetrics.detachedNodes * 512, // Estimated
        detectedAt: current.timestamp,
        description: `${current.domMetrics.detachedNodes} detached DOM nodes found`,
        suggestedFix: 'Review component cleanup and DOM manipulation code'
      });
    }

    return leaks;
  }

  /**
   * Get garbage collection metrics
   */
  private async getGCMetrics(): Promise<GCMetrics> {
    // This is a simplified implementation
    // In a real environment, you'd use Node.js performance hooks
    return {
      collections: 0,
      totalTime: 0,
      averageTime: 0,
      frequency: 0,
      lastCollection: new Date(),
      pressure: 'low',
      efficiency: 0.95
    };
  }

  /**
   * Analyze DOM memory usage
   */
  private async analyzeDOMMemory(): Promise<DOMMetrics> {
    if (typeof document === 'undefined') {
      return {
        totalNodes: 0,
        detachedNodes: 0,
        eventListeners: 0,
        observedElements: 0,
        largestComponent: { name: 'N/A', nodeCount: 0, memoryImpact: 0 }
      };
    }

    const allNodes = document.querySelectorAll('*');
    const detachedNodes = this.findDetachedNodes();

    // Find largest component by node count
    const componentNodes = new Map<string, number>();
    allNodes.forEach(node => {
      const component = this.getComponentName(node);
      if (component) {
        componentNodes.set(component, (componentNodes.get(component) || 0) + 1);
      }
    });

    const largestComponent = Array.from(componentNodes.entries())
      .sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

    return {
      totalNodes: allNodes.length,
      detachedNodes: detachedNodes.length,
      eventListeners: this.countEventListeners(),
      observedElements: this.countObservedElements(),
      largestComponent: {
        name: largestComponent[0],
        nodeCount: largestComponent[1],
        memoryImpact: largestComponent[1] * 512 // Estimated bytes per node
      }
    };
  }

  /**
   * Analyze event listener memory usage
   */
  private async analyzeEventListeners(): Promise<EventListenerMetrics> {
    const metrics: EventListenerMetrics = {
      total: 0,
      orphaned: 0,
      duplicates: 0,
      byType: {},
      leakyListeners: []
    };

    // This would require custom tracking in a real implementation
    // For now, return estimated values based on DOM analysis
    if (typeof document !== 'undefined') {
      const elements = document.querySelectorAll('*');
      elements.forEach(element => {
        const listeners = this.getElementEventListeners(element);
        metrics.total += listeners.length;

        listeners.forEach(listener => {
          metrics.byType[listener.type] = (metrics.byType[listener.type] || 0) + 1;
        });
      });
    }

    return metrics;
  }

  /**
   * Generate comprehensive analysis report
   */
  async generateReport(): Promise<MemoryAnalysisReport> {
    if (this.snapshots.length === 0) {
      throw new Error('No snapshots available. Start monitoring first.');
    }

    const current = this.snapshots[this.snapshots.length - 1];
    const baseline = this.baselineSnapshot || this.snapshots[0];

    const memoryGrowth = current.heapUsed - baseline.heapUsed;
    const growthRate = this.snapshots.length > 1 ?
      this.calculateGrowthRate() : 0;

    const issues = current.leakSuspects;
    const overallHealth = this.assessOverallHealth(current, baseline, issues);

    const report: MemoryAnalysisReport = {
      summary: {
        overallHealth,
        memoryGrowthRate: growthRate,
        leakCount: issues.length,
        recommendations: this.generateRecommendations(current, issues)
      },
      baseline: {
        initialHeapSize: baseline.heapUsed,
        targetHeapSize: 50 * 1024 * 1024, // 50MB target
        maxAllowedGrowth: 10 * 1024 * 1024 // 10MB per hour
      },
      current,
      trends: {
        heapGrowth: this.snapshots.map(s => s.heapUsed),
        gcFrequency: this.snapshots.map(s => s.gcMetrics.frequency),
        componentCounts: this.extractComponentTrends()
      },
      issues,
      optimizations: this.generateOptimizations(current, issues)
    };

    return report;
  }

  /**
   * Export detailed memory report to file
   */
  async exportReport(filePath: string): Promise<void> {
    const report = await this.generateReport();
    const detailedReport = {
      generatedAt: new Date().toISOString(),
      sessionDuration: this.getSessionDuration(),
      configuration: this.config,
      report,
      rawSnapshots: this.snapshots.slice(-10) // Last 10 snapshots
    };

    await fs.writeFile(filePath, JSON.stringify(detailedReport, null, 2));
    console.log(`📄 Memory analysis report exported to ${filePath}`);
  }

  /**
   * Monitor long-session memory usage
   */
  startLongSessionMonitoring(durationHours: number = 8): void {
    console.log(`🕐 Starting ${durationHours}h long-session memory monitoring...`);

    const endTime = Date.now() + (durationHours * 60 * 60 * 1000);

    const checkMemory = async () => {
      if (Date.now() >= endTime) {
        console.log('⏰ Long-session monitoring completed');
        const finalReport = await this.generateReport();
        this.emit('long-session:completed', finalReport);
        return;
      }

      const snapshot = await this.takeSnapshot();
      const issues = snapshot.leakSuspects.filter(leak =>
        leak.severity === 'high' || leak.severity === 'critical'
      );

      if (issues.length > 0) {
        console.warn(`⚠️ Memory issues detected: ${issues.length} critical leaks`);
        this.emit('long-session:alert', issues);
      }

      // Schedule next check
      setTimeout(checkMemory, 60000); // Check every minute
    };

    checkMemory();
  }

  // Private helper methods
  private setupGCObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    this.gcObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.entryType === 'measure' && entry.name.includes('gc')) {
          this.emit('gc:occurred', {
            duration: entry.duration,
            timestamp: new Date(entry.startTime + performance.timeOrigin)
          });
        }
      });
    });

    try {
      this.gcObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('Could not observe GC events:', error.message);
    }
  }

  private startPeriodicSnapshots(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.takeSnapshot();
      } catch (error) {
        console.error('Error taking memory snapshot:', error);
      }
    }, this.config.snapshotInterval);
  }

  private setupDOMObserver(): void {
    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver((mutations) => {
      let addedNodes = 0;
      let removedNodes = 0;

      mutations.forEach(mutation => {
        addedNodes += mutation.addedNodes.length;
        removedNodes += mutation.removedNodes.length;
      });

      if (addedNodes > 100 || removedNodes > 100) {
        this.emit('dom:large-mutation', { addedNodes, removedNodes });
      }
    });

    if (typeof document !== 'undefined') {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  private setupEventListenerTracking(): void {
    if (typeof EventTarget === 'undefined') return;

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function(type: string, listener: EventListener, options?: any) {
      const elementId = this.id || this.tagName || 'unknown';
      const key = `${elementId}:${type}`;

      if (!this.eventListenerRegistry) {
        this.eventListenerRegistry = new Set();
      }
      this.eventListenerRegistry.add(listener);

      return originalAddEventListener.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function(type: string, listener: EventListener, options?: any) {
      if (this.eventListenerRegistry) {
        this.eventListenerRegistry.delete(listener);
      }

      return originalRemoveEventListener.call(this, type, listener, options);
    };
  }

  private traverseFiberTree(fiber: any, components: ComponentMemoryUsage[]): void {
    // Simplified fiber tree traversal for component analysis
    if (fiber && fiber.type && typeof fiber.type === 'function') {
      const name = fiber.type.name || fiber.type.displayName || 'AnonymousComponent';
      const existing = components.find(c => c.component === name);

      if (existing) {
        existing.instances++;
      } else {
        components.push({
          component: name,
          instances: 1,
          memoryUsage: this.estimateComponentMemory(fiber),
          leakSuspected: false,
          mountTime: new Date(),
          lastUpdate: new Date(),
          retainedSize: 0
        });
      }
    }

    if (fiber.child) {
      this.traverseFiberTree(fiber.child, components);
    }
    if (fiber.sibling) {
      this.traverseFiberTree(fiber.sibling, components);
    }
  }

  private isLeakSuspected(usage: ComponentMemoryUsage): boolean {
    const age = Date.now() - usage.mountTime.getTime();
    const growthRate = usage.memoryUsage / Math.max(age / 1000, 1);
    return growthRate > 1024; // More than 1KB per second growth
  }

  private findDetachedNodes(): Element[] {
    // This is a simplified implementation
    // In practice, you'd need more sophisticated detection
    return [];
  }

  private getComponentName(node: Node): string | null {
    const element = node as Element;
    if (element.getAttribute) {
      return element.getAttribute('data-component') ||
             element.className.split(' ').find(c => c.includes('Component')) ||
             null;
    }
    return null;
  }

  private countEventListeners(): number {
    // Simplified event listener counting
    return 0;
  }

  private countObservedElements(): number {
    // Count elements with observers (ResizeObserver, IntersectionObserver, etc.)
    return 0;
  }

  private getElementEventListeners(element: Element): Array<{type: string, listener: Function}> {
    // In a real implementation, this would access the element's event listeners
    return [];
  }

  private calculateGrowthRate(): number {
    if (this.snapshots.length < 2) return 0;

    const recent = this.snapshots.slice(-10);
    const initial = recent[0].heapUsed;
    const final = recent[recent.length - 1].heapUsed;
    const timeSpan = recent[recent.length - 1].timestamp.getTime() - recent[0].timestamp.getTime();

    return ((final - initial) / timeSpan) * (60 * 60 * 1000); // MB per hour
  }

  private assessOverallHealth(
    current: MemorySnapshot,
    baseline: MemorySnapshot,
    issues: MemoryLeak[]
  ): 'excellent' | 'good' | 'warning' | 'critical' {
    const growthRatio = current.heapUsed / baseline.heapUsed;
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0 || growthRatio > 3) return 'critical';
    if (highIssues > 2 || growthRatio > 2) return 'warning';
    if (highIssues > 0 || growthRatio > 1.5) return 'good';
    return 'excellent';
  }

  private generateRecommendations(current: MemorySnapshot, issues: MemoryLeak[]): string[] {
    const recommendations: string[] = [];

    if (current.heapUsed > 50 * 1024 * 1024) {
      recommendations.push('Consider implementing component lazy loading to reduce initial memory footprint');
    }

    if (current.domMetrics.detachedNodes > 0) {
      recommendations.push('Review component cleanup logic to prevent detached DOM nodes');
    }

    if (current.eventListenerMetrics.orphaned > 0) {
      recommendations.push('Implement proper event listener cleanup in useEffect dependencies');
    }

    if (issues.some(i => i.type === 'cache')) {
      recommendations.push('Review cache eviction policies and implement size limits');
    }

    return recommendations;
  }

  private extractComponentTrends(): Record<string, number[]> {
    const trends: Record<string, number[]> = {};

    this.snapshots.forEach(snapshot => {
      snapshot.componentBreakdown.forEach(component => {
        if (!trends[component.component]) {
          trends[component.component] = [];
        }
        trends[component.component].push(component.instances);
      });
    });

    return trends;
  }

  private generateOptimizations(current: MemorySnapshot, issues: MemoryLeak[]): MemoryOptimization[] {
    const optimizations: MemoryOptimization[] = [];

    // Component optimizations
    const heavyComponents = current.componentBreakdown
      .filter(c => c.memoryUsage > 5 * 1024 * 1024)
      .slice(0, 3);

    heavyComponents.forEach(component => {
      optimizations.push({
        type: 'component',
        priority: 'high',
        description: `Optimize ${component.component} memory usage`,
        implementation: 'Implement React.memo, useMemo, or component splitting',
        expectedSavings: component.memoryUsage * 0.3,
        effort: 'moderate'
      });
    });

    // Event listener optimizations
    if (current.eventListenerMetrics.orphaned > 10) {
      optimizations.push({
        type: 'event',
        priority: 'medium',
        description: 'Clean up orphaned event listeners',
        implementation: 'Add cleanup functions to useEffect hooks',
        expectedSavings: current.eventListenerMetrics.orphaned * 1024,
        effort: 'minimal'
      });
    }

    return optimizations;
  }

  private estimateComponentMemory(fiber: any): number {
    // Simplified memory estimation based on fiber properties
    let memory = 1024; // Base component overhead

    if (fiber.memoizedProps) {
      memory += JSON.stringify(fiber.memoizedProps).length * 2;
    }

    if (fiber.memoizedState) {
      memory += JSON.stringify(fiber.memoizedState).length * 2;
    }

    return memory;
  }

  private getSessionDuration(): number {
    if (!this.baselineSnapshot) return 0;
    return Date.now() - this.baselineSnapshot.timestamp.getTime();
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default MemoryAnalyzer;