/**
 * Test Utilities for SearchResults Component Testing
 * 
 * Provides:
 * - Mock data generators
 * - Test helpers and utilities
 * - Performance measurement tools
 * - Accessibility testing helpers
 * - Visual testing utilities
 */

import { SearchResult, SearchOptions, KBEntry, SearchMetadata } from '../../../src/types/services';

// =====================
// Mock Data Generators
// =====================

export const createMockKBEntry = (overrides: Partial<KBEntry> = {}): KBEntry => ({
  id: `entry-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Mock KB Entry Title',
  problem: 'This is a mock problem description for testing purposes.',
  solution: 'This is a mock solution for testing purposes.',
  category: 'Batch',
  tags: ['mock', 'test', 'example'],
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  usage_count: 10,
  success_count: 8,
  failure_count: 2,
  ...overrides
});

export const createMockSearchResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  entry: createMockKBEntry(),
  score: 95,
  matchType: 'ai',
  highlights: [{
    field: 'title',
    start: 0,
    end: 4,
    text: 'Mock',
    context: 'Mock KB Entry Title'
  }],
  explanation: 'This result matches due to high semantic similarity.',
  metadata: {
    processingTime: 150,
    source: 'ai',
    confidence: 0.95,
    fallback: false
  },
  ...overrides
});

export const generateMockResults = (
  count: number,
  customizer?: (index: number) => Partial<SearchResult>
): SearchResult[] => {
  return Array.from({ length: count }, (_, index) => {
    const baseResult = createMockSearchResult({
      entry: createMockKBEntry({
        id: `generated-entry-${index}`,
        title: `Generated Test Entry ${index}`,
        problem: `Generated problem description ${index}`,
        solution: `Generated solution ${index}`,
        category: ['JCL', 'VSAM', 'DB2', 'Batch', 'System'][index % 5],
        tags: [`tag-${index}`, 'generated', 'test'],
        usage_count: Math.floor(Math.random() * 100),
        success_count: Math.floor(Math.random() * 50),
        failure_count: Math.floor(Math.random() * 10)
      }),
      score: 95 - (index * 2),
      matchType: (['exact', 'fuzzy', 'semantic', 'ai'] as const)[index % 4]
    });
    
    return customizer ? { ...baseResult, ...customizer(index) } : baseResult;
  });
};

export const createPerformanceDataset = (size: number): SearchResult[] => {
  return generateMockResults(size, (index) => ({
    entry: createMockKBEntry({
      id: `perf-${index}`,
      title: `Performance Test Entry ${index}`,
      problem: 'Performance test problem '.repeat(Math.random() * 10 + 1),
      solution: 'Performance test solution '.repeat(Math.random() * 15 + 1),
      tags: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => `perf-tag-${i}`)
    })
  }));
};

export const createVariableContentDataset = (): SearchResult[] => {
  const variations = [
    { title: 'Short', problem: 'Short.', solution: 'Short.' },
    {
      title: 'Medium length title with some detail',
      problem: 'Medium length problem description with adequate detail.',
      solution: 'Medium length solution with step-by-step instructions.'
    },
    {
      title: 'Very long title that should test how the component handles extensive text content and wrapping behavior across multiple lines',
      problem: 'This is an extremely long problem description that contains multiple sentences and paragraphs. '.repeat(5),
      solution: 'This is a very detailed solution with extensive technical information and multiple steps. '.repeat(8)
    }
  ];
  
  return variations.map((variation, index) => 
    createMockSearchResult({
      entry: createMockKBEntry({
        id: `variable-${index}`,
        ...variation
      })
    })
  );
};

// =====================
// Test Helper Functions
// =====================

export const mockProps = {
  basic: {
    results: generateMockResults(3),
    query: 'test query',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn()
  },
  
  loading: {
    results: [],
    query: 'loading test',
    isLoading: true,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn()
  },
  
  empty: {
    results: [],
    query: 'empty test',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn()
  },
  
  withPagination: {
    results: generateMockResults(10),
    query: 'pagination test',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn(),
    pagination: {
      page: 1,
      pageSize: 10,
      total: 50,
      onPageChange: jest.fn()
    }
  }
};

export const clearAllMocks = () => {
  Object.values(mockProps).forEach(props => {
    if ('onEntrySelect' in props) props.onEntrySelect.mockClear();
    if ('onEntryRate' in props) props.onEntryRate.mockClear();
    if ('onSortChange' in props) props.onSortChange.mockClear();
    if ('pagination' in props && props.pagination) {
      props.pagination.onPageChange.mockClear();
    }
  });
};

// =====================
// Performance Utilities
// =====================

export class PerformanceProfiler {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();
  
  start(name: string): void {
    this.marks.set(name, performance.now());
  }
  
  end(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) {
      throw new Error(`No start mark found for '${name}'`);
    }
    
    const duration = performance.now() - startTime;
    this.measures.set(name, duration);
    return duration;
  }
  
  getDuration(name: string): number | undefined {
    return this.measures.get(name);
  }
  
  getAllMeasures(): Map<string, number> {
    return new Map(this.measures);
  }
  
  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }
  
  report(): void {
    console.log('Performance Report:');
    this.measures.forEach((duration, name) => {
      console.log(`  ${name}: ${duration.toFixed(2)}ms`);
    });
  }
}

export const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const startTime = performance.now();
  renderFn();
  // Wait for next tick to ensure render is complete
  await new Promise(resolve => setTimeout(resolve, 0));
  return performance.now() - startTime;
};

export const getMemoryUsage = (): number => {
  if ((performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
};

export const forceGarbageCollection = (): Promise<void> => {
  return new Promise(resolve => {
    if ((global as any).gc) {
      (global as any).gc();
    }
    setTimeout(resolve, 100);
  });
};

// =====================
// Accessibility Utilities
// =====================

export const findFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');
  
  return Array.from(container.querySelectorAll(focusableSelectors));
};

export const simulateKeyboardNavigation = async (
  container: HTMLElement,
  sequence: string[]
): Promise<HTMLElement[]> => {
  const focusableElements = findFocusableElements(container);
  const focusedElements: HTMLElement[] = [];
  
  let currentIndex = 0;
  
  for (const key of sequence) {
    let targetElement: HTMLElement | null = null;
    
    switch (key) {
      case 'Tab':
        currentIndex = Math.min(currentIndex + 1, focusableElements.length - 1);
        targetElement = focusableElements[currentIndex];
        break;
      case 'Shift+Tab':
        currentIndex = Math.max(currentIndex - 1, 0);
        targetElement = focusableElements[currentIndex];
        break;
      case 'Enter':
      case ' ':
        targetElement = focusableElements[currentIndex];
        if (targetElement) {
          targetElement.click();
        }
        break;
    }
    
    if (targetElement) {
      targetElement.focus();
      focusedElements.push(targetElement);
      // Wait for focus events to process
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return focusedElements;
};

export const checkAriaAttributes = (element: HTMLElement): {
  valid: boolean;
  issues: string[];
} => {
  const issues: string[] = [];
  
  // Check for required ARIA attributes on interactive elements
  if (element.tagName === 'BUTTON') {
    if (!element.getAttribute('aria-label') && !element.textContent?.trim()) {
      issues.push('Button missing aria-label or text content');
    }
    
    if (element.getAttribute('aria-expanded') !== null) {
      const expanded = element.getAttribute('aria-expanded');
      if (expanded !== 'true' && expanded !== 'false') {
        issues.push('aria-expanded must be "true" or "false"');
      }
    }
  }
  
  // Check for proper heading hierarchy
  if (element.tagName.match(/^H[1-6]$/)) {
    const level = parseInt(element.tagName[1]);
    const prevHeadings = Array.from(
      element.ownerDocument.querySelectorAll('h1, h2, h3, h4, h5, h6')
    );
    
    const prevHeading = prevHeadings[prevHeadings.indexOf(element) - 1] as HTMLHeadingElement;
    if (prevHeading) {
      const prevLevel = parseInt(prevHeading.tagName[1]);
      if (level > prevLevel + 1) {
        issues.push(`Heading level ${level} follows level ${prevLevel}, skipping levels`);
      }
    }
  }
  
  // Check for landmark roles
  if (element.getAttribute('role') === 'region' && !element.getAttribute('aria-label')) {
    issues.push('Region landmark missing aria-label');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

// =====================
// Visual Testing Utilities
// =====================

export const createVisualSnapshot = (container: HTMLElement, name: string) => {
  const rect = container.getBoundingClientRect();
  
  return {
    name,
    html: container.innerHTML,
    styles: getComputedStyles(container),
    dimensions: {
      width: rect.width,
      height: rect.height
    },
    timestamp: new Date().toISOString()
  };
};

const getComputedStyles = (element: HTMLElement): Record<string, string> => {
  const styles = window.getComputedStyle(element);
  const importantStyles = [
    'display', 'position', 'width', 'height', 'margin', 'padding',
    'border', 'background', 'color', 'font-family', 'font-size',
    'line-height', 'text-align', 'flex', 'grid'
  ];
  
  const result: Record<string, string> = {};
  importantStyles.forEach(property => {
    result[property] = styles.getPropertyValue(property);
  });
  
  return result;
};

export const mockViewport = (width: number, height: number = 600) => {
  Object.defineProperties(window, {
    innerWidth: { value: width, writable: true, configurable: true },
    innerHeight: { value: height, writable: true, configurable: true }
  });
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

export const mockMediaQuery = (query: string, matches: boolean = true) => {
  const mockMediaQueryList = {
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };
  
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((q) => 
      q === query ? mockMediaQueryList : { matches: false, media: q }
    )
  });
  
  return mockMediaQueryList;
};

// =====================
// Test Data Validators
// =====================

export const validateSearchResult = (result: SearchResult): boolean => {
  return !!
    result &&
    result.entry &&
    typeof result.score === 'number' &&
    result.score >= 0 &&
    result.score <= 100 &&
    result.matchType &&
    ['exact', 'fuzzy', 'semantic', 'ai', 'category', 'tag'].includes(result.matchType);
};

export const validateKBEntry = (entry: KBEntry): boolean => {
  return !!
    entry &&
    entry.id &&
    entry.title &&
    entry.problem &&
    entry.solution &&
    entry.category &&
    Array.isArray(entry.tags) &&
    entry.created_at instanceof Date &&
    entry.updated_at instanceof Date &&
    typeof entry.usage_count === 'number' &&
    typeof entry.success_count === 'number' &&
    typeof entry.failure_count === 'number';
};

// =====================
// Test Environment Setup
// =====================

export const setupTestEnvironment = () => {
  // Mock IntersectionObserver for virtual scrolling tests
  global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '',
    thresholds: []
  }));
  
  // Mock ResizeObserver
  global.ResizeObserver = jest.fn().mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
  }));
  
  // Mock requestAnimationFrame
  global.requestAnimationFrame = jest.fn().mockImplementation((callback) => {
    return setTimeout(callback, 16);
  });
  
  // Mock cancelAnimationFrame
  global.cancelAnimationFrame = jest.fn().mockImplementation((id) => {
    clearTimeout(id);
  });
  
  // Reset viewport
  mockViewport(1024, 768);
};

export const cleanupTestEnvironment = () => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Clean up any timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  
  // Reset viewport
  mockViewport(1024, 768);
};

// =====================
// Custom Test Matchers
// =====================

export const customMatchers = {
  toBeWithinPerformanceBudget: (received: number, budget: number) => {
    const pass = received <= budget;
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received}ms to exceed ${budget}ms`
          : `Expected ${received}ms to be within budget of ${budget}ms`
    };
  },
  
  toHaveValidAriaAttributes: (received: HTMLElement) => {
    const result = checkAriaAttributes(received);
    return {
      pass: result.valid,
      message: () => 
        result.valid
          ? 'Element has valid ARIA attributes'
          : `Element has ARIA issues: ${result.issues.join(', ')}`
    };
  }
};

// Export all utilities as a single object for convenience
export default {
  createMockKBEntry,
  createMockSearchResult,
  generateMockResults,
  createPerformanceDataset,
  createVariableContentDataset,
  mockProps,
  clearAllMocks,
  PerformanceProfiler,
  measureRenderTime,
  getMemoryUsage,
  forceGarbageCollection,
  findFocusableElements,
  simulateKeyboardNavigation,
  checkAriaAttributes,
  createVisualSnapshot,
  mockViewport,
  mockMediaQuery,
  validateSearchResult,
  validateKBEntry,
  setupTestEnvironment,
  cleanupTestEnvironment,
  customMatchers
};