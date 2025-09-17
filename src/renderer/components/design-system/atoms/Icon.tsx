/**
 * Icon Atom Component
 * Atomic Design Level: Atom
 *
 * A flexible icon component with built-in icons and support for custom icons
 */

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/className';

const iconVariants = cva(
  [
    'inline-flex items-center justify-center flex-shrink-0',
    'transition-colors duration-150'
  ],
  {
    variants: {
      size: {
        xs: 'w-3 h-3',
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
        xl: 'w-8 h-8',
        '2xl': 'w-10 h-10'
      },
      color: {
        default: 'text-current',
        primary: 'text-primary-600',
        secondary: 'text-text-secondary',
        tertiary: 'text-text-tertiary',
        success: 'text-success-600',
        warning: 'text-warning-500',
        error: 'text-error-600',
        muted: 'text-text-placeholder',
        inverse: 'text-text-inverse'
      },
      variant: {
        ghost: '',
        filled: 'rounded-full p-1',
        outlined: 'rounded-full p-1 border-2 border-current'
      }
    },
    defaultVariants: {
      size: 'md',
      color: 'default',
      variant: 'ghost'
    }
  }
);

// Built-in icon library
const iconLibrary = {
  // Navigation
  chevronLeft: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  ),
  chevronRight: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  ),
  chevronUp: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  ),
  chevronDown: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  ),
  arrowLeft: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  ),
  arrowRight: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 5l7 7m0 0l-7 7m7-7H3"
    />
  ),
  arrowUp: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 10l7-7m0 0l7 7m-7-7v18"
    />
  ),
  arrowDown: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 14l-7 7m0 0l-7-7m7 7V3"
    />
  ),

  // Actions
  plus: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  ),
  minus: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 12H4"
    />
  ),
  x: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  ),
  check: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  ),
  edit: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  ),
  trash: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  ),
  copy: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  ),

  // Interface
  search: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  ),
  filter: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
    />
  ),
  sort: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
    />
  ),
  menu: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  ),
  dots: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
    />
  ),
  dotsHorizontal: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
    />
  ),

  // Status
  info: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  warning: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  ),
  error: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  success: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),

  // System
  settings: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
  ),
  user: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  ),
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  ),
  bell: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  ),

  // Loading
  spinner: (
    <>
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </>
  ),

  // Toggle states
  eyeOpen: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  ),
  eyeClosed: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
    />
  ),
};

export type IconName = keyof typeof iconLibrary;

export interface IconProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'ref' | 'children'>,
    VariantProps<typeof iconVariants> {
  name?: IconName;
  children?: React.ReactNode;
  spin?: boolean;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}

const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({
    className,
    name,
    size,
    color,
    variant,
    spin = false,
    children,
    'aria-label': ariaLabel,
    'aria-hidden': ariaHidden,
    ...props
  }, ref) => {
    const iconContent = name ? iconLibrary[name] : children;

    if (!iconContent) {
      console.warn(`Icon "${name}" not found in icon library`);
      return null;
    }

    const isSpinner = name === 'spinner' || spin;

    return (
      <svg
        ref={ref}
        className={cn(
          iconVariants({ size, color, variant }),
          isSpinner && 'animate-spin',
          className
        )}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={ariaLabel}
        aria-hidden={ariaHidden ?? (ariaLabel ? false : true)}
        role={ariaLabel ? 'img' : undefined}
        {...props}
      >
        {iconContent}
      </svg>
    );
  }
);

Icon.displayName = 'Icon';

// Icon Button - clickable icon with hover states
export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    Pick<IconProps, 'name' | 'size' | 'spin'> {
  variant?: 'ghost' | 'filled' | 'outlined';
  colorScheme?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  isLoading?: boolean;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({
    className,
    name,
    size = 'md',
    variant = 'ghost',
    colorScheme = 'primary',
    isLoading = false,
    disabled,
    'aria-label': ariaLabel,
    spin,
    ...props
  }, ref) => {
    const sizeMap = {
      xs: 'p-1',
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-2.5',
      xl: 'p-3',
      '2xl': 'p-4'
    };

    const colorMap = {
      primary: {
        ghost: 'text-primary-600 hover:text-primary-700 hover:bg-primary-50',
        filled: 'text-white bg-primary-600 hover:bg-primary-700',
        outlined: 'text-primary-600 border-primary-600 hover:bg-primary-50'
      },
      secondary: {
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-neutral-100',
        filled: 'text-white bg-neutral-600 hover:bg-neutral-700',
        outlined: 'text-neutral-600 border-neutral-600 hover:bg-neutral-50'
      },
      success: {
        ghost: 'text-success-600 hover:text-success-700 hover:bg-success-50',
        filled: 'text-white bg-success-600 hover:bg-success-700',
        outlined: 'text-success-600 border-success-600 hover:bg-success-50'
      },
      warning: {
        ghost: 'text-warning-600 hover:text-warning-700 hover:bg-warning-50',
        filled: 'text-white bg-warning-600 hover:bg-warning-700',
        outlined: 'text-warning-600 border-warning-600 hover:bg-warning-50'
      },
      error: {
        ghost: 'text-error-600 hover:text-error-700 hover:bg-error-50',
        filled: 'text-white bg-error-600 hover:bg-error-700',
        outlined: 'text-error-600 border-error-600 hover:bg-error-50'
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-md',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeMap[size],
          colorMap[colorScheme][variant],
          variant === 'outlined' && 'border-2',
          className
        )}
        disabled={disabled || isLoading}
        aria-label={ariaLabel}
        {...props}
      >
        <Icon
          name={isLoading ? 'spinner' : name}
          size={size}
          spin={isLoading || spin}
        />
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export { Icon, iconVariants };
export type { IconProps };