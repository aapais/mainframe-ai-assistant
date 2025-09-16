/**
 * KBEntryForm Component Tests
 * Comprehensive testing for KB Entry Form component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { KBEntryForm } from '../../../implementation/frontend/components/forms/KBEntryForm';
import { mockElectronAPI } from '../setup';

expect.extend(toHaveNoViolations);

describe('KBEntryForm Component', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();
  
  const defaultProps = {
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  };

  const mockFormData = {
    title: 'Test VSAM Status 35 Error',
    problem: 'Job fails with VSAM status 35 indicating file not found error when attempting to open dataset',
    solution: 'Check if dataset exists using LISTCAT command and verify file is properly cataloged with correct permissions',
    category: 'VSAM' as const,
    tags: ['vsam', 'status-35', 'file-not-found'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.validateKBEntry.mockResolvedValue({ valid: true });
    mockElectronAPI.searchSimilarEntries.mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('renders form with all required fields', () => {
      render(<KBEntryForm {...defaultProps} />);
      
      expect(screen.getByRole('textbox', { name: /entry title/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /problem description/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /solution/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /tags/i })).toBeInTheDocument();
    });

    it('displays correct form title and subtitle', () => {
      render(<KBEntryForm {...defaultProps} />);
      
      expect(screen.getByRole('heading', { name: /add new knowledge base entry/i })).toBeInTheDocument();
      expect(screen.getByText(/fill in the details to create a new knowledge base entry/i)).toBeInTheDocument();
    });

    it('renders edit mode correctly', () => {
      render(
        <KBEntryForm
          {...defaultProps}
          isEdit={true}
          title="Edit Knowledge Base Entry"
          submitLabel="Update Entry"
          initialData={mockFormData}
        />
      );
      
      expect(screen.getByRole('heading', { name: /edit knowledge base entry/i })).toBeInTheDocument();
      expect(screen.getByText(/update the knowledge base entry details below/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update entry/i })).toBeInTheDocument();
    });

    it('pre-fills form fields with initial data', () => {
      render(<KBEntryForm {...defaultProps} initialData={mockFormData} />);
      
      expect(screen.getByDisplayValue(mockFormData.title)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockFormData.problem)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockFormData.solution)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockFormData.category)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows required field errors when submitting empty form', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/this field is required/i)).toBeInTheDocument();
      });
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates title length constraints', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Test minimum length
      await user.type(titleField, 'abc');
      fireEvent.blur(titleField);
      
      await waitFor(() => {
        expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
      });
      
      // Test maximum length
      const longTitle = 'a'.repeat(201);
      await user.clear(titleField);
      await user.type(titleField, longTitle);
      fireEvent.blur(titleField);
      
      await waitFor(() => {
        expect(screen.getByText(/title must be less than 200 characters/i)).toBeInTheDocument();
      });
    });

    it('validates problem description length constraints', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const problemField = screen.getByRole('textbox', { name: /problem description/i });
      
      // Test minimum length
      await user.type(problemField, 'too short');
      fireEvent.blur(problemField);
      
      await waitFor(() => {
        expect(screen.getByText(/problem description must be at least 20 characters/i)).toBeInTheDocument();
      });
      
      // Test maximum length
      const longProblem = 'a'.repeat(2001);
      await user.clear(problemField);
      await user.type(problemField, longProblem);
      fireEvent.blur(problemField);
      
      await waitFor(() => {
        expect(screen.getByText(/problem description must be less than 2000 characters/i)).toBeInTheDocument();
      });
    });

    it('validates solution length constraints', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const solutionField = screen.getByRole('textbox', { name: /solution/i });
      
      // Test minimum length
      await user.type(solutionField, 'too short');
      fireEvent.blur(solutionField);
      
      await waitFor(() => {
        expect(screen.getByText(/solution must be at least 20 characters/i)).toBeInTheDocument();
      });
      
      // Test maximum length
      const longSolution = 'a'.repeat(5001);
      await user.clear(solutionField);
      await user.type(solutionField, longSolution);
      fireEvent.blur(solutionField);
      
      await waitFor(() => {
        expect(screen.getByText(/solution must be less than 5000 characters/i)).toBeInTheDocument();
      });
    });

    it('validates tag constraints', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const tagsField = screen.getByRole('textbox', { name: /tags/i });
      
      // Test too many tags
      const manyTags = Array.from({ length: 12 }, (_, i) => `tag${i}`).join(',');
      await user.type(tagsField, manyTags);
      fireEvent.blur(tagsField);
      
      await waitFor(() => {
        expect(screen.getByText(/maximum 10 tags allowed/i)).toBeInTheDocument();
      });
      
      // Test invalid tag characters
      await user.clear(tagsField);
      await user.type(tagsField, 'tag-with-@-symbol');
      fireEvent.blur(tagsField);
      
      await waitFor(() => {
        expect(screen.getByText(/tag contains invalid characters/i)).toBeInTheDocument();
      });
    });

    it('prevents duplicate tags', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const tagsField = screen.getByRole('textbox', { name: /tags/i });
      await user.type(tagsField, 'duplicate,DUPLICATE');
      fireEvent.blur(tagsField);
      
      await waitFor(() => {
        expect(screen.getByText(/duplicate tag not allowed/i)).toBeInTheDocument();
      });
    });

    it('requires category selection', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const categoryField = screen.getByRole('combobox', { name: /category/i });
      await user.clear(categoryField);
      fireEvent.blur(categoryField);
      
      await waitFor(() => {
        expect(screen.getByText(/category selection is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits valid form data successfully', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);
      
      render(<KBEntryForm {...defaultProps} />);
      
      // Fill in valid form data
      await user.type(screen.getByRole('textbox', { name: /entry title/i }), mockFormData.title);
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), mockFormData.category);
      await user.type(screen.getByRole('textbox', { name: /problem description/i }), mockFormData.problem);
      await user.type(screen.getByRole('textbox', { name: /solution/i }), mockFormData.solution);
      await user.type(screen.getByRole('textbox', { name: /tags/i }), mockFormData.tags.join(','));
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: mockFormData.title,
          problem: mockFormData.problem,
          solution: mockFormData.solution,
          category: mockFormData.category,
          tags: mockFormData.tags,
        });
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolveSubmit: (value?: any) => void;
      const submitPromise = new Promise(resolve => {
        resolveSubmit = resolve;
      });
      mockOnSubmit.mockReturnValue(submitPromise);
      
      render(<KBEntryForm {...defaultProps} initialData={mockFormData} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
      
      resolveSubmit!();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create entry/i })).toBeEnabled();
      });
    });

    it('shows success message after successful submission', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);
      
      render(<KBEntryForm {...defaultProps} initialData={mockFormData} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/entry created successfully/i)).toBeInTheDocument();
      });
    });

    it('shows error message on submission failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to save entry to database';
      mockOnSubmit.mockRejectedValue(new Error(errorMessage));
      
      render(<KBEntryForm {...defaultProps} initialData={mockFormData} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('resets form after successful submission when not in edit mode', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);
      
      render(<KBEntryForm {...defaultProps} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      await user.type(titleField, mockFormData.title);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(titleField).toHaveValue('');
      });
    });

    it('does not reset form after submission in edit mode', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);
      
      render(
        <KBEntryForm
          {...defaultProps}
          isEdit={true}
          initialData={mockFormData}
        />
      );
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(titleField).toHaveValue(mockFormData.title);
      });
    });
  });

  describe('Form Actions', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('resets form when cancel is clicked and no onCancel provided', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={mockOnSubmit} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      await user.type(titleField, 'Some text');
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(titleField).toHaveValue('');
    });

    it('disables submit button when form is invalid', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      await user.type(titleField, 'ab'); // Too short
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when form is valid', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      // Fill in all required fields with valid data
      await user.type(screen.getByRole('textbox', { name: /entry title/i }), mockFormData.title);
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), mockFormData.category);
      await user.type(screen.getByRole('textbox', { name: /problem description/i }), mockFormData.problem);
      await user.type(screen.getByRole('textbox', { name: /solution/i }), mockFormData.solution);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<KBEntryForm {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper form structure for screen readers', () => {
      render(<KBEntryForm {...defaultProps} />);
      expect(screen.getByRole('form')).toHaveAccessibleFormStructure();
    });

    it('associates labels with form controls', () => {
      render(<KBEntryForm {...defaultProps} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const categoryField = screen.getByRole('combobox', { name: /category/i });
      const problemField = screen.getByRole('textbox', { name: /problem description/i });
      const solutionField = screen.getByRole('textbox', { name: /solution/i });
      
      expect(titleField).toHaveAttribute('aria-labelledby');
      expect(categoryField).toHaveAttribute('aria-labelledby');
      expect(problemField).toHaveAttribute('aria-labelledby');
      expect(solutionField).toHaveAttribute('aria-labelledby');
    });

    it('announces form errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const categoryField = screen.getByRole('combobox', { name: /category/i });
      
      titleField.focus();
      expect(titleField).toHaveFocus();
      
      await user.tab();
      expect(categoryField).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('renders within performance threshold', () => {
      const startTime = performance.now();
      render(<KBEntryForm {...defaultProps} initialData={mockFormData} />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toHavePerformanceBetterThan(100); // Should render in under 100ms
    });

    it('handles large solution text without performance degradation', async () => {
      const user = userEvent.setup();
      const largeSolution = 'This is a very detailed solution. '.repeat(100);
      
      render(<KBEntryForm {...defaultProps} />);
      
      const startTime = performance.now();
      const solutionField = screen.getByRole('textbox', { name: /solution/i });
      await user.type(solutionField, largeSolution);
      const endTime = performance.now();
      
      expect(endTime - startTime).toHavePerformanceBetterThan(2000); // Should handle large text input efficiently
    });
  });

  describe('Development Mode', () => {
    it('shows debug info in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      render(<KBEntryForm {...defaultProps} />);
      
      expect(screen.getByText(/form debug info/i)).toBeInTheDocument();
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('hides debug info in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      render(<KBEntryForm {...defaultProps} />);
      
      expect(screen.queryByText(/form debug info/i)).not.toBeInTheDocument();
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});