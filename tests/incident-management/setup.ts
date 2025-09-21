/**
 * Test Setup for Incident Management Tests
 * Global test setup and configuration
 */

import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Setup global test environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock console methods for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Setup fake timers for consistent testing
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinTimeRange(start: number, end: number): R;
      toHaveValidIncidentStructure(): R;
      toMeetSLARequirements(): R;
    }
  }
}

// Custom Jest matchers for incident management
expect.extend({
  toBeWithinTimeRange(received: number, start: number, end: number) {
    const pass = received >= start && received <= end;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${start}-${end}ms`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${start}-${end}ms`,
        pass: false,
      };
    }
  },

  toHaveValidIncidentStructure(received: any) {
    const requiredFields = [
      'id', 'title', 'description', 'status', 'priority',
      'created_at', 'updated_at'
    ];

    const hasAllFields = requiredFields.every(field =>
      received.hasOwnProperty(field)
    );

    const validStatus = [
      'open', 'assigned', 'in_progress', 'pending_review',
      'resolved', 'closed', 'reopened'
    ].includes(received.status);

    const validPriority = ['P1', 'P2', 'P3', 'P4'].includes(received.priority);

    const pass = hasAllFields && validStatus && validPriority;

    if (pass) {
      return {
        message: () =>
          `expected incident not to have valid structure`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected incident to have valid structure with required fields and valid status/priority`,
        pass: false,
      };
    }
  },

  toMeetSLARequirements(received: any) {
    const { priority, created_at, resolved_at, sla_deadline } = received;

    // SLA requirements by priority (in hours)
    const slaHours = {
      'P1': 4,   // Critical
      'P2': 8,   // High
      'P3': 24,  // Medium
      'P4': 72   // Low
    };

    const expectedSLA = slaHours[priority];
    const createdTime = new Date(created_at).getTime();
    const expectedDeadline = createdTime + (expectedSLA * 60 * 60 * 1000);

    const hasCorrectDeadline = new Date(sla_deadline).getTime() === expectedDeadline;

    let metSLA = true;
    if (resolved_at) {
      const resolvedTime = new Date(resolved_at).getTime();
      const actualResolutionHours = (resolvedTime - createdTime) / (60 * 60 * 1000);
      metSLA = actualResolutionHours <= expectedSLA;
    }

    const pass = hasCorrectDeadline && metSLA;

    if (pass) {
      return {
        message: () =>
          `expected incident not to meet SLA requirements`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected incident to meet SLA requirements for priority ${priority}`,
        pass: false,
      };
    }
  },
});

// Mock IPC for Electron testing
const mockIPC = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  send: jest.fn(),
};

// Setup window object for Electron environment
Object.defineProperty(window, 'electronAPI', {
  value: mockIPC,
  writable: true,
});

// Mock IndexedDB for browser environment
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
  cmp: jest.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock performance API for performance tests
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  },
  writable: true,
});

// Setup default test data
export const DEFAULT_TEST_CONFIG = {
  incident: {
    defaultTimeout: 5000,
    maxTestIncidents: 1000,
    performanceThresholds: {
      queueLoad: 2000,      // 2 seconds
      searchFilter: 500,     // 500ms
      statusUpdate: 300,     // 300ms
      bulkOperation: 1000,   // 1 second
    },
  },
  sla: {
    P1: 4 * 60 * 60 * 1000,  // 4 hours in ms
    P2: 8 * 60 * 60 * 1000,  // 8 hours in ms
    P3: 24 * 60 * 60 * 1000, // 24 hours in ms
    P4: 72 * 60 * 60 * 1000, // 72 hours in ms
  },
  ui: {
    animationTimeout: 300,
    debounceDelay: 250,
    virtualScrollThreshold: 100,
  },
};

// Export test utilities
export const testUtils = {
  waitForNextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  waitForTime: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  mockCurrentTime: (date: Date) => jest.setSystemTime(date),
  resetTime: () => jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z')),
};

console.log('Incident Management test setup completed');