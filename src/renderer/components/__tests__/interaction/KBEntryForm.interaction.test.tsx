import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { KBEntryForm } from '../../forms/KBEntryForm';
import { customRender, MockDataGenerator } from '../test-utils';
import {
  AddEntryUserFlow,
  UserFlowPerformance,
  ErrorHandlingFlow,
  FormInteractionOptions
} from './user-flow-helpers';
import './setup';

// Mock the form hook
jest.mock('../../hooks/useForm', () => ({
  useForm: jest.fn().mockImplementation(({ initialValues, onSubmit, onError }) => ({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: true,
    isSubmitting: false,
    isDirty: false,
    isAutoSaving: false,
    hasDraft: false,
    handleSubmit: jest.fn().mockImplementation((e) => {
      e?.preventDefault();
      return onSubmit(initialValues);
    }),
    setFieldValue: jest.fn(),
    getFieldProps: jest.fn().mockImplementation((name) => ({
      name,
      value: initialValues[name] || '',
      onChange: jest.fn(),
      onBlur: jest.fn()
    })),
    getFieldError: jest.fn().mockReturnValue(null),
    resetForm: jest.fn(),
    saveDraft: jest.fn(),
    loadDraft: jest.fn(),
    clearDraft: jest.fn()
  }))
}));

