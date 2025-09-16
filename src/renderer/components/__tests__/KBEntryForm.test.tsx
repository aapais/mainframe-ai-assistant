import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { KBEntryForm } from '../forms/KBEntryForm';

// Mock CSS imports
jest.mock('../forms/KBEntryForm.css', () => ({}));
jest.mock('../common/FormField.css', () => ({}));

// Mock Electron API
const mockElectronAPI = {
  addKBEntry: jest.fn(),
  updateKBEntry: jest.fn(),
  validateKBEntry: jest.fn(),
  searchSimilarEntries: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
});

describe('KBEntryForm', () => {
  const mockProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.addKBEntry.mockResolvedValue({ id: 'test-123', success: true });
    mockElectronAPI.validateKBEntry.mockResolvedValue({ valid: true });
    mockElectronAPI.searchSimilarEntries.mockResolvedValue([]);
  });

  afterEach(() => {
    // Clean up localStorage
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Basic Rendering', () => {
    it('should render all required form fields', () => {
      render(<KBEntryForm {...mockProps} />);

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/problem description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/solution/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    });

    it('should render with correct initial mode', () => {
      render(<KBEntryForm {...mockProps} mode="create" />);
      expect(screen.getByText('Add Knowledge Base Entry')).toBeInTheDocument();
      expect(screen.getByText('Add Entry')).toBeInTheDocument();
    });

    it('should render with edit mode correctly', () => {
      const initialData = {
        title: 'Existing Entry',
        problem: 'Existing problem',
        solution: 'Existing solution',
        category: 'VSAM',
        tags: ['existing', 'test'],
      };

      render(<KBEntryForm {...mockProps} mode="edit" initialData={initialData} />);
      
      expect(screen.getByDisplayValue('Existing Entry')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing problem')).toBeInTheDocument();
      expect(screen.getByDisplayValue('VSAM')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Problem description is required')).toBeInTheDocument();
        expect(screen.getByText('Solution is required')).toBeInTheDocument();
        expect(screen.getByText('Category is required')).toBeInTheDocument();
      });
    });

    it('should validate title length constraints', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      
      // Test minimum length
      await user.type(titleInput, 'Hi');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Title must be at least 5 characters long')).toBeInTheDocument();
      });

      // Test maximum length
      await user.clear(titleInput);
      const longTitle = 'a'.repeat(201);
      await user.type(titleInput, longTitle);
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Title must be less than 200 characters')).toBeInTheDocument();
      });
    });

    it('should validate problem description length', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const problemInput = screen.getByLabelText(/problem description/i);
      
      // Test minimum length
      await user.type(problemInput, 'Short');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Problem description must be at least 20 characters long')).toBeInTheDocument();
      });
    });

    it('should validate solution length', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const solutionInput = screen.getByLabelText(/solution/i);
      
      // Test minimum length
      await user.type(solutionInput, 'Too short');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Solution must be at least 20 characters long')).toBeInTheDocument();
      });
    });

    it('should validate tags properly', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const tagInput = screen.getByPlaceholderText(/add.*tag/i);
      
      // Add too many tags
      for (let i = 0; i < 12; i++) {
        await user.type(tagInput, `tag${i}`);
        await user.keyboard('{Enter}');
      }
      
      await waitFor(() => {
        expect(screen.getByText('Maximum 10 tags allowed')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    const validFormData = {
      title: 'VSAM Status 35 Error',
      problem: 'Job fails with VSAM status code 35 when trying to access dataset',
      solution: 'Check if dataset exists and is properly cataloged. Verify RACF permissions.',
      category: 'VSAM',
      tags: ['vsam', 'error', 'dataset'],
    };

    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<KBEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Fill form
      await user.type(screen.getByLabelText(/title/i), validFormData.title);
      await user.type(screen.getByLabelText(/problem description/i), validFormData.problem);
      await user.type(screen.getByLabelText(/solution/i), validFormData.solution);
      await user.selectOptions(screen.getByLabelText(/category/i), validFormData.category);
      
      // Add tags
      const tagInput = screen.getByPlaceholderText(/add.*tag/i);
      for (const tag of validFormData.tags) {
        await user.type(tagInput, tag);
        await user.keyboard('{Enter}');
      }

      // Submit
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: validFormData.title,
            problem: validFormData.problem,
            solution: validFormData.solution,
            category: validFormData.category,
            tags: validFormData.tags,
          })
        );
      });
    });

    it('should handle submission errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Server error'));
      
      render(<KBEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Fill minimum valid form
      await user.type(screen.getByLabelText(/title/i), 'Test Title Error');
      await user.type(screen.getByLabelText(/problem description/i), 'Test problem description here');
      await user.type(screen.getByLabelText(/solution/i), 'Test solution description here');
      await user.selectOptions(screen.getByLabelText(/category/i), 'Other');

      // Submit
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      // Form should still contain data after error
      expect(screen.getByDisplayValue('Test Title Error')).toBeInTheDocument();
    });

    it('should show success message after successful submission', async () => {
      const user = userEvent.setup();
      
      render(<KBEntryForm {...mockProps} />);

      // Fill minimum valid form
      await user.type(screen.getByLabelText(/title/i), 'Success Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Success test problem description here');
      await user.type(screen.getByLabelText(/solution/i), 'Success test solution description here');
      await user.selectOptions(screen.getByLabelText(/category/i), 'JCL');

      // Submit
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Knowledge base entry added successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-save Functionality', () => {
    it('should auto-save form data when enabled', async () => {
      const user = userEvent.setup();
      const mockOnAutoSave = jest.fn();
      
      render(
        <KBEntryForm 
          {...mockProps} 
          autoSave={true}
          autoSaveDelay={100}
          onAutoSave={mockOnAutoSave}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Auto-save test');

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(mockOnAutoSave).toHaveBeenCalled();
    });

    it('should save to localStorage when drafts enabled', async () => {
      const user = userEvent.setup();
      
      render(
        <KBEntryForm 
          {...mockProps} 
          enableDrafts={true}
          draftKey="test-draft"
        />
      );

      await user.type(screen.getByLabelText(/title/i), 'Draft test');
      await user.type(screen.getByLabelText(/problem description/i), 'Draft problem description');

      // Wait for draft save
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const savedDraft = localStorage.getItem('kb-form-draft-test-draft');
      expect(savedDraft).toBeTruthy();
      
      const parsedDraft = JSON.parse(savedDraft!);
      expect(parsedDraft.title).toBe('Draft test');
      expect(parsedDraft.problem).toBe('Draft problem description');
    });

    it('should restore draft data on mount', () => {
      const draftData = {
        title: 'Restored Draft',
        problem: 'Restored problem',
        solution: 'Restored solution',
        category: 'DB2',
        tags: ['restored'],
      };

      localStorage.setItem('kb-form-draft-restore-test', JSON.stringify({
        data: draftData,
        timestamp: Date.now(),
      }));

      render(
        <KBEntryForm 
          {...mockProps} 
          enableDrafts={true}
          draftKey="restore-test"
        />
      );

      expect(screen.getByDisplayValue('Restored Draft')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Restored problem')).toBeInTheDocument();
      expect(screen.getByDisplayValue('DB2')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<KBEntryForm {...mockProps} />);

      expect(screen.getByLabelText(/title/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/problem description/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/solution/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/category/i)).toHaveAttribute('aria-required', 'true');
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const submitButton = screen.getByText('Add Entry');
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText('Title is required');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      titleInput.focus();
      
      expect(titleInput).toHaveFocus();

      // Tab through fields
      await user.tab();
      expect(screen.getByLabelText(/problem description/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/solution/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/category/i)).toHaveFocus();
    });

    it('should support keyboard shortcuts', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<KBEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Fill minimum valid form
      await user.type(screen.getByLabelText(/title/i), 'Keyboard Test Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Keyboard test problem description');
      await user.type(screen.getByLabelText(/solution/i), 'Keyboard test solution description');
      await user.selectOptions(screen.getByLabelText(/category/i), 'Other');

      // Use Ctrl+Enter to submit
      await user.keyboard('{Control>}{Enter}{/Control}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Advanced Features', () => {
    it('should show advanced options when enabled', () => {
      render(<KBEntryForm {...mockProps} showAdvancedOptions={true} />);

      expect(screen.getByText('Advanced Options')).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/environment/i)).toBeInTheDocument();
    });

    it('should validate similar entries and show warnings', async () => {
      const user = userEvent.setup();
      
      mockElectronAPI.searchSimilarEntries.mockResolvedValue([
        {
          id: 'similar-1',
          title: 'Similar VSAM Error',
          similarity: 0.85,
        }
      ]);

      render(<KBEntryForm {...mockProps} />);

      await user.type(screen.getByLabelText(/title/i), 'VSAM Error Test');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/similar entries found/i)).toBeInTheDocument();
        expect(screen.getByText('Similar VSAM Error')).toBeInTheDocument();
      });
    });

    it('should handle character counting correctly', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test Title');

      // Should show character count
      expect(screen.getByText('10 / 200')).toBeInTheDocument();
    });

    it('should disable submit button when form is invalid', async () => {
      const user = userEvent.setup();
      render(<KBEntryForm {...mockProps} />);

      const submitButton = screen.getByText('Add Entry');
      expect(submitButton).toBeDisabled();

      // Fill only title (form still invalid)
      await user.type(screen.getByLabelText(/title/i), 'Valid Title Here');
      expect(submitButton).toBeDisabled();

      // Fill all required fields
      await user.type(screen.getByLabelText(/problem description/i), 'Valid problem description here');
      await user.type(screen.getByLabelText(/solution/i), 'Valid solution description here');
      await user.selectOptions(screen.getByLabelText(/category/i), 'VSAM');

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Network error'));
      
      render(<KBEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Fill form
      await user.type(screen.getByLabelText(/title/i), 'Network Error Test');
      await user.type(screen.getByLabelText(/problem description/i), 'Network error problem description');
      await user.type(screen.getByLabelText(/solution/i), 'Network error solution description');
      await user.selectOptions(screen.getByLabelText(/category/i), 'Other');

      // Submit
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should handle validation errors from server', async () => {
      const user = userEvent.setup();
      const serverError = {
        field: 'title',
        message: 'Title already exists',
      };
      
      const mockOnSubmit = jest.fn().mockRejectedValue({
        validationErrors: [serverError]
      });
      
      render(<KBEntryForm {...mockProps} onSubmit={mockOnSubmit} />);

      // Fill form
      await user.type(screen.getByLabelText(/title/i), 'Duplicate Title');
      await user.type(screen.getByLabelText(/problem description/i), 'Duplicate problem description');
      await user.type(screen.getByLabelText(/solution/i), 'Duplicate solution description');
      await user.selectOptions(screen.getByLabelText(/category/i), 'JCL');

      // Submit
      await user.click(screen.getByText('Add Entry'));

      await waitFor(() => {
        expect(screen.getByText('Title already exists')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should debounce validation calls', async () => {
      const user = userEvent.setup();
      const mockValidate = jest.fn().mockResolvedValue({ valid: true });
      mockElectronAPI.validateKBEntry = mockValidate;

      render(<KBEntryForm {...mockProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      
      // Type quickly
      await user.type(titleInput, 'Quick typing test');

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      // Should only call validation once after debounce
      expect(mockValidate).toHaveBeenCalledTimes(1);
    });
  });
});