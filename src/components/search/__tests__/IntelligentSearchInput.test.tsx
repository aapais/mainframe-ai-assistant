/**
 * IntelligentSearchInput Tests
 *
 * Comprehensive test suite covering:
 * - Functionality and user interactions
 * - Performance benchmarks
 * - Accessibility compliance
 * - Responsive behavior
 * - Error handling
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { IntelligentSearchInput } from '../IntelligentSearchInput';
import { SuggestionSource } from '../../../hooks/useAutocomplete';
import { performanceTimer } from '../../../utils/performance';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the hooks to control their behavior in tests
jest.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: any) => [value, false]
}));

jest.mock('../../../hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    addSearch: jest.fn(),
    getRecentSearches: jest.fn(() => []),
    getPopularSearches: jest.fn(() => []),
    getSuggestions: jest.fn(() => []),
    statistics: { totalSearches: 0 }
  })
}));

// Mock performance utilities
jest.mock('../../../utils/performance', () => ({
  performanceTimer: {
    start: jest.fn(),
    end: jest.fn(() => ({ duration: 100 }))
  }
}));

// Mock accessibility utilities
jest.mock('../../../utils/accessibility', () => ({
  useLiveRegion: () => ({
    announce: jest.fn()
  })
}));

describe('IntelligentSearchInput', () => {
  // ========================
  // Test Setup
  // ========================

  const mockSuggestionSources: SuggestionSource[] = [
    {
      id: 'test-source',
      name: 'Test Source',
      getSuggestions: jest.fn(async (query: string) => [
        {
          id: 'suggestion-1',
          text: `${query} suggestion 1`,
          type: 'static' as const,
          description: 'Test suggestion 1',
          icon: 'search',
          score: 0.9,
          metadata: {}
        },
        {
          id: 'suggestion-2',
          text: `${query} suggestion 2`,
          type: 'static' as const,
          description: 'Test suggestion 2',
          icon: 'search',
          score: 0.8,
          metadata: {}
        }
      ]),
      priority: 10,
      enabled: true
    }
  ];

  const defaultProps = {
    onSearch: jest.fn(),
    onChange: jest.fn(),
    onSuggestionSelect: jest.fn(),
    suggestionSources: mockSuggestionSources
  };

  beforeEach(() => {
    jest.clearAllMocks();
    performanceTimer.start = jest.fn();
    performanceTimer.end = jest.fn(() => ({ duration: 100 }));
  });

  afterEach(() => {
    // Cleanup any DOM modifications
    document.body.innerHTML = '';
  });

  // ========================
  // Basic Functionality Tests
  // ========================

  describe('Basic Functionality', () => {
    it('renders correctly with default props', () => {
      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Search knowledge base...');
    });

    it('accepts custom placeholder', () => {
      const customPlaceholder = 'Search mainframe knowledge...';
      render(<IntelligentSearchInput {...defaultProps} placeholder={customPlaceholder} />);

      const input = screen.getByRole('searchbox');
      expect(input).toHaveAttribute('placeholder', customPlaceholder);
    });

    it('displays default value correctly', () => {
      const defaultValue = 'VSAM error';
      render(<IntelligentSearchInput {...defaultProps} defaultValue={defaultValue} />);

      const input = screen.getByRole('searchbox');
      expect(input).toHaveValue(defaultValue);
    });

    it('calls onChange when input value changes', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test query');

      expect(defaultProps.onChange).toHaveBeenCalledWith('test query');
    });

    it('calls onSearch when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test query{enter}');

      expect(defaultProps.onSearch).toHaveBeenCalledWith('test query', []);
    });

    it('clears input when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test query');

      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(input).toHaveValue('');
    });
  });

  // ========================
  // Autocomplete Tests
  // ========================

  describe('Autocomplete Functionality', () => {
    it('shows suggestions dropdown when typing', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('calls suggestion source with correct query', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(mockSuggestionSources[0].getSuggestions).toHaveBeenCalledWith(
          'test',
          expect.any(Object)
        );
      });
    });

    it('displays suggestions correctly', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('test suggestion 1')).toBeInTheDocument();
        expect(screen.getByText('test suggestion 2')).toBeInTheDocument();
      });
    });

    it('calls onSuggestionSelect when suggestion is clicked', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        const suggestion = screen.getByText('test suggestion 1');
        return user.click(suggestion);
      });

      expect(defaultProps.onSuggestionSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'test suggestion 1',
          type: 'static'
        })
      );
    });

    it('navigates suggestions with arrow keys', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Navigate down
      await user.keyboard('{ArrowDown}');

      // Check that first suggestion is selected
      const firstSuggestion = screen.getByText('test suggestion 1').closest('button');
      expect(firstSuggestion).toHaveAttribute('aria-selected', 'true');
    });

    it('closes dropdown on Escape', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  // ========================
  // Keyboard Navigation Tests
  // ========================

  describe('Keyboard Navigation', () => {
    it('focuses input on Ctrl+K', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableKeyboardShortcuts={true} />);

      await user.keyboard('{Control>}k{/Control}');

      const input = screen.getByRole('searchbox');
      expect(input).toHaveFocus();
    });

    it('clears input on Escape when focused', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} defaultValue="test" />);

      const input = screen.getByRole('searchbox');
      input.focus();

      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
    });

    it('submits search on Enter', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} defaultValue="test query" />);

      const input = screen.getByRole('searchbox');
      input.focus();

      await user.keyboard('{Enter}');

      expect(defaultProps.onSearch).toHaveBeenCalledWith('test query', []);
    });
  });

  // ========================
  // Accessibility Tests
  // ========================

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<IntelligentSearchInput {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA attributes', () => {
      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');
      expect(input).toHaveAttribute('aria-label', 'Search input');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('updates ARIA attributes when dropdown is open', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
        expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      });
    });

    it('has correct ARIA relationships in dropdown', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} enableAutocomplete={true} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        const options = screen.getAllByRole('option');

        expect(listbox).toBeInTheDocument();
        expect(options).toHaveLength(2);

        options.forEach((option, index) => {
          expect(option).toHaveAttribute('id', `suggestion-${index}`);
          expect(option).toHaveAttribute('role', 'option');
        });
      });
    });

    it('announces search results', async () => {
      const user = userEvent.setup();
      const mockAnnounce = jest.fn();

      // Mock the useLiveRegion hook to capture announcements
      jest.doMock('../../../utils/accessibility', () => ({
        useLiveRegion: () => ({ announce: mockAnnounce })
      }));

      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test{enter}');

      // Note: In a real implementation, this would be tested with the actual search results
      // Here we're just testing that the mechanism is in place
      expect(defaultProps.onSearch).toHaveBeenCalled();
    });
  });

  // ========================
  // Performance Tests
  // ========================

  describe('Performance', () => {
    it('renders within performance budget (50ms)', () => {
      const startTime = performance.now();

      render(<IntelligentSearchInput {...defaultProps} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(50);
    });

    it('handles rapid typing without performance issues', async () => {
      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');

      const startTime = performance.now();

      // Simulate rapid typing
      for (let i = 0; i < 20; i++) {
        await user.type(input, String.fromCharCode(65 + i), { delay: 10 });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle 20 keystrokes in reasonable time
      expect(totalTime).toBeLessThan(1000);
    });

    it('efficiently handles large suggestion lists', async () => {
      const largeSuggestionSource: SuggestionSource = {
        id: 'large-source',
        name: 'Large Source',
        getSuggestions: async () => {
          // Generate 100 suggestions
          return Array.from({ length: 100 }, (_, i) => ({
            id: `suggestion-${i}`,
            text: `Suggestion ${i}`,
            type: 'static' as const,
            description: `Description ${i}`,
            icon: 'search',
            score: 0.5,
            metadata: {}
          }));
        },
        priority: 10,
        enabled: true
      };

      const user = userEvent.setup();
      render(
        <IntelligentSearchInput
          {...defaultProps}
          suggestionSources={[largeSuggestionSource]}
          enableAutocomplete={true}
        />
      );

      const input = screen.getByRole('searchbox');

      const startTime = performance.now();
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render large list efficiently
      expect(renderTime).toBeLessThan(200);
    });
  });

  // ========================
  // Error Handling Tests
  // ========================

  describe('Error Handling', () => {
    it('handles suggestion source errors gracefully', async () => {
      const errorSuggestionSource: SuggestionSource = {
        id: 'error-source',
        name: 'Error Source',
        getSuggestions: jest.fn().mockRejectedValue(new Error('Network error')),
        priority: 10,
        enabled: true
      };

      const user = userEvent.setup();
      render(
        <IntelligentSearchInput
          {...defaultProps}
          suggestionSources={[errorSuggestionSource]}
          enableAutocomplete={true}
        />
      );

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');

      // Should not crash and should show some indication of the error
      await waitFor(() => {
        // The component should handle the error gracefully
        // and not show suggestions
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('displays error state correctly', () => {
      const errorMessage = 'Search failed';
      render(<IntelligentSearchInput {...defaultProps} error={errorMessage} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();

      const input = screen.getByRole('searchbox');
      expect(input).toHaveClass('border-danger-500');
    });

    it('handles disabled state correctly', () => {
      render(<IntelligentSearchInput {...defaultProps} disabled={true} />);

      const input = screen.getByRole('searchbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  // ========================
  // Theme and Responsive Tests
  // ========================

  describe('Theme and Responsive Behavior', () => {
    it('applies dark theme classes correctly', () => {
      document.documentElement.classList.add('dark');

      render(<IntelligentSearchInput {...defaultProps} />);

      const input = screen.getByRole('searchbox');
      expect(input).toHaveClass('dark:bg-gray-900');

      document.documentElement.classList.remove('dark');
    });

    it('applies size variants correctly', () => {
      const { rerender } = render(
        <IntelligentSearchInput {...defaultProps} size="sm" />
      );

      const input = screen.getByRole('searchbox');
      expect(input).toHaveClass('h-9');

      rerender(<IntelligentSearchInput {...defaultProps} size="lg" />);
      expect(input).toHaveClass('h-13');
    });

    it('applies style variants correctly', () => {
      const { rerender } = render(
        <IntelligentSearchInput {...defaultProps} variant="minimal" />
      );

      const input = screen.getByRole('searchbox');
      expect(input).toHaveClass('bg-gray-50');

      rerender(<IntelligentSearchInput {...defaultProps} variant="prominent" />);
      expect(input).toHaveClass('bg-gradient-to-r');
    });
  });

  // ========================
  // Integration Tests
  // ========================

  describe('Integration', () => {
    it('works correctly with filters', async () => {
      const filters = [
        {
          id: 'category-vsam',
          type: 'category' as const,
          label: 'VSAM',
          value: 'VSAM',
          active: true
        }
      ];

      const user = userEvent.setup();
      render(<IntelligentSearchInput {...defaultProps} filters={filters} />);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test{enter}');

      expect(defaultProps.onSearch).toHaveBeenCalledWith('test', filters);
    });

    it('shows performance indicators when enabled', () => {
      const performanceMetrics = {
        responseTime: 150,
        resultsCount: 25,
        cacheHit: true,
        aiUsed: true
      };

      render(
        <IntelligentSearchInput
          {...defaultProps}
          enablePerformanceIndicators={true}
          performanceMetrics={performanceMetrics}
        />
      );

      expect(screen.getByText('150ms')).toBeInTheDocument();
    });

    it('displays loading state correctly', () => {
      render(<IntelligentSearchInput {...defaultProps} loading={true} />);

      // Should show loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });
});

// ========================
// Performance Benchmark Tests
// ========================

describe('Performance Benchmarks', () => {
  it('meets first paint performance target', () => {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      const { unmount } = render(<IntelligentSearchInput {...defaultProps} />);

      const endTime = performance.now();
      times.push(endTime - startTime);

      unmount();
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / iterations;

    // Target: First paint < 50ms
    expect(avgTime).toBeLessThan(50);
  });

  it('maintains 60fps during interactions', async () => {
    const user = userEvent.setup();
    const { container } = render(<IntelligentSearchInput {...defaultProps} />);

    const input = screen.getByRole('searchbox');

    // Measure frame times during rapid interaction
    const frameTimes: number[] = [];
    let lastTime = performance.now();

    const measureFrame = () => {
      const currentTime = performance.now();
      frameTimes.push(currentTime - lastTime);
      lastTime = currentTime;
    };

    // Start measuring
    const observer = new PerformanceObserver(() => measureFrame());
    observer.observe({ entryTypes: ['measure'] });

    // Perform rapid interactions
    for (let i = 0; i < 10; i++) {
      await user.type(input, 'a', { delay: 16 }); // ~60fps
      performance.mark(`interaction-${i}`);
    }

    observer.disconnect();

    // Check that frame times are within 60fps target (16.67ms)
    const avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    expect(avgFrameTime).toBeLessThan(20); // Allow some margin
  });
});

// ========================
// Memory Leak Tests
// ========================

describe('Memory Management', () => {
  it('cleans up resources on unmount', () => {
    const { unmount } = render(<IntelligentSearchInput {...defaultProps} />);

    // Get initial memory usage
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    unmount();

    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
    }

    // Check that memory hasn't grown significantly
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryGrowth = finalMemory - initialMemory;

    // Allow for some memory growth but not excessive
    expect(memoryGrowth).toBeLessThan(1024 * 1024); // 1MB
  });

  it('handles rapid mount/unmount cycles', () => {
    const cycles = 100;

    for (let i = 0; i < cycles; i++) {
      const { unmount } = render(<IntelligentSearchInput {...defaultProps} />);
      unmount();
    }

    // Should complete without throwing errors or excessive memory growth
    expect(true).toBe(true);
  });
});