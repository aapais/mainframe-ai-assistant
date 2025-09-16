import React, { forwardRef, useState, useEffect, useRef, memo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, focusRing, transition } from '../../utils/className';
import { Label } from './Typography';

// Input variant definitions
const inputVariants = cva(
  [
    'flex w-full border border-border bg-background text-sm transition-colors',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive'
  ],
  {
    variants: {
      variant: {
        default: 'border-input bg-background hover:bg-accent/5',
        filled: 'border-transparent bg-muted hover:bg-muted/80 focus:bg-background focus:border-input',
        flushed: 'border-0 border-b-2 border-border bg-transparent rounded-none px-0 focus:border-primary',
        unstyled: 'border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0'
      },
      size: {
        sm: 'h-8 px-3 py-1 text-xs rounded-md',
        md: 'h-10 px-3 py-2 text-sm rounded-md',
        lg: 'h-12 px-4 py-3 text-base rounded-lg'
      },
      state: {
        default: '',
        error: 'border-danger focus-visible:ring-danger',
        success: 'border-success focus-visible:ring-success',
        warning: 'border-warning focus-visible:ring-warning'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      state: 'default'
    }
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  description?: string;
  errorMessage?: string;
  successMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  helperText?: string;
  showCharacterCount?: boolean;
  maxLength?: number;
  clearable?: boolean;
  loading?: boolean;
  onClear?: () => void;
}

// Main Input component
const Input = memo(forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    variant,
    size,
    state,
    type = 'text',
    label,
    description,
    errorMessage,
    successMessage,
    leftIcon,
    rightIcon,
    leftAddon,
    rightAddon,
    helperText,
    showCharacterCount,
    maxLength,
    clearable = false,
    loading = false,
    disabled,
    value,
    onChange,
    onClear,
    id,
    ...props
  }, ref) => {
    const [internalValue, setInternalValue] = useState(value || '');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    // Sync internal value with external value
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    // Determine the current state
    const currentState = errorMessage ? 'error' : 
                        successMessage ? 'success' : 
                        state;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(e);
    };

    const handleClear = () => {
      setInternalValue('');
      onClear?.();
      if (onChange) {
        const syntheticEvent = {
          target: { value: '' },
          currentTarget: { value: '' }
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
      inputRef.current?.focus();
    };

    const inputClasses = cn(
      inputVariants({ variant, size, state: currentState }),
      leftIcon && 'pl-9',
      rightIcon && 'pr-9',
      (clearable || loading) && 'pr-9',
      className
    );

    const characterCount = String(internalValue).length;
    const showClearButton = clearable && internalValue && !disabled && !loading;

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <Label 
            htmlFor={inputId} 
            className={cn(
              'mb-2 block',
              currentState === 'error' && 'text-danger',
              currentState === 'success' && 'text-success',
              disabled && 'text-muted-foreground'
            )}
          >
            {label}
            {props.required && (
              <span className="text-danger ml-1" aria-label="required">*</span>
            )}
          </Label>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground mb-2">
            {description}
          </p>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Addon */}
          {leftAddon && (
            <div className="absolute left-0 top-0 bottom-0 flex items-center pl-3 pointer-events-none">
              {leftAddon}
            </div>
          )}

          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Input Element */}
          <input
            ref={inputRef}
            id={inputId}
            type={type}
            value={internalValue}
            onChange={handleChange}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            disabled={disabled || loading}
            maxLength={maxLength}
            aria-invalid={currentState === 'error'}
            aria-describedby={cn(
              errorMessage && `${inputId}-error`,
              successMessage && `${inputId}-success`,
              helperText && `${inputId}-help`,
              showCharacterCount && `${inputId}-count`
            )}
            className={inputClasses}
            {...props}
          />

          {/* Right Icon */}
          {rightIcon && !showClearButton && !loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {rightIcon}
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {/* Clear Button */}
          {showClearButton && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:text-foreground focus:outline-none"
              aria-label="Clear input"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Right Addon */}
          {rightAddon && (
            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3 pointer-events-none">
              {rightAddon}
            </div>
          )}
        </div>

        {/* Helper Text / Error / Success Messages */}
        <div className="mt-2 min-h-[1.25rem]">
          {errorMessage && (
            <p
              id={`${inputId}-error`}
              className="text-sm text-danger flex items-center gap-1"
              role="alert"
              aria-live="polite"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errorMessage}
            </p>
          )}
          
          {successMessage && !errorMessage && (
            <p
              id={`${inputId}-success`}
              className="text-sm text-success flex items-center gap-1"
              aria-live="polite"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {successMessage}
            </p>
          )}
          
          {helperText && !errorMessage && !successMessage && (
            <p
              id={`${inputId}-help`}
              className="text-sm text-muted-foreground"
            >
              {helperText}
            </p>
          )}
        </div>

        {/* Character Count */}
        {showCharacterCount && maxLength && (
          <div className="flex justify-end">
            <span
              id={`${inputId}-count`}
              className={cn(
                'text-xs mt-1',
                characterCount > maxLength * 0.9 ? 'text-warning' : 'text-muted-foreground',
                characterCount >= maxLength && 'text-danger'
              )}
              aria-live="polite"
            >
              {characterCount}/{maxLength}
            </span>
          </div>
        )}
      </div>
    );
  }
));

