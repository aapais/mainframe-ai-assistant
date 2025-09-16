/**
 * Foundation Button Component
 * Fully typed, optimized, and extensible button implementation
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import { InteractiveComponentProps } from '../types/BaseComponent';
import { smartMemo } from '../performance/PerformanceOptimizer';
import { PropValidators, ValidationEngine } from '../validation/PropValidator';

// =========================
// BUTTON TYPES
// =========================

export interface ButtonProps extends InteractiveComponentProps {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';

  /** Button size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /** Button type */
  type?: 'button' | 'submit' | 'reset';

  /** Loading state */
  loading?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Full width */
  fullWidth?: boolean;

  /** Icon before text */
  startIcon?: React.ReactNode;

  /** Icon after text */
  endIcon?: React.ReactNode;

  /** Tooltip text */
  tooltip?: string;

  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /** Additional CSS classes */
  className?: string;

  /** Inline styles */
  style?: React.CSSProperties;

  /** Children content */
  children?: React.ReactNode;

  /** ARIA label */
  'aria-label'?: string;

  /** ARIA described by */
  'aria-describedby'?: string;
}

// =========================
// VALIDATION SCHEMA
// =========================

const buttonValidationSchema = {
  rules: {
    variant: [PropValidators.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'])],
    size: [PropValidators.oneOf(['xs', 'sm', 'md', 'lg', 'xl'])],
    type: [PropValidators.oneOf(['button', 'submit', 'reset'])],
    loading: [PropValidators.type('boolean')],
    disabled: [PropValidators.type('boolean')],
    fullWidth: [PropValidators.type('boolean')],
    onClick: [PropValidators.func()],
    children: [PropValidators.custom((value: any) => {
      if (value === undefined || value === null || value === '') {
        return 'Button must have content (children, aria-label, or title)';
      }
      return true;
    })]
  },
  options: {
    mode: 'development-only' as const,
    failFast: false
  }
};

// =========================
// STYLE SYSTEM
// =========================

const getButtonStyles = (props: ButtonProps): string => {
  const baseClasses = [
    'btn', // Use design system base button class
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'border',
    'cursor-pointer',
    'select-none',
    'relative',
    'overflow-hidden',
    'whitespace-nowrap'
  ];

  // Size classes using design tokens
  const sizeClasses: Record<string, string[]> = {
    xs: ['btn-xs'],
    sm: ['btn-sm'],
    md: ['btn-md'],
    lg: ['btn-lg'],
    xl: ['btn-xl']
  };

  // Variant classes using design tokens
  const variantClasses: Record<string, string[]> = {
    primary: ['btn-primary'],
    secondary: ['btn-secondary'],
    outline: ['btn-outline'],
    ghost: ['btn-ghost'],
    danger: ['btn-error'],
    success: ['btn-success']
  };

  const size = props.size || 'md';
  const variant = props.variant || 'primary';

  const classes = [
    ...baseClasses,
    ...sizeClasses[size],
    ...variantClasses[variant]
  ];

  if (props.fullWidth) {
    classes.push('btn-full-width');
  }

  if (props.loading) {
    classes.push('btn-loading');
  }

  return classes.join(' ');
};

// =========================
// LOADING SPINNER
// =========================

const LoadingSpinner: React.FC<{ size: string }> = ({ size }) => {
  const spinnerSizes: Record<string, string> = {
    xs: 'spinner-sm',
    sm: 'spinner',
    md: 'spinner',
    lg: 'spinner-lg',
    xl: 'spinner-lg'
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className={spinnerSizes[size]}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
};

// =========================
// BUTTON COMPONENT
// =========================

export const Button = smartMemo(
  forwardRef<HTMLButtonElement, ButtonProps>(
    (
      {
        variant = 'primary',
        size = 'md',
        type = 'button',
        loading = false,
        disabled = false,
        fullWidth = false,
        startIcon,
        endIcon,
        tooltip,
        onClick,
        className = '',
        style,
        children,
        'aria-label': ariaLabel,
        'aria-describedby': ariaDescribedBy,
        ...restProps
      },
      ref
    ) => {
      // Validation in development
      if (process.env.NODE_ENV === 'development') {
        ValidationEngine.validate(
          { variant, size, type, loading, disabled, fullWidth, onClick, children },
          buttonValidationSchema
        );
      }

      // Memoize click handler
      const handleClick = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
          if (loading || disabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        },
        [loading, disabled, onClick]
      );

      // Memoize styles
      const buttonClasses = useMemo(() => {
        const baseStyles = getButtonStyles({
          variant,
          size,
          fullWidth,
          loading
        });
        return className ? `${baseStyles} ${className}` : baseStyles;
      }, [variant, size, fullWidth, loading, className]);

      // Memoize content
      const buttonContent = useMemo(() => {
        if (!children && !startIcon && !endIcon) {
          return null;
        }

        return (
          <>
            {startIcon && !loading && (
              <span className="mr-2 flex-shrink-0">{startIcon}</span>
            )}
            {children && <span>{children}</span>}
            {endIcon && !loading && (
              <span className="ml-2 flex-shrink-0">{endIcon}</span>
            )}
            {loading && <LoadingSpinner size={size} />}
          </>
        );
      }, [children, startIcon, endIcon, loading, size]);

      return (
        <button
          ref={ref}
          type={type}
          className={buttonClasses}
          style={style}
          disabled={disabled || loading}
          onClick={handleClick}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-disabled={disabled || loading}
          title={tooltip}
          {...restProps}
        >
          {buttonContent}
          {/* Ripple effect overlay for enhanced interactivity */}
          <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
            <span className="absolute inset-0 bg-current opacity-0 transition-opacity duration-150 ease-out hover:opacity-10 active:opacity-20" />
          </span>
        </button>
      );
    }
  ),
  {
    compareProps: ['variant', 'size', 'loading', 'disabled', 'children'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

Button.displayName = 'Button';

// =========================
// BUTTON VARIANTS
// =========================

export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="outline" {...props} />
);

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="ghost" {...props} />
);

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="danger" {...props} />
);

export const SuccessButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="success" {...props} />
);

