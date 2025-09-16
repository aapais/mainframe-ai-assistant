/**
 * Performance Test Setup
 * Configures environment for performance validation tests
 */

const { performance } = require('perf_hooks');

// Global test configuration
global.PERFORMANCE_TEST_CONFIG = {
  requirements: {
    responseTime: {
      p95Threshold: 1000, // 1 second
      description: '<1s response time for 95% of queries'
    },
    cacheHitRate: {
      threshold: 90, // 90%
      description: '90%+ cache hit rate'
    },
    concurrentUsers: {
      minimum: 100,
      description: '100+ concurrent users support'
    },
    databasePerformance: {
      threshold: 100, // 100ms
      description: '<100ms database query performance'
    },
    memoryUsage: {
      threshold: 50, // 50MB
      description: '<50MB memory usage for UI components'
    }
  },
  
  testEnvironment: {
    nodeEnv: 'test',
    performanceMode: true,
    mockServices: true,
    enableMetrics: true
  }
};

// Performance monitoring setup
beforeAll(async () => {
  // Enable garbage collection for memory tests
  if (global.gc) {
    global.gc();
  }
  
  // Set up performance observers
  setupPerformanceObservers();
  
  // Initialize test metrics collection
  global.PERFORMANCE_METRICS = {
    testStart: performance.now(),
    suiteMetrics: new Map(),
    globalCounters: {
      totalQueries: 0,
      totalCacheHits: 0,
      totalErrors: 0
    }
  };
  
  console.log('\n🚀 Performance Validation Test Suite Starting...');
  console.log('📊 Requirements being validated:');
  Object.entries(global.PERFORMANCE_TEST_CONFIG.requirements).forEach(([key, req]) => {
    console.log(`   ✓ ${req.description}`);
  });
  console.log('');
});

beforeEach(() => {
  // Record test start time
  global.CURRENT_TEST_START = performance.now();
  
  // Clear previous test metrics
  if (global.gc) {
    global.gc();
  }
});

afterEach(() => {
  const testDuration = performance.now() - global.CURRENT_TEST_START;
  
  // Record test metrics
  const testName = expect.getState().currentTestName;
  if (testName) {
    global.PERFORMANCE_METRICS.suiteMetrics.set(testName, {
      duration: testDuration,
      timestamp: Date.now()
    });
  }
});

afterAll(async () => {
  const totalDuration = performance.now() - global.PERFORMANCE_METRICS.testStart;
  
  console.log('\n📈 Performance Test Suite Summary:');
  console.log(`   ⏱️  Total Duration: ${Math.round(totalDuration)}ms`);
  console.log(`   🔍 Total Queries: ${global.PERFORMANCE_METRICS.globalCounters.totalQueries}`);
  console.log(`   💾 Cache Hits: ${global.PERFORMANCE_METRICS.globalCounters.totalCacheHits}`);
  console.log(`   ❌ Errors: ${global.PERFORMANCE_METRICS.globalCounters.totalErrors}`);
  
  // Generate final test report
  await generateTestSummaryReport();
  
  // Cleanup
  cleanupPerformanceObservers();
  
  if (global.gc) {
    global.gc();
  }
});

function setupPerformanceObservers() {
  // Set up performance observation if available
  try {
    const { PerformanceObserver } = require('perf_hooks');
    
    global.PERFORMANCE_OBSERVER = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.entryType === 'measure') {
          // Track performance measurements
          console.log(`📊 Performance: ${entry.name} took ${Math.round(entry.duration)}ms`);
        }
      });
    });
    
    global.PERFORMANCE_OBSERVER.observe({ entryTypes: ['measure'] });
  } catch (error) {
    console.warn('Performance Observer not available:', error.message);
  }
}

function cleanupPerformanceObservers() {
  if (global.PERFORMANCE_OBSERVER) {
    global.PERFORMANCE_OBSERVER.disconnect();
    delete global.PERFORMANCE_OBSERVER;
  }
}

