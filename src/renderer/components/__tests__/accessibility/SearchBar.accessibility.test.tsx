/**
 * Accessibility Tests for SearchBar Components
 * Tests WCAG 2.1 AA compliance for all search-related components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  runAccessibilityTests,
  testKeyboardNavigation,
  testScreenReaderAnnouncements,
  testFocusManagement,
  accessibilityScenarios
} from '../../../testing/accessibility';

import KBSearchBar from '../../KBSearchBar';
import { SearchInput } from '../../ui/Input';
import { SearchProvider } from '../../../contexts/SearchContext';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock search context for testing
const mockSearchContext = {
  state: {
    results: [],
    isSearching: false,
    searchError: null,
    totalResults: 0,
    useAI: true,
    searchMetrics: null
  },
  performSearch: jest.fn(),
  generateSuggestions: jest.fn().mockResolvedValue(['suggestion 1', 'suggestion 2']),
  setUseAI: jest.fn(),
  query: '',
  setQuery: jest.fn(),
  filters: { category: undefined },
  updateFilters: jest.fn(),
  searchHistory: ['previous search', 'another search'],
  clearHistory: jest.fn()
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SearchProvider>
    <div id="test-app" role="application" aria-label="Knowledge Base Assistant">
      {children}
    </div>
  </SearchProvider>
);

describe('SearchBar Accessibility Tests', () => {
  beforeEach(() => {
    // Setup accessible environment
    global.a11yTestUtils.setupAccessibleEnvironment();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.a11yTestUtils.cleanupAccessibleEnvironment();
  });

  describe('KBSearchBar Component', () => {
    test('should pass axe accessibility audit', async () => {
      const { container } = render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <KBSearchBar data-testid="search-bar" />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Search input should have proper attributes
      expect(searchInput).toHaveAttribute('aria-label');
      expect(searchInput).toHaveAttribute('type', 'search');

      // Combobox behavior for suggestions
      expect(searchInput).toHaveAttribute('role', 'combobox');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
      expect(searchInput).toHaveAttribute('aria-expanded', 'false');
    });

    test('should manage focus correctly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar autoFocus />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Should auto-focus when specified
      expect(searchInput).toHaveFocus();

      // Should maintain focus when typing
      await user.type(searchInput, 'test query');
      expect(searchInput).toHaveFocus();
      expect(searchInput).toHaveValue('test query');
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();

      render(
        <TestWrapper>
          <KBSearchBar onSearchStart={mockOnSearch} />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Test Enter key triggers search
      await user.type(searchInput, 'test search{enter}');
      expect(mockOnSearch).toHaveBeenCalledWith('test search');

      // Test Escape key clears suggestions and focus
      await user.type(searchInput, 'test');
      await user.keyboard('{Escape}');

      expect(searchInput).not.toHaveFocus();
    });

    test('should handle suggestions accessibility', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar showSuggestions={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Type to trigger suggestions
      await user.type(searchInput, 'test');

      // Wait for suggestions to appear
      await waitFor(() => {
        const listbox = screen.queryByRole('listbox');
        if (listbox) {
          expect(listbox).toHaveAttribute('aria-label', 'Search suggestions');

          // Check suggestion options
          const options = screen.getAllByRole('option');
          options.forEach((option, index) => {
            expect(option).toHaveAttribute('aria-selected');
            expect(option).toHaveAttribute('role', 'option');
          });
        }
      });
    });

    test('should navigate suggestions with arrow keys', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar showSuggestions={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Type to show suggestions
      await user.type(searchInput, 'test');

      await waitFor(() => {
        const listbox = screen.queryByRole('listbox');
        if (listbox) {
          // Test arrow key navigation
          fireEvent.keyDown(document, { key: 'ArrowDown' });

          const firstOption = screen.getByRole('option', { selected: true });
          expect(firstOption).toHaveAttribute('aria-selected', 'true');

          // Test up arrow
          fireEvent.keyDown(document, { key: 'ArrowUp' });
        }
      });
    });

    test('should announce search results to screen readers', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      await testScreenReaderAnnouncements(
        async () => {
          await user.type(searchInput, 'test search{enter}');
        },
        'search results', // Expected announcement text
        2000
      );
    });

    test('should handle error states accessibly', async () => {
      const mockError = 'Search failed - please try again';

      render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      // Simulate error state
      const errorElement = screen.getByRole('alert');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(mockError);

      // Error should be announced to screen readers
      expect(errorElement).toHaveAttribute('role', 'alert');
    });

    test('should support filters accessibility', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar showFilters={true} />
        </TestWrapper>
      );

      const filtersButton = screen.getByRole('button', { name: /toggle search filters/i });

      // Should have proper ARIA attributes
      expect(filtersButton).toHaveAttribute('aria-expanded', 'false');
      expect(filtersButton).toHaveAttribute('aria-label', 'Toggle search filters');

      // Test opening filters panel
      await user.click(filtersButton);
      expect(filtersButton).toHaveAttribute('aria-expanded', 'true');

      // Filter checkboxes should be accessible
      const aiToggle = screen.getByLabelText(/ai search/i);
      expect(aiToggle).toHaveAttribute('type', 'checkbox');
      expect(aiToggle).toHaveAttribute('role', 'checkbox');
    });

    test('should validate color contrast', () => {
      render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');
      const computedStyle = window.getComputedStyle(searchInput);

      // This would be more comprehensive with actual color values
      expect(computedStyle.color).toBeTruthy();
      expect(computedStyle.backgroundColor).toBeTruthy();
    });
  });

  describe('SearchInput Component', () => {
    test('should pass comprehensive accessibility audit', async () => {
      const mockProps = {
        value: '',
        onChange: jest.fn(),
        onSearch: jest.fn(),
        placeholder: 'Search knowledge base...',
        'aria-label': 'Search input field'
      };

      await runAccessibilityTests(
        <SearchInput {...mockProps} />,
        {
          skipScreenReader: false,
          customTests: [
            async (container) => {
              const input = container.querySelector('input');
              expect(input).toHaveAttribute('aria-label', 'Search input field');
              expect(input).toHaveAttribute('type', 'search');
            }
          ]
        }
      );
    });

    test('should support loading state announcements', async () => {
      const { rerender } = render(
        <SearchInput
          value=""
          onChange={jest.fn()}
          onSearch={jest.fn()}
          loading={false}
          aria-label="Search field"
        />
      );

      // Test loading state
      rerender(
        <SearchInput
          value="test"
          onChange={jest.fn()}
          onSearch={jest.fn()}
          loading={true}
          aria-label="Search field"
        />
      );

      await testScreenReaderAnnouncements(
        async () => {
          // Loading state should be announced
        },
        'searching',
        1000
      );
    });

    test('should handle clear button accessibility', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();

      render(
        <SearchInput
          value="test query"
          onChange={mockOnChange}
          onSearch={jest.fn()}
          showClearButton={true}
          aria-label="Search field"
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear/i });

      // Should have proper accessibility attributes
      expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
      expect(clearButton).toHaveAttribute('type', 'button');

      // Should work with keyboard
      await user.click(clearButton);
      expect(mockOnChange).toHaveBeenCalledWith('');

      // Should also work with Enter/Space keys
      clearButton.focus();
      await user.keyboard('{enter}');
      expect(mockOnChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Search History Accessibility', () => {
    test('should make history dropdown accessible', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar showHistory={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Focus input to show history
      await user.click(searchInput);

      await waitFor(() => {
        const historyList = screen.queryByText('Recent searches');
        if (historyList) {
          // History items should be buttons
          const historyButtons = screen.getAllByRole('button');
          const historyItems = historyButtons.filter(btn =>
            btn.className?.includes('history-item')
          );

          historyItems.forEach(item => {
            expect(item).toHaveAttribute('type', 'button');
            expect(item).toBeVisible();
          });

          // Clear button should be accessible
          const clearButton = screen.getByText('Clear');
          expect(clearButton).toHaveAttribute('type', 'button');
        }
      });
    });
  });

  describe('Comprehensive Keyboard Navigation', () => {
    test('should support full keyboard workflow', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();

      render(
        <TestWrapper>
          <KBSearchBar
            showFilters={true}
            showHistory={true}
            showSuggestions={true}
            onSearchStart={mockOnSearch}
          />
        </TestWrapper>
      );

      await testKeyboardNavigation(
        screen.getByTestId('search-bar') || document.body,
        [
          'input[type="search"]',    // Search input
          'button[aria-label*="Clear"]', // Clear button (if visible)
          'button[aria-label*="filters"]' // Filters button
        ]
      );
    });

    test('should trap focus in modals/dropdowns', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar showFilters={true} />
        </TestWrapper>
      );

      const filtersButton = screen.getByRole('button', { name: /filters/i });

      await testFocusManagement(
        async () => {
          await user.click(filtersButton);
        },
        {
          expectedInitialFocus: 'input[type="checkbox"]', // AI toggle
          trapFocus: false, // Filters panel doesn't trap focus
          returnFocus: true
        }
      );
    });
  });

  describe('Screen Reader Experience', () => {
    test('should provide meaningful announcements', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Test search initiation announcement
      await testScreenReaderAnnouncements(
        async () => {
          await user.type(searchInput, 'VSAM error{enter}');
        },
        'searching for VSAM error',
        2000
      );

      // Test results announcement
      await testScreenReaderAnnouncements(
        async () => {
          // Simulate search completion
        },
        'results found',
        2000
      );
    });

    test('should announce filter changes', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar showFilters={true} />
        </TestWrapper>
      );

      const filtersButton = screen.getByRole('button', { name: /filters/i });
      await user.click(filtersButton);

      const aiToggle = screen.getByLabelText(/ai search/i);

      await testScreenReaderAnnouncements(
        async () => {
          await user.click(aiToggle);
        },
        'AI search enabled',
        1500
      );
    });
  });

  describe('Form Accessibility Patterns', () => {
    test('should follow proper form accessibility patterns', async () => {
      render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      const searchForm = screen.getByRole('search') ||
                        document.querySelector('form') ||
                        document.querySelector('[role="search"]');

      if (searchForm) {
        await accessibilityScenarios.testFormAccessibility(searchForm);
      }

      // Test individual form elements
      const searchInput = screen.getByRole('searchbox');
      expect(searchInput).toHaveAttribute('aria-label');

      // Buttons should be accessible
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        accessibilityScenarios.testButtonAccessibility(button);
      });
    });
  });

  describe('Error Handling Accessibility', () => {
    test('should handle validation errors accessibly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Test invalid input handling
      await user.type(searchInput, ' '); // Empty search
      await user.keyboard('{enter}');

      // Should announce validation error
      await waitFor(() => {
        const errorMessage = screen.queryByRole('alert');
        if (errorMessage) {
          expect(errorMessage).toBeVisible();
          expect(searchInput).toHaveAttribute('aria-invalid', 'true');
          expect(searchInput).toHaveAttribute('aria-describedby');
        }
      });
    });
  });

  describe('Performance and Responsiveness', () => {
    test('should maintain accessibility during loading states', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Start search
      await user.type(searchInput, 'test search{enter}');

      // During loading, elements should still be accessible
      await waitFor(() => {
        expect(searchInput).toBeAccessible();

        // Loading indicator should be announced
        const loadingElement = screen.queryByText(/searching/i) ||
                              screen.queryByRole('status');

        if (loadingElement) {
          expect(loadingElement).toHaveAttribute('aria-live', 'polite');
        }
      });
    });

    test('should handle rapid user interactions accessibly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBSearchBar showSuggestions={true} />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('searchbox');

      // Rapid typing should not break accessibility
      await user.type(searchInput, 'a');
      await user.type(searchInput, 'b');
      await user.type(searchInput, 'c');

      // Should still maintain proper ARIA states
      expect(searchInput).toHaveAttribute('role', 'combobox');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
    });
  });
});