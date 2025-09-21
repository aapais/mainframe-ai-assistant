/**
 * LiveRegion Component
 * A React component wrapper for ARIA live regions with advanced management
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { ScreenReaderPriority } from '../utils/screenReaderUtils';

export interface LiveRegionProps {
  /**
   * Live region priority
   */
  priority?: ScreenReaderPriority;

  /**
   * Whether announcements should be atomic
   * @default true
   */
  atomic?: boolean;

  /**
   * What changes should be announced
   * @default 'additions text'
   */
  relevant?: 'additions' | 'removals' | 'text' | 'all' | string;

  /**
   * Role for the live region
   */
  role?: 'status' | 'alert' | 'log' | 'progressbar' | 'marquee' | 'timer';

  /**
   * HTML element to render as
   * @default 'div'
   */
  as?: keyof JSX.IntrinsicElements;

  /**
   * CSS classes
   */
  className?: string;

  /**
   * Inline styles
   */
  style?: React.CSSProperties;

  /**
   * Children content
   */
  children?: React.ReactNode;

  /**
   * Auto-clear content after announcement
   * @default true
   */
  autoClear?: boolean;

  /**
   * Time to wait before clearing content (ms)
   * @default 1000
   */
  clearDelay?: number;

  /**
   * Callback when content is announced
   */
  onAnnounce?: (content: string) => void;

  /**
   * Callback when content is cleared
   */
  onClear?: () => void;

  /**
   * ID for the element
   */
  id?: string;

  /**
   * Additional ARIA attributes
   */
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
}

/**
 * LiveRegion Component
 * Manages ARIA live regions with automatic content clearing and announcement tracking
 */
export const LiveRegion: React.FC<LiveRegionProps> = ({
  priority = 'polite',
  atomic = true,
  relevant = 'additions text',
  role,
  as: Component = 'div',
  className = '',
  style,
  children,
  autoClear = true,
  clearDelay = 1000,
  onAnnounce,
  onClear,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-labelledby': ariaLabelledBy,
  ...props
}) => {
  const [content, setContent] = useState<React.ReactNode>(children);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousContentRef = useRef<string>('');

  // Clear existing timeout when component unmounts or content changes
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  // Handle content changes
  useEffect(() => {
    if (children !== content) {
      setContent(children);

      // Convert content to string for comparison
      const currentContentString = typeof children === 'string'
        ? children
        : React.isValidElement(children)
          ? children.props?.children?.toString() || ''
          : children?.toString() || '';

      // Only announce if content actually changed
      if (currentContentString && currentContentString !== previousContentRef.current) {
        // Clear any existing timeout
        if (clearTimeoutRef.current) {
          clearTimeout(clearTimeoutRef.current);
        }

        // Call announcement callback
        onAnnounce?.(currentContentString);

        // Set up auto-clear if enabled
        if (autoClear && currentContentString) {
          clearTimeoutRef.current = setTimeout(() => {
            setContent('');
            onClear?.();
            previousContentRef.current = '';
          }, clearDelay);
        }

        previousContentRef.current = currentContentString;
      }
    }
  }, [children, content, autoClear, clearDelay, onAnnounce, onClear]);

  // Manual clear function
  const clearContent = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }
    setContent('');
    onClear?.();
    previousContentRef.current = '';
  }, [onClear]);

  // Manual announce function
  const announceContent = useCallback((newContent: React.ReactNode) => {
    setContent(newContent);
  }, []);

  // Build props
  const elementProps: Record<string, any> = {
    className: `live-region ${className}`.trim(),
    style: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: '0',
      ...style
    },
    ...props
  };

  // Add ARIA attributes
  if (priority !== 'off') {
    elementProps['aria-live'] = priority;
    elementProps['aria-atomic'] = atomic.toString();
    elementProps['aria-relevant'] = relevant;
  }

  if (role) elementProps.role = role;
  if (id) elementProps.id = id;
  if (ariaLabel) elementProps['aria-label'] = ariaLabel;
  if (ariaDescribedBy) elementProps['aria-describedby'] = ariaDescribedBy;
  if (ariaLabelledBy) elementProps['aria-labelledby'] = ariaLabelledBy;

  // Expose methods through ref (if needed)
  React.useImperativeHandle(props.ref, () => ({
    clearContent,
    announceContent
  }), [clearContent, announceContent]);

  return React.createElement(Component, elementProps, content);
};

/**
 * Specialized LiveRegion components
 */

/**
 * Status live region for non-urgent announcements
 */
export const StatusLiveRegion: React.FC<Omit<LiveRegionProps, 'priority' | 'role'>> = (props) => (
  <LiveRegion
    {...props}
    priority="polite"
    role="status"
  />
);

/**
 * Alert live region for urgent announcements
 */
