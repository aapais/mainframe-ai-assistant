/**
 * Core Testing Utilities for Mainframe KB Assistant
 * Provides common testing functionality across all test suites
 */

import { vi, MockedFunction } from 'vitest';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactElement } from 'react';
import { KBEntry, SearchResult, SearchOptions } from '../../src/types';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';

// Performance measurement utilities
export class PerformanceMeasurement {
  private startTime: number = 0;
  private markers: Map<string, number> = new Map();

  start(label: string = 'default'): void {
    this.startTime = performance.now();
    this.markers.set(`${label}_start`, this.startTime);
  }

  mark(label: string): void {
    this.markers.set(label, performance.now());
  }

  measure(label: string): number {
    const endTime = performance.now();
    const startTime = this.markers.get(`${label}_start`) || this.startTime;
    const duration = endTime - startTime;
    this.markers.set(`${label}_duration`, duration);
    return duration;
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.markers);
  }

  reset(): void {
    this.markers.clear();
    this.startTime = 0;
  }
}

// Memory monitoring utilities
export class MemoryMonitor {
  private initialMemory: number = 0;
  private measurements: Array<{ timestamp: number; usage: number }> = [];

  start(): void {
    this.initialMemory = process.memoryUsage().heapUsed;
    this.measurements = [];
  }

  measure(): number {
    const currentMemory = process.memoryUsage().heapUsed;
    const usage = currentMemory - this.initialMemory;
    this.measurements.push({
      timestamp: Date.now(),
      usage
    });
    return usage;
  }

  getPeakUsage(): number {
    return Math.max(...this.measurements.map(m => m.usage));
  }

  getAverageUsage(): number {
    const total = this.measurements.reduce((sum, m) => sum + m.usage, 0);
    return total / this.measurements.length;
  }

  reset(): void {
    this.initialMemory = 0;
    this.measurements = [];
  }
}

// Test data generators
export class TestDataGenerator {
  static createKBEntry(overrides: Partial<KBEntry> = {}): KBEntry {
    return {
      id: crypto.randomUUID(),
      title: `Test Entry ${Math.random().toString(36).substr(2, 9)}`,
      problem: 'Test problem description for validation',
      solution: 'Test solution with step-by-step instructions',
      category: 'VSAM',
      tags: ['test', 'sample', 'validation'],
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 80),
      failure_count: Math.floor(Math.random() * 20),
      created_by: 'test-user',
      ...overrides
    };
  }

  static createSearchResult(entry?: KBEntry, overrides: Partial<SearchResult> = {}): SearchResult {
    return {
      entry: entry || this.createKBEntry(),
      score: Math.random() * 100,
      matchType: 'fuzzy',
      highlights: {
        title: [],
        problem: [],
        solution: []
      },
      metadata: {
        source: 'local',
        cached: false,
        processingTime: Math.random() * 100
      },
      ...overrides
    };
  }

  static createSearchOptions(overrides: Partial<SearchOptions> = {}): SearchOptions {
    return {
      limit: 50,
      includeHighlights: true,
      useAI: false, // Default to false for faster tests
      threshold: 0.1,
      sortBy: 'relevance',
      sortOrder: 'desc',
      categories: [],
      tags: [],
      dateRange: undefined,
      userId: 'test-user',
      sessionId: crypto.randomUUID(),
      ...overrides
    };
  }

  static createLargeDataset(size: number): KBEntry[] {
    return Array.from({ length: size }, (_, index) =>
      this.createKBEntry({
        title: `Large Dataset Entry ${index + 1}`,
        problem: `Problem ${index + 1} for performance testing`,
        solution: `Solution ${index + 1} with detailed steps`,
        category: ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'][index % 5],
        tags: [`tag${index % 10}`, `category${index % 5}`, `test${index}`]
      })
    );
  }
}

// Mock factories
export class MockFactory {
  static createMockSearchService() {
    return {
      search: vi.fn().mockResolvedValue([]),
      buildIndex: vi.fn().mockResolvedValue(undefined),
      suggest: vi.fn().mockResolvedValue([]),
      getRecentSearches: vi.fn().mockResolvedValue([]),
      getPopularSearches: vi.fn().mockResolvedValue([]),
      recordSearch: vi.fn().mockResolvedValue(undefined),
      getSearchMetrics: vi.fn().mockResolvedValue({})
    };
  }

  static createMockKnowledgeDB() {
    return {
      addEntry: vi.fn().mockResolvedValue('test-id'),
      search: vi.fn().mockResolvedValue([]),
      getEntry: vi.fn().mockResolvedValue(null),
      updateEntry: vi.fn().mockResolvedValue(undefined),
      deleteEntry: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
      getMetrics: vi.fn().mockResolvedValue({}),
      close: vi.fn().mockResolvedValue(undefined)
    };
  }

