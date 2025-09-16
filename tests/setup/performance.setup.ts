/**
 * Performance Test Setup
 *
 * Global setup for performance tests including environment configuration,
 * performance monitoring, and cleanup utilities
 */

import { performance } from 'perf_hooks';

// Global performance tracking
declare global {
  var __PERFORMANCE_START_TIME: number;
  var __PERFORMANCE_METRICS: Map<string, number[]>;
  var __TEST_MEMORY_BASELINE: number;
}

// Initialize global performance tracking
global.__PERFORMANCE_START_TIME = performance.now();
global.__PERFORMANCE_METRICS = new Map();
global.__TEST_MEMORY_BASELINE = 0;

// Performance measurement utilities
global.measurePerformance = function(testName: string, duration: number) {
  if (!global.__PERFORMANCE_METRICS.has(testName)) {
    global.__PERFORMANCE_METRICS.set(testName, []);
  }
  global.__PERFORMANCE_METRICS.get(testName)!.push(duration);
};

global.getPerformanceMetrics = function(testName?: string) {
  if (testName) {
    return global.__PERFORMANCE_METRICS.get(testName) || [];
  }
  return Object.fromEntries(global.__PERFORMANCE_METRICS);
};

global.clearPerformanceMetrics = function() {
  global.__PERFORMANCE_METRICS.clear();
};

// Memory tracking utilities
global.getMemoryUsage = function() {
  if (process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }

  // Browser environment fallback
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      external: 0,
      rss: 0
    };
  }

  return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
};

global.setMemoryBaseline = function() {
  const usage = global.getMemoryUsage();
  global.__TEST_MEMORY_BASELINE = usage.heapUsed;
  return usage;
};

global.getMemoryIncrease = function() {
  const current = global.getMemoryUsage();
  return current.heapUsed - global.__TEST_MEMORY_BASELINE;
};

// Performance assertion helpers
global.expectPerformance = function(actualTime: number, expectedTime: number, tolerance: number = 0.1) {
  const maxAllowed = expectedTime * (1 + tolerance);
  expect(actualTime).toBeLessThanOrEqual(maxAllowed);
};

global.expectMemoryIncrease = function(increaseBytes: number, maxAllowed: number) {
  expect(increaseBytes).toBeLessThanOrEqual(maxAllowed);
};

// Test environment detection
global.isPerformanceTest = function() {
  return process.env.NODE_ENV === 'test' && process.env.JEST_PERFORMANCE === 'true';
};

// Force garbage collection helper (if available)
global.forceGC = function() {
  if (global.gc) {
    global.gc();
    return true;
  }
  return false;
};

// Performance logging utilities
global.logPerformance = function(message: string, ...data: any[]) {
  if (process.env.PERFORMANCE_LOGGING === 'true') {
    console.log(`[PERF] ${message}`, ...data);
  }
};

// Setup Jest performance matchers
expect.extend({
  toBeFasterThan(received: number, expected: number) {
    const pass = received < expected;
    if (pass) {
      return {
        message: () => `Expected ${received}ms not to be faster than ${expected}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be faster than ${expected}ms`,
        pass: false,
      };
    }
  },

  toBeWithinPerformanceRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    if (pass) {
      return {
        message: () => `Expected ${received}ms not to be within range ${min}ms-${max}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be within range ${min}ms-${max}ms`,
        pass: false,
      };
    }
  },

  toHaveGoodCacheHitRate(received: number, minimumRate: number = 0.8) {
    const pass = received >= minimumRate;
    if (pass) {
      return {
        message: () => `Expected cache hit rate ${received} not to be above ${minimumRate}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected cache hit rate ${received} to be at least ${minimumRate}`,
        pass: false,
      };
    }
  }
});

// Performance test configuration
const PERFORMANCE_CONFIG = {
  TARGETS: {
    SEARCH_RESPONSE_TIME: 1000,     // <1s
    AUTOCOMPLETE_TIME: 50,          // <50ms
    UI_RENDER_TIME: 200,            // <200ms
    MEMORY_LIMIT: 256 * 1024 * 1024, // 256MB
    CACHE_HIT_RATE: 0.90,           // >90%
    ERROR_RATE: 0.05,               // <5%
    THROUGHPUT_MIN: 10              // >10 req/sec
  },

  TOLERANCES: {
    TIME_TOLERANCE: 0.1,            // 10% tolerance
    MEMORY_TOLERANCE: 0.2,          // 20% tolerance
    THROUGHPUT_TOLERANCE: 0.15      // 15% tolerance
  },

  SAMPLING: {
    MIN_SAMPLES: 10,                // Minimum samples for reliable metrics
    MAX_SAMPLES: 1000,              // Maximum samples to prevent memory issues
    WARMUP_SAMPLES: 5               // Samples to discard for warmup
  }
};