describe('KBEntryForm - User Interaction Tests', () => {
  let mockOnSubmit: jest.Mock;
  let mockOnCancel: jest.Mock;
  let mockOnError: jest.Mock;

  beforeEach(() => {
    mockOnSubmit = jest.fn().mockResolvedValue(undefined);
    mockOnCancel = jest.fn();
    mockOnError = jest.fn();

    // Clear performance measurements
    UserFlowPerformance.clearMeasurements();

    // Reset localStorage for draft testing
    localStorage.clear();
  });

  describe('Basic Form Interactions', () => {
    test('should open form and display all required fields', async () => {
      customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Verify form structure
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /add new knowledge entry/i })).toBeInTheDocument();

      // Verify required fields are present
      expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /problem/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /solution/i })).toBeInTheDocument();

      // Verify action buttons
      expect(screen.getByRole('button', { name: /add entry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    test('should complete full form submission flow', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const addFlow = new AddEntryUserFlow({ user, performanceTracking: true });

      await addFlow.fillEntryForm({
        title: 'VSAM Status 37 - Space Issues',
        problem: 'Job fails with VSAM status 37 indicating insufficient space in dataset',
        solution: 'Extend the dataset size using IDCAMS ALTER command or allocate new space',
        category: 'VSAM',
        tags: ['vsam', 'status-37', 'space'],
        expectSuccess: true
      });

      await addFlow.submitEntryForm(true);

      // Verify submission was called with correct data
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'VSAM Status 37 - Space Issues',
        problem: 'Job fails with VSAM status 37 indicating insufficient space in dataset',
        solution: 'Extend the dataset size using IDCAMS ALTER command or allocate new space',
        category: 'VSAM',
        severity: 'medium', // default value
        tags: ['vsam', 'status-37', 'space']
      });

      // Check performance
      const measurements = UserFlowPerformance.getAllMeasurements();
      expect(measurements['add-entry-flow']).toBeDefined();
    });

    test('should handle form in edit mode', async () => {
      const initialData = MockDataGenerator.formData({
        title: 'Existing Entry Title',
        problem: 'Existing problem description',
        solution: 'Existing solution steps'
      });

      customRender(
        <KBEntryForm
          initialData={initialData}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="edit"
        />
      );

      // Verify edit mode UI
      expect(screen.getByRole('heading', { name: /edit knowledge entry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();

      // Verify form is pre-filled
      const titleInput = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
      expect(titleInput.value).toBe(initialData.title);
    });

    test('should manage tags correctly', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Add tags
      const tagInput = screen.getByRole('textbox', { name: /tag/i });
      const addTagButton = screen.getByRole('button', { name: /add/i });

      await user.type(tagInput, 'vsam');
      await user.click(addTagButton);

      await user.type(tagInput, 'error-handling');
      await user.keyboard('{Enter}');

      await user.type(tagInput, 'mainframe');
      await user.click(addTagButton);

      // Verify tags are displayed
      const tagsList = screen.getByRole('list', { name: /current tags/i });
      expect(within(tagsList).getByText('vsam')).toBeInTheDocument();
      expect(within(tagsList).getByText('error-handling')).toBeInTheDocument();
      expect(within(tagsList).getByText('mainframe')).toBeInTheDocument();

      // Remove a tag
      const removeVsamButton = within(tagsList).getByRole('button', { name: /remove tag.*vsam/i });
      await user.click(removeVsamButton);

      // Verify tag was removed
      expect(within(tagsList).queryByText('vsam')).not.toBeInTheDocument();
      expect(within(tagsList).getByText('error-handling')).toBeInTheDocument();
      expect(within(tagsList).getByText('mainframe')).toBeInTheDocument();
    });

    test('should toggle advanced options', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
          showAdvancedOptions={false}
        />
      );

      // Advanced options should be hidden initially
      expect(screen.queryByRole('region', { name: /advanced options/i })).not.toBeInTheDocument();

      // Click to show advanced options
      const advancedToggle = screen.getByRole('button', { name: /show advanced options/i });
      await user.click(advancedToggle);

      // Advanced options should now be visible
      expect(screen.getByRole('region', { name: /advanced options/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /severity/i })).toBeInTheDocument();

      // Hide advanced options
      await user.click(advancedToggle);
      expect(screen.queryByRole('region', { name: /advanced options/i })).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('should validate required fields', async () => {
      // Mock form validation errors
      const mockUseForm = require('../../hooks/useForm').useForm;
      mockUseForm.mockImplementationOnce(({ initialValues, onSubmit }) => ({
        values: { ...initialValues },
        errors: {
          title: 'Title is required',
          problem: 'Problem description is required',
          solution: 'Solution is required'
        },
        touched: {},
        isValid: false,
        isSubmitting: false,
        isDirty: true,
        isAutoSaving: false,
        hasDraft: false,
        handleSubmit: jest.fn().mockImplementation((e) => {
          e?.preventDefault();
          // Don't call onSubmit due to validation errors
        }),
        setFieldValue: jest.fn(),
        getFieldProps: jest.fn().mockImplementation((name) => ({
          name,
          value: initialValues[name] || '',
          onChange: jest.fn(),
          onBlur: jest.fn()
        })),
        getFieldError: jest.fn().mockImplementation((name) => {
          const errors = {
            title: 'Title is required',
            problem: 'Problem description is required',
            solution: 'Solution is required'
          };
          return errors[name] || null;
        }),
        resetForm: jest.fn(),
        saveDraft: jest.fn(),
        loadDraft: jest.fn(),
        clearDraft: jest.fn()
      }));

      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const addFlow = new AddEntryUserFlow({ user });

      const errors = await addFlow.testFormValidation({
        fillAllFields: false,
        triggerValidation: true,
        expectErrors: ['Title is required', 'Problem description is required', 'Solution is required']
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('Title is required'))).toBe(true);

      // Error summary should be displayed
      expect(screen.getByRole('alert', { name: /please correct/i })).toBeInTheDocument();

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', { name: /add entry/i });
      expect(submitButton).toBeDisabled();
    });

    test('should validate field lengths and content', async () => {
      // Mock form with length validation errors
      const mockUseForm = require('../../hooks/useForm').useForm;
      mockUseForm.mockImplementationOnce(({ initialValues }) => ({
        values: {
          title: 'a', // too short
          problem: 'short',
          solution: 'brief',
          category: 'Other',
          tags: []
        },
        errors: {
          title: 'Title must be at least 10 characters',
          problem: 'Problem description must be at least 50 characters',
          solution: 'Solution must be at least 50 characters'
        },
        touched: { title: true, problem: true, solution: true },
        isValid: false,
        isSubmitting: false,
        isDirty: true,
        isAutoSaving: false,
        hasDraft: false,
        handleSubmit: jest.fn().mockImplementation((e) => e?.preventDefault()),
        setFieldValue: jest.fn(),
        getFieldProps: jest.fn().mockImplementation((name) => ({
          name,
          value: initialValues[name] || '',
          onChange: jest.fn(),
          onBlur: jest.fn()
        })),
        getFieldError: jest.fn().mockImplementation((name) => {
          const errors = {
            title: 'Title must be at least 10 characters',
            problem: 'Problem description must be at least 50 characters',
            solution: 'Solution must be at least 50 characters'
          };
          return errors[name] || null;
        }),
        resetForm: jest.fn(),
        saveDraft: jest.fn(),
        loadDraft: jest.fn(),
        clearDraft: jest.fn()
      }));

      customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Verify field-specific errors are shown
      expect(screen.getByText('Title must be at least 10 characters')).toBeInTheDocument();
      expect(screen.getByText('Problem description must be at least 50 characters')).toBeInTheDocument();
      expect(screen.getByText('Solution must be at least 50 characters')).toBeInTheDocument();
    });

    test('should validate tag limits', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const tagInput = screen.getByRole('textbox', { name: /tag/i });
      const addTagButton = screen.getByRole('button', { name: /add/i });

      // Add 10 tags (the maximum)
      for (let i = 1; i <= 10; i++) {
        await user.clear(tagInput);
        await user.type(tagInput, `tag${i}`);
        await user.click(addTagButton);
      }

      // Verify tag counter shows 10/10
      expect(screen.getByText('10/10 tags')).toBeInTheDocument();

      // Add button should be disabled
      expect(addTagButton).toBeDisabled();

      // Try to add another tag should fail
      await user.clear(tagInput);
      await user.type(tagInput, 'tag11');
      await user.click(addTagButton);

      // Should still be 10 tags
      expect(screen.getByText('10/10 tags')).toBeInTheDocument();
    });
  });

  describe('Keyboard Interactions', () => {
    test('should support keyboard navigation', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const addFlow = new AddEntryUserFlow({ user });

      const navResults = await addFlow.testKeyboardNavigation();

      expect(navResults.tabOrder.length).toBeGreaterThan(0);
      expect(navResults.shortcutsWork).toBe(true);
      expect(navResults.accessibleLabels).toBe(true);
    });

    test('should handle keyboard shortcuts', async () => {
      // Mock form with valid state for submission
      const mockUseForm = require('../../hooks/useForm').useForm;
      mockUseForm.mockImplementationOnce(({ initialValues, onSubmit }) => ({
        values: MockDataGenerator.formData(),
        errors: {},
        touched: {},
        isValid: true,
        isSubmitting: false,
        isDirty: true,
        isAutoSaving: false,
        hasDraft: false,
        handleSubmit: jest.fn().mockImplementation((e) => {
          e?.preventDefault();
          return onSubmit(MockDataGenerator.formData());
        }),
        setFieldValue: jest.fn(),
        getFieldProps: jest.fn().mockImplementation((name) => ({
          name,
          value: initialValues[name] || '',
          onChange: jest.fn(),
          onBlur: jest.fn()
        })),
        getFieldError: jest.fn().mockReturnValue(null),
        resetForm: jest.fn(),
        saveDraft: jest.fn(),
        loadDraft: jest.fn(),
        clearDraft: jest.fn()
      }));

      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Test Ctrl+S shortcut
      await user.keyboard('{Control>}s{/Control}');
      expect(mockOnSubmit).toHaveBeenCalled();

      // Reset mock for next test
      mockOnSubmit.mockClear();

      // Test Ctrl+Enter shortcut
      await user.keyboard('{Control>}{Enter}{/Control}');
      expect(mockOnSubmit).toHaveBeenCalled();

      // Test Escape to cancel
      mockOnSubmit.mockClear();
      await user.keyboard('{Escape}');
      expect(mockOnCancel).toHaveBeenCalled();
    });

    test('should handle Enter key in tag input', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const tagInput = screen.getByRole('textbox', { name: /tag/i });

      await user.type(tagInput, 'test-tag{Enter}');

      // Verify tag was added
      const tagsList = screen.getByRole('list', { name: /current tags/i });
      expect(within(tagsList).getByText('test-tag')).toBeInTheDocument();

      // Tag input should be cleared
      expect(tagInput).toHaveValue('');
    });
  });

  describe('Draft Functionality', () => {
    test('should save and load drafts', async () => {
      // Mock form with draft functionality
      let hasDraft = false;
      const mockUseForm = require('../../hooks/useForm').useForm;
      mockUseForm.mockImplementation(({ initialValues }) => ({
        values: initialValues,
        errors: {},
        touched: {},
        isValid: true,
        isSubmitting: false,
        isDirty: true,
        isAutoSaving: false,
        hasDraft: hasDraft,
        handleSubmit: jest.fn(),
        setFieldValue: jest.fn(),
        getFieldProps: jest.fn().mockImplementation((name) => ({
          name,
          value: initialValues[name] || '',
          onChange: jest.fn(),
          onBlur: jest.fn()
        })),
        getFieldError: jest.fn().mockReturnValue(null),
        resetForm: jest.fn(),
        saveDraft: jest.fn().mockImplementation(() => {
          hasDraft = true;
        }),
        loadDraft: jest.fn().mockImplementation(() => {
          // Simulate loading draft data
        }),
        clearDraft: jest.fn().mockImplementation(() => {
          hasDraft = false;
        })
      }));

      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
          enableDrafts={true}
        />
      );

      const addFlow = new AddEntryUserFlow({ user });

      await addFlow.testDraftFunctionality();

      // Draft buttons should be present
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    });

    test('should handle auto-save', async () => {
      // Mock auto-saving state
      const mockUseForm = require('../../hooks/useForm').useForm;
      mockUseForm.mockImplementationOnce(({ initialValues }) => ({
        values: initialValues,
        errors: {},
        touched: {},
        isValid: true,
        isSubmitting: false,
        isDirty: true,
        isAutoSaving: true, // Auto-save in progress
        hasDraft: false,
        handleSubmit: jest.fn(),
        setFieldValue: jest.fn(),
        getFieldProps: jest.fn().mockImplementation((name) => ({
          name,
          value: initialValues[name] || '',
          onChange: jest.fn(),
          onBlur: jest.fn()
        })),
        getFieldError: jest.fn().mockReturnValue(null),
        resetForm: jest.fn(),
        saveDraft: jest.fn(),
        loadDraft: jest.fn(),
        clearDraft: jest.fn()
      }));

      customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
          autoSave={true}
        />
      );

      // Auto-save indicator should be visible
      expect(screen.getByText(/saving.../i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle form submission errors gracefully', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          onError={mockOnError}
          mode="create"
        />
      );

      const errorFlow = new ErrorHandlingFlow({ user });

      await errorFlow.testFormErrorRecovery();

      // Form should still be present after error
      expect(screen.getByRole('form')).toBeInTheDocument();

      // Error callback should have been called
      expect(mockOnError).toHaveBeenCalled();
    });

    test('should show network error indicators', async () => {
      // Mock submission failure
      mockOnSubmit.mockRejectedValueOnce(new Error('Network error'));

      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const addFlow = new AddEntryUserFlow({ user });

      await addFlow.fillEntryForm({
        title: 'Test Entry for Network Error',
        problem: 'Test problem description that is long enough to meet validation requirements',
        solution: 'Test solution description that provides adequate detail for resolution',
        category: 'Other',
        expectSuccess: false
      });

      try {
        await addFlow.submitEntryForm(false);
      } catch (error) {
        // Expected to fail
      }

      // Should show error state
      await waitFor(() => {
        const errorIndicator = screen.queryByRole('alert') || screen.queryByText(/error|failed/i);
        expect(errorIndicator).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    test('should have proper ARIA attributes', async () => {
      customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Form should have proper role and label
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Add new knowledge entry');

      // Required fields should be marked
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      expect(titleInput).toHaveAttribute('required');

      // Error messages should be associated
      const errorSummary = screen.queryByRole('alert');
      if (errorSummary) {
        expect(errorSummary).toHaveAttribute('aria-live', 'assertive');
      }
    });

    test('should support screen reader announcements', async () => {
      customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Live regions for dynamic content
      const tagCounter = screen.getByText(/0\/10 tags/i);
      expect(tagCounter).toHaveAttribute('aria-live', 'polite');

      // Help text should be properly associated
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      const helpTextId = titleInput.getAttribute('aria-describedby');

      if (helpTextId) {
        const helpText = document.getElementById(helpTextId);
        expect(helpText).toBeInTheDocument();
      }
    });

    test('should maintain focus management', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Initial focus should be on title input in create mode
      const titleInput = screen.getByRole('textbox', { name: /title/i });
      expect(document.activeElement).toBe(titleInput);

      // Focus should move through form logically
      await user.tab();
      const categorySelect = screen.getByRole('combobox', { name: /category/i });
      expect(document.activeElement).toBe(categorySelect);

      // Error focus management
      const submitButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(submitButton);

      // If validation errors occur, focus should move to first error
      // This would be tested with actual validation errors
    });

    test('should provide keyboard shortcuts help', async () => {
      customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      // Keyboard shortcuts help should be available
      const shortcutsSection = screen.getByText(/keyboard shortcuts/i);
      expect(shortcutsSection).toBeInTheDocument();

      // Should list available shortcuts
      expect(screen.getByText(/ctrl\+s.*submit/i)).toBeInTheDocument();
      expect(screen.getByText(/escape.*cancel/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('should handle large text inputs efficiently', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const largeText = 'A'.repeat(5000); // 5KB text
      const problemInput = screen.getByRole('textbox', { name: /problem/i });

      const startTime = performance.now();

      await user.clear(problemInput);
      await user.type(problemInput, largeText);

      const endTime = performance.now();
      const typingTime = endTime - startTime;

      // Should handle large text input within reasonable time (< 2 seconds)
      expect(typingTime).toBeLessThan(2000);

      // Character count should update correctly
      const characterCount = screen.getByText(/\d+\/5000/);
      expect(characterCount).toBeInTheDocument();
    });

    test('should debounce validation checks', async () => {
      const { user } = customRender(
        <KBEntryForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          mode="create"
        />
      );

      const titleInput = screen.getByRole('textbox', { name: /title/i });

      // Rapid typing should not trigger excessive validation
      await user.type(titleInput, 'Test title input');

      // Wait for debouncing
      await waitFor(() => {
        // Validation should have settled
        expect(titleInput.value).toBe('Test title input');
      }, { timeout: 500 });
    });
  });
});