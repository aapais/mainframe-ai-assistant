/**
 * Accessible RadioButton Component
 *
 * Features:
 * - WCAG 2.1 AA compliant
 * - Full keyboard navigation support (Arrow keys between options)
 * - Proper ARIA attributes and roles
 * - Focus management with visible indicators
 * - RadioGroup container component
 * - Proper fieldset/legend structure
 * - Screen reader announcements
 * - Error and validation states
 * - Label association
 */

import React, { useRef, useEffect, forwardRef, useId, useContext, createContext } from 'react';
import { AriaUtils, announceToScreenReader } from '../utils/accessibility';
import { useKeyboard } from '../contexts/KeyboardContext';
import './RadioButton.css';

// Context for radio group management
interface RadioGroupContextValue {
  name: string;
  value: string;
  onChange: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
  required: boolean;
  error?: string;
  size: 'small' | 'medium' | 'large';
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioButtonProps {
  /** Value of this radio option */
  value: string;
  /** Label text */
  label: string;
  /** Whether this radio is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Custom aria-label */
  'aria-label'?: string;
  /** Custom aria-describedby */
  'aria-describedby'?: string;
  /** Focus handler */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** ID for the input element */
  id?: string;
  /** Helper text for this specific option */
  helperText?: string;
}

/**
 * Individual RadioButton component - must be used within RadioGroup
 */
export const RadioButton = forwardRef<HTMLInputElement, RadioButtonProps>(({
  value,
  label,
  disabled: individualDisabled = false,
  className = '',
  'data-testid': testId,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  onFocus,
  onBlur,
  id: providedId,
  helperText,
}, ref) => {
  const groupContext = useContext(RadioGroupContext);

  if (!groupContext) {
    throw new Error('RadioButton must be used within a RadioGroup');
  }

  const {
    name,
    value: groupValue,
    onChange,
    disabled: groupDisabled,
    required,
    error,
    size
  } = groupContext;

  const internalRef = useRef<HTMLInputElement>(null);
  const radioRef = ref || internalRef;
  const generatedId = useId();
  const id = providedId || `${name}-${value}-${generatedId}`;
  const helperTextId = helperText ? `${id}-helper` : undefined;
  const { state: keyboardState } = useKeyboard();

  const disabled = groupDisabled || individualDisabled;
  const checked = groupValue === value;

  // Announce state changes for screen readers
  const previousCheckedRef = useRef(checked);

  useEffect(() => {
    if (previousCheckedRef.current !== checked && checked) {
      announceToScreenReader(`${label} selected`, 'polite');
      previousCheckedRef.current = checked;
    }
  }, [checked, label]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    onChange(value, event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
  };

  // Build CSS classes
  const radioClasses = [
    'radio-button',
    `radio-button--${size}`,
    checked && 'radio-button--checked',
    disabled && 'radio-button--disabled',
    error && 'radio-button--error',
    required && 'radio-button--required',
    keyboardState.isKeyboardMode && 'radio-button--keyboard-mode',
    className
  ].filter(Boolean).join(' ');

  // Build describedBy string
  const describedBy = [
    helperTextId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={radioClasses} data-testid={testId}>
      <div className="radio-button__input-container">
        <input
          ref={radioRef}
          id={id}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          className="radio-button__input"
          role="radio"
          aria-checked={checked}
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          data-testid={testId ? `${testId}-input` : undefined}
        />

        {/* Custom radio visual */}
        <div
          className="radio-button__visual"
          aria-hidden="true"
          data-state={checked ? 'checked' : 'unchecked'}
        >
          {/* Radio dot */}
          {checked && (
            <div className="radio-button__dot" />
          )}
        </div>
      </div>

      {/* Label */}
      <label
        htmlFor={id}
        className="radio-button__label"
      >
        {label}
      </label>

      {/* Helper text for individual option */}
      {helperText && (
        <div
          id={helperTextId}
          className="radio-button__helper-text"
        >
          {helperText}
        </div>
      )}
    </div>
  );
});

RadioButton.displayName = 'RadioButton';

export interface RadioGroupProps {
  /** Label for the radio group */
  label: string;
  /** Current selected value */
  value: string;
  /** Change handler */
  onChange: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Name attribute for the radio inputs */
  name?: string;
  /** Children radio buttons */
  children: React.ReactNode;
  /** Whether the group is disabled */
  disabled?: boolean;
  /** Whether the group is required */
  required?: boolean;
  /** Error message for the group */
  error?: string;
  /** Helper text for the group */
  helperText?: string;
  /** Size of radio buttons */
  size?: 'small' | 'medium' | 'large';
  /** Custom class name */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Orientation of the group */
  orientation?: 'vertical' | 'horizontal';
  /** Spacing between radio buttons */
  spacing?: 'compact' | 'normal' | 'relaxed';
  /** Auto focus the selected or first option */
  autoFocus?: boolean;
}

/**
 * RadioGroup component for managing multiple radio buttons
 */
export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  value,
  onChange,
  name: providedName,
  children,
  disabled = false,
  required = false,
  error,
  helperText,
  size = 'medium',
  className = '',
  'data-testid': testId,
  orientation = 'vertical',
  spacing = 'normal',
  autoFocus = false
}) => {
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const generatedName = useId();
  const name = providedName || generatedName;
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;
  const helperTextId = helperText ? `${groupId}-helper` : undefined;
  const { state: keyboardState } = useKeyboard();

  // Auto focus management
  useEffect(() => {
    if (autoFocus && groupRef.current) {
      const selectedRadio = groupRef.current.querySelector<HTMLInputElement>(`input[value="${value}"]`);
      const firstRadio = groupRef.current.querySelector<HTMLInputElement>('input[type="radio"]');
      const radioToFocus = selectedRadio || firstRadio;

      if (radioToFocus && !disabled) {
        radioToFocus.focus();
      }
    }
  }, [autoFocus, value, disabled]);

  // Keyboard navigation between radio buttons
  useEffect(() => {
    if (!groupRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, target } = event;
      const currentTarget = target as HTMLElement;

      if (!currentTarget.matches('input[type="radio"]')) return;

      const radios = Array.from(groupRef.current!.querySelectorAll<HTMLInputElement>('input[type="radio"]:not([disabled])'));
      const currentIndex = radios.indexOf(currentTarget as HTMLInputElement);

      let nextIndex = currentIndex;

      switch (key) {
        case 'ArrowDown':
        case 'ArrowRight':
          nextIndex = currentIndex < radios.length - 1 ? currentIndex + 1 : 0;
          event.preventDefault();
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          nextIndex = currentIndex > 0 ? currentIndex - 1 : radios.length - 1;
          event.preventDefault();
          break;
        case 'Home':
          nextIndex = 0;
          event.preventDefault();
          break;
        case 'End':
          nextIndex = radios.length - 1;
          event.preventDefault();
          break;
        default:
          return;
      }

      if (nextIndex !== currentIndex) {
        const nextRadio = radios[nextIndex];
        nextRadio.focus();
        nextRadio.checked = true;

        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        Object.defineProperty(changeEvent, 'target', { value: nextRadio });
        onChange(nextRadio.value, changeEvent as any);
      }
    };

    groupRef.current.addEventListener('keydown', handleKeyDown);

    return () => {
      if (groupRef.current) {
        groupRef.current.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [onChange]);

  // Build CSS classes
  const groupClasses = [
    'radio-group',
    `radio-group--${orientation}`,
    `radio-group--${spacing}`,
    `radio-group--${size}`,
    disabled && 'radio-group--disabled',
    error && 'radio-group--error',
    required && 'radio-group--required',
    keyboardState.isKeyboardMode && 'radio-group--keyboard-mode',
    className
  ].filter(Boolean).join(' ');

  // Build describedBy string
  const describedBy = [
    errorId,
    helperTextId
  ].filter(Boolean).join(' ') || undefined;

  // Context value for child radio buttons
  const contextValue: RadioGroupContextValue = {
    name,
    value,
    onChange,
    disabled,
    required,
    error,
    size
  };

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <fieldset
        ref={groupRef}
        className={groupClasses}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required || undefined}
        data-testid={testId}
        role="radiogroup"
      >
        <legend className="radio-group__legend">
          {label}
          {required && (
            <span className="radio-group__required" aria-label="required">
              *
            </span>
          )}
        </legend>

        <div className="radio-group__items">
          {children}
        </div>

        {/* Helper text */}
        {helperText && !error && (
          <div
            id={helperTextId}
            className="radio-group__helper-text"
          >
            {helperText}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            id={errorId}
            className="radio-group__error"
            role="alert"
            aria-live="polite"
          >
            <span className="radio-group__error-icon" aria-hidden="true">⚠</span>
            {error}
          </div>
        )}
      </fieldset>
    </RadioGroupContext.Provider>
  );
};

export default RadioButton;