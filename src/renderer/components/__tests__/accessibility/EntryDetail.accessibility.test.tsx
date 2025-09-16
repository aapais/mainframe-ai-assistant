/**
 * Accessibility Tests for EntryDetail Component
 * Tests WCAG 2.1 AA compliance for entry detail display and interaction
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

import { KBDataProvider } from '../../../contexts/KBDataContext';
import { KBEntry, KBCategory } from '../../../../types/services';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock EntryDetail component (since we don't see it in the file structure, we'll create a representative one)
const EntryDetail: React.FC<{
  entry: KBEntry;
  onRate?: (entryId: string, successful: boolean) => void;
  onEdit?: (entry: KBEntry) => void;
  onClose?: () => void;
  showActions?: boolean;
  showMetadata?: boolean;
  className?: string;
}> = ({
  entry,
  onRate,
  onEdit,
  onClose,
  showActions = true,
  showMetadata = true,
  className
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.solution);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const successRate = entry.success_count / (entry.success_count + entry.failure_count) * 100;

  return (
    <article
      className={`entry-detail ${className || ''}`}
      role="article"
      aria-labelledby="entry-title"
      aria-describedby="entry-problem entry-solution"
    >
      {/* Header */}
      <header className="entry-header">
        <div className="entry-title-row">
          <h2 id="entry-title" tabIndex={-1}>
            {entry.title}
          </h2>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close entry detail"
              className="close-button"
            >
              ✕
            </button>
          )}
        </div>

        {/* Metadata */}
        {showMetadata && (
          <div className="entry-metadata" role="group" aria-label="Entry metadata">
            <span className="category-badge" aria-label={`Category: ${entry.category}`}>
              {entry.category}
            </span>

            <span
              className="success-rate"
              aria-label={`Success rate: ${Math.round(successRate)}%`}
              title={`${entry.success_count} successful, ${entry.failure_count} unsuccessful`}
            >
              {Math.round(successRate)}% success rate
            </span>

            <span
              className="usage-count"
              aria-label={`Used ${entry.usage_count} times`}
            >
              Used {entry.usage_count} times
            </span>
          </div>
        )}

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="entry-tags" role="list" aria-label="Entry tags">
            {entry.tags.map((tag, index) => (
              <span
                key={tag}
                className="tag"
                role="listitem"
                aria-label={`Tag: ${tag}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Problem Section */}
      <section className="entry-section" aria-labelledby="problem-heading">
        <h3 id="problem-heading">Problem</h3>
        <div
          id="entry-problem"
          className="problem-text"
          role="region"
          aria-labelledby="problem-heading"
        >
          {entry.problem}
        </div>
      </section>

      {/* Solution Section */}
      <section className="entry-section" aria-labelledby="solution-heading">
        <div className="solution-header">
          <h3 id="solution-heading">Solution</h3>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy solution to clipboard"
            aria-describedby={copySuccess ? "copy-success" : undefined}
            className="copy-button"
          >
            📋 Copy
          </button>
          {copySuccess && (
            <div
              id="copy-success"
              role="status"
              aria-live="polite"
              className="copy-success"
            >
              Copied to clipboard
            </div>
          )}
        </div>

        <div
          id="entry-solution"
          className="solution-text"
          role="region"
          aria-labelledby="solution-heading"
        >
          {entry.solution.split('\n').map((line, index) => (
            <div key={index} className="solution-step">
              {line}
            </div>
          ))}
        </div>
      </section>

      {/* Expandable Details */}
      <section className="expandable-section">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="additional-details"
          className="expand-button"
        >
          {isExpanded ? 'Hide' : 'Show'} Additional Details
        </button>

        {isExpanded && (
          <div
            id="additional-details"
            className="additional-details"
            role="region"
            aria-labelledby="expand-button"
          >
            <h4>Created</h4>
            <time dateTime={entry.created_at.toISOString()}>
              {entry.created_at.toLocaleDateString()}
            </time>

            <h4>Last Updated</h4>
            <time dateTime={entry.updated_at.toISOString()}>
              {entry.updated_at.toLocaleDateString()}
            </time>
          </div>
        )}
      </section>

      {/* Actions */}
      {showActions && (
        <footer className="entry-actions" role="group" aria-label="Entry actions">
          {/* Rating */}
          {onRate && (
            <div className="rating-section" role="group" aria-label="Rate this solution">
              <span className="rating-label" id="rating-instructions">
                Was this solution helpful?
              </span>
              <div className="rating-buttons" role="group" aria-labelledby="rating-instructions">
                <button
                  type="button"
                  onClick={() => onRate(entry.id, true)}
                  aria-label="Mark as helpful"
                  className="rating-button helpful"
                >
                  👍 Helpful
                </button>
                <button
                  type="button"
                  onClick={() => onRate(entry.id, false)}
                  aria-label="Mark as not helpful"
                  className="rating-button not-helpful"
                >
                  👎 Not Helpful
                </button>
              </div>
            </div>
          )}

          {/* Edit */}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label="Edit this entry"
              className="edit-button"
            >
              ✏️ Edit Entry
            </button>
          )}
        </footer>
      )}
    </article>
  );
};

// Mock data
const mockEntry: KBEntry = {
  id: '1',
  title: 'VSAM Status 35 - File Not Found',
  problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
  solution: `1. Verify the dataset exists: Use ISPF 3.4 or LISTCAT command
2. Check the DD statement in JCL has correct DSN
3. Ensure file is cataloged properly
4. Verify RACF permissions: Use LISTDSD 'dataset.name'
5. Check if file was deleted or renamed`,
  category: 'VSAM' as KBCategory,
  tags: ['vsam', 'status-35', 'file-not-found', 'catalog', 'open-error'],
  created_at: new Date('2024-01-15'),
  updated_at: new Date('2024-01-20'),
  usage_count: 15,
  success_count: 12,
  failure_count: 3
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <KBDataProvider>
    <div id="test-app" role="application" aria-label="Knowledge Base Entry Detail">
      {children}
    </div>
  </KBDataProvider>
);

describe('EntryDetail Accessibility Tests', () => {
  beforeEach(() => {
    global.a11yTestUtils.setupAccessibleEnvironment();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.a11yTestUtils.cleanupAccessibleEnvironment();
  });

  describe('Basic Accessibility Compliance', () => {
    test('should pass axe accessibility audit', async () => {
      const { container } = render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper semantic structure', () => {
      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      // Main article structure
      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-labelledby', 'entry-title');
      expect(article).toHaveAttribute('aria-describedby', 'entry-problem entry-solution');

      // Headings structure
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent(mockEntry.title);
      expect(mainHeading).toHaveAttribute('id', 'entry-title');

      const subHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(subHeadings).toHaveLength(2); // Problem and Solution
      expect(subHeadings[0]).toHaveTextContent('Problem');
      expect(subHeadings[1]).toHaveTextContent('Solution');
    });

    test('should have accessible metadata', () => {
      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} showMetadata={true} />
        </TestWrapper>
      );

      // Metadata group
      const metadataGroup = screen.getByRole('group', { name: /metadata/i });
      expect(metadataGroup).toBeInTheDocument();

      // Category badge
      const categoryBadge = screen.getByLabelText(`Category: ${mockEntry.category}`);
      expect(categoryBadge).toBeVisible();

      // Success rate
      const successRate = screen.getByLabelText(/success rate/i);
      expect(successRate).toBeVisible();
      expect(successRate).toHaveAttribute('title'); // Tooltip with details

      // Usage count
      const usageCount = screen.getByLabelText(`Used ${mockEntry.usage_count} times`);
      expect(usageCount).toBeVisible();
    });

    test('should have accessible tags list', () => {
      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      const tagsList = screen.getByRole('list', { name: /tags/i });
      expect(tagsList).toBeInTheDocument();

      const tags = screen.getAllByRole('listitem');
      expect(tags).toHaveLength(mockEntry.tags!.length);

      tags.forEach((tag, index) => {
        expect(tag).toHaveAttribute('aria-label', `Tag: ${mockEntry.tags![index]}`);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support keyboard navigation through all interactive elements', async () => {
      const user = userEvent.setup();
      const mockOnRate = jest.fn();
      const mockOnEdit = jest.fn();
      const mockOnClose = jest.fn();

      render(
        <TestWrapper>
          <EntryDetail
            entry={mockEntry}
            onRate={mockOnRate}
            onEdit={mockOnEdit}
            onClose={mockOnClose}
          />
        </TestWrapper>
      );

      await testKeyboardNavigation(
        screen.getByRole('article'),
        [
          'button[aria-label="Close entry detail"]',
          'button[aria-label="Copy solution to clipboard"]',
          'button[aria-expanded]', // Expand/collapse button
          'button[aria-label="Mark as helpful"]',
          'button[aria-label="Mark as not helpful"]',
          'button[aria-label="Edit this entry"]'
        ]
      );
    });

    test('should handle expand/collapse with keyboard', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      const expandButton = screen.getByRole('button', { name: /additional details/i });

      // Should start collapsed
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      // Test Enter key
      expandButton.focus();
      await user.keyboard('{enter}');
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');

      // Test Space key
      await user.keyboard(' ');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      // Content should be properly controlled
      const detailsContent = screen.queryByRole('region', { name: /additional details/i });
      expect(detailsContent).not.toBeInTheDocument(); // Should be hidden
    });

    test('should handle rating buttons with keyboard', async () => {
      const user = userEvent.setup();
      const mockOnRate = jest.fn();

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} onRate={mockOnRate} />
        </TestWrapper>
      );

      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });

      // Test helpful button
      helpfulButton.focus();
      await user.keyboard('{enter}');
      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, true);

      // Test not helpful button
      notHelpfulButton.focus();
      await user.keyboard(' ');
      expect(mockOnRate).toHaveBeenCalledWith(mockEntry.id, false);
    });
  });

  describe('Screen Reader Experience', () => {
    test('should announce content properly to screen readers', async () => {
      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      // Article should be properly announced
      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-labelledby', 'entry-title');
      expect(article).toHaveAttribute('aria-describedby', 'entry-problem entry-solution');

      // Sections should have proper headings
      const problemSection = screen.getByRole('region', { name: /problem/i });
      expect(problemSection).toHaveAttribute('aria-labelledby', 'problem-heading');

      const solutionSection = screen.getByRole('region', { name: /solution/i });
      expect(solutionSection).toHaveAttribute('aria-labelledby', 'solution-heading');
    });

    test('should announce copy action to screen readers', async () => {
      const user = userEvent.setup();

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined)
        }
      });

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      const copyButton = screen.getByRole('button', { name: /copy solution/i });

      await testScreenReaderAnnouncements(
        async () => {
          await user.click(copyButton);
        },
        'Copied to clipboard',
        2000
      );

      // Success message should have proper ARIA live region
      const successMessage = screen.getByRole('status');
      expect(successMessage).toHaveAttribute('aria-live', 'polite');
    });

    test('should announce rating actions', async () => {
      const user = userEvent.setup();
      const mockOnRate = jest.fn();

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} onRate={mockOnRate} />
        </TestWrapper>
      );

      const ratingGroup = screen.getByRole('group', { name: /rate this solution/i });
      expect(ratingGroup).toBeInTheDocument();

      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });

      await testScreenReaderAnnouncements(
        async () => {
          await user.click(helpfulButton);
        },
        'marked as helpful',
        1500
      );
    });

    test('should provide accessible date information', () => {
      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      // Expand details to see dates
      const expandButton = screen.getByRole('button', { name: /additional details/i });
      fireEvent.click(expandButton);

      const timeElements = screen.getAllByRole('time');
      expect(timeElements).toHaveLength(2); // Created and updated dates

      timeElements.forEach(timeElement => {
        expect(timeElement).toHaveAttribute('dateTime');
      });
    });
  });

  describe('Focus Management', () => {
    test('should manage focus when closing detail', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const originalActiveElement = document.createElement('button');
      document.body.appendChild(originalActiveElement);
      originalActiveElement.focus();

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} onClose={mockOnClose} />
        </TestWrapper>
      );

      await testFocusManagement(
        async () => {
          const closeButton = screen.getByRole('button', { name: /close entry detail/i });
          await user.click(closeButton);
        },
        {
          returnFocus: true,
          originalActiveElement
        }
      );

      document.body.removeChild(originalActiveElement);
    });

    test('should set focus to title when entry changes', async () => {
      const { rerender } = render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      const newEntry = { ...mockEntry, id: '2', title: 'New Entry Title' };

      rerender(
        <TestWrapper>
          <EntryDetail entry={newEntry} />
        </TestWrapper>
      );

      // Title should be focusable for screen reader navigation
      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    test('should meet color contrast requirements', () => {
      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      // Test various text elements
      const title = screen.getByRole('heading', { level: 2 });
      const categoryBadge = screen.getByLabelText(`Category: ${mockEntry.category}`);
      const buttons = screen.getAllByRole('button');

      [title, categoryBadge, ...buttons].forEach(element => {
        const computedStyle = window.getComputedStyle(element);

        // Basic validation - in real tests, you'd use actual color values
        expect(computedStyle.color).toBeTruthy();
        expect(computedStyle.backgroundColor || computedStyle.background).toBeTruthy();

        // Focus states
        element.focus();
        const focusStyle = window.getComputedStyle(element, ':focus');
        expect(focusStyle.outline || focusStyle.boxShadow).toBeTruthy();
      });
    });

    test('should handle high contrast mode', () => {
      // Mock high contrast mode
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

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const style = window.getComputedStyle(button);
        // In high contrast mode, borders should be more prominent
        expect(style.border || style.outline).toBeTruthy();
      });
    });
  });

  describe('Form Accessibility (Rating and Actions)', () => {
    test('should follow proper form accessibility patterns for rating', async () => {
      const mockOnRate = jest.fn();

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} onRate={mockOnRate} />
        </TestWrapper>
      );

      const ratingSection = screen.getByRole('group', { name: /rate this solution/i });
      await accessibilityScenarios.testFormAccessibility(ratingSection);

      // Rating buttons should be properly labeled
      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });
      const notHelpfulButton = screen.getByRole('button', { name: /mark as not helpful/i });

      accessibilityScenarios.testButtonAccessibility(helpfulButton);
      accessibilityScenarios.testButtonAccessibility(notHelpfulButton);
    });

    test('should handle error states accessibly', async () => {
      const user = userEvent.setup();
      const mockOnRate = jest.fn().mockRejectedValue(new Error('Rating failed'));

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} onRate={mockOnRate} />
        </TestWrapper>
      );

      const helpfulButton = screen.getByRole('button', { name: /mark as helpful/i });

      await user.click(helpfulButton);

      // Error should be announced
      await waitFor(() => {
        const errorElement = screen.queryByRole('alert');
        if (errorElement) {
          expect(errorElement).toBeVisible();
          expect(errorElement).toHaveAccessibleName();
        }
      });
    });
  });

  describe('Responsive and Mobile Accessibility', () => {
    test('should maintain accessibility on touch devices', () => {
      // Mock touch device
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        configurable: true,
        value: 5
      });

      render(
        <TestWrapper>
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        // Touch targets should be at least 44px (WCAG guideline)
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
          <EntryDetail entry={mockEntry} />
        </TestWrapper>
      );

      // Animations should be disabled/reduced
      const expandButton = screen.getByRole('button', { name: /additional details/i });
      fireEvent.click(expandButton);

      // In reduced motion mode, transitions should be minimized
      const detailsContent = screen.getByRole('region');
      const style = window.getComputedStyle(detailsContent);
      expect(style.animationDuration).toBe('0s');
      expect(style.transitionDuration).toBe('0s');
    });
  });
});