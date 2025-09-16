/**
 * Jest Setup for FTS5 Search Tests
 * Global test configuration and utilities
 */

// Extend Jest matchers for search testing
expect.extend({
  toContainHighlights(received, expected) {
    const pass = received.includes('<mark>') && received.includes('</mark>');
    if (pass) {
      return {
        message: () => `expected ${received} not to contain highlight tags`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to contain highlight tags <mark> and </mark>`,
        pass: false,
      };
    }
  },

  toHaveValidSnippet(received, maxLength = 200) {
    const issues = [];

    if (typeof received !== 'string') {
      issues.push('snippet must be a string');
    }

    if (received.length > maxLength) {
      issues.push(`snippet length ${received.length} exceeds maximum ${maxLength}`);
    }

    // Check for broken HTML tags
    const openTags = (received.match(/<mark>/g) || []).length;
    const closeTags = (received.match(/<\/mark>/g) || []).length;
    if (openTags !== closeTags) {
      issues.push(`mismatched highlight tags: ${openTags} open, ${closeTags} close`);
    }

    // Check for nested tags
    if (received.includes('<mark><mark>') || received.includes('</mark></mark>')) {
      issues.push('contains nested highlight tags');
    }

    const pass = issues.length === 0;

    return {
      message: () => pass
        ? `expected snippet to be invalid`
        : `snippet validation failed: ${issues.join(', ')}`,
      pass,
    };
  },

  toBeRankedCorrectly(received) {
    if (!Array.isArray(received)) {
      return {
        message: () => 'expected an array of search results',
        pass: false,
      };
    }

    // Check that results are sorted by rank in descending order
    for (let i = 0; i < received.length - 1; i++) {
      if (received[i].rank < received[i + 1].rank) {
        return {
          message: () => `results not properly ranked: item ${i} (rank ${received[i].rank}) < item ${i + 1} (rank ${received[i + 1].rank})`,
          pass: false,
        };
      }
    }

    return {
      message: () => 'expected results to not be ranked correctly',
      pass: true,
    };
  },

  toMatchMainframeTerms(received, terms) {
    const text = received.toLowerCase();
    const matchedTerms = terms.filter(term => text.includes(term.toLowerCase()));

    const pass = matchedTerms.length > 0;

    return {
      message: () => pass
        ? `expected "${received}" not to match any of: ${terms.join(', ')}`
        : `expected "${received}" to match at least one of: ${terms.join(', ')}`,
      pass,
    };
  }
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console.log in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
  }

  // Always show errors and warnings
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
global.testUtils = {
  // Generate test documents
  createTestDocument: (id, title, content, category = 'test', tags = []) => ({
    id,
    title,
    content,
    category,
    tags,
    difficulty: 'intermediate',
    lastUpdated: new Date().toISOString().split('T')[0]
  }),

  // Generate corpus for performance testing
  generateTestCorpus: (size, termPool) => {
    const defaultTerms = ['mainframe', 'JCL', 'COBOL', 'CICS', 'z/OS', 'batch', 'programming'];
    const terms = termPool || defaultTerms;

    return Array.from({ length: size }, (_, i) => {
      const numTerms = Math.floor(Math.random() * 10) + 5;
      const docTerms = Array.from({ length: numTerms }, () =>
        terms[Math.floor(Math.random() * terms.length)]
      );

      return {
        id: `test_doc_${i}`,
        title: `Test Document ${i}`,
        content: docTerms.join(' '),
        tokens: docTerms,
        length: docTerms.length,
        category: 'test',
        tags: docTerms.slice(0, 2)
      };
    });
  },

  // Measure execution time
  measureTime: async (fn) => {
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    return { result, time: end - start };
  },

  // Validate search result structure
  validateSearchResult: (result) => {
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('rank');
    expect(typeof result.id).toBe('string');
    expect(typeof result.title).toBe('string');
    expect(typeof result.content).toBe('string');
    expect(typeof result.rank).toBe('number');
  },

  // Clean up test databases
  cleanupTestDb: (dbPath) => {
    const fs = require('fs');
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (error) {
        console.warn(`Failed to cleanup test database: ${error.message}`);
      }
    }
  },

  // Create mock database
  createMockDatabase: () => ({
    prepare: jest.fn(),
    exec: jest.fn(),
    transaction: jest.fn(),
    close: jest.fn()
  })
};

// Performance monitoring
let testStartTime;

beforeEach(() => {
  testStartTime = Date.now();
});

afterEach(() => {
  const testDuration = Date.now() - testStartTime;
  if (testDuration > 1000) { // Warn for tests taking longer than 1 second
    console.warn(`Slow test detected: ${expect.getState().currentTestName} took ${testDuration}ms`);
  }
});

// Memory leak detection
let initialMemory;

beforeAll(() => {
  initialMemory = process.memoryUsage().heapUsed;
});

afterAll(() => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = finalMemory - initialMemory;

  // Warn if memory increased significantly (more than 50MB)
  if (memoryIncrease > 50 * 1024 * 1024) {
    console.warn(`Potential memory leak detected: ${memoryIncrease / 1024 / 1024}MB increase`);
  }
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

// Set up test timeouts
jest.setTimeout(30000); // 30 second timeout for all tests

// Configure test environment
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

// Export setup completion
module.exports = {
  setupComplete: true,
  testUtils: global.testUtils
};