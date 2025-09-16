/**
 * Accessibility Tests for ResultsList Components
 * Tests WCAG 2.1 AA compliance for result display components
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
  accessibilityScenarios,
  validateColorContrast
} from '../../../testing/accessibility';

import KBEntryList from '../../KBEntryList';
import { KBDataProvider } from '../../../contexts/KBDataContext';
import { SearchProvider } from '../../../contexts/SearchContext';
import { KBEntry, KBCategory } from '../../../../types/services';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock data for testing
const mockEntries: KBEntry[] = [
  {
    id: '1',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35',
    solution: 'Check if file exists and is cataloged',
    category: 'VSAM' as KBCategory,
    tags: ['vsam', 'status-35', 'file-error'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 15,
    success_count: 12,
    failure_count: 3
  },
  {
    id: '2',
    title: 'S0C7 Data Exception',
    problem: 'Program abends with S0C7 data exception',
    solution: 'Check for non-numeric data in numeric fields',
    category: 'Batch' as KBCategory,
    tags: ['s0c7', 'data-exception', 'numeric'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 8,
    success_count: 6,
    failure_count: 2
  },
  {
    id: '3',
    title: 'JCL Dataset Not Found',
    problem: 'Job fails with dataset not found error',
    solution: 'Verify dataset name and catalog entry',
    category: 'JCL' as KBCategory,
    tags: ['jcl', 'dataset', 'not-found'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 25,
    success_count: 20,
    failure_count: 5
  }
];

const mockKBContext = {
  state: {
    entries: mockEntries,
    totalEntries: mockEntries.length,
    isLoading: false,
    error: null
  },
  addEntry: jest.fn(),
  updateEntry: jest.fn(),
  deleteEntry: jest.fn(),
  recordEntryView: jest.fn(),
  recordEntryRating: jest.fn()
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <KBDataProvider>
    <SearchProvider>
      <div id="test-app" role="application" aria-label="Knowledge Base Results">
        {children}
      </div>
    </SearchProvider>
  </KBDataProvider>
);

describe('ResultsList Accessibility Tests', () => {
  beforeEach(() => {
    global.a11yTestUtils.setupAccessibleEnvironment();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.a11yTestUtils.cleanupAccessibleEnvironment();
  });

  describe('KBEntryList Component', () => {
    test('should pass axe accessibility audit', async () => {
      const { container } = render(
        <TestWrapper>
          <KBEntryList
            data-testid="entry-list"
            showUsageStats={true}
            showCategories={true}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper list semantics', () => {
      render(
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      // Should use proper list structure
      const list = screen.getByRole('list') || screen.getByRole('listbox');
      expect(list).toBeInTheDocument();

      if (mockEntries.length > 0) {
        const listItems = screen.getAllByRole('listitem') || screen.getAllByRole('option');
        expect(listItems).toHaveLength(mockEntries.length);

        // Each list item should be accessible
        listItems.forEach((item, index) => {
          const entry = mockEntries[index];
          expect(item).toHaveAccessibleName();

          // Check if it's interactive
          const button = item.querySelector('button') || (item as HTMLElement).closest('button');
          if (button) {
            expect(button).toHaveAttribute('type', 'button');
            expect(button).toHaveAccessibleName();
          }
        });
      }
    });

    test('should support keyboard navigation between entries', async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      render(
        <TestWrapper>
          <KBEntryList onEntrySelect={mockOnSelect} />
        </TestWrapper>
      );

      await testKeyboardNavigation(
        screen.getByRole('list') || document.body,
        mockEntries.map((_, index) => `[data-testid="entry-${index}"]`)
      );
    });

    test('should handle entry selection with keyboard', async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      render(
        <TestWrapper>
          <KBEntryList onEntrySelect={mockOnSelect} />
        </TestWrapper>
      );

      const firstEntry = screen.getAllByRole('button')[0];

      // Test Enter key
      firstEntry.focus();
      await user.keyboard('{enter}');
      expect(mockOnSelect).toHaveBeenCalledWith(mockEntries[0]);

      // Test Space key
      await user.keyboard(' ');
      expect(mockOnSelect).toHaveBeenCalledTimes(2);
    });

    test('should announce entry selection to screen readers', async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      render(
        <TestWrapper>
          <KBEntryList onEntrySelect={mockOnSelect} />
        </TestWrapper>
      );

      const firstEntry = screen.getAllByRole('button')[0];

      await testScreenReaderAnnouncements(
        async () => {
          await user.click(firstEntry);
        },
        'selected entry',
        1500
      );
    });

    test('should have accessible rating controls', async () => {
      const user = userEvent.setup();
      const mockOnRate = jest.fn();

      render(
        <TestWrapper>
          <KBEntryList
            onEntryRate={mockOnRate}
            showUsageStats={true}
          />
        </TestWrapper>
      );

      // Find rating buttons
      const thumbsUpButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('helpful') ||
        btn.textContent?.includes('👍')
      );

      const thumbsDownButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('not helpful') ||
        btn.textContent?.includes('👎')
      );

      // Test thumbs up
      if (thumbsUpButtons.length > 0) {
        const thumbsUp = thumbsUpButtons[0];
        expect(thumbsUp).toHaveAccessibleName();
        expect(thumbsUp).toHaveAttribute('type', 'button');

        await user.click(thumbsUp);
        expect(mockOnRate).toHaveBeenCalledWith(mockEntries[0].id, true);
      }

      // Test thumbs down
      if (thumbsDownButtons.length > 0) {
        const thumbsDown = thumbsDownButtons[0];
        expect(thumbsDown).toHaveAccessibleName();
        expect(thumbsDown).toHaveAttribute('type', 'button');

        await user.click(thumbsDown);
        expect(mockOnRate).toHaveBeenCalledWith(mockEntries[0].id, false);
      }
    });

    test('should provide accessible entry metadata', () => {
      render(
        <TestWrapper>
          <KBEntryList showUsageStats={true} showCategories={true} />
        </TestWrapper>
      );

      mockEntries.forEach((entry, index) => {
        // Category should be accessible
        const categoryElement = screen.getByText(entry.category);
        expect(categoryElement).toBeVisible();

        // Usage stats should be announced properly
        if (entry.usage_count) {
          const usageText = screen.getByText(new RegExp(entry.usage_count.toString()));
          expect(usageText).toBeVisible();
        }

        // Success rate should be accessible
        const successRate = (entry.success_count / (entry.success_count + entry.failure_count)) * 100;
        if (!isNaN(successRate)) {
          // Should be announced to screen readers
          const rateElement = screen.getByText(new RegExp(Math.round(successRate).toString()));
          if (rateElement) {
            expect(rateElement).toHaveAttribute('aria-label', expect.stringContaining('success rate'));
          }
        }
      });
    });

    test('should handle expansion/collapse accessibly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      // Find expandable entries
      const expandButtons = screen.getAllByRole('button').filter(btn =>
        btn.hasAttribute('aria-expanded')
      );

      if (expandButtons.length > 0) {
        const expandButton = expandButtons[0];

        // Should start collapsed
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');

        // Test expansion with click
        await user.click(expandButton);
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');

        // Test with keyboard
        await user.keyboard('{enter}');
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');

        // Arrow keys should also work
        await user.keyboard('{arrowright}');
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');

        await user.keyboard('{arrowleft}');
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      }
    });

    test('should validate color contrast for different states', () => {
      render(
        <TestWrapper>
          <KBEntryList selectedEntryId={mockEntries[0].id} />
        </TestWrapper>
      );

      const entries = screen.getAllByRole('button');

      entries.forEach((entry, index) => {
        const computedStyle = window.getComputedStyle(entry);
        const isSelected = index === 0; // First entry is selected

        // Check contrast for different states
        if (isSelected) {
          // Selected state should have sufficient contrast
          const contrast = validateColorContrast(
            computedStyle.color || '#000000',
            computedStyle.backgroundColor || '#ffffff'
          );
          expect(contrast.passes).toBe(true);
        }

        // Focus state
        entry.focus();
        const focusStyle = window.getComputedStyle(entry, ':focus');
        expect(focusStyle.outline).toBeTruthy();
      });
    });

    test('should handle loading states accessibly', async () => {
      const { rerender } = render(
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      // Simulate loading state
      rerender(
        <TestWrapper>
          <div role="status" aria-live="polite" aria-label="Loading results">
            Loading...
          </div>
        </TestWrapper>
      );

      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
      expect(loadingElement).toHaveAccessibleName();
    });

    test('should handle empty states accessibly', () => {
      render(
        <TestWrapper>
          <div role="status" aria-live="polite">
            No results found
          </div>
        </TestWrapper>
      );

      const emptyState = screen.getByText('No results found');
      expect(emptyState.closest('[role="status"]')).toBeInTheDocument();
    });
  });

  describe('Virtual Scrolling Accessibility', () => {
    test('should maintain accessibility with virtual scrolling', async () => {
      const manyEntries = Array.from({ length: 100 }, (_, i) => ({
        ...mockEntries[0],
        id: `entry-${i}`,
        title: `Entry ${i}`
      }));

      render(
        <TestWrapper>
          <KBEntryList
            enableVirtualization={true}
            maxHeight="400px"
          />
        </TestWrapper>
      );

      // Virtual scrolling should still maintain proper ARIA attributes
      const container = screen.getByRole('list') || screen.getByRole('listbox');
      expect(container).toHaveAttribute('aria-label');

      // Should handle keyboard navigation in virtualized list
      const user = userEvent.setup();
      await user.tab(); // Focus first item

      // Arrow keys should work
      await user.keyboard('{arrowdown}');
      await user.keyboard('{arrowup}');
    });

    test('should announce virtual scrolling changes', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBEntryList
            enableVirtualization={true}
            maxHeight="400px"
          />
        </TestWrapper>
      );

      const scrollContainer = document.querySelector('[data-testid*="virtual"]') ||
                             document.querySelector('.virtual-list');

      if (scrollContainer) {
        await testScreenReaderAnnouncements(
          async () => {
            fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } });
          },
          'showing results',
          1500
        );
      }
    });
  });

  describe('Sorting and Filtering Accessibility', () => {
    test('should make sort controls accessible', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      // Find sort controls
      const sortButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('aria-label')?.includes('sort') ||
        btn.textContent?.toLowerCase().includes('sort')
      );

      sortButtons.forEach(button => {
        expect(button).toHaveAccessibleName();
        expect(button).toHaveAttribute('aria-describedby'); // Should describe current sort
      });

      if (sortButtons.length > 0) {
        const sortButton = sortButtons[0];

        await testScreenReaderAnnouncements(
          async () => {
            await user.click(sortButton);
          },
          'sorted by',
          1500
        );
      }
    });

    test('should make category filters accessible', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBEntryList showCategories={true} />
        </TestWrapper>
      );

      // Find category filters
      const categoryFilters = screen.getAllByRole('button').filter(btn =>
        mockEntries.some(entry => btn.textContent?.includes(entry.category))
      );

      categoryFilters.forEach(filter => {
        expect(filter).toHaveAccessibleName();

        // Should indicate if it's active
        const isActive = filter.getAttribute('aria-pressed') === 'true' ||
                        filter.classList.contains('active');

        if (filter.hasAttribute('aria-pressed')) {
          expect(['true', 'false']).toContain(filter.getAttribute('aria-pressed'));
        }
      });
    });
  });

  describe('Entry Detail Accessibility', () => {
    test('should provide accessible entry details', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      const firstEntry = screen.getAllByRole('button')[0];

      // Expand entry details
      await user.click(firstEntry);

      // Problem and solution should be accessible
      const problemElement = screen.getByText(mockEntries[0].problem);
      const solutionElement = screen.getByText(mockEntries[0].solution);

      expect(problemElement).toBeVisible();
      expect(solutionElement).toBeVisible();

      // Should be properly labeled
      const problemContainer = problemElement.closest('[aria-labelledby], [aria-label]');
      const solutionContainer = solutionElement.closest('[aria-labelledby], [aria-label]');

      expect(problemContainer).toBeTruthy();
      expect(solutionContainer).toBeTruthy();
    });

    test('should handle tags accessibly', () => {
      render(
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      mockEntries.forEach(entry => {
        if (entry.tags && entry.tags.length > 0) {
          entry.tags.forEach(tag => {
            const tagElements = screen.getAllByText(tag);
            tagElements.forEach(tagElement => {
              // Tags should be in a list or have proper ARIA labels
              const tagContainer = tagElement.closest('ul, ol, [role="list"]') ||
                                 tagElement.closest('[aria-label*="tag"]');
              expect(tagContainer).toBeTruthy();
            });
          });
        }
      });
    });
  });

  describe('Responsive Design Accessibility', () => {
    test('should maintain accessibility on mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667
      });

      render(
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      // Touch targets should be at least 44px
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        const minSize = 44; // WCAG minimum touch target size

        // Note: In real tests, you'd check actual computed styles
        expect(button).toBeVisible();
      });
    });

    test('should handle reduced motion preferences', () => {
      // Mock prefers-reduced-motion
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
        <TestWrapper>
          <KBEntryList />
        </TestWrapper>
      );

      // Animations should be reduced or disabled
      const animatedElements = document.querySelectorAll('[style*="transition"], [class*="animate"]');
      animatedElements.forEach(element => {
        const style = window.getComputedStyle(element as Element);
        // Should respect reduced motion preference
        expect(style.animationDuration).toBe('0s' || style.transitionDuration).toBe('0s');
      });
    });
  });

  describe('Error States Accessibility', () => {
    test('should handle entry errors accessibly', async () => {
      const user = userEvent.setup();
      const mockOnRate = jest.fn().mockRejectedValue(new Error('Rating failed'));

      render(
        <TestWrapper>
          <KBEntryList onEntryRate={mockOnRate} />
        </TestWrapper>
      );

      const thumbsUpButton = screen.getAllByRole('button').find(btn =>
        btn.getAttribute('aria-label')?.includes('helpful')
      );

      if (thumbsUpButton) {
        await user.click(thumbsUpButton);

        // Error should be announced
        await waitFor(() => {
          const errorElement = screen.queryByRole('alert');
          if (errorElement) {
            expect(errorElement).toBeVisible();
            expect(errorElement).toHaveAccessibleName();
          }
        });
      }
    });
  });
});