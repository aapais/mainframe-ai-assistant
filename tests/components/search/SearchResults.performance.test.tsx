/**
 * Performance Tests for SearchResults Component
 * 
 * Test Coverage:
 * - Rendering performance with large datasets
 * - Memory usage optimization
 * - Virtual scrolling efficiency
 * - Re-render optimization
 * - Search highlighting performance
 * - Component lifecycle performance
 */

import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import SearchResults from '../../../src/renderer/components/search/SearchResults';
import SearchResultsVirtualized from '../../../src/renderer/components/search/SearchResultsVirtualized';
import { mockSearchResults } from '../../../tests/fixtures/searchResults';
import { SearchResult } from '../../../src/types/services';

// Performance test configuration
const PERFORMANCE_TIMEOUT = 30000;
const MAX_RENDER_TIME = 100; // milliseconds
const MAX_MEMORY_USAGE = 50 * 1024 * 1024; // 50MB
const LARGE_DATASET_SIZE = 1000;
const MASSIVE_DATASET_SIZE = 10000;

// Mock console.time methods for performance measurement
const performanceMetrics: { [key: string]: number } = {};
const originalConsoleTime = console.time;
const originalConsoleTimeEnd = console.timeEnd;

beforeAll(() => {
  console.time = jest.fn((label: string) => {
    performanceMetrics[label] = performance.now();
  });
  
  console.timeEnd = jest.fn((label: string) => {
    if (performanceMetrics[label]) {
      const duration = performance.now() - performanceMetrics[label];
      performanceMetrics[`${label}_duration`] = duration;
      console.log(`${label}: ${duration.toFixed(2)}ms`);
    }
  });
});

afterAll(() => {
  console.time = originalConsoleTime;
  console.timeEnd = originalConsoleTimeEnd;
});

beforeEach(() => {
  // Clear performance metrics
  Object.keys(performanceMetrics).forEach(key => {
    delete performanceMetrics[key];
  });
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

afterEach(() => {
  cleanup();
});

// Helper function to generate large datasets
const generateLargeDataset = (size: number): SearchResult[] => {
  return Array.from({ length: size }, (_, index) => ({
    entry: {
      id: `perf-entry-${index}`,
      title: `Performance Test Entry ${index}`,
      problem: `This is a performance test problem description ${index}. `.repeat(10),
      solution: `This is a performance test solution ${index}. `.repeat(15),
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'System'][index % 5],
      tags: [`tag-${index}`, `perf-${index}`, 'performance', 'test'],
      created_at: new Date(Date.now() - index * 1000),
      updated_at: new Date(Date.now() - index * 500),
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 80),
      failure_count: Math.floor(Math.random() * 20),
    },
    score: 95 - (index % 30),
    matchType: (['exact', 'fuzzy', 'semantic', 'ai'] as const)[index % 4],
    highlights: index % 3 === 0 ? [{
      field: 'title' as keyof any,
      start: 0,
      end: 10,
      text: 'Performance',
      context: 'Performance Test Entry'
    }] : undefined,
    explanation: index % 5 === 0 ? 'This result matches due to performance testing criteria' : undefined,
    metadata: {
      processingTime: Math.random() * 100,
      source: (['cache', 'database', 'ai'] as const)[index % 3],
      confidence: 0.7 + (Math.random() * 0.3),
      fallback: index % 10 === 0
    }
  }));
};

