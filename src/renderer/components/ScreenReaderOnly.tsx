/**
 * ScreenReaderOnly Component
 * Provides content that is only visible to screen readers while being visually hidden
 */

import React from 'react';

export interface ScreenReaderOnlyProps {
  /**
   * Content to be announced to screen readers only
   */
  children: React.ReactNode;

  /**
   * HTML element type to render
   * @default 'span'
   */
  as?: keyof JSX.IntrinsicElements;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * ARIA live region priority for dynamic content
   */
  live?: 'off' | 'polite' | 'assertive';

  /**
   * Whether the live region should be atomic
   * @default true
   */
  atomic?: boolean;

  /**
   * What changes should be announced
   * @default 'additions text'
   */
  relevant?: 'additions' | 'removals' | 'text' | 'all' | string;

  /**
   * Additional ARIA attributes
   */
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;

  /**
   * Optional ID for the element
   */
  id?: string;

  /**
   * Role for the element (useful for live regions)
   */
  role?: string;
}

/**
 * CSS class for visually hidden but screen reader accessible content
 * Following WCAG best practices
 */
const SR_ONLY_STYLES = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  borderWidth: '0'
};

/**
 * Screen Reader Only Component
 * Renders content that is only accessible to screen readers
 */
export const ScreenReaderOnly: React.FC<ScreenReaderOnlyProps> = ({
  children,
  as: Component = 'span',
  className = '',
  live,
  atomic = true,
  relevant = 'additions text',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-labelledby': ariaLabelledBy,
  id,
  role,
  ...props
}) => {
  // Build the props object
  const elementProps: Record<string, any> = {
    className: `sr-only ${className}`.trim(),
    style: SR_ONLY_STYLES,
    ...props
  };

  // Add ARIA attributes
  if (live) elementProps['aria-live'] = live;
  if (live && atomic !== undefined) elementProps['aria-atomic'] = atomic.toString();
  if (live && relevant) elementProps['aria-relevant'] = relevant;
  if (ariaLabel) elementProps['aria-label'] = ariaLabel;
  if (ariaDescribedBy) elementProps['aria-describedby'] = ariaDescribedBy;
  if (ariaLabelledBy) elementProps['aria-labelledby'] = ariaLabelledBy;
  if (id) elementProps.id = id;
  if (role) elementProps.role = role;

  return React.createElement(Component, elementProps, children);
};

/**
 * Specialized components for common screen reader patterns
 */

/**
 * Component for status announcements
 */
export const ScreenReaderStatus: React.FC<Omit<ScreenReaderOnlyProps, 'live' | 'role'>> = (props) => (
  <ScreenReaderOnly
    {...props}
    live="polite"
    role="status"
    as="div"
  />
);

/**
 * Component for alert announcements
 */
export const ScreenReaderAlert: React.FC<Omit<ScreenReaderOnlyProps, 'live' | 'role'>> = (props) => (
  <ScreenReaderOnly
    {...props}
    live="assertive"
    role="alert"
    as="div"
  />
);

/**
 * Component for progress announcements
 */
export const ScreenReaderProgress: React.FC<
  Omit<ScreenReaderOnlyProps, 'live' | 'role'> & {
    value?: number;
    max?: number;
    valueText?: string;
  }
> = ({ value, max, valueText, ...props }) => (
  <ScreenReaderOnly
    {...props}
    live="polite"
    role="progressbar"
    as="div"
    {...(value !== undefined && { 'aria-valuenow': value })}
    {...(max !== undefined && { 'aria-valuemax': max })}
    {...(valueText && { 'aria-valuetext': valueText })}
    aria-valuemin={0}
  />
);

/**
 * Component for describing interactive elements
 */
export const ScreenReaderDescription: React.FC<
  Omit<ScreenReaderOnlyProps, 'live'> & {
    target?: string;
  }
> = ({ target, id, ...props }) => (
  <ScreenReaderOnly
    {...props}
    id={id || `sr-desc-${target || 'element'}`}
    as="div"
  />
);

/**
 * Component for table headers and captions
 */
export const ScreenReaderTableInfo: React.FC<
  Omit<ScreenReaderOnlyProps, 'as'> & {
    type: 'caption' | 'summary';
  }
