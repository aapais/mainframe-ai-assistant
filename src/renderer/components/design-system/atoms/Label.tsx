/**
 * Label Atom Component
 * Atomic Design Level: Atom
 *
 * A comprehensive label component with various styles and accessibility features
 */

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/className';

const labelVariants = cva(
  [
    'text-sm font-medium leading-none',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
  ],
  {
    variants: {
      variant: {
        default: 'text-text-primary',
        secondary: 'text-text-secondary',
        tertiary: 'text-text-tertiary',
        inverse: 'text-text-inverse',
        success: 'text-success-600',
        warning: 'text-warning-600',
        error: 'text-error-600'
      },
      size: {
        xs: 'text-xs',
        sm: 'text-sm',
        md: 'text-sm',
        lg: 'text-base',
        xl: 'text-lg'
      },
      weight: {
        light: 'font-light',
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold'
      },
      spacing: {
        none: '',
        sm: 'mb-1',
        md: 'mb-2',
        lg: 'mb-3'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      weight: 'medium',
      spacing: 'sm'
    }
  }
);

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
  optional?: boolean;
  showRequiredIndicator?: boolean;
  showOptionalIndicator?: boolean;
  requiredIndicator?: React.ReactNode;
  optionalIndicator?: React.ReactNode;
  tooltip?: string;
  description?: string;
  children: React.ReactNode;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({
    className,
    variant,
    size,
    weight,
    spacing,
    required = false,
    optional = false,
    showRequiredIndicator = true,
    showOptionalIndicator = false,
    requiredIndicator,
    optionalIndicator,
    tooltip,
    description,
    children,
    ...props
  }, ref) => {
    const [showTooltip, setShowTooltip] = React.useState(false);

    const defaultRequiredIndicator = (
      <span
        className="text-error-500 ml-1"
        aria-label="required"
      >
        *
      </span>
    );

    const defaultOptionalIndicator = (
      <span className="text-text-tertiary ml-1 font-normal">
        (optional)
      </span>
    );

    const tooltipIcon = (
      <button
        type="button"
        className={cn(
          'ml-1 inline-flex items-center justify-center',
          'w-4 h-4 rounded-full bg-neutral-200 text-text-secondary',
          'hover:bg-neutral-300 hover:text-text-primary',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
          'transition-colors duration-150'
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label="Show help tooltip"
      >
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    );

    return (
      <div className="flex flex-col">
        <div className="flex items-center relative">
          <label
            ref={ref}
            className={cn(labelVariants({ variant, size, weight, spacing }), className)}
            {...props}
          >
            {children}

            {/* Required indicator */}
            {required && showRequiredIndicator && (
              requiredIndicator || defaultRequiredIndicator
            )}

            {/* Optional indicator */}
            {optional && showOptionalIndicator && !required && (
              optionalIndicator || defaultOptionalIndicator
            )}
          </label>

          {/* Tooltip */}
          {tooltip && (
            <div className="relative">
              {tooltipIcon}
              {showTooltip && (
                <div
                  className={cn(
                    'absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2',
                    'px-2 py-1 text-xs text-white bg-neutral-900 rounded-md',
                    'whitespace-nowrap z-50',
                    'before:content-[""] before:absolute before:top-full before:left-1/2',
                    'before:transform before:-translate-x-1/2 before:border-4',
                    'before:border-transparent before:border-t-neutral-900'
                  )}
                  role="tooltip"
                >
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p
            className={cn(
              'text-xs text-text-secondary mt-1',
              spacing === 'none' && 'mt-0.5',
              spacing === 'lg' && 'mt-1.5'
            )}
          >
            {description}
          </p>
        )}
      </div>
    );
  }
);

Label.displayName = 'Label';

// Field Label - specialized for form fields
export interface FieldLabelProps extends Omit<LabelProps, 'spacing'> {
  htmlFor: string;
  error?: string;
  hint?: string;
}

export const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({
    htmlFor,
    error,
    hint,
    variant = error ? 'error' : 'default',
    description = hint,
    ...props
  }, ref) => {
    return (
      <Label
        ref={ref}
        htmlFor={htmlFor}
        variant={variant}
        description={description}
        spacing="sm"
        {...props}
      />
    );
  }
);

FieldLabel.displayName = 'FieldLabel';

// Section Label - for grouping form sections
export interface SectionLabelProps extends Omit<LabelProps, 'htmlFor' | 'size' | 'weight'> {
  as?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const SectionLabel = forwardRef<HTMLHeadingElement, SectionLabelProps>(
  ({
    className,
    as,
    level = 3,
    size = 'lg',
    weight = 'semibold',
    spacing = 'md',
    children,
    ...props
  }, ref) => {
    const Component = as || `h${level}` as any;

    return (
      <Component
        ref={ref}
        className={cn(
          labelVariants({ variant: props.variant, size, weight, spacing }),
          'border-b border-border-primary pb-2',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

SectionLabel.displayName = 'SectionLabel';

// Badge Label - for status indicators
export interface BadgeLabelProps extends Omit<LabelProps, 'spacing' | 'children'> {
  children: React.ReactNode;
  dot?: boolean;
  dotColor?: 'success' | 'warning' | 'error' | 'primary' | 'neutral';
}

export const BadgeLabel = forwardRef<HTMLLabelElement, BadgeLabelProps>(
  ({
    className,
    dot = false,
    dotColor = 'primary',
    children,
    ...props
  }, ref) => {
    const dotColorMap = {
      success: 'bg-success-500',
      warning: 'bg-warning-500',
      error: 'bg-error-500',
      primary: 'bg-primary-500',
      neutral: 'bg-neutral-400'
    };

    return (
      <Label
        ref={ref}
        className={cn(
          'inline-flex items-center gap-2',
          'px-2 py-1 rounded-full bg-surface-secondary',
          'border border-border-primary',
          className
        )}
        spacing="none"
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              dotColorMap[dotColor]
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </Label>
    );
  }
);

BadgeLabel.displayName = 'BadgeLabel';

export { Label, labelVariants };
export type { LabelProps };