Input.displayName = 'Input';

// Textarea Component
const textareaVariants = cva(
  [
    'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'resize-vertical'
  ]
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  errorMessage?: string;
  successMessage?: string;
  helperText?: string;
  showCharacterCount?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = memo(forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    label,
    description,
    errorMessage,
    successMessage,
    helperText,
    showCharacterCount,
    maxLength,
    resize = 'vertical',
    id,
    value,
    onChange,
    ...props
  }, ref) => {
    const [internalValue, setInternalValue] = useState(value || '');
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(e);
    };

    const characterCount = String(internalValue).length;
    const hasError = !!errorMessage;
    const hasSuccess = !!successMessage && !hasError;

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize'
    };

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <Label 
            htmlFor={textareaId} 
            className={cn(
              'mb-2 block',
              hasError && 'text-danger',
              hasSuccess && 'text-success'
            )}
          >
            {label}
            {props.required && (
              <span className="text-danger ml-1" aria-label="required">*</span>
            )}
          </Label>
        )}

        {/* Description */}
        {description && (
          <p
            id={`${textareaId}-description`}
            className="text-sm text-muted-foreground mb-2"
          >
            {description}
          </p>
        )}

        {/* Textarea */}
        <textarea
          ref={ref}
          id={textareaId}
          value={internalValue}
          onChange={handleChange}
          maxLength={maxLength}
          aria-invalid={hasError}
          aria-describedby={cn(
            errorMessage && `${textareaId}-error`,
            successMessage && `${textareaId}-success`,
            helperText && `${textareaId}-help`,
            showCharacterCount && `${textareaId}-count`
          )}
          className={cn(
            textareaVariants(),
            resizeClasses[resize],
            hasError && 'border-danger focus-visible:ring-danger',
            hasSuccess && 'border-success focus-visible:ring-success',
            className
          )}
          {...props}
        />

        {/* Helper Text / Error / Success Messages */}
        <div className="mt-2 min-h-[1.25rem] flex justify-between">
          <div className="flex-1">
            {errorMessage && (
              <p
                id={`${textareaId}-error`}
                className="text-sm text-danger flex items-center gap-1"
                role="alert"
                aria-live="polite"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {errorMessage}
              </p>
            )}
            
            {successMessage && !errorMessage && (
              <p
                id={`${textareaId}-success`}
                className="text-sm text-success flex items-center gap-1"
                aria-live="polite"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {successMessage}
              </p>
            )}
            
            {helperText && !errorMessage && !successMessage && (
              <p
                id={`${textareaId}-help`}
                className="text-sm text-muted-foreground"
              >
                {helperText}
              </p>
            )}
          </div>

          {/* Character Count */}
          {showCharacterCount && maxLength && (
            <span
              id={`${textareaId}-count`}
              className={cn(
                'text-xs mt-1 ml-2 flex-shrink-0',
                characterCount > maxLength * 0.9 ? 'text-warning' : 'text-muted-foreground',
                characterCount >= maxLength && 'text-danger'
              )}
              aria-live="polite"
            >
              {characterCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
));

Textarea.displayName = 'Textarea';

// Export components
export { Input, Textarea };
export type { InputProps, TextareaProps };