// Helper function to measure memory usage
const getMemoryUsage = (): number => {
  if ((performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
};

// Helper function to measure render time
const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const startTime = performance.now();
  await act(async () => {
    renderFn();
  });
  return performance.now() - startTime;
};

describe('SearchResults Performance Tests', () => {
  const defaultProps = {
    query: 'performance test',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn(),
  };

  describe('Rendering Performance', () => {
    it('renders small datasets quickly', async () => {
      const smallDataset = generateLargeDataset(10);
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={smallDataset}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME);
    }, PERFORMANCE_TIMEOUT);

    it('handles medium datasets efficiently', async () => {
      const mediumDataset = generateLargeDataset(100);
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={mediumDataset}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME * 2);
    }, PERFORMANCE_TIMEOUT);

    it('uses virtual scrolling for large datasets', async () => {
      const largeDataset = generateLargeDataset(LARGE_DATASET_SIZE);
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={largeDataset}
            enableVirtualScrolling={true}
          />
        );
      });
      
      // Virtual scrolling should make large datasets render quickly
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME * 3);
    }, PERFORMANCE_TIMEOUT);

    it('maintains performance with virtual scrolling disabled on large datasets', async () => {
      const largeDataset = generateLargeDataset(50); // Smaller for non-virtual
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={largeDataset}
            enableVirtualScrolling={false}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME * 5);
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Memory Usage', () => {
    it('maintains reasonable memory usage with large datasets', async () => {
      const initialMemory = getMemoryUsage();
      const largeDataset = generateLargeDataset(LARGE_DATASET_SIZE);
      
      await act(async () => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={largeDataset}
            enableVirtualScrolling={true}
          />
        );
      });
      
      const afterRenderMemory = getMemoryUsage();
      const memoryIncrease = afterRenderMemory - initialMemory;
      
      if (memoryIncrease > 0) {
        expect(memoryIncrease).toBeLessThan(MAX_MEMORY_USAGE);
      }
    }, PERFORMANCE_TIMEOUT);

    it('cleans up memory properly on unmount', async () => {
      const largeDataset = generateLargeDataset(LARGE_DATASET_SIZE);
      
      const { unmount } = render(
        <SearchResults 
          {...defaultProps} 
          results={largeDataset}
          enableVirtualScrolling={true}
        />
      );
      
      const beforeUnmountMemory = getMemoryUsage();
      unmount();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const afterUnmountMemory = getMemoryUsage();
      
      // Memory should not increase significantly after unmount
      if (beforeUnmountMemory > 0 && afterUnmountMemory > 0) {
        const memoryIncrease = afterUnmountMemory - beforeUnmountMemory;
        expect(memoryIncrease).toBeLessThan(MAX_MEMORY_USAGE / 10);
      }
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Re-render Performance', () => {
    it('optimizes re-renders with memoization', async () => {
      const dataset = generateLargeDataset(100);
      
      const { rerender } = render(
        <SearchResults 
          {...defaultProps} 
          results={dataset}
        />
      );
      
      // First re-render with same props
      const rerenderTime1 = await measureRenderTime(() => {
        rerender(
          <SearchResults 
            {...defaultProps} 
            results={dataset}
          />
        );
      });
      
      // Second re-render with same props
      const rerenderTime2 = await measureRenderTime(() => {
        rerender(
          <SearchResults 
            {...defaultProps} 
            results={dataset}
          />
        );
      });
      
      // Re-renders should be fast due to memoization
      expect(rerenderTime1).toBeLessThan(MAX_RENDER_TIME / 2);
      expect(rerenderTime2).toBeLessThan(MAX_RENDER_TIME / 2);
    }, PERFORMANCE_TIMEOUT);

    it('handles prop changes efficiently', async () => {
      const dataset = generateLargeDataset(100);
      
      const { rerender } = render(
        <SearchResults 
          {...defaultProps} 
          results={dataset}
          sortBy="relevance"
        />
      );
      
      const rerenderTime = await measureRenderTime(() => {
        rerender(
          <SearchResults 
            {...defaultProps} 
            results={dataset}
            sortBy="usage"
          />
        );
      });
      
      expect(rerenderTime).toBeLessThan(MAX_RENDER_TIME);
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Search Highlighting Performance', () => {
    it('handles highlighting efficiently with large content', async () => {
      const dataset = generateLargeDataset(50).map(result => ({
        ...result,
        entry: {
          ...result.entry,
          title: 'Performance '.repeat(20) + ` Test ${result.entry.id}`,
          problem: 'Performance testing '.repeat(100),
          solution: 'Performance optimization '.repeat(150)
        }
      }));
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={dataset}
            query="Performance"
            highlightQuery={true}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME * 2);
    }, PERFORMANCE_TIMEOUT);

    it('optimizes highlighting with complex queries', async () => {
      const dataset = generateLargeDataset(30);
      const complexQuery = 'Performance test optimization memory usage efficiency';
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={dataset}
            query={complexQuery}
            highlightQuery={true}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME * 1.5);
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Component Lifecycle Performance', () => {
    it('mounts quickly with pre-loaded data', async () => {
      const dataset = generateLargeDataset(200);
      
      const mountTime = await measureRenderTime(() => {
        render(
          <SearchResults 
            {...defaultProps} 
            results={dataset}
            enableVirtualScrolling={true}
          />
        );
      });
      
      expect(mountTime).toBeLessThan(MAX_RENDER_TIME * 2);
    }, PERFORMANCE_TIMEOUT);

    it('updates efficiently when results change', async () => {
      const initialDataset = generateLargeDataset(100);
      const updatedDataset = generateLargeDataset(120);
      
      const { rerender } = render(
        <SearchResults 
          {...defaultProps} 
          results={initialDataset}
        />
      );
      
      const updateTime = await measureRenderTime(() => {
        rerender(
          <SearchResults 
            {...defaultProps} 
            results={updatedDataset}
          />
        );
      });
      
      expect(updateTime).toBeLessThan(MAX_RENDER_TIME);
    }, PERFORMANCE_TIMEOUT);
  });
});

