import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { KBEntryForm } from '../KBEntryForm';

// Mock the Button component to simplify testing
jest.mock('../../common/Button', () => ({
  Button: ({ children, onClick, disabled, loading, type, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-loading={loading}
      data-variant={variant}
      type={type}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

describe('KBEntryForm', () => {
  const defaultProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the form with all required fields', () => {
      render(<KBEntryForm {...defaultProps} />);

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/problem description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/solution/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    it('renders in create mode by default', () => {
      render(<KBEntryForm {...defaultProps} />);
      
      expect(screen.getByText('Add New Knowledge Entry')).toBeInTheDocument();
      expect(screen.getByText('Add Entry')).toBeInTheDocument();
    });

    it('renders in edit mode when specified', () => {
      render(<KBEntryForm {...defaultProps} mode="edit" />);
      
      expect(screen.getByText('Edit Knowledge Entry')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('populates form with initial data', () => {
      const initialData = {
        title: 'Test Title',
        problem: 'Test Problem',
        solution: 'Test Solution',
        category: 'VSAM' as const,
        tags: ['test', 'vsam'],
      };

      render(<KBEntryForm {...defaultProps} initialData={initialData} />);

      expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Problem')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Solution')).toBeInTheDocument();
      expect(screen.getByDisplayValue('VSAM')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('vsam')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Problem description is required')).toBeInTheDocument();
        expect(screen.getByText('Solution is required')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('applies error styling to invalid fields', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        const titleInput = screen.getByLabelText(/title/i);
        const problemInput = screen.getByLabelText(/problem description/i);
        const solutionInput = screen.getByLabelText(/solution/i);

        expect(titleInput).toHaveClass('error');
        expect(problemInput).toHaveClass('error');
        expect(solutionInput).toHaveClass('error');
      });
    });

    it('clears validation errors when fields are filled', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      // First submit to show errors
      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      // Fill in the title field
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test Title');
      
      // Submit again to trigger validation
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
        expect(titleInput).not.toHaveClass('error');
      });
    });
  });

  describe('Form Interaction', () => {
    it('updates form data when typing in fields', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      const problemInput = screen.getByLabelText(/problem description/i);
      const solutionInput = screen.getByLabelText(/solution/i);

      await user.type(titleInput, 'New Title');
      await user.type(problemInput, 'New Problem');
      await user.type(solutionInput, 'New Solution');

      expect(titleInput).toHaveValue('New Title');
      expect(problemInput).toHaveValue('New Problem');
      expect(solutionInput).toHaveValue('New Solution');
    });

    it('changes category when select value is changed', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'VSAM');

      expect(categorySelect).toHaveValue('VSAM');
    });

    it('respects maxLength constraints', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      const longTitle = 'a'.repeat(250); // Exceeds maxLength of 200

      await user.type(titleInput, longTitle);

      expect(titleInput.value).toHaveLength(200);
    });
  });

  describe('Tag Management', () => {
    it('adds tags when typing and pressing Enter', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const tagInput = screen.getByLabelText(/tags/i);
      
      await user.type(tagInput, 'newtag');
      await user.keyboard('{Enter}');

      expect(screen.getByText('newtag')).toBeInTheDocument();
      expect(tagInput).toHaveValue('');
    });

    it('adds tags when clicking Add button', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const tagInput = screen.getByLabelText(/tags/i);
      const addButton = screen.getByText('Add');
      
      await user.type(tagInput, 'buttonTag');
      await user.click(addButton);

      expect(screen.getByText('buttonTag')).toBeInTheDocument();
      expect(tagInput).toHaveValue('');
    });

    it('converts tags to lowercase', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const tagInput = screen.getByLabelText(/tags/i);
      
      await user.type(tagInput, 'UPPERCASE');
      await user.keyboard('{Enter}');

      expect(screen.getByText('uppercase')).toBeInTheDocument();
    });

    it('prevents duplicate tags', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const tagInput = screen.getByLabelText(/tags/i);
      
      await user.type(tagInput, 'duplicate');
      await user.keyboard('{Enter}');
      await user.type(tagInput, 'duplicate');
      await user.keyboard('{Enter}');

      const duplicateTags = screen.getAllByText('duplicate');
      expect(duplicateTags).toHaveLength(1);
    });

    it('removes tags when clicking remove button', async () => {
      const user = userEvent.setup();
      const initialData = {
        title: '',
        problem: '',
        solution: '',
        category: 'Other' as const,
        tags: ['removeme', 'keepme'],
      };

      render(<KBEntryForm {...defaultProps} initialData={initialData} />);

      const removeButton = screen.getByLabelText('Remove removeme');
      await user.click(removeButton);

      expect(screen.queryByText('removeme')).not.toBeInTheDocument();
      expect(screen.getByText('keepme')).toBeInTheDocument();
    });

    it('trims whitespace from tags', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const tagInput = screen.getByLabelText(/tags/i);
      
      await user.type(tagInput, '  trimmed  ');
      await user.keyboard('{Enter}');

      expect(screen.getByText('trimmed')).toBeInTheDocument();
    });

    it('ignores empty tags', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const tagInput = screen.getByLabelText(/tags/i);
      
      await user.type(tagInput, '   ');
      await user.keyboard('{Enter}');

      expect(screen.queryByText('   ')).not.toBeInTheDocument();
      expect(tagInput).toHaveValue('');
    });
  });

  describe('Form Submission', () => {
    const validFormData = {
      title: 'Valid Title',
      problem: 'Valid Problem Description',
      solution: 'Valid Solution Steps',
      category: 'JCL' as const,
      tags: ['test'],
    };

    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<KBEntryForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill in form
      await user.type(screen.getByLabelText(/title/i), validFormData.title);
      await user.type(screen.getByLabelText(/problem description/i), validFormData.problem);
      await user.type(screen.getByLabelText(/solution/i), validFormData.solution);
      await user.selectOptions(screen.getByLabelText(/category/i), validFormData.category);
      
      // Add tag
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, validFormData.tags[0]);
      await user.keyboard('{Enter}');

      // Submit form
      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: validFormData.title,
          problem: validFormData.problem,
          solution: validFormData.solution,
          category: validFormData.category,
          tags: validFormData.tags,
        });
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<KBEntryForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill in minimum required fields
      await user.type(screen.getByLabelText(/title/i), 'Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Solution');

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeDisabled();

      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('handles submission errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));
      
      render(<KBEntryForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill in minimum required fields
      await user.type(screen.getByLabelText(/title/i), 'Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Solution');

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });

      // Form should not be in loading state after error
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeEnabled();
    });

    it('prevents submission with invalid data', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      // Try to submit without filling required fields
      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('disables cancel button during submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<KBEntryForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill in minimum required fields and submit
      await user.type(screen.getByLabelText(/title/i), 'Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Solution');

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<KBEntryForm {...defaultProps} />);

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/problem description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/solution/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    it('associates error messages with form fields', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        const titleInput = screen.getByLabelText(/title/i);
        const errorMessage = screen.getByText('Title is required');
        
        expect(titleInput).toHaveAccessibleDescription();
      });
    });

    it('provides accessible labels for tag remove buttons', () => {
      const initialData = {
        title: '',
        problem: '',
        solution: '',
        category: 'Other' as const,
        tags: ['test-tag'],
      };

      render(<KBEntryForm {...defaultProps} initialData={initialData} />);

      const removeButton = screen.getByLabelText('Remove test-tag');
      expect(removeButton).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      titleInput.focus();

      // Tab through form elements
      await user.keyboard('{Tab}');
      expect(screen.getByLabelText(/problem description/i)).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByLabelText(/solution/i)).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByLabelText(/category/i)).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByLabelText(/tags/i)).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles extremely long text input', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const problemInput = screen.getByLabelText(/problem description/i);
      const longText = 'a'.repeat(5000);

      await user.type(problemInput, longText);
      
      // Should accept long text (no maxLength on textarea by default)
      expect(problemInput).toHaveValue(longText);
    });

    it('handles special characters in input', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      const specialText = 'Test with "quotes" & <brackets> & émojis 🚀';

      await user.type(titleInput, specialText);
      
      expect(titleInput).toHaveValue(specialText);
    });

    it('handles rapid form submissions', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<KBEntryForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill in minimum required fields
      await user.type(screen.getByLabelText(/title/i), 'Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Solution');

      const submitButton = screen.getByText('Add Entry');
      
      // Try to click multiple times rapidly
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only be called once due to loading state
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
    });

    it('maintains form state during validation errors', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...defaultProps} />);

      // Fill in some fields but not all required ones
      await user.type(screen.getByLabelText(/title/i), 'Partial Title');
      await user.selectOptions(screen.getByLabelText(/category/i), 'VSAM');

      // Submit to trigger validation
      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Problem description is required')).toBeInTheDocument();
      });

      // Check that filled fields maintain their values
      expect(screen.getByDisplayValue('Partial Title')).toBeInTheDocument();
      expect(screen.getByDisplayValue('VSAM')).toBeInTheDocument();
    });
  });
});