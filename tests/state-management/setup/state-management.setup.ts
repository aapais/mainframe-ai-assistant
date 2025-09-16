/**
 * State Management Test Setup
 *
 * Global setup and utilities for state management testing:
 * - Mock implementations
 * - Test utilities
 * - Performance monitoring
 * - Memory leak detection
 * - Custom matchers
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage with quota simulation
class MockStorage {
  private store: Record<string, string> = {};
  private quota = 10 * 1024 * 1024; // 10MB
  private used = 0;

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    const size = new Blob([value]).size;
    if (this.used + size > this.quota) {
      throw new Error('QuotaExceededError');
    }

    const oldSize = this.store[key] ? new Blob([this.store[key]]).size : 0;
    this.used = this.used - oldSize + size;
    this.store[key] = value;
  }

  removeItem(key: string): void {
    if (this.store[key]) {
      const size = new Blob([this.store[key]]).size;
      this.used -= size;
      delete this.store[key];
    }
  }

  clear(): void {
    this.store = {};
    this.used = 0;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  // Test utilities
  setQuota(quota: number): void {
    this.quota = quota;
  }

  getUsage(): number {
    return this.used;
  }
}

const mockStorage = new MockStorage();
Object.defineProperty(window, 'localStorage', { value: mockStorage });
Object.defineProperty(window, 'sessionStorage', { value: new MockStorage() });

// Mock performance.memory if not available
if (!(performance as any).memory) {
  (performance as any).memory = {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
  };
}

// Mock requestIdleCallback
global.requestIdleCallback = global.requestIdleCallback || ((cb: any) => {
  const start = Date.now();
  return setTimeout(() => {
    cb({
      didTimeout: false,
      timeRemaining() {
        return Math.max(0, 50 - (Date.now() - start));
      },
    });
  }, 1);
});

global.cancelIdleCallback = global.cancelIdleCallback || ((id: any) => {
  clearTimeout(id);
});

// Global test utilities
declare global {
  var __TEST_UTILS__: {
    mockStorage: MockStorage;
    enableGC: () => void;
    measureMemory: () => number;
    waitForStateUpdate: (predicate: () => boolean, timeout?: number) => Promise<void>;
  };
}

global.__TEST_UTILS__ = {
  mockStorage,

  enableGC: () => {
    if ((global as any).gc) {
      (global as any).gc();
    }
  },

  measureMemory: () => {
    return (performance as any).memory?.usedJSHeapSize || 0;
  },

  waitForStateUpdate: async (predicate: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (!predicate() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (!predicate()) {
      throw new Error('State update timeout');
    }
  },
};

// Console error suppression for expected errors
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args[0];

  // Suppress known test-related warnings
  if (
    typeof message === 'string' &&
    (
      message.includes('Warning: ReactDOM.render is deprecated') ||
      message.includes('Warning: findDOMNode is deprecated') ||
      message.includes('act(...) is not supported') ||
      message.includes('useLayoutEffect does nothing on the server')
    )
  ) {
    return;
  }

  originalError.apply(console, args);
};

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Clear storage
  mockStorage.clear();

  // Force garbage collection if available
  global.__TEST_UTILS__.enableGC();

  // Clear any timers
  jest.clearAllTimers();
});

// Test suite lifecycle
beforeAll(() => {
  // Silence React 18 warnings in tests
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (args[0]?.includes?.('React 18')) return;
    originalWarn(...args);
  };
});

export {};