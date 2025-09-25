/**
 * Form Testing Utilities
 * Provides common utilities and helpers for testing form components
 */

import React from 'react';
import { render, screen, RenderOptions, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock implementations for external dependencies
export const mockComponents = {
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
};

// Test data factories
export const createValidKBEntry = (overrides = {}) => ({
  title: 'Test VSAM Status 35 Error',
  problem:
    'Job fails with VSAM status code 35 when trying to open a dataset. This usually indicates the file was not found or is not properly cataloged.',
  solution:
    '1. Verify dataset exists using LISTCAT command\n2. Check JCL DD statement for correct DSN\n3. Ensure file is cataloged properly\n4. Verify RACF permissions',
  category: 'VSAM' as const,
  tags: ['vsam', 'status-35', 'file-not-found'],
  ...overrides,
});

export const createInvalidKBEntry = (overrides = {}) => ({
  title: '',
  problem: '',
  solution: '',
  category: 'Other' as const,
  tags: [],
  ...overrides,
});

export const createLongKBEntry = (overrides = {}) => ({
  title: 'A'.repeat(250), // Exceeds typical max length
  problem: 'B'.repeat(6000), // Very long problem
  solution: 'C'.repeat(11000), // Very long solution
  category: 'Batch' as const,
  tags: Array.from({ length: 15 }, (_, i) => `tag${i}`), // Too many tags
  ...overrides,
});

// Mock services and utilities
export const createMockValidationService = () => {
  return {
    validateEntry: jest.fn().mockImplementation(entry => ({
      valid: !!(entry.title && entry.problem && entry.solution),
      errors: [
        ...(entry.title
          ? []
          : [
              { field: 'title', code: 'REQUIRED', message: 'Title is required', severity: 'error' },
            ]),
        ...(entry.problem
          ? []
          : [
              {
                field: 'problem',
                code: 'REQUIRED',
                message: 'Problem is required',
                severity: 'error',
              },
            ]),
        ...(entry.solution
          ? []
          : [
              {
                field: 'solution',
                code: 'REQUIRED',
                message: 'Solution is required',
                severity: 'error',
              },
            ]),
      ],
      warnings: [],
      score: entry.title && entry.problem && entry.solution ? 85 : 45,
    })),
    validateUpdate: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
    validateSearch: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
    sanitizeEntry: jest.fn().mockImplementation(entry => entry),
  };
};

// Storage mocks
export const createStorageMock = () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
});

// Form interaction helpers
export const FormInteractionHelpers = {
  async fillRequiredFields(user: ReturnType<typeof userEvent.setup>, data = createValidKBEntry()) {
    await user.type(screen.getByLabelText(/title/i), data.title);
    await user.type(screen.getByLabelText(/problem description/i), data.problem);
    await user.type(screen.getByLabelText(/solution/i), data.solution);

    if (data.category !== 'Other') {
      await user.selectOptions(screen.getByLabelText(/category/i), data.category);
    }
  },

  async addTags(user: ReturnType<typeof userEvent.setup>, tags: string[]) {
    const tagInput = screen.getByLabelText(/tags/i);

    for (const tag of tags) {
      await user.type(tagInput, tag);
      await user.keyboard('{Enter}');
    }
  },

  async submitForm(user: ReturnType<typeof userEvent.setup>) {
    const submitButton = screen.getByText(/add entry|save changes/i);
    await user.click(submitButton);
  },

  async cancelForm(user: ReturnType<typeof userEvent.setup>) {
    const cancelButton = screen.getByText(/cancel/i);
    await user.click(cancelButton);
  },

  async fillAndSubmitForm(user: ReturnType<typeof userEvent.setup>, data = createValidKBEntry()) {
    await this.fillRequiredFields(user, data);
    if (data.tags && data.tags.length > 0) {
      await this.addTags(user, data.tags);
    }
    await this.submitForm(user);
  },

  async triggerValidationErrors(user: ReturnType<typeof userEvent.setup>) {
    // Submit empty form to trigger validation
    await this.submitForm(user);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  },

  expectFormToHaveErrors() {
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Problem description is required')).toBeInTheDocument();
    expect(screen.getByText('Solution is required')).toBeInTheDocument();
  },

  expectFormToBeInLoadingState() {
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();
  },

  expectFormToShowError(message: string) {
    expect(screen.getByText(message)).toBeInTheDocument();
  },
};