  static createMockGeminiService() {
    return {
      findSimilar: vi.fn().mockResolvedValue([]),
      explainError: vi.fn().mockResolvedValue('Mock explanation'),
      analyzeCode: vi.fn().mockResolvedValue('Mock analysis'),
      generateSummary: vi.fn().mockResolvedValue('Mock summary')
    };
  }

  static createMockElectronAPI() {
    return {
      searchKB: vi.fn().mockResolvedValue([]),
      addKBEntry: vi.fn().mockResolvedValue('test-id'),
      getKBEntry: vi.fn().mockResolvedValue(null),
      getGeminiConfig: vi.fn().mockResolvedValue({ apiKey: 'test-key' }),
      showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/test/path' }),
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/test/path'] })
    };
  }
}

// Assertion helpers
export class AssertionHelpers {
  static async assertPerformance(
    operation: () => Promise<any>,
    maxTime: number,
    label?: string
  ): Promise<void> {
    const perf = new PerformanceMeasurement();
    perf.start();

    await operation();

    const duration = perf.measure('operation');
    if (duration > maxTime) {
      throw new Error(
        `Performance assertion failed${label ? ` for ${label}` : ''}: ` +
        `Expected <= ${maxTime}ms, but got ${duration.toFixed(2)}ms`
      );
    }
  }

  static async assertMemoryUsage(
    operation: () => Promise<any>,
    maxMemoryMB: number,
    label?: string
  ): Promise<void> {
    const monitor = new MemoryMonitor();
    monitor.start();

    await operation();

    const peakUsageMB = monitor.getPeakUsage() / (1024 * 1024);
    if (peakUsageMB > maxMemoryMB) {
      throw new Error(
        `Memory assertion failed${label ? ` for ${label}` : ''}: ` +
        `Expected <= ${maxMemoryMB}MB, but peak was ${peakUsageMB.toFixed(2)}MB`
      );
    }
  }

  static assertSearchResults(results: SearchResult[], query: string): void {
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);

    results.forEach((result, index) => {
      expect(result.entry).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.matchType).toMatch(/^(exact|fuzzy|ai)$/);

      // Results should be sorted by score (relevance)
      if (index > 0) {
        expect(result.score).toBeLessThanOrEqual(results[index - 1].score);
      }
    });
  }

  static assertKBEntry(entry: KBEntry): void {
    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();
    expect(entry.title).toBeTruthy();
    expect(entry.problem).toBeTruthy();
    expect(entry.solution).toBeTruthy();
    expect(['VSAM', 'JCL', 'DB2', 'Batch', 'Functional', 'Other']).toContain(entry.category);
    expect(entry.created_at).toBeInstanceOf(Date);
    expect(entry.usage_count).toBeGreaterThanOrEqual(0);
    expect(entry.success_count).toBeGreaterThanOrEqual(0);
    expect(entry.failure_count).toBeGreaterThanOrEqual(0);
  }

  static assertAccessibility(element: HTMLElement): void {
    // Check for basic accessibility attributes
    const interactiveElements = element.querySelectorAll('button, input, select, textarea, a[href]');

    interactiveElements.forEach(el => {
      // All interactive elements should be focusable
      expect(el.hasAttribute('tabindex') || el.getAttribute('tabindex') !== '-1').toBeTruthy();

      // Buttons should have accessible names
      if (el.tagName === 'BUTTON') {
        expect(
          el.getAttribute('aria-label') ||
          el.textContent?.trim() ||
          el.getAttribute('title')
        ).toBeTruthy();
      }

      // Form inputs should have labels
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const id = el.getAttribute('id');
        if (id) {
          const label = element.querySelector(`label[for="${id}"]`);
          expect(label || el.getAttribute('aria-label')).toBeTruthy();
        }
      }
    });
  }
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  mockElectronAPI?: boolean;
  initialState?: any;
}

export function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const { mockElectronAPI = true, initialState, ...renderOptions } = options;

  // Mock Electron API if requested
  if (mockElectronAPI && !window.electronAPI) {
    (window as any).electronAPI = MockFactory.createMockElectronAPI();
  }

  // Create wrapper with providers if needed
  const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <>{children}</>;
  };

  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
}

// Test utilities for async operations
export class AsyncTestUtils {
  static async waitForCondition(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError!;
  }

  static createDelayedPromise<T>(value: T, delayMs: number): Promise<T> {
    return new Promise(resolve => {
      setTimeout(() => resolve(value), delayMs);
    });
  }
}

// Database test utilities
export class DatabaseTestUtils {
  static async createTestDatabase(): Promise<any> {
    return TestDatabaseFactory.createTestDatabaseManager({
      path: ':memory:',
      enableMonitoring: false
    });
  }

  static async seedTestData(db: any, entryCount: number = 50): Promise<void> {
    const entries = TestDataGenerator.createLargeDataset(entryCount);
    for (const entry of entries) {
      await db.addEntry(entry, 'test-user');
    }
  }

  static async cleanupTestDatabase(db: any): Promise<void> {
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  }
}

// Export all utilities
export {
  userEvent,
  waitFor,
  act,
  vi,
  type MockedFunction
};