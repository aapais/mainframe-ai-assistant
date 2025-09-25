/**
 * Memory Usage Analysis Example
 *
 * Demonstrates how to use the MemoryAnalyzer for comprehensive memory monitoring
 * in the mainframe knowledge base assistant application.
 */

import MemoryAnalyzer, { MemoryAnalysisReport } from './MemoryAnalyzer';

/**
 * Comprehensive memory analysis setup for the application
 */
export async function setupMemoryMonitoring() {
  console.log('🚀 Setting up comprehensive memory monitoring...');

  const analyzer = new MemoryAnalyzer({
    snapshotInterval: 15000, // 15 seconds for detailed monitoring
    maxSnapshots: 1000,
    leakThreshold: 5 * 1024 * 1024, // 5MB threshold
    gcPressureThreshold: 50, // 50ms GC threshold
  });

  // Start monitoring
  await analyzer.startMonitoring();

  // Set up event listeners for real-time alerts
  analyzer.on('monitoring:started', baseline => {
    console.log(`📊 Memory monitoring started. Baseline: ${formatBytes(baseline.heapUsed)}`);
  });

  analyzer.on('snapshot:taken', snapshot => {
    console.log(`📸 Memory snapshot: ${formatBytes(snapshot.heapUsed)} heap`);

    // Check for immediate concerns
    if (snapshot.leakSuspects.length > 0) {
      console.warn(`⚠️ ${snapshot.leakSuspects.length} memory leak suspects detected`);
    }
  });

  analyzer.on('gc:occurred', gcEvent => {
    if (gcEvent.duration > 50) {
      console.warn(`🗑️ Long GC pause: ${gcEvent.duration.toFixed(2)}ms`);
    }
  });

  analyzer.on('dom:large-mutation', mutation => {
    console.warn(`🌳 Large DOM mutation: +${mutation.addedNodes} -${mutation.removedNodes} nodes`);
  });

  analyzer.on('long-session:alert', issues => {
    console.error(`🚨 Long session memory alert: ${issues.length} critical issues`);
    issues.forEach(issue => {
      console.error(`  - ${issue.type}: ${issue.description}`);
    });
  });

  return analyzer;
}

/**
 * Component-specific memory tracking
 */
export function trackComponentMemory(analyzer: MemoryAnalyzer, componentName: string) {
  const startTime = Date.now();
  let mountSnapshot: any;

  return {
    onMount: async () => {
      mountSnapshot = await analyzer.takeSnapshot();
      console.log(`🎯 ${componentName} mounted. Memory: ${formatBytes(mountSnapshot.heapUsed)}`);
    },

    onUnmount: async () => {
      const unmountSnapshot = await analyzer.takeSnapshot();
      const memoryDelta = unmountSnapshot.heapUsed - mountSnapshot.heapUsed;
      const duration = Date.now() - startTime;

      console.log(`🔄 ${componentName} unmounted after ${duration}ms`);
      console.log(`   Memory delta: ${formatBytes(memoryDelta)}`);

      if (memoryDelta > 1024 * 1024) {
        // 1MB threshold
        console.warn(
          `⚠️ ${componentName} may have memory leak: ${formatBytes(memoryDelta)} not freed`
        );
      }
    },

    onUpdate: async (props: any, state: any) => {
      const updateSnapshot = await analyzer.takeSnapshot();
      const memoryDelta = updateSnapshot.heapUsed - mountSnapshot.heapUsed;

      if (memoryDelta > 5 * 1024 * 1024) {
        // 5MB threshold
        console.warn(`⚠️ ${componentName} memory growth: ${formatBytes(memoryDelta)}`);
        console.log(`   Props size: ${getObjectSize(props)}`);
        console.log(`   State size: ${getObjectSize(state)}`);
      }
    },
  };
}

/**
 * Service memory tracking
 */
