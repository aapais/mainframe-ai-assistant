import React, { useRef, useEffect } from 'react';
import { AriaUtils, announceToScreenReader } from '../../utils/accessibility';
import { InlineLoadingSpinner } from './LoadingIndicator';
import { useKeyboard, useKeyboardShortcuts } from '../../contexts/KeyboardContext';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant of the button */
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'link';
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Loading state */
  loading?: boolean;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Make button full width */
  fullWidth?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Description for screen readers */
  ariaDescription?: string;
  /** Announce clicks to screen readers */
  announceClick?: boolean;
  /** Custom announcement text */
  announceText?: string;
  /** Loading announcement text */
  loadingText?: string;
  /** Badge/notification indicator */
  badge?: string | number;
  /** Destructive action confirmation */
  destructive?: boolean;
  /** Keyboard shortcut configuration */
  shortcut?: {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    description?: string;
    scope?: string;
  };
}

/**
 * Accessible Button Component
 * 
 * Features:
 * - WCAG 2.1 AA compliant
 * - Screen reader announcements
 * - Focus management
 * - Loading states with accessibility
 * - Keyboard navigation support
 * - High contrast mode support
 * 
 * MVP1 Usage:
 * - Primary actions: Add KB Entry, Search
 * - Secondary actions: Cancel, Clear
 * - Danger actions: Delete entry
 * - Success actions: Save, Apply solution
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  fullWidth = false,
  disabled = false,
  autoFocus = false,
  tooltip,
  ariaDescription,
  announceClick = false,
  announceText,
  loadingText,
  badge,
  destructive = false,
  shortcut,
  className = '',
  onClick,
  onFocus,
  onBlur,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useRef(tooltip ? AriaUtils.generateId('tooltip') : '');
  const descriptionId = useRef(ariaDescription ? AriaUtils.generateId('desc') : '');
  const previousLoadingState = useRef(loading);
  const { state: keyboardState } = useKeyboard();

  // Register keyboard shortcut if provided
  useKeyboardShortcuts(
    shortcut ? [{
      key: shortcut.key,
      ctrlKey: shortcut.ctrlKey,
      altKey: shortcut.altKey,
      metaKey: shortcut.metaKey,
      shiftKey: shortcut.shiftKey,
      description: shortcut.description || `${children || 'Button'}`,
      action: () => {
        if (!disabled && !loading && buttonRef.current) {
          buttonRef.current.click();
        }
      },
      scope: shortcut.scope
    }] : [],
    undefined,
    [shortcut, disabled, loading, children]
  );

  // Auto focus management
  useEffect(() => {
    if (autoFocus && buttonRef.current && !disabled && !loading) {
      buttonRef.current.focus();
    }
  }, [autoFocus, disabled, loading]);

  // Loading state announcements
  useEffect(() => {
    if (loading !== previousLoadingState.current) {
      if (loading) {
        announceToScreenReader(loadingText || 'Loading', 'polite');
      } else if (previousLoadingState.current) {
        announceToScreenReader('Finished loading', 'polite');
      }
      previousLoadingState.current = loading;
    }
  }, [loading, loadingText]);

  // Create tooltip element if needed
  useEffect(() => {
    if (tooltip && tooltipId.current) {
      AriaUtils.createDescription(buttonRef.current!, tooltip);
    }
  }, [tooltip]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }

    // Announce click if requested
    if (announceClick || announceText) {
      const message = announceText || `${children || 'Button'} activated`;
      announceToScreenReader(message, 'polite');
    }

    // Call original onClick handler
    onClick?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    // Announce button role and state for screen readers
    if (destructive) {
      announceToScreenReader('Warning: Destructive action', 'polite');
    }
    
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    onBlur?.(e);
  };

  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--full-width',
    loading && 'btn--loading',
    disabled && 'btn--disabled',
    destructive && 'btn--destructive',
    badge && 'btn--with-badge',
    shortcut && 'btn--with-shortcut',
    keyboardState.isKeyboardMode && 'btn--keyboard-mode',
    className
  ].filter(Boolean).join(' ');

  // Generate shortcut hint for accessibility
  const shortcutHint = shortcut ? (() => {
    const keys = [];
    if (shortcut.ctrlKey) keys.push('Ctrl');
    if (shortcut.altKey) keys.push('Alt');
    if (shortcut.metaKey) keys.push('Cmd');
    if (shortcut.shiftKey) keys.push('Shift');
    keys.push(shortcut.key);
    return keys.join('+');
  })() : undefined;

  // Determine ARIA attributes
  const ariaAttributes: any = {
    'aria-disabled': disabled || loading || undefined,
    'aria-busy': loading || undefined,
    'aria-describedby': [
      tooltipId.current,
      descriptionId.current,
      props['aria-describedby']
    ].filter(Boolean).join(' ') || undefined,
    'aria-label': props['aria-label'] || (typeof children === 'string' ? children : undefined),
    'aria-keyshortcuts': shortcutHint
  };

  // Add specific ARIA attributes based on button type
  if (variant === 'danger' || destructive) {
    ariaAttributes['aria-description'] = ariaAttributes['aria-description'] || 'This action cannot be undone';
  }

  return (
    <button
      ref={buttonRef}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
      title={tooltip}
      data-testid={props['data-testid'] || `button-${variant}`}
      {...ariaAttributes}
      {...props}
    >
      {/* Loading State */}
      {loading && (
        <span className="btn__loading" aria-hidden="true">
          <InlineLoadingSpinner size="small" />
        </span>
      )}

      {/* Icon */}
      {!loading && icon && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}

      {/* Text Content */}
      {children && (
        <span className="btn__text">
          {children}
        </span>
      )}

      {/* Keyboard Shortcut Hint */}
      {shortcut && keyboardState.isKeyboardMode && (
        <span className="btn__shortcut" aria-hidden="true">
          {shortcutHint}
        </span>
      )}

      {/* Badge */}
      {badge && (
        <span 
          className="btn__badge" 
          aria-label={`${badge} notifications`}
          data-count={badge}
        >
          {badge}
        </span>
      )}

      {/* Screen reader loading text */}
      {loading && (
        <span className="sr-only">
          {loadingText || 'Loading, please wait...'}
        </span>
      )}

      {/* Screen reader description */}
      {ariaDescription && (
        <span id={descriptionId.current} className="sr-only">
          {ariaDescription}
        </span>
      )}
    </button>
  );
};

