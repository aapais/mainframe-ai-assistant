/**
 * Enhanced Badge Component
 * Accessible badge component with multiple variants, states, and interactive features
 */

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/className';

const badgeVariants = cva(
  [
    'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
    'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'whitespace-nowrap'
  ],
  {
    variants: {
      variant: {
        default: 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100',
        secondary: 'border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100',
        success: 'border-transparent bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100',
        warning: 'border-transparent bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100',
        danger: 'border-transparent bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100',
        destructive: 'border-transparent bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100',
        outline: 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300',
        purple: 'border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100',
        pink: 'border-transparent bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-100',
        // Gradient variants
        'gradient-primary': 'border-transparent bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow hover:from-purple-600 hover:to-purple-700',
        'gradient-success': 'border-transparent bg-gradient-to-r from-green-500 to-green-600 text-white shadow hover:from-green-600 hover:to-green-700',
        'gradient-warning': 'border-transparent bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow hover:from-amber-600 hover:to-amber-700',
        'gradient-danger': 'border-transparent bg-gradient-to-r from-red-500 to-red-600 text-white shadow hover:from-red-600 hover:to-red-700'
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        default: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm'
      },
      interactive: {
        true: 'cursor-pointer hover:scale-105 active:scale-95',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      interactive: false
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  dot?: boolean;
  pulse?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({
    className,
    variant,
    size,
    interactive,
    icon,
    removable,
    onRemove,
    dot,
    pulse,
    children,
    onClick,
    ...props
  }, ref) => {
    const isClickable = onClick || interactive;

    return (
      <span
        ref={ref}
        className={cn(
          badgeVariants({ variant, size, interactive: isClickable }),
          pulse && 'animate-pulse',
          className
        )}
        onClick={onClick}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(e as any);
          }
        } : undefined}
        {...props}
      >
        {/* Status dot */}
        {dot && (
          <span
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
              pulse ? 'animate-pulse bg-current' : 'bg-current'
            )}
            aria-hidden="true"
          />
        )}

        {/* Icon */}
        {icon && (
          <span className={cn('inline-flex', children && 'mr-1')} aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Content */}
        {children}

        {/* Remove button */}
        {removable && onRemove && (
          <button
            type="button"
            className="inline-flex items-center justify-center ml-1 -mr-1 w-4 h-4 rounded-full hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current min-w-[44px] min-h-[44px]"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove badge"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
export type { BadgeProps };
export default Badge;