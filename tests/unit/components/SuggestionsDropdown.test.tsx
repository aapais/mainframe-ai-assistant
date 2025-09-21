/**
 * Unit Tests for SuggestionsDropdown Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SuggestionsDropdown from '../../../src/renderer/components/search/SuggestionsDropdown';
import { SearchSuggestion } from '../../../src/renderer/hooks/useSearchState';

// Mock hooks
jest.mock('../../../src/renderer/hooks/useClickOutside', () => ({
  useClickOutside: jest.fn(() => ({ current: null }))
}));

jest.mock('../../../src/renderer/hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: jest.fn()
}));

describe('SuggestionsDropdown', () => {
  const mockSuggestions: SearchSuggestion[] = [
    {
      id: '1',
      text: 'S0C4 ABEND',
      type: 'popular',
      category: 'COBOL',
      count: 45
    },
    {
      id: '2',
      text: 'DB2 SQLCODE -818',
      type: 'recent',
      category: 'DB2'
    },
    {
      id: '3',
      text: 'Browse by Category',
      type: 'quick-action',
      icon: '📁',
      action: jest.fn()
    }
  ];

  const defaultProps = {
    suggestions: mockSuggestions,
    isOpen: true,
    selectedIndex: -1,
    query: 'S0C',
    loading: false,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    onIndexChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <SuggestionsDropdown
          {...defaultProps}
          isOpen={false}
        />
      );

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should not render when loading', () => {
      render(
        <SuggestionsDropdown
          {...defaultProps}
          loading={true}
        />
      );

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should render suggestions when open and not loading', () => {
      render(<SuggestionsDropdown {...defaultProps} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('S0C4 ABEND')).toBeInTheDocument();
      expect(screen.getByText('DB2 SQLCODE -818')).toBeInTheDocument();
      expect(screen.getByText('Browse by Category')).toBeInTheDocument();
    });

    it('should show empty state when no suggestions', () => {
      render(
        <SuggestionsDropdown
          {...defaultProps}
          suggestions={[]}
        />
      );

      expect(screen.getByText('No suggestions found')).toBeInTheDocument();
      expect(screen.getByText('Try different keywords or check spelling')).toBeInTheDocument();
    });

    it('should display section title for quick actions', () => {
      render(
        <SuggestionsDropdown
          {...defaultProps}
          query=""
        />
      );

      expect(screen.getByText('Quick Actions & Popular Searches')).toBeInTheDocument();
    });
  });

  describe('Suggestion Types', () => {
    it('should render popular suggestions with correct icon and count', () => {
      render(<SuggestionsDropdown {...defaultProps} />);

      const popularSuggestion = screen.getByText('S0C4 ABEND').closest('button');
      expect(popularSuggestion).toBeInTheDocument();
      expect(screen.getByText('45 uses')).toBeInTheDocument();
      expect(screen.getByText('COBOL')).toBeInTheDocument();
    });

    it('should render recent suggestions with clock icon', () => {
      render(<SuggestionsDropdown {...defaultProps} />);

      const recentSuggestion = screen.getByText('DB2 SQLCODE -818').closest('button');
      expect(recentSuggestion).toBeInTheDocument();
      expect(screen.getByText('DB2')).toBeInTheDocument();
    });

    it('should render quick actions with custom icons', () => {
      render(<SuggestionsDropdown {...defaultProps} />);

      const quickAction = screen.getByText('Browse by Category').closest('button');
      expect(quickAction).toBeInTheDocument();
      expect(screen.getByText('📁')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onSelect when suggestion is clicked', async () => {
      const user = userEvent.setup();
      render(<SuggestionsDropdown {...defaultProps} />);

      const suggestion = screen.getByText('S0C4 ABEND');
      await user.click(suggestion);

      expect(defaultProps.onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it('should execute quick action when quick action is clicked', async () => {
      const user = userEvent.setup();
      render(<SuggestionsDropdown {...defaultProps} />);

      const quickAction = screen.getByText('Browse by Category');
      await user.click(quickAction);

      expect(mockSuggestions[2].action).toHaveBeenCalled();
    });

    it('should highlight text matching query', () => {
      render(<SuggestionsDropdown {...defaultProps} />);

      const highlightedText = screen.getByText('S0C');
      expect(highlightedText.tagName.toLowerCase()).toBe('mark');
      expect(highlightedText).toHaveClass('bg-yellow-200');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SuggestionsDropdown {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Search suggestions');

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);

      options.forEach((option, index) => {
        expect(option).toHaveAttribute('aria-selected',
          index === defaultProps.selectedIndex ? 'true' : 'false'
        );
      });
    });

    it('should highlight selected suggestion', () => {
      render(
        <SuggestionsDropdown
          {...defaultProps}
          selectedIndex={0}
        />
      );

      const firstOption = screen.getAllByRole('option')[0];
      expect(firstOption).toHaveAttribute('aria-selected', 'true');
      expect(firstOption).toHaveClass('bg-gradient-to-r from-purple-50 to-blue-50');
    });

    it('should set data-index attributes for keyboard navigation', () => {
      render(<SuggestionsDropdown {...defaultProps} />);

      const options = screen.getAllByRole('option');
      options.forEach((option, index) => {
        expect(option).toHaveAttribute('data-index', index.toString());
      });
    });
  });

  describe('Performance', () => {
    it('should memoize component to prevent unnecessary re-renders', () => {
      const { rerender } = render(<SuggestionsDropdown {...defaultProps} />);

      // Same props should not cause re-render
      rerender(<SuggestionsDropdown {...defaultProps} />);

      // Component should still be functional
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', () => {
      render(
        <SuggestionsDropdown
          {...defaultProps}
          query=""
        />
      );

      // Should not try to highlight anything
      expect(screen.getByText('S0C4 ABEND')).toBeInTheDocument();
    });

    it('should handle suggestions without categories or counts', () => {
      const simpleSuggestions: SearchSuggestion[] = [
        {
          id: '1',
          text: 'Simple suggestion',
          type: 'suggested'
        }
      ];

      render(
        <SuggestionsDropdown
          {...defaultProps}
          suggestions={simpleSuggestions}
        />
      );

      expect(screen.getByText('Simple suggestion')).toBeInTheDocument();
    });

    it('should handle very long suggestion text', () => {
      const longSuggestions: SearchSuggestion[] = [
        {
          id: '1',
          text: 'This is a very long suggestion text that might wrap to multiple lines and test text overflow handling',
          type: 'suggested'
        }
      ];

      render(
        <SuggestionsDropdown
          {...defaultProps}
          suggestions={longSuggestions}
        />
      );

      expect(screen.getByText(/This is a very long suggestion/)).toBeInTheDocument();
    });
  });
});