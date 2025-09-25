/**
 * Electron Performance Monitoring Usage Examples
 * Demonstrates how to use the comprehensive performance monitoring system
 */

import {
  ElectronPerformanceMetrics,
  RendererPerformanceTracker,
  SearchPerformanceMonitor,
  IPCPerformanceTracker,
  MemoryLeakDetector,
  WindowOperationTracker,
  PerformanceIntegration,
  SimplePerformanceMonitor,
  initializeMainPerformanceMonitoring,
  quickSetupMainProcess,
  quickSetupRendererProcess,
  useComponentPerformance,
} from './index';

/**
 * Example 1: Quick Setup for Main Process
 */
export function exampleMainProcessSetup() {
  console.log('=== Example 1: Main Process Quick Setup ===');

  // Quick setup - starts monitoring automatically
  const performance = quickSetupMainProcess();

  // Listen for performance violations
  performance.on('alert-added', alert => {
    console.log(`Alert: ${alert.message}`);

    if (alert.severity === 'critical') {
      console.error('CRITICAL PERFORMANCE ISSUE:', alert);
      // Take immediate action
    }
  });

  // Get current performance status
  setTimeout(async () => {
    const status = performance.getCurrentData();
    console.log('Current Performance Status:', {
      overallHealth: status?.overallHealth,
      alertCount: status?.alertCount,
      timestamp: status?.timestamp,
    });
  }, 5000);

  return performance;
}

/**
 * Example 2: Renderer Process Performance Tracking
 */
export function exampleRendererSetup() {
  console.log('=== Example 2: Renderer Process Setup ===');

  const tracker = quickSetupRendererProcess();

  // Track component render performance
  const componentName = 'SearchResults';
  const renderId = tracker.trackComponentRenderStart(componentName);

  // Simulate component rendering
  setTimeout(() => {
    const renderTime = tracker.trackComponentRenderEnd(renderId, componentName);
    console.log(`${componentName} rendered in ${renderTime.toFixed(2)}ms`);
  }, 20); // Simulate slow render > 16ms target

  return tracker;
}

/**
 * Example 3: Search Performance Monitoring
 */
export async function exampleSearchMonitoring() {
  console.log('=== Example 3: Search Performance Monitoring ===');

  const searchMonitor = new SearchPerformanceMonitor(1000); // 1 second target

  // Track individual search
  const searchId = searchMonitor.startSearch('mainframe cobol', 'advanced', {
    filters: { category: 'programming' },
  });

  // Simulate search operation
  await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate slow search

  const metrics = searchMonitor.endSearch(searchId, 25, false); // 25 results, cache miss
  console.log('Search Performance:', {
    query: metrics?.query,
    responseTime: metrics?.responseTime,
    isTargetMet: metrics?.isTargetMet,
    resultCount: metrics?.resultCount,
  });

  // Track search with wrapper
  const results = await searchMonitor.trackSearch(
    'db2 database',
    async () => {
      // Simulate database search
      await new Promise(resolve => setTimeout(resolve, 800));
      return ['result1', 'result2', 'result3'];
    },
    'semantic'
  );

  console.log('Search Results:', results);
  console.log('Search Summary:', searchMonitor.getSummary());

  return searchMonitor;
}

/**
 * Example 4: Memory Leak Detection
 */