// Accessibility helpers
export const AccessibilityHelpers = {
  expectProperLabeling() {
    // Check all form inputs have labels
    const inputs = screen.getAllByRole('textbox');
    const selects = screen.getAllByRole('combobox');
    const allInputs = [...inputs, ...selects];

    allInputs.forEach(input => {
      const id = input.getAttribute('id');
      if (id) {
        const label = screen.getByLabelText(new RegExp(id, 'i'));
        expect(label).toBeInTheDocument();
      }
    });
  },

  expectErrorsAssociatedWithFields() {
    const errorMessages = screen.getAllByText(/required$/);
    expect(errorMessages.length).toBeGreaterThan(0);

    // Each error should be associated with its field
    errorMessages.forEach(error => {
      expect(error).toHaveClass('error-message');
    });
  },

  expectKeyboardNavigation() {
    const focusableElements = screen
      .getAllByRole('textbox')
      .concat(screen.getAllByRole('combobox'))
      .concat(screen.getAllByRole('button'));

    focusableElements.forEach(element => {
      expect(element).not.toHaveAttribute('tabindex', '-1');
    });
  },

  expectAriaLabelsForButtons() {
    const removeButtons = screen.getAllByLabelText(/remove/i);
    removeButtons.forEach(button => {
      expect(button).toHaveAccessibleName();
    });
  },
};

// Performance helpers
export const PerformanceHelpers = {
  async measureFormInteractionTime(interaction: () => Promise<void>) {
    const start = performance.now();
    await interaction();
    const end = performance.now();
    return end - start;
  },

  expectInteractionToBeFast(time: number, threshold = 100) {
    expect(time).toBeLessThan(threshold);
  },

  async testRapidInteractions(user: ReturnType<typeof userEvent.setup>, count = 10) {
    const tagInput = screen.getByLabelText(/tags/i);

    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(user.type(tagInput, `rapid${i}{Enter}`, { delay: 1 }));
    }

    await Promise.all(promises);
  },
};

// Error simulation helpers
export const ErrorSimulationHelpers = {
  createFailingSubmitHandler(errorType = 'generic') {
    const errorMessages = {
      network: 'Network error occurred',
      timeout: 'Request timed out',
      validation: 'Server validation failed',
      quota: 'Storage quota exceeded',
      generic: 'An unexpected error occurred',
    };

    return jest
      .fn()
      .mockRejectedValue(new Error(errorMessages[errorType as keyof typeof errorMessages]));
  },

  createSlowSubmitHandler(delay = 500) {
    return jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, delay)));
  },

  createIntermittentFailureHandler(failureRate = 0.5) {
    return jest.fn().mockImplementation(() => {
      if (Math.random() < failureRate) {
        return Promise.reject(new Error('Intermittent failure'));
      }
      return Promise.resolve();
    });
  },

  simulateStorageQuotaExceeded() {
    return jest.fn().mockImplementation(() => {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    });
  },
};

// Custom render function with providers
export const renderWithProviders = (ui: React.ReactElement, options: RenderOptions = {}) => {
  const AllProviders = ({ children }: { children: React.ReactNode }) => {
    return <div data-testid='test-provider'>{children}</div>;
  };

  return render(ui, { wrapper: AllProviders, ...options });
};

// Async helpers
export const AsyncHelpers = {
  async waitForFormSubmission() {
    await waitFor(
      () => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  },

  async waitForError(errorMessage: string) {
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  },

  async waitForFieldValue(labelText: string | RegExp, value: string) {
    await waitFor(() => {
      const field = screen.getByLabelText(labelText);
      expect(field).toHaveValue(value);
    });
  },
};

// Snapshot helpers
export const SnapshotHelpers = {
  expectFormStructure(container: HTMLElement) {
    // Check basic form structure exists
    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();

    const inputs = container.querySelectorAll('input, textarea, select');
    expect(inputs.length).toBeGreaterThan(0);

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  },

  expectErrorStructure(container: HTMLElement) {
    const errorMessages = container.querySelectorAll('.error-message');
    const errorInputs = container.querySelectorAll('.error');

    expect(errorMessages.length).toBeGreaterThan(0);
    expect(errorInputs.length).toBeGreaterThan(0);
  },
};

// Test environment helpers
export const TestEnvironmentHelpers = {
  mockBrowserAPIs() {
    // Mock localStorage
    const localStorageMock = createStorageMock();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    // Mock sessionStorage
    const sessionStorageMock = createStorageMock();
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    return { localStorageMock, sessionStorageMock };
  },

  restoreEnvironment() {
    jest.restoreAllMocks();
  },

  setupGlobalMocks() {
    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  },
};

// Export everything for easy importing
export { render, screen, waitFor, userEvent };

export default {
  mockComponents,
  createValidKBEntry,
  createInvalidKBEntry,
  createLongKBEntry,
  createMockValidationService,
  createStorageMock,
  FormInteractionHelpers,
  AccessibilityHelpers,
  PerformanceHelpers,
  ErrorSimulationHelpers,
  AsyncHelpers,
  SnapshotHelpers,
  TestEnvironmentHelpers,
  renderWithProviders,
};