async function generateTestSummaryReport() {
  const fs = require('fs').promises;
  const path = require('path');
  
  const report = {
    timestamp: new Date().toISOString(),
    testSuite: 'Performance Validation',
    totalDuration: performance.now() - global.PERFORMANCE_METRICS.testStart,
    requirements: global.PERFORMANCE_TEST_CONFIG.requirements,
    testMetrics: Object.fromEntries(global.PERFORMANCE_METRICS.suiteMetrics),
    globalCounters: global.PERFORMANCE_METRICS.globalCounters,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage()
    }
  };
  
  try {
    const reportPath = path.join(__dirname, '..', 'reports', `test-summary-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Test summary report saved: ${reportPath}`);
  } catch (error) {
    console.error('Failed to save test summary report:', error.message);
  }
}

// Utility functions for tests
global.recordPerformanceMetric = function(name, value, unit = 'ms') {
  if (!global.PERFORMANCE_METRICS.customMetrics) {
    global.PERFORMANCE_METRICS.customMetrics = [];
  }
  
  global.PERFORMANCE_METRICS.customMetrics.push({
    name,
    value,
    unit,
    timestamp: performance.now(),
    testName: expect.getState().currentTestName
  });
};

global.incrementCounter = function(counterName, amount = 1) {
  if (!global.PERFORMANCE_METRICS.globalCounters[counterName]) {
    global.PERFORMANCE_METRICS.globalCounters[counterName] = 0;
  }
  global.PERFORMANCE_METRICS.globalCounters[counterName] += amount;
};

// Custom matchers for performance assertions
expect.extend({
  toMeetPerformanceRequirement(received, requirement) {
    const config = global.PERFORMANCE_TEST_CONFIG.requirements[requirement];
    
    if (!config) {
      return {
        message: () => `Unknown performance requirement: ${requirement}`,
        pass: false
      };
    }
    
    let pass = false;
    let message = '';
    
    switch (requirement) {
      case 'responseTime':
        pass = received.p95 < config.p95Threshold;
        message = `Expected P95 response time ${received.p95}ms to be less than ${config.p95Threshold}ms`;
        break;
        
      case 'cacheHitRate':
        pass = received.hitRate >= config.threshold;
        message = `Expected cache hit rate ${received.hitRate}% to be >= ${config.threshold}%`;
        break;
        
      case 'concurrentUsers':
        pass = received.maxSupportedUsers >= config.minimum;
        message = `Expected max supported users ${received.maxSupportedUsers} to be >= ${config.minimum}`;
        break;
        
      case 'databasePerformance':
        pass = received.p95 < config.threshold;
        message = `Expected P95 database query time ${received.p95}ms to be < ${config.threshold}ms`;
        break;
        
      case 'memoryUsage':
        pass = received.memoryUsageMB < config.threshold;
        message = `Expected memory usage ${received.memoryUsageMB}MB to be < ${config.threshold}MB`;
        break;
        
      default:
        message = `Unknown requirement type: ${requirement}`;
    }
    
    return {
      message: () => message,
      pass
    };
  },
  
  toHaveAcceptablePerformance(received, thresholds = {}) {
    const defaultThresholds = {
      responseTime: 1000,
      errorRate: 1,
      throughput: 10
    };
    
    const merged = { ...defaultThresholds, ...thresholds };
    
    const issues = [];
    
    if (received.responseTime > merged.responseTime) {
      issues.push(`Response time ${received.responseTime}ms exceeds ${merged.responseTime}ms`);
    }
    
    if (received.errorRate > merged.errorRate) {
      issues.push(`Error rate ${received.errorRate}% exceeds ${merged.errorRate}%`);
    }
    
    if (received.throughput < merged.throughput) {
      issues.push(`Throughput ${received.throughput} below minimum ${merged.throughput}`);
    }
    
    return {
      message: () => issues.length > 0 
        ? `Performance issues found: ${issues.join(', ')}`
        : 'Performance is acceptable',
      pass: issues.length === 0
    };
  }
});

// Export configuration for external access
module.exports = {
  PERFORMANCE_TEST_CONFIG: global.PERFORMANCE_TEST_CONFIG
};