global.PERFORMANCE_CONFIG = PERFORMANCE_CONFIG;

// Performance test helpers
global.createPerformanceTest = function(testName: string, testFn: Function, options: any = {}) {
  return async function performanceTestWrapper() {
    const {
      warmupRuns = PERFORMANCE_CONFIG.SAMPLING.WARMUP_SAMPLES,
      measurementRuns = PERFORMANCE_CONFIG.SAMPLING.MIN_SAMPLES,
      timeout = 30000,
      memoryCheck = true
    } = options;

    console.log(`🧪 Starting performance test: ${testName}`);

    // Set memory baseline
    if (memoryCheck) {
      global.setMemoryBaseline();
    }

    // Warmup runs
    for (let i = 0; i < warmupRuns; i++) {
      await testFn();
    }

    // Force garbage collection before measurements
    global.forceGC();

    // Measurement runs
    const measurements: number[] = [];
    for (let i = 0; i < measurementRuns; i++) {
      const startTime = performance.now();
      await testFn();
      const duration = performance.now() - startTime;
      measurements.push(duration);
    }

    // Calculate statistics
    const stats = {
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      p50: measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.5)],
      p95: measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)],
      p99: measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.99)]
    };

    // Memory check
    let memoryIncrease = 0;
    if (memoryCheck) {
      memoryIncrease = global.getMemoryIncrease();
    }

    // Store results
    global.measurePerformance(testName, stats.avg);

    console.log(`📊 Performance results for ${testName}:`);
    console.log(`   Average: ${stats.avg.toFixed(2)}ms`);
    console.log(`   P95: ${stats.p95.toFixed(2)}ms`);
    console.log(`   Range: ${stats.min.toFixed(2)}ms - ${stats.max.toFixed(2)}ms`);

    if (memoryCheck && memoryIncrease > 0) {
      console.log(`   Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }

    return {
      testName,
      measurements,
      stats,
      memoryIncrease,
      timestamp: new Date()
    };
  };
};

// Benchmark comparison helper
global.compareBenchmarks = function(baseline: number[], current: number[], testName: string) {
  const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const currentAvg = current.reduce((a, b) => a + b, 0) / current.length;
  const improvement = ((baselineAvg - currentAvg) / baselineAvg) * 100;

  console.log(`📈 Benchmark comparison for ${testName}:`);
  console.log(`   Baseline: ${baselineAvg.toFixed(2)}ms`);
  console.log(`   Current: ${currentAvg.toFixed(2)}ms`);
  console.log(`   ${improvement >= 0 ? 'Improvement' : 'Regression'}: ${Math.abs(improvement).toFixed(1)}%`);

  return {
    baseline: baselineAvg,
    current: currentAvg,
    improvement,
    isRegression: improvement < -5 // More than 5% slower is considered regression
  };
};

// Jest hooks for performance tests
beforeAll(async () => {
  global.logPerformance('Performance test suite starting');

  // Initialize performance tracking
  global.clearPerformanceMetrics();

  // Set process title for monitoring
  if (process.title) {
    process.title = 'jest-performance-tests';
  }

  // Configure memory limits
  if (process.env.NODE_OPTIONS && !process.env.NODE_OPTIONS.includes('max-old-space-size')) {
    console.warn('Consider setting NODE_OPTIONS="--max-old-space-size=4096" for performance tests');
  }
});

afterAll(async () => {
  const totalTime = performance.now() - global.__PERFORMANCE_START_TIME;
  const finalMemory = global.getMemoryUsage();

  global.logPerformance(`Performance test suite completed in ${totalTime.toFixed(2)}ms`);
  global.logPerformance(`Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

  // Generate summary report
  const metrics = global.getPerformanceMetrics();
  if (Object.keys(metrics).length > 0) {
    console.log('\n📋 Performance Test Summary:');
    Object.entries(metrics).forEach(([testName, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`   ${testName}: ${avg.toFixed(2)}ms (${times.length} samples)`);
    });
  }
});

// Performance test timeout warning
const originalTimeout = setTimeout;
global.setTimeout = function(callback: Function, delay: number, ...args: any[]) {
  if (delay > 10000) { // Warn about timeouts > 10s
    console.warn(`⚠️ Long timeout detected: ${delay}ms - consider optimizing test`);
  }
  return originalTimeout(callback, delay, ...args);
};

// Export configuration for tests
export { PERFORMANCE_CONFIG };
export default PERFORMANCE_CONFIG;