/**
 * Icon Button Component
 */
export const IconButton: React.FC<Omit<ButtonProps, 'children'> & {
  icon: React.ReactNode;
  label: string;
}> = ({ icon, label, ...props }) => (
  <Button
    {...props}
    aria-label={label}
    icon={icon}
    className={`icon-button ${props.className || ''}`}
  />
);

/**
 * Button Group Component for related actions
 */
interface ButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'compact' | 'normal' | 'relaxed';
  className?: string;
  label?: string;
  keyboardNavigation?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  orientation = 'horizontal',
  spacing = 'normal',
  className = '',
  label = 'Button group',
  keyboardNavigation = true
}) => {
  const groupRef = useRef<HTMLDivElement>(null);
  const { state: keyboardState } = useKeyboard();

  const groupClasses = [
    'btn-group',
    `btn-group--${orientation}`,
    `btn-group--${spacing}`,
    keyboardNavigation && 'btn-group--keyboard-nav',
    keyboardState.isKeyboardMode && 'btn-group--keyboard-mode',
    className
  ].filter(Boolean).join(' ');

  // Handle keyboard navigation within button group
  useEffect(() => {
    if (!keyboardNavigation || !groupRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, target } = event;
      const currentTarget = target as HTMLElement;

      if (!currentTarget.matches('button')) return;

      const buttons = Array.from(groupRef.current!.querySelectorAll('button:not([disabled])'));
      const currentIndex = buttons.indexOf(currentTarget);

      let nextIndex = currentIndex;

      switch (key) {
        case 'ArrowLeft':
          if (orientation === 'horizontal') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
            event.preventDefault();
          }
          break;
        case 'ArrowRight':
          if (orientation === 'horizontal') {
            nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
            event.preventDefault();
          }
          break;
        case 'ArrowUp':
          if (orientation === 'vertical') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
            event.preventDefault();
          }
          break;
        case 'ArrowDown':
          if (orientation === 'vertical') {
            nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
            event.preventDefault();
          }
          break;
        case 'Home':
          nextIndex = 0;
          event.preventDefault();
          break;
        case 'End':
          nextIndex = buttons.length - 1;
          event.preventDefault();
          break;
      }

      if (nextIndex !== currentIndex) {
        (buttons[nextIndex] as HTMLButtonElement).focus();
      }
    };

    groupRef.current.addEventListener('keydown', handleKeyDown);

    return () => {
      if (groupRef.current) {
        groupRef.current.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [keyboardNavigation, orientation]);

  return (
    <div
      ref={groupRef}
      className={groupClasses}
      role="group"
      aria-label={label}
      data-orientation={orientation}
    >
      {children}
    </div>
  );
};