> = ({ type, ...props }) => (
  <ScreenReaderOnly
    {...props}
    as={type === 'caption' ? 'caption' : 'div'}
  />
);

/**
 * Component for navigation landmarks
 */
export const ScreenReaderLandmark: React.FC<
  Omit<ScreenReaderOnlyProps, 'role'> & {
    landmark: 'navigation' | 'main' | 'complementary' | 'contentinfo' | 'banner' | 'search' | 'region';
    label?: string;
  }
> = ({ landmark, label, ...props }) => (
  <ScreenReaderOnly
    {...props}
    role={landmark}
    aria-label={label}
    as="div"
  />
);

/**
 * Component for keyboard shortcuts descriptions
 */
export const ScreenReaderShortcuts: React.FC<{
  shortcuts: Array<{
    key: string;
    description: string;
  }>;
  title?: string;
}> = ({ shortcuts, title = 'Keyboard shortcuts' }) => (
  <ScreenReaderOnly as="div">
    <h3>{title}</h3>
    <ul>
      {shortcuts.map((shortcut, index) => (
        <li key={index}>
          <kbd>{shortcut.key}</kbd>: {shortcut.description}
        </li>
      ))}
    </ul>
  </ScreenReaderOnly>
);

/**
 * Component for form instructions
 */
export const ScreenReaderFormInstructions: React.FC<{
  instructions: string[];
  fieldId?: string;
}> = ({ instructions, fieldId }) => (
  <ScreenReaderOnly
    id={fieldId ? `${fieldId}-instructions` : undefined}
    as="div"
  >
    {instructions.length === 1 ? (
      instructions[0]
    ) : (
      <ul>
        {instructions.map((instruction, index) => (
          <li key={index}>{instruction}</li>
        ))}
      </ul>
    )}
  </ScreenReaderOnly>
);

/**
 * Component for error summaries
 */
export const ScreenReaderErrorSummary: React.FC<{
  errors: Array<{
    field: string;
    message: string;
    fieldId?: string;
  }>;
  title?: string;
}> = ({ errors, title = 'Form contains errors' }) => (
  <ScreenReaderAlert id="error-summary" tabIndex={-1}>
    <h2>{title}</h2>
    <ul>
      {errors.map((error, index) => (
        <li key={index}>
          {error.fieldId ? (
            <a href={`#${error.fieldId}`}>
              {error.field}: {error.message}
            </a>
          ) : (
            `${error.field}: ${error.message}`
          )}
        </li>
      ))}
    </ul>
  </ScreenReaderAlert>
);

/**
 * Component for skip links
 */
export const ScreenReaderSkipLink: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
}> = ({ href, children, className = '' }) => (
  <a
    href={href}
    className={`sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-2 focus:bg-blue-600 focus:text-white focus:text-sm ${className}`}
    style={{
      ...SR_ONLY_STYLES,
      // Override on focus
      ':focus': {
        position: 'absolute',
        top: '0',
        left: '0',
        zIndex: 50,
        padding: '0.5rem',
        backgroundColor: '#2563eb',
        color: 'white',
        fontSize: '0.875rem',
        width: 'auto',
        height: 'auto',
        overflow: 'visible',
        clip: 'auto',
        whiteSpace: 'normal'
      }
    }}
  >
    {children}
  </a>
);

/**
 * Hook for managing screen reader only content
 */
export function useScreenReaderOnly() {
  const [srOnlyContent, setSrOnlyContent] = React.useState<string>('');

  const updateSrOnlyContent = React.useCallback((content: string) => {
    setSrOnlyContent(content);
  }, []);

  const clearSrOnlyContent = React.useCallback(() => {
    setSrOnlyContent('');
  }, []);

  return {
    srOnlyContent,
    updateSrOnlyContent,
    clearSrOnlyContent
  };
}

/**
 * Higher-order component to add screen reader content to any component
 */
export function withScreenReaderContent<P extends object>(
  Component: React.ComponentType<P>,
  getScreenReaderContent: (props: P) => string
) {
  const WrappedComponent = (props: P) => (
    <>
      <Component {...props} />
      <ScreenReaderOnly>
        {getScreenReaderContent(props)}
      </ScreenReaderOnly>
    </>
  );

  WrappedComponent.displayName = `withScreenReaderContent(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export default ScreenReaderOnly;