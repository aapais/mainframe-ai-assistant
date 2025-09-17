/**
 * Input Atom Component
 * Atomic Design Level: Atom
 *
 * A versatile input component with multiple variants, states, and accessibility features
 */

import React, { forwardRef, useState, useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/className';

const inputVariants = cva(
  [
    'flex w-full rounded-md border bg-background px-3 py-2 text-sm',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-text-placeholder',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-primary-500 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-all duration-200 ease-out'
  ],
  {
    variants: {
      variant: {
        default: [
          'border-border-primary bg-surface-primary',
          'hover:border-border-secondary',
          'focus:border-border-focus',
          'data-[error]:border-border-error data-[error]:ring-error-500'
        ],
        filled: [
          'border-transparent bg-surface-secondary',
          'hover:bg-surface-elevated',
          'focus:bg-surface-primary focus:border-border-focus',
          'data-[error]:border-border-error data-[error]:ring-error-500'
        ],
        ghost: [
          'border-transparent bg-transparent',
          'hover:bg-surface-secondary',
          'focus:bg-surface-primary focus:border-border-focus',
          'data-[error]:border-border-error data-[error]:ring-error-500'
        ],
        flushed: [
          'border-0 border-b-2 border-border-primary bg-transparent rounded-none px-0',
          'hover:border-border-secondary',
          'focus:border-border-focus',
          'data-[error]:border-border-error'
        ]
      },
      size: {
        xs: 'h-6 px-2 py-1 text-xs',
        sm: 'h-8 px-2 py-1 text-xs',
        md: 'h-10 px-3 py-2 text-sm',
        lg: 'h-12 px-4 py-3 text-base',
        xl: 'h-14 px-4 py-4 text-lg'
      },
      state: {
        default: '',
        error: 'border-error-500 focus:ring-error-500',
        success: 'border-success-500 focus:ring-success-500',
        warning: 'border-warning-500 focus:ring-warning-500'
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
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  isLoading?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  showRequiredIndicator?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  helperTextClassName?: string;
  errorClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    variant,
    size,
    state,
    type = 'text',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    leftAddon,
    rightAddon,
    isLoading = false,
    isInvalid = false,
    isRequired = false,
    showRequiredIndicator = true,
    containerClassName,
    labelClassName,
    helperTextClassName,
    errorClassName,
    disabled,
    'aria-describedby': ariaDescribedBy,
    ...props
  }, ref) => {
    const inputId = useId();
    const errorId = `${inputId}-error`;
    const helperTextId = `${inputId}-helper`;

    const [isFocused, setIsFocused] = useState(false);

    // Determine the state based on error prop and isInvalid
    const computedState = error || isInvalid ? 'error' : state;

    // Build aria-describedby string
    const describedBy = [
      error ? errorId : null,
      helperText ? helperTextId : null,
      ariaDescribedBy
    ].filter(Boolean).join(' ');

    const hasLeftElement = leftIcon || leftAddon;
    const hasRightElement = rightIcon || rightAddon || isLoading;

    const LoadingSpinner = () => (
      <svg
        className="animate-spin h-4 w-4 text-text-secondary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    return (
      <div className={cn('flex flex-col space-y-2', containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium text-text-primary',
              disabled && 'text-text-disabled',
              labelClassName
            )}
          >
            {label}
            {isRequired && showRequiredIndicator && (
              <span className="text-error-500 ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        {/* Input Container */}
        <div className="relative flex items-center">
          {/* Left Addon */}
          {leftAddon && (
            <div className={cn(
              'flex items-center justify-center',
              'border border-r-0 border-border-primary bg-surface-secondary',
              'rounded-l-md px-3',
              size === 'xs' && 'h-6 px-2 text-xs',
              size === 'sm' && 'h-8 px-2 text-xs',
              size === 'md' && 'h-10 px-3 text-sm',
              size === 'lg' && 'h-12 px-4 text-base',
              size === 'xl' && 'h-14 px-4 text-lg',
              'text-text-secondary',
              disabled && 'opacity-50'
            )}>
              {leftAddon}
            </div>
          )}

          {/* Input Wrapper */}
          <div className="relative flex-1">
            {/* Left Icon */}
            {leftIcon && (
              <div className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                'text-text-secondary pointer-events-none',
                size === 'xs' && 'left-2',
                size === 'sm' && 'left-2',
                disabled && 'opacity-50'
              )}>
                {leftIcon}
              </div>
            )}

            {/* Input Element */}
            <input
              ref={ref}
              id={inputId}
              type={type}
              className={cn(
                inputVariants({ variant, size, state: computedState }),
                hasLeftElement && 'pl-10',
                hasRightElement && 'pr-10',
                leftAddon && 'rounded-l-none',
                rightAddon && 'rounded-r-none',
                className
              )}
              data-error={error || isInvalid ? true : undefined}
              data-focused={isFocused ? true : undefined}
              disabled={disabled || isLoading}
              aria-invalid={error || isInvalid ? 'true' : 'false'}
              aria-describedby={describedBy || undefined}
              aria-required={isRequired}
              onFocus={(e) => {
                setIsFocused(true);
                props.onFocus?.(e);
              }}
              onBlur={(e) => {
                setIsFocused(false);
                props.onBlur?.(e);
              }}
              {...props}
            />

            {/* Right Icon or Loading */}
            {(rightIcon || isLoading) && (
              <div className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                'text-text-secondary pointer-events-none',
                size === 'xs' && 'right-2',
                size === 'sm' && 'right-2',
                disabled && 'opacity-50'
              )}>
                {isLoading ? <LoadingSpinner /> : rightIcon}
              </div>
            )}
          </div>

          {/* Right Addon */}
          {rightAddon && (
            <div className={cn(
              'flex items-center justify-center',
              'border border-l-0 border-border-primary bg-surface-secondary',
              'rounded-r-md px-3',
              size === 'xs' && 'h-6 px-2 text-xs',
              size === 'sm' && 'h-8 px-2 text-xs',
              size === 'md' && 'h-10 px-3 text-sm',
              size === 'lg' && 'h-12 px-4 text-base',
              size === 'xl' && 'h-14 px-4 text-lg',
              'text-text-secondary',
              disabled && 'opacity-50'
            )}>
              {rightAddon}
            </div>
          )}
        </div>

        {/* Helper Text or Error */}
        {(helperText || error) && (
          <div className="space-y-1">
            {error && (
              <p
                id={errorId}
                className={cn(
                  'text-xs text-error-600 flex items-center gap-1',
                  errorClassName
                )}
                role="alert"
                aria-live="polite"
              >
                <svg
                  className="h-3 w-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}
            {helperText && !error && (
              <p
                id={helperTextId}
                className={cn(
                  'text-xs text-text-secondary',
                  helperTextClassName
                )}
              >
                {helperText}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Specialized Input Components

// Number Input with increment/decrement buttons
export interface NumberInputProps extends Omit<InputProps, 'type'> {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  showSteppers?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({
    min,
    max,
    step = 1,
    precision,
    showSteppers = true,
    value,
    onChange,
    ...props
  }, ref) => {
    const handleIncrement = () => {
      const currentValue = parseFloat(value as string) || 0;
      const newValue = currentValue + step;
      const clampedValue = max !== undefined ? Math.min(newValue, max) : newValue;
      const finalValue = precision !== undefined
        ? parseFloat(clampedValue.toFixed(precision))
        : clampedValue;

      onChange?.({
        target: { value: finalValue.toString() }
      } as React.ChangeEvent<HTMLInputElement>);
    };

    const handleDecrement = () => {
      const currentValue = parseFloat(value as string) || 0;
      const newValue = currentValue - step;
      const clampedValue = min !== undefined ? Math.max(newValue, min) : newValue;
      const finalValue = precision !== undefined
        ? parseFloat(clampedValue.toFixed(precision))
        : clampedValue;

      onChange?.({
        target: { value: finalValue.toString() }
      } as React.ChangeEvent<HTMLInputElement>);
    };

    const stepperButtons = showSteppers ? (
      <div className="flex flex-col border-l border-border-primary">
        <button
          type="button"
          className={cn(
            'flex items-center justify-center w-6 h-5',
            'hover:bg-surface-secondary transition-colors',
            'focus:outline-none focus:bg-surface-secondary',
            'text-text-secondary hover:text-text-primary'
          )}
          onClick={handleIncrement}
          tabIndex={-1}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          className={cn(
            'flex items-center justify-center w-6 h-5',
            'hover:bg-surface-secondary transition-colors',
            'focus:outline-none focus:bg-surface-secondary',
            'text-text-secondary hover:text-text-primary'
          )}
          onClick={handleDecrement}
          tabIndex={-1}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    ) : null;

    return (
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        rightAddon={stepperButtons}
        {...props}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';

// Search Input with search icon and clear button
export interface SearchInputProps extends Omit<InputProps, 'type' | 'leftIcon'> {
  onClear?: () => void;
  showClearButton?: boolean;
  searchIconPosition?: 'left' | 'right';
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({
    onClear,
    showClearButton = true,
    searchIconPosition = 'left',
    value,
    ...props
  }, ref) => {
    const searchIcon = (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );

    const clearButton = showClearButton && value ? (
      <button
        type="button"
        onClick={onClear}
        className="hover:text-text-primary transition-colors"
        aria-label="Clear search"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    ) : null;

    return (
      <Input
        ref={ref}
        type="search"
        placeholder="Search..."
        value={value}
        leftIcon={searchIconPosition === 'left' ? searchIcon : undefined}
        rightIcon={searchIconPosition === 'right' ? searchIcon : clearButton}
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { Input, inputVariants };
export type { InputProps };