/**
 * Setup for Search Functional Tests
 * Initializes test environment and utilities
 */

import { jest } from '@jest/globals';

// Extend Jest timeout for comprehensive tests
jest.setTimeout(60000);

// Global test configuration
global.FUNCTIONAL_TEST_CONFIG = {
  timeout: 60000,
  maxResults: 100,
  performanceThresholds: {
    searchResponseTime: 1000,
    cacheHitRate: 0.7,
    indexingTime: 5000
  },
  testDataSize: {
    small: 100,
    medium: 500,
    large: 1000,
    xlarge: 2000
  },
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000
  }
};

// Mock performance APIs if not available
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    toJSON: jest.fn(() => ({}))
  } as any;
}

// Global utilities for functional tests
global.testUtils = {
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  retry: async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await global.testUtils.wait(delay);
        }
      }
    }

    throw lastError!;
  },

  generateRandomString: (length: number): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  measureTime: async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const startTime = performance.now();
    const result = await operation();
    const duration = performance.now() - startTime;
    return { result, duration };
  }
};

// Console configuration for tests
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: process.env.VERBOSE_TESTS === 'true' ? originalConsole.log : jest.fn(),
  debug: process.env.VERBOSE_TESTS === 'true' ? originalConsole.debug : jest.fn(),
  info: originalConsole.info,
  warn: originalConsole.warn,
  error: originalConsole.error
};

// Error handling setup
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Memory monitoring
if (process.env.MONITOR_MEMORY === 'true') {
  const memoryCheck = () => {
    const usage = process.memoryUsage();
    if (usage.heapUsed > 512 * 1024 * 1024) { // 512MB threshold
      console.warn('High memory usage detected:', {
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
      });
    }
  };

  setInterval(memoryCheck, 10000); // Check every 10 seconds
}

// Cleanup function for after tests
global.cleanup = async (): Promise<void> => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Clear any remaining timers
  jest.clearAllTimers();

  // Reset modules if needed
  jest.resetModules();
};

// Test data cleanup
beforeEach(() => {
  // Clear any test-specific data
});

afterEach(async () => {
  // Cleanup after each test
  await global.cleanup();
});

export {};