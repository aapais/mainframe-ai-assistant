/**
 * Integration tests for complete form workflows
 * Tests real-world scenarios and user interactions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KBEntryForm } from '../../implementation/frontend/components/forms/KBEntryForm';
import { KBEntryFormData } from '../../implementation/frontend/types/FormTypes';

// Mock external dependencies
jest.mock('../../implementation/frontend/services/KnowledgeService', () => ({
  KnowledgeService: {
    validateTitle: jest.fn(),
    getSimilarEntries: jest.fn(),
    checkForDuplicates: jest.fn()
  }
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('Form Workflows Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Complete KB Entry Creation Workflow', () => {
    test('user creates a new KB entry from start to finish', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Step 1: User focuses on title field (should be auto-focused)
      const titleField = screen.getByLabelText(/entry title/i);
      expect(document.activeElement).toBe(titleField);

      // Step 2: User types title with real-time validation
      await user.type(titleField, 'VSAM Status 35 - File Not Found Error');

      // Verify no title errors
      await waitFor(() => {
        expect(screen.queryByText(/title must be at least/i)).not.toBeInTheDocument();
      });

      // Step 3: User navigates to category and selects
      const categoryField = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryField, 'VSAM');

      // Step 4: User fills problem description
      const problemField = screen.getByLabelText(/problem description/i);
      await user.type(problemField,
        'Job abends with VSAM return code 35. The program is unable to open the VSAM dataset. ' +
        'Error typically indicates that the dataset cannot be found or there is a catalog issue. ' +
        'This occurs during file open operations in batch jobs and online transactions.'
      );

      // Step 5: User fills solution with step-by-step instructions
      const solutionField = screen.getByLabelText(/solution/i);
      await user.type(solutionField,
        '1. Verify the dataset exists using ISPF 3.4 or LISTCAT command\n' +
        '2. Check the DD statement in JCL has the correct DSN parameter\n' +
        '3. Ensure the dataset is properly cataloged using LISTCAT ENT(dataset.name)\n' +
        '4. Verify RACF permissions using LISTDSD \'dataset.name\'\n' +
        '5. Check if the dataset was deleted or renamed by another job\n' +
        '6. Verify the correct high-level qualifier and naming conventions\n' +
        '7. If uncataloged, use UNIT and VOL parameters in DD statement'
      );

      // Step 6: User adds relevant tags
      const tagsField = screen.getByLabelText(/tags/i);
      await user.type(tagsField, 'vsam,status-35,file-not-found,catalog,open-error{enter}');

      // Step 7: Verify form is valid and submit button is enabled
      const submitButton = screen.getByRole('button', { name: /create entry/i });

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      // Step 8: User submits the form
      await user.click(submitButton);

      // Step 9: Verify submission with correct data structure
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'VSAM Status 35 - File Not Found Error',
          category: 'VSAM',
          problem: expect.stringContaining('Job abends with VSAM return code 35'),
          solution: expect.stringContaining('1. Verify the dataset exists'),
          tags: expect.arrayContaining(['vsam', 'status-35', 'file-not-found'])
        });
      });

      // Step 10: Verify success message is shown
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/entry created successfully/i);
      });

      // Step 11: Verify form is reset for next entry
      await waitFor(() => {
        expect(titleField).toHaveValue('');
        expect(problemField).toHaveValue('');
        expect(solutionField).toHaveValue('');
      });
    });

    test('user recovers from validation errors during entry creation', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // User tries to submit empty form
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      await user.click(submitButton);

      // Verify validation errors are shown
      await waitFor(() => {
        expect(screen.getByText(/title must be at least 5 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/problem description must be at least 20 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/solution must be at least 20 characters/i)).toBeInTheDocument();
      });

      // User corrects title
      const titleField = screen.getByLabelText(/entry title/i);
      await user.type(titleField, 'Valid Title Here');

      // Title error should disappear
      await waitFor(() => {
        expect(screen.queryByText(/title must be at least 5 characters/i)).not.toBeInTheDocument();
      });

      // User corrects other fields
      await user.type(screen.getByLabelText(/problem description/i),
        'This is a detailed problem description that meets the minimum length requirement for validation.');

      await user.type(screen.getByLabelText(/solution/i),
        'This is a comprehensive solution that provides step-by-step instructions to resolve the issue.');

      // All errors should be cleared and form should be valid
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
        expect(screen.queryByText(/must be at least/i)).not.toBeInTheDocument();
      });

      // Form should now submit successfully
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Edit Existing Entry Workflow', () => {
    const existingEntry: KBEntryFormData = {
      title: 'S0C7 Data Exception in COBOL Program',
      problem: 'Program abends with S0C7 data exception during arithmetic operations.',
      solution: 'Check for non-numeric data in numeric fields and initialize COMP-3 fields properly.',
      category: 'Batch',
      tags: ['s0c7', 'data-exception', 'cobol', 'abend']
    };

    test('user successfully edits an existing KB entry', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          initialData={existingEntry}
          isEdit={true}
          title="Edit KB Entry"
          submitLabel="Update Entry"
        />
      );

      // Verify existing data is populated
      expect(screen.getByDisplayValue(existingEntry.title)).toBeInTheDocument();
      expect(screen.getByDisplayValue(existingEntry.problem)).toBeInTheDocument();
      expect(screen.getByDisplayValue(existingEntry.solution)).toBeInTheDocument();

      // User makes modifications
      const titleField = screen.getByDisplayValue(existingEntry.title);
      await user.clear(titleField);
      await user.type(titleField, 'Updated: S0C7 Data Exception in COBOL Program');

      const problemField = screen.getByDisplayValue(existingEntry.problem);
      await user.clear(problemField);
      await user.type(problemField,
        'Program abends with S0C7 data exception during arithmetic operations. ' +
        'This typically occurs when numeric operations are performed on non-numeric data or ' +
        'when COMP-3 fields are not properly initialized with valid packed decimal data.'
      );

      // User updates the solution with more detailed steps
      const solutionField = screen.getByDisplayValue(existingEntry.solution);
      await user.clear(solutionField);
      await user.type(solutionField,
        '1. Check for non-numeric data in numeric fields using NUMERIC test\n' +
        '2. Initialize all COMP-3 fields properly in WORKING-STORAGE\n' +
        '3. Add data validation before arithmetic operations\n' +
        '4. Use NUMPROC(NOPFD) compiler option to catch issues\n' +
        '5. Add ON SIZE ERROR clauses to arithmetic statements\n' +
        '6. Review input data for invalid characters or formatting'
      );

      // Submit the updated entry
      const updateButton = screen.getByRole('button', { name: /update entry/i });
      await user.click(updateButton);

      // Verify submission with updated data
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: 'Updated: S0C7 Data Exception in COBOL Program',
          problem: expect.stringContaining('This typically occurs when numeric operations'),
          solution: expect.stringContaining('1. Check for non-numeric data'),
          category: existingEntry.category,
          tags: existingEntry.tags
        });
      });

      // Verify success message
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/entry updated successfully/i);
      });

      // In edit mode, form should NOT be reset
      expect(titleField).toHaveValue('Updated: S0C7 Data Exception in COBOL Program');
    });
  });

  describe('Form Auto-Save Workflow', () => {
    test('form auto-saves user input and recovers on page reload', async () => {
      const mockOnSubmit = jest.fn();

      const { unmount } = render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // User starts filling the form
      const titleField = screen.getByLabelText(/entry title/i);
      await user.type(titleField, 'JCL Job Submission Failed');

      const problemField = screen.getByLabelText(/problem description/i);
      await user.type(problemField, 'Job fails to submit through JES2 with various error messages.');

      // Simulate auto-save delay
      await waitFor(() => {
        // Auto-save should have stored data in localStorage
        const autoSavedData = localStorage.getItem('kb-form-autosave');
        expect(autoSavedData).toBeTruthy();

        if (autoSavedData) {
          const parsed = JSON.parse(autoSavedData);
          expect(parsed.data.title).toBe('JCL Job Submission Failed');
          expect(parsed.data.problem).toContain('Job fails to submit');
        }
      }, { timeout: 2000 });

      unmount();

      // Simulate page reload - render new form instance
      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Data should be restored from auto-save
      await waitFor(() => {
        expect(screen.getByDisplayValue('JCL Job Submission Failed')).toBeInTheDocument();
        expect(screen.getByDisplayValue(/Job fails to submit/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Workflow', () => {
    test('keyboard-only user can navigate and submit form', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Title field should be auto-focused
      expect(document.activeElement).toBe(screen.getByLabelText(/entry title/i));

      // Navigate through form using Tab
      await user.tab();
      expect(document.activeElement).toBe(screen.getByLabelText(/category/i));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByLabelText(/problem description/i));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByLabelText(/solution/i));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByLabelText(/tags/i));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /create entry/i }));

      // Navigate back using Shift+Tab
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));

      // Fill form using keyboard only
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });

      // Now at title field
      await user.type(document.activeElement!, 'Keyboard Navigation Test');

      await user.tab();
      await user.selectOptions(document.activeElement!, 'JCL');

      await user.tab();
      await user.type(document.activeElement!,
        'Testing keyboard navigation through the form to ensure accessibility compliance.'
      );

      await user.tab();
      await user.type(document.activeElement!,
        'Verify that all form fields are accessible via keyboard and screen readers can navigate properly.'
      );

      // Navigate to submit button and submit
      await user.tab();
      await user.tab();
      await user.tab();

      const submitButton = document.activeElement as HTMLButtonElement;
      expect(submitButton).toHaveTextContent(/create entry/i);

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    test('screen reader announcements work correctly', async () => {
      const mockOnSubmit = jest.fn();

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Mock screen reader announcement checking
      const liveRegions = screen.getAllByRole('alert', { hidden: true });
      expect(liveRegions.length).toBeGreaterThan(0);

      // Trigger validation error
      const titleField = screen.getByLabelText(/entry title/i);
      await user.type(titleField, 'Hi');
      await user.tab();

      // Error should be announced
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveAttribute('aria-live');
      });

      // Fix the error
      await user.clear(titleField);
      await user.type(titleField, 'Valid Title Length');

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/title must be at least/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Workflow', () => {
    test('user recovers from network error during submission', async () => {
      const mockOnSubmit = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      // Fill valid form data
      await user.type(screen.getByLabelText(/entry title/i), 'Network Error Test');
      await user.type(screen.getByLabelText(/problem description/i),
        'Testing network error recovery during form submission process.');
      await user.type(screen.getByLabelText(/solution/i),
        'Implement proper error handling and retry mechanisms for network failures.');

      // First submission fails
      await user.click(screen.getByRole('button', { name: /create entry/i }));

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
      });

      // User retries submission
      await user.click(screen.getByRole('button', { name: /create entry/i }));

      // Second submission succeeds
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/entry created successfully/i);
      });

      expect(mockOnSubmit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and UX', () => {
    test('form provides immediate feedback during user interaction', async () => {
      const mockOnSubmit = jest.fn();

      render(<KBEntryForm onSubmit={mockOnSubmit} />);

      const titleField = screen.getByLabelText(/entry title/i);

      // Character counter should be visible
      await user.type(titleField, 'Test');

      // Should show character count
      await waitFor(() => {
        expect(screen.getByText('4/200')).toBeInTheDocument();
      });

      // Submit button should be disabled initially
      const submitButton = screen.getByRole('button', { name: /create entry/i });
      expect(submitButton).toBeDisabled();

      // Fill minimum requirements
      await user.clear(titleField);
      await user.type(titleField, 'Valid Title Here');

      await user.type(screen.getByLabelText(/problem description/i),
        'This meets the minimum character requirement for the problem description field.');

      await user.type(screen.getByLabelText(/solution/i),
        'This meets the minimum character requirement for the solution field with proper instructions.');

      // Submit button should become enabled
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});