// Jest setup for interaction tests
import 'whatwg-fetch';

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHavePerformanceBenchmark(received, benchmark) {
    const pass = received <= benchmark;
    if (pass) {
      return {
        message: () =>
          `expected ${received}ms not to meet benchmark of ${benchmark}ms`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received}ms to meet benchmark of ${benchmark}ms`,
        pass: false,
      };
    }
  },

  toBeAccessible(received) {
    // Basic accessibility checks
    const hasAriaLabel = received.hasAttribute('aria-label') ||
                        received.hasAttribute('aria-labelledby');
    const hasRole = received.hasAttribute('role');
    const isFocusable = received.tabIndex >= 0 ||
                       ['button', 'input', 'select', 'textarea', 'a'].includes(received.tagName.toLowerCase());

    const pass = hasAriaLabel || hasRole || isFocusable;

    if (pass) {
      return {
        message: () => `expected element not to be accessible`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to be accessible (missing aria-label, role, or focusable state)`,
        pass: false,
      };
    }
  },

  toHaveValidFormStructure(received) {
    // Check if form has proper structure
    const hasForm = received.tagName === 'FORM' || received.querySelector('form');
    const hasRequiredFields = received.querySelectorAll('[required]').length > 0;
    const hasLabels = received.querySelectorAll('label').length > 0;
    const hasSubmit = received.querySelector('[type="submit"], button[type="submit"]');

    const issues = [];
    if (!hasForm) issues.push('missing form element');
    if (!hasRequiredFields) issues.push('no required fields');
    if (!hasLabels) issues.push('no labels');
    if (!hasSubmit) issues.push('no submit button');

    const pass = issues.length === 0;

    if (pass) {
      return {
        message: () => `expected form not to have valid structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected form to have valid structure. Issues: ${issues.join(', ')}`,
        pass: false,
      };
    }
  }
});

// Performance measurement utilities
global.measurePerformance = (name, fn) => {
  return async (...args) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();
    const duration = end - start;

    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    return { result, duration };
  };
};

// Accessibility testing utilities
global.checkAccessibility = (element) => {
  const issues = [];

  // Check for ARIA labels
  const interactiveElements = element.querySelectorAll(
    'button, input, select, textarea, [role="button"], [role="textbox"], [tabindex]:not([tabindex="-1"])'
  );

  interactiveElements.forEach((el, index) => {
    const hasLabel = el.getAttribute('aria-label') ||
                    el.getAttribute('aria-labelledby') ||
                    (el.id && element.querySelector(`label[for="${el.id}"]`));

    if (!hasLabel) {
      issues.push(`Interactive element ${index} (${el.tagName}) lacks proper labeling`);
    }
  });

  // Check heading structure
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.charAt(1));
    if (level - previousLevel > 1) {
      issues.push(`Heading level jumps from h${previousLevel} to h${level}`);
    }
    previousLevel = level;
  });

  return issues;
};

// User event simulation helpers
global.simulateUserInteraction = {
  rapidClicks: async (element, count = 5, delay = 50) => {
    const clicks = [];
    for (let i = 0; i < count; i++) {
      clicks.push(
        new Promise(resolve => {
          setTimeout(() => {
            element.click();
            resolve(i);
          }, i * delay);
        })
      );
    }
    return Promise.all(clicks);
  },

  slowTyping: async (element, text, delay = 100) => {
    element.focus();
    for (let i = 0; i < text.length; i++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      const char = text.charAt(i);

      // Simulate keydown, keypress, input events
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: char }));
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },

  keySequence: async (element, keys, delay = 50) => {
    element.focus();
    for (const key of keys) {
      await new Promise(resolve => setTimeout(resolve, delay));
      element.dispatchEvent(new KeyboardEvent('keydown', { key }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key }));
    }
  }
};

// Form testing utilities
global.formTestHelpers = {
  fillForm: async (form, data) => {
    for (const [fieldName, value] of Object.entries(data)) {
      const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
      if (!field) continue;

      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = Boolean(value);
      } else if (field.tagName === 'SELECT') {
        field.value = value;
      } else {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  },

  getFormData: (form) => {
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  },

  validateForm: (form) => {
    const requiredFields = form.querySelectorAll('[required]');
    const issues = [];

    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        issues.push(`Required field ${field.name || field.id} is empty`);
      }
    });

    return issues;
  }
};

// Error simulation utilities
global.errorSimulation = {
  networkError: () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => Promise.reject(new Error('Network Error')));
    return () => { global.fetch = originalFetch; };
  },

  slowResponse: (delay = 2000) => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn((url, options) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          originalFetch(url, options).then(resolve).catch(reject);
        }, delay);
      });
    });
    return () => { global.fetch = originalFetch; };
  },

  randomFailure: (failureRate = 0.3) => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn((url, options) => {
      if (Math.random() < failureRate) {
        return Promise.reject(new Error('Random failure'));
      }
      return originalFetch(url, options);
    });
    return () => { global.fetch = originalFetch; };
  }
};

// Test data generators
global.testDataGenerator = {
  kbEntry: (overrides = {}) => ({
    id: `test-entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test KB Entry',
    problem: 'Test problem description that meets minimum length requirements for proper testing coverage.',
    solution: 'Test solution with step-by-step instructions:\n1. First step\n2. Second step\n3. Final verification step',
    category: 'Other',
    tags: ['test', 'automated'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 0,
    success_count: 0,
    failure_count: 0,
    ...overrides
  }),

  searchResults: (count = 3, query = 'test') => {
    return Array.from({ length: count }, (_, i) => ({
      entry: global.testDataGenerator.kbEntry({
        id: `search-result-${i}`,
        title: `Search Result ${i + 1} for ${query}`,
        problem: `Problem description for search result ${i + 1} containing ${query}`,
      }),
      score: 90 - (i * 5),
      matchType: 'fuzzy',
      highlights: {
        title: `Search Result ${i + 1} for <mark>${query}</mark>`,
        problem: `Problem containing <mark>${query}</mark>...`
      }
    }));
  },

  formErrors: () => ({
    title: 'Title is required and must be at least 10 characters',
    problem: 'Problem description is required and must be at least 50 characters',
    solution: 'Solution is required and must be at least 50 characters',
    category: 'Category selection is required'
  }),

  userActions: () => [
    { type: 'click', target: 'button', description: 'Click primary button' },
    { type: 'type', target: 'input', value: 'test input', description: 'Type in text field' },
    { type: 'select', target: 'select', value: 'option1', description: 'Select dropdown option' },
    { type: 'key', key: 'Enter', description: 'Press Enter key' },
    { type: 'key', key: 'Escape', description: 'Press Escape key' }
  ]
};

// Console override for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress React warnings in tests unless explicitly needed
  console.error = (message, ...args) => {
    if (
      typeof message === 'string' &&
      (message.includes('Warning: ReactDOM.render is no longer supported') ||
       message.includes('Warning: Each child in a list should have a unique "key" prop'))
    ) {
      return;
    }
    originalConsoleError(message, ...args);
  };

  console.warn = (message, ...args) => {
    if (
      typeof message === 'string' &&
      message.includes('componentWillReceiveProps has been renamed')
    ) {
      return;
    }
    originalConsoleWarn(message, ...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});