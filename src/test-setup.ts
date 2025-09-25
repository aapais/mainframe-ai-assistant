/**
 * Test Setup Configuration
 * Global test setup for all test suites including forms, services, and components
 */

import '@testing-library/jest-dom';
// Import jest-axe for accessibility testing
import 'jest-axe/extend-expect';

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(min: number, max: number): R;
      toHavePerformanceBetterThan(threshold: number): R;
      toHaveFormValidationErrors(): R;
      // Accessibility matchers are now defined in accessibilityTests.ts
      // to avoid conflicts and ensure proper integration
    }
  }
}

// Custom Jest matchers for performance testing and form validation
expect.extend({
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      message: () =>
        pass
          ? `Expected ${received} not to be within range ${min}-${max}`
          : `Expected ${received} to be within range ${min}-${max}`,
      pass,
    };
  },

  toHavePerformanceBetterThan(received: number, threshold: number) {
    const pass = received < threshold;
    return {
      message: () =>
        pass
          ? `Expected performance ${received}ms not to be better than ${threshold}ms`
          : `Expected performance ${received}ms to be better than ${threshold}ms`,
      pass,
    };
  },

  toHaveFormValidationErrors(received: HTMLElement) {
    const errorMessages = received.querySelectorAll('.error-message');
    const errorInputs = received.querySelectorAll('.error, [aria-invalid="true"]');

    const pass = errorMessages.length > 0 && errorInputs.length > 0;
    return {
      message: () =>
        pass
          ? `Expected form not to have validation errors`
          : `Expected form to have validation errors (found ${errorMessages.length} error messages, ${errorInputs.length} invalid inputs)`,
      pass,
    };
  },

  // Note: Accessibility matchers (toHaveAccessibleFormStructure, toBeInLoadingState, etc.)
  // are now implemented in src/renderer/testing/accessibilityTests.ts for better integration
  // with the comprehensive accessibility testing framework
});

// Console configuration for test runs
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Allow performance logs during benchmarks
console.log = (...args: any[]) => {
  const message = args.join(' ');
  if (
    message.includes('📊') ||
    message.includes('⏱️') ||
    message.includes('🚀') ||
    message.includes('💾') ||
    message.includes('🏗️') ||
    message.includes('🔍') ||
    message.includes('📈') ||
    message.includes('📋') ||
    message.includes('🏁') ||
    message.includes('🔥') ||
    process.env.VERBOSE_TESTS
  ) {
    originalConsoleLog(...args);
  }
};

// Suppress non-critical warnings during tests
console.warn = (...args: any[]) => {
  const message = args.join(' ');
  if (!message.includes('AI search failed') && !message.includes('Gemini API error')) {
    originalConsoleWarn(...args);
  }
};

// Always show errors
console.error = originalConsoleError;

// Global test timeout for performance tests
jest.setTimeout(30000); // 30 seconds for benchmark tests

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-api-key';

// Mock performance.now() for consistent timing in tests
const mockPerformanceNow = jest.fn();
let mockTime = 0;

mockPerformanceNow.mockImplementation(() => {
  mockTime += 1; // Increment by 1ms for each call
  return mockTime;
});

// Global mocks for form components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock clipboard API for copy functionality
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock File API for file upload tests
global.File = class MockFile {
  constructor(parts: any[], name: string, options: any = {}) {
    this.name = name;
    this.size = parts.reduce(
      (acc, part) => acc + (typeof part === 'string' ? part.length : part.size || 0),
      0
    );
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

global.FileReader = class MockFileReader {
  result: any = null;
  error: any = null;
  readyState: number = 0;
  onload: any = null;
  onerror: any = null;
  onloadend: any = null;

  readAsText(file: File) {
    setTimeout(() => {
      this.result = 'mocked file content';
      this.readyState = 2;
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    }, 0);
  }

  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = 'data:text/plain;base64,bW9ja2VkIGZpbGUgY29udGVudA==';
      this.readyState = 2;
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    }, 0);
  }
};

// Mock URL API
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
    url: 'http://localhost',
    type: 'basic',
    redirected: false,
    bodyUsed: false,
    clone: jest.fn(),
  } as Response)
);

// Mock localStorage for form persistence tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock window.matchMedia for responsive components
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

// Mock HTMLElement.scrollIntoView
HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock focus method for accessibility tests
HTMLElement.prototype.focus = jest.fn();

// Global beforeEach to reset mocks
beforeEach(() => {
  mockTime = 0;
  jest.clearAllMocks();

  // Reset storage mocks
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();

  sessionStorageMock.getItem.mockReturnValue(null);
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
});

