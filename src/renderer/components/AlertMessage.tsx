/**
 * AlertMessage Component
 * Fully accessible alert component with comprehensive ARIA support,
 * live region announcements, and multiple display styles
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { InteractiveComponentProps } from '../../components/types/BaseComponent';
import { smartMemo } from '../../components/performance/PerformanceOptimizer';
import { useScreenReaderAnnouncements } from '../hooks/useScreenReaderAnnouncements';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

// =========================
// TYPES AND INTERFACES
// =========================

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';
export type AlertRole = 'alert' | 'status' | 'alertdialog';
export type AlertStyle = 'inline' | 'toast' | 'banner' | 'modal';

export interface AlertAction {
  /** Unique identifier */
  id: string;
  /** Button text */
  label: string;
  /** Click handler */
  onClick: (alertId?: string) => void;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Auto-focus this action */
  autoFocus?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Keyboard shortcut */
  shortcut?: string;
}

export interface AlertMessageProps extends Omit<InteractiveComponentProps, 'onClick'> {
  /** Alert title */
  title?: string;

  /** Alert message content */
  message: string | React.ReactNode;

  /** Severity level */
  severity?: AlertSeverity;

  /** ARIA role for the alert */
  role?: AlertRole;

  /** Visual style */
  alertStyle?: AlertStyle;

  /** Show dismiss button */
  dismissible?: boolean;

  /** Auto-dismiss timer (milliseconds) */
  autoDismiss?: number;

  /** Action buttons */
  actions?: AlertAction[];

  /** Icon element or component */
  icon?: React.ReactNode | ((severity: AlertSeverity) => React.ReactNode);

  /** Show default icons */
  showIcon?: boolean;

  /** Dismiss callback */
  onDismiss?: () => void;

  /** Close callback (for alertdialog) */
  onClose?: () => void;

  /** Show callback */
  onShow?: () => void;

  /** Focus callback */
  onFocus?: (element: HTMLElement) => void;

  /** Open state (for controlled alerts) */
  open?: boolean;

  /** Animate appearance/dismissal */
  animate?: boolean;

  /** Respect reduced motion */
  respectMotion?: boolean;

  /** Custom CSS classes */
  className?: string;

  /** Inline styles */
  style?: React.CSSProperties;

  /** Test ID */
  'data-testid'?: string;
}

export interface AlertMessageRef {
  /** Focus the alert */
  focus: () => void;

  /** Dismiss the alert */
  dismiss: () => void;

  /** Show the alert (if hidden) */
  show: () => void;

  /** Get the alert element */
  getElement: () => HTMLElement | null;
}

// =========================
// DEFAULT ICONS
// =========================

const DefaultIcons = {
  info: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
  success: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  )
};

// =========================
// STYLING UTILITIES
// =========================

const getAlertClasses = (
  severity: AlertSeverity,
  alertStyle: AlertStyle,
  animate: boolean,
  respectMotion: boolean,
  isVisible: boolean,
  isDismissing: boolean
): string => {
  const baseClasses = [
    'alert-message',
    'relative',
    'rounded-md',
    'border',
    'shadow-sm',
    'focus-within:ring-2',
    'focus-within:ring-offset-2'
  ];

  // Animation classes (respecting reduced motion)
  if (animate && !respectMotion) {
    baseClasses.push(
      'transition-all',
      'duration-300',
      'ease-in-out'
    );

    if (!isVisible || isDismissing) {
      baseClasses.push(
        'opacity-0',
        'transform',
        alertStyle === 'toast' ? 'translate-y-2' : 'scale-95'
      );
    } else {
      baseClasses.push(
        'opacity-100',
        'transform',
        'translate-y-0',
        'scale-100'
      );
    }
  } else if (respectMotion) {
    baseClasses.push('transition-opacity', 'duration-150');
    baseClasses.push(isVisible && !isDismissing ? 'opacity-100' : 'opacity-0');
  }

  // Severity styling
  const severityClasses: Record<AlertSeverity, string[]> = {
    info: [
      'bg-blue-50',
      'border-blue-200',
      'text-blue-800',
      'focus-within:ring-blue-500'
    ],
    success: [
      'bg-green-50',
      'border-green-200',
      'text-green-800',
      'focus-within:ring-green-500'
    ],
    warning: [
      'bg-yellow-50',
      'border-yellow-200',
      'text-yellow-800',
      'focus-within:ring-yellow-500'
    ],
    error: [
      'bg-red-50',
      'border-red-200',
      'text-red-800',
      'focus-within:ring-red-500'
    ]
  };

  // Style-specific classes
  const styleClasses: Record<AlertStyle, string[]> = {
    inline: ['p-4'],
    toast: [
      'p-4',
      'min-w-80',
      'max-w-sm',
      'shadow-lg',
      'backdrop-blur-sm'
    ],
    banner: [
      'p-3',
      'w-full',
      'shadow-sm'
    ],
    modal: [
      'p-6',
      'min-w-96',
      'shadow-xl',
      'backdrop-blur-sm'
    ]
  };

  return [
    ...baseClasses,
    ...severityClasses[severity],
    ...styleClasses[alertStyle]
  ].join(' ');
};

