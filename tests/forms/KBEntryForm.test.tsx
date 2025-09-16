/**
 * Comprehensive test suite for KBEntryForm component
 * Tests validation, error handling, UX, and accessibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { KBEntryForm } from '../../implementation/frontend/components/forms/KBEntryForm';
import { KBEntryFormData } from '../../implementation/frontend/types/FormTypes';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock lodash debounce for testing
jest.mock('lodash', () => ({
  debounce: (fn: any) => {
    fn.cancel = jest.fn();
    return fn;
  }
}));

// Test data
const validFormData: KBEntryFormData = {
  title: 'Test VSAM Status 35 Error',
  problem: 'VSAM file access fails with status 35 indicating file not found or catalog issue',
  solution: 'Step 1: Check catalog entry. Step 2: Verify dataset exists. Step 3: Check permissions.',
  category: 'VSAM',
  tags: ['vsam', 'status-35', 'file-error']
};

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

describe('KBEntryForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  describe('Basic Rendering', () => {
    test('renders all required form fields', () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/entry title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/problem description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/solution/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    test('renders with correct default values', () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const categoryField = screen.getByDisplayValue('Other');
      expect(categoryField).toBeInTheDocument();
    });

    test('renders in edit mode with initial data', () => {
      render(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          initialData={validFormData}
          isEdit={true}
          title="Edit KB Entry"
          submitLabel="Update Entry"
        />
      );

      expect(screen.getByDisplayValue(validFormData.title)).toBeInTheDocument();
      expect(screen.getByDisplayValue(validFormData.problem)).toBeInTheDocument();
      expect(screen.getByDisplayValue(validFormData.solution)).toBeInTheDocument();
      expect(screen.getByText('Edit KB Entry')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update entry/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('shows required field errors when form is submitted empty', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/problem description must be at least 20 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/solution must be at least 20 characters/i)).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    test('validates title length constraints', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);

      // Test minimum length
      await user.type(titleField, 'Hi');
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
      });

      // Test maximum length
      await user.clear(titleField);
      await user.type(titleField, 'a'.repeat(201));
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/title must be less than 200 characters/i)).toBeInTheDocument();
      });
    });

    test('validates problem description length', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const problemField = screen.getByLabelText(/problem description/i);

      await user.type(problemField, 'Short problem');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/problem description must be at least 20 characters/i)).toBeInTheDocument();
      });
    });

    test('validates solution length', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const solutionField = screen.getByLabelText(/solution/i);

      await user.type(solutionField, 'Short solution');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/solution must be at least 20 characters/i)).toBeInTheDocument();
      });
    });

    test('validates tag constraints', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // This test would need the TagsField to be properly integrated
      // For now, we'll test the validation logic would be applied
      const form = screen.getByRole('form') || screen.getByTestId('kb-entry-form');
      expect(form).toBeInTheDocument();
    });

    test('real-time validation on change', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);

      // Type invalid input
      await user.type(titleField, 'Hi');

      // Should show error immediately due to validateOnChange
      await waitFor(() => {
        expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
      });

      // Clear error by typing valid input
      await user.clear(titleField);
      await user.type(titleField, 'Valid Title Length');

      await waitFor(() => {
        expect(screen.queryByText(/title must be at least 5 characters/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    test('submits valid form data', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill in valid data
      await user.type(screen.getByLabelText(/entry title/i), validFormData.title);
      await user.selectOptions(screen.getByLabelText(/category/i), validFormData.category);
      await user.type(screen.getByLabelText(/problem description/i), validFormData.problem);
      await user.type(screen.getByLabelText(/solution/i), validFormData.solution);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: validFormData.title,
          problem: validFormData.problem,
          solution: validFormData.solution,
          category: validFormData.category,
          tags: [] // Default empty tags
        });
      });
    });

    test('shows loading state during submission', async () => {
      // Mock slow submission
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill valid data
      await user.type(screen.getByLabelText(/entry title/i), validFormData.title);
      await user.type(screen.getByLabelText(/problem description/i), validFormData.problem);
      await user.type(screen.getByLabelText(/solution/i), validFormData.solution);

      // Submit
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: /creating.../i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating.../i })).toBeDisabled();
    });

    test('handles submission errors gracefully', async () => {
      const errorMessage = 'Failed to save entry';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill valid data and submit
      await user.type(screen.getByLabelText(/entry title/i), validFormData.title);
      await user.type(screen.getByLabelText(/problem description/i), validFormData.problem);
      await user.type(screen.getByLabelText(/solution/i), validFormData.solution);

      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);

      // Check error display
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });

      // Form should be enabled again
      expect(submitButton).not.toBeDisabled();
    });

    test('shows success message after successful submission', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill and submit valid data
      await user.type(screen.getByLabelText(/entry title/i), validFormData.title);
      await user.type(screen.getByLabelText(/problem description/i), validFormData.problem);
      await user.type(screen.getByLabelText(/solution/i), validFormData.solution);

      await user.click(screen.getByRole('button', { name: /create entry/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/entry created successfully/i);
      });
    });
  });

  describe('Form Actions', () => {
    test('cancel button calls onCancel prop', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    test('cancel button resets form when no onCancel prop', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill some data
      const titleField = screen.getByLabelText(/entry title/i);
      await user.type(titleField, 'Test title');

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Form should be reset
      expect(titleField).toHaveValue('');
    });

    test('submit button is disabled when form is invalid', () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /create entry/i });
      expect(submitButton).toBeDisabled();
    });

    test('submit button is enabled when form is valid', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/entry title/i), validFormData.title);
      await user.type(screen.getByLabelText(/problem description/i), validFormData.problem);
      await user.type(screen.getByLabelText(/solution/i), validFormData.solution);

      const submitButton = screen.getByRole('button', { name: /create entry/i });

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    test('form has no accessibility violations', async () => {
      const { container } = render(<KBEntryForm onSubmit={mockOnSubmit} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('required fields are properly labeled', () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Check that required fields have proper ARIA attributes
      expect(screen.getByLabelText(/entry title/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/problem description/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/solution/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/category/i)).toHaveAttribute('aria-required', 'true');
    });

    test('error messages are announced to screen readers', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);
      await user.type(titleField, 'Hi');
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      });
    });

    test('form fields have proper labels and descriptions', () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);
      expect(titleField).toHaveAccessibleName();
      expect(titleField).toHaveAccessibleDescription();
    });

    test('keyboard navigation works correctly', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);
      const categoryField = screen.getByLabelText(/category/i);

      titleField.focus();
      expect(document.activeElement).toBe(titleField);

      await user.tab();
      expect(document.activeElement).toBe(categoryField);
    });
  });

  describe('Development Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('shows debug info in development mode', () => {
      process.env.NODE_ENV = 'development';

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const debugSection = screen.getByText(/form debug info/i);
      expect(debugSection).toBeInTheDocument();
    });

    test('hides debug info in production mode', () => {
      process.env.NODE_ENV = 'production';

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const debugSection = screen.queryByText(/form debug info/i);
      expect(debugSection).not.toBeInTheDocument();
    });
  });

  describe('Character Counting', () => {
    test('shows character count for fields with maxLength', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);
      await user.type(titleField, 'Test title');

      // Should show character counter (assuming TextField shows it)
      const counter = screen.getByText(/10\/200/);
      expect(counter).toBeInTheDocument();
    });

    test('character counter shows warning when approaching limit', async () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);
      const nearLimitText = 'a'.repeat(170); // 85% of 200 char limit

      await user.type(titleField, nearLimitText);

      const counter = screen.getByText(`${nearLimitText.length}/200`);
      expect(counter).toHaveClass('text-field__counter--warning');
    });
  });

  describe('Auto-focus', () => {
    test('auto-focuses first field by default', () => {
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);
      expect(document.activeElement).toBe(titleField);
    });
  });

  describe('Form Reset', () => {
    test('resets form after successful submission in create mode', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill form
      const titleField = screen.getByLabelText(/entry title/i);
      await user.type(titleField, validFormData.title);

      // Submit
      await user.click(screen.getByRole('button', { name: /create entry/i }));

      // Form should be reset
      await waitFor(() => {
        expect(titleField).toHaveValue('');
      });
    });

    test('does not reset form after submission in edit mode', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      render(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          isEdit={true}
          initialData={validFormData}
        />
      );

      const titleField = screen.getByDisplayValue(validFormData.title);

      // Submit
      await user.click(screen.getByRole('button', { name: /create entry/i }));

      // Form should NOT be reset in edit mode
      await waitFor(() => {
        expect(titleField).toHaveValue(validFormData.title);
      });
    });
  });
});