export function exampleMemoryMonitoring() {
  console.log('=== Example 4: Memory Leak Detection ===');

  const memoryDetector = new MemoryLeakDetector({
    targetGrowthRate: 5, // 5MB/hour instead of default 10MB/hour
    snapshotInterval: 10000, // 10 seconds for demo
    leakDetectionThreshold: 2,
  });

  // Listen for leak detection
  memoryDetector.on('leak-detected', leak => {
    console.log('Memory Leak Detected:', {
      type: leak.type,
      severity: leak.severity,
      description: leak.description,
      growthRate: leak.growthRate,
      possibleCauses: leak.possibleCauses.slice(0, 2), // Show first 2 causes
    });
  });

  // Listen for threshold violations
  memoryDetector.on('threshold-violation', violation => {
    console.log('Memory Threshold Violation:', violation.message);
  });

  memoryDetector.startMonitoring();

  // Simulate memory growth for demo
  const leakyObjects: any[] = [];
  const leakInterval = setInterval(() => {
    // Simulate memory leak
    for (let i = 0; i < 1000; i++) {
      leakyObjects.push({
        id: i,
        data: new Array(1000).fill(Math.random()),
        timestamp: Date.now(),
      });
    }
  }, 5000);

  // Stop simulation after 30 seconds
  setTimeout(() => {
    clearInterval(leakInterval);
    console.log('Memory Analysis:', memoryDetector.getCurrentAnalysis());
  }, 30000);

  return memoryDetector;
}

/**
 * Example 5: IPC Performance Tracking
 */
export function exampleIPCMonitoring() {
  console.log('=== Example 5: IPC Performance Tracking ===');

  const ipcTracker = new IPCPerformanceTracker(3); // 3ms target instead of 5ms

  // Listen for performance violations
  ipcTracker.on('performance-violation', violation => {
    console.log('IPC Performance Issue:', violation.message);
  });

  // Simulate IPC operations
  async function simulateIPCOperations() {
    for (let i = 0; i < 10; i++) {
      const ipcId = ipcTracker.trackIPCStart(`test-channel-${i}`, 'renderer-to-main');

      // Simulate IPC processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

      ipcTracker.trackIPCEnd(ipcId);
    }

    console.log('IPC Performance Summary:', ipcTracker.getPerformanceSummary());
    console.log('Channel Stats:', ipcTracker.getChannelStats());
  }

  simulateIPCOperations();

  return ipcTracker;
}

/**
 * Example 6: Window Operation Tracking
 */
export function exampleWindowMonitoring() {
  console.log('=== Example 6: Window Operation Tracking ===');

  const windowTracker = new WindowOperationTracker(50); // 50ms target instead of 100ms

  // Listen for slow operations
  windowTracker.on('performance-violation', violation => {
    console.log('Slow Window Operation:', violation.message);
  });

  // Simulate window operations
  function simulateWindowOperations() {
    const operations = ['show', 'hide', 'resize', 'move', 'focus'];

    operations.forEach((operation, index) => {
      setTimeout(() => {
        const operationId = windowTracker.startOperation(operation, 1); // Window ID 1

        // Simulate operation processing time
        setTimeout(
          () => {
            windowTracker.endOperation(operationId);
          },
          Math.random() * 100 + 20
        ); // 20-120ms
      }, index * 1000);
    });
  }

  simulateWindowOperations();

  // Get summary after all operations
  setTimeout(() => {
    console.log('Window Performance Summary:', windowTracker.getPerformanceSummary());
  }, 6000);

  return windowTracker;
}

/**
 * Example 7: Integrated Performance Monitoring
 */
export function exampleIntegratedMonitoring() {
  console.log('=== Example 7: Integrated Performance Monitoring ===');

  const integration = new PerformanceIntegration();

  // Listen for overall health changes
  integration.on('data-collected', data => {
    console.log('Performance Update:', {
      overallHealth: data.overallHealth,
      alertCount: data.alertCount,
      timestamp: new Date(data.timestamp).toLocaleTimeString(),
    });
  });

  // Listen for critical alerts
  integration.on('critical-alert', alert => {
    console.error('CRITICAL ALERT:', alert);
    // Send notification, log to monitoring system, etc.
  });

  integration.startMonitoring();

  // Get comprehensive report after 30 seconds
  setTimeout(() => {
    const report = integration.getPerformanceReport();
    console.log('Comprehensive Performance Report:', {
      summary: report.summary,
      alertCount: report.alerts.length,
      recommendations: report.recommendations.slice(0, 3), // Show first 3 recommendations
    });
  }, 30000);

  return integration;
}

