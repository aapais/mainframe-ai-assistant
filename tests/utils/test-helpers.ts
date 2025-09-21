/**
 * UI Integration Test Helpers
 * Utility functions for consistent testing across components
 */

import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement } from 'react';

// Mock IPC renderer for consistent testing
export const createMockIpcRenderer = () => ({
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  send: jest.fn(),
  _callLog: [] as any[],
  _listeners: new Map(),
});

// Setup mock IPC with standard responses
export const setupMockIpc = (mockResponses: Record<string, any> = {}) => {
  const mockIpc = createMockIpcRenderer();

  const defaultResponses = {
    'transparency:get-usage-data': {
      totalQueries: 1247,
      totalTokens: 2847392,
      avgResponseTime: 1.2,
      successRate: 98.5,
    },
    'transparency:get-cost-data': {
      currentMonth: 45.67,
      lastMonth: 38.92,
      yearToDate: 523.45,
    },
    'api-settings:get-all': {
      openai: { apiKey: 'sk-test-key', model: 'gpt-4' },
    },
    ...mockResponses,
  };

  mockIpc.invoke.mockImplementation(async (channel: string, ...args: any[]) => {
    const call = { channel, args, timestamp: Date.now() };
    mockIpc._callLog.push(call);
    await new Promise(resolve => setTimeout(resolve, 10));
    return defaultResponses[channel] || {};
  });

  Object.defineProperty(window, 'electronAPI', {
    value: mockIpc,
    writable: true,
  });

  return mockIpc;
};

// Accessibility test helpers
export const checkColorContrast = (element: HTMLElement, expectedRatio = 4.5) => {
  const style = window.getComputedStyle(element);
  const bgColor = style.backgroundColor;
  const textColor = style.color;

  // Parse RGB values
  const parseRgb = (rgb: string): number[] => {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
  };

  const getLuminance = (rgb: number[]): number => {
    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const bgRgb = parseRgb(bgColor);
  const textRgb = parseRgb(textColor);
  const bgLum = getLuminance(bgRgb);
  const textLum = getLuminance(textRgb);
  const contrastRatio = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

  return {
    ratio: contrastRatio,
    passes: contrastRatio >= expectedRatio,
    bgColor,
    textColor,
  };
};

// Accenture brand validation
export const validateAccentureBranding = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  const accenturePurple = 'rgb(161, 0, 255)'; // #A100FF

  return {
    hasAccenturePurple: style.backgroundColor === accenturePurple ||
                       style.borderColor === accenturePurple ||
                       style.color === accenturePurple,
    backgroundMatches: style.backgroundColor === accenturePurple,
    borderMatches: style.borderColor === accenturePurple,
    textMatches: style.color === accenturePurple,
  };
};

// Keyboard navigation helper
export const simulateKeyboardNavigation = (element: HTMLElement, key: string) => {
  element.focus();
  return new KeyboardEvent('keydown', {
    key,
    code: `Key${key.toUpperCase()}`,
    bubbles: true,
    cancelable: true,
  });
};

// Wait for IPC calls
export const waitForIpcCall = async (
  mockIpc: ReturnType<typeof createMockIpcRenderer>,
  channel: string,
  timeout = 5000
) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const call = mockIpc._callLog.find(call => call.channel === channel);
    if (call) return call;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`IPC call to ${channel} not found within ${timeout}ms`);
};

// Mock file upload
export const createMockFile = (name: string, size: number, type: string, content = 'mock content') => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Mock cost data generators
export const generateCostScenario = (type: 'low' | 'medium' | 'high' | 'critical') => {
  const scenarios = {
    low: { estimatedCost: 0.15, tokensToUse: 1000, operation: 'Simple search' },
    medium: { estimatedCost: 2.45, tokensToUse: 5000, operation: 'Document analysis' },
    high: { estimatedCost: 15.80, tokensToUse: 25000, operation: 'Complex processing' },
    critical: { estimatedCost: 50.00, tokensToUse: 100000, operation: 'Batch processing' },
  };

  return {
    ...scenarios[type],
    confidence: 'high',
    timestamp: Date.now(),
  };
};

// Mock KB entry generator
export const generateMockKBEntry = (overrides: Partial<any> = {}) => ({
  id: 'kb-entry-123',
  title: 'Test KB Entry',
  content: 'This is test content for the KB entry.',
  summary: 'Test summary',
  tags: ['test', 'mock'],
  category: 'General',
  author: 'Test Author',
  lastModified: new Date().toISOString(),
  version: 1,
  status: 'published',
  metadata: {
    wordCount: 500,
    readingTime: 2,
    difficulty: 'beginner',
  },
  attachments: [],
  ...overrides,
});

// Test wrapper with providers
interface TestWrapperProps {
  children: React.ReactNode;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => {
  // Add any providers needed for testing
  return React.createElement('div', { 'data-testid': 'test-wrapper' }, children);
};

// Custom render with test wrapper
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// Mock transparency data generator
export const generateTransparencyData = () => ({
  usage: {
    totalQueries: 1247,
    totalTokens: 2847392,
    avgResponseTime: 1.2,
    successRate: 98.5,
    lastUpdated: new Date().toISOString(),
  },
  costs: {
    currentMonth: 45.67,
    lastMonth: 38.92,
    yearToDate: 523.45,
    breakdown: [
      { service: 'OpenAI GPT-4', cost: 25.40, percentage: 55.6 },
      { service: 'Claude-3', cost: 15.20, percentage: 33.3 },
      { service: 'Embedding API', cost: 5.07, percentage: 11.1 },
    ],
  },
  authorization: {
    pendingRequests: 3,
    approvedToday: 15,
    rejectedToday: 2,
    avgApprovalTime: 45,
    recentAuthorizations: [
      {
        id: '1',
        operation: 'Document Analysis',
        cost: 2.45,
        status: 'approved',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
  },
  trends: {
    dailyUsage: [
      { date: '2024-01-01', queries: 45, cost: 12.34 },
      { date: '2024-01-02', queries: 52, cost: 15.67 },
      { date: '2024-01-03', queries: 38, cost: 9.87 },
    ],
    topOperations: [
      { operation: 'Search', count: 456, avgCost: 0.15 },
      { operation: 'Analysis', count: 234, avgCost: 2.45 },
    ],
  },
  logs: {
    entries: [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'info',
        operation: 'Search Query',
        message: 'Successful search completed',
        cost: 0.15,
        tokens: 750,
      },
    ],
  },
});

// Performance test helper
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
};

// Async test helper with timeout
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

export default {
  setupMockIpc,
  checkColorContrast,
  validateAccentureBranding,
  simulateKeyboardNavigation,
  waitForIpcCall,
  createMockFile,
  generateCostScenario,
  generateMockKBEntry,
  renderWithProviders,
  generateTransparencyData,
  measureRenderTime,
  withTimeout,
};