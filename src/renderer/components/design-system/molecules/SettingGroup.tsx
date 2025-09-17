/**
 * SettingGroup Molecule Component
 * Atomic Design Level: Molecule
 *
 * A group container for related settings with optional header and description
 */

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/className';
import { Label } from '../atoms/Label';
import { Icon, type IconName } from '../atoms/Icon';

const settingGroupVariants = cva(
  [
    'space-y-4'
  ],
  {
    variants: {
      variant: {
        default: '',
        card: 'p-6 bg-surface-primary border border-border-primary rounded-lg shadow-sm',
        outlined: 'p-4 border border-border-primary rounded-lg',
        separated: 'pb-6 border-b border-border-primary last:border-b-0 last:pb-0'
      },
      size: {
        sm: 'space-y-2',
        md: 'space-y-4',
        lg: 'space-y-6'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
);

const headerVariants = cva(
  [
    'flex flex-col space-y-2'
  ],
  {
    variants: {
      size: {
        sm: 'space-y-1',
        md: 'space-y-2',
        lg: 'space-y-3'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
);

export interface SettingGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof settingGroupVariants> {
  // Header content
  title?: string;
  description?: string;
  icon?: IconName | React.ReactNode;
  iconColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';

  // Actions
  action?: React.ReactNode;
  onReset?: () => void;
  showReset?: boolean;

  // State
  disabled?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;

  // Layout
  headerClassName?: string;
  contentClassName?: string;

  // Content
  children: React.ReactNode;
}

const SettingGroup = forwardRef<HTMLDivElement, SettingGroupProps>(
  ({
    className,
    variant,
    size,
    title,
    description,
    icon,
    iconColor = 'primary',
    action,
    onReset,
    showReset = false,
    disabled = false,
    collapsible = false,
    defaultExpanded = true,
    expanded,
    onExpandedChange,
    headerClassName,
    contentClassName,
    children,
    ...props
  }, ref) => {
    const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);

    // Use controlled or uncontrolled state
    const isExpanded = expanded !== undefined ? expanded : internalExpanded;
    const setExpanded = (newExpanded: boolean) => {
      if (expanded === undefined) {
        setInternalExpanded(newExpanded);
      }
      onExpandedChange?.(newExpanded);
    };

    const iconElement = typeof icon === 'string' ? (
      <Icon
        name={icon as IconName}
        size="lg"
        color={iconColor}
        className="flex-shrink-0"
      />
    ) : icon;

    const resetButton = showReset && onReset && (
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className={cn(
          'text-text-tertiary hover:text-text-primary',
          'transition-colors duration-150',
          'focus:outline-none focus:text-text-primary',
          'p-1 rounded-md hover:bg-surface-secondary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-label="Reset all settings in this group"
      >
        <Icon name="x" size="sm" />
      </button>
    );

    const collapseButton = collapsible && (
      <button
        type="button"
        onClick={() => setExpanded(!isExpanded)}
        disabled={disabled}
        className={cn(
          'text-text-secondary hover:text-text-primary',
          'transition-all duration-200',
          'focus:outline-none focus:text-text-primary',
          'p-1 rounded-md hover:bg-surface-secondary',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
        aria-expanded={isExpanded}
      >
        <Icon
          name="chevronDown"
          size="sm"
          className={cn(
            'transition-transform duration-200',
            !isExpanded && '-rotate-90'
          )}
        />
      </button>
    );

    const hasHeader = title || description || icon || action || showReset || collapsible;

    return (
      <div
        ref={ref}
        className={cn(
          settingGroupVariants({ variant, size }),
          disabled && 'opacity-60 pointer-events-none',
          className
        )}
        {...props}
      >
        {/* Header */}
        {hasHeader && (
          <div className={cn(headerVariants({ size }), headerClassName)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {iconElement}

                <div className="flex-1 min-w-0">
                  {title && (
                    <div className="flex items-center gap-2">
                      <h3 className={cn(
                        'text-lg font-semibold text-text-primary',
                        size === 'sm' && 'text-base',
                        size === 'lg' && 'text-xl'
                      )}>
                        {title}
                      </h3>
                      {collapsible && collapseButton}
                    </div>
                  )}

                  {description && (
                    <p className={cn(
                      'text-sm text-text-secondary',
                      title && 'mt-1'
                    )}>
                      {description}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {action}
                {resetButton}
                {!title && collapsible && collapseButton}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {(!collapsible || isExpanded) && (
          <div
            className={cn(
              'space-y-0',
              size === 'sm' && 'space-y-2',
              size === 'md' && 'space-y-4',
              size === 'lg' && 'space-y-6',
              contentClassName
            )}
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

SettingGroup.displayName = 'SettingGroup';

// Settings Section - A more semantic wrapper for major sections
export interface SettingSectionProps extends Omit<SettingGroupProps, 'variant'> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const SettingSection = forwardRef<HTMLDivElement, SettingSectionProps>(
  ({
    title,
    level = 2,
    size = 'lg',
    variant = 'separated',
    ...props
  }, ref) => {
    return (
      <SettingGroup
        ref={ref}
        title={title}
        size={size}
        variant={variant}
        {...props}
      />
    );
  }
);

SettingSection.displayName = 'SettingSection';

// Settings Card - A card-style group for emphasized settings
export interface SettingCardProps extends Omit<SettingGroupProps, 'variant'> {
  highlight?: boolean;
}

export const SettingCard = forwardRef<HTMLDivElement, SettingCardProps>(
  ({
    highlight = false,
    variant = 'card',
    className,
    ...props
  }, ref) => {
    return (
      <SettingGroup
        ref={ref}
        variant={variant}
        className={cn(
          highlight && 'ring-2 ring-primary-200 border-primary-300',
          className
        )}
        {...props}
      />
    );
  }
);

SettingCard.displayName = 'SettingCard';

// Collapsible Setting Group
export interface CollapsibleSettingGroupProps extends Omit<SettingGroupProps, 'collapsible'> {
  persistKey?: string; // For remembering state in localStorage
}

export const CollapsibleSettingGroup = forwardRef<HTMLDivElement, CollapsibleSettingGroupProps>(
  ({
    persistKey,
    defaultExpanded = true,
    expanded,
    onExpandedChange,
    ...props
  }, ref) => {
    // Load initial state from localStorage if persistKey is provided
    const [persistedExpanded, setPersistedExpanded] = React.useState(() => {
      if (persistKey && typeof window !== 'undefined') {
        const saved = localStorage.getItem(`setting-group-${persistKey}`);
        return saved !== null ? JSON.parse(saved) : defaultExpanded;
      }
      return defaultExpanded;
    });

    // Save to localStorage when expanded changes
    const handleExpandedChange = (newExpanded: boolean) => {
      if (persistKey && typeof window !== 'undefined') {
        localStorage.setItem(`setting-group-${persistKey}`, JSON.stringify(newExpanded));
      }
      setPersistedExpanded(newExpanded);
      onExpandedChange?.(newExpanded);
    };

    return (
      <SettingGroup
        ref={ref}
        collapsible={true}
        expanded={expanded !== undefined ? expanded : persistedExpanded}
        onExpandedChange={handleExpandedChange}
        {...props}
      />
    );
  }
);

CollapsibleSettingGroup.displayName = 'CollapsibleSettingGroup';

export { SettingGroup, settingGroupVariants, headerVariants };
export type { SettingGroupProps };