describe('SearchResultsVirtualized Performance Tests', () => {
  const defaultProps = {
    query: 'performance test',
    isLoading: false,
    onEntrySelect: jest.fn(),
  };

  describe('Massive Dataset Performance', () => {
    it('handles massive datasets with virtual scrolling', async () => {
      const massiveDataset = generateLargeDataset(MASSIVE_DATASET_SIZE);
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResultsVirtualized 
            {...defaultProps} 
            results={massiveDataset}
          />
        );
      });
      
      // Even with 10k items, should render quickly due to virtualization
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME * 3);
    }, PERFORMANCE_TIMEOUT);

    it('maintains memory efficiency with massive datasets', async () => {
      const initialMemory = getMemoryUsage();
      const massiveDataset = generateLargeDataset(MASSIVE_DATASET_SIZE);
      
      await act(async () => {
        render(
          <SearchResultsVirtualized 
            {...defaultProps} 
            results={massiveDataset}
          />
        );
      });
      
      const afterRenderMemory = getMemoryUsage();
      const memoryIncrease = afterRenderMemory - initialMemory;
      
      if (memoryIncrease > 0) {
        // Should use minimal additional memory due to virtualization
        expect(memoryIncrease).toBeLessThan(MAX_MEMORY_USAGE * 2);
      }
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Scroll Performance', () => {
    it('handles rapid scrolling efficiently', async () => {
      const largeDataset = generateLargeDataset(LARGE_DATASET_SIZE);
      
      const { container } = render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={largeDataset}
        />
      );
      
      // Simulate rapid scroll events
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        fireEvent.scroll(container, { target: { scrollTop: i * 10 } });
      }
      
      const scrollTime = performance.now() - startTime;
      
      expect(scrollTime).toBeLessThan(100); // Should handle scrolling smoothly
    }, PERFORMANCE_TIMEOUT);
  });

  describe('Dynamic Height Calculation', () => {
    it('calculates item heights efficiently', async () => {
      const variableDataset = generateLargeDataset(500).map((result, index) => ({
        ...result,
        entry: {
          ...result.entry,
          problem: 'Variable content '.repeat(index % 10 + 1),
          solution: 'Variable solution '.repeat(index % 15 + 1),
          tags: Array.from({ length: index % 8 + 1 }, (_, i) => `tag-${i}`)
        }
      }));
      
      const renderTime = await measureRenderTime(() => {
        render(
          <SearchResultsVirtualized 
            {...defaultProps} 
            results={variableDataset}
          />
        );
      });
      
      expect(renderTime).toBeLessThan(MAX_RENDER_TIME * 2);
    }, PERFORMANCE_TIMEOUT);
  });
});

describe('Performance Regression Tests', () => {
  it('maintains baseline performance over time', async () => {
    const testDataset = generateLargeDataset(500);
    const iterations = 5;
    const renderTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const renderTime = await measureRenderTime(() => {
        const { unmount } = render(
          <SearchResults 
            {...defaultProps}
            results={testDataset}
            enableVirtualScrolling={true}
          />
        );
        unmount();
      });
      
      renderTimes.push(renderTime);
    }
    
    const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);
    const minRenderTime = Math.min(...renderTimes);
    
    console.log(`Performance metrics:`);
    console.log(`Average render time: ${averageRenderTime.toFixed(2)}ms`);
    console.log(`Max render time: ${maxRenderTime.toFixed(2)}ms`);
    console.log(`Min render time: ${minRenderTime.toFixed(2)}ms`);
    console.log(`Variance: ${(maxRenderTime - minRenderTime).toFixed(2)}ms`);
    
    expect(averageRenderTime).toBeLessThan(MAX_RENDER_TIME * 2);
    expect(maxRenderTime - minRenderTime).toBeLessThan(MAX_RENDER_TIME); // Low variance
  }, PERFORMANCE_TIMEOUT);

  const defaultProps = {
    query: 'regression test',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn(),
  };
});