export const AlertLiveRegion: React.FC<Omit<LiveRegionProps, 'priority' | 'role'>> = (props) => (
  <LiveRegion
    {...props}
    priority="assertive"
    role="alert"
  />
);

/**
 * Progress live region for progress updates
 */
export const ProgressLiveRegion: React.FC<
  Omit<LiveRegionProps, 'role'> & {
    value?: number;
    max?: number;
    valueText?: string;
  }
> = ({ value, max, valueText, ...props }) => (
  <LiveRegion
    {...props}
    role="progressbar"
    aria-valuenow={value}
    aria-valuemax={max}
    aria-valuemin={0}
    aria-valuetext={valueText}
  />
);

/**
 * Log live region for sequential announcements
 */
export const LogLiveRegion: React.FC<Omit<LiveRegionProps, 'role' | 'atomic'>> = (props) => (
  <LiveRegion
    {...props}
    role="log"
    atomic={false}
    autoClear={false}
  />
);

/**
 * Hook for managing live region announcements
 */
export function useLiveRegion(initialPriority: ScreenReaderPriority = 'polite') {
  const [announcement, setAnnouncement] = useState<string>('');
  const [priority, setPriority] = useState<ScreenReaderPriority>(initialPriority);

  const announce = useCallback((message: string, announcementPriority?: ScreenReaderPriority) => {
    if (announcementPriority) {
      setPriority(announcementPriority);
    }
    setAnnouncement(message);
  }, []);

  const clear = useCallback(() => {
    setAnnouncement('');
  }, []);

  const announceAndClear = useCallback((message: string, delay: number = 1000) => {
    announce(message);
    setTimeout(clear, delay);
  }, [announce, clear]);

  return {
    announcement,
    priority,
    announce,
    clear,
    announceAndClear,
    setPriority
  };
}

/**
 * Context for managing multiple live regions
 */
interface LiveRegionContextValue {
  announceStatus: (message: string) => void;
  announceAlert: (message: string) => void;
  announceProgress: (message: string, value?: number, max?: number) => void;
  announceLog: (message: string) => void;
  clearAll: () => void;
}

const LiveRegionContext = React.createContext<LiveRegionContextValue | null>(null);

/**
 * Provider for live region context
 */
export const LiveRegionProvider: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const [statusMessage, setStatusMessage] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [logMessage, setLogMessage] = useState('');
  const [progressValue, setProgressValue] = useState<number | undefined>();
  const [progressMax, setProgressMax] = useState<number | undefined>();

  const announceStatus = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  const announceAlert = useCallback((message: string) => {
    setAlertMessage(message);
  }, []);

  const announceProgress = useCallback((message: string, value?: number, max?: number) => {
    setProgressMessage(message);
    setProgressValue(value);
    setProgressMax(max);
  }, []);

  const announceLog = useCallback((message: string) => {
    setLogMessage(prev => prev ? `${prev}\n${message}` : message);
  }, []);

  const clearAll = useCallback(() => {
    setStatusMessage('');
    setAlertMessage('');
    setProgressMessage('');
    setLogMessage('');
    setProgressValue(undefined);
    setProgressMax(undefined);
  }, []);

  const contextValue: LiveRegionContextValue = {
    announceStatus,
    announceAlert,
    announceProgress,
    announceLog,
    clearAll
  };

  return (
    <LiveRegionContext.Provider value={contextValue}>
      {children}
      <div className={`live-regions-container ${className}`}>
        <StatusLiveRegion id="global-status-region">
          {statusMessage}
        </StatusLiveRegion>
        <AlertLiveRegion id="global-alert-region">
          {alertMessage}
        </AlertLiveRegion>
        <ProgressLiveRegion
          id="global-progress-region"
          value={progressValue}
          max={progressMax}
        >
          {progressMessage}
        </ProgressLiveRegion>
        <LogLiveRegion id="global-log-region">
          {logMessage}
        </LogLiveRegion>
      </div>
    </LiveRegionContext.Provider>
  );
};

/**
 * Hook to use live region context
 */
export function useLiveRegionContext(): LiveRegionContextValue {
  const context = React.useContext(LiveRegionContext);
  if (!context) {
    throw new Error('useLiveRegionContext must be used within a LiveRegionProvider');
  }
  return context;
}

/**
 * Higher-order component to add live region announcements
 */
export function withLiveRegionAnnouncements<P extends object>(
  Component: React.ComponentType<P>,
  getAnnouncementText: (props: P) => string | null
) {
  const WrappedComponent = (props: P) => {
    const { announceStatus } = useLiveRegionContext();
    const announcement = getAnnouncementText(props);

    useEffect(() => {
      if (announcement) {
        announceStatus(announcement);
      }
    }, [announcement, announceStatus]);

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withLiveRegionAnnouncements(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

export default LiveRegion;