// =========================
// BUTTON GROUP
// =========================

export interface ButtonGroupProps {
  /** Button group orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Button group size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /** Button group variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';

  /** Children buttons */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;

  /** Attached styling */
  attached?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  orientation = 'horizontal',
  size,
  variant,
  children,
  className = '',
  attached = true
}) => {
  const groupClasses = useMemo(() => {
    const baseClasses = ['inline-flex'];

    if (orientation === 'vertical') {
      baseClasses.push('flex-col');
    }

    if (attached) {
      if (orientation === 'horizontal') {
        baseClasses.push('[&>*:not(:first-child)]:ml-[-1px]', '[&>*:not(:last-child)]:rounded-r-none', '[&>*:not(:first-child)]:rounded-l-none');
      } else {
        baseClasses.push('[&>*:not(:first-child)]:mt-[-1px]', '[&>*:not(:last-child)]:rounded-b-none', '[&>*:not(:first-child)]:rounded-t-none');
      }
    } else {
      baseClasses.push('gap-2');
    }

    return className ? `${baseClasses.join(' ')} ${className}` : baseClasses.join(' ');
  }, [orientation, attached, className]);

  const enhancedChildren = useMemo(() => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === Button) {
        const props: Partial<ButtonProps> = {};
        if (size && !child.props.size) props.size = size;
        if (variant && !child.props.variant) props.variant = variant;

        return React.cloneElement(child, props);
      }
      return child;
    });
  }, [children, size, variant]);

  return (
    <div className={groupClasses} role="group">
      {enhancedChildren}
    </div>
  );
};

ButtonGroup.displayName = 'ButtonGroup';

export default Button;