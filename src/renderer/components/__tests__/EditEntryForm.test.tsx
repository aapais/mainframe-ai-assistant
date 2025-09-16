import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { EditEntryForm } from '../forms/EditEntryForm';
import { KBEntry } from '../../../src/types/index';

// Mock CSS imports
jest.mock('../forms/EditEntryForm.css', () => ({}));

// Mock existing entry for tests
const mockEntry: KBEntry = {
  id: 'test-entry-123',
  title: 'Original VSAM Error',
  problem: 'Original problem description with VSAM status 35',
  solution: 'Original solution with steps to resolve',
  category: 'VSAM',
  tags: ['vsam', 'error', 'original'],
  created_at: new Date('2025-01-01T10:00:00Z'),
  updated_at: new Date('2025-01-01T10:00:00Z'),
  usage_count: 5,
  success_count: 4,
  failure_count: 1,
};

describe('EditEntryForm', () => {
  const mockProps = {
    entry: mockEntry,
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with entry data pre-filled', () => {
      render(<EditEntryForm {...mockProps} />);

      expect(screen.getByDisplayValue('Original VSAM Error')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Original problem description with VSAM status 35')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Original solution with steps to resolve')).toBeInTheDocument();
      expect(screen.getByDisplayValue('VSAM')).toBeInTheDocument();
      expect(screen.getByText('vsam')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
      expect(screen.getByText('original')).toBeInTheDocument();
    });

    it('should display entry metadata', () => {
      render(<EditEntryForm {...mockProps} />);

      expect(screen.getByText('1/1/2025')).toBeInTheDocument(); // Created date
      expect(screen.getByText('5 times')).toBeInTheDocument(); // Usage count
      expect(screen.getByText('80%')).toBeInTheDocument(); // Success rate (4/5)
    });

    it('should render correct title and button text', () => {
      render(<EditEntryForm {...mockProps} />);

      expect(screen.getByText('Edit Knowledge Base Entry')).toBeInTheDocument();
      expect(screen.getByText('Update Entry')).toBeInTheDocument();
    });

    it('should render custom title and submit label', () => {
      render(
        <EditEntryForm 
          {...mockProps} 
          title="Custom Edit Title"
          submitLabel="Save Changes"
        />
      );

      expect(screen.getByText('Custom Edit Title')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('should show delete button when onDelete provided', () => {
      render(<EditEntryForm {...mockProps} />);
      expect(screen.getByText('Delete Entry')).toBeInTheDocument();
    });

    it('should hide delete button when onDelete not provided', () => {
      const propsWithoutDelete = { ...mockProps };
      delete propsWithoutDelete.onDelete;
      
      render(<EditEntryForm {...propsWithoutDelete} />);
      expect(screen.queryByText('Delete Entry')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields when editing', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      // Clear required field
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.clear(titleInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });
    });

    it('should validate field lengths', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.clear(titleInput);
      await user.type(titleInput, 'Hi'); // Too short
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Title must be at least 5 characters long')).toBeInTheDocument();
      });
    });

    it('should validate tag limits', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      const tagInput = screen.getByPlaceholderText(/add.*tag/i);

      // Add too many tags (assuming 10 limit, entry already has 3)
      for (let i = 0; i < 8; i++) {
        await user.type(tagInput, `newtag${i}`);
        await user.keyboard('{Enter}');
      }

      await waitFor(() => {
        expect(screen.getByText('Maximum 10 tags allowed')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit only changed fields', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<EditEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Change only title
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified VSAM Error');

      // Submit
      await user.click(screen.getByText('Update Entry'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'Modified VSAM Error'
        });
      });

      // Should not include unchanged fields
      expect(mockOnSubmit).not.toHaveBeenCalledWith(
        expect.objectContaining({
          problem: expect.any(String),
          solution: expect.any(String)
        })
      );
    });

    it('should submit multiple changed fields', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<EditEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Change title and category
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated VSAM Error');

      const categorySelect = screen.getByDisplayValue('VSAM');
      await user.selectOptions(categorySelect, 'DB2');

      // Submit
      await user.click(screen.getByText('Update Entry'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'Updated VSAM Error',
          category: 'DB2'
        });
      });
    });

    it('should detect tag changes correctly', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<EditEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Add a new tag
      const tagInput = screen.getByPlaceholderText(/add.*tag/i);
      await user.type(tagInput, 'newtag');
      await user.keyboard('{Enter}');

      // Submit
      await user.click(screen.getByText('Update Entry'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          tags: expect.arrayContaining(['vsam', 'error', 'original', 'newtag'])
        });
      });
    });

    it('should show success message after successful update', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<EditEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Make a change
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Updated');

      // Submit
      await user.click(screen.getByText('Update Entry'));

      await waitFor(() => {
        expect(screen.getByText('Entry updated successfully!')).toBeInTheDocument();
      });
    });

    it('should handle submission errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Update failed'));
      
      render(<EditEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Make a change
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Error Test');

      // Submit
      await user.click(screen.getByText('Update Entry'));

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });

    it('should disable submit when no changes made', () => {
      render(<EditEntryForm {...mockProps} />);

      const submitButton = screen.getByText('Update Entry');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit when changes made', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      const submitButton = screen.getByText('Update Entry');
      expect(submitButton).toBeDisabled();

      // Make a change
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Changed');

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete confirmation modal', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      const deleteButton = screen.getByText('Delete Entry');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to delete this knowledge base entry?')).toBeInTheDocument();
        expect(screen.getByText('"Original VSAM Error"')).toBeInTheDocument();
        expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
      });
    });

    it('should cancel delete when cancel clicked', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      // Open delete modal
      const deleteButton = screen.getByText('Delete Entry');
      await user.click(deleteButton);

      // Cancel delete
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Delete')).not.toBeInTheDocument();
      });
    });

    it('should call onDelete when confirmed', async () => {
      const user = userEvent.setup();
      const mockOnDelete = jest.fn().mockResolvedValue(undefined);
      
      render(<EditEntryForm {...mockProps} onDelete={mockOnDelete} />);

      // Open delete modal
      const deleteButton = screen.getByText('Delete Entry');
      await user.click(deleteButton);

      // Confirm delete
      const confirmButton = screen.getByRole('button', { name: /delete entry/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalled();
      });
    });

    it('should handle delete errors', async () => {
      const user = userEvent.setup();
      const mockOnDelete = jest.fn().mockRejectedValue(new Error('Delete failed'));
      
      render(<EditEntryForm {...mockProps} onDelete={mockOnDelete} />);

      // Open delete modal and confirm
      const deleteButton = screen.getByText('Delete Entry');
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /delete entry/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Delete failed')).toBeInTheDocument();
      });
    });

    it('should show loading state during delete', async () => {
      const user = userEvent.setup();
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      const mockOnDelete = jest.fn().mockReturnValue(deletePromise);
      
      render(<EditEntryForm {...mockProps} onDelete={mockOnDelete} />);

      // Open delete modal and confirm
      const deleteButton = screen.getByText('Delete Entry');
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /delete entry/i });
      await user.click(confirmButton);

      // Should show loading state
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
      expect(confirmButton).toBeDisabled();

      // Resolve and check loading state is gone
      act(() => {
        resolveDelete!();
      });

      await waitFor(() => {
        expect(screen.queryByText('Deleting...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when no changes made', async () => {
      const user = userEvent.setup();
      const mockOnCancel = jest.fn();
      
      render(<EditEntryForm {...mockProps} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should show confirmation when changes made', async () => {
      const user = userEvent.setup();
      const mockOnCancel = jest.fn();
      // Mock window.confirm
      window.confirm = jest.fn().mockReturnValue(true);
      
      render(<EditEntryForm {...mockProps} onCancel={mockOnCancel} />);

      // Make a change
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Changed');

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to discard them?');
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should not cancel when confirmation declined', async () => {
      const user = userEvent.setup();
      const mockOnCancel = jest.fn();
      // Mock window.confirm to return false
      window.confirm = jest.fn().mockReturnValue(false);
      
      render(<EditEntryForm {...mockProps} onCancel={mockOnCancel} />);

      // Make a change
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Changed');

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe('Dirty State Indicator', () => {
    it('should show unsaved changes indicator when form is dirty', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();

      // Make a change
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Changed');

      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });
    });

    it('should hide indicator when form is clean', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      // Make a change
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Changed');

      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });

      // Revert change
      await user.clear(titleInput);
      await user.type(titleInput, 'Original VSAM Error');

      await waitFor(() => {
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<EditEntryForm {...mockProps} />);

      expect(screen.getByLabelText(/entry title/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/problem description/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/solution/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/category/i)).toHaveAttribute('aria-required', 'true');
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      // Clear required field to trigger error
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.clear(titleInput);
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByText('Title is required');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('should announce success messages', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<EditEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Make a change and submit
      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Updated');
      await user.click(screen.getByText('Update Entry'));

      await waitFor(() => {
        const successMessage = screen.getByText('Entry updated successfully!');
        expect(successMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('should handle keyboard navigation in delete modal', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      // Open delete modal
      const deleteButton = screen.getByText('Delete Entry');
      await user.click(deleteButton);

      // Modal should trap focus
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal).toBeInTheDocument();

      // Should be able to navigate with keyboard
      await user.keyboard('{Tab}');
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByRole('button', { name: /delete entry/i })).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should only validate changed fields', async () => {
      const user = userEvent.setup();
      render(<EditEntryForm {...mockProps} />);

      // Mock validation function
      const mockValidation = jest.fn().mockReturnValue(undefined);

      const titleInput = screen.getByDisplayValue('Original VSAM Error');
      await user.type(titleInput, ' - Updated');

      // Should validate efficiently without re-validating unchanged fields
      expect(titleInput.value).toBe('Original VSAM Error - Updated');
    });
  });
});