export function trackServiceMemory(serviceName: string) {
  const serviceStartMemory = process.memoryUsage().heapUsed;
  const serviceStartTime = Date.now();

  return {
    operation: async (operationName: string, fn: Function) => {
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();

      try {
        const result = await fn();

        const endMemory = process.memoryUsage().heapUsed;
        const memoryDelta = endMemory - startMemory;
        const duration = Date.now() - startTime;

        console.log(
          `📊 ${serviceName}.${operationName}: ${duration}ms, ${formatBytes(memoryDelta)} memory`
        );

        if (memoryDelta > 10 * 1024 * 1024) {
          // 10MB threshold
          console.warn(
            `⚠️ ${serviceName}.${operationName} used excessive memory: ${formatBytes(memoryDelta)}`
          );
        }

        return result;
      } catch (error) {
        const endMemory = process.memoryUsage().heapUsed;
        const memoryDelta = endMemory - startMemory;
        console.error(
          `❌ ${serviceName}.${operationName} failed with ${formatBytes(memoryDelta)} memory delta`
        );
        throw error;
      }
    },

    getStats: () => {
      const currentMemory = process.memoryUsage().heapUsed;
      const totalDelta = currentMemory - serviceStartMemory;
      const uptime = Date.now() - serviceStartTime;

      return {
        serviceName,
        uptime,
        totalMemoryDelta: totalDelta,
        averageMemoryGrowthRate: totalDelta / (uptime / 1000), // bytes per second
      };
    },
  };
}

/**
 * Cache memory analysis
 */
export function analyzeCacheMemory(cache: any, cacheName: string) {
  const analysis = {
    cacheSize: 0,
    itemCount: 0,
    averageItemSize: 0,
    largestItems: [] as Array<{ key: string; size: number }>,
    recommendations: [] as string[],
  };

  if (cache instanceof Map) {
    analysis.itemCount = cache.size;
    const itemSizes: Array<{ key: string; size: number }> = [];

    cache.forEach((value, key) => {
      const size = getObjectSize(value);
      analysis.cacheSize += size;
      itemSizes.push({ key: String(key), size });
    });

    analysis.averageItemSize = analysis.cacheSize / analysis.itemCount;
    analysis.largestItems = itemSizes.sort((a, b) => b.size - a.size).slice(0, 5);

    // Generate recommendations
    if (analysis.cacheSize > 50 * 1024 * 1024) {
      // 50MB
      analysis.recommendations.push('Cache size exceeds 50MB - consider implementing LRU eviction');
    }

    if (analysis.averageItemSize > 1024 * 1024) {
      // 1MB
      analysis.recommendations.push('Large average item size - consider compression or chunking');
    }

    if (analysis.itemCount > 10000) {
      analysis.recommendations.push('High item count - consider partitioning or size limits');
    }
  }

  console.log(`📦 Cache analysis for ${cacheName}:`);
  console.log(`   Size: ${formatBytes(analysis.cacheSize)}`);
  console.log(`   Items: ${analysis.itemCount}`);
  console.log(`   Average item size: ${formatBytes(analysis.averageItemSize)}`);

  if (analysis.largestItems.length > 0) {
    console.log(`   Largest items:`);
    analysis.largestItems.forEach(item => {
      console.log(`     ${item.key}: ${formatBytes(item.size)}`);
    });
  }

  if (analysis.recommendations.length > 0) {
    console.log(`   Recommendations:`);
    analysis.recommendations.forEach(rec => {
      console.log(`     - ${rec}`);
    });
  }

  return analysis;
}

/**
 * Run comprehensive memory analysis
 */
export async function runMemoryAnalysis(analyzer: MemoryAnalyzer): Promise<MemoryAnalysisReport> {
  console.log('🔍 Running comprehensive memory analysis...');

  // Force garbage collection if available
  if (global.gc) {
    console.log('🗑️ Running garbage collection...');
    global.gc();
  }

  // Wait for GC to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Generate report
  const report = await analyzer.generateReport();

  console.log('📊 Memory Analysis Results:');
  console.log(`   Overall Health: ${report.summary.overallHealth.toUpperCase()}`);
  console.log(`   Current Heap: ${formatBytes(report.current.heapUsed)}`);
  console.log(`   Growth Rate: ${formatBytes(report.summary.memoryGrowthRate)}/hour`);
  console.log(`   Leak Suspects: ${report.summary.leakCount}`);

  if (report.issues.length > 0) {
    console.log(`   Issues Found:`);
    report.issues.forEach((issue, index) => {
      console.log(`     ${index + 1}. ${issue.type}: ${issue.description}`);
      console.log(`        Fix: ${issue.suggestedFix}`);
    });
  }

  if (report.optimizations.length > 0) {
    console.log(`   Optimization Opportunities:`);
    report.optimizations.forEach((opt, index) => {
      console.log(`     ${index + 1}. ${opt.description}`);
      console.log(`        Effort: ${opt.effort}, Savings: ${formatBytes(opt.expectedSavings)}`);
    });
  }

  console.log(`   Recommendations:`);
  report.summary.recommendations.forEach((rec, index) => {
    console.log(`     ${index + 1}. ${rec}`);
  });

  return report;
}

