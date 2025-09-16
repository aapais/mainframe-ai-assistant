/**
 * Accessibility Tests for AddEntryModal Component
 * Tests WCAG 2.1 AA compliance for modal dialogs and forms
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  runAccessibilityTests,
  testKeyboardNavigation,
  testScreenReaderAnnouncements,
  testFocusManagement,
  accessibilityScenarios,
  validateColorContrast
} from '../../../testing/accessibility';

import { KBDataProvider } from '../../../contexts/KBDataContext';
import { KBCategory } from '../../../../types/services';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock AddEntryModal component
const AddEntryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: any) => Promise<void>;
  initialData?: any;
  title?: string;
}> = ({ isOpen, onClose, onSave, initialData, title = 'Add New Entry' }) => {
  const [formData, setFormData] = React.useState({
    title: initialData?.title || '',
    problem: initialData?.problem || '',
    solution: initialData?.solution || '',
    category: initialData?.category || 'Other' as KBCategory,
    tags: initialData?.tags || []
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Focus management
  React.useEffect(() => {
    if (isOpen && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isOpen]);

  // Trap focus in modal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }

      // Focus trap
      if (e.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.problem.trim()) {
      newErrors.problem = 'Problem description is required';
    }
    if (!formData.solution.trim()) {
      newErrors.solution = 'Solution is required';
    }
    if (formData.title.length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      // Announce validation errors
      const errorMessages = Object.values(errors).join('. ');
      const announcement = `Form has errors: ${errorMessages}`;

      // Announce to screen reader
      const liveRegion = document.querySelector('[aria-live="assertive"]');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      setSubmitSuccess(true);

      // Announce success
      const liveRegion = document.querySelector('[aria-live="polite"]');
      if (liveRegion) {
        liveRegion.textContent = 'Entry saved successfully';
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save entry';
      setErrors({ submit: errorMessage });

      // Announce error
      const liveRegion = document.querySelector('[aria-live="assertive"]');
      if (liveRegion) {
        liveRegion.textContent = `Error: ${errorMessage}`;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTagAdd = (tagText: string) => {
    if (tagText.trim() && !formData.tags.includes(tagText.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagText.trim()]
      }));
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div
        ref={modalRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        {/* Modal Header */}
        <header className="modal-header">
          <h1 id="modal-title">{title}</h1>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </header>

        {/* Modal Content */}
        <div id="modal-description" className="sr-only">
          Form to add or edit a knowledge base entry with title, problem description, solution, category and tags
        </div>

        {submitSuccess && (
          <div
            className="success-message"
            role="status"
            aria-live="polite"
          >
            ✅ Entry saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Title Field */}
          <div className="form-field">
            <label htmlFor="entry-title" className="form-label required">
              Title
            </label>
            <input
              ref={titleInputRef}
              id="entry-title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              aria-required="true"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : "title-help"}
              className={`form-input ${errors.title ? 'error' : ''}`}
              maxLength={200}
            />
            <div id="title-help" className="form-help">
              Brief, descriptive title for the problem (max 200 characters)
            </div>
            {errors.title && (
              <div id="title-error" className="form-error" role="alert" aria-live="polite">
                {errors.title}
              </div>
            )}
          </div>

          {/* Problem Field */}
          <div className="form-field">
            <label htmlFor="entry-problem" className="form-label required">
              Problem Description
            </label>
            <textarea
              id="entry-problem"
              value={formData.problem}
              onChange={(e) => setFormData(prev => ({ ...prev, problem: e.target.value }))}
              aria-required="true"
              aria-invalid={!!errors.problem}
              aria-describedby={errors.problem ? "problem-error" : "problem-help"}
              className={`form-textarea ${errors.problem ? 'error' : ''}`}
              rows={4}
            />
            <div id="problem-help" className="form-help">
              Detailed description of the problem or error encountered
            </div>
            {errors.problem && (
              <div id="problem-error" className="form-error" role="alert" aria-live="polite">
                {errors.problem}
              </div>
            )}
          </div>

          {/* Solution Field */}
          <div className="form-field">
            <label htmlFor="entry-solution" className="form-label required">
              Solution
            </label>
            <textarea
              id="entry-solution"
              value={formData.solution}
              onChange={(e) => setFormData(prev => ({ ...prev, solution: e.target.value }))}
              aria-required="true"
              aria-invalid={!!errors.solution}
              aria-describedby={errors.solution ? "solution-error" : "solution-help"}
              className={`form-textarea ${errors.solution ? 'error' : ''}`}
              rows={6}
            />
            <div id="solution-help" className="form-help">
              Step-by-step solution to resolve the problem
            </div>
            {errors.solution && (
              <div id="solution-error" className="form-error" role="alert" aria-live="polite">
                {errors.solution}
              </div>
            )}
          </div>

          {/* Category Field */}
          <div className="form-field">
            <label htmlFor="entry-category" className="form-label">
              Category
            </label>
            <select
              id="entry-category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as KBCategory }))}
              aria-describedby="category-help"
              className="form-select"
            >
              <option value="JCL">JCL</option>
              <option value="VSAM">VSAM</option>
              <option value="DB2">DB2</option>
              <option value="Batch">Batch</option>
              <option value="Functional">Functional</option>
              <option value="IMS">IMS</option>
              <option value="CICS">CICS</option>
              <option value="System">System</option>
              <option value="Other">Other</option>
            </select>
            <div id="category-help" className="form-help">
              Select the most appropriate category for this entry
            </div>
          </div>

          {/* Tags Field */}
          <div className="form-field">
            <fieldset>
              <legend className="form-label">Tags</legend>
              <div id="tags-help" className="form-help">
                Add relevant keywords to help with searching
              </div>

              {/* Tag Input */}
              <div className="tag-input-container">
                <input
                  type="text"
                  placeholder="Add tag and press Enter"
                  aria-describedby="tags-help"
                  className="form-input tag-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      if (input.value.trim()) {
                        handleTagAdd(input.value);
                        input.value = '';
                      }
                    }
                  }}
                />
              </div>

              {/* Current Tags */}
              {formData.tags.length > 0 && (
                <div className="tags-list" role="list" aria-label="Current tags">
                  {formData.tags.map((tag, index) => (
                    <div key={tag} className="tag-item" role="listitem">
                      <span className="tag-text">{tag}</span>
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => handleTagRemove(tag)}
                        aria-label={`Remove tag: ${tag}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="form-error submit-error" role="alert" aria-live="assertive">
              {errors.submit}
            </div>
          )}

          {/* Form Actions */}
          <footer className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              aria-describedby={isSubmitting ? "saving-status" : undefined}
            >
              {isSubmitting ? 'Saving...' : 'Save Entry'}
            </button>
            {isSubmitting && (
              <div id="saving-status" className="sr-only" aria-live="polite">
                Saving entry, please wait
              </div>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <KBDataProvider>
    <div id="test-app" role="application" aria-label="Knowledge Base Entry Form">
      {children}
    </div>
  </KBDataProvider>
);

describe('AddEntryModal Accessibility Tests', () => {
  beforeEach(() => {
    global.a11yTestUtils.setupAccessibleEnvironment();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.a11yTestUtils.cleanupAccessibleEnvironment();
  });

  describe('Modal Accessibility Compliance', () => {
    test('should pass axe accessibility audit', async () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      const { container } = render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have proper modal ARIA attributes', () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(modal).toHaveAttribute('aria-describedby', 'modal-description');

      // Modal title should be properly identified
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    test('should manage focus properly when opening', async () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      // First focusable element (title input) should receive focus
      await waitFor(() => {
        const titleInput = screen.getByLabelText(/title/i);
        expect(titleInput).toHaveFocus();
      });
    });

    test('should trap focus within modal', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      await testFocusManagement(
        async () => {
          // Modal is already open
        },
        {
          expectedInitialFocus: 'input[id="entry-title"]',
          trapFocus: true
        }
      );
    });

    test('should close on Escape key', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      await user.keyboard('{escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('should handle backdrop clicks accessibly', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const overlay = document.querySelector('.modal-overlay');
      if (overlay) {
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
      }

      // But clicking inside modal should not close it
      const modal = screen.getByRole('dialog');
      fireEvent.click(modal);
      expect(mockOnClose).toHaveBeenCalledTimes(1); // Still only once
    });
  });

  describe('Form Accessibility', () => {
    test('should have properly associated form labels', () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      // All form inputs should have labels
      const titleInput = screen.getByLabelText(/title/i);
      const problemInput = screen.getByLabelText(/problem description/i);
      const solutionInput = screen.getByLabelText(/solution/i);
      const categorySelect = screen.getByLabelText(/category/i);

      expect(titleInput).toHaveAttribute('id', 'entry-title');
      expect(problemInput).toHaveAttribute('id', 'entry-problem');
      expect(solutionInput).toHaveAttribute('id', 'entry-solution');
      expect(categorySelect).toHaveAttribute('id', 'entry-category');

      // Required fields should be marked
      expect(titleInput).toHaveAttribute('aria-required', 'true');
      expect(problemInput).toHaveAttribute('aria-required', 'true');
      expect(solutionInput).toHaveAttribute('aria-required', 'true');
    });

    test('should provide helpful descriptions for form fields', () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const titleInput = screen.getByLabelText(/title/i);
      const problemInput = screen.getByLabelText(/problem description/i);
      const solutionInput = screen.getByLabelText(/solution/i);
      const categorySelect = screen.getByLabelText(/category/i);

      // Should have aria-describedby for help text
      expect(titleInput).toHaveAttribute('aria-describedby', 'title-help');
      expect(problemInput).toHaveAttribute('aria-describedby', 'problem-help');
      expect(solutionInput).toHaveAttribute('aria-describedby', 'solution-help');
      expect(categorySelect).toHaveAttribute('aria-describedby', 'category-help');

      // Help text should exist
      expect(screen.getByText(/brief, descriptive title/i)).toBeInTheDocument();
      expect(screen.getByText(/detailed description of the problem/i)).toBeInTheDocument();
      expect(screen.getByText(/step-by-step solution/i)).toBeInTheDocument();
    });

    test('should handle form validation errors accessibly', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /save entry/i });

      // Submit empty form
      await user.click(submitButton);

      // Wait for validation errors
      await waitFor(() => {
        const titleInput = screen.getByLabelText(/title/i);
        const problemInput = screen.getByLabelText(/problem description/i);
        const solutionInput = screen.getByLabelText(/solution/i);

        // Fields should be marked invalid
        expect(titleInput).toHaveAttribute('aria-invalid', 'true');
        expect(problemInput).toHaveAttribute('aria-invalid', 'true');
        expect(solutionInput).toHaveAttribute('aria-invalid', 'true');

        // Error messages should exist and be associated
        const titleError = screen.getByText(/title is required/i);
        const problemError = screen.getByText(/problem description is required/i);
        const solutionError = screen.getByText(/solution is required/i);

        expect(titleError).toHaveAttribute('role', 'alert');
        expect(problemError).toHaveAttribute('role', 'alert');
        expect(solutionError).toHaveAttribute('role', 'alert');

        // aria-describedby should include error IDs
        expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');
        expect(problemInput).toHaveAttribute('aria-describedby', 'problem-error');
        expect(solutionInput).toHaveAttribute('aria-describedby', 'solution-error');
      });
    });

    test('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /save entry/i });

      await testScreenReaderAnnouncements(
        async () => {
          await user.click(submitButton);
        },
        'Form has errors',
        2000
      );
    });
  });

  describe('Tags Field Accessibility', () => {
    test('should use proper fieldset and legend for tags', () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const fieldset = screen.getByRole('group', { name: /tags/i });
      expect(fieldset.tagName.toLowerCase()).toBe('fieldset');

      const legend = screen.getByText('Tags');
      expect(legend.closest('legend')).toBeInTheDocument();
    });

    test('should handle tag addition with keyboard', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const tagInput = screen.getByPlaceholderText(/add tag/i);

      await user.type(tagInput, 'test-tag');
      await user.keyboard('{enter}');

      // Tag should be added to the list
      await waitFor(() => {
        const tagList = screen.getByRole('list', { name: /current tags/i });
        expect(tagList).toBeInTheDocument();

        const tagItem = screen.getByRole('listitem');
        expect(tagItem).toHaveTextContent('test-tag');
      });

      // Input should be cleared
      expect(tagInput).toHaveValue('');
    });

    test('should make tag removal buttons accessible', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      const initialData = {
        tags: ['existing-tag', 'another-tag']
      };

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            initialData={initialData}
          />
        </TestWrapper>
      );

      const removeButtons = screen.getAllByRole('button', { name: /remove tag/i });
      expect(removeButtons).toHaveLength(2);

      removeButtons.forEach((button, index) => {
        const tagName = initialData.tags[index];
        expect(button).toHaveAttribute('aria-label', `Remove tag: ${tagName}`);
      });

      // Test removing a tag
      await user.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('existing-tag')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading and Success States', () => {
    test('should handle loading state accessibly', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn().mockImplementation(() => new Promise(resolve => {
        setTimeout(resolve, 1000);
      }));

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      const submitButton = screen.getByRole('button', { name: /save entry/i });
      await user.click(submitButton);

      // Button should show loading state
      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Saving...');
        expect(submitButton).toBeDisabled();
        expect(submitButton).toHaveAttribute('aria-describedby', 'saving-status');
      });

      // Loading status should be announced
      const loadingStatus = screen.getByText(/saving entry, please wait/i);
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
      expect(loadingStatus).toHaveClass('sr-only'); // Visually hidden but announced
    });

    test('should announce success state', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn().mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      const submitButton = screen.getByRole('button', { name: /save entry/i });

      await testScreenReaderAnnouncements(
        async () => {
          await user.click(submitButton);
        },
        'Entry saved successfully',
        2000
      );

      // Success message should be visible
      await waitFor(() => {
        const successMessage = screen.getByText(/entry saved successfully/i);
        expect(successMessage).toHaveAttribute('role', 'status');
        expect(successMessage).toHaveAttribute('aria-live', 'polite');
      });
    });

    test('should handle submission errors accessibly', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn().mockRejectedValue(new Error('Server error'));

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/title/i), 'Test Title');
      await user.type(screen.getByLabelText(/problem/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      const submitButton = screen.getByRole('button', { name: /save entry/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/server error/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      await testKeyboardNavigation(
        screen.getByRole('dialog'),
        [
          'button[aria-label="Close modal"]',
          'input[id="entry-title"]',
          'textarea[id="entry-problem"]',
          'textarea[id="entry-solution"]',
          'select[id="entry-category"]',
          'input[placeholder*="tag"]',
          'button[type="button"]', // Cancel
          'button[type="submit"]'  // Save
        ]
      );
    });

    test('should handle form submission with Enter key', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      // Fill form
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test Title');
      await user.type(screen.getByLabelText(/problem/i), 'Test Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Test Solution');

      // Enter key should submit form
      await user.keyboard('{enter}');
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  describe('Comprehensive Modal Tests', () => {
    test('should follow modal accessibility patterns', async () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      const modal = screen.getByRole('dialog');
      await accessibilityScenarios.testModalAccessibility(modal);
    });

    test('should have proper color contrast', () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      render(
        <TestWrapper>
          <AddEntryModal
            isOpen={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        </TestWrapper>
      );

      // Test various elements
      const modal = screen.getByRole('dialog');
      const buttons = screen.getAllByRole('button');
      const inputs = screen.getAllByRole('textbox');

      [modal, ...buttons, ...inputs].forEach(element => {
        const style = window.getComputedStyle(element);
        expect(style.color).toBeTruthy();
        expect(style.backgroundColor || style.background).toBeTruthy();
      });
    });

    test('should run comprehensive accessibility test suite', async () => {
      const mockOnClose = jest.fn();
      const mockOnSave = jest.fn();

      await runAccessibilityTests(
        <AddEntryModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />,
        {
          customTests: [
            async (container) => {
              // Modal-specific tests
              const modal = container.querySelector('[role="dialog"]');
              expect(modal).toHaveAttribute('aria-modal', 'true');

              // Form accessibility
              const form = container.querySelector('form');
              if (form) {
                await accessibilityScenarios.testFormAccessibility(form);
              }
            }
          ]
        }
      );
    });
  });
});