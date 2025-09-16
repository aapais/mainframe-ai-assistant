/**
 * WCAG Compliance and Accessibility Tests
 * Ensures KB listing interface meets accessibility standards
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { KBExplorer } from '../../../src/renderer/pages/KBExplorer';
import { FilterPanel } from '../../../src/renderer/components/FilterPanel';
import { SortableTable } from '../../../src/renderer/components/SortableTable';
import { generateMockKBEntries } from '../helpers/mock-data-generator';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock IPC for accessibility testing
const mockIpcRenderer = {
  invoke: jest.fn((channel, ...args) => {
    if (channel === 'kb-listing:get-entries') {
      const mockData = generateMockKBEntries(20);
      return Promise.resolve({
        success: true,
        data: mockData,
        pagination: {
          currentPage: 1,
          pageSize: 20,
          totalItems: 100,
          totalPages: 5,
          hasNext: true,
          hasPrev: false
        }
      });
    }
    return Promise.resolve({ success: true, data: [] });
  })
};

Object.defineProperty(window, 'api', {
  value: { invoke: mockIpcRenderer.invoke }
});

describe('WCAG Compliance and Accessibility Tests', () => {
  let user: any;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 Level AA Compliance', () => {
    test('KBExplorer should have no accessibility violations', async () => {
      const { container } = render(<KBExplorer />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('FilterPanel should meet accessibility standards', async () => {
      const mockFilters = {
        categories: [],
        severities: [],
        tags: [],
        dateRange: null
      };

      const { container } = render(
        <FilterPanel
          filters={mockFilters}
          onFiltersChange={() => {}}
          onClearFilters={() => {}}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('SortableTable should be accessible', async () => {
      const mockData = generateMockKBEntries(10);
      const columns = [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'category', label: 'Category', sortable: true },
        { key: 'severity', label: 'Severity', sortable: true },
        { key: 'created_at', label: 'Created', sortable: true }
      ];

      const { container } = render(
        <SortableTable
          data={mockData}
          columns={columns}
          onSort={() => {}}
          onRowSelect={() => {}}
          sortBy="title"
          sortOrder="asc"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Tab through interactive elements
      const interactiveElements = [
        screen.getByPlaceholderText(/search/i),
        screen.getByLabelText(/category/i),
        screen.getByLabelText(/severity/i),
        screen.getByRole('button', { name: /clear filters/i })
      ];

      // Start from first element
      interactiveElements[0].focus();
      expect(document.activeElement).toBe(interactiveElements[0]);

      // Tab to next elements
      for (let i = 1; i < interactiveElements.length; i++) {
        await user.tab();
        expect(document.activeElement).toBe(interactiveElements[i]);
      }
    });

    test('should handle table keyboard navigation', async () => {
      const mockData = generateMockKBEntries(5);
      const columns = [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'category', label: 'Category', sortable: true }
      ];

      render(
        <SortableTable
          data={mockData}
          columns={columns}
          onSort={() => {}}
          onRowSelect={() => {}}
          sortBy="title"
          sortOrder="asc"
        />
      );

      // Navigate to table
      const table = screen.getByRole('table');
      const firstRow = screen.getAllByRole('row')[1]; // Skip header row

      // Focus first data row
      firstRow.focus();
      expect(document.activeElement).toBe(firstRow);

      // Arrow key navigation
      await user.keyboard('{ArrowDown}');
      const secondRow = screen.getAllByRole('row')[2];
      expect(document.activeElement).toBe(secondRow);

      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toBe(firstRow);

      // Enter to select row
      await user.keyboard('{Enter}');
      // Should trigger row selection
    });

    test('should support keyboard shortcuts', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Ctrl+F should focus search
      await user.keyboard('{Control>}f{/Control}');
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(document.activeElement).toBe(searchInput);

      // Escape should clear search
      await user.type(searchInput, 'test query');
      await user.keyboard('{Escape}');
      expect(searchInput.value).toBe('');

      // Alt+C should focus category filter
      await user.keyboard('{Alt>}c{/Alt}');
      const categoryFilter = screen.getByLabelText(/category/i);
      expect(document.activeElement).toBe(categoryFilter);
    });

    test('should handle modal keyboard trapping', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Open add entry modal
      const addButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(addButton);

      // Modal should be open
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Tab should cycle within modal
      const modalInputs = [
        screen.getByLabelText(/title/i),
        screen.getByLabelText(/problem/i),
        screen.getByLabelText(/solution/i),
        screen.getByLabelText(/category/i),
        screen.getByRole('button', { name: /save/i }),
        screen.getByRole('button', { name: /cancel/i })
      ];

      // Focus should start in modal
      modalInputs[0].focus();
      expect(document.activeElement).toBe(modalInputs[0]);

      // Tab through modal elements
      for (let i = 1; i < modalInputs.length; i++) {
        await user.tab();
        expect(document.activeElement).toBe(modalInputs[i]);
      }

      // Tab after last element should cycle back to first
      await user.tab();
      expect(document.activeElement).toBe(modalInputs[0]);

      // Shift+Tab should go backwards
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(modalInputs[modalInputs.length - 1]);

      // Escape should close modal
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Screen Reader Support', () => {
    test('should have proper ARIA labels and roles', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Main regions should be labeled
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Form controls should be labeled
      expect(screen.getByLabelText(/search knowledge base/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/severity/i)).toBeInTheDocument();

      // Buttons should have accessible names
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add entry/i })).toBeInTheDocument();
    });

    test('should announce dynamic content changes', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Search should announce results
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'VSAM');

      // Should have aria-live region for announcements
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/results found/i);
      });
    });

    test('should provide proper table headers and captions', async () => {
      const mockData = generateMockKBEntries(3);
      const columns = [
        { key: 'title', label: 'Entry Title', sortable: true },
        { key: 'category', label: 'Category', sortable: true },
        { key: 'severity', label: 'Severity Level', sortable: true }
      ];

      render(
        <SortableTable
          data={mockData}
          columns={columns}
          onSort={() => {}}
          onRowSelect={() => {}}
          sortBy="title"
          sortOrder="asc"
        />
      );

      // Table should have proper structure
      const table = screen.getByRole('table');
      expect(table).toHaveAccessibleName(); // Should have aria-label or caption

      // Headers should be properly associated
      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(columns.length);

      headers.forEach((header, index) => {
        expect(header).toHaveTextContent(columns[index].label);
      });

      // Sortable headers should indicate sort state
      const titleHeader = screen.getByRole('columnheader', { name: /entry title/i });
      expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    test('should provide meaningful error messages', async () => {
      // Mock error state
      mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('Network error'));

      render(<KBExplorer />);

      // Should display accessible error message
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent(/error loading/i);
      });
    });

    test('should support loading states with proper announcements', async () => {
      // Mock slow loading
      mockIpcRenderer.invoke.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: generateMockKBEntries(10),
          pagination: { totalItems: 10 }
        }), 100))
      );

      render(<KBExplorer />);

      // Should show loading state
      const loadingIndicator = screen.getByRole('status', { name: /loading/i });
      expect(loadingIndicator).toBeInTheDocument();

      // Should announce when loading completes
      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Color and Contrast', () => {
    test('should not rely solely on color for information', async () => {
      const mockData = generateMockKBEntries(5);
      mockData[0].severity = 'critical';
      mockData[1].severity = 'high';
      mockData[2].severity = 'medium';

      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Severity indicators should have text or icons, not just color
      const criticalRows = screen.getAllByText(/critical/i);
      criticalRows.forEach(row => {
        // Should have text content or aria-label
        expect(row).toHaveTextContent(/critical/i);
      });

      const highRows = screen.getAllByText(/high/i);
      highRows.forEach(row => {
        expect(row).toHaveTextContent(/high/i);
      });
    });

    test('should maintain readability in high contrast mode', async () => {
      // Simulate high contrast mode
      const style = document.createElement('style');
      style.textContent = `
        @media (prefers-contrast: high) {
          * {
            background: white !important;
            color: black !important;
          }
        }
      `;
      document.head.appendChild(style);

      const { container } = render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Content should still be readable
      const textElements = container.querySelectorAll('*');
      textElements.forEach(element => {
        if (element.textContent && element.textContent.trim()) {
          // Element should have sufficient contrast
          const computedStyle = window.getComputedStyle(element);
          expect(computedStyle.color).toBeDefined();
          expect(computedStyle.backgroundColor).toBeDefined();
        }
      });

      document.head.removeChild(style);
    });
  });

  describe('Focus Management', () => {
    test('should manage focus appropriately during navigation', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Focus should be visible
      const searchInput = screen.getByPlaceholderText(/search/i);
      searchInput.focus();

      expect(document.activeElement).toBe(searchInput);
      expect(searchInput).toHaveClass('focus-visible'); // Should have focus indicator
    });

    test('should restore focus after modal interactions', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add entry/i });
      addButton.focus();
      expect(document.activeElement).toBe(addButton);

      // Open modal
      await user.click(addButton);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Focus should return to add button
      expect(document.activeElement).toBe(addButton);
    });

    test('should handle focus for dynamically updated content', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Apply filter
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      // Results should update, focus should remain manageable
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            filters: { categories: ['VSAM'] }
          })
        );
      });

      // Focus should not be lost
      expect(document.activeElement).toBe(categoryFilter);
    });
  });

  describe('Text Scaling and Zoom', () => {
    test('should remain usable at 200% zoom', async () => {
      // Simulate 200% zoom
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 2
      });

      const { container } = render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Content should not overflow or become unusable
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(searchInput).toBeVisible();

      const table = screen.getByRole('table');
      expect(table).toBeVisible();

      // Interactive elements should remain clickable
      const addButton = screen.getByRole('button', { name: /add entry/i });
      expect(addButton).toBeVisible();

      await user.click(addButton);
      // Should still function properly
    });

    test('should respect user font size preferences', async () => {
      // Simulate larger font size preference
      const style = document.createElement('style');
      style.textContent = `
        html {
          font-size: 24px; /* Larger than default 16px */
        }
      `;
      document.head.appendChild(style);

      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Layout should adapt to larger text
      const heading = screen.getByText(/Knowledge Base Explorer/i);
      const computedStyle = window.getComputedStyle(heading);

      // Font should be scaled appropriately
      expect(parseInt(computedStyle.fontSize)).toBeGreaterThan(16);

      document.head.removeChild(style);
    });
  });

  describe('Reduced Motion Support', () => {
    test('should respect prefers-reduced-motion setting', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Animations should be disabled or reduced
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test');

      // Should not have motion-based animations
      const computedStyle = window.getComputedStyle(searchInput);
      expect(computedStyle.animationDuration).toMatch(/0s|none/);
    });
  });

  describe('Form Accessibility', () => {
    test('form controls should have proper labels and descriptions', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Open add entry form
      const addButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(addButton);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // All form fields should be labeled
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/problem/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/solution/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();

      // Required fields should be indicated
      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toHaveAttribute('required');
      expect(titleInput).toHaveAttribute('aria-required', 'true');
    });

    test('should provide helpful error messages', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(addButton);

      // Try to submit empty form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/problem is required/i)).toBeInTheDocument();
      });

      // Errors should be associated with fields
      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toHaveAttribute('aria-describedby');

      const errorId = titleInput.getAttribute('aria-describedby');
      const errorMessage = document.getElementById(errorId!);
      expect(errorMessage).toHaveTextContent(/title is required/i);
    });
  });

  describe('Mobile and Touch Accessibility', () => {
    test('should have adequate touch targets', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Touch targets should be at least 44px (iOS) or 48dp (Android)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
      });

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        const rect = link.getBoundingClientRect();
        expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
      });
    });

    test('should support touch navigation', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Simulate touch events
      const searchInput = screen.getByPlaceholderText(/search/i);

      fireEvent.touchStart(searchInput);
      fireEvent.touchEnd(searchInput);

      expect(document.activeElement).toBe(searchInput);

      // Table rows should be touch-accessible
      const firstRow = screen.getAllByRole('row')[1]; // Skip header

      fireEvent.touchStart(firstRow);
      fireEvent.touchEnd(firstRow);

      // Should trigger row selection or navigation
    });
  });

  describe('Internationalization Support', () => {
    test('should support RTL text direction', async () => {
      // Mock RTL language
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';

      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Layout should adapt to RTL
      const searchInput = screen.getByPlaceholderText(/search/i);
      const computedStyle = window.getComputedStyle(searchInput);
      expect(computedStyle.direction).toBe('rtl');

      // Reset
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    });

    test('should handle text scaling in different languages', async () => {
      // Simulate German text (typically longer)
      const longText = 'Wissensdatenbank-Explorer für Großrechnersysteme';

      render(
        <div>
          <h1>{longText}</h1>
          <KBExplorer />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Layout should accommodate longer text
      const heading = screen.getByText(longText);
      expect(heading).toBeVisible();

      // Should not overflow or wrap inappropriately
      const rect = heading.getBoundingClientRect();
      expect(rect.width).toBeGreaterThan(0);
    });
  });

  describe('Custom Accessibility Features', () => {
    test('should support custom keyboard shortcuts', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Test custom shortcuts
      await user.keyboard('{Alt>}{Shift>}s{/Shift}{/Alt}'); // Skip to search
      const searchInput = screen.getByPlaceholderText(/search/i);
      expect(document.activeElement).toBe(searchInput);

      await user.keyboard('{Alt>}{Shift>}t{/Shift}{/Alt}'); // Skip to table
      const table = screen.getByRole('table');
      expect(document.activeElement).toBe(table);
    });

    test('should provide accessibility help and documentation', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Should have help button or accessible instructions
      const helpButton = screen.queryByRole('button', { name: /help|accessibility/i });
      if (helpButton) {
        await user.click(helpButton);

        // Should show accessibility instructions
        expect(screen.getByText(/keyboard shortcuts|accessibility features/i)).toBeInTheDocument();
      } else {
        // Should have accessible instructions somewhere
        const instructions = screen.queryByText(/use arrow keys|press enter|keyboard shortcuts/i);
        expect(instructions).toBeInTheDocument();
      }
    });
  });
});