// Global afterEach cleanup
afterEach(() => {
  // Clean up any hanging promises or timeouts
  jest.clearAllTimers();

  // Clean up any event listeners
  document.removeEventListener = jest.fn();
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Memory monitoring for tests
const initialMemory = process.memoryUsage().heapUsed;
let testStartMemory = initialMemory;

beforeEach(() => {
  testStartMemory = process.memoryUsage().heapUsed;
});

afterEach(() => {
  const currentMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = (currentMemory - testStartMemory) / 1024 / 1024; // MB

  // Log memory increases over 50MB
  if (memoryIncrease > 50) {
    console.warn(`⚠️  High memory usage detected: +${memoryIncrease.toFixed(2)}MB`);
  }
});

// Test utilities for form testing
export const testUtils = {
  // Create mock form data
  createMockFormData: (overrides = {}) => ({
    title: 'Test KB Entry Title',
    problem:
      'This is a test problem description that is long enough to pass validation requirements and provides sufficient detail for testing purposes.',
    solution:
      'This is a test solution with step-by-step instructions:\n1. First step to resolve the issue\n2. Second step with additional details\n3. Third step to complete the resolution',
    category: 'VSAM',
    tags: ['test', 'mock', 'kb-entry'],
    ...overrides,
  }),

  // Create mock services with default implementations
  createMockServices: (overrides = {}) => ({
    kbService: {
      saveEntry: jest.fn().mockResolvedValue({ id: 'test-123', success: true }),
      validateTitleUniqueness: jest.fn().mockResolvedValue({ isUnique: true }),
      getSimilarEntries: jest.fn().mockResolvedValue([]),
      getCategories: jest.fn().mockResolvedValue(['VSAM', 'JCL', 'DB2', 'Batch', 'Functional']),
      getTags: jest.fn().mockResolvedValue([]),
      checkPermissions: jest.fn().mockResolvedValue({ canEdit: true, canSave: true }),
      ...overrides.kbService,
    },
    validationService: {
      validateEntry: jest.fn().mockResolvedValue({ isValid: true, errors: [] }),
      validateCrossFields: jest.fn().mockResolvedValue({ isValid: true, warnings: {} }),
      analyzeContentQuality: jest.fn().mockResolvedValue({ score: 85, suggestions: [] }),
      validateTitleUniqueness: jest.fn().mockResolvedValue({ isValid: true, isUnique: true }),
      ...overrides.validationService,
    },
    completionService: {
      getSuggestions: jest.fn().mockResolvedValue([]),
      getTemplates: jest.fn().mockResolvedValue([]),
      analyzeSimilarEntries: jest.fn().mockResolvedValue([]),
      ...overrides.completionService,
    },
    notificationService: {
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showWarning: jest.fn(),
      showInfo: jest.fn(),
      clear: jest.fn(),
      ...overrides.notificationService,
    },
  }),

  // Wait for async operations with timeout
  waitForAsync: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Setup user event with proper timing
  setupUser: () => {
    const userEvent = require('@testing-library/user-event');
    return userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
      delay: null, // No delays in tests for speed
    });
  },

  // Accessibility test helper
  checkAccessibility: async (container: HTMLElement) => {
    const { axe } = require('jest-axe');
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-order-semantics': { enabled: true },
        'aria-required-attr': { enabled: true },
        'aria-valid-attr': { enabled: true },
        'label-title-only': { enabled: true },
        'form-field-multiple-labels': { enabled: true },
      },
    });
    expect(results).toHaveNoViolations();
    return results;
  },

  // Fill form with valid test data
  fillFormWithValidData: async (user: any, overrides = {}) => {
    const data = testUtils.createMockFormData(overrides);
    const { screen } = require('@testing-library/react');

    const titleInput = screen.getByLabelText(/title/i);
    const problemInput = screen.getByLabelText(/problem/i);
    const solutionInput = screen.getByLabelText(/solution/i);

    await user.clear(titleInput);
    await user.type(titleInput, data.title);

    await user.clear(problemInput);
    await user.type(problemInput, data.problem);

    await user.clear(solutionInput);
    await user.type(solutionInput, data.solution);

    if (data.category) {
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, data.category);
    }

    if (data.tags && data.tags.length > 0) {
      const tagsInput = screen.getByLabelText(/tags/i);
      for (const tag of data.tags) {
        await user.type(tagsInput, `${tag}{enter}`);
      }
    }

    return data;
  },

  // Error simulation helpers
  simulateNetworkError: (service: any, method: string, error = new Error('Network error')) => {
    service[method].mockRejectedValueOnce(error);
  },

  simulateValidationError: (service: any, field: string, message: string) => {
    service.validateEntry.mockResolvedValueOnce({
      isValid: false,
      errors: [{ field, message }],
    });
  },

  simulateServiceUnavailable: (service: any, method: string) => {
    service[method].mockRejectedValueOnce(new Error('Service unavailable'));
  },

  // Timer control utilities
  advanceTimers: (ms: number) => {
    const { act } = require('@testing-library/react');
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  },

  // Mock localStorage data
  mockLocalStorage: (key: string, data: any) => {
    localStorageMock.getItem.mockImplementation(k => (k === key ? JSON.stringify(data) : null));
  },

  // Create mock validation errors
  createValidationErrors: (fieldErrors: { [field: string]: string }) => {
    return Object.entries(fieldErrors).map(([field, message]) => ({
      field,
      message,
      type: 'validation',
    }));
  },

  // Performance test helper
  measurePerformance: async (operation: () => Promise<any>) => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return {
      result,
      duration: end - start,
    };
  },

  // Form state assertions
  expectFormToBeValid: (container: HTMLElement) => {
    const errorMessages = container.querySelectorAll('.error-message, [role="alert"]');
    const invalidInputs = container.querySelectorAll('[aria-invalid="true"]');
    expect(errorMessages.length).toBe(0);
    expect(invalidInputs.length).toBe(0);
  },

  expectFormToHaveErrors: (container: HTMLElement) => {
    const errorMessages = container.querySelectorAll('.error-message, [role="alert"]');
    const invalidInputs = container.querySelectorAll('[aria-invalid="true"]');
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(invalidInputs.length).toBeGreaterThan(0);
  },
};

// Make test utils available globally for convenience
declare global {
  namespace globalThis {
    var testUtils: typeof testUtils;
  }
}

globalThis.testUtils = testUtils;

export {};
