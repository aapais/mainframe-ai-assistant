/**
 * Browser API Mocks for SearchResults Testing
 */

// Mock window.performance for performance tests
if (!window.performance) {
  window.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000
    }
  };
}

// Mock requestAnimationFrame
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = jest.fn((callback) => {
    return setTimeout(callback, 16);
  });
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = jest.fn((id) => {
    clearTimeout(id);
  });
}

// Mock IntersectionObserver
if (!window.IntersectionObserver) {
  window.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));
}

// Mock ResizeObserver
if (!window.ResizeObserver) {
  window.ResizeObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));
}

// Mock matchMedia
if (!window.matchMedia) {
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};