/**
 * Jest Setup for Performance Tests
 * Global test configuration and utilities
 */

const axios = require('axios');

// Extend Jest timeout globally for performance tests
jest.setTimeout(600000); // 10 minutes

// Global test configuration
global.PERFORMANCE_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  slaTargets: {
    responseTime: 1000,   // 1 second P95
    availability: 99.9,   // 99.9% uptime
    throughput: 100,      // 100 RPS minimum
    errorRate: 1          // 1% maximum error rate
  },
  testOptions: {
    iterations: 50,
    warmupIterations: 5,
    timeout: 10000,
    retries: 3
  }
};

// Global utilities for performance testing
global.performanceUtils = {
  /**
   * Wait for application to be ready
   */
  async waitForApp(url = global.PERFORMANCE_CONFIG.baseUrl, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(`${url}/api/health`, {
          timeout: 5000
        });

        if (response.status === 200) {
          console.log('✅ Application is ready for testing');
          return true;
        }
      } catch (error) {
        // Application not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Application at ${url} not ready after ${timeout}ms`);
  },

  /**
   * Measure execution time
   */
  async measureTime(fn) {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    return {
      result,
      duration: endTime - startTime
    };
  },

  /**
   * Calculate statistics from array of numbers
   */
  calculateStats(values) {
    if (values.length === 0) return null;

    const sorted = values.sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: sorted.length
    };
  },

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Console formatting for performance test output
const originalConsoleLog = console.log;
console.log = (...args) => {
  const timestamp = new Date().toISOString();
  originalConsoleLog(`[${timestamp}]`, ...args);
};

// Global error handling for performance tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Setup before all tests
beforeAll(async () => {
  console.log('🚀 Setting up performance test environment...');
  console.log(`Base URL: ${global.PERFORMANCE_CONFIG.baseUrl}`);
  console.log(`SLA Targets:`, global.PERFORMANCE_CONFIG.slaTargets);

  // Wait for application to be ready
  try {
    await global.performanceUtils.waitForApp();
  } catch (error) {
    console.warn('⚠️  Application readiness check failed:', error.message);
    console.warn('Tests may fail if the application is not running');
  }
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up performance test environment...');

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Per-test setup
beforeEach(() => {
  // Clear any previous timers
  jest.clearAllTimers();
});

// Per-test cleanup
afterEach(() => {
  // Reset any global state
  jest.restoreAllMocks();
});