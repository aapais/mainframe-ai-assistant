/**
 * Toggle Atom Component
 * Atomic Design Level: Atom
 *
 * A toggleable switch component with accessibility and smooth animations
 */

import React, { forwardRef, useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/className';

const toggleVariants = cva(
  [
    'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent',
    'transition-all duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-primary-500 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'group'
  ],
  {
    variants: {
      size: {
        sm: 'h-5 w-9',
        md: 'h-6 w-11',
        lg: 'h-7 w-12'
      },
      variant: {
        default: [
          'bg-neutral-200 data-[state=checked]:bg-primary-600',
          'hover:bg-neutral-300 data-[state=checked]:hover:bg-primary-700'
        ],
        success: [
          'bg-neutral-200 data-[state=checked]:bg-success-600',
          'hover:bg-neutral-300 data-[state=checked]:hover:bg-success-700'
        ],
        warning: [
          'bg-neutral-200 data-[state=checked]:bg-warning-500',
          'hover:bg-neutral-300 data-[state=checked]:hover:bg-warning-600'
        ],
        error: [
          'bg-neutral-200 data-[state=checked]:bg-error-600',
          'hover:bg-neutral-300 data-[state=checked]:hover:bg-error-700'
        ]
      }
    },
    defaultVariants: {
      size: 'md',
      variant: 'default'
    }
  }
);

const thumbVariants = cva(
  [
    'pointer-events-none inline-block rounded-full bg-white shadow-lg ring-0',
    'transition-transform duration-200 ease-out',
    'group-disabled:shadow-sm'
  ],
  {
    variants: {
      size: {
        sm: 'h-4 w-4 translate-x-0 group-data-[state=checked]:translate-x-4',
        md: 'h-5 w-5 translate-x-0 group-data-[state=checked]:translate-x-5',
        lg: 'h-6 w-6 translate-x-0 group-data-[state=checked]:translate-x-5'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
);

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'>,
    VariantProps<typeof toggleVariants> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  labelPosition?: 'left' | 'right';
  showIndicator?: boolean;
  checkedIcon?: React.ReactNode;
  uncheckedIcon?: React.ReactNode;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({
    className,
    size,
    variant,
    checked = false,
    onChange,
    disabled = false,
    label,
    description,
    labelPosition = 'right',
    showIndicator = false,
    checkedIcon,
    uncheckedIcon,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...props
  }, ref) => {
    const toggleId = useId();
    const labelId = useId();
    const descriptionId = useId();

    const handleClick = () => {
      if (!disabled) {
        onChange?.(!checked);
      }
    };

    const computedAriaLabel = ariaLabel || (label ? undefined : 'Toggle');
    const computedAriaLabelledBy = ariaLabelledBy || (label ? labelId : undefined);
    const computedAriaDescribedBy = ariaDescribedBy || (description ? descriptionId : undefined);

    const toggleElement = (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={computedAriaLabel}
        aria-labelledby={computedAriaLabelledBy}
        aria-describedby={computedAriaDescribedBy}
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        onClick={handleClick}
        className={cn(toggleVariants({ size, variant }), className)}
        {...props}
      >
        <span className={cn(thumbVariants({ size }))}>
          {/* Icon indicators */}
          {showIndicator && (
            <span className="absolute inset-0 flex items-center justify-center">
              {checked ? (
                checkedIcon || (
                  <svg
                    className="h-3 w-3 text-primary-600"
                    fill="currentColor"
                    viewBox="0 0 12 12"
                    aria-hidden="true"
                  >
                    <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                  </svg>
                )
              ) : (
                uncheckedIcon || (
                  <svg
                    className="h-3 w-3 text-neutral-400"
                    fill="currentColor"
                    viewBox="0 0 12 12"
                    aria-hidden="true"
                  >
                    <path d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2" />
                  </svg>
                )
              )}
            </span>
          )}
        </span>
      </button>
    );

    if (!label && !description) {
      return toggleElement;
    }

    return (
      <div className={cn(
        'flex items-start gap-3',
        labelPosition === 'left' && 'flex-row-reverse'
      )}>
        {toggleElement}
        <div className="flex flex-col">
          {label && (
            <label
              id={labelId}
              htmlFor={toggleId}
              className={cn(
                'text-sm font-medium leading-none cursor-pointer',
                'text-text-primary',
                disabled && 'text-text-disabled cursor-not-allowed'
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p
              id={descriptionId}
              className={cn(
                'text-xs text-text-secondary mt-1',
                disabled && 'text-text-disabled'
              )}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';

// Toggle Group for multiple related toggles
export interface ToggleGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  'aria-label'?: string;
}

export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  children,
  orientation = 'vertical',
  className,
  'aria-label': ariaLabel
}) => {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex',
        orientation === 'horizontal' ? 'flex-row space-x-4' : 'flex-col space-y-4',
        className
      )}
    >
      {children}
    </div>
  );
};

ToggleGroup.displayName = 'ToggleGroup';

export { Toggle, toggleVariants, thumbVariants };
export type { ToggleProps };