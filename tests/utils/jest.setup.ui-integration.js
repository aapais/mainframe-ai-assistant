/**
 * Jest Setup for UI Integration Tests
 * Global setup and configuration for testing MVP1 v8 transparency features
 */

import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

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

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  },
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
});

// Mock crypto API for encryption tests
Object.defineProperty(window, 'crypto', {
  writable: true,
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
      decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
      generateKey: jest.fn().mockResolvedValue({}),
      importKey: jest.fn().mockResolvedValue({}),
      exportKey: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
    },
  },
});

// Mock Electron API
const mockElectronAPI = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  send: jest.fn(),
  _callLog: [],
  _listeners: new Map(),
};

Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

// Global test utilities
global.testUtils = {
  // Accessibility testing
  checkColorContrast: (element, expectedRatio = 4.5) => {
    const style = window.getComputedStyle(element);
    const bgColor = style.backgroundColor;
    const textColor = style.color;

    const parseRgb = (rgb) => {
      const match = rgb.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
      return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
    };

    const getLuminance = (rgb) => {
      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const bgRgb = parseRgb(bgColor);
    const textRgb = parseRgb(textColor);
    const bgLum = getLuminance(bgRgb);
    const textLum = getLuminance(textRgb);
    const contrastRatio = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

    return {
      ratio: contrastRatio,
      passes: contrastRatio >= expectedRatio,
      bgColor,
      textColor,
    };
  },

  // Accenture branding validation
  validateAccentureBranding: (element) => {
    const style = window.getComputedStyle(element);
    const accenturePurple = 'rgb(161, 0, 255)'; // #A100FF

    return {
      hasAccenturePurple: style.backgroundColor === accenturePurple ||
                         style.borderColor === accenturePurple ||
                         style.color === accenturePurple,
      backgroundMatches: style.backgroundColor === accenturePurple,
      borderMatches: style.borderColor === accenturePurple,
      textMatches: style.color === accenturePurple,
    };
  },

  // Mock data generators
  generateCostScenario: (type) => {
    const scenarios = {
      low: { estimatedCost: 0.15, tokensToUse: 1000, operation: 'Simple search' },
      medium: { estimatedCost: 2.45, tokensToUse: 5000, operation: 'Document analysis' },
      high: { estimatedCost: 15.80, tokensToUse: 25000, operation: 'Complex processing' },
      critical: { estimatedCost: 50.00, tokensToUse: 100000, operation: 'Batch processing' },
    };

    return {
      ...scenarios[type],
      confidence: 'high',
      timestamp: Date.now(),
    };
  },

  generateMockKBEntry: (overrides = {}) => ({
    id: 'kb-entry-123',
    title: 'Test KB Entry',
    content: 'This is test content for the KB entry.',
    summary: 'Test summary',
    tags: ['test', 'mock'],
    category: 'General',
    author: 'Test Author',
    lastModified: new Date().toISOString(),
    version: 1,
    status: 'published',
    metadata: {
      wordCount: 500,
      readingTime: 2,
      difficulty: 'beginner',
    },
    attachments: [],
    ...overrides,
  }),

  // IPC testing utilities
  waitForIpcCall: async (channel, timeout = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const call = mockElectronAPI._callLog.find(call => call.channel === channel);
      if (call) return call;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`IPC call to ${channel} not found within ${timeout}ms`);
  },

  // Performance testing
  measureRenderTime: async (renderFn) => {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    return end - start;
  },
};

// Console suppression for expected warnings
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is deprecated') ||
     args[0].includes('Warning: componentWillReceiveProps') ||
     args[0].includes('act(() => ...)'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('deprecated') ||
     args[0].includes('legacy'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Global test timeout
jest.setTimeout(10000);

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset mock state
  mockElectronAPI._callLog = [];
  mockElectronAPI._listeners.clear();

  // Clean up DOM
  document.body.innerHTML = '';

  // Reset any global state
  if (window.electronAPI) {
    window.electronAPI.removeAllListeners();
  }
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Add custom matchers
expect.extend({
  toHaveAccentureBranding(element) {
    const validation = global.testUtils.validateAccentureBranding(element);

    return {
      message: () =>
        validation.hasAccenturePurple
          ? `Expected element not to have Accenture branding`
          : `Expected element to have Accenture branding (#A100FF)`,
      pass: validation.hasAccenturePurple,
    };
  },

  toPassColorContrast(element, expectedRatio = 4.5) {
    const result = global.testUtils.checkColorContrast(element, expectedRatio);

    return {
      message: () =>
        result.passes
          ? `Expected element not to pass color contrast (${result.ratio.toFixed(2)}:1 >= ${expectedRatio}:1)`
          : `Expected element to pass color contrast (${result.ratio.toFixed(2)}:1 < ${expectedRatio}:1)`,
      pass: result.passes,
    };
  },

  toHaveBeenCalledWithIPC(mockFn, channel, expectedArgs) {
    const calls = mockFn.mock.calls.filter(call => call[0] === channel);

    if (calls.length === 0) {
      return {
        message: () => `Expected IPC call to ${channel} but it was not called`,
        pass: false,
      };
    }

    if (expectedArgs) {
      const matchingCall = calls.find(call =>
        JSON.stringify(call.slice(1)) === JSON.stringify(expectedArgs)
      );

      return {
        message: () =>
          matchingCall
            ? `Expected IPC call to ${channel} not to be called with ${JSON.stringify(expectedArgs)}`
            : `Expected IPC call to ${channel} to be called with ${JSON.stringify(expectedArgs)}`,
        pass: !!matchingCall,
      };
    }

    return {
      message: () => `Expected IPC call to ${channel} not to be called`,
      pass: true,
    };
  },
});