/**
 * Global Test Setup
 * Configuration and setup for all test environments
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { TestConfigManager, TestSetup } from './TestConfiguration';
import { cleanup } from '@testing-library/react';

// Configure test environment
const configManager = TestConfigManager.getInstance();
const testSetup = new TestSetup();

// Global test configuration
beforeAll(async () => {
  console.log('🚀 Setting up test environment...');

  // Setup global mocks
  await testSetup.setupGlobalMocks();

  // Setup performance monitoring
  testSetup.setupPerformanceMonitoring();

  // Configure test timeouts
  const config = configManager.getConfig();
  vi.setConfig({
    testTimeout: config.testTimeout,
    hookTimeout: 10000
  });

  console.log(`✅ Test environment ready (${config.environment} mode)`);
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');

  // Generate test report if enabled
  if (configManager.getConfig().reporting.generateBadges) {
    testSetup.generateTestReport();
  }

  console.log('✅ Test environment cleanup complete');
});

// Setup before each test
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();

  // Clear any timers
  vi.useRealTimers();
});

// Cleanup after each test
afterEach(() => {
  // Cleanup DOM
  cleanup();

  // Clear all timers and mocks
  vi.clearAllTimers();
  vi.resetAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Fail the test suite on unhandled rejections
  process.exit(1);
});

// Mock console methods in test environment to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  if (
    args.some(arg =>
      typeof arg === 'string' &&
      (arg.includes('Warning:') || arg.includes('React does not recognize'))
    )
  ) {
    return; // Suppress React warnings in tests
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  if (
    args.some(arg =>
      typeof arg === 'string' &&
      arg.includes('componentWillReceiveProps')
    )
  ) {
    return; // Suppress deprecation warnings
  }
  originalConsoleWarn(...args);
};

// Export test utilities for use in individual tests
export { configManager, testSetup };
export * from './utils/TestingUtilities';
export * from './TestConfiguration';