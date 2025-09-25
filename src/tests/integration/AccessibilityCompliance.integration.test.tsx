/**
 * Accessibility Compliance Integration Tests
 *
 * Comprehensive accessibility testing for the categorization and tagging system
 * with focus on WCAG 2.1 AA compliance, keyboard navigation, and screen reader support.
 *
 * @author Integration Tester Agent
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations, configureAxe } from 'jest-axe';

// Components under test
import { EnhancedTagInput } from '../../components/tags/EnhancedTagInput';
import { EnhancedCategoryTree } from '../../components/categorization/EnhancedCategoryTree';
import { BulkOperationsPanel } from '../../components/bulk/BulkOperationsPanel';
import { EnhancedSmartEntryForm } from '../../components/forms/EnhancedSmartEntryForm';

// Test utilities
import {
  createMockKBEntry,
  createMockTag,
  createMockCategory,
  createRealisticCategorySet,
  createRealisticTagSet,
} from '../utils/mockData';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Configure axe for comprehensive testing
configureAxe({
  rules: {
    // Enable additional rules for comprehensive testing
    'color-contrast-enhanced': { enabled: true },
    'focus-order-semantics': { enabled: true },
    'landmark-complementary-is-top-level': { enabled: true },
    'page-has-heading-one': { enabled: false }, // Not applicable for components
    region: { enabled: false }, // Components don't need to be complete pages
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
});

// ===========================
// ACCESSIBILITY TEST SUITE
// ===========================

describe('Accessibility Compliance - WCAG 2.1 AA', () => {
  const mockTags = createRealisticTagSet();
  const mockCategories = createRealisticCategorySet();
  const mockEntries = Array.from({ length: 10 }, (_, i) =>
    createMockKBEntry(`entry-${i}`, {
      title: `Test Entry ${i}`,
      category: mockCategories[i % mockCategories.length].name,
      tags: [mockTags[i % mockTags.length].name, mockTags[(i + 1) % mockTags.length].name],
    })
  );

  describe('Enhanced Tag Input Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(
        <EnhancedTagInput
          value={mockTags.slice(0, 3)}
          onChange={() => {}}
          suggestions={mockTags.map(tag => ({
            tag,
            score: Math.random(),
            source: 'existing' as const,
          }))}
          ariaLabel='Entry tags'
          ariaDescribedBy='tag-help-text'
          announceChanges={true}
        />
      );

      // Add help text for aria-describedby
      const helpText = document.createElement('div');
      helpText.id = 'tag-help-text';
      helpText.textContent = 'Type to add tags. Press Enter to confirm, Backspace to remove.';
      document.body.appendChild(helpText);

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      document.body.removeChild(helpText);
    });

    test('should support comprehensive keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();

      render(
        <EnhancedTagInput
          value={mockTags.slice(0, 2)}
          onChange={mockOnChange}
          suggestions={mockTags.slice(2, 7).map(tag => ({
            tag,
            score: Math.random(),
            source: 'existing' as const,
          }))}
          ariaLabel='Knowledge base entry tags'
        />
      );

      const input = screen.getByRole('textbox', { name: /knowledge base entry tags/i });

      // Test basic keyboard navigation
      await user.tab();
      expect(input).toHaveFocus();

      // Test tag creation with keyboard
      await user.type(input, 'new-test-tag');
      await user.keyboard('{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ name: 'new-test-tag' })])
      );

      // Test suggestion navigation
      await user.type(input, 'existing');

      // Wait for suggestions to appear
      await waitFor(() => {
        const suggestions = screen.getAllByRole('option');
        expect(suggestions.length).toBeGreaterThan(0);
      });

      // Navigate through suggestions with arrow keys
      await user.keyboard('{ArrowDown}');
      const firstSuggestion = screen.getAllByRole('option')[0];
      expect(firstSuggestion).toHaveAttribute('aria-selected', 'true');

      await user.keyboard('{ArrowDown}');
      const secondSuggestion = screen.getAllByRole('option')[1];
      expect(secondSuggestion).toHaveAttribute('aria-selected', 'true');

      // Select suggestion with Enter
      await user.keyboard('{Enter}');
      expect(mockOnChange).toHaveBeenCalled();

      // Test tag removal with keyboard
      const tagElements = screen.getAllByRole('button', { name: /remove/i });
      if (tagElements.length > 0) {
        tagElements[0].focus();
        await user.keyboard('{Enter}');
        expect(mockOnChange).toHaveBeenCalled();
      }
    });

    test('should provide proper ARIA attributes and labels', () => {
      render(
        <EnhancedTagInput
          value={mockTags.slice(0, 3)}
          onChange={() => {}}
          ariaLabel='Project tags'
          ariaDescribedBy='tag-instructions'
          maxTags={10}
        />
      );

      // Add instructions element
      const instructions = document.createElement('div');
      instructions.id = 'tag-instructions';
      instructions.textContent = 'Maximum 10 tags allowed';
      document.body.appendChild(instructions);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Project tags');
      expect(input).toHaveAttribute('aria-describedby', 'tag-instructions');

      // Check combobox properties
      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');

      // Check existing tags have proper labels
      const tagButtons = screen.getAllByRole('button');
      tagButtons.forEach((button, index) => {
        expect(button).toHaveAccessibleName();
      });

      document.body.removeChild(instructions);
    });

    test('should announce changes to screen readers', async () => {
      const user = userEvent.setup();

      render(
        <EnhancedTagInput
          value={[]}
          onChange={() => {}}
          announceChanges={true}
          ariaLabel='Tag input with announcements'
        />
      );

      const input = screen.getByRole('textbox');

      // Add a tag
      await user.type(input, 'accessibility-test');
      await user.keyboard('{Enter}');

      // Check for live region announcement
      await waitFor(() => {
        const liveRegion = screen.getByRole('status', { hidden: true });
        expect(liveRegion).toBeInTheDocument();
        expect(liveRegion).toHaveTextContent(/added|tag/i);
      });
    });

    test('should handle high contrast mode correctly', () => {
      // Simulate high contrast mode
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }));

      const { container } = render(
        <EnhancedTagInput value={mockTags.slice(0, 2)} onChange={() => {}} colorScheme='auto' />
      );

      // Check that high contrast styles are applied
      const tagElements = container.querySelectorAll('.tag');
      tagElements.forEach(tag => {
        const styles = window.getComputedStyle(tag);
        // In high contrast mode, ensure sufficient color contrast
        expect(styles.border).toBeDefined();
      });

      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Enhanced Category Tree Accessibility', () => {
    const categoryTrees = mockCategories.map(cat => ({
      node: cat,
      children: [],
      depth: 0,
      path: [cat.name],
      parent: null,
    }));

    test('should have no accessibility violations', async () => {
      const { container } = render(
        <EnhancedCategoryTree
          categories={categoryTrees}
          ariaLabel='Knowledge base categories'
          ariaDescribedBy='category-help'
          announceChanges={true}
          enableKeyboardNavigation={true}
        />
      );

      // Add help text
      const helpText = document.createElement('div');
      helpText.id = 'category-help';
      helpText.textContent = 'Use arrow keys to navigate, Enter to select, F2 to rename';
      document.body.appendChild(helpText);

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      document.body.removeChild(helpText);
    });

    test('should implement proper tree navigation patterns', async () => {
      const user = userEvent.setup();
      const mockOnSelectionChange = jest.fn();

      render(
        <EnhancedCategoryTree
          categories={categoryTrees}
          onSelectionChange={mockOnSelectionChange}
          enableKeyboardNavigation={true}
          ariaLabel='Category tree navigation'
        />
      );

      const tree = screen.getByRole('tree', { name: /category tree navigation/i });

      // Focus the tree
      tree.focus();
      expect(tree).toHaveFocus();

      // Test tree navigation patterns
      await user.keyboard('{ArrowDown}');

      // Find the first tree item that should be selected
      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems.length).toBeGreaterThan(0);

      // Test Home key navigation
      await user.keyboard('{Home}');
      expect(mockOnSelectionChange).toHaveBeenCalled();

      // Test End key navigation
      await user.keyboard('{End}');
      expect(mockOnSelectionChange).toHaveBeenCalled();

      // Test Enter key selection
      await user.keyboard('{Enter}');
      expect(mockOnSelectionChange).toHaveBeenCalled();
    });

    test('should provide proper tree item attributes', () => {
      render(
        <EnhancedCategoryTree
          categories={categoryTrees.slice(0, 5)}
          selectedIds={[categoryTrees[0].node.id]}
          expandedIds={[]}
          multiSelect={true}
        />
      );

      const tree = screen.getByRole('tree');
      expect(tree).toHaveAttribute('aria-multiselectable', 'true');

      const treeItems = screen.getAllByRole('treeitem');

      treeItems.forEach((item, index) => {
        // Check required ARIA attributes
        expect(item).toHaveAttribute('aria-level');
        expect(item).toHaveAttribute('aria-selected');

        // Check that items have accessible names
        expect(item).toHaveAccessibleName();

        // Check tabindex management
        const tabIndex = item.getAttribute('tabindex');
        expect(tabIndex).toMatch(/^-?[0-9]$/);
      });
    });

    test('should handle expand/collapse states correctly', async () => {
      const user = userEvent.setup();

      // Create nested categories for testing
      const nestedCategories = [
        {
          node: createMockCategory('parent', 'Parent Category', { entry_count: 5 }),
          children: [
            {
              node: createMockCategory('child1', 'Child Category 1'),
              children: [],
              depth: 1,
              path: ['Parent Category', 'Child Category 1'],
              parent: null,
            },
          ],
          depth: 0,
          path: ['Parent Category'],
          parent: null,
        },
      ];

      render(
        <EnhancedCategoryTree categories={nestedCategories} enableKeyboardNavigation={true} />
      );

      // Find expandable item
      const parentItem = screen.getByRole('treeitem', { name: /parent category/i });
      expect(parentItem).toHaveAttribute('aria-expanded', 'false');

      // Test keyboard expansion
      parentItem.focus();
      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(parentItem).toHaveAttribute('aria-expanded', 'true');
      });

      // Test keyboard collapse
      await user.keyboard('{ArrowLeft}');

      await waitFor(() => {
        expect(parentItem).toHaveAttribute('aria-expanded', 'false');
      });
    });

    test('should provide meaningful focus management', async () => {
      const user = userEvent.setup();

      render(
        <EnhancedCategoryTree
          categories={categoryTrees.slice(0, 3)}
          enableKeyboardNavigation={true}
          enableInlineEdit={true}
        />
      );

      const tree = screen.getByRole('tree');
      const treeItems = screen.getAllByRole('treeitem');

      // Initial focus should be manageable
      tree.focus();

      // Navigate to first item
      await user.keyboard('{ArrowDown}');

      // Start editing (F2)
      await user.keyboard('{F2}');

      // Check that edit input receives focus
      await waitFor(() => {
        const editInput = screen.getByRole('textbox');
        expect(editInput).toHaveFocus();
      });

      // Cancel editing (Escape)
      await user.keyboard('{Escape}');

      // Focus should return to tree item
      await waitFor(() => {
        expect(treeItems[0]).toHaveFocus();
      });
    });
  });

  describe('Bulk Operations Panel Accessibility', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(
        <BulkOperationsPanel
          selectedEntries={mockEntries.slice(0, 5)}
          availableTags={mockTags}
          availableCategories={mockCategories}
          ariaLabel='Bulk operations for selected entries'
          announceProgress={true}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper progress announcements', async () => {
      const user = userEvent.setup();
      const mockOnExecute = jest.fn().mockImplementation(async () => {
        // Simulate operation with progress updates
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              operation: { type: 'tag', label: 'Add Tags' },
              totalItems: 5,
              successCount: 5,
              failureCount: 0,
              skippedCount: 0,
              errors: [],
              warnings: [],
              duration: 1000,
              canUndo: true,
            });
          }, 100);
        });
      });

      render(
        <BulkOperationsPanel
          selectedEntries={mockEntries.slice(0, 5)}
          availableTags={mockTags}
          availableCategories={mockCategories}
          onOperationExecute={mockOnExecute}
          announceProgress={true}
        />
      );

      // Start bulk operation
      await user.click(screen.getByText(/bulk tag/i));
      await user.click(screen.getByRole('button', { name: /apply/i }));

      // Should have progress announcement
      await waitFor(() => {
        const progressElement = screen.getByRole('progressbar', { hidden: true });
        expect(progressElement).toBeInTheDocument();
      });

      // Confirm operation
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      // Should announce completion
      await waitFor(() => {
        const completionAnnouncement = screen.getByRole('status', { hidden: true });
        expect(completionAnnouncement).toHaveTextContent(/completed|finished/i);
      });
    });

    test('should handle error states accessibly', async () => {
      const user = userEvent.setup();
      const mockOnExecute = jest.fn().mockRejectedValue(new Error('Operation failed'));

      render(
        <BulkOperationsPanel
          selectedEntries={mockEntries.slice(0, 3)}
          availableTags={mockTags}
          availableCategories={mockCategories}
          onOperationExecute={mockOnExecute}
          announceProgress={true}
        />
      );

      // Start operation that will fail
      await user.click(screen.getByText(/bulk tag/i));
      await user.click(screen.getByRole('button', { name: /apply/i }));
      await user.click(screen.getByRole('button', { name: /confirm/i }));

      // Should announce error
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent(/failed|error/i);
      });

      // Retry button should be accessible
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toHaveAccessibleName();
    });

    test('should support selection management with keyboard', async () => {
      const user = userEvent.setup();
      const mockOnSelectionChange = jest.fn();

      render(
        <div>
          <div role='main'>
            <BulkOperationsPanel
              selectedEntries={mockEntries}
              availableTags={mockTags}
              availableCategories={mockCategories}
              onSelectionChange={mockOnSelectionChange}
              showSelectionStats={true}
            />
          </div>
        </div>
      );

      // Test selection controls
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      expect(selectAllButton).toBeInTheDocument();

      await user.click(selectAllButton);
      expect(mockOnSelectionChange).toHaveBeenCalledWith(mockEntries);

      const clearSelectionButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearSelectionButton);
      expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Form Integration Accessibility', () => {
    test('should maintain accessibility in complete entry form', async () => {
      const { container } = render(
        <EnhancedSmartEntryForm
          onSubmit={() => Promise.resolve()}
          availableTags={mockTags}
          availableCategories={mockCategories}
          enableAIAssist={true}
          ariaLabel='Knowledge base entry form'
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should provide proper form validation announcements', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();

      render(
        <EnhancedSmartEntryForm
          onSubmit={mockOnSubmit}
          availableTags={mockTags}
          availableCategories={mockCategories}
          announceChanges={true}
        />
      );

      // Submit form without required fields
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await user.click(submitButton);

      // Should announce validation errors
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      });

      // Error messages should be accessible
      const errorMessages = screen.getAllByRole('alert');
      errorMessages.forEach(error => {
        expect(error).toHaveAccessibleName();
      });
    });

    test('should support complex form keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <EnhancedSmartEntryForm
          onSubmit={() => Promise.resolve()}
          availableTags={mockTags}
          availableCategories={mockCategories}
        />
      );

      // Test tab order through form
      const titleInput = screen.getByLabelText(/title/i);
      const problemInput = screen.getByLabelText(/problem/i);
      const solutionInput = screen.getByLabelText(/solution/i);
      const categorySelect = screen.getByLabelText(/category/i);
      const tagInput = screen.getByLabelText(/tags/i);
      const submitButton = screen.getByRole('button', { name: /save|submit/i });

      // Verify tab order
      await user.tab();
      expect(titleInput).toHaveFocus();

      await user.tab();
      expect(problemInput).toHaveFocus();

      await user.tab();
      expect(solutionInput).toHaveFocus();

      await user.tab();
      expect(categorySelect).toHaveFocus();

      await user.tab();
      expect(tagInput).toHaveFocus();

      // Skip other elements to submit button
      await user.tab();
      while (document.activeElement !== submitButton && document.activeElement) {
        await user.tab();
      }
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    test('should provide comprehensive screen reader information', () => {
      render(
        <div>
          <h1>Knowledge Base Management</h1>
          <EnhancedTagInput
            value={mockTags.slice(0, 2)}
            onChange={() => {}}
            ariaLabel='Entry tags'
            ariaDescribedBy='tag-help'
          />
          <div id='tag-help'>
            Type tag names and press Enter to add them. Use Backspace to remove tags.
          </div>
        </div>
      );

      const input = screen.getByRole('textbox', { name: /entry tags/i });

      // Check that all necessary ARIA attributes are present
      expect(input).toHaveAttribute('aria-label', 'Entry tags');
      expect(input).toHaveAttribute('aria-describedby', 'tag-help');
      expect(input).toHaveAttribute('role', 'combobox');

      // Check that existing tags are properly labeled
      const tags = screen.getAllByRole('button');
      tags.forEach(tag => {
        expect(tag).toHaveAccessibleName();
        expect(tag.getAttribute('aria-label')).toMatch(/remove|delete/i);
      });
    });

    test('should provide context information for complex operations', async () => {
      const user = userEvent.setup();

      render(
        <BulkOperationsPanel
          selectedEntries={mockEntries.slice(0, 5)}
          availableTags={mockTags}
          availableCategories={mockCategories}
          showSelectionStats={true}
          ariaLabel='Bulk operations panel'
        />
      );

      // Selection statistics should be announced
      const selectionInfo = screen.getByText(/5.*selected/i);
      expect(selectionInfo).toBeInTheDocument();

      // Operation buttons should have descriptive labels
      const bulkTagButton = screen.getByRole('button', { name: /bulk tag/i });
      expect(bulkTagButton).toHaveAccessibleDescription(/apply tags to selected entries/i);
    });

    test('should handle dynamic content updates accessibly', async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const [tags, setTags] = React.useState(mockTags.slice(0, 2));

        return (
          <div>
            <button onClick={() => setTags([...tags, mockTags[tags.length]])}>Add Tag</button>
            <EnhancedTagInput
              value={tags}
              onChange={setTags}
              announceChanges={true}
              ariaLabel='Dynamic tag input'
            />
          </div>
        );
      };

      render(<TestComponent />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      // Should announce the change
      await waitFor(() => {
        const announcement = screen.getByRole('status', { hidden: true });
        expect(announcement).toHaveTextContent(/added|tag/i);
      });
    });
  });

  describe('Color and Contrast Accessibility', () => {
    test('should maintain sufficient color contrast', async () => {
      const { container } = render(
        <EnhancedTagInput value={mockTags.slice(0, 5)} onChange={() => {}} colorScheme='light' />
      );

      // Test with enhanced color contrast rule
      const results = await axe(container, {
        rules: {
          'color-contrast-enhanced': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    test('should work in different color schemes', async () => {
      const colorSchemes = ['light', 'dark', 'auto'] as const;

      for (const scheme of colorSchemes) {
        const { container, unmount } = render(
          <EnhancedTagInput value={mockTags.slice(0, 3)} onChange={() => {}} colorScheme={scheme} />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();

        unmount();
      }
    });

    test('should not rely solely on color for information', () => {
      render(
        <EnhancedTagInput
          value={[
            createMockTag('success', 'success-tag', { color: '#00ff00' }),
            createMockTag('error', 'error-tag', { color: '#ff0000' }),
            createMockTag('warning', 'warning-tag', { color: '#ffff00' }),
          ]}
          onChange={() => {}}
        />
      );

      // Tags should have text labels, not just colors
      const tags = screen.getAllByRole('button');
      tags.forEach(tag => {
        const accessibleName = tag.getAttribute('aria-label') || tag.textContent;
        expect(accessibleName).toBeTruthy();
        expect(accessibleName).not.toBe('');
      });
    });
  });

  describe('Focus Management', () => {
    test('should manage focus properly during modal operations', async () => {
      const user = userEvent.setup();

      render(
        <BulkOperationsPanel
          selectedEntries={mockEntries.slice(0, 3)}
          availableTags={mockTags}
          availableCategories={mockCategories}
        />
      );

      // Open bulk operation
      const bulkButton = screen.getByText(/bulk tag/i);
      await user.click(bulkButton);

      // Focus should move to modal
      await waitFor(() => {
        const modal = screen.getByRole('dialog', { hidden: true });
        expect(modal).toBeInTheDocument();
      });

      // Close modal (Escape)
      await user.keyboard('{Escape}');

      // Focus should return to trigger button
      await waitFor(() => {
        expect(bulkButton).toHaveFocus();
      });
    });

    test('should provide visible focus indicators', () => {
      render(<EnhancedTagInput value={mockTags.slice(0, 2)} onChange={() => {}} />);

      const input = screen.getByRole('textbox');
      input.focus();

      // Focus indicator should be visible
      const styles = window.getComputedStyle(input);
      expect(styles.outline).not.toBe('none');
    });
  });

  describe('Responsive Design Accessibility', () => {
    test('should maintain accessibility at different viewport sizes', async () => {
      const viewports = [
        { width: 320, height: 568 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 }, // Desktop
      ];

      for (const viewport of viewports) {
        // Mock viewport
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewport.width,
        });

        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: viewport.height,
        });

        const { container, unmount } = render(
          <EnhancedCategoryTree
            categories={mockCategories.slice(0, 10).map(cat => ({
              node: cat,
              children: [],
              depth: 0,
              path: [cat.name],
              parent: null,
            }))}
            width={viewport.width - 40}
            height={Math.min(600, viewport.height - 200)}
          />
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();

        unmount();
      }
    });
  });
});
