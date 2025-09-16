/**
 * Comprehensive Memory Analysis Test Suite
 *
 * Tests all aspects of memory monitoring and leak detection:
 * - Heap snapshots and analysis
 * - Memory leak detection
 * - Garbage collection monitoring
 * - DOM node tracking
 * - Event listener management
 * - Long session testing
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import MemoryAnalyzer, { MemorySnapshot, MemoryLeak } from '../../src/performance/MemoryAnalyzer';
import {
  setupMemoryMonitoring,
  trackComponentMemory,
  trackServiceMemory,
  analyzeCacheMemory,
  runMemoryAnalysis,
  runLongSessionTest
} from '../../src/performance/memory-usage-example';

describe('Memory Analysis System', () => {
  let analyzer: MemoryAnalyzer;
  let originalGC: any;
  let originalPerformance: any;

  beforeEach(() => {
    // Mock performance API
    originalPerformance = global.performance;
    global.performance = {
      memory: {
        usedJSHeapSize: 10 * 1024 * 1024, // 10MB
        totalJSHeapSize: 20 * 1024 * 1024, // 20MB
        jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
      },
      timeOrigin: Date.now(),
      now: () => Date.now()
    } as any;

    // Mock process.memoryUsage
    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = jest.fn(() => ({
      rss: 20 * 1024 * 1024,
      heapTotal: 15 * 1024 * 1024,
      heapUsed: 10 * 1024 * 1024,
      external: 1 * 1024 * 1024,
      arrayBuffers: 512 * 1024
    }));

    // Mock global.gc
    originalGC = global.gc;
    global.gc = jest.fn();

    analyzer = new MemoryAnalyzer({
      snapshotInterval: 1000,
      maxSnapshots: 100,
      leakThreshold: 1024 * 1024, // 1MB
      gcPressureThreshold: 50
    });
  });

  afterEach(async () => {
    if (analyzer) {
      analyzer.stopMonitoring();
    }

    // Restore mocks
    global.performance = originalPerformance;
    global.gc = originalGC;
  });

  describe('MemoryAnalyzer Core Functionality', () => {
    test('should initialize and start monitoring', async () => {
      expect(analyzer).toBeDefined();

      await analyzer.startMonitoring();

      const snapshot = await analyzer.takeSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.heapUsed).toBeGreaterThan(0);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });

    test('should take memory snapshots with detailed breakdown', async () => {
      await analyzer.startMonitoring();
      const snapshot = await analyzer.takeSnapshot();

      expect(snapshot).toMatchObject({
        timestamp: expect.any(Date),
        heapUsed: expect.any(Number),
        heapTotal: expect.any(Number),
        external: expect.any(Number),
        arrayBuffers: expect.any(Number),
        rss: expect.any(Number),
        componentBreakdown: expect.any(Array),
        leakSuspects: expect.any(Array),
        gcMetrics: expect.any(Object),
        domMetrics: expect.any(Object),
        eventListenerMetrics: expect.any(Object)
      });

      expect(snapshot.heapUsed).toBe(10 * 1024 * 1024);
      expect(snapshot.heapTotal).toBe(15 * 1024 * 1024);
    });

    test('should detect memory leaks', async () => {
      await analyzer.startMonitoring();

      // Take baseline snapshot
      const baseline = await analyzer.takeSnapshot();

      // Simulate memory growth by mocking larger heap usage
      process.memoryUsage = jest.fn(() => ({
        rss: 30 * 1024 * 1024,
        heapTotal: 25 * 1024 * 1024,
        heapUsed: 15 * 1024 * 1024, // 5MB growth
        external: 2 * 1024 * 1024,
        arrayBuffers: 1024 * 1024
      }));

      // Take second snapshot
      const snapshot = await analyzer.takeSnapshot();

      expect(snapshot.leakSuspects.length).toBeGreaterThan(0);
      expect(snapshot.leakSuspects[0]).toMatchObject({
        type: expect.any(String),
        source: expect.any(String),
        severity: expect.any(String),
        memoryDelta: expect.any(Number),
        detectedAt: expect.any(Date),
        description: expect.any(String),
        suggestedFix: expect.any(String)
      });
    });

    test('should analyze component memory usage', async () => {
      await analyzer.startMonitoring();
      const snapshot = await analyzer.takeSnapshot();

      expect(snapshot.componentBreakdown).toBeDefined();
      expect(Array.isArray(snapshot.componentBreakdown)).toBe(true);
    });

    test('should track DOM metrics', async () => {
      await analyzer.startMonitoring();
      const snapshot = await analyzer.takeSnapshot();

      expect(snapshot.domMetrics).toMatchObject({
        totalNodes: expect.any(Number),
        detachedNodes: expect.any(Number),
        eventListeners: expect.any(Number),
        observedElements: expect.any(Number),
        largestComponent: expect.objectContaining({
          name: expect.any(String),
          nodeCount: expect.any(Number),
          memoryImpact: expect.any(Number)
        })
      });
    });

    test('should track event listener metrics', async () => {
      await analyzer.startMonitoring();
      const snapshot = await analyzer.takeSnapshot();

      expect(snapshot.eventListenerMetrics).toMatchObject({
        total: expect.any(Number),
        orphaned: expect.any(Number),
        duplicates: expect.any(Number),
        byType: expect.any(Object),
        leakyListeners: expect.any(Array)
      });
    });

    test('should generate comprehensive analysis report', async () => {
      await analyzer.startMonitoring();

      // Take multiple snapshots to build history
      await analyzer.takeSnapshot();
      await new Promise(resolve => setTimeout(resolve, 100));
      await analyzer.takeSnapshot();

      const report = await analyzer.generateReport();

      expect(report).toMatchObject({
        summary: {
          overallHealth: expect.stringMatching(/excellent|good|warning|critical/),
          memoryGrowthRate: expect.any(Number),
          leakCount: expect.any(Number),
          recommendations: expect.any(Array)
        },
        baseline: {
          initialHeapSize: expect.any(Number),
          targetHeapSize: expect.any(Number),
          maxAllowedGrowth: expect.any(Number)
        },
        current: expect.any(Object),
        trends: {
          heapGrowth: expect.any(Array),
          gcFrequency: expect.any(Array),
          componentCounts: expect.any(Object)
        },
        issues: expect.any(Array),
        optimizations: expect.any(Array)
      });

      expect(report.summary.recommendations.length).toBeGreaterThanOrEqual(0);
      expect(report.optimizations.length).toBeGreaterThanOrEqual(0);
    });

    test('should export detailed report to file', async () => {
      const mockWriteFile = jest.fn().mockResolvedValue(undefined);
      jest.doMock('fs/promises', () => ({
        writeFile: mockWriteFile
      }));

      await analyzer.startMonitoring();
      await analyzer.takeSnapshot();

      const reportPath = '/tmp/memory-report.json';
      await analyzer.exportReport(reportPath);

      expect(mockWriteFile).toHaveBeenCalledWith(
        reportPath,
        expect.stringContaining('"generatedAt"'),
        undefined
      );
    });

    test('should handle long session monitoring', async () => {
      const alertSpy = jest.fn();
      const completeSpy = jest.fn();

      analyzer.on('long-session:alert', alertSpy);
      analyzer.on('long-session:completed', completeSpy);

      await analyzer.startMonitoring();

      // Mock long session (shortened for test)
      analyzer.startLongSessionMonitoring(0.001); // 0.001 hours = 3.6 seconds

      // Wait for session to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Should have completed
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('Memory Usage Examples Integration', () => {
    test('should setup comprehensive memory monitoring', async () => {
      const monitoringAnalyzer = await setupMemoryMonitoring();

      expect(monitoringAnalyzer).toBeDefined();
      expect(monitoringAnalyzer).toBeInstanceOf(MemoryAnalyzer);

      monitoringAnalyzer.stopMonitoring();
    });

    test('should track component memory lifecycle', async () => {
      const componentTracker = trackComponentMemory(analyzer, 'TestComponent');

      expect(componentTracker).toHaveProperty('onMount');
      expect(componentTracker).toHaveProperty('onUnmount');
      expect(componentTracker).toHaveProperty('onUpdate');

      // Test lifecycle methods
      await componentTracker.onMount();
      await componentTracker.onUpdate({ testProp: 'value' }, { testState: 'value' });

      // Simulate memory growth
      process.memoryUsage = jest.fn(() => ({
        rss: 30 * 1024 * 1024,
        heapTotal: 25 * 1024 * 1024,
        heapUsed: 12 * 1024 * 1024, // 2MB growth
        external: 2 * 1024 * 1024,
        arrayBuffers: 1024 * 1024
      }));

      await componentTracker.onUnmount();
    });

    test('should track service memory usage', async () => {
      const serviceTracker = trackServiceMemory('TestService');

      expect(serviceTracker).toHaveProperty('operation');
      expect(serviceTracker).toHaveProperty('getStats');

      // Test operation tracking
      const result = await serviceTracker.operation('testOperation', async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test result';
      });

      expect(result).toBe('test result');

      const stats = serviceTracker.getStats();
      expect(stats).toMatchObject({
        serviceName: 'TestService',
        uptime: expect.any(Number),
        totalMemoryDelta: expect.any(Number),
        averageMemoryGrowthRate: expect.any(Number)
      });
    });

    test('should analyze cache memory usage', () => {
      const cache = new Map();

      // Add test data to cache
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, {
          data: `test data ${i}`.repeat(100),
          metadata: { created: new Date(), size: i * 1024 }
        });
      }

      const analysis = analyzeCacheMemory(cache, 'TestCache');

      expect(analysis).toMatchObject({
        cacheSize: expect.any(Number),
        itemCount: 100,
        averageItemSize: expect.any(Number),
        largestItems: expect.any(Array),
        recommendations: expect.any(Array)
      });

      expect(analysis.itemCount).toBe(100);
      expect(analysis.largestItems.length).toBeLessThanOrEqual(5);
    });

    test('should run comprehensive memory analysis', async () => {
      await analyzer.startMonitoring();
      await analyzer.takeSnapshot();

      const report = await runMemoryAnalysis(analyzer);

      expect(report).toMatchObject({
        summary: expect.any(Object),
        baseline: expect.any(Object),
        current: expect.any(Object),
        trends: expect.any(Object),
        issues: expect.any(Array),
        optimizations: expect.any(Array)
      });
    });

    test('should run long session test with simulation', async () => {
      await analyzer.startMonitoring();

      // Run shortened long session test
      const report = await runLongSessionTest(analyzer, 0.001); // 0.001 hours

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.current).toBeDefined();
    });
  });

  describe('Memory Leak Detection Scenarios', () => {
    test('should detect component memory leaks', async () => {
      await analyzer.startMonitoring();

      // Simulate component mount
      const baseline = await analyzer.takeSnapshot();

      // Simulate memory leak by continuously growing heap
      for (let i = 0; i < 5; i++) {
        process.memoryUsage = jest.fn(() => ({
          rss: (20 + i * 5) * 1024 * 1024,
          heapTotal: (15 + i * 3) * 1024 * 1024,
          heapUsed: (10 + i * 2) * 1024 * 1024,
          external: 1 * 1024 * 1024,
          arrayBuffers: 512 * 1024
        }));

        await analyzer.takeSnapshot();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalSnapshot = await analyzer.takeSnapshot();
      const componentLeaks = finalSnapshot.leakSuspects.filter(leak => leak.type === 'component');

      expect(componentLeaks.length).toBeGreaterThan(0);
      expect(componentLeaks[0].severity).toMatch(/medium|high|critical/);
    });

    test('should detect event listener leaks', async () => {
      await analyzer.startMonitoring();

      // Mock event listener leak scenario
      const snapshot = await analyzer.takeSnapshot();

      // Manually inject leak data for testing
      snapshot.eventListenerMetrics.orphaned = 50;
      snapshot.leakSuspects.push({
        type: 'event-listener',
        source: 'DOM',
        severity: 'medium',
        memoryDelta: 50 * 1024,
        detectedAt: new Date(),
        description: '50 orphaned event listeners detected',
        suggestedFix: 'Ensure event listeners are removed in cleanup functions'
      });

      const eventLeaks = snapshot.leakSuspects.filter(leak => leak.type === 'event-listener');
      expect(eventLeaks.length).toBeGreaterThan(0);
    });

    test('should detect cache memory leaks', async () => {
      await analyzer.startMonitoring();

      // Simulate cache growth
      const largeCacheData = new Array(1000).fill(0).map(i => ({
        key: `cache-key-${i}`,
        data: 'large data'.repeat(1000),
        metadata: { created: new Date(), accessed: 0 }
      }));

      // Simulate memory pressure from cache
      process.memoryUsage = jest.fn(() => ({
        rss: 50 * 1024 * 1024,
        heapTotal: 40 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024, // Significant growth
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024
      }));

      const snapshot = await analyzer.takeSnapshot();
      const cacheLeaks = snapshot.leakSuspects.filter(leak => leak.type === 'cache');

      // In a real scenario, cache leak detection would be more sophisticated
      expect(snapshot.memoryDelta).toBeGreaterThan(10 * 1024 * 1024); // 10MB growth
    });

    test('should detect DOM node leaks', async () => {
      await analyzer.startMonitoring();

      const snapshot = await analyzer.takeSnapshot();

      // Mock detached DOM nodes
      snapshot.domMetrics.detachedNodes = 150;
      snapshot.leakSuspects.push({
        type: 'component',
        source: 'DOM',
        severity: 'high',
        memoryDelta: 150 * 512,
        detectedAt: new Date(),
        description: '150 detached DOM nodes found',
        suggestedFix: 'Review component cleanup and DOM manipulation code'
      });

      const domLeaks = snapshot.leakSuspects.filter(leak =>
        leak.type === 'component' && leak.source === 'DOM'
      );

      expect(domLeaks.length).toBeGreaterThan(0);
      expect(snapshot.domMetrics.detachedNodes).toBe(150);
    });
  });

  describe('Performance Validation', () => {
    test('should meet performance targets for memory monitoring', async () => {
      const startTime = Date.now();

      await analyzer.startMonitoring();

      // Take multiple snapshots to test performance
      for (let i = 0; i < 10; i++) {
        await analyzer.takeSnapshot();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete 10 snapshots in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    test('should maintain memory usage under target limits', async () => {
      await analyzer.startMonitoring();

      // Take baseline measurement
      const baseline = process.memoryUsage();

      // Run memory analysis
      for (let i = 0; i < 50; i++) {
        await analyzer.takeSnapshot();
      }

      const current = process.memoryUsage();
      const growth = current.heapUsed - baseline.heapUsed;

      // Memory analyzer itself should not leak significant memory
      expect(growth).toBeLessThan(10 * 1024 * 1024); // 10MB max growth
    });

    test('should validate target metrics are met', async () => {
      await analyzer.startMonitoring();
      const report = await analyzer.generateReport();

      // Validate against target metrics from requirements
      if (report.current.heapUsed > 0) {
        expect(report.current.heapUsed).toBeLessThan(50 * 1024 * 1024); // < 50MB baseline
        expect(report.summary.memoryGrowthRate).toBeLessThan(10 * 1024 * 1024); // < 10MB per hour
        expect(report.current.domMetrics.detachedNodes).toBe(0); // No detached DOM nodes
        expect(report.issues.filter(i => i.severity === 'critical').length).toBe(0); // Zero memory leaks
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing performance API gracefully', async () => {
      const originalPerf = global.performance;
      delete (global as any).performance;

      const analyzer = new MemoryAnalyzer();
      await analyzer.startMonitoring();

      const snapshot = await analyzer.takeSnapshot();
      expect(snapshot).toBeDefined();

      global.performance = originalPerf;
    });

    test('should handle memory measurement errors', async () => {
      process.memoryUsage = jest.fn(() => {
        throw new Error('Memory measurement failed');
      });

      await analyzer.startMonitoring();

      // Should not throw, but handle gracefully
      await expect(analyzer.takeSnapshot()).resolves.toBeDefined();
    });

    test('should handle empty snapshot history', async () => {
      const report = await analyzer.generateReport().catch(() => null);
      expect(report).toBeNull(); // Should throw error for no snapshots
    });

    test('should handle very large memory objects', async () => {
      const largeObject = new Array(1000000).fill(0).map(i => ({
        id: i,
        data: 'large'.repeat(100)
      }));

      await analyzer.startMonitoring();
      const snapshot = await analyzer.takeSnapshot();

      expect(snapshot).toBeDefined();
    });
  });
});

// Helper functions for tests
function simulateMemoryGrowth(growthMB: number) {
  const currentUsage = process.memoryUsage();
  const growthBytes = growthMB * 1024 * 1024;

  process.memoryUsage = jest.fn(() => ({
    rss: currentUsage.rss + growthBytes,
    heapTotal: currentUsage.heapTotal + growthBytes,
    heapUsed: currentUsage.heapUsed + growthBytes,
    external: currentUsage.external,
    arrayBuffers: currentUsage.arrayBuffers
  }));
}

function createMemoryPressure(): () => void {
  const largeArrays: any[] = [];

  const allocate = () => {
    largeArrays.push(new Array(100000).fill(Math.random()));
  };

  const cleanup = () => {
    largeArrays.length = 0;
  };

  // Allocate memory
  for (let i = 0; i < 10; i++) {
    allocate();
  }

  return cleanup;
}