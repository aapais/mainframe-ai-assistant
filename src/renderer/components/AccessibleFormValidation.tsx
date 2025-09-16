/**
 * Accessible Form Validation Components
 * Comprehensive form validation with proper screen reader announcements
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ScreenReaderOnly, ScreenReaderAlert, ScreenReaderErrorSummary } from './ScreenReaderOnly';
import { useFormAnnouncements } from '../hooks/useScreenReaderAnnouncements';
import { ScreenReaderTextUtils } from '../utils/screenReaderUtils';

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface FieldValidationState {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  touched?: boolean;
  dirty?: boolean;
}

export interface AccessibleFormValidationProps {
  /**
   * Current validation errors
   */
  errors: Record<string, ValidationError[]>;

  /**
   * Whether the form is currently being submitted
   */
  isSubmitting?: boolean;

  /**
   * Whether to show validation summary
   */
  showSummary?: boolean;

  /**
   * Position of the validation summary
   */
  summaryPosition?: 'top' | 'bottom' | 'floating';

  /**
   * Whether to announce validation changes immediately
   */
  announceImmediately?: boolean;

  /**
   * Debounce delay for announcements (ms)
   */
  announceDelay?: number;

  /**
   * Whether to focus the first error field
   */
  focusFirstError?: boolean;

  /**
   * Custom error messages
   */
  customMessages?: {
    summaryTitle?: string;
    noErrors?: string;
    submitting?: string;
    submitSuccess?: string;
    submitError?: string;
  };

  /**
   * Children components
   */
  children?: React.ReactNode;

  /**
   * Form submission callbacks
   */
  onSubmissionStart?: () => void;
  onSubmissionSuccess?: () => void;
  onSubmissionError?: (error: string) => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export interface AccessibleFieldProps {
  /**
   * Field name/identifier
   */
  name: string;

  /**
   * Field label
   */
  label: string;

  /**
   * Current validation state
   */
  validation?: FieldValidationState;

  /**
   * Whether the field is required
   */
  required?: boolean;

  /**
   * Field description/help text
   */
  description?: string;

  /**
   * Input type
   */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select';

  /**
   * Input props
   */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

  /**
   * Options for select fields
   */
  options?: Array<{ value: string; label: string; disabled?: boolean }>;

  /**
   * Whether to announce validation changes
   */
  announceValidation?: boolean;

  /**
   * Custom validation message renderer
   */
  renderValidationMessage?: (errors: string[], warnings?: string[]) => React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Field change handler
   */
  onChange?: (value: string) => void;

  /**
   * Field blur handler
   */
  onBlur?: () => void;
}

/**
 * Accessible Form Validation Container
 */