// =========================
// COMPONENT IMPLEMENTATION
// =========================

export const AlertMessage = smartMemo(
  forwardRef<AlertMessageRef, AlertMessageProps>(
    ({
      title,
      message,
      severity = 'info',
      role: alertRole,
      alertStyle = 'inline',
      dismissible = false,
      autoDismiss,
      actions = [],
      icon,
      showIcon = true,
      onDismiss,
      onClose,
      onShow,
      onFocus,
      open = true,
      animate = true,
      respectMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      className = '',
      style,
      'data-testid': testId,
      id: propId,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      'aria-labelledby': ariaLabelledBy,
      ...restProps
    }, ref) => {
      // =========================
      // STATE MANAGEMENT
      // =========================

      const [isVisible, setIsVisible] = useState(open);
      const [isDismissing, setIsDismissing] = useState(false);
      const [hasBeenShown, setHasBeenShown] = useState(false);

      const alertRef = useRef<HTMLDivElement>(null);
      const dismissTimerRef = useRef<NodeJS.Timeout>();
      const titleId = useRef(`alert-title-${Math.random().toString(36).substr(2, 9)}`);
      const descriptionId = useRef(`alert-desc-${Math.random().toString(36).substr(2, 9)}`);
      const alertId = propId || `alert-${Math.random().toString(36).substr(2, 9)}`;

      // =========================
      // HOOKS
      // =========================

      const screenReader = useScreenReaderAnnouncements();

      // Determine appropriate role
      const computedRole: AlertRole = useMemo(() => {
        if (alertRole) return alertRole;
        if (actions.length > 0 || alertStyle === 'modal') return 'alertdialog';
        if (severity === 'error' || severity === 'warning') return 'alert';
        return 'status';
      }, [alertRole, actions.length, alertStyle, severity]);

      // Keyboard navigation for actions
      const keyboard = useKeyboardNavigation({
        orientation: 'horizontal',
        wrap: true,
        autoFocus: false,
        onEscape: () => {
          if (dismissible) {
            handleDismiss();
          } else if (onClose) {
            onClose();
          }
        }
      });

      // =========================
      // EVENT HANDLERS
      // =========================

      const handleDismiss = useCallback(() => {
        if (isDismissing) return;

        setIsDismissing(true);

        // Clear auto-dismiss timer
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = undefined;
        }

        const dismissDelay = animate && !respectMotion ? 300 : 0;

        setTimeout(() => {
          setIsVisible(false);
          setIsDismissing(false);
          onDismiss?.();
        }, dismissDelay);
      }, [isDismissing, animate, respectMotion, onDismiss]);

      const handleShow = useCallback(() => {
        if (isVisible) return;

        setIsVisible(true);
        setHasBeenShown(true);
        onShow?.();

        // Set up auto-dismiss timer
        if (autoDismiss && autoDismiss > 0) {
          dismissTimerRef.current = setTimeout(() => {
            handleDismiss();
          }, autoDismiss);
        }
      }, [isVisible, autoDismiss, handleDismiss, onShow]);

      const handleFocus = useCallback(() => {
        const element = alertRef.current;
        if (element) {
          element.focus();
          onFocus?.(element);
        }
      }, [onFocus]);

      // =========================
      // IMPERATIVE HANDLE
      // =========================

      useImperativeHandle(ref, () => ({
        focus: handleFocus,
        dismiss: handleDismiss,
        show: handleShow,
        getElement: () => alertRef.current
      }), [handleFocus, handleDismiss, handleShow]);

      // =========================
      // EFFECTS
      // =========================

      // Handle open prop changes
      useEffect(() => {
        if (open && !isVisible) {
          handleShow();
        } else if (!open && isVisible) {
          handleDismiss();
        }
      }, [open, isVisible, handleShow, handleDismiss]);

      // Screen reader announcements
      useEffect(() => {
        if (!isVisible || !hasBeenShown) return;

        const messageText = typeof message === 'string' ? message : title || 'Alert';

        // Announce based on severity and role
        if (computedRole === 'alert' || severity === 'error') {
          screenReader.announceError(messageText);
        } else if (severity === 'success') {
          screenReader.announceSuccess(messageText);
        } else {
          screenReader.announce(messageText, computedRole === 'alert' ? 'assertive' : 'polite');
        }
      }, [isVisible, hasBeenShown, message, title, severity, computedRole, screenReader]);

      // Cleanup timers
      useEffect(() => {
        return () => {
          if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
          }
        };
      }, []);

      // Auto-dismiss setup
      useEffect(() => {
        if (autoDismiss && autoDismiss > 0 && isVisible && !isDismissing) {
          dismissTimerRef.current = setTimeout(() => {
            handleDismiss();
          }, autoDismiss);

          return () => {
            if (dismissTimerRef.current) {
              clearTimeout(dismissTimerRef.current);
              dismissTimerRef.current = undefined;
            }
          };
        }
      }, [autoDismiss, isVisible, isDismissing, handleDismiss]);

      // =========================
      // RENDER HELPERS
      // =========================

      const renderIcon = () => {
        if (!showIcon) return null;

        let iconElement: React.ReactNode = null;

        if (icon) {
          iconElement = typeof icon === 'function' ? icon(severity) : icon;
        } else {
          iconElement = DefaultIcons[severity];
        }

        if (!iconElement) return null;

        return (
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center w-5 h-5">
              {iconElement}
            </div>
          </div>
        );
      };

      const renderContent = () => (
        <div className="flex-1 min-w-0">
          {title && (
            <h3
              id={titleId.current}
              className="text-sm font-medium mb-1"
            >
              {title}
            </h3>
          )}
          <div
            id={descriptionId.current}
            className="text-sm"
          >
            {message}
          </div>
        </div>
      );

      const renderActions = () => {
        if (actions.length === 0 && !dismissible) return null;

        const allActions = [
          ...actions,
          ...(dismissible ? [{
            id: 'dismiss',
            label: 'Dismiss',
            onClick: handleDismiss,
            variant: 'ghost' as const
          }] : [])
        ];

        return (
          <div
            className="flex items-center space-x-2 mt-3"
            ref={keyboard.containerRef}
          >
            {allActions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-md
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${action.variant === 'primary'
                    ? 'bg-current text-white hover:bg-opacity-90'
                    : action.variant === 'secondary'
                    ? 'bg-white text-current border border-current hover:bg-opacity-10'
                    : 'text-current hover:bg-current hover:bg-opacity-10'
                  }
                `.trim()}
                disabled={action.disabled}
                onClick={() => action.onClick(alertId)}
                autoFocus={action.autoFocus}
                aria-keyshortcuts={action.shortcut}
              >
                {action.label}
                {action.shortcut && (
                  <span className="sr-only">
                    (keyboard shortcut: {action.shortcut})
                  </span>
                )}
              </button>
            ))}
          </div>
        );
      };

      // =========================
      // RENDER
      // =========================

      if (!isVisible && !isDismissing) {
        return null;
      }

      const alertClasses = getAlertClasses(
        severity,
        alertStyle,
        animate,
        respectMotion,
        isVisible,
        isDismissing
      );

      const combinedClassName = className
        ? `${alertClasses} ${className}`
        : alertClasses;

      // Determine ARIA properties
      const ariaProps = {
        role: computedRole,
        'aria-live': computedRole === 'status' ? 'polite' as const : undefined,
        'aria-atomic': computedRole !== 'alertdialog' ? true : undefined,
        'aria-label': ariaLabel || (title && typeof message === 'string' ? undefined : typeof message === 'string' ? message : 'Alert'),
        'aria-labelledby': ariaLabelledBy || (title ? titleId.current : undefined),
        'aria-describedby': ariaDescribedBy || descriptionId.current
      };

      return (
        <div
          ref={alertRef}
          id={alertId}
          className={combinedClassName}
          style={style}
          data-testid={testId}
          data-severity={severity}
          data-style={alertStyle}
          tabIndex={computedRole === 'alertdialog' ? 0 : undefined}
          {...ariaProps}
          {...restProps}
        >
          <div className="flex items-start space-x-3">
            {renderIcon()}
            {renderContent()}
          </div>
          {renderActions()}
        </div>
      );
    }
  ),
  {
    compareProps: [
      'message', 'severity', 'alertStyle', 'dismissible',
      'actions', 'open', 'title'
    ],
    monitor: process.env.NODE_ENV === 'development'
  }
);

AlertMessage.displayName = 'AlertMessage';

// =========================
// CONVENIENCE COMPONENTS
// =========================

export const InfoAlert = (props: Omit<AlertMessageProps, 'severity'>) => (
  <AlertMessage severity="info" {...props} />
);

export const SuccessAlert = (props: Omit<AlertMessageProps, 'severity'>) => (
  <AlertMessage severity="success" {...props} />
);

export const WarningAlert = (props: Omit<AlertMessageProps, 'severity'>) => (
  <AlertMessage severity="warning" {...props} />
);

export const ErrorAlert = (props: Omit<AlertMessageProps, 'severity'>) => (
  <AlertMessage severity="error" {...props} />
);

// =========================
// TOAST UTILITIES
// =========================

export interface ToastOptions extends Omit<AlertMessageProps, 'alertStyle'> {
  /** Toast position */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Z-index for toast */
  zIndex?: number;
}

let toastCounter = 0;

export const showToast = (options: ToastOptions) => {
  const {
    position = 'top-right',
    zIndex = 9999,
    autoDismiss = 5000,
    ...alertProps
  } = options;

  const toastId = `toast-${++toastCounter}`;

  // Create toast container if it doesn't exist
  let container = document.getElementById(`toast-container-${position}`);
  if (!container) {
    container = document.createElement('div');
    container.id = `toast-container-${position}`;
    container.className = `
      fixed pointer-events-none z-${zIndex}
      ${position.includes('top') ? 'top-4' : 'bottom-4'}
      ${position.includes('left') ? 'left-4' : ''}
      ${position.includes('right') ? 'right-4' : ''}
      ${position.includes('center') ? 'left-1/2 transform -translate-x-1/2' : ''}
      flex flex-col space-y-2
    `.trim();
    document.body.appendChild(container);
  }

  // Create toast wrapper
  const toastWrapper = document.createElement('div');
  toastWrapper.className = 'pointer-events-auto';
  toastWrapper.id = toastId;

  container.appendChild(toastWrapper);

  // Create and render toast
  const root = (window as any).ReactDOM?.createRoot?.(toastWrapper) || (window as any).ReactDOM?.render;

  const handleDismiss = () => {
    if (root && typeof root.unmount === 'function') {
      root.unmount();
    }
    toastWrapper.remove();

    // Clean up container if empty
    if (container && container.children.length === 0) {
      container.remove();
    }
  };

  const toast = (
    <AlertMessage
      {...alertProps}
      alertStyle="toast"
      dismissible
      autoDismiss={autoDismiss}
      onDismiss={handleDismiss}
    />
  );

  if (typeof root === 'function') {
    root(toast, toastWrapper);
  } else if (root) {
    root.render(toast);
  }

  return toastId;
};

export default AlertMessage;