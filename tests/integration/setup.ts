import '@testing-library/jest-dom';

// Integration test setup
// This file sets up the environment for integration tests

// Mock electron in integration tests
const mockElectron = {
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    send: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
};

// Mock the electron module
jest.mock('electron', () => mockElectron);

// Extended timeout for integration tests
jest.setTimeout(30000);

// Setup global test environment
beforeAll(() => {
  console.log('Starting integration tests...');
});

afterAll(() => {
  console.log('Integration tests completed.');
});

beforeEach(() => {
  // Reset mocks before each integration test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each integration test
  // Add any necessary cleanup logic here
});

export { mockElectron };