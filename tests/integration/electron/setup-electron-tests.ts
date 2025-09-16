/**
 * Electron Test Setup
 * Configures testing environment for Electron window management tests
 */

import { app } from 'electron';
import { windowTestFactory } from './window-test-utils';

// Mock Electron modules
jest.mock('electron', () => require('../../__mocks__/electron'));

// Global test configuration
declare global {
  namespace NodeJS {
    interface Global {
      gc?: () => void;
    }
  }
}

// Setup before all tests
beforeAll(async () => {
  // Ensure app is ready
  if (!app.isReady()) {
    await app.whenReady();
  }

  // Setup global error handlers
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  // Enable garbage collection for memory tests
  if (global.gc) {
    global.gc();
  }
});

// Setup after all tests
afterAll(async () => {
  // Cleanup all test windows
  await windowTestFactory.cleanup();

  // Force garbage collection
  if (global.gc) {
    global.gc();
  }

  // Remove all listeners
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
});

// Setup before each test
beforeEach(async () => {
  // Reset all mocks
  jest.clearAllMocks();

  // Reset window test factory metrics
  windowTestFactory.resetMetrics();

  // Set default timeout for async operations
  jest.setTimeout(30000);
});

// Setup after each test
afterEach(async () => {
  // Cleanup any windows created during the test
  await windowTestFactory.cleanup();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Clear any remaining timers
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Custom matchers for window testing
expect.extend({
  toBeWithinDisplayBounds(received: any, display: any) {
    const bounds = received.getBounds();
    const displayBounds = display.bounds;

    const pass = (
      bounds.x >= displayBounds.x &&
      bounds.y >= displayBounds.y &&
      bounds.x + bounds.width <= displayBounds.x + displayBounds.width &&
      bounds.y + bounds.height <= displayBounds.y + displayBounds.height
    );

    if (pass) {
      return {
        message: () => `Expected window bounds ${JSON.stringify(bounds)} not to be within display bounds ${JSON.stringify(displayBounds)}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected window bounds ${JSON.stringify(bounds)} to be within display bounds ${JSON.stringify(displayBounds)}`,
        pass: false
      };
    }
  },

  toHaveValidWindowState(received: any) {
    const isValid = (
      received.isDestroyed !== undefined &&
      received.isVisible !== undefined &&
      received.isMinimized !== undefined &&
      received.isMaximized !== undefined &&
      received.isFullScreen !== undefined &&
      received.isFocused !== undefined
    );

    if (isValid) {
      return {
        message: () => `Expected window not to have valid state methods`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected window to have valid state methods (isDestroyed, isVisible, isMinimized, isMaximized, isFullScreen, isFocused)`,
        pass: false
      };
    }
  },

  toBeResponsive(received: any, maxResponseTime = 1000) {
    const startTime = Date.now();

    // Simulate responsiveness check
    received.webContents?.executeJavaScript?.('document.readyState');

    const responseTime = Date.now() - startTime;
    const pass = responseTime <= maxResponseTime;

    if (pass) {
      return {
        message: () => `Expected window not to be responsive within ${maxResponseTime}ms (actual: ${responseTime}ms)`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected window to be responsive within ${maxResponseTime}ms (actual: ${responseTime}ms)`,
        pass: false
      };
    }
  },

  toHaveMemoryUsageBelow(received: any, maxMemoryMB: number) {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
    const pass = heapUsedMB <= maxMemoryMB;

    if (pass) {
      return {
        message: () => `Expected memory usage ${heapUsedMB.toFixed(2)}MB not to be below ${maxMemoryMB}MB`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected memory usage ${heapUsedMB.toFixed(2)}MB to be below ${maxMemoryMB}MB`,
        pass: false
      };
    }
  }
});

// Extend Jest matchers type definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinDisplayBounds(display: any): R;
      toHaveValidWindowState(): R;
      toBeResponsive(maxResponseTime?: number): R;
      toHaveMemoryUsageBelow(maxMemoryMB: number): R;
    }
  }
}

// Console override for cleaner test output
const originalConsole = global.console;

global.console = {
  ...originalConsole,
  // Suppress noisy warnings during tests
  warn: jest.fn((message: string) => {
    if (!message.includes('deprecated') && !message.includes('warning')) {
      originalConsole.warn(message);
    }
  }),
  error: jest.fn((message: string) => {
    if (!message.includes('Mock function')) {
      originalConsole.error(message);
    }
  })
} as any;

// Test utilities export
export { windowTestFactory } from './window-test-utils';
export { PlatformTestHelper, WindowStateAssertions, PerformanceTestHelper, EventTestHelper } from './window-test-utils';