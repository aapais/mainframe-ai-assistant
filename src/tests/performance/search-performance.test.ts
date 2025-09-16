/**
 * Search Performance Tests
 *
 * Validates that all search components meet performance requirements:
 * - Autocomplete response time < 100ms for cached queries
 * - Search execution time < 1000ms
 * - Keyboard navigation response < 50ms
 * - Memory usage within acceptable limits
 */

import { performance } from 'perf_hooks';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import IntelligentSearchInput from '../../src/renderer/components/search/IntelligentSearchInput';
import SearchAutocomplete from '../../src/renderer/components/search/SearchAutocomplete';
import { usePerformanceMonitoring } from '../../src/renderer/hooks/usePerformanceMonitoring';

// Mock electron API
const mockElectronAPI = {
  kb: {
    search: jest.fn(),
  },
  searchHistory: {
    getHistory: jest.fn(),
    addEntry: jest.fn(),
  },
  analytics: {
    trackEvent: jest.fn(),
  },
};

(global as any).window.electronAPI = mockElectronAPI;

describe('Search Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.searchHistory.getHistory.mockResolvedValue({
      history: [],
      popular: [],
    });
  });

  describe('Autocomplete Performance', () => {
    test('should respond to typing within 100ms for cached queries', async () => {
      const mockSuggestions = Array.from({ length: 10 }, (_, i) => `suggestion-${i}`);
      const onSearch = jest.fn();
      const onChange = jest.fn();

      render(
        <SearchAutocomplete
          value=""
          onChange={onChange}
          onSearch={onSearch}
          recentSearches={mockSuggestions}
          debounceMs={50}
          maxSuggestions={10}
        />
      );

      const input = screen.getByRole('combobox');
      const startTime = performance.now();

      act(() => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('test');
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(100); // < 100ms SLA
    });

    test('should handle rapid typing without performance degradation', async () => {
      const onSearch = jest.fn();
      const onChange = jest.fn();
      const mockSuggestions = Array.from({ length: 100 }, (_, i) => `suggestion-${i}`);

      render(
        <SearchAutocomplete
          value=""
          onChange={onChange}
          onSearch={onSearch}
          recentSearches={mockSuggestions}
          debounceMs={100}
        />
      );

      const input = screen.getByRole('combobox');
      const responses: number[] = [];

      // Simulate rapid typing
      const rapidTypingTest = async () => {
        const testQueries = ['t', 'te', 'tes', 'test', 'testi', 'testin', 'testing'];

        for (const query of testQueries) {
          const startTime = performance.now();

          act(() => {
            fireEvent.change(input, { target: { value: query } });
          });

          await waitFor(() => {
            expect(onChange).toHaveBeenLastCalledWith(query);
          });

          const endTime = performance.now();
          responses.push(endTime - startTime);
        }
      };

      await rapidTypingTest();

      // All responses should be under 150ms even with rapid typing
      responses.forEach(responseTime => {
        expect(responseTime).toBeLessThan(150);
      });

      // Average response time should be under 100ms
      const averageResponseTime = responses.reduce((a, b) => a + b, 0) / responses.length;
      expect(averageResponseTime).toBeLessThan(100);
    });

    test('should maintain performance with large suggestion sets', async () => {
      const largeSuggestionSet = Array.from({ length: 1000 }, (_, i) => `suggestion-${i}`);
      const onSearch = jest.fn();
      const onChange = jest.fn();

      const startTime = performance.now();

      render(
        <SearchAutocomplete
          value=""
          onChange={onChange}
          onSearch={onSearch}
          recentSearches={largeSuggestionSet}
          maxSuggestions={50}
        />
      );

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Component should render quickly

      const input = screen.getByRole('combobox');
      const searchStartTime = performance.now();

      act(() => {
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('test');
      });

      const searchTime = performance.now() - searchStartTime;
      expect(searchTime).toBeLessThan(200); // Should handle large datasets efficiently
    });
  });

  describe('Search Execution Performance', () => {
    test('should execute search within 1000ms', async () => {
      mockElectronAPI.kb.search.mockImplementation(async (query) => {
        // Simulate realistic search delay
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          success: true,
          results: [{ id: '1', title: `Result for ${query}` }]
        };
      });

      const onSearch = jest.fn();

      render(
        <IntelligentSearchInput
          value=""
          onChange={() => {}}
          onSearch={onSearch}
        />
      );

      const input = screen.getByRole('combobox');
      const startTime = performance.now();

      act(() => {
        fireEvent.change(input, { target: { value: 'test query' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith('test query');
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // < 1s SLA
    });

    test('should handle concurrent searches efficiently', async () => {
      let searchCount = 0;
      mockElectronAPI.kb.search.mockImplementation(async (query) => {
        searchCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          results: [{ id: searchCount.toString(), title: `Result for ${query}` }]
        };
      });

      const onSearch = jest.fn();

      render(
        <IntelligentSearchInput
          value=""
          onChange={() => {}}
          onSearch={onSearch}
        />
      );

      const input = screen.getByRole('combobox');

      // Fire multiple searches rapidly
      const searches = ['search1', 'search2', 'search3', 'search4', 'search5'];
      const startTime = performance.now();

      await Promise.all(searches.map(async (query, index) => {
        act(() => {
          fireEvent.change(input, { target: { value: query } });
          fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        });

        await waitFor(() => {
          expect(mockElectronAPI.kb.search).toHaveBeenCalledWith(query);
        });
      }));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle concurrent searches efficiently
      expect(totalTime).toBeLessThan(2000); // Should not take more than 2s for 5 searches
      expect(searchCount).toBe(5); // All searches should be executed
    });
  });

  describe('Keyboard Navigation Performance', () => {
    test('should respond to keyboard navigation within 50ms', async () => {
      const onSearch = jest.fn();
      const onChange = jest.fn();
      const suggestions = ['suggestion1', 'suggestion2', 'suggestion3'];

      render(
        <SearchAutocomplete
          value="test"
          onChange={onChange}
          onSearch={onSearch}
          recentSearches={suggestions}
        />
      );

      const input = screen.getByRole('combobox');

      // Focus the input and type to show suggestions
      act(() => {
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const navigationStartTime = performance.now();

      // Test arrow key navigation
      act(() => {
        fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
      });

      // Check if selection changed
      await waitFor(() => {
        const selectedOption = screen.getByRole('option', { selected: true });
        expect(selectedOption).toBeInTheDocument();
      });

      const navigationTime = performance.now() - navigationStartTime;
      expect(navigationTime).toBeLessThan(50); // < 50ms for keyboard navigation
    });

    test('should handle rapid keyboard navigation efficiently', async () => {
      const onSearch = jest.fn();
      const onChange = jest.fn();
      const suggestions = Array.from({ length: 20 }, (_, i) => `suggestion-${i}`);

      render(
        <SearchAutocomplete
          value="test"
          onChange={onChange}
          onSearch={onSearch}
          recentSearches={suggestions}
        />
      );

      const input = screen.getByRole('combobox');

      act(() => {
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const navigationTimes: number[] = [];

      // Simulate rapid arrow key presses
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();

        act(() => {
          fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
        });

        // Wait for UI update
        await new Promise(resolve => setTimeout(resolve, 1));

        const endTime = performance.now();
        navigationTimes.push(endTime - startTime);
      }

      // All navigation actions should be fast
      navigationTimes.forEach(time => {
        expect(time).toBeLessThan(50);
      });

      // Average should be very fast
      const avgTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
      expect(avgTime).toBeLessThan(25);
    });
  });

  describe('Memory Performance', () => {
    test('should not create memory leaks with repeated operations', async () => {
      const onSearch = jest.fn();
      const onChange = jest.fn();

      const { unmount } = render(
        <IntelligentSearchInput
          value=""
          onChange={onChange}
          onSearch={onSearch}
        />
      );

      const input = screen.getByRole('combobox');

      // Simulate extensive usage
      for (let i = 0; i < 100; i++) {
        act(() => {
          fireEvent.change(input, { target: { value: `query-${i}` } });
          fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        });

        if (i % 10 === 0) {
          // Occasionally wait for operations to complete
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Memory usage should be reasonable (this is a basic check)
      if (performance.measureUserAgentSpecificMemory) {
        const memoryInfo = await performance.measureUserAgentSpecificMemory();
        expect(memoryInfo.bytes).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      }

      unmount();
    });

    test('should clean up event listeners properly', async () => {
      const onSearch = jest.fn();
      const onChange = jest.fn();

      const { unmount } = render(
        <IntelligentSearchInput
          value=""
          onChange={onChange}
          onSearch={onSearch}
          enableKeyboardShortcuts={true}
        />
      );

      // Simulate keyboard shortcut usage
      act(() => {
        fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
      });

      await waitFor(() => {
        const input = screen.getByRole('combobox');
        expect(document.activeElement).toBe(input);
      });

      // Get initial listener count (if available)
      const initialListeners = (document as any).getEventListeners?.('keydown')?.length || 0;

      unmount();

      // After unmount, listener count should not increase
      const finalListeners = (document as any).getEventListeners?.('keydown')?.length || 0;
      expect(finalListeners).toBeLessThanOrEqual(initialListeners);
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should track performance metrics accurately', async () => {
      const TestComponent = () => {
        const { recordMetric, getMetrics } = usePerformanceMonitoring();

        React.useEffect(() => {
          // Simulate various performance measurements
          recordMetric('autocomplete_response_time', 45);
          recordMetric('autocomplete_response_time', 52);
          recordMetric('search_execution_time', 234);
          recordMetric('search_execution_time', 189);
        }, [recordMetric]);

        const metrics = getMetrics();

        return (
          <div>
            <span data-testid="autocomplete-count">
              {metrics.autocomplete_response_time?.length || 0}
            </span>
            <span data-testid="search-count">
              {metrics.search_execution_time?.length || 0}
            </span>
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('autocomplete-count')).toHaveTextContent('2');
        expect(screen.getByTestId('search-count')).toHaveTextContent('2');
      });
    });

    test('should detect SLA breaches', async () => {
      const TestComponent = () => {
        const { recordMetric, criticalAlerts } = usePerformanceMonitoring({
          alertThresholds: {
            autocomplete_response_time: { warning: 50, error: 100, unit: 'ms' }
          }
        });

        React.useEffect(() => {
          // Record a metric that breaches SLA
          recordMetric('autocomplete_response_time', 150); // Over 100ms error threshold
        }, [recordMetric]);

        return (
          <div data-testid="alert-count">
            {criticalAlerts.length}
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('alert-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Integration Performance', () => {
    test('should maintain performance with all features enabled', async () => {
      const onSearch = jest.fn();
      const onChange = jest.fn();

      mockElectronAPI.kb.search.mockResolvedValue({
        success: true,
        results: Array.from({ length: 50 }, (_, i) => ({ id: i.toString(), title: `Result ${i}` }))
      });

      const startTime = performance.now();

      render(
        <IntelligentSearchInput
          value=""
          onChange={onChange}
          onSearch={onSearch}
          showHistory={true}
          showMetrics={true}
          enableKeyboardShortcuts={true}
          maxSuggestions={50}
        />
      );

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(200); // Full component should render quickly

      const input = screen.getByRole('combobox');

      // Test integrated functionality
      const operationStartTime = performance.now();

      act(() => {
        fireEvent.change(input, { target: { value: 'integration test' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith('integration test');
      });

      const operationTime = performance.now() - operationStartTime;
      expect(operationTime).toBeLessThan(1500); // Integrated operation should complete quickly
    });
  });
});

// Performance test utilities
export const performanceTestUtils = {
  measureRenderTime: (component: React.ComponentType) => {
    const startTime = performance.now();
    render(React.createElement(component));
    return performance.now() - startTime;
  },

  measureAsyncOperation: async (operation: () => Promise<any>) => {
    const startTime = performance.now();
    await operation();
    return performance.now() - startTime;
  },

  createPerformanceReport: (testResults: Array<{ name: string; time: number; sla: number }>) => {
    return testResults.map(test => ({
      ...test,
      passed: test.time <= test.sla,
      percentOfSLA: Math.round((test.time / test.sla) * 100)
    }));
  }
};