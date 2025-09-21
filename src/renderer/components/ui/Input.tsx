/**
 * Enhanced Input Component
 * Accessible input with multiple variants, states, and features
 */

import React, { forwardRef, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/className';
import { Eye, EyeOff, Search, X } from 'lucide-react';

const inputVariants = cva(
  [
    'flex w-full rounded-lg border border-input bg-background text-sm ring-offset-background',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-all duration-200 ease-in-out',
    'hover:shadow-sm focus:shadow-md'
  ],
  {
    variants: {
      variant: {
        default: 'border-gray-300 bg-white hover:border-gray-400 focus:border-purple-500 hover:bg-gray-50 focus:bg-white',
        outline: 'border-gray-300 bg-transparent hover:border-gray-400 focus:border-purple-500 hover:bg-gray-50 focus:bg-white',
        ghost: 'border-transparent bg-gray-50 hover:bg-gray-100 focus:bg-white focus:border-gray-300',
        search: 'border-gray-300 bg-white hover:border-gray-400 focus:border-purple-500 hover:bg-gray-50 focus:bg-white pl-10'
      },
      size: {
        sm: 'h-8 px-3 py-1 text-xs min-h-[32px]',
        default: 'h-10 px-4 py-2 min-h-[44px]',
        lg: 'h-12 px-4 py-3 text-base min-h-[48px]'
      },
      state: {
        default: '',
        error: 'border-red-500 focus:border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:border-green-500 focus:ring-green-500',
        warning: 'border-amber-500 focus:border-amber-500 focus:ring-amber-500'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      state: 'default'
    }
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  error?: string;
  success?: string;
  warning?: string;
  helper?: string;
  label?: string;
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    variant,
    size,
    state,
    type = 'text',
    leftIcon,
    rightIcon,
    clearable = false,
    onClear,
    error,
    success,
    warning,
    helper,
    label,
    required,
    value,
    disabled,
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Determine state based on props
    const currentState = error ? 'error' : success ? 'success' : warning ? 'warning' : state;

    // Handle password toggle
    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    // Handle clear
    const handleClear = () => {
      onClear?.();
      const event = new Event('input', { bubbles: true });
      Object.defineProperty(event, 'target', {
        writable: false,
        value: { value: '' }
      });
      props.onChange?.(event as any);
    };

    const inputType = type === 'password' && showPassword ? 'text' : type;
    const hasValue = value && value.toString().length > 0;
    const showClearButton = clearable && hasValue && !disabled;
    const showPasswordToggle = type === 'password' && !disabled;

    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium mb-2',
              disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Search Icon for search variant */}
          {variant === 'search' && !leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
          )}

          {/* Input Element */}
          <input
            id={inputId}
            type={inputType}
            className={cn(
              inputVariants({ variant, size, state: currentState }),
              leftIcon && 'pl-10',
              variant === 'search' && !leftIcon && 'pl-10',
              (rightIcon || showClearButton || showPasswordToggle) && 'pr-10',
              (showClearButton && showPasswordToggle) && 'pr-16',
              className
            )}
            ref={ref}
            value={value}
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` :
              success ? `${inputId}-success` :
              warning ? `${inputId}-warning` :
              helper ? `${inputId}-helper` : undefined
            }
            {...props}
          />

          {/* Right Side Icons */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            {/* Clear Button */}
            {showClearButton && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded p-1"
                aria-label="Clear input"
                tabIndex={-1}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Password Toggle */}
            {showPasswordToggle && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}

            {/* Custom Right Icon */}
            {rightIcon && !showClearButton && !showPasswordToggle && (
              <div className="text-gray-400">
                {rightIcon}
              </div>
            )}
          </div>
        </div>

        {/* Helper/Error Messages */}
        {(error || success || warning || helper) && (
          <div className="mt-2">
            {error && (
              <p
                id={`${inputId}-error`}
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
            {success && !error && (
              <p
                id={`${inputId}-success`}
                className="text-sm text-green-600 dark:text-green-400"
              >
                {success}
              </p>
            )}
            {warning && !error && !success && (
              <p
                id={`${inputId}-warning`}
                className="text-sm text-amber-600 dark:text-amber-400"
              >
                {warning}
              </p>
            )}
            {helper && !error && !success && !warning && (
              <p
                id={`${inputId}-helper`}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {helper}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Search Input Component
 */
export interface SearchInputProps extends Omit<InputProps, 'variant' | 'leftIcon'> {
  onSearch?: (value: string) => void;
  searchDelay?: number;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch, searchDelay = 300, ...props }, ref) => {
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Clear existing timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // Set new timeout for search
      if (onSearch) {
        const timeout = setTimeout(() => {
          onSearch(value);
        }, searchDelay);
        setSearchTimeout(timeout);
      }

      props.onChange?.(e);
    };

    return (
      <Input
        ref={ref}
        type="search"
        variant="search"
        placeholder="Search..."
        clearable
        {...props}
        onChange={handleChange}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';

/**
 * Textarea Component
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  success?: string;
  warning?: string;
  helper?: string;
  label?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    error,
    success,
    warning,
    helper,
    label,
    required,
    disabled,
    ...props
  }, ref) => {
    const textareaId = props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const currentState = error ? 'error' : success ? 'success' : warning ? 'warning' : 'default';

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              'block text-sm font-medium mb-2',
              disabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Textarea */}
        <textarea
          id={textareaId}
          className={cn(
            'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-200',
            'min-h-[80px] resize-vertical',
            currentState === 'error' && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            currentState === 'success' && 'border-green-500 focus:border-green-500 focus:ring-green-500',
            currentState === 'warning' && 'border-amber-500 focus:border-amber-500 focus:ring-amber-500',
            className
          )}
          ref={ref}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${textareaId}-error` :
            success ? `${textareaId}-success` :
            warning ? `${textareaId}-warning` :
            helper ? `${textareaId}-helper` : undefined
          }
          {...props}
        />

        {/* Helper/Error Messages */}
        {(error || success || warning || helper) && (
          <div className="mt-2">
            {error && (
              <p
                id={`${textareaId}-error`}
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
            {success && !error && (
              <p
                id={`${textareaId}-success`}
                className="text-sm text-green-600 dark:text-green-400"
              >
                {success}
              </p>
            )}
            {warning && !error && !success && (
              <p
                id={`${textareaId}-warning`}
                className="text-sm text-amber-600 dark:text-amber-400"
              >
                {warning}
              </p>
            )}
            {helper && !error && !success && !warning && (
              <p
                id={`${textareaId}-helper`}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {helper}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Input, inputVariants };
// SearchInput and Textarea are already exported above as named exports
export type { InputProps, SearchInputProps, TextareaProps };