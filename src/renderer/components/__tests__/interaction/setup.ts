import { cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Enhanced setup for interaction testing
beforeEach(() => {
  // Clear any previous DOM state
  document.body.innerHTML = '';

  // Reset any global state
  localStorage.clear();
  sessionStorage.clear();

  // Reset any timers
  jest.clearAllTimers();
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Global test utilities for interaction testing
global.userEvent = userEvent;

// Mock APIs for testing
global.electronAPI = {
  searchKB: jest.fn(),
  addKBEntry: jest.fn(),
  updateKBEntry: jest.fn(),
  rateEntry: jest.fn(),
  getMetrics: jest.fn(),
  exportKB: jest.fn(),
  importKB: jest.fn(),
  getGeminiConfig: jest.fn().mockResolvedValue({ apiKey: 'test-key' }),
  saveUserPreferences: jest.fn(),
  getUserPreferences: jest.fn().mockResolvedValue({})
};

// Mock window methods
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn(() => true)
});

Object.defineProperty(window, 'alert', {
  writable: true,
  value: jest.fn()
});

Object.defineProperty(window, 'prompt', {
  writable: true,
  value: jest.fn(() => 'test-input')
});

// Mock intersection observer
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock resize observer
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Performance API mock
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => [])
  }
});

// Clipboard API mock
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue('')
  }
});

// Focus trap testing utilities
global.createFocusTrap = jest.fn().mockReturnValue({
  activate: jest.fn(),
  deactivate: jest.fn()
});

export {};