/**
 * Start long-running memory test
 */
export async function runLongSessionTest(analyzer: MemoryAnalyzer, durationHours: number = 1) {
  console.log(`🕐 Starting ${durationHours}h long-session memory test...`);

  const testStartTime = Date.now();
  const testDuration = durationHours * 60 * 60 * 1000;

  // Simulate application usage
  const simulateUsage = async () => {
    const scenarios = [
      () => simulateSearch(),
      () => simulateKBEntry(),
      () => simulateDataImport(),
      () => simulateCacheUsage(),
      () => simulateUIInteraction(),
    ];

    while (Date.now() - testStartTime < testDuration) {
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      try {
        await scenario();
      } catch (error) {
        console.error('Simulation error:', error.message);
      }

      // Random delay between 1-5 seconds
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 4000));
    }
  };

  // Start simulation
  const simulationPromise = simulateUsage();

  // Start long session monitoring
  analyzer.startLongSessionMonitoring(durationHours);

  // Wait for test completion
  await simulationPromise;

  // Generate final report
  const finalReport = await analyzer.generateReport();

  console.log('✅ Long-session test completed');
  return finalReport;
}

// Helper functions for simulation
async function simulateSearch() {
  // Simulate search operation with memory allocation
  const fakeResults = Array(100)
    .fill(0)
    .map(() => ({
      id: Math.random().toString(36),
      title: 'Sample KB Entry ' + Math.random(),
      content: 'Lorem ipsum '.repeat(100),
      metadata: { score: Math.random(), timestamp: new Date() },
    }));

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Clear results (simulating cleanup)
  fakeResults.length = 0;
}

async function simulateKBEntry() {
  // Simulate KB entry creation with large content
  const entry = {
    title: 'Test Entry',
    content: 'Large content '.repeat(1000),
    metadata: {
      tags: Array(20)
        .fill(0)
        .map(() => 'tag-' + Math.random()),
      category: 'Test',
      attachments: Array(5)
        .fill(0)
        .map(() => ({ data: 'binary data '.repeat(100) })),
    },
  };

  await new Promise(resolve => setTimeout(resolve, 200));
}

async function simulateDataImport() {
  // Simulate large data import
  const importData = Array(1000)
    .fill(0)
    .map(() => ({
      id: Math.random().toString(36),
      data: 'Large import data '.repeat(50),
      relationships: Array(10)
        .fill(0)
        .map(() => Math.random()),
    }));

  await new Promise(resolve => setTimeout(resolve, 500));
}

async function simulateCacheUsage() {
  // Simulate cache operations
  const cache = new Map();

  for (let i = 0; i < 100; i++) {
    cache.set(`key-${i}`, {
      data: 'Cached data '.repeat(50),
      metadata: { created: new Date(), accessed: 0 },
    });
  }

  await new Promise(resolve => setTimeout(resolve, 100));
  cache.clear();
}

async function simulateUIInteraction() {
  // Simulate DOM manipulation
  if (typeof document !== 'undefined') {
    const elements = Array(50)
      .fill(0)
      .map(() => {
        const div = document.createElement('div');
        div.innerHTML = 'Test content '.repeat(20);
        div.className = 'test-element';
        return div;
      });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Cleanup
    elements.forEach(el => el.remove());
  }
}

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getObjectSize(obj: any): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return JSON.stringify(obj).length * 2; // Rough estimate
  }
}

export { formatBytes, getObjectSize };
