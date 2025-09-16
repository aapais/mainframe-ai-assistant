/**
 * Comprehensive Interaction Tests
 *
 * Tests for keyboard navigation, touch gestures, accessibility compliance,
 * and performance optimization across all search result interactions
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { VirtualizedResults } from '../../../src/components/search/VirtualizedResults';
import { useKeyboardNavigation } from '../../../src/hooks/useKeyboardNavigation';
import { useTouchGestures } from '../../../src/hooks/useTouchGestures';
import { SearchResult } from '../../../src/types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock implementations
jest.mock('../../../src/utils/analytics', () => ({
  trackInteraction: jest.fn(),
  trackKeyboardNavigation: jest.fn(),
  trackTouchGesture: jest.fn(),
  trackAccessibility: jest.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Sample test data
const mockResults: SearchResult[] = [
  {
    entry: {
      id: '1',
      title: 'COBOL Array Processing Error',
      problem: 'Getting S0C4 error when processing arrays in COBOL program',
      solution: 'Check array bounds and initialize OCCURS clauses properly',
      category: 'COBOL',
      tags: ['S0C4', 'Array', 'OCCURS'],
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      usage_count: 15,
      success_count: 12,
      failure_count: 3
    },
    score: 0.95,
    matchType: 'exact'
  },
  {
    entry: {
      id: '2',
      title: 'JCL SORT Utility Issues',
      problem: 'SORT step failing with RC=16',
      solution: 'Verify SORTIN and SORTOUT datasets are properly allocated',
      category: 'JCL',
      tags: ['SORT', 'RC16', 'Dataset'],
      created_at: '2023-01-02',
      updated_at: '2023-01-02',
      usage_count: 8,
      success_count: 6,
      failure_count: 2
    },
    score: 0.87,
    matchType: 'fuzzy'
  },
  {
    entry: {
      id: '3',
      title: 'DB2 SQL Performance Tuning',
      problem: 'Slow SELECT statements on large tables',
      solution: 'Add appropriate indexes and use OPTIMIZE FOR clause',
      category: 'DB2',
      tags: ['Performance', 'SQL', 'Index'],
      created_at: '2023-01-03',
      updated_at: '2023-01-03',
      usage_count: 22,
      success_count: 18,
      failure_count: 4
    },
    score: 0.76,
    matchType: 'semantic'
  }
];

describe('Keyboard Navigation Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  test('should navigate through results with arrow keys', async () => {
    const mockOnSelectionChange = jest.fn();
    const mockOnResultSelect = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onSelectionChange={mockOnSelectionChange}
        onResultSelect={mockOnResultSelect}
        enableAdvancedKeyboardShortcuts={true}
      />
    );

    const container = screen.getByRole('listbox');

    // Focus the container
    container.focus();

    // Navigate down
    await user.keyboard('{ArrowDown}');
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[0].entry.id, 0);

    // Navigate down again
    await user.keyboard('{ArrowDown}');
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[1].entry.id, 1);

    // Navigate up
    await user.keyboard('{ArrowUp}');
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[0].entry.id, 0);
  });

  test('should handle keyboard shortcuts', async () => {
    const mockOnResultSelect = jest.fn();
    const mockOnResultRate = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onResultSelect={mockOnResultSelect}
        onResultRate={mockOnResultRate}
        enableAdvancedKeyboardShortcuts={true}
      />
    );

    const container = screen.getByRole('listbox');
    container.focus();

    // Navigate to first item
    await user.keyboard('{ArrowDown}');

    // Press Enter to select
    await user.keyboard('{Enter}');
    expect(mockOnResultSelect).toHaveBeenCalledWith(mockResults[0], 0);

    // Test Ctrl+H for helpful
    await user.keyboard('{Control>}h{/Control}');
    expect(mockOnResultRate).toHaveBeenCalledWith(mockResults[0].entry.id, true);

    // Test Ctrl+N for not helpful
    await user.keyboard('{Control>}n{/Control}');
    expect(mockOnResultRate).toHaveBeenCalledWith(mockResults[0].entry.id, false);
  });

  test('should support vim-style navigation', async () => {
    const mockOnSelectionChange = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onSelectionChange={mockOnSelectionChange}
        enableAdvancedKeyboardShortcuts={true}
      />
    );

    const container = screen.getByRole('listbox');
    container.focus();

    // Test 'j' for down
    await user.keyboard('j');
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[0].entry.id, 0);

    // Test 'k' for up
    await user.keyboard('k');
    // Should stay at first item since we can't go up from index 0
  });

  test('should handle page navigation', async () => {
    const mockOnSelectionChange = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const container = screen.getByRole('listbox');
    container.focus();

    // Test PageDown
    await user.keyboard('{PageDown}');
    // Should jump to last item since we have fewer items than jump size
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[mockResults.length - 1].entry.id, mockResults.length - 1);

    // Test Home
    await user.keyboard('{Home}');
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[0].entry.id, 0);

    // Test End
    await user.keyboard('{End}');
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[mockResults.length - 1].entry.id, mockResults.length - 1);
  });

  test('should support type-ahead search', async () => {
    const mockOnSelectionChange = jest.fn();

    // Create results with more distinctive titles for type-ahead
    const typeAheadResults = [
      { ...mockResults[0], entry: { ...mockResults[0].entry, title: 'Apple Processing' } },
      { ...mockResults[1], entry: { ...mockResults[1].entry, title: 'Banana Sorting' } },
      { ...mockResults[2], entry: { ...mockResults[2].entry, title: 'Cherry Database' } }
    ];

    render(
      <VirtualizedResults
        results={typeAheadResults}
        query="test"
        onSelectionChange={mockOnSelectionChange}
        enableAdvancedKeyboardShortcuts={true}
      />
    );

    const container = screen.getByRole('listbox');
    container.focus();

    // Type 'b' to find "Banana Sorting"
    await user.keyboard('b');
    await waitFor(() => {
      expect(mockOnSelectionChange).toHaveBeenCalledWith(typeAheadResults[1].entry.id, 1);
    });

    // Type 'c' after delay to find "Cherry Database"
    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for type-ahead to reset
    await user.keyboard('c');
    await waitFor(() => {
      expect(mockOnSelectionChange).toHaveBeenCalledWith(typeAheadResults[2].entry.id, 2);
    });
  });
});

describe('Touch Gesture Tests', () => {
  // Mock touch events
  const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
    return new TouchEvent(type, {
      touches: touches.map(touch => ({
        ...touch,
        identifier: 0,
        target: document.body,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: 1
      })) as any
    });
  };

  test('should handle swipe gestures', async () => {
    const mockOnResultRate = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onResultRate={mockOnResultRate}
        enableTouchGestures={true}
      />
    );

    const resultItem = screen.getByText('COBOL Array Processing Error').closest('[data-result-id]');
    expect(resultItem).toBeInTheDocument();

    // Simulate swipe right (helpful)
    fireEvent(resultItem!, createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    fireEvent(resultItem!, createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]));
    fireEvent(resultItem!, createTouchEvent('touchend', []));

    await waitFor(() => {
      expect(mockOnResultRate).toHaveBeenCalledWith('1', true);
    });

    // Simulate swipe left (not helpful)
    fireEvent(resultItem!, createTouchEvent('touchstart', [{ clientX: 200, clientY: 100 }]));
    fireEvent(resultItem!, createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]));
    fireEvent(resultItem!, createTouchEvent('touchend', []));

    await waitFor(() => {
      expect(mockOnResultRate).toHaveBeenCalledWith('1', false);
    });
  });

  test('should handle tap gestures', async () => {
    const mockOnResultSelect = jest.fn();
    const mockOnSelectionChange = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onResultSelect={mockOnResultSelect}
        onSelectionChange={mockOnSelectionChange}
        enableTouchGestures={true}
      />
    );

    const resultItem = screen.getByText('COBOL Array Processing Error').closest('[data-result-id]');
    expect(resultItem).toBeInTheDocument();

    // Simulate tap
    fireEvent(resultItem!, createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    fireEvent(resultItem!, createTouchEvent('touchend', []));

    await waitFor(() => {
      expect(mockOnSelectionChange).toHaveBeenCalledWith('1', 0);
      expect(mockOnResultSelect).toHaveBeenCalledWith(mockResults[0], 0);
    });
  });

  test('should handle long press gestures', async () => {
    const mockOnAnnouncement = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onAnnouncement={mockOnAnnouncement}
        enableTouchGestures={true}
      />
    );

    const resultItem = screen.getByText('COBOL Array Processing Error').closest('[data-result-id]');
    expect(resultItem).toBeInTheDocument();

    // Simulate long press
    fireEvent(resultItem!, createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));

    // Wait for long press duration
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
    });

    expect(mockOnAnnouncement).toHaveBeenCalledWith(
      expect.stringContaining('Long press on COBOL Array Processing Error'),
      'assertive'
    );
  });

  test('should handle pinch-to-zoom gestures', async () => {
    const mockOnPinch = jest.fn();

    // Create a component that uses the touch gesture hook
    const TestComponent = () => {
      const { touchProps } = useTouchGestures({
        enablePinchZoom: true,
        onPinch: mockOnPinch
      });

      return <div {...touchProps} data-testid="pinch-container">Pinch Test</div>;
    };

    render(<TestComponent />);

    const container = screen.getByTestId('pinch-container');

    // Simulate pinch gesture (two touches)
    fireEvent(container, createTouchEvent('touchstart', [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 }
    ]));

    fireEvent(container, createTouchEvent('touchmove', [
      { clientX: 50, clientY: 100 },
      { clientX: 250, clientY: 100 }
    ]));

    await waitFor(() => {
      expect(mockOnPinch).toHaveBeenCalled();
    });
  });
});

describe('Accessibility Compliance Tests', () => {
  test('should have no accessibility violations', async () => {
    const { container } = render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        ariaLabel="Search results for test"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should have proper ARIA attributes', () => {
    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        ariaLabel="Search results for test"
      />
    );

    // Check listbox role
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', expect.stringContaining('Search results for test'));

    // Check result items have option role
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(mockResults.length);

    options.forEach((option, index) => {
      expect(option).toHaveAttribute('aria-selected', 'false');
      expect(option).toHaveAttribute('aria-label', expect.stringContaining(`Search result ${index + 1}`));
    });
  });

  test('should provide screen reader announcements', async () => {
    const mockOnAnnouncement = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onAnnouncement={mockOnAnnouncement}
      />
    );

    // Should announce results loaded
    await waitFor(() => {
      expect(mockOnAnnouncement).toHaveBeenCalledWith(
        expect.stringContaining('3 search results loaded for "test"'),
        'polite'
      );
    });
  });

  test('should support high contrast mode', () => {
    // Mock high contrast preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { container } = render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        className="high-contrast-test"
      />
    );

    expect(container.querySelector('.virtualized-results')).toBeInTheDocument();
  });

  test('should support reduced motion preference', () => {
    // Mock reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        className="reduced-motion-test"
      />
    );

    // Component should render without motion-based animations
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  test('should handle focus management correctly', async () => {
    const user = userEvent.setup();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        selectedId="1"
      />
    );

    const container = screen.getByRole('listbox');

    // Focus the container
    await user.click(container);
    expect(container).toHaveFocus();

    // Navigate and check focus
    await user.keyboard('{ArrowDown}');

    // The selected result should have focus
    const selectedResult = screen.getByLabelText(/Search result 1:/);
    expect(selectedResult).toHaveFocus();
  });
});

describe('Performance Tests', () => {
  test('should render large datasets efficiently', async () => {
    // Create a large dataset
    const largeResults = Array.from({ length: 1000 }, (_, index) => ({
      ...mockResults[0],
      entry: {
        ...mockResults[0].entry,
        id: `result-${index}`,
        title: `Result ${index}`
      }
    }));

    const startTime = performance.now();

    render(
      <VirtualizedResults
        results={largeResults}
        query="test"
        itemHeight={200}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render in under 100ms even with 1000 items
    expect(renderTime).toBeLessThan(100);

    // Should only render visible items (not all 1000)
    const renderedItems = screen.getAllByRole('option');
    expect(renderedItems.length).toBeLessThan(50); // Should be much less than 1000
  });

  test('should handle rapid navigation without performance issues', async () => {
    const user = userEvent.setup();
    const mockOnSelectionChange = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const container = screen.getByRole('listbox');
    await user.click(container);

    const startTime = performance.now();

    // Rapidly navigate through results
    for (let i = 0; i < 20; i++) {
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
    }

    const endTime = performance.now();
    const navigationTime = endTime - startTime;

    // Should handle rapid navigation smoothly
    expect(navigationTime).toBeLessThan(500);
    expect(mockOnSelectionChange).toHaveBeenCalled();
  });

  test('should debounce touch gestures appropriately', async () => {
    const mockOnResultRate = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test"
        onResultRate={mockOnResultRate}
        enableTouchGestures={true}
      />
    );

    const resultItem = screen.getByText('COBOL Array Processing Error').closest('[data-result-id]');
    expect(resultItem).toBeInTheDocument();

    // Rapid swipe gestures should be debounced
    for (let i = 0; i < 5; i++) {
      fireEvent(resultItem!, new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as any]
      }));
      fireEvent(resultItem!, new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 100 } as any]
      }));
      fireEvent(resultItem!, new TouchEvent('touchend', { touches: [] }));
    }

    await waitFor(() => {
      // Should not be called 5 times due to debouncing
      expect(mockOnResultRate).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Voice Navigation Tests', () => {
  // Mock SpeechRecognition
  const mockSpeechRecognition = {
    start: jest.fn(),
    stop: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    continuous: false,
    interimResults: false,
    lang: 'en-US',
    onresult: null,
    onerror: null,
    onstart: null,
    onend: null
  };

  beforeEach(() => {
    (global as any).SpeechRecognition = jest.fn(() => mockSpeechRecognition);
    (global as any).webkitSpeechRecognition = jest.fn(() => mockSpeechRecognition);
  });

  test('should initialize voice navigation when supported', () => {
    const { VoiceNavigation } = require('../../../src/utils/accessibility');
    const voiceNav = new VoiceNavigation();

    expect(voiceNav.isSupported).toBe(true);
    expect(voiceNav.listening).toBe(false);
  });

  test('should start and stop voice navigation', () => {
    const { VoiceNavigation } = require('../../../src/utils/accessibility');
    const voiceNav = new VoiceNavigation();

    voiceNav.start();
    expect(mockSpeechRecognition.start).toHaveBeenCalled();

    voiceNav.stop();
    expect(mockSpeechRecognition.stop).toHaveBeenCalled();
  });
});

describe('Integration Tests', () => {
  test('should work together with all features enabled', async () => {
    const user = userEvent.setup();
    const mockOnResultSelect = jest.fn();
    const mockOnResultRate = jest.fn();
    const mockOnSelectionChange = jest.fn();
    const mockOnAnnouncement = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="test search"
        onResultSelect={mockOnResultSelect}
        onResultRate={mockOnResultRate}
        onSelectionChange={mockOnSelectionChange}
        onAnnouncement={mockOnAnnouncement}
        enableTouchGestures={true}
        enableAdvancedKeyboardShortcuts={true}
        enableAnalytics={true}
        ariaLabel="Comprehensive test results"
      />
    );

    // Should announce results loaded
    await waitFor(() => {
      expect(mockOnAnnouncement).toHaveBeenCalledWith(
        expect.stringContaining('3 search results loaded'),
        'polite'
      );
    });

    const container = screen.getByRole('listbox');
    await user.click(container);

    // Keyboard navigation
    await user.keyboard('{ArrowDown}');
    expect(mockOnSelectionChange).toHaveBeenCalledWith(mockResults[0].entry.id, 0);

    // Keyboard selection
    await user.keyboard('{Enter}');
    expect(mockOnResultSelect).toHaveBeenCalledWith(mockResults[0], 0);

    // Keyboard rating
    await user.keyboard('{Control>}h{/Control}');
    expect(mockOnResultRate).toHaveBeenCalledWith(mockResults[0].entry.id, true);

    // Should have no accessibility violations
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('should gracefully handle errors and edge cases', () => {
    // Empty results
    render(
      <VirtualizedResults
        results={[]}
        query="empty search"
      />
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();

    // Error state
    render(
      <VirtualizedResults
        results={[]}
        query="error search"
        error="Search service unavailable"
      />
    );

    expect(screen.getByText('Search Error')).toBeInTheDocument();
    expect(screen.getByText('Search service unavailable')).toBeInTheDocument();

    // Loading state
    render(
      <VirtualizedResults
        results={[]}
        query="loading search"
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading search results...')).toBeInTheDocument();
  });
});

describe('Device-Specific Tests', () => {
  test('should work on mobile devices', () => {
    // Mock mobile user agent
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    });

    render(
      <VirtualizedResults
        results={mockResults}
        query="mobile test"
        enableTouchGestures={true}
      />
    );

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // Touch gestures should be enabled by default on mobile
  });

  test('should work with screen readers', async () => {
    // Mock screen reader user agent
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'NVDA'
    });

    const mockOnAnnouncement = jest.fn();

    render(
      <VirtualizedResults
        results={mockResults}
        query="screen reader test"
        onAnnouncement={mockOnAnnouncement}
      />
    );

    // Should provide announcements for screen readers
    await waitFor(() => {
      expect(mockOnAnnouncement).toHaveBeenCalled();
    });

    // Should have proper ARIA structure
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(mockResults.length);
  });
});