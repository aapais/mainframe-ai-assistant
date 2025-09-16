/**
 * Integration Test Setup
 *
 * Global setup and configuration for integration tests
 * including test environment initialization and mock configurations.
 */

import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Mock implementations for Node.js APIs not available in JSDOM
global.performance = require('perf_hooks').performance;

// Mock Electron APIs
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: jest.fn(),
      send: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    },
    store: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    }
  }
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = '';
  thresholds = [];
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File API
global.File = class MockFile {
  constructor(
    public bits: BlobPart[],
    public name: string,
    public options?: FilePropertyBag
  ) {}

  size = 1024;
  type = 'text/plain';
  lastModified = Date.now();

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size));
  }

  text(): Promise<string> {
    return Promise.resolve('mock file content');
  }

  stream(): ReadableStream {
    return new ReadableStream();
  }

  slice(): Blob {
    return new Blob();
  }
} as any;

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue([])
  }
});

// Console warnings filter
const originalWarn = console.warn;
console.warn = (...args) => {
  // Filter out React warnings during tests
  const message = args[0];
  if (
    typeof message === 'string' &&
    (
      message.includes('Warning: ReactDOM.render is deprecated') ||
      message.includes('Warning: findDOMNode is deprecated') ||
      message.includes('Warning: componentWillReceiveProps has been renamed')
    )
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Performance monitoring setup
if (process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
  const { PerformanceObserver } = require('perf_hooks');

  const obs = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      if (entry.duration > 1000) { // Log slow operations
        console.warn(`Slow operation detected: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
      }
    });
  });

  obs.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
}

// Memory leak detection
if (process.env.ENABLE_MEMORY_PROFILING === 'true') {
  let initialMemory = 0;

  beforeAll(() => {
    if (global.gc) global.gc();
    initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
  });

  afterAll(() => {
    if (global.gc) global.gc();
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryGrowth = finalMemory - initialMemory;

    if (memoryGrowth > 10 * 1024 * 1024) { // 10MB threshold
      console.warn(`Potential memory leak detected: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB growth`);
    }
  });
}

// Global test utilities
global.testUtils = {
  // Wait for async operations to complete
  waitForAsyncOperations: () => new Promise(resolve => setTimeout(resolve, 0)),

  // Mock timer helpers
  advanceTimersByTime: (ms: number) => {
    jest.advanceTimersByTime(ms);
  },

  // Performance measurement helpers
  measurePerformance: async (operation: () => Promise<any>) => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return { result, duration: end - start };
  }
};

// Extend Jest matchers for integration tests
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHavePerformanceWithin(received: { duration: number }, maxMs: number) {
    const pass = received.duration <= maxMs;
    if (pass) {
      return {
        message: () => `expected operation taking ${received.duration.toFixed(2)}ms not to be within ${maxMs}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected operation taking ${received.duration.toFixed(2)}ms to be within ${maxMs}ms`,
        pass: false,
      };
    }
  }
});

// Add custom Jest matchers types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHavePerformanceWithin(maxMs: number): R;
    }
  }

  const testUtils: {
    waitForAsyncOperations: () => Promise<void>;
    advanceTimersByTime: (ms: number) => void;
    measurePerformance: <T>(operation: () => Promise<T>) => Promise<{ result: T; duration: number }>;
  };
}

export {};