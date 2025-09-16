/**
 * Reusable FormField Component
 * Provides consistent form field rendering with accessibility, validation, and UX features
 */

import React, { forwardRef, useState, useId } from 'react';
import './FormField.css';

export interface BaseFieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  hintClassName?: string;
  
  // Accessibility
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  
  // Visual indicators
  showRequiredIndicator?: boolean;
  showOptionalIndicator?: boolean;
  showCharacterCount?: boolean;
  maxLength?: number;
  
  // Help and tooltips
  helpText?: string;
  tooltip?: string;
}

export interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'url' | 'tel';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'filled' | 'outlined';
}

export interface TextAreaFieldProps extends BaseFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
  autoResize?: boolean;
}

export interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  multiple?: boolean;
}

export interface CheckboxFieldProps extends Omit<BaseFieldProps, 'required'> {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Base FormField wrapper with accessibility and error handling
 */
export const FormField: React.FC<{
  children: React.ReactNode;
  fieldProps: BaseFieldProps;
  fieldId: string;
  currentLength?: number;
}> = ({ children, fieldProps, fieldId, currentLength }) => {
  const {
    label,
    name,
    error,
    hint,
    required,
    disabled,
    className = '',
    labelClassName = '',
    errorClassName = '',
    hintClassName = '',
    showRequiredIndicator = true,
    showOptionalIndicator = false,
    showCharacterCount = false,
    maxLength,
    helpText,
    tooltip
  } = fieldProps;

  const [showTooltip, setShowTooltip] = useState(false);
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const helpId = `${fieldId}-help`;
  
  const fieldClasses = [
    'form-field',
    error && 'form-field--error',
    disabled && 'form-field--disabled',
    required && 'form-field--required',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={fieldClasses}>
      <div className="form-field__label-container">
        <label 
          htmlFor={fieldId}
          className={`form-field__label ${labelClassName}`}
        >
          {label}
          {required && showRequiredIndicator && (
            <span className="form-field__required" aria-label="required">
              *
            </span>
          )}
          {!required && showOptionalIndicator && (
            <span className="form-field__optional">
              (optional)
            </span>
          )}
        </label>
        
        {tooltip && (
          <div className="form-field__tooltip-container">
            <button
              type="button"
              className="form-field__tooltip-trigger"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              aria-label="Show help"
            >
              ?
            </button>
            {showTooltip && (
              <div className="form-field__tooltip" role="tooltip">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="form-field__input-container">
        {children}
        
        {showCharacterCount && maxLength && (
          <div className="form-field__character-count">
            <span className={currentLength && currentLength > maxLength ? 'over-limit' : ''}>
              {currentLength || 0}/{maxLength}
            </span>
          </div>
        )}
      </div>
      
      {hint && !error && (
        <div 
          id={hintId}
          className={`form-field__hint ${hintClassName}`}
        >
          {hint}
        </div>
      )}
      
      {error && (
        <div 
          id={errorId}
          className={`form-field__error ${errorClassName}`}
          role="alert"
          aria-live="polite"
        >
          <span className="form-field__error-icon">⚠</span>
          {error}
        </div>
      )}
      
      {helpText && (
        <details className="form-field__help">
          <summary>Help</summary>
          <div id={helpId} className="form-field__help-content">
            {helpText}
          </div>
        </details>
      )}
    </div>
  );
};

/**
 * Text Input Field
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ 
    type = 'text',
    size = 'medium',
    variant = 'default',
    autoFocus = false,
    readOnly = false,
    ...props
  }, ref) => {
    const fieldId = useId();
    const currentLength = props.value.length;
    
    const inputClasses = [
      'form-field__input',
      'form-field__input--text',
      `form-field__input--${size}`,
      `form-field__input--${variant}`,
      props.error && 'form-field__input--error',
      props.disabled && 'form-field__input--disabled',
      readOnly && 'form-field__input--readonly',
      props.inputClassName
    ].filter(Boolean).join(' ');

    const describedBy = [
      props.error ? `${fieldId}-error` : null,
      props.hint && !props.error ? `${fieldId}-hint` : null,
      props.helpText ? `${fieldId}-help` : null,
      props['aria-describedby']
    ].filter(Boolean).join(' ');

    return (
      <FormField 
        fieldProps={props} 
        fieldId={fieldId} 
        currentLength={currentLength}
      >
        <input
          ref={ref}
          id={fieldId}
          type={type}
          name={props.name}
          value={props.value}
          onChange={props.onChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          autoFocus={autoFocus}
          disabled={props.disabled}
          readOnly={readOnly}
          maxLength={props.maxLength}
          className={inputClasses}
          aria-label={props['aria-label']}
          aria-labelledby={props['aria-labelledby']}
          aria-describedby={describedBy || undefined}
          aria-invalid={props['aria-invalid'] || !!props.error}
          aria-required={props.required}
        />
      </FormField>
    );
  }
);

TextField.displayName = 'TextField';

/**
 * TextArea Field with auto-resize capability
 */
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ 
    rows = 4,
    resize = 'vertical',
    autoResize = false,
    ...props
  }, ref) => {
    const fieldId = useId();
    const currentLength = props.value.length;
    
    const textareaClasses = [
      'form-field__input',
      'form-field__textarea',
      `form-field__textarea--${resize}`,
      props.error && 'form-field__input--error',
      props.disabled && 'form-field__input--disabled',
      autoResize && 'form-field__textarea--auto-resize',
      props.inputClassName
    ].filter(Boolean).join(' ');

    const describedBy = [
      props.error ? `${fieldId}-error` : null,
      props.hint && !props.error ? `${fieldId}-hint` : null,
      props.helpText ? `${fieldId}-help` : null,
      props['aria-describedby']
    ].filter(Boolean).join(' ');

    // Auto-resize functionality
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        
        // Apply min/max rows if specified
        if (props.minRows) {
          const minHeight = props.minRows * 24; // Approximate line height
          if (textarea.scrollHeight < minHeight) {
            textarea.style.height = `${minHeight}px`;
          }
        }
        if (props.maxRows) {
          const maxHeight = props.maxRows * 24;
          if (textarea.scrollHeight > maxHeight) {
            textarea.style.height = `${maxHeight}px`;
          }
        }
      }
      
      props.onChange(e);
    };

    return (
      <FormField 
        fieldProps={props} 
        fieldId={fieldId} 
        currentLength={currentLength}
      >
        <textarea
          ref={ref}
          id={fieldId}
          name={props.name}
          value={props.value}
          onChange={handleChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          placeholder={props.placeholder}
          disabled={props.disabled}
          rows={rows}
          maxLength={props.maxLength}
          className={textareaClasses}
          aria-label={props['aria-label']}
          aria-labelledby={props['aria-labelledby']}
          aria-describedby={describedBy || undefined}
          aria-invalid={props['aria-invalid'] || !!props.error}
          aria-required={props.required}
        />
      </FormField>
    );
  }
);

TextAreaField.displayName = 'TextAreaField';

/**
 * Select Field
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ options, placeholder, multiple = false, ...props }, ref) => {
    const fieldId = useId();
    
    const selectClasses = [
      'form-field__input',
      'form-field__select',
      props.error && 'form-field__input--error',
      props.disabled && 'form-field__input--disabled',
      props.inputClassName
    ].filter(Boolean).join(' ');

    const describedBy = [
      props.error ? `${fieldId}-error` : null,
      props.hint && !props.error ? `${fieldId}-hint` : null,
      props.helpText ? `${fieldId}-help` : null,
      props['aria-describedby']
    ].filter(Boolean).join(' ');

    return (
      <FormField fieldProps={props} fieldId={fieldId}>
        <select
          ref={ref}
          id={fieldId}
          name={props.name}
          value={props.value}
          onChange={props.onChange}
          onBlur={props.onBlur}
          onFocus={props.onFocus}
          disabled={props.disabled}
          multiple={multiple}
          className={selectClasses}
          aria-label={props['aria-label']}
          aria-labelledby={props['aria-labelledby']}
          aria-describedby={describedBy || undefined}
          aria-invalid={props['aria-invalid'] || !!props.error}
          aria-required={props.required}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
);

SelectField.displayName = 'SelectField';

/**
 * Checkbox Field
 */
export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ size = 'medium', indeterminate = false, ...props }, ref) => {
    const fieldId = useId();
    
    const checkboxClasses = [
      'form-field__checkbox',
      `form-field__checkbox--${size}`,
      props.error && 'form-field__checkbox--error',
      props.disabled && 'form-field__checkbox--disabled',
      props.inputClassName
    ].filter(Boolean).join(' ');

    const describedBy = [
      props.error ? `${fieldId}-error` : null,
      props.hint && !props.error ? `${fieldId}-hint` : null,
      props.helpText ? `${fieldId}-help` : null,
      props['aria-describedby']
    ].filter(Boolean).join(' ');

    // Handle indeterminate state
    React.useEffect(() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.indeterminate = indeterminate;
      }
    }, [indeterminate, ref]);

    return (
      <FormField fieldProps={props} fieldId={fieldId}>
        <div className="form-field__checkbox-wrapper">
          <input
            ref={ref}
            id={fieldId}
            type="checkbox"
            name={props.name}
            checked={props.checked}
            onChange={props.onChange}
            onBlur={props.onBlur}
            onFocus={props.onFocus}
            disabled={props.disabled}
            className={checkboxClasses}
            aria-label={props['aria-label']}
            aria-labelledby={props['aria-labelledby']}
            aria-describedby={describedBy || undefined}
            aria-invalid={props['aria-invalid'] || !!props.error}
          />
          <label htmlFor={fieldId} className="form-field__checkbox-label">
            {props.label}
          </label>
        </div>
      </FormField>
    );
  }
);

CheckboxField.displayName = 'CheckboxField';