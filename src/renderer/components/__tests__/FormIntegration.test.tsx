import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { KBEntryForm } from '../forms/KBEntryForm';
import { ValidationService } from '../../services/ValidationService';
import { ValidationConfig } from '../../types/services';

// Mock the Button component
jest.mock('../common/Button', () => ({
  Button: ({ children, onClick, disabled, loading, type, variant, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-loading={loading}
      data-variant={variant}
      type={type}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

// Mock CSS imports
jest.mock('../forms/KBEntryForm.css', () => ({}));

// Test utilities
const createMockValidationService = () => {
  const config: ValidationConfig = {
    strict: false,
    sanitize: true,
    maxLength: {
      title: 200,
      problem: 5000,
      solution: 10000,
      tags: 30,
    },
    minLength: {
      title: 5,
      problem: 20,
      solution: 30,
    },
    patterns: {
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'],
      tag: /^[a-zA-Z0-9-_]+$/,
    },
  };
  
  return new ValidationService(config);
};

const createValidKBEntry = () => ({
  title: 'VSAM Status 35 Error Resolution',
  problem: 'Job fails with VSAM status code 35 when trying to open a dataset. This usually indicates the file was not found or is not properly cataloged.',
  solution: '1. Verify dataset exists using LISTCAT\n2. Check JCL DD statement for correct DSN\n3. Ensure file is cataloged\n4. Verify RACF permissions\n5. Check if file was deleted',
  category: 'VSAM' as const,
  tags: ['vsam', 'status-35', 'file-not-found'],
});

describe('Form Integration Tests', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = createMockValidationService();
    jest.clearAllMocks();
  });

  describe('Complete Form Workflow', () => {
    it('should complete the entire create workflow successfully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      const mockOnCancel = jest.fn();

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Step 1: Fill in title
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'VSAM Status 35 Error');
      expect(titleInput).toHaveValue('VSAM Status 35 Error');

      // Step 2: Fill in problem description
      const problemInput = screen.getByLabelText(/problem description/i);
      await user.type(problemInput, 'Job fails with VSAM status code 35 when trying to open dataset');
      expect(problemInput).toHaveValue('Job fails with VSAM status code 35 when trying to open dataset');

      // Step 3: Fill in solution
      const solutionInput = screen.getByLabelText(/solution/i);
      await user.type(solutionInput, 'Step 1: Check if dataset exists\nStep 2: Verify cataloging');
      expect(solutionInput).toHaveValue('Step 1: Check if dataset exists\nStep 2: Verify cataloging');

      // Step 4: Select category
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'VSAM');
      expect(categorySelect).toHaveValue('VSAM');

      // Step 5: Add tags
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'vsam');
      await user.keyboard('{Enter}');
      await user.type(tagInput, 'error');
      await user.keyboard('{Enter}');
      
      expect(screen.getByText('vsam')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();

      // Step 6: Submit form
      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      // Step 7: Verify submission
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'VSAM Status 35 Error',
          problem: 'Job fails with VSAM status code 35 when trying to open dataset',
          solution: 'Step 1: Check if dataset exists\nStep 2: Verify cataloging',
          category: 'VSAM',
          tags: ['vsam', 'error'],
        });
      });
    });

    it('should handle edit workflow with pre-populated data', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      const initialData = createValidKBEntry();

      render(
        <KBEntryForm 
          onSubmit={mockOnSubmit} 
          onCancel={jest.fn()} 
          mode="edit" 
          initialData={initialData}
        />
      );

      // Verify pre-populated data
      expect(screen.getByDisplayValue(initialData.title)).toBeInTheDocument();
      expect(screen.getByDisplayValue(initialData.problem)).toBeInTheDocument();
      expect(screen.getByDisplayValue(initialData.solution)).toBeInTheDocument();
      expect(screen.getByDisplayValue(initialData.category)).toBeInTheDocument();
      
      initialData.tags.forEach(tag => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });

      // Make edits
      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated VSAM Error Resolution');

      // Submit changes
      const submitButton = screen.getByText('Save Changes');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          ...initialData,
          title: 'Updated VSAM Error Resolution',
        });
      });
    });
  });

  describe('Validation Integration', () => {
    it('should prevent submission with invalid data and show appropriate errors', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Try to submit without filling required fields
      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Problem description is required')).toBeInTheDocument();
        expect(screen.getByText('Solution is required')).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();

      // Fill in title only
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Valid Title');

      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
        expect(screen.getByText('Problem description is required')).toBeInTheDocument();
        expect(screen.getByText('Solution is required')).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should clear validation errors as fields are filled', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      // Trigger validation errors
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      // Fill title and trigger validation again
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Valid Title');
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
      });
    });

    it('should validate with integration to ValidationService', async () => {
      const validEntry = createValidKBEntry();
      
      // Test validation directly
      const result = validationService.validateEntry(validEntry);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Test invalid entry
      const invalidEntry = {
        ...validEntry,
        title: '', // Invalid: empty title
        tags: ['invalid tag!'], // Invalid: special characters
      };

      const invalidResult = validationService.validateEntry(invalidEntry);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Async Operation Handling', () => {
    it('should handle slow submission gracefully', async () => {
      const user = userEvent.setup();
      const slowSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 500))
      );

      render(<KBEntryForm onSubmit={slowSubmit} onCancel={jest.fn()} />);

      // Fill form with valid data
      await user.type(screen.getByLabelText(/title/i), 'Valid Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Valid problem description');
      await user.type(screen.getByLabelText(/solution/i), 'Valid solution description');

      // Submit and check loading state
      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 1000 });

      expect(slowSubmit).toHaveBeenCalledTimes(1);
    });

    it('should handle submission errors gracefully', async () => {
      const user = userEvent.setup();
      const failingSubmit = jest.fn().mockRejectedValue(new Error('Network error'));

      render(<KBEntryForm onSubmit={failingSubmit} onCancel={jest.fn()} />);

      // Fill form with valid data
      await user.type(screen.getByLabelText(/title/i), 'Valid Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Valid problem description');
      await user.type(screen.getByLabelText(/solution/i), 'Valid solution description');

      // Submit and wait for error
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      });

      // Form should be back to normal state
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeEnabled();
      expect(screen.getByText('Add Entry')).toBeEnabled();
    });

    it('should handle network timeouts', async () => {
      const user = userEvent.setup();
      const timeoutSubmit = jest.fn().mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      render(<KBEntryForm onSubmit={timeoutSubmit} onCancel={jest.fn()} />);

      // Fill and submit
      await user.type(screen.getByLabelText(/title/i), 'Valid Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Valid problem description');
      await user.type(screen.getByLabelText(/solution/i), 'Valid solution description');

      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save entry. Please try again.')).toBeInTheDocument();
      }, { timeout: 500 });
    });
  });

  describe('User Experience Flows', () => {
    it('should maintain form state during validation cycles', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      // Fill partial form data
      await user.type(screen.getByLabelText(/title/i), 'Partial Title');
      await user.selectOptions(screen.getByLabelText(/category/i), 'DB2');
      
      // Add a tag
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'db2');
      await user.keyboard('{Enter}');

      // Try to submit (should fail validation)
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Problem description is required')).toBeInTheDocument();
      });

      // Verify form state is maintained
      expect(screen.getByDisplayValue('Partial Title')).toBeInTheDocument();
      expect(screen.getByDisplayValue('DB2')).toBeInTheDocument();
      expect(screen.getByText('db2')).toBeInTheDocument();
    });

    it('should handle rapid user interactions', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Rapid typing
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Quick Title', { delay: 1 });

      const problemInput = screen.getByLabelText(/problem description/i);
      await user.type(problemInput, 'Quick problem description', { delay: 1 });

      const solutionInput = screen.getByLabelText(/solution/i);
      await user.type(solutionInput, 'Quick solution description', { delay: 1 });

      // Rapid tag additions
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'tag1{Enter}tag2{Enter}tag3{Enter}', { delay: 1 });

      // Verify all interactions worked
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
    });

    it('should handle copy-paste operations', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const longText = 'This is a very long problem description that might be copied from documentation or another source. It contains multiple sentences and should be handled properly by the form.';

      const problemInput = screen.getByLabelText(/problem description/i);
      
      // Simulate paste operation
      await user.click(problemInput);
      await user.keyboard(`{Control>}a{/Control}`);
      await user.keyboard(longText);

      expect(problemInput).toHaveValue(longText);
    });
  });

  describe('Tag Management Integration', () => {
    it('should handle complex tag operations', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const tagInput = screen.getByLabelText(/tags/i);

      // Add multiple tags
      await user.type(tagInput, 'first-tag');
      await user.keyboard('{Enter}');
      await user.type(tagInput, 'second-tag');
      await user.keyboard('{Enter}');
      await user.type(tagInput, 'third-tag');
      await user.keyboard('{Enter}');

      // Verify tags are added
      expect(screen.getByText('first-tag')).toBeInTheDocument();
      expect(screen.getByText('second-tag')).toBeInTheDocument();
      expect(screen.getByText('third-tag')).toBeInTheDocument();

      // Remove middle tag
      const removeSecond = screen.getByLabelText('Remove second-tag');
      await user.click(removeSecond);

      // Verify removal
      expect(screen.queryByText('second-tag')).not.toBeInTheDocument();
      expect(screen.getByText('first-tag')).toBeInTheDocument();
      expect(screen.getByText('third-tag')).toBeInTheDocument();

      // Try to add duplicate
      await user.type(tagInput, 'first-tag');
      await user.keyboard('{Enter}');

      // Should not add duplicate
      const firstTagElements = screen.getAllByText('first-tag');
      expect(firstTagElements).toHaveLength(1);
    });

    it('should handle tag input edge cases', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      const tagInput = screen.getByLabelText(/tags/i);

      // Try to add empty tag
      await user.keyboard('{Enter}');
      expect(tagInput).toHaveValue('');

      // Try to add whitespace-only tag
      await user.type(tagInput, '   ');
      await user.keyboard('{Enter}');
      expect(tagInput).toHaveValue('');

      // Add tag with leading/trailing whitespace
      await user.type(tagInput, '  valid-tag  ');
      await user.keyboard('{Enter}');
      expect(screen.getByText('valid-tag')).toBeInTheDocument();
      expect(tagInput).toHaveValue('');
    });
  });

  describe('Form Reset and Cancel', () => {
    it('should handle cancel operation', async () => {
      const user = userEvent.setup();
      const mockOnCancel = jest.fn();

      render(<KBEntryForm onSubmit={jest.fn()} onCancel={mockOnCancel} />);

      // Fill some form data
      await user.type(screen.getByLabelText(/title/i), 'Some Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Some problem');

      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should not submit when cancel is clicked', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      const mockOnCancel = jest.fn();

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation Integration', () => {
    it('should support full keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm onSubmit={jest.fn()} onCancel={jest.fn()} />);

      // Start from title
      const titleInput = screen.getByLabelText(/title/i);
      titleInput.focus();
      expect(titleInput).toHaveFocus();

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

    it('should handle Enter key in different contexts', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Enter in tag input should add tag, not submit form
      const tagInput = screen.getByLabelText(/tags/i);
      await user.type(tagInput, 'test-tag');
      await user.keyboard('{Enter}');

      expect(screen.getByText('test-tag')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();

      // Enter in other inputs should not submit if validation fails
      const titleInput = screen.getByLabelText(/title/i);
      titleInput.focus();
      await user.keyboard('{Enter}');
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large form data efficiently', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

      // Fill with large data
      const largeText = 'A'.repeat(1000);
      
      await user.type(screen.getByLabelText(/title/i), 'Large Data Test');
      await user.type(screen.getByLabelText(/problem description/i), largeText, { delay: 1 });
      await user.type(screen.getByLabelText(/solution/i), largeText, { delay: 1 });

      // Add many tags quickly
      const tagInput = screen.getByLabelText(/tags/i);
      for (let i = 0; i < 10; i++) {
        await user.type(tagInput, `tag${i}{Enter}`, { delay: 1 });
      }

      // Submit should still work
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });
});