/**
 * Accessible Checkbox Component
 *
 * Features:
 * - WCAG 2.1 AA compliant
 * - Full keyboard navigation support (Space key toggle)
 * - Proper ARIA attributes and roles
 * - Focus management with visible indicators
 * - Indeterminate state support
 * - Group checkbox functionality
 * - Screen reader announcements
 * - Error and validation states
 * - Label association
 */

import React, { useRef, useEffect, forwardRef, useId } from 'react';
import { AriaUtils, announceToScreenReader } from '../utils/accessibility';
import { useKeyboard } from '../contexts/KeyboardContext';
import './Checkbox.css';

export interface CheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Label text */
  label: string;
  /** Optional name attribute */
  name?: string;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Whether the checkbox is in an indeterminate state */
  indeterminate?: boolean;
  /** Error message to display */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Custom class name */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Custom aria-label */
  'aria-label'?: string;
  /** Custom aria-describedby */
  'aria-describedby'?: string;
  /** Focus handler */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Value for controlled forms */
  value?: string;
  /** ID for the input element */
  id?: string;
}

/**
 * Individual Checkbox component
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  checked,
  onChange,
  label,
  name,
  disabled = false,
  indeterminate = false,
  error,
  helperText,
  required = false,
  readOnly = false,
  size = 'medium',
  className = '',
  'data-testid': testId,
  autoFocus = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onFocus,
  onBlur,
  value,
  id: providedId,
}, ref) => {
  const internalRef = useRef<HTMLInputElement>(null);
  const checkboxRef = ref || internalRef;
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const helperTextId = helperText ? `${id}-helper` : undefined;
  const { state: keyboardState } = useKeyboard();

  // Handle indeterminate state
  useEffect(() => {
    if (checkboxRef && 'current' in checkboxRef && checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate, checkboxRef]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && checkboxRef && 'current' in checkboxRef && checkboxRef.current) {
      checkboxRef.current.focus();
    }
  }, [autoFocus, checkboxRef]);

  // Announce state changes for screen readers
  const previousCheckedRef = useRef(checked);
  const previousIndeterminateRef = useRef(indeterminate);

  useEffect(() => {
    if (previousCheckedRef.current !== checked || previousIndeterminateRef.current !== indeterminate) {
      let announcement = '';
      if (indeterminate) {
        announcement = `${label} partially selected`;
      } else if (checked) {
        announcement = `${label} selected`;
      } else {
        announcement = `${label} not selected`;
      }

      // Only announce if state actually changed to avoid spam
      if (previousCheckedRef.current !== checked || previousIndeterminateRef.current !== indeterminate) {
        announceToScreenReader(announcement, 'polite');
      }

      previousCheckedRef.current = checked;
      previousIndeterminateRef.current = indeterminate;
    }
  }, [checked, indeterminate, label]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || readOnly) {
      event.preventDefault();
      return;
    }

    const newChecked = event.target.checked;
    onChange(newChecked, event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Space key should toggle the checkbox
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (!disabled && !readOnly) {
        const syntheticEvent = {
          ...event,
          target: { ...event.target, checked: !checked }
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(!checked, syntheticEvent);
      }
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
  };

  // Build CSS classes
  const checkboxClasses = [
    'checkbox',
    `checkbox--${size}`,
    checked && 'checkbox--checked',
    indeterminate && 'checkbox--indeterminate',
    disabled && 'checkbox--disabled',
    readOnly && 'checkbox--readonly',
    error && 'checkbox--error',
    required && 'checkbox--required',
    keyboardState.isKeyboardMode && 'checkbox--keyboard-mode',
    className
  ].filter(Boolean).join(' ');

  // Build describedBy string
  const describedBy = [
    errorId,
    helperTextId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  // Determine ARIA attributes
  const ariaChecked = indeterminate ? 'mixed' : checked;

  return (
    <div className={checkboxClasses} data-testid={testId}>
      <div className="checkbox__input-container">
        <input
          ref={checkboxRef}
          id={id}
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          className="checkbox__input"
          aria-checked={ariaChecked}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          aria-required={required || undefined}
          data-testid={testId ? `${testId}-input` : undefined}
        />

        {/* Custom checkbox visual */}
        <div
          className="checkbox__visual"
          aria-hidden="true"
          data-state={indeterminate ? 'indeterminate' : (checked ? 'checked' : 'unchecked')}
        >
          {/* Checkmark icon */}
          {checked && !indeterminate && (
            <svg className="checkbox__checkmark" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
              />
            </svg>
          )}

          {/* Indeterminate icon */}
          {indeterminate && (
            <svg className="checkbox__indeterminate" viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Label */}
      <label
        htmlFor={id}
        className="checkbox__label"
      >
        {label}
        {required && (
          <span className="checkbox__required" aria-label="required">
            *
          </span>
        )}
      </label>

      {/* Helper text */}
      {helperText && !error && (
        <div
          id={helperTextId}
          className="checkbox__helper-text"
        >
          {helperText}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          id={errorId}
          className="checkbox__error"
          role="alert"
          aria-live="polite"
        >
          <span className="checkbox__error-icon" aria-hidden="true">⚠</span>
          {error}
        </div>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

export interface CheckboxGroupProps {
  /** Label for the checkbox group */
  label: string;
  /** Children checkboxes */
  children: React.ReactNode;
  /** Whether the group is disabled */
  disabled?: boolean;
  /** Error message for the group */
  error?: string;
  /** Helper text for the group */
  helperText?: string;
  /** Whether the group is required */
  required?: boolean;
  /** Custom class name */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Orientation of the group */
  orientation?: 'vertical' | 'horizontal';
  /** Spacing between checkboxes */
  spacing?: 'compact' | 'normal' | 'relaxed';
}

/**
 * Checkbox Group component for managing multiple checkboxes
 */
export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  label,
  children,
  disabled = false,
  error,
  helperText,
  required = false,
  className = '',
  'data-testid': testId,
  orientation = 'vertical',
  spacing = 'normal'
}) => {
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;
  const helperTextId = helperText ? `${groupId}-helper` : undefined;
  const { state: keyboardState } = useKeyboard();

  // Build CSS classes
  const groupClasses = [
    'checkbox-group',
    `checkbox-group--${orientation}`,
    `checkbox-group--${spacing}`,
    disabled && 'checkbox-group--disabled',
    error && 'checkbox-group--error',
    required && 'checkbox-group--required',
    keyboardState.isKeyboardMode && 'checkbox-group--keyboard-mode',
    className
  ].filter(Boolean).join(' ');

  // Build describedBy string
  const describedBy = [
    errorId,
    helperTextId
  ].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset
      className={groupClasses}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={error ? 'true' : undefined}
      aria-required={required || undefined}
      data-testid={testId}
    >
      <legend className="checkbox-group__legend">
        {label}
        {required && (
          <span className="checkbox-group__required" aria-label="required">
            *
          </span>
        )}
      </legend>

      <div className="checkbox-group__items">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === Checkbox) {
            return React.cloneElement(child, {
              disabled: disabled || child.props.disabled
            });
          }
          return child;
        })}
      </div>

      {/* Helper text */}
      {helperText && !error && (
        <div
          id={helperTextId}
          className="checkbox-group__helper-text"
        >
          {helperText}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          id={errorId}
          className="checkbox-group__error"
          role="alert"
          aria-live="polite"
        >
          <span className="checkbox-group__error-icon" aria-hidden="true">⚠</span>
          {error}
        </div>
      )}
    </fieldset>
  );
};

export default Checkbox;