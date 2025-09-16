/**
 * IPC Test Suite Setup
 * Global setup for IPC communication tests
 */

import '@testing-library/jest-dom';

// Mock Electron before any imports
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  BrowserWindow: jest.fn(() => ({
    webContents: {
      send: jest.fn(),
      isDestroyed: jest.fn(() => false)
    },
    isDestroyed: jest.fn(() => false)
  }))
}));

// Global test configuration
global.console = {
  ...console,
  // Suppress console logs during tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn, // Keep warnings visible
  error: console.error // Keep errors visible
};

// Enhanced error handling for async operations
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process during tests
});

// Global test utilities
global.testUtils = {
  // Utility to wait for a condition
  waitFor: async (condition: () => boolean, timeout: number = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },
  
  // Utility to create mock IPC responses
  createMockIPCResponse: <T>(data: T, success: boolean = true, metadata?: any) => ({
    success,
    data: success ? data : undefined,
    error: success ? undefined : {
      code: 'TEST_ERROR',
      message: 'Test error message',
      details: data
    },
    metadata: {
      executionTime: Math.random() * 100,
      cached: false,
      ...metadata
    }
  }),
  
  // Utility to simulate network delays
  delay: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Utility to generate test data
  generateKBEntry: (id: string) => ({
    id,
    title: `Test Entry ${id}`,
    content: `Test content for entry ${id}`,
    category: 'Test',
    tags: [`tag-${id}`, 'test'],
    created: Date.now(),
    updated: Date.now(),
    usageCount: Math.floor(Math.random() * 100),
    successfulUses: Math.floor(Math.random() * 80),
    unsuccessfulUses: Math.floor(Math.random() * 20)
  }),
  
  // Utility to generate search results
  generateSearchResults: (query: string, count: number = 5) => 
    Array.from({ length: count }, (_, i) => ({
      id: `result-${i}`,
      title: `Search Result ${i} for "${query}"`,
      content: `Content matching ${query}...`,
      category: 'search',
      relevanceScore: Math.random(),
      snippet: `Snippet containing ${query}`
    }))
};

// Performance monitoring setup
const performanceMonitor = {
  startTime: Date.now(),
  testTimes: new Map<string, number>(),
  
  startTest: (testName: string) => {
    performanceMonitor.testTimes.set(testName, Date.now());
  },
  
  endTest: (testName: string) => {
    const startTime = performanceMonitor.testTimes.get(testName);
    if (startTime) {
      const duration = Date.now() - startTime;
      console.debug(`Test "${testName}" completed in ${duration}ms`);
      performanceMonitor.testTimes.delete(testName);
    }
  }
};

global.performanceMonitor = performanceMonitor;

// Setup beforeEach and afterEach hooks
beforeEach(() => {
  const testName = expect.getState()?.currentTestName || 'unknown';
  performanceMonitor.startTest(testName);
  
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  const testName = expect.getState()?.currentTestName || 'unknown';
  performanceMonitor.endTest(testName);
  
  // Clean up any remaining timers
  jest.clearAllTimers();
});

// Memory leak detection
const initialMemoryUsage = process.memoryUsage();
let testMemoryUsage = initialMemoryUsage;

afterEach(() => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const currentMemory = process.memoryUsage();
  const memoryIncrease = currentMemory.heapUsed - testMemoryUsage.heapUsed;
  
  // Warn if memory usage increases significantly
  if (memoryIncrease > 50 * 1024 * 1024) { // 50MB
    console.warn(`Memory usage increased by ${memoryIncrease / 1024 / 1024}MB during test`);
  }
  
  testMemoryUsage = currentMemory;
});

// Custom matchers for IPC testing
expect.extend({
  toBeValidIPCResponse(received) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.success === 'boolean' &&
      (received.success ? received.data !== undefined : received.error !== undefined);
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid IPC response`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid IPC response`,
        pass: false
      };
    }
  },
  
  toHaveIPCError(received, expectedCode?: string) {
    const hasError = received?.success === false && received?.error;
    const codeMatches = !expectedCode || received?.error?.code === expectedCode;
    
    const pass = hasError && codeMatches;
    
    if (pass) {
      return {
        message: () => `expected IPC response not to have error${expectedCode ? ` with code ${expectedCode}` : ''}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected IPC response to have error${expectedCode ? ` with code ${expectedCode}` : ''}`,
        pass: false
      };
    }
  },
  
  toHaveExecutionTime(received, maxTime: number) {
    const executionTime = received?.metadata?.executionTime;
    const pass = typeof executionTime === 'number' && executionTime <= maxTime;
    
    if (pass) {
      return {
        message: () => `expected execution time ${executionTime}ms to be greater than ${maxTime}ms`,
        pass: true
      };
    } else {
      return {
        message: () => `expected execution time ${executionTime}ms to be less than or equal to ${maxTime}ms`,
        pass: false
      };
    }
  }
});

// Declare custom matcher types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidIPCResponse(): R;
      toHaveIPCError(expectedCode?: string): R;
      toHaveExecutionTime(maxTime: number): R;
    }
  }
  
  interface Global {
    testUtils: {
      waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
      createMockIPCResponse: <T>(data: T, success?: boolean, metadata?: any) => any;
      delay: (ms: number) => Promise<void>;
      generateKBEntry: (id: string) => any;
      generateSearchResults: (query: string, count?: number) => any[];
    };
    performanceMonitor: {
      startTime: number;
      testTimes: Map<string, number>;
      startTest: (testName: string) => void;
      endTest: (testName: string) => void;
    };
  }
}

export {};
