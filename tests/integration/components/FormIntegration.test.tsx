/**
 * Form Integration Tests
 * Testing interactions between multiple form components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KBEntryForm } from '../../../implementation/frontend/components/forms/KBEntryForm';
import { EditEntryForm } from '../../../implementation/frontend/components/forms/EditEntryForm';
import { mockElectronAPI } from '../../../src/renderer/components/__tests__/setup';

describe('Form Integration Tests', () => {
  const mockKBEntry = {
    id: 'test-entry-123',
    title: 'VSAM Status 35 Error',
    problem: 'Job fails with VSAM status 35 when trying to open file',
    solution: 'Verify dataset exists using LISTCAT and check catalog entries',
    category: 'VSAM' as const,
    tags: ['vsam', 'status-35', 'catalog'],
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    usage_count: 5,
    success_count: 4,
    failure_count: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.validateKBEntry.mockResolvedValue({ valid: true });
    mockElectronAPI.searchSimilarEntries.mockResolvedValue([]);
    mockElectronAPI.addKBEntry.mockResolvedValue({ id: 'new-entry-123', success: true });
    mockElectronAPI.updateKBEntry.mockResolvedValue({ success: true });
    mockElectronAPI.deleteKBEntry.mockResolvedValue({ success: true });
  });

  describe('Create -> Edit Workflow', () => {
    it('creates entry and transitions to edit mode', async () => {
      const user = userEvent.setup();
      let createdEntry: any = null;
      
      const mockOnSubmit = jest.fn().mockImplementation((data) => {
        createdEntry = { ...data, id: 'new-entry-123' };
        return Promise.resolve();
      });

      const { rerender } = render(
        <KBEntryForm onSubmit={mockOnSubmit} />
      );

      // Fill in create form
      await user.type(screen.getByRole('textbox', { name: /entry title/i }), mockKBEntry.title);
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), mockKBEntry.category);
      await user.type(screen.getByRole('textbox', { name: /problem description/i }), mockKBEntry.problem);
      await user.type(screen.getByRole('textbox', { name: /solution/i }), mockKBEntry.solution);
      await user.type(screen.getByRole('textbox', { name: /tags/i }), mockKBEntry.tags.join(','));

      // Submit create form
      await user.click(screen.getByRole('button', { name: /create entry/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      // Simulate transition to edit mode with created entry
      const mockOnUpdate = jest.fn().mockResolvedValue(undefined);
      const mockOnDelete = jest.fn().mockResolvedValue(undefined);

      rerender(
        <EditEntryForm
          entry={createdEntry}
          onSubmit={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      );

      // Verify edit form is populated with created data
      expect(screen.getByDisplayValue(mockKBEntry.title)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockKBEntry.problem)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockKBEntry.solution)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update entry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete entry/i })).toBeInTheDocument();
    });
  });

  describe('Form Field Interactions', () => {
    it('updates form validity when multiple fields change', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /create entry/i });
      expect(submitButton).toBeDisabled(); // Initially disabled

      // Add title - form still invalid
      await user.type(screen.getByRole('textbox', { name: /entry title/i }), 'Valid Title');
      expect(submitButton).toBeDisabled();

      // Add category - form still invalid
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'VSAM');
      expect(submitButton).toBeDisabled();

      // Add problem - form still invalid
      await user.type(screen.getByRole('textbox', { name: /problem description/i }), 'This is a detailed problem description that meets minimum requirements');
      expect(submitButton).toBeDisabled();

      // Add solution - form should now be valid
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'This is a detailed solution that meets minimum requirements');
      
      await waitFor(() => {
        expect(submitButton).toBeEnabled();
      });
    });

    it('validates interdependent fields correctly', async () => {
      const user = userEvent.setup();
      const customValidationRules = {
        problem: {
          required: true,
          minLength: 20,
        },
        solution: {
          required: true,
          minLength: 20,
          custom: (value: string, formData: any) => {
            if (formData.problem && value && value.length < formData.problem.length) {
              return 'Solution should be at least as detailed as the problem';
            }
            return undefined;
          },
        },
      };

      const mockOnSubmit = jest.fn();
      
      render(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          initialData={{
            title: 'Test Entry',
            category: 'VSAM' as const,
            tags: [],
          }}
        />
      );

      // Add a long problem description
      const longProblem = 'This is a very detailed and comprehensive problem description that explains the issue in great detail with multiple aspects covered';
      await user.type(screen.getByRole('textbox', { name: /problem description/i }), longProblem);

      // Add a short solution
      const shortSolution = 'Short solution here';
      await user.type(screen.getByRole('textbox', { name: /solution/i }), shortSolution);

      // Submit form to trigger validation
      await user.click(screen.getByRole('button', { name: /create entry/i }));

      // Should show custom validation error
      await waitFor(() => {
        expect(screen.getByText(/solution should be at least as detailed as the problem/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('handles validation errors from multiple sources', async () => {
      const user = userEvent.setup();
      
      // Mock validation failure from server
      mockElectronAPI.validateKBEntry.mockResolvedValue({
        valid: false,
        errors: {
          title: 'Title already exists',
          solution: 'Solution too generic',
        },
      });

      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill form with data that passes client validation
      await user.type(screen.getByRole('textbox', { name: /entry title/i }), 'Existing Title');
      await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'VSAM');
      await user.type(screen.getByRole('textbox', { name: /problem description/i }), 'Valid problem description here');
      await user.type(screen.getByRole('textbox', { name: /solution/i }), 'Generic solution');

      await user.click(screen.getByRole('button', { name: /create entry/i }));

      // Should show both client and server validation errors
      await waitFor(() => {
        expect(screen.getByText(/title already exists/i)).toBeInTheDocument();
        expect(screen.getByText(/solution too generic/i)).toBeInTheDocument();
      });

      // Form should remain in error state
      expect(screen.getByRole('button', { name: /create entry/i })).toBeDisabled();
    });

    it('recovers from errors when fields are corrected', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Add invalid data
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      await user.type(titleField, 'ab'); // Too short
      fireEvent.blur(titleField);

      await waitFor(() => {
        expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
      });

      // Correct the data
      await user.clear(titleField);
      await user.type(titleField, 'Valid Title');
      fireEvent.blur(titleField);

      await waitFor(() => {
        expect(screen.queryByText(/title must be at least 5 characters/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    it('maintains dirty state across field changes', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          initialData={mockKBEntry}
        />
      );

      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Form should not be dirty initially
      expect(screen.queryByText(/•/)).not.toBeInTheDocument(); // Dirty indicator

      // Change field value
      await user.clear(titleField);
      await user.type(titleField, 'Modified Title');

      // Form should be dirty now
      await waitFor(() => {
        expect(screen.getByText(/•/)).toBeInTheDocument(); // Dirty indicator appears
      });

      // Revert to original value
      await user.clear(titleField);
      await user.type(titleField, mockKBEntry.title);

      // Form should no longer be dirty
      await waitFor(() => {
        expect(screen.queryByText(/•/)).not.toBeInTheDocument();
      });
    });

    it('tracks touched state for validation timing', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Add invalid data but don't blur yet
      await user.type(titleField, 'ab'); // Too short
      
      // Should not show error until field is touched (blurred)
      expect(screen.queryByText(/title must be at least 5 characters/i)).not.toBeInTheDocument();
      
      // Blur field to mark as touched
      fireEvent.blur(titleField);
      
      // Now error should appear
      await waitFor(() => {
        expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Integration', () => {
    it('handles rapid field updates efficiently', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      const startTime = performance.now();
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Simulate rapid typing
      for (let i = 0; i < 20; i++) {
        await user.type(titleField, `${i}`);
      }
      
      const endTime = performance.now();
      
      // Should handle rapid updates efficiently
      expect(endTime - startTime).toHavePerformanceBetterThan(1000);
    });

    it('debounces validation during rapid changes', async () => {
      const user = userEvent.setup();
      const mockValidation = jest.fn().mockResolvedValue({ valid: true });
      mockElectronAPI.validateKBEntry = mockValidation;
      
      const mockOnSubmit = jest.fn();
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);
      
      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Type rapidly
      await user.type(titleField, 'Rapid typing test');
      
      // Validation should be debounced, not called for each character
      await waitFor(() => {
        expect(mockValidation).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Accessibility Integration', () => {
    it('manages focus flow correctly through form', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      const categoryField = screen.getByRole('combobox', { name: /category/i });
      const problemField = screen.getByRole('textbox', { name: /problem description/i });

      // Start with title field
      titleField.focus();
      expect(titleField).toHaveFocus();

      // Tab to next field
      await user.tab();
      expect(categoryField).toHaveFocus();

      // Tab to next field
      await user.tab();
      expect(problemField).toHaveFocus();
    });

    it('announces errors to screen readers properly', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Save failed'));
      
      render(<KBEntryForm onSubmit={mockOnSubmit} initialData={mockKBEntry} />);

      await user.click(screen.getByRole('button', { name: /create entry/i }));

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent(/save failed/i);
      });
    });

    it('provides proper ARIA labels for dynamic content', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByRole('textbox', { name: /entry title/i });
      
      // Add invalid data
      await user.type(titleField, 'ab');
      fireEvent.blur(titleField);

      await waitFor(() => {
        expect(titleField).toHaveAttribute('aria-invalid', 'true');
        expect(titleField).toHaveAttribute('aria-describedby');
      });
    });
  });
});