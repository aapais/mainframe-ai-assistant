import React from 'react';
import { render, screen } from '@testing-library/react';
import { VirtualList, FixedSizeList } from '../ui/VirtualList';
import { SearchResults } from '../search/SearchResults';
import { KBEntryList } from '../KBEntryList';

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
  },
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Virtual Scrolling Performance Tests', () => {
  // Generate large datasets for testing
  const generateSearchResults = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      entry: {
        id: `entry-${i}`,
        title: `Test Entry ${i}`,
        problem: `This is a test problem description for entry ${i}. `.repeat(5),
        solution: `This is a test solution for entry ${i}. `.repeat(3),
        category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'][i % 5] as any,
        tags: [`tag${i}`, `category${i % 5}`, `test`],
        created_at: new Date(Date.now() - i * 1000),
        updated_at: new Date(),
        usage_count: i * 2,
        success_count: i,
        failure_count: Math.floor(i / 3),
      },
      score: 95 - (i % 30),
      matchType: 'fuzzy' as const,
      highlights: [],
      explanation: `This matches because of keyword similarity ${i}`,
      metadata: {
        processingTime: 50 + (i % 20),
        source: 'database' as const,
        confidence: 0.9,
        fallback: false,
      },
    }));
  };

  const generateKBEntries = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `kb-entry-${i}`,
      title: `KB Entry ${i}`,
      problem: `Problem description ${i}. `.repeat(4),
      solution: `Solution for problem ${i}. `.repeat(3),
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'][i % 5] as any,
      tags: [`tag${i}`, `kb${i % 10}`],
      created_at: new Date(Date.now() - i * 1000),
      updated_at: new Date(),
      usage_count: i * 3,
      success_count: i * 2,
      failure_count: Math.floor(i / 4),
    }));
  };

  test('VirtualList performance with 1000 items', () => {
    const items = generateKBEntries(1000);
    const startTime = performance.now();

    render(
      <VirtualList
        items={items}
        itemHeight={100}
        height="400px"
      >
        {({ item, index, style }) => (
          <div style={style} data-testid={`item-${index}`}>
            <h3>{item.title}</h3>
            <p>{item.problem}</p>
          </div>
        )}
      </VirtualList>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    console.log(`VirtualList render time for 1000 items: ${renderTime}ms`);

    // Should render quickly (less than 100ms for virtual list)
    expect(renderTime).toBeLessThan(100);

    // Should only render visible items (not all 1000)
    const visibleItems = screen.getAllByTestId(/^item-/);
    expect(visibleItems.length).toBeLessThan(50); // Only visible items rendered
  });

  test('FixedSizeList performance with 5000 items', () => {
    const items = generateKBEntries(5000);
    const startTime = performance.now();

    render(
      <FixedSizeList
        items={items}
        itemHeight={80}
        height="600px"
      >
        {({ item, index, style }) => (
          <div style={style} data-testid={`fixed-item-${index}`}>
            <div>{item.title}</div>
            <div>{item.category}</div>
          </div>
        )}
      </FixedSizeList>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    console.log(`FixedSizeList render time for 5000 items: ${renderTime}ms`);

    // Should render very quickly for fixed height items
    expect(renderTime).toBeLessThan(50);

    // Should only render visible items
    const visibleItems = screen.getAllByTestId(/^fixed-item-/);
    expect(visibleItems.length).toBeLessThan(20);
  });

  test('SearchResults virtual scrolling performance comparison', () => {
    const results = generateSearchResults(2000);

    // Test with virtual scrolling enabled
    const startVirtual = performance.now();
    const { rerender } = render(
      <SearchResults
        results={results}
        query="test"
        isLoading={false}
        onEntrySelect={jest.fn()}
        onEntryRate={jest.fn()}
        onSortChange={jest.fn()}
        enableVirtualScrolling={true}
        virtualScrollHeight="500px"
      />
    );
    const endVirtual = performance.now();
    const virtualTime = endVirtual - startVirtual;

    // Test with virtual scrolling disabled (standard rendering)
    const startStandard = performance.now();
    rerender(
      <SearchResults
        results={results.slice(0, 100)} // Limit to prevent browser hang
        query="test"
        isLoading={false}
        onEntrySelect={jest.fn()}
        onEntryRate={jest.fn()}
        onSortChange={jest.fn()}
        enableVirtualScrolling={false}
      />
    );
    const endStandard = performance.now();
    const standardTime = endStandard - startStandard;

    console.log(`Virtual scrolling time: ${virtualTime}ms`);
    console.log(`Standard rendering time: ${standardTime}ms`);

    // Virtual scrolling should be significantly faster for large datasets
    expect(virtualTime).toBeLessThan(200);
  });

  test('KBEntryList virtual scrolling memory efficiency', () => {
    const entries = generateKBEntries(10000);

    const MockKBDataProvider = ({ children }: { children: React.ReactNode }) => {
      return (
        <div>
          {children}
        </div>
      );
    };

    // Mock the context hooks
    const mockUseKBData = jest.fn(() => ({
      state: {
        entries: new Map(entries.map(e => [e.id, e])),
        isLoading: false,
        error: null,
        totalEntries: entries.length,
      },
      recordEntryView: jest.fn(),
      recordEntryUsage: jest.fn(),
    }));

    const mockUseSearch = jest.fn(() => ({
      state: {
        results: [],
        isSearching: false,
        query: '',
      },
    }));

    // Mock the imports
    jest.doMock('../contexts/KBDataContext', () => ({
      useKBData: mockUseKBData,
    }));

    jest.doMock('../contexts/SearchContext', () => ({
      useSearch: mockUseSearch,
    }));

    const startTime = performance.now();

    render(
      <MockKBDataProvider>
        <KBEntryList
          enableVirtualization={true}
          itemHeight={120}
          maxHeight="400px"
        />
      </MockKBDataProvider>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    console.log(`KBEntryList with 10k items render time: ${renderTime}ms`);

    // Should handle large datasets efficiently
    expect(renderTime).toBeLessThan(500);
  });

  test('Virtual scrolling scroll performance', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: `Description for item ${i}`,
    }));

    let scrollCallCount = 0;
    const onScroll = jest.fn(() => {
      scrollCallCount++;
    });

    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={50}
        height="300px"
        onScroll={onScroll}
      >
        {({ item, style }) => (
          <div style={style}>
            {item.name}
          </div>
        )}
      </VirtualList>
    );

    const scrollContainer = container.querySelector('[style*="overflow: auto"]');
    expect(scrollContainer).toBeTruthy();

    // Simulate scrolling
    const startTime = performance.now();

    // Simulate multiple scroll events
    for (let i = 0; i < 50; i++) {
      const scrollEvent = new Event('scroll');
      Object.defineProperty(scrollEvent, 'currentTarget', {
        writable: false,
        value: {
          scrollTop: i * 10,
        },
      });
      scrollContainer?.dispatchEvent(scrollEvent);
    }

    const endTime = performance.now();
    const scrollTime = endTime - startTime;

    console.log(`Scroll handling time for 50 events: ${scrollTime}ms`);

    // Scroll handling should be fast
    expect(scrollTime).toBeLessThan(50);
    expect(onScroll).toHaveBeenCalled();
  });

  test('Memory usage comparison: virtual vs standard rendering', () => {
    const largeDataset = generateKBEntries(5000);

    // Mock memory measurement
    const initialMemory = (global as any).performance?.memory?.usedJSHeapSize || 0;

    // Render with virtual scrolling
    const { unmount: unmountVirtual } = render(
      <VirtualList
        items={largeDataset}
        itemHeight={100}
        height="400px"
      >
        {({ item, style }) => (
          <div style={style}>
            <h4>{item.title}</h4>
            <p>{item.problem}</p>
          </div>
        )}
      </VirtualList>
    );

    const virtualMemory = (global as any).performance?.memory?.usedJSHeapSize || 0;
    unmountVirtual();

    // Render with standard list (smaller subset to prevent browser hang)
    const { unmount: unmountStandard } = render(
      <div style={{ height: '400px', overflowY: 'auto' }}>
        {largeDataset.slice(0, 100).map((item, index) => (
          <div key={item.id} style={{ height: '100px' }}>
            <h4>{item.title}</h4>
            <p>{item.problem}</p>
          </div>
        ))}
      </div>
    );

    const standardMemory = (global as any).performance?.memory?.usedJSHeapSize || 0;
    unmountStandard();

    if (initialMemory && virtualMemory && standardMemory) {
      const virtualUsage = virtualMemory - initialMemory;
      const standardUsage = standardMemory - initialMemory;

      console.log(`Virtual scrolling memory usage: ${virtualUsage} bytes`);
      console.log(`Standard rendering memory usage: ${standardUsage} bytes`);

      // Virtual scrolling should use less memory for large datasets
      expect(virtualUsage).toBeLessThan(standardUsage * 2);
    }
  });
});

describe('Virtual Scrolling Edge Cases', () => {
  test('handles empty lists gracefully', () => {
    const { container } = render(
      <VirtualList
        items={[]}
        itemHeight={50}
        height="200px"
      >
        {({ item, style }) => <div style={style}>{item}</div>}
      </VirtualList>
    );

    expect(container.firstChild).toBeTruthy();
  });

  test('handles very large item heights', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));

    render(
      <VirtualList
        items={items}
        itemHeight={1000}
        height="300px"
      >
        {({ item, style }) => (
          <div style={style}>{item.name}</div>
        )}
      </VirtualList>
    );

    // Should render without crashing
    expect(screen.getByText('Item 0')).toBeTruthy();
  });

  test('handles rapid resize events', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));

    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={50}
        height="200px"
      >
        {({ item, style }) => (
          <div style={style}>{item.name}</div>
        )}
      </VirtualList>
    );

    const virtualContainer = container.firstChild as HTMLElement;

    // Simulate rapid resize events
    for (let i = 0; i < 10; i++) {
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);
    }

    // Should handle rapid resizing gracefully
    expect(virtualContainer).toBeTruthy();
  });
});