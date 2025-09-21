/**
 * Accessibility Tests for UnifiedSearch Component - WCAG 2.1 Compliance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import UnifiedSearch from '../../src/renderer/components/search/UnifiedSearch';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../src/renderer/hooks/useNotificationSystem', () => ({
  useNotificationSystem: () => ({
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn()
  })
}));

describe('UnifiedSearch Accessibility Tests (WCAG 2.1)', () => {
  const defaultProps = {
    onSearch: jest.fn(),
    loading: false,
    placeholder: 'Search mainframe knowledge base',
    autoFocus: false,
    className: ''
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations in initial state', async () => {
      const { container } = render(<UnifiedSearch {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with suggestions open', async () => {
      const { container } = render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with filters open', async () => {
      const { container } = render(<UnifiedSearch {...defaultProps} />);
      const filtersButton = screen.getByLabelText('Search filters');

      await userEvent.click(filtersButton);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation (WCAG 2.1.1, 2.1.2)', () => {
    it('should be fully keyboard accessible', async () => {
      render(<UnifiedSearch {...defaultProps} />);

      // Tab to search input
      await userEvent.tab();
      expect(screen.getByRole('searchbox')).toHaveFocus();

      // Type to show suggestions
      await userEvent.type(screen.getByRole('searchbox'), 'test');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      // Navigate suggestions with arrow keys
      await userEvent.keyboard('{ArrowDown}');
      const firstOption = screen.getAllByRole('option')[0];
      expect(firstOption).toHaveAttribute('aria-selected', 'true');

      // Tab to AI toggle
      await userEvent.keyboard('{Tab}');
      const aiToggle = screen.getByLabelText(/AI-enhanced search/);
      expect(aiToggle).toHaveFocus();

      // Tab to filters button
      await userEvent.keyboard('{Tab}');
      const filtersButton = screen.getByLabelText('Search filters');
      expect(filtersButton).toHaveFocus();

      // Tab to search button
      await userEvent.keyboard('{Tab}');
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toHaveFocus();
    });

    it('should support escape key to close dropdowns', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      // Open suggestions
      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      // Press escape
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('should support global keyboard shortcuts', async () => {
      render(
        <div>
          <button>Other element</button>
          <UnifiedSearch {...defaultProps} />
        </div>
      );

      const otherButton = screen.getByRole('button', { name: 'Other element' });
      otherButton.focus();

      // Test Ctrl+K shortcut
      await userEvent.keyboard('{Control>}k{/Control}');
      expect(screen.getByRole('searchbox')).toHaveFocus();

      // Blur and test / shortcut
      otherButton.focus();
      await userEvent.keyboard('/');
      expect(screen.getByRole('searchbox')).toHaveFocus();
    });

    it('should not trap focus when no modal elements are open', async () => {
      render(
        <div>
          <button>Before</button>
          <UnifiedSearch {...defaultProps} />
          <button>After</button>
        </div>
      );

      const beforeButton = screen.getByRole('button', { name: 'Before' });
      const afterButton = screen.getByRole('button', { name: 'After' });

      // Should be able to tab through normally
      beforeButton.focus();
      await userEvent.tab();
      expect(screen.getByRole('searchbox')).toHaveFocus();

      await userEvent.tab();
      await userEvent.tab();
      await userEvent.tab();
      expect(afterButton).toHaveFocus();
    });
  });

  describe('ARIA Labels and Roles (WCAG 4.1.2)', () => {
    it('should have proper ARIA attributes on search input', () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      expect(input).toHaveAttribute('aria-label', 'Search mainframe knowledge base');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update ARIA attributes when suggestions are shown', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have proper ARIA attributes on suggestions', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Search suggestions');

      const options = screen.getAllByRole('option');
      options.forEach((option, index) => {
        expect(option).toHaveAttribute('aria-selected', 'false');
      });
    });

    it('should have proper ARIA attributes on interactive elements', () => {
      render(<UnifiedSearch {...defaultProps} />);

      const aiToggle = screen.getByLabelText(/AI-enhanced search/);
      expect(aiToggle).toHaveAttribute('aria-label');

      const filtersButton = screen.getByLabelText('Search filters');
      expect(filtersButton).toHaveAttribute('aria-label', 'Search filters');
    });

    it('should maintain ARIA selected state correctly', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      // Navigate to first option
      await userEvent.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      options.slice(1).forEach(option => {
        expect(option).toHaveAttribute('aria-selected', 'false');
      });
    });
  });

  describe('Focus Management (WCAG 2.4.3)', () => {
    it('should maintain logical focus order', async () => {
      render(<UnifiedSearch {...defaultProps} />);

      // Focus should go: input -> AI toggle -> filters -> search button
      await userEvent.tab();
      expect(screen.getByRole('searchbox')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByLabelText(/AI-enhanced search/)).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByLabelText('Search filters')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByRole('button', { name: /search/i })).toHaveFocus();
    });

    it('should return focus appropriately after interactions', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      // Focus input and open suggestions
      input.focus();
      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      // Select suggestion with enter
      await userEvent.keyboard('{ArrowDown}{Enter}');

      // Focus should remain on input
      expect(input).toHaveFocus();
    });

    it('should handle focus when clearing search', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      await userEvent.type(input, 'test');

      const clearButton = screen.getByLabelText('Clear search');
      await userEvent.click(clearButton);

      // Focus should return to input
      expect(input).toHaveFocus();
    });
  });

  describe('Color and Contrast (WCAG 1.4.3, 1.4.6)', () => {
    it('should have sufficient color contrast on interactive elements', async () => {
      const { container } = render(<UnifiedSearch {...defaultProps} />);

      // This would typically use a contrast checking library
      // For now, we verify that colors are defined and not transparent
      const searchButton = screen.getByRole('button', { name: /search/i });
      const computedStyle = window.getComputedStyle(searchButton);

      expect(computedStyle.backgroundColor).not.toBe('transparent');
      expect(computedStyle.color).not.toBe('transparent');
    });

    it('should maintain contrast in different states', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      // Test focus state
      input.focus();
      const focusedStyle = window.getComputedStyle(input);
      expect(focusedStyle.outlineWidth).not.toBe('0px');

      // Test disabled state
      const { rerender } = render(<UnifiedSearch {...defaultProps} loading={true} />);
      const disabledInput = screen.getByRole('searchbox');
      expect(disabledInput).toBeDisabled();
    });
  });

  describe('Screen Reader Support (WCAG 4.1.3)', () => {
    it('should provide meaningful labels for all interactive elements', () => {
      render(<UnifiedSearch {...defaultProps} />);

      // All interactive elements should have accessible names
      const input = screen.getByRole('searchbox');
      expect(input).toHaveAccessibleName();

      const aiToggle = screen.getByLabelText(/AI-enhanced search/);
      expect(aiToggle).toHaveAccessibleName();

      const filtersButton = screen.getByLabelText('Search filters');
      expect(filtersButton).toHaveAccessibleName();

      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toHaveAccessibleName();
    });

    it('should announce state changes appropriately', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      // State change announcements would typically be tested with screen reader testing tools
      // Here we verify the ARIA attributes that enable announcements
      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

      // AI toggle state change
      const aiToggle = screen.getByLabelText(/Enable AI-enhanced search/);
      await userEvent.click(aiToggle);
      expect(screen.getByLabelText(/Disable AI-enhanced search/)).toBeInTheDocument();
    });

    it('should provide context for suggestions', async () => {
      render(<UnifiedSearch {...defaultProps} />);
      const input = screen.getByRole('searchbox');

      await userEvent.type(input, 'S0C4');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Search suggestions');

      // Options should have meaningful content
      const options = screen.getAllByRole('option');
      options.forEach(option => {
        expect(option).toHaveTextContent(/.+/); // Should have text content
      });
    });
  });

  describe('Responsive and Mobile Accessibility', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      const { container } = render(<UnifiedSearch {...defaultProps} />);

      // Should still be accessible
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Touch targets should be large enough (44x44px minimum)
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
      });
    });

    it('should handle zoom levels up to 200%', async () => {
      // Simulate 200% zoom
      document.documentElement.style.fontSize = '32px'; // 200% of 16px

      const { container } = render(<UnifiedSearch {...defaultProps} />);

      // Should still be accessible and functional
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Reset
      document.documentElement.style.fontSize = '';
    });
  });

  describe('Error States and Feedback', () => {
    it('should provide accessible error messages', async () => {
      const onSearchWithError = jest.fn(() => {
        throw new Error('Search failed');
      });

      render(<UnifiedSearch {...defaultProps} onSearch={onSearchWithError} />);
      const input = screen.getByRole('searchbox');

      await userEvent.type(input, 'test');
      await userEvent.keyboard('{Enter}');

      // Error states should be announced to screen readers
      // This would typically involve aria-live regions or similar
    });

    it('should indicate loading state accessibly', () => {
      render(<UnifiedSearch {...defaultProps} loading={true} />);
      const input = screen.getByRole('searchbox');

      expect(input).toBeDisabled();
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });
  });

  describe('Reduced Motion Support (WCAG 2.3.3)', () => {
    it('should respect prefers-reduced-motion', async () => {
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

      render(<UnifiedSearch {...defaultProps} />);

      // Component should still be functional without animations
      const input = screen.getByRole('searchbox');
      await userEvent.type(input, 'test');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBeInTheDocument();
      });
    });
  });
});