export const AccessibleFormValidation: React.FC<AccessibleFormValidationProps> = ({
  errors,
  isSubmitting = false,
  showSummary = true,
  summaryPosition = 'top',
  announceImmediately = true,
  announceDelay = 300,
  focusFirstError = true,
  customMessages = {},
  children,
  onSubmissionStart,
  onSubmissionSuccess,
  onSubmissionError,
  className = ''
}) => {
  const {
    announceFormValidation,
    announceValidationSummary,
    announceFormSubmit,
    announceFormSuccess,
    announceFormError
  } = useFormAnnouncements();

  const [previousErrors, setPreviousErrors] = useState<Record<string, ValidationError[]>>({});
  const [announceTimeout, setAnnounceTimeout] = useState<NodeJS.Timeout | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const messages = {
    summaryTitle: 'Form Validation Errors',
    noErrors: 'All form fields are valid',
    submitting: 'Submitting form, please wait...',
    submitSuccess: 'Form submitted successfully',
    submitError: 'Form submission failed',
    ...customMessages
  };

  // Calculate error summary
  const errorSummary = React.useMemo(() => {
    const allErrors: Array<{ field: string; message: string; fieldId?: string }> = [];

    Object.entries(errors).forEach(([fieldName, fieldErrors]) => {
      fieldErrors.forEach(error => {
        allErrors.push({
          field: error.field || fieldName,
          message: error.message,
          fieldId: `field-${fieldName}`
        });
      });
    });

    return allErrors;
  }, [errors]);

  const hasErrors = errorSummary.length > 0;

  // Handle validation announcements
  useEffect(() => {
    if (!announceImmediately) return;

    // Clear existing timeout
    if (announceTimeout) {
      clearTimeout(announceTimeout);
    }

    // Set new timeout for debounced announcement
    const timeout = setTimeout(() => {
      const errorCount = errorSummary.length;
      const hasNewErrors = JSON.stringify(errors) !== JSON.stringify(previousErrors);

      if (hasNewErrors) {
        if (errorCount === 0) {
          announceFormValidation(true);
        } else {
          announceValidationSummary(errors);
        }
      }

      setPreviousErrors(errors);
    }, announceDelay);

    setAnnounceTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [errors, announceImmediately, announceDelay, announceFormValidation, announceValidationSummary, previousErrors, errorSummary.length]);

  // Handle submission state changes
  useEffect(() => {
    if (isSubmitting) {
      announceFormSubmit(true);
      onSubmissionStart?.();
    }
  }, [isSubmitting, announceFormSubmit, onSubmissionStart]);

  // Focus first error when errors appear
  useEffect(() => {
    if (focusFirstError && hasErrors && errorSummary.length > 0) {
      const firstErrorField = document.getElementById(errorSummary[0].fieldId || '');
      if (firstErrorField) {
        firstErrorField.focus();
      } else if (errorSummaryRef.current) {
        errorSummaryRef.current.focus();
      }
    }
  }, [focusFirstError, hasErrors, errorSummary]);

  // Render validation summary
  const renderValidationSummary = () => {
    if (!showSummary) return null;

    return (
      <div
        ref={errorSummaryRef}
        className={`validation-summary ${summaryPosition === 'floating' ? 'fixed top-4 right-4 z-50' : ''} mb-4`}
      >
        {hasErrors ? (
          <ScreenReaderErrorSummary
            errors={errorSummary}
            title={messages.summaryTitle}
          />
        ) : (
          <ScreenReaderOnly role="status">
            {messages.noErrors}
          </ScreenReaderOnly>
        )}
      </div>
    );
  };

  return (
    <div className={`accessible-form ${className}`} role="form" noValidate>
      {/* Loading announcement for form submission */}
      {isSubmitting && (
        <ScreenReaderOnly live="assertive">
          {messages.submitting}
        </ScreenReaderOnly>
      )}

      {/* Validation summary at top */}
      {summaryPosition === 'top' && renderValidationSummary()}

      {/* Form content */}
      <div className="form-content">
        {children}
      </div>

      {/* Validation summary at bottom */}
      {summaryPosition === 'bottom' && renderValidationSummary()}

      {/* Floating validation summary */}
      {summaryPosition === 'floating' && renderValidationSummary()}
    </div>
  );
};

/**
 * Accessible Form Field Component
 */
export const AccessibleFormField: React.FC<AccessibleFieldProps> = ({
  name,
  label,
  validation = { isValid: true, errors: [] },
  required = false,
  description,
  type = 'text',
  inputProps = {},
  options = [],
  announceValidation = true,
  renderValidationMessage,
  className = '',
  onChange,
  onBlur,
  ...props
}) => {
  const { announceFieldError } = useFormAnnouncements();
  const [previousErrors, setPreviousErrors] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  const fieldId = `field-${name}`;
  const errorId = `${fieldId}-error`;
  const descId = `${fieldId}-desc`;

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings && validation.warnings.length > 0;

  // Announce field validation changes
  useEffect(() => {
    if (!announceValidation || !validation.touched) return;

    const newErrors = validation.errors;
    const hasNewErrors = JSON.stringify(newErrors) !== JSON.stringify(previousErrors);

    if (hasNewErrors && newErrors.length > 0) {
      const errorMessage = ScreenReaderTextUtils.createErrorDescription(label, newErrors);
      announceFieldError(label, errorMessage);
    }

    setPreviousErrors(newErrors);
  }, [validation.errors, validation.touched, announceValidation, label, announceFieldError, previousErrors]);

  // Handle field change
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.value;
    onChange?.(value);
  }, [onChange]);

  // Handle field blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Handle field focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Build ARIA attributes
  const ariaAttributes = {
    'aria-required': required,
    'aria-invalid': hasErrors,
    'aria-describedby': [
      description ? descId : null,
      hasErrors ? errorId : null
    ].filter(Boolean).join(' ') || undefined
  };

  // Render input element
  const renderInput = () => {
    const commonProps = {
      id: fieldId,
      name,
      className: `form-input ${hasErrors ? 'error' : ''} ${isFocused ? 'focused' : ''}`,
      onChange: handleChange,
      onBlur: handleBlur,
      onFocus: handleFocus,
      ...ariaAttributes,
      ...inputProps
    };

    switch (type) {
      case 'textarea':
        return <textarea {...commonProps} />;

      case 'select':
        return (
          <select {...commonProps}>
            {options.map(option => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return <input type={type} {...commonProps} />;
    }
  };

  // Render validation messages
  const renderValidation = () => {
    if (renderValidationMessage) {
      return renderValidationMessage(validation.errors, validation.warnings);
    }

    if (!hasErrors && !hasWarnings) return null;

    return (
      <div className="validation-messages mt-1">
        {hasErrors && (
          <div id={errorId} className="error-messages" role="alert">
            {validation.errors.map((error, index) => (
              <div key={index} className="error-message text-red-600 text-sm">
                {error}
              </div>
            ))}
          </div>
        )}

        {hasWarnings && (
          <div className="warning-messages">
            {validation.warnings!.map((warning, index) => (
              <div key={index} className="warning-message text-yellow-600 text-sm">
                {warning}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`form-field ${className} ${hasErrors ? 'has-error' : ''}`}>
      {/* Label */}
      <label htmlFor={fieldId} className="form-label">
        {label}
        {required && (
          <>
            <span className="required-indicator text-red-500" aria-label="required">*</span>
            <ScreenReaderOnly>, required field</ScreenReaderOnly>
          </>
        )}
      </label>

      {/* Description */}
      {description && (
        <div id={descId} className="field-description text-sm text-gray-600 mb-1">
          {description}
        </div>
      )}

      {/* Input */}
      {renderInput()}

      {/* Validation messages */}
      {renderValidation()}

      {/* Screen reader only validation state */}
      {validation.touched && (
        <ScreenReaderOnly>
          {hasErrors
            ? `${label} has ${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`
            : `${label} is valid`
          }
        </ScreenReaderOnly>
      )}
    </div>
  );
};

/**
 * Form validation summary component
 */
export const FormValidationSummary: React.FC<{
  errors: Record<string, ValidationError[]>;
  title?: string;
  showCount?: boolean;
  className?: string;
  onErrorClick?: (fieldName: string) => void;
}> = ({
  errors,
  title = 'Please correct the following errors:',
  showCount = true,
  className = '',
  onErrorClick
}) => {
  const errorEntries = Object.entries(errors).filter(([_, fieldErrors]) => fieldErrors.length > 0);
  const totalErrors = errorEntries.reduce((sum, [_, fieldErrors]) => sum + fieldErrors.length, 0);

  if (totalErrors === 0) return null;

  return (
    <div
      className={`form-validation-summary border border-red-300 bg-red-50 p-4 rounded-md ${className}`}
      role="alert"
      tabIndex={-1}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            {title}
            {showCount && ` (${totalErrors} error${totalErrors !== 1 ? 's' : ''})`}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul role="list" className="list-disc list-inside space-y-1">
              {errorEntries.map(([fieldName, fieldErrors]) =>
                fieldErrors.map((error, index) => (
                  <li key={`${fieldName}-${index}`}>
                    {onErrorClick ? (
                      <button
                        type="button"
                        className="text-red-800 underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500"
                        onClick={() => onErrorClick(fieldName)}
                      >
                        {error.field || fieldName}: {error.message}
                      </button>
                    ) : (
                      `${error.field || fieldName}: ${error.message}`
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for form validation with announcements
 */
export function useAccessibleFormValidation() {
  const [errors, setErrors] = useState<Record<string, ValidationError[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { announceFormValidation, announceValidationSummary } = useFormAnnouncements();

  const setFieldError = useCallback((fieldName: string, error: ValidationError) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: [error]
    }));
  }, []);

  const setFieldErrors = useCallback((fieldName: string, fieldErrors: ValidationError[]) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: fieldErrors
    }));
  }, []);

  const clearFieldErrors = useCallback((fieldName: string) => {
    setErrors(prev => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
    announceFormValidation(true);
  }, [announceFormValidation]);

  const validateForm = useCallback((validationErrors: Record<string, ValidationError[]>) => {
    setErrors(validationErrors);
    const hasErrors = Object.keys(validationErrors).length > 0;

    if (hasErrors) {
      announceValidationSummary(validationErrors);
    } else {
      announceFormValidation(true);
    }

    return !hasErrors;
  }, [announceFormValidation, announceValidationSummary]);

  const submitForm = useCallback(async (submitFn: () => Promise<void>) => {
    setIsSubmitting(true);
    try {
      await submitFn();
      clearAllErrors();
    } catch (error) {
      // Handle submission error
    } finally {
      setIsSubmitting(false);
    }
  }, [clearAllErrors]);

  return {
    errors,
    isSubmitting,
    setFieldError,
    setFieldErrors,
    clearFieldErrors,
    clearAllErrors,
    validateForm,
    submitForm,
    hasErrors: Object.keys(errors).length > 0
  };
}

export default AccessibleFormValidation;