/**
 * Jest Setup for Storage Tests
 * Global test configuration and utilities
 */

import 'jest-extended';
import * as fs from 'fs';
import * as path from 'path';

// Extend Jest matchers for better assertions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidKBEntry(): R;
      toBeValidSearchResult(): R;
      toHaveReasonablePerformance(maxTime: number): R;
      toBeWithinMemoryLimit(maxMB: number): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidKBEntry(received: any) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.title === 'string' &&
      typeof received.problem === 'string' &&
      typeof received.solution === 'string' &&
      typeof received.category === 'string' &&
      received.created_at instanceof Date &&
      received.updated_at instanceof Date;

    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(received)} not to be a valid KB entry`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${JSON.stringify(received)} to be a valid KB entry with all required fields`,
        pass: false,
      };
    }
  },

  toBeValidSearchResult(received: any) {
    const pass = received &&
      typeof received.score === 'number' &&
      received.score >= 0 &&
      received.score <= 1 &&
      received.entry &&
      typeof received.entry.id === 'string';

    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(received)} not to be a valid search result`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${JSON.stringify(received)} to be a valid search result with score 0-1 and entry`,
        pass: false,
      };
    }
  },

  toHaveReasonablePerformance(received: number, maxTime: number) {
    const pass = received <= maxTime;

    if (pass) {
      return {
        message: () => `Expected ${received}ms to exceed ${maxTime}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be less than or equal to ${maxTime}ms`,
        pass: false,
      };
    }
  },

  toBeWithinMemoryLimit(received: number, maxMB: number) {
    const receivedMB = received / 1024 / 1024;
    const pass = receivedMB <= maxMB;

    if (pass) {
      return {
        message: () => `Expected ${receivedMB.toFixed(2)}MB to exceed ${maxMB}MB`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${receivedMB.toFixed(2)}MB to be less than or equal to ${maxMB}MB`,
        pass: false,
      };
    }
  }
});

// Global test configuration
const TEST_CONFIG = {
  timeout: {
    unit: 10000,      // 10 seconds
    integration: 30000, // 30 seconds
    performance: 60000, // 60 seconds
    e2e: 120000       // 2 minutes
  },
  memory: {
    warningThreshold: 100 * 1024 * 1024, // 100MB
    errorThreshold: 500 * 1024 * 1024    // 500MB
  },
  performance: {
    acceptableResponseTime: 1000, // 1 second
    slowQueryThreshold: 2000      // 2 seconds
  }
};

// Memory monitoring
let initialMemoryUsage: NodeJS.MemoryUsage;

beforeAll(() => {
  initialMemoryUsage = process.memoryUsage();
  
  // Setup temporary directories
  const tempDirs = [
    path.join(__dirname, '..', 'temp'),
    path.join(__dirname, '..', 'temp', 'unit'),
    path.join(__dirname, '..', 'temp', 'integration'),
    path.join(__dirname, '..', 'temp', 'performance'),
    path.join(__dirname, '..', 'temp', 'e2e')
  ];

  tempDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  console.log('Storage Test Suite initialized');
  console.log(`Initial memory usage: ${(initialMemoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
});

afterAll(() => {
  const finalMemoryUsage = process.memoryUsage();
  const memoryIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
  
  console.log(`Final memory usage: ${(finalMemoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  
  if (memoryIncrease > TEST_CONFIG.memory.warningThreshold) {
    console.warn(`⚠️  High memory usage detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
  }
  
  // Cleanup temporary directories
  const tempDir = path.join(__dirname, '..', 'temp');
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error}`);
    }
  }
  
  console.log('Storage Test Suite cleanup completed');
});

// Performance monitoring for each test
beforeEach(() => {
  // Store test start time for performance monitoring
  (global as any).testStartTime = Date.now();
  (global as any).testStartMemory = process.memoryUsage().heapUsed;
});

afterEach(() => {
  const testEndTime = Date.now();
  const testEndMemory = process.memoryUsage().heapUsed;
  const testDuration = testEndTime - (global as any).testStartTime;
  const memoryIncrease = testEndMemory - (global as any).testStartMemory;
  
  // Log performance warnings
  if (testDuration > TEST_CONFIG.performance.slowQueryThreshold) {
    console.warn(`⏰ Slow test detected: ${testDuration}ms`);
  }
  
  if (memoryIncrease > TEST_CONFIG.memory.warningThreshold) {
    console.warn(`🧠 High memory usage in test: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  }
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Mock console methods for cleaner test output (only in CI)
if (process.env.CI) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error // Keep errors for debugging
  };
}

// Global utilities for tests
(global as any).TEST_CONFIG = TEST_CONFIG;

// Helper function to create test database path
(global as any).createTestDbPath = (testName: string): string => {
  const sanitizedName = testName.replace(/[^a-zA-Z0-9]/g, '-');
  return path.join(__dirname, '..', 'temp', `test-${sanitizedName}-${Date.now()}.db`);
};

// Helper function to cleanup test files
(global as any).cleanupTestFiles = (files: string[]): void => {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.warn(`Failed to cleanup file ${file}: ${error}`);
      }
    }
  });
};

// Helper function to wait for condition
(global as any).waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Helper function to measure execution time
(global as any).measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> => {
  const start = Date.now();
  const result = await fn();
  const time = Date.now() - start;
  return { result, time };
};

// Export test configuration for use in other files
export { TEST_CONFIG };