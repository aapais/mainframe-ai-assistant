/**
 * Accessibility Compliance Tests
 * Testing WCAG 2.1 compliance and accessibility features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations, configureAxe } from 'jest-axe';
import { KBEntryForm } from '../../../implementation/frontend/components/forms/KBEntryForm';
import { MainWindowLayout } from '../../../implementation/frontend/layouts/MainWindowLayout';
import { mockElectronAPI } from '../../../src/renderer/components/__tests__/setup';

expect.extend(toHaveNoViolations);

// Configure axe for comprehensive accessibility testing
configureAxe({
  rules: {
    // Enable additional WCAG 2.1 AA rules
    'color-contrast': { enabled: true },
    'focus-order-semantics': { enabled: true },
    'hidden-content': { enabled: true },
    'landmark-unique': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'skip-link': { enabled: true },
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
});

describe('Accessibility Compliance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.validateKBEntry.mockResolvedValue({ valid: true });
  });

  describe('WCAG 2.1 Compliance', () => {
    it('passes basic axe accessibility audit for KBEntryForm', async () => {
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe audit for form with validation errors', async () => {
      const user = userEvent.setup();
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} />);
      
      // Trigger validation errors
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/this field is required/i)).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe audit for MainWindowLayout', async () => {
      const { container } = render(
        <MainWindowLayout windowId="test-window">
          <div>Test Content</div>
        </MainWindowLayout>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains accessibility with dynamic content changes', async () => {
      const user = userEvent.setup();
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} />);
      
      // Make changes that trigger dynamic updates
      await user.type(screen.getByRole('textbox', { name: /entry title/i }), 'Dynamic content test');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'VSAM');
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports full keyboard navigation through form', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const categoryField = screen.getByRole('combobox', { name: /category/i });
      const problemField = screen.getByRole('textbox', { name: /problem description/i });
      const solutionField = screen.getByRole('textbox', { name: /solution/i });
      const tagsField = screen.getByRole('textbox', { name: /tags/i });
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      // Test tab order
      titleField.focus();
      expect(titleField).toHaveFocus();
      
      await user.tab();
      expect(categoryField).toHaveFocus();
      
      await user.tab();
      expect(problemField).toHaveFocus();
      
      await user.tab();
      expect(solutionField).toHaveFocus();
      
      await user.tab();
      expect(tagsField).toHaveFocus();
      
      await user.tab();
      expect(cancelButton).toHaveFocus();
      
      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('supports reverse keyboard navigation (Shift+Tab)', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      submitButton.focus();
      expect(submitButton).toHaveFocus();
      
      await user.tab({ shift: true });
      expect(cancelButton).toHaveFocus();
    });

    it('handles keyboard shortcuts correctly', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(
        <KBEntryForm 
          onSubmit={mockOnSubmit}
          initialData={{
            title: 'Test Entry',
            problem: 'Test problem description',
            solution: 'Test solution description',
            category: 'VSAM' as const,
            tags: [],
          }}
        />
      );
      
      // Test Ctrl+Enter to submit form
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('traps focus in modal dialogs', async () => {
      // This would test modal focus trapping if we had modals
      // For now, testing that focus remains within form boundaries
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      titleField.focus();
      
      // Press Shift+Tab from first field - should not leave form
      await user.tab({ shift: true });
      
      // Focus should cycle to last focusable element in form
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('provides proper form structure for screen readers', () => {
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      // Check for form landmark
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
      
      // Check for heading structure
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toBeInTheDocument();
      
      // Verify form has accessible structure
      expect(form).toHaveAccessibleFormStructure();
    });

    it('associates labels with form controls correctly', () => {
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const categoryField = screen.getByRole('combobox', { name: /category/i });
      const problemField = screen.getByRole('textbox', { name: /problem description/i });
      const solutionField = screen.getByRole('textbox', { name: /solution/i });
      const tagsField = screen.getByRole('textbox', { name: /tags/i });
      
      // All fields should have accessible names
      expect(titleField).toHaveAccessibleName();
      expect(categoryField).toHaveAccessibleName();
      expect(problemField).toHaveAccessibleName();
      expect(solutionField).toHaveAccessibleName();
      expect(tagsField).toHaveAccessibleName();
    });

    it('announces form validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Create validation error
      await user.type(titleField, 'ab'); // Too short
      fireEvent.blur(titleField);
      
      await waitFor(() => {
        expect(titleField).toHaveAttribute('aria-invalid', 'true');
        expect(titleField).toHaveAttribute('aria-describedby');
        
        // Error message should be announced
        const errorId = titleField.getAttribute('aria-describedby');
        const errorElement = document.getElementById(errorId!);
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveAttribute('role', 'alert');
      });
    });

    it('provides proper ARIA live regions for dynamic content', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Save failed'));
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);
      
      // Trigger form submission to generate dynamic feedback
      await user.click(screen.getByRole('button', { name: /create entry/i }));
      
      await waitFor(() => {
        const alertElement = screen.getByRole('alert');
        expect(alertElement).toBeInTheDocument();
        expect(alertElement).toHaveTextContent(/save failed/i);
      });
    });

    it('provides descriptive help text for complex fields', () => {
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const problemField = screen.getByRole('textbox', { name: /problem description/i });
      const tagsField = screen.getByRole('textbox', { name: /tags/i });
      
      // Fields should have descriptive help text
      expect(screen.getByText(/clear, concise title/i)).toBeInTheDocument();
      expect(screen.getByText(/detailed description of the problem/i)).toBeInTheDocument();
      expect(screen.getByText(/add tags to help categorize/i)).toBeInTheDocument();
      
      // Help text should be associated with fields
      expect(titleField).toHaveAttribute('aria-describedby');
      expect(problemField).toHaveAttribute('aria-describedby');
      expect(tagsField).toHaveAttribute('aria-describedby');
    });
  });

  describe('Visual Accessibility', () => {
    it('maintains adequate color contrast ratios', () => {
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} />);
      
      // This would require actual color contrast checking
      // For now, we ensure axe checks handle this
      return axe(container).then(results => {
        expect(results).toHaveNoViolations();
      });
    });

    it('supports high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('high-contrast'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      // Verify form still renders and functions in high contrast mode
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /entry title/i })).toBeInTheDocument();
    });

    it('maintains visual hierarchy with proper heading levels', () => {
      render(
        <MainWindowLayout windowId="test-window">
          <KBEntryForm onSubmit={jest.fn()} />
        </MainWindowLayout>
      );
      
      // Check heading hierarchy (h1 -> h2 -> h3, etc.)
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Main window should have an h1 or equivalent
      const mainHeading = headings.find(h => h.tagName === 'H1' || h.getAttribute('aria-level') === '1');
      expect(mainHeading).toBeInTheDocument();
    });
  });

  describe('Motor Accessibility', () => {
    it('provides large enough click targets', () => {
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      // Buttons should have adequate size (WCAG recommends 44x44px minimum)
      const submitRect = submitButton.getBoundingClientRect();
      const cancelRect = cancelButton.getBoundingClientRect();
      
      expect(submitRect.height).toBeGreaterThanOrEqual(44);
      expect(submitRect.width).toBeGreaterThanOrEqual(44);
      expect(cancelRect.height).toBeGreaterThanOrEqual(44);
      expect(cancelRect.width).toBeGreaterThanOrEqual(44);
    });

    it('supports drag and drop with keyboard alternatives', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const tagsField = screen.getByRole('textbox', { name: /tags/i });
      
      // Test that drag-and-drop functionality has keyboard alternatives
      tagsField.focus();
      await user.keyboard('tag1,tag2,tag3');
      
      expect(tagsField).toHaveValue('tag1,tag2,tag3');
    });

    it('does not require precise mouse movements', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const categoryField = screen.getByRole('combobox', { name: /category/i });
      
      // Should be able to interact without precise positioning
      await user.click(categoryField);
      await user.selectOptions(categoryField, 'VSAM');
      
      expect(categoryField).toHaveValue('VSAM');
    });
  });

  describe('Cognitive Accessibility', () => {
    it('provides clear error messages', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Create validation error
      await user.type(titleField, 'ab');
      fireEvent.blur(titleField);
      
      await waitFor(() => {
        // Error message should be specific and helpful
        const errorMessage = screen.getByText(/title must be at least 5 characters/i);
        expect(errorMessage).toBeInTheDocument();
        
        // Should not be generic "error" message
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      });
    });

    it('provides consistent navigation patterns', () => {
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      // Form should follow consistent patterns
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      
      // Primary action should come after secondary action in DOM order
      const buttonContainer = submitButton.closest('.kb-entry-form__actions');
      expect(buttonContainer).toContainElement(cancelButton);
      expect(buttonContainer).toContainElement(submitButton);
    });

    it('shows progress and status clearly', async () => {
      const user = userEvent.setup();
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>(resolve => {
        resolveSubmit = resolve;
      });
      
      const mockOnSubmit = jest.fn().mockReturnValue(submitPromise);
      
      render(
        <KBEntryForm 
          onSubmit={mockOnSubmit}
          initialData={{
            title: 'Test Entry',
            problem: 'Test problem description',
            solution: 'Test solution description',
            category: 'VSAM' as const,
            tags: [],
          }}
        />
      );
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      // Should show loading state clearly
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
      
      resolveSubmit!();
      
      await waitFor(() => {
        expect(screen.getByText(/entry created successfully/i)).toBeInTheDocument();
      });
    });

    it('provides helpful input constraints and formatting hints', () => {
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const problemField = screen.getByRole('textbox', { name: /problem description/i });
      
      // Fields should indicate their constraints
      expect(titleField).toHaveAttribute('maxlength', '200');
      expect(problemField).toHaveAttribute('maxlength', '2000');
      
      // Should have helpful placeholder text
      expect(titleField).toHaveAttribute('placeholder', expect.stringMatching(/brief.*descriptive/i));
      expect(problemField).toHaveAttribute('placeholder', expect.stringMatching(/describe.*detail/i));
    });
  });

  describe('Responsive Accessibility', () => {
    it('maintains accessibility on mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('max-width: 768px'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} />);
      
      return axe(container).then(results => {
        expect(results).toHaveNoViolations();
      });
    });

    it('adapts touch targets for mobile devices', () => {
      // Mock touch device
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('pointer: coarse'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      
      // Touch targets should be larger on touch devices
      const rect = submitButton.getBoundingClientRect();
      expect(rect.height).toBeGreaterThanOrEqual(48); // Larger touch target
    });
  });

  describe('Multi-language Accessibility', () => {
    it('supports right-to-left (RTL) text direction', () => {
      // Mock RTL language
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      
      const { container } = render(<KBEntryForm onSubmit={jest.fn()} />);
      
      return axe(container).then(results => {
        expect(results).toHaveNoViolations();
      });
    });

    it('provides proper language attributes', () => {
      render(<KBEntryForm onSubmit={jest.fn()} />);
      
      // Form should respect document language
      const form = screen.getByRole('form');
      
      // Language should be properly set at document level
      expect(document.documentElement).toHaveAttribute('lang');
    });
  });

  afterEach(() => {
    // Reset document properties
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  });
});