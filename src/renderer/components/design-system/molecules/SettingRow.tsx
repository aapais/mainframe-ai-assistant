/**
 * SettingRow Molecule Component
 * Atomic Design Level: Molecule
 *
 * A flexible settings row that combines Label, Input/Toggle, and helper text
 */

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/className';
import { Label } from '../atoms/Label';
import { Icon, type IconName } from '../atoms/Icon';

const settingRowVariants = cva(
  [
    'group flex items-start gap-4 p-4 rounded-lg',
    'border border-border-primary bg-surface-primary',
    'transition-all duration-200 ease-out',
    'hover:border-border-secondary hover:shadow-sm'
  ],
  {
    variants: {
      variant: {
        default: '',
        card: 'shadow-sm hover:shadow-md',
        minimal: 'border-0 bg-transparent p-0 rounded-none',
        highlighted: 'border-primary-200 bg-primary-50'
      },
      size: {
        sm: 'p-3 gap-3',
        md: 'p-4 gap-4',
        lg: 'p-6 gap-6'
      },
      layout: {
        horizontal: 'flex-row items-center',
        vertical: 'flex-col items-start',
        split: 'flex-row items-start justify-between'
      },
      state: {
        default: '',
        disabled: 'opacity-60 cursor-not-allowed',
        readonly: 'bg-surface-secondary'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      layout: 'horizontal',
      state: 'default'
    }
  }
);

export interface SettingRowProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof settingRowVariants> {
  // Content
  label: string;
  description?: string;
  children: React.ReactNode;

  // Visual elements
  icon?: IconName | React.ReactNode;
  iconColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  badge?: string | number;

  // States
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  error?: string;
  warning?: string;

  // Interaction
  onClick?: () => void;
  onReset?: () => void;
  showReset?: boolean;

  // Layout customization
  labelProps?: React.ComponentProps<typeof Label>;
  contentClassName?: string;
  controlsClassName?: string;
}

const SettingRow = forwardRef<HTMLDivElement, SettingRowProps>(
  ({
    className,
    variant,
    size,
    layout,
    state,
    label,
    description,
    children,
    icon,
    iconColor = 'secondary',
    badge,
    required = false,
    disabled = false,
    readonly = false,
    error,
    warning,
    onClick,
    onReset,
    showReset = false,
    labelProps,
    contentClassName,
    controlsClassName,
    ...props
  }, ref) => {
    // Determine the computed state
    const computedState = disabled ? 'disabled' : readonly ? 'readonly' : state;

    // Determine if row is interactive
    const isInteractive = !!onClick && !disabled && !readonly;

    const iconElement = typeof icon === 'string' ? (
      <Icon
        name={icon as IconName}
        size="md"
        color={iconColor}
        className="flex-shrink-0"
      />
    ) : icon;

    const statusIcon = error ? (
      <Icon name="error" size="sm" color="error" />
    ) : warning ? (
      <Icon name="warning" size="sm" color="warning" />
    ) : null;

    const resetButton = showReset && onReset && (
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className={cn(
          'text-text-tertiary hover:text-text-primary',
          'transition-colors duration-150',
          'focus:outline-none focus:text-text-primary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-label="Reset to default"
      >
        <Icon name="x" size="sm" />
      </button>
    );

    return (
      <div
        ref={ref}
        className={cn(
          settingRowVariants({ variant, size, layout, state: computedState }),
          isInteractive && 'cursor-pointer hover:bg-surface-secondary',
          className
        )}
        onClick={isInteractive ? onClick : undefined}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={isInteractive ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        } : undefined}
        {...props}
      >
        {/* Icon */}
        {iconElement && (
          <div className="flex-shrink-0">
            {iconElement}
          </div>
        )}

        {/* Content */}
        <div className={cn(
          'flex-1 min-w-0',
          layout === 'vertical' && 'w-full',
          contentClassName
        )}>
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Label
                  variant={error ? 'error' : warning ? 'warning' : 'default'}
                  weight="medium"
                  spacing="none"
                  required={required}
                  {...labelProps}
                >
                  {label}
                </Label>

                {badge && (
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5',
                    'text-xs font-medium rounded-full',
                    'bg-primary-100 text-primary-700'
                  )}>
                    {badge}
                  </span>
                )}

                {statusIcon}
              </div>

              {description && (
                <p className={cn(
                  'text-sm text-text-secondary mt-1',
                  disabled && 'text-text-disabled'
                )}>
                  {description}
                </p>
              )}
            </div>

            {/* Reset button for horizontal layouts */}
            {layout === 'horizontal' && resetButton}
          </div>

          {/* Controls */}
          {layout === 'vertical' && (
            <div className={cn(
              'mt-3 flex items-center justify-between gap-2',
              controlsClassName
            )}>
              <div className="flex-1">
                {children}
              </div>
              {resetButton}
            </div>
          )}

          {/* Error/Warning message */}
          {(error || warning) && (
            <div className="mt-2">
              <p className={cn(
                'text-xs flex items-center gap-1',
                error ? 'text-error-600' : 'text-warning-600'
              )}>
                <Icon
                  name={error ? 'error' : 'warning'}
                  size="xs"
                />
                {error || warning}
              </p>
            </div>
          )}
        </div>

        {/* Controls for horizontal/split layouts */}
        {(layout === 'horizontal' || layout === 'split') && (
          <div className={cn(
            'flex-shrink-0 flex items-center gap-2',
            controlsClassName
          )}>
            {children}
          </div>
        )}
      </div>
    );
  }
);

