/**
 * Jest Setup for Accessibility Testing
 * Configures the testing environment for comprehensive accessibility testing
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { accessibilityMatchers } from './src/renderer/testing/accessibility';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  // Use more specific queries to encourage accessible patterns
  defaultHidden: true,
  computedStyleSupportsPseudoElements: true
});

// Extend Jest with accessibility matchers
expect.extend(toHaveNoViolations);
expect.extend(accessibilityMatchers);

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.elements = new Set();
  }

  observe(element) {
    this.elements.add(element);
    // Immediately fire callback for testing
    this.callback([
      {
        target: element,
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now()
      }
    ]);
  }

  unobserve(element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }
};

// Mock ResizeObserver for responsive components
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
  }

  observe(element) {
    this.elements.add(element);
    // Fire callback immediately for testing
    this.callback([
      {
        target: element,
        contentRect: element.getBoundingClientRect(),
        borderBoxSize: [{ inlineSize: 200, blockSize: 100 }],
        contentBoxSize: [{ inlineSize: 180, blockSize: 80 }],
        devicePixelContentBoxSize: [{ inlineSize: 360, blockSize: 160 }]
      }
    ]);
  }

  unobserve(element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }
};

// Mock window.matchMedia for responsive design testing
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

// Mock getComputedStyle for style-dependent tests
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = jest.fn().mockImplementation((element, pseudoElement) => {
  const style = originalGetComputedStyle(element, pseudoElement);

  // Add default focus styles for accessibility testing
  if (pseudoElement === ':focus') {
    return {
      ...style,
      outline: style.outline || '2px solid #0066cc',
      outlineOffset: style.outlineOffset || '2px'
    };
  }

  return style;
});

// Mock speech synthesis for screen reader testing
window.speechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => []),
  pending: false,
  speaking: false,
  paused: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
};

// Mock clipboard API for copy functionality testing
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
    write: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue([])
  },
  writable: true
});

// Setup global accessibility testing helpers
global.testAccessibility = {
  // Skip accessibility tests in CI if environment variable is set
  skipInCI: process.env.SKIP_A11Y_TESTS === 'true',

  // Default timeout for accessibility tests
  timeout: 5000,

  // Common test data
  sampleText: 'This is sample text for accessibility testing',
  sampleError: 'This field is required',
  sampleSuccess: 'Form submitted successfully',

  // Helper to create accessible test elements
  createElement: (tag, attributes = {}, children = []) => {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key.startsWith('aria-') || key.startsWith('data-') || ['id', 'role', 'tabindex'].includes(key)) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });

    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });

    return element;
  }
};

// Mock focus-visible for testing focus styles
let focusVisibleEnabled = false;

const mockFocusVisible = {
  applyFocusVisiblePolyfill: jest.fn((scope = document) => {
    focusVisibleEnabled = true;

    // Add focus-visible class on keyboard focus
    scope.addEventListener('focusin', (e) => {
      if (focusVisibleEnabled) {
        e.target.classList.add('focus-visible');
      }
    });

    scope.addEventListener('focusout', (e) => {
      e.target.classList.remove('focus-visible');
    });

    // Remove focus-visible on mouse focus
    scope.addEventListener('mousedown', () => {
      focusVisibleEnabled = false;
    });

    scope.addEventListener('keydown', () => {
      focusVisibleEnabled = true;
    });
  })
};

global.focusVisible = mockFocusVisible;

// Helper to wait for screen reader announcements
global.waitForAnnouncement = async (expectedText, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const checkAnnouncement = () => {
      const liveRegions = document.querySelectorAll('[aria-live]');
      const announcement = Array.from(liveRegions)
        .map(region => region.textContent)
        .join(' ');

      if (announcement.includes(expectedText)) {
        resolve(announcement);
      }
    };

    const timeoutId = setTimeout(() => {
      reject(new Error(`Expected announcement "${expectedText}" not found within ${timeout}ms`));
    }, timeout);

    // Check immediately
    checkAnnouncement();

    // Set up mutation observer to watch for changes
    const observer = new MutationObserver(() => {
      checkAnnouncement();
      clearTimeout(timeoutId);
      observer.disconnect();
    });

    document.querySelectorAll('[aria-live]').forEach(region => {
      observer.observe(region, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });
  });
};

// Console warnings for accessibility issues
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  const message = args.join(' ');

  // Fail tests on React accessibility warnings
  if (message.includes('Warning: Invalid ARIA attribute') ||
      message.includes('Warning: Invalid value for prop') ||
      message.includes('Warning: Unknown ARIA attribute') ||
      message.includes('Warning: React does not recognize')) {
    throw new Error(`Accessibility Warning: ${message}`);
  }

  originalWarn.apply(console, args);
};

console.error = (...args) => {
  const message = args.join(' ');

  // Fail tests on accessibility errors
  if (message.includes('aria-') ||
      message.includes('role=') ||
      message.includes('tabindex') ||
      message.includes('focus')) {
    throw new Error(`Accessibility Error: ${message}`);
  }

  originalError.apply(console, args);
};

// Setup global test environment
beforeEach(() => {
  // Clear all live regions before each test
  document.querySelectorAll('[aria-live]').forEach(region => {
    region.remove();
  });

  // Reset focus to body
  if (document.activeElement && document.activeElement !== document.body) {
    (document.activeElement as HTMLElement).blur();
  }

  // Clear any existing timers
  jest.clearAllTimers();

  // Reset mock functions
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up any test artifacts
  document.querySelectorAll('[data-testid]').forEach(element => {
    if (!element.closest('[data-testid="app"]')) {
      element.remove();
    }
  });
});

// Global error handler for unhandled accessibility violations
process.on('unhandledRejection', (reason) => {
  if (reason && typeof reason === 'object' && 'violations' in reason) {
    console.error('Unhandled accessibility violations:', reason);
    process.exit(1);
  }
});

// Export test utilities for use in test files
global.a11yTestUtils = {
  // Create a test environment with aria-live regions
  setupAccessibleEnvironment: () => {
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'a11y-test-container');

    // Add aria-live regions
    const politeRegion = document.createElement('div');
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.setAttribute('data-testid', 'polite-region');
    politeRegion.style.position = 'absolute';
    politeRegion.style.left = '-10000px';
    politeRegion.style.width = '1px';
    politeRegion.style.height = '1px';
    politeRegion.style.overflow = 'hidden';

    const assertiveRegion = politeRegion.cloneNode();
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('data-testid', 'assertive-region');

    container.appendChild(politeRegion);
    container.appendChild(assertiveRegion);
    document.body.appendChild(container);

    return container;
  },

  // Clean up test environment
  cleanupAccessibleEnvironment: () => {
    const container = document.querySelector('[data-testid="a11y-test-container"]');
    if (container) {
      container.remove();
    }
  }
};