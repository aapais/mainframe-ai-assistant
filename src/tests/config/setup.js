const { TextEncoder, TextDecoder } = require('util');

// Global test setup
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.OAUTH_CLIENT_ID = 'test-client-id';
process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';

// Global test timeout
jest.setTimeout(30000);

// Suppress console warnings in tests
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
    return;
  }
  originalConsoleWarn.call(console, ...args);
};

// Global error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global test utilities
global.waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

global.createMockRequest = (overrides = {}) => ({
  headers: {},
  body: {},
  query: {},
  params: {},
  user: null,
  session: {},
  ...overrides,
});

global.createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    locals: {},
  };
  return res;
};