SettingRow.displayName = 'SettingRow';

// Specialized SettingRow variants

// Toggle Setting Row
export interface ToggleSettingRowProps extends Omit<SettingRowProps, 'children'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  toggleProps?: React.ComponentProps<any>; // Would be Toggle props
}

export const ToggleSettingRow = forwardRef<HTMLDivElement, ToggleSettingRowProps>(
  ({
    checked,
    onChange,
    toggleProps,
    disabled,
    readonly,
    ...props
  }, ref) => {
    return (
      <SettingRow
        ref={ref}
        disabled={disabled}
        readonly={readonly}
        {...props}
      >
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled || readonly}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full',
            'transition-colors duration-200 ease-out',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary-600' : 'bg-neutral-200'
          )}
          {...toggleProps}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0',
              'transition-transform duration-200 ease-out',
              checked ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </SettingRow>
    );
  }
);

ToggleSettingRow.displayName = 'ToggleSettingRow';

// Input Setting Row
export interface InputSettingRowProps extends Omit<SettingRowProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url';
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export const InputSettingRow = forwardRef<HTMLDivElement, InputSettingRowProps>(
  ({
    value,
    onChange,
    placeholder,
    type = 'text',
    inputProps,
    disabled,
    readonly,
    error,
    layout = 'split',
    ...props
  }, ref) => {
    return (
      <SettingRow
        ref={ref}
        layout={layout}
        disabled={disabled}
        readonly={readonly}
        error={error}
        {...props}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readonly}
          className={cn(
            'flex h-9 w-full rounded-md border border-border-primary bg-background px-3 py-1',
            'text-sm placeholder:text-text-placeholder',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200 ease-out',
            error && 'border-error-500 focus:ring-error-500',
            readonly && 'bg-surface-secondary'
          )}
          {...inputProps}
        />
      </SettingRow>
    );
  }
);

InputSettingRow.displayName = 'InputSettingRow';

// Select Setting Row
export interface SelectSettingRowProps extends Omit<SettingRowProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  selectProps?: React.SelectHTMLAttributes<HTMLSelectElement>;
}

export const SelectSettingRow = forwardRef<HTMLDivElement, SelectSettingRowProps>(
  ({
    value,
    onChange,
    options,
    placeholder,
    selectProps,
    disabled,
    readonly,
    error,
    layout = 'split',
    ...props
  }, ref) => {
    return (
      <SettingRow
        ref={ref}
        layout={layout}
        disabled={disabled}
        readonly={readonly}
        error={error}
        {...props}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readonly}
          className={cn(
            'flex h-9 w-full rounded-md border border-border-primary bg-background px-3 py-1',
            'text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200 ease-out',
            error && 'border-error-500 focus:ring-error-500',
            readonly && 'bg-surface-secondary'
          )}
          {...selectProps}
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
      </SettingRow>
    );
  }
);

SelectSettingRow.displayName = 'SelectSettingRow';

export { SettingRow, settingRowVariants };
export type { SettingRowProps };