/**
 * Example 8: Simple Performance Monitor (Easiest Setup)
 */
export function exampleSimpleMonitor() {
  console.log('=== Example 8: Simple Performance Monitor ===');

  const monitor = new SimplePerformanceMonitor({
    thresholds: {
      renderTime: 8, // Stricter 8ms target
      searchResponse: 500, // 500ms instead of 1000ms
      ipcLatency: 3, // 3ms instead of 5ms
      memoryGrowthRate: 5, // 5MB/hour instead of 10MB/hour
    },
  });

  // Subscribe to updates
  const unsubscribeUpdate = monitor.onUpdate(data => {
    console.log('Simple Monitor Update:', data.overallHealth);
  });

  const unsubscribeAlert = monitor.onAlert(alert => {
    console.log('Simple Monitor Alert:', alert.message);
  });

  monitor.start();

  // Stop monitoring and cleanup after 60 seconds
  setTimeout(() => {
    console.log('Final Status:', monitor.getStatus()?.overallHealth);
    console.log('Final Summary:', monitor.getSummary().summary);

    monitor.stop();
    unsubscribeUpdate();
    unsubscribeAlert();
  }, 60000);

  return monitor;
}

/**
 * Example 9: React Component Performance Tracking
 */
export function ExampleReactComponent() {
  console.log('=== Example 9: React Component Performance ===');

  const { trackRenderStart, trackRenderEnd, tracker } = useComponentPerformance('ExampleComponent');

  React.useEffect(() => {
    // Manual tracking
    trackRenderStart('mounting');

    // Simulate expensive operation
    const heavyComputation = () => {
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.random();
      }
      return result;
    };

    heavyComputation();

    return () => {
      trackRenderEnd('unmounting');
    };
  }, [trackRenderStart, trackRenderEnd]);

  // Get component performance data
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (tracker) {
        const summary = tracker.getPerformanceSummary();
        console.log('Component Performance Summary:', {
          totalRenders: summary.totalRenders,
          averageRenderTime: summary.averageRenderTime.toFixed(2),
          violationRate: (summary.violationRate * 100).toFixed(1) + '%',
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [tracker]);

  return React.createElement(
    'div',
    {
      style: { padding: '20px', border: '1px solid #ccc' },
    },
    'Example React Component with Performance Tracking'
  );
}

/**
 * Example 10: Advanced Custom Tracking
 */
export async function exampleCustomTracking() {
  console.log('=== Example 10: Advanced Custom Tracking ===');

  const integration = new PerformanceIntegration();
  integration.startMonitoring();

  // Custom performance tracking wrapper
  async function trackOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    targetMs: number
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      console.log(
        `Operation "${operationName}": ${duration.toFixed(2)}ms`,
        duration > targetMs ? '❌ SLOW' : '✅ FAST'
      );

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`Operation "${operationName}" failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  // Track various operations
  await trackOperation(
    'Database Query',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return 'query results';
    },
    100
  );

  await trackOperation(
    'File System Operation',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'file data';
    },
    100
  );

  await trackOperation(
    'Network Request',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 800));
      return 'network response';
    },
    1000
  );

  // Export performance data
  setTimeout(() => {
    const csvData = integration.exportAllData('csv');
    console.log('CSV Export Preview:', csvData.split('\n').slice(0, 3).join('\n'));
  }, 5000);

  return integration;
}

/**
 * Example 11: Performance Benchmarking
 */
export async function examplePerformanceBenchmarking() {
  console.log('=== Example 11: Performance Benchmarking ===');

  const integration = new PerformanceIntegration();
  const monitors = integration.getMonitors();

  // Benchmark different scenarios
  const benchmarks = {
    lightRender: async () => {
      for (let i = 0; i < 10; i++) {
        const renderId = monitors.renderer.trackComponentRenderStart('LightComponent');
        await new Promise(resolve => setTimeout(resolve, 5)); // Fast render
        monitors.renderer.trackComponentRenderEnd(renderId, 'LightComponent');
      }
    },

    heavyRender: async () => {
      for (let i = 0; i < 10; i++) {
        const renderId = monitors.renderer.trackComponentRenderStart('HeavyComponent');
        await new Promise(resolve => setTimeout(resolve, 25)); // Slow render
        monitors.renderer.trackComponentRenderEnd(renderId, 'HeavyComponent');
      }
    },

    fastSearch: async () => {
      for (let i = 0; i < 5; i++) {
        await monitors.search.trackSearch(`fast-query-${i}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return [`result-${i}`];
        });
      }
    },

    slowSearch: async () => {
      for (let i = 0; i < 5; i++) {
        await monitors.search.trackSearch(`slow-query-${i}`, async () => {
          await new Promise(resolve => setTimeout(resolve, 1500));
          return [`result-${i}`];
        });
      }
    },
  };

  // Run benchmarks
  console.log('Running performance benchmarks...');

  await benchmarks.lightRender();
  await benchmarks.heavyRender();
  await benchmarks.fastSearch();
  await benchmarks.slowSearch();

  // Analyze results
  setTimeout(() => {
    const renderSummary = monitors.renderer.getPerformanceSummary();
    const searchSummary = monitors.search.getSummary();

    console.log('Benchmark Results:', {
      render: {
        totalRenders: renderSummary.totalRenders,
        averageTime: renderSummary.averageRenderTime.toFixed(2),
        violationRate: (renderSummary.violationRate * 100).toFixed(1) + '%',
      },
      search: {
        totalSearches: searchSummary.totalSearches,
        averageTime: searchSummary.averageResponseTime.toFixed(2),
        targetMeetRate: (searchSummary.targetMeetRate * 100).toFixed(1) + '%',
      },
    });
  }, 1000);

  return integration;
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running All Electron Performance Monitoring Examples\n');

  try {
    // Note: In a real application, you would run these based on the process type
    // and specific use cases. Some examples are for main process, others for renderer.

    console.log('Starting examples...\n');

    // These can run in any process
    await exampleSearchMonitoring();
    await exampleCustomTracking();
    await examplePerformanceBenchmarking();

    console.log('\n✅ All examples completed successfully!');
    console.log('\n📊 Key Performance Targets:');
    console.log('  • Render Time: < 16ms (60 FPS)');
    console.log('  • Search Response: < 1000ms');
    console.log('  • Memory Growth: < 10MB/hour');
    console.log('  • IPC Latency: < 5ms');
    console.log('  • Window Operations: < 100ms');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export for use in other modules
export default {
  exampleMainProcessSetup,
  exampleRendererSetup,
  exampleSearchMonitoring,
  exampleMemoryMonitoring,
  exampleIPCMonitoring,
  exampleWindowMonitoring,
  exampleIntegratedMonitoring,
  exampleSimpleMonitor,
  ExampleReactComponent,
  exampleCustomTracking,
  examplePerformanceBenchmarking,
  runAllExamples,
};

/**
 * Quick Start Instructions:
 *
 * 1. For Main Process:
 *    import { quickSetupMainProcess } from './performance';
 *    const performance = quickSetupMainProcess();
 *
 * 2. For Renderer Process:
 *    import { quickSetupRendererProcess } from './performance';
 *    const tracker = quickSetupRendererProcess();
 *
 * 3. For Simple Setup:
 *    import { SimplePerformanceMonitor } from './performance';
 *    const monitor = new SimplePerformanceMonitor().start();
 *
 * 4. For React Components:
 *    import { useComponentPerformance } from './performance';
 *    const { trackRenderStart, trackRenderEnd } = useComponentPerformance('MyComponent');
 *
 * 5. For Dashboard:
 *    import { PerformanceDashboard } from './performance';
 *    <PerformanceDashboard />
 */
